/* ===== Starter Pilot Programme tutorial ===== */
const TUTORIAL_STORAGE_KEY = "lupenStarterPilotTutorial";
const TUTORIAL_NARRATOR_LABEL = "Morgan";
const TUTORIAL_PROGRAMME_LABEL = "Academy Orientation";
const TUTORIAL_TRADE_ROUTE = Object.freeze({
  origin: "Asteron Prime",
  good: "Iron",
  destination: "Virella"
});
const TUTORIAL_ACADEMY_MILESTONES = Object.freeze([
  Object.freeze({
    missionId: "academy_starter_ship",
    shortLabel: "Claim Hunter",
    stepIds: Object.freeze(["open-hangar-first-ship", "buy-first-ship", "open-first-loadout"])
  }),
  Object.freeze({
    missionId: "academy_first_trade",
    shortLabel: "Complete Trade",
    stepIds: Object.freeze(["return-after-first-loadout", "open-trade", "select-market-resource", "select-market-target", "buy-cargo", "return-to-station-for-launch", "map-route", "make-jump", "land-destination", "open-trade-to-sell", "sell-cargo"])
  }),
  Object.freeze({
    missionId: "academy_launch_ship",
    shortLabel: "Launch",
    stepIds: Object.freeze(["launch"])
  }),
  Object.freeze({
    missionId: "academy_two_guns",
    shortLabel: "Equip Guns",
    stepIds: Object.freeze(["return-after-trade", "open-store", "buy-equipment", "return-after-store", "open-hangar-equip", "equip-item"])
  }),
  Object.freeze({
    missionId: "academy_attachment",
    shortLabel: "Fit Equipment",
    stepIds: Object.freeze(["equip-attachment", "return-after-equip"])
  }),
  Object.freeze({
    missionId: "academy_erebus_bots",
    shortLabel: "Defeat Erebus",
    stepIds: Object.freeze(["launch-for-combat", "open-map-for-bounty", "scan-for-bots", "jump-to-bounty-zone", "destroy-bot"])
  }),
  Object.freeze({
    missionId: "academy_bounty",
    shortLabel: "Claim Bounty",
    stepIds: Object.freeze(["open-bounty", "accept-bounty", "return-for-combat-launch", "open-map-return-bounty", "return-to-planet-after-bounty", "land-after-bounty", "open-bounty-to-claim", "claim-bounty", "continue-after-bounty-reward", "return-after-bounty-claim"])
  }),
  Object.freeze({
    missionId: "academy_repair_ship",
    shortLabel: "Repair",
    stepIds: Object.freeze(["return-after-forge", "repair-reminder", "repair-ship"])
  })
]);
let tutorialState = loadTutorialState();
let tutorialAdvanceTimeout = null;

