import { notFound } from 'next/navigation'
import { fetchCuratorAllAddresses } from '@/lib/morphoApi'
import { fetchCuratorBadDebtHistory } from '@/lib/thegraph'
import { detectUnrealizedBadDebt } from '@/lib/scoring/protocols/morpho'
import CuratorDetailView from './CuratorDetailView'

export default async function CuratorPage({
  params,
}: {
  params: Promise<{ address: string }>
}) {
  const { address } = await params
  if (!/^0x[0-9a-fA-F]{40}$/i.test(address)) notFound()

  const allAddresses = await fetchCuratorAllAddresses(address)
  const history = await fetchCuratorBadDebtHistory(allAddresses)

  const events = history?.events ?? []
  const totalBadDebtUsd = history?.totalBadDebtUsd ?? 0
  const eventCount = history?.eventCount ?? 0
  const affectedMarketCount = history?.affectedMarketCount ?? 0
  const historicalVaultCount = history?.historicalVaultCount ?? 0

  // Detect unrealized bad debt on-chain
  const unrealizedResult = history?.allMarketIds
    ? await detectUnrealizedBadDebt(history.allMarketIds, history.allVaultAddresses, totalBadDebtUsd).catch(() => ({ totalUsd: 0, markets: [] as Array<{ marketId: string; chainId: number; badDebtUsd: number }> }))
    : { totalUsd: 0, markets: [] as Array<{ marketId: string; chainId: number; badDebtUsd: number }> }
  const unrealizedBadDebtUsd = unrealizedResult.totalUsd
  const unrealizedMarkets = unrealizedResult.markets

  return (
    <CuratorDetailView
      address={address}
      allAddresses={allAddresses}
      totalBadDebtUsd={totalBadDebtUsd}
      unrealizedBadDebtUsd={unrealizedBadDebtUsd}
      unrealizedMarkets={unrealizedMarkets}
      eventCount={eventCount}
      affectedMarketCount={affectedMarketCount}
      historicalVaultCount={historicalVaultCount}
      events={events}
    />
  )
}
