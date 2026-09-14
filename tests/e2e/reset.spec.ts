import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { E2E } from './global-setup'

const RECOVERED_PASSWORD = 'e2e-recovered-password-789'

function serviceClient() {
  process.loadEnvFile('.env.local')
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Same thing the recovery e-mail link carries, minus the mailbox. */
async function recoveryTokenHash(email: string): Promise<string> {
  const { data, error } = await serviceClient().auth.admin.generateLink({ type: 'recovery', email })
  if (error) throw error
  return data.properties.hashed_token
}

test('login form has a password visibility toggle', async ({ page }) => {
  await page.goto('/admin/login')
  const field = page.getByLabel('Password', { exact: true })
  await field.fill('segreto')
  await expect(field).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Mostra password' }).click()
  await expect(field).toHaveAttribute('type', 'text')
  await page.getByRole('button', { name: 'Nascondi password' }).click()
  await expect(field).toHaveAttribute('type', 'password')
})

test('forgot-password link leads to the request page, which never reveals whether the email exists', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByRole('link', { name: 'Password dimenticata?' }).click()
  await expect(page).toHaveURL(/\/admin\/reset$/)
  await page.getByLabel('Email').fill('nobody@e2e.local')
  await page.getByRole('button', { name: 'Invia il link' }).click()
  await expect(page.getByText(/Se l’indirizzo è registrato/)).toBeVisible()
})

test('recovery link lets the admin set a new password and log in with it', async ({ page }) => {
  const tokenHash = await recoveryTokenHash(E2E.adminEmail)
  try {
    await page.goto(`/admin/reset/nuova?token_hash=${tokenHash}&type=recovery`)
    await page.getByLabel('Nuova password', { exact: true }).fill(RECOVERED_PASSWORD)
    await page.getByLabel('Conferma nuova password').fill(RECOVERED_PASSWORD)
    await page.getByRole('button', { name: 'Aggiorna password' }).click()
    await expect(page.getByText('Password aggiornata.')).toBeVisible()

    await page.getByRole('link', { name: 'Vai alla cucina' }).click()
    await expect(page).toHaveURL(/\/admin$/)
    await page.getByRole('button', { name: 'Esci' }).click()
    await page.goto('/admin/login')
    await page.getByLabel('Email').fill(E2E.adminEmail)
    await page.getByLabel('Password', { exact: true }).fill(RECOVERED_PASSWORD)
    await page.getByRole('button', { name: 'Accedi' }).click()
    await expect(page).toHaveURL(/\/admin$/)
  } finally {
    // Restore the shared e2e admin password (global setup also re-syncs it on the next run).
    const supa = serviceClient()
    const { data: list, error: listErr } = await supa.auth.admin.listUsers({ perPage: 200 })
    if (listErr) throw listErr
    const user = list.users.find((u) => u.email === E2E.adminEmail)
    if (!user) throw new Error('e2e admin user not found during cleanup')
    const { error } = await supa.auth.admin.updateUserById(user.id, { password: E2E.adminPassword })
    if (error) throw error
  }
})

test('an invalid recovery token shows an error instead of the form', async ({ page }) => {
  await page.goto('/admin/reset/nuova?token_hash=not-a-real-token&type=recovery')
  await expect(page.getByText('Link non valido o scaduto.')).toBeVisible()
  await expect(page.getByLabel('Nuova password', { exact: true })).toHaveCount(0)
})
