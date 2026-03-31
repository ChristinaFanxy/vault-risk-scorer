// lib/morphoApi.ts
// Morpho Blue public GraphQL API — no API key required.
const MORPHO_API = 'https://blue-api.morpho.org/graphql'

export interface MorphoV2Data {
  name: string
  tvlUsd: number
  currentApyPct: number
  deployedAt: number | null  // unix ms
  performanceFeePct: number | null  // e.g. 10 = 10%

  curatorAddress: string    // owner address (V2 has no separate curator field)
  curatorName: string | null
  curatorVerified: boolean
  // The most critical timelock: addAdapter controls what new strategies can be added
  addAdapterTimelockSeconds: number
  vaultsManaged: number     // V2 vaults managed by this curator
  warnings: string[]

  // Markets from MarketV1 caps (subset of caps that route to Morpho Blue v1 markets)
  markets: Array<{
    lltv: string            // uint256 as string, 1e18 = 100%
    collateralAddress: string
    collateralSymbol: string
    oracleAddress: string
    supplyAssetsUsd: number
    realizedBadDebtUsd: number
    hasOracleWarning: boolean
  }>
  hasAdapterCaps: boolean   // true if any caps are opaque adapter-type (no market data)
  weightedUtilization: number        // 0-1, weighted avg market utilization
  totalMarketLiquidityUsd: number    // available (unborrowed) liquidity across markets (USD)
}

export interface MorphoYieldData {
  tvlUsd: number
  currentApyPct: number
  performanceFeePct: number | null
  deployedAt: number | null  // unix ms
}

export interface MorphoCuratorData {
  vaultName: string | null           // API display name (more accurate than on-chain name())
  curatorAddress: string
  curatorName: string | null        // e.g. "Steakhouse Financial"
  curatorVerified: boolean          // Morpho-verified curator
  timelockSeconds: number           // on-chain timelock value
  vaultsManaged: number             // total vaults by same curator
  warnings: string[]                // warning type strings
  guardian: string                  // zero address = no guardian
  owner: string                     // vault owner address
  incidentCount: number             // markets with realizedBadDebt > $1
  curatorBorrowsFromVault: boolean  // curator has open borrow position in vault markets
  weightedAvgLltvPct: number        // supply-weighted avg LLTV across non-idle markets
  totalRealizedBadDebtUsd: number   // sum of realizedBadDebt across all vault markets
  hasOracleWarning: boolean         // any market has incorrect_oracle_configuration
  hasPublicAllocator: boolean       // anyone can trigger fund reallocation
}

const VAULT_ALLOCATION_QUERY = `
  query VaultAllocation($address: String!, $chainId: Int!) {
    vault: vaultByAddress(address: $address, chainId: $chainId) {
      liquidity { underlying }
      state {
        allocation {
          supplyAssetsUsd
          market {
            uniqueKey
            lltv
            collateralAsset { address symbol }
            oracle {
              address
              data { ... on MorphoChainlinkOracleV2Data { baseFeedOne { address pair } } }
            }
            state { utilization liquidityAssetsUsd }
          }
        }
      }
    }
  }
`

const VAULT_YIELD_QUERY = `
  query VaultYield($address: String!, $chainId: Int!) {
    vault: vaultByAddress(address: $address, chainId: $chainId) {
      state {
        totalAssetsUsd
        netApy
        fee
      }
      creationTimestamp
    }
  }
`

const VAULT_CURATOR_QUERY = `
  query VaultCurator($address: String!, $chainId: Int!) {
    vault: vaultByAddress(address: $address, chainId: $chainId) {
      name
      state {
        curator
        timelock
        guardian
        owner
        curators { name verified addresses { address } }
        allocation {
          supplyAssetsUsd
          market {
            uniqueKey
            lltv
            realizedBadDebt { usd }
            warnings { type }
          }
        }
      }
      warnings { type level }
      publicAllocatorConfig {
        fee
        flowCaps { market { uniqueKey } maxIn maxOut }
      }
    }
  }
`

const CURATOR_POSITIONS_QUERY = `
  query CuratorPositions($userAddress: String!, $marketKeys: [String!]!) {
    marketPositions(where: { userAddress_in: [$userAddress], marketUniqueKey_in: $marketKeys }) {
      items { state { borrowAssets } }
    }
  }
`

