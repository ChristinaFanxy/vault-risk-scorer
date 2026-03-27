// __tests__/thegraph.test.ts
import { fetchMorphoBadDebt } from '@/lib/thegraph'

global.fetch = jest.fn()

describe('fetchMorphoBadDebt', () => {
  it('sums bad debt USD from liquidation events', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          liquidations: [
            { badDebtUsd: '1000.5' },
            { badDebtUsd: '500.25' },
          ],
        },
      }),
    })
    const result = await fetchMorphoBadDebt('0xvault', 1)
    expect(result).toBeCloseTo(1500.75)
  })

  it('returns 0 when no bad debt events', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { liquidations: [] } }),
    })
    const result = await fetchMorphoBadDebt('0xvault', 1)
    expect(result).toBe(0)
  })

  it('returns -1 on network error', async () => {
    ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('network'))
    const result = await fetchMorphoBadDebt('0xvault', 1)
    expect(result).toBe(-1)
  })
})
