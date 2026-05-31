# Lupen Local Colyseus Prototype

This is local-only server groundwork for future Lupen multiplayer. It is not connected to the live Vercel frontend, Supabase, `lupen.io`, or production gameplay.

## What It Provides

- A Colyseus server listening on port `2567` by default.
- The server reads `process.env.PORT` when provided, with `2567` as the local fallback.
- Preferred registered room: `lupen_sector`.
- Legacy compatibility room: `lupen_test`.
- A `LupenSectorRoom` that tracks connected players by `sessionId`.
- A small fixed set of server-owned staging bots for visual-only multiplayer presence testing.
- Staging bots spawn only on a server allow-list of hostile/combat sector nodes. They deliberately avoid planet safe nodes such as `Asteron Prime`, `Virella`, and `Nyxara`, plus safe link nodes.
- Each joined player gets:
  - `id` / `sessionId`: the Colyseus `sessionId`
  - `displayName`: supplied by join options, otherwise `Pilot`
  - `currentShipId` / `shipName`: display-only ship identity
  - `currentNode`: current sector node, default `Asteron Prime`
  - `x` / `y`: placeholder position
  - `joinedAt` / `lastSeenAt`: local server timestamps
- On leave, the player is removed.
- Local-only `ping`, `presence:update`, and `movement:update` messages for smoke testing.
- Staging-only `combat:intent` messages for future combat pipeline testing. These are validated against the player's selected same-node staging bot, enforce a short per-player fire cooldown, and apply server-clamped weapon test damage only.
- Staging-only `target:select` / `target:clear` messages for lock-on UI preparation. These update `selectedTargetBotId` on the player's presence record only when the server-owned bot is in the same node.
- Legacy local prototype `move` messages are still accepted for compatibility.
- Presence updates are lightly validated for dev safety. Invalid `currentNode` values, missing node names, or absurd `x` / `y` values are ignored and may return a `presence:warning` message to the sender.
- Staging bots include:
  - `id`: stable local dummy bot id
  - `type` / `name`: display-only bot identity such as `Erebus Drone`
  - `faction`: display-only faction such as `Erebus`
  - `level`, `shield` / `shieldMax`, `hull` / `hullMax`: staging inspection and test-damage placeholders
  - `disabled` / `disabledUntil`: temporary staging-only disabled state when hull reaches `0`
  - `visualOnly`: always `true`
  - `currentNode`: visual sector location
  - `x` / `y`: placeholder map position
  - `lastUpdatedAt`: local server timestamp
  - `nextMoveAt`: planned next node-move timestamp for debugging
- Staging bots drift on a slow server tick and occasionally move to neighbouring allowed combat nodes. They are shared through Colyseus room state so all connected staging clients see the same visual bot layer. They are not real gameplay bots, cannot fight, cannot enter real target arrays, do not drop loot, do not grant XP/rewards, and are not persisted.
- Combat intent handling can apply shield-first staging test damage to a locked same-node staging bot and returns `combat:resolved` with `rewardsGranted: false`. Clients may send equipped weapon display data, but the server clamps staging damage between `1` and `50`, derives/clamps cooldown safely, and falls back to conservative test damage when payloads are invalid. Fast repeat fire returns `combat:rejected` with `reason: staging_fire_cooldown` and `cooldownRemainingMs`. Invalid intents return `combat:rejected`. This does not mutate player progression, rewards, loot, saves, bounty data, Supabase data, or real combat systems.
- Successful staging combat also broadcasts `staging:shot` as a visual-only synced event with attacker, target, weapon, damage, and resulting shield/hull data. Clients may render this as a beam/hit flash, but it is not real projectile simulation and does not damage players or grant progression.
- When staging bot hull reaches `0`, the bot broadcasts `bot:disabled`, stops taking staging damage, and respawns after a short delay with shield/hull restored. Respawn broadcasts `bot:respawned` and never grants rewards.
- Disabled staging bots also broadcast `staging:reward_preview` with `applied: false` and `reason: staging_preview_only`. The preview includes final-hit and top-contributor attribution from staging-only damage contribution tracking, but it never mutates XP, credits, inventory, bounties, saves, Supabase, or progression.
- Staging target selection does not create real combat targets, timers, scans, rewards, damage, or save data. It is lock-on display state only and is cleared when the player or bot leaves the node.

## Install

From the repository root:

```powershell
cd server\colyseus
npm.cmd install
```

Use `npm.cmd` on Windows PowerShell if `npm` is blocked by script execution policy.

## Run Locally

```powershell
cd server\colyseus
npm.cmd run dev
```

The server listens on:

```text
ws://localhost:2567
```

Health check:

```powershell
Invoke-RestMethod http://localhost:2567/health
```

## Colyseus Cloud Readiness

This prototype is structured as a standalone Node package under `server/colyseus` with `package.json`, `package-lock.json`, `src/index.js`, and room code under `src/rooms`.

The current implementation uses Colyseus `Server` with `WebSocketTransport`, which is compatible with the installed Colyseus `0.16.x` package in this project. Current Colyseus Cloud examples also show newer `defineServer()` / `defineRoom()` helpers; adopting those helpers later may require adding `@colyseus/tools` or updating the scaffold, so this audit does not rewrite the working local server.

An `ecosystem.config.cjs` file is included for future PM2/Cloud-style process configuration. It uses `.cjs` because this package has `"type": "module"`.

