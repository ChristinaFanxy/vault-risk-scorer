// lib/leaderboardApi.ts
import type { CuratorAggregated } from '@/lib/scoring/curatorLeaderboard'
import { classifyBySymbol } from '@/lib/tokenRegistry'
import { fetchCuratorBadDebtHistory } from '@/lib/thegraph'
import { detectUnrealizedBadDebt } from '@/lib/scoring/protocols/morpho'

const MORPHO_API = 'https://blue-api.morpho.org/graphql'
const ALL_CHAIN_IDS = [1, 8453, 42161, 10, 137, 130, 999, 747474, 143, 988]

async function gql<T>(query: string, variables: Record<string, unknown>, revalidate = 43200): Promise<T> {
  const res = await fetch(MORPHO_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    next: { revalidate },
  })
  if (!res.ok) throw new Error(`Morpho API ${res.status}`)
  const json = await res.json()
  if (json.errors?.length) throw new Error(`Morpho API: ${json.errors[0].message}`)
  return json.data as T
}

const V1_VAULTS_QUERY = `
  query V1Vaults($chainIds: [Int!]!, $skip: Int!) {
    vaults(where: { chainId_in: $chainIds }, first: 40, skip: $skip) {
      items {
        address
        chain { id }
        state {
          curator
          owner
          totalAssetsUsd
          netApy
          fee
          timelock
          guardian
          curators { name verified addresses { address } }
          allocation {
            supplyAssetsUsd
            market {
              realizedBadDebt { usd }
              warnings { type }
              collateralAsset { symbol }
              state { utilization }
            }
          }
        }
        publicAllocatorConfig { fee }
      }
      pageInfo { countTotal }
    }
  }
`

// V2 query: lightweight (no caps/allocation) to avoid Morpho API complexity limits
const V2_VAULTS_QUERY = `
  query V2Vaults($chainIds: [Int!]!, $skip: Int!) {
    vaultV2s(where: { chainId_in: $chainIds }, first: 100, skip: $skip) {
      items {
        address
        chain { id }
        totalAssetsUsd
        netApy
        performanceFee
        owner { address }
        curators { items { name verified addresses { address } } }
        warnings { type level }
        timelocks { selector duration }
      }
      pageInfo { countTotal }
    }
  }
`

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'
const ADD_ADAPTER_SELECTOR = '0x60d54d41'

interface VaultEntry {
  curatorAddress: string
  allCuratorAddresses: string[]  // all addresses this curator uses across chains
  curatorName: string | null
  verified: boolean
  chainId: number
  tvlUsd: number
  apyPct: number
  feePct: number | null
  timelockHours: number
  hasGuardian: boolean
  hasCuratorBorrowing: boolean
  hasPublicAllocator: boolean
  badDebtUsd: number
  hasOracleWarning: boolean
  marketCount: number
  collateralSymbols: string[]
  weightedUtilization: number
}

async function fetchAllV1Vaults(): Promise<VaultEntry[]> {
  const entries: VaultEntry[] = []
  let skip = 0
  while (true) {
    const { vaults } = await gql<{ vaults: { items: any[]; pageInfo: { countTotal: number } } }>(
      V1_VAULTS_QUERY, { chainIds: ALL_CHAIN_IDS, skip }
    )
    for (const v of vaults.items) {
      const s = v.state
      const curatorAddr = (s.curator && s.curator !== ZERO_ADDRESS) ? s.curator : s.owner
      const primaryCurator = s.curators?.[0]
      const allAddrs = primaryCurator?.addresses
        ? [...new Set((primaryCurator.addresses as Array<{address: string}>).map((a: {address: string}) => a.address.toLowerCase()))]
        : [curatorAddr.toLowerCase()]
      const allocations = s.allocation ?? []
      const totalSupply = allocations.reduce((sum: number, a: any) => sum + (a.supplyAssetsUsd ?? 0), 0)

      entries.push({
        curatorAddress: curatorAddr.toLowerCase(),
        allCuratorAddresses: allAddrs,
        curatorName: primaryCurator?.name ?? null,
        verified: primaryCurator?.verified ?? false,
        chainId: v.chain.id,
        tvlUsd: s.totalAssetsUsd ?? 0,
        apyPct: (s.netApy ?? 0) * 100,
        feePct: s.fee !== null && s.fee !== undefined ? s.fee * 100 : null,
        timelockHours: (s.timelock ?? 0) / 3600,
        hasGuardian: s.guardian ? s.guardian !== ZERO_ADDRESS : false,
        hasCuratorBorrowing: false,
        hasPublicAllocator: v.publicAllocatorConfig !== null,
        badDebtUsd: allocations.reduce((sum: number, a: any) => sum + (a.market?.realizedBadDebt?.usd ?? 0), 0),
        hasOracleWarning: allocations.some((a: any) => a.market?.warnings?.some((w: any) => w.type === 'incorrect_oracle_configuration')),
        marketCount: allocations.filter((a: any) => (a.supplyAssetsUsd ?? 0) > 0).length,
        collateralSymbols: allocations.map((a: any) => a.market?.collateralAsset?.symbol).filter(Boolean),
        weightedUtilization: totalSupply > 0
          ? allocations.reduce((sum: number, a: any) => {
              const u = a.market?.state?.utilization ?? 0
              return sum + u * ((a.supplyAssetsUsd ?? 0) / totalSupply)
            }, 0)
          : 0,
      })
    }
    if (vaults.items.length < 40) break
    skip += 40
  }
  return entries
}

