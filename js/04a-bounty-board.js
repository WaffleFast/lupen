/* Bounty Board, daily contracts, and multiplayer staging bounty flows. */

let multiplayerStagingBountySelectedId = "staging_erebus_patrol_2";
let multiplayerStagingBountyLastHandledAt = 0;
let multiplayerStagingBountyPending = null;
let multiplayerStagingBountySubscribed = false;
let multiplayerStagingBountyLastRefreshAt = 0;
let multiplayerStagingBountyLastCompletionBurstKey = "";
let multiplayerStagingBountyLastTutorialAcceptKey = "";
let multiplayerStagingBountyLastTutorialClaimKey = "";
let multiplayerStagingBountyLastProgressClaimKey = "";

function getMultiplayerStagingBountyFallback() {
  return {
    id: "staging_erebus_patrol_2",
    title: "Erebus Patrol Sweep",
    description: "Destroy 1 server-owned Erebus bot, then return for the Academy payout.",
    contractType: "Kill Contract",
    targetType: "server_bot_destroy",
    targetFaction: "Erebus",
    target: "Any Erebus",
    targetBotType: "any",
    targetBotLabel: "Any Erebus",
    difficulty: "Easy",
    requiredKills: 1,
    progress: 0,
    xpReward: 0,
    creditsReward: 900,
    lupenShardsReward: 25,
    icon: "assets/bounties/erebus-patrol-sweep.png",
    lootReward: [],
    accepted: false,
    completed: false,
    claimAvailable: false,
    claimed: false,
    failed: false,
    stagingOnly: true
  };
}

function getMultiplayerStagingBountyStatus() {
  return window.LupenMultiplayerClient?.getStatus?.() || {};
}

function isMultiplayerStagingBountyReady() {
  const status = getMultiplayerStagingBountyStatus();
  return isMultiplayerStagingActive() && status?.enabled && status?.isConnected;
}

function getMultiplayerStagingBountyActiveState() {
  const status = getMultiplayerStagingBountyStatus();
  return status.lastStagingBountyStatus?.active ||
    status.lastStagingBountyClaimResult?.bounty ||
    status.lastStagingBountyList?.active ||
    null;
}

function mergeMultiplayerStagingBountyState(bounty) {
  const active = getMultiplayerStagingBountyActiveState();
  if (!active?.id || active.id !== bounty?.id) return bounty;
  return {
    ...bounty,
    ...active,
    title: bounty.title || active.title,
    description: bounty.description || active.description,
    requiredKills: Number(active.requiredKills || bounty.requiredKills || 2),
    xpReward: Number(active.xpReward ?? bounty.xpReward ?? 0),
    creditsReward: Number(active.creditsReward ?? bounty.creditsReward ?? 0),
    lupenShardsReward: Number(active.lupenShardsReward ?? bounty.lupenShardsReward ?? 0),
    lootReward: []
  };
}

function getMultiplayerStagingBounties() {
  const status = getMultiplayerStagingBountyStatus();
  const bounties = Array.isArray(status.lastStagingBountyList?.bounties)
    ? status.lastStagingBountyList.bounties
    : [];
  const source = bounties.length ? bounties : [getMultiplayerStagingBountyFallback()];
  return source.map((bounty) => mergeMultiplayerStagingBountyState({
    ...getMultiplayerStagingBountyFallback(),
    ...bounty,
    lootReward: []
  }));
}

function getSelectedMultiplayerStagingBounty() {
  const bounties = getMultiplayerStagingBounties();
  if (!multiplayerStagingBountySelectedId || !bounties.some((bounty) => bounty.id === multiplayerStagingBountySelectedId)) {
    multiplayerStagingBountySelectedId = bounties[0]?.id || "staging_erebus_patrol_2";
  }
  return bounties.find((bounty) => bounty.id === multiplayerStagingBountySelectedId) || bounties[0] || getMultiplayerStagingBountyFallback();
}

function getActiveMultiplayerStagingBountyObjective() {
  const active = getMultiplayerStagingBountyActiveState();
  if (!isMultiplayerStagingActive() || !active?.accepted || active?.claimed || active?.failed) return null;
  const listedContract = getMultiplayerStagingBounties()
    .find((bounty) => String(bounty?.id || "") === String(active.id || ""));
  return mergeMultiplayerStagingBountyState({
    ...getMultiplayerStagingBountyFallback(),
    ...(listedContract || {}),
    ...active,
    lootReward: []
  });
}

function getServerOwnedStagingBotNodes() {
  if (!isMultiplayerStagingActive()) return [];
  const bots = window.LupenMultiplayerClient?.getBots?.() || [];
  return Array.from(new Set((Array.isArray(bots) ? bots : [])
    .filter((bot) => bot && bot.disabled !== true && bot.currentNode && sectorNodes[bot.currentNode])
    .map((bot) => bot.currentNode)));
}

function getNearestServerOwnedStagingBotNode(startNode = currentNode) {
  const nodes = getServerOwnedStagingBotNodes();
  if (!nodes.length) return null;
  return nodes
    .map((nodeName) => ({
      nodeName,
      route: typeof findSectorRoute === "function" ? findSectorRoute(startNode, nodeName) : []
    }))
    .filter((entry) => entry.route.length)
    .sort((left, right) => left.route.length - right.route.length)[0]?.nodeName || nodes[0] || null;
}

function getMultiplayerStagingBountyTargetNode() {
  const bounty = getActiveMultiplayerStagingBountyObjective();
  if (!bounty) return null;
  if (bounty.claimAvailable || bounty.completed) return getNearestPlanetNode(currentNode);
  return getNearestServerOwnedStagingBotNode(currentNode);
}

function getMultiplayerStagingBountyRoutePath() {
  const target = getMultiplayerStagingBountyTargetNode();
  return target && typeof findSectorRoute === "function" ? findSectorRoute(currentNode, target) : [];
}

function requestMultiplayerStagingBountiesIfNeeded(force = false) {
  if (!isMultiplayerStagingActive()) return;
  const client = window.LupenMultiplayerClient;
  const status = client?.getStatus?.();
  if (!client?.requestStagingBounties || !status?.enabled || !status?.isConnected) return;
  const now = Date.now();
  const stale = now - multiplayerStagingBountyLastRefreshAt > 5000;
  if (force || stale || !status.lastStagingBountyList) {
    client.requestStagingBounties();
  }
  if (force || stale || !status.lastStagingBountyStatus) {
    client.requestStagingBountyStatus?.();
  }
  if (force || stale) multiplayerStagingBountyLastRefreshAt = now;
}

function getMultiplayerStagingBountyStateKey(bounty) {
  if (bounty?.claimed) return "claimed";
  if (bounty?.failed) return "failed";
  if (bounty?.claimAvailable || bounty?.completed) return "completed";
  if (bounty?.accepted) return "active";
  return "available";
}

function getMultiplayerStagingBountyStatusLabel(bounty) {
  if (bounty?.claimed) return "CLAIMED";
  if (bounty?.failed) return "FAILED";
  if (bounty?.claimAvailable || bounty?.completed) return "READY";
  if (bounty?.accepted) return "ACTIVE";
  if (!isMultiplayerStagingBountyReady()) return "OFFLINE";
  return "AVAILABLE";
}

function handleMultiplayerStagingBountyCompleted(bounty) {
  if (!bounty || (!bounty.claimAvailable && !bounty.completed)) return false;
  const completionKey = [
    bounty.id || "staging-bounty",
    bounty.completionSequence || bounty.updatedAt || bounty.progress || bounty.requiredKills || 1
  ].join(":");
  if (completionKey === multiplayerStagingBountyLastCompletionBurstKey) return false;
  multiplayerStagingBountyLastCompletionBurstKey = completionKey;

  const resolvedBounty = {
    ...bounty,
    icon: getBountyIconSrc(bounty.icon || bounty.fallbackIcon),
    reward: {
      credits: Math.max(0, Number(bounty.creditsReward || bounty.reward?.credits || 0)),
      lupenShards: Math.max(0, Number(bounty.lupenShardsReward || bounty.reward?.lupenShards || 0))
    }
  };
  if (typeof showBountyCompleteBurst === "function") showBountyCompleteBurst(resolvedBounty);
  if (typeof addHudToast === "function") addHudToast("Bounty complete — reward ready to claim.");
  if (typeof refreshTacticalPanel === "function") refreshTacticalPanel(true);
  return true;
}

