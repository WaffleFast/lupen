import createGameServer, { ROOM_NAME } from "./app.config.js";

const port = Number(process.env.PORT || 2567);
const gameServer = createGameServer();

await gameServer.listen(port);

console.log(`Lupen local Colyseus server listening on ws://localhost:${port}`);
console.log(`Registered test room: ${ROOM_NAME}`);
