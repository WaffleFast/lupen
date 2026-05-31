# Lupen Multiplayer Staging Roadmap

This note captures the current path from local single-player gameplay to hosted, multiplayer-safe gameplay. It is intentionally a migration guide, not an implementation plan for enabling every system at once.

## Current Staging State

Multiplayer staging is gated behind `?mp=staging` and connects to the hosted Colyseus `lupen_sector` room. It currently supports:

- Verified or guest player presence.
- Remote player ship images and labels.
- Server-owned staging bots.
- Server-validated staging bot lock-on.
- Server-owned staging fire, cooldown, shield/hull damage, disabled/respawn state, and synced shot visuals.
- Contribution tracking.
- Reward preview and claim simulation.
- Reward ledger and progression shadow dry-run/write adapters.
- Heavily gated XP-only `player_saves` patch preparation.
- XP-only claim diagnostics that summarize simulated, dry-run, blocked, duplicate, and applied staging outcomes without enabling credits or loot.
- Server-side staging trade preview/dry-run offers with deterministic route math, untrusted player snapshot validation, and no credit or cargo writes.
- Real client-side Trade Terminal buy/sell mutations are fenced in `?mp=staging`; testers can inspect the UI but must use the staging preview panel for trade dry-runs.
- In `?mp=staging`, the real Trade Terminal now starts routing matching buy/sell actions to Colyseus `stagingTrade:preview` so testers can see server-calculated dry-run cost, revenue, profit, validation status, and validation source in the normal trade UI.

Diagnostics remain available with `?debug=mp`.

## Intentionally Excluded

The following remain excluded from staging unless a later phase explicitly enables them:

- PvP.
- Player damage.
- Credits writes.
- Cargo writes.
- Loot or item grants.
- Inventory writes.
- Bounty completion.
- Economy changes.
- Broad `player_saves` progression writes.
- Client-side local combat bots as multiplayer enemies.

Server-owned staging bots may still show simplified arrow/fallback markers in some in-space contexts if an image fails to load. That is acceptable for now.

## Local Gameplay Audit

### Trading

Local trade resources are defined in [js/01-core-state.js](../js/01-core-state.js) through `mineralKeys`, `MAP_ONE_TRADE_RESOURCES`, commodity metadata, `planetMarkets`, and `marketStock`. Trade UI and buy/sell logic live mostly in [js/04-trade-bounty-objectives.js](../js/04-trade-bounty-objectives.js), including `buyMarketCargo()`, `sellMarketCargo()`, `buyGood()`, `sellGood()`, market pricing helpers, and active trade objective helpers.

Cargo is stored in global `cargo`, with purchase basis in `cargoCostBasis`. Credits are stored in global `credits`. Local buy/sell directly mutates `credits`, `cargo`, `cargoCostBasis`, active trade state, and `playerProgress.totals`, then calls `saveGame()`.

Multiplayer authority needs: server-side price calculation or signed market snapshots, cargo capacity validation, credit balance validation, idempotent buy/sell operations, and Supabase persistence through a server-owned ledger or transaction path.

Current staging trade prototype: Colyseus exposes static trade offers and a `stagingTrade:preview` dry-run response that calculates cost, revenue, and projected profit server-side. For verified staging players, Colyseus may read `player_saves` with the service role to validate saved credits and cargo used without exposing raw save data or writing anything. Because cargo capacity is currently derived from ship/loadout data in the client, the dry-run can use a sanitized client snapshot for capacity and clearly reports its sources. If trusted save state is unavailable, it falls back to a minimal untrusted snapshot of credits, cargo used, and cargo capacity; if neither is available it returns price preview only. It intentionally reports `creditsWritten:false`, `cargoWritten:false`, and `saveWritten:false`; it does not touch the real Trade Terminal, cargo hold, credits, `player_saves`, Supabase writes, or economy state.

While staging is active, real Trade Terminal buy/sell handlers return before mutating credits, cargo, cargo cost basis, trade totals, or saves. Normal single-player trading remains unchanged outside `?mp=staging`. A later phase should replace these disabled real actions with server-authoritative buy/sell validation and dedicated persistence.

Phase 4c Trade Terminal integration: the normal Trade Builder remains the primary staging trade surface. If the selected resource/origin/destination maps to a static staging offer, its button requests the server-side dry-run preview and renders the result in the Trade Terminal. Unknown routes remain blocked with a preview-unavailable message. The separate Staging Trade Preview overlay remains a compact dev helper for now.

