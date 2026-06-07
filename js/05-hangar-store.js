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
  "ship:monolith": "ship:monolith"
});

let multiplayerStagingStoreSubscribed = false;
let multiplayerStagingStorePurchasePending = false;
let multiplayerStagingCargoPodEquipPending = false;
let multiplayerStagingShieldBoosterEquipPending = false;
let multiplayerStagingPulseLaserEquipPending = false;
let multiplayerStagingShipEquipPending = false;
let multiplayerStagingLoadoutEquipPendingItemId = "";
let multiplayerStagingLoadoutUnequipPending = false;
let selectedVaultActionContext = null;
let selectedLoadoutItemContext = null;
let selectedLoadoutVaultFilter = "all";
let selectedLoadoutVaultSearch = "";
let selectedLoadoutVaultSort = "quality";
const LOADOUT_GRID_SLOT_COUNT = 20;
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
  const message = "Local Store writes are disabled in multiplayer staging. Server staging Store handles validation.";
  if (typeof addHudToast === "function") addHudToast(message);
  if (typeof addActivityLog === "function") addActivityLog(message);
  if (typeof console !== "undefined" && typeof console.info === "function") {
    console.info(`[Lupen multiplayer] ${message}`);
  }
  return true;
}

function blockLoadoutMutationInMultiplayerStaging() {
  if (!isMultiplayerStagingStoreActive()) return false;
  const message = "Local loadout writes are disabled in multiplayer staging. Server staging loadout handles validation.";
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
  if (!result) return "Server preview pending. No CR or inventory changed.";
  if (result.applied) return `${result.name || "Store item"} purchased.`;
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
    return `<div class="store-detail-owned-line">MP staging Store: server-backed validation. Writes require live Colyseus gates.</div>`;
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
  return Boolean(itemId);
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

function getStagingShieldBoosterEquipLine(result) {
  if (!result) return "Shield Booster equip preview pending.";
  if (result.applied) return "Shield Booster equipped.";
  if (result.mode === "dry_run" && result.ok) return "Would equip Shield Booster.";
  if (result.blockReason === "shield_booster_not_owned") return "Blocked: no owned Shield Booster.";
  if (result.blockReason === "attachment_slots_full") return "Blocked: no empty equipment slot.";
  if (result.reason === "staging_loadout_dry_run_enabled") return "Dry run only - loadout not changed.";
  return `Blocked: ${result.blockReason || result.reason || "loadout unavailable"}.`;
}

function renderStagingShieldBoosterEquipNote(item) {
  if (!isMultiplayerStagingStoreActive() || getStagingStoreItemId(item) !== "attachment:shieldBooster") return "";
  const result = getLastStagingShieldBoosterEquipResult();
  const shieldLine = result?.shieldBefore !== null && result?.shieldBefore !== undefined
    ? ` / Shield ${formatNumber(result.shieldBefore)} -> ${formatNumber(result.shieldAfter ?? result.shieldAfterPreview)}`
    : "";
  const ownedLine = result?.ownedBefore !== null && result?.ownedBefore !== undefined
    ? ` / Owned ${formatNumber(result.ownedBefore)} -> ${formatNumber(result.ownedAfter)}`
    : "";
  return `
    <div class="store-detail-owned-line">
      <strong>${escapeHtml(getStagingShieldBoosterEquipLine(result))}</strong>${escapeHtml(shieldLine)}${escapeHtml(ownedLine)} /
      ${escapeHtml(result?.applied ? "Server save refreshed after applied shield equip." : "Dry run only - no loadout, inventory, credits, ships, weapons, loot, or bounties changed.")}
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

function getStagingShipEquipLine(result, shipName = "Ship") {
  if (!result) return `${shipName} selection preview pending.`;
  if (result.applied) return `${shipName} selected.`;
  if (result.mode === "dry_run" && result.ok) return `Would fly ${shipName}.`;
  if (result.blockReason === "ship_not_owned") return `Blocked: ${shipName} is not owned.`;
  if (result.blockReason === "ship_already_equipped") return `${shipName} already active.`;
  if (result.reason === "staging_loadout_dry_run_enabled") return "Dry run only - active ship not changed.";
  return `Blocked: ${result.blockReason || result.reason || "ship selection unavailable"}.`;
}

function renderStagingShipEquipNote(item) {
  const itemId = getStagingStoreItemId(item);
  if (!isMultiplayerStagingStoreActive() || !itemId || item?.kind !== "ship") return "";
  const result = getLastStagingShipEquipResult(itemId);
  const shipName = item?.name || result?.name || "Ship";
  const shipLine = result?.selectedShipBefore && result?.selectedShipAfter
    ? ` / Ship ${result.selectedShipBefore} -> ${result.selectedShipAfter}`
    : "";
  const capacityLine = result?.cargoCapacityBefore !== null && result?.cargoCapacityBefore !== undefined
    ? ` / Cargo ${formatNumber(result.cargoCapacityBefore)} -> ${formatNumber(result.cargoCapacityAfter ?? result.cargoCapacityAfterPreview)}`
    : "";
  return `
    <div class="store-detail-owned-line">
      <strong>${escapeHtml(getStagingShipEquipLine(result, shipName))}</strong>${escapeHtml(shipLine)}${escapeHtml(capacityLine)} /
      ${escapeHtml(result?.applied ? "Server save refreshed after applied ship selection." : "Dry run only - no loadout, cargo, weapons, equipment, loot, or bounties changed.")}
    </div>`;
}

async function requestStagingShipEquip(item) {
  const itemId = getStagingStoreItemId(item);
  if (!isMultiplayerStagingStoreActive() || !itemId || item?.kind !== "ship") return false;
  const shipName = item?.name || "Ship";
  const client = window.LupenMultiplayerClient;
  const status = client?.getStatus?.();
  if (!client?.equipStagingShip || !status?.enabled || !status?.isConnected) {
    if (typeof addHudToast === "function") addHudToast(`MP staging ${shipName} selection is waiting for the multiplayer server connection.`);
    return true;
  }
  if (multiplayerStagingShipEquipPending) return true;
  multiplayerStagingShipEquipPending = true;
  renderStore();
  client.equipStagingShip({ itemId });
  if (typeof addHudToast === "function") addHudToast(`Requested MP staging ${shipName} selection.`);
  setTimeout(async () => {
    multiplayerStagingShipEquipPending = false;
    const latest = client.getStatus?.().lastStagingLoadoutEquip;
    if (latest?.itemId === itemId && latest.applied) {
      const selectedName = latest.name || shipName;
      const message = `${selectedName} selected: cargo ${formatNumber(latest.cargoCapacityBefore)} -> ${formatNumber(latest.cargoCapacityAfter)}.`;
      if (typeof addHudToast === "function") addHudToast(message);
      if (typeof addActivityLog === "function") addActivityLog(message);
      if (typeof loadGameFromSupabase === "function") {
        try {
          const loaded = await loadGameFromSupabase();
          if (loaded?.loaded) {
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
  }, 900);
  return true;
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
      const message = `Cargo Pod equipped: cargo ${formatNumber(latest.cargoCapacityBefore)} -> ${formatNumber(latest.cargoCapacityAfter)}.`;
      if (typeof addHudToast === "function") addHudToast(message);
      if (typeof addActivityLog === "function") addActivityLog(message);
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

async function requestStagingShieldBoosterEquip(item) {
  if (!isMultiplayerStagingStoreActive() || getStagingStoreItemId(item) !== "attachment:shieldBooster") return false;
  const client = window.LupenMultiplayerClient;
  const status = client?.getStatus?.();
  if (!client?.equipStagingShieldBooster || !status?.enabled || !status?.isConnected) {
    if (typeof addHudToast === "function") addHudToast("MP staging Shield Booster equip is waiting for the multiplayer server connection.");
    return true;
  }
  if (multiplayerStagingShieldBoosterEquipPending) return true;
  multiplayerStagingShieldBoosterEquipPending = true;
  renderStore();
  client.equipStagingShieldBooster({ itemId: "attachment:shieldBooster" });
  if (typeof addHudToast === "function") addHudToast("Requested MP staging Shield Booster equip.");
  setTimeout(async () => {
    multiplayerStagingShieldBoosterEquipPending = false;
    const latest = client.getStatus?.().lastStagingLoadoutEquip;
    if (latest?.itemId === "attachment:shieldBooster" && latest.applied) {
      const message = `Shield Booster equipped: shield ${formatNumber(latest.shieldBefore)} -> ${formatNumber(latest.shieldAfter)}.`;
      if (typeof addHudToast === "function") addHudToast(message);
      if (typeof addActivityLog === "function") addActivityLog(message);
      if (typeof loadGameFromSupabase === "function") {
        try {
          const loaded = await loadGameFromSupabase();
          if (loaded?.loaded) {
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
    if (typeof addHudToast === "function") addHudToast("MP staging loadout equip is waiting for the multiplayer server connection.");
    return true;
  }
  if (multiplayerStagingLoadoutEquipPendingItemId) return true;
  multiplayerStagingLoadoutEquipPendingItemId = itemId;
  if (itemId === "attachment:cargoPod") multiplayerStagingCargoPodEquipPending = true;
  if (itemId === "attachment:shieldBooster") multiplayerStagingShieldBoosterEquipPending = true;
  if (itemId === "gun:pulseLaser") multiplayerStagingPulseLaserEquipPending = true;
  renderStore();
  client.equipStagingLoadoutItem({ itemId });
  if (typeof addHudToast === "function") addHudToast(`Equipping ${item.name || "item"}.`);
  setTimeout(async () => {
    multiplayerStagingLoadoutEquipPendingItemId = "";
    multiplayerStagingCargoPodEquipPending = false;
    multiplayerStagingShieldBoosterEquipPending = false;
    multiplayerStagingPulseLaserEquipPending = false;
    const latest = client.getStatus?.().lastStagingLoadoutEquip;
    if (latest?.itemId === itemId && latest.applied) {
      const statChange = latest.cargoCapacityBefore !== null && latest.cargoCapacityBefore !== undefined
        ? ` Cargo ${formatNumber(latest.cargoCapacityBefore)} -> ${formatNumber(latest.cargoCapacityAfter)}.`
        : latest.shieldBefore !== null && latest.shieldBefore !== undefined
          ? ` Shield ${formatNumber(latest.shieldBefore)} -> ${formatNumber(latest.shieldAfter)}.`
          : "";
      const message = `${latest.name || item.name || "Item"} equipped.${statChange}`;
      if (typeof addHudToast === "function") addHudToast(message);
      if (typeof addActivityLog === "function") addActivityLog(message);
      if (typeof loadGameFromSupabase === "function") {
        try {
          const loaded = await loadGameFromSupabase();
          if (loaded?.loaded) {
            if (typeof syncMultiplayerPresence === "function") syncMultiplayerPresence("staging_loadout_equipped");
            if (typeof addHudToast === "function") addHudToast("Save refreshed from server.");
          }
        } catch (_err) {
          if (typeof addHudToast === "function") addHudToast("Item equipped. Reload if loadout values look stale.");
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
      const spent = Number.isFinite(Number(latest.creditsBefore)) && Number.isFinite(Number(latest.creditsAfter))
        ? ` CR ${formatNumber(Math.max(0, Number(latest.creditsBefore) - Number(latest.creditsAfter)))} spent.`
        : "";
      const message = `${latest.name || "Store item"} purchased.${spent}`;
      if (typeof addHudToast === "function") addHudToast(message);
      if (typeof addActivityLog === "function") addActivityLog(message);
      if (typeof loadGameFromSupabase === "function") {
        try {
          const loaded = await loadGameFromSupabase();
          if (loaded?.loaded) {
            if (typeof syncMultiplayerPresence === "function") syncMultiplayerPresence("staging_store_purchase");
            if (typeof addHudToast === "function") addHudToast("Save refreshed from server.");
          }
        } catch (_err) {
          if (typeof addHudToast === "function") addHudToast("Staging purchase applied. Reload if Store values look stale.");
        }
      }
    }
    renderStore();
    if (document.getElementById("hangarScreen")?.classList.contains("active")) renderHangar();
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
  selectedVaultActionContext = null;
  renderHangarVault();
}

function selectEquippedLoadoutVaultItem(categoryKey, index) {
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
    stats.push({ label: "Available", value: formatNumber(entry.storedCount) });
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

  return stats.slice(0, item.kind === "gun" ? 6 : 4);
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
  const selectedFromEquippedSlot = selectedVaultActionContext?.source === "equipped" &&
    selectedVaultActionContext.key === entry.key &&
    selectedVaultActionContext.quality === entry.quality;
  const equipAvailable = canEquipVaultEntry(entry);
  const unequipAvailable = findEquippedVaultEntryIndex(entry) >= 0;
  const managementActions = ["guns", "attachments"].includes(entry.categoryKey) ? `
    <div class="vault-management-actions">
      <button type="button" onclick="equipSelectedVaultItem()" ${equipAvailable ? "" : "disabled"}>
        Equip
      </button>
      <button type="button" class="${selectedFromEquippedSlot ? "primary" : ""}" onclick="unequipSelectedVaultItem()" ${unequipAvailable ? "" : "disabled"}>
        Unequip
      </button>
    </div>
  ` : "";
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
      ${managementActions}
      ${upgradePanel}
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
  const loadout = getShipLoadout(selectedHangarShipId);
  if (entry.categoryKey === "guns") return (loadout.guns || []).length < getGunSlotLimit(selectedHangarShipId);
  return (loadout.attachments || []).length < getAttachmentSlotLimit(selectedHangarShipId);
}

function findEquippedVaultEntryIndex(entry) {
  if (!entry || !["guns", "attachments"].includes(entry.categoryKey)) return -1;
  const loadout = getShipLoadout(selectedHangarShipId);
  const list = entry.categoryKey === "guns" ? loadout.guns : loadout.attachments;
  return (list || []).findIndex(item => getEquipmentKey(item) === entry.key && getEquipmentQuality(item) === entry.quality);
}

function equipSelectedVaultItem() {
  const entry = getSelectedVaultEntry();
  if (!entry || !canEquipVaultEntry(entry)) return;
  if (entry.categoryKey === "guns") {
    equipGunFromInventory(entry.key, entry.quality, "owned");
  } else if (entry.categoryKey === "attachments") {
    equipAttachmentFromInventory(entry.key, entry.quality, "owned");
  }
  selectedVaultActionContext = null;
}

async function requestStagingLoadoutUnequip(entry) {
  const itemId = getVaultItemId(entry);
  const client = window.LupenMultiplayerClient;
  const status = client?.getStatus?.();
  if (!itemId || !status?.enabled || !status?.isConnected) {
    if (typeof addHudToast === "function") addHudToast("MP staging loadout unequip is waiting for the multiplayer server connection.");
    return true;
  }
  if (typeof client.unequipStagingLoadoutItem !== "function") {
    blockLoadoutMutationInMultiplayerStaging();
    return true;
  }
  if (multiplayerStagingLoadoutUnequipPending) return true;
  multiplayerStagingLoadoutUnequipPending = true;
  client.unequipStagingLoadoutItem({ itemId });
  if (typeof addHudToast === "function") addHudToast(`Unequipping ${entry.name}.`);
  setTimeout(async () => {
    multiplayerStagingLoadoutUnequipPending = false;
    const latest = client.getStatus?.().lastStagingLoadoutEquip;
    if (latest?.itemId === itemId && latest.applied && latest.operation === "unequip") {
      const message = `${latest.name || entry.name} unequipped. Available ${formatNumber(latest.ownedAfter ?? 1)}.`;
      if (typeof addHudToast === "function") addHudToast(message);
      if (typeof addActivityLog === "function") addActivityLog(message);
      if (typeof loadGameFromSupabase === "function") {
        try {
          const loaded = await loadGameFromSupabase();
          if (loaded?.loaded) {
            if (typeof syncMultiplayerPresence === "function") syncMultiplayerPresence("staging_loadout_unequipped");
            if (typeof addHudToast === "function") addHudToast("Save refreshed from server.");
          }
        } catch (_err) {
          if (typeof addHudToast === "function") addHudToast(`${latest.name || entry.name} unequipped. Reload if loadout values look stale.`);
        }
      }
    }
    selectedVaultActionContext = null;
    selectedLoadoutItemContext = null;
    renderHangar();
  }, 900);
  return true;
}

function unequipSelectedVaultItem() {
  const entry = getSelectedVaultEntry();
  if (!entry || !["guns", "attachments"].includes(entry.categoryKey)) return;
  if (isMultiplayerStagingStoreActive()) {
    requestStagingLoadoutUnequip(entry);
    return;
  }
  const index = selectedVaultActionContext?.source === "equipped" && selectedVaultActionContext.key === entry.key
    ? selectedVaultActionContext.index
    : findEquippedVaultEntryIndex(entry);
  if (index < 0) return;
  if (entry.categoryKey === "guns") {
    removeGun(index);
  } else {
    removeAttachment(index);
  }
  selectedVaultActionContext = null;
  selectedLoadoutItemContext = null;
}

function selectAvailableLoadoutItem(categoryKey, entry) {
  if (!entry || !["guns", "attachments"].includes(categoryKey)) return;
  equipLoadoutVaultEntry(entry);
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
  return {
    key: context.key,
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
    stats: isGun
      ? getWeaponPurchaseStatRows(definition, quality)
      : getAttachmentPurchaseStatRows({ key: context.key }, quality)
  };
}

function renderLoadoutItemDetail() {
  const panel = document.getElementById("loadoutItemDetailPanel");
  if (!panel) return;

  if (selectedLoadoutItemContext?.source === "slot" && !selectedLoadoutItemContext.key) {
    panel.innerHTML = `
      <div class="loadout-detail-empty">
        <strong>${escapeHtml(getSelectedLoadoutSlotLabel())}</strong>
        <span>Select compatible equipment from the vault to fill this slot.</span>
      </div>
    `;
    updateLoadoutVaultChrome();
    return;
  }

  const detail = getLoadoutDetailDefinition(selectedLoadoutItemContext);
  if (!detail) {
    panel.innerHTML = `
      <div class="loadout-detail-empty">
        <strong>Select equipment</strong>
        <span>Choose an installed slot or available item to manage this ship.</span>
      </div>
    `;
    return;
  }

  const equipAvailable = canEquipVaultEntry({
    categoryKey: detail.categoryKey,
    storedCount: detail.availableCount
  });
  const unequipAvailable = findEquippedVaultEntryIndex({
    categoryKey: detail.categoryKey,
    key: detail.key,
    quality: detail.quality
  }) >= 0;
  const equipPrimary = detail.source !== "equipped";
  const statRows = [
    { label: "Owned", value: formatNumber(detail.ownedCount) },
    { label: "Equipped", value: formatNumber(detail.equippedCount) },
    { label: "Available", value: formatNumber(detail.availableCount) },
    ...detail.stats
  ].slice(0, 7);

  panel.innerHTML = `
    <div class="loadout-detail-card quality-${escapeHtml(detail.quality)}">
      <div class="loadout-detail-head">
        <img src="${escapeHtml(detail.icon)}" alt="${escapeHtml(detail.name)}">
        <div>
          <span>${escapeHtml(detail.typeLabel)} / ${escapeHtml(titleCaseQuality(detail.quality))}</span>
          <strong>${escapeHtml(detail.name)} / Lv ${formatNumber(detail.level)}</strong>
        </div>
      </div>
      <div class="loadout-detail-stats">
        ${statRows.map(row => `
          <div>
            <span>${escapeHtml(row.label)}</span>
            <strong>${escapeHtml(row.value)}</strong>
          </div>
        `).join("")}
      </div>
      <div class="loadout-detail-actions">
        <button type="button" class="${equipPrimary ? "primary" : ""}" onclick="equipSelectedLoadoutItem()" ${equipAvailable ? "" : "disabled"}>
          Equip
        </button>
        <button type="button" class="${!equipPrimary ? "primary" : ""}" onclick="unequipSelectedLoadoutItem()" ${unequipAvailable ? "" : "disabled"}>
          Unequip
        </button>
      </div>
    </div>
  `;
}

function equipSelectedLoadoutItem() {
  const detail = getLoadoutDetailDefinition(selectedLoadoutItemContext);
  if (!detail || detail.availableCount <= 0) return;
  equipLoadoutVaultEntry({
    key: detail.key,
    quality: detail.quality,
    level: detail.level,
    categoryKey: detail.categoryKey,
    source: selectedLoadoutItemContext?.inventorySource || "owned"
  });
}

function unequipSelectedLoadoutItem() {
  const detail = getLoadoutDetailDefinition(selectedLoadoutItemContext);
  if (!detail || detail.equippedCount <= 0) return;
  selectedVaultGroupKey = `${detail.key}__${detail.quality}`;
  selectedVaultActionContext = {
    source: "equipped",
    categoryKey: detail.categoryKey,
    index: findEquippedVaultEntryIndex(detail),
    key: detail.key,
    quality: detail.quality
  };
  unequipSelectedVaultItem();
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
    selectedHangarShipId = currentShipId || (typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon");
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
    overviewImage.src = typeof getShipAsset === "function" ? getShipAsset(ship.id, "master") : ship.image;
    overviewImage.alt = ship.name;
  }
  if (overviewNameplate) overviewNameplate.textContent = ship.name;

  if (overviewStats) {
    const hullPercent = hullMax > 0 ? Math.max(0, Math.min(100, (hull / hullMax) * 100)) : 0;
    overviewStats.innerHTML = `
      <div class="hangar-stat-card hull-stat featured-stat"><span>Hull</span><strong>${formatNumber(Math.floor(hull))} / ${formatNumber(hullMax)}</strong><i style="--hull-fill:${hullPercent}%"></i></div>
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
  renderLoadoutItemDetail();
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
        <img src="${typeof getShipAsset === "function" ? getShipAsset(ship.id, "medium") : ship.image}" alt="${ship.name}">
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
      <img src="${typeof getShipAsset === "function" ? getShipAsset(ship.id, "master") : ship.image}" alt="${ship.name}">
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
  document.getElementById("hangarShipImage").src = typeof getShipAsset === "function" ? getShipAsset(ship.id, "master") : ship.image;
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
  const gunText = `${gunCount}/${LOADOUT_GRID_SLOT_COUNT}`;
  const attachmentText = `${attachmentCount}/${LOADOUT_GRID_SLOT_COUNT}`;

  const summaries = {
    gunSlotSummary: gunText,
    gunSlotSummaryMirror: gunText,
    attachmentSlotSummary: attachmentText,
    attachmentSlotSummaryMirror: attachmentText
  };

  Object.entries(summaries).forEach(([id, text]) => {
    const node = document.getElementById(id);
    if (node) node.textContent = text;
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

function getSelectedLoadoutSlotLabel() {
  const categoryKey = selectedLoadoutItemContext?.categoryKey === "attachments" ? "attachments" : "guns";
  const index = Math.max(0, Number(selectedLoadoutItemContext?.index || 0));
  return `${categoryKey === "guns" ? "Weapon" : "Attachment"} ${String(index + 1).padStart(2, "0")}`;
}

function ensureSelectedLoadoutSlot() {
  const current = selectedLoadoutItemContext;
  const validCategory = current?.categoryKey === "guns" || current?.categoryKey === "attachments";
  const limit = validCategory
    ? (current.categoryKey === "guns" ? getGunSlotLimit(selectedHangarShipId) : getAttachmentSlotLimit(selectedHangarShipId))
    : 0;
  const index = Number(current?.index);
  if (validCategory && Number.isInteger(index) && index >= 0 && index < limit) return;

  const gunLimit = getGunSlotLimit(selectedHangarShipId);
  selectedLoadoutItemContext = {
    source: "slot",
    categoryKey: "guns",
    index: Math.min(1, Math.max(0, gunLimit - 1)),
    key: "",
    quality: "standard"
  };
}

function renderLoadoutSlotGrid(box, categoryKey) {
  if (!box) return;
  const loadout = getShipLoadout(selectedHangarShipId);
  const listName = categoryKey === "guns" ? "guns" : "attachments";
  const list = loadout[listName] || [];
  const limit = categoryKey === "guns" ? getGunSlotLimit(selectedHangarShipId) : getAttachmentSlotLimit(selectedHangarShipId);
  const definitionMap = categoryKey === "guns" ? GUNS : attachments;
  setSlotRailDensity(box, LOADOUT_GRID_SLOT_COUNT);

  box.innerHTML = "";

  for (let i = 0; i < LOADOUT_GRID_SLOT_COUNT; i++) {
    const entry = list[i];
    const key = getEquipmentKey(entry);
    const quality = getEquipmentQuality(entry);
    const item = definitionMap[key];
    const supported = i < limit;
    const selected = selectedLoadoutItemContext?.categoryKey === categoryKey &&
      selectedLoadoutItemContext.index === i;

    const slot = document.createElement("button");
    slot.className = `equipment-slot scalable-loadout-slot loadout-grid-slot ${item ? "filled" : supported ? "empty" : "locked"} ${selected ? "selected" : ""} quality-${quality}`;
    slot.dataset.slotIndex = String(i + 1).padStart(2, "0");
    slot.disabled = !supported;
    slot.onclick = () => selectEquippedLoadoutVaultItem(categoryKey, i);

    if (item) {
      const tooltipEntry = getEquippedTooltipEntry(key, quality, categoryKey);
      showHangarTooltip(slot, getEquipmentTooltipHtml(tooltipEntry, categoryKey));
      bindHangarEquipmentTooltip(slot);
    } else {
      slot.title = supported
        ? `Empty ${categoryKey === "guns" ? "weapon" : "attachment"} slot ${i + 1}`
        : `Locked ${categoryKey === "guns" ? "weapon" : "attachment"} slot ${i + 1}`;
    }

    slot.innerHTML = item
      ? `<img src="${item.image}" alt="${item.name}">`
      : `<span class="slot-lock-mark" aria-hidden="true">${supported ? "" : "LOCK"}</span>`;

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

  function addEntry(key, quality, count, source, level = 1) {
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
    addEntry(item.key, item.key === "lupenCore" ? LUPEN_CORE_QUALITY : (item.quality || "standard"), 1, "inventory", item.level || 1);
  });

  return Array.from(grouped.values()).sort((a, b) => {
    const qualityDelta = ITEM_QUALITY_ORDER.indexOf(b.quality) - ITEM_QUALITY_ORDER.indexOf(a.quality);
    if (qualityDelta !== 0) return qualityDelta;
    return a.name.localeCompare(b.name);
  });
}

function removeOneInventoryItem(key, quality, level = null) {
  const index = inventoryItems.findIndex(item => item.key === key &&
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

function getAllLoadoutVaultEntries() {
  return [
    ...getInventoryEntriesForCategory("guns"),
    ...getInventoryEntriesForCategory("attachments")
  ];
}

function getFilteredLoadoutVaultEntries() {
  const query = selectedLoadoutVaultSearch.trim().toLowerCase();
  const selectedCategory = selectedLoadoutItemContext?.categoryKey;
  const filter = selectedLoadoutVaultFilter === "all" && (selectedCategory === "guns" || selectedCategory === "attachments")
    ? selectedCategory
    : selectedLoadoutVaultFilter;

  return getAllLoadoutVaultEntries()
    .filter(entry => filter === "all" || entry.categoryKey === filter)
    .filter(entry => !query || entry.name.toLowerCase().includes(query) || titleCaseQuality(entry.quality).toLowerCase().includes(query))
    .sort((a, b) => {
      if (selectedLoadoutVaultSort === "name") return a.name.localeCompare(b.name);
      if (selectedLoadoutVaultSort === "quantity") return Number(b.count || 0) - Number(a.count || 0) || a.name.localeCompare(b.name);
      const qualityDelta = ITEM_QUALITY_ORDER.indexOf(b.quality) - ITEM_QUALITY_ORDER.indexOf(a.quality);
      if (qualityDelta !== 0) return qualityDelta;
      if (b.level !== a.level) return b.level - a.level;
      return a.name.localeCompare(b.name);
    });
}

function updateLoadoutVaultChrome() {
  const entries = getAllLoadoutVaultEntries();
  const total = entries.reduce((sum, entry) => sum + Number(entry.count || 0), 0);
  const countEl = document.getElementById("equipmentInventoryCount");
  if (countEl) countEl.textContent = `${formatNumber(total)} / ${formatNumber(LOADOUT_VAULT_CAPACITY)}`;

  const selectedSlotBar = document.getElementById("loadoutSelectedSlotBar");
  if (selectedSlotBar) selectedSlotBar.textContent = `Selected Slot: ${getSelectedLoadoutSlotLabel()}`;

  const search = document.getElementById("loadoutVaultSearch");
  if (search && search.value !== selectedLoadoutVaultSearch) search.value = selectedLoadoutVaultSearch;

  const sort = document.getElementById("loadoutVaultSort");
  if (sort && sort.value !== selectedLoadoutVaultSort) sort.value = selectedLoadoutVaultSort;

  const filterIds = {
    all: "loadoutVaultFilterAll",
    guns: "loadoutVaultFilterGuns",
    attachments: "loadoutVaultFilterAttachments"
  };
  Object.entries(filterIds).forEach(([filter, id]) => {
    const button = document.getElementById(id);
    if (button) button.classList.toggle("active", selectedLoadoutVaultFilter === filter);
  });
}

function setLoadoutVaultFilter(nextFilter) {
  selectedLoadoutVaultFilter = ["all", "guns", "attachments"].includes(nextFilter) ? nextFilter : "all";
  renderGunInventory();
}

function setLoadoutVaultSearch(query) {
  selectedLoadoutVaultSearch = String(query || "");
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
  const removed = removeOneInventoryItem(entry.key, quality, level);
  if (!removed) return null;
  return makeLeveledLoadoutEntry(entry.key, quality, Math.max(1, Number(removed.level || level)));
}

function equipLoadoutVaultEntry(entry) {
  if (!entry || !["guns", "attachments"].includes(entry.categoryKey)) return;
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
    alert(categoryKey === "guns" ? "No empty weapon slots." : "No empty attachment slots.");
    return;
  }

  if (isMultiplayerStagingStoreActive()) {
    if (entry.source === "owned" && entry.quality === "standard" && getStagingStoreItemId({ kind: categoryKey === "guns" ? "gun" : "attachment", key: entry.key })) {
      requestStagingLoadoutEquip({ kind: categoryKey === "guns" ? "gun" : "attachment", key: entry.key, name: entry.name });
      return;
    }
    blockLoadoutMutationInMultiplayerStaging();
    return;
  }

  const nextEntry = consumeLoadoutVaultEntry(entry);
  if (!nextEntry) return;

  if (list[index]) returnLoadoutEntryToVault(list[index], categoryKey);
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

function renderGunInventory() {
  const box = document.getElementById("gunInventory");
  if (!box) return;

  const entries = getFilteredLoadoutVaultEntries();
  const selectedCategory = selectedLoadoutItemContext?.categoryKey;
  box.innerHTML = "";
  updateLoadoutVaultChrome();

  if (!entries.length) {
    box.innerHTML = `
      <div class="loadout-vault-empty">
        <strong>No compatible vault equipment</strong>
        <span>Compatible spare gear will appear here.</span>
      </div>
    `;
    return;
  }

  entries.forEach(entry => {
    const compatible = selectedCategory === entry.categoryKey || !["guns", "attachments"].includes(selectedCategory);
    const btn = document.createElement("button");
    const selected = selectedLoadoutItemContext?.source === "available" &&
      selectedLoadoutItemContext.categoryKey === entry.categoryKey &&
      selectedLoadoutItemContext.key === entry.key &&
      selectedLoadoutItemContext.quality === entry.quality &&
      Number(selectedLoadoutItemContext.level || 1) === Number(entry.level || 1);
    btn.className = `inventory-icon-card hangar-equipment-card loadout-vault-row quality-${entry.quality} ${selected ? "selected" : ""}`;
    btn.dataset.itemKey = entry.key;
    btn.dataset.itemType = entry.categoryKey === "guns" ? "gun" : "attachment";
    btn.disabled = entry.count <= 0 || !compatible;
    btn.onclick = () => compatible && selectAvailableLoadoutItem(entry.categoryKey, entry);
    btn.removeAttribute("title");
    showHangarTooltip(btn, getEquipmentTooltipHtml(entry, entry.categoryKey));
    bindHangarEquipmentTooltip(btn);

    btn.innerHTML = `
      <img src="${entry.icon}" alt="${entry.name}">
      <span class="loadout-vault-row-copy">
        <strong>${escapeHtml(entry.name)}</strong>
        <small>${escapeHtml(titleCaseQuality(entry.quality))} / Lv ${formatNumber(entry.level || 1)}${entry.categoryKey === "attachments" ? " / Attachment" : ""}</small>
      </span>
      <b>x${formatNumber(entry.count)}</b>
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
    selectedShipyardShipId = getExchangeShips().find(ship => !ownedShips.includes(ship.id))?.id || currentShipId || (typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon");
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
  const visibleCount = Math.min(safeCount, 10);
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
      <img src="${typeof getShipAsset === "function" ? getShipAsset(ship.id, "large") : ship.image}" alt="${ship.name}">
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
    selectedShipyardShipId = getExchangeShips().find(ship => !ownedShips.includes(ship.id))?.id || currentShipId || (typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon");
  }

  box.innerHTML = "";

  getExchangeShips().forEach(ship => {
    const owned = ownedShips.includes(ship.id);
    const equipped = currentShipId === ship.id;
    const selected = selectedShipyardShipId === ship.id;
    const stats = getShipStats(ship.id);

    const card = document.createElement("button");
    const starterShipId = typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
    const isTutorialRequiredShip = tutorialState?.active && getCurrentTutorialStep()?.id === "buy-first-ship" && ship.id === starterShipId;
    card.className = `fleet-ship-card fleet-selector-card vessel-exchange-card exchange-vessel-card ${selected ? "selected" : ""} ${equipped ? "active" : ""} ${owned ? "owned" : ""} ${isTutorialRequiredShip ? "tutorial-required-ship" : ""}`;
    card.dataset.shipId = ship.id;
    if (ship.id === starterShipId) card.dataset.tutorialTarget = "firstShipCard";
    card.onclick = () => selectShipyardShip(ship.id);
    card.innerHTML = `
      <div class="fleet-card-badge">${equipped ? "In Use" : owned ? "Owned" : `CR ${formatNumber(ship.price)}`}</div>
      <div class="fleet-card-image-wrap">
        <img src="${typeof getShipAsset === "function" ? getShipAsset(ship.id, "medium") : ship.image}" alt="${ship.name}">
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
  return null;
}

function getStoreMaterialItems() {
  const shardDefinition = upgradeMaterialDefinitions?.lupenShards || {};
  return [
    {
      id: "material:lupenShard",
      kind: "material",
      key: "lupenShards",
      name: "Lupen Shard",
      category: "materials",
      image: shardDefinition.icon || "assets/items/lupen-shard.png",
      fixedQuality: "advanced",
      storeTier: "Forge Material",
      basePrice: 50,
      description: shardDefinition.description || "Charged Forge material used to raise item levels.",
      stats: [
        { label: "Use", value: "Forge upgrades" },
        { label: "Stored", value: "Materials" }
      ]
    },
    {
      id: "core:lupenCore",
      kind: "core",
      key: "lupenCore",
      name: "Lupen Core",
      category: "materials",
      image: "assets/items/lupen-core.png",
      fixedQuality: LUPEN_CORE_QUALITY,
      storeTier: "Rare Forge Material",
      basePrice: 150,
      description: "Rare Forge catalyst used to support quality upgrades.",
      stats: [
        { label: "Tier", value: "Rare catalyst" },
        { label: "Stored", value: "Vault item" }
      ]
    }
  ];
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

function ensureStoreSelection() {
  if (!["all", "guns", "attachments", "materials", "owned"].includes(storeFilter)) {
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
    { key: "materials", label: "Materials" },
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
    const priceLabel = soldOut ? "Sold Out" : `CR ${formatNumber(price)}`;

    return `
      <button class="store-catalog-card ${selectedStoreItemId === item.id ? "selected" : ""} ${item.dailyStock ? "daily-stock-card" : ""} ${soldOut ? "sold-out" : ""} quality-${quality}" data-item-key="${item.key}" data-item-kind="${item.kind}" onclick="selectStoreItem('${item.id}')">
        ${status ? `<span class="store-card-status">${status}</span>` : ""}
        <div class="store-card-art quality-${quality}">
          <img src="${item.kind === "ship" && typeof getShipAsset === "function" ? getShipAsset(item.key, "large") : item.image}" alt="${item.name}">
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
  if (item.kind === "material") return "Forge Material";
  if (item.kind === "core") return "Rare Catalyst";
  if (item.kind === "ship") return "Ship";
  return item.category || "";
}

function getStoreDetailKicker(item, quality = "standard") {
  if (!item) return "";
  if (item.kind === "material") return "Forge Material";
  if (item.kind === "core") return "Rare Catalyst";
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
    : item.kind === "material"
      ? inventoryCount
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
  const stagingEquipPending = multiplayerStagingLoadoutEquipPendingItemId === stagingStoreItemId;
  const stagingEquippableItem = stagingStoreLocked &&
    stagingWritableItem &&
    (item.kind === "gun" || item.kind === "attachment") &&
    totalOwned > 0;
  const stagingPreviewButton = stagingStoreItemId
    ? `<button class="store-detail-buy-action" data-item-key="${item.key}" data-item-kind="${item.kind}" onclick="storeBuySelected()" ${hasStock && !multiplayerStagingStorePurchasePending ? "" : "disabled"}>${hasStock ? (stagingWritableItem ? (multiplayerStagingStorePurchasePending ? "Pending..." : "Staging Purchase") : "Server Preview") : "Sold Out"}</button>`
    : `<button class="store-detail-buy-action" disabled>Server preview unavailable</button>`;

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
  if (isMultiplayerStagingStoreActive()) {
    const ship = SHIPS[shipId];
    if (ship && !ship.hiddenFromExchange && !ownedShips.includes(shipId) && getStagingStoreItemId({ kind: "ship", key: shipId })) {
      requestStagingStorePurchase({ kind: "ship", key: shipId });
      return;
    }
  }
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
  if (isMultiplayerStagingStoreActive()) {
    const ship = SHIPS[shipId];
    if (ship && !ship.hiddenFromExchange && ownedShips.includes(shipId) && currentShipId !== shipId && getStagingStoreItemId({ kind: "ship", key: shipId })) {
      requestStagingShipEquip({ kind: "ship", key: shipId });
      return;
    }
  }
  if (blockLoadoutMutationInMultiplayerStaging()) return;
  if (!ownedShips.includes(shipId)) return;

  currentShipId = shipId;
  selectedHangarShipId = shipId;
  selectedFleetShipId = shipId;
  applyShipStats(true);
  renderHangar();
  addHudToast(`${SHIPS[shipId]?.name || "Ship"} is ready to fly.`);
  saveGame();
}

