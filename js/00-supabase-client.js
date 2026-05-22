/* Supabase browser client setup */

const LUPEN_SUPABASE_URL = "https://gxfskpclwnbopzceduff.supabase.co";
const LUPEN_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_yTNhGGaRuft5UlBE7at3aw_O9xxlPZ4";

function getSupabaseClient() {
  if (!window.supabase?.createClient) {
    console.warn("Supabase client library is not loaded.");
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
