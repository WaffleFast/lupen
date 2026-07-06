/* Asteroid / combat */

/* Asteroid / combat */

let lastRemotePlayerEngageNoticeKey = "";
let lastRemotePlayerEngageNoticeAt = 0;
let serverPvpDamageDisplayState = null;
let lastPvpHullFeedbackState = "";
let lastResourceCargoFullNoticeAt = 0;

function getPvpHullStatus(hullValue, hullMaxValue) {
  const hullNumber = Number(hullValue);
  const hullMaxNumber = Number(hullMaxValue);
  if (!Number.isFinite(hullNumber) || !Number.isFinite(hullMaxNumber) || hullMaxNumber <= 0) return "";
  if (hullNumber <= 0) return "disabled-threshold";
  if (hullNumber > 0 && hullNumber <= Math.max(1, Math.round(hullMaxNumber * 0.2))) return "critical";
  return "";
}

function getPvpHullStatusMessage(status) {
  if (status === "disabled-threshold") return "Ship destroyed. Emergency return to Asteron Prime.";
  if (status === "critical") return "Hull integrity critical.";
  return "";
}

function reportPvpHullStatusFeedback(state = {}) {
  const status = getPvpHullStatus(state.hull, state.hullMax);
  if (!status) {
    lastPvpHullFeedbackState = "";
    return false;
  }
  if (status === lastPvpHullFeedbackState) return false;
  lastPvpHullFeedbackState = status;
  const message = getPvpHullStatusMessage(status);
  if (message && typeof addActivityLog === "function") addActivityLog(message);
  return true;
}

function applyServerPvpDamageState(hit = {}) {
  const shieldMaxValue = Number(hit.shieldMax);
  const hullMaxValue = Number(hit.hullMax);
  const armorMaxValue = Number(hit.armorMax);
  const shieldValue = Number(hit.shield);
  const armorValue = Number(hit.armor);
  const hullValue = Number(hit.hull);
  if (!Number.isFinite(shieldValue) && !Number.isFinite(hullValue)) return false;

  serverPvpDamageDisplayState = {
    shield: Number.isFinite(shieldValue) ? Math.max(0, shieldValue) : null,
    shieldMax: Number.isFinite(shieldMaxValue) && shieldMaxValue > 0 ? shieldMaxValue : null,
    armor: Number.isFinite(armorValue) ? Math.max(0, armorValue) : null,
    armorMax: Number.isFinite(armorMaxValue) && armorMaxValue >= 0 ? armorMaxValue : null,
    hull: Number.isFinite(hullValue) ? Math.max(0, hullValue) : null,
    hullMax: Number.isFinite(hullMaxValue) && hullMaxValue > 0 ? hullMaxValue : null,
    deathApplied: hit.deathApplied === true,
    updatedAt: Date.now()
  };
  if (hit.deathApplied !== true) {
    reportPvpHullStatusFeedback(serverPvpDamageDisplayState);
  }
  if (typeof updateSpaceHUD === "function") updateSpaceHUD();
  return true;
}

function applyServerPvpDestructionState(event = {}) {
  const targetSessionId = String(event.targetSessionId || event.targetPlayerId || "");
  const localSessionId = String(window.LupenMultiplayerClient?.getStatus?.()?.sessionId || "");
  const isLocalTarget = targetSessionId && targetSessionId === localSessionId;
  const recoveryNode = String(event.currentNode || "Asteron Prime") || "Asteron Prime";

  applyServerPvpDamageState({
    ...event,
    reason: "pvp_player_destroyed",
    deathApplied: false
  });

  if (isLocalTarget) {
    currentNode = recoveryNode;
    if (typeof sectorNodes !== "undefined" && sectorNodes?.[recoveryNode]?.type === "planet") lastPlanetNode = recoveryNode;
    const recoveredHull = Number(event.hull);
    const recoveredShield = Number(event.shield);
    if (Number.isFinite(recoveredHull) && recoveredHull > 0) hull = recoveredHull;
    if (Number.isFinite(recoveredShield) && recoveredShield >= 0) shield = recoveredShield;
    if (typeof saveActiveShipCondition === "function") saveActiveShipCondition(currentShipId);
    jumpCharge = 0;
    stopShieldRegen();
    clearRemotePlayerTarget("pvp_destroyed_self");
    closeSectorMap();
    if (typeof updateCurrentNodeUI === "function") updateCurrentNodeUI();
    if (typeof updateHubLocation === "function") updateHubLocation();
    if (typeof updateSpaceHUD === "function") updateSpaceHUD();
    if (typeof showScreen === "function") showScreen("gameScreen");
    if (typeof saveGame === "function") saveGame();
  } else {
    clearRemotePlayerTarget("pvp_destroyed_remote");
  }

  updateAsteroidUI();
  updateTargetPanel();
  updateObjectActionPanel(false);
  window.LupenMultiplayerOverlay?.render?.();
  return true;
}

function isSameTargetRef(left, right) {
  return Boolean(left && right && left.type === right.type && left.id === right.id);
}

function getCurrentWeaponFireIntervalMs() {
  const weapon = typeof getEquippedWeapon === "function" ? getEquippedWeapon() : null;
  const speed = Number(weapon?.speed);
  const interval = Number.isFinite(speed) && speed > 0 ? Math.round(speed) : 950;
  return Math.max(250, Math.min(4000, interval));
}

function getTargetRefFromEntity(target) {
  if (!target) return null;
  return {
    type: getTargetTypeFromEntity(target),
    id: target.id
  };
}

function retargetEngagementToSelectedTarget() {
  if (!engageTimer) return false;
  reconcileStagingBotTargetState();

  const target = getSelectedTargetEntity();
  if (!target || !target.alive || !isCombatEntityInCurrentNode(target)) return false;

  const nextTargetRef = getTargetRefFromEntity(target);
  if (!nextTargetRef || isSameTargetRef(nextTargetRef, engagedTarget)) return false;

  engagedTarget = nextTargetRef;
  updateAsteroidUI();
  updateTargetPanel();
  updateObjectActionPanel(true);
  clearInterval(engageTimer);
  if (nextTargetRef.type === "stagingBot") {
    performStagingBotAttackCycle();
    engageTimer = setInterval(performStagingBotAttackCycle, getCurrentWeaponFireIntervalMs());
  } else if (nextTargetRef.type === "stagingResource") {
    performStagingResourceAttackCycle();
    engageTimer = setInterval(performStagingResourceAttackCycle, getCurrentWeaponFireIntervalMs());
  } else {
    performAttackCycle();
    engageTimer = setInterval(performAttackCycle, getCurrentWeaponFireIntervalMs());
  }
  return true;
}

function selectAsteroid(asteroidId) {
  if (typeof shouldUseServerOwnedSectorObjects === "function" && shouldUseServerOwnedSectorObjects()) return;

  const asteroid = getAsteroidById(asteroidId);

  if (!asteroid || !asteroid.alive || asteroid.node !== currentNode) return;

  selectedTarget = { type: "asteroid", id: asteroid.id };
  showTargetPanel();
  updateAsteroidUI();
  updateTargetPanel();
  updateObjectActionPanel(false);
}

function selectHostileBot(botId) {
  if (typeof isStagingLocalCombatBotVisualGuardActive === "function" && isStagingLocalCombatBotVisualGuardActive()) return;

  const bot = getHostileBotById(botId);

  if (!bot || !bot.alive || !isCombatEntityInCurrentNode(bot)) return;

  selectedTarget = { type: "hostileBot", id: bot.id };
  showTargetPanel();
  updateAsteroidUI();
  updateTargetPanel();
  updateObjectActionPanel(false);

  if (tutorialState?.active && getCurrentTutorialStep()?.id === "destroy-bot") {
    setTimeout(renderStarterTutorial, 40);
  }
}

function selectStagingBotTarget(botId) {
  const bot = getStagingBotTargetById(botId);
  if (!bot || !bot.alive || !isCombatEntityInCurrentNode(bot)) return;

  selectedTarget = { type: "stagingBot", id: bot.id };
  window.LupenMultiplayerClient?.selectStagingBot?.(bot.id, { currentNode });
  showTargetPanel();
  updateAsteroidUI();
  updateTargetPanel();
  updateObjectActionPanel(false);

  if (tutorialState?.active && ["jump-to-bounty-zone", "destroy-bot"].includes(getCurrentTutorialStep()?.id)) {
    setTimeout(renderStarterTutorial, 40);
  }
}

function selectStagingResourceTarget(resourceId) {
  const resource = getStagingResourceTargetById(resourceId);
  if (!resource || !resource.alive || !isCombatEntityInCurrentNode(resource)) return;

  selectedTarget = { type: "stagingResource", id: resource.id };
  window.LupenMultiplayerOverlay?.setSelectedResourceId?.(resource.id);
  showTargetPanel();
  updateAsteroidUI();
  updateTargetPanel();
  updateObjectActionPanel(false);
}

function getOverlaySelectedStagingResourceTarget() {
  const resourceId = window.LupenMultiplayerOverlay?.getSelectedResourceId?.();
  const resource = resourceId ? getStagingResourceTargetById(resourceId) : null;
  if (!resource || !resource.alive || !isCombatEntityInCurrentNode(resource)) return null;
  return resource;
}

function syncOverlaySelectedResourceToCoreTarget() {
  const resource = getOverlaySelectedStagingResourceTarget();
  if (!resource) return null;
  selectedTarget = { type: "stagingResource", id: resource.id };
  return resource;
}

function getSelectedTargetEntityForAction() {
  return getSelectedTargetEntity() || syncOverlaySelectedResourceToCoreTarget();
}

function getCombatEntityNodeName(entity = {}) {
  return entity?.currentNodeId || entity?.currentNode || entity?.node || "";
}

function isCombatEntityInCurrentNode(entity = {}) {
  return getCombatEntityNodeName(entity) === currentNode;
}

function isCombatEntityMissingOrInCurrentNode(entity = {}) {
  const nodeName = getCombatEntityNodeName(entity);
  return !nodeName || nodeName === currentNode;
}

function isCurrentNodeProtectedForPvp() {
  const node = typeof sectorNodes !== "undefined" ? sectorNodes[currentNode] : null;
  return typeof isProtectedNode === "function"
    ? isProtectedNode(currentNode)
    : (node?.type === "planet" || ["Asteron Prime", "Virella", "Nyxara"].includes(String(currentNode || "")));
}

function getRemotePlayerTargetBlockReason(player = {}) {
  const targetNode = getCombatEntityNodeName(player);
  const status = String(player.presenceStatus || player.status || "space").toLowerCase();
  if (status === "docked") return "Target is docked.";
  if (targetNode && targetNode !== currentNode) return "Target is no longer in this node.";
  if (isCurrentNodeProtectedForPvp()) return "PvP disabled in protected zones.";

  const localGuildId = String(window.LupenMultiplayerClient?.getStatus?.()?.guildId || "").trim();
  const targetGuildId = String(player.guildId || "").trim();
  if (localGuildId && targetGuildId && localGuildId === targetGuildId) {
    return "Cannot engage guild allies.";
  }

  return "";
}

function canTargetRemotePlayerInCurrentZone(player = {}) {
  return !getRemotePlayerTargetBlockReason(player);
}

function shouldKeepRemotePlayerSelection(player = {}) {
  const targetNode = getCombatEntityNodeName(player);
  const status = String(player.presenceStatus || player.status || "space").toLowerCase();
  if (status === "docked") return false;
  if (targetNode && targetNode !== currentNode) return false;
  return true;
}

function getRemotePlayerEngageBlockMessage(player = {}) {
  return getRemotePlayerTargetBlockReason(player) || "PvP server hit test ready.";
}

function showRemotePlayerEngageBlockMessage(player = {}) {
  const message = getRemotePlayerEngageBlockMessage(player);
  const key = `${String(player.id || player.sessionId || "")}|${currentNode}|${message}`;
  const now = Date.now();
  if (key === lastRemotePlayerEngageNoticeKey && now - lastRemotePlayerEngageNoticeAt < 1800) {
    return false;
  }
  lastRemotePlayerEngageNoticeKey = key;
  lastRemotePlayerEngageNoticeAt = now;

  if (typeof addHudToast === "function") addHudToast(message);
  else if (typeof addActivityLog === "function") addActivityLog(message);
  return true;
}