async function fetchAllV2Vaults(): Promise<VaultEntry[]> {
  const entries: VaultEntry[] = []
  let skip = 0
  while (true) {
    const { vaultV2s } = await gql<{ vaultV2s: { items: any[]; pageInfo: { countTotal: number } } }>(
      V2_VAULTS_QUERY, { chainIds: ALL_CHAIN_IDS, skip }
    )
    for (const v of vaultV2s.items) {
      const primaryCurator = v.curators?.items?.[0]
      const curatorAddr = primaryCurator?.addresses?.[0]?.address ?? v.owner?.address ?? ZERO_ADDRESS
      const allAddrs = primaryCurator?.addresses
        ? [...new Set((primaryCurator.addresses as Array<{address: string}>).map((a: {address: string}) => a.address.toLowerCase()))]
        : [curatorAddr.toLowerCase()]
      const addAdapterTl = v.timelocks?.find((t: any) => t.selector === ADD_ADAPTER_SELECTOR)

      entries.push({
        curatorAddress: curatorAddr.toLowerCase(),
        allCuratorAddresses: allAddrs,
        curatorName: primaryCurator?.name ?? null,
        verified: primaryCurator?.verified ?? false,
        chainId: v.chain.id,
        tvlUsd: v.totalAssetsUsd ?? 0,
        apyPct: (v.netApy ?? 0) * 100,
        feePct: v.performanceFee !== null && v.performanceFee !== undefined ? v.performanceFee * 100 : null,
        timelockHours: (addAdapterTl?.duration ?? 0) / 3600,
        hasGuardian: false,
        hasCuratorBorrowing: false,
        hasPublicAllocator: false,
        badDebtUsd: 0,  // V2 caps query too heavy for bulk fetch
        hasOracleWarning: v.warnings?.some((w: any) => w.type === 'incorrect_oracle_configuration') ?? false,
        marketCount: 0,
        collateralSymbols: [],
        weightedUtilization: 0,
      })
    }
    if (vaultV2s.items.length < 100) break
    skip += 100
  }
  return entries
}

// Fetch the official Morpho curator registry as whitelist
const CURATOR_REGISTRY_QUERY = `
  query { curators { items { name verified } } }
`

async function fetchCuratorWhitelist(): Promise<Set<string>> {
  const { curators } = await gql<{ curators: { items: Array<{ name: string; verified: boolean }> } }>(
    CURATOR_REGISTRY_QUERY, {}
  )
  return new Set(curators.items.filter(c => c.verified).map(c => c.name))
}

