// lib/scoring/protocols/morpho.ts
import { getAddress, type Address } from 'viem'
import { getClient, withRetry } from '@/lib/viemClient'
import { fetchVaultYield } from '@/lib/defillama'
import { fetchMorphoBadDebt, fetchCuratorBadDebtHistory } from '@/lib/thegraph'
import { fetchMorphoCuratorData, fetchMorphoYieldData, fetchMorphoV2Data, fetchVaultAllocation, fetchCuratorAllAddresses, type VaultMarketAllocation, type VaultLiquidity } from '@/lib/morphoApi'
import { fetchTokenVolatility30d, fetchTokenLiquidityUsd } from '@/lib/tokenData'
import type { ChainId, VaultData, AssetClass, OracleType, CuratorType } from '@/lib/scoring/types'

// Same address on Ethereum mainnet and Base
const MORPHO_BLUE_ADDRESS = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb' as const

const METAMORPHO_ABI = [
  { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'owner', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { name: 'timelock', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'withdrawQueueLength', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { name: 'withdrawQueue', type: 'function', stateMutability: 'view', inputs: [{ name: 'index', type: 'uint256' }], outputs: [{ type: 'bytes32' }] },
] as const

const MORPHO_BLUE_ABI = [
  {
    name: 'idToMarketParams',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [{
      name: 'params',
      type: 'tuple',
      components: [
        { name: 'loanToken', type: 'address' },
        { name: 'collateralToken', type: 'address' },
        { name: 'oracle', type: 'address' },
        { name: 'irm', type: 'address' },
        { name: 'lltv', type: 'uint256' },
      ],
    }],
  },
  {
    name: 'market',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'bytes32' }],
    outputs: [{
      name: 'state',
      type: 'tuple',
      components: [
        { name: 'totalSupplyAssets', type: 'uint128' },
        { name: 'totalSupplyShares', type: 'uint128' },
        { name: 'totalBorrowAssets', type: 'uint128' },
        { name: 'totalBorrowShares', type: 'uint128' },
        { name: 'lastUpdate', type: 'uint128' },
        { name: 'fee', type: 'uint128' },
      ],
    }],
  },
  {
    name: 'position',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'id', type: 'bytes32' }, { name: 'user', type: 'address' }],
    outputs: [{
      name: 'p',
      type: 'tuple',
      components: [
        { name: 'supplyShares', type: 'uint256' },
        { name: 'borrowShares', type: 'uint128' },
        { name: 'collateral', type: 'uint128' },
      ],
    }],
  },
] as const

const ERC20_SYMBOL_ABI = [
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
] as const

const ERC20_DECIMALS_ABI = [
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
] as const

const ORACLE_PRICE_ABI = [
  { name: 'price', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
] as const

const CHAINLINK_ROUND_ABI = [
  {
    name: 'latestRoundData',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ],
  },
] as const

