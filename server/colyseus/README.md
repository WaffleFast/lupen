# Lupen Local Colyseus Prototype

This is local-only server groundwork for future Lupen multiplayer. It is not connected to the live Vercel frontend, Supabase, `lupen.io`, or production gameplay.

## What It Provides

- A Colyseus server listening on port `2567` by default.
- Preferred registered room: `lupen_sector`.
- Legacy compatibility room: `lupen_test`.
- A `LupenSectorRoom` that tracks connected players by `sessionId`.
- A small fixed set of server-owned dummy bots for visual-only multiplayer presence testing.
- Each joined player gets:
  - `id` / `sessionId`: the Colyseus `sessionId`
  - `displayName`: supplied by join options, otherwise `Pilot`
  - `currentShipId` / `shipName`: display-only ship identity
  - `currentNode`: current sector node, default `Asteron Prime`
  - `x` / `y`: placeholder position
  - `joinedAt` / `lastSeenAt`: local server timestamps
- On leave, the player is removed.
- Local-only `ping`, `presence:update`, and `movement:update` messages for smoke testing.
- Legacy local prototype `move` messages are still accepted for compatibility.
- Presence updates are lightly validated for dev safety. Invalid `currentNode` values, missing node names, or absurd `x` / `y` values are ignored and may return a `presence:warning` message to the sender.
- Dummy bots include:
  - `id`: stable local dummy bot id
  - `type` / `name`: display-only bot identity such as `Erebus Drone`
  - `currentNode`: visual sector location
  - `x` / `y`: placeholder map position
  - `lastUpdatedAt`: local server timestamp
- Dummy bots drift between placeholder sector nodes on a slow local interval. They are not real gameplay bots, cannot fight, cannot be targeted, do not drop loot, do not grant XP/rewards, and are not persisted.

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

Future Colyseus Cloud staging URLs will also use `wss://`, for example:

```text
wss://your-colyseus-cloud-host.example
```

Only `ws://` and `wss://` server URLs are accepted. Page hosts are restricted to local development by default (`localhost`, `127.0.0.1`, and `::1`). A future staging page can opt in by setting an explicit allowed host config before `js/network/multiplayerClient.js` loads. Production `lupen.io` / `www.lupen.io` is not enabled just because `?mp=1` is present.

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
