import { PageHeader, SectionHead } from '../../components/PageHeader'
import { FeatureBars, RiskBar } from '../../components/Charts'
import { RiskPill } from '../../components/Status'
import { campusRisk, globalFeatures, modelInfo, watchlist } from '../../data/mock'

const metrics = [
  { label: 'Accuracy', value: modelInfo.accuracy },
  { label: 'Macro F1', value: modelInfo.macroF1 },
  { label: 'Support recall', value: modelInfo.atRiskRecall },
  { label: 'ROC AUC', value: modelInfo.rocAuc },
]

export function AdminInsights() {
  return (
    <div>
      <PageHeader
        title="Academic intelligence"
        description="Risk classes and model explanations for the current term."
        meta={
          <>
            <span className="caption-4 text-ink-500">Validation run, 18 November 2026</span>
            <span className="caption-4 text-ink-500">Semester VI</span>
          </>
        }
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <section className="lg:col-span-5">
          <div className="rounded-2xl bg-ink-900 p-6 text-paper-50">
            <p className="caption-4 text-paper-50/60">Model in use</p>
            <p className="mt-1 heading-3">{modelInfo.name}</p>
            <p className="mt-1 font-mono caption-4 text-paper-50/60">
              Build {modelInfo.build}
            </p>

            <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-6">
              {metrics.map((metric) => (
                <div key={metric.label}>
                  <dt className="caption-5 text-paper-50/60">{metric.label}</dt>
                  <dd className="mt-1 font-mono heading-5 tabular-nums">
                    {metric.value.toFixed(2)}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 border-t border-paper-50/20 pt-4">
              <p className="caption-5 text-paper-50/60">
                Trained on {modelInfo.records.toLocaleString('en-IN')} anonymised records with{' '}
                {modelInfo.features} features. Compared with XGBoost, Random Forest and a logistic
                regression baseline.
              </p>
            </div>
          </div>
        </section>

        <section className="lg:col-span-7">
          <SectionHead
            title="Risk across the university"
            description="Three classes from the latest scoring run."
          />
          <div className="mt-4 rounded-2xl bg-paper-100 p-4 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="heading-5">{campusRisk.support} students need support</p>
                <p className="mt-1 caption-2 text-ink-500">
                  Up from 139 at the last weekly run.
                </p>
              </div>
              <p className="font-mono caption-4 text-ink-500">
                {campusRisk.total.toLocaleString('en-IN')} students
              </p>
            </div>
            <div className="mt-6">
              <RiskBar
                support={campusRisk.support}
                watch={campusRisk.watch}
                onTrack={campusRisk.onTrack}
                total={campusRisk.total}
              />
            </div>
            <p className="mt-6 max-w-[680px] caption-5 text-ink-500 text-pretty">
              Socio economic attributes are excluded from the deployed model. Performance is checked
              across subgroups, and a flag is always reviewed by a mentor.
            </p>
          </div>
        </section>
      </div>

      <div className="mt-10 grid gap-8 lg:grid-cols-12">
        <section className="lg:col-span-7">
          <SectionHead
            title="What drives the model"
            description="Relative importance from the latest SHAP run."
          />
          <div className="mt-4">
            <FeatureBars features={globalFeatures} />
          </div>
          <p className="mt-6 max-w-[680px] caption-5 text-ink-500 text-pretty">
            Attendance is captured by the card itself, so the model gets one of its strongest
            predictors without a separate register.
          </p>
        </section>

        <section className="lg:col-span-5">
          <SectionHead
            title="Highest risk this week"
            description="Ranked by the latest probability."
          />
          <ul className="mt-2">
            {watchlist.slice(0, 5).map((student) => (
              <li
                key={student.usn}
                className="border-b border-paper-200 py-3 last:border-b-0"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="body-5">{student.name}</p>
                    <p className="mt-0.5 font-mono caption-5 text-ink-500">{student.usn}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="font-mono caption-4">
                      {student.probability.toFixed(2)}
                    </span>
                    <RiskPill risk={student.risk} />
                  </div>
                </div>
                <p className="mt-1 caption-5 text-ink-500 text-pretty">{student.driver}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  )
}
