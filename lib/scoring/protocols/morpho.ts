// lib/scoring/protocols/morpho.ts
import { getAddress, type Address } from 'viem'
import { getClient, withRetry } from '@/lib/viemClient'
import { fetchVaultYield } from '@/lib/defillama'
import { fetchMorphoBadDebt } from '@/lib/thegraph'
import type { ChainId, VaultData } from '@/lib/scoring/types'

const METAMORPHO_ABI = [
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'timelock',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

/**
 * Fetches all data needed to score a MetaMorpho vault.
 * Fields that could not be fetched are hardcoded to safe-ish defaults
 * and recorded in `placeholderFields` so the UI can show "estimated" labels.
 */
export async function fetchMorphoVaultData(
  address: string,
  chainId: ChainId,
  defillamaPoolId: string
): Promise<VaultData> {
  const client = getClient(chainId)
  const checksumAddress = getAddress(address) as Address

  const [name, owner, timelockRaw, yield_, badDebt] = await Promise.all([
    withRetry(() =>
      client.readContract({
        address: checksumAddress,
        abi: METAMORPHO_ABI,
        functionName: 'name',
      })
    ),
    withRetry(() =>
      client.readContract({
        address: checksumAddress,
        abi: METAMORPHO_ABI,
        functionName: 'owner',
      })
    ),
    withRetry(() =>
      client.readContract({
        address: checksumAddress,
        abi: METAMORPHO_ABI,
        functionName: 'timelock',
      })
    ),
    fetchVaultYield(defillamaPoolId),
    fetchMorphoBadDebt(address, chainId),
  ])

  const timelockHours = Number(timelockRaw) / 3600

  // These fields require additional market config reads not yet implemented.
  // They are recorded in placeholderFields so the UI shows an "estimated" badge.
  const placeholderFields = [
    'assets',
    'maxLtvPct',
    'liquidationThresholdPct',
    'liquidationBonusPct',
    'liquidationMechanism',
    'oracleManipulationSurface',
    'curatorType',
    'permissionScope',
    'vaultsManaged',
    'incidentCount',
    'curatorBorrowsFromVault',
  ]

  return {
    address,
    chainId,
    protocol: 'morpho',
    name: name as string,
    tvlUsd: yield_.tvlUsd,
    currentApyPct: yield_.currentApyPct,
    apy7dAvg: yield_.apy7dAvg,
    apy30dAvg: yield_.apy30dAvg,
    apy90dAvg: yield_.apy90dAvg,
    apyHistory: yield_.apyHistory,
    assets: [],                             // placeholder — market config reads TBD
    maxLtvPct: 80,
    liquidationThresholdPct: 85,
    liquidationBonusPct: 5,
    liquidationMechanism: 'dutch-auction',
    historicalBadDebtUsd: badDebt,          // real data from The Graph
    oracleManipulationSurface: 'low',
    curatorAddress: owner as string,        // real on-chain data
    curatorType: 'known-team',
    permissionScope: 'medium',
    timelockHours,                          // real on-chain data
    vaultsManaged: 1,
    incidentCount: 0,
    curatorBorrowsFromVault: false,
    placeholderFields,
  }
}
