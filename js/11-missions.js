/* Mission Journal */

const MISSION_STATE_AVAILABLE = "available";
const MISSION_STATE_ACTIVE = "active";
const MISSION_STATE_COMPLETED = "completed";
const MISSION_STATE_CLAIMED = "claimed";

const CHAPTERS = Object.freeze({
  academy: Object.freeze({
    id: "academy",
    roman: "A",
    title: "Academy",
    theme: "Training begins here."
  }),
  frontier: Object.freeze({
    id: "frontier",
    roman: "I",
    title: "Chapter I: Frontier",
    theme: "Learn to survive."
  })
});

const CHAPTER_MISSIONS = Object.freeze([
  Object.freeze({
    id: "academy_starter_ship",
    title: "Claim Starter Ship",
    chapter: "academy",
    giver: "Morgan",
    briefing: "Claim or activate the starter ship.",
    completeText: "Starter ship confirmed. You have a hull assigned and ready for launch.",
    objective: Object.freeze({ type: "starter_ship_claimed", required: 1 }),
    reward: Object.freeze({ xp: 0, credits: 0 })
  }),
  Object.freeze({
    id: "academy_launch_ship",
    title: "Launch Ship",
    chapter: "academy",
    giver: "Morgan",
    briefing: "Launch from Asteron Prime.",
    completeText: "Launch confirmed. Your flight systems are responding normally.",
    objective: Object.freeze({ type: "launch_from_station", required: 1 }),
    reward: Object.freeze({ xp: 0, credits: 0 })
  }),
  Object.freeze({
    id: "academy_first_trade",
    title: "Complete First Trade",
    chapter: "academy",
    giver: "Morgan",
    briefing: "Complete one profitable trade.",
    completeText: "First profitable trade confirmed. The station economy has your route data.",
    objective: Object.freeze({ type: "profitable_trade", required: 1 }),
    reward: Object.freeze({ xp: 0, credits: 0 })
  }),
  Object.freeze({
    id: "academy_daily_contract",
    title: "Complete a Daily Trade Contract",
    chapter: "academy",
    giver: "Morgan",
    briefing: "Complete one fixed-route delivery from Daily Contracts.",
    completeText: "Daily delivery confirmed. You can now use fixed contracts for guaranteed returns between market runs.",
    objective: Object.freeze({ type: "complete_daily_trade_contract", required: 1 }),
    reward: Object.freeze({ xp: 0, credits: 0 })
  }),
  Object.freeze({
    id: "academy_two_guns",
    title: "Equip Two Guns",
    chapter: "academy",
    giver: "Morgan",
    briefing: "Equip two guns.",
    completeText: "Weapon loadout confirmed. You have two guns mounted.",
    objective: Object.freeze({ type: "equip_guns", required: 2 }),
    reward: Object.freeze({ xp: 0, credits: 0 })
  }),
  Object.freeze({
    id: "academy_attachment",
    title: "Equip Attachment",
    chapter: "academy",
    giver: "Morgan",
    briefing: "Equip one attachment.",
    completeText: "Attachment installed. Your ship has an auxiliary module online.",
    objective: Object.freeze({ type: "equip_attachment", required: 1 }),
    reward: Object.freeze({ xp: 0, credits: 0 })
  }),
  Object.freeze({
    id: "academy_erebus_bots",
    title: "Destroy 1 Erebus Bot",
    chapter: "academy",
    giver: "Morgan",
    briefing: "Destroy 1 Erebus bot.",
    completeText: "Erebus bot exercise complete. Your combat telemetry is stable.",
    objective: Object.freeze({ type: "destroy_bot", target: "erebus", required: 1 }),
    reward: Object.freeze({ xp: 0, credits: 0 })
  }),
  Object.freeze({
    id: "academy_repair_ship",
    title: "Repair Ship",
    chapter: "academy",
    giver: "Morgan",
    briefing: "Repair your ship once.",
    completeText: "Repair cycle confirmed. Maintenance systems are available when needed.",
    objective: Object.freeze({ type: "repair_ship", required: 1 }),
    reward: Object.freeze({ xp: 0, credits: 0 })
  }),
  Object.freeze({
    id: "academy_bounty",
    title: "Complete a Bounty",
    chapter: "academy",
    giver: "Morgan",
    briefing: "Claim one completed bounty from the Bounty Board.",
    completeText: "Bounty payout confirmed. You can now turn combat work into credits and Forge materials.",
    objective: Object.freeze({ type: "claim_bounty", required: 1 }),
    reward: Object.freeze({ xp: 0, credits: 0 })
  }),
  Object.freeze({
    id: "academy_pioneer_hull",
    title: "Purchase a Pioneer Hull",
    chapter: "academy",
    giver: "Morgan",
    briefing: "Earn enough credits to purchase a second Pioneer vessel.",
    completeText: "Second Pioneer hull confirmed. Academy certification is complete and Frontier operations are now open.",
    objective: Object.freeze({ type: "purchase_pioneer_hull", required: 1 }),
    reward: Object.freeze({ xp: 0, credits: 0 })
  }),
  Object.freeze({
    id: "sector_orientation",
    title: "Sector Orientation",
    chapter: "frontier",
    giver: "Morgan",
    briefing: "Before we push deeper into Frontier, I want to confirm your launch systems. Take the ship out when you're ready, Pilot.",
    completeText: "Launch telemetry is clean. Your vessel is responsive, and the station has your beacon.",
    objective: Object.freeze({ type: "launch_from_station", required: 1 }),
    reward: Object.freeze({ xp: 0, credits: 0 })
  }),
  Object.freeze({
    id: "first_haul",
    title: "First Haul",
    chapter: "frontier",
    giver: "Morgan",
    briefing: "The trade network is live. Margins are small at this level, but every clean haul builds your reputation.",
    completeText: "Good trade discipline. Profit recorded and your route history is now building.",
    objective: Object.freeze({ type: "profitable_trade", required: 1 }),
    reward: Object.freeze({ xp: 0, credits: 0 })
  }),
  Object.freeze({
    id: "resource_recovery",
    title: "Resource Recovery",
    chapter: "frontier",
    giver: "Morgan",
    briefing: "I'm detecting loose mineral signatures in the lower lanes. Recover what you can. The station can always use raw material.",
    completeText: "Resource recovery confirmed. Small hauls keep stations alive out here.",
    objective: Object.freeze({ type: "recover_resource", target: "any", required: 3 }),
    reward: Object.freeze({ xp: 0, credits: 0 })
  }),
  Object.freeze({
    id: "erebus_patrol",
    title: "Erebus Patrol Sweep",
    chapter: "frontier",
    giver: "Morgan",
    briefing: "Erebus drones are moving through the lower sector. They are not yet a major threat, but left alone, they become one.",
    completeText: "Erebus signatures reduced. You handled contact well.",
    objective: Object.freeze({ type: "destroy_bot", target: "erebus", required: 3 }),
    reward: Object.freeze({ xp: 0, credits: 0 })
  }),
  Object.freeze({
    id: "frontier_certification",
    title: "Frontier Certification",
    chapter: "frontier",
    giver: "Morgan",
    briefing: "You've traded, recovered resources, and survived combat. That makes you more than a visitor. I'm marking you as Frontier-certified.",
    completeText: "Certification logged. Frontier operations will treat you as a proven pilot.",
    objective: Object.freeze({
      type: "complete_missions",
      requiredMissionIds: ["first_haul", "resource_recovery", "erebus_patrol"]
    }),
    reward: Object.freeze({ xp: 0, credits: 0 })
  })
]);

const JOURNEY_CHAPTERS = Object.freeze([
  Object.freeze({
    id: "academy",
    order: 0,
    label: "Academy",
    displayLabel: "Academy",
    routeLabel: "Academy",
    routeTitle: "",
    shortLabel: "Academy",
    subtitle: "Training begins here.",
    status: "active",
    theme: "academy",
    icon: "academy",
    progressMode: "static",
    progress: 0,
    reward: Object.freeze({
      id: "academy-completion-v1",
      typeLabel: "CERTIFICATION",
      title: "Frontier Access",
      credits: 0,
      shipPlanId: "",
      shipPlanName: "",
      shipPlanImage: "assets/chapter-academy-icon.png",
      nextChapterId: "frontier",
      nextChapterLabel: "Chapter I: Frontier unlocked",
      items: Object.freeze([])
    })
  }),
  Object.freeze({
    id: "frontier",
    order: 1,
    label: "Chapter I: Frontier",
    displayLabel: "Chapter I: Frontier",
    routeLabel: "Chapter I",
    routeTitle: "Frontier",
    shortLabel: "Frontier",
    subtitle: "Complete Academy to unlock.",
    status: "pending",
    theme: "frontier",
    icon: "frontier",
    progressMode: "missions",
    currentPathFallback: "Sector Orientation",
    reward: Object.freeze({
      id: "frontier-completion-v1",
      typeLabel: "SHIP PLAN",
      title: "Nightshade Hawk",
      credits: 5000,
      shipPlanId: "nightshadeHawk",
      shipPlanName: "Nightshade Hawk",
      shipPlanImage: "assets/ships/nightshade-hawk/nightshade-hawk-medium.webp",
      nextChapterId: "next_route",
      nextChapterLabel: "Chapter II unlocked",
      items: Object.freeze([])
    })
  }),
  Object.freeze({
    id: "next_route",
    order: 2,
    label: "Chapter II",
    displayLabel: "Chapter II",
    routeLabel: "Chapter II",
    routeTitle: "",
    revealedRouteTitle: "Frontier Gateway",
    shortLabel: "Next Route",
    subtitle: "Complete Frontier to locate.",
    status: "locked",
    theme: "locked",
    icon: "locked",
    progressMode: "static",
    progress: 0,
    unlockText: "Complete Frontier to locate the gateway and reveal the next ship-plan family",
    revealText: "Frontier Gateway coordinates acquired. Chapter II will open a new sector and ship-plan family."
  })
]);

