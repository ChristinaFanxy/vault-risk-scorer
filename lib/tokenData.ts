// lib/tokenData.ts
// Real token volatility (DefiLlama) and DEX liquidity (DexScreener).
// Both APIs are free with no key required.

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000'

const DEFILLAMA_CHAIN: Record<number, string> = {
  1: 'ethereum',
  8453: 'base',
}

const DEXSCREENER_CHAIN: Record<number, string> = {
  1: 'ethereum',
  8453: 'base',
}

/**
 * 30-day realized volatility from DefiLlama daily price history.
 * Returns stddev of daily log returns × sqrt(30) — i.e. monthly-scale vol.
 * Returns null if token not found or insufficient history.
 */
export async function fetchTokenVolatility30d(
  tokenAddress: string,
  chainId: number
): Promise<number | null> {
  if (tokenAddress.toLowerCase() === ZERO_ADDRESS) return null
  const chain = DEFILLAMA_CHAIN[chainId]
  if (!chain) return null

  const start = Math.floor(Date.now() / 1000) - 32 * 86400 // 32d to ensure 30 returns
  const url = `https://coins.llama.fi/chart/${chain}:${tokenAddress}?start=${start}&span=32&period=1d`

  try {
    const res = await fetch(url, { next: { revalidate: 3600 } })
    if (!res.ok) return null
    const data = await res.json() as { coins: Record<string, { prices: Array<{ timestamp: number; price: number }> }> }

    const entry = Object.values(data.coins ?? {})[0]
    const prices = entry?.prices ?? []
    if (prices.length < 5) return null

    const returns: number[] = []
    for (let i = 1; i < prices.length; i++) {
      if (prices[i - 1].price > 0) {
        returns.push(Math.log(prices[i].price / prices[i - 1].price))
      }
    }
    if (returns.length < 4) return null

    const mean = returns.reduce((s, r) => s + r, 0) / returns.length
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length
    // Scale daily stddev to 30-day (monthly) equivalent
    return Math.sqrt(variance) * Math.sqrt(30)
  } catch {
    return null
  }
}

/**
 * Total DEX liquidity for a token on a specific chain from DexScreener.
 * Sums liquidity.usd across all trading pairs on that chain.
 * Returns null if token not found on any DEX.
 */
export async function fetchTokenLiquidityUsd(
  tokenAddress: string,
  chainId: number
): Promise<number | null> {
  if (tokenAddress.toLowerCase() === ZERO_ADDRESS) return null
  const chainName = DEXSCREENER_CHAIN[chainId]
  if (!chainName) return null

  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${tokenAddress}`,
      { next: { revalidate: 3600 } }
    )
    if (!res.ok) return null
    const data = await res.json() as { pairs?: Array<{ chainId: string; liquidity?: { usd?: number } }> }

    const total = (data.pairs ?? [])
      .filter(p => p.chainId === chainName)
      .reduce((s, p) => s + (p.liquidity?.usd ?? 0), 0)

    return total > 0 ? total : null
  } catch {
    return null
  }
}
