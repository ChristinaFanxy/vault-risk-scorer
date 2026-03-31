// lib/thegraph.ts
// Historical bad debt queries via The Graph Morpho Blue subgraph.
// Unlike the Morpho API (which only shows current state), subgraph data
// is immutable — deleted vaults / removed markets can't erase bad debt history.
import type { ChainId } from '@/lib/scoring/types'

const MORPHO_SUBGRAPH: Record<number, string | undefined> = {
  1: process.env.MORPHO_SUBGRAPH_MAINNET,
  8453: process.env.MORPHO_SUBGRAPH_BASE,
  42161: process.env.MORPHO_SUBGRAPH_ARBITRUM,
  10: process.env.MORPHO_SUBGRAPH_OPTIMISM,
  137: process.env.MORPHO_SUBGRAPH_POLYGON,
  130: process.env.MORPHO_SUBGRAPH_UNICHAIN,
}

// Step 1: Find all market IDs ever associated with a curator's MetaMorpho vaults.
// Query both `curator` and `owner` fields — many curators (e.g. MEV Capital) leave
// the on-chain curator field as zero and operate directly as owner.
const CURATOR_MARKETS_QUERY = `
  query CuratorMarkets($curator: String!, $skip: Int!) {
    byCurator: metaMorphoMarkets(
      first: 1000
      skip: $skip
      where: { metaMorpho_: { curator: $curator } }
    ) {
      market { id }
      metaMorpho { id }
    }
    byOwner: metaMorphoMarkets(
      first: 1000
      skip: $skip
      where: { metaMorpho_: { owner: $curator } }
    ) {
      market { id }
      metaMorpho { id }
    }
  }
`

// Step 2: Find all bad debt events across the protocol, then filter by market IDs client-side.
// The Graph doesn't support `where: { market_in: [...] }` with 200+ IDs efficiently,
// so we fetch all events (there are < 1000 total on Morpho Blue) and filter in JS.
const ALL_BAD_DEBT_QUERY = `
  query AllBadDebt($skip: Int!) {
    badDebtRealizations(first: 1000, skip: $skip, orderBy: badDebtUSD, orderDirection: desc) {
      badDebtUSD
      market { id }
    }
  }
`

export interface BadDebtEvent {
  marketId: string
  badDebtUsd: number
  chainId: ChainId
}

export interface CuratorBadDebtHistory {
  /** Total bad debt USD across all markets the curator has ever managed */
  totalBadDebtUsd: number
  /** Number of distinct bad debt events */
  eventCount: number
  /** Number of distinct markets that had bad debt */
  affectedMarketCount: number
  /** Number of vaults the curator has managed (including closed ones) */
  historicalVaultCount: number
  /** Individual bad debt events with market ID, amount, and chain */
  events: BadDebtEvent[]
  /** All vault addresses this curator has managed (for position lookups) */
  allVaultAddresses: string[]
  /** All market IDs ever associated with this curator's vaults, per chain */
  allMarketIds: Array<{ marketId: string; chainId: ChainId }>
}

async function subgraphQuery<T>(
  chainId: ChainId,
  query: string,
  variables: Record<string, unknown>
): Promise<T | null> {
  const url = MORPHO_SUBGRAPH[chainId]
  if (!url) return null

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 600 },  // cache 10 min — historical data changes slowly
  })
  if (!res.ok) return null
  const json = await res.json()
  if (json.errors?.length) return null
  return json.data as T
}

const ALL_CHAINS: ChainId[] = [1, 8453, 42161, 10, 137, 130]

/**
 * Queries a single chain's subgraph for curator vault/market/bad-debt data.
 * Accepts multiple curator addresses (same curator may use different addresses per chain).
 */
