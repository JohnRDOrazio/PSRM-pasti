import { expect, test } from '@playwright/test'
import { E2E } from './global-setup'

test('admin changes and restores the dinner cutoff', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(E2E.adminEmail)
  await page.getByLabel('Password').fill(E2E.adminPassword)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page).toHaveURL(/\/admin$/)

  await page.goto('/admin/impostazioni')
  await page.getByLabel('Chiusura modifiche cena').fill('15:00')
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByText('Impostazioni salvate.')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Chiusura modifiche cena')).toHaveValue('15:00')

  await page.getByLabel('Chiusura modifiche cena').fill('10:00')
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByText('Impostazioni salvate.')).toBeVisible()
})
