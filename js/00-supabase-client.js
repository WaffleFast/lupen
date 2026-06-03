/* Supabase browser client setup */

const LUPEN_SUPABASE_URL = "https://ylzglwiehkypetcdkqxd.supabase.co";
const LUPEN_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_xJbfxDbK4dLWosZDy9qEEQ_kUuFa1Zd";

function getSupabaseClient() {
  if (!window.supabase?.createClient) {
    console.warn("Supabase client library is not loaded.");
    return null;
  }

  if (!LUPEN_SUPABASE_PUBLISHABLE_KEY || LUPEN_SUPABASE_PUBLISHABLE_KEY.startsWith("REPLACE_WITH_")) {
    console.warn("Supabase publishable key is not configured for the live project.");
    return null;
  }

  if (!window.lupenSupabase) {
    window.lupenSupabase = window.supabase.createClient(
      LUPEN_SUPABASE_URL,
      LUPEN_SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
  }

  return window.lupenSupabase;
}