function sendRemotePlayerPvpIntent(player = {}) {
  const blockReason = getRemotePlayerTargetBlockReason(player);
  if (blockReason) {
    showRemotePlayerEngageBlockMessage(player);
    return false;
  }

  const targetPlayerId = String(player.sessionId || player.id || "").trim();
  if (!targetPlayerId) {
    showRemotePlayerEngageBlockMessage({ ...player, id: "missing-pvp-target" });
    return false;
  }

  const result = window.LupenMultiplayerClient?.sendCombatIntent?.({
    targetType: "remotePlayer",
    targetPlayerId,
    targetSessionId: targetPlayerId,
    currentNode
  });

  if (!result?.ok) {
    const reason = String(result?.reason || "PvP server unavailable.");
    const message = reason === "not_connected"
      ? "PvP server unavailable."
      : reason.replace(/_/g, " ");
    const key = `${targetPlayerId}|${currentNode}|${message}`;
    const now = Date.now();
    if (key !== lastRemotePlayerEngageNoticeKey || now - lastRemotePlayerEngageNoticeAt >= 1800) {
      lastRemotePlayerEngageNoticeKey = key;
      lastRemotePlayerEngageNoticeAt = now;
      if (typeof addHudToast === "function") addHudToast(message);
      else if (typeof addActivityLog === "function") addActivityLog(message);
    }
    return false;
  }

  const message = "PvP hit request sent.";
  const key = `${targetPlayerId}|${currentNode}|${message}`;
  const now = Date.now();
  if (key !== lastRemotePlayerEngageNoticeKey || now - lastRemotePlayerEngageNoticeAt >= 1800) {
    lastRemotePlayerEngageNoticeKey = key;
    lastRemotePlayerEngageNoticeAt = now;
    if (typeof addActivityLog === "function") addActivityLog(message);
  }
  return true;
}

function clearRemotePlayerTarget(reason = "remote_player_target_cleared") {
  const selectedMatches = selectedTarget?.type === "remotePlayer";
  const engagedMatches = engagedTarget?.type === "remotePlayer";
  if (!selectedMatches && !engagedMatches) return false;
  const targetId = String(selectedMatches ? selectedTarget.id : engagedTarget?.id || "");
  if (targetId) clearCombatVisualsForTarget({ type: "remotePlayer", id: targetId });

  if (engagedMatches) {
    if (engageTimer) {
      clearInterval(engageTimer);
      engageTimer = null;
    }
    engagedTarget = null;
  }
  if (selectedMatches) selectedTarget = null;

  updateAsteroidUI();
  updateTargetPanel();
  updateObjectActionPanel(false);
  return true;
}

function reconcileRemotePlayerTargetEligibility(reason = "remote_player_target_reconcile") {
  const remoteTarget = selectedTarget?.type === "remotePlayer"
    ? getRemotePlayerTargetById(selectedTarget.id)
    : engagedTarget?.type === "remotePlayer"
      ? getRemotePlayerTargetById(engagedTarget.id)
      : null;
  if (!remoteTarget) return clearRemotePlayerTarget(reason);
  if (!shouldKeepRemotePlayerSelection(remoteTarget)) return clearRemotePlayerTarget(reason);
  return false;
}

function selectRemotePlayerTarget(playerId) {
  const player = getRemotePlayerTargetById(playerId);
  if (!player || !isCombatEntityInCurrentNode(player)) return;

  selectedTarget = { type: "remotePlayer", id: player.id };
  showTargetPanel();
  updateAsteroidUI();
  updateTargetPanel();
  updateObjectActionPanel(false);
}

function engageTarget() {
  if (typeof shouldUseServerOwnedSectorObjects === "function" && shouldUseServerOwnedSectorObjects() &&
    (selectedTarget?.type === "asteroid" || engagedTarget?.type === "asteroid")) {
    reconcileServerOwnedSectorObjectMode("engage_server_owned_sector_objects");
    return;
  }

  const staleStagingBotCleared = reconcileStagingBotTargetState();
  if (staleStagingBotCleared) return;

  let target = getSelectedTargetEntityForAction();

  if (target?.remotePlayer) {
    sendRemotePlayerPvpIntent(target);
    updateObjectActionPanel(false);
    return;
  }

  if (!target || !target.alive || !isCombatEntityInCurrentNode(target)) {
    target = getSelectedTargetEntityForAction() || getVisibleTargets()[0];
    if (target) {
      selectedTarget = {
        type: getTargetTypeFromEntity(target),
        id: target.id
      };
    }
  }

  if (!target || !target.alive || !isCombatEntityInCurrentNode(target)) return;
  if (engageTimer) {
    retargetEngagementToSelectedTarget();
    return;
  }

  engagedTarget = getTargetRefFromEntity(target);

  updateAsteroidUI();
  if (engagedTarget?.type === "stagingBot") {
    if (typeof addActivityLog === "function") addActivityLog(`Engaged ${target.name || "Staging Bot"}.`);
    performStagingBotAttackCycle();
    engageTimer = setInterval(performStagingBotAttackCycle, getCurrentWeaponFireIntervalMs());
  } else if (engagedTarget?.type === "stagingResource") {
    if (typeof addActivityLog === "function") addActivityLog(`Engaged ${target.name || "Resource Asteroid"}.`);
    performStagingResourceAttackCycle();
    engageTimer = setInterval(performStagingResourceAttackCycle, getCurrentWeaponFireIntervalMs());
  } else {
    performAttackCycle();
    engageTimer = setInterval(performAttackCycle, getCurrentWeaponFireIntervalMs());
  }
  updateTargetPanel();
}

function disengageTarget(keepTarget = false) {
  const disengagedRef = engagedTarget ? { ...engagedTarget } : null;
  const disengagedEntity = ["stagingBot", "stagingResource"].includes(disengagedRef?.type) ? getEngagedTargetEntity() : null;
  if (disengagedRef) clearCombatVisualsForTarget(disengagedRef);

  if (engageTimer) {
    clearInterval(engageTimer);
    engageTimer = null;
  }

  engagedTarget = null;

  if (disengagedRef?.type === "stagingBot") {
    if (typeof addActivityLog === "function") {
      addActivityLog(`Disengaged ${disengagedEntity?.name || "Staging Bot"}.`);
    }
    window.LupenMultiplayerClient?.clearStagingTarget?.();
  } else if (disengagedRef?.type === "stagingResource") {
    if (typeof addActivityLog === "function") {
      addActivityLog(`Disengaged ${disengagedEntity?.name || "Resource Asteroid"}.`);
    }
  }

  if (!keepTarget) {
    selectedTarget = null;
  }

  updateAsteroidUI();
  updateTargetPanel();
}

let weaponVisualCycleOffset = 0;
const COMBAT_FX_LAYER_ID = "combatFxLayer";
const COMBAT_FX_SVG_NS = "http://www.w3.org/2000/svg";
const COMBAT_FX_BEAM_DURATION_MS = 520;
const LOCAL_COMBAT_FX_BEAM_COUNT = 5;
const suppressedCombatVisualTargets = new Map();
const renderedCombatFxKeys = new Set();

function isCombatDebugEnabled() {
  try {
    return new URLSearchParams(window.location.search).get("debug") === "mp";
  } catch (_error) {
    return false;
  }
}

function debugCombatShot(message, detail = {}) {
  if (!isCombatDebugEnabled()) return;
  console.debug(`[combat] ${message}`, detail);
}

function getVisibleShotWeapons(weapon) {
  const allWeapons = Array.isArray(weapon?.weapons) && weapon.weapons.length
    ? weapon.weapons
    : [weapon].filter(Boolean);
  const visibleLimit = 6;

  if (allWeapons.length <= visibleLimit) return allWeapons;

  const visibleWeapons = [];
  for (let index = 0; index < visibleLimit; index += 1) {
    visibleWeapons.push(allWeapons[(weaponVisualCycleOffset + index) % allWeapons.length]);
  }
  weaponVisualCycleOffset = (weaponVisualCycleOffset + visibleLimit) % allWeapons.length;
  return visibleWeapons;
}

function getCombatVisualTargetRef(target = {}, options = {}) {
  const type = String(options.targetType || target.type || selectedTarget?.type || engagedTarget?.type || "").trim();
  const id = String(options.targetId || target.id || target.resourceId || target.botId || "").trim();
  if (!id) return null;
  return { type, id };
}

function getCombatVisualSuppressionKey(ref) {
  if (!ref?.id) return "";
  return `${String(ref.type || "target")}:${String(ref.id)}`;
}

function isCombatVisualTargetSuppressed(ref) {
  const key = getCombatVisualSuppressionKey(ref);
  if (!key) return false;
  const until = Number(suppressedCombatVisualTargets.get(key) || 0);
  if (until > Date.now()) return true;
  suppressedCombatVisualTargets.delete(key);
  return false;
}

function markCombatVisualTargetSuppressed(ref, durationMs = 1300) {
  const key = getCombatVisualSuppressionKey(ref);
  if (!key) return;
  suppressedCombatVisualTargets.set(key, Date.now() + Math.max(200, Number(durationMs || 0)));
}

function isCombatVisualTargetStillValid(ref) {
  if (!ref?.id || isCombatVisualTargetSuppressed(ref)) return false;
  if (ref.type === "stagingBot") return isStagingBotTargetStillValid(ref.id);
  if (ref.type === "stagingResource") {
    const resource = getStagingResourceTargetById(ref.id);
    return Boolean(resource && resource.alive && !resource.depleted && isCombatEntityInCurrentNode(resource));
  }
  if (ref.type === "remotePlayer") {
    const player = getRemotePlayerTargetById(ref.id);
    return Boolean(player && isCombatEntityInCurrentNode(player));
  }
  return true;
}

function isTargetRefStillValid(ref) {
  if (!ref?.id) return false;

  if (ref.type === "stagingBot") return isStagingBotTargetStillValid(ref.id);
  if (ref.type === "stagingResource") {
    const resource = getStagingResourceTargetById(ref.id);
    return Boolean(resource && resource.alive && !resource.depleted && isCombatEntityMissingOrInCurrentNode(resource));
  }
  if (ref.type === "hostileBot") {
    const bot = getHostileBotById(ref.id);
    const localBotVisualGuardActive = typeof isStagingLocalCombatBotVisualGuardActive === "function"
      && isStagingLocalCombatBotVisualGuardActive();
    return Boolean(bot && bot.alive && !localBotVisualGuardActive && isCombatEntityMissingOrInCurrentNode(bot));
  }
  if (ref.type === "asteroid") {
    const asteroid = getAsteroidById(ref.id);
    const serverOwnedActive = typeof shouldUseServerOwnedSectorObjects === "function" && shouldUseServerOwnedSectorObjects();
    return Boolean(!serverOwnedActive && asteroid && asteroid.alive && asteroid.node === currentNode);
  }
  if (ref.type === "remotePlayer") {
    const player = getRemotePlayerTargetById(ref.id);
    return Boolean(player && shouldKeepRemotePlayerSelection(player));
  }

  const entity = ref.type === selectedTarget?.type && ref.id === selectedTarget?.id
    ? getSelectedTargetEntity()
    : getEngagedTargetEntity();
  return Boolean(entity && entity.alive !== false && isCombatEntityMissingOrInCurrentNode(entity));
}

function reconcileTargetSessionState(reason = "reconcile_target_session", options = {}) {
  const selectedRef = selectedTarget ? { ...selectedTarget } : null;
  const engagedRef = engagedTarget ? { ...engagedTarget } : null;
  const selectedStale = Boolean(selectedRef && !isTargetRefStillValid(selectedRef));
  const engagedStale = Boolean(engagedRef && !isTargetRefStillValid(engagedRef));

  if (!selectedStale && !engagedStale) return { cleared: false, reason };

  if (selectedStale) clearCombatVisualsForTarget(selectedRef);
  if (engagedStale) clearCombatVisualsForTarget(engagedRef);

  if (engagedStale && engageTimer) {
    clearInterval(engageTimer);
    engageTimer = null;
  }
  if (engagedStale) engagedTarget = null;
  if (selectedStale) selectedTarget = null;

  if (selectedStale || engagedStale) {
    const clearedServerTarget = [selectedRef, engagedRef].some(ref => ["stagingBot", "stagingResource", "remotePlayer"].includes(ref?.type));
    if (clearedServerTarget) window.LupenMultiplayerClient?.clearStagingTarget?.();
  }

  if (options.update !== false) {
    updateAsteroidUI();
    updateTargetPanel();
    updateObjectActionPanel(false);
    window.LupenMultiplayerOverlay?.render?.();
  }

  return {
    cleared: true,
    reason,
    selectedCleared: selectedStale ? selectedRef : null,
    engagedCleared: engagedStale ? engagedRef : null
  };
}

