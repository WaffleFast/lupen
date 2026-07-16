/* Staging-only bounty wrapper.
   This file defines a tiny server-owned objective for multiplayer staging.
   It never writes normal bounty state, route completion, inventory, PvP,
   player damage, or broad progression. */

export const STAGING_BOUNTY_ID = "staging_erebus_patrol_2";

function makeShardLootReward(quantity = 0) {
  return Array.from({ length: Math.max(0, Math.round(Number(quantity || 0))) }, () => "lupenShard");
}

export const STAGING_BOUNTIES = Object.freeze([
  Object.freeze({
    id: STAGING_BOUNTY_ID,
    title: "Erebus Patrol Sweep",
    description: "Destroy 4 Erebus bots.",
    contractType: "Kill Contract",
    targetType: "server_bot_destroy",
    targetFaction: "Erebus",
    target: "Any Erebus",
    targetBotType: "any",
    targetBotLabel: "Any Erebus",
    difficulty: "Easy",
    requiredKills: 4,
    xpReward: 0,
    creditsReward: 900,
    lupenShardsReward: 25,
    icon: "assets/bounties/erebus-patrol-sweep.png",
    lootReward: makeShardLootReward(25),
    repeatable: false,
    stagingOnly: true
  }),
  Object.freeze({
    id: "staging_hunter_clearance_4",
    title: "Hunter Clearance",
    description: "Destroy 4 Erebus Hunters.",
    contractType: "Targeted Hunt",
    targetType: "server_bot_destroy",
    targetFaction: "Erebus",
    target: "Hunter",
    targetBotType: "hunter",
    targetBotLabel: "Hunter",
    difficulty: "Easy",
    requiredKills: 4,
    xpReward: 0,
    creditsReward: 1100,
    lupenShardsReward: 35,
    icon: "assets/bounties/hunter-clearance.png",
    lootReward: makeShardLootReward(35),
    repeatable: false,
    stagingOnly: true
  }),
  Object.freeze({
    id: "staging_timed_suppression_4",
    title: "Timed Suppression",
    description: "Destroy 4 Erebus bots within 4 minutes.",
    contractType: "Timed Elimination",
    targetType: "server_bot_destroy",
    targetFaction: "Erebus",
    target: "Any Erebus",
    targetBotType: "any",
    targetBotLabel: "Any Erebus",
    difficulty: "Medium",
    requiredKills: 4,
    xpReward: 0,
    creditsReward: 1500,
    lupenShardsReward: 50,
    timed: true,
    timeLimitSeconds: 240,
    icon: "assets/bounties/timed-suppression.png",
    lootReward: makeShardLootReward(50),
    repeatable: false,
    stagingOnly: true
  }),
  Object.freeze({
    id: "staging_behemoth_warning_1",
    title: "Behemoth Warning",
    description: "Destroy 1 Erebus Behemoth.",
    contractType: "Boss Contract",
    targetType: "server_bot_destroy",
    targetFaction: "Erebus",
    target: "Erebus Behemoth",
    targetBotType: "behemoth",
    targetBotLabel: "Erebus Behemoth",
    difficulty: "Extreme",
    requiredKills: 1,
    xpReward: 0,
    creditsReward: 2500,
    lupenShardsReward: 75,
    icon: "assets/bounties/behemoth-warning.png",
    lootReward: makeShardLootReward(75),
    repeatable: false,
    stagingOnly: true
  })
]);

export const STAGING_BOUNTY = STAGING_BOUNTIES[0];

