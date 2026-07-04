/* Mission Journal */

const MISSION_STATE_AVAILABLE = "available";
const MISSION_STATE_ACTIVE = "active";
const MISSION_STATE_COMPLETED = "completed";
const MISSION_STATE_CLAIMED = "claimed";

const CHAPTERS = Object.freeze({
  frontier: Object.freeze({
    id: "frontier",
    roman: "I",
    title: "Chapter I: Frontier",
    theme: "Learn to survive."
  })
});

const CHAPTER_MISSIONS = Object.freeze([
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
    shortLabel: "Academy",
    subtitle: "Training begins here.",
    status: "pending",
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
    shortLabel: "Frontier",
    subtitle: "Establish your foothold beyond Asteron Prime.",
    status: "active",
    theme: "frontier",
    icon: "frontier",
    progressMode: "missions",
    currentPathFallback: "Sector Orientation"
  }),
  Object.freeze({
    id: "next_route",
    order: 2,
    label: "Next Route",
    displayLabel: "Next Route",
    shortLabel: "Next Route",
    subtitle: "Complete Frontier to reveal the next route.",
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
    id: "sector_orientation",
    chapterId: "frontier",
    journeyTitle: "Sector Orientation",
    journeyShortDescription: "Take the ship out and confirm your launch systems.",
    journeyObjectiveLabel: "Launch from a station or planet 1 time",
    assignmentType: "orientation",
    journeyTheme: "cyan",
    icon: "navigation",
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
    rewards: Object.freeze({ xp: 150, credits: 500 }),
    order: 50
  })
]);

const MISSIONS_BY_ID = Object.freeze(Object.fromEntries(CHAPTER_MISSIONS.map(mission => [mission.id, mission])));
const JOURNEY_ASSIGNMENTS_BY_ID = Object.freeze(Object.fromEntries(JOURNEY_ASSIGNMENTS.map(assignment => [assignment.id, assignment])));

let missionProgress = createDefaultMissionProgress();

