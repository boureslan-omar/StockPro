-- Multi-tenant foundation for StockPro-as-a-SaaS.
-- Isolation model: each user's JWT app_metadata carries organization_id (set only
-- by the developer provisioning script via the Admin API — never by the user).
-- RLS on every business table checks that claim, so existing app code needs no
-- per-query org filters: INSERTs get organization_id via a column default,
-- SELECT/UPDATE/DELETE are filtered automatically by policy.

create extension if not exists pgcrypto;

-- ─── JWT-claim helper (avoids recursive RLS on profiles) ─────────────────────
create or replace function public.current_org_id()
returns uuid
language sql
stable
as $$
  select (auth.jwt() -> 'app_metadata' ->> 'organization_id')::uuid
$$;

create or replace function public.current_org_role()
returns text
language sql
stable
as $$
  select auth.jwt() -> 'app_metadata' ->> 'role'
$$;

-- ─── Organizations (tenants) ──────────────────────────────────────────────────
create table public.organizations (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  slug           text unique not null,
  license_key    text unique not null,
  license_status text not null default 'active' check (license_status in ('active','suspended','cancelled')),
  created_at     timestamptz not null default now()
);

alter table public.organizations enable row level security;
create policy "org_self_select" on public.organizations
  for select to authenticated
  using (id = public.current_org_id());

-- ─── Profiles: replace the old "first signup = admin" trigger ───────────────
-- Provisioning now happens via service-role Admin API with app_metadata already
-- set, so the trigger just mirrors those claims onto the profiles row.
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, full_name, role, organization_id)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_app_meta_data->>'role', 'admin'),
    (new.raw_app_meta_data->>'organization_id')::uuid
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles add column organization_id uuid references public.organizations(id);
alter table public.profiles add column is_platform_admin boolean not null default false;

drop policy if exists "authenticated_all" on public.profiles;
create policy "profiles_same_org" on public.profiles
  for select to authenticated
  using (id = auth.uid() or organization_id = public.current_org_id());
create policy "profiles_self_update" on public.profiles
  for update to authenticated
  using (id = auth.uid());

-- ─── Add organization_id to every business table, backfilled below ──────────
do $$
declare t text;
begin
  foreach t in array array[
    'categories','suppliers','customers','products',
    'purchases','batches','purchase_items','sales','sale_items',
    'customer_ledger','customer_prices','expenses','cash_register_log',
    'cash_shifts','consignment_ledger','consignment_settlements',
    'supplier_ledger','purchase_orders','purchase_order_items',
    'customer_returns','supplier_returns','wastage','audit_sessions','audit_items'
  ] loop
    execute format('alter table public.%I add column organization_id uuid references public.organizations(id)', t);
  end loop;
end $$;

-- settings was keyed globally by `key`; make it per-org
alter table public.settings drop constraint settings_pkey;
alter table public.settings add column organization_id uuid references public.organizations(id);

-- ─── Backfill: fold all existing data + the existing user into one org ───────
insert into public.organizations (name, slug, license_key)
values ('Default Organization', 'default', 'LIC-' || upper(substr(md5(random()::text), 1, 12)))
returning id;

do $$
declare
  v_org_id uuid;
  t text;
begin
  select id into v_org_id from public.organizations where slug = 'default';

  foreach t in array array[
    'categories','suppliers','customers','products',
    'purchases','batches','purchase_items','sales','sale_items',
    'customer_ledger','customer_prices','expenses','cash_register_log',
    'cash_shifts','consignment_ledger','consignment_settlements',
    'supplier_ledger','purchase_orders','purchase_order_items',
    'customer_returns','supplier_returns','wastage','audit_sessions','audit_items',
    'settings'
  ] loop
    execute format('update public.%I set organization_id = %L where organization_id is null', t, v_org_id);
  end loop;

  update public.profiles set organization_id = v_org_id, role = 'admin' where organization_id is null;

  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('organization_id', v_org_id::text, 'role', 'admin')
  where id in (select id from public.profiles where organization_id = v_org_id);
end $$;

-- Categories reset: business owners rebuild their own category tree from scratch.
delete from public.categories;

-- ─── Enforce not-null + default now that every row has an org ───────────────
do $$
declare t text;
begin
  foreach t in array array[
    'categories','suppliers','customers','products',
    'purchases','batches','purchase_items','sales','sale_items',
    'customer_ledger','customer_prices','expenses','cash_register_log',
    'cash_shifts','consignment_ledger','consignment_settlements',
    'supplier_ledger','purchase_orders','purchase_order_items',
    'customer_returns','supplier_returns','wastage','audit_sessions','audit_items',
    'settings'
  ] loop
    execute format('alter table public.%I alter column organization_id set default public.current_org_id()', t);
    execute format('alter table public.%I alter column organization_id set not null', t);
  end loop;
end $$;

alter table public.settings add primary key (organization_id, key);

-- ─── Replace single-tenant RLS with org-isolated policies ────────────────────
do $$
declare t text;
begin
  foreach t in array array[
    'categories','suppliers','customers','products',
    'purchases','batches','purchase_items','sales','sale_items',
    'customer_ledger','customer_prices','expenses','cash_register_log',
    'cash_shifts','consignment_ledger','consignment_settlements',
    'supplier_ledger','purchase_orders','purchase_order_items',
    'customer_returns','supplier_returns','wastage','audit_sessions','audit_items',
    'settings'
  ] loop
    execute format('drop policy if exists "authenticated_all" on public.%I', t);
    execute format(
      'create policy "org_isolation" on public.%I for all to authenticated using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id())', t
    );
  end loop;
end $$;
