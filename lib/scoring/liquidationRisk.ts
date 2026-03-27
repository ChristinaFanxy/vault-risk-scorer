// lib/scoring/liquidationRisk.ts
import type { VaultData, DimensionScore } from './types'

export function scoreLiquidationRisk(vault: VaultData): DimensionScore {
  const indicators: DimensionScore['indicators'] = []
  let score = 0

  // 1. LTV buffer
  const buffer = vault.liquidationThresholdPct - vault.maxLtvPct
  const ltvScore = buffer >= 10 ? 0 : buffer >= 7 ? 5 : buffer >= 5 ? 15 : buffer >= 3 ? 25 : 40
  score += ltvScore
  indicators.push({
    name: 'LTV buffer',
    value: `${buffer}% (max LTV ${vault.maxLtvPct}% → liq. threshold ${vault.liquidationThresholdPct}%)`,
    contribution: ltvScore,
    note: buffer < 5 ? 'Thin buffer — liquidators may not have enough time to act' : undefined,
  })

  // 2. Liquidation incentive
  const bonusScore = vault.liquidationBonusPct >= 7 ? 0
    : vault.liquidationBonusPct >= 5 ? 5
    : vault.liquidationBonusPct >= 3 ? 15
    : 25
  score += bonusScore
  indicators.push({
    name: 'Liquidation incentive',
    value: `${vault.liquidationBonusPct}%`,
    contribution: bonusScore,
    note: vault.liquidationBonusPct < 3 ? 'Very low bonus — liquidators may not act' : undefined,
  })

  // 3. Liquidation mechanism
  const mechScore = vault.liquidationMechanism === 'dutch-auction' ? 0 : 10
  score += mechScore
  indicators.push({
    name: 'Liquidation mechanism',
    value: vault.liquidationMechanism,
    contribution: mechScore,
    note: vault.liquidationMechanism === 'fixed-discount' ? 'Less resilient in volatile markets' : undefined,
  })

  // 4. Historical bad debt
  let badDebtScore = 0
  let badDebtValue: string
  if (vault.historicalBadDebtUsd === -1) {
    badDebtValue = 'N/A'
  } else if (vault.historicalBadDebtUsd === 0) {
    badDebtValue = '$0'
  } else {
    badDebtValue = `$${vault.historicalBadDebtUsd.toLocaleString()}`
    badDebtScore = 30
  }
  score += badDebtScore
  indicators.push({
    name: 'Historical bad debt',
    value: badDebtValue,
    contribution: badDebtScore,
    note: vault.historicalBadDebtUsd > 0 ? 'Protocol has experienced bad debt — significant risk flag' : undefined,
  })

  // 5. Oracle manipulation surface
  const oracleScore = vault.oracleManipulationSurface === 'low' ? 0
    : vault.oracleManipulationSurface === 'medium' ? 10
    : 20
  score += oracleScore
  indicators.push({
    name: 'Oracle manipulation surface',
    value: vault.oracleManipulationSurface,
    contribution: oracleScore,
  })

  return { score: Math.min(100, score), indicators }
}
