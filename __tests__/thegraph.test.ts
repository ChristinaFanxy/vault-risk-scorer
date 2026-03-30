// __tests__/thegraph.test.ts
import { fetchMorphoBadDebt } from '@/lib/thegraph'

global.fetch = jest.fn()

// Subgraph URLs are set in jest.env.ts (loaded before modules).

describe('fetchMorphoBadDebt', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('sums bad debt USD from matching markets', async () => {
    // Call 1: metaMorphoMarkets query returns markets for this vault
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          metaMorphoMarkets: [
            { market: { id: '0xmarket1' } },
            { market: { id: '0xmarket2' } },
          ],
        },
      }),
    })
    // Call 2: badDebtRealizations query returns events
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          badDebtRealizations: [
            { badDebtUSD: '1000.5', market: { id: '0xmarket1' } },
            { badDebtUSD: '500.25', market: { id: '0xmarket2' } },
            { badDebtUSD: '999', market: { id: '0xunrelated' } },
          ],
        },
      }),
    })

    const result = await fetchMorphoBadDebt('0xvault', 1)
    expect(result).toBeCloseTo(1500.75)
  })

  it('returns 0 when no bad debt events match', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { metaMorphoMarkets: [{ market: { id: '0xm1' } }] },
      }),
    })
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: { badDebtRealizations: [{ badDebtUSD: '100', market: { id: '0xother' } }] },
      }),
    })

    const result = await fetchMorphoBadDebt('0xvault', 1)
    expect(result).toBe(0)
  })

  it('returns -1 when subgraph returns error', async () => {
    // First call (metaMorphoMarkets) returns an error → subgraphQuery returns null
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 500 })

    const result = await fetchMorphoBadDebt('0xvault', 1)
    expect(result).toBe(-1)
  })
})
