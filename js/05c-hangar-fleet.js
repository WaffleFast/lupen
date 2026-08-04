/* Hangar */

function renderHangar() {
  if (!ownedShips.includes(selectedHangarShipId)) {
    selectedHangarShipId = currentShipId || (typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon");
  }

  ensureInventoryObjects();
  renderHangarOverview();
  renderOwnedShips();
  renderHangarVault();
  renderShipShop();
  renderShipPlans();

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
  const repairState = getEffectiveRepairHullState();
  const missingHull = repairState.missingHull;
  const repairCost = getRepairCost();
  const repairDisabled = missingHull <= 0 || credits < repairCost;

  const overviewName = document.getElementById("overviewShipName");
  const overviewRole = document.getElementById("overviewShipRole");
  const overviewImage = document.getElementById("overviewShipImage");
  const overviewNameplate = document.getElementById("overviewNameplate");
  const overviewStats = document.getElementById("overviewStats");
  const overviewRepair = document.getElementById("overviewRepairPanel");
  const subtitle = document.getElementById("hangarShipSubtitle");

  const title = document.getElementById("hangarShipTitle");
  if (title) title.textContent = "Loadout";
  if (subtitle) subtitle.textContent = `${ship.name} · ${getShipRole(currentShipId)}`;

  if (overviewName) overviewName.textContent = ship.name;
  if (overviewRole) overviewRole.textContent = getShipRole(currentShipId);
  if (overviewImage) {
    overviewImage.src = typeof getShipAsset === "function" ? getShipAsset(ship.id, "master") : ship.image;
    overviewImage.alt = ship.name;
  }
  if (overviewNameplate) overviewNameplate.textContent = ship.name;

  if (overviewStats) {
    const hullPercent = repairState.hullMax > 0 ? Math.max(0, Math.min(100, (repairState.hull / repairState.hullMax) * 100)) : 0;
    overviewStats.innerHTML = `
      <div class="hangar-stat-card hull-stat featured-stat" data-stat="hull"><span>Hull</span><strong>${formatNumber(Math.floor(repairState.hull))} / ${formatNumber(repairState.hullMax)}</strong><i style="--hull-fill:${hullPercent}%"></i></div>
      <div class="hangar-stat-card shield-stat" data-stat="shield"><span>Shield</span><strong>${formatNumber(stats.shield)}</strong></div>
      <div class="hangar-stat-card armor-stat" data-stat="armor"><span>Armor</span><strong>${formatNumber(stats.armor)}</strong></div>
      <div class="hangar-stat-card cargo-stat" data-stat="cargo"><span>Cargo</span><strong>${formatNumber(stats.cargo)}</strong></div>
      <div class="hangar-stat-card jump-stat" data-stat="jump"><span>Jump</span><strong>${formatNumber(stats.jumpRecharge)} LY</strong></div>
      <div class="hangar-stat-card evasion-stat" data-stat="evasion"><span>Evasion</span><strong>${formatEvasion(stats.evasion)}</strong></div>
    `;
  }

  if (overviewRepair) {
    overviewRepair.innerHTML = missingHull > 0
      ? `
        <div class="repair-hero-card needs-repair unique-repair-card compact-repair-card prestige-repair-strip">
          <div>
            <span>Hull Service</span>
            <strong>${formatNumber(Math.floor(repairState.hull))} / ${formatNumber(repairState.hullMax)} hull · CR ${formatNumber(repairCost)}${repairState.source === "pvp" ? " · PvP" : ""}</strong>
          </div>
          <button onclick="repairCurrentShip()" ${repairDisabled ? "disabled" : ""}>Repair Hull</button>
        </div>
      `
      : `<div class="loadout-repair-ready" role="status"><span aria-hidden="true">✓</span> Hull fully repaired</div>`;
  }

  renderInstalledGuns();
  renderInstalledAttachments();
  renderGunInventory();
  renderAttachmentInventory();
  renderLoadoutItemDetail();
}


function selectFleetShip(shipId) {
  if (!ownedShips.includes(shipId)) return;
  selectedFleetShipId = shipId;
  selectedHangarShipId = shipId;
  renderOwnedShips();
}

function renderFleetStatChip(label, value, statClass = "") {
  const statKey = String(label || "").toLowerCase() === "armour"
    ? "armor"
    : String(label || "").toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return `<div class="fleet-stat-chip ${statClass}" data-stat="${statKey}"><span>${label}</span><strong>${value}</strong></div>`;
}


function pluralLabel(count, singular, plural = `${singular}s`) {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

function formatSlotCapacityText(shipId) {
  const guns = getGunSlotLimit(shipId);
  const equip = getAttachmentSlotLimit(shipId);
  return `Guns ${formatNumber(guns)} slot${guns === 1 ? "" : "s"} / Equip ${formatNumber(equip)} slot${equip === 1 ? "" : "s"}`;
}

function formatSlotCapacityShort(shipId) {
  return `${getGunSlotLimit(shipId)} gun / ${getAttachmentSlotLimit(shipId)} equip`;
}

function formatSlotUsageText(shipId) {
  const loadout = getShipLoadout(shipId);
  return `Guns ${countEquippedGuns(shipId)}/${getGunSlotLimit(shipId)} / Equip ${countEquippedAttachments(shipId)}/${getAttachmentSlotLimit(shipId)}`;
}

function renderSlotPips(count, filled = count) {
  const safeCount = Math.max(0, Math.round(Number(count || 0)));
  const safeFilled = Math.max(0, Math.min(safeCount, Math.round(Number(filled || 0))));
  if (!safeCount) return `<span class="ship-slot-pip empty"></span>`;

  const visibleCount = Math.min(safeCount, 8);
  const filledVisible = Math.round((safeFilled / safeCount) * visibleCount);

  return Array.from({ length: visibleCount }).map((_, index) => `
    <span class="ship-slot-pip ${index < filledVisible ? "filled" : ""} ${safeCount > visibleCount ? "condensed" : ""}"></span>
  `).join("");
}

function renderShipSlotSummary(shipId, mode = "capacity") {
  const loadout = getShipLoadout(shipId);
  const guns = getGunSlotLimit(shipId);
  const equip = getAttachmentSlotLimit(shipId);
  const gunFilled = mode === "usage" ? countEquippedGuns(shipId) : guns;
  const equipFilled = mode === "usage" ? countEquippedAttachments(shipId) : equip;

  return `
    <div class="ship-slot-summary" aria-label="${escapeHtml(formatSlotCapacityText(shipId))}">
      <div class="ship-slot-bank gun-bank">
        <span>Guns</span>
        <strong>${mode === "usage" ? `${gunFilled}/${guns}` : guns}</strong>
        <div class="ship-slot-pips">${renderSlotPips(guns, gunFilled)}</div>
      </div>
      <div class="ship-slot-bank equip-bank">
        <span>Equip</span>
        <strong>${mode === "usage" ? `${equipFilled}/${equip}` : equip}</strong>
        <div class="ship-slot-pips">${renderSlotPips(equip, equipFilled)}</div>
      </div>
    </div>
  `;
}

function getVesselLineId(ship = {}) {
  return ship.lineId || "independent";
}

function getVesselLineLabel(lineId) {
  if (lineId === "independent") return "Independent Hulls";
  return SHIP_LINES?.[lineId]?.name || String(lineId || "Unknown Line");
}

function filterVesselsByLine(ships = [], lineId = "all") {
  return lineId === "all" ? ships : ships.filter(ship => getVesselLineId(ship) === lineId);
}

function renderVesselLineFilter(containerId, selectedLineId, changeHandler, ships = []) {
  const container = document.getElementById(containerId);
  if (!container) return;
  const lineIds = Array.from(new Set(ships.map(getVesselLineId)));
  const validSelection = selectedLineId === "all" || lineIds.includes(selectedLineId) ? selectedLineId : "all";
  container.innerHTML = `
    <label>
      <span>Ship Line</span>
      <select aria-label="Filter vessels by ship line" onchange="${changeHandler}(this.value)">
        <option value="all" ${validSelection === "all" ? "selected" : ""}>All Ship Lines</option>
        ${lineIds.map(lineId => `<option value="${escapeHtml(lineId)}" ${validSelection === lineId ? "selected" : ""}>${escapeHtml(getVesselLineLabel(lineId))}</option>`).join("")}
      </select>
    </label>
  `;
}

function setFleetLineFilter(lineId = "all") {
  selectedFleetLineId = lineId === "all" || SHIP_LINES?.[lineId] || lineId === "independent" ? lineId : "all";
  renderOwnedShips();
}

function setShipyardLineFilter(lineId = "all") {
  selectedShipyardLineId = lineId === "all" || SHIP_LINES?.[lineId] || lineId === "independent" ? lineId : "all";
  const visibleShips = getFilteredExchangeShips();
  selectedShipyardShipId = visibleShips.some(ship => ship.id === selectedShipyardShipId)
    ? selectedShipyardShipId
    : (visibleShips[0]?.id || "");
  renderShipShop();
}

function createVesselCatalogueCard(ship, { mode = "fleet", selected = false, active = false, unlock = null } = {}) {
  const isExchange = mode === "exchange";
  const card = document.createElement("button");
  const roleLabel = getVesselLineLabel(getVesselLineId(ship));
  const statusLabel = active
    ? "Active"
    : isExchange
      ? (unlock?.locked ? "Locked" : ship.price ? `CR ${formatNumber(ship.price)}` : "Available")
      : "Owned";
  const supportingLabel = active
    ? "Current vessel"
    : isExchange
      ? (unlock?.locked ? unlock.requirementLines?.[0] || "Plan requirements incomplete" : "Available to purchase")
      : getVesselExchangeClassLabel(ship);

  card.className = `fleet-ship-card fleet-selector-card vessel-exchange-card exchange-vessel-card unified-vessel-card ${mode === "fleet" ? "fleet-roster-card owned" : ""} ${selected ? "selected" : ""} ${active ? "active" : ""} ${unlock?.locked ? "progression-locked" : ""}`;
  card.dataset.shipId = ship.id;
  card.setAttribute("aria-pressed", selected ? "true" : "false");
  card.setAttribute("aria-label", `${ship.name}, ${getVesselExchangeClassLabel(ship)}, ${statusLabel}`);
  card.innerHTML = `
    <div class="fleet-card-badge">${escapeHtml(statusLabel)}</div>
    <div class="fleet-card-image-wrap fleet-roster-image">
      <img src="${typeof getShipAsset === "function" ? getShipAsset(ship.id, "medium") : ship.image}" alt="${escapeHtml(ship.name)}">
    </div>
    <div class="fleet-card-role">${escapeHtml(roleLabel)}</div>
    <div class="fleet-card-name">${escapeHtml(ship.name)}</div>
    <div class="vessel-card-description">${escapeHtml(supportingLabel)}</div>
  `;
  return card;
}


function renderOwnedShips() {
  const box = document.getElementById("ownedShipsList");
  if (!box) return;
  const title = document.getElementById("hangarShipTitle");
  const subtitle = document.getElementById("hangarShipSubtitle");
  if (title) title.textContent = "Fleet";
  if (subtitle) subtitle.textContent = "Owned vessels";

  const fleetCount = document.getElementById("fleetCountText");
  if (fleetCount) fleetCount.textContent = formatNumber(ownedShips.length);
  const fleetCountLabel = document.getElementById("fleetCountLabel");
  if (fleetCountLabel) fleetCountLabel.textContent = ownedShips.length === 1 ? "vessel owned" : "vessels owned";

  box.innerHTML = "";

  const ownedVessels = ownedShips.map(shipId => SHIPS[shipId]).filter(Boolean);
  renderVesselLineFilter("fleetLineFilter", selectedFleetLineId, "setFleetLineFilter", ownedVessels);
  const visibleVessels = filterVesselsByLine(ownedVessels, selectedFleetLineId);

  if (!visibleVessels.some(ship => ship.id === selectedFleetShipId)) {
    selectedFleetShipId = visibleVessels.find(ship => ship.id === currentShipId)?.id || visibleVessels[0]?.id || "";
  }

  if (!visibleVessels.length) {
    box.innerHTML = `<div class="vessel-empty-state"><strong>No owned hulls</strong><span>No vessels from this ship line are in your fleet.</span></div>`;
    renderFleetDetail();
    return;
  }

  visibleVessels.forEach(ship => {
    const shipId = ship.id;

    const isEquipped = currentShipId === shipId;
    const isSelected = selectedFleetShipId === shipId;

    const card = createVesselCatalogueCard(ship, { mode: "fleet", selected: isSelected, active: isEquipped });
    card.onclick = () => selectFleetShip(shipId);

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
  const isEquipped = currentShipId === shipId;
  const status = document.getElementById("fleetDetailStatus");
  if (status) status.textContent = isEquipped ? "Active" : "Owned";

  const hullState = isEquipped
    ? getEffectiveRepairHullState()
    : { hull: stats.hull, hullMax: stats.hullMax || stats.hull, missingHull: 0, source: "stored" };
  const repairCost = isEquipped ? getRepairCost() : 0;
  const hullPercent = hullState.hullMax > 0
    ? Math.max(0, Math.min(100, (hullState.hull / hullState.hullMax) * 100))
    : 0;
  const needsRepair = isEquipped && hullState.missingHull > 0;
  const repairDisabled = !needsRepair || credits < repairCost;
  const statusLabel = isEquipped ? "Active" : "Owned";
  const statusMessage = isEquipped ? "Vessel is ready for deployment." : "Ready to become your active vessel.";
  const conditionLabel = needsRepair ? `${Math.round(hullPercent)}% hull integrity` : "Ready";
  const repairButtonLabel = !isEquipped
    ? "Activate to Repair"
    : needsRepair
      ? `Repair Hull · CR ${formatNumber(repairCost)}`
      : "Repair Hull";
  const managementAction = isEquipped
    ? `<button class="fleet-management-primary" onclick="showHangarSection('overview');">Open Loadout</button>`
    : `<button class="fleet-management-primary" onclick="equipShip('${shipId}'); showHangarSection('owned');">Set Active</button>`;

  panel.innerHTML = `
    <div class="exchange-selected-vessel fleet-selected-vessel is-open" data-ship-id="${escapeHtml(ship.id)}">
      <section class="exchange-detail-preview fleet-selected-hero">
        <div class="exchange-selected-identity fleet-selected-identity">
          <span>${isEquipped ? "Active Vessel" : "Selected Vessel"}</span>
          <h4>${escapeHtml(ship.name)}</h4>
          <p>${getVesselExchangeClassLabel(ship)}</p>
        </div>
        <div class="exchange-detail-status-chip fleet-selected-status ${isEquipped ? "active" : "owned"}">${statusLabel}</div>
        <div class="exchange-selected-presentation fleet-selected-presentation">
          <div class="exchange-detail-glow fleet-selected-glow"></div>
          <div class="exchange-hero-ring fleet-selected-ring"></div>
          <img src="${typeof getShipAsset === "function" ? getShipAsset(ship.id, "large") : ship.image}" alt="${ship.name}">
        </div>
      </section>

      ${renderExchangeShipStatsSection(shipId, stats, {
        hullValue: `${formatNumber(Math.floor(hullState.hull))} / ${formatNumber(hullState.hullMax)}`,
        slotsMode: "usage"
      })}

      <footer class="exchange-purchase-bar fleet-management-bar ${needsRepair ? "needs-repair" : "ready"}">
        <div class="exchange-purchase-summary fleet-condition-summary">
          <span>Hull Condition</span>
          <strong>${conditionLabel}</strong>
          <small>${formatNumber(Math.floor(hullState.hull))} / ${formatNumber(hullState.hullMax)} hull</small>
        </div>
        <div class="exchange-detail-footer fleet-management-actions">
          <button class="fleet-repair-action" onclick="repairCurrentShip()" ${repairDisabled ? "disabled" : ""}>${repairButtonLabel}</button>
          ${managementAction}
        </div>
      </footer>
    </div>
  `;
}

function getCurrentPvpSessionHullState() {
  const state = typeof serverPvpDamageDisplayState === "object" && serverPvpDamageDisplayState
    ? serverPvpDamageDisplayState
    : null;
  const pvpHull = Number(state?.hull);
  if (!Number.isFinite(pvpHull)) return null;
  const pvpHullMax = Number(state?.hullMax);
  const maxHull = Number.isFinite(pvpHullMax) && pvpHullMax > 0 ? pvpHullMax : hullMax;
  if (!Number.isFinite(maxHull) || maxHull <= 0) return null;
  return {
    hull: Math.max(1, Math.min(maxHull, pvpHull)),
    hullMax: maxHull,
    damaged: pvpHull < maxHull
  };
}

function getEffectiveRepairHullState() {
  const localHull = Number.isFinite(Number(hull)) ? Number(hull) : hullMax;
  const localHullMax = Number.isFinite(Number(hullMax)) && Number(hullMax) > 0 ? Number(hullMax) : 1;
  const pvpState = getCurrentPvpSessionHullState();
  if (pvpState?.damaged && pvpState.hull < localHull) {
    return {
      hull: pvpState.hull,
      hullMax: localHullMax,
      missingHull: Math.max(0, localHullMax - pvpState.hull),
      source: "pvp"
    };
  }
  return {
    hull: localHull,
    hullMax: localHullMax,
    missingHull: Math.max(0, localHullMax - localHull),
    source: "local"
  };
}

function getRepairCost() {
  const repairState = getEffectiveRepairHullState();
  return Math.max(0, Math.ceil(repairState.missingHull * HULL_REPAIR_COST_PER_POINT));
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

  const repairState = getEffectiveRepairHullState();
  const missingHull = repairState.missingHull;
  const repairCost = getRepairCost();
  const disabled = missingHull <= 0 || credits < repairCost;

  return `
    <div class="repair-panel">
      <strong>Ship Condition</strong>
      <span>Hull: ${formatNumber(Math.floor(repairState.hull))} / ${formatNumber(repairState.hullMax)}${repairState.source === "pvp" ? " (PvP session)" : ""}</span>
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
  saveActiveShipCondition(currentShipId);

  if (typeof applyServerPvpDamageState === "function") {
    applyServerPvpDamageState({
      targetSessionId: window.LupenMultiplayerClient?.sessionId || "",
      shield,
      shieldMax,
      armor,
      armorMax: armor,
      hull,
      hullMax,
      reason: "hangar_repair_local"
    });
  }

  if (window.LupenMultiplayerClient?.syncPvpRepairState) {
    window.LupenMultiplayerClient.syncPvpRepairState({
      currentShipId,
      hull,
      hullMax,
      shield,
      shieldMax,
      armor,
      armorMax: armor,
      reason: "hangar_repair"
    });
  }

  addHudToast(`Hull repaired in Hangar for CR ${formatNumber(repairCost)}.`);
  if (typeof recordMissionEvent === "function") recordMissionEvent("repair_ship", { shipId: currentShipId, cost: repairCost });
  tutorialEvent("repairedShip");
  updateSpaceHUD();
  renderHangar();
  saveGame();
}

function isShipLineUnlocked(lineId) {
  const line = SHIP_LINES?.[lineId];
  return Boolean(line?.unlockedByDefault || (Array.isArray(unlockedShipLines) && unlockedShipLines.includes(lineId)));
}

function getShipPlanStatus(shipId) {
  const ship = SHIPS[shipId];
  if (!ship) return { state: "unknown", label: "Unknown" };
  const lineUnlocked = isShipLineUnlocked(ship.lineId);
  if (!lineUnlocked) return { state: "locked", label: "Plan Locked" };
  if (currentShipId === shipId) return { state: "active", label: "Active" };
  if (ownedShips.includes(shipId)) return { state: "owned", label: "Owned" };
  return { state: "available", label: shipId === STARTER_SHIP_ID ? "Starter Plan" : "Ready to Purchase" };
}

function openShipPlanShip(shipId) {
  if (!SHIPS[shipId]) return;
  if (ownedShips.includes(shipId)) {
    selectedFleetShipId = shipId;
    showHangarSection("owned");
    return;
  }
  selectedShipyardShipId = shipId;
  showHangarSection("shipyard");
}

function selectShipPlanLine(lineId) {
  const validLine = Boolean(SHIP_LINES?.[lineId]);
  selectedShipPlanLineId = validLine ? lineId : "encrypted-future";
  if (validLine && !SHIP_LINES[lineId].shipIds.includes(selectedShipPlanShipId)) {
    selectedShipPlanShipId = SHIP_LINES[lineId].shipIds[0] || "";
  }
  renderShipPlans();
}

function selectShipPlanShip(shipId) {
  if (!SHIPS[shipId]) return;
  selectedShipPlanShipId = shipId;
  renderShipPlans();
}

function renderShipPlanCard(shipId) {
  const ship = SHIPS[shipId];
  if (!ship) return "";
  const status = getShipPlanStatus(shipId);
  const selected = selectedShipPlanShipId === shipId;

  return `
    <button type="button" class="ship-plan-card ${status.state} ${selected ? "selected" : ""}"
      data-ship-id="${escapeHtml(shipId)}" aria-pressed="${selected ? "true" : "false"}"
      onclick="selectShipPlanShip('${escapeHtml(shipId)}')">
      <div class="ship-plan-card-status">${escapeHtml(status.label)}</div>
      <div class="ship-plan-image-wrap">
        <div class="ship-plan-image-halo"></div>
        <img src="${escapeHtml(getShipAsset(shipId, "medium"))}" alt="${escapeHtml(ship.name)}">
      </div>
      <div class="ship-plan-card-copy">
        <span>${escapeHtml(ship.className || getVesselExchangeClassLabel(ship))}</span>
        <h4>${escapeHtml(ship.name)}</h4>
      </div>
    </button>
  `;
}

function renderSelectedShipPlan(shipId) {
  const ship = SHIPS[shipId];
  if (!ship) return "";
  const status = getShipPlanStatus(shipId);
  const actionLabel = status.state === "active"
    ? "Active Vessel"
    : status.state === "owned"
      ? "View in Fleet"
      : shipId === STARTER_SHIP_ID && !hasActiveShip()
        ? "Claim in Exchange"
        : "View Full Specs";
  const acquisition = shipId === STARTER_SHIP_ID ? "Starter hull" : `CR ${formatNumber(ship.price)}`;

  return `
    <section class="ship-plan-selection" data-selected-ship-id="${escapeHtml(shipId)}" aria-live="polite">
      <div class="ship-plan-selection-copy">
        <span>SELECTED PLAN · ${escapeHtml(ship.className || getVesselExchangeClassLabel(ship))}</span>
        <h5>${escapeHtml(ship.name)}</h5>
        <p>${escapeHtml(ship.description || ship.roleSubtitle || ship.role || "Recovered ship plan.")}</p>
      </div>
      <div class="ship-plan-selection-action">
        <small>${escapeHtml(ship.roleSubtitle || ship.role || "General purpose")}</small>
        <strong>${escapeHtml(acquisition)}</strong>
        <button type="button" onclick="openShipPlanShip('${escapeHtml(shipId)}')" ${status.state === "active" ? "disabled" : ""}>${escapeHtml(actionLabel)}</button>
      </div>
    </section>
  `;
}

function renderShipPlans() {
  const content = document.getElementById("shipPlansContent");
  if (!content) return;

  const title = document.getElementById("hangarShipTitle");
  const subtitle = document.getElementById("hangarShipSubtitle");
  if (title) title.textContent = "Ship Plans";
  if (subtitle) subtitle.textContent = "Discovered families and construction access";

  const lines = Object.values(SHIP_LINES || {});
  const unlockedCount = lines.filter(line => isShipLineUnlocked(line.id)).length;
  if (!SHIP_LINES?.[selectedShipPlanLineId] && selectedShipPlanLineId !== "encrypted-future") {
    selectedShipPlanLineId = lines.find(line => isShipLineUnlocked(line.id))?.id || lines[0]?.id || "encrypted-future";
  }
  const count = document.getElementById("shipPlansUnlockedCount");
  if (count) count.textContent = formatNumber(unlockedCount);

  const selectedLine = SHIP_LINES?.[selectedShipPlanLineId];
  const selectedUnlocked = selectedLine ? isShipLineUnlocked(selectedLine.id) : false;
  if (selectedLine && !selectedLine.shipIds.includes(selectedShipPlanShipId)) {
    selectedShipPlanShipId = selectedLine.shipIds[0] || "";
  }

  const selectorCards = lines.map(line => {
    const unlocked = isShipLineUnlocked(line.id);
    const selected = selectedShipPlanLineId === line.id;
    return `
      <button type="button" class="ship-plan-selector-card ${selected ? "selected" : ""} ${unlocked ? "unlocked" : "locked"}"
        data-line-id="${escapeHtml(line.id)}" aria-pressed="${selected ? "true" : "false"}" onclick="selectShipPlanLine('${escapeHtml(line.id)}')">
        <span>${escapeHtml(line.manufacturer)}</span>
        <strong>${escapeHtml(line.name)}</strong>
        <small>${unlocked ? `${formatNumber(line.shipIds.length)} hull plans available` : "Plans encrypted"}</small>
        <b>${unlocked ? "Unlocked" : "Locked"}</b>
      </button>
    `;
  }).join("");

  const futureSelected = selectedShipPlanLineId === "encrypted-future";
  const selectedWorkspace = selectedLine ? `
    <section class="ship-plan-line ${selectedUnlocked ? "unlocked" : "locked"}" data-line-id="${escapeHtml(selectedLine.id)}">
      <header class="ship-plan-line-header">
        <div>
          <span>${escapeHtml(selectedLine.manufacturer)}</span>
          <h4>${escapeHtml(selectedLine.name)}</h4>
          <p>${formatNumber(selectedLine.shipIds.length)} hull designs share this plan architecture.</p>
        </div>
        <div class="ship-plan-line-state ${selectedUnlocked ? "unlocked" : "locked"}">
          <strong>${selectedUnlocked ? "PLANS UNLOCKED" : "PLANS ENCRYPTED"}</strong>
          <small>${escapeHtml(selectedLine.unlockHint || "Discovery method unknown.")}</small>
        </div>
      </header>
      ${selectedUnlocked ? `
        <div class="ship-plan-card-grid">
          ${selectedLine.shipIds.map(renderShipPlanCard).join("")}
        </div>
        ${renderSelectedShipPlan(selectedShipPlanShipId)}
      ` : `
        <div class="ship-plan-locked-lineup">
          <strong>Lineup data encrypted</strong>
          <span>Recover this plan family to reveal its hulls and construction specifications.</span>
        </div>
      `}
    </section>
  ` : `
    <section class="ship-plan-line future locked" data-line-id="encrypted-future">
      <header class="ship-plan-line-header">
        <div>
          <span>UNDISCOVERED MANUFACTURER</span>
          <h4>Encrypted Ship Line</h4>
          <p>Recover plans through exploration, missions and regional progression.</p>
        </div>
        <div class="ship-plan-line-state locked">
          <strong>NOT DISCOVERED</strong>
          <small>Unlock method not yet known.</small>
        </div>
      </header>
      <div class="ship-plan-encrypted-preview" aria-label="Undiscovered ship plans">
        <span>?</span><span>?</span><span>?</span><span>?</span>
      </div>
    </section>
  `;

  content.innerHTML = `
    <div class="ship-plans-browser">
      <aside class="ship-plan-selector" aria-label="Ship plan families">
        <div class="ship-plan-selector-heading">
          <span>PLAN ARCHIVE</span>
          <small>Select a recovered family</small>
        </div>
        ${selectorCards}
        <button type="button" class="ship-plan-selector-card future locked ${futureSelected ? "selected" : ""}"
          data-line-id="encrypted-future" aria-pressed="${futureSelected ? "true" : "false"}" onclick="selectShipPlanLine('encrypted-future')">
          <span>UNKNOWN SOURCE</span>
          <strong>Encrypted Line</strong>
          <small>Lineup unavailable</small>
          <b>Undiscovered</b>
        </button>
      </aside>
      <div class="ship-plan-workspace">
        ${selectedWorkspace}
      </div>
    </div>
  `;
}

function equipShip(shipId) {
  if (isMultiplayerStagingStoreActive()) {
    const ship = SHIPS[shipId];
    if (ship && !ship.hiddenFromExchange && ownedShips.includes(shipId) && currentShipId !== shipId && getStagingStoreItemId({ kind: "ship", key: shipId })) {
      requestStagingShipEquip({ kind: "ship", key: shipId });
      return;
    }
  }
  if (blockLoadoutMutationInMultiplayerStaging()) return;
  if (!ownedShips.includes(shipId)) return;

  saveActiveShipCondition(currentShipId);
  currentShipId = shipId;
  selectedHangarShipId = shipId;
  selectedFleetShipId = shipId;
  ensureShipCondition(shipId);
  applyShipStats(false);
  renderHangar();
  addHudToast(`${SHIPS[shipId]?.name || "Ship"} is ready to fly.`);
  const starterShipId = typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
  if (tutorialState?.active && getCurrentTutorialStep?.()?.id === "buy-first-ship" && shipId === starterShipId) {
    tutorialEvent("boughtFirstShip");
  }
  if (shipId === starterShipId && typeof recordMissionEvent === "function") {
    recordMissionEvent("starter_ship_claimed", { shipId, mode: "activate" });
  }
  saveGame();
}
