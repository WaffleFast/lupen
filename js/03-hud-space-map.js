let activeHudPanel = "chat";
let targetCollapseTimer = null;
let inventoryDrawerFilter = "equipment";
let selectedInventoryDetailId = null;
let selectedLoadoutDetail = null;
const INVENTORY_DRAWER_MAX_CARDS = 12;

function openHudPanel(panelName) {
  if (panelName === "sector") panelName = "objectives";
  activeHudPanel = panelName;

  document.querySelectorAll(".hud-inline-panel .hud-panel").forEach(panel => {
    panel.classList.remove("active");
  });

  document.querySelectorAll(".hud-command-tabs button").forEach(button => {
    button.classList.remove("active");
  });

  const panel = document.getElementById(`${panelName}Panel`);
  const dockButton = document.getElementById(`${panelName}DockBtn`);

  if (panel) panel.classList.add("active");
  if (dockButton) dockButton.classList.add("active");

  const drawer = document.getElementById("inventoryDrawer");
  if (drawer && panelName !== "inventory") {
    drawer.classList.remove("active");
  }
}

function closeShipInventoryDrawer() {
  const drawer = document.getElementById("inventoryDrawer");
  const button = document.getElementById("shipInventoryBtn");
  if (drawer) drawer.classList.remove("active");
  if (button) button.classList.remove("active");
}

function toggleShipInventoryDrawer(event = null) {
  if (event?.stopPropagation) event.stopPropagation();

  const drawer = document.getElementById("inventoryDrawer");
  const button = document.getElementById("shipInventoryBtn");
  if (!drawer) return;

  drawer.classList.toggle("active");
  if (button) button.classList.toggle("active", drawer.classList.contains("active"));

  if (drawer.classList.contains("active")) {
    tutorialEvent("openedLoadout");

    renderInventoryDrawer();
  }

  updateShipStorageHud();
}

function openShipStorageDrawer(filter = "equipment", event = null) {
  if (event?.stopPropagation) event.stopPropagation();

  const drawer = document.getElementById("inventoryDrawer");
  if (!drawer) return;

  const normalizedFilter = filter === "cargo" ? "cargo" : "equipment";
  const wasActive = drawer.classList.contains("active");
  const wasSameFilter = inventoryDrawerFilter === normalizedFilter;

  inventoryDrawerFilter = normalizedFilter;
  selectedInventoryDetailId = null;

  if (wasActive && wasSameFilter) {
    closeShipInventoryDrawer();
    return;
  }

  drawer.classList.add("active");
  renderInventoryDrawer();
  updateShipStorageHud();
}

document.addEventListener("click", event => {
  const drawer = document.getElementById("inventoryDrawer");
  if (!drawer || !drawer.classList.contains("active")) return;

  const eventPath = typeof event.composedPath === "function" ? event.composedPath() : [];
  const clickedDrawer = drawer.contains(event.target) || eventPath.includes(drawer);
  const clickedInventoryButton = event.target.closest?.("#shipInventoryBtn");
  const clickedModal = event.target.closest?.(".sector-map, .market-screen, .hangar-screen, .store-screen, .bounty-screen, .pilot-profile-screen");

  if (!clickedDrawer && !clickedInventoryButton && !clickedModal) {
    closeShipInventoryDrawer();
  }
});

function closeHudPanel() {
  openHudPanel("chat");
}

function updateShipStorageHud() {
  const inventoryButton = document.getElementById("shipInventoryBtn");
  const inventorySlots = document.getElementById("hudInventorySlots");
  const drawer = document.getElementById("inventoryDrawer");
  const groupedItems = groupInventoryItems(inventoryItems);
  const totalInventoryItems = getCarriedInventoryItemCount();

  if (inventorySlots) {
    inventorySlots.textContent = `${formatNumber(totalInventoryItems)}/${formatNumber(MAX_CARRIED_INVENTORY_ITEMS)} items`;
  }

  const drawerActive = !!drawer && drawer.classList.contains("active");

  if (inventoryButton) {
    inventoryButton.classList.toggle("active", drawerActive && inventoryDrawerFilter === "equipment");
    inventoryButton.classList.toggle("has-alert", totalInventoryItems > 0 || groupedItems.length > 0);
  }
}

function getInventoryEntryId(entry) {
  return `${entry.type}:${entry.key}:${entry.quality || "standard"}:${entry.source || "cargo"}`;
}

function getCurrentLoadoutEquippedCounts() {
  const loadout = getShipLoadout(currentShipId);
  const counts = {};

  [...(loadout.attachments || []), ...(loadout.guns || [])].forEach(entry => {
    const key = getEquipmentKey(entry);
    const quality = getEquipmentQuality(entry);
    const id = `${key}__${quality}`;
    counts[id] = (counts[id] || 0) + 1;
  });

  return counts;
}

function buildInventoryDrawerEntries() {
  const entries = [];
  const equippedCounts = getCurrentLoadoutEquippedCounts();

  mineralKeys.forEach(mineral => {
    const quantity = cargo[mineral] || 0;
    if (quantity <= 0) return;
    const info = commodityInfo[mineral] || {};
    entries.push({
      type: "cargo",
      key: mineral,
      name: mineral,
      quantity,
      quality: (info.rarity || "common").toLowerCase(),
      rarity: info.rarity || "Common",
      icon: getCommodityImage(mineral),
      category: "Cargo",
      source: "cargo"
    });
  });

  groupInventoryItems(inventoryItems).forEach(item => {
    const definition = itemDefinitions[item.key];
    if (!definition) return;
    const kind = definition.category === "Weapon" ? "gun" : definition.category === "Attachment" ? "attachment" : "core";
    entries.push({
      type: kind === "core" ? "core" : "equipment",
      kind,
      key: item.key,
      name: definition.name,
      quantity: item.count,
      quality: item.quality,
      category: definition.category,
      icon: definition.icon,
      source: "inventory",
      equipped: equippedCounts[`${item.key}__${item.quality}`] || 0
    });
  });

  Object.entries(ownedAttachments || {}).forEach(([key, count]) => {
    if (!count || count <= 0 || !attachments[key]) return;
    const definition = itemDefinitions[key] || attachments[key];
    entries.push({
      type: "equipment",
      kind: "attachment",
      key,
      name: definition.name || attachments[key].name,
      quantity: count,
      quality: "standard",
      category: "Attachment",
      icon: definition.icon || attachments[key].image,
      source: "owned",
      equipped: equippedCounts[`${key}__standard`] || 0
    });
  });

  Object.entries(ownedGuns || {}).forEach(([key, count]) => {
    if (!count || count <= 0 || !GUNS[key]) return;
    const definition = itemDefinitions[key] || GUNS[key];
    entries.push({
      type: "equipment",
      kind: "gun",
      key,
      name: definition.name || GUNS[key].name,
      quantity: count,
      quality: "standard",
      category: "Weapon",
      icon: definition.icon || GUNS[key].image,
      source: "owned",
      equipped: equippedCounts[`${key}__standard`] || 0
    });
  });

  const loadout = getShipLoadout(currentShipId);
  (loadout.attachments || []).forEach(entry => {
    const key = getEquipmentKey(entry);
    const quality = getEquipmentQuality(entry);
    const item = attachments[key];
    if (!item) return;
    const definition = itemDefinitions[key] || item;
    entries.push({
      type: "equipment",
      kind: "attachment",
      key,
      name: definition.name || item.name,
      quantity: 1,
      quality,
      category: "Attachment",
      icon: definition.icon || item.image,
      source: "equipped",
      equipped: 1
    });
  });

  (loadout.guns || []).forEach(entry => {
    const key = getEquipmentKey(entry);
    const quality = getEquipmentQuality(entry);
    const item = GUNS[key];
    if (!item) return;
    const definition = itemDefinitions[key] || item;
    entries.push({
      type: "equipment",
      kind: "gun",
      key,
      name: definition.name || item.name,
      quantity: 1,
      quality,
      category: "Weapon",
      icon: definition.icon || item.image,
      source: "equipped",
      equipped: 1
    });
  });

  return entries.sort((a, b) => {
    const typeOrder = { cargo: 0, equipment: 1, core: 2 };
    const delta = (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9);
    if (delta !== 0) return delta;
    const qualityDelta = ITEM_QUALITY_ORDER.indexOf(b.quality) - ITEM_QUALITY_ORDER.indexOf(a.quality);
    if (qualityDelta !== 0) return qualityDelta;
    return a.name.localeCompare(b.name);
  });
}