const MORPHO_ORACLE_FEED_ABI = [
  { name: 'BASE_FEED_ONE', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
] as const

// Well-known token registry keyed by lowercase address.
// liquidityDepthUsd: representative on-chain DEX + CEX depth (order-of-magnitude estimate).
// volatility30d: 30-day price return stddev (decimal). Stablecoins ≈ 0.001, ETH ≈ 0.08.
type TokenInfo = { assetClass: AssetClass; liquidityDepthUsd: number; volatility30d: number }
const TOKEN_REGISTRY: Record<string, TokenInfo> = {
  // ── Ethereum mainnet stablecoins ──
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { assetClass: 'stablecoin', liquidityDepthUsd: 5_000_000_000, volatility30d: 0.001 }, // USDC
  '0xdac17f958d2ee523a2206206994597c13d831ec7': { assetClass: 'stablecoin', liquidityDepthUsd: 4_000_000_000, volatility30d: 0.001 }, // USDT
  '0x6b175474e89094c44da98b954eedeac495271d0f': { assetClass: 'stablecoin', liquidityDepthUsd: 1_000_000_000, volatility30d: 0.001 }, // DAI
  '0x6c3ea9036406852006290770bedfcaba0e23a0e8': { assetClass: 'stablecoin', liquidityDepthUsd: 300_000_000,   volatility30d: 0.001 }, // PYUSD
  '0x4c9edd5852cd905f086c759e8383e09bff1e68b3': { assetClass: 'stablecoin', liquidityDepthUsd: 400_000_000,   volatility30d: 0.002 }, // USDe
  '0x9d39a5de30e57443bff2a8307a4256c8797a3497': { assetClass: 'stablecoin', liquidityDepthUsd: 500_000_000,   volatility30d: 0.002 }, // sUSDe
  '0xdc035d45d973e3ec169d2276ddab16f1e407384f': { assetClass: 'stablecoin', liquidityDepthUsd: 500_000_000,   volatility30d: 0.001 }, // USDS
  '0x83f20f44975d03b1b09e64809b757c47f942beea': { assetClass: 'stablecoin', liquidityDepthUsd: 600_000_000,   volatility30d: 0.001 }, // sDAI
  '0x5d3a1ff2b6bab83b63cd9ad0787074081a52ef34': { assetClass: 'stablecoin', liquidityDepthUsd: 200_000_000,   volatility30d: 0.002 }, // USDe Ethena
  // ── Ethereum mainnet blue-chip ──
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { assetClass: 'blue-chip',  liquidityDepthUsd: 2_000_000_000, volatility30d: 0.08 },  // WETH
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': { assetClass: 'blue-chip',  liquidityDepthUsd: 1_000_000_000, volatility30d: 0.07 },  // WBTC
  '0x7f39c581f595b53c5cb19bd0b3f8da6c935e2ca0': { assetClass: 'blue-chip',  liquidityDepthUsd: 500_000_000,   volatility30d: 0.08 },  // wstETH
  '0xae78736cd615f374d3085123a210448e74fc6393': { assetClass: 'blue-chip',  liquidityDepthUsd: 300_000_000,   volatility30d: 0.08 },  // rETH
  '0xcd5fe23c85820f7b72d0926fc9b05b43e359b7ee': { assetClass: 'blue-chip',  liquidityDepthUsd: 200_000_000,   volatility30d: 0.09 },  // weETH
  '0xbf5495efe5db9ce00f80364c8b423567e58d2110': { assetClass: 'blue-chip',  liquidityDepthUsd: 150_000_000,   volatility30d: 0.08 },  // ezETH
  '0xd5f7838f5c461feff7fe49ea5ebaf7728bb0adfa': { assetClass: 'blue-chip',  liquidityDepthUsd: 100_000_000,   volatility30d: 0.08 },  // mETH
  // ── Base stablecoins ──
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { assetClass: 'stablecoin', liquidityDepthUsd: 2_000_000_000, volatility30d: 0.001 }, // USDC on Base
  '0x50c5725949a6f0c72e6c4a641f24049a917db0cb': { assetClass: 'stablecoin', liquidityDepthUsd: 200_000_000,   volatility30d: 0.001 }, // DAI on Base
  // ── Base blue-chip ──
  '0x4200000000000000000000000000000000000006': { assetClass: 'blue-chip',  liquidityDepthUsd: 1_000_000_000, volatility30d: 0.08 },  // WETH on Base
  '0xcbb7c0000ab88b473b1f5afd9ef808440eed33bf': { assetClass: 'blue-chip',  liquidityDepthUsd: 500_000_000,   volatility30d: 0.07 },  // cbBTC
  '0xc1cba3fcea344f92d9239c08c0568f6f2f0ee452': { assetClass: 'blue-chip',  liquidityDepthUsd: 200_000_000,   volatility30d: 0.08 },  // wstETH on Base
  '0x2ae3f1ec7f1f5012cfeab0185bfc7aa3cf0dec22': { assetClass: 'blue-chip',  liquidityDepthUsd: 150_000_000,   volatility30d: 0.08 },  // cbETH
}

function classifyBySymbol(symbol: string): AssetClass {
  const s = symbol.toUpperCase()
  if (/^(USDC|USDT|DAI|PYUSD|USDS|USDE|SUSDE|SDAI|FRAX|LUSD|CRVUSD|GHO|EURS|GUSD|BUSD|TUSD|USDP|USDD|FDUSD)/.test(s)) return 'stablecoin'
  if (/^(WETH|ETH|WBTC|BTC|CBBTC|WSTETH|STETH|RETH|WEETH|CBETH|METH|SFRXETH|ANKRETH)/.test(s)) return 'blue-chip'
  return 'long-tail'
}

function defaultLiquidity(cls: AssetClass): number {
  return cls === 'stablecoin' ? 100_000_000 : cls === 'blue-chip' ? 200_000_000 : 10_000_000
}

function defaultVolatility(cls: AssetClass): number {
  return cls === 'stablecoin' ? 0.002 : cls === 'blue-chip' ? 0.10 : 0.25
}

async function detectOracleType(
  client: ReturnType<typeof getClient>,
  oracleAddress: Address
): Promise<OracleType> {
  // 1. Raw Chainlink AggregatorV3
  try {
    await client.readContract({ address: oracleAddress, abi: CHAINLINK_ROUND_ABI, functionName: 'latestRoundData' })
    return 'chainlink'
  } catch { /* not a raw Chainlink feed */ }

  // 2. MorphoChainlinkOracleV2: has price() + BASE_FEED_ONE (Chainlink feed underneath)
  try {
    await client.readContract({ address: oracleAddress, abi: ORACLE_PRICE_ABI, functionName: 'price' })
    try {
      await client.readContract({ address: oracleAddress, abi: MORPHO_ORACLE_FEED_ABI, functionName: 'BASE_FEED_ONE' })
      return 'chainlink' // confirmed MorphoChainlinkOracleV2
    } catch { /* has price() but no BASE_FEED_ONE — may be Uniswap TWAP based */ }
    return 'uniswap-twap'
  } catch { /* no price() either */ }

  return 'custom'
}

const CHAINLINK_ROUND_DATA_ABI_HISTORICAL = [
  {
    name: 'latestRoundData',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'roundId', type: 'uint80' },
      { name: 'answer', type: 'int256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'updatedAt', type: 'uint256' },
      { name: 'answeredInRound', type: 'uint80' },
    ],
  },
] as const

