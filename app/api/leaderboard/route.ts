import { NextRequest, NextResponse } from 'next/server'
import { fetchAllCuratorData } from '@/lib/leaderboardApi'
import { rankCurators } from '@/lib/scoring/curatorLeaderboard'

export const revalidate = 43200

export async function GET(req: NextRequest) {
  const forceRefresh = req.nextUrl.searchParams.get('refresh') === '1'

  try {
    const curators = await fetchAllCuratorData()
    const rankings = rankCurators(curators)

    return NextResponse.json({
      rankings,
      curatorCount: rankings.length,
      generatedAt: Date.now(),
    }, {
      headers: forceRefresh
        ? { 'Cache-Control': 'no-cache' }
        : { 'Cache-Control': 'public, s-maxage=43200' },
    })
  } catch (err) {
    console.error('Leaderboard API error:', err)
    return NextResponse.json(
      { error: 'Failed to generate leaderboard', detail: err instanceof Error ? err.message : String(err) },
      { status: 503 }
    )
  }
}
