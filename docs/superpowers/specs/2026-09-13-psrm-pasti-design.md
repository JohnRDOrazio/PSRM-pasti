# PSRM Pasti — Design Spec

**Date:** 2026-09-13
**Status:** approved design, pending implementation plan

## 1. Purpose

A PWA for a community of ~60 people to indicate presence or absence at daily
meals (lunch and dinner), and for the kitchen/admin to see the headcount for
any day and manage the list of people. Italian-only UI.

Core principles (carried over from the initial design conversation):

- **No passwords for members.** Each person gets a personal tokenized link.
- **Default-present, store exceptions.** People only touch the app when they
  deviate from the season default.
- **Season defaults are data**, not code: Oct–Jun default present, Jul–Sep
  default absent, editable by admin.
- **Cutoff 10:00** (Europe/Rome) on the day of the meal; configurable per meal.
- **Every write is attributable and reversible** via an append-only change log.

## 2. Stack

- **Next.js 16** (App Router, TypeScript, Turbopack), deployed on **Vercel**.
- **Supabase Postgres** as the database; **Supabase Auth** for admin login only.
- **Tailwind CSS**, no component library.
- **PWA**: `manifest.webmanifest`, icons, a hand-written service worker
  (`public/sw.js`) that caches the app shell and serves an offline fallback
  page. Network-first for pages. No offline reads or writes.
- All data access goes through Next.js server code (route handlers and server
  actions) using the **service-role key**. RLS is enabled on every table with
  no public policies; the anon key is used only by Supabase Auth on the client.
- All time computations use `Europe/Rome`, performed server-side; the client
  mirrors the result only to disable UI controls.

## 3. Authentication

### Members

- Route `/p/[token]`. Token: 32 random bytes, base64url. The DB stores only
  `sha256(token)` in `persons.token_hash`.
- On a valid token the server sets an httpOnly, `SameSite=Lax`, 1-year cookie
  `psrm_member` containing the token, then redirects to `/`. The cookie is
  refreshed on every visit. This makes the installed PWA start URL (`/`) work
  without the token in the URL.
- Invalid or revoked token (or inactive person) → `401` page: "Link non
  valido. Chiedi in cucina un nuovo link."
- Admin can regenerate a person's token ("Rigenera link"), which revokes the
  old one.

### Admin

- Supabase Auth email + password. Session cookies managed with
  `@supabase/ssr`.
- `proxy.ts` (Next.js 16 replacement for middleware) redirects unauthenticated
  requests under `/admin/*` to `/admin/login`.
- A user is an admin only if `admins.user_id` contains their auth user id.
  Server code checks this on every admin action (`requireAdmin()`).
- The first admin is created in the Supabase dashboard and inserted into
  `admins` manually.

## 4. Data model

All timestamps are `timestamptz`; calendar days are `date`.

```
persons          id uuid pk
                 full_name text not null
                 group_name text null            -- e.g. Sacerdoti, Seminaristi, Suore, Ospiti
                 notes text null
                 active bool not null default true
                 token_hash text unique not null
                 created_at, updated_at

admins           user_id uuid pk references auth.users
                 created_at

season_defaults  id uuid pk
                 label text not null
                 -- exactly one of the two pairs is set:
                 start_md char(5) null, end_md char(5) null      -- recurring, 'MM-DD'
                 start_date date null, end_date date null        -- one-off override
                 lunch_default bool not null
                 dinner_default bool not null
                 check ((start_md is null) = (end_md is null))
                 check ((start_date is null) = (end_date is null))
                 check ((start_md is null) <> (start_date is null))

settings         key text pk, value jsonb not null
                 -- 'lunch_cutoff': "10:00", 'dinner_cutoff': "10:00"

meal_choices     person_id uuid references persons
                 date date
                 meal meal_t                     -- enum ('lunch','dinner')
                 present bool not null
                 change_id uuid references changes
                 pk (person_id, date, meal)

changes          id uuid pk
                 person_id uuid references persons
                 actor actor_t                   -- enum ('member','admin')
                 actor_user_id uuid null         -- auth user id when actor = admin
                 kind change_kind_t              -- enum ('toggle','interval','admin_edit','undo')
                 start_date date, start_meal meal_t
                 end_date date,   end_meal meal_t
                 state bool                      -- true = present, false = absent
                 created_at
                 undone_by uuid null references changes

change_entries   change_id uuid references changes
                 person_id uuid, date date, meal meal_t
                 prev_present bool null          -- null = no explicit choice existed
                 new_present bool null           -- null = row removed (equals default)
                 pk (change_id, person_id, date, meal)

meal_guests      date date, meal meal_t
                 count int not null check (count >= 0)
                 note text null
                 updated_by uuid null
                 updated_at
                 pk (date, meal)
```

