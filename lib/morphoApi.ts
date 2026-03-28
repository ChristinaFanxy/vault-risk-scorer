// lib/morphoApi.ts
// Morpho Blue public GraphQL API — no API key required.
const MORPHO_API = 'https://blue-api.morpho.org/graphql'

export interface MorphoYieldData {
  tvlUsd: number
  currentApyPct: number
  apy7dAvg: number | null
  apy30dAvg: number | null
  apy90dAvg: number | null
  apyHistory: Array<{ timestamp: number; apyPct: number }>
}

export interface MorphoCuratorData {
  curatorAddress: string
  curatorName: string | null        // e.g. "Steakhouse Financial"
  curatorVerified: boolean          // Morpho-verified curator
  timelockSeconds: number           // on-chain timelock value
  vaultsManaged: number             // total vaults by same curator
  warnings: string[]                // warning type strings
}

const VAULT_YIELD_QUERY = `
  query VaultYield($address: String!, $chainId: Int!) {
    vault: vaultByAddress(address: $address, chainId: $chainId) {
      state {
        totalAssetsUsd
        netApy
      }
      historicalState {
        dailyNetApy { x y }
        weeklyNetApy { x y }
        monthlyNetApy { x y }
        quarterlyNetApy { x y }
      }
    }
  }
`

const VAULT_CURATOR_QUERY = `
  query VaultCurator($address: String!, $chainId: Int!) {
    vault: vaultByAddress(address: $address, chainId: $chainId) {
      state {
        curator
        timelock
        curators { name verified }
      }
      warnings { type level }
    }
  }
`

const VAULTS_BY_CURATOR_QUERY = `
  query VaultsByCurator($curatorAddresses: [String!]!) {
    vaults(where: { curatorAddress_in: $curatorAddresses }) {
      items { address }
    }
  }
`

async function gql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(MORPHO_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 300 },
  })
  if (!res.ok) throw new Error(`Morpho API ${res.status}`)
  const json = await res.json()
  if (json.errors?.length) throw new Error(`Morpho API: ${json.errors[0].message}`)
  return json.data as T
}

export async function fetchMorphoYieldData(
  vaultAddress: string,
  chainId: number
): Promise<MorphoYieldData> {
  type Point = { x: number; y: number | null }
  const { vault } = await gql<{
    vault: {
      state: { totalAssetsUsd: number; netApy: number }
      historicalState: {
        dailyNetApy: Point[]
        weeklyNetApy: Point[]
        monthlyNetApy: Point[]
        quarterlyNetApy: Point[]
      }
    }
  }>(VAULT_YIELD_QUERY, { address: vaultAddress, chainId })

  const toHistory = (pts: Point[]) =>
    pts
      .filter(p => p.y !== null)
      .map(p => ({ timestamp: p.x * 1000, apyPct: (p.y as number) * 100 }))
      .sort((a, b) => a.timestamp - b.timestamp)

  // Use daily for recent, fall back to weekly, then quarterly for older points
  const history = toHistory(vault.historicalState.quarterlyNetApy)

  // 7d avg from weeklyNetApy latest point, 30d/90d from monthly/quarterly
  const latest = (pts: Point[]) => pts.filter(p => p.y !== null).at(-1)?.y ?? null
  const apy7d = latest(vault.historicalState.weeklyNetApy)
  const apy30d = latest(vault.historicalState.monthlyNetApy)
  const apy90d = latest(vault.historicalState.quarterlyNetApy)

  return {
    tvlUsd: vault.state.totalAssetsUsd,
    currentApyPct: vault.state.netApy * 100,
    apy7dAvg: apy7d !== null ? apy7d * 100 : null,
    apy30dAvg: apy30d !== null ? apy30d * 100 : null,
    apy90dAvg: apy90d !== null ? apy90d * 100 : null,
    apyHistory: history,
  }
}

export async function fetchMorphoCuratorData(
  vaultAddress: string,
  chainId: number
): Promise<MorphoCuratorData> {
  // Step 1: fetch vault curator info
  const { vault } = await gql<{
    vault: {
      state: {
        curator: string
        timelock: number
        curators: Array<{ name: string; verified: boolean }>
      }
      warnings: Array<{ type: string; level: string }>
    }
  }>(VAULT_CURATOR_QUERY, { address: vaultAddress, chainId })

  const curatorAddress = vault.state.curator
  const primaryCurator = vault.state.curators[0] ?? null

  // Step 2: count vaults managed by the same curator address
  let vaultsManaged = 1
  try {
    const { vaults } = await gql<{ vaults: { items: Array<{ address: string }> } }>(
      VAULTS_BY_CURATOR_QUERY,
      { curatorAddresses: [curatorAddress] }
    )
    vaultsManaged = Math.max(1, vaults.items.length)
  } catch {
    // non-critical — fall back to 1
  }

  return {
    curatorAddress,
    curatorName: primaryCurator?.name ?? null,
    curatorVerified: primaryCurator?.verified ?? false,
    timelockSeconds: vault.state.timelock,
    vaultsManaged,
    warnings: vault.warnings.map(w => w.type),
  }
}
