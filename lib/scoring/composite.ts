// lib/scoring/composite.ts
import type { DimensionScore, CompositeScore, VaultData } from './types'
import { scoreAssetRisk } from './assetRisk'
import { scoreLiquidationRisk } from './liquidationRisk'
import { scoreCuratorRisk } from './curatorRisk'

const WEIGHTS = { asset: 0.40, liquidation: 0.35, curator: 0.25 } as const

export function computeCompositeScore(
  asset: DimensionScore,
  liquidation: DimensionScore,
  curator: DimensionScore
): number {
  return Math.round(
    asset.score * WEIGHTS.asset +
    liquidation.score * WEIGHTS.liquidation +
    curator.score * WEIGHTS.curator
  )
}

export function scoreToGrade(score: number): { grade: CompositeScore['grade']; label: string } {
  if (score <= 20) return { grade: 'A', label: 'Low Risk' }
  if (score <= 40) return { grade: 'B', label: 'Moderate-Low Risk' }
  if (score <= 60) return { grade: 'C', label: 'Moderate Risk' }
  if (score <= 80) return { grade: 'D', label: 'High Risk' }
  return { grade: 'F', label: 'Very High Risk' }
}

function computeApyStability(vault: VaultData): 'Stable' | 'Volatile' {
  const history = vault.apyHistory.map(h => h.apyPct)
  if (history.length < 2) return 'Stable'
  const mean = history.reduce((s, v) => s + v, 0) / history.length
  const variance = history.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / history.length
  return Math.sqrt(variance) > 1.5 ? 'Volatile' : 'Stable'
}

export function scoreVault(vault: VaultData): CompositeScore {
  const assetRisk = scoreAssetRisk(vault)
  const liquidationRisk = scoreLiquidationRisk(vault)
  const curatorRisk = scoreCuratorRisk(vault)
  const overallScore = computeCompositeScore(assetRisk, liquidationRisk, curatorRisk)
  const { grade, label } = scoreToGrade(overallScore)

  return {
    vaultAddress: vault.address,
    chainId: vault.chainId,
    name: vault.name,
    tvlUsd: vault.tvlUsd,
    overallScore,
    grade,
    label,
    assetRisk,
    liquidationRisk,
    curatorRisk,
    currentApyPct: vault.currentApyPct,
    apy7dAvg: vault.apy7dAvg,
    apy30dAvg: vault.apy30dAvg,
    apy90dAvg: vault.apy90dAvg,
    apyStabilityLabel: computeApyStability(vault),
    apyHistory: vault.apyHistory,
    placeholderFields: vault.placeholderFields,
    dataFreshnessMs: Date.now(),
  }
}
