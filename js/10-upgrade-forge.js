/* Forge */

const FORGE_MODE_LABELS = {
  level: "Level Upgrade",
  quality: "Quality Upgrade"
};

const FORGE_LEVEL_XP_REQUIREMENTS = [0, 0, 1000, 2500, 5000];
const FORGE_LEVEL_ROMAN = ["", "I", "II", "III", "IV", "V"];
const FORGE_QUALITY_ORDER = ITEM_QUALITY_ORDER;
const FORGE_MAX_LEVEL = MAX_ITEM_LEVEL;
const FORGE_LEVEL_COSTS = Object.freeze({
  1: 25,
  2: 75,
  3: 150,
  4: 300
});
const FORGE_LEVEL_TIERS = Object.freeze({
  1: Object.freeze({ key: "common", label: "Common", color: "#62ddff" }),
  2: Object.freeze({ key: "refined", label: "Refined", color: "#76ef68" }),
  3: Object.freeze({ key: "unique", label: "Unique", color: "#bc72ff" }),
  4: Object.freeze({ key: "elite", label: "Elite", color: "#ffd45e" }),
  5: Object.freeze({ key: "super", label: "Super", color: "#ff6684" })
});

function getForgeItemLevelRoman(level) {
  const safeLevel = Math.min(MAX_ITEM_LEVEL, Math.max(1, Math.floor(Number(level || 1))));
  return FORGE_LEVEL_ROMAN[safeLevel] || String(safeLevel);
}

function getForgeLevelTier(level) {
  const safeLevel = Math.min(FORGE_MAX_LEVEL, Math.max(1, Math.floor(Number(level || 1))));
  return FORGE_LEVEL_TIERS[safeLevel] || FORGE_LEVEL_TIERS[1];
}

function getForgeTierClass(level) {
  return `forge-tier-${getForgeLevelTier(level).key}`;
}

function renderForgeTierPips(level, className = "") {
  const safeLevel = Math.min(FORGE_MAX_LEVEL, Math.max(1, Math.floor(Number(level || 1))));
  const tier = getForgeLevelTier(safeLevel);
  const pips = Array.from({ length: safeLevel }, () => "<i></i>").join("");
  return `<span class="forge-tier-pips ${className}" role="img" aria-label="${escapeHtml(tier.label)} tier, Level ${escapeHtml(getForgeItemLevelRoman(safeLevel))}">${pips}</span>`;
}

function renderForgeTierLegend() {
  return Object.keys(FORGE_LEVEL_TIERS).map(level => {
    const tier = getForgeLevelTier(level);
    return `<span class="forge-tier-legend-item forge-tier-scope ${getForgeTierClass(level)}">${renderForgeTierPips(level)}<strong>${escapeHtml(tier.label)}</strong></span>`;
  }).join("");
}

function getForgeTotalPilotXp() {
  return Math.max(0, Math.floor(Number(playerProgress?.combatXp || 0)));
}

function getForgeLevelXpRequirement(level) {
  const safeLevel = Math.min(MAX_ITEM_LEVEL, Math.max(1, Math.floor(Number(level || 1))));
  return Number(FORGE_LEVEL_XP_REQUIREMENTS[safeLevel - 1] || 0);
}

function getForgeQualityColor(quality = "standard") {
  return {
    standard: "#7fd6ff",
    refined: "#34e59a",
    advanced: "#b56cff",
    elite: "#ffd65c",
    legendary: "#ff8a47",
    godlike: "#ff5454",
    core: "#cda4ff"
  }[quality] || "#7fd6ff";
}

function getLupenShardCount() {
  upgradeMaterials = normalizeUpgradeMaterials(upgradeMaterials);
  return Math.max(0, Math.floor(Number(upgradeMaterials.lupenShards || 0)));
}

function spendLupenShards(quantity = 0) {
  upgradeMaterials = normalizeUpgradeMaterials(upgradeMaterials);
  const spend = Math.max(0, Math.floor(Number(quantity || 0)));
  if (spend <= 0) return true;
  if (getLupenShardCount() < spend) return false;
  upgradeMaterials.lupenShards = Math.max(0, getLupenShardCount() - spend);
  return true;
}

function getForgeItemDefinition(key) {
  if (GUNS[key]) {
    return {
      kind: "weapon",
      typeLabel: "Weapon",
      key,
      name: GUNS[key].name,
      description: GUNS[key].description || GUNS[key].shortDescription || "Weapon system.",
      image: GUNS[key].image || itemDefinitions[key]?.icon
    };
  }

  if (attachments[key]) {
    return {
      kind: "attachment",
      typeLabel: "Equipment",
      key,
      name: attachments[key].name,
      description: attachments[key].description || "Ship equipment module.",
      image: attachments[key].image || itemDefinitions[key]?.icon
    };
  }

  return null;
}

function getForgeItemDisplayName(item) {
  const definition = getForgeItemDefinition(item?.key);
  if (!definition) return "Unknown Item";
  return `${definition.name} ${getForgeItemLevelRoman(getForgeItemLevel(item || {}))}`;
}

function getForgeItemLevel(item) {
  return Math.min(FORGE_MAX_LEVEL, Math.max(1, Math.floor(Number(item?.level || 1))));
}

