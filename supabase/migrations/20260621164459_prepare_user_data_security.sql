create schema if not exists private_security;

revoke all on schema private_security from public, anon, authenticated;
grant usage on schema private_security to authenticated;

create table if not exists private_security.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null unique,
  created_at timestamptz not null default now(),
  constraint profiles_display_name_format
    check (display_name ~ '^学习者 [23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$')
);

create table if not exists private_security.valid_questions (
  question_id text primary key
);

revoke all on all tables in schema private_security from public, anon, authenticated;

create or replace function private_security.ensure_profile(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_candidate text;
  v_display_name text;
  v_index integer;
begin
  if p_user_id is null or not exists (
    select 1 from auth.users where id = p_user_id
  ) then
    raise exception 'Authenticated user does not exist.' using errcode = '42501';
  end if;

  select display_name
    into v_display_name
  from private_security.profiles
  where user_id = p_user_id;

  if found then
    return v_display_name;
  end if;

  loop
    v_candidate := '学习者 ';
    for v_index in 1..4 loop
      v_candidate := v_candidate || pg_catalog.substr(
        v_alphabet,
        1 + pg_catalog.floor(pg_catalog.random() * pg_catalog.length(v_alphabet))::integer,
        1
      );
    end loop;

    begin
      insert into private_security.profiles (user_id, display_name)
      values (p_user_id, v_candidate)
      returning display_name into v_display_name;
      return v_display_name;
    exception
      when unique_violation then
        select display_name
          into v_display_name
        from private_security.profiles
        where user_id = p_user_id;
        if found then
          return v_display_name;
        end if;
    end;
  end loop;
end;
$function$;

revoke execute on function private_security.ensure_profile(uuid)
  from public, anon, authenticated;

do $profiles$
declare
  v_user_id uuid;
begin
  for v_user_id in
    select distinct user_id from public.public_notes
  loop
    perform private_security.ensure_profile(v_user_id);
  end loop;
end
$profiles$;

create table if not exists private_security.public_note_emails_20260622 (
  note_id uuid primary key,
  user_email text not null,
  backed_up_at timestamptz not null default now()
);

insert into private_security.public_note_emails_20260622 (note_id, user_email)
select id, user_email
from public.public_notes
on conflict (note_id) do nothing;

update public.public_notes as note
set user_email = profile.display_name || '@anonymous.invalid'
from private_security.profiles as profile
where profile.user_id = note.user_id;

insert into private_security.valid_questions (question_id)
select
  question_range.prefix
  || pg_catalog.lpad(question_number::text, question_range.width, '0')
from (values
  ('1-辨析-', 2, 1, 3),
  ('1-材料分析-', 2, 1, 2),
  ('1-单选-', 2, 1, 13),
  ('1-多选-', 2, 1, 9),
  ('1-简答-', 2, 1, 3),
  ('1-论述-', 2, 1, 1),
  ('2-辨析题-', 2, 1, 5),
  ('2-材料分析题-', 2, 1, 3),
  ('2-单项选择题-', 2, 1, 15),
  ('2-多项选择题-', 2, 1, 11),
  ('2-简答题-', 2, 1, 4),
  ('2-论述题-', 2, 1, 4),
  ('3-辨析-', 2, 1, 6),
  ('3-材料-', 2, 1, 3),
  ('3-单选-', 2, 1, 21),
  ('3-多选-', 2, 1, 21),
  ('3-简答-', 2, 1, 6),
  ('3-论述-', 2, 1, 3),
  ('4-辨析-', 2, 1, 5),
  ('4-材料-', 2, 1, 2),
  ('4-单选-', 2, 1, 13),
  ('4-多选-', 2, 1, 11),
  ('4-简答-', 2, 1, 4),
  ('4-论述-', 2, 1, 2),
  ('5-辨析-', 2, 1, 4),
  ('5-材料分析-', 2, 1, 1),
  ('5-单选-', 2, 1, 12),
  ('5-多选-', 2, 1, 12),
  ('5-简答-', 2, 1, 3),
  ('5-论述-', 2, 1, 1),
  ('6-辨析-', 2, 1, 4),
  ('6-材料分析-', 2, 1, 3),
  ('6-单选-', 2, 1, 12),
  ('6-多选-', 2, 1, 17),
  ('6-简答-', 2, 1, 4),
  ('6-论述-', 2, 1, 2),
  ('7-essay-', 2, 1, 3),
  ('7-judge-', 2, 1, 5),
  ('7-material-', 2, 1, 4),
  ('7-multi-', 2, 1, 10),
  ('7-short-', 2, 1, 6),
  ('7-single-', 2, 1, 10),
  ('8-辨析-', 2, 1, 5),
  ('8-材料分析-', 2, 1, 2),
  ('8-单选-', 2, 1, 10),
  ('8-多选-', 2, 1, 10),
  ('8-简答-', 2, 1, 2),
  ('8-考研-', 2, 1, 3),
  ('8-论述-', 2, 1, 2),
  ('导论-辨析-', 2, 1, 3),
  ('导论-材料-', 2, 1, 1),
  ('导论-单选-', 2, 1, 10),
  ('导论-单选-真题-', 2, 1, 2),
  ('导论-多选-', 2, 1, 8),
  ('导论-多选-真题-', 2, 1, 1),
  ('导论-简答-', 2, 1, 2),
  ('导论-论述-', 2, 1, 1),
  ('结束语-辨析-', 2, 1, 1),
  ('结束语-材料分析-', 2, 1, 1),
  ('结束语-单选-', 2, 1, 2),
  ('结束语-多选-', 2, 1, 1),
  ('结束语-简答-', 2, 1, 3),
  ('结束语-论述-', 2, 1, 1),
  ('mayuan-导论-辨析-', 2, 1, 7),
  ('mayuan-导论-材料分析-', 2, 1, 1),
  ('mayuan-导论-单选-', 2, 1, 21),
  ('mayuan-导论-多选-', 2, 1, 11),
  ('mayuan-导论-简答-', 2, 1, 2),
  ('mayuan-导论-考研真题-', 2, 1, 4),
  ('mayuan-导论-论述-', 2, 1, 3),
  ('mayuan-第二章-辨析-', 2, 1, 10),
  ('mayuan-第二章-材料分析-', 2, 1, 3),
  ('mayuan-第二章-单选-', 2, 1, 30),
  ('mayuan-第二章-多选-', 2, 1, 20),
  ('mayuan-第二章-简答-', 2, 1, 4),
  ('mayuan-第二章-考研真题-', 2, 1, 5),
  ('mayuan-第二章-论述-', 2, 1, 4),
  ('mayuan-第六章-辨析-', 2, 1, 6),
  ('mayuan-第六章-材料分析-', 2, 1, 2),
  ('mayuan-第六章-单选-', 2, 1, 20),
  ('mayuan-第六章-多选-', 2, 1, 9),
  ('mayuan-第六章-简答-', 2, 1, 4),
  ('mayuan-第六章-考研真题-', 2, 1, 19),
  ('mayuan-第六章-论述-', 2, 1, 4),
  ('mayuan-第七章-辨析-', 2, 1, 5),
  ('mayuan-第七章-材料分析-', 2, 1, 1),
  ('mayuan-第七章-单选-', 2, 1, 15),
  ('mayuan-第七章-多选-', 2, 1, 15),
  ('mayuan-第七章-简答-', 2, 1, 2),
  ('mayuan-第七章-考研真题-', 2, 1, 9),
  ('mayuan-第七章-论述-', 2, 1, 4),
  ('mayuan-第三章-辨析-', 2, 1, 10),
  ('mayuan-第三章-材料分析-', 2, 1, 3),
  ('mayuan-第三章-单选-', 2, 1, 30),
  ('mayuan-第三章-多选-', 2, 1, 20),
  ('mayuan-第三章-简答-', 2, 1, 6),
  ('mayuan-第三章-考研真题-', 2, 1, 16),
  ('mayuan-第三章-论述-', 2, 1, 4),
  ('mayuan-第四章-辨析-', 2, 1, 10),
  ('mayuan-第四章-材料分析-', 2, 1, 2),
  ('mayuan-第四章-单选-', 2, 1, 20),
  ('mayuan-第四章-多选-', 2, 1, 10),
  ('mayuan-第四章-简答-', 2, 1, 2),
  ('mayuan-第四章-考研真题-', 2, 1, 21),
  ('mayuan-第四章-论述-', 2, 1, 2),
  ('mayuan-第五章-辨析-', 2, 1, 8),
  ('mayuan-第五章-材料分析-', 2, 1, 2),
  ('mayuan-第五章-单选-', 2, 1, 28),
  ('mayuan-第五章-多选-', 2, 1, 17),
  ('mayuan-第五章-简答-', 2, 1, 5),
  ('mayuan-第五章-考研真题-', 2, 1, 8),
  ('mayuan-第五章-论述-', 2, 1, 4),
  ('mayuan-第一章-辨析-', 2, 1, 10),
  ('mayuan-第一章-材料分析-', 2, 1, 3),
  ('mayuan-第一章-单选-', 2, 1, 30),
  ('mayuan-第一章-多选-', 2, 1, 20),
  ('mayuan-第一章-简答-', 2, 1, 5),
  ('mayuan-第一章-考研真题-', 2, 1, 21),
  ('mayuan-第一章-论述-', 2, 1, 3)
) as question_range(prefix, width, start_number, end_number)
cross join lateral pg_catalog.generate_series(
  question_range.start_number,
  question_range.end_number
) as question_number
on conflict (question_id) do nothing;

create table if not exists private_security.public_notes_duplicates_20260622
as select * from public.public_notes with no data;

create table if not exists private_security.public_notes_invalid_questions_20260622
as select * from public.public_notes with no data;

create table if not exists private_security.public_notes_invalid_content_20260622
as select * from public.public_notes with no data;

create table if not exists private_security.removed_public_note_likes_20260622
as select * from public.note_likes with no data;

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id, question_id
      order by created_at desc, id desc
    ) as duplicate_rank
  from public.public_notes
)
insert into private_security.public_notes_duplicates_20260622
select note.*
from public.public_notes as note
join ranked on ranked.id = note.id
where ranked.duplicate_rank > 1;

