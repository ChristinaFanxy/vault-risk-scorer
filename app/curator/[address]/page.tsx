import { notFound } from 'next/navigation'
import Link from 'next/link'
import { fetchCuratorAllAddresses } from '@/lib/morphoApi'
import { fetchCuratorBadDebtHistory, type BadDebtEvent } from '@/lib/thegraph'
import { detectUnrealizedBadDebt } from '@/lib/scoring/protocols/morpho'

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

export default async function CuratorPage({
  params,
}: {
  params: Promise<{ address: string }>
}) {
  const { address } = await params
  if (!/^0x[0-9a-fA-F]{40}$/i.test(address)) notFound()

  const allAddresses = await fetchCuratorAllAddresses(address)
  const history = await fetchCuratorBadDebtHistory(allAddresses)

  const events = history?.events ?? []
  const totalBadDebtUsd = history?.totalBadDebtUsd ?? 0
  const eventCount = history?.eventCount ?? 0
  const affectedMarketCount = history?.affectedMarketCount ?? 0
  const historicalVaultCount = history?.historicalVaultCount ?? 0

  // Detect unrealized bad debt on-chain
  const unrealizedResult = history?.allMarketIds
    ? await detectUnrealizedBadDebt(history.allMarketIds, history.allVaultAddresses, totalBadDebtUsd).catch(() => ({ totalUsd: 0, markets: [] as Array<{ marketId: string; chainId: number; badDebtUsd: number }> }))
    : { totalUsd: 0, markets: [] as Array<{ marketId: string; chainId: number; badDebtUsd: number }> }
  const unrealizedBadDebtUsd = unrealizedResult.totalUsd
  const unrealizedMarkets = unrealizedResult.markets

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <Link href="/" className="text-indigo-400 hover:text-indigo-300 text-sm mb-4 inline-block">
          ← Back to search
        </Link>
        <h1 className="text-2xl font-bold text-white">Curator Bad Debt History</h1>
        <p className="text-sm text-gray-500 mt-1 font-mono">{address}</p>
        {allAddresses.length > 1 && (
          <p className="text-xs text-gray-600 mt-1">
            + {allAddresses.length - 1} other address(es) across chains
          </p>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500">Realized Bad Debt</p>
          <p className={`text-xl font-bold ${totalBadDebtUsd > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {totalBadDebtUsd > 0 ? fmtUsd(totalBadDebtUsd) : 'None'}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">{eventCount} event(s) across {affectedMarketCount} market(s)</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500">Unrealized Bad Debt</p>
          <p className={`text-xl font-bold ${unrealizedBadDebtUsd > 0 ? 'text-orange-400' : 'text-green-400'}`}>
            {unrealizedBadDebtUsd > 0 ? fmtUsd(unrealizedBadDebtUsd) : 'None'}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">Stuck borrows detected on-chain</p>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <p className="text-xs text-gray-500">Historical Vaults</p>
          <p className="text-xl font-bold text-gray-200">{historicalVaultCount}</p>
        </div>
      </div>

      {/* Unrealized bad debt warning */}
      {unrealizedBadDebtUsd > 0 && (
        <div className="bg-orange-900/20 border border-orange-800/50 rounded-lg p-4 mb-8">
          <h2 className="text-sm font-medium text-orange-400 mb-1">Unrealized Bad Debt Detected</h2>
          <p className="text-xs text-gray-400 leading-relaxed">
            {fmtUsd(unrealizedBadDebtUsd)} in stuck borrows found across historical markets.
            These are markets with {'>'}95% utilization where this curator&apos;s vaults still have supply positions
            but borrowers have not repaid. The protocol has not formally &quot;realized&quot; this as bad debt yet,
            but the funds are effectively locked.
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
                  <span className="text-gray-600">{CHAIN_LABELS[m.chainId] ?? `Chain ${m.chainId}`}</span>
                  <span className="text-orange-300 font-medium">{fmtUsd(m.badDebtUsd)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Events table */}
      {events.length === 0 && unrealizedBadDebtUsd === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 text-center">
          <p className="text-green-400 text-lg font-medium">Clean record</p>
          <p className="text-gray-500 text-sm mt-1">No bad debt events found across any chain</p>
        </div>
      ) : events.length === 0 ? null : (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h2 className="text-sm font-medium text-gray-300">Bad Debt Events</h2>
            <p className="text-xs text-gray-600 mt-0.5">
              Sorted by amount (descending). Data from The Graph — immutable on-chain records.
            </p>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-500 text-xs">
                <th className="text-left px-4 py-2 font-medium">Market</th>
                <th className="text-left px-4 py-2 font-medium">Chain</th>
                <th className="text-right px-4 py-2 font-medium">Bad Debt (USD)</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt: BadDebtEvent, i: number) => (
                <tr key={`${evt.marketId}-${i}`} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                  <td className="px-4 py-2">
                    <a
                      href={morphoMarketUrl(evt.marketId, evt.chainId)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 font-mono text-xs"
                    >
                      {shortenId(evt.marketId)}
                    </a>
                  </td>
                  <td className="px-4 py-2 text-gray-400">
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
      <div className="mt-8 text-xs text-gray-600 border-t border-gray-800 pt-4">
        <p>Data source: The Graph Morpho Blue subgraph (immutable on-chain data)</p>
        <p className="mt-1">Shared markets may attribute the same bad debt to multiple curators.</p>
      </div>
    </div>
  )
}
