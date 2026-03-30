import type { DimensionScore } from '@/lib/scoring/types'

interface Props {
  dimensionScore: DimensionScore
  weightPct: number
  placeholderFields?: string[]
}

function scoreColor(score: number): string {
  if (score <= 20) return 'text-green-400'
  if (score <= 40) return 'text-lime-400'
  if (score <= 60) return 'text-yellow-400'
  if (score <= 80) return 'text-orange-400'
  return 'text-red-500'
}

function StatusBadge({ status }: { status: 'good' | 'ok' | 'caution' | 'bad' }) {
  const cfg = {
    good:    { label: 'Good',    cls: 'bg-green-900/50 text-green-400 border-green-800' },
    ok:      { label: 'OK',      cls: 'bg-gray-800 text-gray-300 border-gray-700' },
    caution: { label: 'Caution', cls: 'bg-yellow-900/40 text-yellow-400 border-yellow-800' },
    bad:     { label: 'Risk',    cls: 'bg-red-900/40 text-red-400 border-red-800' },
  }[status]
  return (
    <span className={`inline-block text-xs px-1.5 py-0.5 rounded border ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

export function RiskDimensionCard({ dimensionScore, weightPct, placeholderFields = [] }: Props) {
  const { score, indicators } = dimensionScore

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-4">
        <span className={`text-3xl font-bold ${scoreColor(score)}`}>{score}</span>
        <span className="text-gray-400 text-sm">
          {weightPct > 0 ? `/100 · ${weightPct}% of composite · lower = safer` : 'Reference only — not included in score'}
        </span>
      </div>

      {placeholderFields.length > 0 && (
        <p className="text-yellow-600 text-xs mb-3">
          ⚠ Some indicators use estimated data — on-chain reads incomplete
        </p>
      )}

      <div className="flex flex-col divide-y divide-gray-800">
        {indicators.map(ind => (
          <div key={ind.name} className="py-3 flex gap-3 items-start">
            {/* Left: name + desc + note */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium text-gray-200">{ind.name}</span>
                {ind.status && <StatusBadge status={ind.status} />}
              </div>
              {ind.desc && (
                <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{ind.desc}</p>
              )}
              {ind.note && (
                <p className="text-xs text-yellow-400 mt-1">⚠ {ind.note}</p>
              )}
            </div>
            {/* Right: value + score */}
            <div className="text-right ml-4 max-w-[55%]">
              {typeof ind.value === 'string' && ind.value.includes(' · ') ? (
                <div className="flex flex-wrap gap-1 justify-end">
                  {ind.value.split(' · ').map((token: string) => (
                    <span key={token} className="inline-block text-xs bg-gray-800 text-gray-300 px-1.5 py-0.5 rounded">
                      {token}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-gray-300">{ind.value}</div>
              )}
              {ind.contribution > 0 && (
                <div className="text-xs text-gray-600 mt-0.5">+{ind.contribution} risk pts</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
