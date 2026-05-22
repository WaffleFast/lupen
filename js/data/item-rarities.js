const ITEM_RARITIES = {
  standard: { id: "standard", name: "Standard", statMultiplier: 1.00 },
  refined: { id: "refined", name: "Refined", statMultiplier: 1.08 },
  advanced: { id: "advanced", name: "Advanced", statMultiplier: 1.16 },
  elite: { id: "elite", name: "Elite", statMultiplier: 1.28 },
  legendary: { id: "legendary", name: "Legendary", statMultiplier: 1.42 },
  godlike: { id: "godlike", name: "Godlike", statMultiplier: 1.60 }
};

const LEGACY_RARITY_ALIASES = {
  unique: "refined"
};

function normalizeRarityId(rarityId = "standard") {
  const normalized = LEGACY_RARITY_ALIASES[rarityId] || rarityId;
  return ITEM_RARITIES[normalized] ? normalized : "standard";
}