function tagCombatVisualElement(element, ref, options = {}) {
  if (!element || !ref?.id) return;
  element.dataset.targetId = String(ref.id);
  element.dataset.targetType = String(ref.type || "target");
  if (options.attackerId) element.dataset.attackerId = String(options.attackerId);
}

function pruneRenderedCombatFxKeys() {
  if (renderedCombatFxKeys.size <= 80) return;
  const [oldest] = renderedCombatFxKeys;
  renderedCombatFxKeys.delete(oldest);
}

function ensureCombatFxLayer() {
  const spaceScreen = document.getElementById("spaceScreen");
  if (!spaceScreen) return null;
  const rect = spaceScreen.getBoundingClientRect();
  const width = Math.max(1, Math.round(rect.width));
  const height = Math.max(1, Math.round(rect.height));
  let layer = document.getElementById(COMBAT_FX_LAYER_ID);
  if (!layer) {
    layer = document.createElementNS(COMBAT_FX_SVG_NS, "svg");
    layer.id = COMBAT_FX_LAYER_ID;
    layer.classList.add("combat-fx-layer");
    layer.setAttribute("aria-hidden", "true");
    layer.setAttribute("focusable", "false");
    layer.setAttribute("preserveAspectRatio", "none");
    spaceScreen.appendChild(layer);
  }
  layer.setAttribute("viewBox", `0 0 ${width} ${height}`);
  layer.dataset.width = String(width);
  layer.dataset.height = String(height);
  return { layer, width, height };
}

function getCombatFxPointFromPercent(xPercent, yPercent) {
  const context = ensureCombatFxLayer();
  if (!context) return null;
  return {
    x: Math.max(0, Math.min(context.width, (Number(xPercent || 0) / 100) * context.width)),
    y: Math.max(0, Math.min(context.height, (Number(yPercent || 0) / 100) * context.height)),
    width: context.width,
    height: context.height
  };
}

function getCombatFxPointFromTarget(target = {}) {
  return getCombatFxPointFromPercent(target.x, target.y);
}

function getCombatFxActiveBounds(context = ensureCombatFxLayer()) {
  if (!context) return null;
  const activeTop = Math.min(100, Math.max(54, context.height * 0.12));
  const activeBottom = Math.max(activeTop + 100, context.height - 245);
  return {
    top: activeTop,
    bottom: activeBottom,
    left: 0,
    right: context.width
  };
}

function getCombatFxPointFromClientPoint(clientX, clientY) {
  const context = ensureCombatFxLayer();
  const spaceScreen = document.getElementById("spaceScreen");
  if (!context || !spaceScreen) return null;
  const rect = spaceScreen.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  return {
    x: Math.max(0, Math.min(context.width, Number(clientX || 0) - rect.left)),
    y: Math.max(0, Math.min(context.height, Number(clientY || 0) - rect.top)),
    width: context.width,
    height: context.height
  };
}

function getLocalPlayerIncomingFireEndpoint() {
  const spaceScreen = document.getElementById("spaceScreen");
  const cockpitPanel =
    document.querySelector(".player-bottom-hud .ship-panel") ||
    document.querySelector(".player-bottom-hud .ship-display-panel") ||
    document.querySelector(".player-bottom-hud");
  if (!spaceScreen || !cockpitPanel) return null;

  const screenRect = spaceScreen.getBoundingClientRect();
  const panelRect = cockpitPanel.getBoundingClientRect();
  if (!screenRect.width || !screenRect.height || !panelRect.width || !panelRect.height) return null;

  const edgeOffset = Math.max(6, Math.min(16, screenRect.height * 0.012));
  return getCombatFxPointFromClientPoint(
    panelRect.left + panelRect.width / 2,
    Math.max(screenRect.top + 12, Math.min(screenRect.bottom - 1, panelRect.top - edgeOffset))
  );
}

function getLocalCombatFxOriginsForTarget(targetPoint = {}, beamCount = LOCAL_COMBAT_FX_BEAM_COUNT) {
  const context = ensureCombatFxLayer();
  if (!context) return null;
  const bounds = getCombatFxActiveBounds(context);
  if (!bounds) return null;
  const targetY = Number(targetPoint?.y || bounds.top + (bounds.bottom - bounds.top) * 0.5);
  const edgeX = Number(targetPoint?.x || 0) < context.width * 0.5 ? bounds.right : bounds.left;
  const requestedCount = Math.max(1, Math.min(7, Math.round(Number(beamCount || LOCAL_COMBAT_FX_BEAM_COUNT))));
  const spread = Math.max(94, Math.min(190, (bounds.bottom - bounds.top) * 0.52));
  const middle = Math.max(bounds.top + spread * 0.5, Math.min(bounds.bottom - spread * 0.5, targetY));
  return Array.from({ length: requestedCount }, (_item, index) => {
    const ratio = requestedCount === 1 ? 0.5 : index / (requestedCount - 1);
    return {
      x: edgeX,
      y: Math.max(bounds.top, Math.min(bounds.bottom, middle - spread * 0.5 + ratio * spread)),
      width: context.width,
      height: context.height
    };
  });
}

function getLocalCombatFxOriginForTarget(targetPoint = {}) {
  const origins = getLocalCombatFxOriginsForTarget(targetPoint, 1);
  return Array.isArray(origins) ? origins[0] : origins;
}

function tagCombatFxElement(element, ref, options = {}) {
  if (!element) return;
  tagCombatVisualElement(element, ref, options);
  if (options.owner) element.dataset.owner = String(options.owner);
  if (options.fxEventKey) element.dataset.fxEventKey = String(options.fxEventKey);
}

function renderCombatFxImpact(point, options = {}) {
  const context = ensureCombatFxLayer();
  if (!context || !point) return false;
  const ref = options.targetRef || null;
  if (ref && !isCombatVisualTargetStillValid(ref)) return false;

  const impact = document.createElementNS(COMBAT_FX_SVG_NS, "circle");
  impact.classList.add("combat-fx-impact", options.tone === "bot" ? "is-bot-return" : "is-player-fire");
  tagCombatFxElement(impact, ref, options);
  impact.setAttribute("cx", String(Math.max(0, Math.min(context.width, Number(point.x || 0)))));
  impact.setAttribute("cy", String(Math.max(0, Math.min(context.height, Number(point.y || 0)))));
  impact.setAttribute("r", "8");
  impact.style.setProperty("--combat-fx-color", options.color || (options.tone === "bot" ? "#ff8756" : "#55e8ff"));
  context.layer.appendChild(impact);
  setTimeout(() => impact.remove(), Math.max(180, Number(options.durationMs || COMBAT_FX_BEAM_DURATION_MS)));
  return true;
}

function renderCombatFxBeam(sourcePoint, targetPoint, options = {}) {
  const context = ensureCombatFxLayer();
  if (!context || !sourcePoint || !targetPoint) return false;
  const ref = options.targetRef || null;
  if (ref && !isCombatVisualTargetStillValid(ref)) return false;

  const eventKey = String(options.fxEventKey || "").trim();
  if (eventKey) {
    if (renderedCombatFxKeys.has(eventKey)) return false;
    renderedCombatFxKeys.add(eventKey);
    pruneRenderedCombatFxKeys();
  }

  const durationMs = Math.max(260, Math.min(900, Number(options.durationMs || COMBAT_FX_BEAM_DURATION_MS)));
  const tone = options.tone === "bot" ? "bot" : "player";
  const color = options.color || (tone === "bot" ? "#ff8756" : "#55e8ff");
  const sourcePoints = (Array.isArray(sourcePoint) ? sourcePoint : [sourcePoint])
    .map((point) => ({
      x: Math.max(0, Math.min(context.width, Number(point?.x || 0))),
      y: Math.max(0, Math.min(context.height, Number(point?.y || 0)))
    }))
    .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
  if (!sourcePoints.length) return false;
  const target = {
    x: Math.max(0, Math.min(context.width, Number(targetPoint.x || 0))),
    y: Math.max(0, Math.min(context.height, Number(targetPoint.y || 0)))
  };

  const group = document.createElementNS(COMBAT_FX_SVG_NS, "g");
  group.classList.add("combat-fx-shot", tone === "bot" ? "is-bot-return" : "is-player-fire");
  tagCombatFxElement(group, ref, { ...options, owner: options.owner || tone });
  group.dataset.sourceCount = String(sourcePoints.length);
  group.dataset.sourceX = String(Math.round(sourcePoints[0].x));
  group.dataset.sourceY = String(Math.round(sourcePoints[0].y));
  group.dataset.targetX = String(Math.round(target.x));
  group.dataset.targetY = String(Math.round(target.y));
  group.style.setProperty("--combat-fx-color", color);
  group.style.animationDuration = `${durationMs}ms`;

  sourcePoints.forEach((source, index) => {
    const glow = document.createElementNS(COMBAT_FX_SVG_NS, "line");
    glow.classList.add("combat-fx-beam-glow");
    const core = document.createElementNS(COMBAT_FX_SVG_NS, "line");
    core.classList.add("combat-fx-beam-core");
    [glow, core].forEach((line) => {
      line.dataset.beamIndex = String(index);
      line.setAttribute("x1", String(source.x));
      line.setAttribute("y1", String(source.y));
      line.setAttribute("x2", String(target.x));
      line.setAttribute("y2", String(target.y));
      line.setAttribute("stroke", color);
      line.setAttribute("vector-effect", "non-scaling-stroke");
      tagCombatFxElement(line, ref, { ...options, owner: options.owner || tone });
      group.appendChild(line);
    });
  });

  if (options.showImpact !== false) {
    const impact = document.createElementNS(COMBAT_FX_SVG_NS, "circle");
    impact.classList.add("combat-fx-impact", tone === "bot" ? "is-bot-return" : "is-player-fire");
    impact.setAttribute("cx", String(target.x));
    impact.setAttribute("cy", String(target.y));
    impact.setAttribute("r", "8");
    tagCombatFxElement(impact, ref, { ...options, owner: options.owner || tone });
    group.appendChild(impact);
  }

  context.layer.appendChild(group);
  setTimeout(() => group.remove(), durationMs + 80);
  return true;
}

function clearCombatVisualsForTarget(refOrType, targetId = "") {
  const ref = typeof refOrType === "object"
    ? { type: String(refOrType.type || ""), id: String(refOrType.id || refOrType.targetId || "") }
    : { type: String(refOrType || ""), id: String(targetId || "") };
  if (!ref.id) return false;
  markCombatVisualTargetSuppressed(ref);

  const selectors = [
    "#laserLayer [data-target-id]",
    "#explosionLayer [data-target-id]",
    "#lupenMultiplayerSpaceShotLayer [data-target-id]",
    `#${COMBAT_FX_LAYER_ID} [data-target-id]`
  ];
  let removed = 0;
  selectors.forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      const idMatches = String(element.dataset.targetId || "") === ref.id;
      const elementType = String(element.dataset.targetType || "");
      const typeMatches = !ref.type ||
        !elementType ||
        elementType === ref.type ||
        (ref.type === "stagingBot" && elementType === "bot") ||
        (ref.type === "stagingResource" && elementType === "resource") ||
        (ref.type === "remotePlayer" && (elementType === "player" || elementType === "pvp"));
      if (!idMatches || !typeMatches) return;
      element.remove();
      removed += 1;
    });
  });

  const shotLayer = document.getElementById("lupenMultiplayerSpaceShotLayer");
  if (shotLayer?.dataset.targetId === ref.id && (!ref.type || shotLayer.dataset.targetType === ref.type)) {
    shotLayer.remove();
    removed += 1;
  }

  return removed > 0;
}

