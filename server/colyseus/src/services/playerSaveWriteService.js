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

export function buildPlayerSavePatchPlan(currentSaveData = {}, rewardApplicationPlan = {}, context = {}) {
  const playerId = getStringValue(rewardApplicationPlan.playerId || context.playerId);
  const sourceEventId = getStringValue(rewardApplicationPlan.sourceEventId || context.sourceEventId);
  const sourceLedgerId = getStringValue(rewardApplicationPlan.sourceLedgerId || context.sourceLedgerId);
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
    : !sourceEventId && !sourceLedgerId
      ? "idempotency_not_ready"
      : !xpMatch
        ? "xp_path_missing_or_ambiguous"
        : !creditsMatch
          ? "credits_path_missing_or_ambiguous"
          : "";

  return {
    playerId: eligible ? playerId : "",
    sourceEventId,
    sourceLedgerId,
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
    applied: false,
    dryRun: true
  };
}

export async function applyPlayerSavePatchPlan(plan = {}, options = {}) {
  const env = options.env || process.env;

  if (String(env.ENABLE_STAGING_PROGRESSION_WRITES || "").toLowerCase() !== "true") {
    return {
      ok: true,
      applied: false,
      dryRun: true,
      progressionWritesEnabled: false,
      skippedReason: "progression_writes_disabled",
      plan
    };
  }

  if (!plan?.eligible || !plan?.playerId) {
    return {
      ok: false,
      applied: false,
      dryRun: true,
      progressionWritesEnabled: true,
      skippedReason: plan?.skippedReason || "reward_application_not_eligible",
      plan
    };
  }

  // Real player_saves writes stay fail-closed until a durable duplicate
  // protection strategy is implemented. This prevents repeated claim events
  // from applying XP/credits more than once.
  return {
    ok: false,
    applied: false,
    dryRun: true,
    progressionWritesEnabled: true,
    skippedReason: "idempotency_not_ready",
    plan
  };
}

export const PlayerSaveWriteService = Object.freeze({
  buildPlayerSavePatchPlan,
  applyPlayerSavePatchPlan
});
