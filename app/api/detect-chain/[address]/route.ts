// app/api/detect-chain/[address]/route.ts
// Lightweight chain detection via Morpho Blue API — no RPC call needed.
import { NextResponse } from 'next/server'

const MORPHO_API = 'https://blue-api.morpho.org/graphql'
const SUPPORTED_CHAINS = [1, 8453, 42161]

const DETECT_QUERY = `
  query DetectChain($addresses: [String!]!) {
    vaults(where: { address_in: $addresses }) {
      items { address chain { id } }
    }
    vaultV2s(where: { address_in: $addresses }) {
      items { address chain { id } }
    }
  }
`

export async function GET(
  _req: Request,
  { params }: { params: { address: string } }
) {
  const address = params.address

  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    return NextResponse.json({ error: 'Invalid address format' }, { status: 400 })
  }

  try {
    const res = await fetch(MORPHO_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: DETECT_QUERY, variables: { addresses: [address] } }),
      next: { revalidate: 300 },
    })
    if (!res.ok) throw new Error(`Morpho API ${res.status}`)
    const json = await res.json()
    if (json.errors?.length) throw new Error(json.errors[0].message)

    // Check V1 vaults
    const v1Items: Array<{ address: string; chain: { id: number } }> = json.data.vaults.items
    const v1Supported = v1Items.filter(v => SUPPORTED_CHAINS.includes(v.chain.id))

    // Check V2 vaults
    const v2Items: Array<{ address: string; chain: { id: number } }> = json.data.vaultV2s.items
    const v2Supported = v2Items.filter(v => SUPPORTED_CHAINS.includes(v.chain.id))

    // Combine results (V1 first, then V2)
    const allChainIds = [
      ...v1Supported.map(v => v.chain.id),
      ...v2Supported.map(v => v.chain.id),
    ]
    const uniqueChainIds = [...new Set(allChainIds)]

    if (uniqueChainIds.length === 0) {
      return NextResponse.json({ error: 'Vault not found on supported chains (Ethereum, Base, Arbitrum)' }, { status: 404 })
    }

    return NextResponse.json({
      chains: uniqueChainIds,
      chainId: uniqueChainIds[0],
    })
  } catch (err) {
    return NextResponse.json(
      { error: 'Could not detect chain', detail: err instanceof Error ? err.message : String(err) },
      { status: 503 }
    )
  }
}
