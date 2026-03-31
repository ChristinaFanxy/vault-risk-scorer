import { LeaderboardView } from './LeaderboardView'
import { fetchAllCuratorData } from '@/lib/leaderboardApi'
import { rankCurators } from '@/lib/scoring/curatorLeaderboard'

export const revalidate = 43200

export default async function LeaderboardPage() {
  const curators = await fetchAllCuratorData()
  const rankings = rankCurators(curators)

  return (
    <main className="min-h-screen bg-brand-bg text-brand-cream p-8">
      <LeaderboardView rankings={rankings} generatedAt={Date.now()} />
    </main>
  )
}
