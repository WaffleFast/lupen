/* Staging-only loot preview table.
   These entries are display-only reward design placeholders. They are not
   inventory items, are not written to player_saves, and do not mutate owned
   guns, attachments, cargo, credits, bounties, route completion, or trade
   totals. */

export const STAGING_LOOT_PREVIEW_ITEMS = Object.freeze([
  Object.freeze({
    lootId: "preview:lupenShard",
    name: "Lupen Shard",
    type: "material",
    rarity: "common",
    quantity: 1,
    description: "A preview-only shard drop for future multiplayer loot.",
    inventoryWritable: false
  }),
  Object.freeze({
    lootId: "preview:weaponParts",
    name: "Weapon Parts",
    type: "material",
    rarity: "common",
    quantity: 2,
    description: "Preview-only parts; no weapon or inventory write occurs.",
    inventoryWritable: false
  }),
  Object.freeze({
    lootId: "preview:techFragments",
    name: "Tech Fragments",
    type: "material",
    rarity: "uncommon",
    quantity: 1,
    description: "Preview-only research salvage for future loot tables.",
    inventoryWritable: false
  }),
  Object.freeze({
    lootId: "preview:pulseLaser",
    name: "Standard Pulse Laser",
    type: "weapon",
    rarity: "rare",
    quantity: 1,
    description: "Preview-only weapon drop; ownedGuns is not changed.",
    inventoryWritable: false
  })
]);

function getStringValue(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function hashString(value = "") {
  return Array.from(getStringValue(value)).reduce((hash, char) => {
    return ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }, 0);
}

export function sanitizeStagingLootPreviewItem(item = {}) {
  return {
    lootId: getStringValue(item.lootId),
    name: getStringValue(item.name, "Preview Loot") || "Preview Loot",
    type: getStringValue(item.type, "material") || "material",
    rarity: getStringValue(item.rarity, "common") || "common",
    quantity: Math.max(1, Math.min(99, Math.round(Number(item.quantity || 1)))),
    description: getStringValue(item.description),
    inventoryWritable: false
  };
}

export function buildStagingLootPreview({
  botId = "",
  rewardPreviewId = "",
  eligibleSessionIds = []
} = {}) {
  const safeEligibleSessionIds = Array.from(new Set((Array.isArray(eligibleSessionIds) ? eligibleSessionIds : [])
    .map((sessionId) => getStringValue(sessionId))
    .filter(Boolean)));
  const seed = Math.abs(hashString(`${botId}:${rewardPreviewId}`));
  const primary = STAGING_LOOT_PREVIEW_ITEMS[0];
  const bonusPool = STAGING_LOOT_PREVIEW_ITEMS.slice(1);
  const bonus = seed % 11 === 0 ? STAGING_LOOT_PREVIEW_ITEMS[3] : bonusPool[seed % bonusPool.length] || null;
  const items = [primary, bonus].filter(Boolean).map(sanitizeStagingLootPreviewItem);

  return {
    available: safeEligibleSessionIds.length > 0,
    mode: "preview_only",
    items,
    eligibleSessionIds: safeEligibleSessionIds,
    inventoryWritten: false,
    ownedGunsWritten: false,
    ownedAttachmentsWritten: false,
    cargoWritten: false,
    creditsWritten: false,
    bountyWritten: false,
    saveWritten: false,
    reason: safeEligibleSessionIds.length ? "contributor_preview_only" : "no_eligible_contributor"
  };
}
