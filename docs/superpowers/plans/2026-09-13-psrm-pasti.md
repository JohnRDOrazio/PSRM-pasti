# PSRM Pasti Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the PSRM Pasti PWA: ~60 members mark meal presence/absence via personal tokenized links; the kitchen/admin sees daily headcounts and manages people, seasons, cutoffs, guests and the audit log.

**Architecture:** Next.js 16 App Router on Vercel talking to Supabase Postgres through server-only code with the service-role key. All presence logic (season resolution, cutoff, interval expansion, change log, undo) lives in Postgres functions called via RPC, so every write is one transaction. Pure TypeScript mirrors (dates, interval, cutoff, i18n) live in `src/lib` and are shared by server and client for UI decisions only; the database is the authority.

**Tech Stack:** Next.js 16.3 (TypeScript, Turbopack, Tailwind 4), Supabase (Postgres + Auth), `@supabase/supabase-js`, `@supabase/ssr`, zod 4, `qrcode`, Vitest 5, Playwright, `postgres` (tests only), Supabase CLI (local stack via Docker).

**Spec:** `docs/superpowers/specs/2026-09-13-psrm-pasti-design.md`

## Global Constraints

- Next.js **16** App Router, `src/` directory, import alias `@/*`. Use `src/proxy.ts` (not `middleware.ts`). `cookies()`, `params`, `searchParams` are async.
- Italian-only UI. **All user-visible strings live in `src/i18n/it.ts`** with plural helpers; components import `t`.
- Timezone **Europe/Rome** for every date/time decision. Dates travel as `'YYYY-MM-DD'` strings; meals as `'lunch' | 'dinner'`.
- The anon key is used **only** by Supabase Auth (admin login). All data reads/writes use the service-role client in `src/server/db.ts`, which is `server-only`.
- RLS enabled on every table with **no policies**; `revoke execute` on functions from `anon, authenticated`.
- Members never see a password. Tokens: 32 random bytes base64url (43 chars); DB stores `sha256` hex only; the plain token is displayed exactly once (creation / regeneration).
- Cutoff default `10:00` for both meals, stored in `settings`; members are blocked, admins bypass.
- Change kinds: `toggle | interval | admin_edit | undo`. Intervals are meal-to-meal inclusive.
- Undo allowed only: same person, actor `member`, not already undone, < 24h old, no later change entry on any of its cells.
- Every task: TDD, run the relevant test command, commit with a `feat:`/`chore:`/`test:` prefix.
- **Deviation from spec §7 (documented):** pure modules `dates`, `interval`, `cutoff` live in `src/lib/` (isomorphic, imported by client components) instead of `src/server/`; season resolution is implemented once, in SQL (`season_default`), and has no TS twin — the client receives `default_present` from the server.

## File Structure

```
package.json, vitest.config.ts, vitest.integration.config.ts, playwright.config.ts
src/proxy.ts                         member cookie refresh + admin auth guard
src/lib/dates.ts                     IsoDate/Meal/Cell, addDays, romeParts, cellKey
src/lib/interval.ts                  expandInterval (pure)
src/lib/cutoff.ts                    isLocked, firstUnlockedCell (pure)
src/lib/cookie.ts                    MEMBER_COOKIE name + options (no node deps)
src/i18n/it.ts                       all strings, plural(), date formatters, intervalSummary
src/server/db.ts                     service-role Supabase client (server-only)
src/server/token.ts                  generateToken, hashToken, personLink (pure node)
src/server/auth.ts                   findPersonByToken, getPersonFromCookie, getAdmin, requireAdmin
src/server/supabase-auth.ts          @supabase/ssr server client bound to next cookies
src/server/settings.ts               getSettings()
src/server/changes.ts                applyChange(), undoChange() RPC wrappers
src/app/layout.tsx, globals.css      root layout (lang=it, manifest, SW registration)
src/app/page.tsx                     member: next 30 days
src/app/link-non-valido/page.tsx
src/app/offline/page.tsx
src/app/p/[token]/route.ts           sets member cookie, redirects to /
src/app/periodo/page.tsx             interval picker
src/app/periodo/conferma/page.tsx    confirmation + undo
src/app/api/choices/schema.ts        zod schema
src/app/api/choices/route.ts         POST member change
src/app/api/changes/[id]/undo/route.ts
src/app/admin/login/page.tsx
src/app/admin/(protected)/layout.tsx  nav + requireAdmin
src/app/admin/(protected)/page.tsx    kitchen day view
src/app/admin/(protected)/actions.ts  adminSetPresence, setGuests, signOut
src/app/admin/(protected)/persone/{page.tsx,actions.ts}
src/app/admin/(protected)/stagioni/{page.tsx,actions.ts}
src/app/admin/(protected)/impostazioni/{page.tsx,actions.ts}
src/app/admin/(protected)/registro/page.tsx
src/components/DayList.tsx, Pill.tsx, Toast.tsx, IntervalForm.tsx, UndoButton.tsx,
src/components/SwRegister.tsx, admin/{GuestStepper,AdminToggle,PersonsTable,SeasonForm,LoginForm}.tsx
public/manifest.webmanifest, public/sw.js, public/icons/icon-{192,512}.png
scripts/make-icons.mjs, scripts/local-env.sh, scripts/create-admin.ts
supabase/config.toml, supabase/seed.sql
supabase/migrations/20260913000001_schema.sql   types, tables, RLS, season_default, is_locked, interval_cells
supabase/migrations/20260913000002_changes.sql  effective_presence, day_roster, apply_change, undo_change
supabase/migrations/20260913000003_views.sql    persons_overview
tests/integration/{env.ts,helpers.ts,*.test.ts}
tests/e2e/{global-setup.ts,member.spec.ts,admin.spec.ts}
```

---

### Task 1: Scaffold Next.js 16 project, test runners, and `src/lib/dates.ts`

**Files:**
- Create: whole Next.js scaffold (via `create-next-app`), `vitest.config.ts`, `vitest.integration.config.ts`, `src/lib/dates.ts`
- Test: `src/lib/dates.test.ts`

**Interfaces:**
- Produces: `IsoDate` (string), `Meal`, `Cell {date, meal}`, `MEALS`, `isIsoDate(s)`, `toUtcDate(iso)`, `fromUtcDate(d)`, `addDays(iso, n)`, `dayNumber(iso)`, `mealOrd(m)`, `cellKey(c)`, `cellFromKey(k)`, `compareCells(a,b)`, `romeParts(now) → {date, minutes}`.

- [ ] **Step 1: Scaffold in a scratch dir and copy in (the repo already has `.git`, `.serena`, `docs`)**

```bash
rm -rf /tmp/psrm-scaffold
npx create-next-app@latest /tmp/psrm-scaffold --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --disable-git --yes
cp -a /tmp/psrm-scaffold/. /home/johnrdorazio/development/PSRM-pasti/
cd /home/johnrdorazio/development/PSRM-pasti && cat package.json | head -30 && ls src/app
```
Expected: `next` version `16.x` in package.json; `src/app/{layout.tsx,page.tsx,globals.css}` exist.

- [ ] **Step 2: Install runtime and dev dependencies**

```bash
npm i zod @supabase/supabase-js @supabase/ssr qrcode server-only
npm i -D vitest @playwright/test postgres tsx sharp @types/qrcode supabase
```

- [ ] **Step 3: Add Vitest configs**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
```

`vitest.integration.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['tests/integration/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['tests/integration/env.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
```

- [ ] **Step 4: Add npm scripts** (edit `package.json` `scripts`, keep the existing `dev/build/start/lint`)

```json
"test": "vitest run --config vitest.config.ts",
"test:watch": "vitest --config vitest.config.ts",
"test:integration": "vitest run --config vitest.integration.config.ts",
"test:e2e": "playwright test",
"db:start": "supabase start",
"db:stop": "supabase stop",
"db:reset": "supabase db reset",
"db:env": "bash scripts/local-env.sh",
"icons": "node scripts/make-icons.mjs"
```

- [ ] **Step 5: Write the failing tests for `dates.ts`**

`src/lib/dates.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { addDays, cellFromKey, cellKey, compareCells, dayNumber, isIsoDate, romeParts } from './dates'

describe('isIsoDate', () => {
  it('accepts real dates', () => {
    expect(isIsoDate('2026-09-13')).toBe(true)
    expect(isIsoDate('2028-02-29')).toBe(true)
  })
  it('rejects malformed or impossible dates', () => {
    expect(isIsoDate('2026-9-13')).toBe(false)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('2026-13-01')).toBe(false)
    expect(isIsoDate('hello')).toBe(false)
  })
})

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-09-13', 29)).toBe('2026-10-12')
  })
})

describe('cell keys', () => {
  it('orders lunch before dinner and days chronologically', () => {
    expect(compareCells({ date: '2026-09-13', meal: 'lunch' }, { date: '2026-09-13', meal: 'dinner' })).toBeLessThan(0)
    expect(compareCells({ date: '2026-09-13', meal: 'dinner' }, { date: '2026-09-14', meal: 'lunch' })).toBeLessThan(0)
    expect(compareCells({ date: '2026-09-14', meal: 'lunch' }, { date: '2026-09-14', meal: 'lunch' })).toBe(0)
  })
  it('round-trips through cellKey/cellFromKey', () => {
    for (const c of [{ date: '2026-09-13', meal: 'lunch' as const }, { date: '2031-01-01', meal: 'dinner' as const }]) {
      expect(cellFromKey(cellKey(c))).toEqual(c)
    }
    expect(dayNumber('1970-01-02')).toBe(1)
  })
})

