'use client'
import { useState } from 'react'
import Link from 'next/link'

interface FeaturedVault {
  name: string
  address: string
  chainId: number
  protocol: string
  tags: string[]
}

const CHAIN_LABELS: Record<number, string> = { 1: 'Ethereum', 8453: 'Base' }

export function FeaturedVaultsList({ vaults }: { vaults: FeaturedVault[] }) {
  const [chainFilter, setChainFilter] = useState<number | null>(null)
  const [protocolFilter, setProtocolFilter] = useState<string | null>(null)

  const chains = [...new Set(vaults.map(v => v.chainId))]
  const protocols = [...new Set(vaults.map(v => v.protocol))]

  const filtered = vaults.filter(v =>
    (chainFilter == null || v.chainId === chainFilter) &&
    (protocolFilter == null || v.protocol === protocolFilter)
  )

  return (
    <div className="w-full max-w-2xl">
      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setChainFilter(null)}
          aria-pressed={chainFilter == null}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${chainFilter == null ? 'border-indigo-500 text-indigo-300 bg-indigo-900/30' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
        >
          All chains
        </button>
        {chains.map(c => (
          <button
            key={c}
            onClick={() => setChainFilter(chainFilter === c ? null : c)}
            aria-pressed={chainFilter === c}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${chainFilter === c ? 'border-indigo-500 text-indigo-300 bg-indigo-900/30' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
          >
            {CHAIN_LABELS[c] ?? `Chain ${c}`}
          </button>
        ))}
        {protocols.map(p => (
          <button
            key={p}
            onClick={() => setProtocolFilter(protocolFilter === p ? null : p)}
            aria-pressed={protocolFilter === p}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${protocolFilter === p ? 'border-indigo-500 text-indigo-300 bg-indigo-900/30' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex flex-col gap-3">
        {filtered.map(v => (
          <Link
            key={`${v.chainId}-${v.address}`}
            href={`/vault/${v.chainId}/${v.address}`}
            className="bg-gray-900 border border-gray-700 hover:border-indigo-500 rounded-xl px-5 py-4 flex items-center justify-between transition-colors"
          >
            <div>
              <p className="text-white font-medium">{v.name}</p>
              <p className="text-gray-500 text-xs mt-0.5 font-mono">{v.address.slice(0, 10)}…</p>
            </div>
            <div className="flex gap-2">
              <span className="text-xs bg-indigo-900 text-indigo-300 px-2 py-0.5 rounded">{v.protocol}</span>
              <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                {CHAIN_LABELS[v.chainId] ?? `Chain ${v.chainId}`}
              </span>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="text-gray-600 text-sm">No vaults match the selected filters.</p>
        )}
      </div>
    </div>
  )
}
