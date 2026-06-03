-- Lupen live Supabase schema setup for project ylzglwiehkypetcdkqxd.
--
-- Safe to run in the Supabase SQL Editor. This creates the browser-facing
-- profile/save tables plus the server-only multiplayer audit tables used by
-- Colyseus staging. It does not grant browser access to the multiplayer
-- audit tables.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  pilot_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen timestamptz
);

create unique index if not exists profiles_pilot_name_lower_unique
  on public.profiles (lower(pilot_name));

alter table public.profiles enable row level security;

grant select, insert, update on public.profiles to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_select_own'
  ) then
    create policy profiles_select_own
      on public.profiles
      for select
      to authenticated
      using (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_insert_own'
  ) then
    create policy profiles_insert_own
      on public.profiles
      for insert
      to authenticated
      with check (auth.uid() = id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_update_own'
  ) then
    create policy profiles_update_own
      on public.profiles
      for update
      to authenticated
      using (auth.uid() = id)
      with check (auth.uid() = id);
  end if;
end $$;

create table if not exists public.player_saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  save_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.player_saves enable row level security;

grant select, insert, update on public.player_saves to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'player_saves'
      and policyname = 'player_saves_select_own'
  ) then
    create policy player_saves_select_own
      on public.player_saves
      for select
      to authenticated
      using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'player_saves'
      and policyname = 'player_saves_insert_own'
  ) then
    create policy player_saves_insert_own
      on public.player_saves
      for insert
      to authenticated
      with check (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'player_saves'
      and policyname = 'player_saves_update_own'
  ) then
    create policy player_saves_update_own
      on public.player_saves
      for update
      to authenticated
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;

create table if not exists public.multiplayer_reward_ledger (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  player_id uuid not null,
  supabase_user_id uuid,
  room_name text,
  bot_id text,
  bot_name text,
  node text,
  reward_reason text,
  xp_amount integer not null default 0,
  credits_amount integer not null default 0,
  loot jsonb not null default '[]'::jsonb,
  contribution_percent numeric,
  final_hit boolean not null default false,
  top_contributor boolean not null default false,
  source_event_id text,
  applied boolean not null default false,
  dry_run boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
);

comment on table public.multiplayer_reward_ledger is
  'Server-only multiplayer reward audit ledger. Browser clients should not have policies for this table.';

comment on column public.multiplayer_reward_ledger.source_event_id is
  'Idempotency/source event key for duplicate protection.';

create index if not exists multiplayer_reward_ledger_player_id_idx
  on public.multiplayer_reward_ledger (player_id, created_at desc);

create index if not exists multiplayer_reward_ledger_room_bot_idx
  on public.multiplayer_reward_ledger (room_name, bot_id, created_at desc);

create index if not exists multiplayer_reward_ledger_dry_run_idx
  on public.multiplayer_reward_ledger (dry_run, applied, created_at desc);

create unique index if not exists multiplayer_reward_ledger_source_event_applied_uidx
  on public.multiplayer_reward_ledger (source_event_id)
  where source_event_id is not null and applied = true;

alter table public.multiplayer_reward_ledger enable row level security;
revoke all on public.multiplayer_reward_ledger from anon, authenticated;

create table if not exists public.multiplayer_progression_shadow (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  player_id uuid not null,
  supabase_user_id uuid,
  source_ledger_id uuid,
  source_event_id text,
  room_name text,
  reward_reason text,
  current_xp integer,
  preview_xp integer,
  xp_delta integer not null default 0,
  current_credits integer,
  preview_credits integer,
  credits_delta integer not null default 0,
  current_level integer,
  preview_level integer,
  loot_preview jsonb not null default '[]'::jsonb,
  contribution_percent numeric,
  final_hit boolean not null default false,
  top_contributor boolean not null default false,
  applied_to_real_save boolean not null default false,
  dry_run boolean not null default true,
  metadata jsonb not null default '{}'::jsonb
);

comment on table public.multiplayer_progression_shadow is
  'Server-only staging shadow table for future multiplayer progression previews. Not an authoritative player save.';

comment on column public.multiplayer_progression_shadow.applied_to_real_save is
  'Must remain false for staging shadow rows. Real player_saves/progression are not mutated by this table.';

create index if not exists multiplayer_progression_shadow_player_created_idx
  on public.multiplayer_progression_shadow (player_id, created_at desc);

create index if not exists multiplayer_progression_shadow_source_ledger_idx
  on public.multiplayer_progression_shadow (source_ledger_id);

create index if not exists multiplayer_progression_shadow_dry_run_created_idx
  on public.multiplayer_progression_shadow (dry_run, created_at desc);

alter table public.multiplayer_progression_shadow enable row level security;
revoke all on public.multiplayer_progression_shadow from anon, authenticated;
