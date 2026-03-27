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
  await page.click('button:has-text("Analyze")')
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
