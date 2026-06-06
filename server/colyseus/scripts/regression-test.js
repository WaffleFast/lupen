import { Client } from "colyseus.js";
import { ROOM_NAME } from "../src/app.config.js";
import {
  STAGING_BOT_ALLOWED_NODE_IDS,
  buildRewardClaimStatus,
  buildRewardWritePlan,
  verifySupabaseAccessToken
} from "../src/rooms/LupenSectorRoom.js";
import {
  buildStagingTradePreview,
  buildStagingTradeWriteDryRun,
  getStagingTradeOffers
} from "../src/config/stagingTradeConfig.js";
import {
  buildStagingStorePurchasePreview,
  getStagingStoreItems
} from "../src/config/stagingStoreConfig.js";
import {
  STAGING_BOUNTY_ID,
  buildStagingBountySourceEventId,
  createStagingBountyState,
  getPublicStagingBountyState,
  getStagingBounties,
  recordStagingBountyBotDestruction
} from "../src/config/stagingBountyConfig.js";
import {
  buildStagingLootPreview
} from "../src/config/stagingLootConfig.js";
import {
  buildRewardLedgerEntry,
  checkRewardLedgerConnectivity,
  writeRewardLedgerEntry
} from "../src/services/rewardLedgerService.js";
import {
  applyRewardApplicationPlan,
  buildRewardApplicationPlan
} from "../src/services/rewardApplicationService.js";
import {
  buildProgressionPreview,
  fetchPlayerSavePreviewContext
} from "../src/services/playerSavePreviewService.js";
import {
  buildProgressionShadowEntry,
  checkProgressionShadowConnectivity,
  writeProgressionShadowEntry
} from "../src/services/progressionShadowService.js";
import {
  applyPlayerSavePatchPlan,
  buildPlayerSavePatchPlan
} from "../src/services/playerSaveWriteService.js";
import {
  applyStagingLootClaimWrite,
  buildStagingLootClaimPlan,
  buildStagingLootSavePatch,
  getLootWriteEnvGate
} from "../src/services/lootWriteService.js";
import {
  extractTradeValidationStateFromSave,
  fetchPlayerTradeValidationState
} from "../src/services/playerSaveReadService.js";
import {
  applyStagingTradeBuyWrite,
  applyStagingTradeSellWrite,
  buildStagingTradeBuySavePatch,
  buildStagingTradeSellSavePatch
} from "../src/services/tradeWriteService.js";
import {
  applyStagingStorePurchaseWrite,
  buildStagingStorePurchasePatch,
  getStoreWriteEnvGate
} from "../src/services/storeWriteService.js";
import {
  applyStagingCargoPodEquipWrite,
  applyStagingLoadoutEquipWrite,
  buildStagingCargoPodEquipPlan,
  buildStagingShieldBoosterEquipPlan,
  buildStagingPulseLaserEquipPlan,
  buildStagingLupenHaulerSelectPlan,
  buildStagingLoadoutUnequipPlan,
  getLoadoutWriteEnvGate
} from "../src/services/loadoutWriteService.js";

const endpoint = process.env.COLYSEUS_ENDPOINT || "ws://localhost:2567";
const clientA = new Client(endpoint);
const clientB = new Client(endpoint);
const clientC = new Client(endpoint);

let roomA = null;
let roomB = null;
let roomC = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function waitFor(description, predicate, timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      try {
        if (predicate()) {
          clearInterval(timer);
          resolve();
          return;
        }
      } catch (err) {
        clearInterval(timer);
        reject(err);
        return;
      }

      if (Date.now() - startedAt > timeoutMs) {
        clearInterval(timer);
        reject(new Error(`Timed out waiting for ${description}.`));
      }
    }, 100);
  });
}

function playerFrom(room, sessionId) {
  return room?.state?.players?.get?.(sessionId) || null;
}

function botCount(room) {
  return room?.state?.bots?.size || 0;
}

function botSnapshots(room) {
  return Array.from(room?.state?.bots?.values?.() || [])
    .map((bot) => ({
      id: bot.id,
      name: bot.name,
      type: bot.type,
      faction: bot.faction,
      currentNode: bot.currentNode,
      x: bot.x,
      y: bot.y,
      level: bot.level,
      shield: bot.shield,
      shieldMax: bot.shieldMax,
      hull: bot.hull,
      hullMax: bot.hullMax,
      disabled: bot.disabled,
      disabledUntil: bot.disabledUntil,
      visualOnly: bot.visualOnly,
      lastUpdatedAt: bot.lastUpdatedAt,
      nextMoveAt: bot.nextMoveAt
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function botById(room, botId) {
  return botSnapshots(room).find((bot) => bot.id === botId) || null;
}

function botHealthTotal(bot) {
  return Number(bot?.shield || 0) + Number(bot?.hull || 0);
}

function botSnapshotKey(room) {
  return botSnapshots(room)
    .map((bot) => `${bot.id}:${bot.currentNode}:${bot.x}:${bot.y}:${bot.lastUpdatedAt}`)
    .join("|");
}

function latestBotUpdateAt(room) {
  return botSnapshots(room).reduce((latest, bot) => Math.max(latest, Number(bot.lastUpdatedAt || 0)), 0);
}

function assertAllowedBotNodes(room) {
  const allowedNodes = new Set(STAGING_BOT_ALLOWED_NODE_IDS);
  const invalidBot = botSnapshots(room).find((bot) => !allowedNodes.has(bot.currentNode));
  assert(!invalidBot, `Bot ${invalidBot?.id} is on invalid staging node ${invalidBot?.currentNode}.`);
}

function assertBotDisplayFields(room) {
  botSnapshots(room).forEach((bot) => {
    assert(bot.id, "Bot is missing a stable id.");
    assert(bot.name, `Bot ${bot.id} is missing name.`);
    assert(bot.type, `Bot ${bot.id} is missing type.`);
    assert(bot.faction === "Erebus", `Bot ${bot.id} has unexpected faction ${bot.faction}.`);
    assert(Number(bot.level) > 0, `Bot ${bot.id} is missing level.`);
    assert(Number(bot.shieldMax) >= Number(bot.shield), `Bot ${bot.id} has invalid shield values.`);
    assert(Number(bot.hullMax) >= Number(bot.hull), `Bot ${bot.id} has invalid hull values.`);
    assert(bot.disabled === true || bot.disabled === false, `Bot ${bot.id} is missing disabled state.`);
    assert(bot.visualOnly === true, `Bot ${bot.id} must remain visualOnly.`);
  });
}

function playerCount(room) {
  return room?.state?.players?.size || 0;
}

async function expectPresenceWarning(room, sendMessage) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for presence warning."));
    }, 3000);

    room.onMessage("presence:warning", (message) => {
      clearTimeout(timeout);
      resolve(message);
    });

    sendMessage();
  });
}

async function expectCombatRejected(room, sendMessage) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for combat rejection."));
    }, 3000);

    room.onMessage("combat:rejected", (message) => {
      clearTimeout(timeout);
      resolve(message);
    });

    sendMessage();
  });
}

async function expectCombatResolved(room, sendMessage) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for combat resolution."));
    }, 3000);

    room.onMessage("combat:resolved", (message) => {
      clearTimeout(timeout);
      resolve(message);
    });

    sendMessage();
  });
}

async function expectTargetSelected(room, sendMessage) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for target selection response."));
    }, 3000);

    room.onMessage("target:selected", (message) => {
      clearTimeout(timeout);
      resolve(message);
    });

    sendMessage();
  });
}

async function expectTargetRejected(room, sendMessage) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for target rejection."));
    }, 3000);

    room.onMessage("target:rejected", (message) => {
      clearTimeout(timeout);
      resolve(message);
    });

    sendMessage();
  });
}

async function expectRewardClaimResult(room, sendMessage) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for reward preview claim result."));
    }, 3000);

    room.onMessage("reward:claim_preview_result", (message) => {
      clearTimeout(timeout);
      resolve(message);
    });

    sendMessage();
  });
}

async function expectRoomMessage(room, messageType, sendMessage, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for ${messageType}.`));
    }, timeoutMs);

    room.onMessage(messageType, (message) => {
      clearTimeout(timeout);
      resolve(message);
    });

    sendMessage();
  });
}

async function expectStagingTradeOffers(room, sendMessage) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for staging trade offers."));
    }, 3000);

    room.onMessage("stagingTrade:offers", (message) => {
      clearTimeout(timeout);
      resolve(message);
    });

    sendMessage();
  });
}

async function expectStagingTradePreview(room, sendMessage) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for staging trade preview."));
    }, 3000);

    room.onMessage("stagingTrade:previewResult", (message) => {
      clearTimeout(timeout);
      resolve(message);
    });

    sendMessage();
  });
}

async function expectStagingTradeWriteResult(room, operation, sendMessage) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for staging trade ${operation} result.`));
    }, 3000);

    room.onMessage(`stagingTrade:${operation}Result`, (message) => {
      clearTimeout(timeout);
      resolve(message);
    });

    sendMessage();
  });
}

async function expectStagingStoreItems(room, sendMessage) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for staging Store items."));
    }, 3000);

    room.onMessage("stagingStore:items", (message) => {
      clearTimeout(timeout);
      resolve(message);
    });

    sendMessage();
  });
}

async function expectStagingStorePreview(room, sendMessage) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for staging Store preview."));
    }, 3000);

    room.onMessage("stagingStore:previewResult", (message) => {
      clearTimeout(timeout);
      resolve(message);
    });

    sendMessage();
  });
}

async function expectStagingStorePurchase(room, sendMessage) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Timed out waiting for staging Store purchase."));
    }, 3000);

    room.onMessage("stagingStore:purchaseResult", (message) => {
      clearTimeout(timeout);
      resolve(message);
    });

    sendMessage();
  });
}