function getForgeStatKey(label = "") {
  return String(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "attribute";
}

function getForgePlayerLevelCap() {
  const totalXp = getForgeTotalPilotXp();
  let cap = 1;
  for (let level = 1; level <= MAX_ITEM_LEVEL; level += 1) {
    if (totalXp >= getForgeLevelXpRequirement(level)) cap = level;
  }
  return cap;
}

function getForgeItemStatRows(item, quality = item?.quality || "standard", level = getForgeItemLevel(item || {})) {
  if (!item) return [];
  if (item.categoryKey === "guns" && GUNS[item.key]) {
    const base = getGunDamageForQuality(GUNS[item.key], quality);
    const levelBonus = Math.max(0, Math.min(FORGE_MAX_LEVEL, Math.floor(Number(level || 1))) - 1);
    const damage = Math.max(1, Math.round(Math.max(base.shield || 0, base.armor || 0, base.hull || 0))) + levelBonus;
    const fireRate = getGunFireRateValue(GUNS[item.key]) + (level >= 3 ? 0.1 : 0);
    return [
      { label: "Damage", value: formatNumber(damage) },
      { label: "Fire Rate", value: `${fireRate.toFixed(1)}/s` }
    ];
  }

  if (item.categoryKey === "attachments" && attachments[item.key]) {
    const effect = getScaledAttachmentEffect(item.key, quality, level);
    const rows = Object.entries(effect)
      .filter(([, value]) => Number(value || 0) > 0)
      .map(([key, value]) => ({
        label: key === "jumpRecharge" ? "Jump" : key === "evasion" ? "Evasion" : key.charAt(0).toUpperCase() + key.slice(1),
        value: `+${formatNumber(value)}${key === "evasion" ? "%" : ""}`
      }));
    return rows.length ? rows : [{ label: "Effect", value: getStoreAttachmentEffectText({ key: item.key }, quality) }];
  }

  return [];
}

function getVisibleItemStats(item, quality = item?.quality || "standard", level = getForgeItemLevel(item || {})) {
  return getForgeItemStatRows(item, quality, level).slice(0, item?.categoryKey === "guns" ? 2 : 3);
}

function getForgeUpgradeableItems() {
  const items = [];

  Object.entries(ownedGuns || {}).forEach(([key, count]) => {
    if (count > 0 && GUNS[key] && !GUNS[key].hiddenFromStore) {
      items.push({ id: `owned:guns:${key}`, source: "owned", categoryKey: "guns", key, quality: "standard", level: 1, count });
    }
  });

  Object.entries(ownedAttachments || {}).forEach(([key, count]) => {
    if (count > 0 && attachments[key]) {
      items.push({ id: `owned:attachments:${key}`, source: "owned", categoryKey: "attachments", key, quality: "standard", level: 1, count });
    }
  });

  (inventoryItems || []).forEach(item => {
    const categoryKey = getItemCategoryKey(item.key);
    if (!["guns", "attachments"].includes(categoryKey)) return;
    items.push({
      id: `inventory:${item.id}`,
      source: "inventory",
      categoryKey,
      inventoryId: item.id,
      key: item.key,
      quality: item.quality || "standard",
      level: getForgeItemLevel(item),
      count: 1
    });
  });

  Object.entries(shipLoadouts || {}).forEach(([shipId, loadout]) => {
    (loadout?.guns || []).forEach((entry, index) => {
      const key = getEquipmentKey(entry);
      if (!GUNS[key]) return;
      items.push({
        id: `equipped:${shipId}:guns:${index}`,
        source: "equipped",
        categoryKey: "guns",
        shipId,
        loadoutKind: "guns",
        index,
        key,
        quality: getEquipmentQuality(entry),
        level: getEquipmentLevel(entry),
        count: 1
      });
    });

    (loadout?.attachments || []).forEach((entry, index) => {
      const key = getEquipmentKey(entry);
      if (!attachments[key]) return;
      items.push({
        id: `equipped:${shipId}:attachments:${index}`,
        source: "equipped",
        categoryKey: "attachments",
        shipId,
        loadoutKind: "attachments",
        index,
        key,
        quality: getEquipmentQuality(entry),
        level: getEquipmentLevel(entry),
        count: 1
      });
    });
  });

  return items.sort((a, b) => {
    const qualityDelta = ITEM_QUALITY_ORDER.indexOf(b.quality) - ITEM_QUALITY_ORDER.indexOf(a.quality);
    if (qualityDelta !== 0) return qualityDelta;
    return getForgeItemDisplayName(a).localeCompare(getForgeItemDisplayName(b));
  });
}

function getForgeSelectedItem() {
  const items = getForgeUpgradeableItems();
  if (!items.length) return null;
  if (!selectedForgeItemId || !items.some(item => item.id === selectedForgeItemId)) {
    selectedForgeItemId = items[0].id;
  }
  return items.find(item => item.id === selectedForgeItemId) || items[0];
}

function getForgeItemIdFromVaultGroup(groupKey) {
  const entry = getSelectedVaultEntry?.() || buildVaultEntries().find(item => item.groupKey === groupKey);
  if (!entry || !["guns", "attachments"].includes(entry.categoryKey)) return null;
  const match = getForgeUpgradeableItems().find(item => item.key === entry.key && item.quality === entry.quality);
  return match?.id || null;
}

function isTutorialForgeStepActive() {
  if (!tutorialState?.active || typeof getCurrentTutorialStep !== "function") return false;
  return ["open-forge", "forge-upgrade-weapon"].includes(getCurrentTutorialStep()?.id);
}

function hasTutorialPulseLaserQualityUpgrade() {
  return getForgeUpgradeableItems().some(item =>
    item.key === "pulseLaser" &&
    item.categoryKey === "guns" &&
    item.quality &&
    item.quality !== "standard"
  );
}

function hasTutorialPulseLaserLevelUpgrade() {
  return getForgeUpgradeableItems().some(item =>
    item.key === "pulseLaser" &&
    item.categoryKey === "guns" &&
    getForgeItemLevel(item) > 1
  );
}

function getTutorialPulseLaserForgeItemId() {
  const items = getForgeUpgradeableItems().filter(item => item.key === "pulseLaser" && item.categoryKey === "guns");
  if (!items.length) return null;
  const currentEquipped = items.find(item => item.source === "equipped" && item.shipId === currentShipId && item.quality === "standard");
  const anyEquipped = items.find(item => item.source === "equipped" && item.quality === "standard");
  const inventory = items.find(item => item.source === "inventory" && item.quality === "standard");
  const owned = items.find(item => item.source === "owned" && item.quality === "standard");
  return (currentEquipped || anyEquipped || inventory || owned || items[0])?.id || null;
}

function prepareTutorialForgeSelection() {
  if (!isTutorialForgeStepActive()) return;
  forgeUpgradeMode = "level";
  const pulseLaserItemId = getTutorialPulseLaserForgeItemId();
  if (pulseLaserItemId) selectedForgeItemId = pulseLaserItemId;
}

function reconcileTutorialForgeStarterShards() {
  if (!isTutorialForgeStepActive() || tutorialState?.forgeStarterShardsReconciled) return false;

  const item = getForgeSelectedItem();
  if (!item || item.key !== "pulseLaser" || item.categoryKey !== "guns") return false;

  tutorialState.forgeStarterShardsReconciled = true;
  if (typeof saveTutorialState === "function") saveTutorialState();

  if (getForgeItemLevel(item) > 1) return false;
  const requiredShards = getForgeLevelShardCost(1);
  const currentShards = getLupenShardCount();
  const restoredShards = Math.max(0, requiredShards - currentShards);
  if (!restoredShards) return false;

  upgradeMaterials.lupenShards = requiredShards;
  if (typeof addActivityLog === "function") {
    addActivityLog(`Academy bounty payout restored: +${formatNumber(restoredShards)} Lupen Shards.`);
  }
  if (typeof addHudToast === "function") {
    addHudToast(`Academy bounty payout restored: +${formatNumber(restoredShards)} Lupen Shards. Forge upgrade ready.`);
  }
  if (typeof saveGame === "function") saveGame();
  return true;
}

function setForgeMode(mode) {
  if (forgeAnimating) return;
  forgeUpgradeMode = "level";
  renderUpgradeForge();
}

function selectForgeItem(itemId) {
  if (forgeAnimating) return;
  selectedForgeItemId = itemId;
  forgeInventoryPickerOpen = false;
  renderUpgradeForge();
}

function updateForgeScrollIndicator() {
  const panel = document.getElementById("forgeSelectedPanel");
  const track = document.getElementById("forgeScrollTrack");
  const thumb = document.getElementById("forgeScrollThumb");
  if (!panel || !track || !thumb) return;

  const maxScroll = Math.max(0, panel.scrollHeight - panel.clientHeight);
  const trackHeight = Math.max(0, track.clientHeight);
  const thumbHeight = maxScroll > 0
    ? Math.max(38, Math.round(trackHeight * (panel.clientHeight / panel.scrollHeight)))
    : trackHeight;
  const thumbTravel = Math.max(0, trackHeight - thumbHeight);
  const thumbOffset = maxScroll > 0 ? Math.round((panel.scrollTop / maxScroll) * thumbTravel) : 0;

  thumb.style.height = `${thumbHeight}px`;
  thumb.style.transform = `translateY(${thumbOffset}px)`;
  track.disabled = maxScroll <= 0;
  document.getElementById("forgeScrollUpBtn")?.toggleAttribute("disabled", panel.scrollTop <= 0);
  document.getElementById("forgeScrollDownBtn")?.toggleAttribute("disabled", panel.scrollTop >= maxScroll - 1);
}

function scrollForgeInventory(direction = 1) {
  const panel = document.getElementById("forgeSelectedPanel");
  if (!panel) return;
  panel.scrollBy({
    top: Math.sign(Number(direction) || 1) * Math.max(96, Math.round(panel.clientHeight * 0.72)),
    behavior: "smooth"
  });
}

function setForgeInventoryScrollFromTrack(event) {
  const panel = document.getElementById("forgeSelectedPanel");
  const track = document.getElementById("forgeScrollTrack");
  if (!panel || !track || track.disabled) return;
  const bounds = track.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (event.clientY - bounds.top) / Math.max(1, bounds.height)));
  panel.scrollTo({ top: ratio * Math.max(0, panel.scrollHeight - panel.clientHeight), behavior: "smooth" });
}

