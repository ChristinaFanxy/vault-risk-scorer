'use client'

import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'
import type { BadDebtEvent } from '@/lib/thegraph'

const CHAIN_LABELS: Record<number, string> = { 1: 'Ethereum', 8453: 'Base' }

function morphoMarketUrl(marketId: string, chainId: number): string {
  const network = chainId === 8453 ? 'base' : 'ethereum'
  return `https://app.morpho.org/${network}/market/${marketId}`
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(2)}K`
  return `$${n.toFixed(2)}`
}

function shortenId(id: string): string {
  return `${id.slice(0, 10)}...${id.slice(-8)}`
}

interface CuratorDetailViewProps {
  address: string
  allAddresses: string[]
  totalBadDebtUsd: number
  unrealizedBadDebtUsd: number
  unrealizedMarkets: Array<{ marketId: string; chainId: number; badDebtUsd: number }>
  eventCount: number
  affectedMarketCount: number
  historicalVaultCount: number
  events: BadDebtEvent[]
}

export default function CuratorDetailView({
  address,
  allAddresses,
  totalBadDebtUsd,
  unrealizedBadDebtUsd,
  unrealizedMarkets,
  eventCount,
  affectedMarketCount,
  historicalVaultCount,
  events,
}: CuratorDetailViewProps) {
  const { t } = useLanguage()

  return (
    <div className="min-h-screen bg-brand-bg text-brand-cream p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href="/" className="text-brand hover:text-brand-cream text-sm mb-4 inline-block">
          {t.backToSearch}
        </Link>
        <h1 className="text-2xl font-bold text-brand-cream">{t.curatorBadDebtHistory}</h1>
        <p className="text-sm text-brand-light mt-1 font-mono">{address}</p>
        {allAddresses.length > 1 && (
          <p className="text-xs text-brand-light/60 mt-1">
            + {allAddresses.length - 1} other address(es) across chains
          </p>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-brand-card border border-brand-border rounded-lg p-4">
          <p className="text-xs text-brand-light">{t.realizedBadDebt}</p>
          <p className={`text-xl font-bold ${totalBadDebtUsd > 0 ? 'text-red-400' : 'text-brand-olive'}`}>
            {totalBadDebtUsd > 0 ? fmtUsd(totalBadDebtUsd) : t.none}
          </p>
          <p className="text-xs text-brand-light/60 mt-0.5">{eventCount} event(s) across {affectedMarketCount} market(s)</p>
        </div>
        <div className="bg-brand-card border border-brand-border rounded-lg p-4">
          <p className="text-xs text-brand-light">{t.unrealizedBadDebt}</p>
          <p className={`text-xl font-bold ${unrealizedBadDebtUsd > 0 ? 'text-orange-400' : 'text-brand-olive'}`}>
            {unrealizedBadDebtUsd > 0 ? fmtUsd(unrealizedBadDebtUsd) : t.none}
          </p>
          <p className="text-xs text-brand-light/60 mt-0.5">{t.stuckBorrows}</p>
        </div>
        <div className="bg-brand-card border border-brand-border rounded-lg p-4">
          <p className="text-xs text-brand-light">{t.historicalVaults}</p>
          <p className="text-xl font-bold text-brand-cream">{historicalVaultCount}</p>
        </div>
      </div>

      {/* Unrealized bad debt warning */}
      {unrealizedBadDebtUsd > 0 && (
        <div className="bg-orange-900/20 border border-orange-800/50 rounded-lg p-4 mb-8">
          <h2 className="text-sm font-medium text-orange-400 mb-1">{t.unrealizedDetected}</h2>
          <p className="text-xs text-brand-light leading-relaxed">
            {t.unrealizedDesc(fmtUsd(unrealizedBadDebtUsd))}
          </p>
          {unrealizedMarkets.length > 0 && (
            <div className="mt-3 space-y-1">
              {unrealizedMarkets.sort((a, b) => b.badDebtUsd - a.badDebtUsd).map(m => (
                <div key={m.marketId} className="flex items-center gap-2 text-xs">
                  <a
                    href={morphoMarketUrl(m.marketId, m.chainId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-orange-400 hover:text-orange-300 font-mono"
                  >
                    {shortenId(m.marketId)}
                  </a>
                  <span className="text-brand-light/60">{CHAIN_LABELS[m.chainId] ?? `Chain ${m.chainId}`}</span>
                  <span className="text-orange-300 font-medium">{fmtUsd(m.badDebtUsd)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Events table */}
      {events.length === 0 && unrealizedBadDebtUsd === 0 ? (
        <div className="bg-brand-card border border-brand-border rounded-lg p-8 text-center">
          <p className="text-brand-olive text-lg font-medium">{t.cleanRecord}</p>
          <p className="text-brand-light text-sm mt-1">{t.noBadDebt}</p>
        </div>
      ) : events.length === 0 ? null : (
        <div className="bg-brand-card border border-brand-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-border">
            <h2 className="text-sm font-medium text-brand-cream">{t.badDebtEvents}</h2>
            <p className="text-xs text-brand-light/60 mt-0.5">
              {t.badDebtEventsDesc}
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-brand-border text-brand-light text-xs">
                <th className="text-left px-4 py-2 font-medium">{t.market}</th>
                <th className="text-left px-4 py-2 font-medium">{t.chain}</th>
                <th className="text-right px-4 py-2 font-medium">{t.badDebtUsd}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt: BadDebtEvent, i: number) => (
                <tr key={`${evt.marketId}-${i}`} className="border-b border-brand-border/50 hover:bg-brand-border/30">
                  <td className="px-4 py-2">
                    <a
                      href={morphoMarketUrl(evt.marketId, evt.chainId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand hover:text-brand-cream font-mono text-xs"
                    >
                      {shortenId(evt.marketId)}
                    </a>
                  </td>
                  <td className="px-4 py-2 text-brand-light">
                    {CHAIN_LABELS[evt.chainId] ?? `Chain ${evt.chainId}`}
                  </td>
                  <td className="px-4 py-2 text-right text-red-400 font-medium">
                    {fmtUsd(evt.badDebtUsd)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div className="mt-8 text-xs text-brand-light/60 border-t border-brand-border pt-4">
        <p>{t.dataSource}</p>
        <p className="mt-1">{t.sharedMarkets}</p>
      </div>
    </div>
  )
}
