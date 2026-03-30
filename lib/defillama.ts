// lib/defillama.ts
const BASE = 'https://yields.llama.fi'

export interface VaultYield {
  tvlUsd: number
  currentApyPct: number
}

export async function fetchVaultYield(poolId: string): Promise<VaultYield> {
  const res = await fetch(`${BASE}/chart/${poolId}`, {
    next: { revalidate: 300 },  // 5-min Next.js route cache
  })
  if (!res.ok) throw new Error(`DefiLlama /chart/${poolId} returned ${res.status}`)

  const json = await res.json()
  const rows: Array<{ timestamp: string; tvlUsd: number; apy: number }> = json.data ?? []
  if (rows.length === 0) throw new Error(`DefiLlama /chart/${poolId} returned empty data`)

  const latest = rows[rows.length - 1]

  return {
    tvlUsd: latest.tvlUsd ?? 0,
    currentApyPct: latest.apy ?? 0,
  }
}
