create extension if not exists pgcrypto;

create type public.asset_type as enum ('STOCK', 'ETF');
create type public.transaction_type as enum ('BUY', 'SELL', 'DIVIDEND', 'SPLIT', 'DEPOSIT', 'WITHDRAWAL');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  base_currency text not null default 'EUR' check (base_currency in ('EUR', 'USD', 'CHF', 'GBP')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  base_currency text not null default 'EUR' check (base_currency in ('EUR', 'USD', 'CHF', 'GBP')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  name text not null,
  exchange text,
  exchange_name text,
  isin text,
  currency text check (currency is null or currency in ('EUR', 'USD', 'CHF', 'GBP')),
  asset_type public.asset_type,
  country text,
  sector text,
  industry text,
  logo_url text,
  provider_symbols jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (symbol, exchange)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  asset_id uuid references public.assets(id) on delete restrict,
  type public.transaction_type not null,
  quantity numeric(24, 10),
  price numeric(24, 10),
  currency text not null check (currency in ('EUR', 'USD', 'CHF', 'GBP')),
  quote_currency text check (quote_currency is null or quote_currency in ('EUR', 'USD', 'CHF', 'GBP')),
  fees numeric(24, 10) not null default 0 check (fees >= 0),
  fx_rate_to_base numeric(24, 12) check (fx_rate_to_base is null or fx_rate_to_base > 0),
  fx_rate_as_of date,
  fx_source text,
  executed_at timestamptz not null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint transaction_quantity_is_valid check (quantity is null or quantity > 0),
  constraint transaction_price_is_valid check (price is null or price >= 0)
);

create table public.watchlists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'Main watchlist',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.watchlist_items (
  id uuid primary key default gen_random_uuid(),
  watchlist_id uuid not null references public.watchlists(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  personal_note text,
  target_price numeric(24, 10),
  target_currency text check (target_currency is null or target_currency in ('EUR', 'USD', 'CHF', 'GBP')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (watchlist_id, asset_id)
);

create table public.investment_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_id uuid references public.portfolios(id) on delete cascade,
  asset_id uuid references public.assets(id) on delete cascade,
  thesis text,
  horizon text,
  risks text,
  invalidation_conditions text,
  status text not null default 'ACTIVE' check (status in ('ACTIVE', 'REVIEWED', 'ARCHIVED')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  asset_id uuid not null references public.assets(id) on delete cascade,
  condition_type text not null check (condition_type in ('ABOVE', 'BELOW', 'CHANGE_PERCENT')),
  threshold numeric(24, 10) not null,
  currency text check (currency is null or currency in ('EUR', 'USD', 'CHF', 'GBP')),
  enabled boolean not null default true,
  cooldown_hours integer not null default 24 check (cooldown_hours >= 0),
  last_triggered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.portfolio_snapshots (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios(id) on delete cascade,
  captured_at timestamptz not null default now(),
  total_value_base numeric(24, 10),
  invested_cost_base numeric(24, 10),
  pnl_base numeric(24, 10),
  cash_base numeric(24, 10),
  fx_source text,
  data_quality text not null default 'UNKNOWN' check (data_quality in ('COMPLETE', 'PARTIAL', 'UNKNOWN')),
  created_at timestamptz not null default now()
);

create table public.fx_rates (
  id uuid primary key default gen_random_uuid(),
  from_currency text not null check (from_currency in ('EUR', 'USD', 'CHF', 'GBP')),
  to_currency text not null check (to_currency in ('EUR', 'USD', 'CHF', 'GBP')),
  rate numeric(24, 12) not null check (rate > 0),
  as_of_date date not null,
  source text not null,
  fetched_at timestamptz not null default now(),
  unique (from_currency, to_currency, as_of_date, source)
);

create table public.market_quotes (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.assets(id) on delete cascade,
  price numeric(24, 10),
  currency text check (currency is null or currency in ('EUR', 'USD', 'CHF', 'GBP')),
  change_1d numeric(24, 10),
  change_1d_percent numeric(24, 10),
  market_cap numeric(30, 10),
  volume numeric(30, 10),
  data_kind text not null default 'UNKNOWN' check (data_kind in ('REALTIME', 'DELAYED', 'EOD', 'UNKNOWN')),
  as_of timestamptz,
  fetched_at timestamptz not null default now(),
  source text not null,
  source_endpoint text not null
);

create table public.market_data_cache (
  id uuid primary key default gen_random_uuid(),
  cache_key text not null,
  resource_type text not null,
  asset_id uuid references public.assets(id) on delete cascade,
  provider text not null,
  payload jsonb not null,
  as_of_date date,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  unique (cache_key, provider)
);

create index portfolios_user_id_idx on public.portfolios(user_id);
create index assets_symbol_idx on public.assets(symbol);
create index transactions_portfolio_executed_at_idx on public.transactions(portfolio_id, executed_at);
create index transactions_asset_id_idx on public.transactions(asset_id);
create index watchlist_items_watchlist_id_idx on public.watchlist_items(watchlist_id);
create index portfolio_snapshots_portfolio_captured_at_idx on public.portfolio_snapshots(portfolio_id, captured_at);
create index market_quotes_asset_fetched_at_idx on public.market_quotes(asset_id, fetched_at desc);
create index market_data_cache_expires_at_idx on public.market_data_cache(expires_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger portfolios_set_updated_at before update on public.portfolios for each row execute function public.set_updated_at();
create trigger assets_set_updated_at before update on public.assets for each row execute function public.set_updated_at();
create trigger watchlists_set_updated_at before update on public.watchlists for each row execute function public.set_updated_at();
create trigger watchlist_items_set_updated_at before update on public.watchlist_items for each row execute function public.set_updated_at();
create trigger investment_notes_set_updated_at before update on public.investment_notes for each row execute function public.set_updated_at();
create trigger price_alerts_set_updated_at before update on public.price_alerts for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.portfolios enable row level security;
alter table public.assets enable row level security;
alter table public.transactions enable row level security;
alter table public.watchlists enable row level security;
alter table public.watchlist_items enable row level security;
alter table public.investment_notes enable row level security;
alter table public.price_alerts enable row level security;
alter table public.portfolio_snapshots enable row level security;
alter table public.fx_rates enable row level security;
alter table public.market_quotes enable row level security;
alter table public.market_data_cache enable row level security;

create policy "profiles are private" on public.profiles for all to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "users manage their portfolios" on public.portfolios for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "authenticated users read assets" on public.assets for select to authenticated using (true);
create policy "authenticated users read FX rates" on public.fx_rates for select to authenticated using (true);
create policy "authenticated users read market quotes" on public.market_quotes for select to authenticated using (true);
create policy "authenticated users read market cache" on public.market_data_cache for select to authenticated using (true);

create policy "users manage portfolio transactions" on public.transactions for all to authenticated
  using (exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = (select auth.uid())));

create policy "users manage watchlists" on public.watchlists for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "users manage watchlist items" on public.watchlist_items for all to authenticated
  using (exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = (select auth.uid())))
  with check (exists (select 1 from public.watchlists w where w.id = watchlist_id and w.user_id = (select auth.uid())));

create policy "users manage investment notes" on public.investment_notes for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "users manage price alerts" on public.price_alerts for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "users read portfolio snapshots" on public.portfolio_snapshots for select to authenticated
  using (exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = (select auth.uid())));

-- Positions are intentionally not stored. They are rebuilt from transactions
-- by the domain calculation layer so cost basis cannot drift from the ledger.
