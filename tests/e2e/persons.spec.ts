import { expect, test } from '@playwright/test'
import { E2E } from './global-setup'

test('admin creates a person, gets a one-time link, and the member can open it', async ({ page, browser }) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(E2E.adminEmail)
  await page.getByLabel('Password', { exact: true }).fill(E2E.adminPassword)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page).toHaveURL(/\/admin$/)
  await page.goto('/admin/persone')

  await page.getByRole('button', { name: 'Nuova persona' }).click()
  await page.getByLabel('Nome e cognome').fill('Giulia Verdi')
  await page.getByLabel('Gruppo').selectOption({ label: 'Ospiti' })
  await page.getByRole('button', { name: 'Salva' }).click()

  const reveal = page.getByTestId('reveal')
  await expect(reveal).toBeVisible()
  const link = (await page.getByTestId('reveal-link').textContent())!.trim()
  expect(link).toMatch(/\/p\/[A-Za-z0-9_-]{43}$/)
  await expect(reveal.getByRole('img', { name: 'QR' })).toBeVisible()
  await expect(page.getByRole('cell', { name: /Giulia Verdi/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /Giulia Verdi/ }).getByRole('cell', { name: 'Attivo' })).toBeVisible()
  await page.getByRole('button', { name: 'Chiudi' }).click()
  await expect(reveal).toBeHidden()

  const ctx = await browser.newContext()
  const member = await ctx.newPage()
  await member.goto(link)
  await expect(member).toHaveURL(/\/$/)
  await expect(member.getByRole('heading', { name: 'Giulia Verdi' })).toBeVisible()
  await ctx.close()

  // regenerate → old link dies
  const row = page.getByRole('row', { name: /Giulia Verdi/ })
  await row.getByRole('button', { name: 'Rigenera link' }).click()
  await expect(page.getByTestId('reveal')).toBeVisible()
  const ctx2 = await browser.newContext()
  const stale = await ctx2.newPage()
  await stale.goto(link)
  await expect(stale).toHaveURL(/\/link-non-valido$/)
  await ctx2.close()

  // delete (no changes yet)
  await row.getByRole('button', { name: 'Elimina' }).click()
  await row.getByRole('button', { name: 'Confermi?' }).click()
  await expect(page.getByRole('cell', { name: /Giulia Verdi/ })).toHaveCount(0)
})
