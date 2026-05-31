/* Dev-only multiplayer ghost overlay.
   Draws read-only Colyseus pilot snapshots on the sector map when ?mp=1 is
   active. These markers are visual only and never affect gameplay state. */

(function registerMultiplayerOverlay(global) {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const layerClass = "svg-mp-ghost-layer";
  const markerClass = "svg-mp-ghost";
  let unsubscribe = null;
  let renderQueued = false;

  function getClient() {
    return global.LupenMultiplayerClient || null;
  }

  function isEnabled() {
    const status = getClient()?.getStatus?.();
    return !!status?.enabled;
  }

  function removeLayer() {
    const svg = global.document?.getElementById("sectorSvg");
    svg?.querySelector(`.${layerClass}`)?.remove();
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

  function drawGhost(layer, player) {
    const position = getPlayerPosition(player);
    const group = global.document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", markerClass);
    group.setAttribute("data-session-id", player.sessionId || player.id || "");
    group.setAttribute("pointer-events", "none");

    const title = global.document.createElementNS(SVG_NS, "title");
    title.textContent = `${getPilotLabel(player)} / ${player.currentNode || "Unknown"} / x:${player.x} y:${player.y}`;
    group.appendChild(title);

    const halo = global.document.createElementNS(SVG_NS, "circle");
    halo.setAttribute("cx", position.x);
    halo.setAttribute("cy", position.y);
    halo.setAttribute("r", "2.25");
    halo.setAttribute("fill", "rgba(88, 214, 255, 0.16)");
    halo.setAttribute("stroke", "rgba(116, 236, 255, 0.7)");
    halo.setAttribute("stroke-width", "0.22");
    group.appendChild(halo);

    const dot = global.document.createElementNS(SVG_NS, "circle");
    dot.setAttribute("cx", position.x);
    dot.setAttribute("cy", position.y);
    dot.setAttribute("r", "0.82");
    dot.setAttribute("fill", "#7df3ff");
    dot.setAttribute("stroke", "rgba(255,255,255,0.9)");
    dot.setAttribute("stroke-width", "0.14");
    group.appendChild(dot);

    const label = global.document.createElementNS(SVG_NS, "text");
    label.setAttribute("x", position.x + 2.8);
    label.setAttribute("y", position.y - 1.6);
    label.setAttribute("fill", "#bff8ff");
    label.setAttribute("font-size", "1.55");
    label.setAttribute("font-weight", "800");
    label.setAttribute("paint-order", "stroke");
    label.setAttribute("stroke", "rgba(0, 5, 12, 0.96)");
    label.setAttribute("stroke-width", "0.42");
    label.textContent = getPilotLabel(player);
    group.appendChild(label);

    const note = global.document.createElementNS(SVG_NS, "text");
    note.setAttribute("x", position.x + 2.8);
    note.setAttribute("y", position.y + 0.35);
    note.setAttribute("fill", "rgba(190, 248, 255, 0.82)");
    note.setAttribute("font-size", "1.05");
    note.setAttribute("font-weight", "700");
    note.setAttribute("paint-order", "stroke");
    note.setAttribute("stroke", "rgba(0, 5, 12, 0.96)");
    note.setAttribute("stroke-width", "0.32");
    note.textContent = "DEV GHOST";
    group.appendChild(note);

    layer.appendChild(group);
  }

  function render() {
    renderQueued = false;

    const svg = global.document?.getElementById("sectorSvg");
    if (!svg || !isEnabled()) {
      removeLayer();
      return;
    }

    svg.querySelector(`.${layerClass}`)?.remove();

    const players = getClient()?.getPlayers?.({ includeSelf: false }) || [];
    if (!players.length) return;

    const layer = global.document.createElementNS(SVG_NS, "g");
    layer.setAttribute("class", layerClass);
    layer.setAttribute("pointer-events", "none");
    players.forEach((player) => drawGhost(layer, player));
    svg.appendChild(layer);
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
