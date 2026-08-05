# Player Data Storage Audit

## Question

Are Lupen player saves currently fully server-held, with one account experience shared across browsers and devices?

## Short answer

Not yet. Lupen has a Supabase-backed cloud save and several server-owned multiplayer/staging systems, but the browser is still the primary writer for the broad single-player save document. Authenticated players can sync that browser-built save to Supabase, and Colyseus can read or narrowly patch parts of `player_saves` for gated staging flows, but the current architecture is not fully server-authoritative for credits, inventory, cargo, contracts, mission progress, ships, loadouts, forge output, or most progression.

The practical status is: local-first gameplay with optional cloud sync, plus server-owned multiplayer islands.

## Current server-held pieces

- Supabase Auth identifies logged-in players through `getSupabaseClient()` in `js/00-supabase-client.js`.
- Supabase has a `public.player_saves` table keyed by `user_id`, with RLS policies for each authenticated player to select, insert, and update their own save row. See `supabase/migrations/20260603_lupen_live_schema.sql`.
- The browser save service can upsert and load full `save_data` JSON for the authenticated user. See `js/services/saveService.js`.
- `js/07-save-load.js` can enable cloud sync, queue Supabase saves, load from Supabase, and offer a local-save-to-cloud migration prompt.
- Colyseus multiplayer owns live presence, server bot/resource state, PvP rules, chat, and staging combat intent validation. See `server/colyseus/src/rooms/LupenSectorRoom.js` and `js/network/multiplayerClient.js`.
- Colyseus has service-role helpers for trusted server-side reads and narrow writes against `player_saves`, including `server/colyseus/src/services/playerSaveReadService.js`, `playerSaveWriteService.js`, `tradeWriteService.js`, `storeWriteService.js`, `loadoutWriteService.js`, and `lootWriteService.js`.
- Existing multiplayer docs describe gated server-side previews and write prototypes for XP, trade, store, loadout, and loot. These are intentionally scoped, dry-run by default, or allowlisted.

## Current browser/local-held pieces

- `saveGame()` in `js/07-save-load.js` still builds the full gameplay save in the browser, writes it to `localStorage`, then queues a cloud save.
- `loadGame()` still restores from the local `STORAGE_GAME_KEY` path for normal startup.
- Supabase cloud save writes currently accept the browser-built `save_data` document through the authenticated client path.
- The browser keeps additional local state such as tutorial progress, debug flags, login/session hints, pending pilot name, and local save migration state.
- Guest or unauthenticated play is necessarily local-only.
- Many normal gameplay flows mutate browser state first, then persist through the local/cloud save path. That includes broad economy, cargo, inventory, mission, contract, ship, loadout, and forge state.
- Server-side staging write services are deliberately narrow. For example, progression patches only specific XP/credits/material paths, trade writes only selected credit/cargo paths, store/loadout writes only selected starter items, and many systems remain excluded by design.
- Gated Store purchases require a unique request ID and an optimistic
  `updated_at` revision match, preventing same-room retries and stale validated
  saves from applying twice. This is an intermediate guard, not durable
  cross-server idempotency.

## Risk assessment

The current approach is good enough for local play and light cloud continuity, but it does not yet guarantee a single authoritative account state. A player can still have divergent local saves, and most mutations are trusted from the browser before they become cloud data. Cloud save preservation logic, such as the combat XP floor in `js/services/saveService.js`, reduces some overwrite risk but does not turn the model into a server-owned experience.

For multiplayer or account-wide persistence, the main risk is trusting broad browser-built JSON. Server-owned systems should treat `player_saves` as an output of validated server actions, not as the source of truth for unvalidated player rewards or economy mutations.

## Recommended target

- Account state lives in Supabase/server storage as the canonical source.
- Browser storage becomes a cache for UI preferences, auth/session hints, debug flags, and possibly a last-known read-only save snapshot.
- Gameplay mutations go through server APIs or Colyseus messages with identity, validation, idempotency, and narrow transaction boundaries.
- Local save import remains a one-time migration path for existing players, after which server state wins.
- Guest/offline play is explicitly labelled as local-only or uses a separate profile model that cannot silently override account state.

## Migration order

1. Define the canonical save contract: which fields belong in `player_saves`, which need relational ledgers, and which are browser-only preferences.
2. Make authenticated startup load server state first and treat local save only as a migration/import candidate.
3. Move identity/profile and tutorial/mission progress to server-owned writes.
4. Move credits, cargo, daily trade contracts, bounty contracts, and route completion behind validated server mutations.
5. Move inventory, forge materials, equipment, ship ownership, and loadouts behind server mutations.
6. Expand current staging write gates into production-safe APIs with idempotency keys, audit ledgers, and rollback-safe tests.
7. Add regression coverage that proves authenticated gameplay does not persist authoritative fields through browser-only localStorage writes.

## Bottom line

Lupen has the foundation for server-held player data, but it is not fully there yet. The next architectural step is to invert save authority: the browser should request mutations and render returned state, while the server owns validation and persistence.
