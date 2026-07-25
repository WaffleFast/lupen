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
    title: "Destroy 3 Erebus Bots",
    chapter: "academy",
    giver: "Morgan",
    briefing: "Destroy 3 Erebus bots.",
    completeText: "Erebus bot exercise complete. Your combat telemetry is stable.",
    objective: Object.freeze({ type: "destroy_bot", target: "erebus", required: 3 }),
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
    id: "sector_orientation",
    title: "Sector Orientation",
    chapter: "frontier",
    giver: "Morgan",
    briefing: "Before we push deeper into Frontier, I want to confirm your launch systems. Take the ship out when you're ready, Pilot.",
    completeText: "Launch telemetry is clean. Your vessel is responsive, and the station has your beacon.",
    objective: Object.freeze({ type: "launch_from_station", required: 1 }),
    reward: Object.freeze({ xp: 25, credits: 100 })
  }),
  Object.freeze({
    id: "first_haul",
    title: "First Haul",
    chapter: "frontier",
    giver: "Morgan",
    briefing: "The trade network is live. Margins are small at this level, but every clean haul builds your reputation.",
    completeText: "Good trade discipline. Profit recorded and your route history is now building.",
    objective: Object.freeze({ type: "profitable_trade", required: 1 }),
    reward: Object.freeze({ xp: 50, credits: 250 })
  }),
  Object.freeze({
    id: "resource_recovery",
    title: "Resource Recovery",
    chapter: "frontier",
    giver: "Morgan",
    briefing: "I'm detecting loose mineral signatures in the lower lanes. Recover what you can. The station can always use raw material.",
    completeText: "Resource recovery confirmed. Small hauls keep stations alive out here.",
    objective: Object.freeze({ type: "recover_resource", target: "any", required: 3 }),
    reward: Object.freeze({ xp: 50, credits: 200 })
  }),
  Object.freeze({
    id: "erebus_patrol",
    title: "Erebus Patrol Sweep",
    chapter: "frontier",
    giver: "Morgan",
    briefing: "Erebus drones are moving through the lower sector. They are not yet a major threat, but left alone, they become one.",
    completeText: "Erebus signatures reduced. You handled contact well.",
    objective: Object.freeze({ type: "destroy_bot", target: "erebus", required: 3 }),
    reward: Object.freeze({ xp: 100, credits: 300 })
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
    reward: Object.freeze({ xp: 150, credits: 500 })
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
    progress: 0
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
    currentPathFallback: "Sector Orientation"
  }),
  Object.freeze({
    id: "next_route",
    order: 2,
    label: "Chapter II",
    displayLabel: "Chapter II",
    routeLabel: "Chapter II",
    routeTitle: "Locked Route",
    shortLabel: "Next Route",
    subtitle: "Complete Frontier to reveal.",
    status: "locked",
    theme: "locked",
    icon: "locked",
    progressMode: "static",
    progress: 0,
    unlockText: "Complete Frontier"
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
    journeyTitle: "Destroy 3 Erebus Bots",
    journeyShortDescription: "Destroy 3 Erebus bots.",
    journeyObjectiveLabel: "Destroy 3 Erebus bots",
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
    order: 70
  }),
  Object.freeze({
    id: "sector_orientation",
    chapterId: "frontier",
    journeyTitle: "Sector Orientation",
    journeyShortDescription: "Take the ship out and confirm your launch systems.",
    journeyObjectiveLabel: "Launch from a station or planet 1 time",
    assignmentType: "orientation",
    journeyTheme: "cyan",
    icon: "navigation",
    assignmentMode: "chapter",
    requiresAccept: false,
    autoActive: true,
    rewards: Object.freeze({ xp: 25, credits: 100 }),
    order: 10
  }),
  Object.freeze({
    id: "first_haul",
    chapterId: "frontier",
    journeyTitle: "First Haul",
    journeyShortDescription: "Complete one profitable trade and build your reputation.",
    journeyObjectiveLabel: "Complete 1 profitable cargo sale",
    assignmentType: "trade",
    journeyTheme: "gold",
    icon: "cargo",
    assignmentMode: "chapter",
    requiresAccept: false,
    autoActive: true,
    rewards: Object.freeze({ xp: 50, credits: 250 }),
    order: 20
  }),
  Object.freeze({
    id: "resource_recovery",
    chapterId: "frontier",
    journeyTitle: "Resource Recovery",
    journeyShortDescription: "Recover resources from the lower lanes.",
    journeyObjectiveLabel: "Recover 3 resources",
    assignmentType: "resource",
    journeyTheme: "teal",
    icon: "resource",
    assignmentMode: "chapter",
    requiresAccept: false,
    autoActive: true,
    rewards: Object.freeze({ xp: 50, credits: 200 }),
    order: 30
  }),
  Object.freeze({
    id: "erebus_patrol",
    chapterId: "frontier",
    journeyTitle: "Erebus Patrol Sweep",
    journeyShortDescription: "Destroy Erebus drones moving through Frontier space.",
    journeyObjectiveLabel: "Destroy 3 Erebus drones",
    assignmentType: "combat",
    journeyTheme: "orange",
    icon: "combat",
    assignmentMode: "chapter",
    requiresAccept: false,
    autoActive: true,
    rewards: Object.freeze({ xp: 100, credits: 300 }),
    order: 40
  }),
  Object.freeze({
    id: "frontier_certification",
    chapterId: "frontier",
    journeyTitle: "Frontier Certification",
    journeyShortDescription: "Complete the core Frontier assignments and certify your path.",
    journeyObjectiveLabel: "Complete 3 Frontier readiness missions",
    assignmentType: "certification",
    journeyTheme: "purple",
    icon: "certification",
    assignmentMode: "chapter",
    requiresAccept: false,
    autoActive: true,
    rewards: Object.freeze({ xp: 150, credits: 500 }),
    order: 50
  })
]);

