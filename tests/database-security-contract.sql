do $contract$
declare
  v_result text;
begin
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('public_notes', 'note_likes', 'user_progress', 'user_question_reports')
      and not c.relrowsecurity
  ) then
    raise exception 'RLS must remain enabled on exposed user-data tables';
  end if;

  if has_table_privilege('authenticated', 'public.public_notes', 'select,insert,update,delete')
     or has_table_privilege('authenticated', 'public.note_likes', 'select,insert,update,delete') then
    raise exception 'authenticated still has direct public-note table access';
  end if;

  if exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename in ('public_notes', 'note_likes')
  ) then
    raise exception 'legacy public-note RLS policies still exist';
  end if;

  if has_function_privilege('anon', 'public.get_public_notes(text)', 'execute')
     or has_function_privilege('anon', 'public.upsert_public_note(text,text)', 'execute')
     or has_function_privilege('anon', 'public.toggle_public_note_like(uuid)', 'execute') then
    raise exception 'anon must not execute public-note RPCs';
  end if;

  if not has_function_privilege('authenticated', 'public.get_public_notes(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.upsert_public_note(text,text)', 'execute')
     or not has_function_privilege('authenticated', 'public.toggle_public_note_like(uuid)', 'execute') then
    raise exception 'authenticated must execute public-note wrappers';
  end if;

  if has_function_privilege('anon', 'public.delete_user()', 'execute')
     or has_function_privilege('authenticated', 'public.delete_user()', 'execute')
     or has_function_privilege('anon', 'public.toggle_note_like(uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.toggle_note_like(uuid)', 'execute') then
    raise exception 'legacy mutation RPCs remain executable';
  end if;

  select pg_get_function_result('public.get_public_notes(text)'::regprocedure)
    into v_result;
  if v_result ~* 'user_id|user_email' then
    raise exception 'public-note read RPC exposes a sensitive field';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.prosecdef
      and n.nspname in ('public', 'private_security')
      and p.proname in (
        'delete_user',
        'toggle_note_like',
        'require_current_user',
        'ensure_profile',
        'get_public_notes_core',
        'upsert_public_note_core',
        'toggle_public_note_like_core'
      )
      and not exists (
        select 1
        from unnest(coalesce(p.proconfig, '{}'::text[])) as setting
        where setting like 'search_path=%'
      )
  ) then
    raise exception 'a security-definer function has a mutable search_path';
  end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_public_notes', 'upsert_public_note', 'toggle_public_note_like')
      and p.prosecdef
  ) then
    raise exception 'public RPC wrappers must be security invoker';
  end if;
end
$contract$;
