-- ============================================================
-- BALLING WHOLESALE PORTAL — Esquema inicial Supabase
-- Migrado desde el modelo validado en Google Sheets
-- ============================================================
-- Cómo usar: copiar todo este archivo y pegarlo en
-- Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- Limpieza si se corre de nuevo en desarrollo
drop table if exists order_lines cascade;
drop table if exists order_requests cascade;
drop table if exists draft_cart cascade;
drop table if exists promotions cascade;
drop table if exists vat_rules cascade;
drop table if exists customer_discounts cascade;
drop table if exists customers cascade;
drop table if exists stock_eu cascade;
drop table if exists stock_uk cascade;
drop table if exists products cascade;

-- ============================================================
-- PRODUCTS (una fila por SKU)
-- ============================================================
create table products (
  sku text primary key,
  product_group text not null,
  ean text,
  product_name text not null,
  category text not null check (category in ('Sticks','Bags','Accessories','Apparel','Shoes')),
  size text not null,
  base_price_gbp numeric(10,2) not null,
  base_price_eur numeric(10,2) not null,
  image_url text,
  active boolean not null default true,
  created_at timestamptz default now()
);

-- ============================================================
-- STOCK (separado por warehouse, como en Sheets)
-- ============================================================
create table stock_uk (
  sku text primary key references products(sku) on delete cascade,
  stock integer not null default 0
);

create table stock_eu (
  sku text primary key references products(sku) on delete cascade,
  stock integer not null default 0
);

-- ============================================================
-- CUSTOMERS
-- ============================================================
create table customers (
  customer_id text primary key,
  customer_name text not null,
  contact_name text,
  email_login text unique not null,
  country text,
  region text,
  warehouse text not null check (warehouse in ('UK','EU')),
  currency text not null check (currency in ('GBP','EUR')),
  vat_rule text not null,
  shipping_rule text,
  active boolean not null default true,
  -- vínculo con auth de Supabase, se completa al crear el login
  auth_user_id uuid unique,
  created_at timestamptz default now()
);

-- ============================================================
-- CUSTOMER DISCOUNTS (% por categoría, una fila por cliente)
-- ============================================================
create table customer_discounts (
  customer_id text primary key references customers(customer_id) on delete cascade,
  sticks_pct numeric(5,2) not null default 0,
  bags_pct numeric(5,2) not null default 0,
  accessories_pct numeric(5,2) not null default 0,
  apparel_pct numeric(5,2) not null default 0,
  shoes_pct numeric(5,2) not null default 0
);

-- ============================================================
-- VAT RULES
-- ============================================================
create table vat_rules (
  vat_rule text primary key,
  vat_pct numeric(5,2) not null
);

-- ============================================================
-- PROMOTIONS
-- ============================================================
create table promotions (
  promo_id text primary key,
  promo_name text not null,
  category text not null,
  extra_discount_pct numeric(5,2) not null,
  start_date date not null,
  end_date date not null,
  active boolean not null default true
);

-- ============================================================
-- DRAFT CART (carrito persistente por cliente)
-- Único por (customer_id, sku) — UPSERT en vez de duplicar filas
-- ============================================================
create table draft_cart (
  customer_id text not null references customers(customer_id) on delete cascade,
  sku text not null references products(sku) on delete cascade,
  qty integer not null check (qty >= 0),
  updated_at timestamptz default now(),
  primary key (customer_id, sku)
);

-- ============================================================
-- ORDER REQUESTS (cabecera de pedido confirmado)
-- ============================================================
create table order_requests (
  order_id uuid primary key default gen_random_uuid(),
  customer_id text not null references customers(customer_id),
  order_date timestamptz default now(),
  currency text not null,
  list_total numeric(10,2) not null,
  customer_discount_total numeric(10,2) not null,
  promo_discount_total numeric(10,2) not null,
  net_total numeric(10,2) not null,
  vat_total numeric(10,2) not null,
  grand_total numeric(10,2) not null,
  status text not null default 'submitted' check (status in ('submitted','confirmed','shipped','cancelled'))
);

-- ============================================================
-- ORDER LINES (detalle de cada pedido)
-- ============================================================
create table order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references order_requests(order_id) on delete cascade,
  sku text not null references products(sku),
  product_name text not null,
  size text not null,
  qty integer not null,
  list_price numeric(10,2) not null,
  customer_discount_pct numeric(5,2) not null,
  promo_discount_pct numeric(5,2) not null,
  final_unit_price numeric(10,2) not null,
  line_total numeric(10,2) not null
);

-- ============================================================
-- ÍNDICES para performance en las consultas más frecuentes
-- ============================================================
create index idx_products_group on products(product_group);
create index idx_products_category on products(category);
create index idx_draft_cart_customer on draft_cart(customer_id);
create index idx_order_requests_customer on order_requests(customer_id);
create index idx_order_lines_order on order_lines(order_id);

-- ============================================================
-- ROW LEVEL SECURITY: cada cliente solo ve sus propios datos
-- ============================================================
alter table customers enable row level security;
alter table draft_cart enable row level security;
alter table order_requests enable row level security;
alter table order_lines enable row level security;

-- Los clientes pueden ver/editar solo su propio carrito
create policy "customers manage own draft cart"
  on draft_cart for all
  using (
    customer_id = (select customer_id from customers where auth_user_id = auth.uid())
  );

-- Los clientes pueden ver solo sus propios pedidos
create policy "customers view own orders"
  on order_requests for select
  using (
    customer_id = (select customer_id from customers where auth_user_id = auth.uid())
  );

create policy "customers view own order lines"
  on order_lines for select
  using (
    order_id in (
      select order_id from order_requests
      where customer_id = (select customer_id from customers where auth_user_id = auth.uid())
    )
  );

-- Los clientes pueden ver su propio registro de customer
create policy "customers view own record"
  on customers for select
  using (auth_user_id = auth.uid());

-- Products, stock, discounts, vat, promotions: lectura pública
-- (no contienen datos sensibles de un cliente específico, pero
-- el filtrado de descuento/stock correcto se hace en la app)
alter table products enable row level security;
create policy "anyone can read active products"
  on products for select
  using (active = true);