function getMultiplayerStagingBountyClaimLine() {
  const result = getMultiplayerStagingBountyStatus().lastStagingBountyClaimResult;
  if (!result) return "";
  const credits = Math.round(Number(result.creditsDelta || result.bounty?.creditsReward || 0));
  const shards = Math.round(Number(result.lupenShardDelta || result.bounty?.lupenShardsReward || 0));
  if (result.applied || result.playerSavePatchResult?.applied || result.playerSave?.written) {
    return `Reward claimed: +${formatNumber(credits)} CR and +${formatNumber(shards)} Lupen Shards.`;
  }
  if (result.reason === "staging_bounty_already_claimed") return "Already claimed. Duplicate reward blocked.";
  if (result.mode === "blocked" || result.ok === false) return "The reward could not be claimed. Please try again.";
  return "The reward is not available yet.";
}

function selectMultiplayerStagingBounty(bountyId) {
  multiplayerStagingBountySelectedId = bountyId || "staging_erebus_patrol_2";
  renderBountyBoard();
}

function acceptMultiplayerStagingBounty(bountyId) {
  if (!isMultiplayerStagingBountyReady()) {
    if (typeof addHudToast === "function") addHudToast("The bounty network is still connecting.");
    return;
  }
  multiplayerStagingBountyPending = { action: "accept", bountyId, startedAt: Date.now() };
  window.LupenMultiplayerClient?.acceptStagingBounty?.({ bountyId });
  if (typeof addHudToast === "function") addHudToast("Accepting contract.");
  refreshMultiplayerStagingBountyStatusSoon();
  renderBountyBoard();
}

function claimMultiplayerStagingBounty(bountyId) {
  if (!isMultiplayerStagingBountyReady()) {
    if (typeof addHudToast === "function") addHudToast("The bounty network is still connecting.");
    return;
  }
  multiplayerStagingBountyPending = { action: "claim", bountyId, startedAt: Date.now() };
  window.LupenMultiplayerClient?.claimStagingBounty?.({ bountyId });
  if (typeof addHudToast === "function") addHudToast("Claiming contract reward.");
  refreshMultiplayerStagingBountyStatusSoon();
  renderBountyBoard();
}

function refreshMultiplayerStagingBountyStatusSoon() {
  window.setTimeout(() => {
    requestMultiplayerStagingBountiesIfNeeded(true);
    if (document.getElementById("bountyScreen")?.classList.contains("active")) renderBountyBoard();
  }, 650);
}

function isMultiplayerStagingBountyPending(action = "", bountyId = "") {
  if (!multiplayerStagingBountyPending) return false;
  if (Date.now() - Number(multiplayerStagingBountyPending.startedAt || 0) > 10000) {
    multiplayerStagingBountyPending = null;
    return false;
  }
  return (!action || multiplayerStagingBountyPending.action === action) &&
    (!bountyId || multiplayerStagingBountyPending.bountyId === bountyId);
}

function reconcileMultiplayerStagingBountyResult() {
  const status = getMultiplayerStagingBountyStatus();
  const pending = multiplayerStagingBountyPending ? { ...multiplayerStagingBountyPending } : null;
  const pendingAction = pending?.action || "";
  const result = pendingAction === "accept"
    ? status.lastStagingBountyStatus
    : pendingAction === "claim"
      ? status.lastStagingBountyClaimResult
      : status.lastStagingBountyClaimResult || status.lastStagingBountyStatus;
  const receivedAt = Number(result?.receivedAt || 0);
  if (receivedAt && multiplayerStagingBountyLastHandledAt < receivedAt) {
    multiplayerStagingBountyLastHandledAt = receivedAt;
    multiplayerStagingBountyPending = null;
    const claimLine = getMultiplayerStagingBountyClaimLine();
    if (claimLine && typeof addActivityLog === "function") addActivityLog(`Bounty contract: ${claimLine}`);
  }

  const claim = status.lastStagingBountyClaimResult;
  const claimApplied = Boolean(
    claim?.applied ||
    claim?.playerSavePatchResult?.applied ||
    claim?.playerSave?.written ||
    claim?.bounty?.claimed ||
    claim?.reason === "staging_bounty_already_claimed"
  );
  const claimReceivedAt = Number(claim?.receivedAt || 0);
  if (claimApplied) {
    const progressClaimKey = `${claim?.bounty?.id || claim?.id || "staging-bounty"}:${claim?.receivedAt || claim?.creditsAfter || claim?.lupenShardsAfter || "claimed"}`;
    if (progressClaimKey !== multiplayerStagingBountyLastProgressClaimKey) {
      multiplayerStagingBountyLastProgressClaimKey = progressClaimKey;
      if (Number.isFinite(Number(claim?.creditsAfter))) credits = Math.max(0, Number(claim.creditsAfter));
      if (Number.isFinite(Number(claim?.lupenShardsAfter))) {
        upgradeMaterials = normalizeUpgradeMaterials(upgradeMaterials);
        upgradeMaterials.lupenShards = Math.max(0, Number(claim.lupenShardsAfter));
      }
      recordBountyClaimProgress(claim?.bounty || { id: claim?.id || "staging-bounty", title: "Bounty Contract" }, {
        eventKey: progressClaimKey,
        save: false
      });
      if (typeof reconcileMissionProgressFromGameplayState === "function") {
        reconcileMissionProgressFromGameplayState({ bountyClaimed: true, refresh: true, save: false });
      }
      if (typeof updateProgressDisplays === "function") updateProgressDisplays();
      if (typeof renderPilotProfileIfActive === "function") renderPilotProfileIfActive();
      if (typeof saveGame === "function") saveGame();
    }
  }

  if (!tutorialState?.active || typeof getCurrentTutorialStep !== "function") return;
  const stepId = getCurrentTutorialStep()?.id || "";
  const active = status.lastStagingBountyStatus?.active || status.lastStagingBountyList?.active;

  if (stepId === "accept-bounty" && active?.accepted && !active?.claimed) {
    const acceptKey = `${active.id || "staging-bounty"}:${active.acceptedAt || active.receivedAt || status.lastStagingBountyStatus?.receivedAt || "accepted"}`;
    if (acceptKey !== multiplayerStagingBountyLastTutorialAcceptKey) {
      multiplayerStagingBountyLastTutorialAcceptKey = acceptKey;
      tutorialEvent("acceptedBounty");
    }
  }

  const tutorialStartedAt = Date.parse(tutorialState?.lastStartedAt || "") || 0;
  const claimBountyId = String(claim?.bounty?.id || claim?.id || "");
  const claimMatchesPending = pendingAction === "claim" &&
    (!pending?.bountyId || !claimBountyId || String(pending.bountyId) === claimBountyId) &&
    (!claimReceivedAt || claimReceivedAt >= Number(pending?.startedAt || 0));
  const claimBelongsToTutorial = !pending &&
    (!claimReceivedAt || !tutorialStartedAt || claimReceivedAt >= tutorialStartedAt);
  if (stepId === "claim-bounty" && claimApplied && (claimMatchesPending || claimBelongsToTutorial)) {
    const claimKey = `${claim?.bounty?.id || claim?.id || "staging-bounty"}:${claim?.receivedAt || claim?.creditsAfter || claim?.lupenShardsAfter || "claimed"}`;
    if (claimKey !== multiplayerStagingBountyLastTutorialClaimKey) {
      multiplayerStagingBountyLastTutorialClaimKey = claimKey;
      const reward = {
        credits: Math.max(0, Number(claim?.creditsDelta || claim?.bounty?.creditsReward || 0)),
        xp: 0,
        lupenCores: 0,
        lupenShards: Math.max(0, Number(claim?.lupenShardDelta || claim?.bounty?.lupenShardsReward || 0))
      };
      if (typeof playRewardClaimSound === "function") playRewardClaimSound();
      showBountyRewardOverlay(claim?.bounty?.title || claim?.bounty?.name || "Bounty Contract", reward);
      tutorialEvent("claimedBountyReward");
    }
  }
}

function setupMultiplayerStagingBountyBoardSubscription() {
  if (multiplayerStagingBountySubscribed || !isMultiplayerStagingActive()) return;
  const client = window.LupenMultiplayerClient;
  if (!client?.onServerState) return;
  multiplayerStagingBountySubscribed = true;
  client.onServerState(() => {
    reconcileMultiplayerStagingBountyResult();
    if (typeof renderObjectiveHud === "function") renderObjectiveHud();
    if (document.getElementById("bountyScreen")?.classList.contains("active")) {
      renderBountyBoard();
    }
    if (tutorialState?.active && typeof renderStarterTutorial === "function") {
      window.setTimeout(renderStarterTutorial, 0);
    }
  });
}


let bountyResetCountdownTimer = null;
let bountyBoardTimer = null;

