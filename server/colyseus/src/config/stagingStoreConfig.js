/* Static staging Store preview config.
   This catalogue is server-owned data for multiplayer Store validation.
   It covers current Map 1 Store guns, attachments, and the Vessel Exchange
   first-map ship path; it never allows unknown item ids,
   Store sell, loot writes, bounties, PvP/player damage, schema, or broad
   progression. */

const MAX_STORE_PURCHASE_QUANTITY = 5;

export const STAGING_STORE_ITEMS = Object.freeze([
  Object.freeze({
    itemId: "gun:pulseLaser",
    name: "Pulse Laser",
    category: "weapon",
    localKind: "gun",
    localKey: "pulseLaser",
    price: 748,
    levelRequirement: 1,
    stockType: "fixed",
    description: "Reliable all-round energy weapon with balanced output.",
    reference: "GUNS.pulseLaser"
  }),
  Object.freeze({
    itemId: "gun:ionBlaster",
    name: "Ion Blaster",
    category: "weapon",
    localKind: "gun",
    localKey: "ionBlaster",
    price: 746,
    levelRequirement: 2,
    stockType: "fixed",
    description: "Fast-firing ion weapon with light per-shot damage.",
    reference: "GUNS.ionBlaster"
  }),
  Object.freeze({
    itemId: "gun:heavyLance",
    name: "Heavy Lance",
    category: "weapon",
    localKind: "gun",
    localKey: "heavyLance",
    price: 1001,
    levelRequirement: 3,
    stockType: "fixed",
    description: "High-impact precision beam for slow, heavy shots.",
    reference: "GUNS.heavyLance"
  }),
  Object.freeze({
    itemId: "attachment:cargoPod",
    name: "Cargo Pod",
    category: "equipment",
    localKind: "attachment",
    localKey: "cargoPod",
    price: 220,
    levelRequirement: 0,
    stockType: "fixed",
    description: "+25 cargo capacity",
    reference: "attachments.cargoPod"
  }),
  Object.freeze({
    itemId: "attachment:jumpDrive",
    name: "Jump Drive",
    category: "equipment",
    localKind: "attachment",
    localKey: "jumpDrive",
    price: 340,
    levelRequirement: 0,
    stockType: "fixed",
    description: "Improves jump system recovery.",
    reference: "attachments.jumpDrive"
  }),
  Object.freeze({
    itemId: "ship:falcon",
    name: "Azure Striker",
    category: "ship",
    localKind: "ship",
    localKey: "falcon",
    price: 0,
    levelRequirement: 0,
    stockType: "fixed",
    description: "A nimble first-map striker with twin forward mounts, clean jump recovery and enough cargo room for early trade runs.",
    reference: "SHIPS.falcon"
  }),
  Object.freeze({
    itemId: "ship:bison",
    name: "Buu Hauler",
    category: "ship",
    localKind: "ship",
    localKey: "bison",
    price: 12000,
    levelRequirement: 0,
    stockType: "fixed",
    description: "A broad early hauler with steady plating, useful cargo volume and a single defensive weapon bank.",
    reference: "SHIPS.bison"
  }),
  Object.freeze({
    itemId: "ship:monolith",
    name: "Majin Vindicator",
    category: "ship",
    localKind: "ship",
    localKey: "monolith",
    price: 48000,
    levelRequirement: 0,
    stockType: "fixed",
    description: "A costly first-map heavy fighter with strong armor, six compact hardpoints and limited utility space.",
    reference: "SHIPS.monolith"
  }),
  Object.freeze({
    itemId: "ship:zeusExplorer",
    name: "Nightshade Hawk",
    category: "ship",
    localKind: "ship",
    localKey: "zeusExplorer",
    price: 22000,
    levelRequirement: 0,
    stockType: "fixed",
    description: "A fast black-crystal scout built for quick jumps, high evasion and a flexible three-gun skirmish loadout.",
    reference: "SHIPS.zeusExplorer"
  }),
  Object.freeze({
    itemId: "ship:hephaestusTrader",
    name: "Champa Carrier",
    category: "ship",
    localKind: "ship",
    localKey: "hephaestusTrader",
    price: 34000,
    levelRequirement: 0,
    stockType: "fixed",
    description: "A utility-rich carrier with big service tanks, six attachment slots and enough guns to discourage light raiders.",
    reference: "SHIPS.hephaestusTrader"
  }),
  Object.freeze({
    itemId: "ship:poseidonAggressor",
    name: "Silver Instinct",
    category: "ship",
    localKind: "ship",
    localKey: "poseidonAggressor",
    price: 42000,
    levelRequirement: 0,
    stockType: "fixed",
    description: "A premium assault hull with five weapon mounts, sharp evasion and a lighter hold than the trade-focused ships.",
    reference: "SHIPS.poseidonAggressor"
  }),
]);

export const STAGING_STORE_ITEM_IDS = Object.freeze(STAGING_STORE_ITEMS.map((item) => item.itemId));

export function getStagingStoreItemIds() {
  return [...STAGING_STORE_ITEM_IDS];
}

function getFiniteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clampInteger(value, min, max) {
  const number = getFiniteNumber(value);
  if (number === null) return null;
  return Math.max(min, Math.min(max, Math.floor(number)));
}