function openForgeInventoryPicker() {
  forgeInventoryPickerOpen = true;
  renderUpgradeForge();
}

function closeForgeInventoryPicker() {
  forgeInventoryPickerOpen = false;
  renderUpgradeForge();
}

function setForgeInventoryPickerFilter(filter = "all") {
  forgeInventoryPickerFilter = ["all", "weapons", "equipment", "equipped", "vault"].includes(filter) ? filter : "all";
  renderUpgradeForge();
}

function startForgeDrag(event, type, value) {
  if (!event?.dataTransfer) return;
  event.dataTransfer.setData("text/plain", `${type}:${value}`);
  event.dataTransfer.effectAllowed = "move";
}

function handleForgeDrop(event, slot) {
  event.preventDefault();
  if (forgeAnimating) return;
  const payload = event.dataTransfer?.getData("text/plain") || "";
  const separator = payload.indexOf(":");
  const type = separator >= 0 ? payload.slice(0, separator) : "";
  const value = separator >= 0 ? payload.slice(separator + 1) : "";
  if (slot === "item" && type === "item" && value) selectForgeItem(value);
}

function getForgePickerItems(items) {
  if (forgeInventoryPickerFilter === "weapons") return items.filter(item => item.categoryKey === "guns");
  if (forgeInventoryPickerFilter === "equipment") return items.filter(item => item.categoryKey === "attachments");
  if (forgeInventoryPickerFilter === "equipped") return items.filter(item => item.source === "equipped");
  if (forgeInventoryPickerFilter === "vault") return items.filter(item => item.source !== "equipped");
  return items;
}

