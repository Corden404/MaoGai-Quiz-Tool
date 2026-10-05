-- Run with psql -v ON_ERROR_STOP=1 -f tests/account-archive-erasure.sql
-- against an EMPTY disposable database. Everything is rolled back.
begin;
\ir database-test-bootstrap.sql
\ir database-legacy-fixture.sql

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a@example.test'),
  ('00000000-0000-0000-0000-0000000000b2', 'b@example.test'),
  ('00000000-0000-0000-0000-0000000000c3', 'old@example.test');

insert into public.public_notes (id, question_id, user_id, user_email, content, created_at) values
  ('10000000-0000-0000-0000-000000000001', U&'1-\5355\9009-01', '00000000-0000-0000-0000-0000000000a1', 'a@example.test', 'old duplicate', '2026-01-01'),
  ('10000000-0000-0000-0000-000000000002', U&'1-\5355\9009-01', '00000000-0000-0000-0000-0000000000a1', 'a@example.test', 'current note', '2026-02-01'),
  ('10000000-0000-0000-0000-000000000003', 'invalid-question', '00000000-0000-0000-0000-0000000000a1', 'a@example.test', 'invalid question note', now()),
  ('10000000-0000-0000-0000-000000000004', U&'1-\5355\9009-02', '00000000-0000-0000-0000-0000000000a1', 'a@example.test', repeat('a', 2001), now()),
  ('10000000-0000-0000-0000-000000000005', U&'1-\5355\9009-01', '00000000-0000-0000-0000-0000000000b2', 'b@example.test', 'keep b', now()),
  ('10000000-0000-0000-0000-000000000006', U&'1-\5355\9009-01', '00000000-0000-0000-0000-0000000000c3', 'old@example.test', 'deleted before fix', now()),
  ('10000000-0000-0000-0000-000000000007', 'invalid-question', '00000000-0000-0000-0000-0000000000c3', 'old@example.test', 'old archive', now()),
  ('10000000-0000-0000-0000-000000000008', 'invalid-question', '00000000-0000-0000-0000-0000000000b2', 'b@example.test', 'keep archived b', now());
insert into public.note_likes (note_id, user_id) values
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000b2'),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-0000000000a1'),
  ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-0000000000b2');
insert into public.user_progress (user_id, progress_data) values
  ('00000000-0000-0000-0000-0000000000d4', '{"notes":{"orphan":"old private note"}}');
insert into public.user_question_reports (user_id, question_id) values
  ('00000000-0000-0000-0000-0000000000d4', 'orphan');

\ir ../supabase/migrations/20260621164459_prepare_user_data_security.sql
\ir ../supabase/migrations/20260621164513_finalize_user_data_security.sql
delete from auth.users where id = '00000000-0000-0000-0000-0000000000c3';
-- Reusing an email must not transfer an old user's archived data.
insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000e5', 'old@example.test');

\ir ../supabase/migrations/20261002130334_bind_archive_account_lifecycle.sql

do $backfill$
begin
  if exists (select from private_security.public_note_emails_20260622 where user_email = 'old@example.test')
     or exists (select from private_security.user_progress_orphans_20260622)
     or exists (select from private_security.user_question_reports_orphans_20260622) then
    raise exception 'Previously deleted/unresolvable owners were retained';
  end if;
  if (select count(*) from private_security.public_note_emails_20260622 where user_id = '00000000-0000-0000-0000-0000000000a1') <> 4 then
    raise exception 'Did not recover ownership from live and all quarantined note tables';
  end if;
end
$backfill$;

delete from auth.users where id = '00000000-0000-0000-0000-0000000000a1';
do $erasure$
declare
  v_table text;
  v_remaining bigint;
begin
  foreach v_table in array array[
    'public_note_emails_20260622', 'public_notes_duplicates_20260622',
    'public_notes_invalid_questions_20260622', 'public_notes_invalid_content_20260622',
    'removed_public_note_likes_20260622', 'user_progress_orphans_20260622',
    'user_question_reports_orphans_20260622'
  ] loop
    execute format('select count(*) from private_security.%I where user_id = %L', v_table, '00000000-0000-0000-0000-0000000000a1') into v_remaining;
    if v_remaining <> 0 then raise exception 'Account data remains in %', v_table; end if;
    if has_table_privilege('authenticated', 'private_security.' || v_table, 'select,insert,update,delete')
       or has_table_privilege('anon', 'private_security.' || v_table, 'select,insert,update,delete') then
      raise exception 'Archive accessible to browser roles: %', v_table;
    end if;
  end loop;
  if (select count(*) from private_security.removed_public_note_likes_20260622) <> 1
     or exists (select from private_security.removed_public_note_likes_20260622 where note_owner_id = '00000000-0000-0000-0000-0000000000a1') then
    raise exception 'Liker or note-author cascade failed';
  end if;
  if (select count(*) from private_security.public_note_emails_20260622) <> 2
     or (select count(*) from public.public_notes) <> 1 then
    raise exception 'Another account was incorrectly erased';
  end if;
end
$erasure$;
rollback;