const BLOCKS_PER_DAY = 7200   // ~12s per block on Ethereum
const BLOCKS_PER_WEEK = BLOCKS_PER_DAY * 7

/**
 * Detect unrealized bad debt by reading on-chain market state for historical markets.
 * For each market with >95% utilization, reads each vault's position(id, vault) to
 * calculate the vault's pro-rata share of the stuck borrows — not the whole market total.
 * This catches cases like the Resolv USR incident ($6M+ stuck but never formally realized).
 */
export async function detectUnrealizedBadDebt(
  historicalMarketIds: Array<{ marketId: string; chainId: ChainId }>,
  vaultAddresses: string[],
  realizedBadDebtUsd: number,
): Promise<number> {
  if (historicalMarketIds.length === 0 || vaultAddresses.length === 0) return 0

  const byChain = new Map<ChainId, string[]>()
  for (const m of historicalMarketIds) {
    const arr = byChain.get(m.chainId) ?? []
    arr.push(m.marketId)
    byChain.set(m.chainId, arr)
  }

  let totalUnrealizedUsd = 0

  for (const [chainId, marketIds] of byChain) {
    const client = getClient(chainId)

    // Step 1: Batch-read all market states via multicall (handles 300+ markets efficiently)
    const marketCalls = marketIds.map(id => ({
      address: MORPHO_BLUE_ADDRESS as Address,
      abi: MORPHO_BLUE_ABI,
      functionName: 'market' as const,
      args: [id as `0x${string}`] as const,
    }))
    const batchSize = 200
    type MarketResult = { totalSupplyAssets: bigint; totalSupplyShares: bigint; totalBorrowAssets: bigint; totalBorrowShares: bigint; lastUpdate: bigint; fee: bigint }
    const allStates: Array<{ id: string; state: MarketResult | null }> = []

    for (let i = 0; i < marketCalls.length; i += batchSize) {
      const batch = marketCalls.slice(i, i + batchSize)
      const results = await client.multicall({ contracts: batch, allowFailure: true })
      for (let j = 0; j < results.length; j++) {
        const r = results[j]
        allStates.push({
          id: marketIds[i + j],
          state: r.status === 'success' ? r.result as unknown as MarketResult : null,
        })
      }
    }

    // Step 2: Filter to high-utilization markets with significant borrows
    const stuckMarkets: Array<{ id: `0x${string}`; totalBorrowAssets: bigint; totalSupplyShares: bigint; decimals: number }> = []
    for (const { id, state } of allStates) {
      if (!state || state.totalBorrowAssets <= BigInt(0)) continue

      const utilization = state.totalSupplyAssets > BigInt(0)
        ? Number(state.totalBorrowAssets) / Number(state.totalSupplyAssets)
        : 0
      // Quick USD estimate assuming 6 decimals (USDC); refine later for non-stablecoin markets
      const roughBorrowUsd = Number(state.totalBorrowAssets) / 1e6
      if (roughBorrowUsd > 1000 && utilization > 0.95) {
        stuckMarkets.push({
          id: id as `0x${string}`,
          totalBorrowAssets: state.totalBorrowAssets,
          totalSupplyShares: state.totalSupplyShares,
          decimals: 6, // will refine below
        })
      }
    }

    if (stuckMarkets.length === 0) continue

    // Step 2b: Read actual loan token decimals for stuck markets
    const paramsCalls = stuckMarkets.map(m => ({
      address: MORPHO_BLUE_ADDRESS as Address,
      abi: MORPHO_BLUE_ABI,
      functionName: 'idToMarketParams' as const,
      args: [m.id] as const,
    }))
    const paramsResults = await client.multicall({ contracts: paramsCalls, allowFailure: true })
    for (let i = 0; i < paramsResults.length; i++) {
      if (paramsResults[i].status === 'success') {
        const params = paramsResults[i].result as unknown as { loanToken: Address }
        try {
          const decimals = await client.readContract({
            address: params.loanToken, abi: ERC20_DECIMALS_ABI, functionName: 'decimals',
          })
          stuckMarkets[i].decimals = decimals

          // Re-check with correct decimals — filter out false positives from WETH markets (18 decimals)
          const actualBorrowUsd = Number(stuckMarkets[i].totalBorrowAssets) / (10 ** decimals)
          if (actualBorrowUsd <= 1000) {
            stuckMarkets[i].totalBorrowAssets = BigInt(0) // mark for skip
          }
        } catch { /* keep default 6 */ }
      }
    }

    // Step 3: For each stuck market, batch-read vault positions via multicall
    for (const mkt of stuckMarkets) {
      if (mkt.totalBorrowAssets <= BigInt(0)) continue // skipped in step 2b

      const posCalls = vaultAddresses.map(addr => ({
        address: MORPHO_BLUE_ADDRESS as Address,
        abi: MORPHO_BLUE_ABI,
        functionName: 'position' as const,
        args: [mkt.id, addr as Address] as const,
      }))

      let curatorSupplyShares = BigInt(0)
      for (let i = 0; i < posCalls.length; i += batchSize) {
        const batch = posCalls.slice(i, i + batchSize)
        const posResults = await client.multicall({ contracts: batch, allowFailure: true })
        for (const pr of posResults) {
          if (pr.status === 'success') {
            const pos = pr.result as unknown as { supplyShares: bigint }
            if (pos.supplyShares > BigInt(0)) curatorSupplyShares += pos.supplyShares
          }
        }
      }

      if (curatorSupplyShares <= BigInt(0) || mkt.totalSupplyShares <= BigInt(0)) continue

      const shareRatio = Number(curatorSupplyShares) / Number(mkt.totalSupplyShares)
      const curatorBadDebtUsd = (Number(mkt.totalBorrowAssets) / (10 ** mkt.decimals)) * shareRatio
      if (curatorBadDebtUsd > 100) {
        totalUnrealizedUsd += curatorBadDebtUsd
      }
    }
  }

  return Math.max(0, totalUnrealizedUsd - realizedBadDebtUsd)
}

