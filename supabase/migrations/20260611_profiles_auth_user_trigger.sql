-- Create profiles automatically when Supabase Auth creates a user.
-- Safe to run in the Supabase SQL Editor after the profiles table exists.

create or replace function public.handle_new_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    pilot_name,
    created_at,
    updated_at,
    last_seen
  )
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'pilot_name', ''), 'Pilot'),
    now(),
    now(),
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;

create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row
execute function public.handle_new_auth_user_profile();
