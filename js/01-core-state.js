const STORAGE_ACCOUNT_KEY = "sectorOneAccount";
const STORAGE_GAME_KEY = "lupenGameState";
const STORAGE_VAULT_RESET_KEY = "lupenVaultClearedForIntegratedHangarV2";
const SAVE_SCHEMA_ID = "lupen-single-player-save";
const SAVE_VERSION = 4;
const SAVE_EXPORT_VERSION = 1;

const LEGACY_SHIP_ID_MAP = Object.freeze({
  lupenOrigin: "falcon",
  hermesCourier: "falcon",
  lupenHauler: "bison",
  hephaestusTrader: "bison",
  lupenStriker: "zeusExplorer",
  aresVindicator: "zeusExplorer",
  poseidonAggressor: "zeusExplorer",
  athenaSentinel: "monolith"
});

function migrateLegacyShipId(shipId) {
  const safeId = String(shipId || "");
  return LEGACY_SHIP_ID_MAP[safeId] || safeId;
}

function migrateShipIndexedState(record) {
  if (!record || typeof record !== "object" || Array.isArray(record)) return record;
  return Object.entries(record)
    .sort(([shipId]) => LEGACY_SHIP_ID_MAP[shipId] ? 1 : -1)
    .reduce((next, [shipId, value]) => {
      const migratedId = migrateLegacyShipId(shipId);
      if (migratedId && next[migratedId] === undefined) next[migratedId] = value;
      return next;
    }, {});
}

const mineralKeys = ["Iron", "Copper", "Cobalt", "Titanium", "Crystal Shards", "Xenon Gas", "Iridium", "Platinum", "Uranium", "Dark Matter Residue"];

const MAP_ONE_MARKET_PLANETS = ["Asteron Prime", "Virella", "Nyxara"];
const MAP_ONE_TRADE_RESOURCES = Object.freeze(["Iron", "Copper", "Cobalt"]);

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
    description: "Rare heavy metal used in precision drives and high-end armor."
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

Object.values(sectorNodes).forEach(node => {
  if (node.type === "space" && node.danger === "hostile" && Number(node.y) < 50) {
    node.zone = "upper";
    node.tags = Array.from(new Set([...(node.tags || []), "upper_combat_zone", "erebus_patrol_zone"]));
  } else if (node.type === "space" && node.danger === "hostile" && Number(node.y) > 50) {
    node.zone = "lower";
    node.tags = Array.from(new Set([...(node.tags || []), "lower_combat_zone", "asteroid_field"]));
  }
});

const NODE_ZONE_TYPES = Object.freeze({
  protected: "protected",
  contested: "contested"
});

function getNodeZoneType(nodeId = currentNode) {
  const node = sectorNodes[nodeId];
  if (!node) return NODE_ZONE_TYPES.protected;
  if (node.type === "planet") return NODE_ZONE_TYPES.protected;
  if (Number(node.y) > 50) return NODE_ZONE_TYPES.contested;
  return NODE_ZONE_TYPES.protected;
}

function isProtectedNode(nodeId = currentNode) {
  return getNodeZoneType(nodeId) === NODE_ZONE_TYPES.protected;
}

function isContestedNode(nodeId = currentNode) {
  return getNodeZoneType(nodeId) === NODE_ZONE_TYPES.contested;
}

function getCurrentNodeZoneType() {
  return getNodeZoneType(currentNode);
}

