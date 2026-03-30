// __tests__/scoring/liquidationRisk.test.ts
import { scoreLiquidationRisk } from '@/lib/scoring/liquidationRisk'
import type { VaultData } from '@/lib/scoring/types'

const safeVault: VaultData = {
  address: '0x1234', chainId: 1, protocol: 'morpho', name: 'Safe',
  tvlUsd: 10_000_000, currentApyPct: 5,
  apy7dAvg: 5, apy30dAvg: 5, apy90dAvg: 5, apyHistory: [], assets: [],
  weightedUtilization: 0, totalMarketLiquidityUsd: 100_000_000,
  maxLtvPct: 75, liquidationThresholdPct: 85,  // 10% buffer
  liquidationBonusPct: 8, liquidationMechanism: 'dutch-auction',
  historicalBadDebtUsd: 0, unrealizedBadDebtUsd: 0, oracleManipulationSurface: 'low',
  hardcodedOracleCount: 0, hardcodedOracleSymbols: [],
  curatorName: null, curatorAddress: '0x0', curatorType: 'institution', permissionScope: 'narrow',
  timelockHours: 72, vaultsManaged: 5, incidentCount: 0, curatorBorrowsFromVault: false, hasPublicAllocator: false,
  placeholderFields: [],
}

describe('scoreLiquidationRisk', () => {
  it('returns low score for wide buffer + dutch auction + no bad debt', () => {
    const result = scoreLiquidationRisk(safeVault)
    expect(result.score).toBeLessThan(25)
    expect(result.indicators).toHaveLength(5)
  })

  it('penalizes thin LTV buffer (<5%)', () => {
    const thin = { ...safeVault, maxLtvPct: 82, liquidationThresholdPct: 85 }
    expect(scoreLiquidationRisk(thin).score).toBeGreaterThan(scoreLiquidationRisk(safeVault).score)
  })

  it('penalizes fixed-discount liquidation mechanism', () => {
    const fixed = { ...safeVault, liquidationMechanism: 'fixed-discount' as const }
    expect(scoreLiquidationRisk(fixed).score).toBeGreaterThan(scoreLiquidationRisk(safeVault).score)
  })

  it('gives large penalty for historical bad debt', () => {
    const badDebt = { ...safeVault, historicalBadDebtUsd: 50_000 }
    expect(scoreLiquidationRisk(badDebt).score).toBeGreaterThan(scoreLiquidationRisk(safeVault).score + 20)
  })

  it('shows N/A and no penalty when bad debt data is unavailable (returns -1)', () => {
    const unknown = { ...safeVault, historicalBadDebtUsd: -1 }
    const indicator = scoreLiquidationRisk(unknown).indicators.find(i => i.name === 'Historical bad debt')!
    expect(indicator.value).toBe('N/A')
    expect(indicator.contribution).toBe(0)
  })

  it('safe vault with wide buffer scores 0 for LTV buffer indicator', () => {
    const result = scoreLiquidationRisk(safeVault)
    const ltvIndicator = result.indicators.find(i => i.name === 'LTV buffer')!
    expect(ltvIndicator.contribution).toBe(0)  // 10% buffer → 0 points
  })
})
