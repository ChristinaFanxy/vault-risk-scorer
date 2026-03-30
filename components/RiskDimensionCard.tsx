import Link from 'next/link'
import type { DimensionScore } from '@/lib/scoring/types'

interface Props {
  dimensionScore: DimensionScore
  weightPct: number
  placeholderFields?: string[]
}

function scoreColor(score: number): string {
  if (score <= 20) return 'text-green-800'
  if (score <= 40) return 'text-lime-800'
  if (score <= 60) return 'text-yellow-800'
  if (score <= 80) return 'text-orange-700'
  return 'text-red-700'
}

function StatusBadge({ status }: { status: 'good' | 'ok' | 'caution' | 'bad' }) {
  const cfg = {
    good:    { label: 'Good',    cls: 'bg-green-100 text-green-800 border-green-300' },
    ok:      { label: 'OK',      cls: 'bg-brand-bg text-brand-cream border-brand-border' },
    caution: { label: 'Caution', cls: 'bg-yellow-100 text-yellow-800 border-yellow-300' },
    bad:     { label: 'Risk',    cls: 'bg-red-100 text-red-800 border-red-300' },
  }[status]
  return (
    <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

export function RiskDimensionCard({ dimensionScore, weightPct, placeholderFields = [] }: Props) {
  const { score, indicators } = dimensionScore

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-5">
        <span className={`text-3xl font-bold ${scoreColor(score)}`}>{score}</span>
        <span className="text-brand-light text-sm">
          {weightPct > 0 ? `/100 · ${weightPct}% of composite · lower = safer` : 'Reference only — not included in score'}
        </span>
      </div>

      {placeholderFields.length > 0 && (
        <p className="text-yellow-800 text-sm mb-3">
          ⚠ Some indicators use estimated data — on-chain reads incomplete
        </p>
      )}

      <div className="flex flex-col divide-y divide-brand-border">
        {indicators.map(ind => (
          <div key={ind.name} className="py-4 flex gap-4 items-start">
            {/* Left: name + desc + note */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-base font-semibold text-brand-cream">{ind.name}</span>
                {ind.status && <StatusBadge status={ind.status} />}
              </div>
              {ind.desc && (
                <p className="text-sm text-brand-light mt-1 leading-relaxed">{ind.desc}</p>
              )}
              {ind.note && (
                <p className="text-sm text-brand-olive mt-1 font-medium">⚠ {ind.note}</p>
              )}
              {ind.link && (
                <Link href={ind.link} className="text-sm text-brand font-medium hover:underline mt-1 inline-block">
                  View details →
                </Link>
              )}
            </div>
            {/* Right: value + score */}
            <div className="text-right ml-4 max-w-[55%]">
              {typeof ind.value === 'string' && ind.value.includes(' · ') ? (
                <div className="flex flex-wrap gap-1 justify-end">
                  {ind.value.split(' · ').map((token: string) => (
                    <span key={token} className="inline-block text-sm bg-brand-bg text-brand-cream px-2 py-0.5 rounded">
                      {token}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-base text-brand-cream font-medium">{ind.value}</div>
              )}
              {ind.contribution > 0 && (
                <div className="text-sm text-brand-light mt-0.5">+{ind.contribution} risk pts</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
