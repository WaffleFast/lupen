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
    <div class="level-badge ship-mini-level"><span>LEVEL</span><strong>${combat.level}</strong></div>
    <div class="xp-row">
      <span>XP</span>
      <span>${formatNumber(combat.current)} / ${formatNumber(combat.next)}</span>
    </div>
    <div class="xp-bar" title="Combat Level ${combat.level}: ${formatNumber(combat.current)} / ${formatNumber(combat.next)} XP to next level">
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
  playerStats: "assets/ui/pilot/player-stats.png",
  leaderboards: "assets/ui/pilot/leaderboards.png"
};

function renderPilotStatCard(label, value, meta = "", statClass = "", icon = "") {
  return `
    <div class="pilot-stat-card ${statClass}">
      ${icon ? `<img class="pilot-stat-icon" src="${icon}" alt="" />` : ""}
      <div>
        <span>${label}</span>
        <strong>${value}</strong>
        ${meta ? `<small>${meta}</small>` : ""}
      </div>
    </div>
  `;
}

function renderFuturePilotCard(title, text, icon) {
  return `
    <div class="future-pilot-card">
      <img src="${icon}" alt="" />
      <strong>${title}</strong>
      <small>${text}</small>
      <em aria-label="Locked">LOCKED</em>
    </div>
  `;
}




