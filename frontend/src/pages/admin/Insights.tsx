import { PageHeader, SectionHead } from '../../components/PageHeader'
import { FeatureBars, RiskBar } from '../../components/Charts'
import { RiskPill } from '../../components/Status'
import { DataNotice } from '../../components/DataNotice'
import { useInsights } from '../../data/hooks'

export function AdminInsights() {
  const { data, loading, error } = useInsights()
  const { modelInfo, risk, globalFeatures, watchlist } = data

  const metrics = [
    { label: 'ROC AUC', value: modelInfo.rocAuc },
    { label: 'PR AUC', value: modelInfo.prAuc },
    { label: 'Top-20% recall', value: modelInfo.atRiskRecall },
    { label: 'Temporal ROC AUC', value: modelInfo.temporalRocAuc },
  ]

  return (
    <div>
      <PageHeader
        title="Academic intelligence"
        description="Risk classes and model explanations for the current term."
        meta={
          <>
            <span className="caption-4 text-ink-500">Validation run, {modelInfo.trained}</span>
            <span className="caption-4 text-ink-500">Cutoff day {modelInfo.cutoffDay}</span>
          </>
        }
      />

      <DataNotice loading={loading} error={error} />

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
                Trained on {modelInfo.records.toLocaleString('en-IN')} active module enrolments from{' '}
                {modelInfo.students.toLocaleString('en-IN')} students with {modelInfo.features} features.
                Compared with a logistic regression baseline and checked on a later-presentation
                holdout.
              </p>
            </div>
          </div>
        </section>

        <section className="lg:col-span-7">
          <SectionHead
            title="Risk across the university"
            description="Capacity-based tiers from the latest scoring run."
          />
          <div className="mt-4 rounded-2xl bg-paper-100 p-4 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="heading-5">{risk.support} students need support</p>
                <p className="mt-1 caption-2 text-ink-500">
                  Top 10% flagged; the next 20% are watched.
                </p>
              </div>
              <p className="font-mono caption-4 text-ink-500">
                {risk.total.toLocaleString('en-IN')} students
              </p>
            </div>
            <div className="mt-6">
              <RiskBar
                support={risk.support}
                watch={risk.watch}
                onTrack={risk.onTrack}
                total={risk.total}
              />
            </div>
            <p className="mt-6 max-w-[680px] caption-5 text-ink-500 text-pretty">
              Socio economic attributes are excluded from the deployed model and used only for
              subgroup checks. A flag is always reviewed by a mentor.
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
            The model reads VLE engagement and assessment behaviour. Campus attendance is not a
            model input, and card taps are never used to train it.
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