function getStringValue(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function getNumberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function getStagingBounties() {
  return STAGING_BOUNTIES.map((bounty) => ({ ...bounty, lootReward: [] }));
}

export function getStagingBountyById(id = STAGING_BOUNTY_ID) {
  const bounty = getStagingBountyConfigById(id);
  return bounty ? { ...bounty, lootReward: [] } : null;
}

export function getStagingBountyConfigById(id = STAGING_BOUNTY_ID) {
  const safeId = getStringValue(id, STAGING_BOUNTY_ID);
  return STAGING_BOUNTIES.find((bounty) => bounty.id === safeId) || null;
}

function botMatchesBountyTarget(bounty = {}, bot = {}) {
  const targetBotType = getStringValue(bounty.targetBotType, "any").toLowerCase();
  if (!targetBotType || targetBotType === "any" || targetBotType === "any_erebus") {
    const faction = getStringValue(bot.faction || bot.botFaction).toLowerCase();
    const botType = getStringValue(bot.botType).toLowerCase();
    const displayName = getStringValue(bot.displayName || bot.name).toLowerCase();
    return faction === "erebus" ||
      ["hunter", "attacker", "destroyer", "behemoth"].includes(botType) ||
      displayName.startsWith("erebus ");
  }
  return getStringValue(bot.botType).toLowerCase() === targetBotType;
}

export function createStagingBountyState(sessionId = "", now = Date.now(), bountyId = STAGING_BOUNTY_ID) {
  const bounty = getStagingBountyConfigById(bountyId) || STAGING_BOUNTY;
  return {
    bountyId: bounty.id,
    sessionId: getStringValue(sessionId),
    accepted: true,
    progress: 0,
    requiredKills: bounty.requiredKills,
    timed: bounty.timed === true,
    timeLimitSeconds: Math.max(0, Math.round(getNumberValue(bounty.timeLimitSeconds, 0))),
    expiresAt: bounty.timed === true ? now + (Math.max(0, Math.round(getNumberValue(bounty.timeLimitSeconds, 0))) * 1000) : 0,
    completed: false,
    failed: false,
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
  const timed = bounty?.timed === true || state?.timed === true;
  const expiresAt = Math.max(0, Math.round(getNumberValue(state?.expiresAt, 0)));
  const failed = accepted && !completed && state?.failed === true;

  return {
    ...(bounty || STAGING_BOUNTY),
    accepted,
    progress: accepted ? Math.min(progress, requiredKills) : 0,
    requiredKills,
    timed,
    timeLimitSeconds: Math.max(0, Math.round(getNumberValue(state?.timeLimitSeconds, bounty?.timeLimitSeconds || 0))),
    expiresAt,
    completed,
    failed,
    claimAvailable: completed && !claimed,
    claimed,
    completionSequence: Math.max(0, Math.round(getNumberValue(state?.completionSequence, 0))),
    completedAt: Math.max(0, Math.round(getNumberValue(state?.completedAt, 0))),
    claimedAt: Math.max(0, Math.round(getNumberValue(state?.claimedAt, 0))),
    lastReason: getStringValue(state?.lastReason),
    updatedAt: Math.max(0, Math.round(getNumberValue(state?.updatedAt, 0)))
  };
}

export function recordStagingBountyBotDestruction(state = null, { botId = "", botType = "", botFaction = "", botDisplayName = "", contributorSessionIds = [], now = Date.now() } = {}) {
  if (!state?.accepted || state.claimed) {
    return {
      state,
      changed: false,
      reason: state?.claimed ? "bounty_already_claimed" : "bounty_not_accepted"
    };
  }

  if (state.failed === true) {
    return { state, changed: false, reason: "bounty_failed" };
  }

  if (state.timed === true && state.expiresAt && now > Number(state.expiresAt)) {
    return {
      state: {
        ...state,
        failed: true,
        progress: 0,
        lastReason: "bounty_timer_expired",
        updatedAt: now
      },
      changed: true,
      reason: "bounty_timer_expired"
    };
  }

  const safeBotId = getStringValue(botId);
  if (!safeBotId) {
    return { state, changed: false, reason: "bot_id_missing" };
  }

  const bounty = getStagingBountyConfigById(state.bountyId);
  if (!bounty) {
    return { state, changed: false, reason: "unknown_staging_bounty" };
  }

  if (!botMatchesBountyTarget(bounty, { botType, botFaction, displayName: botDisplayName })) {
    return { state, changed: false, reason: "bot_type_mismatch" };
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
    progress: Math.min(bounty.requiredKills, Math.max(0, Math.round(getNumberValue(state.progress, 0))) + 1),
    updatedAt: now,
    lastReason: "progress_updated"
  };
  if (nextState.progress >= bounty.requiredKills && !nextState.completed) {
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
