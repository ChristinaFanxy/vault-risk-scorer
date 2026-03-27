jest.mock('@/lib/scoring/protocols/morpho', () => ({
  fetchMorphoVaultData: jest.fn(),
}))

import { GET } from '@/app/api/vault/[chainId]/[address]/route'
import { fetchMorphoVaultData } from '@/lib/scoring/protocols/morpho'
import type { VaultData } from '@/lib/scoring/types'

const mockVault: VaultData = {
  address: '0xbeef', chainId: 1, protocol: 'morpho', name: 'Mock Vault',
  tvlUsd: 1_000_000, currentApyPct: 5,
  apy7dAvg: 5, apy30dAvg: 5, apy90dAvg: 5, apyHistory: [],
  assets: [], maxLtvPct: 80, liquidationThresholdPct: 85, liquidationBonusPct: 5,
  liquidationMechanism: 'dutch-auction', historicalBadDebtUsd: 0,
  oracleManipulationSurface: 'low',
  curatorName: null, curatorAddress: '0x0', curatorType: 'institution', permissionScope: 'narrow',
  timelockHours: 72, vaultsManaged: 1, incidentCount: 0, curatorBorrowsFromVault: false,
  placeholderFields: [],
}

describe('GET /api/vault/[chainId]/[address]', () => {
  it('returns 200 with a composite score for a valid vault', async () => {
    ;(fetchMorphoVaultData as jest.Mock).mockResolvedValueOnce(mockVault)

    const req = new Request('http://localhost/api/vault/1/0xbeef')
    const res = await GET(req, { params: { chainId: '1', address: '0xbeef' } })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(['A', 'B', 'C', 'D', 'F']).toContain(body.grade)
    expect(body.tvlUsd).toBe(1_000_000)
    expect(body.name).toBe('Mock Vault')
  })

  it('returns 400 for an unsupported chain', async () => {
    const req = new Request('http://localhost/api/vault/999/0xbeef')
    const res = await GET(req, { params: { chainId: '999', address: '0xbeef' } })
    expect(res.status).toBe(400)
  })

  it('returns 503 when data fetch throws', async () => {
    ;(fetchMorphoVaultData as jest.Mock).mockRejectedValueOnce(new Error('RPC timeout'))
    const req = new Request('http://localhost/api/vault/1/0xbeef')
    const res = await GET(req, { params: { chainId: '1', address: '0xbeef' } })
    expect(res.status).toBe(503)
  })

  it('returns 404 when vault is not found', async () => {
    ;(fetchMorphoVaultData as jest.Mock).mockRejectedValueOnce(new Error('vault not found'))
    const req = new Request('http://localhost/api/vault/1/0xbeef')
    const res = await GET(req, { params: { chainId: '1', address: '0xbeef' } })
    expect(res.status).toBe(404)
  })
})
