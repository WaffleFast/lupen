function renderHangarEditor() {
  if (!document.getElementById("shipStats")) return;
  const ship = SHIPS[selectedHangarShipId] || getCurrentShip();
  const stats = getShipStats(selectedHangarShipId);
  const loadout = getShipLoadout(selectedHangarShipId);
  const weapon = getEquippedWeapon(selectedHangarShipId);

  const title = document.getElementById("shipEditorTitle");
  if (title) title.textContent = `Edit ${ship.name}`;

  document.getElementById("hangarShipTitle").textContent = ship.name;
  document.getElementById("hangarShipImage").src = typeof getShipAsset === "function" ? getShipAsset(ship.id, "master") : ship.image;
  document.getElementById("hangarShipImage").alt = ship.name;

  document.getElementById("shipStats").innerHTML = `
    <div><strong>Status:</strong> ${currentShipId === selectedHangarShipId ? "Equipped" : "Owned"}</div>
    <div><strong>Attachment Slots:</strong> ${countEquippedAttachments(selectedHangarShipId)} / ${getAttachmentSlotLimit(selectedHangarShipId)}</div>
    <div><strong>Gun Slots:</strong> ${countEquippedGuns(selectedHangarShipId)} / ${getGunSlotLimit(selectedHangarShipId)}</div>
    <div><strong>Cargo:</strong> ${formatNumber(stats.cargo)}</div>
    <div><strong>Hull:</strong> ${formatNumber(stats.hull)}</div>
    <div><strong>Shield:</strong> ${formatNumber(stats.shield)}</div>
    <div><strong>Armor:</strong> ${formatNumber(stats.armor)}</div>
    <div><strong>Jump Recharge:</strong> ${formatNumber(stats.jumpRecharge)}</div>
    <div><strong>Evasion:</strong> ${formatEvasion(stats.evasion)}</div>
    <div><strong>Active Weapon:</strong> ${weapon.name}</div>
    <div><strong>Shield Damage:</strong> ${formatNumber(weapon.damageLayers.shield)}</div>
    <div><strong>Armor Damage:</strong> ${formatNumber(weapon.damageLayers.armor)}</div>
    <div><strong>Hull Damage:</strong> ${formatNumber(weapon.damageLayers.hull)}</div>
    <div><strong>Fire Rate:</strong> ${weapon.fireRate.toFixed(1)}/s</div>
    <div><strong>Credits:</strong> ${formatNumber(credits)}</div>
    ${renderRepairSummary(selectedHangarShipId)}
  `;

  renderInstalledAttachments();
  renderInstalledGuns();
  renderAttachmentInventory();
  renderGunInventory();
}


function setSlotRailDensity(box, limit) {
  if (!box) return;
  const isSpacious = limit <= 4;
  const columns = isSpacious
    ? Math.max(1, limit)
    : limit <= 6
      ? 3
      : 5;
  const rows = Math.max(1, Math.ceil(limit / columns));
  const columnTemplate = isSpacious && limit <= 3
    ? `repeat(${columns}, minmax(180px, 250px))`
    : `repeat(${columns}, minmax(0, 1fr))`;
  box.style.setProperty("--loadout-slot-columns", String(columns));
  box.style.setProperty("grid-template-columns", columnTemplate, "important");
  box.style.setProperty("grid-template-rows", `repeat(${rows}, minmax(0, 1fr))`, "important");
  box.classList.toggle("spacious-slots", isSpacious);
  box.classList.toggle("compact-slots", limit >= 5 && limit <= 10);
  box.classList.toggle("dense-slots", limit >= 11);
  box.classList.toggle("many-slots", limit >= 8);
  box.classList.toggle("very-many-slots", limit >= 14);
  box.dataset.slotCount = String(limit);
}

function updateLoadoutSlotSummaries() {
  const loadout = getShipLoadout(selectedHangarShipId);
  const gunLimit = getGunSlotLimit(selectedHangarShipId);
  const attachmentLimit = getAttachmentSlotLimit(selectedHangarShipId);
  const gunCount = loadout.guns.filter(Boolean).length;
  const attachmentCount = loadout.attachments.filter(Boolean).length;
  const gunText = `${gunCount} / ${gunLimit} EQUIPPED`;
  const attachmentText = `${attachmentCount} / ${attachmentLimit} EQUIPPED`;
  const gunToggleText = `Weapons ${gunCount}/${gunLimit}`;
  const attachmentToggleText = `Attachments ${attachmentCount}/${attachmentLimit}`;
  const gunMirrorText = `${gunCount}/${gunLimit}`;
  const attachmentMirrorText = `${attachmentCount}/${attachmentLimit}`;
  const fittedTotal = gunCount + attachmentCount;
  const slotTotal = gunLimit + attachmentLimit;
  const activeLimit = selectedLoadoutSlotCategory === "attachments" ? attachmentLimit : gunLimit;
  const overviewSection = document.getElementById("hangarOverviewSection");
  const loadoutWorkspace = overviewSection?.querySelector(".adaptive-loadout-workspace");
  const density = activeLimit <= 4 ? "spacious" : activeLimit <= 10 ? "compact" : "dense";

  [overviewSection, loadoutWorkspace].forEach(node => {
    if (!node) return;
    node.classList.remove("loadout-density-spacious", "loadout-density-compact", "loadout-density-dense");
    node.classList.add(`loadout-density-${density}`);
    node.dataset.activeSlotCount = String(activeLimit);
  });

  const summaries = {
    gunSlotSummary: gunText,
    gunSlotSummaryMirror: gunMirrorText,
    attachmentSlotSummary: attachmentText,
    attachmentSlotSummaryMirror: attachmentMirrorText
  };

  Object.entries(summaries).forEach(([id, text]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = text;
  });

  const fittedSummary = document.getElementById("loadoutFittedSummary");
  if (fittedSummary) fittedSummary.textContent = `${fittedTotal} / ${slotTotal} slots fitted`;

  const toggleButtons = {
    loadoutCategoryWeapons: { categoryKey: "guns", text: gunToggleText },
    loadoutCategoryAttachments: { categoryKey: "attachments", text: attachmentToggleText }
  };

  Object.entries(toggleButtons).forEach(([id, config]) => {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = config.text;
    node.classList.toggle("active", selectedLoadoutSlotCategory === config.categoryKey);
    node.setAttribute("aria-selected", selectedLoadoutSlotCategory === config.categoryKey ? "true" : "false");
  });

  const pipSummaries = {
    gunSlotPipsMirror: renderSlotPips(gunLimit, gunCount),
    attachmentSlotPipsMirror: renderSlotPips(attachmentLimit, attachmentCount)
  };

  Object.entries(pipSummaries).forEach(([id, html]) => {
    const node = document.getElementById(id);
    if (node) node.innerHTML = html;
  });
}


