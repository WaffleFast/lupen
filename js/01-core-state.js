const STORAGE_ACCOUNT_KEY = "sectorOneAccount";
const STORAGE_GAME_KEY = "lupenGameState";
const STORAGE_VAULT_RESET_KEY = "lupenVaultClearedForIntegratedHangarV2";
const SAVE_SCHEMA_ID = "lupen-single-player-save";
const SAVE_VERSION = 3;
const SAVE_EXPORT_VERSION = 1;

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

  "Upper Apex": { type: "space", route: "combat", danger: "hostile", x: 50, y: 14, connects: ["Upper Arc West", "Upper Arc East"] },
  "Upper Arc West": { type: "space", route: "combat", danger: "hostile", x: 30, y: 20.5, connects: ["Upper Apex", "Upper Mid West A", "Upper Mid West B"] },
  "Upper Arc East": { type: "space", route: "combat", danger: "hostile", x: 70, y: 20.5, connects: ["Upper Apex", "Upper Mid East B", "Upper Mid East A"] },
  "Upper Mid West A": { type: "space", route: "combat", danger: "hostile", x: 18, y: 28, connects: ["Upper Arc West", "Upper Lane West A", "Upper Lane West B"] },
  "Upper Mid West B": { type: "space", route: "combat", danger: "hostile", x: 40, y: 28, connects: ["Upper Arc West", "Upper Lane West B", "Upper Lane Core West"] },
  "Upper Mid East B": { type: "space", route: "combat", danger: "hostile", x: 60, y: 28, connects: ["Upper Arc East", "Upper Lane Core East", "Upper Lane East B"] },
  "Upper Mid East A": { type: "space", route: "combat", danger: "hostile", x: 82, y: 28, connects: ["Upper Arc East", "Upper Lane East B", "Upper Lane East A"] },
  "Upper Lane West A": { type: "space", route: "combat", danger: "hostile", x: 10, y: 36.5, connects: ["Upper Mid West A", "Upper Gate West"] },
  "Upper Lane West B": { type: "space", route: "combat", danger: "hostile", x: 26, y: 36.5, connects: ["Upper Mid West A", "Upper Mid West B", "Upper Gate West", "Upper Gate Core"] },
  "Upper Lane Core West": { type: "space", route: "combat", danger: "hostile", x: 46, y: 36.5, connects: ["Upper Mid West B", "Upper Gate Core"] },
  "Upper Lane Core East": { type: "space", route: "combat", danger: "hostile", x: 54, y: 36.5, connects: ["Upper Mid East B", "Upper Gate Core"] },
  "Upper Lane East B": { type: "space", route: "combat", danger: "hostile", x: 74, y: 36.5, connects: ["Upper Mid East B", "Upper Mid East A", "Upper Gate Core", "Upper Gate East"] },
  "Upper Lane East A": { type: "space", route: "combat", danger: "hostile", x: 90, y: 36.5, connects: ["Upper Mid East A", "Upper Gate East"] },
  "Upper Gate West": { type: "space", route: "combat", danger: "hostile", x: 18, y: 43, connects: ["Upper Lane West A", "Upper Lane West B", "Virella"] },
  "Upper Gate Core": { type: "space", route: "combat", danger: "hostile", x: 50, y: 43, connects: ["Upper Lane West B", "Upper Lane Core West", "Upper Lane Core East", "Upper Lane East B", "Asteron Prime"] },
  "Upper Gate East": { type: "space", route: "combat", danger: "hostile", x: 82, y: 43, connects: ["Upper Lane East B", "Upper Lane East A", "Nyxara"] },

  "Lower Apex": { type: "space", route: "combat", danger: "hostile", x: 50, y: 86, connects: ["Lower Arc West", "Lower Arc East"] },
  "Lower Arc West": { type: "space", route: "combat", danger: "hostile", x: 30, y: 79.5, connects: ["Lower Apex", "Lower Mid West A", "Lower Mid West B"] },
  "Lower Arc East": { type: "space", route: "combat", danger: "hostile", x: 70, y: 79.5, connects: ["Lower Apex", "Lower Mid East B", "Lower Mid East A"] },
  "Lower Mid West A": { type: "space", route: "combat", danger: "hostile", x: 18, y: 72, connects: ["Lower Arc West", "Lower Lane West A", "Lower Lane West B"] },
  "Lower Mid West B": { type: "space", route: "combat", danger: "hostile", x: 40, y: 72, connects: ["Lower Arc West", "Lower Lane West B", "Lower Lane Core West"] },
  "Lower Mid East B": { type: "space", route: "combat", danger: "hostile", x: 60, y: 72, connects: ["Lower Arc East", "Lower Lane Core East", "Lower Lane East B"] },
  "Lower Mid East A": { type: "space", route: "combat", danger: "hostile", x: 82, y: 72, connects: ["Lower Arc East", "Lower Lane East B", "Lower Lane East A"] },
  "Lower Lane West A": { type: "space", route: "combat", danger: "hostile", x: 10, y: 63.5, connects: ["Lower Mid West A", "Lower Gate West"] },
  "Lower Lane West B": { type: "space", route: "combat", danger: "hostile", x: 26, y: 63.5, connects: ["Lower Mid West A", "Lower Mid West B", "Lower Gate West", "Lower Gate Core"] },
  "Lower Lane Core West": { type: "space", route: "combat", danger: "hostile", x: 46, y: 63.5, connects: ["Lower Mid West B", "Lower Gate Core"] },
  "Lower Lane Core East": { type: "space", route: "combat", danger: "hostile", x: 54, y: 63.5, connects: ["Lower Mid East B", "Lower Gate Core"] },
  "Lower Lane East B": { type: "space", route: "combat", danger: "hostile", x: 74, y: 63.5, connects: ["Lower Mid East B", "Lower Mid East A", "Lower Gate Core", "Lower Gate East"] },
  "Lower Lane East A": { type: "space", route: "combat", danger: "hostile", x: 90, y: 63.5, connects: ["Lower Mid East A", "Lower Gate East"] },
  "Lower Gate West": { type: "space", route: "combat", danger: "hostile", x: 18, y: 57, connects: ["Lower Lane West A", "Lower Lane West B", "Virella"] },
  "Lower Gate Core": { type: "space", route: "combat", danger: "hostile", x: 50, y: 57, connects: ["Lower Lane West B", "Lower Lane Core West", "Lower Lane Core East", "Lower Lane East B", "Asteron Prime"] },
  "Lower Gate East": { type: "space", route: "combat", danger: "hostile", x: 82, y: 57, connects: ["Lower Lane East B", "Lower Lane East A", "Nyxara"] }
};

