const STORAGE_ACCOUNT_KEY = "sectorOneAccount";
const STORAGE_GAME_KEY = "lupenGameState";
const STORAGE_VAULT_RESET_KEY = "lupenVaultClearedForIntegratedHangarV2";

const mineralKeys = ["Iron", "Copper", "Cobalt", "Titanium", "Crystal Shards", "Xenon Gas", "Iridium", "Platinum", "Uranium", "Dark Matter Residue"];


const COMMODITY_ICON_PATH = "assets/commodities/";

const commodityInfo = {
  "Iron": {
    icon: `${COMMODITY_ICON_PATH}iron.png`,
    rarity: "Common",
    description: "Reliable industrial ore used in hull plating and station fabrication."
  },
  "Copper": {
    icon: `${COMMODITY_ICON_PATH}copper.png`,
    rarity: "Common",
    description: "Conductive base metal used in wiring, terminals and shield relays."
  },
  "Cobalt": {
    icon: `${COMMODITY_ICON_PATH}cobalt.png`,
    rarity: "Common",
    description: "Dense blue alloy material prized by weapons manufacturers."
  },
  "Titanium": {
    icon: `${COMMODITY_ICON_PATH}titanium.png`,
    rarity: "Industrial",
    description: "Lightweight structural metal used in ship frames and cargo bays."
  },
  "Crystal Shards": {
    icon: `${COMMODITY_ICON_PATH}crystal-shards.png`,
    rarity: "Industrial",
    description: "Fractured luminous crystals used in sensors and reactor tuning."
  },
  "Xenon Gas": {
    icon: `${COMMODITY_ICON_PATH}xenon-gas.png`,
    rarity: "Industrial",
    description: "Pressurised noble gas used in jump systems and station life support."
  },
  "Iridium": {
    icon: `${COMMODITY_ICON_PATH}iridium.png`,
    rarity: "Rare",
    description: "Rare heavy metal used in precision drives and high-end armour."
  },
  "Platinum": {
    icon: `${COMMODITY_ICON_PATH}platinum.png`,
    rarity: "Rare",
    description: "Valuable precious metal traded heavily between wealthy systems."
  },
  "Uranium": {
    icon: `${COMMODITY_ICON_PATH}uranium.png`,
    rarity: "Rare",
    description: "Dangerous reactor fuel. Profitable, but heavily monitored."
  },
  "Dark Matter Residue": {
    icon: `${COMMODITY_ICON_PATH}dark-matter-residue.png`,
    rarity: "Exotic",
    description: "Unstable exotic matter scraped from deep-space anomalies."
  }
};

const sectorNodes = {
  "Virella": { type: "planet", planetClass: "virella", x: 14, y: 50, connects: ["West Link 1", "Upper Gate West", "Lower Gate West"] },
  "West Link 1": { type: "space", route: "safe", x: 26, y: 50, connects: ["Virella", "West Link 2"] },
  "West Link 2": { type: "space", route: "safe", x: 38, y: 50, connects: ["West Link 1", "Asteron Prime"] },

  "Asteron Prime": { type: "planet", planetClass: "asteron", x: 50, y: 50, connects: ["West Link 2", "East Link 1", "Upper Gate Core", "Lower Gate Core"] },

  "East Link 1": { type: "space", route: "safe", x: 62, y: 50, connects: ["Asteron Prime", "East Link 2"] },
  "East Link 2": { type: "space", route: "safe", x: 74, y: 50, connects: ["East Link 1", "Nyxara"] },
  "Nyxara": { type: "planet", planetClass: "nyxara", x: 86, y: 50, connects: ["East Link 2", "Upper Gate East", "Lower Gate East"] },

  "Upper Apex": { type: "space", route: "combat", danger: "hostile", x: 50, y: 8, connects: ["Upper Arc West", "Upper Arc East"] },
  "Upper Arc West": { type: "space", route: "combat", danger: "hostile", x: 30, y: 16, connects: ["Upper Apex", "Upper Mid West A", "Upper Mid West B"] },
  "Upper Arc East": { type: "space", route: "combat", danger: "hostile", x: 70, y: 16, connects: ["Upper Apex", "Upper Mid East B", "Upper Mid East A"] },
  "Upper Mid West A": { type: "space", route: "combat", danger: "hostile", x: 18, y: 24, connects: ["Upper Arc West", "Upper Lane West A", "Upper Lane West B"] },
  "Upper Mid West B": { type: "space", route: "combat", danger: "hostile", x: 40, y: 24, connects: ["Upper Arc West", "Upper Lane West B", "Upper Lane Core West"] },
  "Upper Mid East B": { type: "space", route: "combat", danger: "hostile", x: 60, y: 24, connects: ["Upper Arc East", "Upper Lane Core East", "Upper Lane East B"] },
  "Upper Mid East A": { type: "space", route: "combat", danger: "hostile", x: 82, y: 24, connects: ["Upper Arc East", "Upper Lane East B", "Upper Lane East A"] },
  "Upper Lane West A": { type: "space", route: "combat", danger: "hostile", x: 10, y: 34, connects: ["Upper Mid West A", "Upper Gate West"] },
  "Upper Lane West B": { type: "space", route: "combat", danger: "hostile", x: 26, y: 34, connects: ["Upper Mid West A", "Upper Mid West B", "Upper Gate West", "Upper Gate Core"] },
  "Upper Lane Core West": { type: "space", route: "combat", danger: "hostile", x: 46, y: 34, connects: ["Upper Mid West B", "Upper Gate Core"] },
  "Upper Lane Core East": { type: "space", route: "combat", danger: "hostile", x: 54, y: 34, connects: ["Upper Mid East B", "Upper Gate Core"] },
  "Upper Lane East B": { type: "space", route: "combat", danger: "hostile", x: 74, y: 34, connects: ["Upper Mid East B", "Upper Mid East A", "Upper Gate Core", "Upper Gate East"] },
  "Upper Lane East A": { type: "space", route: "combat", danger: "hostile", x: 90, y: 34, connects: ["Upper Mid East A", "Upper Gate East"] },
  "Upper Gate West": { type: "space", route: "combat", danger: "hostile", x: 18, y: 42, connects: ["Upper Lane West A", "Upper Lane West B", "Virella"] },
  "Upper Gate Core": { type: "space", route: "combat", danger: "hostile", x: 50, y: 42, connects: ["Upper Lane West B", "Upper Lane Core West", "Upper Lane Core East", "Upper Lane East B", "Asteron Prime"] },
  "Upper Gate East": { type: "space", route: "combat", danger: "hostile", x: 82, y: 42, connects: ["Upper Lane East B", "Upper Lane East A", "Nyxara"] },

  "Lower Apex": { type: "space", route: "combat", danger: "hostile", x: 50, y: 92, connects: ["Lower Arc West", "Lower Arc East"] },
  "Lower Arc West": { type: "space", route: "combat", danger: "hostile", x: 30, y: 84, connects: ["Lower Apex", "Lower Mid West A", "Lower Mid West B"] },
  "Lower Arc East": { type: "space", route: "combat", danger: "hostile", x: 70, y: 84, connects: ["Lower Apex", "Lower Mid East B", "Lower Mid East A"] },
  "Lower Mid West A": { type: "space", route: "combat", danger: "hostile", x: 18, y: 76, connects: ["Lower Arc West", "Lower Lane West A", "Lower Lane West B"] },
  "Lower Mid West B": { type: "space", route: "combat", danger: "hostile", x: 40, y: 76, connects: ["Lower Arc West", "Lower Lane West B", "Lower Lane Core West"] },
  "Lower Mid East B": { type: "space", route: "combat", danger: "hostile", x: 60, y: 76, connects: ["Lower Arc East", "Lower Lane Core East", "Lower Lane East B"] },
  "Lower Mid East A": { type: "space", route: "combat", danger: "hostile", x: 82, y: 76, connects: ["Lower Arc East", "Lower Lane East B", "Lower Lane East A"] },
  "Lower Lane West A": { type: "space", route: "combat", danger: "hostile", x: 10, y: 66, connects: ["Lower Mid West A", "Lower Gate West"] },
  "Lower Lane West B": { type: "space", route: "combat", danger: "hostile", x: 26, y: 66, connects: ["Lower Mid West A", "Lower Mid West B", "Lower Gate West", "Lower Gate Core"] },
  "Lower Lane Core West": { type: "space", route: "combat", danger: "hostile", x: 46, y: 66, connects: ["Lower Mid West B", "Lower Gate Core"] },
  "Lower Lane Core East": { type: "space", route: "combat", danger: "hostile", x: 54, y: 66, connects: ["Lower Mid East B", "Lower Gate Core"] },
  "Lower Lane East B": { type: "space", route: "combat", danger: "hostile", x: 74, y: 66, connects: ["Lower Mid East B", "Lower Mid East A", "Lower Gate Core", "Lower Gate East"] },
  "Lower Lane East A": { type: "space", route: "combat", danger: "hostile", x: 90, y: 66, connects: ["Lower Mid East A", "Lower Gate East"] },
  "Lower Gate West": { type: "space", route: "combat", danger: "hostile", x: 18, y: 58, connects: ["Lower Lane West A", "Lower Lane West B", "Virella"] },
  "Lower Gate Core": { type: "space", route: "combat", danger: "hostile", x: 50, y: 58, connects: ["Lower Lane West B", "Lower Lane Core West", "Lower Lane Core East", "Lower Lane East B", "Asteron Prime"] },
  "Lower Gate East": { type: "space", route: "combat", danger: "hostile", x: 82, y: 58, connects: ["Lower Lane East B", "Lower Lane East A", "Nyxara"] }
};

const sectorMapZones = [
  { name: "UPPER COMBAT ZONE", subtitle: "HOSTILE SPACE", x: 50, y: 6.4, tone: "combat", icon: "▲" },
  { name: "LOWER COMBAT ZONE", subtitle: "HOSTILE SPACE", x: 50, y: 97.8, tone: "combat", icon: "▲" }
];


const nodeMineralPools = Object.fromEntries(
  Object.entries(sectorNodes).map(([name, node]) => {
    if (node.type === "planet") {
      if (name === "Virella") return [name, ["Iron", "Copper", "Crystal Shards"]];
      if (name === "Asteron Prime") return [name, ["Titanium", "Cobalt", "Crystal Shards"]];
      return [name, ["Crystal Shards", "Platinum", "Dark Matter Residue"]];
    }

    if (node.route === "safe") {
      return [name, ["Iron", "Copper", "Cobalt", "Titanium"]];
    }

    if (node.y < 50) {
      return [name, ["Cobalt", "Crystal Shards", "Iridium", "Xenon Gas"]];
    }

    return [name, ["Titanium", "Iridium", "Platinum", "Uranium"]];
  })
);

const planetMarkets = {
  "Virella": {
    "Iron": 9,
    "Copper": 13,
    "Cobalt": 42,
    "Titanium": 58,
    "Crystal Shards": 74,
    "Xenon Gas": 92,
    "Iridium": 132,
    "Platinum": 170,
    "Uranium": 210,
    "Dark Matter Residue": 390
  },
  "Asteron Prime": {
    "Iron": 16,
    "Copper": 18,
    "Cobalt": 34,
    "Titanium": 48,
    "Crystal Shards": 58,
    "Xenon Gas": 82,
    "Iridium": 148,
    "Platinum": 190,
    "Uranium": 176,
    "Dark Matter Residue": 420
  },
  "Nyxara": {
    "Iron": 25,
    "Copper": 28,
    "Cobalt": 55,
    "Titanium": 72,
    "Crystal Shards": 88,
    "Xenon Gas": 66,
    "Iridium": 118,
    "Platinum": 152,
    "Uranium": 236,
    "Dark Matter Residue": 350
  }
};

let marketStock = createInitialMarketStock();

function createInitialMarketStock() {
  return {
    "Virella": {
      "Iron": 280,
      "Copper": 220,
      "Cobalt": 95,
      "Titanium": 80,
      "Crystal Shards": 60,
      "Xenon Gas": 44,
      "Iridium": 28,
      "Platinum": 20,
      "Uranium": 12,
      "Dark Matter Residue": 5
    },
    "Asteron Prime": {
      "Iron": 190,
      "Copper": 160,
      "Cobalt": 130,
      "Titanium": 115,
      "Crystal Shards": 92,
      "Xenon Gas": 62,
      "Iridium": 36,
      "Platinum": 24,
      "Uranium": 18,
      "Dark Matter Residue": 7
    },
    "Nyxara": {
      "Iron": 110,
      "Copper": 100,
      "Cobalt": 90,
      "Titanium": 65,
      "Crystal Shards": 42,
      "Xenon Gas": 88,
      "Iridium": 50,
      "Platinum": 38,
      "Uranium": 30,
      "Dark Matter Residue": 10
    }
  };
}

function getHostileBotNodes() {
  return Object.keys(sectorNodes).filter(name => sectorNodes[name].type === "space" && sectorNodes[name].danger === "hostile");
}

function getSpaceNodes() {
  return Object.keys(sectorNodes).filter(name => sectorNodes[name].type === "space");
}

function getSafeRouteNodes() {
  return Object.keys(sectorNodes).filter(name => sectorNodes[name].route === "safe");
}

const SHIPS = {
  lupenOrigin: {
    id: "lupenOrigin",
    name: "LF-1 Origin",
    manufacturer: "Lupen Foundry",
    roleSubtitle: "Balanced Starter Hull",
    description: "A reliable Lupen Foundry starter vessel with balanced cargo, defence and jump systems.",
    image: "assets/ships/lupen-origin.png",
    price: 0,
    hull: 1000,
    shield: 125,
    cargo: 150,
    jumpRecharge: 11,
    evasion: 0.10,
    gunSlots: 2,
    attachmentSlots: 3
  },
  lupenHauler: {
    id: "lupenHauler",
    name: "LF-2 Hauler",
    manufacturer: "Lupen Foundry",
    roleSubtitle: "Cargo / Durable Hull",
    description: "A broader Lupen Foundry hull with expanded cargo capacity and stronger plating, balanced by slower jump recovery and low evasion.",
    image: "assets/ships/lupen-hauler.png",
    price: 12000,
    hull: 1300,
    shield: 135,
    cargo: 260,
    jumpRecharge: 8,
    evasion: 0.05,
    gunSlots: 1,
    attachmentSlots: 4
  },
  lupenStriker: {
    id: "lupenStriker",
    name: "LF-3 Striker",
    manufacturer: "Lupen Foundry",
    roleSubtitle: "Combat / Evasive Hull",
    description: "A lean Lupen Foundry vessel with stronger evasion, faster jump recovery and an extra weapon mount, designed for pilots who prefer combat over cargo capacity.",
    image: "assets/ships/lupen-striker.png",
    price: 10000,
    hull: 900,
    shield: 130,
    cargo: 100,
    jumpRecharge: 15,
    evasion: 0.28,
    gunSlots: 3,
    attachmentSlots: 3
  }
};

const attachments = {
  cargoPod: {
    name: "Cargo Pod",
    image: "assets/attachments/cargo-pod.png",
    description: "+25 cargo capacity",
    price: 220,
    effect: { cargo: 25 }
  },
  hullBooster: {
    name: "Hull Booster",
    image: "assets/attachments/hull-booster.png",
    description: "+100 hull",
    price: 260,
    effect: { hull: 100 }
  },
  jumpDrive: {
    name: "Jump Drive",
    image: "assets/attachments/jump-drive.png",
    description: "+2 jump recharge speed",
    price: 340,
    effect: { jumpRecharge: 2 }
  },
  shieldBooster: {
    name: "Shield Booster",
    image: "assets/attachments/shield-booster.png",
    description: "+50 shield",
    price: 310,
    effect: { shield: 50 }
  },
  evasionMatrix: {
    name: "Evasion Matrix",
    image: "assets/attachments/evasion-matrix.png",
    description: "+5% evasion",
    price: 390,
    effect: { evasion: 5 }
  }
};

const GUNS = {
  pulseLaser: {
    name: "Pulse Laser",
    image: "assets/guns/pulse-laser.png",
    description: "Reliable rapid-fire starter laser weapon.",
    price: 380,
    damage: 42,
    speed: 1000
  },
  heavyPulseLaser: {
    name: "Heavy Pulse Laser",
    image: "assets/guns/heavy-pulse-laser.png",
    description: "Higher damage pulse platform with slower firing cadence.",
    price: 620,
    damage: 68,
    speed: 1600
  }
};

let currentNode = "Asteron Prime";
let lastPlanetNode = "Asteron Prime";
let homePlanet = "Asteron Prime";
let credits = 10000;
let currentShipId = "lupenOrigin";
let ownedShips = ["lupenOrigin"];
let selectedHangarShipId = "lupenOrigin";
let selectedFleetShipId = "lupenOrigin";
let selectedShipyardShipId = "lupenOrigin";
let stationVaultWasClearedThisSession = false;
let installedAttachments = [];
let ownedAttachments = {
  cargoPod: 0,
  hullBooster: 0,
  jumpDrive: 0,
  shieldBooster: 0,
  evasionMatrix: 0
};
let ownedGuns = {
  pulseLaser: 0,
  heavyPulseLaser: 0
};
let shipLoadouts = { lupenOrigin: { attachments: [], guns: ["pulseLaser"] } };

const cargo = {
  "Iron": 0,
  "Copper": 0,
  "Cobalt": 0,
  "Titanium": 0,
  "Crystal Shards": 0,
  "Xenon Gas": 0,
  "Iridium": 0,
  "Platinum": 0,
  "Uranium": 0,
  "Dark Matter Residue": 0
};

let cargoCostBasis = {};
let activeTradeTerminalTab = "contracts";
let tradeTerminalTimer = null;
let storeDailyTimer = null;
let renderedStoreDayKey = "";
let renderedMarketCycle = null;
let stagedTradeOpportunity = null;
let selectedStationTradeRoute = null;
let activeTradeRoute = null;
let activeObjective = null;
let selectedLooseCargoSellGood = null;

const XP_CONFIG = {
  combatZoneKey: "sector-one",
  combatZoneCap: 2500,
  combatLevelXp: 2500,
  combatBotXp: 100,
  bountyClaimXp: 100,
  combatLevelThresholds: [0, 2500, 5000],
  maxStarterCombatLevel: 99
};

let playerProgress = createDefaultPlayerProgress();

let dailyBountyDate = null;
let dailyBountyContracts = [];
let selectedBountyContractId = null;

const commodityImageMap = {
  "Iron": "assets/commodities/iron.png",
  "Copper": "assets/commodities/copper.png",
  "Cobalt": "assets/commodities/cobalt.png",
  "Titanium": "assets/commodities/titanium.png",
  "Crystal Shards": "assets/commodities/crystal-shards.png",
  "Xenon Gas": "assets/commodities/xenon-gas.png",
  "Iridium": "assets/commodities/iridium.png",
  "Platinum": "assets/commodities/platinum.png",
  "Uranium": "assets/commodities/uranium.png",
  "Dark Matter Residue": "assets/commodities/dark-matter-residue.png"
};

function getCommodityImage(mineral) {
  return commodityImageMap[mineral] || "assets/commodities/iron.png";
}



const BOUNTY_AREAS = {
  upperCombat: {
    id: "upperCombat",
    label: "Upper Combat Zone",
    match: name => sectorNodes[name]?.type === "space" && sectorNodes[name]?.danger === "hostile" && sectorNodes[name]?.y < 50
  },
  lowerCombat: {
    id: "lowerCombat",
    label: "Lower Combat Zone",
    match: name => sectorNodes[name]?.type === "space" && sectorNodes[name]?.danger === "hostile" && sectorNodes[name]?.y > 50
  },
  anyHostile: {
    id: "anyHostile",
    label: "Any Hostile Zone",
    match: name => sectorNodes[name]?.type === "space" && sectorNodes[name]?.danger === "hostile"
  }
};

const DAILY_BOUNTY_CONTRACTS = [
  {
    id: "daily-raider-sweep",
    title: "Raider Sweep",
    targetArea: "upperCombat",
    targetLabel: "Upper Combat Zone",
    killsRequired: 3,
    reward: 1200,
    lootChance: 0.18,
    description: "Clear raiders from any hostile node in the upper combat zone."
  },
  {
    id: "daily-station-patrol",
    title: "Station Defence Patrol",
    targetArea: "lowerCombat",
    targetLabel: "Lower Combat Zone",
    killsRequired: 3,
    reward: 1500,
    lootChance: 0.22,
    description: "Suppress bots across the lower hostile lanes threatening station traffic."
  },
  {
    id: "daily-manta-intercept",
    title: "Manta Intercept",
    targetArea: "anyHostile",
    targetLabel: "Any Hostile Zone",
    killsRequired: 2,
    reward: 1800,
    lootChance: 0.28,
    description: "Intercept roaming hostile bots anywhere in combat space."
  }
];

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function createDailyBountyContracts() {
  return DAILY_BOUNTY_CONTRACTS.map(contract => ({
    ...contract,
    targetLabel: contract.targetLabel || getBountyAreaLabel(contract.targetArea),
    status: "available",
    progress: 0
  }));
}

function getBountyArea(areaId) {
  return BOUNTY_AREAS[areaId] || BOUNTY_AREAS.anyHostile;
}

function getBountyAreaLabel(areaId) {
  return getBountyArea(areaId).label;
}

function getBountyAreaNodes(areaId) {
  const area = getBountyArea(areaId);
  return Object.keys(sectorNodes).filter(name => area.match(name));
}

function isNodeInBountyArea(nodeName, areaId) {
  return getBountyAreaNodes(areaId).includes(nodeName);
}

function getNearestBountyAreaNode(startNode, areaId) {
  const areaNodes = getBountyAreaNodes(areaId);
  if (!areaNodes.length) return null;
  if (areaNodes.includes(startNode)) return startNode;

  return areaNodes
    .map(nodeName => ({ nodeName, path: findSectorRoute(startNode, nodeName) }))
    .filter(item => item.path.length)
    .sort((a, b) => a.path.length - b.path.length)[0]?.nodeName || areaNodes[0];
}

function getNearestActiveBountyBotNode(startNode = currentNode) {
  const objective = activeObjective?.type === "bounty" ? activeObjective : null;
  const targetArea = objective?.targetArea || "anyHostile";

  const candidates = hostileBots
    .filter(bot => bot.alive && sectorNodes[bot.node] && isNodeInBountyArea(bot.node, targetArea))
    .map(bot => bot.node)
    .filter((nodeName, index, list) => list.indexOf(nodeName) === index);

  if (!candidates.length) return getNearestBountyAreaNode(startNode, targetArea);
  if (candidates.includes(startNode)) return startNode;

  return candidates
    .map(nodeName => ({ nodeName, path: findSectorRoute(startNode, nodeName) }))
    .filter(item => item.path.length)
    .sort((a, b) => a.path.length - b.path.length)[0]?.nodeName || candidates[0];
}

function isAtActiveBountyCombatNode() {
  if (activeObjective?.type !== "bounty") return false;
  if (!isNodeInBountyArea(currentNode, activeObjective.targetArea)) return false;
  return hostileBots.some(bot => bot.alive && bot.node === currentNode);
}

function getNearestPlanetNode(startNode = currentNode) {
  const planetNodes = Object.keys(sectorNodes).filter(name => sectorNodes[name]?.type === "planet");
  if (!planetNodes.length) return lastPlanetNode || "Asteron Prime";
  if (planetNodes.includes(startNode)) return startNode;

  return planetNodes
    .map(nodeName => ({ nodeName, path: findSectorRoute(startNode, nodeName) }))
    .filter(item => item.path.length)
    .sort((a, b) => a.path.length - b.path.length)[0]?.nodeName || (lastPlanetNode || planetNodes[0]);
}

function isAtPlanetNode() {
  return sectorNodes[currentNode]?.type === "planet";
}

const ITEM_QUALITY_ORDER = ["standard", "unique", "elite", "legendary", "godlike"];
const ITEM_QUALITY_LABELS = {
  standard: "Standard",
  unique: "Unique",
  advanced: "Advanced",
  elite: "Elite",
  legendary: "Legendary",
  godlike: "Godlike"
};

const itemDefinitions = {
  lupenCore: { name: "Lupen Core", shortLabel: "LC", category: "Core", icon: "assets/items/lupen-core.png", core: true, sellValue: 1500 },
  cargoPod: { name: "Cargo Pod", shortLabel: "CP", category: "Attachment", icon: "assets/attachments/cargo-pod.png", sellValue: 210 },
  hullBooster: { name: "Hull Booster", shortLabel: "HB", category: "Attachment", icon: "assets/attachments/hull-booster.png", sellValue: 240 },
  jumpDrive: { name: "Jump Drive", shortLabel: "JD", category: "Attachment", icon: "assets/attachments/jump-drive.png", sellValue: 260 },
  shieldBooster: { name: "Shield Booster", shortLabel: "SB", category: "Attachment", icon: "assets/attachments/shield-booster.png", sellValue: 250 },
  evasionMatrix: { name: "Evasion Matrix", shortLabel: "EM", category: "Attachment", icon: "assets/attachments/evasion-matrix.png", sellValue: 280 },
  pulseLaser: { name: "Pulse Laser", shortLabel: "PL", category: "Weapon", icon: "assets/guns/pulse-laser.png", sellValue: 180 },
  heavyPulseLaser: { name: "Heavy Pulse Laser", shortLabel: "HL", category: "Weapon", icon: "assets/guns/heavy-pulse-laser.png", sellValue: 360 },

  /* legacy item keys kept for old local saves */
  pulseRelay: { name: "Pulse Relay", shortLabel: "PR", category: "Weapon", icon: "assets/guns/pulse-laser.png", sellValue: 170 },
  shieldMatrix: { name: "Shield Matrix", shortLabel: "SM", category: "Attachment", icon: "assets/attachments/shield-booster.png", sellValue: 230 },
  hullPlating: { name: "Hull Plating", shortLabel: "HP", category: "Attachment", icon: "assets/attachments/hull-booster.png", sellValue: 220 },
  targetingArray: { name: "Targeting Array", shortLabel: "TA", category: "Weapon", icon: "assets/guns/heavy-pulse-laser.png", sellValue: 330 }
};

const botDropPool = ["cargoPod", "hullBooster", "jumpDrive", "shieldBooster", "evasionMatrix", "pulseLaser", "heavyPulseLaser"];

let inventoryItems = [];
let storeFilter = "all";
let selectedStoreItemId = null;
let selectedStoreQuality = "standard";
let storeDailyPurchases = {};
let hangarVaultFilter = "all";
let selectedVaultGroupKey = null;

function titleCaseQuality(value) {
  return ITEM_QUALITY_LABELS[value] || "Standard";
}

function pickWeightedQuality() {
  const roll = Math.random();
  if (roll < 0.62) return "standard";
  if (roll < 0.87) return "unique";
  if (roll < 0.968) return "elite";
  if (roll < 0.996) return "legendary";
  return "godlike";
}

function pickCoreQuality() {
  const roll = Math.random();
  if (roll < 0.62) return "elite";
  if (roll < 0.92) return "legendary";
  return "godlike";
}

function pickBotLootKey() {
  const roll = Math.random();
  if (roll < 0.06) return "lupenCore";
  if (roll < 0.23) return "heavyPulseLaser";
  if (roll < 0.38) return "shieldBooster";
  if (roll < 0.52) return "evasionMatrix";
  if (roll < 0.64) return "jumpDrive";
  if (roll < 0.76) return "hullBooster";
  if (roll < 0.88) return "cargoPod";
  return "pulseLaser";
}

function pickItemQuality(itemKey) {
  return itemKey === "lupenCore" ? pickCoreQuality() : pickWeightedQuality();
}

