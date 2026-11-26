import type {
  CardUpdate,
  CourseAttendance,
  Session,
  ShapFeature,
  Student,
  Verification,
} from '../types'

const heldPerCourse = [44, 42, 37, 22]
const courseOffsets = [2.2, -1.6, 0.9, 2.8]
const courseMeta = [
  { code: 'CS601', title: 'Software engineering' },
  { code: 'CS602', title: 'Machine learning' },
  { code: 'CS603', title: 'Cloud computing' },
  { code: 'CS604', title: 'Minor project' },
]

function buildCourses(base: number): CourseAttendance[] {
  return courseMeta.map((course, index) => {
    const held = heldPerCourse[index]
    const rate = Math.min(99, Math.max(38, base + courseOffsets[index]))
    return {
      ...course,
      held,
      attended: Math.round((held * rate) / 100),
    }
  })
}

function overallAttendance(courses: CourseAttendance[]) {
  const attended = courses.reduce((sum, course) => sum + course.attended, 0)
  const held = courses.reduce((sum, course) => sum + course.held, 0)
  return Number(((attended / held) * 100).toFixed(1))
}

function initials(name: string) {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
}

function sgpa(values: number[]) {
  return values.map((value, index) => ({ term: `Sem ${index + 1}`, value }))
}

interface StudentSeed {
  usn: string
  name: string
  baseAttendance: number
  cgpa: number
  backlogs: number
  internalMarks: number
  assignmentRate: number
  libraryVisits: number
  risk: Student['risk']
  probability: number
  driver: string
  cardStatus: Student['card']['status']
  battery: number
  lastSync: string
  cardValidity?: string
  sgpaValues: number[]
  interventions?: Student['interventions']
}

const mentor = 'Dr. Shahin Fatima'
const defaultValidity = 'Jun 2027'

function makeStudent(seed: StudentSeed): Student {
  const courses = buildCourses(seed.baseAttendance)
  return {
    usn: seed.usn,
    name: seed.name,
    initials: initials(seed.name),
    programme: 'B.E. Computer science and engineering',
    semester: 'Semester VI',
    section: 'Section A',
    attendance: overallAttendance(courses),
    cgpa: seed.cgpa,
    backlogs: seed.backlogs,
    internalMarks: seed.internalMarks,
    internalMax: 25,
    assignmentRate: seed.assignmentRate,
    libraryVisits: seed.libraryVisits,
    risk: seed.risk,
    probability: seed.probability,
    driver: seed.driver,
    mentor,
    card: {
      id: `EIDX ${seed.usn.slice(-4)}`,
      status: seed.cardStatus,
      battery: seed.battery,
      lastSync: seed.lastSync,
      validTo: seed.cardValidity ?? defaultValidity,
      firmware: '1.4.2',
    },
    courses,
    sgpa: sgpa(seed.sgpaValues),
    interventions: seed.interventions ?? [],
  }
}

