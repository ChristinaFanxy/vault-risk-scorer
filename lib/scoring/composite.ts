// lib/scoring/composite.ts
import type { DimensionScore, CompositeScore, VaultData } from './types'
import { scoreAssetRisk } from './assetRisk'
import { scoreLiquidationRisk } from './liquidationRisk'
import { scoreCuratorRisk } from './curatorRisk'

const WEIGHTS = { asset: 0.60, curator: 0.40 } as const

export function computeCompositeScore(
  asset: DimensionScore,
  liquidation: DimensionScore,
  curator: DimensionScore
): number {
  return Math.round(
    asset.score * WEIGHTS.asset +
    curator.score * WEIGHTS.curator
  )
}

export function scoreToGrade(score: number): { grade: CompositeScore['grade']; label: string } {
  if (score <= 20) return { grade: 'A', label: 'Low Risk' }
  if (score <= 40) return { grade: 'B', label: 'Moderate-Low Risk' }
  if (score <= 60) return { grade: 'C', label: 'Moderate Risk' }
  if (score <= 80) return { grade: 'D', label: 'Elevated Risk' }
  return { grade: 'F', label: 'High Risk' }
}

export function scoreVault(vault: VaultData, dataFreshnessMs = 0): CompositeScore {
  const assetRisk = scoreAssetRisk(vault)
  const liquidationRisk = scoreLiquidationRisk(vault)
  const curatorRisk = scoreCuratorRisk(vault)
  let overallScore = computeCompositeScore(assetRisk, liquidationRisk, curatorRisk)

  // Critical liquidity override: if the vault is effectively frozen (≥99% utilization
  // with near-zero available liquidity), force a minimum score of 85 (F grade).
  const liqRatio = vault.tvlUsd > 0 ? vault.totalMarketLiquidityUsd / vault.tvlUsd : 1
  if (vault.weightedUtilization >= 0.99 && liqRatio < 0.01) {
    overallScore = Math.max(overallScore, 85)
  } else if (vault.weightedUtilization >= 0.95) {
    overallScore = Math.max(overallScore, 70)
  }

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
    performanceFeePct: vault.performanceFeePct,
    deployedAt: vault.deployedAt,
    placeholderFields: vault.placeholderFields,
    dataFreshnessMs,
  }
}
