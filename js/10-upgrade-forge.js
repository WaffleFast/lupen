/* Forge */

const FORGE_MODE_LABELS = {
  level: "Upgrade Level",
  quality: "Upgrade Quality"
};

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

function getForgeItemDefinition(key) {
  if (GUNS[key]) {
    return {
      kind: "weapon",
      typeLabel: "Weapon",
      key,
      name: GUNS[key].name,
      description: GUNS[key].description || GUNS[key].shortDescription || "Weapon system.",
      image: GUNS[key].image || itemDefinitions[key]?.icon,
      stats: getWeaponLayerStatRows(GUNS[key], "standard")
    };
  }

  if (attachments[key]) {
    return {
      kind: "attachment",
      typeLabel: "Attachment",
      key,
      name: attachments[key].name,
      description: attachments[key].description || "Ship equipment module.",
      image: attachments[key].image || itemDefinitions[key]?.icon,
      stats: [{ label: "Effect", value: getStoreAttachmentEffectText({ key }, "standard") }]
    };
  }

  return null;
}

function getForgeItemDisplayName(item) {
  const definition = getForgeItemDefinition(item.key);
  if (!definition) return "Unknown Item";
  return item.quality === "standard" ? definition.name : `${titleCaseQuality(item.quality)} ${definition.name}`;
}

function getForgeItemLevel(item) {
  return Math.min(MAX_ITEM_LEVEL, Math.max(1, Math.floor(Number(item.level || 1))));
}

