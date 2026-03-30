'use client'

import { useLanguage } from '@/lib/i18n'
import { RiskGrade } from '@/components/RiskGrade'
import { RiskDimensionCard } from '@/components/RiskDimensionCard'
import { YieldCard } from '@/components/YieldCard'
import { CollapsibleCard } from '@/components/CollapsibleCard'
import type { CompositeScore } from '@/lib/scoring/types'

const CHAIN_NAMES: Record<number, string> = { 1: 'Ethereum', 8453: 'Base', 42161: 'Arbitrum' }

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
      {/* Back link */}
      <div className="mb-6">
        <a href="/" className="text-brand-cream hover:text-brand text-sm font-medium">
          {t.backToSearch}
        </a>
      </div>

      {/* Vault header */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="flex gap-2 mb-2">
            <span className="bg-brand-cream text-brand-bg text-sm px-2.5 py-0.5 rounded font-medium">Morpho</span>
            <span className="bg-brand-card text-brand-cream text-sm px-2.5 py-0.5 rounded border border-brand-border">
              {CHAIN_NAMES[chainId] ?? `Chain ${chainId}`}
            </span>
          </div>
          <h1 className="text-2xl font-bold text-brand-cream">{score.name || address}</h1>
          <p className="text-brand-light text-sm mt-1 font-mono">{address}</p>
          <div className="flex gap-6 mt-3 text-base">
            <span className="text-brand-light">TVL: <span className="text-brand-cream font-semibold">{tvlFormatted}</span></span>
            <span className="text-brand-light">APY: <span className="text-brand-cream font-semibold">{score.currentApyPct.toFixed(2)}%</span></span>
          </div>
        </div>
        <RiskGrade grade={score.grade} score={score.overallScore} label={score.label} size="lg" />
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-4">
        <CollapsibleCard
          title={t.yield}
          subtitle={`${score.currentApyPct.toFixed(2)}% APY`}
          defaultOpen
        >
          <YieldCard
            currentApyPct={score.currentApyPct}
            performanceFeePct={score.performanceFeePct}
            deployedAt={score.deployedAt}
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
      <div className="mt-8 text-sm text-brand-light border-t border-brand-border pt-4">
        <p>Data sources: DefiLlama API · The Graph Morpho subgraph · Alchemy RPC</p>
        <p>Last updated: {new Date(score.dataFreshnessMs).toISOString().replace('T', ' ').slice(0, 19)} UTC</p>
        <p className="mt-2">{t.disclaimer}</p>
      </div>
    </div>
  )
}
