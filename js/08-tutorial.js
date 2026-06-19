/* ===== Starter Pilot Programme tutorial ===== */
const TUTORIAL_STORAGE_KEY = "lupenStarterPilotTutorial";
const TUTORIAL_NARRATOR_LABEL = "Station AI";
const TUTORIAL_TRADE_ROUTE = Object.freeze({
  origin: "Asteron Prime",
  good: "Iron",
  destination: "Virella"
});
let tutorialState = loadTutorialState();
let tutorialAdvanceTimeout = null;

const STARTER_TUTORIAL_STEPS = [
  {
    id: "welcome-new-pilot",
    title: "Welcome, Pilot",
    speaker: TUTORIAL_NARRATOR_LABEL,
    voiceCue: "tutorial_intro_welcome",
    text: "Welcome, Pilot. Your path through Lupen starts here. Trade when you need credits, fight when you are ready to prove yourself, upgrade your gear, and keep moving until the stars begin to feel within reach.",
    target: "#tutorialNextBtn",
    event: null,
    actionLabel: "Begin",
    manualOnly: true,
    intro: true
  },
  {
    id: "open-hangar-first-ship",
    title: "Open Hangar Bay",
    text: "Open Hangar Bay. We will confirm your Azure Striker and inspect the systems that carry you through the first route.",
    target: ".hub-actions button[onclick='openHangar()']",
    event: "openedHangar"
  },
  {
    id: "buy-first-ship",
    title: "Claim Azure Striker",
    text: "Claim Azure Striker if she is waiting in the Vessel Exchange. If she is already active, I will move us forward.",
    target: "tutorial:firstShipBuy",
    event: "boughtFirstShip"
  },
  {
    id: "open-first-loadout",
    title: "Open Loadout",
    text: "Open Loadout. This is where your ship carries weapons, equipment, hull condition, and every upgrade that keeps you alive longer.",
    target: "tutorial:hangarLoadoutTab",
    event: "openedHangarLoadout"
  },
  {
    id: "return-after-first-loadout",
    title: "Return to station",
    text: "Return to the station hub. First objective: a trade run. Trading is the safest way to build the credits that open new routes.",
    target: "#hangarScreen .screen-back-btn",
    event: "returnedToHub",
    place: "left"
  },
  {
    id: "open-trade",
    title: "Open Trade Terminal",
    text: "Open the Trade Terminal. A good pilot does not just move cargo. They read the market.",
    target: "tutorial:planetTradeTerminal",
    event: "openedTradeTerminal"
  },
  {
    id: "select-market-resource",
    title: "Select a resource",
    text: "Buy where supply is cheap. Sell where demand is hungry. Select Iron on the Market Board.",
    target: "tutorial:marketResourceIron",
    event: "selectedMarketResource"
  },
  {
    id: "select-market-target",
    title: "Choose destination",
    text: "Confirm Virella as the target planet. Asteron Prime sells Iron cheap; Virella pays more.",
    target: "tutorial:marketTarget",
    event: "selectedMarketTarget"
  },
  {
    id: "select-buy-amount",
    title: "Choose buy amount",
    text: "Press MAX. We will fill the run using your credits and free cargo space.",
    target: "tutorial:buyAmount",
    event: "selectedBuyAmount"
  },
  {
    id: "buy-cargo",
    title: "Buy cargo",
    text: "Buy the marked cargo. I will keep the route objective active until the Iron is sold.",
    target: "tutorial:buyCargo",
    event: "boughtTradeCargo"
  },
  {
    id: "return-to-station-for-launch",
    title: "Back to station",
    text: "Return to the station hub, then take Azure Striker into orbit.",
    target: "#marketScreen .screen-back-btn",
    event: "returnedToHub",
    place: "left"
  },
  {
    id: "launch",
    title: "Launch into orbit",
    text: "Launch your ship. Your market route will stay locked while you travel.",
    target: ".hub-launch-btn",
    event: "launched"
  },
  {
    id: "map-route",
    title: "Open the sector map",
    text: "Open Jump and follow the highlighted route. The objective stays active until the Iron is sold.",
    target: "#jumpBtn",
    event: "openedSectorMap"
  },
  {
    id: "make-jump",
    title: "Continue route",
    text: "After each jump, let the Jump bar recharge. Follow the highlighted route and keep the run clean.",
    target: "dynamicTradeRoute",
    event: "jumpedNode"
  },
  {
    id: "land-destination",
    title: "Land at destination",
    text: "You are in Virella orbit. Click the pulsing planet landing target to dock and sell.",
    target: "#planetLandBtn",
    event: "landedOnPlanet",
    place: "left"  },
  {
    id: "open-trade-to-sell",
    title: "Open Trade Terminal",
    text: "Open the Trade Terminal and sell the cargo you carried here.",
    target: "tutorial:planetTradeTerminal",
    event: "openedTradeTerminal"
  },
  {
    id: "sell-cargo",
    title: "Sell cargo",
    text: "Sell the Iron. The profit is yours, and every clean run brings the Buu Hauler closer.",
    target: "tutorial:sellCargo",
    event: "soldTradeCargo"
  },
  {
    id: "return-after-trade",
    title: "Return to station",
    text: "Return to the station hub. Next objective: buy a weapon so combat can start paying XP and bounty rewards.",
    target: "#marketScreen .screen-back-btn",
    event: "returnedToHub",
    place: "left"
  },
  {
    id: "open-store",
    title: "Open Store",
    text: "Open the Store if you still need a starter weapon. Better weapons let you take greater risks and survive the contracts that follow.",
    target: ".hub-actions button[onclick='openStore()']",
    event: "openedStore"
  },
  {
    id: "buy-equipment",
    title: "Buy first weapon",
    text: "Buy a Pulse Laser if one is not already in your hold or mounted on Azure Striker. It is reliable enough for your first bounty.",
    target: "tutorial:storePulseLaser",
    event: "boughtStoreGun"
  },
  {
    id: "return-after-store",
    title: "Return to station",
    text: "Return to the station hub, then open Hangar Bay to fit your new weapon.",
    target: "#storeScreen .screen-back-btn",
    event: "returnedToHub",
    place: "left"
  },
  {
    id: "open-hangar-equip",
    title: "Open Hangar Bay",
    text: "Open Hangar Bay. Loadout changes happen here, and fitted gear stays with your ship.",
    target: ".hub-actions button[onclick='openHangar()']",
    event: "openedHangar"
  },
  {
    id: "equip-item",
    title: "Equip weapon",
    text: "Fit the Pulse Laser into an open weapon slot if needed. If your starter weapons are already online, we continue.",
    target: "tutorial:spareWeapon",
    event: "equippedItem"
  },
  {
    id: "return-after-equip",
    title: "Return to station",
    text: "Return to the station hub. Next objective: accept a bounty and turn combat into XP, credits, and upgrade rewards.",
    target: "#hangarScreen .screen-back-btn",
    event: "returnedToHub",
    place: "left"
  },
  {
    id: "open-bounty",
    title: "Open Bounty Board",
    text: "Open the Bounty Board and choose a starter contract. Bounties give your weapons a purpose.",
    target: ".hub-actions button[onclick='openBountyBoard()']",
    event: "openedBountyBoard"
  },
  {
    id: "accept-bounty",
    title: "Accept bounty",
    text: "Accept a bounty. Combat earns XP, credits, and materials that will matter more with every upgrade.",
    target: ".bounty-detail-panel button, .bounty-action-btn",
    event: "acceptedBounty"
  },
  {
    id: "return-for-combat-launch",
    title: "Back to station",
    text: "Return to the station hub. From there, you will launch and move toward hostile space.",
    target: "#bountyScreen .screen-back-btn",
    event: "returnedToHub",
    place: "left"
  },
  {
    id: "launch-for-combat",
    title: "Launch for combat",
    text: "Launch your ship. Your bounty objective will stay active in orbit.",
    target: ".hub-launch-btn",
    event: "launched"
  },
  {
    id: "open-map-for-bounty",
    title: "Open sector map",
    text: "Wait for your Jump bar, then click Jump to open the sector map.",
    target: "#jumpBtn",
    event: "openedSectorMap"
  },
  {
    id: "scan-for-bots",
    title: "Scan for bots",
    text: "Use the Bots scan. Hostile signals are easier to face when you see them first.",
    target: "#sectorScanBotsBtn",
    event: "scannedBots",
    place: "left"
  },
  {
    id: "jump-to-bounty-zone",
    title: "Move to hostile space",
    text: "Follow the highlighted route toward a hostile bot signal. Recharge your Jump bar between jumps.",
    target: "tutorial:bountyRoute",
    event: "jumpedNode",
    place: "left"  },
  {
    id: "destroy-bot",
    title: "Destroy the bounty bots",
    text: "Use Jump, Bots scan, and ENGAGE as needed. Destroy the target, gain XP, and push the bounty forward.",
    target: "tutorial:destroyBountyBot",
    event: ["destroyedBountyBot", "openedSectorMap", "scannedBots", "jumpedNode"],
    place: "left"
  },
  {
    id: "open-map-return-bounty",
    title: "Return to a planet",
    text: "Bounty complete. Open the sector map and return to a planet; rewards are claimed while docked.",
    target: "tutorial:bountyClaimReturn",
    event: ["openedSectorMap", "landedOnPlanet"],
    place: "left"  },
  {
    id: "return-to-planet-after-bounty",
    title: "Jump back to station space",
    text: "Follow the route back to the nearest planet. Keep the ship steady and let the Jump bar recharge between jumps.",
    target: "tutorial:bountyReturnRoute",
    event: ["jumpedNode", "landedOnPlanet"],
    place: "left"  },
  {
    id: "land-after-bounty",
    title: "Land at the planet",
    text: "Use Jump until you reach a planet, then land and return to the station hub.",
    target: "tutorial:bountyLanding",
    event: "landedOnPlanet",
    place: "left"  },
  {
    id: "open-bounty-to-claim",
    title: "Open Bounty Board",
    text: "Open the Bounty Board and claim what you earned.",
    target: ".hub-actions button[onclick='openBountyBoard()'], #bountyBoardHubBtn",
    event: "openedBountyBoard"
  },
  {
    id: "claim-bounty",
    title: "Claim bounty reward",
    text: "Claim your completed bounty. Combat payouts include credits, XP, Lupen Shards, and Lupen Cores.",
    target: "tutorial:claimBountyReward",
    event: ["openedBountyBoard", "claimedBountyReward"]
  },
  {
    id: "continue-after-bounty-reward",
    title: "Reward claimed",
    text: "Press Continue, then return to the station hub. The Lupen Core you claimed is your first Forge catalyst.",
    target: "#bountyRewardOverlay button, .reward-overlay button",
    event: "closedBountyReward",
    place: "left"
  },
  {
    id: "return-after-bounty-claim",
    title: "Back to station",
    text: "Leave the Bounty Board and return to the station hub. You have earned enough to learn the Forge.",
    target: "#bountyScreen .screen-back-btn",
    event: "returnedToHub",
    place: "left"
  },
  {
    id: "open-forge",
    title: "Open Forge",
    text: "Open the Forge. Lupen Cores improve equipment quality; for now, we will upgrade your Pulse Laser once and keep the lesson clean.",
    target: ".hub-actions button[onclick='openUpgradeForge()']",
    event: "openedForge"
  },
  {
    id: "forge-upgrade-weapon",
    title: "Upgrade Pulse Laser",
    text: "Start the Quality Upgrade. Your Pulse Laser will advance beyond Standard and remain fitted to your loadout.",
    target: "tutorial:forgeUpgradeButton",
    event: "upgradedTutorialWeapon"
  },
  {
    id: "return-after-forge",
    title: "Back to station",
    text: "Forge complete. Return to the station hub. Before the starter route ends, we will check your ship after combat.",
    target: "#upgradeForgeScreen .screen-back-btn",
    event: "returnedToHub",
    place: "left"
  },
  {
    id: "repair-reminder",
    title: "Repair check",
    text: "Open Hangar after combat and check hull and shield condition. Repair before risky launches if your hull took damage.",
    target: ".hub-actions button[onclick='openHangar()']",
    event: "openedHangar"
  },
  {
    id: "complete",
    title: "Programme Complete",
    speaker: TUTORIAL_NARRATOR_LABEL,
    voiceCue: "tutorial_outro_complete",
    text: "Starter route complete. Run trades to save for the Buu Hauler, take bounties for XP and upgrade rewards, strengthen weapons through the Forge, and work toward Combat Level 2. The Nightshade Hawk waits for pilots who prove they are ready.",
    target: "#tutorialNextBtn",
    event: null,
    actionLabel: "Begin your journey",
    manualOnly: true,
    outro: true
  }
];