function getForgeItemStatRows(item, quality = item?.quality || "standard", level = getForgeItemLevel(item || {})) {
  if (!item) return [];
  if (item.categoryKey === "guns" && GUNS[item.key]) {
    const base = getGunDamageForQuality(GUNS[item.key], quality);
    const levelMultiplier = getItemLevelMultiplier(level);
    return [
      { label: "Shield", value: formatNumber(Math.max(1, Math.round(base.shield * levelMultiplier))) },
      { label: "Armour", value: formatNumber(Math.max(1, Math.round(base.armor * levelMultiplier))) },
      { label: "Hull", value: formatNumber(Math.max(1, Math.round(base.hull * levelMultiplier))) },
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
  forgeMaterialAllocations = {};
  forgeUseLupenCore = false;
  renderUpgradeForge();
}

function selectForgeItem(itemId) {
  if (forgeAnimating) return;
  selectedForgeItemId = itemId;
  forgeMaterialAllocations = {};
  forgeUseLupenCore = false;
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
  if (slot === "item" && type === "item" && value) {
    selectForgeItem(value);
    return;
  }
  if (slot === "core" && type === "core" && getLupenCoreCount() > 0) {
    const requirements = getForgeRequirements(getForgeSelectedItem());
    if (!requirements.lupenCores || getLupenCoreCount() < requirements.lupenCores) return;
    forgeUseLupenCore = true;
    renderUpgradeForge();
  }
  if (slot.startsWith("material:") && type === "material") {
    const materialKey = slot.slice("material:".length);
    if (materialKey === value) loadForgeMaterial(materialKey);
  }
}

function getForgePickerItems(items) {
  if (forgeInventoryPickerFilter === "weapons") return items.filter(item => item.categoryKey === "guns");
  if (forgeInventoryPickerFilter === "equipment") return items.filter(item => item.categoryKey === "attachments");
  if (forgeInventoryPickerFilter === "equipped") return items.filter(item => item.source === "equipped");
  if (forgeInventoryPickerFilter === "vault") return items.filter(item => item.source !== "equipped");
  return items;
}

function getForgeNextQuality(quality) {
  return getNextItemQuality(quality);
}

function getForgeRequirements(item, mode = forgeUpgradeMode) {
  if (!item) return { materials: {}, credits: 0, canUpgrade: false, reason: "Select an item." };
  const level = getForgeItemLevel(item);
  const isWeapon = item.categoryKey === "guns";

  if (mode === "level") {
    if (level >= MAX_ITEM_LEVEL) return { materials: {}, credits: 0, canUpgrade: false, reason: "Item is at maximum level." };
    const materialCost = Math.max(1, Math.ceil(level / 4));
    return {
      materials: {
        [isWeapon ? "weaponParts" : "equipmentModules"]: materialCost
      },
      credits: 450 + level * 220,
      canUpgrade: true,
      targetLevel: level + 1,
      targetQuality: item.quality
    };
  }

  const nextQuality = getForgeNextQuality(item.quality);
  if (!nextQuality) return { materials: {}, credits: 0, canUpgrade: false, reason: "Item is already Godlike." };
  const coreCost = Math.max(1, ITEM_QUALITY_ORDER.indexOf(nextQuality));
  return {
    materials: {},
    credits: 1200 + coreCost * 850 + level * 120,
    canUpgrade: true,
    targetLevel: level,
    targetQuality: nextQuality,
    lupenCores: coreCost
  };
}

function getForgeSuccessChance(item, requirements) {
  if (!item || !requirements?.canUpgrade) return 0;
  if (forgeUpgradeMode === "quality") return 100;
  if (forgeUpgradeMode === "level") return Math.max(72, 96 - getForgeItemLevel(item));
  const nextIndex = ITEM_QUALITY_ORDER.indexOf(requirements.targetQuality);
  return Math.max(58, 92 - nextIndex * 7);
}

function getForgeAllocated(materialKey) {
  return Math.max(0, Math.floor(Number(forgeMaterialAllocations[materialKey] || 0)));
}

function setForgeMaterial(materialKey, quantity) {
  if (forgeAnimating) return;
  const owned = Math.max(0, Number(upgradeMaterials[materialKey] || 0));
  forgeMaterialAllocations[materialKey] = Math.max(0, Math.min(owned, Math.floor(Number(quantity || 0))));
  renderUpgradeForge();
}

function adjustForgeMaterial(materialKey, delta) {
  setForgeMaterial(materialKey, getForgeAllocated(materialKey) + Number(delta || 0));
}

function loadForgeMaterial(materialKey) {
  if (forgeAnimating) return;
  const item = getForgeSelectedItem();
  const requirements = getForgeRequirements(item);
  const required = Number(requirements.materials?.[materialKey] || 0);
  if (required <= 0) return;
  setForgeMaterial(materialKey, Math.min(Number(upgradeMaterials[materialKey] || 0), required));
}

function autoFillForgeMaterials() {
  if (forgeAnimating) return;
  const item = getForgeSelectedItem();
  const requirements = getForgeRequirements(item);
  forgeMaterialAllocations = {};
  forgeUseLupenCore = false;
  Object.entries(requirements.materials || {}).forEach(([key, required]) => {
    forgeMaterialAllocations[key] = Math.min(Number(upgradeMaterials[key] || 0), required);
  });
  if (requirements.lupenCores > 0 && getLupenCoreCount() >= requirements.lupenCores) {
    forgeUseLupenCore = true;
  }
  renderUpgradeForge();
}

function toggleForgeCore() {
  if (forgeAnimating) return;
  const requirements = getForgeRequirements(getForgeSelectedItem());
  forgeUseLupenCore = requirements.lupenCores > 0 && !forgeUseLupenCore && getLupenCoreCount() >= requirements.lupenCores;
  renderUpgradeForge();
}

function getForgeMissingRequirements(item, requirements) {
  const missing = [];
  Object.entries(requirements.materials || {}).forEach(([key, required]) => {
    if (getForgeAllocated(key) < required) missing.push(upgradeMaterialDefinitions[key]?.name || key);
  });
  if (credits < requirements.credits) missing.push("Credits");
  if (requirements.lupenCores > 0 && (!forgeUseLupenCore || getLupenCoreCount() < requirements.lupenCores)) missing.push("Lupen Core");
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
  status.textContent = missing.length ? `Missing ${missing.join(", ")}` : "Upgrade preview locked";
}

function applyForgeUpgrade(item, requirements) {
  Object.entries(requirements.materials || {}).forEach(([key, required]) => {
    upgradeMaterials[key] = Math.max(0, Number(upgradeMaterials[key] || 0) - required);
  });
  credits = Math.max(0, credits - requirements.credits);
  if (requirements.lupenCores > 0) removeLupenCores(requirements.lupenCores);

  const nextQuality = requirements.targetQuality || item.quality;
  const nextLevel = requirements.targetLevel || item.level;

  if (item.source === "inventory") {
    const target = inventoryItems.find(entry => entry.id === item.inventoryId);
    if (target) {
      target.quality = nextQuality;
      target.level = nextLevel;
    }
    selectedForgeItemId = target ? `inventory:${target.id}` : null;
    return;
  }

  if (item.source === "equipped") {
    const list = shipLoadouts[item.shipId]?.[item.loadoutKind];
    if (list?.[item.index]) {
      list[item.index] = makeLeveledLoadoutEntry(item.key, nextQuality, nextLevel);
      selectedForgeItemId = `equipped:${item.shipId}:${item.loadoutKind}:${item.index}`;
      if (item.shipId === currentShipId) applyShipStats(false);
    }
    return;
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
  }
}

function startForgeUpgrade() {
  if (forgeAnimating) return;
  const item = getForgeSelectedItem();
  const requirements = getForgeRequirements(item);
  if (!item || !requirements.canUpgrade) {
    previewForgeUpgrade();
    return;
  }

  const missing = getForgeMissingRequirements(item, requirements);
  if (missing.length) {
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
    applyForgeUpgrade(item, requirements);
    forgeAnimating = false;
    forgeUseLupenCore = false;
    forgeMaterialAllocations = {};
    if (chamber) {
      chamber.classList.remove("forging");
      chamber.classList.add("forge-complete");
    }
    addActivityLog(`${getForgeItemDisplayName(item)} ${forgeUpgradeMode === "level" ? `raised to level ${requirements.targetLevel}` : `advanced to ${titleCaseQuality(requirements.targetQuality)}`}.`);
    if (typeof addHudToast === "function") addHudToast("Forge upgrade complete.");
    renderUpgradeForge();
    updateProgressDisplays();
    updateSpaceHUD();
    saveGame();
  }, 2100);
}

function renderForgeSelectedPanel(item, requirements) {
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
  const stats = getForgeItemStatRows(item);
  const sourceLabel = item.source === "equipped" ? "Equipped" : item.source === "owned" ? `Vault x${formatNumber(item.count)}` : "Vault";

  panel.innerHTML = `
    <div class="forge-selected-card forge-drop-slot quality-${item.quality}" ondragover="event.preventDefault()" ondrop="handleForgeDrop(event, 'item')">
      <div class="forge-selected-art"><img src="${escapeHtml(definition.image)}" alt="${escapeHtml(definition.name)}"></div>
      <div class="forge-selected-info">
        <div class="forge-item-badges">
          <span>${definition.typeLabel}</span>
          <span>${sourceLabel}</span>
        </div>
        <h3>${escapeHtml(getForgeItemDisplayName(item))}</h3>
        <div class="forge-quality-pill quality-${item.quality}">${titleCaseQuality(item.quality)}</div>
        <p>${escapeHtml(definition.description)}</p>
        <div class="forge-core-stats">
          <div><span>Level</span><strong>${getForgeItemLevel(item)} / ${MAX_ITEM_LEVEL}</strong></div>
          ${stats.map(row => `<div><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(row.value)}</strong></div>`).join("")}
        </div>
        <button type="button" class="forge-change-item-btn" onclick="openForgeInventoryPicker()">Change Item</button>
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
    const stats = getForgeItemStatRows(item).slice(0, 3);
    return `
      <button type="button" class="forge-picker-card quality-${item.quality} ${selected ? "selected" : ""}" draggable="true" ondragstart="startForgeDrag(event, 'item', '${escapeJsString(item.id)}')" onclick="selectForgeItem('${escapeJsString(item.id)}')">
        <img src="${escapeHtml(definition.image)}" alt="${escapeHtml(definition.name)}">
        <div>
          <span>${sourceLabel} / ${definition.typeLabel}</span>
          <strong>${escapeHtml(getForgeItemDisplayName(item))}</strong>
          <small>Lv ${getForgeItemLevel(item)} / ${titleCaseQuality(item.quality)}</small>
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
  if (!item || !image || !state || !chamber) return;

  const definition = getForgeItemDefinition(item.key);
  const targetQuality = requirements.targetQuality || item.quality;
  const targetLevel = requirements.targetLevel || getForgeItemLevel(item);
  image.src = definition.image;
  image.alt = definition.name;
  chamber.className = `forge-chamber quality-${targetQuality}`;
  chamber.style.setProperty("--forge-before", getForgeQualityColor(item.quality));
  chamber.style.setProperty("--forge-after", getForgeQualityColor(targetQuality));

  state.innerHTML = `
    <div><span>Level Preview</span><strong>Level ${getForgeItemLevel(item)} <em>-></em> Level ${targetLevel}</strong></div>
    <div><span>Quality Preview</span><strong class="quality-${targetQuality}">${escapeHtml(getForgeItemDisplayName({ ...item, quality: targetQuality }))}</strong></div>
  `;

  levelBtn?.classList.toggle("active", forgeUpgradeMode === "level");
  qualityBtn?.classList.toggle("active", forgeUpgradeMode === "quality");
}