describe('romeParts', () => {
  it('converts UTC instants to Rome local date and minutes (CEST)', () => {
    expect(romeParts(new Date('2026-09-13T22:30:00Z'))).toEqual({ date: '2026-09-14', minutes: 30 })
    expect(romeParts(new Date('2026-09-13T07:59:00Z'))).toEqual({ date: '2026-09-13', minutes: 9 * 60 + 59 })
  })
  it('handles CET (winter) offset', () => {
    expect(romeParts(new Date('2026-01-13T23:30:00Z'))).toEqual({ date: '2026-01-14', minutes: 30 })
    expect(romeParts(new Date('2026-01-13T09:00:00Z'))).toEqual({ date: '2026-01-13', minutes: 600 })
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm test`
Expected: FAIL — `Cannot find module './dates'`.

- [ ] **Step 7: Implement `src/lib/dates.ts`**

```ts
export type IsoDate = string // 'YYYY-MM-DD'
export type Meal = 'lunch' | 'dinner'
export interface Cell {
  date: IsoDate
  meal: Meal
}

export const MEALS: readonly Meal[] = ['lunch', 'dinner'] as const
export const ROME_TZ = 'Europe/Rome'

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 86_400_000

export function isIsoDate(s: string): boolean {
  if (!ISO_RE.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

export function toUtcDate(iso: IsoDate): Date {
  return new Date(`${iso}T00:00:00Z`)
}

export function fromUtcDate(d: Date): IsoDate {
  return d.toISOString().slice(0, 10)
}

export function addDays(iso: IsoDate, n: number): IsoDate {
  const d = toUtcDate(iso)
  d.setUTCDate(d.getUTCDate() + n)
  return fromUtcDate(d)
}

/** Days since 1970-01-01. */
export function dayNumber(iso: IsoDate): number {
  return Math.round(toUtcDate(iso).getTime() / DAY_MS)
}

export function mealOrd(m: Meal): number {
  return m === 'lunch' ? 0 : 1
}

/** Monotonic key: lunch before dinner, days in order. */
export function cellKey(c: Cell): number {
  return dayNumber(c.date) * 2 + mealOrd(c.meal)
}

export function cellFromKey(k: number): Cell {
  return { date: fromUtcDate(new Date(Math.floor(k / 2) * DAY_MS)), meal: k % 2 === 0 ? 'lunch' : 'dinner' }
}

export function compareCells(a: Cell, b: Cell): number {
  return cellKey(a) - cellKey(b)
}

const romeFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: ROME_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

/** Local calendar date and minutes-since-midnight in Europe/Rome for a given instant. */
export function romeParts(now: Date): { date: IsoDate; minutes: number } {
  const parts = romeFmt.formatToParts(now)
  const get = (type: string) => parts.find((p) => p.type === type)!.value
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  }
}
```

- [ ] **Step 8: Run tests, lint, and typecheck**

Run: `npm test && npm run lint && npx tsc --noEmit`
Expected: all dates tests PASS; no lint or type errors.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 app with vitest; add dates helpers"
```

---

### Task 2: `src/lib/interval.ts` — meal-to-meal interval expansion

**Files:**
- Create: `src/lib/interval.ts`
- Test: `src/lib/interval.test.ts`

**Interfaces:**
- Consumes: `Cell`, `cellKey`, `cellFromKey` from `@/lib/dates`.
- Produces: `MAX_CELLS = 800`, `class IntervalError extends Error { code: 'invalid_interval' | 'too_long' }`, `expandInterval(startDate, startMeal, endDate, endMeal): Cell[]`.

- [ ] **Step 1: Write the failing test**

`src/lib/interval.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { IntervalError, expandInterval } from './interval'

describe('expandInterval', () => {
  it('returns a single cell for a same-cell interval', () => {
    expect(expandInterval('2026-10-20', 'lunch', '2026-10-20', 'lunch')).toEqual([{ date: '2026-10-20', meal: 'lunch' }])
  })
  it('includes every meal between the boundaries, respecting partial boundary days', () => {
    expect(expandInterval('2026-10-20', 'dinner', '2026-10-22', 'lunch')).toEqual([
      { date: '2026-10-20', meal: 'dinner' },
      { date: '2026-10-21', meal: 'lunch' },
      { date: '2026-10-21', meal: 'dinner' },
      { date: '2026-10-22', meal: 'lunch' },
    ])
  })
  it('rejects an end before the start', () => {
    expect(() => expandInterval('2026-10-20', 'dinner', '2026-10-20', 'lunch')).toThrow(IntervalError)
    try {
      expandInterval('2026-10-21', 'lunch', '2026-10-20', 'dinner')
    } catch (e) {
      expect((e as IntervalError).code).toBe('invalid_interval')
    }
  })
  it('rejects intervals longer than MAX_CELLS', () => {
    try {
      expandInterval('2026-01-01', 'lunch', '2027-12-31', 'dinner')
      throw new Error('did not throw')
    } catch (e) {
      expect((e as IntervalError).code).toBe('too_long')
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- interval`
Expected: FAIL — `Cannot find module './interval'`.

- [ ] **Step 3: Implement**

`src/lib/interval.ts`:
```ts
import { type Cell, type IsoDate, type Meal, cellFromKey, cellKey } from '@/lib/dates'

export const MAX_CELLS = 800

export class IntervalError extends Error {
  constructor(public readonly code: 'invalid_interval' | 'too_long') {
    super(code)
    this.name = 'IntervalError'
  }
}

/** Every meal from (startDate, startMeal) to (endDate, endMeal), inclusive, in order. */
export function expandInterval(startDate: IsoDate, startMeal: Meal, endDate: IsoDate, endMeal: Meal): Cell[] {
  const a = cellKey({ date: startDate, meal: startMeal })
  const b = cellKey({ date: endDate, meal: endMeal })
  if (b < a) throw new IntervalError('invalid_interval')
  if (b - a + 1 > MAX_CELLS) throw new IntervalError('too_long')
  const cells: Cell[] = []
  for (let k = a; k <= b; k++) cells.push(cellFromKey(k))
  return cells
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/interval.ts src/lib/interval.test.ts
git commit -m "feat: interval expansion"
```

---

### Task 3: `src/lib/cutoff.ts` — lock rules in Europe/Rome

**Files:**
- Create: `src/lib/cutoff.ts`
- Test: `src/lib/cutoff.test.ts`

**Interfaces:**
- Consumes: `romeParts`, `addDays`, `MEALS`, `Cell` from `@/lib/dates`.
- Produces: `interface CutoffSettings { lunch_cutoff: string; dinner_cutoff: string }` ('HH:MM'), `DEFAULT_SETTINGS`, `parseHm(s): number`, `isLocked(cell, now, settings): boolean`, `firstUnlockedCell(now, settings): Cell`.

- [ ] **Step 1: Write the failing test**

`src/lib/cutoff.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { DEFAULT_SETTINGS, firstUnlockedCell, isLocked, parseHm } from './cutoff'

const S = DEFAULT_SETTINGS // 10:00 / 10:00

describe('parseHm', () => {
  it('parses HH:MM to minutes', () => {
    expect(parseHm('10:00')).toBe(600)
    expect(parseHm('9:05')).toBe(545)
    expect(() => parseHm('10')).toThrow()
  })
})

describe('isLocked', () => {
  it('locks past days and unlocks future days regardless of time', () => {
    const now = new Date('2026-09-13T12:00:00Z')
    expect(isLocked({ date: '2026-09-12', meal: 'dinner' }, now, S)).toBe(true)
    expect(isLocked({ date: '2026-09-14', meal: 'lunch' }, now, S)).toBe(false)
  })
  it('locks today at exactly the cutoff, Rome time (CEST)', () => {
    expect(isLocked({ date: '2026-09-13', meal: 'lunch' }, new Date('2026-09-13T07:59:00Z'), S)).toBe(false)
    expect(isLocked({ date: '2026-09-13', meal: 'lunch' }, new Date('2026-09-13T08:00:00Z'), S)).toBe(true)
  })
  it('uses CET in winter', () => {
    expect(isLocked({ date: '2026-01-13', meal: 'dinner' }, new Date('2026-01-13T08:59:00Z'), S)).toBe(false)
    expect(isLocked({ date: '2026-01-13', meal: 'dinner' }, new Date('2026-01-13T09:00:00Z'), S)).toBe(true)
  })
  it('is correct on the DST switch day (2026-03-29, clocks forward at 02:00)', () => {
    expect(isLocked({ date: '2026-03-29', meal: 'lunch' }, new Date('2026-03-29T07:59:00Z'), S)).toBe(false)
    expect(isLocked({ date: '2026-03-29', meal: 'lunch' }, new Date('2026-03-29T08:00:00Z'), S)).toBe(true)
  })
  it('respects per-meal cutoffs', () => {
    const s = { lunch_cutoff: '10:00', dinner_cutoff: '15:00' }
    const now = new Date('2026-09-13T10:00:00Z') // 12:00 Rome
    expect(isLocked({ date: '2026-09-13', meal: 'lunch' }, now, s)).toBe(true)
    expect(isLocked({ date: '2026-09-13', meal: 'dinner' }, now, s)).toBe(false)
  })
})

describe('firstUnlockedCell', () => {
  it('is today lunch before the cutoff', () => {
    expect(firstUnlockedCell(new Date('2026-09-13T06:00:00Z'), S)).toEqual({ date: '2026-09-13', meal: 'lunch' })
  })
  it('is tomorrow lunch after both cutoffs', () => {
    expect(firstUnlockedCell(new Date('2026-09-13T12:00:00Z'), S)).toEqual({ date: '2026-09-14', meal: 'lunch' })
  })
  it('is today dinner between a lunch and a later dinner cutoff', () => {
    const s = { lunch_cutoff: '10:00', dinner_cutoff: '15:00' }
    expect(firstUnlockedCell(new Date('2026-09-13T10:00:00Z'), s)).toEqual({ date: '2026-09-13', meal: 'dinner' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- cutoff`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/lib/cutoff.ts`:
```ts
import { type Cell, MEALS, addDays, romeParts } from '@/lib/dates'

export interface CutoffSettings {
  lunch_cutoff: string // 'HH:MM' Europe/Rome
  dinner_cutoff: string
}

export const DEFAULT_SETTINGS: CutoffSettings = { lunch_cutoff: '10:00', dinner_cutoff: '10:00' }

export function parseHm(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s)
  if (!m) throw new Error(`invalid time: ${s}`)
  return Number(m[1]) * 60 + Number(m[2])
}

export function cutoffFor(meal: Cell['meal'], settings: CutoffSettings): string {
  return meal === 'lunch' ? settings.lunch_cutoff : settings.dinner_cutoff
}

/** A cell is locked when its day is past, or it is today and Rome time >= that meal's cutoff. */
export function isLocked(cell: Cell, now: Date, settings: CutoffSettings): boolean {
  const { date: today, minutes } = romeParts(now)
  if (cell.date < today) return true
  if (cell.date > today) return false
  return minutes >= parseHm(cutoffFor(cell.meal, settings))
}

/** Earliest cell a member may still edit. */
export function firstUnlockedCell(now: Date, settings: CutoffSettings): Cell {
  const { date: today } = romeParts(now)
  for (const meal of MEALS) {
    const cell = { date: today, meal }
    if (!isLocked(cell, now, settings)) return cell
  }
  return { date: addDays(today, 1), meal: 'lunch' }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/cutoff.ts src/lib/cutoff.test.ts
git commit -m "feat: cutoff lock rules"
```

---

### Task 4: `src/i18n/it.ts` — strings, plurals, date formatting

**Files:**
- Create: `src/i18n/it.ts`
- Test: `src/i18n/it.test.ts`

**Interfaces:**
- Consumes: `Cell`, `IsoDate`, `Meal`, `toUtcDate` from `@/lib/dates`.
- Produces: `mealName`, `mealNameLower`, `plural(n, one, many)`, `formatDayShort(iso)` ("dom 20 set"), `formatDayLong(iso)` ("domenica 20 settembre"), `formatDateTime(iso: string)` (Rome, "20/09/2026, 10:30"), `intervalSummary(cells)`, `stateLabel(state)`, `kindLabel(kind)`, and the `t` object (all keys below are referenced by later tasks — keep the names).

- [ ] **Step 1: Write the failing test**

`src/i18n/it.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { formatDayLong, formatDayShort, intervalSummary, plural, t } from './it'

describe('plural', () => {
  it('picks singular for 1 and plural otherwise', () => {
    expect(plural(1, 'pasto', 'pasti')).toBe('1 pasto')
    expect(plural(0, 'pasto', 'pasti')).toBe('0 pasti')
    expect(plural(12, 'giorno', 'giorni')).toBe('12 giorni')
  })
})

describe('date formatting', () => {
  it('formats Italian short and long day labels', () => {
    expect(formatDayShort('2026-09-20')).toBe('dom 20 set')
    expect(formatDayLong('2026-09-20')).toBe('domenica 20 settembre')
  })
})

describe('intervalSummary', () => {
  it('describes a single meal', () => {
    expect(intervalSummary([{ date: '2026-09-20', meal: 'dinner' }])).toBe('1 pasto: cena di dom 20 set')
  })
  it('describes a range meal-to-meal', () => {
    const cells = [
      { date: '2026-09-20', meal: 'lunch' as const },
      { date: '2026-09-20', meal: 'dinner' as const },
      { date: '2026-09-21', meal: 'lunch' as const },
    ]
    expect(intervalSummary(cells)).toBe('3 pasti, dal pranzo di dom 20 set al pranzo di lun 21 set')
  })
  it('uses "alla" before cena', () => {
    const cells = [
      { date: '2026-09-20', meal: 'lunch' as const },
      { date: '2026-09-20', meal: 'dinner' as const },
    ]
    expect(intervalSummary(cells)).toBe('2 pasti, dal pranzo di dom 20 set alla cena di dom 20 set')
  })
  it('has a strings table', () => {
    expect(t.member.markPeriod).toBe('Segna un periodo')
    expect(t.absentCount(1)).toBe('1 assente')
    expect(t.absentCount(2)).toBe('2 assenti')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- i18n`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`src/i18n/it.ts`:
```ts
import { type Cell, type IsoDate, type Meal, ROME_TZ, toUtcDate } from '@/lib/dates'

export const mealName: Record<Meal, string> = { lunch: 'Pranzo', dinner: 'Cena' }
export const mealNameLower: Record<Meal, string> = { lunch: 'pranzo', dinner: 'cena' }

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

const shortFmt = new Intl.DateTimeFormat('it-IT', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
const longFmt = new Intl.DateTimeFormat('it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
const dateTimeFmt = new Intl.DateTimeFormat('it-IT', { dateStyle: 'short', timeStyle: 'short', timeZone: ROME_TZ })

export function formatDayShort(iso: IsoDate): string {
  return shortFmt.format(toUtcDate(iso))
}
export function formatDayLong(iso: IsoDate): string {
  return longFmt.format(toUtcDate(iso))
}
/** ISO timestamp (timestamptz) → 'gg/mm/aaaa, hh:mm' in Rome time. */
export function formatDateTime(iso: string): string {
  return dateTimeFmt.format(new Date(iso))
}

function toMeal(m: Meal): string {
  return m === 'lunch' ? 'al pranzo' : 'alla cena'
}

export function intervalSummary(cells: Cell[]): string {
  if (cells.length === 0) return 'Nessun pasto'
  const a = cells[0]
  const b = cells[cells.length - 1]
  if (cells.length === 1) return `1 pasto: ${mealNameLower[a.meal]} di ${formatDayShort(a.date)}`
  return `${plural(cells.length, 'pasto', 'pasti')}, dal ${mealNameLower[a.meal]} di ${formatDayShort(a.date)} ${toMeal(b.meal)} di ${formatDayShort(b.date)}`
}

export function stateLabel(state: boolean): string {
  return state ? 'Presente' : 'Assente'
}

export function kindLabel(kind: string): string {
  return ({ toggle: 'Singolo pasto', interval: 'Periodo', admin_edit: 'Modifica cucina', undo: 'Annullamento' } as Record<string, string>)[kind] ?? kind
}

export const t = {
  appName: 'PSRM Pasti',
  save: 'Salva',
  cancel: 'Annulla',
  close: 'Chiudi',
  edit: 'Modifica',
  delete: 'Elimina',
  confirmDelete: 'Confermi?',
  yes: 'Sì',
  no: 'No',
  loading: 'Attendere…',
  genericError: 'Si è verificato un errore, riprova.',
  absentCount: (n: number) => plural(n, 'assente', 'assenti'),
  presentCount: (n: number) => plural(n, 'presente', 'presenti'),
  member: {
    today: 'Oggi',
    seasonPresent: 'In questo periodo sei presente salvo diversa indicazione.',
    seasonAbsent: 'In questo periodo sei assente salvo diversa indicazione.',
    lockedAt: (hm: string) => `chiuso alle ${hm}`,
    saved: 'Salvato',
    saveError: 'Errore nel salvataggio, riprova.',
    lockedError: 'Questo pasto è già chiuso alle modifiche.',
    markPeriod: 'Segna un periodo',
    explicitHint: 'Il puntino indica una scelta diversa dal periodo.',
  },
  period: {
    title: 'Segna un periodo',
    absent: 'Assente',
    present: 'Presente',
    from: 'Dal',
    to: 'Al',
    invalidInterval: 'La fine deve essere dopo l’inizio.',
    tooLong: 'Periodo troppo lungo.',
    startTooEarly: 'Il pranzo di oggi è già chiuso: scegli la cena.',
    lockedError: 'Alcuni pasti sono già chiusi alle modifiche.',
    confirmTitle: 'Salvato',
    confirmKitchen: 'La cucina vede subito questa modifica.',
    overwrittenTitle: 'Scelte precedenti sostituite',
    overwrittenMore: (n: number) => `+${plural(n, 'altro', 'altri')}`,
    noOverwritten: 'Nessuna scelta precedente è stata sostituita.',
    undo: 'Annulla',
    undone: 'Modifica annullata.',
    backToList: 'Torna all’elenco',
    undoReason: {
      not_found: 'Modifica non trovata.',
      already_undone: 'Modifica già annullata.',
      too_old: 'Sono passate più di 24 ore.',
      superseded: 'Ci sono modifiche più recenti su questi pasti.',
      not_undoable: 'Questa modifica non può essere annullata.',
    } as Record<string, string>,
  },
  invalidLink: { title: 'Link non valido', body: 'Chiedi in cucina un nuovo link.' },
  offline: { title: 'Sei offline', body: 'Controlla la connessione e riprova.' },
  admin: {
    login: 'Accedi',
    email: 'Email',
    password: 'Password',
    loginError: 'Email o password non validi.',
    logout: 'Esci',
    nav: { kitchen: 'Cucina', persons: 'Persone', seasons: 'Stagioni', settings: 'Impostazioni', log: 'Registro' },
    kitchen: {
      title: 'Cucina',
      prevDay: 'Giorno precedente',
      nextDay: 'Giorno successivo',
      community: 'Comunità',
      guests: 'Ospiti',
      total: 'Totale',
      guestNote: 'Nota ospiti',
      absentAt: (meal: string) => `Assenti a ${meal}`,
      presentAt: (meal: string) => `Presenti a ${meal}`,
      nobody: 'Nessuno',
      showAll: 'Mostra tutti',
      showExceptions: 'Mostra solo eccezioni',
      defaultPresent: 'periodo a presenza predefinita',
      defaultAbsent: 'periodo ad assenza predefinita',
      print: 'Stampa',
    },
    persons: {
      title: 'Persone',
      new: 'Nuova persona',
      name: 'Nome e cognome',
      group: 'Gruppo',
      notes: 'Note',
      active: 'Attivo',
      inactive: 'Disattivato',
      lastChange: 'Ultima modifica',
      never: 'mai',
      deactivate: 'Disattiva',
      activate: 'Attiva',
      regenerate: 'Rigenera link',
      copyLink: 'Copia link',
      copied: 'Copiato',
      qr: 'QR',
      linkOnce: 'Questo link è visibile solo ora: copialo o mostra il QR.',
      cannotDelete: 'Ha delle modifiche registrate: puoi solo disattivarla.',
    },
    seasons: {
      title: 'Stagioni',
      label: 'Nome',
      recurring: 'Ogni anno',
      oneOff: 'Date specifiche',
      kind: 'Tipo',
      period: 'Periodo',
      startMd: 'Inizio (MM-GG)',
      endMd: 'Fine (MM-GG)',
      startDate: 'Inizio',
      endDate: 'Fine',
      lunchDefault: 'Pranzo predefinito',
      dinnerDefault: 'Cena predefinita',
      add: 'Aggiungi stagione',
      hint: 'Le date specifiche vincono sulle stagioni annuali; tra date specifiche vince la più breve.',
    },
    settings: {
      title: 'Impostazioni',
      lunchCutoff: 'Chiusura modifiche pranzo',
      dinnerCutoff: 'Chiusura modifiche cena',
      saved: 'Impostazioni salvate.',
    },
    log: {
      title: 'Registro',
      person: 'Persona',
      all: 'Tutte',
      from: 'Dal',
      to: 'Al',
      filter: 'Filtra',
      when: 'Quando',
      actor: 'Chi',
      actorMember: 'persona',
      actorAdmin: 'cucina',
      kind: 'Tipo',
      interval: 'Pasti',
      state: 'Stato',
      undone: 'annullata',
      empty: 'Nessuna modifica trovata.',
    },
  },
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/i18n
git commit -m "feat: Italian strings, plurals and date formatting"
```

---

### Task 5: Supabase project, schema migration, seed, and integration test harness

**Files:**
- Create: `supabase/config.toml` (via CLI), `supabase/migrations/20260913000001_schema.sql`, `supabase/seed.sql`, `scripts/local-env.sh`, `tests/integration/env.ts`, `tests/integration/helpers.ts`
- Test: `tests/integration/schema.test.ts`

**Interfaces:**
- Produces (SQL): enums `meal_t`, `actor_t`, `change_kind_t`; tables `persons`, `admins`, `season_defaults`, `settings`, `changes`, `meal_choices`, `change_entries`, `meal_guests`; functions `meal_ord(meal_t) int`, `season_default(p_date date, p_meal meal_t) boolean`, `is_locked(p_date date, p_meal meal_t, p_now timestamptz) boolean`, `interval_cells(p_start_date, p_start_meal, p_end_date, p_end_meal) table(date, meal)`.
- Produces (tests): `sql` (postgres client), `q` (same, plain-array results), `supa` (service-role client), `resetData()`, `createPerson(name, group?) → id`, `rpc(fn, args)`.

- [ ] **Step 1: Initialise the Supabase project and start the local stack (Docker required)**

```bash
npx supabase init --yes 2>/dev/null || npx supabase init
npx supabase start
npx supabase status -o env
```
Expected: `supabase/config.toml` exists; status prints `API_URL="http://127.0.0.1:54321"`, `DB_URL=...`, `SERVICE_ROLE_KEY=...` (or `SECRET_KEY`), `ANON_KEY=...` (or `PUBLISHABLE_KEY`). First start downloads images and can take several minutes.

- [ ] **Step 2: Write `scripts/local-env.sh`** (writes `.env.local` for Next.js and Playwright from the local stack)

```bash
#!/usr/bin/env bash
# Writes .env.local pointing Next.js at the local Supabase stack.
set -euo pipefail
cd "$(dirname "$0")/.."
eval "$(npx supabase status -o env)"
cat > .env.local <<ENV
SUPABASE_URL=$API_URL
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY:-${SECRET_KEY:-}}
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY:-${PUBLISHABLE_KEY:-}}
DATABASE_URL=$DB_URL
APP_BASE_URL=http://localhost:3000
ENV
echo "wrote .env.local"
```
Run: `chmod +x scripts/local-env.sh && npm run db:env && cat .env.local`
Expected: six non-empty variables.

- [ ] **Step 3: Write the integration test harness**

`tests/integration/env.ts`:
```ts
import { execSync } from 'node:child_process'

// Populate process.env from the running local Supabase stack.
const out = execSync('npx supabase status -o env', { encoding: 'utf8' })
const env: Record<string, string> = {}
for (const line of out.split('\n')) {
  const m = /^([A-Z0-9_]+)="?(.*?)"?$/.exec(line.trim())
  if (m) env[m[1]] = m[2]
}
process.env.SUPABASE_URL ??= env.API_URL
process.env.SUPABASE_SERVICE_ROLE_KEY ??= env.SERVICE_ROLE_KEY ?? env.SECRET_KEY
process.env.DATABASE_URL ??= env.DB_URL
```

`tests/integration/helpers.ts`:
```ts
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'

export const sql = postgres(process.env.DATABASE_URL!, { max: 2 })

/** Like `sql` but returns a plain array (postgres' RowList carries extra props that break toEqual). */
export async function q<T extends Record<string, unknown> = Record<string, unknown>>(
  strings: TemplateStringsArray, ...values: unknown[]
): Promise<T[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = await (sql as any)(strings, ...values)
  return [...rows].map((r) => ({ ...r })) as T[]
}
export const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})

/** Empties every data table; keeps seeded seasons/settings. */
export async function resetData(): Promise<void> {
  await sql`truncate change_entries, meal_choices, changes, meal_guests, persons cascade`
}

export async function createPerson(name = 'Test Person', group: string | null = null): Promise<string> {
  const [row] = await sql`
    insert into persons (full_name, group_name, token_hash)
    values (${name}, ${group}, ${crypto.randomUUID()})
    returning id`
  return row.id as string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function rpc<T = any>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supa.rpc(fn, args)
  if (error) throw new Error(`${fn}: ${error.message}`)
  return data as T
}
```

- [ ] **Step 4: Write the failing integration test**

`tests/integration/schema.test.ts`:
```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { q, resetData, rpc, sql } from './helpers'

beforeAll(resetData)
afterAll(() => sql.end())

describe('season_default (seeded: 10-01→06-30 present, 07-01→09-30 absent)', () => {
  it.each([
    ['2026-10-15', 'lunch', true],
    ['2026-01-15', 'dinner', true], // year wrap
    ['2026-06-30', 'lunch', true],
    ['2026-07-01', 'lunch', false],
    ['2026-09-30', 'dinner', false],
    ['2026-10-01', 'lunch', true],
  ])('%s %s → %s', async (date, meal, expected) => {
    expect(await rpc('season_default', { p_date: date, p_meal: meal })).toBe(expected)
  })

  it('one-off rows win over recurring rows, and the narrowest one-off wins', async () => {
    await sql`insert into season_defaults (label, start_date, end_date, lunch_default, dinner_default)
              values ('Novembre', '2026-11-01', '2026-11-30', true, true),
                     ('Ritiro', '2026-11-10', '2026-11-14', false, true)`
    try {
      expect(await rpc('season_default', { p_date: '2026-11-12', p_meal: 'lunch' })).toBe(false)
      expect(await rpc('season_default', { p_date: '2026-11-12', p_meal: 'dinner' })).toBe(true)
      expect(await rpc('season_default', { p_date: '2026-11-15', p_meal: 'lunch' })).toBe(true)
    } finally {
      await sql`delete from season_defaults where start_date is not null`
    }
  })
})

describe('is_locked (settings: 10:00 / 10:00)', () => {
  it.each([
    ['2026-09-13', 'lunch', '2026-09-13T07:59:00Z', false],
    ['2026-09-13', 'lunch', '2026-09-13T08:00:00Z', true], // 10:00 CEST
    ['2026-09-12', 'dinner', '2026-09-13T00:00:00Z', true],
    ['2026-09-14', 'lunch', '2026-09-13T23:00:00Z', false],
    ['2026-01-13', 'dinner', '2026-01-13T09:00:00Z', true], // 10:00 CET
  ])('%s %s at %s → %s', async (date, meal, now, expected) => {
    expect(await rpc('is_locked', { p_date: date, p_meal: meal, p_now: now })).toBe(expected)
  })
})

describe('interval_cells', () => {
  it('expands meal-to-meal', async () => {
    const rows = await rpc<{ date: string; meal: string }[]>('interval_cells', {
      p_start_date: '2026-10-20', p_start_meal: 'dinner', p_end_date: '2026-10-21', p_end_meal: 'lunch',
    })
    expect(rows).toEqual([
      { date: '2026-10-20', meal: 'dinner' },
      { date: '2026-10-21', meal: 'lunch' },
    ])
  })
})

describe('RLS', () => {
  it('is enabled on every table', async () => {
    const rows = await q`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`
    expect(rows.map((r) => r.relname)).toEqual([])
  })
})
```

- [ ] **Step 5: Run to verify it fails**

Run: `npm run test:integration`
Expected: FAIL — `relation "season_defaults" does not exist` / `function season_default does not exist`.

- [ ] **Step 6: Write the schema migration**

`supabase/migrations/20260913000001_schema.sql`:
```sql
create extension if not exists pgcrypto;

create type meal_t as enum ('lunch', 'dinner');
create type actor_t as enum ('member', 'admin');
create type change_kind_t as enum ('toggle', 'interval', 'admin_edit', 'undo');

create table persons (
  id          uuid primary key default gen_random_uuid(),
  full_name   text not null,
  group_name  text,
  notes       text,
  active      boolean not null default true,
  token_hash  text not null unique,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table season_defaults (
  id             uuid primary key default gen_random_uuid(),
  label          text not null,
  start_md       char(5),
  end_md         char(5),
  start_date     date,
  end_date       date,
  lunch_default  boolean not null,
  dinner_default boolean not null,
  check ((start_md is null) = (end_md is null)),
  check ((start_date is null) = (end_date is null)),
  check ((start_md is null) <> (start_date is null)),
  check (start_date is null or start_date <= end_date),
  check (start_md is null or (start_md ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' and end_md ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'))
);

create table settings (
  key   text primary key,
  value jsonb not null
);

create table changes (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references persons(id),
  actor         actor_t not null,
  actor_user_id uuid,
  kind          change_kind_t not null,
  start_date    date not null,
  start_meal    meal_t not null,
  end_date      date not null,
  end_meal      meal_t not null,
  state         boolean not null,
  created_at    timestamptz not null default now(),
  undone_by     uuid references changes(id)
);
create index changes_person_created_idx on changes (person_id, created_at desc);
create index changes_created_idx on changes (created_at desc);

create table meal_choices (
  person_id uuid not null references persons(id),
  date      date not null,
  meal      meal_t not null,
  present   boolean not null,
  change_id uuid not null references changes(id),
  primary key (person_id, date, meal)
);
create index meal_choices_date_idx on meal_choices (date);

create table change_entries (
  change_id    uuid not null references changes(id),
  person_id    uuid not null references persons(id),
  date         date not null,
  meal         meal_t not null,
  prev_present boolean,
  new_present  boolean,
  primary key (change_id, person_id, date, meal)
);
create index change_entries_cell_idx on change_entries (person_id, date, meal);

create table meal_guests (
  date       date not null,
  meal       meal_t not null,
  count      int not null check (count >= 0),
  note       text,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (date, meal)
);

alter table persons         enable row level security;
alter table admins          enable row level security;
alter table season_defaults enable row level security;
alter table settings        enable row level security;
alter table changes         enable row level security;
alter table meal_choices    enable row level security;
alter table change_entries  enable row level security;
alter table meal_guests     enable row level security;

create or replace function meal_ord(m meal_t) returns int
language sql immutable as $$ select case when m = 'lunch' then 0 else 1 end $$;

-- Resolution: one-off row (narrowest) → recurring row (MM-DD, may wrap the year) → present.
create or replace function season_default(p_date date, p_meal meal_t) returns boolean
language sql stable as $$
  select coalesce(
    (select case when p_meal = 'lunch' then lunch_default else dinner_default end
       from season_defaults
      where start_date is not null and p_date between start_date and end_date
      order by (end_date - start_date) asc, start_date desc
      limit 1),
    (select case when p_meal = 'lunch' then lunch_default else dinner_default end
       from season_defaults
      where start_md is not null and (
        case when start_md <= end_md
             then to_char(p_date, 'MM-DD') between start_md and end_md
             else to_char(p_date, 'MM-DD') >= start_md or to_char(p_date, 'MM-DD') <= end_md
        end)
      order by start_md
      limit 1),
    true);
$$;

create or replace function is_locked(p_date date, p_meal meal_t, p_now timestamptz default now()) returns boolean
language plpgsql stable as $$
declare
  v_local  timestamp := p_now at time zone 'Europe/Rome';
  v_today  date := v_local::date;
  v_cutoff time;
begin
  select (value #>> '{}')::time into v_cutoff
    from settings
   where key = case when p_meal = 'lunch' then 'lunch_cutoff' else 'dinner_cutoff' end;
  if v_cutoff is null then v_cutoff := time '10:00'; end if;
  return p_date < v_today or (p_date = v_today and v_local::time >= v_cutoff);
end $$;

-- Every meal between (start_date, start_meal) and (end_date, end_meal), inclusive.
create or replace function interval_cells(p_start_date date, p_start_meal meal_t, p_end_date date, p_end_meal meal_t)
returns table (date date, meal meal_t)
language sql immutable as $$
  select d::date, m
    from generate_series(p_start_date, p_end_date, interval '1 day') d
   cross join unnest(enum_range(null::meal_t)) m
   where (d::date - date '1970-01-01') * 2 + meal_ord(m)
         between (p_start_date - date '1970-01-01') * 2 + meal_ord(p_start_meal)
             and (p_end_date   - date '1970-01-01') * 2 + meal_ord(p_end_meal)
   order by 1, meal_ord(m);
$$;

revoke all on all tables in schema public from anon, authenticated;
revoke execute on all functions in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
```

`supabase/seed.sql`:
```sql
insert into season_defaults (label, start_md, end_md, lunch_default, dinner_default) values
  ('Anno',   '10-01', '06-30', true,  true),
  ('Estate', '07-01', '09-30', false, false);

insert into settings (key, value) values
  ('lunch_cutoff',  '"10:00"'),
  ('dinner_cutoff', '"10:00"');
```

- [ ] **Step 7: Apply and run the integration tests**

Run: `npm run db:reset && npm run test:integration`
Expected: `db reset` applies the migration and seed without errors; all schema tests PASS.

- [ ] **Step 8: Commit**

```bash
git add supabase scripts/local-env.sh tests/integration
git commit -m "feat: database schema, seasons/cutoff functions, integration test harness"
```

---

### Task 6: Postgres functions — `effective_presence`, `day_roster`, `apply_change`, `undo_change`

**Files:**
- Create: `supabase/migrations/20260913000002_changes.sql`
- Test: `tests/integration/changes.test.ts`

**Interfaces:**
- Consumes: Task 5 schema and functions.
- Produces:
  - `effective_presence(p_person uuid, p_from date, p_to date) → table(date, meal, present, explicit, default_present)`
  - `day_roster(p_date date) → table(person_id, full_name, group_name, lunch_present, lunch_explicit, dinner_present, dinner_explicit)` (active persons only, ordered by group then name)
  - `apply_change(p_person, p_actor, p_actor_user, p_kind, p_start_date, p_start_meal, p_end_date, p_end_meal, p_state, p_now default now()) → jsonb` = `{change_id, overwritten:[{date, meal, prev_present}]}` or `{error:'locked', locked:[{date, meal}]}` or `{error:'invalid_interval'|'too_long'}`
  - `undo_change(p_change uuid, p_person uuid, p_now default now()) → jsonb` = `{change_id}` or `{error: 'not_found'|'already_undone'|'not_undoable'|'too_old'|'superseded'}`

- [ ] **Step 1: Write the failing integration tests**

`tests/integration/changes.test.ts`:
```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createPerson, q, resetData, rpc, sql } from './helpers'

// 2026-10-01 08:00 Rome (CEST) → nothing on/after 2026-10-01 lunch is locked.
const NOW = '2026-10-01T06:00:00Z'
const base = { p_actor: 'member', p_actor_user: null, p_now: NOW }

async function apply(person: string, s: string, sm: string, e: string, em: string, state: boolean, extra: Record<string, unknown> = {}) {
  return rpc('apply_change', { ...base, p_person: person, p_kind: s === e && sm === em ? 'toggle' : 'interval',
    p_start_date: s, p_start_meal: sm, p_end_date: e, p_end_meal: em, p_state: state, ...extra })
}
async function choices(person: string) {
  return sql`select date::text, meal::text, present from meal_choices where person_id = ${person} order by date, meal_ord(meal)`
}

afterAll(() => sql.end())
beforeEach(resetData)

describe('apply_change', () => {
  it('stores only exceptions and returns no overwrites for a fresh interval', async () => {
    const p = await createPerson()
    const r = await apply(p, '2026-10-20', 'dinner', '2026-10-21', 'lunch', false)
    expect(r.overwritten).toEqual([])
    expect(typeof r.change_id).toBe('string')
    expect(await choices(p)).toEqual([
      { date: '2026-10-20', meal: 'dinner', present: false },
      { date: '2026-10-21', meal: 'lunch', present: false },
    ])
    const entries = await q`select prev_present, new_present from change_entries where change_id = ${r.change_id}`
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({ prev_present: null, new_present: false })
  })

  it('is a no-op when the state already equals the effective value', async () => {
    const p = await createPerson()
    const r = await apply(p, '2026-10-20', 'lunch', '2026-10-20', 'dinner', true) // October: default present
    expect(await choices(p)).toEqual([])
    expect(await q`select count(*)::int as n from change_entries where change_id = ${r.change_id}`).toEqual([{ n: 0 }])
  })

  it('reports overwritten explicit choices and removes rows that return to the default', async () => {
    const p = await createPerson()
    await apply(p, '2026-08-08', 'lunch', '2026-08-08', 'lunch', true) // summer: explicit present
    expect(await choices(p)).toEqual([{ date: '2026-08-08', meal: 'lunch', present: true }])
    const r = await apply(p, '2026-08-05', 'lunch', '2026-08-10', 'dinner', false)
    expect(r.overwritten).toEqual([{ date: '2026-08-08', meal: 'lunch', prev_present: true }])
    expect(await choices(p)).toEqual([]) // absent == summer default → no rows
    const entries = await q`select date::text, prev_present, new_present from change_entries where change_id = ${r.change_id}`
    expect(entries).toEqual([{ date: '2026-08-08', prev_present: true, new_present: null }])
  })

  it('rejects locked cells for members and lists them, but lets admins through', async () => {
    const p = await createPerson()
    const at11 = '2026-10-14T09:00:00Z' // 11:00 CEST
    const r = await apply(p, '2026-10-14', 'lunch', '2026-10-14', 'dinner', false, { p_now: at11 })
    expect(r).toEqual({ error: 'locked', locked: [{ date: '2026-10-14', meal: 'lunch' }, { date: '2026-10-14', meal: 'dinner' }] })
    expect(await choices(p)).toEqual([])
    expect(await q`select count(*)::int as n from changes`).toEqual([{ n: 0 }])

    const ok = await apply(p, '2026-10-14', 'lunch', '2026-10-14', 'lunch', false,
      { p_now: at11, p_actor: 'admin', p_actor_user: '00000000-0000-0000-0000-000000000001', p_kind: 'admin_edit' })
    expect(ok.overwritten).toEqual([])
    expect(await choices(p)).toEqual([{ date: '2026-10-14', meal: 'lunch', present: false }])
  })

  it('rejects an inverted or overlong interval', async () => {
    const p = await createPerson()
    expect(await apply(p, '2026-10-20', 'dinner', '2026-10-20', 'lunch', false)).toEqual({ error: 'invalid_interval' })
    expect(await apply(p, '2026-01-01', 'lunch', '2027-12-31', 'dinner', false)).toEqual({ error: 'too_long' })
  })
})

describe('undo_change', () => {
  it('restores previous values and marks the change undone', async () => {
    const p = await createPerson()
    await apply(p, '2026-08-08', 'lunch', '2026-08-08', 'lunch', true)
    const r = await apply(p, '2026-08-07', 'lunch', '2026-08-09', 'dinner', false)
    const u = await rpc('undo_change', { p_change: r.change_id, p_person: p, p_now: NOW })
    expect(typeof u.change_id).toBe('string')
    expect(await choices(p)).toEqual([{ date: '2026-08-08', meal: 'lunch', present: true }])
    const [orig] = await q`select undone_by, kind::text from changes where id = ${r.change_id}`
    expect(orig.undone_by).toBe(u.change_id)
    const [undo] = await q`select kind::text from changes where id = ${u.change_id}`
    expect(undo.kind).toBe('undo')
  })

  it('refuses a second undo, an undo of an undo, and admin changes', async () => {
    const p = await createPerson()
    const r = await apply(p, '2026-10-20', 'lunch', '2026-10-20', 'lunch', false)
    const u = await rpc('undo_change', { p_change: r.change_id, p_person: p, p_now: NOW })
    expect(await rpc('undo_change', { p_change: r.change_id, p_person: p, p_now: NOW })).toEqual({ error: 'already_undone' })
    expect(await rpc('undo_change', { p_change: u.change_id, p_person: p, p_now: NOW })).toEqual({ error: 'not_undoable' })
    const a = await apply(p, '2026-10-21', 'lunch', '2026-10-21', 'lunch', false,
      { p_actor: 'admin', p_actor_user: '00000000-0000-0000-0000-000000000001', p_kind: 'admin_edit' })
    expect(await rpc('undo_change', { p_change: a.change_id, p_person: p, p_now: NOW })).toEqual({ error: 'not_undoable' })
  })

  it('refuses when a later change touched one of its cells', async () => {
    const p = await createPerson()
    const r = await apply(p, '2026-10-20', 'lunch', '2026-10-21', 'dinner', false)
    await apply(p, '2026-10-21', 'dinner', '2026-10-21', 'dinner', true, { p_now: '2026-10-01T06:01:00Z' })
    expect(await rpc('undo_change', { p_change: r.change_id, p_person: p, p_now: NOW })).toEqual({ error: 'superseded' })
  })

  it('refuses after 24 hours and for another person', async () => {
    const p = await createPerson()
    const q = await createPerson('Other')
    const r = await apply(p, '2026-10-20', 'lunch', '2026-10-20', 'lunch', false)
    expect(await rpc('undo_change', { p_change: r.change_id, p_person: q, p_now: NOW })).toEqual({ error: 'not_found' })
    expect(await rpc('undo_change', { p_change: r.change_id, p_person: p, p_now: '2026-10-02T06:01:00Z' })).toEqual({ error: 'too_old' })
  })
})

describe('effective_presence and day_roster', () => {
  it('resolves explicit → season default per cell', async () => {
    const p = await createPerson('Anna', 'Suore')
    await apply(p, '2026-10-20', 'dinner', '2026-10-20', 'dinner', false)
    const rows = await rpc('effective_presence', { p_person: p, p_from: '2026-10-20', p_to: '2026-10-21' })
    expect(rows).toEqual([
      { date: '2026-10-20', meal: 'lunch', present: true, explicit: false, default_present: true },
      { date: '2026-10-20', meal: 'dinner', present: false, explicit: true, default_present: true },
      { date: '2026-10-21', meal: 'lunch', present: true, explicit: false, default_present: true },
      { date: '2026-10-21', meal: 'dinner', present: true, explicit: false, default_present: true },
    ])
  })

  it('lists active people with per-meal flags', async () => {
    const a = await createPerson('Anna', 'Suore')
    const b = await createPerson('Bruno', 'Sacerdoti')
    await sql`insert into persons (full_name, token_hash, active) values ('Inattivo', 'x', false)`
    await apply(a, '2026-10-20', 'lunch', '2026-10-20', 'lunch', false)
    const rows = await rpc('day_roster', { p_date: '2026-10-20' })
    expect(rows).toEqual([
      { person_id: b, full_name: 'Bruno', group_name: 'Sacerdoti', lunch_present: true, lunch_explicit: false, dinner_present: true, dinner_explicit: false },
      { person_id: a, full_name: 'Anna', group_name: 'Suore', lunch_present: false, lunch_explicit: true, dinner_present: true, dinner_explicit: false },
    ])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:integration -- changes`
Expected: FAIL — `function apply_change(...) does not exist`.

- [ ] **Step 3: Write the migration**

`supabase/migrations/20260913000002_changes.sql`:
```sql
create or replace function effective_presence(p_person uuid, p_from date, p_to date)
returns table (date date, meal meal_t, present boolean, explicit boolean, default_present boolean)
language sql stable as $$
  select d::date,
         m,
         coalesce(mc.present, season_default(d::date, m)),
         mc.present is not null,
         season_default(d::date, m)
    from generate_series(p_from, p_to, interval '1 day') d
   cross join unnest(enum_range(null::meal_t)) m
    left join meal_choices mc on mc.person_id = p_person and mc.date = d::date and mc.meal = m
   order by 1, meal_ord(m);
$$;

create or replace function day_roster(p_date date)
returns table (person_id uuid, full_name text, group_name text,
               lunch_present boolean, lunch_explicit boolean,
               dinner_present boolean, dinner_explicit boolean)
language sql stable as $$
  select p.id, p.full_name, p.group_name,
         coalesce(l.present,  season_default(p_date, 'lunch')),  l.present  is not null,
         coalesce(dn.present, season_default(p_date, 'dinner')), dn.present is not null
    from persons p
    left join meal_choices l  on l.person_id  = p.id and l.date  = p_date and l.meal  = 'lunch'
    left join meal_choices dn on dn.person_id = p.id and dn.date = p_date and dn.meal = 'dinner'
   where p.active
   order by p.group_name nulls last, p.full_name;
$$;

-- One transaction: validate, lock-check (members only), log entries, upsert/delete exception rows.
create or replace function apply_change(
  p_person uuid, p_actor actor_t, p_actor_user uuid, p_kind change_kind_t,
  p_start_date date, p_start_meal meal_t, p_end_date date, p_end_meal meal_t,
  p_state boolean, p_now timestamptz default now()
) returns jsonb
language plpgsql as $$
declare
  v_start_key  int := (p_start_date - date '1970-01-01') * 2 + meal_ord(p_start_meal);
  v_end_key    int := (p_end_date   - date '1970-01-01') * 2 + meal_ord(p_end_meal);
  v_change     uuid;
  v_locked     jsonb;
  v_overwritten jsonb;
  v_new        boolean;
  r            record;
begin
  if v_end_key < v_start_key then
    return jsonb_build_object('error', 'invalid_interval');
  end if;
  if v_end_key - v_start_key + 1 > 800 then
    return jsonb_build_object('error', 'too_long');
  end if;

  if p_actor = 'member' then
    select jsonb_agg(jsonb_build_object('date', c.date, 'meal', c.meal) order by c.date, meal_ord(c.meal))
      into v_locked
      from interval_cells(p_start_date, p_start_meal, p_end_date, p_end_meal) c
     where is_locked(c.date, c.meal, p_now);
    if v_locked is not null then
      return jsonb_build_object('error', 'locked', 'locked', v_locked);
    end if;
  end if;

  insert into changes (person_id, actor, actor_user_id, kind, start_date, start_meal, end_date, end_meal, state, created_at)
  values (p_person, p_actor, p_actor_user, p_kind, p_start_date, p_start_meal, p_end_date, p_end_meal, p_state, p_now)
  returning id into v_change;

  for r in
    select c.date, c.meal, mc.present as explicit_present, season_default(c.date, c.meal) as def
      from interval_cells(p_start_date, p_start_meal, p_end_date, p_end_meal) c
      left join meal_choices mc on mc.person_id = p_person and mc.date = c.date and mc.meal = c.meal
     order by c.date, meal_ord(c.meal)
  loop
    if coalesce(r.explicit_present, r.def) = p_state then
      continue;
    end if;
    v_new := case when p_state = r.def then null else p_state end;

    insert into change_entries (change_id, person_id, date, meal, prev_present, new_present)
    values (v_change, p_person, r.date, r.meal, r.explicit_present, v_new);

    if v_new is null then
      delete from meal_choices where person_id = p_person and date = r.date and meal = r.meal;
    else
      insert into meal_choices (person_id, date, meal, present, change_id)
      values (p_person, r.date, r.meal, v_new, v_change)
      on conflict (person_id, date, meal) do update set present = excluded.present, change_id = excluded.change_id;
    end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object('date', date, 'meal', meal, 'prev_present', prev_present)
                            order by date, meal_ord(meal)), '[]'::jsonb)
    into v_overwritten
    from change_entries
   where change_id = v_change and prev_present is not null;

  return jsonb_build_object('change_id', v_change, 'overwritten', v_overwritten);
end $$;

create or replace function undo_change(p_change uuid, p_person uuid, p_now timestamptz default now())
returns jsonb
language plpgsql as $$
declare
  v_orig changes%rowtype;
  v_undo uuid;
  r      record;
begin
  select * into v_orig from changes where id = p_change and person_id = p_person;
  if not found then return jsonb_build_object('error', 'not_found'); end if;
  if v_orig.undone_by is not null then return jsonb_build_object('error', 'already_undone'); end if;
  if v_orig.kind = 'undo' or v_orig.actor <> 'member' then return jsonb_build_object('error', 'not_undoable'); end if;
  if p_now - v_orig.created_at > interval '24 hours' then return jsonb_build_object('error', 'too_old'); end if;
  if exists (
    select 1
      from change_entries e
      join changes c on c.id = e.change_id
     where e.person_id = p_person
       and c.created_at > v_orig.created_at
       and (e.date, e.meal) in (select date, meal from change_entries where change_id = p_change)
  ) then
    return jsonb_build_object('error', 'superseded');
  end if;

  insert into changes (person_id, actor, actor_user_id, kind, start_date, start_meal, end_date, end_meal, state, created_at)
  values (p_person, v_orig.actor, v_orig.actor_user_id, 'undo',
          v_orig.start_date, v_orig.start_meal, v_orig.end_date, v_orig.end_meal, not v_orig.state, p_now)
  returning id into v_undo;

  for r in select * from change_entries where change_id = p_change loop
    insert into change_entries (change_id, person_id, date, meal, prev_present, new_present)
    values (v_undo, p_person, r.date, r.meal, r.new_present, r.prev_present);
    if r.prev_present is null then
      delete from meal_choices where person_id = p_person and date = r.date and meal = r.meal;
    else
      insert into meal_choices (person_id, date, meal, present, change_id)
      values (p_person, r.date, r.meal, r.prev_present, v_undo)
      on conflict (person_id, date, meal) do update set present = excluded.present, change_id = excluded.change_id;
    end if;
  end loop;

  update changes set undone_by = v_undo where id = p_change;
  return jsonb_build_object('change_id', v_undo);
end $$;

revoke execute on all functions in schema public from anon, authenticated;
```

- [ ] **Step 4: Apply and run**

Run: `npm run db:reset && npm run test:integration`
Expected: all schema and changes tests PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260913000002_changes.sql tests/integration/changes.test.ts
git commit -m "feat: apply_change/undo_change and presence read functions"
```

---

### Task 7: Member identity — tokens, cookie, `/p/[token]`, invalid-link page, proxy refresh

**Files:**
- Create: `src/lib/cookie.ts`, `src/server/token.ts`, `src/server/db.ts`, `src/server/auth.ts`, `src/app/p/[token]/route.ts`, `src/app/link-non-valido/page.tsx`, `src/proxy.ts`
- Modify: `src/app/layout.tsx`, `src/app/globals.css`
- Test: `src/server/token.test.ts`

**Interfaces:**
- Produces: `MEMBER_COOKIE = 'psrm_member'`, `memberCookieOptions()`; `generateToken()`, `hashToken(token)`, `isTokenShape(s)`, `personLink(baseUrl, token)`; `db` (service-role client); `interface Person { id; full_name; group_name }`, `findPersonByToken(token)`, `getPersonFromCookie()`.

- [ ] **Step 1: Write the failing test**

`src/server/token.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { generateToken, hashToken, isTokenShape, personLink } from './token'

describe('token', () => {
  it('generates 43-char base64url tokens that are unique', () => {
    const a = generateToken()
    const b = generateToken()
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(a).not.toBe(b)
    expect(isTokenShape(a)).toBe(true)
    expect(isTokenShape('short')).toBe(false)
  })
  it('hashes deterministically with sha256 hex', () => {
    expect(hashToken('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  })
  it('builds the personal link without double slashes', () => {
    expect(personLink('https://pasti.example.org/', 'tok')).toBe('https://pasti.example.org/p/tok')
    expect(personLink('http://localhost:3000', 'tok')).toBe('http://localhost:3000/p/tok')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- token`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the pure modules**

`src/lib/cookie.ts` (no Node-only imports — also used by `proxy.ts`):
```ts
export const MEMBER_COOKIE = 'psrm_member'

export function memberCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  }
}
```

`src/server/token.ts`:
```ts
import { createHash, randomBytes } from 'node:crypto'

export function generateToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function isTokenShape(s: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(s)
}

export function personLink(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/p/${token}`
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Add the service-role client and member auth helpers**

`src/server/db.ts`:
```ts
import 'server-only'
import { createClient } from '@supabase/supabase-js'

/** Service-role client. Never import from client components. */
export const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})
```

`src/server/auth.ts`:
```ts
import 'server-only'
import { cookies } from 'next/headers'
import { MEMBER_COOKIE } from '@/lib/cookie'
import { db } from './db'
import { hashToken, isTokenShape } from './token'

export interface Person {
  id: string
  full_name: string
  group_name: string | null
}

export async function findPersonByToken(token: string): Promise<Person | null> {
  if (!isTokenShape(token)) return null
  const { data } = await db
    .from('persons')
    .select('id, full_name, group_name')
    .eq('token_hash', hashToken(token))
    .eq('active', true)
    .maybeSingle()
  return (data as Person | null) ?? null
}

export async function getPersonFromCookie(): Promise<Person | null> {
  const store = await cookies()
  const token = store.get(MEMBER_COOKIE)?.value
  if (!token) return null
  return findPersonByToken(token)
}
```

- [ ] **Step 6: Add the token route, invalid-link page, proxy, and base layout**

`src/app/p/[token]/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { MEMBER_COOKIE, memberCookieOptions } from '@/lib/cookie'
import { findPersonByToken } from '@/server/auth'

export async function GET(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params
  const person = await findPersonByToken(token)
  if (!person) return NextResponse.redirect(new URL('/link-non-valido', req.url))
  const res = NextResponse.redirect(new URL('/', req.url))
  res.cookies.set(MEMBER_COOKIE, token, memberCookieOptions())
  return res
}
```

`src/app/link-non-valido/page.tsx`:
```tsx
import { t } from '@/i18n/it'

export default function InvalidLinkPage() {
  return (
    <main className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-2xl font-semibold">{t.invalidLink.title}</h1>
      <p className="mt-3 text-neutral-600">{t.invalidLink.body}</p>
    </main>
  )
}
```

`src/proxy.ts` (member cookie refresh only; Task 11 adds the admin guard):
```ts
import { NextResponse, type NextRequest } from 'next/server'
import { MEMBER_COOKIE, memberCookieOptions } from '@/lib/cookie'

export async function proxy(request: NextRequest) {
  const res = NextResponse.next()
  const token = request.cookies.get(MEMBER_COOKIE)?.value
  if (token) res.cookies.set(MEMBER_COOKIE, token, memberCookieOptions())
  return res
}

export const config = { matcher: ['/', '/periodo/:path*'] }
```

Replace `src/app/layout.tsx`:
```tsx
import type { Metadata, Viewport } from 'next'
import { t } from '@/i18n/it'
import './globals.css'

export const metadata: Metadata = {
  title: t.appName,
  description: 'Presenze ai pasti',
}

export const viewport: Viewport = { themeColor: '#1e3a8a', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">{children}</body>
    </html>
  )
}
```

Replace `src/app/globals.css`:
```css
@import "tailwindcss";

@media print {
  .no-print { display: none !important; }
}
```

Replace `src/app/page.tsx` with a placeholder that Task 8 completes:
```tsx
import { redirect } from 'next/navigation'
import { getPersonFromCookie } from '@/server/auth'

export default async function HomePage() {
  const person = await getPersonFromCookie()
  if (!person) redirect('/link-non-valido')
  return <main className="p-6">{person.full_name}</main>
}
```
Delete `public/*.svg` scaffold assets and the scaffold's `src/app/favicon.ico` only if present and unwanted (keep favicon).

- [ ] **Step 7: Verify manually against the local stack**

```bash
npm run db:env
npx tsx -e "import {generateToken,hashToken} from './src/server/token'; const t=generateToken(); console.log('TOKEN', t); console.log('HASH', hashToken(t))"
```
Insert a person with the printed hash: `npx supabase db query` is not available; use psql via the DB URL:
```bash
source <(grep DATABASE_URL .env.local | sed 's/^/export /')
psql "$DATABASE_URL" -c "insert into persons (full_name, token_hash) values ('Prova Manuale', '<HASH>')"
npm run dev
```
Open `http://localhost:3000/p/<TOKEN>` → redirected to `/` showing "Prova Manuale". Open `http://localhost:3000/p/wrong` → "Link non valido". (If `psql` is missing: `docker exec -i supabase_db_PSRM-pasti psql -U postgres -c "..."` — container name from `docker ps`.)

- [ ] **Step 8: Lint, typecheck, commit**

Run: `npm run lint && npx tsc --noEmit && npm test`
```bash
git add -A
git commit -m "feat: member token auth, cookie and invalid-link page"
```

---

### Task 8: Member home — next 30 days with toggles, `POST /api/choices`

**Files:**
- Create: `src/server/settings.ts`, `src/server/changes.ts`, `src/app/api/choices/schema.ts`, `src/app/api/choices/route.ts`, `src/components/Pill.tsx`, `src/components/Toast.tsx`, `src/components/DayList.tsx`
- Modify: `src/app/page.tsx`
- Test: `src/app/api/choices/schema.test.ts`

**Interfaces:**
- Consumes: `getPersonFromCookie`, `db`, `isLocked`, `firstUnlockedCell`, `romeParts`, `addDays`, `expandInterval`, `t`.
- Produces: `getSettings(): Promise<CutoffSettings>`; `applyChange(params): Promise<ApplyOk | ApplyErr>`, `undoChange(changeId, personId): Promise<UndoResult>`; `choiceSchema`; `DayRow`, `CellState` types; `DayList` component; `Toast` (`useToast` hook + `<Toast>`).
- API contract: `POST /api/choices` body `{start_date, start_meal, end_date, end_meal, state}` → `200 {change_id, overwritten}` | `400 {error}` | `401` | `409 {error:'locked', locked:[...]}`.

- [ ] **Step 1: Write the failing schema test**

`src/app/api/choices/schema.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { choiceSchema } from './schema'

describe('choiceSchema', () => {
  it('accepts a valid body', () => {
    const r = choiceSchema.safeParse({ start_date: '2026-10-20', start_meal: 'lunch', end_date: '2026-10-21', end_meal: 'dinner', state: false })
    expect(r.success).toBe(true)
  })
  it('rejects bad dates, meals and missing state', () => {
    expect(choiceSchema.safeParse({ start_date: '2026-02-30', start_meal: 'lunch', end_date: '2026-10-21', end_meal: 'dinner', state: false }).success).toBe(false)
    expect(choiceSchema.safeParse({ start_date: '2026-10-20', start_meal: 'brunch', end_date: '2026-10-21', end_meal: 'dinner', state: false }).success).toBe(false)
    expect(choiceSchema.safeParse({ start_date: '2026-10-20', start_meal: 'lunch', end_date: '2026-10-21', end_meal: 'dinner' }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- schema`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement schema, settings, and change wrappers**

`src/app/api/choices/schema.ts`:
```ts
import { z } from 'zod'
import { isIsoDate } from '@/lib/dates'

export const isoDateSchema = z.string().refine(isIsoDate, 'invalid date')
export const mealSchema = z.enum(['lunch', 'dinner'])

export const choiceSchema = z.object({
  start_date: isoDateSchema,
  start_meal: mealSchema,
  end_date: isoDateSchema,
  end_meal: mealSchema,
  state: z.boolean(),
})
export type ChoiceInput = z.infer<typeof choiceSchema>
```

`src/server/settings.ts`:
```ts
import 'server-only'
import { type CutoffSettings, DEFAULT_SETTINGS } from '@/lib/cutoff'
import { db } from './db'

export async function getSettings(): Promise<CutoffSettings> {
  const { data } = await db.from('settings').select('key, value').in('key', ['lunch_cutoff', 'dinner_cutoff'])
  const s: CutoffSettings = { ...DEFAULT_SETTINGS }
  for (const row of (data ?? []) as { key: keyof CutoffSettings; value: unknown }[]) {
    if (typeof row.value === 'string') s[row.key] = row.value
  }
  return s
}
```

`src/server/changes.ts`:
```ts
import 'server-only'
import type { Cell, IsoDate, Meal } from '@/lib/dates'
import { db } from './db'

export type Overwritten = Cell & { prev_present: boolean }
export type ApplyOk = { change_id: string; overwritten: Overwritten[] }
export type ApplyErr = { error: 'locked'; locked: Cell[] } | { error: 'invalid_interval' | 'too_long' }

export interface ApplyParams {
  personId: string
  actor: 'member' | 'admin'
  actorUserId: string | null
  kind: 'toggle' | 'interval' | 'admin_edit'
  startDate: IsoDate
  startMeal: Meal
  endDate: IsoDate
  endMeal: Meal
  state: boolean
}

export async function applyChange(p: ApplyParams): Promise<ApplyOk | ApplyErr> {
  const { data, error } = await db.rpc('apply_change', {
    p_person: p.personId,
    p_actor: p.actor,
    p_actor_user: p.actorUserId,
    p_kind: p.kind,
    p_start_date: p.startDate,
    p_start_meal: p.startMeal,
    p_end_date: p.endDate,
    p_end_meal: p.endMeal,
    p_state: p.state,
  })
  if (error) throw new Error(`apply_change: ${error.message}`)
  return data as ApplyOk | ApplyErr
}

export type UndoResult = { change_id: string } | { error: string }

export async function undoChange(changeId: string, personId: string): Promise<UndoResult> {
  const { data, error } = await db.rpc('undo_change', { p_change: changeId, p_person: personId })
  if (error) throw new Error(`undo_change: ${error.message}`)
  return data as UndoResult
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Add the route handler**

`src/app/api/choices/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { IntervalError, expandInterval } from '@/lib/interval'
import { getPersonFromCookie } from '@/server/auth'
import { applyChange } from '@/server/changes'
import { choiceSchema } from './schema'

export async function POST(req: Request) {
  const person = await getPersonFromCookie()
  if (!person) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const parsed = choiceSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body' }, { status: 400 })
  const b = parsed.data

  let cellCount: number
  try {
    cellCount = expandInterval(b.start_date, b.start_meal, b.end_date, b.end_meal).length
  } catch (e) {
    if (e instanceof IntervalError) return NextResponse.json({ error: e.code }, { status: 400 })
    throw e
  }

  const result = await applyChange({
    personId: person.id,
    actor: 'member',
    actorUserId: null,
    kind: cellCount === 1 ? 'toggle' : 'interval',
    startDate: b.start_date,
    startMeal: b.start_meal,
    endDate: b.end_date,
    endMeal: b.end_meal,
    state: b.state,
  })
  if ('error' in result) return NextResponse.json(result, { status: result.error === 'locked' ? 409 : 400 })
  return NextResponse.json(result)
}
```

- [ ] **Step 6: Add UI components**

`src/components/Toast.tsx`:
```tsx
'use client'
import { useCallback, useEffect, useState } from 'react'

export function useToast() {
  const [msg, setMsg] = useState<{ text: string; error: boolean } | null>(null)
  useEffect(() => {
    if (!msg) return
    const id = setTimeout(() => setMsg(null), 2500)
    return () => clearTimeout(id)
  }, [msg])
  const show = useCallback((text: string, error = false) => setMsg({ text, error }), [])
  return { msg, show }
}

export function Toast({ msg }: { msg: { text: string; error: boolean } | null }) {
  if (!msg) return null
  return (
    <div
      role="status"
      className={`fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full px-4 py-2 text-sm text-white shadow ${msg.error ? 'bg-red-600' : 'bg-neutral-800'}`}
    >
      {msg.text}
    </div>
  )
}
```

`src/components/Pill.tsx`:
```tsx
'use client'

export interface PillProps {
  label: string
  present: boolean
  explicit: boolean
  locked: boolean
  onToggle: () => void
}

export function Pill({ label, present, explicit, locked, onToggle }: PillProps) {
  const base = 'relative flex-1 rounded-full border-2 px-3 py-3 text-center text-sm font-medium transition'
  const look = present ? 'border-blue-800 bg-blue-800 text-white' : 'border-neutral-300 bg-white text-neutral-500'
  const state = locked ? 'cursor-not-allowed opacity-40' : 'active:scale-95'
  return (
    <button
      type="button"
      aria-pressed={present}
      aria-disabled={locked}
      disabled={locked}
      onClick={onToggle}
      className={`${base} ${look} ${state}`}
    >
      {label}
      {explicit && <span aria-hidden className="absolute right-2 top-1 h-2 w-2 rounded-full bg-amber-400" />}
    </button>
  )
}
```

`src/components/DayList.tsx`:
```tsx
'use client'
import { useState } from 'react'
import type { IsoDate, Meal } from '@/lib/dates'
import { mealName, t } from '@/i18n/it'
import { Pill } from './Pill'
import { Toast, useToast } from './Toast'

export interface CellState {
  present: boolean
  explicit: boolean
  locked: boolean
  defaultPresent: boolean
}
export interface DayRow {
  date: IsoDate
  label: string
  isToday: boolean
  lunch: CellState
  dinner: CellState
}

export function DayList({ rows: initial, cutoffs }: { rows: DayRow[]; cutoffs: { lunch: string; dinner: string } }) {
  const [rows, setRows] = useState(initial)
  const { msg, show } = useToast()

  async function toggle(date: IsoDate, meal: Meal) {
    const before = rows
    const row = rows.find((r) => r.date === date)!
    const cell = row[meal]
    if (cell.locked) return
    const next = !cell.present
    setRows(rows.map((r) => (r.date === date ? { ...r, [meal]: { ...cell, present: next, explicit: next !== cell.defaultPresent } } : r)))
    const res = await fetch('/api/choices', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ start_date: date, start_meal: meal, end_date: date, end_meal: meal, state: next }),
    })
    if (!res.ok) {
      setRows(before)
      show(res.status === 409 ? t.member.lockedError : t.member.saveError, true)
      return
    }
    show(t.member.saved)
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <div key={r.date} className="rounded-xl bg-white p-3 shadow-sm">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-medium capitalize">{r.label}</span>
            {r.isToday && (
              <span className="text-xs text-neutral-500">
                {t.member.today} · {t.member.lockedAt(r.lunch.locked && !r.dinner.locked ? cutoffs.dinner : cutoffs.lunch)}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Pill label={mealName.lunch} {...r.lunch} onToggle={() => toggle(r.date, 'lunch')} />
            <Pill label={mealName.dinner} {...r.dinner} onToggle={() => toggle(r.date, 'dinner')} />
          </div>
        </div>
      ))}
      <Toast msg={msg} />
    </div>
  )
}
```

- [ ] **Step 7: Build the member home page**

Replace `src/app/page.tsx`:
```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { formatDayLong, t } from '@/i18n/it'
import { isLocked } from '@/lib/cutoff'
import { type IsoDate, type Meal, addDays, romeParts } from '@/lib/dates'
import { getPersonFromCookie } from '@/server/auth'
import { db } from '@/server/db'
import { getSettings } from '@/server/settings'
import { type DayRow, DayList } from '@/components/DayList'

interface PresenceRow {
  date: IsoDate
  meal: Meal
  present: boolean
  explicit: boolean
  default_present: boolean
}

export default async function HomePage() {
  const person = await getPersonFromCookie()
  if (!person) redirect('/link-non-valido')

  const now = new Date()
  const today = romeParts(now).date
  const settings = await getSettings()
  const { data, error } = await db.rpc('effective_presence', { p_person: person.id, p_from: today, p_to: addDays(today, 29) })
  if (error) throw new Error(error.message)

  const byDate = new Map<IsoDate, DayRow>()
  for (const r of data as PresenceRow[]) {
    const row = byDate.get(r.date) ?? { date: r.date, label: formatDayLong(r.date), isToday: r.date === today, lunch: null!, dinner: null! }
    row[r.meal] = { present: r.present, explicit: r.explicit, locked: isLocked({ date: r.date, meal: r.meal }, now, settings), defaultPresent: r.default_present }
    byDate.set(r.date, row)
  }
  const rows = [...byDate.values()]
  const seasonPresent = rows[0]?.lunch.defaultPresent ?? true

  return (
    <main className="mx-auto max-w-md px-4 pb-28 pt-6">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold">{person.full_name}</h1>
        <p className="mt-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
          {seasonPresent ? t.member.seasonPresent : t.member.seasonAbsent} {t.member.explicitHint}
        </p>
      </header>
      <DayList rows={rows} cutoffs={{ lunch: settings.lunch_cutoff, dinner: settings.dinner_cutoff }} />
      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-neutral-50 p-4">
        <Link href="/periodo" className="block rounded-full bg-blue-800 py-4 text-center font-semibold text-white shadow-lg">
          {t.member.markPeriod}
        </Link>
      </div>
    </main>
  )
}
```

- [ ] **Step 8: Verify manually**

Run: `npm run dev`, open the personal link from Task 7. Expected: 30 rows; tapping a future pill flips it, shows "Salvato", the dot appears; reload keeps the state; today's row before 10:00 is editable, after 10:00 both pills are disabled; `curl -X POST localhost:3000/api/choices` without cookie → 401.

- [ ] **Step 9: Lint, typecheck, commit**

Run: `npm run lint && npx tsc --noEmit && npm test`
```bash
git add -A
git commit -m "feat: member 30-day presence list with toggles and choices API"
```

---

### Task 9: Interval picker, confirmation screen, undo

**Files:**
- Create: `src/components/IntervalForm.tsx`, `src/components/UndoButton.tsx`, `src/app/periodo/page.tsx`, `src/app/periodo/conferma/page.tsx`, `src/app/api/changes/[id]/undo/route.ts`
- Test: `src/components/intervalForm.logic.test.ts` (pure helper extracted from the form)

**Interfaces:**
- Consumes: `expandInterval`, `IntervalError`, `intervalSummary`, `firstUnlockedCell`, `getSettings`, `undoChange`, `t`.
- Produces: `validateInterval(input, min) → { cells, error }` in `src/components/intervalForm.logic.ts`; `POST /api/changes/[id]/undo` → `200 {change_id}` | `404` | `409 {error}`.

- [ ] **Step 1: Write the failing test for the form logic**

`src/components/intervalForm.logic.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { validateInterval } from './intervalForm.logic'

const min = { date: '2026-10-20', meal: 'dinner' as const }

describe('validateInterval', () => {
  it('returns cells for a valid interval at or after the minimum cell', () => {
    const r = validateInterval({ startDate: '2026-10-20', startMeal: 'dinner', endDate: '2026-10-21', endMeal: 'lunch' }, min)
    expect(r.error).toBeNull()
    expect(r.cells).toHaveLength(2)
  })
  it('flags a start before the minimum cell', () => {
    const r = validateInterval({ startDate: '2026-10-20', startMeal: 'lunch', endDate: '2026-10-21', endMeal: 'lunch' }, min)
    expect(r.error).toBe('start_too_early')
    expect(r.cells).toEqual([])
  })
  it('flags inverted intervals', () => {
    const r = validateInterval({ startDate: '2026-10-22', startMeal: 'lunch', endDate: '2026-10-21', endMeal: 'lunch' }, min)
    expect(r.error).toBe('invalid_interval')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- intervalForm`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the logic module**

`src/components/intervalForm.logic.ts`:
```ts
import { type Cell, type IsoDate, type Meal, compareCells } from '@/lib/dates'
import { IntervalError, expandInterval } from '@/lib/interval'

export interface IntervalInput {
  startDate: IsoDate
  startMeal: Meal
  endDate: IsoDate
  endMeal: Meal
}
export type IntervalIssue = 'start_too_early' | 'invalid_interval' | 'too_long' | null

export function validateInterval(input: IntervalInput, min: Cell): { cells: Cell[]; error: IntervalIssue } {
  if (compareCells({ date: input.startDate, meal: input.startMeal }, min) < 0) return { cells: [], error: 'start_too_early' }
  try {
    return { cells: expandInterval(input.startDate, input.startMeal, input.endDate, input.endMeal), error: null }
  } catch (e) {
    if (e instanceof IntervalError) return { cells: [], error: e.code }
    throw e
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Build the form component**

`src/components/IntervalForm.tsx`:
```tsx
'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { intervalSummary, mealName, t } from '@/i18n/it'
import type { Cell, Meal } from '@/lib/dates'
import { MEALS } from '@/lib/dates'
import { validateInterval } from './intervalForm.logic'
import { Toast, useToast } from './Toast'

const issueText: Record<string, string> = {
  start_too_early: t.period.startTooEarly,
  invalid_interval: t.period.invalidInterval,
  too_long: t.period.tooLong,
}

export function IntervalForm({ min }: { min: Cell }) {
  const router = useRouter()
  const { msg, show } = useToast()
  const [state, setState] = useState(false) // false = assente
  const [startDate, setStartDate] = useState(min.date)
  const [startMeal, setStartMeal] = useState<Meal>(min.meal)
  const [endDate, setEndDate] = useState(min.date)
  const [endMeal, setEndMeal] = useState<Meal>('dinner')
  const [busy, setBusy] = useState(false)

  const { cells, error } = validateInterval({ startDate, startMeal, endDate, endMeal }, min)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (error || busy) return
    setBusy(true)
    const res = await fetch('/api/choices', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ start_date: startDate, start_meal: startMeal, end_date: endDate, end_meal: endMeal, state }),
    })
    setBusy(false)
    if (!res.ok) {
      show(res.status === 409 ? t.period.lockedError : t.genericError, true)
      return
    }
    const { change_id } = (await res.json()) as { change_id: string }
    router.push(`/periodo/conferma?c=${change_id}`)
  }

  const seg = (value: boolean, label: string) => (
    <button
      type="button"
      onClick={() => setState(value)}
      aria-pressed={state === value}
      className={`flex-1 rounded-full py-3 font-semibold ${state === value ? 'bg-blue-800 text-white' : 'bg-white text-neutral-600'}`}
    >
      {label}
    </button>
  )
  const mealSelect = (value: Meal, onChange: (m: Meal) => void, name: string) => (
    <select name={name} value={value} onChange={(e) => onChange(e.target.value as Meal)} className="rounded-lg border p-3">
      {MEALS.map((m) => (
        <option key={m} value={m}>{mealName[m]}</option>
      ))}
    </select>
  )

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="flex gap-2 rounded-full bg-neutral-200 p-1">
        {seg(false, t.period.absent)}
        {seg(true, t.period.present)}
      </div>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">{t.period.from}</span>
        <div className="flex gap-2">
          <input type="date" name="start_date" value={startDate} min={min.date} onChange={(e) => setStartDate(e.target.value)} className="flex-1 rounded-lg border p-3" required />
          {mealSelect(startMeal, setStartMeal, 'start_meal')}
        </div>
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">{t.period.to}</span>
        <div className="flex gap-2">
          <input type="date" name="end_date" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} className="flex-1 rounded-lg border p-3" required />
          {mealSelect(endMeal, setEndMeal, 'end_meal')}
        </div>
      </label>
      <p className={`rounded-lg p-3 text-sm ${error ? 'bg-red-50 text-red-700' : 'bg-blue-50 text-blue-900'}`} data-testid="summary">
        {error ? issueText[error] : `${state ? t.period.present : t.period.absent}: ${intervalSummary(cells)}`}
      </p>
      <button type="submit" disabled={!!error || busy} className="w-full rounded-full bg-blue-800 py-4 font-semibold text-white disabled:opacity-40">
        {t.save}
      </button>
      <Toast msg={msg} />
    </form>
  )
}
```

- [ ] **Step 6: Pages and undo route**

`src/app/periodo/page.tsx`:
```tsx
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { t } from '@/i18n/it'
import { firstUnlockedCell } from '@/lib/cutoff'
import { IntervalForm } from '@/components/IntervalForm'
import { getPersonFromCookie } from '@/server/auth'
import { getSettings } from '@/server/settings'

export default async function PeriodPage() {
  const person = await getPersonFromCookie()
  if (!person) redirect('/link-non-valido')
  const min = firstUnlockedCell(new Date(), await getSettings())
  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <Link href="/" className="text-sm text-blue-800">← {t.period.backToList}</Link>
      <h1 className="mb-4 mt-2 text-2xl font-semibold">{t.period.title}</h1>
      <IntervalForm min={min} />
    </main>
  )
}
```

`src/components/UndoButton.tsx`:
```tsx
'use client'
import { useState } from 'react'
import { t } from '@/i18n/it'

export function UndoButton({ changeId }: { changeId: string }) {
  const [result, setResult] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function undo() {
    setBusy(true)
    const res = await fetch(`/api/changes/${changeId}/undo`, { method: 'POST' })
    setBusy(false)
    if (res.ok) {
      setResult(t.period.undone)
      return
    }
    const body = (await res.json().catch(() => ({}))) as { error?: string }
    setResult(t.period.undoReason[body.error ?? ''] ?? t.genericError)
  }
  if (result) return <p role="status" className="rounded-lg bg-neutral-100 p-3 text-sm">{result}</p>
  return (
    <button type="button" onClick={undo} disabled={busy} className="w-full rounded-full border-2 border-neutral-400 py-3 font-semibold">
      {t.period.undo}
    </button>
  )
}
```

`src/app/periodo/conferma/page.tsx`:
```tsx
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { formatDayShort, intervalSummary, mealNameLower, stateLabel, t } from '@/i18n/it'
import type { IsoDate, Meal } from '@/lib/dates'
import { expandInterval } from '@/lib/interval'
import { UndoButton } from '@/components/UndoButton'
import { getPersonFromCookie } from '@/server/auth'
import { db } from '@/server/db'

const MAX_SHOWN = 5

export default async function ConfirmPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const person = await getPersonFromCookie()
  if (!person) redirect('/link-non-valido')
  const { c } = await searchParams
  if (!c) notFound()

  const { data: change } = await db
    .from('changes')
    .select('id, start_date, start_meal, end_date, end_meal, state, undone_by')
    .eq('id', c)
    .eq('person_id', person.id)
    .maybeSingle()
  if (!change) notFound()

  const { data: entries } = await db
    .from('change_entries')
    .select('date, meal, prev_present')
    .eq('change_id', change.id)
    .not('prev_present', 'is', null)
    .order('date')
    .order('meal')
  const overwritten = (entries ?? []) as { date: IsoDate; meal: Meal; prev_present: boolean }[]
  const cells = expandInterval(change.start_date, change.start_meal, change.end_date, change.end_meal)

  return (
    <main className="mx-auto max-w-md px-4 py-6">
      <h1 className="text-2xl font-semibold">{t.period.confirmTitle}</h1>
      <p className="mt-2 text-lg">
        <strong>{stateLabel(change.state)}</strong>: {intervalSummary(cells)}
      </p>
      <p className="mt-1 text-sm text-neutral-600">{t.period.confirmKitchen}</p>

      <section className="mt-6 rounded-xl bg-white p-4 shadow-sm">
        <h2 className="font-medium">{t.period.overwrittenTitle}</h2>
        {overwritten.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-600">{t.period.noOverwritten}</p>
        ) : (
          <ul className="mt-2 space-y-1 text-sm">
            {overwritten.slice(0, MAX_SHOWN).map((o) => (
              <li key={`${o.date}-${o.meal}`}>
                {formatDayShort(o.date)}, {mealNameLower[o.meal]}: era <strong>{stateLabel(o.prev_present).toLowerCase()}</strong>
              </li>
            ))}
            {overwritten.length > MAX_SHOWN && <li className="text-neutral-500">{t.period.overwrittenMore(overwritten.length - MAX_SHOWN)}</li>}
          </ul>
        )}
      </section>

      <div className="mt-6 space-y-3">
        {change.undone_by ? <p role="status" className="rounded-lg bg-neutral-100 p-3 text-sm">{t.period.undoReason.already_undone}</p> : <UndoButton changeId={change.id} />}
        <Link href="/" className="block rounded-full bg-blue-800 py-3 text-center font-semibold text-white">{t.period.backToList}</Link>
      </div>
    </main>
  )
}
```

`src/app/api/changes/[id]/undo/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getPersonFromCookie } from '@/server/auth'
import { undoChange } from '@/server/changes'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const person = await getPersonFromCookie()
  if (!person) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { id } = await ctx.params
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  const result = await undoChange(id, person.id)
  if ('error' in result) return NextResponse.json(result, { status: result.error === 'not_found' ? 404 : 409 })
  return NextResponse.json(result)
}
```

- [ ] **Step 7: Verify manually**

`npm run dev`: from `/` tap "Segna un periodo"; the summary updates live; choosing a start before the minimum shows the red message and disables Salva; saving goes to the confirmation page listing overwritten choices (mark a single future meal first to see one); "Annulla" shows "Modifica annullata." and the list on `/` is restored; pressing back and undoing again shows "Modifica già annullata.".

- [ ] **Step 8: Lint, typecheck, commit**

Run: `npm run lint && npx tsc --noEmit && npm test`
```bash
git add -A
git commit -m "feat: interval picker, confirmation and undo"
```

---

### Task 10: PWA — manifest, icons, service worker, offline page

**Files:**
- Create: `public/manifest.webmanifest`, `public/sw.js`, `scripts/make-icons.mjs`, `public/icons/icon-192.png`, `public/icons/icon-512.png`, `src/components/SwRegister.tsx`, `src/app/offline/page.tsx`
- Modify: `src/app/layout.tsx`
- Test: `src/pwa.test.ts`

- [ ] **Step 1: Write the failing test**

`src/pwa.test.ts`:
```ts
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('PWA assets', () => {
  it('has a valid manifest with icons that exist', () => {
    const m = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf8'))
    expect(m.name).toBe('PSRM Pasti')
    expect(m.start_url).toBe('/')
    expect(m.display).toBe('standalone')
    expect(m.lang).toBe('it')
    for (const icon of m.icons) expect(existsSync(`public${icon.src}`)).toBe(true)
    expect(m.icons.map((i: { sizes: string }) => i.sizes)).toEqual(['192x192', '512x512'])
  })
  it('ships a service worker that serves the offline page for navigations', () => {
    const sw = readFileSync('public/sw.js', 'utf8')
    expect(sw).toContain("'/offline'")
    expect(sw).toContain("mode === 'navigate'")
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- pwa`
Expected: FAIL — `ENOENT public/manifest.webmanifest`.

- [ ] **Step 3: Create manifest, icon script, service worker, offline page, registration**

`public/manifest.webmanifest`:
```json
{
  "name": "PSRM Pasti",
  "short_name": "Pasti",
  "lang": "it",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#fafafa",
  "theme_color": "#1e3a8a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" }
  ]
}
```

`scripts/make-icons.mjs`:
```js
import { mkdirSync } from 'node:fs'
import sharp from 'sharp'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#1e3a8a"/>
  <circle cx="50" cy="52" r="30" fill="none" stroke="#fff" stroke-width="6"/>
  <circle cx="50" cy="52" r="17" fill="#fff"/>
  <rect x="14" y="26" width="6" height="40" rx="3" fill="#fff"/>
  <rect x="80" y="26" width="6" height="40" rx="3" fill="#fff"/>
</svg>`

mkdirSync('public/icons', { recursive: true })
for (const size of [192, 512]) {
  await sharp(Buffer.from(svg)).resize(size, size).png().toFile(`public/icons/icon-${size}.png`)
}
console.log('icons written')
```
Run: `npm run icons`

`public/sw.js`:
```js
const CACHE = 'psrm-shell-v1'
const SHELL = ['/offline', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).catch(() => caches.match('/offline')))
    return
  }
  const url = new URL(req.url)
  if (url.origin === self.location.origin && (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/'))) {
    event.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copy))
        return res
      })),
    )
  }
})
```

`src/components/SwRegister.tsx`:
```tsx
'use client'
import { useEffect } from 'react'

export function SwRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  }, [])
  return null
}
```

`src/app/offline/page.tsx`:
```tsx
import { t } from '@/i18n/it'

export default function OfflinePage() {
  return (
    <main className="mx-auto max-w-md p-6 text-center">
      <h1 className="text-2xl font-semibold">{t.offline.title}</h1>
      <p className="mt-3 text-neutral-600">{t.offline.body}</p>
    </main>
  )
}
```

Modify `src/app/layout.tsx`: add `manifest` and `appleWebApp` to metadata and render `<SwRegister />`:
```tsx
import type { Metadata, Viewport } from 'next'
import { SwRegister } from '@/components/SwRegister'
import { t } from '@/i18n/it'
import './globals.css'

export const metadata: Metadata = {
  title: t.appName,
  description: 'Presenze ai pasti',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: t.appName },
  icons: { apple: '/icons/icon-192.png' },
}