Phase 5 design status: [multiplayer-trade-write-design.md](multiplayer-trade-write-design.md) now defines the future heavily gated server-authoritative trade write prototype. It is design-only. No credit, cargo, inventory, loot, bounty, PvP, player damage, schema, or broad `player_saves` writes are enabled. The next implementation pass should add `stagingTrade:buy` and `stagingTrade:sell` handlers in dry-run default mode, with real writes blocked unless explicit staging env gates, verified identity, allowlist, trusted save validation, and idempotency all pass.

Classification:

- Market definitions: config/static data for now.
- Buy/sell validation: server-authoritative.
- Cargo and credits: Supabase persistent data.
- Trade UI: client visual only.

### Resources And Asteroids

Asteroid/resource definitions live in [js/01-core-state.js](../js/01-core-state.js): `ASTEROID_RESOURCE_TYPES`, `MAP_ONE_ASTEROID_SPAWN_PLAN`, asteroid positions, and asteroid construction/normalization helpers. Runtime asteroid targeting, drops, salvage, cargo deposit, and collection live in [js/06-combat.js](../js/06-combat.js), including `generateLootFromAsteroid()`, `depositLootToCargo()`, `collectLoot()`, and `scheduleAsteroidRespawn()`.

Local resource drops are currently generated client-side and enter `cargo` or `lootByNode`. Multiplayer should move asteroid spawn state, depletion, drop rolls, cargo validation, and collection idempotency server-side before any real online resources are awarded.

Classification:

- Asteroid/resource definitions: config/static data for now.
- Asteroid alive/depleted state: server-authoritative.
- Resource drop rolls and collection: server-authoritative.
- Cargo persistence: Supabase persistent data.
- Asteroid visuals: client visual only.

### Bot Combat

Local combat flow is in [js/06-combat.js](../js/06-combat.js): `selectedTarget`, `engagedTarget`, `engageTarget()`, `performAttackCycle()`, `applyWeaponDamageToTarget()`, hit/death effects, local bot/asteroid rendering, local loot, bounty hooks, and XP awards. Shared pure combat math now lives in [js/rules/combatRules.js](../js/rules/combatRules.js).

Current staging combat is in [server/colyseus/src/rooms/LupenSectorRoom.js](../server/colyseus/src/rooms/LupenSectorRoom.js) and [js/network/multiplayerOverlay.js](../js/network/multiplayerOverlay.js). It is server-owned for staging bots and damage, but rewards remain preview/dry-run except for heavily gated XP-only preparation.

Reusable now: ship/bot visuals, target panel styling, weapon display metadata, pure damage helper concepts, shot/hit presentation. Must remain server-authoritative: target validity, cooldowns, damage, bot disabled/respawn, contribution, reward eligibility, and any future drops.

Classification:

- Combat visuals and HUD: client visual only.
- Combat validation/damage/cooldowns: server-authoritative.
- Bot state: server-authoritative.
- Reward claims: server-authoritative plus Supabase persistent data.

### Store, Equipment, And Ships

Ship definitions live in [js/01-core-state.js](../js/01-core-state.js) under `SHIPS`; equipment definitions are spread through core state and weapon data modules such as [js/data/weapon-families.js](../js/data/weapon-families.js). Store and hangar logic live in [js/05-hangar-store.js](../js/05-hangar-store.js), including daily store stock, purchase buttons, `storeBuySelected()`, `buyShip()`, `buyGun()`, `buyAttachment()`, and sell helpers.

Purchases currently mutate `credits`, `ownedShips`, `ownedGuns`, `ownedAttachments`, `inventoryItems`, `shipLoadouts`, and `storeDailyPurchases`, then save locally/cloud via `saveGame()`.

Multiplayer authority needs: server-side price/stock validation, ownership checks, daily purchase idempotency, credit spend validation, and inventory/ownership writes through a dedicated server path.

Classification:

- Store catalogue: config/static data for now.
- Purchase/sell validation: server-authoritative.
- Ownership and inventory: Supabase persistent data.
- Store/hangar UI: client visual only.

### Inventory And Loadout