insert into private_security.public_notes_invalid_questions_20260622
select note.*
from public.public_notes as note
left join private_security.valid_questions as question
  on question.question_id = note.question_id
where question.question_id is null;

insert into private_security.public_notes_invalid_content_20260622
select *
from public.public_notes
where pg_catalog.char_length(pg_catalog.btrim(content)) not between 1 and 2000
   or likes < 0;

insert into private_security.removed_public_note_likes_20260622
select note_like.*
from public.note_likes as note_like
where note_like.note_id in (
  select id from private_security.public_notes_duplicates_20260622
  union
  select id from private_security.public_notes_invalid_questions_20260622
  union
  select id from private_security.public_notes_invalid_content_20260622
);

delete from public.public_notes
where id in (
  select id from private_security.public_notes_duplicates_20260622
  union
  select id from private_security.public_notes_invalid_questions_20260622
  union
  select id from private_security.public_notes_invalid_content_20260622
);

create table if not exists private_security.user_progress_orphans_20260622
as select * from public.user_progress with no data;

insert into private_security.user_progress_orphans_20260622
select progress.*
from public.user_progress as progress
left join auth.users as auth_user on auth_user.id = progress.user_id
where auth_user.id is null;

delete from public.user_progress as progress
using private_security.user_progress_orphans_20260622 as orphan
where orphan.user_id = progress.user_id;

