import { expect, test } from '@playwright/test'
import { E2E } from './global-setup'

// Regression guard: no admin page may scroll horizontally on a phone-sized viewport.
test.use({ viewport: { width: 390, height: 844 } })

const PAGES = ['/admin', '/admin?tutti=1', '/admin/persone', '/admin/stagioni', '/admin/impostazioni', '/admin/registro', '/admin/password']

test('admin pages fit a 390px viewport without horizontal overflow', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(E2E.adminEmail)
  await page.getByLabel('Password', { exact: true }).fill(E2E.adminPassword)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page).toHaveURL(/\/admin$/)
  for (const path of PAGES) {
    await page.goto(path)
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(scrollWidth, `${path} overflows horizontally`).toBeLessThanOrEqual(clientWidth)
  }
})

test('member pages fit a 390px viewport without horizontal overflow', async ({ page }) => {
  await page.goto(`/p/${E2E.memberToken}`)
  for (const path of ['/', '/periodo']) {
    await page.goto(path)
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    expect(scrollWidth, `${path} overflows horizontally`).toBeLessThanOrEqual(clientWidth)
  }
})
