# DeFi Vault Risk Scorer — Design Spec
**Date:** 2026-03-27
**Status:** Approved

---

## Problem

DeFi investors depositing into curator vaults (Morpho MetaMorpho, Euler, Aave, etc.) have no standardized way to assess risk before committing capital. Risk is spread across three dimensions — underlying assets, liquidation rules, and curator behavior — that currently require reading multiple sources manually. There is no unified risk score.

## Goal

A standalone web application that takes a vault address, fetches on-chain and API data, and returns a structured risk assessment with a top-level grade and drill-down detail per dimension. Also displays yield data (current APY + historical trend) so users can make risk/return decisions in one place.

## Non-Goals

- Not a portfolio tracker
- Not investment advice or a recommendation engine
- No user accounts or saved history (MVP)
- No mobile-native app

---

## Users

**Primary:** DeFi investors evaluating a vault before depositing.
They want to know: "Is this vault safe? What am I actually exposed to?"

---

## Architecture

### Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Frontend | Next.js 14 + TypeScript | Standard DeFi frontend stack, SSR for fast initial load |
| Styling | Tailwind CSS | Fast iteration, consistent dark-mode UI |
| Chain reads | viem | Type-safe, multi-chain, lightweight |
| Backend logic | Next.js API routes | Keeps RPC keys server-side, scoring engine co-located |
| Scoring engine | TypeScript module in `/lib/scoring` | Pure functions, easy to test and adjust weights |

### Data Sources

| Data Type | Primary Source | Fallback |
|-----------|---------------|---------|
| Vault metadata, TVL | DefiLlama API | Protocol-specific APIs |
| Historical APY | DefiLlama `/yields` | Morpho API, The Graph |
| On-chain state (LTV, oracle, params) | viem → RPC (Alchemy/Infura) | — |
| Oracle source | Chainlink feeds (direct read) | On-chain oracle address lookup |
| Curator identity / permissions | On-chain role/timelock contracts | — |
| Asset liquidity depth | DefiLlama, on-chain DEX pools | — |
| Curator borrow position | viem direct read of vault's borrow state for curator address | On-chain event log scan |

> Note: On-chain reads and scoring logic are designed with protocol abstraction in mind (`/lib/scoring/protocols/`), but v1 targets **Morpho MetaMorpho only**. Euler and Aave support is v2.

### Supported Chains

MVP: **Ethereum mainnet + Base** (most Morpho TVL, validates framework first).
v2: Arbitrum, Optimism and other EVM chains.

> Note: Architecture is designed with multi-chain support in mind (chain ID routing, per-chain RPC config), but initial implementation targets Ethereum mainnet and Base only.

---

## Scoring Framework

### Three Risk Dimensions

#### Dimension 1: Underlying Asset Risk (40%)

| Indicator | How Measured | Score Impact |
|-----------|-------------|-------------|
| Asset type | Stablecoin / blue-chip / long-tail classification | Long-tail = higher risk |
| Oracle source | Chainlink / Uniswap TWAP / custom | Custom/TWAP = higher risk |
| Liquidity depth | DEX/CEX depth relative to vault TVL | Low depth = higher risk |
| 30-day volatility | Price history stddev | Higher vol = higher risk |
| Concentration | Single asset % of vault | >50% single asset = higher risk |

#### Dimension 2: Liquidation Rules Risk (35%)

| Indicator | How Measured | Score Impact |
|-----------|-------------|-------------|
| LTV buffer | Max LTV vs liquidation threshold gap | Thin buffer = higher risk |
| Liquidation incentive | Liquidation bonus % | Too low = liquidators won't act |
| Liquidation mechanism | Dutch auction / fixed discount | Fixed discount less resilient |
| Historical bad debt | The Graph Morpho subgraph (indexed events); fallback to "N/A" if subgraph unavailable | Any bad debt = significant penalty |
| Oracle manipulation surface | Flash loan attack surface analysis | Single-block oracle = higher risk |

#### Dimension 3: Curator Risk (25%)

