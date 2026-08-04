/* Save / load */

const LUPEN_LOCAL_SAVE_RESET_KEYS = Object.freeze([
  STORAGE_GAME_KEY,
  LupenSaveService.storageKeys.legacyGame,
  LupenSaveService.storageKeys.tutorial,
  STORAGE_VAULT_RESET_KEY,
  LupenSaveService.storageKeys.pendingPilotName,
  LupenSaveService.storageKeys.loginFlag,
  LupenSaveService.storageKeys.stagingFlowHintDismissed,
  LupenSaveService.storageKeys.debugTools,
  LupenSaveService.storageKeys.multiplayerServer,
  LupenSaveService.storageKeys.playerAccount
]);

const LUPEN_LOCAL_SAVE_RESET_PREFIXES = Object.freeze([
  `${STORAGE_GAME_KEY}.corrupt.`,
  `${LupenSaveService.storageKeys.legacyGame}.corrupt.`,
  `${LupenSaveService.storageKeys.tutorial}.corrupt.`
]);

const LUPEN_LOCAL_SAVE_RESET_SESSION_MARKER = "lupenLocalSaveResetAt";

function removeLupenLocalSaveKeysFromStorage(storage) {
  if (!storage) return [];
  const removed = [];
  LUPEN_LOCAL_SAVE_RESET_KEYS.forEach(key => {
    if (storage.getItem(key) !== null) {
      storage.removeItem(key);
      removed.push(key);
    }
  });

  for (let index = storage.length - 1; index >= 0; index -= 1) {
    const key = storage.key(index);
    if (!key || !LUPEN_LOCAL_SAVE_RESET_PREFIXES.some(prefix => key.startsWith(prefix))) continue;
    storage.removeItem(key);
    removed.push(key);
  }
  return removed;
}

function resetLupenRuntimeStateForLocalSaveClear() {
  if (typeof resetToNoShipStarterState === "function") {
    resetToNoShipStarterState();
  }
  if (typeof clearFirstSessionTransientState === "function") {
    clearFirstSessionTransientState("local_save_clear", { clearServerTarget: false, update: false });
  }
  window.lupenLastLocalSaveMigrationAnalysis = null;
  window.lupenTrustedStagingXpAfter = null;
  window.lupenLastStagingXpRefresh = null;
  if (typeof clearTutorialOverlayOnly === "function") clearTutorialOverlayOnly();
}

function lupenClearLocalSave(options = {}) {
  const removedLocalStorageKeys = removeLupenLocalSaveKeysFromStorage(window.localStorage);
  const removedSessionStorageKeys = removeLupenLocalSaveKeysFromStorage(window.sessionStorage);
  const shouldResetRuntime = options.resetRuntime !== false;
  if (shouldResetRuntime) resetLupenRuntimeStateForLocalSaveClear();
  try {
    window.sessionStorage?.setItem?.(LUPEN_LOCAL_SAVE_RESET_SESSION_MARKER, new Date().toISOString());
  } catch (error) {
    console.warn("[Lupen staging] Unable to store local reset marker.", error);
  }
  const result = { removedLocalStorageKeys, removedSessionStorageKeys, resetRuntime: shouldResetRuntime };
  console.info("[Lupen staging] Cleared local save/tutorial browser keys.", result);
  return result;
}

window.lupenClearLocalSave = lupenClearLocalSave;

function isLupenPilotResetAllowed() {
  const params = new URLSearchParams(window.location.search || "");
  const host = String(window.location.hostname || "").toLowerCase();
  return params.get("mp") === "staging" ||
    params.has("debug") ||
    ["localhost", "127.0.0.1", "::1"].includes(host);
}

function removeResetParamFromUrl(paramName) {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  params.delete(paramName);
  const nextUrl = `${url.pathname}${params.toString() ? `?${params}` : ""}${url.hash}`;
  try {
    window.history.replaceState({}, document.title, nextUrl);
  } catch (error) {
    console.warn(`[Lupen staging] Unable to remove ${paramName} query parameter.`, error);
  }
}

function handleStagingClearLocalSaveParam() {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  if (params.get("mp") !== "staging" || params.get("clearLocalSave") !== "1") return false;

  const result = lupenClearLocalSave();
  removeResetParamFromUrl("clearLocalSave");
  console.info("[Lupen staging] Applied clearLocalSave=1 before loading local game state.", result);
  return true;
}

async function lupenResetPilotProgress(options = {}) {
  if (!isLupenPilotResetAllowed()) {
    console.warn("[Lupen staging] Pilot progress reset blocked outside staging/dev.");
    return { ok: false, reason: "staging_or_dev_required" };
  }

  const previousCloudSync = getCloudSaveSyncStatus();
  disableCloudSaveSync("pilot_reset_in_progress");
  const resetWaitStartedAt = Date.now();
  while (cloudSaveCoordinator.inFlight && Date.now() - resetWaitStartedAt < 10000) {
    await new Promise(resolve => setTimeout(resolve, 25));
  }

  const localReset = lupenClearLocalSave();
  if (typeof resetToNoShipStarterState === "function") resetToNoShipStarterState();
  if (typeof clearStarterTutorialState === "function") clearStarterTutorialState();
  if (typeof saveTutorialState === "function") saveTutorialState();
  if (typeof clearTutorialOverlayOnly === "function") clearTutorialOverlayOnly();

  const cleanState = buildSaveState({ leaveSave: false });
  LupenSaveService.writeJsonLocalStorage(STORAGE_GAME_KEY, cleanState);

  let cloudSaved = false;
  let cloudReason = "not_authenticated";
  const auth = await getAuthenticatedSupabaseUser();
  if (auth) {
    await saveGameStateToSupabaseForUser(auth.client, auth.user, cleanState);
    cloudSaved = true;
    cloudReason = "saved";
    enableCloudSaveSync(auth.user.id, "pilot_reset_complete");
  } else if (previousCloudSync.enabled && previousCloudSync.userId) {
    enableCloudSaveSync(previousCloudSync.userId, "pilot_reset_auth_pending");
  }

  if (typeof updateProgressDisplays === "function") updateProgressDisplays();
  if (typeof refreshMissionDisplays === "function") refreshMissionDisplays();
  if (typeof updateHudDock === "function") updateHudDock();
  if (typeof updateSpaceHUD === "function") updateSpaceHUD();
  if (typeof renderObjectiveHud === "function") renderObjectiveHud();
  if (typeof renderPilotProfileIfActive === "function") renderPilotProfileIfActive();

  const result = {
    ok: true,
    localReset,
    cloudSaved,
    cloudReason,
    pilotId: String(auth?.user?.id || ""),
    resetState: "no_ship_starter_claim",
    reloaded: options.reload === true
  };
  console.info("Lupen pilot progress reset complete.", result);
  return result;
}

window.lupenResetPilotProgress = lupenResetPilotProgress;

async function handleStagingResetPilotParam() {
  const params = new URLSearchParams(window.location.search || "");
  if (params.get("mp") !== "staging" || params.get("resetPilot") !== "1") return null;

  const result = await lupenResetPilotProgress();
  removeResetParamFromUrl("resetPilot");
  console.info("[Lupen staging] Applied resetPilot=1.", result);
  return result;
}

window.addEventListener("pageshow", event => {
  if (!event.persisted) return;
  const localResetAt = window.sessionStorage?.getItem?.(LUPEN_LOCAL_SAVE_RESET_SESSION_MARKER);
  if (!localResetAt) return;
  resetLupenRuntimeStateForLocalSaveClear();
  if (typeof loadGame === "function") loadGame();
  console.info("[Lupen staging] Re-applied local save reset after browser history restore.", { localResetAt });
});

function getMultiplayerUnderAttackState() {
  const multiplayerState = window.lupenMultiplayerState || window.multiplayerState || null;
  return Boolean(
    multiplayerState?.underAttack ||
    multiplayerState?.inCombat ||
    multiplayerState?.attackerId ||
    multiplayerState?.activeEnemyPlayerId
  );
}

function isPlayerUnderAttackForLeaveSave() {
  const node = sectorNodes[currentNode];
  if (!node || node.type === "planet") return false;

  const localBotVisualGuardActive = typeof isStagingLocalCombatBotVisualGuardActive === "function"
    && isStagingLocalCombatBotVisualGuardActive();
  const hostileBotPresent = !localBotVisualGuardActive
    && hostileBots.some(bot => bot.alive && (bot.currentNodeId || bot.node) === currentNode && (bot.faction !== "erebus" || bot.aggroState === "hostile"));
  const hostileBotEngaged = !localBotVisualGuardActive && engagedTarget?.type === "hostileBot" && engageTimer;
  return Boolean(hostileBotPresent || hostileBotEngaged || getMultiplayerUnderAttackState());
}

