-- ─── Quotations ───────────────────────────────────────────────────────────────
-- Price estimates for a customer that never touch live inventory (no stock/batch
-- deduction). A quotation can later be "converted" by handing its line items to
-- POS, where a real sale is created through the normal checkout path.
create table public.quotations (
  id                 int generated always as identity primary key,
  organization_id    uuid not null references public.organizations(id) default public.current_org_id(),
  quote_number       text,
  customer_id        int references public.customers(id) on delete set null,
  customer_name      text,
  status             text not null default 'draft' check (status in ('draft','sent','accepted','rejected','expired','converted')),
  valid_until        date,
  note               text,
  converted_sale_id  int references public.sales(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint quotations_org_number_unique unique (organization_id, quote_number)
);
create trigger quotations_updated_at before update on public.quotations
  for each row execute function public.set_updated_at();
alter table public.quotations enable row level security;
create policy "org_isolation" on public.quotations for all to authenticated
  using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());

create table public.quotation_items (
  id               int generated always as identity primary key,
  organization_id  uuid not null references public.organizations(id) default public.current_org_id(),
  quotation_id     int not null references public.quotations(id) on delete cascade,
  product_id       int references public.products(id) on delete set null,
  product_name     text not null,
  unit             text default 'pcs',
  quantity         numeric(10,3) not null,
  unit_price       numeric(10,4) not null,
  total            numeric(10,2) not null
);
create index idx_quotation_items_quotation on public.quotation_items(quotation_id);
alter table public.quotation_items enable row level security;
create policy "org_isolation" on public.quotation_items for all to authenticated
  using (organization_id = public.current_org_id()) with check (organization_id = public.current_org_id());