function formatBountyResetCountdown(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(value => String(value).padStart(2, "0")).join(":");
}

function updateBountyResetCountdown() {
  const countdown = document.getElementById("bountyResetCountdown");
  if (!countdown) return;

  const secondsUntilReset = getDailyResetSeconds();
  countdown.textContent = `DAILY RESET ${formatBountyResetCountdown(secondsUntilReset)}`;
  countdown.title = "Daily contracts refresh at 00:00 UTC.";

  if (secondsUntilReset <= 1) {
    const previousDate = dailyBountyDate;
    ensureDailyBounties();
    if (previousDate !== dailyBountyDate && typeof saveGame === "function") saveGame();
  }
}

function startBountyResetTimer() {
  stopBountyResetTimer();
  updateBountyResetCountdown();
  bountyResetCountdownTimer = setInterval(() => {
    updateBountyResetCountdown();
    updateActiveBountyTimers();
  }, 1000);
}

function stopBountyResetTimer() {
  if (!bountyResetCountdownTimer) return;
  clearInterval(bountyResetCountdownTimer);
  bountyResetCountdownTimer = null;
  stopBountyBoardTimer();
}

function startBountyBoardTimer() {
  stopBountyBoardTimer();
  bountyBoardTimer = setInterval(updateActiveBountyTimers, 1000);
}

function stopBountyBoardTimer() {
  if (!bountyBoardTimer) return;
  clearInterval(bountyBoardTimer);
  bountyBoardTimer = null;
}

function cloneBountyReward(reward = {}) {
  const legacyShards = Number(reward.weaponParts || 0) + Number(reward.equipmentModules || 0);
  return {
    credits: Number(reward.credits || 0),
    xp: 0,
    lupenCores: 0,
    lupenShards: Number(reward.lupenShards ?? legacyShards ?? 0)
  };
}

function getBountyRequiredKills(contract) {
  return Number(contract?.requiredKills || contract?.killsRequired || 1);
}

function formatBountyReward(reward = {}) {
  const safeReward = cloneBountyReward(reward);
  const parts = [];
  if (safeReward.credits) parts.push(`CR ${formatNumber(safeReward.credits)}`);
  if (safeReward.lupenShards) parts.push(`${formatNumber(safeReward.lupenShards)} Lupen Shards`);
  return parts.length ? parts.join(" / ") : "No reward";
}

function renderBountyPayout(reward = {}) {
  const safeReward = cloneBountyReward(reward);
  return `
    <span class="bounty-payout-summary">
      <span>
        <small>Credits</small>
        <b>CR ${formatNumber(safeReward.credits)}</b>
      </span>
      <span>
        <small>Forge Material</small>
        <b><img src="assets/items/lupen-shard.png" alt="">${formatNumber(safeReward.lupenShards)} Shards</b>
      </span>
    </span>`;
}

function renderBountyRewardBrief(reward = {}) {
  const safeReward = cloneBountyReward(reward);
  return `
    <div class="bounty-brief-reward">
      <span>Reward</span>
      <strong>CR ${formatNumber(safeReward.credits)} <b>+</b> <img src="assets/items/lupen-shard.png" alt=""> ${formatNumber(safeReward.lupenShards)} Lupen Shards</strong>
    </div>`;
}

function getBountyProgressStatusLine(stateKey, options = {}) {
  if (stateKey === "claimed") return "Reward collected.";
  if (stateKey === "completed") return "Return here to claim reward.";
  if (stateKey === "active") return "Progress updates automatically while this contract is active.";
  if (stateKey === "failed") return "Contract expired.";
  return options.availableText || "Accept this contract to begin tracking progress.";
}

function renderBountyInfoRows(rows = []) {
  return rows.map((row) => {
    const rowKey = String(row.label || "info").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "info";
    return `
    <div class="selected-contract-row bounty-detail-stat selected-bounty-info-row selected-contract-row--${escapeHtml(rowKey)} ${row.wide ? "selected-bounty-info-row--wide" : ""}">
      <span>${escapeHtml(row.label)}</span>
      ${row.html ? row.value : `<strong>${escapeHtml(row.value || "None")}</strong>`}
    </div>
  `;
  }).join("");
}

function getBountyIconSrc(iconName) {
  const iconMap = {
    "bounty-patrol-sweep": "assets/bounties/bounty-patrol-sweep.png",
    "bounty-rapid-response": "assets/bounties/bounty-rapid-response.png",
    "bounty-behemoth-cull": "assets/bounties/bounty-behemoth-cull.png",
    "erebus-patrol-sweep": "assets/bounties/erebus-patrol-sweep.png",
    "hunter-clearance": "assets/bounties/hunter-clearance.png",
    "timed-suppression": "assets/bounties/timed-suppression.png",
    "behemoth-warning": "assets/bounties/behemoth-warning.png"
  };
  if (!iconName) return "assets/bounties/raider-sweep.png";
  if (iconMap[iconName]) return iconMap[iconName];
  if (String(iconName).includes("/") || String(iconName).endsWith(".png")) return iconName;
  if (typeof getBotImageSrc === "function") return getBotImageSrc(iconName);
  return "assets/bounties/raider-sweep.png";
}

function getBountyTargetLabel(contract = {}) {
  if (contract.targetBotType === "any" || contract.targetBotType === "any_erebus") return "Any Erebus";
  return contract.targetBotLabel || "Erebus";
}

function getBountyObjectiveText(contract = {}) {
  const requiredKills = getBountyRequiredKills(contract);
  const target = getBountyTargetLabel(contract);
  if (contract.timed) return `Destroy ${formatNumber(requiredKills)} ${target} within ${formatBountyTime(contract.timeLimitSeconds || 0)}.`;
  if (contract.description) return contract.description;
  return `Destroy ${formatNumber(requiredKills)} ${target}.`;
}

function doesBotCountForBounty(bot, bounty) {
  if (!bot || !bounty) return false;
  const targetBotType = String(bounty.targetBotType || "").trim().toLowerCase();
  const botType = String(bot.botType || bot.type || "").trim().toLowerCase();
  const faction = String(bot.faction || "").trim().toLowerCase();
  const displayName = String(bot.displayName || bot.name || "").trim().toLowerCase();
  if (!targetBotType || targetBotType === "any" || targetBotType === "any_erebus") {
    return faction === "erebus" ||
      ["hunter", "attacker", "destroyer", "behemoth"].includes(botType) ||
      botType.startsWith("erebus_") ||
      displayName.startsWith("erebus ");
  }
  return botType === targetBotType;
}

function formatBountyTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.ceil(Number(totalSeconds || 0)));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getBountyRemainingSeconds(contract) {
  if (!contract?.timed) return null;
  if (contract.status === "active" && contract.expiresAt) {
    return Math.max(0, Math.ceil((Number(contract.expiresAt) - Date.now()) / 1000));
  }
  return Number(contract.timeLimitSeconds || 0);
}

function getBountyTimerLabel(contract) {
  if (!contract?.timed) return "";
  if (contract.status === "failed") return "FAILED";
  if (["readyToClaim", "completed", "claimed"].includes(contract.status)) return "COMPLETED";
  const timeText = formatBountyTime(getBountyRemainingSeconds(contract));
  return contract.status === "active" ? `TIME REMAINING ${timeText}` : `TIME LIMIT ${timeText}`;
}

function getBountyTimerParts(contract) {
  const text = getBountyTimerLabel(contract);
  if (!text) return null;
  const match = text.match(/^(TIME LIMIT|TIME REMAINING)\s+(.+)$/);
  return match ? { label: match[1], value: match[2] } : { label: "STATUS", value: text };
}

function expireBountyContract(contract, shouldSave = true) {
  if (!contract || contract.status !== "active") return false;
  contract.status = "failed";
  contract.progress = 0;
  contract.expiresAt = null;
  if (activeObjective?.type === "bounty" && activeObjective.contractId === contract.id) {
    activeObjective.status = "failed";
    activeObjective = null;
  }
  if (activeBountyId === contract.id) activeBountyId = null;
  addActivityLog(`Bounty expired: ${contract.title || contract.name}.`);
  updateHudDock();
  updateBountyHubBadge();
  if (shouldSave) saveGame();
  return true;
}

function updateActiveBountyTimers() {
  let changed = false;
  dailyBountyContracts.forEach(contract => {
    if (contract.timed && contract.status === "active" && contract.expiresAt && Date.now() > Number(contract.expiresAt)) {
      changed = expireBountyContract(contract, false) || changed;
    }
  });
  if (changed) saveGame();
  if (document.getElementById("bountyScreen")?.classList.contains("active")) renderBountyBoard();
  if (typeof updateSpaceHUD === "function") updateSpaceHUD();
}