export const students: Student[] = [
  makeStudent({
    usn: '1DS23CS0084',
    name: 'Arjun Kamath',
    baseAttendance: 58,
    cgpa: 5.31,
    backlogs: 3,
    internalMarks: 11,
    assignmentRate: 48,
    libraryVisits: 1,
    risk: 'support',
    probability: 0.88,
    driver: 'Attendance is 57 percent and three backlogs are open this term.',
    cardStatus: 'revoked',
    battery: 71,
    lastSync: '2 days ago',
    sgpaValues: [6.12, 5.94, 5.81, 5.46, 5.38, 5.31],
    interventions: [
      {
        date: '14 Nov 2026',
        note: 'Card revoked after a loss report. Replacement queued at the card office.',
        by: 'Kavya Srinivas',
      },
    ],
  }),
  makeStudent({
    usn: '1DS23CS0056',
    name: 'Karthik Nayak',
    baseAttendance: 62,
    cgpa: 5.72,
    backlogs: 1,
    internalMarks: 13,
    assignmentRate: 58,
    libraryVisits: 2,
    risk: 'support',
    probability: 0.84,
    driver: 'Attendance has been under 65 percent for four weeks running.',
    cardStatus: 'revoked',
    battery: 55,
    lastSync: '1 day ago',
    sgpaValues: [6.48, 6.22, 6.04, 5.91, 5.83, 5.72],
  }),
  makeStudent({
    usn: '1DS23CS0017',
    name: 'Ananya Hegde',
    baseAttendance: 68,
    cgpa: 6.18,
    backlogs: 2,
    internalMarks: 14,
    assignmentRate: 61,
    libraryVisits: 3,
    risk: 'support',
    probability: 0.81,
    driver: 'Attendance has fallen below 70 percent and two backlogs are open.',
    cardStatus: 'active',
    battery: 62,
    lastSync: '8 min ago',
    sgpaValues: [7.42, 7.08, 6.84, 6.52, 6.34, 6.18],
    interventions: [
      {
        date: '12 Nov 2026',
        note: 'Spoke after the ML lab. She is managing a family issue and asked for notes from the two missed weeks.',
        by: mentor,
      },
      {
        date: '05 Nov 2026',
        note: 'Shared a semester plan and booked a check in for 19 November.',
        by: mentor,
      },
      {
        date: '22 Oct 2026',
        note: 'Flagged by the model. First review of attendance and internal marks.',
        by: mentor,
      },
    ],
  }),
  makeStudent({
    usn: '1DS23CS0031',
    name: 'Rohan Prabhu',
    baseAttendance: 75,
    cgpa: 6.94,
    backlogs: 1,
    internalMarks: 16,
    assignmentRate: 54,
    libraryVisits: 4,
    risk: 'support',
    probability: 0.74,
    driver: 'Assignment submission is 54 percent and internal marks sit below the section median.',
    cardStatus: 'active',
    battery: 48,
    lastSync: '2 min ago',
    sgpaValues: [8.01, 7.64, 7.41, 7.18, 7.02, 6.94],
    interventions: [
      {
        date: '18 Nov 2026',
        note: 'Email sent about two missing assignments. No reply yet.',
        by: mentor,
      },
    ],
  }),
  makeStudent({
    usn: '1DS23CS0063',
    name: 'Aditya Bhat',
    baseAttendance: 78,
    cgpa: 7.21,
    backlogs: 0,
    internalMarks: 18,
    assignmentRate: 69,
    libraryVisits: 5,
    risk: 'watch',
    probability: 0.52,
    driver: 'Internal marks dropped six points since the last assessment.',
    cardStatus: 'low-battery',
    battery: 14,
    lastSync: '34 min ago',
    sgpaValues: [7.86, 7.62, 7.48, 7.39, 7.28, 7.21],
  }),
  makeStudent({
    usn: '1DS23CS0071',
    name: 'Vikram Shetty',
    baseAttendance: 84,
    cgpa: 7.66,
    backlogs: 0,
    internalMarks: 19,
    assignmentRate: 76,
    libraryVisits: 6,
    risk: 'watch',
    probability: 0.41,
    driver: 'Assignment submission is slipping in two courses.',
    cardStatus: 'active',
    battery: 91,
    lastSync: '12 min ago',
    sgpaValues: [8.24, 8.06, 7.92, 7.81, 7.72, 7.66],
  }),
  makeStudent({
    usn: '1DS23CS0038',
    name: 'Nandini Rao',
    baseAttendance: 87,
    cgpa: 8.15,
    backlogs: 0,
    internalMarks: 21,
    assignmentRate: 88,
    libraryVisits: 8,
    risk: 'on-track',
    probability: 0.22,
    driver: 'Attendance and marks are holding steady.',
    cardStatus: 'sync',
    battery: 88,
    lastSync: '2 hours ago',
    sgpaValues: [8.44, 8.32, 8.21, 8.24, 8.18, 8.15],
  }),
  makeStudent({
    usn: '1DS23CS0009',
    name: 'Meera Iyer',
    baseAttendance: 88,
    cgpa: 8.04,
    backlogs: 0,
    internalMarks: 20,
    assignmentRate: 84,
    libraryVisits: 7,
    risk: 'on-track',
    probability: 0.19,
    driver: 'No change in the last three weeks.',
    cardStatus: 'active',
    battery: 73,
    lastSync: '6 min ago',
    sgpaValues: [8.31, 8.18, 8.09, 8.11, 8.07, 8.04],
  }),
  makeStudent({
    usn: '1DS23CS0012',
    name: 'Priya Menon',
    baseAttendance: 91,
    cgpa: 8.78,
    backlogs: 0,
    internalMarks: 22,
    assignmentRate: 91,
    libraryVisits: 11,
    risk: 'on-track',
    probability: 0.09,
    driver: 'Attendance is above 90 percent across all four courses.',
    cardStatus: 'active',
    battery: 84,
    lastSync: '4 min ago',
    sgpaValues: [8.92, 8.86, 8.81, 8.84, 8.8, 8.78],
  }),
  makeStudent({
    usn: '1DS23CS0024',
    name: 'Sneha Reddy',
    baseAttendance: 96,
    cgpa: 9.12,
    backlogs: 0,
    internalMarks: 24,
    assignmentRate: 96,
    libraryVisits: 14,
    risk: 'on-track',
    probability: 0.04,
    driver: 'No concerns this term.',
    cardStatus: 'active',
    battery: 96,
    lastSync: '9 min ago',
    sgpaValues: [9.21, 9.18, 9.14, 9.16, 9.13, 9.12],
  }),
  makeStudent({
    usn: '1DS23CS0029',
    name: 'Divya Prasad',
    baseAttendance: 91,
    cgpa: 8.44,
    backlogs: 0,
    internalMarks: 21,
    assignmentRate: 89,
    libraryVisits: 9,
    risk: 'on-track',
    probability: 0.12,
    driver: 'Attendance is steady and no assignments are overdue.',
    cardStatus: 'active',
    battery: 67,
    lastSync: '15 min ago',
    sgpaValues: [8.68, 8.59, 8.52, 8.48, 8.46, 8.44],
  }),
  makeStudent({
    usn: '1DS23CS0048',
    name: 'Chirag P Shetty',
    baseAttendance: 92,
    cgpa: 8.62,
    backlogs: 0,
    internalMarks: 23,
    assignmentRate: 94,
    libraryVisits: 10,
    risk: 'on-track',
    probability: 0.07,
    driver: 'Attendance and internal marks are above the section median.',
    cardStatus: 'active',
    battery: 78,
    lastSync: '8 min ago',
    sgpaValues: [8.41, 8.55, 8.32, 8.74, 8.66, 8.62],
  }),
]

