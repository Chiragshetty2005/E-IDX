import { Link } from 'react-router-dom'
import { PageHeader, SectionHead } from '../../components/PageHeader'
import { Pill } from '../../components/Status'
import { buttonStyles } from '../../components/Button'
import { demoStudent, exams, feeReceipts, loans } from '../../data/mock'

export function StudentServices() {
  const student = demoStudent
  const attended = student.courses.reduce((sum, course) => sum + course.attended, 0)
  const held = student.courses.reduce((sum, course) => sum + course.held, 0)

  return (
    <div>
      <PageHeader
        title="Campus services"
        description="Attendance, library, exams and fees from the central campus platform."
        meta={
          <>
            <span className="caption-4 text-ink-500">Last sync, 8 minutes ago</span>
            <span className="font-mono caption-4 text-ink-500">{student.usn}</span>
          </>
        }
      >
        <Link to="/student" className={buttonStyles('secondary', 'sm')}>
          Back to my card
        </Link>
      </PageHeader>

      <section className="mt-8">
        <SectionHead
          title="Attendance"
          description="Written when your card is tapped during an open session."
          action={<Pill label="No shortage" tone="verified" />}
        />
        <div className="mt-4 grid grid-cols-2 gap-4 border-y border-paper-200 py-4 sm:divide-x sm:divide-paper-200">
          <div className="sm:pr-6">
            <p className="caption-5 text-ink-500">Overall</p>
            <p className="mt-1 font-mono heading-4 tabular-nums">
              {student.attendance.toFixed(1)}%
            </p>
            <p className="mt-1 font-mono caption-5 text-ink-500 tabular-nums">
              {attended} of {held} sessions
            </p>
          </div>
          <div className="sm:pl-6">
            <p className="caption-5 text-ink-500">Requirement</p>
            <p className="mt-1 font-mono heading-4 tabular-nums">75.0%</p>
            <p className="mt-1 caption-5 text-ink-500">Minimum for the term</p>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Attendance by course, with sessions attended.</caption>
            <thead>
              <tr className="border-b border-paper-200">
                <th className="py-2 pr-4 caption-3 text-ink-500" scope="col">
                  Course
                </th>
                <th className="px-4 py-2 caption-3 text-ink-500" scope="col">
                  Attended
                </th>
                <th className="hidden px-4 py-2 caption-3 text-ink-500 sm:table-cell" scope="col">
                  Held
                </th>
                <th className="py-2 pl-4 text-right caption-3 text-ink-500" scope="col">
                  Rate
                </th>
              </tr>
            </thead>
            <tbody>
              {student.courses.map((course) => {
                const rate = (course.attended / course.held) * 100
                return (
                  <tr key={course.code} className="border-b border-paper-200 last:border-b-0">
                    <th scope="row" className="py-3 pr-4 text-left">
                      <p className="body-5">{course.title}</p>
                      <p className="mt-0.5 font-mono caption-5 text-ink-500">{course.code}</p>
                    </th>
                    <td className="px-4 py-3 font-mono caption-4">{course.attended}</td>
                    <td className="hidden px-4 py-3 font-mono caption-4 sm:table-cell">
                      {course.held}
                    </td>
                    <td className="py-3 pl-4 text-right font-mono caption-4">
                      {rate.toFixed(1)}%
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-10 grid gap-8 lg:grid-cols-12">
        <section className="min-w-0 lg:col-span-5">
          <SectionHead
            title="Library"
            description="Two books on loan and no pending dues."
            action={<Pill label="Clear" tone="verified" />}
          />
          <ul className="mt-2">
            {loans.map((loan) => (
              <li
                key={loan.title}
                className="flex items-start justify-between gap-3 border-b border-paper-200 py-3 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="body-5">{loan.title}</p>
                  <p className="mt-0.5 caption-5 text-ink-500">Due {loan.due}</p>
                </div>
                <Pill label={loan.status} tone="neutral" />
              </li>
            ))}
          </ul>
          <p className="mt-4 caption-5 text-ink-500">
            Renewals can be made at the library desk. Fines are written to this account after the
            due date.
          </p>
        </section>

        <section className="min-w-0 lg:col-span-7">
          <SectionHead
            title="Examinations"
            description="Hall and time for the December assessments."
          />
          <ul className="mt-2 sm:hidden">
            {exams.map((exam) => (
              <li key={exam.code} className="border-b border-paper-200 py-3 last:border-b-0">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="min-w-0">
                    <p className="body-5">{exam.title}</p>
                    <p className="mt-0.5 font-mono caption-5 text-ink-500">{exam.code}</p>
                  </div>
                  <p className="shrink-0 font-mono caption-4">
                    {exam.date.replace(' 2026', '')}
                  </p>
                </div>
                <p className="mt-1 caption-5 text-ink-500">
                  {exam.time}, {exam.hall}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-4 hidden overflow-x-auto sm:block">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Examination schedule for semester six.</caption>
              <thead>
                <tr className="border-b border-paper-200">
                  <th className="py-2 pr-4 caption-3 text-ink-500" scope="col">
                    Course
                  </th>
                  <th className="px-4 py-2 caption-3 text-ink-500" scope="col">
                    Date
                  </th>
                  <th className="px-4 py-2 caption-3 text-ink-500" scope="col">
                    Time
                  </th>
                  <th className="py-2 pl-4 text-right caption-3 text-ink-500" scope="col">
                    Hall
                  </th>
                </tr>
              </thead>
              <tbody>
                {exams.map((exam) => (
                  <tr key={exam.code} className="border-b border-paper-200 last:border-b-0">
                    <th scope="row" className="py-3 pr-4 text-left">
                      <p className="body-5">{exam.title}</p>
                      <p className="mt-0.5 font-mono caption-5 text-ink-500">{exam.code}</p>
                    </th>
                    <td className="px-4 py-3 font-mono caption-4">{exam.date}</td>
                    <td className="px-4 py-3 font-mono caption-4">{exam.time}</td>
                    <td className="py-3 pl-4 text-right caption-4 text-ink-700">{exam.hall}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 caption-5 text-ink-500">
            Carry your card to every exam. The reader checks identity and logs attendance before
            entry.
          </p>
        </section>
      </div>

      <section className="mt-10">
        <SectionHead
          title="Fees"
          description="Payments recorded against your student account."
          action={<Pill label="Paid" tone="verified" />}
        />
        <ul className="mt-2 sm:hidden">
          {feeReceipts.map((receipt) => (
            <li key={receipt.receipt} className="border-b border-paper-200 py-3 last:border-b-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="body-5">{receipt.term}</p>
                  <p className="mt-0.5 font-mono caption-5 text-ink-500">{receipt.receipt}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono caption-3">{receipt.amount}</p>
                  <p className="mt-0.5 caption-5 text-ink-500">{receipt.paidOn}</p>
                </div>
              </div>
              <div className="mt-2">
                <Pill
                  label={receipt.status}
                  tone={receipt.status === 'Paid' ? 'verified' : 'neutral'}
                />
              </div>
            </li>
          ))}
        </ul>
        <div className="mt-4 hidden overflow-x-auto sm:block">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">Fee receipts and current status.</caption>
            <thead>
              <tr className="border-b border-paper-200">
                <th className="py-2 pr-4 caption-3 text-ink-500" scope="col">
                  Term
                </th>
                <th className="px-4 py-2 caption-3 text-ink-500" scope="col">
                  Paid on
                </th>
                <th className="px-4 py-2 caption-3 text-ink-500" scope="col">
                  Amount
                </th>
                <th className="px-4 py-2 caption-3 text-ink-500" scope="col">
                  Receipt
                </th>
                <th className="py-2 pl-4 text-right caption-3 text-ink-500" scope="col">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {feeReceipts.map((receipt) => (
                <tr key={receipt.receipt} className="border-b border-paper-200 last:border-b-0">
                  <th scope="row" className="py-3 pr-4 text-left body-5">
                    {receipt.term}
                  </th>
                  <td className="px-4 py-3 font-mono caption-4">{receipt.paidOn}</td>
                  <td className="px-4 py-3 font-mono caption-4">{receipt.amount}</td>
                  <td className="px-4 py-3 font-mono caption-5 text-ink-500">{receipt.receipt}</td>
                  <td className="py-3 pl-4 text-right">
                    <Pill
                      label={receipt.status}
                      tone={receipt.status === 'Paid' ? 'verified' : 'neutral'}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 caption-5 text-ink-500">
          No dues for the current term. The library deposit is refundable when you leave the
          university.
        </p>
      </section>
    </div>
  )
}
