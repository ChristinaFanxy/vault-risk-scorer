'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useLanguage } from '@/lib/i18n'
import type { CuratorRanking } from '@/lib/scoring/curatorLeaderboard'

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-800'
  if (score >= 50) return 'text-yellow-800'
  return 'text-red-700'
}

function fmtUsd(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

function badge(good: boolean, label: string) {
  return good
    ? <span className="inline-block text-xs px-2 py-0.5 rounded border bg-green-100 text-green-800 border-green-300">{label}</span>
    : <span className="inline-block text-xs px-2 py-0.5 rounded border bg-red-100 text-red-800 border-red-300">{label}</span>
}

type SortKey = 'compositeScore' | 'scaleScore' | 'yieldScore' | 'safetyScore' | 'governanceScore' | 'assetQualityScore' | 'totalTvlUsd' | 'weightedApyPct'

interface Props {
  rankings: CuratorRanking[]
  generatedAt: number
}

function DetailPanel({ r }: { r: CuratorRanking }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 bg-brand-bg/50 text-sm">
      {/* Scale */}
      <div className="bg-brand-card border border-brand-border rounded-lg p-3">
        <h4 className="font-semibold text-brand-cream mb-2">Scale <span className={`ml-1 ${scoreColor(r.scaleScore)}`}>{r.scaleScore}</span></h4>
        <div className="space-y-1 text-brand-light">
          <p>Total TVL: <span className="text-brand-cream font-medium">{fmtUsd(r.totalTvlUsd)}</span></p>
          <p>Vaults managed: <span className="text-brand-cream font-medium">{r.vaultCount}</span></p>
          <p>Chains: <span className="text-brand-cream font-medium">{r.chainCount}</span></p>
        </div>
      </div>

      {/* Yield */}
      <div className="bg-brand-card border border-brand-border rounded-lg p-3">
        <h4 className="font-semibold text-brand-cream mb-2">Yield <span className={`ml-1 ${scoreColor(r.yieldScore)}`}>{r.yieldScore}</span></h4>
        <div className="space-y-1 text-brand-light">
          <p>Weighted APY: <span className="text-brand-cream font-medium">{r.weightedApyPct.toFixed(2)}%</span></p>
          <p>Avg fee: <span className="text-brand-cream font-medium">{r.avgFeePct !== null ? `${r.avgFeePct.toFixed(1)}%` : 'N/A'}</span></p>
        </div>
      </div>

      {/* Safety */}
      <div className="bg-brand-card border border-brand-border rounded-lg p-3">
        <h4 className="font-semibold text-brand-cream mb-2">Safety <span className={`ml-1 ${scoreColor(r.safetyScore)}`}>{r.safetyScore}</span></h4>
        <div className="space-y-1 text-brand-light">
          <p>Bad debt: <span className="text-brand-cream font-medium">{r.totalBadDebtUsd > 0 ? fmtUsd(r.totalBadDebtUsd) : '$0'}</span></p>
          <p>Bad debt / TVL: <span className="text-brand-cream font-medium">{(r.badDebtToTvlRatio * 100).toFixed(4)}%</span></p>
          <p>Affected markets: <span className="text-brand-cream font-medium">{r.affectedMarketCount}</span></p>
          <p>Oracle: {badge(!r.hasOracleWarning, r.hasOracleWarning ? 'Warning' : 'Clean')}</p>
        </div>
      </div>

      {/* Governance */}
      <div className="bg-brand-card border border-brand-border rounded-lg p-3">
        <h4 className="font-semibold text-brand-cream mb-2">Governance <span className={`ml-1 ${scoreColor(r.governanceScore)}`}>{r.governanceScore}</span></h4>
        <div className="space-y-1 text-brand-light">
          <p>Identity: {badge(r.verified, r.verified ? 'Verified' : r.curatorName ? 'Known' : 'Anonymous')}</p>
          <p>Timelock: <span className="text-brand-cream font-medium">{r.avgTimelockHours >= 24 ? `${(r.avgTimelockHours / 24).toFixed(0)}d` : `${r.avgTimelockHours.toFixed(0)}h`}</span></p>
          <p>Guardian: {badge(r.hasGuardian, r.hasGuardian ? 'Yes' : 'No')}</p>
          <p>Conflict of interest: {badge(!r.hasCuratorBorrowing, r.hasCuratorBorrowing ? 'Detected' : 'None')}</p>
          <p>Public allocator: {badge(!r.hasPublicAllocator, r.hasPublicAllocator ? 'Enabled' : 'Disabled')}</p>
        </div>
      </div>

      {/* Asset Quality */}
      <div className="bg-brand-card border border-brand-border rounded-lg p-3">
        <h4 className="font-semibold text-brand-cream mb-2">Asset Quality <span className={`ml-1 ${scoreColor(r.assetQualityScore)}`}>{r.assetQualityScore}</span></h4>
        <div className="space-y-1 text-brand-light">
          <p>Stablecoin: <span className="text-brand-cream font-medium">{r.stablecoinPct.toFixed(0)}%</span></p>
          <p>Long-tail: <span className="text-brand-cream font-medium">{r.longTailPct.toFixed(0)}%</span></p>
          <p>Oracle type: {badge(r.allChainlink, r.allChainlink ? 'All Chainlink' : 'Mixed')}</p>
          <p>Utilization: <span className="text-brand-cream font-medium">{(r.weightedUtilization * 100).toFixed(1)}%</span></p>
        </div>
      </div>
    </div>
  )
}