create table if not exists private_security.user_question_reports_orphans_20260622
as select * from public.user_question_reports with no data;

insert into private_security.user_question_reports_orphans_20260622
select report.*
from public.user_question_reports as report
left join auth.users as auth_user on auth_user.id = report.user_id
where auth_user.id is null;

delete from public.user_question_reports as report
using private_security.user_question_reports_orphans_20260622 as orphan
where orphan.user_id = report.user_id
  and orphan.question_id = report.question_id;

update public.public_notes as note
set likes = (
  select pg_catalog.count(*)::integer
  from public.note_likes as note_like
  where note_like.note_id = note.id
);

do $constraints$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.public_notes'::regclass
      and conname = 'public_notes_user_question_key'
  ) then
    alter table public.public_notes
      add constraint public_notes_user_question_key unique (user_id, question_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.public_notes'::regclass
      and conname = 'public_notes_question_id_fkey'
  ) then
    alter table public.public_notes
      add constraint public_notes_question_id_fkey
      foreign key (question_id)
      references private_security.valid_questions(question_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.public_notes'::regclass
      and conname = 'public_notes_content_length_check'
  ) then
    alter table public.public_notes
      add constraint public_notes_content_length_check
      check (pg_catalog.char_length(pg_catalog.btrim(content)) between 1 and 2000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.public_notes'::regclass
      and conname = 'public_notes_likes_nonnegative_check'
  ) then
    alter table public.public_notes
      add constraint public_notes_likes_nonnegative_check check (likes >= 0);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_progress'::regclass
      and confrelid = 'auth.users'::regclass
      and contype = 'f'
  ) then
    alter table public.user_progress
      add constraint user_progress_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.user_question_reports'::regclass
      and confrelid = 'auth.users'::regclass
      and contype = 'f'
  ) then
    alter table public.user_question_reports
      add constraint user_question_reports_user_id_fkey
      foreign key (user_id) references auth.users(id) on delete cascade;
  end if;
end
$constraints$;

create or replace function private_security.require_current_user()
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or not exists (
    select 1 from auth.users where id = v_user_id
  ) then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;
  return v_user_id;
end;
$function$;

