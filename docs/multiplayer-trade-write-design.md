# Multiplayer Trade Write Design

## Purpose

This document designs the future Phase 5 multiplayer staging trade write path. It does not enable real credit, cargo, inventory, bounty, loot, PvP, player damage, Supabase schema, or broad `player_saves` writes.

The goal is to move safely from:

1. Trade Terminal preview only.
2. Trusted save validation.
3. Allowlisted server-authoritative buy/sell write prototype.
4. Client refresh from the server result.

## Current Staging State

Normal single-player trading still uses the local Trade Terminal and existing `saveGame()` path.

In `?mp=staging`:

- Local Trade Terminal buy/sell mutations are fenced before they can change credits, cargo, cargo cost basis, trade totals, or saves.
- The real Trade Terminal can call Colyseus `stagingTrade:preview` for routes that map to static staging offers.
- `stagingTrade:preview` calculates cost, revenue, profit, and validation server-side.
- Validation can use a verified service-role `player_saves` read, a sanitized client snapshot fallback, or unknown price-preview mode.
- Preview results always report `applied:false`, `creditsWritten:false`, `cargoWritten:false`, and `saveWritten:false`.
- The separate Staging Trade Preview overlay remains a dev helper.
- Phase 5a scaffolding added `stagingTrade:buy` and `stagingTrade:sell` handlers that return write-shaped dry-run results.
- Phase 5b adds a tiny, heavily gated `stagingTrade:buy` write prototype. It is disabled by default and can patch only root `credits`, root `cargo[resourceName]`, and root `cargoCostBasis[resourceName]` when every staging gate passes.
- Phase 5c adds post-write reconciliation polish. Successful writes return server after-values, the client displays those values, blocks duplicate pending clicks, and refreshes from Supabase instead of using local trade mutation shortcuts.
- Phase 5d adds a gated `stagingTrade:sell` write prototype for root `credits`, root `cargo[resourceName]`, and root `cargoCostBasis[resourceName]`. Sell route completion, realized profit, and trade totals remain excluded.

## Existing Local Trade Mutation Path

Local trade state is stored in the save snapshot built by `buildSaveState()` in `js/07-save-load.js`.

Relevant saved fields:

- `saveVersion`: root `SAVE_VERSION`.
- `credits`: root number.
- `cargo`: root object keyed by resource name, for example `Iron`, `Copper`, `Cobalt`, `Crystal Shards`.
- `cargoCostBasis`: root object keyed by resource name.
- `currentNode`: root current map node, save-adjusted on leave if needed.
- `lastPlanetNode`: root last known planet node.
- `currentShipId`: root current ship id.
- `ownedShips`, `ownedGuns`, `ownedAttachments`, `shipLoadouts`: root ownership/loadout fields used to derive cargo capacity.
- `marketStock`: root market stock object.
- `activeTradeRoute`: root active route object with `good`, `origin`, `destination`, `buyPrice`, `sellPrice`, `maxUnits`, `purchasedUnits`, `realizedProfit`, and `marketTrade`.
- `activeObjective`: may mirror a trade route when `type:"trade"`.
- `playerProgress`: root object. Trade totals live under `playerProgress.totals`, including `tradesCompleted`, `tradeProfit`, and `cargoSold`.

Local buy paths:

- `buyMarketCargo()` subtracts `credits`, increments `cargo[good]`, updates `cargoCostBasis[good]`, creates/updates `activeTradeRoute`, calls tutorial hooks, then calls `saveGame()`.
- `buyGood()` subtracts `credits`, increments `cargo[good]`, updates route purchase progress if an active route exists, updates `cargoCostBasis[good]`, then calls `saveGame()`.

Local sell paths:

- `sellMarketCargo()` validates held cargo, adds sale revenue to `credits`, clears the sold cargo and cost basis, increments `playerProgress.totals.cargoSold`, updates active route realized profit, may complete the route, then calls `saveGame()`.
- `sellGood()` removes selected cargo quantity, adds revenue to `credits`, increments `playerProgress.totals.cargoSold`, updates route realized profit, clears cost basis when the resource reaches zero, may complete the route, then calls `saveGame()`.

Cargo capacity is not saved as a direct canonical field. It is derived client-side from `currentShipId`, `SHIPS`, `shipLoadouts`, and attachment effects in `getShipStats()`. A server write path must either share that rules data server-side or reject capacity validation if the derived value is ambiguous.

## Proposed Server Boundary

Create a future service:

`server/colyseus/src/services/tradeWriteService.js`

It should expose pure planning helpers and a write adapter:

