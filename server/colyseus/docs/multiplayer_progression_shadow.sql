-- Lupen multiplayer progression shadow draft.
--
-- This file is documentation/planning only. Do not run it automatically.
-- The table proposed here is a staging shadow/audit table for previewing
-- future server-side reward application without mutating real player_saves
-- or authoritative player progression.
--
-- Design goals:
-- - Record what a verified staging reward application would do.
-- - Keep the row separate from real XP, credits, inventory, bounties, saves,
--   loot, and player_saves.
-- - Support auditability before real progression writes are enabled.
-- - Make it explicit that this table is not an authoritative player save.

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
  'Staging-only shadow/audit table for future Lupen multiplayer reward application previews. Not real progression and not an authoritative player save.';

comment on column public.multiplayer_progression_shadow.applied_to_real_save is
  'Must remain false for staging shadow rows. Real player_saves/progression are not mutated by this table.';

comment on column public.multiplayer_progression_shadow.dry_run is
  'True for staging shadow previews. These rows describe what would happen, not what was applied.';

comment on column public.multiplayer_progression_shadow.metadata is
  'Extra audited context such as display name, bot id/name/node, save preview availability, and disabled write diagnostics.';

create index if not exists multiplayer_progression_shadow_player_created_idx
  on public.multiplayer_progression_shadow (player_id, created_at desc);

create index if not exists multiplayer_progression_shadow_source_ledger_idx
  on public.multiplayer_progression_shadow (source_ledger_id);

create index if not exists multiplayer_progression_shadow_dry_run_created_idx
  on public.multiplayer_progression_shadow (dry_run, created_at desc);
