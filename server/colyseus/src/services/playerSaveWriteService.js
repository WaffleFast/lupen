/* Staging player_saves XP/credits patch adapter.
   This is the future real progression write path, but it is disabled by
   default and fail-closed. It supports XP/credits only and never applies
   loot, inventory, bounties, cargo, equipment, or ship changes. */

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

function getAllowlistStatus(playerId, env = process.env) {
  const allowlist = getStagingProgressionWriteAllowlist(env);
  const normalizedPlayerId = getStringValue(playerId);

  return {
    stagingWriteAllowlistPresent: allowlist.length > 0,
    playerInStagingWriteAllowlist: !!normalizedPlayerId && allowlist.includes(normalizedPlayerId)
  };
}

export function buildPlayerSavePatchPlan(currentSaveData = {}, rewardApplicationPlan = {}, context = {}) {
  const playerId = getStringValue(rewardApplicationPlan.playerId || context.playerId);
  const sourceEventId = getStringValue(rewardApplicationPlan.sourceEventId || context.sourceEventId);
  const sourceLedgerId = getStringValue(rewardApplicationPlan.sourceLedgerId || context.sourceLedgerId);
  const duplicateDetected = context.duplicateDetected === true || rewardApplicationPlan.duplicateDetected === true;
  const idempotencyKey = getIdempotencyKey(playerId, sourceEventId, sourceLedgerId);
  const xpDelta = Math.max(0, getIntegerValue(rewardApplicationPlan.xpDelta, 0));
  const creditsDelta = Math.max(0, getIntegerValue(rewardApplicationPlan.creditsDelta, 0));
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
        : !creditsMatch
          ? "credits_path_missing_or_ambiguous"
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
    stagingWriteAllowlistPresent: false,
    playerInStagingWriteAllowlist: false,
    applied: false,
    dryRun: true
  };
}

export async function applyPlayerSavePatchPlan(plan = {}, options = {}) {
  const env = options.env || process.env;
  const allowlistStatus = getAllowlistStatus(plan?.playerId, env);

  if (String(env.ENABLE_STAGING_PROGRESSION_WRITES || "").toLowerCase() !== "true") {
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

  if (!allowlistStatus.stagingWriteAllowlistPresent) {
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

  if (!allowlistStatus.playerInStagingWriteAllowlist) {
    return {
      ok: false,
      applied: false,
      dryRun: true,
      progressionWritesEnabled: true,
      idempotencyKey: getStringValue(plan.idempotencyKey),
      idempotencyReady: true,
      duplicateDetected: false,
      ...allowlistStatus,
      skippedReason: "player_not_in_staging_write_allowlist",
      plan
    };
  }

  // Future real writes must be tied to this idempotency key and backed by a
  // durable uniqueness check, ideally the reward ledger source_event_id/applied
  // record. Only explicit test-account allow-listed users can reach this
  // branch, and player_saves still stays fail-closed until the final write
  // path is reviewed.
  return {
    ok: false,
    applied: false,
    dryRun: true,
    progressionWritesEnabled: true,
    idempotencyKey: getStringValue(plan.idempotencyKey),
    idempotencyReady: true,
    duplicateDetected: false,
    ...allowlistStatus,
    skippedReason: "progression_write_adapter_not_implemented",
    plan
  };
}

export const PlayerSaveWriteService = Object.freeze({
  buildPlayerSavePatchPlan,
  applyPlayerSavePatchPlan,
  getStagingProgressionWriteAllowlist
});
