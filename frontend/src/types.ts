export type Role = 'admin' | 'faculty' | 'parent' | 'student'

/** `school` is the pre-KG to Grade 4 pilot; `college` is the university register. */
export type CampusLevel = 'school' | 'college'

export type CardStatus = 'active' | 'sync' | 'low-battery' | 'revoked' | 'unprovisioned'

export type RiskLevel = 'support' | 'watch' | 'on-track'

export type VerificationResult = 'accepted' | 'rejected'

export type VerificationMethod = 'qr' | 'nfc'

/** Where a student is right now, from the latest checkpoint read. */
export type PresenceState = 'on-campus' | 'on-bus' | 'left' | 'not-arrived'

export type CheckpointZone = 'bus' | 'gate' | 'classroom' | 'library' | 'canteen'

export type PresenceMethod = 'uhf' | 'qr' | 'nfc'

export type PresenceDirection = 'in' | 'out'

export interface Card {
  id: string
  status: CardStatus
  battery: number
  lastSync: string
  validTo: string
  firmware: string
  nfcUid: string
  uhfTagId: string
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
  level: CampusLevel
  classLabel: string | null
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

/**
 * The identity fields the e-ink card and the QR pass need. Both the staff
 * `Student` record and the student-facing `StudentProfile` satisfy it, so the
 * card component can be reused without carrying risk fields into `/me`.
 */
export interface CardHolder {
  usn: string
  name: string
  initials: string
  programme: string
  semester: string
  section: string
  attendance: number
  card: Card
}

export interface StudentProfile extends CardHolder {
  cgpa: number
  backlogs: number
  internalMarks: number
  internalMax: number
  assignmentRate: number
  libraryVisits: number
  mentor: string
  courses: CourseAttendance[]
  sgpa: { term: string; value: number }[]
}

export interface Exam {
  code: string
  title: string
  date: string
  time: string
  hall: string
}

export interface LibraryLoan {
  title: string
  due: string
  status: string
}

export interface FeeReceipt {
  term: string
  amount: string
  paidOn: string
  receipt: string
  status: string
}

export interface Verification {
  id: string
  time: string
  usn: string
  name?: string
  initials?: string
  method: VerificationMethod
  location: string
  reader: string
  result: VerificationResult
  latency: number
}

export interface CardUpdate {
  id: string
  usn: string
  name?: string
  cardId?: string
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
