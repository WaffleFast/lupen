# Multiplayer Staging Pilot Test Checklist

Use this checklist for allowlisted live staging tests after each deployment. The default Playwright suite stays read-only; this checklist is manual and only for approved staging accounts.

## Required Gates

- `?mp=staging` is used on `https://www.lupen.io`.
- The tester is logged in with a verified Supabase account.
- The account is included in the relevant staging allowlists.
- Colyseus Cloud has the intended staging env vars set.
- Trade writes, Store writes, loadout writes, XP-only writes, and Lupen Shard writes are enabled only for the specific phase being tested.
- Dry-run flags are deliberately set for the intended test mode.
- No secrets, auth state, traces, or screenshots with private data are committed.

## Pilot Build Flow

1. Log in to `https://www.lupen.io/?mp=staging`.
2. Confirm the Multiplayer Staging chip and loop guide appear.
3. Open the Trade Terminal.
4. Buy cargo through the staging trade path.
5. Sell cargo through the staging trade path.
6. Refresh and confirm CR/cargo persisted.
7. Open the Store.
8. Buy Cargo Pod.
9. Equip Cargo Pod.
10. Confirm cargo capacity increased by `+25`.
11. Buy Pulse Laser.
12. Equip Pulse Laser.
13. Open `?debug=mp` and confirm Pulse Laser / server damage `10`.
14. Buy Shield Booster.
15. Equip Shield Booster.
16. Confirm shield stat or equipped Shield Booster state persists.
17. Open the Bounty Board.
18. Accept Erebus Patrol Sweep.
19. Destroy two staging bots.
20. Claim XP.
21. Claim Lupen Shard.
22. Refresh or relogin.
23. Confirm CR, cargo, loadout, equipped items, XP, and Lupen Shard persisted.
24. Open normal `https://www.lupen.io` and confirm normal single-player remains unchanged.

## What Remains Excluded

- PvP.
- Player damage.
- Credits from combat or bounties.
- Weapon or attachment loot writes.
- Store sell writes.
- Ship purchases/writes.
- Broad inventory writes.
- New bounty systems beyond Erebus Patrol Sweep.
- Schema or RLS changes.
- Default/live-write Playwright tests.

## If A Test Fails

Record:

- Exact URL and query string.
- Account id or safe account label, not passwords or tokens.
- Current Colyseus Cloud env gate values as safe yes/no notes.
- Action attempted and expected result.
- UI message, `?debug=mp` status, and server response reason if visible.
- Whether refresh/relogin changed the result.
- Whether normal `https://www.lupen.io` is affected.

## Recommended Deploy Test Order

1. Run `npm.cmd run test:e2e` locally for UI smoke coverage.
2. If server files changed, run Colyseus `npm.cmd run build` and `npm.cmd test`.
3. Deploy staging.
4. Open `https://www.lupen.io/?mp=staging` and confirm connection/guide.
5. Run the pilot flow with writes disabled/dry-run where applicable.
6. Enable one narrow write gate at a time for an allowlisted account.
7. Re-run only the relevant checklist section.
8. Turn off any temporary write gates that are not meant to stay active.