function createInventoryDrop(itemKey, forcedQuality = null) {
  return {
    id: `item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    key: itemKey,
    quality: forcedQuality || pickItemQuality(itemKey)
  };
}

function pickStarterMapDropQuality() {
  const roll = Math.random();
  if (roll < 0.09) return "standard";
  if (roll < 0.115) return "unique";
  if (roll < 0.12) return "elite";
  return null;
}

function generateBotLootItems() {
  // Map 1 bot equipment drops are deliberately rare.
  // Standard and Unique are possible, Elite is very slim, Legendary/Godlike are not available here.
  const quality = pickStarterMapDropQuality();
  if (!quality) return [];

  return [createInventoryDrop(pickBotLootKey(), quality)];
}

function normalizeInventoryItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => {
      if (!item || !itemDefinitions[item.key]) return null;
      const legacyQuality = item.quality === "advanced" || item.quality === "refined" ? "unique" : item.quality;
      const quality = ITEM_QUALITY_ORDER.includes(legacyQuality) ? legacyQuality : "standard";
      return {
        id: item.id || `item-restored-${index}-${Date.now()}`,
        key: item.key,
        quality
      };
    })
    .filter(Boolean);
}

function summarizeInventoryItems(items) {
  const grouped = {};
  (items || []).forEach(item => {
    const definition = itemDefinitions[item.key];
    if (!definition) return;
    const label = `${titleCaseQuality(item.quality)} ${definition.name}`;
    grouped[label] = (grouped[label] || 0) + 1;
  });
  return Object.entries(grouped)
    .map(([label, count]) => `${count}x ${label}`)
    .join(", ");
}

function groupInventoryItems(items) {
  const grouped = new Map();
  (items || []).forEach(item => {
    const definition = itemDefinitions[item.key];
    if (!definition) return;
    const groupKey = `${item.key}__${item.quality}`;
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        key: item.key,
        quality: item.quality,
        count: 0,
        name: definition.name,
        shortLabel: definition.shortLabel,
        category: definition.category,
        icon: definition.icon || "assets/items/lupen-core.png"
      });
    }
    grouped.get(groupKey).count += 1;
  });
  return Array.from(grouped.values()).sort((a, b) => {
    const qualityDelta = ITEM_QUALITY_ORDER.indexOf(b.quality) - ITEM_QUALITY_ORDER.indexOf(a.quality);
    if (qualityDelta !== 0) return qualityDelta;
    return a.name.localeCompare(b.name);
  });
}

const ITEM_QUALITY_SELL_MULTIPLIERS = {
  standard: 1,
  unique: 2,
  elite: 5,
  legendary: 15,
  godlike: 45
};

const ITEM_QUALITY_BUY_MULTIPLIERS = {
  standard: 1,
  unique: 2.5,
  elite: 9,
  legendary: 28,
  godlike: 90
};


const ITEM_QUALITY_STAT_MULTIPLIERS = {
  standard: 1,
  unique: 1.14,
  elite: 1.32,
  legendary: 1.58,
  godlike: 1.95
};

function getInventoryItemSellValue(key, quality = "standard") {
  const definition = itemDefinitions[key];
  if (!definition) return 0;
  const baseValue = definition.sellValue || 100;
  const multiplier = ITEM_QUALITY_SELL_MULTIPLIERS[quality] || 1;
  return Math.max(1, Math.round(baseValue * multiplier));
}

function removeInventoryItems(key, quality, quantity) {
  let remaining = quantity;
  const kept = [];

  inventoryItems.forEach(item => {
    if (remaining > 0 && item.key === key && item.quality === quality) {
      remaining -= 1;
      return;
    }

    kept.push(item);
  });

  inventoryItems = kept;
  return quantity - remaining;
}

function trimPrototypeInventoryItems() {
  if (Array.isArray(inventoryItems) && inventoryItems.length > PROTOTYPE_STARTING_INVENTORY_ITEMS) {
    inventoryItems = inventoryItems.slice(0, PROTOTYPE_STARTING_INVENTORY_ITEMS);
  }
}


function escapeJsString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/* Basic audio - generated with Web Audio, no sound files required */

let audioContext = null;
let audioUnlocked = false;
let lastWarningAt = 0;

function getAudioContext() {
  if (!window.AudioContext && !window.webkitAudioContext) return null;

  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  return audioContext;
}

function unlockAudio() {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === "suspended") {
    ctx.resume();
  }

  audioUnlocked = true;
}

document.addEventListener("pointerdown", unlockAudio, { once: true });
document.addEventListener("keydown", unlockAudio, { once: true });

function playTone({ frequency = 440, endFrequency = null, duration = 0.2, type = "sine", volume = 0.08, when = 0 }) {
  const ctx = getAudioContext();
  if (!ctx || !audioUnlocked) return;

  const startTime = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);

  if (endFrequency) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), startTime + duration);
  }

  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.03);
}

function playJumpSound() {
  playTone({ frequency: 110, endFrequency: 680, duration: 0.42, type: "sawtooth", volume: 0.065 });
  playTone({ frequency: 240, endFrequency: 1100, duration: 0.52, type: "triangle", volume: 0.045, when: 0.05 });
  playTone({ frequency: 72, endFrequency: 48, duration: 0.65, type: "sine", volume: 0.07, when: 0.02 });
}

function playPlayerLaserPulse() {
  playTone({ frequency: 760, endFrequency: 310, duration: 0.16, type: "square", volume: 0.045 });
  playTone({ frequency: 1400, endFrequency: 820, duration: 0.09, type: "sawtooth", volume: 0.025 });
}

function playEnemyLaserPulse() {
  playTone({ frequency: 260, endFrequency: 95, duration: 0.22, type: "sawtooth", volume: 0.055 });
  playTone({ frequency: 620, endFrequency: 180, duration: 0.16, type: "square", volume: 0.028, when: 0.03 });
}

function playShieldRegenSound() {
  playTone({ frequency: 380, endFrequency: 760, duration: 0.32, type: "triangle", volume: 0.035 });
  playTone({ frequency: 760, endFrequency: 1260, duration: 0.36, type: "sine", volume: 0.025, when: 0.08 });
}

function speakWarning() {
  const now = Date.now();
  if (now - lastWarningAt < 6500) return;
  lastWarningAt = now;

  if ("speechSynthesis" in window) {
    const warning = new SpeechSynthesisUtterance("Warning!");
    warning.rate = 0.95;
    warning.pitch = 0.78;
    warning.volume = 0.85;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(warning);
  } else {
    playTone({ frequency: 220, endFrequency: 160, duration: 0.22, type: "square", volume: 0.08 });
    playTone({ frequency: 220, endFrequency: 160, duration: 0.22, type: "square", volume: 0.08, when: 0.28 });
  }
}


let jumpCharge = 100;
const jumpMax = 100;
let jumpTimer = null;

let hull = 800;
let hullMax = 800;
let evasion = 10;
let shield = 100;
let shieldMax = 100;
let shieldEnabled = true;
let shieldRegenTimer = null;
let shieldRegenDelayTimer = null;
const SHIELD_REGEN_DELAY_MS = 4000;
const SHIELD_REGEN_INTERVAL_MS = 250;
const SHIELD_REGEN_RATE = 3;

let selectedTarget = null;
let engagedTarget = null;
let engageTimer = null;
const ASTEROID_RESPAWN_MS = 10000;
const ASTEROID_BASE_HP = 294;
const HOSTILE_BOT_MOVE_MS = 10000;
const HOSTILE_BOT_RESPAWN_MS = 10000;
const HOSTILE_BOT_BASE_HP = 900;
const HOSTILE_BOT_ATTACK_MS = 3000;
const HOSTILE_BOT_DAMAGE = 4;
const HULL_REPAIR_COST_PER_POINT = 2;
const DISABLED_CARGO_LOSS_RATE = 0.3;
const MANTA_BOT_ASSET = "assets/ships/manta-bot.png";
const HOSTILE_BOT_ATTACK_FACE_MS = 1200;
const HOSTILE_BOT_LASER_DELAY_MS = 260;
const SECTOR_SCAN_DURATION_MS = 5000;
const SECTOR_SCAN_COOLDOWNS_MS = { ally: 0, bot: 10000, enemy: 30000 };

let asteroids = createInitialAsteroids();
let hostileBots = createInitialHostileBots();
let botMovementTimer = null;
let botAttackTimer = null;
let sectorScanState = { activeUntil: 0, cooldownUntilByType: { ally: 0, bot: 0, enemy: 0 }, result: null };
let sectorScanTicker = null;

let lootByNode = {};

function createInitialAsteroids() {
  // Asteroids are intentionally disabled in Map 1.
  // They will return in later maps as the source of Weapon Parts, Tech Fragments and Lupen Core progression.
  return [];
}

function createInitialHostileBots() {
  const spaceNodes = getHostileBotNodes();
  const positions = [
    { x: 18, y: 24 }, { x: 32, y: 39 }, { x: 48, y: 22 }, { x: 64, y: 34 }, { x: 78, y: 26 },
    { x: 24, y: 58 }, { x: 42, y: 66 }, { x: 58, y: 54 }, { x: 72, y: 62 }, { x: 86, y: 48 }
  ];

  return Array.from({ length: 10 }, (_, index) => {
    const pos = positions[index % positions.length];

    return {
      id: `manta-bot-${index + 1}`,
      name: `Manta Bot ${index + 1}`,
      node: spaceNodes[(index + 1) % spaceNodes.length],
      hp: HOSTILE_BOT_BASE_HP,
      maxHp: HOSTILE_BOT_BASE_HP,
      alive: true,
      x: pos.x,
      y: pos.y,
      image: MANTA_BOT_ASSET,
      attackingUntil: 0
    };
  });
}

function getAsteroidById(id) {
  return asteroids.find(asteroid => asteroid.id === id);
}

function getHostileBotById(id) {
  return hostileBots.find(bot => bot.id === id);
}

function getSelectedAsteroid() {
  return selectedTarget?.type === "asteroid"
    ? getAsteroidById(selectedTarget.id)
    : null;
}

function getSelectedHostileBot() {
  return selectedTarget?.type === "hostileBot"
    ? getHostileBotById(selectedTarget.id)
    : null;
}

function getSelectedTargetEntity() {
  return getSelectedHostileBot() || getSelectedAsteroid();
}

function getEngagedTargetEntity() {
  if (!engagedTarget) return null;

  if (engagedTarget.type === "hostileBot") {
    return getHostileBotById(engagedTarget.id);
  }

  if (engagedTarget.type === "asteroid") {
    return getAsteroidById(engagedTarget.id);
  }

  return null;
}

function getTargetTypeFromEntity(target) {
  return target?.id?.startsWith("manta-bot") ? "hostileBot" : "asteroid";
}

function getVisibleAsteroids() {
  return asteroids.filter(asteroid => asteroid.alive && asteroid.node === currentNode);
}

function getVisibleHostileBots() {
  return hostileBots.filter(bot => bot.alive && bot.node === currentNode);
}

function isBotFacingPlayer(bot) {
  return Boolean(bot && Number(bot.attackingUntil || 0) > Date.now());
}

function markBotFacingPlayer(bot) {
  if (!bot) return;
  bot.attackingUntil = Date.now() + HOSTILE_BOT_ATTACK_FACE_MS;
}

function getBotDirectionClass(bot) {
  if (!bot) return "bot-angle-front";
  if (isBotFacingPlayer(bot)) return "bot-angle-front bot-facing-player";

  const x = Number(bot.x || 50);
  if (x <= 24) return "bot-angle-right";
  if (x <= 42) return "bot-angle-front-right";
  if (x >= 76) return "bot-angle-left";
  if (x >= 58) return "bot-angle-front-left";
  return "bot-angle-front";
}

function triggerWarningBanner(text = "WARNING") {
  const spaceScreen = document.getElementById("spaceScreen");
  if (!spaceScreen) return;

  let banner = document.getElementById("combatWarningBanner");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "combatWarningBanner";
    banner.className = "combat-warning-banner";
    spaceScreen.appendChild(banner);
  }

  banner.textContent = text;
  banner.classList.remove("active");
  void banner.offsetWidth;
  banner.classList.add("active");

  setTimeout(() => {
    banner?.classList.remove("active");
  }, 1050);
}

function getVisibleTargets() {
  return [...getVisibleHostileBots(), ...getVisibleAsteroids()];
}

function showScreen(screenId) {
  document.querySelectorAll(".card, .hub-screen, .space-screen, .market-screen, .hangar-screen").forEach(screen => {
    screen.classList.remove("active");
  });

  const screen = document.getElementById(screenId);
  if (screen) screen.classList.add("active");
  clearMessages();

  if (tutorialState?.active) {
    if (["startScreen", "createScreen", "loginScreen"].includes(screenId)) {
      clearTutorialOverlayOnly();
    } else {
      setTimeout(renderStarterTutorial, 60);
    }
  }
}

function clearMessages() {
  document.querySelectorAll(".message").forEach(msg => {
    msg.textContent = "";
  });
}


function createDefaultPlayerProgress() {
  return {
    combatXp: 0,
    zoneCombatXp: { [XP_CONFIG.combatZoneKey]: 0 },
    totals: {
      botsDestroyed: 0,
      tradesCompleted: 0,
      tradeProfit: 0,
      cargoSold: 0,
      bountiesClaimed: 0
    }
  };
}

function normalizePlayerProgress(progress) {
  const defaults = createDefaultPlayerProgress();
  const safe = progress && typeof progress === "object" ? progress : {};
  const combatXp = Math.max(0, Number(safe.combatXp || 0));

  return {
    combatXp,
    zoneCombatXp: {
      ...defaults.zoneCombatXp,
      ...(safe.zoneCombatXp && typeof safe.zoneCombatXp === "object" ? safe.zoneCombatXp : {})
    },
    totals: {
      ...defaults.totals,
      ...(safe.totals && typeof safe.totals === "object" ? safe.totals : {})
    }
  };
}

function getCombatLevelInfo() {
  const total = Math.max(0, Number(playerProgress.combatXp || 0));
  const perLevel = Math.max(1, Number(XP_CONFIG.combatLevelXp || 500));
  const level = Math.floor(total / perLevel) + 1;
  const levelBase = (level - 1) * perLevel;
  const current = total - levelBase;
  const next = perLevel;

  return {
    level,
    current,
    next,
    total,
    levelBase,
    percent: Math.min(100, Math.round((current / next) * 100)),
    capped: false
  };
}

function getCurrentCombatZoneKey() {
  return XP_CONFIG.combatZoneKey;
}

function getCombatZoneEarned() {
  const key = getCurrentCombatZoneKey();
  return Math.max(0, Number(playerProgress.zoneCombatXp?.[key] || 0));
}

function getCombatXpPerBot() {
  return Math.max(0, Number(XP_CONFIG.combatBotXp || 0));
}

function addCombatXp(amount, source = "") {
  const xp = Math.max(0, Math.round(Number(amount || 0)));
  if (!xp) return { gained: 0, levelled: false, source };

  const beforeLevel = getCombatLevelInfo().level;
  const zoneKey = getCurrentCombatZoneKey();
  playerProgress.zoneCombatXp[zoneKey] = Math.max(0, getCombatZoneEarned() + xp);
  playerProgress.combatXp = Math.max(0, Number(playerProgress.combatXp || 0)) + xp;
  const afterLevel = getCombatLevelInfo().level;

  if (afterLevel > beforeLevel) {
    showLevelUpOverlay(`Combat Level ${afterLevel}`);
    addActivityLog(`Combat Level ${afterLevel} reached. Your XP bar has reset toward the next level.`);
  }

  return { gained: xp, levelled: afterLevel > beforeLevel, before: beforeLevel, after: afterLevel, source };
}

function awardCombatXpFromBot(bot) {
  const award = getCombatXpPerBot();
  playerProgress.totals.botsDestroyed = Math.max(0, Number(playerProgress.totals.botsDestroyed || 0)) + 1;

  if (award <= 0) {
    updateProgressDisplays();
    return 0;
  }

  const result = addCombatXp(award, "bot");
  addHudToast(`+${formatNumber(result.gained)} Combat XP`);
  addActivityLog(`Bot destroyed: +${formatNumber(result.gained)} Combat XP.`);
  updateProgressDisplays();
  return result.gained;
}

function awardTradingXpFromProfit(profit) {
  const safeProfit = Math.max(0, Math.round(Number(profit || 0)));
  if (safeProfit <= 0) return 0;

  playerProgress.totals.tradesCompleted = Math.max(0, Number(playerProgress.totals.tradesCompleted || 0)) + 1;
  playerProgress.totals.tradeProfit = Math.max(0, Number(playerProgress.totals.tradeProfit || 0)) + safeProfit;
  addActivityLog(`Trade completed: CR ${formatNumber(safeProfit)} profit.`);
  updateProgressDisplays();
  return 0;
}

function awardBountyXpOnClaim(contract) {
  const result = addCombatXp(XP_CONFIG.bountyClaimXp, "bounty");
  if (result.gained > 0) {
    addActivityLog(`Bounty XP earned: +${formatNumber(result.gained)} Combat XP.`);
    addHudToast(`Bounty complete: +${formatNumber(result.gained)} Combat XP`);
  }
  playerProgress.totals.bountiesClaimed = Math.max(0, Number(playerProgress.totals.bountiesClaimed || 0)) + 1;
  updateProgressDisplays();
}

function showLevelUpOverlay(text) {
  let overlay = document.getElementById("levelUpOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "levelUpOverlay";
    overlay.className = "level-up-overlay";
    document.body.appendChild(overlay);
  }

  overlay.innerHTML = `
    <div class="level-up-modal">
      <div class="reward-kicker">Progression Updated</div>
      <h2>${text}</h2>
      <p>Your XP bar has reset. Keep fighting to progress toward the next combat level.</p>
    </div>
  `;
  overlay.classList.add("active");
  setTimeout(() => overlay.classList.remove("active"), 1800);
}

function showTradeResultBurst({ good, quantity, profit, revenue }) {
  const amount = Math.round(Number(profit || 0));
  const isProfit = amount >= 0;
  const absAmount = Math.abs(amount);

  let burst = document.getElementById("tradeResultBurst");
  if (!burst) {
    burst = document.createElement("div");
    burst.id = "tradeResultBurst";
    burst.className = "trade-result-burst";
    document.body.appendChild(burst);
  }

  burst.className = `trade-result-burst ${isProfit ? "profit" : "loss"}`;
  burst.innerHTML = `
    <div class="trade-result-card">
      <div class="trade-result-kicker">${isProfit ? "Trade Profit" : "Trade Loss"}</div>
      <div class="trade-result-amount">${isProfit ? "+" : "-"}CR ${formatNumber(absAmount)}</div>
      <div class="trade-result-meta">${formatNumber(quantity)} ${good} sold · CR ${formatNumber(revenue)} return</div>
    </div>
  `;

  burst.dataset.createdAt = String(Date.now());
  burst.classList.remove("active");
  void burst.offsetWidth;
  burst.classList.add("active");

  clearTimeout(window.tradeResultBurstTimer);
  window.tradeResultBurstTimer = setTimeout(() => burst.classList.remove("active"), 2500);
}

function showTradeMiniFloat({ profit }) {
  const amount = Math.round(Number(profit || 0));
  const float = document.createElement("div");
  float.className = `trade-mini-float ${amount >= 0 ? "profit" : "loss"}`;
  float.textContent = `${amount >= 0 ? "+" : "-"}CR ${formatNumber(Math.abs(amount))}`;
  document.body.appendChild(float);

  requestAnimationFrame(() => float.classList.add("active"));
  setTimeout(() => float.remove(), 2000);
}



function dismissTradeResultBurst() {
  const burst = document.getElementById("tradeResultBurst");
  if (burst) burst.classList.remove("active");

  document.querySelectorAll(".trade-mini-float").forEach(el => {
    el.classList.remove("active");
    setTimeout(() => el.remove(), 120);
  });

  if (window.tradeResultBurstTimer) {
    clearTimeout(window.tradeResultBurstTimer);
    window.tradeResultBurstTimer = null;
  }
}


function showGameRewardBurst({ type = "info", kicker = "Reward", title = "", meta = "", icon = "✦", image = "" }) {
  let burst = document.getElementById("gameRewardBurst");
  if (!burst) {
    burst = document.createElement("div");
    burst.id = "gameRewardBurst";
    burst.className = "game-reward-burst";
    document.body.appendChild(burst);
  }

  const imageMarkup = image
    ? `<div class="game-reward-icon image"><img src="${image}" alt=""></div>`
    : `<div class="game-reward-icon">${icon}</div>`;

  burst.className = `game-reward-burst ${type}`;
  burst.innerHTML = `
    <div class="game-reward-card">
      ${imageMarkup}
      <div class="game-reward-copy">
        <div class="game-reward-kicker">${kicker}</div>
        <div class="game-reward-title">${title}</div>
        ${meta ? `<div class="game-reward-meta">${meta}</div>` : ""}
      </div>
    </div>
  `;

  burst.dataset.createdAt = String(Date.now());
  burst.classList.remove("active");
  void burst.offsetWidth;
  burst.classList.add("active");

  clearTimeout(window.gameRewardBurstTimer);
  window.gameRewardBurstTimer = setTimeout(() => burst.classList.remove("active"), 2800);
}

function dismissGameRewardBurst() {
  const burst = document.getElementById("gameRewardBurst");
  if (burst) burst.classList.remove("active");

  if (window.gameRewardBurstTimer) {
    clearTimeout(window.gameRewardBurstTimer);
    window.gameRewardBurstTimer = null;
  }
}

function showBountyCompleteBurst(objective) {
  if (!objective) return;
  showGameRewardBurst({
    type: "bounty",
    kicker: "Bounty Complete",
    title: objective.title || "Contract Complete",
    meta: `Return to station · CR ${formatNumber(objective.reward || 0)} ready`,
    icon: "◎"
  });
}

function showItemFoundBurst(items = []) {
  const first = Array.isArray(items) ? items[0] : items;
  if (!first) return;

  const definition = itemDefinitions[first.key] || {};
  const count = Array.isArray(items) ? items.length : 1;
  const label = `${titleCaseQuality(first.quality)} ${definition.name || first.key}`;

  showGameRewardBurst({
    type: first.key === "lupenCore" ? "core" : "loot",
    kicker: first.key === "lupenCore" ? "Lupen Core Found" : "Item Found",
    title: count > 1 ? `${label} +${count - 1} more` : label,
    meta: "Added to inventory",
    image: definition.icon || "assets/items/lupen-core.png"
  });
}

function renderShipMiniProgress(combat) {
  return `
    <div class="ship-mini-level"><span>LEVEL</span><strong>${combat.level}</strong></div>
    <div class="ship-mini-bars single">
      <div class="ship-mini-bar" title="Combat Level ${combat.level}: ${formatNumber(combat.current)} / ${formatNumber(combat.next)} XP to next level"><i style="height:${combat.percent}%"></i><span>XP</span></div>
    </div>
  `;
}

function updateProgressDisplays() {
  const combat = getCombatLevelInfo();

  const hud = document.getElementById("hudProgressStrip");
  if (hud) {
    hud.innerHTML = renderShipMiniProgress(combat);
  }

  const profileScreen = document.getElementById("pilotProfileScreen");
  if (profileScreen && profileScreen.classList.contains("active")) {
    renderPilotProfile();
  }
}

function renderSkillProfileCard(title, info, meta, icon) {
  return `
    <div class="profile-skill-card solo">
      <div class="profile-skill-head">
        <span>${icon}</span>
        <div><strong>${title} Level ${info.level}</strong><em>${formatNumber(info.current)} / ${formatNumber(info.next)} XP</em></div>
      </div>
      <div class="profile-xp-track"><i style="width:${info.percent}%"></i></div>
      <p>${meta}</p>
    </div>
  `;
}

function renderPilotStatCard(label, value, meta = "", statClass = "") {
  return `
    <div class="pilot-stat-card ${statClass}">
      <span>${label}</span>
      <strong>${value}</strong>
      ${meta ? `<small>${meta}</small>` : ""}
    </div>
  `;
}




function renderPilotProfile() {
  const combat = getCombatLevelInfo();
  const zoneEarned = getCombatZoneEarned();
  const nextBotXp = getCombatXpPerBot();
  const totals = playerProgress.totals || {};
  const ship = getCurrentShip();
  const stats = getShipStats(currentShipId);
  const loadout = getShipLoadout(currentShipId);
  const weapon = getEquippedWeapon(currentShipId);

  const title = document.getElementById("profilePilotTitle");
  const body = document.getElementById("pilotProfileBody");
  if (title) title.textContent = `${getPilotName().toUpperCase()} PROFILE`;
  if (!body) return;

  const unlockText = `Combat Level ${combat.level}. Earn XP from bots and bounties to progress toward Level ${combat.level + 1}.`;

  body.innerHTML = `
    <section class="pilot-dashboard-hero">
      <div class="pilot-identity-block">
        <span class="drawer-kicker">Pilot Record</span>
        <strong>${getPilotName()}</strong>
        <small>Combat Level ${combat.level} · ${ship.name}</small>
      </div>

      <div class="pilot-level-block">
        <div>
          <span>Combat Level</span>
          <strong>${combat.level}</strong>
          <small>${formatNumber(combat.current)} / ${formatNumber(combat.next)} XP to Level ${combat.level + 1}</small>
        </div>
        <div class="profile-xp-track pilot"><i style="width:${combat.percent}%"></i></div>
        <p>${unlockText}</p>
      </div>
    </section>

    <section class="pilot-dashboard-grid">
      ${renderPilotStatCard("Bots Destroyed", formatNumber(totals.botsDestroyed || 0), `Next bot +${formatNumber(nextBotXp)} XP`, "combat-stat")}
      ${renderPilotStatCard("Bounties Claimed", formatNumber(totals.bountiesClaimed || 0), "Daily contracts", "bounty-stat")}
      ${renderPilotStatCard("Trade Profit", `CR ${formatNumber(totals.tradeProfit || 0)}`, `${formatNumber(totals.tradesCompleted || 0)} trades completed`, "profit-stat")}
      ${renderPilotStatCard("Cargo Sold", formatNumber(totals.cargoSold || 0), "Units moved", "cargo-stat")}
      ${renderPilotStatCard("Ships Owned", formatNumber(ownedShips.length), "Fleet size", "fleet-stat")}
      ${renderPilotStatCard("Current Vessel", ship.name, `${loadout.guns.length}/${getGunSlotLimit(currentShipId)} guns · ${loadout.attachments.length}/${getAttachmentSlotLimit(currentShipId)} equip`, "ship-stat")}
    </section>

    <section class="pilot-profile-lower">
      <div class="pilot-progression-card">
        <div class="profile-tree-head"><span>Combat Progress</span><strong>Map 1</strong></div>
        ${renderSkillProfileCard("Combat", combat, `Level progress: ${formatNumber(combat.current)} / ${formatNumber(combat.next)} XP · total combat XP: ${formatNumber(combat.total)} · next bot kill: +${formatNumber(nextBotXp)} XP`, "⚔")}
      </div>

      <div class="pilot-future-card">
        <div class="profile-tree-head"><span>Future Pilot Systems</span><strong>Later</strong></div>
        <div class="future-profile-grid">
          <div><strong>Guild</strong><small>Guild tag, rank, allies and rivals.</small></div>
          <div><strong>Skill Tree</strong><small>Combat perks, trade bonuses and ship specialisation.</small></div>
          <div><strong>Public Stats</strong><small>Search pilots, view vessels, compare records.</small></div>
          <div><strong>Leaderboards</strong><small>Bounties, profit, kills and seasonal standings.</small></div>
        </div>
      </div>
    </section>
  `;
}


function resetToNoShipStarterState() {
  credits = 10000;
  playerProgress = createDefaultPlayerProgress();

  mineralKeys.forEach(mineral => { cargo[mineral] = 0; });
  cargoCostBasis = {};

  currentShipId = "";
  selectedHangarShipId = "lupenOrigin";
  selectedFleetShipId = "lupenOrigin";
  selectedShipyardShipId = "lupenOrigin";
  ownedShips = [];
  shipLoadouts = {};

  Object.keys(ownedAttachments || {}).forEach(key => { ownedAttachments[key] = 0; });
  Object.keys(ownedGuns || {}).forEach(key => { ownedGuns[key] = 0; });
  inventoryItems = [];
  installedAttachments = [];

  activeTradeRoute = null;
  activeObjective = null;
  selectedLooseCargoSellGood = null;
  selectedStationTradeRoute = null;
  stagedTradeOpportunity = null;

  dailyBountyDate = null;
  dailyBountyContracts = [];
  selectedBountyContractId = null;

  storeDailyPurchases = {};
  marketStock = {};
  lootByNode = {};

  asteroids = createInitialAsteroids();
  hostileBots = createInitialHostileBots();

  currentNode = homePlanet || "Asteron Prime";
  lastPlanetNode = currentNode;
  jumpCharge = jumpMax;
  hull = 0;
  hullMax = 0;
  shield = 0;
  shieldMax = 0;
}

function grantStarterShipKit() {
  ownedGuns.pulseLaser = Math.max(ownedGuns.pulseLaser || 0, 2);
  ownedAttachments.cargoPod = Math.max(ownedAttachments.cargoPod || 0, 1);
  ownedAttachments.jumpDrive = Math.max(ownedAttachments.jumpDrive || 0, 1);
}

function hasActiveShip() {
  return Boolean(currentShipId && SHIPS[currentShipId] && ownedShips.includes(currentShipId));
}

function countEquippedGuns(shipId = currentShipId) {
  return getShipLoadout(shipId).guns.length;
}

function countEquippedAttachments(shipId = currentShipId) {
  return getShipLoadout(shipId).attachments.length;
}

function openPilotProfile() {
  renderPilotProfile();
  showScreen("pilotProfileScreen");
  tutorialEvent("openedPilotProfile");
}


function createAccount() {
  const email = document.getElementById("createEmail")?.value.trim() || "";
  const username = document.getElementById("createUsername")?.value.trim() || "WaffleFast";
  const password = document.getElementById("createPassword")?.value || "";

  // Prototype mode: keep the create-account screen but don't require form details while testing.
  localStorage.setItem(STORAGE_ACCOUNT_KEY, JSON.stringify({
    email,
    username,
    password,
    homePlanet,
    createdAt: new Date().toISOString(),
    prototypeLogin: true
  }));

  resetToNoShipStarterState();
  saveGame();
  enterHubFromLogin();

  const welcomeStep = STARTER_TUTORIAL_STEPS.findIndex(step => step.id === "welcome-new-pilot");
  tutorialState = {
    active: true,
    completed: false,
    stepIndex: welcomeStep >= 0 ? welcomeStep : 0,
    lastStartedAt: new Date().toISOString()
  };
  saveTutorialState();
  setTimeout(renderStarterTutorial, 120);
}

function login() {
  const user = document.getElementById("loginUser")?.value.trim();
  let saved = JSON.parse(localStorage.getItem(STORAGE_ACCOUNT_KEY) || "null");

  // Prototype mode: keep the login screen, but let the tester enter the game immediately.
  // If no local account exists, create a lightweight local pilot record.
  if (!saved) {
    saved = {
      email: "",
      username: user || "WaffleFast",
      password: "",
      homePlanet,
      createdAt: new Date().toISOString(),
      prototypeLogin: true
    };
    localStorage.setItem(STORAGE_ACCOUNT_KEY, JSON.stringify(saved));
  } else if (user && user !== saved.username && user !== saved.email) {
    saved.username = user;
    localStorage.setItem(STORAGE_ACCOUNT_KEY, JSON.stringify(saved));
  }

  tutorialState.active = false;
  saveTutorialState();
  clearTutorialOverlayOnly();

  enterHubFromLogin();
}

function logout() {
  disengageTarget(true);
  tutorialState.active = false;
  saveTutorialState();
  clearTutorialOverlayOnly();
  showScreen("startScreen");
}

function enterHubFromLogin() {
  if (!sectorNodes[currentNode] || sectorNodes[currentNode].type !== "planet") {
    currentNode = lastPlanetNode || "Asteron Prime";
  }

  updateHubLocation();
  showScreen("gameScreen");
  saveGame();
}

function updateHubLocation() {
  document.getElementById("hubLocationTitle").textContent = currentNode.toUpperCase();
  updateBountyHubBadge();
  updateProgressDisplays();
}

function hasClaimableBountyReward() {
  ensureDailyBounties();
  return dailyBountyContracts.some(contract => contract.status === "readyToClaim") || (activeObjective?.type === "bounty" && activeObjective.status === "readyToClaim");
}

function updateBountyHubBadge() {
  const button = document.getElementById("bountyBoardHubBtn");
  const badge = document.getElementById("bountyRewardBadge");
  const ready = Boolean(button && badge && hasClaimableBountyReward());
  if (button) button.classList.toggle("reward-ready", ready);
  if (badge) badge.style.display = ready ? "inline-flex" : "none";
}

function getCurrentShip() {
  return SHIPS[currentShipId] || {
    id: "noShip",
    name: "No Ship",
    manufacturer: "Unassigned",
    roleSubtitle: "Purchase your first hull",
    description: "No active vessel.",
    image: "assets/ships/lupen-origin.png",
    price: 0,
    hull: 0,
    shield: 0,
    cargo: 0,
    jumpRecharge: 0,
    evasion: 0,
    gunSlots: 0,
    attachmentSlots: 0
  };
}

function getAttachmentSlotLimit(shipId = currentShipId) {
  const ship = SHIPS[shipId];
  return ship ? (ship.attachmentSlots ?? ship.slots ?? 0) : 0;
}

function getGunSlotLimit(shipId = currentShipId) {
  const ship = SHIPS[shipId];
  return ship ? (ship.gunSlots ?? 1) : 0;
}

function makeLoadoutEntry(key, quality = "standard") {
  return { key, quality: ITEM_QUALITY_ORDER.includes(quality) ? quality : "standard" };
}

function getEquipmentKey(entry) {
  return typeof entry === "string" ? entry : entry?.key;
}

function getEquipmentQuality(entry) {
  return typeof entry === "string" ? "standard" : (ITEM_QUALITY_ORDER.includes(entry?.quality) ? entry.quality : "standard");
}

function isAttachmentEntry(entry) {
  return Boolean(attachments[getEquipmentKey(entry)]);
}

function isGunEntry(entry) {
  return Boolean(GUNS[getEquipmentKey(entry)]);
}

function getScaledAttachmentEffect(key, quality = "standard") {
  const attachment = attachments[key];
  const multiplier = getItemStatMultiplier(quality);
  const effect = { cargo: 0, hull: 0, shield: 0, jumpRecharge: 0, evasion: 0 };

  if (!attachment) return effect;

  Object.entries(attachment.effect || {}).forEach(([effectKey, value]) => {
    effect[effectKey] = Math.max(1, Math.round(value * multiplier));
  });

  return effect;
}

function normalizeShipLoadout(loadout, shipId) {
  const ship = SHIPS[shipId] || SHIPS.lupenOrigin;

  if (Array.isArray(loadout)) {
    return {
      attachments: loadout.filter(isAttachmentEntry).map(entry => makeLoadoutEntry(getEquipmentKey(entry), getEquipmentQuality(entry))),
      guns: ship.defaultGun ? [makeLoadoutEntry(ship.defaultGun, "standard")] : []
    };
  }

  const normalized = {
    attachments: Array.isArray(loadout?.attachments)
      ? loadout.attachments.filter(isAttachmentEntry).map(entry => makeLoadoutEntry(getEquipmentKey(entry), getEquipmentQuality(entry)))
      : [],
    guns: Array.isArray(loadout?.guns)
      ? loadout.guns.filter(isGunEntry).map(entry => makeLoadoutEntry(getEquipmentKey(entry), getEquipmentQuality(entry)))
      : []
  };

  if (loadout === undefined || loadout === null) {
    normalized.guns = ship.defaultGun ? [makeLoadoutEntry(ship.defaultGun, "standard")] : [];
  }

  return normalized;
}

function getShipLoadout(shipId = selectedHangarShipId) {
  shipLoadouts[shipId] = normalizeShipLoadout(shipLoadouts[shipId], shipId);
  return shipLoadouts[shipId];
}

function getShipStats(shipId = currentShipId) {
  const ship = SHIPS[shipId];
  if (!ship) {
    return { cargo: 0, hull: 0, shield: 0, jumpRecharge: 0, evasion: 0 };
  }
  const loadout = getShipLoadout(shipId);

  const stats = {
    cargo: Number(ship.baseCargo ?? ship.cargo ?? 0),
    hull: Number(ship.baseHull ?? ship.hull ?? 0),
    shield: Number(ship.baseShield ?? ship.shield ?? 0),
    jumpRecharge: Number(ship.baseJumpRecharge ?? ship.jumpRecharge ?? 0),
    evasion: Number(ship.baseEvasion ?? ship.evasion ?? 0)
  };

  loadout.attachments.forEach(entry => {
    const key = getEquipmentKey(entry);
    const quality = getEquipmentQuality(entry);
    const attachment = attachments[key];
    if (!attachment) return;

    const effect = getScaledAttachmentEffect(key, quality);
    stats.cargo += Number(effect.cargo || 0);
    stats.hull += Number(effect.hull || 0);
    stats.shield += Number(effect.shield || 0);
    stats.jumpRecharge += Number(effect.jumpRecharge || 0);
    stats.evasion += Number(effect.evasion || 0);
  });

  stats.cargo = Math.max(0, Math.round(stats.cargo));
  stats.hull = Math.max(0, Math.round(stats.hull));
  stats.shield = Math.max(0, Math.round(stats.shield));
  stats.jumpRecharge = Math.max(0, Math.round(stats.jumpRecharge));
  stats.evasion = Math.max(0, Math.min(40, Math.round(stats.evasion)));
  return stats;
}

function formatEvasion(value) {
  return `${Math.max(0, Math.round(value || 0))}%`;
}

function getEvasionDamageReduction() {
  return Math.max(0, Math.min(0.4, (evasion || 0) / 100));
}

function getMitigatedIncomingDamage(totalDamage) {
  return Math.max(0, Math.round(totalDamage * (1 - getEvasionDamageReduction())));
}

function getEquippedWeapon(shipId = currentShipId) {
  const loadout = getShipLoadout(shipId);
  const equippedGuns = loadout.guns
    .map(entry => {
      const key = getEquipmentKey(entry);
      const quality = getEquipmentQuality(entry);
      const gun = GUNS[key];
      return gun ? { key, quality, gun } : null;
    })
    .filter(Boolean);

  if (!equippedGuns.length) {
    return {
      name: "Unarmed",
      damage: 0,
      speed: 1600,
      count: 0
    };
  }

  const damage = equippedGuns.reduce((sum, item) => sum + Math.round(item.gun.damage * getItemStatMultiplier(item.quality)), 0);
  const speed = Math.max(...equippedGuns.map(item => item.gun.speed));
  const counts = {};

  equippedGuns.forEach(item => {
    const label = item.quality === "standard" ? item.gun.name : `${titleCaseQuality(item.quality)} ${item.gun.name}`;
    counts[label] = (counts[label] || 0) + 1;
  });

  const name = Object.entries(counts)
    .map(([gunName, qty]) => qty > 1 ? `${gunName} x${qty}` : gunName)
    .join(" + ");

  return {
    name,
    damage,
    speed,
    count: equippedGuns.length
  };
}

function setSelectedHangarShip(shipId) {
  if (!ownedShips.includes(shipId)) return;

  selectedHangarShipId = shipId;
  renderHangar();
}

function showHangarSection(sectionName) {
  document.querySelectorAll(".hangar-section").forEach(section => {
    section.classList.remove("active");
  });

  document.querySelectorAll(".hangar-tabs button").forEach(button => {
    button.classList.remove("active");
  });

  const section = document.getElementById(`hangar${sectionName[0].toUpperCase()}${sectionName.slice(1)}Section`);
  const tab = document.getElementById(`hangar${sectionName[0].toUpperCase()}${sectionName.slice(1)}Tab`);

  if (section) section.classList.add("active");
  if (tab) tab.classList.add("active");

  if (sectionName === "overview") {
    tutorialEvent("openedHangarLoadout");
    renderHangarOverview();
  }

  if (sectionName === "shipEditor") {
    renderHangarEditor();
  }

  if (sectionName === "owned") {
    renderOwnedShips();
  }

  if (sectionName === "vault") {
    renderHangarVault();
  }

  if (sectionName === "shipyard") {
    if (tutorialState?.active && ["open-vessel-exchange-first-ship", "buy-first-ship"].includes(getCurrentTutorialStep()?.id) && !hasActiveShip()) {
      selectedShipyardShipId = "lupenOrigin";
    }
    tutorialEvent("openedVesselExchange");
    renderShipShop();
    renderShipyardDetail();
  }
}

function cargoUsed() {
  return mineralKeys.reduce((total, mineral) => total + (cargo[mineral] || 0), 0);
}

function applyShipStats(refill = false) {
  const stats = getShipStats();
  hullMax = stats.hull;
  shieldMax = stats.shield;
  evasion = stats.evasion;
  shieldEnabled = true;

  if (refill) {
    hull = hullMax;
    shield = shieldMax;
  } else {
    hull = Math.min(hull, hullMax);
    shield = Math.min(shield, shieldMax);
  }

  if (!hasActiveShip() || shieldMax <= 0 || shield >= shieldMax) {
    stopShieldRegen();
  } else {
    scheduleShieldRegen();
  }

  updateSpaceHUD();
}

function launchShip() {
  if (!hasActiveShip()) {
    addHudToast("No ship assigned. Buy your first hull in Hangar Bay.");
    return;
  }

  const launchingFromPlanet = sectorNodes[currentNode]?.type === "planet";
  applyShipStats(false);

  if (hull <= 0) {
    addActivityLog("Launch blocked. Hull disabled — repair required in Hangar.");
    showShipDisabledOverlay("Hull disabled. Repair required before launch.", []);
    return;
  }

  if (launchingFromPlanet) {
    jumpCharge = 0;
  }

  showScreen("spaceScreen");
  tutorialEvent("launched");
  updateCurrentNodeUI();
  updateSpaceHUD();
  updateProgressDisplays();
  updateAsteroidUI();
  updateTargetPanel();
  openHudPanel("sector");

  if (jumpCharge < jumpMax) {
    startJumpRecharge();
  }

  if (shield < shieldMax) {
    scheduleShieldRegen();
  }

  saveGame();
}

function landOnPlanet() {
  const node = sectorNodes[currentNode];
  if (!node || node.type !== "planet") return;

  const tutorialStepId = getCurrentTutorialStep()?.id;

  lastPlanetNode = currentNode;
  closeSectorMap();
  disengageTarget(true);
  updateHubLocation();
  showScreen("gameScreen");

  tutorialEvent("landedOnPlanet");

  if (
    tutorialState?.active &&
    ["open-map-return-bounty", "return-to-planet-after-bounty", "land-after-bounty"].includes(tutorialStepId)
  ) {
    setTimeout(() => setTutorialStepById("open-bounty-to-claim"), 80);
  }

  saveGame();
}

function openMarketplace() {
  tutorialEvent("openedTradeTerminal");
  if (!sectorNodes[currentNode] || sectorNodes[currentNode].type !== "planet") {
    currentNode = lastPlanetNode || "Asteron Prime";
  }

  startTradeTerminalTimer();
  renderMarketplace();
  showScreen("marketScreen");
}

function openBountyBoard() {
  tutorialEvent("openedBountyBoard");
  if (!sectorNodes[currentNode] || sectorNodes[currentNode].type !== "planet") {
    currentNode = lastPlanetNode || "Asteron Prime";
  }

  ensureDailyBounties();
  renderBountyBoard();
  showScreen("bountyScreen");
}

function openStore() {
  tutorialEvent("openedStore");
  if (!sectorNodes[currentNode] || sectorNodes[currentNode].type !== "planet") {
    currentNode = lastPlanetNode || "Asteron Prime";
  }

  renderStore();
  showScreen("storeScreen");
  startStoreTimer();
}

function openHangar() {
  tutorialEvent("openedHangar");
  selectedHangarShipId = currentShipId || "lupenOrigin";
  selectedShipyardShipId = currentShipId || selectedShipyardShipId || "lupenOrigin";
  renderHangar();
  showScreen("hangarScreen");
  showHangarSection(hasActiveShip() ? "overview" : "shipyard");
}

function returnToHub() {
  stopTradeTerminalTimer();
  stopStoreTimer();
  updateHubLocation();
  showScreen("gameScreen");
  tutorialEvent("returnedToHub");
  saveGame();
}



let activeHudPanel = "chat";
let targetCollapseTimer = null;
let inventoryDrawerFilter = "equipment";
let selectedInventoryDetailId = null;
let selectedLoadoutDetail = null;
const INVENTORY_DRAWER_MAX_CARDS = 12;
const PROTOTYPE_STARTING_INVENTORY_ITEMS = 4;

function openHudPanel(panelName) {
  if (panelName === "sector") panelName = "objectives";
  activeHudPanel = panelName;

  document.querySelectorAll(".hud-inline-panel .hud-panel").forEach(panel => {
    panel.classList.remove("active");
  });

  document.querySelectorAll(".hud-command-tabs button").forEach(button => {
    button.classList.remove("active");
  });

  const panel = document.getElementById(`${panelName}Panel`);
  const dockButton = document.getElementById(`${panelName}DockBtn`);

  if (panel) panel.classList.add("active");
  if (dockButton) dockButton.classList.add("active");

  const drawer = document.getElementById("inventoryDrawer");
  if (drawer && panelName !== "inventory") {
    drawer.classList.remove("active");
  }
}

function closeShipInventoryDrawer() {
  const drawer = document.getElementById("inventoryDrawer");
  const button = document.getElementById("shipInventoryBtn");
  if (drawer) drawer.classList.remove("active");
  if (button) button.classList.remove("active");
}

function toggleShipInventoryDrawer(event = null) {
  if (event?.stopPropagation) event.stopPropagation();

  const drawer = document.getElementById("inventoryDrawer");
  const button = document.getElementById("shipInventoryBtn");
  if (!drawer) return;

  drawer.classList.toggle("active");
  if (button) button.classList.toggle("active", drawer.classList.contains("active"));

  if (drawer.classList.contains("active")) {
    tutorialEvent("openedLoadout");

    renderInventoryDrawer();
  }
}

document.addEventListener("click", event => {
  const drawer = document.getElementById("inventoryDrawer");
  if (!drawer || !drawer.classList.contains("active")) return;

  const clickedDrawer = drawer.contains(event.target);
  const clickedInventoryButton = event.target.closest?.("#shipInventoryBtn");
  const clickedModal = event.target.closest?.(".sector-map, .market-screen, .hangar-screen, .store-screen, .bounty-screen, .pilot-profile-screen");

  if (!clickedDrawer && !clickedInventoryButton && !clickedModal) {
    closeShipInventoryDrawer();
  }
});

function closeHudPanel() {
  openHudPanel("chat");
}

function getInventoryEntryId(entry) {
  return `${entry.type}:${entry.key}:${entry.quality || "standard"}:${entry.source || "cargo"}`;
}

function getCurrentLoadoutEquippedCounts() {
  const loadout = getShipLoadout(currentShipId);
  const counts = {};

  [...(loadout.attachments || []), ...(loadout.guns || [])].forEach(entry => {
    const key = getEquipmentKey(entry);
    const quality = getEquipmentQuality(entry);
    const id = `${key}__${quality}`;
    counts[id] = (counts[id] || 0) + 1;
  });

  return counts;
}

function buildInventoryDrawerEntries() {
  const entries = [];
  const equippedCounts = getCurrentLoadoutEquippedCounts();

  mineralKeys.forEach(mineral => {
    const quantity = cargo[mineral] || 0;
    if (quantity <= 0) return;
    const info = commodityInfo[mineral] || {};
    entries.push({
      type: "cargo",
      key: mineral,
      name: mineral,
      quantity,
      quality: (info.rarity || "common").toLowerCase(),
      rarity: info.rarity || "Common",
      icon: getCommodityImage(mineral),
      category: "Cargo",
      source: "cargo"
    });
  });

  groupInventoryItems(inventoryItems).forEach(item => {
    const definition = itemDefinitions[item.key];
    if (!definition) return;
    const kind = definition.category === "Weapon" ? "gun" : definition.category === "Attachment" ? "attachment" : "core";
    entries.push({
      type: kind === "core" ? "core" : "equipment",
      kind,
      key: item.key,
      name: definition.name,
      quantity: item.count,
      quality: item.quality,
      category: definition.category,
      icon: definition.icon,
      source: "inventory",
      equipped: equippedCounts[`${item.key}__${item.quality}`] || 0
    });
  });

  Object.entries(ownedAttachments || {}).forEach(([key, count]) => {
    if (!count || count <= 0 || !attachments[key]) return;
    const definition = itemDefinitions[key] || attachments[key];
    entries.push({
      type: "equipment",
      kind: "attachment",
      key,
      name: definition.name || attachments[key].name,
      quantity: count,
      quality: "standard",
      category: "Attachment",
      icon: definition.icon || attachments[key].image,
      source: "owned",
      equipped: equippedCounts[`${key}__standard`] || 0
    });
  });

  Object.entries(ownedGuns || {}).forEach(([key, count]) => {
    if (!count || count <= 0 || !GUNS[key]) return;
    const definition = itemDefinitions[key] || GUNS[key];
    entries.push({
      type: "equipment",
      kind: "gun",
      key,
      name: definition.name || GUNS[key].name,
      quantity: count,
      quality: "standard",
      category: "Weapon",
      icon: definition.icon || GUNS[key].image,
      source: "owned",
      equipped: equippedCounts[`${key}__standard`] || 0
    });
  });

  const loadout = getShipLoadout(currentShipId);
  (loadout.attachments || []).forEach(entry => {
    const key = getEquipmentKey(entry);
    const quality = getEquipmentQuality(entry);
    const item = attachments[key];
    if (!item) return;
    const definition = itemDefinitions[key] || item;
    entries.push({
      type: "equipment",
      kind: "attachment",
      key,
      name: definition.name || item.name,
      quantity: 1,
      quality,
      category: "Attachment",
      icon: definition.icon || item.image,
      source: "equipped",
      equipped: 1
    });
  });

  (loadout.guns || []).forEach(entry => {
    const key = getEquipmentKey(entry);
    const quality = getEquipmentQuality(entry);
    const item = GUNS[key];
    if (!item) return;
    const definition = itemDefinitions[key] || item;
    entries.push({
      type: "equipment",
      kind: "gun",
      key,
      name: definition.name || item.name,
      quantity: 1,
      quality,
      category: "Weapon",
      icon: definition.icon || item.image,
      source: "equipped",
      equipped: 1
    });
  });

  return entries.sort((a, b) => {
    const typeOrder = { cargo: 0, equipment: 1, core: 2 };
    const delta = (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9);
    if (delta !== 0) return delta;
    const qualityDelta = ITEM_QUALITY_ORDER.indexOf(b.quality) - ITEM_QUALITY_ORDER.indexOf(a.quality);
    if (qualityDelta !== 0) return qualityDelta;
    return a.name.localeCompare(b.name);
  });
}

function setInventoryDrawerFilter(filter) {
  inventoryDrawerFilter = filter;
  selectedInventoryDetailId = null;
  selectedLoadoutDetail = null;
  renderInventoryDrawer();
}

function selectInventoryDrawerItem(id) {
  selectedInventoryDetailId = id;
  selectedLoadoutDetail = null;
  renderInventoryDrawer();
}

function selectLoadoutSlot(kind, index) {
  selectedLoadoutDetail = { kind, index: Number(index) };
  selectedInventoryDetailId = null;
  renderInventoryDrawer();
}

function getFilteredInventoryEntries() {
  const entries = buildInventoryDrawerEntries();
  if (inventoryDrawerFilter === "cargo") return entries.filter(entry => entry.type === "cargo").slice(0, INVENTORY_DRAWER_MAX_CARDS);
  if (inventoryDrawerFilter === "equipment") return entries.filter(entry => entry.source !== "equipped" && (entry.type === "equipment" || entry.type === "core")).slice(0, INVENTORY_DRAWER_MAX_CARDS);
  return entries.filter(entry => entry.source !== "equipped" && (entry.type === "equipment" || entry.type === "core")).slice(0, INVENTORY_DRAWER_MAX_CARDS);
}


function renderEquippedLoadoutView() {
  const grid = document.getElementById("inventoryDrawerGrid");
  const detail = document.getElementById("inventoryDrawerDetail");
  const count = document.getElementById("inventoryDrawerCount");
  const drawer = document.getElementById("inventoryDrawer");
  if (!grid || !detail) return;

  const ship = getCurrentShip();
  const loadout = getShipLoadout(currentShipId);
  const gunSlots = ship.gunSlots || 1;
  const attachmentSlots = ship.attachmentSlots || 0;
  const totalSlots = gunSlots + attachmentSlots;
  const loadoutSizeClass = totalSlots > 12 ? "many-slots" : totalSlots > 8 ? "wide-slots" : "standard-slots";

  const buildSlotButton = (entry, kind, index) => {
    const label = kind === "gun" ? `Gun ${index + 1}` : `Attachment ${index + 1}`;
    const selected = selectedLoadoutDetail && selectedLoadoutDetail.kind === kind && selectedLoadoutDetail.index === index;

    if (!entry) {
      const iconClass = kind === "gun" ? "empty-gun-icon" : "empty-attachment-icon";
      return `<button class="equipped-orbit-slot loadout-icon-slot empty ${selected ? "selected" : ""}" onclick="selectLoadoutSlot('${kind}', ${index})" title="${label}: Empty">
        <span class="empty-slot-silhouette ${iconClass}" aria-hidden="true"></span>
      </button>`;
    }

    const key = getEquipmentKey(entry);
    const quality = getEquipmentQuality(entry);
    const item = kind === "gun" ? GUNS[key] : attachments[key];
    const definition = itemDefinitions[key] || item || {};
    const name = definition.name || item?.name || key;
    const icon = definition.icon || item?.image || "";
    const effectLine = getInventoryEffectLine({ key, quality, kind });

    return `<button class="equipped-orbit-slot loadout-icon-slot quality-${quality} ${selected ? "selected" : ""}" onclick="selectLoadoutSlot('${kind}', ${index})" title="${titleCaseQuality(quality)} ${name} · ${effectLine}">
      <img src="${icon}" alt="${name}">
    </button>`;
  };

  const gunSlotHtml = Array.from({ length: gunSlots }).map((_, index) => {
    const entry = (loadout.guns || [])[index];
    return buildSlotButton(entry, "gun", index);
  }).join("");

  const attachmentSlotHtml = Array.from({ length: attachmentSlots }).map((_, index) => {
    const entry = (loadout.attachments || [])[index];
    return buildSlotButton(entry, "attachment", index);
  }).join("");

  if (drawer) drawer.classList.add("equipped-mode");
  if (count) count.textContent = `${ship.name} loadout`;

  grid.innerHTML = `
    <div class="equipped-loadout-stage ${loadoutSizeClass}">
      <div class="equipped-loadout-grid icon-loadout-grid compact-side-loadout">
        <div class="loadout-slot-bank gun-slot-bank" aria-label="Gun slots">${gunSlotHtml}</div>
        <div class="equipped-ship-core">
          <div class="equipped-ship-ring"></div>
          <img src="${ship.image}" alt="${ship.name}">
          <strong>${ship.name}</strong>
          <span>${gunSlots} gun · ${attachmentSlots} attachment slots</span>
        </div>
        <div class="loadout-slot-bank attachment-slot-bank" aria-label="Attachment slots">${attachmentSlotHtml}</div>
      </div>
    </div>
  `;

  renderLoadoutSlotDetail();
}

function getLoadoutSlotEntry(kind, index) {
  const loadout = getShipLoadout(currentShipId);
  const list = kind === "gun" ? loadout.guns : loadout.attachments;
  return (list || [])[Number(index)] || null;
}

function renderLoadoutSlotDetail() {
  const detail = document.getElementById("inventoryDrawerDetail");
  if (!detail) return;

  const ship = getCurrentShip();
  if (!selectedLoadoutDetail) {
    detail.innerHTML = `
      <div class="inventory-detail-title compact-loadout-title">
        <img src="${ship.image}" alt="${ship.name}">
        <div><strong>Current Loadout</strong><span>Click an equipped item to inspect stats</span></div>
      </div>
      <div class="inventory-detail-stats">
        <span>Hull <strong>${formatNumber(hullMax)}</strong></span>
        <span>Shield <strong>${formatNumber(shieldMax)}</strong></span>
        <span>Cargo <strong>${formatNumber(cargoCapacity())}</strong></span>
        <span>Jump Speed <strong>${formatNumber(ship.baseJumpRecharge || 0)}</strong></span>
        <span>Evasion <strong>${formatEvasion(evasion)}</strong></span>
      </div>
    `;
    return;
  }

  const { kind, index } = selectedLoadoutDetail;
  const entry = getLoadoutSlotEntry(kind, index);
  const slotLabel = kind === "gun" ? `Gun ${index + 1}` : `Attachment ${index + 1}`;

  if (!entry) {
    detail.innerHTML = `
      <div class="inventory-detail-title compact-loadout-title">
        <div class="empty-slot-icon">${kind === "gun" ? "G" : "A"}${index + 1}</div>
        <div><strong>${slotLabel}</strong><span>Empty slot</span></div>
      </div>
      <div class="inventory-detail-stats">
        <span>No item equipped</span>
      </div>
    `;
    return;
  }

  const key = getEquipmentKey(entry);
  const quality = getEquipmentQuality(entry);
  const item = kind === "gun" ? GUNS[key] : attachments[key];
  const definition = itemDefinitions[key] || item || {};
  const name = definition.name || item?.name || key;
  const icon = definition.icon || item?.image || "";
  const statText = kind === "gun" && GUNS[key]
    ? `Attack ${formatNumber(getStoreGunAttack({ key }, quality))}`
    : kind === "attachment" && attachments[key]
      ? getStoreAttachmentEffectText({ key }, quality)
      : getInventoryEffectLine({ key, quality, kind });

  detail.innerHTML = `
    <div class="inventory-detail-title quality-${quality}">
      <img src="${icon}" alt="${name}">
      <div><strong>${titleCaseQuality(quality)} ${name}</strong><span>${slotLabel}</span></div>
    </div>
    <div class="inventory-detail-stats">
      <span>${statText}</span>
      <span>Quality <strong>${titleCaseQuality(quality)}</strong></span>
      <span>Status <strong>Equipped</strong></span>
    </div>
    <div class="inventory-detail-actions">
      <button onclick="unequipCurrentShipItem('${escapeJsString(key)}', '${escapeJsString(quality)}', '${escapeJsString(kind)}')">Unequip</button>
    </div>
  `;
}

function renderInventoryDrawer() {
  const drawer = document.getElementById("inventoryDrawer");
  const grid = document.getElementById("inventoryDrawerGrid");
  const detail = document.getElementById("inventoryDrawerDetail");
  const count = document.getElementById("inventoryDrawerCount");
  if (!drawer || !grid || !detail) return;

  drawer.classList.toggle("equipped-mode", inventoryDrawerFilter === "equipped");

  document.querySelectorAll(".inventory-drawer-filters button").forEach(button => {
    const key = button.id.replace("inventoryFilter", "").toLowerCase();
    button.classList.toggle("active", key === inventoryDrawerFilter);
  });

  if (inventoryDrawerFilter === "equipped") {
    renderEquippedLoadoutView();
    return;
  }

  const entries = getFilteredInventoryEntries();
  const totalCargo = cargoUsed();
  const itemCount = inventoryItems.length + Object.values(ownedAttachments || {}).reduce((a, b) => a + (b || 0), 0) + Object.values(ownedGuns || {}).reduce((a, b) => a + (b || 0), 0);

  if (count) {
    count.textContent = `${formatNumber(totalCargo)} cargo · ${formatNumber(itemCount)} items`;
  }

  if (!entries.length) {
    grid.innerHTML = `<div class="inventory-drawer-empty">Nothing to show.</div>`;
    detail.innerHTML = `<div class="inventory-detail-empty">Select cargo or equipment to view actions.</div>`;
    return;
  }

  if (!selectedInventoryDetailId || !entries.some(entry => getInventoryEntryId(entry) === selectedInventoryDetailId)) {
    selectedInventoryDetailId = getInventoryEntryId(entries[0]);
  }

  grid.innerHTML = entries.map(entry => {
    const id = getInventoryEntryId(entry);
    const qualityClass = ITEM_QUALITY_ORDER.includes(entry.quality) ? `quality-${entry.quality}` : `rarity-${entry.quality}`;
    const isSelected = id === selectedInventoryDetailId;
    const badge = entry.source === "equipped" ? "EQUIPPED" : entry.type === "cargo" ? entry.rarity : titleCaseQuality(entry.quality);
    const effectLine = entry.type === "cargo" ? "" : getInventoryEffectLine(entry);
    return `
      <button class="inventory-drawer-card ${qualityClass} ${isSelected ? "selected" : ""}" onclick="selectInventoryDrawerItem('${escapeJsString(id)}')">
        <span class="inventory-card-icon"><img src="${entry.icon}" alt="${entry.name}"></span>
        <span class="inventory-card-main">
          <strong>${entry.name}</strong>
          <small>${badge}</small>
          ${effectLine ? `<em>${effectLine}</em>` : ""}
        </span>
        <span class="inventory-card-qty">x${formatNumber(entry.quantity)}</span>
      </button>
    `;
  }).join("");

  const selectedEntry = entries.find(entry => getInventoryEntryId(entry) === selectedInventoryDetailId) || entries[0];
  renderInventoryDrawerDetail(selectedEntry);
}

function renderInventoryDrawerDetail(entry) {
  const detail = document.getElementById("inventoryDrawerDetail");
  if (!detail || !entry) return;

  if (entry.type === "cargo") {
    const unitBasis = cargoCostBasis[entry.key] || 0;
    detail.innerHTML = `
      <div class="inventory-detail-title">
        <img src="${entry.icon}" alt="${entry.name}">
        <div><strong>${entry.name}</strong><span>${entry.rarity} resource</span></div>
      </div>
      <div class="inventory-detail-stats">
        <span>Held <strong>${formatNumber(entry.quantity)}</strong></span>
        <span>Avg Cost <strong>${unitBasis ? `CR ${formatNumber(Math.round(unitBasis))}` : "—"}</strong></span>
      </div>
      <div class="inventory-detail-actions">
        <button onclick="jettisonCargo('${escapeJsString(entry.key)}', 1); renderInventoryDrawer();">Drop 1</button>
        <button onclick="jettisonCargo('${escapeJsString(entry.key)}', 10); renderInventoryDrawer();">Drop 10</button>
        <button class="danger-lite" onclick="jettisonCargo('${escapeJsString(entry.key)}', 'all'); renderInventoryDrawer();">Drop All</button>
      </div>
    `;
    return;
  }

  const itemDef = itemDefinitions[entry.key] || {};
  const isGun = entry.kind === "gun";
  const isAttachment = entry.kind === "attachment";
  const gun = GUNS[entry.key];
  const attachment = attachments[entry.key];
  const statText = isGun && gun
    ? `Attack ${formatNumber(getStoreGunAttack({ key: entry.key }, entry.quality))}`
    : isAttachment && attachment
      ? getStoreAttachmentEffectText({ key: entry.key }, entry.quality)
      : itemDef.core
        ? "Upgrade material"
        : "Owned item";
  const canEquip = entry.source !== "equipped" && (isGun || isAttachment);
  const canUnequip = entry.source === "equipped" && (isGun || isAttachment);
  const canDrop = entry.source !== "equipped";

  detail.innerHTML = `
    <div class="inventory-detail-title">
      <img src="${entry.icon}" alt="${entry.name}">
      <div><strong>${titleCaseQuality(entry.quality)} ${entry.name}</strong><span>${entry.category}</span></div>
    </div>
    <div class="inventory-detail-stats">
      <span>Owned <strong>${formatNumber(entry.quantity)}</strong></span>
      <span>${statText}</span>
      ${entry.equipped ? `<span>Equipped <strong>${formatNumber(entry.equipped)}</strong></span>` : ""}
    </div>
    <div class="inventory-detail-actions">
      ${canEquip ? `<button onclick="equipInventoryItemToCurrentShip('${escapeJsString(entry.key)}', '${escapeJsString(entry.quality)}', '${escapeJsString(entry.source)}')">Equip</button>` : ""}
      ${canUnequip ? `<button onclick="unequipCurrentShipItem('${escapeJsString(entry.key)}', '${escapeJsString(entry.quality)}', '${escapeJsString(entry.kind)}')">Unequip</button>` : ""}
      ${canDrop ? `<button class="danger-lite" onclick="dropInventoryItemGroup('${escapeJsString(entry.key)}', '${escapeJsString(entry.quality)}', '${escapeJsString(entry.source)}')">Drop</button>` : `<button disabled>Unequip first</button>`}
    </div>
  `;
}

function equipInventoryItemToCurrentShip(key, quality = "standard", source = "inventory") {
  selectedHangarShipId = currentShipId;
  const loadout = getShipLoadout(currentShipId);
  const isAttachment = Boolean(attachments[key]);
  const isGun = Boolean(GUNS[key]);

  if (!isAttachment && !isGun) return;

  if (isAttachment && loadout.attachments.length >= getAttachmentSlotLimit(currentShipId)) {
    alert("No empty attachment slots.");
    return;
  }

  if (isGun && loadout.guns.length >= getGunSlotLimit(currentShipId)) {
    alert("No empty gun slots.");
    return;
  }

  if (source === "owned" && quality === "standard") {
    const store = isAttachment ? ownedAttachments : ownedGuns;
    if ((store[key] || 0) <= 0) return;
    store[key] -= 1;
  } else {
    const removed = removeOneInventoryItem(key, quality);
    if (!removed) return;
  }

  if (isAttachment) {
    loadout.attachments.push(makeLoadoutEntry(key, quality));
    applyShipStats(true);
  } else {
    loadout.guns.push(makeLoadoutEntry(key, quality));
    if (engageTimer) {
      clearInterval(engageTimer);
      engageTimer = null;
    }
  }

  addActivityLog(`${titleCaseQuality(quality)} ${(itemDefinitions[key] || attachments[key] || GUNS[key]).name} equipped.`);
  tutorialEvent("equippedItem");
  selectedInventoryDetailId = null;
  updateSpaceHUD();
  renderInventoryDrawer();
  saveGame();
}

function unequipCurrentShipItem(key, quality = "standard", kind = "attachment") {
  selectedHangarShipId = currentShipId;
  const loadout = getShipLoadout(currentShipId);
  const list = kind === "gun" ? loadout.guns : loadout.attachments;
  const index = list.findIndex(entry => getEquipmentKey(entry) === key && getEquipmentQuality(entry) === quality);
  if (index < 0) return;

  if (kind === "gun" && list.length <= 1) {
    alert("At least one gun must stay equipped.");
    return;
  }

  list.splice(index, 1);

  if (quality === "standard") {
    if (kind === "gun") ownedGuns[key] = (ownedGuns[key] || 0) + 1;
    else ownedAttachments[key] = (ownedAttachments[key] || 0) + 1;
  } else {
    inventoryItems.push({
      id: `item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      key,
      quality
    });
  }

  if (kind === "attachment") applyShipStats(true);
  if (kind === "gun" && engageTimer) {
    clearInterval(engageTimer);
    engageTimer = null;
  }

  addActivityLog(`${titleCaseQuality(quality)} ${(itemDefinitions[key] || attachments[key] || GUNS[key]).name} unequipped.`);
  selectedInventoryDetailId = null;
  updateSpaceHUD();
  renderInventoryDrawer();
  saveGame();
}

