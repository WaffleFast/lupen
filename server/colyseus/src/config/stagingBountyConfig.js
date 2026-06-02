/* Staging-only bounty wrapper.
   This file defines a tiny server-owned objective for multiplayer staging.
   It never writes normal bounty state, credits, loot, route completion,
   inventory, PvP, player damage, or broad progression. */

export const STAGING_BOUNTY_ID = "staging_erebus_patrol_2";

export const STAGING_BOUNTY = Object.freeze({
  id: STAGING_BOUNTY_ID,
  title: "Erebus Patrol Sweep",
  description: "Destroy 2 server-owned staging Erebus bots.",
  targetType: "server_bot_destroy",
  targetFaction: "Erebus",
  requiredKills: 2,
  xpReward: 40,
  creditsReward: 0,
  lootReward: [],
  repeatable: false,
  stagingOnly: true
});

function getStringValue(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function getNumberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function getStagingBounties() {
  return [{ ...STAGING_BOUNTY, lootReward: [] }];
}

export function getStagingBountyById(id = STAGING_BOUNTY_ID) {
  return getStringValue(id) === STAGING_BOUNTY_ID ? { ...STAGING_BOUNTY, lootReward: [] } : null;
}

export function createStagingBountyState(sessionId = "", now = Date.now()) {
  return {
    bountyId: STAGING_BOUNTY_ID,
    sessionId: getStringValue(sessionId),
    accepted: true,
    progress: 0,
    requiredKills: STAGING_BOUNTY.requiredKills,
    completed: false,
    claimed: false,
    completionSequence: 0,
    completedAt: 0,
    claimedAt: 0,
    countedBotIds: [],
    lastReason: "accepted",
    acceptedAt: now,
    updatedAt: now
  };
}

export function getPublicStagingBountyState(state = null) {
  const bounty = getStagingBountyById(state?.bountyId || STAGING_BOUNTY_ID);
  const accepted = state?.accepted === true;
  const progress = Math.max(0, Math.round(getNumberValue(state?.progress, 0)));
  const requiredKills = Math.max(1, Math.round(getNumberValue(state?.requiredKills, bounty?.requiredKills || 1)));
  const completed = accepted && (state?.completed === true || progress >= requiredKills);
  const claimed = state?.claimed === true;

  return {
    ...(bounty || STAGING_BOUNTY),
    accepted,
    progress: accepted ? Math.min(progress, requiredKills) : 0,
    requiredKills,
    completed,
    claimAvailable: completed && !claimed,
    claimed,
    completionSequence: Math.max(0, Math.round(getNumberValue(state?.completionSequence, 0))),
    completedAt: Math.max(0, Math.round(getNumberValue(state?.completedAt, 0))),
    claimedAt: Math.max(0, Math.round(getNumberValue(state?.claimedAt, 0))),
    lastReason: getStringValue(state?.lastReason),
    updatedAt: Math.max(0, Math.round(getNumberValue(state?.updatedAt, 0)))
  };
}

export function recordStagingBountyBotDestruction(state = null, { botId = "", contributorSessionIds = [], now = Date.now() } = {}) {
  if (!state?.accepted || state.claimed) {
    return {
      state,
      changed: false,
      reason: state?.claimed ? "bounty_already_claimed" : "bounty_not_accepted"
    };
  }

  const safeBotId = getStringValue(botId);
  if (!safeBotId) {
    return { state, changed: false, reason: "bot_id_missing" };
  }

  const contributors = new Set((Array.isArray(contributorSessionIds) ? contributorSessionIds : [])
    .map((entry) => getStringValue(entry))
    .filter(Boolean));
  if (!contributors.has(getStringValue(state.sessionId))) {
    return { state, changed: false, reason: "player_did_not_contribute" };
  }

  if (state.countedBotIds?.includes(safeBotId)) {
    return { state, changed: false, reason: "bot_already_counted" };
  }

  const nextState = {
    ...state,
    countedBotIds: [...(Array.isArray(state.countedBotIds) ? state.countedBotIds : []), safeBotId],
    progress: Math.min(STAGING_BOUNTY.requiredKills, Math.max(0, Math.round(getNumberValue(state.progress, 0))) + 1),
    updatedAt: now,
    lastReason: "progress_updated"
  };
  if (nextState.progress >= STAGING_BOUNTY.requiredKills && !nextState.completed) {
    nextState.completed = true;
    nextState.completedAt = now;
    nextState.completionSequence = Math.max(1, Math.round(getNumberValue(state.completionSequence, 0)) + 1);
    nextState.lastReason = "completed";
  }

  return {
    state: nextState,
    changed: true,
    reason: nextState.completed ? "completed" : "progress_updated"
  };
}

export function buildStagingBountySourceEventId(state = {}, playerId = "") {
  const bountyId = getStringValue(state.bountyId, STAGING_BOUNTY_ID);
  const playerKey = getStringValue(playerId) || getStringValue(state.sessionId) || "unknown";
  const sequence = Math.max(1, Math.round(getNumberValue(state.completionSequence, 1)));
  return `${bountyId}:${playerKey}:${sequence}`;
}