function loadTutorialState() {
  const parsed = safeParseLocalStorage(TUTORIAL_STORAGE_KEY, {});
  return {
    active: Boolean(parsed.active),
    completed: Boolean(parsed.completed),
    stepIndex: Math.max(0, Number(parsed.stepIndex || 0)),
    lastStartedAt: parsed.lastStartedAt || null
  };
}

function saveTutorialState() {
  localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(tutorialState));
}

function getCurrentTutorialStep() {
  return STARTER_TUTORIAL_STEPS[Math.min(tutorialState.stepIndex, STARTER_TUTORIAL_STEPS.length - 1)];
}

function getStarterShipId() {
  return typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
}

function getTutorialShipLoadout(shipId = currentShipId || getStarterShipId()) {
  return typeof getShipLoadout === "function"
    ? getShipLoadout(shipId)
    : (shipLoadouts?.[shipId] || { attachments: [], guns: [] });
}

function tutorialEntryKey(entry) {
  return typeof getEquipmentKey === "function" ? getEquipmentKey(entry) : (typeof entry === "string" ? entry : entry?.key);
}

function hasTutorialPulseLaserEquipped() {
  return Object.values(shipLoadouts || {}).some(loadout =>
    (loadout?.guns || []).some(entry => tutorialEntryKey(entry) === "pulseLaser")
  );
}

