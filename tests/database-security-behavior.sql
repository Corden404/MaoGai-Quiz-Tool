begin;

insert into auth.users (id, email, created_at, updated_at)
values
  ('00000000-0000-0000-0000-0000000000a1', 'user-a@example.test', now(), now()),
  ('00000000-0000-0000-0000-0000000000b2', 'user-b@example.test', now(), now());

create temporary table security_test_results (
  key text primary key,
  note_id uuid,
  flag boolean,
  number_value integer,
  text_value text
);
grant all on table security_test_results to authenticated;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);
set local role authenticated;

insert into security_test_results (key, note_id)
select 'note', public.upsert_public_note(U&'1-\5355\9009-01', 'first note');

update security_test_results
set note_id = public.upsert_public_note(U&'1-\5355\9009-01', 'updated note')
where key = 'note';

insert into security_test_results (key, number_value, text_value)
select 'read-as-owner', count(*), max(display_name)
from public.get_public_notes(U&'1-\5355\9009-01')
where content = 'updated note'
  and is_mine
  and not is_liked_by_me;

do $expected_errors$
begin
  begin
    perform public.upsert_public_note('not-a-real-question', 'content');
    raise exception 'invalid question ID was accepted';
  exception
    when sqlstate '22023' then null;
  end;

  begin
    perform public.upsert_public_note(U&'1-\5355\9009-01', repeat('a', 2001));
    raise exception 'overlong public note was accepted';
  exception
    when sqlstate '22023' then null;
  end;

  begin
    perform public.upsert_public_note(U&'1-\5355\9009-01', '   ');
    raise exception 'blank public note was accepted';
  exception
    when sqlstate '22023' then null;
  end;
end
$expected_errors$;

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000b2","role":"authenticated"}',
  true
);
set local role authenticated;

insert into security_test_results (key, flag, number_value)
select 'like', is_liked, likes
from public.toggle_public_note_like(
  (select note_id from security_test_results where key = 'note')
);

insert into security_test_results (key, number_value)
select 'read-as-other', count(*)
from public.get_public_notes(U&'1-\5355\9009-01')
where not is_mine
  and is_liked_by_me
  and likes = 1;

reset role;

do $assertions$
begin
  if (select count(*) from public.public_notes) <> 1 then
    raise exception 'upsert created a duplicate public note';
  end if;

  if (select number_value from security_test_results where key = 'read-as-owner') <> 1 then
    raise exception 'owner could not read the minimal public-note response';
  end if;

  if pg_catalog.char_length(
       (select text_value from security_test_results where key = 'read-as-owner')
     ) <> 8
     or (select text_value from security_test_results where key = 'read-as-owner')
        not like U&'\5B66\4E60\8005 ____' then
    raise exception 'anonymous display name has an invalid format';
  end if;

  if exists (
    select 1 from public.public_notes
    where user_email not like U&'\5B66\4E60\8005 %@anonymous.invalid'
  ) then
    raise exception 'public note stored a real email';
  end if;

  if not (select flag from security_test_results where key = 'like')
     or (select number_value from security_test_results where key = 'like') <> 1
     or (select number_value from security_test_results where key = 'read-as-other') <> 1 then
    raise exception 'authoritative like state is inconsistent';
  end if;

  if (select count(*) from public.note_likes) <> 1 then
    raise exception 'like relation count is inconsistent';
  end if;
end
$assertions$;

insert into public.user_progress (user_id, progress_data)
values ('00000000-0000-0000-0000-0000000000a1', '{}'::jsonb);
insert into public.user_question_reports (user_id, question_id)
values ('00000000-0000-0000-0000-0000000000a1', U&'1-\5355\9009-01');

delete from auth.users
where id = '00000000-0000-0000-0000-0000000000a1';

do $cascade_assertions$
begin
  if exists (
    select 1 from public.public_notes
    where user_id = '00000000-0000-0000-0000-0000000000a1'
  ) or exists (
    select 1 from public.user_progress
    where user_id = '00000000-0000-0000-0000-0000000000a1'
  ) or exists (
    select 1 from public.user_question_reports
    where user_id = '00000000-0000-0000-0000-0000000000a1'
  ) then
    raise exception 'account deletion did not cascade through user data';
  end if;
end
$cascade_assertions$;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}',
  true
);
set local role authenticated;

do $deleted_token$
begin
  begin
    perform public.get_public_notes(U&'1-\5355\9009-01');
    raise exception 'deleted user token remained usable';
  exception
    when sqlstate '42501' then null;
  end;
end
$deleted_token$;

reset role;
rollback;
