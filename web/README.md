# StockPro

Multi-tenant warehouse/wholesale POS & inventory management app. Next.js 16 (App Router) + Supabase.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project URL/keys
npm run dev
```

Open [http://localhost:3100](http://localhost:3100).

## Stack

- Next.js 16, App Router, Turbopack, TypeScript, Tailwind v4
- Supabase: Postgres + Auth + Storage + Row Level Security
- Multi-tenant: every business table is scoped by `organization_id`; one login can belong to
  several organizations via `org_memberships` and switch between them

## Project layout

- `src/app/(app)/<module>/` — one folder per feature (pos, products, purchases, suppliers, customers,
  quotations, returns, wastage, audits, expenses, cash-register, reports, settings)
- `src/lib/supabase/` — `server.ts`/`client.ts` (RLS-scoped clients), `admin.ts` (service-role, server-only)
- `../supabase/migrations/*.sql` — applied via the Supabase Management API

See `../CLAUDE.md` for fuller architecture notes and business rules.

## Deploying

Deployed on Vercel. Cron jobs (`vercel.json`) hit `/api/cron/*` routes for expiry scanning and daily backups —
both require `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY` to be set in the Vercel project's environment variables.
