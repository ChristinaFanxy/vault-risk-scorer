// lib/morphoApi.ts
// Morpho Blue public GraphQL API — no API key required.
const MORPHO_API = 'https://blue-api.morpho.org/graphql'

export interface MorphoV2Data {
  name: string
  tvlUsd: number
  currentApyPct: number
  apy7dAvg: number | null   // 7-day rolling avg from daily history
  apy30dAvg: number | null  // 30-day rolling avg
  apy90dAvg: number | null  // 90-day rolling avg
  apyHistory: Array<{ timestamp: number; apyPct: number }>

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
}

export interface MorphoYieldData {
  tvlUsd: number
  currentApyPct: number
  apy7dAvg: number | null
  apy30dAvg: number | null
  apy90dAvg: number | null
  apyHistory: Array<{ timestamp: number; apyPct: number }>
}

export interface MorphoCuratorData {
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
}

const VAULT_YIELD_QUERY = `
  query VaultYield($address: String!, $chainId: Int!) {
    vault: vaultByAddress(address: $address, chainId: $chainId) {
      state {
        totalAssetsUsd
        netApy
      }
      historicalState {
        dailyNetApy { x y }
        weeklyNetApy { x y }
        monthlyNetApy { x y }
        quarterlyNetApy { x y }
      }
    }
  }
`

const VAULT_CURATOR_QUERY = `
  query VaultCurator($address: String!, $chainId: Int!) {
    vault: vaultByAddress(address: $address, chainId: $chainId) {
      state {
        curator
        timelock
        guardian
        owner
        curators { name verified }
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

const VAULTS_BY_CURATOR_QUERY = `
  query VaultsByCurator($curatorAddresses: [String!]!, $chainIds: [Int!]!) {
    vaults(where: { curatorAddress_in: $curatorAddresses, chainId_in: $chainIds }) {
      items { address }
    }
  }
`

const VAULT_V2_QUERY = `
  query VaultV2($address: String!, $chainId: Int!) {
    vault: vaultV2ByAddress(address: $address, chainId: $chainId) {
      address name totalAssetsUsd netApy avgNetApy
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
      historicalState { avgNetApy { x y } }
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
          }
        }
      }
    }
  }
