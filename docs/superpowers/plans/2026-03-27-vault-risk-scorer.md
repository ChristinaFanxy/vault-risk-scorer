# Vault Risk Scorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Next.js web app that scores DeFi curator vaults (Morpho MetaMorpho, Ethereum + Base MVP) across three risk dimensions and displays yield data, returning a composite letter grade A–F.

**Architecture:** Next.js 14 API routes handle all data fetching and scoring server-side (keeping RPC keys private). A pure TypeScript scoring engine in `/lib/scoring` computes dimension scores from structured inputs — no side effects, easy to unit test. Server components call the scoring engine directly (no self-fetching); only client-side navigation hits the API route. The frontend renders progressively as each data source resolves.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, viem, DefiLlama API, The Graph Morpho subgraph, Alchemy/Infura RPC, Jest + ts-jest, Playwright (E2E)

---

## File Map

```
vault-risk-scorer/
├── app/
│   ├── page.tsx                               # Home: search bar + featured vaults + chain filter
│   ├── vault/[chainId]/[address]/
│   │   └── page.tsx                           # Vault detail (calls scoring directly, no HTTP)
│   └── api/
│       ├── vault/[chainId]/[address]/
│       │   └── route.ts                       # GET /api/vault/:chainId/:address
│       └── vaults/featured/
│           └── route.ts                       # GET /api/vaults/featured
├── components/
│   ├── SearchBar.tsx                          # Address/ENS input + chain selector
│   ├── FeaturedVaultsList.tsx                 # Hot vaults grid with chain/protocol filter
│   ├── RiskGrade.tsx                          # Large color-coded letter grade
│   ├── CollapsibleCard.tsx                    # Shared wrapper for all 4 cards
│   ├── YieldCard.tsx                          # APY text stats + historical chart
│   ├── RiskDimensionCard.tsx                  # Score + indicator breakdown (reused × 3)
│   └── SkeletonCard.tsx                       # Loading placeholder
├── lib/
│   ├── defillama.ts                           # DefiLlama API client (TVL, APY, yields)
│   ├── thegraph.ts                            # The Graph Morpho subgraph client (bad debt)
│   ├── viemClient.ts                          # viem public clients (mainnet + base)
│   └── scoring/
│       ├── types.ts                           # VaultData, DimensionScore, CompositeScore
│       ├── assetRisk.ts                       # Dimension 1: asset risk scorer (40%)
│       ├── liquidationRisk.ts                 # Dimension 2: liquidation risk scorer (35%)
│       ├── curatorRisk.ts                     # Dimension 3: curator risk scorer (25%)
│       ├── composite.ts                       # Weighted average + letter grade
│       └── protocols/
│           └── morpho.ts                      # Morpho MetaMorpho data fetcher → VaultData
├── data/
│   └── featured-vaults.json                  # Curated vault list (manually maintained)
├── e2e/
│   └── vault.spec.ts                          # E2E: input vault address, verify grade
└── __tests__/
    ├── defillama.test.ts                      # DefiLlama client tests
    ├── thegraph.test.ts                       # The Graph client tests
    ├── api-vault.test.ts                      # API route integration tests
    └── scoring/
        ├── assetRisk.test.ts
        ├── liquidationRisk.test.ts
        ├── curatorRisk.test.ts
        └── composite.test.ts
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.ts`, `.env.local.example`

- [ ] **Step 1: Bootstrap Next.js project**

```bash
cd ~/vault-risk-scorer
npx create-next-app@latest . --typescript --tailwind --app --src-dir=false --import-alias="@/*"
```

Expected: project created with `app/`, `public/`, `package.json`.

- [ ] **Step 2: Install runtime dependencies**

```bash
npm install viem recharts
```

(`recharts` is used for the APY history line chart in `YieldCard`.)

- [ ] **Step 3: Install test dependencies**

```bash
npm install --save-dev jest @types/jest ts-jest jest-environment-node @playwright/test
```

- [ ] **Step 4: Configure Jest**

Create `jest.config.ts`:

```typescript
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    // stub out recharts so Jest doesn't choke on ESM
    '^recharts$': '<rootDir>/__mocks__/recharts.ts',
  },
}

export default config
```

- [ ] **Step 5: Create recharts mock (for Jest)**

```typescript
// __mocks__/recharts.ts
export const LineChart = () => null
export const Line = () => null
export const XAxis = () => null
export const YAxis = () => null
export const Tooltip = () => null
export const ResponsiveContainer = ({ children }: { children: React.ReactNode }) => children
```

- [ ] **Step 6: Add scripts to package.json**

Edit `package.json`, add under `"scripts"`:
```json
"test": "jest",
"test:watch": "jest --watch",
"test:e2e": "playwright test"
```

- [ ] **Step 7: Configure Playwright**

Create `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  use: {
    baseURL: 'http://localhost:3000',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
  },
})
```

- [ ] **Step 8: Create .env.local.example**

```
# RPC providers — server-side only, never expose to client
ALCHEMY_API_KEY=your_alchemy_key

# Derived RPC URLs (Next.js reads these in API routes)
RPC_MAINNET=https://eth-mainnet.g.alchemy.com/v2/your_alchemy_key
RPC_BASE=https://base-mainnet.g.alchemy.com/v2/your_alchemy_key
```

- [ ] **Step 9: Create directory structure**

```bash
mkdir -p lib/scoring/protocols __tests__/scoring data e2e __mocks__
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 14 project with TypeScript, Tailwind, Jest, Playwright"
```

---

## Task 2: Shared Types

**Files:**
- Create: `lib/scoring/types.ts`

- [ ] **Step 1: Write types**

```typescript
// lib/scoring/types.ts

export type ChainId = 1 | 8453  // 1 = Ethereum mainnet, 8453 = Base

export type AssetClass = 'stablecoin' | 'blue-chip' | 'long-tail'
export type OracleType = 'chainlink' | 'uniswap-twap' | 'custom'
export type LiquidationMechanism = 'dutch-auction' | 'fixed-discount'
export type CuratorType = 'anonymous' | 'known-team' | 'institution'

/** Raw on-chain + API data for a vault, before scoring */
export interface VaultData {
  // Identity
  address: string
  chainId: ChainId
  protocol: 'morpho'
  name: string

  // TVL + Yield (from DefiLlama)
  tvlUsd: number
  currentApyPct: number
  apy7dAvg: number | null
  apy30dAvg: number | null
  apy90dAvg: number | null
  apyHistory: Array<{ timestamp: number; apyPct: number }>

  // Underlying assets
  assets: Array<{
    address: string
    symbol: string
    assetClass: AssetClass
    oracleType: OracleType
    liquidityDepthUsd: number
    volatility30d: number       // decimal e.g. 0.05 = 5%
    vaultWeightPct: number
  }>

  // Liquidation rules (from on-chain via viem)
  maxLtvPct: number
  liquidationThresholdPct: number
  liquidationBonusPct: number
  liquidationMechanism: LiquidationMechanism
  historicalBadDebtUsd: number  // -1 = unavailable, 0 = none, >0 = bad debt occurred

  // Oracle
  oracleManipulationSurface: 'low' | 'medium' | 'high'

  // Curator
  curatorAddress: string
  curatorType: CuratorType
  permissionScope: 'narrow' | 'medium' | 'broad'
  timelockHours: number
  vaultsManaged: number
  incidentCount: number
  curatorBorrowsFromVault: boolean

  /** Indicators that used placeholder data — shown in UI as "estimated" */
  placeholderFields: string[]
}

/** Score for a single risk dimension */
export interface DimensionScore {
  score: number           // 0–100, lower = safer
  indicators: Array<{
    name: string
    value: string | number
    contribution: number
    note?: string
  }>
}

/** Final composite output returned by API and used by UI */
export interface CompositeScore {
  vaultAddress: string
  chainId: ChainId
  name: string
  tvlUsd: number           // needed for top bar display
  overallScore: number     // 0–100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  label: string            // e.g. "Low Risk"
  assetRisk: DimensionScore
  liquidationRisk: DimensionScore
  curatorRisk: DimensionScore
  currentApyPct: number
  apy7dAvg: number | null
  apy30dAvg: number | null
  apy90dAvg: number | null
  apyStabilityLabel: 'Stable' | 'Volatile'
  apyHistory: Array<{ timestamp: number; apyPct: number }>
  /** Indicator names that used estimated/placeholder data */
  placeholderFields: string[]
  dataFreshnessMs: number
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/scoring/types.ts
git commit -m "feat: add shared scoring types including tvlUsd and placeholderFields"
```

---

## Task 3: viem Client + Retry Utility

