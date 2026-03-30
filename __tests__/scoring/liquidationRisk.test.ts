// __tests__/scoring/liquidationRisk.test.ts
import { scoreLiquidationRisk } from '@/lib/scoring/liquidationRisk'
import type { VaultData } from '@/lib/scoring/types'

const safeVault: VaultData = {
  address: '0x1234', chainId: 1, protocol: 'morpho', name: 'Safe',
  tvlUsd: 10_000_000, currentApyPct: 5,
  performanceFeePct: 10, deployedAt: 1700000000000, assets: [],
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
  it('returns score 0 with 3 informational indicators (all contribution=0)', () => {
    const result = scoreLiquidationRisk(safeVault)
    expect(result.score).toBe(0)
    expect(result.indicators).toHaveLength(3)
    expect(result.indicators.every(i => i.contribution === 0)).toBe(true)
  })

  it('includes Safety buffer, Liquidator reward, and Liquidation process', () => {
    const result = scoreLiquidationRisk(safeVault)
    const names = result.indicators.map(i => i.name)
    expect(names).toEqual(['Safety buffer', 'Liquidator reward', 'Liquidation process'])
  })

  it('shows good status for wide safety buffer (10%)', () => {
    const result = scoreLiquidationRisk(safeVault)
    const buffer = result.indicators.find(i => i.name === 'Safety buffer')!
    expect(buffer.status).toBe('good')
    expect(buffer.contribution).toBe(0)
  })

  it('shows bad status for thin safety buffer (<5%)', () => {
    const thin = { ...safeVault, maxLtvPct: 82, liquidationThresholdPct: 85 }
    const result = scoreLiquidationRisk(thin)
    const buffer = result.indicators.find(i => i.name === 'Safety buffer')!
    expect(buffer.status).toBe('bad')
  })
})
