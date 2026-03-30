'use client'
import { SearchBar } from '@/components/SearchBar'
import { FeaturedVaultsList } from '@/components/FeaturedVaultsList'
import featuredVaults from '@/data/featured-vaults.json'
import { useLanguage, LanguageToggle } from '@/lib/i18n'

export default function HomePage() {
  const { t } = useLanguage()

  return (
    <main className="min-h-screen bg-brand-bg text-brand-cream flex flex-col items-center px-6 py-16 relative">
      <div className="absolute top-4 right-4">
        <LanguageToggle />
      </div>

      <h1 className="text-4xl font-bold mb-2">{t.title}</h1>
      <p className="text-brand-light text-lg mb-2 text-center max-w-xl">
        {t.subtitle}
      </p>
      <p className="text-brand-light/60 text-sm mb-10 text-center max-w-xl">
        {t.chainNotice}
      </p>

      <SearchBar />

      <div className="mt-12 w-full max-w-2xl">
        <h2 className="text-brand-light text-sm font-semibold uppercase tracking-wider mb-4">
          {t.featuredVaults}
        </h2>
        <FeaturedVaultsList vaults={featuredVaults} />
      </div>
    </main>
  )
}