- `buildTradeWritePlan(input, context)`
- `applyTradeWritePlan(plan, options)`
- `buildTradeBuyPlan(input, context)`
- `buildTradeSellPlan(input, context)`

`LupenSectorRoom` has staging messages:

- `stagingTrade:buy`
- `stagingTrade:sell`

The room passes identity, offer id, operation, quantity, trusted read state, and sanitized snapshot fallback into the staging trade helpers. It does not trust client price, cargo, credits, or profit fields.

For Phase 5b/5d, `stagingTrade:buy` and `stagingTrade:sell` may call `tradeWriteService.js` only when all gates pass. Otherwise they return the same dry-run/blocked result shape with write flags false.

## Proposed Buy Path

Input:

- verified session identity
- `offerId`
- `quantity`

Server responsibilities:

1. Verify the player is in the staging room and has verified Supabase identity.
2. Load the staging offer by `offerId`.
3. Clamp and validate quantity against `STAGING_TRADE_WRITE_MAX_QUANTITY` and offer limits.
4. Read trusted `player_saves` with the service role.
5. Extract and validate `credits`, `cargo`, `cargoCostBasis`, `currentShipId`, `shipLoadouts`, and `saveVersion`.
6. Derive or validate cargo capacity from server-known ship/loadout rules. If the server cannot derive capacity safely, block.
7. Calculate total cost server-side from the offer buy price.
8. Ensure `credits >= totalCost`.
9. Ensure `cargoUsed + quantity <= cargoCapacity`.
10. Create the patched save data:
    - `credits -= totalCost`
    - `cargo[resourceName] += quantity`
    - weighted average `cargoCostBasis[resourceName]`
    - optional `activeTradeRoute` creation/update if Phase 5 includes route state
11. Preserve every unrelated save field exactly.
12. Write back `save_data` only if all gates pass.
13. Return a sanitized result with before/after values and write flags.

Phase 5 should initially skip `marketStock` mutation unless the design explicitly adds stock authority. Static staging offers are simpler and safer.

## Proposed Sell Path

Input:

- verified session identity
- `offerId` or server-resolved resource/destination route
- `quantity`

Server responsibilities:

1. Verify staging room and Supabase identity.
2. Validate offer and sell destination.
3. Clamp and validate quantity.
4. Read trusted `player_saves`.
5. Extract `credits`, `cargo`, `cargoCostBasis`, `activeTradeRoute`, `playerProgress.totals`, `currentNode`, and `lastPlanetNode`.
6. Ensure `cargo[resourceName] >= quantity`.
7. Calculate revenue server-side from the offer sell price.
8. Calculate profit preview from saved `cargoCostBasis[resourceName]` when present.
9. Patch save data:
    - `credits += revenue`
    - `cargo[resourceName] -= quantity`
    - delete `cargoCostBasis[resourceName]` only if that cargo reaches zero
    - update `playerProgress.totals.cargoSold`
    - update `playerProgress.totals.tradeProfit` only if the sell qualifies as route completion
    - update `activeTradeRoute.realizedProfit` if route state is in scope
10. Preserve unrelated fields exactly.
11. Write back `save_data` only if all gates pass.
12. Return sanitized before/after values and write flags.

Phase 5 should not complete bounties, grant loot, write inventory, or alter store/equipment state.

## Gate And Env Design

Trade write env vars:

- `STAGING_TRADE_WRITE_ENABLED=false`
- `STAGING_TRADE_WRITE_ALLOWLIST=`
- `STAGING_TRADE_WRITE_SCOPE=allowlist`
- `STAGING_TRADE_WRITE_MAX_QUANTITY=10`
- `STAGING_TRADE_WRITE_ALLOWED_OFFERS=`
- `STAGING_TRADE_WRITE_DRY_RUN=true`

Default behavior remains dry-run only.

Real write eligibility requires all of:

- request originated from the staging multiplayer path
- room is `lupen_sector`
- operation is `buy` or `sell`
- Supabase identity is verified
- trusted player id exists
- `STAGING_TRADE_WRITE_ENABLED=true`
- `STAGING_TRADE_WRITE_DRY_RUN=false`
- allowlist or configured scope passes
- `offerId` is known and allowed
- quantity is a positive integer and within max limits
- trusted `player_saves` read succeeds
- cargo capacity can be safely derived server-side
- credit/cargo validation passes

Any failed gate returns a structured blocked result with all write flags false.

Phase 5b/5d exact gates for a real buy or sell write:

