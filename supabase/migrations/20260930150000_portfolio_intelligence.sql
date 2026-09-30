alter table public.portfolio_snapshots add column if not exists currency text default 'EUR' check (currency in ('EUR', 'USD', 'CHF', 'GBP'));

alter table public.investment_notes add column if not exists target_expectations text;
alter table public.investment_notes add column if not exists personal_notes text;
alter table public.investment_notes add column if not exists review_status text not null default 'UNREVIEWED';
alter table public.investment_notes add constraint investment_notes_review_status_check check (review_status in ('UNREVIEWED', 'UNCHANGED', 'STRENGTHENED', 'WEAKENED', 'INVALIDATED'));

create table if not exists public.asset_themes (
  asset_id uuid not null references public.assets(id) on delete cascade,
  theme text not null,
  confidence numeric(6, 5),
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  primary key (asset_id, theme)
);

alter table public.asset_themes enable row level security;
create policy "authenticated users read asset themes" on public.asset_themes for select to authenticated using (true);

create index if not exists investment_notes_asset_updated_idx on public.investment_notes(asset_id, updated_at desc);
create index if not exists asset_themes_theme_idx on public.asset_themes(theme);
