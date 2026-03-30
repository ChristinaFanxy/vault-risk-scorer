// lib/scoring/curatorRisk.ts
import type { VaultData, DimensionScore } from './types'

export function scoreCuratorRisk(vault: VaultData): DimensionScore {
  const indicators: DimensionScore['indicators'] = []
  let score = 0

  // 1. Who manages this vault
  const idScore = vault.curatorType === 'institution' ? 0 : vault.curatorType === 'known-team' ? 10 : 30
  score += idScore
  const idTypeLabel = vault.curatorType === 'institution' ? 'Established institution'
    : vault.curatorType === 'known-team' ? 'Known public team'
    : 'Anonymous'
  const idLabel = vault.curatorName ? `${vault.curatorName} — ${idTypeLabel}` : idTypeLabel
  indicators.push({
    name: 'Who manages this vault',
    desc: 'Is the team behind this vault publicly known? Anonymous operators have no accountability if things go wrong.',
    value: idLabel,
    contribution: idScore,
    status: vault.curatorType === 'institution' ? 'good'
      : vault.curatorType === 'known-team' ? 'ok' : 'bad',
  })

  // 2. What can they change
  const permScore = vault.permissionScope === 'narrow' ? 0 : vault.permissionScope === 'medium' ? 10 : 20
  score += permScore
  const permLabel = vault.permissionScope === 'narrow' ? 'Limited (can only adjust allocations)'
    : vault.permissionScope === 'medium' ? 'Standard (can update most parameters)'
    : 'Full control (can change anything)'
  indicators.push({
    name: 'What they can change',
    desc: 'How much control the curator has over vault settings. Broad permissions = more trust required.',
    value: permLabel,
    contribution: permScore,
    status: vault.permissionScope === 'narrow' ? 'good'
      : vault.permissionScope === 'medium' ? 'ok' : 'caution',
  })

  // 3. Change delay (timelock)
  const tlScore = vault.timelockHours >= 72 ? 0 : vault.timelockHours >= 24 ? 5 : vault.timelockHours >= 1 ? 15 : 25
  score += tlScore
  const tlDays = vault.timelockHours / 24
  const tlLabel = vault.timelockHours === 0 ? 'None — changes are instant'
    : vault.timelockHours < 24 ? `${vault.timelockHours}h (less than 1 day)`
    : tlDays >= 1 && Number.isInteger(tlDays) ? `${tlDays} day${tlDays > 1 ? 's' : ''}`
    : `${vault.timelockHours}h`
  indicators.push({
    name: 'Change delay (timelock)',
    desc: 'How long you have to withdraw before a parameter change takes effect. Longer = more time to react to bad decisions.',
    value: tlLabel,
    contribution: tlScore,
    status: vault.timelockHours >= 72 ? 'good'
      : vault.timelockHours >= 24 ? 'ok'
      : vault.timelockHours >= 1 ? 'caution' : 'bad',
    note: vault.timelockHours === 0 ? 'No delay — parameter changes take effect immediately, no time to exit' : undefined,
  })

  // 4. Track record — scored by bad debt amount only (incident count is derived from same data)
  const bd = vault.historicalBadDebtUsd
  const badDebtScore = bd === -1 ? 0 : bd <= 10 ? 0 : bd <= 1_000 ? 5 : bd <= 50_000 ? 20 : 50
  score += badDebtScore

  const fmtBd = bd === -1 ? 'no data'
    : bd <= 10 ? '$0 bad debt'
    : bd <= 1_000 ? `$${bd.toFixed(0)} bad debt`
    : `$${(bd / 1_000).toFixed(1)}K bad debt`
  const trackValue = `${vault.vaultsManaged} vault(s) · ${vault.incidentCount} incident(s) · ${fmtBd}`

  const trackStatus: 'good' | 'ok' | 'caution' | 'bad' =
    bd > 50_000 ? 'bad' : bd > 1_000 ? 'caution' : bd > 10 ? 'ok' : 'good'

  const trackNote = bd > 50_000 ? 'Significant bad debt — depositors have lost money in past events'
    : bd > 1_000 ? 'Moderate bad debt — liquidation system struggled in at least one event'
    : undefined

  indicators.push({
    name: 'Track record',
    desc: 'Past management history and bad debt across all markets this curator has ever managed. On-chain data (immutable). Shared markets may attribute the same bad debt to multiple curators.',
    value: trackValue,
    contribution: badDebtScore,
    status: trackStatus,
    note: trackNote,
    link: (vault.incidentCount > 0 || bd > 10) ? `/curator/${vault.curatorAddress}` : undefined,
  })

  // 5. Public Allocator
  const paScore = vault.hasPublicAllocator ? 5 : 0
  score += paScore
  indicators.push({
    name: 'Public Allocator',
    desc: 'Whether anyone can trigger fund reallocation across markets. Increases the surface area for unintended capital movement.',
    value: vault.hasPublicAllocator ? 'Enabled — anyone can trigger reallocation' : 'Disabled',
    contribution: paScore,
    status: vault.hasPublicAllocator ? 'caution' : 'good',
  })

  // 6. Conflicts of interest
  const coiScore = vault.curatorBorrowsFromVault ? 15 : 0
  score += coiScore
  indicators.push({
    name: 'Conflicts of interest',
    desc: "Is the curator also a borrower in this vault? If yes, they could make decisions that benefit their loans at depositors' expense.",
    value: vault.curatorBorrowsFromVault ? 'Yes — curator is actively borrowing from this vault' : 'None detected',
    contribution: coiScore,
    status: vault.curatorBorrowsFromVault ? 'bad' : 'good',
  })

  return { score: Math.min(100, score), indicators }
}