function createDefaultMissionProgress() {
  return {
    chapters: {
      frontier: { id: "frontier", state: MISSION_STATE_AVAILABLE }
    },
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

  return reconcileMissionAvailability({ chapters, missions });
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

function completeMission(id) {
  const mission = MISSIONS_BY_ID[id];
  const state = missionProgress?.missions?.[id];
  if (!mission || !state || ![MISSION_STATE_ACTIVE, MISSION_STATE_AVAILABLE].includes(state.state)) return false;
  state.state = MISSION_STATE_COMPLETED;
  state.progress = getMissionRequiredAmount(mission);
  state.completedAt = state.completedAt || new Date().toISOString();
  if (typeof addHudToast === "function") addHudToast(`Mission complete: ${mission.title}.`);
  if (typeof addActivityLog === "function") addActivityLog(`Morgan: ${mission.completeText}`);
  reconcileMissionAvailability(missionProgress);
  refreshMissionDisplays();
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

function recordMissionEvent(eventType, payload = {}) {
  missionProgress = reconcileMissionAvailability(normalizeMissionProgress(missionProgress));
  let changed = false;

  CHAPTER_MISSIONS.forEach(mission => {
    const state = missionProgress.missions[mission.id];
    if (!state || state.state !== MISSION_STATE_ACTIVE || !missionEventMatches(mission, eventType, payload)) return;

    const increment = eventType === "recover_resource"
      ? Math.max(1, Math.round(Number(payload.amount || payload.quantity || 1)))
      : 1;
    state.progress = Math.min(getMissionRequiredAmount(mission), Math.max(0, Number(state.progress || 0)) + increment);
    changed = true;
    if (state.progress >= getMissionRequiredAmount(mission)) completeMission(mission.id);
  });

  CHAPTER_MISSIONS
    .filter(mission => mission.objective.type === "complete_missions")
    .forEach(mission => {
      const state = missionProgress.missions[mission.id];
      if (state?.state !== MISSION_STATE_ACTIVE) return;
      state.progress = getMissionProgressAmount(mission, state);
      if (state.progress >= getMissionRequiredAmount(mission)) completeMission(mission.id);
      changed = true;
    });

  if (changed) {
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

function getJourneyMissionRows() {
  missionProgress = normalizeMissionProgress(missionProgress);
  return getJourneyAssignments("frontier").map(assignment => assignment.mission).filter(Boolean);
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

function getJourneyObjectiveLine(mission) {
  if (!mission) return "Current Path: Sector Orientation";
  return `Current Path: ${getJourneyObjectiveTitle(mission)}`;
}

function getGalaxyCompletionPercent() {
  const chapterPercent = getChapterProgressPercent("frontier");
  return Math.min(100, Math.round(chapterPercent * 0.18));
}

function renderJourneyScreen() {
  const body = document.getElementById("journeyBody");
  const title = document.getElementById("journeyLocationTitle");
  if (title) title.textContent = String(currentNode || "Asteron Prime").toUpperCase();
  if (!body) return;

  body.innerHTML = `
    ${renderJourneyMorganBriefing()}
    ${renderJourneyChapterPath()}
    <section class="journey-objectives-panel journey-current-path">
      <div class="journey-panel-head">
        <span>CURRENT PATH</span>
        <strong>Frontier Assignments</strong>
      </div>
      ${renderJourneyAssignments(getJourneyAssignments("frontier"))}
    </section>
    <aside class="journey-side-panel">${renderJourneyFrontierStatus()}</aside>
    ${renderJourneyGalaxyCompletion()}
  `;
}

function renderMissionJournal() {
  renderJourneyScreen();
}

function renderJourneyMorganBriefing() {
  return `
    <section class="journey-morgan-panel journey-briefing">
      <img class="journey-morgan-portrait" src="assets/morgan-thumbnail.png" alt="Morgan">
      <div class="journey-morgan-copy">
        <span>MORGAN</span>
        <strong>COMMAND LIAISON</strong>
        <p>Frontier is active, Pilot. Complete these assignments and we'll open the next path.</p>
        <div class="journey-waveform" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      </div>
    </section>
  `;
}

function renderJourneyChapterPath() {
  const chapters = JOURNEY_CHAPTERS
    .slice()
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
  return `
    <section class="journey-chapters-panel">
      <div class="journey-panel-head"><span>CHAPTER PATH</span></div>
      <div class="journey-chapter-path" data-journey-source="JOURNEY_CHAPTERS">
        ${chapters.map(renderJourneyChapterNode).join("")}
      </div>
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
  if (chapter.status === "active") return "ACTIVE CHAPTER";
  if (chapter.status === "locked") return "LOCKED";
  if (chapter.status === "pending") return "PENDING";
  return String(chapter.status || "PENDING").toUpperCase();
}

function renderJourneyChapterNode(chapter) {
  const progress = getJourneyChapterProgress(chapter);
  const hasProgress = chapter.progressMode === "missions" || progress > 0;
  const activeMission = chapter.id === "frontier" ? getJourneyPrimaryMission() : null;
  const objective = activeMission ? getJourneyObjectiveLine(activeMission) : chapter.currentPathFallback ? `Current Path: ${chapter.currentPathFallback}` : "";
  return `
    <article class="journey-chapter-node journey-chapter-${escapeHtml(chapter.status)} journey-chapter-node--${escapeHtml(chapter.status)} journey-chapter-theme-${escapeHtml(chapter.theme)}" data-journey-chapter-id="${escapeHtml(chapter.id)}">
      <div class="journey-chapter-badge journey-chapter-icon journey-chapter-icon--${escapeHtml(chapter.icon)}">${escapeHtml(getJourneyChapterBadge(chapter))}</div>
      <div class="journey-chapter-main">
        <div class="journey-chapter-title-row">
          <div>
            <strong>${escapeHtml(chapter.displayLabel)}</strong>
            <p>${escapeHtml(chapter.subtitle)}</p>
          </div>
          ${renderJourneyStatusPill(chapter.status, getJourneyChapterStatusLabel(chapter))}
        </div>
        ${hasProgress ? `
          <div class="journey-chapter-progress">
            ${renderJourneyProgressBar(progress, 100)}
            <em>${formatNumber(progress)}%</em>
          </div>
        ` : ""}
        ${objective ? `<small>${escapeHtml(objective)}</small>` : ""}
        ${chapter.unlockText ? `<small>${escapeHtml(chapter.unlockText)}</small>` : ""}
      </div>
    </article>
  `;
}

function renderJourneyObjectiveRows() {
  return renderJourneyAssignments(getJourneyAssignments("frontier"));
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

function getJourneyAssignmentUiState(mission, state, locked = false) {
  if (locked) return "locked";
  if (state?.state === MISSION_STATE_COMPLETED) return "claimable";
  if (state?.state === MISSION_STATE_CLAIMED) return "completed";
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
  const uiState = getJourneyAssignmentUiState(mission, state, locked);
  const canAccept = state?.state === MISSION_STATE_AVAILABLE && !locked;
  const canClaim = state?.state === MISSION_STATE_COMPLETED;
  const progressPercent = Math.min(100, Math.round((progress / Math.max(1, required)) * 100));
  const action = canClaim
    ? `<button type="button" onclick="claimMissionReward('${escapeJsString(mission.id)}')">Claim Reward</button>`
    : canAccept
      ? `<button type="button" onclick="acceptMission('${escapeJsString(mission.id)}')">Accept Mission</button>`
      : state?.state === MISSION_STATE_ACTIVE
        ? `<button type="button" disabled>Tracking</button>`
        : state?.state === MISSION_STATE_CLAIMED
          ? `<button type="button" disabled>Complete</button>`
          : "";

  return `
    <article class="journey-objective-row journey-assignment-card mission-state-${escapeHtml(uiState)} journey-accent-${escapeHtml(assignment.assignmentType)} journey-assignment-card--${escapeHtml(assignment.journeyTheme)}" data-journey-assignment-id="${escapeHtml(assignment.id)}">
      <div class="journey-objective-marker journey-assignment-icon journey-assignment-icon--${escapeHtml(assignment.icon)}" aria-hidden="true"></div>
      <div class="journey-objective-copy">
        <div class="journey-objective-top">
          <strong>${escapeHtml(assignment.journeyTitle)}</strong>
          ${renderJourneyStatusPill(uiState)}
        </div>
        <p>${escapeHtml(assignment.journeyShortDescription)}</p>
        <span>${escapeHtml(assignment.journeyObjectiveLabel)}</span>
        ${renderJourneyProgressBar(progress, required)}
      </div>
      <div class="journey-objective-meta">
        <b>${formatNumber(progress)} / ${formatNumber(required)}</b>
        ${renderJourneyRewardChips(assignment.rewards || mission.reward)}
        ${action ? `<div class="journey-objective-action">${action}</div>` : ""}
      </div>
    </article>
  `;
}

function renderJourneyStatusPill(state, label = "") {
  const normalized = String(state || MISSION_STATE_AVAILABLE).toLowerCase();
  const text = label || (
    normalized === "claimable" ? "CLAIM READY" :
      normalized === "completed" ? "COMPLETE" :
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
  return `<div class="journey-reward-chips">${chips.join("")}</div>`;
}

function renderJourneyProgressBar(current, required) {
  const percent = Math.min(100, Math.round((Math.max(0, Number(current || 0)) / Math.max(1, Number(required || 1))) * 100));
  return `<div class="journey-progress-track journey-progress-bar"><i style="width:${percent}%"></i></div>`;
}

function renderJourneyFrontierStatus() {
  const activeMission = getJourneyPrimaryMission();
  const chapterPercent = getChapterProgressPercent("frontier");
  return `
    <section class="journey-summary-panel journey-frontier-status">
      <div class="journey-panel-head"><span>FRONTIER STATUS</span></div>
      <div class="journey-summary-list">
        ${renderJourneySummaryRow("Frontier Progress", `${formatNumber(chapterPercent)}%`)}
        ${renderJourneySummaryRow("Active Assignment", activeMission ? getJourneyObjectiveTitle(activeMission) : "Frontier Certification")}
        ${renderJourneySummaryRow("Next Unlock", "Frontier Certification")}
        ${renderJourneySummaryRow("Completion Unlocks", "Future route access")}
      </div>
      <p>Morgan Note: Complete your first assignments to establish your foothold.</p>
    </section>
  `;
}

function renderJourneyGalaxyCompletion() {
  const galaxyPercent = getGalaxyCompletionPercent();
  return `
    <section class="journey-galaxy-panel journey-galaxy-strip">
      <div>
        <span>OVERALL GALAXY COMPLETION</span>
        <strong>${formatNumber(galaxyPercent)}%</strong>
      </div>
      ${renderJourneyProgressBar(galaxyPercent, 100)}
      <p>Complete chapters, assignments, and objectives to grow your legacy across the galaxy.</p>
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

function renderJourneyRewardRow(icon, title, value) {
  return `
    <div class="journey-reward-row">
      <span>${escapeHtml(icon)}</span>
      <div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(value)}</small></div>
    </div>
  `;
}

function renderMissionObjectiveHud() {
  const mission = getPrimaryActiveMission();
  if (!mission) return `<div class="mission-objective-empty">No active mission.</div>`;
  const state = missionProgress.missions[mission.id];
  const progress = getMissionProgressAmount(mission, state);
  const required = getMissionRequiredAmount(mission);
  const ready = state.state === MISSION_STATE_COMPLETED;

  return `
    <div class="objective-hud-card mission-objective-card orbit-objective-card">
      <div class="objective-main-row objective-orbit-row">
        <div class="mission-objective-icon" aria-hidden="true">M</div>
        <div class="objective-copy objective-orbit-copy">
          <div class="objective-title-line">
            <span class="objective-type-pill mission-pill">Mission</span>
            <strong>${escapeHtml(mission.title)}</strong>
          </div>
          <span>${escapeHtml(getMissionObjectiveLabel(mission))}</span>
          <em>${ready ? "Return to Journey to claim the reward." : "Morgan is tracking this objective."}</em>
        </div>
        <div class="objective-orbit-meta">
          <span>${formatNumber(progress)} / ${formatNumber(required)}</span>
          <strong>${ready ? "READY" : "ACTIVE"}</strong>
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
  const profileScreen = document.getElementById("pilotProfileScreen");
  if (profileScreen?.classList.contains("active") && typeof renderPilotProfile === "function") renderPilotProfile();
}

const originalRenderObjectiveHud = typeof renderObjectiveHud === "function" ? renderObjectiveHud : null;
if (originalRenderObjectiveHud) {
  renderObjectiveHud = function renderObjectiveHudWithMissions() {
    originalRenderObjectiveHud();
    const panel = document.getElementById("activeObjectiveSummary");
    if (!panel) return;
    let missionSlot = document.getElementById("activeMissionSummary");
    if (!missionSlot) {
      missionSlot = document.createElement("div");
      missionSlot.id = "activeMissionSummary";
      missionSlot.className = "active-mission-summary";
      panel.insertAdjacentElement("afterend", missionSlot);
    }
    missionSlot.innerHTML = renderMissionObjectiveHud();
  };
}
