/* Persistence helpers.
   This service keeps local/cloud save operations separate from gameplay state so
   future multiplayer/server-authoritative systems can choose their own state source. */

(function registerSaveService(global) {
  "use strict";

  function readLocalStorage(key) {
    return global.localStorage.getItem(key);
  }

  function writeLocalStorage(key, value) {
    global.localStorage.setItem(key, value);
  }

  function removeLocalStorage(key) {
    global.localStorage.removeItem(key);
  }

  function readJsonLocalStorage(key, fallback = null) {
    const raw = readLocalStorage(key);
    if (!raw) return fallback;

    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn(`Ignoring corrupted localStorage entry: ${key}`, error);
      writeLocalStorage(`${key}.corrupt.${Date.now()}`, raw);
      removeLocalStorage(key);
      return fallback;
    }
  }

  function writeJsonLocalStorage(key, value) {
    writeLocalStorage(key, JSON.stringify(value));
  }

  async function getAuthenticatedSupabaseUser(getClient) {
    const client = typeof getClient === "function" ? getClient() : null;
    if (!client) return null;

    const { data, error } = await client.auth.getUser();
    if (error) {
      console.warn("Unable to read Supabase user for save sync.", error);
      return null;
    }

    return data?.user ? { client, user: data.user } : null;
  }

  async function saveGameStateToSupabaseForUser(client, user, state) {
    const saveData = await preserveCloudCombatXpForSave(client, user, state);
    const { error } = await client
      .from("player_saves")
      .upsert({
        user_id: user.id,
        save_data: saveData,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });

    if (error) throw error;
    return true;
  }

  function getCombatXp(saveData) {
    return Math.max(0, Math.round(Number(saveData?.playerProgress?.combatXp || 0)));
  }

  function getZoneCombatXp(saveData, zoneKey = "sector-one") {
    return Math.max(0, Math.round(Number(saveData?.playerProgress?.zoneCombatXp?.[zoneKey] || 0)));
  }

  function setCombatXpFloor(saveData, combatXp, zoneKey = "sector-one") {
    const next = {
      ...saveData,
      playerProgress: {
        ...(saveData?.playerProgress || {})
      }
    };
    const zoneCombatXp = {
      ...(next.playerProgress.zoneCombatXp || {})
    };
    const safeCombatXp = Math.max(getCombatXp(next), Math.round(Number(combatXp || 0)));
    const safeZoneXp = Math.max(getZoneCombatXp(next, zoneKey), Math.round(Number(combatXp || 0)));
    next.playerProgress.combatXp = safeCombatXp;
    zoneCombatXp[zoneKey] = safeZoneXp;
    next.playerProgress.zoneCombatXp = zoneCombatXp;
    return next;
  }

  async function preserveCloudCombatXpForSave(client, user, state) {
    try {
      const { data, error } = await client
        .from("player_saves")
        .select("save_data")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error || !data?.save_data) return state;

      const cloudXp = Math.max(
        getCombatXp(data.save_data),
        getZoneCombatXp(data.save_data)
      );
      const localXp = Math.max(
        getCombatXp(state),
        getZoneCombatXp(state)
      );
      return cloudXp > localXp ? setCombatXpFloor(state, cloudXp) : state;
    } catch (error) {
      console.warn("Unable to compare cloud XP before save sync.", error);
      return state;
    }
  }

  async function loadGameStateFromSupabaseForUser(client, user) {
    const { data, error } = await client
      .from("player_saves")
      .select("save_data")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;
    return data?.save_data || null;
  }

  global.LupenSaveService = Object.freeze({
    readLocalStorage,
    writeLocalStorage,
    removeLocalStorage,
    readJsonLocalStorage,
    writeJsonLocalStorage,
    getAuthenticatedSupabaseUser,
    saveGameStateToSupabaseForUser,
    loadGameStateFromSupabaseForUser
  });
})(window);