function getForgeNextQuality(quality) {
  const current = typeof normalizeRarityId === "function" ? normalizeRarityId(quality) : String(quality || "standard").toLowerCase();
  const index = FORGE_QUALITY_ORDER.indexOf(current);
  if (index === -1 || index >= FORGE_QUALITY_ORDER.length - 1) return null;
  return FORGE_QUALITY_ORDER[index + 1];
}

function getForgeLevelShardCost(level) {
  const safeLevel = Math.max(1, Math.min(FORGE_MAX_LEVEL - 1, Math.floor(Number(level || 1))));
  return FORGE_LEVEL_COSTS[safeLevel] || FORGE_LEVEL_COSTS[FORGE_MAX_LEVEL - 1];
}

function getForgeQualityCoreCost(nextQuality) {
  return Math.max(1, ITEM_QUALITY_ORDER.indexOf(nextQuality));
}

function getForgeRequirement(item, mode = forgeUpgradeMode) {
  if (!item) return null;
  const level = getForgeItemLevel(item);

  return {
    materialKey: "lupenShards",
    materialName: "Lupen Shards",
    shortName: "Shards",
    resourceIcon: "assets/items/lupen-shard.png",
    required: level >= FORGE_MAX_LEVEL ? 0 : getForgeLevelShardCost(level)
  };
}

function getForgeMaterialOwned(materialKey) {
  if (materialKey === "lupenShards") return getLupenShardCount();
  return 0;
}

function getForgeUpgradePreview(item, mode = forgeUpgradeMode) {
  if (!item) return null;
  const currentLevel = getForgeItemLevel(item);
  const currentQuality = item.quality || "standard";
  const targetLevel = Math.min(FORGE_MAX_LEVEL, currentLevel + 1);
  const targetQuality = currentQuality;

  return {
    mode,
    fromLevel: currentLevel,
    toLevel: targetLevel,
    fromQuality: currentQuality,
    toQuality: targetQuality,
    currentName: getForgeItemDisplayName(item),
    nextName: getForgeItemDisplayName({ ...item, quality: targetQuality, level: targetLevel }),
    currentStats: getVisibleItemStats(item, currentQuality, currentLevel),
    nextStats: getVisibleItemStats(item, targetQuality, targetLevel)
  };
}

function getForgePrimaryStatChange(preview) {
  const current = preview?.currentStats?.[0];
  const next = preview?.nextStats?.find(row => row.label === current?.label) || preview?.nextStats?.[0];
  if (!current || !next) return "";
  return `${current.label} ${current.value} -> ${next.value}`;
}

function getForgeOutcomeLabel(preview, mode = forgeUpgradeMode) {
  if (!preview) return "--";
  return `Level ${getForgeItemLevelRoman(preview.fromLevel)} -> Level ${getForgeItemLevelRoman(preview.toLevel)}`;
}

function getForgeRequirementLabel(requirement) {
  if (!requirement) return "--";
  const required = Math.max(0, Number(requirement.required || 0));
  const materialName = required === 1
    ? String(requirement.materialName || "").replace(/s$/, "")
    : requirement.materialName;
  return `${formatNumber(required)} ${materialName}`;
}

function getForgeState(item, mode = forgeUpgradeMode) {
  const requirement = getForgeRequirement(item, mode);
  const preview = getForgeUpgradePreview(item, mode);

  if (!item) {
    return {
      canUpgrade: false,
      reason: "Select an item to upgrade.",
      buttonText: "Select Item",
      requirement,
      preview,
      owned: 0,
      missing: 0,
      successChance: 0
    };
  }

  const level = getForgeItemLevel(item);
  const targetLevel = Math.min(FORGE_MAX_LEVEL, level + 1);
  if (level >= FORGE_MAX_LEVEL) {
    return {
      canUpgrade: false,
      reason: "Maximum Forge level reached.",
      buttonText: "Maximum Level",
      requirement,
      preview,
      targetLevel: level,
      targetQuality: item.quality,
      owned: 0,
      missing: 0,
      successChance: 0
    };
  }

  const owned = getForgeMaterialOwned(requirement.materialKey);
  const missing = Math.max(0, Number(requirement.required || 0) - owned);
  if (missing > 0) {
    return {
      canUpgrade: false,
      reason: "Not enough Lupen Shards.",
      buttonText: `Need ${formatNumber(missing)} More ${requirement.shortName}`,
      requirement,
      preview,
      targetLevel,
      targetQuality: item.quality,
      owned,
      missing,
      successChance: 0
    };
  }

  return {
    canUpgrade: true,
    reason: "Ready to upgrade.",
    buttonText: `Upgrade to ${getForgeLevelTier(targetLevel).label} · Level ${getForgeItemLevelRoman(targetLevel)}`,
    requirement,
    preview,
    targetLevel,
    targetQuality: item.quality,
    owned,
    missing: 0,
    successChance: 100
  };
}

function getForgeRequirements(item, mode = forgeUpgradeMode) {
  const state = getForgeState(item, mode);
  const requirement = state.requirement;
  return {
    ...state,
    resourceKey: requirement?.materialKey,
    resourceName: requirement?.materialName,
    resourceIcon: requirement?.resourceIcon,
    resourceOwned: state.owned,
    resourceRequired: requirement?.required || 0,
    costLabel: requirement ? `${formatNumber(requirement.required)} ${requirement.shortName}` : "--"
  };
}

function getForgeSuccessChance(item, requirements) {
  return item && requirements?.canUpgrade ? 100 : 0;
}

function getForgeAllocated() {
  return 0;
}

