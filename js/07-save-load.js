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

  const hostileBotPresent = hostileBots.some(bot => bot.alive && bot.node === currentNode);
  const hostileBotEngaged = engagedTarget?.type === "hostileBot" && engageTimer;
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
    dailyBountyDate,
    dailyBountyContracts,
    selectedBountyContractId,
    storeDailyPurchases,
    playerProgress
  };
}

function saveGame(options = {}) {
  localStorage.setItem(STORAGE_GAME_KEY, JSON.stringify(buildSaveState(options)));
}

function buildSaveExportPayload() {
  return {
    schema: SAVE_SCHEMA_ID,
    exportVersion: SAVE_EXPORT_VERSION,
    saveVersion: SAVE_VERSION,
    exportedAt: new Date().toISOString(),
    game: buildSaveState({ leaveSave: false }),
    account: safeParseLocalStorage(STORAGE_ACCOUNT_KEY),
    tutorial: safeParseLocalStorage("lupenStarterPilotTutorial")
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

  localStorage.setItem(STORAGE_GAME_KEY, JSON.stringify(migratedGame));

  if (payload.schema === SAVE_SCHEMA_ID) {
    if (payload.account && typeof payload.account === "object") {
      localStorage.setItem(STORAGE_ACCOUNT_KEY, JSON.stringify(payload.account));
    }
    if (payload.tutorial && typeof payload.tutorial === "object") {
      localStorage.setItem("lupenStarterPilotTutorial", JSON.stringify(payload.tutorial));
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

function loadGame() {
  const saved = migrateSavedGame(safeParseLocalStorage(STORAGE_GAME_KEY));
  if (!saved) return;

  credits = saved.credits ?? credits;
  playerProgress = normalizePlayerProgress(saved.playerProgress || playerProgress);
  cargoCostBasis = saved.cargoCostBasis ?? cargoCostBasis;

  ownedShips = Array.isArray(saved.ownedShips) ? saved.ownedShips.filter(shipId => SHIPS[shipId]) : ownedShips;
  currentShipId = SHIPS[saved.currentShipId] && ownedShips.includes(saved.currentShipId) ? saved.currentShipId : (ownedShips[0] || "");
  selectedHangarShipId = SHIPS[saved.selectedHangarShipId] ? saved.selectedHangarShipId : (currentShipId || "lupenOrigin");
  selectedFleetShipId = SHIPS[saved.selectedFleetShipId] ? saved.selectedFleetShipId : (currentShipId || "lupenOrigin");
  shipLoadouts = saved.shipLoadouts && typeof saved.shipLoadouts === "object" ? saved.shipLoadouts : shipLoadouts;
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
  storeDailyPurchases = saved.storeDailyPurchases && typeof saved.storeDailyPurchases === "object" ? saved.storeDailyPurchases : storeDailyPurchases;
  pruneStoreDailyPurchases();
  ensureDailyBounties();
  if (saved.activeObjective?.type === "bounty") {
    const savedArea = saved.activeObjective.targetArea || DAILY_BOUNTY_CONTRACTS.find(item => item.id === saved.activeObjective.contractId)?.targetArea || "anyHostile";
    activeObjective = {
      ...saved.activeObjective,
      targetArea: savedArea,
      targetLabel: saved.activeObjective.targetLabel || getBountyAreaLabel(savedArea),
      targetNode: undefined,
      kills: Number(saved.activeObjective.kills || 0),
      killsRequired: Number(saved.activeObjective.killsRequired || 1),
      reward: Number(saved.activeObjective.reward || 0),
      status: saved.activeObjective.status || "active"
    };
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
  shield = Number.isFinite(Number(saved.shield)) ? Number(saved.shield) : shield;
  shieldEnabled = true;
  jumpCharge = Number.isFinite(Number(saved.jumpCharge)) ? Number(saved.jumpCharge) : jumpCharge;

  const loadedStats = getShipStats(currentShipId);
  if (!Number.isFinite(hull) || hull <= 0 || !Number.isFinite(hullMax) || hullMax <= 0) hull = loadedStats.hull;
  if (!Number.isFinite(shield) || shield < 0 || !Number.isFinite(shieldMax) || shieldMax < 0) shield = loadedStats.shield;
  // Map 1 has no asteroids; old saved asteroid targets are ignored.
  asteroids = [];

  if (Array.isArray(saved.hostileBots) && saved.hostileBots.length) {
    const defaultBots = createInitialHostileBots();
    hostileBots = defaultBots.map((defaultBot, index) => {
      const savedBot = saved.hostileBots[index] || {};
      return {
        ...defaultBot,
        ...savedBot,
        attackingUntil: 0,
        node: sectorNodes[savedBot.node] && sectorNodes[savedBot.node].danger === "hostile" ? savedBot.node : defaultBot.node,
        image: MANTA_BOT_ASSET,
      attackingUntil: 0
      };
    });
  }

  // Starter map no longer uses asteroid salvage; old loose salvage is cleared.
  lootByNode = {};
  inventoryItems = normalizeInventoryItems(saved.inventoryItems ?? inventoryItems);
  trimPrototypeInventoryItems();
  stationVaultWasClearedThisSession = clearStationVaultForShipyardIfNeeded();
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
};

window.addEventListener("pagehide", saveGameBeforeLeave);
window.addEventListener("beforeunload", saveGameBeforeLeave);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveGame();
});


