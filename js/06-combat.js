/* Asteroid / combat */

/* Asteroid / combat */

function isSameTargetRef(left, right) {
  return Boolean(left && right && left.type === right.type && left.id === right.id);
}

function getTargetRefFromEntity(target) {
  if (!target) return null;
  return {
    type: getTargetTypeFromEntity(target),
    id: target.id
  };
}

function retargetEngagementToSelectedTarget() {
  if (!engageTimer) return false;

  const target = getSelectedTargetEntity();
  if (!target || !target.alive || (target.currentNodeId || target.node) !== currentNode) return false;

  const nextTargetRef = getTargetRefFromEntity(target);
  if (!nextTargetRef || isSameTargetRef(nextTargetRef, engagedTarget)) return false;

  engagedTarget = nextTargetRef;
  updateAsteroidUI();
  updateTargetPanel();
  updateObjectActionPanel(true);
  clearInterval(engageTimer);
  if (nextTargetRef.type === "stagingBot") {
    performStagingBotAttackCycle();
    engageTimer = setInterval(performStagingBotAttackCycle, 950);
  } else {
    performAttackCycle();
    engageTimer = setInterval(performAttackCycle, getEquippedWeapon().speed);
  }
  return true;
}

function selectAsteroid(asteroidId) {
  const asteroid = getAsteroidById(asteroidId);

  if (!asteroid || !asteroid.alive || asteroid.node !== currentNode) return;

  selectedTarget = { type: "asteroid", id: asteroid.id };
  showTargetPanel();
  const retargeted = retargetEngagementToSelectedTarget();
  updateAsteroidUI();
  updateTargetPanel();
  updateObjectActionPanel(retargeted);
}

function selectHostileBot(botId) {
  if (typeof isStagingLocalCombatBotVisualGuardActive === "function" && isStagingLocalCombatBotVisualGuardActive()) return;

  const bot = getHostileBotById(botId);

  if (!bot || !bot.alive || (bot.currentNodeId || bot.node) !== currentNode) return;

  selectedTarget = { type: "hostileBot", id: bot.id };
  showTargetPanel();
  const retargeted = retargetEngagementToSelectedTarget();
  updateAsteroidUI();
  updateTargetPanel();
  updateObjectActionPanel(retargeted);

  if (tutorialState?.active && getCurrentTutorialStep()?.id === "destroy-bot") {
    setTimeout(renderStarterTutorial, 40);
  }
}

function selectStagingBotTarget(botId) {
  const bot = getStagingBotTargetById(botId);
  if (!bot || !bot.alive || (bot.currentNodeId || bot.node) !== currentNode) return;

  selectedTarget = { type: "stagingBot", id: bot.id };
  showTargetPanel();
  const retargeted = retargetEngagementToSelectedTarget();
  updateAsteroidUI();
  updateTargetPanel();
  updateObjectActionPanel(retargeted);
}

function engageTarget() {
  let target = getSelectedTargetEntity();

  if (!target || !target.alive || (target.currentNodeId || target.node) !== currentNode) {
    target = getVisibleTargets()[0];
    if (target) {
      selectedTarget = {
        type: getTargetTypeFromEntity(target),
        id: target.id
      };
    }
  }

  if (!target || !target.alive || (target.currentNodeId || target.node) !== currentNode) return;
  if (engageTimer) return;

  engagedTarget = getTargetRefFromEntity(target);

  updateAsteroidUI();
  if (engagedTarget?.type === "stagingBot") {
    if (typeof addActivityLog === "function") addActivityLog(`Engaged ${target.name || "Staging Bot"}.`);
    performStagingBotAttackCycle();
    engageTimer = setInterval(performStagingBotAttackCycle, 950);
  } else {
    performAttackCycle();
    engageTimer = setInterval(performAttackCycle, getEquippedWeapon().speed);
  }
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

  Object.assign(target, LupenCombatRules.normalizeTargetCombatLayers(target, HOSTILE_BOT_BASE_HP));
  return target;
}