const CURATOR_ALL_ADDRESSES_QUERY = `
  query CuratorAddresses($addresses: [String!]!) {
    curators(where: { address_in: $addresses }) {
      items { name addresses { address chainId } }
    }
  }
`

/**
 * Given one curator address, find ALL addresses this curator uses across all chains.
 * Uses Morpho's curator registry to resolve the full identity.
 * Returns deduplicated lowercase addresses.
 */
export async function fetchCuratorAllAddresses(knownAddress: string): Promise<string[]> {
  try {
    const { curators } = await gql<{
      curators: { items: Array<{ name: string; addresses: Array<{ address: string; chainId: number }> }> }
    }>(CURATOR_ALL_ADDRESSES_QUERY, { addresses: [knownAddress] })

    if (curators.items.length === 0) return [knownAddress.toLowerCase()]

    const allAddrs = new Set<string>()
    for (const curator of curators.items) {
      for (const a of curator.addresses) {
        allAddrs.add(a.address.toLowerCase())
      }
    }
    return [...allAddrs]
  } catch {
    return [knownAddress.toLowerCase()]
  }
}

const VAULTS_BY_CURATOR_QUERY = `
  query VaultsByCurator($curatorAddresses: [String!]!, $chainIds: [Int!]!) {
    byCurator: vaults(where: { curatorAddress_in: $curatorAddresses, chainId_in: $chainIds }) {
      items { address }
    }
    byOwner: vaults(where: { ownerAddress_in: $curatorAddresses, chainId_in: $chainIds }) {
      items { address }
    }
  }
`

const VAULT_V2_QUERY = `
  query VaultV2($address: String!, $chainId: Int!) {
    vault: vaultV2ByAddress(address: $address, chainId: $chainId) {
      address name totalAssetsUsd netApy avgNetApy creationTimestamp performanceFee
      owner { address }
      curators { items { name verified addresses { address } } }
      warnings { type level }
      timelocks { selector functionName duration }
      caps { items {
        type allocation
        data {
          ... on MarketV1CapData {
            market {
              lltv
              realizedBadDebt { usd }
              warnings { type }
              collateralAsset { address symbol }
              oracle { address }
              state { utilization liquidityAssetsUsd }
            }
          }
          ... on AdapterCapData {
            adapter {
              ... on MetaMorphoAdapter {
                metaMorpho { address }
              }
            }
          }
        }
      }}
    }
  }
`

const METAMORPHO_MARKETS_QUERY = `
  query MetaMorphoMarkets($address: String!, $chainId: Int!) {
    vault: vaultByAddress(address: $address, chainId: $chainId) {
      state {
        allocation {
          supplyAssetsUsd
          market {
            lltv
            realizedBadDebt { usd }
            warnings { type }
            collateralAsset { address symbol }
            oracle { address }
            state { utilization liquidityAssetsUsd }
          }
        }
      }
    }
  }
`

const V2_VAULTS_BY_CURATOR_QUERY = `
  query V2VaultsByCurator($curatorAddresses: [Address!]!, $chainIds: [Int!]!) {
    byCurator: vaultV2s(where: { curatorAddress_in: $curatorAddresses, chainId_in: $chainIds }) {
      items { address }
    }
    byOwner: vaultV2s(where: { ownerAddress_in: $curatorAddresses, chainId_in: $chainIds }) {
      items { address }
    }
  }
`

// Selector for addAdapter function in V2 vaults
const ADD_ADAPTER_SELECTOR = '0x60d54d41'