function hasTutorialPulseLaserAvailable() {
  return hasTutorialPulseLaserEquipped() ||
    Number(ownedGuns?.pulseLaser || 0) > 0 ||
    (Array.isArray(inventoryItems) && inventoryItems.some(item => item?.key === "pulseLaser"));
}

function hasTutorialCombatWeaponEquipped() {
  return Object.values(shipLoadouts || {}).some(loadout => (loadout?.guns || []).length > 0);
}

function hasOpenTutorialWeaponSlot() {
  const shipId = currentShipId || getStarterShipId();
  const loadout = getTutorialShipLoadout(shipId);
  const limit = typeof getGunSlotLimit === "function" ? getGunSlotLimit(shipId) : 0;
  return (loadout.guns || []).length < limit;
}

function hasCompletedTutorialTrade() {
  const totals = playerProgress?.totals || {};
  return Number(totals.tradeProfit || totals.totalTradingProfit || 0) > 0 ||
    Number(totals.tradesCompleted || 0) > 0;
}

function hasTutorialTradeCargo() {
  const objective = typeof getActiveObjective === "function" ? getActiveObjective() : activeObjective;
  return Boolean(
    activeTradeRoute?.marketTrade && Number(cargo?.[activeTradeRoute.good] || 0) > 0 ||
    objective?.type === "trade" && Number(cargo?.[objective.good] || 0) > 0 ||
    typeof cargoUsed === "function" && cargoUsed() > 0
  );
}

function isTutorialTradeSelectionReady() {
  const currentPlanet = typeof getCurrentMarketPlanet === "function" ? getCurrentMarketPlanet() : currentNode;
  return selectedMarketResource === TUTORIAL_TRADE_ROUTE.good &&
    selectedMarketTargetPlanet === TUTORIAL_TRADE_ROUTE.destination &&
    currentPlanet === TUTORIAL_TRADE_ROUTE.origin &&
    Number(selectedMarketQuantity || 0) > 0;
}

function isTutorialGuaranteedTradeStep(stepId = getCurrentTutorialStep()?.id) {
  return [
    "select-market-resource",
    "select-market-target",
    "select-buy-amount",
    "buy-cargo",
    "return-to-station-for-launch",
    "launch",
    "map-route",
    "make-jump",
    "land-destination",
    "open-trade-to-sell",
    "sell-cargo"
  ].includes(stepId);
}

function shouldUseLocalTutorialTrade() {
  if (!tutorialState?.active) return false;
  if (hasCompletedTutorialTrade()) return false;
  const step = getCurrentTutorialStep();
  if (!isTutorialGuaranteedTradeStep(step?.id)) return false;
  return true;
}

function prepareTutorialTradeSelection() {
  if (hasTutorialTradeCargo() || hasCompletedTutorialTrade()) return;
  const currentPlanet = typeof getCurrentMarketPlanet === "function" ? getCurrentMarketPlanet() : currentNode;
  if (currentPlanet !== TUTORIAL_TRADE_ROUTE.origin) return;
  const buy = typeof getMapOneMarketPrice === "function" ? getMapOneMarketPrice(TUTORIAL_TRADE_ROUTE.good, currentPlanet) : 0;
  const sell = typeof getMapOneMarketPrice === "function" ? getMapOneMarketPrice(TUTORIAL_TRADE_ROUTE.good, TUTORIAL_TRADE_ROUTE.destination) : 0;
  if (buy <= 0 || sell <= buy || Number(credits || 0) < buy) return;
  selectedMarketResource = TUTORIAL_TRADE_ROUTE.good;
  selectedMarketTargetPlanet = TUTORIAL_TRADE_ROUTE.destination;
  if (["select-buy-amount", "buy-cargo"].includes(getCurrentTutorialStep()?.id)) {
    const limit = typeof getMarketMaxBuyQuantity === "function" ? getMarketMaxBuyQuantity(TUTORIAL_TRADE_ROUTE.good, currentPlanet) : 1;
    selectedMarketQuantity = Math.max(1, Math.min(Number(selectedMarketQuantity || 1), Math.max(1, limit)));
  }
}

function isTutorialBountyReadyToClaim() {
  return activeObjective?.type === "bounty" && activeObjective.status === "readyToClaim" ||
    dailyBountyContracts?.some?.(contract => contract.status === "readyToClaim");
}

function isTutorialBountyAccepted() {
  if (typeof ensureTutorialBountyFallbackObjective === "function" && ensureTutorialBountyFallbackObjective()) return true;
  const stagingBounty = typeof getActiveMultiplayerStagingBountyObjective === "function"
    ? getActiveMultiplayerStagingBountyObjective()
    : null;
  return activeObjective?.type === "bounty" ||
    dailyBountyContracts?.some?.(contract => contract.status === "active" || contract.status === "readyToClaim") ||
    Boolean(stagingBounty?.accepted || stagingBounty?.claimAvailable || stagingBounty?.completed);
}

function isAtTutorialBountyCombatTarget() {
  if (typeof isAtActiveBountyCombatNode === "function" && isAtActiveBountyCombatNode()) return true;

  const stagingBounty = typeof getActiveMultiplayerStagingBountyObjective === "function"
    ? getActiveMultiplayerStagingBountyObjective()
    : null;
  if (!stagingBounty?.accepted || stagingBounty.claimAvailable || stagingBounty.completed) return false;

  const visibleStagingBots = typeof getVisibleStagingBotTargets === "function"
    ? getVisibleStagingBotTargets()
    : [];
  if (visibleStagingBots.some(bot => bot?.alive && (bot.currentNodeId || bot.node) === currentNode)) return true;

  const stagingTarget = typeof getMultiplayerStagingBountyTargetNode === "function"
    ? getMultiplayerStagingBountyTargetNode()
    : null;
  return Boolean(stagingTarget && stagingTarget === currentNode);
}

function isTutorialForgeComplete() {
  return typeof hasTutorialPulseLaserQualityUpgrade === "function" && hasTutorialPulseLaserQualityUpgrade();
}