const JOURNEY_ASSIGNMENTS = Object.freeze([
  Object.freeze({
    id: "academy_starter_ship",
    chapterId: "academy",
    journeyTitle: "Claim Starter Ship",
    journeyShortDescription: "Claim or activate the starter ship.",
    journeyObjectiveLabel: "Claim or activate the starter ship",
    assignmentType: "orientation",
    journeyTheme: "cyan",
    icon: "navigation",
    assignmentMode: "chapter",
    requiresAccept: false,
    autoActive: true,
    rewards: Object.freeze({ xp: 0, credits: 0 }),
    order: 10
  }),
  Object.freeze({
    id: "academy_launch_ship",
    chapterId: "academy",
    journeyTitle: "Launch Ship",
    journeyShortDescription: "Launch from Asteron Prime.",
    journeyObjectiveLabel: "Launch from Asteron Prime",
    assignmentType: "orientation",
    journeyTheme: "cyan",
    icon: "navigation",
    assignmentMode: "chapter",
    requiresAccept: false,
    autoActive: true,
    rewards: Object.freeze({ xp: 0, credits: 0 }),
    order: 20
  }),
  Object.freeze({
    id: "academy_first_trade",
    chapterId: "academy",
    journeyTitle: "Complete First Trade",
    journeyShortDescription: "Complete one profitable trade.",
    journeyObjectiveLabel: "Complete one profitable trade",
    assignmentType: "trade",
    journeyTheme: "gold",
    icon: "cargo",
    assignmentMode: "chapter",
    requiresAccept: false,
    autoActive: true,
    rewards: Object.freeze({ xp: 0, credits: 0 }),
    order: 30
  }),
  Object.freeze({
    id: "academy_two_guns",
    chapterId: "academy",
    journeyTitle: "Equip Two Guns",
    journeyShortDescription: "Equip two guns.",
    journeyObjectiveLabel: "Equip two guns",
    assignmentType: "combat",
    journeyTheme: "orange",
    icon: "combat",
    assignmentMode: "chapter",
    requiresAccept: false,
    autoActive: true,
    rewards: Object.freeze({ xp: 0, credits: 0 }),
    order: 40
  }),
  Object.freeze({
    id: "academy_daily_contract",
    chapterId: "academy",
    journeyTitle: "Complete a Daily Trade Contract",
    journeyShortDescription: "Deliver one fixed-route Daily Contract.",
    journeyObjectiveLabel: "Complete one Daily Contract delivery",
    assignmentType: "trade",
    journeyTheme: "gold",
    icon: "cargo",
    assignmentMode: "chapter",
    requiresAccept: false,
    autoActive: true,
    rewards: Object.freeze({ xp: 0, credits: 0 }),
    order: 35
  }),
  Object.freeze({
    id: "academy_attachment",
    chapterId: "academy",
    journeyTitle: "Equip Attachment",
    journeyShortDescription: "Equip one attachment.",
    journeyObjectiveLabel: "Equip one attachment",
    assignmentType: "resource",
    journeyTheme: "teal",
    icon: "resource",
    assignmentMode: "chapter",
    requiresAccept: false,
    autoActive: true,
    rewards: Object.freeze({ xp: 0, credits: 0 }),
    order: 50
  }),
  Object.freeze({
    id: "academy_erebus_bots",
    chapterId: "academy",
    journeyTitle: "Destroy 1 Erebus Bot",
    journeyShortDescription: "Destroy 1 Erebus bot.",
    journeyObjectiveLabel: "Destroy 1 Erebus bot",
    assignmentType: "combat",
    journeyTheme: "orange",
    icon: "combat",
    assignmentMode: "chapter",
    requiresAccept: false,
    autoActive: true,
    rewards: Object.freeze({ xp: 0, credits: 0 }),
    order: 60
  }),
  Object.freeze({
    id: "academy_bounty",
    chapterId: "academy",
    journeyTitle: "Complete a Bounty",
    journeyShortDescription: "Claim one completed bounty from the Bounty Board.",
    journeyObjectiveLabel: "Claim one completed bounty",
    assignmentType: "combat",
    journeyTheme: "orange",
    icon: "combat",
    assignmentMode: "chapter",
    requiresAccept: false,
    autoActive: true,
    rewards: Object.freeze({ xp: 0, credits: 0 }),
    order: 70
  }),
  Object.freeze({
    id: "academy_repair_ship",
    chapterId: "academy",
    journeyTitle: "Repair Ship",
    journeyShortDescription: "Repair your ship once.",
    journeyObjectiveLabel: "Repair your ship once",
    assignmentType: "certification",
    journeyTheme: "purple",
    icon: "certification",
    assignmentMode: "chapter",
    requiresAccept: false,
    autoActive: true,
    rewards: Object.freeze({ xp: 0, credits: 0 }),
    order: 80
  }),
  Object.freeze({
    id: "academy_pioneer_hull",
    chapterId: "academy",
    journeyTitle: "Purchase a Pioneer Hull",
    journeyShortDescription: "Earn and purchase a second Pioneer vessel.",
    journeyObjectiveLabel: "Own a second Pioneer hull",
    assignmentType: "certification",
    journeyTheme: "purple",
    icon: "certification",
    assignmentMode: "chapter",
    requiresAccept: false,
    autoActive: true,
    rewards: Object.freeze({ xp: 0, credits: 0 }),
    order: 90
  }),
  Object.freeze({
    id: "sector_orientation",
    chapterId: "frontier",
    journeyTitle: "Sector Orientation",
    journeyShortDescription: "Launch from a station or planet once.",
    journeyObjectiveLabel: "Launch from a station or planet once",
    assignmentType: "orientation",
    journeyTheme: "cyan",
    icon: "navigation",
    assignmentMode: "chapter",
    requiresAccept: false,
    autoActive: true,
    rewards: Object.freeze({ xp: 0, credits: 0 }),
    order: 10
  }),
  Object.freeze({
    id: "first_haul",
    chapterId: "frontier",
    journeyTitle: "First Haul",
    journeyShortDescription: "Complete 1 profitable cargo sale.",
    journeyObjectiveLabel: "Complete 1 profitable cargo sale",
    assignmentType: "trade",
    journeyTheme: "gold",
    icon: "cargo",
    assignmentMode: "chapter",
    requiresAccept: false,
    autoActive: true,
    rewards: Object.freeze({ xp: 0, credits: 0 }),
    order: 20
  }),
  Object.freeze({
    id: "resource_recovery",
    chapterId: "frontier",
    journeyTitle: "Resource Recovery",
    journeyShortDescription: "Mine and collect raw resources.",
    journeyObjectiveLabel: "Mine and collect 3 raw resources",
    assignmentType: "resource",
    journeyTheme: "teal",
    icon: "resource",
    assignmentMode: "chapter",
    requiresAccept: false,
    autoActive: true,
    rewards: Object.freeze({ xp: 0, credits: 0 }),
    order: 30
  }),
  Object.freeze({
    id: "erebus_patrol",
    chapterId: "frontier",
    journeyTitle: "Erebus Patrol Sweep",
    journeyShortDescription: "Destroy hostile Erebus ships.",
    journeyObjectiveLabel: "Destroy 3 hostile Erebus ships",
    assignmentType: "combat",
    journeyTheme: "orange",
    icon: "combat",
    assignmentMode: "chapter",
    requiresAccept: false,
    autoActive: true,
    rewards: Object.freeze({ xp: 0, credits: 0 }),
    order: 40
  })
]);

