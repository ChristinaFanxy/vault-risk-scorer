// lib/scoring/liquidationRisk.ts
import type { VaultData, DimensionScore } from './types'

export function scoreLiquidationRisk(vault: VaultData): DimensionScore {
  const indicators: DimensionScore['indicators'] = []
  let score = 0

  // 1. Safety buffer (LTV gap)
  const buffer = vault.liquidationThresholdPct - vault.maxLtvPct
  const ltvScore = buffer >= 10 ? 0 : buffer >= 7 ? 5 : buffer >= 5 ? 15 : buffer >= 3 ? 25 : 40
  score += ltvScore
  const ltvStatus = buffer >= 10 ? 'good' : buffer >= 7 ? 'ok' : buffer >= 5 ? 'caution' : 'bad'
  indicators.push({
    name: 'Safety buffer',
    desc: 'Gap between max borrow limit and liquidation trigger. Wider = more time to react before positions are closed.',
    value: `${buffer.toFixed(1)}% cushion (borrow up to ${vault.maxLtvPct.toFixed(1)}%, liquidated at ${vault.liquidationThresholdPct.toFixed(1)}%)`,
    contribution: ltvScore,
    status: ltvStatus,
    note: buffer < 5 ? 'Very thin buffer — liquidators may not have enough time to act in volatile markets' : undefined,
  })

  // 2. Liquidator reward
  const bonusScore = vault.liquidationBonusPct >= 7 ? 0
    : vault.liquidationBonusPct >= 5 ? 5
    : vault.liquidationBonusPct >= 3 ? 15
    : 25
  score += bonusScore
  const bonusStatus = vault.liquidationBonusPct >= 7 ? 'good'
    : vault.liquidationBonusPct >= 5 ? 'ok'
    : vault.liquidationBonusPct >= 3 ? 'caution' : 'bad'
  indicators.push({
    name: 'Liquidator reward',
    desc: 'Bonus paid to bots/traders who close underwater loans. Low reward = slow response = higher chance of bad debt.',
    value: `${vault.liquidationBonusPct}% profit margin for liquidators`,
    contribution: bonusScore,
    status: bonusStatus,
    note: vault.liquidationBonusPct < 3 ? 'Very low reward — liquidators may not act fast enough' : undefined,
  })

  // 3. Liquidation process
  const mechScore = vault.liquidationMechanism === 'dutch-auction' ? 0 : 10
  score += mechScore
  const mechLabel = vault.liquidationMechanism === 'dutch-auction' ? 'Dutch auction (recommended)' : 'Fixed discount'
  indicators.push({
    name: 'Liquidation process',
    desc: 'How underwater positions get sold. Dutch auction gradually lowers the price until a buyer appears — fairer and more resilient in volatile markets.',
    value: mechLabel,
    contribution: mechScore,
    status: vault.liquidationMechanism === 'dutch-auction' ? 'good' : 'caution',
    note: vault.liquidationMechanism === 'fixed-discount' ? 'Fixed-discount liquidations can be less effective in fast-moving markets' : undefined,
  })

  // 4. Past protocol losses
  let badDebtScore = 0
  let badDebtValue: string
  let badDebtStatus: 'good' | 'ok' | 'caution' | 'bad'
  if (vault.historicalBadDebtUsd === -1) {
    badDebtValue = 'No data available'
    badDebtStatus = 'ok'
  } else if (vault.historicalBadDebtUsd === 0) {
    badDebtValue = 'None — clean record'
    badDebtStatus = 'good'
  } else {
    badDebtValue = `$${vault.historicalBadDebtUsd.toLocaleString()} unrecovered`
    badDebtScore = 30
    badDebtStatus = 'bad'
  }
  score += badDebtScore
  indicators.push({
    name: 'Past protocol losses',
    desc: 'Has the protocol ever failed to recover lender funds after a liquidation? Bad debt means some depositors lost money.',
    value: badDebtValue,
    contribution: badDebtScore,
    status: badDebtStatus,
    note: vault.historicalBadDebtUsd > 0 ? 'Protocol has experienced bad debt — significant risk flag' : undefined,
  })

  // 5. Price feed manipulation risk
  const oracleScore = vault.oracleManipulationSurface === 'low' ? 0
    : vault.oracleManipulationSurface === 'medium' ? 10
    : 20
  score += oracleScore
  const oracleLabel = vault.oracleManipulationSurface === 'low' ? 'Low — hard to manipulate'
    : vault.oracleManipulationSurface === 'medium' ? 'Medium — some exposure'
    : 'High — vulnerable'
  indicators.push({
    name: 'Price feed manipulation risk',
    desc: 'How easy it is for an attacker to fake prices to trigger false liquidations or avoid real ones.',
    value: oracleLabel,
    contribution: oracleScore,
    status: vault.oracleManipulationSurface === 'low' ? 'good'
      : vault.oracleManipulationSurface === 'medium' ? 'caution' : 'bad',
  })

  return { score: Math.min(100, score), indicators }
}
