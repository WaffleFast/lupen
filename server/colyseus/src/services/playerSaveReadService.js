/* Read-only player_saves helpers for staging trade dry-runs.
   This service uses the Supabase service role only on the Colyseus server,
   never writes player_saves, and returns sanitized trade validation fields
   instead of raw save snapshots. */

const PLAYER_SAVES_TABLE = "player_saves";
const CARGO_KEYS = Object.freeze([
  "Iron",
  "Copper",
  "Cobalt",
  "Titanium",
  "Crystal Shards",
  "Xenon Gas",
  "Iridium",
  "Platinum",
  "Uranium",
  "Dark Matter Residue"
]);

const STAGING_SHIP_CARGO = Object.freeze({
  lupenOrigin: 150,
  lupenHauler: 260,
  lupenStriker: 100,
  hermesCourier: 190,
  athenaSentinel: 140,
  aresVindicator: 90,
  hephaestusTrader: 360,
  poseidonAggressor: 120,
  zeusExplorer: 220
});

const CARGO_POD_CARGO_BONUS = 25;

function getString(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
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

function getSupabaseConfig(env = process.env) {
  return {
    url: getString(env.SUPABASE_URL),
    serviceRoleKey: getString(env.SUPABASE_SERVICE_ROLE_KEY)
  };
}

function getValidSupabaseUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
    return parsed.toString().replace(/\/$/, "");
  } catch (_err) {
    return null;
  }
}

function getPlayerSaveReadUrl(baseUrl, playerId) {
  const query = new URLSearchParams({
    select: "save_data,updated_at",
    user_id: `eq.${playerId}`,
    limit: "1"
  });
  return `${baseUrl}/rest/v1/${PLAYER_SAVES_TABLE}?${query.toString()}`;
}

function getSaveDataFromRow(row) {
  const saveData = row?.save_data;
  return saveData && typeof saveData === "object" && !Array.isArray(saveData)
    ? saveData
    : null;
}

function getCargoUsedFromSave(saveData) {
  const cargo = saveData?.cargo;
  if (!cargo || typeof cargo !== "object" || Array.isArray(cargo)) return null;

  return CARGO_KEYS.reduce((total, key) => {
    const amount = clampInteger(cargo[key], 0, 999999);
    return total + (amount || 0);
  }, 0);
}

function getCargoByResourceFromSave(saveData) {
  const cargo = saveData?.cargo;
  if (!cargo || typeof cargo !== "object" || Array.isArray(cargo)) return null;

  return CARGO_KEYS.reduce((summary, key) => {
    summary[key] = clampInteger(cargo[key], 0, 999999) || 0;
    return summary;
  }, {});
}

function getCargoCostBasisByResourceFromSave(saveData) {
  const cargoCostBasis = saveData?.cargoCostBasis;
  if (!cargoCostBasis || typeof cargoCostBasis !== "object" || Array.isArray(cargoCostBasis)) return null;

  return CARGO_KEYS.reduce((summary, key) => {
    summary[key] = clampInteger(cargoCostBasis[key], 0, 999999999) || 0;
    return summary;
  }, {});
}

function normalizeLoadoutEntry(entry) {
  if (typeof entry === "string") return { key: entry };
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const key = getString(entry.key);
  return key ? { key } : null;
}

function getCargoPodCountFromLoadout(loadout) {
  const attachments = Array.isArray(loadout?.attachments) ? loadout.attachments : [];
  return attachments.reduce((count, entry) => {
    const normalized = normalizeLoadoutEntry(entry);
    return count + (normalized?.key === "cargoPod" ? 1 : 0);
  }, 0);
}

function getTrustedCargoCapacityFromShipLoadout(saveData) {
  const savedShipId = getString(saveData?.currentShipId)
    || getString(saveData?.selectedFleetShipId)
    || getString(saveData?.selectedHangarShipId);
  const shipCargo = STAGING_SHIP_CARGO[savedShipId];
  if (!savedShipId || shipCargo === undefined) return null;

  const ownedShips = Array.isArray(saveData?.ownedShips) ? saveData.ownedShips : [];
  if (ownedShips.length && !ownedShips.includes(savedShipId)) return null;

  const shipLoadouts = saveData?.shipLoadouts;
  const loadout = shipLoadouts && typeof shipLoadouts === "object" && !Array.isArray(shipLoadouts)
    ? shipLoadouts[savedShipId]
    : null;
  const cargoPodCount = getCargoPodCountFromLoadout(loadout);
  return shipCargo + cargoPodCount * CARGO_POD_CARGO_BONUS;
}

