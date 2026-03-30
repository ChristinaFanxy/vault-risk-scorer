interface Props {
  currentApyPct: number
  performanceFeePct: number | null
  deployedAt: number | null
}

export function YieldCard({ currentApyPct, performanceFeePct, deployedAt }: Props) {
  const deployedLabel = deployedAt
    ? new Date(deployedAt).toISOString().slice(0, 10)
    : 'N/A'

  return (
    <div className="flex gap-10">
      <div>
        <p className="text-brand-light text-sm mb-1">Current APY</p>
        <p className="text-brand-cream text-xl font-bold">{currentApyPct.toFixed(2)}%</p>
      </div>
      <div>
        <p className="text-brand-light text-sm mb-1">Performance Fee</p>
        <p className="text-brand-cream text-xl font-bold">{performanceFeePct !== null ? `${performanceFeePct.toFixed(0)}%` : 'N/A'}</p>
      </div>
      <div>
        <p className="text-brand-light text-sm mb-1">Deployed</p>
        <p className="text-brand-cream text-xl font-bold">{deployedLabel}</p>
      </div>
    </div>
  )
}
