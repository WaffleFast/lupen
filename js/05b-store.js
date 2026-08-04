/* Station Store catalogue, detail, pricing, and purchase flows. */

function getStoreItemDisplayQuality(item) {
  if (!item) return "standard";
  if (item.fixedQuality) return item.fixedQuality;
  return item.qualityEnabled ? selectedStoreQuality : "standard";
}

function getStoreDayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getStoreResetSeconds() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000));
}

function formatStoreResetCountdown() {
  const seconds = getStoreResetSeconds();
  const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const remainder = String(seconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${remainder}`;
}

function updateStoreResetTimer() {
  const timerEl = document.getElementById("storeResetTimerText");
  if (timerEl) {
    timerEl.textContent = `Store items refresh in ${formatStoreResetCountdown()}`;
  }
}

function startStoreTimer() {
  stopStoreTimer();
  renderedStoreDayKey = getStoreDayKey();
  updateStoreResetTimer();
  storeDailyTimer = setInterval(() => {
    updateStoreResetTimer();
    const dayKey = getStoreDayKey();
    if (dayKey !== renderedStoreDayKey && document.getElementById("storeScreen")?.classList.contains("active")) {
      renderedStoreDayKey = dayKey;
      renderStore();
    }
  }, 1000);
}

function stopStoreTimer() {
  if (storeDailyTimer) {
    clearInterval(storeDailyTimer);
    storeDailyTimer = null;
  }
}

function getDailyStoreSeed() {
  const dateKey = getStoreDayKey();
  let hash = 0;
  for (let i = 0; i < dateKey.length; i += 1) {
    hash = ((hash << 5) - hash) + dateKey.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getDailyStoreItem(baseItems) {
  return null;
}

function getStoreMaterialItems() {
  return [];
}


function getStoreDailyPurchaseCount(item) {
  if (!item?.dailyStock) return 0;
  const dayKey = getStoreDayKey();
  return Number(storeDailyPurchases?.[dayKey]?.[item.id] || 0);
}

function getStoreStockLimit(item) {
  if (!item) return Infinity;
  if (Number.isFinite(Number(item.stockLimit))) return Math.max(0, Number(item.stockLimit));
  return item.dailyStock ? 1 : Infinity;
}

function getStoreStockRemaining(item) {
  const limit = getStoreStockLimit(item);
  if (!Number.isFinite(limit)) return Infinity;
  return Math.max(0, limit - getStoreDailyPurchaseCount(item));
}

function getStoreStockLabel(item) {
  const remaining = getStoreStockRemaining(item);
  return Number.isFinite(remaining) ? `${remaining} in stock` : "Unlimited stock";
}

function recordStorePurchase(item) {
  if (!item?.dailyStock) return;
  const dayKey = getStoreDayKey();
  storeDailyPurchases[dayKey] = storeDailyPurchases[dayKey] || {};
  storeDailyPurchases[dayKey][item.id] = getStoreDailyPurchaseCount(item) + 1;
}

function pruneStoreDailyPurchases() {
  const dayKey = getStoreDayKey();
  storeDailyPurchases = storeDailyPurchases && typeof storeDailyPurchases === "object" ? storeDailyPurchases : {};
  Object.keys(storeDailyPurchases).forEach(key => {
    if (key !== dayKey) delete storeDailyPurchases[key];
  });
}

function getStoreCatalogItems() {
  const items = [];

  Object.entries(GUNS).forEach(([key, item]) => {
    if (item.hiddenFromStore) return;
    if (!MAP_ONE_STORE_GUN_KEYS.includes(key)) return;
    items.push({
      id: `gun:${key}`,
      kind: "gun",
      key,
      name: item.name,
      category: "guns",
      image: item.image,
      description: item.description,
      basePrice: item.price,
      qualityEnabled: false,
      storeTier: "Core Stock",
      stats: getWeaponPurchaseStatRows(item, "standard")
    });
  });

  Object.entries(attachments).forEach(([key, item]) => {
    if (!MAP_ONE_STORE_ATTACHMENT_KEYS.includes(key)) return;
    items.push({
      id: `attachment:${key}`,
      kind: "attachment",
      key,
      name: item.name,
      category: "attachments",
      image: item.image,
      description: item.description,
      basePrice: item.price,
      qualityEnabled: false,
      storeTier: "Core Stock",
      stats: getAttachmentPurchaseStatRows({ key }, "standard")
    });
  });

  items.push(...getStoreMaterialItems());

  const dailyItem = getDailyStoreItem(items);
  if (dailyItem) {
    items.push(dailyItem);
  }

  const order = new Map(MAP_ONE_STORE_CATALOG_ORDER.map((key, index) => [key, index]));
  return items.sort((a, b) => {
    if (a.dailyStock !== b.dailyStock) return a.dailyStock ? 1 : -1;
    const aLocked = a.kind === "gun" || a.kind === "attachment"
      ? getEquipmentUnlockStatus(a.kind === "gun" ? "guns" : "attachments", a.key).locked
      : false;
    const bLocked = b.kind === "gun" || b.kind === "attachment"
      ? getEquipmentUnlockStatus(b.kind === "gun" ? "guns" : "attachments", b.key).locked
      : false;
    if (aLocked !== bLocked) return aLocked ? 1 : -1;
    const delta = (order.get(a.key) ?? 99) - (order.get(b.key) ?? 99);
    if (delta !== 0) return delta;
    return a.name.localeCompare(b.name);
  });
}

function isStoreOwnedItem(item, quality = selectedStoreQuality) {
  if (!item) return false;
  if (item.kind === "ship") return false;
  if (item.kind === "material") {
    return Number(upgradeMaterials?.[item.key] || 0) > 0;
  }
  if (item.kind === "core") {
    return getStoreItemInventoryCount(item, quality) > 0;
  }
  if (item.kind === "attachment" || item.kind === "gun") {
    return (getStoreOwnedReadyCount(item) + getStoreItemInventoryCount(item, quality)) > 0;
  }
  return false;
}

function getStoreFilteredItems() {
  const items = getStoreCatalogItems();
  if (storeFilter === "all") return items;
  if (storeFilter === "owned") {
    return items.filter(item => isStoreOwnedItem(item, getStoreItemDisplayQuality(item)));
  }
  return items.filter(item => item.category === storeFilter);
}

function getStoreSelectedItem() {
  return getStoreCatalogItems().find(item => item.id === selectedStoreItemId) || null;
}

function getStoreCatalogItem(kind, key) {
  return getStoreCatalogItems().find(item => item.kind === kind && item.key === key) || null;
}

function canPurchaseStoreItem(item, quality = getStoreItemDisplayQuality(item)) {
  if (!item) return { ok: false, reason: "missing_item", message: "Store item unavailable." };
  const stockRemaining = getStoreStockRemaining(item);
  if (stockRemaining <= 0) return { ok: false, reason: "sold_out", message: "This daily store item has sold out." };

  const unlock = item.kind === "gun" || item.kind === "attachment"
    ? getEquipmentUnlockStatus(item.kind === "gun" ? "guns" : "attachments", item.key)
    : item.kind === "ship"
      ? getShipUnlockStatus(item.key)
      : null;
  if (unlock?.locked) return { ok: false, reason: "locked", message: unlock.message || "Reach the required level to unlock this." };

  if (item.kind === "ship" && ownedShips.includes(item.key)) {
    return { ok: false, reason: "owned", message: "Ship already owned." };
  }

  const price = getStorePrice(item, quality);
  if (credits < price) return { ok: false, reason: "credits", message: "Not enough credits." };
  return { ok: true, price, stockRemaining };
}

function notifyStorePurchaseBlocked(result) {
  const message = result?.message || "Purchase unavailable.";
  if (typeof addHudToast === "function") addHudToast(message);
  else alert(message);
}

function ensureStoreSelection() {
  if (!["all", "guns", "attachments", "owned"].includes(storeFilter)) {
    storeFilter = "all";
  }
  selectedStoreQuality = "standard";
  const filtered = getStoreFilteredItems();
  if (!filtered.length) {
    selectedStoreItemId = null;
    return;
  }

  if (!filtered.some(item => item.id === selectedStoreItemId)) {
    selectedStoreItemId = filtered[0].id;
  }

  const selected = getStoreSelectedItem();
  if (selected && !selected.qualityEnabled && !selected.fixedQuality) {
    selectedStoreQuality = "standard";
  }
}

function getItemStatMultiplier(quality = "standard") {
  return ITEM_QUALITY_STAT_MULTIPLIERS[quality] || 1;
}

function getStoreGunAttack(item, quality = "standard") {
  const gun = GUNS[item?.key];
  if (!gun) return 0;
  const damage = getGunDamageForQuality(gun, quality);
  return Math.round((damage.shield + damage.armor + damage.hull) / 3);
}

function getGunDamageForQuality(gun, quality = "standard") {
  const multiplier = getItemStatMultiplier(quality);
  const base = typeof getWeaponLayerDamage === "function"
    ? getWeaponLayerDamage(gun)
    : { shield: Number(gun?.damage || 0), armor: Number(gun?.damage || 0), hull: Number(gun?.damage || 0) };
  return {
    shield: Math.max(1, Math.round(base.shield * multiplier)),
    armor: Math.max(1, Math.round(base.armor * multiplier)),
    hull: Math.max(1, Math.round(base.hull * multiplier))
  };
}

function getGunFireRateText(gun) {
  const fireRate = Number(gun?.fireRate || (gun?.speed ? 1000 / gun.speed : 0));
  return `${fireRate.toFixed(1)}/s`;
}

function getGunFireRateValue(gun) {
  return Number(gun?.fireRate || (gun?.speed ? 1000 / gun.speed : 0)) || 0;
}

function getWeaponPurchaseDamage(gun, quality = "standard") {
  return getStoreGunAttack({ key: gun?.key || gun?.familyId }, quality);
}

function getWeaponPurchaseStatRows(gun, quality = "standard") {
  const damage = getWeaponPurchaseDamage(gun, quality);
  const fireRate = getGunFireRateValue(gun);
  const dps = damage * fireRate;
  return [
    { label: "Damage", value: formatNumber(damage) },
    { label: "Fire Rate", value: getGunFireRateText(gun) },
    { label: "DPS", value: fireRate > 0 ? dps.toFixed(1) : "0.0" }
  ];
}

function getStoreAttachmentEffectText(item, quality = "standard") {
  const attachment = attachments[item?.key];
  if (!attachment) return item?.description || "";
  const multiplier = getItemStatMultiplier(quality);
  const effects = Object.entries(attachment.effect || {}).map(([effectKey, value]) => {
    const scaled = Math.max(1, Math.round(value * multiplier));
    const label = effectKey === "jumpRecharge"
      ? "Jump Speed"
      : effectKey === "evasion"
        ? "Evasion"
        : effectKey.charAt(0).toUpperCase() + effectKey.slice(1);
    const suffix = effectKey === "evasion" ? "%" : "";
    return `+${scaled}${suffix} ${label}`;
  });
  return effects.join(" / ") || attachment.description || "";
}

function formatAttachmentEffectValue(effectKey, value) {
  const numeric = Number(value) || 0;
  if (effectKey === "evasion") return `+${formatNumber(numeric)}%`;
  if (effectKey === "jumpRecharge") return `+${formatNumber(numeric)}`;
  return `+${formatNumber(numeric)}`;
}

function getAttachmentPurchaseStatRows(item, quality = "standard") {
  const attachment = attachments[item?.key];
  if (!attachment) return [];
  const multiplier = getItemStatMultiplier(quality);
  const effectLabels = {
    cargo: "Cargo",
    hull: "Hull",
    shield: "Shield",
    evasion: "Evasion",
    jumpRecharge: "Jump Range",
    recharge: "Recharge",
    cooldown: "Cooldown",
    mass: "Mass"
  };

  return Object.entries(attachment.effect || {}).map(([effectKey, value]) => {
    const scaled = Math.max(1, Math.round(Number(value || 0) * multiplier));
    const label = effectLabels[effectKey] || effectKey.charAt(0).toUpperCase() + effectKey.slice(1);
    const displayValue = effectKey === "cooldown"
      ? `-${formatNumber(scaled)}%`
      : formatAttachmentEffectValue(effectKey, scaled);
    return { label, value: displayValue };
  });
}


function getInventoryEffectLine(entry) {
  if (!entry) return "";
  const quality = entry.quality || "standard";
  if (entry.kind === "gun" && GUNS[entry.key]) {
    const rows = getWeaponPurchaseStatRows(GUNS[entry.key], quality);
    return rows.map(row => `${row.label} ${row.value}`).join(" / ");
  }
  if (entry.kind === "attachment" && attachments[entry.key]) {
    return getStoreAttachmentEffectText({ key: entry.key }, quality);
  }
  if (entry.type === "core" || itemDefinitions[entry.key]?.core) {
    return "Upgrade material";
  }
  return "";
}

function getStoreDetailStats(item, quality = "standard") {
  if (!item) return [];

  if (item.kind === "gun") {
    const gun = GUNS[item.key];
    if (!gun) return [];
    return getWeaponPurchaseStatRows(gun, quality);
  }

  if (item.kind === "attachment") {
    return getAttachmentPurchaseStatRows(item, quality);
  }

  if (item.kind === "material") {
    return item.stats || [
      { label: "Use", value: "Forge upgrades" },
      { label: "Stored", value: "Materials" }
    ];
  }

  if (item.kind === "core") {
    return item.stats || [
      { label: "Tier", value: "Rare catalyst" },
      { label: "Use", value: "Forge quality upgrades" }
    ];
  }

  if (item.kind === "ship") {
    const ship = SHIPS[item.key];
    if (!ship) return [];
    return [
      { label: "Hull", value: formatNumber(ship.baseHull) },
      { label: "Shield", value: formatNumber(ship.baseShield) }
    ];
  }

  return [];
}

function getStorePrice(item, quality = "standard") {
  if (!item) return 0;
  if (!item.qualityEnabled) return item.basePrice;
  const multiplier = ITEM_QUALITY_BUY_MULTIPLIERS[quality] || 1;
  return Math.max(1, Math.round(item.basePrice * multiplier));
}

function getStoreItemInventoryCount(item, quality = "standard") {
  if (item?.kind === "material") return Number(upgradeMaterials?.[item.key] || 0);
  return inventoryItems.filter(entry => entry.key === item.key && entry.quality === quality).length;
}

function getStoreOwnedReadyCount(item) {
  if (!item) return 0;
  if (item.kind === "gun") return ownedGuns[item.key] || 0;
  if (item.kind === "attachment") return ownedAttachments[item.key] || 0;
  return 0;
}

function setStoreFilter(nextFilter) {
  storeFilter = nextFilter;
  ensureStoreSelection();
  renderStore();
}

function selectStoreItem(itemId) {
  selectedStoreItemId = itemId;
  const item = getStoreSelectedItem();
  if (item && !item.qualityEnabled && !item.fixedQuality) {
    selectedStoreQuality = "standard";
  }
  renderStore();

  // Tutorial purchases are two-part: select the required item, then buy it.
  // Refresh after selection so the highlight moves onto the Purchase button.
  if (tutorialState?.active && ["buy-equipment", "buy-second-weapon", "buy-store-attachment"].includes(getCurrentTutorialStep()?.id)) {
    setTimeout(renderStarterTutorial, 40);
  }
}

function selectStoreQuality(quality) {
  selectedStoreQuality = quality;
  renderStore();
}

function renderStore() {
  setupMultiplayerStagingStoreSubscription();
  requestMultiplayerStagingStoreItemsIfNeeded();

  const tutorialStoreStepId = tutorialState?.active ? getCurrentTutorialStep()?.id : "";
  const tutorialStoreGunStep = ["buy-equipment", "buy-second-weapon"].includes(tutorialStoreStepId);
  const tutorialStoreAttachmentStep = tutorialStoreStepId === "buy-store-attachment";
  if (tutorialStoreGunStep || tutorialStoreAttachmentStep) {
    storeFilter = tutorialStoreAttachmentStep ? "attachments" : "guns";
    selectedStoreQuality = "standard";
    const requiredItemKey = tutorialStoreAttachmentStep ? "cargoPod" : "pulseLaser";
    const requiredItemKind = tutorialStoreAttachmentStep ? "attachment" : "gun";
    const requiredItem = getStoreCatalogItems().find(item => item.key === requiredItemKey && item.kind === requiredItemKind);
    if (requiredItem) selectedStoreItemId = requiredItem.id;
  }

  const stagingNodeName = getMultiplayerStagingStoreNodeName();
  const node = sectorNodes[stagingNodeName] || sectorNodes[currentNode] || sectorNodes[lastPlanetNode] || { name: "Asteron Prime" };
  const title = document.getElementById("storeLocationTitle");
  if (title) title.textContent = String(node.name || "Asteron Prime").toUpperCase();

  const creditsEl = document.getElementById("storeCreditsText");
  if (creditsEl) creditsEl.textContent = formatNumber(credits);

  pruneStoreDailyPurchases();
  ensureStoreSelection();
  renderStoreFilters();
  renderStoreQualityFilters();
  renderStoreCatalog();
  renderStoreDetail();

  if (tutorialStoreGunStep || tutorialStoreAttachmentStep) {
    setTimeout(() => {
      const requiredItemKey = tutorialStoreAttachmentStep ? "cargoPod" : "pulseLaser";
      const target = document.querySelector(`.store-detail-buy-action[data-item-key='${requiredItemKey}']:not(:disabled)`) ||
        document.querySelector(`.store-catalog-card[data-item-key='${requiredItemKey}']:not(.sold-out)`);
      target?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      if (typeof renderStarterTutorial === "function") renderStarterTutorial();
    }, 40);
  }
}

function renderStoreFilters() {
  const bar = document.getElementById("storeFilterBar");
  if (!bar) return;

  const filters = [
    { key: "all", label: "All" },
    { key: "guns", label: "Guns" },
    { key: "attachments", label: "Attachments" },
    { key: "owned", label: "Owned" }
  ];

  bar.innerHTML = filters.map(filter => `
    <button type="button" class="store-filter-btn ${storeFilter === filter.key ? "active" : ""}" aria-pressed="${storeFilter === filter.key}" onclick="setStoreFilter('${filter.key}')">${filter.label}</button>
  `).join("");
}


function renderStoreQualityFilters() {
  const bar = document.getElementById("storeQualityBar");
  if (!bar) return;

  selectedStoreQuality = "standard";
  const itemCount = getStoreFilteredItems().length;
  bar.innerHTML = `<span class="store-catalog-count">${formatNumber(itemCount)} ${itemCount === 1 ? "item" : "items"}</span>`;
}

function renderStoreCatalog() {
  const grid = document.getElementById("storeCatalogGrid");
  if (!grid) return;

  const items = getStoreFilteredItems();
  if (!items.length) {
    grid.innerHTML = `<div class="store-empty-state">No items found in this category.</div>`;
    return;
  }

  grid.innerHTML = items.map(item => {
    const quality = getStoreItemDisplayQuality(item);
    const price = getStorePrice(item, quality);
    const ownedCount = item.kind === "ship"
      ? (ownedShips.includes(item.key) ? 1 : 0)
      : item.kind === "material"
        ? Number(upgradeMaterials?.[item.key] || 0)
        : item.kind === "core"
        ? getStoreItemInventoryCount(item, quality)
        : getStoreOwnedReadyCount(item) + getStoreItemInventoryCount(item, quality);
    let status = "";

    if (item.kind === "ship") {
      status = currentShipId === item.key ? "Equipped" : (ownedShips.includes(item.key) ? "Owned" : "");
    } else if (item.kind === "material" || item.kind === "core") {
      status = ownedCount > 0 ? `Owned x${formatNumber(ownedCount)}` : "";
    } else {
      status = ownedCount > 0 ? `Owned x${formatNumber(ownedCount)}` : "";
    }

    const stockLabel = getStoreStockLabel(item);
    const soldOut = getStoreStockRemaining(item) === 0;
    const categoryLabel = getStoreCardCategoryLabel(item, quality);
    const unlock = item.kind === "gun" || item.kind === "attachment"
      ? getEquipmentUnlockStatus(item.kind === "gun" ? "guns" : "attachments", item.key)
      : null;
    const priceLabel = soldOut ? "Sold Out" : `CR ${formatNumber(price)}`;
    const locked = Boolean(unlock?.locked);

    return `
      <button type="button" class="store-catalog-card ${selectedStoreItemId === item.id ? "selected" : ""} ${item.dailyStock ? "daily-stock-card" : ""} ${soldOut ? "sold-out" : ""} ${locked ? "progression-locked" : ""} quality-${quality} store-kind-${item.kind}" data-item-key="${item.key}" data-item-kind="${item.kind}" aria-pressed="${selectedStoreItemId === item.id}" aria-label="${escapeHtml(`${item.name}, ${categoryLabel}, ${priceLabel}`)}" onclick="selectStoreItem('${item.id}')">
        ${locked ? `<span class="store-card-status">LOCKED</span>` : status ? `<span class="store-card-status">${status}</span>` : ""}
        <div class="store-card-art quality-${quality} store-art-${item.kind} store-art-${item.key}">
          ${renderQualityFx(quality, { src: item.kind === "ship" && typeof getShipAsset === "function" ? getShipAsset(item.key, "large") : item.image, alt: item.name, size: "card" })}
        </div>
        <div class="store-card-name">${item.name}</div>
        <div class="store-card-sub">${categoryLabel}</div>
        <div class="store-card-stock">${locked ? escapeHtml(unlock.requirementLines[0] || unlock.message) : stockLabel}</div>
        <div class="store-card-price">${priceLabel}</div>
      </button>`;
  }).join("");
}

function getStoreCardCategoryLabel(item, quality = "standard") {
  if (!item) return "";
  if (item.kind === "gun") return "Gun";
  if (item.kind === "attachment") return "Attachment";
  if (item.kind === "material") return "Forge Material";
  if (item.kind === "core") return "Rare Catalyst";
  if (item.kind === "ship") return "Ship";
  return item.category || "";
}

function getStoreDetailKicker(item, quality = "standard") {
  if (!item) return "";
  if (item.kind === "material") return "Forge Material";
  if (item.kind === "core") return "Rare Catalyst";
  return getStoreCardCategoryLabel(item, quality);
}

function getStoreItemLevelLabel(item) {
  if (!item) return "—";
  if (item.kind === "gun" || item.kind === "attachment") return "1";
  return "—";
}

function getStoreLockedActionLabel(unlock) {
  const combatLevel = Number(unlock?.requirements?.combatLevel || 0);
  if (combatLevel > 0) return `REQUIRES COMBAT LEVEL ${formatNumber(combatLevel)}`;
  return String(unlock?.requirementLines?.[0] || "Purchase unavailable").toUpperCase();
}

function getStoreAvailabilityState({ item, progressionLocked, hasStock, buyPrice }) {
  if (progressionLocked) return { label: "Locked", tone: "locked" };
  if (!hasStock) return { label: "Sold out", tone: "sold-out" };
  if (item?.kind === "ship" && currentShipId === item.key) return { label: "Equipped", tone: "owned" };
  if (item?.kind === "ship" && ownedShips.includes(item.key)) return { label: "In Hangar", tone: "owned" };
  if (credits < buyPrice) return { label: "Insufficient CR", tone: "credits" };
  return { label: "Available", tone: "available" };
}

function renderStoreDetail() {
  const panel = document.getElementById("storeDetailPanel");
  if (!panel) return;

  const item = getStoreSelectedItem();
  if (!item) {
    panel.innerHTML = `<div class="store-empty-state">Select an item from the catalogue.</div>`;
    return;
  }

  const quality = getStoreItemDisplayQuality(item);
  const buyPrice = getStorePrice(item, quality);
  const inventoryCount = item.kind === "ship" ? 0 : getStoreItemInventoryCount(item, quality);
  const ownedReady = getStoreOwnedReadyCount(item);
  const totalOwned = item.kind === "ship"
    ? (ownedShips.includes(item.key) ? 1 : 0)
    : item.kind === "material"
      ? inventoryCount
    : (ownedReady + inventoryCount);
  const stockRemaining = getStoreStockRemaining(item);
  const hasStock = stockRemaining > 0 || !Number.isFinite(stockRemaining);
  const unlock = item.kind === "gun" || item.kind === "attachment"
    ? getEquipmentUnlockStatus(item.kind === "gun" ? "guns" : "attachments", item.key)
    : null;
  const progressionLocked = Boolean(unlock?.locked);
  const canBuy = item.kind === "ship" ? (!ownedShips.includes(item.key) && credits >= buyPrice && hasStock) : credits >= buyPrice && hasStock && !progressionLocked;
  const sellPrice = item.kind === "ship"
    ? 0
    : (item.kind === "attachment" || item.kind === "gun") && quality === "standard" && ownedReady > 0
      ? Math.max(1, Math.floor(item.basePrice * 0.7))
      : inventoryCount > 0
        ? getInventoryItemSellValue(item.key, quality)
        : 0;

  const detailStats = getStoreDetailStats(item, quality);
  const detailStatsHtml = detailStats.length ? `
    <div class="store-detail-section-heading">Specifications</div>
    <div class="store-detail-stat-grid compact-detail-stats">
      ${detailStats.map(stat => `
        <div class="store-detail-stat-card compact-detail-stat-card">
          <span>${stat.label}</span>
          <strong>${stat.value}</strong>
        </div>
      `).join("")}
    </div>` : "";

  let buyButton = "";
  let sellButton = "";
  const stagingStoreLocked = isMultiplayerStagingStoreActive();
  const stagingStoreItemId = getStagingStoreItemId(item);
  const stagingWritableItem = isStagingStoreWritableItem(item);
  const stagingPreviewButton = progressionLocked
    ? `<button class="store-detail-buy-action locked-action" data-item-key="${item.key}" data-item-kind="${item.kind}" disabled>${escapeHtml(getStoreLockedActionLabel(unlock))}</button>`
    : stagingStoreItemId
      ? `<button class="store-detail-buy-action" data-item-key="${item.key}" data-item-kind="${item.kind}" onclick="storeBuySelected()" ${hasStock && !multiplayerStagingStorePurchasePending ? "" : "disabled"}>${hasStock ? (stagingWritableItem ? (multiplayerStagingStorePurchasePending ? "Pending..." : "Purchase") : "Validate") : "Sold Out"}</button>`
      : `<button class="store-detail-buy-action" disabled>Purchase unavailable</button>`;

  if (item.kind === "material") {
    buyButton = stagingStoreLocked
      ? stagingPreviewButton
      : `<button class="store-detail-buy-action store-core-action" data-item-key="${item.key}" data-item-kind="${item.kind}" onclick="openUpgradeForge()">Open Upgrade Bay</button>`;
  } else if (item.kind === "core") {
    buyButton = stagingStoreLocked
      ? stagingPreviewButton
      : `<button class="store-detail-buy-action store-core-action" data-item-key="${item.key}" data-item-kind="${item.kind}" onclick="openUpgradeForge()">Open Upgrade Bay</button>`;
  } else if (item.kind === "ship") {
    if (currentShipId === item.key) {
      buyButton = `<button disabled>Equipped</button>`;
    } else if (ownedShips.includes(item.key)) {
      buyButton = `<button disabled>Owned in Hangar</button>`;
    } else {
      buyButton = stagingStoreLocked
        ? stagingPreviewButton
        : `<button class="store-detail-buy-action" data-item-key="${item.key}" data-item-kind="${item.kind}" onclick="storeBuySelected()" ${!canBuy ? "disabled" : ""}>${hasStock ? (credits >= buyPrice ? `Purchase · CR ${formatNumber(buyPrice)}` : "Insufficient credits") : "Sold Out"}</button>`;
    }
  } else {
    buyButton = stagingStoreLocked
      ? stagingPreviewButton
      : progressionLocked
        ? `<button class="store-detail-buy-action locked-action" data-item-key="${item.key}" data-item-kind="${item.kind}" disabled>${escapeHtml(getStoreLockedActionLabel(unlock))}</button>`
        : `<button class="store-detail-buy-action" data-item-key="${item.key}" data-item-kind="${item.kind}" onclick="storeBuySelected()" ${!canBuy ? "disabled" : ""}>${hasStock ? (credits >= buyPrice ? `Purchase · CR ${formatNumber(buyPrice)}` : "Insufficient credits") : "Sold Out"}</button>`;
    if (sellPrice > 0) {
      const sellHandler = (item.kind === "attachment" || item.kind === "gun") && quality === "standard" && ownedReady > 0
        ? 'storeSellSelectedOwned()'
        : 'storeSellSelectedInventory(1)';
      sellButton = stagingStoreLocked
        ? `<button disabled>Selling unavailable</button>`
        : `<button onclick="${sellHandler}">Sell / CR ${formatNumber(sellPrice)}</button>`;
    }
  }

  const availability = getStoreAvailabilityState({ item, progressionLocked, hasStock, buyPrice });
  const qualityLabel = titleCaseQuality(quality);
  const ownedLabel = item.kind === "ship"
    ? (ownedShips.includes(item.key) ? "1" : "0")
    : formatNumber(totalOwned);

  panel.innerHTML = `
    <div class="store-detail-shell store-quality-${quality} compact-store-detail simplified-store-detail store-kind-${item.kind}" data-item-key="${item.key}" data-item-kind="${item.kind}">
      <div class="store-detail-content">
        <div class="store-detail-visual quality-${quality} store-art-${item.kind} store-art-${item.key}">
          ${renderQualityFx(quality, { src: item.image, alt: item.name, size: "feature" })}
        </div>

        <div class="store-detail-heading">
          <div class="store-detail-kicker">${getStoreDetailKicker(item, quality)}</div>
          <div class="store-detail-title">${item.name}</div>
          <div class="store-detail-desc">${item.description}</div>
        </div>
        <div class="store-item-summary" aria-label="Item purchase summary">
          <div class="store-summary-cell">
            <span>Quality</span>
            <strong>${escapeHtml(qualityLabel)}</strong>
          </div>
          <div class="store-summary-cell">
            <span>Level</span>
            <strong>${escapeHtml(getStoreItemLevelLabel(item))}</strong>
          </div>
          <div class="store-summary-cell">
            <span>Owned</span>
            <strong>x${escapeHtml(ownedLabel)}</strong>
          </div>
          <div class="store-summary-cell">
            <span>Price</span>
            <strong>CR ${formatNumber(buyPrice)}</strong>
          </div>
          <div class="store-summary-cell store-summary-availability is-${availability.tone}">
            <span>Availability</span>
            <strong>${escapeHtml(availability.label)}</strong>
            <small>${progressionLocked ? escapeHtml(unlock.requirementLines.join(" · ") || unlock.message) : escapeHtml(getStoreStockLabel(item))}</small>
          </div>
        </div>
        ${renderStoreTransactionNotice(item)}
        ${renderStagingStorePreviewNote(item)}
        ${renderStagingShipEquipNote(item)}
        ${detailStatsHtml}
      </div>

      <div class="store-buy-footer store-detail-actions compact-store-actions simplified-store-actions ${sellButton ? 'two-buttons' : 'one-button'}">
        ${buyButton}
        ${stagingStoreLocked && item.kind === "ship" && stagingStoreItemId && totalOwned > 0 && currentShipId !== item.key ? `<button class="store-detail-buy-action" onclick="requestStagingShipEquip(getStoreSelectedItem())" ${multiplayerStagingShipEquipPending ? "disabled" : ""}>${multiplayerStagingShipEquipPending ? "Applying..." : `Fly ${escapeHtml(item.name)}`}</button>` : ""}
        ${sellButton}
      </div>
    </div>`;
}

function storeBuySelected() {
  const item = getStoreSelectedItem();
  if (!item) return;
  if (isMultiplayerStagingStoreActive()) {
    const unlock = item.kind === "gun" || item.kind === "attachment"
      ? getEquipmentUnlockStatus(item.kind === "gun" ? "guns" : "attachments", item.key)
      : item.kind === "ship"
        ? getShipUnlockStatus(item.key)
        : null;
    if (unlock?.locked) {
      const message = unlock.message || "Item locked.";
      if (typeof addHudToast === "function") addHudToast(message);
      else alert(message);
      return;
    }
    requestStagingStorePurchase(item);
    return;
  }
  if (item.kind === "core") {
    openUpgradeForge();
    return;
  }
  const quality = getStoreItemDisplayQuality(item);
  const unlock = item.kind === "gun" || item.kind === "attachment"
    ? getEquipmentUnlockStatus(item.kind === "gun" ? "guns" : "attachments", item.key)
    : null;
  if (unlock?.locked) {
    const message = unlock.message || "Reach the required Combat Level to unlock this.";
    if (typeof addHudToast === "function") addHudToast(message);
    else alert(message);
    return;
  }
  const purchaseCheck = canPurchaseStoreItem(item, quality);
  if (!purchaseCheck.ok) {
    notifyStorePurchaseBlocked(purchaseCheck);
    return;
  }
  const price = purchaseCheck.price;

  if (item.kind === "ship") {
    buyShip(item.key, item);
    return;
  }

  if (item.kind === "attachment") {
    if (quality === "standard") {
      if (!canAddInventoryItems(1)) {
        alert(INVENTORY_FULL_MESSAGE);
        return;
      }
      buyAttachment(item.key, item);
      tutorialEvent("boughtEquipment");
    } else {
      if (!canAddInventoryItems(1)) {
        alert(INVENTORY_FULL_MESSAGE);
        return;
      }
      credits -= price;
      addInventoryItem({ id: `item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, key: item.key, quality });
      recordStorePurchase(item);
      setStoreTransactionNotice(item, `${item.name} purchased. Ready in Hangar.`);
      renderStore();
      saveGame();
      tutorialEvent("boughtEquipment");
    }
    return;
  }

  if (item.kind === "gun") {
    if (quality === "standard") {
      if (!canAddInventoryItems(1)) {
        alert(INVENTORY_FULL_MESSAGE);
        return;
      }
      buyGun(item.key, item);
      tutorialEvent("boughtEquipment");
    } else {
      if (!canAddInventoryItems(1)) {
        alert(INVENTORY_FULL_MESSAGE);
        return;
      }
      credits -= price;
      addInventoryItem({ id: `item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, key: item.key, quality });
      recordStorePurchase(item);
      setStoreTransactionNotice(item, `${item.name} purchased. Ready in Hangar.`);
      renderStore();
      saveGame();
      tutorialEvent("boughtEquipment");
    }
    return;
  }

  if (item.kind === "core") {
    if (!canAddInventoryItems(1)) {
      alert(INVENTORY_FULL_MESSAGE);
      return;
    }
    credits -= price;
    addInventoryItem({ id: `item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, key: item.key, quality });
    recordStorePurchase(item);
    renderStore();
    saveGame();
    tutorialEvent("boughtEquipment");
  }
}