const MISSIONS_BY_ID = Object.freeze(Object.fromEntries(CHAPTER_MISSIONS.map(mission => [mission.id, mission])));
const JOURNEY_ASSIGNMENTS_BY_ID = Object.freeze(Object.fromEntries(JOURNEY_ASSIGNMENTS.map(assignment => [assignment.id, assignment])));

let missionProgress = createDefaultMissionProgress();
let selectedJourneyChapterId = "academy";
let journeyChapterRouteMessage = "";

function createDefaultMissionProgress() {
  return {
    chapters: {
      academy: { id: "academy", state: MISSION_STATE_ACTIVE, completed: false },
      frontier: { id: "frontier", state: MISSION_STATE_AVAILABLE }
    },
    eventKeys: {},
    missions: Object.fromEntries(CHAPTER_MISSIONS.map(mission => [
      mission.id,
      { id: mission.id, state: MISSION_STATE_AVAILABLE, progress: 0, completedAt: null, claimedAt: null }
    ]))
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
      state: normalizeMissionState(source.state || missions[id].state),
      progress: Math.max(0, Math.floor(Number(source.progress || 0))),
      completedAt: source.completedAt || null,
      claimedAt: source.claimedAt || null
    };
  });

  const chapters = {
    ...defaults.chapters,
    ...(safe.chapters && typeof safe.chapters === "object" ? safe.chapters : {})
  };

  const eventKeys = safe.eventKeys && typeof safe.eventKeys === "object" && !Array.isArray(safe.eventKeys)
    ? Object.fromEntries(Object.entries(safe.eventKeys).filter(([key, value]) => key && value === true))
    : {};

  return reconcileMissionAvailability({ chapters, eventKeys, missions });
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
  if (mission.objective.type === "recover_resource") return `Recover ${formatNumber(required)} cargo from mining or salvage`;
  if (mission.objective.type === "destroy_bot") return `Destroy ${formatNumber(required)} Erebus bot${required === 1 ? "" : "s"}`;
  if (mission.objective.type === "starter_ship_claimed") return "Claim or activate the starter ship";
  if (mission.objective.type === "equip_guns") return `Equip ${formatNumber(required)} gun${required === 1 ? "" : "s"}`;
  if (mission.objective.type === "equip_attachment") return `Equip ${formatNumber(required)} attachment${required === 1 ? "" : "s"}`;
  if (mission.objective.type === "repair_ship") return "Repair your ship once";
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
  return CHAPTER_MISSIONS.find(mission => missionProgress.missions[mission.id]?.state === MISSION_STATE_COMPLETED) ||
    CHAPTER_MISSIONS.find(mission => missionProgress.missions[mission.id]?.state === MISSION_STATE_ACTIVE) ||
    CHAPTER_MISSIONS.find(mission => {
      const state = missionProgress.missions[mission.id];
      return state?.state === MISSION_STATE_AVAILABLE && isJourneyChapterAssignment(mission) && isMissionAvailable(mission.id, missionProgress);
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

  const rewardCredits = Math.max(0, Math.round(Number(mission.reward.credits || 0)));
  const rewardXp = Math.max(0, Math.round(Number(mission.reward.xp || 0)));
  credits = Math.max(0, Math.round(Number(credits || 0))) + rewardCredits;
  if (rewardXp > 0 && typeof addCombatXp === "function") addCombatXp(rewardXp, "mission");
  state.state = MISSION_STATE_CLAIMED;
  state.claimedAt = new Date().toISOString();
  if (typeof addHudToast === "function") addHudToast(`Mission reward claimed: +${formatNumber(rewardXp)} XP / CR ${formatNumber(rewardCredits)}.`);
  if (typeof addActivityLog === "function") addActivityLog(`Mission reward claimed: ${mission.title}.`);
  reconcileMissionAvailability(missionProgress);
  refreshMissionDisplays();
  updateSpaceHUD();
  saveGame();
  return true;
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
  const loadout = activeShipId && typeof getShipLoadout === "function"
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
  let changed = false;

  changed = setMissionProgressAbsolute("academy_starter_ship", starterShipClaimed ? 1 : 0, options) || changed;
  changed = setMissionProgressAbsolute("academy_two_guns", weaponCount, options) || changed;
  changed = setMissionProgressAbsolute("academy_attachment", attachmentCount, options) || changed;

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
    attachmentCount
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
      <img class="morgan-card-portrait" src="assets/morgan-thumbnail.png" alt="Morgan">
      <div><span>Morgan / Command Liaison</span><p>${escapeHtml(text)}</p></div>
    </div>
  `;
}

function getChapterProgressPercent(chapterId = "frontier") {
  const summary = getChapterProgressSummary(chapterId);
  return Math.min(100, Math.round((summary.completedOrClaimed / Math.max(1, summary.total)) * 100));
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

function getJourneyMissionRows() {
  missionProgress = normalizeMissionProgress(missionProgress);
  return getJourneyAssignments(getJourneyActiveChapterId()).map(assignment => assignment.mission).filter(Boolean);
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

function getJourneyPrimaryMission() {
  missionProgress = normalizeMissionProgress(missionProgress);
  return getPrimaryActiveMission() ||
    CHAPTER_MISSIONS.find(mission => missionProgress.missions[mission.id]?.state === MISSION_STATE_AVAILABLE && isMissionAvailable(mission.id, missionProgress)) ||
    CHAPTER_MISSIONS.find(mission => missionProgress.missions[mission.id]?.state !== MISSION_STATE_CLAIMED) ||
    null;
}

function getJourneyActiveChapterId() {
  return isJourneyAcademyComplete() ? "frontier" : "academy";
}

function getJourneyActiveChapter() {
  const activeId = getJourneyActiveChapterId();
  return JOURNEY_CHAPTERS.find(chapter => chapter.id === activeId) || JOURNEY_CHAPTERS[0];
}

function getJourneyChapterAssignmentTitle(chapterId = getJourneyActiveChapterId()) {
  return chapterId === "academy" ? "Academy Assignments" : "Frontier Assignments";
}

function syncSelectedJourneyChapter() {
  const activeId = getJourneyActiveChapterId();
  const selected = JOURNEY_CHAPTERS.find(chapter => chapter.id === selectedJourneyChapterId);
  const selectedState = selected ? getJourneyChapterRouteState(selected) : "locked";
  if (!selected || selectedState === "locked" || selectedState === "pending" || (activeId === "frontier" && selectedJourneyChapterId === "academy")) {
    selectedJourneyChapterId = activeId;
  }
}

function getJourneyObjectiveLine(mission) {
  if (!mission) return "Current Path: Sector Orientation";
  return `Current Path: ${getJourneyObjectiveTitle(mission)}`;
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
  const previousChapterId = body.dataset.journeyActiveChapter || "";
  const previousAssignmentScroll = Number(body.querySelector(".journey-assignment-grid")?.scrollTop || 0);
  syncSelectedJourneyChapter();
  const activeChapterId = getJourneyActiveChapterId();
  const resetAssignmentScroll = Boolean(options?.resetAssignments) || previousChapterId !== activeChapterId;
  const activeAssignments = getJourneyAssignments(activeChapterId)
    .filter(assignment => assignment.mission?.objective?.type !== "complete_missions");
  const requirements = getJourneyChapterRequirementSummary(activeChapterId);

  body.innerHTML = `
    ${renderJourneyMorganBriefing()}
    ${renderJourneyChapterPath()}
    <section class="journey-objectives-panel journey-current-path">
      <div class="journey-panel-head journey-assignment-head">
        <div>
          <small>CURRENT PATH</small>
          <span>${escapeHtml(getJourneyChapterAssignmentTitle(activeChapterId))}</span>
        </div>
        <strong>${formatNumber(requirements.complete)} / ${formatNumber(requirements.total)} COMPLETE</strong>
      </div>
      ${renderJourneyAssignments(activeAssignments)}
    </section>
    <aside class="journey-side-panel">${renderJourneyFrontierStatus()}</aside>
    ${renderJourneyGalaxyCompletion()}
  `;
  body.dataset.journeyActiveChapter = activeChapterId;
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
  return `
    <section class="journey-morgan-panel journey-briefing">
      <div class="journey-briefing__bg" aria-hidden="true"></div>
      <div class="journey-briefing__inner">
        <div class="journey-briefing__portrait">
          <img class="journey-briefing__portrait-img journey-morgan-portrait" src="assets/morgan-command-liaison.png" alt="Morgan">
        </div>
        <div class="journey-briefing__content journey-morgan-copy">
          <strong class="journey-briefing__name">MORGAN</strong>
          <em class="journey-briefing__role">COMMAND LIAISON</em>
          <div class="journey-briefing__signal">
            <span class="journey-briefing__eyebrow"><i aria-hidden="true"></i>FRONTIER BRIEFING</span>
            <div class="journey-briefing__waveform journey-waveform" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
          </div>
          <p class="journey-briefing__message">Frontier is active, Pilot. Complete these assignments and we'll open the next path.</p>
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
    <section class="journey-chapters-panel journey-chapter-route">
      <div class="journey-chapter-route__head">
        <span class="journey-chapter-route__rule" aria-hidden="true"></span>
        <span class="journey-chapter-route__title">CHAPTER ROUTE</span>
        <span class="journey-chapter-route__rule" aria-hidden="true"></span>
      </div>
      <div class="journey-chapter-route__viewport">
        <button type="button" class="journey-chapter-route__arrow journey-chapter-route__arrow--left" onclick="scrollJourneyChapterRoute(-1)" aria-label="Scroll chapter route left">‹</button>
        <div id="journeyChapterRouteTrack" class="journey-chapter-route__track journey-chapter-path" data-journey-source="JOURNEY_CHAPTERS" aria-label="Chapter route" onscroll="updateJourneyChapterRouteScroll()">
          ${chapters.map(renderJourneyChapterNode).join("")}
        </div>
        <button type="button" class="journey-chapter-route__arrow journey-chapter-route__arrow--right" onclick="scrollJourneyChapterRoute(1)" aria-label="Scroll chapter route right">›</button>
      </div>
      <div class="journey-chapter-route__scrollbar" aria-hidden="true"><i id="journeyChapterRouteScrollThumb"></i></div>
      <p id="journeyChapterRouteMessage" class="journey-chapter-route__message" aria-live="polite">${escapeHtml(journeyChapterRouteMessage)}</p>
    </section>
  `;
}

function getJourneyChapterBadge(chapter) {
  if (chapter.id === "academy") return "A";
  if (chapter.id === "frontier") return "I";
  return "?";
}

function getJourneyChapterProgress(chapter) {
  if (chapter.progressMode === "missions") return getChapterProgressPercent(chapter.id);
  return Number(chapter.progress || 0);
}

function getJourneyChapterStatusLabel(chapter) {
  const state = getJourneyChapterRouteState(chapter);
  if (state === "complete") return "COMPLETE";
  if (state === "active") return "ACTIVE";
  if (state === "locked") return "LOCKED";
  if (state === "pending") return "PENDING";
  return String(chapter.status || "PENDING").toUpperCase();
}

function isJourneyAcademyComplete() {
  if (
    playerProgress?.academyCompleted ||
    playerProgress?.chapterProgress?.academy?.completed ||
    missionProgress?.academy?.completed
  ) {
    return true;
  }
  const academyAssignments = JOURNEY_ASSIGNMENTS.filter(assignment => assignment.chapterId === "academy");
  if (!academyAssignments.length) return false;
  const states = missionProgress?.missions || {};
  return academyAssignments.every(assignment => {
    const state = states[assignment.id]?.state;
    return state === MISSION_STATE_COMPLETED || state === MISSION_STATE_CLAIMED;
  });
}

function getJourneyChapterRouteState(chapter) {
  if (chapter.id === "academy" && isJourneyAcademyComplete()) return "complete";
  if (chapter.id === "academy") return "active";
  if (chapter.id === "frontier") return isJourneyAcademyComplete() ? "active" : "pending";
  return chapter.status || "pending";
}

function getJourneyChapterRouteIcon(chapter) {
  if (chapter.icon === "academy") return "assets/chapter-academy-icon.png";
  if (chapter.icon === "frontier") return "assets/chapter-frontier-icon.png";
  if (chapter.icon === "locked") return "assets/chapter-locked-icon.png";
  return "assets/chapter-frontier-icon.png";
}

function getJourneyChapterRouteSubtitle(chapter) {
  const state = getJourneyChapterRouteState(chapter);
  if (state === "complete") return "Completed";
  if (state === "active") return "Active";
  if (state === "locked") return "Locked";
  if (chapter.id === "frontier" && state === "pending") return "Pending";
  return chapter.subtitle || "";
}

function renderJourneyChapterNode(chapter) {
  const state = getJourneyChapterRouteState(chapter);
  const selected = selectedJourneyChapterId === chapter.id && state !== "locked";
  const routeLabel = chapter.routeLabel || chapter.displayLabel || chapter.label;
  const routeTitle = chapter.routeTitle || "";
  const altText = chapter.id === "frontier" ? "Chapter I: Frontier" : state === "locked" ? "Locked route" : routeLabel;
  return `
    <button type="button" class="journey-chapter-route__item journey-chapter-route__item--${escapeHtml(state)} ${selected ? "journey-chapter-route__item--selected" : ""} journey-chapter-node journey-chapter-${escapeHtml(state)} journey-chapter-node--${escapeHtml(state)} journey-chapter-theme-${escapeHtml(chapter.theme)}" data-journey-chapter-id="${escapeHtml(chapter.id)}" data-journey-chapter-state="${escapeHtml(state)}" onclick="selectJourneyChapterRoute('${escapeJsString(chapter.id)}')" aria-pressed="${selected ? "true" : "false"}" ${state === "locked" ? `title="${escapeHtml(chapter.unlockText || "Complete Frontier to reveal this route.")}"` : ""}>
      <div class="journey-chapter-route__icon journey-chapter-icon journey-chapter-icon--${escapeHtml(chapter.icon)}">
        <img src="${escapeHtml(getJourneyChapterRouteIcon(chapter))}" alt="${escapeHtml(altText)}">
      </div>
      ${state === "complete" ? `<span class="journey-chapter-route__check" aria-label="Complete">✓</span>` : ""}
      <span class="journey-chapter-route__copy journey-chapter-main">
        <strong class="journey-chapter-route__label">${escapeHtml(routeLabel)}</strong>
        ${routeTitle ? `<b class="journey-chapter-route__detail">${escapeHtml(routeTitle)}</b>` : ""}
        <em class="journey-chapter-route__status">${escapeHtml(getJourneyChapterStatusLabel(chapter))}</em>
      </span>
    </button>
  `;
}

function selectJourneyChapterRoute(id) {
  const chapter = JOURNEY_CHAPTERS.find(entry => entry.id === id);
  if (!chapter) return;
  const state = getJourneyChapterRouteState(chapter);
  if (state === "locked") {
    journeyChapterRouteMessage = chapter.unlockText || "Complete Frontier to reveal this route.";
  } else if (state === "pending") {
    journeyChapterRouteMessage = chapter.id === "frontier"
      ? "Complete Academy to activate Chapter I: Frontier."
      : "This chapter is not active yet.";
  } else if (id === "academy") {
    selectedJourneyChapterId = id;
    journeyChapterRouteMessage = "";
  } else {
    selectedJourneyChapterId = id;
    journeyChapterRouteMessage = "";
  }
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

function renderJourneyObjectiveRows() {
  return renderJourneyAssignments(getJourneyAssignments(getJourneyActiveChapterId()));
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

function getJourneyObjectiveTitle(mission) {
  return getJourneyAssignmentConfig(mission).journeyTitle;
}

function getJourneyObjectiveDescription(mission) {
  return getJourneyAssignmentConfig(mission).journeyShortDescription;
}

function getJourneyObjectiveAccent(mission) {
  return getJourneyAssignmentConfig(mission).assignmentType;
}

function getJourneyObjectiveLabel(mission) {
  return getJourneyAssignmentConfig(mission).journeyObjectiveLabel;
}

function getJourneyAssignmentUiState(assignment, mission, state, locked = false) {
  if (locked) return "locked";
  if (state?.state === MISSION_STATE_COMPLETED) return "claimable";
  if (state?.state === MISSION_STATE_CLAIMED) return "claimed";
  if (assignment.autoActive && assignment.requiresAccept === false) {
    const progress = getMissionProgressAmount(mission, state);
    if (state?.state === MISSION_STATE_ACTIVE || progress > 0) return "in-progress";
    return "incomplete";
  }
  return normalizeMissionState(state?.state);
}

function renderJourneyObjectiveRow(mission) {
  return renderJourneyAssignmentCard(getJourneyAssignmentConfig(mission));
}

function renderJourneyAssignmentCard(assignment) {
  const mission = assignment.mission || MISSIONS_BY_ID[assignment.id];
  const state = missionProgress.missions[mission.id];
  const progress = getMissionProgressAmount(mission, state);
  const required = getMissionRequiredAmount(mission);
  const locked = state?.state === MISSION_STATE_AVAILABLE && !isMissionAvailable(mission.id, missionProgress);
  const uiState = getJourneyAssignmentUiState(assignment, mission, state, locked);
  const requiresAccept = assignment.requiresAccept !== false;
  const canAccept = requiresAccept && state?.state === MISSION_STATE_AVAILABLE && !locked;
  const rewards = assignment.rewards || mission.reward || {};
  const hasReward = Math.max(0, Number(rewards.xp || 0)) > 0 || Math.max(0, Number(rewards.credits || 0)) > 0;
  const canClaim = state?.state === MISSION_STATE_COMPLETED && hasReward;
  const action = canClaim
    ? `<button type="button" onclick="claimMissionReward('${escapeJsString(mission.id)}')">Claim Reward</button>`
    : canAccept
      ? `<button type="button" onclick="acceptMission('${escapeJsString(mission.id)}')">Accept Mission</button>`
      : "";

  return `
    <article class="journey-objective-row journey-assignment-card mission-state-${escapeHtml(uiState)} journey-accent-${escapeHtml(assignment.assignmentType)} journey-assignment-card--${escapeHtml(assignment.journeyTheme)}" data-journey-assignment-id="${escapeHtml(assignment.id)}">
      <div class="journey-objective-marker journey-assignment-icon journey-assignment-icon--${escapeHtml(assignment.icon)}" aria-hidden="true">
        <img src="${escapeHtml(getJourneyAssignmentIconSrc(assignment))}" alt="">
      </div>
      <div class="journey-objective-copy">
        <div class="journey-objective-top">
          <strong>${escapeHtml(assignment.journeyTitle)}</strong>
          ${renderJourneyAssignmentStatePill(uiState, hasReward)}
        </div>
        <p>${escapeHtml(assignment.journeyObjectiveLabel)}</p>
        <div class="journey-assignment-progress-row">
          ${renderJourneyProgressBar(progress, required)}
          <b>${formatNumber(progress)} / ${formatNumber(required)}</b>
          ${renderJourneyRewardChips(rewards)}
        </div>
        ${action ? `<div class="journey-objective-action">${action}</div>` : ""}
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

function renderJourneyAssignmentStatePill(state, hasReward = true) {
  const normalized = String(state || "").toLowerCase();
  if (normalized === "claimable") {
    return renderJourneyStatusPill("completed");
  }
  if (normalized === "claimed") return renderJourneyStatusPill("completed");
  if (normalized === "in-progress") return renderJourneyStatusPill("in-progress");
  if (normalized === "locked") return renderJourneyStatusPill("locked");
  return "";
}

function renderJourneyStatusPill(state, label = "") {
  const normalized = String(state || MISSION_STATE_AVAILABLE).toLowerCase();
  const text = label || (
    normalized === "claimable" ? "CLAIM READY" :
      normalized === "claimed" ? "CLAIMED" :
        normalized === "completed" ? "COMPLETE" :
          normalized === "tracking" ? "TRACKING" :
            normalized === "in-progress" ? "IN PROGRESS" :
              normalized === "not-started" ? "NOT STARTED" :
        normalized === MISSION_STATE_COMPLETED ? "COMPLETE" :
          normalized === MISSION_STATE_CLAIMED ? "COMPLETE" :
            normalized === MISSION_STATE_ACTIVE ? "ACTIVE" :
              normalized === "locked" ? "LOCKED" :
                normalized === "pending" ? "PENDING" :
                  normalized === MISSION_STATE_AVAILABLE ? "AVAILABLE" :
                    normalized.toUpperCase()
  );
  return `<span class="journey-status-pill journey-status-pill--${escapeHtml(normalized)}">${escapeHtml(text)}</span>`;
}

function renderJourneyRewardChips(rewards = {}) {
  const xp = Math.max(0, Math.round(Number(rewards.xp || 0)));
  const credits = Math.max(0, Math.round(Number(rewards.credits || 0)));
  const chips = [];
  if (xp > 0) chips.push(`<span class="journey-reward-chip journey-reward-chip--xp">${formatNumber(xp)} XP</span>`);
  if (credits > 0) chips.push(`<span class="journey-reward-chip journey-reward-chip--credits">${formatNumber(credits)} CR</span>`);
  if (!chips.length) return "";
  return `<div class="journey-reward-chips">${chips.join("")}</div>`;
}

function renderJourneyProgressBar(current, required) {
  const percent = Math.min(100, Math.round((Math.max(0, Number(current || 0)) / Math.max(1, Number(required || 1))) * 100));
  return `<div class="journey-progress-track journey-progress-bar"><i style="width:${percent}%"></i></div>`;
}

function renderJourneyFrontierStatus() {
  const activeChapter = getJourneyActiveChapter();
  const activeChapterId = activeChapter?.id || "academy";
  const requirements = getJourneyChapterRequirementSummary(activeChapterId);
  const label = activeChapterId === "frontier" ? "Frontier Progress" : "Academy Progress";
  const assignments = getJourneyAssignments(activeChapterId)
    .filter(assignment => assignment.mission?.objective?.type !== "complete_missions")
    .map(assignment => {
      const mission = assignment.mission || MISSIONS_BY_ID[assignment.id];
      const state = missionProgress.missions[mission.id];
      const progress = getMissionProgressAmount(mission, state);
      const required = getMissionRequiredAmount(mission);
      return { assignment, progress, required, remaining: Math.max(0, required - progress) };
    })
    .filter(entry => entry.remaining > 0)
    .sort((left, right) => {
      const leftOrder = Number(left.assignment?.order || 0);
      const rightOrder = Number(right.assignment?.order || 0);
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.remaining - right.remaining;
    });
  const recommended = assignments[0] || null;
  const nextUnlock = activeChapterId === "academy" ? "Chapter I · Frontier" : "Chapter II Route";
  return `
    <section class="journey-summary-panel journey-frontier-status">
      <div class="journey-panel-head"><span>CHAPTER PROGRESS</span></div>
      <div class="journey-summary-compact">
        <div class="journey-summary-compact__metric">
          <span>${escapeHtml(label)}</span>
          <strong>${formatNumber(requirements.percent)}%</strong>
        </div>
        ${renderJourneyProgressBar(requirements.percent, 100)}
        <div class="journey-summary-compact__requirements">
          <span>Requirements Complete</span>
          <strong>${formatNumber(requirements.complete)} / ${formatNumber(requirements.total)}</strong>
        </div>
        <div class="journey-summary-next">
          <span>NEXT OBJECTIVE</span>
          <strong>${escapeHtml(recommended?.assignment?.journeyTitle || "Chapter complete")}</strong>
          <small>${recommended ? `${formatNumber(recommended.remaining)} remaining` : "All assignments complete"}</small>
        </div>
        <div class="journey-summary-unlock">
          <span>NEXT UNLOCK</span>
          <strong>${escapeHtml(nextUnlock)}</strong>
        </div>
      </div>
    </section>
  `;
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

function renderJourneySummaryRow(label, value) {
  return `
    <div class="journey-summary-row">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderJourneyProgressSummaryRow(label, value, percent = 0) {
  return `
    <div class="journey-summary-row journey-summary-row--progress">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
      ${renderJourneyProgressBar(percent, 100)}
    </div>
  `;
}

function renderJourneyRewardRow(icon, title, value) {
  return `
    <div class="journey-reward-row">
      <span>${escapeHtml(icon)}</span>
      <div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(value)}</small></div>
    </div>
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
  const reward = config.rewards || mission.reward || {};
  const hasReward = Math.max(0, Number(reward.xp || 0)) > 0 || Math.max(0, Number(reward.credits || 0)) > 0;
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
    hasReward,
    title: config.journeyTitle || mission.title,
    objective: config.journeyObjectiveLabel || getMissionObjectiveLabel(mission),
    status: ready || claimed ? "COMPLETE" : progress > 0 ? "IN PROGRESS" : "ACTIVE",
    hint: ready && hasReward
      ? "Return to Journey to claim the reward."
      : ready || claimed
        ? "Open Journey to review your chapter assignments."
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
