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

function getExchangeShips() {
  const plannedOrder = Object.values(SHIP_LINES || {}).flatMap(line => line.shipIds || []);
  const plannedShips = plannedOrder.map(shipId => SHIPS[shipId]).filter(Boolean);
  const unplannedShips = Object.values(SHIPS).filter(ship => !ship.lineId && !ship.hiddenFromExchange);
  return [...plannedShips, ...unplannedShips].filter(ship =>
    !ship.hiddenFromExchange && (!ship.lineId || isShipLineUnlocked(ship.lineId))
  );
}

function getShipyardSelectedShip() {
  const visibleShips = getFilteredExchangeShips();
  if (!visibleShips.some(ship => ship.id === selectedShipyardShipId)) {
    selectedShipyardShipId = visibleShips[0]?.id || "";
  }
  return visibleShips.find(ship => ship.id === selectedShipyardShipId) || null;
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

function getVesselExchangeClassLabel(ship = {}) {
  const raw = String(ship.roleSubtitle || ship.role || "Available Hull").trim();
  const labels = {
    "Starter Fighter / Interceptor": "Starter Fighter",
    "Ancient-Tech Endgame Ship": "Ancient-Tech"
  };
  return labels[raw] || raw.replace(/\s+hull$/i, "");
}

function getShipyardClassMark(ship = {}) {
  const label = getShipyardClassLabel(ship);
  return label.split(/\s+/).map(part => part[0]).join("").slice(0, 2) || "HX";
}

function setShipyardFilter(filter = "all") {
  selectedShipyardFilter = "unowned";
  const visibleShips = getFilteredExchangeShips();
  if (visibleShips.length && !visibleShips.some(ship => ship.id === selectedShipyardShipId)) {
    selectedShipyardShipId = visibleShips[0].id;
  }
  renderShipShop();
}

function getFilteredExchangeShips() {
  const purchasableShips = getExchangeShips().filter(ship => !ownedShips.includes(ship.id));
  return filterVesselsByLine(purchasableShips, selectedShipyardLineId);
}

function updateShipyardFilterButtons() {
  [
    ["shipyardFilterAll", "all"],
    ["shipyardFilterOwned", "owned"],
    ["shipyardFilterUnowned", "unowned"]
  ].forEach(([id, filter]) => {
    const button = document.getElementById(id);
    if (button) button.classList.toggle("active", selectedShipyardFilter === filter);
  });
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
  const visibleCount = Math.min(safeCount, 20);
  if (!visibleCount) return `<span class="exchange-slot-pip empty"></span>`;
  return Array.from({ length: visibleCount }).map(() => `<span class="exchange-slot-pip filled"></span>`).join("");
}

function renderExchangeHardpointRail(shipId, mode = "capacity") {
  const guns = getGunSlotLimit(shipId);
  const equip = getAttachmentSlotLimit(shipId);
  const gunsEquipped = mode === "usage" ? countEquippedGuns(shipId) : guns;
  const equipEquipped = mode === "usage" ? countEquippedAttachments(shipId) : equip;
  return `
    <div class="exchange-capacity-card weapon-capacity">
      <div class="exchange-slot-summary-head">
        <span>Weapon Slots</span>
        <strong>${mode === "usage" ? `${gunsEquipped} / ${guns}` : guns}</strong>
      </div>
      <div class="exchange-slot-pips">
        ${renderSlotPips(guns, gunsEquipped)}
      </div>
    </div>
    <div class="exchange-capacity-card equip-capacity">
      <div class="exchange-slot-summary-head">
        <span>Equipment Slots</span>
        <strong>${mode === "usage" ? `${equipEquipped} / ${equip}` : equip}</strong>
      </div>
      <div class="exchange-slot-pips">
        ${renderSlotPips(equip, equipEquipped)}
      </div>
    </div>
  `;
}

function getExchangeRequirementLabel(key) {
  if (key === "combatLevel") return "Combat Level";
  if (key === "erebusBotsDestroyed") return "Erebus Bots Destroyed";
  if (key === "totalTradingProfit") return "Trading Profit";
  if (key === "bountiesClaimed") return "Bounties Completed";
  return String(key || "Requirement").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, letter => letter.toUpperCase());
}

