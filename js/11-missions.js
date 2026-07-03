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

const MISSIONS_BY_ID = Object.freeze(Object.fromEntries(CHAPTER_MISSIONS.map(mission => [mission.id, mission])));

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
      <div class="morgan-avatar" aria-hidden="true">M</div>
      <div><span>Morgan / Station AI</span><p>${escapeHtml(text)}</p></div>
    </div>
  `;
}

function renderMissionJournal() {
  const journal = document.getElementById("missionJournalPanel");
  if (!journal) return;
  const chapter = CHAPTERS.frontier;
  const missions = getVisibleChapterMissions("frontier");
  const completedCount = missions.filter(mission => missionProgress.missions[mission.id]?.state === MISSION_STATE_CLAIMED).length;
  const totalCount = missions.length;

  journal.innerHTML = `
    <div class="mission-journal-head">
      <div>
        <span>Mission Journal</span>
        <strong>${chapter.title}</strong>
        <small>${chapter.theme}</small>
      </div>
      <em>${formatNumber(completedCount)} / ${formatNumber(totalCount)}</em>
    </div>
    <div class="mission-journal-list">
      ${missions.map(mission => renderMissionCard(mission)).join("")}
    </div>
  `;
}

function renderMissionCard(mission) {
  const state = missionProgress.missions[mission.id];
  const progress = getMissionProgressAmount(mission, state);
  const required = getMissionRequiredAmount(mission);
  const locked = state?.state === MISSION_STATE_AVAILABLE && !isMissionAvailable(mission.id, missionProgress);
  const status = locked ? "LOCKED" : getMissionStatusLabel(state);
  const canAccept = state?.state === MISSION_STATE_AVAILABLE && !locked;
  const canClaim = state?.state === MISSION_STATE_COMPLETED;
  const progressPercent = Math.min(100, Math.round((progress / Math.max(1, required)) * 100));
  const action = canClaim
    ? `<button type="button" onclick="claimMissionReward('${escapeJsString(mission.id)}')">Claim Reward</button>`
    : canAccept
      ? `<button type="button" onclick="acceptMission('${escapeJsString(mission.id)}')">Accept Mission</button>`
      : "";

  return `
    <article class="mission-card mission-state-${escapeHtml(locked ? "locked" : (state?.state || MISSION_STATE_AVAILABLE))}">
      <div class="mission-card-top">
        <span>${escapeHtml(status)}</span>
        <strong>${escapeHtml(mission.title)}</strong>
      </div>
      ${renderMorganCard(mission, state)}
      <div class="mission-objective-line">${escapeHtml(getMissionObjectiveLabel(mission))}</div>
      <div class="mission-progress-row">
        <div class="mission-progress-track"><i style="width:${progressPercent}%"></i></div>
        <b>${formatNumber(progress)} / ${formatNumber(required)}</b>
      </div>
      <div class="mission-reward-row">
        <span>Reward</span>
        <strong>${formatNumber(mission.reward.xp)} XP / CR ${formatNumber(mission.reward.credits)}</strong>
      </div>
      ${locked ? `<p class="mission-lock-note">Complete the Frontier readiness missions first.</p>` : ""}
      ${action ? `<div class="mission-actions">${action}</div>` : ""}
    </article>
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
          <em>${ready ? "Return to the Mission Journal to claim the reward." : "Morgan is tracking this objective."}</em>
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
