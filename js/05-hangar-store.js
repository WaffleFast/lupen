function getItemCategoryKey(itemKey) {
  const definition = itemDefinitions[itemKey];
  if (!definition) return "all";
  if (definition.category === "Weapon") return "guns";
  if (definition.category === "Attachment") return "attachments";
  if (definition.category === "Core") return "cores";
  return "all";
}

const STAGING_STORE_LOCAL_ITEM_IDS = Object.freeze({
  "gun:pulseLaser": "gun:pulseLaser",
  "attachment:cargoPod": "attachment:cargoPod",
  "attachment:shieldBooster": "attachment:shieldBooster"
});

let multiplayerStagingStoreSubscribed = false;
let multiplayerStagingStorePurchasePending = false;
let multiplayerStagingCargoPodEquipPending = false;
let multiplayerStagingPulseLaserEquipPending = false;

function isMultiplayerStagingStoreActive() {
  try {
    if (typeof isMultiplayerStagingActive === "function") return isMultiplayerStagingActive();
    return typeof window !== "undefined" &&
      window.location &&
      new URLSearchParams(window.location.search).get("mp") === "staging";
  } catch (_err) {
    return false;
  }
}

function getMultiplayerStagingStoreStatus() {
  return window.LupenMultiplayerClient?.getStatus?.() || {};
}

function blockStoreMutationInMultiplayerStaging() {
  if (!isMultiplayerStagingStoreActive()) return false;
  const message = "Store purchases are server-preview only in multiplayer staging.";
  if (typeof addHudToast === "function") addHudToast(message);
  if (typeof addActivityLog === "function") addActivityLog(message);
  if (typeof console !== "undefined" && typeof console.info === "function") {
    console.info(`[Lupen multiplayer] ${message}`);
  }
  return true;
}

function blockLoadoutMutationInMultiplayerStaging() {
  if (!isMultiplayerStagingStoreActive()) return false;
  const message = "Loadout changes are server-preview only in multiplayer staging.";
  if (typeof addHudToast === "function") addHudToast(message);
  if (typeof addActivityLog === "function") addActivityLog(message);
  if (typeof console !== "undefined" && typeof console.info === "function") {
    console.info(`[Lupen multiplayer] ${message}`);
  }
  return true;
}

function requestMultiplayerStagingStoreItemsIfNeeded() {
  if (!isMultiplayerStagingStoreActive()) return;
  const client = window.LupenMultiplayerClient;
  const status = client?.getStatus?.();
  if (!client?.requestStagingStoreItems || !status?.enabled || !status?.isConnected) return;
  if (status.lastStagingStoreItems?.items?.length) return;
  client.requestStagingStoreItems();
}

function setupMultiplayerStagingStoreSubscription() {
  if (!isMultiplayerStagingStoreActive()) return;
  if (multiplayerStagingStoreSubscribed) return;
  const client = window.LupenMultiplayerClient;
  if (!client?.onServerState) return;
  const subscription = client.onServerState(() => {
    if (document.getElementById("storeScreen")?.classList.contains("active")) renderStore();
  });
  multiplayerStagingStoreSubscribed = Boolean(subscription?.unsubscribe);
}

function getStagingStoreLocalLookupKey(item) {
  if (!item) return "";
  return `${item.kind}:${item.key}`;
}

function getStagingStoreServerItem(item) {
  const lookupKey = getStagingStoreLocalLookupKey(item);
  const serverItems = getMultiplayerStagingStoreStatus().lastStagingStoreItems?.items || [];
  return serverItems.find((entry) => `${entry.localKind}:${entry.localKey}` === lookupKey) || null;
}

function getStagingStoreItemId(item) {
  const serverItem = getStagingStoreServerItem(item);
  if (serverItem?.itemId) return serverItem.itemId;
  return STAGING_STORE_LOCAL_ITEM_IDS[getStagingStoreLocalLookupKey(item)] || "";
}

function getLastMatchingStagingStorePreview(itemId) {
  const status = getMultiplayerStagingStoreStatus();
  const purchase = status.lastStagingStorePurchase;
  if (purchase?.itemId === itemId) return purchase;
  const result = status.lastStagingStorePreview;
  return result?.itemId === itemId ? result : null;
}

function getLastStagingCargoPodEquipResult() {
  const status = getMultiplayerStagingStoreStatus();
  const equip = status.lastStagingLoadoutEquip;
  if (equip?.itemId === "attachment:cargoPod") return equip;
  const preview = status.lastStagingLoadoutPreview;
  return preview?.itemId === "attachment:cargoPod" ? preview : null;
}

function getLastStagingPulseLaserEquipResult() {
  const status = getMultiplayerStagingStoreStatus();
  const equip = status.lastStagingLoadoutEquip;
  if (equip?.itemId === "gun:pulseLaser") return equip;
  const preview = status.lastStagingLoadoutPreview;
  return preview?.itemId === "gun:pulseLaser" ? preview : null;
}

function getStagingStorePreviewLine(result) {
  if (!result) return "Server preview pending. No CR or inventory changed.";
  if (result.applied && result.itemId === "gun:pulseLaser") return "Weapon purchased.";
  if (result.applied && result.itemId === "attachment:cargoPod") return "Cargo Pod purchased.";
  if (result.applied) return "Staging purchase applied.";
  if (result.wouldPass) return "Would pass server Store validation.";
  if (result.blockReason === "insufficient_credits") return "Blocked: not enough credits.";
  if (result.blockReason === "unknown_store_item") return "Server preview unavailable.";
  if (result.blockReason === "invalid_store_quantity") return "Blocked: invalid quantity.";
  if (result.blockReason === "store_item_preview_only" || result.reason === "store_item_preview_only") return "This item is preview-only in staging.";
  if (result.reason === "staging_store_dry_run_enabled") return "Dry run only - no CR or Store ownership changed.";
  return `Blocked: ${result.blockReason || result.reason || "validation unavailable"}.`;
}

function renderStagingStorePreviewNote(item) {
  if (!isMultiplayerStagingStoreActive()) return "";
  const itemId = getStagingStoreItemId(item);
  const result = itemId ? getLastMatchingStagingStorePreview(itemId) : null;
  if (!itemId) {
    return `<div class="store-detail-owned-line">Server preview unavailable. Real Store purchase is blocked in MP staging.</div>`;
  }
  if (!result) {
    return `<div class="store-detail-owned-line">MP staging Store: server preview only. No CR or inventory changed.</div>`;
  }
  const source = result.validationMode === "trusted_save"
    ? "trusted save"
    : result.validationMode === "snapshot"
      ? "local snapshot"
      : "price preview";
  const afterCredits = result.creditsAfter ?? result.creditsAfterPreview;
  const creditLine = result.creditsBefore === null
    ? "CR unknown"
    : `CR ${formatNumber(result.creditsBefore)} -> ${formatNumber(afterCredits)}`;
  const ownedLine = result.itemBefore === null || result.itemAfter === null
    ? ""
    : ` / Owned ${formatNumber(result.itemBefore)} -> ${formatNumber(result.itemAfter)}`;
  return `
    <div class="store-detail-owned-line">
      <strong>${escapeHtml(getStagingStorePreviewLine(result))}</strong> /
      ${escapeHtml(creditLine)} /
      ${escapeHtml(source)} /
      ${escapeHtml(result.applied ? "Server save refreshed after applied purchase." : "Dry run only - no CR, inventory, ships, equipment, saves, loot, or bounties changed.")}${escapeHtml(ownedLine)}
    </div>`;
}

function isStagingStoreWritableItem(item) {
  const itemId = getStagingStoreItemId(item);
  return itemId === "attachment:cargoPod" || itemId === "gun:pulseLaser";
}

function getStagingCargoPodEquipLine(result) {
  if (!result) return "Cargo Pod equip preview pending.";
  if (result.applied) return "Cargo Pod equipped.";
  if (result.mode === "dry_run" && result.ok) return "Would equip Cargo Pod.";
  if (result.blockReason === "cargo_pod_not_owned") return "Blocked: no owned Cargo Pod.";
  if (result.blockReason === "attachment_slots_full") return "Blocked: no empty equipment slot.";
  if (result.reason === "staging_loadout_dry_run_enabled") return "Dry run only - loadout not changed.";
  return `Blocked: ${result.blockReason || result.reason || "loadout unavailable"}.`;
}

function renderStagingCargoPodEquipNote(item) {
  if (!isMultiplayerStagingStoreActive() || getStagingStoreItemId(item) !== "attachment:cargoPod") return "";
  const result = getLastStagingCargoPodEquipResult();
  const capacityLine = result?.cargoCapacityBefore !== null && result?.cargoCapacityBefore !== undefined
    ? ` / Cargo ${formatNumber(result.cargoCapacityBefore)} -> ${formatNumber(result.cargoCapacityAfter ?? result.cargoCapacityAfterPreview)}`
    : "";
  const ownedLine = result?.ownedBefore !== null && result?.ownedBefore !== undefined
    ? ` / Owned ${formatNumber(result.ownedBefore)} -> ${formatNumber(result.ownedAfter)}`
    : "";
  return `
    <div class="store-detail-owned-line">
      <strong>${escapeHtml(getStagingCargoPodEquipLine(result))}</strong>${escapeHtml(capacityLine)}${escapeHtml(ownedLine)} /
      ${escapeHtml(result?.applied ? "Server save refreshed after applied equip." : "Dry run only - no loadout, inventory, credits, ships, weapons, loot, or bounties changed.")}
    </div>`;
}

