create table public.user_progress (
  user_id uuid primary key default auth.uid(),
  progress_data jsonb,
  updated_at timestamptz default now()
);

create table public.public_notes (
  id uuid primary key default extensions.uuid_generate_v4(),
  question_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email text not null,
  content text not null,
  created_at timestamptz not null default timezone('utc', now()),
  likes integer not null default 0
);

create table public.note_likes (
  id uuid primary key default extensions.uuid_generate_v4(),
  note_id uuid not null references public.public_notes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  unique (note_id, user_id)
);

create table public.user_question_reports (
  user_id uuid not null,
  question_id text not null,
  created_at timestamptz default now(),
  primary key (user_id, question_id)
);

alter table public.user_progress enable row level security;
alter table public.public_notes enable row level security;
alter table public.note_likes enable row level security;
alter table public.user_question_reports enable row level security;

create policy "允许用户完全操作自己的数据"
  on public.user_progress for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "公开笔记允许所有认证用户读取"
  on public.public_notes for select to authenticated
  using (true);

create policy "允许用户创建自己的公开笔记"
  on public.public_notes for insert to authenticated
  with check (auth.uid() = user_id);

create policy "允许用户更新自己的公开笔记"
  on public.public_notes for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "允许用户删除自己的公开笔记"
  on public.public_notes for delete to authenticated
  using (auth.uid() = user_id);

create policy "允许所有认证用户读取点赞记录"
  on public.note_likes for select to authenticated
  using (true);

grant all privileges on table
  public.user_progress,
  public.public_notes,
  public.note_likes,
  public.user_question_reports
to anon, authenticated;

create or replace function public.delete_user()
returns void
language plpgsql
security definer
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
end;
$function$;

create or replace function public.toggle_note_like(p_note_id uuid)
returns boolean
language plpgsql
security definer
as $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;
  return true;
end;
$function$;

grant execute on function public.delete_user()
  to public, anon, authenticated;
grant execute on function public.toggle_note_like(uuid)
  to public, anon, authenticated;
