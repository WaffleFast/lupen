/* Hangar Vault browsing and selected-item loadout actions. */

function getVaultEntryDescription(entry) {
  if (!entry) return "";
  if (entry.categoryKey === "guns") {
    return GUNS[entry.key]?.description || itemDefinitions[entry.key]?.name || "";
  }
  if (entry.categoryKey === "attachments") {
    const attachmentDescriptions = {
      cargoPod: "Extends cargo capacity for longer salvage and trade runs.",
      hullBooster: "Reinforces your vessel with additional hull integrity.",
      jumpDrive: "Improves jump systems for quicker route recovery.",
      shieldBooster: "Strengthens shield capacity for better survivability.",
      evasionMatrix: "Improves manoeuvring systems so incoming hits deal reduced damage."
    };
    return attachmentDescriptions[entry.key] || itemDefinitions[entry.key]?.name || "";
  }
  if (entry.key === "lupenShards") {
    return upgradeMaterialDefinitions?.lupenShards?.description || "Charged Forge material used to raise item levels.";
  }
  return "Rare enhancement core used for future upgrades, quality progression and high-value trading.";
}

function getEquippedVaultCounts() {
  const equipped = new Map();
  Object.values(shipLoadouts || {}).forEach(loadout => {
    if (!loadout) return;
    (loadout.attachments || []).forEach(entry => {
      const key = getEquipmentKey(entry);
      const quality = getEquipmentQuality(entry);
      const level = getEquipmentLevel(entry);
      const mapKey = `${key}__${quality}__${level}`;
      equipped.set(mapKey, (equipped.get(mapKey) || 0) + 1);
    });
    (loadout.guns || []).forEach(entry => {
      const key = getEquipmentKey(entry);
      const quality = getEquipmentQuality(entry);
      const level = getEquipmentLevel(entry);
      const mapKey = `${key}__${quality}__${level}`;
      equipped.set(mapKey, (equipped.get(mapKey) || 0) + 1);
    });
  });
  return equipped;
}

function buildVaultEntries() {
  ensureInventoryObjects();
  const gearGroups = new Map();
  const resourceGroups = new Map();
  const equippedCounts = getEquippedVaultCounts();

  function getSignature(key, quality = "standard", level = 1) {
    return `${key}__${quality}__${Math.max(1, Number(level || 1))}`;
  }

  function makeEntry({ key, quality = "standard", level = 1, source = "owned", storedCount = 1, count = 1, resource = false, inventoryId = "" }) {
    const definition = itemDefinitions[key];
    if (!definition) return null;
    const safeLevel = Math.max(1, Number(level || 1));
    const signature = getSignature(key, quality, safeLevel);
    const safeInventoryId = String(inventoryId || "");
    return {
      groupKey: resource ? `${signature}__resource` : `${signature}__gear`,
      signature,
      key,
      quality,
      level: safeLevel,
      name: definition.name,
      category: definition.category,
      categoryKey: getItemCategoryKey(key),
      icon: definition.icon || "assets/items/lupen-core.png",
      count,
      storedCount,
      equippedCount: equippedCounts.get(signature) || 0,
      resource,
      stackable: resource,
      source,
      inventoryId: safeInventoryId,
      inventoryIds: safeInventoryId ? [safeInventoryId] : [],
      baseId: key
    };
  }

  function addStoredGear(key, quality = "standard", level = 1, source = "owned", inventoryId = "") {
    const signature = getSignature(key, quality, level);
    if (!gearGroups.has(signature)) {
      const entry = makeEntry({ key, quality, level, source, storedCount: 0, count: 0, inventoryId });
      if (entry) gearGroups.set(signature, entry);
    }
    const entry = gearGroups.get(signature);
    if (!entry) return;
    entry.storedCount += 1;
    entry.count += 1;
    if (inventoryId && !entry.inventoryIds.includes(String(inventoryId))) entry.inventoryIds.push(String(inventoryId));
  }

  function addResource(key, quality, quantity = 1, override = {}) {
    const signature = getSignature(key, quality, 1);
    if (!resourceGroups.has(signature)) {
      const definition = itemDefinitions[key] || override;
      if (!definition?.name) return;
      const entry = {
        groupKey: `${signature}__resource`,
        signature,
        key,
        quality,
        level: 1,
        name: definition.name,
        category: definition.category || "Core",
        categoryKey: override.categoryKey || getItemCategoryKey(key),
        icon: definition.icon || "assets/items/lupen-core.png",
        count: 0,
        storedCount: 0,
        equippedCount: 0,
        resource: true,
        stackable: true,
        source: "resource",
        ...override
      };
      resourceGroups.set(signature, entry);
    }
    const entry = resourceGroups.get(signature);
    if (!entry) return;
    entry.count += Math.max(1, Number(quantity || 1));
  }

  Object.entries(ownedAttachments || {}).forEach(([key, count]) => {
    const total = Math.max(0, Number(count || 0));
    for (let index = 0; index < total; index += 1) addStoredGear(key, "standard", 1, "owned");
  });

  Object.entries(ownedGuns || {}).forEach(([key, count]) => {
    const total = Math.max(0, Number(count || 0));
    for (let index = 0; index < total; index += 1) addStoredGear(key, "standard", 1, "owned");
  });

  (inventoryItems || []).forEach(item => {
    if (!item || !itemDefinitions[item.key]) return;
    if (item.key === "lupenCore") {
      addResource(item.key, LUPEN_CORE_QUALITY, 1);
      return;
    }
    addStoredGear(item.key, item.quality || "standard", item.level || 1, "inventory", item.id || "");
  });

  const shardCount = Math.max(0, Number(upgradeMaterials?.lupenShards || 0));
  if (shardCount > 0) {
    const shardDefinition = upgradeMaterialDefinitions?.lupenShards || {};
    addResource("lupenShards", LUPEN_CORE_QUALITY, shardCount, {
      name: "Lupen Shard",
      category: "Core",
      categoryKey: "cores",
      icon: shardDefinition.icon || "assets/items/lupen-shard.png"
    });
  }

  equippedCounts.forEach((equippedCount, signature) => {
    if (equippedCount <= 0) return;
    if (gearGroups.has(signature)) {
      const existing = gearGroups.get(signature);
      existing.equippedCount = equippedCount;
      existing.count = existing.storedCount + equippedCount;
      return;
    }
    const [key, quality = "standard", rawLevel = "1"] = signature.split("__");
    const entry = makeEntry({
      key,
      quality,
      level: Math.max(1, Number(rawLevel || 1)),
      source: "equipped",
      storedCount: 0,
      count: equippedCount
    });
    if (entry) {
      entry.storedCount = 0;
      entry.equippedCount = equippedCount;
      entry.count = equippedCount;
      gearGroups.set(signature, entry);
    }
  });

  gearGroups.forEach(entry => {
    entry.equippedCount = equippedCounts.get(entry.signature) || entry.equippedCount || 0;
    entry.count = entry.storedCount + entry.equippedCount;
  });

  return [...Array.from(gearGroups.values()), ...Array.from(resourceGroups.values())].sort(sortVaultEntries);
}

