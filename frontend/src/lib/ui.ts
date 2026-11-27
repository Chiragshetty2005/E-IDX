import type { CardStatus, CheckpointZone, PresenceState, RiskLevel } from '../types'

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ')
}

export const cardStatusLabel: Record<CardStatus, string> = {
  active: 'Active',
  sync: 'Update pending',
  'low-battery': 'Low battery',
  revoked: 'Revoked',
  unprovisioned: 'Not provisioned',
}

export const riskLabel: Record<RiskLevel, string> = {
  support: 'Needs support',
  watch: 'Watch',
  'on-track': 'On track',
}

export const zoneLabel: Record<CheckpointZone, string> = {
  bus: 'Bus',
  gate: 'Gate',
  classroom: 'Classroom',
  library: 'Library',
  canteen: 'Canteen',
}

export const presenceStateLabel: Record<PresenceState, string> = {
  'on-campus': 'On campus',
  'on-bus': 'On the bus',
  left: 'Left campus',
  'not-arrived': 'Not arrived',
}

export const methodLabel: Record<string, string> = {
  uhf: 'UHF read',
  qr: 'QR scan',
  nfc: 'NFC tap',
}

export function formatPercent(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`
}

export function formatProbability(value: number) {
  return value.toFixed(2)
}

export function monthFromInput(value: string) {
  const [year, month] = value.split('-')
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ]
  return `${months[Number(month) - 1]} ${year}`
}
