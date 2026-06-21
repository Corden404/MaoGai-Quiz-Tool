do $policies$
declare
  v_policy record;
begin
  for v_policy in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('public_notes', 'note_likes')
  loop
    execute pg_catalog.format(
      'drop policy %I on %I.%I',
      v_policy.policyname,
      v_policy.schemaname,
      v_policy.tablename
    );
  end loop;
end
$policies$;

revoke all privileges on table public.public_notes
  from anon, authenticated;
revoke all privileges on table public.note_likes
  from anon, authenticated;

revoke execute on function public.delete_user()
  from public, anon, authenticated;
revoke execute on function public.toggle_note_like(uuid)
  from public, anon, authenticated;

alter function public.delete_user() set search_path = '';
alter function public.toggle_note_like(uuid) set search_path = '';

notify pgrst, 'reload schema';