export async function fetchAllCuratorData(): Promise<CuratorAggregated[]> {
  const [v1, v2, whitelist] = await Promise.all([fetchAllV1Vaults(), fetchAllV2Vaults(), fetchCuratorWhitelist()])
  const allVaults = [...v1, ...v2]

  // Group by curator NAME — same curator uses different addresses across chains.
  // Only include curators that are in the official Morpho registry.
  const byCurator = new Map<string, VaultEntry[]>()
  for (const v of allVaults) {
    if (!v.curatorName || !whitelist.has(v.curatorName)) continue
    const key = v.curatorName
    const arr = byCurator.get(key) ?? []
    arr.push(v)
    byCurator.set(key, arr)
  }

  const curators: CuratorAggregated[] = []
  for (const [name, vaults] of byCurator) {
    const addr = vaults[0].curatorAddress
    const totalTvl = vaults.reduce((s, v) => s + v.tvlUsd, 0)
    const weightedApy = totalTvl > 0
      ? vaults.reduce((s, v) => s + v.apyPct * (v.tvlUsd / totalTvl), 0)
      : 0
    const fees = vaults.map(v => v.feePct).filter((f): f is number => f !== null)
    const avgFee = fees.length > 0 ? fees.reduce((s, f) => s + f, 0) / fees.length : null
    const totalBadDebt = vaults.reduce((s, v) => s + v.badDebtUsd, 0)
    const chains = new Set(vaults.map(v => v.chainId))
    const allSymbols = vaults.flatMap(v => v.collateralSymbols)
    const classified = allSymbols.map(s => classifyBySymbol(s))
    const totalSymbols = classified.length || 1
    const stablePct = (classified.filter(c => c === 'stablecoin').length / totalSymbols) * 100
    const ltPct = (classified.filter(c => c === 'long-tail').length / totalSymbols) * 100
    const totalUtil = totalTvl > 0
      ? vaults.reduce((s, v) => s + v.weightedUtilization * (v.tvlUsd / totalTvl), 0)
      : 0
    const verified = vaults.some(v => v.verified)
    const affectedMarkets = vaults.filter(v => v.badDebtUsd > 1).length
    const maxTimelock = Math.max(...vaults.map(v => v.timelockHours), 0)

    curators.push({
      curatorAddress: addr,
      curatorName: name,
      verified,
      totalTvlUsd: totalTvl,
      vaultCount: vaults.length,
      chainCount: chains.size,
      weightedApyPct: weightedApy,
      avgFeePct: avgFee,
      totalBadDebtUsd: totalBadDebt,
      unrealizedBadDebtUsd: 0,  // enriched later via on-chain detection
      badDebtToTvlRatio: totalTvl > 0 ? totalBadDebt / totalTvl : 0,
      affectedMarketCount: affectedMarkets,
      hasOracleWarning: vaults.some(v => v.hasOracleWarning),
      avgTimelockHours: maxTimelock,
      hasGuardian: vaults.some(v => v.hasGuardian),
      hasCuratorBorrowing: vaults.some(v => v.hasCuratorBorrowing),
      hasPublicAllocator: vaults.some(v => v.hasPublicAllocator),
      stablecoinPct: stablePct,
      longTailPct: ltPct,
      allChainlink: !vaults.some(v => v.hasOracleWarning),
      weightedUtilization: totalUtil,
    })
  }

  // Build map of curator name → all unique addresses (from vault data)
  const curatorAddrsMap = new Map<string, string[]>()
  for (const [name, vaults] of byCurator) {
    curatorAddrsMap.set(name, [...new Set(vaults.flatMap(v => v.allCuratorAddresses))])
  }

  // Enrich with The Graph bad debt history + on-chain unrealized bad debt detection.
  // Each curator may have 1-30+ addresses across chains.
  await Promise.all(curators.map(async (c) => {
    try {
      const allAddrs = curatorAddrsMap.get(c.curatorName!) ?? [c.curatorAddress]

      // Step 1: The Graph realized bad debt (per address, summed)
      const histories = await Promise.all(
        allAddrs.map(addr => fetchCuratorBadDebtHistory([addr]).catch(() => null))
      )
      let totalBd = 0
      let totalAffected = 0
      const allMarketIds: Array<{ marketId: string; chainId: any }> = []
      const allVaultAddresses: string[] = []
      for (const h of histories) {
        if (h) {
          totalBd += h.totalBadDebtUsd
          totalAffected += h.affectedMarketCount
          allMarketIds.push(...h.allMarketIds)
          allVaultAddresses.push(...h.allVaultAddresses)
        }
      }
      if (totalBd > c.totalBadDebtUsd) {
        c.totalBadDebtUsd = totalBd
        c.affectedMarketCount = Math.max(c.affectedMarketCount, totalAffected)
      }

      // Step 2: On-chain unrealized bad debt detection (stuck borrows)
      if (allMarketIds.length > 0 && allVaultAddresses.length > 0) {
        const unrealized = await detectUnrealizedBadDebt(allMarketIds, allVaultAddresses, c.totalBadDebtUsd).catch(() => ({ totalUsd: 0 }))
        c.unrealizedBadDebtUsd = unrealized.totalUsd
      }

      // Update ratio with total (realized + unrealized)
      const totalDebt = c.totalBadDebtUsd + c.unrealizedBadDebtUsd
      c.badDebtToTvlRatio = c.totalTvlUsd > 0 ? totalDebt / c.totalTvlUsd : 0
    } catch { /* keep Morpho API data as fallback */ }
  }))

  return curators
}
