-- Выполни этот файл целиком в Supabase: Project → SQL Editor → New query → Run.

-- Таблица хранит все данные приложения одним JSON-объектом на пользователя.
-- user_id ссылается на встроенную таблицу auth.users и является первичным
-- ключом — у каждого пользователя ровно одна строка.
create table if not exists public.tracker_data (
  user_id uuid references auth.users(id) on delete cascade primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ЭТО ГЛАВНАЯ СТРОКА ДЛЯ БЕЗОПАСНОСТИ.
-- Row Level Security означает: даже зная публичный anon-ключ (а он есть
-- в открытом виде во фронтенд-коде — это нормально и ожидаемо), никто
-- не сможет прочитать или изменить чужую строку. Проверка происходит
-- на сервере базы данных, а не в коде сайта — обойти её с клиента
-- невозможно.
alter table public.tracker_data enable row level security;

create policy "select own row"
  on public.tracker_data for select
  using (auth.uid() = user_id);

create policy "insert own row"
  on public.tracker_data for insert
  with check (auth.uid() = user_id);

create policy "update own row"
  on public.tracker_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "delete own row"
  on public.tracker_data for delete
  using (auth.uid() = user_id);

-- Дополнительно рекомендуется включить в Supabase Dashboard:
-- Authentication → Providers → Email → "Confirm email" (подтверждение почты)
-- Authentication → Policies → "Leaked password protection" (если доступно на твоём плане)