function getLeaveSaveNode() {
  if (sectorNodes[currentNode]?.type !== "space") return currentNode;
  if (isPlayerUnderAttackForLeaveSave()) return currentNode;
  return getNearestPlanetNode(currentNode) || lastPlanetNode || homePlanet || "Asteron Prime";
}

function buildSaveState(options = {}) {
  if (typeof saveActiveShipCondition === "function") saveActiveShipCondition(currentShipId);
  if (typeof normalizePlayerProgress === "function") playerProgress = normalizePlayerProgress(playerProgress);
  if (typeof pruneMapOneCargoState === "function") pruneMapOneCargoState();
  const leaveSave = Boolean(options.leaveSave);
  const savedCurrentNode = leaveSave ? getLeaveSaveNode() : currentNode;
  const savedLastPlanetNode = sectorNodes[savedCurrentNode]?.type === "planet" ? savedCurrentNode : lastPlanetNode;
  const leftInSpace = sectorNodes[currentNode]?.type === "space";
  const leftUnderAttack = leaveSave && leftInSpace && isPlayerUnderAttackForLeaveSave();

  return {
    schema: SAVE_SCHEMA_ID,
    saveVersion: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    lastSaveReason: leaveSave ? "leave" : "manual",
    leftInSpace,
    leftUnderAttack,
    credits,
    cargo,
    cargoPurchased: typeof reconcileTradeCargoLedgers === "function" ? reconcileTradeCargoLedgers().cargoPurchased : cargoPurchased,
    cargoRecovered: typeof pruneRecoveredCargoQuantities === "function" ? pruneRecoveredCargoQuantities() : cargoRecovered,
    cargoCostBasis,
    currentNode: savedCurrentNode,
    lastPlanetNode: savedLastPlanetNode,
    homePlanet,
    installedAttachments,
    ownedAttachments,
    ownedGuns,
    shipLoadouts,
    shipConditions,
    selectedHangarShipId,
    selectedFleetShipId,
    currentShipId,
    ownedShips,
    unlockedShipLines,
    armor,
    hull,
    shield,
    shieldEnabled,
    jumpCharge,
    asteroids,
    hostileBots,
    lootByNode,
    inventoryItems,
    marketStock,
    activeTradeRoute,
    activeObjective,
    dailyTradeDate,
    dailyTradeContracts,
    selectedDailyTradeContractId,
    activeDailyTradeContractId,
    dailyTradeContractCargo,
    activeBountyId,
    dailyBountyDate,
    dailyBountyContracts,
    selectedBountyContractId,
    storeDailyPurchases,
    upgradeMaterials,
    playerProgress,
    tutorialState: typeof getTutorialSaveState === "function"
      ? getTutorialSaveState()
      : LupenSaveService.readJsonLocalStorage(LupenSaveService.storageKeys.tutorial),
    missionProgress: typeof normalizeMissionProgress === "function" ? normalizeMissionProgress(missionProgress) : missionProgress
  };
}

function saveGame(options = {}) {
  const state = buildSaveState(options);
  LupenSaveService.writeJsonLocalStorage(STORAGE_GAME_KEY, state);
  queueSupabaseSave(state);
}

const cloudSaveCoordinator = {
  enabled: false,
  userId: "",
  reason: "account_not_resolved",
  generation: 0,
  revision: 0,
  completedRevision: 0,
  inFlight: false,
  pending: null
};

function getCloudSaveSyncStatus() {
  return {
    enabled: cloudSaveCoordinator.enabled,
    userId: cloudSaveCoordinator.userId,
    reason: cloudSaveCoordinator.reason,
    generation: cloudSaveCoordinator.generation,
    revision: cloudSaveCoordinator.revision,
    completedRevision: cloudSaveCoordinator.completedRevision,
    inFlight: cloudSaveCoordinator.inFlight,
    hasPendingSave: Boolean(cloudSaveCoordinator.pending)
  };
}

function disableCloudSaveSync(reason = "account_not_resolved") {
  cloudSaveCoordinator.generation += 1;
  cloudSaveCoordinator.enabled = false;
  cloudSaveCoordinator.userId = "";
  cloudSaveCoordinator.reason = reason;
  cloudSaveCoordinator.pending = null;
  setSaveStatus("local");
  return getCloudSaveSyncStatus();
}

function enableCloudSaveSync(userId, reason = "account_save_resolved") {
  const safeUserId = String(userId || "").trim();
  if (!safeUserId) return disableCloudSaveSync("missing_authenticated_user");

  if (cloudSaveCoordinator.enabled && cloudSaveCoordinator.userId === safeUserId) {
    cloudSaveCoordinator.reason = reason;
    flushQueuedCloudSave();
    return getCloudSaveSyncStatus();
  }
  if (cloudSaveCoordinator.userId && cloudSaveCoordinator.userId !== safeUserId) {
    cloudSaveCoordinator.pending = null;
  }
  cloudSaveCoordinator.generation += 1;
  cloudSaveCoordinator.enabled = true;
  cloudSaveCoordinator.userId = safeUserId;
  cloudSaveCoordinator.reason = reason;
  flushQueuedCloudSave();
  return getCloudSaveSyncStatus();
}

function setSaveStatus(state) {
  const indicator = document.getElementById("saveStatusIndicator");
  if (!indicator) return;

  const labels = {
    saving: "Saving...",
    local: "Saved locally",
    cloud: "Saved to cloud",
    "cloud-failed": "Cloud save failed - local save kept"
  };

  indicator.textContent = labels[state] || labels.local;
  indicator.dataset.state = state || "local";
}

async function getAuthenticatedSupabaseUser() {
  return LupenSaveService.getAuthenticatedSupabaseUser(
    typeof getSupabaseClient === "function" ? getSupabaseClient : null
  );
}

async function flushQueuedCloudSave() {
  if (
    cloudSaveCoordinator.inFlight ||
    !cloudSaveCoordinator.enabled ||
    !cloudSaveCoordinator.pending
  ) {
    return false;
  }

  const queued = cloudSaveCoordinator.pending;
  cloudSaveCoordinator.pending = null;
  cloudSaveCoordinator.inFlight = true;
  const flushGeneration = queued.generation;
  setSaveStatus("saving");

  try {
    const auth = await getAuthenticatedSupabaseUser();
    if (
      flushGeneration !== cloudSaveCoordinator.generation ||
      !cloudSaveCoordinator.enabled
    ) {
      return false;
    }
    if (!auth?.user?.id) throw new Error("cloud_save_auth_unavailable");
    if (String(auth.user.id) !== cloudSaveCoordinator.userId) {
      disableCloudSaveSync("authenticated_user_changed");
      throw new Error("cloud_save_user_mismatch");
    }

    await saveGameStateToSupabaseForUser(auth.client, auth.user, queued.state);
    if (
      flushGeneration !== cloudSaveCoordinator.generation ||
      !cloudSaveCoordinator.enabled
    ) {
      return false;
    }
    cloudSaveCoordinator.completedRevision = Math.max(
      cloudSaveCoordinator.completedRevision,
      queued.revision
    );
    setSaveStatus("cloud");
    return true;
  } catch (error) {
    console.warn("Supabase save failed. Local save is still intact.", error);
    if (flushGeneration === cloudSaveCoordinator.generation) {
      setSaveStatus("cloud-failed");
    }
    return false;
  } finally {
    cloudSaveCoordinator.inFlight = false;
    if (cloudSaveCoordinator.enabled && cloudSaveCoordinator.pending) {
      queueMicrotask(() => flushQueuedCloudSave());
    }
  }
}

function queueSupabaseSave(state) {
  if (!state || !window.lupenSupabase || !cloudSaveCoordinator.enabled) {
    setSaveStatus("local");
    return false;
  }

  cloudSaveCoordinator.revision += 1;
  cloudSaveCoordinator.pending = {
    generation: cloudSaveCoordinator.generation,
    revision: cloudSaveCoordinator.revision,
    state: cloneCloudSaveState(state)
  };
  setSaveStatus("saving");
  flushQueuedCloudSave();
  return true;
}

function cloneCloudSaveState(state) {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(state);
    } catch (error) {
      console.warn("Cloud save snapshot clone fell back to JSON serialization.", error);
    }
  }
  return JSON.parse(JSON.stringify(state));
}

async function saveGameToSupabase(state = buildSaveState()) {
  const auth = await getAuthenticatedSupabaseUser();
  if (!auth) return false;

  return saveGameStateToSupabaseForUser(auth.client, auth.user, state);
}

async function saveGameStateToSupabaseForUser(client, user, state) {
  return LupenSaveService.saveGameStateToSupabaseForUser(client, user, state);
}

