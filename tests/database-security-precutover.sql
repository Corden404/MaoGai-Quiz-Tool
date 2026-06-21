do $contract$
declare
  v_result text;
begin
  if not exists (select 1 from pg_namespace where nspname = 'private_security') then
    raise exception 'private_security schema is missing';
  end if;

  if (select count(*) from private_security.valid_questions) <> 914 then
    raise exception 'valid question whitelist must contain 914 rows';
  end if;

  if to_regprocedure('public.get_public_notes(text)') is null
     or to_regprocedure('public.upsert_public_note(text,text)') is null
     or to_regprocedure('public.toggle_public_note_like(uuid)') is null then
    raise exception 'new public-note RPCs are missing';
  end if;

  if has_function_privilege('anon', 'public.get_public_notes(text)', 'execute')
     or has_function_privilege('anon', 'public.upsert_public_note(text,text)', 'execute')
     or has_function_privilege('anon', 'public.toggle_public_note_like(uuid)', 'execute') then
    raise exception 'anon must not execute new public-note RPCs';
  end if;

  if not has_function_privilege('authenticated', 'public.get_public_notes(text)', 'execute')
     or not has_function_privilege('authenticated', 'public.upsert_public_note(text,text)', 'execute')
     or not has_function_privilege('authenticated', 'public.toggle_public_note_like(uuid)', 'execute') then
    raise exception 'authenticated must execute new public-note RPCs';
  end if;

  select pg_get_function_result('public.get_public_notes(text)'::regprocedure)
    into v_result;
  if v_result ~* 'user_id|user_email' then
    raise exception 'public-note read RPC exposes a sensitive field';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.public_notes'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) like '%user_id, question_id%'
  ) then
    raise exception 'public note owner/question uniqueness is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.public_notes'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) like '%2000%'
  ) then
    raise exception 'public note length check is missing';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_progress'::regclass
      and contype = 'f'
      and confrelid = 'auth.users'::regclass
      and confdeltype = 'c'
  ) or not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.user_question_reports'::regclass
      and contype = 'f'
      and confrelid = 'auth.users'::regclass
      and confdeltype = 'c'
  ) then
    raise exception 'user-owned tables need cascade foreign keys';
  end if;

  if exists (
    select 1
    from public.public_notes
    where user_email not like U&'\5B66\4E60\8005 %@anonymous.invalid'
  ) then
    raise exception 'legacy public email column still contains a real email';
  end if;

  if not has_table_privilege('authenticated', 'public.public_notes', 'select')
     or not has_function_privilege('authenticated', 'public.toggle_note_like(uuid)', 'execute') then
    raise exception 'pre-cutover migration must remain compatible with the old frontend';
  end if;
end
$contract$;
