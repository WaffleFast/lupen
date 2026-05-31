/* Read-only staging player save preview service.
   This supports future multiplayer reward application previews without
   mutating player_saves, XP, credits, inventory, bounties, loot, or
   progression. It returns sanitized summary fields only. */

function getStringValue(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function getNumberOrNull(...values) {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number)) return number;
  }
  return null;
}

function getIntegerOrNull(...values) {
  const number = getNumberOrNull(...values);
  return number === null ? null : Math.round(number);
}

function getLootList(value) {
  return Array.isArray(value)
    ? value.map((item) => getStringValue(item)).filter(Boolean)
    : [];
}

function getSupabaseConfig(env = process.env) {
  return {
    url: getStringValue(env.SUPABASE_URL),
    serviceRoleKey: getStringValue(env.SUPABASE_SERVICE_ROLE_KEY)
  };
}

function getValidSupabaseUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    return parsed.toString().replace(/\/$/, "");
  } catch (_err) {
    return "";
  }
}

function getPlayerSaveReadUrl(url, playerId) {
  const safePlayerId = encodeURIComponent(playerId);
  return `${url.replace(/\/$/, "")}/rest/v1/player_saves?select=save_data,updated_at&user_id=eq.${safePlayerId}&limit=1`;
}

function extractSaveData(rowOrSave = {}) {
  if (rowOrSave?.save_data && typeof rowOrSave.save_data === "object") return rowOrSave.save_data;
  if (rowOrSave?.game && typeof rowOrSave.game === "object") return rowOrSave.game;
  return rowOrSave && typeof rowOrSave === "object" ? rowOrSave : {};
}

function summarizeSaveData(saveData = {}, updatedAt = "") {
  const progress = saveData.playerProgress && typeof saveData.playerProgress === "object"
    ? saveData.playerProgress
    : {};
  const inventoryItems = Array.isArray(saveData.inventoryItems) ? saveData.inventoryItems : [];

  return {
    xp: getIntegerOrNull(progress.combatXp, progress.xp, progress.totalXp, saveData.combatXp, saveData.xp),
    credits: getIntegerOrNull(saveData.credits),
    level: getIntegerOrNull(progress.level, saveData.level),
    inventoryCount: inventoryItems.length,
    updatedAt: getStringValue(updatedAt || saveData.updated_at || saveData.savedAt)
  };
}

export async function fetchPlayerSavePreviewContext(playerId, options = {}) {
  const safePlayerId = getStringValue(playerId);
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const config = getSupabaseConfig(env);

  if (!safePlayerId) {
    return {
      ok: false,
      available: false,
      reason: "missing_player_id",
      playerId: "",
      saveSummary: null
    };
  }

  if (!config.url || !config.serviceRoleKey) {
    return {
      ok: false,
      available: false,
      reason: "supabase_config_missing",
      playerId: safePlayerId,
      saveSummary: null
    };
  }

  if (typeof fetchImpl !== "function") {
    return {
      ok: false,
      available: false,
      reason: "fetch_unavailable",
      playerId: safePlayerId,
      saveSummary: null
    };
  }

  const supabaseUrl = getValidSupabaseUrl(config.url);
  if (!supabaseUrl) {
    return {
      ok: false,
      available: false,
      reason: "invalid_supabase_url",
      playerId: safePlayerId,
      saveSummary: null
    };
  }

  try {
    const response = await fetchImpl(getPlayerSaveReadUrl(supabaseUrl, safePlayerId), {
      method: "GET",
      headers: {
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${config.serviceRoleKey}`,
        accept: "application/json"
      }
    });

    if (!response?.ok) {
      return {
        ok: false,
        available: false,
        reason: "save_read_failed",
        status: Number(response?.status || 0),
        playerId: safePlayerId,
        saveSummary: null
      };
    }

    const rows = typeof response.json === "function" ? await response.json() : [];
    const row = Array.isArray(rows) ? rows[0] : rows;
    if (!row) {
      return {
        ok: true,
        available: false,
        reason: "save_missing",
        status: response.status || 200,
        playerId: safePlayerId,
        saveSummary: null
      };
    }

    return {
      ok: true,
      available: true,
      reason: "",
      status: response.status || 200,
      playerId: safePlayerId,
      saveSummary: summarizeSaveData(extractSaveData(row), row.updated_at)
    };
  } catch (_err) {
    return {
      ok: false,
      available: false,
      reason: "fetch_failed",
      status: 0,
      playerId: safePlayerId,
      saveSummary: null
    };
  }
}

export function buildProgressionPreview(currentSaveContext = {}, rewardApplicationPlan = {}) {
  const saveSummary = currentSaveContext?.saveSummary || null;
  const xpDelta = Math.max(0, Math.round(Number(rewardApplicationPlan?.xpDelta || 0)));
  const creditsDelta = Math.max(0, Math.round(Number(rewardApplicationPlan?.creditsDelta || 0)));
  const currentXp = getIntegerOrNull(saveSummary?.xp);
  const currentCredits = getIntegerOrNull(saveSummary?.credits);
  const available = currentSaveContext?.available === true;

  return {
    available,
    reason: available ? "" : getStringValue(currentSaveContext?.reason, "save_preview_unavailable"),
    playerId: getStringValue(rewardApplicationPlan?.playerId || currentSaveContext?.playerId),
    currentXp,
    previewXp: currentXp === null ? null : currentXp + xpDelta,
    xpDelta,
    currentCredits,
    previewCredits: currentCredits === null ? null : currentCredits + creditsDelta,
    creditsDelta,
    currentLevel: getIntegerOrNull(saveSummary?.level),
    inventoryCount: getIntegerOrNull(saveSummary?.inventoryCount),
    intendedLootAdditions: getLootList(rewardApplicationPlan?.lootAdditions),
    applied: false,
    dryRun: true,
    progressionWritesEnabled: false,
    savedAt: getStringValue(saveSummary?.updatedAt)
  };
}

export const PlayerSavePreviewService = Object.freeze({
  fetchPlayerSavePreviewContext,
  buildProgressionPreview
});