const sectorMapZones = [
  { name: "UPPER COMBAT ZONE", subtitle: "HOSTILE SPACE", x: 50, y: 7.4, tone: "combat" },
  { name: "LOWER COMBAT ZONE", subtitle: "HOSTILE SPACE", x: 50, y: 94, tone: "combat" }
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
      "Iron": 920,
      "Copper": 760,
      "Cobalt": 420,
      "Titanium": 360,
      "Crystal Shards": 260,
      "Xenon Gas": 190,
      "Iridium": 96,
      "Platinum": 72,
      "Uranium": 46,
      "Dark Matter Residue": 18
    },
    "Asteron Prime": {
      "Iron": 720,
      "Copper": 640,
      "Cobalt": 520,
      "Titanium": 470,
      "Crystal Shards": 340,
      "Xenon Gas": 230,
      "Iridium": 118,
      "Platinum": 82,
      "Uranium": 64,
      "Dark Matter Residue": 22
    },
    "Nyxara": {
      "Iron": 520,
      "Copper": 480,
      "Cobalt": 390,
      "Titanium": 330,
      "Crystal Shards": 230,
      "Xenon Gas": 310,
      "Iridium": 135,
      "Platinum": 105,
      "Uranium": 84,
      "Dark Matter Residue": 28
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

function safeParseLocalStorage(key, fallback = null) {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;

  try {
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`Ignoring corrupted localStorage entry: ${key}`, error);
    localStorage.setItem(`${key}.corrupt.${Date.now()}`, raw);
    localStorage.removeItem(key);
    return fallback;
  }
}