Object.entries(sectorNodes).forEach(([name, node]) => {
  node.pvpZoneType = getNodeZoneType(name);
});

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
    "Iron": 428,
    "Copper": 820,
    "Cobalt": 1684,
    "Titanium": 58,
    "Crystal Shards": 2112,
    "Xenon Gas": 92,
    "Iridium": 132,
    "Platinum": 170,
    "Uranium": 210,
    "Dark Matter Residue": 390
  },
  "Asteron Prime": {
    "Iron": 312,
    "Copper": 982,
    "Cobalt": 2340,
    "Titanium": 48,
    "Crystal Shards": 2520,
    "Xenon Gas": 82,
    "Iridium": 148,
    "Platinum": 190,
    "Uranium": 176,
    "Dark Matter Residue": 420
  },
  "Nyxara": {
    "Iron": 645,
    "Copper": 1845,
    "Cobalt": 1248,
    "Titanium": 72,
    "Crystal Shards": 2980,
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

function getNodeById(nodeId) {
  return sectorNodes[nodeId] ? { id: nodeId, ...sectorNodes[nodeId] } : null;
}

function getAllNodes() {
  return Object.keys(sectorNodes).map(getNodeById).filter(Boolean);
}

function isPlanetNode(nodeId) {
  const node = getNodeById(nodeId);
  return Boolean(node?.planetId || node?.type === "planet");
}

function isAllowedErebusBotNode(nodeId) {
  const node = getNodeById(nodeId);
  if (!node || isPlanetNode(nodeId)) return false;
  return Boolean(
    node.tags?.includes("upper_combat_zone") ||
    node.tags?.includes("erebus_patrol_zone") ||
    node.zone === "upper" ||
    (node.type === "space" && node.danger === "hostile" && Number(node.y) < 50)
  );
}

function getAllowedErebusBotNodeIds() {
  return Object.keys(sectorNodes).filter(isAllowedErebusBotNode);
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

  ["currentShipId", "selectedHangarShipId", "selectedFleetShipId", "selectedShipyardShipId"].forEach(key => {
    if (migrated[key]) migrated[key] = migrateLegacyShipId(migrated[key]);
  });
  if (Array.isArray(migrated.ownedShips)) {
    migrated.ownedShips = Array.from(new Set(migrated.ownedShips.map(migrateLegacyShipId).filter(Boolean)));
  }
  migrated.shipLoadouts = migrateShipIndexedState(migrated.shipLoadouts);
  migrated.shipConditions = migrateShipIndexedState(migrated.shipConditions);
  migrated.unlockedShipLines = Array.from(new Set(["pioneer", ...(Array.isArray(migrated.unlockedShipLines) ? migrated.unlockedShipLines : [])]));

  migrated.upgradeMaterials = normalizeUpgradeMaterials(migrated.upgradeMaterials);

  migrated.saveVersion = SAVE_VERSION;
  migrated.migratedFromVersion = fromVersion === SAVE_VERSION ? migrated.migratedFromVersion : fromVersion;
  return migrated;
}

const PIONEER_LINE_ID = "pioneer";
const SHIP_LINES = Object.freeze({
  pioneer: Object.freeze({
    id: PIONEER_LINE_ID,
    name: "Pioneer Line",
    manufacturer: "Lupen Foundry",
    description: "The dependable first-generation fleet issued to every new pilot. Its shared core architecture supports agile combat, freight, heavy assault and command roles.",
    unlockHint: "Plans issued automatically with every pilot profile.",
    shipIds: Object.freeze(["falcon", "zeusExplorer", "bison", "monolith"]),
    unlockedByDefault: true
  })
});

const STARTER_SHIP_ID = "falcon";
const SHIP_ASSET_MANIFEST = Object.freeze({
  falcon: Object.freeze({
    master: "assets/ships/pioneer-hunter/pioneer-hunter-master.webp",
    large: "assets/ships/pioneer-hunter/pioneer-hunter-large.webp",
    medium: "assets/ships/pioneer-hunter/pioneer-hunter-medium.webp",
    small: "assets/ships/pioneer-hunter/pioneer-hunter-small.webp"
  }),
  bison: Object.freeze({
    master: "assets/ships/pioneer-freighter/pioneer-freighter-master.webp",
    large: "assets/ships/pioneer-freighter/pioneer-freighter-large.webp",
    medium: "assets/ships/pioneer-freighter/pioneer-freighter-medium.webp",
    small: "assets/ships/pioneer-freighter/pioneer-freighter-small.webp"
  }),
  monolith: Object.freeze({
    master: "assets/ships/pioneer-moth/pioneer-moth-master.webp",
    large: "assets/ships/pioneer-moth/pioneer-moth-large.webp",
    medium: "assets/ships/pioneer-moth/pioneer-moth-medium.webp",
    small: "assets/ships/pioneer-moth/pioneer-moth-small.webp"
  }),
  zeusExplorer: Object.freeze({
    master: "assets/ships/pioneer-destroyer/pioneer-destroyer-master.webp?v=20260719-colour-match",
    large: "assets/ships/pioneer-destroyer/pioneer-destroyer-large.webp?v=20260719-colour-match",
    medium: "assets/ships/pioneer-destroyer/pioneer-destroyer-medium.webp?v=20260719-colour-match",
    small: "assets/ships/pioneer-destroyer/pioneer-destroyer-small.webp?v=20260719-colour-match"
  }),
  hephaestusTrader: Object.freeze({
    master: "assets/ships/champa-carrier/champa-carrier-master.webp",
    large: "assets/ships/champa-carrier/champa-carrier-large.webp",
    medium: "assets/ships/champa-carrier/champa-carrier-medium.webp",
    small: "assets/ships/champa-carrier/champa-carrier-small.webp"
  }),
  poseidonAggressor: Object.freeze({
    master: "assets/ships/silver-instinct/silver-instinct-master.webp",
    large: "assets/ships/silver-instinct/silver-instinct-large.webp",
    medium: "assets/ships/silver-instinct/silver-instinct-medium.webp",
    small: "assets/ships/silver-instinct/silver-instinct-small.webp"
  })
});
const SHIP_ASSET_SIZE_FALLBACKS = Object.freeze({
  master: Object.freeze(["master", "large", "medium", "small"]),
  large: Object.freeze(["large", "master", "medium", "small"]),
  medium: Object.freeze(["medium", "large", "small", "master"]),
  small: Object.freeze(["small", "medium", "large", "master"])
});

function getShipAsset(shipId, size = "medium") {
  const manifest = SHIP_ASSET_MANIFEST[shipId] || SHIP_ASSET_MANIFEST[STARTER_SHIP_ID] || {};
  const order = SHIP_ASSET_SIZE_FALLBACKS[size] || SHIP_ASSET_SIZE_FALLBACKS.medium;
  const path = order.map(key => manifest[key]).find(Boolean);
  return path || "assets/ships/pioneer-hunter/pioneer-hunter-medium.webp";
}

const SHIPS = {
  falcon: {
    id: "falcon",
    name: "Pioneer Hunter",
    manufacturer: "Lupen Foundry",
    lineId: PIONEER_LINE_ID,
    className: "Hunter",
    role: "Attacker / Interceptor",
    roleSubtitle: "Attacker / Interceptor",
    description: "The free starter hull for every new pilot: fast, evasive and flexible enough for early combat and trade runs.",
    image: getShipAsset("falcon", "medium"),
    assets: SHIP_ASSET_MANIFEST.falcon,
    price: 0,
    hull: 720,
    shield: 180,
    armor: 10,
    cargo: 150,
    jumpRecharge: 16,
    evasion: 18,
    gunSlots: 2,
    attachmentSlots: 2,
    defaultGun: "pulseLaser",
    defaultGuns: ["pulseLaser", "pulseLaser"]
  },
  bison: {
    id: "bison",
    name: "Pioneer Freighter",
    manufacturer: "Lupen Foundry",
    lineId: PIONEER_LINE_ID,
    className: "Freighter",
    role: "Freight / Trade",
    roleSubtitle: "Freight / Trade",
    description: "A cargo-focused branch hull with generous equipment capacity, durable plating and enough armament to survive contested routes.",
    image: getShipAsset("bison", "medium"),
    assets: SHIP_ASSET_MANIFEST.bison,
    price: 0,
    hull: 1300,
    shield: 135,
    armor: 18,
    cargo: 300,
    jumpRecharge: 10,
    evasion: 7,
    gunSlots: 2,
    attachmentSlots: 4
  },
  monolith: {
    id: "monolith",
    name: "Pioneer Moth",
    manufacturer: "Lupen Foundry",
    lineId: PIONEER_LINE_ID,
    className: "Moth",
    role: "Behemoth / Command",
    roleSubtitle: "Behemoth / Command",
    description: "The Pioneer Line flagship: a command hull with immense defences and extensive weapon and equipment capacity.",
    image: getShipAsset("monolith", "medium"),
    assets: SHIP_ASSET_MANIFEST.monolith,
    price: 0,
    hull: 1800,
    shield: 360,
    armor: 28,
    cargo: 220,
    jumpRecharge: 10,
    evasion: 6,
    gunSlots: 15,
    attachmentSlots: 15
  },
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
    attachmentSlots: 3,
    hiddenFromExchange: true,
    legacy: true
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
    attachmentSlots: 4,
    hiddenFromExchange: true,
    legacy: true
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
    attachmentSlots: 3,
    hiddenFromExchange: true,
    legacy: true
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
    attachmentSlots: 3,
    hiddenFromExchange: true,
    legacy: true
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
    attachmentSlots: 4,
    hiddenFromExchange: true,
    legacy: true
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
    attachmentSlots: 3,
    hiddenFromExchange: true,
    legacy: true
  },
  hephaestusTrader: {
    id: "hephaestusTrader",
    name: "Champa Carrier",
    manufacturer: "Asteron Freightworks",
    roleSubtitle: "Heavy Trade Hull",
    description: "A utility-rich carrier with big service tanks, six attachment slots and enough guns to discourage light raiders.",
    image: getShipAsset("hephaestusTrader", "medium"),
    assets: SHIP_ASSET_MANIFEST.hephaestusTrader,
    price: 34000,
    hull: 1650,
    shield: 180,
    armor: 22,
    cargo: 360,
    jumpRecharge: 8,
    evasion: 6,
    gunSlots: 2,
    attachmentSlots: 6,
    hiddenFromExchange: true,
    legacy: true
  },
  poseidonAggressor: {
    id: "poseidonAggressor",
    name: "Silver Instinct",
    manufacturer: "Asteron Skunkworks",
    roleSubtitle: "Assault / Control Hull",
    description: "A premium assault hull with five weapon mounts, sharp evasion and a lighter hold than the trade-focused ships.",
    image: getShipAsset("poseidonAggressor", "medium"),
    assets: SHIP_ASSET_MANIFEST.poseidonAggressor,
    price: 42000,
    hull: 1300,
    shield: 260,
    armor: 20,
    cargo: 120,
    jumpRecharge: 14,
    evasion: 22,
    gunSlots: 5,
    attachmentSlots: 4,
    hiddenFromExchange: true,
    legacy: true
  },
  zeusExplorer: {
    id: "zeusExplorer",
    name: "Pioneer Destroyer",
    manufacturer: "Lupen Foundry",
    lineId: PIONEER_LINE_ID,
    className: "Destroyer",
    role: "Combat / Assault",
    roleSubtitle: "Combat / Assault",
    description: "An armoured combat step beyond the Hunter, trading some speed and evasion for stronger shields, hull and hardpoint capacity.",
    image: getShipAsset("zeusExplorer", "medium"),
    assets: SHIP_ASSET_MANIFEST.zeusExplorer,
    price: 0,
    hull: 1250,
    shield: 240,
    armor: 20,
    cargo: 120,
    jumpRecharge: 13,
    evasion: 12,
    gunSlots: 4,
    attachmentSlots: 3
  }
};

const SHIP_UNLOCK_REQUIREMENTS = Object.freeze({
  falcon: Object.freeze({}),
  zeusExplorer: Object.freeze({}),
  bison: Object.freeze({}),
  monolith: Object.freeze({})
});

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

const EQUIPMENT_UNLOCK_REQUIREMENTS = Object.freeze({
  guns: Object.freeze({
    pulseLaser: Object.freeze({ combatLevel: 1 }),
    repeater: Object.freeze({ combatLevel: 2 }),
    ionBlaster: Object.freeze({ combatLevel: 2 }),
    ripperGun: Object.freeze({ combatLevel: 2 }),
    meltCannon: Object.freeze({ combatLevel: 3 }),
    heavyLance: Object.freeze({ combatLevel: 3 }),
    voidRail: Object.freeze({ combatLevel: 4 }),
    heavyPulseLaser: Object.freeze({ combatLevel: 3 }),
    pulseRelay: Object.freeze({ combatLevel: 1 }),
    targetingArray: Object.freeze({ combatLevel: 4 })
  }),
  attachments: Object.freeze({
    cargoPod: Object.freeze({ combatLevel: 1 }),
    jumpDrive: Object.freeze({ combatLevel: 1 }),
    hullBooster: Object.freeze({ combatLevel: 2 }),
    shieldBooster: Object.freeze({ combatLevel: 2 }),
    evasionMatrix: Object.freeze({ combatLevel: 3 })
  })
});

