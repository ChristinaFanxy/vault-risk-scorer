# Curator Leaderboard Design Spec

## Overview
面向机构/大户的 Morpho Curator 综合评估排行榜。覆盖 Morpho 全部链上的所有 curator（~22 个），从 5 个维度量化打分，支持按列排序。

## Target Audience
机构投资者 / DeFi 大户 — 关心深度数据、风控细节、历史表现。

## Data Scope
覆盖 Morpho 全部支持链（10 条）：
- Ethereum (1), Base (8453), Arbitrum (42161), Optimism (10), Polygon (137)
- Unichain (130), HyperEVM (999), Katana (747474), Monad (143), Chain 988

所有数据通过 Morpho GraphQL API (`blue-api.morpho.org/graphql`) 获取，不需要 RPC 调用。

## 5-Dimension Scoring System

每个维度 0-100 分（越高越好），加权合成综合分。

### 1. Scale (规模) — 权重 20%
| 指标 | 数据源 | 评分逻辑 |
|------|--------|----------|
| 总管理 TVL (USD) | Morpho API `vaults` + `vaultV2s` → `totalAssetsUsd` | $500M+ → 100, $100M+ → 80, $10M+ → 50, <$1M → 10 |
| 管理 vault 数量 | Morpho API curator/owner vault count | 50+ → 100, 20+ → 70, 5+ → 40, <5 → 20 |
| 覆盖链数 | 去重 chainId count | 5+ → 100, 3+ → 70, 2 → 50, 1 → 30 |

### 2. Yield (收益) — 权重 20%
| 指标 | 数据源 | 评分逻辑 |
|------|--------|----------|
| TVL 加权平均 APY | 各 vault 的 `netApy * totalAssetsUsd / totalTVL` | 10%+ → 100, 5%+ → 70, 2%+ → 50, <1% → 20 |
| Performance fee 均值 | V1 `fee`, V2 `performanceFee` | 0% → 100, 5% → 80, 10% → 60, 20%+ → 20 |

### 3. Safety (安全记录) — 权重 30%
| 指标 | 数据源 | 评分逻辑 |
|------|--------|----------|
| 历史坏账总额 | The Graph `badDebtRealizations` | $0 → 100, <$1K → 80, <$50K → 50, >$50K → 20 |
| 坏账/TVL 比率 | badDebt / totalTVL | 0 → 100, <0.01% → 80, <0.1% → 50, >0.1% → 20 |
| 受影响市场数 | The Graph `affectedMarketCount` | 0 → 100, 1-2 → 70, 3-5 → 40, >5 → 20 |
| Oracle 警告 | Morpho API `warnings` | 无 → 100, 有 → 30 |

### 4. Governance (治理) — 权重 20%
| 指标 | 数据源 | 评分逻辑 |
|------|--------|----------|
| 身份验证 | Morpho `curatorVerified` | verified → 100, named → 60, anonymous → 10 |
| Timelock 时长 | `timelockSeconds` / V2 `addAdapterTimelock` | 72h+ → 100, 24h+ → 70, 1h+ → 40, 0 → 10 |
| Guardian 保护 | guardian ≠ zero address | 有 → 100, 无 → 30 |
| 利益冲突 | `curatorBorrowsFromVault` | 无 → 100, 有 → 20 |
| Public Allocator | `publicAllocatorConfig` | 关 → 100, 开 → 50 |

### 5. Asset Quality (资产质量) — 权重 10%
| 指标 | 数据源 | 评分逻辑 |
|------|--------|----------|
| 资产类别分布 | collateral symbols → classify | 全 stablecoin → 100, 主要 blue-chip → 70, 有 long-tail → 40 |
| Oracle 类型 | Morpho API oracle data | 全 Chainlink → 100, 有 TWAP → 70, 有 custom → 30 |
| 加权利用率 | `state.utilization` weighted avg | <70% → 100, <85% → 70, <95% → 40, >95% → 10 |

### 综合分计算
```
compositeScore = scale * 0.20 + yield * 0.20 + safety * 0.30 + governance * 0.20 + assetQuality * 0.10
```

## Architecture

### New Files
```
app/leaderboard/page.tsx              — 页面路由 (SSR)
app/leaderboard/LeaderboardView.tsx   — 客户端排行榜表格组件
app/api/leaderboard/route.ts          — API: 聚合所有 curator 数据
lib/scoring/curatorLeaderboard.ts     — 5 维度评分逻辑
```

### API: `GET /api/leaderboard`

**数据获取流程：**
1. 查询 Morpho API 获取所有 curator（V1 + V2，全链）
2. 按 curator 地址聚合 vault 数据（TVL、APY、fee）
3. 查询 The Graph 获取每个 curator 的坏账历史
4. 计算 5 维度得分 + 综合分
5. 按综合分排序返回

**缓存：** Next.js route cache `revalidate: 600`（10 分钟）

**Response 结构：**
```typescript
interface CuratorRanking {
  rank: number
  curatorAddress: string
  curatorName: string | null
  verified: boolean
  totalTvlUsd: number
  vaultCount: number
  chainCount: number
  weightedApyPct: number
  avgFeePct: number | null
  totalBadDebtUsd: number
  compositeScore: number      // 0-100
  scaleScore: number          // 0-100
  yieldScore: number          // 0-100
  safetyScore: number         // 0-100
  governanceScore: number     // 0-100
  assetQualityScore: number   // 0-100
}
```

### UI: `/leaderboard`

**表格列：**
| # | Curator | Score | Scale | Yield | Safety | Gov | Asset | TVL | Avg APY |

**交互：**
- 点击列头排序（升序/降序切换）
- 默认按综合分降序
- Curator 名称可点击，跳转到 curator 详情页 `/curator/{address}`
- 分数用颜色编码（绿 80+ / 黄 50-79 / 红 <50）

**首页入口：**
在首页搜索栏下方加一个 "View Curator Leaderboard →" 链接。

## Data Fetching Strategy

### 获取全部 curator 列表
```graphql
query AllCurators($chainIds: [Int!]!) {
  # V1 vaults grouped by curator
  vaults(where: { chainId_in: $chainIds }, first: 1000) {
    items {
      address
      chain { id }
      state {
        curator
        owner
        totalAssetsUsd
        netApy
        fee
        timelock
        guardian
        curators { name verified }
        allocation { market { realizedBadDebt { usd } warnings { type } } }
      }
    }
  }
  # V2 vaults
  vaultV2s(where: { chainId_in: $chainIds }, first: 1000) {
    items {
      address
      chain { id }
      totalAssetsUsd
      netApy
      performanceFee
      owner { address }
      curators { items { name verified addresses { address } } }
      timelocks { selector duration }
    }
  }
}
```

按 curator address 分组聚合，然后逐个计算得分。

## Non-Goals (不做)
- 历史趋势图（第一版不做）
- Curator 对比功能（第一版不做）
- 自定义权重（第一版固定权重）
