import { Client } from "colyseus.js";
import { ROOM_NAME } from "../src/app.config.js";
import {
  STAGING_BOT_ALLOWED_NODE_IDS,
  buildRewardWritePlan,
  verifySupabaseAccessToken
} from "../src/rooms/LupenSectorRoom.js";
import {
  buildStagingTradePreview,
  buildStagingTradeWriteDryRun
} from "../src/config/stagingTradeConfig.js";
import {
  buildStagingStorePurchasePreview,
  getStagingStoreItems
} from "../src/config/stagingStoreConfig.js";
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
  buildStagingPulseLaserEquipPlan,
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

async function assertStagingTradeValidationHelpers() {
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
  assert(extracted.stateSources.credits === "trusted_save", "Trusted trade credits source was not marked trusted.");

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
              cargoCapacity: 12
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
  assert(sellWriteDryRun.revenue === 50, `Unexpected sell write revenue: ${sellWriteDryRun.revenue}`);
  assert(sellWriteDryRun.creditsDelta === 50, `Unexpected sell credits delta: ${sellWriteDryRun.creditsDelta}`);
  assert(sellWriteDryRun.cargoDelta === -2, `Unexpected sell cargo delta: ${sellWriteDryRun.cargoDelta}`);
  assert(sellWriteDryRun.validationMode === "trusted_save_limited", `Unexpected limited sell validation mode: ${sellWriteDryRun.validationMode}`);
  assert(sellWriteDryRun.writes.saveWritten === false, "Sell write dry-run reported save write.");

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

  const nonCargoItem = items.find((item) => item.itemId === "attachment:shieldBooster");
  const nonCargoPatch = buildStagingStorePurchasePatch(validSaveData, nonCargoItem, 1);
  assert(nonCargoPatch.ok === false && nonCargoPatch.blockReason === "store_item_preview_only", "Non-Cargo Pod Store write did not stay preview-only.");

  const invalidQuantityPatch = buildStagingStorePurchasePatch(validSaveData, cargoPodItem, 2);
  assert(invalidQuantityPatch.ok === false && invalidQuantityPatch.blockReason === "invalid_store_quantity", "Quantity above one was not blocked.");

  const insufficientCreditPatch = buildStagingStorePurchasePatch({ ...validSaveData, credits: 10 }, cargoPodItem, 1);
  assert(insufficientCreditPatch.ok === false && insufficientCreditPatch.blockReason === "insufficient_credits", "Insufficient-credit Cargo Pod write was not blocked.");

  const insufficientPulseLaserCreditPatch = buildStagingStorePurchasePatch({ ...validSaveData, credits: 10 }, pulseLaserItem, 1);
  assert(insufficientPulseLaserCreditPatch.ok === false && insufficientPulseLaserCreditPatch.blockReason === "insufficient_credits", "Insufficient-credit Pulse Laser write was not blocked.");

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

  console.log("staging Store item list, previews, and gated Cargo Pod/Pulse Laser write helpers passed");
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

  console.log("staging Cargo Pod/Pulse Laser equip helpers and gated loadout write passed");
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
    STAGING_STORE_WRITE_ALLOWED_ITEMS: "attachment:cargoPod",
    STAGING_LOADOUT_WRITE_ENABLED: "true",
    STAGING_LOADOUT_WRITE_DRY_RUN: "false",
    STAGING_LOADOUT_WRITE_SCOPE: "allowlist",
    STAGING_LOADOUT_WRITE_ALLOWLIST: "verified-player-a",
    STAGING_LOADOUT_WRITE_ALLOWED_ITEMS: "attachment:cargoPod",
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
  assert(loopSave.inventoryItems[0].id === "untouched-inventory", "Full loop changed inventory.");
  assert(loopSave.ownedShips[0] === "lupenOrigin", "Full loop changed ships.");
  assert(loopSave.ownedGuns.pulseLaser === 1, "Full loop changed weapons.");
  assert(loopSave.activeBountyId === "untouched-bounty", "Full loop changed bounty state.");
  assert(loopSave.playerProgress.combatXp === 33, "Full loop changed broad progression.");
  assert(loopSave.playerProgress.totals.tradesCompleted === 4, "Full loop changed route completion totals.");
  assert(loopSave.playerProgress.totals.cargoSold === 9, "Full loop changed cargo sold totals.");
  assert(loopSave.playerProgress.totals.tradeProfit === 222, "Full loop changed trade profit totals.");
  assert(loopSave.marker.keep === true, "Full loop changed unrelated save fields.");
  assert(fetchCalls.join(",") === "GET,PATCH,GET,PATCH,GET,PATCH,GET,PATCH", `Full loop expected four read/write pairs, got ${fetchCalls.join(",")}.`);

  console.log("full Cargo Pod purchase/equip/trade-more loop passed with mocked player_saves");
}