function migrateSavedGame(saved) {
  if (!saved || typeof saved !== "object") return null;

  const migrated = { ...saved };
  const fromVersion = Number(migrated.saveVersion || 1);

  if (!sectorNodes[migrated.currentNode]) {
    migrated.currentNode = sectorNodes[migrated.lastPlanetNode]
      ? migrated.lastPlanetNode
      : (sectorNodes[migrated.homePlanet] ? migrated.homePlanet : "Asteron Prime");
  }

  if (!sectorNodes[migrated.homePlanet] || sectorNodes[migrated.homePlanet].type !== "planet") {
    migrated.homePlanet = "Asteron Prime";
  }

  if (!sectorNodes[migrated.lastPlanetNode] || sectorNodes[migrated.lastPlanetNode].type !== "planet") {
    migrated.lastPlanetNode = sectorNodes[migrated.currentNode]?.type === "planet"
      ? migrated.currentNode
      : migrated.homePlanet;
  }

  migrated.upgradeMaterials = normalizeUpgradeMaterials(migrated.upgradeMaterials);

  migrated.saveVersion = SAVE_VERSION;
  migrated.migratedFromVersion = fromVersion === SAVE_VERSION ? migrated.migratedFromVersion : fromVersion;
  return migrated;
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
    armor: 12,
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
    armor: 18,
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
    armor: 10,
    cargo: 100,
    jumpRecharge: 15,
    evasion: 0.28,
    gunSlots: 3,
    attachmentSlots: 3
  },
  hermesCourier: {
    id: "hermesCourier",
    name: "Hermes Courier",
    manufacturer: "Asteron Skunkworks",
    roleSubtitle: "Fast Courier Hull",
    description: "A light courier vessel tuned for quick jump recovery, evasive routing and compact high-value hauling.",
    image: "assets/ships/hermes-courier.png",
    price: 18000,
    hull: 850,
    shield: 115,
    armor: 8,
    cargo: 190,
    jumpRecharge: 18,
    evasion: 34,
    gunSlots: 2,
    attachmentSlots: 3
  },
  athenaSentinel: {
    id: "athenaSentinel",
    name: "Athena Sentinel",
    manufacturer: "Asteron Skunkworks",
    roleSubtitle: "Shield / Utility Hull",
    description: "A disciplined sentinel platform with reinforced shields, generous equipment capacity and steady cargo handling.",
    image: "assets/ships/athena-sentinel.png",
    price: 26000,
    hull: 1450,
    shield: 220,
    armor: 20,
    cargo: 140,
    jumpRecharge: 10,
    evasion: 14,
    gunSlots: 2,
    attachmentSlots: 4
  },
  aresVindicator: {
    id: "aresVindicator",
    name: "Ares Vindicator",
    manufacturer: "Asteron Skunkworks",
    roleSubtitle: "Heavy Combat Hull",
    description: "A weapons-forward combat hull with extra gun mounts, strong plating and enough shield capacity for hostile lanes.",
    image: "assets/ships/ares-vindicator.png",
    price: 34000,
    hull: 1200,
    shield: 170,
    armor: 25,
    cargo: 90,
    jumpRecharge: 12,
    evasion: 20,
    gunSlots: 4,
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

const GUNS = Object.fromEntries(
  Object.keys(WEAPON_FAMILIES || {}).map(familyId => [familyId, createWeaponCatalogDefinition(familyId)])
);

// Legacy weapon keys stay resolvable for old saves and existing localStorage loadouts.
GUNS.heavyPulseLaser = { ...createWeaponCatalogDefinition("heavyLance"), key: "heavyPulseLaser", familyId: "heavyLance", hiddenFromStore: true };
GUNS.pulseRelay = { ...createWeaponCatalogDefinition("pulseLaser"), key: "pulseRelay", familyId: "pulseLaser", name: "Pulse Relay", hiddenFromStore: true };
GUNS.targetingArray = { ...createWeaponCatalogDefinition("voidRail"), key: "targetingArray", familyId: "voidRail", name: "Targeting Array", hiddenFromStore: true };

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
    icon: "assets/bounties/raider-sweep.png",
    threat: "Standard",
    contractType: "Sweep",
    lootLabel: "Rare chance",
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
    icon: "assets/bounties/station-defence.png",
    threat: "Defence",
    contractType: "Patrol",
    lootLabel: "Rare chance",
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
    icon: "assets/bounties/manta-intercept.png",
    threat: "High value",
    contractType: "Intercept",
    lootLabel: "Better chance",
    targetArea: "anyHostile",
    targetLabel: "Any Hostile Zone",
    killsRequired: 2,
    reward: 1800,
    lootChance: 0.28,
    description: "Intercept roaming hostile bots anywhere in combat space."
  }
];

