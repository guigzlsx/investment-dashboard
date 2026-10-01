revoke all on function public.remove_portfolio_position(uuid, uuid) from public;
revoke all on function public.remove_portfolio_position(uuid, uuid) from anon;
revoke all on function public.remove_portfolio_position(uuid, uuid) from service_role;
grant execute on function public.remove_portfolio_position(uuid, uuid) to authenticated;
