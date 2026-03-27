// __tests__/defillama.test.ts
import { fetchVaultYield } from '@/lib/defillama'

global.fetch = jest.fn()

describe('fetchVaultYield', () => {
  it('returns APY and history for a known pool', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          apy: 5.2,
          apyMean30d: 4.8,
          apyBase7d: 5.0,
          chart: [
            { timestamp: '2026-03-20T00:00:00Z', apy: 4.9 },
            { timestamp: '2026-03-27T00:00:00Z', apy: 5.2 },
          ],
        },
      }),
    })

    const result = await fetchVaultYield('test-pool-id')
    expect(result.currentApyPct).toBe(5.2)
    expect(result.apy30dAvg).toBe(4.8)
    expect(result.apyHistory).toHaveLength(2)
  })

  it('throws on non-ok response', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 404 })
    await expect(fetchVaultYield('bad-id')).rejects.toThrow('DefiLlama')
  })

  it('returns tvlUsd from chart data', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          apy: 3, tvlUsd: 5_000_000,
          chart: [],
        },
      }),
    })
    const result = await fetchVaultYield('test-pool-id')
    expect(result.tvlUsd).toBe(5_000_000)
  })
})
