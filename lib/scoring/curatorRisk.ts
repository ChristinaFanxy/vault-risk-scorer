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
