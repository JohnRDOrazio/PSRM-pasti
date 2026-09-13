import { expect, test } from '@playwright/test'
import { E2E } from './global-setup'

test.beforeEach(async ({ page }) => {
  await page.goto(`/p/${E2E.memberToken}`)
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('heading', { name: E2E.memberName })).toBeVisible()
})

test('shows 30 days and persists a toggle', async ({ page }) => {
  const lunches = page.getByRole('button', { name: 'Pranzo' })
  await expect(lunches).toHaveCount(30)
  const target = lunches.nth(5) // always in the future → never locked
  const before = await target.getAttribute('aria-pressed')
  await target.click()
  await expect(page.getByRole('status')).toHaveText('Salvato')
  await expect(target).toHaveAttribute('aria-pressed', before === 'true' ? 'false' : 'true')
  await page.reload()
  await expect(page.getByRole('button', { name: 'Pranzo' }).nth(5)).toHaveAttribute('aria-pressed', before === 'true' ? 'false' : 'true')
  // restore
  await page.getByRole('button', { name: 'Pranzo' }).nth(5).click()
  await expect(page.getByRole('status')).toHaveText('Salvato')
})

test('interval save shows confirmation and undo restores', async ({ page }) => {
  // today+11 dinner is inside the interval whether the minimum cell is today or tomorrow.
  const target = page.getByRole('button', { name: 'Cena' }).nth(11)
  const before = await target.getAttribute('aria-pressed')

  await page.getByRole('link', { name: 'Segna un periodo' }).click()
  await expect(page).toHaveURL(/\/periodo$/)
  // Choose the state opposite to the current one so the interval actually changes something.
  await page.getByRole('button', { name: before === 'true' ? 'Assente' : 'Presente' }).click()
  const min = await page.locator('input[name=start_date]').getAttribute('min')
  const start = new Date(`${min}T00:00:00Z`)
  const s = new Date(start.getTime() + 10 * 86_400_000).toISOString().slice(0, 10)
  const e = new Date(start.getTime() + 12 * 86_400_000).toISOString().slice(0, 10)
  await page.locator('input[name=start_date]').fill(s)
  await page.locator('select[name=start_meal]').selectOption('dinner')
  await page.locator('input[name=end_date]').fill(e)
  await page.locator('select[name=end_meal]').selectOption('lunch')
  await expect(page.getByTestId('summary')).toContainText('4 pasti')
  await page.getByRole('button', { name: 'Salva' }).click()

  await expect(page).toHaveURL(/\/periodo\/conferma\?c=/)
  await expect(page.getByRole('heading', { name: 'Salvato' })).toBeVisible()
  await expect(page.getByText('4 pasti')).toBeVisible()
  await page.getByRole('button', { name: 'Annulla' }).click()
  await expect(page.getByRole('status')).toHaveText('Modifica annullata.')

  await page.getByRole('link', { name: 'Torna all’elenco' }).click()
  await expect(page.getByRole('button', { name: 'Cena' }).nth(11)).toHaveAttribute('aria-pressed', before!)
})

test('invalid token lands on the invalid-link page', async ({ browser }) => {
  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  await page.goto('/p/not-a-real-token')
  await expect(page).toHaveURL(/\/link-non-valido$/)
  await expect(page.getByRole('heading', { name: 'Link non valido' })).toBeVisible()
  await ctx.close()
})
