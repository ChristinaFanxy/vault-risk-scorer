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

export function RiskDimensionCard({ dimensionScore, weightPct, placeholderFields = [] }: Props) {
  const { score, indicators } = dimensionScore

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-4">
        <span className={`text-3xl font-bold ${scoreColor(score)}`}>{score}</span>
        <span className="text-gray-400 text-sm">/100 · {weightPct}% of composite · lower = safer</span>
      </div>

      {placeholderFields.length > 0 && (
        <p className="text-yellow-600 text-xs mb-3">
          ⚠ Some indicators use estimated data — on-chain reads incomplete
        </p>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 border-b border-gray-700">
            <th className="text-left pb-2">Indicator</th>
            <th className="text-right pb-2">Value</th>
            <th className="text-right pb-2">+Score</th>
          </tr>
        </thead>
        <tbody>
          {indicators.map(ind => (
            <tr key={ind.name} className="border-b border-gray-800">
              <td className="py-2 text-gray-300">
                {ind.name}
                {ind.note && <p className="text-xs text-yellow-400 mt-0.5">{ind.note}</p>}
              </td>
              <td className="py-2 text-right text-gray-400">{ind.value}</td>
              <td className="py-2 text-right text-gray-500">+{ind.contribution}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