export function LeaderboardView({ rankings: initialRankings, generatedAt }: Props) {
  const { t } = useLanguage()
  const [rankings, setRankings] = useState(initialRankings)
  const [sortKey, setSortKey] = useState<SortKey>('compositeScore')
  const [sortAsc, setSortAsc] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(generatedAt)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)

  function handleSort(key: SortKey) {
    if (key === sortKey) { setSortAsc(!sortAsc) } else { setSortKey(key); setSortAsc(false) }
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/leaderboard?refresh=1')
      const data = await res.json()
      if (data.rankings) { setRankings(data.rankings); setLastUpdated(data.generatedAt) }
    } finally { setRefreshing(false) }
  }

  const sorted = [...rankings].sort((a, b) => {
    const av = a[sortKey] ?? 0; const bv = b[sortKey] ?? 0
    return sortAsc ? av - bv : bv - av
  })

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => (
    <th className="px-3 py-2 font-medium cursor-pointer hover:text-brand-cream select-none" onClick={() => handleSort(k)}>
      {label} {sortKey === k ? (sortAsc ? '↑' : '↓') : ''}
    </th>
  )

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <Link href="/" className="text-brand-cream hover:text-brand text-sm font-medium">← Home</Link>
          <h1 className="text-2xl font-bold text-brand-cream mt-2">{t.leaderboard}</h1>
          <p className="text-brand-light text-sm mt-1">{t.leaderboardSubtitle}</p>
          <p className="text-brand-light text-sm mt-1">
            Last updated: {new Date(lastUpdated).toISOString().replace('T', ' ').slice(0, 19)} UTC
          </p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="bg-brand-cream text-brand-bg text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-cream/90 disabled:opacity-50 transition-colors"
        >
          {refreshing ? t.refreshing : t.refresh}
        </button>
      </div>

      <div className="bg-brand-card border border-brand-border rounded-xl overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-border text-brand-light text-left">
              <th className="px-3 py-2 font-medium w-8">#</th>
              <th className="px-3 py-2 font-medium">{t.curator}</th>
              <SortHeader k="compositeScore" label={t.score} />
              <SortHeader k="scaleScore" label={t.scale} />
              <SortHeader k="yieldScore" label={t.yield} />
              <SortHeader k="safetyScore" label={t.safety} />
              <SortHeader k="governanceScore" label={t.governance} />
              <SortHeader k="assetQualityScore" label={t.assetQuality} />
              <SortHeader k="totalTvlUsd" label={t.tvl} />
              <SortHeader k="weightedApyPct" label={t.avgApy} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <React.Fragment key={r.curatorAddress}>
                <tr
                  className="border-b border-brand-border/50 hover:bg-brand-border/20 cursor-pointer"
                  onClick={() => setExpandedRow(expandedRow === r.curatorAddress ? null : r.curatorAddress)}
                >
                  <td className="px-3 py-3 text-brand-light">{i + 1}</td>
                  <td className="px-3 py-3">
                    <span className="text-brand-cream font-medium">
                      {r.curatorName || `${r.curatorAddress.slice(0, 8)}...`}
                    </span>
                    {r.verified && <span className="ml-1 text-green-700 text-xs">✓</span>}
                    <span className="ml-2 text-brand-light text-xs">{expandedRow === r.curatorAddress ? '▲' : '▼'}</span>
                    <div className="text-brand-light text-xs mt-0.5">{r.vaultCount} vaults · {r.chainCount} chains</div>
                  </td>
                  <td className={`px-3 py-3 font-bold ${scoreColor(r.compositeScore)}`}>{r.compositeScore}</td>
                  <td className={`px-3 py-3 ${scoreColor(r.scaleScore)}`}>{r.scaleScore}</td>
                  <td className={`px-3 py-3 ${scoreColor(r.yieldScore)}`}>{r.yieldScore}</td>
                  <td className={`px-3 py-3 ${scoreColor(r.safetyScore)}`}>{r.safetyScore}</td>
                  <td className={`px-3 py-3 ${scoreColor(r.governanceScore)}`}>{r.governanceScore}</td>
                  <td className={`px-3 py-3 ${scoreColor(r.assetQualityScore)}`}>{r.assetQualityScore}</td>
                  <td className="px-3 py-3 text-brand-cream font-medium">{fmtUsd(r.totalTvlUsd)}</td>
                  <td className="px-3 py-3 text-brand-cream">{r.weightedApyPct.toFixed(2)}%</td>
                </tr>
                {expandedRow === r.curatorAddress && (
                  <tr>
                    <td colSpan={10} className="p-0">
                      <DetailPanel r={r} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
