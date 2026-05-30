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
    const { error } = await client
      .from("player_saves")
      .upsert({
        user_id: user.id,
        save_data: state,
        updated_at: new Date().toISOString()
      }, { onConflict: "user_id" });

    if (error) throw error;
    return true;
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