/**
 * Detects hardcoded price feeds by checking if `latestRoundData().answer` is
 * identical across 4 historical block samples. Returns a set of feed addresses
 * whose prices never change.
 */
async function detectHardcodedFeeds(
  client: ReturnType<typeof getClient>,
  feeds: Array<{ feedAddress: string; symbol: string }>,
): Promise<Set<string>> {
  if (feeds.length === 0) return new Set()

  const currentBlock = await client.getBlockNumber()
  const current = Number(currentBlock)

  // 4 sample points: now, 1 day ago, 1 week ago, 2 weeks ago
  // If vault is too new (< 2 weeks), distribute evenly across its lifetime
  const twoWeeksBack = current - BLOCKS_PER_WEEK * 2
  const sampleBlocks = twoWeeksBack > 0
    ? [current, current - BLOCKS_PER_DAY, current - BLOCKS_PER_WEEK, twoWeeksBack]
    : [current, Math.floor(current * 0.75), Math.floor(current * 0.5), Math.floor(current * 0.25)]

  const hardcoded = new Set<string>()

  // For each feed, query latestRoundData at all 4 blocks in parallel
  await Promise.all(feeds.map(async ({ feedAddress, symbol }) => {
    try {
      const answers = await Promise.all(
        sampleBlocks.map(block =>
          client.readContract({
            address: feedAddress as `0x${string}`,
            abi: CHAINLINK_ROUND_DATA_ABI_HISTORICAL,
            functionName: 'latestRoundData',
            blockNumber: BigInt(block),
          }).then(([_roundId, answer]) => answer).catch(() => null)
        )
      )

      // Need at least 3 successful reads to judge
      const valid = answers.filter((a): a is bigint => a !== null)
      if (valid.length < 3) return

      // All identical → hardcoded
      const allSame = valid.every(a => a === valid[0])
      if (allSame) {
        hardcoded.add(symbol)
      }
    } catch {
      // Feed doesn't support latestRoundData — skip
    }
  }))

  return hardcoded
}

type MarketAssetsResult = {
  assets: VaultData['assets']
  oracleManipulationSurface: VaultData['oracleManipulationSurface']
  liquidity: VaultLiquidity | null
  hardcodedOracleSymbols: string[]
}