function syncTargetHpFromLayers(target) {
  if (!target) return;
  Object.assign(target, LupenCombatRules.syncTargetHpFromLayers(target));
  return target;
}

function applyWeaponDamageToTarget(target, weapon) {
  const resolved = LupenCombatRules.resolveWeaponDamageToTarget(target, weapon, Math.random() * 100, HOSTILE_BOT_BASE_HP);
  Object.assign(target, resolved.target);
  return resolved.result;
}

function isPlayerInSpaceView() {
  return Boolean(document.getElementById("spaceScreen")?.classList.contains("active"));
}

function isPlayerInNode(nodeId) {
  return isPlayerInSpaceView() && currentNode === nodeId;
}

function setErebusBotNode(bot, nodeId) {
  if (!bot || !nodeId) return;
  bot.currentNodeId = nodeId;
  bot.node = nodeId;
}

function triggerErebusAggro(attackedBotId, playerId = getPilotName()) {
  const attackedBot = getHostileBotById(attackedBotId);
  if (!attackedBot || attackedBot.faction !== "erebus") return;

  const now = Date.now();
  const nodeId = attackedBot.currentNodeId || attackedBot.node;
  hostileBots
    .filter(bot => bot.faction === "erebus" && bot.aggroState !== "defeated" && (bot.currentNodeId || bot.node) === nodeId)
    .forEach(bot => {
      bot.aggroState = "hostile";
      bot.aggroUntil = now + EREBUS_BOT_AGGRO_MS;
      bot.targetPlayerId = playerId;
    });
}

function updateErebusAggroStates() {
  const now = Date.now();
  hostileBots.forEach(bot => {
    if (bot.faction !== "erebus" || bot.aggroState !== "hostile") return;
    if (engagedTarget?.type === "hostileBot" && engagedTarget.id === bot.id && engageTimer) {
      bot.aggroUntil = now + EREBUS_BOT_AGGRO_MS;
      return;
    }
    if (bot.aggroUntil && now > Number(bot.aggroUntil)) {
      bot.aggroState = "neutral";
      bot.aggroUntil = null;
      bot.targetPlayerId = null;
    }
  });
}