function getEquippedTooltipEntry(key, quality, categoryKey, level = 1) {
  const isGun = categoryKey === "guns";
  const definition = isGun ? GUNS[key] : attachments[key];
  if (!definition) return null;

  return {
    key,
    quality: quality || "standard",
    level: Math.max(1, Number(level || 1)),
    count: 1,
    name: definition.name,
    icon: definition.image
  };
}

function getSelectedLoadoutSlotLabel() {
  const categoryKey = selectedLoadoutItemContext?.categoryKey === "attachments" ? "attachments" : "guns";
  if (!selectedLoadoutSlotExplicitlyChosen && selectedLoadoutItemContext?.source !== "equipped") {
    return categoryKey === "guns" ? "Next Empty Weapon Slot" : "Next Empty Attachment Slot";
  }
  const index = Math.max(0, Number(selectedLoadoutItemContext?.index || 0));
  return `${categoryKey === "guns" ? "Weapon" : "Attachment"} ${String(index + 1).padStart(2, "0")}`;
}

function isSelectedLoadoutSlotOccupied(categoryKey = selectedLoadoutItemContext?.categoryKey) {
  if (!selectedLoadoutSlotExplicitlyChosen) return false;
  const normalizedCategory = categoryKey === "attachments" ? "attachments" : "guns";
  if (selectedLoadoutItemContext?.categoryKey !== normalizedCategory) return false;
  const index = Number(selectedLoadoutItemContext?.index);
  if (!Number.isInteger(index) || index < 0) return false;
  const loadout = getShipLoadout(selectedHangarShipId);
  const list = normalizedCategory === "guns" ? (loadout.guns || []) : (loadout.attachments || []);
  return Boolean(getEquipmentKey(list[index]));
}

function ensureSelectedLoadoutSlot() {
  const current = selectedLoadoutItemContext;
  const validCategory = current?.categoryKey === "guns" || current?.categoryKey === "attachments";
  const limit = validCategory
    ? (current.categoryKey === "guns" ? getGunSlotLimit(selectedHangarShipId) : getAttachmentSlotLimit(selectedHangarShipId))
    : 0;
  const index = Number(current?.index);
  if (validCategory && Number.isInteger(index) && index >= 0 && index < limit) {
    selectedLoadoutSlotCategory = current.categoryKey;
    if (current.source !== "available") {
      const loadout = getShipLoadout(selectedHangarShipId);
      const list = current.categoryKey === "guns" ? loadout.guns : loadout.attachments;
      const entry = list?.[index];
      const key = getEquipmentKey(entry);
      selectedLoadoutItemContext = {
        source: key ? "equipped" : "slot",
        categoryKey: current.categoryKey,
        index,
        key,
        quality: getEquipmentQuality(entry),
        level: getEquipmentLevel(entry)
      };
    }
    return;
  }

  const categoryKey = selectedLoadoutSlotCategory === "attachments" ? "attachments" : "guns";
  selectedLoadoutItemContext = {
    source: "slot",
    categoryKey,
    index: 0,
    key: "",
    quality: "standard"
  };
  selectedLoadoutSlotExplicitlyChosen = false;
}

function setLoadoutSlotCategory(categoryKey) {
  selectedLoadoutStatusMessage = "";
  selectedLoadoutSlotCategory = categoryKey === "attachments" ? "attachments" : "guns";
  selectedLoadoutVaultFilter = selectedLoadoutSlotCategory;
  const limit = selectedLoadoutSlotCategory === "guns" ? getGunSlotLimit(selectedHangarShipId) : getAttachmentSlotLimit(selectedHangarShipId);
  const currentIndex = selectedLoadoutItemContext?.categoryKey === selectedLoadoutSlotCategory
    ? Number(selectedLoadoutItemContext.index || 0)
    : 0;
  selectedLoadoutItemContext = {
    source: "slot",
    categoryKey: selectedLoadoutSlotCategory,
    index: Math.min(Math.max(0, currentIndex), Math.max(0, limit - 1)),
    key: "",
    quality: "standard"
  };
  selectedVaultActionContext = null;
  selectedLoadoutSlotExplicitlyChosen = false;
  renderInstalledGuns();
  renderInstalledAttachments();
  renderGunInventory();
  renderLoadoutItemDetail();
  if (selectedLoadoutSlotCategory === "attachments") tutorialEvent("openedAttachmentLoadout");
}