function ensureDailyBounties() {
  const today = getTodayKey();
  const templateIds = DAILY_BOUNTY_CONTRACTS.map(contract => contract.id).join("|");
  const currentIds = Array.isArray(dailyBountyContracts) ? dailyBountyContracts.map(contract => contract.id).join("|") : "";
  const tutorialFallbackIds = Array.isArray(dailyBountyContracts)
    ? dailyBountyContracts.map(contract => contract.id === "tutorial-erebus-patrol" ? DAILY_BOUNTY_CONTRACTS[0]?.id : contract.id).join("|")
    : "";
  const hasExpectedIds = currentIds === templateIds || tutorialFallbackIds === templateIds;
  if (dailyBountyDate !== today || !Array.isArray(dailyBountyContracts) || !dailyBountyContracts.length || !hasExpectedIds) {
    dailyBountyDate = today;
    dailyBountyContracts = createDailyBountyContracts();
    selectedBountyContractId = dailyBountyContracts[0]?.id || null;
    activeBountyId = null;
    if (activeObjective?.type === "bounty") activeObjective = null;
  }

  dailyBountyContracts = dailyBountyContracts.map(contract => {
    const template = DAILY_BOUNTY_CONTRACTS.find(item => item.id === contract.id) || contract;
    const targetArea = contract.targetArea || template.targetArea || "anyHostile";
    const requiredKills = getBountyRequiredKills({ ...template, ...contract });
    const savedTargetBotType = contract.targetBotType || "";
    const legacyPrefix = "man" + "ta_";
    const legacyPattern = new RegExp("man" + "ta", "i");
    const hasLegacyBotData = savedTargetBotType.startsWith(legacyPrefix) || legacyPattern.test(`${contract.subtitle || ""} ${contract.description || ""} ${contract.targetBotLabel || ""} ${contract.icon || ""}`);
    const targetBotType = hasLegacyBotData ? template.targetBotType : (contract.targetBotType || template.targetBotType || null);
    return {
      ...template,
      ...contract,
      name: hasLegacyBotData ? template.name : (contract.name || contract.title || template.name || template.title),
      title: hasLegacyBotData ? template.title : (contract.title || contract.name || template.title || template.name),
      subtitle: hasLegacyBotData ? template.subtitle : (contract.subtitle || template.subtitle || ""),
      description: hasLegacyBotData ? template.description : (contract.description || template.description || ""),
      type: contract.type || template.type || "standard",
      chipLabel: contract.chipLabel || template.chipLabel || "STANDARD",
      area: contract.area || template.area || getBountyAreaLabel(targetArea),
      targetArea,
      targetLabel: contract.targetLabel || template.targetLabel || getBountyAreaLabel(targetArea),
      targetBotType,
      targetBotLabel: hasLegacyBotData ? template.targetBotLabel : (contract.targetBotLabel || template.targetBotLabel || "Hostile Bot"),
      targetNode: undefined,
      requiredKills,
      killsRequired: requiredKills,
      reward: cloneBountyReward(typeof contract.reward === "object" ? contract.reward : template.reward),
      lootChance: Number(contract.lootChance ?? template.lootChance ?? 0),
      materialReward: contract.materialReward || template.materialReward || null,
      progress: Math.max(0, Number(contract.progress || 0)),
      timed: Boolean(contract.timed ?? template.timed),
      timeLimitSeconds: contract.timeLimitSeconds ?? template.timeLimitSeconds ?? null,
      expiresAt: contract.expiresAt || null,
      bonus: contract.bonus ?? template.bonus ?? null,
      accent: contract.accent || template.accent || "blue",
      icon: hasLegacyBotData ? template.icon : (contract.icon || template.icon),
      fallbackIcon: hasLegacyBotData ? template.fallbackIcon : (contract.fallbackIcon || template.fallbackIcon || "assets/bots/erebus-attacker.png"),
      status: ["available", "active", "readyToClaim", "completed", "claimed", "failed"].includes(contract.status) ? contract.status : "available"
    };
  });

  const activeContract = dailyBountyContracts.find(contract => contract.status === "active");
  activeBountyId = activeContract?.id || null;
}

function getBountyContract(contractId) {
  if (shouldUseLocalTutorialBountyFallback()) {
    const existing = dailyBountyContracts.find(contract => contract.id === contractId);
    if (existing) return existing;
  }
  ensureDailyBounties();
  return dailyBountyContracts.find(contract => contract.id === contractId);
}

function getBountyObjectiveIcon(objective) {
  const contract = objective?.contractId ? getBountyContract(objective.contractId) : null;
  return getBountyIconSrc(objective?.icon || contract?.icon || contract?.fallbackIcon);
}

function getBountyStatusLabel(contract) {
  if (contract.status === "failed") return "FAILED";
  if (contract.status === "readyToClaim") return "COMPLETE";
  if (activeObjective?.type === "bounty" && activeObjective.contractId === contract.id) {
    return activeObjective.status === "readyToClaim" ? "COMPLETE" : "ACTIVE";
  }
  if (contract.status === "completed" || contract.status === "claimed") return "CLAIMED";
  return "AVAILABLE";
}

function isStarterTutorialBountyStepActive() {
  if (!tutorialState?.active || typeof getCurrentTutorialStep !== "function") return false;
  return [
    "open-bounty",
    "accept-bounty",
    "return-for-combat-launch",
    "launch-for-combat",
    "open-map-for-bounty",
    "scan-for-bots",
    "jump-to-bounty-zone",
    "destroy-bot",
    "open-map-return-bounty",
    "return-to-planet-after-bounty",
    "land-after-bounty",
    "open-bounty-to-claim",
    "claim-bounty",
    "continue-after-bounty-reward",
    "return-after-bounty-claim"
  ].includes(getCurrentTutorialStep()?.id);
}

function shouldUseLocalTutorialBountyFallback() {
  if (!isMultiplayerStagingActive() || !isStarterTutorialBountyStepActive()) return false;
  if (activeObjective?.type === "bounty") return true;
  if (getActiveMultiplayerStagingBountyObjective()) return false;
  return !isMultiplayerStagingBountyReady();
}

function applyTutorialBountyFallbackContract() {
  ensureDailyBounties();
  const template = DAILY_BOUNTY_CONTRACTS[0] || {};
  const existing = dailyBountyContracts.find(contract => contract.id === "tutorial-erebus-patrol") ||
    dailyBountyContracts.find(contract => contract.id === template.id) ||
    dailyBountyContracts[0];
  const preserveExistingTutorialState = existing?.id === "tutorial-erebus-patrol";
  const preservedStatus = preserveExistingTutorialState && ["active", "readyToClaim", "claimed"].includes(existing?.status) ? existing.status : "available";
  const preservedProgress = preserveExistingTutorialState ? Math.max(0, Number(existing?.progress || 0)) : 0;
  const fallback = {
    ...template,
    ...existing,
    id: "tutorial-erebus-patrol",
    name: "Erebus Patrol Sweep",
    title: "Erebus Patrol Sweep",
    subtitle: "Destroy 1 Erebus bot",
    description: "Destroy one Erebus bot, then return so Morgan can certify your first combat route.",
    type: "standard",
    chipLabel: "TUTORIAL",
    contractType: "Tutorial Bounty",
    area: "Any Hostile Zone",
    targetArea: "anyHostile",
    targetBotType: "any_erebus",
    targetBotLabel: "Erebus Bot",
    requiredKills: 1,
    killsRequired: 1,
    progress: Math.min(1, preservedProgress),
    threat: "Low",
    reward: {
      ...cloneBountyReward(existing?.reward || template.reward || BOUNTY_REWARD_DEFAULT),
      xp: 0,
      lupenCores: 0,
      lupenShards: Math.max(25, Number(existing?.reward?.lupenShards || template.reward?.lupenShards || BOUNTY_REWARD_DEFAULT.lupenShards || 25))
    },
    timed: false,
    timeLimitSeconds: null,
    expiresAt: null,
    status: preservedStatus,
    accent: "blue",
    icon: "bounty-patrol-sweep",
    fallbackIcon: "assets/bounties/bounty-patrol-sweep.png",
    tutorialFallback: true
  };
  dailyBountyContracts = [fallback, ...dailyBountyContracts.filter(contract => !["tutorial-erebus-patrol", template.id].includes(contract.id))];
  selectedBountyContractId = fallback.id;
  if (activeObjective?.type === "bounty" && activeObjective.contractId !== fallback.id && activeObjective.title === fallback.title) {
    activeObjective.contractId = fallback.id;
  }
  return fallback;
}

