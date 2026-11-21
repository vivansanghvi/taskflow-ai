-- Run in the Supabase SQL editor. Designed to be safe to re-run.
create extension if not exists pgcrypto;
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  created_at timestamptz not null default now()
);
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text not null default '',
  priority text not null default 'medium' check (priority in ('low','medium','high')),
  status text not null default 'pending' check (status in ('pending','completed')),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.voice_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
 task_id uuid,
  storage_path text not null,
  duration_seconds integer not null default 0 check (duration_seconds >= 0),
  created_at timestamptz not null default now()
);
create index if not exists tasks_user_created_idx on public.tasks(user_id,created_at desc);
create index if not exists notes_user_created_idx on public.voice_notes(user_id,created_at desc);
alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.voice_notes enable row level security;
drop policy if exists "profiles own rows" on public.profiles;
create policy "profiles own rows" on public.profiles for all to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
drop policy if exists "tasks own rows" on public.tasks;
create policy "tasks own rows" on public.tasks for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "notes own rows" on public.voice_notes;
create policy "notes own rows" on public.voice_notes for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('voice-notes','voice-notes',false,10485760,array['audio/webm','audio/mp4','audio/ogg','audio/wav','audio/mpeg'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists "voice select own" on storage.objects;
create policy "voice select own" on storage.objects for select to authenticated using (bucket_id='voice-notes' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "voice insert own" on storage.objects;
create policy "voice insert own" on storage.objects for insert to authenticated with check (bucket_id='voice-notes' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "voice delete own" on storage.objects;
create policy "voice delete own" on storage.objects for delete to authenticated using (bucket_id='voice-notes' and (storage.foldername(name))[1]=(select auth.uid())::text);
-- Prevent linking voice notes to another user's tasks

create unique index if not exists tasks_id_user_unique
on public.tasks(id, user_id);

alter table public.voice_notes
drop constraint if exists voice_notes_task_owner_fkey;

alter table public.voice_notes
add constraint voice_notes_task_owner_fkey
foreign key (task_id, user_id)
references public.tasks(id, user_id)
on delete cascade;