function performAttackCycle() {
  const target = getEngagedTargetEntity();

  if (!target || !target.alive || (target.currentNodeId || target.node) !== currentNode) {
    disengageTarget(true);
    return;
  }

  pulseLaserBurstToTarget(target);
  playPlayerLaserPulse();
  const weapon = getEquippedWeapon();
  const result = applyWeaponDamageToTarget(target, weapon);
  if (result.hit && engagedTarget?.type === "hostileBot" && target.faction === "erebus") {
    triggerErebusAggro(target.id);
  }

  if (target.hp <= 0) {
    showExplosionAtTarget(target);
    if (typeof playEnemyShipDestroyedSound === "function") {
      setTimeout(playEnemyShipDestroyedSound, 140);
    }
    target.alive = false;
    const destroyedType = engagedTarget?.type;

    if (destroyedType === "hostileBot") {
      target.aggroState = "defeated";
      const itemDrops = generateBotLootItems();
      const inventoryResult = addInventoryItems(itemDrops);
      if (inventoryResult.added.length) {
        addHudToast(`${getPilotName()} destroyed ${target.name}. Loot secured: ${summarizeInventoryItems(inventoryResult.added)}.`);
      } else if (itemDrops.length) {
        addHudToast(`${getPilotName()} destroyed ${target.name}. ${INVENTORY_FULL_MESSAGE}`);
      } else {
        addHudToast(`${getPilotName()} destroyed ${target.name}. No equipment recovered.`);
      }
      trackBountyBotKill(target);
      tutorialEvent("destroyedBountyBot");
      awardCombatXpFromBot(target);
      scheduleHostileBotRespawn(target.id);
    } else {
      const drops = generateLootFromAsteroid(target);
      const cargoResult = depositLootToCargo(drops);
      const collectedSummary = summarizeLootMap(cargoResult.collected);
      const overflowSummary = summarizeLootMap(cargoResult.overflow);
      const overflowText = cargoResult.overflowAmount > 0 ? ` ${overflowSummary} left as salvage.` : "";
      const recoveredText = cargoResult.collectedAmount > 0 ? `Cargo recovered: ${collectedSummary}.` : "Cargo hold full.";
      addHudToast(`${getPilotName()} destroyed ${target.name}. ${recoveredText}${overflowText}`);
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
    asteroids = createInitialAsteroids();
    return;
  }

  if (asteroids.length < MAP_ONE_ASTEROID_COUNT) {
    asteroids = normalizeAsteroidCollection(asteroids);
  }

  if (!asteroids.some(asteroid => asteroid.alive)) {
    asteroids = createInitialAsteroids();
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
  const targetType = options.isHostileBot ? "hostileBot" : "asteroid";

  const btn = document.createElement("button");
  btn.className = `${options.className || "asteroid-target"} visible`;

  if (selectedTarget?.type === targetType && selectedTarget?.id === target.id) {
    btn.classList.add("selected", "is-selected");
  }

  if (engagedTarget?.type === targetType && engagedTarget?.id === target.id) {
    btn.classList.add("engaged");
  }

  if (options.isHostileBot) {
    btn.classList.add(...getBotDirectionClass(target).split(" "));
    btn.classList.add(`threat-${String(target.threat || "medium").toLowerCase()}`);
    if (target.aggroState === "hostile") btn.classList.add("is-hostile");
  }

  btn.style.left = `${target.x}%`;
  btn.style.top = `${target.y}%`;
  btn.style.transform = "translate(-50%, -50%)";
  btn.onclick = options.onClick;
  btn.setAttribute("aria-label", target.name);
  if (target.resource) {
    btn.dataset.resource = target.resource;
    btn.style.setProperty("--asteroid-scale", Number(target.scale || 1));
  }

  const hpPct = Math.max(0, (target.hp / target.maxHp) * 100);
  const isSelectedBot = options.isHostileBot && selectedTarget?.type === "hostileBot" && selectedTarget?.id === target.id;
  const fallbackSrc = options.fallbackSrc || EREBUS_BOT_FALLBACK_ASSET;
  const label = isSelectedBot
    ? `<div class="sector-bot-label">
        <strong class="sector-bot-label-text">${escapeHtml(target.displayName || target.name || "Erebus Bot").toUpperCase()}</strong>
      </div>`
    : "";

  btn.innerHTML = `
    <img src="${options.imageSrc}" alt="${target.name}" onerror="this.onerror=null;this.src='${fallbackSrc}'">
    ${label}
    <div class="asteroid-hp-mini"><span style="width:${hpPct}%"></span></div>
  `;

  field.appendChild(btn);
}

function updateAsteroidUI() {
  ensureActiveAsteroids();
  ensureActiveHostileBots();

  if (typeof isStagingLocalCombatBotVisualGuardActive === "function" && isStagingLocalCombatBotVisualGuardActive()) {
    clearLocalHostileBotSelectionForStaging();
  }

  const field = document.getElementById("asteroidField");
  if (!field) return;

  field.innerHTML = "";

  const visibleBots = typeof getVisibleHostileBotsForLocalTargetUi === "function"
    ? getVisibleHostileBotsForLocalTargetUi()
    : hostileBots.filter(bot => bot.alive && (bot.currentNodeId || bot.node) === currentNode);
  const visibleAsteroids = asteroids.filter(asteroid => asteroid.alive && asteroid.node === currentNode);

  separateVisibleTargets([...visibleBots, ...visibleAsteroids]);

  visibleBots.forEach(bot => {
    renderTargetButton(bot, {
      className: "asteroid-target enemy-bot-target",
      imageSrc: bot.image || EREBUS_BOT_FALLBACK_ASSET,
      isHostileBot: true,
      onClick: () => selectHostileBot(bot.id)
    });
  });

  visibleAsteroids.forEach(asteroid => {
    renderTargetButton(asteroid, {
      className: `asteroid-target resource-asteroid-target asteroid-${getAsteroidResourceSlug(asteroid.resource)}`,
      imageSrc: asteroid.image || getAsteroidImage(asteroid.resource),
      fallbackSrc: getCommodityImage(asteroid.resource),
      onClick: () => selectAsteroid(asteroid.id)
    });
  });
}

function clearLocalHostileBotSelectionForStaging() {
  // ?mp=staging shows server-owned Colyseus bot placeholders only. Local real
  // combat bots stay in the single-player state but are not selectable,
  // targetable, or engaged during staging presence tests.
  if (selectedTarget?.type === "hostileBot") selectedTarget = null;
  if (engagedTarget?.type !== "hostileBot") return;

  engagedTarget = null;
  if (engageTimer) {
    clearInterval(engageTimer);
    engageTimer = null;
  }
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

function generateLootFromAsteroid(asteroidOrNode) {
  if (asteroidOrNode && typeof asteroidOrNode === "object") {
    const resource = ASTEROID_RESOURCE_TYPES[asteroidOrNode.resource] ? asteroidOrNode.resource : "Iron";
    const min = Math.max(1, Math.round(Number(asteroidOrNode.dropMin || getAsteroidResourceDefinition(resource).dropMin || 1)));
    const max = Math.max(min, Math.round(Number(asteroidOrNode.dropMax || getAsteroidResourceDefinition(resource).dropMax || min)));
    return {
      [resource]: Math.floor(Math.random() * (max - min + 1)) + min
    };
  }

  const nodeName = asteroidOrNode;
  const fallbackMineral = nodeMineralPools[nodeName]?.[0] || "Iron";
  const definition = getAsteroidResourceDefinition(fallbackMineral);
  const min = Math.max(1, Number(definition.dropMin || 1));
  const max = Math.max(min, Number(definition.dropMax || min));

  return {
    [fallbackMineral]: Math.floor(Math.random() * (max - min + 1)) + min
  };
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

function depositLootToCargo(drops) {
  const collected = {};
  const overflow = {};
  let availableSpace = Math.max(0, getShipStats().cargo - cargoUsed());
  let collectedAmount = 0;
  let overflowAmount = 0;

  Object.entries(drops || {}).forEach(([mineral, amount]) => {
    const quantity = Math.max(0, Math.round(Number(amount || 0)));
    if (!quantity || !mineralKeys.includes(mineral)) return;

    const collectedQuantity = Math.min(quantity, availableSpace);
    const overflowQuantity = quantity - collectedQuantity;

    if (collectedQuantity > 0) {
      cargo[mineral] += collectedQuantity;
      collected[mineral] = (collected[mineral] || 0) + collectedQuantity;
      collectedAmount += collectedQuantity;
      availableSpace -= collectedQuantity;
    }

    if (overflowQuantity > 0) {
      overflow[mineral] = (overflow[mineral] || 0) + overflowQuantity;
      overflowAmount += overflowQuantity;
    }
  });

  if (overflowAmount > 0) {
    addLootToNode(currentNode, overflow);
  }

  updateCargoSummary();
  return { collected, overflow, collectedAmount, overflowAmount };
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

  const spaceNodes = getLowerCombatAsteroidNodeIds();
  const asteroidIndex = Math.max(0, asteroids.indexOf(asteroid));
  const node = spaceNodes[Math.floor(Math.random() * spaceNodes.length)] || createMapOneAsteroid(asteroidIndex).node;
  const refreshed = createAsteroid(asteroid.resource || MAP_ONE_ASTEROID_SPAWN_PLAN[asteroidIndex] || "Iron", node, asteroidIndex);
  Object.assign(asteroid, refreshed, { id: asteroid.id || refreshed.id });

  updateAsteroidUI();
  updateTargetPanel();
}

function performStagingBotAttackCycle() {
  const target = getEngagedTargetEntity();
  if (!target || !target.alive || (target.currentNodeId || target.node) !== currentNode) {
    disengageTarget(true);
    updateObjectActionPanel(true);
    return;
  }

  const client = window.LupenMultiplayerClient;
  const status = client?.getStatus?.();
  const cooldownRemainingMs = Math.max(0, Number(status?.fireCooldownRemainingMs || 0));
  if (!status?.enabled || !status?.isConnected || cooldownRemainingMs > 0) return;

  client.sendSelectedStagingBotCombatIntent?.({
    targetBotId: target.id,
    currentNode,
    timestamp: Date.now()
  });
}

function respawnHostileBot(botId) {
  ensureActiveHostileBots();

  const bot = hostileBots.find(item => item.id === botId) || hostileBots.find(item => !item.alive);
  if (!bot) return;

  const spaceNodes = getAllowedErebusBotNodeIds();
  const botClass = EREBUS_BOT_TYPES[bot.botType] || EREBUS_BOT_TYPES.erebus_attacker;
  const shield = Number(botClass.shield || HOSTILE_BOT_BASE_SHIELD);
  const hullValue = Number(botClass.hull || HOSTILE_BOT_BASE_HP);
  setErebusBotNode(bot, spaceNodes[Math.floor(Math.random() * spaceNodes.length)] || currentNode);
  bot.name = botClass.displayName || bot.name || "Erebus Bot";
  bot.displayName = botClass.displayName || bot.name;
  bot.className = botClass.className || bot.className;
  bot.shield = shield;
  bot.shieldMax = shield;
  bot.maxShield = shield;
  bot.armor = Number(botClass.armor || HOSTILE_BOT_BASE_ARMOR);
  bot.hull = hullValue;
  bot.hullMax = hullValue;
  bot.maxHull = hullValue;
  bot.maxHp = bot.shieldMax + bot.hullMax;
  bot.hp = bot.maxHp;
  bot.alive = true;
  bot.x = Math.floor(Math.random() * 52) + 34;
  bot.y = Math.floor(Math.random() * 34) + 18;
  bot.damage = Number(botClass.damage || HOSTILE_BOT_DAMAGE);
  bot.fireRateMs = Number(botClass.fireRateMs || HOSTILE_BOT_ATTACK_MS);
  bot.accuracy = Number(botClass.accuracy || 1);
  bot.classRole = botClass.role || bot.classRole;
  bot.threat = botClass.threat || bot.threat;
  bot.xpReward = Number(botClass.xpReward || bot.xpReward || XP_CONFIG.combatBotXp);
  bot.creditReward = Number(botClass.creditReward || bot.creditReward || 0);
  bot.moveIntervalMs = Number(botClass.moveIntervalMs || bot.moveIntervalMs || HOSTILE_BOT_MOVE_MS);
  bot.lastMovedAt = Date.now();
  bot.faction = "erebus";
  bot.allegiance = "hostile_neutral";
  bot.aggroState = "neutral";
  bot.aggroUntil = null;
  bot.targetPlayerId = null;
  bot.image = getErebusBotImagePath(botClass.image);

  updateAsteroidUI();
  updateTargetPanel();
}

function getAllowedErebusBotMoves(bot) {
  const currentNodeId = bot?.currentNodeId || bot?.node;
  const current = getNodeById(currentNodeId);
  if (!current) return [];
  const connectedNodeIds = current.connections || current.connectedNodes || current.connects || [];
  return connectedNodeIds.filter(nodeId => isAllowedErebusBotNode(nodeId));
}

function moveHostileBotsBetweenNodes() {
  if (typeof isStagingLocalCombatBotVisualGuardActive === "function" && isStagingLocalCombatBotVisualGuardActive()) return;

  ensureActiveHostileBots();
  updateErebusAggroStates();
  const now = Date.now();

  hostileBots.forEach(bot => {
    if (!bot.alive) return;
    if (bot.faction === "erebus" && bot.aggroState === "defeated") return;

    const botNode = bot.currentNodeId || bot.node;
    if (bot.faction === "erebus" && bot.aggroState === "hostile" && isPlayerInNode(botNode)) return;
    if (now - Number(bot.lastMovedAt || 0) < Number(bot.moveIntervalMs || HOSTILE_BOT_MOVE_MS)) return;

    const options = bot.faction === "erebus"
      ? getAllowedErebusBotMoves(bot)
      : (sectorNodes[botNode]?.connects || []).filter(name => sectorNodes[name]?.type === "space" && sectorNodes[name]?.danger === "hostile");

    if (!options.length) return;

    const botIsEngaged = engagedTarget?.type === "hostileBot" && engagedTarget.id === bot.id && engageTimer;
    if (botIsEngaged && botNode === currentNode) return;

    const nextNode = options[Math.floor(Math.random() * options.length)];
    if (bot.faction === "erebus" && (!isAllowedErebusBotNode(nextNode) || isPlanetNode(nextNode))) return;
    setErebusBotNode(bot, nextNode);
    bot.lastMovedAt = now;
    bot.x = Math.floor(Math.random() * 52) + 34;
    bot.y = Math.floor(Math.random() * 34) + 18;

    if (engagedTarget?.type === "hostileBot" && engagedTarget.id === bot.id && (bot.currentNodeId || bot.node) !== currentNode) {
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
  if (typeof isStagingLocalCombatBotVisualGuardActive === "function" && isStagingLocalCombatBotVisualGuardActive()) return;

  botMovementTimer = setInterval(() => {
    moveHostileBotsBetweenNodes();
  }, HOSTILE_BOT_MOVE_MS);
}

function hostileBotAttackCycle() {
  if (typeof isStagingLocalCombatBotVisualGuardActive === "function" && isStagingLocalCombatBotVisualGuardActive()) return;

  updateErebusAggroStates();
  if (!isPlayerInSpaceView() || isAtPlanetNode()) return;

  const now = Date.now();
  const attackers = getVisibleHostileBots().filter(bot => {
    if (bot.faction !== "erebus") return true;
    if (bot.aggroState !== "hostile" || (bot.aggroUntil && now > Number(bot.aggroUntil))) return false;
    return now - Number(bot.lastFiredAt || 0) >= Number(bot.fireRateMs || HOSTILE_BOT_ATTACK_MS);
  });
  if (!attackers.length) return;

  let totalDamage = 0;

  speakWarning();
  triggerWarningBanner("WARNING");

  attackers.forEach(bot => {
    markBotFacingPlayer(bot);
    bot.lastFiredAt = now;
    if (Math.random() <= Number(bot.accuracy || 1)) {
      totalDamage += Number(bot.damage || HOSTILE_BOT_DAMAGE);
    }
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
  if (typeof isStagingLocalCombatBotVisualGuardActive === "function" && isStagingLocalCombatBotVisualGuardActive()) return;

  botAttackTimer = setInterval(() => {
    hostileBotAttackCycle();
  }, HOSTILE_BOT_ATTACK_MS);
}

function maybeMoveAsteroid() {
  asteroids.forEach(asteroid => {
    if (!asteroid.alive) return;
    if (Math.random() > 0.5) return;

    const currentLinks = sectorNodes[asteroid.node]?.connects || [];
    const spaceLinks = currentLinks.filter(isAllowedAsteroidNode);
    const fallbackSpaceNodes = getLowerCombatAsteroidNodeIds();
    const options = spaceLinks.length ? spaceLinks : fallbackSpaceNodes.filter(name => name !== asteroid.node);

    if (!options.length) return;

    asteroid.node = options[Math.floor(Math.random() * options.length)];
    asteroid.x = Math.floor(Math.random() * 72) + 12;
    asteroid.y = Math.floor(Math.random() * 45) + 12;
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