function setForgeMaterial() {
  renderUpgradeForge();
}

function adjustForgeMaterial() {
  renderUpgradeForge();
}

function loadForgeMaterial() {
  renderUpgradeForge();
}

function autoFillForgeMaterials() {
  renderUpgradeForge();
}

function toggleForgeCore() {
  renderUpgradeForge();
}

function getForgeMissingRequirements(item, requirements) {
  const missing = [];
  if (!item || !requirements) return missing;
  if (Number(requirements.missing || 0) > 0 && requirements.requirement?.materialName) return [requirements.requirement.materialName];
  if (Number(requirements.missing || 0) > 0 && requirements.resourceName) return [requirements.resourceName];
  if (!requirements.canUpgrade) return missing;
  const required = Math.max(0, Number(requirements.resourceRequired || 0));
  if (requirements.resourceKey === "lupenShards" && getLupenShardCount() < required) missing.push("Lupen Shards");
  return missing;
}

function previewForgeUpgrade() {
  const item = getForgeSelectedItem();
  const requirements = getForgeRequirements(item);
  const status = document.getElementById("forgeChamberStatus");
  if (!status) return;
  if (!requirements.canUpgrade) {
    status.textContent = requirements.reason || "Cannot upgrade";
    return;
  }
  const missing = getForgeMissingRequirements(item, requirements);
  status.textContent = missing.length ? `Missing ${missing.join(", ")}` : `${FORGE_MODE_LABELS[forgeUpgradeMode]} ready`;
}

