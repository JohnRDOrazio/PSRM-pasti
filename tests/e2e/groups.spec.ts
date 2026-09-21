import { expect, test } from '@playwright/test'
import { E2E } from './global-setup'

test.beforeEach(async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(E2E.adminEmail)
  await page.getByLabel('Password', { exact: true }).fill(E2E.adminPassword)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page).toHaveURL(/\/admin$/)
})

test('admin creates a group, assigns it from the persons dropdown, and the kitchen shows it', async ({ page }) => {
  await page.goto('/admin/gruppi')
  await page.getByRole('button', { name: 'Nuovo gruppo' }).click()
  await page.getByLabel('Nome').fill('Seminaristi')
  await page.getByRole('button', { name: 'Salva' }).click()
  const row = page.getByRole('row', { name: /Seminaristi/ })
  await expect(row).toBeVisible()
  await expect(row.getByRole('cell', { name: '0', exact: true })).toBeVisible()

  // duplicate (case-insensitive) is refused with a message
  await page.getByRole('button', { name: 'Nuovo gruppo' }).click()
  await page.getByLabel('Nome').fill('seminaristi')
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByRole('alert').filter({ hasText: /./ })).toHaveText('Esiste già un gruppo con questo nome.')
  await page.getByRole('button', { name: 'Annulla' }).click()

  // assign from the persons page
  await page.goto('/admin/persone')
  await page.getByRole('row', { name: new RegExp(E2E.memberName) }).getByRole('button', { name: 'Modifica' }).click()
  await page.getByLabel('Gruppo').selectOption({ label: 'Seminaristi' })
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByRole('row', { name: new RegExp(E2E.memberName) }).getByRole('cell', { name: 'Seminaristi' })).toBeVisible()

  // kitchen shows the tag
  await page.goto('/admin?d=2026-10-20&tutti=1')
  await expect(page.getByTestId('meal-lunch').getByRole('listitem').filter({ hasText: E2E.memberName })).toContainText('Seminaristi')

  // rename follows everywhere; delete is blocked while in use
  await page.goto('/admin/gruppi')
  const inUse = page.getByRole('row', { name: /Seminaristi/ })
  await expect(inUse.getByRole('cell', { name: '1', exact: true })).toBeVisible()
  await expect(inUse.getByRole('button', { name: 'Elimina' })).toBeDisabled()
  await inUse.getByRole('button', { name: 'Modifica' }).click()
  await page.getByLabel('Nome').fill('Seminario')
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByRole('row', { name: /Seminario/ })).toBeVisible()
  await page.goto('/admin?d=2026-10-20&tutti=1')
  await expect(page.getByTestId('meal-lunch').getByRole('listitem').filter({ hasText: E2E.memberName })).toContainText('Seminario')

  // unassign → delete works
  await page.goto('/admin/persone')
  await page.getByRole('row', { name: new RegExp(E2E.memberName) }).getByRole('button', { name: 'Modifica' }).click()
  await page.getByLabel('Gruppo').selectOption({ label: '— nessuno —' })
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByRole('row', { name: new RegExp(E2E.memberName) }).getByRole('cell', { name: 'Seminario' })).toHaveCount(0)
  await page.goto('/admin/gruppi')
  const free = page.getByRole('row', { name: /Seminario/ })
  await free.getByRole('button', { name: 'Elimina' }).click()
  await free.getByRole('button', { name: 'Confermi?' }).click()
  await expect(page.getByRole('row', { name: /Seminario/ })).toHaveCount(0)

  // restore the member's original group for the other specs
  await page.goto('/admin/persone')
  await page.getByRole('row', { name: new RegExp(E2E.memberName) }).getByRole('button', { name: 'Modifica' }).click()
  await page.getByLabel('Gruppo').selectOption({ label: 'Ospiti' })
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByRole('row', { name: new RegExp(E2E.memberName) }).getByRole('cell', { name: 'Ospiti' })).toBeVisible()
})
