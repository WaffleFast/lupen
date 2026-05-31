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
      visualOnly: bot.visualOnly,
      lastUpdatedAt: bot.lastUpdatedAt,
      nextMoveAt: bot.nextMoveAt
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
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

  roomA.send("movement:update", {
    displayName: "Regression Pilot A",
    currentShipId: "lupenOrigin",
    shipName: "LF-1 Origin",
    currentNode: inspectedBotBeforeCombat.currentNode,
    x: inspectedBotBeforeCombat.x,
    y: inspectedBotBeforeCombat.y
  });

  await waitFor("client A presence to reach staging bot node", () => {
    const playerA = playerFrom(roomA, roomA.sessionId);
    return playerA?.currentNode === inspectedBotBeforeCombat.currentNode;
  });

  const combatResponse = await expectCombatRejected(roomA, () => {
    roomA.send("combat:intent", {
      targetBotId: inspectedBotBeforeCombat.id,
      weaponId: "pulseLaser",
      weaponFamily: "pulse",
      currentNode: inspectedBotBeforeCombat.currentNode,
      timestamp: Date.now()
    });
  });

  assert(combatResponse?.reason === "combat_disabled_in_staging", "Combat intent was not safely rejected.");
  assert(combatResponse?.validation === "validated_no_damage_applied", `Unexpected combat validation: ${combatResponse?.validation}`);
  await new Promise((resolve) => setTimeout(resolve, 250));

  const inspectedBotAfterCombat = botSnapshots(roomA).find((bot) => bot.id === inspectedBotBeforeCombat.id);
  assert(inspectedBotAfterCombat?.shield === inspectedBotBeforeCombat.shield, "Combat intent changed bot shield.");
  assert(inspectedBotAfterCombat?.hull === inspectedBotBeforeCombat.hull, "Combat intent changed bot hull.");
  assert(inspectedBotAfterCombat?.visualOnly === true, "Combat intent changed visualOnly flag.");
  console.log("combat intent rejected without damage or rewards");

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
