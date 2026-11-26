export type Role = 'admin' | 'faculty' | 'student'

export type CardStatus = 'active' | 'sync' | 'low-battery' | 'revoked' | 'unprovisioned'

export type RiskLevel = 'support' | 'watch' | 'on-track'

export type VerificationResult = 'accepted' | 'rejected'

export type VerificationMethod = 'qr' | 'nfc'

export interface Card {
  id: string
  status: CardStatus
  battery: number
  lastSync: string
  validTo: string
  firmware: string
}

export interface CourseAttendance {
  code: string
  title: string
  attended: number
  held: number
}

export interface Intervention {
  date: string
  note: string
  by: string
}

export interface Student {
  usn: string
  name: string
  initials: string
  programme: string
  semester: string
  section: string
  attendance: number
  cgpa: number
  backlogs: number
  internalMarks: number
  internalMax: number
  assignmentRate: number
  libraryVisits: number
  risk: RiskLevel
  probability: number
  driver: string
  mentor: string
  card: Card
  courses: CourseAttendance[]
  sgpa: { term: string; value: number }[]
  interventions: Intervention[]
}

export interface Verification {
  id: string
  time: string
  usn: string
  method: VerificationMethod
  location: string
  reader: string
  result: VerificationResult
  latency: number
}

export interface CardUpdate {
  id: string
  usn: string
  change: string
  time: string
  state: 'queued' | 'confirmed'
}

export interface Session {
  id: string
  code: string
  title: string
  room: string
  start: string
  end: string
  present: number
  total: number
  status: 'open' | 'closed' | 'upcoming'
}

export interface ShapFeature {
  label: string
  value: number
}
