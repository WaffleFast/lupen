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

const MAP_ONE_STORE_GUN_KEYS = Object.freeze(["pulseLaser", "ionBlaster", "heavyLance"]);
const MAP_ONE_STORE_ATTACHMENT_KEYS = Object.freeze(["cargoPod", "jumpDrive"]);

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
let selectedVaultActionContext = null;
let selectedLoadoutItemContext = null;
let selectedLoadoutStatusMessage = "";
let selectedLoadoutSlotCategory = "guns";
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

function waitForMultiplayerStagingResult(getResult, predicate, timeoutMs = 2200) {
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
      reconcileMissionProgressAfterStagingLoadoutResult(latest);
      if (typeof loadGameFromSupabase === "function") {
        try {
          const loaded = await loadGameFromSupabase();
          if (loaded?.loaded) {
            reconcileMissionProgressAfterStagingLoadoutResult(latest);
            if (typeof syncMultiplayerPresence === "function") syncMultiplayerPresence("ship_selected");
            if (typeof addHudToast === "function") addHudToast("Save refreshed from server.");
          }
        } catch (_err) {
          if (typeof addHudToast === "function") addHudToast(`${selectedName} selected. Reload if ship values look stale.`);
        }
      }
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
      reconcileMissionProgressAfterStagingLoadoutResult(latest);
      if (typeof loadGameFromSupabase === "function") {
        try {
          const loaded = await loadGameFromSupabase();
          if (loaded?.loaded) {
            reconcileMissionProgressAfterStagingLoadoutResult(latest);
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
      reconcileMissionProgressAfterStagingLoadoutResult(latest);
      if (typeof loadGameFromSupabase === "function") {
        try {
          const loaded = await loadGameFromSupabase();
          if (loaded?.loaded) {
            reconcileMissionProgressAfterStagingLoadoutResult(latest);
            if (typeof syncMultiplayerPresence === "function") syncMultiplayerPresence("shield_booster_equipped");
            if (typeof addHudToast === "function") addHudToast("Save refreshed from server.");
          }
        } catch (_err) {
          if (typeof addHudToast === "function") addHudToast("Shield Booster equipped. Reload if shield values look stale.");
        }
      }
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
  multiplayerStagingLoadoutEquipPendingItemId = itemId;
  if (itemId === "attachment:cargoPod") multiplayerStagingCargoPodEquipPending = true;
  if (itemId === "attachment:shieldBooster") multiplayerStagingShieldBoosterEquipPending = true;
  if (itemId === "gun:pulseLaser") multiplayerStagingPulseLaserEquipPending = true;
  renderStore();
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
      result => result?.itemId === itemId && result?.operation !== "unequip"
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
      if (typeof addHudToast === "function") addHudToast(message);
      if (typeof addActivityLog === "function") addActivityLog(message);
      reconcileMissionProgressAfterStagingLoadoutResult(latest);
      if (typeof loadGameFromSupabase === "function") {
        try {
          const loaded = await loadGameFromSupabase();
          if (loaded?.loaded) {
            reconcileMissionProgressAfterStagingLoadoutResult(latest);
            if (typeof syncMultiplayerPresence === "function") syncMultiplayerPresence("staging_loadout_equipped");
            if (typeof addHudToast === "function") addHudToast("Save refreshed from server.");
          }
        } catch (_err) {
          if (typeof addHudToast === "function") addHudToast("Item equipped. Reload if loadout values look stale.");
        }
      }
    } else if (latest?.itemId === itemId) {
      const reason = latest.userReason || latest.blockReason || latest.reason || "loadout unavailable";
      if (typeof addHudToast === "function") addHudToast(`Equip blocked: ${reason}`);
      if (typeof addActivityLog === "function") addActivityLog(`Equipment change blocked: ${reason}`);
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
  client.purchaseStagingStoreItem({
    itemId,
    quantity: 1,
    currentNode: getMultiplayerStagingStoreNodeName(),
    presenceStatus: getMultiplayerStagingStorePresenceStatus()
  });
  if (typeof addHudToast === "function") addHudToast("Purchase requested.");
  (async () => {
    const latest = await waitForMultiplayerStagingResult(
      () => client.getStatus?.().lastStagingStorePurchase,
      result => result?.itemId === itemId && Number(result?.receivedAt || 0) >= requestedAt
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

const HANGAR_LEVEL_TIERS = Object.freeze({
  1: Object.freeze({ key: "common", label: "Common" }),
  2: Object.freeze({ key: "refined", label: "Refined" }),
  3: Object.freeze({ key: "unique", label: "Unique" }),
  4: Object.freeze({ key: "elite", label: "Elite" }),
  5: Object.freeze({ key: "super", label: "Super" })
});

function getHangarEquipmentTier(level = 1) {
  const safeLevel = Math.max(1, Math.min(5, Math.floor(Number(level || 1))));
  if (typeof getForgeLevelTier === "function") return getForgeLevelTier(safeLevel);
  return HANGAR_LEVEL_TIERS[safeLevel] || HANGAR_LEVEL_TIERS[1];
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
    const tierClass = entry.stackable ? "" : `forge-tier-scope ${getHangarEquipmentTierClass(level)}`;
    button.className = `vault-storage-card ${selected ? "selected" : ""} ${entry.stackable ? "resource-entry" : "gear-entry"} quality-${entry.quality} ${tierClass}`;
    button.setAttribute("aria-pressed", selected ? "true" : "false");
    button.setAttribute("aria-label", `${entry.name}, ${getVaultQualityLabel(entry)}, Level ${formatRomanLevel(level)}, ${entry.storedCount || 0} stored, ${entry.equippedCount || 0} equipped`);
    if (!entry.stackable) {
      button.dataset.level = String(level);
      button.dataset.tier = tier.key;
    }
    button.onclick = () => selectVaultItem(entry.groupKey);
    button.removeAttribute("title");
    showHangarTooltip(button, getVaultTooltipHtml(entry));
    bindHangarEquipmentTooltip(button);

    button.innerHTML = `
      <div class="vault-storage-art quality-${entry.quality}">
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
  const tierClass = entry.stackable ? "" : `forge-tier-scope ${getHangarEquipmentTierClass(level)}`;
  const locations = getVaultEntryEquippedLocations(entry);
  const locationSummary = locations.length
    ? `${locations[0].shipName} · ${locations[0].slotLabel}${locations.length > 1 ? ` · +${locations.length - 1} more` : ""}`
    : "Not currently equipped";

  panel.innerHTML = `
    <div class="vault-item-detail-shell ${entry.stackable ? "resource-detail" : "gear-detail"} quality-${entry.quality} ${tierClass}" ${entry.stackable ? "" : `data-level="${escapeHtml(level)}" data-tier="${escapeHtml(tier.key)}"`}>
      <div class="vault-item-preview">
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
          <span class="hangar-tier-detail-badge" aria-label="${escapeHtml(tier.label)} tier, Level ${escapeHtml(formatRomanLevel(level))}">
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
      reconcileMissionProgressAfterStagingLoadoutResult(latest);
      if (typeof loadGameFromSupabase === "function") {
        try {
          const loaded = await loadGameFromSupabase();
          if (loaded?.loaded) {
            reconcileMissionProgressAfterStagingLoadoutResult(latest);
            if (typeof syncMultiplayerPresence === "function") syncMultiplayerPresence("staging_loadout_unequipped");
            if (typeof addHudToast === "function") addHudToast("Save refreshed from server.");
          }
        } catch (_err) {
          if (typeof addHudToast === "function") addHudToast(`${latest.name || entry.name} unequipped. Reload if loadout values look stale.`);
        }
      }
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
      </div>
    `;
    updateLoadoutVaultChrome();
    return;
  }

  const tier = getHangarEquipmentTier(currentDetail.level);
  panel.innerHTML = `
    <div class="loadout-selected-item-card quality-${escapeHtml(currentDetail.quality)} forge-tier-scope ${getHangarEquipmentTierClass(currentDetail.level)}">
      <div class="loadout-selected-item-art">
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

/* Hangar */

function renderHangar() {
  if (!ownedShips.includes(selectedHangarShipId)) {
    selectedHangarShipId = currentShipId || (typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon");
  }

  ensureInventoryObjects();
  renderHangarOverview();
  renderOwnedShips();
  renderHangarVault();
  renderShipShop();
  renderShipPlans();

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
  const repairState = getEffectiveRepairHullState();
  const missingHull = repairState.missingHull;
  const repairCost = getRepairCost();
  const repairDisabled = missingHull <= 0 || credits < repairCost;

  const overviewName = document.getElementById("overviewShipName");
  const overviewRole = document.getElementById("overviewShipRole");
  const overviewImage = document.getElementById("overviewShipImage");
  const overviewNameplate = document.getElementById("overviewNameplate");
  const overviewStats = document.getElementById("overviewStats");
  const overviewRepair = document.getElementById("overviewRepairPanel");
  const subtitle = document.getElementById("hangarShipSubtitle");

  const title = document.getElementById("hangarShipTitle");
  if (title) title.textContent = "Loadout";
  if (subtitle) subtitle.textContent = `${ship.name} · ${getShipRole(currentShipId)}`;

  if (overviewName) overviewName.textContent = ship.name;
  if (overviewRole) overviewRole.textContent = getShipRole(currentShipId);
  if (overviewImage) {
    overviewImage.src = typeof getShipAsset === "function" ? getShipAsset(ship.id, "master") : ship.image;
    overviewImage.alt = ship.name;
  }
  if (overviewNameplate) overviewNameplate.textContent = ship.name;

  if (overviewStats) {
    const hullPercent = repairState.hullMax > 0 ? Math.max(0, Math.min(100, (repairState.hull / repairState.hullMax) * 100)) : 0;
    overviewStats.innerHTML = `
      <div class="hangar-stat-card hull-stat featured-stat" data-stat="hull"><span>Hull</span><strong>${formatNumber(Math.floor(repairState.hull))} / ${formatNumber(repairState.hullMax)}</strong><i style="--hull-fill:${hullPercent}%"></i></div>
      <div class="hangar-stat-card shield-stat" data-stat="shield"><span>Shield</span><strong>${formatNumber(stats.shield)}</strong></div>
      <div class="hangar-stat-card armor-stat" data-stat="armor"><span>Armor</span><strong>${formatNumber(stats.armor)}</strong></div>
      <div class="hangar-stat-card cargo-stat" data-stat="cargo"><span>Cargo</span><strong>${formatNumber(stats.cargo)}</strong></div>
      <div class="hangar-stat-card jump-stat" data-stat="jump"><span>Jump</span><strong>${formatNumber(stats.jumpRecharge)} LY</strong></div>
      <div class="hangar-stat-card evasion-stat" data-stat="evasion"><span>Evasion</span><strong>${formatEvasion(stats.evasion)}</strong></div>
    `;
  }

  if (overviewRepair) {
    overviewRepair.innerHTML = missingHull > 0
      ? `
        <div class="repair-hero-card needs-repair unique-repair-card compact-repair-card prestige-repair-strip">
          <div>
            <span>Hull Service</span>
            <strong>${formatNumber(Math.floor(repairState.hull))} / ${formatNumber(repairState.hullMax)} hull · CR ${formatNumber(repairCost)}${repairState.source === "pvp" ? " · PvP" : ""}</strong>
          </div>
          <button onclick="repairCurrentShip()" ${repairDisabled ? "disabled" : ""}>Repair Hull</button>
        </div>
      `
      : `<div class="loadout-repair-ready" role="status"><span aria-hidden="true">✓</span> Hull fully repaired</div>`;
  }

  renderInstalledGuns();
  renderInstalledAttachments();
  renderGunInventory();
  renderAttachmentInventory();
  renderLoadoutItemDetail();
}


function selectFleetShip(shipId) {
  if (!ownedShips.includes(shipId)) return;
  selectedFleetShipId = shipId;
  selectedHangarShipId = shipId;
  renderOwnedShips();
}

function renderFleetStatChip(label, value, statClass = "") {
  const statKey = String(label || "").toLowerCase() === "armour"
    ? "armor"
    : String(label || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `<div class="fleet-stat-chip ${statClass}" data-stat="${statKey}"><span>${label}</span><strong>${value}</strong></div>`;
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
  return `Guns ${countEquippedGuns(shipId)}/${getGunSlotLimit(shipId)} / Equip ${countEquippedAttachments(shipId)}/${getAttachmentSlotLimit(shipId)}`;
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
  const gunFilled = mode === "usage" ? countEquippedGuns(shipId) : guns;
  const equipFilled = mode === "usage" ? countEquippedAttachments(shipId) : equip;

  return `
    <div class="ship-slot-summary" aria-label="${escapeHtml(formatSlotCapacityText(shipId))}">
      <div class="ship-slot-bank gun-bank">
        <span>Guns</span>
        <strong>${mode === "usage" ? `${gunFilled}/${guns}` : guns}</strong>
        <div class="ship-slot-pips">${renderSlotPips(guns, gunFilled)}</div>
      </div>
      <div class="ship-slot-bank equip-bank">
        <span>Equip</span>
        <strong>${mode === "usage" ? `${equipFilled}/${equip}` : equip}</strong>
        <div class="ship-slot-pips">${renderSlotPips(equip, equipFilled)}</div>
      </div>
    </div>
  `;
}

function getVesselLineId(ship = {}) {
  return ship.lineId || "independent";
}

function getVesselLineLabel(lineId) {
  if (lineId === "independent") return "Independent Hulls";
  return SHIP_LINES?.[lineId]?.name || String(lineId || "Unknown Line");
}

function filterVesselsByLine(ships = [], lineId = "all") {
  return lineId === "all" ? ships : ships.filter(ship => getVesselLineId(ship) === lineId);
}

function renderVesselLineFilter(containerId, selectedLineId, changeHandler, ships = []) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const lineIds = Array.from(new Set(ships.map(getVesselLineId)));
  const validSelection = selectedLineId === "all" || lineIds.includes(selectedLineId) ? selectedLineId : "all";
  container.innerHTML = `
    <label>
      <span>Ship Line</span>
      <select aria-label="Filter vessels by ship line" onchange="${changeHandler}(this.value)">
        <option value="all" ${validSelection === "all" ? "selected" : ""}>All Ship Lines</option>
        ${lineIds.map(lineId => `<option value="${escapeHtml(lineId)}" ${validSelection === lineId ? "selected" : ""}>${escapeHtml(getVesselLineLabel(lineId))}</option>`).join("")}
      </select>
    </label>
  `;
}

function setFleetLineFilter(lineId = "all") {
  selectedFleetLineId = lineId === "all" || SHIP_LINES?.[lineId] || lineId === "independent" ? lineId : "all";
  renderOwnedShips();
}

function setShipyardLineFilter(lineId = "all") {
  selectedShipyardLineId = lineId === "all" || SHIP_LINES?.[lineId] || lineId === "independent" ? lineId : "all";
  const visibleShips = getFilteredExchangeShips();
  selectedShipyardShipId = visibleShips.some(ship => ship.id === selectedShipyardShipId)
    ? selectedShipyardShipId
    : (visibleShips[0]?.id || "");
  renderShipShop();
}

function createVesselCatalogueCard(ship, { mode = "fleet", selected = false, active = false, unlock = null } = {}) {
  const isExchange = mode === "exchange";
  const card = document.createElement("button");
  const statusLabel = active
    ? "Active"
    : isExchange
      ? (unlock?.locked ? "Locked" : ship.price ? `CR ${formatNumber(ship.price)}` : "Available")
      : "Owned";
  const supportingLabel = active
    ? "Current vessel"
    : isExchange
      ? (unlock?.locked ? unlock.requirementLines?.[0] || "Plan requirements incomplete" : "Available to purchase")
      : getVesselExchangeClassLabel(ship);

  card.className = `fleet-ship-card fleet-selector-card vessel-exchange-card exchange-vessel-card unified-vessel-card ${mode === "fleet" ? "fleet-roster-card owned" : ""} ${selected ? "selected" : ""} ${active ? "active" : ""} ${unlock?.locked ? "progression-locked" : ""}`;
  card.dataset.shipId = ship.id;
  card.setAttribute("aria-pressed", selected ? "true" : "false");
  card.setAttribute("aria-label", `${ship.name}, ${getVesselExchangeClassLabel(ship)}, ${statusLabel}`);
  card.innerHTML = `
    <div class="fleet-card-badge">${escapeHtml(statusLabel)}</div>
    <div class="fleet-card-image-wrap fleet-roster-image">
      <img src="${typeof getShipAsset === "function" ? getShipAsset(ship.id, "medium") : ship.image}" alt="${escapeHtml(ship.name)}">
    </div>
    <div class="fleet-card-role">${escapeHtml(ship.className || "Vessel")}</div>
    <div class="fleet-card-name">${escapeHtml(ship.name)}</div>
    <div class="vessel-card-description">${escapeHtml(supportingLabel)}</div>
  `;
  return card;
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
  const fleetCountLabel = document.getElementById("fleetCountLabel");
  if (fleetCountLabel) fleetCountLabel.textContent = ownedShips.length === 1 ? "vessel owned" : "vessels owned";

  box.innerHTML = "";

  const ownedVessels = ownedShips.map(shipId => SHIPS[shipId]).filter(Boolean);
  renderVesselLineFilter("fleetLineFilter", selectedFleetLineId, "setFleetLineFilter", ownedVessels);
  const visibleVessels = filterVesselsByLine(ownedVessels, selectedFleetLineId);

  if (!visibleVessels.some(ship => ship.id === selectedFleetShipId)) {
    selectedFleetShipId = visibleVessels.find(ship => ship.id === currentShipId)?.id || visibleVessels[0]?.id || "";
  }

  if (!visibleVessels.length) {
    box.innerHTML = `<div class="vessel-empty-state"><strong>No owned hulls</strong><span>No vessels from this ship line are in your fleet.</span></div>`;
    renderFleetDetail();
    return;
  }

  visibleVessels.forEach(ship => {
    const shipId = ship.id;

    const isEquipped = currentShipId === shipId;
    const isSelected = selectedFleetShipId === shipId;

    const card = createVesselCatalogueCard(ship, { mode: "fleet", selected: isSelected, active: isEquipped });
    card.onclick = () => selectFleetShip(shipId);

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
  const isEquipped = currentShipId === shipId;
  const status = document.getElementById("fleetDetailStatus");
  if (status) status.textContent = isEquipped ? "Active" : "Owned";

  const hullState = isEquipped
    ? getEffectiveRepairHullState()
    : { hull: stats.hull, hullMax: stats.hullMax || stats.hull, missingHull: 0, source: "stored" };
  const repairCost = isEquipped ? getRepairCost() : 0;
  const hullPercent = hullState.hullMax > 0
    ? Math.max(0, Math.min(100, (hullState.hull / hullState.hullMax) * 100))
    : 0;
  const needsRepair = isEquipped && hullState.missingHull > 0;
  const repairDisabled = !needsRepair || credits < repairCost;
  const statusLabel = isEquipped ? "Active" : "Owned";
  const statusMessage = isEquipped ? "Vessel is ready for deployment." : "Ready to become your active vessel.";
  const conditionLabel = needsRepair ? `${Math.round(hullPercent)}% hull integrity` : "Ready";
  const repairButtonLabel = !isEquipped
    ? "Activate to Repair"
    : needsRepair
      ? `Repair Hull · CR ${formatNumber(repairCost)}`
      : "Repair Hull";
  const managementAction = isEquipped
    ? `<button class="fleet-management-primary" onclick="showHangarSection('overview');">Open Loadout</button>`
    : `<button class="fleet-management-primary" onclick="equipShip('${shipId}'); showHangarSection('owned');">Set Active</button>`;

  panel.innerHTML = `
    <div class="exchange-selected-vessel fleet-selected-vessel is-open" data-ship-id="${escapeHtml(ship.id)}">
      <section class="exchange-detail-preview fleet-selected-hero">
        <div class="exchange-selected-identity fleet-selected-identity">
          <span>${isEquipped ? "Active Vessel" : "Selected Vessel"}</span>
          <h4>${escapeHtml(ship.name)}</h4>
          <p>${getVesselExchangeClassLabel(ship)}</p>
        </div>
        <div class="exchange-detail-status-chip fleet-selected-status ${isEquipped ? "active" : "owned"}">${statusLabel}</div>
        <div class="exchange-selected-presentation fleet-selected-presentation">
          <div class="exchange-detail-glow fleet-selected-glow"></div>
          <div class="exchange-hero-ring fleet-selected-ring"></div>
          <img src="${typeof getShipAsset === "function" ? getShipAsset(ship.id, "large") : ship.image}" alt="${ship.name}">
        </div>
      </section>

      ${renderExchangeShipStatsSection(shipId, stats, {
        hullValue: `${formatNumber(Math.floor(hullState.hull))} / ${formatNumber(hullState.hullMax)}`,
        slotsMode: "usage"
      })}

      <footer class="exchange-purchase-bar fleet-management-bar ${needsRepair ? "needs-repair" : "ready"}">
        <div class="exchange-purchase-summary fleet-condition-summary">
          <span>Hull Condition</span>
          <strong>${conditionLabel}</strong>
          <small>${formatNumber(Math.floor(hullState.hull))} / ${formatNumber(hullState.hullMax)} hull</small>
        </div>
        <div class="exchange-detail-footer fleet-management-actions">
          <button class="fleet-repair-action" onclick="repairCurrentShip()" ${repairDisabled ? "disabled" : ""}>${repairButtonLabel}</button>
          ${managementAction}
        </div>
      </footer>
    </div>
  `;
}

function getCurrentPvpSessionHullState() {
  const state = typeof serverPvpDamageDisplayState === "object" && serverPvpDamageDisplayState
    ? serverPvpDamageDisplayState
    : null;
  const pvpHull = Number(state?.hull);
  if (!Number.isFinite(pvpHull)) return null;
  const pvpHullMax = Number(state?.hullMax);
  const maxHull = Number.isFinite(pvpHullMax) && pvpHullMax > 0 ? pvpHullMax : hullMax;
  if (!Number.isFinite(maxHull) || maxHull <= 0) return null;
  return {
    hull: Math.max(1, Math.min(maxHull, pvpHull)),
    hullMax: maxHull,
    damaged: pvpHull < maxHull
  };
}

function getEffectiveRepairHullState() {
  const localHull = Number.isFinite(Number(hull)) ? Number(hull) : hullMax;
  const localHullMax = Number.isFinite(Number(hullMax)) && Number(hullMax) > 0 ? Number(hullMax) : 1;
  const pvpState = getCurrentPvpSessionHullState();
  if (pvpState?.damaged && pvpState.hull < localHull) {
    return {
      hull: pvpState.hull,
      hullMax: localHullMax,
      missingHull: Math.max(0, localHullMax - pvpState.hull),
      source: "pvp"
    };
  }
  return {
    hull: localHull,
    hullMax: localHullMax,
    missingHull: Math.max(0, localHullMax - localHull),
    source: "local"
  };
}

function getRepairCost() {
  const repairState = getEffectiveRepairHullState();
  return Math.max(0, Math.ceil(repairState.missingHull * HULL_REPAIR_COST_PER_POINT));
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

  const repairState = getEffectiveRepairHullState();
  const missingHull = repairState.missingHull;
  const repairCost = getRepairCost();
  const disabled = missingHull <= 0 || credits < repairCost;

  return `
    <div class="repair-panel">
      <strong>Ship Condition</strong>
      <span>Hull: ${formatNumber(Math.floor(repairState.hull))} / ${formatNumber(repairState.hullMax)}${repairState.source === "pvp" ? " (PvP session)" : ""}</span>
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
  saveActiveShipCondition(currentShipId);

  if (typeof applyServerPvpDamageState === "function") {
    applyServerPvpDamageState({
      targetSessionId: window.LupenMultiplayerClient?.sessionId || "",
      shield,
      shieldMax,
      armor,
      armorMax: armor,
      hull,
      hullMax,
      reason: "hangar_repair_local"
    });
  }

  if (window.LupenMultiplayerClient?.syncPvpRepairState) {
    window.LupenMultiplayerClient.syncPvpRepairState({
      currentShipId,
      hull,
      hullMax,
      shield,
      shieldMax,
      armor,
      armorMax: armor,
      reason: "hangar_repair"
    });
  }

  addHudToast(`Hull repaired in Hangar for CR ${formatNumber(repairCost)}.`);
  if (typeof recordMissionEvent === "function") recordMissionEvent("repair_ship", { shipId: currentShipId, cost: repairCost });
  tutorialEvent("repairedShip");
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
  const index = Math.max(0, Number(selectedLoadoutItemContext?.index || 0));
  return `${categoryKey === "guns" ? "Weapon" : "Attachment"} ${String(index + 1).padStart(2, "0")}`;
}

function isSelectedLoadoutSlotOccupied(categoryKey = selectedLoadoutItemContext?.categoryKey) {
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
  const slotLimit = categoryKey === "guns" ? getGunSlotLimit(selectedHangarShipId) : getAttachmentSlotLimit(selectedHangarShipId);
  selectedLoadoutItemContext = {
    source: "slot",
    categoryKey,
    index: Math.min(categoryKey === "guns" ? 1 : 0, Math.max(0, slotLimit - 1)),
    key: "",
    quality: "standard"
  };
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
  renderInstalledGuns();
  renderInstalledAttachments();
  renderGunInventory();
  renderLoadoutItemDetail();
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
    const selected = selectedLoadoutItemContext?.categoryKey === categoryKey &&
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
  if (selectedSlotBar) selectedSlotBar.textContent = `Selected Slot · ${getSelectedLoadoutSlotLabel()}`;
  const isAttachmentSlot = selectedLoadoutItemContext?.categoryKey === "attachments";
  const vaultTitle = document.getElementById("loadoutVaultTitle");
  if (vaultTitle) vaultTitle.textContent = isAttachmentSlot ? "Available Attachments" : "Available Weapons";
  const vaultHint = document.getElementById("loadoutVaultHint");
  if (vaultHint) vaultHint.textContent = `Choose stored gear for ${getSelectedLoadoutSlotLabel()}`;

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
  let index = selected.categoryKey === categoryKey ? Number(selected.index) : -1;
  const loadout = getShipLoadout(selectedHangarShipId);
  const list = categoryKey === "guns" ? loadout.guns : loadout.attachments;

  if (!Number.isInteger(index) || index < 0 || index >= limit) {
    index = list.findIndex(slot => !getEquipmentKey(slot));
    if (index < 0) index = list.length < limit ? list.length : -1;
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

  if (isMultiplayerStagingStoreActive()) {
    if (getStagingStoreItemId({ kind: categoryKey === "guns" ? "gun" : "attachment", key: entry.key })) {
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
      <button type="button" class="loadout-vault-equip-action" ${entry.count <= 0 || !compatible || unlock.locked || selectedSlotOccupied ? "disabled" : ""}>
        ${selectedSlotOccupied ? "Unequip First" : "Equip"}
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

function isShipLineUnlocked(lineId) {
  const line = SHIP_LINES?.[lineId];
  return Boolean(line?.unlockedByDefault || (Array.isArray(unlockedShipLines) && unlockedShipLines.includes(lineId)));
}

function getShipPlanStatus(shipId) {
  const ship = SHIPS[shipId];
  if (!ship) return { state: "unknown", label: "Unknown" };
  const lineUnlocked = isShipLineUnlocked(ship.lineId);
  if (!lineUnlocked) return { state: "locked", label: "Plan Locked" };
  if (currentShipId === shipId) return { state: "active", label: "Active" };
  if (ownedShips.includes(shipId)) return { state: "owned", label: "Owned" };
  return { state: "available", label: shipId === STARTER_SHIP_ID ? "Starter Plan" : "Ready to Purchase" };
}

function openShipPlanShip(shipId) {
  if (!SHIPS[shipId]) return;
  if (ownedShips.includes(shipId)) {
    selectedFleetShipId = shipId;
    showHangarSection("owned");
    return;
  }
  selectedShipyardShipId = shipId;
  showHangarSection("shipyard");
}

function selectShipPlanLine(lineId) {
  const validLine = Boolean(SHIP_LINES?.[lineId]);
  selectedShipPlanLineId = validLine ? lineId : "encrypted-future";
  if (validLine && !SHIP_LINES[lineId].shipIds.includes(selectedShipPlanShipId)) {
    selectedShipPlanShipId = SHIP_LINES[lineId].shipIds[0] || "";
  }
  renderShipPlans();
}

function selectShipPlanShip(shipId) {
  if (!SHIPS[shipId]) return;
  selectedShipPlanShipId = shipId;
  renderShipPlans();
}

function renderShipPlanCard(shipId) {
  const ship = SHIPS[shipId];
  if (!ship) return "";
  const status = getShipPlanStatus(shipId);
  const selected = selectedShipPlanShipId === shipId;

  return `
    <button type="button" class="ship-plan-card ${status.state} ${selected ? "selected" : ""}"
      data-ship-id="${escapeHtml(shipId)}" aria-pressed="${selected ? "true" : "false"}"
      onclick="selectShipPlanShip('${escapeHtml(shipId)}')">
      <div class="ship-plan-card-status">${escapeHtml(status.label)}</div>
      <div class="ship-plan-image-wrap">
        <div class="ship-plan-image-halo"></div>
        <img src="${escapeHtml(getShipAsset(shipId, "medium"))}" alt="${escapeHtml(ship.name)}">
      </div>
      <div class="ship-plan-card-copy">
        <span>${escapeHtml(ship.className || getVesselExchangeClassLabel(ship))}</span>
        <h4>${escapeHtml(ship.name)}</h4>
      </div>
    </button>
  `;
}

function renderSelectedShipPlan(shipId) {
  const ship = SHIPS[shipId];
  if (!ship) return "";
  const status = getShipPlanStatus(shipId);
  const actionLabel = status.state === "active"
    ? "Active Vessel"
    : status.state === "owned"
      ? "View in Fleet"
      : shipId === STARTER_SHIP_ID && !hasActiveShip()
        ? "Claim in Exchange"
        : "View Full Specs";
  const acquisition = shipId === STARTER_SHIP_ID ? "Starter hull" : `CR ${formatNumber(ship.price)}`;

  return `
    <section class="ship-plan-selection" data-selected-ship-id="${escapeHtml(shipId)}" aria-live="polite">
      <div class="ship-plan-selection-copy">
        <span>SELECTED PLAN · ${escapeHtml(ship.className || getVesselExchangeClassLabel(ship))}</span>
        <h5>${escapeHtml(ship.name)}</h5>
        <p>${escapeHtml(ship.description || ship.roleSubtitle || ship.role || "Recovered ship plan.")}</p>
      </div>
      <div class="ship-plan-selection-action">
        <small>${escapeHtml(ship.roleSubtitle || ship.role || "General purpose")}</small>
        <strong>${escapeHtml(acquisition)}</strong>
        <button type="button" onclick="openShipPlanShip('${escapeHtml(shipId)}')" ${status.state === "active" ? "disabled" : ""}>${escapeHtml(actionLabel)}</button>
      </div>
    </section>
  `;
}

function renderShipPlans() {
  const content = document.getElementById("shipPlansContent");
  if (!content) return;

  const title = document.getElementById("hangarShipTitle");
  const subtitle = document.getElementById("hangarShipSubtitle");
  if (title) title.textContent = "Ship Plans";
  if (subtitle) subtitle.textContent = "Discovered families and construction access";

  const lines = Object.values(SHIP_LINES || {});
  const unlockedCount = lines.filter(line => isShipLineUnlocked(line.id)).length;
  if (!SHIP_LINES?.[selectedShipPlanLineId] && selectedShipPlanLineId !== "encrypted-future") {
    selectedShipPlanLineId = lines.find(line => isShipLineUnlocked(line.id))?.id || lines[0]?.id || "encrypted-future";
  }
  const count = document.getElementById("shipPlansUnlockedCount");
  if (count) count.textContent = formatNumber(unlockedCount);

  const selectedLine = SHIP_LINES?.[selectedShipPlanLineId];
  const selectedUnlocked = selectedLine ? isShipLineUnlocked(selectedLine.id) : false;
  if (selectedLine && !selectedLine.shipIds.includes(selectedShipPlanShipId)) {
    selectedShipPlanShipId = selectedLine.shipIds[0] || "";
  }

  const selectorCards = lines.map(line => {
    const unlocked = isShipLineUnlocked(line.id);
    const selected = selectedShipPlanLineId === line.id;
    return `
      <button type="button" class="ship-plan-selector-card ${selected ? "selected" : ""} ${unlocked ? "unlocked" : "locked"}"
        data-line-id="${escapeHtml(line.id)}" aria-pressed="${selected ? "true" : "false"}" onclick="selectShipPlanLine('${escapeHtml(line.id)}')">
        <span>${escapeHtml(line.manufacturer)}</span>
        <strong>${escapeHtml(line.name)}</strong>
        <small>${unlocked ? `${formatNumber(line.shipIds.length)} hull plans available` : "Plans encrypted"}</small>
        <b>${unlocked ? "Unlocked" : "Locked"}</b>
      </button>
    `;
  }).join("");

  const futureSelected = selectedShipPlanLineId === "encrypted-future";
  const selectedWorkspace = selectedLine ? `
    <section class="ship-plan-line ${selectedUnlocked ? "unlocked" : "locked"}" data-line-id="${escapeHtml(selectedLine.id)}">
      <header class="ship-plan-line-header">
        <div>
          <span>${escapeHtml(selectedLine.manufacturer)}</span>
          <h4>${escapeHtml(selectedLine.name)}</h4>
          <p>${formatNumber(selectedLine.shipIds.length)} hull designs share this plan architecture.</p>
        </div>
        <div class="ship-plan-line-state ${selectedUnlocked ? "unlocked" : "locked"}">
          <strong>${selectedUnlocked ? "PLANS UNLOCKED" : "PLANS ENCRYPTED"}</strong>
          <small>${escapeHtml(selectedLine.unlockHint || "Discovery method unknown.")}</small>
        </div>
      </header>
      ${selectedUnlocked ? `
        <div class="ship-plan-card-grid">
          ${selectedLine.shipIds.map(renderShipPlanCard).join("")}
        </div>
        ${renderSelectedShipPlan(selectedShipPlanShipId)}
      ` : `
        <div class="ship-plan-locked-lineup">
          <strong>Lineup data encrypted</strong>
          <span>Recover this plan family to reveal its hulls and construction specifications.</span>
        </div>
      `}
    </section>
  ` : `
    <section class="ship-plan-line future locked" data-line-id="encrypted-future">
      <header class="ship-plan-line-header">
        <div>
          <span>UNDISCOVERED MANUFACTURER</span>
          <h4>Encrypted Ship Line</h4>
          <p>Recover plans through exploration, missions and regional progression.</p>
        </div>
        <div class="ship-plan-line-state locked">
          <strong>NOT DISCOVERED</strong>
          <small>Unlock method not yet known.</small>
        </div>
      </header>
      <div class="ship-plan-encrypted-preview" aria-label="Undiscovered ship plans">
        <span>?</span><span>?</span><span>?</span><span>?</span>
      </div>
    </section>
  `;

  content.innerHTML = `
    <div class="ship-plans-browser">
      <aside class="ship-plan-selector" aria-label="Ship plan families">
        <div class="ship-plan-selector-heading">
          <span>PLAN ARCHIVE</span>
          <small>Select a recovered family</small>
        </div>
        ${selectorCards}
        <button type="button" class="ship-plan-selector-card future locked ${futureSelected ? "selected" : ""}"
          data-line-id="encrypted-future" aria-pressed="${futureSelected ? "true" : "false"}" onclick="selectShipPlanLine('encrypted-future')">
          <span>UNKNOWN SOURCE</span>
          <strong>Encrypted Line</strong>
          <small>Lineup unavailable</small>
          <b>Undiscovered</b>
        </button>
      </aside>
      <div class="ship-plan-workspace">
        ${selectedWorkspace}
      </div>
    </div>
  `;
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
          <span>Hull Status</span>
          <strong>${statusLabel}</strong>
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

  const order = { attachments: 0, guns: 1, materials: 2 };
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

  // The weapon purchase step is two-part: select Pulse Laser, then buy it.
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
    storeFilter = "guns";
    selectedStoreQuality = "standard";
    const pulseItem = getStoreCatalogItems().find(item => item.key === "pulseLaser" && item.kind === "gun");
    if (pulseItem) selectedStoreItemId = pulseItem.id;
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

  if (tutorialState?.active && getCurrentTutorialStep()?.id === "buy-equipment") {
    setTimeout(() => {
      const target = document.querySelector(".store-detail-buy-action[data-item-key='pulseLaser']:not(:disabled)") ||
        document.querySelector(".store-catalog-card[data-item-key='pulseLaser']:not(.sold-out)");
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
  const stagingEquipPending = multiplayerStagingLoadoutEquipPendingItemId === stagingStoreItemId;
  const stagingEquippableItem = stagingStoreLocked &&
    stagingWritableItem &&
    (item.kind === "gun" || item.kind === "attachment") &&
    totalOwned > 0;
  const stagingPreviewButton = stagingStoreItemId
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
        ? `<button class="store-detail-buy-action locked-action" data-item-key="${item.key}" data-item-kind="${item.kind}" onclick="storeBuySelected()">Locked</button>`
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
        ${renderStagingCargoPodEquipNote(item)}
        ${renderStagingShieldBoosterEquipNote(item)}
        ${renderStagingPulseLaserEquipNote(item)}
        ${renderStagingShipEquipNote(item)}
        ${detailStatsHtml}
      </div>

      <div class="store-buy-footer store-detail-actions compact-store-actions simplified-store-actions ${sellButton ? 'two-buttons' : 'one-button'}">
        ${buyButton}
        ${stagingEquippableItem ? `<button class="store-detail-buy-action" onclick="requestStagingLoadoutEquip(getStoreSelectedItem())" ${stagingEquipPending ? "disabled" : ""}>${stagingEquipPending ? "Applying..." : `Apply ${escapeHtml(item.name)}`}</button>` : ""}
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
    grantStarterShipKit();
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

function equipShip(shipId) {
  if (isMultiplayerStagingStoreActive()) {
    const ship = SHIPS[shipId];
    if (ship && !ship.hiddenFromExchange && ownedShips.includes(shipId) && currentShipId !== shipId && getStagingStoreItemId({ kind: "ship", key: shipId })) {
      requestStagingShipEquip({ kind: "ship", key: shipId });
      return;
    }
  }
  if (blockLoadoutMutationInMultiplayerStaging()) return;
  if (!ownedShips.includes(shipId)) return;

  saveActiveShipCondition(currentShipId);
  currentShipId = shipId;
  selectedHangarShipId = shipId;
  selectedFleetShipId = shipId;
  ensureShipCondition(shipId);
  applyShipStats(false);
  renderHangar();
  addHudToast(`${SHIPS[shipId]?.name || "Ship"} is ready to fly.`);
  const starterShipId = typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
  if (tutorialState?.active && getCurrentTutorialStep?.()?.id === "buy-first-ship" && shipId === starterShipId) {
    tutorialEvent("boughtFirstShip");
  }
  if (shipId === starterShipId && typeof recordMissionEvent === "function") {
    recordMissionEvent("starter_ship_claimed", { shipId, mode: "activate" });
  }
  saveGame();
}

