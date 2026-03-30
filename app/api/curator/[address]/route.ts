import { NextRequest, NextResponse } from 'next/server'
import { fetchCuratorAllAddresses } from '@/lib/morphoApi'
import { fetchCuratorBadDebtHistory } from '@/lib/thegraph'
import { detectUnrealizedBadDebt } from '@/lib/scoring/protocols/morpho'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Invalid address' }, { status: 400 })
  }

  try {
    const allAddresses = await fetchCuratorAllAddresses(address)
    const history = await fetchCuratorBadDebtHistory(allAddresses)

    // Detect unrealized bad debt on-chain
    const realizedUsd = history?.totalBadDebtUsd ?? 0
    const unrealizedResult = history?.allMarketIds
      ? await detectUnrealizedBadDebt(history.allMarketIds, history.allVaultAddresses, realizedUsd).catch(() => ({ totalUsd: 0, markets: [] }))
      : { totalUsd: 0, markets: [] }

    return NextResponse.json({
      curatorAddress: address,
      allAddresses,
      unrealizedBadDebtUsd: unrealizedResult.totalUsd,
      unrealizedMarkets: unrealizedResult.markets,
      history: history ?? {
        totalBadDebtUsd: 0,
        eventCount: 0,
        affectedMarketCount: 0,
        historicalVaultCount: 0,
        events: [],
        allVaultAddresses: [],
        allMarketIds: [],
      },
    })
  } catch (err) {
    console.error('Curator API error:', err)
    return NextResponse.json({ error: 'Failed to fetch curator data' }, { status: 500 })
  }
}