function ensureTutorialBountyFallbackObjective() {
  if (!shouldUseLocalTutorialBountyFallback()) return false;
  if (activeObjective?.type === "bounty") return true;
  const fallback = applyTutorialBountyFallbackContract();
  const contract = dailyBountyContracts.find(item => item.id === fallback.id && item.status === "active") ||
    dailyBountyContracts.find(item => item.tutorialFallback && item.status === "active") ||
    dailyBountyContracts.find(item => item.status === "active" && (item.title === fallback.title || item.name === fallback.name));
  if (!contract) return false;
  contract.id = fallback.id;
  contract.tutorialFallback = true;
  activeObjective = createBountyObjective(contract);
  activeBountyId = contract.id;
  selectedBountyContractId = contract.id;
  return true;
}

function renderMultiplayerStagingBountyBoard() {
  setupMultiplayerStagingBountyBoardSubscription();
  requestMultiplayerStagingBountiesIfNeeded();

  const title = document.getElementById("bountyLocationTitle");
  const grid = document.getElementById("bountyContractGrid");
  const countdown = document.getElementById("bountyResetCountdown");
  const countLabel = document.querySelector(".bounty-list-count");
  const bounties = getMultiplayerStagingBounties();
  const selectedBounty = getSelectedMultiplayerStagingBounty();

  if (title) title.textContent = "FRONTIER CONTRACTS";
  if (countdown) countdown.textContent = "DAILY BOARD";
  if (countLabel) countLabel.textContent = `${formatNumber(bounties.length)} CONTRACT${bounties.length === 1 ? "" : "S"}`;

  if (grid) {
    grid.innerHTML = bounties.map((bounty) => {
      const isSelected = selectedBounty?.id === bounty.id;
      const statusKey = getMultiplayerStagingBountyStateKey(bounty);
      const status = getMultiplayerStagingBountyStatusLabel(bounty);
      const requiredKills = Number(bounty.requiredKills || 2);
      const progress = Math.min(requiredKills, Math.max(0, Number(bounty.progress || 0)));
      const icon = getBountyIconSrc(bounty.icon || bounty.fallbackIcon);
      const ready = statusKey === "completed";
      const complete = statusKey === "claimed";
      const active = statusKey === "active";
      return `
        <button type="button" class="bounty-card bounty-contract-card bounty-card--staging bounty-card--${statusKey} ${isSelected ? "selected bounty-card--selected" : ""} ${complete ? "completed" : ""} ${ready ? "ready-to-claim" : ""} ${active ? "active" : ""}" data-bounty-contract-id="${escapeHtml(bounty.id)}" aria-pressed="${isSelected ? "true" : "false"}" aria-label="${escapeHtml(`${bounty.title || "Erebus Patrol Sweep"}, ${status}, CR ${formatNumber(bounty.creditsReward)} and ${formatNumber(bounty.lupenShardsReward)} Lupen Shards`)}" onclick="selectMultiplayerStagingBounty('${escapeJsString(bounty.id)}')">
          ${ready || complete ? `<span class="bounty-card__status-check" aria-hidden="true">✓</span>` : ""}
          <span class="bounty-card__icon-frame bounty-card-icon"><img src="${icon}" alt="" onerror="this.remove(); this.parentElement.classList.add('missing-image');"></span>
          <span class="bounty-card__body bounty-card-copy">
            <strong class="bounty-card__title">${escapeHtml(bounty.title || "Erebus Patrol Sweep")}</strong>
            <span class="bounty-card__subtitle">${escapeHtml(bounty.description || "Destroy Erebus bots operating in the Frontier.")}</span>
            <span class="bounty-card__chips">
              <span class="bounty-chip bounty-chip--special">${escapeHtml(bounty.contractType || "Kill Contract")}</span>
              <span class="bounty-chip bounty-chip--target">${escapeHtml(bounty.targetBotLabel || bounty.target || "Erebus bots")}</span>
              <span class="bounty-chip bounty-card-threat">Threat · ${escapeHtml(bounty.difficulty || "Combat")}</span>
              ${active ? `<span class="bounty-chip bounty-chip--accepted">✓ ACCEPTED</span>` : ""}
            </span>
          </span>
          <span class="bounty-reward-box bounty-card-reward bounty-reward">
            <span class="bounty-reward-box__label">PAYOUT</span>
            <strong class="bounty-reward-box__value"><span>CR ${formatNumber(bounty.creditsReward)}</span><span><img class="bounty-reward-box__icon" src="assets/items/lupen-shard.png" alt=""> ${formatNumber(bounty.lupenShardsReward)} Lupen Shards</span></strong>
            <em class="bounty-card-status bounty-status-chip bounty-status-chip--${statusKey}">${active ? "ACCEPTED" : status}</em>
          </span>
        </button>
      `;
    }).join("");
  }

  renderMultiplayerStagingBountyDetail();
}

function renderMultiplayerStagingBountyDetail() {
  const panel = document.getElementById("bountyDetailPanel");
  if (!panel) return;

  const bounty = getSelectedMultiplayerStagingBounty();
  const statusKey = getMultiplayerStagingBountyStateKey(bounty);
  const requiredKills = Number(bounty.requiredKills || 2);
  const progress = Math.min(requiredKills, Math.max(0, Number(bounty.progress || 0)));
  const progressPct = Math.max(0, Math.min(100, Math.round((progress / Math.max(1, requiredKills)) * 100)));
  const connected = isMultiplayerStagingBountyReady();
  const pendingAccept = isMultiplayerStagingBountyPending("accept", bounty.id);
  const pendingClaim = isMultiplayerStagingBountyPending("claim", bounty.id);
  const claimLine = getMultiplayerStagingBountyClaimLine();
  const activeBounty = getActiveMultiplayerStagingBountyObjective();
  const anotherContractActive = Boolean(activeBounty?.id && activeBounty.id !== bounty.id);
  const shell = panel.closest(".selected-contract-panel");
  if (shell) {
    ["available", "active", "completed", "claimed", "failed"].forEach(state => shell.classList.remove(`selected-contract-panel--${state}`));
    shell.classList.add(`selected-contract-panel--${statusKey}`);
  }

  const actionHtml = bounty.failed
    ? `<button class="selected-contract-action bounty-accept-btn" disabled>Failed</button>`
    : bounty.claimed
    ? `<button class="selected-contract-action bounty-accept-btn" disabled>Claimed</button>`
      : bounty.claimAvailable || bounty.completed
        ? `<button class="selected-contract-action bounty-claim-btn" ${!connected || pendingClaim ? "disabled" : ""} onclick="claimMultiplayerStagingBounty('${escapeJsString(bounty.id)}')">${pendingClaim ? "Claiming..." : "Claim Reward"}</button>`
      : bounty.accepted
        ? `<button class="selected-contract-action bounty-accept-btn bounty-active-state-btn" disabled>✓ Active Contract</button>`
        : anotherContractActive
          ? `<button class="selected-contract-action bounty-accept-btn bounty-active-blocked-btn" disabled>Finish Active Contract First</button>`
        : `<button class="selected-contract-action bounty-accept-btn accept-bounty-button" ${!connected || pendingAccept ? "disabled" : ""} onclick="acceptMultiplayerStagingBounty('${escapeJsString(bounty.id)}')">${pendingAccept ? "Accepting..." : connected ? "Accept Contract" : "Connecting..."}</button>`;

  const connectionNote = connected
    ? anotherContractActive
      ? `${activeBounty.title || activeBounty.name || "Another contract"} is currently active.`
      : "Progress updates automatically while this contract is active."
    : "Connecting to the contract network.";

  const infoRows = [
    { label: "Target", value: bounty.targetBotLabel || bounty.target || "Erebus bots" },
    { label: "Hunt Zone", value: bounty.area || "Any Hostile Zone" },
    { label: "Threat", value: bounty.difficulty || "Combat" },
    { label: "Time Limit", value: bounty.timed ? formatBountyTime(bounty.timeLimitSeconds || 0) : "No limit" }
  ];

  panel.innerHTML = `
    <div class="selected-contract-top bounty-detail-hero selected-bounty-header selected-contract-top--${statusKey} ${bounty.claimAvailable || bounty.completed ? "reward-ready" : ""} ${bounty.claimed ? "completed" : ""}">
      <div class="selected-contract-icon bounty-detail-icon"><img src="${getBountyIconSrc(bounty.icon || bounty.fallbackIcon)}" alt="" onerror="this.remove(); this.parentElement.classList.add('missing-image');"></div>
      <div class="selected-contract-copy">
        <span class="bounty-detail-tags"><span class="bounty-chip bounty-chip--special">${escapeHtml(bounty.contractType || "Kill Contract")}</span><span class="selected-contract-state bounty-status-chip bounty-status-chip--${statusKey}">${escapeHtml(getMultiplayerStagingBountyStatusLabel(bounty))}</span></span>
        ${statusKey === "active" ? `<span class="selected-contract-active-badge">✓ ACTIVE CONTRACT</span>` : ""}
        ${bounty.claimAvailable || bounty.completed || bounty.claimed ? `<span class="selected-contract-check" aria-hidden="true">✓</span>` : ""}
        <strong>${escapeHtml(bounty.title || "Erebus Patrol Sweep")}</strong>
        <span>${escapeHtml(bounty.description || "Destroy Erebus bots operating in the Frontier.")}</span>
      </div>
    </div>

    ${renderBountyRewardBrief({ credits: bounty.creditsReward, lupenShards: bounty.lupenShardsReward })}

    <div class="selected-contract-progress bounty-detail-progress-block selected-bounty-progress">
      <div class="bounty-progress-heading"><span>Progress</span><strong>${formatNumber(progress)} / ${formatNumber(requiredKills)}</strong></div>
      <div class="bounty-progress-bar"><span style="width:${progressPct}%"></span></div>
      <div class="bounty-progress-state bounty-progress-state--${statusKey}">${escapeHtml(getBountyProgressStatusLine(statusKey))}</div>
    </div>

    <div class="selected-contract-rows bounty-detail-grid">
      ${renderBountyInfoRows(infoRows)}
    </div>

    <div class="selected-contract-actions bounty-detail-actions">
      ${actionHtml}
    </div>
    <p class="bounty-detail-note compact">Only one contract can be active at a time. Return here to claim completed rewards.</p>
    ${statusKey === "active" || anotherContractActive || !connected ? `<p class="bounty-detail-note compact">${escapeHtml(connectionNote)}</p>` : ""}
    ${claimLine ? `<p class="bounty-detail-note compact">${escapeHtml(claimLine)}</p>` : ""}
  `;
}

