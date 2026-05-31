/* Staging reward ledger adapter.
   This prepares the future server-side multiplayer reward ledger path while
   keeping actual writes disabled by default. It never mutates player_saves,
   XP, credits, inventory, bounty progress, or gameplay state. */

function getStringValue(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function getNumberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function isRewardWriteEnabled(env = process.env) {
  return String(env.ENABLE_STAGING_REWARD_WRITES || "").toLowerCase() === "true";
}

function getSupabaseConfig(env = process.env) {
  return {
    url: getStringValue(env.SUPABASE_URL),
    serviceRoleKey: getStringValue(env.SUPABASE_SERVICE_ROLE_KEY)
  };
}

export function buildRewardLedgerEntry(rewardWritePlan = {}, context = {}) {
  const loot = Array.isArray(rewardWritePlan.intendedLoot)
    ? rewardWritePlan.intendedLoot
    : [];

  return {
    player_id: getStringValue(rewardWritePlan.playerId || rewardWritePlan.trustedPlayerId),
    supabase_user_id: getStringValue(rewardWritePlan.trustedPlayerId || rewardWritePlan.playerId),
    room_name: getStringValue(context.roomName),
    bot_id: getStringValue(rewardWritePlan.botId),
    bot_name: getStringValue(rewardWritePlan.botName, "Staging Bot"),
    node: getStringValue(rewardWritePlan.node),
    reward_reason: getStringValue(rewardWritePlan.intendedReason, "staging_bot_disabled"),
    xp_amount: Math.max(0, Math.round(getNumberValue(rewardWritePlan.intendedXp, 0))),
    credits_amount: Math.max(0, Math.round(getNumberValue(rewardWritePlan.intendedCredits, 0))),
    loot,
    contribution_percent: Math.max(0, Math.min(100, getNumberValue(rewardWritePlan.contributionPercent, 0))),
    final_hit: getStringValue(rewardWritePlan.finalHitBy) === getStringValue(rewardWritePlan.contributorSessionId),
    top_contributor: getStringValue(rewardWritePlan.topContributorSessionId) === getStringValue(rewardWritePlan.contributorSessionId),
    source_event_id: getStringValue(context.sourceEventId || rewardWritePlan.rewardPreviewId),
    applied: false,
    dry_run: true,
    metadata: {
      authStatus: getStringValue(rewardWritePlan.authStatus, "guest"),
      displayName: getStringValue(rewardWritePlan.displayName, "Pilot"),
      eligible: rewardWritePlan.eligible === true,
      blockedReason: getStringValue(rewardWritePlan.blockedReason),
      sessionId: getStringValue(rewardWritePlan.contributorSessionId),
      dryRun: true,
      applied: false
    }
  };
}

export async function writeRewardLedgerEntry(entry = {}, options = {}) {
  const env = options.env || process.env;

  if (!isRewardWriteEnabled(env)) {
    return {
      ok: true,
      applied: false,
      dryRun: true,
      skippedReason: "reward_writes_disabled",
      entry
    };
  }

  const config = getSupabaseConfig(env);
  if (!entry?.player_id || entry?.metadata?.eligible !== true) {
    return {
      ok: false,
      applied: false,
      dryRun: true,
      skippedReason: "reward_plan_not_eligible",
      entry
    };
  }

  if (!config.url || !config.serviceRoleKey) {
    return {
      ok: false,
      applied: false,
      dryRun: true,
      skippedReason: "supabase_config_missing",
      entry
    };
  }

  // This branch is intentionally still a dry-run placeholder. Future work can
  // replace this with a real insert into multiplayer_reward_ledger after the
  // SQL draft is reviewed/applied and idempotency rules are finalised.
  return {
    ok: false,
    applied: false,
    dryRun: true,
    skippedReason: "reward_ledger_write_not_implemented",
    entry
  };
}

export const RewardLedgerService = Object.freeze({
  buildRewardLedgerEntry,
  writeRewardLedgerEntry
});
