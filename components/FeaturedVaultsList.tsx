'use client'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'

interface FeaturedVault {
  name: string
  address: string
  chainId: number
  protocol: string
  tags: string[]
}

const CHAIN_LABELS: Record<number, string> = { 1: 'Ethereum', 8453: 'Base', 42161: 'Arbitrum' }

export function FeaturedVaultsList({ vaults }: { vaults: FeaturedVault[] }) {
  const { t } = useLanguage()

  return (
    <div className="w-full max-w-2xl">
      <div className="flex flex-col gap-3">
        {vaults.map(v => (
          <Link
            key={`${v.chainId}-${v.address}`}
            href={`/vault/${v.chainId}/${v.address}`}
            className="bg-brand-card border border-brand-border hover:border-brand rounded-xl px-5 py-4 flex items-center justify-between transition-colors"
          >
            <div>
              <p className="text-brand-cream text-base font-medium">{v.name}</p>
              <p className="text-brand-light text-sm mt-1 font-mono">{v.address.slice(0, 10)}…</p>
            </div>
            <div className="flex gap-2">
              <span className="text-sm bg-brand-bg text-brand-cream px-2 py-0.5 rounded">{v.protocol}</span>
              <span className="text-sm bg-brand-bg text-brand-light px-2 py-0.5 rounded">
                {CHAIN_LABELS[v.chainId] ?? `Chain ${v.chainId}`}
              </span>
            </div>
          </Link>
        ))}
        {vaults.length === 0 && (
          <p className="text-brand-light text-sm">{t.noVaults}</p>
        )}
      </div>
    </div>
  )
}
