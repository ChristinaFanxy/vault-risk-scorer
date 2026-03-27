// __tests__/scoring/composite.test.ts
import { computeCompositeScore, scoreToGrade, scoreVault } from '@/lib/scoring/composite'
import type { VaultData } from '@/lib/scoring/types'

describe('scoreToGrade', () => {
  it.each([
    [0, 'A'], [20, 'A'],
    [21, 'B'], [40, 'B'],
    [41, 'C'], [60, 'C'],
    [61, 'D'], [80, 'D'],
    [81, 'F'], [100, 'F'],
  ])('score %i → grade %s', (score, grade) => {
    expect(scoreToGrade(score).grade).toBe(grade)
  })
})

describe('computeCompositeScore', () => {
  it('weights dimensions 40/35/25', () => {
    // 100×0.4 + 0×0.35 + 0×0.25 = 40
    expect(computeCompositeScore(
      { score: 100, indicators: [] },
      { score: 0, indicators: [] },
      { score: 0, indicators: [] },
    )).toBe(40)
  })

  it('returns 50 when all dimensions score 50', () => {
    expect(computeCompositeScore(
      { score: 50, indicators: [] },
      { score: 50, indicators: [] },
      { score: 50, indicators: [] },
    )).toBe(50)
  })
})

describe('scoreVault', () => {
  const vault: VaultData = {
    address: '0x1234', chainId: 1, protocol: 'morpho', name: 'Test',
    tvlUsd: 5_000_000, currentApyPct: 4.5,
    apy7dAvg: 4.5, apy30dAvg: 4.5, apy90dAvg: 4.5,
    apyHistory: [{ timestamp: 1, apyPct: 4.5 }, { timestamp: 2, apyPct: 4.5 }],
    assets: [{ address: '0xa', symbol: 'USDC', assetClass: 'stablecoin', oracleType: 'chainlink', liquidityDepthUsd: 50_000_000, volatility30d: 0.001, vaultWeightPct: 100 }],
    maxLtvPct: 80, liquidationThresholdPct: 90, liquidationBonusPct: 8,
    liquidationMechanism: 'dutch-auction', historicalBadDebtUsd: 0,
    oracleManipulationSurface: 'low',
    curatorAddress: '0xc', curatorType: 'institution', permissionScope: 'narrow',
    timelockHours: 72, vaultsManaged: 5, incidentCount: 0, curatorBorrowsFromVault: false,
    placeholderFields: [],
  }

  it('returns a CompositeScore with grade, tvlUsd, and name', () => {
    const result = scoreVault(vault)
    expect(['A', 'B', 'C', 'D', 'F']).toContain(result.grade)
    expect(result.tvlUsd).toBe(5_000_000)
    expect(result.name).toBe('Test')
    expect(result.overallScore).toBeGreaterThanOrEqual(0)
    expect(result.overallScore).toBeLessThanOrEqual(100)
  })
})