function dropInventoryItemGroup(key, quality = "standard", source = "inventory") {
  if (source === "owned" && quality === "standard") {
    if (ownedAttachments[key] > 0) ownedAttachments[key] -= 1;
    else if (ownedGuns[key] > 0) ownedGuns[key] -= 1;
  } else {
    const removed = removeOneInventoryItem(key, quality);
    if (!removed) return;
  }

  const itemName = (itemDefinitions[key] || attachments[key] || GUNS[key] || {}).name || key;
  addActivityLog(`${itemName} dropped.`);
  selectedInventoryDetailId = null;
  updateSpaceHUD();
  renderInventoryDrawer();
  saveGame();
}

function showTargetPanel() {
  updateObjectActionPanel(true);

  if (targetCollapseTimer) {
    clearTimeout(targetCollapseTimer);
    targetCollapseTimer = null;
  }
}

function autoCollapseTargetPanel(delay = 3500) {
  if (targetCollapseTimer) {
    clearTimeout(targetCollapseTimer);
  }

  targetCollapseTimer = setTimeout(() => {
    if (!engageTimer) {
      selectedTarget = null;
      updateObjectActionPanel(false);
      updateAsteroidUI();
      updateHudDock();
    }
  }, delay);
}

function toggleTargetEngagement() {
  const selected = getSelectedTargetEntity();
  const engaged = getEngagedTargetEntity();
  const selectedIsEngaged = selected && engagedTarget && selected.id === engagedTarget.id;

  if (engageTimer && selectedIsEngaged) {
    disengageTarget(true);
    updateObjectActionPanel(true);
    return;
  }

  if (engageTimer && selected && !selectedIsEngaged) {
    disengageTarget(true);
    engageTarget();
    updateObjectActionPanel(true);
    return;
  }

  engageTarget();
  updateObjectActionPanel(true);
}

function addActivityLog(message) {
  const feed = document.getElementById("activityLogFeed");
  if (!feed) return;

  const placeholder = feed.querySelector(".activity-log-item.muted");
  if (placeholder) {
    placeholder.remove();
  }

  const item = document.createElement("div");
  item.className = "activity-log-item";
  item.textContent = message;
  feed.prepend(item);

  while (feed.children.length > 14) {
    feed.removeChild(feed.lastElementChild);
  }
}

function addHudToast(message) {
  addActivityLog(message);
}

function getPilotName() {
  const savedAccount = JSON.parse(localStorage.getItem(STORAGE_ACCOUNT_KEY) || "null");
  const localPilot = localStorage.getItem("sectorOneLoggedIn");
  return savedAccount?.username || localPilot || "Pilot";
}

function addLocalChatLine(author, message, type = "") {
  const feed = document.getElementById("localChatFeed");
  if (!feed) return;

  const line = document.createElement("div");
  line.className = `chat-line ${type}`.trim();

  const cleanAuthor = String(author || "Pilot").slice(0, 28);
  const cleanMessage = String(message || "").slice(0, 160);

  line.innerHTML = `<strong>${cleanAuthor}:</strong> <span>${cleanMessage}</span>`;
  feed.appendChild(line);
  feed.scrollTop = feed.scrollHeight;

  while (feed.children.length > 30) {
    feed.removeChild(feed.firstElementChild);
  }
}

function sendLocalChatMessage() {
  const input = document.getElementById("localChatInput");
  if (!input) return;

  const message = input.value.trim();
  if (!message) return;

  addLocalChatLine(getPilotName(), message);
  input.value = "";
}

function handleLocalChatKey(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    sendLocalChatMessage();
  }
}

function updateObjectActionPanel(forceVisible = false) {
  const panel = document.getElementById("objectActionPanel");
  const actionBtn = document.getElementById("objectEngageBtn");
  const selected = getSelectedTargetEntity();
  const engaged = getEngagedTargetEntity();
  const target = selected || engaged;

  if (!panel || !actionBtn) return;

  const isRelevant = target && target.node === currentNode && target.alive;

  if (!isRelevant) {
    panel.classList.remove("visible");
    actionBtn.disabled = true;
    actionBtn.textContent = "ENGAGE";
    actionBtn.classList.remove("disengage-action");
    return;
  }

  const selectedIsEngaged = selected && engagedTarget && selected.id === engagedTarget.id;

  panel.classList.add("visible");
  actionBtn.disabled = false;
  actionBtn.textContent = engageTimer && selectedIsEngaged ? "DISENGAGE" : "ENGAGE";
  actionBtn.classList.toggle("disengage-action", !!engageTimer && selectedIsEngaged);
}

function updateHudDock() {
  const sectorBtn = document.getElementById("sectorDockBtn");
  const inventoryBtn = document.getElementById("inventoryDockBtn");
  const sectorCargoSummary = document.getElementById("sectorCargoSummary");
  const cargoSummary = document.getElementById("cargoSummary");
  const cargoCapacityText = document.getElementById("cargoCapacityText");
  const inventoryItemCountText = document.getElementById("inventoryItemCountText");
  const itemInventorySummary = document.getElementById("itemInventorySummary");

  const loot = lootByNode[currentNode];
  const hasLoot = loot && Object.values(loot).some(amount => amount > 0);
  const usedCargo = cargoUsed();
  const maxCargo = getShipStats().cargo;
  const groupedItems = groupInventoryItems(inventoryItems);

  if (sectorBtn) {
    sectorBtn.classList.toggle("has-alert", !!hasLoot);
  }

  if (inventoryBtn) {
    inventoryBtn.classList.toggle("has-alert", usedCargo > 0 || groupedItems.length > 0);
  }

  if (cargoCapacityText) {
    cargoCapacityText.textContent = `${formatNumber(usedCargo)} / ${formatNumber(maxCargo)}`;
  }

  if (inventoryItemCountText) {
    inventoryItemCountText.textContent = `${formatNumber(inventoryItems.length)} item${inventoryItems.length === 1 ? "" : "s"}`;
  }

  if (itemInventorySummary) {
    itemInventorySummary.innerHTML = groupedItems.length
      ? groupedItems.map(item => `
          <div class="inventory-item-card inventory-item-card-minimal quality-${item.quality}" title="${item.name} · ${titleCaseQuality(item.quality)} · ${item.category}">
            <span class="quality-corner quality-corner-tl"></span>
            <span class="quality-corner quality-corner-br"></span>
            <div class="inventory-item-count">x${formatNumber(item.count)}</div>
            <div class="inventory-item-frame inventory-item-frame-minimal quality-${item.quality}">
              <img class="inventory-item-image inventory-item-image-minimal" src="${item.icon}" alt="${item.name}">
            </div>
          </div>
        `).join("")
      : `<div class="cargo-empty">No items collected yet.</div>`;
  }

  if (cargoSummary) {
    const cargoRows = mineralKeys
      .filter(mineral => cargo[mineral] > 0)
      .map(mineral => `
        <div class="cargo-resource-card compact-resource-card">
          <img src="${getCommodityImage(mineral)}" alt="${mineral}">
          <div class="cargo-resource-info">
            <strong>${mineral}</strong>
            <span>${formatNumber(cargo[mineral])} held</span>
          </div>
          <div class="cargo-resource-actions compact-actions">
            <button onclick="jettisonCargo('${escapeJsString(mineral)}', 1)">-1</button>
            <button onclick="jettisonCargo('${escapeJsString(mineral)}', 10)">-10</button>
            <button onclick="jettisonCargo('${escapeJsString(mineral)}', 'all')">Drop</button>
          </div>
        </div>
      `);

    cargoSummary.innerHTML = cargoRows.length
      ? cargoRows.join("")
      : `<div class="cargo-empty">Cargo hold empty.</div>`;
  }

  if (sectorCargoSummary) {
    sectorCargoSummary.innerHTML = `Used: ${formatNumber(usedCargo)} / ${formatNumber(maxCargo)}`;
  }

  renderObjectiveHud();
  updateObjectActionPanel();

  const inventoryDrawer = document.getElementById("inventoryDrawer");
  if (inventoryDrawer && inventoryDrawer.classList.contains("active")) {
    renderInventoryDrawer();
  }
}

function updateSpaceHUD() {
  const ship = getCurrentShip();
  const stats = getShipStats();

  if (!Number.isFinite(hullMax) || hullMax <= 0) hullMax = stats.hull;
  if (!Number.isFinite(shieldMax) || shieldMax < 0) shieldMax = stats.shield;
  if (!Number.isFinite(jumpCharge) || jumpCharge < 0) jumpCharge = 0;
  if (!Number.isFinite(hull) || hull < 0) hull = hullMax;
  if (!Number.isFinite(shield) || shield < 0) shield = shieldMax;

  const jumpFill = document.getElementById("jumpFill");
  if (!jumpFill) return;

  const safeJumpMax = Number.isFinite(jumpMax) && jumpMax > 0 ? jumpMax : 100;
  const safeHullMax = Number.isFinite(hullMax) && hullMax > 0 ? hullMax : 1;
  const safeShieldMax = Number.isFinite(shieldMax) && shieldMax > 0 ? shieldMax : 0;

  document.getElementById("jumpFill").style.height = `${Math.max(0, Math.min(100, (jumpCharge / safeJumpMax) * 100))}%`;
  document.getElementById("jumpValue").textContent = formatNumber(Math.floor(jumpCharge));
  document.getElementById("jumpBtn").disabled = jumpCharge < safeJumpMax || hull <= 0;

  document.getElementById("hullFill").style.height = `${Math.max(0, Math.min(100, (hull / safeHullMax) * 100))}%`;
  document.getElementById("hullValue").textContent = formatNumber(Math.floor(hull));

  document.getElementById("shieldFill").style.height = `${safeShieldMax > 0 ? Math.max(0, Math.min(100, (shield / safeShieldMax) * 100)) : 0}%`;
  document.getElementById("shieldValue").textContent = formatNumber(Math.floor(shield));

  const shipImage = document.getElementById("hudShipImage");
  if (shipImage) {
    shipImage.src = ship.image;
    shipImage.alt = ship.name;
  }

  updateCargoSummary();
  updateTargetPanel();
  updateHudDock();
  updateProgressDisplays();
}

function startJumpRecharge() {
  if (jumpTimer) return;

  jumpTimer = setInterval(() => {
    if (jumpCharge < jumpMax) {
      const rechargeRate = getShipStats().jumpRecharge;
      jumpCharge = Math.min(jumpMax, jumpCharge + rechargeRate);
      updateSpaceHUD();
    }

    if (jumpCharge >= jumpMax) {
      clearInterval(jumpTimer);
      jumpTimer = null;
    }
  }, 500);
}

