import { expect, test } from '@playwright/test'
import { E2E } from './global-setup'

const NEW_PASSWORD = 'e2e-new-password-456'

async function login(page: import('@playwright/test').Page, password: string) {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(E2E.adminEmail)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

async function changePassword(page: import('@playwright/test').Page, current: string, next: string) {
  await page.goto('/admin/password')
  await page.getByLabel('Password attuale').fill(current)
  await page.getByLabel('Nuova password', { exact: true }).fill(next)
  await page.getByLabel('Conferma nuova password').fill(next)
  await page.getByRole('button', { name: 'Aggiorna password' }).click()
}

test('admin changes their password and can log in with the new one', async ({ page }) => {
  await login(page, E2E.adminPassword)
  try {
    await changePassword(page, E2E.adminPassword, NEW_PASSWORD)
    await expect(page.getByText('Password aggiornata.')).toBeVisible()

    await page.getByRole('button', { name: 'Esci' }).click()
    await expect(page).toHaveURL(/\/admin\/login$/)
    await login(page, NEW_PASSWORD)
  } finally {
    // Put the shared e2e admin back to the declared password (global setup re-syncs it on the next run anyway).
    await changePassword(page, NEW_PASSWORD, E2E.adminPassword)
    await expect(page.getByText('Password aggiornata.')).toBeVisible()
  }
})

test('wrong current password and mismatched confirmation are rejected', async ({ page }) => {
  await login(page, E2E.adminPassword)
  await page.goto('/admin/password')
  await page.getByLabel('Password attuale').fill('definitely-wrong')
  await page.getByLabel('Nuova password', { exact: true }).fill(NEW_PASSWORD)
  await page.getByLabel('Conferma nuova password').fill(NEW_PASSWORD)
  await page.getByRole('button', { name: 'Aggiorna password' }).click()
  await expect(page.getByText('Password attuale non corretta.')).toBeVisible()

  await page.getByLabel('Password attuale').fill(E2E.adminPassword)
  await page.getByLabel('Conferma nuova password').fill('something-else-789')
  await page.getByRole('button', { name: 'Aggiorna password' }).click()
  await expect(page.getByText('Le due password non coincidono.')).toBeVisible()
})
