'use client'

import { useLanguage } from '@/lib/i18n'
import { LanguageToggle } from '@/lib/i18n'
import { RiskGrade } from '@/components/RiskGrade'
import { RiskDimensionCard } from '@/components/RiskDimensionCard'
import { YieldCard } from '@/components/YieldCard'
import { CollapsibleCard } from '@/components/CollapsibleCard'
import type { CompositeScore } from '@/lib/scoring/types'

const CHAIN_NAMES: Record<number, string> = { 1: 'Ethereum', 8453: 'Base' }

interface VaultDetailViewProps {
  score: CompositeScore
  address: string
  chainId: number
}

export function VaultDetailView({ score, address, chainId }: VaultDetailViewProps) {
  const { t } = useLanguage()

  const tvlFormatted = score.tvlUsd >= 1_000_000
    ? `$${(score.tvlUsd / 1_000_000).toFixed(1)}M`
    : `$${(score.tvlUsd / 1_000).toFixed(0)}K`

  return (
    <div className="max-w-3xl mx-auto">
      {/* Top bar with back link and language toggle */}
      <div className="flex items-center justify-between mb-4">
        <a href="/" className="text-brand hover:text-brand-cream text-sm">
          {t.backToSearch}
        </a>
        <LanguageToggle />
      </div>

      {/* Vault header */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="flex gap-2 mb-2">
            <span className="bg-indigo-900 text-brand-cream text-xs px-2 py-1 rounded">Morpho</span>
            <span className="bg-brand-card text-brand-cream text-xs px-2 py-1 rounded">
              {CHAIN_NAMES[chainId] ?? `Chain ${chainId}`}
            </span>
          </div>
          <h1 className="text-xl font-bold text-brand-cream break-all">{score.name || address}</h1>
          <p className="text-brand-light text-sm mt-1 font-mono">{address}</p>
          <div className="flex gap-4 mt-2 text-sm">
            <span className="text-brand-light">TVL: <span className="text-brand-cream font-medium">{tvlFormatted}</span></span>
            <span className="text-brand-light">
              APY: <span className="text-brand-cream font-medium">{score.currentApyPct.toFixed(2)}%</span>
              {' · '}
              <span className={score.apyStabilityLabel === 'Stable' ? 'text-green-400' : 'text-yellow-400'}>
                {score.apyStabilityLabel}
              </span>
            </span>
          </div>
        </div>
        <RiskGrade grade={score.grade} score={score.overallScore} label={score.label} size="lg" />
      </div>

      {/* 4 collapsible cards */}
      <div className="flex flex-col gap-4">
        <CollapsibleCard
          title={t.yield}
          subtitle={`${score.currentApyPct.toFixed(2)}% APY · ${score.apyStabilityLabel}`}
          defaultOpen
        >
          <YieldCard
            currentApyPct={score.currentApyPct}
            apy7dAvg={score.apy7dAvg}
            apy30dAvg={score.apy30dAvg}
            apy90dAvg={score.apy90dAvg}
            apyStabilityLabel={score.apyStabilityLabel}
          />
        </CollapsibleCard>

        <CollapsibleCard
          title={t.assetRisk}
          subtitle={`Score: ${score.assetRisk.score}/100 · 60% ${t.ofComposite}`}
        >
          <RiskDimensionCard
            dimensionScore={score.assetRisk}
            weightPct={60}
            placeholderFields={score.placeholderFields.filter(f =>
              ['assets', 'oracleManipulationSurface'].includes(f)
            )}
          />
        </CollapsibleCard>

        <CollapsibleCard
          title={t.curatorRisk}
          subtitle={`Score: ${score.curatorRisk.score}/100 · 40% ${t.ofComposite}`}
        >
          <RiskDimensionCard
            dimensionScore={score.curatorRisk}
            weightPct={40}
            placeholderFields={score.placeholderFields.filter(f =>
              ['curatorType', 'permissionScope', 'vaultsManaged', 'incidentCount', 'curatorBorrowsFromVault'].includes(f)
            )}
          />
        </CollapsibleCard>

        <CollapsibleCard
          title={t.liquidationRisk}
          subtitle={t.infoOnly}
        >
          <RiskDimensionCard
            dimensionScore={score.liquidationRisk}
            weightPct={0}
            placeholderFields={score.placeholderFields.filter(f =>
              ['maxLtvPct', 'liquidationThresholdPct'].includes(f)
            )}
          />
        </CollapsibleCard>
      </div>

      {/* Footer */}
      <div className="mt-8 text-xs text-brand-light/60 border-t border-brand-border pt-4">
        <p>Data sources: DefiLlama API · The Graph Morpho subgraph · Alchemy RPC</p>
        <p>Last updated: {new Date(score.dataFreshnessMs).toLocaleString()}</p>
        <p className="mt-2">{t.disclaimer}</p>
      </div>
    </div>
  )
}