function getStagingPulseLaserEquipLine(result) {
  if (!result) return "Pulse Laser equip preview pending.";
  if (result.applied) return "Weapon equipped.";
  if (result.mode === "dry_run" && result.ok) return "Would equip Pulse Laser.";
  if (result.blockReason === "pulse_laser_not_owned") return "Blocked: no owned Pulse Laser.";
  if (result.blockReason === "gun_slots_full") return "Blocked: no empty gun slot.";
  if (result.reason === "staging_loadout_dry_run_enabled") return "Dry run only - loadout not changed.";
  return `Blocked: ${result.blockReason || result.reason || "loadout unavailable"}.`;
}

function renderStagingPulseLaserEquipNote(item) {
  if (!isMultiplayerStagingStoreActive() || getStagingStoreItemId(item) !== "gun:pulseLaser") return "";
  const result = getLastStagingPulseLaserEquipResult();
  const slotLine = result?.gunSlots !== null && result?.gunSlots !== undefined
    ? ` / Guns ${formatNumber(result.equippedBefore)} -> ${formatNumber(result.equippedAfter)} of ${formatNumber(result.gunSlots)}`
    : result?.equippedBefore !== null && result?.equippedBefore !== undefined
      ? ` / Guns ${formatNumber(result.equippedBefore)} -> ${formatNumber(result.equippedAfter)}`
      : "";
  const ownedLine = result?.ownedBefore !== null && result?.ownedBefore !== undefined
    ? ` / Owned ${formatNumber(result.ownedBefore)} -> ${formatNumber(result.ownedAfter)}`
    : "";
  return `
    <div class="store-detail-owned-line">
      <strong>${escapeHtml(getStagingPulseLaserEquipLine(result))}</strong>${escapeHtml(slotLine)}${escapeHtml(ownedLine)} /
      ${escapeHtml(result?.applied ? "Server save refreshed after applied weapon equip." : "Dry run only - no loadout, inventory, credits, ships, attachments, loot, or bounties changed.")}
    </div>`;
}

async function requestStagingCargoPodEquip(item) {
  if (!isMultiplayerStagingStoreActive() || getStagingStoreItemId(item) !== "attachment:cargoPod") return false;
  const client = window.LupenMultiplayerClient;
  const status = client?.getStatus?.();
  if (!client?.equipStagingCargoPod || !status?.enabled || !status?.isConnected) {
    if (typeof addHudToast === "function") addHudToast("MP staging Cargo Pod equip is waiting for the multiplayer server connection.");
    return true;
  }
  if (multiplayerStagingCargoPodEquipPending) return true;
  multiplayerStagingCargoPodEquipPending = true;
  renderStore();
  client.equipStagingCargoPod({ itemId: "attachment:cargoPod" });
  if (typeof addHudToast === "function") addHudToast("Requested MP staging Cargo Pod equip.");
  setTimeout(async () => {
    multiplayerStagingCargoPodEquipPending = false;
    const latest = client.getStatus?.().lastStagingLoadoutEquip;
    if (latest?.itemId === "attachment:cargoPod" && latest.applied) {
      if (typeof addHudToast === "function") addHudToast(`Cargo Pod equipped: cargo ${formatNumber(latest.cargoCapacityBefore)} -> ${formatNumber(latest.cargoCapacityAfter)}.`);
      if (typeof loadGameFromSupabase === "function") {
        try {
          const loaded = await loadGameFromSupabase();
          if (loaded?.loaded) {
            if (typeof syncMultiplayerPresence === "function") syncMultiplayerPresence("cargo_pod_equipped");
            if (typeof addHudToast === "function") addHudToast("Save refreshed from server.");
          }
        } catch (_err) {
          if (typeof addHudToast === "function") addHudToast("Cargo Pod equipped. Reload if loadout values look stale.");
        }
      }
    }
    renderStore();
    if (document.getElementById("hangarScreen")?.classList.contains("active")) renderHangar();
  }, 900);
  return true;
}

async function requestStagingPulseLaserEquip(item) {
  if (!isMultiplayerStagingStoreActive() || getStagingStoreItemId(item) !== "gun:pulseLaser") return false;
  const client = window.LupenMultiplayerClient;
  const status = client?.getStatus?.();
  if (!client?.equipStagingPulseLaser || !status?.enabled || !status?.isConnected) {
    if (typeof addHudToast === "function") addHudToast("MP staging Pulse Laser equip is waiting for the multiplayer server connection.");
    return true;
  }
  if (multiplayerStagingPulseLaserEquipPending) return true;
  multiplayerStagingPulseLaserEquipPending = true;
  renderStore();
  client.equipStagingPulseLaser({ itemId: "gun:pulseLaser" });
  if (typeof addHudToast === "function") addHudToast("Requested MP staging Pulse Laser equip.");
  setTimeout(async () => {
    multiplayerStagingPulseLaserEquipPending = false;
    const latest = client.getStatus?.().lastStagingLoadoutEquip;
    if (latest?.itemId === "gun:pulseLaser" && latest.applied) {
      if (typeof addHudToast === "function") addHudToast(`Weapon equipped: ${latest.name || "Pulse Laser"}.`);
      if (typeof loadGameFromSupabase === "function") {
        try {
          const loaded = await loadGameFromSupabase();
          if (loaded?.loaded) {
            if (typeof syncMultiplayerPresence === "function") syncMultiplayerPresence("pulse_laser_equipped");
            if (typeof addHudToast === "function") addHudToast("Save refreshed from server.");
          }
        } catch (_err) {
          if (typeof addHudToast === "function") addHudToast("Weapon equipped. Reload if loadout values look stale.");
        }
      }
    }
    renderStore();
    if (document.getElementById("hangarScreen")?.classList.contains("active")) renderHangar();
  }, 900);
  return true;
}

async function requestStagingStorePurchase(item) {
  if (!isMultiplayerStagingStoreActive()) return false;
  const itemId = getStagingStoreItemId(item);
  if (!itemId || !isStagingStoreWritableItem(item)) {
    return requestStagingStorePurchasePreview(item);
  }
  const client = window.LupenMultiplayerClient;
  const status = client?.getStatus?.();
  if (!client?.purchaseStagingStoreItem || !status?.enabled || !status?.isConnected) {
    if (typeof addHudToast === "function") addHudToast("MP staging Store purchase is waiting for the multiplayer server connection.");
    requestMultiplayerStagingStoreItemsIfNeeded();
    return true;
  }
  if (multiplayerStagingStorePurchasePending) return true;
  multiplayerStagingStorePurchasePending = true;
  renderStore();
  client.purchaseStagingStoreItem({ itemId, quantity: 1 });
  if (typeof addHudToast === "function") addHudToast("Requested MP staging Store purchase.");
  setTimeout(async () => {
    multiplayerStagingStorePurchasePending = false;
    const latest = client.getStatus?.().lastStagingStorePurchase;
    if (latest?.itemId === itemId && latest.applied) {
      if (typeof addHudToast === "function") addHudToast(`Staging purchase applied: ${latest.name || "Store item"}.`);
      if (typeof loadGameFromSupabase === "function") {
        try {
          const loaded = await loadGameFromSupabase();
          if (loaded?.loaded && typeof addHudToast === "function") addHudToast("Save refreshed from server.");
        } catch (_err) {
          if (typeof addHudToast === "function") addHudToast("Staging purchase applied. Reload if Store values look stale.");
        }
      }
    }
    renderStore();
  }, 900);
  return true;
}

function requestStagingStorePurchasePreview(item) {
  if (!isMultiplayerStagingStoreActive()) return false;
  const itemId = getStagingStoreItemId(item);
  if (!itemId) {
    blockStoreMutationInMultiplayerStaging();
    renderStore();
    return true;
  }
  const client = window.LupenMultiplayerClient;
  const status = client?.getStatus?.();
  if (!client?.previewStagingStorePurchase || !status?.enabled || !status?.isConnected) {
    if (typeof addHudToast === "function") addHudToast("MP staging Store preview is waiting for the multiplayer server connection.");
    requestMultiplayerStagingStoreItemsIfNeeded();
    return true;
  }
  client.previewStagingStorePurchase({ itemId, quantity: 1 });
  if (typeof addHudToast === "function") addHudToast("Requested MP staging Store server preview.");
  return true;
}

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
  return "Rare enhancement core used for future upgrades, quality progression and high-value trading.";
}

function getEquippedVaultCounts() {
  const equipped = new Map();
  Object.values(shipLoadouts || {}).forEach(loadout => {
    if (!loadout) return;
    (loadout.attachments || []).forEach(entry => {
      const key = getEquipmentKey(entry);
      const quality = getEquipmentQuality(entry);
      const mapKey = `${key}__${quality}`;
      equipped.set(mapKey, (equipped.get(mapKey) || 0) + 1);
    });
    (loadout.guns || []).forEach(entry => {
      const key = getEquipmentKey(entry);
      const quality = getEquipmentQuality(entry);
      const mapKey = `${key}__${quality}`;
      equipped.set(mapKey, (equipped.get(mapKey) || 0) + 1);
    });
  });
  return equipped;
}