function storeSellSelectedOwned() {
  if (blockStoreMutationInMultiplayerStaging()) return;
  const item = getStoreSelectedItem();
  if (!item) return;
  if (item.kind === "attachment") {
    sellOwnedAttachment(item.key);
    return;
  }
  if (item.kind === "gun") {
    sellOwnedGun(item.key);
  }
}

function storeSellSelectedInventory(amount = "all") {
  if (blockStoreMutationInMultiplayerStaging()) return;
  const item = getStoreSelectedItem();
  if (!item) return;
  sellInventoryItemToNpc(item.key, getStoreItemDisplayQuality(item), amount, true);
}

function sellOwnedAttachment(key) {
  if (blockStoreMutationInMultiplayerStaging()) return;

  const item = attachments[key];
  if (!item || (ownedAttachments[key] || 0) <= 0) return;
  const sellValue = Math.max(1, Math.floor(item.price * 0.7));
  ownedAttachments[key] -= 1;
  credits += sellValue;
  const storeItem = getStoreCatalogItem("attachment", key);
  if (storeItem) setStoreTransactionNotice(storeItem, `${item.name} sold for CR ${formatNumber(sellValue)}.`, "success");
  renderStore();
  saveGame();
}

function sellOwnedGun(key) {
  if (blockStoreMutationInMultiplayerStaging()) return;
  const item = GUNS[key];
  if (!item || (ownedGuns[key] || 0) <= 0) return;
  const sellValue = Math.max(1, Math.floor(item.price * 0.7));
  ownedGuns[key] -= 1;
  credits += sellValue;
  const storeItem = getStoreCatalogItem("gun", key);
  if (storeItem) setStoreTransactionNotice(storeItem, `${item.name} sold for CR ${formatNumber(sellValue)}.`, "success");
  renderStore();
  saveGame();
}

