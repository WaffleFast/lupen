/* Dev/staging multiplayer ghost overlay.
   Draws read-only Colyseus pilot snapshots on the sector map when multiplayer
   staging/dev mode is active. These markers are visual only and never affect
   gameplay state. */

(function registerMultiplayerOverlay(global) {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const layerClass = "svg-mp-ghost-layer";
  const markerClass = "svg-mp-ghost";
  const botLayerClass = "svg-mp-bot-layer";
  const botMarkerClass = "svg-mp-bot";
  const spaceLayerId = "lupenMultiplayerSpaceGhostLayer";
  const spaceBotLayerId = "lupenMultiplayerSpaceBotLayer";
  const diagnosticsPanelId = "lupenMultiplayerDiagnostics";
  const styleId = "lupenMultiplayerOverlayStyles";
  let unsubscribe = null;
  let renderQueued = false;
  let diagnosticsTimer = null;

  function getClient() {
    return global.LupenMultiplayerClient || null;
  }

  function isEnabled() {
    const status = getClient()?.getStatus?.();
    return !!status?.enabled;
  }

  function isStagingMode(status = getClient()?.getStatus?.()) {
    return status?.enabledReason === "staging_enabled";
  }

  function ensureStyles() {
    if (global.document?.getElementById(styleId)) return;

    const style = global.document.createElement("style");
    style.id = styleId;
    style.textContent = `
      #${spaceLayerId} {
        position: absolute;
        inset: 84px 18px 170px;
        z-index: 9;
        pointer-events: none;
        overflow: hidden;
      }

      #${spaceBotLayerId} {
        position: absolute;
        inset: 84px 18px 170px;
        z-index: 8;
        pointer-events: none;
        overflow: hidden;
      }

      .lupen-mp-space-ghost {
        position: absolute;
        display: grid;
        justify-items: center;
        gap: 3px;
        transform: translate(-50%, -50%);
        opacity: 0.86;
        pointer-events: none;
        filter: drop-shadow(0 0 13px rgba(93, 232, 255, 0.62));
      }

      .lupen-mp-space-ghost-ship {
        position: relative;
        width: 38px;
        height: 50px;
        clip-path: polygon(50% 0%, 78% 62%, 61% 55%, 50% 100%, 39% 55%, 22% 62%);
        background: linear-gradient(180deg, rgba(187, 252, 255, 0.95), rgba(54, 186, 255, 0.5));
        border: 1px solid rgba(230, 255, 255, 0.86);
      }

      .lupen-mp-space-ghost-ship::after {
        content: "";
        position: absolute;
        left: 50%;
        bottom: 3px;
        width: 8px;
        height: 12px;
        transform: translateX(-50%);
        border-radius: 50%;
        background: rgba(115, 246, 255, 0.78);
        box-shadow: 0 0 12px rgba(115, 246, 255, 0.82);
      }

      .lupen-mp-space-ghost-ship::before {
        content: "";
        position: absolute;
        left: 50%;
        top: 12px;
        width: 7px;
        height: 17px;
        transform: translateX(-50%);
        border-radius: 50%;
        background: rgba(4, 18, 30, 0.62);
        border: 1px solid rgba(220, 255, 255, 0.62);
      }

      .lupen-mp-space-ghost-label {
        padding: 2px 6px;
        border: 1px solid rgba(127, 223, 255, 0.42);
        border-radius: 4px;
        background: rgba(2, 10, 18, 0.72);
        color: #c8fbff;
        font: 700 10px/1.15 Arial, sans-serif;
        text-transform: uppercase;
        white-space: nowrap;
      }

      .lupen-mp-space-ghost-note {
        color: rgba(194, 251, 255, 0.78);
        font: 700 8px/1 Arial, sans-serif;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        text-shadow: 0 1px 3px rgba(0, 4, 10, 0.9);
      }

      .lupen-mp-space-bot {
        position: absolute;
        display: grid;
        justify-items: center;
        gap: 3px;
        transform: translate(-50%, -50%);
        opacity: 0.66;
        pointer-events: auto;
        cursor: crosshair;
        filter: drop-shadow(0 0 8px rgba(255, 128, 62, 0.42));
      }

      .lupen-mp-space-bot.is-locked {
        opacity: 0.88;
        filter: drop-shadow(0 0 13px rgba(255, 198, 102, 0.7));
      }

      .lupen-mp-space-bot.is-disabled {
        opacity: 0.48;
        filter: drop-shadow(0 0 8px rgba(170, 170, 170, 0.4));
      }

      .lupen-mp-space-bot.is-hit {
        animation: lupen-mp-staging-hit 0.62s ease-out;
      }

      .${botMarkerClass}.is-hit {
        animation: lupen-mp-sector-bot-hit 0.62s ease-out;
      }

      .lupen-mp-space-bot-ship {
        position: relative;
        width: 24px;
        height: 32px;
        clip-path: polygon(50% 0%, 88% 48%, 68% 48%, 72% 88%, 50% 72%, 28% 88%, 32% 48%, 12% 48%);
        background: linear-gradient(180deg, rgba(255, 184, 92, 0.76), rgba(255, 74, 58, 0.4));
        border: 1px solid rgba(255, 224, 180, 0.58);
      }

      .lupen-mp-space-bot-ship::after {
        content: "";
        position: absolute;
        left: 50%;
        bottom: 4px;
        width: 10px;
        height: 8px;
        transform: translateX(-50%);
        border-radius: 50%;
        background: rgba(255, 93, 52, 0.72);
        box-shadow: 0 0 12px rgba(255, 93, 52, 0.8);
      }

      .lupen-mp-space-bot-label {
        padding: 2px 5px;
        border: 1px solid rgba(255, 163, 92, 0.46);
        border-radius: 4px;
        background: rgba(18, 8, 2, 0.72);
        color: #ffd9b0;
        font: 700 9px/1.15 Arial, sans-serif;
        text-transform: uppercase;
        white-space: nowrap;
      }

      .lupen-mp-space-bot-note {
        color: rgba(255, 213, 172, 0.8);
        font: 700 8px/1 Arial, sans-serif;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        text-shadow: 0 1px 3px rgba(10, 2, 0, 0.9);
      }

      .lupen-mp-space-bot.is-locked .lupen-mp-space-bot-note::after {
        content: " / LOCK";
        color: #fff4c7;
      }

      .lupen-mp-space-bot-damage {
        position: absolute;
        left: 50%;
        top: -18px;
        transform: translateX(-50%);
        color: #fff1b2;
        font: 900 13px/1 Arial, sans-serif;
        text-shadow: 0 0 8px rgba(255, 93, 52, 0.92), 0 1px 2px rgba(10, 2, 0, 0.95);
        animation: lupen-mp-damage-float 0.78s ease-out forwards;
      }

      @keyframes lupen-mp-staging-hit {
        0% {
          transform: translate(-50%, -50%) scale(1);
          filter: drop-shadow(0 0 8px rgba(255, 128, 62, 0.42));
        }
        35% {
          transform: translate(-50%, -50%) scale(1.16);
          filter: drop-shadow(0 0 18px rgba(255, 236, 158, 0.9));
        }
        100% {
          transform: translate(-50%, -50%) scale(1);
          filter: drop-shadow(0 0 8px rgba(255, 128, 62, 0.42));
        }
      }

      @keyframes lupen-mp-sector-bot-hit {
        0% {
          opacity: 0.72;
          filter: drop-shadow(0 0 1.8px rgba(255, 113, 55, 0.72));
        }
        35% {
          opacity: 1;
          filter: drop-shadow(0 0 4.6px rgba(255, 236, 158, 0.95));
        }
        100% {
          opacity: 0.72;
          filter: drop-shadow(0 0 1.8px rgba(255, 113, 55, 0.72));
        }
      }

      @keyframes lupen-mp-damage-float {
        0% {
          opacity: 0;
          transform: translate(-50%, 8px) scale(0.9);
        }
        25% {
          opacity: 1;
          transform: translate(-50%, 0) scale(1);
        }
        100% {
          opacity: 0;
          transform: translate(-50%, -14px) scale(1.04);
        }
      }

      #${diagnosticsPanelId} {
        position: fixed;
        top: 12px;
        right: 12px;
        z-index: 80;
        width: min(260px, calc(100vw - 24px));
        padding: 9px 10px;
        border: 1px solid rgba(127, 223, 255, 0.36);
        border-radius: 6px;
        background: rgba(2, 8, 16, 0.78);
        color: #d7fbff;
        box-shadow: 0 0 18px rgba(0, 150, 220, 0.18);
        font: 700 10px/1.35 Arial, sans-serif;
        pointer-events: none;
        text-transform: uppercase;
      }

      #${diagnosticsPanelId} strong {
        display: block;
        margin-bottom: 5px;
        color: #80efff;
        font-size: 11px;
        letter-spacing: 0.04em;
      }

      #${diagnosticsPanelId} .lupen-mp-diagnostics-row {
        display: flex;
        justify-content: space-between;
        gap: 10px;
        border-top: 1px solid rgba(127, 223, 255, 0.1);
        padding-top: 3px;
        margin-top: 3px;
      }

      #${diagnosticsPanelId} span {
        color: rgba(215, 251, 255, 0.68);
      }

      #${diagnosticsPanelId} em {
        color: #ffffff;
        font-style: normal;
        text-align: right;
        overflow-wrap: anywhere;
      }

      #${diagnosticsPanelId} .lupen-mp-diagnostics-note {
        display: block;
        margin-top: 6px;
        padding-top: 5px;
        border-top: 1px solid rgba(255, 176, 95, 0.18);
        color: rgba(255, 224, 188, 0.86);
        font: 700 9px/1.25 Arial, sans-serif;
      }

      #${diagnosticsPanelId} .lupen-mp-diagnostics-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 6px;
        padding-top: 6px;
        border-top: 1px solid rgba(255, 176, 95, 0.18);
        pointer-events: auto;
      }

      #${diagnosticsPanelId} .lupen-mp-test-fire-button {
        min-height: 24px;
        padding: 4px 8px;
        border: 1px solid rgba(255, 201, 118, 0.58);
        border-radius: 4px;
        background: rgba(78, 26, 6, 0.86);
        color: #ffe6bd;
        box-shadow: 0 0 10px rgba(255, 139, 69, 0.2);
        cursor: pointer;
        font: 800 10px/1 Arial, sans-serif;
        text-transform: uppercase;
      }

      #${diagnosticsPanelId} .lupen-mp-test-fire-button:hover {
        background: rgba(110, 39, 11, 0.92);
        color: #fff4d6;
      }

      #${diagnosticsPanelId} .lupen-mp-test-fire-button:disabled {
        opacity: 0.46;
        cursor: default;
      }
    `;
    global.document.head.appendChild(style);
  }

  function removeSectorLayer() {
    const svg = global.document?.getElementById("sectorSvg");
    svg?.querySelector(`.${layerClass}`)?.remove();
    svg?.querySelector(`.${botLayerClass}`)?.remove();
  }

  function removeSpaceLayer() {
    global.document?.getElementById(spaceLayerId)?.remove();
    global.document?.getElementById(spaceBotLayerId)?.remove();
  }

  function removeDiagnosticsPanel() {
    global.document?.getElementById(diagnosticsPanelId)?.remove();
  }

  function removeLayers() {
    removeSectorLayer();
    removeSpaceLayer();
    removeDiagnosticsPanel();
  }

  function clampMapCoordinate(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return 50;
    return Math.max(4, Math.min(96, number));
  }

  function normalizeNodeKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ");
  }

  function getSectorNodeByName(value) {
    if (typeof sectorNodes === "undefined") return null;

    const exactNode = sectorNodes[value];
    if (exactNode) return exactNode;

    const targetKey = normalizeNodeKey(value);
    const matchedName = Object.keys(sectorNodes).find((name) => normalizeNodeKey(name) === targetKey);
    return matchedName ? sectorNodes[matchedName] : null;
  }

  function getEntityPosition(entity) {
    const node = getSectorNodeByName(entity.currentNode);
    if (node) {
      return {
        x: clampMapCoordinate(node.x + 2.4),
        y: clampMapCoordinate(node.y - 2.4)
      };
    }

    return {
      x: clampMapCoordinate(entity.x),
      y: clampMapCoordinate(entity.y)
    };
  }

  function getServerBotMapPosition(bot) {
    const x = Number(bot?.x);
    const y = Number(bot?.y);
    if (Number.isFinite(x) && Number.isFinite(y)) {
      return {
        x: clampMapCoordinate(x),
        y: clampMapCoordinate(y)
      };
    }

    return getEntityPosition(bot);
  }

  function getPilotLabel(player) {
    const id = String(player.sessionId || player.id || "");
    const displayName = String(player.displayName || "").trim();
    if (displayName && displayName.toLowerCase() !== "pilot") return displayName.slice(0, 18);
    return `Pilot ${id.slice(0, 6) || "DEV"}`;
  }

  function getShipLabel(player) {
    const shipName = String(player.shipName || "").trim();
    if (shipName) return shipName.slice(0, 22);

    const shipId = String(player.currentShipId || "").trim();
    return shipId ? shipId.slice(0, 22) : "Unknown ship";
  }

  function getDevGhostLabel(player) {
    const shipLabel = getShipLabel(player);
    const modeLabel = isStagingMode() ? "STAGING PILOT" : "DEV GHOST";
    return shipLabel === "Unknown ship" ? modeLabel : `${shipLabel} / ${modeLabel}`;
  }

  function getBotLabel(bot) {
    return String(bot.name || bot.type || "DEV BOT").trim().slice(0, 18) || "DEV BOT";
  }

  function getBotInspectionLabel(bot) {
    if (!bot) return "none";
    const name = getBotLabel(bot);
    const id = String(bot.id || "").slice(-6) || "unknown";
    return `${name} / ${id}`;
  }

  function getBotLayerSummary(bot) {
    if (!bot) return "none";
    const level = Number(bot.level || 0) > 0 ? `L${bot.level}` : "L?";
    const faction = bot.faction || "Erebus";
    return `${faction} ${level} / ${bot.currentNode || "unknown"}`;
  }

  function getBotHullSummary(bot) {
    if (!bot) return "none";
    const shield = `${Math.round(Number(bot.shield || 0))}/${Math.round(Number(bot.shieldMax || 0))}`;
    const hull = `${Math.round(Number(bot.hull || 0))}/${Math.round(Number(bot.hullMax || 0))}`;
    return `${bot.disabled ? "DISABLED / " : ""}S ${shield} / H ${hull}`;
  }

  function getBotModeLabel() {
    return isStagingMode() ? "STAGING BOT" : "DEV BOT";
  }

  function getSelectedTargetBotId() {
    return getClient()?.getStatus?.()?.selectedTargetBotId || "";
  }

  function isSameCurrentNode(entity) {
    return normalizeNodeKey(entity?.currentNode) === normalizeNodeKey(getCurrentNodeName());
  }

  function wasRecentlyHit(bot, status = getClient()?.getStatus?.()) {
    const response = status?.lastCombatResponse;
    if (!bot?.id || !response?.ok || response.targetBotId !== bot.id) return false;
    return Date.now() - Number(response.receivedAt || 0) < 1200;
  }

  function getRecentDamageAmount(bot, status = getClient()?.getStatus?.()) {
    return wasRecentlyHit(bot, status) ? Math.max(0, Math.round(Number(status.lastCombatResponse.damage || 0))) : 0;
  }

  function selectStagingBot(bot) {
    if (!bot?.id) return;
    const client = getClient();
    const status = client?.getStatus?.();
    if (!status?.enabled || !status?.isConnected) return;
    client.selectStagingBot?.(bot.id, { currentNode: getCurrentNodeName() });
  }

  function getCompactBotModeLabel() {
    return isStagingMode() ? "STG BOT" : "DEV BOT";
  }

  function getLabelOffset(position) {
    return position.x > 82 ? -13.4 : 4.1;
  }

  function getStableMapOffset(entity, radius = 1.8) {
    const id = String(entity?.id || entity?.sessionId || entity?.name || "");
    const seed = id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    const angle = (seed % 360) * (Math.PI / 180);
    const distance = radius + (seed % 4) * 0.35;
    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance
    };
  }

  function drawSectorGhost(layer, player) {
    const position = getEntityPosition(player);
    const labelOffset = getLabelOffset(position);
    const group = global.document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", markerClass);
    group.setAttribute("data-session-id", player.sessionId || player.id || "");
    group.setAttribute("pointer-events", "none");
    group.setAttribute("transform", `translate(${position.x} ${position.y})`);

    const title = global.document.createElementNS(SVG_NS, "title");
    title.textContent = `${getPilotLabel(player)} / ${getShipLabel(player)} / ${player.currentNode || "Unknown"} / x:${player.x} y:${player.y}`;
    group.appendChild(title);

    const halo = global.document.createElementNS(SVG_NS, "circle");
    halo.setAttribute("cx", "0");
    halo.setAttribute("cy", "0");
    halo.setAttribute("r", "4.2");
    halo.setAttribute("fill", "rgba(88, 214, 255, 0.13)");
    halo.setAttribute("stroke", "rgba(116, 236, 255, 0.54)");
    halo.setAttribute("stroke-width", "0.18");
    group.appendChild(halo);

    const ship = global.document.createElementNS(SVG_NS, "polygon");
    ship.setAttribute("points", "0,-4.2 2.4,2.4 0.78,1.55 0,3.85 -0.78,1.55 -2.4,2.4");
    ship.setAttribute("fill", "rgba(123, 239, 255, 0.76)");
    ship.setAttribute("stroke", "rgba(239, 255, 255, 0.96)");
    ship.setAttribute("stroke-width", "0.25");
    ship.setAttribute("filter", "drop-shadow(0 0 2.6px rgba(80, 225, 255, 0.9))");
    group.appendChild(ship);

    const cockpit = global.document.createElementNS(SVG_NS, "circle");
    cockpit.setAttribute("cx", "0");
    cockpit.setAttribute("cy", "-0.55");
    cockpit.setAttribute("r", "0.58");
    cockpit.setAttribute("fill", "rgba(4, 18, 30, 0.82)");
    cockpit.setAttribute("stroke", "rgba(215, 255, 255, 0.8)");
    cockpit.setAttribute("stroke-width", "0.13");
    group.appendChild(cockpit);

    const engine = global.document.createElementNS(SVG_NS, "path");
    engine.setAttribute("d", "M -0.85 3.55 Q 0 5.25 0.85 3.55");
    engine.setAttribute("fill", "none");
    engine.setAttribute("stroke", "rgba(93, 246, 255, 0.9)");
    engine.setAttribute("stroke-width", "0.34");
    engine.setAttribute("stroke-linecap", "round");
    group.appendChild(engine);

    const label = global.document.createElementNS(SVG_NS, "text");
    label.setAttribute("x", labelOffset);
    label.setAttribute("y", "-2.05");
    label.setAttribute("fill", "#bff8ff");
    label.setAttribute("font-size", "1.75");
    label.setAttribute("font-weight", "800");
    label.setAttribute("paint-order", "stroke");
    label.setAttribute("stroke", "rgba(0, 5, 12, 0.96)");
    label.setAttribute("stroke-width", "0.48");
    label.setAttribute("text-anchor", labelOffset < 0 ? "end" : "start");
    label.textContent = getPilotLabel(player);
    group.appendChild(label);

    const note = global.document.createElementNS(SVG_NS, "text");
    note.setAttribute("x", labelOffset);
    note.setAttribute("y", "0.18");
    note.setAttribute("fill", "rgba(190, 248, 255, 0.82)");
    note.setAttribute("font-size", "1.12");
    note.setAttribute("font-weight", "700");
    note.setAttribute("paint-order", "stroke");
    note.setAttribute("stroke", "rgba(0, 5, 12, 0.96)");
    note.setAttribute("stroke-width", "0.32");
    note.setAttribute("text-anchor", labelOffset < 0 ? "end" : "start");
    note.textContent = getDevGhostLabel(player);
    group.appendChild(note);

    layer.appendChild(group);
  }

  function drawSectorBot(layer, bot, selectedTargetBotId = "") {
    const basePosition = getServerBotMapPosition(bot);
    const offset = getStableMapOffset(bot, 1.55);
    const position = {
      x: clampMapCoordinate(basePosition.x + offset.x),
      y: clampMapCoordinate(basePosition.y + offset.y)
    };
    const labelOffset = position.x > 82 ? -2.9 : 2.9;
    const group = global.document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", `${botMarkerClass}${selectedTargetBotId === bot.id ? " is-locked" : ""}${bot.disabled ? " is-disabled" : ""}${wasRecentlyHit(bot) ? " is-hit" : ""}`);
    group.setAttribute("data-bot-id", bot.id || "");
    group.setAttribute("pointer-events", "auto");
    group.style.cursor = "crosshair";
    group.setAttribute("transform", `translate(${position.x} ${position.y})`);
    group.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      selectStagingBot(bot);
    });

    const title = global.document.createElementNS(SVG_NS, "title");
    title.textContent = `${getBotLabel(bot)} / ${getBotModeLabel()} / ${getBotLayerSummary(bot)} / ${getBotHullSummary(bot)} / staging damage test only / no rewards / ${bot.id || "unknown"} / x:${bot.x} y:${bot.y}`;
    group.appendChild(title);

    const halo = global.document.createElementNS(SVG_NS, "circle");
    halo.setAttribute("cx", "0");
    halo.setAttribute("cy", "0");
    halo.setAttribute("r", "2.05");
    halo.setAttribute("fill", "rgba(255, 114, 60, 0.08)");
    halo.setAttribute("stroke", "rgba(255, 160, 87, 0.42)");
    halo.setAttribute("stroke-width", "0.12");
    group.appendChild(halo);

    if (selectedTargetBotId === bot.id) {
      const lockRing = global.document.createElementNS(SVG_NS, "circle");
      lockRing.setAttribute("cx", "0");
      lockRing.setAttribute("cy", "0");
      lockRing.setAttribute("r", "3.1");
      lockRing.setAttribute("fill", "none");
      lockRing.setAttribute("stroke", "rgba(255, 244, 199, 0.92)");
      lockRing.setAttribute("stroke-width", "0.18");
      lockRing.setAttribute("stroke-dasharray", "0.9 0.7");
      group.appendChild(lockRing);
    }

    const damageAmount = getRecentDamageAmount(bot);
    if (damageAmount > 0) {
      const damageText = global.document.createElementNS(SVG_NS, "text");
      damageText.setAttribute("x", "0");
      damageText.setAttribute("y", "-3.6");
      damageText.setAttribute("fill", "#fff1b2");
      damageText.setAttribute("font-size", "1.25");
      damageText.setAttribute("font-weight", "900");
      damageText.setAttribute("paint-order", "stroke");
      damageText.setAttribute("stroke", "rgba(25, 5, 0, 0.96)");
      damageText.setAttribute("stroke-width", "0.28");
      damageText.setAttribute("text-anchor", "middle");
      damageText.textContent = `-${damageAmount}`;
      group.appendChild(damageText);
    }

    const ship = global.document.createElementNS(SVG_NS, "polygon");
    ship.setAttribute("points", "0,-2.25 1.65,1.25 0.65,0.9 0,2.15 -0.65,0.9 -1.65,1.25");
    ship.setAttribute("fill", "rgba(255, 132, 69, 0.66)");
    ship.setAttribute("stroke", "rgba(255, 225, 185, 0.82)");
    ship.setAttribute("stroke-width", "0.18");
    ship.setAttribute("filter", "drop-shadow(0 0 1.8px rgba(255, 113, 55, 0.72))");
    group.appendChild(ship);

    const core = global.document.createElementNS(SVG_NS, "circle");
    core.setAttribute("cx", "0");
    core.setAttribute("cy", "0.05");
    core.setAttribute("r", "0.42");
    core.setAttribute("fill", "rgba(48, 9, 4, 0.8)");
    core.setAttribute("stroke", "rgba(255, 230, 194, 0.82)");
    core.setAttribute("stroke-width", "0.1");
    group.appendChild(core);

    const note = global.document.createElementNS(SVG_NS, "text");
    note.setAttribute("x", labelOffset);
    note.setAttribute("y", "0.45");
    note.setAttribute("fill", "rgba(255, 218, 177, 0.82)");
    note.setAttribute("font-size", "0.92");
    note.setAttribute("font-weight", "700");
    note.setAttribute("paint-order", "stroke");
    note.setAttribute("stroke", "rgba(10, 2, 0, 0.96)");
    note.setAttribute("stroke-width", "0.24");
    note.setAttribute("text-anchor", labelOffset < 0 ? "end" : "start");
    note.textContent = getCompactBotModeLabel();
    group.appendChild(note);

    layer.appendChild(group);
  }

  function renderSectorGhosts(players) {
    const svg = global.document?.getElementById("sectorSvg");
    if (!svg || !isEnabled()) {
      removeSectorLayer();
      return;
    }

    svg.querySelector(`.${layerClass}`)?.remove();

    if (!players.length) return;

    const layer = global.document.createElementNS(SVG_NS, "g");
    layer.setAttribute("class", layerClass);
    layer.setAttribute("pointer-events", "none");
    players.forEach((player) => drawSectorGhost(layer, player));
    svg.appendChild(layer);
  }

  function renderSectorBots(bots) {
    const svg = global.document?.getElementById("sectorSvg");
    if (!svg || !isEnabled()) {
      removeSectorLayer();
      return;
    }

    svg.querySelector(`.${botLayerClass}`)?.remove();

    if (!bots.length) return;

    const layer = global.document.createElementNS(SVG_NS, "g");
    layer.setAttribute("class", botLayerClass);
    layer.setAttribute("pointer-events", "auto");
    const selectedTargetBotId = getSelectedTargetBotId();
    bots.forEach((bot) => drawSectorBot(layer, bot, selectedTargetBotId));
    svg.appendChild(layer);
  }

  function getCurrentNodeName() {
    return typeof currentNode === "undefined" ? "" : currentNode;
  }

  function getStableOffset(player, index) {
    const id = String(player.sessionId || player.id || index);
    const seed = id.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
    return ((seed % 9) - 4) * 5.5;
  }

  function renderSpaceGhosts(players) {
    removeSpaceLayer();
    if (!isEnabled()) return;

    const spaceScreen = global.document?.getElementById("spaceScreen");
    if (!spaceScreen) return;

    const localPlayers = players.filter((player) => isSameCurrentNode(player));
    if (!localPlayers.length) return;

    ensureStyles();

    const layer = global.document.createElement("div");
    layer.id = spaceLayerId;
    layer.setAttribute("aria-hidden", "true");

    localPlayers.slice(0, 6).forEach((player, index) => {
      const marker = global.document.createElement("div");
      marker.className = "lupen-mp-space-ghost";
      marker.dataset.sessionId = player.sessionId || player.id || "";
      marker.style.left = `${50 + getStableOffset(player, index)}%`;
      marker.style.top = `${24 + (index % 3) * 12}%`;

      const ship = global.document.createElement("div");
      ship.className = "lupen-mp-space-ghost-ship";
      marker.appendChild(ship);

      const label = global.document.createElement("div");
      label.className = "lupen-mp-space-ghost-label";
      label.textContent = getPilotLabel(player);
      marker.appendChild(label);

      const note = global.document.createElement("div");
      note.className = "lupen-mp-space-ghost-note";
      note.textContent = getDevGhostLabel(player);
      marker.appendChild(note);

      layer.appendChild(marker);
    });

    spaceScreen.appendChild(layer);
  }

  function renderSpaceBots(bots) {
    global.document?.getElementById(spaceBotLayerId)?.remove();
    if (!isEnabled()) return;

    const spaceScreen = global.document?.getElementById("spaceScreen");
    if (!spaceScreen) return;

    const localBots = bots.filter((bot) => isSameCurrentNode(bot));
    if (!localBots.length) return;

    ensureStyles();

    const layer = global.document.createElement("div");
    layer.id = spaceBotLayerId;
    layer.setAttribute("aria-hidden", "true");

    localBots.slice(0, 6).forEach((bot, index) => {
      const marker = global.document.createElement("div");
      marker.className = "lupen-mp-space-bot";
      marker.dataset.botId = bot.id || "";
      if (getSelectedTargetBotId() === bot.id) marker.classList.add("is-locked");
      if (bot.disabled) marker.classList.add("is-disabled");
      if (wasRecentlyHit(bot)) marker.classList.add("is-hit");
      marker.title = `${getBotLabel(bot)} / ${getBotLayerSummary(bot)} / ${getBotHullSummary(bot)} / staging damage test only / no rewards`;
      marker.style.left = `${clampMapCoordinate(bot.x || 50)}%`;
      marker.style.top = `${clampMapCoordinate(bot.y || 50)}%`;
      marker.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectStagingBot(bot);
      });

      const ship = global.document.createElement("div");
      ship.className = "lupen-mp-space-bot-ship";
      marker.appendChild(ship);

      const label = global.document.createElement("div");
      label.className = "lupen-mp-space-bot-label";
      label.textContent = getBotLabel(bot);
      marker.appendChild(label);

      const note = global.document.createElement("div");
      note.className = "lupen-mp-space-bot-note";
      note.textContent = bot.disabled ? "DISABLED" : getBotModeLabel();
      marker.appendChild(note);

      const damageAmount = getRecentDamageAmount(bot);
      if (damageAmount > 0) {
        const damage = global.document.createElement("div");
        damage.className = "lupen-mp-space-bot-damage";
        damage.textContent = `-${damageAmount}`;
        marker.appendChild(damage);
      }

      layer.appendChild(marker);
    });

    spaceScreen.appendChild(layer);
  }

  function getSameNodePlayers(players) {
    return players.filter((player) => isSameCurrentNode(player));
  }

  function getSameNodeBots(bots) {
    return bots.filter((bot) => isSameCurrentNode(bot));
  }

  function getInspectedBot(bots) {
    const sameNodeBots = getSameNodeBots(bots);
    return sameNodeBots[0] || bots[0] || null;
  }

  function getShortSessionId(value) {
    return String(value || "").slice(0, 8) || "none";
  }

  function getCompactServerLabel(status) {
    const serverUrl = String(status.serverUrl || "none").replace(/^wss?:\/\//, "");
    const source = status.serverUrlSource || status.serverConfigSource || status.configSource || "unknown";
    return `${serverUrl} / ${source}`;
  }

  function formatRelativeAge(timestamp) {
    const value = Number(timestamp || 0);
    if (!value) return "none";
    const seconds = Math.max(0, Math.round((Date.now() - value) / 1000));
    return `${seconds}s ago`;
  }

  function formatCooldown(milliseconds) {
    const remaining = Math.max(0, Math.ceil(Number(milliseconds || 0)));
    if (!remaining) return "ready";
    return `${(remaining / 1000).toFixed(1)}s`;
  }

  function getLastBotEventLabel(status) {
    const event = status?.lastBotEvent;
    if (!event?.type) return "none";
    const name = event.type.replace("bot:", "");
    const id = String(event.botId || "").slice(-6) || "unknown";
    return `${name} / ${id}`;
  }

  function setDiagnosticsRow(panel, label, value) {
    const row = global.document.createElement("div");
    row.className = "lupen-mp-diagnostics-row";

    const labelNode = global.document.createElement("span");
    labelNode.textContent = label;
    row.appendChild(labelNode);

    const valueNode = global.document.createElement("em");
    valueNode.textContent = value;
    row.appendChild(valueNode);

    panel.appendChild(row);
  }

  function canShowStagingTestFire(status, selectedBot) {
    return !!status?.enabled &&
      !!status?.isConnected &&
      !!selectedBot?.id &&
      isSameCurrentNode(selectedBot);
  }

  function canSendStagingTestFire(status, selectedBot) {
    return canShowStagingTestFire(status, selectedBot) &&
      !selectedBot.disabled &&
      Math.max(0, Number(status.fireCooldownRemainingMs || 0)) <= 0;
  }

  function sendStagingTestFire(selectedBot) {
    if (!canSendStagingTestFire(getClient()?.getStatus?.(), selectedBot)) return;

    // Diagnostics-only staging damage path. This does not call local combat,
    // projectile, sound, bounty, reward, save, or targeting systems.
    getClient()?.sendSelectedStagingBotCombatIntent?.({
      targetBotId: selectedBot.id,
      currentNode: getCurrentNodeName(),
      weaponId: "stagingTestFire",
      weaponFamily: "staging-test",
      timestamp: Date.now()
    });
  }

  function addDiagnosticsActions(panel, status, selectedBot) {
    if (!canShowStagingTestFire(status, selectedBot)) return;

    const actions = global.document.createElement("div");
    actions.className = "lupen-mp-diagnostics-actions";

    const button = global.document.createElement("button");
    button.type = "button";
    button.className = "lupen-mp-test-fire-button";
    const cooldownRemainingMs = Math.max(0, Number(status.fireCooldownRemainingMs || 0));
    button.textContent = cooldownRemainingMs > 0 ? `Test Fire ${formatCooldown(cooldownRemainingMs)}` : "Test Fire";
    button.title = "Send staging-only server test damage. No real combat or rewards.";
    button.disabled = !canSendStagingTestFire(status, selectedBot);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      sendStagingTestFire(selectedBot);
    });
    actions.appendChild(button);
    panel.appendChild(actions);
  }

  function renderDiagnostics(players, bots) {
    removeDiagnosticsPanel();
    if (!isEnabled()) return;

    ensureStyles();

    const status = getClient()?.getStatus?.() || {};
    const sameNodePlayers = getSameNodePlayers(players);
    const sameNodeBots = getSameNodeBots(bots);
    const inspectedBot = getInspectedBot(bots);
    const selectedBot = getClient()?.getSelectedStagingBot?.() || null;
    const panel = global.document.createElement("div");
    panel.id = diagnosticsPanelId;
    panel.setAttribute("aria-hidden", "true");

    const title = global.document.createElement("strong");
    title.textContent = isStagingMode(status) ? "MP Staging" : "MP Dev Diagnostics";
    panel.appendChild(title);

    setDiagnosticsRow(panel, "status", status.isConnected ? "connected" : status.isConnecting ? "connecting" : "offline");
    setDiagnosticsRow(panel, "room", status.roomName || "none");
    setDiagnosticsRow(panel, "local player", getShortSessionId(status.sessionId));
    setDiagnosticsRow(panel, "server", getCompactServerLabel(status));
    setDiagnosticsRow(panel, "client", status.clientLoadSource || "not loaded");
    setDiagnosticsRow(panel, "node", getCurrentNodeName() || "unknown");
    setDiagnosticsRow(panel, "remote pilots", `${players.length} total / ${sameNodePlayers.length} same node`);
    setDiagnosticsRow(panel, isStagingMode(status) ? "staging bots" : "dev bots", `${bots.length} total / ${sameNodeBots.length} same node`);
    setDiagnosticsRow(panel, "bot update", formatRelativeAge(status.lastBotUpdateAt));
    if (isStagingMode(status)) {
      setDiagnosticsRow(panel, "bot layer", "server-owned visual");
      setDiagnosticsRow(panel, "selected bot", getBotInspectionLabel(selectedBot));
      setDiagnosticsRow(panel, "inspect bot", getBotInspectionLabel(inspectedBot));
      setDiagnosticsRow(panel, "bot node", getBotLayerSummary(inspectedBot));
      setDiagnosticsRow(panel, "bot status", getBotHullSummary(inspectedBot));
      setDiagnosticsRow(panel, "fire cooldown", formatCooldown(status.fireCooldownRemainingMs));
      setDiagnosticsRow(panel, "bot event", getLastBotEventLabel(status));
    }
    if (status.lastServerWarning) {
      setDiagnosticsRow(panel, "warning", status.lastServerWarning);
    }
    if (status.lastCombatResponse) {
      const combatLabel = status.lastCombatResponse.ok
        ? `${status.lastCombatResponse.reason || "resolved"} / ${status.lastCombatResponse.damage || 0} dmg`
        : status.lastCombatResponse.reason === "staging_fire_cooldown"
          ? `cooldown / ${formatCooldown(status.lastCombatResponse.cooldownRemainingMs)}`
          : status.lastCombatResponse.reason || "received";
      setDiagnosticsRow(panel, "combat intent", combatLabel);
      if (status.lastCombatResponse.ok) {
        setDiagnosticsRow(panel, "last damage", `${status.lastCombatResponse.damage || 0} / rewards no`);
        setDiagnosticsRow(panel, "after hit", `${status.lastCombatResponse.disabled ? "disabled / " : ""}S ${Math.round(Number(status.lastCombatResponse.shield || 0))} / H ${Math.round(Number(status.lastCombatResponse.hull || 0))}`);
      }
    }
    if (status.lastTargetResponse) {
      setDiagnosticsRow(panel, "lock-on", status.lastTargetResponse.reason || "received");
    }
    if (status.clientLoadError || status.lastError) {
      setDiagnosticsRow(panel, "error", status.clientLoadError || status.lastError);
    }

    const note = global.document.createElement("span");
    note.className = "lupen-mp-diagnostics-note";
    note.textContent = isStagingMode(status)
      ? "Staging damage is server-owned test damage only. No rewards, XP, loot, bounties, saves, or progression."
      : "Dev bot markers are visual-only; real combat bots are still local.";
    panel.appendChild(note);

    addDiagnosticsActions(panel, status, selectedBot);

    global.document.body.appendChild(panel);
  }

  function render() {
    renderQueued = false;

    if (!isEnabled()) {
      removeLayers();
      return;
    }

    const players = getClient()?.getPlayers?.({ includeSelf: false }) || [];
    const bots = getClient()?.getBots?.() || [];
    renderSectorGhosts(players);
    renderSectorBots(bots);
    renderSpaceGhosts(players);
    renderSpaceBots(bots);
    renderDiagnostics(players, bots);
  }

  function scheduleRender() {
    if (renderQueued) return;
    renderQueued = true;
    global.requestAnimationFrame(render);
  }

  function setup() {
    const client = getClient();
    if (!client?.enabled || unsubscribe) return;

    const subscription = client.onServerState(() => scheduleRender());
    unsubscribe = subscription.unsubscribe;
    if (!diagnosticsTimer) diagnosticsTimer = global.setInterval(scheduleRender, 1000);
    scheduleRender();
  }

  global.LupenMultiplayerOverlay = Object.freeze({
    render,
    scheduleRender,
    setup
  });

  if (global.document?.readyState === "loading") {
    global.document.addEventListener("DOMContentLoaded", setup, { once: true });
  } else {
    setup();
  }
})(window);
