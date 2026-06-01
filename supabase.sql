create table if not exists public.semed_sistema (
  id text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.semed_sistema enable row level security;

drop policy if exists "SEMED sistema leitura publica" on public.semed_sistema;
drop policy if exists "SEMED sistema escrita publica" on public.semed_sistema;
drop policy if exists "SEMED sistema insercao publica" on public.semed_sistema;
drop policy if exists "SEMED sistema atualizacao publica" on public.semed_sistema;
drop policy if exists "SEMED sistema exclusao publica" on public.semed_sistema;

grant usage on schema public to anon;
grant usage on schema public to authenticated;
grant select, insert, update, delete on table public.semed_sistema to anon;
grant select, insert, update, delete on table public.semed_sistema to authenticated;

create policy "SEMED sistema leitura publica"
on public.semed_sistema
for select
to anon, authenticated
using (id = 'db');

create policy "SEMED sistema insercao publica"
on public.semed_sistema
for insert
to anon, authenticated
with check (id = 'db');

create policy "SEMED sistema atualizacao publica"
on public.semed_sistema
for update
to anon, authenticated
using (id = 'db')
with check (id = 'db');

create policy "SEMED sistema exclusao publica"
on public.semed_sistema
for delete
to anon, authenticated
using (id = 'db');

insert into public.semed_sistema (id, value)
values ('db', '{}'::jsonb)
on conflict (id) do nothing;