function renderBountyBoard() {
  if (isMultiplayerStagingActive() && !shouldUseLocalTutorialBountyFallback()) {
    renderMultiplayerStagingBountyBoard();
    return;
  }

  ensureDailyBounties();
  if (shouldUseLocalTutorialBountyFallback()) {
    applyTutorialBountyFallbackContract();
  }
  updateBountyResetCountdown();

  const title = document.getElementById("bountyLocationTitle");
  const grid = document.getElementById("bountyContractGrid");
  const countLabel = document.querySelector(".bounty-list-count");

  if (title) title.textContent = shouldUseLocalTutorialBountyFallback() ? "STARTER BOUNTY" : `DAILY CONTRACTS`;
  if (countLabel && shouldUseLocalTutorialBountyFallback()) countLabel.textContent = "1 CONTRACT";
  if (countLabel && !shouldUseLocalTutorialBountyFallback()) countLabel.textContent = `${formatNumber(dailyBountyContracts.length)} CONTRACTS`;

  if (activeObjective?.type === "bounty" && activeObjective.status === "readyToClaim") {
    selectedBountyContractId = activeObjective.contractId;
  }

  if (!selectedBountyContractId || !getBountyContract(selectedBountyContractId)) {
    selectedBountyContractId = dailyBountyContracts.find(contract => contract.status === "readyToClaim")?.id || dailyBountyContracts.find(contract => !["completed", "claimed", "failed"].includes(contract.status))?.id || dailyBountyContracts[0]?.id || null;
  }

  if (grid) {
    grid.innerHTML = dailyBountyContracts.map(contract => {
      const isSelected = selectedBountyContractId === contract.id;
      const status = getBountyStatusLabel(contract);
      const complete = contract.status === "completed" || contract.status === "claimed";
      const ready = contract.status === "readyToClaim";
      const failed = contract.status === "failed";
      const active = contract.status === "active";
      const statusKey = complete ? "claimed" : ready ? "completed" : failed ? "failed" : active ? "active" : "available";
      const icon = getBountyIconSrc(contract.icon || contract.fallbackIcon);
      return `
        <button type="button" class="bounty-card bounty-contract-card bounty-card--${escapeHtml(contract.type || "standard")} bounty-card--${statusKey} ${isSelected ? "selected bounty-card--selected" : ""} ${complete ? "completed" : ""} ${ready ? "ready-to-claim" : ""} ${failed ? "failed" : ""} ${active ? "active" : ""}" data-bounty-contract-id="${escapeHtml(contract.id)}" aria-pressed="${isSelected ? "true" : "false"}" aria-label="${escapeHtml(`${contract.title || contract.name}, ${status}, ${formatBountyReward(contract.reward)}`)}" onclick="selectBountyContract('${escapeJsString(contract.id)}')">
          ${ready || complete ? `<span class="bounty-card__status-check" aria-hidden="true">✓</span>` : ""}
          <span class="bounty-card__icon-frame bounty-card-icon"><img src="${icon}" alt="" onerror="this.remove(); this.parentElement.classList.add('missing-image');"></span>
          <span class="bounty-card__body bounty-card-copy">
            <strong class="bounty-card__title">${escapeHtml(contract.title || contract.name)}</strong>
            <span class="bounty-card__subtitle">${escapeHtml(contract.subtitle || contract.description)}</span>
            <span class="bounty-card__chips">
              <span class="bounty-chip bounty-chip--${escapeHtml(contract.type || "standard")}">${escapeHtml(contract.contractType || "Kill Contract")}</span>
              <span class="bounty-chip bounty-chip--target">${escapeHtml(getBountyTargetLabel(contract))}</span>
              <span class="bounty-chip bounty-card-threat">Threat · ${escapeHtml(contract.threat || "Standard")}</span>
              ${active ? `<span class="bounty-chip bounty-chip--accepted">✓ ACCEPTED</span>` : ""}
            </span>
          </span>
          <span class="bounty-reward-box bounty-card-reward bounty-reward">
            <span class="bounty-reward-box__label">PAYOUT</span>
            <strong class="bounty-reward-box__value"><span>CR ${formatNumber(cloneBountyReward(contract.reward).credits)}</span><span><img class="bounty-reward-box__icon" src="assets/items/lupen-shard.png" alt=""> ${formatNumber(cloneBountyReward(contract.reward).lupenShards)} Lupen Shards</span></strong>
            <em class="bounty-card-status bounty-status-chip bounty-status-chip--${statusKey}">${active ? "ACCEPTED" : status}</em>
          </span>
        </button>
      `;
    }).join("");
  }

  renderBountyDetail();
}

function selectBountyContract(contractId) {
  selectedBountyContractId = contractId;
  renderBountyBoard();
}