export const viewport: Viewport = { themeColor: '#1e3a8a', width: 'device-width', initialScale: 1 }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body className="min-h-screen bg-neutral-50 text-neutral-900 antialiased">
        {children}
        <SwRegister />
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Run tests and a production build**

Run: `npm test && npm run build && npm start`
Expected: tests PASS; build succeeds; in Chrome DevTools → Application, the manifest is valid and `sw.js` is activated; toggling "Offline" and reloading `/` shows "Sei offline". Stop the server.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: PWA manifest, icons, service worker and offline page"
```

---

### Task 11: Admin authentication — Supabase Auth login, guard, layout, admin bootstrap script, Playwright setup

**Files:**
- Create: `src/server/supabase-auth.ts`, `src/components/admin/LoginForm.tsx`, `src/app/admin/login/page.tsx`, `src/app/admin/(protected)/layout.tsx`, `src/app/admin/(protected)/page.tsx` (placeholder), `src/app/admin/(protected)/actions.ts` (signOut only; Task 12 extends), `scripts/create-admin.ts`, `playwright.config.ts`, `tests/e2e/global-setup.ts`, `.env.example`
- Modify: `src/server/auth.ts`, `src/proxy.ts`
- Test: `tests/e2e/admin-login.spec.ts`

**Interfaces:**
- Produces: `authClient()` (server `@supabase/ssr` client bound to Next cookies); `interface Admin { userId; email }`, `getAdmin()`, `requireAdmin()` (redirects to `/admin/login`); server action `signOut()`; `E2E` constants (`adminEmail`, `adminPassword`, `memberToken`, `memberName`) exported from `tests/e2e/global-setup.ts`.

- [ ] **Step 1: Write the failing e2e test and Playwright config**

`playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  timeout: 30_000,
  retries: 0,
  workers: 1, // specs share one local database
  use: { baseURL: 'http://localhost:3000', locale: 'it-IT' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/link-non-valido',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
```

`tests/e2e/global-setup.ts`:
```ts
import { createClient } from '@supabase/supabase-js'
import postgres from 'postgres'
import { hashToken } from '../../src/server/token'

export const E2E = {
  adminEmail: 'admin@e2e.local',
  adminPassword: 'e2e-password-123',
  memberToken: 'e2e'.padEnd(43, 'x'),
  memberName: 'Mario Rossi E2E',
}

export default async function globalSetup() {
  process.loadEnvFile('.env.local')
  const sql = postgres(process.env.DATABASE_URL!, { max: 1 })
  const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  await sql`truncate change_entries, meal_choices, changes, meal_guests, persons cascade`
  await sql`insert into persons (full_name, group_name, token_hash) values (${E2E.memberName}, 'Ospiti', ${hashToken(E2E.memberToken)})`

  const { data: list, error: listErr } = await supa.auth.admin.listUsers()
  if (listErr) throw listErr
  let user = list.users.find((u) => u.email === E2E.adminEmail)
  if (!user) {
    const { data, error } = await supa.auth.admin.createUser({ email: E2E.adminEmail, password: E2E.adminPassword, email_confirm: true })
    if (error) throw error
    user = data.user
  }
  await sql`insert into admins (user_id) values (${user.id}) on conflict do nothing`
  await sql.end()
}
```

`tests/e2e/admin-login.spec.ts`:
```ts
import { expect, test } from '@playwright/test'
import { E2E } from './global-setup'

test('admin pages redirect to login; login works; logout works', async ({ page }) => {
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/admin\/login$/)
  await page.getByLabel('Email').fill(E2E.adminEmail)
  await page.getByLabel('Password').fill(E2E.adminPassword)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page).toHaveURL(/\/admin$/)
  await expect(page.getByRole('heading', { name: 'Cucina' })).toBeVisible()
  await page.getByRole('button', { name: 'Esci' }).click()
  await expect(page).toHaveURL(/\/admin\/login$/)
})

