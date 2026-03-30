// __tests__/defillama.test.ts
import { fetchVaultYield } from '@/lib/defillama'

global.fetch = jest.fn()

describe('fetchVaultYield', () => {
  it('returns current APY and TVL from latest data point', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { timestamp: '2026-03-20T00:00:00Z', tvlUsd: 5_000_000, apy: 4.9 },
          { timestamp: '2026-03-27T00:00:00Z', tvlUsd: 5_100_000, apy: 5.2 },
        ],
      }),
    })

    const result = await fetchVaultYield('test-pool-id')
    expect(result.currentApyPct).toBe(5.2)
    expect(result.tvlUsd).toBe(5_100_000)
  })

  it('throws on non-ok response', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 404 })
    await expect(fetchVaultYield('bad-id')).rejects.toThrow('DefiLlama')
  })

  it('throws on empty data', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    })
    await expect(fetchVaultYield('test-pool-id')).rejects.toThrow('empty data')
  })

  it('throws when data is undefined', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    })
    await expect(fetchVaultYield('test-pool-id')).rejects.toThrow('empty data')
  })
})