async function expectStagingLoadoutResult(room, type, sendMessage) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Timed out waiting for staging loadout ${type}.`));
    }, 3000);

    room.onMessage(`stagingLoadout:${type}`, (message) => {
      clearTimeout(timeout);
      resolve(message);
    });

    sendMessage();
  });
}

async function assertStagingLootWriteHelpers() {
  const defaultGate = getLootWriteEnvGate({}, "verified-player-a");
  assert(defaultGate.writeEnabled === false, "Loot writes were enabled by default.");
  assert(defaultGate.dryRun === true, "Loot writes were not dry-run by default.");
  assert(defaultGate.allowedItems.includes("lupenShard"), "Default loot allow-list did not include Lupen Shard.");

  const preview = {
    rewardPreviewId: "bot-a:reward-1",
    botId: "bot-a"
  };
  const verifiedPlayer = {
    authStatus: "verified",
    trustedPlayerId: "verified-player-a",
    displayName: "Verified Pilot"
  };
  const basePlan = buildStagingLootClaimPlan({
    player: verifiedPlayer,
    preview,
    lootId: "preview:lupenShard",
    quantity: 1
  });
  assert(basePlan.eligible === true, `Verified Lupen Shard plan was not eligible: ${basePlan.skippedReason}`);
  assert(basePlan.lootId === "lupenShard", "Lupen Shard loot id was not canonicalized.");
  assert(basePlan.materialKey === "lupenShards", "Lupen Shard material key was not selected.");
  assert(basePlan.idempotencyKey === "verified-player-a:bot-a:reward-1:loot:lupenShard", "Loot idempotency key was not stable.");

  const duplicatePlan = buildStagingLootClaimPlan({
    player: verifiedPlayer,
    preview,
    lootId: "preview:lupenShard",
    duplicateDetected: true
  });
  assert(duplicatePlan.eligible === false, "Duplicate loot plan was not blocked.");
  assert(duplicatePlan.skippedReason === "duplicate_loot_claim", `Unexpected duplicate loot reason: ${duplicatePlan.skippedReason}`);

  const unknownLootPlan = buildStagingLootClaimPlan({
    player: verifiedPlayer,
    preview,
    lootId: "preview:pulseLaser"
  });
  assert(unknownLootPlan.eligible === false, "Unsupported loot item was eligible.");
  assert(unknownLootPlan.skippedReason === "loot_claim_not_eligible", `Unexpected unsupported loot reason: ${unknownLootPlan.skippedReason}`);

  const guestPlan = buildStagingLootClaimPlan({
    player: {
      authStatus: "guest",
      displayName: "Guest Pilot"
    },
    preview,
    lootId: "preview:lupenShard"
  });
  assert(guestPlan.eligible === false, "Guest loot claim was eligible.");
  assert(guestPlan.skippedReason === "identity_guest", `Unexpected guest loot reason: ${guestPlan.skippedReason}`);

  const saveData = {
    credits: 500,
    upgradeMaterials: {
      lupenShards: 2,
      circuitBoards: 7
    },
    inventoryItems: [{ id: "item-1", key: "lupenCore", quality: "standard", level: 1 }],
    ownedGuns: {
      pulseLaser: {
        owned: true
      }
    },
    playerProgress: {
      combatXp: 100
    }
  };
  const patchPlan = buildStagingLootSavePatch(saveData, basePlan);
  assert(patchPlan.ok === true, `Valid Lupen Shard save patch failed: ${patchPlan.skippedReason}`);
  assert(patchPlan.materialBefore === 2 && patchPlan.materialAfter === 3, "Lupen Shard material delta was incorrect.");
  assert(patchPlan.updatedSaveData.upgradeMaterials.lupenShards === 3, "Updated save data did not patch Lupen Shards.");
  assert(patchPlan.updatedSaveData.inventoryItems.length === 1, "Loot patch changed inventoryItems.");
  assert(patchPlan.updatedSaveData.ownedGuns.pulseLaser.owned === true, "Loot patch changed ownedGuns.");
  assert(patchPlan.updatedSaveData.credits === 500, "Loot patch changed credits.");
  assert(patchPlan.updatedSaveData.playerProgress.combatXp === 100, "Loot patch changed XP.");

  const invalidSavePatch = buildStagingLootSavePatch({ upgradeMaterials: {} }, basePlan);
  assert(invalidSavePatch.ok === false, "Invalid material path unexpectedly patched.");
  assert(invalidSavePatch.skippedReason === "lupen_shards_path_missing_or_invalid", `Unexpected invalid material path reason: ${invalidSavePatch.skippedReason}`);

  const disabledResult = await applyStagingLootClaimWrite(basePlan, {
    env: {},
    fetchImpl: async () => {
      throw new Error("fetch should not run when loot writes are disabled");
    }
  });
  assert(disabledResult.applied === false, "Disabled loot write applied.");
  assert(disabledResult.skippedReason === "loot_writes_disabled", `Unexpected disabled loot reason: ${disabledResult.skippedReason}`);
  assert(disabledResult.writes.saveWritten === false, "Disabled loot write reported save write.");

  const dryRunResult = await applyStagingLootClaimWrite(basePlan, {
    env: {
      STAGING_LOOT_WRITE_ENABLED: "true",
      STAGING_LOOT_WRITE_DRY_RUN: "true",
      STAGING_LOOT_WRITE_SCOPE: "verified"
    },
    fetchImpl: async () => {
      throw new Error("fetch should not run during loot dry-run");
    }
  });
  assert(dryRunResult.applied === false, "Dry-run loot write applied.");
  assert(dryRunResult.skippedReason === "loot_write_dry_run", `Unexpected dry-run loot reason: ${dryRunResult.skippedReason}`);

  const notAllowlisted = await applyStagingLootClaimWrite(basePlan, {
    env: {
      STAGING_LOOT_WRITE_ENABLED: "true",
      STAGING_LOOT_WRITE_DRY_RUN: "false",
      STAGING_LOOT_WRITE_ALLOWLIST: "other-player"
    },
    fetchImpl: async () => {
      throw new Error("fetch should not run for non-allowlisted player");
    }
  });
  assert(notAllowlisted.applied === false, "Non-allowlisted loot write applied.");
  assert(notAllowlisted.skippedReason === "player_not_in_staging_loot_write_allowlist", `Unexpected non-allowlisted reason: ${notAllowlisted.skippedReason}`);

  const missingEnv = await applyStagingLootClaimWrite(basePlan, {
    env: {
      STAGING_LOOT_WRITE_ENABLED: "true",
      STAGING_LOOT_WRITE_DRY_RUN: "false",
      STAGING_LOOT_WRITE_SCOPE: "verified"
    }
  });
  assert(missingEnv.applied === false, "Loot write without Supabase env applied.");
  assert(missingEnv.skippedReason === "supabase_config_missing", `Unexpected missing-env loot reason: ${missingEnv.skippedReason}`);

  const calls = [];
  const appliedResult = await applyStagingLootClaimWrite(basePlan, {
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key",
      STAGING_LOOT_WRITE_ENABLED: "true",
      STAGING_LOOT_WRITE_DRY_RUN: "false",
      STAGING_LOOT_WRITE_ALLOWLIST: "verified-player-a"
    },
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, options });
      if (options.method === "GET") {
        assert(options.headers?.Authorization === "Bearer stub-service-key", "Loot read did not use service role bearer auth.");
        return {
          ok: true,
          status: 200,
          async json() {
            return [{ save_data: saveData }];
          }
        };
      }

      if (options.method === "PATCH") {
        const body = JSON.parse(options.body || "{}");
        assert(body.save_data.upgradeMaterials.lupenShards === 3, "Loot patch did not send updated Lupen Shards.");
        assert(body.save_data.inventoryItems.length === 1, "Loot patch mutated inventoryItems.");
        assert(body.save_data.credits === 500, "Loot patch mutated credits.");
        return {
          ok: true,
          status: 200,
          async json() {
            return [];
          }
        };
      }

      throw new Error(`Unexpected loot write method ${options.method}`);
    }
  });
  assert(appliedResult.applied === true, `Mocked loot write did not apply: ${appliedResult.skippedReason}`);
  assert(appliedResult.dryRun === false, "Mocked loot write stayed dry-run.");
  assert(appliedResult.materialBefore === 2 && appliedResult.materialAfter === 3, "Mocked loot write material delta was incorrect.");
  assert(appliedResult.writes.materialWritten === true && appliedResult.writes.saveWritten === true, "Mocked loot write did not report material/save writes.");
  assert(appliedResult.writes.inventoryWritten === false && appliedResult.writes.creditsWritten === false, "Mocked loot write reported forbidden writes.");
  assert(calls.some((call) => call.options.method === "GET"), "Mocked loot write did not read save data.");
  assert(calls.some((call) => call.options.method === "PATCH"), "Mocked loot write did not patch save data.");

  console.log("staging Lupen Shard loot write helpers stayed material-only and gated");
}

async function assertStagingTradeValidationHelpers() {
  const generatedOffers = getStagingTradeOffers();
  const stagingResources = ["Iron", "Copper", "Cobalt", "Crystal Shards"];
  const stagingPlanets = ["Asteron Prime", "Virella", "Nyxara"];
  assert(generatedOffers.length === stagingResources.length * stagingPlanets.length * (stagingPlanets.length - 1), "Generated staging trade offers did not cover every cross-planet resource pair.");
  for (const resourceName of stagingResources) {
    for (const buyNode of stagingPlanets) {
      const buyOffers = generatedOffers.filter((offer) => offer.resourceName === resourceName && offer.buyNode === buyNode);
      assert(buyOffers.length === stagingPlanets.length - 1, `Missing staging buy offers for ${resourceName} at ${buyNode}.`);
      assert(!buyOffers.some((offer) => offer.sellNode === buyNode), `Same-planet staging offer was generated for ${resourceName} at ${buyNode}.`);
    }
    for (const sellNode of stagingPlanets) {
      const sellOffers = generatedOffers.filter((offer) => offer.resourceName === resourceName && offer.sellNode === sellNode);
      assert(sellOffers.length === stagingPlanets.length - 1, `Missing staging sell offers for ${resourceName} at ${sellNode}.`);
    }
  }

  const extracted = extractTradeValidationStateFromSave({
    credits: 500,
    cargo: {
      Iron: 3,
      "Crystal Shards": 2
    },
    cargoCostBasis: {
      Iron: 12,
      "Crystal Shards": 80
    },
    cargoCapacity: 20
  });
  assert(extracted.available === true, "Trusted trade save state was not extracted.");
  assert(extracted.validationState.credits === 500, "Trusted trade credits were not extracted.");
  assert(extracted.validationState.cargoUsed === 5, "Trusted trade cargo used was not summed.");
  assert(extracted.validationState.cargoCapacity === 20, "Trusted trade cargo capacity was not extracted.");
  assert(extracted.validationState.cargoCostBasisByResource.Iron === 12, "Trusted trade cargo cost basis was not extracted.");
  assert(extracted.validationState.cargoByResource["crystal shards"] === 2, "Trusted trade cargo did not expose normalized Crystal Shards key.");
  assert(extracted.validationState.cargoCostBasisByResource["crystal shards"] === 80, "Trusted trade cost basis did not expose normalized Crystal Shards key.");
  assert(extracted.stateSources.credits === "trusted_save", "Trusted trade credits source was not marked trusted.");

  const extractedCanonicalCargo = extractTradeValidationStateFromSave({
    credits: 500,
    cargo: {
      crystal_shards: 7
    },
    cargoCostBasis: {
      crystal_shards: 95
    },
    cargoCapacity: 20
  });
  assert(extractedCanonicalCargo.available === true, "Trusted trade save state with canonical cargo key was not extracted.");
  assert(extractedCanonicalCargo.validationState.cargoUsed === 7, "Trusted trade cargo used did not include canonical cargo key.");
  assert(extractedCanonicalCargo.validationState.cargoByResource["crystal shards"] === 7, "Trusted trade cargo did not normalize canonical Crystal Shards key.");
  assert(extractedCanonicalCargo.validationState.cargoCostBasisByResource["crystal shards"] === 95, "Trusted trade cost basis did not normalize canonical Crystal Shards key.");

  const derivedStarterCapacity = extractTradeValidationStateFromSave({
    credits: 10000,
    cargo: {
      Iron: 0
    },
    cargoCostBasis: {},
    currentShipId: "lupenOrigin",
    ownedShips: ["lupenOrigin"],
    shipLoadouts: {
      lupenOrigin: {
        attachments: [],
        guns: [{ key: "pulseLaser", quality: "standard", level: 1 }]
      }
    }
  });
  assert(derivedStarterCapacity.available === true, "Starter trade save state with derived cargo capacity was not available.");
  assert(derivedStarterCapacity.validationState.cargoCapacity === 150, "Starter cargo capacity was not derived from currentShipId.");
  assert(derivedStarterCapacity.stateSources.cargoCapacity === "trusted_save_derived", "Derived starter cargo capacity source was not marked.");

  const derivedCargoPodCapacity = extractTradeValidationStateFromSave({
    credits: 10000,
    cargo: {
      Iron: 0
    },
    cargoCostBasis: {},
    currentShipId: "lupenOrigin",
    ownedShips: ["lupenOrigin"],
    shipLoadouts: {
      lupenOrigin: {
        attachments: [{ key: "cargoPod", quality: "standard", level: 1 }],
        guns: [{ key: "pulseLaser", quality: "standard", level: 1 }]
      }
    }
  });
  assert(derivedCargoPodCapacity.available === true, "Cargo Pod trade save state with derived capacity was not available.");
  assert(derivedCargoPodCapacity.validationState.cargoCapacity === 175, "Cargo Pod capacity was not derived from saved loadout.");

  const malformed = extractTradeValidationStateFromSave({
    cargo: {
      Iron: 2
    }
  });
  assert(malformed.available === false, "Malformed trade save state was unexpectedly available.");

  let readMethod = "";
  let readUrl = "";
  const fetched = await fetchPlayerTradeValidationState({
    authStatus: "verified",
    trustedPlayerId: "verified-player-a"
  }, {
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key"
    },
    fetchImpl: async (url, options = {}) => {
      readUrl = url;
      readMethod = options.method;
      assert(options.headers?.Authorization === "Bearer stub-service-key", "Trade save read did not use service role bearer auth.");
      assert(options.headers?.apikey === "stub-service-key", "Trade save read did not use service role apikey.");
      return {
        ok: true,
        status: 200,
        async json() {
          return [{
            updated_at: "2026-06-01T12:00:00.000Z",
            save_data: {
              credits: 1000,
              cargo: {
                Iron: 4
              },
              cargoCostBasis: {
                Iron: 18
              },
              currentShipId: "lupenOrigin",
              ownedShips: ["lupenOrigin"],
              shipLoadouts: {
                lupenOrigin: {
                  attachments: [{ key: "cargoPod", quality: "standard", level: 1 }],
                  guns: [{ key: "pulseLaser", quality: "standard", level: 1 }]
                }
              }
            }
          }];
        }
      };
    }
  });
  assert(readMethod === "GET", "Trade save preview used a non-read method.");
  assert(readUrl.includes("/rest/v1/player_saves?"), `Unexpected trade save read URL: ${readUrl}`);
  assert(fetched.available === true, "Fetched trusted trade state was not available.");
  assert(fetched.validationState.credits === 1000, "Fetched trusted trade credits were incorrect.");
  assert(fetched.validationState.cargoUsed === 4, "Fetched trusted trade cargo used was incorrect.");
  assert(fetched.validationState.cargoCapacity === 175, "Fetched trusted trade cargo capacity was not derived from saved ship/loadout.");
  assert(fetched.stateSources.cargoCapacity === "trusted_save_derived", "Fetched trusted trade capacity source was not marked as derived.");

  const unverified = await fetchPlayerTradeValidationState({
    authStatus: "unverified",
    trustedPlayerId: "untrusted-player"
  }, {
    fetchImpl: async () => {
      throw new Error("fetch should not run for unverified identities");
    }
  });
  assert(unverified.available === false, "Unverified trade save state was available.");
  assert(unverified.reason === "verified_identity_required", `Unexpected unverified trade save reason: ${unverified.reason}`);

  const offerId = "staging-iron-asteron-virella";
  const trustedPreview = buildStagingTradePreview({
    offerId,
    quantity: 3,
    trustedState: {
      available: true,
      reason: "",
      validationState: {
        credits: 1000,
        cargoUsed: 4,
        cargoCapacity: 12
      },
      stateSources: {
        credits: "trusted_save",
        cargoUsed: "trusted_save",
        cargoCapacity: "trusted_save"
      }
    }
  });
  assert(trustedPreview.validationMode === "trusted_save", `Unexpected trusted preview mode: ${trustedPreview.validationMode}`);
  assert(trustedPreview.trustedStateAvailable === true, "Trusted preview did not report trusted state.");
  assert(trustedPreview.snapshotUsed === false, "Trusted preview unexpectedly used snapshot.");
  assert(trustedPreview.wouldPass === true, "Trusted preview did not pass.");
  assert(trustedPreview.maxCargoQuantity === 8, "Trusted preview max cargo quantity was incorrect.");

  const trustedCapacityFromSnapshot = buildStagingTradePreview({
    offerId,
    quantity: 3,
    trustedState: {
      available: true,
      reason: "",
      validationState: {
        credits: 1000,
        cargoUsed: 4,
        cargoCapacity: null
      },
      stateSources: {
        credits: "trusted_save",
        cargoUsed: "trusted_save",
        cargoCapacity: "unknown"
      }
    },
    playerSnapshot: {
      credits: 1,
      cargoUsed: 1,
      cargoCapacity: 12
    }
  });
  assert(trustedCapacityFromSnapshot.validationMode === "trusted_save", "Trusted preview did not keep trusted mode when using snapshot capacity.");
  assert(trustedCapacityFromSnapshot.snapshotUsed === true, "Trusted preview did not report snapshot capacity use.");
  assert(trustedCapacityFromSnapshot.stateSources.cargoCapacity === "snapshot", "Trusted preview did not mark capacity source as snapshot.");
  assert(trustedCapacityFromSnapshot.creditsAvailable === 1000, "Trusted preview did not prefer trusted credits over snapshot.");
  assert(trustedCapacityFromSnapshot.cargoUsed === 4, "Trusted preview did not prefer trusted cargo used over snapshot.");

  const trustedInsufficientCredits = buildStagingTradePreview({
    offerId,
    quantity: 3,
    trustedState: {
      available: true,
      validationState: {
        credits: 1,
        cargoUsed: 0,
        cargoCapacity: 12
      }
    }
  });
  assert(trustedInsufficientCredits.validationMode === "trusted_save", "Trusted insufficient-credit preview lost trusted mode.");
  assert(trustedInsufficientCredits.blockReason === "insufficient_credits", `Unexpected trusted insufficient-credit reason: ${trustedInsufficientCredits.blockReason}`);

  const trustedInsufficientCargo = buildStagingTradePreview({
    offerId,
    quantity: 3,
    trustedState: {
      available: true,
      validationState: {
        credits: 1000,
        cargoUsed: 11,
        cargoCapacity: 12
      }
    }
  });
  assert(trustedInsufficientCargo.validationMode === "trusted_save", "Trusted insufficient-cargo preview lost trusted mode.");
  assert(trustedInsufficientCargo.blockReason === "insufficient_cargo", `Unexpected trusted insufficient-cargo reason: ${trustedInsufficientCargo.blockReason}`);

  const fallbackSnapshotPreview = buildStagingTradePreview({
    offerId,
    quantity: 3,
    trustedState: {
      available: false,
      reason: "save_missing"
    },
    playerSnapshot: {
      credits: 1000,
      cargoUsed: 0,
      cargoCapacity: 12
    }
  });
  assert(fallbackSnapshotPreview.validationMode === "snapshot", "Trade preview did not fall back to snapshot.");
  assert(fallbackSnapshotPreview.snapshotUsed === true, "Snapshot fallback did not mark snapshot used.");

  const unknownPreview = buildStagingTradePreview({
    offerId,
    quantity: 3,
    trustedState: {
      available: false,
      reason: "save_missing"
    }
  });
  assert(unknownPreview.validationMode === "unknown", "Trade preview without trusted state or snapshot was not unknown.");
  assert(unknownPreview.wouldPass === false, "Unknown trade preview unexpectedly passed.");
  assert(unknownPreview.creditsWritten === false && unknownPreview.cargoWritten === false && unknownPreview.saveWritten === false, "Trade helper reported writes.");

  const buyWriteDryRun = buildStagingTradeWriteDryRun({
    operation: "buy",
    offerId,
    quantity: 3,
    trustedState: {
      available: true,
      validationState: {
        credits: 1000,
        cargoUsed: 4,
        cargoCapacity: 12,
        cargoByResource: {
          Iron: 4
        }
      }
    },
    identity: {
      authStatus: "verified",
      trustedPlayerId: "verified-player-a"
    }
  });
  assert(buyWriteDryRun.ok === true, `Buy write dry-run was blocked: ${buyWriteDryRun.reason}`);
  assert(buyWriteDryRun.mode === "dry_run", `Unexpected buy write mode: ${buyWriteDryRun.mode}`);
  assert(buyWriteDryRun.operation === "buy", "Buy write result did not report buy operation.");
  assert(buyWriteDryRun.applied === false, "Buy write dry-run applied a trade.");
  assert(buyWriteDryRun.cost === 54, `Unexpected buy write cost: ${buyWriteDryRun.cost}`);
  assert(buyWriteDryRun.creditsDelta === -54, `Unexpected buy credits delta: ${buyWriteDryRun.creditsDelta}`);
  assert(buyWriteDryRun.cargoDelta === 3, `Unexpected buy cargo delta: ${buyWriteDryRun.cargoDelta}`);
  assert(buyWriteDryRun.writes.saveWritten === false, "Buy write dry-run reported save write.");

  const sellWriteDryRun = buildStagingTradeWriteDryRun({
    operation: "sell",
    offerId,
    quantity: 2,
    trustedState: {
      available: true,
      validationState: {
        credits: 1000,
        cargoUsed: 4,
        cargoCapacity: null,
        cargoByResource: {
          Iron: 4
        }
      }
    },
    identity: {
      authStatus: "verified",
      trustedPlayerId: "verified-player-a"
    }
  });
  assert(sellWriteDryRun.ok === true, `Sell write dry-run was blocked: ${sellWriteDryRun.reason}`);
  assert(sellWriteDryRun.mode === "dry_run", `Unexpected sell write mode: ${sellWriteDryRun.mode}`);
  assert(sellWriteDryRun.operation === "sell", "Sell write result did not report sell operation.");
  assert(sellWriteDryRun.applied === false, "Sell write dry-run applied a trade.");
  assert(sellWriteDryRun.revenue === 60, `Unexpected sell write revenue: ${sellWriteDryRun.revenue}`);
  assert(sellWriteDryRun.creditsDelta === 60, `Unexpected sell credits delta: ${sellWriteDryRun.creditsDelta}`);
  assert(sellWriteDryRun.cargoDelta === -2, `Unexpected sell cargo delta: ${sellWriteDryRun.cargoDelta}`);
  assert(sellWriteDryRun.validationMode === "trusted_save_limited", `Unexpected limited sell validation mode: ${sellWriteDryRun.validationMode}`);
  assert(sellWriteDryRun.writes.saveWritten === false, "Sell write dry-run reported save write.");

  const crystalSellWriteDryRun = buildStagingTradeWriteDryRun({
    operation: "sell",
    offerId: "staging-crystal-asteron-nyxara",
    quantity: 4,
    trustedState: {
      available: true,
      validationState: {
        credits: 1000,
        cargoUsed: 64,
        cargoCapacity: null,
        cargoByResource: {
          crystal_shards: 64
        }
      }
    },
    identity: {
      authStatus: "verified",
      trustedPlayerId: "verified-player-a"
    }
  });
  assert(crystalSellWriteDryRun.ok === true, `Crystal Shards sell dry-run was blocked: ${crystalSellWriteDryRun.reason}`);
  assert(crystalSellWriteDryRun.revenue === 580, `Unexpected Crystal Shards sell revenue: ${crystalSellWriteDryRun.revenue}`);
  assert(crystalSellWriteDryRun.cargoBefore === 64 && crystalSellWriteDryRun.cargoAfter === 60, "Crystal Shards sell dry-run did not use normalized cargo.");

  const sellUnknownResource = buildStagingTradeWriteDryRun({
    operation: "sell",
    offerId,
    quantity: 2,
    trustedState: {
      available: true,
      validationState: {
        credits: 1000,
        cargoUsed: 4,
        cargoCapacity: null
      }
    }
  });
  assert(sellUnknownResource.ok === false, "Sell write without resource cargo was not blocked.");
  assert(sellUnknownResource.reason === "unknown_resource_cargo", `Unexpected unknown-resource sell reason: ${sellUnknownResource.reason}`);
  assert(sellUnknownResource.writes.saveWritten === false, "Blocked sell write reported save write.");

  const enabledDryRunGate = buildStagingTradeWriteDryRun({
    operation: "buy",
    offerId,
    quantity: 1,
    trustedState: {
      available: true,
      validationState: {
        credits: 1000,
        cargoUsed: 0,
        cargoCapacity: 12,
        cargoByResource: { Iron: 0 }
      }
    },
    identity: {
      authStatus: "verified",
      trustedPlayerId: "verified-player-a"
    },
    env: {
      STAGING_TRADE_WRITE_ENABLED: "true",
      STAGING_TRADE_WRITE_DRY_RUN: "true",
      STAGING_TRADE_WRITE_SCOPE: "allowlist",
      STAGING_TRADE_WRITE_ALLOWLIST: "verified-player-a",
      STAGING_TRADE_WRITE_ALLOWED_OFFERS: offerId
    }
  });
  assert(enabledDryRunGate.gates.writeEnabled === true, "Trade write gate did not see enabled env.");
  assert(enabledDryRunGate.gates.dryRun === true, "Trade write dry-run env was not preserved.");
  assert(enabledDryRunGate.applied === false && enabledDryRunGate.saveWritten === false, "Enabled dry-run gate wrote unexpectedly.");

  const enabledWriteGate = buildStagingTradeWriteDryRun({
    operation: "buy",
    offerId,
    quantity: 1,
    trustedState: {
      available: true,
      validationState: {
        credits: 1000,
        cargoUsed: 0,
        cargoCapacity: 12,
        cargoByResource: { Iron: 0 }
      }
    },
    identity: {
      authStatus: "verified",
      trustedPlayerId: "verified-player-a"
    },
    env: {
      STAGING_TRADE_WRITE_ENABLED: "true",
      STAGING_TRADE_WRITE_DRY_RUN: "false",
      STAGING_TRADE_WRITE_SCOPE: "allowlist",
      STAGING_TRADE_WRITE_ALLOWLIST: "verified-player-a",
      STAGING_TRADE_WRITE_ALLOWED_OFFERS: offerId
    }
  });
  assert(enabledWriteGate.gates.writeEnabled === true, "Trade write gate did not enable writes.");
  assert(enabledWriteGate.gates.dryRun === false, "Trade write gate did not disable dry-run.");
  assert(enabledWriteGate.gates.allowlisted === true, "Trade write gate did not allow verified allowlisted player.");

  const notAllowlistedGate = buildStagingTradeWriteDryRun({
    operation: "buy",
    offerId,
    quantity: 1,
    trustedState: {
      available: true,
      validationState: {
        credits: 1000,
        cargoUsed: 0,
        cargoCapacity: 12,
        cargoByResource: { Iron: 0 }
      }
    },
    identity: {
      authStatus: "verified",
      trustedPlayerId: "verified-player-b"
    },
    env: {
      STAGING_TRADE_WRITE_ENABLED: "true",
      STAGING_TRADE_WRITE_DRY_RUN: "false",
      STAGING_TRADE_WRITE_SCOPE: "allowlist",
      STAGING_TRADE_WRITE_ALLOWLIST: "verified-player-a"
    }
  });
  assert(notAllowlistedGate.gates.allowlisted === false, "Trade write gate allowed a non-allowlisted player.");

  const originalSave = {
    credits: 1000,
    cargo: {
      Iron: 2,
      Copper: 9
    },
    cargoCostBasis: {
      Iron: 10,
      Copper: 30
    },
    inventoryItems: [{ id: "keep" }],
    activeBountyId: "bounty-1",
    playerProgress: {
      combatXp: 77
    },
    nested: {
      untouched: true
    }
  };
  const patchPlan = buildStagingTradeBuySavePatch(originalSave, {
    offerId,
    resourceId: "iron",
    resourceName: "Iron",
    buyPrice: 18
  }, 3, {
    cargoCapacity: 20
  });
  assert(patchPlan.ok === true, `Trade buy patch plan failed: ${patchPlan.reason}`);
  assert(patchPlan.creditsBefore === 1000 && patchPlan.creditsAfter === 946, "Trade buy patch did not subtract server cost.");
  assert(patchPlan.cargoBefore === 2 && patchPlan.cargoAfter === 5, "Trade buy patch did not add cargo resource.");
  assert(patchPlan.cargoCostBasisAfter === 15, `Unexpected cargo cost basis after buy: ${patchPlan.cargoCostBasisAfter}`);
  assert(originalSave.credits === 1000 && originalSave.cargo.Iron === 2, "Trade buy patch mutated the original save object.");
  assert(patchPlan.patchedSaveData.inventoryItems[0].id === "keep", "Trade buy patch changed inventory.");
  assert(patchPlan.patchedSaveData.activeBountyId === "bounty-1", "Trade buy patch changed bounty state.");
  assert(patchPlan.patchedSaveData.playerProgress.combatXp === 77, "Trade buy patch changed progression.");
  assert(patchPlan.patchedSaveData.nested.untouched === true, "Trade buy patch changed unrelated fields.");

  const invalidPatch = buildStagingTradeBuySavePatch({
    credits: 1000,
    cargo: { Iron: 0 }
  }, {
    offerId,
    resourceId: "iron",
    resourceName: "Iron",
    buyPrice: 18
  }, 1, {
    cargoCapacity: 20
  });
  assert(invalidPatch.ok === false, "Trade buy patch allowed missing cargoCostBasis.");
  assert(invalidPatch.reason === "cargo_cost_basis_path_missing_or_invalid", `Unexpected missing cost basis reason: ${invalidPatch.reason}`);

  let fetchCalls = [];
  const blockedWrite = await applyStagingTradeBuyWrite({
    playerId: "verified-player-a",
    offer: {
      offerId,
      resourceId: "iron",
      resourceName: "Iron",
      buyPrice: 18
    },
    quantity: 1,
    trustedState: {
      available: true,
      validationState: {
        cargoCapacity: 20
      }
    },
    env: {},
    fetchImpl: async (...args) => {
      fetchCalls.push(args);
      return { ok: true, status: 200, async json() { return []; } };
    }
  });
  assert(blockedWrite.applied === false, "Trade write applied without Supabase env.");
  assert(blockedWrite.reason === "staging_trade_writes_disabled", `Unexpected disabled write reason: ${blockedWrite.reason}`);
  assert(fetchCalls.length === 0, "Trade write attempted fetch without Supabase env.");

  const dryRunBlockedWrite = await applyStagingTradeBuyWrite({
    playerId: "verified-player-a",
    offer: {
      offerId,
      resourceId: "iron",
      resourceName: "Iron",
      buyPrice: 18
    },
    quantity: 1,
    trustedState: {
      available: true,
      validationState: {
        cargoCapacity: 20
      }
    },
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-role",
      STAGING_TRADE_WRITE_ENABLED: "true",
      STAGING_TRADE_WRITE_DRY_RUN: "true",
      STAGING_TRADE_WRITE_SCOPE: "allowlist",
      STAGING_TRADE_WRITE_ALLOWLIST: "verified-player-a"
    },
    fetchImpl: async (...args) => {
      fetchCalls.push(args);
      return { ok: true, status: 200, async json() { return []; } };
    }
  });
  assert(dryRunBlockedWrite.applied === false, "Trade write applied while dry-run env was true.");
  assert(dryRunBlockedWrite.reason === "staging_trade_dry_run_enabled", `Unexpected dry-run write reason: ${dryRunBlockedWrite.reason}`);

  const allowlistBlockedWrite = await applyStagingTradeBuyWrite({
    playerId: "verified-player-b",
    offer: {
      offerId,
      resourceId: "iron",
      resourceName: "Iron",
      buyPrice: 18
    },
    quantity: 1,
    trustedState: {
      available: true,
      validationState: {
        cargoCapacity: 20
      }
    },
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-role",
      STAGING_TRADE_WRITE_ENABLED: "true",
      STAGING_TRADE_WRITE_DRY_RUN: "false",
      STAGING_TRADE_WRITE_SCOPE: "allowlist",
      STAGING_TRADE_WRITE_ALLOWLIST: "verified-player-a"
    },
    fetchImpl: async (...args) => {
      fetchCalls.push(args);
      return { ok: true, status: 200, async json() { return []; } };
    }
  });
  assert(allowlistBlockedWrite.applied === false, "Trade write applied for non-allowlisted player.");
  assert(allowlistBlockedWrite.reason === "player_not_in_staging_trade_write_allowlist", `Unexpected allowlist write reason: ${allowlistBlockedWrite.reason}`);

  fetchCalls = [];
  const appliedWrite = await applyStagingTradeBuyWrite({
    playerId: "verified-player-a",
    offer: {
      offerId,
      resourceId: "iron",
      resourceName: "Iron",
      buyPrice: 18
    },
    quantity: 2,
    trustedState: {
      available: true,
      validationState: {
        cargoCapacity: 20
      }
    },
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-role",
      STAGING_TRADE_WRITE_ENABLED: "true",
      STAGING_TRADE_WRITE_DRY_RUN: "false",
      STAGING_TRADE_WRITE_SCOPE: "allowlist",
      STAGING_TRADE_WRITE_ALLOWLIST: "verified-player-a"
    },
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push({ url, options });
      assert(options.headers?.apikey === "stub-service-role", "Trade write did not use service role apikey.");
      assert((options.headers?.Authorization || options.headers?.authorization) === "Bearer stub-service-role", "Trade write did not use bearer service role.");
      if (options.method === "GET") {
        return {
          ok: true,
          status: 200,
          async json() {
            return [{
              save_data: {
                credits: 1000,
                cargo: { Iron: 1, Copper: 4 },
                cargoCostBasis: { Iron: 12, Copper: 32 },
                inventoryItems: [{ id: "safe" }],
                activeBountyId: "unchanged",
                playerProgress: { combatXp: 10 }
              }
            }];
          }
        };
      }
      assert(options.method === "PATCH", "Trade write used unexpected method.");
      const body = JSON.parse(options.body);
      assert(body.save_data.credits === 964, "Trade write PATCH did not contain updated credits.");
      assert(body.save_data.cargo.Iron === 3, "Trade write PATCH did not contain updated cargo.");
      assert(body.save_data.cargo.Copper === 4, "Trade write PATCH changed unrelated cargo.");
      assert(body.save_data.inventoryItems[0].id === "safe", "Trade write PATCH changed inventory.");
      assert(body.save_data.activeBountyId === "unchanged", "Trade write PATCH changed bounty.");
      assert(body.save_data.playerProgress.combatXp === 10, "Trade write PATCH changed progression.");
      return { ok: true, status: 204 };
    }
  });
  assert(fetchCalls.length === 2, `Trade write expected read+patch, got ${fetchCalls.length} calls.`);
  assert(appliedWrite.applied === true, `Trade write did not apply in mocked enabled path: ${appliedWrite.reason}`);
  assert(appliedWrite.mode === "trade_write", `Unexpected trade write mode: ${appliedWrite.mode}`);
  assert(appliedWrite.creditsWritten === true && appliedWrite.cargoWritten === true && appliedWrite.saveWritten === true, "Applied trade write did not report expected writes.");
  assert(appliedWrite.inventoryWritten === false && appliedWrite.lootWritten === false && appliedWrite.bountyWritten === false, "Applied trade write reported forbidden writes.");
  assert(appliedWrite.creditsBefore === 1000 && appliedWrite.creditsAfter === 964, "Applied trade write did not include credit after-values.");
  assert(appliedWrite.cargoBefore === 1 && appliedWrite.cargoAfter === 3, "Applied trade write did not include resource cargo after-values.");
  assert(appliedWrite.cargoUsedBefore === 5 && appliedWrite.cargoUsedAfter === 7 && appliedWrite.cargoCapacity === 20, "Applied trade write did not include cargo hold after-values.");

  const sellPatchPlan = buildStagingTradeSellSavePatch({
    credits: 1000,
    cargo: { Iron: 5, Copper: 2 },
    cargoCostBasis: { Iron: 15, Copper: 32 },
    inventoryItems: [{ id: "kept" }],
    activeBountyId: "bounty-safe",
    playerProgress: { combatXp: 22 }
  }, {
    offerId,
    resourceId: "iron",
    resourceName: "Iron",
    sellPrice: 25
  }, 3, {
    cargoCapacity: 20
  });
  assert(sellPatchPlan.ok === true, `Trade sell patch plan failed: ${sellPatchPlan.reason}`);
  assert(sellPatchPlan.creditsBefore === 1000 && sellPatchPlan.creditsAfter === 1075, "Trade sell patch did not add server revenue.");
  assert(sellPatchPlan.cargoBefore === 5 && sellPatchPlan.cargoAfter === 2, "Trade sell patch did not subtract cargo resource.");
  assert(sellPatchPlan.cargoCostBasisAfter === 15, "Trade sell partial patch changed unit cost basis.");
  assert(sellPatchPlan.patchedSaveData.inventoryItems[0].id === "kept", "Trade sell patch changed inventory.");
  assert(sellPatchPlan.patchedSaveData.activeBountyId === "bounty-safe", "Trade sell patch changed bounty.");
  assert(sellPatchPlan.patchedSaveData.playerProgress.combatXp === 22, "Trade sell patch changed progression.");

  const sellAllPatchPlan = buildStagingTradeSellSavePatch({
    credits: 1000,
    cargo: { Iron: 3 },
    cargoCostBasis: { Iron: 15 }
  }, {
    offerId,
    resourceId: "iron",
    resourceName: "Iron",
    sellPrice: 25
  }, 3, {
    cargoCapacity: 20
  });
  assert(sellAllPatchPlan.ok === true, "Trade sell-all patch did not succeed.");
  assert(sellAllPatchPlan.patchedSaveData.cargo.Iron === 0, "Trade sell-all patch did not zero cargo.");
  assert(sellAllPatchPlan.patchedSaveData.cargoCostBasis.Iron === undefined, "Trade sell-all patch did not clear cost basis.");

  const sellInsufficientPatchPlan = buildStagingTradeSellSavePatch({
    credits: 1000,
    cargo: { Iron: 1 },
    cargoCostBasis: { Iron: 15 }
  }, {
    offerId,
    resourceId: "iron",
    resourceName: "Iron",
    sellPrice: 25
  }, 3, {
    cargoCapacity: 20
  });
  assert(sellInsufficientPatchPlan.ok === false && sellInsufficientPatchPlan.reason === "insufficient_resource_cargo", "Trade sell patch allowed overselling cargo.");

  const crystalSellPatchPlan = buildStagingTradeSellSavePatch({
    credits: 1000,
    cargo: { crystal_shards: 64, Iron: 2 },
    cargoCostBasis: { crystal_shards: 95, Iron: 18 },
    inventoryItems: [{ id: "kept" }],
    activeBountyId: "bounty-safe"
  }, {
    offerId: "staging-crystal-asteron-nyxara",
    resourceId: "crystal_shards",
    resourceName: "Crystal Shards",
    sellPrice: 145
  }, 4, {
    cargoCapacity: 150
  });
  assert(crystalSellPatchPlan.ok === true, `Crystal Shards sell patch plan failed: ${crystalSellPatchPlan.reason}`);
  assert(crystalSellPatchPlan.resourceKey === "crystal_shards", "Crystal Shards sell patch did not preserve canonical saved cargo key.");
  assert(crystalSellPatchPlan.creditsBefore === 1000 && crystalSellPatchPlan.creditsAfter === 1580, "Crystal Shards sell patch did not add server revenue.");
  assert(crystalSellPatchPlan.cargoBefore === 64 && crystalSellPatchPlan.cargoAfter === 60, "Crystal Shards sell patch did not subtract canonical cargo.");
  assert(crystalSellPatchPlan.patchedSaveData.cargo.crystal_shards === 60, "Crystal Shards sell patch did not update canonical cargo key.");
  assert(crystalSellPatchPlan.patchedSaveData.cargo["Crystal Shards"] === undefined, "Crystal Shards sell patch created a display-name cargo key.");
  assert(crystalSellPatchPlan.patchedSaveData.cargo.Iron === 2, "Crystal Shards sell patch changed unrelated cargo.");
  assert(crystalSellPatchPlan.patchedSaveData.inventoryItems[0].id === "kept", "Crystal Shards sell patch changed inventory.");
  assert(crystalSellPatchPlan.patchedSaveData.activeBountyId === "bounty-safe", "Crystal Shards sell patch changed bounty.");

  const minedCopperSellPatchPlan = buildStagingTradeSellSavePatch({
    credits: 1000,
    cargo: { Copper: 24 },
    cargoCostBasis: {},
    inventoryItems: [{ id: "kept" }],
    playerProgress: { combatXp: 22 }
  }, {
    offerId: "staging-copper-virella-nyxara",
    resourceId: "copper",
    resourceName: "Copper",
    sellPrice: 50
  }, 24, {
    cargoCapacity: 150
  });
  assert(minedCopperSellPatchPlan.ok === true, `Mined Copper sell patch plan failed: ${minedCopperSellPatchPlan.reason}`);
  assert(minedCopperSellPatchPlan.recoveredResourceSale === true, "Mined Copper sell patch did not mark recovered resource sale.");
  assert(minedCopperSellPatchPlan.creditsBefore === 1000 && minedCopperSellPatchPlan.creditsAfter === 2200, "Mined Copper sell patch did not add market revenue.");
  assert(minedCopperSellPatchPlan.cargoBefore === 24 && minedCopperSellPatchPlan.cargoAfter === 0, "Mined Copper sell patch did not subtract trusted cargo.");
  assert(minedCopperSellPatchPlan.cargoCostBasisBefore === null && minedCopperSellPatchPlan.cargoCostBasisAfter === null, "Mined Copper sell patch invented a cost basis.");
  assert(minedCopperSellPatchPlan.patchedSaveData.cargo.Copper === 0, "Mined Copper sell patch did not zero cargo.");
  assert(minedCopperSellPatchPlan.patchedSaveData.cargoCostBasis.Copper === undefined, "Mined Copper sell patch created a cost-basis entry.");
  assert(minedCopperSellPatchPlan.patchedSaveData.inventoryItems[0].id === "kept", "Mined Copper sell patch changed inventory.");
  assert(minedCopperSellPatchPlan.patchedSaveData.playerProgress.combatXp === 22, "Mined Copper sell patch changed progression.");

  fetchCalls = [];
  const appliedSellWrite = await applyStagingTradeSellWrite({
    playerId: "verified-player-a",
    offer: {
      offerId,
      resourceId: "iron",
      resourceName: "Iron",
      sellPrice: 25
    },
    quantity: 2,
    trustedState: {
      available: true,
      validationState: {
        cargoCapacity: 20
      }
    },
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-role",
      STAGING_TRADE_WRITE_ENABLED: "true",
      STAGING_TRADE_WRITE_DRY_RUN: "false",
      STAGING_TRADE_WRITE_SCOPE: "allowlist",
      STAGING_TRADE_WRITE_ALLOWLIST: "verified-player-a"
    },
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push({ url, options });
      assert(options.headers?.apikey === "stub-service-role", "Trade sell write did not use service role apikey.");
      assert((options.headers?.Authorization || options.headers?.authorization) === "Bearer stub-service-role", "Trade sell write did not use bearer service role.");
      if (options.method === "GET") {
        return {
          ok: true,
          status: 200,
          async json() {
            return [{
              save_data: {
                credits: 1000,
                cargo: { Iron: 5, Copper: 4 },
                cargoCostBasis: { Iron: 12, Copper: 32 },
                inventoryItems: [{ id: "safe" }],
                activeBountyId: "unchanged",
                playerProgress: { combatXp: 10 }
              }
            }];
          }
        };
      }
      assert(options.method === "PATCH", "Trade sell write used unexpected method.");
      const body = JSON.parse(options.body);
      assert(body.save_data.credits === 1050, "Trade sell PATCH did not contain updated credits.");
      assert(body.save_data.cargo.Iron === 3, "Trade sell PATCH did not contain updated cargo.");
      assert(body.save_data.cargo.Copper === 4, "Trade sell PATCH changed unrelated cargo.");
      assert(body.save_data.cargoCostBasis.Iron === 12, "Trade sell PATCH changed partial remaining cost basis.");
      assert(body.save_data.inventoryItems[0].id === "safe", "Trade sell PATCH changed inventory.");
      assert(body.save_data.activeBountyId === "unchanged", "Trade sell PATCH changed bounty.");
      assert(body.save_data.playerProgress.combatXp === 10, "Trade sell PATCH changed progression.");
      return { ok: true, status: 204 };
    }
  });
  assert(fetchCalls.length === 2, `Trade sell write expected read+patch, got ${fetchCalls.length} calls.`);
  assert(appliedSellWrite.applied === true, `Trade sell write did not apply in mocked enabled path: ${appliedSellWrite.reason}`);
  assert(appliedSellWrite.mode === "trade_write", `Unexpected trade sell write mode: ${appliedSellWrite.mode}`);
  assert(appliedSellWrite.creditsDelta === 50 && appliedSellWrite.cargoDelta === -2, "Trade sell write returned incorrect deltas.");
  assert(appliedSellWrite.inventoryWritten === false && appliedSellWrite.lootWritten === false && appliedSellWrite.bountyWritten === false, "Applied trade sell write reported forbidden writes.");

  let sequentialSave = {
    credits: 1000,
    cargo: { Iron: 0, Copper: 2 },
    cargoCostBasis: {},
    inventoryItems: [{ id: "untouched-inventory" }],
    activeBountyId: "untouched-bounty",
    playerProgress: {
      totals: {
        tradesCompleted: 3,
        cargoSold: 8,
        tradeProfit: 123
      }
    },
    marker: {
      shouldRemain: true
    }
  };
  const sequentialOffer = {
    offerId,
    resourceId: "iron",
    resourceName: "Iron",
    buyPrice: 18,
    sellPrice: 25
  };
  const sequentialFetchCalls = [];
  const sequentialFetch = async (_url, options = {}) => {
    sequentialFetchCalls.push(options.method || "GET");
    if (options.method === "GET") {
      return {
        ok: true,
        status: 200,
        async json() {
          return [{ save_data: sequentialSave }];
        }
      };
    }
    assert(options.method === "PATCH", "Sequential trade test used unexpected write method.");
    const body = JSON.parse(options.body || "{}");
    sequentialSave = body.save_data;
    return { ok: true, status: 204 };
  };
  const sequentialEnv = {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "stub-service-role",
    STAGING_TRADE_WRITE_ENABLED: "true",
    STAGING_TRADE_WRITE_DRY_RUN: "false",
    STAGING_TRADE_WRITE_SCOPE: "allowlist",
    STAGING_TRADE_WRITE_ALLOWLIST: "verified-player-a"
  };
  const sequentialTrustedState = {
    available: true,
    validationState: {
      cargoCapacity: 20
    }
  };
  const sequentialBuy = await applyStagingTradeBuyWrite({
    playerId: "verified-player-a",
    offer: sequentialOffer,
    quantity: 1,
    trustedState: sequentialTrustedState,
    env: sequentialEnv,
    fetchImpl: sequentialFetch
  });
  assert(sequentialBuy.applied === true, `Sequential buy did not apply in mocked enabled path: ${sequentialBuy.reason}`);
  assert(sequentialBuy.creditsBefore === 1000 && sequentialBuy.creditsAfter === 982, "Sequential buy did not subtract expected credits.");
  assert(sequentialBuy.cargoBefore === 0 && sequentialBuy.cargoAfter === 1, "Sequential buy did not add expected cargo.");
  assert(sequentialSave.credits === 982 && sequentialSave.cargo.Iron === 1, "Sequential buy did not update mocked save state.");
  assert(sequentialSave.cargoCostBasis.Iron === 18, "Sequential buy did not set cost basis.");

  const sequentialSell = await applyStagingTradeSellWrite({
    playerId: "verified-player-a",
    offer: sequentialOffer,
    quantity: 1,
    trustedState: sequentialTrustedState,
    env: sequentialEnv,
    fetchImpl: sequentialFetch
  });
  assert(sequentialSell.applied === true, `Sequential sell did not apply in mocked enabled path: ${sequentialSell.reason}`);
  assert(sequentialSell.creditsBefore === 982 && sequentialSell.creditsAfter === 1007, "Sequential sell did not add expected credits.");
  assert(sequentialSell.cargoBefore === 1 && sequentialSell.cargoAfter === 0, "Sequential sell did not remove expected cargo.");
  assert(sequentialSave.credits === 1007 && sequentialSave.cargo.Iron === 0, "Sequential sell did not update mocked save state.");
  assert(sequentialSave.cargoCostBasis.Iron === undefined, "Sequential sell-all did not clear cost basis.");
  assert(sequentialSave.inventoryItems[0].id === "untouched-inventory", "Sequential buy/sell changed inventory.");
  assert(sequentialSave.activeBountyId === "untouched-bounty", "Sequential buy/sell changed bounty.");
  assert(sequentialSave.playerProgress.totals.tradesCompleted === 3, "Sequential buy/sell changed route completion totals.");
  assert(sequentialSave.playerProgress.totals.cargoSold === 8, "Sequential buy/sell changed cargo sold totals.");
  assert(sequentialSave.playerProgress.totals.tradeProfit === 123, "Sequential buy/sell changed trade profit totals.");
  assert(sequentialSave.marker.shouldRemain === true, "Sequential buy/sell changed unrelated save fields.");
  assert(sequentialFetchCalls.join(",") === "GET,PATCH,GET,PATCH", `Sequential trade expected read/write pairs, got ${sequentialFetchCalls.join(",")}.`);

  console.log("staging trade validation and gated buy/sell write helpers passed");
}

async function assertStagingStorePreviewHelpers() {
  const items = getStagingStoreItems();
  assert(items.length >= 3, "Staging Store item list did not include deterministic test items.");
  assert(items.some((item) => item.itemId === "gun:pulseLaser"), "Staging Store missing Pulse Laser.");
  assert(items.some((item) => item.itemId === "attachment:cargoPod"), "Staging Store missing Cargo Pod.");
  assert(items.some((item) => item.itemId === "attachment:shieldBooster"), "Staging Store missing Shield Booster.");
  assert(items.some((item) => item.itemId === "ship:lupenHauler"), "Staging Store missing LF-2 Hauler.");

  const validTrustedPreview = buildStagingStorePurchasePreview({
    itemId: "attachment:cargoPod",
    quantity: 1,
    trustedState: {
      available: true,
      validationState: {
        credits: 1000
      }
    }
  });
  assert(validTrustedPreview.ok === true, `Valid Store preview was blocked: ${validTrustedPreview.blockReason}`);
  assert(validTrustedPreview.mode === "dry_run", `Unexpected Store preview mode: ${validTrustedPreview.mode}`);
  assert(validTrustedPreview.operation === "purchase", "Store preview did not report purchase operation.");
  assert(validTrustedPreview.applied === false, "Store preview applied a purchase.");
  assert(validTrustedPreview.itemId === "attachment:cargoPod", "Store preview returned wrong item.");
  assert(validTrustedPreview.totalCost === 220, `Unexpected Store preview total cost: ${validTrustedPreview.totalCost}`);
  assert(validTrustedPreview.creditsBefore === 1000 && validTrustedPreview.creditsAfterPreview === 780, "Store preview before/after credits were wrong.");
  assert(validTrustedPreview.validationMode === "trusted_save", `Unexpected Store validation mode: ${validTrustedPreview.validationMode}`);
  assert(validTrustedPreview.creditsWritten === false, "Store preview reported credit write.");
  assert(validTrustedPreview.inventoryWritten === false, "Store preview reported inventory write.");
  assert(validTrustedPreview.shipWritten === false, "Store preview reported ship write.");
  assert(validTrustedPreview.equipmentWritten === false, "Store preview reported equipment write.");
  assert(validTrustedPreview.saveWritten === false, "Store preview reported save write.");
  assert(validTrustedPreview.lootWritten === false, "Store preview reported loot write.");
  assert(validTrustedPreview.bountyWritten === false, "Store preview reported bounty write.");

  const insufficientCredits = buildStagingStorePurchasePreview({
    itemId: "attachment:shieldBooster",
    quantity: 1,
    trustedState: {
      available: true,
      validationState: {
        credits: 100
      }
    }
  });
  assert(insufficientCredits.ok === false, "Insufficient-credit Store preview was not blocked.");
  assert(insufficientCredits.blockReason === "insufficient_credits", `Unexpected insufficient Store reason: ${insufficientCredits.blockReason}`);
  assert(insufficientCredits.creditsWritten === false && insufficientCredits.saveWritten === false, "Blocked Store preview reported writes.");

  const invalidItem = buildStagingStorePurchasePreview({
    itemId: "missing:item",
    quantity: 1,
    trustedState: {
      available: true,
      validationState: {
        credits: 1000
      }
    }
  });
  assert(invalidItem.ok === false, "Unknown Store item was not blocked.");
  assert(invalidItem.blockReason === "unknown_store_item", `Unexpected unknown Store item reason: ${invalidItem.blockReason}`);

  const invalidQuantity = buildStagingStorePurchasePreview({
    itemId: "gun:pulseLaser",
    quantity: 0,
    trustedState: {
      available: true,
      validationState: {
        credits: 1000
      }
    }
  });
  assert(invalidQuantity.ok === false, "Invalid Store quantity was not blocked.");
  assert(invalidQuantity.blockReason === "invalid_store_quantity", `Unexpected invalid quantity reason: ${invalidQuantity.blockReason}`);

  const snapshotPreview = buildStagingStorePurchasePreview({
    itemId: "gun:pulseLaser",
    quantity: 1,
    playerSnapshot: {
      credits: 900
    },
    trustedState: {
      available: false,
      reason: "save_missing"
    }
  });
  assert(snapshotPreview.ok === true, "Store preview did not fall back to snapshot credits.");
  assert(snapshotPreview.validationMode === "snapshot", `Unexpected Store snapshot validation mode: ${snapshotPreview.validationMode}`);
  assert(snapshotPreview.creditsAfterPreview === 152, `Unexpected Store snapshot after credits: ${snapshotPreview.creditsAfterPreview}`);

  const unknownPreview = buildStagingStorePurchasePreview({
    itemId: "gun:pulseLaser",
    quantity: 1,
    trustedState: {
      available: false,
      reason: "save_missing"
    }
  });
  assert(unknownPreview.ok === false, "Store preview without trusted state or snapshot unexpectedly passed.");
  assert(unknownPreview.validationMode === "unknown", `Unexpected unknown Store validation mode: ${unknownPreview.validationMode}`);
  assert(unknownPreview.applied === false && unknownPreview.saveWritten === false, "Unknown Store preview reported writes.");

  const writeGateDefault = getStoreWriteEnvGate("verified-player-a", "attachment:cargoPod", {});
  assert(writeGateDefault.writeEnabled === false && writeGateDefault.dryRun === true, "Store write gate default was not safe.");
  assert(writeGateDefault.itemAllowed === true, "Cargo Pod should be the default allowed Store write item.");

  const validSaveData = {
    credits: 1000,
    ownedAttachments: { cargoPod: 1, shieldBooster: 2 },
    ownedGuns: { pulseLaser: 1 },
    ownedShips: ["lupenOrigin"],
    shipLoadouts: { lupenOrigin: { attachments: ["shieldBooster"], guns: ["pulseLaser"] } },
    inventoryItems: [{ id: "kept-item", key: "cargoPod", quality: "rare" }],
    cargo: { Iron: 2 },
    cargoCostBasis: { Iron: 12 },
    playerProgress: { combatXp: 33, totals: { tradesCompleted: 4 } },
    activeBountyId: "keep-bounty",
    marker: { keep: true }
  };
  const cargoPodItem = items.find((item) => item.itemId === "attachment:cargoPod");
  const pulseLaserItem = items.find((item) => item.itemId === "gun:pulseLaser");
  const haulerItem = items.find((item) => item.itemId === "ship:lupenHauler");
  const patchPlan = buildStagingStorePurchasePatch(validSaveData, cargoPodItem, 1);
  assert(patchPlan.ok === true, `Valid Cargo Pod Store patch was blocked: ${patchPlan.blockReason}`);
  assert(patchPlan.creditsBefore === 1000 && patchPlan.creditsAfter === 780, "Cargo Pod Store patch did not subtract the server price.");
  assert(patchPlan.itemBefore === 1 && patchPlan.itemAfter === 2, "Cargo Pod Store patch did not increment ownedAttachments.cargoPod.");
  assert(patchPlan.patchedSaveData.ownedAttachments.shieldBooster === 2, "Cargo Pod Store patch changed unrelated attachment ownership.");
  assert(patchPlan.patchedSaveData.inventoryItems[0].id === "kept-item", "Cargo Pod Store patch changed inventoryItems.");
  assert(patchPlan.patchedSaveData.shipLoadouts.lupenOrigin.attachments[0] === "shieldBooster", "Cargo Pod Store patch changed shipLoadouts.");
  assert(patchPlan.patchedSaveData.ownedGuns.pulseLaser === 1, "Cargo Pod Store patch changed weapon ownership.");
  assert(patchPlan.patchedSaveData.cargo.Iron === 2, "Cargo Pod Store patch changed trade cargo.");
  assert(patchPlan.patchedSaveData.playerProgress.combatXp === 33, "Cargo Pod Store patch changed progression.");
  assert(patchPlan.patchedSaveData.activeBountyId === "keep-bounty", "Cargo Pod Store patch changed bounty state.");
  assert(patchPlan.patchedSaveData.marker.keep === true, "Cargo Pod Store patch changed unrelated fields.");

  const pulseLaserPatch = buildStagingStorePurchasePatch(validSaveData, pulseLaserItem, 1);
  assert(pulseLaserPatch.ok === true, `Valid Pulse Laser Store patch was blocked: ${pulseLaserPatch.blockReason}`);
  assert(pulseLaserPatch.creditsBefore === 1000 && pulseLaserPatch.creditsAfter === 252, "Pulse Laser Store patch did not subtract the server price.");
  assert(pulseLaserPatch.itemBefore === 1 && pulseLaserPatch.itemAfter === 2, "Pulse Laser Store patch did not increment ownedGuns.pulseLaser.");
  assert(pulseLaserPatch.patchedSaveData.ownedAttachments.cargoPod === 1, "Pulse Laser Store patch changed attachment ownership.");
  assert(pulseLaserPatch.patchedSaveData.shipLoadouts.lupenOrigin.guns[0] === "pulseLaser", "Pulse Laser Store patch changed shipLoadouts.");
  assert(pulseLaserPatch.patchedSaveData.inventoryItems[0].id === "kept-item", "Pulse Laser Store patch changed inventoryItems.");
  assert(pulseLaserPatch.patchedSaveData.playerProgress.combatXp === 33, "Pulse Laser Store patch changed progression.");

  const shieldBoosterItem = items.find((item) => item.itemId === "attachment:shieldBooster");
  const shieldBoosterPatch = buildStagingStorePurchasePatch(validSaveData, shieldBoosterItem, 1);
  assert(shieldBoosterPatch.ok === true, `Valid Shield Booster Store patch was blocked: ${shieldBoosterPatch.blockReason}`);
  assert(shieldBoosterPatch.creditsBefore === 1000 && shieldBoosterPatch.creditsAfter === 690, "Shield Booster Store patch did not subtract the server price.");
  assert(shieldBoosterPatch.itemBefore === 2 && shieldBoosterPatch.itemAfter === 3, "Shield Booster Store patch did not increment ownedAttachments.shieldBooster.");
  assert(shieldBoosterPatch.patchedSaveData.ownedAttachments.cargoPod === 1, "Shield Booster Store patch changed Cargo Pod ownership.");
  assert(shieldBoosterPatch.patchedSaveData.shipLoadouts.lupenOrigin.attachments[0] === "shieldBooster", "Shield Booster Store patch changed shipLoadouts.");
  assert(shieldBoosterPatch.patchedSaveData.ownedGuns.pulseLaser === 1, "Shield Booster Store patch changed weapon ownership.");
  assert(shieldBoosterPatch.patchedSaveData.cargo.Iron === 2, "Shield Booster Store patch changed trade cargo.");
  assert(shieldBoosterPatch.patchedSaveData.playerProgress.combatXp === 33, "Shield Booster Store patch changed progression.");

  const haulerSaveData = { ...validSaveData, credits: 11000 };
  const haulerPatch = buildStagingStorePurchasePatch(haulerSaveData, haulerItem, 1);
  assert(haulerPatch.ok === true, `Valid LF-2 Hauler Store patch was blocked: ${haulerPatch.blockReason}`);
  assert(haulerPatch.creditsBefore === 11000 && haulerPatch.creditsAfter === 500, "LF-2 Hauler Store patch did not subtract the server price.");
  assert(haulerPatch.itemBefore === 1 && haulerPatch.itemAfter === 2, "LF-2 Hauler Store patch did not append ownedShips.");
  assert(haulerPatch.patchedSaveData.ownedShips.includes("lupenHauler"), "LF-2 Hauler Store patch did not add the ship.");
  assert(haulerPatch.patchedSaveData.shipLoadouts.lupenOrigin.attachments[0] === "shieldBooster", "LF-2 Hauler Store patch changed loadouts.");
  assert(haulerPatch.patchedSaveData.ownedAttachments.cargoPod === 1, "LF-2 Hauler Store patch changed attachments.");
  assert(haulerPatch.patchedSaveData.ownedGuns.pulseLaser === 1, "LF-2 Hauler Store patch changed weapons.");
  assert(haulerPatch.patchedSaveData.inventoryItems[0].id === "kept-item", "LF-2 Hauler Store patch changed inventoryItems.");
  assert(haulerPatch.patchedSaveData.cargo.Iron === 2, "LF-2 Hauler Store patch changed trade cargo.");
  assert(haulerPatch.patchedSaveData.playerProgress.combatXp === 33, "LF-2 Hauler Store patch changed progression.");
  assert(haulerPatch.shipWritten === false && haulerPatch.saveWritten === false, "LF-2 Hauler dry-run plan reported writes.");

  const alreadyOwnedHaulerPatch = buildStagingStorePurchasePatch({ ...haulerSaveData, ownedShips: ["lupenOrigin", "lupenHauler"] }, haulerItem, 1);
  assert(alreadyOwnedHaulerPatch.ok === false && alreadyOwnedHaulerPatch.blockReason === "ship_already_owned", "Already-owned LF-2 Hauler purchase was not blocked.");

  const invalidQuantityPatch = buildStagingStorePurchasePatch(validSaveData, cargoPodItem, 2);
  assert(invalidQuantityPatch.ok === false && invalidQuantityPatch.blockReason === "invalid_store_quantity", "Quantity above one was not blocked.");

  const insufficientCreditPatch = buildStagingStorePurchasePatch({ ...validSaveData, credits: 10 }, cargoPodItem, 1);
  assert(insufficientCreditPatch.ok === false && insufficientCreditPatch.blockReason === "insufficient_credits", "Insufficient-credit Cargo Pod write was not blocked.");

  const insufficientPulseLaserCreditPatch = buildStagingStorePurchasePatch({ ...validSaveData, credits: 10 }, pulseLaserItem, 1);
  assert(insufficientPulseLaserCreditPatch.ok === false && insufficientPulseLaserCreditPatch.blockReason === "insufficient_credits", "Insufficient-credit Pulse Laser write was not blocked.");

  const insufficientShieldBoosterCreditPatch = buildStagingStorePurchasePatch({ ...validSaveData, credits: 10 }, shieldBoosterItem, 1);
  assert(insufficientShieldBoosterCreditPatch.ok === false && insufficientShieldBoosterCreditPatch.blockReason === "insufficient_credits", "Insufficient-credit Shield Booster write was not blocked.");

  const insufficientHaulerCreditPatch = buildStagingStorePurchasePatch({ ...validSaveData, credits: 10 }, haulerItem, 1);
  assert(insufficientHaulerCreditPatch.ok === false && insufficientHaulerCreditPatch.blockReason === "insufficient_credits", "Insufficient-credit LF-2 Hauler write was not blocked.");

  const defaultWrite = await applyStagingStorePurchaseWrite({
    playerId: "verified-player-a",
    itemId: "attachment:cargoPod",
    quantity: 1,
    trustedState: {
      available: true,
      validationState: { credits: 1000 }
    },
    env: {},
    fetchImpl: async () => {
      throw new Error("Store write default should not fetch.");
    }
  });
  assert(defaultWrite.applied === false && defaultWrite.blockReason === "staging_store_writes_disabled", "Default Store write did not fail closed.");
  assert(defaultWrite.saveWritten === false, "Default Store write reported save write.");

  const dryRunWrite = await applyStagingStorePurchaseWrite({
    playerId: "verified-player-a",
    itemId: "attachment:cargoPod",
    quantity: 1,
    trustedState: {
      available: true,
      validationState: { credits: 1000 }
    },
    env: {
      STAGING_STORE_WRITE_ENABLED: "true",
      STAGING_STORE_WRITE_DRY_RUN: "true",
      STAGING_STORE_WRITE_SCOPE: "verified"
    },
    fetchImpl: async () => {
      throw new Error("Store write dry-run should not fetch.");
    }
  });
  assert(dryRunWrite.applied === false && dryRunWrite.blockReason === "staging_store_dry_run_enabled", "Dry-run Store write did not skip safely.");

  const unverifiedWrite = await applyStagingStorePurchaseWrite({
    playerId: "",
    itemId: "attachment:cargoPod",
    quantity: 1,
    trustedState: {
      available: true,
      validationState: { credits: 1000 }
    },
    env: {
      STAGING_STORE_WRITE_ENABLED: "true",
      STAGING_STORE_WRITE_DRY_RUN: "false",
      STAGING_STORE_WRITE_SCOPE: "verified"
    }
  });
  assert(unverifiedWrite.blockReason === "verified_identity_required", "Unverified Store write was not blocked.");

  const notAllowlistedWrite = await applyStagingStorePurchaseWrite({
    playerId: "verified-player-a",
    itemId: "attachment:cargoPod",
    quantity: 1,
    trustedState: {
      available: true,
      validationState: { credits: 1000 }
    },
    env: {
      STAGING_STORE_WRITE_ENABLED: "true",
      STAGING_STORE_WRITE_DRY_RUN: "false",
      STAGING_STORE_WRITE_SCOPE: "allowlist",
      STAGING_STORE_WRITE_ALLOWLIST: "somebody-else"
    }
  });
  assert(notAllowlistedWrite.blockReason === "player_not_in_staging_store_write_allowlist", "Non-allowlisted Store write was not blocked.");

  const shieldItemNotAllowedWrite = await applyStagingStorePurchaseWrite({
    playerId: "verified-player-a",
    itemId: "attachment:shieldBooster",
    quantity: 1,
    trustedState: {
      available: true,
      validationState: { credits: 1000 }
    },
    env: {
      STAGING_STORE_WRITE_ENABLED: "true",
      STAGING_STORE_WRITE_DRY_RUN: "false",
      STAGING_STORE_WRITE_SCOPE: "verified",
      STAGING_STORE_WRITE_ALLOWED_ITEMS: "attachment:cargoPod"
    }
  });
  assert(shieldItemNotAllowedWrite.blockReason === "store_item_not_allowed", "Shield Booster Store write without item allowlist was not blocked.");

  let sequentialSave = JSON.parse(JSON.stringify(validSaveData));
  const storeFetchCalls = [];
  const appliedWrite = await applyStagingStorePurchaseWrite({
    playerId: "verified-player-a",
    itemId: "attachment:cargoPod",
    quantity: 1,
    trustedState: {
      available: true,
      validationState: { credits: 1000 }
    },
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key",
      STAGING_STORE_WRITE_ENABLED: "true",
      STAGING_STORE_WRITE_DRY_RUN: "false",
      STAGING_STORE_WRITE_SCOPE: "allowlist",
      STAGING_STORE_WRITE_ALLOWLIST: "verified-player-a",
      STAGING_STORE_WRITE_ALLOWED_ITEMS: "attachment:cargoPod"
    },
    fetchImpl: async (url, options = {}) => {
      storeFetchCalls.push(options.method || "GET");
      assert(options.headers?.apikey === "stub-service-key", "Store write did not use service role apikey.");
      assert(options.headers?.Authorization === "Bearer stub-service-key", "Store write did not use service role bearer.");
      if ((options.method || "GET") === "GET") {
        assert(url === "https://example.supabase.co/rest/v1/player_saves?user_id=eq.verified-player-a&select=save_data,updated_at&limit=1", `Unexpected Store read URL: ${url}`);
        return {
          ok: true,
          status: 200,
          json: async () => [{ save_data: sequentialSave }]
        };
      }
      assert(options.method === "PATCH", "Store write expected PATCH after read.");
      assert(url === "https://example.supabase.co/rest/v1/player_saves?user_id=eq.verified-player-a", `Unexpected Store PATCH URL: ${url}`);
      const body = JSON.parse(options.body || "{}");
      sequentialSave = body.save_data;
      return { ok: true, status: 204, json: async () => [] };
    }
  });
  assert(appliedWrite.applied === true && appliedWrite.mode === "store_write", `Gated Cargo Pod Store write did not apply: ${appliedWrite.blockReason}`);
  assert(appliedWrite.creditsBefore === 1000 && appliedWrite.creditsAfter === 780, "Applied Store write returned incorrect credits.");
  assert(appliedWrite.itemBefore === 1 && appliedWrite.itemAfter === 2, "Applied Store write returned incorrect Cargo Pod count.");
  assert(appliedWrite.creditsWritten === true && appliedWrite.attachmentWritten === true && appliedWrite.saveWritten === true, "Applied Store write did not report allowed writes.");
  assert(appliedWrite.inventoryWritten === false && appliedWrite.shipWritten === false && appliedWrite.weaponWritten === false, "Applied Store write reported forbidden writes.");
  assert(sequentialSave.credits === 780 && sequentialSave.ownedAttachments.cargoPod === 2, "Applied Store write did not update mocked save state.");
  assert(sequentialSave.inventoryItems[0].id === "kept-item", "Applied Store write changed inventoryItems.");
  assert(sequentialSave.shipLoadouts.lupenOrigin.attachments[0] === "shieldBooster", "Applied Store write changed shipLoadouts.");
  assert(sequentialSave.ownedGuns.pulseLaser === 1, "Applied Store write changed weapon ownership.");
  assert(sequentialSave.cargo.Iron === 2 && sequentialSave.cargoCostBasis.Iron === 12, "Applied Store write changed trade cargo.");
  assert(sequentialSave.playerProgress.combatXp === 33, "Applied Store write changed progression.");
  assert(sequentialSave.activeBountyId === "keep-bounty", "Applied Store write changed bounty state.");
  assert(storeFetchCalls.join(",") === "GET,PATCH", `Store write expected read/write pair, got ${storeFetchCalls.join(",")}.`);

  let weaponSave = JSON.parse(JSON.stringify(validSaveData));
  const weaponFetchCalls = [];
  const appliedWeaponWrite = await applyStagingStorePurchaseWrite({
    playerId: "verified-player-a",
    itemId: "gun:pulseLaser",
    quantity: 1,
    trustedState: {
      available: true,
      validationState: { credits: 1000 }
    },
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key",
      STAGING_STORE_WRITE_ENABLED: "true",
      STAGING_STORE_WRITE_DRY_RUN: "false",
      STAGING_STORE_WRITE_SCOPE: "allowlist",
      STAGING_STORE_WRITE_ALLOWLIST: "verified-player-a",
      STAGING_STORE_WRITE_ALLOWED_ITEMS: "gun:pulseLaser"
    },
    fetchImpl: async (_url, options = {}) => {
      weaponFetchCalls.push(options.method || "GET");
      if ((options.method || "GET") === "GET") return { ok: true, status: 200, json: async () => [{ save_data: weaponSave }] };
      weaponSave = JSON.parse(options.body || "{}").save_data;
      return { ok: true, status: 204, json: async () => [] };
    }
  });
  assert(appliedWeaponWrite.applied === true && appliedWeaponWrite.mode === "store_write", `Gated Pulse Laser Store write did not apply: ${appliedWeaponWrite.blockReason}`);
  assert(appliedWeaponWrite.creditsBefore === 1000 && appliedWeaponWrite.creditsAfter === 252, "Applied Pulse Laser Store write returned incorrect credits.");
  assert(appliedWeaponWrite.itemBefore === 1 && appliedWeaponWrite.itemAfter === 2, "Applied Pulse Laser Store write returned incorrect weapon count.");
  assert(appliedWeaponWrite.creditsWritten === true && appliedWeaponWrite.weaponWritten === true && appliedWeaponWrite.saveWritten === true, "Applied Pulse Laser Store write did not report allowed writes.");
  assert(appliedWeaponWrite.attachmentWritten === false && appliedWeaponWrite.inventoryWritten === false && appliedWeaponWrite.shipWritten === false, "Applied Pulse Laser Store write reported forbidden writes.");
  assert(weaponSave.credits === 252 && weaponSave.ownedGuns.pulseLaser === 2, "Applied Pulse Laser Store write did not update mocked save state.");
  assert(weaponSave.ownedAttachments.cargoPod === 1, "Applied Pulse Laser Store write changed attachments.");
  assert(weaponSave.shipLoadouts.lupenOrigin.guns[0] === "pulseLaser", "Applied Pulse Laser Store write changed loadout.");
  assert(weaponSave.inventoryItems[0].id === "kept-item", "Applied Pulse Laser Store write changed inventoryItems.");
  assert(weaponSave.playerProgress.combatXp === 33, "Applied Pulse Laser Store write changed progression.");
  assert(weaponFetchCalls.join(",") === "GET,PATCH", `Pulse Laser Store write expected read/write pair, got ${weaponFetchCalls.join(",")}.`);

  let shieldSave = JSON.parse(JSON.stringify(validSaveData));
  const shieldFetchCalls = [];
  const appliedShieldWrite = await applyStagingStorePurchaseWrite({
    playerId: "verified-player-a",
    itemId: "attachment:shieldBooster",
    quantity: 1,
    trustedState: {
      available: true,
      validationState: { credits: 1000 }
    },
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key",
      STAGING_STORE_WRITE_ENABLED: "true",
      STAGING_STORE_WRITE_DRY_RUN: "false",
      STAGING_STORE_WRITE_SCOPE: "allowlist",
      STAGING_STORE_WRITE_ALLOWLIST: "verified-player-a",
      STAGING_STORE_WRITE_ALLOWED_ITEMS: "attachment:shieldBooster"
    },
    fetchImpl: async (_url, options = {}) => {
      shieldFetchCalls.push(options.method || "GET");
      if ((options.method || "GET") === "GET") return { ok: true, status: 200, json: async () => [{ save_data: shieldSave }] };
      shieldSave = JSON.parse(options.body || "{}").save_data;
      return { ok: true, status: 204, json: async () => [] };
    }
  });
  assert(appliedShieldWrite.applied === true && appliedShieldWrite.mode === "store_write", `Gated Shield Booster Store write did not apply: ${appliedShieldWrite.blockReason}`);
  assert(appliedShieldWrite.creditsBefore === 1000 && appliedShieldWrite.creditsAfter === 690, "Applied Shield Booster Store write returned incorrect credits.");
  assert(appliedShieldWrite.itemBefore === 2 && appliedShieldWrite.itemAfter === 3, "Applied Shield Booster Store write returned incorrect ownership count.");
  assert(appliedShieldWrite.creditsWritten === true && appliedShieldWrite.attachmentWritten === true && appliedShieldWrite.saveWritten === true, "Applied Shield Booster Store write did not report allowed writes.");
  assert(appliedShieldWrite.weaponWritten === false && appliedShieldWrite.inventoryWritten === false && appliedShieldWrite.shipWritten === false, "Applied Shield Booster Store write reported forbidden writes.");
  assert(shieldSave.credits === 690 && shieldSave.ownedAttachments.shieldBooster === 3, "Applied Shield Booster Store write did not update mocked save state.");
  assert(shieldSave.ownedAttachments.cargoPod === 1, "Applied Shield Booster Store write changed Cargo Pod ownership.");
  assert(shieldSave.shipLoadouts.lupenOrigin.attachments[0] === "shieldBooster", "Applied Shield Booster Store write changed loadout.");
  assert(shieldSave.ownedGuns.pulseLaser === 1, "Applied Shield Booster Store write changed weapon ownership.");
  assert(shieldSave.inventoryItems[0].id === "kept-item", "Applied Shield Booster Store write changed inventoryItems.");
  assert(shieldSave.playerProgress.combatXp === 33, "Applied Shield Booster Store write changed progression.");
  assert(shieldFetchCalls.join(",") === "GET,PATCH", `Shield Booster Store write expected read/write pair, got ${shieldFetchCalls.join(",")}.`);

  let haulerSave = JSON.parse(JSON.stringify({ ...validSaveData, credits: 11000 }));
  const haulerFetchCalls = [];
  const appliedHaulerWrite = await applyStagingStorePurchaseWrite({
    playerId: "verified-player-a",
    itemId: "ship:lupenHauler",
    quantity: 1,
    trustedState: {
      available: true,
      validationState: { credits: 11000 }
    },
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key",
      STAGING_STORE_WRITE_ENABLED: "true",
      STAGING_STORE_WRITE_DRY_RUN: "false",
      STAGING_STORE_WRITE_SCOPE: "allowlist",
      STAGING_STORE_WRITE_ALLOWLIST: "verified-player-a",
      STAGING_STORE_WRITE_ALLOWED_ITEMS: "ship:lupenHauler"
    },
    fetchImpl: async (_url, options = {}) => {
      haulerFetchCalls.push(options.method || "GET");
      if ((options.method || "GET") === "GET") return { ok: true, status: 200, json: async () => [{ save_data: haulerSave }] };
      haulerSave = JSON.parse(options.body || "{}").save_data;
      return { ok: true, status: 204, json: async () => [] };
    }
  });
  assert(appliedHaulerWrite.applied === true && appliedHaulerWrite.mode === "store_write", `Gated LF-2 Hauler Store write did not apply: ${appliedHaulerWrite.blockReason}`);
  assert(appliedHaulerWrite.creditsBefore === 11000 && appliedHaulerWrite.creditsAfter === 500, "Applied LF-2 Hauler Store write returned incorrect credits.");
  assert(appliedHaulerWrite.creditsWritten === true && appliedHaulerWrite.shipWritten === true && appliedHaulerWrite.saveWritten === true, "Applied LF-2 Hauler Store write did not report allowed writes.");
  assert(appliedHaulerWrite.inventoryWritten === false && appliedHaulerWrite.attachmentWritten === false && appliedHaulerWrite.weaponWritten === false, "Applied LF-2 Hauler Store write reported forbidden writes.");
  assert(haulerSave.credits === 500 && haulerSave.ownedShips.includes("lupenHauler"), "Applied LF-2 Hauler Store write did not update mocked save state.");
  assert(haulerSave.shipLoadouts.lupenOrigin.attachments[0] === "shieldBooster", "Applied LF-2 Hauler Store write changed loadout.");
  assert(haulerSave.ownedAttachments.cargoPod === 1, "Applied LF-2 Hauler Store write changed attachments.");
  assert(haulerSave.ownedGuns.pulseLaser === 1, "Applied LF-2 Hauler Store write changed weapons.");
  assert(haulerSave.inventoryItems[0].id === "kept-item", "Applied LF-2 Hauler Store write changed inventoryItems.");
  assert(haulerSave.playerProgress.combatXp === 33, "Applied LF-2 Hauler Store write changed progression.");
  assert(haulerFetchCalls.join(",") === "GET,PATCH", `LF-2 Hauler Store write expected read/write pair, got ${haulerFetchCalls.join(",")}.`);

  console.log("staging Store item list, previews, and gated Cargo Pod/Pulse Laser/Shield Booster/LF-2 Hauler write helpers passed");
}

async function assertStagingCargoPodEquipHelpers() {
  const validSaveData = {
    credits: 780,
    currentShipId: "lupenOrigin",
    ownedAttachments: { cargoPod: 2, shieldBooster: 1 },
    ownedGuns: { pulseLaser: 1 },
    ownedShips: ["lupenOrigin"],
    shipLoadouts: { lupenOrigin: { attachments: [{ key: "shieldBooster", quality: "standard", level: 1 }], guns: [{ key: "pulseLaser", quality: "standard", level: 1 }] } },
    inventoryItems: [{ id: "kept-item", key: "cargoPod", quality: "rare" }],
    cargo: { Iron: 2 },
    cargoCostBasis: { Iron: 12 },
    playerProgress: { combatXp: 33, totals: { tradesCompleted: 4 } },
    activeBountyId: "keep-bounty",
    marker: { keep: true }
  };

  const defaultGate = getLoadoutWriteEnvGate("verified-player-a", "attachment:cargoPod", {});
  assert(defaultGate.writeEnabled === false && defaultGate.dryRun === true, "Loadout write gate default was not safe.");
  assert(defaultGate.itemAllowed === true, "Cargo Pod should be default allowed loadout item.");

  const plan = buildStagingCargoPodEquipPlan(validSaveData, { itemId: "attachment:cargoPod" });
  assert(plan.ok === true, `Valid Cargo Pod equip plan was blocked: ${plan.blockReason}`);
  assert(plan.ownedBefore === 2 && plan.ownedAfter === 1, "Cargo Pod equip plan did not consume owned Cargo Pod.");
  assert(plan.equippedBefore === 0 && plan.equippedAfter === 1, "Cargo Pod equip plan did not add equipped Cargo Pod.");
  assert(plan.cargoCapacityBefore === 150 && plan.cargoCapacityAfter === 175, "Cargo Pod equip plan did not apply +25 cargo capacity.");
  assert(plan.patchedSaveData.credits === 780, "Cargo Pod equip plan changed credits.");
  assert(plan.patchedSaveData.inventoryItems[0].id === "kept-item", "Cargo Pod equip plan changed inventoryItems.");
  assert(plan.patchedSaveData.shipLoadouts.lupenOrigin.guns[0].key === "pulseLaser", "Cargo Pod equip plan changed guns.");
  assert(plan.patchedSaveData.ownedGuns.pulseLaser === 1, "Cargo Pod equip plan changed weapon ownership.");
  assert(plan.patchedSaveData.ownedShips[0] === "lupenOrigin", "Cargo Pod equip plan changed ships.");
  assert(plan.patchedSaveData.cargo.Iron === 2 && plan.patchedSaveData.cargoCostBasis.Iron === 12, "Cargo Pod equip plan changed trade cargo.");
  assert(plan.patchedSaveData.playerProgress.combatXp === 33, "Cargo Pod equip plan changed progression.");
  assert(plan.patchedSaveData.activeBountyId === "keep-bounty", "Cargo Pod equip plan changed bounty state.");

  const noOwnedPlan = buildStagingCargoPodEquipPlan({ ...validSaveData, ownedAttachments: { cargoPod: 0 } }, { itemId: "attachment:cargoPod" });
  assert(noOwnedPlan.ok === false && noOwnedPlan.blockReason === "cargo_pod_not_owned", "Cargo Pod equip without ownership was not blocked.");

  const fullSlotsPlan = buildStagingCargoPodEquipPlan({
    ...validSaveData,
    ownedAttachments: { cargoPod: 1 },
    shipLoadouts: {
      lupenOrigin: {
        attachments: [{ key: "shieldBooster" }, { key: "jumpDrive" }, { key: "evasionMatrix" }],
        guns: [{ key: "pulseLaser" }]
      }
    }
  }, { itemId: "attachment:cargoPod" });
  assert(fullSlotsPlan.ok === false && fullSlotsPlan.blockReason === "attachment_slots_full", "Cargo Pod equip with full slots was not blocked.");

  const unknownPlan = buildStagingCargoPodEquipPlan(validSaveData, { itemId: "attachment:shieldBooster" });
  assert(unknownPlan.ok === false && unknownPlan.blockReason === "unknown_loadout_item", "Non-Cargo Pod loadout item was not blocked.");

  const shieldPlan = buildStagingShieldBoosterEquipPlan(validSaveData, { itemId: "attachment:shieldBooster" });
  assert(shieldPlan.ok === true, `Valid Shield Booster equip plan was blocked: ${shieldPlan.blockReason}`);
  assert(shieldPlan.ownedBefore === 1 && shieldPlan.ownedAfter === 0, "Shield Booster equip plan did not consume owned Shield Booster.");
  assert(shieldPlan.equippedBefore === 1 && shieldPlan.equippedAfter === 2, "Shield Booster equip plan did not add equipped Shield Booster.");
  assert(shieldPlan.shieldBefore === 150 && shieldPlan.shieldAfter === 200, "Shield Booster equip plan did not apply +50 shield.");
  assert(shieldPlan.patchedSaveData.credits === 780, "Shield Booster equip plan changed credits.");
  assert(shieldPlan.patchedSaveData.ownedAttachments.cargoPod === 2, "Shield Booster equip plan changed Cargo Pod ownership.");
  assert(shieldPlan.patchedSaveData.shipLoadouts.lupenOrigin.guns[0].key === "pulseLaser", "Shield Booster equip plan changed guns.");
  assert(shieldPlan.patchedSaveData.ownedGuns.pulseLaser === 1, "Shield Booster equip plan changed weapon ownership.");
  assert(shieldPlan.patchedSaveData.inventoryItems[0].id === "kept-item", "Shield Booster equip plan changed inventoryItems.");
  assert(shieldPlan.patchedSaveData.cargo.Iron === 2, "Shield Booster equip plan changed trade cargo.");
  assert(shieldPlan.patchedSaveData.playerProgress.combatXp === 33, "Shield Booster equip plan changed progression.");

  const noOwnedShieldPlan = buildStagingShieldBoosterEquipPlan({ ...validSaveData, ownedAttachments: { cargoPod: 2, shieldBooster: 0 } }, { itemId: "attachment:shieldBooster" });
  assert(noOwnedShieldPlan.ok === false && noOwnedShieldPlan.blockReason === "shield_booster_not_owned", "Shield Booster equip without ownership was not blocked.");

  const pulseLaserPlan = buildStagingPulseLaserEquipPlan(validSaveData, { itemId: "gun:pulseLaser" });
  assert(pulseLaserPlan.ok === true, `Valid Pulse Laser equip plan was blocked: ${pulseLaserPlan.blockReason}`);
  assert(pulseLaserPlan.ownedBefore === 1 && pulseLaserPlan.ownedAfter === 0, "Pulse Laser equip plan did not consume owned weapon.");
  assert(pulseLaserPlan.equippedBefore === 1 && pulseLaserPlan.equippedAfter === 2, "Pulse Laser equip plan did not add equipped weapon.");
  assert(pulseLaserPlan.gunSlots === 2, "Pulse Laser equip plan reported unexpected gun slots.");
  assert(pulseLaserPlan.patchedSaveData.credits === 780, "Pulse Laser equip plan changed credits.");
  assert(pulseLaserPlan.patchedSaveData.ownedAttachments.cargoPod === 2, "Pulse Laser equip plan changed attachment ownership.");
  assert(pulseLaserPlan.patchedSaveData.shipLoadouts.lupenOrigin.attachments[0].key === "shieldBooster", "Pulse Laser equip plan changed attachments.");
  assert(pulseLaserPlan.patchedSaveData.inventoryItems[0].id === "kept-item", "Pulse Laser equip plan changed inventoryItems.");
  assert(pulseLaserPlan.patchedSaveData.playerProgress.combatXp === 33, "Pulse Laser equip plan changed progression.");

  const noOwnedWeaponPlan = buildStagingPulseLaserEquipPlan({ ...validSaveData, ownedGuns: { pulseLaser: 0 } }, { itemId: "gun:pulseLaser" });
  assert(noOwnedWeaponPlan.ok === false && noOwnedWeaponPlan.blockReason === "pulse_laser_not_owned", "Pulse Laser equip without ownership was not blocked.");

  const pulseLaserUnequipPlan = buildStagingLoadoutUnequipPlan({
    ...validSaveData,
    ownedGuns: { pulseLaser: 0 },
    shipLoadouts: {
      lupenOrigin: {
        attachments: [{ key: "shieldBooster", quality: "standard", level: 1 }],
        guns: [{ key: "pulseLaser", quality: "standard", level: 1 }]
      }
    }
  }, { itemId: "gun:pulseLaser" });
  assert(pulseLaserUnequipPlan.ok === true, `Valid Pulse Laser unequip plan was blocked: ${pulseLaserUnequipPlan.blockReason}`);
  assert(pulseLaserUnequipPlan.operation === "unequip", "Pulse Laser unequip plan did not report unequip operation.");
  assert(pulseLaserUnequipPlan.ownedBefore === 0 && pulseLaserUnequipPlan.ownedAfter === 1, "Pulse Laser unequip plan did not restore available ownership.");
  assert(pulseLaserUnequipPlan.equippedBefore === 1 && pulseLaserUnequipPlan.equippedAfter === 0, "Pulse Laser unequip plan did not remove equipped weapon.");
  assert(pulseLaserUnequipPlan.patchedSaveData.shipLoadouts.lupenOrigin.guns.length === 0, "Pulse Laser unequip plan left weapon equipped.");
  assert(pulseLaserUnequipPlan.patchedSaveData.ownedGuns.pulseLaser === 1, "Pulse Laser unequip plan did not increment owned weapon.");
  assert(pulseLaserUnequipPlan.patchedSaveData.credits === 780, "Pulse Laser unequip plan changed credits.");
  assert(pulseLaserUnequipPlan.patchedSaveData.inventoryItems[0].id === "kept-item", "Pulse Laser unequip plan changed inventoryItems.");
  assert(pulseLaserUnequipPlan.patchedSaveData.cargo.Iron === 2, "Pulse Laser unequip plan changed trade cargo.");
  assert(pulseLaserUnequipPlan.patchedSaveData.playerProgress.combatXp === 33, "Pulse Laser unequip plan changed progression.");

  const cargoPodUnequipPlan = buildStagingLoadoutUnequipPlan({
    ...validSaveData,
    ownedAttachments: { cargoPod: 0, shieldBooster: 1 },
    shipLoadouts: {
      lupenOrigin: {
        attachments: [{ key: "cargoPod", quality: "standard", level: 1 }, { key: "shieldBooster", quality: "standard", level: 1 }],
        guns: [{ key: "pulseLaser", quality: "standard", level: 1 }]
      }
    }
  }, { itemId: "attachment:cargoPod" });
  assert(cargoPodUnequipPlan.ok === true, `Valid Cargo Pod unequip plan was blocked: ${cargoPodUnequipPlan.blockReason}`);
  assert(cargoPodUnequipPlan.ownedBefore === 0 && cargoPodUnequipPlan.ownedAfter === 1, "Cargo Pod unequip plan did not restore available ownership.");
  assert(cargoPodUnequipPlan.equippedBefore === 1 && cargoPodUnequipPlan.equippedAfter === 0, "Cargo Pod unequip plan did not remove equipped attachment.");
  assert(cargoPodUnequipPlan.cargoCapacityBefore === 175 && cargoPodUnequipPlan.cargoCapacityAfter === 150, "Cargo Pod unequip plan did not remove +25 cargo capacity.");
  assert(cargoPodUnequipPlan.patchedSaveData.shipLoadouts.lupenOrigin.attachments.every((entry) => entry.key !== "cargoPod"), "Cargo Pod unequip plan left Cargo Pod equipped.");
  assert(cargoPodUnequipPlan.patchedSaveData.ownedAttachments.cargoPod === 1, "Cargo Pod unequip plan did not increment owned Cargo Pod.");
  assert(cargoPodUnequipPlan.patchedSaveData.ownedGuns.pulseLaser === 1, "Cargo Pod unequip plan changed weapon ownership.");
  assert(cargoPodUnequipPlan.patchedSaveData.playerProgress.combatXp === 33, "Cargo Pod unequip plan changed progression.");

  const notEquippedWeaponPlan = buildStagingLoadoutUnequipPlan({
    ...validSaveData,
    ownedGuns: { pulseLaser: 1 },
    shipLoadouts: { lupenOrigin: { attachments: [{ key: "shieldBooster" }], guns: [] } }
  }, { itemId: "gun:pulseLaser" });
  assert(notEquippedWeaponPlan.ok === false && notEquippedWeaponPlan.blockReason === "pulse_laser_not_equipped", "Pulse Laser unequip without equipped weapon was not blocked.");

  const fullGunSlotsPlan = buildStagingPulseLaserEquipPlan({
    ...validSaveData,
    ownedGuns: { pulseLaser: 1 },
    shipLoadouts: {
      lupenOrigin: {
        attachments: [{ key: "shieldBooster" }],
        guns: [{ key: "pulseLaser" }, { key: "heavyPulseLaser" }]
      }
    }
  }, { itemId: "gun:pulseLaser" });
  assert(fullGunSlotsPlan.ok === false && fullGunSlotsPlan.blockReason === "gun_slots_full", "Pulse Laser equip with full slots was not blocked.");

  const haulerSelectPlan = buildStagingLupenHaulerSelectPlan({
    ...validSaveData,
    ownedShips: ["lupenOrigin", "lupenHauler"],
    selectedHangarShipId: "lupenOrigin",
    selectedFleetShipId: "lupenOrigin"
  }, { itemId: "ship:lupenHauler" });
  assert(haulerSelectPlan.ok === true, `Valid LF-2 Hauler select plan was blocked: ${haulerSelectPlan.blockReason}`);
  assert(haulerSelectPlan.selectedShipBefore === "lupenOrigin" && haulerSelectPlan.selectedShipAfter === "lupenHauler", "LF-2 Hauler select plan did not report ship change.");
  assert(haulerSelectPlan.cargoCapacityBefore === 150 && haulerSelectPlan.cargoCapacityAfter === 260, "LF-2 Hauler select plan did not report cargo capacity change.");
  assert(haulerSelectPlan.patchedSaveData.currentShipId === "lupenHauler", "LF-2 Hauler select plan did not set currentShipId.");
  assert(haulerSelectPlan.patchedSaveData.selectedHangarShipId === "lupenHauler", "LF-2 Hauler select plan did not set selectedHangarShipId.");
  assert(haulerSelectPlan.patchedSaveData.selectedFleetShipId === "lupenHauler", "LF-2 Hauler select plan did not set selectedFleetShipId.");
  assert(haulerSelectPlan.patchedSaveData.credits === 780, "LF-2 Hauler select plan changed credits.");
  assert(haulerSelectPlan.patchedSaveData.ownedShips.length === 2, "LF-2 Hauler select plan changed ship ownership.");
  assert(haulerSelectPlan.patchedSaveData.shipLoadouts.lupenOrigin.guns[0].key === "pulseLaser", "LF-2 Hauler select plan changed loadouts.");
  assert(haulerSelectPlan.patchedSaveData.ownedAttachments.cargoPod === 2, "LF-2 Hauler select plan changed attachment ownership.");
  assert(haulerSelectPlan.patchedSaveData.ownedGuns.pulseLaser === 1, "LF-2 Hauler select plan changed weapon ownership.");
  assert(haulerSelectPlan.patchedSaveData.inventoryItems[0].id === "kept-item", "LF-2 Hauler select plan changed inventoryItems.");
  assert(haulerSelectPlan.patchedSaveData.playerProgress.combatXp === 33, "LF-2 Hauler select plan changed progression.");

  const haulerNotOwnedPlan = buildStagingLupenHaulerSelectPlan(validSaveData, { itemId: "ship:lupenHauler" });
  assert(haulerNotOwnedPlan.ok === false && haulerNotOwnedPlan.blockReason === "ship_not_owned", "LF-2 Hauler select without ownership was not blocked.");

  const haulerAlreadyActivePlan = buildStagingLupenHaulerSelectPlan({
    ...validSaveData,
    currentShipId: "lupenHauler",
    ownedShips: ["lupenOrigin", "lupenHauler"]
  }, { itemId: "ship:lupenHauler" });
  assert(haulerAlreadyActivePlan.ok === false && haulerAlreadyActivePlan.blockReason === "ship_already_equipped", "Already-active LF-2 Hauler select was not blocked.");

  const defaultWrite = await applyStagingCargoPodEquipWrite({
    playerId: "verified-player-a",
    itemId: "attachment:cargoPod",
    trustedState: { available: true, validationState: { credits: 780 } },
    env: {},
    fetchImpl: async () => {
      throw new Error("Loadout write default should not fetch.");
    }
  });
  assert(defaultWrite.applied === false && defaultWrite.blockReason === "staging_loadout_writes_disabled", "Default Cargo Pod equip write did not fail closed.");
  assert(defaultWrite.saveWritten === false, "Default Cargo Pod equip reported save write.");

  const dryRunWrite = await applyStagingCargoPodEquipWrite({
    playerId: "verified-player-a",
    itemId: "attachment:cargoPod",
    trustedState: { available: true, validationState: { credits: 780 } },
    env: {
      STAGING_LOADOUT_WRITE_ENABLED: "true",
      STAGING_LOADOUT_WRITE_DRY_RUN: "true",
      STAGING_LOADOUT_WRITE_SCOPE: "verified"
    },
    fetchImpl: async () => {
      throw new Error("Loadout dry-run should not fetch.");
    }
  });
  assert(dryRunWrite.applied === false && dryRunWrite.blockReason === "staging_loadout_dry_run_enabled", "Dry-run Cargo Pod equip did not skip safely.");

  const notAllowlistedWrite = await applyStagingCargoPodEquipWrite({
    playerId: "verified-player-a",
    itemId: "attachment:cargoPod",
    trustedState: { available: true, validationState: { credits: 780 } },
    env: {
      STAGING_LOADOUT_WRITE_ENABLED: "true",
      STAGING_LOADOUT_WRITE_DRY_RUN: "false",
      STAGING_LOADOUT_WRITE_SCOPE: "allowlist",
      STAGING_LOADOUT_WRITE_ALLOWLIST: "somebody-else"
    }
  });
  assert(notAllowlistedWrite.blockReason === "player_not_in_staging_loadout_write_allowlist", "Non-allowlisted Cargo Pod equip was not blocked.");

  const shieldLoadoutItemNotAllowed = await applyStagingLoadoutEquipWrite({
    playerId: "verified-player-a",
    itemId: "attachment:shieldBooster",
    trustedState: { available: true, validationState: { credits: 780 } },
    env: {
      STAGING_LOADOUT_WRITE_ENABLED: "true",
      STAGING_LOADOUT_WRITE_DRY_RUN: "false",
      STAGING_LOADOUT_WRITE_SCOPE: "verified",
      STAGING_LOADOUT_WRITE_ALLOWED_ITEMS: "attachment:cargoPod"
    }
  });
  assert(shieldLoadoutItemNotAllowed.blockReason === "loadout_item_not_allowed", "Shield Booster loadout write without item allowlist was not blocked.");

  let sequentialSave = JSON.parse(JSON.stringify(validSaveData));
  const fetchCalls = [];
  const appliedWrite = await applyStagingCargoPodEquipWrite({
    playerId: "verified-player-a",
    itemId: "attachment:cargoPod",
    trustedState: { available: true, validationState: { credits: 780 } },
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key",
      STAGING_LOADOUT_WRITE_ENABLED: "true",
      STAGING_LOADOUT_WRITE_DRY_RUN: "false",
      STAGING_LOADOUT_WRITE_SCOPE: "allowlist",
      STAGING_LOADOUT_WRITE_ALLOWLIST: "verified-player-a",
      STAGING_LOADOUT_WRITE_ALLOWED_ITEMS: "attachment:cargoPod"
    },
    fetchImpl: async (url, options = {}) => {
      fetchCalls.push(options.method || "GET");
      assert(options.headers?.apikey === "stub-service-key", "Loadout write did not use service role apikey.");
      assert(options.headers?.Authorization === "Bearer stub-service-key", "Loadout write did not use service role bearer.");
      if ((options.method || "GET") === "GET") {
        assert(url === "https://example.supabase.co/rest/v1/player_saves?user_id=eq.verified-player-a&select=save_data,updated_at&limit=1", `Unexpected Loadout read URL: ${url}`);
        return { ok: true, status: 200, json: async () => [{ save_data: sequentialSave }] };
      }
      assert(options.method === "PATCH", "Loadout write expected PATCH after read.");
      assert(url === "https://example.supabase.co/rest/v1/player_saves?user_id=eq.verified-player-a", `Unexpected Loadout PATCH URL: ${url}`);
      sequentialSave = JSON.parse(options.body || "{}").save_data;
      return { ok: true, status: 204, json: async () => [] };
    }
  });
  assert(appliedWrite.applied === true && appliedWrite.mode === "loadout_write", `Gated Cargo Pod equip did not apply: ${appliedWrite.blockReason}`);
  assert(appliedWrite.ownedBefore === 2 && appliedWrite.ownedAfter === 1, "Applied Cargo Pod equip returned incorrect ownership.");
  assert(appliedWrite.equippedBefore === 0 && appliedWrite.equippedAfter === 1, "Applied Cargo Pod equip returned incorrect equipped count.");
  assert(appliedWrite.cargoCapacityBefore === 150 && appliedWrite.cargoCapacityAfter === 175, "Applied Cargo Pod equip returned incorrect capacity.");
  assert(appliedWrite.loadoutWritten === true && appliedWrite.attachmentWritten === true && appliedWrite.saveWritten === true, "Applied Cargo Pod equip did not report allowed writes.");
  assert(appliedWrite.creditsWritten === false && appliedWrite.inventoryWritten === false && appliedWrite.shipWritten === false && appliedWrite.weaponWritten === false, "Applied Cargo Pod equip reported forbidden writes.");
  assert(sequentialSave.credits === 780, "Applied Cargo Pod equip changed credits.");
  assert(sequentialSave.ownedAttachments.cargoPod === 1, "Applied Cargo Pod equip did not decrement owned Cargo Pod.");
  assert(sequentialSave.shipLoadouts.lupenOrigin.attachments.some((entry) => entry.key === "cargoPod"), "Applied Cargo Pod equip did not add loadout entry.");
  assert(sequentialSave.inventoryItems[0].id === "kept-item", "Applied Cargo Pod equip changed inventoryItems.");
  assert(sequentialSave.ownedGuns.pulseLaser === 1, "Applied Cargo Pod equip changed weapon ownership.");
  assert(sequentialSave.cargo.Iron === 2, "Applied Cargo Pod equip changed trade cargo.");
  assert(sequentialSave.playerProgress.combatXp === 33, "Applied Cargo Pod equip changed progression.");
  assert(fetchCalls.join(",") === "GET,PATCH", `Loadout write expected read/write pair, got ${fetchCalls.join(",")}.`);

  let weaponLoadoutSave = JSON.parse(JSON.stringify(validSaveData));
  const weaponLoadoutFetchCalls = [];
  const appliedWeaponEquip = await applyStagingLoadoutEquipWrite({
    playerId: "verified-player-a",
    itemId: "gun:pulseLaser",
    trustedState: { available: true, validationState: { credits: 780 } },
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key",
      STAGING_LOADOUT_WRITE_ENABLED: "true",
      STAGING_LOADOUT_WRITE_DRY_RUN: "false",
      STAGING_LOADOUT_WRITE_SCOPE: "allowlist",
      STAGING_LOADOUT_WRITE_ALLOWLIST: "verified-player-a",
      STAGING_LOADOUT_WRITE_ALLOWED_ITEMS: "gun:pulseLaser"
    },
    fetchImpl: async (_url, options = {}) => {
      weaponLoadoutFetchCalls.push(options.method || "GET");
      if ((options.method || "GET") === "GET") return { ok: true, status: 200, json: async () => [{ save_data: weaponLoadoutSave }] };
      weaponLoadoutSave = JSON.parse(options.body || "{}").save_data;
      return { ok: true, status: 204, json: async () => [] };
    }
  });
  assert(appliedWeaponEquip.applied === true && appliedWeaponEquip.mode === "loadout_write", `Gated Pulse Laser equip did not apply: ${appliedWeaponEquip.blockReason}`);
  assert(appliedWeaponEquip.ownedBefore === 1 && appliedWeaponEquip.ownedAfter === 0, "Applied Pulse Laser equip returned incorrect ownership.");
  assert(appliedWeaponEquip.equippedBefore === 1 && appliedWeaponEquip.equippedAfter === 2, "Applied Pulse Laser equip returned incorrect equipped count.");
  assert(appliedWeaponEquip.loadoutWritten === true && appliedWeaponEquip.weaponWritten === true && appliedWeaponEquip.saveWritten === true, "Applied Pulse Laser equip did not report allowed writes.");
  assert(appliedWeaponEquip.attachmentWritten === false && appliedWeaponEquip.creditsWritten === false && appliedWeaponEquip.inventoryWritten === false, "Applied Pulse Laser equip reported forbidden writes.");
  assert(weaponLoadoutSave.credits === 780, "Applied Pulse Laser equip changed credits.");
  assert(weaponLoadoutSave.ownedGuns.pulseLaser === 0, "Applied Pulse Laser equip did not decrement owned weapon.");
  assert(weaponLoadoutSave.shipLoadouts.lupenOrigin.guns.length === 2, "Applied Pulse Laser equip did not append gun loadout entry.");
  assert(weaponLoadoutSave.ownedAttachments.cargoPod === 2, "Applied Pulse Laser equip changed attachment ownership.");
  assert(weaponLoadoutSave.inventoryItems[0].id === "kept-item", "Applied Pulse Laser equip changed inventoryItems.");
  assert(weaponLoadoutSave.cargo.Iron === 2, "Applied Pulse Laser equip changed trade cargo.");
  assert(weaponLoadoutSave.playerProgress.combatXp === 33, "Applied Pulse Laser equip changed progression.");
  assert(weaponLoadoutFetchCalls.join(",") === "GET,PATCH", `Pulse Laser equip expected read/write pair, got ${weaponLoadoutFetchCalls.join(",")}.`);

  let weaponUnequipSave = JSON.parse(JSON.stringify({
    ...validSaveData,
    ownedGuns: { pulseLaser: 0 },
    shipLoadouts: {
      lupenOrigin: {
        attachments: [{ key: "shieldBooster", quality: "standard", level: 1 }],
        guns: [{ key: "pulseLaser", quality: "standard", level: 1 }]
      }
    }
  }));
  const weaponUnequipFetchCalls = [];
  const appliedWeaponUnequip = await applyStagingLoadoutEquipWrite({
    playerId: "verified-player-a",
    itemId: "gun:pulseLaser",
    operation: "unequip",
    trustedState: { available: true, validationState: { credits: 780 } },
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key",
      STAGING_LOADOUT_WRITE_ENABLED: "true",
      STAGING_LOADOUT_WRITE_DRY_RUN: "false",
      STAGING_LOADOUT_WRITE_SCOPE: "allowlist",
      STAGING_LOADOUT_WRITE_ALLOWLIST: "verified-player-a",
      STAGING_LOADOUT_WRITE_ALLOWED_ITEMS: "gun:pulseLaser"
    },
    fetchImpl: async (_url, options = {}) => {
      weaponUnequipFetchCalls.push(options.method || "GET");
      if ((options.method || "GET") === "GET") return { ok: true, status: 200, json: async () => [{ save_data: weaponUnequipSave }] };
      weaponUnequipSave = JSON.parse(options.body || "{}").save_data;
      return { ok: true, status: 204, json: async () => [] };
    }
  });
  assert(appliedWeaponUnequip.applied === true && appliedWeaponUnequip.operation === "unequip", `Gated Pulse Laser unequip did not apply: ${appliedWeaponUnequip.blockReason}`);
  assert(appliedWeaponUnequip.ownedBefore === 0 && appliedWeaponUnequip.ownedAfter === 1, "Applied Pulse Laser unequip returned incorrect ownership.");
  assert(appliedWeaponUnequip.equippedBefore === 1 && appliedWeaponUnequip.equippedAfter === 0, "Applied Pulse Laser unequip returned incorrect equipped count.");
  assert(appliedWeaponUnequip.loadoutWritten === true && appliedWeaponUnequip.weaponWritten === true && appliedWeaponUnequip.saveWritten === true, "Applied Pulse Laser unequip did not report allowed writes.");
  assert(appliedWeaponUnequip.attachmentWritten === false && appliedWeaponUnequip.creditsWritten === false && appliedWeaponUnequip.inventoryWritten === false, "Applied Pulse Laser unequip reported forbidden writes.");
  assert(weaponUnequipSave.credits === 780, "Applied Pulse Laser unequip changed credits.");
  assert(weaponUnequipSave.ownedGuns.pulseLaser === 1, "Applied Pulse Laser unequip did not increment owned weapon.");
  assert(weaponUnequipSave.shipLoadouts.lupenOrigin.guns.length === 0, "Applied Pulse Laser unequip did not clear gun loadout entry.");
  assert(weaponUnequipSave.ownedAttachments.cargoPod === 2, "Applied Pulse Laser unequip changed attachment ownership.");
  assert(weaponUnequipSave.inventoryItems[0].id === "kept-item", "Applied Pulse Laser unequip changed inventoryItems.");
  assert(weaponUnequipSave.cargo.Iron === 2, "Applied Pulse Laser unequip changed trade cargo.");
  assert(weaponUnequipSave.playerProgress.combatXp === 33, "Applied Pulse Laser unequip changed progression.");
  assert(weaponUnequipFetchCalls.join(",") === "GET,PATCH", `Pulse Laser unequip expected read/write pair, got ${weaponUnequipFetchCalls.join(",")}.`);

  let shieldLoadoutSave = JSON.parse(JSON.stringify(validSaveData));
  const shieldLoadoutFetchCalls = [];
  const appliedShieldEquip = await applyStagingLoadoutEquipWrite({
    playerId: "verified-player-a",
    itemId: "attachment:shieldBooster",
    trustedState: { available: true, validationState: { credits: 780 } },
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key",
      STAGING_LOADOUT_WRITE_ENABLED: "true",
      STAGING_LOADOUT_WRITE_DRY_RUN: "false",
      STAGING_LOADOUT_WRITE_SCOPE: "allowlist",
      STAGING_LOADOUT_WRITE_ALLOWLIST: "verified-player-a",
      STAGING_LOADOUT_WRITE_ALLOWED_ITEMS: "attachment:shieldBooster"
    },
    fetchImpl: async (_url, options = {}) => {
      shieldLoadoutFetchCalls.push(options.method || "GET");
      if ((options.method || "GET") === "GET") return { ok: true, status: 200, json: async () => [{ save_data: shieldLoadoutSave }] };
      shieldLoadoutSave = JSON.parse(options.body || "{}").save_data;
      return { ok: true, status: 204, json: async () => [] };
    }
  });
  assert(appliedShieldEquip.applied === true && appliedShieldEquip.mode === "loadout_write", `Gated Shield Booster equip did not apply: ${appliedShieldEquip.blockReason}`);
  assert(appliedShieldEquip.ownedBefore === 1 && appliedShieldEquip.ownedAfter === 0, "Applied Shield Booster equip returned incorrect ownership.");
  assert(appliedShieldEquip.equippedBefore === 1 && appliedShieldEquip.equippedAfter === 2, "Applied Shield Booster equip returned incorrect equipped count.");
  assert(appliedShieldEquip.shieldBefore === 150 && appliedShieldEquip.shieldAfter === 200, "Applied Shield Booster equip returned incorrect shield.");
  assert(appliedShieldEquip.loadoutWritten === true && appliedShieldEquip.attachmentWritten === true && appliedShieldEquip.saveWritten === true, "Applied Shield Booster equip did not report allowed writes.");
  assert(appliedShieldEquip.weaponWritten === false && appliedShieldEquip.creditsWritten === false && appliedShieldEquip.inventoryWritten === false, "Applied Shield Booster equip reported forbidden writes.");
  assert(shieldLoadoutSave.credits === 780, "Applied Shield Booster equip changed credits.");
  assert(shieldLoadoutSave.ownedAttachments.shieldBooster === 0, "Applied Shield Booster equip did not decrement owned Shield Booster.");
  assert(shieldLoadoutSave.shipLoadouts.lupenOrigin.attachments.filter((entry) => entry.key === "shieldBooster").length === 2, "Applied Shield Booster equip did not append loadout entry.");
  assert(shieldLoadoutSave.ownedGuns.pulseLaser === 1, "Applied Shield Booster equip changed weapon ownership.");
  assert(shieldLoadoutSave.inventoryItems[0].id === "kept-item", "Applied Shield Booster equip changed inventoryItems.");
  assert(shieldLoadoutSave.cargo.Iron === 2, "Applied Shield Booster equip changed trade cargo.");
  assert(shieldLoadoutSave.playerProgress.combatXp === 33, "Applied Shield Booster equip changed progression.");
  assert(shieldLoadoutFetchCalls.join(",") === "GET,PATCH", `Shield Booster equip expected read/write pair, got ${shieldLoadoutFetchCalls.join(",")}.`);

  let shipSelectSave = JSON.parse(JSON.stringify({
    ...validSaveData,
    ownedShips: ["lupenOrigin", "lupenHauler"],
    selectedHangarShipId: "lupenOrigin",
    selectedFleetShipId: "lupenOrigin"
  }));
  const shipSelectFetchCalls = [];
  const appliedShipSelect = await applyStagingLoadoutEquipWrite({
    playerId: "verified-player-a",
    itemId: "ship:lupenHauler",
    trustedState: { available: true, validationState: { credits: 780 } },
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key",
      STAGING_LOADOUT_WRITE_ENABLED: "true",
      STAGING_LOADOUT_WRITE_DRY_RUN: "false",
      STAGING_LOADOUT_WRITE_SCOPE: "allowlist",
      STAGING_LOADOUT_WRITE_ALLOWLIST: "verified-player-a",
      STAGING_LOADOUT_WRITE_ALLOWED_ITEMS: "ship:lupenHauler"
    },
    fetchImpl: async (_url, options = {}) => {
      shipSelectFetchCalls.push(options.method || "GET");
      if ((options.method || "GET") === "GET") return { ok: true, status: 200, json: async () => [{ save_data: shipSelectSave }] };
      shipSelectSave = JSON.parse(options.body || "{}").save_data;
      return { ok: true, status: 204, json: async () => [] };
    }
  });
  assert(appliedShipSelect.applied === true && appliedShipSelect.mode === "loadout_write", `Gated LF-2 Hauler select did not apply: ${appliedShipSelect.blockReason}`);
  assert(appliedShipSelect.loadoutWritten === false && appliedShipSelect.shipWritten === true && appliedShipSelect.saveWritten === true, "Applied LF-2 Hauler select did not report allowed ship write.");
  assert(appliedShipSelect.creditsWritten === false && appliedShipSelect.inventoryWritten === false && appliedShipSelect.attachmentWritten === false && appliedShipSelect.weaponWritten === false, "Applied LF-2 Hauler select reported forbidden writes.");
  assert(shipSelectSave.currentShipId === "lupenHauler" && shipSelectSave.selectedHangarShipId === "lupenHauler", "Applied LF-2 Hauler select did not update ship selection.");
  assert(shipSelectSave.credits === 780, "Applied LF-2 Hauler select changed credits.");
  assert(shipSelectSave.ownedShips.length === 2, "Applied LF-2 Hauler select changed ship ownership.");
  assert(shipSelectSave.shipLoadouts.lupenOrigin.attachments[0].key === "shieldBooster", "Applied LF-2 Hauler select changed loadouts.");
  assert(shipSelectSave.ownedAttachments.cargoPod === 2, "Applied LF-2 Hauler select changed attachments.");
  assert(shipSelectSave.ownedGuns.pulseLaser === 1, "Applied LF-2 Hauler select changed weapons.");
  assert(shipSelectSave.inventoryItems[0].id === "kept-item", "Applied LF-2 Hauler select changed inventoryItems.");
  assert(shipSelectSave.playerProgress.combatXp === 33, "Applied LF-2 Hauler select changed progression.");
  assert(shipSelectFetchCalls.join(",") === "GET,PATCH", `LF-2 Hauler select expected read/write pair, got ${shipSelectFetchCalls.join(",")}.`);

  console.log("staging Cargo Pod/Pulse Laser/Shield Booster/LF-2 Hauler equip helpers and gated loadout write passed");
}

async function assertFullCargoPodTradeLoopHelpers() {
  let loopSave = {
    credits: 5000,
    currentShipId: "lupenOrigin",
    ownedAttachments: { cargoPod: 0, shieldBooster: 1 },
    ownedGuns: { pulseLaser: 1 },
    ownedShips: ["lupenOrigin"],
    shipLoadouts: { lupenOrigin: { attachments: [], guns: [{ key: "pulseLaser", quality: "standard", level: 1 }] } },
    inventoryItems: [{ id: "untouched-inventory", key: "cargoPod", quality: "rare" }],
    cargo: { Iron: 0, Copper: 3 },
    cargoCostBasis: { Copper: 30 },
    activeBountyId: "untouched-bounty",
    playerProgress: {
      combatXp: 33,
      totals: {
        tradesCompleted: 4,
        cargoSold: 9,
        tradeProfit: 222
      }
    },
    marker: { keep: true }
  };

  const fetchCalls = [];
  const loopFetch = async (_url, options = {}) => {
    fetchCalls.push(options.method || "GET");
    if ((options.method || "GET") === "GET") {
      return {
        ok: true,
        status: 200,
        async json() {
          return [{ save_data: loopSave }];
        }
      };
    }

    assert(options.method === "PATCH", "Full Cargo Pod loop used unexpected write method.");
    loopSave = JSON.parse(options.body || "{}").save_data;
    return { ok: true, status: 204, json: async () => [] };
  };

  const commonEnv = {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "stub-service-key",
    STAGING_STORE_WRITE_ENABLED: "true",
    STAGING_STORE_WRITE_DRY_RUN: "false",
    STAGING_STORE_WRITE_SCOPE: "allowlist",
    STAGING_STORE_WRITE_ALLOWLIST: "verified-player-a",
    STAGING_STORE_WRITE_ALLOWED_ITEMS: "attachment:cargoPod,gun:pulseLaser",
    STAGING_LOADOUT_WRITE_ENABLED: "true",
    STAGING_LOADOUT_WRITE_DRY_RUN: "false",
    STAGING_LOADOUT_WRITE_SCOPE: "allowlist",
    STAGING_LOADOUT_WRITE_ALLOWLIST: "verified-player-a",
    STAGING_LOADOUT_WRITE_ALLOWED_ITEMS: "attachment:cargoPod,gun:pulseLaser",
    STAGING_TRADE_WRITE_ENABLED: "true",
    STAGING_TRADE_WRITE_DRY_RUN: "false",
    STAGING_TRADE_WRITE_SCOPE: "allowlist",
    STAGING_TRADE_WRITE_ALLOWLIST: "verified-player-a"
  };

  const storePurchase = await applyStagingStorePurchaseWrite({
    playerId: "verified-player-a",
    itemId: "attachment:cargoPod",
    quantity: 1,
    trustedState: { available: true, validationState: { credits: 5000 } },
    env: commonEnv,
    fetchImpl: loopFetch
  });
  assert(storePurchase.applied === true, `Full loop Cargo Pod purchase failed: ${storePurchase.blockReason}`);
  assert(loopSave.credits === 4780, "Full loop Cargo Pod purchase did not subtract CR.");
  assert(loopSave.ownedAttachments.cargoPod === 1, "Full loop Cargo Pod purchase did not increment owned Cargo Pod.");
  assert(loopSave.shipLoadouts.lupenOrigin.attachments.length === 0, "Full loop Cargo Pod purchase changed loadout before equip.");

  const equip = await applyStagingCargoPodEquipWrite({
    playerId: "verified-player-a",
    itemId: "attachment:cargoPod",
    trustedState: { available: true, validationState: { credits: 4780 } },
    env: commonEnv,
    fetchImpl: loopFetch
  });
  assert(equip.applied === true, `Full loop Cargo Pod equip failed: ${equip.blockReason}`);
  assert(loopSave.ownedAttachments.cargoPod === 0, "Full loop Cargo Pod equip did not consume ownership count.");
  assert(loopSave.shipLoadouts.lupenOrigin.attachments.some((entry) => entry.key === "cargoPod"), "Full loop Cargo Pod equip did not append loadout entry.");
  assert(equip.cargoCapacityBefore === 150 && equip.cargoCapacityAfter === 175, "Full loop Cargo Pod equip did not report +25 cargo capacity.");

  const ironOffer = {
    offerId: "loop-iron",
    resourceId: "iron",
    resourceName: "Iron",
    buyPrice: 18,
    sellPrice: 25
  };

  const oldCapacityPlan = buildStagingTradeBuySavePatch(loopSave, ironOffer, 160, { cargoCapacity: 150 });
  assert(oldCapacityPlan.ok === false && oldCapacityPlan.reason === "insufficient_cargo", "Full loop trade buy unexpectedly fit in old capacity.");

  const buyAfterEquip = await applyStagingTradeBuyWrite({
    playerId: "verified-player-a",
    offer: ironOffer,
    quantity: 160,
    trustedState: { available: true, validationState: { cargoCapacity: 175 } },
    env: commonEnv,
    fetchImpl: loopFetch
  });
  assert(buyAfterEquip.applied === true, `Full loop trade buy after Cargo Pod failed: ${buyAfterEquip.reason}`);
  assert(buyAfterEquip.cargoCapacity === 175, "Full loop trade buy did not use increased trusted capacity.");
  assert(buyAfterEquip.cargoUsedBefore === 3 && buyAfterEquip.cargoUsedAfter === 163, "Full loop trade buy did not report expected hold usage.");
  assert(loopSave.credits === 1900, "Full loop trade buy did not subtract expected credits.");
  assert(loopSave.cargo.Iron === 160, "Full loop trade buy did not add expected Iron cargo.");
  assert(loopSave.cargo.Copper === 3, "Full loop trade buy changed unrelated Copper cargo.");

  const sellAfterBuy = await applyStagingTradeSellWrite({
    playerId: "verified-player-a",
    offer: ironOffer,
    quantity: 160,
    trustedState: { available: true, validationState: { cargoCapacity: 175 } },
    env: commonEnv,
    fetchImpl: loopFetch
  });
  assert(sellAfterBuy.applied === true, `Full loop trade sell failed: ${sellAfterBuy.reason}`);
  assert(loopSave.credits === 5900, "Full loop trade sell did not add expected credits.");
  assert(loopSave.cargo.Iron === 0, "Full loop trade sell did not remove Iron cargo.");
  assert(loopSave.cargo.Copper === 3, "Full loop trade sell changed unrelated cargo.");
  assert(loopSave.cargoCostBasis.Iron === undefined, "Full loop trade sell-all did not clear Iron cost basis.");

  const weaponPurchase = await applyStagingStorePurchaseWrite({
    playerId: "verified-player-a",
    itemId: "gun:pulseLaser",
    quantity: 1,
    trustedState: { available: true, validationState: { credits: loopSave.credits } },
    env: commonEnv,
    fetchImpl: loopFetch
  });
  assert(weaponPurchase.applied === true, `Full loop Pulse Laser purchase failed: ${weaponPurchase.blockReason}`);
  assert(loopSave.credits === 5152, "Full loop Pulse Laser purchase did not subtract expected credits.");
  assert(loopSave.ownedGuns.pulseLaser === 2, "Full loop Pulse Laser purchase did not increment weapon ownership.");
  assert(loopSave.shipLoadouts.lupenOrigin.guns.length === 1, "Full loop Pulse Laser purchase changed loadout before equip.");

  const weaponEquip = await applyStagingLoadoutEquipWrite({
    playerId: "verified-player-a",
    itemId: "gun:pulseLaser",
    trustedState: { available: true, validationState: { credits: loopSave.credits } },
    env: commonEnv,
    fetchImpl: loopFetch
  });
  assert(weaponEquip.applied === true, `Full loop Pulse Laser equip failed: ${weaponEquip.blockReason}`);
  assert(loopSave.ownedGuns.pulseLaser === 1, "Full loop Pulse Laser equip did not consume owned weapon.");
  assert(loopSave.shipLoadouts.lupenOrigin.guns.length === 2, "Full loop Pulse Laser equip did not append gun loadout entry.");
  assert(loopSave.shipLoadouts.lupenOrigin.guns[1].key === "pulseLaser", "Full loop Pulse Laser equip appended unexpected gun key.");

  assert(loopSave.inventoryItems[0].id === "untouched-inventory", "Full loop changed inventory.");
  assert(loopSave.ownedShips[0] === "lupenOrigin", "Full loop changed ships.");
  assert(loopSave.credits === 5152, "Full loop ended with unexpected credits after Pulse Laser purchase/equip.");
  assert(loopSave.ownedAttachments.cargoPod === 0, "Full loop ended with unexpected Cargo Pod ownership.");
  assert(loopSave.activeBountyId === "untouched-bounty", "Full loop changed bounty state.");
  assert(loopSave.playerProgress.combatXp === 33, "Full loop changed broad progression.");
  assert(loopSave.playerProgress.totals.tradesCompleted === 4, "Full loop changed route completion totals.");
  assert(loopSave.playerProgress.totals.cargoSold === 9, "Full loop changed cargo sold totals.");
  assert(loopSave.playerProgress.totals.tradeProfit === 222, "Full loop changed trade profit totals.");
  assert(loopSave.marker.keep === true, "Full loop changed unrelated save fields.");
  assert(fetchCalls.join(",") === "GET,PATCH,GET,PATCH,GET,PATCH,GET,PATCH,GET,PATCH,GET,PATCH", `Full loop expected six read/write pairs, got ${fetchCalls.join(",")}.`);

  console.log("full Cargo Pod/Pulse Laser purchase/equip/trade-more loop passed with mocked player_saves");
}

async function assertStagingBountyHelpers() {
  const bounties = getStagingBounties();
  assert(bounties.length === 1, `Expected one staging bounty, got ${bounties.length}.`);
  assert(bounties[0].id === STAGING_BOUNTY_ID, "Staging bounty list returned unexpected id.");
  assert(bounties[0].requiredKills === 2, "Staging bounty should require 2 bot destructions.");
  assert(bounties[0].xpReward === 40, "Staging bounty should use XP-only reward amount 40.");
  assert(bounties[0].creditsReward === 0, "Staging bounty should not include credits.");
  assert(Array.isArray(bounties[0].lootReward) && bounties[0].lootReward.length === 0, "Staging bounty should not include loot.");

  let bountyState = createStagingBountyState("session-a", 1000);
  let publicState = getPublicStagingBountyState(bountyState);
  assert(publicState.accepted === true, "Accepted staging bounty did not report accepted.");
  assert(publicState.progress === 0 && publicState.requiredKills === 2, "Initial staging bounty progress was incorrect.");
  assert(publicState.claimAvailable === false, "Initial staging bounty claim was unexpectedly available.");

  const noContribution = recordStagingBountyBotDestruction(bountyState, {
    botId: "dev-bot-erebus-1",
    contributorSessionIds: ["session-b"],
    now: 1100
  });
  assert(noContribution.changed === false && noContribution.reason === "player_did_not_contribute", "Non-contributor staging bounty progress was not blocked.");
  assert(noContribution.state.progress === 0, "Non-contributor staging bounty changed progress.");

  const firstKill = recordStagingBountyBotDestruction(bountyState, {
    botId: "dev-bot-erebus-1",
    contributorSessionIds: ["session-a", "session-b"],
    now: 1200
  });
  assert(firstKill.changed === true && firstKill.reason === "progress_updated", "First staging bounty bot kill did not update progress.");
  bountyState = firstKill.state;
  assert(bountyState.progress === 1 && bountyState.completed === false, "First staging bounty bot kill completed too early.");

  const duplicateKill = recordStagingBountyBotDestruction(bountyState, {
    botId: "dev-bot-erebus-1",
    contributorSessionIds: ["session-a"],
    now: 1300
  });
  assert(duplicateKill.changed === false && duplicateKill.reason === "bot_already_counted", "Duplicate staging bounty bot kill was not blocked.");
  assert(duplicateKill.state.progress === 1, "Duplicate staging bounty bot kill changed progress.");

  const secondKill = recordStagingBountyBotDestruction(bountyState, {
    botId: "dev-bot-erebus-2",
    contributorSessionIds: ["session-a"],
    now: 1400
  });
  assert(secondKill.changed === true && secondKill.reason === "completed", "Second staging bounty bot kill did not complete bounty.");
  bountyState = secondKill.state;
  publicState = getPublicStagingBountyState(bountyState);
  assert(publicState.progress === 2 && publicState.completed === true && publicState.claimAvailable === true, "Completed staging bounty public state was incorrect.");
  assert(buildStagingBountySourceEventId(bountyState, "verified-player-a") === `${STAGING_BOUNTY_ID}:verified-player-a:1`, "Staging bounty source event id was not deterministic.");

  const lootPreview = buildStagingLootPreview({
    botId: "dev-bot-erebus-1",
    rewardPreviewId: "dev-bot-erebus-1:1400",
    eligibleSessionIds: ["session-a", "session-b", "session-a"]
  });
  assert(lootPreview.available === true, "Staging loot preview should be available to contributors.");
  assert(lootPreview.mode === "preview_only", "Staging loot preview mode should be preview_only.");
  assert(lootPreview.eligibleSessionIds.length === 2, "Staging loot preview did not de-duplicate eligible sessions.");
  assert(Array.isArray(lootPreview.items) && lootPreview.items.length > 0, "Staging loot preview did not include preview items.");
  assert(lootPreview.items.every((item) => item.lootId && item.name && item.inventoryWritable === false), "Staging loot preview item fields were not safe.");
  assert(lootPreview.inventoryWritten === false && lootPreview.saveWritten === false, "Staging loot preview reported forbidden writes.");
  assert(lootPreview.creditsWritten === false && lootPreview.cargoWritten === false && lootPreview.bountyWritten === false, "Staging loot preview reported economy/bounty writes.");

  const bountyRewardPlan = {
    playerId: "verified-player-a",
    trustedPlayerId: "verified-player-a",
    authStatus: "verified",
    displayName: "Verified Pilot A",
    botId: STAGING_BOUNTY_ID,
    botName: "Erebus Patrol Sweep",
    node: "Upper Apex",
    finalHitBy: "session-a",
    topContributorSessionId: "session-a",
    contributorSessionId: "session-a",
    contributionPercent: 100,
    intendedXp: 25,
    intendedCredits: 0,
    intendedLoot: [],
    intendedReason: "staging_bounty_completed",
    rewardPreviewId: buildStagingBountySourceEventId(bountyState, "verified-player-a"),
    eligible: true,
    blockedReason: "",
    applied: false,
    dryRun: true
  };
  const bountyApplicationPlan = buildRewardApplicationPlan(bountyRewardPlan, {
    sourceEventId: bountyRewardPlan.rewardPreviewId
  });
  const bountySave = {
    credits: 777,
    cargo: { Iron: 2 },
    ownedAttachments: { cargoPod: 1 },
    ownedGuns: { pulseLaser: 1 },
    shipLoadouts: { lupenOrigin: { attachments: [{ key: "cargoPod" }], guns: [{ key: "pulseLaser" }] } },
    activeBountyId: "local-bounty-should-not-change",
    playerProgress: {
      combatXp: 10,
      zoneCombatXp: { "sector-one": 10 },
      totals: {
        tradesCompleted: 2,
        cargoSold: 3,
        tradeProfit: 4
      }
    },
    inventoryItems: [{ id: "loot-stays" }]
  };
  const bountyPatchPlan = buildPlayerSavePatchPlan(bountySave, bountyApplicationPlan, {
    sourceEventId: bountyRewardPlan.rewardPreviewId
  });
  assert(bountyPatchPlan.eligible === true, `Completed staging bounty XP patch plan was blocked: ${bountyPatchPlan.skippedReason}`);
  assert(bountyPatchPlan.xpDelta === 25 && bountyPatchPlan.creditsDelta === 0, "Completed staging bounty patch plan was not XP-only.");

  const patchCalls = [];
  let bountyPersistedSave = bountySave;
  const bountyPatchResult = await applyPlayerSavePatchPlan(bountyPatchPlan, {
    env: {
      ENABLE_STAGING_PROGRESSION_WRITES: "true",
      STAGING_PROGRESSION_WRITE_SCOPE: "verified",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key"
    },
    fetchImpl: async (_url, options = {}) => {
      patchCalls.push(options);
      if (options.method === "GET") {
        return { ok: true, status: 200, json: async () => [{ save_data: bountyPersistedSave }] };
      }
      if (options.method === "PATCH") {
        bountyPersistedSave = JSON.parse(options.body).save_data;
        return { ok: true, status: 200, json: async () => [{ save_data: bountyPersistedSave }] };
      }
      throw new Error(`Unexpected bounty player_saves method: ${options.method}`);
    }
  });
  assert(bountyPatchResult.applied === true, "Completed staging bounty XP-only patch did not apply in mocked write mode.");
  assert(bountyPatchResult.appliedFields.join(",") === "xp", "Completed staging bounty patch wrote non-XP fields.");
  const patchedBody = JSON.parse(patchCalls[1].body);
  assert(patchedBody.save_data.playerProgress.combatXp === 35, "Completed staging bounty patch did not add XP.");
  assert(patchedBody.save_data.playerProgress.zoneCombatXp["sector-one"] === 35, "Completed staging bounty patch did not mirror sector-one XP.");
  assert(patchedBody.save_data.credits === 777, "Completed staging bounty patch changed credits.");
  assert(patchedBody.save_data.cargo.Iron === 2, "Completed staging bounty patch changed cargo.");
  assert(patchedBody.save_data.inventoryItems[0].id === "loot-stays", "Completed staging bounty patch changed inventory.");
  assert(patchedBody.save_data.shipLoadouts.lupenOrigin.guns[0].key === "pulseLaser", "Completed staging bounty patch changed loadout.");
  assert(patchedBody.save_data.activeBountyId === "local-bounty-should-not-change", "Completed staging bounty patch changed local bounty state.");
  assert(patchedBody.save_data.playerProgress.totals.tradeProfit === 4, "Completed staging bounty patch changed trade totals.");

  const duplicatePlan = buildPlayerSavePatchPlan(bountySave, bountyApplicationPlan, {
    sourceEventId: bountyRewardPlan.rewardPreviewId,
    duplicateDetected: true
  });
  assert(duplicatePlan.eligible === false && duplicatePlan.skippedReason === "duplicate_reward_application", "Duplicate staging bounty XP claim was not blocked.");

  const botKillPreview = {
    rewardPreviewId: "staging-bot-a:kill-001",
    botId: "staging-bot-a",
    botName: "Erebus Drone",
    node: "Upper Apex",
    finalHitBy: "session-a",
    disabledBySessionId: "session-a",
    topContributorSessionId: "session-a",
    previewXp: 8
  };
  const botKillRewardPlan = buildRewardWritePlan({
    preview: botKillPreview,
    claimantIdentity: {
      sessionId: "session-a",
      authStatus: "verified",
      trustedPlayerId: "verified-player-a",
      displayName: "Pilot A"
    },
    contributor: {
      sessionId: "session-a",
      totalDamage: 25,
      hits: 2,
      percent: 100
    }
  });
  const botKillApplicationPlan = buildRewardApplicationPlan(botKillRewardPlan, {
    sourceEventId: botKillPreview.rewardPreviewId
  });
  const botKillPatchPlan = buildPlayerSavePatchPlan(bountySave, botKillApplicationPlan, {
    sourceEventId: botKillPreview.rewardPreviewId
  });
  assert(botKillPatchPlan.eligible === true, `Staging bot kill XP patch plan was blocked: ${botKillPatchPlan.skippedReason}`);
  assert(botKillPatchPlan.xpDelta === 8 && botKillPatchPlan.creditsDelta === 0, "Staging bot kill patch plan was not XP-only.");

  const botKillPatchCalls = [];
  let botKillPersistedSave = bountySave;
  const botKillPatchResult = await applyPlayerSavePatchPlan(botKillPatchPlan, {
    env: {
      ENABLE_STAGING_PROGRESSION_WRITES: "true",
      STAGING_PROGRESSION_WRITE_SCOPE: "verified",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key"
    },
    fetchImpl: async (_url, options = {}) => {
      botKillPatchCalls.push(options);
      if (options.method === "GET") {
        return { ok: true, status: 200, json: async () => [{ save_data: botKillPersistedSave }] };
      }
      if (options.method === "PATCH") {
        botKillPersistedSave = JSON.parse(options.body).save_data;
        return { ok: true, status: 200, json: async () => [{ save_data: botKillPersistedSave }] };
      }
      throw new Error(`Unexpected bot kill player_saves method: ${options.method}`);
    }
  });
  assert(botKillPatchResult.applied === true, "Staging bot kill XP-only patch did not apply in mocked write mode.");
  assert(botKillPatchResult.persistenceVerified === true, "Staging bot kill XP-only patch was not verified after write.");
  const botKillPatchedBody = JSON.parse(botKillPatchCalls[1].body);
  assert(botKillPatchedBody.save_data.playerProgress.combatXp === 18, "Staging bot kill patch did not add XP.");
  assert(botKillPatchedBody.save_data.playerProgress.zoneCombatXp["sector-one"] === 18, "Staging bot kill patch did not mirror sector-one XP.");
  assert(botKillPatchedBody.save_data.credits === 777, "Staging bot kill patch changed credits.");
  assert(botKillPatchedBody.save_data.inventoryItems[0].id === "loot-stays", "Staging bot kill patch changed inventory.");

  const duplicateBotKillPlan = buildPlayerSavePatchPlan(bountySave, botKillApplicationPlan, {
    sourceEventId: botKillPreview.rewardPreviewId,
    duplicateDetected: true
  });
  assert(duplicateBotKillPlan.eligible === false && duplicateBotKillPlan.skippedReason === "duplicate_reward_application", "Duplicate staging bot kill XP was not blocked.");

  const secondBotKillPreview = {
    ...botKillPreview,
    rewardPreviewId: "staging_bot_xp:staging-bot-a:kill-002"
  };
  const secondBotKillRewardPlan = buildRewardWritePlan({
    preview: secondBotKillPreview,
    claimantIdentity: {
      sessionId: "session-a",
      authStatus: "verified",
      trustedPlayerId: "verified-player-a",
      displayName: "Pilot A"
    },
    contributor: {
      sessionId: "session-a",
      totalDamage: 22,
      hits: 1,
      percent: 100
    }
  });
  const secondBotKillApplicationPlan = buildRewardApplicationPlan(secondBotKillRewardPlan, {
    sourceEventId: secondBotKillPreview.rewardPreviewId
  });
  const saveAfterFirstBotKill = botKillPatchedBody.save_data;
  const secondBotKillPatchPlan = buildPlayerSavePatchPlan(saveAfterFirstBotKill, secondBotKillApplicationPlan, {
    sourceEventId: secondBotKillPreview.rewardPreviewId
  });
  assert(secondBotKillPatchPlan.eligible === true, `Second staging bot kill XP patch plan was blocked: ${secondBotKillPatchPlan.skippedReason}`);
  assert(secondBotKillPatchPlan.idempotencyKey !== botKillPatchPlan.idempotencyKey, "Second staging bot kill reused the first kill idempotency key.");

  const secondBotKillPatchCalls = [];
  let secondBotKillPersistedSave = saveAfterFirstBotKill;
  const secondBotKillPatchResult = await applyPlayerSavePatchPlan(secondBotKillPatchPlan, {
    env: {
      ENABLE_STAGING_PROGRESSION_WRITES: "true",
      STAGING_PROGRESSION_WRITE_SCOPE: "verified",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key"
    },
    fetchImpl: async (_url, options = {}) => {
      secondBotKillPatchCalls.push(options);
      if (options.method === "GET") {
        return { ok: true, status: 200, json: async () => [{ save_data: secondBotKillPersistedSave }] };
      }
      if (options.method === "PATCH") {
        secondBotKillPersistedSave = JSON.parse(options.body).save_data;
        return { ok: true, status: 200, json: async () => [{ save_data: secondBotKillPersistedSave }] };
      }
      throw new Error(`Unexpected second bot kill player_saves method: ${options.method}`);
    }
  });
  assert(secondBotKillPatchResult.applied === true, "Second staging bot kill XP-only patch did not apply in mocked write mode.");
  const secondBotKillPatchedBody = JSON.parse(secondBotKillPatchCalls[1].body);
  assert(secondBotKillPatchedBody.save_data.playerProgress.combatXp === 26, "Second staging bot kill patch did not add another XP award.");
  assert(secondBotKillPatchedBody.save_data.playerProgress.zoneCombatXp["sector-one"] === 26, "Second staging bot kill patch did not mirror second sector-one XP award.");

  let threeKillSave = {
    ...bountySave,
    playerProgress: {
      ...bountySave.playerProgress,
      combatXp: 16,
      zoneCombatXp: { "sector-one": 16 }
    }
  };
  const threeKillSeenKeys = new Set();
  for (let killIndex = 1; killIndex <= 3; killIndex += 1) {
    const rewardPreviewId = `staging_bot_xp:staging-bot-a:live-kill-${killIndex}`;
    const rewardPlan = buildRewardWritePlan({
      preview: {
        ...botKillPreview,
        rewardPreviewId,
        previewXp: 8
      },
      claimantIdentity: {
        sessionId: "session-a",
        authStatus: "verified",
        trustedPlayerId: "verified-player-a",
        displayName: "Pilot A"
      },
      contributor: {
        sessionId: "session-a",
        totalDamage: 20,
        hits: 1,
        percent: 100
      }
    });
    const applicationPlan = buildRewardApplicationPlan(rewardPlan, { sourceEventId: rewardPreviewId });
    const duplicateDetected = threeKillSeenKeys.has(`${applicationPlan.playerId}:${applicationPlan.sourceEventId}`);
    const patchPlan = buildPlayerSavePatchPlan(threeKillSave, applicationPlan, {
      sourceEventId: rewardPreviewId,
      duplicateDetected
    });
    const patchResult = await applyPlayerSavePatchPlan(patchPlan, {
      env: {
        ENABLE_STAGING_PROGRESSION_WRITES: "true",
        STAGING_PROGRESSION_WRITE_SCOPE: "verified",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "stub-service-key"
      },
      fetchImpl: async (_url, options = {}) => {
        if (options.method === "GET") {
          return { ok: true, status: 200, json: async () => [{ save_data: threeKillSave }] };
        }
        if (options.method === "PATCH") {
          threeKillSave = JSON.parse(options.body).save_data;
          return { ok: true, status: 200, json: async () => [{ save_data: threeKillSave }] };
        }
        throw new Error(`Unexpected three-kill player_saves method: ${options.method}`);
      }
    });
    assert(patchResult.applied === true, `Bot kill ${killIndex} did not persist XP.`);
    assert(patchResult.persistenceVerified === true, `Bot kill ${killIndex} was not verified after write.`);
    threeKillSeenKeys.add(patchPlan.idempotencyKey);
  }
  assert(threeKillSave.playerProgress.combatXp === 40, "Three legitimate bot destructions did not persist final XP 40.");
  assert(threeKillSave.playerProgress.zoneCombatXp["sector-one"] === 40, "Three legitimate bot destructions did not mirror final sector-one XP 40.");

  const duplicateThreeKillRewardPlan = buildRewardWritePlan({
    preview: {
      ...botKillPreview,
      rewardPreviewId: "staging_bot_xp:staging-bot-a:live-kill-3",
      previewXp: 8
    },
    claimantIdentity: {
      sessionId: "session-a",
      authStatus: "verified",
      trustedPlayerId: "verified-player-a",
      displayName: "Pilot A"
    },
    contributor: {
      sessionId: "session-a",
      totalDamage: 20,
      hits: 1,
      percent: 100
    }
  });
  const duplicateThreeKillApplicationPlan = buildRewardApplicationPlan(duplicateThreeKillRewardPlan, {
    sourceEventId: "staging_bot_xp:staging-bot-a:live-kill-3"
  });
  const duplicateThreeKillPatchPlan = buildPlayerSavePatchPlan(threeKillSave, duplicateThreeKillApplicationPlan, {
    sourceEventId: "staging_bot_xp:staging-bot-a:live-kill-3",
    duplicateDetected: true
  });
  assert(duplicateThreeKillPatchPlan.eligible === false, "Duplicate third bot destruction was not blocked.");
  assert(duplicateThreeKillPatchPlan.skippedReason === "duplicate_reward_application", "Duplicate third bot destruction had unexpected block reason.");

  console.log("staging bounty helper flow and XP-only patch boundaries passed");
}

async function assertIdentityVerificationAndRewardPlanHelpers() {
  const longServiceRoleKey = `stub-service-key-${"x".repeat(180)}`;
  const verified = await verifySupabaseAccessToken(
    "stub-valid-token",
    {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: longServiceRoleKey
    },
    async (_url, options = {}) => {
      assert(options.headers?.authorization === "Bearer stub-valid-token", "Verification did not use bearer token.");
      assert(options.headers?.apikey === longServiceRoleKey, "Verification truncated or changed Supabase apikey.");
      return {
        ok: true,
        async json() {
          return {
            id: "verified-player-a",
            user_metadata: {
              pilot_name: "Verified Pilot A"
            }
          };
        }
      };
    }
  );

  assert(verified.authStatus === "verified", "Stubbed Supabase verification did not return verified.");
  assert(verified.trustedPlayerId === "verified-player-a", "Stubbed verification did not return trusted player id.");

  const rejected = await verifySupabaseAccessToken(
    "stub-invalid-token",
    {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_ANON_KEY: "stub-anon-key"
    },
    async (_url, options = {}) => {
      assert(options.headers?.authorization === "Bearer stub-invalid-token", "Rejected verification did not use bearer token.");
      assert(options.headers?.apikey === "stub-anon-key", "Verification did not use configured anon key fallback.");
      return {
        ok: false,
        status: 401
      };
    }
  );
  assert(rejected.authStatus === "unverified", "Invalid token should stay unverified.");
  assert(rejected.reason === "supabase_verification_http_401", `Unexpected invalid token reason: ${rejected.reason}`);

  const plan = buildRewardWritePlan({
    preview: {
      botId: "dev-bot-erebus-1",
      botName: "Erebus Drone",
      node: "Upper Apex",
      finalHitBy: "session-a",
      topContributorSessionId: "session-a",
      previewXp: 5,
      previewCredits: 0,
      previewLoot: []
    },
    claimantIdentity: {
      sessionId: "session-a",
      authStatus: "verified",
      trustedPlayerId: "verified-player-a",
      displayName: "Verified Pilot A"
    },
    contributor: {
      sessionId: "session-a",
      percent: 80
    }
  });

  assert(plan.eligible === true, "Verified reward dry-run plan was not eligible.");
  assert(plan.dryRun === true, "Verified reward plan was not a dry run.");
  assert(plan.applied === false, "Verified reward plan was applied.");
  assert(plan.playerId === "verified-player-a", "Verified reward plan did not include trusted player id.");
  assert(plan.intendedXp === 4, `Unexpected verified dry-run XP: ${plan.intendedXp}`);
  assert(plan.intendedCredits === 0, `Unexpected verified dry-run credits: ${plan.intendedCredits}`);
  const ledgerEntry = buildRewardLedgerEntry(plan, {
    roomName: ROOM_NAME,
    sourceEventId: "reward-preview-stub"
  });
  assert(ledgerEntry.player_id === "verified-player-a", "Ledger entry did not include verified player id.");
  assert(ledgerEntry.xp_amount === 4, `Unexpected ledger XP amount: ${ledgerEntry.xp_amount}`);
  assert(ledgerEntry.credits_amount === 0, `Unexpected ledger credits amount: ${ledgerEntry.credits_amount}`);
  assert(ledgerEntry.dry_run === true && ledgerEntry.applied === false, "Ledger entry was not dry-run/unapplied.");

  const applicationPlan = buildRewardApplicationPlan(plan, {
    sourceLedgerId: "ledger-row-1",
    sourceEventId: "reward-preview-stub"
  });
  assert(applicationPlan.eligible === true, "Verified application plan was not eligible.");
  assert(applicationPlan.playerId === "verified-player-a", "Verified application plan did not include player id.");
  assert(applicationPlan.xpDelta === 4, `Unexpected application XP delta: ${applicationPlan.xpDelta}`);
  assert(applicationPlan.creditsDelta === 0, `Unexpected application credits delta: ${applicationPlan.creditsDelta}`);
  assert(applicationPlan.sourceLedgerId === "ledger-row-1", "Application plan did not include source ledger id.");
  assert(applicationPlan.sourceEventId === "reward-preview-stub", "Application plan did not include source event id.");
  assert(applicationPlan.idempotencyKey === "verified-player-a:reward-preview-stub", `Unexpected application idempotency key: ${applicationPlan.idempotencyKey}`);
  assert(applicationPlan.idempotencyReady === true, "Application plan was not idempotency-ready.");
  assert(applicationPlan.duplicateDetected === false, "Application plan unexpectedly marked duplicate.");
  assert(applicationPlan.applied === false && applicationPlan.dryRun === true, "Application plan was not dry-run/unapplied.");
  const disabledApplicationResult = await applyRewardApplicationPlan(applicationPlan, {
    env: {
      ENABLE_STAGING_PROGRESSION_WRITES: "false"
    }
  });
  assert(disabledApplicationResult?.dryRun === true, "Disabled application adapter did not return dryRun true.");
  assert(disabledApplicationResult?.applied === false, "Disabled application adapter applied progression.");
  assert(disabledApplicationResult?.idempotencyKey === "verified-player-a:reward-preview-stub", "Disabled application result did not include idempotency key.");
  assert(disabledApplicationResult?.idempotencyReady === true, "Disabled application result was not idempotency-ready.");
  assert(disabledApplicationResult?.skippedReason === "progression_writes_disabled", `Unexpected disabled application reason: ${disabledApplicationResult?.skippedReason}`);

  const enabledApplicationResult = await applyRewardApplicationPlan(applicationPlan, {
    env: {
      ENABLE_STAGING_PROGRESSION_WRITES: "true"
    }
  });
  assert(enabledApplicationResult?.ok === true, "Enabled reward application planning did not delegate cleanly.");
  assert(enabledApplicationResult?.dryRun === true, "Enabled reward application planning did not stay dry-run.");
  assert(enabledApplicationResult?.applied === false, "Enabled reward application planning applied progression directly.");
  assert(enabledApplicationResult?.idempotencyReady === true, "Enabled reward application planning did not keep idempotency ready.");
  assert(enabledApplicationResult?.skippedReason === "player_save_patch_required", `Unexpected enabled application planning reason: ${enabledApplicationResult?.skippedReason}`);

  const missingSaveEnvContext = await fetchPlayerSavePreviewContext("verified-player-a", {
    env: {},
    fetchImpl: async () => {
      throw new Error("fetch should not run without Supabase config");
    }
  });
  assert(missingSaveEnvContext?.available === false, "Missing-env save preview context was available.");
  assert(missingSaveEnvContext?.reason === "supabase_config_missing", `Unexpected missing-env save preview reason: ${missingSaveEnvContext?.reason}`);

  let saveReadUrl = "";
  let saveReadOptions = null;
  const missingSaveContext = await fetchPlayerSavePreviewContext("verified-player-a", {
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key"
    },
    fetchImpl: async (url, options = {}) => {
      saveReadUrl = url;
      saveReadOptions = options;
      return {
        ok: true,
        status: 200,
        async json() {
          return [];
        }
      };
    }
  });
  assert(missingSaveContext?.ok === true, "Missing save read did not succeed safely.");
  assert(missingSaveContext?.available === false, "Missing save context was unexpectedly available.");
  assert(missingSaveContext?.reason === "save_missing", `Unexpected missing save reason: ${missingSaveContext?.reason}`);
  assert(saveReadUrl === "https://example.supabase.co/rest/v1/player_saves?select=save_data,updated_at&user_id=eq.verified-player-a&limit=1", `Unexpected save read URL: ${saveReadUrl}`);
  assert(saveReadOptions?.method === "GET", "Save preview read did not use GET.");
  assert(saveReadOptions?.headers?.authorization === "Bearer stub-service-key", "Save preview read did not use service role bearer auth.");

  const validMockSaveData = {
    credits: 1200,
    playerProgress: {
      combatXp: 80,
      level: 3
    },
    inventoryItems: [{ id: "loot-a" }, { id: "loot-b" }]
  };
  const validSaveContext = await fetchPlayerSavePreviewContext("verified-player-a", {
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key"
    },
    fetchImpl: async () => {
      return {
        ok: true,
        status: 200,
        async json() {
          return [{
            updated_at: "2026-05-31T12:00:00.000Z",
            save_data: validMockSaveData
          }];
        }
      };
    }
  });
  assert(validSaveContext?.available === true, "Valid mocked save context was not available.");
  assert(validSaveContext?.saveSummary?.xp === 80, `Unexpected mocked save XP: ${validSaveContext?.saveSummary?.xp}`);
  assert(validSaveContext?.saveSummary?.credits === 1200, `Unexpected mocked save credits: ${validSaveContext?.saveSummary?.credits}`);
  assert(validSaveContext?.saveSummary?.level === 3, `Unexpected mocked save level: ${validSaveContext?.saveSummary?.level}`);
  assert(validSaveContext?.saveSummary?.inventoryCount === 2, `Unexpected mocked save inventory count: ${validSaveContext?.saveSummary?.inventoryCount}`);

  const progressionPreview = buildProgressionPreview(validSaveContext, applicationPlan);
  assert(progressionPreview?.available === true, "Progression preview was not available for mocked save.");
  assert(progressionPreview?.currentXp === 80, `Unexpected current XP preview: ${progressionPreview?.currentXp}`);
  assert(progressionPreview?.previewXp === 84, `Unexpected preview XP: ${progressionPreview?.previewXp}`);
  assert(progressionPreview?.currentCredits === 1200, `Unexpected current credits preview: ${progressionPreview?.currentCredits}`);
  assert(progressionPreview?.previewCredits === 1200, `Unexpected preview credits: ${progressionPreview?.previewCredits}`);
  assert(progressionPreview?.applied === false && progressionPreview?.dryRun === true, "Progression preview was not dry-run/unapplied.");
  assert(progressionPreview?.progressionWritesEnabled === false, "Progression preview enabled writes.");

  const playerSavePatchPlan = buildPlayerSavePatchPlan(validMockSaveData, applicationPlan, {
    sourceEventId: "reward-preview-stub",
    sourceLedgerId: "ledger-row-1"
  });
  assert(playerSavePatchPlan?.eligible === true, `Verified player_saves patch plan was not eligible: ${playerSavePatchPlan?.skippedReason}`);
  assert(playerSavePatchPlan?.applied === false && playerSavePatchPlan?.dryRun === true, "player_saves patch plan was not dry-run/unapplied.");
  assert(playerSavePatchPlan?.playerId === "verified-player-a", "player_saves patch plan did not include verified player id.");
  assert(playerSavePatchPlan?.sourceEventId === "reward-preview-stub", "player_saves patch plan did not include stable source event id.");
  assert(playerSavePatchPlan?.idempotencyKey === "verified-player-a:reward-preview-stub", `Unexpected player_saves idempotency key: ${playerSavePatchPlan?.idempotencyKey}`);
  assert(playerSavePatchPlan?.idempotencyReady === true, "player_saves patch plan was not idempotency-ready.");
  assert(playerSavePatchPlan?.duplicateDetected === false, "Initial player_saves patch plan reported a duplicate.");
  assert(playerSavePatchPlan?.xpPath === "playerProgress.combatXp", `Unexpected player_saves XP path: ${playerSavePatchPlan?.xpPath}`);
  assert(playerSavePatchPlan?.creditsPath === "credits", `Unexpected player_saves credits path: ${playerSavePatchPlan?.creditsPath}`);
  assert(playerSavePatchPlan?.xpBefore === 80 && playerSavePatchPlan?.xpAfter === 84, "player_saves patch plan did not calculate XP before/after.");
  assert(playerSavePatchPlan?.creditsBefore === 1200 && playerSavePatchPlan?.creditsAfter === 1200, "player_saves patch plan did not preserve credits before/after.");
  assert(playerSavePatchPlan?.lootPreviewOnly === 0, "player_saves patch plan attempted to include loot writes.");

  const disabledPlayerSavePatchResult = await applyPlayerSavePatchPlan(playerSavePatchPlan, {
    env: {
      ENABLE_STAGING_PROGRESSION_WRITES: "false"
    }
  });
  assert(disabledPlayerSavePatchResult?.dryRun === true, "Disabled player_saves patch adapter was not dry-run.");
  assert(disabledPlayerSavePatchResult?.applied === false, "Disabled player_saves patch adapter applied progression.");
  assert(disabledPlayerSavePatchResult?.progressionWritesEnabled === false, "Disabled player_saves patch adapter reported writes enabled.");
  assert(disabledPlayerSavePatchResult?.idempotencyKey === "verified-player-a:reward-preview-stub", "Disabled player_saves patch result did not include idempotency key.");
  assert(disabledPlayerSavePatchResult?.idempotencyReady === true, "Disabled player_saves patch result was not idempotency-ready.");
  assert(disabledPlayerSavePatchResult?.duplicateDetected === false, "Disabled player_saves patch result reported duplicate.");
  assert(disabledPlayerSavePatchResult?.skippedReason === "progression_writes_disabled", `Unexpected disabled player_saves patch reason: ${disabledPlayerSavePatchResult?.skippedReason}`);

  const missingAllowlistPlayerSavePatchResult = await applyPlayerSavePatchPlan(playerSavePatchPlan, {
    env: {
      ENABLE_STAGING_PROGRESSION_WRITES: "true"
    }
  });
  assert(missingAllowlistPlayerSavePatchResult?.dryRun === true, "Missing-allowlist player_saves patch adapter did not stay dry-run.");
  assert(missingAllowlistPlayerSavePatchResult?.applied === false, "Missing-allowlist player_saves patch adapter applied progression.");
  assert(missingAllowlistPlayerSavePatchResult?.progressionWritesEnabled === true, "Missing-allowlist player_saves patch adapter did not report writes enabled.");
  assert(missingAllowlistPlayerSavePatchResult?.progressionWriteScope === "allowlist", "Missing-allowlist player_saves patch adapter did not default to allowlist scope.");
  assert(missingAllowlistPlayerSavePatchResult?.stagingWriteAllowlistPresent === false, "Missing-allowlist player_saves patch adapter reported an allow-list.");
  assert(missingAllowlistPlayerSavePatchResult?.playerInStagingWriteAllowlist === false, "Missing-allowlist player_saves patch adapter allow-listed player.");
  assert(missingAllowlistPlayerSavePatchResult?.idempotencyReady === true, "Missing-allowlist player_saves patch adapter did not keep idempotency ready.");
  assert(missingAllowlistPlayerSavePatchResult?.skippedReason === "staging_write_allowlist_missing", `Unexpected missing-allowlist player_saves patch reason: ${missingAllowlistPlayerSavePatchResult?.skippedReason}`);

  const notAllowlistedPlayerSavePatchResult = await applyPlayerSavePatchPlan(playerSavePatchPlan, {
    env: {
      ENABLE_STAGING_PROGRESSION_WRITES: "true",
      STAGING_PROGRESSION_WRITE_ALLOWLIST: "other-player-id"
    }
  });
  assert(notAllowlistedPlayerSavePatchResult?.dryRun === true, "Non-allow-listed player_saves patch adapter was not dry-run.");
  assert(notAllowlistedPlayerSavePatchResult?.applied === false, "Non-allow-listed player_saves patch adapter applied progression.");
  assert(notAllowlistedPlayerSavePatchResult?.stagingWriteAllowlistPresent === true, "Non-allow-listed player_saves patch adapter did not report allow-list present.");
  assert(notAllowlistedPlayerSavePatchResult?.playerInStagingWriteAllowlist === false, "Non-allow-listed player_saves patch adapter allowed the player.");
  assert(notAllowlistedPlayerSavePatchResult?.skippedReason === "player_not_in_staging_write_allowlist", `Unexpected non-allow-listed player_saves patch reason: ${notAllowlistedPlayerSavePatchResult?.skippedReason}`);

  const allowlistedPlayerSavePatchResult = await applyPlayerSavePatchPlan(playerSavePatchPlan, {
    env: {
      ENABLE_STAGING_PROGRESSION_WRITES: "true",
      STAGING_PROGRESSION_WRITE_ALLOWLIST: "other-player-id, verified-player-a"
    }
  });
  assert(allowlistedPlayerSavePatchResult?.dryRun === true, "Allow-listed player_saves patch adapter did not stay dry-run.");
  assert(allowlistedPlayerSavePatchResult?.applied === false, "Allow-listed player_saves patch adapter applied progression.");
  assert(allowlistedPlayerSavePatchResult?.stagingWriteAllowlistPresent === true, "Allow-listed player_saves patch adapter did not report allow-list present.");
  assert(allowlistedPlayerSavePatchResult?.playerInStagingWriteAllowlist === true, "Allow-listed player_saves patch adapter did not allow the player.");
  assert(allowlistedPlayerSavePatchResult?.idempotencyReady === true, "Allow-listed player_saves patch adapter did not keep idempotency ready.");
  assert(allowlistedPlayerSavePatchResult?.skippedReason === "supabase_config_missing", `Unexpected allow-listed missing-config player_saves patch reason: ${allowlistedPlayerSavePatchResult?.skippedReason}`);

  const invalidShapePlayerSavePatchResult = await applyPlayerSavePatchPlan(playerSavePatchPlan, {
    env: {
      ENABLE_STAGING_PROGRESSION_WRITES: "true",
      STAGING_PROGRESSION_WRITE_ALLOWLIST: "verified-player-a",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key"
    },
    fetchImpl: async (url, options = {}) => {
      assert(options.method === "GET", "Invalid-shape player_saves test should only read.");
      assert(url === "https://example.supabase.co/rest/v1/player_saves?user_id=eq.verified-player-a&select=save_data,updated_at&limit=1", `Unexpected invalid-shape player_saves read URL: ${url}`);
      return {
        ok: true,
        status: 200,
        async json() {
          return [{
            save_data: {
              credits: 1200,
              playerProgress: {},
              inventoryItems: [{ id: "loot-a" }]
            }
          }];
        }
      };
    }
  });
  assert(invalidShapePlayerSavePatchResult?.dryRun === true, "Invalid-shape player_saves patch result was not dry-run.");
  assert(invalidShapePlayerSavePatchResult?.applied === false, "Invalid-shape player_saves patch result applied progression.");
  assert(invalidShapePlayerSavePatchResult?.skippedReason === "xp_path_missing_or_ambiguous", `Unexpected invalid-shape player_saves patch reason: ${invalidShapePlayerSavePatchResult?.skippedReason}`);

  const patchedCalls = [];
  let validPatchPersistedSave = validMockSaveData;
  const validPatchPlayerSaveResult = await applyPlayerSavePatchPlan(playerSavePatchPlan, {
    env: {
      ENABLE_STAGING_PROGRESSION_WRITES: "true",
      STAGING_PROGRESSION_WRITE_SCOPE: "verified",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key"
    },
    fetchImpl: async (url, options = {}) => {
      patchedCalls.push({ url, options });
      if (options.method === "GET") {
        return {
          ok: true,
          status: 200,
          async json() {
            return [{
              save_data: validPatchPersistedSave
            }];
          }
        };
      }

      if (options.method === "PATCH") {
        validPatchPersistedSave = JSON.parse(options.body).save_data;
        return {
          ok: true,
          status: 200,
          async json() {
            return [{ save_data: validPatchPersistedSave }];
          }
        };
      }

      throw new Error(`Unexpected mocked player_saves method: ${options.method}`);
    }
  });
  assert(validPatchPlayerSaveResult?.ok === true, "Valid mocked player_saves patch did not succeed.");
  assert(validPatchPlayerSaveResult?.applied === true, "Valid mocked player_saves patch was not applied.");
  assert(validPatchPlayerSaveResult?.dryRun === false, "Valid mocked player_saves patch stayed dry-run.");
  assert(validPatchPlayerSaveResult?.progressionWriteScope === "verified", "Valid mocked player_saves patch did not use verified scope.");
  assert(validPatchPlayerSaveResult?.playerAllowedForStagingWrite === true, "Verified-scope mocked player_saves patch did not allow the verified player.");
  assert(validPatchPlayerSaveResult?.xpBefore === 80 && validPatchPlayerSaveResult?.xpAfter === 84, "Valid mocked player_saves patch did not apply XP delta.");
  assert(validPatchPlayerSaveResult?.creditsBefore === 1200 && validPatchPlayerSaveResult?.creditsAfter === 1200, "Valid mocked player_saves patch changed credits.");
  assert(Array.isArray(validPatchPlayerSaveResult?.appliedFields), "Valid mocked player_saves patch did not include applied fields.");
  assert(validPatchPlayerSaveResult.appliedFields.join(",") === "xp", `Unexpected mocked player_saves applied fields: ${validPatchPlayerSaveResult.appliedFields.join(",")}`);
  assert(patchedCalls.length === 2, `Expected one read and one patch call, got ${patchedCalls.length}.`);
  assert(patchedCalls[0].url === "https://example.supabase.co/rest/v1/player_saves?user_id=eq.verified-player-a&select=save_data,updated_at&limit=1", `Unexpected player_saves read URL: ${patchedCalls[0].url}`);
  assert(patchedCalls[0].options.method === "GET", "Valid mocked player_saves first call was not GET.");
  assert(patchedCalls[1].url === "https://example.supabase.co/rest/v1/player_saves?user_id=eq.verified-player-a", `Unexpected player_saves patch URL: ${patchedCalls[1].url}`);
  assert(patchedCalls[1].options.method === "PATCH", "Valid mocked player_saves second call was not PATCH.");
  const patchedBody = JSON.parse(patchedCalls[1].options.body);
  assert(patchedBody.save_data.playerProgress.combatXp === 84, "Patched save_data did not update combat XP.");
  assert(patchedBody.save_data.playerProgress.zoneCombatXp["sector-one"] === 84, "Patched save_data did not update sector-one combat XP.");
  assert(patchedBody.save_data.credits === 1200, "Patched save_data changed credits.");
  assert(patchedBody.save_data.playerProgress.level === 3, "Patched save_data changed unrelated playerProgress level.");
  assert(patchedBody.save_data.inventoryItems.length === 2, "Patched save_data changed inventory item count.");
  assert(patchedBody.save_data.inventoryItems[0].id === "loot-a", "Patched save_data changed inventory contents.");

  const appliedClaimStatus = buildRewardClaimStatus({
    ok: true,
    reason: "staging_preview_only",
    rewardWritePlan: plan,
    rewardApplicationPlan: applicationPlan,
    rewardApplicationResult: enabledApplicationResult,
    playerSavePatchPlan,
    playerSavePatchResult: validPatchPlayerSaveResult
  });
  assert(appliedClaimStatus.applied === true, "Applied XP-only player_saves result was not reflected in claim status.");
  assert(appliedClaimStatus.mode === "xp_only", `Applied XP-only claim used unexpected mode: ${appliedClaimStatus.mode}`);
  assert(appliedClaimStatus.reason === "xp_only_staging_claim_applied", `Applied XP-only claim used unexpected reason: ${appliedClaimStatus.reason}`);
  assert(appliedClaimStatus.playerSave?.written === true, "Applied XP-only claim did not report player_saves written.");
  assert(appliedClaimStatus.playerSave?.creditsWritten === false, "Applied XP-only claim reported credits written.");
  assert(appliedClaimStatus.gates?.xpWriteAllowed === true, "Applied XP-only claim did not keep XP write gates open.");

  const duplicatePlayerSavePatchPlan = buildPlayerSavePatchPlan(validMockSaveData, applicationPlan, {
    sourceEventId: "reward-preview-stub",
    sourceLedgerId: "ledger-row-1",
    duplicateDetected: true
  });
  assert(duplicatePlayerSavePatchPlan?.eligible === false, "Duplicate player_saves patch plan was eligible.");
  assert(duplicatePlayerSavePatchPlan?.idempotencyKey === "verified-player-a:reward-preview-stub", "Duplicate player_saves patch plan did not preserve idempotency key.");
  assert(duplicatePlayerSavePatchPlan?.idempotencyReady === true, "Duplicate player_saves patch plan was not idempotency-ready.");
  assert(duplicatePlayerSavePatchPlan?.duplicateDetected === true, "Duplicate player_saves patch plan did not mark duplicate.");
  assert(duplicatePlayerSavePatchPlan?.skippedReason === "duplicate_reward_application", `Unexpected duplicate player_saves patch reason: ${duplicatePlayerSavePatchPlan?.skippedReason}`);
  const duplicatePlayerSavePatchResult = await applyPlayerSavePatchPlan(duplicatePlayerSavePatchPlan, {
    env: {
      ENABLE_STAGING_PROGRESSION_WRITES: "true"
    }
  });
  assert(duplicatePlayerSavePatchResult?.dryRun === true, "Duplicate player_saves patch result was not dry-run.");
  assert(duplicatePlayerSavePatchResult?.applied === false, "Duplicate player_saves patch result applied progression.");
  assert(duplicatePlayerSavePatchResult?.duplicateDetected === true, "Duplicate player_saves patch result did not mark duplicate.");
  assert(duplicatePlayerSavePatchResult?.skippedReason === "duplicate_reward_application", `Unexpected duplicate player_saves patch result reason: ${duplicatePlayerSavePatchResult?.skippedReason}`);
  const disabledDuplicatePlayerSavePatchResult = await applyPlayerSavePatchPlan(duplicatePlayerSavePatchPlan, {
    env: {
      ENABLE_STAGING_PROGRESSION_WRITES: "false"
    }
  });
  assert(disabledDuplicatePlayerSavePatchResult?.dryRun === true, "Disabled duplicate player_saves patch result was not dry-run.");
  assert(disabledDuplicatePlayerSavePatchResult?.applied === false, "Disabled duplicate player_saves patch result applied progression.");
  assert(disabledDuplicatePlayerSavePatchResult?.duplicateDetected === true, "Disabled duplicate player_saves patch result did not mark duplicate.");
  assert(disabledDuplicatePlayerSavePatchResult?.skippedReason === "duplicate_reward_application", `Unexpected disabled duplicate player_saves patch result reason: ${disabledDuplicatePlayerSavePatchResult?.skippedReason}`);

  const missingXpPatchPlan = buildPlayerSavePatchPlan({
    credits: 1200,
    playerProgress: {}
  }, applicationPlan, {
    sourceEventId: "reward-preview-stub"
  });
  assert(missingXpPatchPlan?.eligible === false, "Missing XP path player_saves patch plan was eligible.");
  assert(missingXpPatchPlan?.skippedReason === "xp_path_missing_or_ambiguous", `Unexpected missing XP path reason: ${missingXpPatchPlan?.skippedReason}`);

  const missingCreditsPatchPlan = buildPlayerSavePatchPlan({
    playerProgress: {
      combatXp: 80
    }
  }, applicationPlan, {
    sourceEventId: "reward-preview-stub"
  });
  assert(missingCreditsPatchPlan?.eligible === true, `Missing credits path player_saves patch plan was not eligible for XP-only writes: ${missingCreditsPatchPlan?.skippedReason}`);
  assert(missingCreditsPatchPlan?.creditsPath === "", `Unexpected XP-only credits path: ${missingCreditsPatchPlan?.creditsPath}`);

  const missingIdempotencyPatchPlan = buildPlayerSavePatchPlan(validMockSaveData, {
    ...applicationPlan,
    sourceEventId: "",
    sourceLedgerId: ""
  });
  assert(missingIdempotencyPatchPlan?.eligible === false, "Missing idempotency player_saves patch plan was eligible.");
  assert(missingIdempotencyPatchPlan?.idempotencyReady === false, "Missing idempotency player_saves patch plan was ready.");
  assert(missingIdempotencyPatchPlan?.skippedReason === "idempotency_not_ready", `Unexpected missing idempotency reason: ${missingIdempotencyPatchPlan?.skippedReason}`);

  const unavailableProgressionPreview = buildProgressionPreview(missingSaveContext, applicationPlan);
  assert(unavailableProgressionPreview?.available === false, "Missing-save progression preview was available.");
  assert(unavailableProgressionPreview?.reason === "save_missing", `Unexpected missing-save progression preview reason: ${unavailableProgressionPreview?.reason}`);

  const shadowEntry = buildProgressionShadowEntry(applicationPlan, progressionPreview, {
    ledgerId: "11111111-1111-4111-8111-111111111111",
    entry: ledgerEntry
  });
  assert(shadowEntry.player_id === "verified-player-a", "Progression shadow entry did not include verified player id.");
  assert(shadowEntry.xp_delta === 4, `Unexpected shadow XP delta: ${shadowEntry.xp_delta}`);
  assert(shadowEntry.credits_delta === 0, `Unexpected shadow credits delta: ${shadowEntry.credits_delta}`);
  assert(shadowEntry.current_xp === 80 && shadowEntry.preview_xp === 84, "Shadow entry did not include progression preview XP.");
  assert(shadowEntry.current_credits === 1200 && shadowEntry.preview_credits === 1200, "Shadow entry did not include progression preview credits.");
  assert(shadowEntry.applied_to_real_save === false && shadowEntry.dry_run === true, "Shadow entry was not dry-run/unapplied.");
  assert(shadowEntry.source_ledger_id === "11111111-1111-4111-8111-111111111111", "Shadow entry did not include source ledger id.");

  const missingEnvShadowConnectivity = await checkProgressionShadowConnectivity({
    env: {},
    fetchImpl: async () => {
      throw new Error("fetch should not run without Supabase config");
    }
  });
  assert(missingEnvShadowConnectivity?.ok === false, "Missing-env shadow connectivity check unexpectedly succeeded.");
  assert(missingEnvShadowConnectivity?.progressionShadowReachable === false, "Missing-env shadow connectivity marked table reachable.");
  assert(missingEnvShadowConnectivity?.progressionShadowWritesEnabled === false, "Missing-env shadow connectivity enabled writes.");
  assert(missingEnvShadowConnectivity?.reason === "missing_supabase_url", `Unexpected missing-env shadow connectivity reason: ${missingEnvShadowConnectivity?.reason}`);

  let shadowConnectivityUrl = "";
  let shadowConnectivityOptions = null;
  const successfulShadowConnectivity = await checkProgressionShadowConnectivity({
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key"
    },
    fetchImpl: async (url, options = {}) => {
      shadowConnectivityUrl = url;
      shadowConnectivityOptions = options;
      return {
        ok: true,
        status: 200,
        async json() {
          return [];
        }
      };
    }
  });
  assert(successfulShadowConnectivity?.ok === true, "Mocked shadow connectivity check did not succeed.");
  assert(successfulShadowConnectivity?.progressionShadowReachable === true, "Mocked shadow connectivity did not mark table reachable.");
  assert(successfulShadowConnectivity?.progressionShadowWritesEnabled === false, "Mocked shadow connectivity enabled writes by default.");
  assert(shadowConnectivityUrl === "https://example.supabase.co/rest/v1/multiplayer_progression_shadow?select=id&limit=1", `Unexpected shadow connectivity URL: ${shadowConnectivityUrl}`);
  assert(shadowConnectivityOptions?.method === "GET", "Shadow connectivity check did not use GET.");
  assert(shadowConnectivityOptions?.headers?.authorization === "Bearer stub-service-key", "Shadow connectivity check did not use service role bearer auth.");
  assert(!shadowConnectivityUrl.includes("player_saves"), "Shadow connectivity check targeted player_saves.");

  const failedShadowConnectivity = await checkProgressionShadowConnectivity({
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key"
    },
    fetchImpl: async () => {
      return {
        ok: false,
        status: 404
      };
    }
  });
  assert(failedShadowConnectivity?.ok === false, "Failed shadow connectivity check unexpectedly succeeded.");
  assert(failedShadowConnectivity?.progressionShadowReachable === false, "Failed shadow connectivity marked table reachable.");
  assert(failedShadowConnectivity?.reason === "progression_shadow_connectivity_check_failed", `Unexpected failed shadow connectivity reason: ${failedShadowConnectivity?.reason}`);
  assert(failedShadowConnectivity?.status === 404, "Failed shadow connectivity did not preserve safe status.");

  const disabledShadowResult = await writeProgressionShadowEntry(shadowEntry, {
    env: {
      ENABLE_STAGING_PROGRESSION_SHADOW_WRITES: "false",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key"
    }
  });
  assert(disabledShadowResult?.dryRun === true, "Disabled shadow adapter did not return dryRun true.");
  assert(disabledShadowResult?.applied === false, "Disabled shadow adapter applied progression.");
  assert(disabledShadowResult?.skippedReason === "progression_shadow_writes_disabled", `Unexpected disabled shadow reason: ${disabledShadowResult?.skippedReason}`);

  const missingEnvShadowResult = await writeProgressionShadowEntry(shadowEntry, {
    env: {
      ENABLE_STAGING_PROGRESSION_SHADOW_WRITES: "true"
    },
    fetchImpl: async () => {
      throw new Error("fetch should not run without Supabase config");
    }
  });
  assert(missingEnvShadowResult?.dryRun === true, "Missing-env shadow result was not dry-run.");
  assert(missingEnvShadowResult?.applied === false, "Missing-env shadow result applied progression.");
  assert(missingEnvShadowResult?.skippedReason === "supabase_config_missing", `Unexpected missing-env shadow reason: ${missingEnvShadowResult?.skippedReason}`);

  const blockedShadowApplicationPlan = buildRewardApplicationPlan({
    authStatus: "unverified",
    blockedReason: "identity_unverified",
    botId: "dev-bot-erebus-1",
    botName: "Erebus Drone",
    intendedXp: 4,
    intendedCredits: 0
  });
  const blockedShadowEntry = buildProgressionShadowEntry(blockedShadowApplicationPlan, unavailableProgressionPreview, {});
  const blockedShadowResult = await writeProgressionShadowEntry(blockedShadowEntry, {
    env: {
      ENABLE_STAGING_PROGRESSION_SHADOW_WRITES: "true",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key"
    },
    fetchImpl: async () => {
      throw new Error("fetch should not run for an ineligible shadow entry");
    }
  });
  assert(blockedShadowResult?.dryRun === true, "Blocked shadow result was not dry-run.");
  assert(blockedShadowResult?.applied === false, "Blocked shadow result applied progression.");
  assert(blockedShadowResult?.skippedReason === "progression_shadow_not_eligible", `Unexpected blocked shadow reason: ${blockedShadowResult?.skippedReason}`);

  let shadowWriteUrl = "";
  let shadowWriteOptions = null;
  const enabledShadowResult = await writeProgressionShadowEntry(shadowEntry, {
    env: {
      ENABLE_STAGING_PROGRESSION_SHADOW_WRITES: "true",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key"
    },
    fetchImpl: async (url, options = {}) => {
      shadowWriteUrl = url;
      shadowWriteOptions = options;
      return {
        ok: true,
        status: 201,
        async json() {
          return [{ id: "shadow-row-1" }];
        }
      };
    }
  });
  assert(enabledShadowResult?.ok === true, "Enabled shadow adapter mock did not succeed.");
  assert(enabledShadowResult?.shadowId === "shadow-row-1", "Enabled shadow adapter did not return inserted shadow id.");
  assert(enabledShadowResult?.applied === false && enabledShadowResult?.dryRun === true, "Enabled shadow adapter applied progression.");
  assert(shadowWriteUrl === "https://example.supabase.co/rest/v1/multiplayer_progression_shadow", `Unexpected shadow write URL: ${shadowWriteUrl}`);
  assert(shadowWriteOptions?.method === "POST", "Shadow write did not use POST.");
  assert(!shadowWriteUrl.includes("player_saves"), "Shadow write targeted player_saves.");
  const shadowWriteBody = JSON.parse(shadowWriteOptions?.body || "{}");
  assert(shadowWriteBody.applied_to_real_save === false && shadowWriteBody.dry_run === true, "Shadow write body was not dry-run/unapplied.");

  const disabledLedgerResult = await writeRewardLedgerEntry(ledgerEntry, {
    env: {
      ENABLE_STAGING_REWARD_WRITES: "false",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key"
    }
  });
  assert(disabledLedgerResult?.dryRun === true, "Disabled ledger adapter did not return dryRun true.");
  assert(disabledLedgerResult?.applied === false, "Disabled ledger adapter applied rewards.");
  assert(disabledLedgerResult?.skippedReason === "reward_writes_disabled", `Unexpected disabled ledger reason: ${disabledLedgerResult?.skippedReason}`);

  const missingEnvConnectivity = await checkRewardLedgerConnectivity({
    env: {},
    fetchImpl: async () => {
      throw new Error("fetch should not run without Supabase config");
    }
  });
  assert(missingEnvConnectivity?.ok === false, "Missing-env ledger connectivity check unexpectedly succeeded.");
  assert(missingEnvConnectivity?.ledgerReachable === false, "Missing-env ledger connectivity check marked ledger reachable.");
  assert(missingEnvConnectivity?.rewardWritesEnabled === false, "Missing-env ledger connectivity check enabled writes.");
  assert(missingEnvConnectivity?.reason === "missing_supabase_url", `Unexpected missing-env connectivity reason: ${missingEnvConnectivity?.reason}`);

  const missingKeyConnectivity = await checkRewardLedgerConnectivity({
    env: {
      SUPABASE_URL: "https://example.supabase.co"
    },
    fetchImpl: async () => {
      throw new Error("fetch should not run without service role key");
    }
  });
  assert(missingKeyConnectivity?.reason === "missing_service_role_key", `Unexpected missing-key connectivity reason: ${missingKeyConnectivity?.reason}`);

  const invalidUrlConnectivity = await checkRewardLedgerConnectivity({
    env: {
      SUPABASE_URL: "not-a-valid-url",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key"
    },
    fetchImpl: async () => {
      throw new Error("fetch should not run for invalid Supabase URL");
    }
  });
  assert(invalidUrlConnectivity?.ok === false, "Invalid URL ledger connectivity check unexpectedly succeeded.");
  assert(invalidUrlConnectivity?.ledgerReachable === false, "Invalid URL ledger connectivity check marked ledger reachable.");
  assert(invalidUrlConnectivity?.reason === "invalid_supabase_url", `Unexpected invalid URL connectivity reason: ${invalidUrlConnectivity?.reason}`);

  let connectivityUrl = "";
  let connectivityOptions = null;
  const successfulConnectivity = await checkRewardLedgerConnectivity({
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key"
    },
    fetchImpl: async (url, options = {}) => {
      connectivityUrl = url;
      connectivityOptions = options;
      return {
        ok: true,
        status: 200,
        async json() {
          return [];
        }
      };
    }
  });
  assert(successfulConnectivity?.ok === true, "Mocked ledger connectivity check did not succeed.");
  assert(successfulConnectivity?.ledgerReachable === true, "Mocked ledger connectivity check did not mark ledger reachable.");
  assert(successfulConnectivity?.rewardWritesEnabled === false, "Mocked ledger connectivity check enabled writes by default.");
  assert(connectivityUrl === "https://example.supabase.co/rest/v1/multiplayer_reward_ledger?select=id&limit=1", `Unexpected ledger connectivity URL: ${connectivityUrl}`);
  assert(connectivityOptions?.method === "GET", "Ledger connectivity check did not use GET.");
  assert(connectivityOptions?.headers?.authorization === "Bearer stub-service-key", "Ledger connectivity check did not use service role bearer auth.");
  assert(!connectivityUrl.includes("player_saves"), "Ledger connectivity check targeted player_saves.");

  const invalidKeyConnectivity = await checkRewardLedgerConnectivity({
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key"
    },
    fetchImpl: async () => {
      return {
        ok: false,
        status: 401,
        async json() {
          return {
            code: "PGRST301",
            message: "JWT expired"
          };
        }
      };
    }
  });
  assert(invalidKeyConnectivity?.ok === false, "Invalid-key ledger connectivity check unexpectedly succeeded.");
  assert(invalidKeyConnectivity?.ledgerReachable === false, "Invalid-key ledger connectivity check marked ledger reachable.");
  assert(invalidKeyConnectivity?.reason === "invalid_key", `Unexpected invalid-key connectivity reason: ${invalidKeyConnectivity?.reason}`);
  assert(invalidKeyConnectivity?.safeErrorCode === "PGRST301", "Invalid-key connectivity did not expose safe error code.");

  const permissionDeniedConnectivity = await checkRewardLedgerConnectivity({
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key"
    },
    fetchImpl: async () => {
      return {
        ok: false,
        status: 403,
        async json() {
          return {
            code: "42501",
            message: "permission denied for table multiplayer_reward_ledger"
          };
        }
      };
    }
  });
  assert(permissionDeniedConnectivity?.ok === false, "Permission-denied ledger connectivity check unexpectedly succeeded.");
  assert(permissionDeniedConnectivity?.ledgerReachable === false, "Permission-denied ledger connectivity check marked ledger reachable.");
  assert(permissionDeniedConnectivity?.reason === "permission_denied", `Unexpected permission-denied connectivity reason: ${permissionDeniedConnectivity?.reason}`);
  assert(permissionDeniedConnectivity?.safeErrorMessage === "permission denied for table multiplayer_reward_ledger", "Permission-denied connectivity did not expose safe error message.");

  const tableMissingConnectivity = await checkRewardLedgerConnectivity({
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key"
    },
    fetchImpl: async () => {
      return {
        ok: false,
        status: 404,
        async json() {
          return {
            code: "PGRST205",
            message: "Could not find the table public.multiplayer_reward_ledger"
          };
        }
      };
    }
  });
  assert(tableMissingConnectivity?.ok === false, "Missing-table ledger connectivity check unexpectedly succeeded.");
  assert(tableMissingConnectivity?.ledgerReachable === false, "Missing-table ledger connectivity check marked ledger reachable.");
  assert(tableMissingConnectivity?.reason === "table_missing", `Unexpected missing-table connectivity reason: ${tableMissingConnectivity?.reason}`);

  const fetchFailedConnectivity = await checkRewardLedgerConnectivity({
    env: {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key"
    },
    fetchImpl: async () => {
      throw new Error("network down");
    }
  });
  assert(fetchFailedConnectivity?.ok === false, "Fetch-failed ledger connectivity check unexpectedly succeeded.");
  assert(fetchFailedConnectivity?.ledgerReachable === false, "Fetch-failed ledger connectivity check marked ledger reachable.");
  assert(fetchFailedConnectivity?.status === 0, "Fetch-failed ledger connectivity did not use status 0.");
  assert(fetchFailedConnectivity?.reason === "fetch_failed", `Unexpected fetch-failed connectivity reason: ${fetchFailedConnectivity?.reason}`);

  const missingEnvLedgerResult = await writeRewardLedgerEntry(ledgerEntry, {
    env: {
      ENABLE_STAGING_REWARD_WRITES: "true"
    },
    fetchImpl: async () => {
      throw new Error("fetch should not run without Supabase config");
    }
  });
  assert(missingEnvLedgerResult?.dryRun === true, "Missing-env ledger result was not dry-run.");
  assert(missingEnvLedgerResult?.applied === false, "Missing-env ledger result applied rewards.");
  assert(missingEnvLedgerResult?.skippedReason === "supabase_config_missing", `Unexpected missing-env ledger reason: ${missingEnvLedgerResult?.skippedReason}`);

  const blockedPlan = buildRewardWritePlan({
    preview: {
      botId: "dev-bot-erebus-1",
      botName: "Erebus Drone",
      node: "Upper Apex",
      previewXp: 5,
      previewCredits: 0
    },
    claimantIdentity: {
      sessionId: "session-b",
      authStatus: "unverified",
      displayName: "Unverified Pilot"
    },
    contributor: {
      sessionId: "session-b",
      percent: 40
    }
  });

  assert(blockedPlan.eligible === false, "Unverified dry-run plan was eligible.");
  assert(blockedPlan.blockedReason === "identity_unverified", `Unexpected blocked reason: ${blockedPlan.blockedReason}`);
  assert(blockedPlan.dryRun === true && blockedPlan.applied === false, "Blocked plan was not dry-run/unapplied.");
  const blockedApplicationPlan = buildRewardApplicationPlan(blockedPlan, {
    sourceEventId: "blocked-reward-preview-stub"
  });
  assert(blockedApplicationPlan.eligible === false, "Blocked application plan was eligible.");
  assert(blockedApplicationPlan.blockedReason === "identity_unverified", `Unexpected blocked application reason: ${blockedApplicationPlan.blockedReason}`);
  const blockedApplicationResult = await applyRewardApplicationPlan(blockedApplicationPlan, {
    env: {
      ENABLE_STAGING_PROGRESSION_WRITES: "false"
    }
  });
  assert(blockedApplicationResult?.dryRun === true, "Blocked application result was not dry-run.");
  assert(blockedApplicationResult?.applied === false, "Blocked application result applied progression.");
  assert(blockedApplicationResult?.skippedReason === "reward_application_not_eligible", `Unexpected blocked application skipped reason: ${blockedApplicationResult?.skippedReason}`);

  const blockedPlayerSavePatchPlan = buildPlayerSavePatchPlan({
    credits: 1200,
    playerProgress: {
      combatXp: 80
    }
  }, blockedApplicationPlan, {
    sourceEventId: "blocked-reward-preview-stub"
  });
  assert(blockedPlayerSavePatchPlan?.eligible === false, "Blocked player_saves patch plan was eligible.");
  assert(blockedPlayerSavePatchPlan?.skippedReason === "reward_application_not_eligible", `Unexpected blocked player_saves patch reason: ${blockedPlayerSavePatchPlan?.skippedReason}`);
  const blockedPlayerSavePatchResult = await applyPlayerSavePatchPlan(blockedPlayerSavePatchPlan, {
    env: {
      ENABLE_STAGING_PROGRESSION_WRITES: "true"
    }
  });
  assert(blockedPlayerSavePatchResult?.dryRun === true, "Blocked player_saves patch result was not dry-run.");
  assert(blockedPlayerSavePatchResult?.applied === false, "Blocked player_saves patch result applied progression.");
  assert(blockedPlayerSavePatchResult?.progressionWritesEnabled === true, "Blocked player_saves patch result did not report enabled write mode.");
  assert(blockedPlayerSavePatchResult?.skippedReason === "reward_application_not_eligible", `Unexpected blocked player_saves patch result reason: ${blockedPlayerSavePatchResult?.skippedReason}`);

  const blockedLedgerEntry = buildRewardLedgerEntry(blockedPlan, {
    roomName: ROOM_NAME,
    sourceEventId: "blocked-reward-preview-stub"
  });
  const blockedLedgerResult = await writeRewardLedgerEntry(blockedLedgerEntry, {
    env: {
      ENABLE_STAGING_REWARD_WRITES: "true",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key"
    },
    fetchImpl: async () => {
      throw new Error("fetch should not run for an ineligible plan");
    }
  });
  assert(blockedLedgerResult?.dryRun === true, "Blocked ledger result was not dry-run.");
  assert(blockedLedgerResult?.applied === false, "Blocked ledger result applied rewards.");
  assert(blockedLedgerResult?.skippedReason === "reward_plan_not_eligible", `Unexpected blocked ledger reason: ${blockedLedgerResult?.skippedReason}`);

  let writeUrl = "";
  let writeOptions = null;
  const enabledLedgerResult = await writeRewardLedgerEntry(ledgerEntry, {
    env: {
      ENABLE_STAGING_REWARD_WRITES: "true",
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key"
    },
    fetchImpl: async (url, options = {}) => {
      writeUrl = url;
      writeOptions = options;
      return {
        ok: true,
        status: 201,
        async json() {
          return [{ id: "ledger-row-1" }];
        }
      };
    }
  });
  assert(enabledLedgerResult?.ok === true, "Enabled ledger adapter mock did not succeed.");
  assert(enabledLedgerResult?.ledgerId === "ledger-row-1", "Enabled ledger adapter did not return inserted ledger id.");
  assert(enabledLedgerResult?.applied === false && enabledLedgerResult?.dryRun === true, "Enabled ledger adapter applied progression.");
  assert(writeUrl === "https://example.supabase.co/rest/v1/multiplayer_reward_ledger", `Unexpected ledger write URL: ${writeUrl}`);
  assert(writeOptions?.method === "POST", "Ledger write did not use POST.");
  assert(writeOptions?.headers?.authorization === "Bearer stub-service-key", "Ledger write did not use service role bearer auth.");
  assert(!writeUrl.includes("player_saves"), "Ledger write targeted player_saves.");
  const writeBody = JSON.parse(writeOptions?.body || "{}");
  assert(writeBody.applied === false && writeBody.dry_run === true, "Ledger write body was not dry-run/unapplied.");
  console.log("identity verification and reward dry-run helper checks passed");
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForFireReady(room, sessionId) {
  await waitFor("staging fire cooldown", () => {
    return Number(playerFrom(room, sessionId)?.nextFireAt || 0) <= Date.now();
  }, 4000);
}

async function moveAndSelectBot(room, botId, displayName = "Regression Pilot") {
  const bot = botById(room, botId);
  assert(bot, `Missing staging bot ${botId}.`);

  room.send("movement:update", {
    displayName,
    currentShipId: "lupenOrigin",
    shipName: "LF-1 Origin",
    currentNode: bot.currentNode,
    x: bot.x,
    y: bot.y
  });

  await waitFor(`${displayName} presence to reach selected staging bot node`, () => {
    return playerFrom(room, room.sessionId)?.currentNode === bot.currentNode;
  });

  if (playerFrom(room, room.sessionId)?.selectedTargetBotId === botId) return bot;

  const selectResponse = await expectTargetSelected(room, () => {
    room.send("target:select", {
      targetBotId: botId,
      currentNode: bot.currentNode
    });
  });

  assert(selectResponse?.ok === true, "Valid staging bot selection did not succeed.");
  await waitFor("server player selectedTargetBotId to update", () => {
    return playerFrom(room, room.sessionId)?.selectedTargetBotId === botId;
  });

  return bot;
}

async function leaveRoom(room) {
  if (!room) return;
  try {
    await room.leave();
  } catch (_err) {
    // Best-effort cleanup after assertion failures.
  }
}

try {
  await assertStagingTradeValidationHelpers();
  await assertStagingLootWriteHelpers();
  await assertStagingStorePreviewHelpers();
  await assertStagingCargoPodEquipHelpers();
  await assertFullCargoPodTradeLoopHelpers();
  await assertStagingBountyHelpers();
  await assertIdentityVerificationAndRewardPlanHelpers();

  roomA = await clientA.joinOrCreate(ROOM_NAME, {
    displayName: "Regression Pilot A",
    authStatus: "authenticated",
    playerId: "stub-player-a",
    supabaseUserId: "stub-player-a",
    supabaseAccessToken: "fake-token-a",
    currentShipId: "lupenOrigin",
    shipName: "LF-1 Origin",
    shipImage: "assets/ships/lupen-origin.png",
    shipClass: "Balanced Starter Hull",
    currentNode: "Asteron Prime",
    x: 50,
    y: 50
  });

  roomB = await clientB.joinOrCreate(ROOM_NAME, {
    displayName: "Regression Pilot B",
    authStatus: "authenticated",
    playerId: "stub-player-b",
    supabaseUserId: "stub-player-b",
    supabaseAccessToken: "fake-token-b",
    currentShipId: "lupenOrigin",
    shipName: "LF-1 Origin",
    shipImage: "assets/ships/lupen-origin.png",
    shipClass: "Balanced Starter Hull",
    currentNode: "Asteron Prime",
    x: 51,
    y: 50
  });

  const botDisabledEvents = [];
  const botRespawnedEvents = [];
  const roomAShotEvents = [];
  const roomBShotEvents = [];
  const roomAReturnFireEvents = [];
  const rewardPreviewEvents = [];
  const bountyStatusEvents = [];
  roomA.onMessage("bot:disabled", (message) => botDisabledEvents.push(message));
  roomA.onMessage("bot:respawned", (message) => botRespawnedEvents.push(message));
  roomB.onMessage("bot:disabled", () => {});
  roomB.onMessage("bot:respawned", () => {});
  roomA.onMessage("staging:shot", (message) => roomAShotEvents.push(message));
  roomB.onMessage("staging:shot", (message) => roomBShotEvents.push(message));
  roomA.onMessage("staging:return_fire", (message) => roomAReturnFireEvents.push(message));
  roomB.onMessage("staging:return_fire", () => {});
  roomA.onMessage("staging:reward_preview", (message) => rewardPreviewEvents.push(message));
  roomB.onMessage("staging:reward_preview", () => {});
  roomA.onMessage("stagingXp:botKillResult", () => {});
  roomB.onMessage("stagingXp:botKillResult", () => {});
  roomA.onMessage("stagingBounty:statusResult", (message) => bountyStatusEvents.push(message));

  console.log(`joined ${ROOM_NAME}: A=${roomA.sessionId} B=${roomB.sessionId}`);

  await waitFor("both clients to see two players", () => {
    return playerCount(roomA) === 2 && playerCount(roomB) === 2;
  });

  assert(playerFrom(roomA, roomB.sessionId), "Client A cannot see client B.");
  assert(playerFrom(roomB, roomA.sessionId), "Client B cannot see client A.");
  assert(playerFrom(roomA, roomA.sessionId)?.authStatus === "unverified", "Client A fake token did not become unverified.");
  assert(!playerFrom(roomA, roomA.sessionId)?.trustedPlayerId, "Client A fake token created a trusted player id.");
  assert(!playerFrom(roomA, roomA.sessionId)?.playerId, "Client A unverified playerId was trusted.");
  assert(playerFrom(roomA, roomA.sessionId)?.displayName === "Regression Pilot A", "Client A displayName was not preserved.");
  assert(playerFrom(roomB, roomA.sessionId)?.shipImage === "assets/ships/lupen-origin.png", "Client B did not receive Client A ship image.");
  assert(playerFrom(roomB, roomA.sessionId)?.shipClass === "Balanced Starter Hull", "Client B did not receive Client A ship class.");
  assert(playerFrom(roomA, roomB.sessionId)?.authStatus === "unverified", "Client B fake token did not become unverified.");
  assert(!playerFrom(roomA, roomB.sessionId)?.trustedPlayerId, "Client B fake token created a trusted player id.");
  assert(!playerFrom(roomA, roomB.sessionId)?.playerId, "Client B unverified playerId was trusted.");
  assert(playerFrom(roomA, roomA.sessionId)?.supabaseAccessToken === undefined, "Raw Supabase token leaked into room state.");
  console.log("both clients see each other");

  const bountyList = await expectRoomMessage(roomA, "stagingBounty:listResult", () => {
    roomA.send("stagingBounty:list", {});
  });
  assert(bountyList?.ok === true, "Staging bounty list did not return ok.");
  assert(Array.isArray(bountyList?.bounties) && bountyList.bounties.length === 1, "Staging bounty list did not return exactly one bounty.");
  assert(bountyList.bounties[0]?.id === STAGING_BOUNTY_ID, "Staging bounty list returned unexpected bounty id.");
  assert(bountyList.bounties[0]?.requiredKills === 2, "Staging bounty list returned unexpected kill requirement.");
  assert(bountyList.bounties[0]?.xpReward === 40, "Staging bounty list returned unexpected XP reward.");
  assert(bountyList.bounties[0]?.creditsReward === 0, "Staging bounty list returned credits.");

  const bountyAccepted = await expectRoomMessage(roomA, "stagingBounty:statusResult", () => {
    roomA.send("stagingBounty:accept", { bountyId: STAGING_BOUNTY_ID });
  });
  assert(bountyAccepted?.ok === true, "Staging bounty accept did not return ok.");
  assert(bountyAccepted?.reason === "staging_bounty_accepted", `Unexpected staging bounty accept reason: ${bountyAccepted?.reason}`);
  assert(bountyAccepted?.active?.accepted === true, "Accepted staging bounty did not report active.");
  assert(bountyAccepted?.active?.progress === 0, "Accepted staging bounty did not start at zero progress.");
  assert(bountyAccepted?.active?.claimAvailable === false, "Accepted staging bounty was claimable too early.");

  const incompleteBountyClaim = await expectRoomMessage(roomA, "stagingBounty:claimResult", () => {
    roomA.send("stagingBounty:claim", { bountyId: STAGING_BOUNTY_ID });
  });
  assert(incompleteBountyClaim?.ok === false, "Incomplete staging bounty claim was not blocked.");
  assert(incompleteBountyClaim?.reason === "staging_bounty_not_complete", `Unexpected incomplete staging bounty claim reason: ${incompleteBountyClaim?.reason}`);
  assert(incompleteBountyClaim?.applied === false && incompleteBountyClaim?.saveWritten === false, "Incomplete staging bounty claim reported writes.");

  const tradeOffers = await expectStagingTradeOffers(roomA, () => {
    roomA.send("stagingTrade:listOffers", {});
  });
  assert(tradeOffers?.ok === true, "Staging trade offers did not return ok.");
  assert(tradeOffers?.mode === "dry_run", `Unexpected trade offers mode: ${tradeOffers?.mode}`);
  assert(tradeOffers?.applied === false, "Staging trade offers reported applied.");
  assert(Array.isArray(tradeOffers?.offers) && tradeOffers.offers.length >= 3, "Staging trade offers were not deterministic/non-empty.");
  assert(tradeOffers?.creditsWritten === false && tradeOffers?.cargoWritten === false && tradeOffers?.saveWritten === false, "Staging trade offers reported writes.");
  const firstTradeOffer = tradeOffers.offers[0];
  assert(firstTradeOffer?.offerId && firstTradeOffer?.buyPrice > 0 && firstTradeOffer?.sellPrice > firstTradeOffer?.buyPrice, "First staging trade offer is invalid.");

  const validTradePreview = await expectStagingTradePreview(roomA, () => {
    roomA.send("stagingTrade:preview", {
      offerId: firstTradeOffer.offerId,
      quantity: 3,
      playerSnapshot: {
        credits: 10000,
        cargoUsed: 10,
        cargoCapacity: 150
      }
    });
  });
  assert(validTradePreview?.ok === true, `Valid staging trade preview failed: ${validTradePreview?.reason}`);
  assert(validTradePreview?.mode === "dry_run", `Unexpected trade preview mode: ${validTradePreview?.mode}`);
  assert(validTradePreview?.applied === false, "Staging trade preview applied a trade.");
  assert(validTradePreview?.quantity === 3, "Staging trade preview did not preserve requested quantity.");
  assert(validTradePreview?.totalCost === firstTradeOffer.buyPrice * 3, "Staging trade preview total cost was not server-calculated.");
  assert(validTradePreview?.projectedRevenue === firstTradeOffer.sellPrice * 3, "Staging trade preview revenue was not server-calculated.");
  assert(validTradePreview?.projectedProfit === (firstTradeOffer.sellPrice - firstTradeOffer.buyPrice) * 3, "Staging trade preview profit was not server-calculated.");
  assert(validTradePreview?.wouldPass === true, "Valid staging trade preview did not pass snapshot validation.");
  assert(validTradePreview?.validationMode === "snapshot", `Unexpected valid trade validation mode: ${validTradePreview?.validationMode}`);
  assert(validTradePreview?.trustedStateAvailable === false, "Unverified room trade preview unexpectedly used trusted save state.");
  assert(validTradePreview?.snapshotUsed === true, "Unverified room trade preview did not report snapshot use.");
  assert(validTradePreview?.stateSources?.credits === "snapshot", "Unverified room trade preview did not mark credits as snapshot.");
  assert(validTradePreview?.blockReason === null, `Unexpected valid trade block reason: ${validTradePreview?.blockReason}`);
  assert(validTradePreview?.maxAffordableQuantity === Math.floor(10000 / firstTradeOffer.buyPrice), "Staging trade max affordable quantity was incorrect.");
  assert(validTradePreview?.maxCargoQuantity === 140, "Staging trade max cargo quantity was incorrect.");
  assert(validTradePreview?.maxValidQuantity === Math.min(Math.floor(10000 / firstTradeOffer.buyPrice), 140), "Staging trade max valid quantity was incorrect.");
  assert(validTradePreview?.creditsWritten === false && validTradePreview?.cargoWritten === false && validTradePreview?.saveWritten === false, "Staging trade preview reported writes.");

  const storeItems = await expectStagingStoreItems(roomA, () => {
    roomA.send("stagingStore:listItems", {});
  });
  assert(storeItems?.ok === true, "Staging Store items did not return ok.");
  assert(storeItems?.mode === "dry_run", `Unexpected Store item list mode: ${storeItems?.mode}`);
  assert(storeItems?.applied === false, "Staging Store item list reported applied.");
  assert(Array.isArray(storeItems?.items) && storeItems.items.length >= 3, "Staging Store item list was not deterministic/non-empty.");
  assert(storeItems.items.some((item) => item.itemId === "attachment:cargoPod"), "Staging Store item list missing Cargo Pod.");
  assert(storeItems?.creditsWritten === false && storeItems?.inventoryWritten === false && storeItems?.saveWritten === false, "Staging Store item list reported writes.");

  const validStorePreview = await expectStagingStorePreview(roomA, () => {
    roomA.send("stagingStore:previewPurchase", {
      itemId: "attachment:cargoPod",
      quantity: 1,
      playerSnapshot: {
        credits: 1000
      }
    });
  });
  assert(validStorePreview?.ok === true, `Valid staging Store preview failed: ${validStorePreview?.blockReason}`);
  assert(validStorePreview?.mode === "dry_run", `Unexpected Store preview mode: ${validStorePreview?.mode}`);
  assert(validStorePreview?.applied === false, "Staging Store preview applied a purchase.");
  assert(validStorePreview?.operation === "purchase", "Staging Store preview did not report purchase operation.");
  assert(validStorePreview?.itemId === "attachment:cargoPod", "Staging Store preview returned wrong item.");
  assert(validStorePreview?.totalCost === 220, "Staging Store preview did not calculate server cost.");
  assert(validStorePreview?.creditsBefore === 1000 && validStorePreview?.creditsAfterPreview === 780, "Staging Store preview before/after credits were wrong.");
  assert(validStorePreview?.validationMode === "snapshot", `Unexpected Store validation mode: ${validStorePreview?.validationMode}`);
  assert(validStorePreview?.wouldPass === true, "Valid Store preview did not pass.");
  assert(validStorePreview?.creditsWritten === false && validStorePreview?.inventoryWritten === false && validStorePreview?.shipWritten === false && validStorePreview?.equipmentWritten === false && validStorePreview?.saveWritten === false, "Staging Store preview reported writes.");

  const invalidStoreItem = await expectStagingStorePreview(roomA, () => {
    roomA.send("stagingStore:previewPurchase", {
      itemId: "missing:item",
      quantity: 1,
      playerSnapshot: {
        credits: 1000
      }
    });
  });
  assert(invalidStoreItem?.ok === false && invalidStoreItem?.blockReason === "unknown_store_item", "Unknown Store item did not block safely.");
  assert(invalidStoreItem?.saveWritten === false, "Unknown Store item reported save write.");

  const invalidStoreQuantity = await expectStagingStorePreview(roomA, () => {
    roomA.send("stagingStore:previewPurchase", {
      itemId: "attachment:cargoPod",
      quantity: 0,
      playerSnapshot: {
        credits: 1000
      }
    });
  });
  assert(invalidStoreQuantity?.ok === false && invalidStoreQuantity?.blockReason === "invalid_store_quantity", "Invalid Store quantity did not block safely.");

  const insufficientStoreCredits = await expectStagingStorePreview(roomA, () => {
    roomA.send("stagingStore:previewPurchase", {
      itemId: "attachment:shieldBooster",
      quantity: 1,
      playerSnapshot: {
        credits: 100
      }
    });
  });
  assert(insufficientStoreCredits?.ok === false && insufficientStoreCredits?.blockReason === "insufficient_credits", "Insufficient-credit Store preview did not block safely.");
  assert(insufficientStoreCredits?.creditsWritten === false && insufficientStoreCredits?.inventoryWritten === false && insufficientStoreCredits?.saveWritten === false, "Insufficient-credit Store preview reported writes.");

  const defaultStorePurchase = await expectStagingStorePurchase(roomA, () => {
    roomA.send("stagingStore:purchase", {
      itemId: "attachment:cargoPod",
      quantity: 1,
      playerSnapshot: {
        credits: 1000
      }
    });
  });
  assert(defaultStorePurchase?.applied === false, "Default staging Store purchase unexpectedly applied.");
  assert(defaultStorePurchase?.mode === "blocked" || defaultStorePurchase?.mode === "dry_run", `Unexpected default Store purchase mode: ${defaultStorePurchase?.mode}`);
  assert(defaultStorePurchase?.creditsWritten === false && defaultStorePurchase?.attachmentWritten === false && defaultStorePurchase?.saveWritten === false, "Default Store purchase reported writes.");
  assert(defaultStorePurchase?.gates?.writeEnabled === false, "Default Store purchase gate should report writes disabled.");

  const defaultShieldBoosterPurchase = await expectStagingStorePurchase(roomA, () => {
    roomA.send("stagingStore:purchase", {
      itemId: "attachment:shieldBooster",
      quantity: 1,
      playerSnapshot: {
        credits: 1000
      }
    });
  });
  assert(defaultShieldBoosterPurchase?.applied === false, "Default Shield Booster Store purchase unexpectedly applied.");
  assert(defaultShieldBoosterPurchase?.reason === "staging_store_writes_disabled" || defaultShieldBoosterPurchase?.blockReason === "staging_store_writes_disabled", "Default Shield Booster purchase did not stay gated.");
  assert(defaultShieldBoosterPurchase?.saveWritten === false, "Default Shield Booster Store purchase reported save write.");

  const invalidStorePurchaseQuantity = await expectStagingStorePurchase(roomA, () => {
    roomA.send("stagingStore:purchase", {
      itemId: "attachment:cargoPod",
      quantity: 2,
      playerSnapshot: {
        credits: 1000
      }
    });
  });
  assert(invalidStorePurchaseQuantity?.applied === false, "Invalid-quantity Store purchase unexpectedly applied.");
  assert(invalidStorePurchaseQuantity?.blockReason === "invalid_store_quantity", "Quantity above one Store purchase did not block.");
  console.log("staging Store list, previews, and default purchase path stayed safe");

  const insufficientCreditsPreview = await expectStagingTradePreview(roomA, () => {
    roomA.send("stagingTrade:preview", {
      offerId: firstTradeOffer.offerId,
      quantity: 3,
      playerSnapshot: {
        credits: firstTradeOffer.buyPrice - 1,
        cargoUsed: 0,
        cargoCapacity: 150
      }
    });
  });
  assert(insufficientCreditsPreview?.ok === true, "Insufficient-credit staging trade should still return a dry-run preview.");
  assert(insufficientCreditsPreview?.wouldPass === false, "Insufficient-credit staging trade passed validation.");
  assert(insufficientCreditsPreview?.blockReason === "insufficient_credits", `Unexpected insufficient-credit block reason: ${insufficientCreditsPreview?.blockReason}`);
  assert(insufficientCreditsPreview?.creditsWritten === false && insufficientCreditsPreview?.cargoWritten === false && insufficientCreditsPreview?.saveWritten === false, "Insufficient-credit trade preview reported writes.");

  const insufficientCargoPreview = await expectStagingTradePreview(roomA, () => {
    roomA.send("stagingTrade:preview", {
      offerId: firstTradeOffer.offerId,
      quantity: 3,
      playerSnapshot: {
        credits: 10000,
        cargoUsed: 149,
        cargoCapacity: 150
      }
    });
  });
  assert(insufficientCargoPreview?.ok === true, "Insufficient-cargo staging trade should still return a dry-run preview.");
  assert(insufficientCargoPreview?.wouldPass === false, "Insufficient-cargo staging trade passed validation.");
  assert(insufficientCargoPreview?.blockReason === "insufficient_cargo", `Unexpected insufficient-cargo block reason: ${insufficientCargoPreview?.blockReason}`);
  assert(insufficientCargoPreview?.maxCargoQuantity === 1, "Insufficient-cargo max cargo quantity was incorrect.");

  const missingSnapshotTradePreview = await expectStagingTradePreview(roomA, () => {
    roomA.send("stagingTrade:preview", {
      offerId: firstTradeOffer.offerId,
      quantity: 2
    });
  });
  assert(missingSnapshotTradePreview?.ok === true, "Missing snapshot trade preview should still return price math.");
  assert(missingSnapshotTradePreview?.validationMode === "unknown", `Unexpected missing snapshot validation mode: ${missingSnapshotTradePreview?.validationMode}`);
  assert(missingSnapshotTradePreview?.trustedStateAvailable === false, "Missing snapshot trade preview unexpectedly had trusted state.");
  assert(missingSnapshotTradePreview?.snapshotUsed === false, "Missing snapshot trade preview unexpectedly used snapshot.");
  assert(missingSnapshotTradePreview?.blockReason === "unknown_player_state", `Unexpected missing snapshot block reason: ${missingSnapshotTradePreview?.blockReason}`);
  assert(missingSnapshotTradePreview?.totalCost === firstTradeOffer.buyPrice * 2, "Missing snapshot trade preview did not include total cost.");
  assert(missingSnapshotTradePreview?.projectedRevenue === firstTradeOffer.sellPrice * 2, "Missing snapshot trade preview did not include projected revenue.");
  assert(missingSnapshotTradePreview?.projectedProfit === (firstTradeOffer.sellPrice - firstTradeOffer.buyPrice) * 2, "Missing snapshot trade preview did not include projected profit.");

  const malformedSnapshotTradePreview = await expectStagingTradePreview(roomA, () => {
    roomA.send("stagingTrade:preview", {
      offerId: firstTradeOffer.offerId,
      quantity: 2,
      playerSnapshot: {
        credits: "not-a-number",
        cargoUsed: {},
        cargoCapacity: null
      }
    });
  });
  assert(malformedSnapshotTradePreview?.ok === true, "Malformed snapshot trade preview should still return price math.");
  assert(malformedSnapshotTradePreview?.validationMode === "unknown", `Unexpected malformed snapshot validation mode: ${malformedSnapshotTradePreview?.validationMode}`);
  assert(malformedSnapshotTradePreview?.blockReason === "unknown_player_state", `Unexpected malformed snapshot block reason: ${malformedSnapshotTradePreview?.blockReason}`);
  assert(malformedSnapshotTradePreview?.creditsWritten === false && malformedSnapshotTradePreview?.cargoWritten === false && malformedSnapshotTradePreview?.saveWritten === false, "Malformed snapshot trade preview reported writes.");

  const unknownTradePreview = await expectStagingTradePreview(roomA, () => {
    roomA.send("stagingTrade:preview", {
      offerId: "not-a-real-offer",
      quantity: 1
    });
  });
  assert(unknownTradePreview?.ok === false, "Unknown staging trade offer was not rejected.");
  assert(unknownTradePreview?.reason === "unknown_trade_offer", `Unexpected unknown trade reason: ${unknownTradePreview?.reason}`);
  assert(unknownTradePreview?.creditsWritten === false && unknownTradePreview?.cargoWritten === false && unknownTradePreview?.saveWritten === false, "Rejected unknown trade preview reported writes.");

  const invalidQuantityPreview = await expectStagingTradePreview(roomA, () => {
    roomA.send("stagingTrade:preview", {
      offerId: firstTradeOffer.offerId,
      quantity: 0
    });
  });
  assert(invalidQuantityPreview?.ok === false, "Invalid staging trade quantity was not rejected.");
  assert(invalidQuantityPreview?.reason === "invalid_trade_quantity", `Unexpected invalid quantity reason: ${invalidQuantityPreview?.reason}`);
  assert(invalidQuantityPreview?.wouldPass === false, "Invalid staging trade quantity reported wouldPass.");
  assert(invalidQuantityPreview?.blockReason === "invalid_quantity", `Unexpected invalid quantity block reason: ${invalidQuantityPreview?.blockReason}`);

  const productionLikeQuantityPreview = await expectStagingTradePreview(roomA, () => {
    roomA.send("stagingTrade:preview", {
      offerId: firstTradeOffer.offerId,
      quantity: 40,
      playerSnapshot: {
        credits: 10000,
        cargoUsed: 0,
        cargoCapacity: 150
      }
    });
  });
  assert(productionLikeQuantityPreview?.ok === true, `40-unit staging trade preview unexpectedly failed: ${productionLikeQuantityPreview?.reason}`);
  assert(productionLikeQuantityPreview?.wouldPass === true, `40-unit staging trade preview did not pass: ${productionLikeQuantityPreview?.blockReason}`);
  assert(productionLikeQuantityPreview?.totalCost === firstTradeOffer.buyPrice * 40, "40-unit staging trade preview total cost was incorrect.");

  const buyDryRun = await expectStagingTradeWriteResult(roomA, "buy", () => {
    roomA.send("stagingTrade:buy", {
      offerId: firstTradeOffer.offerId,
      quantity: 3,
      playerSnapshot: {
        credits: 10000,
        cargoUsed: 10,
        cargoCapacity: 150
      }
    });
  });
  assert(buyDryRun?.ok === true, `stagingTrade:buy dry-run failed: ${buyDryRun?.reason}`);
  assert(buyDryRun?.mode === "dry_run", `Unexpected buy dry-run mode: ${buyDryRun?.mode}`);
  assert(buyDryRun?.operation === "buy", "Buy dry-run did not report buy operation.");
  assert(buyDryRun?.applied === false, "Buy dry-run applied a trade.");
  assert(buyDryRun?.creditsWritten === false && buyDryRun?.cargoWritten === false && buyDryRun?.saveWritten === false, "Buy dry-run reported writes.");
  assert(buyDryRun?.writes?.inventoryWritten === false && buyDryRun?.writes?.lootWritten === false && buyDryRun?.writes?.bountyWritten === false, "Buy dry-run reported non-trade writes.");
  assert(buyDryRun?.cost === firstTradeOffer.buyPrice * 3, "Buy dry-run cost was not server-calculated.");
  assert(buyDryRun?.creditsDelta === -(firstTradeOffer.buyPrice * 3), "Buy dry-run credits delta was incorrect.");
  assert(buyDryRun?.cargoDelta === 3, "Buy dry-run cargo delta was incorrect.");
  assert(buyDryRun?.gates?.writeEnabled === false, "Buy dry-run reported write gate enabled by default.");
  assert(buyDryRun?.gates?.dryRun === true, "Buy dry-run did not report dryRun gate.");

  const sellDryRun = await expectStagingTradeWriteResult(roomA, "sell", () => {
    roomA.send("stagingTrade:sell", {
      offerId: firstTradeOffer.offerId,
      quantity: 3,
      playerSnapshot: {
        credits: 10000,
        cargoUsed: 10,
        cargoCapacity: 150
      }
    });
  });
  assert(sellDryRun?.ok === false, "Unverified sell dry-run unexpectedly claimed full validation.");
  assert(sellDryRun?.mode === "blocked", `Unexpected sell dry-run mode: ${sellDryRun?.mode}`);
  assert(sellDryRun?.operation === "sell", "Sell dry-run did not report sell operation.");
  assert(sellDryRun?.applied === false, "Sell dry-run applied a trade.");
  assert(sellDryRun?.reason === "unknown_resource_cargo", `Unexpected sell dry-run reason: ${sellDryRun?.reason}`);
  assert(sellDryRun?.creditsWritten === false && sellDryRun?.cargoWritten === false && sellDryRun?.saveWritten === false, "Sell dry-run reported writes.");

  const unknownBuy = await expectStagingTradeWriteResult(roomA, "buy", () => {
    roomA.send("stagingTrade:buy", {
      offerId: "not-a-real-offer",
      quantity: 1
    });
  });
  assert(unknownBuy?.ok === false && unknownBuy?.reason === "unknown_trade_offer", "Unknown buy offer did not block safely.");
  assert(unknownBuy?.saveWritten === false, "Unknown buy offer reported save write.");

  const unknownSell = await expectStagingTradeWriteResult(roomA, "sell", () => {
    roomA.send("stagingTrade:sell", {
      offerId: "not-a-real-offer",
      quantity: 1
    });
  });
  assert(unknownSell?.ok === false && unknownSell?.reason === "unknown_trade_offer", "Unknown sell offer did not block safely.");
  assert(unknownSell?.saveWritten === false, "Unknown sell offer reported save write.");

  const invalidBuyQuantity = await expectStagingTradeWriteResult(roomA, "buy", () => {
    roomA.send("stagingTrade:buy", {
      offerId: firstTradeOffer.offerId,
      quantity: 0
    });
  });
  assert(invalidBuyQuantity?.ok === false && invalidBuyQuantity?.reason === "invalid_trade_quantity", "Invalid buy quantity did not block safely.");

  const excessiveSellQuantity = await expectStagingTradeWriteResult(roomA, "sell", () => {
    roomA.send("stagingTrade:sell", {
      offerId: firstTradeOffer.offerId,
      quantity: 1001
    });
  });
  assert(excessiveSellQuantity?.ok === false && excessiveSellQuantity?.reason === "quantity_exceeds_staging_trade_write_limit", "Excessive sell quantity did not block safely.");

  const insufficientBuyCredits = await expectStagingTradeWriteResult(roomA, "buy", () => {
    roomA.send("stagingTrade:buy", {
      offerId: firstTradeOffer.offerId,
      quantity: 3,
      playerSnapshot: {
        credits: firstTradeOffer.buyPrice - 1,
        cargoUsed: 0,
        cargoCapacity: 150
      }
    });
  });
  assert(insufficientBuyCredits?.ok === false && insufficientBuyCredits?.reason === "insufficient_credits", "Insufficient-credit buy did not block safely.");
  assert(insufficientBuyCredits?.saveWritten === false, "Insufficient-credit buy reported save write.");

  const insufficientBuyCargo = await expectStagingTradeWriteResult(roomA, "buy", () => {
    roomA.send("stagingTrade:buy", {
      offerId: firstTradeOffer.offerId,
      quantity: 3,
      playerSnapshot: {
        credits: 10000,
        cargoUsed: 149,
        cargoCapacity: 150
      }
    });
  });
  assert(insufficientBuyCargo?.ok === false && insufficientBuyCargo?.reason === "insufficient_cargo", "Insufficient-cargo buy did not block safely.");
  assert(insufficientBuyCargo?.saveWritten === false, "Insufficient-cargo buy reported save write.");

  console.log("staging trade dry-run offers and previews stayed write-free");

  const unsafeShipImageWarning = await expectPresenceWarning(roomA, () => {
    roomA.send("presence:update", {
      currentNode: "Asteron Prime",
      x: 50,
      y: 50,
      shipImage: "https://example.com/not-allowed.png"
    });
  });
  assert(unsafeShipImageWarning?.reason === "shipImage path is unsafe", `Unexpected unsafe ship image warning: ${unsafeShipImageWarning?.reason}`);
  assert(playerFrom(roomB, roomA.sessionId)?.shipImage === "assets/ships/lupen-origin.png", "Unsafe ship image changed stored ship metadata.");
  console.log("unsafe ship image metadata rejected safely");

  await waitFor("dummy bots to appear", () => botCount(roomA) > 0 && botCount(roomB) > 0);
  assertAllowedBotNodes(roomA);
  assertAllowedBotNodes(roomB);
  assertBotDisplayFields(roomA);
  assertBotDisplayFields(roomB);
  console.log(`dummy bot count: A=${botCount(roomA)} B=${botCount(roomB)}`);
  const initialBotUpdateAt = latestBotUpdateAt(roomA);
  const initialBotNodes = botSnapshots(roomA).map((bot) => `${bot.id}:${bot.currentNode}`).join("|");

  await waitFor("shared server bot update", () => {
    return latestBotUpdateAt(roomA) > initialBotUpdateAt &&
      latestBotUpdateAt(roomB) >= latestBotUpdateAt(roomA) &&
      botSnapshotKey(roomA) === botSnapshotKey(roomB);
  }, 7000);
  console.log("both clients received matching server bot movement update");

  await waitFor("a staging bot node change", () => {
    assertAllowedBotNodes(roomA);
    assertAllowedBotNodes(roomB);
    assertBotDisplayFields(roomA);
    assertBotDisplayFields(roomB);
    const currentBotNodes = botSnapshots(roomA).map((bot) => `${bot.id}:${bot.currentNode}`).join("|");
    return currentBotNodes !== initialBotNodes && botSnapshotKey(roomA) === botSnapshotKey(roomB);
  }, 22000);
  console.log("staging bot node change stayed on allowed combat nodes");

  const inspectedBotBeforeCombat = botSnapshots(roomA)[0];
  assert(inspectedBotBeforeCombat, "No staging bot available for combat intent test.");

  await moveAndSelectBot(roomA, inspectedBotBeforeCombat.id, "Regression Pilot A");
  console.log("staging bot lock-on selected for display only");

  const combatResponse = await expectCombatResolved(roomA, () => {
    roomA.send("combat:intent", {
      targetBotId: inspectedBotBeforeCombat.id,
      weaponId: "pulseLaser",
      weaponName: "Regression Pulse Laser",
      weaponFamily: "pulse",
      damage: 9999,
      cooldownMs: 900,
      currentNode: inspectedBotBeforeCombat.currentNode,
      timestamp: Date.now()
    });
  });

  assert(combatResponse?.ok === true, "Valid staging combat intent did not resolve.");
  assert(combatResponse?.reason === "staging_damage_applied", `Unexpected combat response: ${combatResponse?.reason}`);
  assert(combatResponse?.damage === 10, `Unexpected Pulse Laser staging damage amount: ${combatResponse?.damage}`);
  assert(combatResponse?.stagingDamage === 10, `Unexpected Pulse Laser validated staging damage: ${combatResponse?.stagingDamage}`);
  assert(combatResponse?.serverDamageUsed === 10, `Unexpected Pulse Laser server damage: ${combatResponse?.serverDamageUsed}`);
  assert(combatResponse?.requestedDamage === 9999, "Combat response did not preserve requested damage for diagnostics.");
  assert(combatResponse?.damageSource === "server_known_weapon", `Pulse Laser did not use server-known weapon stats: ${combatResponse?.damageSource}`);
  assert(combatResponse?.fallbackDamageUsed === false, "Pulse Laser incorrectly used fallback damage.");
  assert(combatResponse?.pulseLaserDetected === true, "Pulse Laser was not detected by server weapon resolver.");
  assert(combatResponse?.weaponName === "Pulse Laser", "Combat response did not use server-known weapon name.");
  assert(combatResponse?.rewardsGranted === false, "Staging combat intent granted rewards.");

  await waitFor("client A to receive light staging return fire", () => {
    const returnFire = roomAReturnFireEvents.find((event) => event?.attackerBotId === inspectedBotBeforeCombat.id);
    return returnFire &&
      returnFire.damage === 4 &&
      returnFire.sessionOnly === true &&
      returnFire.persisted === false &&
      returnFire.saveWritten === false &&
      returnFire.playerDeathEnabled === false &&
      returnFire.cargoLossEnabled === false;
  });
  console.log("staging bot return fire stayed light and session-only");

  await waitFor("both clients to receive staging shot event", () => {
    const shotA = roomAShotEvents.find((event) => event?.targetBotId === inspectedBotBeforeCombat.id && event?.damage === 10);
    const shotB = roomBShotEvents.find((event) => event?.targetBotId === inspectedBotBeforeCombat.id && event?.damage === 10);
    return shotA && shotB &&
      shotA.attackerSessionId === roomA.sessionId &&
      shotB.attackerSessionId === roomA.sessionId &&
      shotA.currentNode === inspectedBotBeforeCombat.currentNode &&
      shotB.currentNode === inspectedBotBeforeCombat.currentNode &&
      shotA.weaponName === "Pulse Laser" &&
      shotB.weaponName === "Pulse Laser" &&
      shotA.damageSource === "server_known_weapon" &&
      shotB.damageSource === "server_known_weapon" &&
      shotA.rewardsGranted === false &&
      shotB.rewardsGranted === false;
  });
  console.log("both clients received staging shot visual event");

  await waitFor("client B to receive server staging damage", () => {
    const botA = botSnapshots(roomA).find((bot) => bot.id === inspectedBotBeforeCombat.id);
    const botB = botSnapshots(roomB).find((bot) => bot.id === inspectedBotBeforeCombat.id);
    return botA && botB &&
      botA.shield === combatResponse.shield &&
      botA.hull === combatResponse.hull &&
      botB.shield === combatResponse.shield &&
      botB.hull === combatResponse.hull;
  });

  const inspectedBotAfterCombat = botSnapshots(roomA).find((bot) => bot.id === inspectedBotBeforeCombat.id);
  const healthBeforeCombat = Number(inspectedBotBeforeCombat.shield) + Number(inspectedBotBeforeCombat.hull);
  const healthAfterCombat = Number(inspectedBotAfterCombat.shield) + Number(inspectedBotAfterCombat.hull);
  assert(healthAfterCombat === healthBeforeCombat - 10, "Combat intent did not apply server-known Pulse Laser staging damage.");
  assert(inspectedBotAfterCombat?.visualOnly === true, "Combat intent changed visualOnly flag.");
  console.log("combat intent applied weapon-based staging damage without rewards");

  const cooldownRejected = await expectCombatRejected(roomA, () => {
    roomA.send("combat:intent", {
      targetBotId: inspectedBotBeforeCombat.id,
      weaponId: "pulseLaser",
      weaponFamily: "pulse",
      damage: 9999,
      cooldownMs: 900,
      currentNode: inspectedBotBeforeCombat.currentNode,
      timestamp: Date.now()
    });
  });

  assert(cooldownRejected?.reason === "staging_fire_cooldown", `Unexpected cooldown rejection: ${cooldownRejected?.reason}`);
  assert(Number(cooldownRejected?.cooldownRemainingMs || 0) > 0, "Cooldown rejection did not include remaining time.");
  assert(cooldownRejected?.rewardsGranted === false, "Cooldown rejection granted rewards.");
  await sleep(250);
  const inspectedBotAfterCooldownReject = botById(roomA, inspectedBotBeforeCombat.id);
  assert(inspectedBotAfterCooldownReject?.shield === inspectedBotAfterCombat.shield, "Cooldown rejection changed bot shield.");
  assert(inspectedBotAfterCooldownReject?.hull === inspectedBotAfterCombat.hull, "Cooldown rejection changed bot hull.");
  console.log("immediate second combat intent rejected by staging cooldown");

  const botForClientB = await moveAndSelectBot(roomB, inspectedBotBeforeCombat.id, "Regression Pilot B");
  const clientBContributionResponse = await expectCombatResolved(roomB, () => {
    roomB.send("combat:intent", {
      targetBotId: botForClientB.id,
      weaponId: "supportLaser",
      weaponName: "Regression Support Laser",
      weaponFamily: "pulse",
      damage: 10,
      cooldownMs: 900,
      currentNode: botForClientB.currentNode,
      timestamp: Date.now()
    });
  });

  assert(clientBContributionResponse?.ok === true, "Client B staging combat intent did not resolve.");
  assert(clientBContributionResponse?.damage === 5, `Unknown client B weapon should use fallback damage: ${clientBContributionResponse?.damage}`);
  assert(clientBContributionResponse?.damageSource === "fallback_unknown_weapon", `Unknown client B weapon had unexpected damage source: ${clientBContributionResponse?.damageSource}`);
  assert(clientBContributionResponse?.fallbackDamageUsed === true, "Unknown client B weapon did not report fallback damage.");
  assert(clientBContributionResponse?.rewardsGranted === false, "Client B staging combat intent granted rewards.");
  await waitFor("both clients to receive client B contribution damage", () => {
    const botA = botById(roomA, inspectedBotBeforeCombat.id);
    const botB = botById(roomB, inspectedBotBeforeCombat.id);
    return botA && botB &&
      botA.shield === clientBContributionResponse.shield &&
      botA.hull === clientBContributionResponse.hull &&
      botB.shield === clientBContributionResponse.shield &&
      botB.hull === clientBContributionResponse.hull;
  });
  const inspectedBotAfterClientBCombat = botById(roomA, inspectedBotBeforeCombat.id);
  console.log("client B contributed staging damage to shared bot");

  await waitForFireReady(roomA, roomA.sessionId);
  const oversizedCombatResponse = await expectCombatResolved(roomA, () => {
    roomA.send("combat:intent", {
      targetBotId: inspectedBotBeforeCombat.id,
      weaponId: "oversizedTest",
      weaponName: "Oversized Test Weapon",
      weaponFamily: "test",
      damage: 9999,
      cooldownMs: 900,
      currentNode: inspectedBotBeforeCombat.currentNode,
      timestamp: Date.now()
    });
  });

  assert(oversizedCombatResponse?.stagingDamage === 5, `Oversized unknown weapon did not use fallback damage: ${oversizedCombatResponse?.stagingDamage}`);
  assert(oversizedCombatResponse?.requestedDamage === 9999, "Oversized requested damage was not kept for diagnostics.");
  assert(oversizedCombatResponse?.damageSource === "fallback_unknown_weapon", `Oversized unknown weapon had unexpected source: ${oversizedCombatResponse?.damageSource}`);
  assert(oversizedCombatResponse?.rewardsGranted === false, "Oversized staging combat intent granted rewards.");
  await waitFor("client B to receive clamped oversized staging damage", () => {
    const botA = botById(roomA, inspectedBotBeforeCombat.id);
    const botB = botById(roomB, inspectedBotBeforeCombat.id);
    return botA && botB &&
      botA.shield === oversizedCombatResponse.shield &&
      botA.hull === oversizedCombatResponse.hull &&
      botB.shield === oversizedCombatResponse.shield &&
      botB.hull === oversizedCombatResponse.hull;
  });
  const inspectedBotAfterOversizedCombat = botById(roomA, inspectedBotBeforeCombat.id);
  assert(botHealthTotal(inspectedBotAfterOversizedCombat) === botHealthTotal(inspectedBotAfterClientBCombat) - 5, "Oversized unknown weapon did not apply fallback staging damage.");
  console.log("oversized unknown weapon damage ignored in favor of server fallback");

  await waitForFireReady(roomA, roomA.sessionId);
  const invalidWeaponCombatResponse = await expectCombatResolved(roomA, () => {
    roomA.send("combat:intent", {
      targetBotId: inspectedBotBeforeCombat.id,
      weaponId: "invalidDamageTest",
      weaponName: "Invalid Damage Test",
      weaponFamily: "test",
      damage: "not-a-number",
      cooldownMs: 900,
      currentNode: inspectedBotBeforeCombat.currentNode,
      timestamp: Date.now()
    });
  });

  assert(invalidWeaponCombatResponse?.stagingDamage === 5, `Invalid weapon payload did not use fallback damage: ${invalidWeaponCombatResponse?.stagingDamage}`);
  assert(invalidWeaponCombatResponse?.rewardsGranted === false, "Invalid weapon staging combat intent granted rewards.");
  await waitFor("client B to receive fallback staging damage", () => {
    const botA = botById(roomA, inspectedBotBeforeCombat.id);
    const botB = botById(roomB, inspectedBotBeforeCombat.id);
    return botA && botB &&
      botA.shield === invalidWeaponCombatResponse.shield &&
      botA.hull === invalidWeaponCombatResponse.hull &&
      botB.shield === invalidWeaponCombatResponse.shield &&
      botB.hull === invalidWeaponCombatResponse.hull;
  });
  const inspectedBotAfterInvalidCombat = botById(roomA, inspectedBotBeforeCombat.id);
  assert(botHealthTotal(inspectedBotAfterInvalidCombat) === botHealthTotal(inspectedBotAfterOversizedCombat) - 5, "Fallback damage did not apply expected staging damage.");
  console.log("invalid weapon payload used fallback staging damage without rewards");

  await waitForFireReady(roomA, roomA.sessionId);
  const noWeaponCombatResponse = await expectCombatResolved(roomA, () => {
    roomA.send("combat:intent", {
      targetBotId: inspectedBotBeforeCombat.id,
      currentNode: inspectedBotBeforeCombat.currentNode,
      timestamp: Date.now()
    });
  });

  assert(noWeaponCombatResponse?.stagingDamage === 5, `No-weapon payload did not use fallback damage: ${noWeaponCombatResponse?.stagingDamage}`);
  assert(noWeaponCombatResponse?.damageSource === "fallback_no_weapon", `No-weapon payload had unexpected source: ${noWeaponCombatResponse?.damageSource}`);
  assert(noWeaponCombatResponse?.fallbackDamageUsed === true, "No-weapon payload did not report fallback damage.");
  assert(noWeaponCombatResponse?.rewardsGranted === false, "No-weapon staging combat intent granted rewards.");
  await waitFor("both clients to receive no-weapon fallback damage", () => {
    const botA = botById(roomA, inspectedBotBeforeCombat.id);
    const botB = botById(roomB, inspectedBotBeforeCombat.id);
    return botA && botB &&
      botA.shield === noWeaponCombatResponse.shield &&
      botA.hull === noWeaponCombatResponse.hull &&
      botB.shield === noWeaponCombatResponse.shield &&
      botB.hull === noWeaponCombatResponse.hull;
  });
  const inspectedBotAfterNoWeaponCombat = botById(roomA, inspectedBotBeforeCombat.id);
  console.log("no equipped weapon payload used fallback staging damage without rewards");

  let latestCombatBot = inspectedBotAfterNoWeaponCombat;
  const maxFollowUpShots = Math.ceil(botHealthTotal(latestCombatBot) / 10) + 4;
  for (let shot = 0; shot < maxFollowUpShots && !latestCombatBot.disabled; shot += 1) {
    await waitForFireReady(roomA, roomA.sessionId);
    const currentBot = await moveAndSelectBot(roomA, inspectedBotBeforeCombat.id, "Regression Pilot A");
    const response = await expectCombatResolved(roomA, () => {
      roomA.send("combat:intent", {
        targetBotId: currentBot.id,
        weaponId: "pulseLaser",
        weaponName: "Regression Pulse Laser",
        weaponFamily: "pulse",
        damage: 50,
        cooldownMs: 900,
        currentNode: currentBot.currentNode,
        timestamp: Date.now()
      });
    });

    assert(response?.rewardsGranted === false, "Repeated staging combat intent granted rewards.");
    latestCombatBot = botById(roomA, inspectedBotBeforeCombat.id);
    if (response?.disabled === true) {
      latestCombatBot = {
        ...latestCombatBot,
        disabled: true
      };
      break;
    }
  }

  assert(latestCombatBot?.disabled === true, "Repeated valid staging hits did not disable the bot.");
  await waitFor("client B to receive disabled bot state", () => {
    const botA = botById(roomA, inspectedBotBeforeCombat.id);
    const botB = botById(roomB, inspectedBotBeforeCombat.id);
    return botA?.disabled === true && botB?.disabled === true &&
      botA.shield === botB.shield &&
      botA.hull === botB.hull;
  });
  assert(botDisabledEvents.some((event) => event?.botId === inspectedBotBeforeCombat.id), "bot:disabled event was not observed.");
  await waitFor("staging reward preview after bot disabled", () => {
    return rewardPreviewEvents.some((event) => {
      const contributors = Array.isArray(event?.contributors) ? event.contributors : [];
      const contributorIds = contributors.map((contributor) => contributor?.sessionId);
      return event?.botId === inspectedBotBeforeCombat.id &&
        event?.disabledBySessionId === roomA.sessionId &&
        event?.finalHitBy === roomA.sessionId &&
        event?.finalHitPlayerId === "" &&
        event?.topContributorSessionId === roomA.sessionId &&
        event?.topContributorPlayerId === "" &&
        contributorIds.includes(roomA.sessionId) &&
        contributorIds.includes(roomB.sessionId) &&
        event?.applied === false &&
        event?.dryRun === true &&
        event?.reason === "staging_preview_only" &&
        Array.isArray(event?.previewLoot) &&
        event?.lootPreview?.mode === "preview_only";
    });
  });
  const rewardPreview = rewardPreviewEvents.find((event) => event?.botId === inspectedBotBeforeCombat.id && event?.finalHitBy === roomA.sessionId);
  await waitFor("staging bounty progress after contributed bot destruction", () => {
    return bountyStatusEvents.some((event) => {
      return event?.reason === "progress_updated" &&
        event?.active?.id === STAGING_BOUNTY_ID &&
        event?.active?.progress === 1 &&
        event?.active?.requiredKills === 2 &&
        event?.active?.claimAvailable === false;
    });
  });
  console.log("staging bounty progress advanced after contributed bot destruction");
  const contributorA = rewardPreview?.contributors?.find((contributor) => contributor?.sessionId === roomA.sessionId);
  const contributorB = rewardPreview?.contributors?.find((contributor) => contributor?.sessionId === roomB.sessionId);
  assert(contributorA?.totalDamage > contributorB?.totalDamage, "Top contributor did not have the largest damage contribution.");
  assert(contributorA?.hits > 0 && contributorB?.hits === 1, "Contribution hit counts were not recorded correctly.");
  assert(Number(contributorA?.percent || 0) > Number(contributorB?.percent || 0), "Contribution percentages were not calculated correctly.");
  assert(!contributorA?.trustedPlayerId && !contributorA?.playerId, "Contributor A unverified identity was trusted.");
  assert(!contributorB?.trustedPlayerId && !contributorB?.playerId, "Contributor B unverified identity was trusted.");
  assert(contributorA?.displayName === "Regression Pilot A", "Contributor A display name was not included in preview.");
  assert(rewardPreview?.previewXp === 8, `Unexpected reward preview XP: ${rewardPreview?.previewXp}`);
  assert(rewardPreview?.previewCredits === 0, `Unexpected reward preview credits: ${rewardPreview?.previewCredits}`);
  assert(rewardPreview?.inventoryWritten === false && rewardPreview?.saveWritten === false, "Reward preview reported inventory/save writes.");
  assert(rewardPreview?.creditsWritten === false && rewardPreview?.cargoWritten === false && rewardPreview?.bountyWritten === false, "Reward preview reported economy/bounty writes.");
  assert(rewardPreview?.lootPreview?.available === true, "Reward preview did not include available loot preview.");
  assert(rewardPreview?.lootPreview?.mode === "preview_only", "Reward preview loot mode was not preview_only.");
  assert(rewardPreview?.lootPreview?.eligibleSessionIds?.includes(roomA.sessionId), "Final hitter was not eligible for loot preview.");
  assert(rewardPreview?.lootPreview?.eligibleSessionIds?.includes(roomB.sessionId), "Contributor was not eligible for loot preview.");
  assert(Array.isArray(rewardPreview?.lootPreview?.items) && rewardPreview.lootPreview.items.length > 0, "Reward preview loot items were missing.");
  assert(rewardPreview.lootPreview.items.every((item) => item.lootId && item.name && item.inventoryWritable === false), "Reward preview loot items were not preview-only.");
  assert(rewardPreview.lootPreview.inventoryWritten === false && rewardPreview.lootPreview.saveWritten === false, "Loot preview reported forbidden inventory/save writes.");
  const playerAfterRewardPreview = playerFrom(roomA, roomA.sessionId);
  assert(playerAfterRewardPreview && !("xp" in playerAfterRewardPreview), "Reward preview created player XP field.");
  assert(playerAfterRewardPreview && !("credits" in playerAfterRewardPreview), "Reward preview created player credits field.");
  assert(playerAfterRewardPreview && !("inventory" in playerAfterRewardPreview), "Reward preview created player inventory field.");
  const claimPreviewResult = await expectRewardClaimResult(roomA, () => {
    roomA.send("reward:claim_preview", {
      botId: rewardPreview.botId,
      rewardPreviewId: rewardPreview.rewardPreviewId
    });
  });
  assert(claimPreviewResult?.ok === true, "Contributor reward preview claim simulation did not succeed.");
  assert(claimPreviewResult?.applied === false, "Reward preview claim simulation applied real rewards.");
  assert(claimPreviewResult?.dryRun === true, "Reward preview claim simulation was not marked dry-run.");
  assert(["identity_unverified", "reward_application_not_eligible", "staging_preview_only"].includes(claimPreviewResult?.reason), `Unexpected reward claim simulation reason: ${claimPreviewResult?.reason}`);
  assert(claimPreviewResult?.claimSimulated === true, "Reward preview claim result was not marked simulated.");
  assert(claimPreviewResult?.mode === "blocked", `Unexpected reward claim summary mode: ${claimPreviewResult?.mode}`);
  assert(claimPreviewResult?.xpDelta > 0, "Reward claim summary did not include XP delta.");
  assert(claimPreviewResult?.debugReason === "reward_application_not_eligible" || claimPreviewResult?.debugReason === "identity_unverified", `Unexpected reward claim debug reason: ${claimPreviewResult?.debugReason}`);
  assert(claimPreviewResult?.gates?.verified === false, "Unverified reward claim summary reported verified gate.");
  assert(claimPreviewResult?.gates?.xpWriteAllowed === false, "Unverified reward claim summary allowed XP writes.");
  assert(claimPreviewResult?.ledger?.written === false, "Reward claim summary reported ledger write by default.");
  assert(claimPreviewResult?.progressionShadow?.written === false, "Reward claim summary reported progression shadow write by default.");
  assert(claimPreviewResult?.playerSave?.attempted === true, "Reward claim summary did not report player_saves attempt.");
  assert(claimPreviewResult?.playerSave?.written === false, "Reward claim summary reported player_saves write.");
  assert(claimPreviewResult?.playerSave?.creditsWritten === false, "Reward claim summary reported credits write.");
  assert(claimPreviewResult?.claimStatus?.mode === claimPreviewResult?.mode, "Nested claim status mode did not match top-level mode.");
  assert(claimPreviewResult?.claimStatus?.playerSave?.creditsWritten === false, "Nested claim status reported credits write.");
  assert(claimPreviewResult?.rewardWritePlan?.dryRun === true, "Reward claim did not include a dry-run write plan.");
  assert(claimPreviewResult?.rewardWritePlan?.applied === false, "Reward write plan applied real rewards.");
  assert(claimPreviewResult?.rewardWritePlan?.eligible === false, "Unverified reward write plan was eligible.");
  assert(claimPreviewResult?.rewardWritePlan?.blockedReason === "identity_unverified", `Unexpected unverified blocked reason: ${claimPreviewResult?.rewardWritePlan?.blockedReason}`);
  assert(claimPreviewResult?.rewardWritePlan?.intendedXp > 0, "Reward write plan did not include intended XP.");
  assert(claimPreviewResult?.rewardWritePlan?.intendedCredits === 0, "Reward write plan attempted to include intended credits.");
  assert(Array.isArray(claimPreviewResult?.rewardWritePlan?.intendedLoot) && claimPreviewResult.rewardWritePlan.intendedLoot.length === 0, "Reward write plan attempted to include loot writes.");
  assert(claimPreviewResult?.lootPreview?.mode === "preview_only", "Reward claim did not echo preview-only loot contract.");
  assert(claimPreviewResult?.lootPreview?.inventoryWritten === false && claimPreviewResult?.lootPreview?.saveWritten === false, "Reward claim loot preview reported writes.");
  assert(claimPreviewResult?.rewardLedgerResult?.dryRun === true, "Reward ledger result was not dry-run.");
  assert(claimPreviewResult?.rewardLedgerResult?.applied === false, "Reward ledger result applied rewards.");
  assert(claimPreviewResult?.rewardLedgerResult?.skippedReason === "reward_writes_disabled", `Unexpected reward ledger skipped reason: ${claimPreviewResult?.rewardLedgerResult?.skippedReason}`);
  assert(claimPreviewResult?.rewardLedgerEntry?.dry_run === true, "Reward ledger entry was not marked dry-run.");
  assert(claimPreviewResult?.rewardLedgerEntry?.applied === false, "Reward ledger entry was applied.");
  assert(claimPreviewResult?.rewardApplicationPlan?.dryRun === true, "Reward application plan was not dry-run.");
  assert(claimPreviewResult?.rewardApplicationPlan?.applied === false, "Reward application plan applied progression.");
  assert(claimPreviewResult?.rewardApplicationPlan?.eligible === false, "Unverified reward application plan was eligible.");
  assert(claimPreviewResult?.rewardApplicationPlan?.blockedReason === "identity_unverified", `Unexpected reward application blocked reason: ${claimPreviewResult?.rewardApplicationPlan?.blockedReason}`);
  assert(claimPreviewResult?.rewardApplicationPlan?.xpDelta > 0, "Reward application plan did not include XP delta.");
  assert(claimPreviewResult?.rewardApplicationPlan?.creditsDelta === 0, "Reward application plan attempted to include credits delta.");
  assert(claimPreviewResult?.rewardApplicationResult?.dryRun === true, "Reward application result was not dry-run.");
  assert(claimPreviewResult?.rewardApplicationResult?.applied === false, "Reward application result applied progression.");
  assert(claimPreviewResult?.rewardApplicationResult?.skippedReason === "reward_application_not_eligible", `Unexpected reward application skipped reason: ${claimPreviewResult?.rewardApplicationResult?.skippedReason}`);
  assert(claimPreviewResult?.progressionPreview?.dryRun === true, "Progression preview was not dry-run.");
  assert(claimPreviewResult?.progressionPreview?.applied === false, "Progression preview applied progression.");
  assert(claimPreviewResult?.progressionPreview?.available === false, "Unverified progression preview was unexpectedly available.");
  assert(claimPreviewResult?.progressionPreview?.reason === "identity_unverified", `Unexpected unverified progression preview reason: ${claimPreviewResult?.progressionPreview?.reason}`);
  assert(claimPreviewResult?.progressionShadowEntry?.dry_run === true, "Progression shadow entry was not dry-run.");
  assert(claimPreviewResult?.progressionShadowEntry?.applied_to_real_save === false, "Progression shadow entry applied to real save.");
  assert(claimPreviewResult?.progressionShadowResult?.dryRun === true, "Progression shadow result was not dry-run.");
  assert(claimPreviewResult?.progressionShadowResult?.applied === false, "Progression shadow result applied progression.");
  assert(claimPreviewResult?.progressionShadowResult?.skippedReason === "progression_shadow_writes_disabled", `Unexpected progression shadow skipped reason: ${claimPreviewResult?.progressionShadowResult?.skippedReason}`);
  assert(claimPreviewResult?.playerSavePatchPlan?.dryRun === true, "player_saves patch plan was not dry-run.");
  assert(claimPreviewResult?.playerSavePatchPlan?.applied === false, "player_saves patch plan applied progression.");
  assert(claimPreviewResult?.playerSavePatchPlan?.eligible === false, "Unverified player_saves patch plan was eligible.");
  assert(claimPreviewResult?.playerSavePatchPlan?.skippedReason === "reward_application_not_eligible", `Unexpected player_saves patch skipped reason: ${claimPreviewResult?.playerSavePatchPlan?.skippedReason}`);
  assert(claimPreviewResult?.playerSavePatchResult?.dryRun === true, "player_saves patch result was not dry-run.");
  assert(claimPreviewResult?.playerSavePatchResult?.applied === false, "player_saves patch result applied progression.");
  assert(claimPreviewResult?.playerSavePatchResult?.progressionWritesEnabled === false, "player_saves patch result reported writes enabled by default.");
  assert(claimPreviewResult?.playerSavePatchResult?.stagingWriteAllowlistPresent === false, "player_saves patch result reported allow-list present by default.");
  assert(claimPreviewResult?.playerSavePatchResult?.playerInStagingWriteAllowlist === false, "player_saves patch result allow-listed player by default.");
  assert(claimPreviewResult?.playerSavePatchResult?.skippedReason === "progression_writes_disabled", `Unexpected player_saves patch result reason: ${claimPreviewResult?.playerSavePatchResult?.skippedReason}`);
  assert(Array.isArray(claimPreviewResult?.contributors), "Reward claim result did not include contributors.");
  assert(claimPreviewResult?.contributors?.some((contributor) => contributor?.sessionId === roomA.sessionId), "Reward claim result missing claimant contribution.");
  assert(claimPreviewResult?.finalHitPlayerId === "", "Unverified reward claim result included a trusted final hit player id.");
  assert(claimPreviewResult?.topContributorPlayerId === "", "Unverified reward claim result included a trusted top contributor player id.");
  assert(!("xp" in playerFrom(roomA, roomA.sessionId)), "Reward preview claim created player XP field.");
  assert(!("credits" in playerFrom(roomA, roomA.sessionId)), "Reward preview claim created player credits field.");
  assert(!("inventory" in playerFrom(roomA, roomA.sessionId)), "Reward preview claim created player inventory field.");

  const lootClaimResult = await expectRoomMessage(roomA, "stagingLoot:claimResult", () => {
    roomA.send("stagingLoot:claim", {
      botId: rewardPreview.botId,
      rewardPreviewId: rewardPreview.rewardPreviewId,
      lootId: "preview:lupenShard"
    });
  });
  assert(lootClaimResult?.ok === false, "Unverified Lupen Shard claim was not blocked.");
  assert(lootClaimResult?.applied === false, "Unverified Lupen Shard claim applied.");
  assert(lootClaimResult?.writes?.materialWritten === false, "Unverified Lupen Shard claim reported material write.");
  assert(lootClaimResult?.writes?.inventoryWritten === false, "Unverified Lupen Shard claim reported inventory write.");
  assert(lootClaimResult?.writes?.creditsWritten === false, "Unverified Lupen Shard claim reported credits write.");
  assert(lootClaimResult?.writes?.saveWritten === false, "Unverified Lupen Shard claim reported save write.");
  assert(lootClaimResult?.reason === "identity_unverified", `Unexpected unverified Lupen Shard claim reason: ${lootClaimResult?.reason}`);

  const unsupportedLootClaim = await expectRoomMessage(roomA, "stagingLoot:claimResult", () => {
    roomA.send("stagingLoot:claim", {
      botId: rewardPreview.botId,
      rewardPreviewId: rewardPreview.rewardPreviewId,
      lootId: "preview:pulseLaser"
    });
  });
  assert(unsupportedLootClaim?.ok === false, "Unsupported staging loot claim was not blocked.");
  assert(unsupportedLootClaim?.reason === "loot_item_not_allowed", `Unexpected unsupported staging loot reason: ${unsupportedLootClaim?.reason}`);
  assert(unsupportedLootClaim?.ownedGunsWritten === false && unsupportedLootClaim?.saveWritten === false, "Unsupported staging loot reported writes.");

  roomC = await clientC.joinOrCreate(ROOM_NAME, {
    displayName: "Regression Pilot C",
    currentShipId: "lupenOrigin",
    shipName: "LF-1 Origin",
    currentNode: "Asteron Prime",
    x: 52,
    y: 50
  });
  await waitFor("client C guest identity to appear", () => {
    return !!playerFrom(roomC, roomC.sessionId);
  });
  assert(playerFrom(roomC, roomC.sessionId)?.authStatus === "guest", "Guest staging identity did not fall back to guest.");
  assert(!playerFrom(roomC, roomC.sessionId)?.playerId, "Guest staging identity unexpectedly had a playerId.");
  const nonContributorClaim = await expectRewardClaimResult(roomC, () => {
    roomC.send("reward:claim_preview", {
      botId: rewardPreview.botId,
      rewardPreviewId: rewardPreview.rewardPreviewId
    });
  });
  assert(nonContributorClaim?.ok === false, "Non-contributor reward preview claim was not rejected.");
  assert(nonContributorClaim?.reason === "reward_preview_not_eligible", `Unexpected non-contributor reward claim reason: ${nonContributorClaim?.reason}`);
  assert(nonContributorClaim?.mode === "blocked", `Unexpected non-contributor claim mode: ${nonContributorClaim?.mode}`);
  assert(nonContributorClaim?.playerSave?.written === false, "Rejected non-contributor claim reported player_saves write.");
  assert(nonContributorClaim?.playerSave?.creditsWritten === false, "Rejected non-contributor claim reported credits write.");
  assert(nonContributorClaim?.applied === false, "Rejected non-contributor reward claim applied rewards.");
  const nonContributorLootClaim = await expectRoomMessage(roomC, "stagingLoot:claimResult", () => {
    roomC.send("stagingLoot:claim", {
      botId: rewardPreview.botId,
      rewardPreviewId: rewardPreview.rewardPreviewId,
      lootId: "preview:lupenShard"
    });
  });
  assert(nonContributorLootClaim?.ok === false, "Non-contributor Lupen Shard claim was not rejected.");
  assert(nonContributorLootClaim?.reason === "reward_preview_not_eligible", `Unexpected non-contributor Lupen Shard reason: ${nonContributorLootClaim?.reason}`);
  assert(nonContributorLootClaim?.saveWritten === false && nonContributorLootClaim?.inventoryWritten === false, "Rejected non-contributor Lupen Shard claim reported writes.");
  await leaveRoom(roomC);
  roomC = null;
  console.log("reward preview claim simulation stayed preview-only");
  console.log("staging Lupen Shard claim path stayed blocked/no-write for unverified and non-contributors");
  console.log("repeated valid hits disabled staging bot without rewards");

  await waitForFireReady(roomA, roomA.sessionId);
  const disabledBotBeforeRejectedHit = botById(roomA, inspectedBotBeforeCombat.id);
  const disabledCombatResponse = await expectCombatRejected(roomA, () => {
    roomA.send("combat:intent", {
      targetBotId: inspectedBotBeforeCombat.id,
      weaponId: "pulseLaser",
      weaponFamily: "pulse",
      currentNode: disabledBotBeforeRejectedHit.currentNode,
      timestamp: Date.now()
    });
  });
  assert(disabledCombatResponse?.reason === "combat_intent_rejected", "Disabled bot combat intent did not reject.");
  assert(disabledCombatResponse?.validation === "staging_bot_disabled", `Unexpected disabled bot validation: ${disabledCombatResponse?.validation}`);
  await sleep(250);
  const disabledBotAfterRejectedHit = botById(roomA, inspectedBotBeforeCombat.id);
  assert(disabledBotAfterRejectedHit?.shield === disabledBotBeforeRejectedHit.shield, "Disabled bot took shield damage.");
  assert(disabledBotAfterRejectedHit?.hull === disabledBotBeforeRejectedHit.hull, "Disabled bot took hull damage.");
  console.log("disabled bot rejected further staging damage");

  await waitFor("disabled staging bot to respawn on both clients", () => {
    const botA = botById(roomA, inspectedBotBeforeCombat.id);
    const botB = botById(roomB, inspectedBotBeforeCombat.id);
    return botA && botB &&
      botA.disabled === false &&
      botB.disabled === false &&
      botA.shield === botA.shieldMax &&
      botA.hull === botA.hullMax &&
      botB.shield === botA.shield &&
      botB.hull === botA.hull &&
      botB.currentNode === botA.currentNode;
  }, 12000);
  assert(botRespawnedEvents.some((event) => event?.botId === inspectedBotBeforeCombat.id), "bot:respawned event was not observed.");
  assert(botRespawnedEvents.some((event) => {
    return event?.botId === inspectedBotBeforeCombat.id &&
      event?.contributionCleared === true &&
      Array.isArray(event?.contributors) &&
      event.contributors.length === 0;
  }), "bot:respawned did not confirm contribution data was cleared.");
  assertAllowedBotNodes(roomA);
  assertAllowedBotNodes(roomB);
  console.log("disabled staging bot respawned with matching shared state");

  let respawnedBot = botById(roomA, inspectedBotBeforeCombat.id);
  const maxSecondKillShots = Math.ceil(botHealthTotal(respawnedBot) / 10) + 4;
  for (let shot = 0; shot < maxSecondKillShots && !respawnedBot.disabled; shot += 1) {
    await waitForFireReady(roomA, roomA.sessionId);
    const currentBot = await moveAndSelectBot(roomA, inspectedBotBeforeCombat.id, "Regression Pilot A");
    const response = await expectCombatResolved(roomA, () => {
      roomA.send("combat:intent", {
        targetBotId: currentBot.id,
        weaponId: "pulseLaser",
        weaponName: "Regression Pulse Laser",
        weaponFamily: "pulse",
        currentNode: currentBot.currentNode,
        timestamp: Date.now()
      });
    });
    assert(response?.rewardsGranted === false, "Second staging bot destruction granted rewards.");
    respawnedBot = botById(roomA, inspectedBotBeforeCombat.id);
    if (response?.disabled === true) {
      respawnedBot = {
        ...respawnedBot,
        disabled: true
      };
      break;
    }
  }
  assert(respawnedBot?.disabled === true, "Respawned staging bot was not disabled by a legitimate second kill.");
  await waitFor("staging bounty completes after second legitimate destruction", () => {
    return bountyStatusEvents.some((event) => {
      return event?.reason === "completed" &&
        event?.active?.id === STAGING_BOUNTY_ID &&
        event?.active?.progress === 2 &&
        event?.active?.requiredKills === 2 &&
        event?.active?.claimAvailable === true;
    });
  });
  console.log("staging bounty counted a second legitimate respawned bot destruction");

  roomA.send("movement:update", {
    displayName: "Regression Pilot A",
    currentShipId: "lupenOrigin",
    shipName: "LF-1 Origin",
    shipImage: "assets/ships/lupen-origin.png",
    shipClass: "Balanced Starter Hull",
    currentNode: "East Link 1",
    x: 64,
    y: 42
  });

  await waitFor("client B to receive client A movement", () => {
    const playerA = playerFrom(roomB, roomA.sessionId);
    return playerA &&
      playerA.currentNode === "East Link 1" &&
      playerA.shipImage === "assets/ships/lupen-origin.png" &&
      playerA.x === 64 &&
      playerA.y === 42;
  });
  console.log("client B received client A movement update");

  await waitFor("staging target to clear after node change", () => {
    return !playerFrom(roomA, roomA.sessionId)?.selectedTargetBotId;
  });

  const wrongNodeSelection = await expectTargetRejected(roomA, () => {
    roomA.send("target:select", {
      targetBotId: inspectedBotBeforeCombat.id,
      currentNode: "East Link 1"
    });
  });
  assert(wrongNodeSelection?.reason, "Wrong-node staging bot selection did not return a rejection reason.");

  const missingBotSelection = await expectTargetRejected(roomA, () => {
    roomA.send("target:select", {
      targetBotId: "missing-staging-bot",
      currentNode: "East Link 1"
    });
  });
  assert(missingBotSelection?.reason?.includes("unknown staging bot"), "Missing staging bot selection did not reject as unknown.");
  console.log("invalid staging bot lock-on requests rejected safely");

  const warning = await expectPresenceWarning(roomA, () => {
    roomA.send("movement:update", {
      currentNode: "Invalid Node",
      x: 999999,
      y: 42
    });
  });

  assert(warning?.reason, "Invalid movement did not include a warning reason.");
  await new Promise((resolve) => setTimeout(resolve, 250));

  const playerAAfterInvalidMove = playerFrom(roomB, roomA.sessionId);
  assert(playerAAfterInvalidMove?.currentNode === "East Link 1", "Invalid movement changed currentNode.");
  assert(playerAAfterInvalidMove?.x === 64, "Invalid movement changed x.");
  assert(playerAAfterInvalidMove?.y === 42, "Invalid movement changed y.");
  console.log(`invalid movement ignored with warning: ${warning.reason}`);

  const sessionA = roomA.sessionId;
  await leaveRoom(roomA);
  roomA = null;

  await waitFor("client B to see client A removed", () => {
    return playerCount(roomB) === 1 && !playerFrom(roomB, sessionA);
  });
  console.log("client B saw client A leave");

  await leaveRoom(roomB);
  roomB = null;

  console.log("regression test passed");
} finally {
  await leaveRoom(roomA);
  await leaveRoom(roomB);
  await leaveRoom(roomC);
}
