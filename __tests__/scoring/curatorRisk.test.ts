// __tests__/scoring/curatorRisk.test.ts
import { scoreCuratorRisk } from '@/lib/scoring/curatorRisk'
import type { VaultData } from '@/lib/scoring/types'

const trusted: VaultData = {
  address: '0x1234', chainId: 1, protocol: 'morpho', name: 'Test',
  tvlUsd: 10_000_000, currentApyPct: 5,
  apy7dAvg: 5, apy30dAvg: 5, apy90dAvg: 5, apyHistory: [], assets: [],
  weightedUtilization: 0, totalMarketLiquidityUsd: 100_000_000,
  maxLtvPct: 80, liquidationThresholdPct: 85, liquidationBonusPct: 5,
  liquidationMechanism: 'dutch-auction', historicalBadDebtUsd: 0,
  oracleManipulationSurface: 'low',
  hardcodedOracleCount: 0, hardcodedOracleSymbols: [],
  curatorName: null, curatorAddress: '0xcurator', curatorType: 'institution',
  permissionScope: 'narrow', timelockHours: 72,
  vaultsManaged: 10, incidentCount: 0, curatorBorrowsFromVault: false,
  placeholderFields: [],
}

describe('scoreCuratorRisk', () => {
  it('returns low score for institution + narrow scope + 72h timelock + no incidents', () => {
    const result = scoreCuratorRisk(trusted)
    expect(result.score).toBeLessThan(15)
    expect(result.indicators).toHaveLength(5)
  })

  it('penalizes anonymous curator', () => {
    const anon = { ...trusted, curatorType: 'anonymous' as const }
    expect(scoreCuratorRisk(anon).score).toBeGreaterThan(scoreCuratorRisk(trusted).score + 20)
  })

  it('penalizes broad permission scope', () => {
    const broad = { ...trusted, permissionScope: 'broad' as const }
    expect(scoreCuratorRisk(broad).score).toBeGreaterThan(scoreCuratorRisk(trusted).score)
  })

  it('penalizes no timelock', () => {
    const noLock = { ...trusted, timelockHours: 0 }
    expect(scoreCuratorRisk(noLock).score).toBeGreaterThan(scoreCuratorRisk(trusted).score)
  })

  it('penalizes conflict of interest', () => {
    const coi = { ...trusted, curatorBorrowsFromVault: true }
    expect(scoreCuratorRisk(coi).score).toBeGreaterThan(scoreCuratorRisk(trusted).score)
  })
})
