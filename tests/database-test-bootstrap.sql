-- Test-only Supabase Auth shim for an EMPTY disposable PostgreSQL database.
-- Do not run this file against an existing app database or hosted Supabase.
create schema auth;
create schema extensions;
create extension "uuid-ossp" with schema extensions;
do $roles$
begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end
$roles$;
create table auth.users (
  id uuid primary key,
  email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create function auth.uid() returns uuid language sql stable as $function$
  select (coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb ->> 'sub')::uuid;
$function$;
grant usage on schema auth, extensions to anon, authenticated;
