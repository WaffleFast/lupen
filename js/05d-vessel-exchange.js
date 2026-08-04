function getExchangeShips() {
  const plannedOrder = Object.values(SHIP_LINES || {}).flatMap(line => line.shipIds || []);
  const plannedShips = plannedOrder.map(shipId => SHIPS[shipId]).filter(Boolean);
  const unplannedShips = Object.values(SHIPS).filter(ship => !ship.lineId && !ship.hiddenFromExchange);
  return [...plannedShips, ...unplannedShips].filter(ship =>
    !ship.hiddenFromExchange && (!ship.lineId || isShipLineUnlocked(ship.lineId))
  );
}

function getShipyardSelectedShip() {
  const visibleShips = getFilteredExchangeShips();
  if (!visibleShips.some(ship => ship.id === selectedShipyardShipId)) {
    selectedShipyardShipId = visibleShips[0]?.id || "";
  }
  return visibleShips.find(ship => ship.id === selectedShipyardShipId) || null;
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
    ${renderFleetStatChip("Armor", formatNumber(stats.armor), "hull-stat")}
    ${renderFleetStatChip("Cargo", formatNumber(stats.cargo), "cargo-stat")}
    ${renderFleetStatChip("Jump", formatNumber(stats.jumpRecharge), "jump-stat")}
    ${renderFleetStatChip("Evasion", formatEvasion(stats.evasion), "evasion-stat")}
  `;
}

function getShipyardClassLabel(ship = {}) {
  return String(ship.roleSubtitle || "Available Hull")
    .replace(/\s+hull$/i, "")
    .split("/")
    .map(part => part.trim())
    .filter(Boolean)
    .join(" / ")
    .toUpperCase();
}

function getVesselExchangeClassLabel(ship = {}) {
  const raw = String(ship.roleSubtitle || ship.role || "Available Hull").trim();
  const labels = {
    "Starter Fighter / Interceptor": "Starter Fighter",
    "Ancient-Tech Endgame Ship": "Ancient-Tech"
  };
  return labels[raw] || raw.replace(/\s+hull$/i, "");
}

function getShipyardClassMark(ship = {}) {
  const label = getShipyardClassLabel(ship);
  return label.split(/\s+/).map(part => part[0]).join("").slice(0, 2) || "HX";
}

function setShipyardFilter(filter = "all") {
  selectedShipyardFilter = "unowned";
  const visibleShips = getFilteredExchangeShips();
  if (visibleShips.length && !visibleShips.some(ship => ship.id === selectedShipyardShipId)) {
    selectedShipyardShipId = visibleShips[0].id;
  }
  renderShipShop();
}

function getFilteredExchangeShips() {
  const purchasableShips = getExchangeShips().filter(ship => !ownedShips.includes(ship.id));
  return filterVesselsByLine(purchasableShips, selectedShipyardLineId);
}

function updateShipyardFilterButtons() {
  [
    ["shipyardFilterAll", "all"],
    ["shipyardFilterOwned", "owned"],
    ["shipyardFilterUnowned", "unowned"]
  ].forEach(([id, filter]) => {
    const button = document.getElementById(id);
    if (button) button.classList.toggle("active", selectedShipyardFilter === filter);
  });
}

function renderExchangeStatRail(shipId) {
  const stats = getShipStats(shipId);
  const statRows = [
    ["Hull", formatNumber(stats.hull)],
    ["Shield", formatNumber(stats.shield)],
    ["Armor", formatNumber(stats.armor)],
    ["Cargo", formatNumber(stats.cargo)],
    ["Jump", `${formatNumber(stats.jumpRecharge)} LY`],
    ["Evasion", formatEvasion(stats.evasion)]
  ];

  return statRows.map(([label, value]) => `
    <div class="exchange-stat-cell">
      <span>${label}</span>
      <strong>${value}</strong>
    </div>
  `).join("");
}

function renderExchangeSlotPips(count) {
  const safeCount = Math.max(0, Math.round(Number(count || 0)));
  const visibleCount = Math.min(safeCount, 20);
  if (!visibleCount) return `<span class="exchange-slot-pip empty"></span>`;
  return Array.from({ length: visibleCount }).map(() => `<span class="exchange-slot-pip filled"></span>`).join("");
}

function renderExchangeHardpointRail(shipId, mode = "capacity") {
  const guns = getGunSlotLimit(shipId);
  const equip = getAttachmentSlotLimit(shipId);
  const gunsEquipped = mode === "usage" ? countEquippedGuns(shipId) : guns;
  const equipEquipped = mode === "usage" ? countEquippedAttachments(shipId) : equip;
  return `
    <div class="exchange-capacity-card weapon-capacity">
      <div class="exchange-slot-summary-head">
        <span>Weapon Slots</span>
        <strong>${mode === "usage" ? `${gunsEquipped} / ${guns}` : guns}</strong>
      </div>
      <div class="exchange-slot-pips">
        ${renderSlotPips(guns, gunsEquipped)}
      </div>
    </div>
    <div class="exchange-capacity-card equip-capacity">
      <div class="exchange-slot-summary-head">
        <span>Equipment Slots</span>
        <strong>${mode === "usage" ? `${equipEquipped} / ${equip}` : equip}</strong>
      </div>
      <div class="exchange-slot-pips">
        ${renderSlotPips(equip, equipEquipped)}
      </div>
    </div>
  `;
}

function getExchangeRequirementLabel(key) {
  if (key === "combatLevel") return "Combat Level";
  if (key === "erebusBotsDestroyed") return "Erebus Bots Destroyed";
  if (key === "totalTradingProfit") return "Trading Profit";
  if (key === "bountiesClaimed") return "Bounties Completed";
  return String(key || "Requirement").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, letter => letter.toUpperCase());
}

function formatExchangeRequirementValue(key, value) {
  const safeValue = Math.max(0, Math.round(Number(value || 0)));
  return key === "totalTradingProfit" ? `CR ${formatNumber(safeValue)}` : formatNumber(safeValue);
}

function renderExchangeRequirementRows(unlock) {
  const progress = Array.isArray(unlock?.progress) ? unlock.progress : [];
  if (!progress.length) return "";

  return `
    <section class="exchange-detail-section exchange-unlock-section ${unlock.locked ? "locked" : "met"}">
      <div class="exchange-section-heading">
        <span>Unlock Requirements</span>
        <strong>${unlock.locked ? "Locked" : "Met"}</strong>
      </div>
      <div class="exchange-requirement-rows">
        ${progress.map(item => `
          <div class="exchange-requirement-row ${item.met ? "met" : "missing"}">
            <span>${escapeHtml(getExchangeRequirementLabel(item.key))}</span>
            <strong>${escapeHtml(formatExchangeRequirementValue(item.key, Math.min(item.current, item.required)))} / ${escapeHtml(formatExchangeRequirementValue(item.key, item.required))}</strong>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function renderExchangeShipStatsSection(shipId, stats, options = {}) {
  const hullValue = options.hullValue || formatNumber(stats.hull);
  const slotsMode = options.slotsMode || "capacity";
  return `
    <section class="exchange-detail-section exchange-stat-section">
      <div class="exchange-section-heading">
        <span>Ship Stats</span>
      </div>
      <div class="exchange-detail-stat-grid">
        ${renderFleetStatChip("Hull", hullValue, "hull-stat")}
        ${renderFleetStatChip("Shield", formatNumber(stats.shield), "shield-stat")}
        ${renderFleetStatChip("Armor", formatNumber(stats.armor), "armor-stat")}
        ${renderFleetStatChip("Cargo", formatNumber(stats.cargo), "cargo-stat")}
        ${renderFleetStatChip("Jump", formatNumber(stats.jumpRecharge), "jump-stat")}
        ${renderFleetStatChip("Evasion", formatEvasion(stats.evasion), "evasion-stat")}
      </div>
      <div class="exchange-detail-loadout">
        ${renderExchangeHardpointRail(shipId, slotsMode)}
      </div>
    </section>
  `;
}

function renderShipyardDetail() {
  const panel = document.getElementById("shipyardDetailPanel");
  if (!panel) return;

  const ship = getShipyardSelectedShip();
  if (!ship) {
    const lineLabel = selectedShipyardLineId === "all" ? "the current catalogue" : getVesselLineLabel(selectedShipyardLineId);
    const status = document.getElementById("shipyardDetailStatus");
    if (status) status.textContent = "No hulls available";
    panel.innerHTML = `
      <div class="exchange-empty-workspace">
        <span>CATALOGUE COMPLETE</span>
        <strong>No hulls available</strong>
        <p>Every purchaseable vessel in ${escapeHtml(lineLabel)} is already in your fleet.</p>
        <button type="button" onclick="showHangarSection('owned')">View Fleet</button>
      </div>
    `;
    return;
  }
  const owned = ownedShips.includes(ship.id);
  const equipped = currentShipId === ship.id;
  const canAfford = credits >= ship.price;
  const stats = getShipStats(ship.id);
  const unlock = getShipUnlockStatus(ship.id);
  const starterShipId = typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
  const starterClaim = !hasActiveShip() && ship.id === starterShipId;
  const status = document.getElementById("shipyardDetailStatus");
  if (status) status.textContent = unlock.state === "locked" ? "Locked" : equipped ? "Active" : owned ? "Owned" : "Available";

  let primaryAction = "";
  let secondaryAction = "";
  if (equipped) {
    primaryAction = `<button class="exchange-footer-secondary" disabled>Active</button>`;
    secondaryAction = `<button class="exchange-footer-primary" onclick="showHangarSection('overview');">Open Loadout</button>`;
  } else if (owned) {
    primaryAction = `<button class="exchange-footer-secondary" disabled>Owned</button>`;
    secondaryAction = `<button class="exchange-footer-primary set-active-ship-action" ${ship.id === starterShipId ? "data-tutorial-target=\"firstShipBuy\"" : ""} onclick="equipShip('${ship.id}'); showHangarSection('shipyard');">Set Active</button>`;
  } else if (unlock.locked) {
    primaryAction = `<button class="exchange-footer-primary buy-ship-action locked-action" data-tutorial-target="firstShipBuy" onclick="buyShip('${ship.id}')">Locked</button>`;
    secondaryAction = `<button class="exchange-footer-secondary shipyard-price-action" disabled>CR ${formatNumber(ship.price)}</button>`;
  } else {
    primaryAction = `<button class="exchange-footer-primary buy-ship-action" data-tutorial-target="firstShipBuy" onclick="buyShip('${ship.id}')" ${!canAfford && !starterClaim ? "disabled" : ""}>${starterClaim ? "Claim Starter Ship" : "Buy Hull"}</button>`;
    secondaryAction = `<button class="exchange-footer-secondary shipyard-price-action" disabled>${starterClaim ? "Free Starter Hull" : `CR ${formatNumber(ship.price)}`}</button>`;
  }

  const requirementHtml = renderExchangeRequirementRows(unlock);
  const statusLabel = unlock.state === "locked" ? "Locked" : equipped ? "Active" : owned ? "Owned" : "Available";
  const statusMessage = unlock.state === "locked"
    ? "Recover the required plan progress before purchase."
    : equipped
      ? "This vessel is currently active."
      : owned
        ? "Owned and ready to become your active vessel."
        : starterClaim
          ? "Your first hull is ready to claim."
          : `Available for CR ${formatNumber(ship.price)}.`;
  const purchaseSummaryLabel = !owned && unlock.state !== "locked" ? "Purchase Price" : "Hull Status";
  const purchaseSummaryValue = !owned && unlock.state !== "locked"
    ? (starterClaim ? "FREE" : `CR ${formatNumber(ship.price)}`)
    : statusLabel;

  panel.innerHTML = `
    <div class="exchange-selected-vessel ${unlock.locked ? "is-locked" : "is-open"}" data-ship-id="${escapeHtml(ship.id)}">
      <section class="exchange-detail-preview">
        <div class="exchange-selected-identity">
          <span>${equipped ? "Active Vessel" : owned ? "Owned Vessel" : "Selected Hull"}</span>
          <h4>${escapeHtml(ship.name)}</h4>
          <p>${getVesselExchangeClassLabel(ship)}</p>
        </div>
        <div class="exchange-detail-status-chip ${unlock.state}">${statusLabel}</div>
        <div class="exchange-selected-presentation">
          <div class="exchange-detail-glow"></div>
          <div class="exchange-hero-ring"></div>
          <img src="${typeof getShipAsset === "function" ? getShipAsset(ship.id, "large") : ship.image}" alt="${ship.name}">
        </div>
      </section>
      ${requirementHtml}

      ${renderExchangeShipStatsSection(ship.id, stats)}

      <footer class="exchange-purchase-bar">
        <div class="exchange-purchase-summary">
          <span>${purchaseSummaryLabel}</span>
          <strong class="${!owned && unlock.state !== "locked" ? "is-purchase-price" : ""}">${purchaseSummaryValue}</strong>
          <small>${statusMessage}</small>
        </div>
        <div class="exchange-detail-footer">
          ${primaryAction}
          ${secondaryAction}
        </div>
      </footer>
    </div>
  `;
}

function renderShipShop() {
  const box = document.getElementById("shipShop");
  if (!box) return;
  const title = document.getElementById("hangarShipTitle");
  const subtitle = document.getElementById("hangarShipSubtitle");
  if (title) title.textContent = "Vessel Exchange";
  if (subtitle) subtitle.textContent = "Available hulls and purchase options";

  const creditText = document.getElementById("shipyardCreditText");
  if (creditText) creditText.textContent = formatNumber(credits);
  renderVesselLineFilter("shipyardLineFilter", selectedShipyardLineId, "setShipyardLineFilter", getExchangeShips());

  box.innerHTML = "";

  const visibleShips = getFilteredExchangeShips();
  if (!visibleShips.length) {
    box.innerHTML = `
      <div class="vessel-empty-state">
        <strong>No hulls available</strong>
        <span>Owned vessels have moved to your Fleet.</span>
      </div>
    `;
    renderShipyardDetail();
    return;
  }

  if (!visibleShips.some(ship => ship.id === selectedShipyardShipId)) {
    selectedShipyardShipId = visibleShips[0].id;
  }

  visibleShips.forEach(ship => {
    const selected = selectedShipyardShipId === ship.id;
    const unlock = getShipUnlockStatus(ship.id);

    const card = createVesselCatalogueCard(ship, { mode: "exchange", selected, active: false, unlock });
    const starterShipId = typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
    const isTutorialRequiredShip = tutorialState?.active && getCurrentTutorialStep()?.id === "buy-first-ship" && ship.id === starterShipId;
    card.classList.toggle("challenge-complete", unlock.state === "available");
    card.classList.toggle("tutorial-required-ship", isTutorialRequiredShip);
    if (ship.id === starterShipId) card.dataset.tutorialTarget = "firstShipCard";
    card.onclick = () => selectShipyardShip(ship.id);
    box.appendChild(card);
  });

  renderShipyardDetail();
}

function buyShip(shipId, storeItemOverride = null) {
  const ship = SHIPS[shipId];
  if (!ship) return;

  ownedShips = Array.isArray(ownedShips) ? ownedShips : [];
  shipLoadouts = shipLoadouts && typeof shipLoadouts === "object" ? shipLoadouts : {};
  shipConditions = shipConditions && typeof shipConditions === "object" ? shipConditions : {};

  const hadNoShip = !hasActiveShip();
  const starterShipId = typeof STARTER_SHIP_ID !== "undefined" ? STARTER_SHIP_ID : "falcon";
  const starterClaim = hadNoShip && shipId === starterShipId;
  const storeItem = storeItemOverride?.kind === "ship" && storeItemOverride.key === shipId
    ? storeItemOverride
    : getStoreCatalogItem("ship", shipId);

  if (isMultiplayerStagingStoreActive() && !starterClaim) {
    if (ship && !ship.hiddenFromExchange && !ownedShips.includes(shipId) && getStagingStoreItemId({ kind: "ship", key: shipId })) {
      requestStagingStorePurchase({ kind: "ship", key: shipId });
      return;
    }
  }
  if (!starterClaim && blockStoreMutationInMultiplayerStaging()) return;

  if (ownedShips.includes(shipId)) {
    if (starterClaim) {
      shipLoadouts[shipId] = normalizeShipLoadout(shipLoadouts[shipId] || { attachments: [], guns: [] }, shipId);
      currentShipId = shipId;
      selectedHangarShipId = shipId;
      selectedFleetShipId = shipId;
      selectedShipyardShipId = shipId;
      ensureShipCondition(shipId);
      applyShipStats(true);
      if (typeof recordMissionEvent === "function") recordMissionEvent("starter_ship_claimed", { shipId, mode: "activate" });
      tutorialEvent("boughtFirstShip");
      saveGame();
    }
    return;
  }

  const purchaseCheck = starterClaim
    ? { ok: true, price: 0 }
    : canPurchaseStoreItem(storeItem || { kind: "ship", key: shipId, basePrice: ship.price });
  if (!purchaseCheck.ok) {
    notifyStorePurchaseBlocked(purchaseCheck);
    renderShipShop();
    return;
  }

  const unlock = getShipUnlockStatus(shipId);
  if (unlock.locked) {
    if (typeof addHudToast === "function") addHudToast(unlock.message);
    else alert(unlock.message);
    renderShipShop();
    return;
  }

  credits -= purchaseCheck.price;
  ownedShips.push(shipId);
  if (!starterClaim && storeItem) recordStorePurchase(storeItem);
  selectedHangarShipId = shipId;
  selectedFleetShipId = shipId;
  selectedShipyardShipId = shipId;
  shipLoadouts[shipId] = normalizeShipLoadout({ attachments: [], guns: [] }, shipId);
  shipConditions[shipId] = normalizeShipCondition(shipId);

  if (hadNoShip) {
    currentShipId = shipId;
    if (starterClaim) initializeStarterShipEmptyLoadout();
    applyShipStats(true);
  }

  if (starterClaim && typeof recordMissionEvent === "function") {
    recordMissionEvent("starter_ship_claimed", { shipId, mode: "claim" });
  } else if (!starterClaim && typeof recordMissionEvent === "function" && ship.lineId === PIONEER_LINE_ID) {
    recordMissionEvent("purchase_pioneer_hull", { shipId, lineId: ship.lineId, source: "vessel_exchange" });
  }

  renderHangar();
  showHangarSection("shipyard");
  addHudToast(`${ship.name} added to your hangar.`);
  tutorialEvent(hadNoShip ? "boughtFirstShip" : "boughtShip");
  saveGame();
}