function sellShipToStore(shipId) {
  if (blockStoreMutationInMultiplayerStaging()) return;
  const ship = SHIPS[shipId];
  if (!ship || shipId === currentShipId || !ownedShips.includes(shipId)) return;
  ownedShips = ownedShips.filter(id => id !== shipId);
  delete shipLoadouts[shipId];
  delete shipConditions[shipId];
  credits += Math.max(1, Math.floor(ship.price * 0.7));
  renderStore();
  saveGame();
}

function buyAttachment(key, storeItemOverride = null) {
  if (blockStoreMutationInMultiplayerStaging()) return;
  const item = attachments[key];
  if (!item) return;
  const storeItem = storeItemOverride?.kind === "attachment" && storeItemOverride.key === key
    ? storeItemOverride
    : getStoreCatalogItem("attachment", key);
  const purchaseCheck = canPurchaseStoreItem(storeItem || { kind: "attachment", key, basePrice: item.price });
  if (!purchaseCheck.ok) {
    notifyStorePurchaseBlocked(purchaseCheck);
    return;
  }
  const unlock = getEquipmentUnlockStatus("attachments", key);
  if (unlock.locked) {
    if (typeof addHudToast === "function") addHudToast(unlock.message);
    else alert(unlock.message);
    return;
  }

  if (!canAddInventoryItems(1)) {
    alert(INVENTORY_FULL_MESSAGE);
    return;
  }

  credits -= purchaseCheck.price;
  ownedAttachments[key] = (ownedAttachments[key] || 0) + 1;
  if (storeItem) recordStorePurchase(storeItem);
  if (storeItem) setStoreTransactionNotice(storeItem, `${item.name} purchased. Ready in Hangar.`);

  if (key === "evasionMatrix") tutorialEvent("boughtStoreEvasionMatrix");
  tutorialEvent("boughtStoreAttachment");
  tutorialEvent("boughtEquipment");

  renderStore();
  showScreen("storeScreen");
  saveGame();
}

