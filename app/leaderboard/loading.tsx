export default function LeaderboardLoading() {
  return (
    <main className="min-h-screen bg-brand-bg flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-brand-border border-t-brand-cream rounded-full animate-spin" />
        <p className="text-brand-cream text-lg font-medium">Loading leaderboard...</p>
      </div>
    </main>
  )
}
