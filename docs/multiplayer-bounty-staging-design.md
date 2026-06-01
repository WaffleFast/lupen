# Multiplayer Staging Bounty Design

This document tracks the narrow `?mp=staging` bounty wrapper for server-owned staging combat. It does not change normal single-player bounties.

## Current Bounty

`Erebus Patrol Sweep`

- Id: `staging_erebus_patrol_2`
- Objective: destroy 2 server-owned staging Erebus bots.
- Eligible kills: disabled server-owned staging bots where the player contributed damage.
- Reward: XP only.
- XP amount: 25.
- Credits: 0.
- Loot: none.
- Persistence: room/session only for bounty progress.
- Repeatable: false in the current room/session.

## Boundaries

The staging bounty does not use or mutate local bounty state in `js/04-trade-bounty-objectives.js`, local objective state, local bot arrays, bounty contracts, cargo, inventory, loot, trade totals, route completion, PvP, or player damage.

The claim flow reuses the existing gated XP-only reward path:

- Verified Supabase identity is required for a real XP write.
- The player must have accepted the staging bounty.
- The player must have contributed to enough destroyed staging bots.
- The claim must not be a duplicate for the same bounty completion.
- `ENABLE_STAGING_PROGRESSION_WRITES=true` must be enabled server-side.
- `STAGING_PROGRESSION_WRITE_SCOPE` and `STAGING_PROGRESSION_WRITE_ALLOWLIST` gates must pass.
- The service-role `player_saves` read and XP-only patch must succeed.

When the XP-only patch applies, it touches only `playerProgress.combatXp`. Credits, loot, inventory, bounties, route completion, trade totals, cargo, loadouts, owned items, and broad progression remain excluded.

## Client UX

The real Bounty Board now switches to a staging-backed mode when `?mp=staging` is active:

- `MP STAGING BOUNTIES`
- `Erebus Patrol Sweep`
- Server-owned progress `0/2`, `1/2`, `2/2`
- Accept staging bounty
- Progress `0/2`, `1/2`, `2/2`
- Claim XP
- Claim state: simulated, blocked, applied, or already claimed
- Clear copy that the bounty is server-owned and excludes credits, loot, inventory, and local bounty save writes

The floating staging bounty overlay remains a compact status helper only. It no longer acts as the primary accept/claim UI, which avoids running two full bounty interfaces at once.

Detailed gates, ledger/shadow, and player-save diagnostics remain behind `?debug=mp`.

## Next Phase

The next sensible phase is a loot dry-run preview or more durable bounty idempotency. Do not enable real credits or loot until they have dedicated ledgers, idempotency, and validators.
