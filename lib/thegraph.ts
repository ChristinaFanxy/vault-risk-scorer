// lib/thegraph.ts
import type { ChainId } from '@/lib/scoring/types'

const MORPHO_SUBGRAPH: Record<ChainId, string | undefined> = {
  1: process.env.MORPHO_SUBGRAPH_MAINNET,
  8453: process.env.MORPHO_SUBGRAPH_BASE,
}

// NOTE: This query filters by market.inputToken (collateral token address).
// Morpho MetaMorpho vault address ≠ market inputToken; this may return empty
// results for MetaMorpho vaults. Verify against the actual subgraph schema
// at the configured MORPHO_SUBGRAPH_MAINNET/BASE endpoint.
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
  if (!url) return -1  // subgraph URL not configured

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
    if (json.errors?.length) return -1
    const liquidations: Array<{ badDebtUsd: string }> = json.data?.liquidations ?? []
    return liquidations.reduce((sum, l) => sum + parseFloat(l.badDebtUsd), 0)
  } catch {
    return -1
  }
}