const MISSIONS_BY_ID = Object.freeze(Object.fromEntries(CHAPTER_MISSIONS.map(mission => [mission.id, mission])));
const JOURNEY_ASSIGNMENTS_BY_ID = Object.freeze(Object.fromEntries(JOURNEY_ASSIGNMENTS.map(assignment => [assignment.id, assignment])));
const JOURNEY_PROGRESS_VERSION = 2;

let missionProgress = createDefaultMissionProgress();
let selectedJourneyChapterId = "academy";
let journeyChapterRouteMessage = "";
let journeyChapterCompletionInFlight = false;

function createDefaultMissionProgress() {
  return {
    journeyVersion: JOURNEY_PROGRESS_VERSION,
    chapters: {
      academy: createDefaultJourneyChapterProgress("academy", MISSION_STATE_ACTIVE),
      frontier: createDefaultJourneyChapterProgress("frontier", MISSION_STATE_AVAILABLE),
      next_route: createDefaultJourneyChapterProgress("next_route", "locked")
    },
    eventKeys: {},
    missions: Object.fromEntries(CHAPTER_MISSIONS.map(mission => [
      mission.id,
      { id: mission.id, state: MISSION_STATE_AVAILABLE, progress: 0, completedAt: null, claimedAt: null }
    ]))
  };
}

function createDefaultJourneyChapterProgress(id, state) {
  return {
    id,
    state,
    completed: false,
    completedAt: null,
    rewardClaimed: false,
    rewardClaimedAt: null,
    rewardId: null
  };
}

function normalizeMissionState(value) {
  return [MISSION_STATE_AVAILABLE, MISSION_STATE_ACTIVE, MISSION_STATE_COMPLETED, MISSION_STATE_CLAIMED].includes(value)
    ? value
    : MISSION_STATE_AVAILABLE;
}

function normalizeMissionProgress(saved) {
  const defaults = createDefaultMissionProgress();
  const safe = saved && typeof saved === "object" ? saved : {};
  const missions = { ...defaults.missions };

  Object.keys(missions).forEach(id => {
    const source = safe.missions?.[id] || safe[id] || {};
    missions[id] = {
      ...missions[id],
      ...source,
      id,
      state: normalizeMissionState(source.state || missions[id].state) === MISSION_STATE_CLAIMED
        ? MISSION_STATE_COMPLETED
        : normalizeMissionState(source.state || missions[id].state),
      progress: Math.max(0, Math.floor(Number(source.progress || 0))),
      completedAt: source.completedAt || null,
      claimedAt: source.claimedAt || null
    };
  });

  const chapters = Object.fromEntries(Object.entries(defaults.chapters).map(([id, chapter]) => {
    const source = safe.chapters?.[id] && typeof safe.chapters[id] === "object" ? safe.chapters[id] : {};
    return [id, {
      ...chapter,
      ...source,
      id,
      completed: Boolean(source.completed),
      completedAt: source.completedAt || null,
      rewardClaimed: Boolean(source.rewardClaimed),
      rewardClaimedAt: source.rewardClaimedAt || null,
      rewardId: source.rewardId || null
    }];
  }));

  const sourceVersion = Math.max(0, Number(safe.journeyVersion || 0));
  if (sourceVersion < JOURNEY_PROGRESS_VERSION) {
    migrateLegacyJourneyChapters(chapters, missions);
  }

  const eventKeys = safe.eventKeys && typeof safe.eventKeys === "object" && !Array.isArray(safe.eventKeys)
    ? Object.fromEntries(Object.entries(safe.eventKeys).filter(([key, value]) => key && value === true))
    : {};

  return reconcileMissionAvailability({
    journeyVersion: JOURNEY_PROGRESS_VERSION,
    chapters,
    eventKeys,
    missions
  });
}

function migrateLegacyJourneyChapters(chapters, missions) {
  const assignmentFinished = id => [MISSION_STATE_COMPLETED, MISSION_STATE_CLAIMED].includes(
    normalizeMissionState(missions?.[id]?.state)
  );
  const academyIds = JOURNEY_ASSIGNMENTS.filter(assignment => assignment.chapterId === "academy").map(assignment => assignment.id);
  const academyProgressed = Boolean(
    playerProgress?.academyCompleted ||
    playerProgress?.chapterProgress?.academy?.completed ||
    academyIds.length && academyIds.every(assignmentFinished)
  );
  if (academyProgressed) markMigratedJourneyChapterClaimed(chapters.academy, "academy-completion-v1");

  const frontierPreviouslyPassed = assignmentFinished("frontier_certification") || Boolean(
    playerProgress?.chapterProgress?.frontier?.completed
  );
  if (frontierPreviouslyPassed) markMigratedJourneyChapterClaimed(chapters.frontier, "frontier-completion-v1");
}

function markMigratedJourneyChapterClaimed(chapter, rewardId) {
  if (!chapter) return;
  chapter.state = "complete";
  chapter.completed = true;
  chapter.completedAt = chapter.completedAt || new Date().toISOString();
  chapter.rewardClaimed = true;
  chapter.rewardClaimedAt = chapter.rewardClaimedAt || chapter.completedAt;
  chapter.rewardId = chapter.rewardId || rewardId;
}

function reconcileMissionAvailability(progress = missionProgress) {
  const next = progress && typeof progress === "object" ? progress : createDefaultMissionProgress();
  CHAPTER_MISSIONS.forEach(mission => {
    const state = next.missions?.[mission.id]?.state;
    if (!next.missions[mission.id]) {
      next.missions[mission.id] = { id: mission.id, state: MISSION_STATE_AVAILABLE, progress: 0, completedAt: null, claimedAt: null };
    }
    next.missions[mission.id].state = normalizeMissionState(state || next.missions[mission.id].state);
  });
  return next;
}

function getMissionState(id) {
  missionProgress = normalizeMissionProgress(missionProgress);
  return missionProgress.missions[id] || null;
}

function isMissionFinishedForPrerequisite(id, progress = missionProgress) {
  const state = progress?.missions?.[id]?.state;
  return state === MISSION_STATE_COMPLETED || state === MISSION_STATE_CLAIMED;
}

function isMissionAvailable(id, progress = missionProgress) {
  const mission = MISSIONS_BY_ID[id];
  if (!mission) return false;
  if (mission.objective.type !== "complete_missions") return true;
  return (mission.objective.requiredMissionIds || []).every(requiredId => isMissionFinishedForPrerequisite(requiredId, progress));
}

function isJourneyChapterAssignment(missionOrId) {
  const config = getJourneyAssignmentConfig(missionOrId);
  return config.assignmentMode === "chapter" && config.autoActive === true && config.requiresAccept === false;
}

function canProgressMissionFromEvent(mission, state, progress = missionProgress) {
  if (!mission || !state) return false;
  if ([MISSION_STATE_COMPLETED, MISSION_STATE_CLAIMED].includes(state.state)) return false;
  if (isJourneyChapterAssignment(mission) && mission.chapter !== getJourneyActiveChapterId()) return false;
  if (state.state === MISSION_STATE_ACTIVE) return true;
  if (!isJourneyChapterAssignment(mission)) return false;
  return state.state === MISSION_STATE_AVAILABLE && isMissionAvailable(mission.id, progress);
}

function getMissionRequiredAmount(mission) {
  if (mission.objective.type === "complete_missions") return mission.objective.requiredMissionIds?.length || 0;
  return Math.max(1, Number(mission.objective.required || 1));
}

function getMissionProgressAmount(mission, state = getMissionState(mission.id)) {
  if (mission.objective.type === "complete_missions") {
    return (mission.objective.requiredMissionIds || []).filter(isMissionFinishedForPrerequisite).length;
  }
  return Math.max(0, Math.min(getMissionRequiredAmount(mission), Number(state?.progress || 0)));
}

function getMissionObjectiveLabel(mission) {
  const required = getMissionRequiredAmount(mission);
  if (mission.objective.type === "launch_from_station") return `Launch from a station or planet ${required} time`;
  if (mission.objective.type === "profitable_trade") return `Complete ${required} profitable cargo sale`;
  if (mission.objective.type === "complete_daily_trade_contract") return "Complete one Daily Contract delivery";
  if (mission.objective.type === "recover_resource") return `Recover ${formatNumber(required)} cargo from mining or salvage`;
  if (mission.objective.type === "destroy_bot") return `Destroy ${formatNumber(required)} Erebus bot${required === 1 ? "" : "s"}`;
  if (mission.objective.type === "starter_ship_claimed") return "Claim or activate the starter ship";
  if (mission.objective.type === "equip_guns") return `Equip ${formatNumber(required)} gun${required === 1 ? "" : "s"}`;
  if (mission.objective.type === "equip_attachment") return `Equip ${formatNumber(required)} attachment${required === 1 ? "" : "s"}`;
  if (mission.objective.type === "repair_ship") return "Repair your ship once";
  if (mission.objective.type === "claim_bounty") return "Claim one completed bounty";
  if (mission.objective.type === "purchase_pioneer_hull") return "Own a second Pioneer hull";
  if (mission.objective.type === "complete_missions") return `Complete ${formatNumber(required)} Frontier readiness missions`;
  if (mission.objective.type === "credits_milestone") return `Reach CR ${formatNumber(required)}`;
  if (mission.objective.type === "upgrade_item") return `Upgrade ${formatNumber(required)} weapon or item`;
  return "Complete mission objective";
}

