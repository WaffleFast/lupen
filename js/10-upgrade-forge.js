/* Forge */

const FORGE_MODE_LABELS = {
  level: "Level Upgrade",
  quality: "Quality Upgrade"
};

const FORGE_LEVEL_XP_REQUIREMENTS = [0, 0, 1000, 2500, 5000];
const FORGE_LEVEL_ROMAN = ["", "I", "II", "III", "IV", "V"];
const FORGE_QUALITY_ORDER = ITEM_QUALITY_ORDER;

function getForgeItemLevelRoman(level) {
  const safeLevel = Math.min(MAX_ITEM_LEVEL, Math.max(1, Math.floor(Number(level || 1))));
  return FORGE_LEVEL_ROMAN[safeLevel] || String(safeLevel);
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
  const qualityName = item.quality === "standard" ? definition.name : `${titleCaseQuality(item.quality)} ${definition.name}`;
  return `${qualityName} ${getForgeItemLevelRoman(getForgeItemLevel(item || {}))}`;
}

function getForgeItemLevel(item) {
  return Math.min(MAX_ITEM_LEVEL, Math.max(1, Math.floor(Number(item?.level || 1))));
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
    const levelMultiplier = getItemLevelMultiplier(level);
    const damage = Math.max(1, Math.round(Math.max(base.shield || 0, base.armor || 0, base.hull || 0) * levelMultiplier));
    return [
      { label: "Damage", value: formatNumber(damage) },
      { label: "Fire Rate", value: getGunFireRateText(GUNS[item.key]) }
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

function setForgeMode(mode) {
  if (forgeAnimating) return;
  forgeUpgradeMode = mode === "level" ? "level" : "quality";
  renderUpgradeForge();
}

function selectForgeItem(itemId) {
  if (forgeAnimating) return;
  selectedForgeItemId = itemId;
  forgeInventoryPickerOpen = false;
  renderUpgradeForge();
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
  return Math.max(50, getForgeItemLevel({ level }) * 50);
}

function getForgeQualityCoreCost(nextQuality) {
  return Math.max(1, ITEM_QUALITY_ORDER.indexOf(nextQuality));
}

function getForgeRequirement(item, mode = forgeUpgradeMode) {
  if (!item) return null;
  const level = getForgeItemLevel(item);

  if (mode === "level") {
    if (level >= MAX_ITEM_LEVEL) return null;
    return {
      materialKey: "lupenShards",
      materialName: "Lupen Shards",
      shortName: "Shards",
      resourceIcon: "assets/items/lupen-shard.png",
      required: getForgeLevelShardCost(level)
    };
  }

  const nextQuality = getForgeNextQuality(item.quality);
  if (!nextQuality) return null;
  return {
    materialKey: "lupenCores",
    materialName: "Lupen Cores",
    shortName: "Cores",
    resourceIcon: "assets/items/lupen-core.png",
    required: getForgeQualityCoreCost(nextQuality)
  };
}

function getForgeMaterialOwned(materialKey) {
  if (materialKey === "lupenShards") return getLupenShardCount();
  if (materialKey === "lupenCores") return getLupenCoreCount();
  return 0;
}

function getForgeUpgradePreview(item, mode = forgeUpgradeMode) {
  if (!item) return null;
  const currentLevel = getForgeItemLevel(item);
  const currentQuality = item.quality || "standard";
  const targetLevel = mode === "level" ? Math.min(MAX_ITEM_LEVEL, currentLevel + 1) : currentLevel;
  const targetQuality = mode === "quality" ? (getForgeNextQuality(currentQuality) || currentQuality) : currentQuality;

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

function getForgeState(item, mode = forgeUpgradeMode) {
  const requirement = getForgeRequirement(item, mode);
  const preview = getForgeUpgradePreview(item, mode);

  if (!item) {
    return {
      canUpgrade: false,
      reason: "No item selected",
      buttonText: "Select Item",
      requirement,
      preview,
      owned: 0,
      missing: 0,
      successChance: 0
    };
  }

  const level = getForgeItemLevel(item);
  const targetLevel = mode === "level" ? Math.min(MAX_ITEM_LEVEL, level + 1) : level;
  const requiredXp = mode === "level" ? getForgeLevelXpRequirement(targetLevel) : 0;
  if (!requirement) {
    const isQuality = mode === "quality";
    return {
      canUpgrade: false,
      reason: isQuality ? "Item already Godlike" : "Item already at maximum level",
      buttonText: isQuality ? "Godlike Maxed" : "Max Level",
      requirement,
      preview,
      targetLevel: level,
      targetQuality: item.quality,
      owned: 0,
      missing: 0,
      successChance: 0
    };
  }

  if (mode === "level" && getForgeTotalPilotXp() < requiredXp) {
    return {
      canUpgrade: false,
      reason: `Requires ${formatNumber(requiredXp)} XP for Level ${getForgeItemLevelRoman(targetLevel)}`,
      buttonText: `Need ${formatNumber(requiredXp - getForgeTotalPilotXp())} XP`,
      requirement,
      preview,
      targetLevel,
      targetQuality: item.quality,
      requiredXp,
      owned: getForgeMaterialOwned(requirement.materialKey),
      missing: 0,
      successChance: 0
    };
  }

  const owned = getForgeMaterialOwned(requirement.materialKey);
  const missing = Math.max(0, Number(requirement.required || 0) - owned);
  if (missing > 0) {
    return {
      canUpgrade: false,
      reason: `Missing ${requirement.materialName}`,
      buttonText: `Need ${formatNumber(missing)} More ${requirement.shortName}`,
      requirement,
      preview,
      targetLevel: mode === "level" ? level + 1 : level,
      targetQuality: mode === "quality" ? getForgeNextQuality(item.quality) : item.quality,
      owned,
      missing,
      successChance: 0
    };
  }

  return {
    canUpgrade: true,
    reason: "Ready to forge",
    buttonText: "Start Forge",
    requirement,
    preview,
    targetLevel: mode === "level" ? level + 1 : level,
    targetQuality: mode === "quality" ? getForgeNextQuality(item.quality) : item.quality,
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
  if (requirements.resourceKey === "lupenCores" && getLupenCoreCount() < required) missing.push("Lupen Cores");
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
  if (requirements.resourceKey === "lupenShards" && !spendLupenShards(requirements.resourceRequired)) return false;
  if (requirements.resourceKey === "lupenCores" && getLupenCoreCount() < Number(requirements.resourceRequired || 0)) return false;
  if (requirements.resourceKey === "lupenCores") removeLupenCores(requirements.resourceRequired);

  const nextQuality = requirements.targetQuality || item.quality;
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
    chamber.style.setProperty("--forge-before", getForgeQualityColor(item.quality));
    chamber.style.setProperty("--forge-after", getForgeQualityColor(requirements.targetQuality || item.quality));
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
    addActivityLog(`${getForgeItemDisplayName(item)} ${forgeUpgradeMode === "level" ? `raised to level ${getForgeItemLevelRoman(requirements.targetLevel)}` : `advanced to ${titleCaseQuality(requirements.targetQuality)}`}.`);
    if (typeof addHudToast === "function") addHudToast(forgeUpgradeMode === "level" ? "Forge complete: Level increased." : "Forge complete: Quality advanced.");
    renderUpgradeForge();
    updateProgressDisplays();
    updateSpaceHUD();
    saveGame();
  }, 1200);
}

function renderForgeSelectedPanel(item) {
  const panel = document.getElementById("forgeSelectedPanel");
  if (!panel) return;
  if (!item) {
    panel.innerHTML = `
      <button type="button" class="forge-drop-slot empty" onclick="openForgeInventoryPicker()" ondragover="event.preventDefault()" ondrop="handleForgeDrop(event, 'item')">
        <span>Empty item slot</span>
        <strong>Select a weapon or attachment</strong>
      </button>
    `;
    return;
  }

  const definition = getForgeItemDefinition(item.key);
  const stats = getVisibleItemStats(item);
  const sourceLabel = item.source === "equipped" ? "Equipped" : item.source === "owned" ? `Vault x${formatNumber(item.count)}` : "Vault";
  const statRows = [
    { label: "Quality", value: titleCaseQuality(item.quality), key: "quality" },
    { label: "Level", value: `${getForgeItemLevelRoman(getForgeItemLevel(item))} / ${getForgeItemLevelRoman(getForgePlayerLevelCap())}`, key: "level" },
    ...stats.map(row => ({ ...row, key: getForgeStatKey(row.label) }))
  ];

  panel.innerHTML = `
    <div class="forge-selected-card forge-selected-card--stack forge-drop-slot quality-${item.quality}" ondragover="event.preventDefault()" ondrop="handleForgeDrop(event, 'item')">
      <div class="forge-selected-info forge-selected-heading">
        <h3>${escapeHtml(getForgeItemDisplayName(item))}</h3>
        <div class="forge-item-badges">
          <span>${definition.typeLabel}</span>
          <span>${sourceLabel}</span>
        </div>
      </div>
      <div class="forge-selected-art"><img src="${escapeHtml(definition.image)}" alt="${escapeHtml(definition.name)}"></div>
      <div class="forge-selected-info">
        <div class="forge-core-stats">
          ${statRows.map(row => `
            <div class="forge-stat-row forge-stat-row-${escapeHtml(row.key)}">
              <span class="forge-stat-icon forge-stat-icon-${escapeHtml(row.key)}" aria-hidden="true"></span>
              <span class="forge-stat-label">${escapeHtml(row.label)}</span>
              <strong>${escapeHtml(row.value)}</strong>
            </div>
          `).join("")}
        </div>
        <button type="button" class="forge-change-item-btn" onclick="openForgeInventoryPicker()">Select Another Item</button>
      </div>
    </div>
  `;
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
    const sourceLabel = item.source === "equipped" ? "Equipped" : item.source === "owned" ? `Vault x${formatNumber(item.count)}` : "Vault";
    const stats = getVisibleItemStats(item).slice(0, 2);
    return `
      <button type="button" class="forge-picker-card quality-${item.quality} ${selected ? "selected" : ""}" draggable="true" ondragstart="startForgeDrag(event, 'item', '${escapeJsString(item.id)}')" onclick="selectForgeItem('${escapeJsString(item.id)}')">
        <img src="${escapeHtml(definition.image)}" alt="${escapeHtml(definition.name)}">
        <div>
          <span>${sourceLabel} / ${definition.typeLabel}</span>
          <strong>${escapeHtml(getForgeItemDisplayName(item))}</strong>
          <small>Level ${getForgeItemLevelRoman(getForgeItemLevel(item))} / ${titleCaseQuality(item.quality)}</small>
          <em>${stats.map(row => `${row.label} ${row.value}`).join(" / ")}</em>
        </div>
      </button>
    `;
  }).join("") : `<div class="terminal-empty-state">No items match this filter.</div>`;
}