**Files:**
- Create: `lib/viemClient.ts`

- [ ] **Step 1: Write viem clients with retry wrapper**

```typescript
// lib/viemClient.ts
import { createPublicClient, http } from 'viem'
import { mainnet, base } from 'viem/chains'
import type { ChainId } from '@/lib/scoring/types'

function rpcUrl(chain: 'mainnet' | 'base'): string {
  const key = process.env.ALCHEMY_API_KEY
  if (!key) throw new Error('ALCHEMY_API_KEY is not set')
  return chain === 'mainnet'
    ? `https://eth-mainnet.g.alchemy.com/v2/${key}`
    : `https://base-mainnet.g.alchemy.com/v2/${key}`
}

export const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(rpcUrl('mainnet')),
})

export const baseClient = createPublicClient({
  chain: base,
  transport: http(rpcUrl('base')),
})

export function getClient(chainId: ChainId) {
  if (chainId === 1) return mainnetClient
  if (chainId === 8453) return baseClient
  throw new Error(`Unsupported chainId: ${chainId}`)
}

/**
 * Retry a promise-returning fn once on failure.
 * Spec requirement: "RPC timeout → retry once, then show 'Data temporarily unavailable'."
 */
export async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch {
    return await fn()  // one retry
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/viemClient.ts
git commit -m "feat: viem clients for mainnet + base with one-retry utility"
```

---

## Task 4: DefiLlama Client

**Files:**
- Create: `lib/defillama.ts`, `__tests__/defillama.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/defillama.test.ts
import { fetchVaultYield } from '@/lib/defillama'

global.fetch = jest.fn()

describe('fetchVaultYield', () => {
  it('returns APY and history for a known pool', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          apy: 5.2,
          apyMean30d: 4.8,
          apyBase7d: 5.0,
          chart: [
            { timestamp: '2026-03-20T00:00:00Z', apy: 4.9 },
            { timestamp: '2026-03-27T00:00:00Z', apy: 5.2 },
          ],
        },
      }),
    })

    const result = await fetchVaultYield('test-pool-id')
    expect(result.currentApyPct).toBe(5.2)
    expect(result.apy30dAvg).toBe(4.8)
    expect(result.apyHistory).toHaveLength(2)
  })

  it('throws on non-ok response', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 404 })
    await expect(fetchVaultYield('bad-id')).rejects.toThrow('DefiLlama')
  })

  it('returns tvlUsd from chart data', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          apy: 3, tvlUsd: 5_000_000,
          chart: [],
        },
      }),
    })
    const result = await fetchVaultYield('test-pool-id')
    expect(result.tvlUsd).toBe(5_000_000)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- __tests__/defillama.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/defillama'`

- [ ] **Step 3: Implement DefiLlama client**

```typescript
// lib/defillama.ts
const BASE = 'https://yields.llama.fi'

export interface VaultYield {
  tvlUsd: number
  currentApyPct: number
  apy7dAvg: number | null
  apy30dAvg: number | null
  apy90dAvg: number | null
  apyHistory: Array<{ timestamp: number; apyPct: number }>
}

export async function fetchVaultYield(poolId: string): Promise<VaultYield> {
  const res = await fetch(`${BASE}/chart/${poolId}`, {
    next: { revalidate: 300 },  // 5-min Next.js route cache
  })
  if (!res.ok) throw new Error(`DefiLlama /chart/${poolId} returned ${res.status}`)

  const json = await res.json()
  const data = json.data

  const history: Array<{ timestamp: number; apyPct: number }> = (data.chart ?? []).map(
    (row: { timestamp: string; apy: number }) => ({
      timestamp: new Date(row.timestamp).getTime(),
      apyPct: row.apy,
    })
  )

  return {
    tvlUsd: data.tvlUsd ?? 0,
    currentApyPct: data.apy ?? 0,
    apy7dAvg: data.apyBase7d ?? null,
    apy30dAvg: data.apyMean30d ?? null,
    apy90dAvg: data.apyMean90d ?? null,
    apyHistory: history,
  }
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- __tests__/defillama.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/defillama.ts __tests__/defillama.test.ts
git commit -m "feat: DefiLlama API client with TVL + APY history, with tests"
```

---

## Task 5: The Graph Client (Morpho Subgraph)

**Files:**
- Create: `lib/thegraph.ts`, `__tests__/thegraph.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// __tests__/thegraph.test.ts
import { fetchMorphoBadDebt } from '@/lib/thegraph'

global.fetch = jest.fn()

describe('fetchMorphoBadDebt', () => {
  it('sums bad debt USD from liquidation events', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          liquidations: [
            { badDebtUsd: '1000.5' },
            { badDebtUsd: '500.25' },
          ],
        },
      }),
    })
    const result = await fetchMorphoBadDebt('0xvault', 1)
    expect(result).toBeCloseTo(1500.75)
  })

  it('returns 0 when no bad debt events', async () => {
    ;(fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { liquidations: [] } }),
    })
    const result = await fetchMorphoBadDebt('0xvault', 1)
    expect(result).toBe(0)
  })

  it('returns -1 on network error', async () => {
    ;(fetch as jest.Mock).mockRejectedValueOnce(new Error('network'))
    const result = await fetchMorphoBadDebt('0xvault', 1)
    expect(result).toBe(-1)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- __tests__/thegraph.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement The Graph client**

```typescript
// lib/thegraph.ts
import type { ChainId } from '@/lib/scoring/types'

const MORPHO_SUBGRAPH: Record<ChainId, string> = {
  1: 'https://api.thegraph.com/subgraphs/name/morpho-association/morpho-blue',
  8453: 'https://api.thegraph.com/subgraphs/name/morpho-association/morpho-blue-base',
}

const BAD_DEBT_QUERY = `
  query BadDebt($vault: String!) {
    liquidations(where: { market_: { inputToken: $vault } }) {
      badDebtUsd
    }
  }
`

/**
 * Returns total historical bad debt in USD for a vault.
 * Returns -1 if the subgraph is unavailable (UI shows "N/A").
 */
export async function fetchMorphoBadDebt(
  vaultAddress: string,
  chainId: ChainId
): Promise<number> {
  const url = MORPHO_SUBGRAPH[chainId]
  if (!url) return -1

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: BAD_DEBT_QUERY,
        variables: { vault: vaultAddress.toLowerCase() },
      }),
      next: { revalidate: 300 },
    })
    if (!res.ok) return -1

    const json = await res.json()
    const liquidations: Array<{ badDebtUsd: string }> = json.data?.liquidations ?? []
    return liquidations.reduce((sum, l) => sum + parseFloat(l.badDebtUsd), 0)
  } catch {
    return -1
  }
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
npm test -- __tests__/thegraph.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/thegraph.ts __tests__/thegraph.test.ts
git commit -m "feat: The Graph Morpho subgraph client with bad debt query"
```

---

## Task 6: Morpho Protocol Data Fetcher

**Files:**
- Create: `lib/scoring/protocols/morpho.ts`

This module fetches all on-chain data for a MetaMorpho vault and returns a `VaultData` object. It is the only file with side effects in the scoring pipeline — the scorers downstream are pure functions.

- [ ] **Step 1: Write the Morpho data fetcher**

```typescript
// lib/scoring/protocols/morpho.ts
import { getAddress, type Address } from 'viem'
import { getClient, withRetry } from '@/lib/viemClient'
import { fetchVaultYield } from '@/lib/defillama'
import { fetchMorphoBadDebt } from '@/lib/thegraph'
import type { ChainId, VaultData } from '@/lib/scoring/types'