`

const V2_VAULTS_BY_CURATOR_QUERY = `
  query V2VaultsByCurator($curatorAddresses: [String!]!, $chainIds: [Int!]!) {
    vaultV2s(where: { curatorAddress_in: $curatorAddresses, chainId_in: $chainIds }) {
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
  }
  type Cap = {
    type: string
    allocation: string   // raw token amount (BigInt as string)
    data: {
      market?: MarketData
      adapter?: { metaMorpho?: { address: string } }
    }
  }
  type Point = { x: number; y: number | null }

  const { vault } = await gql<{
    vault: {
      address: string
      name: string
      totalAssetsUsd: number
      netApy: number
      avgNetApy: number | null
      owner: { address: string }
      curators: { items: Array<{ name: string; verified: boolean; addresses: Array<{ address: string }> }> }
      warnings: Array<{ type: string; level: string }>
      timelocks: Array<{ selector: string; functionName: string; duration: number }>
      caps: { items: Cap[] }
      historicalState: { avgNetApy: Point[] }
    }
  }>(VAULT_V2_QUERY, { address: vaultAddress, chainId })

  const primaryCurator = vault.curators.items[0] ?? null
  const curatorAddresses = primaryCurator?.addresses.map(a => a.address) ?? [vault.owner.address]

  // Per-function timelocks — find addAdapter (the critical "add new strategy" gate)
  const addAdapterTimelock = vault.timelocks.find(t => t.selector === ADD_ADAPTER_SELECTOR)
  const addAdapterTimelockSeconds = addAdapterTimelock?.duration ?? 0

  // Count V2 vaults managed by this curator
  const vaultsManaged = await gql<{ vaultV2s: { items: Array<{ address: string }> } }>(
    V2_VAULTS_BY_CURATOR_QUERY,
    { curatorAddresses, chainIds: [1, 8453] }
  ).then(r => Math.max(1, r.vaultV2s.items.length)).catch(() => 1)

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

  const metaMorphoMarkets = (await Promise.all(
    metaMorphoAddresses.map(addr =>
      gql<{
        vault: {
          state: {
            allocation: Array<{
              supplyAssetsUsd: number | null
              market: MarketData & { collateralAsset: { address: string; symbol: string }; oracle: { address: string } }
            }>
          }
        }
      }>(METAMORPHO_MARKETS_QUERY, { address: addr, chainId })
        .then(r => r.vault.state.allocation
          .filter(a => (a.supplyAssetsUsd ?? 0) > 0)
          .map(a => toMarket(a.market, a.supplyAssetsUsd ?? 0))
        )
        .catch(() => [] as ReturnType<typeof toMarket>[])
    )
  )).flat()

  const markets = [...marketV1Markets, ...metaMorphoMarkets]

  // hasAdapterCaps = true only if there are Adapter caps we couldn't resolve
  const hasAdapterCaps = vault.caps.items.some(
    c => c.type === 'Adapter' && !c.data.adapter?.metaMorpho?.address
  )

  // APY history from daily avgNetApy points (V2 only has this one series)
  const rawHistory = vault.historicalState.avgNetApy
    .filter(p => p.y !== null)
    .map(p => ({ timestamp: p.x * 1000, apyPct: (p.y as number) * 100 }))
    .sort((a, b) => a.timestamp - b.timestamp)

  // Derive rolling averages from history
  const now = Date.now()
  const avgOver = (days: number) => {
    const cutoff = now - days * 86400 * 1000
    const pts = rawHistory.filter(p => p.timestamp >= cutoff)
    if (pts.length === 0) return null
    return pts.reduce((s, p) => s + p.apyPct, 0) / pts.length
  }

  return {
    name: vault.name,
    tvlUsd: vault.totalAssetsUsd,
    currentApyPct: vault.netApy * 100,
    apy7dAvg: avgOver(7),
    apy30dAvg: avgOver(30),
    apy90dAvg: avgOver(90),
    apyHistory: rawHistory,
    curatorAddress: vault.owner.address,
    curatorName: primaryCurator?.name ?? null,
    curatorVerified: primaryCurator?.verified ?? false,
    addAdapterTimelockSeconds,
    vaultsManaged,
    warnings: vault.warnings.map(w => w.type),
    markets,
    hasAdapterCaps,
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
  type Point = { x: number; y: number | null }
  const { vault } = await gql<{
    vault: {
      state: { totalAssetsUsd: number; netApy: number }
      historicalState: {
        dailyNetApy: Point[]
        weeklyNetApy: Point[]
        monthlyNetApy: Point[]
        quarterlyNetApy: Point[]
      }
    }
  }>(VAULT_YIELD_QUERY, { address: vaultAddress, chainId })

  const toHistory = (pts: Point[]) =>
    pts
      .filter(p => p.y !== null)
      .map(p => ({ timestamp: p.x * 1000, apyPct: (p.y as number) * 100 }))
      .sort((a, b) => a.timestamp - b.timestamp)

  // Use daily for recent, fall back to weekly, then quarterly for older points
  const history = toHistory(vault.historicalState.quarterlyNetApy)

  // 7d avg from weeklyNetApy latest point, 30d/90d from monthly/quarterly
  const latest = (pts: Point[]) => pts.filter(p => p.y !== null).at(-1)?.y ?? null
  const apy7d = latest(vault.historicalState.weeklyNetApy)
  const apy30d = latest(vault.historicalState.monthlyNetApy)
  const apy90d = latest(vault.historicalState.quarterlyNetApy)

  return {
    tvlUsd: vault.state.totalAssetsUsd,
    currentApyPct: vault.state.netApy * 100,
    apy7dAvg: apy7d !== null ? apy7d * 100 : null,
    apy30dAvg: apy30d !== null ? apy30d * 100 : null,
    apy90dAvg: apy90d !== null ? apy90d * 100 : null,
    apyHistory: history,
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
      state: {
        curator: string
        timelock: number
        guardian: string
        owner: string
        curators: Array<{ name: string; verified: boolean }>
        allocation: Allocation[]
      }
      warnings: Array<{ type: string; level: string }>
    }
  }>(VAULT_CURATOR_QUERY, { address: vaultAddress, chainId })

  const curatorAddress = vault.state.curator
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

  // Steps 2+3 in parallel: count vaults managed + check curator borrow positions
  const [vaultsManaged, curatorBorrowsFromVault] = await Promise.all([
    gql<{ vaults: { items: Array<{ address: string }> } }>(
      VAULTS_BY_CURATOR_QUERY,
      { curatorAddresses: [curatorAddress], chainIds: [1, 8453] }
    ).then(r => Math.max(1, r.vaults.items.length)).catch(() => 1),

    marketKeys.length > 0
      ? gql<{ marketPositions: { items: Array<{ state: { borrowAssets: number } }> } }>(
          CURATOR_POSITIONS_QUERY,
          { userAddress: curatorAddress, marketKeys }
        ).then(r => r.marketPositions.items.some(p => p.state.borrowAssets > 0)).catch(() => false)
      : Promise.resolve(false),
  ])

  return {
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
  }
}
