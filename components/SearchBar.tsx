'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function SearchBar() {
  const [address, setAddress] = useState('')
  const [chainId, setChainId] = useState(1)
  const router = useRouter()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = address.trim()
    if (!trimmed) return
    router.push(`/vault/${chainId}/${trimmed}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 w-full max-w-2xl">
      <select
        value={chainId}
        onChange={e => setChainId(Number(e.target.value))}
        className="bg-gray-800 border border-gray-600 text-white px-3 py-3 rounded-lg text-sm"
      >
        <option value={1}>Ethereum</option>
        <option value={8453}>Base</option>
      </select>
      <input
        type="text"
        value={address}
        onChange={e => setAddress(e.target.value)}
        placeholder="Enter vault address (0x...)"
        className="flex-1 bg-gray-800 border border-gray-600 text-white px-4 py-3 rounded-lg placeholder-gray-500 focus:outline-none focus:border-indigo-500"
      />
      <button
        type="submit"
        className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-lg font-medium transition-colors"
      >
        Analyze
      </button>
    </form>
  )
}
