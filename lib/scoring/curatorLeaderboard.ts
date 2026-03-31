export interface CuratorAggregated {
  curatorAddress: string
  curatorName: string | null
  verified: boolean
  totalTvlUsd: number
  vaultCount: number
  chainCount: number
  weightedApyPct: number
  avgFeePct: number | null
  totalBadDebtUsd: number       // realized (from The Graph)
  unrealizedBadDebtUsd: number  // on-chain detected stuck borrows
  badDebtToTvlRatio: number     // (realized + unrealized) / TVL
  affectedMarketCount: number
  hasOracleWarning: boolean
  avgTimelockHours: number
  hasGuardian: boolean
  hasCuratorBorrowing: boolean
  hasPublicAllocator: boolean
  stablecoinPct: number
  longTailPct: number
  allChainlink: boolean
  weightedUtilization: number
}

export interface CuratorRanking extends CuratorAggregated {
  rank: number
  compositeScore: number
  scaleScore: number
  yieldScore: number
  safetyScore: number
  governanceScore: number
  assetQualityScore: number
}

const WEIGHTS = { scale: 0.10, yield: 0.20, safety: 0.40, governance: 0.20, assetQuality: 0.10 }

function clamp(v: number): number { return Math.round(Math.max(0, Math.min(100, v))) }

export function scoreScale(c: CuratorAggregated): number {
  const tvl = c.totalTvlUsd >= 500_000_000 ? 100 : c.totalTvlUsd >= 100_000_000 ? 80 : c.totalTvlUsd >= 10_000_000 ? 50 : c.totalTvlUsd >= 1_000_000 ? 30 : 10
  const vaults = c.vaultCount >= 50 ? 100 : c.vaultCount >= 20 ? 70 : c.vaultCount >= 5 ? 40 : 20
  const chains = c.chainCount >= 5 ? 100 : c.chainCount >= 3 ? 70 : c.chainCount >= 2 ? 50 : 30
  return clamp(tvl * 0.5 + vaults * 0.3 + chains * 0.2)
}

export function scoreYield(c: CuratorAggregated): number {
  const apy = c.weightedApyPct >= 10 ? 100 : c.weightedApyPct >= 5 ? 70 : c.weightedApyPct >= 2 ? 50 : 20
  const fee = c.avgFeePct === null ? 50 : c.avgFeePct <= 0 ? 100 : c.avgFeePct <= 5 ? 80 : c.avgFeePct <= 10 ? 60 : 20
  return clamp(apy * 0.6 + fee * 0.4)
}

export function scoreSafety(c: CuratorAggregated): number {
  const totalBd = c.totalBadDebtUsd + c.unrealizedBadDebtUsd
  const bd = totalBd <= 0 ? 100 : totalBd < 1_000 ? 80 : totalBd < 50_000 ? 50 : 20
  const ratio = c.badDebtToTvlRatio <= 0 ? 100 : c.badDebtToTvlRatio < 0.0001 ? 80 : c.badDebtToTvlRatio < 0.001 ? 50 : 20
  const markets = c.affectedMarketCount <= 0 ? 100 : c.affectedMarketCount <= 2 ? 70 : c.affectedMarketCount <= 5 ? 40 : 20
  const oracle = c.hasOracleWarning ? 30 : 100
  return clamp(bd * 0.35 + ratio * 0.35 + markets * 0.2 + oracle * 0.1)
}

export function scoreGovernance(c: CuratorAggregated): number {
  const identity = c.verified ? 100 : c.curatorName ? 60 : 10
  const timelock = c.avgTimelockHours >= 72 ? 100 : c.avgTimelockHours >= 24 ? 70 : c.avgTimelockHours >= 1 ? 40 : 10
  const guardian = c.hasGuardian ? 100 : 30
  const coi = c.hasCuratorBorrowing ? 20 : 100
  const pa = c.hasPublicAllocator ? 50 : 100
  return clamp(identity * 0.3 + timelock * 0.25 + guardian * 0.2 + coi * 0.15 + pa * 0.1)
}

export function scoreAssetQuality(c: CuratorAggregated): number {
  const assetClass = c.stablecoinPct >= 80 ? 100 : c.longTailPct <= 10 ? 70 : 40
  const oracleType = c.allChainlink ? 100 : 50
  const util = c.weightedUtilization < 0.70 ? 100 : c.weightedUtilization < 0.85 ? 70 : c.weightedUtilization < 0.95 ? 40 : 10
  return clamp(assetClass * 0.4 + oracleType * 0.3 + util * 0.3)
}

export function computeLeaderboardScore(c: CuratorAggregated): number {
  return clamp(
    scoreScale(c) * WEIGHTS.scale +
    scoreYield(c) * WEIGHTS.yield +
    scoreSafety(c) * WEIGHTS.safety +
    scoreGovernance(c) * WEIGHTS.governance +
    scoreAssetQuality(c) * WEIGHTS.assetQuality
  )
}

export function rankCurators(curators: CuratorAggregated[]): CuratorRanking[] {
  const ranked = curators.map(c => ({
    ...c,
    rank: 0,
    compositeScore: computeLeaderboardScore(c),
    scaleScore: scoreScale(c),
    yieldScore: scoreYield(c),
    safetyScore: scoreSafety(c),
    governanceScore: scoreGovernance(c),
    assetQualityScore: scoreAssetQuality(c),
  }))
  ranked.sort((a, b) => b.compositeScore - a.compositeScore)
  ranked.forEach((r, i) => { r.rank = i + 1 })
  return ranked
}
