# Multiplayer Staging Bounty Design

This document tracks the narrow `?mp=staging` bounty wrapper for server-owned staging combat. It does not change normal single-player bounties.

## Current Bounty

`Erebus Patrol Sweep`

- Id: `staging_erebus_patrol_2`
- Objective: destroy 1 server-owned Erebus bot, then return to claim the Academy payout.
- Eligible kills: disabled server-owned staging bots where the player contributed damage.
- Bounty reward: `900 CR` and `25 Lupen Shards`.
- Bounty XP: 0; the destroyed bot still grants its normal combat XP separately.
- Persistence: room/session only for bounty progress.
- Repeatable: false in the current room/session.

## Boundaries

The staging bounty does not use or mutate local bounty state in `js/04a-bounty-board.js`, local objective state, local bot arrays, bounty contracts, cargo, inventory, loot, trade totals, route completion, PvP, or player damage.

The claim flow uses the existing verified, idempotent server reward path:

- Verified Supabase identity is required for a real XP write.
- The player must have accepted the staging bounty.
- The player must have contributed to enough destroyed staging bots.
- The claim must not be a duplicate for the same bounty completion.
- `ENABLE_STAGING_PROGRESSION_WRITES=true` must be enabled server-side.
- `STAGING_PROGRESSION_WRITE_SCOPE` and `STAGING_PROGRESSION_WRITE_ALLOWLIST` gates must pass.
- The service-role `player_saves` read and narrow reward patch must succeed.

The bounty claim is limited to its declared credits and Lupen Shards. Bot combat XP is awarded by the separate server-owned bot-destruction receipt; inventory items, cargo, loadouts, owned ships, trade totals, route completion and broad progression remain excluded.

## Client UX

The real Bounty Board now switches to a staging-backed mode when `?mp=staging` is active:

- `MP STAGING BOUNTIES`
- `Erebus Patrol Sweep`
- Server-owned progress `0/1`, `1/1`
- Accept staging bounty
- Progress `0/1`, `1/1`
- Claim bounty payout
- Claim state: simulated, blocked, applied, or already claimed
- Clear copy that the bounty is server-owned and excludes credits, loot, inventory, and local bounty save writes

The floating staging bounty overlay remains a compact status helper only. It no longer acts as the primary accept/claim UI, which avoids running two full bounty interfaces at once.

The board refreshes staging bounty status from Colyseus after accept and claim actions, and uses a light stale-status refresh while the Bounty Board is open. Server messages from bot destruction still drive the primary progress updates.

Detailed gates, ledger/shadow, and player-save diagnostics remain behind `?debug=mp`.

Local Colyseus `npm.cmd test` still expects a server listening on port `2567`; the browser smoke suite is safe by default and does not require a live staging write.

## Next Phase

The next sensible phase is a loot dry-run preview or more durable bounty idempotency. Do not enable real credits or loot until they have dedicated ledgers, idempotency, and validators.