const STARTER_TUTORIAL_STEPS = [
  {
    id: "welcome-new-pilot",
    title: "Welcome to Lupen, {pilot}",
    speaker: TUTORIAL_NARRATOR_LABEL,
    voiceCue: "tutorial_intro_welcome",
    text: "I'm Morgan, your Command Liaison. I'll help you find your feet, claim your first ship, and understand the choices that shape your journey.",
    target: "#tutorialNextBtn",
    event: null,
    actionLabel: "Continue",
    manualOnly: true,
    intro: true
  },
  {
    id: "welcome-core-loop",
    title: "Your first flight plan",
    speaker: TUTORIAL_NARRATOR_LABEL,
    text: "Life in Lupen has a simple rhythm: trade for credits, equip your ship, take contracts, survive combat, and improve what you own. We will walk through each part together.",
    target: "#tutorialNextBtn",
    event: null,
    actionLabel: "Continue",
    manualOnly: true,
    intro: true
  },
  {
    id: "welcome-academy",
    title: "Your first Academy assignments",
    speaker: TUTORIAL_NARRATOR_LABEL,
    text: "Claim your Hunter, complete a trade, launch, equip two guns and an attachment, defeat Erebus, claim a bounty, and check your repairs. These same actions complete Academy assignments and move you toward Frontier.",
    target: "#tutorialNextBtn",
    event: null,
    actionLabel: "Begin orientation",
    manualOnly: true,
    intro: true
  },
  {
    id: "open-hangar-first-ship",
    title: "Open Hangar Bay",
    text: "Open Hangar Bay. We will confirm your Pioneer Hunter and inspect the systems that carry you through the first route.",
    target: ".hub-actions button[onclick='openHangar()']",
    event: "openedHangar"
  },
  {
    id: "buy-first-ship",
    title: "Claim Pioneer Hunter",
    text: "Claim the Pioneer Hunter if it is waiting in the Vessel Exchange. If it is already active, I will move us forward.",
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
    title: "Set cargo amount",
    text: "Load as much Iron as your credits and cargo hold allow. The live market does not lock a destination; Virella currently offers a useful first route.",
    target: "tutorial:marketMaxAmount",
    event: "selectedBuyAmount"
  },
  {
    id: "buy-cargo",
    title: "Accept trade",
    text: "Accept the marked trade. Maximum affordable cargo will be loaded automatically.",
    target: "tutorial:buyCargo",
    event: "boughtTradeCargo"
  },
  {
    id: "return-to-station-for-launch",
    title: "Back to station",
    text: "Return to the station hub, then take the Pioneer Hunter into orbit.",
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
    text: "Sell the Iron. The profit is yours, and every clean run brings a Pioneer Freighter closer.",
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
    text: "Buy a Pulse Laser if one is not already in your hold or mounted on the Pioneer Hunter. It is reliable enough for your first bounty.",
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
    title: "Equip second weapon",
    text: "Fit the Pulse Laser into the Hunter's open weapon slot. Two mounted weapons give your first combat run a complete volley.",
    target: "tutorial:spareWeapon",
    event: "equippedItem"
  },
  {
    id: "equip-attachment",
    title: "Equip Cargo Pod",
    text: "Fit the issued Cargo Pod into an equipment slot. Attachments shape a ship beyond its weapons, and this one expands your trade capacity.",
    target: "tutorial:spareAttachment",
    event: "equippedAttachment"
  },
  {
    id: "return-after-equip",
    title: "Return to station",
    text: "Return to the station hub. Next objective: accept a bounty and turn combat into credits and Lupen Shards.",
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
    text: "Accept a bounty. Bot kills still build combat XP, while completed bounties pay credits and Lupen Shards.",
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
    text: "Claim your completed bounty. Bounty payouts include credits and Lupen Shards.",
    target: "tutorial:claimBountyReward",
    event: ["openedBountyBoard", "claimedBountyReward"]
  },
  {
    id: "continue-after-bounty-reward",
    title: "Reward claimed",
    text: "Press Continue, then return to the station hub. The Lupen Shards you claimed can upgrade your Pulse Laser.",
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
    text: "Open the Forge. Lupen Shards raise item levels; for now, we will upgrade your Pulse Laser once and keep the lesson clean.",
    target: ".hub-actions button[onclick='openUpgradeForge()']",
    event: "openedForge"
  },
  {
    id: "forge-upgrade-weapon",
    title: "Upgrade Pulse Laser",
    text: "Upgrade the Pulse Laser. It will rise from Level I to Level II and remain fitted to your loadout.",
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
    text: "Open Hangar after combat and check hull condition. Morgan will guide the repair or confirm that no hull service is needed.",
    target: ".hub-actions button[onclick='openHangar()']",
    event: "openedHangar"
  },
  {
    id: "repair-ship",
    title: "Service the Hunter",
    text: "Run Hull Service if combat reached the hull. If condition is already 100%, Morgan will confirm the inspection automatically.",
    target: "tutorial:repairShip",
    event: "repairedShip"
  },
  {
    id: "complete",
    title: "Orientation Complete",
    speaker: TUTORIAL_NARRATOR_LABEL,
    voiceCue: "tutorial_outro_complete",
    text: "You have the fundamentals, {pilot}. Open Journey and finish the remaining Academy assignments. Across the Pioneer Line, the Freighter or Destroyer are natural next hulls, with the Moth farther ahead. Earn a second Pioneer hull to unlock Frontier. Good luck out there—I will be with you for the road ahead.",
    target: "#tutorialNextBtn",
    event: null,
    actionLabel: "Continue my journey",
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
    lastStartedAt: parsed.lastStartedAt || null,
    pilotId: String(parsed.pilotId || "")
  };
}

function saveTutorialState() {
  localStorage.setItem(TUTORIAL_STORAGE_KEY, JSON.stringify(tutorialState));
}

function getCurrentTutorialStep() {
  return STARTER_TUTORIAL_STEPS[Math.min(tutorialState.stepIndex, STARTER_TUTORIAL_STEPS.length - 1)];
}

function getTutorialPilotIdentity() {
  const accountKey = typeof STORAGE_ACCOUNT_KEY !== "undefined" ? STORAGE_ACCOUNT_KEY : "sectorOneAccount";
  const account = safeParseLocalStorage(accountKey, {});
  return {
    id: String(account?.id || ""),
    name: String(account?.pilot_name || account?.username || "Pilot").trim() || "Pilot"
  };
}