export const demoStudentUsn = '1DS23CS0048'

export const studentByUsn = new Map(students.map((student) => [student.usn, student]))

export const demoStudent = studentByUsn.get(demoStudentUsn) as Student

export const recentCardUpdates: CardUpdate[] = [
  {
    id: 'CU-118',
    usn: '1DS23CS0038',
    change: 'Validity extended to Jun 2027',
    time: '09:21',
    state: 'queued',
  },
  {
    id: 'CU-117',
    usn: '1DS23CS0048',
    change: 'Programme name corrected',
    time: '08:58',
    state: 'confirmed',
  },
  {
    id: 'CU-116',
    usn: '1DS23CS0009',
    change: 'Photo refreshed',
    time: '08:34',
    state: 'confirmed',
  },
]

export const watchlist = [...students]
  .filter((student) => student.risk !== 'on-track')
  .sort((a, b) => b.probability - a.probability)

export const recentVerifications: Verification[] = [
  {
    id: 'V-78214',
    time: '09:41:22',
    usn: '1DS23CS0048',
    method: 'nfc',
    location: 'Main gate',
    reader: 'GATE 01',
    result: 'accepted',
    latency: 0.64,
  },
  {
    id: 'V-78213',
    time: '09:40:58',
    usn: '1DS23CS0017',
    method: 'qr',
    location: 'Library desk',
    reader: 'LIB 02',
    result: 'accepted',
    latency: 0.71,
  },
  {
    id: 'V-78212',
    time: '09:39:41',
    usn: '1DS23CS0031',
    method: 'qr',
    location: 'Block C lab',
    reader: 'CSE 03',
    result: 'accepted',
    latency: 0.83,
  },
  {
    id: 'V-78211',
    time: '09:38:12',
    usn: '1DS23CS0012',
    method: 'nfc',
    location: 'Main gate',
    reader: 'GATE 01',
    result: 'accepted',
    latency: 0.58,
  },
  {
    id: 'V-78210',
    time: '09:36:47',
    usn: '1DS23CS0056',
    method: 'qr',
    location: 'Exam hall',
    reader: 'EXAM 01',
    result: 'rejected',
    latency: 0.69,
  },
  {
    id: 'V-78209',
    time: '09:35:09',
    usn: '1DS23CS0009',
    method: 'nfc',
    location: 'Library desk',
    reader: 'LIB 02',
    result: 'accepted',
    latency: 0.66,
  },
  {
    id: 'V-78208',
    time: '09:33:55',
    usn: '1DS23CS0024',
    method: 'qr',
    location: 'Main gate',
    reader: 'GATE 02',
    result: 'accepted',
    latency: 1.12,
  },
  {
    id: 'V-78207',
    time: '09:32:18',
    usn: '1DS23CS0063',
    method: 'nfc',
    location: 'Block C lab',
    reader: 'CSE 03',
    result: 'accepted',
    latency: 0.74,
  },
  {
    id: 'V-78206',
    time: '09:30:44',
    usn: '1DS23CS0029',
    method: 'qr',
    location: 'Hostel gate',
    reader: 'GATE 03',
    result: 'accepted',
    latency: 0.62,
  },
  {
    id: 'V-78205',
    time: '09:29:03',
    usn: '1DS23CS0084',
    method: 'nfc',
    location: 'Main gate',
    reader: 'GATE 02',
    result: 'rejected',
    latency: 0.81,
  },
]