function renderLoadoutSlotGrid(box, categoryKey) {
  if (!box) return;
  const loadout = getShipLoadout(selectedHangarShipId);
  const listName = categoryKey === "guns" ? "guns" : "attachments";
  const list = loadout[listName] || [];
  const limit = categoryKey === "guns" ? getGunSlotLimit(selectedHangarShipId) : getAttachmentSlotLimit(selectedHangarShipId);
  const definitionMap = categoryKey === "guns" ? GUNS : attachments;
  setSlotRailDensity(box, limit);
  box.closest(".loadout-slot-bank")?.classList.toggle("active", selectedLoadoutSlotCategory === categoryKey);

  box.innerHTML = "";

  for (let i = 0; i < limit; i++) {
    const entry = list[i];
    const key = getEquipmentKey(entry);
    const quality = getEquipmentQuality(entry);
    const level = getEquipmentLevel(entry);
    const tier = getHangarEquipmentTier(level);
    const item = definitionMap[key];
    const selected = selectedLoadoutSlotExplicitlyChosen &&
      selectedLoadoutItemContext?.categoryKey === categoryKey &&
      selectedLoadoutItemContext.index === i;

    const slot = document.createElement("button");
    const tierClass = item ? `forge-tier-scope ${getHangarEquipmentTierClass(level)}` : "";
    slot.className = `equipment-slot scalable-loadout-slot loadout-grid-slot ${item ? "filled" : "empty"} ${selected ? "selected" : ""} quality-${quality} ${tierClass}`;
    slot.dataset.slotIndex = String(i + 1).padStart(2, "0");
    if (item) {
      slot.dataset.level = String(level);
      slot.dataset.tier = tier.key;
      slot.setAttribute("aria-label", `${item.name}, ${tier.label} tier, Level ${formatRomanLevel(level)}, slot ${i + 1}`);
    }
    slot.onclick = () => selectEquippedLoadoutVaultItem(categoryKey, i);

    if (item) {
      const tooltipEntry = getEquippedTooltipEntry(key, quality, categoryKey, level);
      showHangarTooltip(slot, getEquipmentTooltipHtml(tooltipEntry, categoryKey));
      bindHangarEquipmentTooltip(slot);
    } else {
      slot.title = `Empty ${categoryKey === "guns" ? "weapon" : "attachment"} slot ${i + 1}`;
    }

    const slotNumber = String(i + 1).padStart(2, "0");
    const slotType = categoryKey === "guns" ? "Weapon" : "Attachment";
    const slotHeading = limit <= 4 ? `${slotType} ${slotNumber}` : slotNumber;
    slot.innerHTML = item
      ? `<span class="loadout-slot-number">${slotHeading}</span>
        ${renderQualityFx(quality, { src: item.image, alt: item.name, size: "slot" })}
        <span class="loadout-slot-copy">
          <strong>${escapeHtml(item.name)}</strong>
          <small class="loadout-slot-tier-badge" aria-label="${escapeHtml(tier.label)} tier, Level ${escapeHtml(formatRomanLevel(level))}">
            ${renderHangarEquipmentTierPips(level, "compact")}
            <b>${formatRomanLevel(level)}</b>
          </small>
        </span>`
      : `<span class="loadout-slot-number">${slotHeading}</span>
        <span class="slot-empty-plus" aria-hidden="true">+</span>
        <span class="slot-empty-label"><b>Empty ${slotType} ${slotNumber}</b><small>Select to equip</small></span>`;

    box.appendChild(slot);
  }
}


function renderInstalledAttachments() {
  const box = document.getElementById("installedAttachments");
  if (!box) return;

  ensureSelectedLoadoutSlot();
  updateLoadoutSlotSummaries();
  renderLoadoutSlotGrid(box, "attachments");
}

function renderInstalledGuns() {
  const box = document.getElementById("installedGuns");
  if (!box) return;

  ensureSelectedLoadoutSlot();
  updateLoadoutSlotSummaries();
  renderLoadoutSlotGrid(box, "guns");
}

function getInventoryEntriesForCategory(categoryKey) {
  ensureInventoryObjects();
  const grouped = new Map();

  function addEntry(key, quality, count, source, level = 1, inventoryId = "") {
    const definition = itemDefinitions[key];
    if (!definition || getItemCategoryKey(key) !== categoryKey || count <= 0) return;
    const safeLevel = Math.max(1, Number(level || 1));
    const groupKey = `${source}__${key}__${quality}__${safeLevel}`;
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        groupKey,
        source,
        key,
        quality,
        level: safeLevel,
        categoryKey,
        name: definition.name,
        icon: definition.icon,
        inventoryId: String(inventoryId || ""),
        count: 0
      });
    }
    if (!grouped.get(groupKey).inventoryId && inventoryId) grouped.get(groupKey).inventoryId = String(inventoryId);
    grouped.get(groupKey).count += count;
  }

  if (categoryKey === "attachments") {
    Object.entries(ownedAttachments || {}).forEach(([key, count]) => addEntry(key, "standard", count, "owned"));
  }

  if (categoryKey === "guns") {
    Object.entries(ownedGuns || {}).forEach(([key, count]) => addEntry(key, "standard", count, "owned"));
  }

  (inventoryItems || []).forEach(item => {
    if (!item || !itemDefinitions[item.key]) return;
    addEntry(item.key, item.key === "lupenCore" ? LUPEN_CORE_QUALITY : (item.quality || "standard"), 1, "inventory", item.level || 1, item.id || "");
  });

  return Array.from(grouped.values()).sort((a, b) => {
    const qualityDelta = ITEM_QUALITY_ORDER.indexOf(b.quality) - ITEM_QUALITY_ORDER.indexOf(a.quality);
    if (qualityDelta !== 0) return qualityDelta;
    return a.name.localeCompare(b.name);
  });
}

function removeOneInventoryItem(key, quality, level = null, inventoryId = "") {
  const safeInventoryId = String(inventoryId || "");
  const index = inventoryItems.findIndex(item => safeInventoryId
    ? String(item?.id || "") === safeInventoryId && item.key === key
    : item.key === key &&
    item.quality === quality &&
    (level === null || Math.max(1, Number(item.level || 1)) === Math.max(1, Number(level || 1))));
  if (index === -1) return null;
  const [removed] = inventoryItems.splice(index, 1);
  return removed;
}

