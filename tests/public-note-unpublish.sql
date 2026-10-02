-- psql -v ON_ERROR_STOP=1 -f tests/public-note-unpublish.sql
-- Only an EMPTY disposable PostgreSQL database; all changes are rolled back.
begin;
\ir database-test-bootstrap.sql
\ir database-legacy-fixture.sql
\ir ../supabase/migrations/20260621164459_prepare_user_data_security.sql
\ir ../supabase/migrations/20260621164513_finalize_user_data_security.sql
\ir ../supabase/migrations/20261002131721_add_public_note_sharing_state.sql
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'b@example.test');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
set local role authenticated;
select public.set_public_note_sharing(U&'1-\5355\9009-01', 'public a', true, '00000000-0000-0000-0000-0000000000a1');
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2"}', true);
set local role authenticated;
do $other_user$
begin
  if (select count(*) from public.get_public_notes(U&'1-\5355\9009-01') where content = 'public a') <> 1 then
    raise exception 'Published note not visible to another account';
  end if;
  perform public.set_public_note_sharing(U&'1-\5355\9009-01', '', false, '00000000-0000-0000-0000-0000000000b2');
  if (select count(*) from public.get_public_notes(U&'1-\5355\9009-01') where content = 'public a') <> 1 then
    raise exception 'Unpublish erased a different owner';
  end if;
  begin
    perform public.set_public_note_sharing(U&'1-\5355\9009-01', '', false, '00000000-0000-0000-0000-0000000000a1');
    raise exception 'Mismatched session owner was accepted';
  exception when sqlstate '42501' then null;
  end;
  perform public.toggle_public_note_like((select id from public.get_public_notes(U&'1-\5355\9009-01') limit 1));
  perform public.set_public_note_sharing(U&'1-\5355\9009-01', 'keep b', true, '00000000-0000-0000-0000-0000000000b2');
end
$other_user$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
set local role authenticated;
select public.set_public_note_sharing(U&'1-\5355\9009-01', 'private a', false, '00000000-0000-0000-0000-0000000000a1');
-- Repeated revocation is safe, and false does not require nonblank public content.
select public.set_public_note_sharing(U&'1-\5355\9009-01', '', false, '00000000-0000-0000-0000-0000000000a1');
do $validation$
begin
  begin
    perform public.set_public_note_sharing('unknown', '', false, '00000000-0000-0000-0000-0000000000a1');
    raise exception 'Unknown question accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.set_public_note_sharing(U&'1-\5355\9009-01', ' ', true, '00000000-0000-0000-0000-0000000000a1');
    raise exception 'Blank public content accepted';
  exception when sqlstate '22023' then null;
  end;
end
$validation$;
reset role;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b2"}', true);
set local role authenticated;
do $reader$
begin
  if (select count(*) from public.get_public_notes(U&'1-\5355\9009-01')) <> 1
     or exists (select from public.get_public_notes(U&'1-\5355\9009-01') where content <> 'keep b') then
    raise exception 'Revoked content remains readable or another owner was removed';
  end if;
end
$reader$;
reset role;
do $permissions$
begin
  if exists (select from public.note_likes) then raise exception 'Revoked note likes were retained'; end if;
  if has_function_privilege('anon', 'public.set_public_note_sharing(text,text,boolean,uuid)', 'execute')
     or has_function_privilege('anon', 'private_security.set_public_note_sharing_core(text,text,boolean,uuid)', 'execute')
     or has_table_privilege('authenticated', 'public.public_notes', 'delete') then
    raise exception 'Publication API permissions are too broad';
  end if;
end
$permissions$;
delete from auth.users where id = '00000000-0000-0000-0000-0000000000a1';
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1"}', true);
set local role authenticated;
do $deleted_user$
begin
  begin
    perform public.set_public_note_sharing(U&'1-\5355\9009-01', '', false, '00000000-0000-0000-0000-0000000000a1');
    raise exception 'Deleted account can use publication API';
  exception when sqlstate '42501' then null;
  end;
end
$deleted_user$;
reset role;
rollback;
