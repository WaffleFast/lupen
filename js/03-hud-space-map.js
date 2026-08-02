let activeHudPanel = "chat";
let lastCompactHudPanel = "chat";
let tacticalPanelOpen = false;
let activeTacticalSection = "academy";
let tacticalPanelRenderSignature = "";
let targetCollapseTimer = null;
let inventoryDrawerFilter = "equipment";
let selectedInventoryDetailId = null;
let selectedLoadoutDetail = null;
const INVENTORY_DRAWER_MAX_CARDS = 12;
const TACTICAL_SECTIONS = Object.freeze(["academy", "bounties", "cargo", "comms", "guild"]);

function openHudPanel(panelName) {
  if (panelName === "sector") {
    activateCompactHudPanel("chat");
    return;
  }
  if (panelName === "objectives") {
    activeTacticalSection = "academy";
    openTacticalPanel();
    return;
  }
  if (panelName === "tactical") {
    if (tacticalPanelOpen) closeTacticalPanel();
    else openTacticalPanel();
    return;
  }
  if (tacticalPanelOpen) closeTacticalPanel({ restorePanel: false, returnFocus: false });
  activateCompactHudPanel(panelName);
}

function activateCompactHudPanel(panelName) {
  activeHudPanel = panelName;
  if (["chat", "activity"].includes(panelName)) lastCompactHudPanel = panelName;

  document.querySelectorAll(".hud-inline-panel .hud-panel").forEach(panel => {
    panel.classList.remove("active");
  });

  document.querySelectorAll(".hud-command-tabs button").forEach(button => {
    button.classList.remove("active");
    button.setAttribute("aria-selected", "false");
  });

  const panel = document.getElementById(`${panelName}Panel`);
  const dockButton = document.getElementById(`${panelName}DockBtn`);

  if (panel) panel.classList.add("active");
  if (dockButton) {
    dockButton.classList.add("active");
    dockButton.setAttribute("aria-selected", "true");
  }

  if (panelName === "chat" && typeof renderMultiplayerChatHud === "function") {
    renderMultiplayerChatHud();
  } else if (panelName === "objectives" && typeof renderObjectiveHud === "function") {
    renderObjectiveHud();
  }

  const drawer = document.getElementById("inventoryDrawer");
  if (drawer && panelName !== "inventory") {
    drawer.classList.remove("active");
  }
}

function openTacticalPanel() {
  const backdrop = document.getElementById("tacticalPanelBackdrop");
  const panel = document.getElementById("tacticalPanel");
  if (!backdrop || !panel) return;

  if (["chat", "activity"].includes(activeHudPanel)) lastCompactHudPanel = activeHudPanel;
  tacticalPanelOpen = true;
  activeHudPanel = "tactical";
  document.querySelectorAll(".hud-inline-panel .hud-panel").forEach(item => item.classList.remove("active"));
  document.querySelectorAll(".hud-command-tabs button").forEach(button => {
    const selected = button.id === "tacticalDockBtn";
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", selected ? "true" : "false");
  });
  document.getElementById("tacticalSummaryPanel")?.classList.add("active");

  backdrop.hidden = false;
  backdrop.removeAttribute("inert");
  backdrop.setAttribute("aria-hidden", "false");
  document.getElementById("spaceScreen")?.classList.add("tactical-panel-is-open");
  renderTacticalPanel(true);
  requestAnimationFrame(() => panel.focus({ preventScroll: true }));
}

function closeTacticalPanel(options = {}) {
  const backdrop = document.getElementById("tacticalPanelBackdrop");
  if (!backdrop || !tacticalPanelOpen) return;
  const restorePanel = options.restorePanel !== false;
  const returnFocus = options.returnFocus !== false;

  tacticalPanelOpen = false;
  backdrop.hidden = true;
  backdrop.setAttribute("inert", "");
  backdrop.setAttribute("aria-hidden", "true");
  document.getElementById("spaceScreen")?.classList.remove("tactical-panel-is-open");
  if (restorePanel) activateCompactHudPanel(lastCompactHudPanel || "chat");
  if (returnFocus) requestAnimationFrame(() => document.getElementById("tacticalDockBtn")?.focus({ preventScroll: true }));
}

function handleTacticalBackdropClick(event) {
  if (event?.target === document.getElementById("tacticalPanelBackdrop")) closeTacticalPanel();
}

function selectTacticalSection(sectionName) {
  if (!TACTICAL_SECTIONS.includes(sectionName)) return;
  activeTacticalSection = sectionName;
  renderTacticalPanel(true);
}

document.addEventListener("keydown", event => {
  if (event.key === "Escape" && tacticalPanelOpen) {
    event.preventDefault();
    closeTacticalPanel();
    return;
  }

  if (event.key === "Escape" && document.getElementById("sectorMap")?.classList.contains("active")) {
    event.preventDefault();
    closeSectorMap();
    return;
  }

  if (event.key === "Escape" && document.getElementById("inventoryDrawer")?.classList.contains("active")) {
    event.preventDefault();
    closeShipInventoryDrawer();
  }
});

function escapeTacticalHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getTacticalIconSvg(name = "academy") {
  const paths = {
    academy: '<path d="M3 8l9-5 9 5-9 5-9-5zm3 3v6l6 4 6-4v-6"/>',
    bounties: '<circle cx="12" cy="12" r="7"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4m-10-6v12M6 12h12"/>',
    cargo: '<path d="M4 7l8-4 8 4-8 4-8-4zm0 0v10l8 4 8-4V7M12 11v10"/>',
    comms: '<path d="M4 5h16v11H9l-5 4V5z"/><path d="M8 9h8m-8 3h5"/>',
    guild: '<path d="M12 3l7 4v6c0 4-3 7-7 8-4-1-7-4-7-8V7l7-4z"/><path d="M9 10h6m-7 4h8"/>',
    ship: '<path d="M12 3l4 6-1 8-3 4-3-4-1-8 4-6zM8 12l-4 4 5-1m7-3 4 4-5-1"/>',
    trade: '<path d="M4 8h12l-2-3m2 3-2 3M20 16H8l2 3m-2-3 2-3"/>',
    repair: '<path d="M14 5a5 5 0 01-6 6l-5 5 5 5 5-5a5 5 0 006-6l-3 2-3-3 1-4z"/>',
    combat: '<path d="M5 4l6 6-3 3-6-6 3-3zm14 0-6 6 3 3 6-6-3-3M9 14l-5 5m11-5 5 5"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[name] || paths.academy}</svg>`;
}

function getTacticalCargoState() {
  const used = typeof cargoUsed === "function" ? Math.max(0, Number(cargoUsed() || 0)) : 0;
  const capacity = typeof getShipStats === "function" ? Math.max(0, Number(getShipStats()?.cargo || 0)) : 0;
  const percent = capacity > 0 ? Math.max(0, Math.min(100, Math.round((used / capacity) * 100))) : 0;
  return { used, capacity, percent };
}

function getTacticalTrackedBounty() {
  if (typeof isMultiplayerStagingActive === "function" && isMultiplayerStagingActive() &&
      typeof getActiveMultiplayerStagingBountyObjective === "function") {
    const staging = getActiveMultiplayerStagingBountyObjective();
    if (staging) {
      return {
        title: staging.title || staging.name || "Active Bounty",
        icon: typeof getBountyIconSrc === "function" ? getBountyIconSrc(staging.icon || staging.fallbackIcon) : "",
        progress: Math.max(0, Number(staging.progress ?? staging.kills ?? 0)),
        required: Math.max(1, Number(staging.requiredKills || staging.killsRequired || 1)),
        target: staging.targetNode || staging.targetLabel || "Erebus contact",
        credits: Math.max(0, Number(staging.creditsReward || staging.reward?.credits || 0)),
        shards: Math.max(0, Number(staging.lupenShardsReward || staging.reward?.lupenShards || 0)),
        status: typeof getMultiplayerStagingBountyStatusLabel === "function" ? getMultiplayerStagingBountyStatusLabel(staging) : "ACTIVE"
      };
    }
  }

  if (typeof ensureDailyBounties === "function") ensureDailyBounties();
  const contract = Array.isArray(dailyBountyContracts)
    ? dailyBountyContracts.find(item => item.id === activeBountyId) ||
      dailyBountyContracts.find(item => ["active", "readyToClaim"].includes(item.status)) || null
    : null;
  if (!contract) return null;
  const objective = activeObjective?.type === "bounty" && activeObjective.contractId === contract.id ? activeObjective : null;
  const required = typeof getBountyRequiredKills === "function"
    ? getBountyRequiredKills(contract)
    : Math.max(1, Number(contract.requiredKills || contract.killsRequired || 1));
  const progress = Math.max(0, Number(objective?.kills ?? contract.progress ?? 0));
  const reward = typeof cloneBountyReward === "function" ? cloneBountyReward(contract.reward) : (contract.reward || {});
  return {
    title: contract.title || contract.name || "Active Bounty",
    icon: typeof getBountyIconSrc === "function" ? getBountyIconSrc(contract.icon || contract.fallbackIcon) : "",
    progress,
    required,
    target: contract.area || contract.targetLabel || contract.targetBotLabel || "Erebus contact",
    credits: Math.max(0, Number(reward.credits || 0)),
    shards: Math.max(0, Number(reward.lupenShards || 0)),
    status: typeof getBountyStatusLabel === "function" ? getBountyStatusLabel(contract) : String(contract.status || "ACTIVE").toUpperCase()
  };
}

function getTacticalChatMessages() {
  const client = window.LupenMultiplayerClient;
  const status = client?.getStatus?.() || {};
  const source = status.enabled && client?.getChatMessages
    ? client.getChatMessages({ channel: "sector" })
    : fallbackChatMessages;
  const seen = new Set();
  const messages = (Array.isArray(source) ? source : [])
    .filter(message => message?.type !== "system" && (!message?.channel || message.channel === "sector"))
    .filter(message => {
      const key = String(message.id || `${message.displayName || ""}|${message.message || ""}|${message.receivedAt || ""}`);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(-30);
  return { status, messages };
}

function isTacticalBountyComplete(status = "") {
  return ["READY", "COMPLETE", "COMPLETED", "READY TO CLAIM"].includes(String(status || "").toUpperCase());
}

function renderTacticalSummaryCards() {
  const bounty = getTacticalTrackedBounty();
  const cargoState = getTacticalCargoState();
  const { status } = getTacticalChatMessages();
  const bountyComplete = bounty ? isTacticalBountyComplete(bounty.status) : false;
  const bountyHtml = bounty ? `
    <div class="tactical-summary-bounty">
      <span class="tactical-bounty-icon">${bounty.icon ? `<img src="${escapeTacticalHtml(bounty.icon)}" alt="">` : getTacticalIconSvg("bounties")}</span>
      <div><strong>${escapeTacticalHtml(bounty.title)}</strong><span>${formatNumber(bounty.progress)} / ${formatNumber(bounty.required)} destroyed</span><small>${escapeTacticalHtml(bounty.target)}</small></div>
    </div>
    <div class="tactical-summary-reward"><span>${bountyComplete ? "Reward Ready" : "Reward"}</span><strong>CR ${formatNumber(bounty.credits)} &nbsp;·&nbsp; ${formatNumber(bounty.shards)} Shards</strong></div>
  ` : `<div class="tactical-summary-empty"><strong>No active bounty</strong><span>Contracts can be accepted while docked.</span></div>`;
  const commsState = status.enabled && !status.isConnected ? "Disconnected" : "Sector quiet";
  const commsDetail = status.enabled && !status.isConnected ? "Reconnect to use sector chat" : "No new guild alerts";

  return `
    <aside class="tactical-summary-column" aria-label="Tactical summary">
      <section class="tactical-summary-box active-bounty-summary ${bounty ? "has-active-bounty" : "is-empty"} ${bountyComplete ? "is-ready" : ""}">
        <div class="tactical-summary-heading"><h4>${bountyComplete ? "Bounty Complete" : "Active Bounty"}</h4>${bountyComplete ? `<span>✓ REWARD READY</span>` : ""}</div>
        ${bountyHtml}
      </section>
      <section class="tactical-summary-box cargo-summary-box">
        <div class="tactical-summary-icon">${getTacticalIconSvg("cargo")}</div>
        <div><h4>Cargo Hold</h4><strong>${formatNumber(cargoState.used)} / ${formatNumber(cargoState.capacity)} used</strong><div class="tactical-meter"><i style="width:${cargoState.percent}%"></i></div><small>${cargoState.percent}% capacity</small></div>
      </section>
      <section class="tactical-summary-box comms-summary-box">
        <div class="tactical-summary-icon">${getTacticalIconSvg("comms")}</div>
        <div><h4>Comms Status</h4><strong>${escapeTacticalHtml(commsState)}</strong><small>${escapeTacticalHtml(commsDetail)}</small></div>
      </section>
    </aside>
  `;
}

function getAcademyTacticalIcon(mission) {
  const iconByType = {
    starter_ship_claimed: "ship",
    launch_from_station: "ship",
    profitable_trade: "trade",
    equip_guns: "combat",
    equip_attachment: "repair",
    destroy_bot: "combat",
    repair_ship: "repair"
  };
  return getTacticalIconSvg(iconByType[mission?.objective?.type] || "academy");
}

function renderTacticalAcademy() {
  if (typeof reconcileMissionProgressFromGameplayState === "function") {
    reconcileMissionProgressFromGameplayState({ refresh: false, notify: false, save: false });
  }
  const missions = typeof getVisibleChapterMissions === "function" ? getVisibleChapterMissions("academy") : [];
  const rows = missions.map(mission => {
    const state = typeof getMissionState === "function" ? getMissionState(mission.id) : null;
    const required = typeof getMissionRequiredAmount === "function" ? getMissionRequiredAmount(mission) : 1;
    const progress = typeof getMissionProgressAmount === "function" ? getMissionProgressAmount(mission, state) : Number(state?.progress || 0);
    const complete = ["completed", "claimed"].includes(state?.state) || progress >= required;
    const started = !complete && progress > 0;
    const percent = Math.max(0, Math.min(100, Math.round((progress / Math.max(1, required)) * 100)));
    return `
      <div class="tactical-task-row ${complete ? "is-complete" : started ? "is-progress" : ""}">
        <span class="tactical-task-icon">${getAcademyTacticalIcon(mission)}</span>
        <div class="tactical-task-copy"><strong>${escapeTacticalHtml(mission.title)}</strong><span>${escapeTacticalHtml(mission.briefing || "Complete Academy assignment.")}</span></div>
        <div class="tactical-task-progress"><div class="tactical-meter"><i style="width:${percent}%"></i></div><b>${formatNumber(progress)} / ${formatNumber(required)}</b></div>
        <span class="tactical-task-status">${complete ? "COMPLETE" : started ? "IN PROGRESS" : "PENDING"}</span>
      </div>
    `;
  }).join("");
  const completeCount = missions.filter(mission => {
    const state = typeof getMissionState === "function" ? getMissionState(mission.id) : null;
    return ["completed", "claimed"].includes(state?.state) || (typeof getMissionProgressAmount === "function" && getMissionProgressAmount(mission, state) >= getMissionRequiredAmount(mission));
  }).length;

  return `
    <div class="tactical-primary-column tactical-academy-view" data-tactical-section="academy">
      <div class="tactical-content-heading">
        <span class="tactical-heading-icon">${getTacticalIconSvg("academy")}</span>
        <div><h3>Academy</h3><p>Complete tasks to learn the basics and earn rewards.</p></div>
        <span class="tactical-heading-chip">${formatNumber(completeCount)} / ${formatNumber(missions.length)} COMPLETE</span>
      </div>
      <div class="tactical-task-list" tabindex="0" aria-label="Academy assignment list">${rows || `<div class="tactical-empty-state">Academy assignments are unavailable.</div>`}</div>
    </div>
    ${renderTacticalSummaryCards()}
  `;
}

function getTacticalBountyRows() {
  if (typeof isMultiplayerStagingActive === "function" && isMultiplayerStagingActive() &&
      typeof shouldUseLocalTutorialBountyFallback === "function" && !shouldUseLocalTutorialBountyFallback() &&
      typeof getMultiplayerStagingBounties === "function") {
    return getMultiplayerStagingBounties().map(contract => ({
      id: contract.id,
      title: contract.title || contract.name || "Bounty Contract",
      description: contract.description || `Destroy ${contract.requiredKills || 1} Erebus bots.`,
      icon: typeof getBountyIconSrc === "function" ? getBountyIconSrc(contract.icon || contract.fallbackIcon) : "",
      progress: Math.max(0, Number(contract.progress ?? contract.kills ?? 0)),
      required: Math.max(1, Number(contract.requiredKills || contract.killsRequired || 1)),
      credits: Math.max(0, Number(contract.creditsReward || contract.reward?.credits || 0)),
      shards: Math.max(0, Number(contract.lupenShardsReward || contract.reward?.lupenShards || 0)),
      status: typeof getMultiplayerStagingBountyStatusLabel === "function" ? getMultiplayerStagingBountyStatusLabel(contract) : "AVAILABLE",
      timer: ""
    }));
  }
  if (typeof ensureDailyBounties === "function") ensureDailyBounties();
  return (Array.isArray(dailyBountyContracts) ? dailyBountyContracts : []).map(contract => {
    const objective = activeObjective?.type === "bounty" && activeObjective.contractId === contract.id ? activeObjective : null;
    const required = typeof getBountyRequiredKills === "function" ? getBountyRequiredKills(contract) : Number(contract.requiredKills || 1);
    const reward = typeof cloneBountyReward === "function" ? cloneBountyReward(contract.reward) : (contract.reward || {});
    return {
      id: contract.id,
      title: contract.title || contract.name || "Bounty Contract",
      description: typeof getBountyObjectiveText === "function" ? getBountyObjectiveText(contract) : contract.description,
      icon: typeof getBountyIconSrc === "function" ? getBountyIconSrc(contract.icon || contract.fallbackIcon) : "",
      progress: Math.max(0, Number(objective?.kills ?? contract.progress ?? 0)),
      required: Math.max(1, Number(required || 1)),
      credits: Math.max(0, Number(reward.credits || 0)),
      shards: Math.max(0, Number(reward.lupenShards || 0)),
      status: typeof getBountyStatusLabel === "function" ? getBountyStatusLabel(contract) : String(contract.status || "AVAILABLE").toUpperCase(),
      timer: typeof getBountyTimerLabel === "function" ? getBountyTimerLabel(contract) : ""
    };
  });
}

function renderTacticalBounties() {
  const rows = getTacticalBountyRows();
  const reset = typeof getDailyResetSeconds === "function" && typeof formatBountyTime === "function"
    ? formatBountyTime(getDailyResetSeconds())
    : "--:--";
  return `
    <div class="tactical-full-view" data-tactical-section="bounties">
      <div class="tactical-content-heading">
        <span class="tactical-heading-icon">${getTacticalIconSvg("bounties")}</span>
        <div><h3>Bounties</h3><p>Live contract progress. Accept and claim contracts from a bounty board.</p></div>
        <span class="tactical-heading-chip">RESET ${escapeTacticalHtml(reset)}</span>
      </div>
      <div class="tactical-bounty-grid">
        ${rows.map(contract => {
          const percent = Math.max(0, Math.min(100, Math.round((contract.progress / Math.max(1, contract.required)) * 100)));
          const complete = isTacticalBountyComplete(contract.status);
          const active = String(contract.status || "").toUpperCase() === "ACTIVE";
          const statusLabel = complete ? "✓ COMPLETE" : active ? "✓ ACTIVE CONTRACT" : contract.status;
          return `<article class="tactical-bounty-card status-${escapeTacticalHtml(contract.status.toLowerCase().replaceAll(" ", "-"))} ${complete ? "is-ready" : ""} ${active ? "is-active" : ""}">
            <div class="tactical-bounty-card-top">
              <span class="tactical-bounty-icon">${contract.icon ? `<img src="${escapeTacticalHtml(contract.icon)}" alt="">` : getTacticalIconSvg("bounties")}</span>
              <div><h4>${escapeTacticalHtml(contract.title)}</h4><p>${escapeTacticalHtml(contract.description || "Contract objective")}</p></div>
              <span class="tactical-status-chip">${escapeTacticalHtml(statusLabel)}</span>
            </div>
            <div class="tactical-bounty-progress"><div class="tactical-meter"><i style="width:${percent}%"></i></div><strong>${formatNumber(contract.progress)} / ${formatNumber(contract.required)}</strong></div>
            <footer><span>CR ${formatNumber(contract.credits)} &nbsp;·&nbsp; ${formatNumber(contract.shards)} Shards</span>${complete ? `<small>CLAIM AT BOUNTY BOARD</small>` : active ? `<small>TRACKING NOW</small>` : contract.timer ? `<small>${escapeTacticalHtml(contract.timer)}</small>` : ""}</footer>
          </article>`;
        }).join("") || `<div class="tactical-empty-state">No bounty contracts are currently available.</div>`}
      </div>
    </div>
  `;
}

function renderTacticalCargo() {
  const state = getTacticalCargoState();
  const contractPackage = typeof getDailyTradeContractCargo === "function"
    ? getDailyTradeContractCargo()
    : null;
  const contractRow = contractPackage ? `<article class="tactical-cargo-item is-contract-cargo">
      <img src="${escapeTacticalHtml(contractPackage.image)}" alt="">
      <div><strong>${escapeTacticalHtml(contractPackage.name)}</strong><span>Sealed contract package</span></div>
      <dl><div><dt>Cargo</dt><dd>${formatNumber(contractPackage.cargoSpace)}</dd></div><div><dt>Deliver To</dt><dd>${escapeTacticalHtml(contractPackage.destination)}</dd></div></dl>
    </article>` : "";
  const mineralRows = mineralKeys.map(mineral => {
    const total = Math.max(0, Number(cargo[mineral] || 0));
    if (!total) return "";
    const recovered = typeof getRecoveredCargoQuantity === "function" ? getRecoveredCargoQuantity(mineral) : 0;
    const purchased = Math.max(0, total - recovered);
    return `<article class="tactical-cargo-item">
      <img src="${escapeTacticalHtml(getCommodityImage(mineral))}" alt="">
      <div><strong>${escapeTacticalHtml(mineral)}</strong><span>${formatNumber(total)} total</span></div>
      <dl><div><dt>Purchased</dt><dd>${formatNumber(purchased)}</dd></div><div><dt>Recovered</dt><dd>${formatNumber(recovered)}</dd></div></dl>
    </article>`;
  }).join("");
  const foundItems = typeof groupInventoryItems === "function" ? groupInventoryItems(inventoryItems || []) : [];
  const itemRows = foundItems.map(item => `<article class="tactical-found-item quality-${escapeTacticalHtml(item.quality || "standard")}">
    <img src="${escapeTacticalHtml(item.icon || "")}" alt=""><div><strong>${escapeTacticalHtml(item.name)}</strong><span>${escapeTacticalHtml(item.category || "Equipment")}</span></div><b>x${formatNumber(item.count)}</b>
  </article>`).join("");
  return `
    <div class="tactical-full-view tactical-cargo-view" data-tactical-section="cargo">
      <div class="tactical-content-heading">
        <span class="tactical-heading-icon">${getTacticalIconSvg("cargo")}</span>
        <div><h3>Cargo Hold</h3><p>Market resources, sealed contract packages, and found equipment remain separate.</p></div>
        <span class="tactical-heading-chip">${formatNumber(state.used)} / ${formatNumber(state.capacity)}</span>
      </div>
      <div class="tactical-cargo-capacity"><div><strong>${state.percent}% CAPACITY</strong><span>${formatNumber(Math.max(0, state.capacity - state.used))} units available</span></div><div class="tactical-meter"><i style="width:${state.percent}%"></i></div></div>
      <div class="tactical-cargo-ledgers">
        <section><h4>Cargo Manifest</h4><div class="tactical-ledger-list">${contractRow}${mineralRows || (!contractRow ? `<div class="tactical-empty-state">No cargo in the hold.</div>` : "")}</div></section>
        <section><h4>Found Equipment</h4><div class="tactical-found-grid">${itemRows || `<div class="tactical-empty-state">No found equipment carried.</div>`}</div></section>
      </div>
    </div>
  `;
}

function renderTacticalComms() {
  const { status, messages } = getTacticalChatMessages();
  const canChat = !status.enabled || status.isConnected;
  return `
    <div class="tactical-full-view tactical-comms-view" data-tactical-section="comms">
      <div class="tactical-content-heading">
        <span class="tactical-heading-icon">${getTacticalIconSvg("comms")}</span>
        <div><h3>Comms</h3><p>Sector communications use the same live player chat channel.</p></div>
        <span class="tactical-heading-chip ${canChat ? "is-online" : "is-offline"}">${canChat ? "ONLINE" : "DISCONNECTED"}</span>
      </div>
      <div class="tactical-chat-channels" role="tablist" aria-label="Chat channels">
        <button type="button" role="tab" aria-selected="true" class="active">Sector</button>
        <button type="button" role="tab" aria-selected="false" disabled>Local</button>
        <button type="button" role="tab" aria-selected="false" disabled>Guild</button>
      </div>
      <div class="tactical-chat-feed" aria-live="polite">
        ${messages.length ? messages.map(entry => `<div class="tactical-chat-line"><strong>${escapeTacticalHtml(entry.displayName || "Pilot")}</strong><span>${escapeTacticalHtml(entry.message || "")}</span></div>`).join("") : `<div class="tactical-empty-state">${canChat ? "No player messages yet." : "Chat unavailable while disconnected."}</div>`}
      </div>
      <div class="tactical-chat-input-row">
        <input id="tacticalChatInput" type="text" maxlength="200" placeholder="${canChat ? "Sector message..." : "Chat unavailable while disconnected."}" ${canChat ? "" : "disabled"} onkeydown="handleTacticalChatKey(event)">
        <button type="button" onclick="sendTacticalChatMessage()" ${canChat ? "" : "disabled"}>Send</button>
      </div>
    </div>
  `;
}

function sendTacticalChatMessage() {
  const tacticalInput = document.getElementById("tacticalChatInput");
  const compactInput = document.getElementById("localChatInput");
  if (!tacticalInput || !compactInput) return;
  compactInput.value = tacticalInput.value;
  sendLocalChatMessage();
  tacticalInput.value = "";
  renderTacticalPanel(true);
  requestAnimationFrame(() => document.getElementById("tacticalChatInput")?.focus({ preventScroll: true }));
}

function handleTacticalChatKey(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    sendTacticalChatMessage();
  }
}

function renderTacticalGuild() {
  return `
    <div class="tactical-full-view tactical-guild-view" data-tactical-section="guild">
      <div class="tactical-content-heading">
        <span class="tactical-heading-icon">${getTacticalIconSvg("guild")}</span>
        <div><h3>Guild / Alliance</h3><p>Organisation tools will connect pilots under a shared banner.</p></div>
        <span class="tactical-heading-chip">COMING LATER</span>
      </div>
      <div class="tactical-placeholder-card">
        <span>${getTacticalIconSvg("guild")}</span>
        <h4>Alliance systems are not yet active</h4>
        <p>This space is reserved for membership, shared alerts, and guild communications. No placeholder state is being saved.</p>
      </div>
    </div>
  `;
}

function renderTacticalPanel(force = false) {
  const content = document.getElementById("tacticalPanelContent");
  if (!content || !tacticalPanelOpen) return;
  const activeElement = document.activeElement;
  const preserveCommsInput = !force && activeTacticalSection === "comms" && activeElement?.id === "tacticalChatInput";

  document.querySelectorAll(".tactical-panel-nav [role='tab']").forEach(button => {
    const selected = button.id === `tacticalNav${activeTacticalSection.charAt(0).toUpperCase()}${activeTacticalSection.slice(1)}`;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", selected ? "true" : "false");
    button.tabIndex = selected ? 0 : -1;
  });

  if (preserveCommsInput) return;
  const renderers = {
    academy: renderTacticalAcademy,
    bounties: renderTacticalBounties,
    cargo: renderTacticalCargo,
    comms: renderTacticalComms,
    guild: renderTacticalGuild
  };
  const nextHtml = (renderers[activeTacticalSection] || renderTacticalAcademy)();
  const nextSignature = `${activeTacticalSection}|${nextHtml}`;
  if (!force && content.childElementCount && tacticalPanelRenderSignature === nextSignature) return;

  const scrollSelectors = [
    ".tactical-task-list",
    ".tactical-bounty-grid",
    ".tactical-ledger-list",
    ".tactical-found-grid",
    ".tactical-chat-feed"
  ];
  const scrollPositions = Object.fromEntries(scrollSelectors.map(selector => [
    selector,
    content.querySelector(selector)?.scrollTop || 0
  ]));

  content.innerHTML = nextHtml;
  tacticalPanelRenderSignature = nextSignature;
  content.setAttribute("aria-label", `${activeTacticalSection} tactical section`);
  scrollSelectors.forEach(selector => {
    const element = content.querySelector(selector);
    if (element) element.scrollTop = Math.min(scrollPositions[selector] || 0, Math.max(0, element.scrollHeight - element.clientHeight));
  });
}

function refreshTacticalPanel(force = false) {
  if (tacticalPanelOpen) renderTacticalPanel(force);
}

function closeShipInventoryDrawer() {
  const drawer = document.getElementById("inventoryDrawer");
  const inventoryButton = document.getElementById("shipInventoryBtn");
  const cargoButton = document.getElementById("hudCargoSummary");
  if (drawer) {
    drawer.classList.remove("active");
    drawer.setAttribute("aria-hidden", "true");
  }
  if (inventoryButton) inventoryButton.classList.remove("active");
  if (cargoButton) {
    cargoButton.classList.remove("active");
    cargoButton.setAttribute("aria-expanded", "false");
    if (document.getElementById("spaceScreen")?.classList.contains("active")) {
      requestAnimationFrame(() => cargoButton.focus({ preventScroll: true }));
    }
  }
}

function toggleShipInventoryDrawer(event = null) {
  if (event?.stopPropagation) event.stopPropagation();

  const drawer = document.getElementById("inventoryDrawer");
  const button = document.getElementById("shipInventoryBtn");
  const cargoButton = document.getElementById("hudCargoSummary");
  if (!drawer) return;

  drawer.classList.toggle("active");
  if (button) button.classList.toggle("active", drawer.classList.contains("active"));
  if (cargoButton) {
    cargoButton.classList.toggle("active", drawer.classList.contains("active") && inventoryDrawerFilter === "cargo");
    cargoButton.setAttribute("aria-expanded", drawer.classList.contains("active") ? "true" : "false");
  }
  drawer.setAttribute("aria-hidden", drawer.classList.contains("active") ? "false" : "true");

  if (drawer.classList.contains("active")) {
    tutorialEvent("openedLoadout");

    renderInventoryDrawer();
  }

  updateShipStorageHud();
}

function openShipStorageDrawer(filter = "equipment", event = null) {
  if (event?.stopPropagation) event.stopPropagation();

  const drawer = document.getElementById("inventoryDrawer");
  if (!drawer) return;

  const normalizedFilter = filter === "cargo" ? "cargo" : "equipment";
  const wasActive = drawer.classList.contains("active");
  const wasSameFilter = inventoryDrawerFilter === normalizedFilter;

  inventoryDrawerFilter = normalizedFilter;
  selectedInventoryDetailId = null;

  if (wasActive && wasSameFilter) {
    closeShipInventoryDrawer();
    return;
  }

  drawer.classList.add("active");
  drawer.setAttribute("aria-hidden", "false");
  renderInventoryDrawer();
  updateShipStorageHud();
}

document.addEventListener("click", event => {
  const drawer = document.getElementById("inventoryDrawer");
  if (!drawer || !drawer.classList.contains("active")) return;

  const eventPath = typeof event.composedPath === "function" ? event.composedPath() : [];
  const clickedDrawer = drawer.contains(event.target) || eventPath.includes(drawer);
  const clickedInventoryButton = event.target.closest?.("#shipInventoryBtn, #hudCargoSummary");
  const clickedModal = event.target.closest?.(".sector-map, .market-screen, .hangar-screen, .store-screen, .bounty-screen, .pilot-profile-screen");

  if (!clickedDrawer && !clickedInventoryButton && !clickedModal) {
    closeShipInventoryDrawer();
  }
});

function closeHudPanel() {
  openHudPanel("chat");
}

function updateShipStorageHud() {
  const inventoryButton = document.getElementById("shipInventoryBtn");
  const cargoButton = document.getElementById("hudCargoSummary");
  const inventorySlots = document.getElementById("hudInventorySlots");
  const drawer = document.getElementById("inventoryDrawer");
  const groupedItems = groupInventoryItems(inventoryItems);
  const totalInventoryItems = getCarriedInventoryItemCount();

  if (inventorySlots) {
    inventorySlots.textContent = `${formatNumber(totalInventoryItems)}/${formatNumber(MAX_CARRIED_INVENTORY_ITEMS)} items`;
  }

  const drawerActive = !!drawer && drawer.classList.contains("active");

  if (inventoryButton) {
    inventoryButton.classList.toggle("active", drawerActive && inventoryDrawerFilter === "equipment");
    inventoryButton.classList.toggle("has-alert", totalInventoryItems > 0 || groupedItems.length > 0);
  }
  if (cargoButton) {
    cargoButton.classList.toggle("active", drawerActive && inventoryDrawerFilter === "cargo");
    cargoButton.setAttribute("aria-expanded", drawerActive ? "true" : "false");
  }
  if (drawer) drawer.setAttribute("aria-hidden", drawerActive ? "false" : "true");
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
  const contractPackage = typeof getDailyTradeContractCargo === "function"
    ? getDailyTradeContractCargo()
    : null;

  if (contractPackage) {
    entries.push({
      type: "cargo",
      key: contractPackage.packageId,
      name: contractPackage.name,
      quantity: 1,
      cargoSpace: contractPackage.cargoSpace,
      quality: "contract",
      rarity: "Contract Package",
      icon: contractPackage.image,
      category: "Contract Cargo",
      source: "contract",
      destination: contractPackage.destination,
      description: contractPackage.description
    });
  }

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
  inventoryDrawerFilter = filter === "cargo" ? "cargo" : "equipment";
  selectedInventoryDetailId = null;
  selectedLoadoutDetail = null;
  renderInventoryDrawer();
  updateShipStorageHud();
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

    return `<button class="equipped-orbit-slot loadout-icon-slot quality-${quality} ${selected ? "selected" : ""}" onclick="selectLoadoutSlot('${kind}', ${index})" title="${titleCaseQuality(quality)} ${name} / ${effectLine}">
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
          <img src="${typeof getShipAsset === "function" ? getShipAsset(currentShipId, "medium") : ship.image}" alt="${ship.name}">
          <strong>${ship.name}</strong>
          <span>${gunSlots} gun / ${attachmentSlots} attachment slots</span>
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
        <img src="${typeof getShipAsset === "function" ? getShipAsset(currentShipId, "small") : ship.image}" alt="${ship.name}">
        <div><strong>Current Loadout</strong><span>Click an equipped item to inspect stats</span></div>
      </div>
      <div class="inventory-detail-stats">
        <span>Hull <strong>${formatNumber(hullMax)}</strong></span>
        <span>Shield <strong>${formatNumber(shieldMax)}</strong></span>
        <span>Armor <strong>${formatNumber(armor)}</strong></span>
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
    ? getInventoryEffectLine({ key, quality, kind })
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
  const itemCount = getCarriedInventoryItemCount();

  if (count) {
    count.textContent = `${formatNumber(totalCargo)} cargo / ${formatNumber(itemCount)} of ${formatNumber(MAX_CARRIED_INVENTORY_ITEMS)} items`;
  }

  if (!entries.length) {
    grid.innerHTML = `<div class="inventory-drawer-empty">Nothing to show.</div>`;
    detail.innerHTML = `<div class="inventory-detail-empty">Select cargo or equipment to inspect.</div>`;
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
    if (entry.source === "contract") {
      detail.innerHTML = `
        <div class="inventory-detail-title">
          <img src="${entry.icon}" alt="${entry.name}">
          <div><strong>${entry.name}</strong><span>Sealed contract package</span></div>
        </div>
        <div class="inventory-detail-stats">
          <span>Cargo Space <strong>${formatNumber(entry.cargoSpace)}</strong></span>
          <span>Destination <strong>${entry.destination}</strong></span>
          <span>Status <strong>In Transit</strong></span>
        </div>
        <p class="inventory-contract-cargo-note">${entry.description || "Deliver this sealed package to its destination."}</p>
      `;
      return;
    }
    const unitBasis = cargoCostBasis[entry.key] || 0;
    const recoveredQuantity = typeof getRecoveredCargoQuantity === "function" ? getRecoveredCargoQuantity(entry.key) : (!unitBasis ? Number(entry.quantity || 0) : 0);
    const heldQuantity = Number(entry.quantity || 0);
    const recoveredCargo = recoveredQuantity > 0 && recoveredQuantity >= heldQuantity;
    const mixedCargo = recoveredQuantity > 0 && recoveredQuantity < heldQuantity;
    detail.innerHTML = `
      <div class="inventory-detail-title">
        <img src="${entry.icon}" alt="${entry.name}">
        <div><strong>${entry.name}</strong><span>${entry.rarity} resource</span></div>
      </div>
      <div class="inventory-detail-stats">
        <span>Held <strong>${formatNumber(entry.quantity)}</strong></span>
        <span>Source <strong>${recoveredCargo ? "Recovered" : mixedCargo ? "Mixed" : "Purchased"}</strong></span>
        <span>Avg Cost <strong>${recoveredCargo || !unitBasis ? "None" : `CR ${formatNumber(Math.round(unitBasis))}`}</strong></span>
        ${mixedCargo ? `<span>Recovered <strong>${formatNumber(recoveredQuantity)}</strong></span>` : ""}
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
    ? getInventoryEffectLine(entry)
    : isAttachment && attachment
      ? getStoreAttachmentEffectText({ key: entry.key }, entry.quality)
      : itemDef.core
        ? "Upgrade material"
        : "Owned item";
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
  `;
}

function equipInventoryItemToCurrentShip(key, quality = "standard", source = "inventory") {
  selectedHangarShipId = currentShipId;
  const loadout = getShipLoadout(currentShipId);
  const isAttachment = Boolean(attachments[key]);
  const isGun = Boolean(GUNS[key]);

  if (!isAttachment && !isGun) return;

  const targetList = isAttachment ? loadout.attachments : loadout.guns;
  const targetLimit = isAttachment ? getAttachmentSlotLimit(currentShipId) : getGunSlotLimit(currentShipId);
  const emptyIndex = Array.from({ length: targetLimit }, (_unused, index) => index)
    .find(index => !getEquipmentKey(targetList[index]));

  if (isAttachment && !Number.isInteger(emptyIndex)) {
    alert("No empty attachment slots.");
    return;
  }

  if (isGun && !Number.isInteger(emptyIndex)) {
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
    loadout.attachments[emptyIndex] = makeLoadoutEntry(key, quality);
    applyShipStats(true);
  } else {
    loadout.guns[emptyIndex] = makeLoadoutEntry(key, quality);
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

  if (kind === "gun" && list.filter(entry => getEquipmentKey(entry)).length <= 1) {
    alert("At least one gun must stay equipped.");
    return;
  }

  if (!canAddInventoryItems(1)) {
    alert(INVENTORY_FULL_MESSAGE);
    return;
  }

  list[index] = null;

  if (quality === "standard") {
    if (kind === "gun") ownedGuns[key] = (ownedGuns[key] || 0) + 1;
    else ownedAttachments[key] = (ownedAttachments[key] || 0) + 1;
  } else {
    addInventoryItem({
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
  const selected = typeof getSelectedTargetEntityForAction === "function"
    ? getSelectedTargetEntityForAction()
    : getSelectedTargetEntity();
  const engaged = getEngagedTargetEntity();
  const selectedIsEngaged = selected && selectedTarget && engagedTarget && selectedTarget.type === engagedTarget.type && selectedTarget.id === engagedTarget.id;

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

  const normalizedMessage = String(message || "").trim();
  if (!normalizedMessage) return;

  const now = Date.now();
  const lastMessage = String(feed.dataset.lastMessage || "");
  const lastAt = Number(feed.dataset.lastMessageAt || 0);
  const isNoisyRepeat = /Cargo hold full|PvP disabled in protected zones|No target selected|Target is no longer|Unable to engage/i.test(normalizedMessage);
  if (isNoisyRepeat && lastMessage === normalizedMessage && now - lastAt < 1600) return;
  feed.dataset.lastMessage = normalizedMessage;
  feed.dataset.lastMessageAt = String(now);

  const placeholder = feed.querySelector(".activity-log-item.muted");
  if (placeholder) {
    placeholder.remove();
  }

  const item = document.createElement("div");
  const isMorgan = /^Morgan:/i.test(normalizedMessage);
  const isMission = /Mission (complete|accepted|reward claimed)|Journey|Academy|Frontier/i.test(normalizedMessage);
  const isWarning = /blocked|unable|disabled|critical|destroyed|expired|lost|full/i.test(normalizedMessage);
  item.className = [
    "activity-log-item",
    isMorgan ? "activity-log-item--morgan" : "",
    isMission ? "activity-log-item--mission" : "",
    isWarning ? "activity-log-item--warning" : ""
  ].filter(Boolean).join(" ");
  if (isMorgan) {
    const prefix = document.createElement("strong");
    prefix.textContent = "Morgan:";
    const text = document.createElement("span");
    text.textContent = ` ${normalizedMessage.replace(/^Morgan:\s*/i, "")}`;
    item.append(prefix, text);
  } else {
    item.textContent = normalizedMessage;
  }
  feed.prepend(item);

  while (feed.children.length > 14) {
    feed.removeChild(feed.lastElementChild);
  }
}

function addHudToast(message) {
  addActivityLog(message);
}

function getPilotName() {
  const savedAccount = safeParseLocalStorage(STORAGE_ACCOUNT_KEY);
  const localPilot = localStorage.getItem("sectorOneLoggedIn");
  return savedAccount?.username || localPilot || "Pilot";
}

function getMultiplayerPresencePayload(overrides = {}) {
  const node = sectorNodes[currentNode] || {};
  const ship = SHIPS[currentShipId] || {};
  const loadout = typeof getShipLoadout === "function" ? getShipLoadout(currentShipId) : { guns: [] };
  const equippedWeaponKeys = Array.isArray(loadout?.guns)
    ? loadout.guns.map((entry) => {
      if (typeof getEquipmentKey === "function") return getEquipmentKey(entry);
      return typeof entry === "string" ? entry : entry?.key;
    }).map((key) => String(key || "").trim()).filter(Boolean)
    : [];
  const shipName = ship.name || "";
  const shipImage = typeof getShipAsset === "function" ? getShipAsset(currentShipId, "medium") : (ship.image || "");
  const shipStats = typeof getShipStats === "function" ? getShipStats(currentShipId) : {};
  const activeShieldMax = Number.isFinite(Number(shieldMax)) && Number(shieldMax) > 0
    ? Number(shieldMax)
    : Number(shipStats.shieldMax || shipStats.shield || 0);
  const activeHullMax = Number.isFinite(Number(hullMax)) && Number(hullMax) > 0
    ? Number(hullMax)
    : Number(shipStats.hullMax || shipStats.hull || 0);
  const activeArmorMax = Number.isFinite(Number(armor)) && Number(armor) > 0
    ? Number(armor)
    : Number(shipStats.armor || 0);
  const spaceScreen = document.getElementById("spaceScreen");
  const inferredPresenceStatus = spaceScreen?.classList.contains("active") ? "space" : "docked";
  return {
    currentNode,
    presenceStatus: overrides.presenceStatus || inferredPresenceStatus,
    x: Number.isFinite(Number(node.x)) ? Number(node.x) : 50,
    y: Number.isFinite(Number(node.y)) ? Number(node.y) : 50,
    displayName: getPilotName(),
    currentShipId: currentShipId || "",
    shipImage,
    shipImageSrc: shipImage,
    shipImagePath: shipImage,
    shipClass: ship.roleSubtitle || "",
    shipName,
    ship: shipName,
    shieldMax: Math.max(0, Math.round(activeShieldMax)),
    armor: Math.max(0, Math.round(activeArmorMax)),
    armorMax: Math.max(0, Math.round(activeArmorMax)),
    hullMax: Math.max(1, Math.round(activeHullMax || 1)),
    equippedWeaponKey: equippedWeaponKeys[0] || "",
    equippedWeaponKeys,
    ...overrides
  };
}

window.getLupenMultiplayerPresence = getMultiplayerPresencePayload;

function syncMultiplayerPresence(reason = "position_update", overrides = {}) {
  const client = window.LupenMultiplayerClient;
  const status = client?.getStatus?.();
  if (!status?.enabled || !status?.isConnected || typeof client?.sendMovementIntent !== "function") return;

  client.sendMovementIntent({
    ...getMultiplayerPresencePayload(overrides),
    reason
  });
}

let selectedChatChannel = "sector";
const fallbackChatMessages = [];
let lastLocalChatSendKey = "";
let lastLocalChatSendAt = 0;

function formatChatTime(timestamp = Date.now()) {
  const date = new Date(Number(timestamp || Date.now()));
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getChatChannelLabel(channel = selectedChatChannel) {
  return "Sector";
}

function setChatChannel(channel) {
  selectedChatChannel = "sector";
  renderMultiplayerChatHud();
}

function addLocalChatLine(author, message, type = "", meta = {}) {
  const feed = document.getElementById("localChatFeed");
  if (!feed) return;

  const line = document.createElement("div");
  line.className = `chat-line ${type}`.trim();

  const cleanAuthor = String(author || "Pilot").slice(0, 28);
  const cleanMessage = String(message || "").slice(0, 200);

  const header = document.createElement("strong");
  header.textContent = `${cleanAuthor}:`;
  const text = document.createElement("span");
  text.textContent = ` ${cleanMessage}`;
  line.appendChild(header);
  line.appendChild(text);
  if (meta.receivedAt && meta.showTime !== false) {
    const stamp = document.createElement("em");
    stamp.textContent = ` ${formatChatTime(meta.receivedAt)}`;
    line.appendChild(stamp);
  }
  feed.appendChild(line);
  feed.scrollTop = feed.scrollHeight;

  while (feed.children.length > 30) {
    feed.removeChild(feed.firstElementChild);
  }
}

function renderOnlinePilots(players = null) {
  const panel = document.getElementById("onlinePilotsList");
  if (!panel) return;
  const client = window.LupenMultiplayerClient;
  const status = client?.getStatus?.() || {};
  const allPlayers = players || client?.getPlayers?.({ includeSelf: true }) || [];
  if (!status.enabled) {
    panel.textContent = "Online pilots unavailable.";
    return;
  }
  if (!status.isConnected) {
    panel.textContent = "Chat unavailable while disconnected.";
    return;
  }
  const playerByIdentity = new Map();
  allPlayers.forEach((player) => {
    const accountKey = String(player.trustedPlayerId || player.playerId || player.supabaseUserId || "").trim().toLowerCase();
    const displayKey = String(player.displayName || "").trim().toLowerCase();
    const sessionKey = String(player.sessionId || player.id || "").trim().toLowerCase();
    const identityKey = accountKey ? `account:${accountKey}` : displayKey ? `display:${displayKey}` : sessionKey ? `session:${sessionKey}` : "";
    if (!identityKey) return;
    const current = playerByIdentity.get(identityKey);
    const currentSeenAt = Number(current?.lastSeenAt || current?.joinedAt || 0);
    const playerSeenAt = Number(player.lastSeenAt || player.joinedAt || 0);
    if (!current || playerSeenAt > currentSeenAt || (playerSeenAt === currentSeenAt && String(player.sessionId || player.id || "") > String(current.sessionId || current.id || ""))) {
      playerByIdentity.set(identityKey, player);
    }
  });
  const dedupedPlayers = Array.from(playerByIdentity.values());
  const rows = dedupedPlayers.slice(0, 8).map((player) => {
    return String(player.displayName || "Pilot").slice(0, 18);
  });
  panel.textContent = rows.length ? `Online Pilots: ${rows.join(", ")}` : "Online Pilots: only you";
}

function renderMultiplayerChatHud(statusOverride = null, playersOverride = null) {
  const feed = document.getElementById("localChatFeed");
  const input = document.getElementById("localChatInput");
  const sendButton = document.querySelector("#chatPanel .local-chat-input-row button");
  if (!feed) return;

  selectedChatChannel = "sector";
  document.querySelectorAll("#chatPanel .chat-channel-tabs button").forEach((button) => {
    button.classList.toggle("active", button.id === "chatChannelSectorBtn");
    button.disabled = button.id !== "chatChannelSectorBtn";
  });

  const client = window.LupenMultiplayerClient;
  const status = statusOverride || client?.getStatus?.() || {};
  renderOnlinePilots(playersOverride || client?.getPlayers?.({ includeSelf: true }) || []);
  feed.innerHTML = "";

  if (input) {
    const canUseChat = !status.enabled || status.isConnected;
    input.disabled = !canUseChat;
    input.readOnly = !canUseChat;
    input.maxLength = 200;
    input.placeholder = status.enabled && !status.isConnected
      ? "Chat unavailable while disconnected."
      : "Sector message...";
    input.setAttribute("aria-disabled", canUseChat ? "false" : "true");
  }

  if (sendButton) {
    const canSend = !status.enabled || status.isConnected;
    sendButton.disabled = !canSend;
    sendButton.setAttribute("aria-disabled", canSend ? "false" : "true");
  }

  if (status.enabled && !status.isConnected) {
    addLocalChatLine("Chat", "Chat unavailable while disconnected.", "muted", { showTime: false });
    refreshTacticalPanel();
    return;
  }

  const sourceMessages = status.enabled && client?.getChatMessages
    ? client.getChatMessages({ channel: "sector" })
    : fallbackChatMessages;
  const seenMessageKeys = new Set();
  const messages = sourceMessages
    .filter((message) => message.type !== "system" && (!message.channel || message.channel === "sector"))
    .filter((message) => {
      const key = String(message.id || `${message.displayName || ""}|${message.message || ""}|${message.receivedAt || ""}`);
      if (seenMessageKeys.has(key)) return false;
      seenMessageKeys.add(key);
      return true;
    })
    .slice(-30);

  if (!messages.length) {
    addLocalChatLine("Chat", "No player messages yet.", "muted", { showTime: false });
    refreshTacticalPanel();
    return;
  }

  messages.forEach((entry) => {
    addLocalChatLine(entry.displayName || "Pilot", entry.message || "", "", {
      receivedAt: entry.receivedAt
    });
  });
  refreshTacticalPanel();
}

function sendLocalChatMessage() {
  const input = document.getElementById("localChatInput");
  if (!input) return;

  const message = input.value.replace(/\s+/g, " ").trim().slice(0, 200);
  if (!message) return;
  const now = Date.now();
  const sendKey = `sector|${message}`;
  if (sendKey === lastLocalChatSendKey && now - lastLocalChatSendAt < 750) {
    input.value = "";
    return;
  }
  lastLocalChatSendKey = sendKey;
  lastLocalChatSendAt = now;

  const client = window.LupenMultiplayerClient;
  const status = client?.getStatus?.() || {};
  if (status.enabled) {
    if (!status.isConnected || !client?.sendChatMessage) {
      addLocalChatLine("Chat", "Chat unavailable while disconnected.", "muted", { showTime: false });
      input.value = "";
      return;
    }
    client.sendChatMessage({ channel: "sector", message });
  } else {
    fallbackChatMessages.push({
      type: "chat",
      channel: "sector",
      displayName: getPilotName(),
      message,
      receivedAt: Date.now()
    });
    while (fallbackChatMessages.length > 30) fallbackChatMessages.shift();
    renderMultiplayerChatHud(status);
  }
  input.value = "";
}

function handleLocalChatKey(event) {
  if (event.key === "Enter") {
    event.preventDefault();
    sendLocalChatMessage();
  }
}

function updateObjectActionPanel(forceVisible = false) {
  if (typeof reconcileTargetSessionState === "function") {
    reconcileTargetSessionState("action_panel_render", { update: false });
  }

  const panel = document.getElementById("objectActionPanel");
  const actionBtn = document.getElementById("objectEngageBtn");
  const selected = typeof getSelectedTargetEntityForAction === "function"
    ? getSelectedTargetEntityForAction()
    : getSelectedTargetEntity();
  const engaged = getEngagedTargetEntity();
  const target = selected || engaged;
  const localBotVisualGuardActive = typeof isStagingLocalCombatBotVisualGuardActive === "function"
    && isStagingLocalCombatBotVisualGuardActive();
  const targetNode = target?.currentNodeId || target?.currentNode || target?.node || "";

  if (!panel || !actionBtn) return;

  const targetType = target ? getTargetTypeFromEntity(target) : "";
  const unarmed = typeof canCurrentShipFire === "function" && !canCurrentShipFire();
  if (targetType === "remotePlayer") {
    const blockReason = typeof getRemotePlayerTargetBlockReason === "function"
      ? getRemotePlayerTargetBlockReason(target)
      : "PvP disabled in protected zones.";
    panel.classList.add("visible");
    actionBtn.disabled = !!blockReason || unarmed;
    actionBtn.textContent = unarmed
      ? "NO WEAPON"
      : blockReason === "PvP disabled in protected zones."
      ? "PVP DISABLED"
      : blockReason
        ? "PVP LOCKED"
        : "PVP ENGAGE";
    actionBtn.classList.remove("disengage-action", "action-inactive");
    return;
  }

  const isRelevant = target
    && targetNode === currentNode
    && target.alive
    && !(localBotVisualGuardActive && targetType === "hostileBot");

  if (!isRelevant) {
    panel.classList.add("visible");
    actionBtn.disabled = true;
    actionBtn.textContent = "ENGAGE";
    actionBtn.classList.remove("disengage-action");
    actionBtn.classList.add("action-inactive");
    return;
  }

  if (unarmed) {
    panel.classList.add("visible");
    actionBtn.disabled = true;
    actionBtn.textContent = "NO WEAPON";
    actionBtn.classList.remove("disengage-action");
    actionBtn.classList.add("action-inactive");
    return;
  }

  const targetIsEngaged = engaged && engagedTarget && target &&
    getTargetTypeFromEntity(target) === engagedTarget.type &&
    String(target.id || "") === String(engagedTarget.id || "");

  panel.classList.add("visible");
  actionBtn.disabled = false;
  actionBtn.textContent = engageTimer && targetIsEngaged ? "DISENGAGE" : "ENGAGE";
  actionBtn.classList.toggle("disengage-action", !!engageTimer && targetIsEngaged);
  actionBtn.classList.remove("action-inactive");
}

function updateHudDock() {
  const sectorBtn = document.getElementById("sectorDockBtn");
  const inventoryBtn = document.getElementById("inventoryDockBtn");
  const sectorCargoSummary = document.getElementById("sectorCargoSummary");
  const cargoSummary = document.getElementById("cargoSummary");
  const cargoCapacityText = document.getElementById("cargoCapacityText");
  const hudCargoSummary = document.getElementById("hudCargoSummary");
  const hudCargoCapacityText = document.getElementById("hudCargoCapacityText");
  const hudCargoPercentText = document.getElementById("hudCargoPercentText");
  const hudCargoCapacityFill = document.getElementById("hudCargoCapacityFill");
  const hudCargoFullBadge = document.getElementById("hudCargoFullBadge");
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

  updateShipStorageHud();

  if (cargoCapacityText) {
    cargoCapacityText.textContent = `${formatNumber(usedCargo)} / ${formatNumber(maxCargo)}`;
  }

  if (hudCargoCapacityText) {
    hudCargoCapacityText.textContent = `${formatNumber(usedCargo)} / ${formatNumber(maxCargo)}`;
  }

  const cargoPercent = maxCargo > 0 ? Math.max(0, Math.min(100, Math.round((usedCargo / maxCargo) * 100))) : 0;
  if (hudCargoPercentText) hudCargoPercentText.textContent = `${formatNumber(cargoPercent)}% CAPACITY`;
  if (hudCargoCapacityFill) hudCargoCapacityFill.style.width = `${cargoPercent}%`;

  if (hudCargoSummary) {
    const isFull = maxCargo > 0 && usedCargo >= maxCargo;
    hudCargoSummary.classList.toggle("is-full", isFull);
    hudCargoSummary.setAttribute("aria-label", `Cargo ${formatNumber(usedCargo)} of ${formatNumber(maxCargo)}${isFull ? " full" : ""}`);
  }

  if (hudCargoFullBadge) {
    hudCargoFullBadge.hidden = true;
    hudCargoFullBadge.textContent = "";
  }

  if (inventoryItemCountText) {
    const itemCount = getCarriedInventoryItemCount();
    inventoryItemCountText.textContent = `${formatNumber(itemCount)}/${formatNumber(MAX_CARRIED_INVENTORY_ITEMS)} items`;
  }

  if (itemInventorySummary) {
    itemInventorySummary.innerHTML = groupedItems.length
      ? groupedItems.map(item => `
          <div class="inventory-item-card inventory-item-card-minimal quality-${item.quality}" title="${item.name} / ${titleCaseQuality(item.quality)} / ${item.category}">
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

  refreshTacticalPanel();
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
  const pvpDisplayState = typeof serverPvpDamageDisplayState === "object" && serverPvpDamageDisplayState
    ? serverPvpDamageDisplayState
    : null;
  const displayHullMax = Number.isFinite(Number(pvpDisplayState?.hullMax)) && Number(pvpDisplayState.hullMax) > 0
    ? Number(pvpDisplayState.hullMax)
    : hullMax;
  const displayShieldMax = Number.isFinite(Number(pvpDisplayState?.shieldMax)) && Number(pvpDisplayState.shieldMax) > 0
    ? Number(pvpDisplayState.shieldMax)
    : shieldMax;
  const displayHull = Number.isFinite(Number(pvpDisplayState?.hull))
    ? Number(pvpDisplayState.hull)
    : hull;
  const displayShield = Number.isFinite(Number(pvpDisplayState?.shield))
    ? Number(pvpDisplayState.shield)
    : shield;
  const safeHullMax = Number.isFinite(displayHullMax) && displayHullMax > 0 ? displayHullMax : 1;
  const safeShieldMax = Number.isFinite(displayShieldMax) && displayShieldMax > 0 ? displayShieldMax : 0;

  document.getElementById("jumpFill").style.height = `${Math.max(0, Math.min(100, (jumpCharge / safeJumpMax) * 100))}%`;
  document.getElementById("jumpValue").textContent = formatNumber(Math.floor(jumpCharge));
  document.getElementById("jumpBtn").disabled = jumpCharge < safeJumpMax || hull <= 0;

  document.getElementById("hullFill").style.height = `${Math.max(0, Math.min(100, (displayHull / safeHullMax) * 100))}%`;
  document.getElementById("hullValue").textContent = formatNumber(Math.floor(displayHull));

  document.getElementById("shieldFill").style.height = `${safeShieldMax > 0 ? Math.max(0, Math.min(100, (displayShield / safeShieldMax) * 100)) : 0}%`;
  document.getElementById("shieldValue").textContent = formatNumber(Math.floor(displayShield));

  const isHullCritical = displayHull > 0 && (displayHull / safeHullMax) <= 0.2;
  const isHullDisabledThreshold = displayHull <= 0;
  const isShieldDepleted = safeShieldMax > 0 && displayShield <= 0 && displayHull > 0;
  const spaceScreen = document.getElementById("spaceScreen");
  const statPanel = document.querySelector(".vertical-stats");
  [spaceScreen, statPanel].forEach(panel => {
    if (!panel) return;
    panel.classList.toggle("player-hull-critical", isHullCritical);
    panel.classList.toggle("player-hull-disabled-threshold", isHullDisabledThreshold);
    panel.classList.toggle("player-shield-depleted", isShieldDepleted);
  });

  const shipImage = document.getElementById("hudShipImage");
  if (shipImage) {
    shipImage.src = typeof getShipAsset === "function" ? getShipAsset(currentShipId, "small") : ship.image;
    shipImage.alt = ship.name;
  }
  const shipName = document.getElementById("hudShipName");
  if (shipName) shipName.textContent = String(ship.name || "Lupen").toUpperCase();

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

  const damageResult = LupenCombatRules.resolveIncomingPlayerDamage(
    { hull, shield, armor },
    getMitigatedIncomingDamage(totalDamage)
  );
  hull = damageResult.hull;
  shield = damageResult.shield;

  if (damageResult.shieldDamage > 0 && typeof playShieldHitSound === "function") playShieldHitSound();
  if (damageResult.hullDamage > 0 && typeof playHullHitSound === "function") playHullHitSound();

  if (damageResult.destroyed) {
    handleShipDisabled();
    return;
  }

  updateSpaceHUD();
  saveGame();

  if (shield < shieldMax) {
    scheduleShieldRegen();
  }
}

function applyStagingBotReturnFireDamage(event = {}) {
  const damage = Number(event.damage || 0);
  if (!Number.isFinite(damage) || damage <= 0 || hull <= 0) return null;

  stopShieldRegen();

  const shieldBefore = Math.max(0, Number(shield || 0));
  const hullBefore = Math.max(0, Number(hull || 0));
  const damageResult = LupenCombatRules.resolveIncomingPlayerDamage(
    { hull, shield, armor },
    getMitigatedIncomingDamage(damage)
  );

  shield = Math.max(0, Number(damageResult.shield || 0));
  hull = Math.max(0, Number(damageResult.hull || 0));

  const attackerName = event.attackerName || "Erebus Bot";
  const attackerBot = typeof getStagingBotTargetById === "function"
    ? getStagingBotTargetById(event.attackerBotId)
    : null;
  const shieldDamage = Math.max(0, Number(damageResult.shieldDamage || 0));
  const hullDamage = Math.max(0, Number(damageResult.hullDamage || 0));

  if (typeof playHostilePlayerHitFeedback === "function") {
    playHostilePlayerHitFeedback({
      attackerBot,
      shieldDamage,
      hullDamage
    });
  } else {
    if (damageResult.shieldDamage > 0 && typeof playShieldHitSound === "function") playShieldHitSound();
    if (damageResult.hullDamage > 0 && typeof playHullHitSound === "function") playHullHitSound();
    if (typeof showIncomingHitFlash === "function") showIncomingHitFlash({ hullHit: hullDamage > 0 });
  }

  if (typeof addActivityLog === "function") {
    const shieldText = shieldDamage > 0 ? `${formatNumber(Math.round(shieldDamage))} shield` : "";
    const hullText = hullDamage > 0 ? `${formatNumber(Math.round(hullDamage))} hull` : "";
    const damageText = [shieldText, hullText].filter(Boolean).join(" / ");
    if (damageText) {
      addActivityLog(`${attackerName} hit you for ${damageText}.`);
    }
    if (shieldBefore > 0 && shield <= 0 && hullDamage > 0) {
      addActivityLog(`Shield depleted; hull took ${formatNumber(Math.round(hullDamage))} damage.`);
    }
    if (hull > 0 && hull <= Math.max(1, Math.round(hullMax * 0.25))) {
      addActivityLog("Hull critical.");
    }
  }

  const playerDestroyed = damageResult.destroyed === true || hull <= 0;
  const result = {
    shieldBefore,
    shieldAfter: shield,
    hullBefore,
    hullAfter: hull,
    shieldDamage,
    hullDamage,
    playerDestroyed,
    botAttackStatus: playerDestroyed ? "stopped" : "cooldown",
    botAttackReason: playerDestroyed ? "player_destroyed" : "return_fire_applied",
    sessionOnly: true,
    saveWritten: false
  };

  if (playerDestroyed) {
    if (typeof addActivityLog === "function") addActivityLog("Ship disabled.");
    if (typeof handleShipDisabled === "function") handleShipDisabled();
    return result;
  }

  updateSpaceHUD();
  updateTargetPanel();
  saveGame();

  if (shield < shieldMax) {
    scheduleShieldRegen();
  }

  return result;
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
    if (cargoRecovered?.[mineral]) {
      delete cargoRecovered[mineral];
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
  if (typeof playPlayerShipDestroyedSound === "function") playPlayerShipDestroyedSound();
  hull = 0;
  shield = 0;
  stopShieldRegen();
  disengageTarget(true);
  closeSectorMap();

  const lostCargo = calculateDisabledCargoLoss();
  if (typeof clearErebusNodeAggro === "function") clearErebusNodeAggro(currentNode);
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
  if (!LupenMovementRules.canOpenSectorMap(jumpCharge, jumpMax)) return;
  const map = document.getElementById("sectorMap");
  map.classList.add("active");
  map.setAttribute("aria-hidden", "false");
  renderSectorMap();
  tutorialEvent("openedSectorMap");
  requestAnimationFrame(() => map.querySelector(".close-map-btn")?.focus({ preventScroll: true }));
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
  const map = document.getElementById("sectorMap");
  map.classList.remove("active");
  map.setAttribute("aria-hidden", "true");
  if (document.getElementById("spaceScreen")?.classList.contains("active")) {
    requestAnimationFrame(() => document.getElementById("jumpBtn")?.focus({ preventScroll: true }));
  }
}

function renderSectorMap() {
  const svg = document.getElementById("sectorSvg");
  svg.innerHTML = "";
  addMapDefs(svg);
  drawMapZones(svg);
  drawRoutes(svg);
  drawNodes(svg);
  drawSectorScanMarkers(svg);
  if (window.LupenMultiplayerOverlay?.render) window.LupenMultiplayerOverlay.render();
  updateSectorScanPanel();
}

function getActiveObjectiveTargetNode() {
  const objective = typeof getActiveObjective === "function" ? getActiveObjective() : null;
  if (!objective) {
    return typeof getMultiplayerStagingBountyTargetNode === "function"
      ? getMultiplayerStagingBountyTargetNode()
      : null;
  }

  if (objective.type === "trade" && typeof getTradeObjectiveTargetNode === "function") {
    return getTradeObjectiveTargetNode(objective);
  }

  if (objective.type === "bounty") {
    if (objective.status === "readyToClaim" || objective.kills >= objective.killsRequired) {
      return getNearestPlanetNode(currentNode);
    }
    return getNearestActiveBountyBotNode(currentNode) || getNearestBountyAreaNode(currentNode, objective.targetArea);
  }

  return null;
}

function getActiveObjectiveRouteNodes() {
  const route = typeof getObjectiveRoutePath === "function" ? getObjectiveRoutePath() : [];
  if (route.length) return route;
  return typeof getMultiplayerStagingBountyRoutePath === "function" ? getMultiplayerStagingBountyRoutePath() : [];
}

function getActiveObjectiveMapLabel() {
  const objective = typeof getActiveObjective === "function" ? getActiveObjective() : null;
  if (!objective) {
    const stagingBounty = typeof getActiveMultiplayerStagingBountyObjective === "function"
      ? getActiveMultiplayerStagingBountyObjective()
      : null;
    if (stagingBounty?.claimAvailable || stagingBounty?.completed) return "Claim XP";
    if (stagingBounty?.accepted) return "Staging bot";
    return "";
  }
  if (objective.type === "trade") {
    const target = getActiveObjectiveTargetNode();
    return target ? `Objective: ${target}` : "Trade objective";
  }
  if (objective.type === "bounty") {
    if (objective.status === "readyToClaim" || objective.kills >= objective.killsRequired) return "Claim reward";
    return "Bounty target";
  }
  return "Objective";
}

function isActiveObjectiveClaimRewardTarget(nodeName) {
  const objective = typeof getActiveObjective === "function" ? getActiveObjective() : null;
  if (!objective || objective.type !== "bounty") return false;
  const readyToClaim = objective.status === "readyToClaim" || objective.kills >= objective.killsRequired;
  return readyToClaim && sectorNodes[nodeName]?.type === "planet" && getActiveObjectiveTargetNode() === nodeName;
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
  const localBotVisualGuardActive = typeof isStagingLocalCombatBotVisualGuardActive === "function" && isStagingLocalCombatBotVisualGuardActive();
  const localBots = localBotVisualGuardActive ? [] : hostileBots;
  const multiplayerBots = typeof window !== "undefined" && window.LupenMultiplayerClient?.getBots
    ? window.LupenMultiplayerClient.getBots()
    : [];
  const scanBots = [
    ...localBots.map(bot => ({ ...bot, scanSource: "local" })),
    ...multiplayerBots.map(bot => ({ ...bot, scanSource: "multiplayer" }))
  ];

  scanBots
    .filter(bot => {
      const nodeId = bot.currentNodeId || bot.currentNode || bot.node;
      if (!sectorNodes[nodeId]) return false;
      if (bot.disabled && bot.scanSource === "multiplayer") return false;
      if (bot.alive === false) return false;
      return true;
    })
    .forEach(bot => {
      const nodeId = bot.currentNodeId || bot.currentNode || bot.node;
      if (!grouped.has(nodeId)) {
        const node = sectorNodes[nodeId];
        grouped.set(nodeId, {
          type: "bot",
          node: nodeId,
          x: node.x,
          y: node.y,
          count: 0,
          names: [],
          classes: [],
          threats: [],
          aggroStates: [],
          images: []
        });
      }
      const signal = grouped.get(nodeId);
      signal.count += 1;
      signal.names.push(bot.displayName || bot.name);
      signal.classes.push(bot.className || "Bot");
      signal.threats.push(bot.threat || "Medium");
      signal.aggroStates.push(bot.aggroState || "neutral");
      signal.images.push(bot.image || "");
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
    .join(" / ");
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
  button.classList.toggle("cooldown", remainingMs > 0);
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
      status.textContent = `Bot result visible ${visibleRemaining}s / ${formatNumber(botCount)} signal${botCount === 1 ? "" : "s"}`;
    } else if (scanType === "ally") {
      status.textContent = `Ally result visible ${visibleRemaining}s / no allied signals`;
    } else {
      status.textContent = `Enemy result visible ${visibleRemaining}s / no enemy signals`;
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
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = signal.names?.length
      ? `${signal.node}: ${signal.names.map((name, index) => `${name} / ${signal.classes?.[index] || "Bot"} / ${signal.threats?.[index] || "Medium"} / ${signal.aggroStates?.[index] || "neutral"}`).join(", ")}`
      : `${signal.node || "Unknown signal"}`;
    marker.appendChild(title);

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
  const objectivePath = getActiveObjectiveRouteNodes();

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
      const isObjectiveStep = objectivePath.some((nodeName, index) => {
        const nextNode = objectivePath[index + 1];
        return (nodeName === name && nextNode === target) || (nodeName === target && nextNode === name);
      });
      const routeTone = getRouteTone(node, targetNode);
      line.setAttribute("class", `svg-route ${isAvailableRoute ? "available reachable-route" : "inactive-route"} ${isPlannedTradeRoute ? "planned-trade-route" : ""} ${isObjectiveStep ? "objective-route-step" : ""} ${routeTone}`);
      svg.appendChild(line);
    });
  });
}

function drawNodes(svg) {
  const objectiveTarget = getActiveObjectiveTargetNode();
  const objectiveRoute = getActiveObjectiveRouteNodes();
  Object.entries(sectorNodes).forEach(([name, node]) => {
    const isCurrent = name === currentNode;
    const canJump = LupenMovementRules.isAdjacentNode(sectorNodes, currentNode, name);
    const isObjectiveTarget = objectiveTarget === name;
    const isObjectivePath = objectiveRoute.includes(name);
    const group = document.createElementNS("http://www.w3.org/2000/svg", "g");

    group.style.cursor = canJump || isCurrent ? "pointer" : "default";
    group.setAttribute("data-node", name);
    group.onclick = () => {
      if (isCurrent && node.type === "planet" && typeof landOnPlanet === "function") {
        landOnPlanet();
        return;
      }
      jumpToNode(name);
    };
    group.setAttribute("class", `${isCurrent ? "svg-player-node current-map-node" : ""} ${canJump && !isCurrent ? "reachable-map-node" : ""} ${!canJump && !isCurrent ? "unreachable-map-node" : ""} ${isObjectiveTarget ? "svg-objective-target-node" : ""} ${isObjectivePath ? "svg-objective-path-node" : ""}`);

    if (node.type === "planet") {
      drawPlanetNode(group, name, node, isCurrent, canJump, isObjectiveTarget);
    } else {
      drawSpaceNode(group, node, isCurrent, canJump, isObjectiveTarget);
    }

    svg.appendChild(group);
  });
}

function drawObjectiveTargetMarker(group, node, options = {}) {
  const isClaimReward = options.variant === "claimReward";
  const marker = document.createElementNS("http://www.w3.org/2000/svg", "g");
  marker.setAttribute("class", `svg-objective-target-marker ${isClaimReward ? "claim-reward-note" : ""}`.trim());

  const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  ring.setAttribute("cx", node.x);
  ring.setAttribute("cy", node.y);
  ring.setAttribute("r", 4.35);
  ring.setAttribute("class", "objective-target-ring");
  marker.appendChild(ring);

  const pointer = document.createElementNS("http://www.w3.org/2000/svg", "path");
  pointer.setAttribute("d", `M ${node.x} ${node.y - 6.4} l 1.7 -2.4 h -3.4 z`);
  pointer.setAttribute("class", "objective-target-pointer");
  marker.appendChild(pointer);

  if (isClaimReward) {
    const note = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    note.setAttribute("x", node.x - 6.35);
    note.setAttribute("y", node.y - 10.65);
    note.setAttribute("width", 12.7);
    note.setAttribute("height", 2.75);
    note.setAttribute("rx", 0.72);
    note.setAttribute("class", "objective-target-note");
    marker.appendChild(note);
  }

  const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
  label.setAttribute("x", node.x);
  label.setAttribute("y", isClaimReward ? node.y - 8.82 : node.y - 7.7);
  label.setAttribute("class", `objective-target-label ${isClaimReward ? "claim-reward-label" : ""}`.trim());
  label.textContent = getActiveObjectiveMapLabel();
  marker.appendChild(label);

  group.appendChild(marker);
}

function drawCurrentNodeShipIcon(group, node, scale = 1) {
  const ship = document.createElementNS("http://www.w3.org/2000/svg", "path");
  const size = 1.15 * scale;
  ship.setAttribute("d", `M ${node.x} ${node.y - (1.55 * scale)} L ${node.x + size} ${node.y + (1.25 * scale)} L ${node.x} ${node.y + (0.72 * scale)} L ${node.x - size} ${node.y + (1.25 * scale)} Z`);
  ship.setAttribute("class", "svg-current-node-ship");
  group.appendChild(ship);
}

function drawPlanetNode(group, name, node, isCurrent, canJump, isObjectiveTarget = false) {
  const isPlanned = isNodeOnActiveTradeRoute(name);
  const isClaimRewardTarget = isActiveObjectiveClaimRewardTarget(name);
  if (isObjectiveTarget && (!isCurrent || isClaimRewardTarget)) {
    drawObjectiveTargetMarker(group, node, { variant: isClaimRewardTarget ? "claimReward" : "objective" });
  }

  const glow = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  glow.setAttribute("cx", node.x);
  glow.setAttribute("cy", node.y);
  glow.setAttribute("r", isCurrent ? 4.65 : canJump ? 4.15 : 3.8);
  glow.setAttribute("fill", "rgba(80, 180, 255, 0.12)");
  glow.setAttribute("class", isCurrent ? "svg-current-node-glow" : canJump ? "svg-reachable-node-glow" : "svg-node-glow");
  group.appendChild(glow);

  const planet = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  planet.setAttribute("cx", node.x);
  planet.setAttribute("cy", node.y);
  planet.setAttribute("r", 2.6);
  planet.setAttribute("fill", node.planetClass === "virella" ? "url(#planetVirella)" : node.planetClass === "nyxara" ? "url(#planetNyxara)" : "url(#planetAsteron)");
  if (!canJump && !isCurrent) planet.setAttribute("opacity", "0.34");
  group.appendChild(planet);

  const ring = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  ring.setAttribute("cx", node.x);
  ring.setAttribute("cy", node.y);
  ring.setAttribute("r", isCurrent ? 4.15 : canJump ? 3.35 : 3.0);
  ring.setAttribute("class", isCurrent ? "svg-current-ring" : canJump ? "svg-reachable-ring" : isObjectiveTarget ? "svg-objective-target-ring" : isPlanned ? "svg-planned-trade-ring" : "svg-planet-ring");
  group.appendChild(ring);

  if (isCurrent) {
    const center = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    center.setAttribute("cx", node.x);
    center.setAttribute("cy", node.y);
    center.setAttribute("r", 1.05);
    center.setAttribute("class", "svg-current-node-center");
    group.appendChild(center);
  }

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

function drawSpaceNode(group, node, isCurrent, canJump, isObjectiveTarget = false) {
  const nodeName = Object.keys(sectorNodes).find(name => sectorNodes[name] === node);
  const isPlanned = isNodeOnActiveTradeRoute(nodeName);
  if (isObjectiveTarget && !isCurrent && !isActiveObjectiveClaimRewardTarget(nodeName)) drawObjectiveTargetMarker(group, node);

  const star = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  star.setAttribute("cx", node.x);
  star.setAttribute("cy", node.y);
  star.setAttribute("r", isCurrent ? 1.28 : canJump ? 1.02 : node.route === "safe" ? 0.72 : 0.82);
  star.setAttribute("class", `svg-space-node ${node.route || "safe"} ${node.danger === "hostile" ? "hostile" : "safe"} ${isCurrent ? "current-space-node" : ""} ${canJump && !isCurrent ? "reachable-space-node" : ""} ${isPlanned ? "planned-trade-node" : ""} ${isObjectiveTarget ? "objective-target-node" : ""} ${!canJump && !isCurrent ? "locked" : ""}`);
  group.appendChild(star);

  if (isCurrent) {
    const currentGlow = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    currentGlow.setAttribute("cx", node.x);
    currentGlow.setAttribute("cy", node.y);
    currentGlow.setAttribute("r", 2.25);
    currentGlow.setAttribute("class", "svg-current-node-glow");
    group.insertBefore(currentGlow, star);

    const currentRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    currentRing.setAttribute("cx", node.x);
    currentRing.setAttribute("cy", node.y);
    currentRing.setAttribute("r", 2.05);
    currentRing.setAttribute("class", "svg-current-ring");
    group.appendChild(currentRing);
  } else if (canJump) {
    const reachableRing = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    reachableRing.setAttribute("cx", node.x);
    reachableRing.setAttribute("cy", node.y);
    reachableRing.setAttribute("r", 1.82);
    reachableRing.setAttribute("class", "svg-reachable-ring");
    group.appendChild(reachableRing);
  }

  const hit = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  hit.setAttribute("cx", node.x);
  hit.setAttribute("cy", node.y);
  hit.setAttribute("r", 2.8);
  hit.setAttribute("class", "svg-node-hit");
  group.appendChild(hit);
}

function jumpToNode(destination) {
  const transition = LupenMovementRules.getJumpTransition(sectorNodes, currentNode, destination, jumpCharge, jumpMax);
  if (!transition.canJump) {
    const stagingTarget = typeof getMultiplayerStagingBountyTargetNode === "function"
      ? getMultiplayerStagingBountyTargetNode()
      : null;
    if (stagingTarget && destination === stagingTarget && typeof addActivityLog === "function") {
      addActivityLog(`Bounty route plotted to ${destination}. Jump through connected nodes to reach it.`);
    }
    return;
  }

  const departedNode = currentNode;
  if (typeof clearErebusNodeAggro === "function") clearErebusNodeAggro(departedNode);
  currentNode = destination;
  if (transition.isPlanetDestination) {
    lastPlanetNode = currentNode;
  }

  playJumpSound();
  jumpCharge = 0;
  closeSectorMap();
  if (typeof clearAllCombatVisuals === "function") {
    clearAllCombatVisuals();
  }
  if (typeof reconcileStagingBotTargetState === "function") {
    reconcileStagingBotTargetState("node_changed");
  }
  disengageTarget(true);
  // Keep the currently selected HUD tab when jumping between nodes.
  maybeMoveAsteroid();
  updateCurrentNodeUI();
  updateSpaceHUD();
  updateAsteroidUI();
  syncMultiplayerPresence("jump", { presenceStatus: "space" });
  tutorialEvent("jumpedNode");
  if (tutorialState?.active) setTimeout(renderStarterTutorial, 120);
  startJumpRecharge();
  saveGame();
}

const SPACE_BACKGROUND_SIZE = { width: 1672, height: 941 };
const PLANET_LANDING_TARGET = {
  centerX: 1528,
  centerY: 131,
  diameter: 190
};

function syncPlanetLandingTarget() {
  const landBtn = document.getElementById("planetLandBtn");
  const spaceScreen = document.getElementById("spaceScreen");
  if (!landBtn || !spaceScreen) return;

  const rect = spaceScreen.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  const scale = Math.max(
    rect.width / SPACE_BACKGROUND_SIZE.width,
    rect.height / SPACE_BACKGROUND_SIZE.height
  );
  const renderedWidth = SPACE_BACKGROUND_SIZE.width * scale;
  const renderedHeight = SPACE_BACKGROUND_SIZE.height * scale;
  const offsetX = (rect.width - renderedWidth) / 2;
  const offsetY = (rect.height - renderedHeight) / 2;
  const size = PLANET_LANDING_TARGET.diameter * scale;
  const left = offsetX + (PLANET_LANDING_TARGET.centerX * scale) - (size / 2);
  const top = offsetY + (PLANET_LANDING_TARGET.centerY * scale) - (size / 2);

  landBtn.style.setProperty("left", `${left}px`, "important");
  landBtn.style.setProperty("top", `${top}px`, "important");
  landBtn.style.setProperty("right", "auto", "important");
  landBtn.style.setProperty("width", `${size}px`, "important");
  landBtn.style.setProperty("height", `${size}px`, "important");
}

function updateNodeZoneStatusChip() {
  const chip = document.getElementById("nodeZoneStatusChip");
  if (!chip) return;

  const zoneType = typeof getCurrentNodeZoneType === "function"
    ? getCurrentNodeZoneType()
    : "protected";
  const isContested = zoneType === "contested";

  chip.dataset.zoneStatus = isContested ? "contested" : "protected";
  chip.classList.toggle("zone-status-contested", isContested);
  chip.classList.toggle("zone-status-protected", !isContested);

  const label = chip.querySelector(".zone-status-label");
  const note = chip.querySelector(".zone-status-note");
  if (label) label.textContent = isContested ? "CONTESTED ZONE" : "PROTECTED ZONE";
  if (note) note.textContent = isContested ? "PvP zone" : "PvP disabled";
}

function updateCurrentNodeUI() {
  const node = sectorNodes[currentNode] || {};
  const nodeNameTag = document.getElementById("nodeNameTag");
  const landBtn = document.getElementById("planetLandBtn");
  const spaceScreen = document.getElementById("spaceScreen");
  const mineralsBox = document.getElementById("sectorMinerals");

  if (nodeNameTag) {
    const nodeName = String(currentNode || "Unknown Node");
    nodeNameTag.textContent = node.type === "planet" ? `${nodeName.toUpperCase()} ORBIT` : nodeName.toUpperCase();
  }

  if (landBtn) {
    const canLand = node?.type === "planet";
    landBtn.style.display = canLand ? "block" : "none";
    landBtn.style.pointerEvents = canLand ? "auto" : "none";
    landBtn.disabled = !canLand;
    landBtn.hidden = !canLand;
    landBtn.tabIndex = canLand ? 0 : -1;
    landBtn.setAttribute("aria-hidden", canLand ? "false" : "true");
    if (canLand) syncPlanetLandingTarget();
  }

  if (spaceScreen) {
    spaceScreen.classList.toggle("empty-node", node.type !== "planet");
  }

  if (mineralsBox) {
    const minerals = nodeMineralPools[currentNode] || [];
    mineralsBox.innerHTML = minerals.length ? minerals.join(", ") : "No mineral traces.";
  }

  if (typeof reconcileRemotePlayerTargetEligibility === "function") {
    reconcileRemotePlayerTargetEligibility("node_ui_refresh");
  }
  updateNodeZoneStatusChip();
  updateHudDock();
}

