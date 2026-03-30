export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-brand-card border border-brand-border rounded-xl p-5 animate-pulse">
      <div className="h-5 bg-brand-border rounded w-1/3 mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 bg-brand-border/60 rounded mb-2" style={{ width: `${70 + i * 10}%` }} />
      ))}
    </div>
  )
}