test('wrong password shows an error', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(E2E.adminEmail)
  await page.getByLabel('Password').fill('nope')
  await page.getByRole('button', { name: 'Accedi' }).click()
  await expect(page.getByText('Email o password non validi.')).toBeVisible()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright install chromium && npm run db:env && npm run test:e2e`
Expected: FAIL — `/admin` is 404 / no login page.

- [ ] **Step 3: Implement auth client and admin helpers**

`src/server/supabase-auth.ts`:
```ts
import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/** Supabase Auth client (anon key) bound to the request's cookies. Used only for admin sessions. */
export async function authClient() {
  const store = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options)
        } catch {
          // Called from a Server Component: cookies are refreshed by proxy.ts instead.
        }
      },
    },
  })
}
```

Append to `src/server/auth.ts`:
```ts
import { redirect } from 'next/navigation'
import { authClient } from './supabase-auth'

export interface Admin {
  userId: string
  email: string | null
}

export async function getAdmin(): Promise<Admin | null> {
  const supa = await authClient()
  const { data: { user } } = await supa.auth.getUser()
  if (!user) return null
  const { data } = await db.from('admins').select('user_id').eq('user_id', user.id).maybeSingle()
  return data ? { userId: user.id, email: user.email ?? null } : null
}

export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdmin()
  if (!admin) redirect('/admin/login')
  return admin
}
```
(Move the two new `import` lines to the top of the file with the others.)

- [ ] **Step 4: Replace `src/proxy.ts` with the full version (member refresh + admin guard)**

```ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { MEMBER_COOKIE, memberCookieOptions } from '@/lib/cookie'

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) return adminGuard(request)
  const res = NextResponse.next()
  const token = request.cookies.get(MEMBER_COOKIE)?.value
  if (token) res.cookies.set(MEMBER_COOKIE, token, memberCookieOptions())
  return res
}