function renderForgeChamber(item, requirements) {
  const image = document.getElementById("forgePreviewImage");
  const state = document.getElementById("forgeStatePreview");
  const levelBtn = document.getElementById("forgeLevelModeBtn");
  const qualityBtn = document.getElementById("forgeQualityModeBtn");
  const chamber = document.getElementById("forgeChamber");
  if (!image || !state || !chamber) return;
  const modeClass = forgeUpgradeMode === "quality" ? "quality-active" : "level-active";
  if (!item) {
    chamber.className = `forge-chamber forge-chamber-visual ${modeClass} missing-materials`;
    state.innerHTML = `<div class="forge-compare-card"><span>Current</span><strong>Select item</strong></div><div class="forge-compare-card"><span>After</span><strong>Select item</strong></div>`;
    return;
  }

  const definition = getForgeItemDefinition(item.key);
  const targetQuality = requirements.targetQuality || item.quality;
  const targetLevel = requirements.targetLevel || getForgeItemLevel(item);
  const preview = requirements.preview || getForgeUpgradePreview(item);
  image.src = definition.image;
  image.alt = definition.name;
  const chamberStateClass = forgeAnimating ? "upgrading forging" : requirements.canUpgrade ? "ready" : "missing-materials";
  chamber.className = `forge-chamber forge-chamber-visual ${modeClass} ${chamberStateClass}`;
  chamber.style.setProperty("--forge-before", getForgeQualityColor(item.quality));
  chamber.style.setProperty("--forge-after", getForgeQualityColor(targetQuality));

  const currentStats = (preview?.currentStats || []).map(row => `<div><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(row.value)}</strong></div>`).join("");
  const nextStats = (preview?.nextStats || []).map(row => `<div><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(row.value)}</strong></div>`).join("");
  const currentLabel = forgeUpgradeMode === "level"
    ? `Level ${getForgeItemLevelRoman(getForgeItemLevel(item))} / ${getForgeItemLevelRoman(getForgePlayerLevelCap())}`
    : `${titleCaseQuality(item.quality)} ${getForgeItemLevelRoman(getForgeItemLevel(item))}`;
  const nextLabel = forgeUpgradeMode === "level"
    ? `Level ${getForgeItemLevelRoman(targetLevel)} / ${getForgeItemLevelRoman(getForgePlayerLevelCap())}`
    : `${titleCaseQuality(targetQuality)} ${getForgeItemLevelRoman(targetLevel)}`;

  state.innerHTML = `
    <div class="forge-compare-card">
      <span>Current</span>
      <strong>${escapeHtml(currentLabel)}</strong>
      ${currentStats}
    </div>
    <div class="forge-compare-card after">
      <span>After</span>
      <strong class="quality-${targetQuality}">${escapeHtml(nextLabel)}</strong>
      ${nextStats}
    </div>
  `;

  levelBtn?.classList.toggle("active", forgeUpgradeMode === "level");
  qualityBtn?.classList.toggle("active", forgeUpgradeMode === "quality");
  levelBtn?.classList.toggle("disabled", getForgeItemLevel(item) >= MAX_ITEM_LEVEL);
  qualityBtn?.classList.toggle("disabled", !getForgeNextQuality(item.quality));
}