function setInventoryDrawerFilter(filter) {
  inventoryDrawerFilter = filter === "cargo" ? "cargo" : "equipment";
  selectedInventoryDetailId = null;
  selectedLoadoutDetail = null;
  renderInventoryDrawer();
  updateShipStorageHud();
}

function selectInventoryDrawerItem(id) {
  selectedInventoryDetailId = id;
  selectedLoadoutDetail = null;
  renderInventoryDrawer();
}

function selectLoadoutSlot(kind, index) {
  selectedLoadoutDetail = { kind, index: Number(index) };
  selectedInventoryDetailId = null;
  renderInventoryDrawer();
}

function getFilteredInventoryEntries() {
  const entries = buildInventoryDrawerEntries();
  if (inventoryDrawerFilter === "cargo") return entries.filter(entry => entry.type === "cargo").slice(0, INVENTORY_DRAWER_MAX_CARDS);
  if (inventoryDrawerFilter === "equipment") return entries.filter(entry => entry.source !== "equipped" && (entry.type === "equipment" || entry.type === "core")).slice(0, INVENTORY_DRAWER_MAX_CARDS);
  return entries.filter(entry => entry.source !== "equipped" && (entry.type === "equipment" || entry.type === "core")).slice(0, INVENTORY_DRAWER_MAX_CARDS);
}


function renderEquippedLoadoutView() {
  const grid = document.getElementById("inventoryDrawerGrid");
  const detail = document.getElementById("inventoryDrawerDetail");
  const count = document.getElementById("inventoryDrawerCount");
  const drawer = document.getElementById("inventoryDrawer");
  if (!grid || !detail) return;

  const ship = getCurrentShip();
  const loadout = getShipLoadout(currentShipId);
  const gunSlots = ship.gunSlots || 1;
  const attachmentSlots = ship.attachmentSlots || 0;
  const totalSlots = gunSlots + attachmentSlots;
  const loadoutSizeClass = totalSlots > 12 ? "many-slots" : totalSlots > 8 ? "wide-slots" : "standard-slots";

  const buildSlotButton = (entry, kind, index) => {
    const label = kind === "gun" ? `Gun ${index + 1}` : `Attachment ${index + 1}`;
    const selected = selectedLoadoutDetail && selectedLoadoutDetail.kind === kind && selectedLoadoutDetail.index === index;

    if (!entry) {
      const iconClass = kind === "gun" ? "empty-gun-icon" : "empty-attachment-icon";
      return `<button class="equipped-orbit-slot loadout-icon-slot empty ${selected ? "selected" : ""}" onclick="selectLoadoutSlot('${kind}', ${index})" title="${label}: Empty">
        <span class="empty-slot-silhouette ${iconClass}" aria-hidden="true"></span>
      </button>`;
    }

    const key = getEquipmentKey(entry);
    const quality = getEquipmentQuality(entry);
    const item = kind === "gun" ? GUNS[key] : attachments[key];
    const definition = itemDefinitions[key] || item || {};
    const name = definition.name || item?.name || key;
    const icon = definition.icon || item?.image || "";
    const effectLine = getInventoryEffectLine({ key, quality, kind });

    return `<button class="equipped-orbit-slot loadout-icon-slot quality-${quality} ${selected ? "selected" : ""}" onclick="selectLoadoutSlot('${kind}', ${index})" title="${titleCaseQuality(quality)} ${name} / ${effectLine}">
      <img src="${icon}" alt="${name}">
    </button>`;
  };

  const gunSlotHtml = Array.from({ length: gunSlots }).map((_, index) => {
    const entry = (loadout.guns || [])[index];
    return buildSlotButton(entry, "gun", index);
  }).join("");

  const attachmentSlotHtml = Array.from({ length: attachmentSlots }).map((_, index) => {
    const entry = (loadout.attachments || [])[index];
    return buildSlotButton(entry, "attachment", index);
  }).join("");

  if (drawer) drawer.classList.add("equipped-mode");
  if (count) count.textContent = `${ship.name} loadout`;

  grid.innerHTML = `
    <div class="equipped-loadout-stage ${loadoutSizeClass}">
      <div class="equipped-loadout-grid icon-loadout-grid compact-side-loadout">
        <div class="loadout-slot-bank gun-slot-bank" aria-label="Gun slots">${gunSlotHtml}</div>
        <div class="equipped-ship-core">
          <div class="equipped-ship-ring"></div>
          <img src="${ship.image}" alt="${ship.name}">
          <strong>${ship.name}</strong>
          <span>${gunSlots} gun / ${attachmentSlots} attachment slots</span>
        </div>
        <div class="loadout-slot-bank attachment-slot-bank" aria-label="Attachment slots">${attachmentSlotHtml}</div>
      </div>
    </div>
  `;

  renderLoadoutSlotDetail();
}

function getLoadoutSlotEntry(kind, index) {
  const loadout = getShipLoadout(currentShipId);
  const list = kind === "gun" ? loadout.guns : loadout.attachments;
  return (list || [])[Number(index)] || null;
}

function renderLoadoutSlotDetail() {
  const detail = document.getElementById("inventoryDrawerDetail");
  if (!detail) return;

  const ship = getCurrentShip();
  if (!selectedLoadoutDetail) {
    detail.innerHTML = `
      <div class="inventory-detail-title compact-loadout-title">
        <img src="${ship.image}" alt="${ship.name}">
        <div><strong>Current Loadout</strong><span>Click an equipped item to inspect stats</span></div>
      </div>
      <div class="inventory-detail-stats">
        <span>Hull <strong>${formatNumber(hullMax)}</strong></span>
        <span>Shield <strong>${formatNumber(shieldMax)}</strong></span>
        <span>Armor <strong>${formatNumber(armor)}</strong></span>
        <span>Cargo <strong>${formatNumber(cargoCapacity())}</strong></span>
        <span>Jump Speed <strong>${formatNumber(ship.baseJumpRecharge || 0)}</strong></span>
        <span>Evasion <strong>${formatEvasion(evasion)}</strong></span>
      </div>
    `;
    return;
  }

  const { kind, index } = selectedLoadoutDetail;
  const entry = getLoadoutSlotEntry(kind, index);
  const slotLabel = kind === "gun" ? `Gun ${index + 1}` : `Attachment ${index + 1}`;

  if (!entry) {
    detail.innerHTML = `
      <div class="inventory-detail-title compact-loadout-title">
        <div class="empty-slot-icon">${kind === "gun" ? "G" : "A"}${index + 1}</div>
        <div><strong>${slotLabel}</strong><span>Empty slot</span></div>
      </div>
      <div class="inventory-detail-stats">
        <span>No item equipped</span>
      </div>
    `;
    return;
  }

  const key = getEquipmentKey(entry);
  const quality = getEquipmentQuality(entry);
  const item = kind === "gun" ? GUNS[key] : attachments[key];
  const definition = itemDefinitions[key] || item || {};
  const name = definition.name || item?.name || key;
  const icon = definition.icon || item?.image || "";
  const statText = kind === "gun" && GUNS[key]
    ? getInventoryEffectLine({ key, quality, kind })
    : kind === "attachment" && attachments[key]
      ? getStoreAttachmentEffectText({ key }, quality)
      : getInventoryEffectLine({ key, quality, kind });

  detail.innerHTML = `
    <div class="inventory-detail-title quality-${quality}">
      <img src="${icon}" alt="${name}">
      <div><strong>${titleCaseQuality(quality)} ${name}</strong><span>${slotLabel}</span></div>
    </div>
    <div class="inventory-detail-stats">
      <span>${statText}</span>
      <span>Quality <strong>${titleCaseQuality(quality)}</strong></span>
      <span>Status <strong>Equipped</strong></span>
    </div>
    <div class="inventory-detail-actions">
      <button onclick="unequipCurrentShipItem('${escapeJsString(key)}', '${escapeJsString(quality)}', '${escapeJsString(kind)}')">Unequip</button>
    </div>
  `;
}