function clearAllCombatVisuals() {
  renderedCombatFxKeys.clear();
  let removed = 0;
  [
    "#laserLayer .laser-burst",
    "#laserLayer .weapon-muzzle-flash",
    "#explosionLayer .weapon-impact",
    "#lupenMultiplayerSpaceShotLayer",
    `#${COMBAT_FX_LAYER_ID} .combat-fx-shot`,
    `#${COMBAT_FX_LAYER_ID} .combat-fx-impact`
  ].forEach((selector) => {
    document.querySelectorAll(selector).forEach((element) => {
      element.remove();
      removed += 1;
    });
  });
  return removed > 0;
}

function clearFirstSessionTransientState(reason = "first_session_cleanup", options = {}) {
  if (typeof engageTimer !== "undefined" && engageTimer) {
    clearInterval(engageTimer);
    engageTimer = null;
  }
  if (typeof targetCollapseTimer !== "undefined" && targetCollapseTimer) {
    clearTimeout(targetCollapseTimer);
    targetCollapseTimer = null;
  }

  selectedTarget = null;
  engagedTarget = null;
  serverPvpDamageDisplayState = null;
  lastPvpHullFeedbackState = "";
  lastRemotePlayerEngageNoticeKey = "";
  lastRemotePlayerEngageNoticeAt = 0;
  lastResourceCargoFullNoticeAt = 0;

  clearAllCombatVisuals();
  window.LupenMultiplayerOverlay?.setSelectedResourceId?.("");
  if (options.clearServerTarget !== false) {
    window.LupenMultiplayerClient?.clearStagingTarget?.();
  }

  if (options.update !== false) {
    if (typeof updateAsteroidUI === "function") updateAsteroidUI();
    if (typeof updateTargetPanel === "function") updateTargetPanel();
    if (typeof updateObjectActionPanel === "function") updateObjectActionPanel(false);
    window.LupenMultiplayerOverlay?.render?.();
  }

  return { ok: true, reason };
}

function getShotVisualProfile(shotWeapon = {}) {
  const style = String(shotWeapon.fireStyle || "pulse").toLowerCase();
  const color = shotWeapon.projectileColor || "#7fd6ff";
  const profile = {
    color,
    height: 4,
    durationMs: 185,
    streakScale: 1,
    offsetSpread: 5,
    glowScale: 1.32
  };

  if (style === "rapid") {
    Object.assign(profile, { height: 3, durationMs: 140, streakScale: 0.82, offsetSpread: 7, glowScale: 1.12 });
  } else if (style === "ion") {
    Object.assign(profile, { height: 4, durationMs: 160, streakScale: 0.94, offsetSpread: 6, glowScale: 1.42 });
  } else if (style === "melt") {
    Object.assign(profile, { height: 6, durationMs: 205, streakScale: 0.98, offsetSpread: 4, glowScale: 1.48 });
  } else if (style === "heavy") {
    Object.assign(profile, { height: 7, durationMs: 215, streakScale: 1.04, offsetSpread: 3, glowScale: 1.58 });
  } else if (style === "sniper") {
    Object.assign(profile, { height: 3, durationMs: 190, streakScale: 1.12, offsetSpread: 2, glowScale: 1.62 });
  } else if (style === "disruptor" || style === "ripper") {
    Object.assign(profile, { height: 5, durationMs: 180, streakScale: 0.92, offsetSpread: 8, glowScale: 1.44 });
  }

  return profile;
}

function showWeaponImpactAtTarget(target, shotWeapon, delay = 0, options = {}) {
  const profile = getShotVisualProfile(shotWeapon);
  const targetRef = getCombatVisualTargetRef(target, options);
  const point = getCombatFxPointFromTarget(target);
  if (!point) return false;

  setTimeout(() => {
    if (targetRef && !isCombatVisualTargetStillValid(targetRef)) return;
    renderCombatFxImpact(point, { ...options, targetRef, color: profile.color, durationMs: 360 });
  }, delay);

  return true;
}

function pulseLaserBurstToTarget(target, weapon = null, options = {}) {
  if (!target) return;

  const resolvedWeapon = weapon || (typeof getEquippedWeapon === "function" ? getEquippedWeapon() : null);
  const shotWeapon = Array.isArray(resolvedWeapon?.weapons) && resolvedWeapon.weapons.length
    ? resolvedWeapon.weapons[weaponVisualCycleOffset++ % resolvedWeapon.weapons.length]
    : resolvedWeapon;
  if (!shotWeapon) return;
  const targetRef = getCombatVisualTargetRef(target, options);
  if (targetRef && !isCombatVisualTargetStillValid(targetRef)) return;
  const profile = getShotVisualProfile(shotWeapon);
  const targetPoint = getCombatFxPointFromTarget(target);
  const sourcePoint = getLocalCombatFxOriginsForTarget(targetPoint, LOCAL_COMBAT_FX_BEAM_COUNT);
  renderCombatFxBeam(sourcePoint, targetPoint, {
    ...options,
    targetRef,
    owner: "local",
    tone: "player",
    color: profile.color || "#55e8ff",
    durationMs: COMBAT_FX_BEAM_DURATION_MS,
    showImpact: options.showImpact !== false
  });

  debugCombatShot("shot visuals", {
    activeWeaponCount: Number(resolvedWeapon?.count || (Array.isArray(resolvedWeapon?.weapons) ? resolvedWeapon.weapons.length : 1)),
    visibleWeaponCount: 1,
    weaponCountVisualsEnabled: false,
    weaponNames: [shotWeapon].map(item => item?.name || item?.key || "weapon").join(", "),
    cooldownMs: Number(resolvedWeapon?.speed || 0)
  });
}

let lastHostilePlayerHitFeedbackAt = 0;

function incomingLaserBurstFromBot(bot, delay = 0, options = {}) {
  if (!bot) return;
  const sourcePoint = getCombatFxPointFromTarget(bot);
  const context = ensureCombatFxLayer();
  if (!sourcePoint || !context) return;
  const targetRef = getCombatVisualTargetRef(bot, {
    targetType: options.targetType || (getStagingBotTargetById(bot.id) ? "stagingBot" : "hostileBot"),
    targetId: bot.id
  });
  const targetPoint = getLocalPlayerIncomingFireEndpoint();
  if (!targetPoint) return;

  const drawIncoming = () => {
    renderCombatFxBeam(sourcePoint, targetPoint, {
      ...options,
      targetRef,
      attackerId: bot.id,
      owner: "bot",
      tone: "bot",
      color: "#ff8756",
      durationMs: COMBAT_FX_BEAM_DURATION_MS,
      showImpact: false
    });
  };
  const delayMs = Math.max(0, Number(delay || 0));
  if (delayMs > 0) setTimeout(drawIncoming, delayMs);
  else drawIncoming();
}

function showIncomingHitFlash(options = {}) {
  const spaceScreen = document.getElementById("spaceScreen");
  const shipPanel = document.querySelector(".ship-display-panel");
  const statPanel = document.querySelector(".vertical-stats");
  const isHullHit = options.hullHit === true;
  const isArmorHit = options.armorHit === true;
  const impactClass = isHullHit ? "hull-impact" : isArmorHit ? "armor-impact" : "shield-impact";

  if (spaceScreen) {
    spaceScreen.classList.remove("shield-impact", "armor-impact", "hull-impact", "incoming-impact-shake");
    spaceScreen.classList.add("incoming-hit-flash", impactClass, "incoming-impact-shake");
    setTimeout(() => {
      spaceScreen.classList.remove("incoming-hit-flash", impactClass, "incoming-impact-shake");
    }, 320);
  }

  [shipPanel, statPanel].forEach(panel => {
    if (!panel) return;
    panel.classList.remove("shield-impact", "armor-impact", "hull-impact");
    panel.classList.add("hud-hit-flash", impactClass);
    setTimeout(() => panel.classList.remove("hud-hit-flash", impactClass), 320);
  });
}

function playHostilePlayerHitFeedback(options = {}) {
  const now = Date.now();
  if (now - lastHostilePlayerHitFeedbackAt < 180) return false;
  lastHostilePlayerHitFeedbackAt = now;

  const attackerBot = options.attackerBot || null;
  const shieldDamage = Math.max(0, Number(options.shieldDamage || 0));
  const armorDamage = Math.max(0, Number(options.armorDamage || 0));
  const hullDamage = Math.max(0, Number(options.hullDamage || 0));
  const hitDelay = 150;
  const streakCount = hullDamage > 0 ? 4 : 3;

  if (attackerBot) {
    incomingLaserBurstFromBot(attackerBot, 0, { count: streakCount });
    for (let index = 0; index < Math.min(streakCount, 3); index += 1) {
      setTimeout(() => {
        if (typeof playEnemyLaserPulse === "function") playEnemyLaserPulse();
      }, index * 58);
    }
  }

  setTimeout(() => {
    if (hullDamage > 0 && typeof playHullHitSound === "function") {
      playHullHitSound();
    } else if (armorDamage > 0 && typeof playShieldHitSound === "function") {
      playShieldHitSound();
    } else if (shieldDamage > 0 && typeof playShieldHitSound === "function") {
      playShieldHitSound();
    }
    showIncomingHitFlash({
      shieldHit: shieldDamage > 0,
      armorHit: armorDamage > 0,
      hullHit: hullDamage > 0
    });
  }, hitDelay);

  return true;
}


function showExplosionAtTarget(target) {
  const layer = document.getElementById("explosionLayer");
  const spaceScreen = document.getElementById("spaceScreen");

  if (!layer || !spaceScreen || !target) return;

  const screenRect = spaceScreen.getBoundingClientRect();
  const x = (target.x / 100) * screenRect.width;
  const y = (target.y / 100) * screenRect.height;

  const blast = document.createElement("div");
  blast.className = "space-explosion";
  blast.style.left = `${x}px`;
  blast.style.top = `${y}px`;
  layer.appendChild(blast);

  setTimeout(() => blast.remove(), 650);
}

function normalizeTargetCombatLayers(target) {
  if (!target) return target;

  Object.assign(target, LupenCombatRules.normalizeTargetCombatLayers(target, HOSTILE_BOT_BASE_HP));
  return target;
}

function syncTargetHpFromLayers(target) {
  if (!target) return;
  Object.assign(target, LupenCombatRules.syncTargetHpFromLayers(target));
  return target;
}

function applyWeaponDamageToTarget(target, weapon) {
  const resolved = LupenCombatRules.resolveWeaponDamageToTarget(target, weapon, Math.random() * 100, HOSTILE_BOT_BASE_HP);
  Object.assign(target, resolved.target);
  return resolved.result;
}

function isPlayerInSpaceView() {
  return Boolean(document.getElementById("spaceScreen")?.classList.contains("active"));
}

function isPlayerInNode(nodeId) {
  return isPlayerInSpaceView() && currentNode === nodeId;
}

function setErebusBotNode(bot, nodeId) {
  if (!bot || !nodeId) return;
  bot.currentNodeId = nodeId;
  bot.node = nodeId;
}

function triggerErebusAggro(attackedBotId, playerId = getPilotName()) {
  const attackedBot = getHostileBotById(attackedBotId);
  if (!attackedBot || attackedBot.faction !== "erebus") return;

  const now = Date.now();
  const nodeId = getCombatEntityNodeName(attackedBot);
  hostileBots
    .filter(bot => bot.faction === "erebus" && bot.aggroState !== "defeated" && getCombatEntityNodeName(bot) === nodeId)
    .forEach(bot => {
      bot.aggroState = "hostile";
      bot.aggroUntil = now + EREBUS_BOT_AGGRO_MS;
      bot.targetPlayerId = playerId;
    });
}

function updateErebusAggroStates() {
  const now = Date.now();
  hostileBots.forEach(bot => {
    if (bot.faction !== "erebus" || bot.aggroState !== "hostile") return;
    if (engagedTarget?.type === "hostileBot" && engagedTarget.id === bot.id && engageTimer) {
      bot.aggroUntil = now + EREBUS_BOT_AGGRO_MS;
      return;
    }
    if (bot.aggroUntil && now > Number(bot.aggroUntil)) {
      bot.aggroState = "neutral";
      bot.aggroUntil = null;
      bot.targetPlayerId = null;
    }
  });
}

