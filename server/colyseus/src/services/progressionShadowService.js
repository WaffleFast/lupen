/* Staging progression shadow adapter.
   This writes, only when explicitly enabled, to a dedicated shadow/audit
   table. It never mutates player_saves, XP, credits, inventory, bounties,
   loot, saves, or real progression. */

function getStringValue(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function getNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

function getNumberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function getLootList(value) {
  return Array.isArray(value)
    ? value.map((item) => getStringValue(item)).filter(Boolean)
    : [];
}

function getNullableString(value) {
  const safeValue = getStringValue(value);
  return safeValue || null;
}

export function isProgressionShadowWriteEnabled(env = process.env) {
  return String(env.ENABLE_STAGING_PROGRESSION_SHADOW_WRITES || "").toLowerCase() === "true";
}

function getSupabaseConfig(env = process.env) {
  return {
    url: getStringValue(env.SUPABASE_URL),
    serviceRoleKey: getStringValue(env.SUPABASE_SERVICE_ROLE_KEY)
  };
}

function getInsertUrl(url) {
  return `${url.replace(/\/$/, "")}/rest/v1/multiplayer_progression_shadow`;
}

export function buildProgressionShadowEntry(applicationPlan = {}, progressionPreview = {}, ledgerResult = {}) {
  const ledgerEntry = ledgerResult?.entry && typeof ledgerResult.entry === "object"
    ? ledgerResult.entry
    : {};
  const metadata = {
    displayName: getStringValue(applicationPlan.displayName, "Pilot"),
    authStatus: getStringValue(applicationPlan.authStatus, "guest"),
    botId: getStringValue(applicationPlan.botId),
    botName: getStringValue(applicationPlan.botName, "Staging Bot"),
    node: getStringValue(applicationPlan.node),
    previewAvailable: progressionPreview?.available === true,
    previewReason: getStringValue(progressionPreview?.reason),
    ledgerSkippedReason: getStringValue(ledgerResult?.skippedReason),
    dryRun: true,
    applied: false
  };

  return {
    player_id: getStringValue(applicationPlan.playerId),
    supabase_user_id: getStringValue(applicationPlan.playerId),
    source_ledger_id: getNullableString(ledgerResult?.ledgerId),
    source_event_id: getStringValue(applicationPlan.sourceEventId || ledgerEntry.source_event_id),
    room_name: getStringValue(ledgerEntry.room_name),
    reward_reason: getStringValue(applicationPlan.reason || ledgerEntry.reward_reason, "staging_bot_disabled"),
    current_xp: getNumberOrNull(progressionPreview?.currentXp),
    preview_xp: getNumberOrNull(progressionPreview?.previewXp),
    xp_delta: Math.max(0, Math.round(getNumberValue(applicationPlan.xpDelta ?? progressionPreview?.xpDelta, 0))),
    current_credits: getNumberOrNull(progressionPreview?.currentCredits),
    preview_credits: getNumberOrNull(progressionPreview?.previewCredits),
    credits_delta: Math.max(0, Math.round(getNumberValue(applicationPlan.creditsDelta ?? progressionPreview?.creditsDelta, 0))),
    current_level: getNumberOrNull(progressionPreview?.currentLevel),
    preview_level: getNumberOrNull(progressionPreview?.currentLevel),
    loot_preview: getLootList(applicationPlan.lootAdditions || progressionPreview?.intendedLootAdditions),
    contribution_percent: Math.max(0, Math.min(100, getNumberValue(applicationPlan.contributionPercent, 0))),
    final_hit: applicationPlan.finalHit === true,
    top_contributor: applicationPlan.topContributor === true,
    applied_to_real_save: false,
    dry_run: true,
    metadata
  };
}

export async function writeProgressionShadowEntry(entry = {}, options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;

  if (!isProgressionShadowWriteEnabled(env)) {
    return {
      ok: true,
      applied: false,
      dryRun: true,
      skippedReason: "progression_shadow_writes_disabled",
      entry
    };
  }

  if (!entry?.player_id || entry?.metadata?.authStatus !== "verified") {
    return {
      ok: false,
      applied: false,
      dryRun: true,
      skippedReason: "progression_shadow_not_eligible",
      entry
    };
  }

  const config = getSupabaseConfig(env);
  if (!config.url || !config.serviceRoleKey) {
    return {
      ok: false,
      applied: false,
      dryRun: true,
      skippedReason: "supabase_config_missing",
      entry
    };
  }

  if (typeof fetchImpl !== "function") {
    return {
      ok: false,
      applied: false,
      dryRun: true,
      skippedReason: "fetch_unavailable",
      entry
    };
  }

  const shadowEntry = {
    ...entry,
    applied_to_real_save: false,
    dry_run: true
  };

  try {
    const response = await fetchImpl(getInsertUrl(config.url), {
      method: "POST",
      headers: {
        apikey: config.serviceRoleKey,
        authorization: `Bearer ${config.serviceRoleKey}`,
        "content-type": "application/json",
        prefer: "return=representation"
      },
      body: JSON.stringify(shadowEntry)
    });

    if (!response?.ok) {
      return {
        ok: false,
        applied: false,
        dryRun: true,
        skippedReason: "progression_shadow_write_failed",
        status: response?.status || 0,
        entry: shadowEntry
      };
    }

    const rows = typeof response.json === "function" ? await response.json() : [];
    const inserted = Array.isArray(rows) ? rows[0] : rows;

    return {
      ok: true,
      applied: false,
      dryRun: true,
      skippedReason: "",
      shadowId: getStringValue(inserted?.id),
      entry: shadowEntry
    };
  } catch (_err) {
    return {
      ok: false,
      applied: false,
      dryRun: true,
      skippedReason: "progression_shadow_write_failed",
      entry: shadowEntry
    };
  }
}

export const ProgressionShadowService = Object.freeze({
  buildProgressionShadowEntry,
  writeProgressionShadowEntry,
  isProgressionShadowWriteEnabled
});