export async function fetchMorphoV2Data(
  vaultAddress: string,
  chainId: number
): Promise<MorphoV2Data> {
  type MarketData = {
    lltv: string
    realizedBadDebt: { usd: number }
    warnings: Array<{ type: string }>
    collateralAsset: { address: string; symbol: string }
    oracle: { address: string }
    state?: { utilization: number | null; liquidityAssetsUsd: number | null }
  }
  type Cap = {
    type: string
    allocation: string   // raw token amount (BigInt as string)
    data: {
      market?: MarketData
      adapter?: { metaMorpho?: { address: string } }
    }
  }
  const { vault } = await gql<{
    vault: {
      address: string
      name: string
      totalAssetsUsd: number
      netApy: number
      avgNetApy: number | null
      creationTimestamp: number | null
      performanceFee: number | null
      owner: { address: string }
      curators: { items: Array<{ name: string; verified: boolean; addresses: Array<{ address: string }> }> }
      warnings: Array<{ type: string; level: string }>
      timelocks: Array<{ selector: string; functionName: string; duration: number }>
      caps: { items: Cap[] }
    }
  }>(VAULT_V2_QUERY, { address: vaultAddress, chainId })

  const primaryCurator = vault.curators.items[0] ?? null
  const curatorAddresses = primaryCurator?.addresses.map(a => a.address) ?? [vault.owner.address]

  // Per-function timelocks — find addAdapter (the critical "add new strategy" gate)
  const addAdapterTimelock = vault.timelocks.find(t => t.selector === ADD_ADAPTER_SELECTOR)
  const addAdapterTimelockSeconds = addAdapterTimelock?.duration ?? 0

  // Count ALL vaults (V1 + V2) managed by this curator (query both curator and owner fields)
  type VaultItems = { items: Array<{ address: string }> }
  const [v1Vaults, v2Vaults] = await Promise.all([
    gql<{ byCurator: VaultItems; byOwner: VaultItems }>(
      VAULTS_BY_CURATOR_QUERY,
      { curatorAddresses, chainIds: [1, 8453, 42161] }
    ).then(r => [...r.byCurator.items, ...r.byOwner.items].map(v => v.address.toLowerCase())).catch(() => [] as string[]),
    gql<{ byCurator: VaultItems; byOwner: VaultItems }>(
      V2_VAULTS_BY_CURATOR_QUERY,
      { curatorAddresses, chainIds: [1, 8453, 42161] }
    ).then(r => [...r.byCurator.items, ...r.byOwner.items].map(v => v.address.toLowerCase())).catch(() => [] as string[]),
  ])
  const vaultsManaged = Math.max(1, new Set([...v1Vaults, ...v2Vaults]).size)

  // Helper to convert a market object to our standard shape
  // supplyAssetsUsd = this vault's allocation to this market (not the market's total)
  const toMarket = (m: MarketData, supplyAssetsUsd: number) => ({
    lltv: m.lltv,
    collateralAddress: m.collateralAsset.address,
    collateralSymbol: m.collateralAsset.symbol,
    oracleAddress: m.oracle.address,
    supplyAssetsUsd,
    realizedBadDebtUsd: m.realizedBadDebt.usd,
    hasOracleWarning: m.warnings.some(w => w.type === 'incorrect_oracle_configuration'),
  })

  // Parse caps: MarketV1 direct, MetaMorpho adapter (resolve via follow-up query), other Adapter (opaque)
  // For MarketV1 caps: use cap's raw allocation proportional to vault TVL for USD amount
  const v1Caps = vault.caps.items.filter(c => c.type === 'MarketV1' && c.data.market)
  const totalV1RawAlloc = v1Caps.reduce((s, c) => s + Number(c.allocation), 0)
  const marketV1Markets = v1Caps.map(c => {
    const weight = totalV1RawAlloc > 0 ? Number(c.allocation) / totalV1RawAlloc : 0
    return toMarket(c.data.market!, weight * vault.totalAssetsUsd)
  })

  // MetaMorpho adapter caps — fetch their underlying markets
  const metaMorphoAddresses = vault.caps.items
    .filter(c => c.type === 'Adapter' && c.data.adapter?.metaMorpho?.address)
    .map(c => c.data.adapter!.metaMorpho!.address)

  type MmAllocation = { supplyAssetsUsd: number | null; market: MarketData & { collateralAsset: { address: string; symbol: string }; oracle: { address: string } } }
  const metaMorphoRaw = (await Promise.all(
    metaMorphoAddresses.map(addr =>
      gql<{ vault: { state: { allocation: MmAllocation[] } } }>(
        METAMORPHO_MARKETS_QUERY, { address: addr, chainId }
      ).then(r => r.vault.state.allocation.filter(a => (a.supplyAssetsUsd ?? 0) > 0 && a.market.collateralAsset !== null))
        .catch(() => [] as MmAllocation[])
    )
  )).flat()
  const metaMorphoMarkets = metaMorphoRaw.map(a => toMarket(a.market, a.supplyAssetsUsd ?? 0))

  const markets = [...marketV1Markets, ...metaMorphoMarkets]

  // hasAdapterCaps = true only if there are Adapter caps we couldn't resolve
  const hasAdapterCaps = vault.caps.items.some(
    c => c.type === 'Adapter' && !c.data.adapter?.metaMorpho?.address
  )

  // Calculate weighted utilization from ALL market sources (MarketV1 caps + MetaMorpho adapters)
  const allMarketsWithState = [
    ...marketV1Markets.map((m, i) => ({
      supplyAssetsUsd: m.supplyAssetsUsd,
      utilization: v1Caps[i]?.data.market?.state?.utilization ?? 0,
      marketLiquidityUsd: v1Caps[i]?.data.market?.state?.liquidityAssetsUsd ?? 0,
    })),
    ...metaMorphoRaw.map(a => ({
      supplyAssetsUsd: a.supplyAssetsUsd ?? 0,
      utilization: a.market.state?.utilization ?? 0,
      marketLiquidityUsd: a.market.state?.liquidityAssetsUsd ?? 0,
    })),
  ]
  const totalSupplyForUtil = allMarketsWithState.reduce((s, m) => s + m.supplyAssetsUsd, 0)
  const weightedUtilization = totalSupplyForUtil > 0
    ? allMarketsWithState.reduce((s, m) => s + m.utilization * (m.supplyAssetsUsd / totalSupplyForUtil), 0)
    : 0
  const totalMarketLiquidityUsd = allMarketsWithState.reduce((s, m) => s + m.marketLiquidityUsd, 0)

  return {
    name: vault.name,
    tvlUsd: vault.totalAssetsUsd,
    currentApyPct: vault.netApy * 100,
    deployedAt: vault.creationTimestamp ? vault.creationTimestamp * 1000 : null,
    performanceFeePct: vault.performanceFee !== null ? vault.performanceFee * 100 : null,
    curatorAddress: vault.owner.address,
    curatorName: primaryCurator?.name ?? null,
    curatorVerified: primaryCurator?.verified ?? false,
    addAdapterTimelockSeconds,
    vaultsManaged,
    warnings: vault.warnings.map(w => w.type),
    markets,
    hasAdapterCaps,
    weightedUtilization,
    totalMarketLiquidityUsd,
  }
}