function performAttackCycle() {
  const target = getEngagedTargetEntity();

  if (!target || !target.alive || !isCombatEntityInCurrentNode(target)) {
    disengageTarget(true);
    return;
  }

  const weapon = getEquippedWeapon();
  const result = applyWeaponDamageToTarget(target, weapon);
  pulseLaserBurstToTarget(target, weapon, {
    showImpact: result.hit === true,
    targetType: engagedTarget?.type || getTargetTypeFromEntity(target),
    targetId: target.id
  });
  const soundPulseCount = Math.max(1, Math.min(6, Number(weapon?.count || 1)));
  Array.from({ length: soundPulseCount }).forEach((_shotWeapon, index) => {
    setTimeout(() => {
      if (typeof playPlayerLaserPulse === "function") playPlayerLaserPulse();
    }, Math.min(index * 75, 375));
  });
  if (result.hit) {
    target.hitFlashUntil = Date.now() + 260;
  }
  if (result.hit && engagedTarget?.type === "hostileBot" && target.faction === "erebus") {
    triggerErebusAggro(target.id);
  }
  debugCombatShot("shot resolved", {
    activeWeaponCount: Number(weapon?.count || 0),
    firingWeaponName: weapon?.name || "Unarmed",
    cooldownMs: Number(weapon?.speed || 0),
    hit: result.hit === true,
    damageApplied: Math.round(Number(result.amount || 0)),
    visualShotEmitted: true
  });

  if (target.hp <= 0) {
    showExplosionAtTarget(target);
    if (typeof playEnemyShipDestroyedSound === "function") {
      setTimeout(playEnemyShipDestroyedSound, 140);
    }
    target.alive = false;
    const destroyedType = engagedTarget?.type;

    if (destroyedType === "hostileBot") {
      target.aggroState = "defeated";
      const itemDrops = generateBotLootItems();
      const inventoryResult = addInventoryItems(itemDrops);
      if (inventoryResult.added.length) {
        addHudToast(`${getPilotName()} destroyed ${target.name}. Loot secured: ${summarizeInventoryItems(inventoryResult.added)}.`);
      } else if (itemDrops.length) {
        addHudToast(`${getPilotName()} destroyed ${target.name}. ${INVENTORY_FULL_MESSAGE}`);
      } else {
        addHudToast(`${getPilotName()} destroyed ${target.name}. No equipment recovered.`);
      }
      trackBountyBotKill(target);
      tutorialEvent("destroyedBountyBot");
      awardCombatXpFromBot(target);
      scheduleHostileBotRespawn(target.id);
    } else {
      const drops = generateLootFromAsteroid(target);
      const cargoResult = depositLootToCargo(drops);
      const collectedSummary = summarizeLootMap(cargoResult.collected);
      const overflowSummary = summarizeLootMap(cargoResult.overflow);
      const overflowText = cargoResult.overflowAmount > 0 ? ` ${overflowSummary} left as salvage.` : "";
      const recoveredText = cargoResult.collectedAmount > 0 ? `Cargo recovered: ${collectedSummary}.` : "Cargo hold full.";
      addHudToast(`${getPilotName()} destroyed ${target.name}. ${recoveredText}${overflowText}`);
      awardAsteroidShardBonus(getAsteroidShardReward(target), target.name || "Asteroid");
      scheduleAsteroidRespawn();
    }

    disengageTarget(true);
    autoCollapseTargetPanel();
  } else if (result.hit && typeof playWeaponHitMarkerSound === "function") {
    setTimeout(playWeaponHitMarkerSound, 130);
  }

  updateAsteroidUI();
  updateTargetPanel();
  saveGame();
}

function asteroidVisibleInCurrentNode(asteroid) {
  return asteroid && asteroid.alive && asteroid.node === currentNode;
}

function ensureActiveAsteroids() {
  if (typeof shouldUseServerOwnedSectorObjects === "function" && shouldUseServerOwnedSectorObjects()) return;

  if (!Array.isArray(asteroids)) {
    asteroids = createInitialAsteroids();
    return;
  }

  if (asteroids.length < MAP_ONE_ASTEROID_COUNT) {
    asteroids = normalizeAsteroidCollection(asteroids);
  }

  if (!asteroids.some(asteroid => asteroid.alive)) {
    asteroids = createInitialAsteroids();
  }
}

function ensureActiveHostileBots() {
  if (!Array.isArray(hostileBots) || !hostileBots.length) {
    hostileBots = createInitialHostileBots();
  }
}