function renderInventoryDrawer() {
  const drawer = document.getElementById("inventoryDrawer");
  const grid = document.getElementById("inventoryDrawerGrid");
  const detail = document.getElementById("inventoryDrawerDetail");
  const count = document.getElementById("inventoryDrawerCount");
  if (!drawer || !grid || !detail) return;

  drawer.classList.toggle("equipped-mode", inventoryDrawerFilter === "equipped");

  document.querySelectorAll(".inventory-drawer-filters button").forEach(button => {
    const key = button.id.replace("inventoryFilter", "").toLowerCase();
    button.classList.toggle("active", key === inventoryDrawerFilter);
  });

  if (inventoryDrawerFilter === "equipped") {
    renderEquippedLoadoutView();
    return;
  }

  const entries = getFilteredInventoryEntries();
  const totalCargo = cargoUsed();
  const itemCount = getCarriedInventoryItemCount();

  if (count) {
    count.textContent = `${formatNumber(totalCargo)} cargo / ${formatNumber(itemCount)} of ${formatNumber(MAX_CARRIED_INVENTORY_ITEMS)} items`;
  }

  if (!entries.length) {
    grid.innerHTML = `<div class="inventory-drawer-empty">Nothing to show.</div>`;
    detail.innerHTML = `<div class="inventory-detail-empty">Select cargo or equipment to inspect.</div>`;
    return;
  }

  if (!selectedInventoryDetailId || !entries.some(entry => getInventoryEntryId(entry) === selectedInventoryDetailId)) {
    selectedInventoryDetailId = getInventoryEntryId(entries[0]);
  }

  grid.innerHTML = entries.map(entry => {
    const id = getInventoryEntryId(entry);
    const qualityClass = ITEM_QUALITY_ORDER.includes(entry.quality) ? `quality-${entry.quality}` : `rarity-${entry.quality}`;
    const isSelected = id === selectedInventoryDetailId;
    const badge = entry.source === "equipped" ? "EQUIPPED" : entry.type === "cargo" ? entry.rarity : titleCaseQuality(entry.quality);
    const effectLine = entry.type === "cargo" ? "" : getInventoryEffectLine(entry);
    return `
      <button class="inventory-drawer-card ${qualityClass} ${isSelected ? "selected" : ""}" onclick="selectInventoryDrawerItem('${escapeJsString(id)}')">
        <span class="inventory-card-icon"><img src="${entry.icon}" alt="${entry.name}"></span>
        <span class="inventory-card-main">
          <strong>${entry.name}</strong>
          <small>${badge}</small>
          ${effectLine ? `<em>${effectLine}</em>` : ""}
        </span>
        <span class="inventory-card-qty">x${formatNumber(entry.quantity)}</span>
      </button>
    `;
  }).join("");

  const selectedEntry = entries.find(entry => getInventoryEntryId(entry) === selectedInventoryDetailId) || entries[0];
  renderInventoryDrawerDetail(selectedEntry);
}

function renderInventoryDrawerDetail(entry) {
  const detail = document.getElementById("inventoryDrawerDetail");
  if (!detail || !entry) return;

  if (entry.type === "cargo") {
    const unitBasis = cargoCostBasis[entry.key] || 0;
    detail.innerHTML = `
      <div class="inventory-detail-title">
        <img src="${entry.icon}" alt="${entry.name}">
        <div><strong>${entry.name}</strong><span>${entry.rarity} resource</span></div>
      </div>
      <div class="inventory-detail-stats">
        <span>Held <strong>${formatNumber(entry.quantity)}</strong></span>
        <span>Avg Cost <strong>${unitBasis ? `CR ${formatNumber(Math.round(unitBasis))}` : "--"}</strong></span>
      </div>
    `;
    return;
  }

  const itemDef = itemDefinitions[entry.key] || {};
  const isGun = entry.kind === "gun";
  const isAttachment = entry.kind === "attachment";
  const gun = GUNS[entry.key];
  const attachment = attachments[entry.key];
  const statText = isGun && gun
    ? getInventoryEffectLine(entry)
    : isAttachment && attachment
      ? getStoreAttachmentEffectText({ key: entry.key }, entry.quality)
      : itemDef.core
        ? "Upgrade material"
        : "Owned item";
  detail.innerHTML = `
    <div class="inventory-detail-title">
      <img src="${entry.icon}" alt="${entry.name}">
      <div><strong>${titleCaseQuality(entry.quality)} ${entry.name}</strong><span>${entry.category}</span></div>
    </div>
    <div class="inventory-detail-stats">
      <span>Owned <strong>${formatNumber(entry.quantity)}</strong></span>
      <span>${statText}</span>
      ${entry.equipped ? `<span>Equipped <strong>${formatNumber(entry.equipped)}</strong></span>` : ""}
    </div>
  `;
}

function equipInventoryItemToCurrentShip(key, quality = "standard", source = "inventory") {
  selectedHangarShipId = currentShipId;
  const loadout = getShipLoadout(currentShipId);
  const isAttachment = Boolean(attachments[key]);
  const isGun = Boolean(GUNS[key]);

  if (!isAttachment && !isGun) return;

  if (isAttachment && loadout.attachments.length >= getAttachmentSlotLimit(currentShipId)) {
    alert("No empty attachment slots.");
    return;
  }

  if (isGun && loadout.guns.length >= getGunSlotLimit(currentShipId)) {
    alert("No empty gun slots.");
    return;
  }

  if (source === "owned" && quality === "standard") {
    const store = isAttachment ? ownedAttachments : ownedGuns;
    if ((store[key] || 0) <= 0) return;
    store[key] -= 1;
  } else {
    const removed = removeOneInventoryItem(key, quality);
    if (!removed) return;
  }

  if (isAttachment) {
    loadout.attachments.push(makeLoadoutEntry(key, quality));
    applyShipStats(true);
  } else {
    loadout.guns.push(makeLoadoutEntry(key, quality));
    if (engageTimer) {
      clearInterval(engageTimer);
      engageTimer = null;
    }
  }

  addActivityLog(`${titleCaseQuality(quality)} ${(itemDefinitions[key] || attachments[key] || GUNS[key]).name} equipped.`);
  tutorialEvent("equippedItem");
  selectedInventoryDetailId = null;
  updateSpaceHUD();
  renderInventoryDrawer();
  saveGame();
}