async function adminGuard(request: NextRequest) {
  let res = NextResponse.next({ request })
  const supa = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value)
        res = NextResponse.next({ request })
        for (const { name, value, options } of list) res.cookies.set(name, value, options)
      },
    },
  })
  const { data: { user } } = await supa.auth.getUser()
  const isLogin = request.nextUrl.pathname === '/admin/login'
  if (!user && !isLogin) return NextResponse.redirect(new URL('/admin/login', request.url))
  if (user && isLogin) return NextResponse.redirect(new URL('/admin', request.url))
  return res
}

export const config = { matcher: ['/', '/periodo/:path*', '/admin/:path*'] }
```

- [ ] **Step 5: Login page, protected layout, sign-out action, placeholder kitchen page**

`src/components/admin/LoginForm.tsx`:
```tsx
'use client'
import { createBrowserClient } from '@supabase/ssr'
import { useState } from 'react'
import { t } from '@/i18n/it'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const supa = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    const { error } = await supa.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) {
      setError(t.admin.loginError)
      return
    }
    window.location.assign('/admin')
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">{t.admin.email}</span>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded-lg border p-3" required autoComplete="username" />
      </label>
      <label className="block">
        <span className="mb-1 block text-sm font-medium">{t.admin.password}</span>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full rounded-lg border p-3" required autoComplete="current-password" />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={busy} className="w-full rounded-full bg-blue-800 py-3 font-semibold text-white disabled:opacity-40">
        {t.admin.login}
      </button>
    </form>
  )
}
```

`src/app/admin/login/page.tsx`:
```tsx
import { t } from '@/i18n/it'
import { LoginForm } from '@/components/admin/LoginForm'

