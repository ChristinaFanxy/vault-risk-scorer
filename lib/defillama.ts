// lib/defillama.ts
const BASE = 'https://yields.llama.fi'

export interface VaultYield {
  tvlUsd: number
  currentApyPct: number
  apy7dAvg: number | null
  apy30dAvg: number | null
  apy90dAvg: number | null
  apyHistory: Array<{ timestamp: number; apyPct: number }>
}

export async function fetchVaultYield(poolId: string): Promise<VaultYield> {
  const res = await fetch(`${BASE}/chart/${poolId}`, {
    next: { revalidate: 300 },  // 5-min Next.js route cache
  })
  if (!res.ok) throw new Error(`DefiLlama /chart/${poolId} returned ${res.status}`)

  const json = await res.json()
  const rows: Array<{ timestamp: string; tvlUsd: number; apy: number }> = json.data
  if (!rows || rows.length === 0) throw new Error(`DefiLlama /chart/${poolId} returned empty data`)

  const latest = rows[rows.length - 1]
  const latestMs = new Date(latest.timestamp).getTime()

  const avg = (days: number) => {
    const cutoff = latestMs - days * 86_400_000
    const window = rows.filter(r => new Date(r.timestamp).getTime() >= cutoff)
    if (window.length === 0) return null
    return window.reduce((s, r) => s + r.apy, 0) / window.length
  }

  return {
    tvlUsd: latest.tvlUsd ?? 0,
    currentApyPct: latest.apy ?? 0,
    apy7dAvg: avg(7),
    apy30dAvg: avg(30),
    apy90dAvg: avg(90),
    apyHistory: rows.map(r => ({ timestamp: new Date(r.timestamp).getTime(), apyPct: r.apy })),
  }
}
