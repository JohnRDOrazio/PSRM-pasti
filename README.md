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
npm run dev               # http://localhost:3100
```

Crea le persone da `/admin/persone`: il link personale è mostrato una sola volta (copia o QR).

## Test

```bash
npm test                  # unit (vitest)
npm run test:integration  # funzioni Postgres contro Supabase locale
npm run test:e2e          # Playwright (usa .env.local + dev server su :3100)
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

Non committare mai `.env.local` (o altri file `.env*.local`): contengono chiavi di servizio.

## Struttura

- `supabase/migrations` — schema e funzioni (`apply_change`, `undo_change`, `season_default`, …)
- `src/lib` — logica pura condivisa (date, intervalli, cutoff)
- `src/server` — accesso al DB con service role, autenticazione
- `src/app` — pagine membro (`/`, `/periodo`), API, area `/admin`
- `tests/e2e` — smoke test Playwright (`npm run test:e2e`)
