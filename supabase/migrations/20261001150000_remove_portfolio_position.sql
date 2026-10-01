create or replace function public.remove_portfolio_position(
  p_portfolio_id uuid,
  p_asset_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_portfolio_user_id uuid;
  v_transaction_count integer;
  v_deleted_count integer;
begin
  if v_user_id is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select user_id
    into v_portfolio_user_id
    from public.portfolios
   where id = p_portfolio_id
   for update;

  if v_portfolio_user_id is null or v_portfolio_user_id <> v_user_id then
    raise exception 'PORTFOLIO_NOT_FOUND';
  end if;

  select count(*)::integer
    into v_transaction_count
    from public.transactions
   where portfolio_id = p_portfolio_id
     and asset_id = p_asset_id;

  if v_transaction_count = 0 then
    raise exception 'POSITION_NOT_FOUND';
  end if;

  delete from public.transactions
   where portfolio_id = p_portfolio_id
     and asset_id = p_asset_id;

  get diagnostics v_deleted_count = row_count;

  return jsonb_build_object(
    'portfolioId', p_portfolio_id,
    'assetId', p_asset_id,
    'deletedTransactions', v_deleted_count,
    'state', 'REMOVED'
  );
end;
$$;

revoke all on function public.remove_portfolio_position(uuid, uuid) from public;
grant execute on function public.remove_portfolio_position(uuid, uuid) to authenticated;
