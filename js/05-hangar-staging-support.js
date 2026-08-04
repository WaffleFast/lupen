function getItemCategoryKey(itemKey) {
  const definition = itemDefinitions[itemKey];
  if (!definition) return "all";
  if (definition.category === "Weapon") return "guns";
  if (definition.category === "Attachment") return "attachments";
  if (definition.category === "Core") return "cores";
  return "all";
}

const STAGING_STORE_LOCAL_ITEM_IDS = Object.freeze({
  "gun:heavyLance": "gun:heavyLance",
  "gun:ionBlaster": "gun:ionBlaster",
  "gun:meltCannon": "gun:meltCannon",
  "gun:pulseLaser": "gun:pulseLaser",
  "gun:repeater": "gun:repeater",
  "gun:ripperGun": "gun:ripperGun",
  "gun:voidRail": "gun:voidRail",
  "attachment:cargoPod": "attachment:cargoPod",
  "attachment:hullBooster": "attachment:hullBooster",
  "attachment:jumpDrive": "attachment:jumpDrive",
  "attachment:shieldBooster": "attachment:shieldBooster",
  "attachment:evasionMatrix": "attachment:evasionMatrix",
  "material:lupenShards": "material:lupenShard",
  "core:lupenCore": "core:lupenCore",
  "ship:falcon": "ship:falcon",
  "ship:bison": "ship:bison",
  "ship:monolith": "ship:monolith",
  "ship:zeusExplorer": "ship:zeusExplorer"
});

const MAP_ONE_STORE_GUN_KEYS = Object.freeze(["pulseLaser", "repeater", "ionBlaster", "heavyLance", "voidRail"]);
const MAP_ONE_STORE_ATTACHMENT_KEYS = Object.freeze(["cargoPod", "jumpDrive", "shieldBooster"]);
const MAP_ONE_STORE_CATALOG_ORDER = Object.freeze([
  "cargoPod",
  "jumpDrive",
  "pulseLaser",
  "shieldBooster",
  "repeater",
  "ionBlaster",
  "heavyLance",
  "voidRail"
]);

let multiplayerStagingStoreSubscribed = false;
let multiplayerStagingStorePurchasePending = false;
let multiplayerStagingStoreStatusMessage = "";
let storeTransactionNotice = null;
let multiplayerStagingCargoPodEquipPending = false;
let multiplayerStagingShieldBoosterEquipPending = false;
let multiplayerStagingPulseLaserEquipPending = false;
let multiplayerStagingShipEquipPending = false;
let multiplayerStagingLoadoutEquipPendingItemId = "";
let multiplayerStagingLoadoutUnequipPending = false;
let multiplayerStagingStorePurchaseSequence = 0;
let selectedVaultActionContext = null;
let selectedLoadoutItemContext = null;
let selectedLoadoutStatusMessage = "";
let selectedLoadoutSlotCategory = "guns";
let selectedLoadoutSlotExplicitlyChosen = false;
let selectedLoadoutVaultFilter = "guns";
let selectedLoadoutVaultSearch = "";
let selectedLoadoutVaultQuality = "all";
let selectedLoadoutVaultSort = "quality";
let selectedVaultSearch = "";
let selectedVaultSort = "quality";
let selectedVaultQuality = "all";
let selectedVaultStatus = "all";
let selectedShipyardFilter = "all";
let selectedFleetLineId = "all";
let selectedShipyardLineId = "all";
let selectedShipPlanLineId = typeof PIONEER_LINE_ID !== "undefined" ? PIONEER_LINE_ID : "pioneer";
let selectedShipPlanShipId = typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
const LOADOUT_VAULT_CAPACITY = 50;

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
  const message = "Store actions are temporarily unavailable. Please try again shortly.";
  if (typeof addHudToast === "function") addHudToast(message);
  if (typeof addActivityLog === "function") addActivityLog(message);
  if (typeof console !== "undefined" && typeof console.info === "function") {
    console.info(`[Lupen multiplayer] ${message}`);
  }
  return true;
}

