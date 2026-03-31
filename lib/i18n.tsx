'use client'
import { createContext, useContext, type ReactNode } from 'react'

export const t = {
  // Home page
  title: 'Morpho Vault Risk Scorer',
  subtitle: 'Assess curator vault risk before you deposit. Three dimensions, one grade.',
  chainNotice: 'Currently supports Ethereum, Base, and Arbitrum.',
  featuredVaults: 'Featured Vaults',
  searchPlaceholder: 'Paste vault address or Morpho URL',
  analyze: 'Analyze',
  detecting: 'Detecting\u2026',
  searchError: 'Could not find a vault address \u2014 paste a 0x address or a Morpho vault URL',
  notFound: 'Vault not found on Ethereum, Base, or Arbitrum',
  networkError: 'Network error \u2014 please try again',
  noVaults: 'No featured vaults available.',

  // Vault detail
  backToSearch: '\u2190 Back to search',
  overallRisk: 'Overall Risk',
  lowerIsSafer: 'lower = safer',
  ofComposite: 'of composite',
  infoOnly: 'Informational only \u2014 not scored',
  refOnly: 'Reference only \u2014 not included in score',
  viewDetails: 'View details \u2192',
  yield: 'Yield',
  currentApy: 'Current APY',
  performanceFee: 'Performance Fee',
  deployed: 'Deployed',
  notAvailable: 'N/A',
  noData: 'No data',
  estimated: 'estimated',

  // Risk dimensions
  assetRisk: 'Underlying Asset Risk',
  curatorRisk: 'Curator Risk',
  liquidationRisk: 'Liquidation Rules Risk',

  // Curator detail
  curatorBadDebtHistory: 'Curator Bad Debt History',
  realizedBadDebt: 'Realized Bad Debt',
  unrealizedBadDebt: 'Unrealized Bad Debt',
  historicalVaults: 'Historical Vaults',
  none: 'None',
  stuckBorrows: 'Stuck borrows detected on-chain',
  cleanRecord: 'Clean record',
  noBadDebt: 'No bad debt events found across any chain',
  badDebtEvents: 'Bad Debt Events',
  badDebtEventsDesc: 'Sorted by amount (descending). Data from The Graph \u2014 immutable on-chain records.',
  market: 'Market',
  chain: 'Chain',
  badDebtUsd: 'Bad Debt (USD)',
  unrealizedDetected: 'Unrealized Bad Debt Detected',
  unrealizedDesc: (amt: string) => `${amt} in stuck borrows found across historical markets. These are markets with >97% utilization and less than $10K remaining liquidity where this curator's vaults still have supply positions but borrowers have not repaid. The protocol has not formally "realized" this as bad debt yet, but the funds are effectively locked.`,
  dataSource: 'Data source: The Graph Morpho Blue subgraph (immutable on-chain data)',
  sharedMarkets: 'Shared markets may attribute the same bad debt to multiple curators.',

  // Leaderboard
  leaderboard: 'Curator Leaderboard',
  leaderboardSubtitle: 'All Morpho curators ranked by composite score across 10 chains.',
  viewLeaderboard: 'View Curator Leaderboard →',
  refresh: 'Refresh',
  refreshing: 'Refreshing...',
  score: 'Score',
  scale: 'Scale',
  safety: 'Safety',
  governance: 'Gov',
  assetQuality: 'Asset',
  curator: 'Curator',
  avgApy: 'Avg APY',
  tvl: 'TVL',

  // Footer
  disclaimer: 'For informational purposes only. Not investment advice.',

  // Grades
  gradeA: 'Low Risk',
  gradeB: 'Moderate Risk',
  gradeC: 'Elevated Risk',
  gradeD: 'High Risk',
  gradeF: 'Very High Risk',
}

export type Translations = typeof t

// Minimal context that just provides the static English translations
const LanguageContext = createContext<{ t: Translations }>({ t })

export function LanguageProvider({ children }: { children: ReactNode }) {
  return (
    <LanguageContext.Provider value={{ t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