async function assertIdentityVerificationAndRewardPlanHelpers() {
  const verified = await verifySupabaseAccessToken(
    "stub-valid-token",
    {
      SUPABASE_URL: "https://example.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "stub-service-key"
    },
    async (_url, options = {}) => {
      assert(options.headers?.authorization === "Bearer stub-valid-token", "Verification did not use bearer token.");
      assert(options.headers?.apikey === "stub-service-key", "Verification did not use service key.");
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
  assert(enabledApplicationResult?.dryRun === true, "Enabled placeholder application adapter did not stay dry-run.");
  assert(enabledApplicationResult?.applied === false, "Enabled placeholder application adapter applied progression.");
  assert(enabledApplicationResult?.idempotencyReady === true, "Enabled placeholder application adapter did not keep idempotency ready.");
  assert(enabledApplicationResult?.skippedReason === "progression_write_adapter_not_implemented", `Unexpected enabled placeholder application reason: ${enabledApplicationResult?.skippedReason}`);

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
              save_data: validMockSaveData
            }];
          }
        };
      }

      if (options.method === "PATCH") {
        return {
          ok: true,
          status: 200,
          async json() {
            return [];
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
  assert(patchedBody.save_data.credits === 1200, "Patched save_data changed credits.");
  assert(patchedBody.save_data.playerProgress.level === 3, "Patched save_data changed unrelated playerProgress level.");
  assert(patchedBody.save_data.inventoryItems.length === 2, "Patched save_data changed inventory item count.");
  assert(patchedBody.save_data.inventoryItems[0].id === "loot-a", "Patched save_data changed inventory contents.");

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
  await assertStagingStorePreviewHelpers();
  await assertStagingCargoPodEquipHelpers();
  await assertFullCargoPodTradeLoopHelpers();
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
  const rewardPreviewEvents = [];
  roomA.onMessage("bot:disabled", (message) => botDisabledEvents.push(message));
  roomA.onMessage("bot:respawned", (message) => botRespawnedEvents.push(message));
  roomB.onMessage("bot:disabled", () => {});
  roomB.onMessage("bot:respawned", () => {});
  roomA.onMessage("staging:shot", (message) => roomAShotEvents.push(message));
  roomB.onMessage("staging:shot", (message) => roomBShotEvents.push(message));
  roomA.onMessage("staging:reward_preview", (message) => rewardPreviewEvents.push(message));
  roomB.onMessage("staging:reward_preview", () => {});

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
  assert(validTradePreview?.maxValidQuantity === Math.min(Math.floor(10000 / firstTradeOffer.buyPrice), 140, firstTradeOffer.maxQuantity), "Staging trade max valid quantity was incorrect.");
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

  const previewOnlyStorePurchase = await expectStagingStorePurchase(roomA, () => {
    roomA.send("stagingStore:purchase", {
      itemId: "attachment:shieldBooster",
      quantity: 1,
      playerSnapshot: {
        credits: 1000
      }
    });
  });
  assert(previewOnlyStorePurchase?.applied === false, "Preview-only Store purchase unexpectedly applied.");
  assert(previewOnlyStorePurchase?.reason === "store_item_preview_only" || previewOnlyStorePurchase?.blockReason === "store_item_preview_only", "Non-Cargo Pod Store purchase did not stay preview-only.");
  assert(previewOnlyStorePurchase?.saveWritten === false, "Preview-only Store purchase reported save write.");

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

  const excessiveQuantityPreview = await expectStagingTradePreview(roomA, () => {
    roomA.send("stagingTrade:preview", {
      offerId: firstTradeOffer.offerId,
      quantity: Number(firstTradeOffer.maxQuantity || 0) + 1
    });
  });
  assert(excessiveQuantityPreview?.ok === false, "Excessive staging trade quantity was not rejected.");
  assert(excessiveQuantityPreview?.reason === "quantity_exceeds_staging_offer_limit", `Unexpected excessive quantity reason: ${excessiveQuantityPreview?.reason}`);
  assert(excessiveQuantityPreview?.wouldPass === false, "Excessive staging trade quantity reported wouldPass.");
  assert(excessiveQuantityPreview?.blockReason === "invalid_quantity", `Unexpected excessive quantity block reason: ${excessiveQuantityPreview?.blockReason}`);

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
      quantity: 999
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
      damage: 12,
      cooldownMs: 900,
      currentNode: inspectedBotBeforeCombat.currentNode,
      timestamp: Date.now()
    });
  });

  assert(combatResponse?.ok === true, "Valid staging combat intent did not resolve.");
  assert(combatResponse?.reason === "staging_damage_applied", `Unexpected combat response: ${combatResponse?.reason}`);
  assert(combatResponse?.damage === 12, `Unexpected staging damage amount: ${combatResponse?.damage}`);
  assert(combatResponse?.stagingDamage === 12, `Unexpected validated staging damage: ${combatResponse?.stagingDamage}`);
  assert(combatResponse?.weaponName === "Regression Pulse Laser", "Combat response did not echo safe weapon name.");
  assert(combatResponse?.rewardsGranted === false, "Staging combat intent granted rewards.");

  await waitFor("both clients to receive staging shot event", () => {
    const shotA = roomAShotEvents.find((event) => event?.targetBotId === inspectedBotBeforeCombat.id && event?.damage === 12);
    const shotB = roomBShotEvents.find((event) => event?.targetBotId === inspectedBotBeforeCombat.id && event?.damage === 12);
    return shotA && shotB &&
      shotA.attackerSessionId === roomA.sessionId &&
      shotB.attackerSessionId === roomA.sessionId &&
      shotA.currentNode === inspectedBotBeforeCombat.currentNode &&
      shotB.currentNode === inspectedBotBeforeCombat.currentNode &&
      shotA.weaponName === "Regression Pulse Laser" &&
      shotB.weaponName === "Regression Pulse Laser" &&
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
  assert(healthAfterCombat === healthBeforeCombat - 12, "Combat intent did not apply weapon-based staging damage.");
  assert(inspectedBotAfterCombat?.visualOnly === true, "Combat intent changed visualOnly flag.");
  console.log("combat intent applied weapon-based staging damage without rewards");

  const cooldownRejected = await expectCombatRejected(roomA, () => {
    roomA.send("combat:intent", {
      targetBotId: inspectedBotBeforeCombat.id,
      weaponId: "pulseLaser",
      weaponFamily: "pulse",
      damage: 12,
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
  assert(clientBContributionResponse?.damage === 10, `Unexpected client B contribution damage: ${clientBContributionResponse?.damage}`);
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

  assert(oversizedCombatResponse?.stagingDamage === 50, `Oversized weapon damage was not clamped: ${oversizedCombatResponse?.stagingDamage}`);
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
  assert(botHealthTotal(inspectedBotAfterOversizedCombat) === botHealthTotal(inspectedBotAfterClientBCombat) - 50, "Clamped oversized damage did not apply expected staging damage.");
  console.log("oversized staging weapon damage clamped safely");

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

  let latestCombatBot = inspectedBotAfterInvalidCombat;
  const maxFollowUpShots = Math.ceil(botHealthTotal(latestCombatBot) / 50) + 4;
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
        Array.isArray(event?.previewLoot);
    });
  });
  const rewardPreview = rewardPreviewEvents.find((event) => event?.botId === inspectedBotBeforeCombat.id && event?.finalHitBy === roomA.sessionId);
  const contributorA = rewardPreview?.contributors?.find((contributor) => contributor?.sessionId === roomA.sessionId);
  const contributorB = rewardPreview?.contributors?.find((contributor) => contributor?.sessionId === roomB.sessionId);
  assert(contributorA?.totalDamage > contributorB?.totalDamage, "Top contributor did not have the largest damage contribution.");
  assert(contributorA?.hits > 0 && contributorB?.hits === 1, "Contribution hit counts were not recorded correctly.");
  assert(Number(contributorA?.percent || 0) > Number(contributorB?.percent || 0), "Contribution percentages were not calculated correctly.");
  assert(!contributorA?.trustedPlayerId && !contributorA?.playerId, "Contributor A unverified identity was trusted.");
  assert(!contributorB?.trustedPlayerId && !contributorB?.playerId, "Contributor B unverified identity was trusted.");
  assert(contributorA?.displayName === "Regression Pilot A", "Contributor A display name was not included in preview.");
  assert(rewardPreview?.previewXp === 5, `Unexpected reward preview XP: ${rewardPreview?.previewXp}`);
  assert(rewardPreview?.previewCredits === 0, `Unexpected reward preview credits: ${rewardPreview?.previewCredits}`);
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
  assert(claimPreviewResult?.reason === "staging_preview_only", `Unexpected reward claim simulation reason: ${claimPreviewResult?.reason}`);
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
  await leaveRoom(roomC);
  roomC = null;
  console.log("reward preview claim simulation stayed preview-only");
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
