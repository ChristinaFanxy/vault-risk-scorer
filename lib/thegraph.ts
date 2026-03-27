// lib/thegraph.ts
import type { ChainId } from '@/lib/scoring/types'

const MORPHO_SUBGRAPH: Record<ChainId, string> = {
  1: 'https://api.thegraph.com/subgraphs/name/morpho-association/morpho-blue',
  8453: 'https://api.thegraph.com/subgraphs/name/morpho-association/morpho-blue-base',
}

const BAD_DEBT_QUERY = `
  query BadDebt($vault: String!) {
    liquidations(where: { market_: { inputToken: $vault } }) {
      badDebtUsd
    }
  }
`

/**
 * Returns total historical bad debt in USD for a vault.
 * Returns -1 if the subgraph is unavailable (UI shows "N/A").
 */
export async function fetchMorphoBadDebt(
  vaultAddress: string,
  chainId: ChainId
): Promise<number> {
  const url = MORPHO_SUBGRAPH[chainId]
  if (!url) return -1

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: BAD_DEBT_QUERY,
        variables: { vault: vaultAddress.toLowerCase() },
      }),
      next: { revalidate: 300 },
    })
    if (!res.ok) return -1

    const json = await res.json()
    const liquidations: Array<{ badDebtUsd: string }> = json.data?.liquidations ?? []
    return liquidations.reduce((sum, l) => sum + parseFloat(l.badDebtUsd), 0)
  } catch {
    return -1
  }
}