async function fetchMarketAssets(
  vaultAddress: Address,
  chainId: ChainId,
  client: ReturnType<typeof getClient>,
  chainIdNum: number
): Promise<MarketAssetsResult> {
  // API-first: fetch all active market allocations (no market count limit)
  // Fall back to on-chain withdraw queue only if the API call fails
  let apiMarkets: VaultMarketAllocation[] = []
  let apiLiquidity: VaultLiquidity | null = null
  try {
    const result = await fetchVaultAllocation(vaultAddress, chainIdNum)
    apiMarkets = result.allocations
    apiLiquidity = result.liquidity
  } catch {
    // API failed — will fall through to on-chain path below
  }

  if (apiMarkets.length > 0) {
    // Deduplicate by collateral address (aggregate USD if same token appears in multiple markets)
    const seenAddr = new Map<string, { market: VaultMarketAllocation; supplyAssetsUsd: number }>()
    for (const m of apiMarkets) {
      const addr = m.collateralAddress.toLowerCase()
      if (seenAddr.has(addr)) {
        seenAddr.get(addr)!.supplyAssetsUsd += m.supplyAssetsUsd
      } else {
        seenAddr.set(addr, { market: m, supplyAssetsUsd: m.supplyAssetsUsd })
      }
    }
    const deduped = [...seenAddr.values()]
    const totalSupply = deduped.reduce((s, d) => s + d.supplyAssetsUsd, 0)

    // Collect feeds that need hardcoded detection (unique by feed address, skip nulls)
    const feedsToCheck: Array<{ feedAddress: string; symbol: string }> = []
    const seenFeeds = new Set<string>()
    for (const { market } of deduped) {
      const fa = market.baseFeedOneAddress
      if (fa && !seenFeeds.has(fa.toLowerCase())) {
        seenFeeds.add(fa.toLowerCase())
        feedsToCheck.push({ feedAddress: fa, symbol: market.collateralSymbol })
      }
    }

    // Detect oracle types, token metrics, and hardcoded feeds — all in parallel
    const [oracleTypes, tokenMetrics, hardcodedSymbols] = await Promise.all([
      Promise.all(deduped.map(({ market }) =>
        detectOracleType(client, market.oracleAddress as Address)
      )),
      Promise.all(deduped.map(({ market }) =>
        Promise.all([
          fetchTokenVolatility30d(market.collateralAddress, chainIdNum),
          fetchTokenLiquidityUsd(market.collateralAddress, chainIdNum),
        ])
      )),
      detectHardcodedFeeds(client, feedsToCheck).catch(() => new Set<string>()),
    ])

    const uniqueOracleTypes = new Set(oracleTypes as OracleType[])
    const oracleManipulationSurface: VaultData['oracleManipulationSurface'] =
      uniqueOracleTypes.has('custom') ? 'high'
      : uniqueOracleTypes.has('uniswap-twap') ? 'medium'
      : 'low'

    const assets = deduped.map(({ market, supplyAssetsUsd }, i) => {
      const addr = market.collateralAddress.toLowerCase()
      const info = TOKEN_REGISTRY[addr]
      const assetClass = info?.assetClass ?? classifyBySymbol(market.collateralSymbol)
      const weight = totalSupply > 0 ? (supplyAssetsUsd / totalSupply) * 100 : 100 / deduped.length
      const [apiVol, apiLiq] = tokenMetrics[i]

      return {
        address: market.collateralAddress,
        symbol: market.collateralSymbol,
        assetClass,
        oracleType: oracleTypes[i] as OracleType,
        liquidityDepthUsd: Math.max(apiLiq ?? 0, info?.liquidityDepthUsd ?? 0) || defaultLiquidity(assetClass),
        volatility30d: apiVol ?? info?.volatility30d ?? defaultVolatility(assetClass),
        vaultWeightPct: weight,
      }
    })

    return { assets, oracleManipulationSurface, liquidity: apiLiquidity, hardcodedOracleSymbols: [...hardcodedSymbols] }
  }

  // Fallback: on-chain withdraw queue (limited to 15 markets)
  const queueLength = await withRetry(() =>
    client.readContract({ address: vaultAddress, abi: METAMORPHO_ABI, functionName: 'withdrawQueueLength' })
  )
  if (queueLength === BigInt(0)) return { assets: [], oracleManipulationSurface: 'low', liquidity: null, hardcodedOracleSymbols: [] }

  const count = Math.min(Number(queueLength), 15)
  const marketIds = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      withRetry(() => client.readContract({
        address: vaultAddress,
        abi: METAMORPHO_ABI,
        functionName: 'withdrawQueue',
        args: [BigInt(i)],
      }))
    )
  )

  const allParams = await Promise.all(marketIds.map(id =>
    withRetry(() => client.readContract({
      address: MORPHO_BLUE_ADDRESS,
      abi: MORPHO_BLUE_ABI,
      functionName: 'idToMarketParams',
      args: [id],
    }))
  ))

  // Deduplicate by collateral token
  const seen = new Map<string, number>()
  const deduped: Array<{ params: typeof allParams[0] }> = []
  for (let i = 0; i < allParams.length; i++) {
    const addr = allParams[i].collateralToken.toLowerCase()
    if (!seen.has(addr)) {
      seen.set(addr, deduped.length)
      deduped.push({ params: allParams[i] })
    }
  }

  const [symbols, oracleTypes, tokenMetrics] = await Promise.all([
    Promise.all(deduped.map(({ params }) =>
      client.readContract({
        address: params.collateralToken,
        abi: ERC20_SYMBOL_ABI,
        functionName: 'symbol',
      }).catch(() => 'UNKNOWN')
    )),
    Promise.all(deduped.map(({ params }) =>
      detectOracleType(client, params.oracle as Address)
    )),
    Promise.all(deduped.map(({ params }) =>
      Promise.all([
        fetchTokenVolatility30d(params.collateralToken, chainIdNum),
        fetchTokenLiquidityUsd(params.collateralToken, chainIdNum),
      ])
    )),
  ])

  const uniqueOracleTypes = new Set(oracleTypes as OracleType[])
  const oracleManipulationSurface: VaultData['oracleManipulationSurface'] =
    uniqueOracleTypes.has('custom') ? 'high'
    : uniqueOracleTypes.has('uniswap-twap') ? 'medium'
    : 'low'

  const assets = deduped.map(({ params }, i) => {
    const addr = params.collateralToken.toLowerCase()
    const info = TOKEN_REGISTRY[addr]
    const symbol = symbols[i] as string
    const assetClass = info?.assetClass ?? classifyBySymbol(symbol)
    const [apiVol, apiLiq] = tokenMetrics[i]

    return {
      address: params.collateralToken,
      symbol,
      assetClass,
      oracleType: oracleTypes[i] as OracleType,
      liquidityDepthUsd: Math.max(apiLiq ?? 0, info?.liquidityDepthUsd ?? 0) || defaultLiquidity(assetClass),
      volatility30d: apiVol ?? info?.volatility30d ?? defaultVolatility(assetClass),
      vaultWeightPct: 100 / deduped.length, // equal weight — no allocation data in fallback
    }
  })

  return { assets, oracleManipulationSurface, liquidity: null, hardcodedOracleSymbols: [] }
}