function applyForgeUpgrade(item, requirements) {
  const shardCost = Math.max(0, Math.floor(Number(requirements.resourceRequired || getForgeLevelShardCost(getForgeItemLevel(item)))));
  upgradeMaterials = normalizeUpgradeMaterials(upgradeMaterials);
  const ownedShards = Math.max(0, Math.floor(Number(upgradeMaterials.lupenShards || 0)));
  if (ownedShards < shardCost) return false;
  upgradeMaterials = {
    ...upgradeMaterials,
    lupenShards: Math.max(0, ownedShards - shardCost)
  };

  const nextQuality = item.quality || "standard";
  const nextLevel = requirements.targetLevel || item.level;

  if (item.source === "inventory") {
    const target = inventoryItems.find(entry => entry.id === item.inventoryId);
    if (target) {
      target.quality = nextQuality;
      target.level = nextLevel;
    }
    selectedForgeItemId = target ? `inventory:${target.id}` : null;
    return true;
  }

  if (item.source === "equipped") {
    const list = shipLoadouts[item.shipId]?.[item.loadoutKind];
    if (list?.[item.index]) {
      list[item.index] = makeLeveledLoadoutEntry(item.key, nextQuality, nextLevel);
      selectedForgeItemId = `equipped:${item.shipId}:${item.loadoutKind}:${item.index}`;
      if (item.shipId === currentShipId) applyShipStats(false);
    }
    return true;
  }

  if (item.source === "owned") {
    const store = item.categoryKey === "guns" ? ownedGuns : ownedAttachments;
    store[item.key] = Math.max(0, Number(store[item.key] || 0) - 1);
    const newItem = {
      id: `item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      key: item.key,
      quality: nextQuality,
      level: nextLevel
    };
    inventoryItems.push(newItem);
    selectedForgeItemId = `inventory:${newItem.id}`;
    return true;
  }

  return false;
}

function startForgeUpgrade() {
  if (forgeAnimating) return;
  const item = getForgeSelectedItem();
  const requirements = getForgeRequirements(item);
  if (!item || !requirements.canUpgrade) {
    previewForgeUpgrade();
    return;
  }

  const chamber = document.getElementById("forgeChamber");
  const startButton = document.getElementById("forgeStartBtn");
  forgeAnimating = true;
  if (startButton) startButton.disabled = true;
  if (chamber) {
    chamber.style.setProperty("--forge-before", getForgeLevelTier(getForgeItemLevel(item)).color);
    chamber.style.setProperty("--forge-after", getForgeLevelTier(requirements.targetLevel || getForgeItemLevel(item)).color);
    chamber.classList.remove("forging", "forge-complete");
    void chamber.offsetWidth;
    chamber.classList.add("forging");
  }
  const status = document.getElementById("forgeChamberStatus");
  if (status) status.textContent = "Forge sequence active";

  setTimeout(() => {
    const applied = applyForgeUpgrade(item, requirements);
    forgeAnimating = false;
    if (!applied) {
      if (status) status.textContent = "Forge failed: requirements changed";
      if (typeof addHudToast === "function") addHudToast("Forge failed: missing materials.");
      renderUpgradeForge();
      return;
    }
    if (chamber) {
      chamber.classList.remove("forging");
      chamber.classList.add("forge-complete");
    }
    const upgradedName = getForgeItemDefinition(item.key)?.name || getForgeItemDisplayName(item);
    const upgradedTier = getForgeLevelTier(requirements.targetLevel);
    addActivityLog(`${upgradedName} upgraded to ${upgradedTier.label} tier, Level ${getForgeItemLevelRoman(requirements.targetLevel)}.`);
    if (typeof addHudToast === "function") addHudToast(`${upgradedName} reached ${upgradedTier.label} tier.`);
    if (typeof showGameRewardBurst === "function") {
      showGameRewardBurst({
        type: `forge ${getForgeTierClass(requirements.targetLevel)}`,
        kicker: "Forge Upgrade Complete",
        title: `${upgradedName} ${getForgeItemLevelRoman(requirements.targetLevel)}`,
        meta: `${upgradedTier.label} tier reached · Level ${getForgeItemLevelRoman(requirements.targetLevel)}`,
        image: getForgeItemDefinition(item.key)?.image || "assets/items/lupen-shard.png"
      });
    }
    if (item.key === "pulseLaser" && item.categoryKey === "guns") {
      tutorialEvent("upgradedTutorialWeapon", { key: item.key, level: requirements.targetLevel });
    }
    if (typeof recordMissionEvent === "function") {
      recordMissionEvent("upgrade_item", { key: item.key, mode: "level", quality: item.quality, level: requirements.targetLevel });
    }
    renderUpgradeForge();
    updateProgressDisplays();
    updateSpaceHUD();
    saveGame();
  }, 1200);
}

function renderForgeSelectedPanel(item, items = getForgeUpgradeableItems()) {
  const panel = document.getElementById("forgeSelectedPanel");
  const count = document.getElementById("forgeOwnedCount");
  if (!panel) return;
  if (count) count.textContent = `${formatNumber(items.length)} Owned ${items.length === 1 ? "Item" : "Items"}`;
  if (!items.length) {
    panel.innerHTML = `<div class="terminal-empty-state"><strong>No gear available</strong><span>Buy a weapon or module at the Station Store, then return here to improve it.</span></div>`;
    return;
  }

  const previousScrollTop = panel.scrollTop;
  panel.innerHTML = items.map(entry => {
    const definition = getForgeItemDefinition(entry.key);
    const selected = entry.id === item?.id;
    const level = getForgeItemLevel(entry);
    const tier = getForgeLevelTier(level);
    const typeLabel = entry.categoryKey === "guns" ? "Weapon" : "Module";
    const sourceLabel = entry.source === "equipped" ? "Equipped" : "Vault";
    const sourceChip = `<span class="${entry.source === "equipped" ? "equipped" : "vault"}">${sourceLabel}</span>`;
    return `
      <button type="button" class="forge-owned-item forge-tier-scope ${getForgeTierClass(level)} ${selected ? "selected" : ""}" aria-pressed="${selected ? "true" : "false"}" aria-label="${escapeHtml(definition?.name || entry.key)}, ${escapeHtml(tier.label)} tier, Level ${escapeHtml(getForgeItemLevelRoman(level))}" onclick="selectForgeItem('${escapeJsString(entry.id)}')">
        <span class="forge-owned-art">
          <img src="${escapeHtml(definition?.image || "assets/items/lupen-shard.png")}" alt="${escapeHtml(definition?.name || entry.key)}">
          ${renderForgeTierPips(level)}
        </span>
        <span class="forge-owned-copy">
          <strong>${escapeHtml(definition?.name || getForgeItemDisplayName(entry))}</strong>
          <small>${escapeHtml(definition?.description || "Upgradeable ship equipment.")}</small>
          <span class="forge-owned-tags">
            <span>${typeLabel}</span>
            ${sourceChip}
            <span class="forge-tier-tag">${escapeHtml(tier.label)} · Level ${escapeHtml(getForgeItemLevelRoman(level))}</span>
          </span>
        </span>
        <span class="forge-owned-chevron" aria-hidden="true">&rsaquo;</span>
      </button>
    `;
  }).join("");
  panel.scrollTop = previousScrollTop;
  panel.onscroll = updateForgeScrollIndicator;
  requestAnimationFrame(updateForgeScrollIndicator);
}

function renderForgeInventoryPicker(items) {
  const picker = document.getElementById("forgeInventoryPicker");
  const filters = document.getElementById("forgePickerFilters");
  const grid = document.getElementById("forgePickerGrid");
  if (!picker || !filters || !grid) return;

  picker.classList.toggle("active", forgeInventoryPickerOpen);
  picker.setAttribute("aria-hidden", forgeInventoryPickerOpen ? "false" : "true");

  const counts = {
    all: items.length,
    weapons: items.filter(item => item.categoryKey === "guns").length,
    equipment: items.filter(item => item.categoryKey === "attachments").length,
    equipped: items.filter(item => item.source === "equipped").length,
    vault: items.filter(item => item.source !== "equipped").length
  };
  const filterList = [
    ["all", "All"],
    ["weapons", "Weapons"],
    ["equipment", "Equipment"],
    ["equipped", "Equipped"],
    ["vault", "Vault"]
  ];

  filters.innerHTML = filterList.map(([key, label]) => `
    <button type="button" class="${forgeInventoryPickerFilter === key ? "active" : ""}" onclick="setForgeInventoryPickerFilter('${key}')">
      ${label} <span>${formatNumber(counts[key] || 0)}</span>
    </button>
  `).join("");

  const visibleItems = getForgePickerItems(items);
  grid.innerHTML = visibleItems.length ? visibleItems.map(item => {
    const definition = getForgeItemDefinition(item.key);
    const selected = item.id === selectedForgeItemId;
    const level = getForgeItemLevel(item);
    const tier = getForgeLevelTier(level);
    const sourceLabel = item.source === "equipped" ? "Equipped" : item.source === "owned" ? `Vault x${formatNumber(item.count)}` : "Vault";
    const stats = getVisibleItemStats(item).slice(0, 2);
    return `
      <button type="button" class="forge-picker-card quality-${item.quality} forge-tier-scope ${getForgeTierClass(level)} ${selected ? "selected" : ""}" draggable="true" ondragstart="startForgeDrag(event, 'item', '${escapeJsString(item.id)}')" onclick="selectForgeItem('${escapeJsString(item.id)}')">
        ${renderQualityFx(item.quality, { src: definition.image, alt: definition.name, size: "small" })}
        <div>
          <span>${sourceLabel} / ${definition.typeLabel}</span>
          <strong>${escapeHtml(getForgeItemDisplayName(item))}</strong>
          <small>${escapeHtml(tier.label)} · Level ${getForgeItemLevelRoman(level)} / ${titleCaseQuality(item.quality)}</small>
          ${renderForgeTierPips(level, "compact")}
          <em>${stats.map(row => `${row.label} ${row.value}`).join(" / ")}</em>
        </div>
      </button>
    `;
  }).join("") : `<div class="terminal-empty-state">No items match this filter.</div>`;
}

function renderForgeChamber(item, requirements) {
  const image = document.getElementById("forgePreviewImage");
  const state = document.getElementById("forgeStatePreview");
  const chamber = document.getElementById("forgeChamber");
  const selectedName = document.getElementById("forgeSelectedName");
  const selectedType = document.getElementById("forgeSelectedType");
  const selectedTier = document.getElementById("forgeSelectedTier");
  const selectedDescription = document.getElementById("forgeSelectedDescription");
  const showcase = chamber?.closest(".forge-showcase");
  if (!image || !state || !chamber) return;
  if (!item) {
    chamber.className = "forge-chamber forge-chamber-visual level-active missing-materials quality-fx-host quality-fx--standard forge-tier-scope forge-tier-common";
    if (showcase) showcase.className = "forge-showcase forge-tier-scope forge-tier-common";
    if (selectedName) selectedName.textContent = "Select Gear";
    if (selectedType) selectedType.textContent = "No Selection";
    if (selectedTier) selectedTier.textContent = "Common · Level I";
    if (selectedDescription) selectedDescription.textContent = "Choose an owned item to inspect its next upgrade.";
    state.textContent = "Select an item to upgrade.";
    return;
  }

  const definition = getForgeItemDefinition(item.key);
  const level = getForgeItemLevel(item);
  const tier = getForgeLevelTier(level);
  const targetTier = getForgeLevelTier(requirements.preview?.toLevel || requirements.targetLevel || level);
  image.src = definition.image;
  image.alt = definition.name;
  if (selectedName) selectedName.textContent = definition.name;
  if (selectedType) selectedType.textContent = `${item.categoryKey === "guns" ? "Weapon" : "Module"}${item.source === "equipped" ? " / Equipped" : ""}`;
  if (selectedTier) {
    selectedTier.className = `forge-selected-tier forge-tier-scope ${getForgeTierClass(level)}`;
    selectedTier.innerHTML = `${renderForgeTierPips(level, "compact")}<strong>${escapeHtml(tier.label)} · Level ${escapeHtml(getForgeItemLevelRoman(level))}</strong>`;
  }
  if (selectedDescription) selectedDescription.textContent = definition.description || "Upgradeable ship equipment.";
  const chamberStateClass = forgeAnimating ? "upgrading forging" : requirements.canUpgrade ? "ready" : "missing-materials";
  chamber.className = `forge-chamber forge-chamber-visual level-active ${chamberStateClass} quality-fx-host quality-fx--standard forge-tier-scope ${getForgeTierClass(level)}`;
  if (showcase) showcase.className = `forge-showcase forge-tier-scope ${getForgeTierClass(level)}`;
  chamber.dataset.qualityTier = "standard";
  chamber.style.setProperty("--forge-before", tier.color);
  chamber.style.setProperty("--forge-after", targetTier.color);
  state.textContent = requirements.reason || "Ready to upgrade.";
}

function renderForgeMaterials(item, requirements) {
  const list = document.getElementById("forgeMaterialsList");
  const corePanel = document.getElementById("forgeCorePanel");
  if (!list || !corePanel) return;

  if (!item) {
    list.innerHTML = `<div class="terminal-empty-state">Select an item to upgrade.</div>`;
    corePanel.innerHTML = `<button id="forgeStartBtn" class="forge-start-btn" type="button" onclick="previewForgeUpgrade()">Select Item</button>`;
    return;
  }

  const definition = getForgeItemDefinition(item.key);
  const required = Number(requirements.requirement?.required || 0);
  const preview = requirements.preview || getForgeUpgradePreview(item);
  const fromLevel = preview?.fromLevel || getForgeItemLevel(item);
  const toLevel = preview?.toLevel || getForgeItemLevel(item);
  const fromTier = getForgeLevelTier(fromLevel);
  const toTier = getForgeLevelTier(toLevel);
  const currentStats = preview?.currentStats || [];
  const nextStats = preview?.nextStats || [];
  const isMaximumLevel = fromLevel >= FORGE_MAX_LEVEL;
  const owned = Math.max(0, Number(requirements.owned || 0));
  const missing = Math.max(0, Number(requirements.missing || 0));
  const remaining = requirements.canUpgrade ? Math.max(0, owned - required) : owned;
  const statRows = currentStats.map(row => {
    const next = nextStats.find(nextRow => nextRow.label === row.label) || row;
    return `
      <div class="forge-preview-stat ${isMaximumLevel ? "forge-preview-stat--maximum" : ""}">
        <span>${escapeHtml(row.label)}</span>
        <strong>${escapeHtml(row.value)}</strong>
        ${isMaximumLevel ? `<em>Maximum</em>` : `<b>&gt;&gt;</b><em>${escapeHtml(next.value)}</em>`}
      </div>
    `;
  }).join("");

  list.innerHTML = `
    <div class="forge-map1-preview forge-tier-scope ${getForgeTierClass(toLevel)} ${requirements.canUpgrade ? "ready" : "blocked"} ${isMaximumLevel ? "maximum" : ""}">
      <h3>${isMaximumLevel ? "Upgrade Status" : "Next-Level Comparison"}</h3>
      <div class="forge-level-flow ${isMaximumLevel ? "forge-level-flow--maximum" : ""}">
        ${isMaximumLevel ? `
          <strong class="forge-level-node forge-level-node--maximum forge-tier-scope ${getForgeTierClass(fromLevel)}">
            <small>${escapeHtml(fromTier.label)} Tier</small>
            <em>Level ${escapeHtml(getForgeItemLevelRoman(fromLevel))} · Maximum</em>
            ${renderForgeTierPips(fromLevel, "compact")}
          </strong>
        ` : `
          <span class="forge-level-node forge-tier-scope ${getForgeTierClass(fromLevel)}">
            <small>Current · ${escapeHtml(fromTier.label)}</small>
            <em>Level ${escapeHtml(getForgeItemLevelRoman(fromLevel))}</em>
            ${renderForgeTierPips(fromLevel, "compact")}
          </span>
          <b>&gt;&gt;&gt;</b>
          <strong class="forge-level-node forge-tier-scope ${getForgeTierClass(toLevel)}">
            <small>Next · ${escapeHtml(toTier.label)}</small>
            <em>Level ${escapeHtml(getForgeItemLevelRoman(toLevel))}</em>
            ${renderForgeTierPips(toLevel, "compact")}
          </strong>
        `}
      </div>
      <div class="forge-preview-stats">${statRows}</div>
      <div class="forge-upgrade-action-row">
        <div class="forge-preview-cost ${requirements.canUpgrade ? "ready" : "blocked"} ${isMaximumLevel ? "maximum" : ""}">
          <div class="forge-cost-heading">
            <span>${isMaximumLevel ? "Forge Status" : "Upgrade Cost"}</span>
            <em>${isMaximumLevel ? "Complete" : requirements.canUpgrade ? "Ready" : `${formatNumber(missing)} Short`}</em>
          </div>
          ${isMaximumLevel ? `
            <strong class="forge-maximum-label">No further upgrades</strong>
          ` : `
            <strong><img src="assets/items/lupen-shard.png" alt="" aria-hidden="true">${formatNumber(required)} <small>Lupen Shards</small></strong>
            <div class="forge-cost-balance">
              <span>Balance <b>${formatNumber(owned)}</b></span>
              <span>${requirements.canUpgrade ? "After upgrade" : "Still needed"} <b>${formatNumber(requirements.canUpgrade ? remaining : missing)}</b></span>
            </div>
          `}
        </div>
        <button id="forgeStartBtn" class="forge-start-btn" type="button" onclick="startForgeUpgrade()">${escapeHtml(requirements.buttonText || "Upgrade Item")}</button>
      </div>
      <p class="forge-bounty-help">${isMaximumLevel ? "This item has reached the highest Forge tier." : "Get more shards from daily bounties and destroyed asteroids."}</p>
    </div>
  `;

  corePanel.innerHTML = "";
}

function renderForgeSummary(item, requirements) {
  const statusText = document.getElementById("forgeSuccessText");
  const detailText = document.getElementById("forgeBonusText");
  const required = Number(requirements.requirement?.required || 0);
  const owned = Number(requirements.owned || 0);
  const missing = Number(requirements.missing || 0);

  if (statusText) statusText.textContent = requirements.reason || "Select item";
  if (detailText) {
    if (!item) {
      detailText.textContent = "Choose an item to inspect requirements.";
    } else if (missing > 0) {
      detailText.textContent = `Required: ${formatNumber(required)} / Owned: ${formatNumber(owned)} / Need: ${formatNumber(missing)} more`;
    } else if (requirements.canUpgrade) {
      detailText.textContent = `Success Chance: ${requirements.successChance || 100}% / No failure risk`;
    } else {
      detailText.textContent = requirements.reason || "Cannot upgrade";
    }
  }
  const start = document.getElementById("forgeStartBtn");
  if (start) {
    start.textContent = forgeAnimating
      ? "Upgrading..."
      : requirements.canUpgrade
        ? (requirements.buttonText || "Upgrade Item")
        : (requirements.buttonText || requirements.reason || "Unavailable");
    start.disabled = forgeAnimating || !requirements.canUpgrade;
  }
}

function renderUpgradeForge() {
  upgradeMaterials = normalizeUpgradeMaterials(upgradeMaterials);
  forgeUpgradeMode = "level";
  prepareTutorialForgeSelection();
  reconcileTutorialForgeStarterShards();
  const items = getForgeUpgradeableItems();
  const item = getForgeSelectedItem();
  const requirements = getForgeRequirements(item);
  const stationText = document.getElementById("forgeStationText");
  if (stationText) stationText.textContent = (lastPlanetNode || currentNode || "Asteron Prime").toUpperCase();

  const creditText = document.getElementById("forgeCreditsText");
  if (creditText) creditText.textContent = formatNumber(credits);
  const coreText = document.getElementById("forgeCoreCountText");
  if (coreText) coreText.textContent = "0";
  const shardCount = document.getElementById("forgeShardCountText");
  if (shardCount) shardCount.textContent = formatNumber(getLupenShardCount());
  const pilotLevelText = document.getElementById("forgePilotLevelText");
  if (pilotLevelText) pilotLevelText.textContent = formatNumber(getForgeTotalPilotXp());
  const pilotXpText = document.getElementById("forgePilotXpText");
  if (pilotXpText) pilotXpText.textContent = `Level cap ${getForgeItemLevelRoman(FORGE_MAX_LEVEL)}`;
  const tierLegend = document.getElementById("forgeTierLegend");
  if (tierLegend) tierLegend.innerHTML = renderForgeTierLegend();

  renderForgeSelectedPanel(item, items);
  renderForgeInventoryPicker(items);
  renderForgeChamber(item, requirements);
  renderForgeMaterials(item, requirements);
  renderForgeSummary(item, requirements);

  const status = document.getElementById("forgeChamberStatus");
  if (status && !forgeAnimating) status.textContent = requirements.canUpgrade ? "Upgrade ready" : (requirements.reason || "Select item");
}