Inventory state lives in [js/01-core-state.js](../js/01-core-state.js) as `inventoryItems`, `ownedGuns`, `ownedAttachments`, `ownedShips`, and `shipLoadouts`. Hangar loadout operations live in [js/05-hangar-store.js](../js/05-hangar-store.js), including `equipAttachmentFromInventory()`, `equipGunFromInventory()`, `removeAttachment()`, `removeGun()`, `equipShip()`, `applyShipStats()`, and vault grouping helpers.

Item stats affect ship stats and weapon payloads, so online play needs server validation for ownership, slot limits, item quality/level, loadout legality, and derived stat calculation.

Classification:

- Item definitions: config/static data for now.
- Loadout legality and stat derivation: server-authoritative for multiplayer.
- Inventory/loadout ownership: Supabase persistent data.
- Hangar/vault UI: client visual only.

### Rewards And Progression

Local XP and totals are in `playerProgress` in [js/01-core-state.js](../js/01-core-state.js). Local bot destruction in [js/06-combat.js](../js/06-combat.js) calls local loot, bounty, XP, and save flows such as `generateBotLootItems()`, `addInventoryItems()`, `trackBountyBotKill()`, and `awardCombatXpFromBot()`.

Staging reward flow is server-side in [server/colyseus/src/rooms/LupenSectorRoom.js](../server/colyseus/src/rooms/LupenSectorRoom.js) and service helpers:

- [rewardLedgerService.js](../server/colyseus/src/services/rewardLedgerService.js)
- [progressionShadowService.js](../server/colyseus/src/services/progressionShadowService.js)
- [rewardApplicationService.js](../server/colyseus/src/services/rewardApplicationService.js)
- [playerSaveWriteService.js](../server/colyseus/src/services/playerSaveWriteService.js)

Safe enablement order should remain: reward preview, contribution, verified identity, ledger audit, progression shadow, XP-only dry-run, idempotency, allowlist, tiny XP-only patch, then later credits/loot/bounties only after their own ledgers and validators exist.

Current XP-only staging claim status: the server returns a compact claim contract with `mode`, XP delta, identity/allowlist/idempotency gates, ledger/shadow write status, and player-save write status. Browser UI uses that contract to show `Sim Claim`, `Claim XP`, or `Claimed` while still stating that credits and loot are not awarded in staging.

Classification:

- Reward preview UI: client visual only.
- Reward eligibility/contribution/idempotency: server-authoritative.
- Ledger/shadow/progression persistence: Supabase persistent data.
- Reward amounts/tables: config/static data for now.

## Recommended Implementation Order

1. Phase 1: Connection, presence, remote ships, staging bots, lock/fire/damage, debug tools.
2. Phase 2: Combat loop clarity, bot destruction feedback, contribution, XP preview.
3. Phase 3: Safe XP-only online reward writes.
4. Phase 4: Server-side resource/trade prototype with credits and cargo still gated or dry-run. Started with static staging trade offers, server-calculated previews, player-state-aware dry-run validation, read-only trusted `player_saves` checks for verified staging players, and Phase 4c Trade Terminal integration for staging-only dry-run previews.
5. Phase 5: Server-authoritative trade write prototype with strict validation. Design complete; implementation not enabled. First implementation should remain dry-run by default with gated `stagingTrade:buy` and `stagingTrade:sell` handlers.
6. Phase 6: Store purchases and ship/equipment ownership.
7. Phase 7: Inventory/loadout persistence.
8. Phase 8: Asteroids/resource finding.
9. Phase 9: Loot tables/item drops.
10. Phase 10: Bounties.
11. Phase 11: Economy balancing and anti-abuse checks.
12. Phase 12: PvP/player damage much later.

## Practical Next Steps

- Keep refining staging combat readability and automated tests before broadening reward writes.
- Next phase: test tiny XP-only writes only with explicit server env gates and an allow-listed verified account, then keep proving duplicate protection before any broader progression path.
- Continue Phase 4 by hardening trade dry-run validation and tester UX before adding any heavily gated server-authoritative credit/cargo write prototype. Only consider writes after manual validation and dedicated persistence/idempotency gates.
- Next trade implementation pass: add `stagingTrade:buy` and `stagingTrade:sell` handlers that default to dry-run/blocked, then test strict gating before any real credit or cargo write is considered.
- Use dedicated ledgers for every real online reward or economic mutation.
- Treat `player_saves` as an output of verified server actions, not as a client-trusted source for multiplayer rewards.
- Keep `?debug=mp` as the place for raw server diagnostics; keep normal `?mp=staging` focused on tester flow.