function getMissionStatusLabel(state) {
  if (!state) return "AVAILABLE";
  if (state.state === MISSION_STATE_CLAIMED) return "CLAIMED";
  if (state.state === MISSION_STATE_COMPLETED) return "READY";
  if (state.state === MISSION_STATE_ACTIVE) return "ACTIVE";
  return "AVAILABLE";
}

function getVisibleChapterMissions(chapterId = "frontier") {
  missionProgress = reconcileMissionAvailability(normalizeMissionProgress(missionProgress));
  return CHAPTER_MISSIONS.filter(mission => mission.chapter === chapterId);
}

function getPrimaryActiveMission() {
  missionProgress = normalizeMissionProgress(missionProgress);
  const activeChapterId = getJourneyActiveChapterId();
  return CHAPTER_MISSIONS.find(mission => mission.chapter === activeChapterId && missionProgress.missions[mission.id]?.state === MISSION_STATE_ACTIVE) ||
    CHAPTER_MISSIONS.find(mission => {
      const state = missionProgress.missions[mission.id];
      return mission.chapter === activeChapterId &&
        state?.state === MISSION_STATE_AVAILABLE &&
        isJourneyChapterAssignment(mission) &&
        isMissionAvailable(mission.id, missionProgress);
    }) ||
    null;
}

function acceptMission(id) {
  missionProgress = reconcileMissionAvailability(normalizeMissionProgress(missionProgress));
  const mission = MISSIONS_BY_ID[id];
  const state = missionProgress.missions[id];
  if (!mission || !state || state.state !== MISSION_STATE_AVAILABLE || !isMissionAvailable(id, missionProgress)) return false;

  state.state = MISSION_STATE_ACTIVE;
  state.progress = getMissionProgressAmount(mission, state);
  if (state.progress >= getMissionRequiredAmount(mission)) completeMission(id);
  if (typeof addActivityLog === "function") addActivityLog(`Mission accepted: ${mission.title}.`);
  refreshMissionDisplays();
  saveGame();
  return true;
}

function completeMission(id, options = {}) {
  const mission = MISSIONS_BY_ID[id];
  const state = missionProgress?.missions?.[id];
  if (!mission || !state || ![MISSION_STATE_ACTIVE, MISSION_STATE_AVAILABLE].includes(state.state)) return false;
  state.state = MISSION_STATE_COMPLETED;
  state.progress = getMissionRequiredAmount(mission);
  state.completedAt = state.completedAt || new Date().toISOString();
  const notify = options.notify !== false;
  if (notify && typeof addHudToast === "function") addHudToast(`Mission complete: ${mission.title}.`);
  if (notify && typeof addActivityLog === "function") addActivityLog(`Morgan: ${mission.completeText}`);
  reconcileMissionAvailability(missionProgress);
  if (options.refresh !== false) refreshMissionDisplays();
  return true;
}

function claimMissionReward(id) {
  missionProgress = normalizeMissionProgress(missionProgress);
  const mission = MISSIONS_BY_ID[id];
  const state = missionProgress.missions[id];
  if (!mission || !state || state.state !== MISSION_STATE_COMPLETED) return false;
  // Journey assignments are requirements only. Legacy claim calls intentionally grant nothing.
  state.claimedAt = state.claimedAt || new Date().toISOString();
  saveGame();
  return false;
}

function missionEventMatches(mission, eventType, payload = {}) {
  const objective = mission.objective || {};
  if (objective.type !== eventType) return false;
  if (eventType === "destroy_bot" && objective.target === "erebus") {
    const faction = String(payload.faction || payload.bot?.faction || payload.bot?.botType || "").toLowerCase();
    return !faction || faction.includes("erebus");
  }
  if (eventType === "recover_resource" && objective.target && objective.target !== "any") {
    return String(payload.resource || payload.resourceName || "").toLowerCase() === String(objective.target).toLowerCase();
  }
  return true;
}

function getMissionEventDedupeKey(eventType, payload = {}) {
  if (eventType !== "destroy_bot") return "";
  const key = String(
    payload.eventKey ||
    payload.dedupeKey ||
    payload.destructionInstanceId ||
    payload.botXpSourceEventId ||
    payload.rewardPreviewId ||
    payload.idempotencyKey ||
    ""
  ).trim();
  return key ? `${eventType}:${key}` : "";
}

function getLoadoutEntryKeyForMission(entry) {
  if (!entry) return "";
  if (typeof getEquipmentKey === "function") return String(getEquipmentKey(entry) || "").trim();
  return String(typeof entry === "string" ? entry : entry.key || "").trim();
}

function countMissionLoadoutEntries(entries, catalog = null) {
  if (!Array.isArray(entries)) return 0;
  return entries.reduce((count, entry) => {
    const key = getLoadoutEntryKeyForMission(entry);
    if (!key) return count;
    if (catalog && !catalog[key]) return count;
    return count + 1;
  }, 0);
}

function getCurrentMissionLoadoutCounts(shipId = "") {
  const activeShipId = String(shipId || currentShipId || "").trim();
  const loadout = !activeShipId
    ? { guns: [], attachments: [] }
    : typeof getShipLoadout === "function"
      ? getShipLoadout(activeShipId)
      : shipLoadouts?.[activeShipId] || { guns: [], attachments: [] };
  return {
    shipId: activeShipId,
    weaponCount: countMissionLoadoutEntries(loadout?.guns, typeof GUNS !== "undefined" ? GUNS : null),
    attachmentCount: countMissionLoadoutEntries(loadout?.attachments, typeof attachments !== "undefined" ? attachments : null)
  };
}

function hasClaimedStarterShipForMission() {
  const starterShipId = typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
  const safeOwnedShips = Array.isArray(ownedShips) ? ownedShips : [];
  return Boolean(
    starterShipId &&
    currentShipId === starterShipId &&
    safeOwnedShips.includes(starterShipId) &&
    SHIPS?.[starterShipId]
  );
}

function hasClaimedBountyForMission() {
  const claimedTotal = Math.max(0, Number(playerProgress?.totals?.bountiesClaimed || 0));
  const localClaim = Array.isArray(dailyBountyContracts) && dailyBountyContracts.some(contract => contract?.status === "claimed");
  return claimedTotal > 0 || localClaim;
}

function hasCompletedDailyTradeContractForMission() {
  return Array.isArray(dailyTradeContracts) &&
    dailyTradeContracts.some(contract => contract?.status === "complete");
}

function hasPurchasedPioneerHullForMission() {
  const starterShipId = typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
  const pioneerLineId = typeof PIONEER_LINE_ID !== "undefined" ? PIONEER_LINE_ID : "pioneer";
  return (Array.isArray(ownedShips) ? ownedShips : []).some(shipId => (
    shipId !== starterShipId &&
    SHIPS?.[shipId]?.lineId === pioneerLineId
  ));
}

function setMissionProgressAbsolute(id, amount, options = {}) {
  const mission = MISSIONS_BY_ID[id];
  const state = missionProgress?.missions?.[id];
  if (!mission || !state) return false;
  if ([MISSION_STATE_COMPLETED, MISSION_STATE_CLAIMED].includes(state.state)) return false;
  if (!isMissionAvailable(id, missionProgress)) return false;

  const required = getMissionRequiredAmount(mission);
  const nextProgress = Math.max(0, Math.min(required, Math.floor(Number(amount || 0))));
  const previousProgress = getMissionProgressAmount(mission, state);
  const previousState = state.state;
  state.progress = nextProgress;
  if (nextProgress > 0 && nextProgress < required && state.state === MISSION_STATE_AVAILABLE) {
    state.state = MISSION_STATE_ACTIVE;
  }
  if (nextProgress >= required) {
    completeMission(id, { refresh: false, notify: options.notify });
  }
  return previousProgress !== getMissionProgressAmount(mission, state) || previousState !== state.state;
}

