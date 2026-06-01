# Multiplayer Store Write Design

## Purpose

This document tracks the staging path for bringing the Store online without enabling broad real purchases. Phase 1 is preview-only: server-owned Store catalogue, server-side validation, and real Store UI integration in `?mp=staging`. Phase 2 adds heavily gated purchase write prototypes for `attachment:cargoPod` and `gun:pulseLaser` only. Phase 3 adds heavily gated Cargo Pod and Pulse Laser equip/loadout writes.

## Current Phase 1/2

Normal single-player Store behavior remains unchanged.

In `?mp=staging`:

- Real Store purchase and sell mutation paths are fenced before credits, inventory, equipment ownership, ship ownership, daily stock, or saves can change.
- The real Store UI remains the player-facing surface.
- Mapped Store items show `Server Preview`.
- Unmapped Store items show `Server preview unavailable`.
- Colyseus exposes `stagingStore:listItems` and `stagingStore:previewPurchase`.
- Colyseus also exposes `stagingStore:purchase` for `attachment:cargoPod` and `gun:pulseLaser` only.
- Colyseus exposes `stagingLoadout:previewEquip` and `stagingLoadout:equipAttachment` for `attachment:cargoPod` and `gun:pulseLaser` only.
- Preview responses are always `mode:"dry_run"` and `applied:false`.
- Preview responses always report `creditsWritten:false`, `inventoryWritten:false`, `shipWritten:false`, `equipmentWritten:false`, `saveWritten:false`, `lootWritten:false`, and `bountyWritten:false`.
- Purchase responses default to dry-run/blocked unless every Store write gate passes.
- `attachment:shieldBooster` remains preview-only.
- Local loadout mutation paths are fenced in `?mp=staging`; Cargo Pod and Pulse Laser equip route through the server handler.

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
- `ownedGuns`: root object in `player_saves.save_data`.
- `ownedGuns.pulseLaser`: standard Pulse Laser ownership count.
- `inventoryItems`: root array, not used for standard Cargo Pod purchase.
- `shipLoadouts`: root object, not changed by standard Cargo Pod or Pulse Laser purchase.
- `storeDailyPurchases`: local daily stock metadata, intentionally skipped for the Phase 2 prototype.

`cargoPod` is a standard attachment. Local `buyAttachment("cargoPod")` subtracts credits and increments `ownedAttachments.cargoPod`; it does not auto-equip or patch `shipLoadouts`. Duplicate purchases are allowed locally as ownership count increments, so the staging prototype also increments the count by one per allowed purchase.

`pulseLaser` is a standard starter gun. Local `buyGun("pulseLaser")` subtracts credits and increments `ownedGuns.pulseLaser`; it does not auto-equip or patch `shipLoadouts`. Duplicate purchases are allowed locally as ownership count increments, so the staging prototype also increments the count by one per allowed purchase.

Cargo Pod equip flow:

- `equipAttachmentFromInventory("cargoPod", "standard", "owned")` decrements `ownedAttachments.cargoPod`.
- It appends `{ key:"cargoPod", quality:"standard", level:1 }` to `shipLoadouts[selectedHangarShipId].attachments`.
- It calls `applyShipStats(true)` when the selected ship is current.
- It calls `saveGame()`.
- `removeAttachment()` returns standard level-1 attachments to `ownedAttachments`.

Cargo capacity is derived, not stored. `getShipStats()` starts from `SHIPS[currentShipId].cargo`, then adds each equipped attachment effect from `attachments[key].effect`. Standard level-1 Cargo Pod adds `25` cargo. Multiple Cargo Pods stack, bounded by the current ship's attachment slots.

Pulse Laser equip flow:

- `equipGunFromInventory("pulseLaser", "standard", "owned")` decrements `ownedGuns.pulseLaser`.
- It appends `{ key:"pulseLaser", quality:"standard", level:1 }` to `shipLoadouts[selectedHangarShipId].guns`.
- It clears the active engage timer when the selected ship is current.
- It calls `saveGame()`.
- `removeGun()` returns standard level-1 guns to `ownedGuns`.

Staging combat still uses a safe client-sent equipped weapon intent for damage display. The Pulse Laser loadout write prepares server-owned weapon state, but server-authoritative combat stat derivation from saved loadouts is still a later phase.

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

`attachment:cargoPod` or `gun:pulseLaser` can be written only if every gate passes:

- `?mp=staging` room context.
- `STAGING_STORE_WRITE_ENABLED=true`.
- `STAGING_STORE_WRITE_DRY_RUN=false`.
- Verified Supabase identity.
- `STAGING_STORE_WRITE_SCOPE=verified` or `allowlist`.
- If scope is `allowlist`, `STAGING_STORE_WRITE_ALLOWLIST` contains the verified user id.
- `STAGING_STORE_WRITE_ALLOWED_ITEMS` contains the exact item id, e.g. `attachment:cargoPod` or `gun:pulseLaser`.
- Quantity is exactly `1`.
- Trusted `player_saves` read succeeds.
- Saved root `credits` is numeric and sufficient.
- For Cargo Pod, saved root `ownedAttachments.cargoPod` is numeric.
- For Pulse Laser, saved root `ownedGuns.pulseLaser` is numeric.
- The patch touches only `credits` and the matching ownership count.

