/* Future multiplayer client boundary.
   This placeholder is intentionally inert until Colyseus room/client integration
   is added. Gameplay remains single-player and server-authoritative networking
   can later connect through this object without changing callers everywhere. */

(function registerMultiplayerClient(global) {
  "use strict";

  const disabledReason = "multiplayer_disabled";
  const stateListeners = new Set();

  function disabledResult(action, extra = {}) {
    return {
      ok: false,
      action,
      enabled: false,
      connected: false,
      reason: disabledReason,
      ...extra
    };
  }

  const client = {
    enabled: false,
    isConnected: false,

    connect(options = {}) {
      return disabledResult("connect", { options });
    },

    disconnect() {
      stateListeners.clear();
      return disabledResult("disconnect");
    },

    sendPlayerIntent(intent = {}) {
      return disabledResult("sendPlayerIntent", { intent });
    },

    sendMovementIntent(intent = {}) {
      return disabledResult("sendMovementIntent", { intent });
    },

    sendCombatIntent(intent = {}) {
      return disabledResult("sendCombatIntent", { intent });
    },

    onServerState(handler) {
      if (typeof handler === "function") {
        stateListeners.add(handler);
      }

      return {
        ...disabledResult("onServerState"),
        unsubscribe() {
          if (typeof handler === "function") {
            stateListeners.delete(handler);
          }
        }
      };
    },

    getStatus() {
      return {
        enabled: false,
        connected: false,
        reason: disabledReason,
        listenerCount: stateListeners.size
      };
    }
  };

  global.LupenMultiplayerClient = Object.freeze(client);
})(window);
