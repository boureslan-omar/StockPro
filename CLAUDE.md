# StockPro — Claude Context

StockPro is a multi-tenant warehouse/wholesale POS & inventory SaaS. The original PHP/XAMPP prototype
(dahdouh mini-market fork) has been fully replaced by a Next.js + Supabase rewrite — this repo now
contains only the current app.

## Core identity
- **Product:** Multi-tenant warehouse & wholesale management system (POS, inventory, purchasing, reports)
- Repo root: this directory. App code lives under `web/`.
- Deployed: Vercel (`stockpro-drab.vercel.app`), Supabase (Postgres + Auth + Storage)

## Tech stack
- Next.js 16 (App Router, Turbopack), TypeScript, Tailwind v4
- Supabase: Postgres + Auth + Storage + RLS
- `lucide-react` for icons

## Architecture
- `web/src/app/(app)/<module>/` — one folder per feature (pos, products, purchases, purchase-orders,
  suppliers, customers, quotations, returns, wastage, audits, expenses, cash-register, reports, settings)
  Each typically has `page.tsx` (Server Component, data fetch) + a `*-client.tsx` (interactivity) + `actions.ts` (Server Actions)
- `web/src/app/(app)/app-shell.tsx` — sidebar/topbar shell shared by all authenticated pages
- `web/src/app/(app)/org-actions.ts`, `org-switcher.tsx` — multi-org membership & switching
- `web/src/lib/supabase/` — `server.ts`/`client.ts` (RLS-scoped) and `admin.ts` (service-role, server-only)
- `web/src/lib/org.ts` — `getCurrentOrg()`: fetch the current org explicitly by id (don't rely on RLS + `.single()`)
- `supabase/migrations/*.sql` — applied via the Supabase Management API (no local Supabase CLI in this workflow)

## Multi-tenancy
- `organizations` is the tenant table; every business table has an `organization_id` column + RLS scoped to it
- `current_org_id()` (SQL function) reads `organization_id` from the JWT's `app_metadata`
- `org_memberships` (user_id, organization_id, role) lets one login belong to multiple orgs
- Switching orgs = rewriting the user's `app_metadata.organization_id` via the Admin API, then
  `supabase.auth.refreshSession()` + full navigation reload — no RLS policy needs to change for this
- Any unique constraint on business data (barcode, receipt_no, po_number, etc.) must be scoped
  `unique(organization_id, ...)`, never global

## Key business rules
- All prices stored in **USD**; LBP is a display-only conversion via the exchange rate in `settings`
- FIFO batch stock for regular products; `product_type: "bulk"` items skip batch tracking
- Customer/supplier ledger sign convention: positive = credit (we owe them / they've overpaid), negative = debt

## Gotchas worth remembering
- Server Action thrown errors get redacted to a generic message in production builds — return
  `{ ok, message }` from actions that can meaningfully fail instead of throwing
- Broadening an RLS SELECT policy can silently break code elsewhere that assumed `.single()`/`.maybeSingle()`
  always got exactly one row — audit callers when a policy is loosened
- Read this repo's own `web/AGENTS.md` before touching Next.js APIs — this version has breaking changes
  vs. what most training data expects

## Security rules
- `SUPABASE_SERVICE_ROLE_KEY` is server-only (used for org switching, admin backfills) — never expose to the client
- Supabase personal access tokens used for one-off migrations should be revoked once the migration is applied