async function fetchCuratorBadDebtForChain(
  curatorAddresses: string[],
  chainId: ChainId
): Promise<{ marketIds: Set<string>; vaultIds: Set<string>; totalBadDebtUsd: number; eventCount: number; affectedMarkets: Set<string>; events: BadDebtEvent[] } | null> {
  type MarketEntry = { market: { id: string }; metaMorpho: { id: string } }
  const marketIds = new Set<string>()
  const vaultIds = new Set<string>()

  // Step 1: Get all market IDs from this curator's vaults, querying each address
  for (const curator of curatorAddresses) {
    let skip = 0
    while (true) {
      const data = await subgraphQuery<{
        byCurator: MarketEntry[]
        byOwner: MarketEntry[]
      }>(chainId, CURATOR_MARKETS_QUERY, { curator, skip })

      if (!data) return null  // subgraph unavailable for this chain
      const combined = [...data.byCurator, ...data.byOwner]
      if (combined.length === 0) break
      for (const mm of combined) {
        marketIds.add(mm.market.id)
        vaultIds.add(mm.metaMorpho.id)
      }
      if (data.byCurator.length < 1000 && data.byOwner.length < 1000) break
      skip += 1000
    }
  }

  // Step 2: Get all bad debt events and filter by this curator's markets
  let totalBadDebtUsd = 0
  let eventCount = 0
  const affectedMarkets = new Set<string>()
  const events: BadDebtEvent[] = []
  let bdSkip = 0
  while (true) {
    const data = await subgraphQuery<{
      badDebtRealizations: Array<{ badDebtUSD: string; market: { id: string } }>
    }>(chainId, ALL_BAD_DEBT_QUERY, { skip: bdSkip })

    if (!data || data.badDebtRealizations.length === 0) break
    for (const event of data.badDebtRealizations) {
      if (marketIds.has(event.market.id)) {
        const usd = parseFloat(event.badDebtUSD)
        if (usd > 0) {
          totalBadDebtUsd += usd
          eventCount++
          affectedMarkets.add(event.market.id)
          events.push({ marketId: event.market.id, badDebtUsd: usd, chainId })
        }
      }
    }
    if (data.badDebtRealizations.length < 1000) break
    bdSkip += 1000
  }

  return { marketIds, vaultIds, totalBadDebtUsd, eventCount, affectedMarkets, events }
}

/**
 * Queries The Graph for a curator's complete bad debt history across ALL chains
 * and ALL markets they have ever managed — including deleted vaults and removed markets.
 * Accepts multiple addresses (same curator may use different addresses on different chains).
 * Returns null if no subgraph is available.
 */
export async function fetchCuratorBadDebtHistory(
  curatorAddresses: string[]
): Promise<CuratorBadDebtHistory | null> {
  const addrs = curatorAddresses.map(a => a.toLowerCase())

  // Query all supported chains in parallel, passing all curator addresses
  const results = await Promise.all(
    ALL_CHAINS.map(cid => fetchCuratorBadDebtForChain(addrs, cid).catch(() => null))
  )

  // Merge results across chains
  let totalBadDebtUsd = 0
  let eventCount = 0
  const allVaultIds = new Set<string>()
  const allAffectedMarkets = new Set<string>()
  const allEvents: BadDebtEvent[] = []
  const allMarketIds: Array<{ marketId: string; chainId: ChainId }> = []
  let hasAnyData = false

  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (!r) continue
    hasAnyData = true
    totalBadDebtUsd += r.totalBadDebtUsd
    eventCount += r.eventCount
    for (const v of r.vaultIds) allVaultIds.add(v)
    for (const m of r.affectedMarkets) allAffectedMarkets.add(m)
    allEvents.push(...r.events)
    const chainId = ALL_CHAINS[i]
    for (const mid of r.marketIds) allMarketIds.push({ marketId: mid, chainId })
  }

  if (!hasAnyData) return null

  // Sort by amount descending
  allEvents.sort((a, b) => b.badDebtUsd - a.badDebtUsd)

  return {
    totalBadDebtUsd,
    eventCount,
    affectedMarketCount: allAffectedMarkets.size,
    historicalVaultCount: allVaultIds.size,
    events: allEvents,
    allVaultAddresses: [...allVaultIds],
    allMarketIds,
  }
}

/**
 * Legacy function — returns total bad debt for a vault from the subgraph.
 * Kept for backward compatibility; prefer fetchCuratorBadDebtHistory for curator-level data.
 */
export async function fetchMorphoBadDebt(
  vaultAddress: string,
  chainId: ChainId
): Promise<number> {
  // Use the curator markets approach: find this vault's markets, then check bad debt
  const vault = vaultAddress.toLowerCase()
  const data = await subgraphQuery<{
    metaMorphoMarkets: Array<{ market: { id: string } }>
  }>(chainId, `
    query VaultMarkets($vault: String!) {
      metaMorphoMarkets(first: 1000, where: { metaMorpho: $vault }) {
        market { id }
      }
    }
  `, { vault })

  if (!data || data.metaMorphoMarkets.length === 0) return -1

  const marketIds = new Set(data.metaMorphoMarkets.map(m => m.market.id))

  // Fetch all bad debt and filter
  let total = 0
  let skip = 0
  while (true) {
    const bdData = await subgraphQuery<{
      badDebtRealizations: Array<{ badDebtUSD: string; market: { id: string } }>
    }>(chainId, ALL_BAD_DEBT_QUERY, { skip })

    if (!bdData || bdData.badDebtRealizations.length === 0) break
    for (const e of bdData.badDebtRealizations) {
      if (marketIds.has(e.market.id)) {
        total += parseFloat(e.badDebtUSD)
      }
    }
    if (bdData.badDebtRealizations.length < 1000) break
    skip += 1000
  }

  return total
}
