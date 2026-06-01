# Multiplayer Staging Loot Preview Design

This document tracks the `?mp=staging` loot preview layer for server-owned staging bot destruction. It does not change normal single-player loot, inventory, Store, bounty, trade, or save behavior.

## Current Scope

When a server-owned staging bot is disabled, Colyseus builds a loot contract and attaches it to the existing `staging:reward_preview` event.

Current preview items are display-only examples:

- `Lupen Shard`
- `Weapon Parts`
- `Tech Fragments`
- rare preview-only `Standard Pulse Laser`

Each item includes `lootId`, `name`, `type`, `rarity`, `quantity`, `description`, and `inventoryWritable:false`.

## Phase 2 Lupen Shard Claim

The first real material write path is implemented but disabled by default. It supports only one item:

- `preview:lupenShard` / `lupenShard`

The write target is:

- `player_saves.save_data.upgradeMaterials.lupenShards`

This is intentionally not `inventoryItems`. Local audit found that Lupen Shards are stored as stackable upgrade materials in `upgradeMaterials`, while `inventoryItems` is reserved for equipment-style objects such as Lupen Cores.

The server message is:

- `stagingLoot:claim`

The client method is:

- `LupenMultiplayerClient.claimStagingLoot()`

The response reports material before/after values and all write flags. Forbidden surfaces remain false:

- `inventoryWritten:false`
- `ownedGunsWritten:false`
- `ownedAttachmentsWritten:false`
- `cargoWritten:false`
- `creditsWritten:false`
- `bountyWritten:false`

## Write Gates

The Lupen Shard material write can only be attempted when all gates pass:

- Staging reward preview exists for the disabled server-owned bot.
- Player contributed to the bot disable event or is otherwise eligible in the preview.
- Player identity is verified.
- Stable idempotency key exists.
- Duplicate claim has not been seen in the room.
- Loot item is exactly `lupenShard`.
- Quantity is clamped to `1`.
- `STAGING_LOOT_WRITE_ENABLED=true`.
- `STAGING_LOOT_WRITE_DRY_RUN=false`.
- `STAGING_LOOT_WRITE_SCOPE=verified` or the verified player id is in `STAGING_LOOT_WRITE_ALLOWLIST`.
- Supabase service role config is present.
- Current save has a numeric `upgradeMaterials.lupenShards` path.

Default environment behavior is no-write:

- `STAGING_LOOT_WRITE_ENABLED` defaults off.
- `STAGING_LOOT_WRITE_DRY_RUN` defaults on.
- Missing allow-list blocks writes unless scope is explicitly `verified`.

If any gate fails, the server returns `applied:false` and does not read or patch `player_saves` unless the write gates require it.

## Contribution Rule

Loot preview visibility follows the same eligibility rule as the XP reward preview: players who contributed damage to the disabled server-owned staging bot are eligible to see the preview. The event includes contributor session ids so the client can show the compact loot preview only to eligible local players.

## Safety Boundaries

The loot preview and Lupen Shard material claim do not write or mutate:

- `inventoryItems`
- `ownedGuns`
- `ownedAttachments`
- cargo
- credits
- local bounty state
- route completion
- trade totals
- PvP/player damage
- Supabase schema/RLS
- XP/combat progression

The preview remains separate from local single-player loot helpers such as `generateBotLootItems()` and `addInventoryItems()`.

## Client UX

The MP staging combat panel shows compact copy after a disabled staging bot:

- `Loot preview`
- `Would drop: 1x Lupen Shard`
- `Preview only - inventory not changed.`
- `Claim Shard`
- `Lupen Shard dry-run only...`
- `Lupen Shard claimed: before -> after` when the gated material write is explicitly enabled and succeeds.

Detailed raw diagnostics remain behind `?debug=mp`.

## Future Path

Recommended order:

1. Keep loot preview only.
2. Add a gated material write for one material only. Implemented for `upgradeMaterials.lupenShards`, disabled by default.
3. Expand to a broader server-owned loot table.
4. Move toward a normalized inventory ledger/table before broad item rewards.

Do not enable real loot, inventory, credits, or bounty persistence until dedicated idempotency, auditability, and server-side validators exist.
