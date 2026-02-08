-- Quiz app: vragen (middelbare school klas 1) + app-config (WhatsApp later)
-- RLS uit voor nu; later aan te zetten als je per-user wilt.

-- Vragen: dieren, wiskunde, biologie, etc. — volledig random te tonen
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in (
    'dieren', 'wiskunde', 'biologie', 'aardrijkskunde', 'geschiedenis', 'taal', 'algemeen'
  )),
  question_nl text not null,
  answer_nl text not null,
  difficulty int default 1 check (difficulty between 1 and 3), -- 1 = klas 1
  source_url text, -- wikipedia of andere bron
  created_at timestamptz default now()
);

create index if not exists idx_questions_category on public.questions (category);
create index if not exists idx_questions_random on public.questions using btree (random());

-- App-config: countdown, wachtmuziek aan/uit, etc. — later via WhatsApp bij te sturen
create table if not exists public.app_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

-- Defaults (value is jsonb: number/boolean)
insert into public.app_config (key, value) values
  ('countdown_seconds', '5'::jsonb),
  ('wait_music_enabled', 'true'::jsonb),
  ('tts_speed', '0.9'::jsonb),
  ('questions_per_round', '10'::jsonb)
on conflict (key) do nothing;

-- Leesrechten voor anonieme app (PWA)
alter table public.questions enable row level security;
alter table public.app_config enable row level security;

create policy "Allow public read questions" on public.questions
  for select using (true);

create policy "Allow public read app_config" on public.app_config
  for select using (true);

-- Schrijven later via service role (WhatsApp-bot / Cursor)
-- create policy "Service write questions" ...
