/* Staging-only material loot write adapter.
   This is deliberately narrower than the normal inventory system: the only
   supported real write is +1 save_data.upgradeMaterials.lupenShards, behind
   explicit staging env gates. It never writes inventoryItems, ownedGuns,
   ownedAttachments, credits, cargo, bounties, route progress, or trade totals. */

const LUPEN_SHARD_LOOT_IDS = new Set(["lupenShard", "preview:lupenShard"]);
const DEFAULT_ALLOWED_ITEMS = ["lupenShard"];
const MAX_DEFAULT_QUANTITY = 1;

function getStringValue(value, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function getIntegerValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function getSupabaseConfig(env = process.env) {
  return {
    url: getStringValue(env.SUPABASE_URL),
    serviceRoleKey: getStringValue(env.SUPABASE_SERVICE_ROLE_KEY)
  };
}

function getValidSupabaseUrl(url) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return "";
    return parsed.toString().replace(/\/$/, "");
  } catch (_err) {
    return "";
  }
}

function getPlayerSaveUrl(url, playerId) {
  const safePlayerId = encodeURIComponent(playerId);
  return `${url.replace(/\/$/, "")}/rest/v1/player_saves?user_id=eq.${safePlayerId}`;
}

function getPlayerSaveReadUrl(url, playerId) {
  return `${getPlayerSaveUrl(url, playerId)}&select=save_data,updated_at&limit=1`;
}

function getCsvValues(value = "") {
  return getStringValue(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function getAllowedItems(env = process.env) {
  const configured = getCsvValues(env.STAGING_LOOT_WRITE_ALLOWED_ITEMS);
  return configured.length ? configured : DEFAULT_ALLOWED_ITEMS;
}

function isTruthyEnv(value) {
  return String(value || "").toLowerCase() === "true";
}

function getCanonicalLootId(lootId = "") {
  const safeLootId = getStringValue(lootId);
  if (LUPEN_SHARD_LOOT_IDS.has(safeLootId)) return "lupenShard";
  return safeLootId;
}

function getAllowlistStatus(playerId, env = process.env) {
  const allowlist = getCsvValues(env.STAGING_LOOT_WRITE_ALLOWLIST);
  const scope = getStringValue(env.STAGING_LOOT_WRITE_SCOPE, "allowlist").toLowerCase() === "verified"
    ? "verified"
    : "allowlist";
  const normalizedPlayerId = getStringValue(playerId);
  const playerInAllowlist = !!normalizedPlayerId && allowlist.includes(normalizedPlayerId);

  return {
    scope,
    verifiedScopeEnabled: scope === "verified",
    allowlistPresent: allowlist.length > 0,
    playerInAllowlist,
    playerAllowed: scope === "verified" ? !!normalizedPlayerId : playerInAllowlist
  };
}

export function getLootWriteEnvGate(env = process.env, playerId = "") {
  const allowedItems = getAllowedItems(env);
  const maxQuantity = Math.max(1, Math.min(1, getIntegerValue(env.STAGING_LOOT_WRITE_MAX_QUANTITY, MAX_DEFAULT_QUANTITY)));
  const allowlist = getAllowlistStatus(playerId, env);

  return {
    writeEnabled: isTruthyEnv(env.STAGING_LOOT_WRITE_ENABLED),
    dryRun: env.STAGING_LOOT_WRITE_DRY_RUN === undefined
      ? true
      : isTruthyEnv(env.STAGING_LOOT_WRITE_DRY_RUN),
    allowedItems,
    maxQuantity,
    ...allowlist
  };
}

function getSaveDataFromRow(row = {}) {
  return row?.save_data && typeof row.save_data === "object" ? row.save_data : null;
}

async function fetchPlayerSaveRow(supabaseUrl, playerId, config, fetchImpl) {
  const response = await fetchImpl(getPlayerSaveReadUrl(supabaseUrl, playerId), {
    method: "GET",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      accept: "application/json"
    }
  });

  if (!response?.ok) {
    return {
      ok: false,
      skippedReason: "player_save_read_failed",
      status: Number(response?.status || 0),
      row: null
    };
  }

  const rows = typeof response.json === "function" ? await response.json() : [];
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (!row) {
    return {
      ok: false,
      skippedReason: "player_save_missing",
      status: response.status || 200,
      row: null
    };
  }

  return {
    ok: true,
    skippedReason: "",
    status: response.status || 200,
    row
  };
}

async function patchPlayerSaveData(supabaseUrl, playerId, saveData, config, fetchImpl) {
  const response = await fetchImpl(getPlayerSaveUrl(supabaseUrl, playerId), {
    method: "PATCH",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "content-type": "application/json",
      prefer: "return=representation"
    },
    body: JSON.stringify({
      save_data: saveData
    })
  });

  if (!response?.ok) {
    return {
      ok: false,
      skippedReason: "player_save_patch_failed",
      status: Number(response?.status || 0)
    };
  }

  return {
    ok: true,
    skippedReason: "",
    status: response.status || 200
  };
}