function reconcileMissionProgressFromGameplayState(options = {}) {
  missionProgress = reconcileMissionAvailability(normalizeMissionProgress(missionProgress));
  const currentCounts = getCurrentMissionLoadoutCounts(options.shipId);
  const starterShipClaimed = options.starterShipClaimed === undefined
    ? hasClaimedStarterShipForMission()
    : Boolean(options.starterShipClaimed);
  const weaponCount = Number.isFinite(Number(options.weaponCount))
    ? Number(options.weaponCount)
    : currentCounts.weaponCount;
  const attachmentCount = Number.isFinite(Number(options.attachmentCount))
    ? Number(options.attachmentCount)
    : currentCounts.attachmentCount;
  const bountyClaimed = options.bountyClaimed === undefined
    ? hasClaimedBountyForMission()
    : Boolean(options.bountyClaimed);
  const dailyTradeContractCompleted = options.dailyTradeContractCompleted === undefined
    ? hasCompletedDailyTradeContractForMission()
    : Boolean(options.dailyTradeContractCompleted);
  const pioneerHullPurchased = options.pioneerHullPurchased === undefined
    ? hasPurchasedPioneerHullForMission()
    : Boolean(options.pioneerHullPurchased);
  let changed = false;

  changed = setMissionProgressAbsolute("academy_starter_ship", starterShipClaimed ? 1 : 0, options) || changed;
  changed = setMissionProgressAbsolute("academy_two_guns", weaponCount, options) || changed;
  changed = setMissionProgressAbsolute("academy_attachment", attachmentCount, options) || changed;
  changed = setMissionProgressAbsolute("academy_daily_contract", dailyTradeContractCompleted ? 1 : 0, options) || changed;
  changed = setMissionProgressAbsolute("academy_bounty", bountyClaimed ? 1 : 0, options) || changed;
  changed = setMissionProgressAbsolute("academy_pioneer_hull", pioneerHullPurchased ? 1 : 0, options) || changed;

  if (changed) {
    reconcileMissionAvailability(missionProgress);
    if (options.refresh !== false) refreshMissionDisplays();
    if (options.save !== false && typeof saveGame === "function") saveGame();
  }
  return {
    changed,
    shipId: currentCounts.shipId,
    starterShipClaimed,
    weaponCount,
    attachmentCount,
    dailyTradeContractCompleted,
    bountyClaimed,
    pioneerHullPurchased
  };
}

function recordMissionEvent(eventType, payload = {}) {
  missionProgress = reconcileMissionAvailability(normalizeMissionProgress(missionProgress));
  const dedupeKey = getMissionEventDedupeKey(eventType, payload);
  if (dedupeKey && missionProgress.eventKeys?.[dedupeKey]) return false;
  let changed = false;

  CHAPTER_MISSIONS.forEach(mission => {
    const state = missionProgress.missions[mission.id];
    if (!canProgressMissionFromEvent(mission, state, missionProgress) || !missionEventMatches(mission, eventType, payload)) return;

    const increment = eventType === "recover_resource"
      ? Math.max(1, Math.round(Number(payload.amount || payload.quantity || 1)))
      : eventType === "equip_guns" || eventType === "equip_attachment"
        ? Math.max(1, Math.round(Number(payload.count || payload.equippedCount || payload.amount || 1)))
      : 1;
    state.progress = Math.min(getMissionRequiredAmount(mission), Math.max(0, Number(state.progress || 0)) + increment);
    changed = true;
    if (state.state === MISSION_STATE_AVAILABLE && state.progress > 0 && state.progress < getMissionRequiredAmount(mission)) {
      state.state = MISSION_STATE_ACTIVE;
    }
    if (state.progress >= getMissionRequiredAmount(mission)) completeMission(mission.id);
  });

  CHAPTER_MISSIONS
    .filter(mission => mission.objective.type === "complete_missions")
    .forEach(mission => {
      const state = missionProgress.missions[mission.id];
      if (!canProgressMissionFromEvent(mission, state, missionProgress)) return;
      state.progress = getMissionProgressAmount(mission, state);
      if (state.state === MISSION_STATE_AVAILABLE && state.progress > 0 && state.progress < getMissionRequiredAmount(mission)) {
        state.state = MISSION_STATE_ACTIVE;
      }
      if (state.progress >= getMissionRequiredAmount(mission)) completeMission(mission.id);
      changed = true;
    });

  if (changed) {
    if (dedupeKey) {
      missionProgress.eventKeys = missionProgress.eventKeys && typeof missionProgress.eventKeys === "object"
        ? missionProgress.eventKeys
        : {};
      missionProgress.eventKeys[dedupeKey] = true;
    }
    refreshMissionDisplays();
    saveGame();
  }
  return changed;
}

function renderMorganCard(mission, state) {
  const isComplete = state?.state === MISSION_STATE_COMPLETED || state?.state === MISSION_STATE_CLAIMED;
  const text = isComplete ? mission.completeText : mission.briefing;
  return `
    <div class="morgan-card">
      <img class="morgan-card-portrait" src="assets/morgan-journey-guide.png" alt="Morgan">
      <div><span>Morgan / Command Liaison</span><p>${escapeHtml(text)}</p></div>
    </div>
  `;
}

function getJourneyChapterRequirementSummary(chapterId = "frontier") {
  missionProgress = normalizeMissionProgress(missionProgress);
  const requirements = getJourneyAssignments(chapterId).filter(assignment => {
    const mission = assignment.mission;
    return mission && mission.objective?.type !== "complete_missions";
  });
  const complete = requirements.filter(assignment => {
    const state = missionProgress.missions[assignment.id]?.state;
    return state === MISSION_STATE_COMPLETED || state === MISSION_STATE_CLAIMED;
  }).length;
  const total = requirements.length;
  const percent = Math.min(100, Math.round((complete / Math.max(1, total)) * 100));
  return { requirements, complete, total, percent };
}

function getJourneyAssignments(chapterId = "frontier") {
  return JOURNEY_ASSIGNMENTS
    .filter(assignment => assignment.chapterId === chapterId)
    .slice()
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
    .map(assignment => ({
      ...assignment,
      mission: MISSIONS_BY_ID[assignment.id] || null
    }));
}

function getJourneyAssignmentConfig(missionOrId) {
  const id = typeof missionOrId === "string" ? missionOrId : missionOrId?.id;
  const mission = typeof missionOrId === "string" ? MISSIONS_BY_ID[missionOrId] : missionOrId;
  const config = JOURNEY_ASSIGNMENTS_BY_ID[id] || {};
  return {
    id,
    chapterId: config.chapterId || mission?.chapter || "frontier",
    journeyTitle: config.journeyTitle || mission?.title || "Assignment",
    journeyShortDescription: config.journeyShortDescription || mission?.briefing || "",
    journeyObjectiveLabel: config.journeyObjectiveLabel || (mission ? getMissionObjectiveLabel(mission) : "Complete assignment"),
    assignmentType: config.assignmentType || "orientation",
    journeyTheme: config.journeyTheme || "cyan",
    icon: config.icon || "navigation",
    assignmentMode: config.assignmentMode || "mission",
    requiresAccept: config.requiresAccept !== false,
    autoActive: config.autoActive === true,
    order: Number(config.order || 0),
    rewards: config.rewards || mission?.reward || { xp: 0, credits: 0 },
    mission: mission || null
  };
}

function getJourneyActiveChapterId() {
  return isJourneyAcademyComplete() ? "frontier" : "academy";
}

function getJourneyChapterAssignmentTitle(chapterId = getJourneyActiveChapterId()) {
  return chapterId === "academy" ? "Academy Assignments" : "Frontier Assignments";
}

function syncSelectedJourneyChapter() {
  const activeId = getJourneyActiveChapterId();
  const selected = JOURNEY_CHAPTERS.find(chapter => chapter.id === selectedJourneyChapterId);
  const selectedState = selected ? getJourneyChapterRouteState(selected) : "locked";
  if (!selected || selectedState === "locked" || selectedState === "pending" || selectedState === "revealed") {
    selectedJourneyChapterId = activeId;
  }
}

function resetJourneySelectionToCurrent() {
  selectedJourneyChapterId = getJourneyActiveChapterId();
  journeyChapterRouteMessage = "";
}

function getGalaxyCompletionPercent() {
  missionProgress = normalizeMissionProgress(missionProgress);
  const assignments = JOURNEY_ASSIGNMENTS.filter(assignment => {
    const mission = assignment.mission || MISSIONS_BY_ID[assignment.id];
    return mission && mission.objective?.type !== "complete_missions";
  });
  if (!assignments.length) return 0;
  const completedUnits = assignments.reduce((total, assignment) => {
    const mission = assignment.mission || MISSIONS_BY_ID[assignment.id];
    const state = missionProgress.missions[mission.id];
    const required = Math.max(1, getMissionRequiredAmount(mission));
    const progress = getMissionProgressAmount(mission, state);
    return total + Math.min(1, progress / required);
  }, 0);
  const journeyContentWeight = 35;
  return Math.min(100, Math.round((completedUnits / assignments.length) * journeyContentWeight));
}

