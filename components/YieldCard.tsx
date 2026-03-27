'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  currentApyPct: number
  apy7dAvg: number | null
  apy30dAvg: number | null
  apy90dAvg: number | null
  apyStabilityLabel: 'Stable' | 'Volatile'
  apyHistory: Array<{ timestamp: number; apyPct: number }>
}

export function YieldCard({
  currentApyPct, apy7dAvg, apy30dAvg, apy90dAvg, apyStabilityLabel, apyHistory,
}: Props) {
  const chartData = apyHistory.slice(-90).map(h => ({
    date: new Date(h.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    apy: Number(h.apyPct.toFixed(2)),
  }))

  return (
    <div>
      <div className="flex gap-6 mb-4 text-sm">
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

      {chartData.length > 1 ? (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData}>
            <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#9ca3af' }}
              formatter={(v) => {
                const formatted = typeof v === 'number' ? `${v.toFixed(2)}%` : `${v}`
                return [formatted, 'APY'] as [string, string]
              }}
            />
            <Line type="monotone" dataKey="apy" stroke="#818cf8" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-gray-500 text-sm">Historical chart unavailable</p>
      )}
    </div>
  )
}
