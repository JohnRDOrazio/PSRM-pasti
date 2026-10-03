import { expect, test } from '@playwright/test'
import postgres from 'postgres'
import { E2E } from './global-setup'

// Simulates another admin (or a member) changing the day while this page stays open.
const DAY = '2026-10-22'
let sql: ReturnType<typeof postgres>

test.beforeEach(async ({ page }) => {
  process.loadEnvFile('.env.local')
  sql = postgres(process.env.DATABASE_URL!, { max: 1 })
  await sql`delete from meal_guests where date = ${DAY}`

  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(E2E.adminEmail)
  await page.getByLabel('Password', { exact: true }).fill(E2E.adminPassword)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page).toHaveURL(/\/admin$/)
})

test.afterEach(async () => {
  await sql`delete from meal_guests where date = ${DAY}`
  await sql.end()
})

test('Aggiorna button reloads totals changed elsewhere', async ({ page }) => {
  await page.goto(`/admin?d=${DAY}&tutti=1`)
  const lunch = page.getByTestId('meal-lunch')
  await expect(lunch.getByText('Ospiti 0')).toBeVisible()
  const stamp = page.getByTestId('updated-at')
  const before = await stamp.textContent()
  expect(before).toMatch(/^Aggiornato alle \d{2}:\d{2}:\d{2}$/)

  await sql`insert into meal_guests (date, meal, count, note) values (${DAY}, 'lunch', 3, 'famiglia Bianchi')`
  await page.waitForTimeout(1100) // let the clock tick so the timestamp must change
  await page.getByRole('button', { name: 'Aggiorna' }).click()

  await expect(lunch.getByText('Ospiti 3')).toBeVisible()
  // The stepper must pick up the new value too, or "+" would save stale + 1 over the other admin's count.
  await expect(lunch.locator('output[aria-label="Ospiti"]')).toHaveText('3')
  await expect(lunch.getByPlaceholder('Nota ospiti')).toHaveValue('famiglia Bianchi')
  await expect(stamp).not.toHaveText(before!)
  await expect(page).toHaveURL(new RegExp(`d=${DAY}&tutti=1`))
})

test('returning to the page refreshes it automatically', async ({ page }) => {
  await page.goto(`/admin?d=${DAY}`)
  const lunch = page.getByTestId('meal-lunch')
  await expect(lunch.getByText('Ospiti 0')).toBeVisible()

  await sql`insert into meal_guests (date, meal, count) values (${DAY}, 'lunch', 2)`
  // Fake the app going to the background and coming back (e.g. iPhone home-screen app reopened).
  // Repeated until it lands: the listener only exists once the page has hydrated.
  await expect(async () => {
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await expect(lunch.getByText('Ospiti 2')).toBeVisible({ timeout: 1000 })
  }).toPass()
  await expect(lunch.locator('output[aria-label="Ospiti"]')).toHaveText('2')
})
