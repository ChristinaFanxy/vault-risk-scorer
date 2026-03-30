// lib/scoring/assetRisk.ts
import type { VaultData, DimensionScore, AssetClass, OracleType } from './types'

const ASSET_CLASS_SCORE: Record<AssetClass, number> = {
  stablecoin: 5,
  'blue-chip': 20,
  'long-tail': 45,
}

const ORACLE_SCORE: Record<OracleType, number> = {
  chainlink: 0,
  'uniswap-twap': 5,
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
    status: worstOracle === 'chainlink' ? 'good' : worstOracle === 'uniswap-twap' ? 'ok' : 'bad',
  })

  // 2b. Oracle integrity — detect hardcoded price feeds
  const hcCount = vault.hardcodedOracleCount
  const hcSymbols = vault.hardcodedOracleSymbols
  if (hcCount > 0) {
    // Check how much weight the hardcoded assets carry
    const hcWeight = vault.assets
      .filter(a => hcSymbols.includes(a.symbol))
      .reduce((s, a) => s + a.vaultWeightPct, 0)
    const hcScore = hcWeight >= 20 ? 30 : 15
    score += hcScore
    indicators.push({
      name: 'Oracle integrity',
      desc: 'Whether price feeds actually track market prices. Hardcoded oracles always return the same price — if the asset depegs, the oracle won\'t reflect it, making liquidations impossible.',
      value: `${hcCount} market(s) use hardcoded price (${hcSymbols.join(', ')})`,
      contribution: hcScore,
      status: hcWeight >= 20 ? 'bad' : 'caution',
      note: 'Price feed returns identical value across multiple weeks — cannot reflect market reality',
    })
  } else {
    indicators.push({
      name: 'Oracle integrity',
      desc: 'Whether price feeds actually track market prices. Hardcoded oracles always return the same price — if the asset depegs, the oracle won\'t reflect it, making liquidations impossible.',
      value: 'All feeds track live prices',
      contribution: 0,
      status: 'good',
    })
  }

  // 3. Market liquidity — per-asset breakdown
  const fmtUsd = (n: number) => n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : `$${(n / 1_000).toFixed(0)}K`
  const assetRatios = activeAssets.map(a => {
    const allocated = vault.tvlUsd * a.vaultWeightPct / 100
    const ratio = allocated > 0 ? a.liquidityDepthUsd / allocated : 0
    return { symbol: a.symbol, ratio, weight: a.vaultWeightPct, allocated, liquidity: a.liquidityDepthUsd }
  })
  const weightedLiqRatio = assetRatios.reduce((s, r) => s + r.ratio * (r.weight / 100), 0)
  const baseRatioScore = weightedLiqRatio >= 5 ? 0 : weightedLiqRatio >= 2 ? 5 : weightedLiqRatio >= 1 ? 15 : 25
  const worstLiqAsset = assetRatios.filter(r => r.weight > 10).sort((a, b) => a.ratio - b.ratio)[0]
  const liqPenalty = worstLiqAsset && worstLiqAsset.ratio < 1 ? 10 : 0
  const liquidityScore = baseRatioScore + liqPenalty
  score += liquidityScore
  const liqDetails = assetRatios.map(r =>
    `${r.symbol}: ${fmtUsd(r.allocated)} / ${fmtUsd(r.liquidity)} DEX (${r.ratio.toFixed(1)}×)`
  ).join(' · ')
  const worstRatio = assetRatios.length > 0 ? Math.min(...assetRatios.map(r => r.ratio)) : 0
  indicators.push({
    name: 'Market liquidity',
    desc: 'DEX liquidity available per collateral asset vs. vault allocation. If liquidity < allocation, a mass liquidation could cause losses.',
    value: liqDetails,
    contribution: liquidityScore,
    status: worstRatio >= 5 ? 'good' : worstRatio >= 2 ? 'ok' : worstRatio >= 1 ? 'caution' : 'bad',
    note: liqPenalty > 0 ? `${worstLiqAsset!.symbol} has less DEX liquidity than its vault allocation` : undefined,
  })

  // 4. Price volatility — per-asset breakdown
  const assetVols = activeAssets.map(a => ({
    symbol: a.symbol,
    vol: a.volatility30d,
    weight: a.vaultWeightPct,
  }))
  const weightedVol = assetVols.reduce((s, v) => s + v.vol * (v.weight / 100), 0)
  const baseVolScore = weightedVol < 0.01 ? 0 : weightedVol < 0.05 ? 5 : weightedVol < 0.15 ? 10 : 20
  const worstVolAsset = assetVols.filter(v => v.weight > 10).sort((a, b) => b.vol - a.vol)[0]
  const volPenalty = worstVolAsset && worstVolAsset.vol >= 0.30 ? 10 : 0
  const volScore = baseVolScore + volPenalty
  score += volScore
  const volDetails = assetVols.map(v =>
    `${v.symbol}: ${(v.vol * 100).toFixed(1)}%`
  ).join(' · ')
  const worstVol = assetVols.length > 0 ? Math.max(...assetVols.map(v => v.vol)) : 0
  indicators.push({
    name: 'Price volatility',
    desc: '30-day price volatility per collateral asset. Higher volatility = faster chance of hitting the liquidation threshold.',
    value: volDetails,
    contribution: volScore,
    status: worstVol < 0.01 ? 'good' : worstVol < 0.05 ? 'ok' : worstVol < 0.15 ? 'caution' : 'bad',
    note: volPenalty > 0 ? `${worstVolAsset!.symbol} has extreme volatility (${(worstVolAsset!.vol * 100).toFixed(0)}%)` : undefined,
  })

  // 5. Vault withdrawability — can depositors actually exit?
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