function getTrustedCargoCapacityFromSave(saveData) {
  const candidates = [
    saveData?.cargoCapacity,
    saveData?.shipStats?.cargo,
    saveData?.currentShipStats?.cargo,
    saveData?.ship?.cargo
  ];

  for (const candidate of candidates) {
    const capacity = clampInteger(candidate, 0, 999999);
    if (capacity !== null) return capacity;
  }

  // The browser save does not normally persist a flat cargoCapacity field.
  // Derive it from trusted save-owned ship/loadout fields using the same
  // narrow staging ship + Cargo Pod rules used by loadout writes.
  return getTrustedCargoCapacityFromShipLoadout(saveData);
}

function unavailable(reason, extra = {}) {
  return {
    ok: false,
    available: false,
    trustedStateAvailable: false,
    reason,
    status: null,
    validationState: null,
    stateSources: {
      credits: "unknown",
      cargoUsed: "unknown",
      cargoCapacity: "unknown"
    },
    ...extra
  };
}

export function extractTradeValidationStateFromSave(saveData) {
  if (!saveData || typeof saveData !== "object" || Array.isArray(saveData)) {
    return unavailable("save_data_missing_or_invalid");
  }

  const credits = clampInteger(saveData.credits, 0, 999999999);
  const cargoUsed = getCargoUsedFromSave(saveData);
  const cargoByResource = getCargoByResourceFromSave(saveData);
  const cargoCostBasisByResource = getCargoCostBasisByResourceFromSave(saveData);
  const cargoCapacity = getTrustedCargoCapacityFromSave(saveData);
  const cargoCapacitySource = cargoCapacity === null
    ? "unknown"
    : (clampInteger(saveData?.cargoCapacity, 0, 999999) !== null ||
      clampInteger(saveData?.shipStats?.cargo, 0, 999999) !== null ||
      clampInteger(saveData?.currentShipStats?.cargo, 0, 999999) !== null ||
      clampInteger(saveData?.ship?.cargo, 0, 999999) !== null
      ? "trusted_save"
      : "trusted_save_derived");

  if (credits === null || cargoUsed === null || !cargoByResource || !cargoCostBasisByResource) {
    return unavailable("trade_state_missing_or_invalid");
  }

  return {
    ok: true,
    available: true,
    trustedStateAvailable: true,
    reason: "",
    status: 200,
    validationState: {
      credits,
      cargoUsed,
      cargoByResource,
      cargoCostBasisByResource,
      cargoCapacity
    },
    stateSources: {
      credits: "trusted_save",
      cargoUsed: "trusted_save",
      cargoCapacity: cargoCapacitySource
    }
  };
}

export async function fetchPlayerTradeValidationState(identity = {}, options = {}) {
  const playerId = getString(identity.trustedPlayerId || identity.playerId || identity);
  const authStatus = getString(identity.authStatus, typeof identity === "string" ? "verified" : "guest");

  if (authStatus !== "verified" || !playerId) {
    return unavailable("verified_identity_required", {
      playerId: "",
      status: 0
    });
  }

  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const config = getSupabaseConfig(env);
  const baseUrl = getValidSupabaseUrl(config.url);

  if (!baseUrl || !config.serviceRoleKey || typeof fetchImpl !== "function") {
    return unavailable("supabase_config_missing", {
      playerId,
      status: 0
    });
  }

  try {
    const response = await fetchImpl(getPlayerSaveReadUrl(baseUrl, playerId), {
      method: "GET",
      headers: {
        apikey: config.serviceRoleKey,
        Authorization: `Bearer ${config.serviceRoleKey}`
      }
    });

    const status = Number(response?.status || 0);
    if (!response?.ok) {
      return unavailable("player_save_read_failed", {
        playerId,
        status
      });
    }

    const rows = await response.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    const saveData = getSaveDataFromRow(row);
    if (!saveData) {
      return unavailable("save_missing", {
        ok: true,
        playerId,
        status
      });
    }

    const extracted = extractTradeValidationStateFromSave(saveData);
    return {
      ...extracted,
      playerId,
      status,
      updatedAt: getString(row?.updated_at),
      rawSaveData: saveData
    };
  } catch (_err) {
    return unavailable("player_save_read_failed", {
      playerId,
      status: 0
    });
  }
}