async function loadGameFromSupabase() {
  const auth = await getAuthenticatedSupabaseUser();
  if (!auth) return { loaded: false, exists: false, reason: "not_authenticated" };

  const saveData = await LupenSaveService.loadGameStateFromSupabaseForUser(auth.client, auth.user);
  if (!saveData) return { loaded: false, exists: false, reason: "missing" };

  const applied = applyLoadedGameState(saveData);
  if (applied) {
    LupenSaveService.writeJsonLocalStorage(STORAGE_GAME_KEY, buildSaveState({ leaveSave: false }));
  }
  return {
    loaded: applied,
    exists: true,
    reason: applied ? "loaded" : "invalid",
    combatXp: Number(playerProgress?.combatXp || 0),
    zoneCombatXp: Number(playerProgress?.zoneCombatXp?.[XP_CONFIG.combatZoneKey] || 0),
    staleStagingXpRefresh: window.lupenLastStagingXpRefresh?.stale === true
  };
}

window.getCloudSaveSyncStatus = getCloudSaveSyncStatus;
window.enableCloudSaveSync = enableCloudSaveSync;
window.disableCloudSaveSync = disableCloudSaveSync;
window.flushQueuedCloudSave = flushQueuedCloudSave;

function redrawProgressAfterStagingXp() {
  if (typeof updateProgressDisplays === "function") updateProgressDisplays();
  if (typeof updateHudDock === "function") updateHudDock();
  if (typeof renderPilotProfile === "function" && document.getElementById("pilotProfileScreen")?.classList.contains("active")) {
    renderPilotProfile();
  }
}

function getStagingXpAfterFromResult(result = {}) {
  const xpAfter = Number(
    result.xpAfter ??
    result.persistedXp ??
    result.playerSavePatchResult?.xpAfter ??
    result.playerSavePatchResult?.persistedXp ??
    result.playerSave?.xpAfter ??
    result.claimStatus?.playerSave?.xpAfter
  );
  return Number.isFinite(xpAfter) ? Math.max(0, Math.round(xpAfter)) : null;
}

function rememberTrustedStagingXp(result = {}, source = "stagingXp") {
  const xpAfter = getStagingXpAfterFromResult(result);
  if (!Number.isFinite(xpAfter)) return null;

  const currentXp = Math.max(0, Number(playerProgress?.combatXp || 0));
  window.lupenTrustedStagingXpAfter = {
    xpAfter,
    source,
    xpBefore: Number(result.xpBefore ?? result.playerSavePatchResult?.xpBefore ?? result.playerSave?.xpBefore ?? currentXp),
    rememberedAt: Date.now()
  };
  return window.lupenTrustedStagingXpAfter;
}

function applyTrustedStagingXpIfNewer(source = "cloudRefresh") {
  const trusted = window.lupenTrustedStagingXpAfter;
  const xpAfter = Number(trusted?.xpAfter);
  if (!Number.isFinite(xpAfter)) return false;
  if (Date.now() - Number(trusted.rememberedAt || 0) > 15000) return false;

  const progress = normalizePlayerProgress(playerProgress);
  const currentXp = Number(progress.combatXp || 0);
  if (xpAfter <= currentXp) {
    window.lupenLastStagingXpRefresh = {
      source,
      stale: false,
      trustedXpAfter: xpAfter,
      refreshedXp: currentXp,
      checkedAt: Date.now()
    };
    return false;
  }

  progress.combatXp = Math.max(0, Math.round(xpAfter));
  progress.zoneCombatXp = {
    ...(progress.zoneCombatXp || {}),
    [XP_CONFIG.combatZoneKey]: Math.max(
      Number(progress.zoneCombatXp?.[XP_CONFIG.combatZoneKey] || 0),
      progress.combatXp
    )
  };
  playerProgress = normalizePlayerProgress(progress);
  window.lupenLastStagingXpRefresh = {
    source,
    stale: true,
    trustedXpAfter: xpAfter,
    refreshedXp: currentXp,
    appliedXp: playerProgress.combatXp,
    checkedAt: Date.now()
  };
  redrawProgressAfterStagingXp();
  return true;
}

function getCurrentCombatXpSnapshot() {
  return {
    combatXp: Math.max(0, Math.round(Number(playerProgress?.combatXp || 0))),
    zoneCombatXp: Math.max(0, Math.round(Number(playerProgress?.zoneCombatXp?.[XP_CONFIG.combatZoneKey] || 0)))
  };
}

function applyCombatXpFloorForStaging(xpValue, source = "combatRefresh") {
  const xpAfter = Math.max(0, Math.round(Number(xpValue || 0)));
  if (!Number.isFinite(xpAfter)) return false;

  const progress = normalizePlayerProgress(playerProgress);
  const currentXp = Math.max(
    Number(progress.combatXp || 0),
    Number(progress.zoneCombatXp?.[XP_CONFIG.combatZoneKey] || 0)
  );
  if (xpAfter <= currentXp) return false;

  progress.combatXp = xpAfter;
  progress.zoneCombatXp = {
    ...(progress.zoneCombatXp || {}),
    [XP_CONFIG.combatZoneKey]: xpAfter
  };
  playerProgress = normalizePlayerProgress(progress);
  window.lupenLastStagingXpRefresh = {
    ...(window.lupenLastStagingXpRefresh || {}),
    source,
    appliedXp: playerProgress.combatXp,
    reason: "combat_refresh_applied",
    checkedAt: Date.now()
  };
  LupenSaveService.writeJsonLocalStorage(STORAGE_GAME_KEY, buildSaveState({ leaveSave: false }));
  redrawProgressAfterStagingXp();
  return true;
}

async function refreshProgressAfterStagingCombat(options = {}) {
  const reason = typeof options === "string" ? options : (options.reason || "combatRefresh");
  const trustedXpAfter = Number(options.trustedXpAfter ?? window.lupenTrustedStagingXpAfter?.xpAfter);
  const before = getCurrentCombatXpSnapshot();
  const localBefore = Math.max(before.combatXp, before.zoneCombatXp);
  // Server combat responses already carry the trusted XP floor. Never replace
  // the whole live profile here: a delayed cloud read can contain an older
  // ship/Journey snapshot and erase progress made seconds earlier.
  const cloudXp = localBefore;
  const bestXp = Math.max(
    localBefore,
    Number.isFinite(trustedXpAfter) ? trustedXpAfter : 0,
    cloudXp
  );
  const applied = applyCombatXpFloorForStaging(bestXp, reason);
  const afterApply = getCurrentCombatXpSnapshot();
  const appliedXp = Math.max(afterApply.combatXp, afterApply.zoneCombatXp);
  const matched = Number.isFinite(trustedXpAfter) ? appliedXp >= trustedXpAfter : cloudXp > localBefore || applied;

  window.lupenLastStagingXpRefresh = {
    source: reason,
    localXp: localBefore,
    cloudXp,
    trustedXpAfter: Number.isFinite(trustedXpAfter) ? trustedXpAfter : null,
    appliedXp,
    matched,
    stale: cloudXp < bestXp,
    reason: applied ? "combat_refresh_applied" : matched ? "combat_refresh_matched" : "combat_refresh_no_change",
    checkedAt: Date.now()
  };
  redrawProgressAfterStagingXp();
  return window.lupenLastStagingXpRefresh;
}

window.refreshProgressAfterStagingCombat = refreshProgressAfterStagingCombat;

function applyStagingXpClaimToLoadedState(result = {}) {
  const xpAfter = getStagingXpAfterFromResult(result);
  const applied = result.playerSavePatchResult?.applied === true ||
    result.applied === true ||
    result.botXpApplied === true ||
    result.saveWritten === true ||
    result.playerSave?.written === true ||
    result.claimStatus?.playerSave?.written === true;
  const creditsAfter = Number(
    result.creditsAfter ??
    result.playerSavePatchResult?.creditsAfter ??
    result.playerSavePatchResult?.plan?.creditsAfter ??
    result.playerSavePatchPlan?.creditsAfter
  );
  const lupenShardsAfter = Number(
    result.lupenShardsAfter ??
    result.playerSavePatchResult?.lupenShardsAfter ??
    result.playerSavePatchResult?.persistedLupenShards ??
    result.playerSavePatchResult?.plan?.lupenShardsAfter ??
    result.playerSavePatchPlan?.lupenShardsAfter
  );
  if (!applied || (!Number.isFinite(xpAfter) && !Number.isFinite(creditsAfter) && !Number.isFinite(lupenShardsAfter))) return false;

  const xpSource = result.xpSource || result.source || (result.botId ? "botKill" : "bountyClaim");
  let appliedXp = Number(playerProgress?.combatXp || 0);
  if (Number.isFinite(xpAfter)) {
    rememberTrustedStagingXp(result, xpSource);
    const progress = normalizePlayerProgress(playerProgress);
    if (xpAfter < Number(progress.combatXp || 0)) return false;
    progress.combatXp = Math.max(0, Math.round(xpAfter));
    progress.zoneCombatXp = {
      ...(progress.zoneCombatXp || {}),
      [XP_CONFIG.combatZoneKey]: Math.max(
        Number(progress.zoneCombatXp?.[XP_CONFIG.combatZoneKey] || 0),
        progress.combatXp
      )
    };
    playerProgress = normalizePlayerProgress(progress);
    appliedXp = playerProgress.combatXp;
  }
  if (Number.isFinite(creditsAfter)) {
    credits = Math.max(Number(credits || 0), Math.round(creditsAfter));
  }
  if (Number.isFinite(lupenShardsAfter)) {
    upgradeMaterials = normalizeUpgradeMaterials(upgradeMaterials);
    upgradeMaterials.lupenShards = Math.max(Number(upgradeMaterials.lupenShards || 0), Math.round(lupenShardsAfter));
  }
  if (result.botId && typeof recordMissionEvent === "function") {
    recordMissionEvent("destroy_bot", {
      botId: result.botId,
      botName: result.botName,
      faction: "erebus",
      eventKey: result.destructionInstanceId || result.botXpSourceEventId || result.rewardPreviewId || result.idempotencyKey || ""
    });
  }
  window.lupenLastStagingXpRefresh = {
    source: xpSource,
    stale: false,
    trustedXpAfter: Number.isFinite(xpAfter) ? xpAfter : null,
    refreshedXp: appliedXp,
    appliedXp,
    hudXpAfterPatch: appliedXp,
    creditsAfterPatch: credits,
    lupenShardsAfterPatch: Number(upgradeMaterials?.lupenShards || 0),
    redrawTriggered: true,
    reason: Number.isFinite(xpAfter) ? "hud_xp_refreshed" : "hud_reward_refreshed",
    checkedAt: Date.now()
  };
  LupenSaveService.writeJsonLocalStorage(STORAGE_GAME_KEY, buildSaveState({ leaveSave: false }));
  redrawProgressAfterStagingXp();
  return true;
}

