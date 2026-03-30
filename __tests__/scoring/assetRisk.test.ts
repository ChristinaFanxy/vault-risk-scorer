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
  weightedUtilization: 0, totalMarketLiquidityUsd: 100_000_000,
  maxLtvPct: 80, liquidationThresholdPct: 85, liquidationBonusPct: 5,
  liquidationMechanism: 'dutch-auction', historicalBadDebtUsd: 0, unrealizedBadDebtUsd: 0,
  oracleManipulationSurface: 'low',
  hardcodedOracleCount: 0, hardcodedOracleSymbols: [],
  curatorName: null, curatorAddress: '0xcurator', curatorType: 'institution', permissionScope: 'narrow',
  timelockHours: 72, vaultsManaged: 5, incidentCount: 0, curatorBorrowsFromVault: false, hasPublicAllocator: false,
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
