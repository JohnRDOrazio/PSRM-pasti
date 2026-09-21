import { expect, test } from '@playwright/test'
import { E2E } from './global-setup'

async function adminLogin(page: import('@playwright/test').Page) {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(E2E.adminEmail)
  await page.getByLabel('Password', { exact: true }).fill(E2E.adminPassword)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

test('member writes their dietary notes and the kitchen sees them', async ({ page, browser }) => {
  await page.goto(`/p/${E2E.memberToken}`)
  await expect(page.getByRole('heading', { name: E2E.memberName })).toBeVisible()

  const notes = page.getByTestId('dietary-notes')
  await notes.getByRole('button', { name: 'Modifica' }).click()
  await notes.getByRole('textbox').fill('Celiaco, no lattosio')
  await notes.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByRole('status')).toHaveText('Salvato')
  await expect(notes.getByRole('textbox')).toHaveCount(0)
  await expect(notes).toContainText('Celiaco, no lattosio')
  await page.reload()
  await expect(page.getByTestId('dietary-notes')).toContainText('Celiaco, no lattosio')

  // Kitchen: the note shows for the meal the member is present at (season default = present).
  const ctx = await browser.newContext()
  const admin = await ctx.newPage()
  await adminLogin(admin)
  await admin.goto('/admin?d=2026-10-20')
  const lunchNotes = admin.getByTestId('meal-lunch').getByTestId('dietary-notes-lunch')
  await expect(lunchNotes).toContainText(E2E.memberName)
  await expect(lunchNotes).toContainText('Celiaco, no lattosio')

  // Marked absent → no longer listed for that meal.
  await admin.goto('/admin?d=2026-10-20&tutti=1')
  await admin.getByTestId('meal-lunch').getByRole('listitem').filter({ hasText: E2E.memberName }).getByRole('button', { name: 'Pranzo' }).click()
  await expect(admin.getByTestId('meal-lunch').getByTestId('dietary-notes-lunch')).toHaveCount(0)
  await expect(admin.getByTestId('meal-dinner').getByTestId('dietary-notes-dinner')).toContainText(E2E.memberName)
  // restore
  await admin.getByTestId('meal-lunch').getByRole('listitem').filter({ hasText: E2E.memberName }).getByRole('button', { name: 'Pranzo' }).click()
  await expect(admin.getByTestId('meal-lunch').getByTestId('dietary-notes-lunch')).toContainText(E2E.memberName)
  await ctx.close()
})

test('admin edits the same field from the persons page and the member sees it', async ({ page, browser }) => {
  const ctx = await browser.newContext()
  const admin = await ctx.newPage()
  await adminLogin(admin)
  await admin.goto('/admin/persone')
  await admin.getByRole('row', { name: new RegExp(E2E.memberName) }).getByRole('button', { name: 'Modifica' }).click()
  const field = admin.getByLabel('Note alimentari')
  await expect(field).toHaveValue('Celiaco, no lattosio')
  await field.fill('')
  await admin.getByRole('button', { name: 'Salva' }).click()
  await expect(admin.getByRole('cell', { name: /Celiaco/ })).toHaveCount(0)
  await ctx.close()

  // Member sees the note was cleared.
  await page.goto(`/p/${E2E.memberToken}`)
  await expect(page.getByTestId('dietary-notes')).toContainText('Nessuna nota.')
})