window.applyStagingXpClaimToLoadedState = applyStagingXpClaimToLoadedState;

function getStagingBotKillXpKey(result = {}) {
  const key = String(
    result.destructionInstanceId ||
    result.botXpSourceEventId ||
    result.rewardPreviewId ||
    result.idempotencyKey ||
    ""
  ).trim();
  if (key) return key;
  const botId = String(result.botId || "").trim();
  const receivedAt = String(result.receivedAt || "").trim();
  return botId && receivedAt ? `${botId}:${receivedAt}` : "";
}

function ensureStagingBotKillXpAwardedKeys() {
  if (!window.lupenStagingBotKillXpAwardedKeys) {
    window.lupenStagingBotKillXpAwardedKeys = new Set();
  }
  return window.lupenStagingBotKillXpAwardedKeys;
}

function markStagingBotKillXpAwarded(result = {}) {
  const key = getStagingBotKillXpKey(result);
  if (!key) return { marked: false, reason: "staging_bot_kill_key_missing" };
  ensureStagingBotKillXpAwardedKeys().add(key);
  return { marked: true, key };
}

function getLocalStagingBotKillXpAmount(result = {}) {
  const configured = typeof getCombatXpPerBot === "function" ? Number(getCombatXpPerBot()) : 0;
  const preview = Number(result.previewXp ?? result.xpDelta ?? result.claimStatus?.xpDelta ?? 0);
  const amount = preview > 0 ? preview : configured > 0 ? configured : 4;
  return Math.max(0, Math.round(amount));
}

function awardLocalStagingBotKillXpFromServer(result = {}) {
  const alreadyApplied = result.applied === true ||
    result.botXpApplied === true ||
    result.saveWritten === true ||
    result.playerSavePatchResult?.applied === true ||
    result.playerSave?.written === true ||
    result.claimStatus?.playerSave?.written === true;
  if (alreadyApplied) return { applied: false, reason: "server_xp_already_applied" };

  const key = getStagingBotKillXpKey(result);
  if (!key) return { applied: false, reason: "staging_bot_kill_key_missing" };

  const awardedKeys = ensureStagingBotKillXpAwardedKeys();
  if (awardedKeys.has(key)) {
    return { applied: false, reason: "duplicate_staging_bot_kill_xp" };
  }

  const xp = getLocalStagingBotKillXpAmount(result);
  if (xp <= 0) return { applied: false, reason: "staging_bot_kill_xp_zero" };

  const botName = String(result.botName || "Erebus Bot").trim() || "Erebus Bot";
  awardedKeys.add(key);
  if (typeof recordBotDestroyedProgress === "function") {
    recordBotDestroyedProgress({
      id: result.botId || "",
      name: botName,
      faction: "erebus",
      botType: "erebus_staging"
    });
  } else {
    playerProgress = normalizePlayerProgress(playerProgress);
    playerProgress.totals.botsDestroyed = Math.max(0, Number(playerProgress.totals.botsDestroyed || 0)) + 1;
    playerProgress.totals.erebusBotsDestroyed = Math.max(0, Number(playerProgress.totals.erebusBotsDestroyed || 0)) + 1;
  }

  const xpResult = addCombatXp(xp, "stagingBotKill");
  const message = `${botName} destroyed. +${formatNumber(xpResult.gained)} XP.`;
  if (typeof addHudToast === "function") addHudToast(message);
  else if (typeof addActivityLog === "function") addActivityLog(message);
  saveGame();
  redrawProgressAfterStagingXp();

  window.lupenLastStagingXpRefresh = {
    source: "localBotKillFallback",
    stale: false,
    trustedXpAfter: null,
    refreshedXp: playerProgress.combatXp,
    appliedXp: playerProgress.combatXp,
    hudXpAfterPatch: playerProgress.combatXp,
    redrawTriggered: true,
    reason: "local_staging_bot_xp_awarded",
    checkedAt: Date.now()
  };

  return {
    applied: true,
    reason: "local_staging_bot_xp_awarded",
    xpDelta: xpResult.gained,
    xpAfter: playerProgress.combatXp,
    key
  };
}

window.getStagingBotKillXpKey = getStagingBotKillXpKey;
window.markStagingBotKillXpAwarded = markStagingBotKillXpAwarded;
window.awardLocalStagingBotKillXpFromServer = awardLocalStagingBotKillXpFromServer;
window.getLupenCombatXpSnapshot = function getLupenCombatXpSnapshot() {
  return {
    combatXp: Number(playerProgress?.combatXp || 0),
    zoneCombatXp: Number(playerProgress?.zoneCombatXp?.[XP_CONFIG.combatZoneKey] || 0),
    trustedStagingXpAfter: Number.isFinite(Number(window.lupenTrustedStagingXpAfter?.xpAfter))
      ? Number(window.lupenTrustedStagingXpAfter.xpAfter)
      : null,
    lastStagingXpRefresh: window.lupenLastStagingXpRefresh || null
  };
};

function getLocalSavePayloadForCloudMigration() {
  return migrateSavedGame(LupenSaveService.readJsonLocalStorage(STORAGE_GAME_KEY));
}

function getLocalSaveMigrationSource() {
  const raw = LupenSaveService.readLocalStorage(STORAGE_GAME_KEY);
  return {
    key: STORAGE_GAME_KEY,
    raw,
    payload: raw ? migrateSavedGame(LupenSaveService.readJsonLocalStorage(STORAGE_GAME_KEY)) : null
  };
}

function analyzeLocalSaveForCloudMigration(saved = getLocalSavePayloadForCloudMigration(), sourceKey = STORAGE_GAME_KEY) {
  if (!saved) return { meaningful: false, sourceKey, reasons: ["missing_save"] };

  const starterShipId = typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
  const starterShipIds = new Set([starterShipId, "lupenOrigin"]);
  const ownedShipIds = Array.isArray(saved.ownedShips) ? saved.ownedShips.filter(shipId => SHIPS[shipId]) : [];
  const hasNonStarterShip = ownedShipIds.some(shipId => !starterShipIds.has(shipId));
  const hasOnlyDefaultStarterShip = ownedShipIds.length === 1 && starterShipIds.has(ownedShipIds[0]);
  const progressTotals = saved.playerProgress?.totals || {};
  const hasProgressTotals = Object.values(progressTotals).some(value => Number(value || 0) > 0);
  const hasCombatXp = Number(saved.playerProgress?.combatXp || 0) > 0;
  const hasCargo = saved.cargo && mineralKeys.some(mineral => Number(saved.cargo[mineral] || 0) > 0);
  const hasInventory = Array.isArray(saved.inventoryItems) && saved.inventoryItems.length > 0;
  const hasOwnedGuns = saved.ownedGuns && Object.values(saved.ownedGuns).some(count => Number(count || 0) > 0);
  const hasOwnedAttachments = saved.ownedAttachments && Object.values(saved.ownedAttachments).some(count => Number(count || 0) > 0);
  const hasTradeOrBounty = Boolean(saved.activeTradeRoute || saved.activeObjective);
  const hasDifferentCredits = saved.credits !== undefined && Number(saved.credits) !== 10000;

  const checks = [
    ["non_starter_ship", hasNonStarterShip],
    ["non_default_ship_shell", !hasOnlyDefaultStarterShip && ownedShipIds.length > 0],
    ["progress_totals", hasProgressTotals],
    ["combat_xp", hasCombatXp],
    ["cargo", hasCargo],
    ["inventory", hasInventory],
    ["owned_guns", hasOwnedGuns],
    ["owned_attachments", hasOwnedAttachments],
    ["trade_or_bounty_objective", hasTradeOrBounty],
    ["credits_changed", hasDifferentCredits]
  ];
  const reasons = checks.filter(([, active]) => active).map(([reason]) => reason);

  return {
    meaningful: reasons.length > 0,
    sourceKey,
    reasons: reasons.length ? reasons : ["default_or_blank_save_shell"]
  };
}