function renderForgeMaterials(item, requirements) {
  const list = document.getElementById("forgeMaterialsList");
  const corePanel = document.getElementById("forgeCorePanel");
  if (!list || !corePanel) return;

  const materialEntries = Object.entries(upgradeMaterialDefinitions).filter(([key]) => Number(requirements.materials?.[key] || 0) > 0);
  list.innerHTML = materialEntries.length ? materialEntries.map(([key, material]) => {
    const required = Number(requirements.materials?.[key] || 0);
    const owned = Number(upgradeMaterials[key] || 0);
    const allocated = getForgeAllocated(key);
    const relevant = required > 0;
    return `
      <div class="forge-material-card forge-drop-slot ${relevant ? "required" : "muted"}" draggable="${owned > 0 ? "true" : "false"}" ondragstart="startForgeDrag(event, 'material', '${key}')" ondragover="event.preventDefault()" ondrop="handleForgeDrop(event, 'material:${key}')">
        <img src="${escapeHtml(material.icon)}" alt="${escapeHtml(material.name)}">
        <div>
          <strong>${escapeHtml(material.name)}</strong>
          <span>${escapeHtml(material.description)}</span>
        </div>
        <div class="forge-material-count">
          <small>Owned</small>
          <b>${formatNumber(owned)} / ${formatNumber(required)}</b>
          <div class="forge-stepper">
            <button type="button" onclick="adjustForgeMaterial('${key}', -10)">-</button>
            <input value="${formatNumber(allocated)}" onchange="setForgeMaterial('${key}', this.value.replace(/,/g, ''))">
            <button type="button" onclick="adjustForgeMaterial('${key}', 10)">+</button>
          </div>
          <button type="button" class="forge-load-material-btn" onclick="loadForgeMaterial('${key}')">Load</button>
        </div>
      </div>
    `;
  }).join("") : `
    <div class="forge-material-empty">
      <span>${forgeUpgradeMode === "quality" ? "Quality upgrade" : "No parts required"}</span>
      <strong>${forgeUpgradeMode === "quality" ? "Load a Lupen Core to advance quality." : "Select an upgradeable item."}</strong>
    </div>
  `;

  corePanel.innerHTML = `
    <div class="forge-core-card forge-drop-slot ${forgeUseLupenCore ? "active" : ""} ${requirements.lupenCores > 0 ? "required" : ""}" draggable="${getLupenCoreCount() > 0 ? "true" : "false"}" ondragstart="startForgeDrag(event, 'core', 'lupen-core')" ondragover="event.preventDefault()" ondrop="handleForgeDrop(event, 'core')">
      <div class="forge-core-card-top">
        <img src="assets/items/lupen-core.png" alt="Lupen Core">
        <div>
          <span>${requirements.lupenCores > 0 ? `Required Catalyst x${formatNumber(requirements.lupenCores)}` : "Catalyst Slot"}</span>
          <strong>Lupen Core</strong>
          <p>${requirements.lupenCores > 0 ? "Required for quality upgrades. Drag or click to load the core stack." : "Used in Quality mode only."}</p>
        </div>
        <div><small>Owned</small><b>${formatNumber(getLupenCoreCount())}</b></div>
      </div>
      <button type="button" onclick="toggleForgeCore()" ${requirements.lupenCores <= 0 || getLupenCoreCount() < requirements.lupenCores ? "disabled" : ""}>${forgeUseLupenCore ? `Loaded x${formatNumber(requirements.lupenCores)}` : "Load Lupen Cores"}</button>
    </div>
  `;
}