export interface VaultMarketAllocation {
  uniqueKey: string
  supplyAssetsUsd: number
  lltv: string
  collateralAddress: string
  collateralSymbol: string
  oracleAddress: string
  baseFeedOneAddress: string | null  // underlying Chainlink feed address, null = no feed
  baseFeedOnePair: string | null     // e.g. "ETH / USD", null = not standard Chainlink
  utilization: number            // 0-1, market-level utilization
  marketLiquidityUsd: number     // available (unborrowed) liquidity in this market
}

export interface VaultLiquidity {
  /** Withdrawable underlying token amount (raw, not USD — 0 means fully locked) */
  underlyingRaw: number
  /** Weighted avg utilization across this vault's active markets (0-1) */
  weightedUtilization: number
  /** Total available market liquidity across all active allocations (USD) */
  totalMarketLiquidityUsd: number
}

/** Returns active market allocations for this vault (supplyAssetsUsd > 0), sorted by allocation descending */
export async function fetchVaultAllocation(
  vaultAddress: string,
  chainId: number
): Promise<{ allocations: VaultMarketAllocation[]; liquidity: VaultLiquidity }> {
  const { vault } = await gql<{
    vault: {
      liquidity: { underlying: number }
      state: {
        allocation: Array<{
          supplyAssetsUsd: number | null
          market: {
            uniqueKey: string
            lltv: string
            collateralAsset: { address: string; symbol: string } | null
            oracle: {
              address: string
              data: { baseFeedOne: { address: string; pair: string | null } | null } | null
            }
            state: { utilization: number | null; liquidityAssetsUsd: number | null }
          }
        }>
      }
    }
  }>(VAULT_ALLOCATION_QUERY, { address: vaultAddress, chainId })

  const allocations = vault.state.allocation
    .filter(a => (a.supplyAssetsUsd ?? 0) > 0 && a.market.collateralAsset !== null)
    .map(a => ({
      uniqueKey: a.market.uniqueKey.toLowerCase(),
      supplyAssetsUsd: a.supplyAssetsUsd!,
      lltv: a.market.lltv,
      collateralAddress: a.market.collateralAsset!.address,
      collateralSymbol: a.market.collateralAsset!.symbol,
      oracleAddress: a.market.oracle.address,
      baseFeedOneAddress: a.market.oracle.data?.baseFeedOne?.address ?? null,
      baseFeedOnePair: a.market.oracle.data?.baseFeedOne?.pair ?? null,
      utilization: a.market.state.utilization ?? 0,
      marketLiquidityUsd: a.market.state.liquidityAssetsUsd ?? 0,
    }))
    .sort((a, b) => b.supplyAssetsUsd - a.supplyAssetsUsd)

  // Compute vault-level liquidity summary
  const totalAlloc = allocations.reduce((s, a) => s + a.supplyAssetsUsd, 0)
  const weightedUtilization = totalAlloc > 0
    ? allocations.reduce((s, a) => s + a.utilization * (a.supplyAssetsUsd / totalAlloc), 0)
    : 0
  const totalMarketLiquidityUsd = allocations.reduce((s, a) => s + a.marketLiquidityUsd, 0)

  return {
    allocations,
    liquidity: {
      underlyingRaw: vault.liquidity.underlying,
      weightedUtilization,
      totalMarketLiquidityUsd,
    },
  }
}

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(MORPHO_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 300 },
  })
  if (!res.ok) throw new Error(`Morpho API ${res.status}`)
  const json = await res.json()
  if (json.errors?.length) throw new Error(`Morpho API: ${json.errors[0].message}`)
  return json.data as T
}