function formatExchangeRequirementValue(key, value) {
  const safeValue = Math.max(0, Math.round(Number(value || 0)));
  return key === "totalTradingProfit" ? `CR ${formatNumber(safeValue)}` : formatNumber(safeValue);
}

function renderExchangeRequirementRows(unlock) {
  const progress = Array.isArray(unlock?.progress) ? unlock.progress : [];
  if (!progress.length) return "";

  return `
    <section class="exchange-detail-section exchange-unlock-section ${unlock.locked ? "locked" : "met"}">
      <div class="exchange-section-heading">
        <span>Unlock Requirements</span>
        <strong>${unlock.locked ? "Locked" : "Met"}</strong>
      </div>
      <div class="exchange-requirement-rows">
        ${progress.map(item => `
          <div class="exchange-requirement-row ${item.met ? "met" : "missing"}">
            <span>${escapeHtml(getExchangeRequirementLabel(item.key))}</span>
            <strong>${escapeHtml(formatExchangeRequirementValue(item.key, Math.min(item.current, item.required)))} / ${escapeHtml(formatExchangeRequirementValue(item.key, item.required))}</strong>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderExchangeShipStatsSection(shipId, stats, options = {}) {
  const hullValue = options.hullValue || formatNumber(stats.hull);
  const slotsMode = options.slotsMode || "capacity";
  return `
    <section class="exchange-detail-section exchange-stat-section">
      <div class="exchange-section-heading">
        <span>Ship Stats</span>
      </div>
      <div class="exchange-detail-stat-grid">
        ${renderFleetStatChip("Hull", hullValue, "hull-stat")}
        ${renderFleetStatChip("Shield", formatNumber(stats.shield), "shield-stat")}
        ${renderFleetStatChip("Armor", formatNumber(stats.armor), "armor-stat")}
        ${renderFleetStatChip("Cargo", formatNumber(stats.cargo), "cargo-stat")}
        ${renderFleetStatChip("Jump", formatNumber(stats.jumpRecharge), "jump-stat")}
        ${renderFleetStatChip("Evasion", formatEvasion(stats.evasion), "evasion-stat")}
      </div>
      <div class="exchange-detail-loadout">
        ${renderExchangeHardpointRail(shipId, slotsMode)}
      </div>
    </section>
  `;
}

function renderShipyardDetail() {
  const panel = document.getElementById("shipyardDetailPanel");
  if (!panel) return;

  const ship = getShipyardSelectedShip();
  if (!ship) {
    const lineLabel = selectedShipyardLineId === "all" ? "the current catalogue" : getVesselLineLabel(selectedShipyardLineId);
    const status = document.getElementById("shipyardDetailStatus");
    if (status) status.textContent = "No hulls available";
    panel.innerHTML = `
      <div class="exchange-empty-workspace">
        <span>CATALOGUE COMPLETE</span>
        <strong>No hulls available</strong>
        <p>Every purchaseable vessel in ${escapeHtml(lineLabel)} is already in your fleet.</p>
        <button type="button" onclick="showHangarSection('owned')">View Fleet</button>
      </div>
    `;
    return;
  }
  const owned = ownedShips.includes(ship.id);
  const equipped = currentShipId === ship.id;
  const canAfford = credits >= ship.price;
  const stats = getShipStats(ship.id);
  const unlock = getShipUnlockStatus(ship.id);
  const starterShipId = typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
  const starterClaim = !hasActiveShip() && ship.id === starterShipId;
  const status = document.getElementById("shipyardDetailStatus");
  if (status) status.textContent = unlock.state === "locked" ? "Locked" : equipped ? "Active" : owned ? "Owned" : "Available";

  let primaryAction = "";
  let secondaryAction = "";
  if (equipped) {
    primaryAction = `<button class="exchange-footer-secondary" disabled>Active</button>`;
    secondaryAction = `<button class="exchange-footer-primary" onclick="showHangarSection('overview');">Open Loadout</button>`;
  } else if (owned) {
    primaryAction = `<button class="exchange-footer-secondary" disabled>Owned</button>`;
    secondaryAction = `<button class="exchange-footer-primary set-active-ship-action" ${ship.id === starterShipId ? "data-tutorial-target=\"firstShipBuy\"" : ""} onclick="equipShip('${ship.id}'); showHangarSection('shipyard');">Set Active</button>`;
  } else if (unlock.locked) {
    primaryAction = `<button class="exchange-footer-primary buy-ship-action locked-action" data-tutorial-target="firstShipBuy" onclick="buyShip('${ship.id}')">Locked</button>`;
    secondaryAction = `<button class="exchange-footer-secondary shipyard-price-action" disabled>CR ${formatNumber(ship.price)}</button>`;
  } else {
    primaryAction = `<button class="exchange-footer-primary buy-ship-action" data-tutorial-target="firstShipBuy" onclick="buyShip('${ship.id}')" ${!canAfford && !starterClaim ? "disabled" : ""}>${starterClaim ? "Claim Starter Ship" : "Buy Hull"}</button>`;
    secondaryAction = `<button class="exchange-footer-secondary shipyard-price-action" disabled>${starterClaim ? "Free Starter Hull" : `CR ${formatNumber(ship.price)}`}</button>`;
  }

  const requirementHtml = renderExchangeRequirementRows(unlock);
  const statusLabel = unlock.state === "locked" ? "Locked" : equipped ? "Active" : owned ? "Owned" : "Available";
  const statusMessage = unlock.state === "locked"
    ? "Recover the required plan progress before purchase."
    : equipped
      ? "This vessel is currently active."
      : owned
        ? "Owned and ready to become your active vessel."
        : starterClaim
          ? "Your first hull is ready to claim."
          : `Available for CR ${formatNumber(ship.price)}.`;
  const purchaseSummaryLabel = !owned && unlock.state !== "locked" ? "Purchase Price" : "Hull Status";
  const purchaseSummaryValue = !owned && unlock.state !== "locked"
    ? (starterClaim ? "FREE" : `CR ${formatNumber(ship.price)}`)
    : statusLabel;

  panel.innerHTML = `
    <div class="exchange-selected-vessel ${unlock.locked ? "is-locked" : "is-open"}" data-ship-id="${escapeHtml(ship.id)}">
      <section class="exchange-detail-preview">
        <div class="exchange-selected-identity">
          <span>${equipped ? "Active Vessel" : owned ? "Owned Vessel" : "Selected Hull"}</span>
          <h4>${escapeHtml(ship.name)}</h4>
          <p>${getVesselExchangeClassLabel(ship)}</p>
        </div>
        <div class="exchange-detail-status-chip ${unlock.state}">${statusLabel}</div>
        <div class="exchange-selected-presentation">
          <div class="exchange-detail-glow"></div>
          <div class="exchange-hero-ring"></div>
          <img src="${typeof getShipAsset === "function" ? getShipAsset(ship.id, "large") : ship.image}" alt="${ship.name}">
        </div>
      </section>
      ${requirementHtml}

      ${renderExchangeShipStatsSection(ship.id, stats)}

      <footer class="exchange-purchase-bar">
        <div class="exchange-purchase-summary">
          <span>${purchaseSummaryLabel}</span>
          <strong class="${!owned && unlock.state !== "locked" ? "is-purchase-price" : ""}">${purchaseSummaryValue}</strong>
          <small>${statusMessage}</small>
        </div>
        <div class="exchange-detail-footer">
          ${primaryAction}
          ${secondaryAction}
        </div>
      </footer>
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
  renderVesselLineFilter("shipyardLineFilter", selectedShipyardLineId, "setShipyardLineFilter", getExchangeShips());

  box.innerHTML = "";

  const visibleShips = getFilteredExchangeShips();
  if (!visibleShips.length) {
    box.innerHTML = `
      <div class="vessel-empty-state">
        <strong>No hulls available</strong>
        <span>Owned vessels have moved to your Fleet.</span>
      </div>
    `;
    renderShipyardDetail();
    return;
  }

  if (!visibleShips.some(ship => ship.id === selectedShipyardShipId)) {
    selectedShipyardShipId = visibleShips[0].id;
  }

  visibleShips.forEach(ship => {
    const selected = selectedShipyardShipId === ship.id;
    const unlock = getShipUnlockStatus(ship.id);

    const card = createVesselCatalogueCard(ship, { mode: "exchange", selected, active: false, unlock });
    const starterShipId = typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
    const isTutorialRequiredShip = tutorialState?.active && getCurrentTutorialStep()?.id === "buy-first-ship" && ship.id === starterShipId;
    card.classList.toggle("challenge-complete", unlock.state === "available");
    card.classList.toggle("tutorial-required-ship", isTutorialRequiredShip);
    if (ship.id === starterShipId) card.dataset.tutorialTarget = "firstShipCard";
    card.onclick = () => selectShipyardShip(ship.id);
    box.appendChild(card);
  });

  renderShipyardDetail();
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

function buyShip(shipId, storeItemOverride = null) {
  const ship = SHIPS[shipId];
  if (!ship) return;

  ownedShips = Array.isArray(ownedShips) ? ownedShips : [];
  shipLoadouts = shipLoadouts && typeof shipLoadouts === "object" ? shipLoadouts : {};
  shipConditions = shipConditions && typeof shipConditions === "object" ? shipConditions : {};

  const hadNoShip = !hasActiveShip();
  const starterShipId = typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
  const starterClaim = hadNoShip && shipId === starterShipId;
  const storeItem = storeItemOverride?.kind === "ship" && storeItemOverride.key === shipId
    ? storeItemOverride
    : getStoreCatalogItem("ship", shipId);

  if (isMultiplayerStagingStoreActive() && !starterClaim) {
    if (ship && !ship.hiddenFromExchange && !ownedShips.includes(shipId) && getStagingStoreItemId({ kind: "ship", key: shipId })) {
      requestStagingStorePurchase({ kind: "ship", key: shipId });
      return;
    }
  }
  if (!starterClaim && blockStoreMutationInMultiplayerStaging()) return;

  if (ownedShips.includes(shipId)) {
    if (starterClaim) {
      shipLoadouts[shipId] = normalizeShipLoadout(shipLoadouts[shipId] || { attachments: [], guns: [] }, shipId);
      currentShipId = shipId;
      selectedHangarShipId = shipId;
      selectedFleetShipId = shipId;
      selectedShipyardShipId = shipId;
      ensureShipCondition(shipId);
      applyShipStats(true);
      if (typeof recordMissionEvent === "function") recordMissionEvent("starter_ship_claimed", { shipId, mode: "activate" });
      tutorialEvent("boughtFirstShip");
      saveGame();
    }
    return;
  }

  const purchaseCheck = starterClaim
    ? { ok: true, price: 0 }
    : canPurchaseStoreItem(storeItem || { kind: "ship", key: shipId, basePrice: ship.price });
  if (!purchaseCheck.ok) {
    notifyStorePurchaseBlocked(purchaseCheck);
    renderShipShop();
    return;
  }

  const unlock = getShipUnlockStatus(shipId);
  if (unlock.locked) {
    if (typeof addHudToast === "function") addHudToast(unlock.message);
    else alert(unlock.message);
    renderShipShop();
    return;
  }

  credits -= purchaseCheck.price;
  ownedShips.push(shipId);
  if (!starterClaim && storeItem) recordStorePurchase(storeItem);
  selectedHangarShipId = shipId;
  selectedFleetShipId = shipId;
  selectedShipyardShipId = shipId;
  shipLoadouts[shipId] = normalizeShipLoadout({ attachments: [], guns: [] }, shipId);
  shipConditions[shipId] = normalizeShipCondition(shipId);

  if (hadNoShip) {
    currentShipId = shipId;
    if (starterClaim) initializeStarterShipEmptyLoadout();
    applyShipStats(true);
  }

  if (starterClaim && typeof recordMissionEvent === "function") {
    recordMissionEvent("starter_ship_claimed", { shipId, mode: "claim" });
  } else if (!starterClaim && typeof recordMissionEvent === "function" && ship.lineId === PIONEER_LINE_ID) {
    recordMissionEvent("purchase_pioneer_hull", { shipId, lineId: ship.lineId, source: "vessel_exchange" });
  }

  renderHangar();
  showHangarSection("shipyard");
  addHudToast(`${ship.name} added to your hangar.`);
  tutorialEvent(hadNoShip ? "boughtFirstShip" : "boughtShip");
  saveGame();
}
