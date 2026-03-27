// lib/scoring/assetRisk.ts
import type { VaultData, DimensionScore, AssetClass, OracleType } from './types'

const ASSET_CLASS_SCORE: Record<AssetClass, number> = {
  stablecoin: 5,
  'blue-chip': 20,
  'long-tail': 45,
}

const ORACLE_SCORE: Record<OracleType, number> = {
  chainlink: 0,
  'uniswap-twap': 15,
  custom: 30,
}

export function scoreAssetRisk(vault: VaultData): DimensionScore {
  if (vault.assets.length === 0) {
    return {
      score: 50,
      indicators: [{ name: 'Asset data', value: 'N/A', contribution: 50, note: 'On-chain asset data unavailable' }],
    }
  }

  const indicators: DimensionScore['indicators'] = []
  let score = 0

  // 1. Asset type (dominant asset by weight)
  const dominant = vault.assets.reduce((a, b) => a.vaultWeightPct >= b.vaultWeightPct ? a : b)
  const assetTypeScore = ASSET_CLASS_SCORE[dominant.assetClass]
  score += assetTypeScore
  indicators.push({ name: 'Asset type', value: dominant.assetClass, contribution: assetTypeScore })

  // 2. Oracle source (worst oracle among assets)
  const oracleOrder: OracleType[] = ['chainlink', 'uniswap-twap', 'custom']
  const worstOracle = vault.assets.reduce<OracleType>(
    (worst, a) => oracleOrder.indexOf(a.oracleType) > oracleOrder.indexOf(worst) ? a.oracleType : worst,
    'chainlink'
  )
  const oracleScore = ORACLE_SCORE[worstOracle]
  score += oracleScore
  indicators.push({ name: 'Oracle source', value: worstOracle, contribution: oracleScore })

  // 3. Liquidity depth vs TVL
  const totalLiquidity = vault.assets.reduce((s, a) => s + a.liquidityDepthUsd, 0)
  const ratio = vault.tvlUsd > 0 ? totalLiquidity / vault.tvlUsd : 0
  const liquidityScore = ratio >= 5 ? 0 : ratio >= 2 ? 5 : ratio >= 1 ? 15 : 25
  score += liquidityScore
  indicators.push({ name: 'Liquidity depth', value: `${ratio.toFixed(1)}× TVL`, contribution: liquidityScore })

  // 4. 30-day volatility (weighted avg)
  const weightedVol = vault.assets.reduce((s, a) => s + a.volatility30d * (a.vaultWeightPct / 100), 0)
  const volScore = weightedVol < 0.01 ? 0 : weightedVol < 0.05 ? 5 : weightedVol < 0.15 ? 10 : 20
  score += volScore
  indicators.push({ name: '30d volatility', value: `${(weightedVol * 100).toFixed(1)}%`, contribution: volScore })

  // 5. Concentration (>50% single asset in multi-asset vault)
  const maxWeight = Math.max(...vault.assets.map(a => a.vaultWeightPct))
  const concentrated = vault.assets.length > 1 && maxWeight > 50
  const concScore = concentrated ? 10 : 0
  score += concScore
  indicators.push({
    name: 'Concentration',
    value: concentrated ? `${maxWeight}% in ${dominant.symbol}` : 'None',
    contribution: concScore,
    note: concentrated ? 'Single asset >50% of multi-asset vault' : undefined,
  })

  return { score: Math.min(100, score), indicators }
}