function renderJourneyScreen(options = {}) {
  reconcileMissionProgressFromGameplayState({ source: "journey_render", refresh: false, notify: false });
  const body = document.getElementById("journeyBody");
  const title = document.getElementById("journeyLocationTitle");
  if (title) title.textContent = String(currentNode || "Asteron Prime").toUpperCase();
  if (!body) return;
  const previousChapterId = body.dataset.journeySelectedChapter || "";
  const previousAssignmentScroll = Number(body.querySelector(".journey-assignment-grid")?.scrollTop || 0);
  syncSelectedJourneyChapter();
  const selectedChapterId = selectedJourneyChapterId;
  const resetAssignmentScroll = Boolean(options?.resetAssignments) || previousChapterId !== selectedChapterId;
  const selectedAssignments = getJourneyAssignments(selectedChapterId)
    .filter(assignment => assignment.mission?.objective?.type !== "complete_missions");
  const requirements = getJourneyChapterRequirementSummary(selectedChapterId);

  body.innerHTML = `
    ${renderJourneyMorganBriefing()}
    ${renderJourneyChapterPath()}
    <div class="journey-main-grid">
    <section class="journey-objectives-panel journey-current-path">
      <div class="journey-panel-head journey-assignment-head">
        <span>${escapeHtml(getJourneyChapterAssignmentTitle(selectedChapterId))}</span>
        <strong>${formatNumber(requirements.complete)} of ${formatNumber(requirements.total)} complete</strong>
      </div>
      ${renderJourneyAssignments(selectedAssignments)}
    </section>
    <aside class="journey-side-panel">${renderJourneyChapterReward(selectedChapterId)}</aside>
    </div>
    ${renderJourneyGalaxyCompletion()}
  `;
  body.dataset.journeyActiveChapter = getJourneyActiveChapterId();
  body.dataset.journeySelectedChapter = selectedChapterId;
  requestAnimationFrame(() => {
    const assignmentGrid = body.querySelector(".journey-assignment-grid");
    if (assignmentGrid) {
      const maximumScroll = Math.max(0, assignmentGrid.scrollHeight - assignmentGrid.clientHeight);
      assignmentGrid.scrollTop = resetAssignmentScroll ? 0 : Math.min(previousAssignmentScroll, maximumScroll);
    }
    updateJourneyChapterRouteScroll();
  });
}

function renderMissionJournal() {
  renderJourneyScreen();
}

function renderJourneyMorganBriefing() {
  const chapterId = selectedJourneyChapterId;
  const requirements = getJourneyChapterRequirementSummary(chapterId);
  const chapterComplete = isJourneyChapterComplete(chapterId);
  const briefingMessage = chapterComplete
    ? chapterId === "academy"
      ? "Academy is complete. Your certification and Frontier access are secured."
      : "Frontier is complete. Its rewards and route unlocks have been secured."
    : requirements.complete >= requirements.total
      ? chapterId === "academy"
        ? "All Academy assignments are complete. Finalise your certification to enter Frontier."
        : "All Frontier assignments are complete. Claim your chapter reward to continue."
      : chapterId === "academy"
        ? "Complete your remaining Academy assignments to qualify for Frontier operations."
        : "Complete your remaining Frontier assignments to reveal the next ship plan route.";
  return `
    <section class="journey-morgan-panel journey-briefing">
      <div class="journey-briefing__bg" aria-hidden="true"></div>
      <div class="journey-briefing__inner">
        <div class="journey-briefing__portrait">
          <img class="journey-briefing__portrait-img journey-morgan-portrait" src="assets/morgan-journey-guide.png" alt="Morgan">
        </div>
        <div class="journey-briefing__content journey-morgan-copy">
          <div class="journey-briefing__identity">
            <strong class="journey-briefing__name">MORGAN</strong>
            <em class="journey-briefing__role">COMMAND LIAISON</em>
          </div>
          <p class="journey-briefing__message">${escapeHtml(briefingMessage)}</p>
        </div>
      </div>
    </section>
  `;
}

function renderJourneyChapterPath() {
  const chapters = JOURNEY_CHAPTERS
    .slice()
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
  return `
    <nav class="journey-chapters-panel journey-chapter-route" aria-label="Journey chapters">
      <div class="journey-chapter-route__viewport">
        <button type="button" class="journey-chapter-route__arrow journey-chapter-route__arrow--left" onclick="scrollJourneyChapterRoute(-1)" aria-label="Scroll chapter route left">‹</button>
        <div id="journeyChapterRouteTrack" class="journey-chapter-route__track journey-chapter-path" data-journey-source="JOURNEY_CHAPTERS" aria-label="Chapter route" onscroll="updateJourneyChapterRouteScroll()">
          ${chapters.map(renderJourneyChapterNode).join("")}
        </div>
        <button type="button" class="journey-chapter-route__arrow journey-chapter-route__arrow--right" onclick="scrollJourneyChapterRoute(1)" aria-label="Scroll chapter route right">›</button>
      </div>
      <div class="journey-chapter-route__scrollbar" aria-hidden="true"><i id="journeyChapterRouteScrollThumb"></i></div>
      <p id="journeyChapterRouteMessage" class="journey-chapter-route__message" aria-live="polite">${escapeHtml(journeyChapterRouteMessage)}</p>
    </nav>
  `;
}

function getJourneyChapterStatusLabel(chapter) {
  const state = getJourneyChapterRouteState(chapter);
  if (state === "complete") return "COMPLETE";
  if (state === "active") return "CURRENT";
  if (state === "revealed") return "SIGNAL DETECTED";
  if (state === "locked") return "LOCKED";
  if (state === "pending" && chapter.id === "frontier") return "ACADEMY REQUIRED";
  if (state === "pending") return "PENDING";
  return String(chapter.status || "PENDING").toUpperCase();
}

function isJourneyAcademyComplete() {
  return Boolean(missionProgress?.chapters?.academy?.completed || missionProgress?.chapters?.academy?.rewardClaimed);
}

function isJourneyFrontierComplete() {
  return Boolean(missionProgress?.chapters?.frontier?.completed || missionProgress?.chapters?.frontier?.rewardClaimed);
}

function isJourneyChapterComplete(chapterId) {
  if (chapterId === "academy") return isJourneyAcademyComplete();
  if (chapterId === "frontier") return isJourneyFrontierComplete();
  return Boolean(missionProgress?.chapters?.[chapterId]?.completed);
}

function getJourneyChapterRouteState(chapter) {
  if (chapter.id === "academy" && isJourneyAcademyComplete()) return "complete";
  if (chapter.id === "academy") return "active";
  if (chapter.id === "frontier") {
    if (!isJourneyAcademyComplete()) return "pending";
    return isJourneyFrontierComplete() ? "complete" : "active";
  }
  if (chapter.id === "next_route" && isJourneyFrontierComplete()) return "revealed";
  return chapter.status || "pending";
}

function getJourneyChapterRouteIcon(chapter) {
  if (chapter.icon === "academy") return "assets/chapter-academy-icon.png";
  if (chapter.icon === "frontier") return "assets/chapter-frontier-icon.png";
  if (chapter.icon === "locked") return "assets/chapter-locked-icon.png";
  return "assets/chapter-frontier-icon.png";
}

function renderJourneyChapterNode(chapter) {
  const state = getJourneyChapterRouteState(chapter);
  const disabled = ["locked", "pending", "revealed"].includes(state);
  const selected = selectedJourneyChapterId === chapter.id && !disabled;
  const current = chapter.id === getJourneyActiveChapterId();
  const routeLabel = chapter.routeLabel || chapter.displayLabel || chapter.label;
  const routeTitle = state === "revealed"
    ? chapter.revealedRouteTitle || chapter.routeTitle || ""
    : chapter.routeTitle || "";
  const altText = chapter.id === "frontier" ? "Chapter I: Frontier" : state === "locked" ? "Locked route" : routeLabel;
  return `
    <button type="button" class="journey-chapter-route__item journey-chapter-route__item--${escapeHtml(state)} ${selected ? "journey-chapter-route__item--selected" : ""} ${current ? "journey-chapter-route__item--current" : ""} journey-chapter-node journey-chapter-${escapeHtml(state)} journey-chapter-node--${escapeHtml(state)} journey-chapter-theme-${escapeHtml(chapter.theme)}" data-journey-chapter-id="${escapeHtml(chapter.id)}" data-journey-chapter-state="${escapeHtml(state)}" onclick="selectJourneyChapterRoute('${escapeJsString(chapter.id)}')" aria-pressed="${selected ? "true" : "false"}" ${disabled ? "disabled aria-disabled=\"true\"" : ""} ${state === "locked" ? `title="${escapeHtml(chapter.unlockText || "Complete Frontier to reveal this route.")}"` : ""}>
      <div class="journey-chapter-route__icon journey-chapter-icon journey-chapter-icon--${escapeHtml(chapter.icon)}">
        <img src="${escapeHtml(getJourneyChapterRouteIcon(chapter))}" alt="${escapeHtml(altText)}">
      </div>
      ${state === "complete" ? `<span class="journey-chapter-route__check" aria-label="Complete">✓</span>` : ""}
      <span class="journey-chapter-route__copy journey-chapter-main">
        <strong class="journey-chapter-route__label">${escapeHtml(routeLabel)}</strong>
        ${routeTitle ? `<b class="journey-chapter-route__detail">${escapeHtml(routeTitle)}</b>` : ""}
        <em class="journey-chapter-route__status">${escapeHtml(getJourneyChapterStatusLabel(chapter))}</em>
      </span>
      ${!disabled ? `<span class="journey-chapter-route__chevron" aria-hidden="true">&rsaquo;</span>` : ""}
    </button>
  `;
}

