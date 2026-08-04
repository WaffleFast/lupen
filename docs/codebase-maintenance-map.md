# Codebase Maintenance Map

This map records the current ownership boundaries for player-facing screens and
persistence. Use it before adding a renderer, storage key, or late CSS override.

## Screen ownership

| Area | Navigation entry | Current renderer and actions | Notes |
| --- | --- | --- | --- |
| Journey | `js/02-account-navigation.js` | `js/11-missions.js` | Mission configuration and reconciliation also live with the Journey renderer. |
| Trade Terminal | `js/02-account-navigation.js` | `js/04b-trade-terminal-v2.js` | This is the sole owner of current market renderer and action globals. |
| Bounty Board | `js/02-account-navigation.js` | `js/04a-bounty-board.js` | Daily contracts, rewards, and multiplayer staging bounty flows have a dedicated module. Shared Trade/Bounty objective routing remains in the base Trade support file. |
| Store | `js/02-account-navigation.js` | `js/05b-store.js` | Store catalogue, detail, pricing, purchase, and resale flows have a dedicated later-loaded module. |
| Hangar, Fleet, Vessel Exchange, Loadout, Vault | `js/02-account-navigation.js` | `js/05-hangar-store.js`, `js/05a-hangar-vault.js`, `js/05c-hangar-fleet.js`, `js/05d-vessel-exchange.js` | Fleet, Ship Plans, repair, and active-vessel selection have a dedicated module. Vessel Exchange browsing, detail, requirements, and hull purchasing are separately owned. Vault browsing and selected-item loadout actions remain isolated; the compact space HUD slot detail remains in `js/03-hud-space-map.js`. |
| Tutorial | Screen entry functions above | `js/08-tutorial.js` | Tutorial steps should call current public screen actions rather than duplicate screen behavior. |
| Space HUD and map | `js/02-account-navigation.js` | `js/03-hud-space-map.js` | Multiplayer overlay rendering is isolated in `js/network/multiplayerOverlay.js`. |

The older Trade implementations retained in `js/04-trade-bounty-objectives.js`
are explicitly named as legacy functions. Do not restore current public names in
that file; `tests/e2e/lupen-smoke.spec.js` protects this ownership boundary.

## Persistence ownership

- `js/services/saveService.js` owns browser storage access, the immutable storage
  key contract, authenticated Supabase lookup, and raw cloud save/load calls.
- `js/07-save-load.js` owns gameplay save assembly, local/cloud coordination,
  migration, reset behavior, and application of loaded state.
- `js/network/multiplayerClient.js` owns Colyseus connection state and application
  of validated staging results. It must not become a second general save service.
- `docs/player-data-storage-audit.md` describes the current local-first authority
  model and the recommended migration toward server-owned account state.

New browser keys belong in `LupenSaveService.storageKeys`. A key should not be
introduced as a repeated literal in feature modules. Preserve reset semantics
when centralizing a key; some authentication and account keys are intentionally
not cleared with gameplay progress.

## CSS maintenance rules

`style.css` remains a large historical cascade. Store, Journey, Forge, Vault,
Hangar, and the space HUD each have multiple generations of selectors. The final
orbit pilot-card lock now lives in `styles/orbit-pilot-card.css`, loaded directly
after `style.css` to preserve its original position before the other shared
stylesheets. Small UI changes should follow this sequence:

1. Find every occurrence of the selector and its surrounding media query.
2. Identify the last active owner at the affected viewport.
3. Edit that owner instead of appending another override.
4. Remove earlier declarations only when they are fully superseded or exact
   duplicates.
5. Run the smallest relevant Playwright flow at desktop and any affected compact
   viewport before committing.

Do not move a screen's CSS into a new file without preserving source order and
capturing computed-style or screenshot baselines first. Moving correct rules can
change behavior even when their declarations are unchanged.

## Completed cleanup baseline

- The obsolete dedicated Trade renderers have been removed.
- Current Trade globals have one owner, with old mixed-module declarations
  isolated under legacy names.
- Bounty claim progress has one idempotent owner and an explicit early fallback.
- Bounty Board rendering, daily contracts, rewards, and staging actions have been
  extracted from the base Trade support module.
- The Store catalogue and purchase subsystem has been extracted from the Hangar
  module without changing its browser-global API.
- Vault browsing, detail, upgrading, and selected-item loadout actions have been
  extracted behind the same browser-global API.
- Fleet browsing, Ship Plans, repair, shared vessel-card helpers, and active-ship
  selection have been extracted behind the same browser-global API.
- Vessel Exchange browsing, hull detail, unlock requirements, and hull purchasing
  have been extracted behind the same browser-global API.
- Repeated Store artwork rules and exact Journey desktop, modifier, and compact
  breakpoint duplicates have been removed.
- The final orbit pilot-card cascade has been moved into an order-preserving,
  screen-specific stylesheet with a source-order regression test.
- Browser storage keys are centralized without changing their persisted values.
- Browser JSON parsing, corrupt-entry quarantine, HUD account reads, and Tutorial
  persistence now go through `LupenSaveService`; the duplicate global parser has
  been removed.

## Remaining opportunities

1. Consider moving the remaining shared Trade/Bounty objective HUD and route
   helpers into a neutral objective module. Do this only when it reduces coupling;
   both systems intentionally consume those helpers today.
2. Continue splitting the remaining slot-grid and inventory fitting code from
   `js/05-hangar-store.js`. Preserve the public globals and script order until
   browser tests cover each extracted API.
3. Continue modularizing `style.css` one screen at a time, starting with a stable
   Journey or Store boundary. Treat this as an order-sensitive migration, not a
   formatting exercise.
4. Add focused coverage for the activity-feed visibility policy so large
   multiplayer scenarios do not need to own assertions about filtered presence
   and combat chatter.
5. Continue the server-authority migration in the order documented in
   `docs/player-data-storage-audit.md`; broad browser-built save JSON is still the
   main architectural risk.

## Verification commands

Use the repository runner so the local static server starts automatically:

```powershell
npm run test:e2e -- --grep "relevant test name"
```

For JavaScript-only cleanup, also run `node --check` on every changed script and
`git diff --check` before committing. Run the full browser suite before a release
or after changes that cross several ownership boundaries.