function buyGun(key, storeItemOverride = null) {
  if (blockStoreMutationInMultiplayerStaging()) return;
  const item = GUNS[key];
  if (!item) return;
  const storeItem = storeItemOverride?.kind === "gun" && storeItemOverride.key === key
    ? storeItemOverride
    : getStoreCatalogItem("gun", key);
  const purchaseCheck = canPurchaseStoreItem(storeItem || { kind: "gun", key, basePrice: item.price });
  if (!purchaseCheck.ok) {
    notifyStorePurchaseBlocked(purchaseCheck);
    return;
  }
  const unlock = getEquipmentUnlockStatus("guns", key);
  if (unlock.locked) {
    if (typeof addHudToast === "function") addHudToast(unlock.message);
    else alert(unlock.message);
    return;
  }

  if (!canAddInventoryItems(1)) {
    alert(INVENTORY_FULL_MESSAGE);
    return;
  }

  credits -= purchaseCheck.price;
  ownedGuns[key] = (ownedGuns[key] || 0) + 1;
  if (storeItem) recordStorePurchase(storeItem);
  if (storeItem) setStoreTransactionNotice(storeItem, `${item.name} purchased. Ready in Hangar.`);

  tutorialEvent("boughtStoreGun");
  tutorialEvent("boughtEquipment");

  renderStore();
  showScreen("storeScreen");
  saveGame();
}

