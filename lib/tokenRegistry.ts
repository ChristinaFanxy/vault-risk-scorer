// lib/tokenRegistry.ts
// Well-known token registry and classification helpers.
// Extracted from morpho.ts for maintainability.

import type { AssetClass } from '@/lib/scoring/types'

type TokenInfo = { assetClass: AssetClass; liquidityDepthUsd: number; volatility30d: number }

// Keyed by lowercase address.
// liquidityDepthUsd: representative on-chain DEX + CEX depth (order-of-magnitude estimate).
// volatility30d: 30-day price return stddev (decimal). Stablecoins ≈ 0.001, ETH ≈ 0.08.
export const TOKEN_REGISTRY: Record<string, TokenInfo> = {
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
  // ── Arbitrum stablecoins ──
  '0xaf88d065e77c8cc2239327c5edb3a432268e5831': { assetClass: 'stablecoin', liquidityDepthUsd: 2_000_000_000, volatility30d: 0.001 }, // USDC on Arbitrum
  '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': { assetClass: 'stablecoin', liquidityDepthUsd: 1_500_000_000, volatility30d: 0.001 }, // USDT on Arbitrum
  '0xda10009cbd5d07dd0cecc66161fc93d7c9000da1': { assetClass: 'stablecoin', liquidityDepthUsd: 200_000_000,   volatility30d: 0.001 }, // DAI on Arbitrum
  // ── Arbitrum blue-chip ──
  '0x82af49447d8a07e3bd95bd0d56f35241523fbab1': { assetClass: 'blue-chip',  liquidityDepthUsd: 1_500_000_000, volatility30d: 0.08 },  // WETH on Arbitrum
  '0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f': { assetClass: 'blue-chip',  liquidityDepthUsd: 500_000_000,   volatility30d: 0.07 },  // WBTC on Arbitrum
  '0x5979d7b546e38e9ab8ed1af5903fa09bcebf38b0': { assetClass: 'blue-chip',  liquidityDepthUsd: 200_000_000,   volatility30d: 0.08 },  // wstETH on Arbitrum
}

export function classifyBySymbol(symbol: string): AssetClass {
  const s = symbol.toUpperCase()
  if (/^(USDC|USDT|DAI|PYUSD|USDS|USDE|SUSDE|SDAI|FRAX|LUSD|CRVUSD|GHO|EURS|GUSD|BUSD|TUSD|USDP|USDD|FDUSD)/.test(s)) return 'stablecoin'
  if (/^(WETH|ETH|WBTC|BTC|CBBTC|WSTETH|STETH|RETH|WEETH|CBETH|METH|SFRXETH|ANKRETH)/.test(s)) return 'blue-chip'
  return 'long-tail'
}

export function defaultLiquidity(cls: AssetClass): number {
  return cls === 'stablecoin' ? 100_000_000 : cls === 'blue-chip' ? 200_000_000 : 10_000_000
}

export function defaultVolatility(cls: AssetClass): number {
  return cls === 'stablecoin' ? 0.002 : cls === 'blue-chip' ? 0.10 : 0.25
}