Seed: recurring seasons `10-01 → 06-30` present/present ("Anno") and
`07-01 → 09-30` absent/absent ("Estate"); settings both cutoffs `"10:00"`.

### Effective value resolution

For a given `(person, date, meal)`:

1. `meal_choices` row, if present;
2. else a one-off `season_defaults` row whose `[start_date, end_date]` contains
   `date` (if several, the narrowest wins);
3. else a recurring row whose `MM-DD` window contains the date's `MM-DD`
   (windows may wrap the year end, e.g. `10-01 → 06-30`);
4. else `true` (present).

### Intervals

A change always targets a **meal-to-meal interval**: from `(start_date,
start_meal)` to `(end_date, end_meal)` inclusive, in chronological order
(lunch before dinner). Every meal in between is included. A single toggle is
an interval of one cell. Expansion is a pure function `expandInterval(...)`.

### Write algorithm — `apply_change(...)` (Postgres function, one transaction)

Inputs: person, actor, actor_user_id, kind, interval, state.

1. Expand the interval into cells.
2. If actor is `member`, reject with an error listing any locked cells
   (see §5). Admins bypass the cutoff.
3. For each cell compute the current effective value and the season default.
   - Skip cells whose effective value already equals `state`.
   - Insert a `change_entries` row with `prev_present` = the explicit
     `meal_choices.present` if a row existed, else `null`; `new_present` =
     `state` if `state ≠ season default`, else `null`.
   - Upsert `meal_choices` when `new_present` is not null; delete the row when
     it is null (the table stays exceptions-only).
4. Insert the `changes` row. Return the change id and the entries where
   `prev_present is not null` (the "you overwrote these explicit choices"
   list).

### Undo — `undo_change(change_id, person)`

Allowed only when: the change belongs to the person, `undone_by is null`, the
change is less than 24 hours old, and **no later `change_entries` row exists
for any of its cells**. Restores each cell to `prev_present` (null → delete
row), records a `kind='undo'` change with mirrored entries, and sets
`undone_by` on the original. Otherwise returns a 409-style error.

### Guests

`meal_guests` is owned by the admin. Editing writes `updated_by/updated_at`
only; guest counts are not part of the per-cell change log and are not
subject to the cutoff. A count of 0 deletes the row.

## 5. Cutoff

`isLocked(date, meal, now, settings)`: a cell is locked when `date < today`
or when `date = today` and the current Europe/Rome time is at or after that
meal's cutoff. Computed server-side and enforced in `apply_change` for
members; the client computes the same to disable controls and to clamp the
interval picker's minimum start.

## 6. Screens (Italian)

### Member

