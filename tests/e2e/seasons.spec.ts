import { expect, test } from '@playwright/test'
import { E2E } from './global-setup'

test('admin adds a one-off season and it changes the kitchen default', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(E2E.adminEmail)
  await page.getByLabel('Password', { exact: true }).fill(E2E.adminPassword)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page).toHaveURL(/\/admin$/)

  await page.goto('/admin/stagioni')
  await page.getByRole('button', { name: 'Aggiungi stagione' }).click()
  await page.getByLabel('Nome').fill('Ritiro E2E')
  await page.getByLabel('Tipo').selectOption('one_off')
  await page.getByLabel('Inizio', { exact: true }).fill('2026-11-10')
  await page.getByLabel('Fine', { exact: true }).fill('2026-11-14')
  await page.getByLabel('Pranzo predefinito').uncheck()
  await page.getByLabel('Cena predefinita').uncheck()
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByRole('cell', { name: 'Ritiro E2E' })).toBeVisible()

  await page.goto('/admin?d=2026-11-12')
  await expect(page.getByTestId('meal-lunch').getByText('Presenti a pranzo (0)')).toBeVisible()

  await page.goto('/admin/stagioni')
  const row = page.getByRole('row', { name: /Ritiro E2E/ })
  await row.getByRole('button', { name: 'Elimina' }).click()
  await row.getByRole('button', { name: 'Confermi?' }).click()
  await expect(page.getByRole('cell', { name: 'Ritiro E2E' })).toHaveCount(0)
})
