interface Props {
  currentApyPct: number
  apy7dAvg: number | null
  apy30dAvg: number | null
  apy90dAvg: number | null
  apyStabilityLabel: 'Stable' | 'Volatile'
}

export function YieldCard({
  currentApyPct, apy7dAvg, apy30dAvg, apy90dAvg, apyStabilityLabel,
}: Props) {
  return (
    <div className="flex gap-6 text-sm">
      <div>
        <p className="text-gray-500">Current APY</p>
        <p className="text-white text-xl font-bold">{currentApyPct.toFixed(2)}%</p>
      </div>
      {apy7dAvg != null && (
        <div>
          <p className="text-gray-500">7-day avg</p>
          <p className="text-gray-300">{apy7dAvg.toFixed(2)}%</p>
        </div>
      )}
      {apy30dAvg != null && (
        <div>
          <p className="text-gray-500">30-day avg</p>
          <p className="text-gray-300">{apy30dAvg.toFixed(2)}%</p>
        </div>
      )}
      {apy90dAvg != null && (
        <div>
          <p className="text-gray-500">90-day avg</p>
          <p className="text-gray-300">{apy90dAvg.toFixed(2)}%</p>
        </div>
      )}
      <div>
        <p className="text-gray-500">Stability</p>
        <p className={apyStabilityLabel === 'Stable' ? 'text-green-400' : 'text-yellow-400'}>
          {apyStabilityLabel}
        </p>
      </div>
    </div>
  )
}
