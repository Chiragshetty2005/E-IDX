/**
 * Seed the E-IDX database.
 *
 * The seed is deterministic: every identifier is derived from a stable key,
 * so running it twice produces the same database. Academic risk comes from
 * the trained OULAD model via `npm run export:risk`, which writes
 * `seed/risk_seed.json` from the frozen artifacts.
 *
 * Run:
 *   npm run export:risk   # once, with ml/.venv
 *   npm run seed
 */

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import pg from 'pg'

import { config } from '../src/config.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const SEED_PATH = resolve(HERE, '..', 'seed', 'risk_seed.json')

const ADMIN_EXTERNAL_ID = 'EMP-0001'
const ADMIN_NAME = 'Kavya Srinivas'
const FACULTY_EXTERNAL_ID = 'EMP-0101'
const FACULTY_NAME = 'Dr. Shahin Fatima'
const FACULTY_2_EXTERNAL_ID = 'EMP-0102'
const FACULTY_2_NAME = 'Dr. Anita Rao'

const PROGRAMME = 'B.E. Computer science and engineering'
const SEMESTER = 'Semester VI'
const SECTION = 'Section A'

const COURSES = [
  { code: 'CS601', title: 'Software engineering', held: 44, offset: 2.2 },
  { code: 'CS602', title: 'Machine learning', held: 42, offset: -1.6 },
  { code: 'CS603', title: 'Cloud computing', held: 37, offset: 0.9 },
  { code: 'CS604', title: 'Minor project', held: 22, offset: 2.8 },
]

const READERS = [
  { name: 'Gate 01', location: 'Main gate' },
  { name: 'Gate 02', location: 'Main gate' },
  { name: 'Library desk', location: 'Library desk' },
  { name: 'Block C lab', location: 'Block C lab' },
  { name: 'Exam hall', location: 'Exam hall' },
]

interface DemoStudent {
  usn: string
  name: string
  baseAttendance: number
  cgpa: number
  backlogs: number
  internalMarks: number
  assignmentRate: number
  libraryVisits: number
  cardStatus: string
  battery: number
  lastSyncMinutes: number
  sgpa: number[]
  interventions?: Array<{ daysAgo: number; note: string; by: string }>
}

