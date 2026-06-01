# Multiplayer Store Write Design

## Purpose

This document tracks the staging path for bringing the Store online without enabling broad real purchases. Phase 1 is preview-only: server-owned Store catalogue, server-side validation, and real Store UI integration in `?mp=staging`. Phase 2 adds one heavily gated write prototype for `attachment:cargoPod` only.

## Current Phase 1/2

Normal single-player Store behavior remains unchanged.

In `?mp=staging`:

- Real Store purchase and sell mutation paths are fenced before credits, inventory, equipment ownership, ship ownership, daily stock, or saves can change.
- The real Store UI remains the player-facing surface.
- Mapped Store items show `Server Preview`.
- Unmapped Store items show `Server preview unavailable`.
- Colyseus exposes `stagingStore:listItems` and `stagingStore:previewPurchase`.
- Colyseus also exposes `stagingStore:purchase` for `attachment:cargoPod` only.
- Preview responses are always `mode:"dry_run"` and `applied:false`.
- Preview responses always report `creditsWritten:false`, `inventoryWritten:false`, `shipWritten:false`, `equipmentWritten:false`, `saveWritten:false`, `lootWritten:false`, and `bountyWritten:false`.
- Purchase responses default to dry-run/blocked unless every Store write gate passes.
- `gun:pulseLaser` and `attachment:shieldBooster` remain preview-only.

Initial staging Store items:

- `gun:pulseLaser`
- `attachment:cargoPod`
- `attachment:shieldBooster`

## Local Store Audit

Store and hangar logic live mainly in [js/05-hangar-store.js](../js/05-hangar-store.js).

Purchase flow:

- `storeBuySelected()` chooses the selected Store item and routes to `buyAttachment()`, `buyGun()`, `buyShip()`, or quality/core item branches.
- `buyAttachment()` subtracts credits, increments `ownedAttachments`, fires tutorial hooks, renders Store, and calls `saveGame()`.
- `buyGun()` subtracts credits, increments `ownedGuns`, fires tutorial hooks, renders Store, and calls `saveGame()`.
- `buyShip()` subtracts credits, pushes into `ownedShips`, creates `shipLoadouts[shipId]`, updates selection state, may equip the first ship, renders Hangar, and calls `saveGame()`.
- Quality item/core branches subtract credits, add `inventoryItems`, record daily stock, render Store, and call `saveGame()`.

Save paths used by Phase 2:

- `credits`: root number in `player_saves.save_data`.
- `ownedAttachments`: root object in `player_saves.save_data`.
- `ownedAttachments.cargoPod`: standard Cargo Pod ownership count.
- `inventoryItems`: root array, not used for standard Cargo Pod purchase.
- `shipLoadouts`: root object, not changed by standard Cargo Pod purchase.
- `storeDailyPurchases`: local daily stock metadata, intentionally skipped for the Phase 2 prototype.

`cargoPod` is a standard attachment. Local `buyAttachment("cargoPod")` subtracts credits and increments `ownedAttachments.cargoPod`; it does not auto-equip or patch `shipLoadouts`. Duplicate purchases are allowed locally as ownership count increments, so the staging prototype also increments the count by one per allowed purchase.

Sell flow:

- `storeSellSelectedOwned()` routes to `sellOwnedAttachment()` or `sellOwnedGun()`.
- `storeSellSelectedInventory()` calls the local NPC sell path.
- `sellOwnedAttachment()`, `sellOwnedGun()`, and `sellShipToStore()` add credits, remove ownership, render Store, and call `saveGame()`.

Pricing and stock:

- Guns are generated from weapon family data through `createWeaponCatalogDefinition()`.
- Attachments use static prices in `attachments`.
- Store catalogue generation is client-side in `getStoreCatalogItems()`.
- Daily stock is tracked in `storeDailyPurchases`.

## Store Phase 2 Gates

`attachment:cargoPod` can be written only if every gate passes:

- `?mp=staging` room context.
- `STAGING_STORE_WRITE_ENABLED=true`.
- `STAGING_STORE_WRITE_DRY_RUN=false`.
- Verified Supabase identity.
- `STAGING_STORE_WRITE_SCOPE=verified` or `allowlist`.
- If scope is `allowlist`, `STAGING_STORE_WRITE_ALLOWLIST` contains the verified user id.
- `STAGING_STORE_WRITE_ALLOWED_ITEMS` contains `attachment:cargoPod`.
- Quantity is exactly `1`.
- Trusted `player_saves` read succeeds.
- Saved root `credits` is numeric and sufficient.
- Saved root `ownedAttachments.cargoPod` is numeric.
- The patch touches only `credits` and `ownedAttachments.cargoPod`.

Missing env vars mean no write. Default state remains `STAGING_STORE_WRITE_ENABLED=false` and `STAGING_STORE_WRITE_DRY_RUN=true`.

## Current Phase 2 Write Scope

Allowed write when all gates pass:

- `credits -= 220`
- `ownedAttachments.cargoPod += 1`

Forbidden in this phase:

- `inventoryItems`
- `shipLoadouts`
- `ownedShips`
- `ownedGuns`
- non-Cargo Pod attachments
- daily Store stock
- loot, bounties, PvP, player damage, broad progression, schema/RLS changes

## Future Store Phases

Phase 3: ownership/write expansion

- Add additional item types only after each path has its own narrow validator and tests.
- Decide whether daily Store stock should become server-owned or ledger-backed.

Phase 4: store ledger and idempotency

- Prefer a dedicated purchase ledger or transaction/RPC before broadening beyond tiny staging tests.
- Add duplicate protection before any broad purchase rollout.

Phase 5: normalized ownership

- Expand into normalized or ledger-backed equipment/ship ownership.
- Stop relying on full `player_saves.save_data` patches for multiplayer economy writes.

## Still Excluded

- Real CR spend in default staging/dry-run mode.
- Inventory writes.
- Equipment ownership writes except gated `ownedAttachments.cargoPod += 1`.
- Ship ownership writes.
- Loot.
- Bounties.
- PvP.
- Player damage.
- Schema or RLS changes.
- Broad progression.
