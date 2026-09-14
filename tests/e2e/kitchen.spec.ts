import { expect, test } from '@playwright/test'
import { E2E } from './global-setup'

test.beforeEach(async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(E2E.adminEmail)
  await page.getByLabel('Password', { exact: true }).fill(E2E.adminPassword)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page).toHaveURL(/\/admin$/)
})

test('guest stepper changes the total and admin toggle marks a member', async ({ page }) => {
  await page.goto('/admin?d=2026-10-20&tutti=1')
  const lunch = page.getByTestId('meal-lunch')
  await expect(lunch.getByText('Comunità 1')).toBeVisible()
  await lunch.getByRole('button', { name: '+ Ospiti' }).click()
  await expect(lunch.getByText('Ospiti 1')).toBeVisible()
  await expect(lunch.getByTestId('total-lunch')).toContainText('2')
  await lunch.getByRole('button', { name: '− Ospiti' }).click()
  await expect(lunch.getByText('Ospiti 0')).toBeVisible()

  const row = lunch.getByRole('listitem').filter({ hasText: E2E.memberName })
  await row.getByRole('button', { name: 'Pranzo' }).click()
  await expect(row.getByRole('button', { name: 'Pranzo' })).toHaveAttribute('aria-pressed', 'false')
  await page.goto('/admin?d=2026-10-20')
  await expect(page.getByTestId('meal-lunch').getByText('Assenti a pranzo (1)')).toBeVisible()
  // restore
  await page.getByTestId('meal-lunch').getByRole('listitem').filter({ hasText: E2E.memberName }).getByRole('button', { name: 'Pranzo' }).click()
  await expect(page.getByTestId('meal-lunch').getByText('Assenti a pranzo (0)')).toBeVisible()
})
