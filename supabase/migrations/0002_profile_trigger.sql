-- Fixes the "new row violates row-level security policy for table profiles" error.
--
-- The problem: right after auth.signUp(), the browser has no active session yet
-- if email confirmation is on (Supabase's default) -- so a client-side insert into
-- profiles runs as an anonymous request and correctly gets blocked by RLS.
--
-- The fix: create the profile row via a trigger on auth.users instead, which runs
-- server-side with elevated privileges and doesn't depend on the browser's session
-- state at all. This works the same whether email confirmation is on or off.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, gender)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New Player'),
    coalesce(new.raw_user_meta_data->>'gender', 'female')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
