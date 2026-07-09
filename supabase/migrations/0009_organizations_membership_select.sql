-- org_self_select only allowed reading the org baked into the current JWT,
-- so the org switcher's embedded join (org_memberships -> organizations) came
-- back null for every membership except the currently-active one. Extend the
-- policy to also allow reading any organization the user holds a membership
-- row for, so the switcher can show every org's name/status, not just the
-- active one.
drop policy if exists "org_self_select" on public.organizations;
create policy "org_self_select" on public.organizations
  for select to authenticated
  using (
    id = public.current_org_id()
    or exists (
      select 1 from public.org_memberships
      where org_memberships.organization_id = organizations.id
        and org_memberships.user_id = auth.uid()
    )
  );