let currentNode = "Asteron Prime";
let lastPlanetNode = "Asteron Prime";
let homePlanet = "Asteron Prime";
let credits = 10000;
let currentShipId = STARTER_SHIP_ID;
let ownedShips = [STARTER_SHIP_ID];
let selectedHangarShipId = STARTER_SHIP_ID;
let selectedFleetShipId = STARTER_SHIP_ID;
let selectedShipyardShipId = STARTER_SHIP_ID;
let unlockedShipLines = [PIONEER_LINE_ID];
let stationVaultWasClearedThisSession = false;
let installedAttachments = [];
let shipConditions = {};
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
let shipLoadouts = { [STARTER_SHIP_ID]: { attachments: [], guns: ["pulseLaser"] } };

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
let cargoPurchased = {};
let cargoRecovered = {};

function getPurchasedCargoLedgerQuantity(good) {
  if (!good || !cargoPurchased || typeof cargoPurchased !== "object") return 0;
  return Math.max(0, Math.min(Number(cargo[good] || 0), Math.round(Number(cargoPurchased[good] || 0))));
}

function addPurchasedCargoQuantity(good, quantity) {
  const amount = Math.max(0, Math.round(Number(quantity || 0)));
  if (!good || !amount || !MAP_ONE_TRADE_RESOURCES.includes(good)) return 0;
  cargoPurchased[good] = getPurchasedCargoLedgerQuantity(good) + amount;
  cargoPurchased[good] = Math.min(Number(cargo[good] || 0), cargoPurchased[good]);
  if (cargoPurchased[good] <= 0) delete cargoPurchased[good];
  return getPurchasedCargoLedgerQuantity(good);
}

function consumePurchasedCargoQuantity(good, quantity) {
  const amount = Math.max(0, Math.round(Number(quantity || 0)));
  const purchased = getPurchasedCargoLedgerQuantity(good);
  const consumed = Math.min(purchased, amount);
  if (consumed > 0) {
    cargoPurchased[good] = purchased - consumed;
    if (cargoPurchased[good] <= 0) delete cargoPurchased[good];
  }
  return consumed;
}

function getRecoveredCargoQuantity(good) {
  if (!good || !cargoRecovered || typeof cargoRecovered !== "object") return 0;
  return Math.max(0, Math.min(Number(cargo[good] || 0), Math.round(Number(cargoRecovered[good] || 0))));
}

function addRecoveredCargoQuantity(good, quantity) {
  const amount = Math.max(0, Math.round(Number(quantity || 0)));
  if (!good || !amount || !mineralKeys.includes(good)) return 0;
  cargoRecovered[good] = getRecoveredCargoQuantity(good) + amount;
  cargoRecovered[good] = Math.min(Number(cargo[good] || 0), cargoRecovered[good]);
  if (cargoRecovered[good] <= 0) delete cargoRecovered[good];
  return getRecoveredCargoQuantity(good);
}

function consumeRecoveredCargoQuantity(good, quantity) {
  const amount = Math.max(0, Math.round(Number(quantity || 0)));
  const recovered = getRecoveredCargoQuantity(good);
  const consumed = Math.min(recovered, amount);
  if (consumed > 0) {
    cargoRecovered[good] = recovered - consumed;
    if (cargoRecovered[good] <= 0) delete cargoRecovered[good];
  }
  return consumed;
}

function pruneRecoveredCargoQuantities() {
  if (!cargoRecovered || typeof cargoRecovered !== "object") {
    cargoRecovered = {};
    return cargoRecovered;
  }
  Object.keys(cargoRecovered).forEach((good) => {
    if (!mineralKeys.includes(good)) {
      delete cargoRecovered[good];
      return;
    }
    const amount = getRecoveredCargoQuantity(good);
    if (amount > 0) cargoRecovered[good] = amount;
    else delete cargoRecovered[good];
  });
  return cargoRecovered;
}

function reconcileTradeCargoLedgers() {
  if (!cargoPurchased || typeof cargoPurchased !== "object") cargoPurchased = {};
  if (!cargoRecovered || typeof cargoRecovered !== "object") cargoRecovered = {};

  MAP_ONE_TRADE_RESOURCES.forEach((good) => {
    const held = Math.max(0, Math.round(Number(cargo[good] || 0)));
    let recovered = Math.max(0, Math.min(held, Math.round(Number(cargoRecovered[good] || 0))));
    let purchased = Math.max(0, Math.min(held - recovered, Math.round(Number(cargoPurchased[good] || 0))));
    const unclassified = Math.max(0, held - recovered - purchased);
    if (unclassified > 0) {
      if (Number(cargoCostBasis?.[good] || 0) > 0) purchased += unclassified;
      else recovered += unclassified;
    }
    if (purchased > 0) cargoPurchased[good] = purchased;
    else delete cargoPurchased[good];
    if (recovered > 0) cargoRecovered[good] = recovered;
    else delete cargoRecovered[good];
  });

  Object.keys(cargoPurchased).forEach((good) => {
    if (!MAP_ONE_TRADE_RESOURCES.includes(good)) delete cargoPurchased[good];
  });
  return { cargoPurchased, cargoRecovered };
}

let activeTradeTerminalTab = "overview";
let tradeTerminalTimer = null;
let storeDailyTimer = null;
let renderedStoreDayKey = "";
let renderedMarketCycle = null;
let stagedTradeOpportunity = null;
let selectedStationTradeRoute = null;
let activeTradeRoute = null;
let activeObjective = null;
let selectedLooseCargoSellGood = null;
let selectedMarketResource = "Iron";
let selectedMarketTargetPlanet = "";
let selectedMarketQuantity = 1;
let selectedMarketMode = "buy";
let tradeTerminalStatusMessage = "";
let tradeContractsExpanded = false;
let dailyTradeDate = null;
let dailyTradeContracts = [];
let selectedDailyTradeContractId = null;
let activeDailyTradeContractId = null;
let dailyTradeContractCargo = null;

const XP_CONFIG = {
  combatZoneKey: "sector-one",
  combatZoneCap: 2500,
  combatLevelXp: 2500,
  combatBotXp: 100,
  bountyClaimXp: 100,
  combatLevelThresholds: Object.freeze([0, 2500, 5000, 7500, 10000]),
  nextMapUnlockLevel: 5,
  maxStarterCombatLevel: 99
};

let playerProgress = createDefaultPlayerProgress();

let dailyBountyDate = null;
let dailyBountyContracts = [];
let selectedBountyContractId = null;
let activeBountyId = null;

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

const BOUNTY_REWARD_DEFAULT = {
  credits: 900,
  xp: 0,
  lupenCores: 0,
  lupenShards: 25
};

const DAILY_BOUNTY_CONTRACTS = [
  {
    id: "erebus-patrol-sweep",
    name: "Erebus Patrol Sweep",
    title: "Erebus Patrol Sweep",
    subtitle: "Destroy 4 Erebus bots",
    description: "Destroy 4 Erebus bots.",
    type: "standard",
    chipLabel: "EASY",
    contractType: "Kill Contract",
    area: "Any Hostile Zone",
    targetArea: "anyHostile",
    targetBotType: "any",
    targetBotLabel: "Any Erebus",
    requiredKills: 4,
    killsRequired: 4,
    progress: 0,
    threat: "Easy",
    reward: { credits: 900, xp: 0, lupenCores: 0, lupenShards: 25 },
    bonus: "Destroy any Erebus bots.",
    timed: false,
    timeLimitSeconds: null,
    expiresAt: null,
    status: "available",
    accent: "blue",
    icon: "assets/bounties/erebus-patrol-sweep.png",
    fallbackIcon: "assets/bounties/erebus-patrol-sweep.png"
  },
  {
    id: "hunter-clearance",
    name: "Hunter Clearance",
    title: "Hunter Clearance",
    subtitle: "Destroy 4 Erebus Hunters",
    description: "Destroy 4 Erebus Hunters.",
    type: "standard",
    chipLabel: "EASY",
    contractType: "Targeted Hunt",
    area: "Any Hostile Zone",
    targetArea: "anyHostile",
    targetBotType: "hunter",
    targetBotLabel: "Hunter",
    requiredKills: 4,
    killsRequired: 4,
    progress: 0,
    threat: "Easy",
    reward: { credits: 1100, xp: 0, lupenCores: 0, lupenShards: 35 },
    bonus: "Destroy Erebus Hunter-class bots.",
    timed: false,
    timeLimitSeconds: null,
    expiresAt: null,
    status: "available",
    accent: "purple",
    icon: "assets/bounties/hunter-clearance.png",
    fallbackIcon: "assets/bounties/hunter-clearance.png"
  },
  {
    id: "timed-suppression",
    name: "Timed Suppression",
    title: "Timed Suppression",
    subtitle: "Destroy 4 Erebus bots within 4 minutes",
    description: "Destroy 4 Erebus bots within 4 minutes.",
    type: "rapid",
    chipLabel: "MEDIUM",
    contractType: "Timed Elimination",
    area: "Any Hostile Zone",
    targetArea: "anyHostile",
    targetBotType: "any",
    targetBotLabel: "Any Erebus",
    requiredKills: 4,
    killsRequired: 4,
    progress: 0,
    threat: "Medium",
    reward: { credits: 1500, xp: 0, lupenCores: 0, lupenShards: 50 },
    bonus: "Complete before the timer expires.",
    timed: true,
    timeLimitSeconds: 240,
    expiresAt: null,
    status: "available",
    accent: "cyan",
    icon: "assets/bounties/timed-suppression.png",
    fallbackIcon: "assets/bounties/timed-suppression.png"
  },
  {
    id: "behemoth-warning",
    name: "Behemoth Warning",
    title: "Behemoth Warning",
    subtitle: "Destroy 1 Erebus Behemoth",
    description: "Destroy 1 Erebus Behemoth.",
    type: "boss",
    chipLabel: "EXTREME",
    contractType: "Boss Contract",
    area: "Any Hostile Zone",
    targetArea: "anyHostile",
    targetBotType: "behemoth",
    targetBotLabel: "Erebus Behemoth",
    requiredKills: 1,
    killsRequired: 1,
    progress: 0,
    threat: "Extreme",
    reward: { credits: 2500, xp: 0, lupenCores: 0, lupenShards: 75 },
    bonus: "Destroy an Erebus Behemoth.",
    timed: false,
    timeLimitSeconds: null,
    expiresAt: null,
    status: "available",
    accent: "red",
    icon: "assets/bounties/behemoth-warning.png",
    fallbackIcon: "assets/bounties/behemoth-warning.png"
  }
];

