import { SkeletonCard } from '@/components/SkeletonCard'

export default function VaultLoading() {
  return (
    <main className="min-h-screen bg-brand-bg text-brand-cream p-6 max-w-4xl mx-auto">
      {/* Back link skeleton */}
      <div className="h-4 w-24 bg-brand-border rounded mb-6 animate-pulse" />

      {/* Title area skeleton */}
      <div className="mb-8">
        <div className="h-8 w-64 bg-brand-border rounded mb-3 animate-pulse" />
        <div className="h-4 w-48 bg-brand-border/60 rounded mb-2 animate-pulse" />
        <div className="flex gap-4 mt-4">
          <div className="h-16 w-32 bg-brand-card border border-brand-border rounded-lg animate-pulse" />
          <div className="h-16 w-32 bg-brand-card border border-brand-border rounded-lg animate-pulse" />
        </div>
      </div>

      {/* Overall risk skeleton */}
      <div className="h-24 w-full bg-brand-card border border-brand-border rounded-lg mb-6 animate-pulse" />

      {/* Risk dimension cards skeleton */}
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </main>
  )
}