export async function fetchMorphoYieldData(
  vaultAddress: string,
  chainId: number
): Promise<MorphoYieldData> {
  const { vault } = await gql<{
    vault: {
      state: { totalAssetsUsd: number; netApy: number; fee: number | null }
      creationTimestamp: number | null
    }
  }>(VAULT_YIELD_QUERY, { address: vaultAddress, chainId })

  return {
    tvlUsd: vault.state.totalAssetsUsd,
    currentApyPct: vault.state.netApy * 100,
    performanceFeePct: vault.state.fee !== null ? vault.state.fee * 100 : null,
    deployedAt: vault.creationTimestamp ? vault.creationTimestamp * 1000 : null,
  }
}

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const BAD_DEBT_THRESHOLD_USD = 1  // ignore dust amounts below $1

export async function fetchMorphoCuratorData(
  vaultAddress: string,
  chainId: number
): Promise<MorphoCuratorData> {
  type Allocation = {
    supplyAssetsUsd: number | null       // this vault's allocation to this market
    market: {
      uniqueKey: string
      lltv: string                       // uint256 as string, 1e18 = 100%
      realizedBadDebt: { usd: number }
      warnings: Array<{ type: string }>
    }
  }

  // Step 1: fetch vault curator info + guardian/owner + market bad debt
  const { vault } = await gql<{
    vault: {
      name: string
      state: {
        curator: string
        timelock: number
        guardian: string
        owner: string
        curators: Array<{ name: string; verified: boolean; addresses: Array<{ address: string }> }>
        allocation: Allocation[]
      }
      warnings: Array<{ type: string; level: string }>
      publicAllocatorConfig: {
        fee: number
        flowCaps: Array<{ market: { uniqueKey: string }; maxIn: string; maxOut: string }>
      } | null
    }
  }>(VAULT_CURATOR_QUERY, { address: vaultAddress, chainId })

  // Some curators (e.g. MEV Capital) leave the on-chain `curator` field as zero
  // and operate directly as `owner`. Fall back to owner so the managed-vaults query
  // returns the correct set instead of all zero-curator vaults.
  const curatorAddress = (vault.state.curator && vault.state.curator !== ZERO_ADDRESS)
    ? vault.state.curator
    : vault.state.owner
  const primaryCurator = vault.state.curators[0] ?? null
  const marketKeys = vault.state.allocation.map(a => a.market.uniqueKey)

  // Incident count: markets with realized bad debt above dust threshold
  const incidentCount = vault.state.allocation.filter(
    a => a.market.realizedBadDebt.usd > BAD_DEBT_THRESHOLD_USD
  ).length

  // Total bad debt across all markets
  const totalRealizedBadDebtUsd = vault.state.allocation.reduce(
    (sum, a) => sum + a.market.realizedBadDebt.usd, 0
  )

  // Oracle warning: any market has incorrect oracle configuration
  const hasOracleWarning = vault.state.allocation.some(
    a => a.market.warnings.some(w => w.type === 'incorrect_oracle_configuration')
  )

  // Weighted avg LLTV (exclude idle markets where lltv = 0)
  const activeMarkets = vault.state.allocation.filter(a => a.market.lltv !== '0')
  const totalSupply = activeMarkets.reduce((s, a) => s + (a.supplyAssetsUsd ?? 0), 0)
  const weightedAvgLltvPct = totalSupply > 0
    ? activeMarkets.reduce((s, a) => {
        const lltv = Number(a.market.lltv) / 1e18 * 100
        const weight = (a.supplyAssetsUsd ?? 0) / totalSupply
        return s + lltv * weight
      }, 0)
    : (activeMarkets.length > 0
        ? activeMarkets.reduce((s, a) => s + Number(a.market.lltv) / 1e18 * 100, 0) / activeMarkets.length
        : 80)

  // Use all addresses from the curator entity (same approach as V2 path)
  const allCuratorAddresses = primaryCurator?.addresses.map(a => a.address) ?? [curatorAddress]

  // Steps 2+3 in parallel: count ALL vaults (V1+V2) managed + check curator borrow positions
  type VaultItems = { items: Array<{ address: string }> }
  const [v1VaultAddrs, v2VaultAddrs, curatorBorrowsFromVault] = await Promise.all([
    gql<{ byCurator: VaultItems; byOwner: VaultItems }>(
      VAULTS_BY_CURATOR_QUERY,
      { curatorAddresses: allCuratorAddresses, chainIds: [1, 8453, 42161] }
    ).then(r => [...r.byCurator.items, ...r.byOwner.items].map(v => v.address.toLowerCase())).catch(() => [] as string[]),
    gql<{ byCurator: VaultItems; byOwner: VaultItems }>(
      V2_VAULTS_BY_CURATOR_QUERY,
      { curatorAddresses: allCuratorAddresses, chainIds: [1, 8453, 42161] }
    ).then(r => [...r.byCurator.items, ...r.byOwner.items].map(v => v.address.toLowerCase())).catch(() => [] as string[]),

    marketKeys.length > 0
      ? gql<{ marketPositions: { items: Array<{ state: { borrowAssets: number } }> } }>(
          CURATOR_POSITIONS_QUERY,
          { userAddress: curatorAddress, marketKeys }
        ).then(r => r.marketPositions.items.some(p => p.state.borrowAssets > 0)).catch(() => false)
      : Promise.resolve(false),
  ])
  const vaultsManaged = Math.max(1, new Set([...v1VaultAddrs, ...v2VaultAddrs]).size)

  return {
    vaultName: vault.name ?? null,
    curatorAddress,
    curatorName: primaryCurator?.name ?? null,
    curatorVerified: primaryCurator?.verified ?? false,
    timelockSeconds: vault.state.timelock,
    vaultsManaged,
    warnings: vault.warnings.map(w => w.type),
    guardian: vault.state.guardian ?? ZERO_ADDRESS,
    owner: vault.state.owner,
    incidentCount,
    curatorBorrowsFromVault,
    weightedAvgLltvPct,
    totalRealizedBadDebtUsd,
    hasOracleWarning,
    hasPublicAllocator: (vault.publicAllocatorConfig?.flowCaps?.length ?? 0) > 0,
  }
}