function unequipCurrentShipItem(key, quality = "standard", kind = "attachment") {
  selectedHangarShipId = currentShipId;
  const loadout = getShipLoadout(currentShipId);
  const list = kind === "gun" ? loadout.guns : loadout.attachments;
  const index = list.findIndex(entry => getEquipmentKey(entry) === key && getEquipmentQuality(entry) === quality);
  if (index < 0) return;

  if (kind === "gun" && list.length <= 1) {
    alert("At least one gun must stay equipped.");
    return;
  }

  if (!canAddInventoryItems(1)) {
    alert(INVENTORY_FULL_MESSAGE);
    return;
  }

  list.splice(index, 1);

  if (quality === "standard") {
    if (kind === "gun") ownedGuns[key] = (ownedGuns[key] || 0) + 1;
    else ownedAttachments[key] = (ownedAttachments[key] || 0) + 1;
  } else {
    addInventoryItem({
      id: `item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      key,
      quality
    });
  }

  if (kind === "attachment") applyShipStats(true);
  if (kind === "gun" && engageTimer) {
    clearInterval(engageTimer);
    engageTimer = null;
  }

  addActivityLog(`${titleCaseQuality(quality)} ${(itemDefinitions[key] || attachments[key] || GUNS[key]).name} unequipped.`);
  selectedInventoryDetailId = null;
  updateSpaceHUD();
  renderInventoryDrawer();
  saveGame();
}

function dropInventoryItemGroup(key, quality = "standard", source = "inventory") {
  if (source === "owned" && quality === "standard") {
    if (ownedAttachments[key] > 0) ownedAttachments[key] -= 1;
    else if (ownedGuns[key] > 0) ownedGuns[key] -= 1;
  } else {
    const removed = removeOneInventoryItem(key, quality);
    if (!removed) return;
  }

  const itemName = (itemDefinitions[key] || attachments[key] || GUNS[key] || {}).name || key;
  addActivityLog(`${itemName} dropped.`);
  selectedInventoryDetailId = null;
  updateSpaceHUD();
  renderInventoryDrawer();
  saveGame();
}

function showTargetPanel() {
  updateObjectActionPanel(true);

  if (targetCollapseTimer) {
    clearTimeout(targetCollapseTimer);
    targetCollapseTimer = null;
  }
}

function autoCollapseTargetPanel(delay = 3500) {
  if (targetCollapseTimer) {
    clearTimeout(targetCollapseTimer);
  }

  targetCollapseTimer = setTimeout(() => {
    if (!engageTimer) {
      selectedTarget = null;
      updateObjectActionPanel(false);
      updateAsteroidUI();
      updateHudDock();
    }
  }, delay);
}

function toggleTargetEngagement() {
  const selected = getSelectedTargetEntity();
  const engaged = getEngagedTargetEntity();
  const selectedIsEngaged = selected && selectedTarget && engagedTarget && selectedTarget.type === engagedTarget.type && selectedTarget.id === engagedTarget.id;

  if (engageTimer && selectedIsEngaged) {
    disengageTarget(true);
    updateObjectActionPanel(true);
    return;
  }

  if (engageTimer && selected && !selectedIsEngaged) {
    disengageTarget(true);
    engageTarget();
    updateObjectActionPanel(true);
    return;
  }

  engageTarget();
  updateObjectActionPanel(true);
}

function addActivityLog(message) {
  const feed = document.getElementById("activityLogFeed");
  if (!feed) return;

  const placeholder = feed.querySelector(".activity-log-item.muted");
  if (placeholder) {
    placeholder.remove();
  }

  const item = document.createElement("div");
  item.className = "activity-log-item";
  item.textContent = message;
  feed.prepend(item);

  while (feed.children.length > 14) {
    feed.removeChild(feed.lastElementChild);
  }
}

function addHudToast(message) {
  addActivityLog(message);
}

function getPilotName() {
  const savedAccount = safeParseLocalStorage(STORAGE_ACCOUNT_KEY);
  const localPilot = localStorage.getItem("sectorOneLoggedIn");
  return savedAccount?.username || localPilot || "Pilot";
}

function getMultiplayerPresencePayload() {
  const node = sectorNodes[currentNode] || {};
  const shipName = SHIPS[currentShipId]?.name || "";
  return {
    currentNode,
    x: Number.isFinite(Number(node.x)) ? Number(node.x) : 50,
    y: Number.isFinite(Number(node.y)) ? Number(node.y) : 50,
    displayName: getPilotName(),
    currentShipId: currentShipId || "",
    shipName,
    ship: shipName
  };
}

window.getLupenMultiplayerPresence = getMultiplayerPresencePayload;

function syncMultiplayerPresence(reason = "position_update") {
  const client = window.LupenMultiplayerClient;
  const status = client?.getStatus?.();
  if (!status?.enabled || !status?.isConnected) return;

  client.sendMovementIntent({
    ...getMultiplayerPresencePayload(),
    reason
  });
}

function addLocalChatLine(author, message, type = "") {
  const feed = document.getElementById("localChatFeed");
  if (!feed) return;

  const line = document.createElement("div");
  line.className = `chat-line ${type}`.trim();

  const cleanAuthor = String(author || "Pilot").slice(0, 28);
  const cleanMessage = String(message || "").slice(0, 160);

  line.innerHTML = `<strong>${cleanAuthor}:</strong> <span>${cleanMessage}</span>`;
  feed.appendChild(line);
  feed.scrollTop = feed.scrollHeight;

  while (feed.children.length > 30) {
    feed.removeChild(feed.firstElementChild);
  }
}

function sendLocalChatMessage() {
  const input = document.getElementById("localChatInput");
  if (!input) return;

  const message = input.value.trim();
  if (!message) return;

  addLocalChatLine(getPilotName(), message);
  input.value = "";
}

function handleLocalChatKey(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    sendLocalChatMessage();
  }
}

function updateObjectActionPanel(forceVisible = false) {
  const panel = document.getElementById("objectActionPanel");
  const actionBtn = document.getElementById("objectEngageBtn");
  const selected = getSelectedTargetEntity();
  const engaged = getEngagedTargetEntity();
  const target = selected || engaged;
  const localBotVisualGuardActive = typeof isStagingLocalCombatBotVisualGuardActive === "function"
    && isStagingLocalCombatBotVisualGuardActive();

  if (!panel || !actionBtn) return;

  const targetType = target ? getTargetTypeFromEntity(target) : "";
  const isRelevant = target
    && (target.currentNodeId || target.node) === currentNode
    && target.alive
    && !(localBotVisualGuardActive && targetType === "hostileBot");

  if (!isRelevant) {
    panel.classList.remove("visible");
    actionBtn.disabled = true;
    actionBtn.textContent = "ENGAGE";
    actionBtn.classList.remove("disengage-action");
    return;
  }

  const selectedIsEngaged = selected && selectedTarget && engagedTarget && selectedTarget.type === engagedTarget.type && selectedTarget.id === engagedTarget.id;

  panel.classList.add("visible");
  actionBtn.disabled = false;
  actionBtn.textContent = engageTimer && selectedIsEngaged ? "DISENGAGE" : "ENGAGE";
  actionBtn.classList.toggle("disengage-action", !!engageTimer && selectedIsEngaged);
}

function updateHudDock() {
  const sectorBtn = document.getElementById("sectorDockBtn");
  const inventoryBtn = document.getElementById("inventoryDockBtn");
  const sectorCargoSummary = document.getElementById("sectorCargoSummary");
  const cargoSummary = document.getElementById("cargoSummary");
  const cargoCapacityText = document.getElementById("cargoCapacityText");
  const inventoryItemCountText = document.getElementById("inventoryItemCountText");
  const itemInventorySummary = document.getElementById("itemInventorySummary");

  const loot = lootByNode[currentNode];
  const hasLoot = loot && Object.values(loot).some(amount => amount > 0);
  const usedCargo = cargoUsed();
  const maxCargo = getShipStats().cargo;
  const groupedItems = groupInventoryItems(inventoryItems);

  if (sectorBtn) {
    sectorBtn.classList.toggle("has-alert", !!hasLoot);
  }

  if (inventoryBtn) {
    inventoryBtn.classList.toggle("has-alert", usedCargo > 0 || groupedItems.length > 0);
  }

  updateShipStorageHud();

  if (cargoCapacityText) {
    cargoCapacityText.textContent = `${formatNumber(usedCargo)} / ${formatNumber(maxCargo)}`;
  }

  if (inventoryItemCountText) {
    const itemCount = getCarriedInventoryItemCount();
    inventoryItemCountText.textContent = `${formatNumber(itemCount)}/${formatNumber(MAX_CARRIED_INVENTORY_ITEMS)} items`;
  }

  if (itemInventorySummary) {
    itemInventorySummary.innerHTML = groupedItems.length
      ? groupedItems.map(item => `
          <div class="inventory-item-card inventory-item-card-minimal quality-${item.quality}" title="${item.name} / ${titleCaseQuality(item.quality)} / ${item.category}">
            <span class="quality-corner quality-corner-tl"></span>
            <span class="quality-corner quality-corner-br"></span>
            <div class="inventory-item-count">x${formatNumber(item.count)}</div>
            <div class="inventory-item-frame inventory-item-frame-minimal quality-${item.quality}">
              <img class="inventory-item-image inventory-item-image-minimal" src="${item.icon}" alt="${item.name}">
            </div>
          </div>
        `).join("")
      : `<div class="cargo-empty">No items collected yet.</div>`;
  }

  if (cargoSummary) {
    const cargoRows = mineralKeys
      .filter(mineral => cargo[mineral] > 0)
      .map(mineral => `
        <div class="cargo-resource-card compact-resource-card">
          <img src="${getCommodityImage(mineral)}" alt="${mineral}">
          <div class="cargo-resource-info">
            <strong>${mineral}</strong>
            <span>${formatNumber(cargo[mineral])} held</span>
          </div>
          <div class="cargo-resource-actions compact-actions">
            <button onclick="jettisonCargo('${escapeJsString(mineral)}', 1)">-1</button>
            <button onclick="jettisonCargo('${escapeJsString(mineral)}', 10)">-10</button>
            <button onclick="jettisonCargo('${escapeJsString(mineral)}', 'all')">Drop</button>
          </div>
        </div>
      `);

    cargoSummary.innerHTML = cargoRows.length
      ? cargoRows.join("")
      : `<div class="cargo-empty">Cargo hold empty.</div>`;
  }

  if (sectorCargoSummary) {
    sectorCargoSummary.innerHTML = `Used: ${formatNumber(usedCargo)} / ${formatNumber(maxCargo)}`;
  }

  renderObjectiveHud();
  updateObjectActionPanel();

  const inventoryDrawer = document.getElementById("inventoryDrawer");
  if (inventoryDrawer && inventoryDrawer.classList.contains("active")) {
    renderInventoryDrawer();
  }
}

function updateSpaceHUD() {
  const ship = getCurrentShip();
  const stats = getShipStats();

  if (!Number.isFinite(hullMax) || hullMax <= 0) hullMax = stats.hull;
  if (!Number.isFinite(shieldMax) || shieldMax < 0) shieldMax = stats.shield;
  if (!Number.isFinite(jumpCharge) || jumpCharge < 0) jumpCharge = 0;
  if (!Number.isFinite(hull) || hull < 0) hull = hullMax;
  if (!Number.isFinite(shield) || shield < 0) shield = shieldMax;

  const jumpFill = document.getElementById("jumpFill");
  if (!jumpFill) return;

  const safeJumpMax = Number.isFinite(jumpMax) && jumpMax > 0 ? jumpMax : 100;
  const safeHullMax = Number.isFinite(hullMax) && hullMax > 0 ? hullMax : 1;
  const safeShieldMax = Number.isFinite(shieldMax) && shieldMax > 0 ? shieldMax : 0;

  document.getElementById("jumpFill").style.height = `${Math.max(0, Math.min(100, (jumpCharge / safeJumpMax) * 100))}%`;
  document.getElementById("jumpValue").textContent = formatNumber(Math.floor(jumpCharge));
  document.getElementById("jumpBtn").disabled = jumpCharge < safeJumpMax || hull <= 0;

  document.getElementById("hullFill").style.height = `${Math.max(0, Math.min(100, (hull / safeHullMax) * 100))}%`;
  document.getElementById("hullValue").textContent = formatNumber(Math.floor(hull));

  document.getElementById("shieldFill").style.height = `${safeShieldMax > 0 ? Math.max(0, Math.min(100, (shield / safeShieldMax) * 100)) : 0}%`;
  document.getElementById("shieldValue").textContent = formatNumber(Math.floor(shield));

  const shipImage = document.getElementById("hudShipImage");
  if (shipImage) {
    shipImage.src = ship.image;
    shipImage.alt = ship.name;
  }

  updateCargoSummary();
  updateTargetPanel();
  updateHudDock();
  updateProgressDisplays();
}

function startJumpRecharge() {
  if (jumpTimer) return;

  jumpTimer = setInterval(() => {
    if (jumpCharge < jumpMax) {
      const rechargeRate = getShipStats().jumpRecharge;
      jumpCharge = Math.min(jumpMax, jumpCharge + rechargeRate);
      updateSpaceHUD();
    }

    if (jumpCharge >= jumpMax) {
      clearInterval(jumpTimer);
      jumpTimer = null;
    }
  }, 500);
}

function stopShieldRegen() {
  if (shieldRegenDelayTimer) {
    clearTimeout(shieldRegenDelayTimer);
    shieldRegenDelayTimer = null;
  }

  if (shieldRegenTimer) {
    clearInterval(shieldRegenTimer);
    shieldRegenTimer = null;
  }
}

function scheduleShieldRegen() {
  if (shield >= shieldMax) {
    shield = shieldMax;
    stopShieldRegen();
    updateSpaceHUD();
    return;
  }

  stopShieldRegen();

  shieldRegenDelayTimer = setTimeout(() => {
    shieldRegenDelayTimer = null;
    playShieldRegenSound();

    shieldRegenTimer = setInterval(() => {
      shield = Math.min(shieldMax, shield + SHIELD_REGEN_RATE);
      updateSpaceHUD();
      saveGame();

      if (shield >= shieldMax) {
        shield = shieldMax;
        stopShieldRegen();
        updateSpaceHUD();
      }
    }, SHIELD_REGEN_INTERVAL_MS);
  }, SHIELD_REGEN_DELAY_MS);
}

function applyDamageToPlayer(totalDamage) {
  if (totalDamage <= 0) return;
  if (hull <= 0) return;

  stopShieldRegen();

  const damageResult = LupenCombatRules.resolveIncomingPlayerDamage(
    { hull, shield, armor },
    getMitigatedIncomingDamage(totalDamage)
  );
  hull = damageResult.hull;
  shield = damageResult.shield;

  if (damageResult.shieldDamage > 0 && typeof playShieldHitSound === "function") playShieldHitSound();
  if (damageResult.hullDamage > 0 && typeof playHullHitSound === "function") playHullHitSound();

  if (damageResult.destroyed) {
    handleShipDisabled();
    return;
  }

  updateSpaceHUD();
  saveGame();

  if (shield < shieldMax) {
    scheduleShieldRegen();
  }
}

function calculateDisabledCargoLoss() {
  const lostCargo = {};

  mineralKeys.forEach(mineral => {
    const held = Number(cargo[mineral] || 0);
    if (held <= 0) return;

    lostCargo[mineral] = held;
    cargo[mineral] = 0;

    if (cargoCostBasis[mineral]) {
      delete cargoCostBasis[mineral];
    }
  });

  return lostCargo;
}

function summarizeCargoLoss(lostCargo) {
  const rows = Object.entries(lostCargo || {}).filter(([, amount]) => amount > 0);
  if (!rows.length) return "No cargo lost.";
  return rows.map(([mineral, amount]) => `${formatNumber(amount)} ${mineral}`).join(", ");
}

function handleShipDisabled() {
  if (typeof playPlayerShipDestroyedSound === "function") playPlayerShipDestroyedSound();
  hull = 0;
  shield = 0;
  stopShieldRegen();
  disengageTarget(true);
  closeSectorMap();

  const lostCargo = calculateDisabledCargoLoss();
  const towPlanet = sectorNodes[homePlanet]?.type === "planet" ? homePlanet : "Asteron Prime";
  currentNode = towPlanet;
  lastPlanetNode = towPlanet;
  jumpCharge = 0;

  const lossSummary = summarizeCargoLoss(lostCargo);
  addActivityLog(`Ship destroyed. Emergency tow to home planet ${towPlanet}. Cargo lost: ${lossSummary}`);
  updateHubLocation();
  updateSpaceHUD();
  showScreen("gameScreen");
  showShipDisabledOverlay(`Emergency tow to your home planet, ${towPlanet}. All carried resources were lost. Ships, guns and equipment are safe. Repair your hull in the Hangar before launching again.`, Object.entries(lostCargo));
  saveGame();
}

function showShipDisabledOverlay(message, lostEntries = []) {
  let overlay = document.getElementById("shipDisabledOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "shipDisabledOverlay";
    overlay.className = "repair-overlay";
    document.body.appendChild(overlay);
  }

  const lostMarkup = lostEntries.length
    ? lostEntries.map(([mineral, amount]) => `<div class="repair-loss-row"><span>${mineral}</span><strong>-${formatNumber(amount)}</strong></div>`).join("")
    : `<div class="repair-loss-row muted"><span>Cargo</span><strong>No loss</strong></div>`;

  overlay.innerHTML = `
    <div class="repair-modal">
      <div class="reward-kicker danger-kicker">Ship Disabled</div>
      <h2>Hull Critical</h2>
      <p>${message}</p>
      <div class="repair-modal-stat"><span>Hull</span><strong>${formatNumber(Math.floor(hull))} / ${formatNumber(hullMax)}</strong></div>
      <div class="repair-loss-list">${lostMarkup}</div>
      <div class="repair-modal-actions">
        <button onclick="closeShipDisabledOverlay(); openHangar();">Open Hangar</button>
        <button class="secondary" onclick="closeShipDisabledOverlay()">Stay Docked</button>
      </div>
    </div>
  `;

  requestAnimationFrame(() => overlay.classList.add("active"));
}

function closeShipDisabledOverlay() {
  const overlay = document.getElementById("shipDisabledOverlay");
  if (overlay) {
    overlay.classList.remove("active");
    overlay.classList.remove("tutorial-intro-active");
    overlay.classList.remove("tutorial-left-card");
    overlay.classList.remove("tutorial-bottom-card");
    overlay.classList.remove("tutorial-outro-active");
    overlay.classList.remove("tutorial-outro-active");
    overlay.classList.remove("tutorial-left-card");
    overlay.classList.remove("tutorial-bottom-card");
  }
}

function toggleShield() {
  // Shield is now passive and always active.
}

/* Sector Map */

function openSectorMap() {
  if (!LupenMovementRules.canOpenSectorMap(jumpCharge, jumpMax)) return;
  document.getElementById("sectorMap").classList.add("active");
  renderSectorMap();
  tutorialEvent("openedSectorMap");
  if (tutorialState.active && [
    "make-jump",
    "scan-for-bots",
    "jump-to-bounty-zone",
    "return-to-planet-after-bounty"
  ].includes(getCurrentTutorialStep()?.id)) {
    setTimeout(renderStarterTutorial, 60);
  }
}

function closeSectorMap() {
  document.getElementById("sectorMap").classList.remove("active");
}

function renderSectorMap() {
  const svg = document.getElementById("sectorSvg");
  svg.innerHTML = "";
  addMapDefs(svg);
  drawMapZones(svg);
  drawRoutes(svg);
  drawNodes(svg);
  drawSectorScanMarkers(svg);
  if (window.LupenMultiplayerOverlay?.render) window.LupenMultiplayerOverlay.render();
  updateSectorScanPanel();
}

function getActiveObjectiveTargetNode() {
  const objective = typeof getActiveObjective === "function" ? getActiveObjective() : null;
  if (!objective) return null;

  if (objective.type === "trade" && typeof getTradeObjectiveTargetNode === "function") {
    return getTradeObjectiveTargetNode(objective);
  }

  if (objective.type === "bounty") {
    if (objective.status === "readyToClaim" || objective.kills >= objective.killsRequired) {
      return getNearestPlanetNode(currentNode);
    }
    return getNearestActiveBountyBotNode(currentNode) || getNearestBountyAreaNode(currentNode, objective.targetArea);
  }

  return null;
}

function getActiveObjectiveRouteNodes() {
  return typeof getObjectiveRoutePath === "function" ? getObjectiveRoutePath() : [];
}

function getActiveObjectiveMapLabel() {
  const objective = typeof getActiveObjective === "function" ? getActiveObjective() : null;
  if (!objective) return "";
  if (objective.type === "trade") {
    const target = getActiveObjectiveTargetNode();
    return target ? `Objective: ${target}` : "Trade objective";
  }
  if (objective.type === "bounty") {
    if (objective.status === "readyToClaim" || objective.kills >= objective.killsRequired) return "Claim reward";
    return "Bounty target";
  }
  return "Objective";
}

function isActiveObjectiveClaimRewardTarget(nodeName) {
  const objective = typeof getActiveObjective === "function" ? getActiveObjective() : null;
  if (!objective || objective.type !== "bounty") return false;
  const readyToClaim = objective.status === "readyToClaim" || objective.kills >= objective.killsRequired;
  return readyToClaim && sectorNodes[nodeName]?.type === "planet" && getActiveObjectiveTargetNode() === nodeName;
}


function getSectorScanRemainingMs(targetTime) {
  return Math.max(0, Math.ceil((Number(targetTime || 0) - Date.now()) / 1000));
}

function isSectorScanActive() {
  return Date.now() < Number(sectorScanState.activeUntil || 0) && !!sectorScanState.result;
}

function getSectorScanCooldownUntil(type) {
  return Number(sectorScanState.cooldownUntilByType?.[type] || 0);
}

function hasSectorScanCooldownsActive() {
  const now = Date.now();
  return ["ally", "bot", "enemy"].some(type => now < getSectorScanCooldownUntil(type));
}

function getBotScanSignals() {
  const grouped = new Map();
  hostileBots
    .filter(bot => bot.alive && sectorNodes[bot.currentNodeId || bot.node])
    .forEach(bot => {
      const nodeId = bot.currentNodeId || bot.node;
      if (!grouped.has(nodeId)) {
        const node = sectorNodes[nodeId];
        grouped.set(nodeId, {
          type: "bot",
          node: nodeId,
          x: node.x,
          y: node.y,
          count: 0,
          names: [],
          classes: [],
          threats: [],
          aggroStates: [],
          images: []
        });
      }
      const signal = grouped.get(nodeId);
      signal.count += 1;
      signal.names.push(bot.displayName || bot.name);
      signal.classes.push(bot.className || "Bot");
      signal.threats.push(bot.threat || "Medium");
      signal.aggroStates.push(bot.aggroState || "neutral");
      signal.images.push(bot.image || "");
    });

  return Array.from(grouped.values());
}

function summarizeBotScanZones(signals) {
  const summary = { upper: 0, lower: 0, core: 0 };
  (signals || []).forEach(signal => {
    const node = sectorNodes[signal.node];
    if (!node) return;
    if (node.y < 45) summary.upper += signal.count;
    else if (node.y > 55) summary.lower += signal.count;
    else summary.core += signal.count;
  });

  return Object.entries(summary)
    .filter(([, count]) => count > 0)
    .map(([zone, count]) => `${formatNumber(count)} ${zone === "upper" ? "upper" : zone === "lower" ? "lower" : "core"} signal${count === 1 ? "" : "s"}`)
    .join(" / ");
}

function getSectorScanResultForType(type) {
  if (type === "bot") {
    return {
      botSignals: getBotScanSignals(),
      allySignals: [],
      enemySignals: []
    };
  }

  return {
    botSignals: [],
    allySignals: [],
    enemySignals: []
  };
}

function scanSector(type = "bot") {
  const scanType = ["ally", "bot", "enemy"].includes(type) ? type : "bot";
  const now = Date.now();
  const cooldownUntil = getSectorScanCooldownUntil(scanType);

  if (now < cooldownUntil) {
    updateSectorScanPanel();
    return;
  }

  const scanResult = getSectorScanResultForType(scanType);
  const cooldownMs = Number(SECTOR_SCAN_COOLDOWNS_MS[scanType] || 0);
  sectorScanState = {
    activeUntil: now + SECTOR_SCAN_DURATION_MS,
    cooldownUntilByType: {
      ...(sectorScanState.cooldownUntilByType || {}),
      [scanType]: now + cooldownMs
    },
    result: {
      createdAt: now,
      type: scanType,
      ...scanResult
    }
  };

  if (scanType === "bot") {
    const zoneSummary = summarizeBotScanZones(scanResult.botSignals) || "no bot contacts detected";
    addActivityLog(`Bot scan complete: ${zoneSummary}.`);
    tutorialEvent("scannedBots");
  } else if (scanType === "ally") {
    addActivityLog("Ally scan complete: no allied pilot signals detected.");
  } else {
    addActivityLog("Enemy scan complete: no enemy pilot signals detected.");
  }

  renderSectorMap();
  if (tutorialState?.active && ["scan-for-bots", "destroy-bot"].includes(getCurrentTutorialStep()?.id)) {
    setTimeout(renderStarterTutorial, 60);
  }
  startSectorScanTicker();

  window.setTimeout(() => {
    if (!isSectorScanActive()) {
      renderSectorMap();
      updateSectorScanPanel();
    }
  }, SECTOR_SCAN_DURATION_MS + 120);
}

function startSectorScanTicker() {
  if (sectorScanTicker) return;
  sectorScanTicker = window.setInterval(() => {
    updateSectorScanPanel();
    if (!isSectorScanActive() && !hasSectorScanCooldownsActive()) {
      window.clearInterval(sectorScanTicker);
      sectorScanTicker = null;
    }
  }, 250);
}

function updateScanButtonProgress(button, type) {
  if (!button) return;
  const now = Date.now();
  const cooldownMs = Number(SECTOR_SCAN_COOLDOWNS_MS[type] || 0);
  const cooldownUntil = getSectorScanCooldownUntil(type);
  const remainingMs = Math.max(0, cooldownUntil - now);
  const remainingSeconds = getSectorScanRemainingMs(cooldownUntil);
  const progress = cooldownMs > 0 && remainingMs > 0 ? Math.min(1, remainingMs / cooldownMs) : 0;

  button.disabled = remainingMs > 0;
  button.classList.toggle("cooldown", remainingMs > 0);
  button.style.setProperty("--scan-progress", progress.toFixed(3));
  const label = type === "ally" ? "Allies" : type === "enemy" ? "Enemies" : "Bots";
  const labelNode = button.querySelector("span") || button;
  labelNode.textContent = remainingMs > 0 ? `${label} ${remainingSeconds}s` : label;
}

function updateSectorScanPanel() {
  const status = document.getElementById("sectorScanStatus");
  const buttons = {
    ally: document.getElementById("sectorScanAlliesBtn"),
    bot: document.getElementById("sectorScanBotsBtn"),
    enemy: document.getElementById("sectorScanEnemiesBtn")
  };
  if (!status) return;

  Object.entries(buttons).forEach(([type, button]) => updateScanButtonProgress(button, type));

  const active = isSectorScanActive();
  if (active) {
    const visibleRemaining = getSectorScanRemainingMs(sectorScanState.activeUntil);
    const scanType = sectorScanState.result?.type || "bot";
    const botCount = (sectorScanState.result?.botSignals || []).reduce((sum, signal) => sum + signal.count, 0);
    if (scanType === "bot") {
      status.textContent = `Bot result visible ${visibleRemaining}s / ${formatNumber(botCount)} signal${botCount === 1 ? "" : "s"}`;
    } else if (scanType === "ally") {
      status.textContent = `Ally result visible ${visibleRemaining}s / no allied signals`;
    } else {
      status.textContent = `Enemy result visible ${visibleRemaining}s / no enemy signals`;
    }
    status.classList.add("active");
  } else if (hasSectorScanCooldownsActive()) {
    status.textContent = "Scanner cooldown active";
    status.classList.remove("active");
  } else {
    status.textContent = "Scanners ready";
    status.classList.remove("active");
  }
}

function drawSectorScanMarkers(svg) {
  if (!isSectorScanActive()) return;

  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("class", "svg-scan-marker-layer");

  const drawSignal = (signal, type) => {
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "g");
    marker.setAttribute("class", `svg-scan-marker scan-${type}`);
    marker.setAttribute("data-node", signal.node || "");
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = signal.names?.length
      ? `${signal.node}: ${signal.names.map((name, index) => `${name} / ${signal.classes?.[index] || "Bot"} / ${signal.threats?.[index] || "Medium"} / ${signal.aggroStates?.[index] || "neutral"}`).join(", ")}`
      : `${signal.node || "Unknown signal"}`;
    marker.appendChild(title);

    const pulse = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    pulse.setAttribute("cx", signal.x);
    pulse.setAttribute("cy", signal.y);
    pulse.setAttribute("r", 2.5);
    pulse.setAttribute("class", "scan-pulse");
    marker.appendChild(pulse);

    const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    ring.setAttribute("cx", signal.x);
    ring.setAttribute("cy", signal.y);
    ring.setAttribute("r", 1.45);
    ring.setAttribute("class", "scan-ring");
    marker.appendChild(ring);

    if (signal.count > 1) {
      const count = document.createElementNS("http://www.w3.org/2000/svg", "text");
      count.setAttribute("x", signal.x + 2.2);
      count.setAttribute("y", signal.y - 1.8);
      count.setAttribute("class", "scan-count");
      count.textContent = signal.count;
      marker.appendChild(count);
    }

    group.appendChild(marker);
  };

  (sectorScanState.result?.botSignals || []).forEach(signal => drawSignal(signal, "bot"));
  (sectorScanState.result?.allySignals || []).forEach(signal => drawSignal(signal, "ally"));
  (sectorScanState.result?.enemySignals || []).forEach(signal => drawSignal(signal, "enemy"));

  svg.appendChild(group);
}

function addMapDefs(svg) {
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.innerHTML = `
    <radialGradient id="planetVirella" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#d5ffe8"/>
      <stop offset="45%" stop-color="#6d9f82"/>
      <stop offset="100%" stop-color="#10261f"/>
    </radialGradient>
    <radialGradient id="planetAsteron" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#b8ecff"/>
      <stop offset="45%" stop-color="#2d83ad"/>
      <stop offset="100%" stop-color="#071a2a"/>
    </radialGradient>
    <radialGradient id="planetNyxara" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#ffd0a2"/>
      <stop offset="45%" stop-color="#b86226"/>
      <stop offset="100%" stop-color="#2c1207"/>
    </radialGradient>
  `;
  svg.appendChild(defs);
}


function drawMapZones(svg) {
  sectorMapZones.forEach(zone => {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", `svg-zone-label zone-${zone.tone}`);

    const name = document.createElementNS("http://www.w3.org/2000/svg", "text");
    name.setAttribute("x", zone.x);
    name.setAttribute("y", zone.y);
    name.setAttribute("class", "svg-zone-name");
    name.textContent = zone.name;
    group.appendChild(name);

    const subtitle = document.createElementNS("http://www.w3.org/2000/svg", "text");
    subtitle.setAttribute("x", zone.x);
    subtitle.setAttribute("y", zone.y + 2.7);
    subtitle.setAttribute("class", "svg-zone-subtitle");
    subtitle.textContent = zone.subtitle;
    group.appendChild(subtitle);

    svg.appendChild(group);
  });
}

function getRouteTone(node, targetNode) {
  const tones = [node.route, targetNode.route];

  if (tones.includes("combat")) return "combat-route";
  if (tones.includes("risky")) return "risky-route";
  if (tones.includes("loot")) return "loot-route";
  if (tones.includes("mining")) return "mining-route";
  return "safe-route";
}

function drawRoutes(svg) {
  const drawnRoutes = new Set();
  const objectivePath = getActiveObjectiveRouteNodes();

  Object.entries(sectorNodes).forEach(([name, node]) => {
    node.connects.forEach(target => {
      const key = [name, target].sort().join("|");
      if (drawnRoutes.has(key)) return;
      drawnRoutes.add(key);

      const targetNode = sectorNodes[target];
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", node.x);
      line.setAttribute("y1", node.y);
      line.setAttribute("x2", targetNode.x);
      line.setAttribute("y2", targetNode.y);
      const isAvailableRoute = name === currentNode || target === currentNode;
      const isPlannedTradeRoute = isLineOnActiveTradeRoute(name, target);
      const isObjectiveStep = objectivePath.some((nodeName, index) => {
        const nextNode = objectivePath[index + 1];
        return (nodeName === name && nextNode === target) || (nodeName === target && nextNode === name);
      });
      const routeTone = getRouteTone(node, targetNode);
      line.setAttribute("class", `svg-route ${isAvailableRoute ? "available" : ""} ${isPlannedTradeRoute ? "planned-trade-route" : ""} ${isObjectiveStep ? "objective-route-step" : ""} ${routeTone}`);
      svg.appendChild(line);
    });
  });
}

function drawNodes(svg) {
  const objectiveTarget = getActiveObjectiveTargetNode();
  const objectiveRoute = getActiveObjectiveRouteNodes();
  Object.entries(sectorNodes).forEach(([name, node]) => {
    const isCurrent = name === currentNode;
    const canJump = LupenMovementRules.isAdjacentNode(sectorNodes, currentNode, name);
    const isObjectiveTarget = objectiveTarget === name;
    const isObjectivePath = objectiveRoute.includes(name);
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");

    group.style.cursor = canJump || isCurrent ? "pointer" : "not-allowed";
    group.onclick = () => jumpToNode(name);
    group.setAttribute("class", `${isCurrent ? "svg-player-node" : ""} ${isObjectiveTarget ? "svg-objective-target-node" : ""} ${isObjectivePath ? "svg-objective-path-node" : ""}`);

    if (node.type === "planet") {
      drawPlanetNode(group, name, node, isCurrent, canJump, isObjectiveTarget);
    } else {
      drawSpaceNode(group, node, isCurrent, canJump, isObjectiveTarget);
    }

    svg.appendChild(group);
  });
}

function drawObjectiveTargetMarker(group, node, options = {}) {
  const isClaimReward = options.variant === "claimReward";
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "g");
  marker.setAttribute("class", `svg-objective-target-marker ${isClaimReward ? "claim-reward-note" : ""}`.trim());

  const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  ring.setAttribute("cx", node.x);
  ring.setAttribute("cy", node.y);
  ring.setAttribute("r", 4.35);
  ring.setAttribute("class", "objective-target-ring");
  marker.appendChild(ring);

  const pointer = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pointer.setAttribute("d", `M ${node.x} ${node.y - 6.4} l 1.7 -2.4 h -3.4 z`);
  pointer.setAttribute("class", "objective-target-pointer");
  marker.appendChild(pointer);

  if (isClaimReward) {
    const note = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    note.setAttribute("x", node.x - 6.35);
    note.setAttribute("y", node.y - 10.65);
    note.setAttribute("width", 12.7);
    note.setAttribute("height", 2.75);
    note.setAttribute("rx", 0.72);
    note.setAttribute("class", "objective-target-note");
    marker.appendChild(note);
  }

  const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
  label.setAttribute("x", node.x);
  label.setAttribute("y", isClaimReward ? node.y - 8.82 : node.y - 7.7);
  label.setAttribute("class", `objective-target-label ${isClaimReward ? "claim-reward-label" : ""}`.trim());
  label.textContent = getActiveObjectiveMapLabel();
  marker.appendChild(label);

  group.appendChild(marker);
}

function drawPlanetNode(group, name, node, isCurrent, canJump, isObjectiveTarget = false) {
  const isPlanned = isNodeOnActiveTradeRoute(name);
  const isClaimRewardTarget = isActiveObjectiveClaimRewardTarget(name);
  if (isObjectiveTarget && (!isCurrent || isClaimRewardTarget)) {
    drawObjectiveTargetMarker(group, node, { variant: isClaimRewardTarget ? "claimReward" : "objective" });
  }

  const glow = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  glow.setAttribute("cx", node.x);
  glow.setAttribute("cy", node.y);
  glow.setAttribute("r", 3.8);
  glow.setAttribute("fill", "rgba(80, 180, 255, 0.12)");
  group.appendChild(glow);

  const planet = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  planet.setAttribute("cx", node.x);
  planet.setAttribute("cy", node.y);
  planet.setAttribute("r", 2.6);
  planet.setAttribute("fill", node.planetClass === "virella" ? "url(#planetVirella)" : node.planetClass === "nyxara" ? "url(#planetNyxara)" : "url(#planetAsteron)");
  if (!canJump && !isCurrent) planet.setAttribute("opacity", "0.45");
  group.appendChild(planet);

  const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  ring.setAttribute("cx", node.x);
  ring.setAttribute("cy", node.y);
  ring.setAttribute("r", isCurrent ? 3.5 : 3.0);
  ring.setAttribute("class", isCurrent ? "svg-current-ring" : isObjectiveTarget ? "svg-objective-target-ring" : isPlanned ? "svg-planned-trade-ring" : "svg-planet-ring");
  group.appendChild(ring);

  const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
  label.setAttribute("x", node.x);
  label.setAttribute("y", node.y + 5.2);
  label.setAttribute("class", "svg-planet-label");
  label.textContent = name;
  group.appendChild(label);

  const hit = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  hit.setAttribute("cx", node.x);
  hit.setAttribute("cy", node.y);
  hit.setAttribute("r", 5.5);
  hit.setAttribute("class", "svg-node-hit");
  group.appendChild(hit);
}

function drawSpaceNode(group, node, isCurrent, canJump, isObjectiveTarget = false) {
  const nodeName = Object.keys(sectorNodes).find(name => sectorNodes[name] === node);
  const isPlanned = isNodeOnActiveTradeRoute(nodeName);
  if (isObjectiveTarget && !isCurrent && !isActiveObjectiveClaimRewardTarget(nodeName)) drawObjectiveTargetMarker(group, node);

  const star = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  star.setAttribute("cx", node.x);
  star.setAttribute("cy", node.y);
  star.setAttribute("r", node.route === "safe" ? 0.72 : 0.82);
  star.setAttribute("class", `svg-space-node ${node.route || "safe"} ${node.danger === "hostile" ? "hostile" : "safe"} ${isPlanned ? "planned-trade-node" : ""} ${isObjectiveTarget ? "objective-target-node" : ""} ${!canJump && !isCurrent ? "locked" : ""}`);
  group.appendChild(star);

  if (isCurrent) {
    const currentRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    currentRing.setAttribute("cx", node.x);
    currentRing.setAttribute("cy", node.y);
    currentRing.setAttribute("r", 1.4);
    currentRing.setAttribute("class", "svg-current-ring");
    group.appendChild(currentRing);
  }

  const hit = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  hit.setAttribute("cx", node.x);
  hit.setAttribute("cy", node.y);
  hit.setAttribute("r", 2.8);
  hit.setAttribute("class", "svg-node-hit");
  group.appendChild(hit);
}

function jumpToNode(destination) {
  const transition = LupenMovementRules.getJumpTransition(sectorNodes, currentNode, destination, jumpCharge, jumpMax);
  if (!transition.canJump) return;

  currentNode = destination;
  if (transition.isPlanetDestination) {
    lastPlanetNode = currentNode;
  }

  playJumpSound();
  jumpCharge = 0;
  closeSectorMap();
  disengageTarget(true);
  // Keep the currently selected HUD tab when jumping between nodes.
  maybeMoveAsteroid();
  updateCurrentNodeUI();
  updateSpaceHUD();
  updateAsteroidUI();
  syncMultiplayerPresence("jump");
  tutorialEvent("jumpedNode");
  if (tutorialState?.active) setTimeout(renderStarterTutorial, 120);
  startJumpRecharge();
  saveGame();
}

const SPACE_BACKGROUND_SIZE = { width: 1672, height: 941 };
const PLANET_LANDING_TARGET = {
  centerX: 1528,
  centerY: 131,
  diameter: 190
};

function syncPlanetLandingTarget() {
  const landBtn = document.getElementById("planetLandBtn");
  const spaceScreen = document.getElementById("spaceScreen");
  if (!landBtn || !spaceScreen) return;

  const rect = spaceScreen.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const scale = Math.max(
    rect.width / SPACE_BACKGROUND_SIZE.width,
    rect.height / SPACE_BACKGROUND_SIZE.height
  );
  const renderedWidth = SPACE_BACKGROUND_SIZE.width * scale;
  const renderedHeight = SPACE_BACKGROUND_SIZE.height * scale;
  const offsetX = (rect.width - renderedWidth) / 2;
  const offsetY = (rect.height - renderedHeight) / 2;
  const size = PLANET_LANDING_TARGET.diameter * scale;
  const left = offsetX + (PLANET_LANDING_TARGET.centerX * scale) - (size / 2);
  const top = offsetY + (PLANET_LANDING_TARGET.centerY * scale) - (size / 2);

  landBtn.style.setProperty("left", `${left}px`, "important");
  landBtn.style.setProperty("top", `${top}px`, "important");
  landBtn.style.setProperty("right", "auto", "important");
  landBtn.style.setProperty("width", `${size}px`, "important");
  landBtn.style.setProperty("height", `${size}px`, "important");
}

function updateCurrentNodeUI() {
  const node = sectorNodes[currentNode];
  const nodeNameTag = document.getElementById("nodeNameTag");
  const landBtn = document.getElementById("planetLandBtn");
  const spaceScreen = document.getElementById("spaceScreen");
  const mineralsBox = document.getElementById("sectorMinerals");

  if (nodeNameTag) {
    nodeNameTag.textContent = node.type === "planet" ? `${currentNode.toUpperCase()} ORBIT` : currentNode.toUpperCase();
  }

  if (landBtn) {
    const canLand = node?.type === "planet";
    landBtn.style.display = canLand ? "block" : "none";
    landBtn.style.pointerEvents = canLand ? "auto" : "none";
    landBtn.disabled = !canLand;
    landBtn.hidden = !canLand;
    landBtn.tabIndex = canLand ? 0 : -1;
    landBtn.setAttribute("aria-hidden", canLand ? "false" : "true");
    if (canLand) syncPlanetLandingTarget();
  }

  if (spaceScreen) {
    spaceScreen.classList.toggle("empty-node", node.type !== "planet");
  }

  if (mineralsBox) {
    const minerals = nodeMineralPools[currentNode] || [];
    mineralsBox.innerHTML = minerals.length ? minerals.join(", ") : "No mineral traces.";
  }

  updateHudDock();
}

