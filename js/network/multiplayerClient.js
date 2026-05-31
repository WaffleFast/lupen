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
    lastShotEvent: null,
    lastRewardPreview: null,
    lastRewardClaimResult: null,
    lastError: null
  };
  const identity = {
    authStatus: "guest",
    playerIdPresent: false,
    displayName: "",
    lastCheckedAt: 0
  };

  let colyseusClient = null;
  let room = null;
  let clientScriptPromise = null;
  const playersById = new Map();
  const botsById = new Map();

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
      lastShotEvent: connection.lastShotEvent ? { ...connection.lastShotEvent } : null,
      lastRewardPreview: connection.lastRewardPreview ? { ...connection.lastRewardPreview } : null,
      lastRewardClaimResult: connection.lastRewardClaimResult ? { ...connection.lastRewardClaimResult } : null,
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
      const supabaseClient = typeof global.getSupabaseClient === "function" ? global.getSupabaseClient() : global.lupenSupabase;
      const sessionResponse = supabaseClient?.auth?.getSession ? await supabaseClient.auth.getSession() : null;
      const session = sessionResponse?.data?.session || null;
      const user = session?.user || null;

      if (user?.id) {
        identityOptions.authStatus = "authenticated";
        identityOptions.playerId = String(user.id);
        identityOptions.supabaseUserId = String(user.id);
        identityOptions.displayName = String(account.pilot_name || account.username || user.user_metadata?.pilot_name || fallbackDisplayName).slice(0, 80);
        identityOptions.supabaseAccessToken = String(session.access_token || "");
      }
    } catch (err) {
      logDev("Supabase staging identity unavailable; connecting as guest", err);
    }

    identity.authStatus = identityOptions.authStatus;
    identity.playerIdPresent = !!identityOptions.playerId;
    identity.displayName = identityOptions.displayName || fallbackDisplayName;
    identity.lastCheckedAt = Date.now();

    return identityOptions;
  }

  function getStagingWeaponIntent() {
    try {
      if (typeof global.getEquippedWeapon !== "function") {
        return {
          weaponId: "stagingFallback",
          weaponName: "Staging Fallback",
          weaponFamily: "staging-fallback",
          damage: 5,
          fireRate: 1,
          cooldownMs: 900
        };
      }

      const weapon = global.getEquippedWeapon() || {};
      return {
        weaponId: String(weapon.id || weapon.key || weapon.familyId || weapon.fireStyle || "equippedWeapon"),
        weaponName: String(weapon.name || "Equipped Weapon").slice(0, 80),
        weaponFamily: String(weapon.familyId || weapon.family || weapon.fireStyle || weapon.type || ""),
        weaponType: String(weapon.type || weapon.fireStyle || ""),
        damage: Number.isFinite(Number(weapon.damage)) ? Number(weapon.damage) : 5,
        damageLayers: weapon.damageLayers && typeof weapon.damageLayers === "object"
          ? {
            shield: Number.isFinite(Number(weapon.damageLayers.shield)) ? Number(weapon.damageLayers.shield) : 0,
            armor: Number.isFinite(Number(weapon.damageLayers.armor)) ? Number(weapon.damageLayers.armor) : 0,
            hull: Number.isFinite(Number(weapon.damageLayers.hull)) ? Number(weapon.damageLayers.hull) : 0
          }
          : undefined,
        fireRate: Number.isFinite(Number(weapon.fireRate)) ? Number(weapon.fireRate) : 1,
        cooldownMs: Number.isFinite(Number(weapon.speed)) ? Number(weapon.speed) : 900,
        quality: String(weapon.quality || ""),
        level: Number.isFinite(Number(weapon.level)) ? Number(weapon.level) : 0,
        count: Number.isFinite(Number(weapon.count)) ? Number(weapon.count) : 0
      };
    } catch (err) {
      logDev("staging weapon payload fallback", err);
      return {
        weaponId: "stagingFallback",
        weaponName: "Staging Fallback",
        weaponFamily: "staging-fallback",
        damage: 5,
        fireRate: 1,
        cooldownMs: 900
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

  function normalizeNodeKey(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ");
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
      currentShipId: String(player.currentShipId || ""),
      shipName: String(player.shipName || player.ship || ""),
      shipImage: String(player.shipImage || player.shipImageSrc || player.shipImagePath || ""),
      shipImageSrc: String(player.shipImageSrc || player.shipImage || player.shipImagePath || ""),
      shipImagePath: String(player.shipImagePath || player.shipImage || player.shipImageSrc || ""),
      shipClass: String(player.shipClass || ""),
      selectedTargetBotId: String(player.selectedTargetBotId || ""),
      x: Number.isFinite(Number(player.x)) ? Number(player.x) : 50,
      y: Number.isFinite(Number(player.y)) ? Number(player.y) : 50,
      currentNode: String(player.currentNode || "Asteron Prime"),
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
        if (snapshot) playersById.set(snapshot.id, snapshot);
      });
      return;
    }

    Object.entries(players).forEach(([key, player]) => {
      const snapshot = normalizePlayer(player, key);
      if (snapshot) playersById.set(snapshot.id, snapshot);
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

  function bindRoomEvents(activeRoom) {
    activeRoom.onStateChange((serverState) => {
      updatePlayersFromServerState(serverState);
      updateBotsFromServerState(serverState);
      notifyServerState(serverState);
    });

    activeRoom.onMessage("pong", (message) => {
      logDev("received pong", message);
    });

    activeRoom.onMessage("presence:warning", (message) => {
      connection.lastServerWarning = message?.reason || "presence warning";
      logDev("server presence warning", message);
    });

    activeRoom.onMessage("combat:rejected", (message) => {
      connection.lastCombatResponse = {
        ok: message?.ok === true,
        reason: String(message?.reason || "combat_intent_rejected"),
        validation: String(message?.validation || ""),
        targetBotId: String(message?.targetBotId || ""),
        targetNode: String(message?.targetNode || ""),
        weaponName: String(message?.weaponName || ""),
        cooldownRemainingMs: Number.isFinite(Number(message?.cooldownRemainingMs)) ? Number(message.cooldownRemainingMs) : 0,
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
    });

    activeRoom.onMessage("bot:disabled", (message) => {
      connection.lastBotEvent = {
        type: "bot:disabled",
        botId: String(message?.botId || ""),
        currentNode: String(message?.currentNode || ""),
        shield: Number.isFinite(Number(message?.shield)) ? Number(message.shield) : 0,
        hull: Number.isFinite(Number(message?.hull)) ? Number(message.hull) : 0,
        disabledUntil: Number.isFinite(Number(message?.disabledUntil)) ? Number(message.disabledUntil) : 0,
        rewardsGranted: message?.rewardsGranted === true,
        receivedAt: Number.isFinite(Number(message?.receivedAt)) ? Number(message.receivedAt) : Date.now()
      };
      logDev("server bot disabled", message);
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
      connection.lastShotEvent = {
        ok: message?.ok === true,
        attackerSessionId: String(message?.attackerSessionId || ""),
        targetBotId: String(message?.targetBotId || ""),
        currentNode: String(message?.currentNode || ""),
        damage: Number.isFinite(Number(message?.damage)) ? Number(message.damage) : 0,
        weaponName: String(message?.weaponName || ""),
        weaponFamily: String(message?.weaponFamily || message?.weaponType || ""),
        shield: Number.isFinite(Number(message?.shield)) ? Number(message.shield) : 0,
        hull: Number.isFinite(Number(message?.hull)) ? Number(message.hull) : 0,
        disabled: message?.disabled === true,
        rewardsGranted: message?.rewardsGranted === true,
        timestamp: Number.isFinite(Number(message?.timestamp)) ? Number(message.timestamp) : Date.now(),
        receivedAt: Number.isFinite(Number(message?.receivedAt)) ? Number(message.receivedAt) : Date.now()
      };
      logDev("server staging shot", message);
      notifyServerState(activeRoom.state || null);
    });

    activeRoom.onMessage("staging:reward_preview", (message) => {
      const contributors = Array.isArray(message?.contributors)
        ? message.contributors.map(normalizeRewardContributor).filter(Boolean)
        : [];
      connection.lastRewardPreview = {
        ok: message?.ok === true,
        rewardPreviewId: String(message?.rewardPreviewId || ""),
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
        applied: message?.applied === true,
        dryRun: message?.dryRun === true,
        reason: String(message?.reason || "staging_preview_only"),
        receivedAt: Number.isFinite(Number(message?.receivedAt)) ? Number(message.receivedAt) : Date.now()
      };
      logDev("server staging reward preview", message);
      notifyServerState(activeRoom.state || null);
    });

    activeRoom.onMessage("reward:claim_preview_result", (message) => {
      const contributors = Array.isArray(message?.contributors)
        ? message.contributors.map(normalizeRewardContributor).filter(Boolean)
        : [];
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
        applied: message?.applied === true,
        dryRun: message?.dryRun === true,
        rewardWritePlan: normalizeRewardWritePlan(message?.rewardWritePlan),
        rewardLedgerResult: normalizeRewardLedgerResult(message?.rewardLedgerResult),
        rewardApplicationPlan: normalizeRewardApplicationPlan(message?.rewardApplicationPlan),
        rewardApplicationResult: normalizeRewardApplicationResult(message?.rewardApplicationResult),
        progressionPreview: normalizeProgressionPreview(message?.progressionPreview),
        progressionShadowResult: normalizeProgressionShadowResult(message?.progressionShadowResult),
        playerSavePatchPlan: normalizePlayerSavePatchPlan(message?.playerSavePatchPlan),
        playerSavePatchResult: normalizePlayerSavePatchResult(message?.playerSavePatchResult),
        claimSimulated: message?.claimSimulated === true,
        reason: String(message?.reason || "staging_preview_only"),
        receivedAt: Number.isFinite(Number(message?.receivedAt)) ? Number(message.receivedAt) : Date.now()
      };
      logDev("server staging reward claim preview result", message);
      notifyServerState(activeRoom.state || null);
    });

    activeRoom.onMessage("target:selected", (message) => {
      connection.lastTargetResponse = {
        ok: message?.ok === true,
        reason: String(message?.reason || "target_selected"),
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

    return {
      enabled: connection.enabled,
      isConnected: connection.isConnected,
      connected: connection.isConnected,
      isConnecting: connection.isConnecting,
      roomName: connection.roomName,
      sessionId: connection.sessionId,
      currentNode: localPresence.currentNode || "",
      clientLoadSource: connection.clientLoadSource,
      clientLoadError: connection.clientLoadError,
      lastError: connection.lastError,
      lastServerWarning: connection.lastServerWarning,
      lastCombatResponse: connection.lastCombatResponse ? { ...connection.lastCombatResponse } : null,
      lastTargetResponse: connection.lastTargetResponse ? { ...connection.lastTargetResponse } : null,
      lastBotEvent: connection.lastBotEvent ? { ...connection.lastBotEvent } : null,
      lastShotEvent: connection.lastShotEvent ? { ...connection.lastShotEvent } : null,
      lastRewardPreview: connection.lastRewardPreview ? { ...connection.lastRewardPreview } : null,
      lastRewardClaimResult: connection.lastRewardClaimResult ? { ...connection.lastRewardClaimResult } : null,
      listenerCount: stateListeners.size,
      playerCount: playersById.size,
      botCount: botsById.size,
      lastBotUpdateAt,
      selectedTargetBotId: playersById.get(connection.sessionId)?.selectedTargetBotId || "",
      nextFireAt: playersById.get(connection.sessionId)?.nextFireAt || 0,
      fireCooldownRemainingMs: Math.max(0, Math.ceil((playersById.get(connection.sessionId)?.nextFireAt || 0) - Date.now())),
      authStatus: selfPlayer?.authStatus || identity.authStatus,
      playerIdPresent: !!(selfPlayer?.trustedPlayerId || selfPlayer?.playerId || identity.playerIdPresent),
      trustedPlayerIdPresent: !!selfPlayer?.trustedPlayerId,
      displayName: selfPlayer?.displayName || identity.displayName || localPresence.displayName || "Pilot",
      localShipId: localPresence.currentShipId || "",
      localShipImage: localPresence.shipImage || localPresence.shipImageSrc || localPresence.shipImagePath || "",
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
        colyseusClient = new Colyseus.Client(serverUrl);
        room = await colyseusClient.joinOrCreate(connection.roomName, {
          ...localPresence,
          ...identityOptions,
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
        return statusResult("disconnect", true, { alreadyDisconnected: true });
      }

      logDev(`disconnecting from ${connection.roomName}`);
      room.leave();
      connection.isConnected = false;
      connection.isConnecting = false;
      connection.sessionId = null;
      room = null;
      colyseusClient = null;
      botsById.clear();
      return statusResult("disconnect");
    },

    sendPlayerIntent(intent = {}) {
      return sendRoomMessage("sendPlayerIntent", "presence:update", intent);
    },

    sendMovementIntent(intent = {}) {
      return sendRoomMessage("sendMovementIntent", "movement:update", intent);
    },

    sendCombatIntent(intent = {}) {
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

    claimStagingRewardPreview(options = {}) {
      const preview = connection.lastRewardPreview || {};
      return sendRoomMessage("claimStagingRewardPreview", "reward:claim_preview", {
        botId: options.botId || preview.botId || "",
        rewardPreviewId: options.rewardPreviewId || preview.rewardPreviewId || ""
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

    getBots() {
      return Array.from(botsById.values()).map((bot) => ({ ...bot }));
    },

    getBotById(id) {
      const bot = botsById.get(String(id || ""));
      return bot ? { ...bot } : null;
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
