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
  const data = json.data

  const history: Array<{ timestamp: number; apyPct: number }> = (data.chart ?? []).map(
    (row: { timestamp: string; apy: number }) => ({
      timestamp: new Date(row.timestamp).getTime(),
      apyPct: row.apy,
    })
  )

  return {
    tvlUsd: data.tvlUsd ?? 0,
    currentApyPct: data.apy ?? 0,
    apy7dAvg: data.apyBase7d ?? null,
    apy30dAvg: data.apyMean30d ?? null,
    apy90dAvg: data.apyMean90d ?? null,
    apyHistory: history,
  }
}
