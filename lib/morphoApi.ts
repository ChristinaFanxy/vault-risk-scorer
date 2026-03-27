// lib/morphoApi.ts
// Morpho Blue public GraphQL API — no API key required.
const MORPHO_API = 'https://blue-api.morpho.org/graphql'

export interface MorphoCuratorData {
  curatorAddress: string
  curatorName: string | null        // e.g. "Steakhouse Financial"
  curatorVerified: boolean          // Morpho-verified curator
  timelockSeconds: number           // on-chain timelock value
  vaultsManaged: number             // total vaults by same curator
  warnings: string[]                // warning type strings
}

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
