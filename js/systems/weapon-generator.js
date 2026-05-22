function getWeaponFamily(familyId) {
  const resolvedId = LEGACY_WEAPON_FAMILY_ALIASES?.[familyId] || familyId;
  return WEAPON_FAMILIES?.[resolvedId] || null;
}

function createWeaponItem(familyId, rarityId = "standard") {
  const family = getWeaponFamily(familyId);
  if (!family) return null;

  const normalizedRarity = typeof normalizeRarityId === "function" ? normalizeRarityId(rarityId) : "standard";
  const rarity = ITEM_RARITIES[normalizedRarity] || ITEM_RARITIES.standard;
  const multiplier = Number(rarity.statMultiplier || 1);
  const rarityPrefix = normalizedRarity === "standard" ? "" : `${rarity.name} `;
  const scale = value => Math.max(1, Math.round(Number(value || 0) * multiplier));

  return {
    uid: `weapon-${family.id}-${normalizedRarity}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    itemType: "weapon",
    familyId: family.id,
    rarityId: normalizedRarity,
    key: family.id,
    quality: normalizedRarity,
    name: `${rarityPrefix}${family.name}`,
    shortDescription: family.shortDescription,
    image: family.image,
    projectileColor: family.projectileColor,
    fireStyle: family.fireStyle,
    fireRate: family.fireRate,
    range: scale(family.range),
    accuracy: family.accuracy,
    damage: {
      shield: scale(family.damage.shield),
      armor: scale(family.damage.armor),
      hull: scale(family.damage.hull)
    }
  };
}

function createWeaponCatalogDefinition(familyId) {
  const family = getWeaponFamily(familyId);
  if (!family) return null;

  const averageDamage = Math.round((family.damage.shield + family.damage.armor + family.damage.hull) / 3);
  const cycleMs = Math.max(250, Math.round(1000 / Math.max(0.1, family.fireRate)));

  return {
    key: family.id,
    familyId: family.id,
    name: family.name,
    image: family.image,
    description: family.shortDescription,
    shortDescription: family.shortDescription,
    role: family.role,
    price: Math.max(300, Math.round(averageDamage * 42 + family.range * 0.18 + family.accuracy * 2)),
    damage: { ...family.damage },
    projectileColor: family.projectileColor,
    fireStyle: family.fireStyle,
    fireRate: family.fireRate,
    range: family.range,
    accuracy: family.accuracy,
    speed: cycleMs,
    legacyDamage: averageDamage
  };
}
