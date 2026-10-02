-- Link migration archives to the same account lifecycle as live data.
-- Records whose owner was already deleted (or cannot be recovered by note ID)
-- are erased. Never infer ownership from email: an address can be reused.
alter table private_security.public_note_emails_20260622
  add column if not exists user_id uuid;
alter table private_security.removed_public_note_likes_20260622
  add column if not exists note_owner_id uuid;

with note_owners as (
  select id, user_id from public.public_notes
  union select id, user_id from private_security.public_notes_duplicates_20260622
  union select id, user_id from private_security.public_notes_invalid_questions_20260622
  union select id, user_id from private_security.public_notes_invalid_content_20260622
)
update private_security.public_note_emails_20260622 as archive
set user_id = owner.user_id
from note_owners as owner
where owner.id = archive.note_id;

with note_owners as (
  select id, user_id from public.public_notes
  union select id, user_id from private_security.public_notes_duplicates_20260622
  union select id, user_id from private_security.public_notes_invalid_questions_20260622
  union select id, user_id from private_security.public_notes_invalid_content_20260622
)
update private_security.removed_public_note_likes_20260622 as archive
set note_owner_id = owner.user_id
from note_owners as owner
where owner.id = archive.note_id;

-- CTAS archives inherited neither foreign keys nor indexes from their sources.
do $archives$
declare
  v_table text;
begin
  foreach v_table in array array[
    'public_note_emails_20260622',
    'public_notes_duplicates_20260622',
    'public_notes_invalid_questions_20260622',
    'public_notes_invalid_content_20260622',
    'removed_public_note_likes_20260622',
    'user_progress_orphans_20260622',
    'user_question_reports_orphans_20260622'
  ] loop
    execute pg_catalog.format(
      'delete from private_security.%I as archive where not exists (select 1 from auth.users as account where account.id = archive.user_id)',
      v_table
    );
    execute pg_catalog.format('alter table private_security.%I alter column user_id set not null', v_table);
    execute pg_catalog.format(
      'alter table private_security.%I add constraint %I foreign key (user_id) references auth.users(id) on delete cascade',
      v_table, v_table || '_user_id_fkey'
    );
    execute pg_catalog.format('create index %I on private_security.%I (user_id)', v_table || '_user_id_idx', v_table);
    execute pg_catalog.format('alter table private_security.%I enable row level security', v_table);
    execute pg_catalog.format('revoke all on table private_security.%I from public, anon, authenticated', v_table);
  end loop;
end
$archives$;

-- A quarantined like belongs both to its liker and to the note's author.
delete from private_security.removed_public_note_likes_20260622 as archive
where not exists (select 1 from auth.users as account where account.id = archive.note_owner_id);
alter table private_security.removed_public_note_likes_20260622
  alter column note_owner_id set not null,
  add constraint removed_note_likes_note_owner_fkey
    foreign key (note_owner_id) references auth.users(id) on delete cascade;
create index removed_note_likes_note_owner_idx
  on private_security.removed_public_note_likes_20260622 (note_owner_id);
