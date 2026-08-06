const ITEM_RARITIES = {
  standard: { id: "standard", name: "Standard", statMultiplier: 1.00 },
  refined: { id: "refined", name: "Refined", statMultiplier: 1.08 },
  advanced: { id: "advanced", name: "Advanced", statMultiplier: 1.16 },
  elite: { id: "elite", name: "Elite", statMultiplier: 1.28 },
  legendary: { id: "legendary", name: "Legendary", statMultiplier: 1.42 },
  godlike: { id: "godlike", name: "Godlike", statMultiplier: 1.60 }
};

// Presentation rarity is intentionally separate from stat quality above.
// It follows an item's upgrade level and is shared by every inventory surface.
const ITEM_RARITY_PRESENTATIONS = Object.freeze({
  common: Object.freeze({ key: "common", label: "Common", level: 1, color: "#62ddff", rgb: "98, 221, 255", intensity: 0.2 }),
  refined: Object.freeze({ key: "refined", label: "Refined", level: 2, color: "#76ef68", rgb: "118, 239, 104", intensity: 0.36 }),
  unique: Object.freeze({ key: "unique", label: "Unique", level: 3, color: "#bc72ff", rgb: "188, 114, 255", intensity: 0.54 }),
  elite: Object.freeze({ key: "elite", label: "Elite", level: 4, color: "#ffd45e", rgb: "255, 212, 94", intensity: 0.72 }),
  super: Object.freeze({ key: "super", label: "Super", level: 5, color: "#ff6684", rgb: "255, 102, 132", intensity: 0.9 })
});

const ITEM_RARITY_LEVEL_ORDER = Object.freeze([
  ITEM_RARITY_PRESENTATIONS.common,
  ITEM_RARITY_PRESENTATIONS.refined,
  ITEM_RARITY_PRESENTATIONS.unique,
  ITEM_RARITY_PRESENTATIONS.elite,
  ITEM_RARITY_PRESENTATIONS.super
]);

function getItemRarityPresentation(value = 1) {
  if (typeof value === "string" && ITEM_RARITY_PRESENTATIONS[value]) {
    return ITEM_RARITY_PRESENTATIONS[value];
  }
  const rawLevel = typeof value === "object" && value !== null ? value.level : value;
  const numericLevel = Number(rawLevel);
  const level = Number.isFinite(numericLevel)
    ? Math.max(1, Math.min(ITEM_RARITY_LEVEL_ORDER.length, Math.floor(numericLevel)))
    : 1;
  return ITEM_RARITY_LEVEL_ORDER[level - 1];
}

function getItemRarityKey(value = 1) {
  return getItemRarityPresentation(value).key;
}

function getItemRarityClass(value = 1) {
  return `item-rarity item-rarity-${getItemRarityKey(value)}`;
}

const LEGACY_RARITY_ALIASES = {
  unique: "refined"
};

function normalizeRarityId(rarityId = "standard") {
  const normalized = LEGACY_RARITY_ALIASES[rarityId] || rarityId;
  return ITEM_RARITIES[normalized] ? normalized : "standard";
}
