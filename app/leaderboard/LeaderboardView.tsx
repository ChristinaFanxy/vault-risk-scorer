'use client'

import { useState } from 'react'
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

type SortKey = 'compositeScore' | 'scaleScore' | 'yieldScore' | 'safetyScore' | 'governanceScore' | 'assetQualityScore' | 'totalTvlUsd' | 'weightedApyPct'

interface Props {
  rankings: CuratorRanking[]
  generatedAt: number
}

export function LeaderboardView({ rankings: initialRankings, generatedAt }: Props) {
  const { t } = useLanguage()
  const [rankings, setRankings] = useState(initialRankings)
  const [sortKey, setSortKey] = useState<SortKey>('compositeScore')
  const [sortAsc, setSortAsc] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(generatedAt)

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortAsc(!sortAsc)
    } else {
      setSortKey(key)
      setSortAsc(false)
    }
  }

  async function handleRefresh() {
    setRefreshing(true)
    try {
      const res = await fetch('/api/leaderboard?refresh=1')
      const data = await res.json()
      if (data.rankings) {
        setRankings(data.rankings)
        setLastUpdated(data.generatedAt)
      }
    } finally {
      setRefreshing(false)
    }
  }

  const sorted = [...rankings].sort((a, b) => {
    const av = a[sortKey] ?? 0
    const bv = b[sortKey] ?? 0
    return sortAsc ? av - bv : bv - av
  })

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => (
    <th
      className="px-3 py-2 font-medium cursor-pointer hover:text-brand-cream select-none"
      onClick={() => handleSort(k)}
    >
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
              <tr key={r.curatorAddress} className="border-b border-brand-border/50 hover:bg-brand-border/20">
                <td className="px-3 py-3 text-brand-light">{i + 1}</td>
                <td className="px-3 py-3">
                  <Link href={`/curator/${r.curatorAddress}`} className="text-brand-cream hover:text-brand font-medium">
                    {r.curatorName || `${r.curatorAddress.slice(0, 8)}...`}
                  </Link>
                  {r.verified && <span className="ml-1 text-green-700 text-xs">✓</span>}
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
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
