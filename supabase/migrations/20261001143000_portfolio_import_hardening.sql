create or replace function public.commit_portfolio_import(p_import_id uuid, p_skip_duplicates boolean default true)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_import public.portfolio_imports%rowtype;
  v_row record;
  v_data jsonb;
  v_asset_id uuid;
  v_asset_count integer := 0;
  v_imported_count integer := 0;
  v_duplicate_count integer := 0;
  v_ignored_count integer := 0;
  v_symbol text;
  v_name text;
  v_isin text;
  v_exchange text;
  v_asset_type public.asset_type;
  v_type public.transaction_type;
  v_quantity numeric;
  v_price numeric;
  v_currency text;
  v_fees numeric;
  v_executed_at timestamptz;
  v_fx_rate numeric;
  v_base_currency text;
begin
  if v_user_id is null then raise exception 'AUTH_REQUIRED'; end if;
  select * into v_import from public.portfolio_imports where id = p_import_id and user_id = v_user_id for update;
  if not found then raise exception 'IMPORT_NOT_FOUND'; end if;
  if not exists (select 1 from public.portfolios p where p.id = v_import.portfolio_id and p.user_id = v_user_id) then raise exception 'IMPORT_NOT_FOUND'; end if;
  if v_import.state = 'IMPORTED' then
    return jsonb_build_object('importId', v_import.id, 'state', 'IMPORTED', 'transactionsImported', v_import.imported_count, 'assetsAdded', 0, 'duplicatesSkipped', v_import.duplicate_count, 'rowsIgnored', v_import.error_count + v_import.warning_count, 'warnings', v_import.warning_count);
  end if;
  if v_import.state <> 'READY' then raise exception 'IMPORT_NOT_READY'; end if;
  select upper(base_currency) into v_base_currency from public.portfolios where id = v_import.portfolio_id;

  for v_row in select * from public.portfolio_import_rows where import_id = v_import.id and user_id = v_user_id order by source_row loop
    v_data := v_row.normalized_data;
    if v_row.status in ('ERROR', 'UNSUPPORTED') then v_ignored_count := v_ignored_count + 1; continue; end if;
    if p_skip_duplicates and v_row.status = 'DUPLICATE' then v_duplicate_count := v_duplicate_count + 1; continue; end if;
    v_symbol := upper(nullif(trim(v_data->>'symbol'), ''));
    v_name := nullif(trim(v_data->>'name'), '');
    v_isin := upper(nullif(trim(v_data->>'isin'), ''));
    v_exchange := upper(nullif(trim(v_data->>'exchange'), ''));
    v_type := (v_data->>'transactionType')::public.transaction_type;
    v_quantity := (v_data->>'quantity')::numeric;
    v_price := (v_data->>'price')::numeric;
    v_currency := upper(v_data->>'currency');
    v_fees := coalesce((v_data->>'fees')::numeric, 0);
    v_executed_at := (v_data->>'transactionDate')::timestamptz;
    v_fx_rate := nullif((v_data->>'fxRateToBase')::numeric, 0);
    if v_symbol is null or v_name is null or v_type not in ('BUY', 'SELL') or v_quantity is null or v_quantity <= 0 or v_price is null or v_price < 0 or v_currency not in ('EUR', 'USD', 'GBP', 'CHF') or v_executed_at is null or v_fees < 0 or (v_currency <> v_base_currency and (v_fx_rate is null or v_fx_rate <= 0)) then
      raise exception 'INVALID_IMPORT_ROW_%', v_row.source_row;
    end if;
    v_asset_id := null;
    if v_isin is not null then select id into v_asset_id from public.assets where upper(isin) = v_isin order by created_at limit 1; end if;
    if v_asset_id is null then select id into v_asset_id from public.assets where upper(symbol) = v_symbol and exchange is not distinct from v_exchange order by created_at limit 1; end if;
    if v_asset_id is null then
      v_asset_type := case when upper(coalesce(v_data->>'assetType', '')) = 'ETF' then 'ETF'::public.asset_type else 'STOCK'::public.asset_type end;
      insert into public.assets (symbol, name, isin, exchange, currency, asset_type, provider_symbols) values (v_symbol, v_name, v_isin, v_exchange, v_currency, v_asset_type, jsonb_build_object('import', true)) returning id into v_asset_id;
      v_asset_count := v_asset_count + 1;
    end if;
    if exists (select 1 from public.transactions t where t.portfolio_id = v_import.portfolio_id and t.asset_id = v_asset_id and t.type = v_type and t.quantity = v_quantity and t.price = v_price and t.currency = v_currency and t.executed_at::date = v_executed_at::date) and p_skip_duplicates then
      v_duplicate_count := v_duplicate_count + 1;
      continue;
    end if;
    insert into public.transactions (portfolio_id, asset_id, type, quantity, price, currency, quote_currency, fees, fx_rate_to_base, fx_rate_as_of, fx_source, executed_at, metadata)
    values (v_import.portfolio_id, v_asset_id, v_type, v_quantity, v_price, v_currency, v_currency, v_fees, coalesce(v_fx_rate, case when v_currency = v_base_currency then 1 else null end), v_executed_at::date, case when v_currency = v_base_currency then 'same_currency' else 'import' end, v_executed_at, jsonb_build_object('source', 'portfolio_import', 'import_id', v_import.id, 'source_row', v_row.source_row));
    v_imported_count := v_imported_count + 1;
  end loop;
  update public.portfolio_imports set state = 'IMPORTED', imported_count = v_imported_count, duplicate_count = v_duplicate_count, updated_at = now() where id = v_import.id;
  delete from public.portfolio_import_rows where import_id = v_import.id;
  return jsonb_build_object('importId', v_import.id, 'state', 'IMPORTED', 'transactionsImported', v_imported_count, 'assetsAdded', v_asset_count, 'duplicatesSkipped', v_duplicate_count, 'rowsIgnored', v_ignored_count, 'warnings', v_import.warning_count);
end;
$$;

revoke all on function public.commit_portfolio_import(uuid, boolean) from public;
grant execute on function public.commit_portfolio_import(uuid, boolean) to authenticated;