function updateEquipmentInventoryCount() {
  const total = getInventoryEntriesForCategory("guns").reduce((sum, entry) => sum + entry.count, 0)
    + getInventoryEntriesForCategory("attachments").reduce((sum, entry) => sum + entry.count, 0);
  const el = document.getElementById("equipmentInventoryCount");
  if (el) el.textContent = `${formatNumber(total)} / ${formatNumber(LOADOUT_VAULT_CAPACITY)}`;
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getEquipmentTooltipHtml(entry, categoryKey) {
  const quality = entry.quality || "standard";
  const qualityLabel = titleCaseQuality(quality);
  const level = Math.max(1, Number(entry.level || 1));
  const tier = getHangarEquipmentTier(level);
  const qty = formatNumber(entry.count || 0);
  const isGun = categoryKey === "guns";
  const definition = isGun ? GUNS[entry.key] : attachments[entry.key];

  if (!definition) return "";

  const statRows = [];

  if (isGun) {
    statRows.push(...getWeaponPurchaseStatRows(definition, quality));
  } else {
    const effect = getScaledAttachmentEffect(entry.key, quality);
    Object.entries(effect).forEach(([effectKey, value]) => {
      const label = effectKey === "jumpRecharge"
        ? "Jump"
        : effectKey === "evasion"
          ? "Evasion"
          : effectKey.charAt(0).toUpperCase() + effectKey.slice(1);
      const prefix = value >= 0 ? "+" : "";
      const suffix = effectKey === "evasion" ? "%" : "";
      statRows.push({ label, value: `${prefix}${formatNumber(Math.round(value))}${suffix}` });
    });
  }

  const statHtml = statRows.map(row => `
    <div class="hangar-tooltip-stat">
      <span>${escapeHtml(row.label)}</span>
      <strong>${escapeHtml(row.value)}</strong>
    </div>
  `).join("");

  return `
    <div class="hangar-tooltip-card quality-${escapeHtml(quality)}">
      <div class="hangar-tooltip-top">
        <img src="${escapeHtml(entry.icon || definition.image)}" alt="">
        <div>
          <div class="hangar-tooltip-name">${escapeHtml(entry.name || definition.name)}</div>
          <div class="hangar-tooltip-meta">${escapeHtml(tier.label)} · Level ${escapeHtml(formatRomanLevel(level))} / ${escapeHtml(qualityLabel)} / x${qty} owned</div>
        </div>
      </div>
      <div class="hangar-tooltip-stats">${statHtml}</div>
      <div class="hangar-tooltip-note">${escapeHtml(isGun ? (definition.description || "Weapon system") : getStoreAttachmentEffectText({ key: entry.key }, quality))}</div>
    </div>
  `;
}

function showHangarTooltip(button, html) {
  button.dataset.tooltip = html || "";
}

function normalizeQualityFxTier(quality = "standard") {
  const normalized = String(quality || "standard").toLowerCase();
  if (["standard", "refined", "advanced", "elite", "legendary", "godlike"].includes(normalized)) return normalized;
  if (normalized === "unique") return "refined";
  if (normalized === "core") return "godlike";
  return "standard";
}

function renderQualityFx(quality = "standard", options = {}) {
  const tier = normalizeQualityFxTier(quality);
  const src = escapeHtml(options.src || "");
  const alt = escapeHtml(options.alt || "");
  const size = escapeHtml(options.size || "card");
  const extraClass = options.extraClass ? ` ${escapeHtml(options.extraClass)}` : "";
  const bolts = Array.from({ length: 10 }, (_unused, index) => `<span class="quality-fx__bolt quality-fx__bolt--${index + 1}" aria-hidden="true"></span>`).join("");
  return `
    <span class="quality-fx quality-fx--${tier} quality-fx--${size}${extraClass}" data-quality-tier="${tier}">
      <span class="quality-fx__flare" aria-hidden="true"></span>
      <span class="quality-fx__storm quality-fx__storm--1" aria-hidden="true"></span>
      <span class="quality-fx__storm quality-fx__storm--2" aria-hidden="true"></span>
      <span class="quality-fx__storm quality-fx__storm--3" aria-hidden="true"></span>
      <span class="quality-fx__ring quality-fx__ring--1" aria-hidden="true"></span>
      <span class="quality-fx__ring quality-fx__ring--2" aria-hidden="true"></span>
      <span class="quality-fx__ring quality-fx__ring--3" aria-hidden="true"></span>
      ${bolts}
      <img class="quality-fx__item" src="${src}" alt="${alt}">
    </span>
  `;
}



function ensureHangarTooltip() {
  let tooltip = document.getElementById("hangarTooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "hangarTooltip";
    document.body.appendChild(tooltip);
  }
  return tooltip;
}

function hideHangarTooltip() {
  const tooltip = document.getElementById("hangarTooltip");
  if (tooltip) tooltip.classList.remove("visible");
}

function bindHangarEquipmentTooltip(btn) {
  const tooltip = ensureHangarTooltip();

  btn.addEventListener("mouseenter", () => {
    if (!btn.dataset.tooltip) return;
    tooltip.innerHTML = btn.dataset.tooltip;
    tooltip.classList.add("visible");
    positionHangarTooltip(btn, tooltip);
  });

  btn.addEventListener("mousemove", () => {
    if (!tooltip.classList.contains("visible")) return;
    positionHangarTooltip(btn, tooltip);
  });

  btn.addEventListener("mouseleave", () => {
    tooltip.classList.remove("visible");
  });

  btn.addEventListener("click", () => {
    tooltip.classList.remove("visible");
  });
}

function positionHangarTooltip(target, tooltip) {
  const rect = target.getBoundingClientRect();
  const tooltipWidth = 248;
  const viewportPadding = 12;
  let x = rect.left + rect.width / 2;
  x = Math.max(viewportPadding + tooltipWidth / 2, Math.min(window.innerWidth - viewportPadding - tooltipWidth / 2, x));

  let y = rect.top - 10;
  if (rect.top < 230) {
    y = rect.bottom + tooltip.offsetHeight + 18;
  }

  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function getAllLoadoutVaultEntries() {
  return [
    ...getInventoryEntriesForCategory("guns"),
    ...getInventoryEntriesForCategory("attachments")
  ];
}

function getFilteredLoadoutVaultEntries() {
  const selectedCategory = selectedLoadoutItemContext?.categoryKey;
  const filter = ["guns", "attachments"].includes(selectedLoadoutVaultFilter)
    ? selectedLoadoutVaultFilter
    : ["guns", "attachments"].includes(selectedCategory)
      ? selectedCategory
      : selectedLoadoutSlotCategory === "attachments" ? "attachments" : "guns";

  const search = selectedLoadoutVaultSearch.trim().toLowerCase();
  const quality = selectedLoadoutVaultQuality;

  return getAllLoadoutVaultEntries()
    .filter(entry => entry.categoryKey === filter)
    .filter(entry => quality === "all" || entry.quality === quality)
    .filter(entry => !search || `${entry.name} ${entry.key} ${entry.quality} ${getHangarEquipmentTier(entry.level).label}`.toLowerCase().includes(search))
    .sort((a, b) => {
      if (selectedLoadoutVaultSort === "name") return a.name.localeCompare(b.name);
      if (selectedLoadoutVaultSort === "quantity") return Number(b.count || 0) - Number(a.count || 0) || a.name.localeCompare(b.name);
      const qualityDelta = ITEM_QUALITY_ORDER.indexOf(b.quality) - ITEM_QUALITY_ORDER.indexOf(a.quality);
      if (qualityDelta !== 0) return qualityDelta;
      if (b.level !== a.level) return b.level - a.level;
      return a.name.localeCompare(b.name);
    });
}

function getLoadoutVaultEntryStatLine(entry) {
  if (!entry) return "";
  if (entry.categoryKey === "guns") {
    const gun = GUNS[entry.key];
    if (!gun) return "";
    return `Damage ${formatNumber(getWeaponPurchaseDamage(gun, entry.quality))} · ${getVaultFireRateLabel(gun)}`;
  }
  if (entry.categoryKey === "attachments") {
    const stat = getAttachmentPurchaseStatRows(entry, entry.quality)[0];
    return stat ? `${stat.label} ${stat.value}` : "Utility module";
  }
  return "";
}

function updateLoadoutVaultChrome() {
  const entries = getAllLoadoutVaultEntries();
  const total = entries.reduce((sum, entry) => sum + Number(entry.count || 0), 0);
  const countEl = document.getElementById("equipmentInventoryCount");
  if (countEl) countEl.textContent = `${formatNumber(total)} / ${formatNumber(LOADOUT_VAULT_CAPACITY)}`;

  const selectedSlotBar = document.getElementById("loadoutSelectedSlotBar");
  if (selectedSlotBar) {
    selectedSlotBar.textContent = selectedLoadoutSlotExplicitlyChosen
      ? `Selected Slot · ${getSelectedLoadoutSlotLabel()}`
      : "Auto Equip · First Empty Slot";
  }
  const isAttachmentSlot = selectedLoadoutItemContext?.categoryKey === "attachments";
  const vaultTitle = document.getElementById("loadoutVaultTitle");
  if (vaultTitle) vaultTitle.textContent = isAttachmentSlot ? "Available Attachments" : "Available Weapons";
  const vaultHint = document.getElementById("loadoutVaultHint");
  if (vaultHint) {
    vaultHint.textContent = selectedLoadoutSlotExplicitlyChosen
      ? `Choose stored gear for ${getSelectedLoadoutSlotLabel()}`
      : "Equip fills the first empty slot, or select a slot above";
  }

  const search = document.getElementById("loadoutVaultSearch");
  if (search && search.value !== selectedLoadoutVaultSearch) search.value = selectedLoadoutVaultSearch;

  const quality = document.getElementById("loadoutVaultQuality");
  if (quality && quality.value !== selectedLoadoutVaultQuality) quality.value = selectedLoadoutVaultQuality;

  const sort = document.getElementById("loadoutVaultSort");
  if (sort && sort.value !== selectedLoadoutVaultSort) sort.value = selectedLoadoutVaultSort;

  const categoryEntries = entries.filter(entry => entry.categoryKey === (isAttachmentSlot ? "attachments" : "guns"));
  const controls = document.querySelector("#hangarOverviewSection .loadout-vault-controls");
  if (controls) controls.classList.toggle("is-useful", categoryEntries.length > 4);
}

function setLoadoutVaultFilter(nextFilter) {
  setLoadoutSlotCategory(nextFilter === "attachments" ? "attachments" : "guns");
}

function setLoadoutVaultSearch(query) {
  selectedLoadoutVaultSearch = String(query || "");
  renderGunInventory();
}

function setLoadoutVaultQuality(nextQuality) {
  selectedLoadoutVaultQuality = nextQuality === "all" || ITEM_QUALITY_ORDER.includes(nextQuality) ? nextQuality : "all";
  renderGunInventory();
}

function setLoadoutVaultSort(nextSort) {
  selectedLoadoutVaultSort = ["quality", "name", "quantity"].includes(nextSort) ? nextSort : "quality";
  renderGunInventory();
}

function returnLoadoutEntryToVault(entry, categoryKey) {
  const key = getEquipmentKey(entry);
  if (!key) return;
  const quality = getEquipmentQuality(entry);
  const level = getEquipmentLevel(entry);
  if (quality === "standard" && level <= 1) {
    if (categoryKey === "guns") ownedGuns[key] = (ownedGuns[key] || 0) + 1;
    else ownedAttachments[key] = (ownedAttachments[key] || 0) + 1;
    return;
  }
  addInventoryItem({
    id: `item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    key,
    quality,
    level
  });
}

function consumeLoadoutVaultEntry(entry) {
  const quality = entry.quality || "standard";
  const level = Math.max(1, Number(entry.level || 1));
  if (entry.source === "owned" && quality === "standard" && level <= 1) {
    if (entry.categoryKey === "guns") {
      if ((ownedGuns[entry.key] || 0) <= 0) return null;
      ownedGuns[entry.key] -= 1;
    } else {
      if ((ownedAttachments[entry.key] || 0) <= 0) return null;
      ownedAttachments[entry.key] -= 1;
    }
    return makeLeveledLoadoutEntry(entry.key, quality, 1);
  }
  const removed = removeOneInventoryItem(entry.key, quality, level, entry.inventoryId || "");
  if (!removed) {
    showLoadoutEquipValidationMessage("inventory_item_missing", {
      inventoryId: entry.inventoryId || "",
      baseId: entry.baseId || entry.key,
      categoryKey: entry.categoryKey,
      quality,
      level,
      availableCount: entry.storedCount
    });
    return null;
  }
  return makeLeveledLoadoutEntry(entry.key, quality, Math.max(1, Number(removed.level || level)));
}

function equipLoadoutVaultEntry(entry) {
  if (!entry || !["guns", "attachments"].includes(entry.categoryKey)) {
    showLoadoutEquipValidationMessage("invalid_category", entry || {});
    return;
  }
  const unlock = getEquipmentUnlockStatus(entry.categoryKey, entry.key);
  if (!unlock.unlocked) {
    showLoadoutEquipValidationMessage("locked_item", { ...entry, unlock });
    return;
  }
  ensureSelectedLoadoutSlot();
  const selected = selectedLoadoutItemContext || {};
  const categoryKey = entry.categoryKey;
  const limit = categoryKey === "guns" ? getGunSlotLimit(selectedHangarShipId) : getAttachmentSlotLimit(selectedHangarShipId);
  const loadout = getShipLoadout(selectedHangarShipId);
  const list = categoryKey === "guns" ? loadout.guns : loadout.attachments;
  const explicitSlotSelected = selectedLoadoutSlotExplicitlyChosen &&
    selected.categoryKey === categoryKey &&
    Number.isInteger(Number(selected.index)) &&
    Number(selected.index) >= 0 &&
    Number(selected.index) < limit;
  let index = explicitSlotSelected ? Number(selected.index) : -1;

  if (!explicitSlotSelected) {
    const firstEmptyIndex = Array.from({ length: limit }, (_unused, slotIndex) => slotIndex)
      .find(slotIndex => !getEquipmentKey(list[slotIndex]));
    index = Number.isInteger(firstEmptyIndex) ? firstEmptyIndex : -1;
  }
  if (index < 0 || index >= limit) {
    showLoadoutEquipValidationMessage(categoryKey === "guns" ? "weapon_slot_unsupported" : "attachment_slot_unsupported", {
      ...entry,
      availableCount: entry.storedCount
    });
    return;
  }

  if (getEquipmentKey(list[index])) {
    showLoadoutEquipValidationMessage("slot_occupied", entry);
    return;
  }

  selectedLoadoutSlotExplicitlyChosen = false;

  if (isMultiplayerStagingStoreActive()) {
    if (getStagingStoreItemId({ kind: categoryKey === "guns" ? "gun" : "attachment", key: entry.key })) {
      selectedLoadoutItemContext = {
        source: "slot",
        categoryKey,
        index,
        key: "",
        quality: "standard",
        level: 1
      };
      requestStagingLoadoutEquip({
        kind: categoryKey === "guns" ? "gun" : "attachment",
        key: entry.key,
        name: entry.name,
        inventorySource: entry.source || "owned",
        inventoryItemId: entry.inventoryId || "",
        quality: entry.quality || "standard",
        level: Math.max(1, Number(entry.level || 1)),
        slotIndex: index
      });
      return;
    }
    blockLoadoutMutationInMultiplayerStaging();
    return;
  }

  const nextEntry = consumeLoadoutVaultEntry(entry);
  if (!nextEntry) return;
  selectedLoadoutStatusMessage = "";

  list[index] = nextEntry;

  selectedLoadoutItemContext = {
    source: "equipped",
    categoryKey,
    index,
    key: entry.key,
    quality: entry.quality || "standard",
    level: Math.max(1, Number(entry.level || 1))
  };

  if (selectedHangarShipId === currentShipId) applyShipStats(true);
  renderHangarOverview();
  tutorialEvent(categoryKey === "guns" ? "equippedItem" : "equippedAttachment");
  saveGame();
}


function renderAttachmentInventory() {
  const box = document.getElementById("attachmentInventory");
  if (box) box.innerHTML = "";
  updateLoadoutVaultChrome();
}

function renderLoadoutVaultSelectionAction() {
  const panel = document.getElementById("loadoutVaultSelectionAction");
  if (!panel) return;

  const context = selectedLoadoutItemContext;
  const detail = context?.source === "available" ? getLoadoutDetailDefinition(context) : null;
  if (!detail || detail.availableCount <= 0 || isSelectedLoadoutSlotOccupied(detail.categoryKey)) {
    panel.innerHTML = "";
    panel.classList.remove("visible");
    return;
  }

  const slotLabel = getSelectedLoadoutSlotLabel();
  const countLabel = `${formatNumber(detail.availableCount)} stored`;
  panel.classList.add("visible");
  panel.innerHTML = `
    <div class="loadout-vault-selection-copy">
      <span>Selected from Vault</span>
      <strong>${escapeHtml(detail.name)}</strong>
      <small>${escapeHtml(countLabel)} · ${escapeHtml(slotLabel)}</small>
    </div>
    <button type="button" class="loadout-vault-confirm-action" onclick="equipSelectedLoadoutItem()">
      Equip to ${escapeHtml(slotLabel)}
    </button>
  `;
}

function equipLoadoutVaultEntryDirect(entry) {
  if (!entry) return;
  selectedLoadoutStatusMessage = "";
  selectedLoadoutVaultFilter = entry.categoryKey;
  equipLoadoutVaultEntry(entry);
}

function renderGunInventory() {
  const box = document.getElementById("gunInventory");
  if (!box) return;

  const entries = getFilteredLoadoutVaultEntries();
  const selectedCategory = selectedLoadoutItemContext?.categoryKey;
  box.innerHTML = "";
  updateLoadoutVaultChrome();

  const results = document.getElementById("loadoutVaultResults");
  if (results) {
    const categoryLabel = selectedLoadoutSlotCategory === "attachments" ? "attachment" : "weapon";
    results.textContent = `${formatNumber(entries.length)} ${categoryLabel} variation${entries.length === 1 ? "" : "s"}`;
  }

  if (!entries.length) {
    const categoryLabel = selectedLoadoutItemContext?.categoryKey === "attachments" ? "attachments" : "weapons";
    const loadout = getShipLoadout(selectedHangarShipId);
    const equippedList = categoryLabel === "attachments" ? (loadout.attachments || []) : (loadout.guns || []);
    const equippedCount = equippedList.filter(entry => getEquipmentKey(entry)).length;
    box.innerHTML = `
      <div class="loadout-vault-empty">
        <strong>No stored ${categoryLabel}</strong>
        <span>${equippedCount > 0
          ? `Your equipped ${categoryLabel} are shown above. Unequip one to return it here.`
          : `Purchased and recovered ${categoryLabel} will appear here.`}</span>
      </div>
    `;
    renderLoadoutVaultSelectionAction();
    return;
  }

  entries.forEach(entry => {
    const compatible = selectedCategory === entry.categoryKey || !["guns", "attachments"].includes(selectedCategory);
    const unlock = getEquipmentUnlockStatus(entry.categoryKey, entry.key);
    const selectedSlotOccupied = isSelectedLoadoutSlotOccupied(entry.categoryKey);
    const stagingItemId = getStagingStoreItemId({
      kind: entry.categoryKey === "guns" ? "gun" : "attachment",
      key: entry.key
    });
    const equipPending = Boolean(stagingItemId && multiplayerStagingLoadoutEquipPendingItemId === stagingItemId);
    const level = Math.max(1, Number(entry.level || 1));
    const tier = getHangarEquipmentTier(level);
    const btn = document.createElement("article");
    const selected = selectedLoadoutItemContext?.source === "available" &&
      selectedLoadoutItemContext.categoryKey === entry.categoryKey &&
      selectedLoadoutItemContext.key === entry.key &&
      selectedLoadoutItemContext.quality === entry.quality &&
      Number(selectedLoadoutItemContext.level || 1) === Number(entry.level || 1);
    btn.className = `inventory-icon-card hangar-equipment-card loadout-vault-row quality-${entry.quality} forge-tier-scope ${getHangarEquipmentTierClass(level)} ${selected ? "selected" : ""} ${unlock.locked ? "progression-locked" : ""}`;
    btn.dataset.itemKey = entry.key;
    btn.dataset.itemType = entry.categoryKey === "guns" ? "gun" : "attachment";
    btn.dataset.level = String(level);
    btn.dataset.tier = tier.key;
    btn.tabIndex = compatible && entry.count > 0 ? 0 : -1;
    btn.setAttribute("role", "group");
    btn.setAttribute("aria-label", `${entry.name}, ${entry.count} stored`);
    btn.classList.toggle("unavailable", entry.count <= 0 || !compatible);
    btn.onclick = () => compatible && entry.count > 0 && selectAvailableLoadoutItem(entry.categoryKey, entry);
    btn.onkeydown = event => {
      if ((event.key === "Enter" || event.key === " ") && compatible && entry.count > 0) {
        event.preventDefault();
        selectAvailableLoadoutItem(entry.categoryKey, entry);
      }
    };

    btn.innerHTML = `
      ${renderQualityFx(entry.quality, { src: entry.icon, alt: entry.name, size: "row" })}
      <span class="loadout-vault-row-copy">
        <strong>${escapeHtml(entry.name)}</strong>
        <small>${escapeHtml(unlock.locked
          ? unlock.requirementLines.join(" / ")
          : `${entry.quality !== "standard" ? `${titleCaseQuality(entry.quality)} · ` : ""}${tier.label} · ${formatRomanLevel(level)}`)}</small>
      </span>
      <b class="loadout-vault-quantity">x${formatNumber(entry.count)} stored</b>
      ${unlock.locked ? `<b class="loadout-vault-lock">LOCK</b>` : `
        <span class="loadout-vault-tier-badge" aria-label="${escapeHtml(tier.label)} tier, Level ${escapeHtml(formatRomanLevel(level))}">
          ${renderHangarEquipmentTierPips(level, "compact")}
          <strong>${escapeHtml(tier.label)}</strong>
          <b>${formatRomanLevel(level)}</b>
        </span>
      `}
      <span class="loadout-vault-row-stats">
        ${(entry.categoryKey === "guns"
          ? getWeaponPurchaseStatRows(GUNS[entry.key], entry.quality)
          : getAttachmentPurchaseStatRows({ key: entry.key }, entry.quality)
        ).slice(0, 3).map(row => `<span><small>${escapeHtml(row.label)}</small><strong>${escapeHtml(row.value)}</strong></span>`).join("")}
      </span>
      <button type="button" class="loadout-vault-equip-action" ${entry.count <= 0 || !compatible || unlock.locked || selectedSlotOccupied || equipPending ? "disabled" : ""}>
        ${equipPending ? "Equipping..." : selectedSlotOccupied ? "Unequip First" : "Equip"}
      </button>
    `;

    const equipButton = btn.querySelector(".loadout-vault-equip-action");
    if (equipButton) {
      equipButton.onclick = event => {
        event.stopPropagation();
        if (!unlock.locked) equipLoadoutVaultEntryDirect(entry);
      };
    }

    box.appendChild(btn);
  });
  renderLoadoutVaultSelectionAction();
}

function renderAttachmentShop() {
  const box = document.getElementById("attachmentShop");
  if (!box) return;

  box.innerHTML = "";

  Object.entries(attachments).forEach(([key, item]) => {
    const canAfford = credits >= item.price;
    const owned = ownedAttachments[key] || 0;
    const unlock = getEquipmentUnlockStatus("attachments", key);

    const card = document.createElement("div");
    card.className = `equipment-card ${unlock.locked ? "progression-locked" : ""}`;
    card.innerHTML = `
      <img src="${item.image}" alt="${item.name}">
      <div class="equipment-card-meta">
        <h4>${item.name}</h4>
        <p>${item.description}</p>
        <p>Owned: ${formatNumber(owned)}</p>
        <p>Price: CR ${formatNumber(item.price)}</p>
      </div>
      <div class="equipment-card-actions">
        <button class="store-buy-attachment-action" data-item-key="${key}" data-item-type="attachment" onclick="buyAttachment('${key}')" ${!canAfford || unlock.locked ? "disabled" : ""}>${unlock.locked ? "Locked" : "Buy"}</button>
      </div>
    `;
    box.appendChild(card);
  });
}

function renderGunShop() {
  const box = document.getElementById("gunShop");
  if (!box) return;

  box.innerHTML = "";

  Object.entries(GUNS).forEach(([key, item]) => {
    if (item.hiddenFromStore) return;
    const canAfford = credits >= item.price;
    const owned = ownedGuns[key] || 0;
    const statRows = getWeaponPurchaseStatRows(item, "standard");
    const unlock = getEquipmentUnlockStatus("guns", key);

    const card = document.createElement("div");
    card.className = `equipment-card ${unlock.locked ? "progression-locked" : ""}`;
    card.innerHTML = `
      <img src="${item.image}" alt="${item.name}">
      <div class="equipment-card-meta">
        <h4>${item.name}</h4>
        <p>${item.description}</p>
        <p>${statRows.map(row => `${row.label}: ${row.value}`).join(" / ")}</p>
        <p>Owned: ${formatNumber(owned)}</p>
        <p>Price: CR ${formatNumber(item.price)}</p>
      </div>
      <div class="equipment-card-actions">
        <button class="store-buy-gun-action" data-item-key="${key}" data-item-type="gun" onclick="buyGun('${key}')" ${!canAfford || unlock.locked ? "disabled" : ""}>${unlock.locked ? "Locked" : "Buy"}</button>
      </div>
    `;
    box.appendChild(card);
  });
}

function equipAttachmentFromInventory(key, quality = "standard", source = "owned") {
  if (isMultiplayerStagingStoreActive()) {
    if (quality === "standard" && source === "owned" && getStagingStoreItemId({ kind: "attachment", key })) {
      requestStagingLoadoutEquip({ kind: "attachment", key, name: attachments[key]?.name || key });
      return;
    }
    blockLoadoutMutationInMultiplayerStaging();
    return;
  }
  const item = attachments[key];
  const loadout = getShipLoadout(selectedHangarShipId);

  if (!item) return;
  const unlock = getEquipmentUnlockStatus("attachments", key);
  if (unlock.locked) {
    if (typeof addHudToast === "function") addHudToast(unlock.message);
    else alert(unlock.message);
    return;
  }

  const attachmentLimit = getAttachmentSlotLimit(selectedHangarShipId);
  const emptyAttachmentIndex = Array.from({ length: attachmentLimit }, (_unused, index) => index)
    .find(index => !getEquipmentKey(loadout.attachments[index]));
  if (!Number.isInteger(emptyAttachmentIndex)) {
    alert("No empty attachment slots.");
    return;
  }

  let level = 1;
  if (source === "owned" && quality === "standard") {
    if ((ownedAttachments[key] || 0) <= 0) return;
    ownedAttachments[key] -= 1;
  } else {
    const removed = removeOneInventoryItem(key, quality);
    if (!removed) return;
    level = Math.max(1, Number(removed.level || 1));
  }

  loadout.attachments[emptyAttachmentIndex] = makeLeveledLoadoutEntry(key, quality, level);

  if (selectedHangarShipId === currentShipId) {
    applyShipStats(true);
  }

  if (typeof recordMissionEvent === "function") {
    recordMissionEvent("equip_attachment", {
      key,
      shipId: selectedHangarShipId,
      equippedCount: loadout.attachments.filter(entry => getEquipmentKey(entry)).length
    });
  }

  renderHangar();
  showHangarSection("overview");
  if (key === "cargoPod") tutorialEvent("equippedCargoPod");
  if (key === "jumpDrive") tutorialEvent("equippedJumpDrive");
  tutorialEvent("equippedAttachment");
  tutorialEvent("equippedItem");
  saveGame();
}

function removeAttachment(index) {
  if (blockLoadoutMutationInMultiplayerStaging()) return;
  const loadout = getShipLoadout(selectedHangarShipId);
  if (!canAddInventoryItems(1)) {
    alert(INVENTORY_FULL_MESSAGE);
    return;
  }

  const removed = loadout.attachments[index];
  loadout.attachments[index] = null;

  if (removed) {
    const key = getEquipmentKey(removed);
    const quality = getEquipmentQuality(removed);
    const level = getEquipmentLevel(removed);

    if (quality === "standard" && level <= 1) {
      ownedAttachments[key] = (ownedAttachments[key] || 0) + 1;
    } else {
      addInventoryItem({
        id: `item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        key,
        quality,
        level
      });
    }
  }

  if (selectedHangarShipId === currentShipId) {
    applyShipStats(true);
  }

  renderHangar();
  showHangarSection("overview");
  saveGame();
}

