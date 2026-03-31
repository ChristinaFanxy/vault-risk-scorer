// lib/viemClient.ts
import { createPublicClient, http, type PublicClient } from 'viem'
import { mainnet, base, arbitrum } from 'viem/chains'
import type { ChainId } from '@/lib/scoring/types'

// Multi-key rotation: ALCHEMY_API_KEY can be comma-separated (e.g. "key1,key2")
// On 429 errors, withRetry will rotate to the next key automatically.
const alchemyKeys = (process.env.ALCHEMY_API_KEY ?? '').split(',').map(k => k.trim()).filter(Boolean)
let currentKeyIndex = 0

function nextKey(): string | null {
  if (alchemyKeys.length === 0) return null
  currentKeyIndex = (currentKeyIndex + 1) % alchemyKeys.length
  return alchemyKeys[currentKeyIndex]
}

function rpcUrl(chain: 'mainnet' | 'base' | 'arbitrum', keyOverride?: string): string {
  const key = keyOverride ?? alchemyKeys[currentKeyIndex]
  if (key) {
    const hosts: Record<string, string> = {
      mainnet: 'eth-mainnet',
      base: 'base-mainnet',
      arbitrum: 'arb-mainnet',
    }
    return `https://${hosts[chain]}.g.alchemy.com/v2/${key}`
  }
  // Fall back to public RPC endpoints (rate-limited but usable for dev/demo)
  const fallbacks: Record<string, string> = {
    mainnet: 'https://eth.llamarpc.com',
    base: 'https://base.llamarpc.com',
    arbitrum: 'https://arb1.arbitrum.io/rpc',
  }
  return fallbacks[chain]
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CHAIN_CONFIG: Partial<Record<ChainId, { chain: any; name: 'mainnet' | 'base' | 'arbitrum' }>> = {
  1: { chain: mainnet, name: 'mainnet' },
  8453: { chain: base, name: 'base' },
  42161: { chain: arbitrum, name: 'arbitrum' },
}

// Cache clients per chainId + key index to reuse connections
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const clients = new Map<string, PublicClient<any, any>>()

export function getClient(chainId: ChainId) {
  const cacheKey = `${chainId}-${currentKeyIndex}`
  const existing = clients.get(cacheKey)
  if (existing) return existing

  const cfg = CHAIN_CONFIG[chainId]
  if (!cfg) throw new Error(`Unsupported chainId: ${chainId}`)

  const client = createPublicClient({ chain: cfg.chain, transport: http(rpcUrl(cfg.name)) })
  clients.set(cacheKey, client)
  return client
}

/** Rebuild client for a chainId using a different key (after 429) */
function rotateClient(chainId: ChainId): void {
  const newKey = nextKey()
  if (!newKey) return
  const cfg = CHAIN_CONFIG[chainId]
  if (!cfg) return
  const cacheKey = `${chainId}-${currentKeyIndex}`
  const client = createPublicClient({ chain: cfg.chain, transport: http(rpcUrl(cfg.name, newKey)) })
  clients.set(cacheKey, client)
}

export async function withRetry<T>(fn: () => Promise<T>, chainId?: ChainId): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // On 429 (rate limit), rotate to next Alchemy key before retrying
    if (alchemyKeys.length > 1 && /429|Too Many Requests/i.test(msg) && chainId) {
      console.warn(`[withRetry] 429 on key #${currentKeyIndex}, rotating to next key`)
      rotateClient(chainId)
    } else {
      console.warn('[withRetry] RPC call failed, retrying once:', msg)
    }
    return await fn()
  }
}