function getTutorialStateCompletionReason(step) {
  if (!step) return "";
  const starterShipId = getStarterShipId();
  switch (step.id) {
    case "buy-first-ship":
      return currentShipId === starterShipId && ownedShips.includes(starterShipId) ? "starter_ship_active" : "";
    case "select-market-resource":
    case "select-market-target":
    case "select-buy-amount":
      return hasTutorialTradeCargo() || hasCompletedTutorialTrade() ? "trade_cargo_already_loaded" : "";
    case "buy-cargo":
      return hasTutorialTradeCargo() || hasCompletedTutorialTrade() ? "trade_cargo_already_loaded" : "";
    case "make-jump":
      return hasCompletedTutorialTrade() || isAtActiveTradeDestination() ? "trade_destination_reached" : "";
    case "land-destination":
      return hasCompletedTutorialTrade() || isLandedAtActiveTradeDestination() ? "trade_destination_landed" : "";
    case "open-trade-to-sell":
      return hasCompletedTutorialTrade() ? "trade_already_completed" : document.getElementById("marketScreen")?.classList.contains("active") ? "trade_terminal_open" : "";
    case "sell-cargo":
      return hasCompletedTutorialTrade() ? "trade_already_completed" : "";
    case "open-store":
    case "buy-equipment":
    case "return-after-store":
      return hasTutorialPulseLaserAvailable() || hasTutorialCombatWeaponEquipped() ? "starter_weapon_available" : "";
    case "open-hangar-equip":
    case "equip-item":
    case "return-after-equip":
      if (hasTutorialPulseLaserEquipped()) return "pulse_laser_equipped";
      if (!hasOpenTutorialWeaponSlot() && hasTutorialCombatWeaponEquipped()) return "weapon_slots_already_filled";
      return "";
    case "accept-bounty":
      return isTutorialBountyAccepted() ? "bounty_already_active" : "";
    case "jump-to-bounty-zone":
      return isAtTutorialBountyCombatTarget() ? "bounty_target_reached" : "";
    case "destroy-bot":
    case "open-map-return-bounty":
    case "return-to-planet-after-bounty":
    case "land-after-bounty":
      return isTutorialBountyReadyToClaim() ? "bounty_ready_to_claim" : "";
    case "claim-bounty":
    case "continue-after-bounty-reward":
      return !activeObjective && Number(playerProgress?.totals?.bountiesClaimed || 0) > 0 ? "bounty_already_claimed" : "";
    case "forge-upgrade-weapon":
      return isTutorialForgeComplete() ? "pulse_laser_already_upgraded" : "";
    default:
      return "";
  }
}

function advanceTutorialStepFromState(reason) {
  const step = getCurrentTutorialStep();
  console.info("[Lupen tutorial] Auto-completed step from current state.", {
    step: step?.id,
    reason
  });
  tutorialState.stepIndex = Math.min(STARTER_TUTORIAL_STEPS.length - 1, tutorialState.stepIndex + 1);
  saveTutorialState();
}

function reconcileTutorialStepWithCurrentState() {
  if (!tutorialState.active) return;
  for (let guard = 0; guard < STARTER_TUTORIAL_STEPS.length; guard += 1) {
    const step = getCurrentTutorialStep();
    if (["open-trade-to-sell", "sell-cargo"].includes(step?.id) && isAtActiveTradeDestination() && !isLandedAtActiveTradeDestination()) {
      const landingStep = STARTER_TUTORIAL_STEPS.findIndex(item => item.id === "land-destination");
      if (landingStep >= 0) {
        tutorialState.stepIndex = landingStep;
        saveTutorialState();
        return;
      }
    }
    if (["select-market-resource", "select-market-target", "select-buy-amount", "buy-cargo"].includes(step?.id)) {
      prepareTutorialTradeSelection();
      if (document.getElementById("marketScreen")?.classList.contains("active") && typeof renderMarketplace === "function") {
        renderMarketplace();
      }
    }
    const reason = getTutorialStateCompletionReason(step);
    if (!reason) return;
    advanceTutorialStepFromState(reason);
  }
}


function setTutorialStepById(stepId) {
  const index = STARTER_TUTORIAL_STEPS.findIndex(step => step.id === stepId);
  if (index === -1) return false;
  tutorialState.stepIndex = index;
  saveTutorialState();
  renderStarterTutorial();
  return true;
}

function startStarterTutorial(reset = true) {
  const firstStep = STARTER_TUTORIAL_STEPS.findIndex(step => step.id === "welcome-new-pilot");
  tutorialState = {
    active: true,
    completed: false,
    stepIndex: reset ? Math.max(0, firstStep) : Math.min(tutorialState.stepIndex || 0, STARTER_TUTORIAL_STEPS.length - 1),
    lastStartedAt: new Date().toISOString()
  };
  saveTutorialState();
  renderStarterTutorial();
  addActivityLog("Starter Pilot Programme started.");
}

function replayStarterTutorial() {
  startStarterTutorial(true);
}

function resetStarterTutorialState() {
  clearStarterTutorialState();
  saveTutorialState();
  clearTutorialOverlayOnly();
  return {
    tutorialKeyCleared: TUTORIAL_STORAGE_KEY
  };
}

function clearStarterTutorialState() {
  localStorage.removeItem(TUTORIAL_STORAGE_KEY);
  tutorialState = {
    active: false,
    completed: false,
    stepIndex: 0,
    lastStartedAt: null
  };
}

function lupenResetTutorial(options = {}) {
  const resetProgress = options.resetProgress === true;
  const shouldStart = options.start === true || options.launch === true;
  const result = resetStarterTutorialState();
  if (resetProgress && typeof resetToNoShipStarterState === "function") {
    resetToNoShipStarterState();
  }
  if (shouldStart) startStarterTutorial(true);
  const response = {
    ...result,
    started: shouldStart,
    resetProgress
  };
  console.info("[Lupen staging] Starter Pilot Programme reset.", response);
  return response;
}

window.lupenResetTutorial = lupenResetTutorial;
window.lupenResetStarterPilotProgramme = lupenResetTutorial;
window.lupenStartTutorial = () => {
  startStarterTutorial(true);
  return { started: true, step: getCurrentTutorialStep()?.id || "" };
};
window.lupenReplayTutorial = window.lupenStartTutorial;

function handleStagingResetTutorialParam() {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  if (params.get("mp") !== "staging" || params.get("resetTutorial") !== "1") return false;

  const result = lupenResetTutorial();
  params.delete("resetTutorial");
  const nextUrl = `${url.pathname}${params.toString() ? `?${params}` : ""}${url.hash}`;
  try {
    window.history.replaceState({}, document.title, nextUrl);
  } catch (error) {
    console.warn("[Lupen staging] Unable to remove resetTutorial query parameter.", error);
  }
  console.info("[Lupen staging] Applied resetTutorial=1.", result);
  return true;
}

function handleStagingStartTutorialParam() {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  if (params.get("mp") !== "staging" || params.get("startTutorial") !== "1") return false;

  startStarterTutorial(true);
  params.delete("startTutorial");
  const nextUrl = `${url.pathname}${params.toString() ? `?${params}` : ""}${url.hash}`;
  try {
    window.history.replaceState({}, document.title, nextUrl);
  } catch (error) {
    console.warn("[Lupen staging] Unable to remove startTutorial query parameter.", error);
  }
  console.info("[Lupen staging] Applied startTutorial=1.");
  return true;
}

