-- Private bucket for per-organization JSON data backups. Never made public;
-- only ever read/written via the service-role key (daily cron + the manual
-- "Back Up Now" button), which bypasses storage RLS entirely, so no bucket
-- policies are needed here.
insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;
