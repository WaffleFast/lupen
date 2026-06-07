/* Save / load */

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
    cargoCostBasis,
    currentNode: savedCurrentNode,
    lastPlanetNode: savedLastPlanetNode,
    homePlanet,
    installedAttachments,
    ownedAttachments,
    ownedGuns,
    shipLoadouts,
    selectedHangarShipId,
    selectedFleetShipId,
    currentShipId,
    ownedShips,
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
    activeBountyId,
    dailyBountyDate,
    dailyBountyContracts,
    selectedBountyContractId,
    storeDailyPurchases,
    upgradeMaterials,
    playerProgress
  };
}

function saveGame(options = {}) {
  const state = buildSaveState(options);
  LupenSaveService.writeJsonLocalStorage(STORAGE_GAME_KEY, state);
  queueSupabaseSave(state);
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

function queueSupabaseSave(state) {
  if (!state || !window.lupenSupabase) {
    setSaveStatus("local");
    return;
  }

  setSaveStatus("saving");
  saveGameToSupabase(state).then(saved => {
    setSaveStatus(saved ? "cloud" : "local");
  }).catch(error => {
    console.warn("Supabase save failed. Local save is still intact.", error);
    setSaveStatus("cloud-failed");
  });
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
  const liveJumpCharge = Number.isFinite(Number(jumpCharge)) ? Number(jumpCharge) : null;
  let loadResult = null;
  let loadError = "";

  try {
    if (typeof loadGameFromSupabase === "function") {
      loadResult = await loadGameFromSupabase();
      if (Number.isFinite(liveJumpCharge) && Number(jumpCharge) < liveJumpCharge) {
        jumpCharge = liveJumpCharge;
        if (typeof updateSpaceHUD === "function") updateSpaceHUD();
      }
    }
  } catch (error) {
    loadError = error?.message || "cloud_refresh_failed";
  }

  const afterLoad = getCurrentCombatXpSnapshot();
  const cloudXp = Math.max(
    Number(loadResult?.combatXp || 0),
    Number(loadResult?.zoneCombatXp || 0),
    afterLoad.combatXp,
    afterLoad.zoneCombatXp
  );
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
    reason: loadError || (applied ? "combat_refresh_applied" : matched ? "combat_refresh_matched" : "combat_refresh_no_change"),
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
  if (!applied || !Number.isFinite(xpAfter)) return false;

  const xpSource = result.xpSource || result.source || (result.botId ? "botKill" : "bountyClaim");
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
  window.lupenLastStagingXpRefresh = {
    source: xpSource,
    stale: false,
    trustedXpAfter: xpAfter,
    refreshedXp: progress.combatXp,
    appliedXp: playerProgress.combatXp,
    hudXpAfterPatch: playerProgress.combatXp,
    redrawTriggered: true,
    reason: "hud_xp_refreshed",
    checkedAt: Date.now()
  };
  LupenSaveService.writeJsonLocalStorage(STORAGE_GAME_KEY, buildSaveState({ leaveSave: false }));
  redrawProgressAfterStagingXp();
  return true;
}

window.applyStagingXpClaimToLoadedState = applyStagingXpClaimToLoadedState;
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

function hasMeaningfulLocalSave(saved = getLocalSavePayloadForCloudMigration()) {
  if (!saved) return false;

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
  const hasDifferentCredits = Number(saved.credits || 0) !== 10000;

  return Boolean(
    hasNonStarterShip ||
    (!hasOnlyDefaultStarterShip && ownedShipIds.length > 0) ||
    hasProgressTotals ||
    hasCombatXp ||
    hasCargo ||
    hasInventory ||
    hasOwnedGuns ||
    hasOwnedAttachments ||
    hasTradeOrBounty ||
    hasDifferentCredits
  );
}

async function uploadLocalSavePayloadToSupabase(localSavePayload) {
  const auth = await getAuthenticatedSupabaseUser();
  if (!auth || !localSavePayload) return false;
  await saveGameStateToSupabaseForUser(auth.client, auth.user, localSavePayload);
  return true;
}

function promptUploadLocalSaveToSupabase() {
  return new Promise(resolve => {
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
        <p>Upload this save to your account?</p>
        <div class="reward-modal-actions">
          <button id="uploadLocalSaveBtn" type="button">Upload Local Save</button>
          <button id="skipLocalSaveUploadBtn" class="secondary" type="button">Continue Without Uploading</button>
        </div>
      </div>
    `;

    const close = decision => {
      overlay.classList.remove("active");
      resolve(decision);
    };

    overlay.querySelector("#uploadLocalSaveBtn")?.addEventListener("click", () => close("upload"), { once: true });
    overlay.querySelector("#skipLocalSaveUploadBtn")?.addEventListener("click", () => close("skip"), { once: true });
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
    tutorial: LupenSaveService.readJsonLocalStorage("lupenStarterPilotTutorial")
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
      LupenSaveService.writeJsonLocalStorage("lupenStarterPilotTutorial", payload.tutorial);
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

function applyLoadedGameState(rawSaved) {
  const saved = migrateSavedGame(rawSaved);
  if (!saved) return false;

  credits = saved.credits ?? credits;
  playerProgress = normalizePlayerProgress(saved.playerProgress || playerProgress);
  applyTrustedStagingXpIfNewer("loadGameFromSupabase");
  upgradeMaterials = normalizeUpgradeMaterials(saved.upgradeMaterials);
  cargoCostBasis = saved.cargoCostBasis ?? cargoCostBasis;

  const starterShipId = typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
  ownedShips = Array.isArray(saved.ownedShips) ? saved.ownedShips.filter(shipId => SHIPS[shipId]) : ownedShips;
  if (!ownedShips.length && SHIPS[starterShipId]) ownedShips = [starterShipId];
  currentShipId = SHIPS[saved.currentShipId] && ownedShips.includes(saved.currentShipId) ? saved.currentShipId : (ownedShips[0] || starterShipId);
  selectedHangarShipId = SHIPS[saved.selectedHangarShipId] ? saved.selectedHangarShipId : (currentShipId || starterShipId);
  selectedFleetShipId = SHIPS[saved.selectedFleetShipId] ? saved.selectedFleetShipId : (currentShipId || starterShipId);
  shipLoadouts = saved.shipLoadouts && typeof saved.shipLoadouts === "object" ? saved.shipLoadouts : shipLoadouts;
  if (currentShipId && !shipLoadouts[currentShipId]) shipLoadouts[currentShipId] = normalizeShipLoadout(undefined, currentShipId);
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

  if (!shipLoadouts[currentShipId]) {
    shipLoadouts[currentShipId] = normalizeShipLoadout(undefined, currentShipId);
  }

  hull = Number.isFinite(Number(saved.hull)) ? Number(saved.hull) : hull;
  armor = Number.isFinite(Number(saved.armor)) ? Number(saved.armor) : armor;
  shield = Number.isFinite(Number(saved.shield)) ? Number(saved.shield) : shield;
  shieldEnabled = true;
  jumpCharge = Number.isFinite(Number(saved.jumpCharge)) ? Number(saved.jumpCharge) : jumpCharge;

  const loadedStats = getShipStats(currentShipId);
  if (!Number.isFinite(hull) || hull <= 0 || !Number.isFinite(hullMax) || hullMax <= 0) hull = loadedStats.hull;
  if (!Number.isFinite(shield) || shield < 0 || !Number.isFinite(shieldMax) || shieldMax < 0) shield = loadedStats.shield;
  asteroids = normalizeAsteroidCollection(saved.asteroids);

  if (Array.isArray(saved.hostileBots) && saved.hostileBots.length) {
    const defaultBots = createInitialHostileBots();
    hostileBots = defaultBots.map((defaultBot, index) => {
      const savedBot = saved.hostileBots[index] || {};
      const canRestoreSavedErebus = savedBot.faction === "erebus" && EREBUS_BOT_TYPES[savedBot.botType];
      const restoredNode = savedBot.currentNodeId || savedBot.node;
      const nodeId = canRestoreSavedErebus && isAllowedErebusBotNode(restoredNode) ? restoredNode : defaultBot.currentNodeId;
      return {
        ...defaultBot,
        ...(canRestoreSavedErebus ? savedBot : {}),
        botType: canRestoreSavedErebus ? savedBot.botType : defaultBot.botType,
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
  return params.has("debug") || localStorage.getItem("lupenDebugTools") === "true";
}

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
      <button type="button" onclick="debugOpenBounty()">Bounty Board</button>
      <button type="button" onclick="debugResetSave()">Reset Save</button>
    </div>
    <span id="debugToolsStatus"></span>
  `;
  document.body.appendChild(panel);
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
  shipLoadouts[starterShipId] = normalizeShipLoadout(shipLoadouts[starterShipId], starterShipId);
  if (typeof grantStarterShipKit === "function") grantStarterShipKit();
  if (typeof applyShipStats === "function") applyShipStats(true);
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
  LupenSaveService.removeLocalStorage("lupenStarterPilotTutorial");
  LupenSaveService.removeLocalStorage(STORAGE_VAULT_RESET_KEY);
  window.location.reload();
}

window.onload = function () {
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
};

window.addEventListener("pagehide", saveGameBeforeLeave);
window.addEventListener("beforeunload", saveGameBeforeLeave);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveGame();
});