export const sessions: Session[] = [
  {
    id: 'S-441',
    code: 'CS601',
    title: 'Software engineering',
    room: 'Block B 104',
    start: '09:00',
    end: '09:50',
    present: 54,
    total: 62,
    status: 'closed',
  },
  {
    id: 'S-442',
    code: 'CS602',
    title: 'Machine learning',
    room: 'Block C 204',
    start: '10:00',
    end: '10:50',
    present: 41,
    total: 62,
    status: 'open',
  },
  {
    id: 'S-443',
    code: 'CS603',
    title: 'Cloud computing',
    room: 'Block C 201',
    start: '11:30',
    end: '12:20',
    present: 0,
    total: 62,
    status: 'upcoming',
  },
  {
    id: 'S-444',
    code: 'CS604',
    title: 'Minor project',
    room: 'Project lab 2',
    start: '14:00',
    end: '15:30',
    present: 0,
    total: 62,
    status: 'upcoming',
  },
]

export const liveTaps = [
  { name: 'Sneha Reddy', usn: '1DS23CS0024', time: '10:32:14' },
  { name: 'Chirag P Shetty', usn: '1DS23CS0048', time: '10:31:48' },
  { name: 'Priya Menon', usn: '1DS23CS0012', time: '10:31:02' },
  { name: 'Meera Iyer', usn: '1DS23CS0009', time: '10:30:37' },
  { name: 'Divya Prasad', usn: '1DS23CS0029', time: '10:29:56' },
  { name: 'Vikram Shetty', usn: '1DS23CS0071', time: '10:29:21' },
  { name: 'Nandini Rao', usn: '1DS23CS0038', time: '10:28:44' },
  { name: 'Aditya Bhat', usn: '1DS23CS0063', time: '10:28:09' },
]

export const campusStats = {
  students: 4786,
  activeCards: 4786,
  awaitingSync: 37,
  verificationsToday: 6284,
  needsSupport: 143,
  successRate: 99.4,
  medianLatency: 0.72,
  rejected: 38,
}

export const campusRisk = {
  support: 143,
  watch: 802,
  onTrack: 3841,
  total: 4786,
}

export const cohortRisk = {
  support: 11,
  watch: 17,
  onTrack: 34,
  total: 62,
}

export const attendanceTrend = [
  { label: 'Week 1', value: 87.4 },
  { label: 'Week 2', value: 86.1 },
  { label: 'Week 3', value: 84.9 },
  { label: 'Week 4', value: 85.6 },
  { label: 'Week 5', value: 82.3 },
  { label: 'Week 6', value: 80.7 },
  { label: 'Week 7', value: 81.9 },
  { label: 'Week 8', value: 80.4 },
]

