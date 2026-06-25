/* Future multiplayer client boundary.
   Multiplayer remains disabled unless the game is opened locally with ?mp=1.
   This local-only path is for Colyseus prototype testing and must not mutate
   gameplay state. Server snapshots are read-only presence/visual data. */

(function registerMultiplayerClient(global) {
  "use strict";

  const localServerUrl = "ws://localhost:2567";
  const stagingServerUrl = "https://gb-man-e55e725e.colyseus.cloud";
  const localClientScriptUrl = "http://localhost:2567/colyseus.js";
  const serverStorageKey = "lupenMultiplayerServer";
  const productionHosts = new Set(["lupen.io", "www.lupen.io"]);
  const colyseusBrowserClientVersion = "0.16.22";
  const clientScriptSources = [
    { source: "local", url: localClientScriptUrl },
    { source: "cdn-jsdelivr", url: `https://cdn.jsdelivr.net/npm/colyseus.js@${colyseusBrowserClientVersion}/dist/colyseus.js` },
    { source: "cdn-unpkg", url: `https://unpkg.com/colyseus.js@${colyseusBrowserClientVersion}/dist/colyseus.js` }
  ];
  const defaultRoomName = "lupen_sector";
  const disabledReason = "multiplayer_disabled";
  const notLocalReason = "multiplayer_local_only";
  const stateListeners = new Set();
  const connection = {
    enabled: false,
    isConnecting: false,
    isConnected: false,
    roomName: defaultRoomName,
    sessionId: null,
    originalServerUrl: localServerUrl,
    serverUrl: localServerUrl,
    serverUrlSource: "default-local",
    enabledReason: disabledReason,
    clientLoadSource: null,
    clientLoadError: null,
    lastServerWarning: null,
    lastCombatResponse: null,
    lastTargetResponse: null,
    lastBotEvent: null,
    lastBotRewardReceipt: null,
    lastShotEvent: null,
    lastStagingReturnFire: null,
    lastRewardPreview: null,
    lastRewardClaimResult: null,
    lastStagingBotXpResult: null,
    lastStagingXpRefresh: null,
    lastStagingLootClaimResult: null,
    lastChatSend: null,
    lastStagingTradeOffers: null,
    lastStagingTradePreview: null,
    lastStagingTradeWriteResult: null,
    lastStagingStoreItems: null,
    lastStagingStorePreview: null,
    lastStagingStorePurchase: null,
    lastStagingLoadoutPreview: null,
    lastStagingLoadoutEquip: null,
    lastStagingBountyList: null,
    lastStagingBountyStatus: null,
    lastStagingBountyClaimResult: null,
    lastStagingResourceMineResult: null,
    lastStagingResourceEvent: null,
    chatMessages: [],
    presenceEvents: [],
    lastError: null
  };
  const identity = {
    authStatus: "guest",
    playerIdPresent: false,
    sessionPresent: false,
    tokenPresent: false,
    tokenSent: false,
    tokenVerificationAttempted: false,
    tokenVerificationReason: "",
    authReconnectAttempted: false,
    sessionWaitTimedOut: false,
    displayName: "",
    lastCheckedAt: 0
  };

  let colyseusClient = null;
  let room = null;
  let clientScriptPromise = null;
  let authStateListenerRegistered = false;
  let stagingCombatRefreshTimer = null;
  let stagingCombatRefreshRetryTimer = null;
  const playersById = new Map();
  const botsById = new Map();
  const resourcesById = new Map();
  const stagingActivityLogKeys = new Set();
  const chatMessageKeys = new Set();

  function clearChatMessages() {
    connection.chatMessages = [];
    chatMessageKeys.clear();
  }

  function hasDevFlag() {
    return getMultiplayerMode() === "1";
  }

  function hasStagingFlag() {
    return getMultiplayerMode() === "staging";
  }

  function getMultiplayerMode() {
    try {
      return new URLSearchParams(global.location.search).get("mp") || "";
    } catch (_err) {
      return "";
    }
  }

  function isLocalHost() {
    const host = global.location.hostname;
    return host === "" || host === "localhost" || host === "127.0.0.1" || host === "::1";
  }

  function isProductionHost() {
    return productionHosts.has(String(global.location.hostname || "").toLowerCase());
  }

  function getRuntimeConfig() {
    const legacyConfig = global.LupenMultiplayerConfig || {};
    return {
      allowedHosts: Array.isArray(legacyConfig.allowedHosts)
        ? legacyConfig.allowedHosts
        : Array.isArray(global.LUPEN_MULTIPLAYER_ALLOWED_HOSTS)
          ? global.LUPEN_MULTIPLAYER_ALLOWED_HOSTS
          : [],
      allowProductionHost: legacyConfig.allowProductionHost === true || global.LUPEN_MULTIPLAYER_ALLOW_PRODUCTION_HOST === true
    };
  }

  function addStagingActivityLogOnce(key, message) {
    if (!key || !message || stagingActivityLogKeys.has(key)) return;
    stagingActivityLogKeys.add(key);
    if (stagingActivityLogKeys.size > 80) {
      const [oldest] = stagingActivityLogKeys;
      stagingActivityLogKeys.delete(oldest);
    }
    global.addActivityLog?.(message);
  }

  function getSearchParam(name) {
    try {
      return new URLSearchParams(global.location.search).get(name);
    } catch (_err) {
      return null;
    }
  }

  function getStoredServerUrl() {
    try {
      return global.localStorage?.getItem?.(serverStorageKey) || "";
    } catch (_err) {
      return "";
    }
  }

  function isAllowedPageHost() {
    const host = String(global.location.hostname || "").toLowerCase();
    const runtimeConfig = getRuntimeConfig();
    const allowedHosts = runtimeConfig.allowedHosts.map((value) => String(value || "").toLowerCase());

    if (isLocalHost()) return true;
    if (productionHosts.has(host) && !runtimeConfig.allowProductionHost) return false;

    return allowedHosts.includes(host);
  }

  function resolveServerConfig() {
    const queryServerUrl = getSearchParam("mpServer");
    const storedServerUrl = getStoredServerUrl();
    const useStagingDefault = hasStagingFlag();
    const rawServerUrl = String(useStagingDefault ? stagingServerUrl : queryServerUrl || storedServerUrl || localServerUrl).trim();
    const source = useStagingDefault ? "staging-default" : queryServerUrl ? "query" : storedServerUrl ? "localStorage" : "default-local";

    try {
      const parsedUrl = new URL(rawServerUrl);
      const allowedProtocols = new Set(["ws:", "wss:", "http:", "https:"]);
      if (!allowedProtocols.has(parsedUrl.protocol)) {
        throw new Error("server URL must use ws://, wss://, http://, or https://");
      }

      // Colyseus Cloud may provide an HTTPS matchmaking endpoint. The
      // browser client accepts that base URL and handles WebSocket upgrade
      // details internally, so preserve http(s) endpoints instead of forcing
      // them into ws(s) here.
      return {
        ok: true,
        originalServerUrl: rawServerUrl,
        serverUrl: parsedUrl.toString().replace(/\/$/, ""),
        source,
        error: null
      };
    } catch (err) {
      return {
        ok: false,
        originalServerUrl: rawServerUrl,
        serverUrl: rawServerUrl,
        source,
        error: `invalid_multiplayer_server_url: ${err.message || err}`
      };
    }
  }

  function updateEnabledState() {
    const serverConfig = resolveServerConfig();
    connection.originalServerUrl = serverConfig.originalServerUrl || serverConfig.serverUrl || localServerUrl;
    connection.serverUrl = serverConfig.serverUrl || localServerUrl;
    connection.serverUrlSource = serverConfig.source;

    if (!hasDevFlag() && !hasStagingFlag()) {
      connection.enabled = false;
      connection.enabledReason = disabledReason;
      return;
    }

    if (hasStagingFlag()) {
      if (!isProductionHost() && !isLocalHost()) {
        connection.enabled = false;
        connection.enabledReason = notLocalReason;
        return;
      }
    } else if (!isAllowedPageHost()) {
      connection.enabled = false;
      connection.enabledReason = notLocalReason;
      return;
    }

    if (!serverConfig.ok) {
      connection.enabled = false;
      connection.enabledReason = serverConfig.error;
      connection.lastError = serverConfig.error;
      return;
    }

    connection.enabled = true;
    connection.enabledReason = hasStagingFlag()
      ? "staging_enabled"
      : isLocalHost()
        ? "local_dev_enabled"
        : "allowed_staging_host_enabled";
    if (String(connection.lastError || "").startsWith("invalid_multiplayer_server_url:")) {
      connection.lastError = null;
    }
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

  function setClientLoadError(error) {
    connection.clientLoadError = error && error.message ? error.message : String(error || "Unknown Colyseus client load error");
    setError(connection.clientLoadError);
  }

  function disabledResult(action, extra = {}) {
    return {
      ok: false,
      action,
      enabled: connection.enabled,
      connected: false,
      reason: connection.enabled ? "not_connected" : connection.enabledReason,
      enabledReason: connection.enabledReason,
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
      originalServerUrl: connection.originalServerUrl,
      serverUrl: connection.serverUrl,
      serverUrlSource: connection.serverUrlSource,
      serverConfigSource: connection.serverUrlSource,
      enabledReason: connection.enabledReason,
      clientLoadSource: connection.clientLoadSource,
      clientLoadError: connection.clientLoadError,
      lastServerWarning: connection.lastServerWarning,
      lastCombatResponse: connection.lastCombatResponse ? { ...connection.lastCombatResponse } : null,
      lastTargetResponse: connection.lastTargetResponse ? { ...connection.lastTargetResponse } : null,
      lastBotEvent: connection.lastBotEvent ? { ...connection.lastBotEvent } : null,
      lastBotRewardReceipt: connection.lastBotRewardReceipt ? { ...connection.lastBotRewardReceipt } : null,
      lastShotEvent: connection.lastShotEvent ? { ...connection.lastShotEvent } : null,
      lastStagingReturnFire: connection.lastStagingReturnFire ? { ...connection.lastStagingReturnFire } : null,
      lastRewardPreview: connection.lastRewardPreview ? { ...connection.lastRewardPreview } : null,
      lastRewardClaimResult: connection.lastRewardClaimResult ? { ...connection.lastRewardClaimResult } : null,
      lastStagingBotXpResult: connection.lastStagingBotXpResult ? { ...connection.lastStagingBotXpResult } : null,
      lastStagingXpRefresh: connection.lastStagingXpRefresh ? { ...connection.lastStagingXpRefresh } : null,
      lastStagingLootClaimResult: connection.lastStagingLootClaimResult ? { ...connection.lastStagingLootClaimResult } : null,
      lastChatSend: connection.lastChatSend ? { ...connection.lastChatSend } : null,
      lastStagingTradeOffers: connection.lastStagingTradeOffers ? { ...connection.lastStagingTradeOffers } : null,
      lastStagingTradePreview: connection.lastStagingTradePreview ? { ...connection.lastStagingTradePreview } : null,
      lastStagingTradeWriteResult: connection.lastStagingTradeWriteResult ? { ...connection.lastStagingTradeWriteResult } : null,
      lastError: connection.lastError,
      ...extra
    };
  }

  function getLocalPresenceOptions() {
    try {
      if (typeof global.getLupenMultiplayerPresence === "function") {
        return global.getLupenMultiplayerPresence() || {};
      }
    } catch (err) {
      logDev("local presence unavailable", err);
    }

    return {};
  }

  function getStoredAccountIdentity() {
    try {
      const raw = global.localStorage?.getItem?.("sectorOneAccount") || "";
      if (!raw) return {};
      const account = JSON.parse(raw);
      return account && typeof account === "object" ? account : {};
    } catch (_err) {
      return {};
    }
  }

  async function getMultiplayerIdentityOptions(localPresence = getLocalPresenceOptions()) {
    const account = getStoredAccountIdentity();
    const fallbackDisplayName = String(localPresence.displayName || account.pilot_name || account.username || "Pilot").slice(0, 80);
    const identityOptions = {
      authStatus: "guest",
      displayName: fallbackDisplayName,
      playerId: "",
      supabaseUserId: "",
      supabaseAccessToken: ""
    };

    try {
      const supabaseClient = await waitForSupabaseClient(hasStagingFlag() ? 3000 : 0);
      const sessionResponse = await waitForSupabaseSession(supabaseClient, hasStagingFlag() ? 3500 : 0);
      const session = sessionResponse?.data?.session || null;
      const user = session?.user || null;

      if (user?.id) {
        const supabaseDisplayName = user.user_metadata?.pilot_name ||
          user.user_metadata?.displayName ||
          user.user_metadata?.name ||
          user.email?.split?.("@")?.[0] ||
          fallbackDisplayName;
        identityOptions.authStatus = "authenticated";
        identityOptions.playerId = String(user.id);
        identityOptions.supabaseUserId = String(user.id);
        identityOptions.displayName = String(supabaseDisplayName).slice(0, 80);
        identityOptions.supabaseAccessToken = String(session.access_token || "");
      }
    } catch (err) {
      logDev("Supabase staging identity unavailable; connecting as guest", err);
    }

    identity.authStatus = identityOptions.authStatus;
    identity.playerIdPresent = !!identityOptions.playerId;
    identity.sessionPresent = !!identityOptions.supabaseUserId;
    identity.tokenPresent = !!identityOptions.supabaseAccessToken;
    identity.sessionWaitTimedOut = hasStagingFlag() && !identityOptions.supabaseAccessToken;
    identity.displayName = identityOptions.displayName || fallbackDisplayName;
    identity.lastCheckedAt = Date.now();

    return identityOptions;
  }

  function delay(ms) {
    return new Promise((resolve) => global.setTimeout(resolve, ms));
  }

  async function waitForSupabaseClient(timeoutMs = 0) {
    const startedAt = Date.now();
    const getClient = () => {
      if (typeof global.getSupabaseClient === "function") return global.getSupabaseClient();
      return global.lupenSupabase || null;
    };

    let supabaseClient = getClient();
    if (supabaseClient?.auth?.getSession || timeoutMs <= 0) return supabaseClient;

    while (Date.now() - startedAt < timeoutMs) {
      await delay(150);
      supabaseClient = getClient();
      if (supabaseClient?.auth?.getSession) return supabaseClient;
    }

    return supabaseClient;
  }

  function getSupabaseClientIfAvailable() {
    try {
      if (typeof global.getSupabaseClient === "function") return global.getSupabaseClient();
      return global.lupenSupabase || null;
    } catch (_err) {
      return null;
    }
  }

  async function waitForSupabaseSession(supabaseClient, timeoutMs = 0) {
    if (!supabaseClient?.auth?.getSession) return null;
    const startedAt = Date.now();
    let lastResponse = await supabaseClient.auth.getSession();
    if (lastResponse?.data?.session || timeoutMs <= 0) return lastResponse;

    while (Date.now() - startedAt < timeoutMs) {
      await delay(150);
      lastResponse = await supabaseClient.auth.getSession();
      if (lastResponse?.data?.session) return lastResponse;
    }

    return lastResponse;
  }

  function scheduleStagingAuthReconnect() {
    if (!hasStagingFlag() || identity.authReconnectAttempted) return;

    const startedAt = Date.now();
    const tryReconnect = async () => {
      if (!connection.isConnected || !room || identity.tokenSent || identity.authReconnectAttempted) return;
      const identityOptions = await getMultiplayerIdentityOptions(getLocalPresenceOptions());
      if (!identityOptions.supabaseAccessToken) {
        if (Date.now() - startedAt < 12000) global.setTimeout(tryReconnect, 900);
        return;
      }

      identity.authReconnectAttempted = true;
      logDev("reconnecting with Supabase staging token");
      try {
        const previousRoom = room;
        await Promise.resolve(previousRoom.leave());
      } catch (_err) {
        // Best-effort reconnect only; failed leave will be followed by a new join.
      }
      room = null;
      connection.isConnected = false;
      connection.isConnecting = false;
      connection.sessionId = null;
      playersById.clear();
      botsById.clear();
      resourcesById.clear();
      connection.presenceEvents = [];
      clearChatMessages();
      notifyServerState(null);
      await client.connect({ sendInitialPing: false });
    };

    global.setTimeout(tryReconnect, 900);
  }

  async function reconnectWithStagingAuth(reason = "auth_state_change") {
    if (!hasStagingFlag() || !connection.enabled) return;

    const identityOptions = await getMultiplayerIdentityOptions(getLocalPresenceOptions());
    if (!identityOptions.supabaseAccessToken) {
      connection.lastServerWarning = "staging_login_required";
      if (!connection.isConnected) {
        connection.lastError = "Supabase session unavailable; login required for staging writes.";
      }
      return;
    }

    const shouldReconnect = !connection.isConnected ||
      !room ||
      !identity.tokenSent ||
      playersById.get(connection.sessionId)?.authStatus !== "verified";
    if (!shouldReconnect) return;

    logDev("reconnecting staging multiplayer after Supabase auth update", { reason });
    try {
      const previousRoom = room;
      if (previousRoom) await Promise.resolve(previousRoom.leave());
    } catch (_err) {
      // Best-effort reconnect; the new join below is authoritative for client state.
    }

    room = null;
    colyseusClient = null;
    connection.isConnected = false;
    connection.isConnecting = false;
    connection.sessionId = null;
    identity.authReconnectAttempted = true;
    playersById.clear();
    botsById.clear();
    resourcesById.clear();
    connection.presenceEvents = [];
    clearChatMessages();
    notifyServerState(null);
    await client.connect({ sendInitialPing: false });
  }

  function registerSupabaseAuthReconnect() {
    if (authStateListenerRegistered || !hasStagingFlag()) return;

    const supabaseClient = getSupabaseClientIfAvailable();
    if (!supabaseClient?.auth?.onAuthStateChange) {
      global.setTimeout(registerSupabaseAuthReconnect, 500);
      return;
    }

    authStateListenerRegistered = true;
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (!hasStagingFlag()) return;
      const hasToken = !!session?.access_token;
      identity.sessionPresent = !!session?.user?.id;
      identity.tokenPresent = hasToken;
      if (!hasToken) return;
      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
        reconnectWithStagingAuth(event).catch((err) => {
          setError(err);
        });
      }
    });
  }

  function getStagingWeaponIntent() {
    try {
      const localPresence = getLocalPresenceOptions();
      const equippedWeaponKeys = Array.isArray(localPresence.equippedWeaponKeys)
        ? localPresence.equippedWeaponKeys.map((key) => String(key || "")).filter(Boolean)
        : String(localPresence.equippedWeaponKeys || "").split(",").map((key) => key.trim()).filter(Boolean);
      const equippedWeaponKey = String(localPresence.equippedWeaponKey || equippedWeaponKeys[0] || "");
      if (typeof global.getEquippedWeapon !== "function") {
        return {
          weaponId: equippedWeaponKey || "stagingFallback",
          weaponKey: equippedWeaponKey,
          equippedWeaponKey,
          equippedWeaponKeys,
          weaponName: "Staging Fallback",
          weaponFamily: "staging-fallback",
          weaponType: "staging-fallback"
        };
      }

      const weapon = global.getEquippedWeapon() || {};
      const weaponKeys = Array.isArray(weapon.weaponKeys)
        ? weapon.weaponKeys.map((key) => String(key || "")).filter(Boolean)
        : [];
      const normalizedWeaponKeys = equippedWeaponKeys.length ? equippedWeaponKeys : weaponKeys;
      const normalizedWeaponKey = String(equippedWeaponKey || normalizedWeaponKeys[0] || weapon.key || weapon.id || "");
      return {
        weaponId: String(normalizedWeaponKey || weapon.familyId || weapon.fireStyle || "equippedWeapon"),
        weaponKey: normalizedWeaponKey,
        equippedWeaponKey: normalizedWeaponKey,
        equippedWeaponKeys: normalizedWeaponKeys,
        weaponName: String(weapon.name || "Equipped Weapon").slice(0, 80),
        weaponFamily: String(weapon.familyId || weapon.family || weapon.fireStyle || weapon.type || ""),
        weaponType: String(weapon.type || weapon.fireStyle || ""),
        quality: String(weapon.quality || ""),
        level: Number.isFinite(Number(weapon.level)) ? Number(weapon.level) : 0
      };
    } catch (err) {
      logDev("staging weapon payload fallback", err);
      return {
        weaponId: "stagingFallback",
        weaponKey: "",
        equippedWeaponKey: "",
        equippedWeaponKeys: [],
        weaponName: "Staging Fallback",
        weaponFamily: "staging-fallback",
        weaponType: "staging-fallback"
      };
    }
  }

  function ensureEnabled(action) {
    updateEnabledState();

    if (connection.enabled) return null;

    return disabledResult(action, {
      reason: connection.enabledReason
    });
  }

  function loadClientScript(scriptSource) {
    return new Promise((resolve, reject) => {
      if (!global.document || !global.document.head) {
        reject(new Error("document_unavailable"));
        return;
      }

      const existingScript = global.document.querySelector(`script[data-lupen-colyseus-client-source="${scriptSource.source}"]`);
      if (existingScript && global.Colyseus && typeof global.Colyseus.Client === "function") {
        resolve(global.Colyseus);
        return;
      }

      if (existingScript) existingScript.remove();

      const script = global.document.createElement("script");
      let settled = false;
      const timeout = global.setTimeout(() => {
        if (settled) return;
        settled = true;
        script.remove();
        reject(new Error(`${scriptSource.source}:timeout`));
      }, 7000);

      script.src = scriptSource.url;
      script.async = true;
      script.dataset.lupenColyseusClient = "true";
      script.dataset.lupenColyseusClientSource = scriptSource.source;
      script.onload = () => {
        if (settled) return;
        settled = true;
        global.clearTimeout(timeout);
        if (global.Colyseus && typeof global.Colyseus.Client === "function") {
          resolve(global.Colyseus);
          return;
        }

        script.remove();
        reject(new Error(`${scriptSource.source}:client_unavailable`));
      };
      script.onerror = () => {
        if (settled) return;
        settled = true;
        global.clearTimeout(timeout);
        script.remove();
        reject(new Error(`${scriptSource.source}:load_failed`));
      };
      global.document.head.appendChild(script);
    });
  }

  async function loadBrowserClientFromSources() {
    if (global.Colyseus && typeof global.Colyseus.Client === "function") {
      connection.clientLoadSource = connection.clientLoadSource || "existing";
      connection.clientLoadError = null;
      return Promise.resolve(global.Colyseus);
    }

    const errors = [];
    for (const scriptSource of clientScriptSources) {
      try {
        logDev(`loading Colyseus browser client from ${scriptSource.source}`, scriptSource.url);
        const Colyseus = await loadClientScript(scriptSource);
        connection.clientLoadSource = scriptSource.source;
        connection.clientLoadError = null;
        logDev(`loaded Colyseus browser client from ${scriptSource.source}`);
        return Colyseus;
      } catch (err) {
        errors.push(err && err.message ? err.message : String(err));
        connection.clientLoadError = errors.join(" | ");
        logDev(`Colyseus browser client load failed from ${scriptSource.source}`, err);
      }
    }

    throw new Error(`colyseus_client_load_failed: ${errors.join(" | ")}`);
  }

  function ensureBrowserClientLoaded() {
    if (global.Colyseus && typeof global.Colyseus.Client === "function") {
      connection.clientLoadSource = connection.clientLoadSource || "existing";
      connection.clientLoadError = null;
      return Promise.resolve(global.Colyseus);
    }

    if (!clientScriptPromise) {
      clientScriptPromise = loadBrowserClientFromSources().catch((err) => {
        clientScriptPromise = null;
        setClientLoadError(err);
        throw err;
      });
    }

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

  function refreshCloudSaveAfterStagingXpClaim(result) {
    const playerSaveWritten = result?.playerSave?.written === true ||
      result?.claimStatus?.playerSave?.written === true ||
      result?.playerSavePatchResult?.applied === true;
    if (!isEnabled() || !playerSaveWritten) return;

    const trustedXpAfter = Number(
      result?.xpAfter ??
      result?.playerSavePatchResult?.xpAfter ??
      result?.playerSave?.xpAfter ??
      result?.claimStatus?.playerSave?.xpAfter
    );
    const source = result?.botId ? "botKill" : "bountyClaim";

    const localApplied = typeof global.applyStagingXpClaimToLoadedState === "function"
      ? global.applyStagingXpClaimToLoadedState(result)
      : false;
    const immediateSnapshot = typeof global.getLupenCombatXpSnapshot === "function"
      ? global.getLupenCombatXpSnapshot()
      : null;
    connection.lastStagingXpRefresh = {
      source,
      status: localApplied ? "hud_refreshed" : "hud_refresh_pending",
      trustedXpAfter: Number.isFinite(trustedXpAfter) ? trustedXpAfter : null,
      refreshXp: Number.isFinite(Number(immediateSnapshot?.combatXp)) ? Number(immediateSnapshot.combatXp) : null,
      matched: Number.isFinite(trustedXpAfter) && Number.isFinite(Number(immediateSnapshot?.combatXp))
        ? Number(immediateSnapshot.combatXp) >= trustedXpAfter
        : false,
      stale: false,
      reason: localApplied ? "hud_xp_refreshed" : "hud_xp_refresh_not_applied",
      checkedAt: Date.now()
    };
    notifyServerState(room?.state || null);

    if (typeof global.loadGameFromSupabase !== "function") {
      connection.lastStagingXpRefresh = {
        source,
        status: "local_applied",
        trustedXpAfter: Number.isFinite(trustedXpAfter) ? trustedXpAfter : null,
        refreshXp: null,
        matched: false,
        stale: false,
        reason: "loadGameFromSupabase_unavailable",
        checkedAt: Date.now()
      };
      notifyServerState(room?.state || null);
      return;
    }

    Promise.resolve()
      .then(() => global.loadGameFromSupabase())
      .then((loadResult) => {
        if (typeof global.applyStagingXpClaimToLoadedState === "function") {
          global.applyStagingXpClaimToLoadedState(result);
        }
        const snapshot = typeof global.getLupenCombatXpSnapshot === "function"
          ? global.getLupenCombatXpSnapshot()
          : null;
        const refreshXp = Number(loadResult?.combatXp ?? snapshot?.combatXp);
        const staleInfo = snapshot?.lastStagingXpRefresh || null;
        connection.lastStagingXpRefresh = {
          source,
          status: "refreshed",
          trustedXpAfter: Number.isFinite(trustedXpAfter) ? trustedXpAfter : null,
          refreshXp: Number.isFinite(refreshXp) ? refreshXp : null,
          matched: Number.isFinite(trustedXpAfter) && Number.isFinite(refreshXp) ? refreshXp >= trustedXpAfter : false,
          stale: staleInfo?.stale === true || loadResult?.staleStagingXpRefresh === true,
          reason: staleInfo?.stale === true || loadResult?.staleStagingXpRefresh === true ? "xp_refresh_stale_guarded" : "xp_refresh_loaded",
          checkedAt: Date.now()
        };
        logDev("refreshed cloud save after staging XP claim");
        notifyServerState(room?.state || null);
      })
      .catch((error) => {
        connection.lastServerWarning = "staging_xp_save_refresh_failed";
        connection.lastStagingXpRefresh = {
          source,
          status: "failed",
          trustedXpAfter: Number.isFinite(trustedXpAfter) ? trustedXpAfter : null,
          refreshXp: null,
          matched: false,
          stale: false,
          reason: "staging_xp_save_refresh_failed",
          checkedAt: Date.now()
        };
        logDev("staging XP save refresh failed", error?.message || error);
        notifyServerState(room?.state || null);
      });
  }

  function getTrustedXpAfter(result = {}) {
    const value = Number(
      result?.xpAfter ??
      result?.persistedXp ??
      result?.playerSavePatchResult?.xpAfter ??
      result?.playerSavePatchResult?.persistedXp ??
      result?.playerSave?.xpAfter ??
      result?.claimStatus?.playerSave?.xpAfter ??
      connection.lastStagingBotXpResult?.xpAfter ??
      connection.lastRewardClaimResult?.xpAfter ??
      connection.lastStagingBountyClaimResult?.xpAfter
    );
    return Number.isFinite(value) ? Math.max(0, Math.round(value)) : null;
  }

  function scheduleStagingCombatProgressRefresh(reason = "combatRefresh", result = {}, delayMs = 500, retry = true) {
    if (!isEnabled()) return;
    const trustedXpAfter = getTrustedXpAfter(result);

    if (stagingCombatRefreshTimer) {
      global.clearTimeout(stagingCombatRefreshTimer);
      stagingCombatRefreshTimer = null;
    }
    if (stagingCombatRefreshRetryTimer) {
      global.clearTimeout(stagingCombatRefreshRetryTimer);
      stagingCombatRefreshRetryTimer = null;
    }

    stagingCombatRefreshTimer = global.setTimeout(() => {
      stagingCombatRefreshTimer = null;
      if (typeof global.refreshProgressAfterStagingCombat !== "function") {
        connection.lastStagingXpRefresh = {
          source: reason,
          status: "refresh_unavailable",
          trustedXpAfter,
          refreshXp: null,
          matched: false,
          stale: false,
          reason: "refreshProgressAfterStagingCombat_unavailable",
          checkedAt: Date.now()
        };
        notifyServerState(room?.state || null);
        return;
      }

      Promise.resolve(global.refreshProgressAfterStagingCombat({
        reason,
        trustedXpAfter
      })).then((refreshResult = {}) => {
        connection.lastStagingXpRefresh = {
          source: reason,
          status: refreshResult.reason || "combat_refresh",
          trustedXpAfter: Number.isFinite(Number(refreshResult.trustedXpAfter)) ? Number(refreshResult.trustedXpAfter) : trustedXpAfter,
          refreshXp: Number.isFinite(Number(refreshResult.cloudXp)) ? Number(refreshResult.cloudXp) : null,
          localXp: Number.isFinite(Number(refreshResult.localXp)) ? Number(refreshResult.localXp) : null,
          appliedXp: Number.isFinite(Number(refreshResult.appliedXp)) ? Number(refreshResult.appliedXp) : null,
          matched: refreshResult.matched === true,
          stale: refreshResult.stale === true,
          reason: refreshResult.reason || "combat_refresh_complete",
          checkedAt: Date.now()
        };
        notifyServerState(room?.state || null);

        if (retry && !refreshResult.matched) {
          stagingCombatRefreshRetryTimer = global.setTimeout(() => {
            stagingCombatRefreshRetryTimer = null;
            scheduleStagingCombatProgressRefresh(`${reason}:retry`, { xpAfter: trustedXpAfter }, 0, false);
          }, 1500);
        }
      }).catch((error) => {
        connection.lastStagingXpRefresh = {
          source: reason,
          status: "failed",
          trustedXpAfter,
          refreshXp: null,
          matched: false,
          stale: false,
          reason: error?.message || "combat_refresh_failed",
          checkedAt: Date.now()
        };
        notifyServerState(room?.state || null);
      });
    }, Math.max(0, Number(delayMs || 0)));
  }

  function refreshCloudSaveAfterStagingLootClaim(result) {
    const saveWritten = result?.writes?.saveWritten === true || result?.saveWritten === true;
    if (!isEnabled() || !saveWritten || typeof global.loadGameFromSupabase !== "function") return;

    Promise.resolve()
      .then(() => global.loadGameFromSupabase())
      .then(() => {
        logDev("refreshed cloud save after staging loot claim");
      })
      .catch((error) => {
        connection.lastServerWarning = "staging_loot_save_refresh_failed";
        logDev("staging loot save refresh failed", error?.message || error);
      });
  }

  function normalizeNodeKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ");
  }

  function normalizeChatChannel(value = "") {
    return "sector";
  }

  function normalizeChatText(value = "") {
    return String(value || "").replace(/\s+/g, " ").trim().slice(0, 200);
  }

  function normalizeChatMessage(message = {}) {
    const text = normalizeChatText(message.message || message.text);
    const type = String(message.type || "chat");
    if (!text && type !== "system") return null;
    return {
      id: String(message.id || `${message.receivedAt || Date.now()}-${message.sessionId || type}`),
      ok: message.ok !== false,
      type,
      channel: normalizeChatChannel(message.channel),
      message: text || String(message.message || ""),
      displayName: String(message.displayName || (type === "system" ? "System" : "Pilot")).slice(0, 80),
      sessionId: String(message.sessionId || ""),
      currentNode: String(message.currentNode || ""),
      reason: String(message.reason || ""),
      receivedAt: Number.isFinite(Number(message.receivedAt)) ? Number(message.receivedAt) : Date.now()
    };
  }

  function pushChatMessage(message) {
    const normalized = normalizeChatMessage(message);
    if (!normalized) return null;
    const dedupeKey = normalized.id ||
      `${normalized.type}|${normalized.channel}|${normalized.sessionId}|${normalized.displayName}|${normalized.message}|${normalized.receivedAt}`;
    if (chatMessageKeys.has(dedupeKey)) return null;
    chatMessageKeys.add(dedupeKey);
    connection.chatMessages.push(normalized);
    while (connection.chatMessages.length > 80) {
      const removed = connection.chatMessages.shift();
      if (removed) {
        chatMessageKeys.delete(removed.id ||
          `${removed.type}|${removed.channel}|${removed.sessionId}|${removed.displayName}|${removed.message}|${removed.receivedAt}`);
      }
    }
    return normalized;
  }

  function normalizePresenceEvent(event = {}) {
    return {
      type: String(event.type || "presence"),
      sessionId: String(event.sessionId || ""),
      displayName: String(event.displayName || "Pilot").slice(0, 80),
      currentNode: String(event.currentNode || ""),
      previousNode: String(event.previousNode || ""),
      presenceStatus: String(event.presenceStatus || event.status || "space") === "docked" ? "docked" : "space",
      receivedAt: Number.isFinite(Number(event.receivedAt)) ? Number(event.receivedAt) : Date.now()
    };
  }

  function pushPresenceEvent(event) {
    const normalized = normalizePresenceEvent(event);
    connection.presenceEvents.push(normalized);
    while (connection.presenceEvents.length > 60) connection.presenceEvents.shift();
    return normalized;
  }

  function getPlayerIdentityKey(player = {}) {
    const trustedId = String(player.trustedPlayerId || player.playerId || player.supabaseUserId || "").trim().toLowerCase();
    if (trustedId) return `account:${trustedId}`;
    const displayName = String(player.displayName || "").trim().toLowerCase();
    return displayName ? `display:${displayName}` : "";
  }

  function shouldReplacePlayerSnapshot(existing, candidate) {
    if (!existing) return true;
    if (candidate.isSelf) return true;
    if (existing.isSelf && !candidate.isSelf) return false;
    const existingSeenAt = Number(existing.lastSeenAt || existing.joinedAt || 0);
    const candidateSeenAt = Number(candidate.lastSeenAt || candidate.joinedAt || 0);
    if (candidateSeenAt !== existingSeenAt) return candidateSeenAt > existingSeenAt;
    return String(candidate.sessionId || "") > String(existing.sessionId || "");
  }

  function setPlayerSnapshot(snapshot) {
    if (!snapshot) return;
    const identityKey = getPlayerIdentityKey(snapshot);
    if (identityKey) {
      let keepCandidate = true;
      Array.from(playersById.entries()).forEach(([id, existing]) => {
        if (id === snapshot.id) return;
        if (getPlayerIdentityKey(existing) !== identityKey) return;
        if (shouldReplacePlayerSnapshot(existing, snapshot)) {
          playersById.delete(id);
        } else {
          keepCandidate = false;
        }
      });
      if (!keepCandidate) return;
    }

    const current = playersById.get(snapshot.id);
    if (!current || shouldReplacePlayerSnapshot(current, snapshot)) {
      playersById.set(snapshot.id, snapshot);
    }
  }

  function normalizePlayer(player, fallbackId = "") {
    if (!player) return null;

    const sessionId = String(player.sessionId || player.id || fallbackId || "");
    const id = String(player.id || sessionId || fallbackId || "");
    if (!id) return null;

    return {
      id,
      sessionId,
      displayName: String(player.displayName || "Pilot"),
      authStatus: String(player.authStatus || "guest"),
      playerId: String(player.playerId || player.supabaseUserId || ""),
      supabaseUserId: String(player.supabaseUserId || player.playerId || ""),
      trustedPlayerId: String(player.trustedPlayerId || ""),
      authTokenReceived: player.authTokenReceived === true,
      authVerificationAttempted: player.authVerificationAttempted === true,
      authVerificationReason: String(player.authVerificationReason || ""),
      guildId: String(player.guildId || ""),
      currentShipId: String(player.currentShipId || ""),
      shipName: String(player.shipName || player.ship || ""),
      shipImage: String(player.shipImage || player.shipImageSrc || player.shipImagePath || ""),
      shipImageSrc: String(player.shipImageSrc || player.shipImage || player.shipImagePath || ""),
      shipImagePath: String(player.shipImagePath || player.shipImage || player.shipImageSrc || ""),
      shipClass: String(player.shipClass || ""),
      equippedWeaponKey: String(player.equippedWeaponKey || ""),
      equippedWeaponKeys: String(player.equippedWeaponKeys || "").split(",").map((key) => key.trim()).filter(Boolean),
      selectedTargetBotId: String(player.selectedTargetBotId || ""),
      lastCombatIntentReason: String(player.lastCombatIntentReason || ""),
      lastLockOnClearReason: String(player.lastLockOnClearReason || ""),
      lastWeaponSourceReason: String(player.lastWeaponSourceReason || ""),
      lastCombatNodeValidationReason: String(player.lastCombatNodeValidationReason || ""),
      activeShipWeaponCount: Number.isFinite(Number(player.activeShipWeaponCount)) ? Number(player.activeShipWeaponCount) : 0,
      validCombatWeaponCount: Number.isFinite(Number(player.validCombatWeaponCount)) ? Number(player.validCombatWeaponCount) : 0,
      rejectedWeaponCount: Number.isFinite(Number(player.rejectedWeaponCount)) ? Number(player.rejectedWeaponCount) : 0,
      firstRejectedWeaponReason: String(player.firstRejectedWeaponReason || ""),
      x: Number.isFinite(Number(player.x)) ? Number(player.x) : 50,
      y: Number.isFinite(Number(player.y)) ? Number(player.y) : 50,
      currentNode: String(player.currentNode || "Asteron Prime"),
      presenceStatus: String(player.presenceStatus || player.status || "space") === "docked" ? "docked" : "space",
      joinedAt: Number.isFinite(Number(player.joinedAt)) ? Number(player.joinedAt) : 0,
      lastSeenAt: Number.isFinite(Number(player.lastSeenAt)) ? Number(player.lastSeenAt) : 0,
      lastFireAt: Number.isFinite(Number(player.lastFireAt)) ? Number(player.lastFireAt) : 0,
      nextFireAt: Number.isFinite(Number(player.nextFireAt)) ? Number(player.nextFireAt) : 0,
      isSelf: sessionId === connection.sessionId
    };
  }

  function updatePlayersFromServerState(serverState) {
    playersById.clear();

    const players = serverState?.players;
    if (!players) return;

    if (typeof players.forEach === "function") {
      players.forEach((player, key) => {
        const snapshot = normalizePlayer(player, key);
        setPlayerSnapshot(snapshot);
      });
      return;
    }

    Object.entries(players).forEach(([key, player]) => {
      const snapshot = normalizePlayer(player, key);
      setPlayerSnapshot(snapshot);
    });
  }

  function normalizeBot(bot, fallbackId = "") {
    if (!bot) return null;

    const id = String(bot.id || fallbackId || "");
    if (!id) return null;

    return {
      id,
      type: String(bot.type || "Dev Bot"),
      name: String(bot.name || bot.type || "Dev Bot"),
      faction: String(bot.faction || ""),
      x: Number.isFinite(Number(bot.x)) ? Number(bot.x) : 50,
      y: Number.isFinite(Number(bot.y)) ? Number(bot.y) : 50,
      level: Number.isFinite(Number(bot.level)) ? Number(bot.level) : 0,
      shield: Number.isFinite(Number(bot.shield)) ? Number(bot.shield) : 0,
      shieldMax: Number.isFinite(Number(bot.shieldMax)) ? Number(bot.shieldMax) : 0,
      hull: Number.isFinite(Number(bot.hull)) ? Number(bot.hull) : 0,
      hullMax: Number.isFinite(Number(bot.hullMax)) ? Number(bot.hullMax) : 0,
      currentNode: String(bot.currentNode || "Asteron Prime"),
      lastUpdatedAt: Number.isFinite(Number(bot.lastUpdatedAt)) ? Number(bot.lastUpdatedAt) : 0,
      nextMoveAt: Number.isFinite(Number(bot.nextMoveAt)) ? Number(bot.nextMoveAt) : 0,
      visualOnly: bot.visualOnly !== false,
      disabled: bot.disabled === true,
      disabledUntil: Number.isFinite(Number(bot.disabledUntil)) ? Number(bot.disabledUntil) : 0
    };
  }

  function normalizeRewardContributor(contributor) {
    if (!contributor) return null;

    const sessionId = String(contributor.sessionId || contributor.id || "");
    if (!sessionId) return null;

    return {
      sessionId,
      playerId: String(contributor.playerId || contributor.supabaseUserId || ""),
      supabaseUserId: String(contributor.supabaseUserId || contributor.playerId || ""),
      trustedPlayerId: String(contributor.trustedPlayerId || ""),
      displayName: String(contributor.displayName || "Pilot"),
      authStatus: String(contributor.authStatus || "guest"),
      totalDamage: Number.isFinite(Number(contributor.totalDamage)) ? Number(contributor.totalDamage) : 0,
      hits: Number.isFinite(Number(contributor.hits)) ? Number(contributor.hits) : 0,
      lastHitAt: Number.isFinite(Number(contributor.lastHitAt)) ? Number(contributor.lastHitAt) : 0,
      percent: Number.isFinite(Number(contributor.percent)) ? Number(contributor.percent) : 0
    };
  }

  function normalizeRewardWritePlan(plan) {
    if (!plan || typeof plan !== "object") return null;

    return {
      playerId: String(plan.playerId || ""),
      trustedPlayerId: String(plan.trustedPlayerId || ""),
      authStatus: String(plan.authStatus || "guest"),
      displayName: String(plan.displayName || "Pilot"),
      botId: String(plan.botId || ""),
      botName: String(plan.botName || "Staging Bot"),
      node: String(plan.node || ""),
      finalHitBy: String(plan.finalHitBy || ""),
      topContributorSessionId: String(plan.topContributorSessionId || ""),
      contributorSessionId: String(plan.contributorSessionId || ""),
      contributionPercent: Number.isFinite(Number(plan.contributionPercent)) ? Number(plan.contributionPercent) : 0,
      intendedXp: Number.isFinite(Number(plan.intendedXp)) ? Number(plan.intendedXp) : 0,
      intendedCredits: Number.isFinite(Number(plan.intendedCredits)) ? Number(plan.intendedCredits) : 0,
      intendedLoot: Array.isArray(plan.intendedLoot)
        ? plan.intendedLoot.map((item) => String(item || "")).filter(Boolean)
        : [],
      intendedReason: String(plan.intendedReason || "staging_bot_disabled"),
      eligible: plan.eligible === true,
      blockedReason: String(plan.blockedReason || ""),
      applied: plan.applied === true,
      dryRun: plan.dryRun !== false
    };
  }

  function normalizeRewardLedgerResult(result) {
    if (!result || typeof result !== "object") return null;

    return {
      ok: result.ok === true,
      applied: result.applied === true,
      dryRun: result.dryRun !== false,
      skippedReason: String(result.skippedReason || ""),
      ledgerId: String(result.ledgerId || ""),
      entry: result.entry && typeof result.entry === "object"
        ? {
          playerId: String(result.entry.player_id || ""),
          roomName: String(result.entry.room_name || ""),
          botId: String(result.entry.bot_id || ""),
          botName: String(result.entry.bot_name || "Staging Bot"),
          node: String(result.entry.node || ""),
          rewardReason: String(result.entry.reward_reason || "staging_bot_disabled"),
          xpAmount: Number.isFinite(Number(result.entry.xp_amount)) ? Number(result.entry.xp_amount) : 0,
          creditsAmount: Number.isFinite(Number(result.entry.credits_amount)) ? Number(result.entry.credits_amount) : 0,
          contributionPercent: Number.isFinite(Number(result.entry.contribution_percent)) ? Number(result.entry.contribution_percent) : 0,
          finalHit: result.entry.final_hit === true,
          topContributor: result.entry.top_contributor === true,
          sourceEventId: String(result.entry.source_event_id || ""),
          applied: result.entry.applied === true,
          dryRun: result.entry.dry_run !== false
        }
        : null
    };
  }

  function normalizeRewardApplicationPlan(plan) {
    if (!plan || typeof plan !== "object") return null;

    return {
      playerId: String(plan.playerId || ""),
      displayName: String(plan.displayName || "Pilot"),
      authStatus: String(plan.authStatus || "guest"),
      botId: String(plan.botId || ""),
      botName: String(plan.botName || "Staging Bot"),
      node: String(plan.node || ""),
      xpDelta: Number.isFinite(Number(plan.xpDelta)) ? Number(plan.xpDelta) : 0,
      creditsDelta: Number.isFinite(Number(plan.creditsDelta)) ? Number(plan.creditsDelta) : 0,
      lootAdditions: Array.isArray(plan.lootAdditions)
        ? plan.lootAdditions.map((item) => String(item || "")).filter(Boolean)
        : [],
      reason: String(plan.reason || "staging_bot_disabled"),
      sourceLedgerId: String(plan.sourceLedgerId || ""),
      sourceEventId: String(plan.sourceEventId || ""),
      idempotencyKey: String(plan.idempotencyKey || ""),
      idempotencyReady: plan.idempotencyReady === true,
      duplicateDetected: plan.duplicateDetected === true,
      contributionPercent: Number.isFinite(Number(plan.contributionPercent)) ? Number(plan.contributionPercent) : 0,
      finalHit: plan.finalHit === true,
      topContributor: plan.topContributor === true,
      eligible: plan.eligible === true,
      blockedReason: String(plan.blockedReason || ""),
      applied: plan.applied === true,
      dryRun: plan.dryRun !== false
    };
  }

  function normalizeRewardApplicationResult(result) {
    if (!result || typeof result !== "object") return null;

    return {
      ok: result.ok === true,
      applied: result.applied === true,
      dryRun: result.dryRun !== false,
      skippedReason: String(result.skippedReason || ""),
      idempotencyKey: String(result.idempotencyKey || ""),
      idempotencyReady: result.idempotencyReady === true,
      duplicateDetected: result.duplicateDetected === true,
      plan: normalizeRewardApplicationPlan(result.plan)
    };
  }

  function normalizeProgressionPreview(preview) {
    if (!preview || typeof preview !== "object") return null;

    return {
      available: preview.available === true,
      reason: String(preview.reason || ""),
      playerId: String(preview.playerId || ""),
      currentXp: Number.isFinite(Number(preview.currentXp)) ? Number(preview.currentXp) : null,
      previewXp: Number.isFinite(Number(preview.previewXp)) ? Number(preview.previewXp) : null,
      xpDelta: Number.isFinite(Number(preview.xpDelta)) ? Number(preview.xpDelta) : 0,
      currentCredits: Number.isFinite(Number(preview.currentCredits)) ? Number(preview.currentCredits) : null,
      previewCredits: Number.isFinite(Number(preview.previewCredits)) ? Number(preview.previewCredits) : null,
      creditsDelta: Number.isFinite(Number(preview.creditsDelta)) ? Number(preview.creditsDelta) : 0,
      currentLevel: Number.isFinite(Number(preview.currentLevel)) ? Number(preview.currentLevel) : null,
      inventoryCount: Number.isFinite(Number(preview.inventoryCount)) ? Number(preview.inventoryCount) : null,
      intendedLootAdditions: Array.isArray(preview.intendedLootAdditions)
        ? preview.intendedLootAdditions.map((item) => String(item || "")).filter(Boolean)
        : [],
      applied: preview.applied === true,
      dryRun: preview.dryRun !== false,
      progressionWritesEnabled: preview.progressionWritesEnabled === true,
      savedAt: String(preview.savedAt || "")
    };
  }

  function normalizeProgressionShadowResult(result) {
    if (!result || typeof result !== "object") return null;

    return {
      ok: result.ok === true,
      applied: result.applied === true,
      dryRun: result.dryRun !== false,
      skippedReason: String(result.skippedReason || ""),
      shadowId: String(result.shadowId || ""),
      entry: result.entry && typeof result.entry === "object"
        ? {
          playerId: String(result.entry.player_id || ""),
          sourceLedgerId: String(result.entry.source_ledger_id || ""),
          sourceEventId: String(result.entry.source_event_id || ""),
          roomName: String(result.entry.room_name || ""),
          rewardReason: String(result.entry.reward_reason || "staging_bot_disabled"),
          currentXp: Number.isFinite(Number(result.entry.current_xp)) ? Number(result.entry.current_xp) : null,
          previewXp: Number.isFinite(Number(result.entry.preview_xp)) ? Number(result.entry.preview_xp) : null,
          xpDelta: Number.isFinite(Number(result.entry.xp_delta)) ? Number(result.entry.xp_delta) : 0,
          currentCredits: Number.isFinite(Number(result.entry.current_credits)) ? Number(result.entry.current_credits) : null,
          previewCredits: Number.isFinite(Number(result.entry.preview_credits)) ? Number(result.entry.preview_credits) : null,
          creditsDelta: Number.isFinite(Number(result.entry.credits_delta)) ? Number(result.entry.credits_delta) : 0,
          appliedToRealSave: result.entry.applied_to_real_save === true,
          dryRun: result.entry.dry_run !== false
        }
        : null
    };
  }

  function normalizePlayerSavePatchPlan(plan) {
    if (!plan || typeof plan !== "object") return null;

    return {
      playerId: String(plan.playerId || ""),
      sourceEventId: String(plan.sourceEventId || ""),
      sourceLedgerId: String(plan.sourceLedgerId || ""),
      idempotencyKey: String(plan.idempotencyKey || ""),
      idempotencyReady: plan.idempotencyReady === true,
      duplicateDetected: plan.duplicateDetected === true,
      xpPath: String(plan.xpPath || ""),
      creditsPath: String(plan.creditsPath || ""),
      xpDelta: Number.isFinite(Number(plan.xpDelta)) ? Number(plan.xpDelta) : 0,
      creditsDelta: Number.isFinite(Number(plan.creditsDelta)) ? Number(plan.creditsDelta) : 0,
      xpBefore: Number.isFinite(Number(plan.xpBefore)) ? Number(plan.xpBefore) : null,
      xpAfter: Number.isFinite(Number(plan.xpAfter)) ? Number(plan.xpAfter) : null,
      creditsBefore: Number.isFinite(Number(plan.creditsBefore)) ? Number(plan.creditsBefore) : null,
      creditsAfter: Number.isFinite(Number(plan.creditsAfter)) ? Number(plan.creditsAfter) : null,
      lootPreviewOnly: Number.isFinite(Number(plan.lootPreviewOnly)) ? Number(plan.lootPreviewOnly) : 0,
      eligible: plan.eligible === true,
      skippedReason: String(plan.skippedReason || ""),
      progressionWritesEnabled: plan.progressionWritesEnabled === true,
      progressionWriteScope: String(plan.progressionWriteScope || ""),
      verifiedScopeEnabled: plan.verifiedScopeEnabled === true,
      stagingWriteAllowlistPresent: plan.stagingWriteAllowlistPresent === true,
      playerInStagingWriteAllowlist: plan.playerInStagingWriteAllowlist === true,
      playerAllowedForStagingWrite: plan.playerAllowedForStagingWrite === true,
      applied: plan.applied === true,
      dryRun: plan.dryRun !== false
    };
  }

  function normalizePlayerSavePatchResult(result) {
    if (!result || typeof result !== "object") return null;

    return {
      ok: result.ok === true,
      applied: result.applied === true,
      dryRun: result.dryRun !== false,
      skippedReason: String(result.skippedReason || ""),
      idempotencyKey: String(result.idempotencyKey || ""),
      idempotencyReady: result.idempotencyReady === true,
      duplicateDetected: result.duplicateDetected === true,
      xpBefore: Number.isFinite(Number(result.xpBefore)) ? Number(result.xpBefore) : null,
      xpAfter: Number.isFinite(Number(result.xpAfter)) ? Number(result.xpAfter) : null,
      persistedXp: Number.isFinite(Number(result.persistedXp)) ? Number(result.persistedXp) : null,
      persistedZoneXp: Number.isFinite(Number(result.persistedZoneXp)) ? Number(result.persistedZoneXp) : null,
      persistenceVerified: result.persistenceVerified === true,
      creditsBefore: Number.isFinite(Number(result.creditsBefore)) ? Number(result.creditsBefore) : null,
      creditsAfter: Number.isFinite(Number(result.creditsAfter)) ? Number(result.creditsAfter) : null,
      progressionWritesEnabled: result.progressionWritesEnabled === true,
      progressionWriteScope: String(result.progressionWriteScope || ""),
      verifiedScopeEnabled: result.verifiedScopeEnabled === true,
      stagingWriteAllowlistPresent: result.stagingWriteAllowlistPresent === true,
      playerInStagingWriteAllowlist: result.playerInStagingWriteAllowlist === true,
      playerAllowedForStagingWrite: result.playerAllowedForStagingWrite === true,
      appliedFields: Array.isArray(result.appliedFields)
        ? result.appliedFields.map((field) => String(field || "")).filter(Boolean)
        : [],
      plan: normalizePlayerSavePatchPlan(result.plan)
    };
  }

  function normalizeClaimGates(gates) {
    if (!gates || typeof gates !== "object") return null;

    return {
      verified: gates.verified === true,
      allowlisted: gates.allowlisted === true,
      scope: String(gates.scope || ""),
      xpWriteAllowed: gates.xpWriteAllowed === true
    };
  }

  function normalizeClaimLedger(ledger) {
    if (!ledger || typeof ledger !== "object") return null;

    return {
      reachable: ledger.reachable === true,
      written: ledger.written === true,
      duplicate: ledger.duplicate === true
    };
  }

  function normalizeClaimProgressionShadow(progressionShadow) {
    if (!progressionShadow || typeof progressionShadow !== "object") return null;

    return {
      reachable: progressionShadow.reachable === true,
      written: progressionShadow.written === true
    };
  }

  function normalizeClaimPlayerSave(playerSave) {
    if (!playerSave || typeof playerSave !== "object") return null;

    return {
      attempted: playerSave.attempted === true,
      written: playerSave.written === true,
      xpBefore: Number.isFinite(Number(playerSave.xpBefore)) ? Number(playerSave.xpBefore) : null,
      xpAfter: Number.isFinite(Number(playerSave.xpAfter)) ? Number(playerSave.xpAfter) : null,
      creditsWritten: playerSave.creditsWritten === true
    };
  }

  function getXpMetadataFromResult(result = {}) {
    const playerSavePatchResult = result.playerSavePatchResult || null;
    const playerSave = result.playerSave || result.claimStatus?.playerSave || null;
    const claimStatus = result.claimStatus || null;
    return {
      xpBefore: Number.isFinite(Number(result.xpBefore ?? playerSavePatchResult?.xpBefore ?? playerSave?.xpBefore))
        ? Number(result.xpBefore ?? playerSavePatchResult?.xpBefore ?? playerSave?.xpBefore)
        : null,
      xpAfter: Number.isFinite(Number(result.xpAfter ?? playerSavePatchResult?.xpAfter ?? playerSave?.xpAfter))
        ? Number(result.xpAfter ?? playerSavePatchResult?.xpAfter ?? playerSave?.xpAfter)
        : null,
      persistedXp: Number.isFinite(Number(result.persistedXp ?? playerSavePatchResult?.persistedXp))
        ? Number(result.persistedXp ?? playerSavePatchResult?.persistedXp)
        : null,
      persistedZoneXp: Number.isFinite(Number(result.persistedZoneXp ?? playerSavePatchResult?.persistedZoneXp))
        ? Number(result.persistedZoneXp ?? playerSavePatchResult?.persistedZoneXp)
        : null,
      persistenceVerified: result.persistenceVerified === true || playerSavePatchResult?.persistenceVerified === true,
      saveWritten: result.saveWritten === true ||
        playerSavePatchResult?.applied === true ||
        playerSave?.written === true ||
        claimStatus?.playerSave?.written === true,
      applied: result.applied === true || playerSavePatchResult?.applied === true || playerSave?.written === true
    };
  }

  function normalizeRewardClaimStatus(status) {
    if (!status || typeof status !== "object") return null;

    return {
      ok: status.ok === true,
      mode: String(status.mode || ""),
      applied: status.applied === true,
      xpDelta: Number.isFinite(Number(status.xpDelta)) ? Number(status.xpDelta) : 0,
      reason: String(status.reason || ""),
      debugReason: String(status.debugReason || ""),
      gates: normalizeClaimGates(status.gates),
      ledger: normalizeClaimLedger(status.ledger),
      progressionShadow: normalizeClaimProgressionShadow(status.progressionShadow),
      playerSave: normalizeClaimPlayerSave(status.playerSave)
    };
  }

  function normalizeStagingLootPreviewItem(item) {
    if (!item || typeof item !== "object") return null;

    return {
      lootId: String(item.lootId || ""),
      name: String(item.name || "Preview Loot"),
      type: String(item.type || "material"),
      rarity: String(item.rarity || "common"),
      quantity: Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : 1,
      description: String(item.description || ""),
      inventoryWritable: item.inventoryWritable === true
    };
  }

  function normalizeStagingLootPreview(preview) {
    if (!preview || typeof preview !== "object") return null;

    return {
      available: preview.available === true,
      mode: String(preview.mode || "preview_only"),
      items: Array.isArray(preview.items)
        ? preview.items.map(normalizeStagingLootPreviewItem).filter(Boolean)
        : [],
      eligibleSessionIds: Array.isArray(preview.eligibleSessionIds)
        ? preview.eligibleSessionIds.map((sessionId) => String(sessionId || "")).filter(Boolean)
        : [],
      inventoryWritten: preview.inventoryWritten === true,
      ownedGunsWritten: preview.ownedGunsWritten === true,
      ownedAttachmentsWritten: preview.ownedAttachmentsWritten === true,
      cargoWritten: preview.cargoWritten === true,
      creditsWritten: preview.creditsWritten === true,
      bountyWritten: preview.bountyWritten === true,
      saveWritten: preview.saveWritten === true,
      reason: String(preview.reason || "preview_only")
    };
  }

  function normalizeStagingLootClaimResult(message) {
    if (!message || typeof message !== "object") return null;

    return {
      ok: message.ok === true,
      applied: message.applied === true,
      botXpAttempted: message.botXpAttempted === true,
      botXpApplied: message.botXpApplied === true,
      botXpBlockReason: String(message.botXpBlockReason || ""),
      dryRun: message.dryRun !== false,
      mode: String(message.mode || ""),
      reason: String(message.reason || ""),
      botId: String(message.botId || ""),
      botName: String(message.botName || "Staging Bot"),
      rewardPreviewId: String(message.rewardPreviewId || ""),
      lootId: String(message.lootId || "lupenShard"),
      lootName: String(message.lootName || "Lupen Shard"),
      quantity: Number.isFinite(Number(message.quantity)) ? Number(message.quantity) : 0,
      materialKey: String(message.materialKey || ""),
      materialBefore: Number.isFinite(Number(message.materialBefore)) ? Number(message.materialBefore) : null,
      materialAfter: Number.isFinite(Number(message.materialAfter)) ? Number(message.materialAfter) : null,
      idempotencyKey: String(message.idempotencyKey || ""),
      idempotencyReady: message.idempotencyReady === true,
      duplicateDetected: message.duplicateDetected === true,
      gates: message.gates && typeof message.gates === "object"
        ? {
          writeEnabled: message.gates.writeEnabled === true,
          dryRun: message.gates.dryRun !== false,
          scope: String(message.gates.scope || ""),
          allowlistPresent: message.gates.allowlistPresent === true,
          playerInAllowlist: message.gates.playerInAllowlist === true,
          playerAllowed: message.gates.playerAllowed === true,
          allowedItems: Array.isArray(message.gates.allowedItems)
            ? message.gates.allowedItems.map((item) => String(item || "")).filter(Boolean)
            : []
        }
        : null,
      writes: {
        materialWritten: message.writes?.materialWritten === true || message.materialWritten === true,
        inventoryWritten: message.writes?.inventoryWritten === true || message.inventoryWritten === true,
        ownedGunsWritten: message.writes?.ownedGunsWritten === true || message.ownedGunsWritten === true,
        ownedAttachmentsWritten: message.writes?.ownedAttachmentsWritten === true || message.ownedAttachmentsWritten === true,
        cargoWritten: message.writes?.cargoWritten === true || message.cargoWritten === true,
        creditsWritten: message.writes?.creditsWritten === true || message.creditsWritten === true,
        bountyWritten: message.writes?.bountyWritten === true || message.bountyWritten === true,
        saveWritten: message.writes?.saveWritten === true || message.saveWritten === true
      },
      plan: message.plan || null,
      writeResult: message.writeResult || null,
      receivedAt: Number.isFinite(Number(message.receivedAt)) ? Number(message.receivedAt) : Date.now()
    };
  }

  function normalizeStagingBounty(bounty) {
    if (!bounty || typeof bounty !== "object") return null;

    return {
      id: String(bounty.id || bounty.bountyId || ""),
      title: String(bounty.title || "Staging Bounty"),
      description: String(bounty.description || ""),
      targetType: String(bounty.targetType || ""),
      requiredKills: Number.isFinite(Number(bounty.requiredKills)) ? Number(bounty.requiredKills) : 0,
      progress: Number.isFinite(Number(bounty.progress)) ? Number(bounty.progress) : 0,
      xpReward: Number.isFinite(Number(bounty.xpReward)) ? Number(bounty.xpReward) : 0,
      creditsReward: Number.isFinite(Number(bounty.creditsReward)) ? Number(bounty.creditsReward) : 0,
      lootReward: Array.isArray(bounty.lootReward)
        ? bounty.lootReward.map((item) => String(item || "")).filter(Boolean)
        : [],
      accepted: bounty.accepted === true,
      completed: bounty.completed === true,
      claimAvailable: bounty.claimAvailable === true,
      claimed: bounty.claimed === true,
      completionSequence: Number.isFinite(Number(bounty.completionSequence)) ? Number(bounty.completionSequence) : 0,
      repeatable: bounty.repeatable === true,
      stagingOnly: bounty.stagingOnly !== false,
      lastReason: String(bounty.lastReason || ""),
      updatedAt: Number.isFinite(Number(bounty.updatedAt)) ? Number(bounty.updatedAt) : 0
    };
  }

  function normalizeStagingBountyList(message) {
    if (!message || typeof message !== "object") return null;

    return {
      ok: message.ok === true,
      mode: String(message.mode || "staging_only"),
      applied: message.applied === true,
      bounties: Array.isArray(message.bounties)
        ? message.bounties.map(normalizeStagingBounty).filter(Boolean)
        : [],
      active: normalizeStagingBounty(message.active),
      reason: String(message.reason || ""),
      creditsWritten: message.creditsWritten === true,
      lootWritten: message.lootWritten === true,
      bountyWritten: message.bountyWritten === true,
      saveWritten: message.saveWritten === true,
      receivedAt: Number.isFinite(Number(message.receivedAt)) ? Number(message.receivedAt) : Date.now()
    };
  }

  function normalizeStagingBountyStatus(message) {
    if (!message || typeof message !== "object") return null;

    return {
      ok: message.ok === true,
      reason: String(message.reason || ""),
      botId: String(message.botId || ""),
      active: normalizeStagingBounty(message.active),
      receivedAt: Number.isFinite(Number(message.receivedAt)) ? Number(message.receivedAt) : Date.now()
    };
  }

  function normalizeStagingBountyClaimResult(message) {
    if (!message || typeof message !== "object") return null;
    const normalized = {
      playerSave: normalizeClaimPlayerSave(message.playerSave || message.claimStatus?.playerSave),
      claimStatus: normalizeRewardClaimStatus(message.claimStatus),
      playerSavePatchResult: normalizePlayerSavePatchResult(message.playerSavePatchResult)
    };
    const xp = getXpMetadataFromResult({
      ...message,
      ...normalized
    });

    return {
      ok: message.ok === true,
      applied: xp.applied,
      dryRun: message.dryRun !== false,
      mode: String(message.mode || ""),
      reason: String(message.reason || ""),
      debugReason: String(message.debugReason || ""),
      bounty: normalizeStagingBounty(message.bounty),
      xpDelta: Number.isFinite(Number(message.xpDelta)) ? Number(message.xpDelta) : 0,
      xpBefore: xp.xpBefore,
      xpAfter: xp.xpAfter,
      persistedXp: xp.persistedXp,
      persistedZoneXp: xp.persistedZoneXp,
      persistenceVerified: xp.persistenceVerified,
      creditsWritten: message.creditsWritten === true,
      lootWritten: message.lootWritten === true,
      bountyWritten: message.bountyWritten === true,
      saveWritten: xp.saveWritten,
      gates: normalizeClaimGates(message.gates || message.claimStatus?.gates),
      ledger: normalizeClaimLedger(message.ledger || message.claimStatus?.ledger),
      progressionShadow: normalizeClaimProgressionShadow(message.progressionShadow || message.claimStatus?.progressionShadow),
      playerSave: normalized.playerSave,
      claimStatus: normalized.claimStatus,
      rewardWritePlan: normalizeRewardWritePlan(message.rewardWritePlan),
      rewardLedgerResult: normalizeRewardLedgerResult(message.rewardLedgerResult),
      rewardApplicationPlan: normalizeRewardApplicationPlan(message.rewardApplicationPlan),
      rewardApplicationResult: normalizeRewardApplicationResult(message.rewardApplicationResult),
      progressionPreview: normalizeProgressionPreview(message.progressionPreview),
      progressionShadowResult: normalizeProgressionShadowResult(message.progressionShadowResult),
      playerSavePatchPlan: normalizePlayerSavePatchPlan(message.playerSavePatchPlan),
      playerSavePatchResult: normalized.playerSavePatchResult,
      receivedAt: Number.isFinite(Number(message.receivedAt)) ? Number(message.receivedAt) : Date.now()
    };
  }

  function normalizeStagingXpResult(message) {
    if (!message || typeof message !== "object") return null;
    const normalized = {
      playerSave: normalizeClaimPlayerSave(message.playerSave || message.claimStatus?.playerSave),
      claimStatus: normalizeRewardClaimStatus(message.claimStatus),
      playerSavePatchResult: normalizePlayerSavePatchResult(message.playerSavePatchResult)
    };
    const xp = getXpMetadataFromResult({
      ...message,
      ...normalized
    });

    return {
      ok: message.ok === true,
      applied: xp.applied,
      dryRun: message.dryRun !== false,
      mode: String(message.mode || ""),
      reason: String(message.reason || ""),
      debugReason: String(message.debugReason || ""),
      botId: String(message.botId || ""),
      botName: String(message.botName || "Staging Bot"),
      rewardPreviewId: String(message.rewardPreviewId || ""),
      destructionInstanceId: String(message.destructionInstanceId || ""),
      xpDelta: Number.isFinite(Number(message.xpDelta)) ? Number(message.xpDelta) : 0,
      xpBefore: xp.xpBefore,
      xpAfter: xp.xpAfter,
      persistedXp: xp.persistedXp,
      persistedZoneXp: xp.persistedZoneXp,
      persistenceVerified: xp.persistenceVerified,
      idempotencyKey: String(message.idempotencyKey || ""),
      creditsWritten: message.creditsWritten === true,
      lootWritten: message.lootWritten === true,
      bountyWritten: message.bountyWritten === true,
      saveWritten: xp.saveWritten,
      gates: normalizeClaimGates(message.gates || message.claimStatus?.gates),
      playerSave: normalized.playerSave,
      claimStatus: normalized.claimStatus,
      rewardWritePlan: normalizeRewardWritePlan(message.rewardWritePlan),
      rewardApplicationPlan: normalizeRewardApplicationPlan(message.rewardApplicationPlan),
      rewardApplicationResult: normalizeRewardApplicationResult(message.rewardApplicationResult),
      progressionPreview: normalizeProgressionPreview(message.progressionPreview),
      playerSavePatchPlan: normalizePlayerSavePatchPlan(message.playerSavePatchPlan),
      playerSavePatchResult: normalized.playerSavePatchResult,
      receivedAt: Number.isFinite(Number(message.receivedAt)) ? Number(message.receivedAt) : Date.now()
    };
  }

  function normalizeStagingReturnFire(message) {
    if (!message || typeof message !== "object") return null;

    return {
      ok: message.ok === true,
      reason: String(message.reason || "staging_bot_return_fire"),
      sessionId: String(message.sessionId || ""),
      attackerBotId: String(message.attackerBotId || ""),
      attackerName: String(message.attackerName || "Erebus Bot"),
      currentNode: String(message.currentNode || ""),
      damage: Number.isFinite(Number(message.damage)) ? Math.max(0, Number(message.damage)) : 0,
      damageType: String(message.damageType || "shield_first"),
      sessionOnly: message.sessionOnly !== false,
      persisted: message.persisted === true,
      saveWritten: message.saveWritten === true,
      playerDeathEnabled: message.playerDeathEnabled === true,
      cargoLossEnabled: message.cargoLossEnabled === true,
      botAttackStatus: String(message.botAttackStatus || "cooldown"),
      botAttackReason: String(message.botAttackReason || "return_fire_sent"),
      botDamage: Number.isFinite(Number(message.botDamage ?? message.damage)) ? Math.max(0, Number(message.botDamage ?? message.damage)) : 0,
      playerShieldBefore: Number.isFinite(Number(message.playerShieldBefore)) ? Number(message.playerShieldBefore) : null,
      playerShieldAfter: Number.isFinite(Number(message.playerShieldAfter)) ? Number(message.playerShieldAfter) : null,
      playerHullBefore: Number.isFinite(Number(message.playerHullBefore)) ? Number(message.playerHullBefore) : null,
      playerHullAfter: Number.isFinite(Number(message.playerHullAfter)) ? Number(message.playerHullAfter) : null,
      shieldDamage: Number.isFinite(Number(message.shieldDamage)) ? Math.max(0, Number(message.shieldDamage)) : 0,
      hullDamage: Number.isFinite(Number(message.hullDamage)) ? Math.max(0, Number(message.hullDamage)) : 0,
      playerDestroyed: message.playerDestroyed === true,
      cooldownMs: Number.isFinite(Number(message.cooldownMs)) ? Number(message.cooldownMs) : 0,
      nextReturnFireAt: Number.isFinite(Number(message.nextReturnFireAt)) ? Number(message.nextReturnFireAt) : 0,
      receivedAt: Number.isFinite(Number(message.receivedAt)) ? Number(message.receivedAt) : Date.now()
    };
  }

  function normalizeStagingResourceEvent(message) {
    if (!message || typeof message !== "object") {
      return {
        ok: false,
        reason: "missing_resource_event",
        resourceId: "",
        resourceName: "Resource",
        currentNode: "",
        cargoDelta: 0,
        receivedAt: Date.now()
      };
    }

    return {
      ok: message.ok === true,
      reason: String(message.reason || (message.ok === false ? "staging_resource_event_rejected" : "staging_resource_event")),
      sessionId: String(message.sessionId || ""),
      minerSessionId: String(message.minerSessionId || message.sessionId || ""),
      minerDisplayName: String(message.minerDisplayName || "Pilot"),
      resourceId: String(message.resourceId || message.targetResourceId || ""),
      resourceName: String(message.resourceName || message.name || "Resource"),
      currentNode: String(message.currentNode || ""),
      resourceNode: String(message.resourceNode || message.currentNode || ""),
      damage: Number.isFinite(Number(message.damage)) ? Math.max(0, Number(message.damage)) : 0,
      hpBefore: Number.isFinite(Number(message.hpBefore)) ? Math.max(0, Number(message.hpBefore)) : null,
      hp: Number.isFinite(Number(message.hp)) ? Math.max(0, Number(message.hp)) : 0,
      hpMax: Number.isFinite(Number(message.hpMax)) ? Math.max(1, Number(message.hpMax)) : 1,
      depleted: message.depleted === true,
      depletedUntil: Number.isFinite(Number(message.depletedUntil)) ? Number(message.depletedUntil) : 0,
      weaponKey: String(message.weaponKey || message.weaponId || ""),
      weaponName: String(message.weaponName || ""),
      weaponFamily: String(message.weaponFamily || ""),
      damageSource: String(message.damageSource || ""),
      fallbackDamageUsed: message.fallbackDamageUsed === true,
      clientDamageIgnored: message.clientDamageIgnored === true,
      serverAuthoritative: message.serverAuthoritative === true,
      localApplySuggested: message.localApplySuggested === true,
      cargoDelta: Number.isFinite(Number(message.cargoDelta)) ? Math.max(0, Math.round(Number(message.cargoDelta))) : 0,
      cargoWritten: message.cargoWritten === true,
      saveWritten: message.saveWritten === true,
      resourceRewardId: String(message.resourceRewardId || message.depletionInstanceId || ""),
      rewardsGranted: message.rewardsGranted === true,
      cooldownRemainingMs: Number.isFinite(Number(message.cooldownRemainingMs)) ? Math.max(0, Number(message.cooldownRemainingMs)) : 0,
      timestamp: Number.isFinite(Number(message.timestamp)) ? Number(message.timestamp) : 0,
      receivedAt: Number.isFinite(Number(message.receivedAt)) ? Number(message.receivedAt) : Date.now()
    };
  }

  function normalizeStagingTradeOffer(offer) {
    if (!offer || typeof offer !== "object") return null;

    return {
      offerId: String(offer.offerId || ""),
      resourceId: String(offer.resourceId || ""),
      resourceName: String(offer.resourceName || "Resource"),
      buyNode: String(offer.buyNode || ""),
      sellNode: String(offer.sellNode || ""),
      buyPrice: Number.isFinite(Number(offer.buyPrice)) ? Number(offer.buyPrice) : 0,
      sellPrice: Number.isFinite(Number(offer.sellPrice)) ? Number(offer.sellPrice) : 0,
      maxQuantity: Number.isFinite(Number(offer.maxQuantity)) ? Number(offer.maxQuantity) : 0,
      refreshSeconds: Number.isFinite(Number(offer.refreshSeconds)) ? Number(offer.refreshSeconds) : 0
    };
  }

  function normalizeStagingTradePreview(preview) {
    if (!preview || typeof preview !== "object") return null;

    return {
      ok: preview.ok === true,
      mode: String(preview.mode || "dry_run"),
      applied: preview.applied === true,
      offerId: String(preview.offerId || ""),
      resourceId: String(preview.resourceId || ""),
      resourceName: String(preview.resourceName || ""),
      quantity: Number.isFinite(Number(preview.quantity)) ? Number(preview.quantity) : 0,
      buyNode: String(preview.buyNode || ""),
      sellNode: String(preview.sellNode || ""),
      buyPrice: Number.isFinite(Number(preview.buyPrice)) ? Number(preview.buyPrice) : 0,
      sellPrice: Number.isFinite(Number(preview.sellPrice)) ? Number(preview.sellPrice) : 0,
      totalCost: Number.isFinite(Number(preview.totalCost)) ? Number(preview.totalCost) : 0,
      projectedRevenue: Number.isFinite(Number(preview.projectedRevenue)) ? Number(preview.projectedRevenue) : 0,
      projectedProfit: Number.isFinite(Number(preview.projectedProfit)) ? Number(preview.projectedProfit) : 0,
      wouldPass: preview.wouldPass === true,
      validationMode: String(preview.validationMode || "unknown"),
      trustedStateAvailable: preview.trustedStateAvailable === true,
      snapshotUsed: preview.snapshotUsed === true,
      stateSources: preview.stateSources && typeof preview.stateSources === "object"
        ? {
          credits: String(preview.stateSources.credits || "unknown"),
          cargoUsed: String(preview.stateSources.cargoUsed || "unknown"),
          cargoCapacity: String(preview.stateSources.cargoCapacity || "unknown")
        }
        : {
          credits: "unknown",
          cargoUsed: "unknown",
          cargoCapacity: "unknown"
        },
      readStatus: String(preview.readStatus || ""),
      blockReason: preview.blockReason === null || preview.blockReason === undefined ? null : String(preview.blockReason || ""),
      userReason: String(preview.userReason || ""),
      creditsAvailable: Number.isFinite(Number(preview.creditsAvailable)) ? Number(preview.creditsAvailable) : null,
      cargoUsed: Number.isFinite(Number(preview.cargoUsed)) ? Number(preview.cargoUsed) : null,
      cargoCapacity: Number.isFinite(Number(preview.cargoCapacity)) ? Number(preview.cargoCapacity) : null,
      cargoFree: Number.isFinite(Number(preview.cargoFree)) ? Number(preview.cargoFree) : null,
      maxAffordableQuantity: Number.isFinite(Number(preview.maxAffordableQuantity)) ? Number(preview.maxAffordableQuantity) : null,
      maxCargoQuantity: Number.isFinite(Number(preview.maxCargoQuantity)) ? Number(preview.maxCargoQuantity) : null,
      maxValidQuantity: Number.isFinite(Number(preview.maxValidQuantity)) ? Number(preview.maxValidQuantity) : null,
      enoughCredits: preview.enoughCredits === true ? true : preview.enoughCredits === false ? false : null,
      enoughCargo: preview.enoughCargo === true ? true : preview.enoughCargo === false ? false : null,
      creditsWritten: preview.creditsWritten === true,
      cargoWritten: preview.cargoWritten === true,
      saveWritten: preview.saveWritten === true,
      reason: String(preview.reason || ""),
      debugReason: String(preview.debugReason || ""),
      receivedAt: Number.isFinite(Number(preview.receivedAt)) ? Number(preview.receivedAt) : Date.now()
    };
  }

  function normalizeStagingTradeWriteResult(result) {
    if (!result || typeof result !== "object") return null;

    return {
      ok: result.ok === true,
      mode: String(result.mode || "dry_run"),
      operation: String(result.operation || ""),
      applied: result.applied === true,
      offerId: String(result.offerId || ""),
      resourceId: String(result.resourceId || ""),
      resourceName: String(result.resourceName || ""),
      quantity: Number.isFinite(Number(result.quantity)) ? Number(result.quantity) : 0,
      buyNode: String(result.buyNode || ""),
      sellNode: String(result.sellNode || ""),
      cost: Number.isFinite(Number(result.cost)) ? Number(result.cost) : 0,
      revenue: Number.isFinite(Number(result.revenue)) ? Number(result.revenue) : 0,
      profitPreview: Number.isFinite(Number(result.profitPreview)) ? Number(result.profitPreview) : 0,
      creditsDelta: Number.isFinite(Number(result.creditsDelta)) ? Number(result.creditsDelta) : 0,
      cargoDelta: Number.isFinite(Number(result.cargoDelta)) ? Number(result.cargoDelta) : 0,
      creditsBefore: Number.isFinite(Number(result.creditsBefore)) ? Number(result.creditsBefore) : null,
      creditsAfter: Number.isFinite(Number(result.creditsAfter)) ? Number(result.creditsAfter) : null,
      cargoBefore: Number.isFinite(Number(result.cargoBefore)) ? Number(result.cargoBefore) : null,
      cargoAfter: Number.isFinite(Number(result.cargoAfter)) ? Number(result.cargoAfter) : null,
      cargoUsedBefore: Number.isFinite(Number(result.cargoUsedBefore)) ? Number(result.cargoUsedBefore) : null,
      cargoUsedAfter: Number.isFinite(Number(result.cargoUsedAfter)) ? Number(result.cargoUsedAfter) : null,
      cargoCapacity: Number.isFinite(Number(result.cargoCapacity)) ? Number(result.cargoCapacity) : null,
      cargoCostBasisBefore: Number.isFinite(Number(result.cargoCostBasisBefore)) ? Number(result.cargoCostBasisBefore) : null,
      cargoCostBasisAfter: Number.isFinite(Number(result.cargoCostBasisAfter)) ? Number(result.cargoCostBasisAfter) : null,
      recoveredResourceSale: result.recoveredResourceSale === true,
      writeHandlerUsed: String(result.writeHandlerUsed || ""),
      dryRunEnv: result.dryRunEnv === true,
      sellValidationReason: String(result.sellValidationReason || ""),
      trustedCargo: result.trustedCargo && typeof result.trustedCargo === "object"
        ? {
          found: result.trustedCargo.found === true,
          key: String(result.trustedCargo.key || ""),
          amount: Number.isFinite(Number(result.trustedCargo.amount)) ? Number(result.trustedCargo.amount) : null
        }
        : null,
      costBasisFound: result.costBasisFound === true,
      currentNode: String(result.currentNode || ""),
      validationMode: String(result.validationMode || "unknown"),
      trustedStateAvailable: result.trustedStateAvailable === true,
      snapshotUsed: result.snapshotUsed === true,
      wouldPass: result.wouldPass === true,
      blockReason: result.blockReason === null || result.blockReason === undefined ? null : String(result.blockReason || ""),
      userReason: String(result.userReason || ""),
      gates: result.gates && typeof result.gates === "object"
        ? {
          verified: result.gates.verified === true,
          writeEnabled: result.gates.writeEnabled === true,
          dryRun: result.gates.dryRun !== false,
          allowlisted: result.gates.allowlisted === true,
          scope: String(result.gates.scope || "disabled"),
          trustedSaveAvailable: result.gates.trustedSaveAvailable === true
        }
        : {
          verified: false,
          writeEnabled: false,
          dryRun: true,
          allowlisted: false,
          scope: "disabled",
          trustedSaveAvailable: false
        },
      writes: result.writes && typeof result.writes === "object"
        ? {
          creditsWritten: result.writes.creditsWritten === true,
          cargoWritten: result.writes.cargoWritten === true,
          saveWritten: result.writes.saveWritten === true,
          inventoryWritten: result.writes.inventoryWritten === true,
          lootWritten: result.writes.lootWritten === true,
          bountyWritten: result.writes.bountyWritten === true
        }
        : {
          creditsWritten: result.creditsWritten === true,
          cargoWritten: result.cargoWritten === true,
          saveWritten: result.saveWritten === true,
          inventoryWritten: false,
          lootWritten: false,
          bountyWritten: false
        },
      creditsWritten: result.creditsWritten === true || result.writes?.creditsWritten === true,
      cargoWritten: result.cargoWritten === true || result.writes?.cargoWritten === true,
      saveWritten: result.saveWritten === true || result.writes?.saveWritten === true,
      inventoryWritten: result.inventoryWritten === true || result.writes?.inventoryWritten === true,
      lootWritten: result.lootWritten === true || result.writes?.lootWritten === true,
      bountyWritten: result.bountyWritten === true || result.writes?.bountyWritten === true,
      appliedFields: Array.isArray(result.appliedFields)
        ? result.appliedFields.map((field) => String(field || "")).filter(Boolean)
        : [],
      reason: String(result.reason || ""),
      debugReason: String(result.debugReason || ""),
      receivedAt: Number.isFinite(Number(result.receivedAt)) ? Number(result.receivedAt) : Date.now()
    };
  }

  function normalizeStagingStoreItem(item) {
    if (!item || typeof item !== "object") return null;

    return {
      itemId: String(item.itemId || ""),
      name: String(item.name || "Store Item"),
      category: String(item.category || "equipment"),
      localKind: String(item.localKind || ""),
      localKey: String(item.localKey || ""),
      price: Number.isFinite(Number(item.price)) ? Number(item.price) : 0,
      levelRequirement: Number.isFinite(Number(item.levelRequirement)) ? Number(item.levelRequirement) : 0,
      stockType: String(item.stockType || "fixed"),
      description: String(item.description || ""),
      reference: String(item.reference || "")
    };
  }

  function normalizeStagingStorePreview(preview) {
    if (!preview || typeof preview !== "object") return null;

    return {
      ok: preview.ok === true,
      mode: String(preview.mode || "dry_run"),
      operation: String(preview.operation || "purchase"),
      applied: preview.applied === true,
      itemId: String(preview.itemId || ""),
      name: String(preview.name || "Store Item"),
      category: String(preview.category || "equipment"),
      localKind: String(preview.localKind || ""),
      localKey: String(preview.localKey || ""),
      quantity: Number.isFinite(Number(preview.quantity)) ? Number(preview.quantity) : 0,
      unitPrice: Number.isFinite(Number(preview.unitPrice)) ? Number(preview.unitPrice) : 0,
      totalCost: Number.isFinite(Number(preview.totalCost)) ? Number(preview.totalCost) : 0,
      creditsAvailable: Number.isFinite(Number(preview.creditsAvailable)) ? Number(preview.creditsAvailable) : null,
      creditsBefore: Number.isFinite(Number(preview.creditsBefore)) ? Number(preview.creditsBefore) : null,
      creditsAfterPreview: Number.isFinite(Number(preview.creditsAfterPreview)) ? Number(preview.creditsAfterPreview) : null,
      creditsAfter: Number.isFinite(Number(preview.creditsAfter)) ? Number(preview.creditsAfter) : null,
      itemBefore: Number.isFinite(Number(preview.itemBefore)) ? Number(preview.itemBefore) : null,
      itemAfter: Number.isFinite(Number(preview.itemAfter)) ? Number(preview.itemAfter) : null,
      wouldPass: preview.wouldPass === true,
      validationMode: String(preview.validationMode || "unknown"),
      trustedStateAvailable: preview.trustedStateAvailable === true,
      snapshotUsed: preview.snapshotUsed === true,
      gates: preview.gates && typeof preview.gates === "object"
        ? {
          verified: preview.gates.verified === true,
          writeEnabled: preview.gates.writeEnabled === true,
          dryRun: preview.gates.dryRun === true,
          allowlisted: preview.gates.allowlisted === true,
          scope: String(preview.gates.scope || ""),
          trustedSaveAvailable: preview.gates.trustedSaveAvailable === true,
          itemAllowed: preview.gates.itemAllowed === true
        }
        : null,
      blockReason: preview.blockReason === null || preview.blockReason === undefined ? null : String(preview.blockReason || ""),
      userReason: String(preview.userReason || ""),
      writes: preview.writes && typeof preview.writes === "object"
        ? {
          creditsWritten: preview.writes.creditsWritten === true,
          inventoryWritten: preview.writes.inventoryWritten === true,
          attachmentWritten: preview.writes.attachmentWritten === true,
          shipWritten: preview.writes.shipWritten === true,
          weaponWritten: preview.writes.weaponWritten === true,
          equipmentWritten: preview.writes.equipmentWritten === true,
          saveWritten: preview.writes.saveWritten === true,
          lootWritten: preview.writes.lootWritten === true,
          bountyWritten: preview.writes.bountyWritten === true
        }
        : {
          creditsWritten: preview.creditsWritten === true,
          inventoryWritten: preview.inventoryWritten === true,
          attachmentWritten: preview.attachmentWritten === true,
          shipWritten: preview.shipWritten === true,
          weaponWritten: preview.weaponWritten === true,
          equipmentWritten: preview.equipmentWritten === true,
          saveWritten: preview.saveWritten === true,
          lootWritten: preview.lootWritten === true,
          bountyWritten: preview.bountyWritten === true
        },
      creditsWritten: preview.creditsWritten === true || preview.writes?.creditsWritten === true,
      inventoryWritten: preview.inventoryWritten === true || preview.writes?.inventoryWritten === true,
      attachmentWritten: preview.attachmentWritten === true || preview.writes?.attachmentWritten === true,
      shipWritten: preview.shipWritten === true || preview.writes?.shipWritten === true,
      weaponWritten: preview.weaponWritten === true || preview.writes?.weaponWritten === true,
      equipmentWritten: preview.equipmentWritten === true || preview.writes?.equipmentWritten === true,
      saveWritten: preview.saveWritten === true || preview.writes?.saveWritten === true,
      lootWritten: preview.lootWritten === true || preview.writes?.lootWritten === true,
      bountyWritten: preview.bountyWritten === true || preview.writes?.bountyWritten === true,
      appliedFields: Array.isArray(preview.appliedFields)
        ? preview.appliedFields.map((field) => String(field || "")).filter(Boolean)
        : [],
      reason: String(preview.reason || ""),
      debugReason: String(preview.debugReason || ""),
      receivedAt: Number.isFinite(Number(preview.receivedAt)) ? Number(preview.receivedAt) : Date.now()
    };
  }

  function normalizeStagingLoadoutEquip(result) {
    if (!result || typeof result !== "object") return null;

    return {
      ok: result.ok === true,
      mode: String(result.mode || "dry_run"),
      operation: String(result.operation || "equip"),
      applied: result.applied === true,
      itemId: String(result.itemId || ""),
      name: String(result.name || "Cargo Pod"),
      category: String(result.category || "equipment"),
      currentShipId: String(result.currentShipId || ""),
      targetShipId: String(result.targetShipId || ""),
      selectedShipBefore: String(result.selectedShipBefore || ""),
      selectedShipAfter: String(result.selectedShipAfter || ""),
      ownedBefore: Number.isFinite(Number(result.ownedBefore)) ? Number(result.ownedBefore) : null,
      ownedAfter: Number.isFinite(Number(result.ownedAfter)) ? Number(result.ownedAfter) : null,
      equippedBefore: Number.isFinite(Number(result.equippedBefore)) ? Number(result.equippedBefore) : null,
      equippedAfter: Number.isFinite(Number(result.equippedAfter)) ? Number(result.equippedAfter) : null,
      cargoCapacityBefore: Number.isFinite(Number(result.cargoCapacityBefore)) ? Number(result.cargoCapacityBefore) : null,
      cargoCapacityAfterPreview: Number.isFinite(Number(result.cargoCapacityAfterPreview)) ? Number(result.cargoCapacityAfterPreview) : null,
      cargoCapacityAfter: Number.isFinite(Number(result.cargoCapacityAfter)) ? Number(result.cargoCapacityAfter) : null,
      shieldBefore: Number.isFinite(Number(result.shieldBefore)) ? Number(result.shieldBefore) : null,
      shieldAfterPreview: Number.isFinite(Number(result.shieldAfterPreview)) ? Number(result.shieldAfterPreview) : null,
      shieldAfter: Number.isFinite(Number(result.shieldAfter)) ? Number(result.shieldAfter) : null,
      gunSlots: Number.isFinite(Number(result.gunSlots)) ? Number(result.gunSlots) : null,
      validationMode: String(result.validationMode || "unknown"),
      trustedStateAvailable: result.trustedStateAvailable === true,
      blockReason: result.blockReason === null || result.blockReason === undefined ? null : String(result.blockReason || ""),
      userReason: String(result.userReason || ""),
      gates: result.gates && typeof result.gates === "object"
        ? {
          verified: result.gates.verified === true,
          writeEnabled: result.gates.writeEnabled === true,
          dryRun: result.gates.dryRun === true,
          allowlisted: result.gates.allowlisted === true,
          scope: String(result.gates.scope || ""),
          trustedSaveAvailable: result.gates.trustedSaveAvailable === true,
          itemAllowed: result.gates.itemAllowed === true
        }
        : null,
      writes: result.writes && typeof result.writes === "object"
        ? {
          loadoutWritten: result.writes.loadoutWritten === true,
          attachmentWritten: result.writes.attachmentWritten === true,
          inventoryWritten: result.writes.inventoryWritten === true,
          creditsWritten: result.writes.creditsWritten === true,
          shipWritten: result.writes.shipWritten === true,
          weaponWritten: result.writes.weaponWritten === true,
          saveWritten: result.writes.saveWritten === true
        }
        : {
          loadoutWritten: result.loadoutWritten === true,
          attachmentWritten: result.attachmentWritten === true,
          inventoryWritten: result.inventoryWritten === true,
          creditsWritten: result.creditsWritten === true,
          shipWritten: result.shipWritten === true,
          weaponWritten: result.weaponWritten === true,
          saveWritten: result.saveWritten === true
        },
      loadoutWritten: result.loadoutWritten === true || result.writes?.loadoutWritten === true,
      attachmentWritten: result.attachmentWritten === true || result.writes?.attachmentWritten === true,
      inventoryWritten: result.inventoryWritten === true || result.writes?.inventoryWritten === true,
      creditsWritten: result.creditsWritten === true || result.writes?.creditsWritten === true,
      shipWritten: result.shipWritten === true || result.writes?.shipWritten === true,
      weaponWritten: result.weaponWritten === true || result.writes?.weaponWritten === true,
      saveWritten: result.saveWritten === true || result.writes?.saveWritten === true,
      appliedFields: Array.isArray(result.appliedFields)
        ? result.appliedFields.map((field) => String(field || "")).filter(Boolean)
        : [],
      reason: String(result.reason || ""),
      debugReason: String(result.debugReason || ""),
      receivedAt: Number.isFinite(Number(result.receivedAt)) ? Number(result.receivedAt) : Date.now()
    };
  }

  function getStagingStorePlayerSnapshot() {
    try {
      const creditsValue = typeof credits !== "undefined" ? Number(credits) : NaN;
      if (!Number.isFinite(creditsValue)) return null;
      return {
        credits: Math.max(0, Math.floor(creditsValue))
      };
    } catch (err) {
      logDev("staging store player snapshot unavailable", err);
      return null;
    }
  }

  function getStagingTradePlayerSnapshot() {
    try {
      const creditsValue = typeof credits !== "undefined" ? Number(credits) : NaN;
      const cargoUsedValue = typeof cargoUsed === "function" ? Number(cargoUsed()) : NaN;
      const shipStats = typeof getShipStats === "function" ? getShipStats() || {} : {};
      const cargoCapacityValue = Number(shipStats.cargo);

      if (!Number.isFinite(creditsValue) ||
        !Number.isFinite(cargoUsedValue) ||
        !Number.isFinite(cargoCapacityValue)) {
        return null;
      }

      return {
        credits: Math.max(0, Math.floor(creditsValue)),
        cargoUsed: Math.max(0, Math.floor(cargoUsedValue)),
        cargoCapacity: Math.max(0, Math.floor(cargoCapacityValue)),
        currentNode: typeof currentNode !== "undefined" ? String(currentNode || "") : ""
      };
    } catch (err) {
      logDev("staging trade player snapshot unavailable", err);
      return null;
    }
  }

  function updateBotsFromServerState(serverState) {
    botsById.clear();

    const bots = serverState?.bots;
    if (!bots) return;

    if (typeof bots.forEach === "function") {
      bots.forEach((bot, key) => {
        const snapshot = normalizeBot(bot, key);
        if (snapshot) botsById.set(snapshot.id, snapshot);
      });
      return;
    }

    Object.entries(bots).forEach(([key, bot]) => {
      const snapshot = normalizeBot(bot, key);
      if (snapshot) botsById.set(snapshot.id, snapshot);
    });
  }

  function normalizeResource(resource, fallbackId = "") {
    if (!resource) return null;

    const id = String(resource.id || fallbackId || "");
    if (!id) return null;

    return {
      id,
      resourceName: String(resource.resourceName || resource.name || "Resource"),
      name: String(resource.resourceName || resource.name || "Resource"),
      x: Number.isFinite(Number(resource.x)) ? Number(resource.x) : 50,
      y: Number.isFinite(Number(resource.y)) ? Number(resource.y) : 50,
      hp: Number.isFinite(Number(resource.hp)) ? Number(resource.hp) : 0,
      hpMax: Number.isFinite(Number(resource.hpMax)) ? Number(resource.hpMax) : 1,
      yieldAmount: Number.isFinite(Number(resource.yieldAmount)) ? Number(resource.yieldAmount) : 0,
      currentNode: String(resource.currentNode || "Asteron Prime"),
      lastUpdatedAt: Number.isFinite(Number(resource.lastUpdatedAt)) ? Number(resource.lastUpdatedAt) : 0,
      depleted: resource.depleted === true,
      depletedUntil: Number.isFinite(Number(resource.depletedUntil)) ? Number(resource.depletedUntil) : 0
    };
  }

  function updateResourcesFromServerState(serverState) {
    resourcesById.clear();

    const resources = serverState?.resources;
    if (!resources) return;

    if (typeof resources.forEach === "function") {
      resources.forEach((resource, key) => {
        const snapshot = normalizeResource(resource, key);
        if (snapshot) resourcesById.set(snapshot.id, snapshot);
      });
      return;
    }

    Object.entries(resources).forEach(([key, resource]) => {
      const snapshot = normalizeResource(resource, key);
      if (snapshot) resourcesById.set(snapshot.id, snapshot);
    });
  }

  function bindRoomEvents(activeRoom) {
    activeRoom.onStateChange((serverState) => {
      updatePlayersFromServerState(serverState);
      updateBotsFromServerState(serverState);
      updateResourcesFromServerState(serverState);
      notifyServerState(serverState);
    });

    activeRoom.onMessage("pong", (message) => {
      logDev("received pong", message);
    });

    activeRoom.onMessage("presence:warning", (message) => {
      connection.lastServerWarning = message?.reason || "presence warning";
      logDev("server presence warning", message);
    });

    activeRoom.onMessage("chat:message", (message) => {
      pushChatMessage(message);
      logDev("server chat message", message);
      notifyServerState(activeRoom?.state || null);
    });

    ["playerJoined", "playerLeft", "playerMoved"].forEach((type) => {
      activeRoom.onMessage(type, (message) => {
        pushPresenceEvent({ ...message, type: message?.type || type });
        logDev(`server ${type}`, message);
        notifyServerState(activeRoom?.state || null);
      });
    });

    activeRoom.onMessage("combat:rejected", (message) => {
      connection.lastCombatResponse = {
        ok: message?.ok === true,
        reason: String(message?.reason || "combat_intent_rejected"),
        validation: String(message?.validation || ""),
        combatIntentReason: String(message?.combatIntentReason || message?.validation || message?.reason || ""),
        lockOnClearReason: String(message?.lockOnClearReason || ""),
        weaponSourceReason: String(message?.weaponSourceReason || ""),
        combatNodeValidationReason: String(message?.combatNodeValidationReason || ""),
        playerClientNode: String(message?.playerClientNode || ""),
        playerServerNode: String(message?.playerServerNode || ""),
        playerPresenceNode: String(message?.playerPresenceNode || ""),
        selectedBotId: String(message?.selectedBotId || ""),
        selectedBotNode: String(message?.selectedBotNode || ""),
        botServerNode: String(message?.botServerNode || ""),
        botVisualNode: String(message?.botVisualNode || ""),
        combatIntentNode: String(message?.combatIntentNode || ""),
        nodeCompareResult: String(message?.nodeCompareResult || ""),
        activeShipWeaponCount: Number.isFinite(Number(message?.activeShipWeaponCount)) ? Number(message.activeShipWeaponCount) : 0,
        validCombatWeaponCount: Number.isFinite(Number(message?.validCombatWeaponCount)) ? Number(message.validCombatWeaponCount) : 0,
        rejectedWeaponCount: Number.isFinite(Number(message?.rejectedWeaponCount)) ? Number(message.rejectedWeaponCount) : 0,
        firstRejectedWeaponReason: String(message?.firstRejectedWeaponReason || ""),
        targetBotId: String(message?.targetBotId || ""),
        targetNode: String(message?.targetNode || ""),
        weaponName: String(message?.weaponName || ""),
        cooldownRemainingMs: Number.isFinite(Number(message?.cooldownRemainingMs)) ? Number(message.cooldownRemainingMs) : 0,
        pvpIntent: message?.pvpIntent === true,
        targetType: String(message?.targetType || ""),
        targetPlayerId: String(message?.targetPlayerId || ""),
        targetSessionId: String(message?.targetSessionId || ""),
        attackerSessionId: String(message?.attackerSessionId || ""),
        attackerNode: String(message?.attackerNode || ""),
        targetPlayerNode: String(message?.targetPlayerNode || ""),
        attackerPresenceStatus: String(message?.attackerPresenceStatus || ""),
        targetPresenceStatus: String(message?.targetPresenceStatus || ""),
        attackerGuildId: String(message?.attackerGuildId || ""),
        targetGuildId: String(message?.targetGuildId || ""),
        attackerShipId: String(message?.attackerShipId || ""),
        targetShipId: String(message?.targetShipId || ""),
        pvpRulePreview: String(message?.pvpRulePreview || ""),
        pvpEligibility: message?.pvpEligibility && typeof message.pvpEligibility === "object"
          ? {
            allowed: message.pvpEligibility.allowed === true,
            reason: String(message.pvpEligibility.reason || ""),
            pvpEnabled: message.pvpEligibility.pvpEnabled === true
          }
          : null,
        pvpDamageApplied: message?.pvpDamageApplied === true,
        playerDamageApplied: message?.playerDamageApplied === true,
        mutatedPlayerState: message?.mutatedPlayerState === true,
        rewardsGranted: message?.rewardsGranted === true,
        receivedAt: Number.isFinite(Number(message?.receivedAt)) ? Number(message.receivedAt) : Date.now()
      };
      logDev("server combat intent response", message);
    });

    activeRoom.onMessage("combat:resolved", (message) => {
      connection.lastCombatResponse = {
        ok: message?.ok === true,
        reason: String(message?.reason || "staging_damage_applied"),
        targetBotId: String(message?.targetBotId || ""),
        targetNode: String(message?.targetNode || ""),
        weaponName: String(message?.weaponName || ""),
        weaponFamily: String(message?.weaponFamily || ""),
        weaponKey: String(message?.weaponKey || message?.weaponId || ""),
        damageSource: String(message?.damageSource || ""),
        weaponSourceReason: String(message?.weaponSourceReason || message?.damageSource || ""),
        combatIntentReason: String(message?.combatIntentReason || message?.reason || ""),
        lockOnClearReason: String(message?.lockOnClearReason || ""),
        combatNodeValidationReason: String(message?.combatNodeValidationReason || ""),
        playerClientNode: String(message?.playerClientNode || ""),
        playerServerNode: String(message?.playerServerNode || ""),
        playerPresenceNode: String(message?.playerPresenceNode || ""),
        selectedBotId: String(message?.selectedBotId || ""),
        selectedBotNode: String(message?.selectedBotNode || ""),
        botServerNode: String(message?.botServerNode || ""),
        botVisualNode: String(message?.botVisualNode || ""),
        combatIntentNode: String(message?.combatIntentNode || ""),
        nodeCompareResult: String(message?.nodeCompareResult || ""),
        activeShipWeaponCount: Number.isFinite(Number(message?.activeShipWeaponCount)) ? Number(message.activeShipWeaponCount) : 0,
        validCombatWeaponCount: Number.isFinite(Number(message?.validCombatWeaponCount)) ? Number(message.validCombatWeaponCount) : 0,
        rejectedWeaponCount: Number.isFinite(Number(message?.rejectedWeaponCount)) ? Number(message.rejectedWeaponCount) : 0,
        firstRejectedWeaponReason: String(message?.firstRejectedWeaponReason || ""),
        fallbackDamageUsed: message?.fallbackDamageUsed === true,
        clientDamageIgnored: message?.clientDamageIgnored === true,
        serverAuthoritative: message?.serverAuthoritative === true,
        pulseLaserDetected: message?.pulseLaserDetected === true,
        serverDamageUsed: Number.isFinite(Number(message?.serverDamageUsed)) ? Number(message.serverDamageUsed) : null,
        damage: Number.isFinite(Number(message?.damage)) ? Number(message.damage) : 0,
        stagingDamage: Number.isFinite(Number(message?.stagingDamage)) ? Number(message.stagingDamage) : 0,
        shield: Number.isFinite(Number(message?.shield)) ? Number(message.shield) : 0,
        hull: Number.isFinite(Number(message?.hull)) ? Number(message.hull) : 0,
        disabled: message?.disabled === true,
        cooldownMs: Number.isFinite(Number(message?.cooldownMs)) ? Number(message.cooldownMs) : 0,
        nextFireAt: Number.isFinite(Number(message?.nextFireAt)) ? Number(message.nextFireAt) : 0,
        rewardsGranted: message?.rewardsGranted === true,
        receivedAt: Number.isFinite(Number(message?.receivedAt)) ? Number(message.receivedAt) : Date.now()
      };
      logDev("server combat intent resolved", message);
      if (connection.lastCombatResponse.disabled) {
        scheduleStagingCombatProgressRefresh("combatResolvedDisabled", connection.lastCombatResponse);
      }
    });

    activeRoom.onMessage("bot:disabled", (message) => {
      const contributors = Array.isArray(message?.contributors)
        ? message.contributors.map(normalizeRewardContributor).filter(Boolean)
        : [];
      const bountyProgress = normalizeStagingBounty(message?.bountyProgress);
      connection.lastBotEvent = {
        type: "bot:disabled",
        botId: String(message?.botId || ""),
        botName: String(message?.botName || "Staging Bot"),
        currentNode: String(message?.currentNode || ""),
        shield: Number.isFinite(Number(message?.shield)) ? Number(message.shield) : 0,
        hull: Number.isFinite(Number(message?.hull)) ? Number(message.hull) : 0,
        disabledUntil: Number.isFinite(Number(message?.disabledUntil)) ? Number(message.disabledUntil) : 0,
        destructionInstanceId: String(message?.destructionInstanceId || ""),
        rewardPreviewId: String(message?.rewardPreviewId || ""),
        botXpSourceEventId: String(message?.botXpSourceEventId || ""),
        disabledBySessionId: String(message?.disabledBySessionId || message?.finalHitBy || ""),
        finalHitBy: String(message?.finalHitBy || message?.disabledBySessionId || ""),
        topContributorSessionId: String(message?.topContributorSessionId || ""),
        contributors,
        previewXp: Number.isFinite(Number(message?.previewXp)) ? Number(message.previewXp) : 0,
        previewCredits: Number.isFinite(Number(message?.previewCredits)) ? Number(message.previewCredits) : 0,
        bountyProgress,
        bountyProgressChanged: message?.bountyProgressChanged === true,
        bountyProgressReason: String(message?.bountyProgressReason || ""),
        xpAwardedByServer: message?.xpAwardedByServer === true,
        xpReceiptPending: message?.xpReceiptPending === true,
        rewardReceipt: message?.rewardReceipt === true,
        rewardsGranted: message?.rewardsGranted === true,
        receivedAt: Number.isFinite(Number(message?.receivedAt)) ? Number(message.receivedAt) : Date.now()
      };
      if (connection.lastBotEvent.rewardReceipt) {
        connection.lastBotRewardReceipt = { ...connection.lastBotEvent };
        if (bountyProgress?.accepted && Number(bountyProgress.requiredKills || 0) > 0) {
          addStagingActivityLogOnce(
            `bot-reward-receipt:${connection.lastBotEvent.destructionInstanceId || connection.lastBotEvent.rewardPreviewId || connection.lastBotEvent.botId}`,
            `Bounty progress: ${Number(bountyProgress.progress || 0)} / ${Number(bountyProgress.requiredKills || 0)}.`
          );
        }
      }
      logDev("server bot disabled", message);
      if (typeof global.clearStagingBotTargetIfSelected === "function") {
        global.clearStagingBotTargetIfSelected(connection.lastBotEvent.botId);
      }
      scheduleStagingCombatProgressRefresh("botDisabled", connection.lastBotEvent);
    });

    activeRoom.onMessage("bot:respawned", (message) => {
      connection.lastBotEvent = {
        type: "bot:respawned",
        botId: String(message?.botId || ""),
        currentNode: String(message?.currentNode || ""),
        shield: Number.isFinite(Number(message?.shield)) ? Number(message.shield) : 0,
        hull: Number.isFinite(Number(message?.hull)) ? Number(message.hull) : 0,
        contributionCleared: message?.contributionCleared === true,
        contributors: Array.isArray(message?.contributors)
          ? message.contributors.map(normalizeRewardContributor).filter(Boolean)
          : [],
        rewardsGranted: message?.rewardsGranted === true,
        receivedAt: Number.isFinite(Number(message?.receivedAt)) ? Number(message.receivedAt) : Date.now()
      };
      logDev("server bot respawned", message);
    });

    activeRoom.onMessage("staging:shot", (message) => {
      const attackerSessionId = String(message?.attackerSessionId || "");
      const targetBotId = String(message?.targetBotId || "");
      connection.lastShotEvent = {
        ok: message?.ok === true,
        attackerSessionId,
        attackerDisplayName: String(message?.attackerDisplayName || ""),
        targetBotId,
        currentNode: String(message?.currentNode || ""),
        damage: Number.isFinite(Number(message?.damage)) ? Number(message.damage) : 0,
        weaponName: String(message?.weaponName || ""),
        weaponFamily: String(message?.weaponFamily || message?.weaponType || ""),
        damageSource: String(message?.damageSource || ""),
        fallbackDamageUsed: message?.fallbackDamageUsed === true,
        clientDamageIgnored: message?.clientDamageIgnored === true,
        serverAuthoritative: message?.serverAuthoritative === true,
        shield: Number.isFinite(Number(message?.shield)) ? Number(message.shield) : 0,
        hull: Number.isFinite(Number(message?.hull)) ? Number(message.hull) : 0,
        disabled: message?.disabled === true,
        rewardsGranted: message?.rewardsGranted === true,
        timestamp: Number.isFinite(Number(message?.timestamp)) ? Number(message.timestamp) : Date.now(),
        receivedAt: Number.isFinite(Number(message?.receivedAt)) ? Number(message.receivedAt) : Date.now()
      };
      const selectedTargetBotId = playersById.get(connection.sessionId)?.selectedTargetBotId || "";
      if (attackerSessionId && attackerSessionId !== connection.sessionId && targetBotId && selectedTargetBotId === targetBotId) {
        const bot = botsById.get(targetBotId);
        addStagingActivityLogOnce(
          `assist:${attackerSessionId}:${targetBotId}:${connection.lastShotEvent.timestamp || connection.lastShotEvent.receivedAt}`,
          `Assist registered on ${bot?.name || bot?.type || "Staging Bot"}.`
        );
      }
      logDev("server staging shot", message);
      notifyServerState(activeRoom.state || null);
    });

    activeRoom.onMessage("staging:return_fire", (message) => {
      connection.lastStagingReturnFire = normalizeStagingReturnFire(message);
      logDev("server staging return fire", message);
      if (connection.lastStagingReturnFire?.ok &&
        typeof global.applyStagingBotReturnFireDamage === "function") {
        const damageResult = global.applyStagingBotReturnFireDamage(connection.lastStagingReturnFire);
        if (damageResult && typeof damageResult === "object") {
          connection.lastStagingReturnFire = {
            ...connection.lastStagingReturnFire,
            playerShieldBefore: Number.isFinite(Number(damageResult.shieldBefore)) ? Number(damageResult.shieldBefore) : null,
            playerShieldAfter: Number.isFinite(Number(damageResult.shieldAfter)) ? Number(damageResult.shieldAfter) : null,
            playerHullBefore: Number.isFinite(Number(damageResult.hullBefore)) ? Number(damageResult.hullBefore) : null,
            playerHullAfter: Number.isFinite(Number(damageResult.hullAfter)) ? Number(damageResult.hullAfter) : null,
            shieldDamage: Number.isFinite(Number(damageResult.shieldDamage)) ? Number(damageResult.shieldDamage) : 0,
            hullDamage: Number.isFinite(Number(damageResult.hullDamage)) ? Number(damageResult.hullDamage) : 0,
            playerDestroyed: damageResult.playerDestroyed === true,
            botAttackStatus: String(damageResult.botAttackStatus || connection.lastStagingReturnFire.botAttackStatus || "cooldown"),
            botAttackReason: String(damageResult.botAttackReason || connection.lastStagingReturnFire.botAttackReason || "return_fire_applied")
          };
        }
      }
      notifyServerState(activeRoom.state || null);
    });

    activeRoom.onMessage("stagingResource:mineResult", (message) => {
      const normalized = normalizeStagingResourceEvent(message);
      let localApplyResult = null;
      if (normalized.ok && normalized.cargoDelta > 0 && typeof global.applyStagingResourceMineResult === "function") {
        localApplyResult = global.applyStagingResourceMineResult(normalized);
      }
      connection.lastStagingResourceMineResult = {
        ...normalized,
        localApplyResult: localApplyResult && typeof localApplyResult === "object" ? { ...localApplyResult } : null,
        localApplied: localApplyResult?.applied === true,
        localCollected: Number.isFinite(Number(localApplyResult?.collectedAmount)) ? Number(localApplyResult.collectedAmount) : 0,
        localOverflow: Number.isFinite(Number(localApplyResult?.overflowAmount)) ? Number(localApplyResult.overflowAmount) : 0,
        localCargoUsedBefore: Number.isFinite(Number(localApplyResult?.cargoUsedBefore)) ? Number(localApplyResult.cargoUsedBefore) : null,
        localCargoUsedAfter: Number.isFinite(Number(localApplyResult?.cargoUsedAfter)) ? Number(localApplyResult.cargoUsedAfter) : null,
        localCargoCapacity: Number.isFinite(Number(localApplyResult?.cargoCapacity)) ? Number(localApplyResult.cargoCapacity) : null
      };
      connection.lastStagingResourceEvent = { ...connection.lastStagingResourceMineResult, type: "mineResult" };
      logDev("server staging resource mine result", message);
      notifyServerState(activeRoom.state || null);
    });

    activeRoom.onMessage("stagingResource:mineRejected", (message) => {
      connection.lastStagingResourceMineResult = {
        ...normalizeStagingResourceEvent(message),
        ok: false,
        reason: String(message?.reason || "staging_resource_mine_rejected")
      };
      connection.lastStagingResourceEvent = { ...connection.lastStagingResourceMineResult, type: "mineRejected" };
      logDev("server staging resource mine rejected", message);
      notifyServerState(activeRoom.state || null);
    });

    ["stagingResource:shot", "stagingResource:depleted", "stagingResource:respawned"].forEach((type) => {
      activeRoom.onMessage(type, (message) => {
        connection.lastStagingResourceEvent = {
          ...normalizeStagingResourceEvent(message),
          type
        };
        logDev(`server ${type}`, message);
        notifyServerState(activeRoom.state || null);
      });
    });

    activeRoom.onMessage("staging:reward_preview", (message) => {
      const contributors = Array.isArray(message?.contributors)
        ? message.contributors.map(normalizeRewardContributor).filter(Boolean)
        : [];
      connection.lastRewardPreview = {
        ok: message?.ok === true,
        rewardPreviewId: String(message?.rewardPreviewId || ""),
        destructionInstanceId: String(message?.destructionInstanceId || ""),
        botXpSourceEventId: String(message?.botXpSourceEventId || ""),
        botId: String(message?.botId || ""),
        botName: String(message?.botName || "Staging Bot"),
        disabledBySessionId: String(message?.disabledBySessionId || ""),
        finalHitBy: String(message?.finalHitBy || message?.disabledBySessionId || ""),
        finalHitPlayerId: String(message?.finalHitPlayerId || ""),
        finalHitDisplayName: String(message?.finalHitDisplayName || ""),
        topContributorSessionId: String(message?.topContributorSessionId || message?.topContributor?.sessionId || ""),
        topContributorPlayerId: String(message?.topContributorPlayerId || ""),
        topContributorDisplayName: String(message?.topContributorDisplayName || ""),
        topContributor: normalizeRewardContributor(message?.topContributor),
        contributors,
        totalDamage: Number.isFinite(Number(message?.totalDamage)) ? Number(message.totalDamage) : 0,
        node: String(message?.node || ""),
        previewXp: Number.isFinite(Number(message?.previewXp)) ? Number(message.previewXp) : 0,
        previewCredits: Number.isFinite(Number(message?.previewCredits)) ? Number(message.previewCredits) : 0,
        previewLoot: Array.isArray(message?.previewLoot)
          ? message.previewLoot.map((item) => String(item || "")).filter(Boolean)
          : [],
        lootPreview: normalizeStagingLootPreview(message?.lootPreview),
        inventoryWritten: message?.inventoryWritten === true,
        ownedGunsWritten: message?.ownedGunsWritten === true,
        ownedAttachmentsWritten: message?.ownedAttachmentsWritten === true,
        cargoWritten: message?.cargoWritten === true,
        creditsWritten: message?.creditsWritten === true,
        bountyWritten: message?.bountyWritten === true,
        saveWritten: message?.saveWritten === true,
        applied: message?.applied === true,
        dryRun: message?.dryRun === true,
        reason: String(message?.reason || "staging_preview_only"),
        receivedAt: Number.isFinite(Number(message?.receivedAt)) ? Number(message.receivedAt) : Date.now()
      };
      logDev("server staging reward preview", message);
      scheduleStagingCombatProgressRefresh("rewardPreview", connection.lastRewardPreview);
      notifyServerState(activeRoom.state || null);
    });

    activeRoom.onMessage("reward:claim_preview_result", (message) => {
      const contributors = Array.isArray(message?.contributors)
        ? message.contributors.map(normalizeRewardContributor).filter(Boolean)
        : [];
      const normalized = {
        playerSave: normalizeClaimPlayerSave(message?.playerSave || message?.claimStatus?.playerSave),
        claimStatus: normalizeRewardClaimStatus(message?.claimStatus),
        playerSavePatchResult: normalizePlayerSavePatchResult(message?.playerSavePatchResult)
      };
      const xp = getXpMetadataFromResult({
        ...message,
        ...normalized
      });
      connection.lastRewardClaimResult = {
        ok: message?.ok === true,
        rewardPreviewId: String(message?.rewardPreviewId || ""),
        botId: String(message?.botId || ""),
        botName: String(message?.botName || "Staging Bot"),
        claimedBySessionId: String(message?.claimedBySessionId || message?.sessionId || ""),
        finalHitBy: String(message?.finalHitBy || message?.disabledBySessionId || ""),
        finalHitPlayerId: String(message?.finalHitPlayerId || ""),
        finalHitDisplayName: String(message?.finalHitDisplayName || ""),
        topContributorSessionId: String(message?.topContributorSessionId || message?.topContributor?.sessionId || ""),
        topContributorPlayerId: String(message?.topContributorPlayerId || ""),
        topContributorDisplayName: String(message?.topContributorDisplayName || ""),
        topContributor: normalizeRewardContributor(message?.topContributor),
        contributors,
        totalDamage: Number.isFinite(Number(message?.totalDamage)) ? Number(message.totalDamage) : 0,
        node: String(message?.node || ""),
        previewXp: Number.isFinite(Number(message?.previewXp)) ? Number(message.previewXp) : 0,
        previewCredits: Number.isFinite(Number(message?.previewCredits)) ? Number(message.previewCredits) : 0,
        previewLoot: Array.isArray(message?.previewLoot)
          ? message.previewLoot.map((item) => String(item || "")).filter(Boolean)
          : [],
        lootPreview: normalizeStagingLootPreview(message?.lootPreview),
        inventoryWritten: message?.inventoryWritten === true,
        ownedGunsWritten: message?.ownedGunsWritten === true,
        ownedAttachmentsWritten: message?.ownedAttachmentsWritten === true,
        cargoWritten: message?.cargoWritten === true,
        creditsWritten: message?.creditsWritten === true,
        bountyWritten: message?.bountyWritten === true,
        saveWritten: xp.saveWritten,
        applied: xp.applied,
        mode: String(message?.mode || message?.claimStatus?.mode || ""),
        xpDelta: Number.isFinite(Number(message?.xpDelta ?? message?.claimStatus?.xpDelta))
          ? Number(message?.xpDelta ?? message?.claimStatus?.xpDelta)
          : 0,
        xpBefore: xp.xpBefore,
        xpAfter: xp.xpAfter,
        persistedXp: xp.persistedXp,
        persistedZoneXp: xp.persistedZoneXp,
        persistenceVerified: xp.persistenceVerified,
        dryRun: message?.dryRun === true,
        debugReason: String(message?.debugReason || message?.claimStatus?.debugReason || ""),
        gates: normalizeClaimGates(message?.gates || message?.claimStatus?.gates),
        ledger: normalizeClaimLedger(message?.ledger || message?.claimStatus?.ledger),
        progressionShadow: normalizeClaimProgressionShadow(message?.progressionShadow || message?.claimStatus?.progressionShadow),
        playerSave: normalized.playerSave,
        claimStatus: normalized.claimStatus,
        rewardWritePlan: normalizeRewardWritePlan(message?.rewardWritePlan),
        rewardLedgerResult: normalizeRewardLedgerResult(message?.rewardLedgerResult),
        rewardApplicationPlan: normalizeRewardApplicationPlan(message?.rewardApplicationPlan),
        rewardApplicationResult: normalizeRewardApplicationResult(message?.rewardApplicationResult),
        progressionPreview: normalizeProgressionPreview(message?.progressionPreview),
        progressionShadowResult: normalizeProgressionShadowResult(message?.progressionShadowResult),
        playerSavePatchPlan: normalizePlayerSavePatchPlan(message?.playerSavePatchPlan),
        playerSavePatchResult: normalized.playerSavePatchResult,
        claimSimulated: message?.claimSimulated === true,
        reason: String(message?.reason || "staging_preview_only"),
        receivedAt: Number.isFinite(Number(message?.receivedAt)) ? Number(message.receivedAt) : Date.now()
      };
      refreshCloudSaveAfterStagingXpClaim(connection.lastRewardClaimResult);
      scheduleStagingCombatProgressRefresh("rewardClaim", connection.lastRewardClaimResult);
      logDev("server staging reward claim preview result", message);
      notifyServerState(activeRoom.state || null);
    });

    activeRoom.onMessage("stagingXp:botKillResult", (message) => {
      connection.lastStagingBotXpResult = normalizeStagingXpResult(message);
      if (connection.lastStagingBotXpResult?.applied) {
        const result = connection.lastStagingBotXpResult;
        if (typeof global.applyStagingXpClaimToLoadedState === "function") {
          global.applyStagingXpClaimToLoadedState({
            ...result,
            xpSource: "botKillEvent",
            saveWritten: result.saveWritten === true || result.playerSavePatchResult?.applied === true
          });
        }
        const xpDelta = Math.max(0, Math.round(Number(result.xpDelta || 0)));
        addStagingActivityLogOnce(
          `bot-xp:${result.destructionInstanceId || result.idempotencyKey || result.botId}:${result.xpAfter}`,
          `Destroyed ${result.botName || "Staging Bot"}.${xpDelta > 0 ? ` +${xpDelta} XP.` : ""}`
        );
      } else if (typeof global.awardLocalStagingBotKillXpFromServer === "function") {
        const localResult = global.awardLocalStagingBotKillXpFromServer(connection.lastStagingBotXpResult);
        connection.lastStagingBotXpResult = {
          ...connection.lastStagingBotXpResult,
          localFallbackApplied: localResult?.applied === true,
          localFallbackReason: String(localResult?.reason || ""),
          localFallbackXpDelta: Number.isFinite(Number(localResult?.xpDelta)) ? Number(localResult.xpDelta) : 0,
          localFallbackXpAfter: Number.isFinite(Number(localResult?.xpAfter)) ? Number(localResult.xpAfter) : null
        };
        if (localResult?.applied === true) {
          connection.lastStagingXpRefresh = {
            source: "localBotKillFallback",
            status: "local_applied",
            trustedXpAfter: null,
            refreshXp: Number(localResult.xpAfter),
            matched: true,
            stale: false,
            reason: localResult.reason,
            checkedAt: Date.now()
          };
        }
      }
      refreshCloudSaveAfterStagingXpClaim(connection.lastStagingBotXpResult);
      scheduleStagingCombatProgressRefresh("botKillXp", connection.lastStagingBotXpResult);
      logDev("server staging bot kill XP result", message);
      notifyServerState(activeRoom.state || null);
    });

    activeRoom.onMessage("stagingLoot:claimResult", (message) => {
      connection.lastStagingLootClaimResult = normalizeStagingLootClaimResult(message);
      refreshCloudSaveAfterStagingLootClaim(connection.lastStagingLootClaimResult);
      logDev("server staging loot claim result", message);
      notifyServerState(activeRoom.state || null);
    });

    activeRoom.onMessage("stagingBounty:listResult", (message) => {
      connection.lastStagingBountyList = normalizeStagingBountyList(message);
      if (connection.lastStagingBountyList?.active?.accepted) {
        connection.lastStagingBountyStatus = {
          ok: true,
          reason: connection.lastStagingBountyList.reason,
          active: connection.lastStagingBountyList.active,
          receivedAt: connection.lastStagingBountyList.receivedAt
        };
      }
      logDev("server staging bounty list", message);
      notifyServerState(activeRoom.state || null);
    });

    activeRoom.onMessage("stagingBounty:statusResult", (message) => {
      connection.lastStagingBountyStatus = normalizeStagingBountyStatus(message);
      const active = connection.lastStagingBountyStatus?.active;
      if (active?.accepted) {
        addStagingActivityLogOnce(
          `bounty-accepted:${active.id}`,
          `Bounty accepted: ${active.title}. Destroy ${active.requiredKills} Erebus bots.`
        );
      }
      if (active?.accepted && active.progress > 0) {
        addStagingActivityLogOnce(
          `bounty-progress:${active.id}:${active.progress}`,
          `Bounty progress: ${active.progress}/${active.requiredKills} Erebus bots destroyed.`
        );
      }
      if (active?.claimAvailable || active?.completed) {
        addStagingActivityLogOnce(
          `bounty-complete:${active.id}:${active.completionSequence || active.progress}`,
          `Bounty complete: ${active.title}.`
        );
      }
      logDev("server staging bounty status", message);
      notifyServerState(activeRoom.state || null);
    });

    activeRoom.onMessage("stagingBounty:claimResult", (message) => {
      connection.lastStagingBountyClaimResult = normalizeStagingBountyClaimResult(message);
      if (connection.lastStagingBountyClaimResult?.bounty) {
        connection.lastStagingBountyStatus = {
          ok: true,
          reason: connection.lastStagingBountyClaimResult.reason,
          active: connection.lastStagingBountyClaimResult.bounty,
          receivedAt: connection.lastStagingBountyClaimResult.receivedAt
        };
      }
      refreshCloudSaveAfterStagingXpClaim(connection.lastStagingBountyClaimResult);
      if (connection.lastStagingBountyClaimResult?.applied) {
        const claim = connection.lastStagingBountyClaimResult;
        addStagingActivityLogOnce(
          `bounty-claimed:${claim.bounty?.id || claim.id}:${claim.xpAfter || claim.receivedAt}`,
          `Bounty XP claimed: +${Math.round(Number(claim.xpDelta || 0))} XP.`
        );
      }
      logDev("server staging bounty claim result", message);
      notifyServerState(activeRoom.state || null);
    });

    activeRoom.onMessage("stagingTrade:offers", (message) => {
      connection.lastStagingTradeOffers = {
        ok: message?.ok === true,
        mode: String(message?.mode || "dry_run"),
        applied: message?.applied === true,
        offers: Array.isArray(message?.offers)
          ? message.offers.map(normalizeStagingTradeOffer).filter(Boolean)
          : [],
        creditsWritten: message?.creditsWritten === true,
        cargoWritten: message?.cargoWritten === true,
        saveWritten: message?.saveWritten === true,
        reason: String(message?.reason || ""),
        receivedAt: Number.isFinite(Number(message?.receivedAt)) ? Number(message.receivedAt) : Date.now()
      };
      logDev("server staging trade offers", message);
      notifyServerState(activeRoom.state || null);
    });

    activeRoom.onMessage("stagingTrade:previewResult", (message) => {
      connection.lastStagingTradePreview = normalizeStagingTradePreview(message);
      logDev("server staging trade preview", message);
      notifyServerState(activeRoom.state || null);
    });

    activeRoom.onMessage("stagingTrade:buyResult", (message) => {
      connection.lastStagingTradeWriteResult = normalizeStagingTradeWriteResult(message);
      logDev("server staging trade buy result", message);
      notifyServerState(activeRoom.state || null);
    });

    activeRoom.onMessage("stagingTrade:sellResult", (message) => {
      connection.lastStagingTradeWriteResult = normalizeStagingTradeWriteResult(message);
      logDev("server staging trade sell result", message);
      notifyServerState(activeRoom.state || null);
    });

    activeRoom.onMessage("stagingStore:items", (message) => {
      connection.lastStagingStoreItems = {
        ok: message?.ok === true,
        mode: String(message?.mode || "dry_run"),
        applied: message?.applied === true,
        items: Array.isArray(message?.items)
          ? message.items.map(normalizeStagingStoreItem).filter(Boolean)
          : [],
        creditsWritten: message?.creditsWritten === true,
        inventoryWritten: message?.inventoryWritten === true,
        shipWritten: message?.shipWritten === true,
        equipmentWritten: message?.equipmentWritten === true,
        saveWritten: message?.saveWritten === true,
        lootWritten: message?.lootWritten === true,
        bountyWritten: message?.bountyWritten === true,
        reason: String(message?.reason || ""),
        receivedAt: Number.isFinite(Number(message?.receivedAt)) ? Number(message.receivedAt) : Date.now()
      };
      logDev("server staging store items", message);
      notifyServerState(activeRoom.state || null);
    });

    activeRoom.onMessage("stagingStore:previewResult", (message) => {
      connection.lastStagingStorePreview = normalizeStagingStorePreview(message);
      logDev("server staging store preview", message);
      notifyServerState(activeRoom.state || null);
    });

    activeRoom.onMessage("stagingStore:purchaseResult", (message) => {
      connection.lastStagingStorePurchase = normalizeStagingStorePreview(message);
      logDev("server staging store purchase", message);
      notifyServerState(activeRoom.state || null);
    });

    activeRoom.onMessage("stagingLoadout:previewResult", (message) => {
      connection.lastStagingLoadoutPreview = normalizeStagingLoadoutEquip(message);
      logDev("server staging loadout preview", message);
      notifyServerState(activeRoom.state || null);
    });

    activeRoom.onMessage("stagingLoadout:equipResult", (message) => {
      connection.lastStagingLoadoutEquip = normalizeStagingLoadoutEquip(message);
      logDev("server staging loadout equip", message);
      notifyServerState(activeRoom.state || null);
    });

    activeRoom.onMessage("target:selected", (message) => {
      connection.lastTargetResponse = {
        ok: message?.ok === true,
        reason: String(message?.reason || "target_selected"),
        lockOnClearReason: String(message?.lockOnClearReason || ""),
        combatNodeValidationReason: String(message?.combatNodeValidationReason || ""),
        playerClientNode: String(message?.playerClientNode || ""),
        playerServerNode: String(message?.playerServerNode || ""),
        playerPresenceNode: String(message?.playerPresenceNode || ""),
        selectedBotId: String(message?.selectedBotId || ""),
        selectedBotNode: String(message?.selectedBotNode || ""),
        botServerNode: String(message?.botServerNode || ""),
        botVisualNode: String(message?.botVisualNode || ""),
        combatIntentNode: String(message?.combatIntentNode || ""),
        nodeCompareResult: String(message?.nodeCompareResult || ""),
        targetBotId: String(message?.targetBotId || ""),
        currentNode: String(message?.currentNode || ""),
        receivedAt: Number.isFinite(Number(message?.receivedAt)) ? Number(message.receivedAt) : Date.now()
      };
      logDev("server target selection response", message);
    });

    activeRoom.onMessage("target:rejected", (message) => {
      connection.lastTargetResponse = {
        ok: false,
        reason: String(message?.reason || "target_rejected"),
        lockOnClearReason: String(message?.lockOnClearReason || message?.reason || "target_rejected"),
        combatNodeValidationReason: String(message?.combatNodeValidationReason || ""),
        playerClientNode: String(message?.playerClientNode || ""),
        playerServerNode: String(message?.playerServerNode || ""),
        playerPresenceNode: String(message?.playerPresenceNode || ""),
        selectedBotId: String(message?.selectedBotId || ""),
        selectedBotNode: String(message?.selectedBotNode || ""),
        botServerNode: String(message?.botServerNode || ""),
        botVisualNode: String(message?.botVisualNode || ""),
        combatIntentNode: String(message?.combatIntentNode || ""),
        nodeCompareResult: String(message?.nodeCompareResult || ""),
        targetBotId: String(message?.targetBotId || ""),
        currentNode: "",
        receivedAt: Number.isFinite(Number(message?.receivedAt)) ? Number(message.receivedAt) : Date.now()
      };
      logDev("server target selection rejected", message);
    });

    activeRoom.onLeave((code) => {
      logDev(`left ${connection.roomName}`, { code });
      connection.isConnected = false;
      connection.isConnecting = false;
      connection.sessionId = null;
      room = null;
      colyseusClient = null;
      playersById.clear();
      botsById.clear();
      resourcesById.clear();
      clearChatMessages();
      connection.presenceEvents = [];
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
    const localPresence = getLocalPresenceOptions();
    const selfPlayer = playersById.get(connection.sessionId);
    const lastBotUpdateAt = Array.from(botsById.values()).reduce((latest, bot) => {
      return Math.max(latest, Number(bot.lastUpdatedAt || 0));
    }, 0);
    const lastResourceUpdateAt = Array.from(resourcesById.values()).reduce((latest, resource) => {
      return Math.max(latest, Number(resource.lastUpdatedAt || 0));
    }, 0);

    return {
      enabled: connection.enabled,
      isConnected: connection.isConnected,
      connected: connection.isConnected,
      isConnecting: connection.isConnecting,
      roomName: connection.roomName,
      sessionId: connection.sessionId,
      currentNode: localPresence.currentNode || "",
      presenceStatus: localPresence.presenceStatus || "space",
      clientLoadSource: connection.clientLoadSource,
      clientLoadError: connection.clientLoadError,
      lastError: connection.lastError,
      lastServerWarning: connection.lastServerWarning,
      lastCombatResponse: connection.lastCombatResponse ? { ...connection.lastCombatResponse } : null,
      lastTargetResponse: connection.lastTargetResponse ? { ...connection.lastTargetResponse } : null,
      lastBotEvent: connection.lastBotEvent ? { ...connection.lastBotEvent } : null,
      lastBotRewardReceipt: connection.lastBotRewardReceipt ? { ...connection.lastBotRewardReceipt } : null,
      lastShotEvent: connection.lastShotEvent ? { ...connection.lastShotEvent } : null,
      lastStagingReturnFire: connection.lastStagingReturnFire ? { ...connection.lastStagingReturnFire } : null,
      lastRewardPreview: connection.lastRewardPreview ? { ...connection.lastRewardPreview } : null,
      lastRewardClaimResult: connection.lastRewardClaimResult ? { ...connection.lastRewardClaimResult } : null,
      lastStagingBotXpResult: connection.lastStagingBotXpResult ? { ...connection.lastStagingBotXpResult } : null,
      lastStagingLootClaimResult: connection.lastStagingLootClaimResult ? { ...connection.lastStagingLootClaimResult } : null,
      lastChatSend: connection.lastChatSend ? { ...connection.lastChatSend } : null,
      lastStagingTradeOffers: connection.lastStagingTradeOffers
        ? {
          ...connection.lastStagingTradeOffers,
          offers: Array.isArray(connection.lastStagingTradeOffers.offers)
            ? connection.lastStagingTradeOffers.offers.map((offer) => ({ ...offer }))
            : []
        }
        : null,
      lastStagingTradePreview: connection.lastStagingTradePreview ? { ...connection.lastStagingTradePreview } : null,
      lastStagingTradeWriteResult: connection.lastStagingTradeWriteResult ? { ...connection.lastStagingTradeWriteResult } : null,
      lastStagingStoreItems: connection.lastStagingStoreItems
        ? {
          ...connection.lastStagingStoreItems,
          items: Array.isArray(connection.lastStagingStoreItems.items)
            ? connection.lastStagingStoreItems.items.map((item) => ({ ...item }))
            : []
        }
        : null,
      lastStagingStorePreview: connection.lastStagingStorePreview ? { ...connection.lastStagingStorePreview } : null,
      lastStagingStorePurchase: connection.lastStagingStorePurchase ? { ...connection.lastStagingStorePurchase } : null,
      lastStagingLoadoutPreview: connection.lastStagingLoadoutPreview ? { ...connection.lastStagingLoadoutPreview } : null,
      lastStagingLoadoutEquip: connection.lastStagingLoadoutEquip ? { ...connection.lastStagingLoadoutEquip } : null,
      lastStagingBountyList: connection.lastStagingBountyList
        ? {
          ...connection.lastStagingBountyList,
          bounties: Array.isArray(connection.lastStagingBountyList.bounties)
            ? connection.lastStagingBountyList.bounties.map((bounty) => ({ ...bounty }))
            : [],
          active: connection.lastStagingBountyList.active ? { ...connection.lastStagingBountyList.active } : null
        }
        : null,
      lastStagingBountyStatus: connection.lastStagingBountyStatus
        ? {
          ...connection.lastStagingBountyStatus,
          active: connection.lastStagingBountyStatus.active ? { ...connection.lastStagingBountyStatus.active } : null
        }
        : null,
      lastStagingBountyClaimResult: connection.lastStagingBountyClaimResult
        ? {
          ...connection.lastStagingBountyClaimResult,
          bounty: connection.lastStagingBountyClaimResult.bounty ? { ...connection.lastStagingBountyClaimResult.bounty } : null
        }
        : null,
      lastStagingResourceMineResult: connection.lastStagingResourceMineResult ? { ...connection.lastStagingResourceMineResult } : null,
      lastStagingResourceEvent: connection.lastStagingResourceEvent ? { ...connection.lastStagingResourceEvent } : null,
      listenerCount: stateListeners.size,
      playerCount: playersById.size,
      botCount: botsById.size,
      resourceCount: resourcesById.size,
      lastBotUpdateAt,
      lastResourceUpdateAt,
      selectedTargetBotId: playersById.get(connection.sessionId)?.selectedTargetBotId || "",
      nextFireAt: playersById.get(connection.sessionId)?.nextFireAt || 0,
      fireCooldownRemainingMs: Math.max(0, Math.ceil((playersById.get(connection.sessionId)?.nextFireAt || 0) - Date.now())),
      authStatus: selfPlayer?.authStatus || identity.authStatus,
      playerIdPresent: !!(selfPlayer?.trustedPlayerId || selfPlayer?.playerId || identity.playerIdPresent),
      trustedPlayerIdPresent: !!selfPlayer?.trustedPlayerId,
      supabaseSessionPresent: identity.sessionPresent,
      supabaseTokenPresent: identity.tokenPresent,
      supabaseTokenSent: identity.tokenSent || selfPlayer?.authTokenReceived === true,
      supabaseSessionWaitTimedOut: identity.sessionWaitTimedOut,
      supabaseTokenVerificationAttempted: selfPlayer?.authVerificationAttempted === true || identity.tokenVerificationAttempted,
      supabaseTokenVerificationReason: selfPlayer?.authVerificationReason || identity.tokenVerificationReason || "",
      displayName: selfPlayer?.displayName || identity.displayName || localPresence.displayName || "Pilot",
      guildId: selfPlayer?.guildId || localPresence.guildId || "",
      playerClientNode: localPresence.currentNode || "",
      playerServerNode: selfPlayer?.currentNode || "",
      playerPresenceNode: selfPlayer?.currentNode || "",
      selectedBotNode: connection.lastTargetResponse?.selectedBotNode || connection.lastCombatResponse?.selectedBotNode || "",
      botServerNode: connection.lastTargetResponse?.botServerNode || connection.lastCombatResponse?.botServerNode || "",
      botVisualNode: connection.lastTargetResponse?.botVisualNode || connection.lastCombatResponse?.botVisualNode || "",
      combatIntentNode: connection.lastCombatResponse?.combatIntentNode || connection.lastTargetResponse?.combatIntentNode || "",
      nodeCompareResult: connection.lastCombatResponse?.nodeCompareResult || connection.lastTargetResponse?.nodeCompareResult || "",
      combatIntentReason: connection.lastCombatResponse?.combatIntentReason || selfPlayer?.lastCombatIntentReason || "",
      lockOnClearReason: connection.lastTargetResponse?.lockOnClearReason || connection.lastCombatResponse?.lockOnClearReason || selfPlayer?.lastLockOnClearReason || "",
      weaponSourceReason: connection.lastCombatResponse?.weaponSourceReason || selfPlayer?.lastWeaponSourceReason || "",
      engageValidationReason: connection.lastCombatResponse?.validation || connection.lastCombatResponse?.combatIntentReason || "",
      combatNodeValidationReason: connection.lastCombatResponse?.combatNodeValidationReason || connection.lastTargetResponse?.combatNodeValidationReason || selfPlayer?.lastCombatNodeValidationReason || "",
      activeShipWeaponCount: Number(connection.lastCombatResponse?.activeShipWeaponCount || selfPlayer?.activeShipWeaponCount || 0),
      validCombatWeaponCount: Number(connection.lastCombatResponse?.validCombatWeaponCount || selfPlayer?.validCombatWeaponCount || 0),
      rejectedWeaponCount: Number(connection.lastCombatResponse?.rejectedWeaponCount || selfPlayer?.rejectedWeaponCount || 0),
      firstRejectedWeaponReason: connection.lastCombatResponse?.firstRejectedWeaponReason || selfPlayer?.firstRejectedWeaponReason || "",
      localShipId: localPresence.currentShipId || "",
      localShipImage: localPresence.shipImage || localPresence.shipImageSrc || localPresence.shipImagePath || "",
      localEquippedWeaponKey: localPresence.equippedWeaponKey || "",
      localEquippedWeaponKeys: Array.isArray(localPresence.equippedWeaponKeys)
        ? localPresence.equippedWeaponKeys.map((key) => String(key || "")).filter(Boolean)
        : String(localPresence.equippedWeaponKeys || "").split(",").map((key) => key.trim()).filter(Boolean),
      originalServerUrl: connection.originalServerUrl,
      serverUrl: connection.serverUrl,
      serverUrlSource: connection.serverUrlSource,
      serverConfigSource: connection.serverUrlSource,
      configSource: connection.serverUrlSource,
      enabledReason: connection.enabledReason
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
      const serverUrl = options.serverUrl || connection.serverUrl || localServerUrl;
      logDev(`connecting to ${serverUrl}`, { roomName: connection.roomName, source: connection.serverUrlSource });

      try {
        const Colyseus = await ensureBrowserClientLoaded();
        const localPresence = getLocalPresenceOptions();
        const identityOptions = await getMultiplayerIdentityOptions(localPresence);
        identity.tokenSent = !!identityOptions.supabaseAccessToken;
        identity.tokenVerificationAttempted = false;
        identity.tokenVerificationReason = identity.tokenSent ? "token_sent_for_join" : "token_missing_at_join";
        colyseusClient = new Colyseus.Client(serverUrl);
        room = await colyseusClient.joinOrCreate(connection.roomName, {
          ...localPresence,
          ...identityOptions,
          multiplayerMode: getMultiplayerMode(),
          displayName: options.displayName || identityOptions.displayName || localPresence.displayName || "Pilot",
          currentNode: options.currentNode || localPresence.currentNode || "Asteron Prime"
        });

        connection.isConnected = true;
        connection.isConnecting = false;
        connection.sessionId = room.sessionId;
        bindRoomEvents(room);
        logDev(`connected to ${connection.roomName}`, { sessionId: connection.sessionId });

        if (options.sendInitialPing !== false) {
          client.sendPing({ local: true, auto: true });
        }

        global.setTimeout(() => {
          const refreshedPresence = getLocalPresenceOptions();
          if (connection.isConnected && refreshedPresence && Object.keys(refreshedPresence).length) {
            client.sendMovementIntent({
              ...refreshedPresence,
              reason: "connection_presence_refresh"
            });
          }
        }, 300);
        scheduleStagingAuthReconnect();

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
        playersById.clear();
        botsById.clear();
        resourcesById.clear();
        clearChatMessages();
        connection.presenceEvents = [];
        return statusResult("disconnect", true, { alreadyDisconnected: true });
      }

      logDev(`disconnecting from ${connection.roomName}`);
      room.leave();
      connection.isConnected = false;
      connection.isConnecting = false;
      connection.sessionId = null;
      room = null;
      colyseusClient = null;
      playersById.clear();
      botsById.clear();
      resourcesById.clear();
      clearChatMessages();
      connection.presenceEvents = [];
      notifyServerState(null);
      return statusResult("disconnect");
    },

    sendPlayerIntent(intent = {}) {
      return sendRoomMessage("sendPlayerIntent", "presence:update", intent);
    },

    sendMovementIntent(intent = {}) {
      return sendRoomMessage("sendMovementIntent", "movement:update", intent);
    },

    sendChatMessage(options = {}) {
      const message = normalizeChatText(options.message || options.text);
      if (!message) {
        connection.lastChatSend = {
          ok: false,
          reason: "empty_message",
          channel: "sector",
          length: 0,
          sentAt: Date.now()
        };
        return statusResult("sendChatMessage", false, { reason: "empty_message" });
      }
      const result = sendRoomMessage("sendChatMessage", "chat:send", { channel: "sector", message });
      connection.lastChatSend = {
        ok: result.ok === true,
        reason: String(result.reason || (result.ok ? "sent" : "not_sent")),
        channel: "sector",
        length: message.length,
        connected: result.connected === true,
        sentAt: Date.now()
      };
      return result;
    },

    sendCombatIntent(intent = {}) {
      if (intent?.targetPlayerId || intent?.targetSessionId || intent?.targetType === "remotePlayer") {
        return statusResult("sendCombatIntent", false, {
          reason: "pvp_unavailable_in_staging",
          pvpIntent: true,
          targetType: String(intent?.targetType || "remotePlayer"),
          targetPlayerId: String(intent?.targetPlayerId || intent?.targetSessionId || ""),
          pvpRulePreview: "client_pvp_disabled",
          pvpEligibility: {
            allowed: false,
            reason: "client_pvp_disabled",
            pvpEnabled: false
          },
          pvpDamageApplied: false,
          playerDamageApplied: false,
          mutatedPlayerState: false
        });
      }
      return sendRoomMessage("sendCombatIntent", "combat:intent", intent);
    },

    sendSelectedStagingBotCombatIntent(intent = {}) {
      const localPresence = getLocalPresenceOptions();
      const selectedTargetBotId = playersById.get(connection.sessionId)?.selectedTargetBotId || "";
      return sendRoomMessage("sendSelectedStagingBotCombatIntent", "combat:intent", {
        ...getStagingWeaponIntent(),
        ...intent,
        targetBotId: intent.targetBotId || selectedTargetBotId,
        currentNode: intent.currentNode || localPresence.currentNode || ""
      });
    },

    selectStagingBot(botId, options = {}) {
      const localPresence = getLocalPresenceOptions();
      return sendRoomMessage("selectStagingBot", "target:select", {
        targetBotId: String(botId || ""),
        currentNode: options.currentNode || localPresence.currentNode || ""
      });
    },

    clearStagingTarget() {
      return sendRoomMessage("clearStagingTarget", "target:clear", {});
    },

    mineStagingResource(resourceId, options = {}) {
      const localPresence = getLocalPresenceOptions();
      return sendRoomMessage("mineStagingResource", "stagingResource:mine", {
        ...getStagingWeaponIntent(),
        ...options,
        resourceId: String(resourceId || options.resourceId || options.targetResourceId || ""),
        currentNode: options.currentNode || localPresence.currentNode || ""
      });
    },

    claimStagingRewardPreview(options = {}) {
      const preview = connection.lastRewardPreview || {};
      return sendRoomMessage("claimStagingRewardPreview", "reward:claim_preview", {
        botId: options.botId || preview.botId || "",
        rewardPreviewId: options.rewardPreviewId || preview.rewardPreviewId || ""
      });
    },

    claimStagingLoot(options = {}) {
      const preview = connection.lastRewardPreview || {};
      const lootPreview = preview.lootPreview || {};
      const defaultLoot = Array.isArray(lootPreview.items)
        ? lootPreview.items.find((item) => item?.lootId === "preview:lupenShard" || item?.lootId === "lupenShard") || lootPreview.items[0]
        : null;
      return sendRoomMessage("claimStagingLoot", "stagingLoot:claim", {
        botId: options.botId || preview.botId || "",
        rewardPreviewId: options.rewardPreviewId || preview.rewardPreviewId || "",
        lootId: options.lootId || defaultLoot?.lootId || "preview:lupenShard"
      });
    },

    requestStagingBounties() {
      return sendRoomMessage("requestStagingBounties", "stagingBounty:list", {});
    },

    acceptStagingBounty(options = {}) {
      return sendRoomMessage("acceptStagingBounty", "stagingBounty:accept", {
        bountyId: String(options.bountyId || "staging_erebus_patrol_2")
      });
    },

    requestStagingBountyStatus() {
      return sendRoomMessage("requestStagingBountyStatus", "stagingBounty:status", {});
    },

    claimStagingBounty(options = {}) {
      const active = connection.lastStagingBountyStatus?.active || connection.lastStagingBountyList?.active || {};
      return sendRoomMessage("claimStagingBounty", "stagingBounty:claim", {
        bountyId: String(options.bountyId || active.id || "staging_erebus_patrol_2")
      });
    },

    requestStagingTradeOffers() {
      return sendRoomMessage("requestStagingTradeOffers", "stagingTrade:listOffers", {});
    },

    requestStagingTradePreview(options = {}) {
      return sendRoomMessage("requestStagingTradePreview", "stagingTrade:preview", {
        offerId: String(options.offerId || ""),
        quantity: Number.isFinite(Number(options.quantity)) ? Math.round(Number(options.quantity)) : options.quantity,
        playerSnapshot: options.playerSnapshot || getStagingTradePlayerSnapshot()
      });
    },

    stagingTradeBuy(options = {}) {
      const snapshot = options.playerSnapshot || getStagingTradePlayerSnapshot();
      return sendRoomMessage("stagingTradeBuy", "stagingTrade:buy", {
        offerId: String(options.offerId || ""),
        quantity: Number.isFinite(Number(options.quantity)) ? Math.round(Number(options.quantity)) : options.quantity,
        currentNode: String(options.currentNode || snapshot?.currentNode || localPresence.currentNode || ""),
        playerSnapshot: snapshot
      });
    },

    stagingTradeSell(options = {}) {
      const snapshot = options.playerSnapshot || getStagingTradePlayerSnapshot();
      return sendRoomMessage("stagingTradeSell", "stagingTrade:sell", {
        offerId: String(options.offerId || ""),
        quantity: Number.isFinite(Number(options.quantity)) ? Math.round(Number(options.quantity)) : options.quantity,
        currentNode: String(options.currentNode || snapshot?.currentNode || localPresence.currentNode || ""),
        playerSnapshot: snapshot
      });
    },

    requestStagingStoreItems() {
      return sendRoomMessage("requestStagingStoreItems", "stagingStore:listItems", {});
    },

    previewStagingStorePurchase(options = {}) {
      return sendRoomMessage("previewStagingStorePurchase", "stagingStore:previewPurchase", {
        itemId: String(options.itemId || ""),
        quantity: Number.isFinite(Number(options.quantity)) ? Math.round(Number(options.quantity)) : options.quantity || 1,
        playerSnapshot: options.playerSnapshot || getStagingStorePlayerSnapshot()
      });
    },

    purchaseStagingStoreItem(options = {}) {
      return sendRoomMessage("purchaseStagingStoreItem", "stagingStore:purchase", {
        itemId: String(options.itemId || ""),
        quantity: Number.isFinite(Number(options.quantity)) ? Math.round(Number(options.quantity)) : options.quantity || 1,
        playerSnapshot: options.playerSnapshot || getStagingStorePlayerSnapshot()
      });
    },

    previewStagingCargoPodEquip(options = {}) {
      return sendRoomMessage("previewStagingCargoPodEquip", "stagingLoadout:previewEquip", {
        itemId: String(options.itemId || "attachment:cargoPod")
      });
    },

    previewStagingLoadoutEquip(options = {}) {
      return sendRoomMessage("previewStagingLoadoutEquip", "stagingLoadout:previewEquip", {
        itemId: String(options.itemId || "")
      });
    },

    equipStagingLoadoutItem(options = {}) {
      return sendRoomMessage("equipStagingLoadoutItem", "stagingLoadout:equipAttachment", {
        itemId: String(options.itemId || "")
      });
    },

    unequipStagingLoadoutItem(options = {}) {
      return sendRoomMessage("unequipStagingLoadoutItem", "stagingLoadout:equipAttachment", {
        itemId: String(options.itemId || ""),
        operation: "unequip"
      });
    },

    equipStagingCargoPod(options = {}) {
      return sendRoomMessage("equipStagingCargoPod", "stagingLoadout:equipAttachment", {
        itemId: String(options.itemId || "attachment:cargoPod")
      });
    },

    unequipStagingCargoPod(options = {}) {
      return sendRoomMessage("unequipStagingCargoPod", "stagingLoadout:equipAttachment", {
        itemId: String(options.itemId || "attachment:cargoPod"),
        operation: "unequip"
      });
    },

    previewStagingShieldBoosterEquip(options = {}) {
      return sendRoomMessage("previewStagingShieldBoosterEquip", "stagingLoadout:previewEquip", {
        itemId: String(options.itemId || "attachment:shieldBooster")
      });
    },

    equipStagingShieldBooster(options = {}) {
      return sendRoomMessage("equipStagingShieldBooster", "stagingLoadout:equipAttachment", {
        itemId: String(options.itemId || "attachment:shieldBooster")
      });
    },

    unequipStagingShieldBooster(options = {}) {
      return sendRoomMessage("unequipStagingShieldBooster", "stagingLoadout:equipAttachment", {
        itemId: String(options.itemId || "attachment:shieldBooster"),
        operation: "unequip"
      });
    },

    previewStagingPulseLaserEquip(options = {}) {
      return sendRoomMessage("previewStagingPulseLaserEquip", "stagingLoadout:previewEquip", {
        itemId: String(options.itemId || "gun:pulseLaser")
      });
    },

    equipStagingPulseLaser(options = {}) {
      return sendRoomMessage("equipStagingPulseLaser", "stagingLoadout:equipAttachment", {
        itemId: String(options.itemId || "gun:pulseLaser")
      });
    },

    unequipStagingPulseLaser(options = {}) {
      return sendRoomMessage("unequipStagingPulseLaser", "stagingLoadout:equipAttachment", {
        itemId: String(options.itemId || "gun:pulseLaser"),
        operation: "unequip"
      });
    },

    previewStagingShipEquip(options = {}) {
      return sendRoomMessage("previewStagingShipEquip", "stagingLoadout:previewEquip", {
        itemId: String(options.itemId || "ship:falcon")
      });
    },

    equipStagingShip(options = {}) {
      return sendRoomMessage("equipStagingShip", "stagingLoadout:equipAttachment", {
        itemId: String(options.itemId || "ship:falcon")
      });
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

    getChatMessages(options = {}) {
      const channel = options.channel ? normalizeChatChannel(options.channel) : "";
      return connection.chatMessages
        .filter((message) => !channel || message.channel === channel || message.type === "system")
        .map((message) => ({ ...message }));
    },

    getPresenceEvents() {
      return connection.presenceEvents.map((event) => ({ ...event }));
    },

    getBots() {
      return Array.from(botsById.values()).map((bot) => ({ ...bot }));
    },

    getBotById(id) {
      const bot = botsById.get(String(id || ""));
      return bot ? { ...bot } : null;
    },

    getResources() {
      return Array.from(resourcesById.values()).map((resource) => ({ ...resource }));
    },

    getResourceById(id) {
      const resource = resourcesById.get(String(id || ""));
      return resource ? { ...resource } : null;
    },

    getSelectedStagingBot() {
      const selectedTargetBotId = playersById.get(connection.sessionId)?.selectedTargetBotId || "";
      const bot = selectedTargetBotId ? botsById.get(selectedTargetBotId) : null;
      return bot ? { ...bot } : null;
    },

    getStagingWeaponIntent() {
      return { ...getStagingWeaponIntent() };
    },

    getBotsInCurrentNode(currentNodeOverride = "") {
      const localPresence = getLocalPresenceOptions();
      const nodeName = currentNodeOverride || localPresence.currentNode || "";
      const nodeKey = normalizeNodeKey(nodeName);
      return Array.from(botsById.values())
        .filter((bot) => normalizeNodeKey(bot.currentNode) === nodeKey)
        .map((bot) => ({ ...bot }));
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
    registerSupabaseAuthReconnect();

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
