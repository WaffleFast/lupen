import { Client } from "colyseus.js";
import { ROOM_NAME } from "../src/app.config.js";
import { STAGING_BOT_ALLOWED_NODE_IDS } from "../src/rooms/LupenSectorRoom.js";

const endpoint = process.env.COLYSEUS_ENDPOINT || "ws://localhost:2567";
const clientA = new Client(endpoint);
const clientB = new Client(endpoint);

let roomA = null;
let roomB = null;

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

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForFireReady(room, sessionId) {
  await waitFor("staging fire cooldown", () => {
    return Number(playerFrom(room, sessionId)?.nextFireAt || 0) <= Date.now();
  }, 4000);
}

async function moveAndSelectBot(room, botId) {
  const bot = botById(room, botId);
  assert(bot, `Missing staging bot ${botId}.`);

  room.send("movement:update", {
    displayName: "Regression Pilot A",
    currentShipId: "lupenOrigin",
    shipName: "LF-1 Origin",
    currentNode: bot.currentNode,
    x: bot.x,
    y: bot.y
  });

  await waitFor("client A presence to reach selected staging bot node", () => {
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
  roomA = await clientA.joinOrCreate(ROOM_NAME, {
    displayName: "Regression Pilot A",
    currentShipId: "lupenOrigin",
    shipName: "LF-1 Origin",
    currentNode: "Asteron Prime",
    x: 50,
    y: 50
  });

  roomB = await clientB.joinOrCreate(ROOM_NAME, {
    displayName: "Regression Pilot B",
    currentShipId: "lupenOrigin",
    shipName: "LF-1 Origin",
    currentNode: "Asteron Prime",
    x: 51,
    y: 50
  });

  const botDisabledEvents = [];
  const botRespawnedEvents = [];
  roomA.onMessage("bot:disabled", (message) => botDisabledEvents.push(message));
  roomA.onMessage("bot:respawned", (message) => botRespawnedEvents.push(message));
  roomB.onMessage("bot:disabled", () => {});
  roomB.onMessage("bot:respawned", () => {});

  console.log(`joined ${ROOM_NAME}: A=${roomA.sessionId} B=${roomB.sessionId}`);

  await waitFor("both clients to see two players", () => {
    return playerCount(roomA) === 2 && playerCount(roomB) === 2;
  });

  assert(playerFrom(roomA, roomB.sessionId), "Client A cannot see client B.");
  assert(playerFrom(roomB, roomA.sessionId), "Client B cannot see client A.");
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

  await moveAndSelectBot(roomA, inspectedBotBeforeCombat.id);
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
  assert(botHealthTotal(inspectedBotAfterOversizedCombat) === healthAfterCombat - 50, "Clamped oversized damage did not apply expected staging damage.");
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
    const currentBot = await moveAndSelectBot(roomA, inspectedBotBeforeCombat.id);
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
}
