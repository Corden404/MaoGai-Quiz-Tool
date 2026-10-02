create or replace function private_security.set_public_note_sharing_core(
  p_question_id text,
  p_content text,
  p_is_public boolean,
  p_expected_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_user_id uuid := private_security.require_current_user();
begin
  -- The expected ID is a session-race assertion, never an ownership selector.
  if p_expected_user_id is distinct from v_user_id then
    raise exception 'Account changed; reload the note.' using errcode = '42501';
  end if;
  if p_is_public is null or not exists (
    select 1 from private_security.valid_questions where question_id = p_question_id
  ) then
    raise exception 'Invalid publication state or question ID.' using errcode = '22023';
  end if;
  if p_is_public then
    perform private_security.upsert_public_note_core(p_question_id, p_content);
  else
    delete from public.public_notes
    where user_id = v_user_id and question_id = p_question_id;
  end if;
  return p_is_public;
end;
$function$;

create or replace function public.set_public_note_sharing(
  p_question_id text,
  p_content text,
  p_is_public boolean,
  p_expected_user_id uuid
)
returns boolean
language sql
security invoker
set search_path = ''
as $function$
  select private_security.set_public_note_sharing_core(
    p_question_id, p_content, p_is_public, p_expected_user_id
  );
$function$;

revoke execute on function private_security.set_public_note_sharing_core(text, text, boolean, uuid)
  from public, anon, authenticated;
revoke execute on function public.set_public_note_sharing(text, text, boolean, uuid)
  from public, anon, authenticated;
grant execute on function private_security.set_public_note_sharing_core(text, text, boolean, uuid)
  to authenticated;
grant execute on function public.set_public_note_sharing(text, text, boolean, uuid)
  to authenticated;
notify pgrst, 'reload schema';
