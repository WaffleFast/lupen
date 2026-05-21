/* ===== Starter Pilot Programme tutorial ===== */
const TUTORIAL_STORAGE_KEY = "lupenStarterPilotTutorial";
let tutorialState = loadTutorialState();
let tutorialAdvanceTimeout = null;

const STARTER_TUTORIAL_STEPS = [
  {
    id: "welcome-new-pilot",
    title: "Welcome, Pilot",
    text: "Your journey starts here. You have no ship, no fleet and no reputation. Build your first vessel, trade for credits, hunt hostile targets, and carve your name into the stars.",
    target: "#tutorialNextBtn",
    event: null,
    actionLabel: "Begin",
    manualOnly: true,
    intro: true
  },
  {
    id: "open-hangar-first-ship",
    title: "Open Hangar Bay",
    text: "Open Hangar Bay. This is where you will manage your ship, complete repairs and improve your fleet.",
    target: ".hub-actions button[onclick='openHangar()']",
    event: "openedHangar"
  },
  {
    id: "open-vessel-exchange-first-ship",
    title: "Open Vessel Exchange",
    text: "Click Vessel Exchange. This is where you will buy your first hull and compare future ships.",
    target: "tutorial:vesselExchangeTab",
    event: "openedVesselExchange"
  },
  {
    id: "buy-first-ship",
    title: "Buy your first ship",
    text: "Buy the LF-1 Origin. It is only a starter hull, but your loadout will decide what it becomes.",
    target: "tutorial:firstShipBuy",
    event: "boughtFirstShip"
  },
  {
    id: "open-first-loadout",
    title: "Open Loadout",
    text: "Open Loadout. This is where you will fit guns and equipment to shape your ship.",
    target: "tutorial:hangarLoadoutTab",
    event: "openedHangarLoadout"
  },
  {
    id: "equip-first-gun",
    title: "Equip first gun",
    text: "Fit your first gun from Available Equipment. This gives your ship its first real attack system.",
    target: "tutorial:firstGun",
    event: "equippedFirstGun"
  },
  {
    id: "equip-second-gun",
    title: "Equip second gun",
    text: "Fit a second gun. More gun slots mean more attacking potential when combat begins.",
    target: "tutorial:secondGun",
    event: "equippedSecondGun"
  },
  {
    id: "equip-cargo-pod",
    title: "Fit Cargo Pod",
    text: "Fit the Cargo Pod. Cargo upgrades let you carry more goods, which means bigger trade runs and better profit potential.",
    target: "tutorial:cargoPod",
    event: "equippedCargoPod"
  },
  {
    id: "equip-jump-drive",
    title: "Fit Jump Drive",
    text: "Fit the Jump Drive. Jump upgrades help your ship recover faster between jumps, so longer routes feel smoother.",
    target: "tutorial:jumpDrive",
    event: "equippedJumpDrive"
  },
  {
    id: "return-after-first-loadout",
    title: "Return to station",
    text: "Return to the station hub. Your ship is ready for your first trade.",
    target: "#hangarScreen .screen-back-btn",
    event: "returnedToHub",
    place: "left"
  },
  {
    id: "open-trade",
    title: "Open Trade Terminal",
    text: "Click Trade Terminal. This is how you will earn steady credits.",
    target: ".hub-actions button[onclick='openMarketplace()']",
    event: "openedTradeTerminal"
  },
  {
    id: "preview-trade",
    title: "Preview a trade",
    text: "Click Preview on a station trade. Check the margin, units, jumps and CR per jump before you commit.",
    target: ".trade-contract-card",
    event: "selectedTrade"
  },
  {
    id: "accept-trade",
    title: "Accept the trade",
    text: "Press Accept Trade. This creates your active objective and unlocks the buy controls.",
    target: ".accept-route-action",
    event: "acceptedTrade"
  },
  {
    id: "select-buy-amount",
    title: "Choose buy amount",
    text: "Choose how much cargo you want to buy. Use Max for the quickest tutorial run.",
    target: ".trade-max-btn, .trade-amount-btn, .trade-qty-input",
    event: "selectedBuyAmount"
  },
  {
    id: "buy-cargo",
    title: "Buy cargo",
    text: "Now press Buy Cargo. Your Objectives tab will guide you to the destination.",
    target: ".trade-primary-action",
    event: "boughtTradeCargo"
  },
  {
    id: "return-to-station-for-launch",
    title: "Back to station",
    text: "Return to the station hub, then launch your ship into orbit.",
    target: "#marketScreen .screen-back-btn",
    event: "returnedToHub",
    place: "left"
  },
  {
    id: "launch",
    title: "Launch into orbit",
    text: "Click Launch Ship. Your accepted trade route will remain active in space.",
    target: ".hub-launch-btn",
    event: "launched"
  },
  {
    id: "map-route",
    title: "Open the sector map",
    text: "Wait for your Jump bar to recharge, then click Jump to open the sector map.",
    target: "#jumpBtn",
    event: "openedSectorMap"
  },
  {
    id: "make-jump",
    title: "Continue route",
    text: "After each jump, let your Jump bar recharge. Then open the map and keep following the highlighted route.",
    target: "dynamicTradeRoute",
    event: "jumpedNode"
  },
  {
    id: "land-destination",
    title: "Land at destination",
    text: "Click the highlighted planet to land at your trade destination.",
    target: "#planetLandBtn",
    event: "landedOnPlanet",
    place: "left"  },
  {
    id: "open-trade-to-sell",
    title: "Open Trade Terminal",
    text: "Click Trade Terminal, then sell the cargo you carried here.",
    target: ".hub-actions button[onclick='openMarketplace()']",
    event: "openedTradeTerminal"
  },
  {
    id: "sell-cargo",
    title: "Sell cargo",
    text: "Sell your route cargo to complete the trade and bank your profit.",
    target: ".trade-primary-action",
    event: "soldTradeCargo"
  },
  {
    id: "return-after-trade",
    title: "Return to station",
    text: "Return to the station hub. Next, you will add more options to your loadout.",
    target: "#marketScreen .screen-back-btn",
    event: "returnedToHub",
    place: "left"
  },
  {
    id: "open-store",
    title: "Open Store",
    text: "Open the Store. This is where you can buy extra guns and attachments.",
    target: ".hub-actions button[onclick='openStore()']",
    event: "openedStore"
  },
  {
    id: "buy-equipment",
    title: "Buy spare attachment",
    text: "Buy an Evasion Matrix from the Store. Your gun slots are full, so this upgrade uses your remaining equipment slot and improves survivability.",
    target: "tutorial:storeEvasionMatrix",
    event: "boughtStoreEvasionMatrix"
  },
  {
    id: "return-after-store",
    title: "Return to station",
    text: "Return to the station hub, then open Hangar Bay to fit your new equipment.",
    target: "#storeScreen .screen-back-btn",
    event: "returnedToHub",
    place: "left"
  },
  {
    id: "open-hangar-equip",
    title: "Open Hangar Bay",
    text: "Open Hangar Bay. This is where you will manage your active ship and fitted equipment.",
    target: ".hub-actions button[onclick='openHangar()']",
    event: "openedHangar"
  },
  {
    id: "equip-item",
    title: "Equip spare attachment",
    text: "Fit the spare attachment you just bought. Your gun slots are already full, but your ship still has one equipment slot free.",
    target: "tutorial:spareAttachment",
    event: "equippedAttachment"
  },
  {
    id: "return-after-equip",
    title: "Return to station",
    text: "Return to the station hub. Next, you will accept your first bounty.",
    target: "#hangarScreen .screen-back-btn",
    event: "returnedToHub",
    place: "left"
  },
  {
    id: "open-bounty",
    title: "Open Bounty Board",
    text: "Open the Bounty Board and choose your first starter contract.",
    target: ".hub-actions button[onclick='openBountyBoard()']",
    event: "openedBountyBoard"
  },
  {
    id: "accept-bounty",
    title: "Accept bounty",
    text: "Accept a bounty. Combat contracts give you XP, credits and rare loot chances.",
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
    text: "Launch your ship. Your bounty objective will remain active in orbit.",
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
    text: "Use the Bots scan. Scans reveal hostile signals and help you choose where to jump.",
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
    text: "Use Jump and Bots scan as needed, then fight normally until the bounty objective is complete.",
    target: null,
    event: ["destroyedBountyBot", "openedSectorMap", "scannedBots", "jumpedNode"],
    place: "left"
  },
  {
    id: "open-map-return-bounty",
    title: "Return to a planet",
    text: "Bounty complete. Open the sector map and return to a planet to claim your reward.",
    target: "tutorial:bountyClaimReturn",
    event: ["openedSectorMap", "landedOnPlanet"],
    place: "left"  },
  {
    id: "return-to-planet-after-bounty",
    title: "Jump back to station space",
    text: "Follow the route back to the nearest planet. Recharge your Jump bar between jumps.",
    target: "tutorial:bountyReturnRoute",
    event: ["jumpedNode", "landedOnPlanet"],
    place: "left"  },
  {
    id: "land-after-bounty",
    title: "Land at the planet",
    text: "Click the highlighted planet to land and return to the station hub.",
    target: "#planetLandBtn",
    event: "landedOnPlanet",
    place: "left"  },
  {
    id: "open-bounty-to-claim",
    title: "Open Bounty Board",
    text: "Open the Bounty Board and claim the reward you earned.",
    target: ".hub-actions button[onclick='openBountyBoard()'], #bountyBoardHubBtn",
    event: "openedBountyBoard"
  },
  {
    id: "claim-bounty",
    title: "Claim bounty reward",
    text: "Open the Bounty Board, then claim your completed bounty. This is your combat payout moment.",
    target: "tutorial:claimBountyReward",
    event: ["openedBountyBoard", "claimedBountyReward"]
  },
  {
    id: "continue-after-bounty-reward",
    title: "Reward claimed",
    text: "Press Continue, then return to the station hub.",
    target: "#bountyRewardOverlay button, .reward-overlay button",
    event: "closedBountyReward",
    place: "left"
  },
  {
    id: "return-after-bounty-claim",
    title: "Back to station",
    text: "Leave the Bounty Board and head back to the station hub.",
    target: "#bountyScreen .screen-back-btn",
    event: "returnedToHub",
    place: "left"
  },
  {
    id: "repair-reminder",
    title: "Repair check",
    text: "Open Hangar after combat and check your hull and shield condition. Repair if your hull took damage before risky launches.",
    target: ".hub-actions button[onclick='openHangar()']",
    event: "openedHangar"
  },
  {
    id: "complete",
    title: "Good luck, Pilot",
    text: "Your starter route is complete. The trade lanes are open, hostile space is waiting, and your fleet begins here. Build carefully, fly smart, and carve your name into the stars.",
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

  if (step.id === "jump-to-bounty-zone" && eventName === "jumpedNode" && !isAtActiveBountyCombatNode()) {
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

function getDynamicTutorialTarget(step) {
  if (!step) return null;

  if (step.target === "tutorial:vesselExchangeTab") {
    return document.querySelector("#hangarShipyardTab") || document.querySelector("[data-tutorial-target='vesselExchange']");
  }

  if (step.target === "tutorial:hangarLoadoutTab") {
    return document.querySelector("#hangarOverviewTab") || document.querySelector("[data-tutorial-target='hangarLoadout']");
  }

  if (step.target === "tutorial:firstShipBuy") {
    return document.querySelector(".buy-ship-action:not(:disabled)") || document.querySelector(".vessel-exchange-card[data-ship-id='lupenOrigin']");
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

  if (step.target === "tutorial:destroyBountyBot") {
    const engageButton = document.querySelector("#objectEngageBtn:not(:disabled)");
    const selected = typeof getSelectedTargetEntity === "function" ? getSelectedTargetEntity() : null;
    const engaged = typeof getEngagedTargetEntity === "function" ? getEngagedTargetEntity() : null;
    const visibleBot = document.querySelector(".enemy-bot-target");
    const sectorMap = document.getElementById("sectorMap");

    if (selected?.alive && selected.node === currentNode && engageButton && !engaged) {
      return engageButton;
    }

    if (engaged?.alive && engaged.node === currentNode) {
      return document.querySelector("#objectActionPanel") || engageButton || visibleBot;
    }

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

  if (step.target === "tutorial:storeEvasionMatrix") {
    const selected = typeof getStoreSelectedItem === "function" ? getStoreSelectedItem() : null;
    const evasionBuy = document.querySelector(".store-detail-buy-action[data-item-key='evasionMatrix']:not(:disabled)");
    const evasionCard = document.querySelector(".store-catalog-card[data-item-key='evasionMatrix']:not(.sold-out)");

    if (selected?.key === "evasionMatrix" && evasionBuy) {
      return evasionBuy;
    }

    return evasionCard || evasionBuy || document.querySelector(".store-detail-actions button:not(:disabled)");
  }

if (step.target === "tutorial:storeAttachment") {
    return document.querySelector(".store-buy-attachment-action[data-item-key='shieldBooster']:not(:disabled)") ||
           document.querySelector(".store-buy-attachment-action[data-item-key='evasionMatrix']:not(:disabled)") ||
           document.querySelector(".store-buy-attachment-action:not(:disabled)");
  }

  if (step.target === "tutorial:spareAttachment") {
    return document.querySelector("#attachmentInventory .hangar-equipment-card:not(:disabled)");
  }

  return null;
}


function findTutorialTarget(selector) {
  const step = getCurrentTutorialStep();
  const dynamicTarget = getDynamicTutorialTarget(step);
  if (dynamicTarget) return dynamicTarget;

  if (!selector || selector.startsWith?.("tutorial:") || selector === "dynamicTradeRoute") return null;
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
    event.target.closest?.(".enemy-bot-target")
  ) return true;

  if (
    ["land-destination", "open-map-return-bounty", "return-to-planet-after-bounty", "land-after-bounty"].includes(step?.id) &&
    event.target.closest?.("#planetLandBtn")
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
      event.target.closest?.(".enemy-bot-target") ||
      event.target.closest?.("#objectEngageBtn") ||
      event.target.closest?.("#objectActionPanel")
    ) return true;
  }

  if (["open-map-return-bounty", "land-after-bounty"].includes(step?.id)) {
    if (
      event.target.closest?.("#jumpBtn") ||
      event.target.closest?.("#planetLandBtn") ||
      event.target.closest?.(".enemy-bot-target") ||
      event.target.closest?.("#objectEngageBtn") ||
      event.target.closest?.("#objectActionPanel")
    ) return true;
  }

  if (step?.id === "destroy-bot") {
    return true;
  }

  if (step?.id === "buy-equipment") {
    const evasionCard = event.target.closest?.(".store-catalog-card[data-item-key='evasionMatrix']");
    const evasionBuy = event.target.closest?.(".store-detail-buy-action[data-item-key='evasionMatrix']");
    const selected = typeof getStoreSelectedItem === "function" ? getStoreSelectedItem() : null;
    const selectedBuy = selected?.key === "evasionMatrix" && event.target.closest?.(".store-detail-actions button");
    if (evasionCard || evasionBuy || selectedBuy) return true;
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

  const step = getCurrentTutorialStep();

  if (step?.id === "buy-first-ship" && !hasActiveShip() && selectedShipyardShipId !== "lupenOrigin") {
    selectedShipyardShipId = "lupenOrigin";
    if (document.getElementById("hangarShipyardSection")?.classList.contains("active")) {
      renderShipShop();
    }
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
  if (label) label.textContent = `Starter Pilot Programme / ${Math.min(tutorialState.stepIndex + 1, STARTER_TUTORIAL_STEPS.length)} / ${STARTER_TUTORIAL_STEPS.length}`;
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