- Colyseus request reaches the staging `lupen_sector` room.
- `STAGING_TRADE_WRITE_ENABLED=true`.
- `STAGING_TRADE_WRITE_DRY_RUN=false`.
- Supabase identity is verified.
- trusted player id exists.
- `STAGING_TRADE_WRITE_SCOPE=allowlist` and the verified player id appears in `STAGING_TRADE_WRITE_ALLOWLIST`, or scope is intentionally set to `verified`.
- `offerId` is known.
- if `STAGING_TRADE_WRITE_ALLOWED_OFFERS` is present, `offerId` is included.
- quantity is a positive integer within the offer limit and `STAGING_TRADE_WRITE_MAX_QUANTITY`.
- trusted service-role `player_saves` read succeeds.
- root `credits`, root `cargo`, root `cargoCostBasis`, and trusted cargo capacity are valid.
- server-calculated cost and cargo capacity validation pass.
- sell-specific: the player's server presence node must match the offer's `sellNode`.
- sell-specific: `cargo[resourceName] >= quantity`.
- sell-specific: `cargoCostBasis[resourceName]` must be numeric.

Phase 5c/5d client reconciliation rules:

- never call the old local buy/sell mutation path after a server write
- show server `creditsBefore` -> `creditsAfter`
- show server resource cargo `cargoBefore` -> `cargoAfter`
- show server hold usage `cargoUsedBefore` -> `cargoUsedAfter` of `cargoCapacity`
- disable the staging buy/sell button while the request is pending
- after `applied:true`, call the existing safe cloud save reload path when available
- if reload fails or is unavailable, keep showing the server result and tell the tester to reload/reopen to sync full save display

## Result Contracts

Phase 5a buy/sell results use this write-shaped dry-run contract. Phase 5b/5d buy and sell results may return `mode:"trade_write"` and `applied:true` only for gated paths.

Successful Phase 5b/5c/5d buy/sell responses must include sanitized reconciliation fields:

- `resourceId`, `resourceName`, `quantity`, `cost` for buy or `revenue` for sell
- `creditsBefore`, `creditsAfter`
- `cargoBefore`, `cargoAfter`
- `cargoUsedBefore`, `cargoUsedAfter`, `cargoCapacity`
- `writes.creditsWritten:true`, `writes.cargoWritten:true`, `writes.saveWritten:true`
- `writes.inventoryWritten:false`, `writes.lootWritten:false`, `writes.bountyWritten:false`

Future `stagingTrade:buy` and `stagingTrade:sell` responses should use a shared shape:

```json
{
  "ok": true,
  "mode": "dry_run",
  "operation": "buy",
  "applied": false,
  "offerId": "staging-iron-asteron-virella",
  "resourceId": "iron",
  "resourceName": "Iron",
  "quantity": 3,
  "creditsDelta": -54,
  "cargoDelta": 3,
  "cost": 54,
  "revenue": 0,
  "profitPreview": 21,
  "creditsBefore": 10000,
  "creditsAfter": 9946,
  "cargoBefore": 10,
  "cargoAfter": 13,
  "cargoCapacity": 150,
  "saveVersion": 1,
  "gates": {
    "verified": true,
    "writeEnabled": false,
    "dryRun": true,
    "allowlisted": false,
    "scope": "allowlist",
    "trustedSaveAvailable": true,
    "idempotencyReady": true,
    "duplicateDetected": false
  },
  "writes": {
    "creditsWritten": false,
    "cargoWritten": false,
    "saveWritten": false,
    "inventoryWritten": false,
    "lootWritten": false,
    "bountyWritten": false
  },
  "reason": "trade_write_dry_run",
  "debugReason": "write_disabled"
}
```

`debugReason` should only be shown by browser UI in `?debug=mp`. Raw save JSON, Supabase URLs, service keys, access tokens, and raw database errors must never be returned.

## Save Patch Boundaries

Phase 5b/5d prototype may patch only:

- `credits`
- `cargo[resourceName]`
- `cargoCostBasis[resourceName]`

It must not patch:

- inventory
- loot
- bounties
- ships
- guns
- attachments
- loadout ownership
- store purchases
- combat XP
- bounty progress
- player damage or PvP state

The first implementation writes only `credits`, `cargo`, and `cargoCostBasis`. For partial sells, the average unit cost basis remains unchanged. When all units of a resource are sold, the resource cargo is set to `0` and that resource cost basis is removed. Trade routes, active objectives, trade totals, inventory, loot, bounties, PvP, and player damage remain excluded.

## Atomicity And Concurrency Risks

Current `player_saves.save_data` is a JSON snapshot. A read-modify-write patch can lose concurrent changes if two tabs or devices trade at the same time.

Risks:

