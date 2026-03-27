// app/api/vault/[chainId]/[address]/route.ts
import { NextResponse } from 'next/server'
import { fetchMorphoVaultData } from '@/lib/scoring/protocols/morpho'
import { scoreVault } from '@/lib/scoring/composite'
import featuredVaults from '@/data/featured-vaults.json'
import type { ChainId } from '@/lib/scoring/types'

const SUPPORTED_CHAIN_IDS: ChainId[] = [1, 8453]

export async function GET(
  _req: Request,
  { params }: { params: { chainId: string; address: string } }
) {
  const chainId = parseInt(params.chainId) as ChainId
  const address = params.address.toLowerCase()

  if (!SUPPORTED_CHAIN_IDS.includes(chainId)) {
    return NextResponse.json(
      { error: `Chain ${chainId} not supported. Supported: ${SUPPORTED_CHAIN_IDS.join(', ')}` },
      { status: 400 }
    )
  }

  const featured = featuredVaults.find(
    v => v.address.toLowerCase() === address && v.chainId === chainId
  )
  const defillamaPoolId = featured?.defillamaPoolId ?? address

  const fetchTime = Date.now()
  try {
    const vaultData = await fetchMorphoVaultData(address, chainId, defillamaPoolId)
    const score = scoreVault(vaultData, fetchTime)
    return NextResponse.json(score)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    // TODO: replace string-match with instanceof VaultNotFoundError once fetchMorphoVaultData uses typed errors
    if (message.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: 'Vault not found or not supported' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Data temporarily unavailable', detail: message },
      { status: 503 }
    )
  }
}
