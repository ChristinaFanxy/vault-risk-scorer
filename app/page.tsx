import { SearchBar } from '@/components/SearchBar'
import { FeaturedVaultsList } from '@/components/FeaturedVaultsList'
import featuredVaults from '@/data/featured-vaults.json'

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gray-950 text-white flex flex-col items-center px-6 py-16">
      <h1 className="text-4xl font-bold mb-2">DeFi Vault Risk Scorer</h1>
      <p className="text-gray-400 text-lg mb-10 text-center max-w-xl">
        Assess curator vault risk before you deposit. Three dimensions, one grade.
      </p>

      <SearchBar />

      <div className="mt-12 w-full max-w-2xl">
        <h2 className="text-gray-400 text-sm font-semibold uppercase tracking-wider mb-4">
          Featured Vaults
        </h2>
        <FeaturedVaultsList vaults={featuredVaults} />
      </div>
    </main>
  )
}