- two tabs read the same credits and both buy
- double-click or duplicate Colyseus message applies twice
- stale client snapshots disagree with trusted save
- partial save write would corrupt expected state
- negative credits/cargo if validation and write race
- cargo over capacity if capacity is stale or misderived
- unrelated save fields overwritten by an older snapshot

Minimum Phase 5 mitigation:

- server reads fresh `player_saves` immediately before each plan
- use only server offer prices
- ignore client price/profit fields
- enforce in-memory room idempotency for each operation
- include stable idempotency key in every plan
- revalidate after read and before write
- preserve full save object and patch only known fields
- reject if required fields are missing or non-numeric
- reject if cargo capacity cannot be derived
- write only when env gates pass

This is not true cross-process atomicity. Colyseus Cloud scaling, restarts, and direct Supabase row updates can still create race conditions. Before broader rollout, use one of:

- a dedicated trade ledger with unique idempotency key
- a server-side Postgres function/RPC that performs validation and update transactionally
- compare-and-swap using `updated_at` or a save revision column
- normalized wallet/cargo tables with row-level locks

Current least risky implementation: gated, allowlisted `player_saves` JSON patch for tiny buy/sell quantities on staging accounts only, with explicit warnings that it is a prototype, not the final economy model. Because this is a full JSON snapshot patch, it is still vulnerable to cross-process races and should not be broadened without a ledger/RPC/normalized economy design.

## Supabase And Data Model Considerations

Phase 5 can prototype against `player_saves.save_data`, but long-term economy authority should move away from client-shaped snapshots.

Future table options:

- `multiplayer_trade_ledger`: immutable audit rows for buy/sell intents, validation, idempotency, and outcome.
- `player_wallets`: server-owned credits balance.
- `player_cargo`: normalized resource quantities and cost basis.
- `player_inventory`: server-owned equipment/item inventory.
- `economy_events`: append-only event stream for rewards, trades, store purchases, salvage, and corrections.

Recommendation:

- Phase 5: use gated `player_saves` JSON patch only for prototype validation.
- Phase 6+: add a `multiplayer_trade_ledger` before any broader credit/cargo writes.
- Long term: move wallet and cargo into normalized server-owned tables or transactional RPCs. Treat `player_saves` as a compatibility snapshot, not the source of truth for multiplayer economy.

No public/client RLS policies should be added for economy write tables. Browser clients should request actions from Colyseus, not write economy rows directly.

## Test Plan

Future tests for `tradeWriteService.js` and room handlers:

- dry-run default never writes
- write disabled blocks
- dry-run env blocks even when write enabled
- unverified identity blocks
- missing trusted player id blocks
- missing allowlist blocks
- verified player not in allowlist blocks
- verified allowlisted player can proceed to dry-run plan
- unknown offer blocks
- offer not in `STAGING_TRADE_WRITE_ALLOWED_OFFERS` blocks
- invalid quantity blocks
- quantity above max blocks
- insufficient credits blocks buy
- insufficient cargo space blocks buy
- insufficient cargo blocks sell
- cargo capacity missing/ambiguous blocks
- buy write patches only credits/cargo/cargoCostBasis
- sell write patches only credits/cargo/cargoCostBasis/trade totals when enabled
- credits never go negative
- cargo never goes negative
- cargo never exceeds capacity
- duplicate idempotency key blocks
- repeated Colyseus message does not double-apply
- mocked Supabase write failure fails closed
- unrelated save fields remain deep-equal
- no inventory/loot/bounty/player damage/PvP fields are changed
- normal non-staging Trade Terminal functions remain unchanged

Normal local `npm test` must not require real Supabase secrets or perform real writes. Real write tests should use mocks unless a manually gated staging validation task explicitly enables them.

## Recommended Implementation Sequence

1. Phase 5a complete: add write-shaped dry-run contract helpers and `stagingTrade:buy` / `stagingTrade:sell` handlers with no save writes.
2. Keep extending tests around buy/sell blocked reasons, gates, and no-write flags.
3. Add `tradeWriteService.js` only when moving beyond scaffold helpers into a real write adapter design.
4. Add mocked tests for save patch boundaries before any write adapter is connected.
5. Add env gates and allowlist reporting to the UI in `?debug=mp`.
6. Manually test with `STAGING_TRADE_WRITE_DRY_RUN=true`.
7. Only after review, test tiny writes on a single allowlisted verified staging user with max quantity 1.
8. Add a dedicated ledger or transactional RPC before any wider staging access.

Until Phase 5 implementation is explicitly requested, no real credit/cargo/save write path should be added or enabled.
