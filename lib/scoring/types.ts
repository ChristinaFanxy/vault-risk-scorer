// lib/scoring/types.ts

export type ChainId = 1 | 8453 | 42161 | 10 | 137 | 130  // Ethereum, Base, Arbitrum, Optimism, Polygon, Unichain

export type AssetClass = 'stablecoin' | 'blue-chip' | 'long-tail'
export type OracleType = 'chainlink' | 'uniswap-twap' | 'custom'
export type LiquidationMechanism = 'dutch-auction' | 'fixed-discount'
export type CuratorType = 'anonymous' | 'known-team' | 'institution'

/** Raw on-chain + API data for a vault, before scoring */
export interface VaultData {
  // Identity
  address: string
  chainId: ChainId
  protocol: 'morpho'
  name: string

  // TVL + Yield
  tvlUsd: number
  currentApyPct: number
  performanceFeePct: number | null  // e.g. 10 = 10%, null = unavailable
  deployedAt: number | null         // unix ms, null = unavailable

  // Underlying assets
  assets: Array<{
    address: string
    symbol: string
    assetClass: AssetClass
    oracleType: OracleType
    liquidityDepthUsd: number
    volatility30d: number       // decimal e.g. 0.05 = 5%
    vaultWeightPct: number
  }>

  // Liquidation rules (from on-chain via viem)
  maxLtvPct: number
  liquidationThresholdPct: number
  liquidationBonusPct: number
  liquidationMechanism: LiquidationMechanism
  historicalBadDebtUsd: number  // -1 = unavailable, 0 = none, >0 = bad debt occurred
  unrealizedBadDebtUsd: number  // on-chain detected stuck borrows not yet formally realized

  // Vault liquidity / withdrawability
  weightedUtilization: number        // 0-1, weighted avg market utilization
  totalMarketLiquidityUsd: number    // available (unborrowed) liquidity across markets (USD)

  // Oracle
  oracleManipulationSurface: 'low' | 'medium' | 'high'
  hardcodedOracleCount: number        // markets with price feeds that never change
  hardcodedOracleSymbols: string[]    // e.g. ["USR", "wstUSR"]

  // Curator
  curatorAddress: string
  curatorName: string | null     // display name from Morpho API, null if unknown
  curatorType: CuratorType
  permissionScope: 'narrow' | 'medium' | 'broad'
  timelockHours: number
  vaultsManaged: number
  incidentCount: number
  curatorBorrowsFromVault: boolean
  hasPublicAllocator: boolean    // anyone can trigger fund reallocation across markets

  /** Indicators that used placeholder data — shown in UI as "estimated" */
  placeholderFields: string[]
}

/** Score for a single risk dimension */
export interface DimensionScore {
  score: number           // 0–100, lower = safer
  indicators: Array<{
    name: string
    desc?: string          // plain-English explanation for end users
    value: string | number
    contribution: number
    status?: 'good' | 'ok' | 'caution' | 'bad'
    note?: string
    link?: string           // optional internal link for "view details"
  }>
}

/** Final composite output returned by API and used by UI */
export interface CompositeScore {
  vaultAddress: string
  chainId: ChainId
  name: string
  tvlUsd: number           // needed for top bar display
  overallScore: number     // 0–100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  label: string            // e.g. "Low Risk"
  assetRisk: DimensionScore
  liquidationRisk: DimensionScore
  curatorRisk: DimensionScore
  currentApyPct: number
  performanceFeePct: number | null
  deployedAt: number | null
  /** Indicator names that used estimated/placeholder data */
  placeholderFields: string[]
  dataFreshnessMs: number
}