export default function LoginPage() {
  return (
    <main className="mx-auto max-w-sm px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">{t.appName} · {t.admin.login}</h1>
      <LoginForm />
    </main>
  )
}
```

`src/app/admin/(protected)/actions.ts`:
```ts
'use server'
import { redirect } from 'next/navigation'
import { authClient } from '@/server/supabase-auth'

export async function signOut() {
  const supa = await authClient()
  await supa.auth.signOut()
  redirect('/admin/login')
}
```

`src/app/admin/(protected)/layout.tsx`:
```tsx
import Link from 'next/link'
import { t } from '@/i18n/it'
import { requireAdmin } from '@/server/auth'
import { signOut } from './actions'

const NAV = [
  ['/admin', t.admin.nav.kitchen],
  ['/admin/persone', t.admin.nav.persons],
  ['/admin/stagioni', t.admin.nav.seasons],
  ['/admin/impostazioni', t.admin.nav.settings],
  ['/admin/registro', t.admin.nav.log],
] as const

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin()
  return (
    <div className="min-h-screen">
      <nav className="no-print flex flex-wrap items-center gap-4 border-b bg-white px-4 py-3 text-sm">
        <span className="font-semibold">{t.appName}</span>
        {NAV.map(([href, label]) => (
          <Link key={href} href={href} className="text-blue-800 hover:underline">{label}</Link>
        ))}
        <form action={signOut} className="ml-auto">
          <button type="submit" className="text-neutral-600 hover:underline">{t.admin.logout}</button>
        </form>
      </nav>
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  )
}
```

`src/app/admin/(protected)/page.tsx` (placeholder; Task 12 replaces it):
```tsx
import { t } from '@/i18n/it'

export default function KitchenPage() {
  return <h1 className="text-2xl font-semibold">{t.admin.kitchen.title}</h1>
}
```

- [ ] **Step 6: Admin bootstrap script and `.env.example`**

`scripts/create-admin.ts` (run: `npx tsx scripts/create-admin.ts you@example.org 'a-strong-password'`):
```ts
import { createClient } from '@supabase/supabase-js'

const [email, password] = process.argv.slice(2)
if (!email || !password) {
  console.error('usage: tsx scripts/create-admin.ts <email> <password>')
  process.exit(1)
}
try { process.loadEnvFile('.env.local') } catch { /* env already set (CI / prod shell) */ }

const supa = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const { data, error } = await supa.auth.admin.createUser({ email, password, email_confirm: true })
if (error) throw error
const { error: insErr } = await supa.from('admins').insert({ user_id: data.user.id })
if (insErr) throw insErr
console.log(`admin created: ${email} (${data.user.id})`)
```

`.env.example`:
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=service-role-key
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-key
APP_BASE_URL=https://pasti.example.org
# local only, used by tests and scripts
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

- [ ] **Step 7: Run the e2e tests**

Run: `npm run test:e2e`
Expected: both admin-login tests PASS.

- [ ] **Step 8: Lint, typecheck, commit**

Run: `npm run lint && npx tsc --noEmit && npm test`
```bash
git add -A
git commit -m "feat: admin login with Supabase Auth, proxy guard, e2e harness"
```

---

### Task 12: Kitchen day view — headcounts, guests, roster, admin presence edit

**Files:**
- Create: `src/components/admin/GuestStepper.tsx`, `src/components/admin/AdminToggle.tsx`
- Modify: `src/app/admin/(protected)/page.tsx`, `src/app/admin/(protected)/actions.ts`
- Test: `tests/e2e/kitchen.spec.ts`, `src/app/admin/(protected)/kitchen.logic.test.ts`

**Interfaces:**
- Consumes: `day_roster`, `season_default` RPCs; `applyChange`; `requireAdmin`; `t`.
- Produces: server actions `adminSetPresence({personId, date, meal, state})`, `setGuests({date, meal, count, note})`; pure `summarise(roster, meal) → { total, byGroup }` in `src/app/admin/(protected)/kitchen.logic.ts`.

- [ ] **Step 1: Write the failing unit test for the counting logic**

`src/app/admin/(protected)/kitchen.logic.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { type RosterRow, summarise } from './kitchen.logic'

const roster: RosterRow[] = [
  { person_id: '1', full_name: 'Anna', group_name: 'Suore', lunch_present: true, lunch_explicit: false, dinner_present: false, dinner_explicit: true },
  { person_id: '2', full_name: 'Bruno', group_name: 'Sacerdoti', lunch_present: false, lunch_explicit: true, dinner_present: true, dinner_explicit: false },
  { person_id: '3', full_name: 'Carla', group_name: null, lunch_present: true, lunch_explicit: false, dinner_present: true, dinner_explicit: false },
]

