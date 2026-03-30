'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLanguage } from '@/lib/i18n'

export function SearchBar() {
  const [address, setAddress] = useState('')
  const [status, setStatus] = useState<'idle' | 'detecting' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()
  const { t } = useLanguage()

  function extractAddress(input: string): string | null {
    // Pure address: 0x followed by 40 hex chars
    const addrMatch = input.match(/0x[0-9a-fA-F]{40}/)
    if (addrMatch) return addrMatch[0]
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = address.trim()
    if (!trimmed) return

    const vaultAddress = extractAddress(trimmed)
    if (!vaultAddress) {
      setStatus('error')
      setErrorMsg(t.notFound)
      return
    }

    setStatus('detecting')
    setErrorMsg('')

    try {
      const res = await fetch(`/api/detect-chain/${vaultAddress}`)
      const data = await res.json()

      if (!res.ok || !data.chainId) {
        setStatus('error')
        setErrorMsg(data.error ?? t.searchError)
        return
      }

      router.push(`/vault/${data.chainId}/${vaultAddress}`)
    } catch {
      setStatus('error')
      setErrorMsg(t.networkError)
    } finally {
      setStatus(s => s === 'detecting' ? 'idle' : s)
    }
  }

  return (
    <div className="w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={address}
          onChange={e => { setAddress(e.target.value); setStatus('idle'); setErrorMsg('') }}
          placeholder={t.searchPlaceholder}
          className="flex-1 bg-brand-card border border-brand-border text-brand-cream px-4 py-3 rounded-lg placeholder-brand-light/50 focus:outline-none focus:border-brand"
        />
        <button
          type="submit"
          disabled={status === 'detecting'}
          className="bg-brand hover:bg-brand-light disabled:bg-brand/50 disabled:cursor-not-allowed text-brand-cream px-6 py-3 rounded-lg font-medium transition-colors min-w-[100px]"
        >
          {status === 'detecting' ? t.detecting : t.analyze}
        </button>
      </form>
      {status === 'error' && (
        <p className="mt-2 text-red-400 text-sm">{errorMsg}</p>
      )}
    </div>
  )
}
