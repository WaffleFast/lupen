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
      <div class="trade-result-meta">${formatNumber(quantity)} ${good} sold / CR ${formatNumber(revenue)} return</div>
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


function showGameRewardBurst({ type = "info", kicker = "Reward", title = "", meta = "", icon = "*", image = "" }) {
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
    meta: `Return to station / CR ${formatNumber(objective.reward || 0)} ready`,
    icon: "!"
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
        <small>Combat Level ${combat.level} / ${ship.name}</small>
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
      ${renderPilotStatCard("Current Vessel", ship.name, `${loadout.guns.length}/${getGunSlotLimit(currentShipId)} guns / ${loadout.attachments.length}/${getAttachmentSlotLimit(currentShipId)} equip`, "ship-stat")}
    </section>

    <section class="pilot-profile-lower">
      <div class="pilot-progression-card">
        <div class="profile-tree-head"><span>Combat Progress</span><strong>Map 1</strong></div>
        ${renderSkillProfileCard("Combat", combat, `Level progress: ${formatNumber(combat.current)} / ${formatNumber(combat.next)} XP / total combat XP: ${formatNumber(combat.total)} / next bot kill: +${formatNumber(nextBotXp)} XP`, "XP")}
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
  const username = document.getElementById("createUsername")?.value.trim() || "";
  const password = document.getElementById("createPassword")?.value || "";
  const confirmPassword = document.getElementById("createConfirm")?.value || "";
  const message = document.getElementById("createMessage");
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!emailLooksValid) {
    if (message) message.textContent = "Enter a valid email address.";
    return;
  }

  if (username.length < 3) {
    if (message) message.textContent = "Pilot name must be at least 3 characters.";
    return;
  }

  if (password.length < 6) {
    if (message) message.textContent = "Password must be at least 6 characters.";
    return;
  }

  if (password !== confirmPassword) {
    if (message) message.textContent = "Passwords do not match.";
    return;
  }

  if (message) message.textContent = "";

  // Prototype mode: store local-only account details for testing.
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
  const user = document.getElementById("loginUser")?.value.trim() || "";
  const password = document.getElementById("loginPassword")?.value || "";
  const message = document.getElementById("loginMessage");
  const saved = safeParseLocalStorage(STORAGE_ACCOUNT_KEY);

  if (!user) {
    if (message) message.textContent = "Enter your pilot name or email.";
    return;
  }

  if (!password) {
    if (message) message.textContent = "Enter your password.";
    return;
  }

  if (!saved || (user !== saved.username && user !== saved.email) || password !== saved.password) {
    if (message) message.textContent = "Pilot name/email or password is incorrect.";
    return;
  }

  if (message) message.textContent = "";

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
    addActivityLog("Launch blocked. Hull disabled -- repair required in Hangar.");
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



