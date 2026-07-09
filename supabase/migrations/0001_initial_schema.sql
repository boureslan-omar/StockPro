-- StockPro — Consolidated PostgreSQL schema for Supabase
-- Translated from MySQL (install.sql + upgrade12–17 + upgrade_all.php, v3.5.0)
--
-- Key conversions:
--   AUTO_INCREMENT      -> GENERATED ALWAYS AS IDENTITY
--   ENUM(...)           -> text + CHECK constraint
--   TINYINT(1)          -> boolean
--   TIMESTAMP           -> timestamptz (app timezone: Asia/Beirut, handled client-side)
--   users (custom auth) -> profiles + Supabase Auth (auth.users)

-- ─── updated_at helper ────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ─── Profiles (replaces MySQL `users`; linked to Supabase Auth) ──────────────
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  username   text unique,
  full_name  text not null default '',
  role       text not null default 'cashier' check (role in ('admin','cashier','stock')),
  is_active  boolean not null default true,
  created_at timestamptz not null default now()
);

-- First registered user becomes admin; everyone after that is a cashier
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    case when not exists (select 1 from public.profiles) then 'admin' else 'cashier' end
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── Settings ─────────────────────────────────────────────────────────────────
create table public.settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now()
);
create trigger settings_updated_at before update on public.settings
  for each row execute function public.set_updated_at();

insert into public.settings (key, value) values
  ('store_name',                'StockPro'),
  ('store_address',             ''),
  ('store_phone',               ''),
  ('exchange_rate',             '89750'),
  ('base_currency',             'USD'),
  ('auto_print_receipt',        '0'),
  ('cash_register_balance_usd', '0')
on conflict (key) do nothing;

-- ─── Lookup tables ────────────────────────────────────────────────────────────
create table public.categories (
  id         int generated always as identity primary key,
  name       text not null,
  created_at timestamptz not null default now()
);

create table public.suppliers (
  id         int generated always as identity primary key,
  name       text not null,
  phone      text,
  email      text,
  address    text,
  balance    numeric(10,2) not null default 0,
  created_at timestamptz not null default now()
);

-- ─── Customers ────────────────────────────────────────────────────────────────
create table public.customers (
  id         int generated always as identity primary key,
  name       text not null,
  phone      text,
  address    text,
  balance    numeric(10,2) not null default 0,  -- positive = credit, negative = debt
  note       text,
  created_at timestamptz not null default now()
);

