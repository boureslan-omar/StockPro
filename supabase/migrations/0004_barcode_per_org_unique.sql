-- Barcode uniqueness must be scoped per organization, not global. Two tenants
-- legitimately stocking the same manufacturer barcode (or generating an
-- internal EAN that happens to collide) would otherwise hit a false conflict.
alter table public.products drop constraint if exists products_barcode_key;
alter table public.products add constraint products_org_barcode_unique unique (organization_id, barcode);
