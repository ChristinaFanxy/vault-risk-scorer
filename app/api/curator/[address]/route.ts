import { NextRequest, NextResponse } from 'next/server'
import { fetchCuratorAllAddresses } from '@/lib/morphoApi'
import { fetchCuratorBadDebtHistory } from '@/lib/thegraph'

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

    return NextResponse.json({
      curatorAddress: address,
      allAddresses,
      history: history ?? {
        totalBadDebtUsd: 0,
        eventCount: 0,
        affectedMarketCount: 0,
        historicalVaultCount: 0,
        events: [],
      },
    })
  } catch (err) {
    console.error('Curator API error:', err)
    return NextResponse.json({ error: 'Failed to fetch curator data' }, { status: 500 })
  }
}