function stopShieldRegen() {
  if (shieldRegenDelayTimer) {
    clearTimeout(shieldRegenDelayTimer);
    shieldRegenDelayTimer = null;
  }

  if (shieldRegenTimer) {
    clearInterval(shieldRegenTimer);
    shieldRegenTimer = null;
  }
}

function scheduleShieldRegen() {
  if (shield >= shieldMax) {
    shield = shieldMax;
    stopShieldRegen();
    updateSpaceHUD();
    return;
  }

  stopShieldRegen();

  shieldRegenDelayTimer = setTimeout(() => {
    shieldRegenDelayTimer = null;
    playShieldRegenSound();

    shieldRegenTimer = setInterval(() => {
      shield = Math.min(shieldMax, shield + SHIELD_REGEN_RATE);
      updateSpaceHUD();
      saveGame();

      if (shield >= shieldMax) {
        shield = shieldMax;
        stopShieldRegen();
        updateSpaceHUD();
      }
    }, SHIELD_REGEN_INTERVAL_MS);
  }, SHIELD_REGEN_DELAY_MS);
}

function applyDamageToPlayer(totalDamage) {
  if (totalDamage <= 0) return;
  if (hull <= 0) return;

  stopShieldRegen();

  const previousHull = hull;
  let remainingDamage = getMitigatedIncomingDamage(totalDamage);

  if (shield > 0) {
    const shieldDamage = Math.min(shield, remainingDamage);
    shield = Math.max(0, shield - shieldDamage);
    remainingDamage -= shieldDamage;
  }

  if (remainingDamage > 0) {
    hull = Math.max(0, hull - remainingDamage);
  }

  if (hull <= 0 && previousHull > 0) {
    handleShipDisabled();
    return;
  }

  updateSpaceHUD();
  saveGame();

  if (shield < shieldMax) {
    scheduleShieldRegen();
  }
}

function calculateDisabledCargoLoss() {
  const lostCargo = {};

  mineralKeys.forEach(mineral => {
    const held = Number(cargo[mineral] || 0);
    if (held <= 0) return;

    lostCargo[mineral] = held;
    cargo[mineral] = 0;

    if (cargoCostBasis[mineral]) {
      delete cargoCostBasis[mineral];
    }
  });

  return lostCargo;
}

function summarizeCargoLoss(lostCargo) {
  const rows = Object.entries(lostCargo || {}).filter(([, amount]) => amount > 0);
  if (!rows.length) return "No cargo lost.";
  return rows.map(([mineral, amount]) => `${formatNumber(amount)} ${mineral}`).join(", ");
}

function handleShipDisabled() {
  hull = 0;
  shield = 0;
  stopShieldRegen();
  disengageTarget(true);
  closeSectorMap();

  const lostCargo = calculateDisabledCargoLoss();
  const towPlanet = sectorNodes[homePlanet]?.type === "planet" ? homePlanet : "Asteron Prime";
  currentNode = towPlanet;
  lastPlanetNode = towPlanet;
  jumpCharge = 0;

  const lossSummary = summarizeCargoLoss(lostCargo);
  addActivityLog(`Ship destroyed. Emergency tow to home planet ${towPlanet}. Cargo lost: ${lossSummary}`);
  updateHubLocation();
  updateSpaceHUD();
  showScreen("gameScreen");
  showShipDisabledOverlay(`Emergency tow to your home planet, ${towPlanet}. All carried resources were lost. Ships, guns and equipment are safe. Repair your hull in the Hangar before launching again.`, Object.entries(lostCargo));
  saveGame();
}

function showShipDisabledOverlay(message, lostEntries = []) {
  let overlay = document.getElementById("shipDisabledOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "shipDisabledOverlay";
    overlay.className = "repair-overlay";
    document.body.appendChild(overlay);
  }

  const lostMarkup = lostEntries.length
    ? lostEntries.map(([mineral, amount]) => `<div class="repair-loss-row"><span>${mineral}</span><strong>-${formatNumber(amount)}</strong></div>`).join("")
    : `<div class="repair-loss-row muted"><span>Cargo</span><strong>No loss</strong></div>`;

  overlay.innerHTML = `
    <div class="repair-modal">
      <div class="reward-kicker danger-kicker">Ship Disabled</div>
      <h2>Hull Critical</h2>
      <p>${message}</p>
      <div class="repair-modal-stat"><span>Hull</span><strong>${formatNumber(Math.floor(hull))} / ${formatNumber(hullMax)}</strong></div>
      <div class="repair-loss-list">${lostMarkup}</div>
      <div class="repair-modal-actions">
        <button onclick="closeShipDisabledOverlay(); openHangar();">Open Hangar</button>
        <button class="secondary" onclick="closeShipDisabledOverlay()">Stay Docked</button>
      </div>
    </div>
  `;

  requestAnimationFrame(() => overlay.classList.add("active"));
}

function closeShipDisabledOverlay() {
  const overlay = document.getElementById("shipDisabledOverlay");
  if (overlay) {
    overlay.classList.remove("active");
    overlay.classList.remove("tutorial-intro-active");
    overlay.classList.remove("tutorial-left-card");
    overlay.classList.remove("tutorial-bottom-card");
    overlay.classList.remove("tutorial-outro-active");
    overlay.classList.remove("tutorial-outro-active");
    overlay.classList.remove("tutorial-left-card");
    overlay.classList.remove("tutorial-bottom-card");
  }
}

function toggleShield() {
  // Shield is now passive and always active.
}

/* Sector Map */

function openSectorMap() {
  tutorialEvent("openedSectorMap");
  if (jumpCharge < jumpMax) return;
  document.getElementById("sectorMap").classList.add("active");
  renderSectorMap();
  if (tutorialState.active && [
    "make-jump",
    "scan-for-bots",
    "jump-to-bounty-zone",
    "return-to-planet-after-bounty"
  ].includes(getCurrentTutorialStep()?.id)) {
    setTimeout(renderStarterTutorial, 60);
  }
}

function closeSectorMap() {
  document.getElementById("sectorMap").classList.remove("active");
}

function renderSectorMap() {
  const svg = document.getElementById("sectorSvg");
  svg.innerHTML = "";
  addMapDefs(svg);
  drawMapZones(svg);
  drawRoutes(svg);
  drawNodes(svg);
  drawSectorScanMarkers(svg);
  updateSectorScanPanel();
}


function getSectorScanRemainingMs(targetTime) {
  return Math.max(0, Math.ceil((Number(targetTime || 0) - Date.now()) / 1000));
}

function isSectorScanActive() {
  return Date.now() < Number(sectorScanState.activeUntil || 0) && !!sectorScanState.result;
}

function getSectorScanCooldownUntil(type) {
  return Number(sectorScanState.cooldownUntilByType?.[type] || 0);
}

function hasSectorScanCooldownsActive() {
  const now = Date.now();
  return ["ally", "bot", "enemy"].some(type => now < getSectorScanCooldownUntil(type));
}

function getBotScanSignals() {
  const grouped = new Map();
  hostileBots
    .filter(bot => bot.alive && sectorNodes[bot.node])
    .forEach(bot => {
      if (!grouped.has(bot.node)) {
        const node = sectorNodes[bot.node];
        grouped.set(bot.node, {
          type: "bot",
          node: bot.node,
          x: node.x,
          y: node.y,
          count: 0,
          names: []
        });
      }
      const signal = grouped.get(bot.node);
      signal.count += 1;
      signal.names.push(bot.name);
    });

  return Array.from(grouped.values());
}

function summarizeBotScanZones(signals) {
  const summary = { upper: 0, lower: 0, core: 0 };
  (signals || []).forEach(signal => {
    const node = sectorNodes[signal.node];
    if (!node) return;
    if (node.y < 45) summary.upper += signal.count;
    else if (node.y > 55) summary.lower += signal.count;
    else summary.core += signal.count;
  });

  return Object.entries(summary)
    .filter(([, count]) => count > 0)
    .map(([zone, count]) => `${formatNumber(count)} ${zone === "upper" ? "upper" : zone === "lower" ? "lower" : "core"} signal${count === 1 ? "" : "s"}`)
    .join(" · ");
}

function getSectorScanResultForType(type) {
  if (type === "bot") {
    return {
      botSignals: getBotScanSignals(),
      allySignals: [],
      enemySignals: []
    };
  }

  return {
    botSignals: [],
    allySignals: [],
    enemySignals: []
  };
}

function scanSector(type = "bot") {
  const scanType = ["ally", "bot", "enemy"].includes(type) ? type : "bot";
  const now = Date.now();
  const cooldownUntil = getSectorScanCooldownUntil(scanType);

  if (now < cooldownUntil) {
    updateSectorScanPanel();
    return;
  }

  const scanResult = getSectorScanResultForType(scanType);
  const cooldownMs = Number(SECTOR_SCAN_COOLDOWNS_MS[scanType] || 0);
  sectorScanState = {
    activeUntil: now + SECTOR_SCAN_DURATION_MS,
    cooldownUntilByType: {
      ...(sectorScanState.cooldownUntilByType || {}),
      [scanType]: now + cooldownMs
    },
    result: {
      createdAt: now,
      type: scanType,
      ...scanResult
    }
  };

  if (scanType === "bot") {
    const zoneSummary = summarizeBotScanZones(scanResult.botSignals) || "no bot contacts detected";
    addActivityLog(`Bot scan complete: ${zoneSummary}.`);
    tutorialEvent("scannedBots");
  } else if (scanType === "ally") {
    addActivityLog("Ally scan complete: no allied pilot signals detected.");
  } else {
    addActivityLog("Enemy scan complete: no enemy pilot signals detected.");
  }

  renderSectorMap();
  if (tutorialState?.active && ["scan-for-bots", "destroy-bot"].includes(getCurrentTutorialStep()?.id)) {
    setTimeout(renderStarterTutorial, 60);
  }
  startSectorScanTicker();

  window.setTimeout(() => {
    if (!isSectorScanActive()) {
      renderSectorMap();
      updateSectorScanPanel();
    }
  }, SECTOR_SCAN_DURATION_MS + 120);
}

function startSectorScanTicker() {
  if (sectorScanTicker) return;
  sectorScanTicker = window.setInterval(() => {
    updateSectorScanPanel();
    if (!isSectorScanActive() && !hasSectorScanCooldownsActive()) {
      window.clearInterval(sectorScanTicker);
      sectorScanTicker = null;
    }
  }, 250);
}

function updateScanButtonProgress(button, type) {
  if (!button) return;
  const now = Date.now();
  const cooldownMs = Number(SECTOR_SCAN_COOLDOWNS_MS[type] || 0);
  const cooldownUntil = getSectorScanCooldownUntil(type);
  const remainingMs = Math.max(0, cooldownUntil - now);
  const remainingSeconds = getSectorScanRemainingMs(cooldownUntil);
  const progress = cooldownMs > 0 && remainingMs > 0 ? Math.min(1, remainingMs / cooldownMs) : 0;

  button.disabled = remainingMs > 0;
  button.style.setProperty("--scan-progress", progress.toFixed(3));
  const label = type === "ally" ? "Allies" : type === "enemy" ? "Enemies" : "Bots";
  const labelNode = button.querySelector("span") || button;
  labelNode.textContent = remainingMs > 0 ? `${label} ${remainingSeconds}s` : label;
}

function updateSectorScanPanel() {
  const status = document.getElementById("sectorScanStatus");
  const buttons = {
    ally: document.getElementById("sectorScanAlliesBtn"),
    bot: document.getElementById("sectorScanBotsBtn"),
    enemy: document.getElementById("sectorScanEnemiesBtn")
  };
  if (!status) return;

  Object.entries(buttons).forEach(([type, button]) => updateScanButtonProgress(button, type));

  const active = isSectorScanActive();
  if (active) {
    const visibleRemaining = getSectorScanRemainingMs(sectorScanState.activeUntil);
    const scanType = sectorScanState.result?.type || "bot";
    const botCount = (sectorScanState.result?.botSignals || []).reduce((sum, signal) => sum + signal.count, 0);
    if (scanType === "bot") {
      status.textContent = `Bot result visible ${visibleRemaining}s · ${formatNumber(botCount)} signal${botCount === 1 ? "" : "s"}`;
    } else if (scanType === "ally") {
      status.textContent = `Ally result visible ${visibleRemaining}s · no allied signals`;
    } else {
      status.textContent = `Enemy result visible ${visibleRemaining}s · no enemy signals`;
    }
    status.classList.add("active");
  } else if (hasSectorScanCooldownsActive()) {
    status.textContent = "Scanner cooldown active";
    status.classList.remove("active");
  } else {
    status.textContent = "Scanners ready";
    status.classList.remove("active");
  }
}

function drawSectorScanMarkers(svg) {
  if (!isSectorScanActive()) return;

  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.setAttribute("class", "svg-scan-marker-layer");

  const drawSignal = (signal, type) => {
    const marker = document.createElementNS("http://www.w3.org/2000/svg", "g");
    marker.setAttribute("class", `svg-scan-marker scan-${type}`);
    marker.setAttribute("data-node", signal.node || "");

    const pulse = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    pulse.setAttribute("cx", signal.x);
    pulse.setAttribute("cy", signal.y);
    pulse.setAttribute("r", 2.5);
    pulse.setAttribute("class", "scan-pulse");
    marker.appendChild(pulse);

    const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    ring.setAttribute("cx", signal.x);
    ring.setAttribute("cy", signal.y);
    ring.setAttribute("r", 1.45);
    ring.setAttribute("class", "scan-ring");
    marker.appendChild(ring);

    if (signal.count > 1) {
      const count = document.createElementNS("http://www.w3.org/2000/svg", "text");
      count.setAttribute("x", signal.x + 2.2);
      count.setAttribute("y", signal.y - 1.8);
      count.setAttribute("class", "scan-count");
      count.textContent = signal.count;
      marker.appendChild(count);
    }

    group.appendChild(marker);
  };

  (sectorScanState.result?.botSignals || []).forEach(signal => drawSignal(signal, "bot"));
  (sectorScanState.result?.allySignals || []).forEach(signal => drawSignal(signal, "ally"));
  (sectorScanState.result?.enemySignals || []).forEach(signal => drawSignal(signal, "enemy"));

  svg.appendChild(group);
}

function addMapDefs(svg) {
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.innerHTML = `
    <radialGradient id="planetVirella" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#d5ffe8"/>
      <stop offset="45%" stop-color="#6d9f82"/>
      <stop offset="100%" stop-color="#10261f"/>
    </radialGradient>
    <radialGradient id="planetAsteron" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#b8ecff"/>
      <stop offset="45%" stop-color="#2d83ad"/>
      <stop offset="100%" stop-color="#071a2a"/>
    </radialGradient>
    <radialGradient id="planetNyxara" cx="35%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#ffd0a2"/>
      <stop offset="45%" stop-color="#b86226"/>
      <stop offset="100%" stop-color="#2c1207"/>
    </radialGradient>
  `;
  svg.appendChild(defs);
}


function drawMapZones(svg) {
  sectorMapZones.forEach(zone => {
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
    group.setAttribute("class", `svg-zone-label zone-${zone.tone}`);

    const icon = document.createElementNS("http://www.w3.org/2000/svg", "text");
    icon.setAttribute("x", zone.x);
    icon.setAttribute("y", zone.y - 3.8);
    icon.setAttribute("class", "svg-zone-icon");
    icon.textContent = zone.icon;
    group.appendChild(icon);

    const name = document.createElementNS("http://www.w3.org/2000/svg", "text");
    name.setAttribute("x", zone.x);
    name.setAttribute("y", zone.y);
    name.setAttribute("class", "svg-zone-name");
    name.textContent = zone.name;
    group.appendChild(name);

    const subtitle = document.createElementNS("http://www.w3.org/2000/svg", "text");
    subtitle.setAttribute("x", zone.x);
    subtitle.setAttribute("y", zone.y + 2.7);
    subtitle.setAttribute("class", "svg-zone-subtitle");
    subtitle.textContent = zone.subtitle;
    group.appendChild(subtitle);

    svg.appendChild(group);
  });
}

function getRouteTone(node, targetNode) {
  const tones = [node.route, targetNode.route];

  if (tones.includes("combat")) return "combat-route";
  if (tones.includes("risky")) return "risky-route";
  if (tones.includes("loot")) return "loot-route";
  if (tones.includes("mining")) return "mining-route";
  return "safe-route";
}

function drawRoutes(svg) {
  const drawnRoutes = new Set();

  Object.entries(sectorNodes).forEach(([name, node]) => {
    node.connects.forEach(target => {
      const key = [name, target].sort().join("|");
      if (drawnRoutes.has(key)) return;
      drawnRoutes.add(key);

      const targetNode = sectorNodes[target];
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("x1", node.x);
      line.setAttribute("y1", node.y);
      line.setAttribute("x2", targetNode.x);
      line.setAttribute("y2", targetNode.y);
      const isAvailableRoute = name === currentNode || target === currentNode;
      const isPlannedTradeRoute = isLineOnActiveTradeRoute(name, target);
      const routeTone = getRouteTone(node, targetNode);
      line.setAttribute("class", `svg-route ${isAvailableRoute ? "available" : ""} ${isPlannedTradeRoute ? "planned-trade-route" : ""} ${routeTone}`);
      svg.appendChild(line);
    });
  });
}

function drawNodes(svg) {
  Object.entries(sectorNodes).forEach(([name, node]) => {
    const isCurrent = name === currentNode;
    const canJump = sectorNodes[currentNode].connects.includes(name);
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");

    group.style.cursor = canJump || isCurrent ? "pointer" : "not-allowed";
    group.onclick = () => jumpToNode(name);

    if (node.type === "planet") {
      drawPlanetNode(group, name, node, isCurrent, canJump);
    } else {
      drawSpaceNode(group, node, isCurrent, canJump);
    }

    svg.appendChild(group);
  });
}

function drawPlanetNode(group, name, node, isCurrent, canJump) {
  const isPlanned = isNodeOnActiveTradeRoute(name);
  const glow = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  glow.setAttribute("cx", node.x);
  glow.setAttribute("cy", node.y);
  glow.setAttribute("r", 3.8);
  glow.setAttribute("fill", "rgba(80, 180, 255, 0.12)");
  group.appendChild(glow);

  const planet = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  planet.setAttribute("cx", node.x);
  planet.setAttribute("cy", node.y);
  planet.setAttribute("r", 2.6);
  planet.setAttribute("fill", node.planetClass === "virella" ? "url(#planetVirella)" : node.planetClass === "nyxara" ? "url(#planetNyxara)" : "url(#planetAsteron)");
  if (!canJump && !isCurrent) planet.setAttribute("opacity", "0.45");
  group.appendChild(planet);

  const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  ring.setAttribute("cx", node.x);
  ring.setAttribute("cy", node.y);
  ring.setAttribute("r", isCurrent ? 3.5 : 3.0);
  ring.setAttribute("class", isCurrent ? "svg-current-ring" : isPlanned ? "svg-planned-trade-ring" : "svg-planet-ring");
  group.appendChild(ring);

  const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
  label.setAttribute("x", node.x);
  label.setAttribute("y", node.y + 5.2);
  label.setAttribute("class", "svg-planet-label");
  label.textContent = name;
  group.appendChild(label);

  const hit = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  hit.setAttribute("cx", node.x);
  hit.setAttribute("cy", node.y);
  hit.setAttribute("r", 5.5);
  hit.setAttribute("class", "svg-node-hit");
  group.appendChild(hit);
}

function drawSpaceNode(group, node, isCurrent, canJump) {
  const nodeName = Object.keys(sectorNodes).find(name => sectorNodes[name] === node);
  const isPlanned = isNodeOnActiveTradeRoute(nodeName);
  const star = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  star.setAttribute("cx", node.x);
  star.setAttribute("cy", node.y);
  star.setAttribute("r", node.route === "safe" ? 0.72 : 0.82);
  star.setAttribute("class", `svg-space-node ${node.route || "safe"} ${node.danger === "hostile" ? "hostile" : "safe"} ${isPlanned ? "planned-trade-node" : ""} ${!canJump && !isCurrent ? "locked" : ""}`);
  group.appendChild(star);

  if (isCurrent) {
    const currentRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    currentRing.setAttribute("cx", node.x);
    currentRing.setAttribute("cy", node.y);
    currentRing.setAttribute("r", 1.4);
    currentRing.setAttribute("class", "svg-current-ring");
    group.appendChild(currentRing);
  }

  const hit = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  hit.setAttribute("cx", node.x);
  hit.setAttribute("cy", node.y);
  hit.setAttribute("r", 2.8);
  hit.setAttribute("class", "svg-node-hit");
  group.appendChild(hit);
}

function jumpToNode(destination) {
  if (destination === currentNode) return;
  if (!sectorNodes[currentNode].connects.includes(destination)) return;
  if (jumpCharge < jumpMax) return;

  currentNode = destination;
  if (sectorNodes[currentNode].type === "planet") {
    lastPlanetNode = currentNode;
  }

  playJumpSound();
  jumpCharge = 0;
  closeSectorMap();
  disengageTarget(true);
  // Keep the currently selected HUD tab when jumping between nodes.
  maybeMoveAsteroid();
  updateCurrentNodeUI();
  updateSpaceHUD();
  updateAsteroidUI();
  tutorialEvent("jumpedNode");
  if (tutorialState?.active) setTimeout(renderStarterTutorial, 120);
  startJumpRecharge();
  saveGame();
}

function updateCurrentNodeUI() {
  const node = sectorNodes[currentNode];
  const nodeNameTag = document.getElementById("nodeNameTag");
  const landBtn = document.getElementById("planetLandBtn");
  const spaceScreen = document.getElementById("spaceScreen");
  const mineralsBox = document.getElementById("sectorMinerals");

  if (nodeNameTag) {
    nodeNameTag.textContent = node.type === "planet" ? `${currentNode.toUpperCase()} ORBIT` : currentNode.toUpperCase();
  }

  if (landBtn) {
    landBtn.style.display = node.type === "planet" ? "block" : "none";
    landBtn.style.pointerEvents = node.type === "planet" ? "auto" : "none";
  }

  if (spaceScreen) {
    spaceScreen.classList.toggle("empty-node", node.type !== "planet");
  }

  if (mineralsBox) {
    const minerals = nodeMineralPools[currentNode] || [];
    mineralsBox.innerHTML = minerals.length ? minerals.join(", ") : "No mineral traces.";
  }

  updateHudDock();
}

/* Marketplace */

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-GB");
}


function renderNpcItemBroker() {
  const broker = document.getElementById("npcItemBroker");
  if (!broker) return;

  const groupedItems = groupInventoryItems(inventoryItems);

  if (!groupedItems.length) {
    broker.innerHTML = `<div class="broker-empty">No looted items to sell.</div>`;
    return;
  }

  broker.innerHTML = groupedItems.map(item => {
    const unitValue = getInventoryItemSellValue(item.key, item.quality);
    const stackValue = unitValue * item.count;

    return `
      <div class="broker-item-card quality-${item.quality}">
        <div class="broker-item-frame quality-${item.quality}">
          <img src="${item.icon}" alt="${item.name}">
        </div>
        <div class="broker-item-info">
          <strong>${item.name}</strong>
          <span>${titleCaseQuality(item.quality)} · ${item.category}</span>
        </div>
        <div class="broker-item-stack">x${formatNumber(item.count)}</div>
        <div class="broker-item-value">
          <span>Each</span>
          <strong><span class="mini-credit">CR</span>${formatNumber(unitValue)}</strong>
        </div>
        <div class="broker-item-actions">
          <button onclick="sellInventoryItemToNpc('${escapeJsString(item.key)}', '${escapeJsString(item.quality)}', 1)">Sell 1</button>
          <button onclick="sellInventoryItemToNpc('${escapeJsString(item.key)}', '${escapeJsString(item.quality)}', 'all')">Sell Stack · CR ${formatNumber(stackValue)}</button>
        </div>
      </div>
    `;
  }).join("");
}

function sellInventoryItemToNpc(key, quality, amount = "all", refreshStore = false) {
  const matchingCount = inventoryItems.filter(item => item.key === key && item.quality === quality).length;
  if (!matchingCount) return;

  const quantity = amount === "all" ? matchingCount : Math.min(Number(amount) || 0, matchingCount);
  if (quantity <= 0) return;

  const removed = removeInventoryItems(key, quality, quantity);
  if (!removed) return;

  const unitValue = getInventoryItemSellValue(key, quality);
  credits += unitValue * removed;

  saveGame();
  if (refreshStore) {
    renderStore();
  } else {
    renderMarketplace();
  }
  updateHudDock();
}


function getMarketCycle() {
  return Math.floor(Date.now() / 600000);
}

function getNextMarketRefreshSeconds() {
  return Math.max(0, 600 - Math.floor((Date.now() % 600000) / 1000));
}

function updateTradeTimerDisplay() {
  const cycleText = document.getElementById("marketCycleText");
  if (!cycleText) return;

  const seconds = getNextMarketRefreshSeconds();
  const minutes = Math.floor(seconds / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  cycleText.textContent = `Market shifts in ${minutes}:${remainder}`;
}

function startTradeTerminalTimer() {
  stopTradeTerminalTimer();
  renderedMarketCycle = getMarketCycle();
  tradeTerminalTimer = setInterval(() => {
    updateTradeTimerDisplay();

    const cycle = getMarketCycle();
    if (cycle !== renderedMarketCycle && document.getElementById("marketScreen")?.classList.contains("active")) {
      renderedMarketCycle = cycle;
      renderMarketplace();
    }
  }, 1000);
}

function stopTradeTerminalTimer() {
  if (tradeTerminalTimer) {
    clearInterval(tradeTerminalTimer);
    tradeTerminalTimer = null;
  }
}

function getCommodityRarityClass(good) {
  const rarity = (commodityInfo[good]?.rarity || "common").toLowerCase().replace(/[^a-z0-9]/g, "-");
  return `rarity-${rarity}`;
}

function marketHash(input) {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getDynamicMarketPrices(location = currentNode) {
  const baseMarket = planetMarkets[location] || planetMarkets["Asteron Prime"];
  const cycle = getMarketCycle();
  const prices = {};

  mineralKeys.forEach(good => {
    const base = baseMarket[good] || 1;
    const hash = marketHash(`${cycle}:${location}:${good}`);
    const swing = ((hash % 31) - 15) / 100; // -15% to +15%
    prices[good] = Math.max(1, Math.round(base * (1 + swing)));
  });

  return prices;
}

function getCommodityBuyPrice(good, location = currentNode) {
  return getDynamicMarketPrices(location)[good] || 1;
}

function getCommoditySellPrice(good, location = currentNode) {
  return Math.max(1, Math.floor(getCommodityBuyPrice(good, location) * 0.72));
}

function getActiveTradePricing(good) {
  const objective = syncActiveTradeObjective();
  if (objective?.type === "trade" && objective.good === good) return objective;
  return null;
}

function getEffectiveBuyPrice(good, location = currentNode) {
  const route = getActiveTradePricing(good);
  if (route && route.origin === location) {
    return route.buyPrice;
  }
  return getCommodityBuyPrice(good, location);
}

function getEffectiveSellPrice(good, location = currentNode) {
  const route = getActiveTradePricing(good);
  if (route && route.destination === location) {
    return route.sellPrice;
  }
  return getCommoditySellPrice(good, location);
}

function setTradeTerminalTab(tabName) {
  // Legacy-safe shim: the Trade Terminal is now contracts-first.
  activeTradeTerminalTab = "contracts";
  renderMarketplace();
}

function renderMarketplace() {
  const market = getDynamicMarketPrices(currentNode);
  const stock = marketStock[currentNode] || marketStock[lastPlanetNode] || marketStock["Asteron Prime"];
  const goodsBox = document.getElementById("marketGoods");

  document.getElementById("marketLocationTitle").textContent = currentNode.toUpperCase();
  document.getElementById("creditsText").textContent = formatNumber(credits);
  document.getElementById("cargoText").textContent = `${formatNumber(cargoUsed())} / ${formatNumber(getShipStats().cargo)}`;

  const flavor = document.getElementById("marketFlavorText");
  if (flavor) {
    flavor.textContent = getMarketFlavorText(currentNode);
  }

  renderedMarketCycle = getMarketCycle();
  updateTradeTimerDisplay();
  renderMarketCargoSummary();

  if (!goodsBox) return;
  goodsBox.innerHTML = "";
  renderTradeContractsTerminal(market, stock, goodsBox);
}

function renderBuyCommodities(market, stock, goodsBox) {
  goodsBox.innerHTML = `<div class="trade-commodity-grid"></div>`;
  const grid = goodsBox.querySelector(".trade-commodity-grid");

  mineralKeys.forEach(good => {
    const buyPrice = market[good];
    const info = commodityInfo[good];
    const availableCargo = getShipStats().cargo - cargoUsed();
    const maxAffordable = Math.floor(credits / buyPrice);
    const maxBuy = Math.max(0, Math.min(stock[good] ?? 0, availableCargo, maxAffordable));
    const rarityClass = getCommodityRarityClass(good);

    const item = document.createElement("div");
    item.className = `trade-commodity-card ${rarityClass}`;
    item.id = `tradeCard-${safeId(good)}`;

    item.innerHTML = `
      <div class="trade-commodity-top">
        <div class="commodity-cell">
          <div class="commodity-icon trade-commodity-icon">
            <img src="${info.icon}" alt="${good}" class="commodity-icon-img">
          </div>
          <div>
            <div class="commodity-name">${good}</div>
            <div class="commodity-rarity">${info.rarity}</div>
          </div>
        </div>
      </div>

      <div class="trade-compact-stats buy-compact-stats">
        <div><span>Available</span><strong>${formatNumber(stock[good] ?? 0)}</strong></div>
        <div><span>Buy</span><strong>CR ${formatNumber(buyPrice)}</strong></div>
      </div>

      <div class="trade-compact-control">
        <div class="trade-control-header">
          <strong>Buy</strong>
          <span id="buySummary-${safeId(good)}">0 units · CR 0</span>
        </div>
        <input
          class="trade-range"
          id="buyRange-${safeId(good)}"
          type="range"
          min="0"
          max="${maxBuy}"
          value="0"
          oninput="updateTradePreview('${good}')"
        />
        <div class="trade-control-actions compact-trade-actions">
          <input
            class="qty-input compact-qty"
            id="buyQty-${safeId(good)}"
            type="number"
            min="0"
            max="${maxBuy}"
            value="0"
            oninput="syncTradeInput('${good}', 'buy')"
          />
          <button onclick="setTradeMax('${good}', 'buy')">Max</button>
          <button onclick="buyGood('${good}')">Buy</button>
        </div>
      </div>
    `;

    grid.appendChild(item);
    updateTradePreview(good);
  });
}

function renderSellCommodities(market, stock, goodsBox) {
  const heldGoods = mineralKeys.filter(good => (cargo[good] || 0) > 0);

  if (!heldGoods.length) {
    goodsBox.innerHTML = `<div class="terminal-empty-state">Your cargo hold is empty. Buy or salvage commodities first.</div>`;
    return;
  }

  goodsBox.innerHTML = `<div class="trade-commodity-grid"></div>`;
  const grid = goodsBox.querySelector(".trade-commodity-grid");

  heldGoods.forEach(good => {
    const sellPrice = getCommoditySellPrice(good, currentNode);
    const info = commodityInfo[good];
    const held = cargo[good] || 0;
    const basis = cargoCostBasis[good] || 0;
    const estimatedProfit = basis ? Math.round((sellPrice - basis) * held) : 0;
    const rarityClass = getCommodityRarityClass(good);

    const item = document.createElement("div");
    item.className = `trade-commodity-card ${rarityClass}`;
    item.id = `tradeCard-${safeId(good)}`;

    item.innerHTML = `
      <div class="trade-commodity-top">
        <div class="commodity-cell">
          <div class="commodity-icon trade-commodity-icon">
            <img src="${info.icon}" alt="${good}" class="commodity-icon-img">
          </div>
          <div>
            <div class="commodity-name">${good}</div>
            <div class="commodity-rarity">${info.rarity}</div>
          </div>
        </div>
      </div>

      <div class="trade-compact-stats">
        <div><span>Held</span><strong>${formatNumber(held)}</strong></div>
        <div><span>Sell</span><strong>CR ${formatNumber(sellPrice)}</strong></div>
        <div><span>Profit</span><strong class="${estimatedProfit >= 0 ? "profit-good" : "profit-bad"}">${basis ? `${estimatedProfit >= 0 ? "+" : "-"}CR ${formatNumber(Math.abs(estimatedProfit))}` : "N/A"}</strong></div>
      </div>

      <div class="trade-compact-control">
        <div class="trade-control-header">
          <strong>Sell</strong>
          <span id="sellSummary-${safeId(good)}">0 units · CR 0</span>
        </div>
        <input
          class="trade-range"
          id="sellRange-${safeId(good)}"
          type="range"
          min="0"
          max="${held}"
          value="0"
          oninput="updateTradePreview('${good}')"
        />
        <div class="trade-control-actions compact-trade-actions">
          <input
            class="qty-input compact-qty"
            id="sellQty-${safeId(good)}"
            type="number"
            min="0"
            max="${held}"
            value="0"
            oninput="syncTradeInput('${good}', 'sell')"
          />
          <button onclick="setTradeMax('${good}', 'sell')">All</button>
          <button onclick="sellGood('${good}')">Sell</button>
        </div>
      </div>
    `;

    grid.appendChild(item);
    updateTradePreview(good);
  });
}

function getTradeRecommendations() {
  const planets = Object.keys(planetMarkets);
  const freeCargo = Math.max(0, getShipStats().cargo - cargoUsed());

  const routes = [];

  mineralKeys.forEach(good => {
    planets.forEach(origin => {
      planets.forEach(destination => {
        if (origin === destination) return;

        const buyPrice = getCommodityBuyPrice(good, origin);
        const sellPrice = getCommoditySellPrice(good, destination);
        const profitPerUnit = sellPrice - buyPrice;
        if (profitPerUnit <= 0) return;

        const affordable = Math.floor(credits / buyPrice);
        const routeAllowance = getTradeContractUnitAllowance(good, origin, destination);
        const maxUnits = Math.max(0, Math.min(routeAllowance, affordable, freeCargo || getShipStats().cargo));
        const potentialProfit = profitPerUnit * maxUnits;

        routes.push({
          good,
          origin,
          destination,
          buyPrice,
          sellPrice,
          profitPerUnit,
          maxUnits,
          potentialProfit,
          currentOrigin: origin === currentNode
        });
      });
    });
  });

  return routes.sort((a, b) => {
    if (a.currentOrigin !== b.currentOrigin) return a.currentOrigin ? -1 : 1;
    return b.potentialProfit - a.potentialProfit;
  }).slice(0, 6);
}

function renderOpportunityTrades(goodsBox) {
  const routes = getTradeRecommendations();

  if (!routes.length) {
    goodsBox.innerHTML = `<div class="terminal-empty-state">No profitable opportunities are visible in the current market cycle.</div>`;
    return;
  }

  goodsBox.innerHTML = `
    <div class="hot-trades-grid premium-opportunities-grid compact-opportunities-grid lean-opportunities-grid">
      ${routes.map((route, index) => {
        const info = commodityInfo[route.good];
        const routeHint = route.currentOrigin ? "Tap to buy" : `Go to ${route.origin}`;
        const routeState = route.currentOrigin ? "Here" : "Route";

        return `
          <div
            class="hot-trade-card premium-opportunity-card compact-opportunity-card lean-opportunity-card ${getCommodityRarityClass(route.good)} ${route.currentOrigin ? "current-origin is-actionable" : ""} ${index === 0 ? "top-route" : ""}"
            data-good="${route.good}"
            data-origin="${route.origin}"
            data-destination="${route.destination}"
            data-max-units="${route.maxUnits}"
            data-current-origin="${route.currentOrigin ? "1" : "0"}"
            tabindex="0"
            role="button"
            aria-label="${route.good} trade route from ${route.origin} to ${route.destination}"
          >
            <div class="hot-trade-top compact-hot-trade-top lean-hot-trade-top">
              <div class="commodity-cell compact-commodity-cell">
                <div class="commodity-icon compact-opportunity-icon lean-opportunity-icon">
                  <img src="${info.icon}" alt="${route.good}" class="commodity-icon-img">
                </div>
                <div>
                  <div class="commodity-name">${route.good}</div>
                  <div class="commodity-rarity">${info.rarity || "Common"}</div>
                </div>
              </div>
              <div class="lean-route-badges">
                ${index === 0 ? `<span class="top-route-ribbon inline-route-ribbon">Best</span>` : ""}
                <span class="route-badge">${routeState}</span>
              </div>
            </div>

            <div class="opportunity-route-row compact-opportunity-route-row lean-route-row">
              <span class="trade-location-chip origin">${route.origin}</span>
              <span class="trade-route-arrow">→</span>
              <span class="trade-location-chip destination">${route.destination}</span>
            </div>

            <div class="hot-trade-stats compact-hot-trade-stats lean-hot-trade-stats">
              <div><span>Buy</span><strong>CR ${formatNumber(route.buyPrice)}</strong></div>
              <div><span>Sell</span><strong>CR ${formatNumber(route.sellPrice)}</strong></div>
              <div><span>Profit</span><strong class="profit-good">+CR ${formatNumber(route.profitPerUnit)}</strong></div>
            </div>

            <div class="hot-trade-footer compact-hot-trade-footer lean-hot-trade-footer">
              <span>${routeHint}</span>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  goodsBox.querySelectorAll('.premium-opportunity-card').forEach(card => {
    const currentOrigin = card.dataset.currentOrigin === "1";
    card.addEventListener('click', () => stageTradeOpportunityFromCard(card));
    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        stageTradeOpportunityFromCard(card);
      }
    });
    if (!currentOrigin) {
      card.classList.add('route-preview-only');
    }
  });
}