function skipStarterTutorial() {
  addHudToast("Complete the starter tutorial to continue.");
  renderStarterTutorial();
}

function finishStarterTutorial() {
  tutorialState.active = false;
  tutorialState.completed = true;
  tutorialState.stepIndex = STARTER_TUTORIAL_STEPS.length - 1;
  saveTutorialState();
  clearTutorialHighlight();
  const overlay = document.getElementById("tutorialOverlay");
  if (overlay) overlay.classList.remove("active");
  addHudToast("Starter Pilot Programme complete.");
  addActivityLog("Starter Pilot Programme complete.");
  renderPilotProfileIfActive();
}

function previousTutorialStep() {
  if (!tutorialState.active) return;
  addHudToast("Use the highlighted action to continue.");
  renderStarterTutorial();
}

function advanceTutorialManually() {
  if (!tutorialState.active) return;
  const step = getCurrentTutorialStep();

  if (step?.id === "complete") {
    finishStarterTutorial();
    return;
  }

  if (!step?.manualOnly) {
    addHudToast("Complete the highlighted action to continue.");
    renderStarterTutorial();
    return;
  }

  tutorialState.stepIndex = Math.min(STARTER_TUTORIAL_STEPS.length - 1, tutorialState.stepIndex + 1);
  saveTutorialState();
  renderStarterTutorial();
}

function tutorialEvent(eventName, detail = {}) {
  if (!tutorialState.active) return;

  const step = getCurrentTutorialStep();
  if (!step) return;

  const acceptedEvents = Array.isArray(step.event) ? step.event : [step.event];
  if (!acceptedEvents.includes(eventName)) return;

  if (step.id === "make-jump" && eventName === "jumpedNode" && !isAtActiveTradeDestination()) {
    if (tutorialAdvanceTimeout) clearTimeout(tutorialAdvanceTimeout);
    tutorialAdvanceTimeout = setTimeout(() => {
      addHudToast("Continue along the highlighted route.");
      renderStarterTutorial();
    }, 180);
    return;
  }

  if (step.id === "jump-to-bounty-zone" && eventName === "jumpedNode" && !isAtTutorialBountyCombatTarget()) {
    if (tutorialAdvanceTimeout) clearTimeout(tutorialAdvanceTimeout);
    tutorialAdvanceTimeout = setTimeout(() => {
      addHudToast("Continue toward the hostile bot signal.");
      renderStarterTutorial();
    }, 180);
    return;
  }

  if (step.id === "destroy-bot" && eventName === "destroyedBountyBot" && activeObjective?.type === "bounty" && activeObjective.status !== "readyToClaim") {
    if (tutorialAdvanceTimeout) clearTimeout(tutorialAdvanceTimeout);
    tutorialAdvanceTimeout = setTimeout(() => {
      const remaining = Math.max(0, Number(activeObjective.killsRequired || 0) - Number(activeObjective.kills || 0));
      addHudToast(`${remaining} bounty bot${remaining === 1 ? "" : "s"} remaining. Use Jump and Bots scan to find the next target.`);
      renderStarterTutorial();
    }, 180);
    return;
  }

  if (step.id === "destroy-bot" && ["openedSectorMap", "scannedBots", "jumpedNode"].includes(eventName) && activeObjective?.type === "bounty" && activeObjective.status !== "readyToClaim") {
    if (tutorialAdvanceTimeout) clearTimeout(tutorialAdvanceTimeout);
    tutorialAdvanceTimeout = setTimeout(() => {
      renderStarterTutorial();
    }, 180);
    return;
  }

  if (step.id === "return-to-planet-after-bounty" && eventName === "jumpedNode" && !isAtPlanetNode()) {
    if (tutorialAdvanceTimeout) clearTimeout(tutorialAdvanceTimeout);
    tutorialAdvanceTimeout = setTimeout(() => {
      addHudToast("Continue back toward the nearest planet.");
      renderStarterTutorial();
    }, 180);
    return;
  }

  if (step.id === "claim-bounty" && eventName === "openedBountyBoard") {
    if (tutorialAdvanceTimeout) clearTimeout(tutorialAdvanceTimeout);
    tutorialAdvanceTimeout = setTimeout(() => {
      renderStarterTutorial();
    }, 180);
    return;
  }

  if (tutorialAdvanceTimeout) clearTimeout(tutorialAdvanceTimeout);
  tutorialAdvanceTimeout = setTimeout(() => {
    if (!tutorialState.active) return;
    tutorialState.stepIndex = Math.min(STARTER_TUTORIAL_STEPS.length - 1, tutorialState.stepIndex + 1);
    saveTutorialState();
    renderStarterTutorial();
  }, 180);
}

function clearTutorialHighlight() {
  document.querySelectorAll(".tutorial-highlight-target").forEach(el => el.classList.remove("tutorial-highlight-target"));
  const spotlight = document.getElementById("tutorialSpotlight");
  if (spotlight) spotlight.removeAttribute("style");
}


function getActiveTradeDestination() {
  const trade = getActiveObjective();
  return trade?.type === "trade" ? trade.destination : null;
}

function isAtActiveTradeDestination() {
  const destination = getActiveTradeDestination();
  return Boolean(destination && currentNode === destination);
}

function isLandedAtActiveTradeDestination() {
  return isAtActiveTradeDestination() && (
    document.getElementById("gameScreen")?.classList.contains("active") ||
    document.getElementById("marketScreen")?.classList.contains("active")
  );
}