create or replace function private_security.get_public_notes_core(p_question_id text)
returns table (
  id uuid,
  question_id text,
  display_name text,
  content text,
  created_at timestamptz,
  likes integer,
  is_mine boolean,
  is_liked_by_me boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := private_security.require_current_user();
begin
  if not exists (
    select 1
    from private_security.valid_questions as valid_question
    where valid_question.question_id = p_question_id
  ) then
    raise exception 'Unknown question ID.' using errcode = '22023';
  end if;

  return query
  select
    note.id,
    note.question_id,
    profile.display_name,
    note.content,
    note.created_at,
    like_stats.likes,
    note.user_id = v_user_id as is_mine,
    exists (
      select 1
      from public.note_likes as own_like
      where own_like.note_id = note.id
        and own_like.user_id = v_user_id
    ) as is_liked_by_me
  from public.public_notes as note
  join private_security.profiles as profile
    on profile.user_id = note.user_id
  cross join lateral (
    select pg_catalog.count(*)::integer as likes
    from public.note_likes as note_like_count
    where note_like_count.note_id = note.id
  ) as like_stats
  where note.question_id = p_question_id
  order by like_stats.likes desc, note.created_at desc;
end;
$function$;

create or replace function private_security.upsert_public_note_core(
  p_question_id text,
  p_content text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := private_security.require_current_user();
  v_content text := pg_catalog.btrim(coalesce(p_content, ''));
  v_display_name text;
  v_note_id uuid;
begin
  if not exists (
    select 1
    from private_security.valid_questions as valid_question
    where valid_question.question_id = p_question_id
  ) then
    raise exception 'Unknown question ID.' using errcode = '22023';
  end if;

  if pg_catalog.char_length(v_content) not between 1 and 2000 then
    raise exception 'Public note content must contain 1 to 2000 characters.'
      using errcode = '22023';
  end if;

  v_display_name := private_security.ensure_profile(v_user_id);

  insert into public.public_notes (
    question_id,
    user_id,
    user_email,
    content
  )
  values (
    p_question_id,
    v_user_id,
    v_display_name || '@anonymous.invalid',
    v_content
  )
  on conflict (user_id, question_id)
  do update set content = excluded.content
  returning id into v_note_id;

  return v_note_id;
end;
$function$;

create or replace function private_security.toggle_public_note_like_core(p_note_id uuid)
returns table (
  is_liked boolean,
  likes integer
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := private_security.require_current_user();
  v_is_liked boolean;
begin
  perform 1
  from public.public_notes
  where id = p_note_id
  for update;

  if not found then
    raise exception 'Public note does not exist.' using errcode = '22023';
  end if;

  delete from public.note_likes
  where note_id = p_note_id
    and user_id = v_user_id;

  if found then
    v_is_liked := false;
  else
    insert into public.note_likes (note_id, user_id)
    values (p_note_id, v_user_id);
    v_is_liked := true;
  end if;

  return query
  select
    v_is_liked,
    (
      select pg_catalog.count(*)::integer
      from public.note_likes
      where note_id = p_note_id
    );
end;
$function$;

revoke execute on all functions in schema private_security
  from public, anon, authenticated;

grant execute on function private_security.get_public_notes_core(text)
  to authenticated;
grant execute on function private_security.upsert_public_note_core(text, text)
  to authenticated;
grant execute on function private_security.toggle_public_note_like_core(uuid)
  to authenticated;

create or replace function public.get_public_notes(p_question_id text)
returns table (
  id uuid,
  question_id text,
  display_name text,
  content text,
  created_at timestamptz,
  likes integer,
  is_mine boolean,
  is_liked_by_me boolean
)
language sql
security invoker
set search_path = ''
as $function$
  select *
  from private_security.get_public_notes_core(p_question_id);
$function$;

create or replace function public.upsert_public_note(
  p_question_id text,
  p_content text
)
returns uuid
language sql
security invoker
set search_path = ''
as $function$
  select private_security.upsert_public_note_core(p_question_id, p_content);
$function$;

create or replace function public.toggle_public_note_like(p_note_id uuid)
returns table (
  is_liked boolean,
  likes integer
)
language sql
security invoker
set search_path = ''
as $function$
  select *
  from private_security.toggle_public_note_like_core(p_note_id);
$function$;

revoke execute on function public.get_public_notes(text)
  from public, anon, authenticated;
revoke execute on function public.upsert_public_note(text, text)
  from public, anon, authenticated;
revoke execute on function public.toggle_public_note_like(uuid)
  from public, anon, authenticated;

grant execute on function public.get_public_notes(text) to authenticated;
grant execute on function public.upsert_public_note(text, text) to authenticated;
grant execute on function public.toggle_public_note_like(uuid) to authenticated;

alter default privileges in schema private_security
  revoke execute on functions from public;

notify pgrst, 'reload schema';