function hasMeaningfulLocalSave(saved = getLocalSavePayloadForCloudMigration()) {
  return analyzeLocalSaveForCloudMigration(saved).meaningful;
}

function isStagingLocalSaveLoggingEnabled() {
  try {
    return new URLSearchParams(window.location.search || "").get("mp") === "staging";
  } catch (_error) {
    return false;
  }
}

function logStagingLocalSaveMigration(label, detail = {}) {
  if (!isStagingLocalSaveLoggingEnabled()) return;
  console.info(`[Lupen staging] ${label}`, detail);
}

async function uploadLocalSavePayloadToSupabase(localSavePayload) {
  const auth = await getAuthenticatedSupabaseUser();
  if (!auth || !localSavePayload) return false;
  await saveGameStateToSupabaseForUser(auth.client, auth.user, localSavePayload);
  return true;
}

function promptUploadLocalSaveToSupabase() {
  return new Promise(resolve => {
    logStagingLocalSaveMigration("Showing local save migration prompt.", {
      sourceKey: window.lupenLastLocalSaveMigrationAnalysis?.sourceKey || STORAGE_GAME_KEY,
      meaningful: window.lupenLastLocalSaveMigrationAnalysis?.meaningful === true,
      reasons: window.lupenLastLocalSaveMigrationAnalysis?.reasons || []
    });
    let overlay = document.getElementById("localSaveMigrationOverlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "localSaveMigrationOverlay";
      overlay.className = "reward-overlay local-save-migration-overlay";
      document.body.appendChild(overlay);
    }

    overlay.innerHTML = `
      <div class="reward-modal local-save-migration-modal">
        <div class="reward-kicker">Cloud Save</div>
        <h2>Local progress found</h2>
        <p>No cloud save was found for this account. Start fresh, or use this browser's local progress?</p>
        <div class="reward-modal-actions">
          <button id="startFreshLocalSaveBtn" type="button">Start Fresh</button>
          <button id="uploadLocalSaveBtn" class="secondary" type="button">Use Local Save</button>
        </div>
      </div>
    `;

    const close = decision => {
      overlay.classList.remove("active");
      resolve(decision);
    };

    overlay.querySelector("#uploadLocalSaveBtn")?.addEventListener("click", () => close("upload"), { once: true });
    overlay.querySelector("#startFreshLocalSaveBtn")?.addEventListener("click", () => close("fresh"), { once: true });
    requestAnimationFrame(() => overlay.classList.add("active"));
  });
}

function buildSaveExportPayload() {
  return {
    schema: SAVE_SCHEMA_ID,
    exportVersion: SAVE_EXPORT_VERSION,
    saveVersion: SAVE_VERSION,
    exportedAt: new Date().toISOString(),
    game: buildSaveState({ leaveSave: false }),
    account: LupenSaveService.readJsonLocalStorage(STORAGE_ACCOUNT_KEY),
    tutorial: LupenSaveService.readJsonLocalStorage(LupenSaveService.storageKeys.tutorial)
  };
}

function getImportGameState(payload) {
  if (!payload || typeof payload !== "object") return null;

  if (payload.schema === SAVE_SCHEMA_ID && payload.game && typeof payload.game === "object") {
    return migrateSavedGame(payload.game);
  }

  if (payload.saveVersion || payload.credits !== undefined || payload.currentNode) {
    return migrateSavedGame(payload);
  }

  return null;
}

function setSaveTransferStatus(message, tone = "info") {
  const status = document.getElementById("saveTransferStatus");
  if (!status) return;
  status.textContent = message;
  status.dataset.tone = tone;
}

