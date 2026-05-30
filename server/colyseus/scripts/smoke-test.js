import { Client } from "colyseus.js";
import { ROOM_NAME } from "../src/app.config.js";

const endpoint = process.env.COLYSEUS_ENDPOINT || "ws://localhost:2567";
const client = new Client(endpoint);

const room = await client.joinOrCreate(ROOM_NAME, {
  displayName: "Smoke Pilot"
});

console.log(`joined ${ROOM_NAME}: ${room.sessionId}`);

await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error("Timed out waiting for pong.")), 3000);
  room.onMessage("pong", (message) => {
    clearTimeout(timeout);
    console.log("received pong:", JSON.stringify(message));
    resolve();
  });
  room.send("ping", { local: true });
});

room.send("move", {
  x: 64,
  y: 42,
  currentNode: "asteron-prime"
});

await room.leave();
console.log("left room cleanly");