function getDynamicTutorialTarget(step) {
  if (!step) return null;

  if (step.target === "tutorial:hangarLoadoutTab") {
    return document.querySelector("#hangarOverviewTab") || document.querySelector("[data-tutorial-target='hangarLoadout']");
  }

  if (step.target === "tutorial:firstShipBuy") {
    const starterShipId = typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
    return document.querySelector("[data-tutorial-target='firstShipBuy']:not(:disabled)") ||
           document.querySelector(`.vessel-exchange-card[data-ship-id='${starterShipId}']`);
  }

  if (step.target === "tutorial:firstGun") {
    return document.querySelector("#gunInventory .hangar-equipment-card:not(:disabled)");
  }

  if (step.target === "tutorial:secondGun") {
    return document.querySelector("#gunInventory .hangar-equipment-card:not(:disabled)");
  }

  if (step.target === "tutorial:cargoPod") {
    return document.querySelector("#attachmentInventory .hangar-equipment-card[data-item-key='cargoPod']:not(:disabled)") ||
           document.querySelector("#attachmentInventory .hangar-equipment-card:not(:disabled)");
  }

  if (step.target === "tutorial:jumpDrive") {
    return document.querySelector("#attachmentInventory .hangar-equipment-card[data-item-key='jumpDrive']:not(:disabled)") ||
           document.querySelector("#attachmentInventory .hangar-equipment-card:not(:disabled)");
  }

  if (step.target === "tutorial:buyAmount") {
    return document.querySelector("[data-tutorial-target='marketMaxAmount']:not(:disabled)") ||
           document.querySelector(".market-amount-control button:not(.trade-primary-action):not(:disabled)") ||
           document.querySelector(".market-amount-control button:not(:disabled)");
  }

  if (step.target === "tutorial:buyCargo") {
    return document.querySelector("[data-tutorial-target='buyCargo']:not(:disabled)") ||
           document.querySelector(".market-amount-control .trade-primary-action:not(:disabled)") ||
           document.querySelector(".market-builder-panel .trade-primary-action:not(:disabled)");
  }

  if (step.target === "tutorial:sellCargo") {
    const marketOpen = document.getElementById("marketScreen")?.classList.contains("active");
    if (!marketOpen && isLandedAtActiveTradeDestination() && hasTutorialTradeCargo()) {
      return document.querySelector("[data-tutorial-target='planetTradeTerminal']") ||
             document.querySelector(".hub-actions button[onclick='openMarketplace()']");
    }
    return document.querySelector("[data-tutorial-target='sellCargo']:not(:disabled)") ||
           document.querySelector(".market-sell-action:not(:disabled)") ||
           document.querySelector(".market-builder-actions .trade-primary-action:not(:disabled)");
  }

  if (step.target === "tutorial:marketResourceIron") {
    return document.querySelector("[data-tutorial-target='marketResourceIron']") ||
           document.querySelector(".market-board-table tbody tr");
  }

  if (step.target === "tutorial:marketTarget") {
    return document.querySelector("[data-tutorial-target='marketTargetConfirm']:not(:disabled)") ||
           document.querySelector("[data-tutorial-target='marketTargetSelect']");
  }

  if (step.target === "tutorial:planetTradeTerminal") {
    return document.querySelector("[data-tutorial-target='planetTradeTerminal']") ||
           document.querySelector(".hub-actions button[onclick='openMarketplace()']");
  }

  if (step.target === "tutorial:destroyBountyBot") {
    const engageButton = document.querySelector("#objectEngageBtn:not(:disabled)");
    const selected = typeof getSelectedTargetEntity === "function" ? getSelectedTargetEntity() : null;
    const engaged = typeof getEngagedTargetEntity === "function" ? getEngagedTargetEntity() : null;
    const visibleBot = document.querySelector(".enemy-bot-target");
    const visibleStagingBot = document.querySelector(".lupen-mp-space-bot:not(.is-disabled)");
    const sectorMap = document.getElementById("sectorMap");

    if (selected?.alive && selected.node === currentNode && engageButton && !engaged) {
      return engageButton;
    }

    if (engaged?.alive && engaged.node === currentNode) {
      return document.querySelector("#objectActionPanel") || engageButton || visibleBot;
    }

    if (visibleStagingBot) return visibleStagingBot;
    if (visibleBot) return visibleBot;

    // If this node is clear but the bounty still needs more kills, guide the player back to Jump/Scan.
    if (activeObjective?.type === "bounty" && activeObjective.status !== "readyToClaim") {
      if (sectorMap?.classList.contains("active")) {
        return document.querySelector("#sectorScanBotsBtn:not(:disabled)") ||
               document.querySelector("#sectorSvg") ||
               document.querySelector("#jumpBtn");
      }
      return document.querySelector("#jumpBtn");
    }

    return document.querySelector("#objectEngageBtn:not(:disabled)") ||
           document.querySelector("#objectActionPanel") ||
           document.querySelector("#jumpBtn");
  }

  if (step.target === "tutorial:bountyRoute") {
    const sectorMap = document.getElementById("sectorMap");
    if (sectorMap?.classList.contains("active")) {
      return document.querySelector("#sectorSvg") || document.querySelector("#jumpBtn");
    }
    return document.querySelector("#jumpBtn") || document.querySelector("#sectorSvg");
  }

  if (step.target === "tutorial:claimBountyReward") {
    const bountyScreen = document.getElementById("bountyScreen");
    if (bountyScreen?.classList.contains("active")) {
      return document.querySelector(".bounty-claim-btn:not(:disabled)") ||
             document.querySelector(".bounty-detail-panel button:not(:disabled)") ||
             document.querySelector(".bounty-action-btn:not(:disabled)");
    }

    return document.querySelector("#bountyBoardHubBtn") ||
           document.querySelector(".hub-actions button[onclick='openBountyBoard()']");
  }

  if (step.target === "tutorial:bountyClaimReturn") {
    if (isAtPlanetNode()) return document.querySelector("#planetLandBtn");
    return document.querySelector("#jumpBtn") || document.querySelector("#sectorSvg");
  }

  if (step.target === "tutorial:bountyReturnRoute") {
    if (isAtPlanetNode()) return document.querySelector("#planetLandBtn");
    const sectorMap = document.getElementById("sectorMap");
    if (sectorMap?.classList.contains("active")) {
      return document.querySelector("#sectorSvg") || document.querySelector("#jumpBtn");
    }
    return document.querySelector("#jumpBtn") || document.querySelector("#sectorSvg");
  }

  if (step.target === "tutorial:bountyLanding") {
    if (isAtPlanetNode()) return document.querySelector("#planetLandBtn");
    const sectorMap = document.getElementById("sectorMap");
    if (sectorMap?.classList.contains("active")) {
      return document.querySelector("#sectorSvg") || document.querySelector("#jumpBtn");
    }
    return document.querySelector("#jumpBtn") || document.querySelector("#sectorSvg");
  }

  if (step.target === "dynamicTradeRoute") {
    if (isAtActiveTradeDestination()) {
      return document.querySelector("#planetLandBtn");
    }

    const sectorMap = document.getElementById("sectorMap");
    if (sectorMap?.classList.contains("active")) {
      return document.querySelector("#sectorSvg") || document.querySelector("#jumpBtn");
    }

    return document.querySelector("#jumpBtn") || document.querySelector("#sectorSvg");
  }

  if (step.target === "tutorial:storePulseLaser") {
    const selected = typeof getStoreSelectedItem === "function" ? getStoreSelectedItem() : null;
    const pulseBuy = document.querySelector(".store-detail-buy-action[data-item-key='pulseLaser']:not(:disabled)");
    const pulseCard = document.querySelector(".store-catalog-card[data-item-key='pulseLaser']:not(.sold-out)");

    if (selected?.key === "pulseLaser" && pulseBuy) {
      return pulseBuy;
    }

    return pulseCard || pulseBuy || document.querySelector(".store-detail-actions button:not(:disabled)");
  }

  if (step.target === "tutorial:spareWeapon") {
    return document.querySelector("#gunInventory .hangar-equipment-card[data-item-key='pulseLaser']:not(:disabled)") ||
           document.querySelector("#gunInventory .hangar-equipment-card:not(:disabled)");
  }

  if (step.target === "tutorial:forgeUpgradeButton") {
    return document.querySelector("#forgeStartBtn:not(:disabled)") ||
           document.querySelector("#forgeQualityModeBtn") ||
           document.querySelector("#forgeChamber");
  }

  return null;
}


