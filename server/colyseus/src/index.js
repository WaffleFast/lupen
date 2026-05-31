import createGameServer, {
  ALLOWED_CORS_ORIGINS,
  ROOM_NAME,
  getHealthPayload
} from "./app.config.js";

const port = Number(process.env.PORT || 2567);
const gameServer = createGameServer();

console.log("[Lupen Colyseus] startup diagnostics");
console.log(`[Lupen Colyseus] process.env.PORT: ${process.env.PORT || "(not set)"}`);
console.log(`[Lupen Colyseus] final listen port: ${port}`);
console.log(`[Lupen Colyseus] NODE_ENV: ${process.env.NODE_ENV || "(not set)"}`);
console.log(`[Lupen Colyseus] registered room: ${ROOM_NAME}`);
console.log("[Lupen Colyseus] health endpoint: /health");
console.log(`[Lupen Colyseus] CORS allowed origins (${ALLOWED_CORS_ORIGINS.length}): ${ALLOWED_CORS_ORIGINS.join(", ")}`);

await gameServer.listen(port);

console.log(`Lupen Colyseus server listening on port ${port}`);
console.log("[Lupen Colyseus] health payload:", JSON.stringify(getHealthPayload(port)));