/** Mirrors the frontend preview students so both surfaces tell one story. */
const DEMO_STUDENTS: DemoStudent[] = [
  {
    usn: '1DS23CS0084',
    name: 'Arjun Kamath',
    baseAttendance: 58,
    cgpa: 5.31,
    backlogs: 3,
    internalMarks: 11,
    assignmentRate: 48,
    libraryVisits: 1,
    cardStatus: 'revoked',
    battery: 71,
    lastSyncMinutes: 2880,
    sgpa: [6.12, 5.94, 5.81, 5.46, 5.38, 5.31],
    interventions: [
      {
        daysAgo: 12,
        note: 'Card revoked after a loss report. Replacement queued at the card office.',
        by: ADMIN_NAME,
      },
    ],
  },
  {
    usn: '1DS23CS0056',
    name: 'Karthik Nayak',
    baseAttendance: 62,
    cgpa: 5.72,
    backlogs: 1,
    internalMarks: 13,
    assignmentRate: 58,
    libraryVisits: 2,
    cardStatus: 'revoked',
    battery: 55,
    lastSyncMinutes: 1440,
    sgpa: [6.48, 6.22, 6.04, 5.91, 5.83, 5.72],
  },
  {
    usn: '1DS23CS0017',
    name: 'Ananya Hegde',
    baseAttendance: 68,
    cgpa: 6.18,
    backlogs: 2,
    internalMarks: 14,
    assignmentRate: 61,
    libraryVisits: 3,
    cardStatus: 'active',
    battery: 62,
    lastSyncMinutes: 8,
    sgpa: [7.42, 7.08, 6.84, 6.52, 6.34, 6.18],
    interventions: [
      {
        daysAgo: 14,
        note: 'Spoke after the ML lab. She is managing a family issue and asked for notes from the two missed weeks.',
        by: FACULTY_NAME,
      },
      {
        daysAgo: 21,
        note: 'Shared a semester plan and booked a check in for 19 November.',
        by: FACULTY_NAME,
      },
      {
        daysAgo: 35,
        note: 'Flagged by the model. First review of assessment submissions and VLE activity.',
        by: FACULTY_NAME,
      },
    ],
  },
  {
    usn: '1DS23CS0031',
    name: 'Rohan Prabhu',
    baseAttendance: 75,
    cgpa: 6.94,
    backlogs: 1,
    internalMarks: 16,
    assignmentRate: 54,
    libraryVisits: 4,
    cardStatus: 'active',
    battery: 48,
    lastSyncMinutes: 2,
    sgpa: [8.01, 7.64, 7.41, 7.18, 7.02, 6.94],
    interventions: [
      {
        daysAgo: 8,
        note: 'Email sent about two missing assignments. No reply yet.',
        by: FACULTY_NAME,
      },
    ],
  },
  {
    usn: '1DS23CS0063',
    name: 'Aditya Bhat',
    baseAttendance: 78,
    cgpa: 7.21,
    backlogs: 0,
    internalMarks: 18,
    assignmentRate: 69,
    libraryVisits: 5,
    cardStatus: 'low-battery',
    battery: 14,
    lastSyncMinutes: 34,
    sgpa: [7.86, 7.62, 7.48, 7.39, 7.28, 7.21],
  },
  {
    usn: '1DS23CS0071',
    name: 'Vikram Shetty',
    baseAttendance: 84,
    cgpa: 7.66,
    backlogs: 0,
    internalMarks: 19,
    assignmentRate: 76,
    libraryVisits: 6,
    cardStatus: 'active',
    battery: 91,
    lastSyncMinutes: 12,
    sgpa: [8.24, 8.06, 7.92, 7.81, 7.72, 7.66],
  },
  {
    usn: '1DS23CS0038',
    name: 'Nandini Rao',
    baseAttendance: 87,
    cgpa: 8.15,
    backlogs: 0,
    internalMarks: 21,
    assignmentRate: 88,
    libraryVisits: 8,
    cardStatus: 'sync',
    battery: 88,
    lastSyncMinutes: 120,
    sgpa: [8.44, 8.32, 8.21, 8.24, 8.18, 8.15],
  },
  {
    usn: '1DS23CS0009',
    name: 'Meera Iyer',
    baseAttendance: 88,
    cgpa: 8.04,
    backlogs: 0,
    internalMarks: 20,
    assignmentRate: 84,
    libraryVisits: 7,
    cardStatus: 'active',
    battery: 73,
    lastSyncMinutes: 6,
    sgpa: [8.31, 8.18, 8.09, 8.11, 8.07, 8.04],
  },
  {
    usn: '1DS23CS0012',
    name: 'Priya Menon',
    baseAttendance: 91,
    cgpa: 8.78,
    backlogs: 0,
    internalMarks: 22,
    assignmentRate: 91,
    libraryVisits: 11,
    cardStatus: 'active',
    battery: 84,
    lastSyncMinutes: 4,
    sgpa: [8.92, 8.86, 8.81, 8.84, 8.8, 8.78],
  },
  {
    usn: '1DS23CS0024',
    name: 'Sneha Reddy',
    baseAttendance: 96,
    cgpa: 9.12,
    backlogs: 0,
    internalMarks: 24,
    assignmentRate: 96,
    libraryVisits: 14,
    cardStatus: 'active',
    battery: 96,
    lastSyncMinutes: 9,
    sgpa: [9.21, 9.18, 9.14, 9.16, 9.13, 9.12],
  },
  {
    usn: '1DS23CS0029',
    name: 'Divya Prasad',
    baseAttendance: 91,
    cgpa: 8.44,
    backlogs: 0,
    internalMarks: 21,
    assignmentRate: 89,
    libraryVisits: 9,
    cardStatus: 'active',
    battery: 67,
    lastSyncMinutes: 15,
    sgpa: [8.68, 8.59, 8.52, 8.48, 8.46, 8.44],
  },
  {
    usn: '1DS23CS0048',
    name: 'Chirag P Shetty',
    baseAttendance: 92,
    cgpa: 8.62,
    backlogs: 0,
    internalMarks: 23,
    assignmentRate: 94,
    libraryVisits: 10,
    cardStatus: 'active',
    battery: 78,
    lastSyncMinutes: 8,
    sgpa: [8.41, 8.55, 8.32, 8.74, 8.66, 8.62],
  },
]

