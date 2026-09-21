# Groups — design

Date: 2026-09-21. Extends the 2026-09-13 PSRM Pasti design.

## 1. Goal

`persons.group_name` is a free-text field. Replace it with a list of groups that the admin
manages, so that the group of each person is chosen from a dropdown, a rename propagates to
everyone in the group, and a group in use cannot be deleted by mistake.

Decisions taken with the owner:

- A person may have no group (kitchen keeps showing them under "Altri").
- Deleting a group that still has people is refused; the admin moves them first.
- Groups are ordered alphabetically everywhere; there is no manual ordering.

## 2. Data model

```
groups           id uuid pk default gen_random_uuid()
                 name text not null              -- unique, case-insensitive (index on lower(name))
                 created_at timestamptz not null default now()

persons          group_id uuid null references groups(id) on delete restrict
                 -- group_name is dropped
```

Migration `20260921000002_groups.sql`, in one transaction:

1. create `groups`; `create unique index groups_name_key on groups (lower(name))`.
2. `insert into groups (name) select distinct group_name from persons where group_name is not null`.
3. add `persons.group_id`; `update persons p set group_id = g.id from groups g where g.name = p.group_name`.
4. drop `persons.group_name`.
5. recreate `persons_overview` (drop + create) as `select p.*, g.name as group_name, last_change_at, change_count`
   from `persons p left join groups g on g.id = p.group_id`.
6. drop + recreate `day_roster` with the same return type as today; `group_name` comes from the
   join; ordering stays `group_name nulls last, full_name`.
7. `revoke all on groups from public, anon, authenticated` (defaults already revoke, the
   explicit line matches the other tables).

Not additive: like the dietary-notes migration, merge in a quiet moment (the production app and
the migration deploy independently for a minute or two).

## 3. Admin: groups page

Route `/admin/gruppi`, nav label "Gruppi" between "Persone" and "Stagioni".

- Server page loads `groups` with a member count: `select g.id, g.name, count(p.id)` via a view
  `groups_overview` (`security_invoker = false`, same pattern as `persons_overview`) ordered by
  `lower(name)`.
- Client `GroupsEditor` (pattern: `SeasonsEditor`): "Nuovo gruppo" button, inline form with one
  field (name, trimmed, 1–60 chars), rows with *Modifica* / *Elimina* → *Confermi?*.
- Server actions in `src/app/admin/(protected)/gruppi/actions.ts`:
  - `createGroup(input)` / `updateGroup(id, input)` → `{ ok: true } | { error: 'duplicate' }`
    (unique-violation `23505` mapped, everything else thrown).
  - `deleteGroup(id)` → `{ ok: true } | { error: 'in_use' }` (FK violation `23503` mapped).
  - All `requireAdmin()`, then `revalidatePath('/admin/gruppi')` and `/admin/persone`.
- Messages (it.ts, `admin.groups`): title "Gruppi", add "Nuovo gruppo", name "Nome",
  members "Persone", duplicate "Esiste già un gruppo con questo nome.",
  inUse "Ci sono persone in questo gruppo: spostale prima di eliminarlo.",
  hint "I gruppi compaiono nella scheda di ogni persona e nei conteggi della cucina.".
  When the member count is > 0 the delete button is disabled with `title = inUse`; the action's
  `in_use` error is a fallback for a stale page.

## 4. Persons form and table

- `PersonsTable` receives `groups: { id, name }[]` from the page (`select id, name from groups
  order by name`). The group field becomes `<select name="group_id">` with a first option
  "— nessuno —" (value `""`), then the groups. Label stays "Gruppo".
- `PersonRow` gets `group_id: string | null` (from `persons_overview`) and keeps `group_name`
  for the table cell.
- `personSchema` in `persone/actions.ts`: `group_id: z.uuid().nullable()` where the form's `""`
  maps to `null` before validation (`z.string().transform(v => v || null).pipe(z.uuid().nullable())`).
  A `group_id` that does not exist fails the FK → thrown as a generic error (only possible with a
  stale form).
- `Person` (server/auth.ts) keeps `group_name` via the `persons_overview` view
  (`select id, full_name, group_name, dietary_notes` from the view instead of the table).

## 5. Kitchen page

No change: `day_roster` keeps returning `group_name`; `summarise`/`OTHER_GROUP` unchanged.

## 6. Tests

- Unit: `gruppi/schema.test.ts` — trim, min 1, max 60.
- Integration (`tests/integration/groups.test.ts`):
  - `persons_overview` and `day_roster` expose `group_name` from the join, ordering unchanged.
  - inserting "Suore" then "suore" fails with `23505`.
  - deleting a group that has a person fails with `23503`; after unassigning it succeeds.
  - `groups_overview` counts people per group.
- Helpers: `createPerson(name, group)` creates/finds the group by name and links `group_id`;
  e2e `global-setup.ts` does the same for the E2E member ("Ospiti").
- E2E `tests/e2e/groups.spec.ts`: admin creates "Seminaristi" → on `/admin/persone` assigns it
  to the E2E member via the dropdown → `/admin?d=2026-10-20&tutti=1` shows the tag next to the
  name → renames the group to "Seminario" → kitchen shows the new name → *Elimina* is disabled
  while in use → unassign the member ("— nessuno —") → delete works. Duplicate name shows the
  message.
- Existing specs keep passing (`persons.spec.ts` fills "Gruppo" by typing "Suore": it will select
  a group instead, so the setup creates "Suore", or the spec creates it first).