describe('summarise', () => {
  it('counts present people overall and per group (null group → "Altri")', () => {
    expect(summarise(roster, 'lunch')).toEqual({ total: 2, byGroup: [['Suore', 1], ['Altri', 1]] })
    expect(summarise(roster, 'dinner')).toEqual({ total: 2, byGroup: [['Sacerdoti', 1], ['Altri', 1]] })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- kitchen`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the logic module**

`src/app/admin/(protected)/kitchen.logic.ts`:
```ts
import type { Meal } from '@/lib/dates'

export interface RosterRow {
  person_id: string
  full_name: string
  group_name: string | null
  lunch_present: boolean
  lunch_explicit: boolean
  dinner_present: boolean
  dinner_explicit: boolean
}

export const OTHER_GROUP = 'Altri'

export function isPresent(r: RosterRow, meal: Meal): boolean {
  return meal === 'lunch' ? r.lunch_present : r.dinner_present
}
export function isExplicit(r: RosterRow, meal: Meal): boolean {
  return meal === 'lunch' ? r.lunch_explicit : r.dinner_explicit
}

/** Present headcount for a meal, overall and per group, in roster order. */
export function summarise(roster: RosterRow[], meal: Meal): { total: number; byGroup: [string, number][] } {
  const groups = new Map<string, number>()
  let total = 0
  for (const r of roster) {
    if (!isPresent(r, meal)) continue
    total++
    const g = r.group_name ?? OTHER_GROUP
    groups.set(g, (groups.get(g) ?? 0) + 1)
  }
  return { total, byGroup: [...groups.entries()] }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Server actions**

Replace `src/app/admin/(protected)/actions.ts`:
```ts
'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { isoDateSchema, mealSchema } from '@/app/api/choices/schema'
import { requireAdmin } from '@/server/auth'
import { applyChange } from '@/server/changes'
import { db } from '@/server/db'
import { authClient } from '@/server/supabase-auth'

export async function signOut() {
  const supa = await authClient()
  await supa.auth.signOut()
  redirect('/admin/login')
}

const presenceSchema = z.object({ personId: z.uuid(), date: isoDateSchema, meal: mealSchema, state: z.boolean() })

export async function adminSetPresence(input: z.infer<typeof presenceSchema>): Promise<void> {
  const admin = await requireAdmin()
  const p = presenceSchema.parse(input)
  const r = await applyChange({
    personId: p.personId, actor: 'admin', actorUserId: admin.userId, kind: 'admin_edit',
    startDate: p.date, startMeal: p.meal, endDate: p.date, endMeal: p.meal, state: p.state,
  })
  if ('error' in r) throw new Error(r.error)
  revalidatePath('/admin')
}

const guestsSchema = z.object({
  date: isoDateSchema,
  meal: mealSchema,
  count: z.number().int().min(0).max(999),
  note: z.string().trim().max(200).optional(),
})

export async function setGuests(input: z.infer<typeof guestsSchema>): Promise<void> {
  const admin = await requireAdmin()
  const g = guestsSchema.parse(input)
  if (g.count === 0) {
    const { error } = await db.from('meal_guests').delete().eq('date', g.date).eq('meal', g.meal)
    if (error) throw new Error(error.message)
  } else {
    const { error } = await db.from('meal_guests').upsert(
      { date: g.date, meal: g.meal, count: g.count, note: g.note || null, updated_by: admin.userId, updated_at: new Date().toISOString() },
      { onConflict: 'date,meal' },
    )
    if (error) throw new Error(error.message)
  }
  revalidatePath('/admin')
}
```

- [ ] **Step 6: Client components**

`src/components/admin/GuestStepper.tsx`:
```tsx
'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { setGuests } from '@/app/admin/(protected)/actions'
import { t } from '@/i18n/it'
import type { IsoDate, Meal } from '@/lib/dates'

export function GuestStepper({ date, meal, count: initial, note: initialNote }: { date: IsoDate; meal: Meal; count: number; note: string | null }) {
  const router = useRouter()
  const [count, setCount] = useState(initial)
  const [note, setNote] = useState(initialNote ?? '')
  const [pending, start] = useTransition()

  function save(next: number, nextNote = note) {
    setCount(next)
    start(async () => {
      await setGuests({ date, meal, count: next, note: nextNote })
      router.refresh()
    })
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
      <span>{t.admin.kitchen.guests}</span>
      <button type="button" aria-label={`− ${t.admin.kitchen.guests}`} onClick={() => save(Math.max(0, count - 1))} disabled={pending || count === 0} className="h-9 w-9 rounded-full border text-lg disabled:opacity-40">−</button>
      <output aria-label={t.admin.kitchen.guests} className="w-8 text-center text-lg font-semibold">{count}</output>
      <button type="button" aria-label={`+ ${t.admin.kitchen.guests}`} onClick={() => save(count + 1)} disabled={pending} className="h-9 w-9 rounded-full border text-lg disabled:opacity-40">+</button>
      <input
        type="text"
        placeholder={t.admin.kitchen.guestNote}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => count > 0 && save(count, note)}
        className="min-w-40 flex-1 rounded border px-2 py-1"
      />
    </div>
  )
}
```

`src/components/admin/AdminToggle.tsx`:
```tsx
'use client'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { adminSetPresence } from '@/app/admin/(protected)/actions'
import { mealName } from '@/i18n/it'
import type { IsoDate, Meal } from '@/lib/dates'

export function AdminToggle({ personId, date, meal, present, explicit }: { personId: string; date: IsoDate; meal: Meal; present: boolean; explicit: boolean }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  return (
    <button
      type="button"
      aria-pressed={present}
      disabled={pending}
      onClick={() => start(async () => { await adminSetPresence({ personId, date, meal, state: !present }); router.refresh() })}
      className={`relative rounded-full border px-3 py-1 text-xs font-medium ${present ? 'border-blue-800 bg-blue-800 text-white' : 'bg-white text-neutral-500'} disabled:opacity-40`}
    >
      {mealName[meal]}
      {explicit && <span aria-hidden className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-amber-400" />}
    </button>
  )
}
```

- [ ] **Step 7: The kitchen page**

Replace `src/app/admin/(protected)/page.tsx`:
```tsx
import Link from 'next/link'
import { formatDayLong, mealName, mealNameLower, t } from '@/i18n/it'
import { type IsoDate, type Meal, MEALS, addDays, isIsoDate, romeParts } from '@/lib/dates'
import { AdminToggle } from '@/components/admin/AdminToggle'
import { GuestStepper } from '@/components/admin/GuestStepper'
import { requireAdmin } from '@/server/auth'
import { db } from '@/server/db'
import { type RosterRow, isExplicit, isPresent, summarise } from './kitchen.logic'

interface GuestRow { meal: Meal; count: number; note: string | null }

export default async function KitchenPage({ searchParams }: { searchParams: Promise<{ d?: string; tutti?: string }> }) {
  await requireAdmin()
  const { d, tutti } = await searchParams
  const today = romeParts(new Date()).date
  const date: IsoDate = d && isIsoDate(d) ? d : today
  const showAll = tutti === '1'

  const [rosterRes, guestsRes, lunchDef, dinnerDef] = await Promise.all([
    db.rpc('day_roster', { p_date: date }),
    db.from('meal_guests').select('meal, count, note').eq('date', date),
    db.rpc('season_default', { p_date: date, p_meal: 'lunch' }),
    db.rpc('season_default', { p_date: date, p_meal: 'dinner' }),
  ])
  if (rosterRes.error) throw new Error(rosterRes.error.message)
  const roster = rosterRes.data as RosterRow[]
  const guests = new Map(((guestsRes.data ?? []) as GuestRow[]).map((g) => [g.meal, g]))
  const defaults: Record<Meal, boolean> = { lunch: lunchDef.data as boolean, dinner: dinnerDef.data as boolean }

  const nav = (to: IsoDate) => `/admin?d=${to}${showAll ? '&tutti=1' : ''}`

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">{t.admin.kitchen.title}</h1>
        <div className="no-print flex items-center gap-2">
          <Link href={nav(addDays(date, -1))} aria-label={t.admin.kitchen.prevDay} className="rounded border px-3 py-1">‹</Link>
          <form action="/admin" className="flex items-center gap-2">
            <input type="date" name="d" defaultValue={date} className="rounded border px-2 py-1" />
            {showAll && <input type="hidden" name="tutti" value="1" />}
            <button type="submit" className="rounded border px-3 py-1">OK</button>
          </form>
          <Link href={nav(addDays(date, 1))} aria-label={t.admin.kitchen.nextDay} className="rounded border px-3 py-1">›</Link>
        </div>
        <span className="text-lg capitalize">{formatDayLong(date)}</span>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {MEALS.map((meal) => {
          const s = summarise(roster, meal)
          const g = guests.get(meal)
          const guestCount = g?.count ?? 0
          const defaultPresent = defaults[meal]
          const listed = roster.filter((r) => isPresent(r, meal) !== defaultPresent)
          return (
            <section key={meal} className="rounded-xl bg-white p-4 shadow-sm" data-testid={`meal-${meal}`}>
              <h2 className="text-xl font-semibold">{mealName[meal]}</h2>
              <p className="mt-1 text-3xl font-bold" data-testid={`total-${meal}`}>
                {s.total + guestCount} <span className="text-base font-normal text-neutral-500">{t.admin.kitchen.total}</span>
              </p>
              <p className="text-sm text-neutral-600">
                {t.admin.kitchen.community} {s.total}
                {s.byGroup.length > 1 && <> ({s.byGroup.map(([name, n]) => `${name} ${n}`).join(' · ')})</>}
                {' · '}{t.admin.kitchen.guests} {guestCount}
              </p>
              <div className="no-print"><GuestStepper date={date} meal={meal} count={guestCount} note={g?.note ?? null} /></div>
              {g?.note && <p className="hidden text-sm print:block">{t.admin.kitchen.guests}: {g.note}</p>}

              <h3 className="mt-4 font-medium">
                {defaultPresent ? t.admin.kitchen.absentAt(mealNameLower[meal]) : t.admin.kitchen.presentAt(mealNameLower[meal])} ({listed.length})
                <span className="ml-2 text-xs font-normal text-neutral-500">{defaultPresent ? t.admin.kitchen.defaultPresent : t.admin.kitchen.defaultAbsent}</span>
              </h3>
              <ul className="mt-2 divide-y text-sm">
                {(showAll ? roster : listed).length === 0 && <li className="py-1 text-neutral-500">{t.admin.kitchen.nobody}</li>}
                {(showAll ? roster : listed).map((r) => (
                  <li key={r.person_id} className="flex items-center justify-between py-1">
                    <span>{r.full_name}{r.group_name && <span className="ml-2 text-xs text-neutral-500">{r.group_name}</span>}</span>
                    <span className="no-print"><AdminToggle personId={r.person_id} date={date} meal={meal} present={isPresent(r, meal)} explicit={isExplicit(r, meal)} /></span>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>

      <div className="no-print mt-4 flex gap-4 text-sm">
        <Link href={`/admin?d=${date}${showAll ? '' : '&tutti=1'}`} className="text-blue-800 hover:underline">
          {showAll ? t.admin.kitchen.showExceptions : t.admin.kitchen.showAll}
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 8: Write the e2e test and run it**

`tests/e2e/kitchen.spec.ts`:
```ts
import { expect, test } from '@playwright/test'
import { E2E } from './global-setup'

test.beforeEach(async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(E2E.adminEmail)
  await page.getByLabel('Password').fill(E2E.adminPassword)
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
```
Run: `npm run test:e2e`
Expected: PASS.

- [ ] **Step 9: Lint, typecheck, commit**

Run: `npm run lint && npx tsc --noEmit && npm test`
```bash
git add -A
git commit -m "feat: kitchen day view with headcounts, guests and admin edits"
```

---

### Task 13: Persons management — CRUD, link reveal (copy / QR), regenerate token

**Files:**
- Create: `supabase/migrations/20260913000003_views.sql`, `src/app/admin/(protected)/persone/actions.ts`, `src/app/admin/(protected)/persone/page.tsx`, `src/components/admin/PersonsTable.tsx`
- Test: `tests/integration/views.test.ts`, `tests/e2e/persons.spec.ts`

**Interfaces:**
- Consumes: `generateToken`, `hashToken`, `personLink`, `requireAdmin`, `db`, `qrcode`.
- Produces: view `persons_overview` (persons columns + `last_change_at timestamptz`, `change_count int`); server actions `createPerson(input) → Reveal`, `updatePerson(id, input)`, `setPersonActive(id, active)`, `deletePerson(id) → {ok:true}|{error:'has_changes'}`, `regenerateToken(id) → Reveal` where `Reveal = { id, token, link, qr }` (`qr` is a PNG data URL).

- [ ] **Step 1: Write the failing integration test for the view**

`tests/integration/views.test.ts`:
```ts
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createPerson, q, resetData, rpc, sql } from './helpers'

afterAll(() => sql.end())
beforeEach(resetData)

describe('persons_overview', () => {
  it('exposes last change time and count per person', async () => {
    const a = await createPerson('Anna')
    const b = await createPerson('Bruno')
    await rpc('apply_change', { p_person: a, p_actor: 'member', p_actor_user: null, p_kind: 'toggle',
      p_start_date: '2026-10-20', p_start_meal: 'lunch', p_end_date: '2026-10-20', p_end_meal: 'lunch', p_state: false, p_now: '2026-10-01T06:00:00Z' })
    const rows = await q`select id, full_name, change_count, last_change_at::text from persons_overview order by full_name`
    expect(rows).toEqual([
      { id: a, full_name: 'Anna', change_count: 1, last_change_at: expect.stringContaining('2026-10-01') },
      { id: b, full_name: 'Bruno', change_count: 0, last_change_at: null },
    ])
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:integration -- views`
Expected: FAIL — `relation "persons_overview" does not exist`.

- [ ] **Step 3: Write the migration and apply**

`supabase/migrations/20260913000003_views.sql`:
```sql
create view persons_overview with (security_invoker = false) as
  select p.*,
         (select max(c.created_at) from changes c where c.person_id = p.id) as last_change_at,
         (select count(*)::int from changes c where c.person_id = p.id)     as change_count
    from persons p;

revoke all on persons_overview from anon, authenticated;
```
Run: `npm run db:reset && npm run test:integration`
Expected: PASS.

- [ ] **Step 4: Server actions**

`src/app/admin/(protected)/persone/actions.ts`:
```ts
'use server'
import { revalidatePath } from 'next/cache'
import QRCode from 'qrcode'
import { z } from 'zod'
import { requireAdmin } from '@/server/auth'
import { db } from '@/server/db'
import { generateToken, hashToken, personLink } from '@/server/token'

export interface Reveal {
  id: string
  token: string
  link: string
  qr: string
}

const personSchema = z.object({
  full_name: z.string().trim().min(1).max(120),
  group_name: z.string().trim().max(60).optional().transform((v) => v || null),
  notes: z.string().trim().max(500).optional().transform((v) => v || null),
})
export type PersonInput = z.input<typeof personSchema>

async function reveal(id: string, token: string): Promise<Reveal> {
  const link = personLink(process.env.APP_BASE_URL ?? 'http://localhost:3000', token)
  const qr = await QRCode.toDataURL(link, { width: 256, margin: 1 })
  return { id, token, link, qr }
}

export async function createPerson(input: PersonInput): Promise<Reveal> {
  await requireAdmin()
  const p = personSchema.parse(input)
  const token = generateToken()
  const { data, error } = await db.from('persons').insert({ ...p, token_hash: hashToken(token) }).select('id').single()
  if (error) throw new Error(error.message)
  revalidatePath('/admin/persone')
  return reveal(data.id, token)
}

export async function updatePerson(id: string, input: PersonInput): Promise<void> {
  await requireAdmin()
  const p = personSchema.parse(input)
  const { error } = await db.from('persons').update({ ...p, updated_at: new Date().toISOString() }).eq('id', z.uuid().parse(id))
  if (error) throw new Error(error.message)
  revalidatePath('/admin/persone')
}

export async function setPersonActive(id: string, active: boolean): Promise<void> {
  await requireAdmin()
  const { error } = await db.from('persons').update({ active, updated_at: new Date().toISOString() }).eq('id', z.uuid().parse(id))
  if (error) throw new Error(error.message)
  revalidatePath('/admin/persone')
}

export async function deletePerson(id: string): Promise<{ ok: true } | { error: 'has_changes' }> {
  await requireAdmin()
  const pid = z.uuid().parse(id)
  const { count } = await db.from('changes').select('id', { count: 'exact', head: true }).eq('person_id', pid)
  if ((count ?? 0) > 0) return { error: 'has_changes' }
  const { error } = await db.from('persons').delete().eq('id', pid)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/persone')
  return { ok: true }
}

export async function regenerateToken(id: string): Promise<Reveal> {
  await requireAdmin()
  const pid = z.uuid().parse(id)
  const token = generateToken()
  const { error } = await db.from('persons').update({ token_hash: hashToken(token), updated_at: new Date().toISOString() }).eq('id', pid)
  if (error) throw new Error(error.message)
  revalidatePath('/admin/persone')
  return reveal(pid, token)
}
```

- [ ] **Step 5: Page and table component**

`src/app/admin/(protected)/persone/page.tsx`:
```tsx
import { t } from '@/i18n/it'
import { type PersonRow, PersonsTable } from '@/components/admin/PersonsTable'
import { requireAdmin } from '@/server/auth'
import { db } from '@/server/db'

export default async function PersonsPage() {
  await requireAdmin()
  const { data, error } = await db
    .from('persons_overview')
    .select('id, full_name, group_name, notes, active, last_change_at, change_count')
    .order('active', { ascending: false })
    .order('full_name')
  if (error) throw new Error(error.message)
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">{t.admin.persons.title}</h1>
      <PersonsTable rows={data as PersonRow[]} />
    </div>
  )
}
```

`src/components/admin/PersonsTable.tsx`:
```tsx
'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { type PersonInput, type Reveal, createPerson, deletePerson, regenerateToken, setPersonActive, updatePerson } from '@/app/admin/(protected)/persone/actions'
import { formatDateTime, t } from '@/i18n/it'

export interface PersonRow {
  id: string
  full_name: string
  group_name: string | null
  notes: string | null
  active: boolean
  last_change_at: string | null
  change_count: number
}

const P = t.admin.persons

export function PersonsTable({ rows }: { rows: PersonRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState<PersonRow | 'new' | null>(null)
  const [reveal, setReveal] = useState<Reveal | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function run(fn: () => Promise<void>) {
    start(async () => {
      await fn()
      router.refresh()
    })
  }

  function submitForm(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const input: PersonInput = {
      full_name: String(fd.get('full_name') ?? ''),
      group_name: String(fd.get('group_name') ?? ''),
      notes: String(fd.get('notes') ?? ''),
    }
    run(async () => {
      if (editing === 'new') setReveal(await createPerson(input))
      else if (editing) await updatePerson(editing.id, input)
      setEditing(null)
    })
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text)
    setNotice(P.copied)
    setTimeout(() => setNotice(null), 2000)
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => setEditing('new')} className="rounded-full bg-blue-800 px-4 py-2 text-sm font-semibold text-white">
        {P.new}
      </button>

      {reveal && (
        <section className="rounded-xl border-2 border-amber-400 bg-amber-50 p-4" data-testid="reveal">
          <p className="text-sm font-medium">{P.linkOnce}</p>
          <code className="mt-2 block break-all rounded bg-white p-2 text-xs" data-testid="reveal-link">{reveal.link}</code>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={() => copy(reveal.link)} className="rounded-full border px-3 py-1 text-sm">{P.copyLink}</button>
            {notice && <span className="text-sm text-green-700">{notice}</span>}
            <button type="button" onClick={() => setReveal(null)} className="ml-auto text-sm text-neutral-600">{t.close}</button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={reveal.qr} alt={P.qr} width={256} height={256} className="mt-3 rounded bg-white p-2" />
        </section>
      )}

      {editing && (
        <form onSubmit={submitForm} className="grid gap-3 rounded-xl bg-white p-4 shadow-sm md:grid-cols-3">
          <label className="block text-sm">
            {P.name}
            <input name="full_name" required maxLength={120} defaultValue={editing === 'new' ? '' : editing.full_name} className="mt-1 w-full rounded border p-2" />
          </label>
          <label className="block text-sm">
            {P.group}
            <input name="group_name" maxLength={60} defaultValue={editing === 'new' ? '' : editing.group_name ?? ''} className="mt-1 w-full rounded border p-2" />
          </label>
          <label className="block text-sm">
            {P.notes}
            <input name="notes" maxLength={500} defaultValue={editing === 'new' ? '' : editing.notes ?? ''} className="mt-1 w-full rounded border p-2" />
          </label>
          <div className="flex gap-2 md:col-span-3">
            <button type="submit" disabled={pending} className="rounded-full bg-blue-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{t.save}</button>
            <button type="button" onClick={() => setEditing(null)} className="rounded-full border px-4 py-2 text-sm">{t.cancel}</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 text-left">
            <tr>
              <th className="p-2">{P.name}</th>
              <th className="p-2">{P.group}</th>
              <th className="p-2">{P.lastChange}</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className={`border-t ${r.active ? '' : 'text-neutral-400'}`}>
                <td className="p-2">
                  {r.full_name}
                  {!r.active && <span className="ml-2 rounded bg-neutral-200 px-1 text-xs">{P.inactive}</span>}
                  {r.notes && <div className="text-xs text-neutral-500">{r.notes}</div>}
                </td>
                <td className="p-2">{r.group_name ?? ''}</td>
                <td className="p-2">{r.last_change_at ? formatDateTime(r.last_change_at) : P.never}</td>
                <td className="p-2">
                  <div className="flex flex-wrap justify-end gap-2">
                    <button type="button" onClick={() => setEditing(r)} className="rounded border px-2 py-1">{t.edit}</button>
                    <button type="button" disabled={pending} onClick={() => run(async () => { setReveal(await regenerateToken(r.id)) })} className="rounded border px-2 py-1">{P.regenerate}</button>
                    <button type="button" disabled={pending} onClick={() => run(() => setPersonActive(r.id, !r.active))} className="rounded border px-2 py-1">
                      {r.active ? P.deactivate : P.activate}
                    </button>
                    {r.change_count === 0 && (confirmDelete === r.id ? (
                      <button type="button" disabled={pending} onClick={() => run(async () => { await deletePerson(r.id); setConfirmDelete(null) })} className="rounded bg-red-600 px-2 py-1 text-white">{t.confirmDelete}</button>
                    ) : (
                      <button type="button" onClick={() => setConfirmDelete(r.id)} className="rounded border border-red-300 px-2 py-1 text-red-700">{t.delete}</button>
                    ))}
                    {r.change_count > 0 && <span className="self-center text-xs text-neutral-400" title={P.cannotDelete}>{t.delete}: {P.cannotDelete}</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Write the e2e test and run it**

`tests/e2e/persons.spec.ts`:
```ts
import { expect, test } from '@playwright/test'
import { E2E } from './global-setup'

test('admin creates a person, gets a one-time link, and the member can open it', async ({ page, browser }) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(E2E.adminEmail)
  await page.getByLabel('Password').fill(E2E.adminPassword)
  await page.getByRole('button', { name: 'Accedi' }).click()
  await page.goto('/admin/persone')

  await page.getByRole('button', { name: 'Nuova persona' }).click()
  await page.getByLabel('Nome e cognome').fill('Giulia Verdi')
  await page.getByLabel('Gruppo').fill('Suore')
  await page.getByRole('button', { name: 'Salva' }).click()

  const reveal = page.getByTestId('reveal')
  await expect(reveal).toBeVisible()
  const link = (await page.getByTestId('reveal-link').textContent())!.trim()
  expect(link).toMatch(/\/p\/[A-Za-z0-9_-]{43}$/)
  await expect(reveal.getByRole('img', { name: 'QR' })).toBeVisible()
  await expect(page.getByRole('cell', { name: /Giulia Verdi/ })).toBeVisible()

  const ctx = await browser.newContext()
  const member = await ctx.newPage()
  await member.goto(link)
  await expect(member).toHaveURL(/\/$/)
  await expect(member.getByRole('heading', { name: 'Giulia Verdi' })).toBeVisible()
  await ctx.close()

  // regenerate → old link dies
  const row = page.getByRole('row', { name: /Giulia Verdi/ })
  await row.getByRole('button', { name: 'Rigenera link' }).click()
  await expect(page.getByTestId('reveal')).toBeVisible()
  const ctx2 = await browser.newContext()
  const stale = await ctx2.newPage()
  await stale.goto(link)
  await expect(stale).toHaveURL(/\/link-non-valido$/)
  await ctx2.close()

  // delete (no changes yet)
  await row.getByRole('button', { name: 'Elimina' }).click()
  await row.getByRole('button', { name: 'Confermi?' }).click()
  await expect(page.getByRole('cell', { name: /Giulia Verdi/ })).toHaveCount(0)
})
```
Run: `npm run test:e2e`
Expected: PASS.

- [ ] **Step 7: Lint, typecheck, commit**

Run: `npm run lint && npx tsc --noEmit && npm test`
```bash
git add -A
git commit -m "feat: persons management with one-time link reveal, QR and token regeneration"
```

---

### Task 14: Seasons editor

**Files:**
- Create: `src/app/admin/(protected)/stagioni/actions.ts`, `src/app/admin/(protected)/stagioni/page.tsx`, `src/components/admin/SeasonForm.tsx`, `src/app/admin/(protected)/stagioni/schema.ts`
- Test: `src/app/admin/(protected)/stagioni/schema.test.ts`, `tests/e2e/seasons.spec.ts`

**Interfaces:**
- Produces: `seasonSchema` (discriminated by `kind: 'recurring' | 'one_off'`), server actions `createSeason(input)`, `updateSeason(id, input)`, `deleteSeason(id)`.

- [ ] **Step 1: Write the failing schema test**

`src/app/admin/(protected)/stagioni/schema.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { seasonSchema, toRow } from './schema'

describe('seasonSchema', () => {
  it('accepts a recurring season and maps it to a row', () => {
    const r = seasonSchema.parse({ kind: 'recurring', label: 'Estate', start_md: '07-01', end_md: '09-30', lunch_default: false, dinner_default: false })
    expect(toRow(r)).toEqual({ label: 'Estate', start_md: '07-01', end_md: '09-30', start_date: null, end_date: null, lunch_default: false, dinner_default: false })
  })
  it('accepts a one-off season with ordered dates', () => {
    const r = seasonSchema.parse({ kind: 'one_off', label: 'Ritiro', start_date: '2026-11-10', end_date: '2026-11-14', lunch_default: false, dinner_default: true })
    expect(toRow(r).start_md).toBeNull()
    expect(seasonSchema.safeParse({ kind: 'one_off', label: 'X', start_date: '2026-11-14', end_date: '2026-11-10', lunch_default: true, dinner_default: true }).success).toBe(false)
  })
  it('rejects malformed MM-DD', () => {
    expect(seasonSchema.safeParse({ kind: 'recurring', label: 'X', start_md: '13-01', end_md: '09-30', lunch_default: true, dinner_default: true }).success).toBe(false)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- stagioni`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement schema**

`src/app/admin/(protected)/stagioni/schema.ts`:
```ts
import { z } from 'zod'
import { isoDateSchema } from '@/app/api/choices/schema'

const md = z.string().regex(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/, 'MM-DD')
const common = { label: z.string().trim().min(1).max(60), lunch_default: z.boolean(), dinner_default: z.boolean() }

export const seasonSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('recurring'), ...common, start_md: md, end_md: md }),
  z.object({ kind: z.literal('one_off'), ...common, start_date: isoDateSchema, end_date: isoDateSchema })
    .refine((s) => s.start_date <= s.end_date, { message: 'end before start', path: ['end_date'] }),
])
export type SeasonInput = z.infer<typeof seasonSchema>

export interface SeasonRow {
  label: string
  start_md: string | null
  end_md: string | null
  start_date: string | null
  end_date: string | null
  lunch_default: boolean
  dinner_default: boolean
}

export function toRow(s: SeasonInput): SeasonRow {
  const base = { label: s.label, lunch_default: s.lunch_default, dinner_default: s.dinner_default }
  return s.kind === 'recurring'
    ? { ...base, start_md: s.start_md, end_md: s.end_md, start_date: null, end_date: null }
    : { ...base, start_md: null, end_md: null, start_date: s.start_date, end_date: s.end_date }
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Actions, form, page**

`src/app/admin/(protected)/stagioni/actions.ts`:
```ts
'use server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/server/auth'
import { db } from '@/server/db'
import { type SeasonInput, seasonSchema, toRow } from './schema'

export async function createSeason(input: SeasonInput): Promise<void> {
  await requireAdmin()
  const { error } = await db.from('season_defaults').insert(toRow(seasonSchema.parse(input)))
  if (error) throw new Error(error.message)
  revalidatePath('/admin/stagioni')
}

export async function updateSeason(id: string, input: SeasonInput): Promise<void> {
  await requireAdmin()
  const { error } = await db.from('season_defaults').update(toRow(seasonSchema.parse(input))).eq('id', z.uuid().parse(id))
  if (error) throw new Error(error.message)
  revalidatePath('/admin/stagioni')
}

export async function deleteSeason(id: string): Promise<void> {
  await requireAdmin()
  const { error } = await db.from('season_defaults').delete().eq('id', z.uuid().parse(id))
  if (error) throw new Error(error.message)
  revalidatePath('/admin/stagioni')
}
```

`src/components/admin/SeasonForm.tsx`:
```tsx
'use client'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { createSeason, deleteSeason, updateSeason } from '@/app/admin/(protected)/stagioni/actions'
import type { SeasonInput } from '@/app/admin/(protected)/stagioni/schema'
import { t } from '@/i18n/it'

export interface SeasonListRow {
  id: string
  label: string
  start_md: string | null
  end_md: string | null
  start_date: string | null
  end_date: string | null
  lunch_default: boolean
  dinner_default: boolean
}

const S = t.admin.seasons

function toInput(fd: FormData): SeasonInput {
  const common = {
    label: String(fd.get('label') ?? ''),
    lunch_default: fd.get('lunch_default') === 'on',
    dinner_default: fd.get('dinner_default') === 'on',
  }
  return fd.get('kind') === 'one_off'
    ? { kind: 'one_off', ...common, start_date: String(fd.get('start_date') ?? ''), end_date: String(fd.get('end_date') ?? '') }
    : { kind: 'recurring', ...common, start_md: String(fd.get('start_md') ?? ''), end_md: String(fd.get('end_md') ?? '') }
}

export function SeasonsEditor({ rows }: { rows: SeasonListRow[] }) {
  const router = useRouter()
  const [pending, start] = useTransition()
  const [editing, setEditing] = useState<SeasonListRow | 'new' | null>(null)
  const [kind, setKind] = useState<'recurring' | 'one_off'>('recurring')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function open(row: SeasonListRow | 'new') {
    setEditing(row)
    setKind(row !== 'new' && row.start_date ? 'one_off' : 'recurring')
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const input = toInput(new FormData(e.currentTarget))
    start(async () => {
      if (editing === 'new') await createSeason(input)
      else if (editing) await updateSeason(editing.id, input)
      setEditing(null)
      router.refresh()
    })
  }

  const row = editing !== 'new' ? editing : null
  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-600">{S.hint}</p>
      <button type="button" onClick={() => open('new')} className="rounded-full bg-blue-800 px-4 py-2 text-sm font-semibold text-white">{S.add}</button>

      {editing && (
        <form onSubmit={submit} className="grid gap-3 rounded-xl bg-white p-4 shadow-sm md:grid-cols-4">
          <label className="block text-sm">{S.label}<input name="label" required defaultValue={row?.label ?? ''} className="mt-1 w-full rounded border p-2" /></label>
          <label className="block text-sm">
            {S.kind}
            <select name="kind" value={kind} onChange={(e) => setKind(e.target.value as 'recurring' | 'one_off')} className="mt-1 w-full rounded border p-2">
              <option value="recurring">{S.recurring}</option>
              <option value="one_off">{S.oneOff}</option>
            </select>
          </label>
          {kind === 'recurring' ? (
            <>
              <label className="block text-sm">{S.startMd}<input name="start_md" required pattern="\d{2}-\d{2}" placeholder="10-01" defaultValue={row?.start_md ?? ''} className="mt-1 w-full rounded border p-2" /></label>
              <label className="block text-sm">{S.endMd}<input name="end_md" required pattern="\d{2}-\d{2}" placeholder="06-30" defaultValue={row?.end_md ?? ''} className="mt-1 w-full rounded border p-2" /></label>
            </>
          ) : (
            <>
              <label className="block text-sm">{S.startDate}<input type="date" name="start_date" required defaultValue={row?.start_date ?? ''} className="mt-1 w-full rounded border p-2" /></label>
              <label className="block text-sm">{S.endDate}<input type="date" name="end_date" required defaultValue={row?.end_date ?? ''} className="mt-1 w-full rounded border p-2" /></label>
            </>
          )}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="lunch_default" defaultChecked={row?.lunch_default ?? true} />{S.lunchDefault}</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="dinner_default" defaultChecked={row?.dinner_default ?? true} />{S.dinnerDefault}</label>
          <div className="flex gap-2 md:col-span-4">
            <button type="submit" disabled={pending} className="rounded-full bg-blue-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">{t.save}</button>
            <button type="button" onClick={() => setEditing(null)} className="rounded-full border px-4 py-2 text-sm">{t.cancel}</button>
          </div>
        </form>
      )}

      <table className="w-full rounded-xl bg-white text-sm shadow-sm">
        <thead className="bg-neutral-100 text-left">
          <tr><th className="p-2">{S.label}</th><th className="p-2">{S.period}</th><th className="p-2">{S.lunchDefault}</th><th className="p-2">{S.dinnerDefault}</th><th className="p-2"></th></tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-t">
              <td className="p-2">{r.label}</td>
              <td className="p-2">{r.start_date ? `${r.start_date} → ${r.end_date}` : `${S.recurring}: ${r.start_md} → ${r.end_md}`}</td>
              <td className="p-2">{r.lunch_default ? t.period.present : t.period.absent}</td>
              <td className="p-2">{r.dinner_default ? t.period.present : t.period.absent}</td>
              <td className="p-2">
                <div className="flex justify-end gap-2">
                  <button type="button" onClick={() => open(r)} className="rounded border px-2 py-1">{t.edit}</button>
                  {confirmDelete === r.id ? (
                    <button type="button" disabled={pending} onClick={() => start(async () => { await deleteSeason(r.id); setConfirmDelete(null); router.refresh() })} className="rounded bg-red-600 px-2 py-1 text-white">{t.confirmDelete}</button>
                  ) : (
                    <button type="button" onClick={() => setConfirmDelete(r.id)} className="rounded border border-red-300 px-2 py-1 text-red-700">{t.delete}</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

`src/app/admin/(protected)/stagioni/page.tsx`:
```tsx
import { t } from '@/i18n/it'
import { type SeasonListRow, SeasonsEditor } from '@/components/admin/SeasonForm'
import { requireAdmin } from '@/server/auth'
import { db } from '@/server/db'

export default async function SeasonsPage() {
  await requireAdmin()
  const { data, error } = await db
    .from('season_defaults')
    .select('id, label, start_md, end_md, start_date, end_date, lunch_default, dinner_default')
    .order('start_date', { ascending: true, nullsFirst: false })
    .order('start_md')
  if (error) throw new Error(error.message)
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">{t.admin.seasons.title}</h1>
      <SeasonsEditor rows={data as SeasonListRow[]} />
    </div>
  )
}
```

- [ ] **Step 6: e2e test**

`tests/e2e/seasons.spec.ts`:
```ts
import { expect, test } from '@playwright/test'
import { E2E } from './global-setup'

test('admin adds a one-off season and it changes the kitchen default', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(E2E.adminEmail)
  await page.getByLabel('Password').fill(E2E.adminPassword)
  await page.getByRole('button', { name: 'Accedi' }).click()

  await page.goto('/admin/stagioni')
  await page.getByRole('button', { name: 'Aggiungi stagione' }).click()
  await page.getByLabel('Nome').fill('Ritiro E2E')
  await page.getByLabel('Tipo').selectOption('one_off')
  await page.getByLabel('Inizio', { exact: true }).fill('2026-11-10')
  await page.getByLabel('Fine', { exact: true }).fill('2026-11-14')
  await page.getByLabel('Pranzo predefinito').uncheck()
  await page.getByLabel('Cena predefinita').uncheck()
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByRole('cell', { name: 'Ritiro E2E' })).toBeVisible()

  await page.goto('/admin?d=2026-11-12')
  await expect(page.getByTestId('meal-lunch').getByText('Presenti a pranzo (0)')).toBeVisible()

  const row = page.getByRole('row', { name: /Ritiro E2E/ })
  await page.goto('/admin/stagioni')
  await row.getByRole('button', { name: 'Elimina' }).click()
  await row.getByRole('button', { name: 'Confermi?' }).click()
  await expect(page.getByRole('cell', { name: 'Ritiro E2E' })).toHaveCount(0)
})
```
Run: `npm run test:e2e -- seasons`
Expected: PASS.

- [ ] **Step 7: Lint, typecheck, commit**

Run: `npm run lint && npx tsc --noEmit && npm test`
```bash
git add -A
git commit -m "feat: seasons editor"
```

---

### Task 15: Settings page — cutoff times

**Files:**
- Create: `src/app/admin/(protected)/impostazioni/actions.ts`, `src/app/admin/(protected)/impostazioni/page.tsx`
- Test: `tests/e2e/settings.spec.ts`

**Interfaces:**
- Produces: server action `saveSettings(formData)` (form action; fields `lunch_cutoff`, `dinner_cutoff` as `HH:MM`).

- [ ] **Step 1: Write the failing e2e test**

`tests/e2e/settings.spec.ts`:
```ts
import { expect, test } from '@playwright/test'
import { E2E } from './global-setup'

test('admin changes and restores the dinner cutoff', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(E2E.adminEmail)
  await page.getByLabel('Password').fill(E2E.adminPassword)
  await page.getByRole('button', { name: 'Accedi' }).click()

  await page.goto('/admin/impostazioni')
  await page.getByLabel('Chiusura modifiche cena').fill('15:00')
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByText('Impostazioni salvate.')).toBeVisible()
  await page.reload()
  await expect(page.getByLabel('Chiusura modifiche cena')).toHaveValue('15:00')

  await page.getByLabel('Chiusura modifiche cena').fill('10:00')
  await page.getByRole('button', { name: 'Salva' }).click()
  await expect(page.getByText('Impostazioni salvate.')).toBeVisible()
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:e2e -- settings`
Expected: FAIL — page 404.

- [ ] **Step 3: Implement**

`src/app/admin/(protected)/impostazioni/actions.ts`:
```ts
'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireAdmin } from '@/server/auth'
import { db } from '@/server/db'

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)
const schema = z.object({ lunch_cutoff: hm, dinner_cutoff: hm })

export async function saveSettings(formData: FormData): Promise<void> {
  await requireAdmin()
  const s = schema.parse({ lunch_cutoff: formData.get('lunch_cutoff'), dinner_cutoff: formData.get('dinner_cutoff') })
  const { error } = await db.from('settings').upsert([
    { key: 'lunch_cutoff', value: s.lunch_cutoff },
    { key: 'dinner_cutoff', value: s.dinner_cutoff },
  ])
  if (error) throw new Error(error.message)
  revalidatePath('/', 'layout')
  redirect('/admin/impostazioni?saved=1')
}
```

`src/app/admin/(protected)/impostazioni/page.tsx`:
```tsx
import { t } from '@/i18n/it'
import { requireAdmin } from '@/server/auth'
import { getSettings } from '@/server/settings'
import { saveSettings } from './actions'

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin()
  const { saved } = await searchParams
  const s = await getSettings()
  const S = t.admin.settings
  return (
    <div className="max-w-md">
      <h1 className="mb-4 text-2xl font-semibold">{S.title}</h1>
      <form action={saveSettings} className="space-y-4 rounded-xl bg-white p-4 shadow-sm">
        <label className="block text-sm">
          {S.lunchCutoff}
          <input type="time" name="lunch_cutoff" defaultValue={s.lunch_cutoff} required className="mt-1 w-full rounded border p-2" />
        </label>
        <label className="block text-sm">
          {S.dinnerCutoff}
          <input type="time" name="dinner_cutoff" defaultValue={s.dinner_cutoff} required className="mt-1 w-full rounded border p-2" />
        </label>
        <button type="submit" className="rounded-full bg-blue-800 px-4 py-2 text-sm font-semibold text-white">{t.save}</button>
        {saved && <p role="status" className="text-sm text-green-700">{S.saved}</p>}
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Run the e2e test**

Run: `npm run test:e2e -- settings`
Expected: PASS.

- [ ] **Step 5: Lint, typecheck, commit**

Run: `npm run lint && npx tsc --noEmit && npm test`
```bash
git add -A
git commit -m "feat: cutoff settings page"
```

---

### Task 16: Audit log (`/admin/registro`)

**Files:**
- Create: `src/app/admin/(protected)/registro/page.tsx`
- Test: `tests/e2e/registro.spec.ts`

- [ ] **Step 1: Write the failing e2e test**

`tests/e2e/registro.spec.ts`:
```ts
import { expect, test } from '@playwright/test'
import { E2E } from './global-setup'

test('admin edits appear in the log, filterable by person', async ({ page }) => {
  await page.goto('/admin/login')
  await page.getByLabel('Email').fill(E2E.adminEmail)
  await page.getByLabel('Password').fill(E2E.adminPassword)
  await page.getByRole('button', { name: 'Accedi' }).click()

  await page.goto('/admin?d=2026-12-01&tutti=1')
  await page.getByTestId('meal-dinner').getByRole('listitem').filter({ hasText: E2E.memberName }).getByRole('button', { name: 'Cena' }).click()
  await expect(page.getByTestId('meal-dinner').getByRole('listitem').filter({ hasText: E2E.memberName }).getByRole('button', { name: 'Cena' })).toHaveAttribute('aria-pressed', 'false')

  await page.goto('/admin/registro')
  await page.getByLabel('Persona').selectOption({ label: E2E.memberName })
  await page.getByLabel('Dal').fill('2026-01-01')
  await page.getByRole('button', { name: 'Filtra' }).click()
  const row = page.getByRole('row').filter({ hasText: 'Modifica cucina' }).filter({ hasText: 'mar 1 dic' }).first()
  await expect(row).toBeVisible()
  await expect(row).toContainText('cucina')
  await expect(row).toContainText('Assente')
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:e2e -- registro`
Expected: FAIL — page 404.

- [ ] **Step 3: Implement the page**

`src/app/admin/(protected)/registro/page.tsx`:
```tsx
import { formatDateTime, intervalSummary, kindLabel, stateLabel, t } from '@/i18n/it'
import { type IsoDate, type Meal, isIsoDate } from '@/lib/dates'
import { expandInterval } from '@/lib/interval'
import { requireAdmin } from '@/server/auth'
import { db } from '@/server/db'

interface LogRow {
  id: string
  actor: 'member' | 'admin'
  kind: string
  start_date: IsoDate
  start_meal: Meal
  end_date: IsoDate
  end_meal: Meal
  state: boolean
  created_at: string
  undone_by: string | null
  persons: { full_name: string } | null
}

export default async function LogPage({ searchParams }: { searchParams: Promise<{ p?: string; from?: string; to?: string }> }) {
  await requireAdmin()
  const { p, from, to } = await searchParams
  const L = t.admin.log

  const { data: persons } = await db.from('persons').select('id, full_name').order('full_name')
  let q = db
    .from('changes')
    .select('id, actor, kind, start_date, start_meal, end_date, end_meal, state, created_at, undone_by, persons(full_name)')
    .order('created_at', { ascending: false })
    .limit(200)
  if (p) q = q.eq('person_id', p)
  if (from && isIsoDate(from)) q = q.gte('start_date', from)
  if (to && isIsoDate(to)) q = q.lte('end_date', to)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  const rows = (data ?? []) as unknown as LogRow[]

  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">{L.title}</h1>
      <form className="no-print mb-4 flex flex-wrap items-end gap-3 text-sm">
        <label className="block">
          {L.person}
          <select name="p" defaultValue={p ?? ''} className="mt-1 block rounded border p-2">
            <option value="">{L.all}</option>
            {(persons ?? []).map((x) => (
              <option key={x.id} value={x.id}>{x.full_name}</option>
            ))}
          </select>
        </label>
        <label className="block">{L.from}<input type="date" name="from" defaultValue={from ?? ''} className="mt-1 block rounded border p-2" /></label>
        <label className="block">{L.to}<input type="date" name="to" defaultValue={to ?? ''} className="mt-1 block rounded border p-2" /></label>
        <button type="submit" className="rounded-full border px-4 py-2">{L.filter}</button>
      </form>

      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-neutral-100 text-left">
            <tr>
              <th className="p-2">{L.when}</th>
              <th className="p-2">{L.person}</th>
              <th className="p-2">{L.actor}</th>
              <th className="p-2">{L.kind}</th>
              <th className="p-2">{L.interval}</th>
              <th className="p-2">{L.state}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="p-3 text-neutral-500">{L.empty}</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className={`border-t ${r.undone_by ? 'text-neutral-400 line-through' : ''}`}>
                <td className="whitespace-nowrap p-2">{formatDateTime(r.created_at)}</td>
                <td className="p-2">{r.persons?.full_name ?? '—'}</td>
                <td className="p-2">{r.actor === 'admin' ? L.actorAdmin : L.actorMember}</td>
                <td className="p-2">{kindLabel(r.kind)}{r.undone_by && <span className="ml-1 text-xs">({L.undone})</span>}</td>
                <td className="p-2">{intervalSummary(expandInterval(r.start_date, r.start_meal, r.end_date, r.end_meal))}</td>
                <td className="p-2">{stateLabel(r.state)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the e2e test**

Run: `npm run test:e2e -- registro`
Expected: PASS.

- [ ] **Step 5: Lint, typecheck, commit**

Run: `npm run lint && npx tsc --noEmit && npm test`
```bash
git add -A
git commit -m "feat: audit log page"
```

---

### Task 17: Member end-to-end smoke tests

**Files:**
- Test: `tests/e2e/member.spec.ts`

- [ ] **Step 1: Write the tests**

`tests/e2e/member.spec.ts`:
```ts
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
```

- [ ] **Step 2: Run the full e2e suite**

Run: `npm run test:e2e`
Expected: all specs PASS. (The `nth(10)` cell's index is stable because the member list always has 30 rows starting today; the interval starts ≥10 days after the minimum date so it never touches locked cells.)

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/member.spec.ts
git commit -m "test: member end-to-end flows"
```

---

### Task 18: README, deployment to Vercel + Supabase cloud

**Files:**
- Create/Replace: `README.md`
- Modify: `.gitignore` (ensure `.env*.local`, `supabase/.temp`, `test-results`, `playwright-report` are ignored)

- [ ] **Step 1: Write `README.md`**

````markdown
# PSRM Pasti

PWA per segnare presenza/assenza ai pasti (pranzo e cena) di una comunità di ~60 persone.
Ogni persona ha un link personale; la cucina ha un accesso amministratore.

## Sviluppo locale

Requisiti: Node 22+, Docker (per Supabase locale).

```bash
npm install
npm run db:start          # avvia Postgres/Auth locali (prima volta: scarica le immagini)
npm run db:reset          # applica migrazioni + seed
npm run db:env            # scrive .env.local
npx tsx scripts/create-admin.ts admin@example.org 'password-forte'
npm run dev               # http://localhost:3000
```

Crea le persone da `/admin/persone`: il link personale è mostrato una sola volta (copia o QR).

## Test

```bash
npm test                  # unit (vitest)
npm run test:integration  # funzioni Postgres contro Supabase locale
npm run test:e2e          # Playwright (usa .env.local + dev server)
```

## Deploy

1. **Supabase**: crea un progetto; in *Project Settings → API* copia URL, anon key e service-role key.
   Applica le migrazioni: `npx supabase link --project-ref <ref> && npx supabase db push`,
   poi esegui `supabase/seed.sql` nell'SQL editor (solo la prima volta).
   In *Authentication → Providers* lascia attivo Email; disattiva le registrazioni pubbliche
   (*Authentication → Settings → Allow new users to sign up: off*).
2. **Admin**: `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/create-admin.ts email password`.
3. **Vercel**: importa il repo; variabili d'ambiente:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `APP_BASE_URL` (es. `https://pasti.tuodominio.it`). Deploy.
4. Apri `/admin`, accedi, crea le persone e distribuisci i link.

## Struttura

- `supabase/migrations` — schema e funzioni (`apply_change`, `undo_change`, `season_default`, …)
- `src/lib` — logica pura condivisa (date, intervalli, cutoff)
- `src/server` — accesso al DB con service role, autenticazione
- `src/app` — pagine membro (`/`, `/periodo`), API, area `/admin`
- `docs/superpowers/specs` — specifica di progetto
````

- [ ] **Step 2: Check `.gitignore` and that no secrets are tracked**

```bash
grep -E '^\.env\*\.local|^\.env\.local' .gitignore || echo '.env*.local' >> .gitignore
printf 'supabase/.temp\ntest-results\nplaywright-report\n' >> .gitignore
git status --short
```
Expected: `.env.local` not listed as untracked.

- [ ] **Step 3: Production build and full verification**

Run: `npm run lint && npx tsc --noEmit && npm test && npm run test:integration && npm run build`
Expected: everything passes; build has no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: README with local setup and deployment"
```

- [ ] **Step 5: Deploy (manual, with the user)** — follow README "Deploy". After deploy, smoke-check on the production URL: create one person, open the link on a phone, "Aggiungi a schermata Home", toggle a meal, check `/admin`.
