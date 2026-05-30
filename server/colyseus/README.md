# Lupen Local Colyseus Prototype

This is local-only server groundwork for future Lupen multiplayer. It is not connected to the live Vercel frontend, Supabase, `lupen.io`, or production gameplay.

## What It Provides

- A Colyseus server listening on port `2567` by default.
- One registered room: `lupen_test`.
- A `LupenTestRoom` that tracks connected players by `sessionId`.
- Each joined player gets:
  - `id`: the Colyseus `sessionId`
  - `displayName`: supplied by join options, otherwise `Pilot`
  - `x` / `y`: placeholder position
  - `currentNode`: placeholder node, default `asteron-prime`
- On leave, the player is removed.
- Local-only `ping` and `move` messages for smoke testing.

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

## Smoke Test

In a second PowerShell window while the server is running:

```powershell
cd server\colyseus
npm.cmd run smoke
```

The smoke test joins `lupen_test`, sends `ping`, receives `pong`, sends a placeholder `move`, then leaves.

## Production Status

This package is intentionally separate from the browser game files. The main Lupen frontend does not import or connect to this server yet.
