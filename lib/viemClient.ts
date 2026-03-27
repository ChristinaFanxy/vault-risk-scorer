// lib/viemClient.ts
import { createPublicClient, http } from 'viem'
import { mainnet, base } from 'viem/chains'
import type { ChainId } from '@/lib/scoring/types'

function rpcUrl(chain: 'mainnet' | 'base'): string {
  const key = process.env.ALCHEMY_API_KEY
  if (key) {
    return chain === 'mainnet'
      ? `https://eth-mainnet.g.alchemy.com/v2/${key}`
      : `https://base-mainnet.g.alchemy.com/v2/${key}`
  }
  // Fall back to public RPC endpoints (rate-limited but usable for dev/demo)
  return chain === 'mainnet'
    ? 'https://eth.llamarpc.com'
    : 'https://base.llamarpc.com'
}

export function getClient(chainId: ChainId) {
  if (chainId === 1) return createPublicClient({ chain: mainnet, transport: http(rpcUrl('mainnet')) })
  if (chainId === 8453) return createPublicClient({ chain: base, transport: http(rpcUrl('base')) })
  throw new Error(`Unsupported chainId: ${chainId}`)
}

export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    console.warn('[withRetry] RPC call failed, retrying once:', err instanceof Error ? err.message : err)
    return await fn()  // one retry
  }
}
