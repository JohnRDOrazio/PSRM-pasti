import 'server-only'
import { type CutoffSettings, DEFAULT_SETTINGS } from '@/lib/cutoff'
import { db } from './db'

export async function getSettings(): Promise<CutoffSettings> {
  const { data, error } = await db.from('settings').select('key, value').in('key', ['lunch_cutoff', 'dinner_cutoff'])
  if (error) throw new Error(`settings: ${error.message}`)
  const s: CutoffSettings = { ...DEFAULT_SETTINGS }
  for (const row of (data ?? []) as { key: keyof CutoffSettings; value: unknown }[]) {
    if (typeof row.value === 'string') s[row.key] = row.value
  }
  return s
}
