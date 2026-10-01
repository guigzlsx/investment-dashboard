alter table public.profiles
  add column if not exists default_analysis_depth text not null default 'QUICK';

alter table public.profiles
  drop constraint if exists profiles_default_analysis_depth_check;

alter table public.profiles
  add constraint profiles_default_analysis_depth_check
  check (default_analysis_depth in ('QUICK', 'DETAILED'));

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'display_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, display_name)
select id, nullif(raw_user_meta_data ->> 'display_name', '')
from auth.users
on conflict (id) do nothing;
