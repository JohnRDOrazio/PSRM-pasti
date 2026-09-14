import { expect, test } from '@playwright/test'
import { E2E } from './global-setup'

test('admin pages redirect to login; login works; logout works', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin\/login$/)
  await page.getByLabel('Email').fill(E2E.adminEmail)
  await page.getByLabel('Password', { exact: true }).fill(E2E.adminPassword)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole('heading', { name: 'Cucina' })).toBeVisible()
  await page.getByRole('button', { name: 'Esci' }).click()
  await expect(page).toHaveURL(/\/admin\/login$/)
})

test('wrong password shows an error', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(E2E.adminEmail)
  await page.getByLabel('Password', { exact: true }).fill('nope')
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page.getByText('Email o password non validi.')).toBeVisible()
})

test('non-admin user is bounced back to login with a message, then admin can sign in', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(E2E.nonAdminEmail)
  await page.getByLabel('Password', { exact: true }).fill(E2E.nonAdminPassword)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page).toHaveURL(/\/admin\/login\?e=noadmin$/)
  await expect(page.getByText('Questo account non è abilitato come amministratore.')).toBeVisible()

  await page.getByLabel('Email').fill(E2E.adminEmail)
  await page.getByLabel('Password', { exact: true }).fill(E2E.adminPassword)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page).toHaveURL(/\/admin$/)
})
