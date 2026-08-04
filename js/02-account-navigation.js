function awardBountyXpOnClaim(contract) {
  const result = addCombatXp(XP_CONFIG.bountyClaimXp, "bounty");
  if (result.gained > 0) {
    addActivityLog(`Bounty XP earned: +${formatNumber(result.gained)} Combat XP.`);
    addHudToast(`Bounty complete: +${formatNumber(result.gained)} Combat XP`);
  }
  recordBountyClaimProgress(contract);
}

function recordBountyClaimProgress(contract = {}) {
  playerProgress = normalizePlayerProgress(playerProgress);
  playerProgress.totals.bountiesClaimed = Math.max(0, Number(playerProgress.totals.bountiesClaimed || 0)) + 1;
  if (typeof recordMissionEvent === "function") {
    recordMissionEvent("claim_bounty", {
      contractId: contract.id || contract.contractId || "",
      title: contract.title || contract.name || "Bounty"
    });
  }
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

function showTradeResultBurst({ good, quantity, profit, revenue, title = "", detail = "", valueMode = false }) {
  const amount = Math.round(Number(valueMode ? revenue : profit || 0));
  const isProfit = valueMode || amount >= 0;
  const absAmount = Math.abs(amount);
  const kicker = title || (valueMode ? "Resources Sold" : isProfit ? "Trade Profit" : "Trade Loss");
  const amountPrefix = valueMode ? "+" : isProfit ? "+" : "-";
  const amountSuffix = valueMode ? " value" : "";
  const meta = detail || `${formatNumber(quantity)} ${good} sold / CR ${formatNumber(revenue)} return`;

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
      <div class="trade-result-kicker">${kicker}</div>
      <div class="trade-result-amount">${amountPrefix}CR ${formatNumber(absAmount)}${amountSuffix}</div>
      <div class="trade-result-meta">${meta}</div>
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
  const reward = objective.reward && typeof objective.reward === "object" ? objective.reward : {};
  const legacyCredits = typeof objective.reward === "number" ? objective.reward : 0;
  const credits = Math.max(0, Number(objective.creditsReward ?? reward.credits ?? legacyCredits ?? 0));
  const shards = Math.max(0, Number(objective.lupenShardsReward ?? reward.lupenShards ?? 0));
  const rewardParts = [];
  if (credits > 0) rewardParts.push(`CR ${formatNumber(credits)}`);
  if (shards > 0) rewardParts.push(`${formatNumber(shards)} Lupen Shard${shards === 1 ? "" : "s"}`);
  const rewardText = rewardParts.length ? rewardParts.join(" · ") : "Reward ready";
  const rawIcon = objective.icon || objective.fallbackIcon || "";
  const bountyIcon = rawIcon && typeof getBountyIconSrc === "function"
    ? getBountyIconSrc(rawIcon)
    : rawIcon;

  showGameRewardBurst({
    type: "bounty",
    kicker: "Bounty Complete",
    title: objective.title || "Contract Complete",
    meta: `${rewardText} ready · Claim at a bounty board`,
    icon: "✓",
    image: bountyIcon
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
  const xpLabel = combat.capped
    ? "MAP 1 MAX"
    : `${formatNumber(combat.current)} / ${formatNumber(combat.next)}`;
  const xpTitle = combat.capped
    ? `Combat Level ${combat.level}: Map 1 maximum reached`
    : `Combat Level ${combat.level}: ${formatNumber(combat.current)} / ${formatNumber(combat.next)} XP to next level`;
  return `
    <div class="level-badge ship-mini-level"><span>LEVEL</span><strong>${combat.level}</strong></div>
    <div class="xp-row">
      <span>XP</span>
      <span>${xpLabel}</span>
    </div>
    <div class="xp-bar" title="${xpTitle}">
      <div class="xp-fill" style="width:${combat.percent}%"></div>
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

const PILOT_UI_ASSETS = {
  pilotBadge: "assets/ui/pilot/pilot-badge.png",
  botsDestroyed: "assets/ui/pilot/bots-destroyed.png",
  bounties: "assets/ui/pilot/bounties.png",
  tradeProfit: "assets/ui/pilot/trade-profit.png",
  cargoSold: "assets/ui/pilot/cargo-sold.png",
  currentVessel: "assets/ui/pilot/current-vessel.png",
  combatProgress: "assets/ui/pilot/combat-progress.png",
  onlineGuilds: "assets/ui/pilot/online-guilds.png",
  playerSearch: "assets/ui/pilot/player-stats.png",
  leaderboards: "assets/ui/pilot/leaderboards.png"
};

function renderPilotStatCard(label, value, meta = "", statClass = "", icon = "") {
  const statKey = String(label || "stat").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  return `
    <article class="pilot-stat-card ${statClass}" data-profile-stat="${escapeHtml(statKey)}">
      ${icon ? `<img class="pilot-stat-icon" src="${icon}" alt="" />` : ""}
      <div>
        <span>${label}</span>
        <strong>${value}</strong>
        ${meta ? `<small>${meta}</small>` : ""}
      </div>
    </article>
  `;
}

function renderFuturePilotCard(id, title, text, icon) {
  return `
    <article class="future-pilot-card" data-pilot-system="${escapeHtml(id)}" aria-disabled="true">
      <img src="${icon}" alt="" />
      <span>
        <strong>${title}</strong>
        <small>${text}</small>
      </span>
      <em>Coming Soon</em>
    </article>
  `;
}

function getPilotProfileJourneySnapshot() {
  const unavailable = { complete: 0, total: 0, percent: 0 };
  const readRequirements = (chapterId) => {
    if (typeof getJourneyChapterRequirementSummary === "function") {
      const summary = getJourneyChapterRequirementSummary(chapterId) || unavailable;
      return {
        complete: Math.max(0, Number(summary.complete || 0)),
        total: Math.max(0, Number(summary.total || 0)),
        percent: Math.min(100, Math.max(0, Number(summary.percent || 0)))
      };
    }
    if (typeof getChapterProgressSummary === "function") {
      const summary = getChapterProgressSummary(chapterId) || unavailable;
      const complete = Math.max(0, Number(summary.completedOrClaimed || 0));
      const total = Math.max(0, Number(summary.total || 0));
      return {
        complete,
        total,
        percent: total ? Math.min(100, Math.round((complete / total) * 100)) : 0
      };
    }
    return unavailable;
  };

  const academy = readRequirements("academy");
  const frontier = readRequirements("frontier");
  const academyComplete = typeof isJourneyAcademyComplete === "function"
    ? Boolean(isJourneyAcademyComplete())
    : academy.total > 0 && academy.complete >= academy.total;
  const frontierComplete = frontier.total > 0 && frontier.complete >= frontier.total;
  const frontierState = frontierComplete ? "complete" : academyComplete ? "active" : "pending";
  const galaxyPercent = typeof getGalaxyCompletionPercent === "function"
    ? Math.min(100, Math.max(0, Number(getGalaxyCompletionPercent() || 0)))
    : 0;

  return {
    academy,
    frontier,
    frontierState,
    frontierLabel: frontierState === "complete" ? "Complete" : frontierState === "active" ? "Active" : "Pending",
    frontierMeta: frontierState === "complete"
      ? "Chapter complete"
      : frontierState === "active"
        ? `${formatNumber(frontier.complete)} / ${formatNumber(frontier.total)} assignments`
        : "Next chapter",
    galaxyPercent
  };
}

function renderPilotProgressBar(percent, label) {
  const safePercent = Math.min(100, Math.max(0, Number(percent || 0)));
  return `
    <div class="pilot-progress-track" role="progressbar" aria-label="${escapeHtml(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${safePercent}">
      <i style="width:${safePercent}%"></i>
    </div>
  `;
}

function renderPilotLoadoutIcon() {
  return `
    <svg class="pilot-record-svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M18 14l10 10-6 6-10-10-4-8 10 2zm28 0L36 24l6 6 10-10 4-8-10 2zM18 50l10-10-6-6-10 10-4 8 10-2zm28 0L36 40l6-6 10 10 4 8-10-2z"/>
      <circle cx="32" cy="32" r="7"/>
    </svg>
  `;
}

function renderPilotFleetIcon() {
  return `
    <svg class="pilot-record-svg" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <path d="M32 6l8 17 15-8-8 17 8 17-15-8-8 17-8-17-15 8 8-17-8-17 15 8 8-17z"/>
      <circle cx="32" cy="32" r="7"/>
    </svg>
  `;
}



function renderPilotProfile() {
  const combat = getCombatLevelInfo();
  const totals = typeof getPlayerProgressTotals === "function" ? getPlayerProgressTotals() : (playerProgress.totals || {});
  const pilotName = String(getPilotName() || "Pilot").trim() || "Pilot";
  const hasActiveVessel = Boolean(currentShipId && SHIPS[currentShipId]);
  const ship = getCurrentShip();
  const shipName = hasActiveVessel ? String(ship.name || "Unnamed vessel") : "No active vessel";
  const shipImage = hasActiveVessel ? String(ship.image || "") : "";
  const loadout = hasActiveVessel ? getShipLoadout(currentShipId) : { guns: [], attachments: [] };
  const gunLimit = hasActiveVessel ? getGunSlotLimit(currentShipId) : 0;
  const attachmentLimit = hasActiveVessel ? getAttachmentSlotLimit(currentShipId) : 0;
  const gunCount = hasActiveVessel ? countEquippedGuns(currentShipId) : 0;
  const attachmentCount = hasActiveVessel ? countEquippedAttachments(currentShipId) : 0;
  const shipsOwnedCount = Array.isArray(ownedShips) ? ownedShips.filter(shipId => SHIPS[shipId]).length : 0;
  const availableShipCount = SHIP_LINES?.[PIONEER_LINE_ID]?.shipIds?.filter(shipId => SHIPS[shipId]).length || 0;
  const journey = getPilotProfileJourneySnapshot();
  const xpRemaining = Math.max(0, Number(combat.next || 0) - Number(combat.current || 0));
  const combatXpLabel = combat.capped
    ? `${formatNumber(combat.total)} XP · MAP 1 MAX`
    : `${formatNumber(combat.current)} / ${formatNumber(combat.next)}`;
  const combatProgressLabel = combat.capped
    ? `Combat Level ${combat.level}, Map 1 maximum reached`
    : `Combat XP progress to Level ${combat.level + 1}`;
  const combatProgressCopy = combat.capped
    ? "Map 1 combat certification complete"
    : `${formatNumber(xpRemaining)} XP to Level ${formatNumber(combat.level + 1)}`;
  const loadoutUnavailable = !hasActiveVessel;
  const gunValue = loadoutUnavailable ? "—" : `${formatNumber(gunCount)} / ${formatNumber(gunLimit)}`;
  const attachmentValue = loadoutUnavailable ? "—" : `${formatNumber(attachmentCount)} / ${formatNumber(attachmentLimit)}`;

  const title = document.getElementById("profilePilotTitle");
  const body = document.getElementById("pilotProfileBody");
  if (title) {
    title.textContent = "PILOT PROFILE";
    title.title = "Pilot Profile";
  }
  if (!body) return;

  body.innerHTML = `
    <section class="pilot-profile-workspace" aria-label="Pilot career record">
      <aside class="pilot-profile-panel pilot-dossier-panel" data-profile-section="identity" aria-label="Pilot identity">
        <header class="pilot-workspace-heading">
          <div><span>PILOT DOSSIER</span><small>Active command record</small></div>
          <em>ACTIVE</em>
        </header>

        <div class="pilot-dossier-badge">
          <img src="${PILOT_UI_ASSETS.pilotBadge}" alt="Combat Level ${formatNumber(combat.level)} pilot insignia" />
        </div>

        <div class="pilot-dossier-identity">
          <span>CALLSIGN</span>
          <strong title="${escapeHtml(pilotName)}">${escapeHtml(pilotName)}</strong>
          <div class="pilot-dossier-rank"><img src="${PILOT_UI_ASSETS.combatProgress}" alt="" /><b>Combat Level ${formatNumber(combat.level)}</b></div>
        </div>

        <div class="pilot-dossier-vessel">
          <div class="pilot-dossier-vessel-art">
            ${shipImage ? `<img src="${escapeHtml(shipImage)}" alt="${escapeHtml(shipName)}" onerror="this.hidden=true" />` : ""}
          </div>
          <div><span>ACTIVE VESSEL</span><strong title="${escapeHtml(shipName)}">${escapeHtml(shipName)}</strong><small>${hasActiveVessel ? escapeHtml(ship.role || ship.roleSubtitle || "Operational hull") : "No vessel assigned"}</small></div>
        </div>
      </aside>

      <main class="pilot-profile-panel pilot-record-panel">
        <section class="pilot-record-header" aria-label="Combat experience">
          <div class="pilot-record-title">
            <span class="pilot-section-kicker">CAREER RECORD</span>
            <h3 title="${escapeHtml(pilotName)}">${escapeHtml(pilotName)}</h3>
            <small>Combat Level ${formatNumber(combat.level)} · ${hasActiveVessel ? escapeHtml(shipName) : "No active vessel"}</small>
          </div>
          <div class="pilot-level-block">
            <div class="pilot-xp-label"><span>COMBAT XP</span><b>${combatXpLabel}</b></div>
            ${renderPilotProgressBar(combat.percent, combatProgressLabel)}
            <p>${combatProgressCopy}</p>
          </div>
        </section>

        <section class="pilot-dashboard-grid" data-profile-section="career-summary" aria-label="Career summary">
          ${renderPilotStatCard("Bots Destroyed", formatNumber(totals.botsDestroyed || 0), "Career total", "combat-stat", PILOT_UI_ASSETS.botsDestroyed)}
          ${renderPilotStatCard("Bounties Completed", formatNumber(totals.bountiesClaimed || 0), "Rewards claimed", "bounty-stat", PILOT_UI_ASSETS.bounties)}
          ${renderPilotStatCard("Trade Profit", `CR ${formatNumber(totals.tradeProfit || 0)}`, `${formatNumber(totals.tradesCompleted || 0)} completed trades`, "profit-stat", PILOT_UI_ASSETS.tradeProfit)}
          ${renderPilotStatCard("Cargo Sold", formatNumber(totals.cargoSold || 0), "Units sold", "cargo-stat", PILOT_UI_ASSETS.cargoSold)}
          ${renderPilotStatCard("Ships Owned", `${formatNumber(shipsOwnedCount)} / ${formatNumber(availableShipCount)}`, "Pioneer hulls", "fleet-stat", PILOT_UI_ASSETS.currentVessel)}
          ${renderPilotStatCard("Galaxy Completion", `${formatNumber(journey.galaxyPercent)}%`, "Overall progress", "ship-stat", PILOT_UI_ASSETS.combatProgress)}
        </section>

        <section class="pilot-record-lower">
          <section class="pilot-subpanel pilot-career-panel" data-profile-section="career-progress" aria-labelledby="pilotCareerHeading">
            <header class="pilot-panel-heading">
              <div><span>JOURNEY PROGRESS</span><small>Current campaign route</small></div>
              <button id="profileOpenJourneyButton" type="button" class="pilot-open-journey" onclick="openJourney()">Open Journey <span aria-hidden="true">›</span></button>
            </header>
            <div class="pilot-journey-rows">
              <article data-career-progress="academy">
                <img src="assets/chapter-academy-icon.png" alt="" />
                <div><span>Academy</span><strong>${formatNumber(journey.academy.complete)} / ${formatNumber(journey.academy.total)} assignments</strong>${renderPilotProgressBar(journey.academy.percent, "Academy assignment progress")}</div>
              </article>
              <article data-career-progress="frontier">
                <img src="assets/chapter-frontier-icon.png" alt="" />
                <div><span>Frontier</span><strong class="pilot-frontier-status pilot-frontier-status--${escapeHtml(journey.frontierState)}">${escapeHtml(journey.frontierLabel)}</strong><small>${escapeHtml(journey.frontierMeta)}</small></div>
              </article>
            </div>
          </section>

          <section class="pilot-subpanel pilot-fleet-panel" data-profile-section="fleet-record" aria-labelledby="pilotFleetHeading">
            <header class="pilot-panel-heading"><div><span id="pilotFleetHeading">FLEET READINESS</span><small>Active hull configuration</small></div></header>
            <div class="pilot-fleet-readiness">
              <article class="pilot-fleet-item pilot-fleet-vessel" data-fleet-record="current-vessel">
                ${shipImage ? `<img src="${escapeHtml(shipImage)}" alt="${escapeHtml(shipName)}" onerror="this.hidden=true" />` : `<img src="${PILOT_UI_ASSETS.currentVessel}" alt="" />`}
                <div><span>Current Vessel</span><strong title="${escapeHtml(shipName)}">${escapeHtml(shipName)}</strong><small>${hasActiveVessel ? "Ready for deployment" : "Unassigned"}</small></div>
              </article>
              <div class="pilot-loadout-readiness" data-fleet-record="loadout">
                <div><span>Weapons</span><strong>${gunValue}</strong>${renderPilotProgressBar(gunLimit ? (gunCount / gunLimit) * 100 : 0, "Weapon slots fitted")}</div>
                <div><span>Equipment</span><strong>${attachmentValue}</strong>${renderPilotProgressBar(attachmentLimit ? (attachmentCount / attachmentLimit) * 100 : 0, "Equipment slots fitted")}</div>
              </div>
              <span class="pilot-fleet-owned-note" data-fleet-record="ships-owned">${formatNumber(shipsOwnedCount)} of ${formatNumber(availableShipCount)} Pioneer hulls owned</span>
            </div>
          </section>
        </section>
      </main>
    </section>
  `;
}


function resetToNoShipStarterState() {
  credits = 10000;
  playerProgress = createDefaultPlayerProgress();
  if (typeof createDefaultMissionProgress === "function") {
    missionProgress = createDefaultMissionProgress();
  }

  mineralKeys.forEach(mineral => { cargo[mineral] = 0; });
  cargoCostBasis = {};
  cargoPurchased = {};
  cargoRecovered = {};

  const starterShipId = typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
  currentShipId = "";
  selectedHangarShipId = starterShipId;
  selectedFleetShipId = starterShipId;
  selectedShipyardShipId = starterShipId;
  ownedShips = [];
  unlockedShipLines = [PIONEER_LINE_ID];
  shipLoadouts = {};
  shipConditions = {};

  Object.keys(ownedAttachments || {}).forEach(key => { ownedAttachments[key] = 0; });
  Object.keys(ownedGuns || {}).forEach(key => { ownedGuns[key] = 0; });
  inventoryItems = [];
  installedAttachments = [];

  activeTradeRoute = null;
  activeObjective = null;
  selectedLooseCargoSellGood = null;
  selectedStationTradeRoute = null;
  stagedTradeOpportunity = null;
  activeTradeTerminalTab = "overview";
  selectedMarketResource = "Iron";
  selectedMarketMode = "buy";
  selectedMarketQuantity = 1;
  dailyTradeDate = null;
  dailyTradeContracts = [];
  selectedDailyTradeContractId = null;
  activeDailyTradeContractId = null;
  dailyTradeContractCargo = null;

  dailyBountyDate = null;
  dailyBountyContracts = [];
  selectedBountyContractId = null;
  activeBountyId = null;

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

  if (typeof clearFirstSessionTransientState === "function") {
    clearFirstSessionTransientState("reset_to_no_ship_starter_state", { clearServerTarget: false, update: false });
  } else {
    if (typeof engageTimer !== "undefined" && engageTimer) {
      clearInterval(engageTimer);
      engageTimer = null;
    }
    if (typeof selectedTarget !== "undefined") selectedTarget = null;
    if (typeof engagedTarget !== "undefined") engagedTarget = null;
  }
}

function initializeStarterShipEmptyLoadout() {
  const starterShipId = typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
  if (shipLoadouts && starterShipId) {
    shipLoadouts[starterShipId] = normalizeShipLoadout({ attachments: [], guns: [] }, starterShipId);
  }
}

function hasActiveShip() {
  return Boolean(currentShipId && SHIPS[currentShipId] && ownedShips.includes(currentShipId));
}

function countEquippedGuns(shipId = currentShipId) {
  return getShipLoadout(shipId).guns.filter(entry => getEquipmentKey(entry)).length;
}

function countEquippedAttachments(shipId = currentShipId) {
  return getShipLoadout(shipId).attachments.filter(entry => getEquipmentKey(entry)).length;
}

function openPilotProfile() {
  renderPilotProfile();
  showScreen("pilotProfileScreen");
  tutorialEvent("openedPilotProfile");
}

function openJourney() {
  if (!sectorNodes[currentNode] || sectorNodes[currentNode].type !== "planet") {
    currentNode = lastPlanetNode || "Asteron Prime";
  }
  if (typeof renderJourneyScreen === "function") renderJourneyScreen({ resetAssignments: true });
  showScreen("journeyScreen");
  tutorialEvent("openedJourney");
}


function setAccountMessage(element, text) {
  if (element) element.textContent = text;
}

function getSupabaseUnavailableMessage() {
  return "Online accounts are unavailable. Check your connection and try again.";
}

function getAuthErrorMessage(error, fallback) {
  const message = String(error?.message || "");
  if (!message) return fallback;
  if (/already registered|already exists|user already/i.test(message)) return "An account already exists for this email.";
  if (/invalid login|invalid credentials/i.test(message)) return "Email or password is incorrect.";
  if (/email not confirmed/i.test(message)) return "Confirm your email before logging in.";
  if (/rate limit|email rate limit|too many/i.test(message)) return "Too many account emails have been requested. Please wait a while and try again.";
  if (/duplicate key|profiles_pilot_name_lower_unique/i.test(message)) return "That pilot name is already taken.";
  return message;
}

function getProfileSetupErrorMessage(error, fallback = "Account created, but profile setup failed. Please refresh or contact support.") {
  const message = String(error?.message || "");
  if (/duplicate key|profiles_pilot_name_lower_unique/i.test(message)) return "That pilot name is already taken.";
  if (/row-level security|permission denied|not authorized|violates row-level/i.test(message)) return fallback;
  return message || fallback;
}

function isValidSupabaseProfileForUser(user, profile) {
  return Boolean(user?.id && profile?.id === user.id && profile?.pilot_name);
}

function getPilotNameForProfileSetup(user, fallback = "Pilot") {
  const candidate = String(user?.user_metadata?.pilot_name || localStorage.getItem(LupenSaveService.storageKeys.pendingPilotName) || fallback || "Pilot").trim();
  return candidate || "Pilot";
}

function shouldLogSupabaseAuthDebug() {
  return ["localhost", "127.0.0.1"].includes(window.location.hostname) || new URLSearchParams(window.location.search).has("debug");
}

function logSupabaseAuthDebug(label, payload) {
  if (shouldLogSupabaseAuthDebug()) console.log(`[Lupen Auth] ${label}`, payload);
}

function rememberSupabaseAccount(user, profile) {
  localStorage.setItem(STORAGE_ACCOUNT_KEY, JSON.stringify({
    id: user.id,
    email: user.email,
    username: profile.pilot_name,
    pilot_name: profile.pilot_name,
    homePlanet,
    updatedAt: new Date().toISOString(),
    supabaseLogin: true
  }));
}

async function loadSupabaseProfile(client, user) {
  const { data, error } = await client
    .from("profiles")
    .select("id,pilot_name,last_seen")
    .eq("id", user.id)
    .single();

  if (error) throw error;
  return data;
}

async function upsertSupabaseProfile(client, user, pilotName) {
  if (!user?.id) throw new Error("Missing authenticated user for profile setup.");
  const response = await client
    .from("profiles")
    .upsert({
      id: user.id,
      pilot_name: pilotName,
      last_seen: new Date().toISOString()
    }, { onConflict: "id" })
    .select("id,pilot_name,last_seen")
    .single();

  logSupabaseAuthDebug("profile upsert response", response);

  const { data, error } = response;
  if (error) throw error;
  return data;
}

async function signOutAfterProfileSetupFailure(client) {
  try {
    await client?.auth?.signOut?.();
  } catch (error) {
    console.warn("Unable to sign out after profile setup failure.", error);
  }
}

async function touchSupabaseProfile(client, user) {
  const { data, error } = await client
    .from("profiles")
    .update({ last_seen: new Date().toISOString() })
    .eq("id", user.id)
    .select("id,pilot_name,last_seen")
    .single();

  if (error) throw error;
  return data;
}

async function createAccount() {
  if (typeof disableCloudSaveSync === "function") disableCloudSaveSync("account_creation_started");
  const email = document.getElementById("createEmail")?.value.trim() || "";
  const pilotName = document.getElementById("createUsername")?.value.trim() || "";
  const password = document.getElementById("createPassword")?.value || "";
  const confirmPassword = document.getElementById("createConfirm")?.value || "";
  const message = document.getElementById("createMessage");
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!emailLooksValid) {
    setAccountMessage(message, "Enter a valid email address.");
    return;
  }

  if (pilotName.length < 3) {
    setAccountMessage(message, "Pilot name must be at least 3 characters.");
    return;
  }

  if (password.length < 6) {
    setAccountMessage(message, "Password must be at least 6 characters.");
    return;
  }

  if (password !== confirmPassword) {
    setAccountMessage(message, "Passwords do not match.");
    return;
  }

  const client = getSupabaseClient();
  if (!client) {
    setAccountMessage(message, getSupabaseUnavailableMessage());
    return;
  }

  setAccountMessage(message, "Creating account...");

  const signUpResponse = await client.auth.signUp({
    email,
    password,
    options: {
      data: {
        pilot_name: pilotName
      }
    }
  });
  logSupabaseAuthDebug("signUp response", signUpResponse);

  const { data: authData, error: signUpError } = signUpResponse;

  if (signUpError) {
    console.warn("Supabase signUp failed.", signUpError);
    setAccountMessage(message, getAuthErrorMessage(signUpError, "Account creation failed."));
    return;
  }

  const user = authData?.user || authData?.session?.user;
  if (!user) {
    setAccountMessage(message, "Account created. Please check your email to confirm your account before logging in.");
    return;
  }

  localStorage.setItem(LupenSaveService.storageKeys.pendingPilotName, pilotName);

  const sessionUser = authData?.session?.user;
  if (!sessionUser?.id) {
    setAccountMessage(message, "Account created. Please check your email to confirm your account before logging in.");
    return;
  }

  if (sessionUser.id !== user.id) {
    await signOutAfterProfileSetupFailure(client);
    setAccountMessage(message, "Account created, but profile setup failed. Please refresh or contact support.");
    return;
  }

  let profile;
  try {
    profile = await upsertSupabaseProfile(client, sessionUser, pilotName);
  } catch (error) {
    console.warn("Supabase profile setup failed after signup.", error);
    await signOutAfterProfileSetupFailure(client);
    setAccountMessage(message, getProfileSetupErrorMessage(error));
    return;
  }

  localStorage.removeItem(LupenSaveService.storageKeys.pendingPilotName);

  rememberSupabaseAccount(sessionUser, profile);

  resetToNoShipStarterState();
  if (typeof enableCloudSaveSync === "function") enableCloudSaveSync(sessionUser.id, "new_account_ready");
  saveGame();
  if (typeof clearStarterTutorialState === "function") clearStarterTutorialState();
  if (typeof saveTutorialState === "function") saveTutorialState();
  if (typeof clearTutorialOverlayOnly === "function") clearTutorialOverlayOnly();
  enterHubFromLogin();
  if (typeof startMorganAcademyOrientation === "function") {
    startMorganAcademyOrientation(sessionUser.id);
  } else if (typeof startStarterTutorial === "function") {
    startStarterTutorial(true, { pilotId: sessionUser.id });
  }
}

function prepareFreshLocalStateAfterMissingCloudSave() {
  if (typeof lupenClearLocalSave === "function") {
    lupenClearLocalSave();
  } else {
    resetToNoShipStarterState();
  }
  if (typeof clearStarterTutorialState === "function") clearStarterTutorialState();
  if (typeof saveTutorialState === "function") saveTutorialState();
  if (typeof clearTutorialOverlayOnly === "function") clearTutorialOverlayOnly();
}

async function login() {
  if (typeof disableCloudSaveSync === "function") disableCloudSaveSync("login_started");
  const email = document.getElementById("loginUser")?.value.trim() || "";
  const password = document.getElementById("loginPassword")?.value || "";
  const message = document.getElementById("loginMessage");
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  let shouldStartMorganOrientation = false;

  if (!emailLooksValid) {
    setAccountMessage(message, "Enter a valid email address.");
    return;
  }

  if (!password) {
    setAccountMessage(message, "Enter your password.");
    return;
  }

  const client = getSupabaseClient();
  if (!client) {
    setAccountMessage(message, getSupabaseUnavailableMessage());
    return;
  }

  setAccountMessage(message, "Logging in...");

  const { data: authData, error: signInError } = await client.auth.signInWithPassword({
    email,
    password
  });

  if (signInError) {
    setAccountMessage(message, getAuthErrorMessage(signInError, "Login failed."));
    return;
  }

  const user = authData?.user;
  if (!user) {
    setAccountMessage(message, "Login did not return a user. Please try again.");
    return;
  }

  let profile;
  try {
    profile = await loadSupabaseProfile(client, user);
  } catch (error) {
    const pilotName = getPilotNameForProfileSetup(user);
    try {
      profile = await upsertSupabaseProfile(client, user, pilotName);
      localStorage.removeItem(LupenSaveService.storageKeys.pendingPilotName);
    } catch (profileError) {
      console.warn("Supabase profile setup failed after login.", profileError);
      setAccountMessage(message, getProfileSetupErrorMessage(profileError, "Login succeeded, but profile setup failed. Please refresh or contact support."));
      return;
    }
  }

  try {
    profile = await touchSupabaseProfile(client, user);
  } catch (error) {
    console.warn("Unable to update profile last_seen.", error);
  }

  if (!isValidSupabaseProfileForUser(user, profile)) {
    setAccountMessage(message, "Login succeeded, but profile setup failed. Please refresh or contact support.");
    return;
  }

  rememberSupabaseAccount(user, profile);

  let cloudSaveResult = { loaded: false, exists: false, reason: "unavailable" };
  let cloudSaveResolutionComplete = false;
  try {
    cloudSaveResult = typeof loadGameFromSupabase === "function" ? await loadGameFromSupabase() : cloudSaveResult;
    if (cloudSaveResult.loaded) console.info("Loaded Supabase player save.");
    if (!cloudSaveResult.exists) console.info("No Supabase player save found for this account.");
    cloudSaveResolutionComplete = cloudSaveResult.loaded === true;
  } catch (error) {
    console.warn("Unable to load Supabase player save. Continuing with local save.", error);
    cloudSaveResult = { loaded: false, exists: false, reason: "error" };
  }

  if (!cloudSaveResult.exists && cloudSaveResult.reason !== "error") {
    const localSaveSource = typeof getLocalSaveMigrationSource === "function"
      ? getLocalSaveMigrationSource()
      : { key: "unknown", payload: typeof getLocalSavePayloadForCloudMigration === "function" ? getLocalSavePayloadForCloudMigration() : null };
    const localSavePayload = localSaveSource.payload || null;
    const localSaveAnalysis = typeof analyzeLocalSaveForCloudMigration === "function"
      ? analyzeLocalSaveForCloudMigration(localSavePayload, localSaveSource.key)
      : { meaningful: typeof hasMeaningfulLocalSave === "function" ? hasMeaningfulLocalSave(localSavePayload) : false, sourceKey: localSaveSource.key, reasons: [] };
    window.lupenLastLocalSaveMigrationAnalysis = localSaveAnalysis;
    const hasLocalProgress = localSaveAnalysis.meaningful === true;

    console.info("Local-to-cloud save migration check.", {
      cloudSaveExists: cloudSaveResult.exists,
      cloudSaveReason: cloudSaveResult.reason,
      hasLocalProgress,
      localSaveKey: localSaveAnalysis.sourceKey,
      localSaveReasons: localSaveAnalysis.reasons
    });
    if (typeof logStagingLocalSaveMigration === "function") {
      logStagingLocalSaveMigration("Local save migration check.", {
        cloudSaveExists: cloudSaveResult.exists,
        cloudSaveReason: cloudSaveResult.reason,
        sourceKey: localSaveAnalysis.sourceKey,
        meaningful: hasLocalProgress,
        reasons: localSaveAnalysis.reasons
      });
    }

    if (hasLocalProgress && typeof promptUploadLocalSaveToSupabase === "function") {
      const decision = await promptUploadLocalSaveToSupabase();
      console.info("Local-to-cloud save migration decision.", decision);

      if (decision === "upload") {
        try {
          await uploadLocalSavePayloadToSupabase(localSavePayload);
          console.info("Uploaded local save payload to Supabase.");
          cloudSaveResolutionComplete = true;
        } catch (error) {
          console.warn("Unable to upload local save payload to Supabase. Continuing locally.", error);
          cloudSaveResolutionComplete = false;
        }
      } else {
        prepareFreshLocalStateAfterMissingCloudSave();
        shouldStartMorganOrientation = true;
        cloudSaveResolutionComplete = true;
        if (typeof logStagingLocalSaveMigration === "function") {
          logStagingLocalSaveMigration("Started fresh because local save migration was declined.", {
            decision,
            sourceKey: localSaveAnalysis.sourceKey,
            reasons: localSaveAnalysis.reasons
          });
        }
      }
    } else {
      prepareFreshLocalStateAfterMissingCloudSave();
      shouldStartMorganOrientation = true;
      cloudSaveResolutionComplete = true;
      if (typeof logStagingLocalSaveMigration === "function") {
        logStagingLocalSaveMigration("Started fresh because no meaningful local save was available.", {
          hasPrompt: typeof promptUploadLocalSaveToSupabase === "function",
          sourceKey: localSaveAnalysis.sourceKey,
          reasons: localSaveAnalysis.reasons
        });
      }
    }
  }

  setAccountMessage(message, "");

  if (cloudSaveResolutionComplete && typeof enableCloudSaveSync === "function") {
    enableCloudSaveSync(user.id, cloudSaveResult.loaded ? "cloud_save_loaded" : "new_cloud_save_ready");
  }
  enterHubFromLogin();
  if (shouldStartMorganOrientation && typeof startMorganAcademyOrientation === "function") {
    startMorganAcademyOrientation(user.id);
  } else if (typeof resumeMorganAcademyOrientation === "function") {
    const resumeResult = resumeMorganAcademyOrientation(user.id);
    if (!resumeResult.started && typeof deactivateMorganAcademyOrientation === "function") {
      deactivateMorganAcademyOrientation();
    }
  } else {
    tutorialState.active = false;
    saveTutorialState();
    clearTutorialOverlayOnly();
  }
}

async function logout() {
  if (typeof disableCloudSaveSync === "function") disableCloudSaveSync("logout");
  const client = getSupabaseClient();
  if (client) {
    const { error } = await client.auth.signOut();
    if (error) console.warn("Supabase sign out failed.", error);
  }
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
  if (document.getElementById("journeyScreen")?.classList.contains("active") && typeof renderJourneyScreen === "function") {
    renderJourneyScreen();
  }
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
    image: typeof getShipAsset === "function" ? getShipAsset(STARTER_SHIP_ID, "medium") : "assets/ships/pioneer-hunter/pioneer-hunter-medium.webp",
    price: 0,
    hull: 0,
    shield: 0,
    armor: 0,
    cargo: 0,
    jumpRecharge: 0,
    speed: 0,
    evasion: 0,
    weaponSlots: 0,
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
  return ship ? (ship.weaponSlots ?? ship.gunSlots ?? 1) : 0;
}

function makeLoadoutEntry(key, quality = "standard") {
  const normalizedQuality = typeof normalizeRarityId === "function" ? normalizeRarityId(quality) : quality;
  return { key, quality: ITEM_QUALITY_ORDER.includes(normalizedQuality) ? normalizedQuality : "standard", level: 1 };
}

function getEquipmentKey(entry) {
  return typeof entry === "string" ? entry : entry?.key;
}

function getEquipmentQuality(entry) {
  if (typeof entry === "string") return "standard";
  const normalizedQuality = typeof normalizeRarityId === "function" ? normalizeRarityId(entry?.quality) : entry?.quality;
  return ITEM_QUALITY_ORDER.includes(normalizedQuality) ? normalizedQuality : "standard";
}

function getEquipmentLevel(entry) {
  if (typeof entry === "string") return 1;
  return Math.min(MAX_ITEM_LEVEL, Math.max(1, Math.floor(Number(entry?.level || 1))));
}

function makeLeveledLoadoutEntry(key, quality = "standard", level = 1) {
  return {
    ...makeLoadoutEntry(key, quality),
    level: Math.min(MAX_ITEM_LEVEL, Math.max(1, Math.floor(Number(level || 1))))
  };
}

function isAttachmentEntry(entry) {
  return Boolean(attachments[getEquipmentKey(entry)]);
}

function isGunEntry(entry) {
  return Boolean(GUNS[getEquipmentKey(entry)]);
}

function getItemLevelMultiplier(level = 1) {
  return 1 + Math.max(0, Math.min(MAX_ITEM_LEVEL, Math.floor(Number(level || 1))) - 1) * 0.045;
}

function getScaledAttachmentEffect(key, quality = "standard", level = 1) {
  const attachment = attachments[key];
  const multiplier = getItemStatMultiplier(quality) * getItemLevelMultiplier(level);
  const effect = { cargo: 0, hull: 0, shield: 0, jumpRecharge: 0, evasion: 0 };

  if (!attachment) return effect;

  Object.entries(attachment.effect || {}).forEach(([effectKey, value]) => {
    effect[effectKey] = Math.max(1, Math.round(value * multiplier));
  });

  return effect;
}

function getDefaultShipGuns(ship) {
  const defaultGuns = Array.isArray(ship?.defaultGuns)
    ? ship.defaultGuns
    : (ship?.defaultGun ? [ship.defaultGun] : []);

  return defaultGuns
    .filter(key => GUNS[key])
    .map(key => makeLeveledLoadoutEntry(key, "standard", 1));
}

function normalizeShipLoadout(loadout, shipId) {
  const starterShipId = typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
  const ship = SHIPS[shipId] || SHIPS[starterShipId] || SHIPS.lupenOrigin;

  if (Array.isArray(loadout)) {
    return {
      attachments: loadout.filter(isAttachmentEntry).map(entry => makeLeveledLoadoutEntry(getEquipmentKey(entry), getEquipmentQuality(entry), getEquipmentLevel(entry))),
      guns: getDefaultShipGuns(ship)
    };
  }

  const normalized = {
    attachments: Array.isArray(loadout?.attachments)
      ? loadout.attachments.map(entry => isAttachmentEntry(entry)
        ? makeLeveledLoadoutEntry(getEquipmentKey(entry), getEquipmentQuality(entry), getEquipmentLevel(entry))
        : null)
      : [],
    guns: Array.isArray(loadout?.guns)
      ? loadout.guns.map(entry => isGunEntry(entry)
        ? makeLeveledLoadoutEntry(getEquipmentKey(entry), getEquipmentQuality(entry), getEquipmentLevel(entry))
        : null)
      : []
  };

  if (loadout === undefined || loadout === null) {
    normalized.guns = getDefaultShipGuns(ship);
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
    return { cargo: 0, hull: 0, hullMax: 0, shield: 0, shieldMax: 0, shieldRegen: 0, armor: 0, speed: 0, jumpRecharge: 0, evasion: 0, weaponSlots: 0, attachmentSlots: 0 };
  }
  const loadout = getShipLoadout(shipId);

  const stats = {
    cargo: Number(ship.baseCargo ?? ship.cargo ?? 0),
    hull: Number(ship.baseHull ?? ship.hull ?? 0),
    armor: Number(ship.baseArmor ?? ship.armor ?? 0),
    shield: Number(ship.baseShield ?? ship.shield ?? 0),
    shieldRegen: Number(ship.baseShieldRegen ?? ship.shieldRegen ?? SHIELD_REGEN_RATE ?? 0),
    jumpRecharge: Number(ship.baseJumpRecharge ?? ship.jumpRecharge ?? 0),
    speed: Number(ship.baseSpeed ?? ship.speed ?? ship.jumpRecharge ?? 0),
    evasion: Number(ship.baseEvasion ?? ship.evasion ?? 0),
    weaponSlots: getGunSlotLimit(shipId),
    attachmentSlots: getAttachmentSlotLimit(shipId)
  };

  loadout.attachments.forEach(entry => {
    const key = getEquipmentKey(entry);
    const quality = getEquipmentQuality(entry);
    const level = getEquipmentLevel(entry);
    const attachment = attachments[key];
    if (!attachment) return;

    const effect = getScaledAttachmentEffect(key, quality, level);
    stats.cargo += Number(effect.cargo || 0);
    stats.hull += Number(effect.hull || 0);
    stats.shield += Number(effect.shield || 0);
    stats.jumpRecharge += Number(effect.jumpRecharge || 0);
    stats.evasion += Number(effect.evasion || 0);
  });

  stats.cargo = Math.max(0, Math.round(stats.cargo));
  stats.hull = Math.max(0, Math.round(stats.hull));
  stats.hullMax = stats.hull;
  stats.shield = Math.max(0, Math.round(stats.shield));
  stats.shieldMax = stats.shield;
  stats.shieldRegen = Math.max(0, Math.round(stats.shieldRegen));
  stats.armor = Math.max(0, Math.round(stats.armor));
  stats.jumpRecharge = Math.max(0, Math.round(stats.jumpRecharge));
  stats.speed = Math.max(0, Math.round(stats.speed));
  stats.evasion = Math.max(0, Math.min(40, Math.round(stats.evasion)));
  return stats;
}

function normalizeShipCondition(shipId = currentShipId, condition = null) {
  const stats = getShipStats(shipId);
  const maxHull = Math.max(0, Number(stats.hull || 0));
  const maxShield = Math.max(0, Number(stats.shield || 0));
  const savedHull = Number(condition?.hull);
  const savedShield = Number(condition?.shield);

  return {
    hull: Math.max(0, Math.min(maxHull, Number.isFinite(savedHull) ? savedHull : maxHull)),
    shield: Math.max(0, Math.min(maxShield, Number.isFinite(savedShield) ? savedShield : maxShield))
  };
}

function ensureShipCondition(shipId = currentShipId) {
  if (!shipId || !SHIPS[shipId]) return { hull: 0, shield: 0 };
  shipConditions = shipConditions && typeof shipConditions === "object" ? shipConditions : {};
  shipConditions[shipId] = normalizeShipCondition(shipId, shipConditions[shipId]);
  return shipConditions[shipId];
}

function saveActiveShipCondition(shipId = currentShipId) {
  if (!shipId || !SHIPS[shipId]) return;
  shipConditions = shipConditions && typeof shipConditions === "object" ? shipConditions : {};
  shipConditions[shipId] = normalizeShipCondition(shipId, { hull, shield });
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

function getWeaponLayerDamage(gun) {
  if (!gun) return { shield: 0, armor: 0, hull: 0 };
  if (gun.damage && typeof gun.damage === "object") {
    return {
      shield: Math.max(1, Number(gun.damage.shield || 0)),
      armor: Math.max(1, Number(gun.damage.armor || gun.damage.armour || 0)),
      hull: Math.max(1, Number(gun.damage.hull || 0))
    };
  }

  const legacyDamage = Math.max(1, Number(gun.damage || gun.legacyDamage || 0));
  return { shield: legacyDamage, armor: legacyDamage, hull: legacyDamage };
}

function getEquippedWeapon(shipId = currentShipId) {
  const loadout = getShipLoadout(shipId);
  const equippedGuns = loadout.guns
    .map(entry => {
      const key = getEquipmentKey(entry);
      const quality = getEquipmentQuality(entry);
      const level = getEquipmentLevel(entry);
      const gun = GUNS[key];
      return gun ? { key, quality, level, gun } : null;
    })
    .filter(Boolean);

  if (!equippedGuns.length) {
    return {
      name: "Unarmed",
      damage: 0,
      damageLayers: { shield: 0, armor: 0, hull: 0 },
      speed: 1600,
      fireRate: 0,
      accuracy: 0,
      range: 0,
      projectileColor: "#7fd6ff",
      fireStyle: "pulse",
      count: 0,
      weapons: []
    };
  }

  const weaponDetails = equippedGuns.map(item => {
    const multiplier = getItemStatMultiplier(item.quality) * getItemLevelMultiplier(item.level);
    const base = getWeaponLayerDamage(item.gun);
    const damageLayers = {
      shield: Math.round(base.shield * multiplier),
      armor: Math.round(base.armor * multiplier),
      hull: Math.round(base.hull * multiplier)
    };
    return {
      key: item.key,
      familyId: item.gun.familyId || item.key,
      name: item.gun.name || item.key,
      quality: item.quality,
      level: item.level,
      projectileColor: item.gun.projectileColor || "#7fd6ff",
      fireStyle: item.gun.fireStyle || "pulse",
      speed: Number(item.gun.speed || 1000),
      fireRate: Number(item.gun.fireRate || (item.gun.speed ? 1000 / item.gun.speed : 1)),
      accuracy: Number(item.gun.accuracy || 90),
      damageLayers,
      damage: Math.round((damageLayers.shield + damageLayers.armor + damageLayers.hull) / 3)
    };
  });
  const damageLayers = equippedGuns.reduce((sum, item) => {
    const multiplier = getItemStatMultiplier(item.quality) * getItemLevelMultiplier(item.level);
    const base = getWeaponLayerDamage(item.gun);
    sum.shield += Math.round(base.shield * multiplier);
    sum.armor += Math.round(base.armor * multiplier);
    sum.hull += Math.round(base.hull * multiplier);
    return sum;
  }, { shield: 0, armor: 0, hull: 0 });
  const damage = Math.round((damageLayers.shield + damageLayers.armor + damageLayers.hull) / 3);
  // The UI resolves a fitted bank as one volley. Weight its cadence by each
  // weapon's contribution so a faster gun keeps adding its intended DPS when
  // mixed with a slower gun instead of inheriting the slowest cooldown.
  const totalVolleyDamage = weaponDetails.reduce((sum, item) => sum + item.damage, 0);
  const combinedDamagePerSecond = weaponDetails.reduce((sum, item) => sum + (item.damage * item.fireRate), 0);
  const speed = combinedDamagePerSecond > 0
    ? Math.max(1, Math.round((totalVolleyDamage / combinedDamagePerSecond) * 1000))
    : Math.max(...weaponDetails.map(item => item.speed));
  const fireRate = Number((1000 / speed).toFixed(2));
  const accuracy = Math.round(equippedGuns.reduce((sum, item) => sum + Number(item.gun.accuracy || 90), 0) / equippedGuns.length);
  const range = Math.max(...equippedGuns.map(item => Number(item.gun.range || 0)));
  const primaryGun = equippedGuns[0]?.gun || {};
  const counts = {};

  equippedGuns.forEach(item => {
    const qualityLabel = item.quality === "standard" ? item.gun.name : `${titleCaseQuality(item.quality)} ${item.gun.name}`;
    const label = item.level > 1 ? `${qualityLabel} Lv ${item.level}` : qualityLabel;
    counts[label] = (counts[label] || 0) + 1;
  });

  const name = Object.entries(counts)
    .map(([gunName, qty]) => qty > 1 ? `${gunName} x${qty}` : gunName)
    .join(" + ");

  return {
    key: equippedGuns[0]?.key || "",
    weaponKeys: equippedGuns.map(item => item.key).filter(Boolean),
    name,
    damage,
    damageLayers,
    speed,
    fireRate,
    accuracy,
    range,
    projectileColor: primaryGun.projectileColor || "#7fd6ff",
    fireStyle: primaryGun.fireStyle || "pulse",
    count: equippedGuns.length,
    weapons: weaponDetails
  };
}

function setSelectedHangarShip(shipId) {
  if (!ownedShips.includes(shipId)) return;

  selectedHangarShipId = shipId;
  renderHangar();
}

function showHangarSection(sectionName) {
  if (typeof hideHangarTooltip === "function") hideHangarTooltip();

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
    if (tutorialState?.active && getCurrentTutorialStep()?.id === "buy-first-ship" && !hasActiveShip()) {
      selectedShipyardShipId = typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
    }
    tutorialEvent("openedVesselExchange");
    renderShipShop();
    renderShipyardDetail();
  }

  if (sectionName === "plans") {
    renderShipPlans();
  }
}

function cargoUsed() {
  const marketCargo = mineralKeys.reduce((total, mineral) => total + (cargo[mineral] || 0), 0);
  const contractCargo = typeof getDailyTradeContractCargoUsed === "function"
    ? getDailyTradeContractCargoUsed()
    : 0;
  return marketCargo + contractCargo;
}

function applyShipStats(refill = false) {
  const stats = getShipStats();
  hullMax = stats.hull;
  shieldMax = stats.shield;
  armor = stats.armor;
  evasion = stats.evasion;
  shieldEnabled = true;

  if (refill) {
    hull = hullMax;
    shield = shieldMax;
  } else {
    const condition = ensureShipCondition(currentShipId);
    hull = condition.hull;
    shield = condition.shield;
  }
  saveActiveShipCondition(currentShipId);

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
    if (typeof playPlanetLaunchSound === "function") playPlanetLaunchSound();
  }

  showScreen("spaceScreen");
  tutorialEvent("launched");
  if (typeof recordMissionEvent === "function") recordMissionEvent("launch_from_station", { node: currentNode });
  updateCurrentNodeUI();
  updateSpaceHUD();
  updateProgressDisplays();
  updateAsteroidUI();
  updateTargetPanel();
  openHudPanel("sector");
  if (typeof syncMultiplayerPresence === "function") syncMultiplayerPresence("launch", { presenceStatus: "space" });

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

  if (typeof playLandingSound === "function") playLandingSound();
  lastPlanetNode = currentNode;
  closeSectorMap();
  if (typeof clearAllCombatVisuals === "function") clearAllCombatVisuals();
  disengageTarget(false);
  if (typeof reconcileTargetSessionState === "function") reconcileTargetSessionState("landed_on_planet");
  updateHubLocation();
  showScreen("gameScreen");
  if (typeof syncMultiplayerPresence === "function") syncMultiplayerPresence("land", { presenceStatus: "docked" });

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

  const carryingMarketCargo = typeof MAP_ONE_TRADE_RESOURCES !== "undefined" &&
    MAP_ONE_TRADE_RESOURCES.some((good) => Math.max(0, Number(cargo?.[good] || 0)) > 0);
  if (typeof beginTradeMarketWindow === "function") {
    beginTradeMarketWindow({ force: !carryingMarketCargo });
  }
  if (typeof isMultiplayerStagingActive === "function" && isMultiplayerStagingActive()) {
    window.LupenMultiplayerClient?.requestStagingTradeOffers?.({
      restartWindow: !carryingMarketCargo
    });
  }

  const tutorialTradeStep = typeof getCurrentTutorialStep === "function" ? getCurrentTutorialStep()?.id : "";
  const tutorialNeedsMarket = [
    "select-market-resource",
    "select-market-target",
    "select-buy-amount",
    "buy-cargo",
    "open-trade-to-sell",
    "sell-cargo"
  ].includes(tutorialTradeStep);
  activeTradeTerminalTab = tutorialNeedsMarket ? "market" : "overview";
  tradeContractsExpanded = false;
  if (["open-trade-to-sell", "sell-cargo"].includes(tutorialTradeStep)) {
    selectedMarketMode = "sell";
    selectedMarketResource = "Iron";
    selectedMarketQuantity = Math.max(1, Number(cargo.Iron || 0));
  } else if (tutorialNeedsMarket) {
    selectedMarketMode = "buy";
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

  if (typeof isMultiplayerStagingActive !== "function" || !isMultiplayerStagingActive()) {
    ensureDailyBounties();
  }
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
  if (typeof selectedLoadoutSlotExplicitlyChosen !== "undefined") selectedLoadoutSlotExplicitlyChosen = false;
  const starterShipId = typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
  selectedHangarShipId = currentShipId || starterShipId;
  selectedShipyardShipId = currentShipId || selectedShipyardShipId || starterShipId;
  renderHangar();
  showScreen("hangarScreen");
  showHangarSection(hasActiveShip() ? "overview" : "shipyard");
}

function openUpgradeForge(options = {}) {
  if (!sectorNodes[currentNode] || sectorNodes[currentNode].type !== "planet") {
    currentNode = lastPlanetNode || "Asteron Prime";
  }

  if (options.selectedItemId) selectedForgeItemId = options.selectedItemId;
  showScreen("upgradeForgeScreen");
  try {
    if (typeof renderUpgradeForge === "function") renderUpgradeForge();
  } catch (error) {
    console.error("Unable to render Upgrade Forge", error);
    const status = document.getElementById("forgeChamberStatus");
    if (status) status.textContent = "Forge systems recalibrating";
  }
  tutorialEvent("openedForge");
}

function openUpgradeForgeFromVault(groupKey = selectedVaultGroupKey) {
  if (groupKey && typeof getForgeItemIdFromVaultGroup === "function") {
    selectedForgeItemId = getForgeItemIdFromVaultGroup(groupKey);
  }
  openUpgradeForge({ selectedItemId: selectedForgeItemId });
}

function returnToHub() {
  stopTradeTerminalTimer();
  stopStoreTimer();
  updateHubLocation();
  showScreen("gameScreen");
  tutorialEvent("returnedToHub");
  saveGame();
}



