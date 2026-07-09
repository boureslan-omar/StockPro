-- Real multi-organization membership: one auth user can belong to several
-- organizations (e.g. an owner running two separate businesses) and switch
-- between them. current_org_id() keeps reading JWT app_metadata exactly as
-- before — every existing RLS policy on every business table is untouched.
-- "Switching" means: verify membership here, then rewrite the user's
-- app_metadata.organization_id via the Admin API and force a session refresh
-- so the JWT picks up the new claim.
create table public.org_memberships (
  id               int generated always as identity primary key,
  user_id          uuid not null references auth.users(id) on delete cascade,
  organization_id  uuid not null references public.organizations(id) on delete cascade,
  role             text not null default 'cashier' check (role in ('admin','cashier','stock')),
  created_at       timestamptz not null default now(),
  unique (user_id, organization_id)
);
alter table public.org_memberships enable row level security;
create policy "own_memberships" on public.org_memberships
  for select to authenticated
  using (user_id = auth.uid());

-- Backfill: every existing profile's current org becomes its first membership.
insert into public.org_memberships (user_id, organization_id, role)
select id, organization_id, role from public.profiles
where organization_id is not null
on conflict (user_id, organization_id) do nothing;