/**
 * Build a VaultData for a Morpho Vault V2.
 * V2 uses per-function timelocks, adapter-based allocation, and a different API schema.
 * Asset/liquidation risk is fully scored only when MarketV1 caps are present;
 * Adapter caps are opaque so those dimensions fall back to limited data.
 */
async function fetchMorphoV2VaultData(
  address: string,
  chainId: ChainId,
  v2: Awaited<ReturnType<typeof fetchMorphoV2Data>>
): Promise<VaultData> {

  // Build assets from MarketV1 caps (same logic as V1 markets, minus on-chain oracle detection)
  let assets: VaultData['assets'] = []
  let oracleManipulationSurface: VaultData['oracleManipulationSurface'] = 'low'
  let weightedAvgLltvPct = 80
  let totalRealizedBadDebtUsd = 0
  let incidentCount = 0

  if (v2.markets.length > 0) {
    const totalSupply = v2.markets.reduce((s, m) => s + m.supplyAssetsUsd, 0)
    const hasAnyOracleWarning = v2.markets.some(m => m.hasOracleWarning)
    oracleManipulationSurface = hasAnyOracleWarning ? 'high' : 'low'

    totalRealizedBadDebtUsd = v2.markets.reduce((s, m) => s + m.realizedBadDebtUsd, 0)
    incidentCount = v2.markets.filter(m => m.realizedBadDebtUsd > 1).length

    // Weighted avg LLTV
    const activeMarkets = v2.markets.filter(m => m.lltv !== '0')
    const activeTotalSupply = activeMarkets.reduce((s, m) => s + m.supplyAssetsUsd, 0)
    weightedAvgLltvPct = activeTotalSupply > 0
      ? activeMarkets.reduce((s, m) => {
          const lltv = Number(m.lltv) / 1e18 * 100
          const weight = m.supplyAssetsUsd / activeTotalSupply
          return s + lltv * weight
        }, 0)
      : activeMarkets.length > 0
        ? activeMarkets.reduce((s, m) => s + Number(m.lltv) / 1e18 * 100, 0) / activeMarkets.length
        : 80

    // Fetch real token market data in parallel
    const tokenMetrics = await Promise.all(
      v2.markets.map(m => Promise.all([
        fetchTokenVolatility30d(m.collateralAddress, chainId),
        fetchTokenLiquidityUsd(m.collateralAddress, chainId),
      ]))
    )

    // Deduplicate by collateral address
    const seen = new Set<string>()
    for (let i = 0; i < v2.markets.length; i++) {
      const m = v2.markets[i]
      const addr = m.collateralAddress.toLowerCase()
      if (seen.has(addr)) continue
      seen.add(addr)

      const info = TOKEN_REGISTRY[addr]
      const assetClass = info?.assetClass ?? classifyBySymbol(m.collateralSymbol)
      const weight = totalSupply > 0 ? (m.supplyAssetsUsd / totalSupply) * 100 : 100 / v2.markets.length
      const [apiVol, apiLiq] = tokenMetrics[i]

      // V2 oracle detection: trust Morpho's warning flag, no on-chain probe
      const oracleType: OracleType = m.hasOracleWarning ? 'custom' : 'chainlink'

      assets.push({
        address: m.collateralAddress,
        symbol: m.collateralSymbol,
        assetClass,
        oracleType,
        liquidityDepthUsd: Math.max(apiLiq ?? 0, info?.liquidityDepthUsd ?? 0) || defaultLiquidity(assetClass),
        volatility30d: apiVol ?? info?.volatility30d ?? defaultVolatility(assetClass),
        vaultWeightPct: weight,
      })
    }
  }

  const curatorType: CuratorType = v2.curatorVerified ? 'institution'
    : v2.curatorName ? 'known-team'
    : 'anonymous'

  // V2 uses addAdapter timelock as the key protection gate
  const timelockHours = v2.addAdapterTimelockSeconds / 3600

  // V2 has no guardian — curator can execute changes after timelock
  const permissionScope: VaultData['permissionScope'] = 'broad'

  const liquidationThresholdPct = weightedAvgLltvPct
  const maxLtvPct = Math.max(liquidationThresholdPct - 5, 0)

  // Fetch curator-level bad debt history from The Graph (same as V1 path)
  const allCuratorAddresses = await fetchCuratorAllAddresses(v2.curatorAddress).catch(() => [v2.curatorAddress])
  const curatorHistory = await fetchCuratorBadDebtHistory(allCuratorAddresses).catch(() => null)

  // Realized bad debt from The Graph events or Morpho API
  const realizedBadDebtUsd = curatorHistory && curatorHistory.totalBadDebtUsd > 0
    ? curatorHistory.totalBadDebtUsd
    : totalRealizedBadDebtUsd

  // Detect unrealized bad debt: check historical markets on-chain for stuck borrows
  const unrealizedBadDebtUsd = curatorHistory?.allMarketIds
    ? await detectUnrealizedBadDebt(curatorHistory.allMarketIds, curatorHistory.allVaultAddresses, realizedBadDebtUsd).catch(() => 0)
    : 0

  const historicalBadDebtUsd = realizedBadDebtUsd + unrealizedBadDebtUsd

  const placeholderFields: string[] = [
    'liquidationBonusPct',
    'liquidationMechanism',
    ...(assets.length === 0 ? ['assets', 'maxLtvPct', 'liquidationThresholdPct', 'oracleManipulationSurface'] : []),
    ...(v2.hasAdapterCaps ? ['adapterCapsOpaque'] : []),
  ]

  return {
    address,
    chainId,
    protocol: 'morpho',
    name: v2.name,
    tvlUsd: v2.tvlUsd,
    currentApyPct: v2.currentApyPct,
    apy7dAvg: v2.apy7dAvg,
    apy30dAvg: v2.apy30dAvg,
    apy90dAvg: v2.apy90dAvg,
    apyHistory: v2.apyHistory,
    assets,
    weightedUtilization: v2.weightedUtilization,
    totalMarketLiquidityUsd: v2.totalMarketLiquidityUsd,
    maxLtvPct,
    liquidationThresholdPct,
    liquidationBonusPct: 5,
    liquidationMechanism: 'dutch-auction',
    historicalBadDebtUsd,
    unrealizedBadDebtUsd,
    oracleManipulationSurface,
    hardcodedOracleCount: 0,            // V2 oracle detection not yet implemented
    hardcodedOracleSymbols: [],
    curatorAddress: v2.curatorAddress,
    curatorName: v2.curatorName,
    curatorType,
    permissionScope,
    timelockHours,
    vaultsManaged: Math.max(curatorHistory?.historicalVaultCount ?? 0, v2.vaultsManaged),
    incidentCount: curatorHistory?.affectedMarketCount ?? incidentCount,
    curatorBorrowsFromVault: false,
    hasPublicAllocator: false,
    placeholderFields,
  }
}