Manual Colyseus Cloud steps later:

- Create/select the Colyseus Cloud staging application.
- Configure the app root as `server/colyseus` if the repository root is not used directly.
- Confirm the Cloud start command runs `npm start` or uses `ecosystem.config.cjs`.
- Add any staging environment variables in Colyseus Cloud settings; do not commit secrets.
- After deployment, use the assigned `https://` or `wss://` staging URL in local frontend testing with `?mp=1&mpServer=...`.
- Keep production `lupen.io` multiplayer disabled until a separate production enablement step.

## CORS Allow-List

The Colyseus server uses an explicit CORS allow-list for browser matchmaking and local HTTP utility routes. Allowed origins:

- `http://127.0.0.1:4173`
- `http://localhost:4173`
- `http://127.0.0.1:5173`
- `http://localhost:5173`
- `https://www.lupen.io`
- `https://lupen.io`

This allows local frontend testing against Colyseus Cloud staging, including:

```text
http://127.0.0.1:4173/?mp=1&mpServer=https://gb-man-e55e725e.colyseus.cloud
```

The production origins are CORS-allowed for later controlled staging tests, but production multiplayer is still disabled by frontend gating unless explicitly enabled.

## Frontend Server Configuration

The real Lupen frontend remains multiplayer-disabled unless it is opened on an allowed development/staging host with `?mp=1`.

Default local development:

```text
http://127.0.0.1:4173/?mp=1
```

Optional local URL override for testing:

```text
http://127.0.0.1:4173/?mp=1&mpServer=ws://localhost:2567
```

The browser client also checks this local storage key when `mpServer` is not present:

```javascript
localStorage.setItem("lupenMultiplayerServer", "ws://localhost:2567");
```

Future hosted staging example:

```text
wss://multiplayer.lupen.io
```

Future Colyseus Cloud staging may provide an HTTPS base URL for matchmaking, for example:

```text
https://your-colyseus-cloud-host.example
```

WebSocket URLs are also accepted when supported by the host:

```text
wss://your-colyseus-cloud-host.example
```

Only `ws://`, `wss://`, `http://`, and `https://` server URLs are accepted. Page hosts are restricted to local development by default (`localhost`, `127.0.0.1`, and `::1`). A future staging page can opt in by setting an explicit allowed host config before `js/network/multiplayerClient.js` loads. Production `lupen.io` / `www.lupen.io` is not enabled just because `?mp=1` is present.

## Smoke Test

In a second PowerShell window while the server is running:

```powershell
cd server\colyseus
npm.cmd run smoke
```

The smoke test joins `lupen_sector`, confirms dummy bots are present in room state, sends `ping`, receives `pong`, sends a placeholder `movement:update`, confirms an invalid movement update returns a dev warning, then leaves.

## Regression Test

In a second PowerShell window while the server is running:

```powershell
cd server\colyseus
npm.cmd run regression
```

The regression test uses two Colyseus clients to verify that:

- Both clients join `lupen_sector`.
- Player count reaches `2`.
- Each client can see the other player.
- A `movement:update` from client A reaches client B.
- Dummy server bots exist in room state.
- Staging bot display fields are present and `visualOnly` remains true.
- Both clients receive the same server-owned bot movement update.
- Staging bot `currentNode` values stay inside the server's allowed combat node list.
- At least one staging bot changes node while both clients observe matching state.
- A valid same-node staging bot lock-on updates the player's `selectedTargetBotId`.
- A valid `combat:intent` against the selected same-node staging bot applies server-clamped weapon test damage.
- Successful staging combat broadcasts a visual-only `staging:shot` event to both clients.
- Client B receives the same updated staging bot shield/hull values.
- An immediate second combat intent is rejected by `staging_fire_cooldown` without damage.
- A second client can contribute damage to the same staging bot.
- Oversized weapon damage is clamped and invalid weapon damage falls back safely.
- Repeated valid staging hits can disable a bot.
- Disabling a bot emits a preview-only reward event with `applied: false`, final-hit attribution, top contributor attribution, contributor hit counts, and contribution percentages.
- Bot respawn confirms staging contribution data was cleared.
- Disabled bots reject further staging damage and then respawn/reset on both clients.
- Invalid combat intents are rejected without rewards or additional damage.
- Wrong-node and missing-bot lock-on requests are rejected safely.
- Invalid movement is ignored and returns a dev-only warning.
- Client B sees client A removed after disconnect.

To run both local server-side checks:

```powershell
cd server\colyseus
npm.cmd test
```

These tests validate local Colyseus room state and message behavior only. They do not validate browser visual polish, CSS layout, canvas/UI rendering, or the live single-player game.

## Browser Test Client

While the local server is running, open this URL in one or more browser tabs:

```text
http://localhost:2567/test-client.html
```

Use `Connect` in each tab to join `lupen_sector`. The page shows the current tab's session id, connected players, server dummy bots, placeholder movement updates, ping/pong messages, and disconnect events.

This page is served only by the local prototype server. It is not imported by the real Lupen frontend.

## Production Status

This package is intentionally separate from the browser game files. The main Lupen frontend does not import or connect to this server yet.

Colyseus Cloud staging deployment is planned for a later step. Nothing in this local prototype deploys Colyseus, connects `lupen.io` to Colyseus, or enables multiplayer for production players.

Redeploy trigger: Colyseus Cloud environment refresh.
