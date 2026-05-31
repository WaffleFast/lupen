-- Lupen multiplayer reward ledger draft.
--
-- This file is documentation/planning only. Do not run it automatically.
-- The future multiplayer reward pipeline should write authoritative rewards
-- from trusted server code into a ledger like this instead of trusting
-- client-side save snapshots directly.
--
-- Design goals:
-- - Keep a durable audit trail of server-owned multiplayer rewards.
-- - Support duplicate protection / idempotency with source_event_id later.
-- - Preserve dry-run rows separately from applied rewards during staging.
-- - Allow rewards to be projected into player_saves or profile state later by
--   controlled server-side code.

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
  'Future server-side multiplayer reward ledger for Lupen. Draft only; not currently applied.';

comment on column public.multiplayer_reward_ledger.source_event_id is
  'Future idempotency key for duplicate protection, e.g. reward preview/event id.';

comment on column public.multiplayer_reward_ledger.dry_run is
  'True for staging/dry-run entries. Real reward writes must be explicitly enabled later.';

comment on column public.multiplayer_reward_ledger.metadata is
  'Extra audited reward context such as session id, contribution list, room version, and dry-run diagnostics.';

-- Recommended future indexes, if/when this draft is applied:
-- create index if not exists multiplayer_reward_ledger_player_id_idx
--   on public.multiplayer_reward_ledger (player_id, created_at desc);
--
-- create unique index if not exists multiplayer_reward_ledger_source_event_id_idx
--   on public.multiplayer_reward_ledger (source_event_id)
--   where source_event_id is not null and applied = true;