function equipGunFromInventory(key, quality = "standard", source = "owned") {
  if (isMultiplayerStagingStoreActive()) {
    if (quality === "standard" && source === "owned" && getStagingStoreItemId({ kind: "gun", key })) {
      requestStagingLoadoutEquip({ kind: "gun", key, name: GUNS[key]?.name || key });
      return;
    }
    blockLoadoutMutationInMultiplayerStaging();
    return;
  }
  const item = GUNS[key];
  const loadout = getShipLoadout(selectedHangarShipId);

  if (!item) return;
  const unlock = getEquipmentUnlockStatus("guns", key);
  if (unlock.locked) {
    if (typeof addHudToast === "function") addHudToast(unlock.message);
    else alert(unlock.message);
    return;
  }

  const gunLimit = getGunSlotLimit(selectedHangarShipId);
  const emptyGunIndex = Array.from({ length: gunLimit }, (_unused, index) => index)
    .find(index => !getEquipmentKey(loadout.guns[index]));
  if (!Number.isInteger(emptyGunIndex)) {
    alert("No empty gun slots.");
    return;
  }

  let level = 1;
  if (source === "owned" && quality === "standard") {
    if ((ownedGuns[key] || 0) <= 0) return;
    ownedGuns[key] -= 1;
  } else {
    const removed = removeOneInventoryItem(key, quality);
    if (!removed) return;
    level = Math.max(1, Number(removed.level || 1));
  }

  loadout.guns[emptyGunIndex] = makeLeveledLoadoutEntry(key, quality, level);

  if (engageTimer && selectedHangarShipId === currentShipId) {
    clearInterval(engageTimer);
    engageTimer = null;
  }

  if (typeof recordMissionEvent === "function") {
    recordMissionEvent("equip_guns", {
      key,
      shipId: selectedHangarShipId,
      equippedCount: loadout.guns.filter(entry => getEquipmentKey(entry)).length
    });
  }

  renderHangar();
  showHangarSection("overview");
  tutorialEvent(countEquippedGuns(selectedHangarShipId) >= 2 ? "equippedSecondGun" : "equippedFirstGun");
  tutorialEvent("equippedItem");
  saveGame();
}

function removeGun(index) {
  if (blockLoadoutMutationInMultiplayerStaging()) return;
  const loadout = getShipLoadout(selectedHangarShipId);
  if (!canAddInventoryItems(1)) {
    alert(INVENTORY_FULL_MESSAGE);
    return;
  }

  const removed = loadout.guns[index];
  loadout.guns[index] = null;

  if (removed) {
    const key = getEquipmentKey(removed);
    const quality = getEquipmentQuality(removed);
    const level = getEquipmentLevel(removed);

    if (quality === "standard" && level <= 1) {
      ownedGuns[key] = (ownedGuns[key] || 0) + 1;
    } else {
      addInventoryItem({
        id: `item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        key,
        quality,
        level
      });
    }
  }

  if (engageTimer && selectedHangarShipId === currentShipId) {
    clearInterval(engageTimer);
    engageTimer = null;
  }

  renderHangar();
  showHangarSection("overview");
  saveGame();
}
