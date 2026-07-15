-- Per-organization Google Drive connection for backups. One row per org; the
-- refresh token is only ever read/written by the service-role admin client
-- (never exposed to the browser), so RLS just needs to keep it out of reach
-- of normal authenticated queries entirely.
create table public.google_drive_connections (
  organization_id  uuid primary key references public.organizations(id) on delete cascade,
  connected_email  text not null,
  refresh_token    text not null,
  folder_id        text not null,
  connected_at     timestamptz not null default now()
);
alter table public.google_drive_connections enable row level security;
-- No policies created: only the service-role client (which bypasses RLS)
-- ever touches this table, by design.