function formatTutorialCopy(value) {
  return String(value || "").replaceAll("{pilot}", getTutorialPilotIdentity().name);
}

function getTutorialAcademyMilestone(stepId = getCurrentTutorialStep()?.id) {
  return TUTORIAL_ACADEMY_MILESTONES.find(milestone => milestone.stepIds.includes(stepId)) || null;
}

function getTutorialAcademyMission(missionId) {
  if (typeof MISSIONS_BY_ID === "undefined") return null;
  return MISSIONS_BY_ID?.[missionId] || null;
}

function getTutorialAcademyMissionState(missionId) {
  return missionProgress?.missions?.[missionId] || { state: "available", progress: 0 };
}

function isTutorialAcademyMissionComplete(state) {
  return ["completed", "claimed"].includes(String(state?.state || ""));
}

function renderTutorialAcademyTracker(step) {
  const tracker = document.getElementById("tutorialAcademyTracker");
  if (!tracker) return;

  if (step?.id === "welcome-academy") {
    tracker.hidden = false;
    tracker.classList.add("is-overview");
    tracker.innerHTML = `
      <span class="tutorial-academy-kicker">First Academy Route</span>
      <div class="tutorial-academy-route">
        ${TUTORIAL_ACADEMY_MILESTONES.map(milestone => {
          const state = getTutorialAcademyMissionState(milestone.missionId);
          return `<span class="${isTutorialAcademyMissionComplete(state) ? "is-complete" : ""}">${milestone.shortLabel}</span>`;
        }).join("")}
      </div>
    `;
    return;
  }

  const milestone = getTutorialAcademyMilestone(step?.id);
  if (!milestone) {
    tracker.hidden = true;
    tracker.classList.remove("is-overview");
    tracker.innerHTML = "";
    return;
  }

  const mission = getTutorialAcademyMission(milestone.missionId);
  const state = getTutorialAcademyMissionState(milestone.missionId);
  const required = Math.max(1, Number(mission?.objective?.required || 1));
  const progress = Math.min(required, Math.max(0, Number(state?.progress || 0)));
  const complete = isTutorialAcademyMissionComplete(state);
  tracker.hidden = false;
  tracker.classList.remove("is-overview");
  tracker.innerHTML = `
    <span class="tutorial-academy-kicker">Academy Assignment</span>
    <strong>${escapeHtml(mission?.title || milestone.shortLabel)}</strong>
    <span class="tutorial-academy-status ${complete ? "is-complete" : ""}">${complete ? "Complete" : `${formatNumber(progress)} / ${formatNumber(required)}`}</span>
  `;
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

function getTutorialEquippedGunCount() {
  const shipId = currentShipId || getStarterShipId();
  return (getTutorialShipLoadout(shipId).guns || []).filter(entry => tutorialEntryKey(entry)).length;
}

function hasTutorialTwoGunsEquipped() {
  return getTutorialEquippedGunCount() >= 2;
}

function hasTutorialSpareWeaponAvailable() {
  return Number(ownedGuns?.pulseLaser || 0) > 0 ||
    (Array.isArray(inventoryItems) && inventoryItems.some(item => item?.key === "pulseLaser"));
}

function hasTutorialAttachmentEquipped() {
  const shipId = currentShipId || getStarterShipId();
  return (getTutorialShipLoadout(shipId).attachments || []).some(entry => tutorialEntryKey(entry));
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
  return typeof hasTutorialPulseLaserLevelUpgrade === "function" && hasTutorialPulseLaserLevelUpgrade();
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
      if (hasTutorialTwoGunsEquipped()) return "two_guns_equipped";
      return hasTutorialSpareWeaponAvailable() ? "spare_weapon_available" : "";
    case "open-hangar-equip":
    case "equip-item":
      if (hasTutorialTwoGunsEquipped()) return "two_guns_equipped";
      if (!hasOpenTutorialWeaponSlot() && hasTutorialCombatWeaponEquipped()) return "weapon_slots_filled";
      return "";
    case "equip-attachment":
    case "return-after-equip":
      return hasTutorialAttachmentEquipped() ? "attachment_equipped" : "";
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
    case "repair-ship":
      return typeof getRepairCost === "function" && getRepairCost() <= 0 ? "hull_service_not_needed" : "";
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
  if (step?.id === "repair-ship" && reason === "hull_service_not_needed" && typeof recordMissionEvent === "function") {
    recordMissionEvent("repair_ship", { shipId: currentShipId, inspectionOnly: true, cost: 0 });
  }
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

function startStarterTutorial(reset = true, options = {}) {
  const firstStep = STARTER_TUTORIAL_STEPS.findIndex(step => step.id === "welcome-new-pilot");
  const pilotId = String(options.pilotId || getTutorialPilotIdentity().id || tutorialState.pilotId || "");
  tutorialState = {
    active: true,
    completed: false,
    stepIndex: reset ? Math.max(0, firstStep) : Math.min(tutorialState.stepIndex || 0, STARTER_TUTORIAL_STEPS.length - 1),
    lastStartedAt: reset ? new Date().toISOString() : (tutorialState.lastStartedAt || new Date().toISOString()),
    pilotId
  };
  saveTutorialState();
  renderStarterTutorial();
  addActivityLog(`Morgan: Welcome, ${getTutorialPilotIdentity().name}. Academy orientation is now active.`);
}

function replayStarterTutorial() {
  startStarterTutorial(true);
}

function startMorganAcademyOrientation(pilotId = "") {
  clearStarterTutorialState();
  startStarterTutorial(true, { pilotId });
  return { started: true, resumed: false, step: getCurrentTutorialStep()?.id || "" };
}

function resumeMorganAcademyOrientation(pilotId = "") {
  const safePilotId = String(pilotId || getTutorialPilotIdentity().id || "");
  const canResume = Boolean(
    safePilotId &&
    tutorialState.pilotId === safePilotId &&
    tutorialState.completed === false &&
    tutorialState.lastStartedAt
  );
  if (!canResume) return { started: false, resumed: false, step: getCurrentTutorialStep()?.id || "" };
  startStarterTutorial(false, { pilotId: safePilotId });
  return { started: true, resumed: true, step: getCurrentTutorialStep()?.id || "" };
}

function deactivateMorganAcademyOrientation() {
  tutorialState.active = false;
  saveTutorialState();
  clearTutorialOverlayOnly();
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
    lastStartedAt: null,
    pilotId: ""
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
  console.info("[Lupen staging] Morgan Academy Orientation reset.", response);
  return response;
}

window.lupenResetTutorial = lupenResetTutorial;
window.lupenResetStarterPilotProgramme = lupenResetTutorial;
window.startMorganAcademyOrientation = startMorganAcademyOrientation;
window.resumeMorganAcademyOrientation = resumeMorganAcademyOrientation;
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
  addHudToast("Complete Morgan's Academy orientation to continue.");
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
  addHudToast("Morgan's Academy orientation complete.");
  addActivityLog("Morgan: Orientation complete. Good luck on your journey, Pilot.");
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
    return document.querySelector("[data-tutorial-target='buyCargo']:not(:disabled)") ||
           document.querySelector(".trade-route-card__button:not(:disabled)") ||
           document.querySelector("[data-tutorial-target='marketMaxAmount']:not(:disabled)") ||
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
    return document.querySelector("[data-tutorial-target='marketRouteCard']") ||
           document.querySelector(".trade-route-card:not(.is-loss)");
  }

  if (step.target === "tutorial:marketMaxAmount") {
    return document.querySelector("[data-tutorial-target='marketMaxAmount']:not(:disabled)");
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

  if (step.target === "tutorial:spareAttachment") {
    return document.querySelector("#attachmentInventory .hangar-equipment-card[data-item-key='cargoPod']:not(:disabled)") ||
           document.querySelector("#attachmentInventory .hangar-equipment-card:not(:disabled)");
  }

  if (step.target === "tutorial:repairShip") {
    return document.querySelector("#hangarScreen button[onclick='repairCurrentShip()']:not(:disabled)") ||
           document.querySelector("#hangarScreen .loadout-repair-ready");
  }

  if (step.target === "tutorial:forgeUpgradeButton") {
    return document.querySelector("#forgeStartBtn:not(:disabled)") ||
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
  const academyTracker = document.getElementById("tutorialAcademyTracker");
  if (academyTracker) academyTracker.hidden = true;
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
        addHudToast("Pioneer Hunter is already active. Morgan is continuing your orientation.");
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
  if (title) title.textContent = formatTutorialCopy(step.title);
  if (text) text.textContent = formatTutorialCopy(step.text);
  if (label) {
    const speaker = step.speaker || TUTORIAL_NARRATOR_LABEL;
    label.textContent = `${speaker} / ${TUTORIAL_PROGRAMME_LABEL}`;
  }
  renderTutorialAcademyTracker(step);
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
