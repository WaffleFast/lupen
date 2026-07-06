/* Staging reward application adapter.
   This prepares the server-side progression application path while keeping
   player_saves writes gated and disabled by default. */

function getStringValue(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function getNumberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getLootList(value) {
  return Array.isArray(value)
    ? value.map((item) => getStringValue(item)).filter(Boolean)
    : [];
}

function getIdempotencyKey(playerId, sourceEventId, sourceLedgerId) {
  const sourceKey = sourceEventId || sourceLedgerId;
  return playerId && sourceKey ? `${playerId}:${sourceKey}` : "";
}

export function isProgressionWriteEnabled(env = process.env) {
  return String(env.ENABLE_STAGING_PROGRESSION_WRITES || "").toLowerCase() === "true";
}

export function buildRewardApplicationPlan(rewardPlanOrLedgerEntry = {}, context = {}) {
  const metadata = rewardPlanOrLedgerEntry.metadata && typeof rewardPlanOrLedgerEntry.metadata === "object"
    ? rewardPlanOrLedgerEntry.metadata
    : {};
  const playerId = getStringValue(
    rewardPlanOrLedgerEntry.playerId ||
    rewardPlanOrLedgerEntry.trustedPlayerId ||
    rewardPlanOrLedgerEntry.player_id ||
    rewardPlanOrLedgerEntry.supabase_user_id
  );
  const authStatus = getStringValue(rewardPlanOrLedgerEntry.authStatus || metadata.authStatus, "guest");
  const eligible = rewardPlanOrLedgerEntry.eligible === true ||
    metadata.eligible === true ||
    (authStatus === "verified" && !!playerId);
  const blockedReason = eligible
    ? ""
    : getStringValue(rewardPlanOrLedgerEntry.blockedReason || metadata.blockedReason, authStatus === "guest" ? "identity_guest" : "identity_unverified");
  const sourceLedgerId = getStringValue(context.sourceLedgerId || rewardPlanOrLedgerEntry.ledgerId || rewardPlanOrLedgerEntry.id);
  const sourceEventId = getStringValue(context.sourceEventId || rewardPlanOrLedgerEntry.rewardPreviewId || rewardPlanOrLedgerEntry.source_event_id);
  const idempotencyKey = getIdempotencyKey(playerId, sourceEventId, sourceLedgerId);

  return {
    playerId: eligible ? playerId : "",
    displayName: getStringValue(rewardPlanOrLedgerEntry.displayName || metadata.displayName, "Pilot") || "Pilot",
    authStatus,
    botId: getStringValue(rewardPlanOrLedgerEntry.botId || rewardPlanOrLedgerEntry.bot_id),
    botName: getStringValue(rewardPlanOrLedgerEntry.botName || rewardPlanOrLedgerEntry.bot_name, "Staging Bot") || "Staging Bot",
    node: getStringValue(rewardPlanOrLedgerEntry.node),
    xpDelta: Math.max(0, Math.round(getNumberValue(rewardPlanOrLedgerEntry.intendedXp ?? rewardPlanOrLedgerEntry.xp_amount, 0))),
    creditsDelta: Math.max(0, Math.round(getNumberValue(rewardPlanOrLedgerEntry.intendedCredits ?? rewardPlanOrLedgerEntry.credits_amount, 0))),
    lootAdditions: getLootList(rewardPlanOrLedgerEntry.intendedLoot || rewardPlanOrLedgerEntry.loot),
    reason: getStringValue(rewardPlanOrLedgerEntry.intendedReason || rewardPlanOrLedgerEntry.reward_reason, "staging_bot_disabled"),
    sourceLedgerId,
    sourceEventId,
    idempotencyKey: eligible ? idempotencyKey : "",
    idempotencyReady: eligible && !!idempotencyKey,
    duplicateDetected: context.duplicateDetected === true || rewardPlanOrLedgerEntry.duplicateDetected === true,
    contributionPercent: Math.max(0, Math.min(100, getNumberValue(rewardPlanOrLedgerEntry.contributionPercent ?? rewardPlanOrLedgerEntry.contribution_percent, 0))),
    finalHit: rewardPlanOrLedgerEntry.finalHit === true || rewardPlanOrLedgerEntry.final_hit === true,
    topContributor: rewardPlanOrLedgerEntry.topContributor === true || rewardPlanOrLedgerEntry.top_contributor === true,
    eligible,
    blockedReason,
    applied: false,
    dryRun: true
  };
}

export async function applyRewardApplicationPlan(plan = {}, options = {}) {
  const env = options.env || process.env;

  if (!plan?.eligible || !plan?.playerId) {
    return {
      ok: false,
      applied: false,
      dryRun: true,
      idempotencyKey: getStringValue(plan?.idempotencyKey),
      idempotencyReady: plan?.idempotencyReady === true,
      duplicateDetected: plan?.duplicateDetected === true,
      skippedReason: "reward_application_not_eligible",
      plan
    };
  }

  if (!isProgressionWriteEnabled(env)) {
    return {
      ok: true,
      applied: false,
      dryRun: true,
      idempotencyKey: getStringValue(plan?.idempotencyKey),
      idempotencyReady: plan?.idempotencyReady === true,
      duplicateDetected: plan?.duplicateDetected === true,
      skippedReason: "progression_writes_disabled",
      plan
    };
  }

  // The concrete staging write path lives in playerSaveWriteService so this
  // planning adapter never mutates player_saves directly.
  return {
    ok: true,
    applied: false,
    dryRun: true,
    idempotencyKey: getStringValue(plan?.idempotencyKey),
    idempotencyReady: plan?.idempotencyReady === true,
    duplicateDetected: plan?.duplicateDetected === true,
    skippedReason: "player_save_patch_required",
    plan
  };
}

export const RewardApplicationService = Object.freeze({
  buildRewardApplicationPlan,
  applyRewardApplicationPlan,
  isProgressionWriteEnabled
});
