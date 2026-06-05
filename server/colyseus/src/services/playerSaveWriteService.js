/* Staging player_saves XP-only patch adapter.
   This is the future real progression write path, but it is disabled by
   default and fail-closed. It supports XP only for the current staging
   sprint and never applies credits, loot, inventory, bounties, cargo,
   equipment, or ship changes. */

const MAX_STAGING_XP_DELTA = 500;

function getStringValue(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function getNumberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getIntegerValue(value, fallback = 0) {
  return Math.round(getNumberValue(value, fallback));
}

function clampInteger(value, min, max) {
  return Math.max(min, Math.min(max, getIntegerValue(value, min)));
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
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

function getPlayerSaveUrl(url, playerId) {
  const safePlayerId = encodeURIComponent(playerId);
  return `${url.replace(/\/$/, "")}/rest/v1/player_saves?user_id=eq.${safePlayerId}`;
}

function getPlayerSaveReadUrl(url, playerId) {
  return `${getPlayerSaveUrl(url, playerId)}&select=save_data,updated_at&limit=1`;
}

function getValueAtPath(source = {}, path = []) {
  return path.reduce((current, key) => {
    if (!current || typeof current !== "object") return undefined;
    return current[key];
  }, source);
}

function resolveNumericPath(saveData = {}, candidatePaths = []) {
  const matches = candidatePaths
    .map((path) => ({
      path,
      value: getValueAtPath(saveData, path)
    }))
    .filter((candidate) => Number.isFinite(Number(candidate.value)));

  return matches.length === 1 ? matches[0] : null;
}

function setValueAtPath(source = {}, path = [], value) {
  const copy = cloneJson(source);
  let cursor = copy;
  path.slice(0, -1).forEach((key) => {
    cursor = cursor[key];
  });
  cursor[path[path.length - 1]] = value;
  return copy;
}

function setCombatXpOnly(source = {}, xpAfter = 0) {
  const updated = setValueAtPath(source, ["playerProgress", "combatXp"], xpAfter);
  const progress = updated.playerProgress && typeof updated.playerProgress === "object"
    ? updated.playerProgress
    : {};
  const zoneCombatXp = progress.zoneCombatXp && typeof progress.zoneCombatXp === "object"
    ? { ...progress.zoneCombatXp }
    : {};

  // Mirror the normal browser XP shape for the Pilot Profile/progression UI.
  // This remains an XP-only staging patch: no credits, loot, bounties, cargo,
  // inventory, equipment, or broader progression fields are changed.
  const zoneKey = "sector-one";
  const previousCombatXp = getIntegerValue(source?.playerProgress?.combatXp, 0);
  const xpDelta = Math.max(0, getIntegerValue(xpAfter, 0) - previousCombatXp);
  zoneCombatXp[zoneKey] = Number.isFinite(Number(zoneCombatXp[zoneKey]))
    ? Math.max(0, getIntegerValue(zoneCombatXp[zoneKey], 0) + xpDelta)
    : Math.max(0, getIntegerValue(xpAfter, 0));
  updated.playerProgress = {
    ...progress,
    zoneCombatXp
  };

  return updated;
}

function getIdempotencyKey(playerId, sourceEventId, sourceLedgerId) {
  const sourceKey = sourceEventId || sourceLedgerId;
  return playerId && sourceKey ? `${playerId}:${sourceKey}` : "";
}

function getStagingProgressionWriteAllowlist(env = process.env) {
  return getStringValue(env.STAGING_PROGRESSION_WRITE_ALLOWLIST)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function getProgressionWriteScope(env = process.env) {
  const scope = getStringValue(env.STAGING_PROGRESSION_WRITE_SCOPE, "allowlist").toLowerCase();
  return scope === "verified" ? "verified" : "allowlist";
}

export function isProgressionWriteEnabled(env = process.env) {
  return String(env.ENABLE_STAGING_PROGRESSION_WRITES || "").toLowerCase() === "true";
}

function getAllowlistStatus(playerId, env = process.env) {
  const allowlist = getStagingProgressionWriteAllowlist(env);
  const normalizedPlayerId = getStringValue(playerId);
  const progressionWriteScope = getProgressionWriteScope(env);
  const playerInStagingWriteAllowlist = !!normalizedPlayerId && allowlist.includes(normalizedPlayerId);
  const verifiedScopeEnabled = progressionWriteScope === "verified";

  return {
    progressionWriteScope,
    verifiedScopeEnabled,
    stagingWriteAllowlistPresent: allowlist.length > 0,
    playerInStagingWriteAllowlist,
    playerAllowedForStagingWrite: verifiedScopeEnabled ? !!normalizedPlayerId : playerInStagingWriteAllowlist
  };
}

function getSaveDataFromRow(row = {}) {
  return row?.save_data && typeof row.save_data === "object" ? row.save_data : null;
}

async function fetchPlayerSaveRow(supabaseUrl, playerId, config, fetchImpl) {
  const response = await fetchImpl(getPlayerSaveReadUrl(supabaseUrl, playerId), {
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
      skippedReason: "player_save_read_failed",
      status: Number(response?.status || 0),
      row: null
    };
  }

  const rows = typeof response.json === "function" ? await response.json() : [];
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) {
    return {
      ok: false,
      skippedReason: "player_save_missing",
      status: response.status || 200,
      row: null
    };
  }

  return {
    ok: true,
    skippedReason: "",
    status: response.status || 200,
    row
  };
}

async function patchPlayerSaveData(supabaseUrl, playerId, saveData, config, fetchImpl) {
  const response = await fetchImpl(getPlayerSaveUrl(supabaseUrl, playerId), {
    method: "PATCH",
    headers: {
      apikey: config.serviceRoleKey,
      authorization: `Bearer ${config.serviceRoleKey}`,
      "content-type": "application/json",
      prefer: "return=representation"
    },
    body: JSON.stringify({
      save_data: saveData
    })
  });

  if (!response?.ok) {
    return {
      ok: false,
      skippedReason: "player_save_patch_failed",
      status: Number(response?.status || 0)
    };
  }

  return {
    ok: true,
    skippedReason: "",
    status: response.status || 200
  };
}

export function buildPlayerSavePatchPlan(currentSaveData = {}, rewardApplicationPlan = {}, context = {}) {
  const playerId = getStringValue(rewardApplicationPlan.playerId || context.playerId);
  const sourceEventId = getStringValue(rewardApplicationPlan.sourceEventId || context.sourceEventId);
  const sourceLedgerId = getStringValue(rewardApplicationPlan.sourceLedgerId || context.sourceLedgerId);
  const duplicateDetected = context.duplicateDetected === true || rewardApplicationPlan.duplicateDetected === true;
  const idempotencyKey = getIdempotencyKey(playerId, sourceEventId, sourceLedgerId);
  const xpDelta = clampInteger(rewardApplicationPlan.xpDelta, 0, MAX_STAGING_XP_DELTA);
  const creditsDelta = 0;
  const xpMatch = resolveNumericPath(currentSaveData, [
    ["playerProgress", "combatXp"]
  ]);
  const creditsMatch = resolveNumericPath(currentSaveData, [
    ["credits"]
  ]);
  const eligible = rewardApplicationPlan.eligible === true &&
    rewardApplicationPlan.authStatus === "verified" &&
    !!playerId;
  const blockedReason = !eligible
    ? "reward_application_not_eligible"
    : !idempotencyKey
      ? "idempotency_not_ready"
      : duplicateDetected
        ? "duplicate_reward_application"
        : !xpMatch
          ? "xp_path_missing_or_ambiguous"
          : "";

  return {
    playerId: eligible ? playerId : "",
    sourceEventId,
    sourceLedgerId,
    idempotencyKey: eligible ? idempotencyKey : "",
    idempotencyReady: eligible && !!idempotencyKey,
    duplicateDetected,
    xpPath: xpMatch?.path?.join(".") || "",
    creditsPath: creditsMatch?.path?.join(".") || "",
    xpDelta,
    creditsDelta,
    xpBefore: xpMatch ? getIntegerValue(xpMatch.value, 0) : null,
    xpAfter: xpMatch ? getIntegerValue(xpMatch.value, 0) + xpDelta : null,
    creditsBefore: creditsMatch ? getIntegerValue(creditsMatch.value, 0) : null,
    creditsAfter: creditsMatch ? getIntegerValue(creditsMatch.value, 0) + creditsDelta : null,
    lootPreviewOnly: Array.isArray(rewardApplicationPlan.lootAdditions) ? rewardApplicationPlan.lootAdditions.length : 0,
    eligible: !blockedReason,
    skippedReason: blockedReason,
    progressionWritesEnabled: false,
    progressionWriteScope: "allowlist",
    verifiedScopeEnabled: false,
    stagingWriteAllowlistPresent: false,
    playerInStagingWriteAllowlist: false,
    playerAllowedForStagingWrite: false,
    applied: false,
    dryRun: true
  };
}

export async function applyPlayerSavePatchPlan(plan = {}, options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const allowlistStatus = getAllowlistStatus(plan?.playerId, env);
  const progressionWritesEnabled = isProgressionWriteEnabled(env);

  if (!progressionWritesEnabled) {
    return {
      ok: true,
      applied: false,
      dryRun: true,
      progressionWritesEnabled: false,
      idempotencyKey: getStringValue(plan?.idempotencyKey),
      idempotencyReady: plan?.idempotencyReady === true,
      duplicateDetected: plan?.duplicateDetected === true,
      ...allowlistStatus,
      skippedReason: plan?.duplicateDetected ? "duplicate_reward_application" : "progression_writes_disabled",
      plan
    };
  }

  if (!plan?.eligible || !plan?.playerId) {
    return {
      ok: false,
      applied: false,
      dryRun: true,
      progressionWritesEnabled: true,
      idempotencyKey: getStringValue(plan?.idempotencyKey),
      idempotencyReady: plan?.idempotencyReady === true,
      duplicateDetected: plan?.duplicateDetected === true,
      ...allowlistStatus,
      skippedReason: plan?.skippedReason || "reward_application_not_eligible",
      plan
    };
  }

  if (plan.duplicateDetected) {
    return {
      ok: false,
      applied: false,
      dryRun: true,
      progressionWritesEnabled: true,
      idempotencyKey: getStringValue(plan.idempotencyKey),
      idempotencyReady: plan.idempotencyReady === true,
      duplicateDetected: true,
      ...allowlistStatus,
      skippedReason: "duplicate_reward_application",
      plan
    };
  }

  if (!plan.idempotencyReady || !plan.idempotencyKey) {
    return {
      ok: false,
      applied: false,
      dryRun: true,
      progressionWritesEnabled: true,
      idempotencyKey: getStringValue(plan.idempotencyKey),
      idempotencyReady: false,
      duplicateDetected: false,
      ...allowlistStatus,
      skippedReason: "idempotency_not_ready",
      plan
    };
  }

  if (allowlistStatus.progressionWriteScope !== "verified" && !allowlistStatus.stagingWriteAllowlistPresent) {
    return {
      ok: false,
      applied: false,
      dryRun: true,
      progressionWritesEnabled: true,
      idempotencyKey: getStringValue(plan.idempotencyKey),
      idempotencyReady: true,
      duplicateDetected: false,
      ...allowlistStatus,
      skippedReason: "staging_write_allowlist_missing",
      plan
    };
  }

  if (!allowlistStatus.playerAllowedForStagingWrite) {
    return {
      ok: false,
      applied: false,
      dryRun: true,
      progressionWritesEnabled: true,
      idempotencyKey: getStringValue(plan.idempotencyKey),
      idempotencyReady: true,
      duplicateDetected: false,
      ...allowlistStatus,
      skippedReason: allowlistStatus.progressionWriteScope === "verified"
        ? "verified_player_missing"
        : "player_not_in_staging_write_allowlist",
      plan
    };
  }

  const config = getSupabaseConfig(env);
  if (!config.url || !config.serviceRoleKey) {
    return {
      ok: false,
      applied: false,
      dryRun: true,
      progressionWritesEnabled: true,
      idempotencyKey: getStringValue(plan.idempotencyKey),
      idempotencyReady: true,
      duplicateDetected: false,
      ...allowlistStatus,
      skippedReason: "supabase_config_missing",
      plan
    };
  }

  if (typeof fetchImpl !== "function") {
    return {
      ok: false,
      applied: false,
      dryRun: true,
      progressionWritesEnabled: true,
      idempotencyKey: getStringValue(plan.idempotencyKey),
      idempotencyReady: true,
      duplicateDetected: false,
      ...allowlistStatus,
      skippedReason: "fetch_unavailable",
      plan
    };
  }

  const supabaseUrl = getValidSupabaseUrl(config.url);
  if (!supabaseUrl) {
    return {
      ok: false,
      applied: false,
      dryRun: true,
      progressionWritesEnabled: true,
      idempotencyKey: getStringValue(plan.idempotencyKey),
      idempotencyReady: true,
      duplicateDetected: false,
      ...allowlistStatus,
      skippedReason: "invalid_supabase_url",
      plan
    };
  }

  try {
    const saveRead = await fetchPlayerSaveRow(supabaseUrl, plan.playerId, config, fetchImpl);
    if (!saveRead.ok) {
      return {
        ok: false,
        applied: false,
        dryRun: true,
        progressionWritesEnabled: true,
        idempotencyKey: getStringValue(plan.idempotencyKey),
        idempotencyReady: true,
        duplicateDetected: false,
        ...allowlistStatus,
        skippedReason: saveRead.skippedReason,
        status: saveRead.status,
        plan
      };
    }

    const saveData = getSaveDataFromRow(saveRead.row);
    if (!saveData) {
      return {
        ok: false,
        applied: false,
        dryRun: true,
        progressionWritesEnabled: true,
        idempotencyKey: getStringValue(plan.idempotencyKey),
        idempotencyReady: true,
        duplicateDetected: false,
        ...allowlistStatus,
        skippedReason: "save_data_missing_or_invalid",
        status: saveRead.status,
        plan
      };
    }

    const refreshedPlan = buildPlayerSavePatchPlan(saveData, {
      ...plan,
      eligible: true,
      authStatus: "verified",
      playerId: plan.playerId,
      sourceEventId: plan.sourceEventId,
      sourceLedgerId: plan.sourceLedgerId,
      duplicateDetected: false
    }, {
      sourceEventId: plan.sourceEventId,
      sourceLedgerId: plan.sourceLedgerId
    });

    if (!refreshedPlan.eligible) {
      return {
        ok: false,
        applied: false,
        dryRun: true,
        progressionWritesEnabled: true,
        idempotencyKey: getStringValue(plan.idempotencyKey),
        idempotencyReady: refreshedPlan.idempotencyReady === true,
        duplicateDetected: false,
        ...allowlistStatus,
        skippedReason: refreshedPlan.skippedReason || "player_save_patch_plan_invalid",
        status: saveRead.status,
        plan: refreshedPlan
      };
    }

    const updatedSaveData = setCombatXpOnly(saveData, refreshedPlan.xpAfter);
    const patchResult = await patchPlayerSaveData(supabaseUrl, plan.playerId, updatedSaveData, config, fetchImpl);

    if (!patchResult.ok) {
      return {
        ok: false,
        applied: false,
        dryRun: true,
        progressionWritesEnabled: true,
        idempotencyKey: getStringValue(plan.idempotencyKey),
        idempotencyReady: true,
        duplicateDetected: false,
        ...allowlistStatus,
        skippedReason: patchResult.skippedReason,
        status: patchResult.status,
        plan: refreshedPlan
      };
    }

    return {
      ok: true,
      applied: true,
      dryRun: false,
      progressionWritesEnabled: true,
      idempotencyKey: getStringValue(plan.idempotencyKey),
      idempotencyReady: true,
      duplicateDetected: false,
      ...allowlistStatus,
      skippedReason: "",
      status: patchResult.status,
      xpBefore: refreshedPlan.xpBefore,
      xpAfter: refreshedPlan.xpAfter,
      creditsBefore: refreshedPlan.creditsBefore,
      creditsAfter: refreshedPlan.creditsAfter,
      appliedFields: ["xp"],
      plan: refreshedPlan
    };
  } catch (_err) {
    return {
      ok: false,
      applied: false,
      dryRun: true,
      progressionWritesEnabled: true,
      idempotencyKey: getStringValue(plan.idempotencyKey),
      idempotencyReady: true,
      duplicateDetected: false,
      ...allowlistStatus,
      skippedReason: "player_save_patch_failed",
      status: 0,
      plan
    };
  }
}

export const PlayerSaveWriteService = Object.freeze({
  buildPlayerSavePatchPlan,
  applyPlayerSavePatchPlan,
  getProgressionWriteScope,
  isProgressionWriteEnabled,
  getStagingProgressionWriteAllowlist
});