- `/p/[token]` → sets cookie → redirect `/`.
- `/` — header with the person's name and today's date; a banner stating the
  current season mode ("In questo periodo sei **presente** salvo diversa
  indicazione" / "…**assente**…").
  - **Next 30 days list**, one row per day (weekday + date) with two pill
    toggles *Pranzo* / *Cena*. Filled pill = present, hollow = absent. A small
    dot marks cells that differ from the season default (explicit choice).
    Locked cells are greyed with a lock icon; today's row shows
    "chiuso alle 10:00".
  - Tap = immediate optimistic save via `POST /api/choices`; reverts with an
    error toast on failure; success toast "Salvato". No confirmation screen.
  - Sticky bottom button **"Segna un periodo"**.
- `/periodo` — segmented control *Assente / Presente*; "Dal" date +
  Pranzo/Cena; "Al" date + Pranzo/Cena; `min` clamped to the first unlocked
  cell; live summary with correct plurals ("12 pasti, dal pranzo di sab 20
  alla cena di sab 27"). Save → `/periodo/conferma?c=<change_id>`.
- `/periodo/conferma` — summary of what was saved; list of overwritten
  explicit choices (max 5 shown, then "+N altri"); buttons **Annulla**
  (undo, per §4 rules; shows why if refused) and **Torna all'elenco**. States
  explicitly that the kitchen sees the change immediately.
- `/offline` — fallback page served by the service worker.

### Admin

- `/admin/login` — Supabase Auth email + password form.
- `/admin` **Cucina** — date navigator (default today; ‹ ›; date input). Two
  cards *Pranzo* / *Cena*, each with "Comunità N · Ospiti M · **Totale**",
  per-group counts, a guest stepper (−/+) with optional note. Below, the
  roster: in a present-default period it lists the **absent** people; in an
  absent-default period the **present** ones (heading states which). Toggle
  "Mostra tutti" shows everyone with a per-person toggle the admin can flip
  (bypasses cutoff; recorded as `kind='admin_edit'`). Print-friendly CSS.
- `/admin/persone` — table: name, group, active, last change. Actions:
  Nuova, Modifica (modal), Disattiva/Attiva, Elimina (only if the person has
  no `changes`; otherwise only Disattiva, preserving the audit trail),
  **Copia link**, **QR**, **Rigenera link**. The plain token is shown exactly
  once, at creation or regeneration.
- `/admin/stagioni` — list editor for `season_defaults` (recurring MM-DD rows
  and one-off dated rows).
- `/admin/impostazioni` — lunch and dinner cutoff times.
- `/admin/registro` — audit log: filters by person and date range; columns
  actor, kind, interval, state, created_at, undone.

### Design

Mobile-first, large tap targets, system font stack, Tailwind only. Admin pages
are desktop-tolerant tables. All strings live in `src/i18n/it.ts` with
plural helpers (giorno/giorni, pasto/pasti, assente/assenti).

## 7. Server layer and API

`src/server/` modules, pure where possible:

- `auth.ts` — `getPersonFromCookie()`, `requireAdmin()`.
- `seasons.ts` — `effectiveDefault(date, meal, seasons)`.
- `cutoff.ts` — `isLocked(date, meal, now, settings)`.
- `interval.ts` — `expandInterval(startDate, startMeal, endDate, endMeal)`.
- `changes.ts` — wrappers calling `apply_change` / `undo_change`.
- `db.ts` — service-role Supabase client (server only).

Routes:

- `POST /api/choices` — member: `{ start_date, start_meal, end_date,
  end_meal, state }` → `{ change_id, overwritten: [...] }`.
- `POST /api/changes/[id]/undo` — member.
- Admin server actions: persons CRUD + token regeneration, seasons CRUD,
  settings update, admin presence edit, guest count update.

All inputs validated with zod. Errors: `401` invalid token / not admin;
`409` locked cells (payload lists them) or undo refused (payload has the
reason); `400` validation.

## 8. Testing

- **Vitest** unit tests for `seasons`, `cutoff` (boundaries, year wrap, DST
  days in Europe/Rome), `interval`, i18n plural helpers.
- **Integration tests** for `apply_change` / `undo_change` against a local
  Supabase (`supabase start`): overwrite list, exceptions-only invariant,
  undo refusal when a later change exists, cutoff rejection for members and
  bypass for admins.
- **Playwright** smoke flows: member toggle + locked cell; interval save +
  undo; admin creates a person, copies the link, opens it as the member.
- Development follows TDD.

## 9. Repository layout

```
supabase/migrations/*.sql, supabase/seed.sql
src/app/               routes (member, admin, api)
src/server/            auth, db, seasons, cutoff, interval, changes
src/components/
src/i18n/it.ts
public/manifest.webmanifest, public/sw.js, public/icons/
proxy.ts
docs/superpowers/specs/
```

## 10. Deployment

Vercel project with env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `APP_BASE_URL`
(used to build personal links). Migrations applied with `supabase db push`.

## 11. Out of scope (v1)

- Email or message delivery of personal links (admin shares via copy/QR).
- Offline reads or queued offline writes.
- Reminders/notifications for the summer opt-in season (likely v2).
- Audit-logging of guest count edits (only `updated_by/updated_at`).
