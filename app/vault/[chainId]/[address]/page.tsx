import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { SkeletonCard } from '@/components/SkeletonCard'
import { fetchMorphoVaultData } from '@/lib/scoring/protocols/morpho'
import { scoreVault } from '@/lib/scoring/composite'
import featuredVaults from '@/data/featured-vaults.json'
import type { ChainId } from '@/lib/scoring/types'
import { VaultDetailView } from './VaultDetailView'

const SUPPORTED: ChainId[] = [1, 8453]

async function VaultContent({ chainId, address }: { chainId: string; address: string }) {
  const cid = parseInt(chainId) as ChainId
  if (!SUPPORTED.includes(cid)) notFound()

  const featured = featuredVaults.find(
    v => v.address.toLowerCase() === address.toLowerCase() && v.chainId === cid
  )
  const defillamaPoolId = featured?.defillamaPoolId ?? address

  let score
  let fetchError: string | null = null
  try {
    const fetchTime = Date.now()
    const vaultData = await fetchMorphoVaultData(address, cid, defillamaPoolId)
    score = scoreVault(vaultData, fetchTime)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    // Only 404 if we're confident it's not a vault — RPC errors say "contract" or "revert"
    const isNotVault = /ContractFunctionExecutionError|does not match|revert|invalid address/i.test(msg)
    if (isNotVault) notFound()
    fetchError = msg
  }

  if (fetchError || !score) {
    return (
      <main className="min-h-screen bg-brand-bg text-brand-cream p-8 flex items-center justify-center">
        <div className="max-w-md text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold mb-2">Unable to load vault data</h1>
          <p className="text-brand-light text-sm mb-4">
            This could be a temporary network issue or the vault may not be supported yet.
          </p>
          <p className="text-brand-light/60 text-xs font-mono break-all mb-6">{address}</p>
          <a href="/" className="text-brand hover:text-brand-cream text-sm">← Back to search</a>
        </div>
      </main>
    )
  }

  return <VaultDetailView score={score} address={address} chainId={cid} />
}

export default function VaultPage({ params }: { params: { chainId: string; address: string } }) {
  return (
    <main className="min-h-screen bg-brand-bg text-brand-cream p-8">
      <Suspense fallback={
        <div className="max-w-3xl mx-auto flex flex-col gap-4">
          <SkeletonCard rows={2} />
          <SkeletonCard rows={5} />
          <SkeletonCard rows={5} />
          <SkeletonCard rows={5} />
        </div>
      }>
        <VaultContent chainId={params.chainId} address={params.address} />
      </Suspense>
    </main>
  )
}
