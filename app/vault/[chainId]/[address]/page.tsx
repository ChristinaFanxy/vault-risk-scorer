import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { RiskGrade } from '@/components/RiskGrade'
import { RiskDimensionCard } from '@/components/RiskDimensionCard'
import { YieldCard } from '@/components/YieldCard'
import { CollapsibleCard } from '@/components/CollapsibleCard'
import { SkeletonCard } from '@/components/SkeletonCard'
import { fetchMorphoVaultData } from '@/lib/scoring/protocols/morpho'
import { scoreVault } from '@/lib/scoring/composite'
import featuredVaults from '@/data/featured-vaults.json'
import type { ChainId } from '@/lib/scoring/types'

const CHAIN_NAMES: Record<number, string> = { 1: 'Ethereum', 8453: 'Base' }
const SUPPORTED: ChainId[] = [1, 8453]

async function VaultContent({ chainId, address }: { chainId: string; address: string }) {
  const cid = parseInt(chainId) as ChainId
  if (!SUPPORTED.includes(cid)) notFound()

  const featured = featuredVaults.find(
    v => v.address.toLowerCase() === address.toLowerCase() && v.chainId === cid
  )
  const defillamaPoolId = featured?.defillamaPoolId ?? address

  let score
  let fetchError: string | null = null
  try {
    const fetchTime = Date.now()
    const vaultData = await fetchMorphoVaultData(address, cid, defillamaPoolId)
    score = scoreVault(vaultData, fetchTime)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Only 404 if we're confident it's not a vault — RPC errors say "contract" or "revert"
    const isNotVault = /ContractFunctionExecutionError|does not match|revert|invalid address/i.test(msg)
    if (isNotVault) notFound()
    fetchError = msg
  }

  if (fetchError || !score) {
    return (
      <main className="min-h-screen bg-gray-950 text-white p-8 flex items-center justify-center">
        <div className="max-w-md text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold mb-2">Unable to load vault data</h1>
          <p className="text-gray-400 text-sm mb-4">
            This could be a temporary network issue or the vault may not be supported yet.
          </p>
          <p className="text-gray-600 text-xs font-mono break-all mb-6">{address}</p>
          <a href="/" className="text-indigo-400 hover:text-indigo-300 text-sm">← Back to search</a>
        </div>
      </main>
    )
  }

  const tvlFormatted = score.tvlUsd >= 1_000_000
    ? `$${(score.tvlUsd / 1_000_000).toFixed(1)}M`
    : `$${(score.tvlUsd / 1_000).toFixed(0)}K`

  return (
    <div className="max-w-3xl mx-auto">
      {/* Top bar */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="flex gap-2 mb-2">
            <span className="bg-indigo-900 text-indigo-300 text-xs px-2 py-1 rounded">Morpho</span>
            <span className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded">
              {CHAIN_NAMES[cid] ?? `Chain ${cid}`}
            </span>
          </div>
          <h1 className="text-xl font-bold text-white break-all">{score.name || address}</h1>
          <p className="text-gray-400 text-sm mt-1 font-mono">{address}</p>
          <div className="flex gap-4 mt-2 text-sm">
            <span className="text-gray-400">TVL: <span className="text-white font-medium">{tvlFormatted}</span></span>
            <span className="text-gray-400">
              APY: <span className="text-white font-medium">{score.currentApyPct.toFixed(2)}%</span>
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
          title="Yield"
          subtitle={`${score.currentApyPct.toFixed(2)}% APY · ${score.apyStabilityLabel}`}
          defaultOpen
        >
          <YieldCard
            currentApyPct={score.currentApyPct}
            apy7dAvg={score.apy7dAvg}
            apy30dAvg={score.apy30dAvg}
            apy90dAvg={score.apy90dAvg}
            apyStabilityLabel={score.apyStabilityLabel}
            apyHistory={score.apyHistory}
          />
        </CollapsibleCard>

        <CollapsibleCard
          title="Underlying Asset Risk"
          subtitle={`Score: ${score.assetRisk.score}/100 · 40% of composite`}
        >
          <RiskDimensionCard
            dimensionScore={score.assetRisk}
            weightPct={40}
            placeholderFields={score.placeholderFields.filter(f =>
              ['assets', 'oracleManipulationSurface'].includes(f)
            )}
          />
        </CollapsibleCard>

        <CollapsibleCard
          title="Liquidation Rules Risk"
          subtitle={`Score: ${score.liquidationRisk.score}/100 · 35% of composite`}
        >
          <RiskDimensionCard
            dimensionScore={score.liquidationRisk}
            weightPct={35}
            placeholderFields={score.placeholderFields.filter(f =>
              ['maxLtvPct', 'liquidationThresholdPct'].includes(f)
            )}
          />
        </CollapsibleCard>

        <CollapsibleCard
          title="Curator Risk"
          subtitle={`Score: ${score.curatorRisk.score}/100 · 25% of composite`}
        >
          <RiskDimensionCard
            dimensionScore={score.curatorRisk}
            weightPct={25}
            placeholderFields={score.placeholderFields.filter(f =>
              ['curatorType', 'permissionScope', 'vaultsManaged', 'incidentCount', 'curatorBorrowsFromVault'].includes(f)
            )}
          />
        </CollapsibleCard>
      </div>

      {/* Footer */}
      <div className="mt-8 text-xs text-gray-600 border-t border-gray-800 pt-4">
        <p>Data sources: DefiLlama API · The Graph Morpho subgraph · Alchemy RPC</p>
        <p>Last updated: {new Date(score.dataFreshnessMs).toLocaleString()}</p>
        <p className="mt-2">For informational purposes only. Not investment advice.</p>
      </div>
    </div>
  )
}

export default function VaultPage({ params }: { params: { chainId: string; address: string } }) {
  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <Suspense fallback={
        <div className="max-w-3xl mx-auto flex flex-col gap-4">
          <SkeletonCard rows={2} />
          <SkeletonCard rows={5} />
          <SkeletonCard rows={5} />
          <SkeletonCard rows={5} />
        </div>
      }>
        <VaultContent chainId={params.chainId} address={params.address} />
      </Suspense>
    </main>
  )
}