function renderForgeSummary(item, requirements) {
  const success = getForgeSuccessChance(item, requirements);
  const missing = requirements.canUpgrade ? getForgeMissingRequirements(item, requirements) : [];
  const targetQuality = requirements.targetQuality || item?.quality || "standard";
  const targetLevel = requirements.targetLevel || getForgeItemLevel(item || {});
  const powerIncrease = forgeUpgradeMode === "level" ? "+4.5%" : `+${Math.round((getItemStatMultiplier(targetQuality) - getItemStatMultiplier(item?.quality || "standard")) * 100)}%`;

  document.getElementById("forgeSuccessText").textContent = requirements.canUpgrade ? `${success}%` : "--";
  document.getElementById("forgeBonusText").textContent = forgeUpgradeMode === "quality" ? (forgeUseLupenCore ? `Lupen Core x${formatNumber(requirements.lupenCores || 0)} loaded` : `Requires Lupen Core x${formatNumber(requirements.lupenCores || 0)}`) : "Load upgrade parts";
  document.getElementById("forgeOutcomeText").textContent = item ? `${getForgeItemDisplayName({ ...item, quality: targetQuality })} / Lv ${targetLevel}` : "Select item";
  document.getElementById("forgePowerText").textContent = item ? `Power increase ${powerIncrease}` : "Power increase --";
  document.getElementById("forgeCostText").textContent = formatNumber(requirements.credits || 0);
  const start = document.getElementById("forgeStartBtn");
  if (start) start.disabled = forgeAnimating || !requirements.canUpgrade || missing.length > 0;
}

function renderUpgradeForge() {
  upgradeMaterials = normalizeUpgradeMaterials(upgradeMaterials);
  const items = getForgeUpgradeableItems();
  const item = getForgeSelectedItem();
  const requirements = getForgeRequirements(item);
  const levelInfo = getCombatLevelInfo();

  document.getElementById("forgeCreditsText").textContent = formatNumber(credits);
  document.getElementById("forgeCoreCountText").textContent = formatNumber(getLupenCoreCount());
  document.getElementById("forgePilotLevelText").textContent = levelInfo.level;
  document.getElementById("forgePilotXpText").textContent = `${formatNumber(levelInfo.current)} / ${formatNumber(levelInfo.next)} XP`;

  renderForgeSelectedPanel(item, requirements);
  renderForgeInventoryPicker(items);
  renderForgeChamber(item, requirements);
  renderForgeMaterials(item, requirements);
  renderForgeSummary(item, requirements);

  const status = document.getElementById("forgeChamberStatus");
  if (status && !forgeAnimating) status.textContent = requirements.canUpgrade ? `${FORGE_MODE_LABELS[forgeUpgradeMode]} ready` : (requirements.reason || "Select item");
}
