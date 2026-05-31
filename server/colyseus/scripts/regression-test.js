import { Client } from "colyseus.js";
import { ROOM_NAME } from "../src/app.config.js";
import {
  STAGING_BOT_ALLOWED_NODE_IDS,
  buildRewardWritePlan,
  verifySupabaseAccessToken
} from "../src/rooms/LupenSectorRoom.js";
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
      previewXp: 25,
      previewCredits: 40,
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
  assert(plan.intendedXp === 20, `Unexpected verified dry-run XP: ${plan.intendedXp}`);
  assert(plan.intendedCredits === 32, `Unexpected verified dry-run credits: ${plan.intendedCredits}`);
  const ledgerEntry = buildRewardLedgerEntry(plan, {
    roomName: ROOM_NAME,
    sourceEventId: "reward-preview-stub"
  });
  assert(ledgerEntry.player_id === "verified-player-a", "Ledger entry did not include verified player id.");
  assert(ledgerEntry.xp_amount === 20, `Unexpected ledger XP amount: ${ledgerEntry.xp_amount}`);
  assert(ledgerEntry.credits_amount === 32, `Unexpected ledger credits amount: ${ledgerEntry.credits_amount}`);
  assert(ledgerEntry.dry_run === true && ledgerEntry.applied === false, "Ledger entry was not dry-run/unapplied.");

  const applicationPlan = buildRewardApplicationPlan(plan, {
    sourceLedgerId: "ledger-row-1",
    sourceEventId: "reward-preview-stub"
  });
  assert(applicationPlan.eligible === true, "Verified application plan was not eligible.");
  assert(applicationPlan.playerId === "verified-player-a", "Verified application plan did not include player id.");
  assert(applicationPlan.xpDelta === 20, `Unexpected application XP delta: ${applicationPlan.xpDelta}`);
  assert(applicationPlan.creditsDelta === 32, `Unexpected application credits delta: ${applicationPlan.creditsDelta}`);
  assert(applicationPlan.sourceLedgerId === "ledger-row-1", "Application plan did not include source ledger id.");
  assert(applicationPlan.sourceEventId === "reward-preview-stub", "Application plan did not include source event id.");
  assert(applicationPlan.applied === false && applicationPlan.dryRun === true, "Application plan was not dry-run/unapplied.");
  const disabledApplicationResult = await applyRewardApplicationPlan(applicationPlan, {
    env: {
      ENABLE_STAGING_PROGRESSION_WRITES: "false"
    }
  });
  assert(disabledApplicationResult?.dryRun === true, "Disabled application adapter did not return dryRun true.");
  assert(disabledApplicationResult?.applied === false, "Disabled application adapter applied progression.");
  assert(disabledApplicationResult?.skippedReason === "progression_writes_disabled", `Unexpected disabled application reason: ${disabledApplicationResult?.skippedReason}`);

  const enabledApplicationResult = await applyRewardApplicationPlan(applicationPlan, {
    env: {
      ENABLE_STAGING_PROGRESSION_WRITES: "true"
    }
  });
  assert(enabledApplicationResult?.dryRun === true, "Enabled placeholder application adapter did not stay dry-run.");
  assert(enabledApplicationResult?.applied === false, "Enabled placeholder application adapter applied progression.");
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
            save_data: {
              credits: 1200,
              playerProgress: {
                combatXp: 80,
                level: 3
              },
              inventoryItems: [{ id: "loot-a" }, { id: "loot-b" }]
            }
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
  assert(progressionPreview?.previewXp === 100, `Unexpected preview XP: ${progressionPreview?.previewXp}`);
  assert(progressionPreview?.currentCredits === 1200, `Unexpected current credits preview: ${progressionPreview?.currentCredits}`);
  assert(progressionPreview?.previewCredits === 1232, `Unexpected preview credits: ${progressionPreview?.previewCredits}`);
  assert(progressionPreview?.applied === false && progressionPreview?.dryRun === true, "Progression preview was not dry-run/unapplied.");
  assert(progressionPreview?.progressionWritesEnabled === false, "Progression preview enabled writes.");

  const unavailableProgressionPreview = buildProgressionPreview(missingSaveContext, applicationPlan);
  assert(unavailableProgressionPreview?.available === false, "Missing-save progression preview was available.");
  assert(unavailableProgressionPreview?.reason === "save_missing", `Unexpected missing-save progression preview reason: ${unavailableProgressionPreview?.reason}`);

  const shadowEntry = buildProgressionShadowEntry(applicationPlan, progressionPreview, {
    ledgerId: "11111111-1111-4111-8111-111111111111",
    entry: ledgerEntry
  });
  assert(shadowEntry.player_id === "verified-player-a", "Progression shadow entry did not include verified player id.");
  assert(shadowEntry.xp_delta === 20, `Unexpected shadow XP delta: ${shadowEntry.xp_delta}`);
  assert(shadowEntry.credits_delta === 32, `Unexpected shadow credits delta: ${shadowEntry.credits_delta}`);
  assert(shadowEntry.current_xp === 80 && shadowEntry.preview_xp === 100, "Shadow entry did not include progression preview XP.");
  assert(shadowEntry.current_credits === 1200 && shadowEntry.preview_credits === 1232, "Shadow entry did not include progression preview credits.");
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
    intendedXp: 20,
    intendedCredits: 32
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
      previewXp: 25,
      previewCredits: 40
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
  await assertIdentityVerificationAndRewardPlanHelpers();

  roomA = await clientA.joinOrCreate(ROOM_NAME, {
    displayName: "Regression Pilot A",
    authStatus: "authenticated",
    playerId: "stub-player-a",
    supabaseUserId: "stub-player-a",
    supabaseAccessToken: "fake-token-a",
    currentShipId: "lupenOrigin",
    shipName: "LF-1 Origin",
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
  assert(playerFrom(roomA, roomB.sessionId)?.authStatus === "unverified", "Client B fake token did not become unverified.");
  assert(!playerFrom(roomA, roomB.sessionId)?.trustedPlayerId, "Client B fake token created a trusted player id.");
  assert(!playerFrom(roomA, roomB.sessionId)?.playerId, "Client B unverified playerId was trusted.");
  assert(playerFrom(roomA, roomA.sessionId)?.supabaseAccessToken === undefined, "Raw Supabase token leaked into room state.");
  console.log("both clients see each other");

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
  assert(rewardPreview?.previewXp === 25, `Unexpected reward preview XP: ${rewardPreview?.previewXp}`);
  assert(rewardPreview?.previewCredits === 40, `Unexpected reward preview credits: ${rewardPreview?.previewCredits}`);
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
  assert(claimPreviewResult?.rewardWritePlan?.dryRun === true, "Reward claim did not include a dry-run write plan.");
  assert(claimPreviewResult?.rewardWritePlan?.applied === false, "Reward write plan applied real rewards.");
  assert(claimPreviewResult?.rewardWritePlan?.eligible === false, "Unverified reward write plan was eligible.");
  assert(claimPreviewResult?.rewardWritePlan?.blockedReason === "identity_unverified", `Unexpected unverified blocked reason: ${claimPreviewResult?.rewardWritePlan?.blockedReason}`);
  assert(claimPreviewResult?.rewardWritePlan?.intendedXp > 0, "Reward write plan did not include intended XP.");
  assert(claimPreviewResult?.rewardWritePlan?.intendedCredits > 0, "Reward write plan did not include intended credits.");
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
  assert(claimPreviewResult?.rewardApplicationPlan?.creditsDelta > 0, "Reward application plan did not include credits delta.");
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
    currentNode: "East Link 1",
    x: 64,
    y: 42
  });

  await waitFor("client B to receive client A movement", () => {
    const playerA = playerFrom(roomB, roomA.sessionId);
    return playerA &&
      playerA.currentNode === "East Link 1" &&
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