const FIRST_NAMES = [
  'Aarav', 'Diya', 'Ishaan', 'Kavya', 'Manish', 'Nivedita', 'Ritesh', 'Sanjana',
  'Tanvi', 'Varun', 'Yash', 'Zoya', 'Bharath', 'Chitra', 'Deepak', 'Eshita',
  'Ganesh', 'Harshini', 'Jaya', 'Kiran', 'Lakshmi', 'Mohan', 'Nisha', 'Omkar',
]
const LAST_NAMES = [
  'Acharya', 'Bhat', 'Chauhan', 'Desai', 'Gowda', 'Hegde', 'Iyer', 'Joshi',
  'Kulkarni', 'Menon', 'Nair', 'Patil', 'Rao', 'Shetty', 'Thomas', 'Verma',
]

interface RiskDriver {
  feature: string
  label: string
  group: string
  value: number | null
  display: string | null
  shap_value: number
  direction: 'increases-risk' | 'reduces-risk'
}

interface RiskSeedStudent {
  oulad_student_id: number
  course_code: string
  course_title: string
  source_module: string
  source_presentation: string
  probability: number
  tier: 'support' | 'watch' | 'on-track'
  at_risk: boolean
  drivers: RiskDriver[]
  features: Record<string, number | string | null>
}

interface RiskSeed {
  model_version: string
  cutoff_day: number
  needs_support_threshold: number
  watch_threshold: number
  generated_at: string
  campus_size: number
  tier_counts: Record<string, number>
  students: RiskSeedStudent[]
  demo: Record<string, RiskSeedStudent>
}