function renderForgeMaterials(item, requirements) {
  const list = document.getElementById("forgeMaterialsList");
  const corePanel = document.getElementById("forgeCorePanel");
  if (!list || !corePanel) return;

  if (!item) {
    list.innerHTML = `
      <button type="button" class="forge-resource-card empty" onclick="openForgeInventoryPicker()">
        <span>Select an item</span>
        <strong>No upgrade resource required yet</strong>
      </button>
    `;
    corePanel.innerHTML = `<button id="forgeStartBtn" class="forge-start-btn" type="button" onclick="openForgeInventoryPicker()">Select Item</button>`;
    return;
  }

  const requirement = requirements.requirement;
  const owned = Number(requirements.owned || 0);
  const required = Number(requirement?.required || 0);
  const missing = Number(requirements.missing || 0);
  const ready = requirements.canUpgrade;
  const resourceName = requirement?.materialName || (forgeUpgradeMode === "level" ? "Lupen Shards" : "Lupen Cores");
  const resourceIcon = requirement?.resourceIcon || (forgeUpgradeMode === "level" ? "assets/items/lupen-shard.png" : "assets/items/lupen-core.png");
  const resourceDescription = forgeUpgradeMode === "level"
    ? "Increases item level and improves stats."
    : "Raises item quality to the next rank.";
  const preview = requirements.preview || getForgeUpgradePreview(item);
  const shortName = requirement?.shortName || (forgeUpgradeMode === "level" ? "Shards" : "Cores");
  const missingText = `${formatNumber(missing)} more ${shortName.toLowerCase()}`;
  const inventoryLabel = requirement ? `${formatNumber(owned)} owned` : "--";
  const statusLabel = ready
    ? "Ready"
    : missing > 0
      ? `Need ${missingText}`
      : (requirements.reason || "Locked");
  const resultLabel = !requirement
    ? (requirements.reason || "No upgrade available")
    : forgeUpgradeMode === "level"
      ? `Level ${getForgeItemLevelRoman(preview.fromLevel)} -> Level ${getForgeItemLevelRoman(preview.toLevel)}`
      : `${titleCaseQuality(preview.fromQuality)} -> ${titleCaseQuality(preview.toQuality)}`;
  const resultStatRows = (preview?.currentStats || [])
    .map((row, index) => {
      const next = preview?.nextStats?.[index];
      if (!next || next.value === row.value) return "";
      return `
        <div>
          <span>${escapeHtml(row.label)}</span>
          <strong>${escapeHtml(row.value)} -> ${escapeHtml(next.value)}</strong>
        </div>
      `;
    })
    .filter(Boolean)
    .join("");

  list.innerHTML = `
    <div class="forge-upgrade-slot-card ${ready ? "ready" : "blocked"}">
      <div class="forge-upgrade-head">
        <img src="${escapeHtml(resourceIcon)}" alt="${escapeHtml(resourceName)}">
        <div>
          <span>${forgeUpgradeMode === "level" ? "Level Upgrade" : "Quality Upgrade"}</span>
          <strong>${escapeHtml(resourceName)}</strong>
          <small>${escapeHtml(resourceDescription)}</small>
        </div>
      </div>
      <div class="forge-material-summary">
        <div>
          <span>Cost</span>
          <strong>${required > 0 ? `${formatNumber(required)} ${escapeHtml(shortName)}` : "--"}</strong>
        </div>
        <div>
          <span>Inventory</span>
          <strong>${escapeHtml(inventoryLabel)}</strong>
        </div>
        <div class="${ready ? "ready" : "blocked"}">
          <span>Status</span>
          <strong>${escapeHtml(statusLabel)}</strong>
        </div>
      </div>
      <div class="forge-upgrade-result">
        <span>Result</span>
        <strong>${escapeHtml(resultLabel)}</strong>
        ${resultStatRows ? `<div class="forge-upgrade-result-stats">${resultStatRows}</div>` : ""}
      </div>
    </div>
  `;

  corePanel.innerHTML = `
    <div class="forge-upgrade-confirm ${requirements.canUpgrade ? "ready" : "blocked"}">
      <button id="forgeStartBtn" class="forge-start-btn" type="button" onclick="startForgeUpgrade()">Start Forge</button>
    </div>
  `;
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
    start.textContent = forgeAnimating ? "Forging..." : (requirements.buttonText || "Start Forge");
    start.disabled = forgeAnimating || (!requirements.canUpgrade && Boolean(item));
  }
}

