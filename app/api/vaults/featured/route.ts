// app/api/vaults/featured/route.ts
import { NextResponse } from 'next/server'
import featuredVaults from '@/data/featured-vaults.json'

export async function GET() {
  return NextResponse.json(featuredVaults, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  })
}