export function buildStagingLootClaimPlan({
  player = {},
  preview = {},
  lootId = "",
  quantity = 1,
  duplicateDetected = false
} = {}) {
  const playerId = getStringValue(player.trustedPlayerId || player.playerId || player.supabaseUserId);
  const authStatus = getStringValue(player.authStatus || "guest", "guest");
  const rewardPreviewId = getStringValue(preview.rewardPreviewId);
  const botId = getStringValue(preview.botId);
  const canonicalLootId = getCanonicalLootId(lootId);
  const safeQuantity = Math.max(1, Math.min(1, getIntegerValue(quantity, 1)));
  const idempotencyKey = playerId && rewardPreviewId && canonicalLootId
    ? `${playerId}:${rewardPreviewId}:loot:${canonicalLootId}`
    : "";
  const eligible = authStatus === "verified" && !!playerId && canonicalLootId === "lupenShard";
  const skippedReason = !eligible
    ? authStatus === "verified" ? "loot_claim_not_eligible" : `identity_${authStatus || "guest"}`
    : !idempotencyKey
      ? "idempotency_not_ready"
      : duplicateDetected
        ? "duplicate_loot_claim"
        : "";

  return {
    playerId: eligible ? playerId : "",
    displayName: getStringValue(player.displayName || "Pilot", "Pilot"),
    authStatus,
    rewardPreviewId,
    botId,
    lootId: canonicalLootId,
    materialKey: canonicalLootId === "lupenShard" ? "lupenShards" : "",
    quantity: safeQuantity,
    idempotencyKey: eligible ? idempotencyKey : "",
    idempotencyReady: eligible && !!idempotencyKey,
    duplicateDetected,
    eligible: !skippedReason,
    skippedReason,
    applied: false,
    dryRun: true,
    writes: {
      materialWritten: false,
      inventoryWritten: false,
      ownedGunsWritten: false,
      ownedAttachmentsWritten: false,
      cargoWritten: false,
      creditsWritten: false,
      bountyWritten: false,
      saveWritten: false
    }
  };
}

export function buildStagingLootSavePatch(currentSaveData = {}, plan = {}) {
  const saveData = currentSaveData && typeof currentSaveData === "object" ? currentSaveData : {};
  const materials = saveData.upgradeMaterials;
  const currentValue = materials?.lupenShards;

  if (!plan?.eligible || plan?.lootId !== "lupenShard") {
    return {
      ok: false,
      applied: false,
      dryRun: true,
      skippedReason: plan?.skippedReason || "loot_claim_not_eligible",
      materialBefore: null,
      materialAfter: null,
      appliedFields: []
    };
  }

  if (!materials || typeof materials !== "object" || !Number.isFinite(Number(currentValue))) {
    return {
      ok: false,
      applied: false,
      dryRun: true,
      skippedReason: "lupen_shards_path_missing_or_invalid",
      materialBefore: null,
      materialAfter: null,
      appliedFields: []
    };
  }

  const quantity = Math.max(1, Math.min(1, getIntegerValue(plan.quantity, 1)));
  const materialBefore = getIntegerValue(currentValue, 0);
  const materialAfter = materialBefore + quantity;
  const updatedSaveData = cloneJson(saveData);
  updatedSaveData.upgradeMaterials.lupenShards = materialAfter;

  return {
    ok: true,
    applied: false,
    dryRun: true,
    skippedReason: "",
    materialBefore,
    materialAfter,
    quantity,
    materialKey: "upgradeMaterials.lupenShards",
    appliedFields: ["upgradeMaterials.lupenShards"],
    updatedSaveData
  };
}

