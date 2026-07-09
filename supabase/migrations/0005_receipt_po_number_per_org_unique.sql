-- Same class of bug as 0004: receipt_no and po_number were globally unique
-- from the pre-multi-tenant schema. Scope both per organization so two
-- tenants' independently-numbered receipts/POs never collide.
alter table public.sales drop constraint if exists sales_receipt_no_key;
alter table public.sales add constraint sales_org_receipt_no_unique unique (organization_id, receipt_no);

alter table public.purchase_orders drop constraint if exists purchase_orders_po_number_key;
alter table public.purchase_orders add constraint purchase_orders_org_po_number_unique unique (organization_id, po_number);