function getAcceptedTradeRouteFromContract(route) {
  return {
    id: `trade-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    good: route.good,
    origin: route.origin,
    destination: route.destination,
    buyPrice: route.buyPrice,
    sellPrice: route.sellPrice,
    profitPerUnit: route.profitPerUnit,
    maxUnits: route.maxUnits,
    purchasedUnits: 0,
    acceptedAtCycle: getMarketCycle()
  };
}

function getContractMinimumProfit(good, buyPrice) {
  const rarity = (commodityInfo[good]?.rarity || "Common").toLowerCase();
  const rarityBoost = rarity === "exotic" ? 0.22 : rarity === "rare" ? 0.18 : rarity === "industrial" ? 0.14 : 0.10;
  return Math.max(2, Math.round(buyPrice * rarityBoost));
}

function getTradeContractUnitAllowance(good, origin, destination) {
  const shipCargo = getShipStats().cargo || 100;
  const rarity = (commodityInfo[good]?.rarity || "Common").toLowerCase();

  // Station-backed trade contracts should usually reward bigger cargo bays.
  // Rare goods can still be smaller than common bulk freight, but not so small that cargo upgrades feel pointless.
  const rarityCap = rarity === "exotic" ? 0.80 : rarity === "rare" ? 0.92 : rarity === "industrial" ? 1.05 : 1.18;
  const hash = marketHash(`${getMarketCycle()}:${origin}:${destination}:${good}:allowance`);
  const swing = 0.85 + ((hash % 41) / 100); // 85% to 125% of rarity-adjusted ship cargo
  const minimumUsefulContract = Math.ceil(shipCargo * 0.70);

  return Math.max(1, minimumUsefulContract, Math.floor(shipCargo * rarityCap * swing));
}

function buildStationTradeContracts(origin = currentNode) {
  const destinations = Object.keys(planetMarkets).filter(planet => planet !== origin);
  const freeCargo = Math.max(0, getShipStats().cargo - cargoUsed());
  const usableCargo = freeCargo || getShipStats().cargo;
  const routes = [];

  mineralKeys.forEach(good => {
    destinations.forEach(destination => {
      const buyPrice = getCommodityBuyPrice(good, origin);
      const marketSellPrice = getCommoditySellPrice(good, destination);
      const sellPrice = Math.max(marketSellPrice, buyPrice + getContractMinimumProfit(good, buyPrice));
      const profitPerUnit = sellPrice - buyPrice;
      const contractAllowance = getTradeContractUnitAllowance(good, origin, destination);
      const affordable = Math.max(0, Math.floor(credits / buyPrice));
      const maxUnits = Math.max(0, Math.min(contractAllowance, affordable || contractAllowance, usableCargo));
      const potentialProfit = profitPerUnit * Math.max(1, maxUnits);

      routes.push({
        good,
        origin,
        destination,
        buyPrice,
        sellPrice,
        profitPerUnit,
        maxUnits,
        potentialProfit,
        currentOrigin: true,
        stationBacked: marketSellPrice < sellPrice
      });
    });
  });

  return routes.sort((a, b) => {
    if (b.potentialProfit !== a.potentialProfit) return b.potentialProfit - a.potentialProfit;
    if (b.profitPerUnit !== a.profitPerUnit) return b.profitPerUnit - a.profitPerUnit;
    return a.good.localeCompare(b.good);
  });
}

function getCurrentTradeContracts() {
  const maxVisibleTrades = 2;
  const stationRoutes = buildStationTradeContracts(currentNode);
  const picked = [];
  const usedGoods = new Set();

  stationRoutes.forEach(route => {
    if (picked.length >= maxVisibleTrades) return;
    if (usedGoods.has(route.good)) return;
    picked.push(route);
    usedGoods.add(route.good);
  });

  stationRoutes.forEach(route => {
    if (picked.length >= maxVisibleTrades) return;
    if (picked.some(existing => existing.good === route.good && existing.destination === route.destination)) return;
    picked.push(route);
  });

  return picked;
}

function acceptTradeRoute(good, origin, destination) {
  const route = getCurrentTradeContracts().find(candidate =>
    candidate.good === good && candidate.origin === origin && candidate.destination === destination
  );

  if (!route) {
    alert("That trade signal has expired. Check the current contracts again.");
    renderMarketplace();
    return;
  }

  setActiveTradeObjective(getAcceptedTradeRouteFromContract(route));
  selectedStationTradeRoute = null;
  activeTradeTerminalTab = "contracts";
  addActivityLog(`Trade route accepted: ${good} to ${destination}.`);
  tutorialEvent("acceptedTrade");
  saveGame();
  renderMarketplace();
  updateSpaceHUD();
  renderObjectiveHud();
  if (document.getElementById("sectorMap")?.classList.contains("active")) renderSectorMap();
}

function abandonTradeRoute(force = false) {
  const trade = getActiveObjective();
  const carriedGood = activeTradeRoute?.good || activeObjective?.good;
  const held = carriedGood ? (cargo[carriedGood] || 0) : 0;

  if (!force && trade?.type === "trade") {
    const warning = held > 0
      ? `Abandon this ${trade.good} trade?\n\nYou are carrying ${formatNumber(held)} units. The cargo will remain in your hold, but the route objective and protected contract pricing will end.`
      : `Abandon this ${trade.good} trade route?\n\nThe active route objective and protected contract pricing will end.`;

    if (!window.confirm(warning)) return;
  }

  clearActiveObjective("trade");

  if (carriedGood && held > 0) {
    selectedLooseCargoSellGood = carriedGood;
    addActivityLog(`${carriedGood} trade closed. Cargo can still be sold from the Trade Terminal.`);
  } else {
    addActivityLog("Trade route closed.");
  }

  saveGame();
  renderMarketplace();
  updateSpaceHUD();
}

function renderTradeContractsTerminal(market, stock, goodsBox) {
  const contracts = getCurrentTradeContracts();
  const active = activeTradeRoute || (getActiveObjective()?.type === "trade" ? getActiveObjective() : null);

  if (selectedStationTradeRoute && !contracts.some(route => isSameTradeRoute(route, selectedStationTradeRoute))) {
    selectedStationTradeRoute = null;
  }

  const detailRoute = active || selectedStationTradeRoute;

  goodsBox.innerHTML = `
    <div class="trade-contract-terminal">
      <div class="trade-contract-grid">
        ${contracts.length ? contracts.map((route, index) => renderTradeContractCard(route, index)).join("") : `<div class="terminal-empty-state">No station trades are visible at this planet.</div>`}
      </div>
      <div class="accepted-trade-panel">
        ${renderAcceptedTradePanel(detailRoute, market, stock, !active && !!selectedStationTradeRoute)}
      </div>
    </div>
  `;
}


function getTradeRouteJumpCount(route) {
  if (!route) return 0;
  const path = findSectorRoute(route.origin, route.destination);
  return Math.max(0, path.length - 1);
}

function getTradeRouteEfficiency(route) {
  const jumps = Math.max(1, getTradeRouteJumpCount(route));
  return Math.round((Number(route.potentialProfit || 0)) / jumps);
}

function isSameTradeRoute(a, b) {
  return !!a && !!b && a.good === b.good && a.origin === b.origin && a.destination === b.destination;
}

function selectStationTradeRoute(good, origin, destination) {
  const route = getCurrentTradeContracts().find(candidate =>
    candidate.good === good && candidate.origin === origin && candidate.destination === destination
  );

  if (!route) {
    selectedStationTradeRoute = null;
    renderMarketplace();
    return;
  }

  selectedStationTradeRoute = route;
  tutorialEvent("selectedTrade");
  renderMarketplace();
}


function renderTradeContractCard(route, index) {
  const info = commodityInfo[route.good] || {};
  const isActive = activeTradeRoute && activeTradeRoute.good === route.good && activeTradeRoute.origin === route.origin && activeTradeRoute.destination === route.destination;
  const isSelected = isSameTradeRoute(selectedStationTradeRoute, route);
  const marginPerUnit = route.sellPrice - route.buyPrice;
  const jumps = getTradeRouteJumpCount(route);
  const efficiency = getTradeRouteEfficiency(route);

  return `
    <div class="trade-contract-card compact-station-card selectable-station-card ${getCommodityRarityClass(route.good)} ${isActive ? "active-contract" : ""} ${isSelected ? "selected-contract" : ""}">
      <div class="trade-contract-top slim-contract-top">
        <div class="commodity-cell compact-commodity-cell">
          <div class="commodity-icon compact-opportunity-icon lean-opportunity-icon">
            <img src="${info.icon || getCommodityImage(route.good)}" alt="${route.good}" class="commodity-icon-img">
          </div>
          <div>
            <div class="commodity-name">${route.good}</div>
            <div class="commodity-rarity">${route.origin} &gt; ${route.destination}</div>
          </div>
        </div>
        <span class="trade-margin-chip ${marginPerUnit >= 0 ? "profit-good" : "profit-bad"}">${marginPerUnit >= 0 ? "+" : "-"}CR ${formatNumber(Math.abs(marginPerUnit))}</span>
      </div>

      <div class="station-trade-line station-trade-line-expanded">
        <span>Units <strong>${formatNumber(route.maxUnits)}</strong></span>
        <span>Jumps <strong>${formatNumber(jumps)}</strong></span>
        <span>CR/Jump <strong>${formatNumber(efficiency)}</strong></span>
      </div>

      <button class="accept-trade-btn" onclick="${isActive ? "" : `selectStationTradeRoute('${escapeJsString(route.good)}', '${escapeJsString(route.origin)}', '${escapeJsString(route.destination)}')`}">
        ${isActive ? "Route Active" : isSelected ? "Selected" : "Preview"}
      </button>
    </div>
  `;
}

function openLooseCargoSale(good) {
  if (!mineralKeys.includes(good) || (cargo[good] || 0) <= 0) return;
  selectedLooseCargoSellGood = good;
  renderMarketplace();
}

function renderLooseCargoSellPanel() {
  const heldGoods = mineralKeys.filter(good => (cargo[good] || 0) > 0);

  if (!heldGoods.length) {
    selectedLooseCargoSellGood = null;
    return `
      <div class="accepted-trade-empty compact-trade-empty">
        <h3>Station Trade</h3>
        <p>Select one available station trade to preview cost, return and route.</p>
      </div>
    `;
  }

  if (!selectedLooseCargoSellGood || !heldGoods.includes(selectedLooseCargoSellGood)) {
    selectedLooseCargoSellGood = heldGoods[0];
  }

  const good = selectedLooseCargoSellGood;
  const info = commodityInfo[good] || {};
  const held = cargo[good] || 0;
  const sellPrice = getCommoditySellPrice(good, currentNode);
  const basis = cargoCostBasis[good] || 0;
  const estimatedProfit = basis ? Math.round((sellPrice - basis) * held) : 0;

  setTimeout(() => updateTradePreview(good), 0);

  return `
    <div class="loose-cargo-panel accepted-trade-card cargo-ready-panel ${getCommodityRarityClass(good)}">
      <div class="trade-panel-kicker">Cargo Ready to Sell</div>
      <div class="accepted-trade-header compact-accepted-header">
        <div class="commodity-cell compact-commodity-cell">
          <div class="commodity-icon compact-opportunity-icon lean-opportunity-icon">
            <img src="${info.icon || getCommodityImage(good)}" alt="${good}" class="commodity-icon-img">
          </div>
          <div>
            <h3>${good}</h3>
            <p>Held ${formatNumber(held)} · Sell at ${currentNode}</p>
          </div>
        </div>
      </div>

      <div class="loose-cargo-tabs compact-cargo-tabs">
        ${heldGoods.map(item => `
          <button class="loose-cargo-tab ${item === good ? "active" : ""}" onclick="openLooseCargoSale('${escapeJsString(item)}')">
            ${item} <span>${formatNumber(cargo[item] || 0)}</span>
          </button>
        `).join("")}
      </div>

      <div class="accepted-trade-stats compact-stat-row">
        <div><span>Held</span><strong>${formatNumber(held)}</strong></div>
        <div><span>Sell</span><strong>CR ${formatNumber(sellPrice)}</strong></div>
        <div><span>Profit</span><strong class="${estimatedProfit >= 0 ? "profit-good" : "profit-bad"}">${basis ? `${estimatedProfit >= 0 ? "+" : "-"}CR ${formatNumber(Math.abs(estimatedProfit))}` : "N/A"}</strong></div>
      </div>

      <div class="trade-compact-control accepted-trade-control compact-accepted-control">
        ${renderTradeQuantityControls(good, "sell", held, held, "Sell Cargo")}
        <div class="accepted-profit-line compact-return-line ${estimatedProfit >= 0 ? "profit-good" : "profit-bad"}">${basis ? `${estimatedProfit >= 0 ? "+" : "-"}CR ${formatNumber(Math.abs(estimatedProfit))} estimated profit` : "No purchase basis recorded."}</div>
      </div>
    </div>
  `;
}

function renderAcceptedTradePanel(active, market, stock, isPreview = false) {
  if (!active) {
    return renderLooseCargoSellPanel();
  }

  const info = commodityInfo[active.good] || {};
  const held = cargo[active.good] || 0;
  const atOrigin = currentNode === active.origin;
  const atDestination = currentNode === active.destination;
  const routeText = `${active.origin} > ${active.destination}`;
  const marginPerUnit = active.sellPrice - active.buyPrice;
  const jumps = getTradeRouteJumpCount(active);
  const routeProfit = Number(active.maxUnits || 0) * marginPerUnit;
  const crPerJump = getTradeRouteEfficiency({ ...active, potentialProfit: routeProfit });

  let actionMarkup = "";

  if (isPreview) {
    actionMarkup = `
      <div class="trade-preview-accept-panel">
        <div class="trade-preview-note">Preview route before committing. Accepting creates the active objective and unlocks buy controls.</div>
        <button class="trade-primary-action accept-route-action" onclick="acceptTradeRoute('${escapeJsString(active.good)}', '${escapeJsString(active.origin)}', '${escapeJsString(active.destination)}')">Accept Trade</button>
      </div>
    `;
  } else if (atOrigin) {
    const buyPrice = getEffectiveBuyPrice(active.good, currentNode);
    const availableCargo = getShipStats().cargo - cargoUsed();
    const maxAffordable = Math.floor(credits / buyPrice);
    const routeAllowance = Number(active.maxUnits || getShipStats().cargo || 0);
    const alreadyPurchased = Number(active.purchasedUnits || 0);
    const remainingRouteUnits = Math.max(0, routeAllowance - alreadyPurchased);
    const maxBuy = Math.max(0, Math.min(remainingRouteUnits, availableCargo, maxAffordable));
    actionMarkup = `
      <div class="trade-compact-control accepted-trade-control compact-accepted-control">
        ${renderTradeQuantityControls(active.good, "buy", maxBuy, 0, "Buy Cargo")}
        <div id="buyRoi-${safeId(active.good)}" class="accepted-profit-line compact-return-line is-empty"></div>
      </div>
    `;
  } else if (atDestination) {
    const sellPrice = getEffectiveSellPrice(active.good, currentNode);
    const estimatedProfit = (cargoCostBasis[active.good] || active.buyPrice) ? Math.round((sellPrice - (cargoCostBasis[active.good] || active.buyPrice)) * held) : 0;
    actionMarkup = held > 0 ? `
      <div class="trade-compact-control accepted-trade-control compact-accepted-control">
        ${renderTradeQuantityControls(active.good, "sell", held, held, "Sell Cargo")}
        <div class="accepted-profit-line compact-return-line ${estimatedProfit >= 0 ? "profit-good" : "profit-bad"}">${estimatedProfit >= 0 ? "+" : "-"}CR ${formatNumber(Math.abs(estimatedProfit))} estimated profit</div>
      </div>
    ` : `<div class="accepted-route-note compact-route-note">You reached ${active.destination}, but you have no ${active.good} in cargo.</div>`;
  } else {
    actionMarkup = `<div class="accepted-route-note compact-route-note">Accepted route is highlighted on the sector map.</div>`;
  }

  setTimeout(() => updateTradePreview(active.good), 0);

  return `
    <div class="accepted-trade-card selected-trade-panel ${getCommodityRarityClass(active.good)}">
      <div class="trade-panel-kicker">${isPreview ? "Trade Preview" : "Accepted Trade"}</div>
      <div class="accepted-trade-header compact-accepted-header">
        <div class="commodity-cell compact-commodity-cell">
          <div class="commodity-icon compact-opportunity-icon lean-opportunity-icon">
            <img src="${info.icon || getCommodityImage(active.good)}" alt="${active.good}" class="commodity-icon-img">
          </div>
          <div>
            <h3>${active.good}</h3>
            <p>${routeText}</p>
          </div>
        </div>
        <button class="abandon-route-btn safer-abandon-route-btn" onclick="abandonTradeRoute()" aria-label="Abandon trade route">Abandon</button>
      </div>
      <div class="accepted-trade-stats compact-stat-row trade-route-stat-row">
        <div><span>Buy</span><strong>CR ${formatNumber(active.buyPrice)}</strong></div>
        <div><span>Sell</span><strong>CR ${formatNumber(active.sellPrice)}</strong></div>
        <div><span>Margin</span><strong class="${marginPerUnit >= 0 ? "profit-good" : "profit-bad"}">${marginPerUnit >= 0 ? "+" : "-"}CR ${formatNumber(Math.abs(marginPerUnit))}/u</strong></div>
        <div><span>Units</span><strong>${formatNumber(active.maxUnits || 0)}</strong></div>
        <div><span>Jumps</span><strong>${formatNumber(jumps)}</strong></div>
        <div><span>CR/Jump</span><strong class="${crPerJump >= 0 ? "profit-good" : "profit-bad"}">${formatNumber(crPerJump)}</strong></div>
      </div>
      ${actionMarkup}
    </div>
  `;
}

function completeActiveTradeIfReady(good) {
  if (!activeTradeRoute || activeTradeRoute.good !== good) return;
  if (currentNode !== activeTradeRoute.destination) return;
  if ((cargo[good] || 0) > 0) return;

  const realizedProfit = Math.max(0, Number(activeTradeRoute.realizedProfit || 0));
  addActivityLog(`Trade route completed: ${good} delivered to ${activeTradeRoute.destination}.`);
  if (realizedProfit > 0) {
    awardTradingXpFromProfit(realizedProfit);
  }
  clearActiveObjective("trade");
  updateSpaceHUD();
}


function ensureDailyBounties() {
  const today = getTodayKey();
  if (dailyBountyDate !== today || !Array.isArray(dailyBountyContracts) || !dailyBountyContracts.length) {
    dailyBountyDate = today;
    dailyBountyContracts = createDailyBountyContracts();
    selectedBountyContractId = dailyBountyContracts[0]?.id || null;
  }

  dailyBountyContracts = dailyBountyContracts.map(contract => {
    const template = DAILY_BOUNTY_CONTRACTS.find(item => item.id === contract.id) || contract;
    const targetArea = contract.targetArea || template.targetArea || "anyHostile";
    return {
      ...template,
      ...contract,
      targetArea,
      targetLabel: contract.targetLabel || template.targetLabel || getBountyAreaLabel(targetArea),
      targetNode: undefined,
      killsRequired: Number(contract.killsRequired || template.killsRequired || 1),
      reward: Number(contract.reward || template.reward || 0),
      lootChance: Number(contract.lootChance ?? template.lootChance ?? 0),
      progress: Math.max(0, Number(contract.progress || 0)),
      status: ["available", "active", "readyToClaim", "completed"].includes(contract.status) ? contract.status : "available"
    };
  });
}

function getBountyContract(contractId) {
  ensureDailyBounties();
  return dailyBountyContracts.find(contract => contract.id === contractId);
}

function getBountyStatusLabel(contract) {
  if (contract.status === "readyToClaim") return "CLAIM";
  if (activeObjective?.type === "bounty" && activeObjective.contractId === contract.id) {
    return activeObjective.status === "readyToClaim" ? "CLAIM" : "ACTIVE";
  }
  if (contract.status === "completed") return "CLAIMED";
  return "AVAILABLE";
}

function renderBountyBoard() {
  ensureDailyBounties();

  const title = document.getElementById("bountyLocationTitle");
  const availableText = document.getElementById("bountyAvailableText");
  const creditsText = document.getElementById("bountyCreditsText");
  const grid = document.getElementById("bountyContractGrid");

  if (title) title.textContent = `DAILY SECTOR BOUNTIES`;
  if (availableText) {
    const claimReady = dailyBountyContracts.filter(contract => contract.status === "readyToClaim").length;
    const available = dailyBountyContracts.filter(contract => contract.status === "available").length;
    availableText.textContent = claimReady ? `${claimReady} ready` : `${available}/${dailyBountyContracts.length}`;
  }
  if (creditsText) creditsText.textContent = formatNumber(credits);

  if (activeObjective?.type === "bounty" && activeObjective.status === "readyToClaim") {
    selectedBountyContractId = activeObjective.contractId;
  }

  if (!selectedBountyContractId || !getBountyContract(selectedBountyContractId)) {
    selectedBountyContractId = dailyBountyContracts.find(contract => contract.status === "readyToClaim")?.id || dailyBountyContracts.find(contract => contract.status !== "completed")?.id || dailyBountyContracts[0]?.id || null;
  }

  if (grid) {
    grid.innerHTML = dailyBountyContracts.map(contract => {
      const isSelected = selectedBountyContractId === contract.id;
      const status = getBountyStatusLabel(contract);
      const complete = contract.status === "completed";
      const ready = contract.status === "readyToClaim";
      return `
        <button class="bounty-contract-card ${isSelected ? "selected" : ""} ${complete ? "completed" : ""} ${ready ? "ready-to-claim" : ""}" onclick="selectBountyContract('${escapeJsString(contract.id)}')">
          <span class="bounty-card-icon">◎</span>
          <span class="bounty-card-copy">
            <strong>${contract.title}</strong>
            <em>${contract.targetLabel}</em>
          </span>
          <span class="bounty-card-objective">${contract.killsRequired} bot${contract.killsRequired === 1 ? "" : "s"}</span>
          <span class="bounty-card-reward">CR ${formatNumber(contract.reward)}</span>
          <span class="bounty-card-status">${status}</span>
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
    panel.innerHTML = `<div class="bounty-empty">No bounty selected.</div>`;
    return;
  }

  const active = activeObjective?.type === "bounty" && activeObjective.contractId === contract.id;
  const readyToClaim = contract.status === "readyToClaim" || (active && activeObjective.status === "readyToClaim");
  const complete = contract.status === "completed";
  const progress = readyToClaim ? contract.killsRequired : active ? activeObjective.kills : contract.progress;
  const progressPct = Math.max(0, Math.min(100, Math.round((progress / Math.max(1, contract.killsRequired)) * 100)));
  const buttonDisabled = active || complete || readyToClaim || Boolean(getActiveObjective());
  const buttonText = complete ? "Claimed" : readyToClaim ? "Ready" : active ? "Active" : getActiveObjective() ? "Objective Active" : "Accept Bounty";
  const stateText = readyToClaim ? "Reward ready" : complete ? "Claimed" : active ? "Active objective" : "Available";

  panel.innerHTML = `
    <div class="bounty-detail-hero ${readyToClaim ? "reward-ready" : ""}">
      <div class="bounty-detail-icon">◎</div>
      <div>
        <span class="bounty-detail-kicker">${stateText}</span>
        <strong>${contract.title}</strong>
        <span>${readyToClaim ? "Contract complete. Claim your reward while docked." : contract.description}</span>
      </div>
    </div>

    <div class="bounty-detail-progress-block">
      <div class="bounty-progress-heading"><span>Progress</span><strong>${formatNumber(progress)} / ${formatNumber(contract.killsRequired)}</strong></div>
      <div class="bounty-progress-bar"><span style="width:${progressPct}%"></span></div>
    </div>

    <div class="bounty-detail-grid">
      <div class="bounty-detail-stat"><span>Area</span><strong>${contract.targetLabel}</strong></div>
      <div class="bounty-detail-stat"><span>Objective</span><strong>${contract.killsRequired} bot${contract.killsRequired === 1 ? "" : "s"}</strong></div>
      <div class="bounty-detail-stat"><span>Reward</span><strong>CR ${formatNumber(contract.reward)}</strong></div>
      <div class="bounty-detail-stat"><span>Loot</span><strong>Rare chance</strong></div>
    </div>

    <div class="bounty-detail-actions">
      ${readyToClaim ? `<button class="bounty-claim-btn" onclick="claimBountyReward('${escapeJsString(contract.id)}')">Claim Reward</button>` : `<button class="bounty-accept-btn" ${buttonDisabled ? "disabled" : ""} onclick="acceptBountyContract('${escapeJsString(contract.id)}')">${buttonText}</button>`}
      ${active && !readyToClaim ? `<button class="bounty-cancel-btn" onclick="cancelActiveBountyContract('${escapeJsString(contract.id)}')">Cancel Bounty</button>` : ""}
    </div>
    ${active && !readyToClaim ? `<p class="bounty-detail-note compact">Docked only · cancelling clears progress.</p>` : ""}
    ${getActiveObjective() && !active && !readyToClaim ? `<p class="bounty-detail-note">Finish your current active objective before accepting another.</p>` : ""}
  `;
}