export async function applyStagingLootClaimWrite(plan = {}, options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const gate = getLootWriteEnvGate(env, plan?.playerId);
  const baseResult = {
    ok: plan?.eligible === true,
    applied: false,
    dryRun: true,
    lootWritesEnabled: gate.writeEnabled,
    lootWriteDryRun: gate.dryRun,
    idempotencyKey: getStringValue(plan?.idempotencyKey),
    idempotencyReady: plan?.idempotencyReady === true,
    duplicateDetected: plan?.duplicateDetected === true,
    gates: gate,
    plan,
    writes: {
      materialWritten: false,
      inventoryWritten: false,
      ownedGunsWritten: false,
      ownedAttachmentsWritten: false,
      cargoWritten: false,
      creditsWritten: false,
      bountyWritten: false,
      saveWritten: false
    }
  };

  if (!plan?.eligible || !plan?.playerId) {
    return {
      ...baseResult,
      ok: false,
      skippedReason: plan?.skippedReason || "loot_claim_not_eligible"
    };
  }

  if (plan.duplicateDetected) {
    return {
      ...baseResult,
      ok: false,
      skippedReason: "duplicate_loot_claim"
    };
  }

  if (!plan.idempotencyReady || !plan.idempotencyKey) {
    return {
      ...baseResult,
      ok: false,
      skippedReason: "idempotency_not_ready"
    };
  }

  if (!gate.allowedItems.includes(plan.lootId)) {
    return {
      ...baseResult,
      ok: false,
      skippedReason: "loot_item_not_allowed"
    };
  }

  if (plan.quantity > gate.maxQuantity) {
    return {
      ...baseResult,
      ok: false,
      skippedReason: "loot_quantity_exceeds_staging_limit"
    };
  }

  if (!gate.writeEnabled) {
    return {
      ...baseResult,
      skippedReason: "loot_writes_disabled"
    };
  }

  if (gate.dryRun) {
    return {
      ...baseResult,
      skippedReason: "loot_write_dry_run"
    };
  }

  if (gate.scope !== "verified" && !gate.allowlistPresent) {
    return {
      ...baseResult,
      ok: false,
      skippedReason: "staging_loot_write_allowlist_missing"
    };
  }

  if (!gate.playerAllowed) {
    return {
      ...baseResult,
      ok: false,
      skippedReason: gate.scope === "verified"
        ? "verified_player_missing"
        : "player_not_in_staging_loot_write_allowlist"
    };
  }

  const config = getSupabaseConfig(env);
  if (!config.url || !config.serviceRoleKey) {
    return {
      ...baseResult,
      ok: false,
      skippedReason: "supabase_config_missing"
    };
  }

  if (typeof fetchImpl !== "function") {
    return {
      ...baseResult,
      ok: false,
      skippedReason: "fetch_unavailable"
    };
  }

  const supabaseUrl = getValidSupabaseUrl(config.url);
  if (!supabaseUrl) {
    return {
      ...baseResult,
      ok: false,
      skippedReason: "invalid_supabase_url"
    };
  }

  try {
    const saveRead = await fetchPlayerSaveRow(supabaseUrl, plan.playerId, config, fetchImpl);
    if (!saveRead.ok) {
      return {
        ...baseResult,
        ok: false,
        skippedReason: saveRead.skippedReason,
        status: saveRead.status
      };
    }

    const saveData = getSaveDataFromRow(saveRead.row);
    if (!saveData) {
      return {
        ...baseResult,
        ok: false,
        skippedReason: "save_data_missing_or_invalid",
        status: saveRead.status
      };
    }

    const patchPlan = buildStagingLootSavePatch(saveData, plan);
    if (!patchPlan.ok) {
      return {
        ...baseResult,
        ok: false,
        skippedReason: patchPlan.skippedReason,
        patchPlan,
        status: saveRead.status
      };
    }

    const patchResult = await patchPlayerSaveData(supabaseUrl, plan.playerId, patchPlan.updatedSaveData, config, fetchImpl);
    if (!patchResult.ok) {
      return {
        ...baseResult,
        ok: false,
        skippedReason: patchResult.skippedReason,
        patchPlan,
        status: patchResult.status
      };
    }

    return {
      ...baseResult,
      ok: true,
      applied: true,
      dryRun: false,
      skippedReason: "",
      status: patchResult.status,
      materialBefore: patchPlan.materialBefore,
      materialAfter: patchPlan.materialAfter,
      quantity: patchPlan.quantity,
      materialKey: patchPlan.materialKey,
      appliedFields: patchPlan.appliedFields,
      patchPlan: {
        ...patchPlan,
        updatedSaveData: undefined
      },
      writes: {
        ...baseResult.writes,
        materialWritten: true,
        saveWritten: true
      }
    };
  } catch (_err) {
    return {
      ...baseResult,
      ok: false,
      skippedReason: "loot_write_failed",
      status: 0
    };
  }
}

export const LootWriteService = Object.freeze({
  getLootWriteEnvGate,
  buildStagingLootClaimPlan,
  buildStagingLootSavePatch,
  applyStagingLootClaimWrite
});