function clampTargetPosition(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function targetsTooClose(a, b) {
  return Math.abs(a.x - b.x) < 11 && Math.abs(a.y - b.y) < 15;
}

function findOpenTargetPosition(target, placedTargets) {
  const base = {
    x: clampTargetPosition(Number(target.x) || 50, 8, 92),
    y: clampTargetPosition(Number(target.y) || 30, 10, 64)
  };

  if (!placedTargets.some(other => targetsTooClose(base, other))) {
    return base;
  }

  const offsets = [
    { x: -14, y: 0 }, { x: 14, y: 0 },
    { x: 0, y: -16 }, { x: 0, y: 16 },
    { x: -14, y: -16 }, { x: 14, y: -16 },
    { x: -14, y: 16 }, { x: 14, y: 16 },
    { x: -24, y: -8 }, { x: 24, y: -8 },
    { x: -24, y: 8 }, { x: 24, y: 8 }
  ];

  for (const offset of offsets) {
    const candidate = {
      x: clampTargetPosition(base.x + offset.x, 8, 92),
      y: clampTargetPosition(base.y + offset.y, 10, 64)
    };

    if (!placedTargets.some(other => targetsTooClose(candidate, other))) {
      return candidate;
    }
  }

  const fallbackSlots = [
    { x: 14, y: 18 }, { x: 30, y: 18 }, { x: 46, y: 18 }, { x: 62, y: 18 }, { x: 78, y: 18 },
    { x: 20, y: 34 }, { x: 36, y: 34 }, { x: 52, y: 34 }, { x: 68, y: 34 }, { x: 84, y: 34 },
    { x: 14, y: 50 }, { x: 30, y: 50 }, { x: 46, y: 50 }, { x: 62, y: 50 }, { x: 78, y: 50 },
    { x: 24, y: 62 }, { x: 40, y: 62 }, { x: 56, y: 62 }, { x: 72, y: 62 }, { x: 88, y: 62 }
  ];

  return fallbackSlots.find(slot => !placedTargets.some(other => targetsTooClose(slot, other))) || base;
}

function separateVisibleTargets(targets) {
  const placedTargets = [];

  targets.forEach(target => {
    const position = findOpenTargetPosition(target, placedTargets);
    target.x = position.x;
    target.y = position.y;
    placedTargets.push(position);
  });
}

function renderTargetButton(target, options = {}) {
  const field = document.getElementById("asteroidField");
  if (!field) return;
  normalizeTargetCombatLayers(target);
  const targetType = options.targetType || (options.isHostileBot ? "hostileBot" : "asteroid");

  const btn = document.createElement("button");
  btn.className = `${options.className || "asteroid-target"} visible`;
  btn.dataset.targetType = targetType;
  btn.dataset.targetId = String(target.id || "");

  if (selectedTarget?.type === targetType && selectedTarget?.id === target.id) {
    btn.classList.add("selected", "is-selected");
  }

  if (engagedTarget?.type === targetType && engagedTarget?.id === target.id) {
    btn.classList.add("engaged");
  }

  if (options.isHostileBot) {
    btn.classList.add(...getBotDirectionClass(target).split(" "));
    btn.classList.add(`threat-${String(target.threat || "medium").toLowerCase()}`);
    if (target.aggroState === "hostile") btn.classList.add("is-hostile");
  }
  if (Number(target.hitFlashUntil || 0) > Date.now()) {
    btn.classList.add("weapon-hit-react");
  }

  btn.style.left = `${target.x}%`;
  btn.style.top = `${target.y}%`;
  btn.style.transform = "translate(-50%, -50%)";
  btn.onclick = options.onClick;
  btn.setAttribute("aria-label", target.name);
  if (target.resource) {
    btn.dataset.resource = target.resource;
    btn.style.setProperty("--asteroid-scale", Number(target.scale || 1));
  }

  const hpPct = Math.max(0, (target.hp / target.maxHp) * 100);
  const isSelectedBot = options.isHostileBot && selectedTarget?.type === "hostileBot" && selectedTarget?.id === target.id;
  const fallbackSrc = options.fallbackSrc || EREBUS_BOT_FALLBACK_ASSET;
  const label = isSelectedBot
    ? `<div class="sector-bot-label">
        <strong class="sector-bot-label-text">${escapeHtml(target.displayName || target.name || "Erebus Bot").toUpperCase()}</strong>
      </div>`
    : "";

  btn.innerHTML = `
    <img src="${options.imageSrc}" alt="${target.name}" onerror="this.onerror=null;this.src='${fallbackSrc}'">
    ${label}
    <div class="asteroid-hp-mini"><span style="width:${hpPct}%"></span></div>
  `;

  field.appendChild(btn);
}

function updateAsteroidUI() {
  const serverOwnedSectorObjectsActive = typeof shouldUseServerOwnedSectorObjects === "function" && shouldUseServerOwnedSectorObjects();
  const localBotVisualGuardActive = typeof isStagingLocalCombatBotVisualGuardActive === "function" && isStagingLocalCombatBotVisualGuardActive();

  if (!serverOwnedSectorObjectsActive) ensureActiveAsteroids();
  if (!localBotVisualGuardActive) ensureActiveHostileBots();

  if (localBotVisualGuardActive) {
    clearLocalHostileBotSelectionForStaging();
  }
  if (serverOwnedSectorObjectsActive) {
    clearLocalAsteroidSelectionForStaging();
  }

  const field = document.getElementById("asteroidField");
  if (!field) return;

  field.innerHTML = "";

  const visibleBots = typeof getVisibleHostileBotsForLocalTargetUi === "function"
    ? getVisibleHostileBotsForLocalTargetUi()
    : hostileBots.filter(bot => bot.alive && isCombatEntityInCurrentNode(bot));
  const visibleAsteroids = typeof getVisibleAsteroidsForLocalTargetUi === "function"
    ? getVisibleAsteroidsForLocalTargetUi()
    : asteroids.filter(asteroid => asteroid.alive && asteroid.node === currentNode);
  const visibleStagingResources = typeof getVisibleStagingResourceTargets === "function"
    ? getVisibleStagingResourceTargets()
    : [];

  separateVisibleTargets([...visibleBots, ...visibleAsteroids, ...visibleStagingResources]);

  visibleBots.forEach(bot => {
    renderTargetButton(bot, {
      className: "asteroid-target enemy-bot-target",
      imageSrc: bot.image || EREBUS_BOT_FALLBACK_ASSET,
      isHostileBot: true,
      onClick: () => selectHostileBot(bot.id)
    });
  });

  visibleAsteroids.forEach(asteroid => {
    renderTargetButton(asteroid, {
      className: `asteroid-target resource-asteroid-target asteroid-${getAsteroidResourceSlug(asteroid.resource)}`,
      imageSrc: asteroid.image || getAsteroidImage(asteroid.resource),
      fallbackSrc: getCommodityImage(asteroid.resource),
      onClick: () => selectAsteroid(asteroid.id)
    });
  });

  visibleStagingResources.forEach(resource => {
    const resourceName = resource.resourceName || resource.resource || "Iron";
    renderTargetButton(resource, {
      targetType: "stagingResource",
      className: `asteroid-target resource-asteroid-target server-resource-asteroid asteroid-${getAsteroidResourceSlug(resourceName)}`,
      imageSrc: resource.image || getAsteroidImage(resourceName),
      fallbackSrc: getCommodityImage(resourceName),
      onClick: () => selectStagingResourceTarget(resource.id)
    });
  });
}

function clearLocalAsteroidSelectionForStaging() {
  if (selectedTarget?.type === "asteroid") selectedTarget = null;
  if (engagedTarget?.type !== "asteroid") return;

  engagedTarget = null;
  if (engageTimer) {
    clearInterval(engageTimer);
    engageTimer = null;
  }
}

function clearLocalHostileBotSelectionForStaging() {
  // ?mp=staging shows server-owned Colyseus bot placeholders only. Local real
  // combat bots stay in the single-player state but are not selectable,
  // targetable, or engaged during staging presence tests.
  if (selectedTarget?.type === "hostileBot") selectedTarget = null;
  if (engagedTarget?.type !== "hostileBot") return;

  engagedTarget = null;
  if (engageTimer) {
    clearInterval(engageTimer);
    engageTimer = null;
  }
}

function clearStagingBotTargetIfSelected(botId) {
  if (!botId) return;
  const selectedMatches = selectedTarget?.type === "stagingBot" && selectedTarget.id === botId;
  const engagedMatches = engagedTarget?.type === "stagingBot" && engagedTarget.id === botId;
  clearCombatVisualsForTarget({ type: "stagingBot", id: botId });
  if (!selectedMatches && !engagedMatches) return;

  if (engagedMatches && engageTimer) {
    clearInterval(engageTimer);
    engageTimer = null;
  }
  if (engagedMatches) engagedTarget = null;
  if (selectedMatches) selectedTarget = null;
  window.LupenMultiplayerClient?.clearStagingTarget?.();
  updateAsteroidUI();
  updateTargetPanel();
  updateObjectActionPanel(false);
  window.LupenMultiplayerOverlay?.render?.();
}

function isStagingBotTargetStillValid(botId) {
  const bot = getStagingBotTargetById(botId);
  return Boolean(bot && bot.alive && isCombatEntityMissingOrInCurrentNode(bot));
}

function clearStaleStagingBotTarget(reason = "stale_staging_bot_target") {
  const selectedStale = selectedTarget?.type === "stagingBot" && !isStagingBotTargetStillValid(selectedTarget.id);
  const engagedStale = engagedTarget?.type === "stagingBot" && !isStagingBotTargetStillValid(engagedTarget.id);

  if (!selectedStale && !engagedStale) return false;

  if (selectedStale) clearCombatVisualsForTarget({ type: "stagingBot", id: selectedTarget.id });
  if (engagedStale) clearCombatVisualsForTarget({ type: "stagingBot", id: engagedTarget.id });

  if (engagedStale && engageTimer) {
    clearInterval(engageTimer);
    engageTimer = null;
  }
  if (engagedStale) engagedTarget = null;
  if (selectedStale) selectedTarget = null;
  window.LupenMultiplayerClient?.clearStagingTarget?.();
  updateAsteroidUI();
  updateTargetPanel();
  updateObjectActionPanel(false);
  window.LupenMultiplayerOverlay?.render?.();
  return { cleared: true, reason };
}

function reconcileStagingBotTargetState(reason = "reconcile_staging_bot_target") {
  const botResult = clearStaleStagingBotTarget(reason);
  const targetResult = reconcileTargetSessionState(reason);
  return botResult || (targetResult?.cleared ? targetResult : false);
}

function reconcileServerOwnedSectorObjectMode(reason = "reconcile_server_owned_sector_objects") {
  const serverOwnedActive = typeof shouldUseServerOwnedSectorObjects === "function" && shouldUseServerOwnedSectorObjects();
  if (!serverOwnedActive) return { reconciled: false, reason, serverOwnedActive };

  clearLocalHostileBotSelectionForStaging();
  clearLocalAsteroidSelectionForStaging();
  updateAsteroidUI();
  updateTargetPanel();
  updateObjectActionPanel(false);
  window.LupenMultiplayerOverlay?.render?.();
  return { reconciled: true, reason, serverOwnedActive };
}

function handleStagingBotLifecycleEvent(event = {}) {
  const botId = String(event.botId || event.id || event.targetBotId || "").trim();
  if (!botId) return { handled: false, reason: "missing_bot_id" };

  const eventType = String(event.type || "").toLowerCase();
  const disabled = event.disabled === true || eventType.includes("disabled");
  const respawned = eventType.includes("respawned") || event.disabled === false;
  const target = getStagingBotTargetById(botId);

  if (disabled) {
    clearCombatVisualsForTarget({ type: "stagingBot", id: botId });
    if (!window.lupenStagingBotDestructionVisualKeys) {
      window.lupenStagingBotDestructionVisualKeys = new Set();
    }

    const destructionKey = String(
      event.destructionInstanceId ||
      event.rewardPreviewId ||
      event.botXpSourceEventId ||
      event.disabledUntil ||
      botId
    );
    const alreadyVisualized = window.lupenStagingBotDestructionVisualKeys.has(destructionKey);
    window.lupenStagingBotDestructionVisualKeys.add(destructionKey);

    if (target && !alreadyVisualized) {
      showExplosionAtTarget(target);
      if (typeof playEnemyShipDestroyedSound === "function") {
        setTimeout(playEnemyShipDestroyedSound, 140);
      }
    }

    clearStagingBotTargetIfSelected(botId);
    updateAsteroidUI();
    updateTargetPanel();
    updateObjectActionPanel(false);
    window.LupenMultiplayerOverlay?.render?.();

    return { handled: true, reason: "bot_disabled", botId };
  }

  if (respawned) {
    updateAsteroidUI();
    updateTargetPanel();
    window.LupenMultiplayerOverlay?.render?.();
    return { handled: true, reason: "bot_respawned", botId };
  }

  return { handled: false, reason: "ignored_bot_event", botId };
}

window.clearStagingBotTargetIfSelected = clearStagingBotTargetIfSelected;
window.clearCombatVisualsForTarget = clearCombatVisualsForTarget;
window.clearAllCombatVisuals = clearAllCombatVisuals;
window.reconcileTargetSessionState = reconcileTargetSessionState;
window.renderCombatFxBeam = renderCombatFxBeam;
window.renderCombatFxImpact = renderCombatFxImpact;
window.getCombatFxPointFromPercent = getCombatFxPointFromPercent;
window.getLocalPlayerIncomingFireEndpoint = getLocalPlayerIncomingFireEndpoint;
window.getLocalCombatFxOriginForTarget = getLocalCombatFxOriginForTarget;
window.getLocalCombatFxOriginsForTarget = getLocalCombatFxOriginsForTarget;
window.clearRemotePlayerTarget = clearRemotePlayerTarget;
window.applyServerPvpDamageState = applyServerPvpDamageState;
window.applyServerPvpDestructionState = applyServerPvpDestructionState;
window.handleStagingBotLifecycleEvent = handleStagingBotLifecycleEvent;
window.reconcileStagingBotTargetState = reconcileStagingBotTargetState;
window.reconcileServerOwnedSectorObjectMode = reconcileServerOwnedSectorObjectMode;
window.clearFirstSessionTransientState = clearFirstSessionTransientState;

function updateTargetPanel() {
  const lootSummary = document.getElementById("lootSummary");
  const collectBtn = document.getElementById("collectBtn");

  const loot = lootByNode[currentNode];
  const hasLoot = loot && Object.values(loot).some(amount => amount > 0);

  if (lootSummary) {
    if (hasLoot) {
      lootSummary.innerHTML = Object.entries(loot)
        .filter(([, amount]) => amount > 0)
        .map(([mineral, amount]) => `
          <button class="salvage-compact-card" onclick="collectLoot('${escapeJsString(mineral)}')" title="Collect ${formatNumber(amount)} ${mineral}">
            <img src="${getCommodityImage(mineral)}" alt="${mineral}">
            <strong>${getCompactMineralLabel(mineral)}</strong>
            <span>${formatNumber(amount)}</span>
          </button>
        `)
        .join("");
    } else {
      lootSummary.innerHTML = `<div class="salvage-empty">No salvage ready.</div>`;
    }
  }

  if (collectBtn) {
    collectBtn.disabled = !hasLoot;
  }

  updateObjectActionPanel();
  updateHudDock();
}

function generateLootFromAsteroid(asteroidOrNode) {
  if (asteroidOrNode && typeof asteroidOrNode === "object") {
    const resource = ASTEROID_RESOURCE_TYPES[asteroidOrNode.resource] ? asteroidOrNode.resource : "Iron";
    const min = Math.max(1, Math.round(Number(asteroidOrNode.dropMin || getAsteroidResourceDefinition(resource).dropMin || 1)));
    const max = Math.max(min, Math.round(Number(asteroidOrNode.dropMax || getAsteroidResourceDefinition(resource).dropMax || min)));
    return {
      [resource]: Math.floor(Math.random() * (max - min + 1)) + min
    };
  }

  const nodeName = asteroidOrNode;
  const fallbackMineral = nodeMineralPools[nodeName]?.[0] || "Iron";
  const definition = getAsteroidResourceDefinition(fallbackMineral);
  const min = Math.max(1, Number(definition.dropMin || 1));
  const max = Math.max(min, Number(definition.dropMax || min));

  return {
    [fallbackMineral]: Math.floor(Math.random() * (max - min + 1)) + min
  };
}

function getAsteroidShardReward(asteroidOrResource) {
  const forced = window.__forceAsteroidShardReward;
  if (forced === false) return 0;
  if (forced === true) return 1;
  if (Number.isFinite(Number(forced))) return Math.max(0, Math.floor(Number(forced)));

  const resourceName = typeof asteroidOrResource === "string"
    ? asteroidOrResource
    : String(asteroidOrResource?.resource || asteroidOrResource?.resourceName || "");
  const crystalBonus = resourceName === "Crystal Shards";
  const chance = crystalBonus ? 0.35 : 0.18;
  if (Math.random() >= chance) return 0;
  return crystalBonus && Math.random() < 0.35 ? 2 : 1;
}

function awardAsteroidShardBonus(quantity = 0, sourceLabel = "Asteroid") {
  const shardDelta = Math.max(0, Math.floor(Number(quantity || 0)));
  if (shardDelta <= 0) return 0;
  upgradeMaterials = normalizeUpgradeMaterials(upgradeMaterials);
  upgradeMaterials.lupenShards = Math.max(0, Number(upgradeMaterials.lupenShards || 0)) + shardDelta;
  const shardLabel = shardDelta === 1 ? "Lupen Shard" : "Lupen Shards";
  const message = `${sourceLabel} yielded +${formatNumber(shardDelta)} ${shardLabel}.`;
  if (typeof addActivityLog === "function") addActivityLog(message);
  if (typeof addHudToast === "function") addHudToast(message);
  if (typeof showGameRewardBurst === "function") {
    showGameRewardBurst({
      type: "material",
      kicker: "Rare Find",
      title: `+${formatNumber(shardDelta)} ${shardLabel}`,
      meta: sourceLabel,
      image: "assets/items/lupen-shard.png"
    });
  }
  return shardDelta;
}

function summarizeLootMap(lootMap) {
  const entries = Object.entries(lootMap || {}).filter(([, amount]) => amount > 0);
  if (!entries.length) return "salvage";
  return entries.map(([mineral, amount]) => `${formatNumber(amount)} ${mineral}`).join(", ");
}

function getCompactMineralLabel(mineral) {
  const labels = {
    "Crystal Shards": "Crystal",
    "Xenon Gas": "Xenon",
    "Dark Matter Residue": "Dark",
    "Iron": "Iron",
    "Copper": "Copper",
    "Cobalt": "Cobalt",
    "Titanium": "Titanium",
    "Iridium": "Iridium",
    "Platinum": "Platinum",
    "Uranium": "Uranium"
  };

  return labels[mineral] || mineral;
}


function addLootToNode(nodeName, drops) {
  if (!nodeName || !drops) return "salvage";

  if (!lootByNode[nodeName]) {
    lootByNode[nodeName] = {};
  }

  Object.entries(drops).forEach(([mineral, amount]) => {
    if (!amount || amount <= 0) return;
    lootByNode[nodeName][mineral] = (lootByNode[nodeName][mineral] || 0) + amount;
  });

  updateTargetPanel();
  return summarizeLootMap(drops);
}

function depositLootToCargo(drops) {
  const collected = {};
  const overflow = {};
  let availableSpace = Math.max(0, getShipStats().cargo - cargoUsed());
  let collectedAmount = 0;
  let overflowAmount = 0;

  Object.entries(drops || {}).forEach(([mineral, amount]) => {
    const quantity = Math.max(0, Math.round(Number(amount || 0)));
    if (!quantity || !mineralKeys.includes(mineral)) return;

    const collectedQuantity = Math.min(quantity, availableSpace);
    const overflowQuantity = quantity - collectedQuantity;

    if (collectedQuantity > 0) {
      cargo[mineral] += collectedQuantity;
      if (typeof addRecoveredCargoQuantity === "function") addRecoveredCargoQuantity(mineral, collectedQuantity);
      collected[mineral] = (collected[mineral] || 0) + collectedQuantity;
      collectedAmount += collectedQuantity;
      availableSpace -= collectedQuantity;
      if (typeof recordMissionEvent === "function") {
        recordMissionEvent("recover_resource", { resource: mineral, amount: collectedQuantity });
      }
    }

    if (overflowQuantity > 0) {
      overflow[mineral] = (overflow[mineral] || 0) + overflowQuantity;
      overflowAmount += overflowQuantity;
    }
  });

  if (overflowAmount > 0) {
    addLootToNode(currentNode, overflow);
  }

  updateCargoSummary();
  return { collected, overflow, collectedAmount, overflowAmount };
}

function applyStagingResourceMineResult(result = {}) {
  const resourceName = String(result.resourceName || "").trim();
  const cargoDelta = Math.max(0, Math.round(Number(result.cargoDelta || 0)));
  if (!result || result.ok !== true || cargoDelta <= 0 || !mineralKeys.includes(resourceName)) {
    return { applied: false, reason: "invalid_resource_award", collectedAmount: 0, overflowAmount: 0 };
  }

  if (!window.lupenStagingResourceAwardedKeys) {
    window.lupenStagingResourceAwardedKeys = new Set();
  }

  const awardKey = String(
    result.resourceRewardId ||
    result.depletionInstanceId ||
    `${result.resourceId || resourceName}:${result.depletedUntil || result.receivedAt || Date.now()}:${cargoDelta}`
  );

  if (window.lupenStagingResourceAwardedKeys.has(awardKey)) {
    return { applied: false, reason: "duplicate_resource_award", collectedAmount: 0, overflowAmount: 0, awardKey };
  }

  window.lupenStagingResourceAwardedKeys.add(awardKey);
  const cargoUsedBefore = cargoUsed();
  const cargoCapacity = getShipStats().cargo;
  if (cargoCapacity > 0 && cargoUsedBefore >= cargoCapacity) {
    const message = "Cargo hold full - no resource recovered.";
    if (typeof addHudToast === "function") addHudToast(message);
    else if (typeof addActivityLog === "function") addActivityLog(message);
    updateCargoSummary();
    updateTargetPanel();
    saveGame();
    return {
      applied: false,
      reason: "cargo_full_no_resource_recovered",
      resourceName,
      cargoDelta,
      collectedAmount: 0,
      overflowAmount: 0,
      cargoUsedBefore,
      cargoUsedAfter: cargoUsedBefore,
      cargoCapacity,
      awardKey
    };
  }
  const deposit = depositLootToCargo({ [resourceName]: cargoDelta });
  const collectedAmount = Math.max(0, Number(deposit.collectedAmount || 0));
  const overflowAmount = Math.max(0, Number(deposit.overflowAmount || 0));
  const cargoUsedAfter = cargoUsed();
  const shardDelta = Math.max(0, Math.round(Number(result.lupenShardDelta || result.shardDelta || 0)));
  const appliedShardDelta = awardAsteroidShardBonus(shardDelta, `${resourceName} asteroid`);
  const collectedText = collectedAmount > 0
    ? `Recovered ${formatNumber(collectedAmount)} ${resourceName}. Cargo ${formatNumber(cargoUsedAfter)}/${formatNumber(cargoCapacity)}.`
    : "cargo full";
  const overflowText = overflowAmount > 0
    ? ` ${formatNumber(overflowAmount)} left as salvage.`
    : "";
  const message = `${resourceName} asteroid depleted. ${collectedText}${overflowText}`;

  if (typeof addActivityLog === "function") addActivityLog(message);
  if (typeof addHudToast === "function") addHudToast(message);
  if (collectedAmount > 0) {
    const rewardPayload = {
      type: "resource",
      kicker: "Resource Recovered",
      title: `+${formatNumber(collectedAmount)} ${resourceName}`,
      meta: `Cargo ${formatNumber(cargoUsedAfter)}/${formatNumber(cargoCapacity)}`,
      image: typeof getCommodityImage === "function" ? getCommodityImage(resourceName) : ""
    };
    if (typeof showGameRewardBurst === "function") {
      showGameRewardBurst(rewardPayload);
    } else if (typeof showTradeResultBurst === "function") {
      showTradeResultBurst({
        good: resourceName,
        quantity: collectedAmount,
        revenue: 0,
        profit: 0,
        valueMode: true,
        title: "Resource Recovered",
        detail: rewardPayload.meta
      });
    }
  }
  updateTargetPanel();
  saveGame();

  return {
    applied: collectedAmount > 0 || overflowAmount > 0,
    reason: "staging_resource_award_applied",
    resourceName,
    cargoDelta,
    collectedAmount,
    overflowAmount,
    lupenShardDelta: appliedShardDelta,
    cargoUsedBefore,
    cargoUsedAfter,
    cargoCapacity,
    awardKey
  };
}

window.applyStagingResourceMineResult = applyStagingResourceMineResult;

function handleStagingResourceLifecycleEvent(event = {}) {
  const resourceId = String(event.resourceId || event.id || "").trim();
  if (!resourceId) return { handled: false, reason: "missing_resource_id" };

  const target = getStagingResourceTargetById(resourceId);
  const eventType = String(event.type || "").toLowerCase();
  const depleted = event.depleted === true || eventType.includes("depleted");
  const respawned = eventType.includes("respawned") || event.depleted === false;

  if (depleted) {
    clearCombatVisualsForTarget({ type: "stagingResource", id: resourceId });
    if (!window.lupenStagingResourceDepletionVisualKeys) {
      window.lupenStagingResourceDepletionVisualKeys = new Set();
    }
    const depletionKey = String(event.resourceRewardId || event.depletionInstanceId || event.depletedUntil || resourceId);
    const alreadyVisualized = window.lupenStagingResourceDepletionVisualKeys.has(depletionKey);
    window.lupenStagingResourceDepletionVisualKeys.add(depletionKey);

    if (target && !alreadyVisualized) {
      showExplosionAtTarget(target);
      if (typeof playEnemyShipDestroyedSound === "function") {
        setTimeout(playEnemyShipDestroyedSound, 140);
      }
    }

    const selectedMatches = selectedTarget?.type === "stagingResource" && selectedTarget.id === resourceId;
    const engagedMatches = engagedTarget?.type === "stagingResource" && engagedTarget.id === resourceId;

    if (engagedMatches) {
      disengageTarget(false);
    } else if (selectedMatches) {
      selectedTarget = null;
    }

    updateAsteroidUI();
    updateTargetPanel();
    updateObjectActionPanel(false);
    return { handled: true, reason: "resource_depleted", resourceId };
  }

  if (respawned) {
    updateAsteroidUI();
    updateTargetPanel();
    return { handled: true, reason: "resource_respawned", resourceId };
  }

  return { handled: false, reason: "ignored_resource_event", resourceId };
}

window.handleStagingResourceLifecycleEvent = handleStagingResourceLifecycleEvent;

function collectLoot(mineralToCollect = null) {
  const loot = lootByNode[currentNode];
  if (!loot) return;

  let availableSpace = getShipStats().cargo - cargoUsed();
  if (availableSpace <= 0) {
    alert("Cargo hold is full.");
    return;
  }

  const collectedLoot = {};
  const mineralsToCheck = mineralToCollect ? [mineralToCollect] : mineralKeys;

  mineralsToCheck.forEach(mineral => {
    const amount = loot[mineral] || 0;
    if (amount <= 0 || availableSpace <= 0) return;

    const collected = Math.min(amount, availableSpace);
    cargo[mineral] += collected;
    loot[mineral] -= collected;
    availableSpace -= collected;

    if (collected > 0) {
      collectedLoot[mineral] = (collectedLoot[mineral] || 0) + collected;
      if (typeof recordMissionEvent === "function") {
        recordMissionEvent("recover_resource", { resource: mineral, amount: collected });
      }
    }
  });

  const hasCollected = Object.values(collectedLoot).some(amount => amount > 0);
  if (!hasCollected) return;

  const hasRemainingLoot = Object.values(loot).some(amount => amount > 0);
  if (!hasRemainingLoot) {
    delete lootByNode[currentNode];
  }

  addHudToast(`Salvage collected: ${summarizeLootMap(collectedLoot)}.`);
  updateCargoSummary();
  updateTargetPanel();
  saveGame();
}

function jettisonCargo(mineral, amount = "all") {
  if (!mineralKeys.includes(mineral)) return;
  const held = cargo[mineral] || 0;
  if (held <= 0) return;

  const quantity = amount === "all" ? held : Math.min(Number(amount) || 0, held);
  if (quantity <= 0) return;

  cargo[mineral] = Math.max(0, held - quantity);

  addActivityLog(`${getPilotName()} jettisoned ${formatNumber(quantity)} ${mineral}.`);
  updateCargoSummary();
  updateTargetPanel();
  saveGame();
}


function updateCargoSummary() {
  updateHudDock();
}

function scheduleAsteroidRespawn() {
  if (typeof shouldUseServerOwnedSectorObjects === "function" && shouldUseServerOwnedSectorObjects()) return;

  setTimeout(() => {
    if (typeof shouldUseServerOwnedSectorObjects === "function" && shouldUseServerOwnedSectorObjects()) return;
    respawnAsteroid();
    saveGame();
  }, ASTEROID_RESPAWN_MS);
}

function scheduleHostileBotRespawn(botId) {
  if (typeof isStagingLocalCombatBotVisualGuardActive === "function" && isStagingLocalCombatBotVisualGuardActive()) return;

  setTimeout(() => {
    if (typeof isStagingLocalCombatBotVisualGuardActive === "function" && isStagingLocalCombatBotVisualGuardActive()) return;
    respawnHostileBot(botId);
    saveGame();
  }, HOSTILE_BOT_RESPAWN_MS);
}

function respawnAsteroid() {
  if (typeof shouldUseServerOwnedSectorObjects === "function" && shouldUseServerOwnedSectorObjects()) return;

  const deadAsteroids = asteroids.filter(asteroid => !asteroid.alive);
  const asteroid = deadAsteroids[0];

  if (!asteroid) return;

  const spaceNodes = getLowerCombatAsteroidNodeIds();
  const asteroidIndex = Math.max(0, asteroids.indexOf(asteroid));
  const node = spaceNodes[Math.floor(Math.random() * spaceNodes.length)] || createMapOneAsteroid(asteroidIndex).node;
  const refreshed = createAsteroid(asteroid.resource || MAP_ONE_ASTEROID_SPAWN_PLAN[asteroidIndex] || "Iron", node, asteroidIndex);
  Object.assign(asteroid, refreshed, { id: asteroid.id || refreshed.id });

  updateAsteroidUI();
  updateTargetPanel();
}

function performStagingBotAttackCycle() {
  const target = getEngagedTargetEntity();
  if (!target || !target.alive || !isCombatEntityInCurrentNode(target)) {
    reconcileStagingBotTargetState("staging_bot_attack_target_invalid");
    return;
  }

  const client = window.LupenMultiplayerClient;
  const status = client?.getStatus?.();
  if (!status?.enabled || !status?.isConnected) return;

  client.sendSelectedStagingBotCombatIntent?.({
    targetBotId: target.id,
    currentNode,
    timestamp: Date.now()
  });
}

function performStagingResourceAttackCycle() {
  const target = getEngagedTargetEntity();
  if (!target || !target.alive || !isCombatEntityInCurrentNode(target)) {
    disengageTarget(true);
    updateObjectActionPanel(true);
    return;
  }

  const client = window.LupenMultiplayerClient;
  const status = client?.getStatus?.();
  if (!status?.enabled || !status?.isConnected) return;

  const result = client.mineStagingResource?.(target.id, { currentNode, timestamp: Date.now() });
  if (result?.ok === false) {
    if (typeof addActivityLog === "function") {
      addActivityLog(`Unable to engage ${target.resourceName || "resource"} asteroid: ${String(result.reason || "server unavailable").replace(/_/g, " ")}.`);
    }
    disengageTarget(true);
    updateObjectActionPanel(true);
    return;
  }

  const weapon = typeof getEquippedWeapon === "function" ? getEquippedWeapon() : null;
  pulseLaserBurstToTarget(target, weapon, {
    showImpact: true,
    targetType: "stagingResource",
    targetId: target.id
  });
  const soundPulseCount = Math.max(1, Math.min(6, Number(weapon?.count || 1)));
  Array.from({ length: soundPulseCount }).forEach((_shotWeapon, index) => {
    setTimeout(() => {
      if (typeof playPlayerLaserPulse === "function") playPlayerLaserPulse();
    }, Math.min(index * 75, 375));
  });

  const cargoCapacity = typeof getShipStats === "function" ? Number(getShipStats()?.cargo || 0) : 0;
  const usedCargo = typeof cargoUsed === "function" ? Number(cargoUsed() || 0) : 0;
  if (cargoCapacity > 0 && usedCargo >= cargoCapacity && Date.now() - lastResourceCargoFullNoticeAt > 2400) {
    lastResourceCargoFullNoticeAt = Date.now();
    if (typeof addActivityLog === "function") {
      addActivityLog("Cargo hold full - no resource recovered.");
    }
  }
}

function respawnHostileBot(botId) {
  if (typeof isStagingLocalCombatBotVisualGuardActive === "function" && isStagingLocalCombatBotVisualGuardActive()) return;

  ensureActiveHostileBots();

  const bot = hostileBots.find(item => item.id === botId) || hostileBots.find(item => !item.alive);
  if (!bot) return;

  const spaceNodes = getAllowedErebusBotNodeIds();
  const botClass = EREBUS_BOT_TYPES[bot.botType] || EREBUS_BOT_TYPES.erebus_attacker;
  const shield = Number(botClass.shield || HOSTILE_BOT_BASE_SHIELD);
  const hullValue = Number(botClass.hull || HOSTILE_BOT_BASE_HP);
  setErebusBotNode(bot, spaceNodes[Math.floor(Math.random() * spaceNodes.length)] || currentNode);
  bot.name = botClass.displayName || bot.name || "Erebus Bot";
  bot.displayName = botClass.displayName || bot.name;
  bot.className = botClass.className || bot.className;
  bot.shield = shield;
  bot.shieldMax = shield;
  bot.maxShield = shield;
  bot.armor = Number(botClass.armor || HOSTILE_BOT_BASE_ARMOR);
  bot.hull = hullValue;
  bot.hullMax = hullValue;
  bot.maxHull = hullValue;
  bot.maxHp = bot.shieldMax + bot.hullMax;
  bot.hp = bot.maxHp;
  bot.alive = true;
  bot.x = Math.floor(Math.random() * 52) + 34;
  bot.y = Math.floor(Math.random() * 34) + 18;
  bot.damage = Number(botClass.damage || HOSTILE_BOT_DAMAGE);
  bot.fireRateMs = Number(botClass.fireRateMs || HOSTILE_BOT_ATTACK_MS);
  bot.accuracy = Number(botClass.accuracy || 1);
  bot.classRole = botClass.role || bot.classRole;
  bot.threat = botClass.threat || bot.threat;
  bot.xpReward = Number(botClass.xpReward || bot.xpReward || XP_CONFIG.combatBotXp);
  bot.creditReward = Number(botClass.creditReward || bot.creditReward || 0);
  bot.moveIntervalMs = Number(botClass.moveIntervalMs || bot.moveIntervalMs || HOSTILE_BOT_MOVE_MS);
  bot.lastMovedAt = Date.now();
  bot.faction = "erebus";
  bot.allegiance = "hostile_neutral";
  bot.aggroState = "neutral";
  bot.aggroUntil = null;
  bot.targetPlayerId = null;
  bot.image = getErebusBotImagePath(botClass.image);

  updateAsteroidUI();
  updateTargetPanel();
}

function getAllowedErebusBotMoves(bot) {
  const currentNodeId = getCombatEntityNodeName(bot);
  const current = getNodeById(currentNodeId);
  if (!current) return [];
  const connectedNodeIds = current.connections || current.connectedNodes || current.connects || [];
  return connectedNodeIds.filter(nodeId => isAllowedErebusBotNode(nodeId));
}

function moveHostileBotsBetweenNodes() {
  if (typeof isStagingLocalCombatBotVisualGuardActive === "function" && isStagingLocalCombatBotVisualGuardActive()) return;

  ensureActiveHostileBots();
  updateErebusAggroStates();
  const now = Date.now();

  hostileBots.forEach(bot => {
    if (!bot.alive) return;
    if (bot.faction === "erebus" && bot.aggroState === "defeated") return;

    const botNode = getCombatEntityNodeName(bot);
    if (bot.faction === "erebus" && bot.aggroState === "hostile" && isPlayerInNode(botNode)) return;
    if (now - Number(bot.lastMovedAt || 0) < Number(bot.moveIntervalMs || HOSTILE_BOT_MOVE_MS)) return;

    const options = bot.faction === "erebus"
      ? getAllowedErebusBotMoves(bot)
      : (sectorNodes[botNode]?.connects || []).filter(name => sectorNodes[name]?.type === "space" && sectorNodes[name]?.danger === "hostile");

    if (!options.length) return;

    const botIsEngaged = engagedTarget?.type === "hostileBot" && engagedTarget.id === bot.id && engageTimer;
    if (botIsEngaged && botNode === currentNode) return;

    const nextNode = options[Math.floor(Math.random() * options.length)];
    if (bot.faction === "erebus" && (!isAllowedErebusBotNode(nextNode) || isPlanetNode(nextNode))) return;
    setErebusBotNode(bot, nextNode);
    bot.lastMovedAt = now;
    bot.x = Math.floor(Math.random() * 52) + 34;
    bot.y = Math.floor(Math.random() * 34) + 18;

    if (engagedTarget?.type === "hostileBot" && engagedTarget.id === bot.id && !isCombatEntityInCurrentNode(bot)) {
      disengageTarget(true);
      autoCollapseTargetPanel(1200);
    }
  });

  updateAsteroidUI();
  updateObjectActionPanel();
  saveGame();
}

function startHostileBotMovement() {
  if (botMovementTimer) return;
  if (typeof isStagingLocalCombatBotVisualGuardActive === "function" && isStagingLocalCombatBotVisualGuardActive()) return;

  botMovementTimer = setInterval(() => {
    moveHostileBotsBetweenNodes();
  }, HOSTILE_BOT_MOVE_MS);
}

function hostileBotAttackCycle() {
  if (typeof isStagingLocalCombatBotVisualGuardActive === "function" && isStagingLocalCombatBotVisualGuardActive()) return;

  updateErebusAggroStates();
  if (!isPlayerInSpaceView() || isAtPlanetNode()) return;

  const now = Date.now();
  const attackers = getVisibleHostileBots().filter(bot => {
    if (bot.faction !== "erebus") return true;
    if (bot.aggroState !== "hostile" || (bot.aggroUntil && now > Number(bot.aggroUntil))) return false;
    return now - Number(bot.lastFiredAt || 0) >= Number(bot.fireRateMs || HOSTILE_BOT_ATTACK_MS);
  });
  if (!attackers.length) return;

  let totalDamage = 0;

  speakWarning();
  triggerWarningBanner("WARNING");

  attackers.forEach(bot => {
    markBotFacingPlayer(bot);
    bot.lastFiredAt = now;
    if (Math.random() <= Number(bot.accuracy || 1)) {
      totalDamage += Number(bot.damage || HOSTILE_BOT_DAMAGE);
    }
  });

  updateAsteroidUI();

  attackers.forEach((bot, index) => {
    const delay = HOSTILE_BOT_LASER_DELAY_MS + Math.min(index * 55, 320);
    incomingLaserBurstFromBot(bot, delay);
    setTimeout(playEnemyLaserPulse, delay);
  });

  setTimeout(showIncomingHitFlash, HOSTILE_BOT_LASER_DELAY_MS + 130);
  setTimeout(() => applyDamageToPlayer(totalDamage), HOSTILE_BOT_LASER_DELAY_MS + 160);
  setTimeout(updateAsteroidUI, HOSTILE_BOT_ATTACK_FACE_MS + 80);
}

function startHostileBotAttacks() {
  if (botAttackTimer) return;
  if (typeof isStagingLocalCombatBotVisualGuardActive === "function" && isStagingLocalCombatBotVisualGuardActive()) return;

  botAttackTimer = setInterval(() => {
    hostileBotAttackCycle();
  }, HOSTILE_BOT_ATTACK_MS);
}

function maybeMoveAsteroid() {
  if (typeof shouldUseServerOwnedSectorObjects === "function" && shouldUseServerOwnedSectorObjects()) return;

  asteroids.forEach(asteroid => {
    if (!asteroid.alive) return;
    if (Math.random() > 0.5) return;

    const currentLinks = sectorNodes[asteroid.node]?.connects || [];
    const spaceLinks = currentLinks.filter(isAllowedAsteroidNode);
    const fallbackSpaceNodes = getLowerCombatAsteroidNodeIds();
    const options = spaceLinks.length ? spaceLinks : fallbackSpaceNodes.filter(name => name !== asteroid.node);

    if (!options.length) return;

    asteroid.node = options[Math.floor(Math.random() * options.length)];
    asteroid.x = Math.floor(Math.random() * 72) + 12;
    asteroid.y = Math.floor(Math.random() * 45) + 12;
  });
}

function getStagingNodeConsistencySnapshot() {
  const serverBots = typeof getVisibleStagingBotTargets === "function" ? getVisibleStagingBotTargets() : [];
  const serverResources = typeof getVisibleStagingResourceTargets === "function" ? getVisibleStagingResourceTargets() : [];
  const localBots = typeof getVisibleHostileBotsForLocalTargetUi === "function" ? getVisibleHostileBotsForLocalTargetUi() : getVisibleHostileBots();
  const localAsteroids = typeof getVisibleAsteroidsForLocalTargetUi === "function" ? getVisibleAsteroidsForLocalTargetUi() : getVisibleAsteroids();
  const visibleTargets = typeof getVisibleTargets === "function" ? getVisibleTargets() : [];
  const remotePlayers = typeof window !== "undefined"
    ? (window.LupenMultiplayerClient?.getPlayers?.({ includeSelf: false }) || [])
      .filter(player => String(player?.currentNode || player?.currentNodeId || player?.node || "") === String(currentNode || "") &&
        String(player?.presenceStatus || player?.status || "space").toLowerCase() !== "docked")
    : [];
  return {
    currentNode,
    serverOwnedActive: typeof shouldUseServerOwnedSectorObjects === "function" ? shouldUseServerOwnedSectorObjects() : false,
    localAsteroidsSuppressed: typeof shouldUseServerOwnedSectorObjects === "function" ? shouldUseServerOwnedSectorObjects() : false,
    visibleServerBots: serverBots.length,
    visibleServerResources: serverResources.length,
    visibleLocalBots: localBots.length,
    visibleLocalAsteroids: localAsteroids.length,
    visibleRemotePlayers: remotePlayers.length,
    visibleTargetTypes: visibleTargets.map(target => getTargetTypeFromEntity(target)),
    visibleTargetIds: visibleTargets.map(target => String(target?.id || "")),
    localAsteroidIds: localAsteroids.map(asteroid => String(asteroid?.id || ""))
  };
}

function clearStationVaultForShipyardIfNeeded(saved = null) {
  if (localStorage.getItem(STORAGE_VAULT_RESET_KEY) === "true") return false;
  const saveVersion = Number(saved?.migratedFromVersion || saved?.saveVersion || SAVE_VERSION);
  if (saveVersion >= 2) return false;

  inventoryItems = [];
  Object.keys(ownedAttachments || {}).forEach(key => { ownedAttachments[key] = 0; });
  Object.keys(ownedGuns || {}).forEach(key => { ownedGuns[key] = 0; });
  selectedVaultGroupKey = null;
  localStorage.setItem(STORAGE_VAULT_RESET_KEY, "true");
  return true;
}