function getVaultCapacityUsage() {
  return ["guns", "attachments"].reduce((total, categoryKey) => total + getInventoryEntriesForCategory(categoryKey)
    .reduce((sum, entry) => sum + Number(entry.count || 0), 0), 0);
}

function sortVaultEntries(a, b) {
  if (selectedVaultSort === "name") return a.name.localeCompare(b.name) || a.quality.localeCompare(b.quality);
  if (selectedVaultSort === "level") return Number(b.level || 1) - Number(a.level || 1) || a.name.localeCompare(b.name);
  if (selectedVaultSort === "quantity") return Number(b.count || 0) - Number(a.count || 0) || a.name.localeCompare(b.name);
  const qualityDelta = ITEM_QUALITY_ORDER.indexOf(b.quality) - ITEM_QUALITY_ORDER.indexOf(a.quality);
  if (qualityDelta !== 0) return qualityDelta;
  if (a.categoryKey !== b.categoryKey) return a.categoryKey.localeCompare(b.categoryKey);
  return a.name.localeCompare(b.name) || Number(b.level || 1) - Number(a.level || 1);
}

function getVaultFilteredEntries() {
  const entries = buildVaultEntries();
  const query = selectedVaultSearch.trim().toLowerCase();
  return entries.filter(entry => {
    if (hangarVaultFilter !== "all" && entry.categoryKey !== hangarVaultFilter) return false;
    const filterQuality = entry.categoryKey === "cores" ? "legendary" : entry.quality;
    const storedQuantity = entry.stackable ? Number(entry.count || 0) : Number(entry.storedCount || 0);
    if (selectedVaultQuality !== "all" && filterQuality !== selectedVaultQuality) return false;
    if (selectedVaultStatus === "stored" && storedQuantity <= 0) return false;
    if (selectedVaultStatus === "equipped" && Number(entry.equippedCount || 0) <= 0) return false;
    if (query) {
      const haystack = [
        entry.name,
        entry.category,
        entry.categoryKey,
        getVaultQualityLabel(entry),
        entry.stackable ? "resource material" : getHangarTierLabel(entry.level)
      ].join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

function ensureVaultSelection() {
  const entries = getVaultFilteredEntries();
  if (!entries.length) {
    selectedVaultGroupKey = null;
    return;
  }
  if (!entries.some(entry => entry.groupKey === selectedVaultGroupKey)) {
    const legacyMatch = entries.find(entry => selectedVaultGroupKey && entry.groupKey.startsWith(`${selectedVaultGroupKey}__`));
    if (legacyMatch) {
      selectedVaultGroupKey = legacyMatch.groupKey;
      return;
    }
    selectedVaultGroupKey = entries[0].groupKey;
  }
}

function setHangarVaultFilter(nextFilter) {
  hangarVaultFilter = nextFilter;
  ensureVaultSelection();
  renderHangarVault();
}

function setHangarVaultSearch(query) {
  selectedVaultSearch = String(query || "");
  ensureVaultSelection();
  renderHangarVault();
}

function setHangarVaultSort(nextSort) {
  selectedVaultSort = ["quality", "name", "level", "quantity"].includes(nextSort) ? nextSort : "quality";
  ensureVaultSelection();
  renderHangarVault();
}

function setHangarVaultQuality(nextQuality) {
  selectedVaultQuality = nextQuality === "all" || ITEM_QUALITY_ORDER.includes(nextQuality) ? nextQuality : "all";
  ensureVaultSelection();
  renderHangarVault();
}

function setHangarVaultStatus(nextStatus) {
  selectedVaultStatus = ["all", "stored", "equipped"].includes(nextStatus) ? nextStatus : "all";
  ensureVaultSelection();
  renderHangarVault();
}

function selectVaultItem(groupKey) {
  selectedVaultGroupKey = groupKey;
  selectedVaultActionContext = null;
  renderHangarVault();
}

function selectEquippedLoadoutVaultItem(categoryKey, index) {
  selectedLoadoutStatusMessage = "";
  selectedLoadoutSlotCategory = categoryKey === "attachments" ? "attachments" : "guns";
  selectedLoadoutVaultFilter = selectedLoadoutSlotCategory;
  const loadout = getShipLoadout(selectedHangarShipId);
  const listName = categoryKey === "guns" ? "guns" : "attachments";
  const entry = loadout?.[listName]?.[Number(index)];
  const key = getEquipmentKey(entry);
  const quality = getEquipmentQuality(entry);
  const level = getEquipmentLevel(entry);
  hangarVaultFilter = categoryKey;
  selectedVaultGroupKey = key ? `${key}__${quality}` : selectedVaultGroupKey;
  selectedVaultActionContext = key
    ? {
      source: "equipped",
      categoryKey,
      index: Number(index),
      key,
      quality,
      level
    }
    : null;
  selectedLoadoutItemContext = {
    source: key ? "equipped" : "slot",
    categoryKey,
    index: Number(index),
    key,
    quality,
    level
  };
  selectedLoadoutSlotExplicitlyChosen = true;
  renderInstalledGuns();
  renderInstalledAttachments();
  renderGunInventory();
  renderAttachmentInventory();
  renderLoadoutItemDetail();
}

function getSelectedVaultEntry() {
  const entries = getVaultFilteredEntries();
  return entries.find(entry => entry.groupKey === selectedVaultGroupKey) ||
    entries.find(entry => selectedVaultGroupKey && entry.groupKey.startsWith(`${selectedVaultGroupKey}__`)) ||
    null;
}

function getNextItemQuality(quality = "standard") {
  if (quality === LUPEN_CORE_QUALITY) return null;
  const normalized = typeof normalizeRarityId === "function" ? normalizeRarityId(quality) : quality;
  const index = ITEM_QUALITY_ORDER.indexOf(normalized);
  if (index < 0 || index >= ITEM_QUALITY_ORDER.length - 1) return null;
  return ITEM_QUALITY_ORDER[index + 1];
}

function getLupenCoreCount() {
  return inventoryItems.filter(item => item.key === "lupenCore").length;
}

function getUpgradeCoreCost(fromQuality = "standard") {
  const nextQuality = getNextItemQuality(fromQuality);
  const costByNextQuality = {
    refined: 1,
    advanced: 2,
    elite: 3,
    legendary: 5,
    godlike: 8
  };
  return nextQuality ? (costByNextQuality[nextQuality] || 1) : 0;
}

function removeLupenCores(quantity) {
  let remaining = Math.max(0, Number(quantity) || 0);
  if (remaining <= 0) return 0;

  const kept = [];
  inventoryItems.forEach(item => {
    if (remaining > 0 && item.key === "lupenCore") {
      remaining -= 1;
      return;
    }
    kept.push(item);
  });

  inventoryItems = kept;
  return quantity - remaining;
}

function findEquippedLoadoutEntry(key, quality, categoryKey) {
  const loadoutKind = categoryKey === "guns" ? "guns" : "attachments";
  for (const [shipId, loadout] of Object.entries(shipLoadouts || {})) {
    const list = loadout?.[loadoutKind] || [];
    const index = list.findIndex(entry => getEquipmentKey(entry) === key && getEquipmentQuality(entry) === quality);
    if (index >= 0) return { shipId, list, index };
  }
  return null;
}

function upgradeSelectedVaultItem() {
  const entry = getSelectedVaultEntry();
  if (!entry || !["guns", "attachments"].includes(entry.categoryKey)) return;

  const nextQuality = getNextItemQuality(entry.quality);
  if (!nextQuality) {
    alert("This item is already Godlike.");
    return;
  }

  const coreCost = getUpgradeCoreCost(entry.quality);
  if (getLupenCoreCount() < coreCost) {
    alert(`Not enough Lupen Cores. This upgrade needs ${formatNumber(coreCost)}.`);
    return;
  }

  const isGun = entry.categoryKey === "guns";
  let upgraded = false;

  if (entry.quality === "standard") {
    const store = isGun ? ownedGuns : ownedAttachments;
    if ((store[entry.key] || 0) > 0) {
      store[entry.key] -= 1;
      inventoryItems.push({ id: `item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, key: entry.key, quality: nextQuality });
      upgraded = true;
    }
  } else if (removeOneInventoryItem(entry.key, entry.quality)) {
    inventoryItems.push({ id: `item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, key: entry.key, quality: nextQuality });
    upgraded = true;
  }

  if (!upgraded) {
    const equipped = findEquippedLoadoutEntry(entry.key, entry.quality, entry.categoryKey);
    if (equipped) {
      equipped.list[equipped.index] = makeLoadoutEntry(entry.key, nextQuality);
      upgraded = true;
      if (!isGun && equipped.shipId === currentShipId) applyShipStats(false);
      if (isGun && equipped.shipId === currentShipId && engageTimer) {
        clearInterval(engageTimer);
        engageTimer = null;
      }
    }
  }

  if (!upgraded) {
    alert("No upgradeable copy is available.");
    return;
  }

  removeLupenCores(coreCost);
  selectedVaultGroupKey = `${entry.key}__${nextQuality}`;
  addActivityLog(`${entry.name} upgraded to ${titleCaseQuality(nextQuality)} using ${formatNumber(coreCost)} Lupen Core${coreCost === 1 ? "" : "s"}.`);
  renderHangarVault();
  renderHangarOverview();
  updateHudDock();
  saveGame();
}

function renderVaultFilters() {
  const bar = document.getElementById("vaultFilterBar");
  if (!bar) return;

  const entries = buildVaultEntries();
  const filters = [
    { key: "all", label: "All Items", helper: "Everything stored" },
    { key: "guns", label: "Weapons", helper: "Ship armaments" },
    { key: "attachments", label: "Attachments", helper: "Hull equipment" },
    { key: "cores", label: "Cores", helper: "Upgrade materials" }
  ];

  bar.innerHTML = filters.map(filter => {
    const count = filter.key === "all" ? entries.length : entries.filter(entry => entry.categoryKey === filter.key).length;
    const legacyId = filter.key === "all" ? "All" : filter.key === "guns" ? "Guns" : filter.key === "attachments" ? "Attachments" : "Cores";
    return `
      <button id="vaultFilter${legacyId}" class="vault-filter-btn ${hangarVaultFilter === filter.key ? "active" : ""}" aria-pressed="${hangarVaultFilter === filter.key ? "true" : "false"}" onclick="setHangarVaultFilter('${filter.key}')">
        <span><strong>${filter.label}</strong><small>${filter.helper}</small></span>
        <b>${formatNumber(count)}</b>
      </button>
    `;
  }).join("");

  const search = document.getElementById("vaultSearchInput");
  if (search && search.value !== selectedVaultSearch) search.value = selectedVaultSearch;
  const sort = document.getElementById("vaultSortSelect");
  if (sort && sort.value !== selectedVaultSort) sort.value = selectedVaultSort;
  const quality = document.getElementById("vaultQualitySelect");
  if (quality) {
    quality.innerHTML = `<option value="all">All qualities</option>${ITEM_QUALITY_ORDER.map(value => `<option value="${escapeHtml(value)}">${escapeHtml(titleCaseQuality(value))}</option>`).join("")}`;
    quality.value = selectedVaultQuality;
  }
  const status = document.getElementById("vaultStatusSelect");
  if (status && status.value !== selectedVaultStatus) status.value = selectedVaultStatus;
  const count = document.getElementById("vaultCapacityText");
  if (count) count.innerHTML = `<span>Gear Storage</span><b>${formatNumber(getVaultCapacityUsage())} / ${formatNumber(LOADOUT_VAULT_CAPACITY)}</b>`;
}

function getVaultQualityLabel(entry) {
  if (entry?.categoryKey === "cores" || entry?.quality === LUPEN_CORE_QUALITY) return "Legendary";
  return titleCaseQuality(entry?.quality || "standard");
}

function formatRomanLevel(level = 1) {
  const value = Math.max(1, Math.min(10, Math.floor(Number(level || 1))));
  const numerals = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  return numerals[value] || String(value);
}

const HANGAR_LEVEL_TIERS = Object.freeze(Object.fromEntries(
  ITEM_RARITY_LEVEL_ORDER.map(tier => [tier.level, tier])
));

function getHangarEquipmentTier(level = 1) {
  return getItemRarityPresentation(level);
}

function getHangarEquipmentTierClass(level = 1) {
  if (typeof getForgeTierClass === "function") return getForgeTierClass(level);
  return `forge-tier-${getHangarEquipmentTier(level).key}`;
}

function renderHangarEquipmentTierPips(level = 1, className = "compact") {
  if (typeof renderForgeTierPips === "function") return renderForgeTierPips(level, className);
  const safeLevel = Math.max(1, Math.min(5, Math.floor(Number(level || 1))));
  const tier = getHangarEquipmentTier(safeLevel);
  const pips = Array.from({ length: safeLevel }, () => "<i></i>").join("");
  return `<span class="forge-tier-pips ${escapeHtml(className)}" role="img" aria-label="${escapeHtml(tier.label)} tier, Level ${escapeHtml(formatRomanLevel(safeLevel))}">${pips}</span>`;
}

function getHangarTierLabel(level = 1) {
  const tier = getHangarEquipmentTier(level);
  return `${tier.label} · ${formatRomanLevel(level)}`;
}

function getVaultFireRateLabel(gun) {
  const rate = getGunFireRateValue(gun);
  if (rate <= 0) return "Unknown";
  if (rate < 0.7) return "Slow";
  if (rate < 1.15) return "Steady";
  return "Rapid";
}

function getVaultEntryStats(entry) {
  if (!entry) return [];
  const item = {
    key: entry.key,
    kind: entry.categoryKey === "guns" ? "gun" : entry.categoryKey === "attachments" ? "attachment" : "core"
  };

  if (item.kind === "gun") {
    const gun = GUNS[item.key];
    if (gun) {
      return [
        ...getWeaponPurchaseStatRows(gun, entry.quality),
        { label: "Stored", value: formatNumber(entry.storedCount || 0) },
        { label: "Equipped", value: formatNumber(entry.equippedCount || 0) }
      ];
    }
  } else if (item.kind === "attachment") {
    const effectStats = getAttachmentPurchaseStatRows(item, entry.quality);
    return [
      ...effectStats,
      { label: "Stored", value: formatNumber(entry.storedCount || 0) },
      { label: "Equipped", value: formatNumber(entry.equippedCount || 0) }
    ];
  } else if (item.kind === "core") {
    const useText = entry.key === "lupenShards" ? "Level upgrade" : "Quality upgrade";
    return [
      { label: "Quantity", value: formatNumber(entry.count || 0) },
      { label: "Use", value: useText }
    ];
  }

  return [{ label: "Owned", value: formatNumber(entry.storedCount || entry.count || 0) }];
}


function getVaultTooltipHtml(entry) {
  if (!entry) return "";
  if (entry.categoryKey === "guns") {
    return getEquipmentTooltipHtml(entry, "guns");
  }
  if (entry.categoryKey === "attachments") {
    return getEquipmentTooltipHtml(entry, "attachments");
  }

  const quality = entry.quality || "standard";
  const qualityLabel = titleCaseQuality(quality);
  const statRows = [
    { label: "Owned", value: formatNumber(entry.count || 0) },
    { label: "Tier", value: "God-tier" },
    { label: "Use", value: "Upgrade" }
  ];
  const statHtml = statRows.map(row => `
    <div class="hangar-tooltip-stat">
      <span>${escapeHtml(row.label)}</span>
      <strong>${escapeHtml(row.value)}</strong>
    </div>
  `).join("");

  return `
    <div class="hangar-tooltip-card quality-${escapeHtml(quality)}">
      <div class="hangar-tooltip-top">
        <img src="${escapeHtml(entry.icon)}" alt="">
        <div>
          <div class="hangar-tooltip-name">${escapeHtml(entry.name)}</div>
          <div class="hangar-tooltip-meta">${escapeHtml(getVaultQualityLabel(entry))} / x${formatNumber(entry.count || 0)} owned</div>
        </div>
      </div>
      <div class="hangar-tooltip-stats">${statHtml}</div>
      <div class="hangar-tooltip-note">${escapeHtml(getVaultEntryDescription(entry) || "Upgrade material")}</div>
    </div>
  `;
}

function renderVaultCatalog() {
  const grid = document.getElementById("vaultCatalogGrid");
  if (!grid) return;

  const entries = getVaultFilteredEntries();
  if (!entries.length) {
    grid.innerHTML = `
      <div class="vault-empty-state new-vault-empty">
        <strong>No vault items found</strong>
        <span>Try another vault filter.</span>
      </div>
    `;
    return;
  }

  grid.innerHTML = "";

  entries.forEach(entry => {
    const button = document.createElement("button");
    const selected = selectedVaultGroupKey === entry.groupKey || Boolean(selectedVaultGroupKey && entry.groupKey.startsWith(`${selectedVaultGroupKey}__`));
    const level = Math.max(1, Number(entry.level || 1));
    const tier = getHangarEquipmentTier(level);
    const tierClass = entry.stackable ? "" : `item-rarity-card item-rarity-compact forge-tier-scope ${getHangarEquipmentTierClass(level)} ${getItemRarityClass(level)}`;
    button.className = `vault-storage-card ${selected ? "selected" : ""} ${entry.stackable ? "resource-entry" : "gear-entry"} quality-${entry.quality} ${tierClass}`;
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    button.setAttribute("aria-label", `${entry.name}, ${getVaultQualityLabel(entry)}, Level ${formatRomanLevel(level)}, ${entry.storedCount || 0} stored, ${entry.equippedCount || 0} equipped`);
    if (!entry.stackable) {
      button.dataset.level = String(level);
      button.dataset.tier = tier.key;
      button.dataset.rarity = tier.key;
    }
    button.onclick = () => selectVaultItem(entry.groupKey);
    button.removeAttribute("title");
    showHangarTooltip(button, getVaultTooltipHtml(entry));
    bindHangarEquipmentTooltip(button);

    button.innerHTML = `
      <div class="vault-storage-art item-rarity-art quality-${entry.quality}">
        ${renderQualityFx(entry.quality, { src: entry.icon, alt: entry.name, size: "small" })}
      </div>
      <div class="vault-storage-copy">
        <strong>${entry.name}</strong>
        <span class="vault-card-meta">${escapeHtml(entry.category)} · ${escapeHtml(getVaultQualityLabel(entry))}</span>
        ${entry.stackable ? `<span>${formatNumber(entry.count || 0)} available</span>` : `<span>${formatNumber(entry.storedCount || 0)} stored · ${formatNumber(entry.equippedCount || 0)} equipped</span>`}
      </div>
      ${entry.stackable ? "" : `
        <span class="vault-level-badge hangar-tier-badge" aria-label="${escapeHtml(tier.label)} tier, Level ${escapeHtml(formatRomanLevel(level))}">
          ${renderHangarEquipmentTierPips(level, "compact")}
          <b>LV</b>
          <em>${formatRomanLevel(level)}</em>
        </span>
      `}
      ${entry.stackable ? `<span class="vault-card-count">x${formatNumber(entry.count)}</span>` : ""}
    `;

    grid.appendChild(button);
  });
}

function getVaultEntryEquippedLocations(entry) {
  if (!entry || !["guns", "attachments"].includes(entry.categoryKey)) return [];
  const locations = [];
  Object.entries(shipLoadouts || {}).forEach(([shipId, loadout]) => {
    const list = loadout?.[entry.categoryKey] || [];
    list.forEach((item, index) => {
      if (getEquipmentKey(item) !== entry.key || getEquipmentQuality(item) !== entry.quality || getEquipmentLevel(item) !== entry.level) return;
      locations.push({
        shipId,
        categoryKey: entry.categoryKey,
        index,
        shipName: SHIPS[shipId]?.name || shipId,
        slotLabel: `${entry.categoryKey === "guns" ? "Weapon" : "Attachment"} ${String(index + 1).padStart(2, "0")}`
      });
    });
  });
  return locations;
}

function viewVaultEntryInLoadout(groupKey) {
  const entry = buildVaultEntries().find(item => item.groupKey === groupKey);
  const location = getVaultEntryEquippedLocations(entry)[0];
  if (!location) return;
  selectedHangarShipId = location.shipId;
  selectedFleetShipId = location.shipId;
  showHangarSection("overview");
  selectEquippedLoadoutVaultItem(location.categoryKey, location.index);
}

function renderVaultDetail() {
  const panel = document.getElementById("vaultDetailPanel");
  if (!panel) return;

  const entry = getSelectedVaultEntry();
  if (!entry) {
    panel.innerHTML = `<div class="vault-empty-state">Select an owned item from the vault.</div>`;
    return;
  }

  const infoStats = getVaultEntryStats(entry);
  const level = Math.max(1, Number(entry.level || 1));
  const tier = getHangarEquipmentTier(level);
  const tierClass = entry.stackable ? "" : `item-rarity-frame forge-tier-scope ${getHangarEquipmentTierClass(level)} ${getItemRarityClass(level)}`;
  const locations = getVaultEntryEquippedLocations(entry);
  const locationSummary = locations.length
    ? `${locations[0].shipName} · ${locations[0].slotLabel}${locations.length > 1 ? ` · +${locations.length - 1} more` : ""}`
    : "Not currently equipped";

  panel.innerHTML = `
    <div class="vault-item-detail-shell ${entry.stackable ? "resource-detail" : "gear-detail"} quality-${entry.quality} ${tierClass}" ${entry.stackable ? "" : `data-level="${escapeHtml(level)}" data-tier="${escapeHtml(tier.key)}" data-rarity="${escapeHtml(tier.key)}"`}>
      <div class="vault-item-preview item-rarity-preview">
        <div class="vault-item-preview-glow"></div>
        <div class="exchange-hero-ring"></div>
        ${renderQualityFx(entry.quality, { src: entry.icon, alt: entry.name, size: "feature" })}
      </div>

      <div class="vault-item-identity">
        <div>
          <h4>${entry.name}</h4>
          <p>${entry.category} / <strong class="quality-${entry.quality}">${getVaultQualityLabel(entry)}</strong></p>
        </div>
        ${entry.stackable ? "" : `
          <span class="hangar-tier-detail-badge item-rarity-badge" aria-label="${escapeHtml(tier.label)} tier, Level ${escapeHtml(formatRomanLevel(level))}">
            ${renderHangarEquipmentTierPips(level, "compact")}
            <strong>${escapeHtml(tier.label)}</strong>
            <b>LEVEL ${formatRomanLevel(level)}</b>
          </span>
        `}
      </div>

      <div class="vault-item-description">${getVaultEntryDescription(entry)}</div>

      ${entry.stackable ? "" : `
        <div class="vault-equipped-location">
          <span>Equipped location</span>
          <strong>${escapeHtml(locationSummary)}</strong>
          ${locations.length ? `<button type="button" onclick="viewVaultEntryInLoadout('${escapeHtml(entry.groupKey)}')">View in Loadout</button>` : ""}
        </div>
      `}

      ${entry.stackable ? `
        <div class="vault-resource-use">
          <span>Primary use</span>
          <strong>${entry.key === "lupenShards" ? "Raise equipment levels" : "Advance item quality"}</strong>
          <button type="button" onclick="openUpgradeForgeFromVault('${escapeHtml(entry.groupKey)}')">Open Forge</button>
        </div>
      ` : ""}

      <div class="vault-item-stat-grid">
        ${infoStats.map(stat => `
          <div class="vault-item-stat-card ${stat.label.toLowerCase().replace(/\s+/g, "-")}-stat">
            <span>${stat.label}</span>
            <strong>${stat.value}</strong>
          </div>
        `).join("")}
      </div>

      <div class="vault-item-note">Grouped by item, quality and level.</div>

      <div class="vault-item-note vault-passive-note">Manage equipment from Loadout, Store, or Forge.</div>
    </div>
  `;
}

function getVaultItemId(entry) {
  if (!entry) return "";
  if (entry.categoryKey === "guns") return `gun:${entry.key}`;
  if (entry.categoryKey === "attachments") return `attachment:${entry.key}`;
  return "";
}

function canEquipVaultEntry(entry) {
  if (!entry || !["guns", "attachments"].includes(entry.categoryKey)) return false;
  if (Number(entry.storedCount || 0) <= 0) return false;
  const unlock = getEquipmentUnlockStatus(entry.categoryKey, entry.key);
  if (!unlock.unlocked) return false;
  const loadout = getShipLoadout(selectedHangarShipId);
  const list = entry.categoryKey === "guns" ? (loadout.guns || []) : (loadout.attachments || []);
  const limit = entry.categoryKey === "guns" ? getGunSlotLimit(selectedHangarShipId) : getAttachmentSlotLimit(selectedHangarShipId);
  const selectedIndex = Number(selectedLoadoutItemContext?.index);
  const selectedSlotIsValid = selectedLoadoutItemContext?.categoryKey === entry.categoryKey &&
    Number.isInteger(selectedIndex) && selectedIndex >= 0 && selectedIndex < limit;
  if (selectedSlotIsValid) return true;
  return list.filter(item => getEquipmentKey(item)).length < limit;
}

function findEquippedVaultEntryIndex(entry) {
  if (!entry || !["guns", "attachments"].includes(entry.categoryKey)) return -1;
  const loadout = getShipLoadout(selectedHangarShipId);
  const list = entry.categoryKey === "guns" ? loadout.guns : loadout.attachments;
  return (list || []).findIndex(item => getEquipmentKey(item) === entry.key && getEquipmentQuality(item) === entry.quality);
}

function getSelectedEquippedLoadoutContext() {
  const context = selectedVaultActionContext?.source === "equipped"
    ? selectedVaultActionContext
    : selectedLoadoutItemContext?.source === "equipped"
      ? selectedLoadoutItemContext
      : null;
  if (!context || !["guns", "attachments"].includes(context.categoryKey) || !context.key) return null;
  return context;
}

function getSelectedEquippedLoadoutEntry() {
  const context = getSelectedEquippedLoadoutContext();
  if (!context) return null;
  const definition = context.categoryKey === "guns" ? GUNS[context.key] : attachments[context.key];
  if (!definition) return null;
  const quality = context.quality || "standard";
  return {
    source: "equipped",
    categoryKey: context.categoryKey,
    key: context.key,
    quality,
    level: Math.max(1, Number(context.level || 1)),
    name: definition.name || context.key,
    icon: definition.image || "",
    slotIndex: Number(context.index),
    storedCount: 0,
    count: 0,
    groupKey: `${context.key}__${quality}`
  };
}

function getSelectedEquippedLoadoutIndex(entry) {
  const context = getSelectedEquippedLoadoutContext();
  if (!context || !entry || context.categoryKey !== entry.categoryKey || context.key !== entry.key) return -1;
  const quality = context.quality || "standard";
  if (quality !== entry.quality) return -1;
  const index = Number(context.index);
  if (!Number.isInteger(index) || index < 0) return -1;
  const loadout = getShipLoadout(selectedHangarShipId);
  const list = entry.categoryKey === "guns" ? loadout.guns : loadout.attachments;
  const equipped = list?.[index];
  if (getEquipmentKey(equipped) !== entry.key || getEquipmentQuality(equipped) !== entry.quality) return -1;
  return index;
}

function equipSelectedVaultItem() {
  const entry = getSelectedVaultEntry();
  if (!entry) return;
  if (!canEquipVaultEntry(entry)) {
    const unlock = getEquipmentUnlockStatus(entry.categoryKey, entry.key);
    showLoadoutEquipValidationMessage(unlock.locked ? "locked_item" : "item_unavailable", { ...entry, unlock });
    return;
  }
  equipLoadoutVaultEntry(entry);
  selectedVaultActionContext = null;
}

async function requestStagingLoadoutUnequip(entry) {
  const itemId = getVaultItemId(entry);
  const client = window.LupenMultiplayerClient;
  const status = client?.getStatus?.();
  if (!itemId || !status?.enabled || !status?.isConnected) {
    if (typeof addHudToast === "function") addHudToast("Equipment cannot be changed while the loadout service is offline.");
    return true;
  }
  if (typeof client.unequipStagingLoadoutItem !== "function") {
    blockLoadoutMutationInMultiplayerStaging();
    return true;
  }
  if (multiplayerStagingLoadoutUnequipPending) return true;
  multiplayerStagingLoadoutUnequipPending = true;
  client.unequipStagingLoadoutItem({
    itemId,
    quality: entry.quality || "standard",
    level: Math.max(1, Number(entry.level || 1)),
    slotIndex: Number.isInteger(Number(entry.slotIndex)) ? Number(entry.slotIndex) : null
  });
  if (typeof addHudToast === "function") addHudToast(`Unequipping ${entry.name}.`);
  (async () => {
    const latest = await waitForMultiplayerStagingResult(
      () => client.getStatus?.().lastStagingLoadoutEquip,
      result => result?.itemId === itemId && result?.operation === "unequip"
    );
    multiplayerStagingLoadoutUnequipPending = false;
    if (latest?.itemId === itemId && latest.applied && latest.operation === "unequip") {
      const message = latest.inventoryWritten
        ? `${latest.name || entry.name} unequipped and returned to the vault.`
        : `${latest.name || entry.name} unequipped. Available ${formatNumber(latest.ownedAfter ?? 1)}.`;
      if (typeof addHudToast === "function") addHudToast(message);
      if (typeof addActivityLog === "function") addActivityLog(message);
      applyStagingLoadoutResultToLocalState(latest);
      reconcileMissionProgressAfterStagingLoadoutResult(latest);
      if (typeof syncMultiplayerPresence === "function") syncMultiplayerPresence("staging_loadout_unequipped");
    } else if (latest?.itemId === itemId) {
      const reason = latest.userReason || latest.blockReason || latest.reason || "loadout unavailable";
      if (typeof addHudToast === "function") addHudToast(`Unequip blocked: ${reason}`);
      if (typeof addActivityLog === "function") addActivityLog(`Unequip blocked: ${reason}`);
    }
    selectedVaultActionContext = null;
    selectedLoadoutItemContext = null;
    renderHangar();
  })();
  return true;
}

function unequipSelectedVaultItem() {
  const entry = getSelectedEquippedLoadoutEntry() || getSelectedVaultEntry();
  if (!entry || !["guns", "attachments"].includes(entry.categoryKey)) return;
  if (isMultiplayerStagingStoreActive()) {
    requestStagingLoadoutUnequip(entry);
    return;
  }
  const selectedIndex = getSelectedEquippedLoadoutIndex(entry);
  const index = selectedIndex >= 0 ? selectedIndex : findEquippedVaultEntryIndex(entry);
  if (index < 0) return;
  selectedVaultActionContext = null;
  selectedLoadoutSlotCategory = entry.categoryKey;
  selectedLoadoutItemContext = {
    source: "slot",
    categoryKey: entry.categoryKey,
    index,
    key: "",
    quality: "standard",
    level: 1
  };
  if (entry.categoryKey === "guns") {
    removeGun(index);
  } else {
    removeAttachment(index);
  }
}

function selectAvailableLoadoutItem(categoryKey, entry) {
  if (!entry || !["guns", "attachments"].includes(categoryKey)) return;
  selectedLoadoutStatusMessage = "";
  const currentIndex = selectedLoadoutItemContext?.categoryKey === categoryKey
    ? Number(selectedLoadoutItemContext.index || 0)
    : 0;
  selectedLoadoutSlotCategory = categoryKey;
  selectedLoadoutVaultFilter = categoryKey;
  selectedVaultActionContext = null;
  selectedLoadoutItemContext = {
    source: "available",
    inventorySource: entry.source || "owned",
    categoryKey,
    index: Number.isInteger(currentIndex) && currentIndex >= 0 ? currentIndex : 0,
    key: entry.key,
    baseId: entry.baseId || entry.key,
    inventoryId: entry.inventoryId || "",
    groupKey: entry.groupKey || "",
    quality: entry.quality || "standard",
    level: Math.max(1, Number(entry.level || 1))
  };
  renderInstalledGuns();
  renderInstalledAttachments();
  renderGunInventory();
  renderLoadoutItemDetail();
}

function getCurrentShipEquippedCount(key, quality, categoryKey) {
  const loadout = getShipLoadout(selectedHangarShipId);
  const list = categoryKey === "guns" ? loadout.guns : loadout.attachments;
  return (list || []).filter(item => getEquipmentKey(item) === key && getEquipmentQuality(item) === quality).length;
}

function getAvailableLoadoutEntryCount(key, quality, categoryKey, level = null) {
  return getInventoryEntriesForCategory(categoryKey)
    .filter(entry => entry.key === key &&
      entry.quality === quality &&
      (level === null || Number(entry.level || 1) === Number(level || 1)))
    .reduce((sum, entry) => sum + Number(entry.count || 0), 0);
}

function getLoadoutDetailDefinition(context) {
  if (!context) return null;
  const isGun = context.categoryKey === "guns";
  const definition = isGun ? GUNS[context.key] : attachments[context.key];
  if (!definition) return null;
  const quality = context.quality || "standard";
  const level = Math.max(1, Number(context.level || 1));
  const equippedCount = getCurrentShipEquippedCount(context.key, quality, context.categoryKey);
  const availableCount = getAvailableLoadoutEntryCount(context.key, quality, context.categoryKey, level);
  const unlock = getEquipmentUnlockStatus(context.categoryKey, context.key);
  return {
    key: context.key,
    baseId: context.baseId || context.key,
    inventoryId: context.inventoryId || "",
    groupKey: context.groupKey || "",
    quality,
    categoryKey: context.categoryKey,
    source: context.source || "available",
    inventorySource: context.inventorySource || "owned",
    level,
    name: definition.name,
    icon: definition.image,
    typeLabel: isGun ? "Gun" : "Attachment",
    equippedCount,
    availableCount,
    ownedCount: equippedCount + availableCount,
    unlock,
    stats: isGun
      ? getWeaponPurchaseStatRows(definition, quality)
      : getAttachmentPurchaseStatRows({ key: context.key }, quality)
  };
}

function shouldLogLoadoutDebug() {
  try {
    const params = new URLSearchParams(window.location.search || "");
    return params.get("debug") === "1" || params.get("mp") === "staging" || Boolean(window.LUPEN_DEBUG_LOADOUT);
  } catch (_err) {
    return Boolean(window.LUPEN_DEBUG_LOADOUT);
  }
}

function logLoadoutEquipValidation(reason, detail = {}) {
  if (!shouldLogLoadoutDebug()) return;
  const selected = selectedLoadoutItemContext || {};
  const selectedCategory = selected.categoryKey === "attachments" ? "attachments" : "guns";
  const availableCount = detail.availableCount ?? (
    selected.key ? getAvailableLoadoutEntryCount(selected.key, selected.quality || "standard", selectedCategory, selected.level || 1) : 0
  );
  const payload = {
    equipValidationReason: reason,
    selectedShipId: selectedHangarShipId,
    selectedSlotType: selectedCategory === "guns" ? "weapon" : "attachment",
    selectedSlotIndex: Number(selected.index ?? -1),
    selectedItemId: detail.itemId || (selectedCategory === "guns" ? `gun:${selected.key || ""}` : `attachment:${selected.key || ""}`),
    selectedItemInstanceId: detail.inventoryId ?? selected.inventoryId ?? "",
    selectedItemBaseId: detail.baseId || selected.baseId || selected.key || "",
    selectedItemCategory: selectedCategory,
    selectedItemQuality: detail.quality || selected.quality || "standard",
    selectedItemLevel: Number(detail.level || selected.level || 1),
    itemAvailableCount: Number(availableCount || 0),
    shipWeaponSlots: getGunSlotLimit(selectedHangarShipId),
    shipAttachmentSlots: getAttachmentSlotLimit(selectedHangarShipId)
  };
  console.debug("[loadout:equip]", payload);
}

function getLoadoutEquipValidationMessage(reason, detail = {}) {
  const categoryKey = detail.categoryKey || selectedLoadoutItemContext?.categoryKey || selectedLoadoutSlotCategory;
  const isWeapon = categoryKey !== "attachments";
  if (reason === "missing_selected_item") return "Select a compatible item before equipping.";
  if (reason === "item_unavailable" || reason === "inventory_item_missing") return "That item is no longer available in the vault.";
  if (reason === "invalid_category") return "That item cannot be equipped in this slot.";
  if (reason === "locked_item") return detail.unlock?.message || "Reach the required Combat Level to equip this.";
  if (reason === "slot_occupied") return `Unequip ${getSelectedLoadoutSlotLabel()} before fitting another item.`;
  if (reason === "weapon_slot_unsupported") return "This ship has no empty weapon slots for that item.";
  if (reason === "attachment_slot_unsupported") return "This ship has no empty attachment slots for that item.";
  return isWeapon ? "That weapon cannot be equipped on this ship." : "That attachment cannot be equipped on this ship.";
}

function showLoadoutEquipValidationMessage(reason, detail = {}) {
  logLoadoutEquipValidation(reason, detail);
  const message = getLoadoutEquipValidationMessage(reason, detail);
  selectedLoadoutStatusMessage = message;
  renderLoadoutItemDetail();
  if (typeof addHudToast === "function") addHudToast(message);
  else if (typeof alert === "function") alert(message);
}

function renderLoadoutItemDetail() {
  const panel = document.getElementById("loadoutItemDetailPanel");
  if (!panel) return;

  ensureSelectedLoadoutSlot();
  const context = selectedLoadoutItemContext || {};
  const categoryKey = context.categoryKey === "attachments" ? "attachments" : "guns";
  const index = Math.max(0, Number(context.index || 0));
  const loadout = getShipLoadout(selectedHangarShipId);
  const list = categoryKey === "guns" ? (loadout.guns || []) : (loadout.attachments || []);
  const currentEntry = list[index];
  const currentKey = getEquipmentKey(currentEntry);
  const currentDetail = currentKey ? getLoadoutDetailDefinition({
    source: "equipped",
    categoryKey,
    index,
    key: currentKey,
    quality: getEquipmentQuality(currentEntry),
    level: getEquipmentLevel(currentEntry)
  }) : null;
  const slotLabel = getSelectedLoadoutSlotLabel();

  if (!currentDetail) {
    panel.innerHTML = `
      <div class="loadout-selected-empty">
        <strong>Empty ${escapeHtml(slotLabel)}</strong>
        <span>Choose an item from your Vault below.</span>
        ${selectedLoadoutStatusMessage ? `<small class="loadout-detail-inline-status">${escapeHtml(selectedLoadoutStatusMessage)}</small>` : ""}
      </div>
    `;
    updateLoadoutVaultChrome();
    return;
  }

  const tier = getHangarEquipmentTier(currentDetail.level);
  panel.innerHTML = `
    <div class="loadout-selected-item-card item-rarity-frame quality-${escapeHtml(currentDetail.quality)} forge-tier-scope ${getHangarEquipmentTierClass(currentDetail.level)} ${getItemRarityClass(currentDetail.level)}" data-rarity="${escapeHtml(tier.key)}">
      <div class="loadout-selected-item-art item-rarity-art">
        ${renderQualityFx(currentDetail.quality, { src: currentDetail.icon, alt: currentDetail.name, size: "small" })}
      </div>
      <div class="loadout-selected-item-copy">
        <span>Selected · ${escapeHtml(slotLabel)}</span>
        <strong>${escapeHtml(currentDetail.name)}</strong>
        <small>${currentDetail.quality !== "standard" ? `${escapeHtml(titleCaseQuality(currentDetail.quality))} · ` : ""}${escapeHtml(tier.label)} · ${escapeHtml(formatRomanLevel(currentDetail.level))}</small>
      </div>
      <div class="loadout-selected-item-stats">
        ${currentDetail.stats.slice(0, 3).map((row, statIndex) => `
          <div class="loadout-selected-stat loadout-selected-stat-${statIndex + 1}"><span>${escapeHtml(row.label)}</span><strong>${escapeHtml(row.value)}</strong></div>
        `).join("")}
      </div>
      <button type="button" class="loadout-unequip-action" onclick="unequipSelectedLoadoutSlotItem()">Unequip</button>
      ${selectedLoadoutStatusMessage ? `<small class="loadout-detail-inline-status">${escapeHtml(selectedLoadoutStatusMessage)}</small>` : ""}
    </div>
  `;
  updateLoadoutVaultChrome();
}

function equipSelectedLoadoutItem() {
  const detail = getLoadoutDetailDefinition(selectedLoadoutItemContext);
  if (!detail) {
    showLoadoutEquipValidationMessage("missing_selected_item");
    return;
  }
  if (detail.availableCount <= 0) {
    showLoadoutEquipValidationMessage("item_unavailable", detail);
    return;
  }
  if (detail.unlock?.locked) {
    showLoadoutEquipValidationMessage("locked_item", detail);
    return;
  }
  equipLoadoutVaultEntry({
    key: detail.key,
    baseId: detail.baseId,
    inventoryId: detail.inventoryId,
    groupKey: detail.groupKey,
    quality: detail.quality,
    level: detail.level,
    categoryKey: detail.categoryKey,
    name: detail.name,
    icon: detail.icon,
    source: selectedLoadoutItemContext?.inventorySource || "owned"
  });
}

function unequipSelectedLoadoutItem() {
  const detail = getLoadoutDetailDefinition(selectedLoadoutItemContext);
  if (!detail || detail.equippedCount <= 0) return;
  const selectedIndex = selectedLoadoutItemContext?.source === "equipped" &&
    selectedLoadoutItemContext.categoryKey === detail.categoryKey &&
    selectedLoadoutItemContext.key === detail.key &&
    (selectedLoadoutItemContext.quality || "standard") === detail.quality
    ? Number(selectedLoadoutItemContext.index)
    : -1;
  selectedVaultGroupKey = `${detail.key}__${detail.quality}`;
  selectedVaultActionContext = {
    source: "equipped",
    categoryKey: detail.categoryKey,
    index: Number.isInteger(selectedIndex) && selectedIndex >= 0 ? selectedIndex : findEquippedVaultEntryIndex(detail),
    key: detail.key,
    quality: detail.quality,
    level: detail.level
  };
  unequipSelectedVaultItem();
}

function unequipSelectedLoadoutSlotItem() {
  ensureSelectedLoadoutSlot();
  const categoryKey = selectedLoadoutItemContext?.categoryKey === "attachments" ? "attachments" : "guns";
  const index = Number(selectedLoadoutItemContext?.index);
  const limit = categoryKey === "guns" ? getGunSlotLimit(selectedHangarShipId) : getAttachmentSlotLimit(selectedHangarShipId);
  if (!Number.isInteger(index) || index < 0 || index >= limit) return;
  const loadout = getShipLoadout(selectedHangarShipId);
  const list = categoryKey === "guns" ? (loadout.guns || []) : (loadout.attachments || []);
  const currentEntry = list[index];
  const key = getEquipmentKey(currentEntry);
  if (!key) return;
  selectedLoadoutStatusMessage = "";
  if (isMultiplayerStagingStoreActive()) {
    const definition = categoryKey === "guns" ? GUNS[key] : attachments[key];
    requestStagingLoadoutUnequip({
      source: "equipped",
      categoryKey,
      key,
      quality: getEquipmentQuality(currentEntry),
      level: getEquipmentLevel(currentEntry),
      name: definition?.name || key,
      slotIndex: index
    });
    return;
  }
  returnLoadoutEntryToVault(currentEntry, categoryKey);
  list[index] = null;
  selectedLoadoutItemContext = {
    source: "slot",
    categoryKey,
    index,
    key: "",
    quality: "standard",
    level: 1
  };
  selectedVaultActionContext = null;

  if (categoryKey === "guns" && engageTimer && selectedHangarShipId === currentShipId) {
    clearInterval(engageTimer);
    engageTimer = null;
  }
  if (selectedHangarShipId === currentShipId) applyShipStats(true);
  renderHangar();
  showHangarSection("overview");
  saveGame();
}

function renderHangarVault() {
  const title = document.getElementById("hangarShipTitle");
  const subtitle = document.getElementById("hangarShipSubtitle");
  if (title) title.textContent = "Station Vault";
  if (subtitle) subtitle.textContent = "Owned ship gear and upgrade cores";

  ensureVaultSelection();
  renderVaultFilters();
  renderVaultCatalog();
  renderVaultDetail();
}