function buildVaultEntries() {
  ensureInventoryObjects();
  const grouped = new Map();
  const equippedCounts = getEquippedVaultCounts();

  function ensureEntry(key, quality = "standard") {
    const definition = itemDefinitions[key];
    if (!definition) return null;
    const groupKey = `${key}__${quality}`;
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        groupKey,
        key,
        quality,
        name: definition.name,
        category: definition.category,
        categoryKey: getItemCategoryKey(key),
        icon: definition.icon || "assets/items/lupen-core.png",
        count: 0,
        storedCount: 0,
        equippedCount: 0
      });
    }
    return grouped.get(groupKey);
  }

  Object.entries(ownedAttachments || {}).forEach(([key, count]) => {
    if (!count) return;
    const entry = ensureEntry(key, "standard");
    if (!entry) return;
    entry.count += count;
    entry.storedCount += count;
  });

  Object.entries(ownedGuns || {}).forEach(([key, count]) => {
    if (!count) return;
    const entry = ensureEntry(key, "standard");
    if (!entry) return;
    entry.count += count;
    entry.storedCount += count;
  });

  (inventoryItems || []).forEach(item => {
    if (!item || !itemDefinitions[item.key]) return;
    const entry = ensureEntry(item.key, item.key === "lupenCore" ? LUPEN_CORE_QUALITY : (item.quality || "standard"));
    if (!entry) return;
    entry.count += 1;
    entry.storedCount += 1;
  });

  equippedCounts.forEach((count, groupKey) => {
    const [key, quality = "standard"] = groupKey.split("__");
    const entry = ensureEntry(key, quality);
    if (!entry) return;
    entry.count += count;
    entry.equippedCount += count;
  });

  return Array.from(grouped.values()).sort((a, b) => {
    const qualityDelta = ITEM_QUALITY_ORDER.indexOf(b.quality) - ITEM_QUALITY_ORDER.indexOf(a.quality);
    if (qualityDelta !== 0) return qualityDelta;
    if (a.categoryKey !== b.categoryKey) return a.categoryKey.localeCompare(b.categoryKey);
    return a.name.localeCompare(b.name);
  });
}

function getVaultFilteredEntries() {
  const entries = buildVaultEntries();
  if (hangarVaultFilter === "all") return entries;
  return entries.filter(entry => entry.categoryKey === hangarVaultFilter);
}

function ensureVaultSelection() {
  const entries = getVaultFilteredEntries();
  if (!entries.length) {
    selectedVaultGroupKey = null;
    return;
  }
  if (!entries.some(entry => entry.groupKey === selectedVaultGroupKey)) {
    selectedVaultGroupKey = entries[0].groupKey;
  }
}

function setHangarVaultFilter(nextFilter) {
  hangarVaultFilter = nextFilter;
  ensureVaultSelection();
  renderHangarVault();
}

function selectVaultItem(groupKey) {
  selectedVaultGroupKey = groupKey;
  renderHangarVault();
}

function getSelectedVaultEntry() {
  const entries = buildVaultEntries();
  return entries.find(entry => entry.groupKey === selectedVaultGroupKey) || null;
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

  const filters = [
    { key: "all", label: "All" },
    { key: "guns", label: "Guns" },
    { key: "attachments", label: "Attachments" },
    { key: "cores", label: "Cores" }
  ];

  bar.innerHTML = filters.map(filter => `
    <button class="store-filter-btn ${hangarVaultFilter === filter.key ? "active" : ""}" onclick="setHangarVaultFilter('${filter.key}')">${filter.label}</button>
  `).join("");
}

function getVaultEntryStats(entry) {
  if (!entry) return [];
  const item = {
    key: entry.key,
    kind: entry.categoryKey === "guns" ? "gun" : entry.categoryKey === "attachments" ? "attachment" : "core"
  };

  const stats = [{ label: "Owned", value: formatNumber(entry.count) }];

  if (entry.categoryKey !== "cores") {
    stats.push({ label: "Equipped", value: formatNumber(entry.equippedCount) });
  }

  if (item.kind === "gun") {
    const gun = GUNS[item.key];
    if (gun) {
      stats.push(...getWeaponPurchaseStatRows(gun, entry.quality));
    }
  } else if (item.kind === "attachment") {
    stats.push(...getAttachmentPurchaseStatRows(item, entry.quality));
  } else if (item.kind === "core") {
    stats.push({ label: "Tier", value: "God-tier" });
    stats.push({ label: "Use", value: "Upgrade equipment" });
  }

  return stats.slice(0, item.kind === "gun" ? 5 : 3);
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
          <div class="hangar-tooltip-meta">${escapeHtml(qualityLabel)} / x${formatNumber(entry.count || 0)} owned</div>
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
    grid.innerHTML = `<div class="vault-empty-state">No owned items in this category.</div>`;
    return;
  }

  grid.innerHTML = "";

  entries.forEach(entry => {
    const button = document.createElement("button");
    button.className = `store-catalog-card vault-catalog-card vault-icon-card ${selectedVaultGroupKey === entry.groupKey ? "selected" : ""} quality-${entry.quality}`;
    button.onclick = () => selectVaultItem(entry.groupKey);
    button.removeAttribute("title");
    showHangarTooltip(button, getVaultTooltipHtml(entry));
    bindHangarEquipmentTooltip(button);

    button.innerHTML = `
      ${entry.equippedCount > 0 ? `<span class="vault-card-equipped">EQ ${entry.equippedCount}</span>` : ""}
      <span class="vault-card-count">x${formatNumber(entry.count)}</span>
      <div class="store-card-art quality-${entry.quality}">
        <img src="${entry.icon}" alt="${entry.name}">
      </div>
      <div class="store-card-name">${entry.name}</div>
      <div class="vault-card-meta">${titleCaseQuality(entry.quality)}</div>
    `;

    grid.appendChild(button);
  });
}

function renderVaultDetail() {
  const panel = document.getElementById("vaultDetailPanel");
  if (!panel) return;

  const entry = getSelectedVaultEntry();
  if (!entry) {
    panel.innerHTML = `<div class="vault-empty-state">Select an owned item from the vault.</div>`;
    return;
  }

  const stats = getVaultEntryStats(entry);
  const canUpgrade = ["guns", "attachments"].includes(entry.categoryKey);
  const upgradePanel = canUpgrade ? `
    <div class="vault-upgrade-panel">
      <div>
        <span>Station Forge</span>
        <strong>Level and quality upgrades are handled in the Forge</strong>
      </div>
      <button type="button" onclick="openUpgradeForgeFromVault('${escapeJsString(entry.groupKey)}')">
        Open Forge
      </button>
    </div>
  ` : entry.categoryKey === "cores" ? `
    <div class="vault-upgrade-panel passive">
      <div>
        <span>Lupen Cores</span>
        <strong>Used to upgrade guns and equipment</strong>
      </div>
    </div>
  ` : "";

  panel.innerHTML = `
    <div class="store-detail-shell store-quality-${entry.quality} compact-store-detail simplified-store-detail vault-detail-shell">
      <div class="store-detail-visual quality-${entry.quality}">
        <img src="${entry.icon}" alt="${entry.name}">
      </div>
      <div class="store-detail-kicker">${entry.category.toUpperCase()} / ${titleCaseQuality(entry.quality)}</div>
      <div class="store-detail-title">${entry.name}</div>
      <div class="store-detail-desc">${getVaultEntryDescription(entry)}</div>
      <div class="store-detail-stat-grid compact-detail-stats vault-detail-stats">
        ${stats.map(stat => `
          <div class="store-detail-stat-card compact-detail-stat-card">
            <span>${stat.label}</span>
            <strong>${stat.value}</strong>
          </div>
        `).join("")}
      </div>
      ${upgradePanel}
    </div>
  `;
}

function renderHangarVault() {
  const title = document.getElementById("hangarShipTitle");
  const subtitle = document.getElementById("hangarShipSubtitle");
  if (title) title.textContent = "Station Vault";
  if (subtitle) subtitle.textContent = "Owned systems and upgrade materials";

  ensureVaultSelection();
  renderVaultFilters();
  renderVaultCatalog();
  renderVaultDetail();
}

/* Hangar */

function renderHangar() {
  if (!ownedShips.includes(selectedHangarShipId)) {
    selectedHangarShipId = currentShipId || "lupenOrigin";
  }

  ensureInventoryObjects();
  renderHangarOverview();
  renderOwnedShips();
  renderHangarVault();
  renderShipShop();

  const activeSection = document.querySelector(".hangar-section.active");
  if (!activeSection) {
    showHangarSection("overview");
  }
}

function ensureInventoryObjects() {
  Object.keys(attachments).forEach(key => {
    if (ownedAttachments[key] === undefined) ownedAttachments[key] = 0;
  });

  Object.keys(GUNS).forEach(key => {
    if (ownedGuns[key] === undefined) ownedGuns[key] = 0;
  });
}

function getShipRole(shipId = currentShipId) {
  return SHIPS[shipId]?.roleSubtitle || "Equipped Hull";
}

function renderMiniLoadoutList(items, emptyText) {
  if (!items.length) return `<div class="overview-empty">${emptyText}</div>`;

  return items.map(item => `
    <div class="overview-loadout-row">
      <img src="${item.image}" alt="${item.name}">
      <div>
        <strong>${item.name}</strong>
        <span>${item.description || "Installed system"}</span>
      </div>
    </div>
  `).join("");
}

