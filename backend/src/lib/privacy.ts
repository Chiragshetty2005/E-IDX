/**
 * Privacy guard. Academic risk must never travel through a student-facing or
 * card payload. The routes call `assertNoRiskFields` before writing anything
 * that leaves the risk service.
 */

const RISK_TOKENS = [
  'risk',
  'probability',
  'shap',
  'driver',
  'prediction',
  'model_version',
  'risk_tier',
  'risk_probability',
  'at_risk',
]

export function containsRiskField(value: unknown): string | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = containsRiskField(item)
      if (found) return found
    }
    return null
  }
  if (value && typeof value === 'object') {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      const lowered = key.toLowerCase()
      if (RISK_TOKENS.some((token) => lowered.includes(token))) return key
      const found = containsRiskField(nested)
      if (found) return found
    }
  }
  return null
}

export class RiskLeakError extends Error {
  readonly field: string

  constructor(field: string) {
    super(`Refusing to send academic risk data outside a staff route (blocked field: ${field}).`)
    this.field = field
  }
}

export function assertNoRiskFields(value: unknown): void {
  const field = containsRiskField(value)
  if (field) throw new RiskLeakError(field)
}