function selectJourneyChapterRoute(id) {
  const chapter = JOURNEY_CHAPTERS.find(entry => entry.id === id);
  if (!chapter) return;
  const state = getJourneyChapterRouteState(chapter);
  if (["locked", "revealed", "pending"].includes(state)) return;
  selectedJourneyChapterId = id;
  journeyChapterRouteMessage = "";
  renderJourneyScreen({ resetAssignments: true });
  requestAnimationFrame(() => {
    document.querySelector(`[data-journey-chapter-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest", inline: "center" });
    updateJourneyChapterRouteScroll();
  });
}

function scrollJourneyChapterRoute(direction = 1) {
  const track = document.getElementById("journeyChapterRouteTrack");
  if (!track) return;
  track.scrollBy({ left: Number(direction || 1) * Math.max(220, track.clientWidth * 0.42), behavior: "smooth" });
  requestAnimationFrame(updateJourneyChapterRouteScroll);
}

function updateJourneyChapterRouteScroll() {
  const track = document.getElementById("journeyChapterRouteTrack");
  const thumb = document.getElementById("journeyChapterRouteScrollThumb");
  if (!track || !thumb) return;
  const scrollable = Math.max(1, track.scrollWidth - track.clientWidth);
  const width = Math.max(24, Math.min(100, Math.round((track.clientWidth / Math.max(track.scrollWidth, 1)) * 100)));
  const offset = Math.round((track.scrollLeft / scrollable) * Math.max(0, 100 - width));
  thumb.style.width = `${width}%`;
  thumb.style.transform = `translateX(${offset}%)`;
}

function renderJourneyAssignments(assignments) {
  const rows = (assignments || []).filter(assignment => assignment.mission);
  if (!rows.length) {
    return `
      <div class="journey-empty-objectives journey-assignment-empty">
        <strong>No active objectives.</strong>
        <span>Morgan has no active assignments for you right now.</span>
      </div>
    `;
  }

  return `<div class="journey-objective-list journey-assignment-grid" data-journey-source="JOURNEY_ASSIGNMENTS">${rows.map(renderJourneyAssignmentCard).join("")}</div>`;
}

function getJourneyAssignmentUiState(assignment, mission, state, locked = false) {
  if (locked) return "locked";
  if ([MISSION_STATE_COMPLETED, MISSION_STATE_CLAIMED].includes(state?.state)) return "complete";
  if (assignment.autoActive && assignment.requiresAccept === false) {
    const progress = getMissionProgressAmount(mission, state);
    if (state?.state === MISSION_STATE_ACTIVE || progress > 0) return "in-progress";
    return "incomplete";
  }
  return normalizeMissionState(state?.state);
}

function renderJourneyAssignmentCard(assignment) {
  const mission = assignment.mission || MISSIONS_BY_ID[assignment.id];
  const state = missionProgress.missions[mission.id];
  const progress = getMissionProgressAmount(mission, state);
  const required = getMissionRequiredAmount(mission);
  const locked = state?.state === MISSION_STATE_AVAILABLE && !isMissionAvailable(mission.id, missionProgress);
  const uiState = getJourneyAssignmentUiState(assignment, mission, state, locked);
  const complete = uiState === "complete";
  const accumulating = required > 1 && !complete;

  return `
    <article class="journey-objective-row journey-assignment-card mission-state-${escapeHtml(uiState)} journey-accent-${escapeHtml(assignment.assignmentType)} journey-assignment-card--${escapeHtml(assignment.journeyTheme)}" data-journey-assignment-id="${escapeHtml(assignment.id)}">
      <div class="journey-objective-marker journey-assignment-icon journey-assignment-icon--${escapeHtml(assignment.icon)}" aria-hidden="true">
        <img src="${escapeHtml(getJourneyAssignmentIconSrc(assignment))}" alt="">
      </div>
      <div class="journey-objective-copy">
        <div class="journey-objective-top">
          <strong>${escapeHtml(assignment.journeyTitle)}</strong>
          <span class="journey-assignment-status journey-assignment-status--${escapeHtml(uiState)}">${complete ? "Complete <b aria-hidden=\"true\">&#10003;</b>" : accumulating ? `${formatNumber(progress)} / ${formatNumber(required)}` : "Incomplete"}</span>
        </div>
        <p>${escapeHtml(assignment.journeyObjectiveLabel)}</p>
        ${accumulating ? `<div class="journey-assignment-progress-row">${renderJourneyProgressBar(progress, required)}</div>` : ""}
      </div>
    </article>
  `;
}

function getJourneyAssignmentIconSrc(assignment) {
  const icon = assignment?.icon || assignment?.assignmentType || "";
  if (icon === "navigation" || icon === "orientation") return "assets/journey-assignment-launch.png";
  if (icon === "cargo" || icon === "trade") return "assets/journey-assignment-cargo.png";
  if (icon === "resource") return "assets/journey-assignment-resource.png";
  if (icon === "combat") return "assets/journey-assignment-combat.png";
  if (icon === "certification") return "assets/journey-assignment-resource.png";
  return "assets/journey-assignment-launch.png";
}

function renderJourneyProgressBar(current, required) {
  const percent = Math.min(100, Math.round((Math.max(0, Number(current || 0)) / Math.max(1, Number(required || 1))) * 100));
  return `<div class="journey-progress-track journey-progress-bar"><i style="width:${percent}%"></i></div>`;
}

function getJourneyChapterConfig(chapterId) {
  return JOURNEY_CHAPTERS.find(chapter => chapter.id === chapterId) || null;
}

function renderJourneyChapterReward(chapterId = selectedJourneyChapterId) {
  const chapter = getJourneyChapterConfig(chapterId);
  const reward = chapter?.reward || {};
  const requirements = getJourneyChapterRequirementSummary(chapterId);
  const completed = isJourneyChapterComplete(chapterId);
  const ready = !completed && requirements.total > 0 && requirements.complete >= requirements.total;
  const remaining = Math.max(0, requirements.total - requirements.complete);
  const itemRewards = Array.isArray(reward.items) ? reward.items : [];
  const state = completed ? "completed" : ready ? "ready" : "incomplete";
  const supportingRewards = [
    Number(reward.credits || 0) > 0
      ? `<li><span aria-hidden="true">CR</span><strong>${formatNumber(reward.credits)} Credits</strong></li>`
      : "",
    ...itemRewards.map(item => `<li><span aria-hidden="true">+</span><strong>${escapeHtml(item.name || item.key || "Item")}</strong></li>`),
    reward.nextChapterLabel
      ? `<li><span aria-hidden="true">&#128274;</span><strong>${escapeHtml(reward.nextChapterLabel)}</strong></li>`
      : ""
  ].filter(Boolean).join("");
  const guidance = completed
    ? "Rewards secured. This chapter is complete."
    : ready
      ? "All assignments complete. Finalise the chapter to receive these rewards."
      : `Complete ${formatNumber(remaining)} remaining assignment${remaining === 1 ? "" : "s"} to unlock this reward.`;

  return `
    <section class="journey-reward-panel journey-reward-panel--${escapeHtml(state)}" data-journey-reward-state="${escapeHtml(state)}">
      <div class="journey-panel-head">
        <span>${escapeHtml(`${chapter?.shortLabel || "Chapter"} Chapter Reward`)}</span>
        ${completed ? `<strong>CHAPTER COMPLETE</strong>` : ""}
      </div>
      <div class="journey-reward-content">
        <div class="journey-reward-art ${reward.shipPlanId ? "journey-reward-art--blueprint" : ""}">
          <img src="${escapeHtml(reward.shipPlanImage || getJourneyChapterRouteIcon(chapter || {}))}" alt="${escapeHtml(reward.title || chapter?.displayLabel || "Chapter reward")}">
        </div>
        <div class="journey-reward-copy">
          <span>${escapeHtml(reward.typeLabel || "CHAPTER REWARD")}</span>
          <h3>${escapeHtml(reward.title || "Route Access")}</h3>
          <ul>${supportingRewards}</ul>
        </div>
      </div>
      <p class="journey-reward-guidance">${escapeHtml(guidance)}</p>
      ${completed
        ? `<div class="journey-chapter-complete-label">CHAPTER COMPLETE <span aria-hidden="true">&#10003;</span></div>`
        : `<button type="button" class="journey-complete-chapter" onclick="completeJourneyChapter('${escapeJsString(chapterId)}')" ${ready ? "" : "disabled"}>Complete Chapter</button>`}
    </section>
  `;
}

function grantJourneyChapterItem(item) {
  const quantity = Math.max(1, Math.floor(Number(item?.quantity || 1)));
  const key = String(item?.key || "").trim();
  if (!key) return;
  if (item.category === "gun" && typeof ownedGuns === "object") {
    ownedGuns[key] = Math.max(0, Number(ownedGuns[key] || 0)) + quantity;
  } else if (item.category === "attachment" && typeof ownedAttachments === "object") {
    ownedAttachments[key] = Math.max(0, Number(ownedAttachments[key] || 0)) + quantity;
  }
}

function completeJourneyChapter(chapterId = selectedJourneyChapterId) {
  if (journeyChapterCompletionInFlight) return false;
  missionProgress = normalizeMissionProgress(missionProgress);
  const chapter = getJourneyChapterConfig(chapterId);
  const reward = chapter?.reward;
  const requirements = getJourneyChapterRequirementSummary(chapterId);
  const chapterState = missionProgress.chapters?.[chapterId];
  if (!chapter || !chapterState || !reward || requirements.total < 1 || requirements.complete < requirements.total) return false;
  if (chapterState.completed || chapterState.rewardClaimed || chapterState.rewardId === reward.id) return false;

  journeyChapterCompletionInFlight = true;
  try {
    const completedAt = new Date().toISOString();
    chapterState.state = "complete";
    chapterState.completed = true;
    chapterState.completedAt = completedAt;
    chapterState.rewardClaimed = true;
    chapterState.rewardClaimedAt = completedAt;
    chapterState.rewardId = reward.id;

    credits = Math.max(0, Math.round(Number(credits || 0))) + Math.max(0, Math.round(Number(reward.credits || 0)));
    (Array.isArray(reward.items) ? reward.items : []).forEach(grantJourneyChapterItem);
    if (reward.shipPlanId) {
      unlockedShipPlans = Array.from(new Set([...(Array.isArray(unlockedShipPlans) ? unlockedShipPlans : []), reward.shipPlanId]));
    }
    if (reward.nextChapterId && missionProgress.chapters?.[reward.nextChapterId]) {
      missionProgress.chapters[reward.nextChapterId].state = MISSION_STATE_AVAILABLE;
    }

    if (typeof addHudToast === "function") addHudToast(`${chapter.shortLabel || chapter.displayLabel} complete. Chapter rewards secured.`);
    if (typeof addActivityLog === "function") addActivityLog(`Journey chapter complete: ${chapter.displayLabel || chapter.label}.`);
    saveGame();
    refreshMissionDisplays();
    updateSpaceHUD();
    return true;
  } finally {
    journeyChapterCompletionInFlight = false;
  }
}

function renderJourneyGalaxyCompletion() {
  const galaxyPercent = getGalaxyCompletionPercent();
  return `
    <section class="journey-galaxy-panel journey-galaxy-strip">
      <span>OVERALL GALAXY COMPLETION</span>
      ${renderJourneyProgressBar(galaxyPercent, 100)}
      <strong>${formatNumber(galaxyPercent)}%</strong>
    </section>
  `;
}

function getJourneyHudObjectiveDisplay(mission = getPrimaryActiveMission()) {
  if (!mission) return null;
  missionProgress = normalizeMissionProgress(missionProgress);
  const state = missionProgress.missions[mission.id];
  const progress = getMissionProgressAmount(mission, state);
  const required = getMissionRequiredAmount(mission);
  const ready = state?.state === MISSION_STATE_COMPLETED;
  const claimed = state?.state === MISSION_STATE_CLAIMED;
  const config = getJourneyAssignmentConfig(mission);
  const chapterLabel = mission.chapter === "academy" ? "ACADEMY" : "JOURNEY";
  return {
    mission,
    config,
    state,
    chapterLabel,
    progress,
    required,
    ready,
    claimed,
    hasReward: false,
    title: config.journeyTitle || mission.title,
    objective: config.journeyObjectiveLabel || getMissionObjectiveLabel(mission),
    status: ready || claimed ? "COMPLETE" : progress > 0 ? "IN PROGRESS" : "ACTIVE",
    hint: ready || claimed
      ? "Open Journey to review your chapter progress."
      : "Progress updates automatically as you play."
  };
}

function renderMissionObjectiveHud() {
  const display = getJourneyHudObjectiveDisplay();
  if (!display) {
    return `
      <div class="mission-objective-empty mission-objective-empty--journey">
        <strong>No active objective.</strong>
        <span>Open Journey to view your current chapter assignments.</span>
      </div>
    `;
  }
  const statusClass = display.ready || display.claimed
    ? "mission-objective-card--complete"
    : display.progress > 0
      ? "mission-objective-card--progress"
      : "mission-objective-card--active";

  return `
    <div class="objective-hud-card mission-objective-card orbit-objective-card ${statusClass}">
      <div class="objective-main-row objective-orbit-row">
        <div class="mission-objective-icon" aria-hidden="true">${display.ready || display.claimed ? "✓" : "◎"}</div>
        <div class="objective-copy objective-orbit-copy">
          <div class="objective-title-line">
            <span class="objective-type-pill mission-pill">${escapeHtml(display.chapterLabel)}</span>
            <strong>${escapeHtml(display.title)}</strong>
          </div>
          <span>${escapeHtml(display.objective)}</span>
          <em>${escapeHtml(display.hint)}</em>
        </div>
        <div class="objective-orbit-meta">
          <span>${formatNumber(display.progress)} / ${formatNumber(display.required)}</span>
          <strong>${escapeHtml(display.status)}</strong>
        </div>
      </div>
    </div>
  `;
}

function getChapterProgressSummary(chapterId = "frontier") {
  missionProgress = normalizeMissionProgress(missionProgress);
  const missions = CHAPTER_MISSIONS.filter(mission => mission.chapter === chapterId);
  const claimed = missions.filter(mission => missionProgress.missions[mission.id]?.state === MISSION_STATE_CLAIMED).length;
  const completedOrClaimed = missions.filter(mission => {
    const state = missionProgress.missions[mission.id]?.state;
    return state === MISSION_STATE_COMPLETED || state === MISSION_STATE_CLAIMED;
  }).length;
  return { chapter: CHAPTERS[chapterId], claimed, completedOrClaimed, total: missions.length };
}

function renderChapterProgressCard() {
  const summary = getChapterProgressSummary("frontier");
  const percent = Math.min(100, Math.round((summary.completedOrClaimed / Math.max(1, summary.total)) * 100));
  return `
    <div class="pilot-progression-card chapter-progress-card">
      <div class="profile-tree-head"><span>Galaxy Progress</span><strong>${escapeHtml(summary.chapter.title)}</strong></div>
      <div class="chapter-progress-panel">
        <div class="chapter-progress-mark">I</div>
        <div>
          <strong>${escapeHtml(summary.chapter.theme)}</strong>
          <em>${formatNumber(summary.completedOrClaimed)} / ${formatNumber(summary.total)} missions complete</em>
          <div class="profile-xp-track"><i style="width:${percent}%"></i></div>
          <p>Frontier certification is the current chapter foundation. Academy guidance will remain separate later.</p>
        </div>
      </div>
    </div>
  `;
}

function refreshMissionDisplays() {
  renderMissionJournal();
  if (typeof renderObjectiveHud === "function") renderObjectiveHud();
  if (typeof refreshTacticalPanel === "function") refreshTacticalPanel();
  const profileScreen = document.getElementById("pilotProfileScreen");
  if (profileScreen?.classList.contains("active") && typeof renderPilotProfile === "function") renderPilotProfile();
}

const originalRenderObjectiveHud = typeof renderObjectiveHud === "function" ? renderObjectiveHud : null;
if (originalRenderObjectiveHud) {
  renderObjectiveHud = function renderObjectiveHudWithMissions() {
    originalRenderObjectiveHud();
    const panel = document.getElementById("activeObjectiveSummary");
    if (!panel) return;
    const existingMissionSlot = document.getElementById("activeMissionSummary");
    if (existingMissionSlot) existingMissionSlot.remove();
    const hasGameplayObjective = !panel.querySelector(".objective-empty");
    if (!hasGameplayObjective) {
      panel.innerHTML = renderMissionObjectiveHud();
      const card = panel.querySelector(".mission-objective-card, .mission-objective-empty");
      if (card) card.id = "activeMissionSummary";
    }
  };
}