function renderHangarOverview() {
  selectedHangarShipId = currentShipId;

  const ship = getCurrentShip();
  const stats = getShipStats(currentShipId);
  const missingHull = Math.max(0, hullMax - hull);
  const repairCost = getRepairCost();
  const repairDisabled = missingHull <= 0 || credits < repairCost;

  const overviewName = document.getElementById("overviewShipName");
  const overviewImage = document.getElementById("overviewShipImage");
  const overviewNameplate = document.getElementById("overviewNameplate");
  const overviewStats = document.getElementById("overviewStats");
  const overviewRepair = document.getElementById("overviewRepairPanel");
  const subtitle = document.getElementById("hangarShipSubtitle");

  const title = document.getElementById("hangarShipTitle");
  if (title) title.textContent = ship.name;
  if (subtitle) subtitle.textContent = getShipRole(currentShipId);

  if (overviewName) overviewName.textContent = ship.name;
  if (overviewImage) {
    overviewImage.src = ship.image;
    overviewImage.alt = ship.name;
  }
  if (overviewNameplate) overviewNameplate.textContent = ship.name;

  if (overviewStats) {
    overviewStats.innerHTML = `
      <div class="hangar-stat-card hull-stat featured-stat"><span>Hull</span><strong>${formatNumber(Math.floor(hull))}/${formatNumber(hullMax)}</strong></div>
      <div class="hangar-stat-card shield-stat"><span>Shield</span><strong>${formatNumber(stats.shield)}</strong></div>
      <div class="hangar-stat-card hull-stat"><span>Armor</span><strong>${formatNumber(stats.armor)}</strong></div>
      <div class="hangar-stat-card cargo-stat"><span>Cargo</span><strong>${formatNumber(stats.cargo)}</strong></div>
      <div class="hangar-stat-card jump-stat"><span>Jump</span><strong>${formatNumber(stats.jumpRecharge)}</strong></div>
      <div class="hangar-stat-card evasion-stat"><span>Evasion</span><strong>${formatEvasion(stats.evasion)}</strong></div>
    `;
  }

  if (overviewRepair) {
    overviewRepair.innerHTML = `
      <div class="repair-hero-card ${missingHull > 0 ? "needs-repair" : "ready"} unique-repair-card compact-repair-card prestige-repair-strip">
        <div>
          <span>Hull Service</span>
          <strong>${missingHull > 0 ? `CR ${formatNumber(repairCost)}` : "Ready"}</strong>
          <small>${formatNumber(Math.floor(hull))} / ${formatNumber(hullMax)} hull</small>
        </div>
        <button onclick="repairCurrentShip()" ${repairDisabled ? "disabled" : ""}>${missingHull > 0 ? "Repair" : "Repaired"}</button>
      </div>
    `;
  }

  renderInstalledGuns();
  renderInstalledAttachments();
  renderGunInventory();
  renderAttachmentInventory();
}


function selectFleetShip(shipId) {
  if (!ownedShips.includes(shipId)) return;
  selectedFleetShipId = shipId;
  selectedHangarShipId = shipId;
  renderOwnedShips();
}

function renderFleetStatChip(label, value, statClass = "") {
  return `<div class="fleet-stat-chip ${statClass}"><span>${label}</span><strong>${value}</strong></div>`;
}


