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
    const isAdapterVault = vault.placeholderFields.includes('adapterCapsOpaque')
    const note = isAdapterVault
      ? 'This vault routes funds through opaque adapter strategies — collateral type is not publicly disclosed by the protocol'
      : 'On-chain asset data unavailable'
    return {
      score: 50,
      indicators: [{ name: 'Asset data', value: 'N/A', contribution: 50, note }],
    }
  }

  const indicators: DimensionScore['indicators'] = []
  let score = 0

  // 1. Collateral type — all real assets (exclude idle markets shown as UNKNOWN)
  const activeAssets = vault.assets
    .filter(a => a.symbol !== 'UNKNOWN')
    .sort((a, b) => b.vaultWeightPct - a.vaultWeightPct)
  const dominant = activeAssets.length > 0
    ? activeAssets[0]
    : vault.assets.reduce((a, b) => a.vaultWeightPct >= b.vaultWeightPct ? a : b)
  const assetTypeScore = ASSET_CLASS_SCORE[dominant.assetClass]
  score += assetTypeScore
  const assetLabel = dominant.assetClass === 'stablecoin' ? 'Stablecoin (low volatility)'
    : dominant.assetClass === 'blue-chip' ? 'Blue-chip (ETH/BTC class)'
    : 'Long-tail token (high risk)'
  const assetListValue = activeAssets.length <= 1
    ? `${dominant.symbol} — ${assetLabel}`
    : activeAssets.map(a => `${a.symbol} (${a.vaultWeightPct.toFixed(1)}%)`).join(' · ')
  indicators.push({
    name: 'Collateral type',
    desc: 'What borrowers put up as collateral. Stablecoins are safest; unknown tokens can lose value rapidly.',
    value: assetListValue,
    contribution: assetTypeScore,
    status: dominant.assetClass === 'stablecoin' ? 'good'
      : dominant.assetClass === 'blue-chip' ? 'ok' : 'bad',
  })

  // 2. Price oracle (worst oracle among assets)
  const oracleOrder: OracleType[] = ['chainlink', 'uniswap-twap', 'custom']
  const worstOracle = vault.assets.reduce<OracleType>(
    (worst, a) => oracleOrder.indexOf(a.oracleType) > oracleOrder.indexOf(worst) ? a.oracleType : worst,
    'chainlink'
  )
  const oracleScore = ORACLE_SCORE[worstOracle]
  score += oracleScore
  const oracleLabel = worstOracle === 'chainlink' ? 'Chainlink (battle-tested)'
    : worstOracle === 'uniswap-twap' ? 'Uniswap TWAP (DEX-based)'
    : 'Custom oracle (unverified)'
  indicators.push({
    name: 'Price oracle',
    desc: 'Where collateral prices come from. Chainlink is battle-tested and widely audited; custom oracles carry more uncertainty.',
    value: oracleLabel,
    contribution: oracleScore,
    status: worstOracle === 'chainlink' ? 'good' : worstOracle === 'uniswap-twap' ? 'caution' : 'bad',
  })

  // 3. Market liquidity vs TVL
  const totalLiquidity = vault.assets.reduce((s, a) => s + a.liquidityDepthUsd, 0)
  const ratio = vault.tvlUsd > 0 ? totalLiquidity / vault.tvlUsd : 0
  const liquidityScore = ratio >= 5 ? 0 : ratio >= 2 ? 5 : ratio >= 1 ? 15 : 25
  score += liquidityScore
  indicators.push({
    name: 'Market liquidity',
    desc: 'How easily collateral can be sold in an emergency. If liquidity is smaller than the vault, a mass liquidation could cause losses.',
    value: `${ratio.toFixed(1)}× vault size`,
    contribution: liquidityScore,
    status: ratio >= 5 ? 'good' : ratio >= 2 ? 'ok' : ratio >= 1 ? 'caution' : 'bad',
  })

  // 4. Price volatility (weighted 30d avg)
  const weightedVol = vault.assets.reduce((s, a) => s + a.volatility30d * (a.vaultWeightPct / 100), 0)
  const volScore = weightedVol < 0.01 ? 0 : weightedVol < 0.05 ? 5 : weightedVol < 0.15 ? 10 : 20
  score += volScore
  indicators.push({
    name: 'Price volatility',
    desc: 'How much collateral prices swing over 30 days. Higher volatility = faster chance of hitting the liquidation threshold.',
    value: `${(weightedVol * 100).toFixed(1)}% monthly average`,
    contribution: volScore,
    status: weightedVol < 0.01 ? 'good' : weightedVol < 0.05 ? 'ok' : weightedVol < 0.15 ? 'caution' : 'bad',
  })

  // 5. Concentration
  const maxWeight = Math.max(...vault.assets.map(a => a.vaultWeightPct))
  const concentrated = activeAssets.length > 1 && maxWeight > 50
  const concScore = concentrated ? 10 : 0
  score += concScore
  const concValue = activeAssets.length <= 1
    ? `Single asset — ${dominant.symbol}`
    : concentrated ? `${maxWeight.toFixed(1)}% in ${dominant.symbol}` : 'Diversified'
  const concStatus = activeAssets.length <= 1 ? 'ok'
    : concentrated ? 'caution' : 'good'
  indicators.push({
    name: 'Concentration',
    desc: 'Whether one asset dominates the vault. Concentration means less diversification — one bad asset affects the whole pool.',
    value: concValue,
    contribution: concScore,
    status: concStatus,
    note: concentrated ? 'Single asset >50% of multi-asset vault' : undefined,
  })

  // 6. Vault withdrawability — can depositors actually exit?
  const util = vault.weightedUtilization
  const mktLiq = vault.totalMarketLiquidityUsd
  const liqRatio = vault.tvlUsd > 0 ? mktLiq / vault.tvlUsd : 1
  // Scoring: utilization near 100% with no liquidity = catastrophic
  const withdrawScore = util >= 0.99 && liqRatio < 0.01 ? 50   // fully locked — no exit
    : util >= 0.95 ? 30                                          // nearly locked
    : util >= 0.85 ? 15                                          // tight — may face delays
    : util >= 0.70 ? 5                                           // moderate usage
    : 0                                                           // healthy
  score += withdrawScore
  const utilPct = (util * 100).toFixed(1)
  const withdrawValue = util >= 0.99 && liqRatio < 0.01
    ? `${utilPct}% utilized — vault is effectively frozen`
    : util >= 0.95 ? `${utilPct}% utilized — withdrawal may fail`
    : `${utilPct}% utilized · $${(mktLiq / 1000).toFixed(0)}K available`
  indicators.push({
    name: 'Vault withdrawability',
    desc: 'How much of the vault\'s deposits are currently borrowed out. At 100% utilization, no funds are available to withdraw — your deposit is locked until borrowers repay.',
    value: withdrawValue,
    contribution: withdrawScore,
    status: util >= 0.99 && liqRatio < 0.01 ? 'bad'
      : util >= 0.95 ? 'bad'
      : util >= 0.85 ? 'caution'
      : util >= 0.70 ? 'ok' : 'good',
    note: util >= 0.99 && liqRatio < 0.01
      ? 'All deposited funds are borrowed — withdrawals are blocked until borrowers repay or get liquidated'
      : undefined,
  })

  return { score: Math.min(100, score), indicators }
}
