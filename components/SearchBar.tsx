'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function SearchBar() {
  const [address, setAddress] = useState('')
  const [status, setStatus] = useState<'idle' | 'detecting' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = address.trim()
    if (!trimmed) return
    if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
      setStatus('error')
      setErrorMsg('Please enter a valid vault address (0x followed by 40 hex characters)')
      return
    }

    setStatus('detecting')
    setErrorMsg('')

    try {
      const res = await fetch(`/api/detect-chain/${trimmed}`)
      const data = await res.json()

      if (!res.ok || !data.chainId) {
        setStatus('error')
        setErrorMsg(data.error ?? 'Vault not found on Ethereum or Base')
        return
      }

      router.push(`/vault/${data.chainId}/${trimmed}`)
    } catch {
      setStatus('error')
      setErrorMsg('Network error — please try again')
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
          placeholder="Enter any Morpho vault address (0x...)"
          className="flex-1 bg-gray-800 border border-gray-600 text-white px-4 py-3 rounded-lg placeholder-gray-500 focus:outline-none focus:border-indigo-500"
        />
        <button
          type="submit"
          disabled={status === 'detecting'}
          className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium transition-colors min-w-[100px]"
        >
          {status === 'detecting' ? 'Detecting…' : 'Analyze'}
        </button>
      </form>
      {status === 'error' && (
        <p className="mt-2 text-red-400 text-sm">{errorMsg}</p>
      )}
    </div>
  )
}