function exportSaveFile() {
  try {
    saveGame();
    const payload = buildSaveExportPayload();
    const fileName = `lupen-save-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setSaveTransferStatus(`Exported ${fileName}.`, "success");
  } catch (error) {
    console.warn("Unable to export save.", error);
    setSaveTransferStatus("Export failed. Check browser download permissions.", "error");
  }
}

function importSavePayload(payload) {
  const migratedGame = getImportGameState(payload);
  if (!migratedGame) {
    throw new Error("Unsupported save file.");
  }

  LupenSaveService.writeJsonLocalStorage(STORAGE_GAME_KEY, migratedGame);

  if (payload.schema === SAVE_SCHEMA_ID) {
    if (payload.account && typeof payload.account === "object") {
      LupenSaveService.writeJsonLocalStorage(STORAGE_ACCOUNT_KEY, payload.account);
    }
    if (payload.tutorial && typeof payload.tutorial === "object") {
      LupenSaveService.writeJsonLocalStorage(LupenSaveService.storageKeys.tutorial, payload.tutorial);
    }
  }

  return migratedGame;
}

function importSaveFile(event) {
  const input = event?.target;
  const file = input?.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const payload = JSON.parse(String(reader.result || "{}"));
      const imported = importSavePayload(payload);
      setSaveTransferStatus(`Imported save v${imported.saveVersion}. Reloading...`, "success");
      setTimeout(() => window.location.reload(), 450);
    } catch (error) {
      console.warn("Unable to import save.", error);
      setSaveTransferStatus("Import failed. Choose a valid Lupen save JSON file.", "error");
    } finally {
      if (input) input.value = "";
    }
  };
  reader.onerror = () => {
    setSaveTransferStatus("Import failed. The file could not be read.", "error");
    if (input) input.value = "";
  };
  reader.readAsText(file);
}

function saveGameBeforeLeave() {
  try {
    saveGame({ leaveSave: true });
  } catch (error) {
    console.warn("Unable to save game before leaving.", error);
  }
}

function clearTransientStateAfterLoadedSave() {
  if (typeof clearFirstSessionTransientState === "function") {
    clearFirstSessionTransientState("loaded_save", { clearServerTarget: false, update: false });
    return;
  }
  if (typeof engageTimer !== "undefined" && engageTimer) {
    clearInterval(engageTimer);
    engageTimer = null;
  }
  if (typeof selectedTarget !== "undefined") selectedTarget = null;
  if (typeof engagedTarget !== "undefined") engagedTarget = null;
  if (typeof serverPvpDamageDisplayState !== "undefined") serverPvpDamageDisplayState = null;
  if (typeof lastPvpHullFeedbackState !== "undefined") lastPvpHullFeedbackState = "";
  if (typeof clearAllCombatVisuals === "function") clearAllCombatVisuals();
}

function shouldRepairMissingStarterShip(saved = {}) {
  if (!Array.isArray(saved.ownedShips) || saved.ownedShips.length > 0 || saved.currentShipId) return false;
  const progress = saved.playerProgress && typeof saved.playerProgress === "object" ? saved.playerProgress : {};
  const totals = progress.totals && typeof progress.totals === "object" ? progress.totals : {};
  const hasProgress = Number(progress.combatXp || 0) > 0 ||
    Object.values(totals).some(value => Number(value || 0) > 0);
  const hasEquipment = Object.values(saved.ownedGuns || {}).some(value => Number(value || 0) > 0) ||
    Object.values(saved.ownedAttachments || {}).some(value => Number(value || 0) > 0) ||
    (Array.isArray(saved.inventoryItems) && saved.inventoryItems.length > 0);
  const starterShipId = typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
  const starterLoadout = saved.shipLoadouts?.[starterShipId];
  const hasStarterLoadout = ["guns", "attachments"].some(key =>
    Array.isArray(starterLoadout?.[key]) && starterLoadout[key].some(Boolean)
  );
  return hasProgress || hasEquipment || hasStarterLoadout;
}

function applyLoadedGameState(rawSaved) {
  const saved = migrateSavedGame(rawSaved);
  if (!saved) return false;

  credits = saved.credits ?? credits;
  playerProgress = normalizePlayerProgress(saved.playerProgress || playerProgress);
  if (typeof normalizeMissionProgress === "function") {
    missionProgress = normalizeMissionProgress(saved.missionProgress || missionProgress);
  }
  if (saved.tutorialState && typeof restoreTutorialStateFromSave === "function") {
    restoreTutorialStateFromSave(saved.tutorialState, { checkpoint: false, render: false });
  }
  applyTrustedStagingXpIfNewer("loadGameFromSupabase");
  upgradeMaterials = normalizeUpgradeMaterials(saved.upgradeMaterials);
  cargoCostBasis = saved.cargoCostBasis ?? cargoCostBasis;
  cargoPurchased = saved.cargoPurchased && typeof saved.cargoPurchased === "object" ? saved.cargoPurchased : cargoPurchased;
  cargoRecovered = saved.cargoRecovered && typeof saved.cargoRecovered === "object" ? saved.cargoRecovered : cargoRecovered;

  const starterShipId = typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
  const savedOwnedShips = Array.isArray(saved.ownedShips) ? saved.ownedShips.filter(shipId => SHIPS[shipId]) : ownedShips;
  const repairedMissingStarterShip = shouldRepairMissingStarterShip(saved) && Boolean(SHIPS[starterShipId]);
  const noShipStarterState = Array.isArray(saved.ownedShips) && saved.ownedShips.length === 0 && !saved.currentShipId && !repairedMissingStarterShip;
  ownedShips = savedOwnedShips;
  unlockedShipLines = Array.from(new Set([PIONEER_LINE_ID, ...(Array.isArray(saved.unlockedShipLines) ? saved.unlockedShipLines : [])]));
  if (repairedMissingStarterShip || (!ownedShips.length && !noShipStarterState && SHIPS[starterShipId])) ownedShips = [starterShipId];
  currentShipId = noShipStarterState ? "" : (SHIPS[saved.currentShipId] && ownedShips.includes(saved.currentShipId) ? saved.currentShipId : (ownedShips[0] || starterShipId));
  selectedHangarShipId = SHIPS[saved.selectedHangarShipId] ? saved.selectedHangarShipId : (currentShipId || starterShipId);
  selectedFleetShipId = SHIPS[saved.selectedFleetShipId] ? saved.selectedFleetShipId : (currentShipId || starterShipId);
  shipLoadouts = saved.shipLoadouts && typeof saved.shipLoadouts === "object" ? saved.shipLoadouts : shipLoadouts;
  if (currentShipId && !shipLoadouts[currentShipId]) shipLoadouts[currentShipId] = normalizeShipLoadout(undefined, currentShipId);
  shipConditions = saved.shipConditions && typeof saved.shipConditions === "object" ? saved.shipConditions : {};
  activeTradeRoute = saved.activeTradeRoute && sectorNodes[saved.activeTradeRoute.origin] && sectorNodes[saved.activeTradeRoute.destination] ? {
    ...saved.activeTradeRoute,
    maxUnits: Number(saved.activeTradeRoute.maxUnits || getShipStats().cargo || 0),
    purchasedUnits: Number(saved.activeTradeRoute.purchasedUnits || 0),
    realizedProfit: Number(saved.activeTradeRoute.realizedProfit || 0)
  } : activeTradeRoute;
  activeObjective = saved.activeObjective?.type === "trade" && sectorNodes[saved.activeObjective.origin] && sectorNodes[saved.activeObjective.destination] ? saved.activeObjective : (activeTradeRoute ? createTradeObjective(activeTradeRoute) : activeObjective);
  if (!activeTradeRoute && activeObjective?.type === "trade") {
    activeTradeRoute = { ...activeObjective };
  }
  dailyTradeDate = saved.dailyTradeDate || dailyTradeDate;
  dailyTradeContracts = Array.isArray(saved.dailyTradeContracts) ? saved.dailyTradeContracts : dailyTradeContracts;
  selectedDailyTradeContractId = saved.selectedDailyTradeContractId || selectedDailyTradeContractId;
  activeDailyTradeContractId = saved.activeDailyTradeContractId || activeDailyTradeContractId;
  dailyTradeContractCargo = saved.dailyTradeContractCargo && typeof saved.dailyTradeContractCargo === "object"
    ? saved.dailyTradeContractCargo
    : null;

  dailyBountyDate = saved.dailyBountyDate || dailyBountyDate;
  dailyBountyContracts = Array.isArray(saved.dailyBountyContracts) ? saved.dailyBountyContracts : dailyBountyContracts;
  selectedBountyContractId = saved.selectedBountyContractId || selectedBountyContractId;
  activeBountyId = saved.activeBountyId || activeBountyId;
  storeDailyPurchases = saved.storeDailyPurchases && typeof saved.storeDailyPurchases === "object" ? saved.storeDailyPurchases : storeDailyPurchases;
  pruneStoreDailyPurchases();
  ensureDailyBounties();
  if (saved.activeObjective?.type === "bounty") {
    const savedArea = saved.activeObjective.targetArea || DAILY_BOUNTY_CONTRACTS.find(item => item.id === saved.activeObjective.contractId)?.targetArea || "anyHostile";
    activeObjective = {
      ...saved.activeObjective,
      targetArea: savedArea,
      targetLabel: saved.activeObjective.targetLabel || getBountyAreaLabel(savedArea),
      targetBotType: saved.activeObjective.targetBotType || getBountyContract(saved.activeObjective.contractId)?.targetBotType || null,
      targetBotLabel: saved.activeObjective.targetBotLabel || getBountyContract(saved.activeObjective.contractId)?.targetBotLabel || "Hostile Bot",
      targetNode: undefined,
      kills: Number(saved.activeObjective.kills || 0),
      killsRequired: Number(saved.activeObjective.killsRequired || 1),
      reward: typeof saved.activeObjective.reward === "object" ? saved.activeObjective.reward : (getBountyContract(saved.activeObjective.contractId)?.reward || {}),
      timed: Boolean(saved.activeObjective.timed || getBountyContract(saved.activeObjective.contractId)?.timed),
      expiresAt: saved.activeObjective.expiresAt || getBountyContract(saved.activeObjective.contractId)?.expiresAt || null,
      status: saved.activeObjective.status || "active"
    };
    activeBountyId = activeObjective.contractId;
    if (activeObjective.kills >= activeObjective.killsRequired && activeObjective.status !== "readyToClaim") {
      activeObjective.status = "readyToClaim";
      const claimContract = getBountyContract(activeObjective.contractId);
      if (claimContract && claimContract.status !== "completed") claimContract.status = "readyToClaim";
    }
    activeTradeRoute = null;
  }

  currentNode = sectorNodes[saved.currentNode] ? saved.currentNode : currentNode;
  lastPlanetNode = sectorNodes[saved.lastPlanetNode] ? saved.lastPlanetNode : lastPlanetNode;
  homePlanet = sectorNodes[saved.homePlanet]?.type === "planet" ? saved.homePlanet : homePlanet;
  installedAttachments = Array.isArray(saved.installedAttachments) ? saved.installedAttachments : installedAttachments;
  ownedAttachments = saved.ownedAttachments ?? ownedAttachments;
  ownedGuns = saved.ownedGuns ?? ownedGuns;
  ensureInventoryObjects();
  ownedShips.forEach(shipId => {
    shipLoadouts[shipId] = normalizeShipLoadout(shipLoadouts[shipId], shipId);
  });

  if (currentShipId && !shipLoadouts[currentShipId]) {
    shipLoadouts[currentShipId] = normalizeShipLoadout(undefined, currentShipId);
  }
  if (typeof reconcileMissionProgressFromGameplayState === "function") {
    reconcileMissionProgressFromGameplayState({
      source: "loaded_save",
      shipId: currentShipId,
      refresh: false,
      save: false,
      notify: false
    });
  }
  if (repairedMissingStarterShip && typeof window.repairProgressFromCompletedStarterTutorial === "function") {
    window.repairProgressFromCompletedStarterTutorial();
  }

  hull = Number.isFinite(Number(saved.hull)) ? Number(saved.hull) : hull;
  armor = Number.isFinite(Number(saved.armor)) ? Number(saved.armor) : armor;
  shield = Number.isFinite(Number(saved.shield)) ? Number(saved.shield) : shield;
  shieldEnabled = true;
  jumpCharge = Number.isFinite(Number(saved.jumpCharge)) ? Number(saved.jumpCharge) : jumpCharge;
  if (typeof normalizeShipCondition === "function") {
    ownedShips.forEach(shipId => {
      shipConditions[shipId] = normalizeShipCondition(shipId, shipConditions[shipId]);
    });
    if (currentShipId && !saved.shipConditions?.[currentShipId]) {
      shipConditions[currentShipId] = normalizeShipCondition(currentShipId, { hull, shield });
    }
  }

  const loadedStats = getShipStats(currentShipId);
  if (!Number.isFinite(hull) || hull <= 0 || !Number.isFinite(hullMax) || hullMax <= 0) hull = loadedStats.hull;
  if (!Number.isFinite(shield) || shield < 0 || !Number.isFinite(shieldMax) || shieldMax < 0) shield = loadedStats.shield;
  asteroids = normalizeAsteroidCollection(saved.asteroids);

  if (Array.isArray(saved.hostileBots) && saved.hostileBots.length) {
    const defaultBots = createInitialHostileBots();
    const savedBotsByType = saved.hostileBots.reduce((groups, savedBot) => {
      if (savedBot?.faction !== "erebus" || !EREBUS_BOT_TYPES[savedBot.botType]) return groups;
      if (!groups[savedBot.botType]) groups[savedBot.botType] = [];
      groups[savedBot.botType].push(savedBot);
      return groups;
    }, {});
    hostileBots = defaultBots.map(defaultBot => {
      const savedBot = savedBotsByType[defaultBot.botType]?.shift() || {};
      const canRestoreSavedErebus = savedBot.faction === "erebus" && savedBot.botType === defaultBot.botType;
      // Bot patrol positions are transient. Starting from the canonical node
      // layout also migrates older upper-heavy saves into the balanced roster.
      const nodeId = defaultBot.currentNodeId;
      return {
        ...defaultBot,
        ...(canRestoreSavedErebus ? savedBot : {}),
        id: defaultBot.id,
        botType: defaultBot.botType,
        name: canRestoreSavedErebus ? (savedBot.name || savedBot.displayName || defaultBot.name) : defaultBot.name,
        displayName: canRestoreSavedErebus ? (savedBot.displayName || savedBot.name || defaultBot.displayName) : defaultBot.displayName,
        className: canRestoreSavedErebus ? (savedBot.className || defaultBot.className) : defaultBot.className,
        classRole: canRestoreSavedErebus ? (savedBot.classRole || defaultBot.classRole) : defaultBot.classRole,
        damage: Number(canRestoreSavedErebus ? (savedBot.damage || defaultBot.damage) : defaultBot.damage),
        currentNodeId: nodeId,
        node: nodeId,
        faction: "erebus",
        allegiance: "hostile_neutral",
        aggroState: canRestoreSavedErebus && ["neutral", "hostile", "returning", "defeated"].includes(savedBot.aggroState) ? savedBot.aggroState : defaultBot.aggroState,
        aggroUntil: canRestoreSavedErebus ? (savedBot.aggroUntil || null) : null,
        targetPlayerId: canRestoreSavedErebus ? (savedBot.targetPlayerId || null) : null,
        lastMovedAt: Number(canRestoreSavedErebus ? (savedBot.lastMovedAt || defaultBot.lastMovedAt) : defaultBot.lastMovedAt),
        moveIntervalMs: Number(canRestoreSavedErebus ? (savedBot.moveIntervalMs || defaultBot.moveIntervalMs) : defaultBot.moveIntervalMs),
        image: canRestoreSavedErebus ? (savedBot.image || defaultBot.image) : defaultBot.image,
        attackingUntil: 0
      };
    });
    hostileBots = enforceErebusSpawnCaps(hostileBots);
  }

  lootByNode = saved.lootByNode && typeof saved.lootByNode === "object" ? saved.lootByNode : {};
  inventoryItems = normalizeInventoryItems(saved.inventoryItems ?? inventoryItems);
  trimPrototypeInventoryItems();
  stationVaultWasClearedThisSession = clearStationVaultForShipyardIfNeeded(saved);
  marketStock = saved.marketStock ?? marketStock;

  if (saved.cargo) {
    mineralKeys.forEach(mineral => {
      cargo[mineral] = saved.cargo[mineral] ?? cargo[mineral];
    });
  }
  if (!saved.cargoRecovered) {
    mineralKeys.forEach(mineral => {
      if (Number(cargo[mineral] || 0) > 0 && !Number(cargoCostBasis?.[mineral] || 0)) {
        cargoRecovered[mineral] = Math.max(0, Math.round(Number(cargo[mineral] || 0)));
      }
    });
  }
  if (!saved.cargoPurchased) {
    MAP_ONE_TRADE_RESOURCES.forEach((good) => {
      const held = Math.max(0, Math.round(Number(cargo[good] || 0)));
      const recovered = Math.max(0, Math.round(Number(cargoRecovered?.[good] || 0)));
      const purchased = Math.max(0, held - recovered);
      if (purchased > 0) cargoPurchased[good] = purchased;
    });
  }
  if (typeof pruneMapOneCargoState === "function") pruneMapOneCargoState();
  if (typeof reconcileTradeCargoLedgers === "function") reconcileTradeCargoLedgers();
  else if (typeof pruneRecoveredCargoQuantities === "function") pruneRecoveredCargoQuantities();
  if (typeof ensureDailyTradeContracts === "function") ensureDailyTradeContracts();

  shieldEnabled = true;
  applyShipStats(false);

  if (jumpCharge < jumpMax) {
    startJumpRecharge();
  }

  if (shield < shieldMax) {
    scheduleShieldRegen();
  }

  if (typeof updateProgressDisplays === "function") updateProgressDisplays();
  if (typeof updateHudDock === "function") updateHudDock();
  if (typeof renderPilotProfile === "function" && document.getElementById("pilotProfileScreen")?.classList.contains("active")) {
    renderPilotProfile();
  }
  clearTransientStateAfterLoadedSave();
  if (typeof updateSpaceHUD === "function") updateSpaceHUD();
  if (typeof updateAsteroidUI === "function") updateAsteroidUI();
  if (typeof updateTargetPanel === "function") updateTargetPanel();
  if (typeof updateObjectActionPanel === "function") updateObjectActionPanel(false);
  if (typeof window.LupenMultiplayerOverlay?.render === "function") window.LupenMultiplayerOverlay.render();
  if (repairedMissingStarterShip) {
    console.warn("Repaired a progressed pilot save whose starter ship ownership was missing.");
    saveGame();
  }

  return true;
}

function loadGame() {
  return applyLoadedGameState(LupenSaveService.readJsonLocalStorage(STORAGE_GAME_KEY));
}

function isDebugToolsEnabled() {
  const params = new URLSearchParams(window.location.search);
  if (params.get("mp") === "staging") {
    return params.get("debug") === "tools" || params.get("debugTools") === "true";
  }
  return params.has("debug") || localStorage.getItem(LupenSaveService.storageKeys.debugTools) === "true";
}

function isStagingTestGrantEnabled() {
  const params = new URLSearchParams(window.location.search);
  const host = String(window.location.hostname || "").toLowerCase();
  const localHost = ["localhost", "127.0.0.1", "::1"].includes(host);
  const stagingUrl = params.get("mp") === "staging";
  const mpDebug = params.get("debug") === "mp";
  const stagingClient = window.LupenMultiplayerClient?.getStatus?.()?.enabledReason === "staging_enabled";
  return Boolean(stagingUrl || stagingClient || (localHost && mpDebug) || isDebugToolsEnabled());
}

function ensureLupenCoreCount(targetCount) {
  const target = Math.max(0, Math.floor(Number(targetCount || 0)));
  const current = Array.isArray(inventoryItems)
    ? inventoryItems.filter(item => item?.key === "lupenCore").length
    : 0;
  const missing = Math.max(0, target - current);
  for (let index = 0; index < missing; index += 1) {
    inventoryItems.push({
      id: `debug-core-${Date.now()}-${index}-${Math.random().toString(16).slice(2, 8)}`,
      key: "lupenCore",
      quality: typeof LUPEN_CORE_QUALITY !== "undefined" ? LUPEN_CORE_QUALITY : "core",
      level: 1,
      source: "staging_debug_grant"
    });
  }
  return current + missing;
}

function addLupenCores(quantity) {
  const total = Math.max(0, Math.floor(Number(quantity || 0)));
  for (let index = 0; index < total; index += 1) {
    inventoryItems.push({
      id: `debug-core-${Date.now()}-${index}-${Math.random().toString(16).slice(2, 8)}`,
      key: "lupenCore",
      quality: typeof LUPEN_CORE_QUALITY !== "undefined" ? LUPEN_CORE_QUALITY : "core",
      level: 1,
      source: "staging_debug_grant"
    });
  }
  return Array.isArray(inventoryItems)
    ? inventoryItems.filter(item => item?.key === "lupenCore").length
    : 0;
}

function refreshAfterStagingTestGrant(message) {
  if (typeof addActivityLog === "function") addActivityLog(message);
  if (typeof updateProgressDisplays === "function") updateProgressDisplays();
  if (typeof updateHudDock === "function") updateHudDock();
  if (typeof updateSpaceHUD === "function") updateSpaceHUD();
  if (typeof renderHangar === "function" && document.getElementById("hangarScreen")?.classList.contains("active")) renderHangar();
  if (typeof renderStore === "function" && document.getElementById("storeScreen")?.classList.contains("active")) renderStore();
  if (typeof renderUpgradeForge === "function" && document.getElementById("upgradeForgeScreen")?.classList.contains("active")) renderUpgradeForge();
  if (typeof window.LupenMultiplayerOverlay?.scheduleRender === "function") window.LupenMultiplayerOverlay.scheduleRender();
  saveGame();
}

function grantStagingTestFunds(options = {}) {
  if (!isStagingTestGrantEnabled()) {
    console.warn("Staging test funds grant blocked: debug/staging guard is not active.");
    return {
      ok: false,
      reason: "debug_guard_inactive"
    };
  }

  if (!Array.isArray(inventoryItems)) inventoryItems = [];
  upgradeMaterials = normalizeUpgradeMaterials(upgradeMaterials);

  const small = options?.small === true || options?.mode === "small";
  if (small) {
    credits = Math.max(0, Math.floor(Number(credits || 0))) + 100000;
    addLupenCores(10);
    upgradeMaterials.lupenShards = Math.max(0, Math.floor(Number(upgradeMaterials.lupenShards || 0))) + 100;
  } else {
    credits = Math.max(Math.max(0, Math.floor(Number(credits || 0))), 1000000);
    ensureLupenCoreCount(100);
    upgradeMaterials.lupenShards = Math.max(Math.max(0, Math.floor(Number(upgradeMaterials.lupenShards || 0))), 1000);
  }

  const coreCount = Array.isArray(inventoryItems)
    ? inventoryItems.filter(item => item?.key === "lupenCore").length
    : 0;
  const result = {
    ok: true,
    mode: small ? "small" : "full",
    credits,
    lupenCores: coreCount,
    lupenShards: Math.max(0, Math.floor(Number(upgradeMaterials.lupenShards || 0)))
  };
  refreshAfterStagingTestGrant(small ? "Granted small staging test funds." : "Granted staging test funds.");
  console.info("Granted staging test funds", result);
  return result;
}

window.lupenDebugGrantTestFunds = grantStagingTestFunds;

function refreshDebugToolsUI(message = "") {
  const status = document.getElementById("debugToolsStatus");
  if (status) status.textContent = message;
  if (typeof updateHudDock === "function") updateHudDock();
  if (typeof updateSpaceHUD === "function") updateSpaceHUD();
  if (typeof renderHangar === "function") renderHangar();
  if (typeof renderBountyBoard === "function") renderBountyBoard();
  if (typeof renderStore === "function") renderStore();
  if (typeof renderTradeTerminal === "function") renderTradeTerminal();
  saveGame();
}

function ensureDebugToolsPanel() {
  if (!isDebugToolsEnabled() || document.getElementById("debugToolsPanel")) return;

  const panel = document.createElement("div");
  panel.id = "debugToolsPanel";
  panel.className = "debug-tools-panel";
  panel.innerHTML = `
    <strong>Debug Tools</strong>
    <div class="debug-tools-grid">
      <button type="button" onclick="debugSkipTutorial()">Skip Tutorial</button>
      <button type="button" onclick="debugGrantStarter()">Starter Ship</button>
      <button type="button" onclick="debugGrantDemoWeapons()">Demo Weapons</button>
      <button type="button" onclick="debugGrantLupenCore()">Lupen Core</button>
      <button type="button" onclick="debugGrantCredits()">+50K CR</button>
      <button type="button" onclick="debugGrantTestFunds()">Grant Test Funds</button>
      <button type="button" onclick="debugOpenBounty()">Bounty Board</button>
      <button type="button" onclick="debugResetSave()">Reset Save</button>
    </div>
    <span id="debugToolsStatus"></span>
  `;
  document.body.appendChild(panel);
}

function debugGrantTestFunds() {
  const result = grantStagingTestFunds();
  refreshDebugToolsUI(result.ok ? "Granted staging test funds." : "Grant blocked.");
}

function debugSkipTutorial() {
  if (typeof finishStarterTutorial === "function") {
    finishStarterTutorial();
  } else {
    tutorialState.active = false;
    tutorialState.completed = true;
    if (typeof saveTutorialState === "function") saveTutorialState();
    if (typeof clearTutorialHighlight === "function") clearTutorialHighlight();
  }
  refreshDebugToolsUI("Tutorial complete.");
}

function debugGrantStarter() {
  const starterShipId = typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
  if (!ownedShips.includes(starterShipId)) ownedShips.push(starterShipId);
  currentShipId = starterShipId;
  selectedHangarShipId = starterShipId;
  selectedFleetShipId = starterShipId;
  selectedShipyardShipId = starterShipId;
  shipLoadouts[starterShipId] = normalizeShipLoadout(
    shipLoadouts[starterShipId] || { attachments: [], guns: [] },
    starterShipId
  );
  if (typeof applyShipStats === "function") applyShipStats(true);
  if (typeof recordMissionEvent === "function") {
    recordMissionEvent("starter_ship_claimed", { shipId: starterShipId, mode: "debug_grant" });
  } else if (typeof reconcileMissionProgressFromGameplayState === "function") {
    reconcileMissionProgressFromGameplayState({ source: "debug_starter_grant", notify: false });
  }
  jumpCharge = jumpMax;
  credits = Math.max(credits, 10000);
  if (typeof addHudToast === "function") addHudToast("Debug starter ship ready.");
  refreshDebugToolsUI("Starter ship ready.");
}

function debugGrantCredits() {
  credits += 50000;
  if (typeof addHudToast === "function") addHudToast("Debug credits added.");
  refreshDebugToolsUI("Added CR 50,000.");
}

function debugGrantLupenCore() {
  const added = addInventoryItem(createInventoryDrop("lupenCore"));
  if (typeof addHudToast === "function") addHudToast(added ? "Debug Lupen Core added." : INVENTORY_FULL_MESSAGE);
  refreshDebugToolsUI(added ? "Added 1 Lupen Core." : "Inventory full.");
}

function debugGrantDemoWeapons() {
  const demoWeapons = [
    createWeaponItem("pulseLaser", "standard"),
    createWeaponItem("repeater", "standard"),
    createWeaponItem("ionBlaster", "refined"),
    createWeaponItem("ripperGun", "advanced")
  ].filter(Boolean);

  demoWeapons.forEach(item => {
    if (item.rarityId === "standard") {
      if (canAddInventoryItems(1)) ownedGuns[item.familyId] = (ownedGuns[item.familyId] || 0) + 1;
    } else {
      addInventoryItem({
        id: item.uid,
        key: item.familyId,
        quality: item.rarityId
      });
    }
  });

  if (typeof addHudToast === "function") addHudToast("Debug demo weapons added.");
  refreshDebugToolsUI("Added demo weapons.");
}

function debugOpenBounty() {
  if (typeof hasActiveShip === "function" && !hasActiveShip()) debugGrantStarter();
  if (tutorialState?.active && typeof finishStarterTutorial === "function") finishStarterTutorial();
  if (typeof openBountyBoard === "function") openBountyBoard();
  refreshDebugToolsUI("Opened Bounty Board.");
}

function debugResetSave() {
  if (!confirm("Reset this browser save and reload Lupen?")) return;
  LupenSaveService.removeLocalStorage(STORAGE_GAME_KEY);
  LupenSaveService.removeLocalStorage(STORAGE_ACCOUNT_KEY);
  LupenSaveService.removeLocalStorage(LupenSaveService.storageKeys.tutorial);
  LupenSaveService.removeLocalStorage(STORAGE_VAULT_RESET_KEY);
  window.location.reload();
}

window.onload = async function () {
  const pilotResetResult = typeof handleStagingResetPilotParam === "function"
    ? await handleStagingResetPilotParam()
    : null;
  if (!pilotResetResult?.ok) {
    if (typeof handleStagingClearLocalSaveParam === "function") handleStagingClearLocalSaveParam();
    if (typeof handleStagingResetTutorialParam === "function") handleStagingResetTutorialParam();
  }
  loadGame();

  if (!homePlanet || !sectorNodes[homePlanet] || sectorNodes[homePlanet].type !== "planet") {
    homePlanet = "Asteron Prime";
  }

  if (!lastPlanetNode || !sectorNodes[lastPlanetNode] || sectorNodes[lastPlanetNode].type !== "planet") {
    lastPlanetNode = homePlanet;
  }

  updateCurrentNodeUI();
  updateSpaceHUD();
  updateAsteroidUI();
  updateTargetPanel();
  startHostileBotMovement();
  startHostileBotAttacks();
  if (stationVaultWasClearedThisSession) saveGame();
  showScreen("startScreen");
  ensureDebugToolsPanel();
  if (pilotResetResult?.ok && pilotResetResult.pilotId && typeof enterHubFromLogin === "function") {
    enterHubFromLogin();
    if (typeof startMorganAcademyOrientation === "function") {
      startMorganAcademyOrientation(pilotResetResult.pilotId);
    } else if (typeof startStarterTutorial === "function") {
      startStarterTutorial(true, { pilotId: pilotResetResult.pilotId });
    }
  } else if (typeof handleStagingStartTutorialParam === "function") {
    handleStagingStartTutorialParam();
  }
};

window.addEventListener("pagehide", saveGameBeforeLeave);
window.addEventListener("beforeunload", saveGameBeforeLeave);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveGame();
});