export const modelInfo = {
  name: 'CatBoost',
  build: '2026.11.18',
  trained: '18 Nov 2026',
  records: 2914,
  features: 14,
  accuracy: 0.9,
  macroF1: 0.87,
  atRiskRecall: 0.88,
  rocAuc: 0.95,
}

export const globalFeatures = [
  { label: 'Attendance', value: 0.28 },
  { label: 'Internal marks', value: 0.22 },
  { label: 'Previous GPA', value: 0.17 },
  { label: 'Assignment rate', value: 0.12 },
  { label: 'Open backlogs', value: 0.09 },
  { label: 'Library visits', value: 0.05 },
  { label: 'Study hours', value: 0.04 },
  { label: 'Other features', value: 0.03 },
]

export function shapFor(student: Student): ShapFeature[] {
  if (student.usn === '1DS23CS0017') {
    return [
      { label: `Attendance at ${student.attendance.toFixed(1)} percent`, value: -0.24 },
      { label: 'Two open backlogs', value: -0.16 },
      { label: 'Internal marks at 14 of 25', value: -0.11 },
      { label: 'Assignment rate at 61 percent', value: -0.07 },
      { label: `Previous GPA at ${student.sgpa[4].value.toFixed(2)}`, value: -0.05 },
      { label: 'Nine study hours per week', value: 0.03 },
      { label: 'Three library visits', value: 0.02 },
    ]
  }

  const riskFactor = student.risk === 'support' ? 1 : student.risk === 'watch' ? 0.55 : 0.2
  return [
    { label: `Attendance at ${student.attendance.toFixed(1)} percent`, value: Number((-0.26 * riskFactor).toFixed(2)) },
    { label: `${student.backlogs} open backlogs`, value: Number((-0.15 * riskFactor).toFixed(2)) },
    { label: `Internal marks at ${student.internalMarks} of 25`, value: Number((-0.1 * riskFactor).toFixed(2)) },
    { label: `Assignment rate at ${student.assignmentRate} percent`, value: Number((-0.07 * riskFactor).toFixed(2)) },
    { label: `Previous GPA at ${(student.cgpa - 0.12).toFixed(2)}`, value: Number((-0.05 * riskFactor).toFixed(2)) },
    { label: `${student.libraryVisits} library visits`, value: Number((0.03 * (1 - riskFactor)).toFixed(2)) },
    { label: 'Study hours reported this week', value: Number((0.02 * (1 - riskFactor)).toFixed(2)) },
  ]
}

export const exams = [
  { code: 'CS601', title: 'Software engineering', date: '02 Dec 2026', time: '09:30', hall: 'Block C 203' },
  { code: 'CS602', title: 'Machine learning', date: '05 Dec 2026', time: '09:30', hall: 'Block C 204' },
  { code: 'CS603', title: 'Cloud computing', date: '08 Dec 2026', time: '14:00', hall: 'Block B 101' },
  { code: 'CS604', title: 'Minor project review', date: '12 Dec 2026', time: '10:00', hall: 'Project lab 2' },
]

export const loans = [
  { title: 'Clean code', due: '28 Nov 2026', status: 'On loan' },
  { title: 'Designing data intensive applications', due: '04 Dec 2026', status: 'On loan' },
]

export const feeReceipts = [
  { term: 'Semester VI', amount: '₹1,24,500', paidOn: '04 Aug 2026', receipt: 'DSU/2026/08412', status: 'Paid' },
  { term: 'Semester V', amount: '₹1,18,900', paidOn: '06 Jan 2026', receipt: 'DSU/2026/01294', status: 'Paid' },
  { term: 'Library deposit', amount: '₹2,000', paidOn: '12 Aug 2023', receipt: 'DSU/2023/04418', status: 'Refundable' },
]

export const users = {
  admin: { name: 'Kavya Srinivas', detail: 'Card services', initials: 'KS' },
  faculty: { name: 'Dr. Shahin Fatima', detail: 'Associate professor, CSE', initials: 'SF' },
  student: { name: demoStudent.name, detail: `${demoStudent.usn}, ${demoStudent.semester}`, initials: demoStudent.initials },
}
