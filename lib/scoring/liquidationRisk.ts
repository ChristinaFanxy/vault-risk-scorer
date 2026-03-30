// lib/scoring/liquidationRisk.ts
import type { VaultData, DimensionScore } from './types'

// Morpho Blue liquidation incentive formula constants
const LIQUIDATION_CURSOR = 0.3
const MAX_LIQUIDATION_INCENTIVE_FACTOR = 1.15  // 15% cap

/** Compute Morpho Blue liquidation incentive from LLTV */
function computeLiquidationBonus(lltvPct: number): { bonusPct: number; capped: boolean } {
  const lltv = lltvPct / 100
  const cursor = lltv * LIQUIDATION_CURSOR
  const rawFactor = cursor < 1 ? 1 / (1 - cursor) : Infinity
  const factor = Math.min(MAX_LIQUIDATION_INCENTIVE_FACTOR, rawFactor)
  return {
    bonusPct: (factor - 1) * 100,
    capped: rawFactor > MAX_LIQUIDATION_INCENTIVE_FACTOR,
  }
}

export function scoreLiquidationRisk(vault: VaultData): DimensionScore {
  const indicators: DimensionScore['indicators'] = []
  let score = 0

  // 1. Safety buffer (LTV gap) — informational only (contribution = 0)
  // LLTV is a protocol-level parameter set per market, not a curator decision
  const buffer = vault.liquidationThresholdPct - vault.maxLtvPct
  const ltvStatus = buffer >= 10 ? 'good' : buffer >= 7 ? 'ok' : buffer >= 5 ? 'caution' : 'bad'
  indicators.push({
    name: 'Safety buffer',
    desc: 'Gap between max borrow limit and liquidation trigger. Wider = more time to react before positions are closed. This is a protocol-level parameter, not controlled by the curator.',
    value: `${buffer.toFixed(1)}% cushion (borrow up to ${vault.maxLtvPct.toFixed(1)}%, liquidated at ${vault.liquidationThresholdPct.toFixed(1)}%)`,
    contribution: 0,
    status: ltvStatus,
    note: buffer < 5 ? 'Very thin buffer — liquidators may not have enough time to act in volatile markets' : undefined,
  })

  // 2. Liquidator reward — informational only (contribution = 0)
  // Computed from LLTV using Morpho Blue's on-chain formula
  const { bonusPct, capped } = computeLiquidationBonus(vault.liquidationThresholdPct)
  const cappedLabel = capped ? ' (capped)' : ''
  indicators.push({
    name: 'Liquidator reward',
    desc: `Bonus paid to liquidators. Morpho Blue formula: min(15%, 1/(1 − LLTV×0.3) − 1). Higher reward = faster liquidation response.`,
    value: `${bonusPct.toFixed(1)}%${cappedLabel} profit margin`,
    contribution: 0,
    status: 'ok',
  })

  // 3. Liquidation process — informational only (contribution = 0)
  // Morpho Blue always uses Dutch auction
  indicators.push({
    name: 'Liquidation process',
    desc: 'How underwater positions get sold. Dutch auction gradually lowers the price until a buyer appears — fairer and more resilient in volatile markets.',
    value: 'Dutch auction (Morpho Blue standard)',
    contribution: 0,
    status: 'good',
  })

  return { score: Math.min(100, score), indicators }
}
