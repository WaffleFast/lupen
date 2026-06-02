# Browser Testing

Lupen has a small Playwright harness for repeatable browser smoke checks. The default tests are read-only: they load the app, open the Trade Terminal, and verify multiplayer staging UI fences without buying, selling, writing saves, or requiring credentials.

## Setup

From the repo root:

```powershell
npm.cmd install
npx.cmd playwright install chromium
```

## Run Local Smoke Tests

```powershell
npm.cmd run test:e2e
```

By default Playwright starts the local static test server at:

```text
http://127.0.0.1:4173
```

Useful variants:

```powershell
npm.cmd run test:e2e:headed
npm.cmd run test:e2e:ui
```

## Run Against A Deployed URL

Use `LUPEN_BASE_URL` to point Playwright at an existing deployment. These checks remain smoke/read-only unless a future test is explicitly placed behind an opt-in live-write flag.

```powershell
$env:LUPEN_BASE_URL = "https://www.lupen.io"
npm.cmd run test:e2e
Remove-Item Env:\LUPEN_BASE_URL
```

## Authenticated And Live-Write Tests

Authenticated tests should be skipped unless explicit credentials are provided through environment variables such as `LUPEN_TEST_EMAIL` and `LUPEN_TEST_PASSWORD`.

Live-write staging tests must stay separate from the default suite. They should require an explicit opt-in environment flag and must never run from `npm.cmd run test:e2e` by accident.

If a later live-write browser test is added, it must use an allow-listed test account, explicit staging server env gates, and a tiny known offer. It must also report that route completion, trade totals, loot, inventory, bounties, PvP, player damage, and broad progression are out of scope.

## Current Coverage

- Normal start screen loads without multiplayer staging.
- Normal Trade Terminal opens without clicking real buy/sell actions.
- `?mp=staging` shows staging trade labels instead of normal local trade actions.
- `?mp=staging` shows Store server-preview/dry-run wording instead of normal Store purchase actions.
- `?mp=staging&debug=mp` shows MP Staging diagnostics without needing a live Colyseus server.

These tests do not validate CSS polish, authenticated cloud saves, or live staging write flows.

## What To Run By Change Type

- UI or browser-facing staging copy changes: run `npm.cmd run test:e2e`.
- Colyseus server, staging gate, trade, Store, loadout, combat, bounty, XP, or loot service changes: run `npm.cmd run build` and `npm.cmd test` from `server/colyseus`, then run `npm.cmd run test:e2e` from the repo root if browser UI changed.
- Docs-only changes: `git diff --check` is enough unless the docs describe a changed workflow that should be smoke-tested.
- Live-write staging checks remain manual, allowlisted, and opt-in only. Do not add or run live-write Playwright tests by default.

## Pilot Website Checks

After a browser/client deploy, manually verify:

- `https://www.lupen.io` loads normally with no multiplayer staging chip or guide.
- `https://www.lupen.io/?mp=staging` shows the Multiplayer Staging chip and loop guide.
- Trade Terminal, Store, Hangar, Bounty Board, Pilot, Planet, and Sector navigation still opens from the browser game hub.
- `https://www.lupen.io/?mp=staging&debug=mp` shows diagnostics, while normal staging stays cleaner.
