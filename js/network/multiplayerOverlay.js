/* Dev/staging multiplayer ghost overlay.
   Draws read-only Colyseus pilot snapshots on the sector map when multiplayer
   staging/dev mode is active. These markers are visual only and never affect
   gameplay state. */

(function registerMultiplayerOverlay(global) {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const XLINK_NS = "http://www.w3.org/1999/xlink";
  const layerClass = "svg-mp-ghost-layer";
  const markerClass = "svg-mp-ghost";
  const botLayerClass = "svg-mp-bot-layer";
  const botMarkerClass = "svg-mp-bot";
  const spaceLayerId = "lupenMultiplayerSpaceGhostLayer";
  const spaceResourceLayerId = "lupenMultiplayerSpaceResourceLayer";
  const spaceBotLayerId = "lupenMultiplayerSpaceBotLayer";
  const spaceShotLayerId = "lupenMultiplayerSpaceShotLayer";
  const spaceSelectionLayerId = "lupenMultiplayerSpaceSelectionLayer";
  const statusChipId = "lupenMultiplayerStatusChip";
  const stagingFlowHintId = "lupenMultiplayerStagingFlowHint";
  const diagnosticsPanelId = "lupenMultiplayerDiagnostics";
  const stagingCombatPanelId = "lupenMultiplayerStagingCombatPanel";
  const stagingBountyPanelId = "lupenMultiplayerStagingBountyPanel";
  const stagingTradePanelId = "lupenMultiplayerStagingTradePanel";
  const styleId = "lupenMultiplayerOverlayStyles";
  let unsubscribe = null;
  let renderQueued = false;
  let diagnosticsTimer = null;
  let stagingTradeOfferId = "";
  let stagingTradeQuantity = 5;
  let stagingTradeOffersRequested = false;
  let stagingBountyRequested = false;
  let stagingFlowHintDismissed = false;
  let lastRewardPanelXpRefreshKey = "";
  let selectedResourceId = "";
  const shipImageLoadStatus = new Map();
  const botImageLoadStatus = new Map();
  const remoteGhostSnapshots = new Map();
  const remoteGhostDepartures = new Map();
  const remoteGhostArrivals = new Map();
  const handledPresenceEventKeys = new Set();
  const shipImageById = {
    falcon: "assets/ships/azure-striker/azure-striker-medium.webp",
    bison: "assets/ships/buu-hauler/buu-hauler-medium.webp",
    monolith: "assets/ships/majin-vindicator/majin-vindicator-medium.webp",
    lupenOrigin: "assets/ships/lupen-origin.png",
    lupenHauler: "assets/ships/lupen-hauler.png",
    lupenStriker: "assets/ships/lupen-striker.png",
    hermesCourier: "assets/ships/hermes-courier.png",
    athenaSentinel: "assets/ships/athena-sentinel.png",
    aresVindicator: "assets/ships/ares-vindicator.png",
    hephaestusTrader: "assets/ships/champa-carrier/champa-carrier-medium.webp",
    poseidonAggressor: "assets/ships/silver-instinct/silver-instinct-medium.webp",
    zeusExplorer: "assets/ships/nightshade-hawk/nightshade-hawk-medium.webp",
    cobraSeeker: "assets/ships/cobra-seeker.png",
    cobraMoth: "assets/ships/cobra-moth.png"
  };
  const shipImageByName = {
    "falcon": shipImageById.falcon,
    "f-1 falcon": shipImageById.falcon,
    "azure striker": shipImageById.falcon,
    "bison": shipImageById.bison,
    "b-1 bison": shipImageById.bison,
    "buu hauler": shipImageById.bison,
    "monolith": shipImageById.monolith,
    "majin vindicator": shipImageById.monolith,
    "lf 1 origin": shipImageById.lupenOrigin,
    "lf-1 origin": shipImageById.lupenOrigin,
    "hauler": shipImageById.lupenHauler,
    "striker": shipImageById.lupenStriker,
    "hermes courier": shipImageById.hermesCourier,
    "athena sentinel": shipImageById.athenaSentinel,
    "ares vindicator": shipImageById.aresVindicator,
    "hephaestus trader": shipImageById.hephaestusTrader,
    "champa carrier": shipImageById.hephaestusTrader,
    "poseidon aggressor": shipImageById.poseidonAggressor,
    "silver instinct": shipImageById.poseidonAggressor,
    "zeus explorer": shipImageById.zeusExplorer,
    "nightshade hawk": shipImageById.zeusExplorer,
    "cobra seeker": shipImageById.cobraSeeker,
    "cobra moth": shipImageById.cobraMoth
  };
  const botImageByType = {
    "erebus drone": "assets/bots/erebus-attacker.png",
    "erebus attacker": "assets/bots/erebus-attacker.png",
    "erebus hunter": "assets/bots/erebus-hunter.png",
    "erebus destroyer": "assets/bots/erebus-destroyer.png",
    "erebus behemoth": "assets/bots/erebus-behemoth.png"
  };
  const stagingResourceValueHints = {
    iron: [18, 30],
    copper: [32, 50],
    cobalt: [24, 42],
    crystalshards: [95, 145]
  };
  const stagingResourceAsteroidImages = {
    iron: "assets/asteroids/asteroid-iron.png",
    copper: "assets/asteroids/asteroid-copper.png",
    cobalt: "assets/asteroids/asteroid-cobalt.png",
    crystalshards: "assets/asteroids/asteroid-crystal.png"
  };

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

  function isMpDebugEnabled() {
    try {
      return new URLSearchParams(global.location?.search || "").get("debug") === "mp";
    } catch (_err) {
      return false;
    }
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

      #${spaceResourceLayerId} {
        position: absolute;
        inset: 84px 18px 170px;
        z-index: 7;
        pointer-events: none;
        overflow: hidden;
      }

      #${spaceShotLayerId} {
        position: absolute;
        inset: 84px 18px 170px;
        z-index: 10;
        pointer-events: none;
        overflow: hidden;
      }

      #${spaceSelectionLayerId} {
        position: absolute;
        inset: 84px 18px 170px;
        z-index: 11;
        pointer-events: none;
        overflow: hidden;
      }

      #${spaceShotLayerId} .lupen-mp-shot-beam {
        position: absolute;
        height: 5px;
        transform-origin: 0 50%;
        border-radius: 999px;
        background: linear-gradient(90deg, rgba(112, 252, 255, 0), rgba(129, 250, 255, 0.98) 12%, rgba(255, 255, 255, 1) 42%, rgba(255, 231, 142, 0.96) 66%, rgba(255, 126, 65, 0));
        box-shadow: 0 0 16px rgba(110, 229, 255, 0.92), 0 0 31px rgba(45, 232, 255, 0.5), 0 0 22px rgba(255, 126, 65, 0.4);
        mix-blend-mode: screen;
        animation: lupen-mp-shot-beam 0.46s ease-out forwards;
      }

      #${spaceShotLayerId} .lupen-mp-shot-beam.is-local {
        height: 6px;
      }

      #${spaceShotLayerId} .lupen-mp-shot-beam.is-remote {
        background: linear-gradient(90deg, rgba(89, 212, 255, 0), rgba(111, 224, 255, 0.9) 14%, rgba(235, 255, 255, 0.96) 45%, rgba(98, 255, 199, 0.82) 72%, rgba(98, 255, 199, 0));
        box-shadow: 0 0 13px rgba(80, 221, 255, 0.72), 0 0 24px rgba(68, 255, 202, 0.34);
      }

      #${spaceShotLayerId} .lupen-mp-shot-beam.is-wing {
        height: 3px;
        opacity: 0.86;
      }

      #${spaceShotLayerId} .lupen-mp-shot-beam.is-spark {
        height: 2px;
        opacity: 0.7;
      }

      #${spaceShotLayerId} .lupen-mp-shot-muzzle {
        position: absolute;
        width: 34px;
        height: 34px;
        transform: translate(-50%, -50%);
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255, 255, 255, 0.92), rgba(96, 238, 255, 0.72) 28%, transparent 68%);
        box-shadow: 0 0 18px rgba(100, 236, 255, 0.78), 0 0 34px rgba(255, 160, 80, 0.35);
        mix-blend-mode: screen;
        animation: lupen-mp-shot-muzzle 0.34s ease-out forwards;
      }

      #${spaceShotLayerId} .lupen-mp-shot-muzzle.is-remote {
        background: radial-gradient(circle, rgba(255, 255, 255, 0.88), rgba(95, 255, 205, 0.55) 28%, transparent 68%);
        box-shadow: 0 0 15px rgba(86, 228, 255, 0.56), 0 0 27px rgba(86, 255, 201, 0.32);
      }

      #${spaceShotLayerId} .lupen-mp-shot-attacker-label {
        position: absolute;
        transform: translate(-50%, 12px);
        max-width: 96px;
        padding: 2px 6px;
        border: 1px solid rgba(105, 232, 255, 0.5);
        border-radius: 4px;
        color: #bff7ff;
        background: rgba(5, 15, 25, 0.74);
        font-size: 9px;
        line-height: 1.2;
        text-align: center;
        text-transform: uppercase;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        text-shadow: 0 0 7px rgba(69, 220, 255, 0.9);
        opacity: 0;
        animation: lupen-mp-shot-label 0.72s ease-out forwards;
      }

      #${spaceShotLayerId} .lupen-mp-shot-hit {
        position: absolute;
        width: 44px;
        height: 44px;
        transform: translate(-50%, -50%);
        border: 2px solid rgba(255, 229, 156, 0.88);
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255, 233, 157, 0.8), rgba(255, 111, 54, 0.26) 48%, rgba(255, 111, 54, 0) 72%);
        box-shadow: 0 0 18px rgba(255, 159, 73, 0.86), 0 0 34px rgba(255, 76, 54, 0.35);
        mix-blend-mode: screen;
        animation: lupen-mp-shot-hit 0.7s ease-out forwards;
      }

      #${stagingCombatPanelId} {
        position: absolute;
        right: 14px;
        bottom: 128px;
        z-index: 35;
        width: min(318px, calc(100vw - 32px));
        max-height: min(430px, calc(100vh - 210px));
        overflow: auto;
        border: 1px solid rgba(255, 193, 104, 0.46);
        border-radius: 6px;
        background: linear-gradient(180deg, rgba(22, 15, 10, 0.9), rgba(8, 12, 20, 0.88));
        box-shadow: 0 0 18px rgba(255, 122, 48, 0.18), inset 0 0 20px rgba(255, 174, 86, 0.06);
        color: #ffe5c0;
        font-family: Arial, sans-serif;
        pointer-events: auto;
        text-transform: uppercase;
      }

      #${stagingCombatPanelId} .lupen-mp-staging-combat-inner {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 6px 10px;
        align-items: center;
        padding: 8px 9px;
      }

      #${stagingCombatPanelId} .lupen-mp-staging-combat-kicker {
        display: block;
        color: rgba(255, 206, 146, 0.68);
        font: 900 9px/1 Arial, sans-serif;
        letter-spacing: 0.08em;
      }

      #${stagingCombatPanelId} .lupen-mp-staging-combat-kicker.is-destroyed {
        color: rgba(255, 124, 94, 0.9);
      }

      #${stagingCombatPanelId} strong {
        display: block;
        margin-top: 2px;
        color: #fff1cf;
        font: 900 14px/1.1 Arial, sans-serif;
        letter-spacing: 0.02em;
      }

      #${stagingCombatPanelId} .lupen-mp-staging-state {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        width: fit-content;
        margin-top: 5px;
        padding: 3px 7px;
        border: 1px solid rgba(255, 210, 140, 0.35);
        border-radius: 999px;
        background: rgba(255, 183, 81, 0.11);
        color: #ffe9bb;
        font: 900 9px/1 Arial, sans-serif;
      }

      #${stagingCombatPanelId} .lupen-mp-staging-state::before {
        content: "";
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #ffe58a;
        box-shadow: 0 0 8px rgba(255, 220, 120, 0.7);
      }

      #${stagingCombatPanelId} .lupen-mp-staging-state.is-destroyed {
        border-color: rgba(255, 116, 91, 0.42);
        background: rgba(255, 84, 62, 0.12);
        color: #ffc3ad;
      }

      #${stagingCombatPanelId} .lupen-mp-staging-state.is-destroyed::before {
        background: #ff735f;
        box-shadow: 0 0 8px rgba(255, 92, 72, 0.74);
      }

      #${stagingCombatPanelId} small {
        display: block;
        margin-top: 3px;
        color: rgba(255, 226, 188, 0.78);
        font: 800 9px/1.2 Arial, sans-serif;
      }

      #${stagingCombatPanelId} .lupen-mp-staging-message {
        grid-column: 1 / -1;
        padding: 6px 7px;
        border: 1px solid rgba(255, 209, 142, 0.24);
        border-radius: 5px;
        background: rgba(255, 170, 77, 0.08);
        color: #ffe4b8;
        font: 850 10px/1.25 Arial, sans-serif;
      }

      #${stagingCombatPanelId} .lupen-mp-staging-message.is-hit {
        border-color: rgba(255, 231, 147, 0.38);
        background: rgba(255, 211, 98, 0.11);
      }

      #${stagingCombatPanelId} .lupen-mp-staging-message.is-destroyed {
        border-color: rgba(255, 109, 83, 0.42);
        background: rgba(255, 77, 54, 0.12);
        color: #ffd0bd;
      }

      #${stagingCombatPanelId} .lupen-mp-staging-message.is-blocked {
        border-color: rgba(255, 161, 93, 0.3);
        color: rgba(255, 218, 183, 0.82);
      }

      #${stagingCombatPanelId} .lupen-mp-staging-reward {
        grid-column: 1 / -1;
        display: grid;
        gap: 4px;
        padding: 6px;
        max-height: 112px;
        overflow: auto;
        border: 1px solid rgba(127, 223, 255, 0.22);
        border-radius: 5px;
        background: rgba(33, 90, 114, 0.1);
      }

      #${stagingCombatPanelId} .lupen-mp-staging-reward b {
        color: #dffcff;
        font: 900 10px/1.15 Arial, sans-serif;
      }

      #${stagingCombatPanelId} .lupen-mp-staging-reward span {
        color: rgba(221, 250, 255, 0.78);
        font: 800 9px/1.2 Arial, sans-serif;
      }

      #${stagingCombatPanelId} .lupen-mp-staging-claim {
        grid-column: 1 / -1;
        color: rgba(255, 224, 184, 0.84);
        font: 850 9px/1.25 Arial, sans-serif;
      }

      #${stagingCombatPanelId} .lupen-mp-staging-bars {
        grid-column: 1 / -1;
        display: grid;
        gap: 4px;
      }

      #${stagingCombatPanelId} .lupen-mp-staging-bar {
        display: grid;
        grid-template-columns: 46px 1fr 52px;
        gap: 6px;
        align-items: center;
        color: rgba(255, 232, 203, 0.8);
        font: 900 9px/1 Arial, sans-serif;
      }

      #${stagingCombatPanelId} .lupen-mp-staging-bar-track {
        height: 5px;
        overflow: hidden;
        border: 1px solid rgba(255, 210, 150, 0.22);
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.36);
      }

      #${stagingCombatPanelId} .lupen-mp-staging-bar-fill {
        display: block;
        height: 100%;
        border-radius: inherit;
      }

      #${stagingCombatPanelId} .lupen-mp-staging-shield {
        background: linear-gradient(90deg, rgba(93, 226, 255, 0.52), rgba(155, 245, 255, 0.88));
      }

      #${stagingCombatPanelId} .lupen-mp-staging-hull {
        background: linear-gradient(90deg, rgba(255, 95, 68, 0.54), rgba(255, 190, 90, 0.9));
      }

      #${stagingCombatPanelId} .lupen-mp-staging-fire {
        min-width: 112px;
        min-height: 42px;
        padding: 7px 10px;
        border: 1px solid rgba(255, 219, 150, 0.7);
        border-radius: 5px;
        background: linear-gradient(180deg, rgba(180, 69, 22, 0.96), rgba(95, 29, 10, 0.96));
        color: #fff5d8;
        box-shadow: 0 0 14px rgba(255, 119, 45, 0.28);
        cursor: pointer;
        font: 900 11px/1.05 Arial, sans-serif;
        text-transform: uppercase;
      }

      #${stagingCombatPanelId} .lupen-mp-staging-fire:hover {
        background: linear-gradient(180deg, rgba(210, 85, 28, 0.98), rgba(120, 39, 13, 0.98));
      }

      #${stagingCombatPanelId} .lupen-mp-staging-fire:disabled {
        opacity: 0.48;
        cursor: default;
        box-shadow: none;
      }

      #${stagingBountyPanelId} {
        position: fixed;
        left: 14px;
        bottom: 236px;
        z-index: 75;
        width: min(318px, calc(100vw - 28px));
        border: 1px solid rgba(111, 221, 255, 0.34);
        border-radius: 6px;
        background: linear-gradient(180deg, rgba(9, 21, 31, 0.9), rgba(7, 10, 17, 0.88));
        box-shadow: 0 0 18px rgba(66, 195, 255, 0.14), inset 0 0 20px rgba(99, 211, 255, 0.05);
        color: #d9f7ff;
        font-family: Arial, sans-serif;
        pointer-events: auto;
        text-transform: uppercase;
      }

      #${stagingBountyPanelId} .lupen-mp-bounty-inner {
        display: grid;
        gap: 7px;
        padding: 9px 10px;
      }

      #${stagingBountyPanelId} .lupen-mp-bounty-kicker {
        color: rgba(142, 225, 255, 0.72);
        font: 900 9px/1 Arial, sans-serif;
        letter-spacing: 0.08em;
      }

      #${stagingBountyPanelId} strong {
        color: #effcff;
        font: 900 14px/1.1 Arial, sans-serif;
      }

      #${stagingBountyPanelId} span {
        color: rgba(221, 247, 255, 0.82);
        font: 800 10px/1.3 Arial, sans-serif;
      }

      #${stagingBountyPanelId} .lupen-mp-bounty-progress {
        height: 7px;
        overflow: hidden;
        border: 1px solid rgba(127, 220, 255, 0.28);
        border-radius: 999px;
        background: rgba(10, 21, 32, 0.88);
      }

      #${stagingBountyPanelId} .lupen-mp-bounty-progress i {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #58d7ff, #f2e58d);
        box-shadow: 0 0 10px rgba(94, 213, 255, 0.52);
      }

      #${stagingBountyPanelId} button {
        justify-self: start;
        border: 1px solid rgba(139, 231, 255, 0.48);
        border-radius: 4px;
        background: rgba(83, 198, 255, 0.14);
        color: #effcff;
        cursor: pointer;
        font: 900 10px/1 Arial, sans-serif;
        padding: 7px 10px;
        text-transform: uppercase;
      }

      #${stagingBountyPanelId} button:disabled {
        cursor: not-allowed;
        opacity: 0.5;
      }

      #${stagingTradePanelId} {
        position: fixed;
        left: 14px;
        bottom: 92px;
        z-index: 76;
        width: min(318px, calc(100vw - 28px));
        border: 1px solid rgba(127, 223, 255, 0.28);
        border-radius: 6px;
        background: linear-gradient(180deg, rgba(6, 18, 27, 0.88), rgba(5, 11, 18, 0.84));
        box-shadow: 0 0 16px rgba(0, 150, 220, 0.13), inset 0 0 18px rgba(127, 223, 255, 0.04);
        color: #d9fbff;
        font-family: Arial, sans-serif;
        pointer-events: auto;
      }

      #${stagingTradePanelId} .lupen-mp-trade-inner {
        display: grid;
        gap: 7px;
        padding: 8px 9px;
      }

      #${stagingTradePanelId} strong {
        color: #8ff4ff;
        font: 900 10px/1 Arial, sans-serif;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }

      #${stagingTradePanelId} select,
      #${stagingTradePanelId} input {
        min-height: 28px;
        border: 1px solid rgba(127, 223, 255, 0.28);
        border-radius: 4px;
        background: rgba(0, 8, 14, 0.82);
        color: #e8fdff;
        font: 800 10px/1 Arial, sans-serif;
      }

      #${stagingTradePanelId} .lupen-mp-trade-controls {
        display: grid;
        grid-template-columns: 1fr 56px auto;
        gap: 6px;
        align-items: center;
      }

      #${stagingTradePanelId} button {
        min-height: 28px;
        padding: 5px 8px;
        border: 1px solid rgba(127, 223, 255, 0.42);
        border-radius: 4px;
        background: rgba(23, 90, 118, 0.64);
        color: #e8fdff;
        cursor: pointer;
        font: 900 10px/1 Arial, sans-serif;
        text-transform: uppercase;
      }

      #${stagingTradePanelId} button:disabled {
        opacity: 0.48;
        cursor: default;
      }

      #${stagingTradePanelId} .lupen-mp-trade-route,
      #${stagingTradePanelId} .lupen-mp-trade-result,
      #${stagingTradePanelId} .lupen-mp-trade-note {
        color: rgba(229, 252, 255, 0.82);
        font: 800 10px/1.25 Arial, sans-serif;
      }

      #${stagingTradePanelId} .lupen-mp-trade-result {
        display: grid;
        gap: 3px;
        padding: 6px;
        border: 1px solid rgba(127, 223, 255, 0.18);
        border-radius: 5px;
        background: rgba(127, 223, 255, 0.06);
      }

      #${stagingTradePanelId} .lupen-mp-trade-note {
        color: rgba(255, 229, 190, 0.82);
      }

      .lupen-mp-space-ghost {
        position: absolute;
        display: grid;
        justify-items: center;
        gap: 3px;
        transform: translate(-50%, -50%);
        opacity: 0.9;
        pointer-events: auto;
        cursor: pointer;
        filter: drop-shadow(0 0 13px rgba(93, 232, 255, 0.62));
      }

      .lupen-mp-space-ghost.is-selected {
        opacity: 1;
        filter: drop-shadow(0 0 18px rgba(89, 238, 255, 0.88));
      }

      .lupen-mp-space-ghost.is-arriving {
        animation: lupen-mp-ghost-arrival 640ms ease-out both;
      }

      .lupen-mp-space-ghost.is-departing {
        pointer-events: none;
        animation: lupen-mp-ghost-departure 520ms ease-in forwards;
      }

      .lupen-mp-space-ghost.is-selected::after,
      .lupen-mp-space-bot.is-locked::before {
        content: "";
        position: absolute;
        inset: -8px -12px 12px;
        pointer-events: none;
        background:
          linear-gradient(currentColor, currentColor) left top / 20px 3px no-repeat,
          linear-gradient(currentColor, currentColor) left top / 3px 20px no-repeat,
          linear-gradient(currentColor, currentColor) right top / 20px 3px no-repeat,
          linear-gradient(currentColor, currentColor) right top / 3px 20px no-repeat,
          linear-gradient(currentColor, currentColor) left bottom / 20px 3px no-repeat,
          linear-gradient(currentColor, currentColor) left bottom / 3px 20px no-repeat,
          linear-gradient(currentColor, currentColor) right bottom / 20px 3px no-repeat,
          linear-gradient(currentColor, currentColor) right bottom / 3px 20px no-repeat;
        filter: drop-shadow(0 0 10px currentColor);
      }

      .lupen-mp-space-ghost.is-selected::after {
        color: rgba(111, 245, 255, 0.92);
      }

      .lupen-mp-space-bot.is-locked::before {
        color: rgba(255, 180, 78, 0.95);
      }

      .lupen-mp-space-ghost-ship {
        position: relative;
        width: 38px;
        height: 50px;
        clip-path: polygon(50% 0%, 78% 62%, 61% 55%, 50% 100%, 39% 55%, 22% 62%);
        background: linear-gradient(180deg, rgba(187, 252, 255, 0.95), rgba(54, 186, 255, 0.5));
        border: 1px solid rgba(230, 255, 255, 0.86);
      }

      .lupen-mp-space-ghost-ship.has-image {
        width: 68px;
        height: 68px;
        clip-path: none;
        background: radial-gradient(circle, rgba(108, 235, 255, 0.2), rgba(8, 32, 54, 0.05) 64%);
        border: 0;
      }

      .lupen-mp-space-ghost-ship.has-image img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        opacity: 0.9;
        filter: drop-shadow(0 0 12px rgba(91, 224, 255, 0.86));
      }

      .lupen-mp-space-ghost-ship.has-image::before,
      .lupen-mp-space-ghost-ship.has-image::after {
        display: none;
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
        padding: 2px 7px;
        border: 1px solid rgba(127, 223, 255, 0.42);
        border-radius: 4px;
        background: rgba(2, 10, 18, 0.72);
        color: #dffcff;
        font: 700 10px/1.15 Arial, sans-serif;
        text-transform: none;
        white-space: nowrap;
      }

      .lupen-mp-space-ghost-note {
        color: rgba(194, 251, 255, 0.78);
        font: 700 8px/1 Arial, sans-serif;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        text-shadow: 0 1px 3px rgba(0, 4, 10, 0.9);
      }

      @keyframes lupen-mp-ghost-arrival {
        0% {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.92);
          filter: drop-shadow(0 0 2px rgba(93, 232, 255, 0.1));
        }
        34% {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1.06);
          filter: drop-shadow(0 0 22px rgba(93, 232, 255, 0.92));
        }
        100% {
          opacity: 0.9;
          transform: translate(-50%, -50%) scale(1);
          filter: drop-shadow(0 0 13px rgba(93, 232, 255, 0.62));
        }
      }

      @keyframes lupen-mp-ghost-departure {
        0% {
          opacity: 0.9;
          transform: translate(-50%, -50%) scale(1);
        }
        100% {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.86);
          filter: drop-shadow(0 0 2px rgba(93, 232, 255, 0.12));
        }
      }

      .lupen-mp-space-bot {
        position: absolute;
        display: grid;
        justify-items: center;
        gap: 3px;
        transform: translate(-50%, -50%);
        opacity: 0.86;
        pointer-events: auto;
        cursor: crosshair;
        filter: drop-shadow(0 0 8px rgba(255, 128, 62, 0.42));
      }

      .lupen-mp-space-bot-hitbox {
        position: absolute;
        inset: -14px -18px 12px;
        z-index: 0;
        pointer-events: auto;
      }

      .lupen-mp-space-bot::after {
        content: "";
        position: absolute;
        inset: -8px -11px 18px;
        opacity: 0;
        pointer-events: none;
        background:
          linear-gradient(#7fe7ff, #7fe7ff) left top / 18px 2px no-repeat,
          linear-gradient(#7fe7ff, #7fe7ff) left top / 2px 18px no-repeat,
          linear-gradient(#7fe7ff, #7fe7ff) right top / 18px 2px no-repeat,
          linear-gradient(#7fe7ff, #7fe7ff) right top / 2px 18px no-repeat,
          linear-gradient(#7fe7ff, #7fe7ff) left bottom / 18px 2px no-repeat,
          linear-gradient(#7fe7ff, #7fe7ff) left bottom / 2px 18px no-repeat,
          linear-gradient(#7fe7ff, #7fe7ff) right bottom / 18px 2px no-repeat,
          linear-gradient(#7fe7ff, #7fe7ff) right bottom / 2px 18px no-repeat;
        filter: drop-shadow(0 0 8px rgba(91, 213, 255, 0.56));
      }

      .lupen-mp-space-bot.is-locked {
        opacity: 0.95;
        filter: drop-shadow(0 0 16px rgba(255, 198, 102, 0.78));
      }

      .lupen-mp-space-bot.is-locked::after {
        opacity: 1;
      }

      .lupen-mp-space-bot.is-disabled {
        opacity: 0.48;
        filter: drop-shadow(0 0 8px rgba(170, 170, 170, 0.4));
        pointer-events: none;
      }

      .lupen-mp-space-bot.is-hit {
        animation: lupen-mp-staging-hit 0.62s ease-out;
      }

      .lupen-mp-space-bot.is-engaged .lupen-mp-space-bot-ship {
        transform: rotate(-5deg) translateY(-1px);
        filter: drop-shadow(0 0 12px rgba(255, 185, 95, 0.52));
      }

      .lupen-mp-space-bot.is-coop-engaged .lupen-mp-space-bot-ship {
        filter: drop-shadow(0 0 12px rgba(98, 236, 255, 0.56));
      }

      .lupen-mp-space-bot.is-coop-engaged .lupen-mp-space-bot-ship::after {
        content: "";
        position: absolute;
        left: 50%;
        top: -8px;
        width: 22px;
        height: 2px;
        transform: translateX(-50%);
        border-radius: 999px;
        background: linear-gradient(90deg, transparent, rgba(121, 240, 255, 0.92), transparent);
        box-shadow: 0 0 8px rgba(89, 224, 255, 0.76);
      }

      .lupen-mp-space-bot.is-bounty-target .lupen-mp-space-bot-ship::before {
        content: "";
        position: absolute;
        inset: 8px 5px 8px;
        border: 1px solid rgba(255, 211, 95, 0.7);
        border-top-color: transparent;
        border-radius: 50%;
        opacity: 0.9;
        pointer-events: none;
        filter: drop-shadow(0 0 7px rgba(255, 194, 68, 0.56));
      }

      .${botMarkerClass}.is-hit {
        animation: lupen-mp-sector-bot-hit 0.62s ease-out;
      }

      .lupen-mp-space-bot-ship {
        position: relative;
        z-index: 1;
        width: 76px;
        height: 76px;
        display: grid;
        place-items: center;
        pointer-events: none;
      }

      .lupen-mp-space-bot-ship::after {
        content: none;
      }

      .lupen-mp-space-bot-ship img {
        width: 100%;
        height: 100%;
        object-fit: contain;
        pointer-events: none;
        filter:
          drop-shadow(0 0 14px rgba(255, 110, 90, 0.42))
          drop-shadow(0 0 24px rgba(80, 210, 235, 0.28));
      }

      .lupen-mp-space-bot.is-locked .lupen-mp-space-bot-ship img {
        filter:
          drop-shadow(0 0 5px rgba(127, 223, 255, 0.55))
          drop-shadow(0 0 10px rgba(255, 110, 90, 0.2));
      }

      .lupen-mp-space-bot-ship-fallback {
        position: absolute;
        left: 50%;
        top: 50%;
        width: 34px;
        height: 44px;
        transform: translate(-50%, -50%);
        clip-path: polygon(50% 0%, 88% 48%, 68% 48%, 72% 88%, 50% 72%, 28% 88%, 32% 48%, 12% 48%);
        background: linear-gradient(180deg, rgba(255, 184, 92, 0.76), rgba(255, 74, 58, 0.4));
        border: 1px solid rgba(255, 224, 180, 0.58);
        pointer-events: none;
      }

      .lupen-mp-space-resource {
        appearance: none;
        position: absolute;
        display: grid;
        justify-items: center;
        gap: 2px;
        width: 46px;
        min-height: 48px;
        padding: 0;
        border: 0;
        background: transparent;
        color: inherit;
        transform: translate(-50%, -50%);
        opacity: 0.84;
        pointer-events: auto;
        cursor: crosshair;
        filter: drop-shadow(0 0 9px rgba(127, 223, 255, 0.26));
        box-shadow: none;
      }

      .lupen-mp-space-resource:hover {
        opacity: 1;
        filter: drop-shadow(0 0 13px rgba(127, 223, 255, 0.48));
      }

      .lupen-mp-space-resource.is-selected {
        opacity: 1;
        filter: drop-shadow(0 0 16px rgba(245, 230, 140, 0.58));
      }

      .lupen-mp-space-resource.is-selected::after {
        content: "";
        position: absolute;
        inset: -5px -6px 8px;
        border: 1px solid rgba(245, 230, 140, 0.72);
        border-radius: 8px;
        pointer-events: none;
        box-shadow: 0 0 12px rgba(245, 230, 140, 0.26);
      }

      .lupen-mp-space-resource.is-hit {
        animation: lupen-mp-resource-hit 0.62s ease-out;
      }

      .lupen-mp-space-resource.is-depleted {
        opacity: 0.32;
        cursor: default;
        pointer-events: none;
      }

      .lupen-mp-resource-rock {
        width: 38px;
        height: 34px;
        display: grid;
        place-items: center;
        border-radius: 45% 55% 48% 52%;
        background:
          radial-gradient(circle at 35% 28%, rgba(242, 255, 255, 0.56), rgba(242, 255, 255, 0) 18%),
          radial-gradient(circle at 58% 54%, var(--resource-glow), rgba(0, 0, 0, 0) 34%),
          linear-gradient(145deg, rgba(43, 55, 66, 0.98), rgba(10, 16, 22, 0.94));
        border: 1px solid rgba(201, 240, 255, 0.3);
        box-shadow: inset -5px -6px 8px rgba(0, 0, 0, 0.42), 0 0 10px var(--resource-glow);
      }

      .lupen-mp-resource-rock img {
        width: 28px;
        height: 28px;
        object-fit: contain;
        opacity: 0.82;
        pointer-events: none;
      }

      .lupen-mp-resource-bars {
        width: 42px;
        height: 4px;
        border: 1px solid rgba(137, 230, 255, 0.34);
        background: rgba(0, 0, 0, 0.48);
        overflow: hidden;
      }

      .lupen-mp-resource-bars span {
        display: block;
        height: 100%;
        background: linear-gradient(90deg, #21b4ff, #f5e68c);
        box-shadow: 0 0 8px rgba(102, 225, 255, 0.5);
      }

      @keyframes lupen-mp-resource-hit {
        0% { transform: translate(-50%, -50%) scale(1); filter: drop-shadow(0 0 8px rgba(127, 223, 255, 0.28)); }
        38% { transform: translate(-50%, -50%) scale(1.08); filter: drop-shadow(0 0 20px rgba(255, 231, 142, 0.74)); }
        100% { transform: translate(-50%, -50%) scale(1); filter: drop-shadow(0 0 9px rgba(127, 223, 255, 0.26)); }
      }

      .lupen-target-card {
        position: absolute;
        transform: translate(-50%, 0);
        min-width: 112px;
        max-width: 154px;
        display: grid;
        justify-items: center;
        gap: 3px;
        padding: 5px 7px 6px;
        border: 1px solid rgba(110, 230, 255, 0.64);
        border-radius: 4px;
        background: linear-gradient(180deg, rgba(4, 14, 28, 0.78), rgba(1, 6, 14, 0.62));
        box-shadow: 0 0 16px rgba(0, 190, 255, 0.14);
        color: #e9fdff;
        text-align: center;
        text-transform: uppercase;
        font-family: Arial, sans-serif;
      }

      .lupen-target-card::before {
        content: "";
        position: absolute;
        top: -8px;
        left: 50%;
        transform: translateX(-50%);
        width: 42px;
        height: 1px;
        background: var(--target-accent);
        box-shadow: 0 0 8px var(--target-glow);
      }

      .lupen-target-card.hostile {
        --target-accent: #ff9a35;
        --target-glow: rgba(255, 138, 45, 0.76);
        border-color: rgba(255, 166, 74, 0.72);
        box-shadow: 0 0 24px rgba(255, 124, 46, 0.28);
      }

      .lupen-target-card.player {
        --target-accent: #ffc76b;
        --target-glow: rgba(255, 190, 92, 0.72);
        border-color: rgba(255, 197, 96, 0.64);
        box-shadow: 0 0 18px rgba(255, 168, 58, 0.18);
      }

      .lupen-target-card.resource {
        --target-accent: #f5e68c;
        --target-glow: rgba(245, 230, 140, 0.58);
        border-color: rgba(245, 230, 140, 0.58);
        box-shadow: 0 0 18px rgba(245, 206, 116, 0.18);
      }

      .lupen-target-card.resource .lupen-target-bar-fill.shield {
        background: linear-gradient(90deg, #21b4ff, #f5e68c);
      }

      .lupen-target-card.locked {
        animation: lupen-target-pulse 1.3s ease-in-out infinite;
      }

      .lupen-target-card.hit-confirmed {
        box-shadow: 0 0 20px var(--target-glow), 0 0 38px rgba(255, 255, 255, 0.16);
      }

      .lupen-target-card strong {
        max-width: 138px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font: 900 12px/1 Arial, sans-serif;
        letter-spacing: 0.02em;
        text-shadow: 0 2px 7px rgba(0, 0, 0, 0.85);
      }

      .lupen-target-card small {
        max-width: 136px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: rgba(157, 235, 255, 0.88);
        font: 800 8px/1.15 Arial, sans-serif;
        letter-spacing: 0.04em;
      }

      .lupen-target-card .lupen-target-status {
        border: 1px solid rgba(88, 219, 255, 0.42);
        border-radius: 3px;
        padding: 2px 5px;
        color: #7df4ff;
        background: rgba(0, 33, 52, 0.5);
        font: 900 7px/1 Arial, sans-serif;
        letter-spacing: 0.06em;
      }

      .lupen-target-card .lupen-target-status.is-warning {
        border-color: rgba(245, 210, 112, 0.52);
        color: #ffe996;
        background: rgba(72, 50, 6, 0.5);
      }

      .lupen-target-card .lupen-target-status.pvp-arming {
        border-color: rgba(255, 210, 112, 0.58);
        color: #ffe29b;
        background: rgba(70, 44, 4, 0.58);
      }

      .lupen-target-card .lupen-target-readiness {
        color: rgba(255, 231, 177, 0.88);
      }

      .lupen-target-bars {
        width: 88px;
        display: grid;
        gap: 2px;
      }

      .lupen-target-bar {
        display: block;
      }

      .lupen-target-bar-track {
        height: 4px;
        border: 1px solid rgba(255, 232, 180, 0.3);
        background: rgba(0, 0, 0, 0.52);
      }

      .lupen-target-bar-fill {
        display: block;
        height: 100%;
      }

      .lupen-target-bar-fill.hull {
        background: linear-gradient(90deg, #ff533f, #ffbc3d);
      }

      .lupen-target-bar-fill.shield {
        background: linear-gradient(90deg, #19aaff, #7df5ff);
      }

      .lupen-target-bar-fill.is-low {
        background: linear-gradient(90deg, #ff3028, #ff8d2d);
        box-shadow: 0 0 7px rgba(255, 82, 48, 0.72);
      }

      .lupen-target-bar-fill.is-empty {
        background: linear-gradient(90deg, #4b1512, #9b241c);
        box-shadow: none;
      }

      @keyframes lupen-target-pulse {
        0%, 100% { filter: drop-shadow(0 0 8px var(--target-glow)); }
        50% { filter: drop-shadow(0 0 18px var(--target-glow)); }
      }

      .lupen-mp-space-bot-bars {
        position: relative;
        z-index: 1;
        width: 74px;
        display: grid;
        gap: 2px;
        margin-top: -5px;
        pointer-events: none;
      }

      .lupen-mp-space-bot-bar {
        height: 5px;
        overflow: hidden;
        border: 1px solid rgba(255, 221, 170, 0.24);
        border-radius: 999px;
        background: rgba(0, 0, 0, 0.42);
      }

      .lupen-mp-space-bot-bar-fill {
        display: block;
        height: 100%;
        border-radius: inherit;
      }

      .lupen-mp-space-bot-bar-fill.shield {
        background: linear-gradient(90deg, rgba(76, 205, 255, 0.5), rgba(159, 246, 255, 0.9));
      }

      .lupen-mp-space-bot-bar-fill.hull {
        background: linear-gradient(90deg, rgba(255, 86, 65, 0.56), rgba(255, 186, 74, 0.88));
      }

      #${statusChipId} {
        position: fixed;
        top: 12px;
        right: 12px;
        z-index: 78;
        display: flex;
        align-items: center;
        gap: 7px;
        max-width: min(260px, calc(100vw - 24px));
        padding: 6px 9px;
        border: 1px solid rgba(127, 223, 255, 0.3);
        border-radius: 999px;
        background: rgba(3, 10, 18, 0.72);
        color: #d8fbff;
        box-shadow: 0 0 14px rgba(0, 150, 220, 0.16);
        font: 800 10px/1 Arial, sans-serif;
        pointer-events: none;
        text-transform: uppercase;
      }

      #${statusChipId} i {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #ff8f64;
        box-shadow: 0 0 8px rgba(255, 117, 74, 0.72);
      }

      #${statusChipId}.is-connected i {
        background: #75f2ff;
        box-shadow: 0 0 8px rgba(117, 242, 255, 0.72);
      }

      #${statusChipId} em {
        max-width: 86px;
        overflow: hidden;
        color: rgba(216, 251, 255, 0.72);
        font-style: normal;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      #${stagingFlowHintId} {
        position: fixed;
        left: 14px;
        bottom: 14px;
        z-index: 77;
        max-width: min(360px, calc(100vw - 28px));
        padding: 8px 10px;
        border: 1px solid rgba(127, 223, 255, 0.26);
        border-radius: 6px;
        background: rgba(3, 10, 18, 0.7);
        color: #d9fbff;
        box-shadow: 0 0 14px rgba(0, 150, 220, 0.14);
        font: 800 10px/1.3 Arial, sans-serif;
        pointer-events: auto;
        text-transform: uppercase;
      }

      #${stagingFlowHintId} strong {
        display: block;
        margin-bottom: 3px;
        color: #80efff;
        font: 900 10px/1 Arial, sans-serif;
        letter-spacing: 0.06em;
      }

      #${stagingFlowHintId} span {
        display: block;
        color: rgba(229, 252, 255, 0.82);
        text-transform: none;
      }

      #${stagingFlowHintId} .lupen-mp-flow-note {
        margin-top: 4px;
        color: rgba(255, 225, 172, 0.82);
      }

      #${stagingFlowHintId} button {
        position: absolute;
        top: 5px;
        right: 6px;
        width: 20px;
        height: 20px;
        border: 1px solid rgba(127, 223, 255, 0.24);
        border-radius: 4px;
        background: rgba(3, 10, 18, 0.46);
        color: rgba(229, 252, 255, 0.76);
        cursor: pointer;
        font: 900 12px/1 Arial, sans-serif;
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

      @keyframes lupen-mp-shot-beam {
        0% {
          opacity: 0;
          transform: rotate(var(--shot-angle)) scaleX(0.14);
          filter: brightness(1.45);
        }
        24% {
          opacity: 1;
          transform: rotate(var(--shot-angle)) scaleX(1.05);
          filter: brightness(1.35);
        }
        100% {
          opacity: 0;
          transform: rotate(var(--shot-angle)) scaleX(0.5);
          filter: brightness(0.78);
        }
      }

      @keyframes lupen-mp-shot-muzzle {
        0% { opacity: 0; transform: translate(-50%, -50%) scale(0.34); }
        26% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        100% { opacity: 0; transform: translate(-50%, -50%) scale(1.48); }
      }

      @keyframes lupen-mp-shot-hit {
        0% {
          opacity: 0;
          transform: translate(-50%, -50%) scale(0.45);
        }
        35% {
          opacity: 1;
          transform: translate(-50%, -50%) scale(1.05);
        }
        100% {
          opacity: 0;
          transform: translate(-50%, -50%) scale(1.45);
        }
      }

      @keyframes lupen-mp-shot-label {
        0% { opacity: 0; transform: translate(-50%, 9px); }
        18% { opacity: 0.88; transform: translate(-50%, 12px); }
        100% { opacity: 0; transform: translate(-50%, 15px); }
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
    global.document?.getElementById(spaceResourceLayerId)?.remove();
    global.document?.getElementById(spaceBotLayerId)?.remove();
    global.document?.getElementById(spaceShotLayerId)?.remove();
  }

  function removeDiagnosticsPanel() {
    global.document?.getElementById(diagnosticsPanelId)?.remove();
  }

  function removeStatusChip() {
    global.document?.getElementById(statusChipId)?.remove();
  }

  function removeStagingFlowHint() {
    global.document?.getElementById(stagingFlowHintId)?.remove();
  }

  function isStagingFlowHintDismissed() {
    if (stagingFlowHintDismissed) return true;
    try {
      return global.localStorage?.getItem("lupenStagingFlowHintDismissed") === "1";
    } catch (_error) {
      return false;
    }
  }

  function dismissStagingFlowHint() {
    stagingFlowHintDismissed = true;
    try {
      global.localStorage?.setItem("lupenStagingFlowHintDismissed", "1");
    } catch (_error) {
      // The staging guide is cosmetic; storage failures should never affect gameplay.
    }
    removeStagingFlowHint();
  }

  function removeStagingCombatPanel() {
    global.document?.getElementById(stagingCombatPanelId)?.remove();
  }

  function removeStagingBountyPanel() {
    global.document?.getElementById(stagingBountyPanelId)?.remove();
  }

  function removeStagingTradePanel() {
    global.document?.getElementById(stagingTradePanelId)?.remove();
  }

  function removeLayers() {
    removeSectorLayer();
    removeSpaceLayer();
    global.document?.getElementById(spaceSelectionLayerId)?.remove();
    removeDiagnosticsPanel();
    removeStatusChip();
    removeStagingFlowHint();
    removeStagingCombatPanel();
    removeStagingBountyPanel();
    removeStagingTradePanel();
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

  function normalizeShipLookupKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getKnownShipImageSrc(player) {
    const shipId = String(player?.currentShipId || "").trim();
    if (shipId && shipImageById[shipId]) return shipImageById[shipId];

    const lowerShipId = shipId.toLowerCase();
    const idMatch = Object.keys(shipImageById).find((key) => key.toLowerCase() === lowerShipId);
    if (idMatch) return shipImageById[idMatch];

    const nameKey = normalizeShipLookupKey(player?.shipName || player?.ship || "");
    return shipImageByName[nameKey] || "";
  }

  function getSafeShipImageSrc(player) {
    const src = String(player?.shipImage || player?.shipImageSrc || player?.shipImagePath || getKnownShipImageSrc(player)).trim().replace(/\\/g, "/");
    if (!src) return "";
    if (!/^assets\/(?:ships|player-ships|hub\/ships)\/[a-z0-9-/.]+\.(?:png|webp|jpg|jpeg)$/i.test(src)) return "";
    if (src.includes("..") || src.includes("//")) return "";
    return src;
  }

  function trackShipImageLoad(src) {
    if (!src || shipImageLoadStatus.has(src) || typeof global.Image !== "function") return;
    shipImageLoadStatus.set(src, "loading");
    const image = new global.Image();
    image.onload = () => {
      shipImageLoadStatus.set(src, "loaded");
      scheduleRender();
    };
    image.onerror = () => {
      shipImageLoadStatus.set(src, "failed");
      scheduleRender();
    };
    image.src = src;
  }

  function getShipImageRenderSrc(player) {
    const src = getSafeShipImageSrc(player);
    if (!src) return "";
    trackShipImageLoad(src);
    return shipImageLoadStatus.get(src) === "failed" ? "" : src;
  }

  function getShipImageLoadLabel(player) {
    const src = getSafeShipImageSrc(player);
    if (!src) return "missing";
    trackShipImageLoad(src);
    return shipImageLoadStatus.get(src) || "loading";
  }

  function compactPath(value) {
    const path = String(value || "").trim();
    if (!path) return "missing";
    return path.length > 42 ? `...${path.slice(-39)}` : path;
  }

  function getShipImageStatus(players) {
    const withImages = players.filter((player) => getSafeShipImageSrc(player)).length;
    const failed = players.filter((player) => getShipImageLoadLabel(player) === "failed").length;
    return `${withImages}/${players.length} remote ship images${failed ? ` / ${failed} failed` : ""}`;
  }

  function getDevGhostLabel(player) {
    const shipLabel = getShipLabel(player);
    if (isStagingMode() && !isMpDebugEnabled()) return shipLabel === "Unknown ship" ? "" : shipLabel;
    const modeLabel = isStagingMode() ? "STAGING PILOT" : "DEV GHOST";
    return shipLabel === "Unknown ship" ? modeLabel : `${shipLabel} / ${modeLabel}`;
  }

  function isFreshRemotePilot(player, status = getClient()?.getStatus?.()) {
    if (!player || player.isSelf) return false;
    const playerSessionId = String(player.sessionId || player.id || "");
    if (!playerSessionId || playerSessionId === String(status?.sessionId || "")) return false;
    if (!String(player.currentNode || "").trim()) return false;
    if (!isStagingMode(status)) return true;
    const lastSeenAt = Number(player.lastSeenAt || player.joinedAt || 0);
    if (!lastSeenAt) return false;
    return Date.now() - lastSeenAt < 30000;
  }

  function isPilotInSpace(player) {
    return String(player?.presenceStatus || player?.status || "space").toLowerCase() !== "docked";
  }

  function isPvpProtectedNode(nodeName = getCurrentNodeName()) {
    if (typeof global.isProtectedNode === "function") return global.isProtectedNode(nodeName);
    const node = typeof sectorNodes !== "undefined" ? sectorNodes[nodeName] : null;
    return node?.type === "planet" || ["Asteron Prime", "Virella", "Nyxara"].includes(String(nodeName || ""));
  }

  function getRemotePlayerPvpLabel(player, status = getClient()?.getStatus?.()) {
    if (!player) return "PVP LOCKED";
    if (!isPilotInSpace(player)) return "DOCKED";
    if (!isSameCurrentNode(player)) return "OUT OF RANGE";
    if (isPvpProtectedNode()) return "PROTECTED";
    const localGuild = String(status?.guildId || "").trim();
    const targetGuild = String(player.guildId || "").trim();
    if (localGuild && targetGuild && localGuild === targetGuild) return "ALLY";
    return "PVP ARMING";
  }

  function getRemotePilotKey(player = {}) {
    return String(player.sessionId || player.id || "");
  }

  function getPresenceEventKey(event = {}) {
    return [
      event.type || "presence",
      event.sessionId || "",
      event.previousNode || "",
      event.currentNode || "",
      event.presenceStatus || "",
      event.receivedAt || ""
    ].join("|");
  }

  function processSpacePresenceEffects(players = []) {
    const client = getClient();
    const events = client?.getPresenceEvents?.() || [];
    const currentNodeName = getCurrentNodeName();
    const now = Date.now();

    Array.from(remoteGhostDepartures.entries()).forEach(([id, entry]) => {
      if (!entry || Number(entry.expiresAt || 0) <= now) remoteGhostDepartures.delete(id);
    });
    Array.from(remoteGhostArrivals.entries()).forEach(([id, expiresAt]) => {
      if (Number(expiresAt || 0) <= now) remoteGhostArrivals.delete(id);
    });

    events.forEach((event) => {
      const eventKey = getPresenceEventKey(event);
      if (handledPresenceEventKeys.has(eventKey)) return;
      handledPresenceEventKeys.add(eventKey);
      while (handledPresenceEventKeys.size > 120) {
        handledPresenceEventKeys.delete(handledPresenceEventKeys.values().next().value);
      }

      const sessionId = String(event.sessionId || "");
      if (!sessionId || sessionId === String(client?.getStatus?.()?.sessionId || "")) return;
      const enteredCurrentNode = normalizeNodeKey(event.currentNode) === normalizeNodeKey(currentNodeName) && event.presenceStatus !== "docked";
      const leftCurrentNode = normalizeNodeKey(event.previousNode) === normalizeNodeKey(currentNodeName) &&
        (normalizeNodeKey(event.currentNode) !== normalizeNodeKey(currentNodeName) || event.presenceStatus === "docked");

      if (enteredCurrentNode) {
        remoteGhostArrivals.set(sessionId, now + 900);
        if (typeof global.addActivityLog === "function") {
          const label = String(event.displayName || "Pilot").slice(0, 28);
          global.addActivityLog(`${label} entered ${currentNodeName}.`);
        }
        return;
      }

      if (leftCurrentNode) {
        const snapshot = remoteGhostSnapshots.get(sessionId);
        if (snapshot) {
          remoteGhostDepartures.set(sessionId, {
            ...snapshot,
            departing: true,
            expiresAt: now + 560
          });
        }
      }
    });

    players.forEach((player) => {
      const id = getRemotePilotKey(player);
      if (id) remoteGhostSnapshots.set(id, { ...player });
    });
  }

  function getPlayerIdentityKey(player = {}) {
    const trustedId = String(player.trustedPlayerId || player.playerId || player.supabaseUserId || "").trim().toLowerCase();
    if (trustedId) return `account:${trustedId}`;
    const displayName = String(player.displayName || "").trim().toLowerCase();
    return displayName ? `display:${displayName}` : String(player.sessionId || player.id || "").trim().toLowerCase();
  }

  function shouldUsePlayerCandidate(current, candidate) {
    if (!current) return true;
    if (candidate?.isSelf) return true;
    if (current?.isSelf && !candidate?.isSelf) return false;
    const currentSeenAt = Number(current.lastSeenAt || current.joinedAt || 0);
    const candidateSeenAt = Number(candidate.lastSeenAt || candidate.joinedAt || 0);
    if (candidateSeenAt !== currentSeenAt) return candidateSeenAt > currentSeenAt;
    return String(candidate.sessionId || candidate.id || "") > String(current.sessionId || current.id || "");
  }

  function dedupePlayers(players = []) {
    const byIdentity = new Map();
    players.forEach((player) => {
      const key = getPlayerIdentityKey(player);
      if (!key) return;
      if (shouldUsePlayerCandidate(byIdentity.get(key), player)) {
        byIdentity.set(key, player);
      }
    });
    return Array.from(byIdentity.values());
  }

  function getBotLabel(bot) {
    return String(bot.name || bot.type || "DEV BOT").trim().slice(0, 18) || "DEV BOT";
  }

  function getStagingBotImage(bot) {
    const explicit = String(bot?.image || bot?.imageSrc || bot?.imagePath || "").trim().replace(/\\/g, "/");
    if (explicit && /^assets\/bots\/[a-z0-9-]+\.png$/i.test(explicit) && !explicit.includes("..") && !explicit.includes("//")) {
      return explicit;
    }

    const rawType = String(
      bot?.type ||
      bot?.botType ||
      bot?.kind ||
      bot?.name ||
      ""
    ).toLowerCase();

    if (rawType.includes("behemoth")) return "assets/bots/erebus-behemoth.png";
    if (rawType.includes("destroyer")) return "assets/bots/erebus-destroyer.png";
    if (rawType.includes("attacker")) return "assets/bots/erebus-attacker.png";
    if (rawType.includes("hunter")) return "assets/bots/erebus-hunter.png";

    const typeKey = normalizeShipLookupKey(rawType);
    return botImageByType[typeKey] || "assets/bots/erebus-attacker.png";
  }

  function trackBotImageLoad(src) {
    if (!src || botImageLoadStatus.has(src) || typeof global.Image !== "function") return;
    botImageLoadStatus.set(src, "loading");
    const image = new global.Image();
    image.onload = () => {
      botImageLoadStatus.set(src, "loaded");
      scheduleRender();
    };
    image.onerror = () => {
      botImageLoadStatus.set(src, "failed");
      scheduleRender();
    };
    image.src = src;
  }

  function getBotImageRenderSrc(bot) {
    const src = getStagingBotImage(bot);
    if (!src) return "";
    trackBotImageLoad(src);
    return botImageLoadStatus.get(src) === "failed" ? "" : src;
  }

  function getBotImageLoadLabel(bot) {
    const src = getStagingBotImage(bot);
    if (!src) return "missing";
    trackBotImageLoad(src);
    return botImageLoadStatus.get(src) || "loading";
  }

  function isBotFallbackActive(bot) {
    return getBotImageLoadLabel(bot) === "failed";
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
    return isStagingMode() ? "HOSTILE BOT" : "DEV BOT";
  }

  function getSelectedTargetBotId() {
    return getClient()?.getStatus?.()?.selectedTargetBotId || "";
  }

  function getSelectedRemotePlayerId() {
    const target = typeof global.getSelectedRemotePlayerTarget === "function"
      ? global.getSelectedRemotePlayerTarget()
      : null;
    return String(target?.sessionId || target?.id || "");
  }

  function getSelectedResourceId() {
    return String(selectedResourceId || "");
  }

  function getSelectedResource(resources = []) {
    const id = getSelectedResourceId();
    if (!id) return null;
    return resources.find((resource) => String(resource.id || "") === id && isSameCurrentNode(resource) && !resource.depleted) || null;
  }

  function isSameCurrentNode(entity) {
    return normalizeNodeKey(entity?.currentNode) === normalizeNodeKey(getCurrentNodeName());
  }

  function getResourceHealthSummary(resource) {
    if (!resource) return "none";
    const hp = `${Math.round(Number(resource.hp || 0))}/${Math.round(Number(resource.hpMax || 0))}`;
    return `${resource.depleted ? "DEPLETED / " : ""}${resource.resourceName || "Resource"} HP ${hp}`;
  }

  function getResourceEventAge(status = getClient()?.getStatus?.()) {
    return Date.now() - Number(status?.lastStagingResourceEvent?.receivedAt || status?.lastStagingResourceEvent?.timestamp || 0);
  }

  function wasRecentlyEngagedResource(resource, status = getClient()?.getStatus?.()) {
    const event = status?.lastStagingResourceEvent;
    if (!resource?.id || !event?.resourceId || event.resourceId !== resource.id) return false;
    return getResourceEventAge(status) < 1100;
  }

  function getResourceAccent(resourceName = "") {
    const key = String(resourceName || "").toLowerCase();
    if (key.includes("copper")) return "rgba(255, 153, 83, 0.5)";
    if (key.includes("cobalt")) return "rgba(95, 152, 255, 0.52)";
    if (key.includes("crystal")) return "rgba(184, 116, 255, 0.54)";
    if (key.includes("titanium")) return "rgba(223, 245, 255, 0.5)";
    return "rgba(158, 224, 255, 0.46)";
  }

  function getResourceKey(resourceName = "") {
    return String(resourceName || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  function getResourceImage(resource) {
    const stagingImage = stagingResourceAsteroidImages[getResourceKey(resource?.resourceName || resource?.name)];
    if (stagingImage) return stagingImage;
    if (typeof global.getAsteroidImage === "function") {
      const asteroidImage = global.getAsteroidImage(resource?.resourceName || resource?.name || "Iron");
      if (asteroidImage) return asteroidImage;
    }
    if (typeof global.getCommodityImage === "function") {
      return global.getCommodityImage(resource?.resourceName || resource?.name || "Iron");
    }
    return "";
  }

  function getResourceValueHint(resourceName = "") {
    const range = stagingResourceValueHints[getResourceKey(resourceName)];
    if (!range) return "";
    return range[0] === range[1]
      ? `Estimated sale CR ${formatTradeNumber(range[0])}/unit`
      : `Estimated sale CR ${formatTradeNumber(range[0])}-${formatTradeNumber(range[1])}/unit`;
  }

  function getCargoHoldSummary(resource = null) {
    const used = typeof global.cargoUsed === "function" ? Math.max(0, Math.round(Number(global.cargoUsed() || 0))) : null;
    const stats = typeof global.getShipStats === "function" ? global.getShipStats() || {} : {};
    const capacity = Number.isFinite(Number(stats.cargo)) ? Math.max(0, Math.round(Number(stats.cargo))) : null;
    const free = used !== null && capacity !== null ? Math.max(0, capacity - used) : null;
    const expectedYield = Number.isFinite(Number(resource?.yieldAmount)) ? Math.max(0, Math.round(Number(resource.yieldAmount))) : 0;
    const full = free !== null && free <= 0;
    const limited = !full && free !== null && expectedYield > 0 && free < expectedYield;

    return {
      known: used !== null && capacity !== null,
      used,
      capacity,
      free,
      full,
      limited,
      label: used !== null && capacity !== null
        ? `Cargo ${formatTradeNumber(used)}/${formatTradeNumber(capacity)}`
        : "Cargo sync pending",
      warning: full
        ? "Hold full"
        : limited
          ? `${formatTradeNumber(free)} free`
          : ""
    };
  }

  function wasRecentlyHit(bot, status = getClient()?.getStatus?.()) {
    const response = status?.lastCombatResponse;
    if (!bot?.id || !response?.ok || response.targetBotId !== bot.id) return false;
    return Date.now() - Number(response.receivedAt || 0) < 1200;
  }

  function isRecentlyEngagedBot(bot, status = getClient()?.getStatus?.()) {
    if (!bot?.id) return false;
    const now = Date.now();
    const shot = status?.lastShotEvent;
    const returnFire = status?.lastStagingReturnFire;
    if (shot?.targetBotId === bot.id && now - Number(shot.receivedAt || shot.timestamp || 0) < 2400) return true;
    if (returnFire?.attackerBotId === bot.id && now - Number(returnFire.receivedAt || 0) < 2800) return true;
    return false;
  }

  function getRemoteBotEngagerCount(bot, players = []) {
    if (!bot?.id) return 0;
    return players.filter((player) => {
      if (!player || player.isSelf) return false;
      if (!isSameCurrentNode(player)) return false;
      return String(player.selectedTargetBotId || "") === String(bot.id);
    }).length;
  }

  function isBountyTargetBot(bot, status = getClient()?.getStatus?.()) {
    if (!bot || bot.disabled) return false;
    const bounty = getActiveStagingBounty(status);
    if (!bounty?.accepted || bounty.claimed || bounty.completed || bounty.claimAvailable) return false;
    const targetType = normalizeNodeKey(bounty.targetType || "erebus");
    const botFaction = normalizeNodeKey(bot.faction || bot.type || bot.name || "");
    return targetType.includes("erebus") && botFaction.includes("erebus");
  }

  function getShotEventAge(status = getClient()?.getStatus?.()) {
    return Date.now() - Number(status?.lastShotEvent?.receivedAt || status?.lastShotEvent?.timestamp || 0);
  }

  const localShotFeedbackKeys = new Set();

  function getShotFeedbackKey(event = {}) {
    return [
      event.attackerSessionId || "",
      event.targetBotId || "",
      event.timestamp || event.receivedAt || "",
      event.damage || ""
    ].join(":");
  }

  function playLocalStagingShotFeedback(status, targetBot) {
    const event = status?.lastShotEvent;
    if (!event?.targetBotId || event.targetBotId !== targetBot?.id) return;
    if (event.attackerSessionId !== status?.sessionId) return;
    const key = getShotFeedbackKey(event);
    if (!key || localShotFeedbackKeys.has(key)) return;
    localShotFeedbackKeys.add(key);
    if (localShotFeedbackKeys.size > 24) {
      localShotFeedbackKeys.delete(localShotFeedbackKeys.values().next().value);
    }

    if (typeof global.pulseLaserBurstToTarget === "function") {
      global.pulseLaserBurstToTarget(targetBot);
    }
    if (typeof global.playPlayerLaserPulse === "function") {
      global.playPlayerLaserPulse();
    }
    if (event.disabled && typeof global.playEnemyShipDestroyedSound === "function") {
      global.setTimeout(global.playEnemyShipDestroyedSound, 140);
    } else if (typeof global.playWeaponHitMarkerSound === "function") {
      global.setTimeout(global.playWeaponHitMarkerSound, 130);
    }
  }

  function getSpacePercentPosition(entity, fallback = { x: 50, y: 50 }) {
    return {
      x: clampMapCoordinate(entity?.x ?? fallback.x),
      y: clampMapCoordinate(entity?.y ?? fallback.y)
    };
  }

  function selectStagingBot(bot) {
    if (!bot?.id) return;
    if (!isSameCurrentNode(bot)) return;
    if (bot.disabled && !isMpDebugEnabled()) return;
    selectedResourceId = "";
    const client = getClient();
    const status = client?.getStatus?.();
    if (!status?.enabled || !status?.isConnected) return;
    client.selectStagingBot?.(bot.id, { currentNode: getCurrentNodeName() });
    if (typeof global.selectStagingBotTarget === "function") {
      global.selectStagingBotTarget(bot.id);
    }
  }

  function selectRemotePlayer(player) {
    const playerId = String(player?.sessionId || player?.id || "");
    if (!playerId || !isSameCurrentNode(player)) return;
    selectedResourceId = "";
    const blockReason = typeof global.getRemotePlayerTargetBlockReason === "function"
      ? global.getRemotePlayerTargetBlockReason(player)
      : (isPvpProtectedNode() ? "PvP disabled in protected zones." : "");
    if (blockReason) {
      if (typeof global.selectRemotePlayerTarget === "function") {
        global.selectRemotePlayerTarget(playerId);
      } else if (typeof global.addHudToast === "function") {
        global.addHudToast(blockReason);
      }
      scheduleRender();
      return;
    }
    if (typeof global.selectRemotePlayerTarget === "function") {
      global.selectRemotePlayerTarget(playerId);
      scheduleRender();
    }
  }

  function selectStagingResource(resource) {
    if (!resource?.id || !isSameCurrentNode(resource) || resource.depleted) return;
    selectedResourceId = String(resource.id);
    if (typeof global.selectStagingResourceTarget === "function") {
      global.selectStagingResourceTarget(resource.id);
    }
    scheduleRender();
  }

  function getCompactBotModeLabel() {
    return isStagingMode() ? "HOSTILE BOT" : "DEV BOT";
  }

  function getPercent(value, maxValue) {
    const max = Number(maxValue || 0);
    if (!max) return 0;
    return Math.max(0, Math.min(100, (Number(value || 0) / max) * 100));
  }

  function appendTargetBar(parent, value, maxValue, type) {
    const row = global.document.createElement("div");
    row.className = "lupen-target-bar";

    const track = global.document.createElement("div");
    track.className = "lupen-target-bar-track";
    const fill = global.document.createElement("span");
    const percent = getPercent(value, maxValue);
    fill.className = `lupen-target-bar-fill ${type}${percent <= 0 ? " is-empty" : percent <= 25 ? " is-low" : ""}`;
    fill.style.width = `${percent}%`;
    track.appendChild(fill);
    row.appendChild(track);
    parent.appendChild(row);
  }

  function getCardTopForPosition(position) {
    return Math.max(10, Math.min(76, position.y + 8));
  }

  function renderSelectedTargetCard(players, bots, resources, status) {
    global.document?.getElementById(spaceSelectionLayerId)?.remove();
    if (!isEnabled()) return;
    const spaceScreen = global.document?.getElementById("spaceScreen");
    if (!spaceScreen) return;

    const selectedBotId = getSelectedTargetBotId();
    const selectedPlayerId = getSelectedRemotePlayerId();
    const selectedResource = getSelectedResource(resources);
    const selectedBot = selectedBotId
      ? bots.find((bot) => String(bot.id || "") === String(selectedBotId) && isSameCurrentNode(bot))
      : null;
    const selectedPlayer = selectedPlayerId
      ? players.find((player) => String(player.sessionId || player.id || "") === selectedPlayerId && isSameCurrentNode(player))
      : null;

    if (!selectedBot && !selectedPlayer) return;

    const layer = global.document.createElement("div");
    layer.id = spaceSelectionLayerId;

    const target = selectedBot || selectedPlayer || selectedResource;
    const position = getSpacePercentPosition(target);
    const hitConfirmed = selectedBot && status?.lastShotEvent?.targetBotId === selectedBot.id && getShotEventAge(status) < 900;
    const card = global.document.createElement("div");
    card.className = `lupen-target-card ${selectedBot ? "hostile" : selectedPlayer ? "player pvp-arming" : "resource"}${hitConfirmed ? " locked hit-confirmed" : ""}`;
    card.style.left = `${position.x}%`;
    card.style.top = `${getCardTopForPosition(position)}%`;

    const title = global.document.createElement("strong");
    title.textContent = selectedBot
      ? getBotLabel(selectedBot)
      : selectedPlayer
        ? getPilotLabel(selectedPlayer)
        : `${selectedResource.resourceName || "Resource"} Asteroid`;
    card.appendChild(title);

    if (selectedBot) {
      const bars = global.document.createElement("div");
      bars.className = "lupen-target-bars";
      appendTargetBar(bars, selectedBot.hull, selectedBot.hullMax ?? selectedBot.maxHull, "hull");
      appendTargetBar(bars, selectedBot.shield, selectedBot.shieldMax ?? selectedBot.maxShield, "shield");
      card.appendChild(bars);
    } else if (selectedPlayer) {
      const ship = global.document.createElement("small");
      ship.textContent = getShipLabel(selectedPlayer);
      card.appendChild(ship);

      const statusTag = global.document.createElement("span");
      statusTag.className = "lupen-target-status pvp-arming";
      statusTag.textContent = getRemotePlayerPvpLabel(selectedPlayer, status);
      card.appendChild(statusTag);

      const readiness = global.document.createElement("small");
      readiness.className = "lupen-target-readiness";
      readiness.textContent = "Targeting systems ready";
      card.appendChild(readiness);

      const offline = global.document.createElement("small");
      offline.textContent = "PvP combat not yet online";
      card.appendChild(offline);
    } else if (selectedResource) {
      const bars = global.document.createElement("div");
      bars.className = "lupen-target-bars";
      appendTargetBar(bars, selectedResource.hp, selectedResource.hpMax, "shield");
      card.appendChild(bars);

      const valueHint = getResourceValueHint(selectedResource.resourceName);
      if (valueHint) {
        const value = global.document.createElement("small");
        value.textContent = valueHint;
        card.appendChild(value);
      }

      const hold = getCargoHoldSummary(selectedResource);
      const cargoStatus = global.document.createElement("span");
      cargoStatus.className = `lupen-target-status${hold.full || hold.limited ? " is-warning" : ""}`;
      cargoStatus.textContent = hold.warning ? `${hold.label} / ${hold.warning}` : hold.label;
      card.appendChild(cargoStatus);

      const actionHint = global.document.createElement("small");
      actionHint.textContent = hold.full ? "Sell cargo before engaging" : "Use ENGAGE to fire";
      card.appendChild(actionHint);
    }

    layer.appendChild(card);
    spaceScreen.appendChild(layer);
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

    const shipImage = getShipImageRenderSrc(player);
    if (shipImage) {
      const ship = global.document.createElementNS(SVG_NS, "image");
      ship.setAttribute("href", shipImage);
      ship.setAttributeNS(XLINK_NS, "xlink:href", shipImage);
      ship.setAttribute("x", "-3.1");
      ship.setAttribute("y", "-3.8");
      ship.setAttribute("width", "6.2");
      ship.setAttribute("height", "6.2");
      ship.setAttribute("opacity", "0.82");
      ship.setAttribute("preserveAspectRatio", "xMidYMid meet");
      ship.setAttribute("filter", "drop-shadow(0 0 2.8px rgba(80, 225, 255, 0.92))");
      group.appendChild(ship);
    } else {
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
    }

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
    if (note.textContent) group.appendChild(note);

    layer.appendChild(group);
  }

  function drawSectorBot(layer, bot, selectedTargetBotId = "") {
    const status = getClient()?.getStatus?.() || {};
    const basePosition = getServerBotMapPosition(bot);
    const offset = getStableMapOffset(bot, 1.55);
    const position = {
      x: clampMapCoordinate(basePosition.x + offset.x),
      y: clampMapCoordinate(basePosition.y + offset.y)
    };
    const labelOffset = position.x > 82 ? -2.9 : 2.9;
    const canSelectOnMap = isSameCurrentNode(bot);
    const group = global.document.createElementNS(SVG_NS, "g");
    group.setAttribute("class", `${botMarkerClass}${selectedTargetBotId === bot.id ? " is-locked" : ""}${bot.disabled ? " is-disabled" : ""}${wasRecentlyHit(bot) ? " is-hit" : ""}${isRecentlyEngagedBot(bot, status) ? " is-engaged" : ""}${isBountyTargetBot(bot, status) ? " is-bounty-target" : ""}`);
    group.setAttribute("data-bot-id", bot.id || "");
    group.setAttribute("pointer-events", canSelectOnMap ? "auto" : "none");
    group.style.cursor = canSelectOnMap ? "crosshair" : "default";
    group.setAttribute("transform", `translate(${position.x} ${position.y})`);
    if (canSelectOnMap) {
      group.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectStagingBot(bot);
      });
    }

    const title = global.document.createElementNS(SVG_NS, "title");
    title.textContent = `${getBotLabel(bot)} / ${getBotModeLabel()} / ${getBotLayerSummary(bot)} / ${getBotHullSummary(bot)} / staging damage test only / no rewards / ${bot.id || "unknown"} / x:${bot.x} y:${bot.y}`;
    group.appendChild(title);

    const hitArea = global.document.createElementNS(SVG_NS, "circle");
    hitArea.setAttribute("cx", "0");
    hitArea.setAttribute("cy", "0");
    hitArea.setAttribute("r", "4.4");
    hitArea.setAttribute("fill", "rgba(255, 255, 255, 0.001)");
    hitArea.setAttribute("stroke", "none");
    hitArea.setAttribute("pointer-events", canSelectOnMap ? "all" : "none");
    group.appendChild(hitArea);

    const halo = global.document.createElementNS(SVG_NS, "circle");
    halo.setAttribute("cx", "0");
    halo.setAttribute("cy", "0");
    halo.setAttribute("r", "2.05");
    halo.setAttribute("fill", "rgba(255, 114, 60, 0.08)");
    halo.setAttribute("stroke", "rgba(255, 160, 87, 0.42)");
    halo.setAttribute("stroke-width", "0.12");
    halo.setAttribute("pointer-events", "none");
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
      lockRing.setAttribute("pointer-events", "none");
      group.appendChild(lockRing);
    }

    if (isBountyTargetBot(bot, status)) {
      const bountyRing = global.document.createElementNS(SVG_NS, "circle");
      bountyRing.setAttribute("cx", "0");
      bountyRing.setAttribute("cy", "0");
      bountyRing.setAttribute("r", "2.65");
      bountyRing.setAttribute("fill", "none");
      bountyRing.setAttribute("stroke", "rgba(255, 210, 92, 0.82)");
      bountyRing.setAttribute("stroke-width", "0.16");
      bountyRing.setAttribute("stroke-dasharray", "0.6 0.75");
      bountyRing.setAttribute("pointer-events", "none");
      group.appendChild(bountyRing);
    }

    const botImage = getBotImageRenderSrc(bot);
    if (botImage) {
      const ship = global.document.createElementNS(SVG_NS, "image");
      ship.setAttribute("href", botImage);
      ship.setAttributeNS(XLINK_NS, "xlink:href", botImage);
      ship.setAttribute("x", "-2.8");
      ship.setAttribute("y", "-2.8");
      ship.setAttribute("width", "5.6");
      ship.setAttribute("height", "5.6");
      ship.setAttribute("opacity", bot.disabled ? "0.44" : "0.86");
      ship.setAttribute("preserveAspectRatio", "xMidYMid meet");
      ship.setAttribute("filter", "drop-shadow(0 0 2px rgba(255, 113, 55, 0.68))");
      ship.setAttribute("pointer-events", "none");
      group.appendChild(ship);
    } else {
      const ship = global.document.createElementNS(SVG_NS, "polygon");
      ship.setAttribute("points", "0,-2.25 1.65,1.25 0.65,0.9 0,2.15 -0.65,0.9 -1.65,1.25");
      ship.setAttribute("fill", "rgba(255, 132, 69, 0.66)");
      ship.setAttribute("stroke", "rgba(255, 225, 185, 0.82)");
      ship.setAttribute("stroke-width", "0.18");
      ship.setAttribute("filter", "drop-shadow(0 0 1.8px rgba(255, 113, 55, 0.72))");
      ship.setAttribute("pointer-events", "none");
      group.appendChild(ship);

      const core = global.document.createElementNS(SVG_NS, "circle");
      core.setAttribute("cx", "0");
      core.setAttribute("cy", "0.05");
      core.setAttribute("r", "0.42");
      core.setAttribute("fill", "rgba(48, 9, 4, 0.8)");
      core.setAttribute("stroke", "rgba(255, 230, 194, 0.82)");
      core.setAttribute("stroke-width", "0.1");
      core.setAttribute("pointer-events", "none");
      group.appendChild(core);
    }

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
    note.setAttribute("pointer-events", "none");
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

    const visiblePlayers = dedupePlayers(players).filter((player) => isFreshRemotePilot(player) && isPilotInSpace(player));
    if (!visiblePlayers.length) return;

    const layer = global.document.createElementNS(SVG_NS, "g");
    layer.setAttribute("class", layerClass);
    layer.setAttribute("pointer-events", "none");
    visiblePlayers.forEach((player) => drawSectorGhost(layer, player));
    svg.appendChild(layer);
  }

  function renderSectorBots(bots) {
    const svg = global.document?.getElementById("sectorSvg");
    if (!svg || !isEnabled()) {
      removeSectorLayer();
      return;
    }

    svg.querySelector(`.${botLayerClass}`)?.remove();

    if (!isMpDebugEnabled()) return;
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

  function appendSpaceGhostMarker(layer, player, index, options = {}) {
    const selectedPlayerId = options.selectedPlayerId || "";
    const marker = global.document.createElement("div");
    marker.className = "lupen-mp-space-ghost";
    if (String(player.sessionId || player.id || "") === selectedPlayerId) marker.classList.add("is-selected");
    if (options.arriving) marker.classList.add("is-arriving");
    if (options.departing) marker.classList.add("is-departing");
    marker.dataset.sessionId = player.sessionId || player.id || "";
    marker.style.left = `${Number.isFinite(Number(player.spaceLeft)) ? Number(player.spaceLeft) : 50 + getStableOffset(player, index)}%`;
    marker.style.top = `${Number.isFinite(Number(player.spaceTop)) ? Number(player.spaceTop) : 24 + (index % 3) * 12}%`;
    if (!options.departing) {
      marker.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectRemotePlayer(player);
      });
    }

    const ship = global.document.createElement("div");
    ship.className = "lupen-mp-space-ghost-ship";
    const shipImage = getShipImageRenderSrc(player);
    if (shipImage) {
      ship.classList.add("has-image");
      const image = global.document.createElement("img");
      image.src = shipImage;
      image.alt = "";
      image.onload = () => {
        shipImageLoadStatus.set(shipImage, "loaded");
      };
      image.onerror = () => {
        shipImageLoadStatus.set(shipImage, "failed");
        image.remove();
        ship.classList.remove("has-image");
        scheduleRender();
      };
      ship.appendChild(image);
    }
    marker.appendChild(ship);

    const label = global.document.createElement("div");
    label.className = "lupen-mp-space-ghost-label";
    label.textContent = getPilotLabel(player);
    marker.appendChild(label);

    const note = global.document.createElement("div");
    note.className = "lupen-mp-space-ghost-note";
    note.textContent = getDevGhostLabel(player);
    if (note.textContent) marker.appendChild(note);

    layer.appendChild(marker);
  }

  function renderSpaceGhosts(players) {
    removeSpaceLayer();
    if (!isEnabled()) return;

    const spaceScreen = global.document?.getElementById("spaceScreen");
    if (!spaceScreen) return;

    processSpacePresenceEffects(players);
    const localPlayers = dedupePlayers(players).filter((player) => isFreshRemotePilot(player) && isPilotInSpace(player) && isSameCurrentNode(player));
    const departingPlayers = Array.from(remoteGhostDepartures.values());
    if (!localPlayers.length && !departingPlayers.length) return;

    ensureStyles();

    const layer = global.document.createElement("div");
    layer.id = spaceLayerId;
    layer.setAttribute("aria-hidden", "true");
    const selectedPlayerId = getSelectedRemotePlayerId();

    localPlayers.slice(0, 6).forEach((player, index) => {
      const spaceLeft = 50 + getStableOffset(player, index);
      const spaceTop = 24 + (index % 3) * 12;
      remoteGhostSnapshots.set(getRemotePilotKey(player), { ...player, spaceLeft, spaceTop });
      appendSpaceGhostMarker(layer, { ...player, spaceLeft, spaceTop }, index, {
        selectedPlayerId,
        arriving: Number(remoteGhostArrivals.get(getRemotePilotKey(player)) || 0) > Date.now()
      });
    });

    departingPlayers.forEach((player, index) => {
      if (localPlayers.some((localPlayer) => getRemotePilotKey(localPlayer) === getRemotePilotKey(player))) return;
      appendSpaceGhostMarker(layer, player, localPlayers.length + index, {
        selectedPlayerId,
        departing: true
      });
    });

    spaceScreen.appendChild(layer);
  }

  function renderSpaceBots(bots, players = []) {
    global.document?.getElementById(spaceBotLayerId)?.remove();
    if (!isEnabled()) return;

    const spaceScreen = global.document?.getElementById("spaceScreen");
    if (!spaceScreen) return;

    const localBots = bots.filter((bot) => isSameCurrentNode(bot) && (!bot.disabled || isMpDebugEnabled()));
    if (!localBots.length) return;

    ensureStyles();

    const layer = global.document.createElement("div");
    layer.id = spaceBotLayerId;
    layer.setAttribute("aria-hidden", "true");

    const status = getClient()?.getStatus?.() || {};
    localBots.slice(0, 10).forEach((bot, index) => {
      const isSelected = getSelectedTargetBotId() === bot.id;
      const isEngaged = isRecentlyEngagedBot(bot, status);
      const remoteEngagerCount = getRemoteBotEngagerCount(bot, players);
      const isBountyTarget = isBountyTargetBot(bot, status);
      const marker = global.document.createElement("div");
      marker.className = "lupen-mp-space-bot";
      marker.dataset.botId = bot.id || "";
      if (isSelected) marker.classList.add("is-locked");
      if (isEngaged) marker.classList.add("is-engaged");
      if (remoteEngagerCount > 0) marker.classList.add("is-coop-engaged");
      if (isBountyTarget) marker.classList.add("is-bounty-target");
      if (bot.disabled) marker.classList.add("is-disabled");
      if (wasRecentlyHit(bot)) marker.classList.add("is-hit");
      marker.title = `${getBotLabel(bot)} / ${getBotLayerSummary(bot)} / ${getBotHullSummary(bot)}${remoteEngagerCount ? ` / engaged by ${remoteEngagerCount} pilot${remoteEngagerCount === 1 ? "" : "s"}` : ""} / staging damage test only / no rewards`;
      marker.style.left = `${clampMapCoordinate(bot.x || 50)}%`;
      marker.style.top = `${clampMapCoordinate(bot.y || 50)}%`;
      marker.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (bot.disabled && !isMpDebugEnabled()) return;
        selectStagingBot(bot);
      });

      const hitbox = global.document.createElement("span");
      hitbox.className = "lupen-mp-space-bot-hitbox";
      hitbox.setAttribute("aria-hidden", "true");
      marker.appendChild(hitbox);

      const ship = global.document.createElement("div");
      ship.className = "lupen-mp-space-bot-ship";
      const image = global.document.createElement("img");
      const botImage = getBotImageRenderSrc(bot);
      image.src = botImage;
      image.alt = "";
      image.onload = () => {
        botImageLoadStatus.set(botImage, "loaded");
      };
      image.onerror = () => {
        botImageLoadStatus.set(botImage, "failed");
        image.remove();
        if (ship.querySelector(".lupen-mp-space-bot-ship-fallback")) return;
        const fallback = global.document.createElement("span");
        fallback.className = "lupen-mp-space-bot-ship-fallback";
        ship.appendChild(fallback);
        scheduleRender();
      };
      if (botImage) {
        ship.appendChild(image);
      } else {
        const fallback = global.document.createElement("span");
        fallback.className = "lupen-mp-space-bot-ship-fallback";
        ship.appendChild(fallback);
      }
      marker.appendChild(ship);

      layer.appendChild(marker);
    });

    spaceScreen.appendChild(layer);
  }

  function renderSpaceResources(resources) {
    global.document?.getElementById(spaceResourceLayerId)?.remove();
    selectedResourceId = "";
    // Staging resources remain in server state, but Map 1 asteroid gameplay is
    // presented through the local combat asteroid layer so lasers, hit effects,
    // and target handling stay consistent.
  }

  function renderSpaceShot(players, bots, status) {
    global.document?.getElementById(spaceShotLayerId)?.remove();
    if (!isStagingMode(status) || !status?.lastShotEvent || getShotEventAge(status) > 900) return;
    if (normalizeNodeKey(status.lastShotEvent.currentNode) !== normalizeNodeKey(getCurrentNodeName())) return;

    const spaceScreen = global.document?.getElementById("spaceScreen");
    if (!spaceScreen) return;

    const targetBot = bots.find((bot) => bot.id === status.lastShotEvent.targetBotId);
    if (!targetBot || !isSameCurrentNode(targetBot)) return;

    ensureStyles();
    playLocalStagingShotFeedback(status, targetBot);

    const attacker = players.find((player) => player.sessionId === status.lastShotEvent.attackerSessionId || player.id === status.lastShotEvent.attackerSessionId);
    const targetPosition = getSpacePercentPosition(targetBot);
    const attackerPosition = attacker && isSameCurrentNode(attacker)
      ? getSpacePercentPosition(attacker, { x: 50, y: 66 })
      : { x: targetPosition.x - 14, y: targetPosition.y + 12 };

    const layer = global.document.createElement("div");
    layer.id = spaceShotLayerId;
    layer.setAttribute("aria-hidden", "true");

    const dx = targetPosition.x - attackerPosition.x;
    const dy = targetPosition.y - attackerPosition.y;
    const distance = Math.max(8, Math.sqrt(dx * dx + dy * dy));
    const angle = Math.atan2(dy, dx);
    const isLocalShot = status.lastShotEvent.attackerSessionId === status.sessionId;
    const shotOwnerClass = isLocalShot ? "is-local" : "is-remote";
    const beamFan = [
      { x: 0, y: 0, scale: 1, className: shotOwnerClass },
      { x: -1.8, y: 0.9, scale: 0.95, className: `${shotOwnerClass} is-wing` },
      { x: 1.8, y: -0.9, scale: 0.95, className: `${shotOwnerClass} is-wing` },
      { x: -3.1, y: -1.1, scale: 0.78, className: `${shotOwnerClass} is-spark` },
      { x: 3.1, y: 1.1, scale: 0.78, className: `${shotOwnerClass} is-spark` }
    ];

    const muzzle = global.document.createElement("div");
    muzzle.className = `lupen-mp-shot-muzzle ${shotOwnerClass}`;
    muzzle.style.left = `${attackerPosition.x}%`;
    muzzle.style.top = `${attackerPosition.y}%`;
    layer.appendChild(muzzle);

    if (!isLocalShot && (attacker || status.lastShotEvent.attackerDisplayName)) {
      const label = global.document.createElement("div");
      label.className = "lupen-mp-shot-attacker-label";
      label.textContent = String(attacker?.displayName || attacker?.name || status.lastShotEvent.attackerDisplayName || "Pilot").slice(0, 18);
      label.style.left = `${attackerPosition.x}%`;
      label.style.top = `${attackerPosition.y}%`;
      layer.appendChild(label);
    }

    beamFan.forEach((beamDef, index) => {
      const beam = global.document.createElement("div");
      beam.className = `lupen-mp-shot-beam ${beamDef.className}`.trim();
      beam.style.left = `${attackerPosition.x + beamDef.x}%`;
      beam.style.top = `${attackerPosition.y + beamDef.y}%`;
      beam.style.width = `${Math.max(7, distance * beamDef.scale)}%`;
      beam.style.setProperty("--shot-angle", `${angle + (index - 2) * 0.012}rad`);
      beam.style.animationDelay = `${Math.min(index * 28, 96)}ms`;
      layer.appendChild(beam);
    });

    const hit = global.document.createElement("div");
    hit.className = "lupen-mp-shot-hit";
    hit.style.left = `${targetPosition.x}%`;
    hit.style.top = `${targetPosition.y}%`;
    layer.appendChild(hit);

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

  function getLastShotEventLabel(status) {
    const event = status?.lastShotEvent;
    if (!event?.targetBotId) return "none";
    const attacker = String(event.attackerSessionId || "").slice(0, 6) || "pilot";
    const target = String(event.targetBotId || "").slice(-6) || "bot";
    return `${attacker}->${target} / ${event.weaponName || "weapon"} / ${Math.round(Number(event.damage || 0))}`;
  }

  function getRewardPreviewLabel(status) {
    const preview = status?.lastRewardPreview;
    if (!preview?.botId) return "none";
    const finalHit = getPreviewIdentityLabel(preview.finalHitDisplayName, preview.finalHitPlayerId, preview.finalHitBy || preview.disabledBySessionId);
    const topContributor = getPreviewIdentityLabel(preview.topContributorDisplayName, preview.topContributorPlayerId, preview.topContributorSessionId || preview.topContributor?.sessionId);
    const yourContribution = getRewardPreviewSelfContribution(status);
    const contributionLabel = yourContribution
      ? `you ${Math.round(Number(yourContribution.percent || 0))}%`
      : "you 0%";
    return `${preview.botName || "Staging Bot"} / final ${finalHit} / top ${topContributor} / ${contributionLabel} / not applied`;
  }

  function getLootPreviewLabel(status) {
    const preview = status?.lastRewardPreview?.lootPreview;
    if (!preview?.available) return "none";
    const itemCount = Array.isArray(preview.items) ? preview.items.length : 0;
    const eligible = isLootPreviewEligibleForSelf(status, status.lastRewardPreview) ? "eligible" : "not eligible";
    return `${eligible} / ${itemCount} item${itemCount === 1 ? "" : "s"} / inventory write ${preview.inventoryWritten ? "yes" : "no"}`;
  }

  function getPreviewIdentityLabel(displayName, playerId, sessionId) {
    const name = String(displayName || "").trim();
    if (name && name.toLowerCase() !== "pilot") return name.slice(0, 16);
    return String(playerId || sessionId || "").slice(0, 8) || "unknown";
  }

  function getRewardPreviewSelfContribution(status) {
    const sessionId = String(status?.sessionId || "");
    const contributors = Array.isArray(status?.lastRewardPreview?.contributors)
      ? status.lastRewardPreview.contributors
      : [];
    if (!sessionId || !contributors.length) return null;

    return contributors.find((contributor) => contributor.sessionId === sessionId) || null;
  }

  function getRewardPreviewContributionLabel(status) {
    const preview = status?.lastRewardPreview;
    if (!preview?.botId) return "";

    const finalHit = getPreviewIdentityLabel(preview.finalHitDisplayName, preview.finalHitPlayerId, preview.finalHitBy || preview.disabledBySessionId);
    const topContributor = getPreviewIdentityLabel(preview.topContributorDisplayName, preview.topContributorPlayerId, preview.topContributorSessionId || preview.topContributor?.sessionId);
    const selfContribution = getRewardPreviewSelfContribution(status);
    const selfDamage = selfContribution ? Math.round(Number(selfContribution.totalDamage || 0)) : 0;
    const selfPercent = selfContribution ? Math.round(Number(selfContribution.percent || 0)) : 0;

    return `Final ${finalHit} / Top ${topContributor} / You ${selfDamage} dmg (${selfPercent}%)`;
  }

  function isRewardPreviewForBot(status, bot) {
    return !!bot?.id && status?.lastRewardPreview?.botId === bot.id;
  }

  function isClaimResultForBot(status, bot) {
    return !!bot?.id && status?.lastRewardClaimResult?.botId === bot.id;
  }

  function getCombatPanelMessage(status, selectedBot) {
    const response = status?.lastCombatResponse;
    const botEvent = status?.lastBotEvent;

    if (selectedBot?.disabled) {
      return {
        tone: "destroyed",
        text: isRewardPreviewForBot(status, selectedBot)
          ? "Target destroyed. Staging XP preview is ready."
          : "Target destroyed. Waiting for server respawn."
      };
    }

    if (response?.targetBotId === selectedBot?.id) {
      if (response.ok) {
        return {
          tone: "hit",
          text: `Hit confirmed: -${Math.round(Number(response.damage || 0))} ${response.weaponName || "weapon"} damage.`
        };
      }

      if (response.reason === "staging_fire_cooldown") {
        return {
          tone: "blocked",
          text: `Weapon cooling down: ${formatCooldown(response.cooldownRemainingMs)} remaining.`
        };
      }

      return {
        tone: "blocked",
        text: `Staging fire blocked: ${response.reason || "server rejected intent"}.`
      };
    }

    if (botEvent?.botId === selectedBot?.id && botEvent.type === "bot:respawned") {
      return {
        tone: "hit",
        text: "Target respawned by server. Contributions cleared."
      };
    }

    return {
      tone: "",
      text: "Locked target. Server test damage only."
    };
  }

  function getRewardPreviewPanelLines(status, selectedBot) {
    const preview = status?.lastRewardPreview;
    if (!isRewardPreviewForBot(status, selectedBot)) return [];

    const selfContribution = getRewardPreviewSelfContribution(status);
    const selfDamage = selfContribution ? Math.round(Number(selfContribution.totalDamage || 0)) : 0;
    const selfPercent = selfContribution ? Math.round(Number(selfContribution.percent || 0)) : 0;
    const finalHit = getPreviewIdentityLabel(preview.finalHitDisplayName, preview.finalHitPlayerId, preview.finalHitBy || preview.disabledBySessionId);
    const topContributor = getPreviewIdentityLabel(preview.topContributorDisplayName, preview.topContributorPlayerId, preview.topContributorSessionId || preview.topContributor?.sessionId);

    return [
      `Staging XP preview: ${Math.round(Number(preview.previewXp || 0))}`,
      `Your share: ${selfDamage} dmg (${selfPercent}%)`,
      `Final hit: ${finalHit} / Top: ${topContributor}`,
      "Simulated XP reward. No credits, bounty writes, or saves from preview."
    ];
  }

  function getCompactRewardPreviewPanelLines(status, selectedBot) {
    const preview = status?.lastRewardPreview;
    if (!isRewardPreviewForBot(status, selectedBot)) return [];

    const botXp = status?.lastStagingBotXpResult;
    const lines = [];
    if (botXp?.botId === selectedBot?.id && botXp.applied) {
      const xpBefore = Number(botXp.xpBefore ?? botXp.playerSavePatchResult?.xpBefore ?? botXp.playerSave?.xpBefore);
      const xpAfter = Number(botXp.xpAfter ?? botXp.persistedXp ?? botXp.playerSavePatchResult?.xpAfter ?? botXp.playerSave?.xpAfter);
      if (Number.isFinite(xpBefore) && Number.isFinite(xpAfter)) {
        lines.push(`Bot XP applied: ${Math.round(xpBefore)} -> ${Math.round(xpAfter)}.`);
      } else {
        lines.push(`Bot XP applied: +${Math.round(Number(botXp.xpDelta || 0))}.`);
      }
    } else if (botXp?.botId === selectedBot?.id && botXp.localFallbackApplied) {
      lines.push(`Bot XP applied locally: +${Math.round(Number(botXp.localFallbackXpDelta || 0))}.`);
    } else if (botXp?.botId === selectedBot?.id && botXp.mode === "blocked") {
      lines.push(`Bot XP blocked: ${getFriendlyBotXpReason(botXp)}.`);
    } else {
      lines.push(`Bot XP auto-applies on destruction: +${Math.round(Number(preview.previewXp || 0))}. Refreshing server XP.`);
    }
    lines.push("Bounty bonus XP claims from Bounty Board.");
    const lootPreview = preview?.lootPreview;
    const items = Array.isArray(lootPreview?.items) ? lootPreview.items : [];
    if (lootPreview?.available && items.length && isLootPreviewEligibleForSelf(status, preview)) {
      const item = items[0] || {};
      lines.push(`Shard preview only: ${Math.round(Number(item.quantity || 1))}x ${item.name || "Lupen Shard"}.`);
    }
    lines.push("Preview only - no loot or credits applied here.");
    return lines;
  }

  function isLootPreviewEligibleForSelf(status, preview = status?.lastRewardPreview) {
    const eligibleSessionIds = Array.isArray(preview?.lootPreview?.eligibleSessionIds)
      ? preview.lootPreview.eligibleSessionIds
      : [];
    return !eligibleSessionIds.length || eligibleSessionIds.includes(status?.sessionId);
  }

  function getLootPreviewPanelLines(status, selectedBot) {
    const preview = status?.lastRewardPreview;
    if (!isRewardPreviewForBot(status, selectedBot)) return [];
    const lootPreview = preview?.lootPreview;
    if (!lootPreview?.available || !isLootPreviewEligibleForSelf(status, preview)) return [];

    const items = Array.isArray(lootPreview.items) ? lootPreview.items : [];
    const itemLines = items.length
      ? items.slice(0, 3).map((item) => `Would drop: ${Math.round(Number(item.quantity || 1))}x ${item.name || "Preview Loot"} (${item.rarity || "common"})`)
      : ["Would drop: none"];

    return [
      "Loot preview",
      ...itemLines,
      "Preview only - inventory not changed.",
      "Loot writes not enabled in staging."
    ];
  }

  function getFriendlyClaimReason(reason) {
    const safeReason = String(reason || "").trim();
    const labels = {
      progression_writes_disabled: "progression writes are disabled",
      reward_application_not_eligible: "verified reward eligibility is missing",
      identity_guest: "guest identity cannot receive real staging XP",
      identity_unverified: "Supabase identity is unverified",
      staging_write_allowlist_missing: "staging write allow-list is missing",
      player_not_in_staging_write_allowlist: "player is not in the staging write allow-list",
      verified_player_missing: "verified player id is missing",
      duplicate_reward_application: "duplicate claim blocked by idempotency",
      idempotency_not_ready: "idempotency key is not ready",
      xp_path_missing_or_ambiguous: "XP save path is unavailable",
      player_save_read_failed: "player save read failed",
      player_save_missing: "player save is missing",
      player_save_patch_failed: "player save patch failed",
      reward_preview_not_eligible: "not eligible for this preview",
      reward_preview_not_found: "reward preview was not found",
      reward_preview_id_mismatch: "reward preview id mismatch",
      staging_bounty_not_accepted: "staging bounty is not accepted",
      staging_bounty_not_complete: "staging bounty is not complete",
      staging_bounty_already_claimed: "staging bounty already claimed",
      unknown_staging_bounty: "unknown staging bounty",
      staging_preview_only: "preview-only staging claim",
      loot_writes_disabled: "loot writes are disabled",
      loot_write_dry_run: "loot claim is in dry-run mode",
      duplicate_loot_claim: "duplicate Lupen Shard claim blocked",
      loot_item_not_allowed: "loot item is not allowed",
      staging_loot_write_allowlist_missing: "staging loot allow-list is missing",
      player_not_in_staging_loot_write_allowlist: "player is not in the staging loot allow-list",
      lupen_shards_path_missing_or_invalid: "Lupen Shards save path is unavailable"
    };
    return labels[safeReason] || safeReason || "not eligible";
  }

  function getFriendlyBotXpReason(result) {
    const reason = String(result?.debugReason || result?.reason || "").trim();
    if (reason === "duplicate_reward_application" ||
      result?.playerSavePatchPlan?.duplicateDetected ||
      result?.playerSavePatchResult?.duplicateDetected) {
      return "duplicate destruction event";
    }
    return getFriendlyClaimReason(reason);
  }

  function getAppliedXpRangeFromResult(result = {}) {
    const playerSave = result.playerSave || result.claimStatus?.playerSave || {};
    const patchResult = result.playerSavePatchResult || {};
    const applied = result.applied === true ||
      result.saveWritten === true ||
      playerSave.written === true ||
      patchResult.applied === true;
    const xpBefore = Number(result.xpBefore ?? playerSave.xpBefore ?? patchResult.xpBefore);
    const xpAfter = Number(result.xpAfter ?? result.persistedXp ?? playerSave.xpAfter ?? patchResult.xpAfter ?? patchResult.persistedXp);
    return {
      applied,
      xpBefore: Number.isFinite(xpBefore) ? Math.round(xpBefore) : null,
      xpAfter: Number.isFinite(xpAfter) ? Math.round(xpAfter) : null
    };
  }

  function applyStagingXpFromRenderedResult(result = {}, source = "rewardPanel") {
    const range = getAppliedXpRangeFromResult(result);
    if (!range.applied || !Number.isFinite(range.xpAfter)) return false;

    const payload = {
      ...result,
      xpSource: source,
      xpBefore: range.xpBefore,
      xpAfter: range.xpAfter,
      applied: true,
      saveWritten: true
    };

    if (typeof global.applyStagingXpClaimToLoadedState === "function") {
      return global.applyStagingXpClaimToLoadedState(payload);
    }

    global.setTimeout(() => {
      if (typeof global.applyStagingXpClaimToLoadedState === "function") {
        global.applyStagingXpClaimToLoadedState(payload);
      }
    }, 0);
    return false;
  }

  function requestRewardPanelXpRefresh(status = {}, selectedBot = null) {
    const preview = status.lastRewardPreview;
    if (!preview?.botId || (selectedBot?.id && preview.botId !== selectedBot.id)) return;
    if (typeof global.refreshProgressAfterStagingCombat !== "function") return;

    const key = `${preview.rewardPreviewId || preview.botId}:${status.lastStagingBotXpResult?.xpAfter || ""}:${status.lastRewardClaimResult?.xpAfter || ""}`;
    if (!key || key === lastRewardPanelXpRefreshKey) return;
    lastRewardPanelXpRefreshKey = key;

    global.setTimeout(() => {
      global.refreshProgressAfterStagingCombat?.({
        reason: "rewardPanel",
        trustedXpAfter: status.lastStagingBotXpResult?.xpAfter ||
          status.lastRewardClaimResult?.xpAfter ||
          status.lastStagingBountyClaimResult?.xpAfter ||
          null
      });
    }, 250);
  }

  function getClaimStatusSummary(result = {}) {
    const summary = result.claimStatus || {};
    return {
      mode: String(summary.mode || result.mode || ""),
      applied: summary.applied === true || result.applied === true,
      xpDelta: Number.isFinite(Number(summary.xpDelta ?? result.xpDelta))
        ? Number(summary.xpDelta ?? result.xpDelta)
        : Number(result.rewardWritePlan?.intendedXp || result.rewardApplicationPlan?.xpDelta || 0),
      reason: String(summary.reason || result.reason || ""),
      debugReason: String(summary.debugReason || result.debugReason || ""),
      gates: summary.gates || result.gates || null,
      ledger: summary.ledger || result.ledger || null,
      progressionShadow: summary.progressionShadow || result.progressionShadow || null,
      playerSave: summary.playerSave || result.playerSave || null
    };
  }

  function getClaimPanelLabel(status, selectedBot) {
    const result = status?.lastRewardClaimResult;
    if (!isClaimResultForBot(status, selectedBot)) return "";

    const claimStatus = getClaimStatusSummary(result);
    const reason = claimStatus.debugReason || claimStatus.reason || result.reason;
    const xpDelta = Math.round(Number(claimStatus.xpDelta || result.rewardWritePlan?.intendedXp || 0));
    const playerSave = claimStatus.playerSave || {};
    const gates = claimStatus.gates || {};

    if (!result.ok) {
      return `Claim blocked: ${getFriendlyClaimReason(reason)}. No save changed.`;
    }

    if (playerSave.written || result.playerSavePatchResult?.applied) {
      const xpBefore = playerSave.xpBefore ?? result.playerSavePatchResult?.xpBefore;
      const xpAfter = playerSave.xpAfter ?? result.playerSavePatchResult?.xpAfter;
      applyStagingXpFromRenderedResult({
        ...result,
        xpBefore,
        xpAfter,
        applied: true,
        saveWritten: true
      }, "rewardPanel");
      return `XP-only staging claim applied: ${formatPreviewValue(xpBefore)} -> ${formatPreviewValue(xpAfter)}. No credits awarded; loot preview not applied.`;
    }

    if (claimStatus.mode === "blocked") {
      return `Claim blocked: ${getFriendlyClaimReason(reason)}. XP preview +${xpDelta}; no credits awarded; loot preview not applied.`;
    }

    if (gates.xpWriteAllowed) {
      return `XP-only claim available: +${xpDelta} XP if server gates remain enabled. No credits awarded; loot preview remains inventory-off.`;
    }

    if (claimStatus.mode === "dry_run") {
      return `Simulated claim: +${xpDelta} XP dry-run only. Progression writes disabled; loot preview not applied.`;
    }

    const rewardPlan = result.rewardWritePlan;
    const patchResult = result.playerSavePatchResult;
    const patchPlan = result.playerSavePatchPlan || patchResult?.plan;
    if (patchResult?.applied) {
      applyStagingXpFromRenderedResult({
        ...result,
        xpBefore: patchResult.xpBefore,
        xpAfter: patchResult.xpAfter,
        applied: true,
        saveWritten: true
      }, "claimPreview");
      return `XP-only staging claim applied: ${formatPreviewValue(patchResult.xpBefore)} -> ${formatPreviewValue(patchResult.xpAfter)}. No credits or loot.`;
    }

    if (patchResult || patchPlan) {
      const reason = patchResult?.skippedReason || patchPlan?.skippedReason || "dry-run";
      const scope = patchResult?.progressionWriteScope || patchPlan?.progressionWriteScope || "allowlist";
      return `XP-only claim not applied: ${reason}. Gate: ${scope}.`;
    }

    if (rewardPlan) {
      const eligibility = rewardPlan.eligible ? "eligible dry-run" : `blocked: ${rewardPlan.blockedReason || "not verified"}`;
      return `Claim simulated: XP ${rewardPlan.intendedXp || 0} preview / ${eligibility}. No save changed.`;
    }

    if (result.claimSimulated || result.dryRun) {
      return "Claim simulated only. Loot preview remains inventory-only future work; no save changed.";
    }

    return "Claim received. No save changed.";
  }

  function getLootClaimPanelLabel(status, selectedBot) {
    const result = status?.lastStagingLootClaimResult;
    if (!isLootClaimResultForBot(status, selectedBot)) return "";

    if (!result.ok) {
      return `Lupen Shard claim blocked: ${getFriendlyClaimReason(result.reason)}. No material changed.`;
    }

    if (result.applied || result.writes?.saveWritten) {
      return `Lupen Shard claimed: ${formatPreviewValue(result.materialBefore)} -> ${formatPreviewValue(result.materialAfter)}. Save refresh requested.`;
    }

    if (result.duplicateDetected) {
      return "Lupen Shard claim already handled. Duplicate blocked.";
    }

    const gate = result.gates || {};
    if (gate.writeEnabled && gate.dryRun === false && gate.playerAllowed) {
      return "Lupen Shard claim eligible, but no material write applied yet.";
    }

    return `Lupen Shard dry-run only: ${getFriendlyClaimReason(result.reason)}. Material not changed.`;
  }

  function getClaimButtonState(status, selectedBot) {
    const result = isClaimResultForBot(status, selectedBot) ? status?.lastRewardClaimResult : null;
    const claimStatus = getClaimStatusSummary(result || {});
    const reason = claimStatus.debugReason || claimStatus.reason || result?.reason || "";
    const duplicateBlocked = reason === "duplicate_reward_application" ||
      result?.playerSavePatchResult?.duplicateDetected === true ||
      result?.playerSavePatchPlan?.duplicateDetected === true;

    if (claimStatus.playerSave?.written || result?.playerSavePatchResult?.applied || claimStatus.mode === "xp_only") {
      return {
        label: "Claimed",
        disabled: true,
        title: "XP-only staging claim already applied. No credits or loot."
      };
    }

    if (duplicateBlocked) {
      return {
        label: "Claimed",
        disabled: true,
        title: "Duplicate staging claim blocked by idempotency."
      };
    }

    if (claimStatus.gates?.xpWriteAllowed) {
      return {
        label: "Claim XP",
        disabled: false,
        title: "Attempt gated XP-only staging claim. No credits or loot."
      };
    }

    return {
      label: "Sim Claim",
      disabled: false,
      title: "Simulate a staging reward claim. No real rewards are applied."
    };
  }

  function getRewardClaimResultLabel(status) {
    const result = status?.lastRewardClaimResult;
    if (!result?.botId) return "none";
    if (!result.ok) return `${result.reason || "claim rejected"} / not applied`;

    const claimStatus = getClaimStatusSummary(result);
    if (claimStatus.mode) {
      const gateLabel = claimStatus.gates?.xpWriteAllowed
        ? "XP gate open"
        : claimStatus.gates?.verified
          ? `XP gate blocked ${claimStatus.debugReason || claimStatus.reason || "dry-run"}`
          : "identity not verified";
      return `${claimStatus.mode} / XP +${Math.round(Number(claimStatus.xpDelta || 0))} / ${gateLabel} / C 0 / loot none`;
    }

    const plan = result.rewardWritePlan;
    const ledger = result.rewardLedgerResult;
    const application = result.rewardApplicationResult;
    if (plan) {
      const eligibility = plan.eligible ? "eligible" : `blocked ${plan.blockedReason || "not verified"}`;
      const loot = plan.intendedLoot?.length ? plan.intendedLoot.join(", ") : "none";
      const ledgerLabel = ledger?.ledgerId
        ? ` / ledger id ${ledger.ledgerId}`
        : ledger?.skippedReason
          ? ` / ledger ${ledger.skippedReason}`
          : "";
      const applicationLabel = application?.skippedReason
        ? ` / application ${application.skippedReason}`
        : "";
      return `${eligibility} / XP ${plan.intendedXp || 0} / C ${plan.intendedCredits || 0} / loot ${loot}${ledgerLabel}${applicationLabel} / progression not applied`;
    }

    const selfContribution = Array.isArray(result.contributors)
      ? result.contributors.find((contributor) => contributor.sessionId === status.sessionId)
      : null;
    const selfPercent = selfContribution ? Math.round(Number(selfContribution.percent || 0)) : 0;
    return `preview only / you ${selfPercent}% / not applied`;
  }

  function getRewardDryRunPanelLabel(status) {
    const plan = status?.lastRewardClaimResult?.rewardWritePlan;
    if (!plan) return "";

    const playerSave = status?.lastRewardClaimResult?.playerSavePatchResult;
    if (playerSave?.applied) {
      return `XP applied ${formatPreviewValue(playerSave.xpBefore)} -> ${formatPreviewValue(playerSave.xpAfter)} / Credits unchanged / Loot none / Save refresh requested`;
    }

    const ledger = status?.lastRewardClaimResult?.rewardLedgerResult;
    const application = status?.lastRewardClaimResult?.rewardApplicationResult;
    const eligibility = plan.eligible ? "Eligible" : `Blocked: ${plan.blockedReason || "not verified"}`;
    const loot = plan.intendedLoot?.length ? plan.intendedLoot.join(", ") : "none";
    const ledgerLabel = ledger?.ledgerId
      ? ` / Ledger id: ${ledger.ledgerId}`
      : ledger?.skippedReason
        ? ` / Ledger: ${ledger.skippedReason}`
        : "";
    const applicationLabel = application?.skippedReason
      ? ` / Application: ${application.skippedReason}`
      : "";
    return `${eligibility} / XP ${plan.intendedXp || 0} / Credits preview ${plan.intendedCredits || 0} / Loot ${loot}${ledgerLabel}${applicationLabel} / Progression not applied`;
  }

  function getRewardApplicationLabel(status) {
    const result = status?.lastRewardClaimResult?.rewardApplicationResult;
    const plan = status?.lastRewardClaimResult?.rewardApplicationPlan || result?.plan;
    if (!plan && !result) return "";

    if (status?.lastRewardClaimResult?.playerSavePatchResult?.applied) {
      return `eligible / idempotency ready / XP +${plan?.xpDelta || 0} / credits not applied / loot none / player_saves XP-only patch applied`;
    }

    const eligibility = plan?.eligible ? "eligible" : `blocked ${plan?.blockedReason || result?.skippedReason || "not verified"}`;
    const loot = plan?.lootAdditions?.length ? plan.lootAdditions.join(", ") : "none";
    const skipped = result?.skippedReason ? ` / ${result.skippedReason}` : "";
    const idempotency = result?.duplicateDetected || plan?.duplicateDetected
      ? "duplicate"
      : result?.idempotencyReady || plan?.idempotencyReady
        ? "idempotency ready"
        : "idempotency not ready";
    return `${eligibility} / ${idempotency} / XP +${plan?.xpDelta || 0} / credits not applied / loot ${loot}${skipped} / dry-run`;
  }

  function formatPreviewValue(value) {
    return value === null || value === undefined ? "unknown" : String(Math.round(Number(value)));
  }

  function getProgressionPreviewLabel(status) {
    const preview = status?.lastRewardClaimResult?.progressionPreview;
    if (!preview) return "";
    if (!preview.available) return `Save preview unavailable / ${preview.reason || "unknown"} / not saved`;

    const loot = preview.intendedLootAdditions?.length ? preview.intendedLootAdditions.join(", ") : "none";
    const playerSaveApplied = status?.lastRewardClaimResult?.playerSavePatchResult?.applied === true;
    return `XP ${formatPreviewValue(preview.currentXp)} -> ${formatPreviewValue(preview.previewXp)} / C ${formatPreviewValue(preview.currentCredits)} -> ${formatPreviewValue(preview.previewCredits)} / loot ${loot} / ${playerSaveApplied ? "XP saved only" : "not saved"}`;
  }

  function getProgressionShadowLabel(status) {
    const shadow = status?.lastRewardClaimResult?.progressionShadowResult;
    if (!shadow) return "";
    const idLabel = shadow.shadowId ? `id ${shadow.shadowId}` : shadow.skippedReason || "not written";
    const appliedLabel = shadow.entry?.appliedToRealSave ? "real save changed" : "real save not changed";
    return `${idLabel} / ${appliedLabel} / dry-run`;
  }

  function getPlayerSavePatchLabel(status) {
    const result = status?.lastRewardClaimResult?.playerSavePatchResult;
    const plan = status?.lastRewardClaimResult?.playerSavePatchPlan || result?.plan;
    if (!plan && !result) return "";

    const xpBefore = formatPreviewValue(result?.xpBefore ?? plan?.xpBefore);
    const xpAfter = formatPreviewValue(result?.xpAfter ?? plan?.xpAfter);
    const creditsBefore = formatPreviewValue(result?.creditsBefore ?? plan?.creditsBefore);
    const creditsAfter = formatPreviewValue(result?.creditsAfter ?? plan?.creditsAfter);
    const statusLabel = result?.applied ? "applied" : result?.skippedReason || plan?.skippedReason || "dry-run";
    const writesEnabled = result?.progressionWritesEnabled === true || plan?.progressionWritesEnabled === true;
    const idempotencyLabel = result?.duplicateDetected || plan?.duplicateDetected
      ? "duplicate blocked"
      : result?.idempotencyReady || plan?.idempotencyReady
        ? "idempotency ready"
        : "idempotency not ready";
    const progressionWriteScope = result?.progressionWriteScope || plan?.progressionWriteScope || "allowlist";
    const allowlistLabel = progressionWriteScope === "verified"
      ? result?.playerAllowedForStagingWrite || plan?.playerAllowedForStagingWrite
        ? "verified scope"
        : "verified scope blocked"
      : result?.stagingWriteAllowlistPresent || plan?.stagingWriteAllowlistPresent
        ? result?.playerInStagingWriteAllowlist || plan?.playerInStagingWriteAllowlist
          ? "allow-listed"
          : "not allow-listed"
        : "allow-list missing";
    const warning = result?.applied
      ? "STAGING SERVER WRITE"
      : writesEnabled
        ? "writes enabled but fail-closed"
        : "writes disabled";
    return `${statusLabel} / ${idempotencyLabel} / ${allowlistLabel} / XP ${xpBefore} -> ${xpAfter} / C ${creditsBefore} -> ${creditsAfter} / ${warning}`;
  }

  function getStagingXpRefreshLabel(status) {
    const refresh = status?.lastStagingXpRefresh;
    if (!refresh) return "";
    const trusted = formatPreviewValue(refresh.trustedXpAfter);
    const local = formatPreviewValue(refresh.localXp);
    const cloud = formatPreviewValue(refresh.refreshXp ?? refresh.cloudXp);
    const applied = formatPreviewValue(refresh.appliedXp);
    const hud = formatPreviewValue(refresh.hudXpAfterPatch ?? refresh.appliedXp);
    const redraw = refresh.redrawTriggered ? "redraw yes" : "redraw pending";
    const match = refresh.matched ? "matched" : refresh.stale ? "stale guarded" : "pending";
    return `${refresh.source || "xp"} / ${match} / local ${local} / cloud ${cloud} / trusted ${trusted} / applied ${applied} / hud ${hud} / ${redraw} / ${refresh.reason || refresh.status || "unknown"}`;
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

  function getPilotNameList(players = []) {
    const names = [];
    const seen = new Set();
    players.forEach((player) => {
      const name = String(player.displayName || player.name || player.playerName || player.id || "").trim();
      if (!name || seen.has(name.toLowerCase())) return;
      seen.add(name.toLowerCase());
      names.push(name);
    });
    return names.length ? names.slice(0, 8).join(", ") : "none";
  }

  function getPresenceStatusLabel(status = {}) {
    const presenceStatus = String(status.presenceStatus || status.localPresenceStatus || "").trim() || "space";
    const node = getCurrentNodeName() || "unknown";
    return `${presenceStatus} / ${node}`;
  }

  function getLastChatSendLabel(status = {}) {
    const chat = status.lastChatSend;
    if (!chat) return status.isConnected ? "ready / no sends yet" : "unavailable while disconnected";
    const state = chat.ok ? "sent" : "blocked";
    const reason = String(chat.reason || "").trim();
    const length = Math.max(0, Math.round(Number(chat.length || 0)));
    return `${state} / ${chat.channel || "sector"} / ${length} chars${reason ? ` / ${reason}` : ""}`;
  }

  function getBotRewardReceiptLabel(status = {}) {
    const receipt = status.lastBotRewardReceipt;
    if (!receipt) return "none";
    const botName = String(receipt.botName || "bot").slice(0, 28);
    const xpId = String(receipt.botXpSourceEventId || receipt.rewardPreviewId || "").replace(/^staging_bot_xp:/, "").slice(0, 26);
    const bounty = receipt.bountyProgress
      ? ` / bounty ${Math.round(Number(receipt.bountyProgress.progress || 0))}/${Math.round(Number(receipt.bountyProgress.requiredKills || 0))}`
      : "";
    return `${botName} / XP event ${xpId || "pending"}${bounty}`;
  }

  function canShowStagingTestFire(status, selectedBot) {
    return isStagingMode(status) &&
      !!status?.enabled &&
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

    // Intent-only staging combat path. The server resolves weapon damage,
    // cooldown, bot health, rewards, and shared shot events.
    getClient()?.sendSelectedStagingBotCombatIntent?.({
      targetBotId: selectedBot.id,
      currentNode: getCurrentNodeName(),
      timestamp: Date.now()
    });
  }

  function refreshDiagnosticsPresence(status = {}) {
    const client = getClient();
    if (!client?.sendMovementIntent) return;
    client.sendMovementIntent({
      currentNode: getCurrentNodeName(),
      presenceStatus: status.presenceStatus || "space",
      reason: "debug_presence_refresh"
    });
    scheduleRender();
  }

  function reconnectDiagnosticsClient() {
    const client = getClient();
    if (!client?.disconnect || !client?.connect) return;
    client.disconnect();
    global.setTimeout(() => {
      client.connect?.();
      scheduleRender();
    }, 120);
    scheduleRender();
  }

  function canClaimRewardPreview(status, selectedBot = null) {
    return isStagingMode(status) &&
      !!status?.enabled &&
      !!status?.isConnected &&
      !!status?.lastRewardPreview?.botId &&
      (!selectedBot?.id || status.lastRewardPreview.botId === selectedBot.id) &&
      status.lastRewardPreview.applied !== true;
  }

  function sendStagingRewardPreviewClaim(status) {
    if (!canClaimRewardPreview(status)) return;

    // Staging-only reward flow simulation. This does not call real XP,
    // credits, inventory, bounty, save, Supabase, or notification systems.
    getClient()?.claimStagingRewardPreview?.({
      botId: status.lastRewardPreview.botId,
      rewardPreviewId: status.lastRewardPreview.rewardPreviewId || ""
    });
  }

  function getLupenShardPreviewItem(status) {
    const items = Array.isArray(status?.lastRewardPreview?.lootPreview?.items)
      ? status.lastRewardPreview.lootPreview.items
      : [];
    return items.find((item) => item.lootId === "preview:lupenShard" || item.lootId === "lupenShard") || null;
  }

  function isLootClaimResultForBot(status, selectedBot) {
    return !!selectedBot?.id && status?.lastStagingLootClaimResult?.botId === selectedBot.id;
  }

  function canClaimStagingLoot(status, selectedBot = null) {
    return canClaimRewardPreview(status, selectedBot) &&
      !!getLupenShardPreviewItem(status) &&
      isLootPreviewEligibleForSelf(status, status.lastRewardPreview);
  }

  function sendStagingLootClaim(status) {
    if (!canClaimStagingLoot(status)) return;
    const item = getLupenShardPreviewItem(status);

    // Staging-only material claim. This goes through Colyseus gates and never
    // calls local inventory, reward, bounty, save, or notification systems.
    getClient()?.claimStagingLoot?.({
      botId: status.lastRewardPreview.botId,
      rewardPreviewId: status.lastRewardPreview.rewardPreviewId || "",
      lootId: item?.lootId || "preview:lupenShard"
    });
  }

  function formatTradeNumber(value) {
    const number = Math.round(Number(value || 0));
    return Number.isFinite(number) ? number.toLocaleString("en-US") : "0";
  }

  function getTradeOffers(status) {
    return Array.isArray(status?.lastStagingTradeOffers?.offers)
      ? status.lastStagingTradeOffers.offers
      : [];
  }

  function getSelectedTradeOffer(status) {
    const offers = getTradeOffers(status);
    if (!offers.length) return null;
    if (!stagingTradeOfferId || !offers.some((offer) => offer.offerId === stagingTradeOfferId)) {
      stagingTradeOfferId = offers[0].offerId;
    }
    return offers.find((offer) => offer.offerId === stagingTradeOfferId) || offers[0] || null;
  }

  function requestStagingTradeOffersIfNeeded(status) {
    if (!isStagingMode(status) || !status?.enabled || !status?.isConnected) {
      stagingTradeOffersRequested = false;
      return;
    }

    if (getTradeOffers(status).length || stagingTradeOffersRequested) return;
    stagingTradeOffersRequested = true;
    getClient()?.requestStagingTradeOffers?.();
  }

  function requestStagingTradePreview(status) {
    const offer = getSelectedTradeOffer(status);
    if (!offer?.offerId) return;

    // Staging-only trade preview. This does not call real trade terminal buy,
    // sell, cargo, credit, save, Supabase, inventory, or economy systems.
    getClient()?.requestStagingTradePreview?.({
      offerId: offer.offerId,
      quantity: stagingTradeQuantity
    });
  }

  function getTradeValidationLabel(result) {
    if (!result) return "";
    if (result.validationMode === "unknown") return "Price preview only - player state unavailable";
    if (result.wouldPass) return "Would pass dry-run validation";
    if (result.blockReason === "insufficient_credits") return "Blocked: not enough credits";
    if (result.blockReason === "insufficient_cargo") return "Blocked: not enough cargo space";
    if (result.blockReason === "invalid_quantity") return "Blocked: invalid quantity";
    return `Blocked: ${result.blockReason || result.reason || "validation failed"}`;
  }

  function getTradeValidationSourceLabel(result) {
    if (!result) return "";
    if (result.validationMode === "trusted_save") {
      return result.snapshotUsed
        ? "Validated from trusted save + client capacity snapshot"
        : "Validated from trusted save";
    }
    if (result.validationMode === "snapshot") return "Validated from client snapshot";
    return "Price preview only - player state unavailable";
  }

  function getTradeStateSourceSummary(result) {
    const sources = result?.stateSources || {};
    return `credits ${sources.credits || "unknown"} / cargo ${sources.cargoUsed || "unknown"} / capacity ${sources.cargoCapacity || "unknown"}`;
  }

  function renderStagingTradePanel(status) {
    removeStagingTradePanel();
    if (!isStagingMode(status) || !status?.enabled || !status?.isConnected || !isMpDebugEnabled()) return;

    ensureStyles();
    requestStagingTradeOffersIfNeeded(status);

    const offers = getTradeOffers(status);
    const selectedOffer = getSelectedTradeOffer(status);
    const result = status?.lastStagingTradePreview;

    const panel = global.document.createElement("div");
    panel.id = stagingTradePanelId;
    panel.setAttribute("aria-label", "Debug staging trade preview");

    const inner = global.document.createElement("div");
    inner.className = "lupen-mp-trade-inner";

    const title = global.document.createElement("strong");
    title.textContent = "Debug Preview Only";
    inner.appendChild(title);

    const controls = global.document.createElement("div");
    controls.className = "lupen-mp-trade-controls";

    const select = global.document.createElement("select");
    select.disabled = !offers.length;
    offers.forEach((offer) => {
      const option = global.document.createElement("option");
      option.value = offer.offerId;
      option.textContent = `${offer.resourceName} / ${offer.buyNode} -> ${offer.sellNode}`;
      if (offer.offerId === selectedOffer?.offerId) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener("change", () => {
      stagingTradeOfferId = select.value;
      scheduleRender();
    });
    controls.appendChild(select);

    const quantity = global.document.createElement("input");
    quantity.type = "number";
    quantity.min = "1";
    quantity.max = "999";
    quantity.step = "1";
    quantity.value = String(stagingTradeQuantity);
    quantity.disabled = !selectedOffer;
    quantity.addEventListener("change", () => {
      stagingTradeQuantity = Math.max(1, Math.min(999, Math.round(Number(quantity.value || 1))));
      scheduleRender();
    });
    controls.appendChild(quantity);

    const previewButton = global.document.createElement("button");
    previewButton.type = "button";
    previewButton.textContent = offers.length ? "Preview" : "Load";
    previewButton.disabled = !offers.length && stagingTradeOffersRequested;
    previewButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!offers.length) {
        stagingTradeOffersRequested = false;
        requestStagingTradeOffersIfNeeded(status);
        return;
      }
      requestStagingTradePreview(status);
    });
    controls.appendChild(previewButton);
    inner.appendChild(controls);

    if (selectedOffer) {
      const route = global.document.createElement("div");
      route.className = "lupen-mp-trade-route";
      route.textContent = `${selectedOffer.resourceName}: CR ${formatTradeNumber(selectedOffer.buyPrice)} buy / CR ${formatTradeNumber(selectedOffer.sellPrice)} sell / max ${formatTradeNumber(selectedOffer.maxQuantity)}`;
      inner.appendChild(route);
    }

    if (result?.offerId) {
      const resultBox = global.document.createElement("div");
      resultBox.className = "lupen-mp-trade-result";
      const lines = result.ok
        ? [
          `${result.resourceName} x${formatTradeNumber(result.quantity)} / ${result.buyNode} -> ${result.sellNode}`,
          `Cost CR ${formatTradeNumber(result.totalCost)} / Revenue CR ${formatTradeNumber(result.projectedRevenue)}`,
          `Projected profit CR ${formatTradeNumber(result.projectedProfit)}`,
          getTradeValidationSourceLabel(result),
          getTradeValidationLabel(result),
          result.validationMode !== "unknown"
            ? `Credits CR ${formatTradeNumber(result.creditsAvailable)} / Cargo ${formatTradeNumber(result.cargoUsed)} used, ${formatTradeNumber(result.cargoFree)} free`
            : "Credits/cargo unavailable",
          result.validationMode !== "unknown"
            ? `Max affordable ${formatTradeNumber(result.maxAffordableQuantity)} / Max cargo ${formatTradeNumber(result.maxCargoQuantity)} / Max valid ${formatTradeNumber(result.maxValidQuantity)}`
            : "Max valid quantity unknown"
        ]
        : [
          getTradeValidationLabel(result),
          result.userReason || result.reason || "No trade data changed.",
          isMpDebugEnabled() ? (result.debugReason || "No debug detail") : "Dry-run only - no write attempted"
        ];
      lines.forEach((line) => {
        const row = global.document.createElement("span");
        row.textContent = line;
        resultBox.appendChild(row);
      });
      inner.appendChild(resultBox);
    }

    const note = global.document.createElement("div");
    note.className = "lupen-mp-trade-note";
    note.textContent = "Debug preview only - no credits, cargo, inventory, saves, bounties, loot, or economy changed.";
    inner.appendChild(note);

    panel.appendChild(inner);
    global.document.body.appendChild(panel);
  }

  function renderStatusChip(status) {
    removeStatusChip();
    if (!isStagingMode(status) || !status?.enabled) return;

    ensureStyles();

    const chip = global.document.createElement("div");
    chip.id = statusChipId;
    if (status.isConnected) chip.classList.add("is-connected");
    chip.setAttribute("aria-hidden", "true");

    const dot = global.document.createElement("i");
    chip.appendChild(dot);

    const label = global.document.createElement("span");
    label.textContent = status.isConnected ? "Multiplayer Staging" : status.isConnecting ? "Staging Connecting" : "Staging Offline";
    chip.appendChild(label);

    const room = global.document.createElement("em");
    room.textContent = status.roomName || "";
    chip.appendChild(room);

    global.document.body.appendChild(chip);
  }

  function getStagingFlowHint(status, selectedBot, players, bots) {
    const loop = "Trade for CR -> Store upgrades -> Launch -> Engage bots -> Claim bounty XP.";

    if (!status?.isConnected) {
      return `Connecting to Multiplayer Staging. ${loop}`;
    }

    if (!bots.length) {
      return `Waiting for server-owned targets. ${loop}`;
    }

    if (!selectedBot?.id) {
      const pilotText = players.length ? `${players.length} remote pilot${players.length === 1 ? "" : "s"} connected. ` : "";
      return `${pilotText}${loop} No PvP; engaged bots return fire locally.`;
    }

    if (selectedBot.disabled) {
      return status?.lastRewardPreview?.botId === selectedBot.id
        ? "Target destroyed. XP applied. Claim bounty XP from the Bounty Board when ready."
        : "Target destroyed. Waiting for the server to respawn it.";
    }

    const cooldown = Math.max(0, Number(status.fireCooldownRemainingMs || 0));
    if (cooldown > 0) {
      return `Weapons cooling: ${formatCooldown(cooldown)}.`;
    }

    return "Target locked. Engage starts auto-fire; Disengage stops it.";
  }

  function renderStagingFlowHint(status, selectedBot, players, bots) {
    removeStagingFlowHint();
    if (!isStagingMode(status) || !status?.enabled || isMpDebugEnabled() || isStagingFlowHintDismissed()) return;

    ensureStyles();

    const hint = global.document.createElement("div");
    hint.id = stagingFlowHintId;
    hint.setAttribute("aria-label", "Multiplayer staging loop");

    const closeButton = global.document.createElement("button");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Hide staging loop guide");
    closeButton.textContent = "x";
    closeButton.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      dismissStagingFlowHint();
    });
    hint.appendChild(closeButton);

    const title = global.document.createElement("strong");
    title.textContent = "Multiplayer Staging Loop";
    hint.appendChild(title);

    const text = global.document.createElement("span");
    text.textContent = getStagingFlowHint(status, selectedBot, players, bots);
    hint.appendChild(text);

    const note = global.document.createElement("span");
    note.className = "lupen-mp-flow-note";
    note.textContent = "Trade, Store, loadout, combat XP, and bounty XP are live for staging. No PvP; engaged bots return fire locally.";
    hint.appendChild(note);

    global.document.body.appendChild(hint);
  }

  function addDiagnosticsActions(panel, status, selectedBot) {
    if (!status?.enabled && !canShowStagingTestFire(status, selectedBot) && typeof global.lupenDebugGrantTestFunds !== "function") return;

    const actions = global.document.createElement("div");
    actions.className = "lupen-mp-diagnostics-actions";

    if (status?.enabled) {
      const refreshButton = global.document.createElement("button");
      refreshButton.type = "button";
      refreshButton.className = "lupen-mp-test-fire-button";
      refreshButton.textContent = "Refresh Presence";
      refreshButton.title = "Send the current node and presence status to the multiplayer room.";
      refreshButton.disabled = !status.isConnected;
      refreshButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        refreshDiagnosticsPresence(status);
      });
      actions.appendChild(refreshButton);

      const reconnectButton = global.document.createElement("button");
      reconnectButton.type = "button";
      reconnectButton.className = "lupen-mp-test-fire-button";
      reconnectButton.textContent = status.isConnected ? "Reconnect" : "Connect";
      reconnectButton.title = "Reconnect the multiplayer client and request fresh room state.";
      reconnectButton.disabled = status.isConnecting === true;
      reconnectButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        reconnectDiagnosticsClient();
      });
      actions.appendChild(reconnectButton);
    }

    if (typeof global.lupenDebugGrantTestFunds === "function") {
      const grantButton = global.document.createElement("button");
      grantButton.type = "button";
      grantButton.className = "lupen-mp-test-fire-button";
      grantButton.textContent = "Grant Test Funds";
      grantButton.title = "Staging/debug only: set CR 1,000,000, LC 100, and LS 1,000 for the current save.";
      grantButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        global.lupenDebugGrantTestFunds();
        scheduleRender();
      });
      actions.appendChild(grantButton);

      const smallGrantButton = global.document.createElement("button");
      smallGrantButton.type = "button";
      smallGrantButton.className = "lupen-mp-test-fire-button";
      smallGrantButton.textContent = "+Small Funds";
      smallGrantButton.title = "Staging/debug only: add CR 100,000, LC 10, and LS 100 to the current save.";
      smallGrantButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        global.lupenDebugGrantTestFunds({ small: true });
        scheduleRender();
      });
      actions.appendChild(smallGrantButton);
    }

    if (canShowStagingTestFire(status, selectedBot)) {
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
    }
    panel.appendChild(actions);
  }

  function getPercent(current, max) {
    const currentValue = Math.max(0, Number(current || 0));
    const maxValue = Math.max(1, Number(max || 1));
    return Math.max(0, Math.min(100, Math.round((currentValue / maxValue) * 100)));
  }

  function createStagingCombatBar(label, current, max, fillClass) {
    const row = global.document.createElement("div");
    row.className = "lupen-mp-staging-bar";

    const labelNode = global.document.createElement("span");
    labelNode.textContent = label;
    row.appendChild(labelNode);

    const track = global.document.createElement("span");
    track.className = "lupen-mp-staging-bar-track";
    const fill = global.document.createElement("i");
    fill.className = `lupen-mp-staging-bar-fill ${fillClass}`;
    fill.style.width = `${getPercent(current, max)}%`;
    track.appendChild(fill);
    row.appendChild(track);

    const value = global.document.createElement("em");
    value.textContent = `${Math.round(Number(current || 0))}/${Math.round(Number(max || 0))}`;
    row.appendChild(value);

    return row;
  }

  function createCompactHealthBars(entity) {
    const bars = global.document.createElement("div");
    bars.className = "lupen-mp-space-bot-bars";

    [["shield", entity.shield, entity.shieldMax], ["hull", entity.hull, entity.hullMax]].forEach(([type, current, max]) => {
      const track = global.document.createElement("span");
      track.className = "lupen-mp-space-bot-bar";
      const fill = global.document.createElement("i");
      fill.className = `lupen-mp-space-bot-bar-fill ${type}`;
      fill.style.width = `${getPercent(current, max)}%`;
      track.appendChild(fill);
      bars.appendChild(track);
    });

    return bars;
  }

  function renderStagingCombatPanel(status, selectedBot) {
    removeStagingCombatPanel();
    if (!canShowStagingTestFire(status, selectedBot) || !isMpDebugEnabled()) return;

    const spaceScreen = global.document?.getElementById("spaceScreen");
    if (!spaceScreen) return;

    ensureStyles();

    const panel = global.document.createElement("div");
    panel.id = stagingCombatPanelId;
    panel.setAttribute("aria-label", "Staging combat test controls");
    if (selectedBot.disabled) panel.classList.add("is-destroyed");

    const inner = global.document.createElement("div");
    inner.className = "lupen-mp-staging-combat-inner";

    const summary = global.document.createElement("div");
    const kicker = global.document.createElement("span");
    kicker.className = "lupen-mp-staging-combat-kicker";
    if (selectedBot.disabled) kicker.classList.add("is-destroyed");
    kicker.textContent = selectedBot.disabled ? "TARGET DESTROYED" : "TARGET LOCKED";
    summary.appendChild(kicker);

    const title = global.document.createElement("strong");
    title.textContent = getBotLabel(selectedBot);
    summary.appendChild(title);

    const state = global.document.createElement("span");
    state.className = "lupen-mp-staging-state";
    if (selectedBot.disabled) state.classList.add("is-destroyed");
    state.textContent = selectedBot.disabled ? "DESTROYED" : "LOCKED";
    summary.appendChild(state);

    const note = global.document.createElement("small");
    const cooldownText = formatCooldown(status.fireCooldownRemainingMs);
    const weaponIntent = getClient()?.getStagingWeaponIntent?.() || {};
    const weaponName = status.lastCombatResponse?.weaponName || weaponIntent.weaponName || "Equipped Weapon";
    const stagingDamage = status.lastCombatResponse?.serverDamageUsed || status.lastCombatResponse?.stagingDamage || weaponIntent.damage || 5;
    const weaponKey = status.lastCombatResponse?.weaponKey || weaponIntent.weaponKey || weaponIntent.equippedWeaponKey || "";
    const sourceText = status.lastCombatResponse?.damageSource
      ? ` / ${status.lastCombatResponse.damageSource}${status.lastCombatResponse.fallbackDamageUsed ? " fallback" : ""}`
      : weaponKey
        ? ` / key ${weaponKey}`
        : "";
    const lastDamage = status.lastCombatResponse?.ok && status.lastCombatResponse.targetBotId === selectedBot.id
      ? ` / last -${Math.round(Number(status.lastCombatResponse.damage || 0))}`
      : "";
    note.textContent = selectedBot.disabled
      ? "Server disabled state - no rewards applied"
      : `${weaponName}${weaponKey ? ` (${weaponKey})` : ""} / server dmg ${Math.round(Number(stagingDamage || 0))}${sourceText} / ${cooldownText}${lastDamage}`;
    summary.appendChild(note);
    inner.appendChild(summary);

    const button = global.document.createElement("button");
    button.type = "button";
    button.className = "lupen-mp-staging-fire";
    button.textContent = selectedBot.disabled
      ? "Disabled"
      : Math.max(0, Number(status.fireCooldownRemainingMs || 0)) > 0
        ? `Cooldown ${formatCooldown(status.fireCooldownRemainingMs)}`
        : "Staging Fire";
    button.disabled = !canSendStagingTestFire(status, selectedBot);
    button.title = "Staging-only server test damage. No real combat or rewards.";
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      sendStagingTestFire(selectedBot);
    });
    inner.appendChild(button);

    requestRewardPanelXpRefresh(status, selectedBot);

    if (canClaimStagingLoot(status, selectedBot)) {
      const lootResult = isLootClaimResultForBot(status, selectedBot) ? status.lastStagingLootClaimResult : null;
      const lootGate = lootResult?.gates || {};
      const lootWriteBlocked = !!lootResult && !lootResult.applied &&
        (lootGate.writeEnabled === false || lootGate.dryRun !== false || lootGate.playerAllowed === false || lootResult.ok === false);
      const lootButton = global.document.createElement("button");
      lootButton.type = "button";
      lootButton.className = "lupen-mp-staging-fire";
      lootButton.textContent = lootResult?.applied
        ? "Shard Claimed"
        : lootResult?.duplicateDetected
          ? "Shard Claimed"
          : lootWriteBlocked
            ? "Preview Only"
            : "Preview Shard";
      lootButton.title = lootWriteBlocked
        ? `Lupen Shard write disabled or blocked in staging: ${getFriendlyClaimReason(lootResult?.reason)}.`
        : "Preview the staging-only Lupen Shard material claim. No equipment, credits, bounties, or broad inventory writes.";
      lootButton.disabled = lootResult?.applied === true || lootResult?.duplicateDetected === true || lootWriteBlocked;
      lootButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        if (lootButton.disabled) return;
        sendStagingLootClaim(status);
      });
      inner.appendChild(lootButton);
    }

    const combatMessage = getCombatPanelMessage(status, selectedBot);
    const message = global.document.createElement("div");
    message.className = "lupen-mp-staging-message";
    if (combatMessage.tone) message.classList.add(`is-${combatMessage.tone}`);
    message.textContent = combatMessage.text;
    inner.appendChild(message);

    const bars = global.document.createElement("div");
    bars.className = "lupen-mp-staging-bars";
    bars.appendChild(createStagingCombatBar("Shield", selectedBot.shield, selectedBot.shieldMax, "lupen-mp-staging-shield"));
    bars.appendChild(createStagingCombatBar("Hull", selectedBot.hull, selectedBot.hullMax, "lupen-mp-staging-hull"));
    inner.appendChild(bars);

    const rewardLines = isMpDebugEnabled()
      ? [
        ...getRewardPreviewPanelLines(status, selectedBot),
        ...getLootPreviewPanelLines(status, selectedBot)
      ]
      : getCompactRewardPreviewPanelLines(status, selectedBot);
    if (rewardLines.length) {
      const reward = global.document.createElement("div");
      reward.className = "lupen-mp-staging-reward";
      const rewardTitle = global.document.createElement("b");
      rewardTitle.textContent = "Reward Preview Only - Not Applied";
      reward.appendChild(rewardTitle);
      rewardLines.forEach((line) => {
        const row = global.document.createElement("span");
        row.textContent = line;
        reward.appendChild(row);
      });
      inner.appendChild(reward);
    }

    const claimLabel = getClaimPanelLabel(status, selectedBot);
    if (claimLabel) {
      const claim = global.document.createElement("div");
      claim.className = "lupen-mp-staging-claim";
      claim.textContent = claimLabel;
      inner.appendChild(claim);
    }

    const lootClaimLabel = getLootClaimPanelLabel(status, selectedBot);
    if (lootClaimLabel) {
      const lootClaim = global.document.createElement("div");
      lootClaim.className = "lupen-mp-staging-claim";
      lootClaim.textContent = lootClaimLabel;
      inner.appendChild(lootClaim);
    }

    panel.appendChild(inner);
    spaceScreen.appendChild(panel);
  }

  function getActiveStagingBounty(status) {
    return status?.lastStagingBountyStatus?.active ||
      status?.lastStagingBountyList?.active ||
      status?.lastStagingBountyList?.bounties?.[0] ||
      null;
  }

  function getStagingBountyClaimLabel(status) {
    const result = status?.lastStagingBountyClaimResult;
    if (!result) return "";
    const bounty = result.bounty || {};
    const xp = Math.round(Number(result.xpDelta || bounty.xpReward || 0));
    if (result.applied || result.playerSavePatchResult?.applied || result.playerSave?.written) {
      const before = result.playerSavePatchResult?.xpBefore ?? result.playerSave?.xpBefore;
      const after = result.playerSavePatchResult?.xpAfter ?? result.playerSave?.xpAfter;
      applyStagingXpFromRenderedResult({
        ...result,
        xpBefore: before,
        xpAfter: after,
        applied: true,
        saveWritten: true
      }, "bountyClaim");
      return `XP applied ${formatPreviewValue(before)} -> ${formatPreviewValue(after)}. No credits or loot.`;
    }
    if (result.reason === "staging_bounty_already_claimed") return "Already claimed. Duplicate reward blocked.";
    if (result.mode === "blocked" || result.ok === false) return `Blocked: ${getFriendlyClaimReason(result.debugReason || result.reason)}.`;
    return `Simulated: +${xp} XP preview. No credits or loot.`;
  }

  function requestStagingBountyIfNeeded(status) {
    if (!isStagingMode(status) || !status?.enabled || !status?.isConnected) {
      stagingBountyRequested = false;
      return;
    }
    const client = getClient();
    if (!client?.requestStagingBounties) return;
    if (stagingBountyRequested && (status.lastStagingBountyList || status.lastStagingBountyStatus)) return;
    stagingBountyRequested = true;
    client.requestStagingBounties();
    client.requestStagingBountyStatus?.();
  }

  function renderStagingBountyPanel(status) {
    removeStagingBountyPanel();
    requestStagingBountyIfNeeded(status);
    if (!isStagingMode(status) || !status?.enabled || !status?.isConnected) return;
    if (!isMpDebugEnabled()) return;

    const spaceScreen = global.document?.getElementById("spaceScreen");
    if (!spaceScreen) return;

    const bounty = getActiveStagingBounty(status);
    if (!bounty?.id) return;

    ensureStyles();

    const panel = global.document.createElement("div");
    panel.id = stagingBountyPanelId;
    panel.setAttribute("aria-label", "Staging bounty objective");

    const inner = global.document.createElement("div");
    inner.className = "lupen-mp-bounty-inner";

    const kicker = global.document.createElement("div");
    kicker.className = "lupen-mp-bounty-kicker";
    kicker.textContent = "STAGING BOUNTY";
    inner.appendChild(kicker);

    const title = global.document.createElement("strong");
    title.textContent = bounty.title || "Erebus Patrol Sweep";
    inner.appendChild(title);

    const objective = global.document.createElement("span");
    objective.textContent = bounty.accepted
      ? `Progress: ${Math.round(Number(bounty.progress || 0))}/${Math.round(Number(bounty.requiredKills || 2))} staging Erebus bots`
      : "Destroy 2 staging Erebus bots";
    inner.appendChild(objective);

    const progress = global.document.createElement("div");
    progress.className = "lupen-mp-bounty-progress";
    const fill = global.document.createElement("i");
    fill.style.width = `${getPercent(Number(bounty.progress || 0), Number(bounty.requiredKills || 2))}%`;
    progress.appendChild(fill);
    inner.appendChild(progress);

    const reward = global.document.createElement("span");
    reward.textContent = `XP-only reward: ${Math.round(Number(bounty.xpReward || 0))}. No CR or loot.`;
    inner.appendChild(reward);

    const claimLabel = getStagingBountyClaimLabel(status);
    if (claimLabel) {
      const result = global.document.createElement("span");
      result.textContent = claimLabel;
      inner.appendChild(result);
    }

    const boardHint = global.document.createElement("span");
    boardHint.textContent = bounty.claimAvailable || bounty.completed
      ? "Ready to claim from Bounty Board."
      : bounty.accepted
        ? "Server progress only; local bounties stay untouched."
        : "Accept from Bounty Board; no local bounty writes.";
    inner.appendChild(boardHint);

    panel.appendChild(inner);
    spaceScreen.appendChild(panel);
  }

  function renderDiagnostics(players, bots, resources = []) {
    removeDiagnosticsPanel();
    if (!isEnabled()) return;
    if (!isMpDebugEnabled()) return;

    ensureStyles();

    const status = getClient()?.getStatus?.() || {};
    const sameNodePlayers = getSameNodePlayers(players);
    const sameNodeBots = getSameNodeBots(bots);
    const sameNodeResources = resources.filter((resource) => isSameCurrentNode(resource));
    const inspectedBot = getInspectedBot(bots);
    const inspectedResource = sameNodeResources[0] || resources[0] || null;
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
    setDiagnosticsRow(panel, "presence", getPresenceStatusLabel(status));
    if (isStagingMode(status)) {
      setDiagnosticsRow(panel, "auth", `${status.authStatus || "guest"} / trusted id ${status.trustedPlayerIdPresent ? "present" : "missing"}`);
      setDiagnosticsRow(panel, "auth handoff", `session ${status.supabaseSessionPresent ? "yes" : "no"} / token sent ${status.supabaseTokenSent ? "yes" : "no"} / verify ${status.supabaseTokenVerificationAttempted ? "yes" : "no"} / wait ${status.supabaseSessionWaitTimedOut ? "timed out" : "ok"}`);
      if (status.supabaseTokenVerificationReason) {
        setDiagnosticsRow(panel, "auth reason", String(status.supabaseTokenVerificationReason).slice(0, 42));
      }
      setDiagnosticsRow(panel, "identity", String(status.displayName || "Pilot").slice(0, 24));
    }
    setDiagnosticsRow(panel, "remote pilots", `${players.length} total / ${sameNodePlayers.length} same node`);
    setDiagnosticsRow(panel, "online names", getPilotNameList(getClient()?.getPlayers?.({ includeSelf: true }) || players));
    setDiagnosticsRow(panel, "chat send", getLastChatSendLabel(status));
    if (isStagingMode(status)) {
      const firstRemote = players[0] || {};
      const remoteShipImage = getSafeShipImageSrc(firstRemote);
      setDiagnosticsRow(panel, "local ship id", String(status.localShipId || "missing").slice(0, 32));
      setDiagnosticsRow(panel, "local ship img", compactPath(status.localShipImage));
      setDiagnosticsRow(panel, "remote ship id", String(firstRemote.currentShipId || "missing").slice(0, 32));
      setDiagnosticsRow(panel, "remote ship img", compactPath(remoteShipImage));
      setDiagnosticsRow(panel, "remote img status", getShipImageLoadLabel(firstRemote));
      setDiagnosticsRow(panel, "remote ships", getShipImageStatus(players));
    }
    setDiagnosticsRow(panel, isStagingMode(status) ? "staging bots" : "dev bots", `${bots.length} total / ${sameNodeBots.length} same node`);
    if (isStagingMode(status)) {
      setDiagnosticsRow(panel, "resources", `${resources.length} total / ${sameNodeResources.length} same node`);
      setDiagnosticsRow(panel, "resource inspect", getResourceHealthSummary(inspectedResource));
      if (status.lastStagingResourceEvent) {
        const event = status.lastStagingResourceEvent;
        const action = String(event.type || "resource").replace("stagingResource:", "");
        setDiagnosticsRow(panel, "resource event", `${action} / ${event.resourceName || "Resource"} / +${Math.round(Number(event.cargoDelta || 0))}`);
      }
    }
    setDiagnosticsRow(panel, "bot update", formatRelativeAge(status.lastBotUpdateAt));
    if (isStagingMode(status)) {
      const weaponIntent = getClient()?.getStagingWeaponIntent?.() || {};
      setDiagnosticsRow(panel, "bot layer", "server-owned visual");
      setDiagnosticsRow(panel, "selected bot", getBotInspectionLabel(selectedBot));
      setDiagnosticsRow(panel, "inspect bot", getBotInspectionLabel(inspectedBot));
      setDiagnosticsRow(panel, "bot node", getBotLayerSummary(inspectedBot));
      setDiagnosticsRow(panel, "bot status", getBotHullSummary(inspectedBot));
      setDiagnosticsRow(panel, "bot image", compactPath(getStagingBotImage(inspectedBot)));
      setDiagnosticsRow(panel, "bot img status", `${getBotImageLoadLabel(inspectedBot)} / fallback ${isBotFallbackActive(inspectedBot) ? "yes" : "no"}`);
      const weaponKey = status.lastCombatResponse?.weaponKey || status.localEquippedWeaponKey || weaponIntent.weaponKey || weaponIntent.equippedWeaponKey || "";
      const damageSource = status.lastCombatResponse?.damageSource || status.weaponSourceReason || "pending";
      const serverDamage = status.lastCombatResponse?.serverDamageUsed ?? status.lastCombatResponse?.stagingDamage ?? weaponIntent.damage ?? 0;
      const localWeaponCount = Array.isArray(weaponIntent.equippedWeaponKeys) ? weaponIntent.equippedWeaponKeys.length : 0;
      const activeShipWeaponCount = Math.max(0, Math.round(Number(status.activeShipWeaponCount || localWeaponCount || 0)));
      const validCombatWeaponCount = Math.max(0, Math.round(Number(status.validCombatWeaponCount || 0)));
      const rejectedWeaponCount = Math.max(0, Math.round(Number(status.rejectedWeaponCount || 0)));
      const combatIntentReason = status.combatIntentReason || status.lastCombatResponse?.validation || status.lastCombatResponse?.reason || "pending";
      const lockOnReason = selectedBot?.id
        ? "locked"
        : status.lockOnClearReason
          ? `cleared / ${status.lockOnClearReason}`
          : "pending";
      const playerClientNode = status.playerClientNode || getCurrentNodeName() || "unknown";
      const playerServerNode = status.playerServerNode || "unknown";
      const selectedBotNode = status.selectedBotNode || selectedBot?.currentNode || "none";
      const botServerNode = status.botServerNode || selectedBot?.currentNode || inspectedBot?.currentNode || "unknown";
      const botVisualNode = status.botVisualNode || selectedBot?.currentNode || inspectedBot?.currentNode || "unknown";
      const combatIntentNode = status.combatIntentNode || status.lastCombatResponse?.combatIntentNode || "pending";
      setDiagnosticsRow(panel, "weapon", `${status.lastCombatResponse?.weaponName || weaponIntent.weaponName || "unknown"}${weaponKey ? ` / ${weaponKey}` : ""} / server dmg ${Math.round(Number(serverDamage || 0))}`);
      setDiagnosticsRow(panel, "weapon source", `${damageSource} / fallback ${status.lastCombatResponse?.fallbackDamageUsed ? "yes" : "no"} / pulse ${status.lastCombatResponse?.pulseLaserDetected ? "yes" : "no"}`);
      setDiagnosticsRow(panel, "combat intent", `${status.lastCombatResponse?.ok ? "resolved" : "pending/rejected"} / ${String(combatIntentReason).slice(0, 48)}`);
      setDiagnosticsRow(panel, "lock-on", String(lockOnReason).slice(0, 56));
      setDiagnosticsRow(panel, "node compare", String(status.nodeCompareResult || "pending").slice(0, 56));
      setDiagnosticsRow(panel, "player nodes", `client ${playerClientNode} / server ${playerServerNode}`);
      setDiagnosticsRow(panel, "bot nodes", `sel ${selectedBotNode} / server ${botServerNode} / visual ${botVisualNode}`);
      setDiagnosticsRow(panel, "intent node", String(combatIntentNode).slice(0, 56));
      if (status.combatNodeValidationReason) setDiagnosticsRow(panel, "combat node", String(status.combatNodeValidationReason).slice(0, 56));
      setDiagnosticsRow(panel, "weapon count", `${activeShipWeaponCount} active / ${validCombatWeaponCount} valid / ${rejectedWeaponCount} rejected`);
      if (status.firstRejectedWeaponReason) setDiagnosticsRow(panel, "weapon reject", String(status.firstRejectedWeaponReason).slice(0, 56));
      setDiagnosticsRow(panel, "fire cooldown", formatCooldown(status.fireCooldownRemainingMs));
      setDiagnosticsRow(panel, "bot event", getLastBotEventLabel(status));
      setDiagnosticsRow(panel, "kill receipt", getBotRewardReceiptLabel(status));
      setDiagnosticsRow(panel, "shot event", getLastShotEventLabel(status));
      const returnFire = status.lastStagingReturnFire;
      const botAttackCooldown = returnFire?.nextReturnFireAt
        ? Math.max(0, Math.ceil(Number(returnFire.nextReturnFireAt || 0) - Date.now()))
        : 0;
      const botAttackStatus = selectedBot?.disabled
        ? "stopped"
        : returnFire?.botAttackStatus
          ? returnFire.botAttackStatus
          : selectedBot?.id
            ? botAttackCooldown > 0 ? "cooldown" : "ready"
            : "stopped";
      setDiagnosticsRow(panel, "bot attack", `${botAttackStatus} / ${formatCooldown(botAttackCooldown)} / dmg ${Math.round(Number(returnFire?.botDamage ?? returnFire?.damage ?? 0))}`);
      if (returnFire) {
        const shieldBefore = returnFire.playerShieldBefore ?? "?";
        const shieldAfter = returnFire.playerShieldAfter ?? "?";
        const hullBefore = returnFire.playerHullBefore ?? "?";
        const hullAfter = returnFire.playerHullAfter ?? "?";
        setDiagnosticsRow(panel, "bot damage", `${returnFire.attackerName || "bot"} / S ${shieldBefore}->${shieldAfter} / H ${hullBefore}->${hullAfter} / destroyed ${returnFire.playerDestroyed ? "yes" : "no"}`);
        if (returnFire.botAttackReason) setDiagnosticsRow(panel, "bot attack reason", String(returnFire.botAttackReason).slice(0, 56));
      }
      setDiagnosticsRow(panel, "reward preview", getRewardPreviewLabel(status));
      setDiagnosticsRow(panel, "loot preview", getLootPreviewLabel(status));
      if (status.lastStagingLootClaimResult) {
        const lootResult = status.lastStagingLootClaimResult;
        const materialDelta = lootResult.applied
          ? ` / ${formatPreviewValue(lootResult.materialBefore)} -> ${formatPreviewValue(lootResult.materialAfter)}`
          : "";
        setDiagnosticsRow(panel, "loot claim", `${lootResult.mode || "dry_run"} / applied ${lootResult.applied ? "yes" : "no"} / save ${lootResult.writes?.saveWritten ? "yes" : "no"} / ${lootResult.reason || "none"}${materialDelta}`);
        setDiagnosticsRow(panel, "loot gates", `enabled ${lootResult.gates?.writeEnabled ? "yes" : "no"} / dry ${lootResult.gates?.dryRun !== false ? "yes" : "no"} / allow ${lootResult.gates?.playerAllowed ? "yes" : "no"} / idempotency ${lootResult.idempotencyReady ? "ready" : "not ready"}`);
      }
      setDiagnosticsRow(panel, "claim preview", getRewardClaimResultLabel(status));
      const bounty = getActiveStagingBounty(status);
      if (bounty) {
        setDiagnosticsRow(panel, "bounty", `${bounty.accepted ? "accepted" : "available"} / ${Math.round(Number(bounty.progress || 0))}/${Math.round(Number(bounty.requiredKills || 0))} / claim ${bounty.claimAvailable ? "yes" : "no"}`);
      }
      if (status.lastStagingBountyClaimResult) {
        setDiagnosticsRow(panel, "bounty claim", `${status.lastStagingBountyClaimResult.mode || "unknown"} / XP +${Math.round(Number(status.lastStagingBountyClaimResult.xpDelta || 0))} / ${status.lastStagingBountyClaimResult.reason || "none"}`);
      }
      if (status.lastStagingBotXpResult) {
        const botXp = status.lastStagingBotXpResult;
        const botXpStatus = botXp.applied ? "applied" : botXp.localFallbackApplied ? "local applied" : getFriendlyBotXpReason(botXp);
        const persisted = botXp.persistenceVerified
          ? `persisted ${formatPreviewValue(botXp.persistedXp)} / zone ${formatPreviewValue(botXp.persistedZoneXp)}`
          : botXp.localFallbackApplied
            ? `local ${formatPreviewValue(botXp.localFallbackXpAfter)}`
            : botXp.botXpBlockReason || botXp.debugReason || botXp.reason || "not verified";
        const xpAfter = botXp.localFallbackApplied ? botXp.localFallbackXpAfter : botXp.xpAfter;
        setDiagnosticsRow(panel, "bot XP", `${botXp.mode || "unknown"} / XP ${formatPreviewValue(botXp.xpBefore)} -> ${formatPreviewValue(xpAfter)} / ${botXpStatus} / ${persisted}`);
      } else if (status.lastRewardPreview?.botId) {
        setDiagnosticsRow(panel, "bot XP", `preview only / XP +${Math.round(Number(status.lastRewardPreview.previewXp || 0))} / no apply result`);
      }
      const xpRefreshLabel = getStagingXpRefreshLabel(status);
      if (xpRefreshLabel) setDiagnosticsRow(panel, "XP refresh", xpRefreshLabel);
      if (status.lastRewardClaimResult) {
        const claimStatus = getClaimStatusSummary(status.lastRewardClaimResult);
        setDiagnosticsRow(panel, "claim mode", `${claimStatus.mode || "unknown"} / XP +${Math.round(Number(claimStatus.xpDelta || 0))}`);
        setDiagnosticsRow(panel, "claim gates", `verified ${claimStatus.gates?.verified ? "yes" : "no"} / allow ${claimStatus.gates?.allowlisted ? "yes" : "no"} / XP write ${claimStatus.gates?.xpWriteAllowed ? "yes" : "no"}`);
      }
      const applicationLabel = getRewardApplicationLabel(status);
      if (applicationLabel) setDiagnosticsRow(panel, "application", applicationLabel);
      const progressionPreviewLabel = getProgressionPreviewLabel(status);
      if (progressionPreviewLabel) setDiagnosticsRow(panel, "save preview", progressionPreviewLabel);
      const progressionShadowLabel = getProgressionShadowLabel(status);
      if (progressionShadowLabel) setDiagnosticsRow(panel, "shadow", progressionShadowLabel);
      const playerSavePatchLabel = getPlayerSavePatchLabel(status);
      if (playerSavePatchLabel) setDiagnosticsRow(panel, "player_saves", playerSavePatchLabel);
      const tradeOffers = getTradeOffers(status);
      const tradePreview = status.lastStagingTradePreview;
      const tradeWrite = status.lastStagingTradeWriteResult;
      setDiagnosticsRow(panel, "trade offers", `${tradeOffers.length} dry-run`);
      if (tradePreview) {
        setDiagnosticsRow(panel, "trade preview", tradePreview.ok
          ? `profit CR ${formatTradeNumber(tradePreview.projectedProfit)} / writes no`
          : `${tradePreview.reason || "blocked"} / writes no`);
        setDiagnosticsRow(panel, "trade source", `${tradePreview.validationMode || "unknown"} / trusted ${tradePreview.trustedStateAvailable ? "yes" : "no"} / snapshot ${tradePreview.snapshotUsed ? "yes" : "no"}`);
        setDiagnosticsRow(panel, "trade state", getTradeStateSourceSummary(tradePreview));
        if (tradePreview.readStatus) setDiagnosticsRow(panel, "trade read", tradePreview.readStatus);
      }
      if (tradeWrite) {
        setDiagnosticsRow(panel, "trade write", `${tradeWrite.operation || "trade"} / ${tradeWrite.mode || "dry_run"} / applied ${tradeWrite.applied ? "yes" : "no"} / writes ${tradeWrite.saveWritten ? "yes" : "no"}`);
        setDiagnosticsRow(panel, "trade gates", `verified ${tradeWrite.gates?.verified ? "yes" : "no"} / enabled ${tradeWrite.gates?.writeEnabled ? "yes" : "no"} / dry ${tradeWrite.gates?.dryRun ? "yes" : "no"}`);
        if (tradeWrite.operation === "sell") {
          const trustedCargo = tradeWrite.trustedCargo
            ? `${tradeWrite.trustedCargo.key || "cargo"} ${formatTradeNumber(tradeWrite.trustedCargo.amount)}`
            : "unknown";
          setDiagnosticsRow(panel, "sell handler", `${tradeWrite.writeHandlerUsed || "preflight"} / dryEnv ${tradeWrite.dryRunEnv ? "yes" : "no"}`);
          setDiagnosticsRow(panel, "sell validation", `${tradeWrite.sellValidationReason || tradeWrite.blockReason || tradeWrite.reason || "ok"} / basis ${tradeWrite.costBasisFound ? "yes" : "no"}`);
          setDiagnosticsRow(panel, "sell cargo", trustedCargo);
          setDiagnosticsRow(panel, "sell node", `${tradeWrite.currentNode || "unknown"} -> ${tradeWrite.sellNode || "unknown"}`);
        }
        if (tradeWrite.applied) {
          setDiagnosticsRow(panel, "trade delta", `CR ${formatTradeNumber(tradeWrite.creditsBefore)} -> ${formatTradeNumber(tradeWrite.creditsAfter)} / ${tradeWrite.resourceName || "cargo"} ${formatTradeNumber(tradeWrite.cargoBefore)} -> ${formatTradeNumber(tradeWrite.cargoAfter)}`);
          setDiagnosticsRow(panel, "trade hold", `${formatTradeNumber(tradeWrite.cargoUsedBefore)} -> ${formatTradeNumber(tradeWrite.cargoUsedAfter)} / ${formatTradeNumber(tradeWrite.cargoCapacity)}`);
        }
      }
      const storeItems = status.lastStagingStoreItems;
      const storePreview = status.lastStagingStorePreview;
      const storePurchase = status.lastStagingStorePurchase;
      const loadoutEquip = status.lastStagingLoadoutEquip || status.lastStagingLoadoutPreview;
      setDiagnosticsRow(panel, "store items", `${storeItems?.items?.length || 0} dry-run`);
      if (storePreview) {
        setDiagnosticsRow(panel, "store preview", storePreview.wouldPass
          ? `${storePreview.name || "item"} / CR ${formatTradeNumber(storePreview.totalCost)} / writes no`
          : `${storePreview.blockReason || storePreview.reason || "blocked"} / writes no`);
        setDiagnosticsRow(panel, "store source", `${storePreview.validationMode || "unknown"} / trusted ${storePreview.trustedStateAvailable ? "yes" : "no"} / applied ${storePreview.applied ? "yes" : "no"}`);
      }
      if (storePurchase) {
        const afterCredits = storePurchase.creditsAfter ?? storePurchase.creditsAfterPreview;
        setDiagnosticsRow(panel, "store purchase", storePurchase.applied
          ? `${storePurchase.name || "item"} applied / CR ${formatTradeNumber(storePurchase.creditsBefore)} -> ${formatTradeNumber(afterCredits)}`
          : `${storePurchase.name || storePurchase.itemId || "item"} / ${storePurchase.blockReason || storePurchase.reason || "dry-run"}`);
        setDiagnosticsRow(panel, "store gates", `${storePurchase.gates?.scope || "disabled"} / enabled ${storePurchase.gates?.writeEnabled ? "yes" : "no"} / dry ${storePurchase.gates?.dryRun ? "yes" : "no"} / allow ${storePurchase.gates?.allowlisted ? "yes" : "no"}`);
      }
      if (loadoutEquip) {
        const isWeaponEquip = String(loadoutEquip.itemId || "").startsWith("gun:");
        const isShieldEquip = String(loadoutEquip.itemId || "") === "attachment:shieldBooster";
        const isShipEquip = String(loadoutEquip.itemId || "").startsWith("ship:");
        const equipLabel = isShipEquip ? "ship select" : isWeaponEquip ? "weapon equip" : isShieldEquip ? "shield equip" : "cargo pod equip";
        const appliedLine = isWeaponEquip
          ? `applied / guns ${formatTradeNumber(loadoutEquip.equippedBefore)} -> ${formatTradeNumber(loadoutEquip.equippedAfter)}`
          : isShipEquip
            ? `applied / ${loadoutEquip.selectedShipBefore || loadoutEquip.currentShipId || "ship"} -> ${loadoutEquip.selectedShipAfter || loadoutEquip.targetShipId || "ship"}`
          : isShieldEquip
            ? `applied / shield ${formatTradeNumber(loadoutEquip.shieldBefore)} -> ${formatTradeNumber(loadoutEquip.shieldAfter)}`
          : `applied / cargo ${formatTradeNumber(loadoutEquip.cargoCapacityBefore)} -> ${formatTradeNumber(loadoutEquip.cargoCapacityAfter)}`;
        setDiagnosticsRow(panel, equipLabel, loadoutEquip.applied
          ? appliedLine
          : `${loadoutEquip.blockReason || loadoutEquip.reason || "dry-run"} / writes ${loadoutEquip.saveWritten ? "yes" : "no"}`);
        setDiagnosticsRow(panel, "loadout gates", `${loadoutEquip.gates?.scope || "disabled"} / enabled ${loadoutEquip.gates?.writeEnabled ? "yes" : "no"} / dry ${loadoutEquip.gates?.dryRun ? "yes" : "no"} / allow ${loadoutEquip.gates?.allowlisted ? "yes" : "no"}`);
      }
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
      ? "Staging reward path - XP and Lupen Shard material writes are gate-only; no credits, equipment loot, normal bounty writes, or PvP."
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
    const allPlayers = getClient()?.getPlayers?.({ includeSelf: true }) || [];
    const bots = getClient()?.getBots?.() || [];
    const resources = getClient()?.getResources?.() || [];
    const status = getClient()?.getStatus?.() || {};
    const selectedBot = getClient()?.getSelectedStagingBot?.() || null;
    if (selectedResourceId && !getSelectedResource(resources)) {
      selectedResourceId = "";
    }
    renderStatusChip(status);
    renderStagingFlowHint(status, selectedBot, players, bots);
    renderStagingBountyPanel(status);
    renderStagingTradePanel(status);
    renderSectorGhosts(players);
    renderSectorBots(bots);
    renderSpaceGhosts(players);
    renderSpaceResources(resources);
    renderSpaceBots(bots, players);
    renderSelectedTargetCard(players, bots, resources, status);
    renderSpaceShot(allPlayers, bots, status);
    renderStagingCombatPanel(status, selectedBot);
    global.renderMultiplayerChatHud?.(status, allPlayers);
    renderDiagnostics(players, bots, resources);
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