function findTutorialTarget(selector) {
  const step = getCurrentTutorialStep();
  const dynamicTarget = getDynamicTutorialTarget(step);
  if (dynamicTarget) return dynamicTarget;

  if (!selector || selector.startsWith?.("tutorial:") || selector === "dynamicTradeRoute") return null;
  if (selector.includes("#planetLandBtn") && !isAtPlanetNode()) return null;
  const selectors = selector.split(",").map(item => item.trim()).filter(Boolean);
  for (const item of selectors) {
    const found = document.querySelector(item);
    if (found) return found;
  }
  return null;
}

function highlightTutorialTarget(step) {
  clearTutorialHighlight();
  syncPlanetLandingTarget();

  const target = findTutorialTarget(step?.target);
  const spotlight = document.getElementById("tutorialSpotlight");
  if (!target || !spotlight) return;

  if (step?.target === "tutorial:storePulseLaser") {
    target.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }

  target.classList.add("tutorial-highlight-target");

  // The planet landing button is an invisible hit area over the planet.
  // Use the circular target styling only, otherwise the generic rectangular spotlight
  // can appear in the wrong visual place and confuse the player.
  if (step?.id === "land-destination" || target.id === "planetLandBtn") {
    spotlight.style.opacity = "0";
    spotlight.removeAttribute("style");
    return;
  }

  const rect = target.getBoundingClientRect();
  spotlight.style.left = `${Math.max(8, rect.left - 8)}px`;
  spotlight.style.top = `${Math.max(8, rect.top - 8)}px`;
  spotlight.style.width = `${rect.width + 16}px`;
  spotlight.style.height = `${rect.height + 16}px`;
  spotlight.style.opacity = "1";
}


function getTutorialTargetElement() {
  const step = getCurrentTutorialStep();
  return findTutorialTarget(step?.target);
}

function positionTutorialCard(step, target) {
  const overlay = document.getElementById("tutorialOverlay");
  const card = document.querySelector(".tutorial-card");
  if (!overlay || !card || !step || step.intro || step.outro) {
    if (card) {
      card.classList.remove("tutorial-card-positioned");
      card.style.left = "";
      card.style.right = "";
      card.style.top = "";
      card.style.bottom = "";
      card.style.transform = "";
    }
    return;
  }

  card.classList.add("tutorial-card-positioned");
  const margin = 22;
  const cardRect = card.getBoundingClientRect();
  const width = Math.min(cardRect.width || 342, window.innerWidth - (margin * 2));
  const height = Math.min(cardRect.height || 220, window.innerHeight - (margin * 2));
  let left = window.innerWidth - width - margin;
  let top = margin;

  if (step.place === "left") {
    left = margin;
  } else if (step.place === "bottom") {
    left = (window.innerWidth - width) / 2;
    top = window.innerHeight - height - margin;
  } else if (target) {
    const rect = target.getBoundingClientRect();
    const targetIsLarge = rect.width > window.innerWidth * 0.5 || rect.height > window.innerHeight * 0.45;
    if (!targetIsLarge) {
      left = rect.left < window.innerWidth / 2 ? window.innerWidth - width - margin : margin;
      top = rect.top < window.innerHeight / 2 ? margin : window.innerHeight - height - margin;

      const overlapsTarget = () => {
        const right = left + width;
        const bottom = top + height;
        return left < rect.right + 14 && right > rect.left - 14 && top < rect.bottom + 14 && bottom > rect.top - 14;
      };

      if (overlapsTarget()) {
        const below = rect.bottom + 16;
        const above = rect.top - height - 16;
        top = below + height <= window.innerHeight - margin ? below : Math.max(margin, above);
      }
    }
  }

  left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
  top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));
  card.style.left = `${Math.round(left)}px`;
  card.style.right = "auto";
  card.style.top = `${Math.round(top)}px`;
  card.style.bottom = "auto";
  card.style.transform = "none";
}

function isTutorialClickAllowed(event) {
  if (!tutorialState.active) return true;

  // Account/start screens are outside the tutorial. Never block Create Account/Login navigation.
  if (isAccountScreenActive()) return true;

  const card = document.querySelector(".tutorial-card");
  if (card?.contains(event.target)) {
    return Boolean(event.target.closest?.("#tutorialNextBtn, #tutorialBackBtn"));
  }

  const target = getTutorialTargetElement();
  if (target && (target === event.target || target.contains(event.target))) return true;

  const step = getCurrentTutorialStep();
  if (
    event.target.closest?.(".hangar-tabs button") ||
    event.target.closest?.(".screen-back-btn") ||
    event.target.closest?.(".hub-actions button") ||
    event.target.closest?.(".bounty-detail-actions button") ||
    event.target.closest?.("#jumpBtn") ||
    event.target.closest?.("#sectorMap") ||
    event.target.closest?.(".sector-scan-btn") ||
    event.target.closest?.("#objectEngageBtn") ||
    event.target.closest?.("#objectActionPanel") ||
    event.target.closest?.(".lupen-mp-space-bot") ||
    event.target.closest?.(".enemy-bot-target")
  ) return true;

  if (
    ["land-destination", "open-map-return-bounty", "return-to-planet-after-bounty", "land-after-bounty"].includes(step?.id) &&
    event.target.closest?.("#planetLandBtn") &&
    isAtPlanetNode()
  ) return true;

  if (step?.id === "claim-bounty") {
    if (
      event.target.closest?.("#bountyBoardHubBtn") ||
      event.target.closest?.(".hub-actions button[onclick='openBountyBoard()']") ||
      event.target.closest?.(".bounty-claim-btn") ||
      event.target.closest?.(".bounty-detail-panel button") ||
      event.target.closest?.(".bounty-action-btn")
    ) return true;
  }

  if (step?.id === "continue-after-bounty-reward" && event.target.closest?.("#bountyRewardOverlay button, .reward-overlay button")) return true;
  if (step?.id === "return-after-bounty-claim" && event.target.closest?.("#bountyScreen .screen-back-btn")) return true;

  if (["jump-to-bounty-zone", "return-to-planet-after-bounty"].includes(step?.id)) {
    if (
      event.target.closest?.("#sectorMap") ||
      event.target.closest?.("#sectorSvg") ||
      event.target.closest?.("#jumpBtn") ||
      event.target.closest?.("#sectorScanBotsBtn") ||
      event.target.closest?.(".lupen-mp-space-bot") ||
      event.target.closest?.(".enemy-bot-target") ||
      event.target.closest?.("#objectEngageBtn") ||
      event.target.closest?.("#objectActionPanel")
    ) return true;
  }

  if (["open-map-return-bounty", "land-after-bounty"].includes(step?.id)) {
    if (
      event.target.closest?.("#jumpBtn") ||
      (isAtPlanetNode() && event.target.closest?.("#planetLandBtn")) ||
      event.target.closest?.(".lupen-mp-space-bot") ||
      event.target.closest?.(".enemy-bot-target") ||
      event.target.closest?.("#objectEngageBtn") ||
      event.target.closest?.("#objectActionPanel")
    ) return true;
  }

  if (step?.id === "destroy-bot") {
    return true;
  }

  if (step?.id === "buy-equipment") {
    const pulseCard = event.target.closest?.(".store-catalog-card[data-item-key='pulseLaser']");
    const pulseBuy = event.target.closest?.(".store-detail-buy-action[data-item-key='pulseLaser']");
    const selected = typeof getStoreSelectedItem === "function" ? getStoreSelectedItem() : null;
    const selectedBuy = selected?.key === "pulseLaser" && event.target.closest?.(".store-detail-actions button");
    if (pulseCard || pulseBuy || selectedBuy) return true;
  }

  if (step?.id === "forge-upgrade-weapon") {
    if (
      event.target.closest?.("#forgeStartBtn") ||
      event.target.closest?.("#forgeQualityModeBtn") ||
      event.target.closest?.("#forgeSelectedPanel") ||
      event.target.closest?.("#forgeInventoryPicker")
    ) return true;
  }

  return false;
}


