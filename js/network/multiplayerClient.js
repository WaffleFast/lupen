/* Future multiplayer client boundary.
   Multiplayer remains disabled unless the game is opened locally with ?mp=1.
   This local-only path is for Colyseus prototype testing and must not mutate
   gameplay state or render other players yet. */

(function registerMultiplayerClient(global) {
  "use strict";

  const localServerUrl = "ws://localhost:2567";
  const localClientScriptUrl = "http://localhost:2567/colyseus.js";
  const defaultRoomName = "lupen_test";
  const disabledReason = "multiplayer_disabled";
  const notLocalReason = "multiplayer_local_only";
  const stateListeners = new Set();
  const connection = {
    enabled: false,
    isConnecting: false,
    isConnected: false,
    roomName: defaultRoomName,
    sessionId: null,
    lastError: null
  };

  let colyseusClient = null;
  let room = null;
  let clientScriptPromise = null;
  const playersById = new Map();

  function hasDevFlag() {
    try {
      return new URLSearchParams(global.location.search).get("mp") === "1";
    } catch (_err) {
      return false;
    }
  }

  function isLocalHost() {
    const host = global.location.hostname;
    return host === "" || host === "localhost" || host === "127.0.0.1" || host === "::1";
  }

  function updateEnabledState() {
    connection.enabled = hasDevFlag() && isLocalHost();
  }

  updateEnabledState();

  function logDev(message, detail) {
    if (!connection.enabled || !global.console) return;

    if (detail === undefined) {
      global.console.info(`[Lupen multiplayer] ${message}`);
    } else {
      global.console.info(`[Lupen multiplayer] ${message}`, detail);
    }
  }

  function setError(error) {
    connection.lastError = error && error.message ? error.message : String(error || "Unknown multiplayer error");
    logDev("error", connection.lastError);
  }

  function disabledResult(action, extra = {}) {
    return {
      ok: false,
      action,
      enabled: connection.enabled,
      connected: false,
      reason: connection.enabled ? "not_connected" : disabledReason,
      ...extra
    };
  }

  function statusResult(action, ok = true, extra = {}) {
    return {
      ok,
      action,
      enabled: connection.enabled,
      connected: connection.isConnected,
      roomName: connection.roomName,
      sessionId: connection.sessionId,
      lastError: connection.lastError,
      ...extra
    };
  }

  function ensureEnabled(action) {
    updateEnabledState();

    if (connection.enabled) return null;

    return disabledResult(action, {
      reason: hasDevFlag() ? notLocalReason : disabledReason
    });
  }

  function ensureBrowserClientLoaded() {
    if (global.Colyseus && typeof global.Colyseus.Client === "function") {
      return Promise.resolve(global.Colyseus);
    }

    if (clientScriptPromise) return clientScriptPromise;

    clientScriptPromise = new Promise((resolve, reject) => {
      if (!global.document || !global.document.head) {
        reject(new Error("document_unavailable"));
        return;
      }

      const existingScript = global.document.querySelector("script[data-lupen-colyseus-client='local']");
      if (existingScript) {
        existingScript.addEventListener("load", () => resolve(global.Colyseus), { once: true });
        existingScript.addEventListener("error", () => reject(new Error("colyseus_client_load_failed")), { once: true });
        return;
      }

      const script = global.document.createElement("script");
      script.src = localClientScriptUrl;
      script.async = true;
      script.dataset.lupenColyseusClient = "local";
      script.onload = () => {
        if (global.Colyseus && typeof global.Colyseus.Client === "function") {
          resolve(global.Colyseus);
          return;
        }

        reject(new Error("colyseus_client_unavailable"));
      };
      script.onerror = () => reject(new Error("colyseus_client_load_failed"));
      global.document.head.appendChild(script);
    });

    return clientScriptPromise;
  }

  function notifyServerState(serverState) {
    stateListeners.forEach((handler) => {
      try {
        handler(serverState, getStatus());
      } catch (err) {
        logDev("state listener failed", err);
      }
    });
  }

  function normalizePlayer(player, fallbackId = "") {
    if (!player) return null;

    const id = String(player.id || fallbackId || "");
    if (!id) return null;

    return {
      id,
      sessionId: id,
      displayName: String(player.displayName || "Pilot"),
      x: Number.isFinite(Number(player.x)) ? Number(player.x) : 50,
      y: Number.isFinite(Number(player.y)) ? Number(player.y) : 50,
      currentNode: String(player.currentNode || "Asteron Prime"),
      isSelf: id === connection.sessionId
    };
  }

  function updatePlayersFromServerState(serverState) {
    playersById.clear();

    const players = serverState?.players;
    if (!players) return;

    if (typeof players.forEach === "function") {
      players.forEach((player, key) => {
        const snapshot = normalizePlayer(player, key);
        if (snapshot) playersById.set(snapshot.id, snapshot);
      });
      return;
    }

    Object.entries(players).forEach(([key, player]) => {
      const snapshot = normalizePlayer(player, key);
      if (snapshot) playersById.set(snapshot.id, snapshot);
    });
  }

  function bindRoomEvents(activeRoom) {
    activeRoom.onStateChange((serverState) => {
      updatePlayersFromServerState(serverState);
      notifyServerState(serverState);
    });

    activeRoom.onMessage("pong", (message) => {
      logDev("received pong", message);
    });

    activeRoom.onLeave((code) => {
      logDev(`left ${connection.roomName}`, { code });
      connection.isConnected = false;
      connection.isConnecting = false;
      connection.sessionId = null;
      room = null;
      colyseusClient = null;
      playersById.clear();
      notifyServerState(null);
    });
  }

  function sendRoomMessage(action, type, payload = {}) {
    const disabled = ensureEnabled(action);
    if (disabled) return disabled;

    if (!room || !connection.isConnected) {
      return disabledResult(action, { reason: "not_connected", payload });
    }

    room.send(type, payload);
    logDev(`sent ${type}`, payload);
    return statusResult(action, true, { type, payload });
  }

  function getStatus() {
    updateEnabledState();

    return {
      enabled: connection.enabled,
      isConnected: connection.isConnected,
      connected: connection.isConnected,
      isConnecting: connection.isConnecting,
      roomName: connection.roomName,
      sessionId: connection.sessionId,
      lastError: connection.lastError,
      listenerCount: stateListeners.size,
      playerCount: playersById.size,
      serverUrl: localServerUrl
    };
  }

  const client = {
    get enabled() {
      return getStatus().enabled;
    },

    get isConnected() {
      return connection.isConnected;
    },

    get roomName() {
      return connection.roomName;
    },

    get sessionId() {
      return connection.sessionId;
    },

    get lastError() {
      return connection.lastError;
    },

    async connect(options = {}) {
      const disabled = ensureEnabled("connect");
      if (disabled) return disabled;

      if (connection.isConnected && room) {
        return statusResult("connect", true, { alreadyConnected: true });
      }

      if (connection.isConnecting) {
        return statusResult("connect", false, { reason: "already_connecting" });
      }

      connection.isConnecting = true;
      connection.lastError = null;
      connection.roomName = options.roomName || defaultRoomName;
      logDev(`connecting to ${localServerUrl}`, { roomName: connection.roomName });

      try {
        const Colyseus = await ensureBrowserClientLoaded();
        colyseusClient = new Colyseus.Client(options.serverUrl || localServerUrl);
        room = await colyseusClient.joinOrCreate(connection.roomName, {
          displayName: options.displayName || "Pilot",
          currentNode: options.currentNode || "asteron-prime"
        });

        connection.isConnected = true;
        connection.isConnecting = false;
        connection.sessionId = room.sessionId;
        bindRoomEvents(room);
        logDev(`connected to ${connection.roomName}`, { sessionId: connection.sessionId });

        if (options.sendInitialPing !== false) {
          client.sendPing({ local: true, auto: true });
        }

        return statusResult("connect");
      } catch (err) {
        connection.isConnected = false;
        connection.isConnecting = false;
        connection.sessionId = null;
        room = null;
        colyseusClient = null;
        setError(err);
        return statusResult("connect", false, { reason: "connection_failed" });
      }
    },

    disconnect() {
      const disabled = ensureEnabled("disconnect");
      if (disabled) {
        stateListeners.clear();
        return disabled;
      }

      if (!room) {
        connection.isConnected = false;
        connection.isConnecting = false;
        connection.sessionId = null;
        return statusResult("disconnect", true, { alreadyDisconnected: true });
      }

      logDev(`disconnecting from ${connection.roomName}`);
      room.leave();
      connection.isConnected = false;
      connection.isConnecting = false;
      connection.sessionId = null;
      room = null;
      colyseusClient = null;
      return statusResult("disconnect");
    },

    sendPlayerIntent(intent = {}) {
      return sendRoomMessage("sendPlayerIntent", "player_intent", intent);
    },

    sendMovementIntent(intent = {}) {
      return sendRoomMessage("sendMovementIntent", "move", intent);
    },

    sendCombatIntent(intent = {}) {
      return sendRoomMessage("sendCombatIntent", "combat_intent", intent);
    },

    sendPing(payload = {}) {
      return sendRoomMessage("sendPing", "ping", payload);
    },

    getPlayers(options = {}) {
      const includeSelf = options.includeSelf !== false;
      return Array.from(playersById.values())
        .filter((player) => includeSelf || !player.isSelf)
        .map((player) => ({ ...player }));
    },

    onServerState(handler) {
      if (typeof handler === "function") {
        stateListeners.add(handler);
      }

      return {
        ...(connection.enabled ? statusResult("onServerState") : disabledResult("onServerState")),
        unsubscribe() {
          if (typeof handler === "function") {
            stateListeners.delete(handler);
          }
        }
      };
    },

    getStatus() {
      return getStatus();
    }
  };

  global.LupenMultiplayerClient = Object.freeze(client);

  if (connection.enabled) {
    const connectWhenReady = () => {
      client.connect().catch((err) => {
        setError(err);
      });
    };

    if (global.document && global.document.readyState === "loading") {
      global.document.addEventListener("DOMContentLoaded", connectWhenReady, { once: true });
    } else {
      global.setTimeout(connectWhenReady, 0);
    }
  }
})(window);