function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNextDailyResetAt() {
  const reset = new Date();
  reset.setHours(24, 0, 0, 0);
  return reset;
}

function getDailyResetSeconds() {
  return Math.max(0, Math.ceil((getNextDailyResetAt().getTime() - Date.now()) / 1000));
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

const ITEM_QUALITY_ORDER = Object.keys(ITEM_RARITIES || { standard: true, refined: true, advanced: true, elite: true, legendary: true, godlike: true });
const ITEM_QUALITY_LABELS = Object.fromEntries(
  Object.entries(ITEM_RARITIES || {}).map(([id, rarity]) => [id, rarity.name])
);
ITEM_QUALITY_LABELS.unique = "Refined";
const LUPEN_CORE_QUALITY = "core";
const FUTURE_ASTEROID_LUPEN_CORE_DROP_CHANCE = 1 / 5000;
const MAX_ITEM_LEVEL = 15;

const upgradeMaterialDefinitions = {
  weaponParts: {
    name: "Weapon Upgrade Parts",
    shortLabel: "WP",
    icon: "assets/items/weapon-upgrade-parts.svg",
    description: "Common weapon components used to raise gun levels."
  },
  equipmentModules: {
    name: "Equipment Upgrade Modules",
    shortLabel: "EM",
    icon: "assets/items/equipment-upgrade-modules.svg",
    description: "Modular systems used to tune ship equipment."
  }
};

function createDefaultUpgradeMaterials() {
  return {
    weaponParts: 260,
    equipmentModules: 120
  };
}

function normalizeUpgradeMaterials(materials) {
  const defaults = createDefaultUpgradeMaterials();
  const safe = materials && typeof materials === "object" ? materials : {};
  return Object.fromEntries(
    Object.keys(defaults).map(key => [key, Math.max(0, Math.floor(Number(safe[key] ?? defaults[key] ?? 0)))])
  );
}

const itemDefinitions = {
  lupenCore: { name: "Lupen Core", shortLabel: "LC", category: "Core", icon: "assets/items/lupen-core.png", core: true, sellValue: 1500 },
  cargoPod: { name: "Cargo Pod", shortLabel: "CP", category: "Attachment", icon: "assets/attachments/cargo-pod.png", sellValue: 210 },
  hullBooster: { name: "Hull Booster", shortLabel: "HB", category: "Attachment", icon: "assets/attachments/hull-booster.png", sellValue: 240 },
  jumpDrive: { name: "Jump Drive", shortLabel: "JD", category: "Attachment", icon: "assets/attachments/jump-drive.png", sellValue: 260 },
  shieldBooster: { name: "Shield Booster", shortLabel: "SB", category: "Attachment", icon: "assets/attachments/shield-booster.png", sellValue: 250 },
  evasionMatrix: { name: "Evasion Matrix", shortLabel: "EM", category: "Attachment", icon: "assets/attachments/evasion-matrix.png", sellValue: 280 },
  /* legacy item keys kept for old local saves */
  shieldMatrix: { name: "Shield Matrix", shortLabel: "SM", category: "Attachment", icon: "assets/attachments/shield-booster.png", sellValue: 230 },
  hullPlating: { name: "Hull Plating", shortLabel: "HP", category: "Attachment", icon: "assets/attachments/hull-booster.png", sellValue: 220 },
  pulseRelay: { name: "Pulse Relay", shortLabel: "PR", category: "Weapon", icon: "assets/weapons/pulse-laser.png", sellValue: 170 },
  targetingArray: { name: "Targeting Array", shortLabel: "TA", category: "Weapon", icon: "assets/weapons/void-rail.png", sellValue: 330 }
};

Object.entries(GUNS).forEach(([key, gun]) => {
  if (!gun || itemDefinitions[key]) return;
  itemDefinitions[key] = {
    name: gun.name,
    shortLabel: gun.name.split(" ").map(part => part[0]).join("").slice(0, 3).toUpperCase(),
    category: "Weapon",
    icon: gun.image,
    sellValue: Math.max(150, Math.round((gun.price || 400) * 0.46))
  };
});

const botDropPool = ["cargoPod", "hullBooster", "jumpDrive", "shieldBooster", "evasionMatrix", "pulseLaser", "repeater", "ionBlaster", "meltCannon", "ripperGun", "heavyLance", "voidRail"];

let inventoryItems = [];
let upgradeMaterials = createDefaultUpgradeMaterials();
let storeFilter = "all";
let selectedStoreItemId = null;
let selectedStoreQuality = "standard";
let storeDailyPurchases = {};
let hangarVaultFilter = "all";
let selectedVaultGroupKey = null;
let selectedForgeItemId = null;
let forgeUpgradeMode = "quality";
let forgeMaterialAllocations = {};
let forgeUseLupenCore = false;
let forgeAnimating = false;
let forgeInventoryPickerOpen = false;
let forgeInventoryPickerFilter = "all";

function titleCaseQuality(value) {
  if (value === LUPEN_CORE_QUALITY) return "Lupen Core";
  const normalized = typeof normalizeRarityId === "function" ? normalizeRarityId(value) : value;
  return ITEM_QUALITY_LABELS[normalized] || "Standard";
}

function pickWeightedQuality() {
  const roll = Math.random();
  if (roll < 0.62) return "standard";
  if (roll < 0.87) return "refined";
  if (roll < 0.968) return "advanced";
  if (roll < 0.996) return "legendary";
  return "godlike";
}

function pickBotLootKey() {
  const roll = Math.random();
  // Lupen Cores are reserved for future asteroid/material zones and should be extraordinarily rare there.
  if (roll < 0.10) return "heavyLance";
  if (roll < 0.17) return "ripperGun";
  if (roll < 0.38) return "shieldBooster";
  if (roll < 0.52) return "evasionMatrix";
  if (roll < 0.64) return "jumpDrive";
  if (roll < 0.76) return "hullBooster";
  if (roll < 0.88) return "cargoPod";
  return "pulseLaser";
}

function pickItemQuality(itemKey) {
  return itemKey === "lupenCore" ? LUPEN_CORE_QUALITY : pickWeightedQuality();
}

function createInventoryDrop(itemKey, forcedQuality = null) {
  return {
    id: `item-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    key: itemKey,
    quality: itemKey === "lupenCore" ? LUPEN_CORE_QUALITY : (forcedQuality || pickItemQuality(itemKey)),
    level: itemKey === "lupenCore" ? undefined : 1
  };
}

function pickStarterMapDropQuality() {
  const roll = Math.random();
  if (roll < 0.09) return "standard";
  if (roll < 0.115) return "refined";
  if (roll < 0.12) return "advanced";
  return null;
}

function generateBotLootItems() {
  // Map 1 bot equipment drops are deliberately rare.
  // Standard and Refined are possible, Advanced is very slim, Legendary/Godlike are not available here.
  const quality = pickStarterMapDropQuality();
  if (!quality) return [];

  return [createInventoryDrop(pickBotLootKey(), quality)];
}

function normalizeInventoryItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => {
      if (!item || !itemDefinitions[item.key]) return null;
      const quality = item.key === "lupenCore"
        ? LUPEN_CORE_QUALITY
        : (typeof normalizeRarityId === "function" ? normalizeRarityId(item.quality) : (ITEM_QUALITY_ORDER.includes(item.quality) ? item.quality : "standard"));
      return {
        id: item.id || `item-restored-${index}-${Date.now()}`,
        key: item.key,
        quality,
        level: item.key === "lupenCore" ? undefined : Math.min(MAX_ITEM_LEVEL, Math.max(1, Math.floor(Number(item.level || 1))))
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
    const displayQuality = item.key === "lupenCore" ? LUPEN_CORE_QUALITY : item.quality;
    const groupKey = `${item.key}__${displayQuality}`;
    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        key: item.key,
        quality: displayQuality,
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
  refined: 2,
  unique: 2,
  advanced: 3.2,
  elite: 5,
  legendary: 15,
  godlike: 45
};

const ITEM_QUALITY_BUY_MULTIPLIERS = {
  standard: 1,
  refined: 2.5,
  unique: 2.5,
  advanced: 5.2,
  elite: 9,
  legendary: 28,
  godlike: 90
};


const ITEM_QUALITY_STAT_MULTIPLIERS = {
  ...Object.fromEntries(Object.entries(ITEM_RARITIES || {}).map(([id, rarity]) => [id, rarity.statMultiplier])),
  unique: ITEM_RARITIES?.refined?.statMultiplier || 1.08
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
let armor = 0;
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
const HOSTILE_BOT_BASE_HP = 240;
const HOSTILE_BOT_BASE_SHIELD = 60;
const HOSTILE_BOT_BASE_ARMOR = 12;
const HOSTILE_BOT_ATTACK_MS = 3000;
const HOSTILE_BOT_DAMAGE = 4;
const HULL_REPAIR_COST_PER_POINT = 2;
const DISABLED_CARGO_LOSS_RATE = 0.3;
const MANTA_BOT_ASSET = "assets/ships/manta-bot.png";
const HOSTILE_BOT_ATTACK_FACE_MS = 1200;
const HOSTILE_BOT_LASER_DELAY_MS = 260;
const SECTOR_SCAN_DURATION_MS = 5000;
const SECTOR_SCAN_COOLDOWNS_MS = { ally: 2500, bot: 10000, enemy: 30000 };

let asteroids = createInitialAsteroids();
let hostileBots = createInitialHostileBots();
let botMovementTimer = null;
let botAttackTimer = null;
let sectorScanState = { activeUntil: 0, cooldownUntilByType: { ally: 0, bot: 0, enemy: 0 }, result: null };
let sectorScanTicker = null;

let lootByNode = {};

function createInitialAsteroids() {
  // Asteroids are intentionally disabled in Map 1.
  // They will return in later maps as the source of weapon/equipment parts and rare Lupen Core progression.
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
      shield: HOSTILE_BOT_BASE_SHIELD,
      shieldMax: HOSTILE_BOT_BASE_SHIELD,
      armor: HOSTILE_BOT_BASE_ARMOR,
      hull: HOSTILE_BOT_BASE_HP,
      hullMax: HOSTILE_BOT_BASE_HP,
      hp: HOSTILE_BOT_BASE_SHIELD + HOSTILE_BOT_BASE_HP,
      maxHp: HOSTILE_BOT_BASE_SHIELD + HOSTILE_BOT_BASE_HP,
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

  if (typeof startBountyResetTimer === "function") {
    if (screenId === "bountyScreen") startBountyResetTimer();
    else stopBountyResetTimer();
  }

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