function renderUpgradeForge() {
  upgradeMaterials = normalizeUpgradeMaterials(upgradeMaterials);
  const items = getForgeUpgradeableItems();
  const item = getForgeSelectedItem();
  const requirements = getForgeRequirements(item);
  const totalXp = getForgeTotalPilotXp();

  document.getElementById("forgeCreditsText").textContent = formatNumber(credits);
  document.getElementById("forgeCoreCountText").textContent = formatNumber(getLupenCoreCount());
  const shardCount = document.getElementById("forgeShardCountText");
  if (shardCount) shardCount.textContent = formatNumber(getLupenShardCount());
  document.getElementById("forgePilotLevelText").textContent = formatNumber(totalXp);
  document.getElementById("forgePilotXpText").textContent = `Level cap ${getForgeItemLevelRoman(getForgePlayerLevelCap())}`;

  renderForgeSelectedPanel(item, requirements);
  renderForgeInventoryPicker(items);
  renderForgeChamber(item, requirements);
  renderForgeMaterials(item, requirements);
  renderForgeSummary(item, requirements);

  const status = document.getElementById("forgeChamberStatus");
  if (status && !forgeAnimating) status.textContent = requirements.canUpgrade ? `${FORGE_MODE_LABELS[forgeUpgradeMode]} ready` : (requirements.reason || "Select item");
}
