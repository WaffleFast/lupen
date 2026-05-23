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
  const weapon = typeof getEquippedWeapon === "function" ? getEquippedWeapon() : null;
  const projectileColor = weapon?.projectileColor || "#7fd6ff";
  const beamHeight = weapon?.fireStyle === "heavy" ? 5 : weapon?.fireStyle === "sniper" ? 2 : weapon?.fireStyle === "rapid" ? 2 : 3;

  const makeBeam = (offsetY = 0, delay = 0) => {
    const beam = document.createElement("div");
    beam.className = "laser-burst";
    beam.style.left = `${startX}px`;
    beam.style.top = `${startY + offsetY}px`;
    beam.style.width = `${length}px`;
    beam.style.height = `${beamHeight}px`;
    beam.style.background = `linear-gradient(90deg, transparent, ${projectileColor}, #ffffff, ${projectileColor}, transparent)`;
    beam.style.boxShadow = `0 0 12px ${projectileColor}`;
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

function normalizeTargetCombatLayers(target) {
  if (!target) return target;

  const fallbackMaxHp = Math.max(1, Number(target.maxHp || target.hp || HOSTILE_BOT_BASE_HP || 1));
  if (!Number.isFinite(Number(target.shieldMax))) {
    target.shieldMax = Math.max(0, Number(target.shield || 0));
  }
  if (!Number.isFinite(Number(target.shield))) {
    target.shield = Math.max(0, Number(target.shieldMax || 0));
  }
  if (!Number.isFinite(Number(target.hullMax)) || Number(target.hullMax) <= 0) {
    target.hullMax = Math.max(1, fallbackMaxHp - Number(target.shieldMax || 0));
  }
  if (!Number.isFinite(Number(target.hull))) {
    target.hull = Math.min(Number(target.hullMax), Math.max(0, Number(target.hp || target.hullMax)));
  }
  if (!Number.isFinite(Number(target.armor))) {
    target.armor = 0;
  }

  target.maxHp = Math.max(1, Number(target.shieldMax || 0) + Number(target.hullMax || 0));
  target.hp = Math.max(0, Number(target.shield || 0) + Number(target.hull || 0));
  return target;
}

function syncTargetHpFromLayers(target) {
  if (!target) return;
  target.shield = Math.max(0, Math.round(Number(target.shield || 0)));
  target.hull = Math.max(0, Math.round(Number(target.hull || 0)));
  target.hp = Math.max(0, target.shield + target.hull);
  target.maxHp = Math.max(1, Math.round(Number(target.shieldMax || 0) + Number(target.hullMax || target.maxHp || 1)));
}

function applyWeaponDamageToTarget(target, weapon) {
  normalizeTargetCombatLayers(target);

  const accuracy = Number(weapon.accuracy || 100);
  if (Math.random() * 100 > accuracy) {
    return { hit: false, layer: "miss", amount: 0 };
  }

  const damage = weapon.damageLayers || { shield: Number(weapon.damage || 0), armor: Number(weapon.damage || 0), hull: Number(weapon.damage || 0) };

  if (target.shield > 0) {
    const shieldDamage = Math.max(1, Math.round(Number(damage.shield || 1)));
    const applied = Math.min(target.shield, shieldDamage);
    target.shield -= applied;
    syncTargetHpFromLayers(target);
    return { hit: true, layer: "shield", amount: applied };
  }

  const reduction = Math.min(Number(target.armor || 0), 75) / 100;
  const finalHullDamage = Math.max(1, Math.round(Number(damage.hull || 1) * (1 - reduction)));
  const applied = Math.min(target.hull, finalHullDamage);
  target.hull -= applied;
  syncTargetHpFromLayers(target);
  return { hit: true, layer: "hull", amount: applied };
}

function performAttackCycle() {
  const target = getEngagedTargetEntity();

  if (!target || !target.alive || target.node !== currentNode) {
    disengageTarget(true);
    return;
  }

  pulseLaserBurstToTarget(target);
  playPlayerLaserPulse();
  const weapon = getEquippedWeapon();
  const result = applyWeaponDamageToTarget(target, weapon);

  if (target.hp <= 0) {
    showExplosionAtTarget(target);
    if (typeof playEnemyShipDestroyedSound === "function") {
      setTimeout(playEnemyShipDestroyedSound, 140);
    }
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
  } else if (result.hit && typeof playWeaponHitMarkerSound === "function") {
    setTimeout(playWeaponHitMarkerSound, 130);
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
  normalizeTargetCombatLayers(target);

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
  bot.shield = HOSTILE_BOT_BASE_SHIELD;
  bot.shieldMax = HOSTILE_BOT_BASE_SHIELD;
  bot.armor = HOSTILE_BOT_BASE_ARMOR;
  bot.hull = HOSTILE_BOT_BASE_HP;
  bot.hullMax = HOSTILE_BOT_BASE_HP;
  bot.maxHp = bot.shieldMax + bot.hullMax;
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

function clearStationVaultForShipyardIfNeeded(saved = null) {
  if (localStorage.getItem(STORAGE_VAULT_RESET_KEY) === "true") return false;
  const saveVersion = Number(saved?.migratedFromVersion || saved?.saveVersion || SAVE_VERSION);
  if (saveVersion >= 2) return false;

  inventoryItems = [];
  Object.keys(ownedAttachments || {}).forEach(key => { ownedAttachments[key] = 0; });
  Object.keys(ownedGuns || {}).forEach(key => { ownedGuns[key] = 0; });
  selectedVaultGroupKey = null;
  localStorage.setItem(STORAGE_VAULT_RESET_KEY, "true");
  return true;
}