function getTodayKey() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getNextDailyResetAt() {
  const now = new Date();
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0));
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
  const targetBotType = objective?.targetBotType || null;
  const matchesTarget = bot => {
    if (!targetBotType) return true;
    if (targetBotType === "any_erebus") return bot.faction === "erebus" || String(bot.botType || "").startsWith("erebus_");
    return bot.botType === targetBotType;
  };

  const candidates = hostileBots
    .filter(bot => {
      const nodeId = bot.currentNodeId || bot.node;
      return bot.alive && sectorNodes[nodeId] && isNodeInBountyArea(nodeId, targetArea) && matchesTarget(bot);
    })
    .map(bot => bot.currentNodeId || bot.node)
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
  const targetBotType = activeObjective.targetBotType || null;
  return hostileBots.some(bot => {
    const matchesTarget = !targetBotType
      || (targetBotType === "any_erebus" ? bot.faction === "erebus" || String(bot.botType || "").startsWith("erebus_") : bot.botType === targetBotType);
    return bot.alive && (bot.currentNodeId || bot.node) === currentNode && matchesTarget;
  });
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
const MAX_ITEM_LEVEL = 5;

const upgradeMaterialDefinitions = {
  lupenShards: {
    name: "Lupen Shards",
    shortLabel: "LS",
    icon: "assets/items/lupen-shard.png",
    description: "Charged crystal shards used to raise item levels."
  }
};

function createDefaultUpgradeMaterials() {
  return {
    lupenShards: 10
  };
}

