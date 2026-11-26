import type { FastifyInstance } from 'fastify'

import { getCampusRiskSummary, loadModelContract } from '../lib/risk.js'

export async function insightRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.requireRole(['admin', 'faculty']))

  app.get('/insights/risk', async () => {
    const summary = await getCampusRiskSummary()
    const contract = loadModelContract()

    const share = (count: number) =>
      summary.total > 0 ? Number((count / summary.total).toFixed(4)) : 0

    return {
      generated_at: new Date().toISOString(),
      tiers: {
        support: { count: summary.support, share: share(summary.support) },
        watch: { count: summary.watch, share: share(summary.watch) },
        'on-track': { count: summary.on_track, share: share(summary.on_track) },
      },
      total: summary.total,
      model_version: summary.model_version,
      cutoff_day: summary.cutoff_day,
      scored_at: summary.generated_at,
      driver_groups: contract?.shap_group_importance ?? [],
      thresholds: contract
        ? {
            needs_support: contract.needs_support_threshold,
            watch: contract.watch_threshold,
          }
        : null,
      note: 'Capacity-based tiers: the top 10% are flagged for support, the next 20% are watched.',
    }
  })

  app.get('/insights/model', async () => {
    const contract = loadModelContract()
    if (!contract) {
      return { available: false, reason: 'Model artifacts are not present in this deployment.' }
    }
    return {
      available: true,
      model: {
        version: contract.model_version,
        created_at: contract.created_at_utc,
        cutoff_day: contract.cutoff_day,
        dataset_rows: contract.dataset_rows,
        student_count: contract.student_count ?? null,
        feature_count: contract.feature_columns.length,
        at_risk_rate: contract.at_risk_rate,
        brier: contract.brier ?? null,
        thresholds: {
          needs_support: contract.needs_support_threshold,
          watch: contract.watch_threshold,
        },
        metrics: {
          cross_validation_auc: contract.cross_validation_auc,
          cross_validation_pr_auc: contract.cross_validation_pr_auc,
          recall_at_20pct: contract.recall_at_20pct,
          temporal_test_auc: contract.temporal_test_auc,
          temporal_test_pr_auc: contract.temporal_test_pr_auc,
        },
        driver_groups: contract.shap_group_importance,
        fairness_selection_gaps: contract.fairness_selection_gaps,
        feature_groups: contract.feature_groups,
      },
      note: 'Socioeconomic attributes are excluded from the model and used only for subgroup checks.',
    }
  })
}
