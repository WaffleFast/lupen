# Multiplayer Staging Pilot Test Checklist

Use this checklist for allowlisted live staging tests after each deployment. The default Playwright suite stays read-only; this checklist is manual and only for approved staging accounts.

## Required Gates

- `?mp=staging` is used on `https://www.lupen.io`.
- Normal `https://www.lupen.io` is tested separately and should not connect to multiplayer.
- The tester is logged in with a verified Supabase account.
- The account is included in the relevant staging allowlists.
- Colyseus Cloud has the intended staging env vars set.
- Trade writes, Store writes, loadout writes, XP-only writes, and Lupen Shard writes are enabled only for the specific phase being tested.
- Dry-run flags are deliberately set for the intended test mode.
- No secrets, auth state, traces, or screenshots with private data are committed.

### Colyseus Cloud Env Checklist

For real allowlisted Trade Terminal buy/sell writes, Colyseus Cloud needs all of:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STAGING_TRADE_WRITE_ENABLED=true`
- `STAGING_TRADE_WRITE_DRY_RUN=false`
- `STAGING_TRADE_WRITE_SCOPE=allowlist`
- `STAGING_TRADE_WRITE_ALLOWLIST=<verified Supabase auth user UUID>`

`STAGING_TRADE_WRITE_ALLOWLIST` is a comma-separated list of verified Supabase user ids, for example `uuid1,uuid2`. It is not an email allowlist, and there is no wildcard. `STAGING_TRADE_WRITE_SCOPE=verified` allows any verified staging player, so use `allowlist` for live pilot tests. Optional trade gates are `STAGING_TRADE_WRITE_MAX_QUANTITY=10` and `STAGING_TRADE_WRITE_ALLOWED_OFFERS=<offerId1,offerId2>`; leaving allowed offers unset allows the current staging trade offers.

`ENABLE_STAGING_REWARD_WRITES` is still used, but only for the dedicated reward ledger path. It does not enable Trade Terminal writes.

Later systems use separate gates:

- Store purchases: `STAGING_STORE_WRITE_ENABLED`, `STAGING_STORE_WRITE_DRY_RUN`, `STAGING_STORE_WRITE_SCOPE`, `STAGING_STORE_WRITE_ALLOWLIST`, `STAGING_STORE_WRITE_ALLOWED_ITEMS`.
- Loadout equip/ship select: `STAGING_LOADOUT_WRITE_ENABLED`, `STAGING_LOADOUT_WRITE_DRY_RUN`, `STAGING_LOADOUT_WRITE_SCOPE`, `STAGING_LOADOUT_WRITE_ALLOWLIST`, `STAGING_LOADOUT_WRITE_ALLOWED_ITEMS`.
- XP/progression: `ENABLE_STAGING_PROGRESSION_WRITES`, `STAGING_PROGRESSION_WRITE_SCOPE`, `STAGING_PROGRESSION_WRITE_ALLOWLIST`.
- Lupen Shard loot: `STAGING_LOOT_WRITE_ENABLED`, `STAGING_LOOT_WRITE_DRY_RUN`, `STAGING_LOOT_WRITE_SCOPE`, `STAGING_LOOT_WRITE_ALLOWLIST`.
- Reward ledger only: `ENABLE_STAGING_REWARD_WRITES`.
- Progression shadow only: `ENABLE_STAGING_PROGRESSION_SHADOW_WRITES`.

## Pilot Build Flow

1. Log in to `https://www.lupen.io/?mp=staging`.
2. Confirm the Multiplayer Staging chip and loop guide appear, and that `?debug=mp` shows diagnostics only when explicitly used.
3. Open the Trade Terminal.
4. Buy cargo through the staging trade path.
5. Sell cargo through the staging trade path.
6. Refresh and confirm CR/cargo persisted.
   - The floating Staging Trade Preview is debug-only; normal testers should use the real Trade Terminal.
7. Open the Store.
8. Buy LF-2 Hauler (`10,500 CR` staging pilot price).
9. Fly LF-2 Hauler.
10. Confirm cargo baseline reflects the Hauler after refresh/relogin.
11. Buy Cargo Pod.
12. Equip Cargo Pod.
13. Confirm cargo capacity increased by `+25`.
14. Buy Pulse Laser.
15. Equip Pulse Laser.
16. Open `?debug=mp` and confirm Pulse Laser / server damage `10`.
17. Buy Shield Booster.
18. Equip Shield Booster.
19. Confirm shield stat or equipped Shield Booster state persists.
20. Open the Bounty Board.
21. Accept Erebus Patrol Sweep (`40 XP` staging bounty reward).
22. Destroy two staging bots.
23. Claim XP.
24. Claim Lupen Shard.
25. Refresh or relogin.
26. Confirm CR, cargo, active ship, loadout, equipped items, XP, and Lupen Shard persisted.
27. Open normal `https://www.lupen.io` and confirm normal single-player remains unchanged with no staging chip, guide, or multiplayer connection.

## Deploy Split

- Vercel/client deploy: needed for changes under `index.html`, `style.css`, `js/`, `docs/`, or browser tests.
- Colyseus Cloud/server deploy: needed for changes under `server/colyseus`.
- If both client and server changed, deploy Colyseus first when the browser depends on new room messages or response fields.
- After pushing, test normal `https://www.lupen.io`, then `https://www.lupen.io/?mp=staging`, then `https://www.lupen.io/?mp=staging&debug=mp`.

## What Remains Excluded

- PvP.
- Player damage.
- Credits from combat or bounties.
- Weapon or attachment loot writes.
- Store sell writes.
- Broad ship purchases/writes beyond the gated LF-2 Hauler pilot path.
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
3. Push/deploy the Vercel client when browser files changed.
4. Deploy the Colyseus server when `server/colyseus` changed.
5. Open normal `https://www.lupen.io` and confirm no staging UI appears.
6. Open `https://www.lupen.io/?mp=staging` and confirm connection/guide.
7. Run the pilot flow with writes disabled/dry-run where applicable.
8. Enable one narrow write gate at a time for an allowlisted account.
9. Re-run only the relevant checklist section.
10. Turn off any temporary write gates that are not meant to stay active.
