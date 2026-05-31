/* Dev-only multiplayer ghost overlay.
   Draws read-only Colyseus pilot snapshots on the sector map when ?mp=1 is
   active. These markers are visual only and never affect gameplay state. */

(function registerMultiplayerOverlay(global) {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const layerClass = "svg-mp-ghost-layer";
  const markerClass = "svg-mp-ghost";
  const spaceLayerId = "lupenMultiplayerSpaceGhostLayer";
  const styleId = "lupenMultiplayerOverlayStyles";
  let unsubscribe = null;
  let renderQueued = false;

  function getClient() {
    return global.LupenMultiplayerClient || null;
  }

  function isEnabled() {
    const status = getClient()?.getStatus?.();
    return !!status?.enabled;
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

      .lupen-mp-space-ghost {
        position: absolute;
        display: grid;
        justify-items: center;
        gap: 3px;
        transform: translate(-50%, -50%);
        opacity: 0.78;
        pointer-events: none;
        filter: drop-shadow(0 0 10px rgba(93, 232, 255, 0.48));
      }

      .lupen-mp-space-ghost-ship {
        position: relative;
        width: 34px;
        height: 46px;
        clip-path: polygon(50% 0%, 78% 62%, 61% 55%, 50% 100%, 39% 55%, 22% 62%);
        background: linear-gradient(180deg, rgba(187, 252, 255, 0.95), rgba(54, 186, 255, 0.5));
        border: 1px solid rgba(210, 255, 255, 0.75);
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
    `;
    global.document.head.appendChild(style);
  }

  function removeSectorLayer() {
    const svg = global.document?.getElementById("sectorSvg");
    svg?.querySelector(`.${layerClass}`)?.remove();
  }

  function removeSpaceLayer() {
    global.document?.getElementById(spaceLayerId)?.remove();
  }

  function removeLayers() {
    removeSectorLayer();
    removeSpaceLayer();
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

  function getPlayerPosition(player) {
    const node = getSectorNodeByName(player.currentNode);
    if (node) {
      return {
        x: clampMapCoordinate(node.x + 2.4),
        y: clampMapCoordinate(node.y - 2.4)
      };
    }

    return {
      x: clampMapCoordinate(player.x),
      y: clampMapCoordinate(player.y)
    };
  }

  function getPilotLabel(player) {
    const id = String(player.sessionId || player.id || "");
    return `Pilot ${id.slice(0, 6) || "DEV"}`;
  }

  function getLabelOffset(position) {
    return position.x > 82 ? -13.4 : 4.1;
  }

  function drawSectorGhost(layer, player) {
    const position = getPlayerPosition(player);
    const labelOffset = getLabelOffset(position);
    const group = global.document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", markerClass);
    group.setAttribute("data-session-id", player.sessionId || player.id || "");
    group.setAttribute("pointer-events", "none");
    group.setAttribute("transform", `translate(${position.x} ${position.y})`);

    const title = global.document.createElementNS(SVG_NS, "title");
    title.textContent = `${getPilotLabel(player)} / ${player.currentNode || "Unknown"} / x:${player.x} y:${player.y}`;
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
    note.textContent = "DEV GHOST";
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

    const currentNodeName = getCurrentNodeName();
    const localPlayers = players.filter((player) => normalizeNodeKey(player.currentNode) === normalizeNodeKey(currentNodeName));
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
      note.textContent = "Dev Ghost";
      marker.appendChild(note);

      layer.appendChild(marker);
    });

    spaceScreen.appendChild(layer);
  }

  function render() {
    renderQueued = false;

    if (!isEnabled()) {
      removeLayers();
      return;
    }

    const players = getClient()?.getPlayers?.({ includeSelf: false }) || [];
    renderSectorGhosts(players);
    renderSpaceGhosts(players);
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