function renderPilotProfile() {
  const combat = getCombatLevelInfo();
  const nextBotXp = getCombatXpPerBot();
  const totals = playerProgress.totals || {};
  const ship = getCurrentShip();
  const loadout = getShipLoadout(currentShipId);
  const gunLimit = getGunSlotLimit(currentShipId);
  const attachmentLimit = getAttachmentSlotLimit(currentShipId);

  const title = document.getElementById("profilePilotTitle");
  const body = document.getElementById("pilotProfileBody");
  if (title) title.textContent = `${getPilotName().toUpperCase()} PROFILE`;
  if (!body) return;

  const unlockText = `Combat Level ${combat.level}. Earn XP from bots and bounties to progress toward Level ${combat.level + 1}.`;

  body.innerHTML = `
    <section class="pilot-dashboard-hero">
      <div class="pilot-badge-frame">
        <img src="${PILOT_UI_ASSETS.pilotBadge}" alt="" />
      </div>

      <div class="pilot-identity-block">
        <span class="drawer-kicker">Pilot Record</span>
        <strong>${getPilotName()}</strong>
        <small><img src="${PILOT_UI_ASSETS.combatProgress}" alt="" /> Combat Level ${combat.level} / ${ship.name}</small>
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
      ${renderPilotStatCard("Bots Destroyed", formatNumber(totals.botsDestroyed || 0), `Next bot +${formatNumber(nextBotXp)} XP`, "combat-stat", PILOT_UI_ASSETS.botsDestroyed)}
      ${renderPilotStatCard("Bounties Claimed", formatNumber(totals.bountiesClaimed || 0), "Daily contracts", "bounty-stat", PILOT_UI_ASSETS.bounties)}
      ${renderPilotStatCard("Trade Profit", `CR ${formatNumber(totals.tradeProfit || 0)}`, `${formatNumber(totals.tradesCompleted || 0)} trades completed`, "profit-stat", PILOT_UI_ASSETS.tradeProfit)}
      ${renderPilotStatCard("Cargo Sold", formatNumber(totals.cargoSold || 0), "Units moved", "cargo-stat", PILOT_UI_ASSETS.cargoSold)}
      ${renderPilotStatCard("Ships Owned", formatNumber(ownedShips.length), "Fleet size", "fleet-stat", PILOT_UI_ASSETS.currentVessel)}
      ${renderPilotStatCard("Current Vessel", ship.name, `${loadout.guns.length}/${gunLimit} guns / ${loadout.attachments.length}/${attachmentLimit} equip`, "ship-stat", PILOT_UI_ASSETS.currentVessel)}
    </section>

    <section class="pilot-profile-lower">
      <div class="pilot-progression-card">
        <div class="profile-tree-head"><span>Combat Progress</span><strong>Map 1</strong></div>
        <div class="pilot-combat-progress-panel">
          <img src="${PILOT_UI_ASSETS.combatProgress}" alt="" />
          <div>
            <strong>Combat Level ${combat.level}</strong>
            <em>${formatNumber(combat.current)} / ${formatNumber(combat.next)} XP</em>
            <div class="profile-xp-track"><i style="width:${combat.percent}%"></i></div>
            <p>Level progress: ${formatNumber(combat.current)} / ${formatNumber(combat.next)} XP / total combat XP: ${formatNumber(combat.total)} / next bot kill: <b>+${formatNumber(nextBotXp)} XP</b></p>
          </div>
        </div>
      </div>

      <div class="pilot-future-card">
        <div class="profile-tree-head"><span>Online Pilot Systems</span><strong>Later</strong></div>
        <div class="future-profile-grid">
          ${renderFuturePilotCard("Guilds", "Create or join guilds, build alliances, and compete with rival groups.", PILOT_UI_ASSETS.onlineGuilds)}
          ${renderFuturePilotCard("Player Stats", "Search pilots and view public profile records, ships, combat level, trade progress, cargo moved, and bounty history.", PILOT_UI_ASSETS.playerStats)}
          ${renderFuturePilotCard("Leaderboards", "Compare pilots by bounties, trade profit, combat progress, cargo moved, and seasonal rankings.", PILOT_UI_ASSETS.leaderboards)}
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

  const starterShipId = typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
  currentShipId = starterShipId;
  selectedHangarShipId = starterShipId;
  selectedFleetShipId = starterShipId;
  selectedShipyardShipId = starterShipId;
  ownedShips = [starterShipId];
  shipLoadouts = { [starterShipId]: { attachments: [], guns: ["pulseLaser"] } };

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
    setAccountMessage(message, "Account created. Please check your email to confirm your account, then log in.");
    return;
  }

  localStorage.setItem("lupenPendingPilotName", pilotName);

  let profile;
  try {
    profile = await upsertSupabaseProfile(client, user, pilotName);
  } catch (error) {
    setAccountMessage(message, error?.message || "Account created, but pilot profile setup failed.");
    return;
  }

  localStorage.removeItem("lupenPendingPilotName");

  if (!authData.session) {
    setAccountMessage(message, "Account created. Please check your email to confirm your account, then log in.");
    return;
  }

  rememberSupabaseAccount(user, profile);

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

async function login() {
  const email = document.getElementById("loginUser")?.value.trim() || "";
  const password = document.getElementById("loginPassword")?.value || "";
  const message = document.getElementById("loginMessage");
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

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
    const pendingPilotName = localStorage.getItem("lupenPendingPilotName") || user.user_metadata?.pilot_name || "";
    if (pendingPilotName.length >= 3) {
      try {
        profile = await upsertSupabaseProfile(client, user, pendingPilotName);
        localStorage.removeItem("lupenPendingPilotName");
      } catch (profileError) {
        setAccountMessage(message, profileError?.message || "Login succeeded, but profile setup failed.");
        return;
      }
    } else {
      setAccountMessage(message, "Login succeeded, but no pilot profile was found. Please create the account again with a pilot name.");
      return;
    }
  }

  try {
    profile = await touchSupabaseProfile(client, user);
  } catch (error) {
    console.warn("Unable to update profile last_seen.", error);
  }

  rememberSupabaseAccount(user, profile);

  let cloudSaveResult = { loaded: false, exists: false, reason: "unavailable" };
  try {
    cloudSaveResult = typeof loadGameFromSupabase === "function" ? await loadGameFromSupabase() : cloudSaveResult;
    if (cloudSaveResult.loaded) console.info("Loaded Supabase player save.");
    if (!cloudSaveResult.exists) console.info("No Supabase player save found for this account.");
  } catch (error) {
    console.warn("Unable to load Supabase player save. Continuing with local save.", error);
    cloudSaveResult = { loaded: false, exists: false, reason: "error" };
  }

  if (!cloudSaveResult.exists) {
    const localSavePayload = typeof getLocalSavePayloadForCloudMigration === "function" ? getLocalSavePayloadForCloudMigration() : null;
    const hasLocalProgress = typeof hasMeaningfulLocalSave === "function" ? hasMeaningfulLocalSave(localSavePayload) : false;

    console.info("Local-to-cloud save migration check.", {
      cloudSaveExists: cloudSaveResult.exists,
      cloudSaveReason: cloudSaveResult.reason,
      hasLocalProgress
    });

    if (hasLocalProgress && typeof promptUploadLocalSaveToSupabase === "function") {
      const decision = await promptUploadLocalSaveToSupabase();
      console.info("Local-to-cloud save migration decision.", decision);

      if (decision === "upload") {
        try {
          await uploadLocalSavePayloadToSupabase(localSavePayload);
          console.info("Uploaded local save payload to Supabase.");
        } catch (error) {
          console.warn("Unable to upload local save payload to Supabase. Continuing locally.", error);
        }
      }
    }
  }

  setAccountMessage(message, "");

  tutorialState.active = false;
  saveTutorialState();
  clearTutorialOverlayOnly();

  enterHubFromLogin();
}

async function logout() {
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
    image: typeof getShipAsset === "function" ? getShipAsset(STARTER_SHIP_ID, "medium") : "assets/ships/falcon/falcon-medium.webp",
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
      ? loadout.attachments.filter(isAttachmentEntry).map(entry => makeLeveledLoadoutEntry(getEquipmentKey(entry), getEquipmentQuality(entry), getEquipmentLevel(entry)))
      : [],
    guns: Array.isArray(loadout?.guns)
      ? loadout.guns.filter(isGunEntry).map(entry => makeLeveledLoadoutEntry(getEquipmentKey(entry), getEquipmentQuality(entry), getEquipmentLevel(entry)))
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
      count: 0
    };
  }

  const damageLayers = equippedGuns.reduce((sum, item) => {
    const multiplier = getItemStatMultiplier(item.quality) * getItemLevelMultiplier(item.level);
    const base = getWeaponLayerDamage(item.gun);
    sum.shield += Math.round(base.shield * multiplier);
    sum.armor += Math.round(base.armor * multiplier);
    sum.hull += Math.round(base.hull * multiplier);
    return sum;
  }, { shield: 0, armor: 0, hull: 0 });
  const damage = Math.round((damageLayers.shield + damageLayers.armor + damageLayers.hull) / 3);
  const speed = Math.max(...equippedGuns.map(item => item.gun.speed));
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
    if (tutorialState?.active && getCurrentTutorialStep()?.id === "buy-first-ship" && !hasActiveShip()) {
      selectedShipyardShipId = typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
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
  armor = stats.armor;
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
    if (typeof playPlanetLaunchSound === "function") playPlanetLaunchSound();
  }

  showScreen("spaceScreen");
  tutorialEvent("launched");
  updateCurrentNodeUI();
  updateSpaceHUD();
  updateProgressDisplays();
  updateAsteroidUI();
  updateTargetPanel();
  openHudPanel("sector");
  if (typeof syncMultiplayerPresence === "function") syncMultiplayerPresence("launch");

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