function uuidV5(name: string, namespace = 'eidx'): string {
  const hash = createHash('sha1').update(`${namespace}:${name}`).digest()
  const bytes = Buffer.from(hash.subarray(0, 16))
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x50
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80
  const hex = bytes.toString('hex')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Param = string | number | boolean | null | object

async function insertMany(
  client: pg.ClientBase,
  table: string,
  columns: string[],
  rows: Param[][],
  chunkSize = 500,
): Promise<void> {
  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize)
    const values = chunk
      .map((row, rowIndex) => {
        const placeholders = row.map((_, columnIndex) => `$${rowIndex * columns.length + columnIndex + 1}`)
        return `(${placeholders.join(', ')})`
      })
      .join(', ')
    const params = chunk.flat()
    await client.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES ${values}`,
      params as unknown[],
    )
  }
}

function minutesAgo(minutes: number): Date {
  return new Date(Date.now() - minutes * 60 * 1000)
}

async function main(): Promise<void> {
  let seed: RiskSeed
  try {
    seed = JSON.parse(await readFile(SEED_PATH, 'utf8')) as RiskSeed
  } catch {
    console.error(
      `[seed] ${SEED_PATH} not found. Run "npm run export:risk" with ml/.venv first.`,
    )
    process.exit(1)
  }

  const client = new pg.Client({ connectionString: config.databaseAdminUrl })
  await client.connect()
  const random = mulberry32(20261126)

  console.log(`[seed] model ${seed.model_version}, cutoff day ${seed.cutoff_day}`)

  await client.query('BEGIN')
  try {
    await client.query(`
      TRUNCATE app_users, auth_sessions, cards, card_updates, course_enrollments,
        course_attendance_summary, student_academic_profiles, attendance_sessions,
        attendance_records, verification_events, interventions, readers, exam_schedule,
        library_loans, fee_receipts, risk.feature_snapshots, risk.predictions
      RESTART IDENTITY CASCADE
    `)

    // ---------------------------------------------------------------- staff
    const adminId = uuidV5(`user:${ADMIN_EXTERNAL_ID}`)
    const facultyId = uuidV5(`user:${FACULTY_EXTERNAL_ID}`)
    const faculty2Id = uuidV5(`user:${FACULTY_2_EXTERNAL_ID}`)

    await insertMany(
      client,
      'app_users',
      ['id', 'external_id', 'full_name', 'email', 'role', 'programme', 'semester', 'section'],
      [
        [adminId, ADMIN_EXTERNAL_ID, ADMIN_NAME, 'kavya.srinivas@eidx.edu', 'admin', null, null, null],
        [facultyId, FACULTY_EXTERNAL_ID, FACULTY_NAME, 'shahin.fatima@eidx.edu', 'faculty', PROGRAMME, null, null],
        [faculty2Id, FACULTY_2_EXTERNAL_ID, FACULTY_2_NAME, 'anita.rao@eidx.edu', 'faculty', PROGRAMME, null, null],
      ],
    )

    await insertMany(
      client,
      'readers',
      ['id', 'name', 'location', 'api_key_hash', 'status'],
      READERS.map((reader) => [
        uuidV5(`reader:${reader.name}`),
        reader.name,
        reader.location,
        createHash('sha256').update(config.readerApiKey).digest('hex'),
        'online',
      ]),
    )

    // ------------------------------------------------------------- students
    const demoIds = new Set(Object.values(seed.demo).map((record) => record.oulad_student_id))
    const bulkRecords = seed.students.filter((record) => !demoIds.has(record.oulad_student_id))
    console.log(
      `[seed] ${DEMO_STUDENTS.length} preview students, ${bulkRecords.length} sampled students`,
    )

    interface SeededStudent {
      id: string
      usn: string
      name: string
      mentorId: string
      cardId: string
      tier: string
      baseAttendance: number
      cgpa: number
      backlogs: number
      internalMarks: number
      assignmentRate: number
      libraryVisits: number
      cardStatus: string
      battery: number
      lastSyncMinutes: number
      sgpa: number[]
      interventions: Array<{ daysAgo: number; note: string; by: string }>
      risk: RiskSeedStudent
    }

    const seeded: SeededStudent[] = []

    DEMO_STUDENTS.forEach((demo, index) => {
      const risk = seed.demo[demo.usn]
      if (!risk) throw new Error(`No risk record for ${demo.usn}`)
      const id = uuidV5(`user:${demo.usn}`)
      seeded.push({
        id,
        usn: demo.usn,
        name: demo.name,
        mentorId: index % 2 === 0 ? facultyId : faculty2Id,
        cardId: uuidV5(`card:${demo.usn}`),
        tier: risk.tier,
        baseAttendance: demo.baseAttendance,
        cgpa: demo.cgpa,
        backlogs: demo.backlogs,
        internalMarks: demo.internalMarks,
        assignmentRate: demo.assignmentRate,
        libraryVisits: demo.libraryVisits,
        cardStatus: demo.cardStatus,
        battery: demo.battery,
        lastSyncMinutes: demo.lastSyncMinutes,
        sgpa: demo.sgpa,
        interventions: demo.interventions ?? [],
        risk,
      })
    })

    bulkRecords.forEach((risk, index) => {
      const usn = `1DS26CS${String(1000 + index).padStart(4, '0')}`
      const first = FIRST_NAMES[Math.floor(random() * FIRST_NAMES.length)] as string
      const last = LAST_NAMES[Math.floor(random() * LAST_NAMES.length)] as string
      const tierPenalty = risk.tier === 'support' ? 12 : risk.tier === 'watch' ? 5 : 0
      const cgpa = Number(
        Math.max(4.2, Math.min(9.6, 8.4 - tierPenalty + (random() - 0.5) * 1.6)).toFixed(2),
      )
      seeded.push({
        id: uuidV5(`user:${usn}`),
        usn,
        name: `${first} ${last}`,
        mentorId: index % 2 === 0 ? facultyId : faculty2Id,
        cardId: uuidV5(`card:${usn}`),
        tier: risk.tier,
        baseAttendance: Math.round(62 + random() * 34 - tierPenalty),
        cgpa,
        backlogs: risk.tier === 'support' ? Math.round(random() * 3) : 0,
        internalMarks: Math.round(10 + random() * 14 - tierPenalty * 0.4),
        assignmentRate: Math.round(45 + random() * 50 - tierPenalty),
        libraryVisits: Math.round(random() * 12),
        cardStatus:
          random() > 0.94 ? 'low-battery' : random() > 0.9 ? 'sync' : random() > 0.985 ? 'revoked' : 'active',
        battery: Math.round(18 + random() * 80),
        lastSyncMinutes:
          random() < 0.95 ? Math.round(random() * 360) : 360 + Math.round(random() * 2880),
        sgpa: [cgpa + 0.5, cgpa + 0.3, cgpa + 0.2, cgpa + 0.1, cgpa + 0.05, cgpa].map((value) =>
          Number(value.toFixed(2)),
        ),
        interventions: [],
        risk,
      })
    })

    await insertMany(
      client,
      'app_users',
      [
        'id',
        'external_id',
        'full_name',
        'email',
        'role',
        'programme',
        'semester',
        'section',
        'mentor_id',
      ],
      seeded.map((student) => [
        student.id,
        student.usn,
        student.name,
        `${student.usn.toLowerCase()}@eidx.edu`,
        'student',
        PROGRAMME,
        SEMESTER,
        SECTION,
        student.mentorId,
      ]),
    )

    // ---------------------------------------------------------------- cards
    await insertMany(
      client,
      'cards',
      [
        'id',
        'student_id',
        'card_uid',
        'status',
        'battery',
        'firmware',
        'valid_from',
        'valid_to',
        'last_sync_at',
        'revoked_at',
        'revoke_reason',
      ],
      seeded.map((student) => [
        student.cardId,
        student.id,
        `EIDX-${student.usn.slice(-4)}`,
        student.cardStatus,
        student.battery,
        '1.4.2',
        new Date('2026-07-01T00:00:00Z'),
        new Date('2027-06-30T23:59:59Z'),
        minutesAgo(student.lastSyncMinutes),
        student.cardStatus === 'revoked' ? minutesAgo(1440) : null,
        student.cardStatus === 'revoked' ? 'Reported lost at the card office' : null,
      ]),
    )

    // ------------------------------------------------------- academic record
    const enrollmentRows: Param[][] = []
    const attendanceRows: Param[][] = []
    const profileRows: Param[][] = []
    const loanRows: Param[][] = []
    const feeRows: Param[][] = []

    for (const student of seeded) {
      for (const course of COURSES) {
        const rate = Math.min(99, Math.max(38, student.baseAttendance + course.offset))
        const attended = Math.round((course.held * rate) / 100)
        enrollmentRows.push([student.id, course.code, course.title, 4])
        attendanceRows.push([student.id, course.code, course.held, attended])
      }
      profileRows.push([
        student.id,
        student.cgpa,
        student.backlogs,
        student.internalMarks,
        25,
        student.assignmentRate,
        student.libraryVisits,
        JSON.stringify(student.sgpa.map((value, index) => ({ term: `Sem ${index + 1}`, value }))),
      ])

      if (student.libraryVisits > 0) {
        loanRows.push([
          uuidV5(`loan:${student.id}:1`),
          student.id,
          'Clean code',
          minutesAgo(60 * 24 * 30),
          new Date(Date.now() + 1000 * 60 * 60 * 24 * 2),
        ])
      }
      if (student.libraryVisits > 6) {
        loanRows.push([
          uuidV5(`loan:${student.id}:2`),
          student.id,
          'Designing data intensive applications',
          minutesAgo(60 * 24 * 45),
          new Date(Date.now() + 1000 * 60 * 60 * 24 * 8),
        ])
      }

      feeRows.push([
        uuidV5(`fee:${student.id}:vi`),
        student.id,
        SEMESTER,
        124500,
        '2026-08-04',
        `DSU/2026/${String(8000 + (seeded.indexOf(student) % 1200)).padStart(5, '0')}`,
        'Paid',
      ])
      feeRows.push([
        uuidV5(`fee:${student.id}:v`),
        student.id,
        'Semester V',
        118900,
        '2026-01-06',
        `DSU/2026/${String(1100 + (seeded.indexOf(student) % 1200)).padStart(5, '0')}`,
        'Paid',
      ])
    }

    await insertMany(client, 'course_enrollments', ['student_id', 'course_code', 'course_title', 'credits'], enrollmentRows)
    await insertMany(client, 'course_attendance_summary', ['student_id', 'course_code', 'held', 'attended'], attendanceRows)
    await insertMany(
      client,
      'student_academic_profiles',
      [
        'student_id',
        'cgpa',
        'backlogs',
        'internal_marks',
        'internal_max',
        'assignment_rate',
        'library_visits',
        'sgpa',
      ],
      profileRows,
    )
    await insertMany(client, 'library_loans', ['id', 'student_id', 'title', 'issued_at', 'due_at'], loanRows)
    await insertMany(
      client,
      'fee_receipts',
      ['id', 'student_id', 'term', 'amount', 'paid_on', 'receipt_no', 'status'],
      feeRows,
    )

    const examRows: Param[][] = [
      [uuidV5('exam:CS601'), 'CS601', 'Software engineering', new Date('2026-12-02T09:30:00Z'), 120, 'Block C 203'],
      [uuidV5('exam:CS602'), 'CS602', 'Machine learning', new Date('2026-12-05T09:30:00Z'), 120, 'Block C 204'],
      [uuidV5('exam:CS603'), 'CS603', 'Cloud computing', new Date('2026-12-08T14:00:00Z'), 120, 'Block B 101'],
      [uuidV5('exam:CS604'), 'CS604', 'Minor project review', new Date('2026-12-12T10:00:00Z'), 120, 'Project lab 2'],
    ]
    await insertMany(
      client,
      'exam_schedule',
      ['id', 'course_code', 'title', 'starts_at', 'duration_minutes', 'hall'],
      examRows,
    )

    // ----------------------------------------------------------------- risk
    const predictionRows: Param[][] = []
    const snapshotRows: Param[][] = []
    const generatedAt = new Date(seed.generated_at)

    for (const student of seeded) {
      predictionRows.push([
        uuidV5(`risk:${student.id}:${student.risk.course_code}:${seed.model_version}`),
        student.id,
        student.risk.course_code,
        seed.model_version,
        seed.cutoff_day,
        Number(student.risk.probability.toFixed(6)),
        student.risk.tier,
        JSON.stringify(student.risk.drivers),
        generatedAt,
      ])
      snapshotRows.push([
        uuidV5(`snap:${student.id}:${student.risk.course_code}:${seed.model_version}`),
        student.id,
        student.risk.course_code,
        seed.model_version,
        seed.cutoff_day,
        JSON.stringify({
          ...student.risk.features,
          source_module: student.risk.source_module,
          source_presentation: student.risk.source_presentation,
          source_student_ref: String(student.risk.oulad_student_id),
        }),
        generatedAt,
      ])
    }

    await insertMany(
      client,
      'risk.predictions',
      [
        'id',
        'student_id',
        'course_code',
        'model_version',
        'cutoff_day',
        'probability',
        'tier',
        'drivers',
        'generated_at',
      ],
      predictionRows,
    )
    await insertMany(
      client,
      'risk.feature_snapshots',
      [
        'id',
        'student_id',
        'course_code',
        'model_version',
        'cutoff_day',
        'features',
        'captured_at',
      ],
      snapshotRows,
    )

    // ------------------------------------------------------------- sessions
    const now = new Date()
    const sessionRows: Param[][] = [
      [uuidV5('session:today:CS601'), 'CS601', 'Software engineering', 'Block C 203', new Date(now.getTime() - 55 * 60 * 1000), new Date(now.getTime() + 20 * 60 * 1000), 'open', seeded.length, facultyId],
      [uuidV5('session:today:CS602'), 'CS602', 'Machine learning', 'Block C 204', new Date(now.getTime() + 60 * 60 * 1000), new Date(now.getTime() + 2 * 60 * 60 * 1000), 'upcoming', seeded.length, facultyId],
      [uuidV5('session:today:CS603'), 'CS603', 'Cloud computing', 'Block B 101', new Date(now.getTime() - 4 * 60 * 60 * 1000), new Date(now.getTime() - 3 * 60 * 60 * 1000), 'closed', seeded.length, faculty2Id],
      [uuidV5('session:yesterday:CS601'), 'CS601', 'Software engineering', 'Block C 203', new Date(now.getTime() - 26 * 60 * 60 * 1000), new Date(now.getTime() - 25 * 60 * 60 * 1000), 'closed', seeded.length, facultyId],
    ]
    await insertMany(
      client,
      'attendance_sessions',
      ['id', 'course_code', 'title', 'room', 'starts_at', 'ends_at', 'state', 'total_expected', 'created_by'],
      sessionRows,
    )

    const openSessionId = uuidV5('session:today:CS601')
    const tapRows: Param[][] = []
    seeded.slice(0, 120).forEach((student, index) => {
      tapRows.push([
        uuidV5(`tap:${openSessionId}:${student.id}`),
        openSessionId,
        student.id,
        student.cardId,
        index % 3 === 0 ? 'qr' : 'nfc',
        'accepted',
        540 + Math.round(random() * 700),
        'CSE 03',
        minutesAgo(index * 2),
      ])
    })
    await insertMany(
      client,
      'attendance_records',
      ['id', 'session_id', 'student_id', 'card_id', 'method', 'status', 'latency_ms', 'reader_id', 'verified_at'],
      tapRows,
    )

    // --------------------------------------------------------- verifications
    const verificationRows: Param[][] = []
    for (let index = 0; index < 260; index += 1) {
      const student = seeded[Math.floor(random() * seeded.length)] as SeededStudent
      const reader = READERS[Math.floor(random() * READERS.length)] as (typeof READERS)[number]
      const accepted = random() > 0.04
      verificationRows.push([
        uuidV5(`verification:${index}`),
        `nonce-${index}-${student.usn}`,
        reader.name,
        random() > 0.5 ? 'qr' : 'nfc',
        accepted ? 'accepted' : 'rejected',
        accepted ? null : random() > 0.5 ? 'card_revoked' : 'invalid_or_expired_pass',
        520 + Math.round(random() * 700),
        student.id,
        student.cardId,
        minutesAgo(index * 3),
      ])
    }
    await insertMany(
      client,
      'verification_events',
      [
        'id',
        'token_nonce',
        'reader_id',
        'method',
        'result',
        'reason',
        'latency_ms',
        'student_id',
        'card_id',
        'verified_at',
      ],
      verificationRows,
    )

    // ---------------------------------------------------------- card updates
    const updateSeeds = [
      { usn: '1DS23CS0038', change: 'Validity extended to Jun 2027', type: 'validity', state: 'queued' },
      { usn: '1DS23CS0048', change: 'Programme name corrected', type: 'validity', state: 'confirmed' },
      { usn: '1DS23CS0009', change: 'Photo refreshed', type: 'reissue', state: 'confirmed' },
      { usn: '1DS23CS0063', change: 'Battery warning sent to the card office', type: 'status', state: 'queued' },
      { usn: '1DS23CS0084', change: 'Replacement card provisioned', type: 'reissue', state: 'queued' },
      { usn: '1DS23CS0056', change: 'Replacement card provisioned', type: 'reissue', state: 'queued' },
    ]
    const byUsn = new Map(seeded.map((student) => [student.usn, student]))
    await insertMany(
      client,
      'card_updates',
      ['id', 'card_id', 'student_id', 'change_type', 'summary', 'payload', 'state', 'idempotency_key', 'actor_id', 'created_at', 'confirmed_at'],
      updateSeeds.map((update, index) => {
        const student = byUsn.get(update.usn) as SeededStudent
        return [
          uuidV5(`card-update:${index}`),
          student.cardId,
          student.id,
          update.type,
          update.change,
          JSON.stringify({ note: update.change }),
          update.state,
          `seed-update-${index}`,
          adminId,
          minutesAgo(index * 23),
          update.state === 'confirmed' ? minutesAgo(index * 23 - 4) : null,
        ]
      }),
    )

    // --------------------------------------------------------- interventions
    const interventionRows: Param[][] = []
    let interventionIndex = 0
    for (const student of seeded) {
      for (const intervention of student.interventions) {
        interventionRows.push([
          uuidV5(`intervention:${student.id}:${interventionIndex++}`),
          student.id,
          student.mentorId,
          intervention.note,
          intervention.by === ADMIN_NAME ? 'counsellor' : 'mentor',
          minutesAgo(intervention.daysAgo * 24 * 60),
        ])
      }
    }
    for (const student of seeded.filter((candidate) => candidate.tier === 'support').slice(0, 60)) {
      interventionRows.push([
        uuidV5(`intervention:${student.id}:${interventionIndex++}`),
        student.id,
        student.mentorId,
        'Flagged by the model. First review of assessment submissions and VLE activity.',
        'model-flag',
        minutesAgo(Math.round(random() * 20 * 24 * 60)),
      ])
    }
    await insertMany(
      client,
      'interventions',
      ['id', 'student_id', 'author_id', 'note', 'source', 'created_at'],
      interventionRows,
    )

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    await client.end()
    throw error
  }

  const counts = await client.query<{ students: number; predictions: number }>(
    `SELECT (SELECT COUNT(*)::int FROM app_users WHERE role = 'student') AS students,
            (SELECT COUNT(*)::int FROM risk.predictions) AS predictions`,
  )
  await client.end()

  console.log(
    `[seed] done: ${counts.rows[0]?.students ?? 0} students, ${counts.rows[0]?.predictions ?? 0} risk predictions`,
  )
}

main().catch((error) => {
  console.error('[seed] failed', error)
  process.exit(1)
})