function pluralLabel(count, singular, plural = `${singular}s`) {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

function formatSlotCapacityText(shipId) {
  const guns = getGunSlotLimit(shipId);
  const equip = getAttachmentSlotLimit(shipId);
  return `Guns ${formatNumber(guns)} slot${guns === 1 ? "" : "s"} / Equip ${formatNumber(equip)} slot${equip === 1 ? "" : "s"}`;
}

function formatSlotCapacityShort(shipId) {
  return `${getGunSlotLimit(shipId)} gun / ${getAttachmentSlotLimit(shipId)} equip`;
}

function formatSlotUsageText(shipId) {
  const loadout = getShipLoadout(shipId);
  return `Guns ${loadout.guns.length}/${getGunSlotLimit(shipId)} / Equip ${loadout.attachments.length}/${getAttachmentSlotLimit(shipId)}`;
}

function renderSlotPips(count, filled = count) {
  const safeCount = Math.max(0, Math.round(Number(count || 0)));
  const safeFilled = Math.max(0, Math.min(safeCount, Math.round(Number(filled || 0))));
  if (!safeCount) return `<span class="ship-slot-pip empty"></span>`;

  const visibleCount = Math.min(safeCount, 8);
  const filledVisible = Math.round((safeFilled / safeCount) * visibleCount);

  return Array.from({ length: visibleCount }).map((_, index) => `
    <span class="ship-slot-pip ${index < filledVisible ? "filled" : ""} ${safeCount > visibleCount ? "condensed" : ""}"></span>
  `).join("");
}

function renderShipSlotSummary(shipId, mode = "capacity") {
  const loadout = getShipLoadout(shipId);
  const guns = getGunSlotLimit(shipId);
  const equip = getAttachmentSlotLimit(shipId);
  const gunFilled = mode === "usage" ? loadout.guns.length : guns;
  const equipFilled = mode === "usage" ? loadout.attachments.length : equip;

  return `
    <div class="ship-slot-summary" aria-label="${escapeHtml(formatSlotCapacityText(shipId))}">
      <div class="ship-slot-bank gun-bank">
        <span>Guns</span>
        <strong>${mode === "usage" ? `${loadout.guns.length}/${guns}` : guns}</strong>
        <div class="ship-slot-pips">${renderSlotPips(guns, gunFilled)}</div>
      </div>
      <div class="ship-slot-bank equip-bank">
        <span>Equip</span>
        <strong>${mode === "usage" ? `${loadout.attachments.length}/${equip}` : equip}</strong>
        <div class="ship-slot-pips">${renderSlotPips(equip, equipFilled)}</div>
      </div>
    </div>
  `;
}


function renderOwnedShips() {
  const box = document.getElementById("ownedShipsList");
  if (!box) return;
  const title = document.getElementById("hangarShipTitle");
  const subtitle = document.getElementById("hangarShipSubtitle");
  if (title) title.textContent = "Fleet";
  if (subtitle) subtitle.textContent = "Owned vessels";

  const fleetCount = document.getElementById("fleetCountText");
  if (fleetCount) fleetCount.textContent = formatNumber(ownedShips.length);

  if (!ownedShips.includes(selectedFleetShipId)) {
    selectedFleetShipId = currentShipId || ownedShips[0];
  }

  box.innerHTML = "";

  ownedShips.forEach(shipId => {
    const ship = SHIPS[shipId];
    if (!ship) return;

    const isEquipped = currentShipId === shipId;
    const isSelected = selectedFleetShipId === shipId;
    const stats = getShipStats(shipId);

    const card = document.createElement("button");
    card.className = `fleet-ship-card fleet-selector-card ${isSelected ? "selected" : ""} ${isEquipped ? "active" : ""}`;
    card.onclick = () => selectFleetShip(shipId);
    card.innerHTML = `
      <div class="fleet-card-badge">${isEquipped ? "In Use" : "Owned"}</div>
      <div class="fleet-card-image-wrap">
        <img src="${ship.image}" alt="${ship.name}">
      </div>
      <div class="fleet-card-name">${ship.name}</div>
      <div class="fleet-card-role">${ship.roleSubtitle || getShipRole(shipId)}</div>
      <div class="fleet-card-mini-stats">
        <span>Hull ${formatNumber(stats.hull)}</span>
        <span>Shield ${formatNumber(stats.shield)}</span>
        <span>Cargo ${formatNumber(stats.cargo)}</span>
      </div>
      <div class="fleet-card-slots compact-fleet-slots">${renderShipSlotSummary(shipId, "usage")}</div>
    `;

    box.appendChild(card);
  });

  renderFleetDetail();
}

function renderFleetDetail() {
  const panel = document.getElementById("fleetDetailPanel");
  if (!panel) return;

  const shipId = selectedFleetShipId || currentShipId;
  const ship = SHIPS[shipId];
  if (!ship) {
    panel.innerHTML = `<div class="cargo-empty compact-empty">No ship selected</div>`;
    return;
  }

  const stats = getShipStats(shipId);
  const loadout = getShipLoadout(shipId);
  const weapon = getEquippedWeapon(shipId);
  const isEquipped = currentShipId === shipId;
  const status = document.getElementById("fleetDetailStatus");
  if (status) status.textContent = isEquipped ? "In Use" : "Owned";

  panel.innerHTML = `
    <div class="fleet-detail-hero">
      <div class="fleet-detail-ship-glow"></div>
      <img src="${ship.image}" alt="${ship.name}">
    </div>

    <div class="fleet-detail-title">
      <div>
        <h4>${ship.name}</h4>
        <p>${ship.roleSubtitle || getShipRole(shipId)}</p>
      </div>
      <span class="fleet-status-chip ${isEquipped ? "active" : ""}">${isEquipped ? "In Use" : "Owned"}</span>
    </div>

    <div class="fleet-detail-stats">
      ${renderFleetStatChip("Hull", formatNumber(stats.hull), "hull-stat")}
      ${renderFleetStatChip("Shield", formatNumber(stats.shield), "shield-stat")}
      ${renderFleetStatChip("Armor", formatNumber(stats.armor), "hull-stat")}
      ${renderFleetStatChip("Cargo", formatNumber(stats.cargo), "cargo-stat")}
      ${renderFleetStatChip("Jump", formatNumber(stats.jumpRecharge), "jump-stat")}
      ${renderFleetStatChip("Evasion", formatEvasion(stats.evasion), "evasion-stat")}
    </div>

    <div class="shipyard-capacity-panel fleet-capacity-panel">
      <div class="shipyard-capacity-heading">
        <span>Hardpoints</span>
        <strong>${formatSlotUsageText(shipId)}</strong>
      </div>
      ${renderShipSlotSummary(shipId, "usage")}
    </div>

    <div class="fleet-detail-actions compact fleet-swap-actions">
      <button class="fleet-primary-swap" onclick="equipShip('${shipId}'); showHangarSection('owned');" ${isEquipped ? "disabled" : ""}>${isEquipped ? "In Use" : "Fly This Ship"}</button>
      <button onclick="equipShip('${shipId}'); showHangarSection('overview');">Open Loadout</button>
    </div>
  `;
}

function getRepairCost() {
  return Math.max(0, Math.ceil((hullMax - hull) * HULL_REPAIR_COST_PER_POINT));
}

function renderRepairSummary(shipId = selectedHangarShipId) {
  if (shipId !== currentShipId) {
    return `
      <div class="repair-panel">
        <strong>Ship Condition</strong>
        <span>Equip this ship to repair its hull.</span>
      </div>
    `;
  }

  const missingHull = Math.max(0, hullMax - hull);
  const repairCost = getRepairCost();
  const disabled = missingHull <= 0 || credits < repairCost;

  return `
    <div class="repair-panel">
      <strong>Ship Condition</strong>
      <span>Hull: ${formatNumber(Math.floor(hull))} / ${formatNumber(hullMax)}</span>
      <span>Repair Cost: CR ${formatNumber(repairCost)}</span>
      <button onclick="repairCurrentShip()" ${disabled ? "disabled" : ""}>
        ${missingHull <= 0 ? "Hull Fully Repaired" : "Repair Hull"}
      </button>
    </div>
  `;
}

function repairCurrentShip() {
  const repairCost = getRepairCost();

  if (repairCost <= 0) {
    alert("Hull is already fully repaired.");
    return;
  }

  if (credits < repairCost) {
    alert("Not enough credits to repair hull.");
    return;
  }

  credits -= repairCost;
  hull = hullMax;

  addHudToast(`Hull repaired in Hangar for CR ${formatNumber(repairCost)}.`);
  updateSpaceHUD();
  renderHangar();
  saveGame();
}

function renderHangarEditor() {
  if (!document.getElementById("shipStats")) return;
  const ship = SHIPS[selectedHangarShipId] || getCurrentShip();
  const stats = getShipStats(selectedHangarShipId);
  const loadout = getShipLoadout(selectedHangarShipId);
  const weapon = getEquippedWeapon(selectedHangarShipId);

  const title = document.getElementById("shipEditorTitle");
  if (title) title.textContent = `Edit ${ship.name}`;

  document.getElementById("hangarShipTitle").textContent = ship.name;
  document.getElementById("hangarShipImage").src = ship.image;
  document.getElementById("hangarShipImage").alt = ship.name;

  document.getElementById("shipStats").innerHTML = `
    <div><strong>Status:</strong> ${currentShipId === selectedHangarShipId ? "Equipped" : "Owned"}</div>
    <div><strong>Attachment Slots:</strong> ${loadout.attachments.length} / ${getAttachmentSlotLimit(selectedHangarShipId)}</div>
    <div><strong>Gun Slots:</strong> ${loadout.guns.length} / ${getGunSlotLimit(selectedHangarShipId)}</div>
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
  box.classList.toggle("many-slots", limit >= 8);
  box.classList.toggle("very-many-slots", limit >= 14);
}

function updateLoadoutSlotSummaries() {
  const loadout = getShipLoadout(selectedHangarShipId);
  const gunLimit = getGunSlotLimit(selectedHangarShipId);
  const attachmentLimit = getAttachmentSlotLimit(selectedHangarShipId);
  const gunCount = loadout.guns.filter(Boolean).length;
  const attachmentCount = loadout.attachments.filter(Boolean).length;
  const gunText = `${gunCount}/${gunLimit}`;
  const attachmentText = `${attachmentCount}/${attachmentLimit}`;
  const totalText = `${gunCount + attachmentCount}/${gunLimit + attachmentLimit}`;

  const summaries = {
    gunSlotSummary: gunText,
    gunSlotSummaryMirror: gunText,
    attachmentSlotSummary: attachmentText,
    attachmentSlotSummaryMirror: attachmentText,
    totalSlotSummary: totalText
  };

  Object.entries(summaries).forEach(([id, text]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = text;
  });

  const pipSummaries = {
    gunSlotPipsMirror: renderSlotPips(gunLimit, gunCount),
    attachmentSlotPipsMirror: renderSlotPips(attachmentLimit, attachmentCount),
    totalSlotPips: renderSlotPips(gunLimit + attachmentLimit, gunCount + attachmentCount)
  };

  Object.entries(pipSummaries).forEach(([id, html]) => {
    const node = document.getElementById(id);
    if (node) node.innerHTML = html;
  });
}


function getEquippedTooltipEntry(key, quality, categoryKey) {
  const isGun = categoryKey === "guns";
  const definition = isGun ? GUNS[key] : attachments[key];
  if (!definition) return null;

  return {
    key,
    quality: quality || "standard",
    count: 1,
    name: definition.name,
    icon: definition.image
  };
}


function renderInstalledAttachments() {
  const box = document.getElementById("installedAttachments");
  if (!box) return;

  const loadout = getShipLoadout(selectedHangarShipId);
  const limit = getAttachmentSlotLimit(selectedHangarShipId);
  setSlotRailDensity(box, limit);
  updateLoadoutSlotSummaries();

  box.innerHTML = "";

  for (let i = 0; i < limit; i++) {
    const entry = loadout.attachments[i];
    const key = getEquipmentKey(entry);
    const quality = getEquipmentQuality(entry);
    const item = attachments[key];

    const slot = document.createElement("button");
    slot.className = `equipment-slot scalable-loadout-slot ${item ? "filled" : "empty"} quality-${quality}`;
    slot.dataset.slotIndex = String(i + 1).padStart(2, "0");
    slot.disabled = !item;
    slot.onclick = () => removeAttachment(i);

    if (item) {
      slot.removeAttribute("title");
      const tooltipEntry = getEquippedTooltipEntry(key, quality, "attachments");
      showHangarTooltip(slot, getEquipmentTooltipHtml(tooltipEntry, "attachments"));
      bindHangarEquipmentTooltip(slot);
    } else {
      slot.title = `Empty equipment slot ${i + 1}`;
    }

    slot.innerHTML = item
      ? `<img src="${item.image}" alt="${item.name}">`
      : `<span class="slot-silhouette attachment-silhouette">E</span>`;

    box.appendChild(slot);
  }
}

function renderInstalledGuns() {
  const box = document.getElementById("installedGuns");
  if (!box) return;

  const loadout = getShipLoadout(selectedHangarShipId);
  const limit = getGunSlotLimit(selectedHangarShipId);
  setSlotRailDensity(box, limit);
  updateLoadoutSlotSummaries();

  box.innerHTML = "";

  for (let i = 0; i < limit; i++) {
    const entry = loadout.guns[i];
    const key = getEquipmentKey(entry);
    const quality = getEquipmentQuality(entry);
    const item = GUNS[key];

    const slot = document.createElement("button");
    slot.className = `equipment-slot scalable-loadout-slot ${item ? "filled" : "empty"} quality-${quality}`;
    slot.dataset.slotIndex = String(i + 1).padStart(2, "0");
    slot.disabled = !item;
    slot.onclick = () => removeGun(i);

    if (item) {
      slot.removeAttribute("title");
      const tooltipEntry = getEquippedTooltipEntry(key, quality, "guns");
      showHangarTooltip(slot, getEquipmentTooltipHtml(tooltipEntry, "guns"));
      bindHangarEquipmentTooltip(slot);
    } else {
      slot.title = `Empty gun slot ${i + 1}`;
    }

    slot.innerHTML = item
      ? `<img src="${item.image}" alt="${item.name}">`
      : `<span class="slot-silhouette gun-silhouette">G</span>`;

    box.appendChild(slot);
  }
}

function getInventoryEntriesForCategory(categoryKey) {
  ensureInventoryObjects();
  const grouped = new Map();

  function addEntry(key, quality, count, source) {
    const definition = itemDefinitions[key];
    if (!definition || getItemCategoryKey(key) !== categoryKey || count <= 0) return;
    const groupKey = `${source}__${key}__${quality}`;
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        groupKey,
        source,
        key,
        quality,
        name: definition.name,
        icon: definition.icon,
        count: 0
      });
    }
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
    addEntry(item.key, item.key === "lupenCore" ? LUPEN_CORE_QUALITY : (item.quality || "standard"), 1, "inventory");
  });

  return Array.from(grouped.values()).sort((a, b) => {
    const qualityDelta = ITEM_QUALITY_ORDER.indexOf(b.quality) - ITEM_QUALITY_ORDER.indexOf(a.quality);
    if (qualityDelta !== 0) return qualityDelta;
    return a.name.localeCompare(b.name);
  });
}

function removeOneInventoryItem(key, quality) {
  const index = inventoryItems.findIndex(item => item.key === key && item.quality === quality);
  if (index === -1) return null;
  const [removed] = inventoryItems.splice(index, 1);
  return removed;
}

function updateEquipmentInventoryCount() {
  const total = getInventoryEntriesForCategory("guns").reduce((sum, entry) => sum + entry.count, 0)
    + getInventoryEntriesForCategory("attachments").reduce((sum, entry) => sum + entry.count, 0);
  const el = document.getElementById("equipmentInventoryCount");
  if (el) el.textContent = `${formatNumber(total)} item${total === 1 ? "" : "s"}`;
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
          <div class="hangar-tooltip-meta">${escapeHtml(qualityLabel)} / x${qty} owned</div>
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



function ensureHangarTooltip() {
  let tooltip = document.getElementById("hangarTooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "hangarTooltip";
    document.body.appendChild(tooltip);
  }
  return tooltip;
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


function renderAttachmentInventory() {
  const box = document.getElementById("attachmentInventory");
  if (!box) return;

  const loadout = getShipLoadout(selectedHangarShipId);
  const full = loadout.attachments.length >= getAttachmentSlotLimit(selectedHangarShipId);
  const entries = getInventoryEntriesForCategory("attachments");
  const countEl = document.getElementById("attachmentInventoryCount");
  if (countEl) countEl.textContent = `${formatNumber(entries.reduce((sum, entry) => sum + entry.count, 0))} available`;
  updateEquipmentInventoryCount();
  box.innerHTML = "";

  if (!entries.length) {
    box.innerHTML = `<div class="cargo-empty compact-empty">No spare attachments</div>`;
    return;
  }

  entries.forEach(entry => {
    const btn = document.createElement("button");
    btn.className = `inventory-icon-card hangar-equipment-card quality-${entry.quality}`;
    btn.dataset.itemKey = entry.key;
    btn.dataset.itemType = "attachment";
    btn.disabled = entry.count <= 0 || full;
    btn.onclick = () => equipAttachmentFromInventory(entry.key, entry.quality, entry.source);
    btn.removeAttribute("title");
    showHangarTooltip(btn, getEquipmentTooltipHtml(entry, "attachments"));
    bindHangarEquipmentTooltip(btn);

    btn.innerHTML = `
      <img src="${entry.icon}" alt="${entry.name}">
      <span class="sr-only">${entry.name}</span>
      <strong>x${formatNumber(entry.count)}</strong>
    `;

    box.appendChild(btn);
  });
}

function renderGunInventory() {
  const box = document.getElementById("gunInventory");
  if (!box) return;

  const loadout = getShipLoadout(selectedHangarShipId);
  const full = loadout.guns.length >= getGunSlotLimit(selectedHangarShipId);
  const entries = getInventoryEntriesForCategory("guns");
  const countEl = document.getElementById("gunInventoryCount");
  if (countEl) countEl.textContent = `${formatNumber(entries.reduce((sum, entry) => sum + entry.count, 0))} available`;
  updateEquipmentInventoryCount();
  box.innerHTML = "";

  if (!entries.length) {
    box.innerHTML = `<div class="cargo-empty compact-empty">No spare guns</div>`;
    return;
  }

  entries.forEach(entry => {
    const gun = GUNS[entry.key];
    const btn = document.createElement("button");
    btn.className = `inventory-icon-card hangar-equipment-card quality-${entry.quality}`;
    btn.dataset.itemKey = entry.key;
    btn.dataset.itemType = "gun";
    btn.disabled = entry.count <= 0 || full;
    btn.onclick = () => equipGunFromInventory(entry.key, entry.quality, entry.source);
    btn.removeAttribute("title");
    showHangarTooltip(btn, getEquipmentTooltipHtml(entry, "guns"));
    bindHangarEquipmentTooltip(btn);

    btn.innerHTML = `
      <img src="${entry.icon}" alt="${entry.name}">
      <span class="sr-only">${entry.name}</span>
      <strong>x${formatNumber(entry.count)}</strong>
    `;

    box.appendChild(btn);
  });
}

function renderAttachmentShop() {
  const box = document.getElementById("attachmentShop");
  if (!box) return;

  box.innerHTML = "";

  Object.entries(attachments).forEach(([key, item]) => {
    const canAfford = credits >= item.price;
    const owned = ownedAttachments[key] || 0;

    const card = document.createElement("div");
    card.className = "equipment-card";
    card.innerHTML = `
      <img src="${item.image}" alt="${item.name}">
      <div class="equipment-card-meta">
        <h4>${item.name}</h4>
        <p>${item.description}</p>
        <p>Owned: ${formatNumber(owned)}</p>
        <p>Price: CR ${formatNumber(item.price)}</p>
      </div>
      <div class="equipment-card-actions">
        <button class="store-buy-attachment-action" data-item-key="${key}" data-item-type="attachment" onclick="buyAttachment('${key}')" ${!canAfford ? "disabled" : ""}>Buy</button>
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

    const card = document.createElement("div");
    card.className = "equipment-card";
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
        <button class="store-buy-gun-action" data-item-key="${key}" data-item-type="gun" onclick="buyGun('${key}')" ${!canAfford ? "disabled" : ""}>Buy</button>
      </div>
    `;
    box.appendChild(card);
  });
}

function getExchangeShips() {
  return Object.values(SHIPS).filter(ship => !ship.hiddenFromExchange);
}

function getShipyardSelectedShip() {
  if (!SHIPS[selectedShipyardShipId] || SHIPS[selectedShipyardShipId].hiddenFromExchange) {
    selectedShipyardShipId = getExchangeShips().find(ship => !ownedShips.includes(ship.id))?.id || currentShipId || "lupenOrigin";
  }
  return SHIPS[selectedShipyardShipId] || getCurrentShip();
}

function selectShipyardShip(shipId) {
  if (!SHIPS[shipId]) return;
  selectedShipyardShipId = shipId;
  renderShipShop();
  renderShipyardDetail();
}

function renderShipyardStatPills(shipId) {
  const stats = getShipStats(shipId);
  return `
    ${renderFleetStatChip("Hull", formatNumber(stats.hull), "hull-stat")}
    ${renderFleetStatChip("Shield", formatNumber(stats.shield), "shield-stat")}
    ${renderFleetStatChip("Armor", formatNumber(stats.armor), "hull-stat")}
    ${renderFleetStatChip("Cargo", formatNumber(stats.cargo), "cargo-stat")}
    ${renderFleetStatChip("Jump", formatNumber(stats.jumpRecharge), "jump-stat")}
    ${renderFleetStatChip("Evasion", formatEvasion(stats.evasion), "evasion-stat")}
  `;
}

function getShipyardClassLabel(ship = {}) {
  return String(ship.roleSubtitle || "Available Hull")
    .replace(/\s+hull$/i, "")
    .split("/")
    .map(part => part.trim())
    .filter(Boolean)
    .join(" / ")
    .toUpperCase();
}

function getShipyardClassMark(ship = {}) {
  const label = getShipyardClassLabel(ship);
  return label.split(/\s+/).map(part => part[0]).join("").slice(0, 2) || "HX";
}

function renderExchangeStatRail(shipId) {
  const stats = getShipStats(shipId);
  const statRows = [
    ["Hull", formatNumber(stats.hull)],
    ["Shield", formatNumber(stats.shield)],
    ["Armor", formatNumber(stats.armor)],
    ["Cargo", formatNumber(stats.cargo)],
    ["Jump", `${formatNumber(stats.jumpRecharge)} LY`],
    ["Evasion", formatEvasion(stats.evasion)]
  ];

  return statRows.map(([label, value]) => `
    <div class="exchange-stat-cell">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");
}

function renderExchangeSlotPips(count) {
  const safeCount = Math.max(0, Math.round(Number(count || 0)));
  const visibleCount = Math.min(safeCount, 8);
  if (!visibleCount) return `<span class="exchange-slot-pip empty"></span>`;
  return Array.from({ length: visibleCount }).map(() => `<span class="exchange-slot-pip filled"></span>`).join("");
}

function renderExchangeHardpointRail(shipId) {
  const guns = getGunSlotLimit(shipId);
  const equip = getAttachmentSlotLimit(shipId);
  return `
    <div class="exchange-hardpoint-title">
      <span>Hardpoints</span>
      <strong>${guns} gun / ${equip} equip</strong>
    </div>
    <div class="exchange-hardpoint-bank">
      <span>Guns</span>
      <strong>${guns}</strong>
      <div class="exchange-slot-pips">${renderExchangeSlotPips(guns)}</div>
    </div>
    <div class="exchange-hardpoint-bank">
      <span>Equip</span>
      <strong>${equip}</strong>
      <div class="exchange-slot-pips">${renderExchangeSlotPips(equip)}</div>
    </div>
  `;
}

function renderShipyardDetail() {
  const panel = document.getElementById("shipyardDetailPanel");
  if (!panel) return;

  const ship = getShipyardSelectedShip();
  const owned = ownedShips.includes(ship.id);
  const equipped = currentShipId === ship.id;
  const canAfford = credits >= ship.price;
  const stats = getShipStats(ship.id);
  const status = document.getElementById("shipyardDetailStatus");
  if (status) status.textContent = equipped ? "In Use" : owned ? "Owned" : "Available";

  let primaryAction = "";
  let secondaryAction = "";
  if (equipped) {
    primaryAction = `<button class="fleet-primary-swap" disabled>In Use</button>`;
    secondaryAction = `<button onclick="showHangarSection('overview');">Open Loadout</button>`;
  } else if (owned) {
    primaryAction = `<button class="fleet-primary-swap" onclick="equipShip('${ship.id}'); showHangarSection('shipyard');">Fly This Ship</button>`;
    secondaryAction = `<button onclick="equipShip('${ship.id}'); showHangarSection('overview');">Open Loadout</button>`;
  } else {
    primaryAction = `<button class="fleet-primary-swap buy-ship-action" data-tutorial-target="firstShipBuy" onclick="buyShip('${ship.id}')" ${!canAfford ? "disabled" : ""}>Buy Hull</button>`;
    secondaryAction = `<button class="shipyard-price-action" disabled>CR ${formatNumber(ship.price)}</button>`;
  }

  panel.innerHTML = `
    <div class="fleet-detail-hero">
      <div class="fleet-detail-ship-glow"></div>
      <img src="${ship.image}" alt="${ship.name}">
    </div>

    <div class="fleet-detail-title">
      <div>
        <h4>${ship.name}</h4>
        <p>${ship.roleSubtitle || getShipyardClassLabel(ship)}</p>
      </div>
      <span class="fleet-status-chip ${equipped ? "active" : owned ? "" : "available"}">${equipped ? "In Use" : owned ? "Owned" : "Available"}</span>
    </div>

    <div class="fleet-detail-stats">
      ${renderFleetStatChip("Hull", formatNumber(stats.hull), "hull-stat")}
      ${renderFleetStatChip("Shield", formatNumber(stats.shield), "shield-stat")}
      ${renderFleetStatChip("Armor", formatNumber(stats.armor), "hull-stat")}
      ${renderFleetStatChip("Cargo", formatNumber(stats.cargo), "cargo-stat")}
      ${renderFleetStatChip("Jump", formatNumber(stats.jumpRecharge), "jump-stat")}
      ${renderFleetStatChip("Evasion", formatEvasion(stats.evasion), "evasion-stat")}
    </div>

    <div class="shipyard-capacity-panel fleet-capacity-panel">
      <div class="shipyard-capacity-heading">
        <span>Hardpoints</span>
        <strong>${formatSlotCapacityShort(ship.id)}</strong>
      </div>
      ${renderShipSlotSummary(ship.id, "capacity")}
    </div>

    <div class="fleet-detail-actions compact fleet-swap-actions shipyard-purchase-actions">
      ${primaryAction}
      ${secondaryAction}
    </div>
  `;
}

function renderShipShop() {
  const box = document.getElementById("shipShop");
  if (!box) return;
  const title = document.getElementById("hangarShipTitle");
  const subtitle = document.getElementById("hangarShipSubtitle");
  if (title) title.textContent = "Vessel Exchange";
  if (subtitle) subtitle.textContent = "Available hulls and purchase options";

  const creditText = document.getElementById("shipyardCreditText");
  if (creditText) creditText.textContent = formatNumber(credits);

  if (!SHIPS[selectedShipyardShipId] || SHIPS[selectedShipyardShipId].hiddenFromExchange) {
    selectedShipyardShipId = getExchangeShips().find(ship => !ownedShips.includes(ship.id))?.id || currentShipId;
  }

  box.innerHTML = "";

  getExchangeShips().forEach(ship => {
    const owned = ownedShips.includes(ship.id);
    const equipped = currentShipId === ship.id;
    const selected = selectedShipyardShipId === ship.id;
    const stats = getShipStats(ship.id);

    const card = document.createElement("button");
    const isTutorialRequiredShip = tutorialState?.active && getCurrentTutorialStep()?.id === "buy-first-ship" && ship.id === "lupenOrigin";
    card.className = `fleet-ship-card fleet-selector-card vessel-exchange-card exchange-vessel-card ${selected ? "selected" : ""} ${equipped ? "active" : ""} ${owned ? "owned" : ""} ${isTutorialRequiredShip ? "tutorial-required-ship" : ""}`;
    card.dataset.shipId = ship.id;
    if (ship.id === "lupenOrigin") card.dataset.tutorialTarget = "firstShipCard";
    card.onclick = () => selectShipyardShip(ship.id);
    card.innerHTML = `
      <div class="fleet-card-badge">${equipped ? "In Use" : owned ? "Owned" : `CR ${formatNumber(ship.price)}`}</div>
      <div class="fleet-card-image-wrap">
        <img src="${ship.image}" alt="${ship.name}">
      </div>
      <div class="fleet-card-name">${ship.name}</div>
      <div class="fleet-card-role">${ship.roleSubtitle || getShipyardClassLabel(ship)}</div>
      <div class="fleet-card-mini-stats">
        <span>Hull ${formatNumber(stats.hull)}</span>
        <span>Shield ${formatNumber(stats.shield)}</span>
        <span>Cargo ${formatNumber(stats.cargo)}</span>
      </div>
      <div class="fleet-card-slots compact-fleet-slots">${renderShipSlotSummary(ship.id, "capacity")}</div>
    `;
    box.appendChild(card);
  });

  renderShipyardDetail();
}


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
  return {
    id: "daily:core:lupenCore",
    kind: "core",
    key: "lupenCore",
    name: "Lupen Core",
    category: "cores",
    image: "assets/items/lupen-core.png",
    fixedQuality: LUPEN_CORE_QUALITY,
    storeTier: "Catalyst Stock",
    dailyStock: true,
    stockLimit: 250,
    basePrice: 0,
    description: "God-tier catalyst used by the Forge to support quality upgrades."
  };
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

  const dailyItem = getDailyStoreItem(items);
  if (dailyItem) {
    items.push(dailyItem);
  }

  const order = { attachments: 0, guns: 1 };
  return items.sort((a, b) => {
    if (a.dailyStock !== b.dailyStock) return a.dailyStock ? 1 : -1;
    const delta = (order[a.category] ?? 99) - (order[b.category] ?? 99);
    if (delta !== 0) return delta;
    return a.name.localeCompare(b.name);
  });
}