function createBountyObjective(contract) {
  return {
    id: `bounty-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    type: "bounty",
    contractId: contract.id,
    title: contract.title,
    targetArea: contract.targetArea || "anyHostile",
    targetLabel: contract.targetLabel || getBountyAreaLabel(contract.targetArea),
    killsRequired: contract.killsRequired,
    kills: contract.progress || 0,
    reward: contract.reward,
    lootChance: contract.lootChance,
    createdAt: Date.now(),
    status: "active"
  };
}

function acceptBountyContract(contractId) {
  const existingObjective = getActiveObjective();
  if (existingObjective) {
    alert("Complete your current active objective first.");
    return;
  }

  const contract = getBountyContract(contractId);
  if (!contract || contract.status === "completed") return;

  contract.status = "active";
  contract.progress = 0;
  activeObjective = createBountyObjective(contract);
  selectedBountyContractId = contract.id;

  addActivityLog(`Bounty accepted: ${contract.title}. Area: ${contract.targetLabel}.`);
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
  selectedBountyContractId = contract.id;
  addActivityLog(`Bounty cancelled: ${contract.title}.`);
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

  addActivityLog(`Bounty complete: ${activeObjective.title}. Return to any planet to claim CR ${formatNumber(activeObjective.reward)}.`);
  showBountyCompleteBurst(activeObjective);
  updateHudDock();
  updateBountyHubBadge();
  renderBountyBoard();
  saveGame();
}

function claimBountyReward(contractId) {
  const contract = getBountyContract(contractId);
  if (!contract || contract.status !== "readyToClaim") return;

  const reward = Number(contract.reward || 0);
  credits += reward;

  let bonusDrops = [];
  if (Math.random() < Number(contract.lootChance || 0)) {
    bonusDrops = generateBotLootItems();
    if (bonusDrops.length) {
      inventoryItems.push(...bonusDrops);
      showItemFoundBurst(bonusDrops);
    }
  }

  const bonusText = bonusDrops.length ? summarizeInventoryItems(bonusDrops) : "No bonus loot recovered.";
  contract.status = "completed";
  contract.progress = contract.killsRequired;

  if (activeObjective?.type === "bounty" && activeObjective.contractId === contract.id) {
    activeObjective = null;
  }

  selectedBountyContractId = dailyBountyContracts.find(item => item.status === "readyToClaim")?.id || dailyBountyContracts.find(item => item.status === "available")?.id || contract.id;
  awardBountyXpOnClaim(contract);
  addActivityLog(`Bounty reward claimed: ${contract.title}. +CR ${formatNumber(reward)}. ${bonusText}`);
  tutorialEvent("claimedBountyReward");
  showBountyRewardOverlay(contract.title, reward, bonusDrops);
  if (tutorialState?.active && getCurrentTutorialStep()?.id === "continue-after-bounty-reward") {
    setTimeout(renderStarterTutorial, 80);
  }
  updateHudDock();
  updateBountyHubBadge();
  renderBountyBoard();
  saveGame();
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
        const definition = itemDefinitions[item.key] || {};
        return `<div class="reward-loot-card quality-${item.quality}"><img src="${definition.icon || "assets/items/lupen-core.png"}" alt="${definition.name || item.key}"><span>${titleCaseQuality(item.quality)} ${definition.name || item.key}</span></div>`;
      }).join("")
    : `<div class="reward-no-loot">No bonus loot recovered.</div>`;

  overlay.innerHTML = `
    <div class="reward-modal">
      <div class="reward-kicker">Bounty Reward Claimed</div>
      <h2>${title}</h2>
      <div class="reward-credit-pulse">+ CR ${formatNumber(reward)}</div>
      <div class="reward-loot-list">${lootMarkup}</div>
      <button onclick="closeBountyRewardOverlay()">Continue</button>
    </div>
  `;

  requestAnimationFrame(() => overlay.classList.add("active"));
}

function closeBountyRewardOverlay() {
  const overlay = document.getElementById("bountyRewardOverlay");
  if (overlay) {
    overlay.classList.remove("active");
    overlay.classList.remove("tutorial-intro-active");
  }
  tutorialEvent("closedBountyReward");
}

function trackBountyBotKill(bot) {
  if (activeObjective?.type !== "bounty") return;
  if (activeObjective.status === "readyToClaim") return;
  if (!bot || !isNodeInBountyArea(bot.node, activeObjective.targetArea)) return;

  activeObjective.kills = Math.min(activeObjective.killsRequired, (activeObjective.kills || 0) + 1);

  const contract = getBountyContract(activeObjective.contractId);
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

function normalizeTradeRoute(route) {
  if (!route || !route.good || !sectorNodes[route.origin] || !sectorNodes[route.destination]) return null;

  const buyPrice = Math.max(1, Number(route.buyPrice || getCommodityBuyPrice(route.good, route.origin) || 1));
  const sellPrice = Math.max(buyPrice, Number(route.sellPrice || buyPrice));
  const maxUnits = Number(route.maxUnits || getShipStats().cargo || 0);

  return {
    ...route,
    id: route.id || `trade-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`,
    good: route.good,
    origin: route.origin,
    destination: route.destination,
    buyPrice,
    sellPrice,
    profitPerUnit: Number(route.profitPerUnit ?? (sellPrice - buyPrice)),
    maxUnits,
    purchasedUnits: Number(route.purchasedUnits || 0),
    realizedProfit: Number(route.realizedProfit || 0),
    createdAt: Number(route.createdAt || route.acceptedAt || Date.now()),
    status: route.status || "active"
  };
}

function createTradeObjective(route) {
  const normalized = normalizeTradeRoute(route);
  if (!normalized) return null;

  return {
    ...normalized,
    type: "trade",
    title: `${normalized.good} Trade`
  };
}

function syncActiveTradeObjective() {
  if (activeTradeRoute) {
    activeTradeRoute = normalizeTradeRoute(activeTradeRoute);
  }

  if (activeObjective?.type === "trade") {
    activeObjective = createTradeObjective(activeObjective);
  }

  if (activeTradeRoute && !activeObjective) {
    activeObjective = createTradeObjective(activeTradeRoute);
  }

  if (!activeTradeRoute && activeObjective?.type === "trade") {
    activeTradeRoute = normalizeTradeRoute(activeObjective);
  }

  if (activeTradeRoute && activeObjective?.type === "trade") {
    const merged = normalizeTradeRoute({
      ...activeTradeRoute,
      purchasedUnits: Math.max(Number(activeTradeRoute.purchasedUnits || 0), Number(activeObjective.purchasedUnits || 0)),
      realizedProfit: Math.max(Number(activeTradeRoute.realizedProfit || 0), Number(activeObjective.realizedProfit || 0)),
      status: activeObjective.status || activeTradeRoute.status || "active"
    });
    activeTradeRoute = merged;
    activeObjective = createTradeObjective(merged);
  }

  return activeObjective?.type === "trade" ? activeObjective : null;
}

function getActiveObjective() {
  if (activeTradeRoute || activeObjective?.type === "trade") {
    return syncActiveTradeObjective();
  }
  if (activeObjective?.type === "bounty") return activeObjective;
  return null;
}

function setActiveTradeObjective(route) {
  activeTradeRoute = normalizeTradeRoute(route);
  activeObjective = activeTradeRoute ? createTradeObjective(activeTradeRoute) : null;
}

function updateActiveTradeProgress(fields = {}) {
  if (!activeTradeRoute && activeObjective?.type === "trade") {
    activeTradeRoute = normalizeTradeRoute(activeObjective);
  }

  if (activeTradeRoute) {
    activeTradeRoute = normalizeTradeRoute({
      ...activeTradeRoute,
      ...fields
    });
  }

  if (activeObjective?.type === "trade" || activeTradeRoute) {
    activeObjective = createTradeObjective({
      ...(activeTradeRoute || activeObjective),
      ...fields
    });
  }
}

function clearActiveObjective(type = null) {
  if (!type || type === "trade") {
    activeTradeRoute = null;
  }

  if (!type || activeObjective?.type === type) {
    activeObjective = null;
  }
}

function getTradeObjectiveTargetNode(objective = getActiveObjective()) {
  if (!objective || objective.type !== "trade") return null;
  const held = cargo[objective.good] || 0;

  if (currentNode === objective.destination) return objective.destination;
  if (held > 0 || Number(objective.purchasedUnits || 0) > 0) return objective.destination;
  return objective.origin;
}

function getObjectiveRoutePath(objective = getActiveObjective()) {
  if (!objective) return [];
  if (objective.type === "trade") {
    const target = getTradeObjectiveTargetNode(objective);
    return target ? findSectorRoute(currentNode, target) : [];
  }
  if (objective.type === "bounty") {
    if (objective.status === "readyToClaim") {
      const claimPlanet = getNearestPlanetNode(currentNode);
      return findSectorRoute(currentNode, claimPlanet);
    }
    const targetNode = getNearestActiveBountyBotNode(currentNode) || getNearestBountyAreaNode(currentNode, objective.targetArea);
    return targetNode ? findSectorRoute(currentNode, targetNode) : [];
  }
  return [];
}

function getTradeObjectiveStage(objective = getActiveObjective()) {
  if (!objective || objective.type !== "trade") return "none";
  const held = cargo[objective.good] || 0;
  if (currentNode === objective.destination) return held > 0 ? "sell" : "arrived";
  if (currentNode === objective.origin) return held > 0 ? "launch" : "buy";
  return "travel";
}

function getTradeObjectiveActionText(objective = getActiveObjective()) {
  const stage = getTradeObjectiveStage(objective);
  if (stage === "buy") return "Buy stock";
  if (stage === "launch") return "Launch";
  if (stage === "sell") return "Sell cargo";
  if (stage === "arrived") return "Complete";
  if (stage === "travel") return `Go to ${objective.destination}`;
  return "No objective";
}

function getBountyObjectiveActionText(objective = getActiveObjective()) {
  if (!objective || objective.type !== "bounty") return "No objective";
  if (objective.status === "readyToClaim" || objective.kills >= objective.killsRequired) {
    return sectorNodes[currentNode]?.type === "planet" ? "Claim reward at Bounty Board" : "Return to any planet to claim";
  }
  if (!isNodeInBountyArea(currentNode, objective.targetArea)) return `Go to ${objective.targetLabel}`;
  return "Destroy bots in area";
}

function renderObjectiveHud() {
  const panel = document.getElementById("activeObjectiveSummary");
  if (!panel) return;

  const objective = getActiveObjective();
  if (!objective) {
    panel.innerHTML = `<div class="objective-empty">No active objective.</div>`;
    return;
  }

  if (objective.type === "trade") {
    const held = cargo[objective.good] || 0;
    const margin = objective.sellPrice - objective.buyPrice;
    const info = commodityInfo[objective.good] || {};
    const targetNode = getTradeObjectiveTargetNode(objective);
    const path = getObjectiveRoutePath(objective);
    const nextHop = path.length > 1 ? path[1] : targetNode;
    const stage = getTradeObjectiveStage(objective);
    const potentialProfit = held > 0 ? held * margin : Number(objective.maxUnits || 0) * margin;
    const routeProgress = stage === "buy" ? "Buy cargo" : stage === "launch" ? "Launch and travel" : stage === "travel" ? `Next: ${nextHop || objective.destination}` : stage === "sell" ? "Sell cargo" : "Complete";
    const capacityText = `${formatNumber(held)} / ${formatNumber(objective.maxUnits || 0)}`;

    panel.innerHTML = `
      <div class="objective-list compact-objective-list">
        <div class="objective-hud-card objective-trade-card compact-objective-card ${getCommodityRarityClass(objective.good)}">
          <div class="objective-main-row compact-objective-main">
            <div class="commodity-icon objective-icon objective-icon-large">
              <img src="${info.icon || getCommodityImage(objective.good)}" alt="${objective.good}" class="commodity-icon-img">
            </div>

            <div class="objective-copy objective-copy-large">
              <div class="objective-title-line">
                <span class="objective-type-pill">Trade</span>
                <strong>${objective.good}</strong>
              </div>
              <span>${objective.origin} → ${objective.destination}</span>
              <em>${routeProgress}</em>
            </div>

            <div class="objective-compact-actions">
              <button class="objective-map-btn" onclick="openSectorMap()">Map</button>
              <button class="objective-abandon-btn" onclick="abandonTradeRoute()">Abandon</button>
            </div>
          </div>

          <div class="objective-compact-stats">
            <div><span>Buy</span><strong>CR ${formatNumber(objective.buyPrice)}</strong></div>
            <div><span>Sell</span><strong>CR ${formatNumber(objective.sellPrice)}</strong></div>
            <div><span>Margin</span><strong class="${margin >= 0 ? "profit-good" : "profit-bad"}">${margin >= 0 ? "+" : "-"}CR ${formatNumber(Math.abs(margin))}/u</strong></div>
            <div><span>Held</span><strong>${capacityText}</strong></div>
            <div><span>Profit</span><strong class="${potentialProfit >= 0 ? "profit-good" : "profit-bad"}">${potentialProfit >= 0 ? "+" : "-"}CR ${formatNumber(Math.abs(potentialProfit))}</strong></div>
          </div>
        </div>
      </div>
    `;
    return;
  }

  if (objective.type === "bounty") {
    panel.innerHTML = `
      <div class="objective-hud-card bounty-objective-card">
        <div class="objective-hud-top">
          <span class="objective-type-pill bounty-pill">Bounty</span>
        </div>
        <div class="objective-main-row">
          <div class="objective-bounty-icon">◎</div>
          <div class="objective-copy">
            <strong>${objective.title}</strong>
            <span>${objective.targetLabel}</span>
          </div>
        </div>
        <div class="objective-mini-stats">
          <span>${getBountyObjectiveActionText(objective)}</span>
          <span>${formatNumber(objective.kills)} / ${formatNumber(objective.killsRequired)} bots</span>
          <span>CR ${formatNumber(objective.reward)}</span>
        </div>
      </div>
    `;
  }
}

function findSectorRoute(start, destination) {
  if (!sectorNodes[start] || !sectorNodes[destination]) return [];
  if (start === destination) return [start];

  const queue = [[start]];
  const visited = new Set([start]);

  while (queue.length) {
    const path = queue.shift();
    const nodeName = path[path.length - 1];
    const links = sectorNodes[nodeName]?.connects || [];

    for (const link of links) {
      if (visited.has(link)) continue;
      const nextPath = path.concat(link);
      if (link === destination) return nextPath;
      visited.add(link);
      queue.push(nextPath);
    }
  }

  return [];
}

function isNodeOnActiveTradeRoute(name) {
  const objective = getActiveObjective();
  if (objective?.type === "bounty" && isNodeInBountyArea(name, objective.targetArea)) return true;
  if (objective?.type === "trade" && getTradeObjectiveTargetNode(objective) === name) return true;
  return getObjectiveRoutePath(objective).includes(name);
}

function isLineOnActiveTradeRoute(a, b) {
  const path = getObjectiveRoutePath();
  for (let i = 0; i < path.length - 1; i += 1) {
    if ((path[i] === a && path[i + 1] === b) || (path[i] === b && path[i + 1] === a)) return true;
  }
  return false;
}

function getActiveTradeHudMarkup() {
  // Legacy shim retained for older UI references. Active objectives are now rendered by renderObjectiveHud().
  const objective = getActiveObjective();
  if (!objective || objective.type !== "trade") return "";
  return `
    <div class="active-trade-hud-card ${getCommodityRarityClass(objective.good)}">
      <span class="active-trade-kicker">Active Trade</span>
      <strong>${objective.good}</strong>
      <em>${getTradeObjectiveActionText(objective)}</em>
    </div>
  `;
}

function getMarketFlavorText(location) {
  if (location === "Virella") {
    return "A calm frontier exchange with strong common metal supply and lower industrial demand.";
  }

  if (location === "Nyxara") {
    return "A colder high-risk market where rare materials move quickly and margins can spike.";
  }

  return "A busy central trade terminal with balanced stock and strong demand from shipyards.";
}

function renderMarketCargoSummary() {
  const box = document.getElementById("marketCargoSummary");
  if (!box) return;

  const lines = mineralKeys
    .filter(good => cargo[good] > 0)
    .map(good => `<span>${good}: <strong>${formatNumber(cargo[good])}</strong></span>`);

  box.innerHTML = lines.length ? lines.join("") : "Empty";
}

function safeId(value) {
  return value.replace(/[^a-z0-9]/gi, "");
}

function clampNumber(value, min, max) {
  const parsed = parseInt(value, 10);
  if (Number.isNaN(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}


function renderTradeQuantityControls(good, mode, maxValue, defaultValue = 0, actionLabel = "Buy Cargo") {
  const id = safeId(good);
  const max = Math.max(0, Number(maxValue || 0));
  const value = clampNumber(defaultValue || 0, 0, max);
  const actionFn = mode === "sell" ? "sellGood" : "buyGood";
  const escapedGood = escapeJsString(good);

  return `
    <div class="trade-quantity-panel">
      <div class="trade-qty-row">
        <label>${mode === "sell" ? "Sell Amount" : "Buy Amount"}</label>
        <span id="${mode}Summary-${id}" class="trade-summary-pill">${formatNumber(value)} units · CR 0</span>
      </div>
      <div class="trade-stepper-row">
        <button class="trade-step-btn" onclick="adjustTradeQuantity('${escapedGood}', '${mode}', -1)" ${max <= 0 ? "disabled" : ""}>−</button>
        <input
          id="${mode}Qty-${id}"
          class="qty-input trade-qty-input"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          min="0"
          max="${max}"
          value="${value}"
          oninput="syncTradeInput('${escapedGood}', '${mode}')"
        />
        <button class="trade-step-btn" onclick="adjustTradeQuantity('${escapedGood}', '${mode}', 1)" ${max <= 0 ? "disabled" : ""}>+</button>
        <button class="trade-quick-btn trade-amount-btn" onclick="setTradeQuantityPercent('${escapedGood}', '${mode}', 0.25)" ${max <= 0 ? "disabled" : ""}>25%</button>
        <button class="trade-quick-btn trade-amount-btn" onclick="setTradeQuantityPercent('${escapedGood}', '${mode}', 0.5)" ${max <= 0 ? "disabled" : ""}>50%</button>
        <button class="trade-quick-btn trade-amount-btn trade-max-btn" onclick="setTradeMax('${escapedGood}', '${mode}')" ${max <= 0 ? "disabled" : ""}>Max</button>
        <button id="${mode}Action-${id}" class="trade-primary-action" onclick="${actionFn}('${escapedGood}')" ${value <= 0 || max <= 0 ? "disabled" : ""}>${actionLabel}</button>
      </div>
    </div>
  `;
}

function adjustTradeQuantity(good, mode, delta) {
  const id = safeId(good);
  const qty = document.getElementById(`${mode}Qty-${id}`);
  if (!qty) return;

  const max = parseInt(qty.max || "0", 10);
  qty.value = clampNumber((parseInt(qty.value || "0", 10) || 0) + delta, 0, max);
  if (mode === "buy" && Number(qty.value || 0) > 0) tutorialEvent("selectedBuyAmount");
  updateTradePreview(good);
}

function setTradeQuantityPercent(good, mode, percent) {
  const id = safeId(good);
  const qty = document.getElementById(`${mode}Qty-${id}`);
  if (!qty) return;

  const max = parseInt(qty.max || "0", 10);
  qty.value = clampNumber(Math.floor(max * percent), 0, max);
  if (mode === "buy" && Number(qty.value || 0) > 0) tutorialEvent("selectedBuyAmount");
  updateTradePreview(good);
}

function getTradeQuantity(good, mode = "buy") {
  const id = safeId(good);
  const input = document.getElementById(`${mode}Qty-${id}`);
  const max = parseInt(input?.max || "0", 10);
  return clampNumber(input?.value || 0, 0, max);
}

function syncTradeInput(good, mode) {
  const id = safeId(good);
  const qty = document.getElementById(`${mode}Qty-${id}`);
  const range = document.getElementById(`${mode}Range-${id}`);
  if (!qty && !range) return;

  const max = parseInt((qty?.max || range?.max || "0"), 10);
  const sourceValue = qty ? qty.value : range.value;
  const value = clampNumber(sourceValue, 0, max);
  if (qty) qty.value = value;
  if (range) range.value = value;

  if (mode === "buy" && Number(value || 0) > 0) tutorialEvent("selectedBuyAmount");
  updateTradePreview(good);
}

function setTradeMax(good, mode) {
  const id = safeId(good);
  const qty = document.getElementById(`${mode}Qty-${id}`);
  const range = document.getElementById(`${mode}Range-${id}`);
  if (!qty && !range) return;

  const max = parseInt((qty?.max || range?.max || "0"), 10);
  if (qty) qty.value = max;
  if (range) range.value = max;

  if (mode === "buy" && max > 0) tutorialEvent("selectedBuyAmount");
  updateTradePreview(good);
}

function updateTradePreview(good) {
  const id = safeId(good);
  const buyPrice = getEffectiveBuyPrice(good, currentNode);
  const sellPrice = getEffectiveSellPrice(good, currentNode);

  const buyRange = document.getElementById(`buyRange-${id}`);
  const buyQty = document.getElementById(`buyQty-${id}`);
  const buySummary = document.getElementById(`buySummary-${id}`);
  const buyRoi = document.getElementById(`buyRoi-${id}`);

  const sellRange = document.getElementById(`sellRange-${id}`);
  const sellQty = document.getElementById(`sellQty-${id}`);
  const sellSummary = document.getElementById(`sellSummary-${id}`);

  if ((buyRange || buyQty) && buySummary) {
    const maxBuy = parseInt((buyQty?.max || buyRange?.max || "0"), 10);
    const rawBuyValue = buyQty ? buyQty.value : buyRange.value;
    const buyAmount = clampNumber(rawBuyValue, 0, maxBuy);
    const investment = buyAmount * buyPrice;
    const activeTrade = getActiveTradePricing(good);
    const projectedSellPrice = activeTrade ? activeTrade.sellPrice : sellPrice;
    const projectedReturn = buyAmount * projectedSellPrice;
    const projectedProfit = projectedReturn - investment;
    const roiPercent = investment > 0 ? Math.round((projectedProfit / investment) * 100) : 0;

    if (buyRange) buyRange.value = buyAmount;
    if (buyQty) buyQty.value = buyAmount;
    const buyAction = document.getElementById(`buyAction-${id}`);
    if (buyAction) buyAction.disabled = buyAmount <= 0;
    buySummary.innerHTML = `${formatNumber(buyAmount)} units · <span class="mini-credit">CR</span>${formatNumber(investment)}`;

    if (buyRoi) {
      if (buyAmount > 0) {
        buyRoi.classList.remove("is-empty");
        buyRoi.innerHTML = `<span>Cost <strong><span class="mini-credit">CR</span>${formatNumber(investment)}</strong></span><span>Return <strong><span class="mini-credit">CR</span>${formatNumber(projectedReturn)}</strong></span><span>Profit <strong class="${projectedProfit >= 0 ? "profit-good" : "profit-bad"}">${projectedProfit >= 0 ? "+" : "-"}CR ${formatNumber(Math.abs(projectedProfit))}</strong></span><span>ROI <strong>${roiPercent}%</strong></span>`;
      } else {
        buyRoi.classList.add("is-empty");
        buyRoi.innerHTML = "";
      }
    }
  }

  if ((sellRange || sellQty) && sellSummary) {
    const maxSell = parseInt((sellQty?.max || sellRange?.max || "0"), 10);
    const rawSellValue = sellQty ? sellQty.value : sellRange.value;
    const sellAmount = clampNumber(rawSellValue, 0, maxSell);
    if (sellRange) sellRange.value = sellAmount;
    if (sellQty) sellQty.value = sellAmount;
    const sellAction = document.getElementById(`sellAction-${id}`);
    if (sellAction) sellAction.disabled = sellAmount <= 0;
    sellSummary.innerHTML = `${formatNumber(sellAmount)} units · <span class="mini-credit">CR</span>${formatNumber(sellAmount * sellPrice)}`;
  }
}

function getCurrentMarketStock() {
  if (!marketStock[currentNode]) {
    marketStock[currentNode] = {};
  }

  mineralKeys.forEach(good => {
    if (marketStock[currentNode][good] === undefined) {
      marketStock[currentNode][good] = 0;
    }
  });

  return marketStock[currentNode];
}

function buyGood(good) {
  const price = getEffectiveBuyPrice(good, currentNode);
  const quantity = getTradeQuantity(good, "buy");

  const availableCargo = getShipStats().cargo - cargoUsed();
  const affordableQuantity = Math.floor(credits / price);
  let routeRemaining = getShipStats().cargo || availableCargo;

  const activeTradeBeforeBuy = getActiveTradePricing(good);
  if (activeTradeBeforeBuy && activeTradeBeforeBuy.origin === currentNode) {
    const routeAllowance = Number(activeTradeBeforeBuy.maxUnits || getShipStats().cargo || 0);
    const alreadyPurchased = Number(activeTradeBeforeBuy.purchasedUnits || 0);
    routeRemaining = Math.max(0, routeAllowance - alreadyPurchased);
  }

  const maxBuy = Math.min(quantity, availableCargo, affordableQuantity, routeRemaining);

  if (maxBuy <= 0) {
    alert("Select a quantity first, or check credits, cargo space and the trade allowance.");
    return;
  }

  const previousHeld = cargo[good] || 0;
  const previousBasis = cargoCostBasis[good] || price;

  credits -= price * maxBuy;
  cargo[good] += maxBuy;

  const activeTrade = getActiveTradePricing(good);
  if (activeTrade && activeTrade.origin === currentNode) {
    updateActiveTradeProgress({
      purchasedUnits: Number(activeTrade.purchasedUnits || 0) + maxBuy,
      maxUnits: Number(activeTrade.maxUnits || getShipStats().cargo || 0)
    });
  }

  cargoCostBasis[good] = Math.round(((previousHeld * previousBasis) + (maxBuy * price)) / Math.max(1, previousHeld + maxBuy));

  tutorialEvent("boughtTradeCargo");
  saveGame();
  renderMarketplace();
  updateCargoSummary();
  updateSpaceHUD();
  if (document.getElementById("sectorMap")?.classList.contains("active")) renderSectorMap();
}

function sellGood(good) {
  const price = getEffectiveSellPrice(good, currentNode);
  const quantity = getTradeQuantity(good, "sell");
  const maxSell = Math.min(quantity, cargo[good]);

  if (maxSell <= 0) {
    alert(`Select a quantity first, or check your ${good} stock.`);
    return;
  }

  const activeTrade = getActiveTradePricing(good);
  const unitCost = cargoCostBasis[good] || activeTrade?.buyPrice || price;
  const tradeProfit = maxSell * (price - unitCost);
  const saleProfit = activeTrade && currentNode === activeTrade.destination
    ? Math.max(0, tradeProfit)
    : Math.max(0, tradeProfit);
  const saleRevenue = price * maxSell;

  cargo[good] -= maxSell;
  credits += saleRevenue;
  playerProgress.totals.cargoSold = Math.max(0, Number(playerProgress.totals.cargoSold || 0)) + maxSell;

  showTradeResultBurst({ good, quantity: maxSell, profit: tradeProfit, revenue: saleRevenue });
  showTradeMiniFloat({ profit: tradeProfit });

  if (saleProfit > 0 && activeTrade) {
    updateActiveTradeProgress({
      realizedProfit: Math.max(0, Number(activeTrade.realizedProfit || 0)) + saleProfit
    });
  }

  if ((cargo[good] || 0) <= 0) {
    delete cargoCostBasis[good];
    if (selectedLooseCargoSellGood === good) selectedLooseCargoSellGood = null;
  }

  completeActiveTradeIfReady(good);
  tutorialEvent("soldTradeCargo");
  saveGame();
  renderMarketplace();
  updateCargoSummary();
  updateSpaceHUD();
  if (document.getElementById("sectorMap")?.classList.contains("active")) renderSectorMap();
}


function getItemCategoryKey(itemKey) {
  const definition = itemDefinitions[itemKey];
  if (!definition) return "all";
  if (definition.category === "Weapon") return "guns";
  if (definition.category === "Attachment") return "attachments";
  if (definition.category === "Core") return "cores";
  return "all";
}

function getVaultEntryDescription(entry) {
  if (!entry) return "";
  if (entry.categoryKey === "guns") {
    return GUNS[entry.key]?.description || itemDefinitions[entry.key]?.name || "";
  }
  if (entry.categoryKey === "attachments") {
    const attachmentDescriptions = {
      cargoPod: "Extends cargo capacity for longer salvage and trade runs.",
      hullBooster: "Reinforces your vessel with additional hull integrity.",
      jumpDrive: "Improves jump systems for quicker route recovery.",
      shieldBooster: "Strengthens shield capacity for better survivability.",
      evasionMatrix: "Improves manoeuvring systems so incoming hits deal reduced damage."
    };
    return attachmentDescriptions[entry.key] || itemDefinitions[entry.key]?.name || "";
  }
  return "Rare enhancement core used for future upgrades, quality progression and high-value trading.";
}

function getEquippedVaultCounts() {
  const equipped = new Map();
  Object.values(shipLoadouts || {}).forEach(loadout => {
    if (!loadout) return;
    (loadout.attachments || []).forEach(entry => {
      const key = getEquipmentKey(entry);
      const quality = getEquipmentQuality(entry);
      const mapKey = `${key}__${quality}`;
      equipped.set(mapKey, (equipped.get(mapKey) || 0) + 1);
    });
    (loadout.guns || []).forEach(entry => {
      const key = getEquipmentKey(entry);
      const quality = getEquipmentQuality(entry);
      const mapKey = `${key}__${quality}`;
      equipped.set(mapKey, (equipped.get(mapKey) || 0) + 1);
    });
  });
  return equipped;
}

function buildVaultEntries() {
  ensureInventoryObjects();
  const grouped = new Map();
  const equippedCounts = new Map();

  function ensureEntry(key, quality = "standard") {
    const definition = itemDefinitions[key];
    if (!definition) return null;
    const groupKey = `${key}__${quality}`;
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        groupKey,
        key,
        quality,
        name: definition.name,
        category: definition.category,
        categoryKey: getItemCategoryKey(key),
        icon: definition.icon || "assets/items/lupen-core.png",
        count: 0,
        storedCount: 0,
        equippedCount: 0
      });
    }
    return grouped.get(groupKey);
  }

  Object.entries(ownedAttachments || {}).forEach(([key, count]) => {
    if (!count) return;
    const entry = ensureEntry(key, "standard");
    if (!entry) return;
    entry.count += count;
    entry.storedCount += count;
  });

  Object.entries(ownedGuns || {}).forEach(([key, count]) => {
    if (!count) return;
    const entry = ensureEntry(key, "standard");
    if (!entry) return;
    entry.count += count;
    entry.storedCount += count;
  });

  (inventoryItems || []).forEach(item => {
    if (!item || !itemDefinitions[item.key]) return;
    const entry = ensureEntry(item.key, item.quality || "standard");
    if (!entry) return;
    entry.count += 1;
    entry.storedCount += 1;
  });

  equippedCounts.forEach((count, groupKey) => {
    const [key, quality = "standard"] = groupKey.split("__");
    const entry = ensureEntry(key, quality);
    if (!entry) return;
    entry.count += count;
    entry.equippedCount += count;
  });

  return Array.from(grouped.values()).sort((a, b) => {
    const qualityDelta = ITEM_QUALITY_ORDER.indexOf(b.quality) - ITEM_QUALITY_ORDER.indexOf(a.quality);
    if (qualityDelta !== 0) return qualityDelta;
    if (a.categoryKey !== b.categoryKey) return a.categoryKey.localeCompare(b.categoryKey);
    return a.name.localeCompare(b.name);
  });
}

function getVaultFilteredEntries() {
  const entries = buildVaultEntries();
  if (hangarVaultFilter === "all") return entries;
  return entries.filter(entry => entry.categoryKey === hangarVaultFilter);
}

function ensureVaultSelection() {
  const entries = getVaultFilteredEntries();
  if (!entries.length) {
    selectedVaultGroupKey = null;
    return;
  }
  if (!entries.some(entry => entry.groupKey === selectedVaultGroupKey)) {
    selectedVaultGroupKey = entries[0].groupKey;
  }
}

function setHangarVaultFilter(nextFilter) {
  hangarVaultFilter = nextFilter;
  ensureVaultSelection();
  renderHangarVault();
}

function selectVaultItem(groupKey) {
  selectedVaultGroupKey = groupKey;
  renderHangarVault();
}

function getSelectedVaultEntry() {
  const entries = buildVaultEntries();
  return entries.find(entry => entry.groupKey === selectedVaultGroupKey) || null;
}

function renderVaultFilters() {
  const bar = document.getElementById("vaultFilterBar");
  if (!bar) return;

  const filters = [
    { key: "all", label: "All" },
    { key: "guns", label: "Guns" },
    { key: "attachments", label: "Attachments" },
    { key: "cores", label: "Cores" }
  ];

  bar.innerHTML = filters.map(filter => `
    <button class="store-filter-btn ${hangarVaultFilter === filter.key ? "active" : ""}" onclick="setHangarVaultFilter('${filter.key}')">${filter.label}</button>
  `).join("");
}

function getVaultEntryStats(entry) {
  if (!entry) return [];
  const item = {
    key: entry.key,
    kind: entry.categoryKey === "guns" ? "gun" : entry.categoryKey === "attachments" ? "attachment" : "core"
  };

  const stats = [{ label: "Owned", value: formatNumber(entry.count) }];

  if (entry.categoryKey !== "cores") {
    stats.push({ label: "Equipped", value: formatNumber(entry.equippedCount) });
  }

  if (item.kind === "gun") {
    const gun = GUNS[item.key];
    if (gun) {
      stats.push({ label: "Attack", value: formatNumber(getStoreGunAttack(item, entry.quality)) });
    }
  } else if (item.kind === "attachment") {
    stats.push({ label: "Effect", value: getStoreAttachmentEffectText(item, entry.quality) });
  } else if (item.kind === "core") {
    const corePurpose = {
      standard: "Base upgrade",
      unique: "Improved upgrade",
      elite: "High-grade upgrade",
      legendary: "Rare upgrade",
      godlike: "Top-tier upgrade"
    };
    stats.push({ label: "Use", value: corePurpose[entry.quality] || "Upgrade core" });
  }

  return stats.slice(0, 3);
}


function getVaultTooltipHtml(entry) {
  if (!entry) return "";
  if (entry.categoryKey === "guns") {
    return getEquipmentTooltipHtml(entry, "guns");
  }
  if (entry.categoryKey === "attachments") {
    return getEquipmentTooltipHtml(entry, "attachments");
  }

  const quality = entry.quality || "standard";
  const qualityLabel = titleCaseQuality(quality);
  const statRows = [
    { label: "Owned", value: formatNumber(entry.count || 0) },
    { label: "Type", value: "Core" },
    { label: "Use", value: "Upgrade" }
  ];
  const statHtml = statRows.map(row => `
    <div class="hangar-tooltip-stat">
      <span>${escapeHtml(row.label)}</span>
      <strong>${escapeHtml(row.value)}</strong>
    </div>
  `).join("");

  return `
    <div class="hangar-tooltip-card quality-${escapeHtml(quality)}">
      <div class="hangar-tooltip-top">
        <img src="${escapeHtml(entry.icon)}" alt="">
        <div>
          <div class="hangar-tooltip-name">${escapeHtml(entry.name)}</div>
          <div class="hangar-tooltip-meta">${escapeHtml(qualityLabel)} · x${formatNumber(entry.count || 0)} owned</div>
        </div>
      </div>
      <div class="hangar-tooltip-stats">${statHtml}</div>
      <div class="hangar-tooltip-note">${escapeHtml(getVaultEntryDescription(entry) || "Upgrade material")}</div>
    </div>
  `;
}

function renderVaultCatalog() {
  const grid = document.getElementById("vaultCatalogGrid");
  if (!grid) return;

  const entries = getVaultFilteredEntries();
  if (!entries.length) {
    grid.innerHTML = `<div class="vault-empty-state">No owned items in this category.</div>`;
    return;
  }

  grid.innerHTML = "";

  entries.forEach(entry => {
    const button = document.createElement("button");
    button.className = `store-catalog-card vault-catalog-card vault-icon-card ${selectedVaultGroupKey === entry.groupKey ? "selected" : ""} quality-${entry.quality}`;
    button.onclick = () => selectVaultItem(entry.groupKey);
    button.removeAttribute("title");
    showHangarTooltip(button, getVaultTooltipHtml(entry));
    bindHangarEquipmentTooltip(button);

    button.innerHTML = `
      ${entry.equippedCount > 0 ? `<span class="vault-card-equipped">EQ ${entry.equippedCount}</span>` : ""}
      <span class="vault-card-count">x${formatNumber(entry.count)}</span>
      <div class="store-card-art quality-${entry.quality}">
        <img src="${entry.icon}" alt="${entry.name}">
      </div>
      <div class="store-card-name">${entry.name}</div>
      <div class="vault-card-meta">${titleCaseQuality(entry.quality)}</div>
    `;

    grid.appendChild(button);
  });
}

function renderVaultDetail() {
  const panel = document.getElementById("vaultDetailPanel");
  if (!panel) return;

  const entry = getSelectedVaultEntry();
  if (!entry) {
    panel.innerHTML = `<div class="vault-empty-state">Select an owned item from the vault.</div>`;
    return;
  }

  const stats = getVaultEntryStats(entry);
  panel.innerHTML = `
    <div class="store-detail-shell store-quality-${entry.quality} compact-store-detail simplified-store-detail vault-detail-shell">
      <div class="store-detail-visual quality-${entry.quality}">
        <img src="${entry.icon}" alt="${entry.name}">
      </div>
      <div class="store-detail-kicker">${entry.category.toUpperCase()} · ${titleCaseQuality(entry.quality)}</div>
      <div class="store-detail-title">${entry.name}</div>
      <div class="store-detail-desc">${getVaultEntryDescription(entry)}</div>
      <div class="store-detail-stat-grid compact-detail-stats vault-detail-stats">
        ${stats.map(stat => `
          <div class="store-detail-stat-card compact-detail-stat-card">
            <span>${stat.label}</span>
            <strong>${stat.value}</strong>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderHangarVault() {
  const title = document.getElementById("hangarShipTitle");
  const subtitle = document.getElementById("hangarShipSubtitle");
  if (title) title.textContent = "Station Vault";
  if (subtitle) subtitle.textContent = "Owned systems and upgrade materials";

  ensureVaultSelection();
  renderVaultFilters();
  renderVaultCatalog();
  renderVaultDetail();
}

/* Hangar */

function renderHangar() {
  if (!ownedShips.includes(selectedHangarShipId)) {
    selectedHangarShipId = currentShipId || "lupenOrigin";
  }

  ensureInventoryObjects();
  renderHangarOverview();
  renderOwnedShips();
  renderHangarVault();
  renderShipShop();

  const activeSection = document.querySelector(".hangar-section.active");
  if (!activeSection) {
    showHangarSection("overview");
  }
}

function ensureInventoryObjects() {
  Object.keys(attachments).forEach(key => {
    if (ownedAttachments[key] === undefined) ownedAttachments[key] = 0;
  });

  Object.keys(GUNS).forEach(key => {
    if (ownedGuns[key] === undefined) ownedGuns[key] = 0;
  });
}

function getShipRole(shipId = currentShipId) {
  return SHIPS[shipId]?.roleSubtitle || "Equipped Hull";
}

function renderMiniLoadoutList(items, emptyText) {
  if (!items.length) return `<div class="overview-empty">${emptyText}</div>`;

  return items.map(item => `
    <div class="overview-loadout-row">
      <img src="${item.image}" alt="${item.name}">
      <div>
        <strong>${item.name}</strong>
        <span>${item.description || "Installed system"}</span>
      </div>
    </div>
  `).join("");
}

function renderHangarOverview() {
  selectedHangarShipId = currentShipId;

  const ship = getCurrentShip();
  const stats = getShipStats(currentShipId);
  const loadout = getShipLoadout(currentShipId);
  const missingHull = Math.max(0, hullMax - hull);
  const repairCost = getRepairCost();
  const repairDisabled = missingHull <= 0 || credits < repairCost;

  const overviewName = document.getElementById("overviewShipName");
  const overviewImage = document.getElementById("overviewShipImage");
  const overviewNameplate = document.getElementById("overviewNameplate");
  const overviewStats = document.getElementById("overviewStats");
  const overviewRepair = document.getElementById("overviewRepairPanel");
  const subtitle = document.getElementById("hangarShipSubtitle");

  const title = document.getElementById("hangarShipTitle");
  if (title) title.textContent = ship.name;
  if (subtitle) subtitle.textContent = getShipRole(currentShipId);

  if (overviewName) overviewName.textContent = ship.name;
  if (overviewImage) {
    overviewImage.src = ship.image;
    overviewImage.alt = ship.name;
  }
  if (overviewNameplate) overviewNameplate.textContent = ship.name;

  if (overviewStats) {
    const gunLimit = getGunSlotLimit(currentShipId);
    const equipmentLimit = getAttachmentSlotLimit(currentShipId);

    overviewStats.innerHTML = `
      <div class="hangar-stat-card hull-stat featured-stat"><span>Hull</span><strong>${formatNumber(Math.floor(hull))}/${formatNumber(hullMax)}</strong></div>
      <div class="hangar-stat-card shield-stat"><span>Shield</span><strong>${formatNumber(stats.shield)}</strong></div>
      <div class="hangar-stat-card cargo-stat"><span>Cargo</span><strong>${formatNumber(stats.cargo)}</strong></div>
      <div class="hangar-stat-card jump-stat"><span>Jump</span><strong>${formatNumber(stats.jumpRecharge)}</strong></div>
      <div class="hangar-stat-card evasion-stat"><span>Evasion</span><strong>${formatEvasion(stats.evasion)}</strong></div>
      <div class="hangar-stat-card slot-split-card">
        <span>Loadout Capacity</span>
        <div class="slot-mini-grid">
          <div><small>Guns</small><strong>${loadout.guns.length}/${gunLimit}</strong></div>
          <div><small>Equip</small><strong>${loadout.attachments.length}/${equipmentLimit}</strong></div>
        </div>
      </div>
    `;
  }

  if (overviewRepair) {
    overviewRepair.innerHTML = `
      <div class="repair-hero-card ${missingHull > 0 ? "needs-repair" : "ready"} unique-repair-card compact-repair-card prestige-repair-strip">
        <div>
          <span>Hull Service</span>
          <strong>${missingHull > 0 ? `CR ${formatNumber(repairCost)}` : "Ready"}</strong>
          <small>${formatNumber(Math.floor(hull))} / ${formatNumber(hullMax)} hull</small>
        </div>
        <button onclick="repairCurrentShip()" ${repairDisabled ? "disabled" : ""}>${missingHull > 0 ? "Repair" : "Repaired"}</button>
      </div>
    `;
  }

  renderInstalledGuns();
  renderInstalledAttachments();
  renderGunInventory();
  renderAttachmentInventory();
}


function selectFleetShip(shipId) {
  if (!ownedShips.includes(shipId)) return;
  selectedFleetShipId = shipId;
  selectedHangarShipId = shipId;
  renderOwnedShips();
}

function renderFleetStatChip(label, value, statClass = "") {
  return `<div class="fleet-stat-chip ${statClass}"><span>${label}</span><strong>${value}</strong></div>`;
}


function pluralLabel(count, singular, plural = `${singular}s`) {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

function formatSlotCapacityText(shipId) {
  const guns = getGunSlotLimit(shipId);
  const equip = getAttachmentSlotLimit(shipId);
  return `Guns ${formatNumber(guns)} slot${guns === 1 ? "" : "s"} · Equip ${formatNumber(equip)} slot${equip === 1 ? "" : "s"}`;
}

function formatSlotCapacityShort(shipId) {
  return `${getGunSlotLimit(shipId)} gun · ${getAttachmentSlotLimit(shipId)} equip`;
}

function formatSlotUsageText(shipId) {
  const loadout = getShipLoadout(shipId);
  return `Guns ${loadout.guns.length}/${getGunSlotLimit(shipId)} · Equip ${loadout.attachments.length}/${getAttachmentSlotLimit(shipId)}`;
}


function renderOwnedShips() {
  const box = document.getElementById("ownedShipsList");
  if (!box) return;

  const fleetCount = document.getElementById("fleetCountText");
  if (fleetCount) fleetCount.textContent = formatNumber(ownedShips.length);

  if (!ownedShips.includes(selectedFleetShipId)) {
    selectedFleetShipId = currentShipId || ownedShips[0];
  }

  box.innerHTML = "";

  ownedShips.forEach(shipId => {
    const ship = SHIPS[shipId];
    if (!ship) return;

    const stats = getShipStats(shipId);
    const loadout = getShipLoadout(shipId);
    const isEquipped = currentShipId === shipId;
    const isSelected = selectedFleetShipId === shipId;

    const card = document.createElement("button");
    card.className = `fleet-ship-card ${isSelected ? "selected" : ""} ${isEquipped ? "active" : ""}`;
    card.onclick = () => selectFleetShip(shipId);
    card.innerHTML = `
      <div class="fleet-card-badge">${isEquipped ? "Active" : "Owned"}</div>
      <div class="fleet-card-image-wrap">
        <img src="${ship.image}" alt="${ship.name}">
      </div>
      <div class="fleet-card-name">${ship.name}</div>
      <div class="fleet-card-role">${ship.roleSubtitle || getShipRole(shipId)}</div>
      <div class="fleet-card-mini-stats">
        <span>C ${formatNumber(stats.cargo)}</span>
        <span>H ${formatNumber(stats.hull)}</span>
        <span>E ${formatEvasion(stats.evasion)}</span>
      </div>
      <div class="fleet-card-slots">${formatSlotUsageText(shipId)}</div>
    `;

    box.appendChild(card);
  });

  renderFleetDetail();
}

function renderFleetDetail() {
  const panel = document.getElementById("fleetDetailPanel");
  if (!panel) return;

  const shipId = selectedFleetShipId || currentShipId;
  const ship = SHIPS[shipId];
  if (!ship) {
    panel.innerHTML = `<div class="cargo-empty compact-empty">No ship selected</div>`;
    return;
  }

  const stats = getShipStats(shipId);
  const loadout = getShipLoadout(shipId);
  const weapon = getEquippedWeapon(shipId);
  const isEquipped = currentShipId === shipId;
  const status = document.getElementById("fleetDetailStatus");
  if (status) status.textContent = isEquipped ? "Active" : "Owned";

  panel.innerHTML = `
    <div class="fleet-detail-hero">
      <div class="fleet-detail-ship-glow"></div>
      <img src="${ship.image}" alt="${ship.name}">
    </div>

    <div class="fleet-detail-title">
      <div>
        <h4>${ship.name}</h4>
        <p>${ship.roleSubtitle || getShipRole(shipId)}</p>
      </div>
      <span class="fleet-status-chip ${isEquipped ? "active" : ""}">${isEquipped ? "Active" : "Owned"}</span>
    </div>

    <div class="fleet-detail-stats">
      ${renderFleetStatChip("Hull", formatNumber(stats.hull), "hull-stat")}
      ${renderFleetStatChip("Shield", formatNumber(stats.shield), "shield-stat")}
      ${renderFleetStatChip("Cargo", formatNumber(stats.cargo), "cargo-stat")}
      ${renderFleetStatChip("Jump", formatNumber(stats.jumpRecharge), "jump-stat")}
      ${renderFleetStatChip("Evasion", formatEvasion(stats.evasion), "evasion-stat")}
      ${renderFleetStatChip("Slots", `${formatSlotUsageText(shipId)}`, "slots-stat")}
    </div>

    <div class="fleet-weapon-action-row">
      <div class="fleet-weapon-strip compact">
        <span>Weapon Systems</span>
        <strong>${loadout.guns.length}/${getGunSlotLimit(shipId)} equipped</strong>
        <small>${formatNumber(weapon.damage)} total attack</small>
      </div>

      <div class="fleet-detail-actions compact">
        <button onclick="equipShip('${shipId}'); showHangarSection('owned');" ${isEquipped ? "disabled" : ""}>${isEquipped ? "Current" : "Set Active"}</button>
        <button onclick="equipShip('${shipId}'); showHangarSection('overview');">Open Loadout</button>
      </div>
    </div>
  `;
}

function getRepairCost() {
  return Math.max(0, Math.ceil((hullMax - hull) * HULL_REPAIR_COST_PER_POINT));
}

function renderRepairSummary(shipId = selectedHangarShipId) {
  if (shipId !== currentShipId) {
    return `
      <div class="repair-panel">
        <strong>Ship Condition</strong>
        <span>Equip this ship to repair its hull.</span>
      </div>
    `;
  }

  const missingHull = Math.max(0, hullMax - hull);
  const repairCost = getRepairCost();
  const disabled = missingHull <= 0 || credits < repairCost;

  return `
    <div class="repair-panel">
      <strong>Ship Condition</strong>
      <span>Hull: ${formatNumber(Math.floor(hull))} / ${formatNumber(hullMax)}</span>
      <span>Repair Cost: CR ${formatNumber(repairCost)}</span>
      <button onclick="repairCurrentShip()" ${disabled ? "disabled" : ""}>
        ${missingHull <= 0 ? "Hull Fully Repaired" : "Repair Hull"}
      </button>
    </div>
  `;
}

function repairCurrentShip() {
  const repairCost = getRepairCost();

  if (repairCost <= 0) {
    alert("Hull is already fully repaired.");
    return;
  }

  if (credits < repairCost) {
    alert("Not enough credits to repair hull.");
    return;
  }

  credits -= repairCost;
  hull = hullMax;

  addHudToast(`Hull repaired in Hangar for CR ${formatNumber(repairCost)}.`);
  updateSpaceHUD();
  renderHangar();
  saveGame();
}

function renderHangarEditor() {
  if (!document.getElementById("shipStats")) return;
  const ship = SHIPS[selectedHangarShipId] || getCurrentShip();
  const stats = getShipStats(selectedHangarShipId);
  const loadout = getShipLoadout(selectedHangarShipId);
  const weapon = getEquippedWeapon(selectedHangarShipId);

  const title = document.getElementById("shipEditorTitle");
  if (title) title.textContent = `Edit ${ship.name}`;

  document.getElementById("hangarShipTitle").textContent = ship.name;
  document.getElementById("hangarShipImage").src = ship.image;
  document.getElementById("hangarShipImage").alt = ship.name;

  document.getElementById("shipStats").innerHTML = `
    <div><strong>Status:</strong> ${currentShipId === selectedHangarShipId ? "Equipped" : "Owned"}</div>
    <div><strong>Attachment Slots:</strong> ${loadout.attachments.length} / ${getAttachmentSlotLimit(selectedHangarShipId)}</div>
    <div><strong>Gun Slots:</strong> ${loadout.guns.length} / ${getGunSlotLimit(selectedHangarShipId)}</div>
    <div><strong>Cargo:</strong> ${formatNumber(stats.cargo)}</div>
    <div><strong>Hull:</strong> ${formatNumber(stats.hull)}</div>
    <div><strong>Shield:</strong> ${formatNumber(stats.shield)}</div>
    <div><strong>Jump Recharge:</strong> ${formatNumber(stats.jumpRecharge)}</div>
    <div><strong>Evasion:</strong> ${formatEvasion(stats.evasion)}</div>
    <div><strong>Active Weapon:</strong> ${weapon.name}</div>
    <div><strong>Damage:</strong> ${formatNumber(weapon.damage)}</div>
    <div><strong>Speed:</strong> ${(weapon.speed / 1000).toFixed(2)}s</div>
    <div><strong>Credits:</strong> ${formatNumber(credits)}</div>
    ${renderRepairSummary(selectedHangarShipId)}
  `;

  renderInstalledAttachments();
  renderInstalledGuns();
  renderAttachmentInventory();
  renderGunInventory();
}


function setSlotRailDensity(box, limit) {
  if (!box) return;
  box.classList.toggle("many-slots", limit >= 8);
  box.classList.toggle("very-many-slots", limit >= 14);
}


function getEquippedTooltipEntry(key, quality, categoryKey) {
  const isGun = categoryKey === "guns";
  const definition = isGun ? GUNS[key] : attachments[key];
  if (!definition) return null;

  return {
    key,
    quality: quality || "standard",
    count: 1,
    name: definition.name,
    icon: definition.image
  };
}


function renderInstalledAttachments() {
  const box = document.getElementById("installedAttachments");
  if (!box) return;

  const loadout = getShipLoadout(selectedHangarShipId);
  const limit = getAttachmentSlotLimit(selectedHangarShipId);
  setSlotRailDensity(box, limit);
  const summary = document.getElementById("attachmentSlotSummary");
  if (summary) summary.textContent = `${loadout.attachments.filter(Boolean).length}/${limit}`;

  box.innerHTML = "";

  for (let i = 0; i < limit; i++) {
    const entry = loadout.attachments[i];
    const key = getEquipmentKey(entry);
    const quality = getEquipmentQuality(entry);
    const item = attachments[key];

    const slot = document.createElement("button");
    slot.className = `equipment-slot scalable-loadout-slot ${item ? "filled" : "empty"} quality-${quality}`;
    slot.disabled = !item;
    slot.onclick = () => removeAttachment(i);

    if (item) {
      slot.removeAttribute("title");
      const tooltipEntry = getEquippedTooltipEntry(key, quality, "attachments");
      showHangarTooltip(slot, getEquipmentTooltipHtml(tooltipEntry, "attachments"));
      bindHangarEquipmentTooltip(slot);
    } else {
      slot.title = `Empty equipment slot ${i + 1}`;
    }

    slot.innerHTML = item
      ? `<img src="${item.image}" alt="${item.name}">`
      : `<span class="slot-silhouette attachment-silhouette">⬡</span>`;

    box.appendChild(slot);
  }
}

function renderInstalledGuns() {
  const box = document.getElementById("installedGuns");
  if (!box) return;

  const loadout = getShipLoadout(selectedHangarShipId);
  const limit = getGunSlotLimit(selectedHangarShipId);
  setSlotRailDensity(box, limit);
  const summary = document.getElementById("gunSlotSummary");
  if (summary) summary.textContent = `${loadout.guns.filter(Boolean).length}/${limit}`;

  box.innerHTML = "";

  for (let i = 0; i < limit; i++) {
    const entry = loadout.guns[i];
    const key = getEquipmentKey(entry);
    const quality = getEquipmentQuality(entry);
    const item = GUNS[key];

    const slot = document.createElement("button");
    slot.className = `equipment-slot scalable-loadout-slot ${item ? "filled" : "empty"} quality-${quality}`;
    slot.disabled = !item;
    slot.onclick = () => removeGun(i);

    if (item) {
      slot.removeAttribute("title");
      const tooltipEntry = getEquippedTooltipEntry(key, quality, "guns");
      showHangarTooltip(slot, getEquipmentTooltipHtml(tooltipEntry, "guns"));
      bindHangarEquipmentTooltip(slot);
    } else {
      slot.title = `Empty gun slot ${i + 1}`;
    }

    slot.innerHTML = item
      ? `<img src="${item.image}" alt="${item.name}">`
      : `<span class="slot-silhouette gun-silhouette">⌁</span>`;

    box.appendChild(slot);
  }
}

function getInventoryEntriesForCategory(categoryKey) {
  ensureInventoryObjects();
  const grouped = new Map();

  function addEntry(key, quality, count, source) {
    const definition = itemDefinitions[key];
    if (!definition || getItemCategoryKey(key) !== categoryKey || count <= 0) return;
    const groupKey = `${source}__${key}__${quality}`;
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        groupKey,
        source,
        key,
        quality,
        name: definition.name,
        icon: definition.icon,
        count: 0
      });
    }
    grouped.get(groupKey).count += count;
  }

  if (categoryKey === "attachments") {
    Object.entries(ownedAttachments || {}).forEach(([key, count]) => addEntry(key, "standard", count, "owned"));
  }

  if (categoryKey === "guns") {
    Object.entries(ownedGuns || {}).forEach(([key, count]) => addEntry(key, "standard", count, "owned"));
  }

  (inventoryItems || []).forEach(item => {
    if (!item || !itemDefinitions[item.key]) return;
    addEntry(item.key, item.quality || "standard", 1, "inventory");
  });

  return Array.from(grouped.values()).sort((a, b) => {
    const qualityDelta = ITEM_QUALITY_ORDER.indexOf(b.quality) - ITEM_QUALITY_ORDER.indexOf(a.quality);
    if (qualityDelta !== 0) return qualityDelta;
    return a.name.localeCompare(b.name);
  });
}

function removeOneInventoryItem(key, quality) {
  const index = inventoryItems.findIndex(item => item.key === key && item.quality === quality);
  if (index === -1) return null;
  const [removed] = inventoryItems.splice(index, 1);
  return removed;
}

function updateEquipmentInventoryCount() {
  const total = getInventoryEntriesForCategory("guns").reduce((sum, entry) => sum + entry.count, 0)
    + getInventoryEntriesForCategory("attachments").reduce((sum, entry) => sum + entry.count, 0);
  const el = document.getElementById("equipmentInventoryCount");
  if (el) el.textContent = `${formatNumber(total)} item${total === 1 ? "" : "s"}`;
}


function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getEquipmentTooltipHtml(entry, categoryKey) {
  const quality = entry.quality || "standard";
  const qualityLabel = titleCaseQuality(quality);
  const qty = formatNumber(entry.count || 0);
  const isGun = categoryKey === "guns";
  const definition = isGun ? GUNS[entry.key] : attachments[entry.key];

  if (!definition) return "";

  const statRows = [];

  if (isGun) {
    const attack = Math.round((definition.damage || 0) * getItemStatMultiplier(quality));
    const cycle = `${((definition.speed || 1000) / 1000).toFixed(2)}s`;
    const dps = definition.speed ? Math.round(attack / (definition.speed / 1000)) : attack;

    statRows.push({ label: "ATK", value: formatNumber(attack) });
    statRows.push({ label: "Cycle", value: cycle });
    statRows.push({ label: "DPS", value: formatNumber(dps) });
  } else {
    const effect = getScaledAttachmentEffect(entry.key, quality);
    Object.entries(effect).forEach(([effectKey, value]) => {
      const label = effectKey === "jumpRecharge"
        ? "Jump"
        : effectKey === "evasion"
          ? "Evasion"
          : effectKey.charAt(0).toUpperCase() + effectKey.slice(1);
      const prefix = value >= 0 ? "+" : "";
      const suffix = effectKey === "evasion" ? "%" : "";
      statRows.push({ label, value: `${prefix}${formatNumber(Math.round(value))}${suffix}` });
    });
  }

  const statHtml = statRows.map(row => `
    <div class="hangar-tooltip-stat">
      <span>${escapeHtml(row.label)}</span>
      <strong>${escapeHtml(row.value)}</strong>
    </div>
  `).join("");

  return `
    <div class="hangar-tooltip-card quality-${escapeHtml(quality)}">
      <div class="hangar-tooltip-top">
        <img src="${escapeHtml(entry.icon || definition.image)}" alt="">
        <div>
          <div class="hangar-tooltip-name">${escapeHtml(entry.name || definition.name)}</div>
          <div class="hangar-tooltip-meta">${escapeHtml(qualityLabel)} · x${qty} owned</div>
        </div>
      </div>
      <div class="hangar-tooltip-stats">${statHtml}</div>
      <div class="hangar-tooltip-note">${escapeHtml(isGun ? (definition.description || "Weapon system") : getStoreAttachmentEffectText({ key: entry.key }, quality))}</div>
    </div>
  `;
}

function showHangarTooltip(button, html) {
  button.dataset.tooltip = html || "";
}



function ensureHangarTooltip() {
  let tooltip = document.getElementById("hangarTooltip");
  if (!tooltip) {
    tooltip = document.createElement("div");
    tooltip.id = "hangarTooltip";
    document.body.appendChild(tooltip);
  }
  return tooltip;
}

function bindHangarEquipmentTooltip(btn) {
  const tooltip = ensureHangarTooltip();

  btn.addEventListener("mouseenter", () => {
    if (!btn.dataset.tooltip) return;
    tooltip.innerHTML = btn.dataset.tooltip;
    tooltip.classList.add("visible");
    positionHangarTooltip(btn, tooltip);
  });

  btn.addEventListener("mousemove", () => {
    if (!tooltip.classList.contains("visible")) return;
    positionHangarTooltip(btn, tooltip);
  });

  btn.addEventListener("mouseleave", () => {
    tooltip.classList.remove("visible");
  });

  btn.addEventListener("click", () => {
    tooltip.classList.remove("visible");
  });
}

function positionHangarTooltip(target, tooltip) {
  const rect = target.getBoundingClientRect();
  const tooltipWidth = 248;
  const viewportPadding = 12;
  let x = rect.left + rect.width / 2;
  x = Math.max(viewportPadding + tooltipWidth / 2, Math.min(window.innerWidth - viewportPadding - tooltipWidth / 2, x));

  let y = rect.top - 10;
  if (rect.top < 230) {
    y = rect.bottom + tooltip.offsetHeight + 18;
  }

  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}


function renderAttachmentInventory() {
  const box = document.getElementById("attachmentInventory");
  if (!box) return;

  const loadout = getShipLoadout(selectedHangarShipId);
  const full = loadout.attachments.length >= getAttachmentSlotLimit(selectedHangarShipId);
  const entries = getInventoryEntriesForCategory("attachments");
  const countEl = document.getElementById("attachmentInventoryCount");
  if (countEl) countEl.textContent = `${formatNumber(entries.reduce((sum, entry) => sum + entry.count, 0))} available`;
  updateEquipmentInventoryCount();
  box.innerHTML = "";

  if (!entries.length) {
    box.innerHTML = `<div class="cargo-empty compact-empty">No spare attachments</div>`;
    return;
  }

  entries.forEach(entry => {
    const btn = document.createElement("button");
    btn.className = `inventory-icon-card hangar-equipment-card quality-${entry.quality}`;
    btn.dataset.itemKey = entry.key;
    btn.dataset.itemType = "attachment";
    btn.disabled = entry.count <= 0 || full;
    btn.onclick = () => equipAttachmentFromInventory(entry.key, entry.quality, entry.source);
    btn.removeAttribute("title");
    showHangarTooltip(btn, getEquipmentTooltipHtml(entry, "attachments"));
    bindHangarEquipmentTooltip(btn);

    btn.innerHTML = `
      <img src="${entry.icon}" alt="${entry.name}">
      <span class="sr-only">${entry.name}</span>
      <strong>x${formatNumber(entry.count)}</strong>
    `;

    box.appendChild(btn);
  });
}

function renderGunInventory() {
  const box = document.getElementById("gunInventory");
  if (!box) return;

  const loadout = getShipLoadout(selectedHangarShipId);
  const full = loadout.guns.length >= getGunSlotLimit(selectedHangarShipId);
  const entries = getInventoryEntriesForCategory("guns");
  const countEl = document.getElementById("gunInventoryCount");
  if (countEl) countEl.textContent = `${formatNumber(entries.reduce((sum, entry) => sum + entry.count, 0))} available`;
  updateEquipmentInventoryCount();
  box.innerHTML = "";

  if (!entries.length) {
    box.innerHTML = `<div class="cargo-empty compact-empty">No spare guns</div>`;
    return;
  }

  entries.forEach(entry => {
    const gun = GUNS[entry.key];
    const btn = document.createElement("button");
    btn.className = `inventory-icon-card hangar-equipment-card quality-${entry.quality}`;
    btn.dataset.itemKey = entry.key;
    btn.dataset.itemType = "gun";
    btn.disabled = entry.count <= 0 || full;
    btn.onclick = () => equipGunFromInventory(entry.key, entry.quality, entry.source);
    btn.removeAttribute("title");
    showHangarTooltip(btn, getEquipmentTooltipHtml(entry, "guns"));
    bindHangarEquipmentTooltip(btn);

    btn.innerHTML = `
      <img src="${entry.icon}" alt="${entry.name}">
      <span class="sr-only">${entry.name}</span>
      <strong>x${formatNumber(entry.count)}</strong>
    `;

    box.appendChild(btn);
  });
}

function renderAttachmentShop() {
  const box = document.getElementById("attachmentShop");
  if (!box) return;

  box.innerHTML = "";

  Object.entries(attachments).forEach(([key, item]) => {
    const canAfford = credits >= item.price;
    const owned = ownedAttachments[key] || 0;

    const card = document.createElement("div");
    card.className = "equipment-card";
    card.innerHTML = `
      <img src="${item.image}" alt="${item.name}">
      <div class="equipment-card-meta">
        <h4>${item.name}</h4>
        <p>${item.description}</p>
        <p>Owned: ${formatNumber(owned)}</p>
        <p>Price: CR ${formatNumber(item.price)}</p>
      </div>
      <div class="equipment-card-actions">
        <button class="store-buy-attachment-action" data-item-key="${key}" data-item-type="attachment" onclick="buyAttachment('${key}')" ${!canAfford ? "disabled" : ""}>Buy</button>
      </div>
    `;
    box.appendChild(card);
  });
}

function renderGunShop() {
  const box = document.getElementById("gunShop");
  if (!box) return;

  box.innerHTML = "";

  Object.entries(GUNS).forEach(([key, item]) => {
    const canAfford = credits >= item.price;
    const owned = ownedGuns[key] || 0;

    const card = document.createElement("div");
    card.className = "equipment-card";
    card.innerHTML = `
      <img src="${item.image}" alt="${item.name}">
      <div class="equipment-card-meta">
        <h4>${item.name}</h4>
        <p>${item.description}</p>
        <p>${formatNumber(item.damage)} dmg · ${(item.speed / 1000).toFixed(2)}s fire cycle</p>
        <p>Owned: ${formatNumber(owned)}</p>
        <p>Price: CR ${formatNumber(item.price)}</p>
      </div>
      <div class="equipment-card-actions">
        <button class="store-buy-gun-action" data-item-key="${key}" data-item-type="gun" onclick="buyGun('${key}')" ${!canAfford ? "disabled" : ""}>Buy</button>
      </div>
    `;
    box.appendChild(card);
  });
}

function getExchangeShips() {
  return Object.values(SHIPS).filter(ship => !ship.hiddenFromExchange);
}

function getShipyardSelectedShip() {
  if (!SHIPS[selectedShipyardShipId] || SHIPS[selectedShipyardShipId].hiddenFromExchange) {
    selectedShipyardShipId = getExchangeShips().find(ship => !ownedShips.includes(ship.id))?.id || currentShipId || "lupenOrigin";
  }
  return SHIPS[selectedShipyardShipId] || getCurrentShip();
}

function selectShipyardShip(shipId) {
  if (!SHIPS[shipId]) return;
  selectedShipyardShipId = shipId;
  renderShipShop();
  renderShipyardDetail();
}

function renderShipyardStatPills(shipId) {
  const stats = getShipStats(shipId);
  return `
    ${renderFleetStatChip("Hull", formatNumber(stats.hull), "hull-stat")}
    ${renderFleetStatChip("Shield", formatNumber(stats.shield), "shield-stat")}
    ${renderFleetStatChip("Cargo", formatNumber(stats.cargo), "cargo-stat")}
    ${renderFleetStatChip("Jump", formatNumber(stats.jumpRecharge), "jump-stat")}
    ${renderFleetStatChip("Evasion", formatEvasion(stats.evasion), "evasion-stat")}
    ${renderFleetStatChip("Capacity", formatSlotCapacityText(shipId), "slots-stat")}
  `;
}

function renderShipyardDetail() {
  const panel = document.getElementById("shipyardDetailPanel");
  if (!panel) return;

  const ship = getShipyardSelectedShip();
  const owned = ownedShips.includes(ship.id);
  const equipped = currentShipId === ship.id;
  const canAfford = credits >= ship.price;
  const status = document.getElementById("shipyardDetailStatus");
  if (status) status.textContent = equipped ? "Active" : owned ? "Owned" : "Available";

  let action = "";
  if (equipped) {
    action = `<button disabled>Current</button>`;
  } else if (owned) {
    action = `<button onclick="equipShip('${ship.id}'); showHangarSection('shipyard');">Set Active</button>`;
  } else {
    action = `<button class="buy-ship-action" onclick="buyShip('${ship.id}')" ${!canAfford ? "disabled" : ""}>Buy · CR ${formatNumber(ship.price)}</button>`;
  }

  panel.innerHTML = `
    <div class="fleet-detail-hero vessel-detail-hero">
      <div class="fleet-detail-ship-glow"></div>
      <img src="${ship.image}" alt="${ship.name}">
    </div>

    <div class="fleet-detail-title">
      <div>
        <h4>${ship.name}</h4>
        <p>${ship.roleSubtitle || "Available hull"}</p>
      </div>
      <span class="fleet-status-chip ${equipped ? "active" : ""}">${equipped ? "Active" : owned ? "Owned" : `CR ${formatNumber(ship.price)}`}</span>
    </div>

    <div class="shipyard-primary-action">
      ${action}
    </div>

    <div class="fleet-detail-stats shipyard-stat-grid">${renderShipyardStatPills(ship.id)}</div>


  `;
}

function renderShipShop() {
  const box = document.getElementById("shipShop");
  if (!box) return;
  const creditText = document.getElementById("shipyardCreditText");
  if (creditText) creditText.textContent = formatNumber(credits);

  if (!SHIPS[selectedShipyardShipId] || SHIPS[selectedShipyardShipId].hiddenFromExchange) {
    selectedShipyardShipId = getExchangeShips().find(ship => !ownedShips.includes(ship.id))?.id || currentShipId;
  }

  box.innerHTML = "";

  getExchangeShips().forEach(ship => {
    const owned = ownedShips.includes(ship.id);
    const equipped = currentShipId === ship.id;
    const selected = selectedShipyardShipId === ship.id;
    const stats = getShipStats(ship.id);

    const card = document.createElement("button");
    const isTutorialRequiredShip = tutorialState?.active && getCurrentTutorialStep()?.id === "buy-first-ship" && ship.id === "lupenOrigin";
    card.className = `fleet-ship-card vessel-exchange-card ${selected ? "selected" : ""} ${equipped ? "active" : ""} ${isTutorialRequiredShip ? "tutorial-required-ship" : ""}`;
    card.dataset.shipId = ship.id;
    card.onclick = () => selectShipyardShip(ship.id);
    card.innerHTML = `
      <div class="fleet-card-badge">${equipped ? "Active" : (owned ? "Owned" : `CR ${formatNumber(ship.price)}`)}</div>
      <div class="fleet-card-image-wrap">
        <img src="${ship.image}" alt="${ship.name}">
      </div>
      <div class="fleet-card-name">${ship.name}</div>
      <div class="fleet-card-role">${ship.roleSubtitle || "Available hull"}</div>
      <div class="fleet-card-mini-stats">
        <span>C ${formatNumber(stats.cargo)}</span>
        <span>H ${formatNumber(stats.hull)}</span>
        <span>E ${formatEvasion(stats.evasion)}</span>
      </div>
      <div class="fleet-card-slots">${formatSlotCapacityShort(ship.id)}</div>
    `;
    box.appendChild(card);
  });

  renderShipyardDetail();
}


function getStoreItemDisplayQuality(item) {
  if (!item) return "standard";
  if (item.fixedQuality) return item.fixedQuality;
  return item.qualityEnabled ? selectedStoreQuality : "standard";
}

function getStoreDayKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function getStoreResetSeconds() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return Math.max(0, Math.floor((next.getTime() - now.getTime()) / 1000));
}

function formatStoreResetCountdown() {
  const seconds = getStoreResetSeconds();
  const hours = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const remainder = String(seconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${remainder}`;
}

function updateStoreResetTimer() {
  const timerEl = document.getElementById("storeResetTimerText");
  if (timerEl) {
    timerEl.textContent = `Store items refresh in ${formatStoreResetCountdown()}`;
  }
}

function startStoreTimer() {
  stopStoreTimer();
  renderedStoreDayKey = getStoreDayKey();
  updateStoreResetTimer();
  storeDailyTimer = setInterval(() => {
    updateStoreResetTimer();
    const dayKey = getStoreDayKey();
    if (dayKey !== renderedStoreDayKey && document.getElementById("storeScreen")?.classList.contains("active")) {
      renderedStoreDayKey = dayKey;
      renderStore();
    }
  }, 1000);
}

function stopStoreTimer() {
  if (storeDailyTimer) {
    clearInterval(storeDailyTimer);
    storeDailyTimer = null;
  }
}

function getDailyStoreSeed() {
  const dateKey = getStoreDayKey();
  let hash = 0;
  for (let i = 0; i < dateKey.length; i += 1) {
    hash = ((hash << 5) - hash) + dateKey.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getDailyStoreItem(baseItems) {
  const candidates = baseItems.filter(item => (item.kind === "gun" || item.kind === "attachment") && !item.dailyStock);
  if (!candidates.length) return null;

  const seed = getDailyStoreSeed();
  const base = candidates[seed % candidates.length];

  return {
    ...base,
    id: `daily:${base.kind}:${base.key}`,
    fixedQuality: "unique",
    storeTier: "Daily Unique",
    dailyStock: true,
    basePrice: Math.max(1, Math.round(base.basePrice * (ITEM_QUALITY_BUY_MULTIPLIERS.unique || 2.5))),
    description: `${base.description} Unique daily stock. Resets every 24 hours.`
  };
}


function getStoreDailyPurchaseCount(item) {
  if (!item?.dailyStock) return 0;
  const dayKey = getStoreDayKey();
  return Number(storeDailyPurchases?.[dayKey]?.[item.id] || 0);
}

function getStoreStockLimit(item) {
  if (!item) return Infinity;
  return item.dailyStock ? 1 : Infinity;
}

function getStoreStockRemaining(item) {
  const limit = getStoreStockLimit(item);
  if (!Number.isFinite(limit)) return Infinity;
  return Math.max(0, limit - getStoreDailyPurchaseCount(item));
}

function getStoreStockLabel(item) {
  const remaining = getStoreStockRemaining(item);
  return Number.isFinite(remaining) ? `${remaining} available` : "Unlimited stock";
}

function recordStorePurchase(item) {
  if (!item?.dailyStock) return;
  const dayKey = getStoreDayKey();
  storeDailyPurchases[dayKey] = storeDailyPurchases[dayKey] || {};
  storeDailyPurchases[dayKey][item.id] = getStoreDailyPurchaseCount(item) + 1;
}

function pruneStoreDailyPurchases() {
  const dayKey = getStoreDayKey();
  storeDailyPurchases = storeDailyPurchases && typeof storeDailyPurchases === "object" ? storeDailyPurchases : {};
  Object.keys(storeDailyPurchases).forEach(key => {
    if (key !== dayKey) delete storeDailyPurchases[key];
  });
}

function getStoreCatalogItems() {
  const items = [];

  Object.entries(GUNS).forEach(([key, item]) => {
    items.push({
      id: `gun:${key}`,
      kind: "gun",
      key,
      name: item.name,
      category: "guns",
      image: item.image,
      description: item.description,
      basePrice: item.price,
      qualityEnabled: false,
      storeTier: "Core Stock",
      stats: [
        { label: "Attack", value: formatNumber(item.damage) },
        { label: "Cycle", value: `${(item.speed / 1000).toFixed(2)}s` },
        { label: "Type", value: "Standard Weapon" }
      ]
    });
  });

  Object.entries(attachments).forEach(([key, item]) => {
    const effectText = Object.entries(item.effect || {}).map(([effectKey, value]) => {
      const label = effectKey === "jumpRecharge"
        ? "Jump Speed"
        : effectKey === "evasion"
          ? "Evasion"
          : effectKey.charAt(0).toUpperCase() + effectKey.slice(1);
      const suffix = effectKey === "evasion" ? "%" : "";
      return `+${value}${suffix} ${label}`;
    }).join(" · ");

    items.push({
      id: `attachment:${key}`,
      kind: "attachment",
      key,
      name: item.name,
      category: "attachments",
      image: item.image,
      description: item.description,
      basePrice: item.price,
      qualityEnabled: false,
      storeTier: "Core Stock",
      stats: [
        { label: "Effect", value: effectText || item.description },
        { label: "Type", value: "Standard Attachment" }
      ]
    });
  });

  const dailyItem = getDailyStoreItem(items);
  if (dailyItem) {
    items.push(dailyItem);
  }

  const order = { attachments: 0, guns: 1 };
  return items.sort((a, b) => {
    if (a.dailyStock !== b.dailyStock) return a.dailyStock ? 1 : -1;
    const delta = (order[a.category] || 99) - (order[b.category] || 99);
    if (delta !== 0) return delta;
    return a.name.localeCompare(b.name);
  });
}

function isStoreOwnedItem(item, quality = selectedStoreQuality) {
  if (!item) return false;
  if (item.kind === "ship") return false;
  if (item.kind === "core") {
    return getStoreItemInventoryCount(item, quality) > 0;
  }
  if (item.kind === "attachment" || item.kind === "gun") {
    return (getStoreOwnedReadyCount(item) + getStoreItemInventoryCount(item, quality)) > 0;
  }
  return false;
}

function getStoreFilteredItems() {
  const items = getStoreCatalogItems();
  if (storeFilter === "all") return items;
  if (storeFilter === "owned") {
    return items.filter(item => isStoreOwnedItem(item, getStoreItemDisplayQuality(item)));
  }
  return items.filter(item => item.category === storeFilter);
}

function getStoreSelectedItem() {
  return getStoreCatalogItems().find(item => item.id === selectedStoreItemId) || null;
}

function ensureStoreSelection() {
  if (!["all", "guns", "attachments", "owned"].includes(storeFilter)) {
    storeFilter = "all";
  }
  selectedStoreQuality = "standard";
  const filtered = getStoreFilteredItems();
  if (!filtered.length) {
    selectedStoreItemId = null;
    return;
  }

  if (!filtered.some(item => item.id === selectedStoreItemId)) {
    selectedStoreItemId = filtered[0].id;
  }

  const selected = getStoreSelectedItem();
  if (selected && !selected.qualityEnabled && !selected.fixedQuality) {
    selectedStoreQuality = "standard";
  }
}

function getItemStatMultiplier(quality = "standard") {
  return ITEM_QUALITY_STAT_MULTIPLIERS[quality] || 1;
}

function getStoreGunAttack(item, quality = "standard") {
  const gun = GUNS[item?.key];
  if (!gun) return 0;
  return Math.round(gun.damage * getItemStatMultiplier(quality));
}

function getStoreAttachmentEffectText(item, quality = "standard") {
  const attachment = attachments[item?.key];
  if (!attachment) return item?.description || "";
  const multiplier = getItemStatMultiplier(quality);
  const effects = Object.entries(attachment.effect || {}).map(([effectKey, value]) => {
    const scaled = Math.max(1, Math.round(value * multiplier));
    const label = effectKey === "jumpRecharge"
      ? "Jump Speed"
      : effectKey === "evasion"
        ? "Evasion"
        : effectKey.charAt(0).toUpperCase() + effectKey.slice(1);
    const suffix = effectKey === "evasion" ? "%" : "";
    return `+${scaled}${suffix} ${label}`;
  });
  return effects.join(" · ") || attachment.description || "";
}


function getInventoryEffectLine(entry) {
  if (!entry) return "";
  const quality = entry.quality || "standard";
  if (entry.kind === "gun" && GUNS[entry.key]) {
    return `ATK ${formatNumber(getStoreGunAttack({ key: entry.key }, quality))}`;
  }
  if (entry.kind === "attachment" && attachments[entry.key]) {
    return getStoreAttachmentEffectText({ key: entry.key }, quality);
  }
  if (entry.type === "core" || itemDefinitions[entry.key]?.core) {
    return "Upgrade material";
  }
  return "";
}

function getStoreDetailStats(item, quality = "standard") {
  if (!item) return [];

  if (item.kind === "gun") {
    const gun = GUNS[item.key];
    if (!gun) return [];
    return [
      { label: "Attack", value: formatNumber(getStoreGunAttack(item, quality)) },
      { label: "Cycle", value: `${(gun.speed / 1000).toFixed(2)}s` }
    ];
  }

  if (item.kind === "attachment") {
    return [
      { label: "Effect", value: getStoreAttachmentEffectText(item, quality) }
    ];
  }

  if (item.kind === "core") {
    const valueMap = {
      standard: "Entry upgrade core",
      unique: "Stabilised upgrade core",
      elite: "High-grade upgrade core",
      legendary: "Rare premium upgrade core",
      godlike: "Top-tier endgame core"
    };
    return [
      { label: "Use", value: valueMap[quality] || "Upgrade core" }
    ];
  }

  if (item.kind === "ship") {
    const ship = SHIPS[item.key];
    if (!ship) return [];
    return [
      { label: "Hull", value: formatNumber(ship.baseHull) },
      { label: "Shield", value: formatNumber(ship.baseShield) }
    ];
  }

  return [];
}

function getStorePrice(item, quality = "standard") {
  if (!item) return 0;
  if (!item.qualityEnabled) return item.basePrice;
  const multiplier = ITEM_QUALITY_BUY_MULTIPLIERS[quality] || 1;
  return Math.max(1, Math.round(item.basePrice * multiplier));
}

function getStoreItemInventoryCount(item, quality = "standard") {
  return inventoryItems.filter(entry => entry.key === item.key && entry.quality === quality).length;
}

function getStoreOwnedReadyCount(item) {
  if (!item) return 0;
  if (item.kind === "gun") return ownedGuns[item.key] || 0;
  if (item.kind === "attachment") return ownedAttachments[item.key] || 0;
  return 0;
}

function setStoreFilter(nextFilter) {
  storeFilter = nextFilter;
  ensureStoreSelection();
  renderStore();
}

function selectStoreItem(itemId) {
  selectedStoreItemId = itemId;
  const item = getStoreSelectedItem();
  if (item && !item.qualityEnabled && !item.fixedQuality) {
    selectedStoreQuality = "standard";
  }
  renderStore();

  // Step 25 is a two-part action: select Evasion Matrix, then buy it.
  // Refresh the tutorial after selection so the highlight moves onto the Buy button.
  if (tutorialState?.active && getCurrentTutorialStep()?.id === "buy-equipment") {
    setTimeout(renderStarterTutorial, 40);
  }
}

function selectStoreQuality(quality) {
  selectedStoreQuality = quality;
  renderStore();
}

function renderStore() {
  if (tutorialState?.active && getCurrentTutorialStep()?.id === "buy-equipment") {
    const evasionItem = getStoreCatalogItems().find(item => item.key === "evasionMatrix" && item.kind === "attachment");
    if (evasionItem) selectedStoreItemId = evasionItem.id;
  }

  const node = sectorNodes[currentNode] || sectorNodes[lastPlanetNode] || { name: "Asteron Prime" };
  const title = document.getElementById("storeLocationTitle");
  if (title) title.textContent = String(node.name || "Asteron Prime").toUpperCase();

  const creditsEl = document.getElementById("storeCreditsText");
  if (creditsEl) creditsEl.textContent = formatNumber(credits);

  pruneStoreDailyPurchases();
  ensureStoreSelection();
  renderStoreFilters();
  renderStoreQualityFilters();
  renderStoreCatalog();
  renderStoreDetail();
}

function renderStoreFilters() {
  const bar = document.getElementById("storeFilterBar");
  if (!bar) return;

  const filters = [
    { key: "all", label: "All" },
    { key: "guns", label: "Guns" },
    { key: "attachments", label: "Attachments" },
    { key: "owned", label: "Owned" }
  ];

  bar.innerHTML = filters.map(filter => `
    <button class="store-filter-btn ${storeFilter === filter.key ? "active" : ""}" onclick="setStoreFilter('${filter.key}')">${filter.label}</button>
  `).join("");
}


function renderStoreQualityFilters() {
  const bar = document.getElementById("storeQualityBar");
  if (!bar) return;

  selectedStoreQuality = "standard";
  bar.innerHTML = `<div class="store-daily-status"><span id="storeResetTimerText">Store items refresh in 24:00:00</span></div>`;
  updateStoreResetTimer();
}

function renderStoreCatalog() {
  const grid = document.getElementById("storeCatalogGrid");
  if (!grid) return;

  const items = getStoreFilteredItems();
  if (!items.length) {
    grid.innerHTML = `<div class="store-empty-state">No items found in this category.</div>`;
    return;
  }

  grid.innerHTML = items.map(item => {
    const quality = getStoreItemDisplayQuality(item);
    const price = getStorePrice(item, quality);
    let status = "";

    if (item.kind === "ship") {
      status = currentShipId === item.key ? "Equipped" : (ownedShips.includes(item.key) ? "Owned" : "");
    } else if (item.kind === "core") {
      const invCount = getStoreItemInventoryCount(item, quality);
      status = invCount > 0 ? `x${invCount}` : "";
    } else {
      const totalOwned = getStoreOwnedReadyCount(item) + getStoreItemInventoryCount(item, quality);
      status = totalOwned > 0 ? `x${totalOwned}` : "";
    }

    const stockLabel = getStoreStockLabel(item);
    const soldOut = getStoreStockRemaining(item) === 0;

    return `
      <button class="store-catalog-card ${selectedStoreItemId === item.id ? "selected" : ""} ${item.dailyStock ? "daily-stock-card" : ""} ${soldOut ? "sold-out" : ""} quality-${quality}" data-item-key="${item.key}" data-item-kind="${item.kind}" onclick="selectStoreItem('${item.id}')">
        ${status ? `<span class="store-card-status">${status}</span>` : ""}
        <div class="store-card-art quality-${quality}">
          <img src="${item.image}" alt="${item.name}">
        </div>
        <div class="store-card-name">${item.name}</div>
        <div class="store-card-sub">${item.storeTier || item.category}</div>
        <div class="store-card-stock">${stockLabel}</div>
        <div class="store-card-price">${soldOut ? "Sold Out" : `CR ${formatNumber(price)}`}</div>
      </button>`;
  }).join("");
}

function renderStoreDetail() {
  const panel = document.getElementById("storeDetailPanel");
  if (!panel) return;

  const item = getStoreSelectedItem();
  if (!item) {
    panel.innerHTML = `<div class="store-empty-state">Select an item from the catalogue.</div>`;
    return;
  }

  const quality = getStoreItemDisplayQuality(item);
  const buyPrice = getStorePrice(item, quality);
  const inventoryCount = item.kind === "ship" ? 0 : getStoreItemInventoryCount(item, quality);
  const ownedReady = getStoreOwnedReadyCount(item);
  const totalOwned = item.kind === "ship"
    ? (ownedShips.includes(item.key) ? 1 : 0)
    : (ownedReady + inventoryCount);
  const stockRemaining = getStoreStockRemaining(item);
  const hasStock = stockRemaining > 0 || !Number.isFinite(stockRemaining);
  const canBuy = item.kind === "ship" ? (!ownedShips.includes(item.key) && credits >= buyPrice && hasStock) : credits >= buyPrice && hasStock;
  const sellPrice = item.kind === "ship"
    ? 0
    : (item.kind === "attachment" || item.kind === "gun") && quality === "standard" && ownedReady > 0
      ? Math.max(1, Math.floor(item.basePrice * 0.7))
      : inventoryCount > 0
        ? getInventoryItemSellValue(item.key, quality)
        : 0;

  const detailStats = getStoreDetailStats(item, quality);
  const detailStatsHtml = detailStats.length ? `
    <div class="store-detail-stat-grid compact-detail-stats">
      ${detailStats.map(stat => `
        <div class="store-detail-stat-card compact-detail-stat-card">
          <span>${stat.label}</span>
          <strong>${stat.value}</strong>
        </div>
      `).join("")}
    </div>` : "";

  let buyButton = "";
  let sellButton = "";

  if (item.kind === "ship") {
    if (currentShipId === item.key) {
      buyButton = `<button disabled>Equipped</button>`;
    } else if (ownedShips.includes(item.key)) {
      buyButton = `<button disabled>Owned in Hangar</button>`;
    } else {
      buyButton = `<button class="store-detail-buy-action" data-item-key="${item.key}" data-item-kind="${item.kind}" onclick="storeBuySelected()" ${!canBuy ? "disabled" : ""}>${hasStock ? `Buy · CR ${formatNumber(buyPrice)}` : "Sold Out"}</button>`;
    }
  } else {
    buyButton = `<button class="store-detail-buy-action" data-item-key="${item.key}" data-item-kind="${item.kind}" onclick="storeBuySelected()" ${!canBuy ? "disabled" : ""}>${hasStock ? `Buy · CR ${formatNumber(buyPrice)}` : "Sold Out"}</button>`;
    if (sellPrice > 0) {
      const sellHandler = (item.kind === "attachment" || item.kind === "gun") && quality === "standard" && ownedReady > 0
        ? 'storeSellSelectedOwned()'
        : 'storeSellSelectedInventory(1)';
      sellButton = `<button onclick="${sellHandler}">Sell · CR ${formatNumber(sellPrice)}</button>`;
    }
  }

  const ownershipLine = item.kind === "ship"
    ? (ownedShips.includes(item.key) ? (currentShipId === item.key ? "Currently equipped" : "Owned in hangar") : "Not owned")
    : (totalOwned > 0 ? `${formatNumber(totalOwned)} owned` : "Not owned");

  panel.innerHTML = `
    <div class="store-detail-shell store-quality-${quality} compact-store-detail simplified-store-detail">
      <div class="store-detail-visual quality-${quality}">
        <img src="${item.image}" alt="${item.name}">
      </div>

      <div class="store-detail-kicker">${item.storeTier || item.category} · ${titleCaseQuality(quality)}</div>
      <div class="store-detail-title">${item.name}</div>
      <div class="store-detail-desc">${item.description}</div>
      <div class="store-detail-owned-line">${ownershipLine} · ${getStoreStockLabel(item)}</div>
      ${detailStatsHtml}

      <div class="store-detail-actions compact-store-actions simplified-store-actions ${sellButton ? 'two-buttons' : 'one-button'}">
        ${buyButton}
        ${sellButton}
      </div>
    </div>`;
}

function storeBuySelected() {
  const item = getStoreSelectedItem();
  if (!item) return;
  const quality = getStoreItemDisplayQuality(item);
  const price = getStorePrice(item, quality);
  if (getStoreStockRemaining(item) <= 0) {
    alert("This daily store item has sold out.");
    return;
  }

  if (credits < price) {
    alert("Not enough credits.");
    return;
  }

  if (item.kind === "ship") {
    buyShip(item.key);
    return;
  }

  if (item.kind === "attachment") {
    if (quality === "standard") {
      buyAttachment(item.key);
      recordStorePurchase(item);
      tutorialEvent("boughtEquipment");
    } else {
      credits -= price;
      inventoryItems.push({ id: `item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, key: item.key, quality });
      recordStorePurchase(item);
      renderStore();
      saveGame();
      tutorialEvent("boughtEquipment");
    }
    return;
  }

  if (item.kind === "gun") {
    if (quality === "standard") {
      buyGun(item.key);
      recordStorePurchase(item);
      tutorialEvent("boughtEquipment");
    } else {
      credits -= price;
      inventoryItems.push({ id: `item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, key: item.key, quality });
      recordStorePurchase(item);
      renderStore();
      saveGame();
      tutorialEvent("boughtEquipment");
    }
    return;
  }

  if (item.kind === "core") {
    credits -= price;
    inventoryItems.push({ id: `item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`, key: item.key, quality });
    recordStorePurchase(item);
    renderStore();
    saveGame();
    tutorialEvent("boughtEquipment");
  }
}

function storeSellSelectedOwned() {
  const item = getStoreSelectedItem();
  if (!item) return;
  if (item.kind === "attachment") {
    sellOwnedAttachment(item.key);
    return;
  }
  if (item.kind === "gun") {
    sellOwnedGun(item.key);
  }
}

function storeSellSelectedInventory(amount = "all") {
  const item = getStoreSelectedItem();
  if (!item) return;
  sellInventoryItemToNpc(item.key, getStoreItemDisplayQuality(item), amount, true);
}

function sellOwnedAttachment(key) {

  const item = attachments[key];
  if (!item || (ownedAttachments[key] || 0) <= 0) return;
  ownedAttachments[key] -= 1;
  credits += Math.max(1, Math.floor(item.price * 0.7));
  renderStore();
  saveGame();
}

function sellOwnedGun(key) {
  const item = GUNS[key];
  if (!item || (ownedGuns[key] || 0) <= 0) return;
  ownedGuns[key] -= 1;
  credits += Math.max(1, Math.floor(item.price * 0.7));
  renderStore();
  saveGame();
}

function sellShipToStore(shipId) {
  const ship = SHIPS[shipId];
  if (!ship || shipId === currentShipId || !ownedShips.includes(shipId)) return;
  ownedShips = ownedShips.filter(id => id !== shipId);
  delete shipLoadouts[shipId];
  credits += Math.max(1, Math.floor(ship.price * 0.7));
  renderStore();
  saveGame();
}

function buyAttachment(key) {
  const item = attachments[key];
  if (!item) return;

  if (credits < item.price) {
    alert("Not enough credits.");
    return;
  }

  credits -= item.price;
  ownedAttachments[key] = (ownedAttachments[key] || 0) + 1;

  if (key === "evasionMatrix") tutorialEvent("boughtStoreEvasionMatrix");
  tutorialEvent("boughtStoreAttachment");
  tutorialEvent("boughtEquipment");

  renderStore();
  showScreen("storeScreen");
  saveGame();
}

function buyGun(key) {
  const item = GUNS[key];
  if (!item) return;

  if (credits < item.price) {
    alert("Not enough credits.");
    return;
  }

  credits -= item.price;
  ownedGuns[key] = (ownedGuns[key] || 0) + 1;

  tutorialEvent("boughtStoreGun");
  tutorialEvent("boughtEquipment");

  renderStore();
  showScreen("storeScreen");
  saveGame();
}

function equipAttachmentFromInventory(key, quality = "standard", source = "owned") {
  const item = attachments[key];
  const loadout = getShipLoadout(selectedHangarShipId);

  if (!item) return;

  if (loadout.attachments.length >= getAttachmentSlotLimit(selectedHangarShipId)) {
    alert("No empty attachment slots.");
    return;
  }

  if (source === "owned" && quality === "standard") {
    if ((ownedAttachments[key] || 0) <= 0) return;
    ownedAttachments[key] -= 1;
  } else {
    const removed = removeOneInventoryItem(key, quality);
    if (!removed) return;
  }

  loadout.attachments.push(makeLoadoutEntry(key, quality));

  if (selectedHangarShipId === currentShipId) {
    applyShipStats(true);
  }

  renderHangar();
  showHangarSection("overview");
  if (key === "cargoPod") tutorialEvent("equippedCargoPod");
  if (key === "jumpDrive") tutorialEvent("equippedJumpDrive");
  tutorialEvent("equippedAttachment");
  tutorialEvent("equippedItem");
  saveGame();
}

function removeAttachment(index) {
  const loadout = getShipLoadout(selectedHangarShipId);
  const [removed] = loadout.attachments.splice(index, 1);

  if (removed) {
    const key = getEquipmentKey(removed);
    const quality = getEquipmentQuality(removed);

    if (quality === "standard") {
      ownedAttachments[key] = (ownedAttachments[key] || 0) + 1;
    } else {
      inventoryItems.push({
        id: `item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        key,
        quality
      });
    }
  }

  if (selectedHangarShipId === currentShipId) {
    applyShipStats(true);
  }

  renderHangar();
  showHangarSection("overview");
  saveGame();
}

function equipGunFromInventory(key, quality = "standard", source = "owned") {
  const item = GUNS[key];
  const loadout = getShipLoadout(selectedHangarShipId);

  if (!item) return;

  if (loadout.guns.length >= getGunSlotLimit(selectedHangarShipId)) {
    alert("No empty gun slots.");
    return;
  }

  if (source === "owned" && quality === "standard") {
    if ((ownedGuns[key] || 0) <= 0) return;
    ownedGuns[key] -= 1;
  } else {
    const removed = removeOneInventoryItem(key, quality);
    if (!removed) return;
  }

  loadout.guns.push(makeLoadoutEntry(key, quality));

  if (engageTimer && selectedHangarShipId === currentShipId) {
    clearInterval(engageTimer);
    engageTimer = null;
  }

  renderHangar();
  showHangarSection("overview");
  tutorialEvent(countEquippedGuns(selectedHangarShipId) >= 2 ? "equippedSecondGun" : "equippedFirstGun");
  tutorialEvent("equippedItem");
  saveGame();
}

function removeGun(index) {
  const loadout = getShipLoadout(selectedHangarShipId);
  const [removed] = loadout.guns.splice(index, 1);

  if (removed) {
    const key = getEquipmentKey(removed);
    const quality = getEquipmentQuality(removed);

    if (quality === "standard") {
      ownedGuns[key] = (ownedGuns[key] || 0) + 1;
    } else {
      inventoryItems.push({
        id: `item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
        key,
        quality
      });
    }
  }

  if (engageTimer && selectedHangarShipId === currentShipId) {
    clearInterval(engageTimer);
    engageTimer = null;
  }

  renderHangar();
  showHangarSection("overview");
  saveGame();
}

function buyShip(shipId) {
  const ship = SHIPS[shipId];
  if (!ship || ownedShips.includes(shipId)) return;

  if (credits < ship.price) {
    alert("Not enough credits.");
    return;
  }

  const hadNoShip = !hasActiveShip();
  credits -= ship.price;
  ownedShips.push(shipId);
  selectedHangarShipId = shipId;
  selectedFleetShipId = shipId;
  selectedShipyardShipId = shipId;
  shipLoadouts[shipId] = { attachments: [], guns: [] };

  if (hadNoShip) {
    currentShipId = shipId;
    grantStarterShipKit();
    applyShipStats(true);
  }

  renderHangar();
  showHangarSection("shipyard");
  addHudToast(`${ship.name} added to your hangar.`);
  tutorialEvent(hadNoShip ? "boughtFirstShip" : "boughtShip");
  saveGame();
}

function equipShip(shipId) {
  if (!ownedShips.includes(shipId)) return;

  currentShipId = shipId;
  selectedHangarShipId = shipId;
  applyShipStats(true);
  renderHangar();
  saveGame();
}

/* Asteroid / combat */

/* Asteroid / combat */

function selectAsteroid(asteroidId) {
  const asteroid = getAsteroidById(asteroidId);

  if (!asteroid || !asteroid.alive || asteroid.node !== currentNode) return;

  selectedTarget = { type: "asteroid", id: asteroid.id };
  showTargetPanel();
  updateAsteroidUI();
  updateTargetPanel();
  updateObjectActionPanel();
}

function selectHostileBot(botId) {
  const bot = getHostileBotById(botId);

  if (!bot || !bot.alive || bot.node !== currentNode) return;

  selectedTarget = { type: "hostileBot", id: bot.id };
  showTargetPanel();
  updateAsteroidUI();
  updateTargetPanel();
  updateObjectActionPanel();

  if (tutorialState?.active && getCurrentTutorialStep()?.id === "destroy-bot") {
    setTimeout(renderStarterTutorial, 40);
  }
}

function engageTarget() {
  let target = getSelectedTargetEntity();

  if (!target || !target.alive || target.node !== currentNode) {
    target = getVisibleTargets()[0];
    if (target) {
      selectedTarget = {
        type: getTargetTypeFromEntity(target),
        id: target.id
      };
    }
  }

  if (!target || !target.alive || target.node !== currentNode) return;
  if (engageTimer) return;

  engagedTarget = {
    type: getTargetTypeFromEntity(target),
    id: target.id
  };

  updateAsteroidUI();
  performAttackCycle();
  engageTimer = setInterval(performAttackCycle, getEquippedWeapon().speed);
  updateTargetPanel();
}

function disengageTarget(keepTarget = false) {
  if (engageTimer) {
    clearInterval(engageTimer);
    engageTimer = null;
  }

  engagedTarget = null;

  if (!keepTarget) {
    selectedTarget = null;
  }

  updateAsteroidUI();
  updateTargetPanel();
}

function pulseLaserBurstToTarget(target) {
  const layer = document.getElementById("laserLayer");
  const spaceScreen = document.getElementById("spaceScreen");

  if (!layer || !spaceScreen || !target) return;

  const screenRect = spaceScreen.getBoundingClientRect();

  const startX = 285;
  const startY = screenRect.height - 105;

  const endX = (target.x / 100) * screenRect.width;
  const endY = (target.y / 100) * screenRect.height;

  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;

  const makeBeam = (offsetY = 0, delay = 0) => {
    const beam = document.createElement("div");
    beam.className = "laser-burst";
    beam.style.left = `${startX}px`;
    beam.style.top = `${startY + offsetY}px`;
    beam.style.width = `${length}px`;
    beam.style.transform = `rotate(${angle}deg)`;
    beam.style.animationDelay = `${delay}ms`;
    layer.appendChild(beam);

    setTimeout(() => beam.remove(), 450);
  };

  makeBeam(-4, 0);
  makeBeam(4, 35);
}

function incomingLaserBurstFromBot(bot, delay = 0) {
  const layer = document.getElementById("laserLayer");
  const spaceScreen = document.getElementById("spaceScreen");

  if (!layer || !spaceScreen || !bot) return;

  const screenRect = spaceScreen.getBoundingClientRect();

  const startX = (bot.x / 100) * screenRect.width;
  const startY = (bot.y / 100) * screenRect.height;

  // Aim at the pilot/camera position, not the ship icon.
  const endX = screenRect.width * (0.48 + Math.random() * 0.04);
  const endY = screenRect.height * (0.86 + Math.random() * 0.08);

  const dx = endX - startX;
  const dy = endY - startY;
  const length = Math.sqrt(dx * dx + dy * dy);
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;

  const beam = document.createElement("div");
  beam.className = "laser-burst enemy-incoming-laser";
  beam.style.left = `${startX}px`;
  beam.style.top = `${startY}px`;
  beam.style.width = `${length}px`;
  beam.style.transform = `rotate(${angle}deg)`;
  beam.style.animationDelay = `${delay}ms`;
  layer.appendChild(beam);

  setTimeout(() => beam.remove(), 560 + delay);
}

function showIncomingHitFlash() {
  const spaceScreen = document.getElementById("spaceScreen");
  const shipPanel = document.querySelector(".ship-display-panel");
  const statPanel = document.querySelector(".vertical-stats");

  if (spaceScreen) {
    spaceScreen.classList.add("incoming-hit-flash");
    setTimeout(() => spaceScreen.classList.remove("incoming-hit-flash"), 360);
  }

  [shipPanel, statPanel].forEach(panel => {
    if (!panel) return;
    panel.classList.add("hud-hit-flash");
    setTimeout(() => panel.classList.remove("hud-hit-flash"), 360);
  });
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

function performAttackCycle() {
  const target = getEngagedTargetEntity();

  if (!target || !target.alive || target.node !== currentNode) {
    disengageTarget(true);
    return;
  }

  pulseLaserBurstToTarget(target);
  playPlayerLaserPulse();
  target.hp = Math.max(0, target.hp - getEquippedWeapon().damage);

  if (target.hp <= 0) {
    showExplosionAtTarget(target);
    target.alive = false;
    const destroyedType = engagedTarget?.type;

    if (destroyedType === "hostileBot") {
      const itemDrops = generateBotLootItems();
      if (itemDrops.length) {
        inventoryItems.push(...itemDrops);
        addHudToast(`${getPilotName()} destroyed ${target.name}. Loot secured: ${summarizeInventoryItems(itemDrops)}.`);
      } else {
        addHudToast(`${getPilotName()} destroyed ${target.name}. No equipment recovered.`);
      }
      trackBountyBotKill(target);
      tutorialEvent("destroyedBountyBot");
      awardCombatXpFromBot(target);
      scheduleHostileBotRespawn(target.id);
    } else {
      const dropSummary = addLootToNode(currentNode, generateLootFromAsteroid(currentNode));
      addHudToast(`${getPilotName()} destroyed ${target.name}. Dropped ${dropSummary}.`);
      scheduleAsteroidRespawn();
    }

    disengageTarget(true);
    autoCollapseTargetPanel();
  }

  updateAsteroidUI();
  updateTargetPanel();
  saveGame();
}

function asteroidVisibleInCurrentNode(asteroid) {
  return asteroid && asteroid.alive && asteroid.node === currentNode;
}

function ensureActiveAsteroids() {
  if (!Array.isArray(asteroids)) {
    asteroids = [];
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

  const btn = document.createElement("button");
  btn.className = `${options.className || "asteroid-target"} visible`;

  if (selectedTarget?.id === target.id) {
    btn.classList.add("selected");
  }

  if (engagedTarget?.id === target.id) {
    btn.classList.add("engaged");
  }

  if (options.isHostileBot) {
    btn.classList.add(...getBotDirectionClass(target).split(" "));
  }

  btn.style.left = `${target.x}%`;
  btn.style.top = `${target.y}%`;
  btn.style.transform = "translate(-50%, -50%)";
  btn.onclick = options.onClick;
  btn.setAttribute("aria-label", target.name);

  const hpPct = Math.max(0, (target.hp / target.maxHp) * 100);

  btn.innerHTML = `
    <img src="${options.imageSrc}" alt="${target.name}">
    <div class="asteroid-hp-mini"><span style="width:${hpPct}%"></span></div>
  `;

  field.appendChild(btn);
}

function updateAsteroidUI() {
  ensureActiveAsteroids();
  ensureActiveHostileBots();

  const field = document.getElementById("asteroidField");
  if (!field) return;

  field.innerHTML = "";

  const visibleBots = hostileBots.filter(bot => bot.alive && bot.node === currentNode);
  const visibleAsteroids = asteroids.filter(asteroid => asteroid.alive && asteroid.node === currentNode);

  separateVisibleTargets([...visibleBots, ...visibleAsteroids]);

  visibleBots.forEach(bot => {
    renderTargetButton(bot, {
      className: "asteroid-target enemy-bot-target",
      imageSrc: bot.image || MANTA_BOT_ASSET,
      isHostileBot: true,
      onClick: () => selectHostileBot(bot.id)
    });
  });

  visibleAsteroids.forEach(asteroid => {
    renderTargetButton(asteroid, {
      className: "asteroid-target",
      imageSrc: "glowing_asteroid_with_cyan_veins.png",
      onClick: () => selectAsteroid(asteroid.id)
    });
  });
}

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

function generateLootFromAsteroid(nodeName) {
  const minerals = nodeMineralPools[nodeName] || ["Iron"];
  const drops = {};

  minerals.forEach((mineral, index) => {
    const rarity = commodityInfo[mineral]?.rarity || "Common";
    const include = index === 0 || Math.random() > 0.42;

    if (!include) return;

    if (rarity === "Exotic") {
      drops[mineral] = Math.floor(Math.random() * 4) + 2;
    } else if (rarity === "Rare") {
      drops[mineral] = Math.floor(Math.random() * 7) + 4;
    } else if (rarity === "Industrial") {
      drops[mineral] = Math.floor(Math.random() * 13) + 8;
    } else {
      drops[mineral] = Math.floor(Math.random() * 19) + 18;
    }
  });

  if (!Object.keys(drops).length) {
    const fallbackMineral = minerals[0] || "Iron";
    drops[fallbackMineral] = Math.floor(Math.random() * 19) + 18;
  }

  return drops;
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
  setTimeout(() => {
    respawnAsteroid();
    saveGame();
  }, ASTEROID_RESPAWN_MS);
}

function scheduleHostileBotRespawn(botId) {
  setTimeout(() => {
    respawnHostileBot(botId);
    saveGame();
  }, HOSTILE_BOT_RESPAWN_MS);
}

function respawnAsteroid() {
  const deadAsteroids = asteroids.filter(asteroid => !asteroid.alive);
  const asteroid = deadAsteroids[0];

  if (!asteroid) return;

  const spaceNodes = Object.keys(sectorNodes).filter(name => sectorNodes[name].type === "space");
  asteroid.node = spaceNodes[Math.floor(Math.random() * spaceNodes.length)];
  asteroid.maxHp = ASTEROID_BASE_HP + Math.floor(Math.random() * 25);
  asteroid.hp = asteroid.maxHp;
  asteroid.alive = true;
  asteroid.x = Math.floor(Math.random() * 72) + 12;
  asteroid.y = Math.floor(Math.random() * 45) + 12;

  updateAsteroidUI();
  updateTargetPanel();
}

function respawnHostileBot(botId) {
  ensureActiveHostileBots();

  const bot = hostileBots.find(item => item.id === botId) || hostileBots.find(item => !item.alive);
  if (!bot) return;

  const spaceNodes = getHostileBotNodes();
  bot.node = spaceNodes[Math.floor(Math.random() * spaceNodes.length)];
  bot.maxHp = HOSTILE_BOT_BASE_HP;
  bot.hp = bot.maxHp;
  bot.alive = true;
  bot.x = Math.floor(Math.random() * 52) + 34;
  bot.y = Math.floor(Math.random() * 34) + 18;
  bot.image = MANTA_BOT_ASSET;

  updateAsteroidUI();
  updateTargetPanel();
}

function moveHostileBotsBetweenNodes() {
  ensureActiveHostileBots();

  hostileBots.forEach(bot => {
    if (!bot.alive) return;

    const currentLinks = sectorNodes[bot.node]?.connects || [];
    const spaceLinks = currentLinks.filter(name => sectorNodes[name]?.type === "space" && sectorNodes[name]?.danger === "hostile");
    const fallbackSpaceNodes = getHostileBotNodes();
    const options = spaceLinks.length ? spaceLinks : fallbackSpaceNodes.filter(name => name !== bot.node);

    if (!options.length) return;

    const botIsEngaged = engagedTarget?.type === "hostileBot" && engagedTarget.id === bot.id && engageTimer;
    if (botIsEngaged && bot.node === currentNode) return;

    const previousNode = bot.node;
    bot.node = options[Math.floor(Math.random() * options.length)];
    bot.x = Math.floor(Math.random() * 52) + 34;
    bot.y = Math.floor(Math.random() * 34) + 18;

    if (engagedTarget?.type === "hostileBot" && engagedTarget.id === bot.id && bot.node !== currentNode) {
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

  botMovementTimer = setInterval(() => {
    moveHostileBotsBetweenNodes();
  }, HOSTILE_BOT_MOVE_MS);
}

function hostileBotAttackCycle() {
  const attackers = getVisibleHostileBots();
  if (!attackers.length) return;

  let totalDamage = 0;

  speakWarning();
  triggerWarningBanner("WARNING");

  attackers.forEach(bot => {
    markBotFacingPlayer(bot);
    totalDamage += HOSTILE_BOT_DAMAGE;
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

  botAttackTimer = setInterval(() => {
    hostileBotAttackCycle();
  }, HOSTILE_BOT_ATTACK_MS);
}

function maybeMoveAsteroid() {
  asteroids.forEach(asteroid => {
    if (!asteroid.alive) return;
    if (Math.random() > 0.5) return;

    const currentLinks = sectorNodes[asteroid.node]?.connects || [];
    const spaceLinks = currentLinks.filter(name => sectorNodes[name]?.type === "space");
    const fallbackSpaceNodes = Object.keys(sectorNodes).filter(name => sectorNodes[name].type === "space");
    const options = spaceLinks.length ? spaceLinks : fallbackSpaceNodes.filter(name => name !== asteroid.node);

    if (!options.length) return;

    asteroid.node = options[Math.floor(Math.random() * options.length)];
    asteroid.x = Math.floor(Math.random() * 46) + 43;
    asteroid.y = Math.floor(Math.random() * 38) + 18;
  });
}

function clearStationVaultForShipyardIfNeeded() {
  if (localStorage.getItem(STORAGE_VAULT_RESET_KEY) === "true") return false;

  inventoryItems = [];
  Object.keys(ownedAttachments || {}).forEach(key => { ownedAttachments[key] = 0; });
  Object.keys(ownedGuns || {}).forEach(key => { ownedGuns[key] = 0; });
  selectedVaultGroupKey = null;
  localStorage.setItem(STORAGE_VAULT_RESET_KEY, "true");
  return true;
}

/* Save / load */

function saveGame() {
  localStorage.setItem(STORAGE_GAME_KEY, JSON.stringify({
    credits,
    cargo,
    cargoCostBasis,
    currentNode,
    lastPlanetNode,
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
  }));
}

function loadGame() {
  const saved = JSON.parse(localStorage.getItem(STORAGE_GAME_KEY));
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
  try {
    const parsed = JSON.parse(localStorage.getItem(TUTORIAL_STORAGE_KEY) || "{}");
    return {
      active: Boolean(parsed.active),
      completed: Boolean(parsed.completed),
      stepIndex: Math.max(0, Number(parsed.stepIndex || 0)),
      lastStartedAt: parsed.lastStartedAt || null
    };
  } catch {
    return { active: false, completed: false, stepIndex: 0, lastStartedAt: null };
  }
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
  if (label) label.textContent = `Starter Pilot Programme · ${Math.min(tutorialState.stepIndex + 1, STARTER_TUTORIAL_STEPS.length)} / ${STARTER_TUTORIAL_STEPS.length}`;
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
}

function renderPilotProfileIfActive() {
  const screen = document.getElementById("pilotProfileScreen");
  if (screen?.classList.contains("active")) renderPilotProfile();
}

window.addEventListener("resize", () => {
  if (tutorialState.active) renderStarterTutorial();
});