document.addEventListener("click", event => {
  const burst = document.getElementById("tradeResultBurst");
  if (!burst?.classList.contains("active")) return;
  if (event.target.closest?.("#tradeResultBurst")) return;

  // Do not dismiss on the same click that created the reward burst.
  const createdAt = Number(burst.dataset.createdAt || 0);
  if (createdAt && Date.now() - createdAt < 180) return;

  dismissTradeResultBurst();
});

document.addEventListener("click", event => {
  const burst = document.getElementById("gameRewardBurst");
  if (!burst?.classList.contains("active")) return;
  if (event.target.closest?.("#gameRewardBurst")) return;

  const createdAt = Number(burst.dataset.createdAt || 0);
  if (createdAt && Date.now() - createdAt < 180) return;

  dismissGameRewardBurst();
});

document.addEventListener("click", event => {
  if (!tutorialState.active) return;
  if (isAccountScreenActive()) {
    clearTutorialOverlayOnly();
    return;
  }
  if (isTutorialClickAllowed(event)) return;

  event.preventDefault();
  event.stopPropagation();
  addHudToast("Follow the highlighted tutorial action.");
  renderStarterTutorial();
}, true);

document.addEventListener("pointerdown", event => {
  if (!tutorialState.active) return;
  if (isAccountScreenActive()) {
    clearTutorialOverlayOnly();
    return;
  }
  if (isTutorialClickAllowed(event)) return;

  event.preventDefault();
  event.stopPropagation();
}, true);



function isAccountScreenActive() {
  return Boolean(
    document.getElementById("startScreen")?.classList.contains("active") ||
    document.getElementById("createScreen")?.classList.contains("active") ||
    document.getElementById("loginScreen")?.classList.contains("active")
  );
}

function clearTutorialOverlayOnly() {
  clearTutorialHighlight();
  const overlay = document.getElementById("tutorialOverlay");
  if (overlay) {
    overlay.classList.remove("active");
    overlay.classList.remove("tutorial-intro-active");
  }
}


function renderStarterTutorial() {
  const overlay = document.getElementById("tutorialOverlay");
  if (!overlay || !tutorialState.active) return;

  if (isAccountScreenActive()) {
    clearTutorialOverlayOnly();
    return;
  }

  reconcileTutorialStepWithCurrentState();
  const step = getCurrentTutorialStep();

  if (step?.id === "forge-upgrade-weapon" && typeof hasTutorialPulseLaserQualityUpgrade === "function" && hasTutorialPulseLaserQualityUpgrade()) {
    setTimeout(() => tutorialEvent("upgradedTutorialWeapon"), 80);
  }

  const starterShipId = typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
  if (step?.id === "buy-first-ship" && !hasActiveShip() && selectedShipyardShipId !== starterShipId) {
    selectedShipyardShipId = starterShipId;
    if (document.getElementById("hangarShipyardSection")?.classList.contains("active")) {
      renderShipShop();
    }
  }
  if (step?.id === "buy-first-ship" && currentShipId === starterShipId && ownedShips.includes(starterShipId)) {
    if (tutorialAdvanceTimeout) clearTimeout(tutorialAdvanceTimeout);
    tutorialAdvanceTimeout = setTimeout(() => {
      if (tutorialState.active && getCurrentTutorialStep()?.id === "buy-first-ship") {
        addHudToast("Azure Striker is already active. Continuing the Starter Pilot Programme.");
        tutorialEvent("boughtFirstShip");
      }
    }, 120);
  }

  const title = document.getElementById("tutorialTitle");
  const text = document.getElementById("tutorialText");
  const label = document.getElementById("tutorialStepLabel");
  const progress = document.getElementById("tutorialProgress");
  const next = document.getElementById("tutorialNextBtn");
  const back = document.getElementById("tutorialBackBtn");

  overlay.classList.add("active");
  overlay.classList.toggle("tutorial-intro-active", Boolean(step.intro));
  overlay.classList.toggle("tutorial-outro-active", Boolean(step.outro));
  overlay.classList.toggle("tutorial-left-card", step.place === "left");
  overlay.classList.toggle("tutorial-bottom-card", step.place === "bottom");
  if (title) title.textContent = step.title;
  if (text) text.textContent = step.text;
  if (label) {
    const speaker = step.speaker || TUTORIAL_NARRATOR_LABEL;
    label.textContent = `${speaker} / Starter Pilot Programme`;
  }
  if (progress) {
    progress.innerHTML = STARTER_TUTORIAL_STEPS.map((item, index) => `<i class="${index < tutorialState.stepIndex ? "done" : index === tutorialState.stepIndex ? "active" : ""}"></i>`).join("");
  }
  if (next) {
    next.textContent = step.actionLabel || "Waiting for action";
    next.disabled = !step.manualOnly;
    next.classList.toggle("waiting", !step.manualOnly);
  }
  if (back) back.disabled = tutorialState.stepIndex <= 0;

  highlightTutorialTarget(step);
  positionTutorialCard(step, getTutorialTargetElement());
}

function renderPilotProfileIfActive() {
  const screen = document.getElementById("pilotProfileScreen");
  if (screen?.classList.contains("active")) renderPilotProfile();
}

window.addEventListener("resize", () => {
  syncPlanetLandingTarget();
  if (tutorialState.active) renderStarterTutorial();
});
