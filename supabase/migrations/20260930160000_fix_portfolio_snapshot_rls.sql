drop policy if exists "users read portfolio snapshots" on public.portfolio_snapshots;

create policy "users manage portfolio snapshots" on public.portfolio_snapshots for all to authenticated
  using (exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = (select auth.uid())))
  with check (exists (select 1 from public.portfolios p where p.id = portfolio_id and p.user_id = (select auth.uid())));
