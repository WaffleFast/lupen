/* ===== Starter Pilot Programme tutorial ===== */
const TUTORIAL_STORAGE_KEY = LupenSaveService.storageKeys.tutorial;
const TUTORIAL_FLOW_VERSION = 7;
const TUTORIAL_NARRATOR_LABEL = "Morgan";
const TUTORIAL_PROGRAMME_LABEL = "Academy Orientation";
const TUTORIAL_INTRO_COPY = Object.freeze({
  title: "Welcome to Lupen, {pilot}",
  text: "Welcome, Pilot. I’m Morgan, your Command Liaison. I’ll be here to guide you through the universe of Lupen.\n\nYou’ll discover new worlds, build your fortune through trade, strengthen your fleet and fight for your place among the stars. There is no single path ahead of you. This journey will become whatever you choose to make it.",
  actionLabel: "Begin your journey"
});
const TUTORIAL_TRADE_ROUTE = Object.freeze({
  origin: "Asteron Prime",
  good: "Iron",
  destination: "Virella"
});
const TUTORIAL_ACADEMY_MILESTONES = Object.freeze([
  Object.freeze({
    missionId: "academy_starter_ship",
    shortLabel: "Claim Hunter",
    stepIds: Object.freeze(["open-hangar-first-ship", "buy-first-ship", "open-first-loadout", "review-first-loadout"])
  }),
  Object.freeze({
    missionId: "academy_first_trade",
    shortLabel: "Complete Trade",
    stepIds: Object.freeze([
      "return-after-first-loadout",
      "open-trade",
      "select-market-resource",
      "review-market-buy-price",
      "review-market-sell-price",
      "select-market-target",
      "buy-cargo",
      "return-to-station-for-launch",
      "map-route",
      "make-jump",
      "land-destination",
      "open-trade-to-sell",
      "sell-cargo"
    ])
  }),
  Object.freeze({
    missionId: "academy_launch_ship",
    shortLabel: "Launch",
    stepIds: Object.freeze(["launch"])
  }),
  Object.freeze({
    missionId: "academy_two_guns",
    shortLabel: "Equip Guns",
    stepIds: Object.freeze([
      "return-after-trade",
      "open-store",
      "buy-equipment",
      "buy-second-weapon",
      "buy-store-attachment",
      "return-after-store",
      "open-hangar-equip",
      "open-vessel-exchange-equip",
      "open-loadout-equip",
      "equip-item",
      "equip-second-item"
    ])
  }),
  Object.freeze({
    missionId: "academy_attachment",
    shortLabel: "Fit Equipment",
    stepIds: Object.freeze(["open-attachment-loadout", "equip-attachment", "return-after-equip"])
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
const TUTORIAL_MORGAN_PORTRAITS = Object.freeze({
  command: "assets/morgan-journey-guide.png",
  trade: "assets/morgan-trade-advisor.png",
  tactical: "assets/morgan-tactical-liaison.png",
  journey: "assets/morgan-journey-guide.png"
});
const TUTORIAL_DAILY_CONTRACT_INTRO_STEP_IDS = Object.freeze([
  "review-daily-contracts",
  "close-daily-contracts"
]);
const TUTORIAL_DAILY_CONTRACT_STEP_IDS = Object.freeze([
  ...TUTORIAL_DAILY_CONTRACT_INTRO_STEP_IDS,
  "accept-daily-contract",
  "return-after-daily-contract-accept",
  "launch-daily-contract",
  "map-daily-contract-route",
  "jump-daily-contract-route",
  "land-daily-contract-destination",
  "open-trade-complete-daily",
  "complete-daily-contract"
]);
const TUTORIAL_TRADE_PORTRAIT_STEPS = new Set(
  [
    ...TUTORIAL_ACADEMY_MILESTONES
      .filter(milestone => ["academy_first_trade", "academy_launch_ship"].includes(milestone.missionId))
      .flatMap(milestone => [...milestone.stepIds]),
    ...TUTORIAL_DAILY_CONTRACT_STEP_IDS
  ]
);
const TUTORIAL_TACTICAL_PORTRAIT_STEPS = new Set(
  TUTORIAL_ACADEMY_MILESTONES
    .filter(milestone => ["academy_two_guns", "academy_attachment", "academy_erebus_bots", "academy_bounty"].includes(milestone.missionId))
    .flatMap(milestone => [...milestone.stepIds])
);
const TUTORIAL_JOURNEY_PORTRAIT_STEPS = new Set([
  "open-forge",
  "forge-upgrade-weapon",
  "return-after-forge",
  "repair-reminder",
  "repair-ship",
  "complete"
]);
let tutorialState = loadTutorialState();
let tutorialAdvanceTimeout = null;

function repairProgressFromCompletedStarterTutorial() {
  if (!tutorialState?.completed || !missionProgress?.missions) return false;
  const completedAt = new Date().toISOString();
  TUTORIAL_ACADEMY_MILESTONES.forEach(({ missionId }) => {
    const mission = typeof MISSIONS_BY_ID !== "undefined" ? MISSIONS_BY_ID?.[missionId] : null;
    const state = missionProgress.missions[missionId];
    if (!mission || !state || ["completed", "claimed"].includes(state.state)) return;
    const required = typeof getMissionRequiredAmount === "function" ? getMissionRequiredAmount(mission) : 1;
    state.progress = Math.max(1, Number(required || 1));
    state.state = "completed";
    state.completedAt = state.completedAt || completedAt;
  });
  if (typeof reconcileMissionAvailability === "function") reconcileMissionAvailability(missionProgress);

  playerProgress = normalizePlayerProgress(playerProgress);
  const totals = playerProgress.totals;
  const quote = getTutorialTradeQuote();
  totals.botsDestroyed = Math.max(3, Number(totals.botsDestroyed || 0));
  totals.erebusBotsDestroyed = Math.max(3, Number(totals.erebusBotsDestroyed || 0));
  totals.tradesCompleted = Math.max(1, Number(totals.tradesCompleted || 0));
  totals.tradeProfit = Math.max(1, Number(totals.tradeProfit || 0), Number(quote.projectedProfit || 0));
  totals.totalTradingProfit = Math.max(Number(totals.totalTradingProfit || 0), totals.tradeProfit);
  totals.cargoSold = Math.max(1, Number(totals.cargoSold || 0), Number(quote.units || 0));
  totals.bountiesClaimed = Math.max(1, Number(totals.bountiesClaimed || 0));
  return true;
}

window.repairProgressFromCompletedStarterTutorial = repairProgressFromCompletedStarterTutorial;

const STARTER_TUTORIAL_STEPS = [
  {
    id: "cinematic-welcome",
    title: TUTORIAL_INTRO_COPY.title,
    speaker: TUTORIAL_NARRATOR_LABEL,
    voiceCue: "tutorial_intro_welcome",
    text: TUTORIAL_INTRO_COPY.text,
    target: "#tutorialCinematicContinue",
    event: null,
    actionLabel: TUTORIAL_INTRO_COPY.actionLabel,
    manualOnly: true,
    intro: true,
    cinematic: true
  },
  {
    id: "welcome-new-pilot",
    title: "Academy link established",
    speaker: TUTORIAL_NARRATOR_LABEL,
    text: "Good. My signal is locked to your helm, and your Academy route is ready to unfold.",
    target: "#tutorialNextBtn",
    event: null,
    actionLabel: "Continue",
    manualOnly: true,
    intro: true,
    autoSkip: true
  },
  {
    id: "welcome-core-loop",
    title: "Open Journey",
    speaker: TUTORIAL_NARRATOR_LABEL,
    text: "Journey will guide you through the first steps of life in Lupen, Pilot. Each assignment will introduce you to something new and prepare you for the path ahead. Open it now, and I’ll show you where to begin.",
    target: "#journeyHubBtn",
    event: "openedJourney",
    actionLabel: "Open highlighted Journey"
  },
  {
    id: "welcome-academy",
    title: "Your Academy Assignments",
    speaker: TUTORIAL_NARRATOR_LABEL,
    text: "These are your Academy Assignments. Each one introduces a core part of life in Lupen, and Journey will track your progress as you complete it. Your first assignment is Claim Starter Ship. Take a moment to review the route, then select Continue when you’re ready.",
    target: null,
    event: null,
    actionLabel: "Continue",
    manualOnly: true
  },
  {
    id: "return-from-journey",
    title: "Begin your first assignment",
    speaker: TUTORIAL_NARRATOR_LABEL,
    text: "Your first assignment is Claim Starter Ship. Use Back when you’re ready, and I’ll guide you to the Hangar.",
    target: "#journeyScreen .screen-back-btn",
    event: "returnedToHub",
    actionLabel: "Use highlighted Back",
    cardless: true
  },
  {
    id: "open-hangar-first-ship",
    title: "Open Hangar Bay",
    text: "Every pilot needs a ship. Your first vessel, the Pioneer Hunter, is waiting for you in the Hangar Bay. Open it now and claim the ship that will carry you through the beginning of your journey.",
    target: ".hub-actions button[onclick='openHangar()']",
    event: "openedHangar"
  },
  {
    id: "buy-first-ship",
    title: "Claim Pioneer Hunter",
    text: "Your Pioneer Hunter is ready, Pilot. Claim your ship and let's continue with your journey.",
    target: "tutorial:firstShipBuy",
    event: "boughtFirstShip"
  },
  {
    id: "open-first-loadout",
    title: "Open Loadout",
    text: "Please navigate to the Loadout section, Pilot.",
    target: "tutorial:hangarLoadoutTab",
    event: "openedHangarLoadout"
  },
  {
    id: "review-first-loadout",
    title: "Your Loadout",
    speaker: TUTORIAL_NARRATOR_LABEL,
    text: "Here, you can check your ship’s statistics and hull condition, and equip the guns and attachments you’ll need for the journey ahead.",
    target: null,
    event: null,
    actionLabel: "Continue",
    manualOnly: true
  },
  {
    id: "return-after-first-loadout",
    title: "Return to station",
    text: "Next, please return to the station hub. Your first trade will show you how to buy resources, move them between worlds and sell them for a profit.",
    target: "#hangarScreen .screen-back-btn",
    event: "returnedToHub",
    place: "left"
  },
  {
    id: "open-trade",
    title: "Open Trade Terminal",
    text: "Please navigate to the Trade Terminal where you can compare prices across Lupen and find profitable trade routes.",
    target: "tutorial:planetTradeTerminal",
    event: "openedTradeTerminal"
  },
  {
    id: "select-market-resource",
    title: "Select a resource",
    text: "Buy low and sell high is the aim of the game here. In this instance, select Iron on the Market Board.",
    target: "tutorial:marketResourceIron",
    event: "selectedMarketResource"
  },
  {
    id: "review-market-buy-price",
    title: "Check your buy price",
    text: "You can currently purchase Iron on Asteron Prime for {tradeBuyPrice} credits per unit. This is your buy price. Select the highlighted price on the Market Board.",
    target: "tutorial:marketBuyPrice",
    event: "reviewedTutorialBuyPrice"
  },
  {
    id: "review-market-sell-price",
    title: "Compare the sell price",
    text: "Virella will pay {tradeSellPrice} credits per unit of Iron, which delivers a profit of {tradeProfitPerUnit} credits per unit sold. Please select the highlighted Virella price.",
    target: "tutorial:marketSellPrice",
    event: "reviewedTutorialSellPrice"
  },
  {
    id: "select-market-target",
    title: "Set cargo amount",
    text: "Select Max to invest {tradeInvestment} credits for {tradeUnits} units of Iron. If you sell this Iron at Virella, you will receive a return of {tradeRevenue} credits, which is a tidy profit of {tradeProjectedProfit} credits total.",
    target: "tutorial:marketMaxAmount",
    event: "selectedBuyAmount"
  },
  {
    id: "buy-cargo",
    title: "Accept trade",
    text: "Select the Purchase Cargo button to lock in this trade at the current buy price.",
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
    title: "Sell Cargo",
    text: "The next step would be to sell the iron. The profit is yours, Pilot. Use this to fund further trade routes.",
    target: "tutorial:sellCargo",
    event: "soldTradeCargo"
  },
  {
    id: "review-daily-contracts",
    title: "Meet Daily Contracts",
    text: "That was a live-market trade: you chose the cargo and margin. Daily Contracts are different—fixed packages, marked destinations, and guaranteed rewards. Open them for a quick look.",
    target: "tutorial:openDailyTradeContracts",
    event: "openedDailyTradeContracts"
  },
  {
    id: "close-daily-contracts",
    title: "Your Academy delivery",
    text: "Completing one Daily Contract is now an Academy assignment. Close this briefing, then we will load the Virella priority package and fly it cleanly to Nyxara.",
    target: "tutorial:closeDailyTradeContracts",
    event: "closedDailyTradeContracts"
  },
  {
    id: "accept-daily-contract",
    title: "Load the priority package",
    text: "Open Daily Contracts again and accept Priority Shipment. You are already docked at Virella, so the sealed cipher case will load straight into your hold.",
    target: "tutorial:acceptDailyTradeContract",
    event: "acceptedDailyTradeContract"
  },
  {
    id: "return-after-daily-contract-accept",
    title: "Back to the pad",
    text: "Package secured. Return to the station hub. Keep the seal intact and the route quiet; the reward is guaranteed when Nyxara signs it off.",
    target: "#marketScreen .screen-back-btn",
    event: "returnedToHub",
    place: "left"
  },
  {
    id: "launch-daily-contract",
    title: "Launch the courier run",
    text: "Launch from Virella. The contract is now your active objective, and I will keep the destination signal lit.",
    target: ".hub-launch-btn",
    event: "launched"
  },
  {
    id: "map-daily-contract-route",
    title: "Plot Nyxara",
    text: "Open Jump and follow the contract route. Courier work is simple on paper: one sealed package, one promised destination, no excuses in between.",
    target: "#jumpBtn",
    event: "openedSectorMap"
  },
  {
    id: "jump-daily-contract-route",
    title: "Carry the signal",
    text: "Follow the highlighted route to Nyxara. Let the Jump drive breathe between burns; rushing a courier lane is how pilots make expensive stories.",
    target: "dynamicTradeRoute",
    event: "jumpedNode"
  },
  {
    id: "land-daily-contract-destination",
    title: "Dock at Nyxara",
    text: "Nyxara is beneath you. Land and keep the package sealed until the Trade Terminal confirms delivery.",
    target: "#planetLandBtn",
    event: "landedOnPlanet",
    place: "left"
  },
  {
    id: "open-trade-complete-daily",
    title: "Open Trade Terminal",
    text: "Open the Trade Terminal. The courier desk will recognize the package and prepare the payout.",
    target: "tutorial:planetTradeTerminal",
    event: "openedTradeTerminal"
  },
  {
    id: "complete-daily-contract",
    title: "Complete delivery",
    text: "Complete the delivery. That is how a fixed contract should feel: clean cargo, clean arrival, clean credits.",
    target: "tutorial:completeDailyTradeContract",
    event: "completedDailyTradeContract"
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
    text: "Open the Store. The Hunter has a good heart, but a bare hull is only a promise. We are going to give it teeth and room to breathe.",
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
    id: "buy-second-weapon",
    title: "Buy second weapon",
    text: "Buy a second Pulse Laser. Two mounted weapons will give the Hunter a complete opening volley.",
    target: "tutorial:storePulseLaser",
    event: "boughtStoreGun"
  },
  {
    id: "buy-store-attachment",
    title: "Buy Cargo Pod",
    text: "Switching to Attachments now. Buy one Cargo Pod to expand the Hunter's trade capacity.",
    target: "tutorial:storeCargoPod",
    event: "boughtStoreAttachment"
  },
  {
    id: "return-after-store",
    title: "Return to station",
    text: "Your two Pulse Lasers and Cargo Pod are stored. Use Back to return to the station, then we will fit them in Hangar Bay.",
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
    id: "open-vessel-exchange-equip",
    title: "Open Vessel Exchange",
    text: "Open Vessel Exchange. This is where new hulls are claimed and purchased; your Pioneer Hunter should now be shown as owned.",
    target: "tutorial:vesselExchangeTab",
    event: "openedVesselExchange"
  },
  {
    id: "open-loadout-equip",
    title: "Open Loadout",
    text: "Now open Loadout. Purchased equipment remains in the vault until you choose the ship and slot that will carry it.",
    target: "tutorial:hangarLoadoutTab",
    event: "openedHangarLoadout"
  },
  {
    id: "equip-item",
    title: "Equip first weapon",
    text: "Fit the first Pulse Laser into the Hunter's highlighted weapon slot.",
    target: "tutorial:spareWeapon",
    event: "equippedItem"
  },
  {
    id: "equip-second-item",
    title: "Equip second weapon",
    text: "Equip the second Pulse Laser. Loadout fills the first empty weapon slot automatically, giving the Hunter a complete volley.",
    target: "tutorial:spareWeapon",
    event: "equippedItem"
  },
  {
    id: "open-attachment-loadout",
    title: "Open Attachments",
    text: "Switch the Loadout vault to Attachments so we can fit the Cargo Pod you purchased.",
    target: "#loadoutCategoryAttachments",
    event: "openedAttachmentLoadout"
  },
  {
    id: "equip-attachment",
    title: "Equip Cargo Pod",
    text: "Fit the Cargo Pod into an equipment slot. Attachments shape a ship beyond its weapons, and this one expands your trade capacity.",
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
    text: "Open the Bounty Board. Out here, a weapon is not decoration; it is a promise to keep the lanes alive.",
    target: ".hub-actions button[onclick='openBountyBoard()']",
    event: "openedBountyBoard"
  },
  {
    id: "accept-bounty",
    title: "Accept bounty",
    text: "Accept the one-target Academy bounty. Destroying one Erebus bot will complete it; ordinary contracts become more demanding after orientation.",
    target: ".bounty-detail-panel button, .bounty-action-btn",
    event: "acceptedBounty"
  },
  {
    id: "return-for-combat-launch",
    title: "Back to station",
    text: "Use Back to return to the station hub. From there, launch the Hunter into orbit and prepare to scan for hostile signals.",
    target: "#bountyScreen .screen-back-btn",
    event: "returnedToHub",
    place: "left"
  },
  {
    id: "launch-for-combat",
    title: "Launch for combat",
    text: "Launch the Hunter. Your bounty stays active in orbit, and Morgan will guide you through a Bots scan before you choose a route.",
    target: ".hub-launch-btn",
    event: "launched"
  },
  {
    id: "open-map-for-bounty",
    title: "Open sector map",
    text: "Wait for the Jump bar to charge, then open Jump. We will scan the sector for hostile bot signals before moving.",
    target: "#jumpBtn",
    event: "openedSectorMap"
  },
  {
    id: "scan-for-bots",
    title: "Scan for bots",
    text: "Select Bots to reveal hostile signals on the map. Scanning first shows you where the contract targets are before you commit to a route.",
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
    title: "Destroy the bounty target",
    text: "Use Jump, Bots scan, and ENGAGE to bring down one Erebus bot. When it breaks, do not linger in the sparks. Disengage, breathe, and come home for the payout.",
    target: "tutorial:destroyBountyBot",
    event: ["destroyedBountyBot", "openedSectorMap", "scannedBots", "jumpedNode"],
    place: "left"
  },
  {
    id: "open-map-return-bounty",
    title: "Return to a planet",
    text: "Bounty complete. Do not stay for the rest of the patrol—open the sector map and return to a planet. Rewards and repairs are handled while docked.",
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
    text: "Open the Forge. Lupen Shards are not just salvage; they are pressure, memory, and power waiting to be shaped.",
    target: ".hub-actions button[onclick='openUpgradeForge()']",
    event: "openedForge"
  },
  {
    id: "forge-upgrade-weapon",
    title: "Upgrade Pulse Laser",
    text: "Your Academy bounty funds this first upgrade. The equipped Pulse Laser is selected; press the highlighted upgrade button to raise it from Level I to Level II.",
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
    text: "Open Hangar and check the Hunter's hull. Every pilot comes back marked by something; the professional ones repair before the next burn.",
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
    text: "You have the fundamentals, {pilot}. Open Journey and finish the remaining Academy assignments, including one guaranteed Daily Contract delivery. Across the Pioneer Line, the Freighter or Destroyer are natural next hulls, with the Behemoth farther ahead. Earn a second Pioneer hull to unlock Frontier. Good luck out there—I will be with you for the road ahead.",
    target: "#tutorialNextBtn",
    event: null,
    actionLabel: "Continue my journey",
    manualOnly: true,
    outro: true
  }
];

const TUTORIAL_FLOW_V2_ADDED_STEP_IDS = new Set([
  "review-market-buy-price",
  "review-market-sell-price",
  "buy-second-weapon",
  "buy-store-attachment",
  "open-vessel-exchange-equip",
  "open-loadout-equip",
  "equip-second-item",
  "select-second-weapon-slot",
  "open-attachment-loadout"
]);
const TUTORIAL_FLOW_V4_ADDED_STEP_IDS = new Set(TUTORIAL_DAILY_CONTRACT_INTRO_STEP_IDS);
const TUTORIAL_FLOW_V5_ADDED_STEP_IDS = new Set(
  TUTORIAL_DAILY_CONTRACT_STEP_IDS.filter(stepId => !TUTORIAL_DAILY_CONTRACT_INTRO_STEP_IDS.includes(stepId))
);
const TUTORIAL_FLOW_V6_ADDED_STEP_IDS = new Set(["return-from-journey"]);
const TUTORIAL_FLOW_V7_ADDED_STEP_IDS = new Set(["review-first-loadout"]);

function migrateTutorialStateToCurrentFlow() {
  const savedStepId = String(tutorialState.stepId || "");
  let nextIndex = savedStepId === "select-second-weapon-slot"
    ? STARTER_TUTORIAL_STEPS.findIndex(step => step.id === "equip-second-item")
    : savedStepId
    ? STARTER_TUTORIAL_STEPS.findIndex(step => step.id === savedStepId)
    : -1;

  if (
    Number(tutorialState.flowVersion || 0) === 2 &&
    ["select-market-target", "buy-cargo"].includes(savedStepId)
  ) {
    nextIndex = STARTER_TUTORIAL_STEPS.findIndex(step => step.id === "review-market-buy-price");
  }

  if (Number(tutorialState.flowVersion || 0) < 5 && savedStepId === "return-after-trade") {
    nextIndex = STARTER_TUTORIAL_STEPS.findIndex(step => step.id === "accept-daily-contract");
  }

  if (nextIndex < 0 && Number(tutorialState.flowVersion || 0) < TUTORIAL_FLOW_VERSION) {
    const legacySteps = STARTER_TUTORIAL_STEPS.filter(step => (
      !TUTORIAL_FLOW_V2_ADDED_STEP_IDS.has(step.id) &&
      !TUTORIAL_FLOW_V4_ADDED_STEP_IDS.has(step.id) &&
      !TUTORIAL_FLOW_V5_ADDED_STEP_IDS.has(step.id) &&
      !TUTORIAL_FLOW_V6_ADDED_STEP_IDS.has(step.id) &&
      !TUTORIAL_FLOW_V7_ADDED_STEP_IDS.has(step.id)
    ));
    const legacyStep = legacySteps[Math.min(Math.max(0, tutorialState.stepIndex), legacySteps.length - 1)];
    nextIndex = STARTER_TUTORIAL_STEPS.findIndex(step => step.id === legacyStep?.id);
  }

  tutorialState.stepIndex = nextIndex >= 0
    ? nextIndex
    : Math.min(Math.max(0, tutorialState.stepIndex), STARTER_TUTORIAL_STEPS.length - 1);
  tutorialState.stepId = STARTER_TUTORIAL_STEPS[tutorialState.stepIndex]?.id || "";
  tutorialState.flowVersion = TUTORIAL_FLOW_VERSION;
}

migrateTutorialStateToCurrentFlow();

const TUTORIAL_PROGRESS_PHASES = Object.freeze([
  Object.freeze({
    label: "Briefing",
    stepIds: Object.freeze(["cinematic-welcome", "welcome-new-pilot", "welcome-core-loop", "welcome-academy", "return-from-journey"])
  }),
  Object.freeze({
    label: "Ship",
    stepIds: TUTORIAL_ACADEMY_MILESTONES[0].stepIds
  }),
  Object.freeze({
    label: "Trade",
    stepIds: Object.freeze([
      ...TUTORIAL_ACADEMY_MILESTONES[1].stepIds,
      ...TUTORIAL_DAILY_CONTRACT_STEP_IDS,
      ...TUTORIAL_ACADEMY_MILESTONES[2].stepIds
    ])
  }),
  Object.freeze({
    label: "Loadout",
    stepIds: Object.freeze([
      ...TUTORIAL_ACADEMY_MILESTONES[3].stepIds,
      ...TUTORIAL_ACADEMY_MILESTONES[4].stepIds
    ])
  }),
  Object.freeze({
    label: "Bounty",
    stepIds: Object.freeze([
      ...TUTORIAL_ACADEMY_MILESTONES[5].stepIds,
      ...TUTORIAL_ACADEMY_MILESTONES[6].stepIds
    ])
  }),
  Object.freeze({
    label: "Forge",
    stepIds: Object.freeze(["open-forge", "forge-upgrade-weapon", "return-after-forge"])
  }),
  Object.freeze({
    label: "Repair",
    stepIds: TUTORIAL_ACADEMY_MILESTONES[7].stepIds
  }),
  Object.freeze({
    label: "Journey",
    stepIds: Object.freeze(["complete"])
  })
]);

function loadTutorialState() {
  const parsed = LupenSaveService.readJsonLocalStorage(TUTORIAL_STORAGE_KEY, {});
  return normalizeTutorialState(parsed);
}

function normalizeTutorialState(raw = {}) {
  return {
    active: Boolean(raw.active),
    completed: Boolean(raw.completed),
    stepIndex: Math.max(0, Number(raw.stepIndex || 0)),
    lastStartedAt: raw.lastStartedAt || null,
    pilotId: String(raw.pilotId || ""),
    journeyIntroduced: Boolean(raw.journeyIntroduced),
    forgeStarterShardsReconciled: Boolean(raw.forgeStarterShardsReconciled),
    stepId: String(raw.stepId || ""),
    flowVersion: Math.max(0, Number(raw.flowVersion || 0))
  };
}

function getTutorialSaveState() {
  const snapshot = normalizeTutorialState(tutorialState);
  const stepIndex = Math.min(Math.max(0, Number(snapshot.stepIndex || 0)), STARTER_TUTORIAL_STEPS.length - 1);
  return {
    ...snapshot,
    stepIndex,
    stepId: STARTER_TUTORIAL_STEPS[stepIndex]?.id || snapshot.stepId || "",
    flowVersion: TUTORIAL_FLOW_VERSION
  };
}

function checkpointTutorialSave() {
  if (window.__lupenTutorialSaveCheckpointInFlight) return;
  if (typeof saveGame !== "function") return;
  window.__lupenTutorialSaveCheckpointInFlight = true;
  try {
    saveGame({ tutorialCheckpoint: true });
  } finally {
    window.__lupenTutorialSaveCheckpointInFlight = false;
  }
}

function saveTutorialState(options = {}) {
  tutorialState.stepIndex = Math.min(Math.max(0, Number(tutorialState.stepIndex || 0)), STARTER_TUTORIAL_STEPS.length - 1);
  tutorialState.stepId = STARTER_TUTORIAL_STEPS[tutorialState.stepIndex]?.id || "";
  tutorialState.flowVersion = TUTORIAL_FLOW_VERSION;
  LupenSaveService.writeJsonLocalStorage(TUTORIAL_STORAGE_KEY, tutorialState);
  if (options.checkpoint !== false) checkpointTutorialSave();
}

function restoreTutorialStateFromSave(savedTutorialState, options = {}) {
  if (!savedTutorialState || typeof savedTutorialState !== "object") return false;
  const restored = normalizeTutorialState(savedTutorialState);
  const stepIndexFromId = restored.stepId
    ? STARTER_TUTORIAL_STEPS.findIndex(step => step.id === restored.stepId)
    : -1;
  restored.stepIndex = stepIndexFromId >= 0
    ? stepIndexFromId
    : Math.min(Math.max(0, restored.stepIndex), STARTER_TUTORIAL_STEPS.length - 1);
  restored.stepId = STARTER_TUTORIAL_STEPS[restored.stepIndex]?.id || "";
  restored.flowVersion = TUTORIAL_FLOW_VERSION;
  tutorialState = restored;
  saveTutorialState({ checkpoint: options.checkpoint === true });
  if (options.render === true && tutorialState.active) renderStarterTutorial();
  return true;
}

function getCurrentTutorialStep() {
  return STARTER_TUTORIAL_STEPS[Math.min(tutorialState.stepIndex, STARTER_TUTORIAL_STEPS.length - 1)];
}

function getTutorialPilotIdentity() {
  const accountKey = typeof STORAGE_ACCOUNT_KEY !== "undefined" ? STORAGE_ACCOUNT_KEY : LupenSaveService.storageKeys.account;
  const account = LupenSaveService.readJsonLocalStorage(accountKey, {});
  return {
    id: String(account?.id || ""),
    name: String(account?.pilot_name || account?.username || "Pilot").trim() || "Pilot"
  };
}

function formatTutorialCopy(value) {
  const quote = getTutorialTradeQuote();
  const replacements = {
    "{pilot}": getTutorialPilotIdentity().name,
    "{tradeBuyPrice}": formatNumber(quote.buyPrice),
    "{tradeSellPrice}": formatNumber(quote.sellPrice),
    "{tradeProfitPerUnit}": formatNumber(quote.profitPerUnit),
    "{tradeUnits}": formatNumber(quote.units),
    "{tradeInvestment}": formatNumber(quote.investment),
    "{tradeRevenue}": formatNumber(quote.revenue),
    "{tradeProjectedProfit}": formatNumber(quote.projectedProfit)
  };
  return Object.entries(replacements).reduce(
    (copy, [token, replacement]) => copy.replaceAll(token, replacement),
    String(value || "")
  );
}

function getTutorialAcademyMilestone(stepId = getCurrentTutorialStep()?.id) {
  if (TUTORIAL_DAILY_CONTRACT_STEP_IDS.includes(stepId)) {
    return {
      missionId: "academy_daily_contract",
      shortLabel: "Daily Contract",
      stepIds: TUTORIAL_DAILY_CONTRACT_STEP_IDS
    };
  }
  return TUTORIAL_ACADEMY_MILESTONES.find(milestone => milestone.stepIds.includes(stepId)) || null;
}

function getTutorialMorganPortrait(step = getCurrentTutorialStep()) {
  const stepId = String(step?.id || "");
  if (TUTORIAL_TRADE_PORTRAIT_STEPS.has(stepId)) return TUTORIAL_MORGAN_PORTRAITS.trade;
  if (TUTORIAL_TACTICAL_PORTRAIT_STEPS.has(stepId)) return TUTORIAL_MORGAN_PORTRAITS.tactical;
  if (TUTORIAL_JOURNEY_PORTRAIT_STEPS.has(stepId)) return TUTORIAL_MORGAN_PORTRAITS.journey;
  return TUTORIAL_MORGAN_PORTRAITS.command;
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

  if (["welcome-academy", "return-from-journey"].includes(step?.id)) {
    const mission = getTutorialAcademyMission("academy_starter_ship");
    const state = getTutorialAcademyMissionState("academy_starter_ship");
    const required = Math.max(1, Number(mission?.objective?.required || 1));
    const missionProgressValue = Math.min(required, Math.max(0, Number(state?.progress || 0)));
    const complete = isTutorialAcademyMissionComplete(state);
    tracker.hidden = false;
    tracker.classList.remove("is-overview");
    tracker.innerHTML = `
      <span class="tutorial-academy-kicker">Next Academy Assignment</span>
      <strong>${escapeHtml(mission?.title || "Claim Starter Ship")}</strong>
      <span class="tutorial-academy-status ${complete ? "is-complete" : ""}">${complete ? "Complete" : `${formatNumber(missionProgressValue)} / ${formatNumber(required)}`}</span>
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

function getTutorialStoredGunCount() {
  const ownedCount = Object.values(ownedGuns || {}).reduce((total, count) => total + Math.max(0, Number(count || 0)), 0);
  const inventoryCount = Array.isArray(inventoryItems)
    ? inventoryItems.filter(item => GUNS?.[item?.key]).length
    : 0;
  return ownedCount + inventoryCount;
}

function getTutorialTotalGunCount() {
  return getTutorialEquippedGunCount() + getTutorialStoredGunCount();
}

function getTutorialCargoPodCount() {
  const equippedCount = (getTutorialShipLoadout().attachments || [])
    .filter(entry => tutorialEntryKey(entry) === "cargoPod").length;
  const ownedCount = Math.max(0, Number(ownedAttachments?.cargoPod || 0));
  const inventoryCount = Array.isArray(inventoryItems)
    ? inventoryItems.filter(item => item?.key === "cargoPod").length
    : 0;
  return equippedCount + ownedCount + inventoryCount;
}

function hasTutorialPurchasedLoadoutKit() {
  return getTutorialTotalGunCount() >= 2 && getTutorialCargoPodCount() >= 1;
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

function getTutorialTradeQuote() {
  const priceGetter = typeof getLiveMarketPrice === "function"
    ? getLiveMarketPrice
    : typeof getMapOneMarketPrice === "function"
      ? getMapOneMarketPrice
      : () => 0;
  const buyPrice = Math.max(0, Number(priceGetter(TUTORIAL_TRADE_ROUTE.good, TUTORIAL_TRADE_ROUTE.origin) || 0));
  const sellPrice = Math.max(buyPrice + 1, Number(priceGetter(TUTORIAL_TRADE_ROUTE.good, TUTORIAL_TRADE_ROUTE.destination) || 0));
  const limit = typeof getMarketMaxBuyQuantity === "function"
    ? getMarketMaxBuyQuantity(TUTORIAL_TRADE_ROUTE.good, TUTORIAL_TRADE_ROUTE.origin)
    : typeof getMarketQuantityLimit === "function"
      ? getMarketQuantityLimit("buy")
      : 1;
  const units = Math.max(1, Number(limit || 1));
  const profitPerUnit = Math.max(1, sellPrice - buyPrice);
  return {
    buyPrice,
    sellPrice,
    profitPerUnit,
    units,
    investment: buyPrice * units,
    revenue: sellPrice * units,
    projectedProfit: profitPerUnit * units
  };
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
    "review-market-buy-price",
    "review-market-sell-price",
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
  const quote = getTutorialTradeQuote();
  const buy = quote.buyPrice;
  const sell = quote.sellPrice;
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
  if (step.autoSkip) return "superseded_intro_step";
  const starterShipId = getStarterShipId();
  switch (step.id) {
    case "buy-first-ship":
      return currentShipId === starterShipId && ownedShips.includes(starterShipId) ? "starter_ship_active" : "";
    case "select-market-resource":
    case "review-market-buy-price":
    case "review-market-sell-price":
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
    case "review-daily-contracts":
      return typeof tradeContractsExpanded !== "undefined" && tradeContractsExpanded
        ? "daily_contracts_already_open"
        : "";
    case "close-daily-contracts":
      return typeof tradeContractsExpanded !== "undefined" && !tradeContractsExpanded
        ? "daily_contracts_already_closed"
        : "";
    case "open-store":
      return hasTutorialPurchasedLoadoutKit() ? "starter_loadout_kit_ready" : "";
    case "buy-equipment":
      return getTutorialTotalGunCount() >= 1 ? "first_weapon_owned" : "";
    case "buy-second-weapon":
      return getTutorialTotalGunCount() >= 2 ? "second_weapon_owned" : "";
    case "buy-store-attachment":
      return getTutorialCargoPodCount() >= 1 ? "cargo_pod_owned" : "";
    case "return-after-store":
      return hasTutorialTwoGunsEquipped() && hasTutorialAttachmentEquipped() ? "starter_loadout_already_fitted" : "";
    case "open-hangar-equip":
      return hasTutorialTwoGunsEquipped() && hasTutorialAttachmentEquipped() ? "starter_loadout_already_fitted" : "";
    case "open-vessel-exchange-equip":
      if (hasTutorialTwoGunsEquipped() && hasTutorialAttachmentEquipped()) return "starter_loadout_already_fitted";
      return document.getElementById("hangarShipyardSection")?.classList.contains("active") ? "vessel_exchange_open" : "";
    case "open-loadout-equip":
      if (hasTutorialTwoGunsEquipped() && hasTutorialAttachmentEquipped()) return "starter_loadout_already_fitted";
      return document.getElementById("hangarOverviewSection")?.classList.contains("active") ? "loadout_open" : "";
    case "equip-item":
      if (document.getElementById("hangarScreen")?.classList.contains("active")) return "";
      return getTutorialEquippedGunCount() >= 1 ? "first_weapon_equipped" : "";
    case "equip-second-item":
      if (document.getElementById("hangarScreen")?.classList.contains("active")) return "";
      if (hasTutorialTwoGunsEquipped()) return "two_guns_equipped";
      if (!hasOpenTutorialWeaponSlot() && hasTutorialCombatWeaponEquipped()) return "weapon_slots_filled";
      return "";
    case "open-attachment-loadout":
      if (hasTutorialAttachmentEquipped()) return "attachment_already_equipped";
      return typeof selectedLoadoutSlotCategory !== "undefined" && selectedLoadoutSlotCategory === "attachments"
        ? "attachment_loadout_open"
        : "";
    case "equip-attachment":
      if (document.getElementById("hangarScreen")?.classList.contains("active")) return "";
      return hasTutorialAttachmentEquipped() ? "attachment_equipped" : "";
    case "return-after-equip":
      if (document.getElementById("hangarScreen")?.classList.contains("active")) return "";
      return hasTutorialAttachmentEquipped() ? "attachment_equipped" : "";
    case "accept-bounty":
      return isTutorialBountyAccepted() ? "bounty_already_active" : "";
    case "return-for-combat-launch":
      return document.getElementById("gameScreen")?.classList.contains("active")
        ? "station_hub_open"
        : "";
    case "launch-for-combat":
      return document.getElementById("spaceScreen")?.classList.contains("active")
        ? "already_in_orbit"
        : "";
    case "open-map-for-bounty":
      return document.getElementById("sectorMap")?.classList.contains("active")
        ? "sector_map_open"
        : "";
    case "jump-to-bounty-zone":
      return isAtTutorialBountyCombatTarget() ? "bounty_target_reached" : "";
    case "destroy-bot":
    case "open-map-return-bounty":
    case "return-to-planet-after-bounty":
    case "land-after-bounty":
      return isTutorialBountyReadyToClaim() ? "bounty_ready_to_claim" : "";
    case "claim-bounty": {
      const stagingClaim = typeof getMultiplayerStagingBountyStatus === "function"
        ? getMultiplayerStagingBountyStatus()?.lastStagingBountyClaimResult
        : null;
      const tutorialStartedAt = Date.parse(tutorialState?.lastStartedAt || "") || 0;
      const stagingClaimReceivedAt = Number(stagingClaim?.receivedAt || 0);
      const stagingClaimIsCurrent = Boolean(stagingClaim) &&
        (!stagingClaimReceivedAt || !tutorialStartedAt || stagingClaimReceivedAt >= tutorialStartedAt);
      const bountyClaimed = !activeObjective && Number(playerProgress?.totals?.bountiesClaimed || 0) > 0 ||
        stagingClaimIsCurrent && Boolean(stagingClaim?.applied || stagingClaim?.playerSavePatchResult?.applied || stagingClaim?.playerSave?.written || stagingClaim?.bounty?.claimed);
      return bountyClaimed ? "bounty_already_claimed" : "";
    }
    case "continue-after-bounty-reward": {
      const rewardOverlayPending = document.getElementById("bountyRewardOverlay")?.dataset?.rewardPending === "true";
      if (rewardOverlayPending) return "";
      const stagingClaim = typeof getMultiplayerStagingBountyStatus === "function"
        ? getMultiplayerStagingBountyStatus()?.lastStagingBountyClaimResult
        : null;
      const tutorialStartedAt = Date.parse(tutorialState?.lastStartedAt || "") || 0;
      const stagingClaimReceivedAt = Number(stagingClaim?.receivedAt || 0);
      const stagingClaimIsCurrent = Boolean(stagingClaim) &&
        (!stagingClaimReceivedAt || !tutorialStartedAt || stagingClaimReceivedAt >= tutorialStartedAt);
      const bountyClaimed = !activeObjective && Number(playerProgress?.totals?.bountiesClaimed || 0) > 0 ||
        stagingClaimIsCurrent && Boolean(stagingClaim?.applied || stagingClaim?.playerSavePatchResult?.applied || stagingClaim?.playerSave?.written || stagingClaim?.bounty?.claimed);
      return bountyClaimed ? "reward_overlay_already_closed" : "";
    }
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
  if (
    document.getElementById("storeScreen")?.classList.contains("active") &&
    ["buy-equipment", "buy-second-weapon", "buy-store-attachment"].includes(getCurrentTutorialStep()?.id) &&
    typeof renderStore === "function"
  ) {
    setTimeout(renderStore, 0);
  }
}

function reconcileTutorialStepWithCurrentState() {
  if (!tutorialState.active) return;
  for (let guard = 0; guard < STARTER_TUTORIAL_STEPS.length; guard += 1) {
    const step = getCurrentTutorialStep();
    if (step?.id === "land-daily-contract-destination" && !isAtActiveDailyTradeDestination()) {
      const routeStepIndex = STARTER_TUTORIAL_STEPS.findIndex(item => item.id === "jump-daily-contract-route");
      if (routeStepIndex >= 0) {
        tutorialState.stepIndex = routeStepIndex;
        saveTutorialState();
        return;
      }
    }
    const loadoutSequence = [
      "return-after-store",
      "open-hangar-equip",
      "open-vessel-exchange-equip",
      "open-loadout-equip",
      "equip-item",
      "equip-second-item",
      "open-attachment-loadout",
      "equip-attachment"
    ];
    if (loadoutSequence.includes(step?.id) && !hasTutorialPurchasedLoadoutKit()) {
      const targetStepId = getTutorialTotalGunCount() < 1
        ? "buy-equipment"
        : getTutorialTotalGunCount() < 2
          ? "buy-second-weapon"
          : "buy-store-attachment";
      const nextStepId = document.getElementById("storeScreen")?.classList.contains("active")
        ? targetStepId
        : "open-store";
      const nextIndex = STARTER_TUTORIAL_STEPS.findIndex(item => item.id === nextStepId);
      if (nextIndex >= 0) {
        tutorialState.stepIndex = nextIndex;
        saveTutorialState();
        return;
      }
    }
    if (
      ["equip-item", "equip-second-item", "open-attachment-loadout", "equip-attachment"].includes(step?.id) &&
      !(hasTutorialTwoGunsEquipped() && hasTutorialAttachmentEquipped())
    ) {
      const storeOpen = document.getElementById("storeScreen")?.classList.contains("active");
      const hangarOpen = document.getElementById("hangarScreen")?.classList.contains("active");
      if (storeOpen) {
        const returnIndex = STARTER_TUTORIAL_STEPS.findIndex(item => item.id === "return-after-store");
        tutorialState.stepIndex = returnIndex;
        saveTutorialState();
        return;
      }
      if (!hangarOpen) {
        const hangarIndex = STARTER_TUTORIAL_STEPS.findIndex(item => item.id === "open-hangar-equip");
        tutorialState.stepIndex = hangarIndex;
        saveTutorialState();
        return;
      }
    }
    if (
      step?.id === "welcome-academy" &&
      !tutorialState.journeyIntroduced &&
      document.getElementById("gameScreen")?.classList.contains("active") &&
      !document.getElementById("journeyScreen")?.classList.contains("active")
    ) {
      const journeyStep = STARTER_TUTORIAL_STEPS.findIndex(item => item.id === "welcome-core-loop");
      if (journeyStep >= 0) {
        tutorialState.stepIndex = journeyStep;
        saveTutorialState();
        return;
      }
    }
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
  const firstStep = STARTER_TUTORIAL_STEPS.findIndex(step => step.id === "cinematic-welcome");
  const pilotId = String(options.pilotId || getTutorialPilotIdentity().id || tutorialState.pilotId || "");
  tutorialState = {
    active: true,
    completed: false,
    stepIndex: reset ? Math.max(0, firstStep) : Math.min(tutorialState.stepIndex || 0, STARTER_TUTORIAL_STEPS.length - 1),
    lastStartedAt: reset ? new Date().toISOString() : (tutorialState.lastStartedAt || new Date().toISOString()),
    pilotId,
    journeyIntroduced: reset ? false : Boolean(tutorialState.journeyIntroduced),
    forgeStarterShardsReconciled: reset ? false : Boolean(tutorialState.forgeStarterShardsReconciled),
    stepId: reset ? STARTER_TUTORIAL_STEPS[Math.max(0, firstStep)]?.id || "" : String(tutorialState.stepId || ""),
    flowVersion: TUTORIAL_FLOW_VERSION
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
  saveTutorialState({ checkpoint: false });
  clearTutorialOverlayOnly();
  return {
    tutorialKeyCleared: TUTORIAL_STORAGE_KEY
  };
}

function clearStarterTutorialState() {
  LupenSaveService.removeLocalStorage(TUTORIAL_STORAGE_KEY);
  tutorialState = {
    active: false,
    completed: false,
    stepIndex: 0,
    lastStartedAt: null,
    pilotId: "",
    journeyIntroduced: false,
    forgeStarterShardsReconciled: false,
    stepId: "",
    flowVersion: TUTORIAL_FLOW_VERSION
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
window.getTutorialSaveState = getTutorialSaveState;
window.restoreTutorialStateFromSave = restoreTutorialStateFromSave;
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
  const originatingStepId = step.id;

  if (step.id === "review-daily-contracts" && eventName === "openedTradeTerminal") {
    if (tutorialAdvanceTimeout) clearTimeout(tutorialAdvanceTimeout);
    tutorialAdvanceTimeout = setTimeout(() => {
      if (tutorialState.active && getCurrentTutorialStep()?.id === "review-daily-contracts") {
        renderStarterTutorial();
      }
    }, 180);
    return;
  }

  const acceptedEvents = Array.isArray(step.event) ? step.event : [step.event];
  if (!acceptedEvents.includes(eventName)) return;

  if (step.id === "welcome-core-loop" && eventName === "openedJourney") {
    tutorialState.journeyIntroduced = true;
    saveTutorialState();
  }

  if (step.id === "make-jump" && eventName === "jumpedNode" && !isAtActiveTradeDestination()) {
    if (tutorialAdvanceTimeout) clearTimeout(tutorialAdvanceTimeout);
    tutorialAdvanceTimeout = setTimeout(() => {
      addHudToast("Continue along the highlighted route.");
      renderStarterTutorial();
    }, 180);
    return;
  }

  if (step.id === "jump-daily-contract-route" && eventName === "jumpedNode" && !isAtActiveDailyTradeDestination()) {
    if (tutorialAdvanceTimeout) clearTimeout(tutorialAdvanceTimeout);
    tutorialAdvanceTimeout = setTimeout(() => {
      addHudToast("Continue along the highlighted route to Nyxara.");
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
    if (getCurrentTutorialStep()?.id !== originatingStepId) return;
    tutorialState.stepIndex = Math.min(STARTER_TUTORIAL_STEPS.length - 1, tutorialState.stepIndex + 1);
    saveTutorialState();
    if (
      document.getElementById("storeScreen")?.classList.contains("active") &&
      ["buy-equipment", "buy-second-weapon", "buy-store-attachment"].includes(getCurrentTutorialStep()?.id) &&
      typeof renderStore === "function"
    ) {
      renderStore();
    } else {
      renderStarterTutorial();
    }
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

function getActiveDailyTradeDestination() {
  if (typeof getDailyTradeContract !== "function" || typeof activeDailyTradeContractId === "undefined") return null;
  return getDailyTradeContract(activeDailyTradeContractId)?.destination || null;
}

function isAtActiveDailyTradeDestination() {
  const destination = getActiveDailyTradeDestination();
  return Boolean(destination && currentNode === destination);
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

  if (step.target === "tutorial:vesselExchangeTab") {
    return document.querySelector("#hangarShipyardTab") || document.querySelector("[data-tutorial-target='vesselExchange']");
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

  if (step.target === "tutorial:marketBuyPrice") {
    return document.querySelector("[data-tutorial-target='marketBuyPrice']");
  }

  if (step.target === "tutorial:marketSellPrice") {
    return document.querySelector("[data-tutorial-target='marketSellPrice']");
  }

  if (step.target === "tutorial:openDailyTradeContracts") {
    const marketOpen = document.getElementById("marketScreen")?.classList.contains("active");
    if (!marketOpen) {
      return document.querySelector("[data-tutorial-target='planetTradeTerminal']") ||
             document.querySelector(".hub-actions button[onclick='openMarketplace()']");
    }
    return document.querySelector(".trade-v2-contract-strip-button") ||
           document.querySelector("[data-tutorial-target='planetTradeTerminal']");
  }

  if (step.target === "tutorial:closeDailyTradeContracts") {
    return document.querySelector(".trade-v2-contract-drawer-close");
  }

  if (step.target === "tutorial:acceptDailyTradeContract") {
    const acceptButton = document.querySelector("[data-tutorial-target='acceptDailyTradeContract']:not(:disabled)");
    return acceptButton ||
           document.querySelector(".trade-v2-contract-strip-button") ||
           document.querySelector("[data-tutorial-target='planetTradeTerminal']");
  }

  if (step.target === "tutorial:completeDailyTradeContract") {
    const completeButton = document.querySelector("[data-tutorial-target='completeDailyTradeContract']:not(:disabled)");
    return completeButton ||
           document.querySelector(".trade-v2-contract-strip-button") ||
           document.querySelector("[data-tutorial-target='planetTradeTerminal']");
  }

  if (step.target === "tutorial:storeCargoPod") {
    const selected = typeof getStoreSelectedItem === "function" ? getStoreSelectedItem() : null;
    const cargoBuy = document.querySelector(".store-detail-buy-action[data-item-key='cargoPod']:not(:disabled)");
    const cargoCard = document.querySelector(".store-catalog-card[data-item-key='cargoPod']:not(.sold-out)");

    if (selected?.key === "cargoPod" && cargoBuy) {
      return cargoBuy;
    }

    return cargoCard || cargoBuy || document.querySelector(".store-detail-actions button:not(:disabled)");
  }

  if (step.target === "tutorial:spareAttachment") {
    return document.querySelector("#gunInventory .hangar-equipment-card[data-item-key='cargoPod']:not(.unavailable)") ||
           document.querySelector("#gunInventory .hangar-equipment-card[data-item-type='attachment']:not(.unavailable)");
  }

  if (step.target === "tutorial:repairShip") {
    return document.querySelector("#hangarScreen button[onclick='repairCurrentShip()']:not(:disabled)") ||
           document.querySelector("#hangarScreen .loadout-repair-ready");
  }

  if (step.target === "tutorial:forgeUpgradeButton") {
    return document.querySelector("#forgeStartBtn:not(:disabled)") ||
           document.querySelector("#forgeStartBtn");
  }

  return null;
}


function findTutorialTarget(selector) {
  const step = getCurrentTutorialStep();
  const dynamicTarget = getDynamicTutorialTarget(step);
  if (isUsableTutorialTarget(dynamicTarget)) return dynamicTarget;

  if (!selector || selector.startsWith?.("tutorial:") || selector === "dynamicTradeRoute") return null;
  if (selector.includes("#planetLandBtn") && !isAtPlanetNode()) return null;
  if (step?.id === "land-daily-contract-destination" && !isAtActiveDailyTradeDestination()) return null;
  const selectors = selector.split(",").map(item => item.trim()).filter(Boolean);
  for (const item of selectors) {
    const found = Array.from(document.querySelectorAll(item)).find(isUsableTutorialTarget);
    if (found) return found;
  }
  return null;
}

function isUsableTutorialTarget(target) {
  if (!target?.isConnected) return false;
  if (target.matches?.("button:disabled, [aria-disabled='true']")) return false;
  const style = getComputedStyle(target);
  const rect = target.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}

function highlightTutorialTarget(step) {
  clearTutorialHighlight();
  syncPlanetLandingTarget();

  const target = findTutorialTarget(step?.target);
  const spotlight = document.getElementById("tutorialSpotlight");
  if (!target || !spotlight) return;

  if (["tutorial:storePulseLaser", "tutorial:storeCargoPod", "tutorial:openDailyTradeContracts", "tutorial:closeDailyTradeContracts", "tutorial:acceptDailyTradeContract", "tutorial:completeDailyTradeContract"].includes(step?.target)) {
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

function refreshTutorialTargetGeometry() {
  if (!tutorialState.active) return;
  const step = getCurrentTutorialStep();
  if (!step || step.intro || step.outro || step.cardless) return;
  highlightTutorialTarget(step);
  positionTutorialCard(step, getTutorialTargetElement());
}

function positionTutorialCard(step, target) {
  const overlay = document.getElementById("tutorialOverlay");
  const card = document.querySelector(".tutorial-card");
  if (!overlay || !card || !step || step.intro || step.outro || step.cardless) {
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
  const activeFrame = document.querySelector(
    "#gameScreen.active, #journeyScreen.active, #marketScreen.active, #hangarScreen.active, #spaceScreen.active, #bountyScreen.active, #storeScreen.active, #forgeScreen.active"
  );
  const frameRect = activeFrame?.getBoundingClientRect();
  const hasFrame = Boolean(frameRect && frameRect.width > margin * 2 && frameRect.height > margin * 2);
  const bounds = {
    left: hasFrame ? frameRect.left + margin : margin,
    top: hasFrame ? frameRect.top + margin : margin,
    right: hasFrame ? frameRect.right - margin : window.innerWidth - margin,
    bottom: hasFrame ? frameRect.bottom - margin : window.innerHeight - margin
  };
  const cardRect = card.getBoundingClientRect();
  const width = Math.min(cardRect.width || 342, bounds.right - bounds.left);
  const height = Math.min(cardRect.height || 220, bounds.bottom - bounds.top);
  let left = bounds.right - width;
  let top = bounds.top;

  if (step.place === "left") {
    left = bounds.left;
  } else if (step.place === "bottom") {
    left = bounds.left + ((bounds.right - bounds.left - width) / 2);
    top = bounds.bottom - height;
  } else if (target) {
    const rect = target.getBoundingClientRect();
    const frameWidth = bounds.right - bounds.left;
    const frameHeight = bounds.bottom - bounds.top;
    const frameCenter = bounds.left + frameWidth / 2;
    const targetIsLarge = rect.width > frameWidth * 0.5 || rect.height > frameHeight * 0.45;
    if (!targetIsLarge) {
      left = rect.left < frameCenter ? bounds.right - width : bounds.left;
      top = rect.top < bounds.top + frameHeight / 2 ? bounds.top : bounds.bottom - height;

      const overlapsTarget = () => {
        const right = left + width;
        const bottom = top + height;
        return left < rect.right + 14 && right > rect.left - 14 && top < rect.bottom + 14 && bottom > rect.top - 14;
      };

      if (overlapsTarget()) {
        const below = rect.bottom + 16;
        const above = rect.top - height - 16;
        top = below + height <= bounds.bottom ? below : Math.max(bounds.top, above);
      }
    }
  }

  left = Math.max(bounds.left, Math.min(left, bounds.right - width));
  top = Math.max(bounds.top, Math.min(top, bounds.bottom - height));
  card.style.setProperty("left", `${Math.round(left)}px`, "important");
  card.style.setProperty("right", "auto", "important");
  card.style.setProperty("top", `${Math.round(top)}px`, "important");
  card.style.setProperty("bottom", "auto", "important");
  card.style.setProperty("transform", "none", "important");
}

function isTutorialClickAllowed(event) {
  if (!tutorialState.active) return true;

  // Account/start screens are outside the tutorial. Never block Create Account/Login navigation.
  if (isAccountScreenActive()) return true;

  // Orientation persists safely across sessions, so pilots must always be able to log out.
  if (event.target.closest?.(".hub-logout-button, button[onclick='logout()']")) return true;

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

  if (["buy-equipment", "buy-second-weapon", "buy-store-attachment"].includes(step?.id)) {
    const requiredItemKey = step.id === "buy-store-attachment" ? "cargoPod" : "pulseLaser";
    const requiredCard = event.target.closest?.(`.store-catalog-card[data-item-key='${requiredItemKey}']`);
    const requiredBuy = event.target.closest?.(`.store-detail-buy-action[data-item-key='${requiredItemKey}']`);
    const selected = typeof getStoreSelectedItem === "function" ? getStoreSelectedItem() : null;
    const selectedBuy = selected?.key === requiredItemKey && event.target.closest?.(".store-detail-actions button");
    if (requiredCard || requiredBuy || selectedBuy) return true;
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
    overlay.classList.remove("tutorial-cinematic-active");
  }
  const cinematic = document.getElementById("tutorialCinematic");
  if (cinematic) cinematic.hidden = true;
  const card = overlay?.querySelector(".tutorial-card");
  if (card) card.hidden = false;
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
  const actions = overlay.querySelector(".tutorial-actions");
  const portrait = overlay.querySelector(".tutorial-morgan-portrait");
  const cinematic = document.getElementById("tutorialCinematic");
  const cinematicTitle = document.getElementById("tutorialCinematicTitle");
  const cinematicText = document.getElementById("tutorialCinematicText");
  const cinematicContinue = document.getElementById("tutorialCinematicContinue");
  const cinematicImage = cinematic?.querySelector(".tutorial-cinematic__image");
  const card = overlay.querySelector(".tutorial-card");
  const isCinematic = Boolean(step.cinematic);

  overlay.classList.add("active");
  overlay.classList.toggle("tutorial-intro-active", Boolean(step.intro && !isCinematic));
  overlay.classList.toggle("tutorial-cinematic-active", isCinematic);
  overlay.classList.toggle("tutorial-outro-active", Boolean(step.outro));
  overlay.classList.toggle("tutorial-left-card", step.place === "left");
  overlay.classList.toggle("tutorial-bottom-card", step.place === "bottom");
  if (title) title.textContent = formatTutorialCopy(step.title);
  if (text) text.textContent = formatTutorialCopy(step.text);
  if (cinematic) cinematic.hidden = !isCinematic;
  if (card) card.hidden = isCinematic || Boolean(step.cardless);
  if (isCinematic && cinematicImage && !cinematicImage.getAttribute("src")) {
    cinematicImage.src = cinematicImage.dataset.src || "assets/morgan-cinematic-welcome.png";
  }
  if (cinematicTitle) cinematicTitle.textContent = formatTutorialCopy(step.title);
  if (cinematicText) cinematicText.textContent = formatTutorialCopy(step.text);
  if (cinematicContinue) cinematicContinue.textContent = step.actionLabel || "Begin your journey";
  if (portrait) {
    portrait.src = getTutorialMorganPortrait(step);
    portrait.dataset.morganContext = TUTORIAL_TRADE_PORTRAIT_STEPS.has(step.id)
      ? "trade"
      : TUTORIAL_TACTICAL_PORTRAIT_STEPS.has(step.id)
        ? "tactical"
        : TUTORIAL_JOURNEY_PORTRAIT_STEPS.has(step.id)
          ? "journey"
          : "journey";
  }
  if (label) {
    const speaker = step.speaker || TUTORIAL_NARRATOR_LABEL;
    label.textContent = `${speaker} / ${TUTORIAL_PROGRAMME_LABEL}`;
  }
  renderTutorialAcademyTracker(step);
  if (isCinematic) {
    clearTutorialHighlight();
    return;
  }
  if (progress) {
    const phaseIndex = Math.max(
      0,
      TUTORIAL_PROGRESS_PHASES.findIndex(phase => phase.stepIds.includes(step.id))
    );
    progress.setAttribute(
      "aria-label",
      `Orientation progress: ${TUTORIAL_PROGRESS_PHASES[phaseIndex].label}, phase ${phaseIndex + 1} of ${TUTORIAL_PROGRESS_PHASES.length}`
    );
    progress.innerHTML = TUTORIAL_PROGRESS_PHASES.map((phase, index) => {
      const stateClass = index < phaseIndex ? "done" : index === phaseIndex ? "active" : "";
      const current = index === phaseIndex ? ' aria-current="step"' : "";
      return `<i class="${stateClass}" title="${phase.label}"${current}></i>`;
    }).join("");
  }
  if (next) {
    next.textContent = step.actionLabel || "Waiting for action";
    next.disabled = !step.manualOnly;
    next.classList.toggle("waiting", !step.manualOnly);
  }
  if (actions) actions.hidden = !step.manualOnly;
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