function blockLoadoutMutationInMultiplayerStaging() {
  if (!isMultiplayerStagingStoreActive()) return false;
  const message = "Loadout changes are temporarily unavailable. Please try again shortly.";
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

function waitForMultiplayerStagingResult(getResult, predicate, timeoutMs = 12000) {
  const startedAt = Date.now();
  return new Promise(resolve => {
    const check = () => {
      const result = typeof getResult === "function" ? getResult() : null;
      if (result && (!predicate || predicate(result))) {
        resolve(result);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        resolve(result || null);
        return;
      }
      setTimeout(check, 80);
    };
    check();
  });
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

function getLastStagingShieldBoosterEquipResult() {
  const status = getMultiplayerStagingStoreStatus();
  const equip = status.lastStagingLoadoutEquip;
  if (equip?.itemId === "attachment:shieldBooster") return equip;
  const preview = status.lastStagingLoadoutPreview;
  return preview?.itemId === "attachment:shieldBooster" ? preview : null;
}

function getLastStagingPulseLaserEquipResult() {
  const status = getMultiplayerStagingStoreStatus();
  const equip = status.lastStagingLoadoutEquip;
  if (equip?.itemId === "gun:pulseLaser") return equip;
  const preview = status.lastStagingLoadoutPreview;
  return preview?.itemId === "gun:pulseLaser" ? preview : null;
}

function getLastStagingShipEquipResult(itemId = "") {
  const status = getMultiplayerStagingStoreStatus();
  const safeItemId = String(itemId || "").trim();
  const equip = status.lastStagingLoadoutEquip;
  if (safeItemId && equip?.itemId === safeItemId) return equip;
  const preview = status.lastStagingLoadoutPreview;
  return safeItemId && preview?.itemId === safeItemId ? preview : null;
}

function getStagingStorePreviewLine(result) {
  if (!result) return "";
  if (result.applied) return `${result.name || "Store item"} purchased.`;
  if (result.wouldPass) return "Purchase available.";
  if (result.blockReason === "insufficient_credits") return "Not enough credits.";
  if (result.blockReason === "unknown_store_item") return "This item is currently unavailable.";
  if (result.blockReason === "invalid_store_quantity") return "Invalid quantity.";
  if (result.blockReason === "store_station_required" || result.blockReason === "store_station_mismatch") return "You must be docked at this station.";
  if (result.blockReason === "store_item_preview_only" || result.reason === "store_item_preview_only") return "This item is not currently available for purchase.";
  if (result.reason === "staging_store_dry_run_enabled" || result.reason === "staging_store_writes_disabled") return "Purchases are temporarily unavailable.";
  return "Purchase failed. Please try again.";
}

function renderStagingStorePreviewNote(item) {
  if (!isMultiplayerStagingStoreActive()) return "";
  const itemId = getStagingStoreItemId(item);
  const result = itemId ? getLastMatchingStagingStorePreview(itemId) : null;
  if (!itemId) {
    return `<div class="store-transaction-status is-unavailable" role="status">This item is unavailable at this station.</div>`;
  }
  if (!result) {
    if (!multiplayerStagingStoreStatusMessage) return "";
    const message = multiplayerStagingStorePurchasePending
      ? "Processing purchase..."
      : "Checking purchase availability.";
    return `<div class="store-transaction-status is-pending" role="status">${message}</div>`;
  }
  const message = getStagingStorePreviewLine(result);
  const tone = result.applied
    ? "is-success"
    : result.wouldPass
      ? "is-available"
      : "is-unavailable";
  return `
    <div class="store-transaction-status ${tone}" role="status">
      ${escapeHtml(message)}
    </div>`;
}

function setStoreTransactionNotice(item, message, tone = "success") {
  if (!item?.id || !message) return;
  storeTransactionNotice = {
    itemId: item.id,
    message: String(message),
    tone: String(tone || "success")
  };
}

function renderStoreTransactionNotice(item) {
  if (!item?.id || storeTransactionNotice?.itemId !== item.id) return "";
  return `
    <div class="store-transaction-status is-${escapeHtml(storeTransactionNotice.tone)}" role="status">
      ${escapeHtml(storeTransactionNotice.message)}
    </div>`;
}

function isStagingStoreWritableItem(item) {
  const itemId = getStagingStoreItemId(item);
  return Boolean(itemId);
}

function getMultiplayerStagingStoreNodeName() {
  if (!isMultiplayerStagingStoreActive()) return "";
  const status = getMultiplayerStagingStoreStatus();
  return String(status.playerServerNode || status.currentNode || currentNode || lastPlanetNode || "Asteron Prime");
}

function getMultiplayerStagingStorePresenceStatus() {
  if (!isMultiplayerStagingStoreActive()) return "";
  const status = getMultiplayerStagingStoreStatus();
  return String(status.presenceStatus || "docked") === "docked" ? "docked" : "space";
}

function applyStagingStorePurchaseResultToLocalState(result) {
  if (!result?.applied) return false;
  const kind = String(result.localKind || "");
  const key = String(result.localKey || "");
  if (!kind || !key) return false;

  if (Number.isFinite(Number(result.creditsAfter))) {
    credits = Math.max(0, Math.floor(Number(result.creditsAfter)));
  }

  const nextOwnedCount = Number.isFinite(Number(result.itemAfter))
    ? Math.max(0, Math.floor(Number(result.itemAfter)))
    : null;
  const storeItem = getStoreCatalogItem(kind, key) || { kind, key, id: `${kind}:${key}`, basePrice: Number(result.unitPrice || 0) };

  if (kind === "gun") {
    ownedGuns[key] = nextOwnedCount ?? Math.max(0, Number(ownedGuns[key] || 0)) + 1;
    recordStorePurchase(storeItem);
    tutorialEvent("boughtStoreGun");
    tutorialEvent("boughtEquipment");
  } else if (kind === "attachment") {
    ownedAttachments[key] = nextOwnedCount ?? Math.max(0, Number(ownedAttachments[key] || 0)) + 1;
    recordStorePurchase(storeItem);
    if (key === "evasionMatrix") tutorialEvent("boughtStoreEvasionMatrix");
    tutorialEvent("boughtStoreAttachment");
    tutorialEvent("boughtEquipment");
  } else if (kind === "material") {
    upgradeMaterials[key] = nextOwnedCount ?? Math.max(0, Number(upgradeMaterials?.[key] || 0)) + 1;
    recordStorePurchase(storeItem);
  } else if (kind === "core") {
    const existingCount = getStoreItemInventoryCount({ kind: "core", key }, "core");
    const targetCount = nextOwnedCount ?? existingCount + 1;
    for (let index = existingCount; index < targetCount; index += 1) {
      addInventoryItem({ id: `store-${key}-${Date.now()}-${index}`, key, quality: "core" });
    }
    recordStorePurchase(storeItem);
  } else if (kind === "ship") {
    if (!ownedShips.includes(key)) ownedShips.push(key);
    shipLoadouts[key] = normalizeShipLoadout(shipLoadouts[key] || { attachments: [], guns: [] }, key);
    recordStorePurchase(storeItem);
    tutorialEvent("boughtShip");
    if (typeof recordMissionEvent === "function" && SHIPS[key]?.lineId === PIONEER_LINE_ID && key !== STARTER_SHIP_ID) {
      recordMissionEvent("purchase_pioneer_hull", { shipId: key, lineId: SHIPS[key].lineId, source: "staging_store" });
    }
  }

  if (typeof updateSpaceHUD === "function") updateSpaceHUD();
  return true;
}

function reconcileMissionProgressAfterStagingLoadoutResult(result) {
  if (!result?.applied || typeof reconcileMissionProgressFromGameplayState !== "function") return null;
  const itemId = String(result.itemId || "");
  const shipId = String(result.currentShipId || result.targetShipId || selectedHangarShipId || currentShipId || "");
  const options = {
    source: "staging_loadout_confirmed",
    shipId,
    refresh: true,
    save: true,
    notify: true
  };
  if (itemId.startsWith("gun:") && Number.isFinite(Number(result.equippedAfter))) {
    options.weaponCount = Math.max(0, Math.floor(Number(result.equippedAfter)));
  }
  if (itemId.startsWith("attachment:") && Number.isFinite(Number(result.equippedAfter))) {
    options.attachmentCount = Math.max(0, Math.floor(Number(result.equippedAfter)));
  }
  return reconcileMissionProgressFromGameplayState(options);
}

function applyStagingLoadoutResultToLocalState(result) {
  if (!result?.applied) return false;
  const itemId = String(result.itemId || "");
  if (itemId.startsWith("ship:")) {
    const shipId = String(result.selectedShipAfter || result.targetShipId || itemId.slice(5));
    if (!SHIPS[shipId] || !ownedShips.includes(shipId)) return false;
    currentShipId = shipId;
    selectedHangarShipId = shipId;
    selectedFleetShipId = shipId;
    selectedShipyardShipId = shipId;
    shipLoadouts[shipId] = normalizeShipLoadout(shipLoadouts[shipId], shipId);
    applyShipStats(false);
  } else {
    const categoryKey = itemId.startsWith("gun:") ? "guns" : itemId.startsWith("attachment:") ? "attachments" : "";
    const key = itemId.split(":")[1] || "";
    const shipId = String(result.currentShipId || currentShipId || "");
    if (!categoryKey || !key || !SHIPS[shipId]) return false;
    shipLoadouts[shipId] = normalizeShipLoadout(shipLoadouts[shipId], shipId);
    const list = shipLoadouts[shipId][categoryKey];
    const quality = String(result.quality || "standard");
    const level = Math.max(1, Number(result.level || 1));
    const targetCount = Math.max(0, Number(result.equippedAfter || 0));

    if (result.operation === "unequip") {
      let index = Number.isInteger(Number(result.slotIndex)) ? Number(result.slotIndex) : -1;
      if (index < 0 || getEquipmentKey(list[index]) !== key) {
        index = list.findIndex(entry => getEquipmentKey(entry) === key &&
          getEquipmentQuality(entry) === quality &&
          Math.max(1, Number(entry?.level || 1)) === level);
      }
      if (index >= 0) list.splice(index, 1);
      if (result.inventoryWritten) {
        ensureInventoryObjects();
        const returnedInventoryId = String(result.inventoryItemId || `loadout-${key}-${Date.now()}`);
        if (!inventoryItems.some(entry => entry?.id === returnedInventoryId)) {
          inventoryItems.push({ id: returnedInventoryId, key, quality, level });
        }
      }
    } else {
      const currentCount = list.filter(entry => getEquipmentKey(entry) === key).length;
      if (currentCount < targetCount) {
        const entry = { key, quality, level };
        const requestedIndex = Number(result.slotIndex);
        if (Number.isInteger(requestedIndex) && requestedIndex >= 0 && !getEquipmentKey(list[requestedIndex])) {
          list[requestedIndex] = entry;
        } else {
          list.push(entry);
        }
      }
      if (result.inventoryWritten && result.inventoryItemId) {
        ensureInventoryObjects();
        inventoryItems = inventoryItems.filter(entry => entry?.id !== result.inventoryItemId);
      }
    }

    const ownedStore = categoryKey === "guns" ? ownedGuns : ownedAttachments;
    if (Number.isFinite(Number(result.ownedAfter))) ownedStore[key] = Math.max(0, Number(result.ownedAfter));
    shipLoadouts[shipId] = normalizeShipLoadout(shipLoadouts[shipId], shipId);
    applyShipStats(false);
  }

  LupenSaveService.writeJsonLocalStorage(STORAGE_GAME_KEY, buildSaveState({ leaveSave: false }));
  if (typeof updateSpaceHUD === "function") updateSpaceHUD();
  return true;
}

function isTutorialLoadoutEquipStepActive() {
  if (!tutorialState?.active || tutorialState?.completed) return false;
  const stepId = typeof getCurrentTutorialStep === "function"
    ? String(getCurrentTutorialStep()?.id || "")
    : "";
  return ["equip-item", "equip-second-item", "equip-attachment"].includes(stepId);
}

function recoverTutorialLoadoutEquipLocally(item, result = null) {
  if (!isTutorialLoadoutEquipStepActive() || result?.applied) return false;

  const itemId = getStagingStoreItemId(item);
  const categoryKey = itemId?.startsWith("gun:")
    ? "guns"
    : itemId?.startsWith("attachment:")
      ? "attachments"
      : "";
  const key = String(item?.key || itemId?.split(":")[1] || "");
  if (!categoryKey || !key) return false;

  const shipId = String(selectedHangarShipId || currentShipId || "");
  if (!shipId || shipId !== currentShipId) return false;
  const limit = categoryKey === "guns" ? getGunSlotLimit(shipId) : getAttachmentSlotLimit(shipId);
  const loadout = getShipLoadout(shipId);
  const list = categoryKey === "guns" ? loadout.guns : loadout.attachments;
  const requestedIndex = Number(item?.slotIndex);
  let index = Number.isInteger(requestedIndex) &&
    requestedIndex >= 0 &&
    requestedIndex < limit &&
    !getEquipmentKey(list[requestedIndex])
    ? requestedIndex
    : Array.from({ length: limit }, (_unused, slotIndex) => slotIndex)
      .find(slotIndex => !getEquipmentKey(list[slotIndex]));
  if (!Number.isInteger(index) || index < 0 || index >= limit) return false;

  const entry = {
    categoryKey,
    key,
    name: item?.name || (categoryKey === "guns" ? GUNS[key]?.name : attachments[key]?.name) || "Equipment",
    source: item?.inventorySource || item?.source || "owned",
    inventoryId: item?.inventoryItemId || item?.inventoryId || "",
    quality: item?.quality || "standard",
    level: Math.max(1, Number(item?.level || 1)),
    storedCount: categoryKey === "guns"
      ? Math.max(0, Number(ownedGuns?.[key] || 0))
      : Math.max(0, Number(ownedAttachments?.[key] || 0))
  };
  const equippedEntry = consumeLoadoutVaultEntry(entry);
  if (!equippedEntry) return false;

  list[index] = equippedEntry;
  selectedLoadoutSlotExplicitlyChosen = false;
  selectedLoadoutItemContext = {
    source: "equipped",
    categoryKey,
    index,
    key,
    quality: entry.quality,
    level: entry.level
  };
  selectedLoadoutStatusMessage = `${entry.name} equipped.`;
  applyShipStats(true);
  tutorialEvent(categoryKey === "guns" ? "equippedItem" : "equippedAttachment");
  saveGame();
  if (typeof addHudToast === "function") addHudToast(selectedLoadoutStatusMessage);
  if (typeof addActivityLog === "function") {
    addActivityLog(`${selectedLoadoutStatusMessage} Tutorial save synchronized.`);
  }
  return true;
}

function getStagingCargoPodEquipLine(result) {
  if (!result) return "";
  if (result.applied) return "Cargo Pod equipped.";
  if (result.mode === "dry_run" && result.ok) return "Cargo Pod is ready to equip.";
  if (result.blockReason === "cargo_pod_not_owned") return "Purchase a Cargo Pod before equipping it.";
  if (result.blockReason === "attachment_slots_full") return "No empty equipment slots.";
  if (result.reason === "staging_loadout_dry_run_enabled") return "Equipment changes are temporarily unavailable.";
  return "Cargo Pod could not be equipped.";
}

function renderStagingCargoPodEquipNote(item) {
  if (!isMultiplayerStagingStoreActive() || getStagingStoreItemId(item) !== "attachment:cargoPod") return "";
  const result = getLastStagingCargoPodEquipResult();
  if (!result) return "";
  const capacityLine = result?.cargoCapacityBefore !== null && result?.cargoCapacityBefore !== undefined
    ? ` / Cargo ${formatNumber(result.cargoCapacityBefore)} -> ${formatNumber(result.cargoCapacityAfter ?? result.cargoCapacityAfterPreview)}`
    : "";
  const ownedLine = result?.ownedBefore !== null && result?.ownedBefore !== undefined
    ? ` / Owned ${formatNumber(result.ownedBefore)} -> ${formatNumber(result.ownedAfter)}`
    : "";
  return `
    <div class="store-detail-owned-line">
      <strong>${escapeHtml(getStagingCargoPodEquipLine(result))}</strong>${escapeHtml(capacityLine)}${escapeHtml(ownedLine)}
    </div>`;
}

function getStagingShieldBoosterEquipLine(result) {
  if (!result) return "";
  if (result.applied) return "Shield Booster equipped.";
  if (result.mode === "dry_run" && result.ok) return "Shield Booster is ready to equip.";
  if (result.blockReason === "shield_booster_not_owned") return "Purchase a Shield Booster before equipping it.";
  if (result.blockReason === "attachment_slots_full") return "No empty equipment slots.";
  if (result.reason === "staging_loadout_dry_run_enabled") return "Equipment changes are temporarily unavailable.";
  return "Shield Booster could not be equipped.";
}

function renderStagingShieldBoosterEquipNote(item) {
  if (!isMultiplayerStagingStoreActive() || getStagingStoreItemId(item) !== "attachment:shieldBooster") return "";
  const result = getLastStagingShieldBoosterEquipResult();
  if (!result) return "";
  const shieldLine = result?.shieldBefore !== null && result?.shieldBefore !== undefined
    ? ` / Shield ${formatNumber(result.shieldBefore)} -> ${formatNumber(result.shieldAfter ?? result.shieldAfterPreview)}`
    : "";
  const ownedLine = result?.ownedBefore !== null && result?.ownedBefore !== undefined
    ? ` / Owned ${formatNumber(result.ownedBefore)} -> ${formatNumber(result.ownedAfter)}`
    : "";
  return `
    <div class="store-detail-owned-line">
      <strong>${escapeHtml(getStagingShieldBoosterEquipLine(result))}</strong>${escapeHtml(shieldLine)}${escapeHtml(ownedLine)}
    </div>`;
}

function getStagingPulseLaserEquipLine(result) {
  if (!result) return "";
  if (result.applied) return "Weapon equipped.";
  if (result.mode === "dry_run" && result.ok) return "Pulse Laser is ready to equip.";
  if (result.blockReason === "pulse_laser_not_owned") return "Purchase a Pulse Laser before equipping it.";
  if (result.blockReason === "gun_slots_full") return "No empty weapon slots.";
  if (result.reason === "staging_loadout_dry_run_enabled") return "Equipment changes are temporarily unavailable.";
  return "Pulse Laser could not be equipped.";
}

function renderStagingPulseLaserEquipNote(item) {
  if (!isMultiplayerStagingStoreActive() || getStagingStoreItemId(item) !== "gun:pulseLaser") return "";
  const result = getLastStagingPulseLaserEquipResult();
  if (!result) return "";
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
      <strong>${escapeHtml(getStagingPulseLaserEquipLine(result))}</strong>${escapeHtml(slotLine)}${escapeHtml(ownedLine)}
    </div>`;
}

function getStagingShipEquipLine(result, shipName = "Ship") {
  if (!result) return "";
  if (result.applied) return `${shipName} selected.`;
  if (result.mode === "dry_run" && result.ok) return `${shipName} is ready to select.`;
  if (result.blockReason === "ship_not_owned") return `${shipName} is not owned.`;
  if (result.blockReason === "ship_already_equipped") return `${shipName} already active.`;
  if (result.reason === "staging_loadout_dry_run_enabled") return "Ship selection is temporarily unavailable.";
  return `${shipName} could not be selected.`;
}

function renderStagingShipEquipNote(item) {
  const itemId = getStagingStoreItemId(item);
  if (!isMultiplayerStagingStoreActive() || !itemId || item?.kind !== "ship") return "";
  const result = getLastStagingShipEquipResult(itemId);
  if (!result) return "";
  const shipName = item?.name || result?.name || "Ship";
  const shipLine = result?.selectedShipBefore && result?.selectedShipAfter
    ? ` / Ship ${result.selectedShipBefore} -> ${result.selectedShipAfter}`
    : "";
  const capacityLine = result?.cargoCapacityBefore !== null && result?.cargoCapacityBefore !== undefined
    ? ` / Cargo ${formatNumber(result.cargoCapacityBefore)} -> ${formatNumber(result.cargoCapacityAfter ?? result.cargoCapacityAfterPreview)}`
    : "";
  return `
    <div class="store-detail-owned-line">
      <strong>${escapeHtml(getStagingShipEquipLine(result, shipName))}</strong>${escapeHtml(shipLine)}${escapeHtml(capacityLine)}
    </div>`;
}

async function requestStagingShipEquip(item) {
  const itemId = getStagingStoreItemId(item);
  if (!isMultiplayerStagingStoreActive() || !itemId || item?.kind !== "ship") return false;
  const shipName = item?.name || "Ship";
  const client = window.LupenMultiplayerClient;
  const status = client?.getStatus?.();
  if (!client?.equipStagingShip || !status?.enabled || !status?.isConnected) {
    if (typeof addHudToast === "function") addHudToast(`${shipName} cannot be selected while the fleet service is offline.`);
    return true;
  }
  if (multiplayerStagingShipEquipPending) return true;
  multiplayerStagingShipEquipPending = true;
  renderStore();
  client.equipStagingShip({ itemId });
  if (typeof addHudToast === "function") addHudToast(`Selecting ${shipName}.`);
  (async () => {
    const latest = await waitForMultiplayerStagingResult(
      () => client.getStatus?.().lastStagingLoadoutEquip,
      result => result?.itemId === itemId
    );
    multiplayerStagingShipEquipPending = false;
    if (latest?.itemId === itemId && latest.applied) {
      const selectedName = latest.name || shipName;
      const message = `${selectedName} selected: cargo ${formatNumber(latest.cargoCapacityBefore)} -> ${formatNumber(latest.cargoCapacityAfter)}.`;
      if (typeof addHudToast === "function") addHudToast(message);
      if (typeof addActivityLog === "function") addActivityLog(message);
      applyStagingLoadoutResultToLocalState(latest);
      reconcileMissionProgressAfterStagingLoadoutResult(latest);
      if (typeof syncMultiplayerPresence === "function") syncMultiplayerPresence("ship_selected");
    }
    renderStore();
    if (document.getElementById("hangarScreen")?.classList.contains("active")) renderHangar();
  })();
  return true;
}

async function requestStagingCargoPodEquip(item) {
  if (!isMultiplayerStagingStoreActive() || getStagingStoreItemId(item) !== "attachment:cargoPod") return false;
  const client = window.LupenMultiplayerClient;
  const status = client?.getStatus?.();
  if (!client?.equipStagingCargoPod || !status?.enabled || !status?.isConnected) {
    if (typeof addHudToast === "function") addHudToast("Cargo Pod cannot be equipped while the loadout service is offline.");
    return true;
  }
  if (multiplayerStagingCargoPodEquipPending) return true;
  multiplayerStagingCargoPodEquipPending = true;
  renderStore();
  client.equipStagingCargoPod({ itemId: "attachment:cargoPod" });
  if (typeof addHudToast === "function") addHudToast("Equipping Cargo Pod.");
  setTimeout(async () => {
    multiplayerStagingCargoPodEquipPending = false;
    const latest = client.getStatus?.().lastStagingLoadoutEquip;
    if (latest?.itemId === "attachment:cargoPod" && latest.applied) {
      const message = `Cargo Pod equipped: cargo ${formatNumber(latest.cargoCapacityBefore)} -> ${formatNumber(latest.cargoCapacityAfter)}.`;
      if (typeof addHudToast === "function") addHudToast(message);
      if (typeof addActivityLog === "function") addActivityLog(message);
      applyStagingLoadoutResultToLocalState(latest);
      reconcileMissionProgressAfterStagingLoadoutResult(latest);
      if (typeof syncMultiplayerPresence === "function") syncMultiplayerPresence("cargo_pod_equipped");
    }
    renderStore();
    if (document.getElementById("hangarScreen")?.classList.contains("active")) renderHangar();
  }, 900);
  return true;
}

async function requestStagingShieldBoosterEquip(item) {
  if (!isMultiplayerStagingStoreActive() || getStagingStoreItemId(item) !== "attachment:shieldBooster") return false;
  const client = window.LupenMultiplayerClient;
  const status = client?.getStatus?.();
  if (!client?.equipStagingShieldBooster || !status?.enabled || !status?.isConnected) {
    if (typeof addHudToast === "function") addHudToast("Shield Booster cannot be equipped while the loadout service is offline.");
    return true;
  }
  if (multiplayerStagingShieldBoosterEquipPending) return true;
  multiplayerStagingShieldBoosterEquipPending = true;
  renderStore();
  client.equipStagingShieldBooster({ itemId: "attachment:shieldBooster" });
  if (typeof addHudToast === "function") addHudToast("Equipping Shield Booster.");
  setTimeout(async () => {
    multiplayerStagingShieldBoosterEquipPending = false;
    const latest = client.getStatus?.().lastStagingLoadoutEquip;
    if (latest?.itemId === "attachment:shieldBooster" && latest.applied) {
      const message = `Shield Booster equipped: shield ${formatNumber(latest.shieldBefore)} -> ${formatNumber(latest.shieldAfter)}.`;
      if (typeof addHudToast === "function") addHudToast(message);
      if (typeof addActivityLog === "function") addActivityLog(message);
      applyStagingLoadoutResultToLocalState(latest);
      reconcileMissionProgressAfterStagingLoadoutResult(latest);
      if (typeof syncMultiplayerPresence === "function") syncMultiplayerPresence("shield_booster_equipped");
    }
    renderStore();
    if (document.getElementById("hangarScreen")?.classList.contains("active")) renderHangar();
  }, 900);
  return true;
}

async function requestStagingPulseLaserEquip(item) {
  return requestStagingLoadoutEquip(item);
}

async function requestStagingLoadoutEquip(item) {
  if (!isMultiplayerStagingStoreActive()) return false;
  const itemId = getStagingStoreItemId(item);
  if (!itemId || item?.kind === "core") return false;
  if (item.kind === "ship") return requestStagingShipEquip(item);
  const client = window.LupenMultiplayerClient;
  const status = client?.getStatus?.();
  if (!client?.equipStagingLoadoutItem || !status?.enabled || !status?.isConnected) {
    if (typeof addHudToast === "function") addHudToast("Equipment cannot be changed while the loadout service is offline.");
    return true;
  }
  if (multiplayerStagingLoadoutEquipPendingItemId) return true;
  const previousResultAt = Number(status.lastStagingLoadoutEquip?.receivedAt || 0);
  multiplayerStagingLoadoutEquipPendingItemId = itemId;
  if (itemId === "attachment:cargoPod") multiplayerStagingCargoPodEquipPending = true;
  if (itemId === "attachment:shieldBooster") multiplayerStagingShieldBoosterEquipPending = true;
  if (itemId === "gun:pulseLaser") multiplayerStagingPulseLaserEquipPending = true;
  selectedLoadoutStatusMessage = `Equipping ${item.name || "item"}...`;
  if (document.getElementById("hangarScreen")?.classList.contains("active")) renderHangar();
  else renderStore();
  client.equipStagingLoadoutItem({
    itemId,
    inventorySource: item.inventorySource || item.source || "owned",
    inventoryItemId: item.inventoryItemId || item.inventoryId || "",
    quality: item.quality || "standard",
    level: Math.max(1, Number(item.level || 1)),
    slotIndex: Number.isInteger(Number(item.slotIndex)) ? Number(item.slotIndex) : null
  });
  if (typeof addHudToast === "function") addHudToast(`Equipping ${item.name || "item"}.`);
  (async () => {
    const latest = await waitForMultiplayerStagingResult(
      () => client.getStatus?.().lastStagingLoadoutEquip,
      result => result?.itemId === itemId &&
        result?.operation !== "unequip" &&
        Number(result?.receivedAt || 0) > previousResultAt
    );
    multiplayerStagingLoadoutEquipPendingItemId = "";
    multiplayerStagingCargoPodEquipPending = false;
    multiplayerStagingShieldBoosterEquipPending = false;
    multiplayerStagingPulseLaserEquipPending = false;
    if (latest?.itemId === itemId && latest.applied) {
      const statChange = latest.cargoCapacityBefore !== null && latest.cargoCapacityBefore !== undefined
        ? ` Cargo ${formatNumber(latest.cargoCapacityBefore)} -> ${formatNumber(latest.cargoCapacityAfter)}.`
        : latest.shieldBefore !== null && latest.shieldBefore !== undefined
          ? ` Shield ${formatNumber(latest.shieldBefore)} -> ${formatNumber(latest.shieldAfter)}.`
          : "";
      const message = `${latest.name || item.name || "Item"} equipped.${statChange}`;
      selectedLoadoutStatusMessage = message;
      if (typeof addHudToast === "function") addHudToast(message);
      if (typeof addActivityLog === "function") addActivityLog(message);
      applyStagingLoadoutResultToLocalState(latest);
      reconcileMissionProgressAfterStagingLoadoutResult(latest);
      if (typeof syncMultiplayerPresence === "function") syncMultiplayerPresence("staging_loadout_equipped");
      tutorialEvent(itemId.startsWith("gun:") ? "equippedItem" : "equippedAttachment");
    } else if (latest?.itemId === itemId && recoverTutorialLoadoutEquipLocally(item, latest)) {
      // The Academy must remain playable if the staging write gate rejects an
      // otherwise valid tutorial fit. The player's own save is synchronized
      // by the narrow recovery path above.
    } else if (latest?.itemId === itemId) {
      const reason = latest.userReason || latest.blockReason || latest.reason || "loadout unavailable";
      selectedLoadoutStatusMessage = itemId === "gun:pulseLaser"
        ? getStagingPulseLaserEquipLine(latest)
        : itemId === "attachment:cargoPod"
          ? getStagingCargoPodEquipLine(latest)
          : itemId === "attachment:shieldBooster"
            ? getStagingShieldBoosterEquipLine(latest)
            : `${latest.name || item.name || "Item"} could not be equipped.`;
      if (typeof addHudToast === "function") addHudToast(selectedLoadoutStatusMessage);
      if (typeof addActivityLog === "function") addActivityLog(`Equipment change blocked: ${reason}`);
    } else {
      selectedLoadoutStatusMessage = "Equip request timed out. Please try again.";
      if (typeof addHudToast === "function") addHudToast(selectedLoadoutStatusMessage);
    }
    renderStore();
    if (document.getElementById("hangarScreen")?.classList.contains("active")) renderHangar();
  })();
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
    if (typeof addHudToast === "function") addHudToast("Purchases are unavailable while the store service is offline.");
    requestMultiplayerStagingStoreItemsIfNeeded();
    return true;
  }
  if (multiplayerStagingStorePurchasePending) return true;
  multiplayerStagingStorePurchasePending = true;
  multiplayerStagingStoreStatusMessage = "Purchase requested.";
  renderStore();
  const requestedAt = Date.now();
  multiplayerStagingStorePurchaseSequence += 1;
  const requestId = `store-${requestedAt}-${multiplayerStagingStorePurchaseSequence}`;
  client.purchaseStagingStoreItem({
    requestId,
    itemId,
    quantity: 1,
    currentNode: getMultiplayerStagingStoreNodeName(),
    presenceStatus: getMultiplayerStagingStorePresenceStatus()
  });
  if (typeof addHudToast === "function") addHudToast("Purchase requested.");
  (async () => {
    const latest = await waitForMultiplayerStagingResult(
      () => client.getStatus?.().lastStagingStorePurchase,
      result => result?.itemId === itemId && (
        result?.requestId === requestId ||
        (!result?.requestId && Number(result?.clientReceivedAt || result?.receivedAt || 0) >= requestedAt)
      )
    );
    multiplayerStagingStorePurchasePending = false;
    if (latest?.itemId === itemId && latest.applied) {
      applyStagingStorePurchaseResultToLocalState(latest);
      const spent = Number.isFinite(Number(latest.creditsBefore)) && Number.isFinite(Number(latest.creditsAfter))
        ? ` CR ${formatNumber(Math.max(0, Number(latest.creditsBefore) - Number(latest.creditsAfter)))} spent.`
        : "";
      const message = `${latest.name || "Store item"} purchased.${spent}`;
      multiplayerStagingStoreStatusMessage = message;
      if (typeof addHudToast === "function") addHudToast(message);
      if (typeof addActivityLog === "function") addActivityLog(message);
      if (typeof syncMultiplayerPresence === "function") syncMultiplayerPresence("staging_store_purchase");
    } else if (latest?.itemId === itemId) {
      const reason = latest.userReason || latest.blockReason || latest.reason || "Server purchase failed - try again.";
      multiplayerStagingStoreStatusMessage = `Purchase failed: ${reason}`;
      if (typeof addHudToast === "function") addHudToast(`Purchase blocked: ${reason}`);
      if (typeof addActivityLog === "function") addActivityLog(`Purchase blocked: ${reason}`);
      if (typeof console !== "undefined" && typeof console.warn === "function") {
        console.warn("[Lupen multiplayer] staging Store purchase blocked", {
          itemId,
          reason,
          blockReason: latest.blockReason || "",
          serverReason: latest.reason || "",
          currentNode: latest.currentNode || "",
          requestedNode: latest.requestedNode || "",
          presenceStatus: latest.presenceStatus || "",
          gates: latest.gates || null
        });
      }
    } else {
      const reason = "Server purchase failed - try again.";
      multiplayerStagingStoreStatusMessage = `Purchase failed: ${reason}`;
      if (typeof addHudToast === "function") addHudToast(reason);
      if (typeof addActivityLog === "function") addActivityLog(`Purchase failed: ${itemId}.`);
      if (typeof console !== "undefined" && typeof console.warn === "function") {
        console.warn("[Lupen multiplayer] staging Store purchase timed out", { itemId });
      }
    }
    renderStore();
    if (document.getElementById("hangarScreen")?.classList.contains("active")) renderHangar();
  })();
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
    if (typeof addHudToast === "function") addHudToast("Purchase information is unavailable while the store service is offline.");
    requestMultiplayerStagingStoreItemsIfNeeded();
    return true;
  }
  client.previewStagingStorePurchase({
    itemId,
    quantity: 1,
    currentNode: getMultiplayerStagingStoreNodeName(),
    presenceStatus: getMultiplayerStagingStorePresenceStatus()
  });
  if (typeof addHudToast === "function") addHudToast("Checking purchase availability.");
  return true;
}
