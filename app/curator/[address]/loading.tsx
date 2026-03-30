export default function CuratorLoading() {
  return (
    <div className="min-h-screen bg-brand-bg text-brand-cream p-6 max-w-4xl mx-auto">
      {/* Back link skeleton */}
      <div className="h-4 w-24 bg-brand-border rounded mb-6 animate-pulse" />

      {/* Title skeleton */}
      <div className="mb-8">
        <div className="h-7 w-72 bg-brand-border rounded mb-2 animate-pulse" />
        <div className="h-4 w-96 bg-brand-border/60 rounded animate-pulse" />
      </div>

      {/* Summary stats skeleton */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-brand-card border border-brand-border rounded-lg p-4 animate-pulse">
            <div className="h-3 w-24 bg-brand-border rounded mb-2" />
            <div className="h-6 w-16 bg-brand-border rounded" />
          </div>
        ))}
      </div>

      {/* Events table skeleton */}
      <div className="bg-brand-card border border-brand-border rounded-lg p-6 animate-pulse">
        <div className="h-4 w-32 bg-brand-border rounded mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-4 w-full bg-brand-border/40 rounded" />
          ))}
        </div>
      </div>
    </div>
  )
}
