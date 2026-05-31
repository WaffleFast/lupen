/* Staging reward application adapter.
   This prepares the future server-side progression application path while
   keeping player_saves, XP, credits, inventory, bounty progress, loot, and
   progression writes disabled by default. */

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
    sourceLedgerId: getStringValue(context.sourceLedgerId || rewardPlanOrLedgerEntry.ledgerId || rewardPlanOrLedgerEntry.id),
    sourceEventId: getStringValue(context.sourceEventId || rewardPlanOrLedgerEntry.rewardPreviewId || rewardPlanOrLedgerEntry.source_event_id),
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
      skippedReason: "reward_application_not_eligible",
      plan
    };
  }

  if (!isProgressionWriteEnabled(env)) {
    return {
      ok: true,
      applied: false,
      dryRun: true,
      skippedReason: "progression_writes_disabled",
      plan
    };
  }

  // Fail closed until a later sprint deliberately implements trusted
  // server-side writes to the chosen progression storage target.
  return {
    ok: false,
    applied: false,
    dryRun: true,
    skippedReason: "progression_write_adapter_not_implemented",
    plan
  };
}

export const RewardApplicationService = Object.freeze({
  buildRewardApplicationPlan,
  applyRewardApplicationPlan,
  isProgressionWriteEnabled
});