| Indicator | How Measured | Score Impact |
|-----------|-------------|-------------|
| Curator identity | Anon / known team / institution | Anon = higher risk |
| Permission scope | Which params curator can change | Broader permissions = higher risk |
| Timelock protection | Timelock duration on sensitive params | No timelock = higher risk |
| Track record | Vaults managed, incidents | Incidents = significant penalty |
| Conflict of interest | Curator also borrowing from vault | Yes = higher risk |

### Scoring Output

Each dimension scores 0–100 (lower = safer). Weighted composite score → letter grade:

| Score | Grade |
|-------|-------|
| 0–20 | A (Low Risk) |
| 21–40 | B |
| 41–60 | C |
| 61–80 | D |
| 81–100 | F (High Risk) |

> **Display convention:** Lower score = safer. UI always shows explicit label to prevent misinterpretation, e.g. "Risk Score: 18/100 — Low Risk". Never show a bare number without context.

---

## Yield Data

- **Current APY**: fetched from DefiLlama `/yields` or protocol API
- **APY stability label**: auto-computed from 30-day stddev — "Stable" / "Volatile"
- **Historical chart**: 7-day, 30-day, 90-day APY line chart

---

## Page Structure

### 1. Home Page (`/`)

- Search bar: input vault address or ENS
- Hot vaults list: curated list grouped by protocol and chain (sourced from `/data/featured-vaults.json`, manually maintained; automated TVL-based ranking is v2)
- Quick-filter by chain and protocol

### 2. Vault Detail Page (`/vault/[chainId]/[address]`)

**Loading state:** Show skeleton placeholders for each card while data loads. Dimensions render progressively as each data source resolves — top bar loads first (fast metadata), risk cards load as on-chain reads complete.

**Top bar:**
- Vault name + protocol badge + chain badge
- TVL
- Current APY + stability label
- Composite risk grade (large, color-coded)

**Four collapsible cards (in order):**
1. Yield — current APY, 7/30/90-day averages, APY trend chart
2. Underlying Asset Risk — dimension score + indicator breakdown
3. Liquidation Rules Risk — dimension score + indicator breakdown
4. Curator Risk — dimension score + indicator breakdown

**Footer:**
- Data sources listed
- Last updated timestamp
- Disclaimer

### 3. Compare Page (`/compare`) — v2

Up to 3 vaults side-by-side with all dimensions aligned.

---

## API Routes

| Route | Purpose |
|-------|---------|
| `GET /api/vault/[chainId]/[address]` | Fetch + score a vault, returns full JSON |
| `GET /api/vaults/featured` | Returns curated hot vaults list |

---

## Error Handling

- Unknown vault address → clear error state with "Vault not found or not supported"
- RPC timeout → retry once, then show "Data temporarily unavailable" per indicator
- Partial data → show available indicators, mark unavailable ones as "N/A" with tooltip
- Unsupported protocol → graceful fallback showing only available dimensions

---

## Testing

- Unit tests for scoring engine (`/lib/scoring`) — pure functions, test each indicator calculation
- Integration tests for API routes with mocked RPC/API responses
- E2E test: input known vault address, verify grade is computed and displayed

---

## MVP Scope (v1)

**In:**
- Search by vault address
- Morpho MetaMorpho vaults (primary protocol)
- Ethereum mainnet + Base (most TVL, validate framework first)
- All three risk dimensions + yield data
- Composite grade + collapsible detail cards

**Out (v2+):**
- Euler, Aave vault support
- Full EVM chain coverage
- Compare page
- Historical risk score tracking
- Email/wallet alerts

---

## Open Questions

1. Weight calibration — the 40/35/25 weights are initial estimates. Should be validated against known "risky" vaults to check if scoring matches expert judgment.
2. Curator identity data source — no on-chain standard for this. May need a curated off-chain registry initially.
3. **Caching strategy (resolved):** Next.js route-level caching with 5-minute TTL for DefiLlama and The Graph calls. On-chain reads (viem) are not cached at the route level — rely on RPC provider's built-in node caching. Static featured vaults list served from `/data/featured-vaults.json` (manually curated JSON file; automated TVL ranking is v2).
