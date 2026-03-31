import {
  scoreScale, scoreYield, scoreSafety, scoreGovernance, scoreAssetQuality,
  computeLeaderboardScore, type CuratorAggregated
} from '@/lib/scoring/curatorLeaderboard'

const baseCurator: CuratorAggregated = {
  curatorAddress: '0xcurator',
  curatorName: 'Test Curator',
  verified: true,
  totalTvlUsd: 100_000_000,
  vaultCount: 20,
  chainCount: 3,
  weightedApyPct: 5,
  avgFeePct: 10,
  totalBadDebtUsd: 0,
  badDebtToTvlRatio: 0,
  affectedMarketCount: 0,
  hasOracleWarning: false,
  avgTimelockHours: 72,
  hasGuardian: true,
  hasCuratorBorrowing: false,
  hasPublicAllocator: false,
  stablecoinPct: 80,
  longTailPct: 0,
  allChainlink: true,
  weightedUtilization: 0.5,
}

describe('scoreScale', () => {
  it('scores high for large TVL + many vaults + multi-chain', () => {
    expect(scoreScale(baseCurator)).toBeGreaterThan(70)
  })
  it('scores low for tiny curator', () => {
    expect(scoreScale({ ...baseCurator, totalTvlUsd: 500_000, vaultCount: 2, chainCount: 1 })).toBeLessThan(30)
  })
})

describe('scoreSafety', () => {
  it('scores 100 for zero bad debt', () => {
    expect(scoreSafety(baseCurator)).toBe(100)
  })
  it('penalizes bad debt', () => {
    expect(scoreSafety({ ...baseCurator, totalBadDebtUsd: 100_000, badDebtToTvlRatio: 0.001, affectedMarketCount: 3 })).toBeLessThan(50)
  })
})

describe('computeLeaderboardScore', () => {
  it('returns weighted composite 0-100', () => {
    const score = computeLeaderboardScore(baseCurator)
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})
