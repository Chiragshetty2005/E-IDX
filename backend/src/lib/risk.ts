import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { withStaffScope } from '../db.js'

export type RiskTier = 'support' | 'watch' | 'on-track'

export interface RiskDriver {
  feature: string
  label: string
  group: string
  value: number | null
  display: string | null
  shap_value: number
  direction: 'increases-risk' | 'reduces-risk'
}

/**
 * Mirrors ml/artifacts/prediction_payload.schema.json exactly. The payload is
 * staff only: it is never returned by a `/me/*` route or a card update.
 */
export interface RiskPayload {
  model_version: string
  cutoff_day: number
  generated_at: string
  student_ref?: string
  module_ref?: string
  risk_probability: number
  risk_tier: RiskTier
  drivers: RiskDriver[]
}

export interface CampusRiskSummary {
  support: number
  watch: number
  on_track: number
  total: number
  model_version: string | null
  cutoff_day: number | null
  generated_at: string | null
}

interface PredictionRow {
  student_id: string
  course_code: string
  model_version: string
  cutoff_day: number
  probability: number
  tier: RiskTier
  drivers: RiskDriver[]
  generated_at: Date
  external_id?: string
}

function toPayload(row: PredictionRow): RiskPayload {
  const payload: RiskPayload = {
    model_version: row.model_version,
    cutoff_day: row.cutoff_day,
    generated_at: new Date(row.generated_at).toISOString(),
    risk_probability: Number(row.probability),
    risk_tier: row.tier,
    drivers: row.drivers ?? [],
  }
  if (row.external_id) payload.student_ref = row.external_id
  payload.module_ref = row.course_code
  return payload
}

export async function getStudentPredictions(externalId: string): Promise<RiskPayload[]> {
  return withStaffScope(async (client) => {
    const result = await client.query<PredictionRow>(
      `SELECT p.student_id, p.course_code, p.model_version, p.cutoff_day,
              p.probability, p.tier, p.drivers, p.generated_at,
              u.external_id
         FROM risk.staff_predictions p
         JOIN app_users u ON u.id = p.student_id
        WHERE u.external_id = $1
        ORDER BY p.generated_at DESC, p.course_code`,
      [externalId],
    )
    return result.rows.map(toPayload)
  })
}

export async function getCampusRiskSummary(): Promise<CampusRiskSummary> {
  return withStaffScope(async (client) => {
    const result = await client.query<{
      support: number
      watch: number
      on_track: number
      total: number
      model_version: string | null
      cutoff_day: number | null
      generated_at: Date | null
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE tier = 'support')::int AS support,
         COUNT(*) FILTER (WHERE tier = 'watch')::int AS watch,
         COUNT(*) FILTER (WHERE tier = 'on-track')::int AS on_track,
         COUNT(DISTINCT student_id)::int AS total,
         MAX(model_version) AS model_version,
         MAX(cutoff_day)::int AS cutoff_day,
         MAX(generated_at) AS generated_at
       FROM risk.staff_predictions`,
    )
    const row = result.rows[0]
    return {
      support: row?.support ?? 0,
      watch: row?.watch ?? 0,
      on_track: row?.on_track ?? 0,
      total: row?.total ?? 0,
      model_version: row?.model_version ?? null,
      cutoff_day: row?.cutoff_day ?? null,
      generated_at: row?.generated_at ? new Date(row.generated_at).toISOString() : null,
    }
  })
}

export interface CohortRiskRow {
  usn: string
  name: string
  course_code: string
  risk_probability: number
  risk_tier: RiskTier
  top_driver: string | null
  generated_at: string
}

export async function getCohortRisk(limit = 100): Promise<CohortRiskRow[]> {
  return withStaffScope(async (client) => {
    const result = await client.query<{
      external_id: string
      full_name: string
      course_code: string
      probability: number
      tier: RiskTier
      drivers: RiskDriver[]
      generated_at: Date
    }>(
      `SELECT u.external_id, u.full_name, p.course_code, p.probability, p.tier,
              p.drivers, p.generated_at
         FROM risk.staff_predictions p
         JOIN app_users u ON u.id = p.student_id
        WHERE p.tier IN ('support', 'watch')
        ORDER BY p.probability DESC, u.external_id
        LIMIT $1`,
      [limit],
    )
    return result.rows.map((row) => {
      const drivers = row.drivers ?? []
      const strongest = drivers.reduce<RiskDriver | null>((best, driver) => {
        if (!best) return driver
        return Math.abs(driver.shap_value) > Math.abs(best.shap_value) ? driver : best
      }, null)
      return {
        usn: row.external_id,
        name: row.full_name,
        course_code: row.course_code,
        risk_probability: Number(row.probability),
        risk_tier: row.tier,
        top_driver: strongest?.label ?? null,
        generated_at: new Date(row.generated_at).toISOString(),
      }
    })
  })
}

export interface ModelContract {
  model_version: string
  created_at_utc: string
  cutoff_day: number
  dataset_rows: number
  feature_columns: string[]
  feature_groups: Record<string, string[]>
  needs_support_threshold: number
  watch_threshold: number
  cross_validation_auc: number
  cross_validation_pr_auc: number
  recall_at_20pct: number
  temporal_test_auc: number
  temporal_test_pr_auc: number
  shap_group_importance: Array<{ group: string; share: number }>
  fairness_selection_gaps: Record<string, number>
  at_risk_rate: number
  /** Read from the frozen metrics file when it is present. */
  student_count?: number
  brier?: number
}

let cachedContract: ModelContract | null = null

export function loadModelContract(): ModelContract | null {
  if (cachedContract) return cachedContract
  const path = fileURLToPath(new URL('../../../ml/artifacts/model_meta.json', import.meta.url))
  if (!existsSync(path)) return null
  const contract = JSON.parse(readFileSync(path, 'utf8')) as ModelContract

  // model_meta.json keeps the deployable contract small; the evaluation
  // metrics file also carries the student count and Brier score shown on the
  // insights screen. Merge them when the artifacts are present.
  const metricsPath = fileURLToPath(new URL('../../../ml/artifacts/metrics.json', import.meta.url))
  if (existsSync(metricsPath)) {
    try {
      const metrics = JSON.parse(readFileSync(metricsPath, 'utf8')) as {
        dataset?: { students?: number }
        cross_validation?: { catboost?: { summary?: { brier?: { mean?: number } } } }
      }
      if (typeof metrics.dataset?.students === 'number') {
        contract.student_count = metrics.dataset.students
      }
      const brier = metrics.cross_validation?.catboost?.summary?.brier?.mean
      if (typeof brier === 'number') contract.brier = brier
    } catch {
      // The contract is still usable without the optional evaluation fields.
    }
  }

  cachedContract = contract
  return cachedContract
}