Missing env vars mean no write. Default state remains `STAGING_STORE_WRITE_ENABLED=false` and `STAGING_STORE_WRITE_DRY_RUN=true`.

## Current Phase 2 Write Scope

Allowed writes when all gates pass:

- `credits -= 220`
- `ownedAttachments.cargoPod += 1`
- `credits -= 748`
- `ownedGuns.pulseLaser += 1`

Forbidden in this phase:

- `inventoryItems`
- `shipLoadouts`
- `ownedShips`
- `ownedGuns` except gated `ownedGuns.pulseLaser += 1`
- non-Cargo Pod attachments
- non-Pulse Laser weapons
- daily Store stock
- loot, bounties, PvP, player damage, broad progression, schema/RLS changes

## Store Phase 3 Equip Gates

Cargo Pod or Pulse Laser equip can be written only if every gate passes:

- `?mp=staging` room context.
- `STAGING_LOADOUT_WRITE_ENABLED=true`.
- `STAGING_LOADOUT_WRITE_DRY_RUN=false`.
- Verified Supabase identity.
- `STAGING_LOADOUT_WRITE_SCOPE=verified` or `allowlist`.
- If scope is `allowlist`, `STAGING_LOADOUT_WRITE_ALLOWLIST` contains the verified user id.
- `STAGING_LOADOUT_WRITE_ALLOWED_ITEMS` contains the exact item id, e.g. `attachment:cargoPod` or `gun:pulseLaser`.
- Trusted `player_saves` read succeeds.
- Saved `currentShipId` is one of the known staging ship ids.
- For Cargo Pod, saved root `ownedAttachments.cargoPod` is numeric and greater than zero.
- For Pulse Laser, saved root `ownedGuns.pulseLaser` is numeric and greater than zero.
- Saved root `shipLoadouts[currentShipId].attachments` and `.guns` are valid arrays.
- Cargo Pod requires an empty attachment slot.
- Pulse Laser requires an empty gun slot.
- The patch touches only the matching ownership count and matching current-ship loadout array.

Missing env vars mean no equip write. Default state remains `STAGING_LOADOUT_WRITE_ENABLED=false` and `STAGING_LOADOUT_WRITE_DRY_RUN=true`.

Allowed equip write when all gates pass:

- `ownedAttachments.cargoPod -= 1`
- `shipLoadouts[currentShipId].attachments.push({ key:"cargoPod", quality:"standard", level:1 })`
- `ownedGuns.pulseLaser -= 1`
- `shipLoadouts[currentShipId].guns.push({ key:"pulseLaser", quality:"standard", level:1 })`

The server derives cargo capacity from a narrow mirrored ship config plus `Cargo Pod +25`. It does not trust a client-provided cargo capacity for real equip writes.

## Cargo Pod Loop Validation

The current validated staging loop is:

1. Earn or hold enough server-validated CR.
2. Buy one Cargo Pod through `stagingStore:purchase`.
3. Refresh from Supabase after applied purchase.
4. Equip the Cargo Pod through `stagingLoadout:equipAttachment`.
5. Refresh from Supabase after applied equip.
6. Use the returned +25 cargo capacity in later staging trade validation.

Regression coverage uses mocked `player_saves` to prove the sequence can buy Cargo Pod, equip it, trade with the increased capacity, sell the cargo, and preserve unrelated save fields. It also covers Pulse Laser purchase/equip with mocked `player_saves`, including ownership count changes, gun slot validation, and unrelated-field preservation. Live-write browser testing remains manual, allowlisted, and opt-in only.

## Future Store Phases

Phase 4: ownership/write expansion

- Add additional item types only after each path has its own narrow validator and tests.
- Decide whether daily Store stock should become server-owned or ledger-backed.

Phase 5: store ledger and idempotency

- Prefer a dedicated purchase ledger or transaction/RPC before broadening beyond tiny staging tests.
- Add duplicate protection before any broad purchase rollout.

Phase 6: normalized ownership

- Expand into normalized or ledger-backed equipment/ship ownership.
- Stop relying on full `player_saves.save_data` patches for multiplayer economy writes.

## Still Excluded

- Real CR spend in default staging/dry-run mode.
- Inventory writes.
- Equipment ownership/loadout writes except gated `ownedAttachments.cargoPod += 1`, gated `ownedGuns.pulseLaser += 1`, gated Cargo Pod equip into `shipLoadouts[currentShipId].attachments`, and gated Pulse Laser equip into `shipLoadouts[currentShipId].guns`.
- Ship ownership writes.
- Loot.
- Bounties.
- PvP.
- Player damage.
- Schema or RLS changes.
- Broad progression.