/**
 * Fetches all data needed to score a MetaMorpho vault.
 * Fields that could not be fetched are hardcoded to safe-ish defaults
 * and recorded in `placeholderFields` so the UI can show "estimated" labels.
 */
export async function fetchMorphoVaultData(
  address: string,
  chainId: ChainId,
  defillamaPoolId: string
): Promise<VaultData> {
  // Detect Morpho Vault V2: try the V2 API first (fast, no on-chain call needed).
  // V2 vaults are not indexed in the V1 API and have a completely different on-chain interface.
  const v2Data = await fetchMorphoV2Data(address, chainId).catch(() => null)
  if (v2Data !== null) {
    return fetchMorphoV2VaultData(address, chainId, v2Data)
  }

  const client = getClient(chainId)
  const checksumAddress = getAddress(address.toLowerCase()) as Address

  const isDefillamaId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(defillamaPoolId)

  const [name, yieldResult, badDebt, marketResult, curatorData] = await Promise.all([
    withRetry(() => client.readContract({ address: checksumAddress, abi: METAMORPHO_ABI, functionName: 'name' })),
    isDefillamaId
      ? fetchVaultYield(defillamaPoolId).catch(() => fetchMorphoYieldData(address, chainId))
      : fetchMorphoYieldData(address, chainId),
    fetchMorphoBadDebt(address, chainId),
    fetchMarketAssets(checksumAddress, chainId, client, chainId).catch(() => ({ assets: [], oracleManipulationSurface: 'low' as const, liquidity: null, hardcodedOracleSymbols: [] as string[] })),
    fetchMorphoCuratorData(address, chainId).catch(() => null),
  ])
  const yield_ = yieldResult
  const { assets, liquidity, hardcodedOracleSymbols } = marketResult
  // When Morpho API is available, trust its oracle validation over on-chain detection.
  // On-chain detectOracleType() misclassifies MorphoChainlinkOracleV2 as 'custom' when
  // BASE_FEED_ONE() reverts (zero address). Morpho's incorrect_oracle_configuration warning
  // is the authoritative source — if it's not flagged, the oracle is fine.
  const oracleManipulationSurface: VaultData['oracleManipulationSurface'] = curatorData
    ? (curatorData.hasOracleWarning ? 'high' : 'low')
    : marketResult.oracleManipulationSurface

  // Derive curator type from Morpho's verification status
  const curatorType: CuratorType = curatorData?.curatorVerified ? 'institution'
    : curatorData?.curatorName ? 'known-team'
    : 'anonymous'

  const timelockHours = curatorData
    ? curatorData.timelockSeconds / 3600
    : 0

  // Derive permission scope from guardian address:
  // no guardian (zero address) = curator can change anything → broad
  // real guardian = a separate entity can veto changes → narrow
  const ZERO = '0x0000000000000000000000000000000000000000'
  const permissionScope: VaultData['permissionScope'] = curatorData
    ? (curatorData.guardian === ZERO ? 'broad' : 'narrow')
    : 'medium'

  // Liquidation threshold = weighted avg LLTV; maxLtv = threshold - 5% (practical safe buffer)
  const liquidationThresholdPct = curatorData?.weightedAvgLltvPct ?? 85
  const maxLtvPct = Math.max(liquidationThresholdPct - 5, 0)

  // Fetch curator-level bad debt history from The Graph (immutable, can't be "washed").
  // Resolve ALL addresses this curator uses across chains (same entity, different addresses).
  const effectiveCurator = curatorData?.curatorAddress ?? address
  const allCuratorAddresses = await fetchCuratorAllAddresses(effectiveCurator).catch(() => [effectiveCurator])
  const curatorHistory = await fetchCuratorBadDebtHistory(allCuratorAddresses).catch(() => null)

  // Priority: The Graph (immutable history) > Morpho API (current state) > legacy subgraph
  const realizedBadDebtUsd = curatorHistory && curatorHistory.totalBadDebtUsd > 0
    ? curatorHistory.totalBadDebtUsd
    : curatorData?.totalRealizedBadDebtUsd ?? badDebt

  // Detect unrealized bad debt on-chain
  const unrealizedBadDebtUsd = curatorHistory?.allMarketIds
    ? await detectUnrealizedBadDebt(curatorHistory.allMarketIds, curatorHistory.allVaultAddresses, realizedBadDebtUsd).catch(() => 0)
    : 0
  const historicalBadDebtUsd = realizedBadDebtUsd + unrealizedBadDebtUsd

  const placeholderFields: string[] = [
    'liquidationBonusPct',
    'liquidationMechanism',
    ...(assets.length === 0 ? ['assets'] : []),
    ...(curatorData === null ? ['curatorType', 'vaultsManaged', 'permissionScope', 'incidentCount', 'curatorBorrowsFromVault', 'maxLtvPct', 'liquidationThresholdPct', 'oracleManipulationSurface'] : []),
  ]

  return {
    address,
    chainId,
    protocol: 'morpho',
    name: curatorData?.vaultName || (name as string).trim(),
    tvlUsd: yield_.tvlUsd,
    currentApyPct: yield_.currentApyPct,
    apy7dAvg: yield_.apy7dAvg,
    apy30dAvg: yield_.apy30dAvg,
    apy90dAvg: yield_.apy90dAvg,
    apyHistory: yield_.apyHistory,
    assets,
    weightedUtilization: liquidity?.weightedUtilization ?? 0,
    totalMarketLiquidityUsd: liquidity?.totalMarketLiquidityUsd ?? yield_.tvlUsd,
    maxLtvPct,
    liquidationThresholdPct,
    liquidationBonusPct: 5,
    liquidationMechanism: 'dutch-auction',
    historicalBadDebtUsd,
    unrealizedBadDebtUsd,
    oracleManipulationSurface,
    hardcodedOracleCount: hardcodedOracleSymbols.length,
    hardcodedOracleSymbols,
    curatorAddress: curatorData?.curatorAddress ?? address,
    curatorName: curatorData?.curatorName ?? null,
    curatorType,
    permissionScope,
    timelockHours,
    vaultsManaged: Math.max(curatorHistory?.historicalVaultCount ?? 0, curatorData?.vaultsManaged ?? 1),
    incidentCount: curatorHistory?.affectedMarketCount ?? curatorData?.incidentCount ?? 0,
    curatorBorrowsFromVault: curatorData?.curatorBorrowsFromVault ?? false,
    hasPublicAllocator: curatorData?.hasPublicAllocator ?? false,
    placeholderFields,
  }
}