function renderBountyDetail() {
  const panel = document.getElementById("bountyDetailPanel");
  if (!panel) return;

  const contract = getBountyContract(selectedBountyContractId);
  if (!contract) {
    const shell = panel.closest(".selected-contract-panel");
    if (shell) {
      ["available", "active", "completed", "claimed", "failed"].forEach(state => shell.classList.remove(`selected-contract-panel--${state}`));
    }
    panel.innerHTML = `<div class="bounty-empty">No bounty selected.</div>`;
    return;
  }

  const active = activeObjective?.type === "bounty" && activeObjective.contractId === contract.id;
  const readyToClaim = contract.status === "readyToClaim" || (active && activeObjective.status === "readyToClaim");
  const complete = contract.status === "completed" || contract.status === "claimed";
  const failed = contract.status === "failed";
  const stateKey = complete ? "claimed" : readyToClaim ? "completed" : failed ? "failed" : active ? "active" : "available";
  const shell = panel.closest(".selected-contract-panel");
  if (shell) {
    ["available", "active", "completed", "claimed", "failed"].forEach(state => shell.classList.remove(`selected-contract-panel--${state}`));
    shell.classList.add(`selected-contract-panel--${stateKey}`);
  }
  const requiredKills = getBountyRequiredKills(contract);
  const progress = readyToClaim ? requiredKills : active ? activeObjective.kills : contract.progress;
  const progressPct = Math.max(0, Math.min(100, Math.round((progress / Math.max(1, requiredKills)) * 100)));
  const buttonDisabled = active || complete || readyToClaim || failed || Boolean(getActiveObjective());
  const buttonText = complete ? "Claimed" : failed ? "Failed" : readyToClaim ? "Claim Reward" : active ? "Active Contract" : getActiveObjective() ? "Objective Active" : "Accept Contract";
  const stateText = failed ? "FAILED" : readyToClaim ? "COMPLETE" : complete ? "CLAIMED" : active ? "ACTIVE" : "AVAILABLE";
  const timerParts = getBountyTimerParts(contract);
  const icon = getBountyIconSrc(contract.icon || contract.fallbackIcon);
  const timeLimitText = contract.timed
    ? (contract.status === "active" ? formatBountyTime(getBountyRemainingSeconds(contract)) : formatBountyTime(contract.timeLimitSeconds || 0))
    : "-";
  const infoRows = [
    { label: "Target", value: getBountyTargetLabel(contract) },
    { label: "Hunt Zone", value: contract.area || getBountyAreaLabel(contract.targetArea) },
    { label: "Threat", value: contract.threat || "Standard" },
    { label: "Time Limit", value: contract.timed ? timeLimitText : "No limit" }
  ];

  panel.innerHTML = `
    <div class="selected-contract-top bounty-detail-hero selected-bounty-header selected-contract-top--${stateKey} ${readyToClaim ? "reward-ready" : ""} ${complete ? "completed" : ""} ${failed ? "failed" : ""}">
      <div class="selected-contract-icon bounty-detail-icon"><img src="${icon}" alt="" onerror="this.remove(); this.parentElement.classList.add('missing-image');"></div>
      <div class="selected-contract-copy">
        <span class="bounty-detail-tags"><span class="bounty-chip bounty-chip--${escapeHtml(contract.type || "standard")}">${escapeHtml(contract.contractType || "Kill Contract")}</span><span class="selected-contract-state bounty-status-chip bounty-status-chip--${stateKey}">${escapeHtml(stateText)}</span></span>
        ${active && !readyToClaim ? `<span class="selected-contract-active-badge">✓ ACTIVE CONTRACT</span>` : ""}
        ${readyToClaim || complete ? `<span class="selected-contract-check" aria-hidden="true">✓</span>` : ""}
        <strong>${escapeHtml(contract.title || contract.name)}</strong>
        <span>${readyToClaim ? "Contract complete. Claim your reward while docked." : complete ? "Reward claimed. This bounty is closed." : failed ? "This timed contract has expired." : getBountyObjectiveText(contract)}</span>
      </div>
    </div>

    ${renderBountyRewardBrief(contract.reward)}

    <div class="selected-contract-progress bounty-detail-progress-block selected-bounty-progress">
      <div class="bounty-progress-heading"><span>Progress</span><strong>${formatNumber(progress)} / ${formatNumber(requiredKills)}</strong></div>
      <div class="bounty-progress-bar"><span style="width:${progressPct}%"></span></div>
      <div class="bounty-progress-state bounty-progress-state--${stateKey}">${escapeHtml(getBountyProgressStatusLine(stateKey))}</div>
    </div>

    <div class="selected-contract-rows bounty-detail-grid">
      ${renderBountyInfoRows(infoRows)}
    </div>

    <div class="selected-contract-actions bounty-detail-actions">
      ${readyToClaim ? `<button class="selected-contract-action bounty-claim-btn" onclick="claimBountyReward('${escapeJsString(contract.id)}')">Claim Reward</button>` : `<button class="selected-contract-action bounty-accept-btn accept-bounty-button ${active ? "bounty-active-state-btn" : ""}" ${buttonDisabled ? "disabled" : ""} onclick="acceptBountyContract('${escapeJsString(contract.id)}')">${active ? "✓ Active Contract" : buttonText}</button>`}
      ${active && !readyToClaim ? `<button class="bounty-cancel-btn" onclick="cancelActiveBountyContract('${escapeJsString(contract.id)}')">Cancel Bounty</button>` : ""}
    </div>
    <p class="bounty-detail-note compact">Only one contract can be active at a time. Return here to claim completed rewards.</p>
    ${getActiveObjective() && !active && !readyToClaim ? `<p class="bounty-detail-note">Finish your current active objective before accepting another.</p>` : ""}
  `;
}