function normalizePurchaseQuantity(value) {
  const number = getFiniteNumber(value);
  if (number === null) return null;
  const integer = Math.floor(number);
  if (integer < 1 || integer > MAX_STORE_PURCHASE_QUANTITY) return null;
  return integer;
}

function getWriteFlags() {
  return {
    creditsWritten: false,
    inventoryWritten: false,
    materialWritten: false,
    shipWritten: false,
    equipmentWritten: false,
    saveWritten: false,
    lootWritten: false,
    bountyWritten: false
  };
}

function getUnknownValidation(reason = "unknown_player_state") {
  return {
    validationMode: "unknown",
    trustedStateAvailable: false,
    snapshotUsed: false,
    creditsAvailable: null,
    creditsBefore: null,
    creditsAfterPreview: null,
    blockReason: reason,
    userReason: "Player state unavailable; showing Store price preview only."
  };
}

function sanitizeSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return getUnknownValidation();
  const creditsAvailable = clampInteger(snapshot.credits, 0, 999999999);
  if (creditsAvailable === null) return getUnknownValidation();
  return {
    validationMode: "snapshot",
    trustedStateAvailable: false,
    snapshotUsed: true,
    creditsAvailable,
    creditsBefore: creditsAvailable,
    creditsAfterPreview: null,
    blockReason: null,
    userReason: "Dry run valid."
  };
}

function sanitizeTrustedState(trustedState) {
  const creditsAvailable = clampInteger(trustedState?.validationState?.credits, 0, 999999999);
  if (!trustedState?.available || creditsAvailable === null) return null;
  return {
    validationMode: "trusted_save",
    trustedStateAvailable: true,
    snapshotUsed: false,
    creditsAvailable,
    creditsBefore: creditsAvailable,
    creditsAfterPreview: null,
    blockReason: null,
    userReason: "Dry run valid."
  };
}

export function getStagingStoreItems() {
  return STAGING_STORE_ITEMS.map((item) => ({ ...item }));
}

export function getStagingStoreItemById(itemId = "") {
  const safeItemId = String(itemId || "").trim();
  const item = STAGING_STORE_ITEMS.find((entry) => entry.itemId === safeItemId);
  return item ? { ...item } : null;
}

export function getStagingStoreItemByLocalRef(localKind = "", localKey = "") {
  const safeKind = String(localKind || "").trim();
  const safeKey = String(localKey || "").trim();
  const item = STAGING_STORE_ITEMS.find((entry) => entry.localKind === safeKind && entry.localKey === safeKey);
  return item ? { ...item } : null;
}

export function buildStagingStorePurchasePreview({
  itemId = "",
  quantity = 1,
  playerSnapshot = null,
  trustedState = null
} = {}) {
  const item = getStagingStoreItemById(itemId);
  const safeQuantity = normalizePurchaseQuantity(quantity);

  if (!item) {
    return {
      ok: false,
      mode: "dry_run",
      operation: "purchase",
      applied: false,
      itemId: String(itemId || ""),
      quantity: safeQuantity || 0,
      wouldPass: false,
      validationMode: "unknown",
      blockReason: "unknown_store_item",
      userReason: "Server preview unavailable for this Store item.",
      writes: getWriteFlags(),
      ...getWriteFlags()
    };
  }

  if (safeQuantity === null || safeQuantity < 1) {
    return {
      ok: false,
      mode: "dry_run",
      operation: "purchase",
      applied: false,
      ...item,
      quantity: 0,
      unitPrice: item.price,
      totalCost: 0,
      wouldPass: false,
      validationMode: "unknown",
      blockReason: "invalid_store_quantity",
      userReason: "Choose a valid Store quantity.",
      writes: getWriteFlags(),
      ...getWriteFlags()
    };
  }

  const trusted = sanitizeTrustedState(trustedState);
  const snapshot = sanitizeSnapshot(playerSnapshot);
  const validation = trusted || (snapshot.validationMode === "snapshot" ? snapshot : getUnknownValidation());
  const unitPrice = clampInteger(item.price, 0, 999999999) || 0;
  const totalCost = unitPrice * safeQuantity;
  const creditsAvailable = validation.creditsAvailable;
  const enoughCredits = creditsAvailable === null ? null : creditsAvailable >= totalCost;
  const wouldPass = enoughCredits === true;
  const blockReason = validation.blockReason || (enoughCredits === false ? "insufficient_credits" : null);

  return {
    ok: wouldPass,
    mode: "dry_run",
    operation: "purchase",
    applied: false,
    itemId: item.itemId,
    name: item.name,
    category: item.category,
    localKind: item.localKind,
    localKey: item.localKey,
    stockType: item.stockType,
    description: item.description,
    reference: item.reference,
    levelRequirement: item.levelRequirement,
    quantity: safeQuantity,
    unitPrice,
    totalCost,
    creditsAvailable,
    creditsBefore: creditsAvailable,
    creditsAfterPreview: creditsAvailable === null ? null : Math.max(0, creditsAvailable - totalCost),
    wouldPass,
    validationMode: validation.validationMode,
    trustedStateAvailable: validation.trustedStateAvailable,
    snapshotUsed: validation.snapshotUsed,
    blockReason,
    userReason: wouldPass
      ? "Would pass server Store validation."
      : blockReason === "insufficient_credits"
        ? "Blocked: not enough credits."
        : validation.userReason,
    writes: getWriteFlags(),
    ...getWriteFlags()
  };
}