-- ─── Products ─────────────────────────────────────────────────────────────────
create table public.products (
  id                      int generated always as identity primary key,
  barcode                 text unique,
  name                    text not null,
  category_id             int references public.categories(id) on delete set null,
  supplier_id             int references public.suppliers(id) on delete set null,
  product_type            text not null default 'regular' check (product_type in ('regular','bulk')),
  product_source          text not null default 'owned' check (product_source in ('owned','consignment')),
  consignment_supplier_id int references public.suppliers(id) on delete set null,
  consignment_cost        numeric(10,4) not null default 0,
  cost_price              numeric(10,4) not null default 0,
  sell_price              numeric(10,4) not null default 0,
  stock                   numeric(10,3) not null default 0,
  low_stock_alert         numeric(10,3) not null default 5,
  unit                    text default 'pcs',
  units_per_box           int not null default 1,
  sell_price_box          numeric(10,4),
  track_expiry            boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create trigger products_updated_at before update on public.products
  for each row execute function public.set_updated_at();

-- ─── Purchases ────────────────────────────────────────────────────────────────
create table public.purchases (
  id             int generated always as identity primary key,
  supplier_id    int references public.suppliers(id) on delete set null,
  reference      text,
  total_amount   numeric(10,2) not null default 0,
  payment_method text not null default 'pay_later'
                 check (payment_method in ('pay_later','cash_register','cash_owner','cash_register_lbp')),
  note           text,
  purchase_date  date not null,
  created_at     timestamptz not null default now()
);

-- ─── Batches (FIFO per-price batch tracking) ──────────────────────────────────
create table public.batches (
  id                 int generated always as identity primary key,
  product_id         int not null references public.products(id) on delete cascade,
  purchase_id        int references public.purchases(id) on delete set null,
  cost_price         numeric(10,4) not null,
  quantity_original  numeric(10,3) not null default 0,
  quantity_remaining numeric(10,3) not null default 0,
  purchase_date      date not null,
  expiry_date        date,
  note               text,
  created_at         timestamptz not null default now()
);
create index idx_batches_product on public.batches(product_id);

-- ─── Purchase Items ───────────────────────────────────────────────────────────
create table public.purchase_items (
  id           int generated always as identity primary key,
  purchase_id  int not null references public.purchases(id) on delete cascade,
  product_id   int references public.products(id) on delete cascade,
  product_name text not null,
  product_type text not null default 'regular' check (product_type in ('regular','consignment','bulk')),
  quantity     numeric(10,3) not null default 0,
  unit_cost    numeric(10,4) not null,
  total        numeric(10,2) not null default 0,
  batch_id     int references public.batches(id) on delete set null,
  batch_action text default 'new' check (batch_action in ('new','merged'))
);
create index idx_purchase_items_purchase on public.purchase_items(purchase_id);

-- ─── Sales ────────────────────────────────────────────────────────────────────
create table public.sales (
  id                 int generated always as identity primary key,
  receipt_no         text unique,
  customer_id        int references public.customers(id) on delete set null,
  subtotal           numeric(10,2) not null default 0,
  discount           numeric(10,2) not null default 0,
  credit_used        numeric(10,2) not null default 0,
  total              numeric(10,2) not null default 0,
  paid_usd           numeric(10,2) not null default 0,
  paid_lbp           numeric(15,2) not null default 0,
  change_usd         numeric(10,2) not null default 0,
  change_lbp         numeric(15,2) not null default 0,
  currency_paid      text default 'USD',
  exchange_rate_used numeric(15,2) not null default 0,
  payment_method     text default 'cash' check (payment_method in ('cash','card','mobile','account')),
  note               text,
  is_void            boolean not null default false,
  void_reason        text,
  voided_at          timestamptz,
  voided_by          uuid references public.profiles(id) on delete set null,
  sale_date          timestamptz not null default now()
);
create index idx_sales_date on public.sales(sale_date);
create index idx_sales_customer on public.sales(customer_id);

-- ─── Sale Items ───────────────────────────────────────────────────────────────
create table public.sale_items (
  id             int generated always as identity primary key,
  sale_id        int not null references public.sales(id) on delete cascade,
  product_id     int references public.products(id) on delete cascade,
  product_name   text not null,
  product_type   text not null default 'regular' check (product_type in ('regular','bulk')),
  is_consignment boolean not null default false,
  quantity       numeric(10,3) not null,
  unit_price     numeric(10,4) not null,
  unit_cost      numeric(10,4) not null default 0,
  total          numeric(10,2) not null
);
create index idx_sale_items_sale on public.sale_items(sale_id);

-- ─── Customer Ledger ──────────────────────────────────────────────────────────
create table public.customer_ledger (
  id          int generated always as identity primary key,
  customer_id int not null references public.customers(id) on delete cascade,
  sale_id     int references public.sales(id) on delete set null,
  type        text not null default 'sale' check (type in ('sale','payment','adjustment','refund')),
  amount      numeric(10,2) not null,
  note        text,
  created_at  timestamptz not null default now()
);
create index idx_customer_ledger_customer on public.customer_ledger(customer_id);

-- ─── Customer Prices (per-customer last agreed price) ─────────────────────────
create table public.customer_prices (
  id          int generated always as identity primary key,
  customer_id int not null references public.customers(id) on delete cascade,
  product_id  int not null references public.products(id) on delete cascade,
  last_price  numeric(10,4) not null,
  updated_at  timestamptz not null default now(),
  unique (customer_id, product_id)
);
create trigger customer_prices_updated_at before update on public.customer_prices
  for each row execute function public.set_updated_at();

-- ─── Expenses ─────────────────────────────────────────────────────────────────
create table public.expenses (
  id           int generated always as identity primary key,
  description  text not null,
  amount       numeric(10,2) not null,
  category     text default 'General',
  expense_date date not null,
  note         text,
  created_at   timestamptz not null default now()
);

-- ─── Cash Register Log (dual currency USD/LBP) ────────────────────────────────
create table public.cash_register_log (
  id                int generated always as identity primary key,
  type              text not null check (type in ('opening','sale','withdrawal','deposit','void','expense','refund')),
  currency          text not null default 'USD' check (currency in ('USD','LBP','BOTH')),
  amount_usd        numeric(10,2) not null,
  amount_lbp        numeric(15,2) not null default 0,
  note              text,
  sale_id           int references public.sales(id) on delete set null,
  balance_after_usd numeric(10,2) not null default 0,
  balance_after_lbp numeric(15,2) not null default 0,
  settled_by        uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);

-- ─── Cash Shifts (end of shift) ───────────────────────────────────────────────
create table public.cash_shifts (
  id              int generated always as identity primary key,
  closed_by       uuid references public.profiles(id) on delete set null,
  closed_at       timestamptz not null default now(),
  since_datetime  timestamptz,
  balance_usd     numeric(12,2) not null default 0,
  balance_lbp     numeric(12,2) not null default 0,
  sales_count     int not null default 0,
  sales_total_usd numeric(12,2) not null default 0,
  cash_in_usd     numeric(12,2) not null default 0,
  cash_in_lbp     numeric(12,2) not null default 0,
  cash_out_usd    numeric(12,2) not null default 0,
  cash_out_lbp    numeric(12,2) not null default 0,
  note            text
);

-- ─── Consignment ──────────────────────────────────────────────────────────────
create table public.consignment_ledger (
  id               int generated always as identity primary key,
  sale_id          int not null references public.sales(id) on delete cascade,
  product_id       int not null references public.products(id) on delete cascade,
  supplier_id      int not null references public.suppliers(id) on delete cascade,
  quantity         numeric(10,3) not null,
  sell_price       numeric(10,4) not null,
  consignment_cost numeric(10,4) not null,
  revenue          numeric(10,2) not null,
  supplier_due     numeric(10,2) not null,
  market_profit    numeric(10,2) not null,
  settled          boolean not null default false,
  sale_date        timestamptz not null default now()
);

create table public.consignment_settlements (
  id          int generated always as identity primary key,
  supplier_id int not null references public.suppliers(id) on delete cascade,
  amount_paid numeric(10,2) not null,
  note        text,
  settled_at  timestamptz not null default now()
);

-- ─── Supplier Ledger ──────────────────────────────────────────────────────────
create table public.supplier_ledger (
  id          int generated always as identity primary key,
  supplier_id int not null references public.suppliers(id) on delete cascade,
  purchase_id int references public.purchases(id) on delete set null,
  type        text not null default 'purchase' check (type in ('purchase','payment','adjustment','return')),
  amount      numeric(10,2) not null,
  note        text,
  created_at  timestamptz not null default now()
);
create index idx_supplier_ledger_supplier on public.supplier_ledger(supplier_id);

-- ─── Purchase Orders ──────────────────────────────────────────────────────────
create table public.purchase_orders (
  id                   int generated always as identity primary key,
  po_number            text unique,
  supplier_id          int not null references public.suppliers(id) on delete cascade,
  status               text default 'draft' check (status in ('draft','sent','confirmed','received','cancelled')),
  delivery_date        date,
  received_purchase_id int references public.purchases(id) on delete set null,
  note                 text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create trigger purchase_orders_updated_at before update on public.purchase_orders
  for each row execute function public.set_updated_at();

create table public.purchase_order_items (
  id                 int generated always as identity primary key,
  po_id              int not null references public.purchase_orders(id) on delete cascade,
  product_id         int references public.products(id) on delete set null,
  product_name       text not null,
  quantity           numeric(10,3) not null,
  unit               text default 'pcs',
  estimated_price    numeric(10,4) default 0,
  note               text,
  new_product_upb    smallint,
  new_product_source text not null default 'regular' check (new_product_source in ('regular','consignment'))
);

-- ─── Returns ──────────────────────────────────────────────────────────────────
create table public.customer_returns (
  id            int generated always as identity primary key,
  sale_id       int not null references public.sales(id) on delete cascade,
  sale_item_id  int not null references public.sale_items(id) on delete cascade,
  product_id    int references public.products(id) on delete set null,
  product_name  text not null,
  quantity      numeric(10,3) not null,
  unit_price    numeric(10,4) not null,
  refund_amount numeric(10,2) not null,
  note          text,
  return_date   date not null,
  created_at    timestamptz not null default now()
);
create index idx_cr_sale on public.customer_returns(sale_id);

create table public.supplier_returns (
  id            int generated always as identity primary key,
  batch_id      int not null references public.batches(id) on delete cascade,
  product_id    int not null references public.products(id) on delete cascade,
  product_name  text not null,
  supplier_id   int references public.suppliers(id) on delete set null,
  quantity      numeric(10,3) not null,
  unit_cost     numeric(10,4) not null,
  credit_amount numeric(10,2) not null,
  note          text,
  return_date   date not null,
  created_at    timestamptz not null default now()
);
create index idx_sr_supplier on public.supplier_returns(supplier_id);

-- ─── Wastage ──────────────────────────────────────────────────────────────────
create table public.wastage (
  id           int generated always as identity primary key,
  product_id   int not null references public.products(id) on delete cascade,
  product_name text,
  quantity     numeric(10,3) not null,
  unit         text,
  unit_cost    numeric(10,4) default 0,
  reason       text not null check (reason in ('expired','damaged','owner_use','sample','lost','other')),
  reason_note  text,
  wastage_date date not null,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ─── Stock Audits ─────────────────────────────────────────────────────────────
create table public.audit_sessions (
  id         int generated always as identity primary key,
  audit_date date not null,
  status     text default 'completed' check (status in ('in_progress','completed','applied')),
  note       text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.audit_items (
  id           int generated always as identity primary key,
  audit_id     int not null references public.audit_sessions(id) on delete cascade,
  product_id   int not null references public.products(id) on delete cascade,
  product_name text,
  system_qty   numeric(10,3) not null,
  physical_qty numeric(10,3) not null,
  unit         text,
  note         text
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- Internal single-tenant app: any authenticated, active user gets access;
-- fine-grained role checks (admin/cashier/stock) are enforced in the app layer.
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','settings','categories','suppliers','customers','products',
    'purchases','batches','purchase_items','sales','sale_items',
    'customer_ledger','customer_prices','expenses','cash_register_log',
    'cash_shifts','consignment_ledger','consignment_settlements',
    'supplier_ledger','purchase_orders','purchase_order_items',
    'customer_returns','supplier_returns','wastage','audit_sessions','audit_items'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy "authenticated_all" on public.%I for all to authenticated using (true) with check (true)', t
    );
  end loop;
end $$;

-- ─── Seed data ────────────────────────────────────────────────────────────────
insert into public.categories (name) values
  ('Beverages'),('Snacks'),('Dairy'),('Bakery'),('Cleaning'),
  ('Personal Care'),('Frozen'),('Vegetables & Fruits'),('Other');

insert into public.suppliers (name, phone) values ('Default Supplier','000-000-0000');
