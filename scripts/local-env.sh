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
APP_BASE_URL=http://localhost:3100
ENV
echo "wrote .env.local"