function isStoreOwnedItem(item, quality = selectedStoreQuality) {
  if (!item) return false;
  if (item.kind === "ship") return false;
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
    return getWeaponPurchaseStatRows(gun, quality).filter(stat => stat.label !== "DPS");
  }

  if (item.kind === "attachment") {
    return getAttachmentPurchaseStatRows(item, quality);
  }

  if (item.kind === "core") {
    return [
      { label: "Tier", value: "God-tier catalyst" },
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

  // Step 25 is a two-part action: select Evasion Matrix, then buy it.
  // Refresh the tutorial after selection so the highlight moves onto the Buy button.
  if (tutorialState?.active && getCurrentTutorialStep()?.id === "buy-equipment") {
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

  if (tutorialState?.active && getCurrentTutorialStep()?.id === "buy-equipment") {
    storeFilter = "attachments";
    selectedStoreQuality = "standard";
    const evasionItem = getStoreCatalogItems().find(item => item.key === "evasionMatrix" && item.kind === "attachment");
    if (evasionItem) selectedStoreItemId = evasionItem.id;
  }

  const node = sectorNodes[currentNode] || sectorNodes[lastPlanetNode] || { name: "Asteron Prime" };
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

  if (tutorialState?.active && getCurrentTutorialStep()?.id === "buy-equipment") {
    setTimeout(() => {
      const target = document.querySelector(".store-detail-buy-action[data-item-key='evasionMatrix']:not(:disabled)") ||
        document.querySelector(".store-catalog-card[data-item-key='evasionMatrix']:not(.sold-out)");
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
    <button class="store-filter-btn ${storeFilter === filter.key ? "active" : ""}" onclick="setStoreFilter('${filter.key}')">${filter.label}</button>
  `).join("");
}


function renderStoreQualityFilters() {
  const bar = document.getElementById("storeQualityBar");
  if (!bar) return;

  selectedStoreQuality = "standard";
  bar.innerHTML = `<div class="store-daily-status"><span id="storeResetTimerText">Store items refresh in 24:00:00</span></div>`;
  updateStoreResetTimer();
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
      : item.kind === "core"
        ? getStoreItemInventoryCount(item, quality)
        : getStoreOwnedReadyCount(item) + getStoreItemInventoryCount(item, quality);
    let status = "";

    if (item.kind === "ship") {
      status = currentShipId === item.key ? "Equipped" : (ownedShips.includes(item.key) ? "Owned" : "");
    } else if (item.kind === "core") {
      status = ownedCount > 0 ? `Owned x${formatNumber(ownedCount)}` : "";
    } else {
      status = ownedCount > 0 ? `Owned x${formatNumber(ownedCount)}` : "";
    }

    const stockLabel = getStoreStockLabel(item);
    const soldOut = getStoreStockRemaining(item) === 0;
    const categoryLabel = getStoreCardCategoryLabel(item, quality);
    const priceLabel = item.kind === "core" ? "Upgrade Material" : (soldOut ? "Sold Out" : `CR ${formatNumber(price)}`);

    return `
      <button class="store-catalog-card ${selectedStoreItemId === item.id ? "selected" : ""} ${item.dailyStock ? "daily-stock-card" : ""} ${soldOut ? "sold-out" : ""} quality-${quality}" data-item-key="${item.key}" data-item-kind="${item.kind}" onclick="selectStoreItem('${item.id}')">
        ${status ? `<span class="store-card-status">${status}</span>` : ""}
        <div class="store-card-art quality-${quality}">
          <img src="${item.image}" alt="${item.name}">
        </div>
        <div class="store-card-name">${item.name}</div>
        <div class="store-card-sub">${categoryLabel}</div>
        <div class="store-card-stock">${stockLabel}</div>
        <div class="store-card-price">${priceLabel}</div>
      </button>`;
  }).join("");
}

function getStoreCardCategoryLabel(item, quality = "standard") {
  if (!item) return "";
  if (item.kind === "gun") return "Gun";
  if (item.kind === "attachment") return "Attachment";
  if (item.kind === "core") return "Legendary Catalyst";
  if (item.kind === "ship") return "Ship";
  return item.category || "";
}

function getStoreDetailKicker(item, quality = "standard") {
  if (!item) return "";
  if (item.kind === "core") return "Legendary Catalyst";
  return `${getStoreCardCategoryLabel(item, quality)} / ${titleCaseQuality(quality)}`;
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
    : (ownedReady + inventoryCount);
  const stockRemaining = getStoreStockRemaining(item);
  const hasStock = stockRemaining > 0 || !Number.isFinite(stockRemaining);
  const canBuy = item.kind === "ship" ? (!ownedShips.includes(item.key) && credits >= buyPrice && hasStock) : credits >= buyPrice && hasStock;
  const sellPrice = item.kind === "ship"
    ? 0
    : (item.kind === "attachment" || item.kind === "gun") && quality === "standard" && ownedReady > 0
      ? Math.max(1, Math.floor(item.basePrice * 0.7))
      : inventoryCount > 0
        ? getInventoryItemSellValue(item.key, quality)
        : 0;

  const detailStats = getStoreDetailStats(item, quality);
  const detailStatsHtml = detailStats.length ? `
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
  const stagingPreviewButton = stagingStoreItemId
    ? `<button class="store-detail-buy-action" data-item-key="${item.key}" data-item-kind="${item.kind}" onclick="storeBuySelected()" ${hasStock && !multiplayerStagingStorePurchasePending ? "" : "disabled"}>${hasStock ? (stagingWritableItem ? (multiplayerStagingStorePurchasePending ? "Pending..." : "Staging Purchase") : "Server Preview") : "Sold Out"}</button>`
    : `<button class="store-detail-buy-action" disabled>Server preview unavailable</button>`;

  if (item.kind === "core") {
    buyButton = stagingStoreLocked
      ? `<button class="store-detail-buy-action store-core-action" disabled>Server preview unavailable</button>`
      : `<button class="store-detail-buy-action store-core-action" data-item-key="${item.key}" data-item-kind="${item.kind}" onclick="openUpgradeForge()">Open Upgrade Bay</button>`;
  } else if (item.kind === "ship") {
    if (currentShipId === item.key) {
      buyButton = `<button disabled>Equipped</button>`;
    } else if (ownedShips.includes(item.key)) {
      buyButton = `<button disabled>Owned in Hangar</button>`;
    } else {
      buyButton = stagingStoreLocked
        ? stagingPreviewButton
        : `<button class="store-detail-buy-action" data-item-key="${item.key}" data-item-kind="${item.kind}" onclick="storeBuySelected()" ${!canBuy ? "disabled" : ""}>${hasStock ? `Buy / CR ${formatNumber(buyPrice)}` : "Sold Out"}</button>`;
    }
  } else {
    buyButton = stagingStoreLocked
      ? stagingPreviewButton
      : `<button class="store-detail-buy-action" data-item-key="${item.key}" data-item-kind="${item.kind}" onclick="storeBuySelected()" ${!canBuy ? "disabled" : ""}>${hasStock ? `Buy / CR ${formatNumber(buyPrice)}` : "Sold Out"}</button>`;
    if (sellPrice > 0) {
      const sellHandler = (item.kind === "attachment" || item.kind === "gun") && quality === "standard" && ownedReady > 0
        ? 'storeSellSelectedOwned()'
        : 'storeSellSelectedInventory(1)';
      sellButton = stagingStoreLocked
        ? `<button disabled>Selling disabled in MP staging</button>`
        : `<button onclick="${sellHandler}">Sell / CR ${formatNumber(sellPrice)}</button>`;
    }
  }

  const ownershipLine = item.kind === "ship"
    ? (ownedShips.includes(item.key) ? (currentShipId === item.key ? "Currently equipped" : "Owned in hangar") : "Not owned")
    : (totalOwned > 0 ? `Owned / x${formatNumber(totalOwned)}` : "Not owned");

  panel.innerHTML = `
    <div class="store-detail-shell store-quality-${quality} compact-store-detail simplified-store-detail">
      <div class="store-detail-content">
        <div class="store-detail-visual quality-${quality}">
          <img src="${item.image}" alt="${item.name}">
        </div>

        <div class="store-detail-kicker">${getStoreDetailKicker(item, quality)}</div>
        <div class="store-detail-title">${item.name}</div>
        <div class="store-detail-desc">${item.description}</div>
        <div class="store-detail-owned-line">${ownershipLine} / ${getStoreStockLabel(item)}</div>
        ${renderStagingStorePreviewNote(item)}
        ${renderStagingCargoPodEquipNote(item)}
        ${renderStagingPulseLaserEquipNote(item)}
        ${detailStatsHtml}
      </div>

      <div class="store-buy-footer store-detail-actions compact-store-actions simplified-store-actions ${sellButton ? 'two-buttons' : 'one-button'}">
        ${buyButton}
        ${stagingStoreLocked && stagingStoreItemId === "attachment:cargoPod" && totalOwned > 0 ? `<button class="store-detail-buy-action" onclick="requestStagingCargoPodEquip(getStoreSelectedItem())" ${multiplayerStagingCargoPodEquipPending ? "disabled" : ""}>${multiplayerStagingCargoPodEquipPending ? "Applying..." : "Apply Cargo Pod"}</button>` : ""}
        ${stagingStoreLocked && stagingStoreItemId === "gun:pulseLaser" && totalOwned > 0 ? `<button class="store-detail-buy-action" onclick="requestStagingPulseLaserEquip(getStoreSelectedItem())" ${multiplayerStagingPulseLaserEquipPending ? "disabled" : ""}>${multiplayerStagingPulseLaserEquipPending ? "Applying..." : "Apply Pulse Laser"}</button>` : ""}
        ${sellButton}
      </div>
    </div>`;
}

function storeBuySelected() {
  const item = getStoreSelectedItem();
  if (!item) return;
  if (isMultiplayerStagingStoreActive()) {
    requestStagingStorePurchase(item);
    return;
  }
  if (item.kind === "core") {
    openUpgradeForge();
    return;
  }
  const quality = getStoreItemDisplayQuality(item);
  const price = getStorePrice(item, quality);
  if (getStoreStockRemaining(item) <= 0) {
    alert("This daily store item has sold out.");
    return;
  }

  if (credits < price) {
    alert("Not enough credits.");
    return;
  }

  if (item.kind === "ship") {
    buyShip(item.key);
    return;
  }

  if (item.kind === "attachment") {
    if (quality === "standard") {
      if (!canAddInventoryItems(1)) {
        alert(INVENTORY_FULL_MESSAGE);
        return;
      }
      buyAttachment(item.key);
      recordStorePurchase(item);
      tutorialEvent("boughtEquipment");
    } else {
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
    return;
  }

  if (item.kind === "gun") {
    if (quality === "standard") {
      if (!canAddInventoryItems(1)) {
        alert(INVENTORY_FULL_MESSAGE);
        return;
      }
      buyGun(item.key);
      recordStorePurchase(item);
      tutorialEvent("boughtEquipment");
    } else {
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
  ownedAttachments[key] -= 1;
  credits += Math.max(1, Math.floor(item.price * 0.7));
  renderStore();
  saveGame();
}

function sellOwnedGun(key) {
  if (blockStoreMutationInMultiplayerStaging()) return;
  const item = GUNS[key];
  if (!item || (ownedGuns[key] || 0) <= 0) return;
  ownedGuns[key] -= 1;
  credits += Math.max(1, Math.floor(item.price * 0.7));
  renderStore();
  saveGame();
}

function sellShipToStore(shipId) {
  if (blockStoreMutationInMultiplayerStaging()) return;
  const ship = SHIPS[shipId];
  if (!ship || shipId === currentShipId || !ownedShips.includes(shipId)) return;
  ownedShips = ownedShips.filter(id => id !== shipId);
  delete shipLoadouts[shipId];
  credits += Math.max(1, Math.floor(ship.price * 0.7));
  renderStore();
  saveGame();
}

function buyAttachment(key) {
  if (blockStoreMutationInMultiplayerStaging()) return;
  const item = attachments[key];
  if (!item) return;

  if (!canAddInventoryItems(1)) {
    alert(INVENTORY_FULL_MESSAGE);
    return;
  }

  if (credits < item.price) {
    alert("Not enough credits.");
    return;
  }

  credits -= item.price;
  ownedAttachments[key] = (ownedAttachments[key] || 0) + 1;

  if (key === "evasionMatrix") tutorialEvent("boughtStoreEvasionMatrix");
  tutorialEvent("boughtStoreAttachment");
  tutorialEvent("boughtEquipment");

  renderStore();
  showScreen("storeScreen");
  saveGame();
}

function buyGun(key) {
  if (blockStoreMutationInMultiplayerStaging()) return;
  const item = GUNS[key];
  if (!item) return;

  if (!canAddInventoryItems(1)) {
    alert(INVENTORY_FULL_MESSAGE);
    return;
  }

  if (credits < item.price) {
    alert("Not enough credits.");
    return;
  }

  credits -= item.price;
  ownedGuns[key] = (ownedGuns[key] || 0) + 1;

  tutorialEvent("boughtStoreGun");
  tutorialEvent("boughtEquipment");

  renderStore();
  showScreen("storeScreen");
  saveGame();
}

function equipAttachmentFromInventory(key, quality = "standard", source = "owned") {
  if (isMultiplayerStagingStoreActive()) {
    if (key === "cargoPod" && quality === "standard" && source === "owned") {
      requestStagingCargoPodEquip({ kind: "attachment", key: "cargoPod" });
      return;
    }
    blockLoadoutMutationInMultiplayerStaging();
    return;
  }
  const item = attachments[key];
  const loadout = getShipLoadout(selectedHangarShipId);

  if (!item) return;

  if (loadout.attachments.length >= getAttachmentSlotLimit(selectedHangarShipId)) {
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

  loadout.attachments.push(makeLeveledLoadoutEntry(key, quality, level));

  if (selectedHangarShipId === currentShipId) {
    applyShipStats(true);
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

  const [removed] = loadout.attachments.splice(index, 1);

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
    if (key === "pulseLaser" && quality === "standard" && source === "owned") {
      requestStagingPulseLaserEquip({ kind: "gun", key: "pulseLaser" });
      return;
    }
    blockLoadoutMutationInMultiplayerStaging();
    return;
  }
  const item = GUNS[key];
  const loadout = getShipLoadout(selectedHangarShipId);

  if (!item) return;

  if (loadout.guns.length >= getGunSlotLimit(selectedHangarShipId)) {
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

  loadout.guns.push(makeLeveledLoadoutEntry(key, quality, level));

  if (engageTimer && selectedHangarShipId === currentShipId) {
    clearInterval(engageTimer);
    engageTimer = null;
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

  const [removed] = loadout.guns.splice(index, 1);

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

function buyShip(shipId) {
  if (blockStoreMutationInMultiplayerStaging()) return;
  const ship = SHIPS[shipId];
  if (!ship || ownedShips.includes(shipId)) return;

  if (credits < ship.price) {
    alert("Not enough credits.");
    return;
  }

  const hadNoShip = !hasActiveShip();
  credits -= ship.price;
  ownedShips.push(shipId);
  selectedHangarShipId = shipId;
  selectedFleetShipId = shipId;
  selectedShipyardShipId = shipId;
  shipLoadouts[shipId] = { attachments: [], guns: [] };

  if (hadNoShip) {
    currentShipId = shipId;
    grantStarterShipKit();
    applyShipStats(true);
  }

  renderHangar();
  showHangarSection("shipyard");
  addHudToast(`${ship.name} added to your hangar.`);
  tutorialEvent(hadNoShip ? "boughtFirstShip" : "boughtShip");
  saveGame();
}

function equipShip(shipId) {
  if (!ownedShips.includes(shipId)) return;

  currentShipId = shipId;
  selectedHangarShipId = shipId;
  selectedFleetShipId = shipId;
  applyShipStats(true);
  renderHangar();
  addHudToast(`${SHIPS[shipId]?.name || "Ship"} is ready to fly.`);
  saveGame();
}