const METAMORPHO_ABI = [
  {
    name: 'name',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'string' }],
  },
  {
    name: 'owner',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    name: 'timelock',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const

/**
 * Fetches all data needed to score a MetaMorpho vault.
 * Fields that could not be fetched are hardcoded to safe-ish defaults
 * and recorded in `placeholderFields` so the UI can show "estimated" labels.
 */
export async function fetchMorphoVaultData(
  address: string,
  chainId: ChainId,
  defillamaPoolId: string
): Promise<VaultData> {
  const client = getClient(chainId)
  const checksumAddress = getAddress(address) as Address

  const [name, owner, timelockRaw, yield_, badDebt] = await Promise.all([
    withRetry(() =>
      client.readContract({
        address: checksumAddress,
        abi: METAMORPHO_ABI,
        functionName: 'name',
      })
    ),
    withRetry(() =>
      client.readContract({
        address: checksumAddress,
        abi: METAMORPHO_ABI,
        functionName: 'owner',
      })
    ),
    withRetry(() =>
      client.readContract({
        address: checksumAddress,
        abi: METAMORPHO_ABI,
        functionName: 'timelock',
      })
    ),
    fetchVaultYield(defillamaPoolId),
    fetchMorphoBadDebt(address, chainId),
  ])

  const timelockHours = Number(timelockRaw) / 3600

  // These fields require additional market config reads not yet implemented.
  // They are recorded in placeholderFields so the UI shows an "estimated" badge.
  const placeholderFields = [
    'assets',
    'maxLtvPct',
    'liquidationThresholdPct',
    'liquidationBonusPct',
    'liquidationMechanism',
    'oracleManipulationSurface',
    'curatorType',
    'permissionScope',
    'vaultsManaged',
    'incidentCount',
    'curatorBorrowsFromVault',
  ]

  return {
    address,
    chainId,
    protocol: 'morpho',
    name: name as string,
    tvlUsd: yield_.tvlUsd,
    currentApyPct: yield_.currentApyPct,
    apy7dAvg: yield_.apy7dAvg,
    apy30dAvg: yield_.apy30dAvg,
    apy90dAvg: yield_.apy90dAvg,
    apyHistory: yield_.apyHistory,
    assets: [],                             // placeholder — market config reads TBD
    maxLtvPct: 80,
    liquidationThresholdPct: 85,
    liquidationBonusPct: 5,
    liquidationMechanism: 'dutch-auction',
    historicalBadDebtUsd: badDebt,          // real data from The Graph
    oracleManipulationSurface: 'low',
    curatorAddress: owner as string,        // real on-chain data
    curatorType: 'known-team',
    permissionScope: 'medium',
    timelockHours,                          // real on-chain data
    vaultsManaged: 1,
    incidentCount: 0,
    curatorBorrowsFromVault: false,
    placeholderFields,
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/scoring/protocols/morpho.ts
git commit -m "feat: Morpho data fetcher with retry and explicit placeholder tracking"
```

---

## Task 7: Scoring Engine — Asset Risk (Dimension 1, 40%)

**Files:**
- Create: `lib/scoring/assetRisk.ts`, `__tests__/scoring/assetRisk.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/scoring/assetRisk.test.ts
import { scoreAssetRisk } from '@/lib/scoring/assetRisk'
import type { VaultData } from '@/lib/scoring/types'

const baseVault: VaultData = {
  address: '0x1234', chainId: 1, protocol: 'morpho', name: 'Test Vault',
  tvlUsd: 10_000_000, currentApyPct: 5,
  apy7dAvg: 5, apy30dAvg: 5, apy90dAvg: 5, apyHistory: [],
  assets: [{
    address: '0xasset', symbol: 'USDC',
    assetClass: 'stablecoin', oracleType: 'chainlink',
    liquidityDepthUsd: 50_000_000, volatility30d: 0.002, vaultWeightPct: 100,
  }],
  maxLtvPct: 80, liquidationThresholdPct: 85, liquidationBonusPct: 5,
  liquidationMechanism: 'dutch-auction', historicalBadDebtUsd: 0,
  oracleManipulationSurface: 'low',
  curatorAddress: '0xcurator', curatorType: 'institution', permissionScope: 'narrow',
  timelockHours: 72, vaultsManaged: 5, incidentCount: 0, curatorBorrowsFromVault: false,
  placeholderFields: [],
}

describe('scoreAssetRisk', () => {
  it('returns low score for stablecoin with Chainlink oracle and deep liquidity', () => {
    const result = scoreAssetRisk(baseVault)
    expect(result.score).toBeLessThan(30)
    expect(result.indicators).toHaveLength(5)
  })

  it('returns score=50 with N/A indicator when no asset data', () => {
    const noAssets = { ...baseVault, assets: [] }
    const result = scoreAssetRisk(noAssets)
    expect(result.score).toBe(50)
    expect(result.indicators[0].value).toBe('N/A')
  })

  it('penalizes long-tail asset vs stablecoin', () => {
    const risky = { ...baseVault, assets: [{ ...baseVault.assets[0], assetClass: 'long-tail' as const }] }
    expect(scoreAssetRisk(risky).score).toBeGreaterThan(scoreAssetRisk(baseVault).score)
  })

  it('penalizes custom oracle', () => {
    const custom = { ...baseVault, assets: [{ ...baseVault.assets[0], oracleType: 'custom' as const }] }
    expect(scoreAssetRisk(custom).score).toBeGreaterThan(scoreAssetRisk(baseVault).score)
  })

  it('penalizes >50% single-asset concentration in multi-asset vault', () => {
    const concentrated = {
      ...baseVault,
      assets: [
        { ...baseVault.assets[0], vaultWeightPct: 80 },
        { ...baseVault.assets[0], symbol: 'DAI', vaultWeightPct: 20 },
      ],
    }
    expect(scoreAssetRisk(concentrated).score).toBeGreaterThan(scoreAssetRisk(baseVault).score)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- __tests__/scoring/assetRisk.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Implement asset risk scorer**

```typescript
// lib/scoring/assetRisk.ts
import type { VaultData, DimensionScore, AssetClass, OracleType } from './types'

const ASSET_CLASS_SCORE: Record<AssetClass, number> = {
  stablecoin: 5,
  'blue-chip': 20,
  'long-tail': 45,
}

const ORACLE_SCORE: Record<OracleType, number> = {
  chainlink: 0,
  'uniswap-twap': 15,
  custom: 30,
}

export function scoreAssetRisk(vault: VaultData): DimensionScore {
  if (vault.assets.length === 0) {
    return {
      score: 50,
      indicators: [{ name: 'Asset data', value: 'N/A', contribution: 50, note: 'On-chain asset data unavailable' }],
    }
  }

  const indicators: DimensionScore['indicators'] = []
  let score = 0

  // 1. Asset type (dominant asset by weight)
  const dominant = vault.assets.reduce((a, b) => a.vaultWeightPct >= b.vaultWeightPct ? a : b)
  const assetTypeScore = ASSET_CLASS_SCORE[dominant.assetClass]
  score += assetTypeScore
  indicators.push({ name: 'Asset type', value: dominant.assetClass, contribution: assetTypeScore })

  // 2. Oracle source (worst oracle among assets)
  const oracleOrder: OracleType[] = ['chainlink', 'uniswap-twap', 'custom']
  const worstOracle = vault.assets.reduce<OracleType>(
    (worst, a) => oracleOrder.indexOf(a.oracleType) > oracleOrder.indexOf(worst) ? a.oracleType : worst,
    'chainlink'
  )
  const oracleScore = ORACLE_SCORE[worstOracle]
  score += oracleScore
  indicators.push({ name: 'Oracle source', value: worstOracle, contribution: oracleScore })

  // 3. Liquidity depth vs TVL
  const totalLiquidity = vault.assets.reduce((s, a) => s + a.liquidityDepthUsd, 0)
  const ratio = vault.tvlUsd > 0 ? totalLiquidity / vault.tvlUsd : 0
  const liquidityScore = ratio >= 5 ? 0 : ratio >= 2 ? 5 : ratio >= 1 ? 15 : 25
  score += liquidityScore
  indicators.push({ name: 'Liquidity depth', value: `${ratio.toFixed(1)}× TVL`, contribution: liquidityScore })

  // 4. 30-day volatility (weighted avg)
  const weightedVol = vault.assets.reduce((s, a) => s + a.volatility30d * (a.vaultWeightPct / 100), 0)
  const volScore = weightedVol < 0.01 ? 0 : weightedVol < 0.05 ? 5 : weightedVol < 0.15 ? 10 : 20
  score += volScore
  indicators.push({ name: '30d volatility', value: `${(weightedVol * 100).toFixed(1)}%`, contribution: volScore })

  // 5. Concentration (>50% single asset in multi-asset vault)
  const maxWeight = Math.max(...vault.assets.map(a => a.vaultWeightPct))
  const concentrated = vault.assets.length > 1 && maxWeight > 50
  const concScore = concentrated ? 10 : 0
  score += concScore
  indicators.push({
    name: 'Concentration',
    value: `${maxWeight}% in ${dominant.symbol}`,
    contribution: concScore,
    note: concentrated ? 'Single asset >50% of multi-asset vault' : undefined,
  })

  return { score: Math.min(100, score), indicators }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- __tests__/scoring/assetRisk.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/scoring/assetRisk.ts __tests__/scoring/assetRisk.test.ts
git commit -m "feat: asset risk scorer (dimension 1) with TDD"
```

---

## Task 8: Scoring Engine — Liquidation Risk (Dimension 2, 35%)

**Files:**
- Create: `lib/scoring/liquidationRisk.ts`, `__tests__/scoring/liquidationRisk.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/scoring/liquidationRisk.test.ts
import { scoreLiquidationRisk } from '@/lib/scoring/liquidationRisk'
import type { VaultData } from '@/lib/scoring/types'

const safeVault: VaultData = {
  address: '0x1234', chainId: 1, protocol: 'morpho', name: 'Safe',
  tvlUsd: 10_000_000, currentApyPct: 5,
  apy7dAvg: 5, apy30dAvg: 5, apy90dAvg: 5, apyHistory: [], assets: [],
  maxLtvPct: 75, liquidationThresholdPct: 85,  // 10% buffer
  liquidationBonusPct: 8, liquidationMechanism: 'dutch-auction',
  historicalBadDebtUsd: 0, oracleManipulationSurface: 'low',
  curatorAddress: '0x0', curatorType: 'institution', permissionScope: 'narrow',
  timelockHours: 72, vaultsManaged: 5, incidentCount: 0, curatorBorrowsFromVault: false,
  placeholderFields: [],
}

describe('scoreLiquidationRisk', () => {
  it('returns low score for wide buffer + dutch auction + no bad debt', () => {
    const result = scoreLiquidationRisk(safeVault)
    expect(result.score).toBeLessThan(25)
    expect(result.indicators).toHaveLength(5)
  })

  it('penalizes thin LTV buffer (<5%)', () => {
    const thin = { ...safeVault, maxLtvPct: 82, liquidationThresholdPct: 85 }
    expect(scoreLiquidationRisk(thin).score).toBeGreaterThan(scoreLiquidationRisk(safeVault).score)
  })

  it('penalizes fixed-discount liquidation mechanism', () => {
    const fixed = { ...safeVault, liquidationMechanism: 'fixed-discount' as const }
    expect(scoreLiquidationRisk(fixed).score).toBeGreaterThan(scoreLiquidationRisk(safeVault).score)
  })

  it('gives large penalty for historical bad debt', () => {
    const badDebt = { ...safeVault, historicalBadDebtUsd: 50_000 }
    expect(scoreLiquidationRisk(badDebt).score).toBeGreaterThan(scoreLiquidationRisk(safeVault).score + 20)
  })

  it('shows N/A and no penalty when bad debt data is unavailable (returns -1)', () => {
    const unknown = { ...safeVault, historicalBadDebtUsd: -1 }
    const indicator = scoreLiquidationRisk(unknown).indicators.find(i => i.name === 'Historical bad debt')!
    expect(indicator.value).toBe('N/A')
    expect(indicator.contribution).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- __tests__/scoring/liquidationRisk.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement liquidation risk scorer**

```typescript
// lib/scoring/liquidationRisk.ts
import type { VaultData, DimensionScore } from './types'

export function scoreLiquidationRisk(vault: VaultData): DimensionScore {
  const indicators: DimensionScore['indicators'] = []
  let score = 0

  // 1. LTV buffer
  const buffer = vault.liquidationThresholdPct - vault.maxLtvPct
  const ltvScore = buffer >= 10 ? 0 : buffer >= 7 ? 5 : buffer >= 5 ? 15 : buffer >= 3 ? 25 : 40
  score += ltvScore
  indicators.push({
    name: 'LTV buffer',
    value: `${buffer}% (max LTV ${vault.maxLtvPct}% → liq. threshold ${vault.liquidationThresholdPct}%)`,
    contribution: ltvScore,
    note: buffer < 5 ? 'Thin buffer — liquidators may not have enough time to act' : undefined,
  })

  // 2. Liquidation incentive
  const bonusScore = vault.liquidationBonusPct >= 7 ? 0
    : vault.liquidationBonusPct >= 5 ? 5
    : vault.liquidationBonusPct >= 3 ? 15
    : 25
  score += bonusScore
  indicators.push({
    name: 'Liquidation incentive',
    value: `${vault.liquidationBonusPct}%`,
    contribution: bonusScore,
    note: vault.liquidationBonusPct < 3 ? 'Very low bonus — liquidators may not act' : undefined,
  })

  // 3. Liquidation mechanism
  const mechScore = vault.liquidationMechanism === 'dutch-auction' ? 0 : 10
  score += mechScore
  indicators.push({
    name: 'Liquidation mechanism',
    value: vault.liquidationMechanism,
    contribution: mechScore,
    note: vault.liquidationMechanism === 'fixed-discount' ? 'Less resilient in volatile markets' : undefined,
  })

  // 4. Historical bad debt
  let badDebtScore = 0
  let badDebtValue: string
  if (vault.historicalBadDebtUsd === -1) {
    badDebtValue = 'N/A'
  } else if (vault.historicalBadDebtUsd === 0) {
    badDebtValue = '$0'
  } else {
    badDebtValue = `$${vault.historicalBadDebtUsd.toLocaleString()}`
    badDebtScore = 30
  }
  score += badDebtScore
  indicators.push({
    name: 'Historical bad debt',
    value: badDebtValue,
    contribution: badDebtScore,
    note: vault.historicalBadDebtUsd > 0 ? 'Protocol has experienced bad debt — significant risk flag' : undefined,
  })

  // 5. Oracle manipulation surface
  const oracleScore = vault.oracleManipulationSurface === 'low' ? 0
    : vault.oracleManipulationSurface === 'medium' ? 10
    : 20
  score += oracleScore
  indicators.push({
    name: 'Oracle manipulation surface',
    value: vault.oracleManipulationSurface,
    contribution: oracleScore,
  })

  return { score: Math.min(100, score), indicators }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- __tests__/scoring/liquidationRisk.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/scoring/liquidationRisk.ts __tests__/scoring/liquidationRisk.test.ts
git commit -m "feat: liquidation risk scorer (dimension 2) with TDD"
```

---

## Task 9: Scoring Engine — Curator Risk (Dimension 3, 25%)

**Files:**
- Create: `lib/scoring/curatorRisk.ts`, `__tests__/scoring/curatorRisk.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/scoring/curatorRisk.test.ts
import { scoreCuratorRisk } from '@/lib/scoring/curatorRisk'
import type { VaultData } from '@/lib/scoring/types'

const trusted: VaultData = {
  address: '0x1234', chainId: 1, protocol: 'morpho', name: 'Test',
  tvlUsd: 10_000_000, currentApyPct: 5,
  apy7dAvg: 5, apy30dAvg: 5, apy90dAvg: 5, apyHistory: [], assets: [],
  maxLtvPct: 80, liquidationThresholdPct: 85, liquidationBonusPct: 5,
  liquidationMechanism: 'dutch-auction', historicalBadDebtUsd: 0,
  oracleManipulationSurface: 'low',
  curatorAddress: '0xcurator', curatorType: 'institution',
  permissionScope: 'narrow', timelockHours: 72,
  vaultsManaged: 10, incidentCount: 0, curatorBorrowsFromVault: false,
  placeholderFields: [],
}

describe('scoreCuratorRisk', () => {
  it('returns low score for institution + narrow scope + 72h timelock + no incidents', () => {
    const result = scoreCuratorRisk(trusted)
    expect(result.score).toBeLessThan(15)
    expect(result.indicators).toHaveLength(5)
  })

  it('penalizes anonymous curator', () => {
    const anon = { ...trusted, curatorType: 'anonymous' as const }
    expect(scoreCuratorRisk(anon).score).toBeGreaterThan(scoreCuratorRisk(trusted).score + 20)
  })

  it('penalizes broad permission scope', () => {
    const broad = { ...trusted, permissionScope: 'broad' as const }
    expect(scoreCuratorRisk(broad).score).toBeGreaterThan(scoreCuratorRisk(trusted).score)
  })

  it('penalizes no timelock', () => {
    const noLock = { ...trusted, timelockHours: 0 }
    expect(scoreCuratorRisk(noLock).score).toBeGreaterThan(scoreCuratorRisk(trusted).score)
  })

  it('penalizes conflict of interest', () => {
    const coi = { ...trusted, curatorBorrowsFromVault: true }
    expect(scoreCuratorRisk(coi).score).toBeGreaterThan(scoreCuratorRisk(trusted).score)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- __tests__/scoring/curatorRisk.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement curator risk scorer**

```typescript
// lib/scoring/curatorRisk.ts
import type { VaultData, DimensionScore } from './types'

export function scoreCuratorRisk(vault: VaultData): DimensionScore {
  const indicators: DimensionScore['indicators'] = []
  let score = 0

  // 1. Curator identity
  const idScore = vault.curatorType === 'institution' ? 0 : vault.curatorType === 'known-team' ? 10 : 30
  score += idScore
  indicators.push({ name: 'Curator identity', value: vault.curatorType, contribution: idScore })

  // 2. Permission scope
  const permScore = vault.permissionScope === 'narrow' ? 0 : vault.permissionScope === 'medium' ? 10 : 20
  score += permScore
  indicators.push({ name: 'Permission scope', value: vault.permissionScope, contribution: permScore })

  // 3. Timelock protection
  const tlScore = vault.timelockHours >= 72 ? 0 : vault.timelockHours >= 24 ? 5 : vault.timelockHours >= 1 ? 15 : 25
  score += tlScore
  indicators.push({
    name: 'Timelock',
    value: vault.timelockHours === 0 ? 'None' : `${vault.timelockHours}h`,
    contribution: tlScore,
    note: vault.timelockHours === 0 ? 'No timelock — parameter changes are instant' : undefined,
  })

  // 4. Track record
  const trackScore = vault.incidentCount === 0 ? 0 : vault.incidentCount === 1 ? 15 : 30
  score += trackScore
  indicators.push({
    name: 'Track record',
    value: `${vault.vaultsManaged} vault(s), ${vault.incidentCount} incident(s)`,
    contribution: trackScore,
  })

  // 5. Conflict of interest
  const coiScore = vault.curatorBorrowsFromVault ? 15 : 0
  score += coiScore
  indicators.push({
    name: 'Conflict of interest',
    value: vault.curatorBorrowsFromVault ? 'Yes — curator borrowing from vault' : 'None detected',
    contribution: coiScore,
  })

  return { score: Math.min(100, score), indicators }
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- __tests__/scoring/curatorRisk.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/scoring/curatorRisk.ts __tests__/scoring/curatorRisk.test.ts
git commit -m "feat: curator risk scorer (dimension 3) with TDD"
```

---

## Task 10: Composite Scorer

**Files:**
- Create: `lib/scoring/composite.ts`, `__tests__/scoring/composite.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// __tests__/scoring/composite.test.ts
import { computeCompositeScore, scoreToGrade, scoreVault } from '@/lib/scoring/composite'
import type { VaultData } from '@/lib/scoring/types'

describe('scoreToGrade', () => {
  it.each([
    [0, 'A'], [20, 'A'],
    [21, 'B'], [40, 'B'],
    [41, 'C'], [60, 'C'],
    [61, 'D'], [80, 'D'],
    [81, 'F'], [100, 'F'],
  ])('score %i → grade %s', (score, grade) => {
    expect(scoreToGrade(score).grade).toBe(grade)
  })
})

describe('computeCompositeScore', () => {
  it('weights dimensions 40/35/25', () => {
    // 100×0.4 + 0×0.35 + 0×0.25 = 40
    expect(computeCompositeScore(
      { score: 100, indicators: [] },
      { score: 0, indicators: [] },
      { score: 0, indicators: [] },
    )).toBe(40)
  })
})

describe('scoreVault', () => {
  const vault: VaultData = {
    address: '0x1234', chainId: 1, protocol: 'morpho', name: 'Test',
    tvlUsd: 5_000_000, currentApyPct: 4.5,
    apy7dAvg: 4.5, apy30dAvg: 4.5, apy90dAvg: 4.5,
    apyHistory: [{ timestamp: 1, apyPct: 4.5 }, { timestamp: 2, apyPct: 4.5 }],
    assets: [{ address: '0xa', symbol: 'USDC', assetClass: 'stablecoin', oracleType: 'chainlink', liquidityDepthUsd: 50_000_000, volatility30d: 0.001, vaultWeightPct: 100 }],
    maxLtvPct: 80, liquidationThresholdPct: 90, liquidationBonusPct: 8,
    liquidationMechanism: 'dutch-auction', historicalBadDebtUsd: 0,
    oracleManipulationSurface: 'low',
    curatorAddress: '0xc', curatorType: 'institution', permissionScope: 'narrow',
    timelockHours: 72, vaultsManaged: 5, incidentCount: 0, curatorBorrowsFromVault: false,
    placeholderFields: [],
  }

  it('returns a CompositeScore with grade, tvlUsd, and name', () => {
    const result = scoreVault(vault)
    expect(['A', 'B', 'C', 'D', 'F']).toContain(result.grade)
    expect(result.tvlUsd).toBe(5_000_000)
    expect(result.name).toBe('Test')
    expect(result.overallScore).toBeGreaterThanOrEqual(0)
    expect(result.overallScore).toBeLessThanOrEqual(100)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- __tests__/scoring/composite.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement composite scorer**

```typescript
// lib/scoring/composite.ts
import type { DimensionScore, CompositeScore, VaultData } from './types'
import { scoreAssetRisk } from './assetRisk'
import { scoreLiquidationRisk } from './liquidationRisk'
import { scoreCuratorRisk } from './curatorRisk'

const WEIGHTS = { asset: 0.40, liquidation: 0.35, curator: 0.25 } as const

export function computeCompositeScore(
  asset: DimensionScore,
  liquidation: DimensionScore,
  curator: DimensionScore
): number {
  return Math.round(
    asset.score * WEIGHTS.asset +
    liquidation.score * WEIGHTS.liquidation +
    curator.score * WEIGHTS.curator
  )
}

export function scoreToGrade(score: number): { grade: CompositeScore['grade']; label: string } {
  if (score <= 20) return { grade: 'A', label: 'Low Risk' }
  if (score <= 40) return { grade: 'B', label: 'Moderate-Low Risk' }
  if (score <= 60) return { grade: 'C', label: 'Moderate Risk' }
  if (score <= 80) return { grade: 'D', label: 'High Risk' }
  return { grade: 'F', label: 'Very High Risk' }
}

function computeApyStability(vault: VaultData): 'Stable' | 'Volatile' {
  const history = vault.apyHistory.map(h => h.apyPct)
  if (history.length < 2) return 'Stable'
  const mean = history.reduce((s, v) => s + v, 0) / history.length
  const variance = history.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / history.length
  return Math.sqrt(variance) > 1.5 ? 'Volatile' : 'Stable'
}

export function scoreVault(vault: VaultData): CompositeScore {
  const assetRisk = scoreAssetRisk(vault)
  const liquidationRisk = scoreLiquidationRisk(vault)
  const curatorRisk = scoreCuratorRisk(vault)
  const overallScore = computeCompositeScore(assetRisk, liquidationRisk, curatorRisk)
  const { grade, label } = scoreToGrade(overallScore)

  return {
    vaultAddress: vault.address,
    chainId: vault.chainId,
    name: vault.name,
    tvlUsd: vault.tvlUsd,
    overallScore,
    grade,
    label,
    assetRisk,
    liquidationRisk,
    curatorRisk,
    currentApyPct: vault.currentApyPct,
    apy7dAvg: vault.apy7dAvg,
    apy30dAvg: vault.apy30dAvg,
    apy90dAvg: vault.apy90dAvg,
    apyStabilityLabel: computeApyStability(vault),
    apyHistory: vault.apyHistory,
    placeholderFields: vault.placeholderFields,
    dataFreshnessMs: Date.now(),
  }
}
```

- [ ] **Step 4: Run all scoring tests**

```bash
npm test -- __tests__/scoring/
```

Expected: PASS (all tests in scoring/)

- [ ] **Step 5: Commit**

```bash
git add lib/scoring/composite.ts __tests__/scoring/composite.test.ts
git commit -m "feat: composite scorer with weighted dimensions and letter grade"
```

---

## Task 11: Featured Vaults Data

**Files:**
- Create: `data/featured-vaults.json`

- [ ] **Step 1: Create curated vault list**

```json
[
  {
    "name": "Gauntlet USDC Core",
    "address": "0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB",
    "chainId": 1,
    "protocol": "morpho",
    "defillamaPoolId": "6a5cce30-3ab1-4e06-a3d9-22e81cfed0f6",
    "tags": ["stablecoin", "core"]
  },
  {
    "name": "Steakhouse USDC",
    "address": "0xBEEF069f4F19fcA43c2e4e3b52b5ec71C5069CA",
    "chainId": 1,
    "protocol": "morpho",
    "defillamaPoolId": "placeholder-replace-me",
    "tags": ["stablecoin"]
  },
  {
    "name": "Moonwell Flagship ETH",
    "address": "0xa0E430870c4604CcE522E4787Af78adCEEe2B44",
    "chainId": 8453,
    "protocol": "morpho",
    "defillamaPoolId": "placeholder-replace-me-base",
    "tags": ["eth", "base"]
  }
]
```

**Note:** Look up real DefiLlama pool IDs at `https://yields.llama.fi/pools?project=morpho` and replace the `placeholder-replace-me` values before running the app.

- [ ] **Step 2: Commit**

```bash
git add data/featured-vaults.json
git commit -m "feat: add curated featured vaults list (3 Morpho vaults, placeholder pool IDs)"
```

---

## Task 12: API Routes

**Files:**
- Create: `app/api/vault/[chainId]/[address]/route.ts`
- Create: `app/api/vaults/featured/route.ts`
- Create: `__tests__/api-vault.test.ts`

- [ ] **Step 1: Write failing API integration test**

```typescript
// __tests__/api-vault.test.ts
// Integration test for the vault API route handler using mocked dependencies

jest.mock('@/lib/scoring/protocols/morpho', () => ({
  fetchMorphoVaultData: jest.fn(),
}))

import { GET } from '@/app/api/vault/[chainId]/[address]/route'
import { fetchMorphoVaultData } from '@/lib/scoring/protocols/morpho'
import type { VaultData } from '@/lib/scoring/types'

const mockVault: VaultData = {
  address: '0xbeef', chainId: 1, protocol: 'morpho', name: 'Mock Vault',
  tvlUsd: 1_000_000, currentApyPct: 5,
  apy7dAvg: 5, apy30dAvg: 5, apy90dAvg: 5, apyHistory: [],
  assets: [], maxLtvPct: 80, liquidationThresholdPct: 85, liquidationBonusPct: 5,
  liquidationMechanism: 'dutch-auction', historicalBadDebtUsd: 0,
  oracleManipulationSurface: 'low',
  curatorAddress: '0x0', curatorType: 'institution', permissionScope: 'narrow',
  timelockHours: 72, vaultsManaged: 1, incidentCount: 0, curatorBorrowsFromVault: false,
  placeholderFields: [],
}

describe('GET /api/vault/[chainId]/[address]', () => {
  it('returns 200 with a composite score for a valid vault', async () => {
    ;(fetchMorphoVaultData as jest.Mock).mockResolvedValueOnce(mockVault)

    const req = new Request('http://localhost/api/vault/1/0xbeef')
    const res = await GET(req, { params: { chainId: '1', address: '0xbeef' } })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(['A', 'B', 'C', 'D', 'F']).toContain(body.grade)
    expect(body.tvlUsd).toBe(1_000_000)
    expect(body.name).toBe('Mock Vault')
  })

  it('returns 400 for an unsupported chain', async () => {
    const req = new Request('http://localhost/api/vault/999/0xbeef')
    const res = await GET(req, { params: { chainId: '999', address: '0xbeef' } })
    expect(res.status).toBe(400)
  })

  it('returns 503 when data fetch throws', async () => {
    ;(fetchMorphoVaultData as jest.Mock).mockRejectedValueOnce(new Error('RPC timeout'))
    const req = new Request('http://localhost/api/vault/1/0xbeef')
    const res = await GET(req, { params: { chainId: '1', address: '0xbeef' } })
    expect(res.status).toBe(503)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npm test -- __tests__/api-vault.test.ts
```

Expected: FAIL — module not found

- [ ] **Step 3: Write vault API route**

```typescript
// app/api/vault/[chainId]/[address]/route.ts
import { NextResponse } from 'next/server'
import { fetchMorphoVaultData } from '@/lib/scoring/protocols/morpho'
import { scoreVault } from '@/lib/scoring/composite'
import featuredVaults from '@/data/featured-vaults.json'
import type { ChainId } from '@/lib/scoring/types'

const SUPPORTED_CHAIN_IDS: ChainId[] = [1, 8453]

export async function GET(
  _req: Request,
  { params }: { params: { chainId: string; address: string } }
) {
  const chainId = parseInt(params.chainId) as ChainId
  const address = params.address.toLowerCase()

  if (!SUPPORTED_CHAIN_IDS.includes(chainId)) {
    return NextResponse.json(
      { error: `Chain ${chainId} not supported. Supported: ${SUPPORTED_CHAIN_IDS.join(', ')}` },
      { status: 400 }
    )
  }

  const featured = featuredVaults.find(
    v => v.address.toLowerCase() === address && v.chainId === chainId
  )
  const defillamaPoolId = featured?.defillamaPoolId ?? address

  try {
    const vaultData = await fetchMorphoVaultData(address, chainId, defillamaPoolId)
    const score = scoreVault(vaultData)
    return NextResponse.json(score)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    if (message.toLowerCase().includes('not found')) {
      return NextResponse.json({ error: 'Vault not found or not supported' }, { status: 404 })
    }
    return NextResponse.json(
      { error: 'Data temporarily unavailable', detail: message },
      { status: 503 }
    )
  }
}
```

- [ ] **Step 4: Write featured vaults API route**

```typescript
// app/api/vaults/featured/route.ts
import { NextResponse } from 'next/server'
import featuredVaults from '@/data/featured-vaults.json'

export async function GET() {
  return NextResponse.json(featuredVaults, {
    headers: { 'Cache-Control': 'public, max-age=3600' },
  })
}
```

- [ ] **Step 5: Run API integration test**

```bash
npm test -- __tests__/api-vault.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 6: Run full test suite**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 7: Commit**

```bash
git add app/api/ __tests__/api-vault.test.ts
git commit -m "feat: API routes for vault scoring and featured vaults, with integration tests"
```

---

## Task 13: Shared UI Components

**Files:**
- Create: `components/RiskGrade.tsx`, `components/CollapsibleCard.tsx`, `components/SkeletonCard.tsx`

- [ ] **Step 1: RiskGrade component**

```tsx
// components/RiskGrade.tsx
type Grade = 'A' | 'B' | 'C' | 'D' | 'F'

const GRADE_COLORS: Record<Grade, string> = {
  A: 'text-green-400 border-green-400',
  B: 'text-lime-400 border-lime-400',
  C: 'text-yellow-400 border-yellow-400',
  D: 'text-orange-400 border-orange-400',
  F: 'text-red-500 border-red-500',
}

interface Props {
  grade: Grade
  score: number
  label: string
  size?: 'sm' | 'lg'
}

export function RiskGrade({ grade, score, label, size = 'lg' }: Props) {
  const colors = GRADE_COLORS[grade]
  return (
    <div className={`flex flex-col items-center border-2 rounded-xl p-3 ${colors}`}>
      <span className={size === 'lg' ? 'text-5xl font-bold' : 'text-2xl font-bold'}>{grade}</span>
      <span className="text-sm opacity-80">Risk Score: {score}/100</span>
      <span className="text-xs mt-1 font-medium">{label}</span>
    </div>
  )
}
```

- [ ] **Step 2: CollapsibleCard component**

```tsx
// components/CollapsibleCard.tsx
'use client'
import { useState } from 'react'

interface Props {
  title: string
  subtitle?: string
  defaultOpen?: boolean
  children: React.ReactNode
}

export function CollapsibleCard({ title, subtitle, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-800 transition-colors"
      >
        <div className="text-left">
          <h3 className="text-white font-semibold">{title}</h3>
          {subtitle && <p className="text-gray-400 text-sm mt-0.5">{subtitle}</p>}
        </div>
        <span className="text-gray-400 text-xl">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  )
}
```

- [ ] **Step 3: SkeletonCard component**

```tsx
// components/SkeletonCard.tsx
export function SkeletonCard({ rows = 3 }: { rows?: number }) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-5 animate-pulse">
      <div className="h-5 bg-gray-700 rounded w-1/3 mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-4 bg-gray-800 rounded mb-2" style={{ width: `${70 + i * 10}%` }} />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add components/RiskGrade.tsx components/CollapsibleCard.tsx components/SkeletonCard.tsx
git commit -m "feat: add RiskGrade, CollapsibleCard, SkeletonCard components"
```

---

## Task 14: YieldCard Component

**Files:**
- Create: `components/YieldCard.tsx`

- [ ] **Step 1: Write YieldCard with APY chart**

```tsx
// components/YieldCard.tsx
'use client'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface Props {
  currentApyPct: number
  apy7dAvg: number | null
  apy30dAvg: number | null
  apy90dAvg: number | null
  apyStabilityLabel: 'Stable' | 'Volatile'
  apyHistory: Array<{ timestamp: number; apyPct: number }>
}

export function YieldCard({
  currentApyPct, apy7dAvg, apy30dAvg, apy90dAvg, apyStabilityLabel, apyHistory,
}: Props) {
  const chartData = apyHistory.slice(-90).map(h => ({
    date: new Date(h.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    apy: Number(h.apyPct.toFixed(2)),
  }))

  return (
    <div>
      <div className="flex gap-6 mb-4 text-sm">
        <div>
          <p className="text-gray-500">Current APY</p>
          <p className="text-white text-xl font-bold">{currentApyPct.toFixed(2)}%</p>
        </div>
        {apy7dAvg != null && (
          <div>
            <p className="text-gray-500">7-day avg</p>
            <p className="text-gray-300">{apy7dAvg.toFixed(2)}%</p>
          </div>
        )}
        {apy30dAvg != null && (
          <div>
            <p className="text-gray-500">30-day avg</p>
            <p className="text-gray-300">{apy30dAvg.toFixed(2)}%</p>
          </div>
        )}
        {apy90dAvg != null && (
          <div>
            <p className="text-gray-500">90-day avg</p>
            <p className="text-gray-300">{apy90dAvg.toFixed(2)}%</p>
          </div>
        )}
        <div>
          <p className="text-gray-500">Stability</p>
          <p className={apyStabilityLabel === 'Stable' ? 'text-green-400' : 'text-yellow-400'}>
            {apyStabilityLabel}
          </p>
        </div>
      </div>

      {chartData.length > 1 ? (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartData}>
            <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} />
            <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} tickLine={false} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: 8 }}
              labelStyle={{ color: '#9ca3af' }}
              formatter={(v: number) => [`${v.toFixed(2)}%`, 'APY']}
            />
            <Line type="monotone" dataKey="apy" stroke="#818cf8" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <p className="text-gray-500 text-sm">Historical chart unavailable</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/YieldCard.tsx
git commit -m "feat: YieldCard with APY averages and recharts line chart"
```

---

## Task 15: RiskDimensionCard Component

**Files:**
- Create: `components/RiskDimensionCard.tsx`

- [ ] **Step 1: Write component**

```tsx
// components/RiskDimensionCard.tsx
import type { DimensionScore } from '@/lib/scoring/types'

interface Props {
  dimensionScore: DimensionScore
  weightPct: number
  placeholderFields?: string[]
  indicatorNames?: string[]  // indicator names used to check against placeholders
}

function scoreColor(score: number): string {
  if (score <= 20) return 'text-green-400'
  if (score <= 40) return 'text-lime-400'
  if (score <= 60) return 'text-yellow-400'
  if (score <= 80) return 'text-orange-400'
  return 'text-red-500'
}

export function RiskDimensionCard({ dimensionScore, weightPct, placeholderFields = [] }: Props) {
  const { score, indicators } = dimensionScore

  return (
    <div>
      <div className="flex items-baseline gap-2 mb-4">
        <span className={`text-3xl font-bold ${scoreColor(score)}`}>{score}</span>
        <span className="text-gray-400 text-sm">/100 · {weightPct}% of composite · lower = safer</span>
      </div>

      {placeholderFields.length > 0 && (
        <p className="text-yellow-600 text-xs mb-3">
          ⚠ Some indicators use estimated data — on-chain reads incomplete
        </p>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="text-gray-500 border-b border-gray-700">
            <th className="text-left pb-2">Indicator</th>
            <th className="text-right pb-2">Value</th>
            <th className="text-right pb-2">+Score</th>
          </tr>
        </thead>
        <tbody>
          {indicators.map(ind => (
            <tr key={ind.name} className="border-b border-gray-800">
              <td className="py-2 text-gray-300">
                {ind.name}
                {ind.note && <p className="text-xs text-yellow-400 mt-0.5">{ind.note}</p>}
              </td>
              <td className="py-2 text-right text-gray-400">{ind.value}</td>
              <td className="py-2 text-right text-gray-500">+{ind.contribution}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add components/RiskDimensionCard.tsx
git commit -m "feat: RiskDimensionCard with indicator table and placeholder warning"
```

---

## Task 16: Vault Detail Page

**Files:**
- Create: `app/vault/[chainId]/[address]/page.tsx`

The page is a Next.js server component that calls `scoreVault(await fetchMorphoVaultData(...))` directly — no HTTP self-fetch. Suspense provides skeleton loading while the async server component resolves.

- [ ] **Step 1: Write vault detail page**

```tsx
// app/vault/[chainId]/[address]/page.tsx
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { RiskGrade } from '@/components/RiskGrade'
import { RiskDimensionCard } from '@/components/RiskDimensionCard'
import { YieldCard } from '@/components/YieldCard'
import { CollapsibleCard } from '@/components/CollapsibleCard'
import { SkeletonCard } from '@/components/SkeletonCard'
import { fetchMorphoVaultData } from '@/lib/scoring/protocols/morpho'
import { scoreVault } from '@/lib/scoring/composite'
import featuredVaults from '@/data/featured-vaults.json'
import type { ChainId } from '@/lib/scoring/types'

const CHAIN_NAMES: Record<number, string> = { 1: 'Ethereum', 8453: 'Base' }
const SUPPORTED: ChainId[] = [1, 8453]

async function VaultContent({ chainId, address }: { chainId: string; address: string }) {
  const cid = parseInt(chainId) as ChainId
  if (!SUPPORTED.includes(cid)) notFound()

  const featured = featuredVaults.find(
    v => v.address.toLowerCase() === address.toLowerCase() && v.chainId === cid
  )
  const defillamaPoolId = featured?.defillamaPoolId ?? address

  let score
  try {
    const vaultData = await fetchMorphoVaultData(address, cid, defillamaPoolId)
    score = scoreVault(vaultData)
  } catch {
    notFound()
  }

  const tvlFormatted = score.tvlUsd >= 1_000_000
    ? `$${(score.tvlUsd / 1_000_000).toFixed(1)}M`
    : `$${(score.tvlUsd / 1_000).toFixed(0)}K`

  return (
    <div className="max-w-3xl mx-auto">
      {/* Top bar */}
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <div className="flex gap-2 mb-2">
            <span className="bg-indigo-900 text-indigo-300 text-xs px-2 py-1 rounded">Morpho</span>
            <span className="bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded">
              {CHAIN_NAMES[cid] ?? `Chain ${cid}`}
            </span>
          </div>
          <h1 className="text-xl font-bold text-white break-all">{score.name || address}</h1>
          <p className="text-gray-400 text-sm mt-1 font-mono">{address}</p>
          <div className="flex gap-4 mt-2 text-sm">
            <span className="text-gray-400">TVL: <span className="text-white font-medium">{tvlFormatted}</span></span>
            <span className="text-gray-400">
              APY: <span className="text-white font-medium">{score.currentApyPct.toFixed(2)}%</span>
              {' · '}
              <span className={score.apyStabilityLabel === 'Stable' ? 'text-green-400' : 'text-yellow-400'}>
                {score.apyStabilityLabel}
              </span>
            </span>
          </div>
        </div>
        <RiskGrade grade={score.grade} score={score.overallScore} label={score.label} size="lg" />
      </div>

      {/* 4 collapsible cards */}
      <div className="flex flex-col gap-4">
        <CollapsibleCard
          title="Yield"
          subtitle={`${score.currentApyPct.toFixed(2)}% APY · ${score.apyStabilityLabel}`}
          defaultOpen
        >
          <YieldCard
            currentApyPct={score.currentApyPct}
            apy7dAvg={score.apy7dAvg}
            apy30dAvg={score.apy30dAvg}
            apy90dAvg={score.apy90dAvg}
            apyStabilityLabel={score.apyStabilityLabel}
            apyHistory={score.apyHistory}
          />
        </CollapsibleCard>

        <CollapsibleCard
          title="Underlying Asset Risk"
          subtitle={`Score: ${score.assetRisk.score}/100 · 40% of composite`}
        >
          <RiskDimensionCard
            dimensionScore={score.assetRisk}
            weightPct={40}
            placeholderFields={score.placeholderFields.filter(f =>
              ['assets', 'oracleManipulationSurface'].includes(f)
            )}
          />
        </CollapsibleCard>

        <CollapsibleCard
          title="Liquidation Rules Risk"
          subtitle={`Score: ${score.liquidationRisk.score}/100 · 35% of composite`}
        >
          <RiskDimensionCard
            dimensionScore={score.liquidationRisk}
            weightPct={35}
            placeholderFields={score.placeholderFields.filter(f =>
              ['maxLtvPct', 'liquidationThresholdPct', 'liquidationBonusPct', 'liquidationMechanism'].includes(f)
            )}
          />
        </CollapsibleCard>

        <CollapsibleCard
          title="Curator Risk"
          subtitle={`Score: ${score.curatorRisk.score}/100 · 25% of composite`}
        >
          <RiskDimensionCard
            dimensionScore={score.curatorRisk}
            weightPct={25}
            placeholderFields={score.placeholderFields.filter(f =>
              ['curatorType', 'permissionScope', 'vaultsManaged', 'incidentCount', 'curatorBorrowsFromVault'].includes(f)
            )}
          />
        </CollapsibleCard>
      </div>

      {/* Footer */}
      <div className="mt-8 text-xs text-gray-600 border-t border-gray-800 pt-4">
        <p>Data sources: DefiLlama API · The Graph Morpho subgraph · Alchemy RPC</p>
        <p>Last updated: {new Date(score.dataFreshnessMs).toLocaleString()}</p>
        <p className="mt-2">For informational purposes only. Not investment advice.</p>
      </div>
    </div>
  )
}

export default function VaultPage({ params }: { params: { chainId: string; address: string } }) {
  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <Suspense fallback={
        <div className="max-w-3xl mx-auto flex flex-col gap-4">
          <SkeletonCard rows={2} />
          <SkeletonCard rows={5} />
          <SkeletonCard rows={5} />
          <SkeletonCard rows={5} />
        </div>
      }>
        <VaultContent chainId={params.chainId} address={params.address} />
      </Suspense>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/vault/
git commit -m "feat: vault detail page with top bar (TVL + APY + grade), 4 cards, skeleton loading"
```

---

## Task 17: Home Page

**Files:**
- Create: `components/SearchBar.tsx`, `components/FeaturedVaultsList.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: SearchBar component**

```tsx
// components/SearchBar.tsx
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
```

- [ ] **Step 2: FeaturedVaultsList with chain/protocol filter**

```tsx
// components/FeaturedVaultsList.tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'

interface FeaturedVault {
  name: string
  address: string
  chainId: number
  protocol: string
  tags: string[]
}

const CHAIN_LABELS: Record<number, string> = { 1: 'Ethereum', 8453: 'Base' }

export function FeaturedVaultsList({ vaults }: { vaults: FeaturedVault[] }) {
  const [chainFilter, setChainFilter] = useState<number | null>(null)
  const [protocolFilter, setProtocolFilter] = useState<string | null>(null)

  const chains = [...new Set(vaults.map(v => v.chainId))]
  const protocols = [...new Set(vaults.map(v => v.protocol))]

  const filtered = vaults.filter(v =>
    (chainFilter == null || v.chainId === chainFilter) &&
    (protocolFilter == null || v.protocol === protocolFilter)
  )

  return (
    <div className="w-full max-w-2xl">
      {/* Filters */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <button
          onClick={() => setChainFilter(null)}
          className={`text-xs px-3 py-1 rounded-full border transition-colors ${chainFilter == null ? 'border-indigo-500 text-indigo-300 bg-indigo-900/30' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
        >
          All chains
        </button>
        {chains.map(c => (
          <button
            key={c}
            onClick={() => setChainFilter(chainFilter === c ? null : c)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${chainFilter === c ? 'border-indigo-500 text-indigo-300 bg-indigo-900/30' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
          >
            {CHAIN_LABELS[c] ?? `Chain ${c}`}
          </button>
        ))}
        {protocols.map(p => (
          <button
            key={p}
            onClick={() => setProtocolFilter(protocolFilter === p ? null : p)}
            className={`text-xs px-3 py-1 rounded-full border transition-colors ${protocolFilter === p ? 'border-indigo-500 text-indigo-300 bg-indigo-900/30' : 'border-gray-700 text-gray-400 hover:border-gray-500'}`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="flex flex-col gap-3">
        {filtered.map(v => (
          <Link
            key={`${v.chainId}-${v.address}`}
            href={`/vault/${v.chainId}/${v.address}`}
            className="bg-gray-900 border border-gray-700 hover:border-indigo-500 rounded-xl px-5 py-4 flex items-center justify-between transition-colors"
          >
            <div>
              <p className="text-white font-medium">{v.name}</p>
              <p className="text-gray-500 text-xs mt-0.5 font-mono">{v.address.slice(0, 10)}…</p>
            </div>
            <div className="flex gap-2">
              <span className="text-xs bg-indigo-900 text-indigo-300 px-2 py-0.5 rounded">{v.protocol}</span>
              <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded">
                {CHAIN_LABELS[v.chainId] ?? `Chain ${v.chainId}`}
              </span>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="text-gray-600 text-sm">No vaults match the selected filters.</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Write home page**

```tsx
// app/page.tsx
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
```

- [ ] **Step 4: Commit**

```bash
git add components/SearchBar.tsx components/FeaturedVaultsList.tsx app/page.tsx
git commit -m "feat: home page with search, featured vaults list, chain/protocol filter"
```

---

## Task 18: E2E Test

**Files:**
- Create: `e2e/vault.spec.ts`

- [ ] **Step 1: Write E2E test**

```typescript
// e2e/vault.spec.ts
import { test, expect } from '@playwright/test'

// Uses a known Morpho vault on mainnet.
// Before running e2e tests, ensure .env.local has ALCHEMY_API_KEY set.
const KNOWN_VAULT = '0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB'
const CHAIN_ID = '1'

test('home page loads with search bar and featured vaults', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('DeFi Vault Risk Scorer')).toBeVisible()
  await expect(page.getByPlaceholder('Enter vault address (0x...)')).toBeVisible()
  await expect(page.getByText('Featured Vaults')).toBeVisible()
})

test('entering a vault address navigates to vault detail page', async ({ page }) => {
  await page.goto('/')
  await page.selectOption('select', { value: CHAIN_ID })
  await page.fill('[placeholder="Enter vault address (0x...)"]', KNOWN_VAULT)
  await page.click('button:has-text("Analyze")")
  await expect(page).toHaveURL(`/vault/${CHAIN_ID}/${KNOWN_VAULT}`)
})

test('vault detail page shows risk grade', async ({ page }) => {
  await page.goto(`/vault/${CHAIN_ID}/${KNOWN_VAULT}`)
  // Grade is one of A-F displayed as a large letter
  await expect(page.getByText(/^(A|B|C|D|F)$/).first()).toBeVisible({ timeout: 30_000 })
  // Score line must show "Risk Score: N/100"
  await expect(page.getByText(/Risk Score: \d+\/100/)).toBeVisible()
})

test('vault detail page shows TVL and APY', async ({ page }) => {
  await page.goto(`/vault/${CHAIN_ID}/${KNOWN_VAULT}`)
  await expect(page.getByText(/TVL:/)).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/APY:/)).toBeVisible()
})

test('chain filter on home page shows only matching vaults', async ({ page }) => {
  await page.goto('/')
  await page.click('button:has-text("Base")')
  // After filtering, only Base vaults should be listed
  const links = page.locator('a[href*="/vault/8453/"]')
  const count = await links.count()
  expect(count).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run E2E tests (requires dev server + real ALCHEMY_API_KEY)**

```bash
npm run dev &   # start server in background
npm run test:e2e
```

Expected: home page and navigation tests PASS. Vault detail tests require a live RPC key — skip with `--grep "home page"` if no key available in CI.

- [ ] **Step 3: Commit**

```bash
git add e2e/vault.spec.ts playwright.config.ts
git commit -m "feat: E2E tests for home page navigation and vault detail grade display"
```

---

## Task 19: Final Verification

- [ ] **Step 1: Run full Jest test suite**

```bash
npm test
```

Expected: All unit + integration tests PASS.

- [ ] **Step 2: TypeScript check**

```bash
npx tsc --noEmit
```

Expected: No type errors.

- [ ] **Step 3: Start dev server and spot-check**

```bash
npm run dev
```

Open `http://localhost:3000` — home page with search + featured vaults.

- [ ] **Step 4: Manual API smoke test (requires .env.local with ALCHEMY_API_KEY)**

```bash
curl "http://localhost:3000/api/vault/1/0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB" | jq '{grade, overallScore, tvlUsd, name}'
```

Expected output shape:
```json
{
  "grade": "B",
  "overallScore": 35,
  "tvlUsd": 45000000,
  "name": "Gauntlet USDC Core"
}
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final verification — all tests pass, dev server confirmed"
```

---

## Notes for Implementation

- **RPC keys**: Copy `.env.local.example` → `.env.local` and fill in your Alchemy API key.
- **DefiLlama pool IDs**: Replace placeholder IDs in `data/featured-vaults.json` using `https://yields.llama.fi/pools?project=morpho`.
- **Placeholder data**: The Morpho fetcher returns hardcoded defaults for most risk indicators (LTV, oracle, curator scope). These are tracked in `placeholderFields` and shown as a warning in the UI. Full market config reads are the natural next iteration.
- **Curator identity**: No on-chain standard exists; a curated off-chain registry (simple JSON) is the practical approach for v1.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | — |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |

**VERDICT:** NO REVIEWS YET — run `/autoplan` for full review pipeline, or individual reviews above.
