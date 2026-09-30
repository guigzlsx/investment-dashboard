alter function public.set_updated_at() set search_path = public, pg_temp;

create index if not exists investment_notes_portfolio_id_idx on public.investment_notes(portfolio_id);
create index if not exists investment_notes_user_id_idx on public.investment_notes(user_id);
create index if not exists market_data_cache_asset_id_idx on public.market_data_cache(asset_id);
create index if not exists price_alerts_asset_id_idx on public.price_alerts(asset_id);
create index if not exists price_alerts_user_id_idx on public.price_alerts(user_id);
create index if not exists watchlist_items_asset_id_idx on public.watchlist_items(asset_id);
