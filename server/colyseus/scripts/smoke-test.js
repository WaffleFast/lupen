import { Client } from "colyseus.js";
import { ROOM_NAME } from "../src/app.config.js";

const endpoint = process.env.COLYSEUS_ENDPOINT || "ws://localhost:2567";
const client = new Client(endpoint);

const room = await client.joinOrCreate(ROOM_NAME, {
  displayName: "Smoke Pilot",
  currentShipId: "lupenOrigin",
  shipName: "LF-1 Origin",
  currentNode: "Asteron Prime"
});

console.log(`joined ${ROOM_NAME}: ${room.sessionId}`);

await new Promise((resolve, reject) => {
  const startedAt = Date.now();
  const timer = setInterval(() => {
    const botCount = room.state?.bots?.size || 0;
    if (botCount > 0) {
      clearInterval(timer);
      console.log(`received dummy bots: ${botCount}`);
      resolve();
      return;
    }

    if (Date.now() - startedAt > 3000) {
      clearInterval(timer);
      reject(new Error("Timed out waiting for dummy bots in room state."));
    }
  }, 100);
});

await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("Timed out waiting for pong.")), 3000);
  room.onMessage("pong", (message) => {
    clearTimeout(timeout);
    console.log("received pong:", JSON.stringify(message));
    resolve();
  });
  room.send("ping", { local: true });
});

room.send("movement:update", {
  x: 64,
  y: 42,
  currentShipId: "lupenOrigin",
  shipName: "LF-1 Origin",
  currentNode: "East Link 1"
});

await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("Timed out waiting for presence warning.")), 3000);
  room.onMessage("presence:warning", (message) => {
    clearTimeout(timeout);
    console.log("received presence warning:", JSON.stringify(message));
    resolve();
  });
  room.send("movement:update", {
    x: 999999,
    y: 42,
    currentNode: "Invalid Node"
  });
});

await room.leave();
console.log("left room cleanly");
