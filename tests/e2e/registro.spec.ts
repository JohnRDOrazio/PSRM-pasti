import { expect, test } from '@playwright/test'
import { E2E } from './global-setup'

test('admin edits appear in the log, filterable by person', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(E2E.adminEmail)
  await page.getByLabel('Password').fill(E2E.adminPassword)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page).toHaveURL(/\/admin$/)

  await page.goto('/admin?d=2026-12-01&tutti=1')
  await page.getByTestId('meal-dinner').getByRole('listitem').filter({ hasText: E2E.memberName }).getByRole('button', { name: 'Cena' }).click()
  await expect(page.getByTestId('meal-dinner').getByRole('listitem').filter({ hasText: E2E.memberName }).getByRole('button', { name: 'Cena' })).toHaveAttribute('aria-pressed', 'false')

  await page.goto('/admin/registro')
  await page.getByLabel('Persona').selectOption({ label: E2E.memberName })
  await page.getByLabel('Dal').fill('2026-01-01')
  await page.getByRole('button', { name: 'Filtra' }).click()
  const row = page.getByRole('row').filter({ hasText: 'Modifica cucina' }).filter({ hasText: 'mar 1 dic' }).first()
  await expect(row).toBeVisible()
  await expect(row).toContainText('cucina')
  await expect(row).toContainText('Assente')
})
