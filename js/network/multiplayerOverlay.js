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
  const spaceBotLayerId = "lupenMultiplayerSpaceBotLayer";
  const spaceShotLayerId = "lupenMultiplayerSpaceShotLayer";
  const statusChipId = "lupenMultiplayerStatusChip";
  const diagnosticsPanelId = "lupenMultiplayerDiagnostics";
  const stagingCombatPanelId = "lupenMultiplayerStagingCombatPanel";
  const styleId = "lupenMultiplayerOverlayStyles";
  let unsubscribe = null;
  let renderQueued = false;
  let diagnosticsTimer = null;
  const shipImageLoadStatus = new Map();
  const shipImageById = {
    lupenOrigin: "assets/ships/lupen-origin.png",
    lupenHauler: "assets/ships/lupen-hauler.png",
    lupenStriker: "assets/ships/lupen-striker.png",
    hermesCourier: "assets/ships/hermes-courier.png",
    athenaSentinel: "assets/ships/athena-sentinel.png",
    aresVindicator: "assets/ships/ares-vindicator.png",
    hephaestusTrader: "assets/ships/hephaestus-trader.png",
    poseidonAggressor: "assets/ships/poseidon-aggressor.png",
    zeusExplorer: "assets/ships/zeus-explorer.png",
    cobraSeeker: "assets/ships/cobra-seeker.png",
    cobraMoth: "assets/ships/cobra-moth.png"
  };
  const shipImageByName = {
    "lf 1 origin": shipImageById.lupenOrigin,
    "lf-1 origin": shipImageById.lupenOrigin,
    "hauler": shipImageById.lupenHauler,
    "striker": shipImageById.lupenStriker,
    "hermes courier": shipImageById.hermesCourier,
    "athena sentinel": shipImageById.athenaSentinel,
    "ares vindicator": shipImageById.aresVindicator,
    "hephaestus trader": shipImageById.hephaestusTrader,
    "poseidon aggressor": shipImageById.poseidonAggressor,
    "zeus explorer": shipImageById.zeusExplorer,
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

      #${spaceShotLayerId} {
        position: absolute;
        inset: 84px 18px 170px;
        z-index: 10;
        pointer-events: none;
        overflow: hidden;
      }

      #${spaceShotLayerId} .lupen-mp-shot-beam {
        position: absolute;
        height: 4px;
        transform-origin: 0 50%;
        border-radius: 999px;
        background: linear-gradient(90deg, rgba(117, 242, 255, 0), rgba(131, 243, 255, 0.96) 18%, rgba(255, 239, 180, 0.94) 62%, rgba(255, 126, 65, 0));
        box-shadow: 0 0 14px rgba(110, 229, 255, 0.78), 0 0 22px rgba(255, 126, 65, 0.4);
        animation: lupen-mp-shot-beam 0.42s ease-out forwards;
      }

      #${spaceShotLayerId} .lupen-mp-shot-hit {
        position: absolute;
        width: 30px;
        height: 30px;
        transform: translate(-50%, -50%);
        border: 2px solid rgba(255, 229, 156, 0.88);
        border-radius: 50%;
        background: radial-gradient(circle, rgba(255, 233, 157, 0.8), rgba(255, 111, 54, 0.26) 48%, rgba(255, 111, 54, 0) 72%);
        box-shadow: 0 0 16px rgba(255, 159, 73, 0.72);
        animation: lupen-mp-shot-hit 0.62s ease-out forwards;
      }

      #${stagingCombatPanelId} {
        position: absolute;
        right: 20px;
        bottom: 156px;
        z-index: 35;
        width: min(338px, calc(100vw - 32px));
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
        gap: 8px 12px;
        align-items: center;
        padding: 9px 10px;
      }

      #${stagingCombatPanelId} .lupen-mp-staging-combat-kicker {
        display: block;
        color: rgba(255, 206, 146, 0.68);
        font: 900 9px/1 Arial, sans-serif;
        letter-spacing: 0.08em;
      }

      #${stagingCombatPanelId} strong {
        display: block;
        margin-top: 2px;
        color: #fff1cf;
        font: 900 14px/1.1 Arial, sans-serif;
        letter-spacing: 0.02em;
      }

      #${stagingCombatPanelId} small {
        display: block;
        margin-top: 3px;
        color: rgba(255, 226, 188, 0.78);
        font: 800 9px/1.2 Arial, sans-serif;
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

      .lupen-mp-space-ghost {
        position: absolute;
        display: grid;
        justify-items: center;
        gap: 3px;
        transform: translate(-50%, -50%);
        opacity: 0.9;
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
      }

      .lupen-mp-space-bot.is-hit {
        animation: lupen-mp-staging-hit 0.62s ease-out;
      }

      .${botMarkerClass}.is-hit {
        animation: lupen-mp-sector-bot-hit 0.62s ease-out;
      }

      .lupen-mp-space-bot-ship {
        position: relative;
        width: 76px;
        height: 76px;
        display: grid;
        place-items: center;
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
      }

      .lupen-mp-space-bot-label {
        padding: 2px 5px;
        border: 1px solid rgba(255, 163, 92, 0.46);
        border-radius: 4px;
        background: rgba(18, 8, 2, 0.72);
        color: #ffd9b0;
        font: 800 9px/1.15 Arial, sans-serif;
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

      .lupen-mp-space-bot-bars {
        width: 74px;
        display: grid;
        gap: 2px;
        margin-top: -5px;
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

      @keyframes lupen-mp-shot-beam {
        0% {
          opacity: 0;
          transform: rotate(var(--shot-angle)) scaleX(0.1);
        }
        35% {
          opacity: 1;
          transform: rotate(var(--shot-angle)) scaleX(1);
        }
        100% {
          opacity: 0;
          transform: rotate(var(--shot-angle)) scaleX(1);
        }
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
    global.document?.getElementById(spaceShotLayerId)?.remove();
  }

  function removeDiagnosticsPanel() {
    global.document?.getElementById(diagnosticsPanelId)?.remove();
  }

  function removeStatusChip() {
    global.document?.getElementById(statusChipId)?.remove();
  }

  function removeStagingCombatPanel() {
    global.document?.getElementById(stagingCombatPanelId)?.remove();
  }

  function removeLayers() {
    removeSectorLayer();
    removeSpaceLayer();
    removeDiagnosticsPanel();
    removeStatusChip();
    removeStagingCombatPanel();
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
    if (!/^assets\/(?:ships|player-ships|hub\/ships)\/[a-z0-9-]+\.png$/i.test(src)) return "";
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
    const modeLabel = isStagingMode() ? "STAGING PILOT" : "DEV GHOST";
    return shipLabel === "Unknown ship" ? modeLabel : `${shipLabel} / ${modeLabel}`;
  }

  function getBotLabel(bot) {
    return String(bot.name || bot.type || "DEV BOT").trim().slice(0, 18) || "DEV BOT";
  }

  function getBotImageSrc(bot) {
    const explicit = String(bot?.image || bot?.imageSrc || bot?.imagePath || "").trim().replace(/\\/g, "/");
    if (explicit && /^assets\/bots\/[a-z0-9-]+\.png$/i.test(explicit) && !explicit.includes("..") && !explicit.includes("//")) {
      return explicit;
    }

    const typeKey = normalizeShipLookupKey(bot?.type || bot?.name || "");
    return botImageByType[typeKey] || "assets/bots/erebus-attacker.png";
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

  function getShotEventAge(status = getClient()?.getStatus?.()) {
    return Date.now() - Number(status?.lastShotEvent?.receivedAt || status?.lastShotEvent?.timestamp || 0);
  }

  function getSpacePercentPosition(entity, fallback = { x: 50, y: 50 }) {
    return {
      x: clampMapCoordinate(entity?.x ?? fallback.x),
      y: clampMapCoordinate(entity?.y ?? fallback.y)
    };
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
      const image = global.document.createElement("img");
      image.src = getBotImageSrc(bot);
      image.alt = "";
      image.onerror = () => {
        image.remove();
        if (ship.querySelector(".lupen-mp-space-bot-ship-fallback")) return;
        const fallback = global.document.createElement("span");
        fallback.className = "lupen-mp-space-bot-ship-fallback";
        ship.appendChild(fallback);
      };
      ship.appendChild(image);
      marker.appendChild(ship);

      const label = global.document.createElement("div");
      label.className = "lupen-mp-space-bot-label";
      label.textContent = getBotLabel(bot);
      marker.appendChild(label);

      const note = global.document.createElement("div");
      note.className = "lupen-mp-space-bot-note";
      note.textContent = bot.disabled ? "DISABLED" : getBotModeLabel();
      marker.appendChild(note);

      marker.appendChild(createCompactHealthBars(bot));

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

  function renderSpaceShot(players, bots, status) {
    global.document?.getElementById(spaceShotLayerId)?.remove();
    if (!isStagingMode(status) || !status?.lastShotEvent || getShotEventAge(status) > 900) return;
    if (normalizeNodeKey(status.lastShotEvent.currentNode) !== normalizeNodeKey(getCurrentNodeName())) return;

    const spaceScreen = global.document?.getElementById("spaceScreen");
    if (!spaceScreen) return;

    const targetBot = bots.find((bot) => bot.id === status.lastShotEvent.targetBotId);
    if (!targetBot || !isSameCurrentNode(targetBot)) return;

    ensureStyles();

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

    const beam = global.document.createElement("div");
    beam.className = "lupen-mp-shot-beam";
    beam.style.left = `${attackerPosition.x}%`;
    beam.style.top = `${attackerPosition.y}%`;
    beam.style.width = `${distance}%`;
    beam.style.setProperty("--shot-angle", `${angle}rad`);
    layer.appendChild(beam);

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

  function getRewardClaimResultLabel(status) {
    const result = status?.lastRewardClaimResult;
    if (!result?.botId) return "none";
    if (!result.ok) return `${result.reason || "claim rejected"} / not applied`;

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
    return `XP ${formatPreviewValue(preview.currentXp)} -> ${formatPreviewValue(preview.previewXp)} / C ${formatPreviewValue(preview.currentCredits)} -> ${formatPreviewValue(preview.previewCredits)} / loot ${loot} / not saved`;
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

    // Diagnostics-only staging damage path. This does not call local combat,
    // projectile, sound, bounty, reward, save, or targeting systems.
    getClient()?.sendSelectedStagingBotCombatIntent?.({
      targetBotId: selectedBot.id,
      currentNode: getCurrentNodeName(),
      timestamp: Date.now()
    });
  }

  function canClaimRewardPreview(status) {
    return isStagingMode(status) &&
      !!status?.enabled &&
      !!status?.isConnected &&
      !!status?.lastRewardPreview?.botId &&
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
    if (!canShowStagingTestFire(status, selectedBot)) return;

    const spaceScreen = global.document?.getElementById("spaceScreen");
    if (!spaceScreen) return;

    ensureStyles();

    const panel = global.document.createElement("div");
    panel.id = stagingCombatPanelId;
    panel.setAttribute("aria-label", "Staging combat test controls");

    const inner = global.document.createElement("div");
    inner.className = "lupen-mp-staging-combat-inner";

    const summary = global.document.createElement("div");
    const kicker = global.document.createElement("span");
    kicker.className = "lupen-mp-staging-combat-kicker";
    kicker.textContent = "STAGING LOCK";
    summary.appendChild(kicker);

    const title = global.document.createElement("strong");
    title.textContent = getBotLabel(selectedBot);
    summary.appendChild(title);

    const note = global.document.createElement("small");
    const cooldownText = formatCooldown(status.fireCooldownRemainingMs);
    const weaponIntent = getClient()?.getStagingWeaponIntent?.() || {};
    const weaponName = status.lastCombatResponse?.weaponName || weaponIntent.weaponName || "Equipped Weapon";
    const stagingDamage = status.lastCombatResponse?.stagingDamage || weaponIntent.damage || 5;
    const lastDamage = status.lastCombatResponse?.ok && status.lastCombatResponse.targetBotId === selectedBot.id
      ? ` / last -${Math.round(Number(status.lastCombatResponse.damage || 0))}`
      : "";
    note.textContent = selectedBot.disabled
      ? "Disabled - waiting for server respawn"
      : `${weaponName} / dmg ${Math.round(Number(stagingDamage || 0))} / no rewards / ${cooldownText}${lastDamage}`;
    summary.appendChild(note);

    if (status.lastRewardPreview?.botId) {
      const preview = global.document.createElement("small");
      preview.textContent = "Reward Preview Only - Not Applied";
      summary.appendChild(preview);
      const contribution = getRewardPreviewContributionLabel(status);
      if (contribution) {
        const contributionNode = global.document.createElement("small");
        contributionNode.textContent = contribution;
        summary.appendChild(contributionNode);
      }
    }
    const dryRunLabel = getRewardDryRunPanelLabel(status);
    if (dryRunLabel) {
      const dryRun = global.document.createElement("small");
      dryRun.textContent = `${dryRunLabel} / Dry run only - not applied`;
      summary.appendChild(dryRun);
    }
    const progressionPreviewLabel = getProgressionPreviewLabel(status);
    if (progressionPreviewLabel) {
      const progressionPreview = global.document.createElement("small");
      progressionPreview.textContent = `${progressionPreviewLabel} / Progression preview only`;
      summary.appendChild(progressionPreview);
    }
    const progressionShadowLabel = getProgressionShadowLabel(status);
    if (progressionShadowLabel) {
      const shadow = global.document.createElement("small");
      shadow.textContent = `${progressionShadowLabel} / Shadow only - real save not changed`;
      summary.appendChild(shadow);
    }
    const playerSavePatchLabel = getPlayerSavePatchLabel(status);
    if (playerSavePatchLabel) {
      const patch = global.document.createElement("small");
      patch.textContent = `${playerSavePatchLabel} / XP only / no credits or loot`;
      summary.appendChild(patch);
    }
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

    if (canClaimRewardPreview(status)) {
      const claimButton = global.document.createElement("button");
      claimButton.type = "button";
      claimButton.className = "lupen-mp-staging-fire";
      claimButton.textContent = "Preview Claim";
      claimButton.title = "Simulate a staging reward claim. No rewards are applied.";
      claimButton.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        sendStagingRewardPreviewClaim(status);
      });
      inner.appendChild(claimButton);
    }

    const bars = global.document.createElement("div");
    bars.className = "lupen-mp-staging-bars";
    bars.appendChild(createStagingCombatBar("Shield", selectedBot.shield, selectedBot.shieldMax, "lupen-mp-staging-shield"));
    bars.appendChild(createStagingCombatBar("Hull", selectedBot.hull, selectedBot.hullMax, "lupen-mp-staging-hull"));
    inner.appendChild(bars);

    panel.appendChild(inner);
    spaceScreen.appendChild(panel);
  }

  function renderDiagnostics(players, bots) {
    removeDiagnosticsPanel();
    if (!isEnabled()) return;
    if (!isMpDebugEnabled()) return;

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
    if (isStagingMode(status)) {
      setDiagnosticsRow(panel, "auth", `${status.authStatus || "guest"} / trusted id ${status.trustedPlayerIdPresent ? "present" : "missing"}`);
      setDiagnosticsRow(panel, "identity", String(status.displayName || "Pilot").slice(0, 24));
    }
    setDiagnosticsRow(panel, "remote pilots", `${players.length} total / ${sameNodePlayers.length} same node`);
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
    setDiagnosticsRow(panel, "bot update", formatRelativeAge(status.lastBotUpdateAt));
    if (isStagingMode(status)) {
      const weaponIntent = getClient()?.getStagingWeaponIntent?.() || {};
      setDiagnosticsRow(panel, "bot layer", "server-owned visual");
      setDiagnosticsRow(panel, "selected bot", getBotInspectionLabel(selectedBot));
      setDiagnosticsRow(panel, "inspect bot", getBotInspectionLabel(inspectedBot));
      setDiagnosticsRow(panel, "bot node", getBotLayerSummary(inspectedBot));
      setDiagnosticsRow(panel, "bot status", getBotHullSummary(inspectedBot));
      setDiagnosticsRow(panel, "weapon", `${status.lastCombatResponse?.weaponName || weaponIntent.weaponName || "unknown"} / dmg ${Math.round(Number(status.lastCombatResponse?.stagingDamage || weaponIntent.damage || 0))}`);
      setDiagnosticsRow(panel, "fire cooldown", formatCooldown(status.fireCooldownRemainingMs));
      setDiagnosticsRow(panel, "bot event", getLastBotEventLabel(status));
      setDiagnosticsRow(panel, "shot event", getLastShotEventLabel(status));
      setDiagnosticsRow(panel, "reward preview", getRewardPreviewLabel(status));
      setDiagnosticsRow(panel, "claim preview", getRewardClaimResultLabel(status));
      const applicationLabel = getRewardApplicationLabel(status);
      if (applicationLabel) setDiagnosticsRow(panel, "application", applicationLabel);
      const progressionPreviewLabel = getProgressionPreviewLabel(status);
      if (progressionPreviewLabel) setDiagnosticsRow(panel, "save preview", progressionPreviewLabel);
      const progressionShadowLabel = getProgressionShadowLabel(status);
      if (progressionShadowLabel) setDiagnosticsRow(panel, "shadow", progressionShadowLabel);
      const playerSavePatchLabel = getPlayerSavePatchLabel(status);
      if (playerSavePatchLabel) setDiagnosticsRow(panel, "player_saves", playerSavePatchLabel);
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
      ? "Staging multiplayer reward path - XP only when verified and explicitly enabled; no credits, loot, bounties, or PvP."
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
    const status = getClient()?.getStatus?.() || {};
    const selectedBot = getClient()?.getSelectedStagingBot?.() || null;
    renderStatusChip(status);
    renderSectorGhosts(players);
    renderSectorBots(bots);
    renderSpaceGhosts(players);
    renderSpaceBots(bots);
    renderSpaceShot(allPlayers, bots, status);
    renderStagingCombatPanel(status, selectedBot);
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