function normalizeUpgradeMaterials(materials) {
  const defaults = createDefaultUpgradeMaterials();
  const safe = materials && typeof materials === "object" ? materials : {};
  const legacyShardValue = Math.max(0, Math.floor(Number(safe.weaponParts || 0))) + Math.max(0, Math.floor(Number(safe.equipmentModules || 0)));
  const migrated = {
    ...safe,
    lupenShards: safe.lupenShards ?? legacyShardValue
  };
  return Object.fromEntries(
    Object.keys(defaults).map(key => [key, Math.max(0, Math.floor(Number(migrated[key] ?? defaults[key] ?? 0)))])
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
const MAX_CARRIED_INVENTORY_ITEMS = 12;
const INVENTORY_FULL_MESSAGE = "Inventory full. Return to a planet to sell items or cargo.";
let upgradeMaterials = createDefaultUpgradeMaterials();
let storeFilter = "all";
let selectedStoreItemId = null;
let selectedStoreQuality = "standard";
let storeDailyPurchases = {};
let hangarVaultFilter = "all";
let selectedVaultGroupKey = null;
let selectedForgeItemId = null;
let forgeUpgradeMode = "level";
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
    if (item.rewardType === "material") {
      const label = item.name || upgradeMaterialDefinitions[item.key]?.name || item.key;
      grouped[label] = (grouped[label] || 0) + Math.max(1, Number(item.quantity || 1));
      return;
    }
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

function getStoredEquipmentItemCount() {
  const attachmentCount = Object.values(ownedAttachments || {}).reduce((sum, count) => sum + Math.max(0, Number(count || 0)), 0);
  const gunCount = Object.values(ownedGuns || {}).reduce((sum, count) => sum + Math.max(0, Number(count || 0)), 0);
  return attachmentCount + gunCount;
}

function isStackableInventoryResource(item) {
  return item?.key === "lupenCore";
}

function getCarriedInventoryItemCount() {
  const carriedGearCount = Array.isArray(inventoryItems)
    ? inventoryItems.filter(item => !isStackableInventoryResource(item)).length
    : 0;
  return carriedGearCount + getStoredEquipmentItemCount();
}

function getAvailableInventoryItemSlots() {
  return Math.max(0, MAX_CARRIED_INVENTORY_ITEMS - getCarriedInventoryItemCount());
}

function canAddInventoryItems(quantity = 1) {
  return getAvailableInventoryItemSlots() >= Math.max(0, Number(quantity || 0));
}

function addInventoryItems(items) {
  const pending = Array.isArray(items) ? items.filter(Boolean) : [items].filter(Boolean);
  const added = [];
  const rejected = [];

  pending.forEach(item => {
    if (getAvailableInventoryItemSlots() <= 0) {
      rejected.push(item);
      return;
    }

    inventoryItems.push(item);
    added.push(item);
  });

  return { added, rejected };
}

function addInventoryItem(item) {
  return addInventoryItems([item]).added[0] || null;
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
  if (!Array.isArray(inventoryItems)) return;
  const resources = inventoryItems.filter(isStackableInventoryResource);
  const carriedGear = inventoryItems.filter(item => !isStackableInventoryResource(item));
  if (carriedGear.length > MAX_CARRIED_INVENTORY_ITEMS) {
    inventoryItems = [...carriedGear.slice(0, MAX_CARRIED_INVENTORY_ITEMS), ...resources];
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
// Temporary high-yield value for Forge economy testing. Lower this when balancing is complete.
const ASTEROID_LUPEN_SHARD_REWARD = 50;
const ASTEROID_ASSET_PATH = "assets/asteroids/";
const MAP_ONE_ASTEROID_COUNT = 15;
const MAP_ONE_ASTEROID_SPAWN_PLAN = [
  "Iron",
  "Iron",
  "Iron",
  "Copper",
  "Iron",
  "Copper",
  "Iron",
  "Iron",
  "Copper",
  "Iron",
  "Iron",
  "Copper",
  "Iron",
  "Copper",
  "Iron"
];
const ASTEROID_FIELD_POSITIONS = [
  { x: 16, y: 18 },
  { x: 33, y: 20 },
  { x: 52, y: 18 },
  { x: 72, y: 21 },
  { x: 86, y: 29 },
  { x: 22, y: 34 },
  { x: 42, y: 36 },
  { x: 63, y: 35 },
  { x: 80, y: 43 },
  { x: 13, y: 50 },
  { x: 31, y: 55 },
  { x: 51, y: 54 },
  { x: 68, y: 57 },
  { x: 85, y: 60 },
  { x: 44, y: 25 }
];
const ASTEROID_YIELD_VARIANTS = [
  { label: "Light", hp: 0.86, drop: 0.78, scale: 0.86 },
  { label: "Standard", hp: 1, drop: 1, scale: 1 },
  { label: "Dense", hp: 1.18, drop: 1.22, scale: 1.08 },
  { label: "Rich", hp: 1.32, drop: 1.45, scale: 1.16 }
];
const ASTEROID_RESOURCE_TYPES = {
  "Iron": {
    image: "asteroid-iron.png",
    hp: 250,
    armor: 2,
    dropMin: 18,
    dropMax: 38
  },
  "Copper": {
    image: "asteroid-copper.png",
    hp: 275,
    armor: 3,
    dropMin: 12,
    dropMax: 28
  },
  "Cobalt": {
    image: "asteroid-cobalt.png",
    hp: 315,
    armor: 5,
    dropMin: 8,
    dropMax: 20
  },
  "Titanium": {
    image: "asteroid-titanium.png",
    hp: 340,
    armor: 7,
    dropMin: 8,
    dropMax: 18
  },
  "Crystal Shards": {
    image: "asteroid-crystal.png",
    hp: 360,
    armor: 6,
    dropMin: 6,
    dropMax: 16
  },
  "Xenon Gas": {
    image: "asteroid-xenon-gas.png",
    hp: 350,
    armor: 5,
    dropMin: 5,
    dropMax: 14
  },
  "Iridium": {
    image: "asteroid-iridium.png",
    hp: 400,
    armor: 10,
    dropMin: 4,
    dropMax: 10
  },
  "Platinum": {
    image: "asteroid-platinum.png",
    hp: 390,
    armor: 9,
    dropMin: 4,
    dropMax: 10
  },
  "Uranium": {
    image: "asteroid-uranium.png",
    hp: 430,
    armor: 12,
    dropMin: 3,
    dropMax: 8
  },
  "Dark Matter Residue": {
    image: "asteroid-dark-matter.png",
    hp: 520,
    armor: 16,
    dropMin: 2,
    dropMax: 5
  }
};
const HOSTILE_BOT_MOVE_MS = 1000;
const HOSTILE_BOT_RESPAWN_MS = 10000;
const HOSTILE_BOT_BASE_HP = 165;
const HOSTILE_BOT_BASE_SHIELD = 95;
const HOSTILE_BOT_BASE_ARMOR = 12;
const HOSTILE_BOT_ATTACK_MS = 3000;
const HOSTILE_BOT_ATTACK_TICK_MS = 250;
const HOSTILE_BOT_DAMAGE = 4;
const HULL_REPAIR_COST_PER_POINT = 2;
const DISABLED_CARGO_LOSS_RATE = 0.3;
const EREBUS_BOT_AGGRO_MS = 45000;
const EREBUS_BOT_ASSET_PATH = "assets/bots/";
const EREBUS_BOT_FALLBACK_ASSET = "assets/bots/erebus-attacker.png";
const EREBUS_BOT_SPAWN_CAPS = {
  erebus_hunter: 8,
  erebus_attacker: 5,
  erebus_destroyer: 4,
  erebus_behemoth: 2
};
const EREBUS_STARTER_SPAWN_PLAN = [
  "erebus_hunter",
  "erebus_hunter",
  "erebus_hunter",
  "erebus_hunter",
  "erebus_hunter",
  "erebus_hunter",
  "erebus_attacker",
  "erebus_attacker",
  "erebus_attacker",
  "erebus_attacker",
  "erebus_destroyer",
  "erebus_destroyer",
  "erebus_destroyer",
  "erebus_behemoth",
  "erebus_behemoth"
];
const EREBUS_BOT_TYPES = {
  erebus_hunter: {
    id: "erebus_hunter",
    displayName: "Erebus Hunter",
    className: "Hunter",
    role: "Light scout",
    image: "erebus-hunter",
    hull: 110,
    shield: 60,
    armor: 6,
    damage: 8,
    fireRateMs: 1400,
    accuracy: 0.72,
    moveIntervalMs: 14000,
    threat: "Low",
    xpReward: 75,
    creditReward: 90
  },
  erebus_attacker: {
    id: "erebus_attacker",
    displayName: "Erebus Attacker",
    className: "Attacker",
    role: "Assault craft",
    image: "erebus-attacker",
    hull: 165,
    shield: 95,
    armor: 12,
    damage: 13,
    fireRateMs: 1700,
    accuracy: 0.75,
    moveIntervalMs: 18000,
    threat: "Medium",
    xpReward: 100,
    creditReward: 150
  },
  erebus_destroyer: {
    id: "erebus_destroyer",
    displayName: "Erebus Destroyer",
    className: "Destroyer",
    role: "Heavy gunship",
    image: "erebus-destroyer",
    hull: 260,
    shield: 150,
    armor: 22,
    damage: 20,
    fireRateMs: 2300,
    accuracy: 0.78,
    moveIntervalMs: 24000,
    threat: "High",
    xpReward: 150,
    creditReward: 275
  },
  erebus_behemoth: {
    id: "erebus_behemoth",
    displayName: "Erebus Behemoth",
    className: "Behemoth",
    role: "Heavy mini-boss",
    image: "erebus-behemoth",
    hull: 420,
    shield: 240,
    armor: 32,
    damage: 28,
    fireRateMs: 3200,
    accuracy: 0.8,
    moveIntervalMs: 32000,
    threat: "Extreme",
    xpReward: 250,
    creditReward: 500
  }
};
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

function getAsteroidResourceDefinition(resource) {
  return ASTEROID_RESOURCE_TYPES[resource] || ASTEROID_RESOURCE_TYPES.Iron;
}

function getAsteroidImage(resource) {
  const definition = getAsteroidResourceDefinition(resource);
  return `${ASTEROID_ASSET_PATH}${definition.image}`;
}

function getAsteroidDisplayName(resource, richnessLabel = "") {
  const base = resource === "Dark Matter Residue" ? "Dark Matter" : resource;
  return `${richnessLabel && richnessLabel !== "Standard" ? `${richnessLabel} ` : ""}${base} Asteroid`;
}

function getAsteroidResourceSlug(resource) {
  return String(resource || "Iron").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function getLowerCombatAsteroidNodeIds() {
  return Object.keys(sectorNodes).filter(name => {
    const node = sectorNodes[name];
    return node?.type === "space" && node?.danger === "hostile" && Number(node.y) > 50;
  });
}

function isAllowedAsteroidNode(nodeId) {
  return getLowerCombatAsteroidNodeIds().includes(nodeId);
}

function createAsteroid(resource, nodeId, index = 0) {
  const definition = getAsteroidResourceDefinition(resource);
  const variant = ASTEROID_YIELD_VARIANTS[index % ASTEROID_YIELD_VARIANTS.length];
  const position = ASTEROID_FIELD_POSITIONS[index % ASTEROID_FIELD_POSITIONS.length];
  const maxHp = Math.max(80, Math.round(Number(definition.hp || ASTEROID_BASE_HP) * variant.hp));
  const dropMin = Math.max(1, Math.round(Number(definition.dropMin || 1) * variant.drop));
  const dropMax = Math.max(dropMin, Math.round(Number(definition.dropMax || dropMin) * variant.drop));

  return {
    id: `asteroid-${index + 1}-${getAsteroidResourceSlug(resource)}`,
    resource,
    name: getAsteroidDisplayName(resource, variant.label),
    node: nodeId,
    image: getAsteroidImage(resource),
    shield: 0,
    shieldMax: 0,
    maxShield: 0,
    hull: maxHp,
    hullMax: maxHp,
    maxHull: maxHp,
    armor: Number(definition.armor || 0),
    hp: maxHp,
    maxHp,
    dropMin,
    dropMax,
    yieldLabel: variant.label,
    scale: variant.scale,
    alive: true,
    x: position.x,
    y: position.y
  };
}

function createMapOneAsteroid(index = 0) {
  const lowerNodes = getLowerCombatAsteroidNodeIds();
  const resource = MAP_ONE_ASTEROID_SPAWN_PLAN[index % MAP_ONE_ASTEROID_SPAWN_PLAN.length] || "Iron";
  const nodeId = lowerNodes[index % Math.max(1, lowerNodes.length)] || currentNode || "Lower Gate Core";
  return createAsteroid(resource, nodeId, index);
}

function createInitialAsteroids() {
  return Array.from({ length: MAP_ONE_ASTEROID_COUNT }, (_, index) => createMapOneAsteroid(index));
}

function normalizeAsteroid(asteroid, index = 0) {
  const fallback = createMapOneAsteroid(index);
  if (!asteroid || typeof asteroid !== "object") return fallback;

  const resource = ASTEROID_RESOURCE_TYPES[asteroid.resource] ? asteroid.resource : fallback.resource;
  const definition = getAsteroidResourceDefinition(resource);
  const node = isAllowedAsteroidNode(asteroid.node) ? asteroid.node : fallback.node;
  const maxHp = Math.max(80, Math.round(Number(asteroid.maxHp || asteroid.hullMax || definition.hp || fallback.maxHp)));
  const hp = Math.max(0, Math.min(maxHp, Math.round(Number(asteroid.hp || asteroid.hull || maxHp))));
  const dropMin = Math.max(1, Number(asteroid.dropMin || fallback.dropMin || definition.dropMin || 1));
  const dropMax = Math.max(dropMin, Number(asteroid.dropMax || fallback.dropMax || definition.dropMax || dropMin));

  return {
    ...fallback,
    ...asteroid,
    id: asteroid.id || fallback.id,
    resource,
    name: asteroid.name || getAsteroidDisplayName(resource, asteroid.yieldLabel || fallback.yieldLabel),
    node,
    image: getAsteroidImage(resource),
    shield: 0,
    shieldMax: 0,
    maxShield: 0,
    hull: hp,
    hullMax: maxHp,
    maxHull: maxHp,
    armor: Number(asteroid.armor ?? definition.armor ?? 0),
    hp,
    maxHp,
    dropMin,
    dropMax,
    scale: Number(asteroid.scale || fallback.scale || 1),
    alive: asteroid.alive !== false
  };
}

function normalizeAsteroidCollection(savedAsteroids) {
  const defaults = createInitialAsteroids();
  if (!Array.isArray(savedAsteroids) || !savedAsteroids.length) return defaults;

  const normalized = savedAsteroids
    .slice(0, MAP_ONE_ASTEROID_COUNT)
    .map((asteroid, index) => normalizeAsteroid(asteroid?.alive === false ? null : asteroid, index));
  const seen = new Set(normalized.map(asteroid => asteroid.id));

  defaults.forEach(defaultAsteroid => {
    if (normalized.length >= MAP_ONE_ASTEROID_COUNT) return;
    if (seen.has(defaultAsteroid.id)) return;
    normalized.push(defaultAsteroid);
    seen.add(defaultAsteroid.id);
  });

  return normalized.slice(0, MAP_ONE_ASTEROID_COUNT);
}

function getErebusBotImagePath(imageName) {
  if (!imageName) return EREBUS_BOT_FALLBACK_ASSET;
  if (String(imageName).includes("/") || String(imageName).endsWith(".png")) return imageName;
  return `${EREBUS_BOT_ASSET_PATH}${imageName}.png`;
}

function createErebusBot(def, nodeId, index = 0) {
  const shield = Number(def.shield || HOSTILE_BOT_BASE_SHIELD);
  const hullValue = Number(def.hull || HOSTILE_BOT_BASE_HP);
  return {
    id: `erebus-bot-${index + 1}-${def.id}`,
    botType: def.id,
    name: def.displayName,
    displayName: def.displayName,
    className: def.className,
    classRole: def.role,
    role: def.role,
    currentNodeId: nodeId,
    node: nodeId,
    hull: hullValue,
    maxHull: hullValue,
    hullMax: hullValue,
    shield,
    maxShield: shield,
    shieldMax: shield,
    armor: Number(def.armor || HOSTILE_BOT_BASE_ARMOR),
    damage: Number(def.damage || HOSTILE_BOT_DAMAGE),
    fireRateMs: Number(def.fireRateMs || HOSTILE_BOT_ATTACK_MS),
    lastFiredAt: 0,
    accuracy: Number(def.accuracy || 1),
    image: getErebusBotImagePath(def.image),
    faction: "erebus",
    allegiance: "hostile_neutral",
    aggroState: "neutral",
    aggroUntil: null,
    lastMovedAt: Date.now() - Math.floor(Math.random() * Number(def.moveIntervalMs || HOSTILE_BOT_MOVE_MS)),
    moveIntervalMs: Number(def.moveIntervalMs || HOSTILE_BOT_MOVE_MS),
    targetPlayerId: null,
    threat: def.threat || "Medium",
    xpReward: Number(def.xpReward || XP_CONFIG.combatBotXp),
    creditReward: Number(def.creditReward || 0),
    hp: shield + hullValue,
    maxHp: shield + hullValue,
    alive: true,
    x: Math.floor(Math.random() * 52) + 34,
    y: Math.floor(Math.random() * 34) + 18,
    attackingUntil: 0
  };
}

function createInitialHostileBots() {
  const allowedNodes = getAllowedErebusBotNodeIds();
  if (!allowedNodes.length) {
    console.warn("No allowed Erebus bot nodes found.");
    return [];
  }

  return EREBUS_STARTER_SPAWN_PLAN.map((botType, index) => {
    const def = EREBUS_BOT_TYPES[botType] || EREBUS_BOT_TYPES.erebus_attacker;
    const nodeIndex = botType === "erebus_behemoth"
      ? (index * 5) % allowedNodes.length
      : index % allowedNodes.length;
    return createErebusBot(def, allowedNodes[nodeIndex], index);
  });
}

function enforceErebusSpawnCaps(bots = hostileBots) {
  if (!Array.isArray(bots)) return [];
  const counts = {};
  return bots.filter(bot => {
    if (bot?.faction !== "erebus") return true;
    const cap = EREBUS_BOT_SPAWN_CAPS[bot.botType] || 0;
    counts[bot.botType] = Number(counts[bot.botType] || 0) + 1;
    return counts[bot.botType] <= cap;
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

function getStagingBotTargetById(id) {
  if (!id || typeof window === "undefined") return null;
  const client = window.LupenMultiplayerClient;
  const bot = client?.getBotById?.(id)
    || client?.getBotsInCurrentNode?.(currentNode)?.find(item => String(item?.id || "") === String(id))
    || client?.getBots?.()?.find(item => String(item?.id || "") === String(id));
  if (!bot) return null;
  const node = bot.currentNode || bot.currentNodeId || bot.node;
  return {
    ...bot,
    currentNodeId: node,
    node,
    alive: !bot.disabled,
    name: bot.name || bot.displayName || "Staging Bot",
    stagingBot: true
  };
}

function getStagingResourceTargetById(id) {
  if (!id || typeof window === "undefined") return null;
  const client = window.LupenMultiplayerClient;
  const resource = client?.getResourceById?.(id)
    || client?.getResources?.()?.find(item => String(item?.id || "") === String(id));
  if (!resource) return null;
  const node = resource.currentNode || resource.currentNodeId || resource.node;
  const resourceName = resource.resourceName || resource.resource || resource.name || "Iron";
  const hpMax = Math.max(1, Math.round(Number(resource.hpMax || resource.maxHp || resource.hullMax || resource.maxHull || 1)));
  const hp = Math.max(0, Math.min(hpMax, Math.round(Number(resource.hp ?? resource.hull ?? hpMax))));
  return {
    ...resource,
    currentNodeId: node,
    node,
    resource: resourceName,
    resourceName,
    hp,
    maxHp: hpMax,
    hpMax,
    hull: hp,
    hullMax: hpMax,
    maxHull: hpMax,
    shield: 0,
    shieldMax: 0,
    maxShield: 0,
    image: typeof getAsteroidImage === "function" ? getAsteroidImage(resourceName) : resource.image,
    alive: resource.depleted !== true,
    name: `${resourceName} Asteroid`,
    stagingResource: true
  };
}

function getRemotePlayerTargetById(id) {
  if (!id || typeof window === "undefined") return null;
  const client = window.LupenMultiplayerClient;
  const player = client?.getPlayers?.({ includeSelf: false })?.find(item => {
    const candidateId = String(item?.sessionId || item?.id || "");
    return candidateId === String(id);
  });
  if (!player) return null;
  const node = player.currentNode || player.currentNodeId || player.node;
  const presenceStatus = String(player.presenceStatus || player.status || "space").toLowerCase();
  if (presenceStatus === "docked") return null;
  return {
    ...player,
    id: player.sessionId || player.id,
    currentNodeId: node,
    node,
    alive: true,
    name: player.displayName || "Unknown Pilot",
    shipName: player.shipName || player.ship || "Unknown Ship",
    remotePlayer: true
  };
}

function getSelectedStagingBotTarget() {
  return selectedTarget?.type === "stagingBot"
    ? getStagingBotTargetById(selectedTarget.id)
    : null;
}

function getSelectedStagingResourceTarget() {
  return selectedTarget?.type === "stagingResource"
    ? getStagingResourceTargetById(selectedTarget.id)
    : null;
}

function getSelectedRemotePlayerTarget() {
  return selectedTarget?.type === "remotePlayer"
    ? getRemotePlayerTargetById(selectedTarget.id)
    : null;
}

function getSelectedTargetEntity() {
  return getSelectedRemotePlayerTarget() || getSelectedStagingResourceTarget() || getSelectedStagingBotTarget() || getSelectedHostileBot() || getSelectedAsteroid();
}

function getEngagedTargetEntity() {
  if (!engagedTarget) return null;

  if (engagedTarget.type === "stagingBot") {
    return getStagingBotTargetById(engagedTarget.id);
  }

  if (engagedTarget.type === "stagingResource") {
    return getStagingResourceTargetById(engagedTarget.id);
  }

  if (engagedTarget.type === "hostileBot") {
    return getHostileBotById(engagedTarget.id);
  }

  if (engagedTarget.type === "asteroid") {
    return getAsteroidById(engagedTarget.id);
  }

  if (engagedTarget.type === "remotePlayer") {
    return getRemotePlayerTargetById(engagedTarget.id);
  }

  return null;
}

function getTargetTypeFromEntity(target) {
  if (target?.remotePlayer) return "remotePlayer";
  if (target?.stagingResource) return "stagingResource";
  if (target?.stagingBot) return "stagingBot";
  return target?.faction === "erebus" || target?.id?.startsWith("erebus-bot") ? "hostileBot" : "asteroid";
}

function getVisibleAsteroids() {
  return asteroids.filter(asteroid => asteroid.alive && asteroid.node === currentNode);
}

function getVisibleHostileBots() {
  return hostileBots.filter(bot => bot.alive && (bot.currentNodeId || bot.node) === currentNode);
}

function hasServerOwnedSectorObjects() {
  if (typeof window === "undefined") return false;
  const client = window.LupenMultiplayerClient;
  const resources = Array.isArray(client?.getResources?.()) ? client.getResources() : [];
  const bots = Array.isArray(client?.getBots?.()) ? client.getBots() : [];
  return resources.some(resource => resource && resource.depleted !== true) ||
    bots.some(bot => bot && bot.disabled !== true);
}

function isConnectedStagingMultiplayerSession() {
  if (typeof window === "undefined") return false;
  const status = window.LupenMultiplayerClient?.getStatus?.();
  const isStagingUrl = (() => {
    try {
      return new URLSearchParams(window.location.search).get("mp") === "staging";
    } catch (_err) {
      return false;
    }
  })();
  return Boolean(status?.isConnected && (isStagingUrl || status?.enabledReason === "staging_enabled"));
}

function shouldUseServerOwnedSectorObjects() {
  if (typeof shouldUseLocalTutorialBountyFallback === "function" && shouldUseLocalTutorialBountyFallback()) {
    return false;
  }
  return isConnectedStagingMultiplayerSession() || hasServerOwnedSectorObjects();
}

function isStagingLocalCombatBotVisualGuardActive() {
  if (typeof shouldUseLocalTutorialBountyFallback === "function" && shouldUseLocalTutorialBountyFallback()) {
    return false;
  }

  let isStagingUrl = false;
  try {
    isStagingUrl = new URLSearchParams(window.location.search).get("mp") === "staging";
  } catch (_err) {
    isStagingUrl = false;
  }

  const status = window.LupenMultiplayerClient?.getStatus?.();
  // Staging presence uses Colyseus-owned visual bots. Keep local real combat
  // bots in their normal arrays/saves, but hide and pause their local combat
  // presentation while ?mp=staging is active so two-player staging tests are
  // not confused by client-local enemy spawns. This is temporary until
  // Colyseus becomes authoritative for real bot simulation.
  return isStagingUrl || status?.enabledReason === "staging_enabled";
}

function getVisibleHostileBotsForLocalTargetUi() {
  return isStagingLocalCombatBotVisualGuardActive() ? [] : getVisibleHostileBots();
}

function getVisibleAsteroidsForLocalTargetUi() {
  return shouldUseServerOwnedSectorObjects() ? [] : getVisibleAsteroids();
}

function getVisibleStagingBotTargets() {
  if (typeof window === "undefined") return [];
  const client = window.LupenMultiplayerClient;
  const bots = client?.getBotsInCurrentNode?.(currentNode) || client?.getBots?.() || [];
  return bots
    .map(bot => getStagingBotTargetById(bot?.id))
    .filter(bot => bot && bot.alive && (bot.currentNodeId || bot.node) === currentNode);
}

function getVisibleStagingResourceTargets() {
  if (typeof window === "undefined") return [];
  const resources = window.LupenMultiplayerClient?.getResources?.() || [];
  return resources
    .map(resource => getStagingResourceTargetById(resource?.id))
    .filter(resource => resource && resource.alive && (resource.currentNodeId || resource.node) === currentNode);
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
  return [...getVisibleStagingBotTargets(), ...getVisibleStagingResourceTargets(), ...getVisibleHostileBotsForLocalTargetUi(), ...getVisibleAsteroidsForLocalTargetUi()];
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
      erebusBotsDestroyed: 0,
      tradesCompleted: 0,
      tradeProfit: 0,
      totalTradingProfit: 0,
      cargoSold: 0,
      bountiesClaimed: 0
    }
  };
}

function normalizePlayerProgress(progress) {
  const defaults = createDefaultPlayerProgress();
  const safe = progress && typeof progress === "object" ? progress : {};
  const combatXp = Math.max(0, Number(
    safe.combatXp ??
    safe.xp ??
    safe.totalXp ??
    0
  ));
  const rawZoneCombatXp = safe.zoneCombatXp && typeof safe.zoneCombatXp === "object" ? safe.zoneCombatXp : {};
  const zoneCombatXp = {
    ...defaults.zoneCombatXp,
    ...rawZoneCombatXp
  };
  if (!Number(zoneCombatXp[XP_CONFIG.combatZoneKey] || 0) && combatXp > 0) {
    zoneCombatXp[XP_CONFIG.combatZoneKey] = combatXp;
  }

  const rawTotals = safe.totals && typeof safe.totals === "object" ? safe.totals : {};
  const botsDestroyed = Math.max(0, Number(rawTotals.botsDestroyed || rawTotals.erebusBotsDestroyed || 0));
  const erebusBotsDestroyed = Math.max(0, Number(rawTotals.erebusBotsDestroyed || rawTotals.botsDestroyed || 0));
  const tradeProfit = Math.max(0, Number(rawTotals.tradeProfit || rawTotals.totalTradingProfit || 0));
  const totalTradingProfit = Math.max(0, Number(rawTotals.totalTradingProfit || rawTotals.tradeProfit || 0));

  return {
    combatXp,
    zoneCombatXp,
    totals: {
      ...defaults.totals,
      ...rawTotals,
      botsDestroyed,
      erebusBotsDestroyed,
      tradeProfit,
      totalTradingProfit
    }
  };
}

function getCombatLevelInfo() {
  const total = Math.max(0, Number(playerProgress.combatXp || 0));
  const perLevel = Math.max(1, Number(XP_CONFIG.combatLevelXp || 500));
  const thresholds = Array.isArray(XP_CONFIG.combatLevelThresholds)
    ? XP_CONFIG.combatLevelThresholds
      .map(value => Math.max(0, Number(value || 0)))
      .filter((value, index, values) => index === 0 || value > values[index - 1])
    : [];
  const configuredLevelIndex = thresholds.reduce((latest, threshold, index) => total >= threshold ? index : latest, 0);
  const levelsPastConfiguredCurve = thresholds.length && total >= thresholds[thresholds.length - 1]
    ? Math.floor((total - thresholds[thresholds.length - 1]) / perLevel)
    : 0;
  const level = thresholds.length
    ? configuredLevelIndex + 1 + levelsPastConfiguredCurve
    : Math.floor(total / perLevel) + 1;
  const levelBase = thresholds.length && configuredLevelIndex < thresholds.length
    ? thresholds[configuredLevelIndex] + (levelsPastConfiguredCurve * perLevel)
    : (level - 1) * perLevel;
  const nextThreshold = thresholds[level];
  const current = total - levelBase;
  const next = Number.isFinite(nextThreshold) ? Math.max(1, nextThreshold - levelBase) : perLevel;

  return {
    level,
    current,
    next,
    total,
    levelBase,
    percent: Math.min(100, Math.round((current / next) * 100)),
    capped: false,
    nextMapUnlockLevel: Number(XP_CONFIG.nextMapUnlockLevel || 5),
    nextMapUnlockXp: thresholds[Math.max(0, Number(XP_CONFIG.nextMapUnlockLevel || 5) - 1)] || null
  };
}

function getPlayerProgressTotals() {
  playerProgress = normalizePlayerProgress(playerProgress);
  return playerProgress.totals || {};
}

function getUnlockProgressValue(key) {
  const totals = getPlayerProgressTotals();
  if (key === "combatLevel") return getCombatLevelInfo().level;
  if (key === "erebusBotsDestroyed") return Math.max(0, Number(totals.erebusBotsDestroyed || totals.botsDestroyed || 0));
  if (key === "totalTradingProfit") return Math.max(0, Number(totals.totalTradingProfit || totals.tradeProfit || 0));
  if (key === "bountiesClaimed") return Math.max(0, Number(totals.bountiesClaimed || 0));
  return Math.max(0, Number(totals[key] || 0));
}

function getUnlockRequirementProgress(requirements = {}) {
  return Object.entries(requirements || {})
    .filter(([, target]) => Number(target || 0) > 0)
    .map(([key, target]) => {
      const current = getUnlockProgressValue(key);
      const required = Math.max(0, Number(target || 0));
      return {
        key,
        current,
        required,
        met: current >= required
      };
    });
}

function formatUnlockRequirementLine(progress) {
  if (!progress) return "";
  if (progress.key === "combatLevel") return `Requires Combat Level ${formatNumber(progress.required)}`;
  if (progress.key === "erebusBotsDestroyed") return `Destroy Erebus bots: ${formatNumber(Math.min(progress.current, progress.required))} / ${formatNumber(progress.required)}`;
  if (progress.key === "totalTradingProfit") return `Trading profit: CR ${formatNumber(Math.min(progress.current, progress.required))} / CR ${formatNumber(progress.required)}`;
  if (progress.key === "bountiesClaimed") return `Claim bounties: ${formatNumber(Math.min(progress.current, progress.required))} / ${formatNumber(progress.required)}`;
  return `${progress.key}: ${formatNumber(Math.min(progress.current, progress.required))} / ${formatNumber(progress.required)}`;
}

function getFirstLockedRequirementMessage(requirements = {}, fallback = "Complete the unlock requirements first.") {
  const missing = getUnlockRequirementProgress(requirements).find(item => !item.met);
  if (!missing) return fallback;
  if (missing.key === "combatLevel") return `Reach Combat Level ${formatNumber(missing.required)} to unlock this.`;
  if (missing.key === "erebusBotsDestroyed") return `Destroy ${formatNumber(missing.required)} Erebus bots to unlock this.`;
  if (missing.key === "totalTradingProfit") return `Earn CR ${formatNumber(missing.required)} trading profit to unlock this.`;
  if (missing.key === "bountiesClaimed") return `Claim ${formatNumber(missing.required)} bounties to unlock this.`;
  return fallback;
}

function getShipUnlockRequirements(shipId) {
  return SHIP_UNLOCK_REQUIREMENTS[shipId] || {};
}

function getShipUnlockStatus(shipId) {
  const requirements = getShipUnlockRequirements(shipId);
  const progress = getUnlockRequirementProgress(requirements);
  const line = SHIP_LINES[SHIPS[shipId]?.lineId];
  const planUnlocked = Boolean(!line || line.unlockedByDefault || (Array.isArray(unlockedShipLines) && unlockedShipLines.includes(line.id)));
  const unlocked = planUnlocked && progress.every(item => item.met);
  const owned = ownedShips.includes(shipId);
  const active = currentShipId === shipId;
  return {
    shipId,
    requirements,
    progress,
    planUnlocked,
    unlocked,
    locked: !unlocked,
    owned,
    active,
    state: active ? "active" : owned ? "owned" : unlocked ? "available" : "locked",
    requirementLines: progress.map(formatUnlockRequirementLine),
    message: planUnlocked
      ? getFirstLockedRequirementMessage(requirements, "Complete this ship unlock challenge first.")
      : "Recover this ship line's plans before purchasing the hull."
  };
}

function getUnlockProgressItem(status, key) {
  return (status?.progress || []).find(item => item.key === key) || null;
}

function addProgressionActivity(message) {
  if (typeof addActivityLog === "function") addActivityLog(message);
}

function addShipUnlockedFeedback(shipId) {
  const ship = SHIPS[shipId];
  if (!ship) return;
  const message = `Unlocked: ${ship.name} is now available in Vessel Exchange.`;
  if (typeof addHudToast === "function") addHudToast(message);
  else addProgressionActivity(message);
  if (typeof renderShipShop === "function" && document.getElementById("hangarShipyardSection")?.classList.contains("active")) {
    renderShipShop();
  }
}

function reportShipUnlockTransition(shipId, beforeStatus) {
  const afterStatus = getShipUnlockStatus(shipId);
  if (beforeStatus?.locked && afterStatus.unlocked && !ownedShips.includes(shipId)) {
    addShipUnlockedFeedback(shipId);
  }
  return afterStatus;
}

function reportErebusBotShipProgress(beforeNightshadeStatus) {
  const afterStatus = getShipUnlockStatus("zeusExplorer");
  const botProgress = getUnlockProgressItem(afterStatus, "erebusBotsDestroyed");
  if (beforeNightshadeStatus?.locked && botProgress && !botProgress.met) {
    addProgressionActivity(`Erebus destroyed. Pioneer Destroyer progress: ${formatNumber(Math.min(botProgress.current, botProgress.required))} / ${formatNumber(botProgress.required)}.`);
  }
  reportShipUnlockTransition("zeusExplorer", beforeNightshadeStatus);
}

function reportTradingShipProgress(beforeHaulerStatus) {
  const afterStatus = getShipUnlockStatus("bison");
  const profitProgress = getUnlockProgressItem(afterStatus, "totalTradingProfit");
  if (beforeHaulerStatus?.locked && profitProgress && !profitProgress.met) {
    addProgressionActivity(`Trade profit banked. Pioneer Freighter progress: CR ${formatNumber(Math.min(profitProgress.current, profitProgress.required))} / CR ${formatNumber(profitProgress.required)}.`);
  }
  reportShipUnlockTransition("bison", beforeHaulerStatus);
}

function recordBotDestroyedProgress(bot) {
  playerProgress = normalizePlayerProgress(playerProgress);
  const isErebus = !bot || bot.faction === "erebus" || String(bot.botType || "").startsWith("erebus_");
  const beforeNightshadeStatus = isErebus ? getShipUnlockStatus("zeusExplorer") : null;
  playerProgress.totals.botsDestroyed = Math.max(0, Number(playerProgress.totals.botsDestroyed || 0)) + 1;
  if (isErebus) {
    playerProgress.totals.erebusBotsDestroyed = Math.max(0, Number(playerProgress.totals.erebusBotsDestroyed || 0)) + 1;
    reportErebusBotShipProgress(beforeNightshadeStatus);
  }
  if (typeof recordMissionEvent === "function") {
    recordMissionEvent("destroy_bot", { bot, faction: isErebus ? "erebus" : (bot?.faction || "") });
  }
}

function getEquipmentUnlockRequirements(categoryKey, itemKey) {
  const normalizedCategory = categoryKey === "attachments" || categoryKey === "attachment" ? "attachments" : "guns";
  return EQUIPMENT_UNLOCK_REQUIREMENTS[normalizedCategory]?.[itemKey] || { combatLevel: 1 };
}

function getEquipmentUnlockStatus(categoryKey, itemKey) {
  const requirements = getEquipmentUnlockRequirements(categoryKey, itemKey);
  const progress = getUnlockRequirementProgress(requirements);
  const unlocked = progress.every(item => item.met);
  return {
    categoryKey: categoryKey === "attachments" || categoryKey === "attachment" ? "attachments" : "guns",
    itemKey,
    requirements,
    progress,
    unlocked,
    locked: !unlocked,
    requirementLines: progress.map(formatUnlockRequirementLine),
    message: getFirstLockedRequirementMessage(requirements, "Complete the item unlock requirement first.")
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
  const award = Number(bot?.xpReward || getCombatXpPerBot());
  recordBotDestroyedProgress(bot);

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

  const beforeHaulerStatus = getShipUnlockStatus("bison");
  playerProgress.totals.tradesCompleted = Math.max(0, Number(playerProgress.totals.tradesCompleted || 0)) + 1;
  playerProgress.totals.tradeProfit = Math.max(0, Number(playerProgress.totals.tradeProfit || 0)) + safeProfit;
  playerProgress.totals.totalTradingProfit = Math.max(0, Number(playerProgress.totals.totalTradingProfit || 0)) + safeProfit;
  addActivityLog(`Trade completed: CR ${formatNumber(safeProfit)} profit.`);
  if (typeof recordMissionEvent === "function") {
    recordMissionEvent("profitable_trade", { profit: safeProfit });
    recordMissionEvent("credits_earned", { amount: safeProfit, credits });
  }
  reportTradingShipProgress(beforeHaulerStatus);
  updateProgressDisplays();
  return 0;
}

