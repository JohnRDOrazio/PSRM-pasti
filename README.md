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

Il repo ha due workflow GitHub Actions:

- **CI** (`.github/workflows/ci.yml`) — su ogni PR e push su `main`: lint, typecheck, test unitari,
  Supabase locale in Docker con test di integrazione, Playwright e2e, build di produzione.
- **Deploy database** (`.github/workflows/deploy-db.yml`) — su push su `main` che tocca
  `supabase/migrations/**` (o manualmente da *Actions → Run workflow*): `supabase db push` sul progetto
  di produzione. L'app è pubblicata da Vercel tramite l'integrazione Git.

### Prima configurazione

1. **Supabase**: crea un progetto; in *Project Settings → API* copia URL, anon key e service-role key;
   in *Project Settings → General* copia il **Reference ID**. In *Authentication → Providers* lascia
   attivo Email; disattiva le registrazioni pubbliche (*Authentication → Settings → Allow new users to
   sign up: off*). Sempre in *Authentication → Settings* imposta **Minimum password length: 8** e attiva
   **Secure password change** (come in `supabase/config.toml`, che vale solo per lo stack locale).
   Per il recupero password via email: in *Authentication → URL Configuration* imposta **Site URL** =
   `https://<dominio-dell-app>` (l'origine con cui gli utenti aprono l'app, la stessa di `APP_BASE_URL`) e aggiungi
   `https://<dominio-dell-app>/admin/reset/nuova` ai **Redirect URLs**; in *Authentication → Emails → Reset Password* sostituisci il corpo con il contenuto di
   `supabase/templates/recovery.html` (il link usa `{{ .TokenHash }}`, non `{{ .ConfirmationURL }}`).
   Gli amministratori devono avere un indirizzo email reale per poter ricevere il link.
2. **Segreti GitHub** (*Settings → Environments → `production` → Environment secrets*):
   - `SUPABASE_ACCESS_TOKEN` — personal access token da https://supabase.com/dashboard/account/tokens
   - `SUPABASE_DB_PASSWORD` — password del database del progetto
   - `SUPABASE_PROJECT_ID` — il Reference ID
   Poi lancia *Actions → Deploy database → Run workflow* per applicare le migrazioni la prima volta.
3. **Seed**: esegui `supabase/seed.sql` nell'SQL editor (una sola volta; è idempotente).
4. **Admin** (dal tuo computer, contro il progetto di produzione; le variabili esplicite hanno la precedenza su `.env.local`):
   `SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=<secret key> npx tsx scripts/create-admin.ts email password`
5. **Vercel**: *Add New → Project* → importa il repo GitHub (framework Next.js rilevato automaticamente).
   Variabili d'ambiente di produzione:
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `APP_BASE_URL` (es. `https://pasti.tuodominio.it`, deve essere https). Ogni push su `main` va in
   produzione; ogni PR ottiene un deploy di anteprima.
6. Apri `/admin`, accedi, crea le persone e distribuisci i link. Ogni amministratore può cambiare la propria
   password da *Password* nel menu o reimpostarla da *Password dimenticata?* nella pagina di accesso; in
   alternativa rilancia `scripts/create-admin.ts` con la stessa email e una nuova password.

Non committare mai `.env.local` (o altri file `.env*.local`): contengono chiavi di servizio.

## Struttura

- `supabase/migrations` — schema e funzioni (`apply_change`, `undo_change`, `season_default`, …)
- `src/lib` — logica pura condivisa (date, intervalli, cutoff)
- `src/server` — accesso al DB con service role, autenticazione
- `src/app` — pagine membro (`/`, `/periodo`), API, area `/admin`
- `tests/e2e` — smoke test Playwright (`npm run test:e2e`)
- `docs/superpowers/specs` — specifica di progetto
