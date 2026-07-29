/* Staging player_saves reward patch adapter.
   This is the future real progression write path, but it is disabled by
   default and fail-closed. It supports only combat XP, credits, and
   upgradeMaterials.lupenShards; it never applies inventory, bounties,
   cargo, equipment, or ship changes. */

const MAX_STAGING_XP_DELTA = 500;
const MAX_STAGING_CREDITS_DELTA = 50000;
const MAX_STAGING_LUPEN_SHARD_DELTA = 100;
const MAP_ONE_LEVEL_TWO_XP = 2500;
const MAP_ONE_MAX_XP = 5500;
const MAP_ONE_POST_LEVEL_TWO_BOT_XP_MULTIPLIER = 0.8;

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

export function getMapOneBotXpDelta(currentXp = 0, baseXp = 0) {
  const safeCurrentXp = clampInteger(currentXp, 0, MAP_ONE_MAX_XP);
  const safeBaseXp = Math.max(0, getIntegerValue(baseXp, 0));
  const multiplier = safeCurrentXp >= MAP_ONE_LEVEL_TWO_XP
    ? MAP_ONE_POST_LEVEL_TWO_BOT_XP_MULTIPLIER
    : 1;
  return Math.min(
    Math.max(0, MAP_ONE_MAX_XP - safeCurrentXp),
    Math.max(0, Math.round(safeBaseXp * multiplier))
  );
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

function setRewardPatchValues(source = {}, plan = {}) {
  let updated = cloneJson(source);
  if (Number(plan.xpDelta || 0) > 0 && Number.isFinite(Number(plan.xpAfter))) {
    updated = setCombatXpOnly(updated, plan.xpAfter);
  }
  if (Number(plan.creditsDelta || 0) > 0 && plan.creditsPath) {
    updated = setValueAtPath(updated, plan.creditsPath.split("."), plan.creditsAfter);
  }
  if (Number(plan.lupenShardDelta || 0) > 0 && plan.lupenShardsPath) {
    updated = setValueAtPath(updated, plan.lupenShardsPath.split("."), plan.lupenShardsAfter);
  }
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
  if (scope === "all" || scope === "verified" || scope === "allowlist") return scope;
  return "invalid";
}

export function isProgressionWriteEnabled(env = process.env) {
  return String(env.ENABLE_STAGING_PROGRESSION_WRITES || "").toLowerCase() === "true";
}

function getAllowlistStatus(playerId, env = process.env) {
  const allowlist = getStagingProgressionWriteAllowlist(env);
  const normalizedPlayerId = getStringValue(playerId);
  const progressionWriteScope = getProgressionWriteScope(env);
  const playerInStagingWriteAllowlist = !!normalizedPlayerId && allowlist.includes(normalizedPlayerId);
  const verifiedScopeEnabled = progressionWriteScope === "all" || progressionWriteScope === "verified";
  const scopeInvalid = progressionWriteScope === "invalid";

  return {
    progressionWriteScope,
    verifiedScopeEnabled,
    scopeInvalid,
    stagingWriteAllowlistPresent: allowlist.length > 0,
    playerInStagingWriteAllowlist,
    playerAllowedForStagingWrite: verifiedScopeEnabled ? !!normalizedPlayerId : !scopeInvalid && playerInStagingWriteAllowlist
  };
}

function getSaveDataFromRow(row = {}) {
  return row?.save_data && typeof row.save_data === "object" ? row.save_data : null;
}

function getCombatXpFromSaveData(saveData = {}) {
  return getIntegerValue(saveData?.playerProgress?.combatXp, 0);
}

function getZoneCombatXpFromSaveData(saveData = {}, zoneKey = "sector-one") {
  return getIntegerValue(saveData?.playerProgress?.zoneCombatXp?.[zoneKey], 0);
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

  const rows = typeof response.json === "function" ? await response.json().catch(() => []) : [];
  const row = Array.isArray(rows) ? rows[0] : rows;
  return {
    ok: true,
    skippedReason: "",
    status: response.status || 200,
    row: row || null
  };
}

export function buildPlayerSavePatchPlan(currentSaveData = {}, rewardApplicationPlan = {}, context = {}) {
  const playerId = getStringValue(rewardApplicationPlan.playerId || context.playerId);
  const sourceEventId = getStringValue(rewardApplicationPlan.sourceEventId || context.sourceEventId);
  const sourceLedgerId = getStringValue(rewardApplicationPlan.sourceLedgerId || context.sourceLedgerId);
  const duplicateDetected = context.duplicateDetected === true || rewardApplicationPlan.duplicateDetected === true;
  const idempotencyKey = getIdempotencyKey(playerId, sourceEventId, sourceLedgerId);
  const requestedXpDelta = clampInteger(rewardApplicationPlan.xpDelta, 0, MAX_STAGING_XP_DELTA);
  const creditsDelta = clampInteger(rewardApplicationPlan.creditsDelta, 0, MAX_STAGING_CREDITS_DELTA);
  const lupenShardDelta = Math.min(
    MAX_STAGING_LUPEN_SHARD_DELTA,
    Math.max(0, (Array.isArray(rewardApplicationPlan.lootAdditions) ? rewardApplicationPlan.lootAdditions : [])
      .filter((item) => getStringValue(item) === "lupenShard" || getStringValue(item) === "preview:lupenShard")
      .length)
  );
  const xpMatch = resolveNumericPath(currentSaveData, [
    ["playerProgress", "combatXp"]
  ]);
  const isBotXpReward = String(rewardApplicationPlan.reason || "").includes("bot");
  const xpBefore = xpMatch ? getIntegerValue(xpMatch.value, 0) : null;
  const xpDelta = xpMatch && isBotXpReward
    ? getMapOneBotXpDelta(xpBefore, requestedXpDelta)
    : xpMatch
      ? Math.min(requestedXpDelta, Math.max(0, MAP_ONE_MAX_XP - xpBefore))
      : requestedXpDelta;
  const creditsMatch = resolveNumericPath(currentSaveData, [
    ["credits"]
  ]);
  const lupenShardsMatch = resolveNumericPath(currentSaveData, [
    ["upgradeMaterials", "lupenShards"]
  ]);
  const eligible = rewardApplicationPlan.eligible === true &&
    rewardApplicationPlan.authStatus === "verified" &&
    !!playerId;
  const hasAnyDelta = xpDelta > 0 || creditsDelta > 0 || lupenShardDelta > 0;
  const blockedReason = !eligible
    ? "reward_application_not_eligible"
    : !idempotencyKey
      ? "idempotency_not_ready"
      : duplicateDetected
        ? "duplicate_reward_application"
        : !hasAnyDelta
          ? "reward_application_empty"
          : xpDelta > 0 && !xpMatch
          ? "xp_path_missing_or_ambiguous"
          : creditsDelta > 0 && !creditsMatch
            ? "credits_path_missing_or_ambiguous"
            : lupenShardDelta > 0 && !lupenShardsMatch
              ? "lupen_shards_path_missing_or_invalid"
              : "";

  return {
    playerId: eligible ? playerId : "",
    sourceEventId,
    sourceLedgerId,
    lootAdditions: Array.isArray(rewardApplicationPlan.lootAdditions)
      ? rewardApplicationPlan.lootAdditions.map((item) => getStringValue(item)).filter(Boolean)
      : [],
    idempotencyKey: eligible ? idempotencyKey : "",
    idempotencyReady: eligible && !!idempotencyKey,
    duplicateDetected,
    xpPath: xpMatch?.path?.join(".") || "",
    creditsPath: creditsMatch?.path?.join(".") || "",
    lupenShardsPath: lupenShardsMatch?.path?.join(".") || "",
    xpDelta,
    creditsDelta,
    lupenShardDelta,
    xpBefore,
    xpAfter: xpMatch ? xpBefore + xpDelta : null,
    creditsBefore: creditsMatch ? getIntegerValue(creditsMatch.value, 0) : null,
    creditsAfter: creditsMatch ? getIntegerValue(creditsMatch.value, 0) + creditsDelta : null,
    lupenShardsBefore: lupenShardsMatch ? getIntegerValue(lupenShardsMatch.value, 0) : null,
    lupenShardsAfter: lupenShardsMatch ? getIntegerValue(lupenShardsMatch.value, 0) + lupenShardDelta : null,
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

  if (allowlistStatus.scopeInvalid) {
    return {
      ok: false,
      applied: false,
      dryRun: true,
      progressionWritesEnabled: true,
      idempotencyKey: getStringValue(plan.idempotencyKey),
      idempotencyReady: true,
      duplicateDetected: false,
      ...allowlistStatus,
      skippedReason: "staging_write_scope_invalid",
      plan
    };
  }

  if (!allowlistStatus.verifiedScopeEnabled && !allowlistStatus.stagingWriteAllowlistPresent) {
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
      skippedReason: allowlistStatus.verifiedScopeEnabled
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

    const updatedSaveData = setRewardPatchValues(saveData, refreshedPlan);
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

    let verifiedSaveData = getSaveDataFromRow(patchResult.row);
    let verifyStatus = patchResult.status;
    if (!verifiedSaveData) {
      const verifyRead = await fetchPlayerSaveRow(supabaseUrl, plan.playerId, config, fetchImpl);
      verifyStatus = verifyRead.status;
      verifiedSaveData = verifyRead.ok ? getSaveDataFromRow(verifyRead.row) : null;
    }

    const verifiedXp = getCombatXpFromSaveData(verifiedSaveData);
    const verifiedZoneXp = getZoneCombatXpFromSaveData(verifiedSaveData);
    const verifiedCredits = Number(verifiedSaveData?.credits);
    const verifiedLupenShards = Number(verifiedSaveData?.upgradeMaterials?.lupenShards);
    const persistenceVerified = !!verifiedSaveData &&
      (refreshedPlan.xpDelta <= 0 || (verifiedXp >= refreshedPlan.xpAfter && verifiedZoneXp >= refreshedPlan.xpAfter)) &&
      (refreshedPlan.creditsDelta <= 0 || verifiedCredits >= refreshedPlan.creditsAfter) &&
      (refreshedPlan.lupenShardDelta <= 0 || verifiedLupenShards >= refreshedPlan.lupenShardsAfter);

    if (!persistenceVerified) {
      return {
        ok: false,
        applied: false,
        dryRun: true,
        progressionWritesEnabled: true,
        idempotencyKey: getStringValue(plan.idempotencyKey),
        idempotencyReady: true,
        duplicateDetected: false,
        ...allowlistStatus,
        skippedReason: "player_save_patch_verify_failed",
        status: verifyStatus,
        xpBefore: refreshedPlan.xpBefore,
        xpAfter: refreshedPlan.xpAfter,
        creditsBefore: refreshedPlan.creditsBefore,
        creditsAfter: refreshedPlan.creditsAfter,
        lupenShardsBefore: refreshedPlan.lupenShardsBefore,
        lupenShardsAfter: refreshedPlan.lupenShardsAfter,
        persistedXp: verifiedSaveData ? verifiedXp : null,
        persistedZoneXp: verifiedSaveData ? verifiedZoneXp : null,
        persistedCredits: verifiedSaveData ? verifiedCredits : null,
        persistedLupenShards: verifiedSaveData ? verifiedLupenShards : null,
        persistenceVerified: false,
        plan: refreshedPlan
      };
    }

    const appliedFields = [];
    if (refreshedPlan.xpDelta > 0) appliedFields.push("xp");
    if (refreshedPlan.creditsDelta > 0) appliedFields.push("credits");
    if (refreshedPlan.lupenShardDelta > 0) appliedFields.push("upgradeMaterials.lupenShards");

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
      persistedXp: verifiedXp,
      persistedZoneXp: verifiedZoneXp,
      persistenceVerified: true,
      creditsBefore: refreshedPlan.creditsBefore,
      creditsAfter: refreshedPlan.creditsAfter,
      persistedCredits: verifiedCredits,
      lupenShardsBefore: refreshedPlan.lupenShardsBefore,
      lupenShardsAfter: refreshedPlan.lupenShardsAfter,
      persistedLupenShards: verifiedLupenShards,
      appliedFields,
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