function createBountyObjective(contract) {
  const requiredKills = getBountyRequiredKills(contract);
  return {
    id: `bounty-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    type: "bounty",
    contractId: contract.id,
    title: contract.title || contract.name,
    targetArea: contract.targetArea || "anyHostile",
    targetLabel: contract.targetLabel || getBountyAreaLabel(contract.targetArea),
    targetBotType: contract.targetBotType || null,
    targetBotLabel: contract.targetBotLabel || "Hostile Bot",
    killsRequired: requiredKills,
    kills: contract.progress || 0,
    reward: contract.reward,
    timed: Boolean(contract.timed),
    timeLimitSeconds: contract.timeLimitSeconds || null,
    expiresAt: contract.expiresAt || null,
    lootChance: contract.lootChance,
    materialReward: contract.materialReward || null,
    icon: getBountyIconSrc(contract.icon || contract.fallbackIcon),
    createdAt: Date.now(),
    status: "active"
  };
}

function generateBountyMaterialRewards(contract) {
  const rule = contract?.materialReward;
  if (!rule || Math.random() >= Number(rule.chance || 0)) return [];
  const rawMaterialKey = rule.altMaterialKey && Math.random() < 0.5 ? rule.altMaterialKey : rule.materialKey;
  const materialKey = ["weaponParts", "equipmentModules"].includes(rawMaterialKey) ? "lupenShards" : rawMaterialKey;
  const definition = upgradeMaterialDefinitions?.[materialKey];
  if (!definition) return [];

  const min = Math.max(1, Math.floor(Number(rule.min || 1)));
  const max = Math.max(min, Math.floor(Number(rule.max || min)));
  const quantity = min + Math.floor(Math.random() * (max - min + 1));
  upgradeMaterials = normalizeUpgradeMaterials(upgradeMaterials);
  upgradeMaterials[materialKey] = Math.max(0, Number(upgradeMaterials[materialKey] || 0)) + quantity;

  return [{
    rewardType: "material",
    key: materialKey,
    quantity,
    name: definition.name,
    icon: definition.icon,
    quality: "refined"
  }];
}

function acceptBountyContract(contractId) {
  const existingObjective = getActiveObjective();
  if (existingObjective) {
    alert("Complete your current active objective first.");
    return;
  }

  const contract = getBountyContract(contractId);
  if (!contract || ["completed", "claimed"].includes(contract.status)) return;
  if (contract.status === "failed") {
    alert("That contract has expired.");
    return;
  }

  contract.status = "active";
  contract.progress = 0;
  contract.expiresAt = contract.timed ? Date.now() + (Number(contract.timeLimitSeconds || 0) * 1000) : null;
  activeObjective = createBountyObjective(contract);
  activeBountyId = contract.id;
  selectedBountyContractId = contract.id;

  addActivityLog(`Bounty accepted: ${contract.title || contract.name}. Target: ${contract.targetBotLabel}.`);
  tutorialEvent("acceptedBounty");
  renderBountyBoard();
  updateHudDock();
  saveGame();
}

function cancelActiveBountyContract(contractId = null) {
  if (activeObjective?.type !== "bounty") return;

  const contract = getBountyContract(contractId || activeObjective.contractId);
  if (!contract || contract.id !== activeObjective.contractId) return;

  contract.status = "available";
  contract.progress = 0;
  contract.expiresAt = null;
  selectedBountyContractId = contract.id;
  activeBountyId = null;
  addActivityLog(`Bounty cancelled: ${contract.title || contract.name}.`);
  activeObjective = null;

  renderBountyBoard();
  updateHudDock();
  drawSectorMap();
  saveGame();
}

function completeActiveBountyObjective() {
  if (activeObjective?.type !== "bounty") return;

  const contract = getBountyContract(activeObjective.contractId);
  if (contract) {
    contract.status = "readyToClaim";
    contract.progress = activeObjective.killsRequired;
  }

  activeObjective.kills = activeObjective.killsRequired;
  activeObjective.status = "readyToClaim";
  selectedBountyContractId = activeObjective.contractId;
  jumpCharge = jumpMax;
  if (jumpTimer) {
    clearInterval(jumpTimer);
    jumpTimer = null;
  }

  addActivityLog(`Bounty complete: ${activeObjective.title}. Return to any planet to claim ${formatBountyReward(contract?.reward || activeObjective.reward)}.`);
  showBountyCompleteBurst(activeObjective);
  updateHudDock();
  updateBountyHubBadge();
  updateSpaceHUD();
  renderBountyBoard();
  if (document.getElementById("sectorMap")?.classList.contains("active")) renderSectorMap();
  saveGame();
}

function claimBountyReward(contractId) {
  const contract = getBountyContract(contractId);
  if (!contract || contract.status !== "readyToClaim") return;

  if (tutorialState?.active && ["claim-bounty", "continue-after-bounty-reward"].includes(getCurrentTutorialStep()?.id)) {
    contract.reward = {
      ...cloneBountyReward(contract.reward),
      xp: 0,
      lupenCores: 0,
      lupenShards: Math.max(25, Number(contract.reward?.lupenShards || 0))
    };
  }

  let bonusDrops = [];
  if (Math.random() < Number(contract.lootChance || 0)) {
    bonusDrops = generateBotLootItems();
  }

  const reward = cloneBountyReward(contract.reward);
  const neededItemSlots = reward.lupenCores + bonusDrops.length;
  if (!canAddInventoryItems(neededItemSlots)) {
    alert(INVENTORY_FULL_MESSAGE);
    return;
  }

  const rewardSummary = formatBountyReward(contract.reward);
  const applied = applyBountyReward(contract);

  if (bonusDrops.length) {
    const inventoryResult = addInventoryItems(bonusDrops);
    bonusDrops = inventoryResult.added;
    if (bonusDrops.length) showItemFoundBurst(bonusDrops);
  }
  const materialDrops = generateBountyMaterialRewards(contract);
  bonusDrops = [...bonusDrops, ...materialDrops];

  const bonusText = bonusDrops.length ? summarizeInventoryItems(bonusDrops) : "No bonus loot recovered.";
  contract.status = "claimed";
  contract.progress = getBountyRequiredKills(contract);
  contract.expiresAt = null;
  if (typeof recordBountyClaimProgress === "function") {
    recordBountyClaimProgress(contract);
  } else if (typeof recordMissionEvent === "function") {
    recordMissionEvent("claim_bounty", { contractId: contract.id, title: contract.title || contract.name || "Bounty" });
  }

  if (activeObjective?.type === "bounty" && activeObjective.contractId === contract.id) {
    activeObjective = null;
  }
  if (activeBountyId === contract.id) activeBountyId = null;

  selectedBountyContractId = dailyBountyContracts.find(item => item.status === "readyToClaim")?.id || dailyBountyContracts.find(item => item.status === "available")?.id || contract.id;
  addActivityLog(`Bounty reward claimed: ${contract.title || contract.name}. +${rewardSummary}. ${bonusText}`);
  tutorialEvent("claimedBountyReward");
  if (typeof playRewardClaimSound === "function") playRewardClaimSound();
  showBountyRewardOverlay(contract.title || contract.name, applied, bonusDrops);
  if (tutorialState?.active && getCurrentTutorialStep()?.id === "continue-after-bounty-reward") {
    setTimeout(renderStarterTutorial, 80);
  }
  updateHudDock();
  updateBountyHubBadge();
  renderBountyBoard();
  saveGame();
}

function recordBountyClaimProgress(contract = {}, options = {}) {
  const defaultKey = `${dailyBountyDate || "bounty"}:${contract.id || contract.contractId || ""}`;
  const eventKey = String(options.eventKey || contract.claimKey || defaultKey).trim();
  const missionEventKey = eventKey ? `claim_bounty:${eventKey}` : "";
  if (eventKey) {
    if (!recordBountyClaimProgress.keys) recordBountyClaimProgress.keys = new Set();
    if (recordBountyClaimProgress.keys.has(eventKey)) return false;
    recordBountyClaimProgress.keys.add(eventKey);
  }

  playerProgress = normalizePlayerProgress(playerProgress);
  missionProgress = typeof normalizeMissionProgress === "function"
    ? normalizeMissionProgress(missionProgress)
    : (missionProgress && typeof missionProgress === "object" ? missionProgress : {});
  missionProgress.eventKeys = missionProgress.eventKeys && typeof missionProgress.eventKeys === "object" ? missionProgress.eventKeys : {};
  if (missionEventKey && missionProgress.eventKeys[missionEventKey]) return false;
  if (missionEventKey) missionProgress.eventKeys[missionEventKey] = true;

  playerProgress.totals.bountiesClaimed = Math.max(0, Number(playerProgress.totals.bountiesClaimed || 0)) + 1;

  if (typeof recordMissionEvent === "function") {
    recordMissionEvent("claim_bounty", {
      contractId: contract.id || contract.contractId || "bounty",
      title: contract.title || contract.name || "Bounty",
      eventKey
    });
  }
  if (typeof reconcileMissionProgressFromGameplayState === "function") {
    reconcileMissionProgressFromGameplayState({ bountyClaimed: true, refresh: options.refresh !== false, save: false });
  }
  if (typeof updateProgressDisplays === "function") updateProgressDisplays();
  if (options.save !== false && typeof saveGame === "function") saveGame();
  return true;
}

function applyBountyReward(bounty) {
  const reward = cloneBountyReward(bounty?.reward);
  credits += reward.credits;
  upgradeMaterials = normalizeUpgradeMaterials(upgradeMaterials);
  upgradeMaterials.lupenShards = Math.max(0, Number(upgradeMaterials.lupenShards || 0)) + reward.lupenShards;

  return reward;
}

function showBountyRewardOverlay(title, reward, bonusDrops = []) {
  let overlay = document.getElementById("bountyRewardOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "bountyRewardOverlay";
    overlay.className = "reward-overlay";
    document.body.appendChild(overlay);
  }

  const lootMarkup = bonusDrops.length
    ? bonusDrops.map(item => {
        if (item.rewardType === "material") {
          return `<div class="reward-loot-card quality-${item.quality || "refined"}"><img src="${item.icon || "assets/items/weapon-upgrade-parts.png"}" alt="${item.name || item.key}"><span>${escapeHtml(item.name || item.key)} x${formatNumber(item.quantity || 1)}</span></div>`;
        }
        const definition = itemDefinitions[item.key] || {};
        return `<div class="reward-loot-card quality-${item.quality}"><img src="${definition.icon || "assets/items/lupen-core.png"}" alt="${definition.name || item.key}"><span>${titleCaseQuality(item.quality)} ${definition.name || item.key}</span></div>`;
      }).join("")
    : `<div class="reward-no-loot">No bonus loot recovered.</div>`;

  overlay.innerHTML = `
    <div class="reward-modal">
      <div class="reward-kicker">Bounty Reward Claimed</div>
      <h2>${title}</h2>
      <div class="reward-credit-pulse">+ ${formatBountyReward(reward)}</div>
      <div class="reward-loot-list">${lootMarkup}</div>
      <button onclick="closeBountyRewardOverlay()">Continue</button>
    </div>
  `;
  overlay.dataset.rewardPending = "true";
  overlay.classList.toggle("tutorial-reward-active", Boolean(tutorialState?.active));

  requestAnimationFrame(() => overlay.classList.add("active"));
}

function closeBountyRewardOverlay() {
  const overlay = document.getElementById("bountyRewardOverlay");
  if (overlay) {
    overlay.classList.remove("active");
    overlay.classList.remove("tutorial-intro-active");
    overlay.classList.remove("tutorial-reward-active");
    delete overlay.dataset.rewardPending;
  }
  tutorialEvent("closedBountyReward");
}

function trackBountyBotKill(bot) {
  if (activeObjective?.type !== "bounty") return;
  if (activeObjective.status === "readyToClaim") return;
  if (!bot) return;
  const botNode = bot.currentNodeId || bot.node;
  if (!isNodeInBountyArea(botNode, activeObjective.targetArea)) return;

  const contract = getBountyContract(activeObjective.contractId);
  if (!contract || contract.status !== "active") return;
  if (contract.timed && contract.expiresAt && Date.now() > Number(contract.expiresAt)) {
    expireBountyContract(contract);
    renderBountyBoard();
    return;
  }
  if (!doesBotCountForBounty(bot, contract)) {
    addActivityLog(`Bounty target mismatch: destroyed ${bot.displayName || bot.name || "hostile bot"}, but ${contract.targetBotLabel} required.`);
    updateHudDock();
    return;
  }

  activeObjective.kills = Math.min(activeObjective.killsRequired, (activeObjective.kills || 0) + 1);

  if (contract) {
    contract.progress = activeObjective.kills;
    contract.status = "active";
  }

  addActivityLog(`Bounty progress: ${activeObjective.title} ${activeObjective.kills}/${activeObjective.killsRequired}.`);

  if (activeObjective.kills >= activeObjective.killsRequired) {
    completeActiveBountyObjective();
  } else {
    updateHudDock();
    saveGame();
  }
}

