const { test, expect } = require("@playwright/test");
const fs = require("fs");

function collectUnexpectedBrowserErrors(page) {
  const failures = [];
  page.on("pageerror", (error) => {
    failures.push(`pageerror: ${error.message}`);
  });
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (/Failed to load resource|ERR_CONNECTION_REFUSED|net::ERR|colyseus/i.test(text)) return;
    failures.push(`console error: ${text}`);
  });
  return failures;
}

async function expectNoUnexpectedBrowserErrors(failures) {
  expect(failures).toEqual([]);
}

async function waitForGameGlobals(page) {
  await page.waitForFunction(() => typeof window.showScreen === "function", null, { timeout: 15000 });
}

async function openTradeTerminal(page) {
  await waitForGameGlobals(page);
  await page.evaluate(() => {
    window.showScreen("gameScreen");
    if (typeof window.openMarketplace === "function") window.openMarketplace();
  });
  await expect(page.locator("#marketScreen")).toHaveClass(/active/);
  await expect(page.locator("#marketScreen")).toContainText("TRADE TERMINAL");
}

async function openStore(page) {
  await waitForGameGlobals(page);
  await page.evaluate(() => {
    window.showScreen("gameScreen");
    if (typeof window.openStore === "function") window.openStore();
  });
  await expect(page.locator("#storeScreen")).toHaveClass(/active/);
  await expect(page.locator("#storeScreen")).toContainText("STATION STORE");
}

async function openHangar(page) {
  await waitForGameGlobals(page);
  await page.evaluate(() => {
    window.showScreen("gameScreen");
    if (typeof window.openHangar === "function") window.openHangar();
  });
  await expect(page.locator("#hangarScreen")).toHaveClass(/active/);
  await expect(page.locator("#hangarScreen")).toContainText("Loadout");
}

async function openBountyBoard(page) {
  await waitForGameGlobals(page);
  await page.evaluate(() => {
    window.showScreen("gameScreen");
    if (typeof window.openBountyBoard === "function") window.openBountyBoard();
  });
  await expect(page.locator("#bountyScreen")).toHaveClass(/active/);
  await expect(page.locator("#bountyScreen")).toContainText(/BOUNTIES|CONTRACTS/);
}

test.describe("Lupen browser smoke", () => {
  test("normal load shows the start screen without multiplayer staging", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");

    await expect(page.locator("#startScreen")).toHaveClass(/active/);
    await expect(page.locator("#startScreen h1")).toContainText("LUPEN");
    await expect(page.locator("#lupenMultiplayerStatusChip")).toHaveCount(0);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("desktop game shell uses the larger frame and keeps key screens in view", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    const seedDockedPilot = () => {
      localStorage.clear();
      ownedShips = ["falcon"];
      currentShipId = "falcon";
      selectedHangarShipId = "falcon";
      selectedShipyardShipId = "falcon";
      if (typeof applyShipStats === "function") applyShipStats(true);
      tutorialState = { active: false, completed: true, stepIndex: 0 };
    };
    const measureShell = async (selector) => page.evaluate((shellSelector) => {
      const shell = document.querySelector(shellSelector);
      if (!shell) return null;
      const rect = shell.getBoundingClientRect();
      return {
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        left: Math.round(rect.left),
        top: Math.round(rect.top),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        overflowX: Math.ceil(rect.right - window.innerWidth),
        overflowY: Math.ceil(rect.bottom - window.innerHeight)
      };
    }, selector);
    const expectShellFitsViewport = (geometry, label) => {
      expect(geometry, label).not.toBeNull();
      expect(geometry.left, label).toBeGreaterThanOrEqual(0);
      expect(geometry.top, label).toBeGreaterThanOrEqual(0);
      expect(geometry.overflowX, label).toBeLessThanOrEqual(0);
      expect(geometry.overflowY, label).toBeLessThanOrEqual(0);
    };

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await waitForGameGlobals(page);
    await page.evaluate(seedDockedPilot);
    await page.evaluate(() => {
      window.showScreen("gameScreen");
      window.openMarketplace();
    });
    await expect(page.locator("#marketScreen")).toHaveClass(/active/);

    const roomyTrade = await measureShell("#marketScreen");
    expectShellFitsViewport(roomyTrade, "Trade Terminal roomy desktop shell");
    expect(roomyTrade.width).toBe(1200);
    expect(roomyTrade.height).toBe(700);

    await page.setViewportSize({ width: 1366, height: 768 });

    const checks = [
      ["Trade Terminal", "#marketScreen", () => {
        window.showScreen("gameScreen");
        window.openMarketplace();
      }],
      ["Hangar / Loadout", "#hangarScreen", () => {
        window.showScreen("gameScreen");
        window.openHangar();
        window.showHangarSection("overview");
      }],
      ["Vessel Exchange", "#hangarScreen", () => {
        window.showScreen("gameScreen");
        window.openHangar();
        window.showHangarSection("shipyard");
      }],
      ["Fleet", "#hangarScreen", () => {
        window.showScreen("gameScreen");
        window.openHangar();
        window.showHangarSection("owned");
      }],
      ["Vault", "#hangarScreen", () => {
        window.showScreen("gameScreen");
        window.openHangar();
        window.showHangarSection("vault");
      }],
      ["Forge", "#upgradeForgeScreen", () => {
        window.showScreen("gameScreen");
        window.openUpgradeForge();
      }],
      ["Bounty Board", "#bountyScreen", () => {
        window.showScreen("gameScreen");
        window.openBountyBoard();
      }],
      ["Sector / multiplayer staging overlay", "#spaceScreen", () => {
        window.showScreen("spaceScreen");
      }]
    ];

    for (const [label, selector, openScreen] of checks) {
      await page.evaluate(seedDockedPilot);
      await page.evaluate(openScreen);
      await expect(page.locator(selector)).toHaveClass(/active/);
      const geometry = await measureShell(selector);
      expectShellFitsViewport(geometry, label);
      expect(geometry.width, label).toBeLessThanOrEqual(1200);
      expect(geometry.height, label).toBeLessThanOrEqual(700);
    }

    await expect(page.locator("#lupenMultiplayerStatusChip")).toContainText(/Staging/, { timeout: 15000 });
    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("signup waits for an authenticated session before creating a profile", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await waitForGameGlobals(page);
    await page.evaluate(() => {
      localStorage.clear();
      window.__profileUpsertCount = 0;
      window.__signUpPayload = null;
      window.__fakeGetSupabaseClient = () => ({
        auth: {
          signUp: async (payload) => {
            window.__signUpPayload = payload;
            return {
              data: {
                user: {
                  id: "11111111-1111-4111-8111-111111111111",
                  email: "newpilot@example.test",
                  user_metadata: { pilot_name: "New Pilot" }
                },
                session: null
              },
              error: null
            };
          }
        },
        from: () => ({
          upsert: () => {
            window.__profileUpsertCount += 1;
            return {
              select: () => ({
                single: async () => ({ data: null, error: null })
              })
            };
          }
        })
      });
      window.eval("getSupabaseClient = window.__fakeGetSupabaseClient;");
      window.showScreen("createScreen");
      document.getElementById("createEmail").value = "newpilot@example.test";
      document.getElementById("createUsername").value = "New Pilot";
      document.getElementById("createPassword").value = "password123";
      document.getElementById("createConfirm").value = "password123";
    });

    await page.evaluate(() => window.createAccount());

    await expect(page.locator("#createMessage")).toContainText("Account created. Please check your email to confirm your account before logging in.");
    await expect(page.locator("#localSaveMigrationOverlay")).toHaveCount(0);
    await expect(page.evaluate(() => window.__profileUpsertCount)).resolves.toBe(0);
    await expect(page.evaluate(() => window.__signUpPayload?.options?.data?.pilot_name)).resolves.toBe("New Pilot");
    await expect(page.evaluate(() => localStorage.getItem("lupenPendingPilotName"))).resolves.toBe("New Pilot");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("signup profile RLS failure shows a friendly setup message and does not continue", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await waitForGameGlobals(page);
    await page.evaluate(() => {
      localStorage.clear();
      window.__profileUpsertPayload = null;
      window.__signOutCount = 0;
      const sessionUser = {
        id: "22222222-2222-4222-8222-222222222222",
        email: "rls@example.test",
        user_metadata: { pilot_name: "Rls Pilot" }
      };
      window.__fakeGetSupabaseClient = () => ({
        auth: {
          signUp: async () => ({
            data: { user: sessionUser, session: { user: sessionUser } },
            error: null
          }),
          signOut: async () => {
            window.__signOutCount += 1;
            return { error: null };
          }
        },
        from: () => ({
          upsert: (payload) => {
            window.__profileUpsertPayload = payload;
            return {
              select: () => ({
                single: async () => ({
                  data: null,
                  error: { message: "new row violates row-level security policy for table \"profiles\"" }
                })
              })
            };
          }
        })
      });
      window.eval("getSupabaseClient = window.__fakeGetSupabaseClient;");
      window.showScreen("createScreen");
      document.getElementById("createEmail").value = "rls@example.test";
      document.getElementById("createUsername").value = "Rls Pilot";
      document.getElementById("createPassword").value = "password123";
      document.getElementById("createConfirm").value = "password123";
    });

    await page.evaluate(() => window.createAccount());

    await expect(page.locator("#createMessage")).toContainText("Account created, but profile setup failed. Please refresh or contact support.");
    await expect(page.evaluate(() => window.__profileUpsertPayload?.id)).resolves.toBe("22222222-2222-4222-8222-222222222222");
    await expect(page.evaluate(() => window.__signOutCount)).resolves.toBe(1);
    await expect(page.evaluate(() => localStorage.getItem("lupenPlayerAccount"))).resolves.toBe(null);
    await expect(page.locator("#localSaveMigrationOverlay")).toHaveCount(0);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("login creates a missing profile from auth metadata or Pilot fallback", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await waitForGameGlobals(page);
    await page.evaluate(() => {
      localStorage.clear();
      window.__profileUpsertPayload = null;
      const user = {
        id: "55555555-5555-4555-8555-555555555555",
        email: "fallback@example.test",
        user_metadata: {}
      };
      window.__fakeGetSupabaseClient = () => ({
        auth: {
          signInWithPassword: async () => ({ data: { user }, error: null }),
          getUser: async () => ({ data: { user }, error: null })
        },
        from: (table) => {
          if (table === "profiles") {
            return {
              select: () => ({
                eq: () => ({
                  single: async () => ({
                    data: null,
                    error: { code: "PGRST116", message: "No rows found" }
                  })
                })
              }),
              upsert: (payload) => {
                window.__profileUpsertPayload = payload;
                return {
                  select: () => ({
                    single: async () => ({
                      data: { id: payload.id, pilot_name: payload.pilot_name, last_seen: payload.last_seen },
                      error: null
                    })
                  })
                };
              },
              update: (payload) => ({
                eq: () => ({
                  select: () => ({
                    single: async () => ({
                      data: { id: user.id, pilot_name: window.__profileUpsertPayload?.pilot_name || "Pilot", last_seen: payload.last_seen },
                      error: null
                    })
                  })
                })
              })
            };
          }
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null })
              })
            })
          };
        }
      });
      window.eval("getSupabaseClient = window.__fakeGetSupabaseClient;");
      window.showScreen("loginScreen");
      document.getElementById("loginUser").value = "fallback@example.test";
      document.getElementById("loginPassword").value = "password123";
    });

    await page.evaluate(() => window.login());

    await expect(page.evaluate(() => window.__profileUpsertPayload)).resolves.toMatchObject({
      id: "55555555-5555-4555-8555-555555555555",
      pilot_name: "Pilot"
    });
    await expect(page.evaluate(() => JSON.parse(localStorage.getItem("sectorOneAccount"))?.pilot_name)).resolves.toBe("Pilot");
    await expect(page.locator("#localSaveMigrationOverlay")).toHaveCount(0);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("login does not show local save migration until the profile matches the authenticated user", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await waitForGameGlobals(page);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("lupenGameSave", JSON.stringify({ credits: 12000, ownedShips: ["falcon"] }));
      window.__migrationPromptCount = 0;
      const user = {
        id: "33333333-3333-4333-8333-333333333333",
        email: "login@example.test",
        user_metadata: { pilot_name: "Login Pilot" }
      };
      window.__fakeGetSupabaseClient = () => ({
        auth: {
          signInWithPassword: async () => ({ data: { user }, error: null }),
          getUser: async () => ({ data: { user }, error: null })
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { id: "44444444-4444-4444-8444-444444444444", pilot_name: "Wrong Pilot", last_seen: null },
                error: null
              })
            })
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: async () => ({
                  data: { id: "44444444-4444-4444-8444-444444444444", pilot_name: "Wrong Pilot", last_seen: null },
                  error: null
                })
              })
            })
          })
        })
      });
      window.eval("getSupabaseClient = window.__fakeGetSupabaseClient;");
      window.promptUploadLocalSaveToSupabase = async () => {
        window.__migrationPromptCount += 1;
        return "skip";
      };
      window.showScreen("loginScreen");
      document.getElementById("loginUser").value = "login@example.test";
      document.getElementById("loginPassword").value = "password123";
    });

    await page.evaluate(() => window.login());

    await expect(page.locator("#loginMessage")).toContainText("Login succeeded, but profile setup failed. Please refresh or contact support.");
    await expect(page.evaluate(() => window.__migrationPromptCount)).resolves.toBe(0);
    await expect(page.locator("#localSaveMigrationOverlay")).toHaveCount(0);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("staging clearLocalSave removes local progress keys without touching Supabase auth storage", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await waitForGameGlobals(page);
    await page.evaluate(() => {
      localStorage.setItem("lupenGameState", JSON.stringify({ credits: 12000, ownedShips: ["falcon"] }));
      localStorage.setItem("lupenGameSave", JSON.stringify({ credits: 13000 }));
      localStorage.setItem("lupenStarterPilotTutorial", JSON.stringify({ active: true }));
      localStorage.setItem("lupenVaultClearedForIntegratedHangarV2", "true");
      localStorage.setItem("lupenPendingPilotName", "Pending Pilot");
      localStorage.setItem("sectorOneLoggedIn", "Legacy Pilot");
      localStorage.setItem("lupenStagingFlowHintDismissed", "1");
      localStorage.setItem("lupenDebugTools", "true");
      localStorage.setItem("lupenMultiplayerServer", "ws://stale.example.test");
      localStorage.setItem("lupenPlayerAccount", JSON.stringify({ pilotName: "Legacy" }));
      localStorage.setItem("sb-ylzglwiehkypetcdkqxd-auth-token", "keep-auth");
      sessionStorage.setItem("lupenGameState", "session-save");
      sessionStorage.setItem("lupenDebugTools", "true");
      sessionStorage.setItem("sb-ylzglwiehkypetcdkqxd-auth-token", "keep-session-auth");
      window.eval(`
        credits = 12000;
        currentShipId = "falcon";
        ownedShips = ["falcon"];
      `);
    });

    await page.goto("/?mp=staging&clearLocalSave=1");
    await waitForGameGlobals(page);

    const storage = await page.evaluate(() => ({
      href: window.location.href,
      helperType: typeof window.lupenClearLocalSave,
      game: localStorage.getItem("lupenGameState"),
      legacyGame: localStorage.getItem("lupenGameSave"),
      tutorial: localStorage.getItem("lupenStarterPilotTutorial"),
      vaultReset: localStorage.getItem("lupenVaultClearedForIntegratedHangarV2"),
      pendingPilot: localStorage.getItem("lupenPendingPilotName"),
      legacyPilot: localStorage.getItem("sectorOneLoggedIn"),
      stagingHint: localStorage.getItem("lupenStagingFlowHintDismissed"),
      debugTools: localStorage.getItem("lupenDebugTools"),
      multiplayerServer: localStorage.getItem("lupenMultiplayerServer"),
      legacyAccount: localStorage.getItem("lupenPlayerAccount"),
      supabaseAuth: localStorage.getItem("sb-ylzglwiehkypetcdkqxd-auth-token"),
      sessionGame: sessionStorage.getItem("lupenGameState"),
      sessionDebugTools: sessionStorage.getItem("lupenDebugTools"),
      localResetMarker: sessionStorage.getItem("lupenLocalSaveResetAt"),
      sessionSupabaseAuth: sessionStorage.getItem("sb-ylzglwiehkypetcdkqxd-auth-token"),
      runtimeShipId: window.eval("currentShipId"),
      runtimeOwnedShips: window.eval("ownedShips"),
      blankMeaningful: hasMeaningfulLocalSave({}),
      defaultShellMeaningful: hasMeaningfulLocalSave({
        credits: 10000,
        ownedShips: ["falcon"],
        playerProgress: { combatXp: 0, totals: {} },
        ownedGuns: {},
        ownedAttachments: {},
        inventoryItems: [],
        cargo: {}
      })
    }));

    expect(storage.href).not.toContain("clearLocalSave=1");
    expect(storage.href).toContain("mp=staging");
    expect(storage.helperType).toBe("function");
    expect(storage.game).toBe(null);
    expect(storage.legacyGame).toBe(null);
    expect(storage.tutorial).toBe(null);
    expect(storage.vaultReset).toBe(null);
    expect(storage.pendingPilot).toBe(null);
    expect(storage.legacyPilot).toBe(null);
    expect(storage.stagingHint).toBe(null);
    expect(storage.debugTools).toBe(null);
    expect(storage.multiplayerServer).toBe(null);
    expect(storage.legacyAccount).toBe(null);
    expect(storage.supabaseAuth).toBe("keep-auth");
    expect(storage.sessionGame).toBe(null);
    expect(storage.sessionDebugTools).toBe(null);
    expect(storage.localResetMarker).toBeTruthy();
    expect(storage.sessionSupabaseAuth).toBe("keep-session-auth");
    expect(storage.runtimeShipId).toBe("");
    expect(storage.runtimeOwnedShips).toEqual([]);
    expect(storage.blankMeaningful).toBe(false);
    expect(storage.defaultShellMeaningful).toBe(false);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("staging resetPilot clears progress, preserves Supabase auth, and writes a clean cloud save", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.addInitScript(() => {
      localStorage.setItem("lupenGameState", JSON.stringify({
        credits: 999999,
        currentShipId: "monolith",
        ownedShips: ["falcon", "monolith"],
        ownedGuns: { pulseLaser: 4, ionBlaster: 2 },
        inventoryItems: [{ id: "stale-item", key: "lupenCore", quality: "core" }],
        playerProgress: { combatXp: 8800, totals: { botsDestroyed: 99, erebusBotsDestroyed: 44, tradeProfit: 77777 } },
        activeObjective: { type: "bounty", status: "active" }
      }));
      localStorage.setItem("lupenStarterPilotTutorial", JSON.stringify({ active: false, completed: true, stepIndex: 31 }));
      localStorage.setItem("lupenPendingPilotName", "Stale Pilot");
      localStorage.setItem("sb-ylzglwiehkypetcdkqxd-auth-token", "keep-auth");
      sessionStorage.setItem("sb-ylzglwiehkypetcdkqxd-auth-token", "keep-session-auth");
      window.__pilotResetCloudUpserts = [];
      const user = {
        id: "77777777-7777-4777-8777-777777777777",
        email: "reset@example.test"
      };
      const fakeClient = {
        auth: {
          getUser: async () => ({ data: { user }, error: null })
        },
        from: (table) => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: null, error: null })
            })
          }),
          upsert: async (payload) => {
            window.__pilotResetCloudUpserts.push({ table, payload });
            return { data: payload, error: null };
          }
        })
      };
      window.lupenSupabase = fakeClient;
      window.supabase = { createClient: () => fakeClient };
    });

    await page.goto("/?mp=staging&resetPilot=1");
    await waitForGameGlobals(page);
    await page.waitForFunction(() => !window.location.href.includes("resetPilot=1"));

    const reset = await page.evaluate(() => ({
      href: window.location.href,
      helperType: typeof window.lupenResetPilotProgress,
      auth: localStorage.getItem("sb-ylzglwiehkypetcdkqxd-auth-token"),
      sessionAuth: sessionStorage.getItem("sb-ylzglwiehkypetcdkqxd-auth-token"),
      pendingPilot: localStorage.getItem("lupenPendingPilotName"),
      saved: JSON.parse(localStorage.getItem("lupenGameState")),
      tutorial: JSON.parse(localStorage.getItem("lupenStarterPilotTutorial")),
      cloudUpserts: window.__pilotResetCloudUpserts,
      overlayActive: document.getElementById("tutorialOverlay")?.classList.contains("active") || false
    }));

    expect(reset.href).toContain("mp=staging");
    expect(reset.href).not.toContain("resetPilot=1");
    expect(reset.helperType).toBe("function");
    expect(reset.auth).toBe("keep-auth");
    expect(reset.sessionAuth).toBe("keep-session-auth");
    expect(reset.pendingPilot).toBe(null);
    expect(reset.saved.credits).toBe(10000);
    expect(reset.saved.currentShipId).toBe("");
    expect(reset.saved.ownedShips).toEqual([]);
    expect(reset.saved.inventoryItems).toEqual([]);
    expect(reset.saved.activeObjective).toBe(null);
    expect(reset.saved.playerProgress.combatXp).toBe(0);
    expect(reset.saved.playerProgress.totals.botsDestroyed).toBe(0);
    expect(reset.saved.playerProgress.totals.erebusBotsDestroyed).toBe(0);
    expect(reset.saved.playerProgress.totals.tradeProfit).toBe(0);
    expect(reset.tutorial.active).toBe(false);
    expect(reset.tutorial.completed).toBe(false);
    expect(reset.tutorial.stepIndex).toBe(0);
    expect(reset.overlayActive).toBe(false);
    expect(reset.cloudUpserts).toHaveLength(1);
    expect(reset.cloudUpserts[0].table).toBe("player_saves");
    expect(reset.cloudUpserts[0].payload.user_id).toBe("77777777-7777-4777-8777-777777777777");
    expect(reset.cloudUpserts[0].payload.save_data.credits).toBe(10000);
    expect(reset.cloudUpserts[0].payload.save_data.currentShipId).toBe("");
    expect(reset.cloudUpserts[0].payload.save_data.ownedShips).toEqual([]);

    const starterClaim = await page.evaluate(() => window.eval(`
      (() => {
        showScreen("gameScreen");
        openHangar();
        showHangarSection("shipyard");
        selectedShipyardShipId = STARTER_SHIP_ID;
        renderShipShop();
        renderShipyardDetail();
        const button = document.querySelector("#shipyardDetailPanel .buy-ship-action[data-tutorial-target='firstShipBuy']");
        return {
          text: button?.textContent?.trim() || "",
          disabled: Boolean(button?.disabled),
          visible: Boolean(button && button.offsetParent !== null),
          selectedShipName: SHIPS[selectedShipyardShipId]?.name || ""
        };
      })()
    `));

    expect(starterClaim.selectedShipName).toBe("Azure Striker");
    expect(starterClaim.text).toBe("Claim Starter Ship");
    expect(starterClaim.disabled).toBe(false);
    expect(starterClaim.visible).toBe(true);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("fresh pilot first-session reset clears stale runtime state and launches cleanly", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await waitForGameGlobals(page);

    const firstSession = await page.evaluate(() => window.eval(`
      (async () => {
        showScreen("spaceScreen");
        selectedTarget = { type: "remotePlayer", id: "stale-player" };
        engagedTarget = { type: "stagingResource", id: "stale-resource" };
        serverPvpDamageDisplayState = { hull: 12, hullMax: 120, shield: 0, shieldMax: 60, updatedAt: Date.now() };
        cargo.Copper = 9;
        cargoRecovered.Copper = 9;
        window.LupenMultiplayerOverlay?.setSelectedResourceId?.("stale-resource");
        const fxLayer = document.getElementById("combatFxLayer") || document.body.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
        fxLayer.id = "combatFxLayer";
        const staleShot = document.createElementNS("http://www.w3.org/2000/svg", "g");
        staleShot.classList.add("combat-fx-shot");
        staleShot.dataset.targetId = "stale-resource";
        fxLayer.appendChild(staleShot);
        updateObjectActionPanel(true);

        const resetResult = await window.lupenResetPilotProgress({ reload: false });
        updateObjectActionPanel(true);
        updateCargoSummary();
        const afterReset = {
          resetOk: resetResult.ok === true,
          currentShipId,
          ownedShips: ownedShips.slice(),
          credits,
          currentNode,
          lastPlanetNode,
          cargoUsed: cargoUsed(),
          cargoRecoveredKeys: Object.keys(cargoRecovered || {}),
          selectedTarget,
          engagedTarget,
          pvpState: serverPvpDamageDisplayState,
          selectedResourceId: window.LupenMultiplayerOverlay?.getSelectedResourceId?.() || "",
          fxCount: document.querySelectorAll("#combatFxLayer .combat-fx-shot").length,
          actionText: document.getElementById("objectEngageBtn")?.textContent || "",
          actionDisabled: document.getElementById("objectEngageBtn")?.disabled ?? null,
          actionInactive: document.getElementById("objectEngageBtn")?.classList.contains("action-inactive") || false,
          cargoSummary: document.getElementById("hudCargoSummary")?.textContent || "",
          cargoFullHidden: document.getElementById("hudCargoFullBadge")?.hidden ?? null,
          cargoIsFull: document.getElementById("hudCargoSummary")?.classList.contains("is-full") || false,
          tutorialActive: document.getElementById("tutorialOverlay")?.classList.contains("active") || false,
          saved: JSON.parse(localStorage.getItem(STORAGE_GAME_KEY))
        };

        showScreen("gameScreen");
        openHangar();
        showHangarSection("shipyard");
        selectedShipyardShipId = STARTER_SHIP_ID;
        renderShipShop();
        renderShipyardDetail();
        const claimButton = document.querySelector("#shipyardDetailPanel .buy-ship-action[data-tutorial-target='firstShipBuy']");
        const claimText = claimButton?.textContent?.trim() || "";
        buyShip(STARTER_SHIP_ID);
        launchShip();
        updateObjectActionPanel(true);
        updateCargoSummary();
        document.getElementById("objectEngageBtn")?.click();

        return {
          afterReset,
          claimText,
          afterLaunch: {
            spaceActive: document.getElementById("spaceScreen")?.classList.contains("active") || false,
            gameActive: document.getElementById("gameScreen")?.classList.contains("active") || false,
            currentShipId,
            ownsStarter: ownedShips.includes(STARTER_SHIP_ID),
            currentNode,
            lastPlanetNode,
            hull,
            hullMax,
            shield,
            shieldMax,
            credits,
            cargoUsed: cargoUsed(),
            cargoRecoveredKeys: Object.keys(cargoRecovered || {}),
            actionText: document.getElementById("objectEngageBtn")?.textContent || "",
            actionDisabled: document.getElementById("objectEngageBtn")?.disabled ?? null,
            actionInactive: document.getElementById("objectEngageBtn")?.classList.contains("action-inactive") || false,
            selectedTarget,
            engagedTarget,
            cargoSummary: document.getElementById("hudCargoSummary")?.textContent || "",
            multiplayerStatus: document.getElementById("lupenMultiplayerStatusChip")?.textContent?.trim() || "",
            saved: JSON.parse(localStorage.getItem(STORAGE_GAME_KEY))
          }
        };
      })()
    `));

    expect(firstSession.afterReset).toMatchObject({
      resetOk: true,
      currentShipId: "",
      ownedShips: [],
      credits: 10000,
      currentNode: "Asteron Prime",
      lastPlanetNode: "Asteron Prime",
      cargoUsed: 0,
      cargoRecoveredKeys: [],
      selectedTarget: null,
      engagedTarget: null,
      pvpState: null,
      selectedResourceId: "",
      fxCount: 0,
      actionText: "ENGAGE",
      actionDisabled: true,
      actionInactive: true,
      cargoFullHidden: true,
      cargoIsFull: false,
      tutorialActive: false
    });
    expect(firstSession.afterReset.cargoSummary).toContain("0 / 0");
    expect(firstSession.afterReset.saved).toMatchObject({
      credits: 10000,
      currentShipId: "",
      ownedShips: [],
      currentNode: "Asteron Prime",
      lastPlanetNode: "Asteron Prime"
    });
    expect(firstSession.afterReset.saved.cargoRecovered).toEqual({});

    expect(firstSession.claimText).toBe("Claim Starter Ship");
    expect(firstSession.afterLaunch).toMatchObject({
      spaceActive: true,
      gameActive: false,
      currentShipId: "falcon",
      ownsStarter: true,
      currentNode: "Asteron Prime",
      lastPlanetNode: "Asteron Prime",
      credits: 10000,
      cargoUsed: 0,
      cargoRecoveredKeys: [],
      actionText: "ENGAGE",
      actionDisabled: true,
      actionInactive: true,
      selectedTarget: null,
      engagedTarget: null
    });
    expect(firstSession.afterLaunch.hull).toBeGreaterThan(0);
    expect(firstSession.afterLaunch.hull).toBe(firstSession.afterLaunch.hullMax);
    expect(firstSession.afterLaunch.shield).toBe(firstSession.afterLaunch.shieldMax);
    expect(firstSession.afterLaunch.cargoSummary).toContain("0 / 150");
    expect(firstSession.afterLaunch.multiplayerStatus).toMatch(/Multiplayer|Offline|Connecting|Online|Reconnecting/i);
    expect(firstSession.afterLaunch.saved.currentShipId).toBe("falcon");
    expect(firstSession.afterLaunch.saved.ownedShips).toContain("falcon");
    expect(firstSession.afterLaunch.saved.cargoRecovered).toEqual({});

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("missing cloud save starts fresh instead of silently uploading stale local progress", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging");
    await waitForGameGlobals(page);
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem("lupenGameState", JSON.stringify({
        credits: 50000,
        currentShipId: "falcon",
        ownedShips: ["falcon"],
        playerProgress: { combatXp: 3, totals: { botsDestroyed: 2 } }
      }));
      localStorage.setItem("sb-ylzglwiehkypetcdkqxd-auth-token", "keep-auth");
      window.__migrationPromptCount = 0;
      window.__uploadCount = 0;
      const user = {
        id: "66666666-6666-4666-8666-666666666666",
        email: "fresh@example.test",
        user_metadata: { pilot_name: "Fresh Pilot" }
      };
      const profile = { id: user.id, pilot_name: "Fresh Pilot", last_seen: null };
      window.__fakeGetSupabaseClient = () => ({
        auth: {
          signInWithPassword: async () => ({ data: { user }, error: null }),
          getUser: async () => ({ data: { user }, error: null })
        },
        from: () => ({
          select: () => ({
            eq: () => ({
              single: async () => ({ data: profile, error: null }),
              maybeSingle: async () => ({ data: null, error: null })
            })
          }),
          update: () => ({
            eq: () => ({
              select: () => ({
                single: async () => ({ data: profile, error: null })
              })
            })
          })
        })
      });
      window.eval(`
        getSupabaseClient = window.__fakeGetSupabaseClient;
        loadGameFromSupabase = async () => ({ loaded: false, exists: false, reason: "missing" });
        uploadLocalSavePayloadToSupabase = async () => {
          window.__uploadCount += 1;
          return true;
        };
      `);
      window.promptUploadLocalSaveToSupabase = async () => {
        window.__migrationPromptCount += 1;
        return "fresh";
      };
      window.showScreen("loginScreen");
      document.getElementById("loginUser").value = "fresh@example.test";
      document.getElementById("loginPassword").value = "password123";
    });

    await page.evaluate(() => window.login());

    const state = await page.evaluate(() => ({
      promptCount: window.__migrationPromptCount,
      uploadCount: window.__uploadCount,
      supabaseAuth: localStorage.getItem("sb-ylzglwiehkypetcdkqxd-auth-token"),
      saved: JSON.parse(localStorage.getItem("lupenGameState")),
      tutorial: JSON.parse(localStorage.getItem("lupenStarterPilotTutorial"))
    }));

    expect(state.promptCount).toBe(1);
    expect(state.uploadCount).toBe(0);
    expect(state.supabaseAuth).toBe("keep-auth");
    expect(state.saved.credits).toBe(10000);
    expect(state.saved.currentShipId).toBe("");
    expect(state.saved.ownedShips).toEqual([]);
    expect(state.tutorial.active).toBe(false);
    expect(state.tutorial.completed).toBe(false);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("normal trade terminal opens without performing buy or sell actions", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await openTradeTerminal(page);

    await expect(page.locator("#creditsText")).toBeVisible();
    await expect(page.locator("#cargoText")).toBeVisible();
    await expect(page.locator("#marketScreen")).toContainText(/Accept Trade|Sell Cargo|Sell Here|No profitable route available/);
    await expect(page.locator("#marketScreen")).not.toContainText("Server Buy");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("trade terminal route cards accept max profitable cargo and hide loss routes", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/");
    await waitForGameGlobals(page);
    await page.evaluate(() => window.eval(`
      (() => {
        localStorage.clear();
        currentShipId = STARTER_SHIP_ID;
        selectedHangarShipId = STARTER_SHIP_ID;
        selectedFleetShipId = STARTER_SHIP_ID;
        ownedShips = [STARTER_SHIP_ID];
        ownedAttachments.cargoPod = 1;
        shipLoadouts = { [STARTER_SHIP_ID]: normalizeShipLoadout({ attachments: ["cargoPod"], guns: ["pulseLaser"] }, STARTER_SHIP_ID) };
        credits = 14774;
        currentNode = "Virella";
        lastPlanetNode = "Virella";
        planetMarkets["Virella"]["Crystal Shards"] = 120;
        planetMarkets["Asteron Prime"]["Crystal Shards"] = 95;
        planetMarkets["Nyxara"]["Crystal Shards"] = 145;
        planetMarkets["Virella"]["Cobalt"] = 74;
        planetMarkets["Asteron Prime"]["Cobalt"] = 90;
        planetMarkets["Nyxara"]["Cobalt"] = 62;
        activeTradeRoute = null;
        activeObjective = null;
        mineralKeys.forEach(key => { cargo[key] = 0; });
        cargoCostBasis = {};
        selectedMarketResource = "Crystal Shards";
        selectedMarketTargetPlanet = "Nyxara";
        selectedMarketQuantity = 2;
        showScreen("gameScreen");
        openMarketplace();
      })()
    `));

    await expect(page.locator("#marketScreen")).toContainText("BEST ROUTE");
    await expect(page.locator("#marketScreen .trade-route-card")).toHaveCount(1);
    await expect(page.locator("#marketScreen")).not.toContainText("Confirm Target");
    await expect(page.locator("#marketScreen .market-target-select")).toHaveCount(0);
    await expect(page.locator("#marketScreen")).not.toContainText("Buy Amount");
    await expect(page.locator("#marketScreen")).not.toContainText("MAX");

    const profitableRoute = page.locator("#marketScreen .trade-route-card[data-route-destination='Nyxara']");
    const lossRoute = page.locator("#marketScreen .trade-route-card[data-route-destination='Asteron Prime']");
    await expect(profitableRoute).toContainText("BEST ROUTE");
    await expect(profitableRoute).toContainText("Sell CR 145");
    await expect(profitableRoute).toContainText("2 Jumps");
    await expect(profitableRoute).toContainText("Estimated Profit");
    await expect(profitableRoute).toContainText("+CR 3,075");
    await expect(profitableRoute).toContainText("Cargo:");
    await expect(profitableRoute).toContainText("123 units");
    await expect(profitableRoute.locator(".trade-route-card__button")).toHaveText("Accept Trade");
    await expect(lossRoute).toHaveCount(0);

    const layout = await page.locator("#marketScreen .map-one-market-terminal").evaluate((terminal) => {
      const screen = document.getElementById("marketScreen");
      const loadButton = terminal.querySelector(".trade-route-card__button:not(:disabled)")?.getBoundingClientRect();
      const amount = terminal.querySelector(".market-amount-control--route")?.getBoundingClientRect();
      const screenRect = screen.getBoundingClientRect();
      return {
        terminalFits: terminal.scrollWidth <= terminal.clientWidth + 1,
        loadButtonVisible: Boolean(loadButton && loadButton.bottom <= screenRect.bottom && loadButton.right <= screenRect.right),
        amountPresent: Boolean(amount)
      };
    });
    expect(layout).toMatchObject({
      terminalFits: true,
      loadButtonVisible: true,
      amountPresent: false
    });

    fs.mkdirSync("artifacts", { recursive: true });
    await page.screenshot({ path: "artifacts/trade-terminal-route-cards.png", fullPage: false });

    const lossNoop = await page.evaluate(() => window.eval(`
      (() => {
        const beforeCredits = credits;
        const beforeCargo = cargo["Crystal Shards"] || 0;
        loadMarketRouteCargo("Asteron Prime");
        return { beforeCredits, afterCredits: credits, beforeCargo, afterCargo: cargo["Crystal Shards"] || 0 };
      })()
    `));
    expect(lossNoop.afterCredits).toBe(lossNoop.beforeCredits);
    expect(lossNoop.afterCargo).toBe(lossNoop.beforeCargo);

    await profitableRoute.locator(".trade-route-card__button").click();
    const buyState = await page.evaluate(() => window.eval(`
      (() => {
        const saved = JSON.parse(localStorage.getItem(STORAGE_GAME_KEY) || "{}");
        return {
          credits,
          cargoCrystalShards: cargo["Crystal Shards"] || 0,
          route: { ...activeTradeRoute },
          objective: { ...activeObjective },
          savedCredits: saved.credits,
          savedCargoCrystalShards: saved.cargo?.["Crystal Shards"] || 0,
          activityText: document.getElementById("activityLogFeed")?.textContent || ""
        };
      })()
    `));
    expect(buyState.credits).toBe(14);
    expect(buyState.cargoCrystalShards).toBe(123);
    expect(buyState.route).toMatchObject({
      good: "Crystal Shards",
      origin: "Virella",
      destination: "Nyxara",
      marketTrade: true
    });
    expect(buyState.objective.destination).toBe("Nyxara");
    expect(buyState.savedCredits).toBe(14);
    expect(buyState.savedCargoCrystalShards).toBe(123);
    expect(buyState.activityText).toContain("Route locked: Virella -> Nyxara");

    await page.evaluate(() => window.eval(`
      (() => {
        credits = 10000;
        currentNode = "Asteron Prime";
        lastPlanetNode = "Asteron Prime";
        activeTradeRoute = null;
        activeObjective = null;
        mineralKeys.forEach(key => { cargo[key] = 0; });
        cargoCostBasis = {};
        selectedMarketResource = "Cobalt";
        selectedMarketTargetPlanet = "Nyxara";
        selectedMarketQuantity = 1;
        renderMarketplace();
      })()
    `));
    await expect(page.locator("#marketScreen .trade-route-card")).toHaveCount(0);
    await expect(page.locator("#marketScreen")).toContainText("No profitable route available for this resource.");
    await expect(page.locator("#marketScreen")).toContainText("Select another resource or wait for the next market refresh.");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("early progression locks ships and equipment while preserving starter access", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await waitForGameGlobals(page);

    const progression = await page.evaluate(() => window.eval(`
      (() => {
        localStorage.clear();
        credits = 50000;
        currentShipId = "falcon";
        selectedHangarShipId = "falcon";
        selectedFleetShipId = "falcon";
        selectedShipyardShipId = "zeusExplorer";
        ownedShips = ["falcon"];
        ownedGuns = Object.fromEntries(Object.keys(GUNS).map(key => [key, 0]));
        ownedAttachments = Object.fromEntries(Object.keys(attachments).map(key => [key, 0]));
        shipLoadouts = { falcon: normalizeShipLoadout({ attachments: [], guns: [] }, "falcon") };
        playerProgress = normalizePlayerProgress({ combatXp: 0, totals: { botsDestroyed: 0, erebusBotsDestroyed: 0, tradeProfit: 0, totalTradingProfit: 0 } });
        tutorialState = { active: false, completed: false, stepIndex: 0 };
        buyGun("repeater");
        const repeaterOwnedAfterBlockedBuy = ownedGuns.repeater || 0;
        buyGun("pulseLaser");
        buyAttachment("cargoPod");
        buyAttachment("jumpDrive");
        buyAttachment("shieldBooster");
        ownedGuns.ionBlaster = 1;
        selectedLoadoutSlotCategory = "guns";
        selectedLoadoutItemContext = { source: "slot", categoryKey: "guns", index: 0, key: "", quality: "standard" };
        equipGunFromInventory("ionBlaster");
        playerProgress.totals.erebusBotsDestroyed = 12;
        playerProgress.totals.botsDestroyed = 12;
        playerProgress.totals.totalTradingProfit = 3456;
        playerProgress.totals.tradeProfit = 3456;
        const initialStarterShip = getShipUnlockStatus("falcon");
        const initialNightshade = getShipUnlockStatus("zeusExplorer");
        const initialHauler = getShipUnlockStatus("bison");
        const initialPulse = getEquipmentUnlockStatus("guns", "pulseLaser");
        const initialRepeater = getEquipmentUnlockStatus("guns", "repeater");
        const initialCargoPod = getEquipmentUnlockStatus("attachments", "cargoPod");
        const initialJumpDrive = getEquipmentUnlockStatus("attachments", "jumpDrive");
        const initialShieldBooster = getEquipmentUnlockStatus("attachments", "shieldBooster");
        const creditsBeforeLockedBuy = credits;
        buyShip("zeusExplorer");
        buyShip("bison");
        const ownedAfterLockedBuy = [...ownedShips];
        const creditsAfterLockedBuy = credits;
        playerProgress = normalizePlayerProgress({
          combatXp: 2500,
          totals: { botsDestroyed: 25, erebusBotsDestroyed: 25, tradeProfit: 7500, totalTradingProfit: 7500 }
        });
        const nightshadeAvailable = getShipUnlockStatus("zeusExplorer");
        const haulerAvailable = getShipUnlockStatus("bison");
        buyShip("zeusExplorer");
        const ownedAfterNightshadeBuy = [...ownedShips];
        const creditsAfterNightshadeBuy = credits;
        buyShip("bison");
        const ownedAfterHaulerBuy = [...ownedShips];
        const creditsAfterHaulerBuy = credits;
        playerProgress = normalizePlayerProgress({ combatXp: 0, totals: { botsDestroyed: 24, erebusBotsDestroyed: 24, tradeProfit: 7400, totalTradingProfit: 7400 } });
        credits = 50000;
        ownedShips = ["falcon"];
        showScreen("spaceScreen");
        const feed = document.getElementById("activityLogFeed");
        if (feed) feed.innerHTML = "";
        playerProgress.combatXp = 2500;
        recordBotDestroyedProgress({ faction: "erebus", botType: "erebus_attacker", name: "Erebus Attacker" });
        awardTradingXpFromProfit(100);
        const feedbackText = feed?.textContent || "";
        saveGame();
        return {
          starterShip: initialStarterShip,
          nightshade: initialNightshade,
          hauler: initialHauler,
          pulse: initialPulse,
          repeater: initialRepeater,
          cargoPod: initialCargoPod,
          jumpDrive: initialJumpDrive,
          shieldBooster: initialShieldBooster,
          repeaterOwnedAfterBlockedBuy,
          pulseOwned: ownedGuns.pulseLaser || 0,
          cargoOwned: ownedAttachments.cargoPod || 0,
          jumpOwned: ownedAttachments.jumpDrive || 0,
          shieldOwned: ownedAttachments.shieldBooster || 0,
          ionOwned: ownedGuns.ionBlaster || 0,
          equippedGuns: shipLoadouts.falcon.guns.length,
          creditsBeforeLockedBuy,
          creditsAfterLockedBuy,
          ownedAfterLockedBuy,
          nightshadeAvailable,
          haulerAvailable,
          ownedAfterNightshadeBuy,
          creditsAfterNightshadeBuy,
          ownedAfterHaulerBuy,
          creditsAfterHaulerBuy,
          feedbackText,
          savedProgress: JSON.parse(localStorage.getItem("lupenGameState")).playerProgress.totals
        };
      })()
    `));

    expect(progression.starterShip.locked).toBe(false);
    expect(progression.nightshade.locked).toBe(true);
    expect(progression.nightshade.requirementLines.join(" ")).toContain("Destroy Erebus bots: 12 / 25");
    expect(progression.hauler.locked).toBe(true);
    expect(progression.hauler.requirementLines.join(" ")).toContain("Trading profit: CR 3,456 / CR 7,500");
    expect(progression.pulse.locked).toBe(false);
    expect(progression.cargoPod.locked).toBe(false);
    expect(progression.jumpDrive.locked).toBe(false);
    expect(progression.repeater.locked).toBe(true);
    expect(progression.shieldBooster.locked).toBe(true);
    expect(progression.repeaterOwnedAfterBlockedBuy).toBe(0);
    expect(progression.pulseOwned).toBe(1);
    expect(progression.cargoOwned).toBe(1);
    expect(progression.jumpOwned).toBe(1);
    expect(progression.shieldOwned).toBe(0);
    expect(progression.ionOwned).toBe(1);
    expect(progression.equippedGuns).toBe(0);
    expect(progression.creditsAfterLockedBuy).toBe(progression.creditsBeforeLockedBuy);
    expect(progression.ownedAfterLockedBuy).toEqual(["falcon"]);
    expect(progression.nightshadeAvailable.locked).toBe(false);
    expect(progression.nightshadeAvailable.state).toBe("available");
    expect(progression.haulerAvailable.locked).toBe(false);
    expect(progression.haulerAvailable.state).toBe("available");
    expect(progression.ownedAfterNightshadeBuy).toContain("zeusExplorer");
    expect(progression.creditsAfterNightshadeBuy).toBe(progression.creditsBeforeLockedBuy - 8500);
    expect(progression.ownedAfterHaulerBuy).toContain("bison");
    expect(progression.creditsAfterHaulerBuy).toBe(progression.creditsBeforeLockedBuy - 8500 - 10500);
    expect(progression.feedbackText).toContain("Unlocked: Nightshade Hawk is now available in Vessel Exchange.");
    expect(progression.feedbackText).toContain("Unlocked: Buu Hauler is now available in Vessel Exchange.");
    expect(progression.savedProgress).toMatchObject({
      erebusBotsDestroyed: 25,
      botsDestroyed: 25,
      totalTradingProfit: 7500,
      tradeProfit: 7500
    });

    await page.evaluate(() => window.eval(`
      playerProgress = normalizePlayerProgress({
        combatXp: 0,
        totals: { botsDestroyed: 12, erebusBotsDestroyed: 12, tradeProfit: 3456, totalTradingProfit: 3456 }
      });
      ownedShips = ["falcon"];
      showScreen("gameScreen");
      openHangar();
      showHangarSection("shipyard");
      selectShipyardShip("zeusExplorer");
      saveGame();
    `));

    await expect(page.locator(".vessel-exchange-card[data-ship-id='zeusExplorer']")).toHaveClass(/progression-locked/);
    await expect(page.locator("#shipyardDetailPanel")).toContainText("Unlock Requirements");
    await expect(page.locator("#shipyardDetailPanel")).toContainText("Ship Stats");
    await expect(page.locator("#shipyardDetailPanel")).toContainText("Combat Level");
    await expect(page.locator("#shipyardDetailPanel")).toContainText("1 / 2");
    await expect(page.locator("#shipyardDetailPanel")).toContainText("Erebus Bots Destroyed");
    await expect(page.locator("#shipyardDetailPanel")).toContainText("12 / 25");
    await expect(page.locator("#shipyardDetailPanel")).toContainText("Weapon Slots");
    await expect(page.locator("#shipyardDetailPanel")).toContainText("Equipment Slots");

    await page.evaluate(() => window.eval("selectShipyardShip('monolith')"));
    await expect(page.locator(".vessel-exchange-card[data-ship-id='monolith']")).toHaveClass(/progression-locked/);
    await expect(page.locator("#shipyardDetailPanel")).toContainText("Unlock Requirements");
    await expect(page.locator("#shipyardDetailPanel")).toContainText("Combat Level");
    await expect(page.locator("#shipyardDetailPanel")).toContainText("Erebus Bots Destroyed");
    await expect(page.locator("#shipyardDetailPanel")).toContainText("Bounties Completed");
    await expect(page.locator("#shipyardDetailPanel .locked-action")).toHaveText("Locked");
    await expect(page.locator("#shipyardDetailPanel .shipyard-price-action")).toHaveText("CR 48,000");

    await page.reload();
    await waitForGameGlobals(page);
    const restored = await page.evaluate(() => ({
      nightshade: getShipUnlockStatus("zeusExplorer"),
      hauler: getShipUnlockStatus("bison")
    }));
    expect(restored.nightshade.locked).toBe(true);
    expect(restored.nightshade.requirementLines.join(" ")).toContain("Destroy Erebus bots: 12 / 25");
    expect(restored.hauler.locked).toBe(true);
    expect(restored.hauler.requirementLines.join(" ")).toContain("Trading profit: CR 3,456 / CR 7,500");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("multiplayer staging mode exposes staging UI without using real trade buttons", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await expect(page.locator("#lupenMultiplayerStatusChip")).toContainText(/Staging/, { timeout: 15000 });
    const tutorialDefault = await page.evaluate(() => ({
      tutorial: window.eval("({ ...tutorialState })"),
      overlayActive: document.getElementById("tutorialOverlay")?.classList.contains("active") || false
    }));
    expect(tutorialDefault.tutorial.active).toBe(false);
    expect(tutorialDefault.overlayActive).toBe(false);
    await expect(page.locator("#lupenMultiplayerStagingFlowHint")).toContainText("Multiplayer Staging Loop", { timeout: 15000 });
    await expect(page.locator("#lupenMultiplayerStagingFlowHint")).toContainText(/Trade for CR[\s\S]*Store upgrades[\s\S]*Launch[\s\S]*Engage bots[\s\S]*Claim bounty rewards/i);
    await expect(page.locator("#lupenMultiplayerStagingFlowHint")).toContainText(/No PvP[\s\S]*bots return fire locally/i);
    await expect(page.locator("#chatPanel .chat-channel-tabs")).toBeHidden();
    await expect(page.locator("#onlinePilotsList")).toContainText(/Chat unavailable while disconnected|Online Pilots/i);
    await page.evaluate(() => {
      if (typeof window.showScreen === "function") window.showScreen("spaceScreen");
    });
    await expect(page.locator("#localChatInput")).toBeVisible();
    await expect(page.locator("#chatPanel .local-chat-input-row button")).toBeVisible();
    const chatComposerLayout = await page.evaluate(() => {
      const input = document.getElementById("localChatInput")?.getBoundingClientRect();
      const button = document.querySelector("#chatPanel .local-chat-input-row button")?.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      return {
        inputVisibleInViewport: Boolean(input && input.left >= 0 && input.top >= 0 && input.right <= viewportWidth && input.bottom <= viewportHeight && input.width > 80 && input.height >= 24),
        buttonVisibleInViewport: Boolean(button && button.left >= 0 && button.top >= 0 && button.right <= viewportWidth && button.bottom <= viewportHeight && button.width >= 50 && button.height >= 24)
      };
    });
    expect(chatComposerLayout.inputVisibleInViewport).toBe(true);
    expect(chatComposerLayout.buttonVisibleInViewport).toBe(true);
    await expect(page.locator("#localChatInput")).toBeDisabled();
    await expect(page.locator("#chatPanel .local-chat-input-row button")).toBeDisabled();
    await expect(page.locator("#localChatFeed")).toContainText("Chat unavailable while disconnected");
    const connectedHudState = await page.evaluate(() => {
      const originalClient = window.LupenMultiplayerClient;
      currentNode = "Asteron Prime";
      const sentMessages = [];
      const sentResourceMines = [];
      const sentPvpIntents = [];
      const stagingResources = [{
        id: "staging-resource-test-iron",
        resourceName: "Iron",
        currentNode: "Asteron Prime",
        x: 42,
        y: 35,
        hp: 20,
        hpMax: 30,
        yieldAmount: 12,
        depleted: false,
        depletedUntil: 0,
        lastUpdatedAt: Date.now()
      }];
      const duplicatePlayerMessage = {
        id: "msg-1",
        type: "chat",
        channel: "sector",
        displayName: "Remote Pilot",
        message: "Visible player message",
        receivedAt: Date.now()
      };
      window.LupenMultiplayerClient = {
        enabled: true,
        getStatus: () => ({
          enabled: true,
          isConnected: true,
          enabledReason: "staging_enabled",
          sessionId: "local-session"
        }),
        getPlayers: ({ includeSelf = true } = {}) => [
          ...(includeSelf ? [{
            isSelf: true,
            sessionId: "local-session",
            displayName: "Local Pilot",
            currentNode: "Asteron Prime",
            currentShipId: "falcon",
            shipName: "Azure Striker",
            shipImage: "assets/ships/azure-striker/azure-striker-medium.webp",
            lastSeenAt: Date.now()
          }] : []),
          {
            isSelf: false,
            sessionId: "stale-remote-session",
            displayName: "Remote Pilot",
            currentNode: "Asteron Prime",
            currentShipId: "lupenOrigin",
            shipName: "LF-1 Origin",
            shipImage: "assets/ships/lupen-origin.png",
            lastSeenAt: Date.now() - 5000
          },
          {
            isSelf: false,
            sessionId: "remote-session",
            displayName: "Remote Pilot",
            currentNode: "Asteron Prime",
            presenceStatus: "space",
            currentShipId: "zeusExplorer",
            shipName: "Nightshade Hawk",
            shipImage: "assets/ships/nightshade-hawk/nightshade-hawk-medium.webp",
            lastSeenAt: Date.now()
          },
          {
            isSelf: false,
            sessionId: "idle-remote-session",
            displayName: "Idle Pilot",
            currentNode: "Asteron Prime",
            presenceStatus: "space",
            currentShipId: "zeusExplorer",
            shipName: "Nightshade Hawk",
            shipImage: "assets/ships/nightshade-hawk/nightshade-hawk-medium.webp",
            lastSeenAt: Date.now() - 60000
          },
          {
            isSelf: false,
            sessionId: "docked-remote-session",
            displayName: "Docked Pilot",
            currentNode: "Asteron Prime",
            presenceStatus: "docked",
            currentShipId: "bison",
            shipName: "Buu Hauler",
            shipImage: "assets/ships/buu-hauler/buu-hauler-medium.webp",
            lastSeenAt: Date.now()
          }
        ],
        getBots: () => [],
        getResources: () => stagingResources,
        getSelectedStagingBot: () => null,
        getPresenceEvents: () => [{
          type: "playerMoved",
          sessionId: "remote-session",
          displayName: "Remote Pilot",
          previousNode: "Upper Gate Core",
          currentNode: "Asteron Prime",
          presenceStatus: "space",
          receivedAt: Date.now()
        }],
        getChatMessages: () => [
          duplicatePlayerMessage,
          { ...duplicatePlayerMessage },
          {
            id: "system-1",
            type: "system",
            channel: "sector",
            displayName: "System",
            message: "Remote Pilot joined at Asteron Prime.",
            receivedAt: Date.now()
          }
        ],
        sendChatMessage: (message) => {
          sentMessages.push(message);
          return { ok: true };
        },
        mineStagingResource: (resourceId, options) => {
          sentResourceMines.push({ resourceId, ...options });
          return { ok: true };
        },
        sendCombatIntent: (intent) => {
          if (intent?.targetPlayerId || intent?.targetSessionId || intent?.targetType === "remotePlayer") {
            sentPvpIntents.push({ ...intent });
            return { ok: true, type: "combat:intent", payload: { ...intent } };
          }
          return { ok: true };
        },
        onServerState: () => ({ unsubscribe() {} })
      };
      window.LupenMultiplayerOverlay.render();
      selectRemotePlayerTarget("remote-session");
      window.LupenMultiplayerOverlay.render();
      const playerTargetCard = document.querySelector(".lupen-target-card.player");
      const playerTargetText = playerTargetCard?.textContent || "";
      const playerTargetCardClass = playerTargetCard?.className || "";
      const playerTargetCardLayout = playerTargetCard?.getAttribute("data-layout") || "";
      const playerTargetSelected = document.querySelector("#lupenMultiplayerSpaceGhostLayer .lupen-mp-space-ghost.is-selected")?.dataset.sessionId || "";
      const engagePanel = document.getElementById("objectActionPanel");
      const engageButton = document.getElementById("objectEngageBtn");
      const engageVisibleForPlayer = engagePanel?.classList.contains("visible") || false;
      const engageDisabledForPlayer = engageButton?.disabled ?? false;
      const engageTextForPlayer = engageButton?.textContent || "";
      const selectedGhostRect = document.querySelector("#lupenMultiplayerSpaceGhostLayer .lupen-mp-space-ghost.is-selected")?.getBoundingClientRect();
      const playerCardRect = playerTargetCard?.getBoundingClientRect();
      const engageButtonRect = engageButton?.getBoundingClientRect();
      const playerCardLayout = selectedGhostRect && playerCardRect && engageButtonRect ? {
        cardHeight: Math.round(playerCardRect.height),
        cardWidth: Math.round(playerCardRect.width),
        cardTop: Math.round(playerCardRect.top),
        cardBottom: Math.round(playerCardRect.bottom),
        ghostBottom: Math.round(selectedGhostRect.bottom),
        buttonTop: Math.round(engageButtonRect.top),
        underGhost: playerCardRect.top >= selectedGhostRect.bottom - 6,
        clearOfButton: playerCardRect.bottom <= engageButtonRect.top - 8
      } : null;
      const pvpGuard = window.LupenMultiplayerClient.sendCombatIntent({
        targetType: "remotePlayer",
        targetPlayerId: "remote-session"
      });
      if (typeof engageTarget === "function") engageTarget();
      const input = document.getElementById("localChatInput");
      input.value = "  staging hello  ";
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      input.value = "  staging hello  ";
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      input.value = "   ";
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      input.value = "x".repeat(240);
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      const resourceMarker = document.querySelector("#lupenMultiplayerSpaceResourceLayer .lupen-mp-space-resource");
      const serverResourceTarget = document.querySelector("#asteroidField .server-resource-asteroid");
      serverResourceTarget?.click();
      window.LupenMultiplayerOverlay.render();
      const activeResourceMarker = document.querySelector("#lupenMultiplayerSpaceResourceLayer .lupen-mp-space-resource");
      const resourceMarkerStyle = activeResourceMarker ? getComputedStyle(activeResourceMarker) : null;
      const resourceCard = document.querySelector(".lupen-target-card.resource");
      const resourceActionText = engageButton?.textContent || "";
      const resourceActionDisabled = engageButton?.disabled ?? true;
      const resourceEngageButtonRect = engageButton?.getBoundingClientRect();
      const resourceClickTarget = resourceEngageButtonRect
        ? document.elementFromPoint(resourceEngageButtonRect.left + resourceEngageButtonRect.width / 2, resourceEngageButtonRect.top + resourceEngageButtonRect.height / 2)
        : null;
      resourceClickTarget?.dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        clientX: resourceEngageButtonRect.left + resourceEngageButtonRect.width / 2,
        clientY: resourceEngageButtonRect.top + resourceEngageButtonRect.height / 2
      }));
      const resourceEngagedActionText = engageButton?.textContent || "";
      const resourceEngagedActionDisabled = engageButton?.disabled ?? true;
      const resourceEngagedTarget = window.eval("engagedTarget ? { ...engagedTarget } : null");
      const resourceLocalShot = document.querySelector("#combatFxLayer .combat-fx-shot[data-target-type='stagingResource'][data-target-id='staging-resource-test-iron']");
      stagingResources[0].hp = 0;
      stagingResources[0].depleted = true;
      stagingResources[0].depletedUntil = Date.now() + 30000;
      const lifecycleResult = typeof handleStagingResourceLifecycleEvent === "function"
        ? handleStagingResourceLifecycleEvent({
          type: "stagingResource:depleted",
          resourceId: "staging-resource-test-iron",
          resourceName: "Iron",
          depleted: true,
          depletedUntil: stagingResources[0].depletedUntil,
          resourceRewardId: "e2e-server-resource-depleted"
        })
        : null;
      const image = document.querySelector("#lupenMultiplayerSpaceGhostLayer img");
      const resourceImage = document.querySelector("#lupenMultiplayerSpaceResourceLayer .lupen-mp-resource-rock img");
      const serverResourceImage = document.querySelector("#asteroidField .server-resource-asteroid img");
      const note = document.querySelector("#lupenMultiplayerSpaceGhostLayer .lupen-mp-space-ghost-note");
      const onlineText = document.getElementById("onlinePilotsList")?.textContent || "";
      const chatText = document.getElementById("localChatFeed")?.textContent || "";
      const result = {
        src: image?.getAttribute("src") || "",
        resourceImageSrc: resourceImage?.getAttribute("src") || "",
        serverResourceImageSrc: serverResourceImage?.getAttribute("src") || "",
        note: note?.textContent || "",
        serverResourceCount: document.querySelectorAll("#asteroidField .server-resource-asteroid").length,
        selectedServerResourceCount: document.querySelectorAll("#asteroidField .server-resource-asteroid.is-selected").length,
        engagedServerResourceCount: document.querySelectorAll("#asteroidField .server-resource-asteroid.engaged").length,
        playerShotCount: document.querySelectorAll("#laserLayer .laser-burst.player-shot").length,
        polishedPlayerShotCount: document.querySelectorAll("#laserLayer .laser-burst.player-shot-polished").length,
        volleyPlayerShotCount: document.querySelectorAll("#laserLayer .laser-burst.player-shot-volley").length,
        combatFxShotCount: document.querySelectorAll("#combatFxLayer .combat-fx-shot").length,
        explosionCount: document.querySelectorAll("#explosionLayer .space-explosion").length,
        lifecycleResult,
        selectedTargetAfterDepletion: window.eval("selectedTarget ? { ...selectedTarget } : null"),
        engagedTargetAfterDepletion: window.eval("engagedTarget ? { ...engagedTarget } : null"),
        ghostCount: document.querySelectorAll("#lupenMultiplayerSpaceGhostLayer .lupen-mp-space-ghost").length,
        resourceCount: document.querySelectorAll("#lupenMultiplayerSpaceResourceLayer .lupen-mp-space-resource").length,
        selectedResourceCount: document.querySelectorAll("#lupenMultiplayerSpaceResourceLayer .lupen-mp-space-resource.is-selected").length,
        resourceTitle: activeResourceMarker?.getAttribute("title") || "",
        resourceMarkerBackground: resourceMarkerStyle?.backgroundColor || "",
        resourceMarkerBorderTopWidth: resourceMarkerStyle?.borderTopWidth || "",
        resourceMarkerPaddingTop: resourceMarkerStyle?.paddingTop || "",
        resourceCardText: resourceCard?.textContent || "",
        resourceCardPresent: Boolean(resourceCard),
        resourceCardButtonCount: resourceCard?.querySelectorAll("button").length ?? 0,
        resourceActionText,
        resourceActionDisabled,
        resourceEngagedActionText,
        resourceEngagedActionDisabled,
        resourceEngagedTarget,
        resourceClickTargetId: resourceClickTarget?.id || "",
        resourceClickTargetClass: resourceClickTarget?.className || "",
        resourceLocalShotCount: resourceLocalShot ? 1 : 0,
        arrivingGhostCount: document.querySelectorAll("#lupenMultiplayerSpaceGhostLayer .lupen-mp-space-ghost.is-arriving").length,
        dockedGhostCount: document.querySelectorAll('#lupenMultiplayerSpaceGhostLayer .lupen-mp-space-ghost[data-session-id="docked-remote-session"]').length,
        playerTargetText,
        playerTargetCardClass,
        playerTargetCardLayout,
        playerCardLayout,
        playerTargetSelected,
        engageVisibleForPlayer,
        engageDisabledForPlayer,
        engageTextForPlayer,
        pvpGuardReason: pvpGuard?.reason || "",
        pvpGuardPreview: pvpGuard?.pvpRulePreview || "",
        pvpGuardDamageApplied: pvpGuard?.playerDamageApplied === true || pvpGuard?.pvpDamageApplied === true,
        onlineText,
        chatText,
        activityText: document.getElementById("activityLogFeed")?.textContent || "",
        visiblePlayerMessageCount: (chatText.match(/Visible player message/g) || []).length,
        placeholder: input.placeholder,
        inputDisabled: input.disabled,
        sentMessages,
        sentResourceMines,
        sentPvpIntents
      };
      window.LupenMultiplayerClient = originalClient;
      window.LupenMultiplayerOverlay.render();
      return result;
    });
    expect(connectedHudState.src).toContain("assets/ships/nightshade-hawk/nightshade-hawk-medium.webp");
    expect(connectedHudState.resourceImageSrc).toBe("");
    expect(connectedHudState.serverResourceImageSrc).toBe("");
    expect(connectedHudState.note).toContain("Nightshade Hawk");
    expect(connectedHudState.serverResourceCount).toBe(0);
    expect(connectedHudState.selectedServerResourceCount).toBe(0);
    expect(connectedHudState.engagedServerResourceCount).toBe(0);
    expect(connectedHudState.playerShotCount).toBe(0);
    expect(connectedHudState.polishedPlayerShotCount).toBe(0);
    expect(connectedHudState.volleyPlayerShotCount).toBe(0);
    expect(connectedHudState.combatFxShotCount).toBe(0);
    expect(connectedHudState.explosionCount).toBeGreaterThan(0);
    expect(connectedHudState.lifecycleResult).toMatchObject({
      handled: true,
      reason: "resource_depleted",
      resourceId: "staging-resource-test-iron"
    });
    expect(connectedHudState.selectedTargetAfterDepletion).toBe(null);
    expect(connectedHudState.engagedTargetAfterDepletion).toBe(null);
    expect(connectedHudState.ghostCount).toBe(2);
    expect(connectedHudState.resourceCount).toBe(0);
    expect(connectedHudState.selectedResourceCount).toBe(0);
    expect(connectedHudState.resourceTitle).toBe("");
    expect(connectedHudState.resourceMarkerBackground).toBe("");
    expect(connectedHudState.resourceMarkerBorderTopWidth).toBe("");
    expect(connectedHudState.resourceMarkerPaddingTop).toBe("");
    expect(connectedHudState.resourceCardPresent).toBe(true);
    expect(connectedHudState.resourceCardText).toContain("Iron Asteroid");
    expect(connectedHudState.resourceCardText).toContain("Use ENGAGE to fire");
    expect(connectedHudState.resourceCardButtonCount).toBe(0);
    expect(connectedHudState.resourceActionText).toContain("ENGAGE");
    expect(connectedHudState.resourceActionDisabled).toBe(false);
    expect(connectedHudState.resourceEngagedActionText).toBe("DISENGAGE");
    expect(connectedHudState.resourceEngagedActionDisabled).toBe(false);
    expect(connectedHudState.resourceEngagedTarget).toMatchObject({
      type: "stagingResource",
      id: "staging-resource-test-iron"
    });
    expect(connectedHudState.resourceClickTargetId).toBe("objectEngageBtn");
    expect(connectedHudState.resourceLocalShotCount).toBe(1);
    expect(connectedHudState.sentResourceMines).toHaveLength(1);
    expect(connectedHudState.sentResourceMines[0]).toMatchObject({
      resourceId: "staging-resource-test-iron",
      currentNode: "Asteron Prime"
    });
    expect(typeof connectedHudState.sentResourceMines[0].timestamp).toBe("number");
    expect(connectedHudState.arrivingGhostCount).toBe(1);
    expect(connectedHudState.dockedGhostCount).toBe(0);
    expect(connectedHudState.playerTargetText).toContain("Remote Pilot");
    expect(connectedHudState.playerTargetText).toContain("DISABLED");
    expect(connectedHudState.playerTargetText).not.toContain("Inspection only");
    expect(connectedHudState.playerTargetCardClass).toContain("compact-player-target");
    expect(connectedHudState.playerTargetCardLayout).toBe("compact");
    expect(connectedHudState.playerCardLayout).toMatchObject({
      underGhost: true,
      clearOfButton: true
    });
    expect(connectedHudState.playerCardLayout.cardHeight).toBeLessThanOrEqual(76);
    expect(connectedHudState.playerCardLayout.cardWidth).toBeLessThanOrEqual(150);
    expect(connectedHudState.playerTargetSelected).toBe("remote-session");
    expect(connectedHudState.engageVisibleForPlayer).toBe(true);
    expect(connectedHudState.engageDisabledForPlayer).toBe(true);
    expect(connectedHudState.engageTextForPlayer).toContain("PVP DISABLED");
    expect(connectedHudState.pvpGuardReason).toBe("");
    expect(connectedHudState.pvpGuardPreview).toBe("");
    expect(connectedHudState.pvpGuardDamageApplied).toBe(false);
    expect(connectedHudState.sentPvpIntents).toEqual([{
      targetType: "remotePlayer",
      targetPlayerId: "remote-session"
    }]);
    expect(connectedHudState.onlineText.match(/Remote Pilot/g)).toHaveLength(1);
    expect(connectedHudState.onlineText).toContain("Online Pilots: Local Pilot, Remote Pilot, Idle Pilot, Docked Pilot");
    expect(connectedHudState.onlineText).not.toContain("here");
    expect(connectedHudState.visiblePlayerMessageCount).toBe(1);
    expect(connectedHudState.chatText).not.toContain("joined at Asteron Prime");
    expect(connectedHudState.activityText).toContain("Remote Pilot entered Asteron Prime.");
    expect(connectedHudState.activityText).toContain("PvP disabled in protected zones.");
    expect(connectedHudState.placeholder).toBe("Sector message...");
    expect(connectedHudState.inputDisabled).toBe(false);
    expect(connectedHudState.sentMessages).toEqual([
      { channel: "sector", message: "staging hello" },
      { channel: "sector", message: "x".repeat(200) }
    ]);
    await expect(page.locator("#lupenMultiplayerStagingTradePanel")).toHaveCount(0);
    await expect(page.locator("#debugToolsPanel")).toHaveCount(0);

    await page.evaluate(() => {
      if (typeof window.openSectorMap === "function") window.openSectorMap();
    });
    await expect(page.locator("#sectorMap")).toHaveClass(/active/);
    await expect(page.locator("#sectorSvg .current-map-node")).toHaveCount(1);
    await expect(page.locator("#sectorSvg .svg-current-node-ship")).toHaveCount(0);
    await expect(page.locator("#sectorSvg .reachable-map-node")).not.toHaveCount(0);
    await expect(page.locator("#sectorSvg .svg-route.reachable-route")).not.toHaveCount(0);
    await expect(page.locator("#sectorSvg .svg-mp-ghost-layer")).toHaveCount(0);
    await expect(page.locator("#sectorSvg .svg-mp-bot-layer")).toHaveCount(0);

    await page.evaluate(() => {
      window.eval(`
        sectorScanState = {
          activeUntil: Date.now() + 5000,
          cooldownUntilByType: { ally: 0, bot: Date.now() + 10000, enemy: 0 },
          result: {
            createdAt: Date.now(),
            type: "bot",
            botSignals: [{ type: "bot", node: "Upper Apex", x: 50, y: 14, count: 2, names: ["Erebus Watcher", "Erebus Drone"], classes: ["Bot", "Bot"], threats: ["Medium", "Medium"], aggroStates: ["neutral", "neutral"] }],
            allySignals: [],
            enemySignals: []
          }
        };
        renderSectorMap();
        updateSectorScanPanel();
      `);
    });
    await expect(page.locator("#sectorSvg .svg-scan-marker.scan-bot")).toHaveCount(1);
    await expect(page.locator("#sectorSvg .svg-scan-marker.scan-bot .scan-count")).toContainText("2");
    await expect(page.locator("#sectorScanBotsBtn")).toContainText(/Bots 10s|Bots 9s/);
    await page.evaluate(() => {
      window.eval("sectorScanState.activeUntil = 0;");
      if (typeof window.renderSectorMap === "function") window.renderSectorMap();
    });
    await expect(page.locator("#sectorSvg .svg-scan-marker.scan-bot")).toHaveCount(0);

    await openTradeTerminal(page);

    await expect(page.locator("#marketScreen")).toContainText(/AVAILABLE ROUTES|BEST ROUTE|No profitable route available|Preview Unavailable/);
    await expect(page.locator("#marketScreen")).not.toContainText("Server Buy");
    await expect(page.locator("#marketScreen")).toContainText(/pilot save immediately|staging/i);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("remote player markers stay stable across repeated roster updates", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await waitForGameGlobals(page);

    const stability = await page.evaluate(() => window.eval(`
      (() => {
        const originalClient = window.LupenMultiplayerClient;
        const originalSelected = selectedTarget;
        const originalEngaged = engagedTarget;
        if (engageTimer) {
          clearInterval(engageTimer);
          engageTimer = null;
        }
        selectedTarget = null;
        engagedTarget = null;
        currentNode = "Lower Gate Core";
        showScreen("spaceScreen");
        updateCurrentNodeUI();
        window.__reverseRemoteRoster = false;
        window.LupenMultiplayerClient = {
          ...(originalClient || {}),
          getStatus: () => ({
            enabled: true,
            isConnected: true,
            enabledReason: "staging_enabled",
            sessionId: "local-session"
          }),
          getPlayers: ({ includeSelf = true } = {}) => {
            const now = Date.now();
            const local = {
              sessionId: "local-session",
              displayName: "Local Pilot",
              currentNode,
              presenceStatus: "space",
              isSelf: true,
              lastSeenAt: now
            };
            const remoteA = {
              sessionId: "stable-remote-a",
              displayName: "Stable Alpha",
              currentNode,
              presenceStatus: "space",
              currentShipId: "zeusExplorer",
              shipName: "Nightshade Hawk",
              shipImage: "assets/ships/nightshade-hawk/nightshade-hawk-medium.webp",
              lastSeenAt: now
            };
            const remoteB = {
              sessionId: "stable-remote-b",
              displayName: "Stable Beta",
              currentNode,
              presenceStatus: "space",
              currentShipId: "bison",
              shipName: "Buu Hauler",
              shipImage: "assets/ships/buu-hauler/buu-hauler-medium.webp",
              lastSeenAt: now
            };
            const remotes = window.__reverseRemoteRoster ? [remoteB, remoteA] : [remoteA, remoteB];
            return includeSelf ? [local, ...remotes] : remotes;
          },
          getBots: () => [],
          getResources: () => [],
          getPresenceEvents: () => []
        };

        const readMarker = (id) => {
          const marker = document.querySelector('#lupenMultiplayerSpaceGhostLayer .lupen-mp-space-ghost[data-session-id="' + id + '"]');
          return {
            count: document.querySelectorAll('#lupenMultiplayerSpaceGhostLayer .lupen-mp-space-ghost[data-session-id="' + id + '"]').length,
            left: marker?.style.left || "",
            top: marker?.style.top || "",
            label: marker?.querySelector(".lupen-mp-space-ghost-label")?.textContent || "",
            note: marker?.querySelector(".lupen-mp-space-ghost-note")?.textContent || ""
          };
        };

        try {
          window.LupenMultiplayerOverlay.render();
          const firstA = readMarker("stable-remote-a");
          const firstB = readMarker("stable-remote-b");
          for (let index = 0; index < 6; index += 1) {
            window.__reverseRemoteRoster = index % 2 === 0;
            window.LupenMultiplayerOverlay.render();
          }
          const finalA = readMarker("stable-remote-a");
          const finalB = readMarker("stable-remote-b");
          return { firstA, firstB, finalA, finalB };
        } finally {
          selectedTarget = originalSelected;
          engagedTarget = originalEngaged;
          window.__reverseRemoteRoster = false;
          window.LupenMultiplayerClient = originalClient;
          window.LupenMultiplayerOverlay.render();
        }
      })()
    `));

    expect(stability.firstA).toMatchObject({
      count: 1,
      label: "Stable Alpha",
      note: "Nightshade Hawk"
    });
    expect(stability.firstB).toMatchObject({
      count: 1,
      label: "Stable Beta",
      note: "Buu Hauler"
    });
    expect(stability.finalA).toMatchObject({
      count: 1,
      left: stability.firstA.left,
      top: stability.firstA.top,
      label: stability.firstA.label,
      note: stability.firstA.note
    });
    expect(stability.finalB).toMatchObject({
      count: 1,
      left: stability.firstB.left,
      top: stability.firstB.top,
      label: stability.firstB.label,
      note: stability.firstB.note
    });

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("multiplayer overlay renders all server Erebus bot types with configured images", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await waitForGameGlobals(page);
    await page.evaluate(() => {
      window.eval(`
        tutorialState = { active: false, completed: true, stepIndex: 0 };
        currentNode = "Upper Apex";
        showScreen("spaceScreen");
      `);
      const bots = [
        {
          id: "staging-bot-hunter-01",
          botType: "hunter",
          type: "Erebus Hunter",
          name: "Erebus Hunter",
          displayName: "Erebus Hunter",
          faction: "Erebus",
          image: "assets/bots/erebus-hunter.png",
          threat: "Light Threat",
          currentNode: "Upper Apex",
          x: 34,
          y: 25,
          level: 1,
          damagePerHit: 18,
          attackCooldownMs: 2400,
          visualScale: 0.82,
          shield: 60,
          shieldMax: 60,
          hull: 60,
          hullMax: 60
        },
        {
          id: "staging-bot-attacker-01",
          botType: "attacker",
          type: "Erebus Attacker",
          name: "Erebus Attacker",
          displayName: "Erebus Attacker",
          faction: "Erebus",
          image: "assets/bots/erebus-attacker.png",
          threat: "Medium Threat",
          currentNode: "Upper Apex",
          x: 45,
          y: 30,
          level: 2,
          damagePerHit: 24,
          attackCooldownMs: 2800,
          visualScale: 0.94,
          shield: 90,
          shieldMax: 90,
          hull: 90,
          hullMax: 90
        },
        {
          id: "staging-bot-destroyer-01",
          botType: "destroyer",
          type: "Erebus Destroyer",
          name: "Erebus Destroyer",
          displayName: "Erebus Destroyer",
          faction: "Erebus",
          image: "assets/bots/erebus-destroyer.png",
          threat: "Heavy Threat",
          currentNode: "Upper Apex",
          x: 58,
          y: 31,
          level: 3,
          damagePerHit: 32,
          attackCooldownMs: 3500,
          visualScale: 1.12,
          shield: 160,
          shieldMax: 160,
          hull: 160,
          hullMax: 160
        },
        {
          id: "staging-bot-behemoth-01",
          botType: "behemoth",
          type: "Erebus Behemoth",
          name: "Erebus Behemoth",
          displayName: "Erebus Behemoth",
          faction: "Erebus",
          image: "assets/bots/erebus-behemoth.png",
          threat: "Extreme Threat",
          currentNode: "Upper Apex",
          x: 72,
          y: 27,
          level: 5,
          damagePerHit: 58,
          attackCooldownMs: 4500,
          visualScale: 1.32,
          shield: 300,
          shieldMax: 300,
          hull: 350,
          hullMax: 350
        }
      ];
      const selectedBot = bots[2];
      window.LupenMultiplayerClient = {
        enabled: true,
        getStatus: () => ({
          enabled: true,
          enabledReason: "staging_enabled",
          connected: true,
          sessionId: "self",
          selectedTargetBotId: selectedBot.id
        }),
        getPlayers: () => [],
        getBots: () => bots,
        getResources: () => [],
        getSelectedStagingBot: () => selectedBot,
        onServerState: () => ({ unsubscribe() {} })
      };
      window.LupenMultiplayerOverlay?.setup?.();
      window.LupenMultiplayerOverlay?.render?.();
    });

    await expect(page.locator("#lupenMultiplayerSpaceBotLayer .lupen-mp-space-bot")).toHaveCount(4);
    await page.waitForFunction(() => {
      return Array.from(document.querySelectorAll("#lupenMultiplayerSpaceBotLayer .lupen-mp-space-bot img"))
        .every(image => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
    });
    const renderedBots = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("#lupenMultiplayerSpaceBotLayer .lupen-mp-space-bot")).map((marker) => {
        const ship = marker.querySelector(".lupen-mp-space-bot-ship");
        const image = marker.querySelector("img");
        return {
          id: marker.dataset.botId || "",
          type: marker.dataset.botType || "",
          className: marker.className,
          title: marker.getAttribute("title") || "",
          src: image?.getAttribute("src") || "",
          naturalWidth: image?.naturalWidth || 0,
          naturalHeight: image?.naturalHeight || 0,
          scale: ship ? getComputedStyle(ship).getPropertyValue("--bot-scale").trim() : ""
        };
      });
    });
    expect(renderedBots.map(bot => bot.type).sort()).toEqual(["attacker", "behemoth", "destroyer", "hunter"]);
    expect(renderedBots.find(bot => bot.type === "hunter")).toMatchObject({ src: "assets/bots/erebus-hunter.png", scale: "0.82" });
    expect(renderedBots.find(bot => bot.type === "attacker")).toMatchObject({ src: "assets/bots/erebus-attacker.png", scale: "0.94" });
    expect(renderedBots.find(bot => bot.type === "destroyer")).toMatchObject({ src: "assets/bots/erebus-destroyer.png", scale: "1.12" });
    expect(renderedBots.find(bot => bot.type === "behemoth")).toMatchObject({ src: "assets/bots/erebus-behemoth.png", scale: "1.32" });
    expect(renderedBots.find(bot => bot.type === "hunter")?.title).toContain("Light Threat");
    expect(renderedBots.find(bot => bot.type === "attacker")?.title).toContain("Medium Threat");
    expect(renderedBots.find(bot => bot.type === "destroyer")?.title).toContain("Heavy Threat");
    expect(renderedBots.find(bot => bot.type === "behemoth")?.title).toContain("Extreme Threat");
    renderedBots.forEach((bot) => {
      expect(bot.naturalWidth).toBeGreaterThan(0);
      expect(bot.naturalHeight).toBeGreaterThan(0);
      expect(bot.title).toContain("Erebus");
    });
    await expect(page.locator(".lupen-target-card.hostile")).toContainText("Erebus Destroyer");
    await expect(page.locator(".lupen-target-card.hostile")).toContainText("Heavy Threat");

    fs.mkdirSync("artifacts", { recursive: true });
    await page.locator("#spaceScreen").screenshot({ path: "artifacts/map1-bot-threat-labels.png" });

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("debug staging diagnostics can be opened without a live server", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&debug=mp&mpServer=http://127.0.0.1:1");
    await expect(page.locator("#lupenMultiplayerStatusChip")).toContainText(/Staging/, { timeout: 15000 });
    await expect(page.locator("#lupenMultiplayerDiagnostics")).toContainText("MP Staging", { timeout: 15000 });
    await expect(page.locator("#lupenMultiplayerDiagnostics")).toContainText(/online|reconnecting|disconnected|server_unavailable|connecting|connected/i);
    await expect(page.locator("#lupenMultiplayerDiagnostics")).toContainText("reconnects");
    await expect(page.locator("#lupenMultiplayerDiagnostics")).toContainText("presence");
    await expect(page.locator("#lupenMultiplayerDiagnostics")).toContainText("online names");
    await expect(page.locator("#lupenMultiplayerDiagnostics")).toContainText("chat send");
    await expect(page.locator("#lupenMultiplayerDiagnostics")).toContainText("Connect");
    await expect(page.locator("#lupenMultiplayerDiagnostics")).toContainText("Refresh Presence");
    await expect(page.locator("#lupenMultiplayerStagingFlowHint")).toHaveCount(0);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("multiplayer connection status chip shows states and remote targets clean up", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&debug=mp&mpServer=http://127.0.0.1:1");
    await waitForGameGlobals(page);

    const state = await page.evaluate(() => window.eval(`
      (() => {
        currentNode = "Lower Gate Core";
        showScreen("spaceScreen");
        const status = {
          enabled: true,
          isConnected: true,
          connected: true,
          isConnecting: false,
          connectionStatus: "online",
          connectionStatusReason: "connected",
          reconnectAttemptCount: 0,
          lastConnectedAt: Date.now(),
          lastDisconnectedAt: 0,
          enabledReason: "staging_enabled",
          roomName: "lupen_sector",
          sessionId: "local-session"
        };
        let players = [{
          id: "remote-status-test",
          sessionId: "remote-status-test",
          displayName: "Remote Tester",
          currentNode,
          presenceStatus: "space",
          x: 50,
          y: 40,
          lastSeenAt: Date.now()
        }];
        window.LupenMultiplayerClient = {
          enabled: true,
          getStatus: () => ({ ...status }),
          getPlayers: ({ includeSelf } = {}) => includeSelf ? players.concat([{ id: "local-session", sessionId: "local-session", isSelf: true, currentNode }]) : players.slice(),
          getBots: () => [],
          getResources: () => [],
          getPresenceEvents: () => [],
          getSelectedStagingBot: () => null,
          onServerState: () => ({ unsubscribe() {} }),
          clearStagingTarget() {}
        };

        const renderState = (nextStatus) => {
          status.connectionStatus = nextStatus;
          status.isConnected = nextStatus === "online";
          status.connected = status.isConnected;
          status.isConnecting = nextStatus === "connecting" || nextStatus === "reconnecting";
          status.connectionStatusReason = nextStatus === "server_unavailable" ? "connection_failed" : nextStatus;
          if (nextStatus !== "online") {
            status.lastDisconnectedAt = Date.now();
            status.reconnectAttemptCount += 1;
          }
          window.LupenMultiplayerOverlay.render();
          const chip = document.getElementById("lupenMultiplayerStatusChip");
          return {
            text: chip?.textContent || "",
            state: chip?.dataset.connectionStatus || "",
            className: chip?.className || "",
            diagnostics: document.getElementById("lupenMultiplayerDiagnostics")?.textContent || ""
          };
        };

        const online = renderState("online");
        const reconnecting = renderState("reconnecting");
        const unavailable = renderState("server_unavailable");
        const disconnected = renderState("disconnected");

        selectedTarget = { type: "remotePlayer", id: "remote-status-test" };
        engagedTarget = { type: "remotePlayer", id: "remote-status-test" };
        engageTimer = setInterval(() => {}, 1000);
        const fxLayer = document.getElementById("combatFxLayer") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "combatFxLayer" }));
        const fx = document.createElement("div");
        fx.className = "combat-fx-shot";
        fx.dataset.targetId = "remote-status-test";
        fx.dataset.targetType = "remotePlayer";
        fxLayer.appendChild(fx);
        players = [];
        const cleanup = reconcileTargetSessionState("connection_unavailable");

        return {
          online,
          reconnecting,
          unavailable,
          disconnected,
          cleanup,
          selectedTarget,
          engagedTarget,
          engageTimerActive: Boolean(engageTimer),
          remoteFxRemaining: document.querySelectorAll("#combatFxLayer [data-target-id='remote-status-test']").length
        };
      })()
    `));

    expect(state.online.text).toContain("Multiplayer Staging Online");
    expect(state.online.state).toBe("online");
    expect(state.reconnecting.text).toContain("Reconnecting");
    expect(state.reconnecting.className).toContain("is-reconnecting");
    expect(state.unavailable.text).toContain("Server unavailable");
    expect(state.unavailable.className).toContain("is-unavailable");
    expect(state.disconnected.text).toContain("Disconnected");
    expect(state.disconnected.className).toContain("is-disconnected");
    expect(state.unavailable.diagnostics).toContain("reconnects");
    expect(state.cleanup.cleared).toBe(true);
    expect(state.selectedTarget).toBeNull();
    expect(state.engagedTarget).toBeNull();
    expect(state.engageTimerActive).toBe(false);
    expect(state.remoteFxRemaining).toBe(0);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("server resource ENGAGE button starts mining from overlay-selected resource", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&debug=mp&mpServer=http://127.0.0.1:1");
    await waitForGameGlobals(page);

    await page.evaluate(() => window.eval(`
      (() => {
        currentNode = "Asteron Prime";
        showScreen("spaceScreen");
        const resource = {
          id: "staging-resource-action-copper",
          resourceName: "Copper",
          name: "Copper",
          currentNode: "Asteron Prime",
          x: 55,
          y: 35,
          hp: 34,
          hpMax: 34,
          yieldAmount: 12,
          depleted: false,
          depletedUntil: 0,
          lastUpdatedAt: Date.now()
        };
        const status = {
          enabled: true,
          isConnected: true,
          enabledReason: "staging_enabled",
          sessionId: "local-session",
          lastStagingResourceMineIntent: null,
          lastStagingResourceEvent: null
        };
        window.__resourceEngageMines = [];
        window.LupenMultiplayerClient = {
          enabled: true,
          getStatus: () => ({ ...status }),
          getPlayers: ({ includeSelf = true } = {}) => includeSelf ? [{
            isSelf: true,
            sessionId: "local-session",
            displayName: "Local Pilot",
            currentNode: "Asteron Prime",
            presenceStatus: "space",
            currentShipId: currentShipId || STARTER_SHIP_ID,
            shipName: "Azure Striker",
            shipImage: "assets/ships/azure-striker/azure-striker-medium.webp",
            lastSeenAt: Date.now()
          }] : [],
          getBots: () => [],
          getResources: () => [resource],
          getResourceById: id => String(id || "") === resource.id ? { ...resource } : null,
          getSelectedStagingBot: () => null,
          getPresenceEvents: () => [],
          getChatMessages: () => [],
          getStagingWeaponIntent: () => ({
            weaponId: "pulseLaser",
            weaponKey: "pulseLaser",
            equippedWeaponKey: "pulseLaser",
            equippedWeaponKeys: ["pulseLaser"],
            weaponName: "Pulse Laser",
            weaponFamily: "pulse",
            weaponType: "pulse"
          }),
          mineStagingResource: (resourceId, options) => {
            const intent = {
              ok: true,
              type: "mineIntent",
              reason: "resource_mine_intent_sent",
              resourceId,
              currentNode: options?.currentNode || "",
              receivedAt: Date.now()
            };
            status.lastStagingResourceMineIntent = intent;
            status.lastStagingResourceEvent = intent;
            window.__resourceEngageMines.push({ resourceId, ...options });
            return { ok: true, type: "stagingResource:mine", payload: { resourceId, ...options } };
          },
          onServerState: () => ({ unsubscribe() {} })
        };
        selectedTarget = null;
        engagedTarget = null;
        if (engageTimer) {
          clearInterval(engageTimer);
          engageTimer = null;
        }
        mineralKeys.forEach(key => { cargo[key] = 0; });
        cargo.Iron = getShipStats().cargo;
        window.LupenMultiplayerOverlay.setSelectedResourceId("");
        updateAsteroidUI();
        updateObjectActionPanel(true);
        updateCargoSummary();
        window.__noTargetActionState = {
          text: document.getElementById("objectEngageBtn")?.textContent || "",
          disabled: document.getElementById("objectEngageBtn")?.disabled ?? null,
          visible: document.getElementById("objectActionPanel")?.classList.contains("visible") || false,
          actionInShipHud: Boolean(document.getElementById("objectEngageBtn")?.closest(".ship-display-panel-action")),
          inactive: document.getElementById("objectEngageBtn")?.classList.contains("action-inactive") || false
        };
        window.LupenMultiplayerOverlay.setSelectedResourceId(resource.id);
        updateAsteroidUI();
        updateObjectActionPanel(true);
        updateCargoSummary();
        window.LupenMultiplayerOverlay.render();
      })()
    `));

    await expect(page.locator("#objectEngageBtn")).toBeVisible();
    await expect(page.locator("#objectEngageBtn")).toHaveText("ENGAGE");
    await page.locator("#objectEngageBtn").click();

    const resourceEngageState = await page.evaluate(() => window.eval(`
      (() => {
        window.LupenMultiplayerOverlay.render();
        const status = window.LupenMultiplayerClient.getStatus();
        const actionBtn = document.getElementById("objectEngageBtn");
        const rectFor = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          return {
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          };
        };
        return {
          actionText: actionBtn?.textContent || "",
          actionDisabled: actionBtn?.disabled ?? true,
          noTargetAction: window.__noTargetActionState || null,
          selectedTarget: selectedTarget ? { ...selectedTarget } : null,
          engagedTarget: engagedTarget ? { ...engagedTarget } : null,
          mineCount: window.__resourceEngageMines.length,
          mine: window.__resourceEngageMines[0] || null,
          localShotCount: document.querySelectorAll("#combatFxLayer .combat-fx-shot[data-target-type='stagingResource'][data-target-id='staging-resource-action-copper']").length,
          actionInShipHud: Boolean(actionBtn?.closest(".ship-display-panel-action")),
          centralActionCount: document.querySelectorAll(".central-engage-panel").length,
          middleHudLayout: {
            bottomHud: rectFor(".player-bottom-hud.command-hud.space-combat-hud"),
            statusPanel: rectFor(".player-bottom-hud .status-panel"),
            panel: rectFor(".ship-display-panel-action"),
            infoPanel: rectFor(".hud-command-console"),
            ship: rectFor("#hudShipImage"),
            xpRow: rectFor("#hudProgressStrip .xp-row"),
            xpBar: rectFor("#hudProgressStrip .xp-bar"),
            cargo: rectFor("#hudCargoSummary"),
            cargoLabel: rectFor("#hudCargoSummary span"),
            cargoAmount: rectFor("#hudCargoSummary strong"),
            cargoFull: rectFor("#hudCargoFullBadge:not([hidden])"),
            guild: rectFor("#hudGuildPlaceholder"),
            guildLabel: rectFor("#hudGuildPlaceholder span"),
            guildStatus: rectFor("#hudGuildPlaceholder strong"),
            actionRow: rectFor(".ship-hud-action-row"),
            actionPanel: rectFor("#objectActionPanel"),
            action: rectFor("#objectEngageBtn"),
            objectivesPanel: rectFor(".hud-command-console")
          },
          guildPlaceholderText: document.getElementById("hudGuildPlaceholder")?.textContent || "",
          guildPlaceholderDisabled: document.getElementById("hudGuildPlaceholder")?.getAttribute("aria-disabled") || "",
          cargoSummaryText: document.getElementById("hudCargoSummary")?.textContent || "",
          resourceIntentReason: status.lastStagingResourceMineIntent?.reason || "",
          diagnosticsText: document.getElementById("lupenMultiplayerDiagnostics")?.textContent || ""
        };
      })()
    `));

    expect(resourceEngageState.selectedTarget).toMatchObject({
      type: "stagingResource",
      id: "staging-resource-action-copper"
    });
    expect(resourceEngageState.engagedTarget).toMatchObject({
      type: "stagingResource",
      id: "staging-resource-action-copper"
    });
    expect(resourceEngageState.noTargetAction).toMatchObject({
      text: "ENGAGE",
      disabled: true,
      visible: true,
      actionInShipHud: true,
      inactive: true
    });
    expect(resourceEngageState.actionText).toBe("DISENGAGE");
    expect(resourceEngageState.actionDisabled).toBe(false);
    expect(resourceEngageState.mineCount).toBe(1);
    expect(resourceEngageState.mine).toMatchObject({
      resourceId: "staging-resource-action-copper",
      currentNode: "Asteron Prime"
    });
    expect(resourceEngageState.localShotCount).toBe(1);
    expect(resourceEngageState.actionInShipHud).toBe(true);
    expect(resourceEngageState.centralActionCount).toBe(0);
    expect(resourceEngageState.middleHudLayout.bottomHud).not.toBeNull();
    expect(resourceEngageState.middleHudLayout.statusPanel).not.toBeNull();
    expect(resourceEngageState.middleHudLayout.panel).not.toBeNull();
    expect(resourceEngageState.middleHudLayout.infoPanel).not.toBeNull();
    expect(resourceEngageState.middleHudLayout.ship).not.toBeNull();
    expect(resourceEngageState.middleHudLayout.xpRow).not.toBeNull();
    expect(resourceEngageState.middleHudLayout.xpBar).not.toBeNull();
    expect(resourceEngageState.middleHudLayout.cargo).not.toBeNull();
    expect(resourceEngageState.middleHudLayout.cargoLabel).not.toBeNull();
    expect(resourceEngageState.middleHudLayout.cargoAmount).not.toBeNull();
    expect(resourceEngageState.middleHudLayout.guild).not.toBeNull();
    expect(resourceEngageState.middleHudLayout.guildLabel).not.toBeNull();
    expect(resourceEngageState.middleHudLayout.guildStatus).not.toBeNull();
    expect(resourceEngageState.middleHudLayout.action).not.toBeNull();
    expect(resourceEngageState.middleHudLayout.objectivesPanel).not.toBeNull();
    expect(resourceEngageState.middleHudLayout.panel.width).toBeGreaterThan(resourceEngageState.middleHudLayout.statusPanel.width);
    expect(resourceEngageState.middleHudLayout.panel.width).toBeLessThan(resourceEngageState.middleHudLayout.infoPanel.width);
    expect(resourceEngageState.middleHudLayout.panel.width).toBeGreaterThanOrEqual(Math.round(resourceEngageState.middleHudLayout.bottomHud.width * 0.24));
    expect(resourceEngageState.middleHudLayout.panel.width).toBeLessThanOrEqual(Math.round(resourceEngageState.middleHudLayout.bottomHud.width * 0.34));
    expect(resourceEngageState.middleHudLayout.infoPanel.width).toBeGreaterThanOrEqual(Math.round(resourceEngageState.middleHudLayout.bottomHud.width * 0.42));
    expect(resourceEngageState.middleHudLayout.infoPanel.width).toBeLessThanOrEqual(Math.round(resourceEngageState.middleHudLayout.bottomHud.width * 0.56));
    expect(resourceEngageState.middleHudLayout.infoPanel.right).toBeLessThanOrEqual(resourceEngageState.middleHudLayout.bottomHud.right + 2);
    expect(resourceEngageState.middleHudLayout.ship.height).toBeGreaterThanOrEqual(58);
    expect(resourceEngageState.middleHudLayout.xpBar.width).toBeGreaterThanOrEqual(80);
    expect(resourceEngageState.middleHudLayout.xpBar.height).toBeGreaterThanOrEqual(6);
    expect(resourceEngageState.middleHudLayout.cargo.height).toBeLessThanOrEqual(54);
    expect(resourceEngageState.middleHudLayout.action.height).toBeLessThanOrEqual(40);
    expect(resourceEngageState.middleHudLayout.action.width).toBeLessThanOrEqual(Math.round(resourceEngageState.middleHudLayout.panel.width * 0.82));
    const centerX = rect => Math.round((rect.left + rect.right) / 2);
    const centerY = rect => Math.round((rect.top + rect.bottom) / 2);
    expect(Math.abs(centerX(resourceEngageState.middleHudLayout.action) - centerX(resourceEngageState.middleHudLayout.panel))).toBeLessThanOrEqual(4);
    expect(Math.abs(centerX(resourceEngageState.middleHudLayout.cargoLabel) - centerX(resourceEngageState.middleHudLayout.cargo))).toBeLessThanOrEqual(4);
    expect(resourceEngageState.middleHudLayout.guild.left).toBeGreaterThanOrEqual(resourceEngageState.middleHudLayout.cargo.right - 2);
    expect(resourceEngageState.middleHudLayout.guild.top).toBeGreaterThanOrEqual(resourceEngageState.middleHudLayout.cargo.top - 2);
    expect(resourceEngageState.middleHudLayout.cargoAmount.top).toBeGreaterThanOrEqual(resourceEngageState.middleHudLayout.cargoLabel.bottom - 1);
    if (resourceEngageState.middleHudLayout.cargoFull) {
      const cargoValueGroupCenter = Math.round((resourceEngageState.middleHudLayout.cargoAmount.left + resourceEngageState.middleHudLayout.cargoFull.right) / 2);
      expect(Math.abs(cargoValueGroupCenter - centerX(resourceEngageState.middleHudLayout.cargo))).toBeLessThanOrEqual(8);
    }
    const rectsOverlap = (first, second) => (
      first.left < second.right - 2
      && first.right > second.left + 2
      && first.top < second.bottom - 2
      && first.bottom > second.top + 2
    );
    expect(resourceEngageState.middleHudLayout.guild.height).toBeLessThanOrEqual(28);
    expect(rectsOverlap(resourceEngageState.middleHudLayout.guild, resourceEngageState.middleHudLayout.action)).toBe(false);
    expect(rectsOverlap(resourceEngageState.middleHudLayout.cargo, resourceEngageState.middleHudLayout.action)).toBe(false);
    expect(rectsOverlap(resourceEngageState.middleHudLayout.ship, resourceEngageState.middleHudLayout.xpRow)).toBe(false);
    expect(resourceEngageState.middleHudLayout.xpBar.top).toBeGreaterThanOrEqual(resourceEngageState.middleHudLayout.xpRow.bottom - 2);
    expect(resourceEngageState.middleHudLayout.cargo.top).toBeGreaterThanOrEqual(Math.max(
      resourceEngageState.middleHudLayout.ship.bottom,
      resourceEngageState.middleHudLayout.xpBar.bottom
    ) - 2);
    expect(resourceEngageState.middleHudLayout.action.top).toBeGreaterThanOrEqual(resourceEngageState.middleHudLayout.cargo.bottom - 2);
    expect(resourceEngageState.middleHudLayout.action.bottom).toBeLessThanOrEqual(resourceEngageState.middleHudLayout.panel.bottom + 2);
    expect(resourceEngageState.cargoSummaryText).toContain("Cargo");
    expect(resourceEngageState.cargoSummaryText).toContain("FULL");
    expect(resourceEngageState.guildPlaceholderText).toContain("Guild");
    expect(resourceEngageState.guildPlaceholderText).toContain("Soon");
    expect(resourceEngageState.guildPlaceholderDisabled).toBe("true");
    expect(resourceEngageState.resourceIntentReason).toBe("resource_mine_intent_sent");
    expect(resourceEngageState.diagnosticsText).toContain("resource sent");

    const fullCargoAwardState = await page.evaluate(() => window.eval(`
      (() => {
        const beforeCargo = cargoUsed();
        const applyResult = applyStagingResourceMineResult({
          ok: true,
          resourceId: "staging-resource-action-copper",
          resourceName: "Copper",
          cargoDelta: 12,
          depletedUntil: Date.now() + 30000,
          resourceRewardId: "full-cargo-resource-award-e2e"
        });
        return {
          beforeCargo,
          afterCargo: cargoUsed(),
          copper: cargo.Copper || 0,
          applyResult,
          activityText: document.getElementById("activityLogFeed")?.textContent || ""
        };
      })()
    `));
    expect(fullCargoAwardState.afterCargo).toBe(fullCargoAwardState.beforeCargo);
    expect(fullCargoAwardState.copper).toBe(0);
    expect(fullCargoAwardState.applyResult).toMatchObject({
      reason: "cargo_full_no_resource_recovered",
      collectedAmount: 0,
      overflowAmount: 0
    });
    expect(fullCargoAwardState.activityText).toContain("Cargo hold full - no resource recovered.");

    await page.locator("#objectEngageBtn").click();
    const disengagedState = await page.evaluate(() => window.eval(`
      (() => ({
        actionText: document.getElementById("objectEngageBtn")?.textContent || "",
        engagedTarget: engagedTarget ? { ...engagedTarget } : null
      }))()
    `));
    expect(disengagedState.actionText).toBe("ENGAGE");
    expect(disengagedState.engagedTarget).toBe(null);
    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("player space HUD presents Journey objectives, activity, and chat cleanly", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await waitForGameGlobals(page);

    await page.evaluate(() => window.eval(`
      (() => {
        localStorage.clear();
        if (typeof resetRuntimeForFreshPilot === "function") resetRuntimeForFreshPilot();
        currentShipId = STARTER_SHIP_ID;
        selectedHangarShipId = STARTER_SHIP_ID;
        selectedFleetShipId = STARTER_SHIP_ID;
        ownedShips = [STARTER_SHIP_ID];
        shipLoadouts = { [STARTER_SHIP_ID]: normalizeShipLoadout({ attachments: [], guns: ["pulseLaser"] }, STARTER_SHIP_ID) };
        currentNode = "Asteron Prime";
        lastPlanetNode = "Asteron Prime";
        hull = getShipStats().hull;
        hullMax = getShipStats().hull;
        shield = getShipStats().shield;
        shieldMax = getShipStats().shield;
        jumpCharge = jumpMax;
        showScreen("gameScreen");
        updateHubLocation();
      })()
    `));

    await page.evaluate(() => window.launchShip());
    await expect(page.locator("#spaceScreen")).toHaveClass(/active/);

    const centerHud = await page.evaluate(() => window.eval(`
      (() => {
        const rectFor = (selector) => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const rect = element.getBoundingClientRect();
          return {
            top: Math.round(rect.top),
            right: Math.round(rect.right),
            bottom: Math.round(rect.bottom),
            left: Math.round(rect.left),
            width: Math.round(rect.width),
            height: Math.round(rect.height)
          };
        };
        const action = document.getElementById("objectEngageBtn");
        return {
          ship: rectFor("#hudShipImage"),
          level: rectFor("#hudProgressStrip .level-badge"),
          xpRow: rectFor("#hudProgressStrip .xp-row"),
          xpBar: rectFor("#hudProgressStrip .xp-bar"),
          cargo: rectFor("#hudCargoSummary"),
          guild: rectFor("#hudGuildPlaceholder"),
          engage: rectFor("#objectEngageBtn"),
          panel: rectFor(".ship-display-panel-action"),
          actionText: action?.textContent || "",
          actionDisabled: action?.disabled ?? false,
          actionInShipHud: Boolean(action?.closest(".ship-display-panel-action")),
          centralActionCount: document.querySelectorAll(".central-engage-panel").length,
          xpText: document.getElementById("hudProgressStrip")?.textContent || "",
          cargoText: document.getElementById("hudCargoSummary")?.textContent || "",
          guildText: document.getElementById("hudGuildPlaceholder")?.textContent || ""
        };
      })()
    `));
    expect(centerHud.ship).not.toBeNull();
    expect(centerHud.level).not.toBeNull();
    expect(centerHud.xpRow).not.toBeNull();
    expect(centerHud.xpBar).not.toBeNull();
    expect(centerHud.cargo).not.toBeNull();
    expect(centerHud.guild).not.toBeNull();
    expect(centerHud.engage).not.toBeNull();
    expect(centerHud.actionText).toBe("ENGAGE");
    expect(centerHud.actionDisabled).toBe(true);
    expect(centerHud.actionInShipHud).toBe(true);
    expect(centerHud.centralActionCount).toBe(0);
    expect(centerHud.ship.height).toBeGreaterThanOrEqual(70);
    expect(centerHud.level.right).toBeLessThanOrEqual(centerHud.panel.right + 2);
    expect(centerHud.xpBar.top).toBeGreaterThanOrEqual(centerHud.xpRow.bottom - 2);
    expect(centerHud.cargo.top).toBeGreaterThanOrEqual(Math.min(centerHud.ship.bottom, centerHud.xpBar.bottom) - 8);
    expect(centerHud.engage.top).toBeGreaterThanOrEqual(centerHud.cargo.bottom - 2);
    expect(centerHud.xpText).toContain("XP");
    expect(centerHud.cargoText).toContain("Cargo");
    expect(centerHud.guildText).toContain("Guild");
    expect(centerHud.guildText).toContain("Soon");

    await page.locator("#objectivesDockBtn").click();
    await expect(page.locator("#objectivesPanel")).toHaveClass(/active/);
    await expect(page.locator("#activeObjectiveSummary")).not.toContainText("No active objective");
    await expect(page.locator("#activeMissionSummary")).toContainText("ACADEMY");
    await expect(page.locator("#activeMissionSummary")).toContainText("Launch Ship");
    await expect(page.locator("#activeMissionSummary")).toContainText("Launch from Asteron Prime");
    await expect(page.locator("#activeMissionSummary")).toContainText("1 / 1");
    await expect(page.locator("#activeMissionSummary")).toContainText("COMPLETE");
    await expect(page.locator("#activeMissionSummary")).toContainText("Open Journey to review your chapter assignments.");
    const objectiveHud = await page.locator("#activeMissionSummary").evaluate(card => {
      const rect = card.getBoundingClientRect();
      const styles = getComputedStyle(card);
      const panel = document.querySelector(".hud-command-console")?.getBoundingClientRect();
      return {
        borderColor: styles.borderColor,
        boxShadow: styles.boxShadow,
        top: rect.top,
        bottom: rect.bottom,
        panelTop: panel?.top || 0,
        panelBottom: panel?.bottom || 0
      };
    });
    expect(objectiveHud.borderColor).toMatch(/70, 230, 164|73, 214, 255/);
    expect(objectiveHud.bottom).toBeLessThanOrEqual(objectiveHud.panelBottom + 2);
    expect(objectiveHud.top).toBeGreaterThanOrEqual(objectiveHud.panelTop - 2);

    await page.locator("#activityDockBtn").click();
    await expect(page.locator("#activityPanel")).toHaveClass(/active/);
    await page.evaluate(() => window.eval(`
      addActivityLog("Morgan: Starter ship confirmed. You have a hull assigned and ready for launch.");
      addActivityLog("Mission complete: Launch Ship.");
      addActivityLog("Cargo hold full - no resource recovered.");
    `));
    await expect(page.locator("#activityLogFeed .activity-log-item--morgan").first()).toContainText("Morgan:");
    await expect(page.locator("#activityLogFeed .activity-log-item--mission").first()).toContainText("Mission complete");
    await expect(page.locator("#activityLogFeed .activity-log-item--warning").first()).toContainText("Cargo hold full");
    const activityLayout = await page.locator("#activityLogFeed").evaluate(feed => {
      const rect = feed.getBoundingClientRect();
      const panel = document.querySelector(".hud-command-console")?.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        panelTop: panel?.top || 0,
        panelBottom: panel?.bottom || 0,
        rowCount: feed.querySelectorAll(".activity-log-item").length,
        overflowY: getComputedStyle(feed).overflowY
      };
    });
    expect(activityLayout.rowCount).toBeGreaterThanOrEqual(3);
    expect(["auto", "scroll"]).toContain(activityLayout.overflowY);
    expect(activityLayout.bottom).toBeLessThanOrEqual(activityLayout.panelBottom + 2);
    expect(activityLayout.top).toBeGreaterThanOrEqual(activityLayout.panelTop - 2);

    await page.locator("#chatDockBtn").click();
    await expect(page.locator("#chatPanel")).toHaveClass(/active/);
    await expect(page.locator("#localChatFeed")).toContainText("No player messages yet.");
    await expect(page.locator("#localChatInput")).toBeVisible();
    await expect(page.locator("#chatPanel .local-chat-input-row button")).toBeVisible();
    const chatLayout = await page.locator("#chatPanel").evaluate(panel => {
      const input = panel.querySelector("#localChatInput")?.getBoundingClientRect();
      const send = panel.querySelector(".local-chat-input-row button")?.getBoundingClientRect();
      const tabs = document.querySelector(".hud-command-tabs")?.getBoundingClientRect();
      const activeTab = document.querySelector("#chatDockBtn")?.getBoundingClientRect();
      return {
        inputTop: input?.top || 0,
        inputBottom: input?.bottom || 0,
        sendTop: send?.top || 0,
        sendBottom: send?.bottom || 0,
        tabTop: tabs?.top || 0,
        activeTabTop: activeTab?.top || 0,
        activeTabBottom: activeTab?.bottom || 0,
        buttonCount: document.querySelectorAll(".hud-command-tabs .info-tab").length
      };
    });
    expect(chatLayout.buttonCount).toBe(3);
    expect(Math.abs(chatLayout.inputTop - chatLayout.sendTop)).toBeLessThanOrEqual(2);
    expect(Math.abs(chatLayout.inputBottom - chatLayout.sendBottom)).toBeLessThanOrEqual(2);
    expect(chatLayout.activeTabTop).toBeGreaterThanOrEqual(chatLayout.tabTop - 2);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("Map 1 classifies protected and contested nodes for future PvP rules", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await waitForGameGlobals(page);

    const zones = await page.evaluate(() => window.eval(`
      (() => {
        const originalNode = currentNode;
        try {
          currentNode = "Upper Gate Core";
          const protectedBlockMessage = getRemotePlayerEngageBlockMessage({
            currentNodeId: "Upper Gate Core",
            presenceStatus: "space"
          });

          currentNode = "Lower Gate Core";
          const contestedBlockMessage = getRemotePlayerEngageBlockMessage({
            currentNodeId: "Lower Gate Core",
            presenceStatus: "space"
          });

          return {
            planets: {
              virella: getNodeZoneType("Virella"),
              asteronPrime: getNodeZoneType("Asteron Prime"),
              nyxara: getNodeZoneType("Nyxara")
            },
            north: {
              upperGateCore: getNodeZoneType("Upper Gate Core"),
              upperApex: getNodeZoneType("Upper Apex")
            },
            middle: {
              westLink1: getNodeZoneType("West Link 1"),
              eastLink1: getNodeZoneType("East Link 1")
            },
            south: {
              lowerGateCore: getNodeZoneType("Lower Gate Core"),
              lowerApex: getNodeZoneType("Lower Apex")
            },
            unknown: getNodeZoneType("Missing Node"),
            helpers: {
              currentProtected: (currentNode = "Asteron Prime", getCurrentNodeZoneType()),
              currentContested: (currentNode = "Lower Gate Core", getCurrentNodeZoneType()),
              upperProtected: isProtectedNode("Upper Gate Core"),
              lowerContested: isContestedNode("Lower Gate Core")
            },
            metadata: {
              upperGateCore: sectorNodes["Upper Gate Core"].pvpZoneType,
              lowerGateCore: sectorNodes["Lower Gate Core"].pvpZoneType
            },
            messages: {
              protectedBlockMessage,
              contestedBlockMessage
            }
          };
        } finally {
          currentNode = originalNode;
        }
      })()
    `));

    expect(Object.values(zones.planets)).toEqual(["protected", "protected", "protected"]);
    expect(Object.values(zones.north)).toEqual(["protected", "protected"]);
    expect(Object.values(zones.middle)).toEqual(["protected", "protected"]);
    expect(Object.values(zones.south)).toEqual(["contested", "contested"]);
    expect(zones.unknown).toBe("protected");
    expect(zones.helpers.currentProtected).toBe("protected");
    expect(zones.helpers.currentContested).toBe("contested");
    expect(zones.helpers.upperProtected).toBe(true);
    expect(zones.helpers.lowerContested).toBe(true);
    expect(zones.metadata.upperGateCore).toBe("protected");
    expect(zones.metadata.lowerGateCore).toBe("contested");
    expect(zones.messages.protectedBlockMessage).toBe("PvP disabled in protected zones.");
    expect(zones.messages.contestedBlockMessage).toBe("PvP server hit test ready.");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("orbit HUD displays current Protected or Contested zone status", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await waitForGameGlobals(page);
    await page.evaluate(() => {
      window.showScreen("spaceScreen");
      currentNode = "Asteron Prime";
      updateCurrentNodeUI();
    });

    const chip = page.locator("#nodeZoneStatusChip");
    await expect(chip).toHaveAttribute("data-zone-status", "protected");
    await expect(chip).toContainText("PROTECTED ZONE");
    await expect(chip).toContainText("PvP disabled");

    await page.evaluate(() => {
      currentNode = "Lower Gate Core";
      updateCurrentNodeUI();
    });
    await expect(chip).toHaveAttribute("data-zone-status", "contested");
    await expect(chip).toContainText("CONTESTED ZONE");
    await expect(chip).toContainText("PvP zone");

    const pvpBlock = await page.evaluate(() => getRemotePlayerEngageBlockMessage({
      currentNodeId: "Lower Gate Core",
      presenceStatus: "space"
    }));
    expect(pvpBlock).toBe("PvP server hit test ready.");

    await page.evaluate(() => {
      currentNode = "Missing Node";
      updateCurrentNodeUI();
    });
    await expect(chip).toHaveAttribute("data-zone-status", "protected");
    await expect(chip).toContainText("PROTECTED ZONE");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("remote player targeting follows protected and contested zone eligibility", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await waitForGameGlobals(page);

    const eligibility = await page.evaluate(() => window.eval(`
      (() => {
        const originalClient = window.LupenMultiplayerClient;
        const originalNode = currentNode;
        const originalSelected = selectedTarget;
        const originalEngaged = engagedTarget;
        const originalTimer = engageTimer;
        const originalHull = hull;
        const originalShield = shield;
        const originalCombatXp = playerProgress.combatXp;
        const originalAsteroids = Array.isArray(asteroids) ? asteroids.map(item => ({ ...item })) : [];
        const sentPvpIntents = [];
        let lastCombatVisualEvent = null;
        const remotePlayer = {
          sessionId: "remote-pvp-test",
          id: "remote-pvp-test",
          displayName: "Remote Pilot",
          currentNode: "Asteron Prime",
          presenceStatus: "space",
          shipName: "Azure Striker",
          shipImage: "assets/ships/azure-striker/azure-striker-medium.webp",
          level: 7,
          guildId: "",
          pvpShield: 30,
          pvpShieldMax: 30,
          pvpArmor: 12,
          pvpArmorMax: 12,
          pvpHull: 120,
          pvpHullMax: 120
        };

        if (engageTimer) {
          clearInterval(engageTimer);
          engageTimer = null;
        }
        selectedTarget = null;
        engagedTarget = null;
        showScreen("spaceScreen");

        window.LupenMultiplayerClient = {
          ...(originalClient || {}),
          getPlayers: ({ includeSelf = true } = {}) => [
            ...(includeSelf ? [{
              sessionId: "local-session",
              isSelf: true,
              displayName: "Local Pilot",
              currentNode,
              presenceStatus: "space"
            }] : []),
            { ...remotePlayer }
          ],
          getStatus: () => ({
            enabled: true,
            isConnected: true,
            enabledReason: "staging_enabled",
            sessionId: "local-session",
            guildId: "",
            lastCombatVisualEvent
          }),
          sendCombatIntent: (intent) => {
            sentPvpIntents.push({ ...intent });
            return { ok: true, type: "combat:intent", payload: { ...intent } };
          }
        };

        try {
          currentNode = "Asteron Prime";
          remotePlayer.currentNode = "Asteron Prime";
          selectRemotePlayerTarget("remote-pvp-test");
          window.LupenMultiplayerOverlay?.render?.();
          const protectedSelected = Boolean(getSelectedRemotePlayerTarget());
          const protectedMessage = getRemotePlayerEngageBlockMessage({ ...remotePlayer });
          const protectedActionDisabled = document.getElementById("objectEngageBtn")?.disabled ?? null;
          const protectedActionText = document.getElementById("objectEngageBtn")?.textContent || "";
          const protectedTargetCardText = document.querySelector(".lupen-target-card.player")?.textContent || "";

          currentNode = "Lower Gate Core";
          remotePlayer.currentNode = "Lower Gate Core";
          remotePlayer.pvpShield = 24;
          remotePlayer.pvpHull = 120;
          updateCurrentNodeUI();
          selectRemotePlayerTarget("remote-pvp-test");
          window.LupenMultiplayerOverlay?.render?.();
          const contestedTarget = getSelectedRemotePlayerTarget();
          const contestedSelected = Boolean(contestedTarget);
          const contestedBlockReason = getRemotePlayerTargetBlockReason(contestedTarget);
          const contestedEngageMessage = getRemotePlayerEngageBlockMessage(contestedTarget);
          const contestedActionDisabled = document.getElementById("objectEngageBtn")?.disabled ?? null;
          const contestedActionText = document.getElementById("objectEngageBtn")?.textContent || "";
          const contestedTargetCard = document.querySelector(".lupen-target-card.player");
          const contestedTargetCardText = contestedTargetCard?.textContent || "";
          const contestedTargetCardClass = contestedTargetCard?.className || "";
          const contestedTargetCardLayout = contestedTargetCard?.getAttribute("data-layout") || "";
          const contestedShieldBarWidth = contestedTargetCard?.querySelector(".lupen-target-bar-fill.shield")?.style.width || "";
          const contestedArmorBarWidth = contestedTargetCard?.querySelector(".lupen-target-bar-fill.armor")?.style.width || "";
          const contestedHullBarWidth = contestedTargetCard?.querySelector(".lupen-target-bar-fill.hull")?.style.width || "";
          const contestedCardRect = contestedTargetCard?.getBoundingClientRect();
          const contestedGhostRect = document.querySelector("#lupenMultiplayerSpaceGhostLayer .lupen-mp-space-ghost.is-selected")?.getBoundingClientRect();
          const contestedButtonRect = document.getElementById("objectEngageBtn")?.getBoundingClientRect();
          const contestedPlayerCardLayout = contestedCardRect && contestedGhostRect && contestedButtonRect ? {
            cardHeight: Math.round(contestedCardRect.height),
            cardWidth: Math.round(contestedCardRect.width),
            cardTop: Math.round(contestedCardRect.top),
            cardBottom: Math.round(contestedCardRect.bottom),
            ghostBottom: Math.round(contestedGhostRect.bottom),
            buttonTop: Math.round(contestedButtonRect.top),
            underGhost: contestedCardRect.top >= contestedGhostRect.bottom - 6,
            clearOfButton: contestedCardRect.bottom <= contestedButtonRect.top - 8
          } : null;
          clearAllCombatVisuals();
          lastCombatVisualEvent = {
            type: "pvp",
            ok: true,
            attackerSessionId: "local-session",
            targetType: "player",
            targetId: "remote-pvp-test",
            targetPlayerId: "remote-pvp-test",
            currentNode,
            damage: 36,
            shieldDamage: 36,
            armorDamage: 0,
            hullDamage: 0,
            receivedAt: Date.now()
          };
          window.LupenMultiplayerOverlay?.render?.();
          const localPvpShot = document.querySelector("#combatFxLayer .combat-fx-shot[data-owner='local'][data-target-id='remote-pvp-test']");
          const localPvpCore = localPvpShot?.querySelector(".combat-fx-beam-core");
          const localPvpGhostRect = document.querySelector("#lupenMultiplayerSpaceGhostLayer .lupen-mp-space-ghost.is-selected")?.getBoundingClientRect();
          const localPvpScreenRect = document.getElementById("spaceScreen")?.getBoundingClientRect();
          const localPvpBeamAlignment = {
            shotCount: document.querySelectorAll("#combatFxLayer .combat-fx-shot[data-owner='local'][data-target-id='remote-pvp-test']").length,
            coreFound: Boolean(localPvpCore),
            markerFound: Boolean(localPvpGhostRect),
            screenFound: Boolean(localPvpScreenRect),
            endpointX: Math.round(Number(localPvpCore?.getAttribute("x2") || 0)),
            endpointY: Math.round(Number(localPvpCore?.getAttribute("y2") || 0)),
            markerCenterX: localPvpGhostRect && localPvpScreenRect ? Math.round(localPvpGhostRect.left + localPvpGhostRect.width / 2 - localPvpScreenRect.left) : 0,
            markerCenterY: localPvpGhostRect && localPvpScreenRect ? Math.round(localPvpGhostRect.top + localPvpGhostRect.height / 2 - localPvpScreenRect.top) : 0
          };

          clearAllCombatVisuals();
          lastCombatVisualEvent = {
            type: "pvp",
            ok: true,
            attackerSessionId: "remote-pvp-test",
            targetType: "player",
            targetId: "local-session",
            targetPlayerId: "local-session",
            currentNode,
            damage: 36,
            shieldDamage: 36,
            armorDamage: 0,
            hullDamage: 0,
            receivedAt: Date.now() + 1
          };
          window.LupenMultiplayerOverlay?.render?.();
          const remotePvpShot = document.querySelector("#combatFxLayer .combat-fx-shot[data-owner='remote'][data-target-id='local-session']");
          const remotePvpCore = remotePvpShot?.querySelector(".combat-fx-beam-core");
          const remotePvpGhostRect = document.querySelector("#lupenMultiplayerSpaceGhostLayer .lupen-mp-space-ghost.is-selected")?.getBoundingClientRect();
          const remotePvpScreenRect = document.getElementById("spaceScreen")?.getBoundingClientRect();
          const remotePvpBeamAlignment = {
            shotCount: document.querySelectorAll("#combatFxLayer .combat-fx-shot[data-owner='remote'][data-target-id='local-session']").length,
            coreFound: Boolean(remotePvpCore),
            markerFound: Boolean(remotePvpGhostRect),
            screenFound: Boolean(remotePvpScreenRect),
            sourceX: Math.round(Number(remotePvpCore?.getAttribute("x1") || 0)),
            sourceY: Math.round(Number(remotePvpCore?.getAttribute("y1") || 0)),
            markerCenterX: remotePvpGhostRect && remotePvpScreenRect ? Math.round(remotePvpGhostRect.left + remotePvpGhostRect.width / 2 - remotePvpScreenRect.left) : 0,
            markerCenterY: remotePvpGhostRect && remotePvpScreenRect ? Math.round(remotePvpGhostRect.top + remotePvpGhostRect.height / 2 - remotePvpScreenRect.top) : 0
          };

          remotePlayer.pvpHull = 20;
          window.LupenMultiplayerOverlay?.render?.();
          const criticalTargetCard = document.querySelector(".lupen-target-card.player");
          const criticalTargetCardText = criticalTargetCard?.textContent || "";
          const criticalTargetCardClass = criticalTargetCard?.className || "";

          remotePlayer.pvpHull = 0;
          window.LupenMultiplayerOverlay?.render?.();
          const disabledTargetCard = document.querySelector(".lupen-target-card.player");
          const disabledTargetCardText = disabledTargetCard?.textContent || "";
          const disabledTargetCardClass = disabledTargetCard?.className || "";
          remotePlayer.pvpHull = 120;

          const sustainedPvpVisibilitySnapshots = [];
          for (let index = 0; index < 7; index += 1) {
            remotePlayer.pvpShield = Math.max(0, 24 - index * 4);
            remotePlayer.pvpArmor = 12;
            remotePlayer.pvpHull = Math.max(22, 120 - index * 11);
            remotePlayer.currentNode = "Lower Gate Core";
            remotePlayer.presenceStatus = "space";
            window.LupenMultiplayerOverlay?.render?.();
            const ghost = document.querySelector('#lupenMultiplayerSpaceGhostLayer .lupen-mp-space-ghost[data-session-id="remote-pvp-test"]');
            sustainedPvpVisibilitySnapshots.push({
              ghostCount: document.querySelectorAll('#lupenMultiplayerSpaceGhostLayer .lupen-mp-space-ghost[data-session-id="remote-pvp-test"]').length,
              selected: ghost?.classList.contains("is-selected") || false,
              imageSrc: ghost?.querySelector(".lupen-mp-space-ghost-ship img")?.getAttribute("src") || "",
              label: ghost?.querySelector(".lupen-mp-space-ghost-label")?.textContent || "",
              node: remotePlayer.currentNode
            });
          }

          asteroids = [{
            id: "local-only-test-asteroid",
            name: "Local Only Test Asteroid",
            resource: "Iron",
            alive: true,
            node: "Lower Gate Core",
            x: 18,
            y: 30,
            hp: 30,
            maxHp: 30
          }];
          selectedTarget = { type: "asteroid", id: "local-only-test-asteroid" };
          engagedTarget = { type: "asteroid", id: "local-only-test-asteroid" };
          window.LupenMultiplayerClient.getResources = () => [];
          updateAsteroidUI();
          const connectedEmptyReconcile = typeof reconcileServerOwnedSectorObjectMode === "function"
            ? reconcileServerOwnedSectorObjectMode("e2e_connected_empty")
            : null;
          maybeMoveAsteroid();
          scheduleAsteroidRespawn();
          const connectedEmptySnapshot = typeof getStagingNodeConsistencySnapshot === "function"
            ? getStagingNodeConsistencySnapshot()
            : null;
          const connectedEmptyLocalAsteroidButtonCount = document.querySelectorAll("#asteroidField .resource-asteroid-target:not(.server-resource-asteroid)").length;
          const connectedEmptyAsteroidNode = asteroids[0]?.node || "";
          const connectedEmptySelectedType = selectedTarget?.type || "";
          const connectedEmptyEngagedType = engagedTarget?.type || "";

          window.LupenMultiplayerClient.getResources = () => [{
            id: "server-owned-test-asteroid",
            resourceName: "Iron",
            currentNode: "Lower Gate Core",
            x: 58,
            y: 34,
            hp: 30,
            hpMax: 30,
            depleted: false
          }];
          updateAsteroidUI();
          const sharedNodeSnapshot = typeof getStagingNodeConsistencySnapshot === "function"
            ? getStagingNodeConsistencySnapshot()
            : null;
          const localAsteroidButtonCount = document.querySelectorAll("#asteroidField .resource-asteroid-target:not(.server-resource-asteroid)").length;
          const serverAsteroidButtonCount = document.querySelectorAll("#asteroidField .server-resource-asteroid").length;

          selectedTarget = { type: "stagingResource", id: "server-owned-test-asteroid" };
          engagedTarget = { type: "stagingResource", id: "server-owned-test-asteroid" };
          engageTimer = setInterval(() => {}, 99999);
          selectRemotePlayerTarget("remote-pvp-test");
          const clickWhileEngagedState = {
            selectedType: selectedTarget?.type || "",
            selectedId: selectedTarget?.id || "",
            engagedType: engagedTarget?.type || "",
            engagedId: engagedTarget?.id || "",
            timerActive: Boolean(engageTimer),
            actionText: document.getElementById("objectEngageBtn")?.textContent || ""
          };

          selectedTarget = { type: "stagingResource", id: "server-owned-test-asteroid" };
          engagedTarget = { type: "stagingBot", id: "server-owned-other-target" };
          updateObjectActionPanel(true);
          const switchTargetLabelState = {
            actionText: document.getElementById("objectEngageBtn")?.textContent || "",
            usesSwitchCopy: (document.getElementById("objectEngageBtn")?.textContent || "").includes("SWITCH")
          };
          clearInterval(engageTimer);
          engageTimer = null;
          engagedTarget = null;

          remotePlayer.currentNode = "Lower Gate Core";
          selectRemotePlayerTarget("remote-pvp-test");
          window.LupenMultiplayerOverlay?.render?.();

          const before = { hull, shield, combatXp: playerProgress.combatXp };
          const hudBefore = {
            hullValue: document.getElementById("hullValue")?.textContent || "",
            shieldValue: document.getElementById("shieldValue")?.textContent || ""
          };
          const pvpHudApplied = typeof applyServerPvpDamageState === "function"
            ? applyServerPvpDamageState({
              targetSessionId: "local-session",
              shield: 18,
              shieldMax: 30,
              hull: 120,
              hullMax: 120
            })
            : false;
          const hudAfterPvpDisplay = {
            hullValue: document.getElementById("hullValue")?.textContent || "",
            shieldValue: document.getElementById("shieldValue")?.textContent || "",
            storedHull: hull,
            storedShield: shield,
            applied: pvpHudApplied
          };
          const activityBeforeCritical = document.getElementById("activityLogFeed")?.textContent || "";
          applyServerPvpDamageState({
            targetSessionId: "local-session",
            shield: 0,
            shieldMax: 30,
            hull: 20,
            hullMax: 120
          });
          applyServerPvpDamageState({
            targetSessionId: "local-session",
            shield: 0,
            shieldMax: 30,
            hull: 20,
            hullMax: 120
          });
          const activityAfterCritical = document.getElementById("activityLogFeed")?.textContent || "";
          applyServerPvpDamageState({
            targetSessionId: "local-session",
            shield: 0,
            shieldMax: 30,
            hull: 0,
            hullMax: 120
          });
          const activityAfterDisabled = document.getElementById("activityLogFeed")?.textContent || "";
          const disabledHudClasses = {
            screenCritical: document.getElementById("spaceScreen")?.classList.contains("player-hull-critical") || false,
            screenDisabled: document.getElementById("spaceScreen")?.classList.contains("player-hull-disabled-threshold") || false,
            statCritical: document.querySelector(".vertical-stats")?.classList.contains("player-hull-critical") || false,
            statDisabled: document.querySelector(".vertical-stats")?.classList.contains("player-hull-disabled-threshold") || false
          };
          applyServerPvpDamageState({
            targetSessionId: "local-session",
            shield: 30,
            shieldMax: 30,
            hull: 120,
            hullMax: 120,
            reason: "pvp_repair_synced"
          });
          const repairedHudClasses = {
            screenCritical: document.getElementById("spaceScreen")?.classList.contains("player-hull-critical") || false,
            screenDisabled: document.getElementById("spaceScreen")?.classList.contains("player-hull-disabled-threshold") || false,
            statCritical: document.querySelector(".vertical-stats")?.classList.contains("player-hull-critical") || false,
            statDisabled: document.querySelector(".vertical-stats")?.classList.contains("player-hull-disabled-threshold") || false
          };
          const criticalFeedback = {
            criticalMessages: (activityAfterCritical.match(/Hull integrity critical\\./g) || []).length
              - (activityBeforeCritical.match(/Hull integrity critical\\./g) || []).length,
            disabledMessages: (activityAfterDisabled.match(/Ship destroyed\\. Emergency return to Asteron Prime\\./g) || []).length
              - (activityAfterCritical.match(/Ship destroyed\\. Emergency return to Asteron Prime\\./g) || []).length,
            disabledHudClasses,
            repairedHudClasses
          };
          const activityBeforeEngage = document.getElementById("activityLogFeed")?.textContent || "";
          engageTarget();
          engageTarget();
          const activityAfterEngage = document.getElementById("activityLogFeed")?.textContent || "";
          const after = {
            hull,
            shield,
            combatXp: playerProgress.combatXp,
            selectedType: selectedTarget?.type || "",
            engagedType: engagedTarget?.type || "",
            engageTimerActive: Boolean(engageTimer),
            pvpRequestMessages: (activityAfterEngage.match(/PvP hit request sent\\./g) || []).length
              - (activityBeforeEngage.match(/PvP hit request sent\\./g) || []).length
          };

          currentNode = "Asteron Prime";
          remotePlayer.currentNode = "Asteron Prime";
          updateCurrentNodeUI();
          const protectedReturnSelected = selectedTarget?.type === "remotePlayer";
          const protectedReturnActionDisabled = document.getElementById("objectEngageBtn")?.disabled ?? null;
          const protectedReturnActionText = document.getElementById("objectEngageBtn")?.textContent || "";

          currentNode = "Missing Node";
          remotePlayer.currentNode = "Missing Node";
          selectRemotePlayerTarget("remote-pvp-test");
          const unknownSelected = Boolean(getSelectedRemotePlayerTarget());
          const unknownMessage = getRemotePlayerEngageBlockMessage({ ...remotePlayer });
          const unknownActionDisabled = document.getElementById("objectEngageBtn")?.disabled ?? null;
          const unknownActionText = document.getElementById("objectEngageBtn")?.textContent || "";

          currentNode = "Lower Gate Core";
          remotePlayer.currentNode = "Lower Gate Core";
          selectRemotePlayerTarget("remote-pvp-test");
          const beforeDestructionRecovery = {
            credits,
            combatXp: playerProgress.combatXp,
            cargo: { ...cargo },
            selectedType: selectedTarget?.type || "",
            currentNode
          };
          const activityBeforeDestructionRecovery = document.getElementById("activityLogFeed")?.textContent || "";
          const pvpDestructionApplied = typeof applyServerPvpDestructionState === "function"
            ? applyServerPvpDestructionState({
              targetSessionId: "local-session",
              attackerSessionId: "remote-pvp-test",
              currentNode: "Asteron Prime",
              presenceStatus: "docked",
              shield: 30,
              shieldMax: 30,
              armor: 0,
              armorMax: 0,
              hull: 120,
              hullMax: 120,
              hullAtDestruction: 0,
              deathApplied: true,
              restoredToFull: true,
              cargoLost: false,
              creditsLost: false,
              itemsLost: false,
              xpAwarded: false,
              bountyProgressChanged: false,
              rewardsGranted: false
            })
            : false;
          const activityAfterDestructionRecovery = document.getElementById("activityLogFeed")?.textContent || "";
          const savedAfterDestructionRecovery = JSON.parse(localStorage.getItem(STORAGE_GAME_KEY) || "{}");
          selectedTarget = { type: "remotePlayer", id: "remote-pvp-test" };
          engagedTarget = { type: "remotePlayer", id: "remote-pvp-test" };
          engageTimer = setInterval(() => {}, 99999);
          applyServerPvpDamageState({
            targetSessionId: "local-session",
            shield: 0,
            shieldMax: 30,
            hull: 12,
            hullMax: 120
          });
          const stalePvpBeforeLoad = {
            selectedType: selectedTarget?.type || "",
            engagedType: engagedTarget?.type || "",
            timerActive: Boolean(engageTimer),
            pvpHull: serverPvpDamageDisplayState?.hull ?? null
          };
          applyLoadedGameState(savedAfterDestructionRecovery);
          const loadedRecoveryState = {
            currentNode,
            lastPlanetNode,
            selectedType: selectedTarget?.type || "",
            engagedType: engagedTarget?.type || "",
            timerActive: Boolean(engageTimer),
            pvpStateCleared: serverPvpDamageDisplayState === null,
            hull,
            shield
          };
          const destructionRecovery = {
            applied: pvpDestructionApplied,
            currentNode,
            lastPlanetNode,
            activeScreen: document.getElementById("gameScreen")?.classList.contains("active")
              ? "gameScreen"
              : document.getElementById("spaceScreen")?.classList.contains("active")
                ? "spaceScreen"
                : "",
            selectedType: selectedTarget?.type || "",
            engagedType: engagedTarget?.type || "",
            hullValue: document.getElementById("hullValue")?.textContent || "",
            shieldValue: document.getElementById("shieldValue")?.textContent || "",
            credits,
            combatXp: playerProgress.combatXp,
            cargo: { ...cargo },
            savedCurrentNode: savedAfterDestructionRecovery.currentNode || "",
            savedLastPlanetNode: savedAfterDestructionRecovery.lastPlanetNode || "",
            savedHull: savedAfterDestructionRecovery.hull,
            savedShield: savedAfterDestructionRecovery.shield,
            stalePvpBeforeLoad,
            loadedRecoveryState,
            messages: (activityAfterDestructionRecovery.match(/Ship destroyed\\. Emergency return to Asteron Prime\\./g) || []).length
              - (activityBeforeDestructionRecovery.match(/Ship destroyed\\. Emergency return to Asteron Prime\\./g) || []).length,
            before: beforeDestructionRecovery
          };

          return {
            protectedSelected,
            protectedMessage,
            protectedActionDisabled,
            protectedActionText,
            protectedTargetCardText,
            contestedSelected,
            contestedBlockReason,
            contestedEngageMessage,
            contestedActionDisabled,
            contestedActionText,
            contestedTargetCardText,
            contestedTargetCardClass,
            contestedTargetCardLayout,
            contestedPlayerCardLayout,
            localPvpBeamAlignment,
            remotePvpBeamAlignment,
            contestedShieldBarWidth,
            contestedArmorBarWidth,
            contestedHullBarWidth,
            criticalTargetCardText,
            criticalTargetCardClass,
            disabledTargetCardText,
            disabledTargetCardClass,
            sustainedPvpVisibilitySnapshots,
            connectedEmptyReconcile,
            connectedEmptySnapshot,
            connectedEmptyLocalAsteroidButtonCount,
            connectedEmptyAsteroidNode,
            connectedEmptySelectedType,
            connectedEmptyEngagedType,
            sharedNodeSnapshot,
            localAsteroidButtonCount,
            serverAsteroidButtonCount,
            clickWhileEngagedState,
            switchTargetLabelState,
            before,
            hudBefore,
            hudAfterPvpDisplay,
            criticalFeedback,
            after,
            sentPvpIntents,
            protectedReturnSelected,
            protectedReturnActionDisabled,
            protectedReturnActionText,
            unknownSelected,
            unknownMessage,
            unknownActionDisabled,
            unknownActionText,
            destructionRecovery
          };
        } finally {
          if (engageTimer) clearInterval(engageTimer);
          engageTimer = originalTimer;
          selectedTarget = originalSelected;
          engagedTarget = originalEngaged;
          currentNode = originalNode;
          hull = originalHull;
          shield = originalShield;
          asteroids = originalAsteroids;
          playerProgress.combatXp = originalCombatXp;
          window.LupenMultiplayerClient = originalClient;
          updateCurrentNodeUI();
        }
      })()
    `));

    expect(eligibility.protectedSelected).toBe(true);
    expect(eligibility.protectedMessage).toBe("PvP disabled in protected zones.");
    expect(eligibility.protectedActionDisabled).toBe(true);
    expect(eligibility.protectedActionText).toBe("PVP DISABLED");
    expect(eligibility.protectedTargetCardText).toContain("Remote Pilot");
    expect(eligibility.protectedTargetCardText).toContain("Azure Striker");
    expect(eligibility.protectedTargetCardText).toContain("L7");
    expect(eligibility.protectedTargetCardText).toContain("PROTECTED");
    expect(eligibility.protectedTargetCardText).toContain("PVP DISABLED");
    expect(eligibility.protectedTargetCardText).not.toContain("Inspection only");
    expect(eligibility.protectedTargetCardText).not.toContain("PvP disabled in protected zones");
    expect(eligibility.contestedSelected).toBe(true);
    expect(eligibility.contestedBlockReason).toBe("");
    expect(eligibility.contestedEngageMessage).toBe("PvP server hit test ready.");
    expect(eligibility.contestedActionDisabled).toBe(false);
    expect(eligibility.contestedActionText).toBe("PVP ENGAGE");
    expect(eligibility.contestedTargetCardText).toContain("Remote Pilot");
    expect(eligibility.contestedTargetCardText).toContain("Azure Striker");
    expect(eligibility.contestedTargetCardText).toContain("L7");
    expect(eligibility.contestedTargetCardText).toContain("CONTESTED");
    expect(eligibility.contestedTargetCardText).toContain("PVP READY");
    expect(eligibility.contestedTargetCardText).not.toContain("Server hit test ready");
    expect(eligibility.contestedTargetCardText).not.toContain("No defeat or loot");
    expect(eligibility.contestedTargetCardClass).toContain("compact-player-target");
    expect(eligibility.contestedTargetCardLayout).toBe("compact");
    expect(eligibility.contestedPlayerCardLayout).toMatchObject({
      underGhost: true,
      clearOfButton: true
    });
    expect(eligibility.contestedPlayerCardLayout.cardHeight).toBeLessThanOrEqual(82);
    expect(eligibility.contestedPlayerCardLayout.cardWidth).toBeLessThanOrEqual(150);
    expect(eligibility.localPvpBeamAlignment).toMatchObject({ shotCount: 1 });
    expect(Math.abs(eligibility.localPvpBeamAlignment.endpointX - eligibility.localPvpBeamAlignment.markerCenterX)).toBeLessThanOrEqual(1);
    expect(Math.abs(eligibility.localPvpBeamAlignment.endpointY - eligibility.localPvpBeamAlignment.markerCenterY)).toBeLessThanOrEqual(1);
    expect(eligibility.remotePvpBeamAlignment).toMatchObject({ shotCount: 1 });
    expect(Math.abs(eligibility.remotePvpBeamAlignment.sourceX - eligibility.remotePvpBeamAlignment.markerCenterX)).toBeLessThanOrEqual(1);
    expect(Math.abs(eligibility.remotePvpBeamAlignment.sourceY - eligibility.remotePvpBeamAlignment.markerCenterY)).toBeLessThanOrEqual(1);
    expect(eligibility.contestedShieldBarWidth).toBe("80%");
    expect(eligibility.contestedArmorBarWidth).toBe("100%");
    expect(eligibility.contestedHullBarWidth).toBe("100%");
    expect(eligibility.criticalTargetCardText).toContain("CRITICAL");
    expect(eligibility.criticalTargetCardText).not.toContain("Repair required");
    expect(eligibility.criticalTargetCardClass).toContain("pvp-hull-critical");
    expect(eligibility.disabledTargetCardText).toContain("REPAIR");
    expect(eligibility.disabledTargetCardText).not.toContain("Repair required");
    expect(eligibility.disabledTargetCardClass).toContain("pvp-disabled-threshold");
    expect(eligibility.sustainedPvpVisibilitySnapshots).toHaveLength(7);
    eligibility.sustainedPvpVisibilitySnapshots.forEach((snapshot) => {
      expect(snapshot).toMatchObject({
        ghostCount: 1,
        selected: true,
        label: "Remote Pilot",
        node: "Lower Gate Core"
      });
      expect(snapshot.imageSrc).toContain("azure-striker");
    });
    expect(eligibility.connectedEmptyReconcile).toMatchObject({
      reconciled: true,
      serverOwnedActive: true
    });
    expect(eligibility.connectedEmptySnapshot).toMatchObject({
      serverOwnedActive: true,
      localAsteroidsSuppressed: true,
      visibleServerResources: 0,
      visibleLocalAsteroids: 0
    });
    expect(eligibility.connectedEmptySnapshot.visibleTargetTypes).not.toContain("asteroid");
    expect(eligibility.connectedEmptySnapshot.localAsteroidIds).toEqual([]);
    expect(eligibility.connectedEmptyLocalAsteroidButtonCount).toBe(0);
    expect(eligibility.connectedEmptyAsteroidNode).toBe("Lower Gate Core");
    expect(eligibility.connectedEmptySelectedType).toBe("");
    expect(eligibility.connectedEmptyEngagedType).toBe("");
    expect(eligibility.sharedNodeSnapshot).toMatchObject({
      serverOwnedActive: true,
      localAsteroidsSuppressed: true,
      visibleServerResources: 1,
      visibleLocalAsteroids: 0
    });
    expect(eligibility.localAsteroidButtonCount).toBe(0);
    expect(eligibility.serverAsteroidButtonCount).toBe(1);
    expect(eligibility.clickWhileEngagedState).toMatchObject({
      selectedType: "remotePlayer",
      selectedId: "remote-pvp-test",
      engagedType: "stagingResource",
      engagedId: "server-owned-test-asteroid",
      timerActive: true
    });
    expect(eligibility.clickWhileEngagedState.actionText).toBe("PVP ENGAGE");
    expect(eligibility.switchTargetLabelState).toMatchObject({
      actionText: "ENGAGE",
      usesSwitchCopy: false
    });
    expect(eligibility.hudAfterPvpDisplay.applied).toBe(true);
    expect(eligibility.hudAfterPvpDisplay.hullValue).toBe("120");
    expect(eligibility.hudAfterPvpDisplay.shieldValue).toBe("18");
    expect(eligibility.hudAfterPvpDisplay.storedHull).toBe(eligibility.before.hull);
    expect(eligibility.hudAfterPvpDisplay.storedShield).toBe(eligibility.before.shield);
    expect(eligibility.criticalFeedback.criticalMessages).toBe(1);
    expect(eligibility.criticalFeedback.disabledMessages).toBe(1);
    expect(eligibility.criticalFeedback.disabledHudClasses).toMatchObject({
      screenCritical: false,
      screenDisabled: true,
      statCritical: false,
      statDisabled: true
    });
    expect(eligibility.criticalFeedback.repairedHudClasses).toMatchObject({
      screenCritical: false,
      screenDisabled: false,
      statCritical: false,
      statDisabled: false
    });
    expect(eligibility.after.hull).toBe(eligibility.before.hull);
    expect(eligibility.after.shield).toBe(eligibility.before.shield);
    expect(eligibility.after.combatXp).toBe(eligibility.before.combatXp);
    expect(eligibility.after.selectedType).toBe("remotePlayer");
    expect(eligibility.after.engagedType).toBe("");
    expect(eligibility.after.engageTimerActive).toBe(false);
    expect(eligibility.after.pvpRequestMessages).toBe(1);
    expect(eligibility.sentPvpIntents).toHaveLength(2);
    expect(eligibility.sentPvpIntents[0]).toMatchObject({
      targetType: "remotePlayer",
      targetPlayerId: "remote-pvp-test",
      targetSessionId: "remote-pvp-test",
      currentNode: "Lower Gate Core"
    });
    expect(eligibility.protectedReturnSelected).toBe(true);
    expect(eligibility.protectedReturnActionDisabled).toBe(true);
    expect(eligibility.protectedReturnActionText).toBe("PVP DISABLED");
    expect(eligibility.unknownSelected).toBe(true);
    expect(eligibility.unknownMessage).toBe("PvP disabled in protected zones.");
    expect(eligibility.unknownActionDisabled).toBe(true);
    expect(eligibility.unknownActionText).toBe("PVP DISABLED");
    expect(eligibility.destructionRecovery).toMatchObject({
      applied: true,
      currentNode: "Asteron Prime",
      lastPlanetNode: "Asteron Prime",
      activeScreen: "gameScreen",
      selectedType: "",
      engagedType: "",
      hullValue: "120",
      shieldValue: "30",
      credits: eligibility.destructionRecovery.before.credits,
      combatXp: eligibility.destructionRecovery.before.combatXp,
      savedCurrentNode: "Asteron Prime",
      savedLastPlanetNode: "Asteron Prime",
      savedHull: 120,
      savedShield: 30
    });
    expect(eligibility.destructionRecovery.cargo).toEqual(eligibility.destructionRecovery.before.cargo);
    expect(eligibility.destructionRecovery.stalePvpBeforeLoad).toMatchObject({
      selectedType: "",
      engagedType: "",
      timerActive: false,
      pvpHull: 12
    });
    expect(eligibility.destructionRecovery.loadedRecoveryState).toMatchObject({
      currentNode: "Asteron Prime",
      lastPlanetNode: "Asteron Prime",
      selectedType: "",
      engagedType: "",
      timerActive: false,
      pvpStateCleared: true,
      hull: 120,
      shield: 30
    });

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("multiplayer staging trade builder shows server-backed routes when offers are available", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await waitForGameGlobals(page);
    await page.waitForFunction(() => !!window.LupenMultiplayerClient?.getStatus, null, { timeout: 15000 });
    await openTradeTerminal(page);
    await page.evaluate(() => {
      const client = window.LupenMultiplayerClient;
      const originalGetStatus = client.getStatus.bind(client);
      client.getStatus = () => ({
        ...originalGetStatus(),
        enabled: true,
        isConnected: true,
        enabledReason: "staging_enabled",
        lastStagingTradeOffers: {
          ok: true,
          offers: (() => {
            const resources = [
              { resourceId: "iron", resourceName: "Iron" },
              { resourceId: "copper", resourceName: "Copper" },
              { resourceId: "cobalt", resourceName: "Cobalt" },
              { resourceId: "crystal_shards", resourceName: "Crystal Shards" }
            ];
            const prices = {
              "Asteron Prime": { Iron: 18, Copper: 38, Cobalt: 90, "Crystal Shards": 95 },
              Virella: { Iron: 30, Copper: 32, Cobalt: 74, "Crystal Shards": 120 },
              Nyxara: { Iron: 24, Copper: 50, Cobalt: 62, "Crystal Shards": 145 }
            };
            const slugs = { "Asteron Prime": "asteron", Virella: "virella", Nyxara: "nyxara" };
            const resourceSlugs = { crystal_shards: "crystal" };
            return resources.flatMap((resource) => Object.keys(prices).flatMap((buyNode) => {
              return Object.keys(prices).filter((sellNode) => sellNode !== buyNode).map((sellNode) => ({
                offerId: `staging-${resourceSlugs[resource.resourceId] || resource.resourceId.replace(/_/g, "-")}-${slugs[buyNode]}-${slugs[sellNode]}`,
                resourceId: resource.resourceId,
                resourceName: resource.resourceName,
                buyNode,
                sellNode,
                buyPrice: prices[buyNode][resource.resourceName],
                sellPrice: prices[sellNode][resource.resourceName],
                maxQuantity: 1000
              }));
            }));
          })()
        }
      });
      if (typeof window.renderMarketplace === "function") window.renderMarketplace();
    });

    await expect(page.locator("#lupenMultiplayerStagingTradePanel")).toHaveCount(0);
    await expect(page.locator("#marketScreen")).toContainText("AVAILABLE ROUTES");
    await expect(page.locator("#marketScreen")).toContainText("Accept Trade");
    await expect(page.locator("#marketScreen")).not.toContainText("Preview Unavailable");
    await expect(page.locator("#marketScreen")).not.toContainText("Confirm Target");
    await expect(page.locator("#marketScreen")).toContainText(/Crystal Shards[\s\S]*Asteron Prime -> Nyxara|Iron[\s\S]*Asteron Prime -> Virella/i);

    await page.evaluate(() => {
      window.eval(`
        currentNode = "Asteron Prime";
        lastPlanetNode = "Asteron Prime";
        credits = 10000;
        cargo.Iron = 0;
        selectedMarketResource = "Iron";
        selectedMarketTargetPlanet = "Virella";
        selectedMarketQuantity = 63;
      `);
      if (typeof window.renderMarketplace === "function") window.renderMarketplace();
    });

    await expect(page.locator("#marketScreen .trade-route-card[data-route-destination='Virella']")).toContainText(/Asteron Prime -> Virella/);
    await expect(page.locator("#marketScreen .trade-route-card[data-route-destination='Virella']")).toContainText("BEST ROUTE");
    await expect(page.locator("#marketScreen .trade-route-card[data-route-destination='Virella']")).toContainText(/Jumps?/);
    await expect(page.locator("#marketScreen")).toContainText("150 units");
    await expect(page.locator("#marketScreen")).not.toContainText("Cost CR 2,700");
    await expect(page.locator("#marketScreen")).not.toContainText("Revenue CR 4,500");
    await expect(page.locator("#marketScreen")).toContainText("+CR 1,800");
    await expect(page.locator("#marketScreen")).toContainText(/Buy applies to this pilot save immediately/);
    await expect(page.locator("#marketScreen")).not.toContainText("Dry run only");

    await page.evaluate(() => {
      window.eval(`
        selectedMarketTargetPlanet = "Virella";
      `);
      if (typeof window.setMarketResource === "function") window.setMarketResource("Copper");
    });
    await expect(page.locator("#marketScreen .market-builder-selected")).toContainText(/Copper[\s\S]*Current station: Asteron Prime/);
    await expect(page.locator("#marketScreen .trade-route-card[data-route-destination='Virella']")).toHaveCount(0);
    await expect(page.locator("#marketScreen .trade-route-card[data-route-destination='Nyxara']")).toContainText(/Asteron Prime -> Nyxara/);

    await page.evaluate(() => {
      window.eval(`
        selectedMarketTargetPlanet = "Asteron Prime";
      `);
      if (typeof window.setMarketResource === "function") window.setMarketResource("Iron");
    });
    await expect(page.locator("#marketScreen .market-builder-selected")).toContainText(/Iron[\s\S]*Current station: Asteron Prime/);
    await expect(page.locator("#marketScreen .trade-route-card[data-route-destination='Virella']")).toHaveClass(/is-selected/);

    const buyMutation = await page.evaluate(() => window.eval(`
      (() => {
        currentNode = "Asteron Prime";
        lastPlanetNode = "Asteron Prime";
        credits = 10000;
        cargo.Iron = 0;
        delete cargoCostBasis.Iron;
        activeTradeRoute = null;
        activeObjective = null;
        selectedMarketResource = "Iron";
        selectedMarketTargetPlanet = "Virella";
        selectedMarketQuantity = 6;
        renderMarketplace();
        loadMarketRouteCargo("Virella");
        const saved = JSON.parse(localStorage.getItem(STORAGE_GAME_KEY) || "{}");
        return {
          credits,
          cargoIron: cargo.Iron || 0,
          cargoBasis: cargoCostBasis.Iron || 0,
          route: { ...activeTradeRoute },
          objective: { ...activeObjective },
          savedCredits: saved.credits,
          savedCargoIron: saved.cargo?.Iron || 0,
          savedRoute: saved.activeTradeRoute
        };
      })()
    `));
    expect(buyMutation.credits).toBe(7300);
    expect(buyMutation.cargoIron).toBe(150);
    expect(buyMutation.cargoBasis).toBe(18);
    expect(buyMutation.route.stagingTrade).toBe(true);
    expect(buyMutation.route.destination).toBe("Virella");
    expect(buyMutation.objective.destination).toBe("Virella");
    expect(buyMutation.savedCredits).toBe(7300);
    expect(buyMutation.savedCargoIron).toBe(150);
    expect(buyMutation.savedRoute.destination).toBe("Virella");
    await expect(page.locator("#activeObjectiveSummary")).toContainText("Deliver 150 Iron");
    await expect(page.locator("#activeObjectiveSummary")).toContainText("Asteron Prime -> Virella");
    await expect(page.locator("#activeObjectiveSummary")).toContainText("+CR 1,800");
    await page.evaluate(() => {
      if (typeof window.clearActiveObjective === "function") window.clearActiveObjective("trade");
    });

    await page.evaluate(() => {
      window.eval(`
        currentNode = "Nyxara";
        lastPlanetNode = "Nyxara";
        credits = 10000;
        cargo.Iron = 0;
        cargo.Cobalt = 0;
        selectedMarketResource = "Cobalt";
        selectedMarketTargetPlanet = "Asteron Prime";
        selectedMarketQuantity = 14;
      `);
      if (typeof window.renderMarketplace === "function") window.renderMarketplace();
    });

    await expect(page.locator("#marketScreen .trade-route-card[data-route-destination='Asteron Prime']")).toContainText(/Nyxara -> Asteron Prime/);
    await expect(page.locator("#marketScreen")).toContainText("150 units");
    await expect(page.locator("#marketScreen")).not.toContainText("Cost CR 9,300");
    await expect(page.locator("#marketScreen")).not.toContainText("Revenue CR 13,500");
    await expect(page.locator("#marketScreen")).toContainText("+CR 4,200");

    for (const planet of ["Asteron Prime", "Virella", "Nyxara"]) {
      await page.evaluate((nextPlanet) => {
        window.eval(`
          currentNode = ${JSON.stringify(nextPlanet)};
          lastPlanetNode = ${JSON.stringify(nextPlanet)};
          selectedMarketResource = "Iron";
          selectedMarketTargetPlanet = "";
          selectedMarketQuantity = 1;
        `);
        if (typeof window.renderMarketplace === "function") window.renderMarketplace();
      }, planet);
      for (const resource of ["Iron", "Copper", "Cobalt", "Crystal Shards"]) {
        await page.evaluate((nextResource) => {
          window.eval(`
            selectedMarketResource = ${JSON.stringify(nextResource)};
            selectedMarketTargetPlanet = "";
            selectedMarketQuantity = 1;
          `);
          if (typeof window.renderMarketplace === "function") window.renderMarketplace();
        }, resource);
        await expect(page.locator("#marketScreen")).toContainText(resource);
        await expect(page.locator("#marketScreen")).toContainText(/AVAILABLE ROUTES|BEST ROUTE|No profitable route available/);
        await expect(page.locator("#marketScreen")).toContainText(/Accept Trade|No profitable route available/);
      }
    }

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("multiplayer staging trade builder shows server sell for carried cargo at destination", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await waitForGameGlobals(page);
    await page.waitForFunction(() => !!window.LupenMultiplayerClient?.getStatus, null, { timeout: 15000 });
    await openTradeTerminal(page);
    await page.evaluate(() => {
      const client = window.LupenMultiplayerClient;
      const originalGetStatus = client.getStatus.bind(client);
      client.getStatus = () => ({
        ...originalGetStatus(),
        enabled: true,
        isConnected: true,
        enabledReason: "staging_enabled",
        lastStagingTradeOffers: {
          ok: true,
          offers: (() => {
            const resources = [
              { resourceId: "iron", resourceName: "Iron" },
              { resourceId: "copper", resourceName: "Copper" },
              { resourceId: "cobalt", resourceName: "Cobalt" },
              { resourceId: "crystal_shards", resourceName: "Crystal Shards" }
            ];
            const prices = {
              "Asteron Prime": { Iron: 18, Copper: 38, Cobalt: 90, "Crystal Shards": 95 },
              Virella: { Iron: 30, Copper: 32, Cobalt: 74, "Crystal Shards": 120 },
              Nyxara: { Iron: 24, Copper: 50, Cobalt: 62, "Crystal Shards": 145 }
            };
            const slugs = { "Asteron Prime": "asteron", Virella: "virella", Nyxara: "nyxara" };
            const resourceSlugs = { crystal_shards: "crystal" };
            return resources.flatMap((resource) => Object.keys(prices).flatMap((buyNode) => {
              return Object.keys(prices).filter((sellNode) => sellNode !== buyNode).map((sellNode) => ({
                offerId: `staging-${resourceSlugs[resource.resourceId] || resource.resourceId.replace(/_/g, "-")}-${slugs[buyNode]}-${slugs[sellNode]}`,
                resourceId: resource.resourceId,
                resourceName: resource.resourceName,
                buyNode,
                sellNode,
                buyPrice: prices[buyNode][resource.resourceName],
                sellPrice: prices[sellNode][resource.resourceName],
                maxQuantity: 1000
              }));
            }));
          })()
        }
      });
      window.eval(`
        currentNode = "Virella";
        lastPlanetNode = "Virella";
        credits = 9892;
        cargo.Iron = 6;
        cargoCostBasis.Iron = 18;
        activeTradeRoute = {
          id: "staging-trade-staging-iron-asteron-virella",
          type: "trade",
          marketTrade: true,
          stagingTrade: true,
          good: "Iron",
          origin: "Asteron Prime",
          destination: "Virella",
          buyPrice: 18,
          sellPrice: 30,
          profitPerUnit: 12,
          maxUnits: 6,
          purchasedUnits: 6,
          realizedProfit: 0,
          status: "active"
        };
        activeObjective = createTradeObjective(activeTradeRoute);
        playerProgress = normalizePlayerProgress({ combatXp: 0, totals: {} });
        selectedMarketResource = "Iron";
        selectedMarketTargetPlanet = "Virella";
        selectedMarketQuantity = 6;
      `);
      if (typeof window.renderMarketplace === "function") window.renderMarketplace();
    });

    await expect(page.locator("#marketScreen")).toContainText("Sell Cargo");
    await expect(page.locator("#marketScreen")).toContainText(/Asteron Prime > Virella/);
    await expect(page.locator("#marketScreen")).toContainText(/Sell 6 of 6 carried/);
    await expect(page.locator("#marketScreen")).toContainText("Sell Revenue");
    await expect(page.locator("#marketScreen")).toContainText("CR 180");
    await expect(page.locator("#marketScreen")).toContainText("+CR 72");
    await expect(page.locator("#marketScreen")).not.toContainText("Server Buy");
    await expect(page.locator("#marketScreen")).toContainText(/Sell applies to this pilot save immediately/);
    await expect(page.locator("#marketScreen")).not.toContainText("Dry run only");

    const sellMutation = await page.evaluate(() => window.eval(`
      (() => {
        sellMarketCargo();
        const creditsAfterFirstSell = credits;
        sellMarketCargo();
        const saved = JSON.parse(localStorage.getItem(STORAGE_GAME_KEY) || "{}");
        return {
          creditsAfterFirstSell,
          creditsAfterDoubleSell: credits,
          cargoIron: cargo.Iron || 0,
          activeTradeCleared: activeTradeRoute === null && activeObjective === null,
          tradeProfit: playerProgress.totals.tradeProfit || 0,
          tradesCompleted: playerProgress.totals.tradesCompleted || 0,
          savedCredits: saved.credits,
          savedCargoIron: saved.cargo?.Iron || 0,
          savedTradeProfit: saved.playerProgress?.totals?.tradeProfit || 0,
          savedActiveRoute: saved.activeTradeRoute
        };
      })()
    `));
    expect(sellMutation.creditsAfterFirstSell).toBe(10072);
    expect(sellMutation.creditsAfterDoubleSell).toBe(10072);
    expect(sellMutation.cargoIron).toBe(0);
    expect(sellMutation.activeTradeCleared).toBe(true);
    expect(sellMutation.tradeProfit).toBe(72);
    expect(sellMutation.tradesCompleted).toBe(1);
    expect(sellMutation.savedCredits).toBe(10072);
    expect(sellMutation.savedCargoIron).toBe(0);
    expect(sellMutation.savedTradeProfit).toBe(72);
    expect(sellMutation.savedActiveRoute).toBeNull();

    await page.evaluate(() => {
      window.eval(`
        currentNode = "Nyxara";
        lastPlanetNode = "Nyxara";
        cargo.Iron = 0;
        cargo["Crystal Shards"] = 64;
        cargoCostBasis["Crystal Shards"] = 95;
        selectedMarketResource = "Crystal Shards";
        selectedMarketTargetPlanet = "Nyxara";
        selectedMarketQuantity = 200;
      `);
      if (typeof window.renderMarketplace === "function") window.renderMarketplace();
    });

    await expect(page.locator("#marketScreen")).toContainText("Sell Cargo");
    await expect(page.locator("#marketScreen")).toContainText(/Asteron Prime > Nyxara/);
    await expect(page.locator("#marketScreen")).toContainText(/Sell 64 of 64 carried/);
    await expect(page.locator("#marketScreen")).toContainText("Sell Revenue");
    await expect(page.locator("#marketScreen")).toContainText("CR 9,280");
    await expect(page.locator("#marketScreen")).toContainText("+CR 3,200");
    await expect(page.locator("#marketScreen")).not.toContainText("Server Buy");

    await page.evaluate(() => {
      window.eval(`
        currentNode = "Nyxara";
        lastPlanetNode = "Nyxara";
        cargo.Iron = 0;
        cargo["Crystal Shards"] = 0;
        cargo.Copper = 0;
        if (typeof cargoRecovered === "object") delete cargoRecovered.Copper;
        delete cargoCostBasis.Copper;
        window.lupenStagingResourceAwardedKeys = new Set();
        applyStagingResourceMineResult({
          ok: true,
          resourceId: "e2e-copper-asteroid",
          resourceName: "Copper",
          cargoDelta: 24,
          resourceRewardId: "e2e-copper-recovered-award",
          receivedAt: Date.now()
        });
        selectedMarketResource = "Copper";
        selectedMarketTargetPlanet = "Nyxara";
        selectedMarketQuantity = 24;
      `);
      if (typeof window.renderMarketplace === "function") window.renderMarketplace();
    });

    const builder = page.locator("#marketScreen .market-builder-panel");
    await expect(builder).toContainText("Sell Cargo");
    await expect(builder).toContainText("Recovered resource");
    await expect(builder).toContainText("Recovered cargo");
    await expect(builder).toContainText(/Sell 24 of 24 carried/);
    await expect(builder).toContainText("Sell Revenue");
    await expect(builder).toContainText("CR 1,200");
    await expect(builder).toContainText("Recovered Value");
    await expect(builder).not.toContainText(/Virella > Nyxara/);
    await expect(page.locator("#activityLogFeed")).toContainText("Recovered 24 Copper. Cargo 24/");
    await expect(page.locator("#gameRewardBurst")).toContainText("Resource Recovered");
    await expect(page.locator("#gameRewardBurst")).toContainText("+24 Copper");
    await expect(page.locator("#gameRewardBurst")).toContainText("Cargo 24/");
    const resourceBurstStyle = await page.locator("#gameRewardBurst .game-reward-kicker").evaluate((el) => getComputedStyle(el).color);
    expect(resourceBurstStyle).toBe("rgb(52, 229, 154)");

    await page.evaluate(() => {
      if (typeof window.openShipStorageDrawer === "function") window.openShipStorageDrawer("cargo");
    });
    await expect(page.locator("#inventoryDrawerDetail")).toContainText("Copper");
    await expect(page.locator("#inventoryDrawerDetail")).toContainText("Source");
    await expect(page.locator("#inventoryDrawerDetail")).toContainText("Recovered");
    await expect(page.locator("#inventoryDrawerDetail")).toContainText("Avg Cost");
    await expect(page.locator("#inventoryDrawerDetail")).toContainText("None");

    const recoveredSell = await page.evaluate(() => window.eval(`
      (() => {
        const creditsBefore = credits;
        const tradeProfitBefore = playerProgress.totals.tradeProfit || 0;
        const totalTradingProfitBefore = playerProgress.totals.totalTradingProfit || 0;
        selectedMarketResource = "Copper";
        selectedMarketTargetPlanet = "Nyxara";
        selectedMarketQuantity = 24;
        currentNode = "Nyxara";
        lastPlanetNode = "Nyxara";
        sellMarketCargo();
        return {
          creditsBefore,
          creditsAfter: credits,
          cargoAfter: cargo.Copper || 0,
          cargoBasisAfter: cargoCostBasis.Copper || null,
          recoveredAfter: typeof getRecoveredCargoQuantity === "function" ? getRecoveredCargoQuantity("Copper") : 0,
          tradeProfitBefore,
          tradeProfitAfter: playerProgress.totals.tradeProfit || 0,
          totalTradingProfitBefore,
          totalTradingProfitAfter: playerProgress.totals.totalTradingProfit || 0,
          burstText: document.getElementById("tradeResultBurst")?.textContent || "",
          activityText: document.getElementById("activityLogFeed")?.textContent || ""
        };
      })()
    `));
    expect(recoveredSell.creditsAfter).toBe(recoveredSell.creditsBefore + 1200);
    expect(recoveredSell.cargoAfter).toBe(0);
    expect(recoveredSell.cargoBasisAfter).toBe(null);
    expect(recoveredSell.recoveredAfter).toBe(0);
    expect(recoveredSell.tradeProfitAfter).toBe(recoveredSell.tradeProfitBefore);
    expect(recoveredSell.totalTradingProfitAfter).toBe(recoveredSell.totalTradingProfitBefore);
    expect(recoveredSell.burstText).toContain("Recovered Cargo Sold");
    expect(recoveredSell.burstText).toContain("+CR 1,200 value");
    expect(recoveredSell.activityText).toContain("Recovered resource sale");

    const mixedRecoveredTradeSell = await page.evaluate(() => window.eval(`
      (() => {
        currentNode = "Nyxara";
        lastPlanetNode = "Nyxara";
        credits = 10000;
        cargo.Copper = 30;
        cargoRecovered.Copper = 12;
        cargoCostBasis.Copper = 38;
        playerProgress = normalizePlayerProgress({ combatXp: 0, totals: { tradeProfit: 0, totalTradingProfit: 0 } });
        activeTradeRoute = {
          id: "mixed-copper-route",
          type: "trade",
          marketTrade: true,
          stagingTrade: true,
          good: "Copper",
          origin: "Asteron Prime",
          destination: "Nyxara",
          buyPrice: 38,
          sellPrice: 50,
          profitPerUnit: 12,
          maxUnits: 18,
          purchasedUnits: 18,
          realizedProfit: 0,
          status: "active"
        };
        activeObjective = createTradeObjective(activeTradeRoute);
        selectedMarketResource = "Copper";
        selectedMarketTargetPlanet = "Nyxara";
        selectedMarketQuantity = 30;
        sellMarketCargo();
        const saved = JSON.parse(localStorage.getItem(STORAGE_GAME_KEY) || "{}");
        return {
          credits,
          cargoAfter: cargo.Copper || 0,
          recoveredAfter: typeof getRecoveredCargoQuantity === "function" ? getRecoveredCargoQuantity("Copper") : 0,
          cargoBasisAfter: cargoCostBasis.Copper || null,
          tradeProfit: playerProgress.totals.tradeProfit || 0,
          totalTradingProfit: playerProgress.totals.totalTradingProfit || 0,
          savedRecoveredAfter: saved.cargoRecovered?.Copper || 0,
          savedCargoAfter: saved.cargo?.Copper || 0,
          savedTradeProfit: saved.playerProgress?.totals?.tradeProfit || 0
        };
      })()
    `));
    expect(mixedRecoveredTradeSell.credits).toBe(11500);
    expect(mixedRecoveredTradeSell.cargoAfter).toBe(0);
    expect(mixedRecoveredTradeSell.recoveredAfter).toBe(0);
    expect(mixedRecoveredTradeSell.cargoBasisAfter).toBe(null);
    expect(mixedRecoveredTradeSell.tradeProfit).toBe(216);
    expect(mixedRecoveredTradeSell.totalTradingProfit).toBe(216);
    expect(mixedRecoveredTradeSell.savedRecoveredAfter).toBe(0);
    expect(mixedRecoveredTradeSell.savedCargoAfter).toBe(0);
    expect(mixedRecoveredTradeSell.savedTradeProfit).toBe(216);

    await page.evaluate(() => {
      if (typeof window.showMultiplayerStagingTradeSellFeedback === "function") {
        window.showMultiplayerStagingTradeSellFeedback({
          applied: true,
          operation: "sell",
          resourceName: "Iron",
          quantity: 310,
          revenue: 9300,
          creditsDelta: 9300,
          cargoDelta: -310,
          sellNode: "Virella",
          cargoCostBasisBefore: 15,
          recoveredResourceSale: false
        });
      }
    });
    await expect(page.locator("#tradeResultBurst")).toContainText("Trade Complete");
    await expect(page.locator("#tradeResultBurst")).toContainText("+CR 4,650");
    await expect(page.locator("#tradeResultBurst")).toContainText("Sold 310 Iron at Virella");

    await page.evaluate(() => {
      if (typeof window.showMultiplayerStagingTradeSellFeedback === "function") {
        window.showMultiplayerStagingTradeSellFeedback({
          applied: true,
          operation: "sell",
          resourceName: "Copper",
          quantity: 24,
          revenue: 1200,
          creditsDelta: 1200,
          cargoDelta: -24,
          sellNode: "Nyxara",
          cargoCostBasisBefore: null,
          recoveredResourceSale: true
        });
      }
    });
    await expect(page.locator("#tradeResultBurst")).toContainText("Recovered Cargo Sold");
    await expect(page.locator("#tradeResultBurst")).toContainText("+CR 1,200 value");
    await expect(page.locator("#tradeResultBurst")).toContainText("Sold 24 Copper at Nyxara");

    const recoveredProgress = await page.evaluate(() => window.eval(`({
      tradeProfit: playerProgress.totals.tradeProfit || 0,
      totalTradingProfit: playerProgress.totals.totalTradingProfit || 0
    })`));
    expect(recoveredProgress.tradeProfit).toBe(216);
    expect(recoveredProgress.totalTradingProfit).toBe(216);
    await expect(page.locator("#activityLogFeed")).toContainText("Recovered resource sale");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("multiplayer staging store shows server-backed purchase wording", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await expect(page.locator("#lupenMultiplayerStatusChip")).toContainText(/Staging/, { timeout: 15000 });

    await openStore(page);

    await expect(page.locator("#storeScreen")).toContainText(/Purchase|Validate|Purchase unavailable/);
    await expect(page.locator("#storeScreen")).not.toContainText(/Staging Purchase|Dry run only/i);
    await expect(page.locator("#storeScreen")).not.toContainText(/LF-2 Hauler/i);
    await expect(page.locator("#storeScreen")).toContainText(/Pulse Laser/i);
    await expect(page.locator("#storeScreen")).toContainText(/Ion Blaster/i);
    await expect(page.locator("#storeScreen")).toContainText(/Heavy Lance/i);
    await expect(page.locator("#storeScreen")).toContainText(/Cargo Pod/i);
    await expect(page.locator("#storeScreen")).toContainText(/Jump Drive/i);
    await expect(page.locator("#storeScreen")).not.toContainText(/Repeater|Ripper Gun|Melt Cannon|Void Rail|Shield Booster|Lupen Shard|Lupen Core|Materials/i);
    await expect(page.locator("#storeScreen")).toContainText(/Apply Cargo Pod|Cargo Pod equip preview|server-backed validation/i);
    await expect(page.locator("#storeScreen")).toContainText(/server-backed purchase validation|Purchase unavailable|Server-backed purchase/i);
    await expect(page.locator("#storeScreen")).not.toContainText("Buy / CR");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("multiplayer staging store purchase click applies confirmed gun ownership", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&debug=mp&mpServer=http://127.0.0.1:1");
    await expect(page.locator("#lupenMultiplayerStatusChip")).toContainText(/Staging/, { timeout: 15000 });

    await page.evaluate(() => window.eval(`
      (() => {
        currentNode = "Asteron Prime";
        lastPlanetNode = "Asteron Prime";
        credits = 10000;
        ownedGuns.pulseLaser = 0;
        playerProgress = normalizePlayerProgress({ combatXp: 2500, totals: {} });
        window.__stagingStoreTutorialEvents = [];
        const originalTutorialEvent = tutorialEvent;
        tutorialEvent = (eventName, detail = {}) => {
          window.__stagingStoreTutorialEvents.push(eventName);
          return originalTutorialEvent(eventName, detail);
        };

        const subscribers = [];
        const status = {
          enabled: true,
          isConnected: true,
          currentNode: "Asteron Prime",
          playerServerNode: "Asteron Prime",
          presenceStatus: "docked",
          lastStagingStoreItems: {
            ok: true,
            items: [{
              itemId: "gun:pulseLaser",
              name: "Pulse Laser",
              category: "weapon",
              localKind: "gun",
              localKey: "pulseLaser",
              price: 748,
              levelRequirement: 0,
              stockType: "fixed"
            }]
          },
          lastStagingStorePreview: {
            ok: true,
            mode: "dry_run",
            operation: "purchase",
            applied: false,
            itemId: "gun:pulseLaser",
            name: "Pulse Laser",
            category: "weapon",
            localKind: "gun",
            localKey: "pulseLaser",
            quantity: 1,
            unitPrice: 748,
            totalCost: 748,
            creditsBefore: 10000,
            creditsAfterPreview: 9252,
            itemBefore: 0,
            itemAfter: 1,
            wouldPass: true,
            validationMode: "trusted_save",
            trustedStateAvailable: true,
            snapshotUsed: false,
            receivedAt: Date.now()
          },
          lastStagingStorePurchase: null
        };

        window.__stagingStorePurchasePayloads = [];
        window.LupenMultiplayerClient = {
          getStatus: () => status,
          onServerState: (callback) => {
            subscribers.push(callback);
            return { unsubscribe: () => {} };
          },
          requestStagingStoreItems: () => true,
          previewStagingStorePurchase: () => true,
          sendMovementIntent: () => true,
          purchaseStagingStoreItem: (payload) => {
            window.__stagingStorePurchasePayloads.push({ ...payload });
            setTimeout(() => {
              status.lastStagingStorePurchase = {
                ok: true,
                mode: "store_write",
                operation: "purchase",
                applied: true,
                dryRun: false,
                itemId: "gun:pulseLaser",
                name: "Pulse Laser",
                category: "weapon",
                localKind: "gun",
                localKey: "pulseLaser",
                quantity: 1,
                unitPrice: 748,
                totalCost: 748,
                creditsBefore: 10000,
                creditsAfter: 9252,
                itemBefore: 0,
                itemAfter: 1,
                wouldPass: true,
                validationMode: "trusted_save",
                trustedStateAvailable: true,
                snapshotUsed: false,
                creditsWritten: true,
                weaponWritten: true,
                saveWritten: true,
                writes: { creditsWritten: true, weaponWritten: true, saveWritten: true },
                currentNode: "Asteron Prime",
                requestedNode: "Asteron Prime",
                presenceStatus: "docked",
                receivedAt: Date.now()
              };
              status.lastStagingStorePreview = status.lastStagingStorePurchase;
              subscribers.forEach(callback => callback({}));
            }, 120);
            return true;
          }
        };
      })()
    `));

    await openStore(page);
    await page.evaluate(() => window.eval(`selectStoreItem("gun:pulseLaser"); renderStore();`));
    await page.evaluate(() => window.eval(`window.__stagingStoreTutorialEvents = [];`));

    const before = await page.evaluate(() => window.eval(`({
      credits,
      ownedPulseLaser: ownedGuns.pulseLaser || 0,
      loadoutHasPulseLaser: getInventoryEntriesForCategory("guns").some(entry => entry.key === "pulseLaser" && entry.count > 0),
      tutorialEvents: [...(window.__stagingStoreTutorialEvents || [])]
    })`));

    await page.locator(".store-detail-buy-action[data-item-key='pulseLaser']").click();

    await page.waitForFunction(() => window.eval(`
      credits === 9252 && (ownedGuns.pulseLaser || 0) === 1
    `));

    const after = await page.evaluate(() => window.eval(`({
      credits,
      ownedPulseLaser: ownedGuns.pulseLaser || 0,
      loadoutHasPulseLaser: getInventoryEntriesForCategory("guns").some(entry => entry.key === "pulseLaser" && entry.count > 0),
      tutorialEvents: [...(window.__stagingStoreTutorialEvents || [])],
      payload: window.__stagingStorePurchasePayloads[0] || null,
      panelText: document.querySelector("#storeDetailPanel")?.textContent || ""
    })`));

    expect(before).toMatchObject({
      credits: 10000,
      ownedPulseLaser: 0,
      loadoutHasPulseLaser: false,
      tutorialEvents: []
    });
    expect(after.credits).toBe(9252);
    expect(after.ownedPulseLaser).toBe(1);
    expect(after.loadoutHasPulseLaser).toBe(true);
    expect(after.tutorialEvents).toContain("boughtStoreGun");
    expect(after.payload).toMatchObject({
      itemId: "gun:pulseLaser",
      quantity: 1,
      currentNode: "Asteron Prime",
      presenceStatus: "docked"
    });
    expect(after.panelText).toContain("Pulse Laser purchased");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("station store detail art stays centered and prominent", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await openStore(page);

    const measurements = await page.evaluate(async () => {
      const items = [
        ["cargoPod", "attachment:cargoPod"],
        ["jumpDrive", "attachment:jumpDrive"],
        ["ionBlaster", "gun:ionBlaster"],
        ["heavyLance", "gun:heavyLance"]
      ];
      const rows = [];
      for (const [key, id] of items) {
        window.selectStoreItem(id);
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const frame = document.querySelector(".store-detail-visual");
        const item = frame?.querySelector(".quality-fx__item, img");
        const button = document.querySelector(".store-detail-buy-action");
        const frameRect = frame?.getBoundingClientRect();
        const itemRect = item?.getBoundingClientRect();
        rows.push({
          key,
          frameHeight: frameRect?.height || 0,
          itemHeight: itemRect?.height || 0,
          offsetX: itemRect && frameRect ? Math.abs((itemRect.left + itemRect.width / 2) - (frameRect.left + frameRect.width / 2)) : 999,
          offsetY: itemRect && frameRect ? Math.abs((itemRect.top + itemRect.height / 2) - (frameRect.top + frameRect.height / 2)) : 999,
          actionText: button?.textContent?.trim() || "",
          actionDisabled: button?.disabled === true
        });
      }
      return rows;
    });

    for (const row of measurements) {
      expect(row.frameHeight, row.key).toBeGreaterThanOrEqual(145);
      expect(row.itemHeight, row.key).toBeGreaterThanOrEqual(110);
      expect(row.offsetX, row.key).toBeLessThanOrEqual(1);
      expect(row.offsetY, row.key).toBeLessThanOrEqual(1);
      expect(row.actionText, row.key).not.toBe("");
      expect(row.actionDisabled, row.key).toBe(false);
    }

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("hangar loadout shows selected-item actions without live writes", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await expect(page.locator("#lupenMultiplayerStatusChip")).toContainText(/Staging/, { timeout: 15000 });

    await openHangar(page);
    await expect(page.locator("#hangarOverviewSection")).toHaveClass(/active/);

    await expect(page.locator("#loadoutItemDetailPanel")).toContainText("Weapon 02");
    await expect(page.locator("#hangarScreen")).toContainText("Vault Equipment");
    await expect(page.locator("#hangarScreen")).toContainText("Selected Slot: Weapon 02");
    await expect(page.locator("#hangarScreen")).toContainText("Guns");
    await expect(page.locator("#hangarScreen")).toContainText("Attachments");
    await expect(page.locator("#hangarScreen")).not.toContainText("Total Slots");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("starter tutorial definitions match current progression loop", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await waitForGameGlobals(page);

    const tutorial = await page.evaluate(() => window.eval(`
      (() => {
        localStorage.clear();
        resetToNoShipStarterState();
        showScreen("gameScreen");
        startStarterTutorial(true);
        const steps = STARTER_TUTORIAL_STEPS.map(step => ({
          id: step.id,
          title: step.title,
          text: step.text,
          target: step.target,
          event: step.event,
          speaker: step.speaker || "",
          voiceCue: step.voiceCue || ""
        }));
        return {
          hasActiveShip: hasActiveShip(),
          ownedShips: ownedShips.slice(),
          currentShipId,
          firstTitle: document.getElementById("tutorialTitle")?.textContent || "",
          label: document.getElementById("tutorialStepLabel")?.textContent || "",
          steps
        };
      })()
    `));

    expect(tutorial.hasActiveShip).toBe(false);
    expect(tutorial.ownedShips).toEqual([]);
    expect(tutorial.currentShipId).toBe("");
    expect(tutorial.firstTitle).toBe("Welcome, Pilot");
    expect(tutorial.label).toContain("Station AI / Starter Pilot Programme");
    expect(tutorial.label).not.toMatch(/\d+\s*\/\s*\d+/);

    const stepById = Object.fromEntries(tutorial.steps.map(step => [step.id, step]));
    expect(stepById["buy-first-ship"]).toMatchObject({
      title: "Claim Azure Striker",
      target: "tutorial:firstShipBuy",
      event: "boughtFirstShip"
    });
    expect(stepById["buy-equipment"]).toMatchObject({
      title: "Buy first weapon",
      target: "tutorial:storePulseLaser",
      event: "boughtStoreGun"
    });
    expect(stepById["equip-item"]).toMatchObject({
      title: "Equip weapon",
      target: "tutorial:spareWeapon",
      event: "equippedItem"
    });
    expect(stepById["open-forge"]).toMatchObject({
      title: "Open Forge",
      event: "openedForge"
    });
    expect(stepById["forge-upgrade-weapon"]).toMatchObject({
      title: "Upgrade Pulse Laser",
      target: "tutorial:forgeUpgradeButton",
      event: "upgradedTutorialWeapon"
    });
    expect(stepById.complete.text).toContain("Combat Level 2");
    expect(stepById.complete.text).toContain("Buu Hauler");
    expect(stepById.complete.text).toContain("Nightshade Hawk");
    expect(stepById.complete.text).toContain("Forge");
    expect(stepById.complete.voiceCue).toBe("tutorial_outro_complete");

    const allCopy = tutorial.steps.map(step => `${step.title} ${step.text} ${step.target} ${step.event}`).join("\n");
    expect(allCopy).not.toMatch(/Falcon|LF-1 Origin|Evasion Matrix|boughtStoreEvasionMatrix|tutorial:storeEvasionMatrix|tutorial:spareAttachment/);
    expect(allCopy).toMatch(/Azure Striker|Buu Hauler|Nightshade Hawk|credits|XP|bounties|Forge/i);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("simple Forge upgrades owned gear with Lupen Shards only", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/");
    await waitForGameGlobals(page);

    await page.evaluate(() => window.eval(`
      (() => {
        localStorage.clear();
        currentShipId = "falcon";
        selectedHangarShipId = "falcon";
        ownedShips = ["falcon"];
        ownedAttachments.cargoPod = 1;
        ownedAttachments.jumpDrive = 1;
        ownedAttachments.shieldBooster = 1;
        ownedGuns.pulseLaser = 0;
        ownedGuns.ionBlaster = 1;
        inventoryItems = [
          ...Object.keys(attachments).map((key, index) => ({ id: \`forge-scroll-attachment-\${index}\`, key, quality: "standard", level: 1 })),
          ...Object.keys(GUNS)
            .filter(key => GUNS[key] && !GUNS[key].hiddenFromStore)
            .slice(0, 9)
            .map((key, index) => ({ id: \`forge-scroll-gun-\${index}\`, key, quality: "standard", level: 1 }))
        ];
        shipLoadouts = {
          falcon: normalizeShipLoadout({ attachments: [], guns: [makeLeveledLoadoutEntry("pulseLaser", "standard", 1)] }, "falcon")
        };
        upgradeMaterials = normalizeUpgradeMaterials({ lupenShards: 10 });
        currentNode = "Nyxara";
        lastPlanetNode = "Nyxara";
        selectedForgeItemId = "owned:attachments:cargoPod";
        openUpgradeForge();
      })()
    `));

    await expect(page.locator("#upgradeForgeScreen")).toHaveClass(/active/);
    await expect(page.locator("#upgradeForgeScreen")).toContainText("LUPEN FORGE");
    await expect(page.locator("#upgradeForgeScreen")).toContainText("Owned Items");
    await expect(page.locator("#upgradeForgeScreen")).toContainText("Upgrade Preview");
    await expect(page.locator("#upgradeForgeScreen")).toContainText("Lupen Shards");
    await expect(page.locator("#upgradeForgeScreen")).toContainText("Need 15 More Shards");
    await expect(page.locator("#upgradeForgeScreen")).not.toContainText(/Quality Upgrade|Lupen Core|Lupen Cores/);
    await expect(page.locator("#forgeStartBtn")).toBeDisabled();
    await expect(page.locator("#forgeSelectedPanel")).toBeVisible();

    const ownedListBefore = await page.locator("#forgeSelectedPanel").evaluate((list) => {
      const screen = document.getElementById("upgradeForgeScreen");
      return {
        scrollTop: list.scrollTop,
        clientHeight: list.clientHeight,
        scrollHeight: list.scrollHeight,
        overflowY: getComputedStyle(list).overflowY,
        screenScrollTop: screen?.scrollTop || 0,
        bottom: list.getBoundingClientRect().bottom,
        viewportHeight: window.innerHeight
      };
    });
    expect(ownedListBefore.scrollHeight).toBeGreaterThan(ownedListBefore.clientHeight + 20);
    expect(ownedListBefore.overflowY).toMatch(/auto|scroll/);
    expect(ownedListBefore.bottom).toBeLessThanOrEqual(ownedListBefore.viewportHeight);

    await page.locator("#forgeSelectedPanel").evaluate((list) => {
      list.scrollTop = list.scrollHeight;
    });
    const ownedListAfter = await page.locator("#forgeSelectedPanel").evaluate((list) => {
      const screen = document.getElementById("upgradeForgeScreen");
      return {
        scrollTop: list.scrollTop,
        screenScrollTop: screen?.scrollTop || 0,
        documentScrollTop: document.scrollingElement?.scrollTop || 0
      };
    });
    expect(ownedListAfter.scrollTop).toBeGreaterThan(0);
    expect(ownedListAfter.screenScrollTop).toBe(ownedListBefore.screenScrollTop);
    expect(ownedListAfter.documentScrollTop).toBe(0);

    const scrolledItem = page.locator("#forgeSelectedPanel .forge-owned-item").last();
    await scrolledItem.click();
    await expect(scrolledItem).toHaveClass(/selected/);
    const scrolledSelection = await page.evaluate(() => ({
      selectedForgeItemId,
      imageAlt: document.getElementById("forgePreviewImage")?.alt || "",
      previewTitle: document.querySelector("#forgeMaterialsList .forge-map1-preview h3")?.textContent?.trim() || "",
      screenScrollTop: document.getElementById("upgradeForgeScreen")?.scrollTop || 0
    }));
    expect(scrolledSelection.selectedForgeItemId).not.toBe("owned:attachments:cargoPod");
    expect(scrolledSelection.previewTitle).toBeTruthy();
    expect(scrolledSelection.imageAlt).toBe(scrolledSelection.previewTitle);
    expect(scrolledSelection.screenScrollTop).toBe(0);

    await page.locator("#forgeSelectedPanel").evaluate((list) => {
      list.scrollTop = 0;
    });
    await page.locator("#forgeSelectedPanel .forge-owned-item").first().click();
    await page.locator("#upgradeForgeScreen").screenshot({ path: "artifacts/forge-ui-final.png" });
    await page.locator("#upgradeForgeScreen").screenshot({ path: "artifacts/forge-style-aligned.png" });

    await page.evaluate(() => window.eval(`
      shipLoadouts.falcon.guns[0] = makeLeveledLoadoutEntry("pulseLaser", "standard", 1);
      upgradeMaterials = normalizeUpgradeMaterials({ lupenShards: 25 });
      selectedForgeItemId = "equipped:falcon:guns:0";
      renderUpgradeForge();
    `));
    await expect(page.locator("#forgeStartBtn")).toBeEnabled();
    await page.locator("#forgeStartBtn").click();
    await page.waitForFunction(() => window.eval(`getEquipmentLevel(shipLoadouts.falcon.guns[0]) === 2 && upgradeMaterials.lupenShards === 0`), null, { timeout: 5000 });

    const upgraded = await page.evaluate(() => window.eval(`({
      level: getEquipmentLevel(shipLoadouts.falcon.guns[0]),
      shards: upgradeMaterials.lupenShards,
      previewText: document.querySelector("#upgradeForgeScreen")?.textContent || ""
    })`));
    expect(upgraded.level).toBe(2);
    expect(upgraded.shards).toBe(0);
    expect(upgraded.previewText).toContain("Level II");
    expect(upgraded.previewText).toContain("Not enough Lupen Shards");

    await page.evaluate(() => window.eval(`
      shipLoadouts.falcon.guns[0] = makeLeveledLoadoutEntry("pulseLaser", "standard", 3);
      upgradeMaterials = normalizeUpgradeMaterials({ lupenShards: 100 });
      renderUpgradeForge();
    `));
    await expect(page.locator("#forgeStatePreview")).toContainText("Item is already max level for Map 1.");
    await expect(page.locator("#forgeStartBtn")).toBeDisabled();

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("asteroid depletion keeps resource cargo and can award Lupen Shards", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await waitForGameGlobals(page);

    const state = await page.evaluate(() => window.eval(`
      (() => {
        localStorage.clear();
        currentNode = "Lower Apex";
        lastPlanetNode = "Nyxara";
        mineralKeys.forEach(key => { cargo[key] = 0; });
        upgradeMaterials = normalizeUpgradeMaterials({ lupenShards: 0 });
        window.__forceAsteroidShardReward = 2;
        const drops = generateLootFromAsteroid({ resource: "Iron", dropMin: 3, dropMax: 3 });
        const cargoResult = depositLootToCargo(drops);
        const localShardDelta = awardAsteroidShardBonus(getAsteroidShardReward({ resource: "Iron" }), "Iron asteroid");
        delete window.__forceAsteroidShardReward;

        const stagingResult = applyStagingResourceMineResult({
          ok: true,
          resourceId: "staging-resource-test",
          resourceName: "Copper",
          cargoDelta: 4,
          lupenShardDelta: 1,
          resourceRewardId: "staging-resource-test:1",
          depletedUntil: Date.now() + 1000,
          receivedAt: Date.now()
        });

        return {
          iron: cargo.Iron,
          copper: cargo.Copper,
          cargoCollected: cargoResult.collectedAmount,
          localShardDelta,
          stagingApplied: stagingResult.applied,
          stagingShardDelta: stagingResult.lupenShardDelta,
          shards: upgradeMaterials.lupenShards
        };
      })()
    `));

    expect(state).toMatchObject({
      iron: 3,
      copper: 4,
      cargoCollected: 3,
      localShardDelta: 2,
      stagingApplied: true,
      stagingShardDelta: 1,
      shards: 3
    });

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("Map 1 bounties track bot types and reward credits plus shards without XP", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await waitForGameGlobals(page);

    const state = await page.evaluate(() => window.eval(`
      (() => {
        localStorage.clear();
        currentNode = "Lower Apex";
        lastPlanetNode = "Nyxara";
        credits = 100;
        upgradeMaterials = normalizeUpgradeMaterials({ lupenShards: 10 });
        playerProgress = normalizePlayerProgress({ combatXp: 45, zoneCombatXp: { "sector-one": 45 } });
        activeObjective = null;
        activeBountyId = null;
        dailyBountyDate = "";
        dailyBountyContracts = [];
        ensureDailyBounties();

        const names = dailyBountyContracts.map(contract => contract.title);
        const rewards = Object.fromEntries(dailyBountyContracts.map(contract => [
          contract.id,
          {
            credits: contract.reward.credits,
            xp: contract.reward.xp,
            lupenShards: contract.reward.lupenShards,
            targetBotType: contract.targetBotType,
            requiredKills: contract.requiredKills
          }
        ]));

        acceptBountyContract("hunter-clearance");
        trackBountyBotKill({ id: "attacker-1", botType: "attacker", faction: "erebus", displayName: "Erebus Attacker", node: "Lower Apex" });
        const hunterAfterMismatch = activeObjective?.kills || 0;
        trackBountyBotKill({ id: "hunter-1", botType: "hunter", faction: "erebus", displayName: "Erebus Hunter", node: "Lower Apex" });
        const hunterAfterMatch = activeObjective?.kills || 0;
        getBountyContract("hunter-clearance").status = "available";
        getBountyContract("hunter-clearance").progress = 0;
        activeObjective = null;
        activeBountyId = null;

        acceptBountyContract("erebus-patrol-sweep");
        trackBountyBotKill({ id: "behemoth-any-1", botType: "behemoth", faction: "erebus", displayName: "Erebus Behemoth", node: "Lower Apex" });
        const anyAfterBehemoth = activeObjective?.kills || 0;
        getBountyContract("erebus-patrol-sweep").status = "available";
        getBountyContract("erebus-patrol-sweep").progress = 0;
        activeObjective = null;
        activeBountyId = null;

        acceptBountyContract("behemoth-warning");
        trackBountyBotKill({ id: "destroyer-1", botType: "destroyer", faction: "erebus", displayName: "Erebus Destroyer", node: "Lower Apex" });
        const behemothAfterMismatch = activeObjective?.kills || 0;
        trackBountyBotKill({ id: "behemoth-1", botType: "behemoth", faction: "erebus", displayName: "Erebus Behemoth", node: "Lower Apex" });
        const behemothReady = getBountyContract("behemoth-warning")?.status;
        const xpBeforeClaim = playerProgress.combatXp;
        const creditsBeforeClaim = credits;
        const shardsBeforeClaim = upgradeMaterials.lupenShards;
        claimBountyReward("behemoth-warning");
        const claimedStatus = getBountyContract("behemoth-warning")?.status || "";
        openUpgradeForge();
        const forgeText = document.getElementById("upgradeForgeScreen")?.textContent || "";

        const resetContract = getBountyContract("hunter-clearance");
        resetContract.status = "readyToClaim";
        resetContract.progress = resetContract.requiredKills;
        dailyBountyDate = "1999-01-01";
        ensureDailyBounties();
        const resetStatuses = dailyBountyContracts.map(contract => contract.status);

        acceptBountyContract("timed-suppression");
        const timedAccepted = getBountyContract("timed-suppression");
        const timedLimitSeconds = timedAccepted.timeLimitSeconds;
        const timedHasExpiry = Number(timedAccepted.expiresAt || 0) > Date.now();
        timedAccepted.expiresAt = Date.now() - 1000;
        updateActiveBountyTimers();
        const timedFailed = getBountyContract("timed-suppression")?.status;

        return {
          names,
          rewards,
          hunterAfterMismatch,
          hunterAfterMatch,
          anyAfterBehemoth,
          behemothAfterMismatch,
          behemothReady,
          creditsDelta: credits - creditsBeforeClaim,
          shardDelta: upgradeMaterials.lupenShards - shardsBeforeClaim,
          xpDelta: playerProgress.combatXp - xpBeforeClaim,
          forgeText,
          claimedStatus,
          resetStatuses,
          timedLimitSeconds,
          timedHasExpiry,
          timedFailed,
          boardCopy: document.getElementById("bountyScreen")?.textContent || ""
        };
      })()
    `));

    expect(state.names).toEqual([
      "Erebus Patrol Sweep",
      "Hunter Clearance",
      "Timed Suppression",
      "Behemoth Warning"
    ]);
    expect(state.rewards["erebus-patrol-sweep"]).toMatchObject({ credits: 900, xp: 0, lupenShards: 2, targetBotType: "any", requiredKills: 4 });
    expect(state.rewards["hunter-clearance"]).toMatchObject({ credits: 1100, xp: 0, lupenShards: 3, targetBotType: "hunter", requiredKills: 4 });
    expect(state.rewards["timed-suppression"]).toMatchObject({ credits: 1500, xp: 0, lupenShards: 4, targetBotType: "any", requiredKills: 4 });
    expect(state.rewards["behemoth-warning"]).toMatchObject({ credits: 2500, xp: 0, lupenShards: 8, targetBotType: "behemoth", requiredKills: 1 });
    expect(state.hunterAfterMismatch).toBe(0);
    expect(state.hunterAfterMatch).toBe(1);
    expect(state.anyAfterBehemoth).toBe(1);
    expect(state.behemothAfterMismatch).toBe(0);
    expect(state.behemothReady).toBe("readyToClaim");
    expect(state.creditsDelta).toBe(2500);
    expect(state.shardDelta).toBe(8);
    expect(state.xpDelta).toBe(0);
    expect(state.claimedStatus).toBe("claimed");
    expect(state.resetStatuses.every(status => status === "available")).toBe(true);
    expect(state.timedLimitSeconds).toBe(240);
    expect(state.timedHasExpiry).toBe(true);
    expect(state.timedFailed).toBe("failed");
    expect(state.forgeText).toContain("Lupen Shards");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("audits live boot and fresh starter tutorial state", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await waitForGameGlobals(page);

    const audit = await page.evaluate(() => window.eval(`
      (() => {
        const boot = {
          ship: currentShipId,
          ownedShips: ownedShips.slice(),
          guns: (shipLoadouts[STARTER_SHIP_ID]?.guns || []).map(entry => getEquipmentKey(entry)),
          attachments: (shipLoadouts[STARTER_SHIP_ID]?.attachments || []).map(entry => getEquipmentKey(entry)),
          ownedPulseLaser: ownedGuns.pulseLaser || 0,
          ownedCargoPod: ownedAttachments.cargoPod || 0,
          ownedJumpDrive: ownedAttachments.jumpDrive || 0,
          credits,
          cargoUsed: cargoUsed(),
          currentNode,
          tutorialState: { ...tutorialState }
        };
        resetToNoShipStarterState();
        const fresh = {
          ship: currentShipId,
          ownedShips: ownedShips.slice(),
          selectedShipyardShipId,
          shipLoadouts: { ...shipLoadouts },
          ownedPulseLaser: ownedGuns.pulseLaser || 0,
          ownedCargoPod: ownedAttachments.cargoPod || 0,
          ownedJumpDrive: ownedAttachments.jumpDrive || 0,
          credits,
          cargoUsed: cargoUsed(),
          currentNode
        };
        return { boot, fresh };
      })()
    `));

    expect(audit.boot.ship).toBe("falcon");
    expect(audit.boot.ownedShips).toContain("falcon");
    expect(audit.boot.guns).toContain("pulseLaser");
    expect(audit.boot.credits).toBe(10000);
    expect(audit.boot.currentNode).toBe("Asteron Prime");

    expect(audit.fresh.ship).toBe("");
    expect(audit.fresh.ownedShips).toEqual([]);
    expect(audit.fresh.selectedShipyardShipId).toBe("falcon");
    expect(audit.fresh.ownedPulseLaser).toBe(0);
    expect(audit.fresh.ownedCargoPod).toBe(0);
    expect(audit.fresh.ownedJumpDrive).toBe(0);
    expect(audit.fresh.credits).toBe(10000);
    expect(audit.fresh.cargoUsed).toBe(0);
    expect(audit.fresh.currentNode).toBe("Asteron Prime");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("staging tutorial reset stays inactive and manual launch starts the programme", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await waitForGameGlobals(page);
    await page.evaluate(() => {
      window.eval(`
        credits = 32100;
        currentShipId = "falcon";
        selectedHangarShipId = "falcon";
        selectedFleetShipId = "falcon";
        selectedShipyardShipId = "falcon";
        ownedShips = ["falcon"];
        shipLoadouts = { falcon: normalizeShipLoadout({ attachments: [], guns: [] }, "falcon") };
        saveGame();
      `);
      localStorage.setItem("lupenStarterPilotTutorial", JSON.stringify({ active: false, completed: true, stepIndex: 99 }));
      localStorage.setItem("sb-ylzglwiehkypetcdkqxd-auth-token", "keep-auth");
    });

    await page.goto("/?mp=staging&resetTutorial=1");
    await waitForGameGlobals(page);
    await page.evaluate(() => {
      window.showScreen("gameScreen");
      window.eval("renderStarterTutorial();");
    });

    const urlReset = await page.evaluate(() => ({
      href: window.location.href,
      helperType: typeof window.lupenResetTutorial,
      startHelperType: typeof window.lupenStartTutorial,
      replayHelperType: typeof window.lupenReplayTutorial,
      save: JSON.parse(localStorage.getItem("lupenGameState")),
      tutorial: JSON.parse(localStorage.getItem("lupenStarterPilotTutorial")),
      auth: localStorage.getItem("sb-ylzglwiehkypetcdkqxd-auth-token"),
      overlayActive: document.getElementById("tutorialOverlay")?.classList.contains("active") || false
    }));

    expect(urlReset.href).not.toContain("resetTutorial=1");
    expect(urlReset.href).toContain("mp=staging");
    expect(urlReset.helperType).toBe("function");
    expect(urlReset.startHelperType).toBe("function");
    expect(urlReset.replayHelperType).toBe("function");
    expect(urlReset.save.credits).toBe(32100);
    expect(urlReset.auth).toBe("keep-auth");
    expect(urlReset.tutorial.active).toBe(false);
    expect(urlReset.tutorial.completed).toBe(false);
    expect(urlReset.tutorial.stepIndex).toBe(0);
    expect(urlReset.overlayActive).toBe(false);

    await page.goto("/?mp=staging&startTutorial=1");
    await waitForGameGlobals(page);
    await page.evaluate(() => {
      window.showScreen("gameScreen");
      window.eval("renderStarterTutorial();");
    });

    const urlStart = await page.evaluate(() => ({
      href: window.location.href,
      tutorial: JSON.parse(localStorage.getItem("lupenStarterPilotTutorial")),
      title: document.getElementById("tutorialTitle")?.textContent || "",
      overlayActive: document.getElementById("tutorialOverlay")?.classList.contains("active") || false
    }));

    expect(urlStart.href).toContain("mp=staging");
    expect(urlStart.href).not.toContain("startTutorial=1");
    expect(urlStart.tutorial.active).toBe(true);
    expect(urlStart.tutorial.completed).toBe(false);
    expect(urlStart.tutorial.stepIndex).toBe(0);
    expect(urlStart.title).toBe("Welcome, Pilot");
    expect(urlStart.overlayActive).toBe(true);

    const helperReset = await page.evaluate(() => {
      window.eval(`
        tutorialState = { active: false, completed: true, stepIndex: 8, lastStartedAt: "old" };
        saveTutorialState();
      `);
      return window.lupenResetTutorial();
    });
    expect(helperReset).toMatchObject({ tutorialKeyCleared: "lupenStarterPilotTutorial", resetProgress: false, started: false });
    await expect(page.evaluate(() => JSON.parse(localStorage.getItem("lupenStarterPilotTutorial")).active)).resolves.toBe(false);

    const helperStart = await page.evaluate(() => {
      window.showScreen("gameScreen");
      return window.lupenStartTutorial();
    });
    expect(helperStart).toMatchObject({ started: true, step: "welcome-new-pilot" });
    await expect(page.evaluate(() => JSON.parse(localStorage.getItem("lupenStarterPilotTutorial")).active)).resolves.toBe(true);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("Vessel Exchange starter ship CTA is visible for the tutorial claim step", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await waitForGameGlobals(page);

    await page.evaluate(() => window.eval(`
      localStorage.clear();
      resetToNoShipStarterState();
      saveGame();
    `));
    await page.reload();
    await waitForGameGlobals(page);

    const cta = await page.evaluate(() => window.eval(`
      (() => {
        showScreen("gameScreen");
        openHangar();
        showHangarSection("shipyard");
        startStarterTutorial(true);
        setTutorialStepById("buy-first-ship");
        selectedShipyardShipId = STARTER_SHIP_ID;
        renderShipShop();
        renderShipyardDetail();
        renderStarterTutorial();
        const button = document.querySelector("#shipyardDetailPanel .buy-ship-action[data-tutorial-target='firstShipBuy']");
        const panel = document.querySelector("#shipyardDetailPanel");
        const buttonRect = button?.getBoundingClientRect();
        const panelRect = panel?.getBoundingClientRect();
        const visibleShipNames = Array.from(document.querySelectorAll(".vessel-exchange-card .fleet-card-name")).map(node => node.textContent.trim());
        const lockedShipNames = Array.from(document.querySelectorAll(".vessel-exchange-card.progression-locked .fleet-card-name")).map(node => node.textContent.trim());
        return {
          text: button?.textContent?.trim() || "",
          visible: Boolean(button && button.offsetParent !== null),
          disabled: Boolean(button?.disabled),
          selectedShipName: SHIPS[selectedShipyardShipId]?.name || "",
          hasActiveShip: hasActiveShip(),
          currentShipId,
          ownedShips: ownedShips.slice(),
          insidePanel: Boolean(buttonRect && panelRect && buttonRect.bottom <= panelRect.bottom + 1 && buttonRect.top >= panelRect.top - 1),
          visibleShipNames,
          lockedShipNames
        };
      })()
    `));

    expect(cta.selectedShipName).toBe("Azure Striker");
    expect(cta.hasActiveShip).toBe(false);
    expect(cta.currentShipId).toBe("");
    expect(cta.ownedShips).toEqual([]);
    expect(cta.text).toBe("Claim Starter Ship");
    expect(cta.visible).toBe(true);
    expect(cta.disabled).toBe(false);
    expect(cta.insidePanel).toBe(true);
    expect(cta.visibleShipNames).toEqual(expect.arrayContaining(["Azure Striker", "Buu Hauler", "Nightshade Hawk"]));
    expect(cta.lockedShipNames).toEqual(expect.arrayContaining(["Buu Hauler", "Nightshade Hawk"]));

    await page.locator("#shipyardDetailPanel .buy-ship-action[data-tutorial-target='firstShipBuy']").click();
    await page.waitForFunction(() => window.eval("getCurrentTutorialStep().id") !== "buy-first-ship");

    const claimed = await page.evaluate(() => window.eval(`({
      currentShipId,
      ownsStarter: ownedShips.includes(STARTER_SHIP_ID),
      stepId: getCurrentTutorialStep().id
    })`));
    expect(claimed.currentShipId).toBe("falcon");
    expect(claimed.ownsStarter).toBe(true);
    expect(claimed.stepId).toBe("open-first-loadout");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("resetPilot staging starter claim CTA owns and activates Azure Striker without server purchase", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&resetPilot=1");
    await waitForGameGlobals(page);
    await page.waitForFunction(() => !window.location.href.includes("resetPilot=1"));

    await page.evaluate(() => window.eval(`
      showScreen("gameScreen");
      openHangar();
      showHangarSection("shipyard");
      startStarterTutorial(true);
      setTutorialStepById("buy-first-ship");
      selectedShipyardShipId = STARTER_SHIP_ID;
      renderShipShop();
      renderShipyardDetail();
      renderStarterTutorial();
    `));

    await expect(page.locator("#shipyardDetailPanel .buy-ship-action[data-tutorial-target='firstShipBuy']")).toHaveText("Claim Starter Ship");
    await expect(page.locator("#shipyardDetailPanel .shipyard-price-action")).toHaveText("Free Starter Hull");
    await page.locator("#shipyardDetailPanel .buy-ship-action[data-tutorial-target='firstShipBuy']").click();
    await page.waitForFunction(() => window.eval("getCurrentTutorialStep().id") === "open-first-loadout");

    const claim = await page.evaluate(() => window.eval(`({
      currentShipId,
      ownsStarter: ownedShips.includes(STARTER_SHIP_ID),
      loadout: shipLoadouts[STARTER_SHIP_ID],
      condition: shipConditions[STARTER_SHIP_ID],
      hull,
      shield,
      credits,
      stepId: getCurrentTutorialStep().id,
      saved: JSON.parse(localStorage.getItem("lupenGameState"))
    })`));

    expect(claim.currentShipId).toBe("falcon");
    expect(claim.ownsStarter).toBe(true);
    expect(claim.loadout).toMatchObject({ guns: [], attachments: [] });
    expect(claim.condition.hull).toBeGreaterThan(0);
    expect(claim.condition.shield).toBeGreaterThan(0);
    expect(claim.hull).toBeGreaterThan(0);
    expect(claim.shield).toBeGreaterThan(0);
    expect(claim.credits).toBe(10000);
    expect(claim.stepId).toBe("open-first-loadout");
    expect(claim.saved.currentShipId).toBe("falcon");
    expect(claim.saved.ownedShips).toContain("falcon");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("starter claim tolerates missing ownership and loadout containers", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging");
    await waitForGameGlobals(page);

    await page.evaluate(() => window.eval(`
      (() => {
        localStorage.clear();
        resetToNoShipStarterState();
        ownedShips = null;
        shipLoadouts = null;
        shipConditions = null;
        showScreen("gameScreen");
        startStarterTutorial(true);
        setTutorialStepById("buy-first-ship");
        buyShip(STARTER_SHIP_ID);
      })()
    `));
    await page.waitForFunction(() => window.eval("getCurrentTutorialStep().id") === "open-first-loadout");

    const claim = await page.evaluate(() => window.eval(`
      (() => {
        return {
          currentShipId,
          ownedShips,
          loadout: shipLoadouts[STARTER_SHIP_ID],
          condition: shipConditions[STARTER_SHIP_ID],
          stepId: getCurrentTutorialStep().id
        };
      })()
    `));

    expect(claim.currentShipId).toBe("falcon");
    expect(claim.ownedShips).toEqual(["falcon"]);
    expect(claim.loadout).toMatchObject({ guns: [], attachments: [] });
    expect(claim.condition.hull).toBeGreaterThan(0);
    expect(claim.stepId).toBe("open-first-loadout");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("starter claim step advances gracefully when Azure Striker is already active", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await waitForGameGlobals(page);
    await page.evaluate(() => window.eval(`
      localStorage.clear();
      currentShipId = STARTER_SHIP_ID;
      selectedHangarShipId = STARTER_SHIP_ID;
      selectedFleetShipId = STARTER_SHIP_ID;
      selectedShipyardShipId = STARTER_SHIP_ID;
      ownedShips = [STARTER_SHIP_ID];
      shipLoadouts = { [STARTER_SHIP_ID]: normalizeShipLoadout({ attachments: [], guns: [] }, STARTER_SHIP_ID) };
      showScreen("gameScreen");
      openHangar();
      showHangarSection("shipyard");
      startStarterTutorial(true);
      setTutorialStepById("buy-first-ship");
    `));

    await page.waitForFunction(() => window.eval("getCurrentTutorialStep().id") !== "buy-first-ship");
    await expect(page.evaluate(() => window.eval("getCurrentTutorialStep().id"))).resolves.toBe("open-first-loadout");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("tutorial replay skips weapon purchase and equip when Pulse Laser is already mounted", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await waitForGameGlobals(page);
    await page.evaluate(() => window.eval(`
      localStorage.clear();
      currentShipId = STARTER_SHIP_ID;
      selectedHangarShipId = STARTER_SHIP_ID;
      selectedFleetShipId = STARTER_SHIP_ID;
      ownedShips = [STARTER_SHIP_ID];
      shipLoadouts = { [STARTER_SHIP_ID]: normalizeShipLoadout({ attachments: [], guns: ["pulseLaser", "pulseLaser"] }, STARTER_SHIP_ID) };
      ownedGuns.pulseLaser = 0;
      showScreen("gameScreen");
      startStarterTutorial(true);
      setTutorialStepById("open-store");
    `));

    await page.waitForFunction(() => window.eval("getCurrentTutorialStep().id") === "open-bounty");
    await expect(page.evaluate(() => window.eval("getCurrentTutorialStep().id"))).resolves.toBe("open-bounty");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("first trade tutorial path buys and sells guaranteed Iron route in staging", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await waitForGameGlobals(page);

    const tradeBuy = await page.evaluate(() => window.eval(`
      (() => {
        localStorage.clear();
        currentShipId = STARTER_SHIP_ID;
        selectedHangarShipId = STARTER_SHIP_ID;
        selectedFleetShipId = STARTER_SHIP_ID;
        ownedShips = [STARTER_SHIP_ID];
        shipLoadouts = { [STARTER_SHIP_ID]: normalizeShipLoadout({ attachments: [], guns: ["pulseLaser"] }, STARTER_SHIP_ID) };
        credits = 10000;
        currentNode = "Asteron Prime";
        lastPlanetNode = "Asteron Prime";
        activeTradeRoute = null;
        activeObjective = null;
        playerProgress = normalizePlayerProgress({ combatXp: 0, totals: {} });
        mineralKeys.forEach(key => { cargo[key] = 0; });
        cargoCostBasis = {};
        showScreen("gameScreen");
        openMarketplace();
        startStarterTutorial(true);
        setTutorialStepById("select-market-resource");
        const resourceTargetExists = Boolean(document.querySelector("[data-tutorial-target='marketResourceIron']"));
        setMarketResource("Iron");
        setTutorialStepById("select-market-target");
        const targetTargetExists = Boolean(document.querySelector("[data-tutorial-target='marketRouteCard']"));
        selectMarketRouteDestination("Virella");
        setTutorialStepById("buy-cargo");
        loadMarketRouteCargo("Virella");
        const route = { ...activeTradeRoute };
        return {
          resourceTargetExists,
          targetTargetExists,
          maxQuantity: selectedMarketQuantity,
          route,
          creditsAfterBuy: credits,
          cargoAfterBuy: cargo[route.good] || 0,
          buyStep: getCurrentTutorialStep().id
        };
      })()
    `));
    await page.waitForFunction(() => window.eval("getCurrentTutorialStep().id") === "return-to-station-for-launch");
    await expect(page.locator("#marketScreen")).not.toContainText("Server Buy");

    const arrivalState = await page.evaluate(() => window.eval(`
      (() => {
        const route = { ...activeTradeRoute };
        showScreen("spaceScreen");
        setTutorialStepById("make-jump");
        ["West Link 2", "West Link 1", route.destination].forEach(node => {
          jumpCharge = jumpMax;
          jumpToNode(node);
        });
        renderStarterTutorial();
        return {
          currentNode,
          screen: document.querySelector("section.active")?.id || "",
          step: getCurrentTutorialStep().id
        };
      })()
    `));
    await page.waitForFunction(() => window.eval("getCurrentTutorialStep().id") === "land-destination");

    const landingState = await page.evaluate(() => window.eval(`
      (() => {
        updateCurrentNodeUI();
        renderStarterTutorial();
        const beforeStep = getCurrentTutorialStep().id;
        const landTarget = document.querySelector("#planetLandBtn");
        const highlighted = landTarget?.classList.contains("tutorial-highlight-target") || false;
        const visible = landTarget && !landTarget.hidden && getComputedStyle(landTarget).display !== "none";
        const label = getComputedStyle(landTarget, "::after").content || "";
        const clickable = document.elementFromPoint(
          landTarget.getBoundingClientRect().left + (landTarget.getBoundingClientRect().width / 2),
          landTarget.getBoundingClientRect().top + (landTarget.getBoundingClientRect().height / 2)
        )?.closest?.("#planetLandBtn")?.id === "planetLandBtn";
        jumpCharge = jumpMax;
        openSectorMap();
        const virellaNode = document.querySelector("#sectorSvg [data-node='Virella']");
        const mapNodeExists = Boolean(virellaNode);
        virellaNode?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        return {
          beforeStep,
          highlighted,
          visible,
          label,
          clickable,
          mapNodeExists,
          currentScreenLanded: document.getElementById("gameScreen")?.classList.contains("active") || false
        };
      })()
    `));
    await page.waitForFunction(() => ["open-trade-to-sell", "sell-cargo"].includes(window.eval("getCurrentTutorialStep().id")));

    const terminalHighlightState = await page.evaluate(() => window.eval(`
      (() => {
        renderStarterTutorial();
        const terminal = document.querySelector("[data-tutorial-target='planetTradeTerminal']");
        return {
          step: getCurrentTutorialStep().id,
          exists: Boolean(terminal),
          highlighted: terminal?.classList.contains("tutorial-highlight-target") || false,
          text: terminal?.textContent || ""
        };
      })()
    `));

    const sellStepHomeHighlightState = await page.evaluate(() => window.eval(`
      (() => {
        setTutorialStepById("sell-cargo");
        renderStarterTutorial();
        const terminal = document.querySelector("[data-tutorial-target='planetTradeTerminal']");
        return {
          step: getCurrentTutorialStep().id,
          exists: Boolean(terminal),
          highlighted: terminal?.classList.contains("tutorial-highlight-target") || false,
          text: terminal?.textContent || "",
          screen: document.querySelector("section.active")?.id || ""
        };
      })()
    `));

    const tradeSell = await page.evaluate(() => window.eval(`
      (() => {
        const route = { ...activeTradeRoute };
        openMarketplace();
        const creditsBeforeSell = credits;
        const cargoBeforeSell = cargo[route.good] || 0;
        selectedMarketResource = route.good;
        selectedMarketTargetPlanet = route.destination;
        renderMarketplace();
        setTutorialStepById("sell-cargo");
        const sellButton = document.querySelector("[data-tutorial-target='sellCargo']");
        const buyButton = document.querySelector("[data-tutorial-target='buyCargo']");
        const terminal = document.querySelector("[data-tutorial-target='planetTradeTerminal']");
        const sellButtonHighlightedInTerminal = sellButton?.classList.contains("tutorial-highlight-target") || false;
        const terminalHighlightedInTerminal = terminal?.classList.contains("tutorial-highlight-target") || false;
        const builderText = document.querySelector(".market-builder-panel")?.textContent || "";
        sellMarketCargo();
        const creditsAfterFirstSell = credits;
        sellMarketCargo();
        return {
          route,
          sellButtonPresent: Boolean(sellButton),
          sellButtonDisabled: Boolean(sellButton?.disabled),
          sellButtonHighlightedInTerminal,
          terminalHighlightedInTerminal,
          buyButtonPresent: Boolean(buyButton),
          builderText,
          creditsBeforeSell,
          creditsAfterFirstSell,
          creditsAfterDoubleSell: credits,
          cargoBeforeSell,
          cargoAfterSell: cargo[route.good] || 0,
          activeTradeCleared: activeTradeRoute === null && activeObjective === null,
          tradeProfit: playerProgress.totals.tradeProfit || 0,
          tradesCompleted: playerProgress.totals.tradesCompleted || 0,
          finalStep: getCurrentTutorialStep().id
        };
      })()
    `));
    await page.waitForFunction(() => ["return-after-trade", "open-bounty"].includes(window.eval("getCurrentTutorialStep().id")));
    const finalStep = await page.evaluate(() => window.eval("getCurrentTutorialStep().id"));

    expect(tradeBuy.resourceTargetExists).toBe(true);
    expect(tradeBuy.targetTargetExists).toBe(true);
    expect(tradeBuy.maxQuantity).toBeGreaterThan(0);
    expect(tradeBuy.cargoAfterBuy).toBeGreaterThan(0);
    expect(tradeBuy.creditsAfterBuy).toBeLessThan(10000);
    expect(tradeBuy.route.good).toBe("Iron");
    expect(tradeBuy.route.origin).toBe("Asteron Prime");
    expect(tradeBuy.route.destination).toBe("Virella");
    expect(tradeBuy.route.tutorialTrade).toBe(true);
    expect(arrivalState.currentNode).toBe("Virella");
    expect(arrivalState.screen).toBe("spaceScreen");
    expect(arrivalState.step).toBe("land-destination");
    expect(landingState.beforeStep).toBe("land-destination");
    expect(landingState.highlighted).toBe(true);
    expect(landingState.visible).toBe(true);
    expect(landingState.label).toContain("LAND");
    expect(landingState.clickable).toBe(true);
    expect(landingState.mapNodeExists).toBe(true);
    expect(landingState.currentScreenLanded).toBe(true);
    expect(["open-trade-to-sell", "sell-cargo"]).toContain(terminalHighlightState.step);
    expect(terminalHighlightState.exists).toBe(true);
    expect(terminalHighlightState.highlighted).toBe(true);
    expect(terminalHighlightState.text).toContain("Trade");
    expect(sellStepHomeHighlightState.step).toBe("sell-cargo");
    expect(sellStepHomeHighlightState.screen).toBe("gameScreen");
    expect(sellStepHomeHighlightState.exists).toBe(true);
    expect(sellStepHomeHighlightState.highlighted).toBe(true);
    expect(sellStepHomeHighlightState.text).toContain("Trade");
    expect(tradeSell.sellButtonPresent).toBe(true);
    expect(tradeSell.sellButtonDisabled).toBe(false);
    expect(tradeSell.sellButtonHighlightedInTerminal).toBe(true);
    expect(tradeSell.terminalHighlightedInTerminal).toBe(false);
    expect(tradeSell.buyButtonPresent).toBe(false);
    expect(tradeSell.builderText).toContain("Sell Amount");
    expect(tradeSell.builderText).toContain("Cargo ready to sell");
    expect(tradeSell.builderText).not.toContain("current route sell support unavailable");
    expect(tradeSell.cargoBeforeSell).toBeGreaterThan(0);
    expect(tradeSell.creditsAfterFirstSell).toBeGreaterThan(tradeSell.creditsBeforeSell);
    expect(tradeSell.creditsAfterDoubleSell).toBe(tradeSell.creditsAfterFirstSell);
    expect(tradeSell.cargoAfterSell).toBe(0);
    expect(tradeSell.activeTradeCleared).toBe(true);
    expect(tradeSell.tradeProfit).toBeGreaterThan(0);
    expect(tradeSell.tradesCompleted).toBe(1);
    expect(["return-after-trade", "open-bounty"]).toContain(finalStep);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("starter bounty tutorial handles available and already-active bounty states", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await waitForGameGlobals(page);

    const availableState = await page.evaluate(() => window.eval(`
      (() => {
        localStorage.clear();
        activeObjective = null;
        ensureDailyBounties();
        dailyBountyContracts.forEach(contract => {
          contract.status = "available";
          contract.progress = 0;
        });
        showScreen("gameScreen");
        openBountyBoard();
        startStarterTutorial(true);
        setTutorialStepById("accept-bounty");
        renderStarterTutorial();
        const button = document.querySelector(".accept-bounty-button");
        return {
          step: getCurrentTutorialStep().id,
          buttonText: button?.textContent || "",
          highlighted: button?.classList.contains("tutorial-highlight-target") || false,
          disabled: Boolean(button?.disabled)
        };
      })()
    `));

    expect(availableState.step).toBe("accept-bounty");
    expect(availableState.buttonText).toContain("Accept Contract");
    expect(availableState.highlighted).toBe(true);
    expect(availableState.disabled).toBe(false);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await waitForGameGlobals(page);

    const offlineFallbackState = await page.evaluate(() => window.eval(`
      (() => {
        localStorage.clear();
        activeObjective = null;
        dailyBountyDate = "";
        dailyBountyContracts = [];
        activeBountyId = null;
        window.LupenMultiplayerClient = {
          ...(window.LupenMultiplayerClient || {}),
          getStatus: () => ({
            enabled: true,
            isConnected: false,
            lastStagingBountyStatus: null,
            lastStagingBountyList: null
          })
        };
        showScreen("gameScreen");
        startStarterTutorial(true);
        setTutorialStepById("accept-bounty");
        openBountyBoard();
        renderStarterTutorial();
        const button = document.querySelector(".accept-bounty-button");
        const beforeText = document.getElementById("bountyScreen")?.textContent || "";
        return {
          beforeText,
          disabled: Boolean(button?.disabled),
          buttonText: button?.textContent || ""
        };
      })()
    `));
    expect(offlineFallbackState.disabled).toBe(false);
    await page.locator(".accept-bounty-button").click();
    await page.waitForFunction(() => window.eval("getCurrentTutorialStep().id") === "return-for-combat-launch");
    const offlineFallbackAccepted = await page.evaluate(() => window.eval(`
      ({
        step: getCurrentTutorialStep().id,
        objectiveType: activeObjective?.type || "",
        contractId: activeObjective?.contractId || "",
        killsRequired: activeObjective?.killsRequired || 0,
        localCombatGuardActive: isStagingLocalCombatBotVisualGuardActive()
      })
    `));

    expect(offlineFallbackState.beforeText).toContain("STARTER BOUNTY");
    expect(offlineFallbackState.beforeText).toContain("Erebus Patrol Sweep");
    expect(offlineFallbackState.beforeText).toContain("Accept Contract");
    expect(offlineFallbackState.beforeText).not.toContain("Waiting For Server");
    expect(offlineFallbackState.buttonText).toContain("Accept Contract");
    expect(offlineFallbackAccepted.step).toBe("return-for-combat-launch");
    expect(offlineFallbackAccepted.objectiveType).toBe("bounty");
    expect(offlineFallbackAccepted.contractId).toBe("tutorial-erebus-patrol");
    expect(offlineFallbackAccepted.killsRequired).toBe(2);
    expect(offlineFallbackAccepted.localCombatGuardActive).toBe(false);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await waitForGameGlobals(page);

    const activeStagingState = await page.evaluate(() => window.eval(`
      (() => {
        localStorage.clear();
        const active = {
          id: "staging_erebus_patrol_2",
          title: "Erebus Patrol Sweep",
          description: "Destroy server-owned staging Erebus bots.",
          requiredKills: 2,
          progress: 0,
          xpReward: 0,
          creditsReward: 750,
          lupenShardsReward: 2,
          targetBotType: "any",
          targetBotLabel: "Erebus bots",
          accepted: true,
          completed: false,
          claimAvailable: false,
          claimed: false
        };
        window.LupenMultiplayerClient = {
          ...(window.LupenMultiplayerClient || {}),
          getStatus: () => ({
            enabled: true,
            isConnected: true,
            lastStagingBountyStatus: { active },
            lastStagingBountyList: { active, bounties: [active] }
          })
        };
        showScreen("gameScreen");
        openBountyBoard();
        startStarterTutorial(true);
        setTutorialStepById("accept-bounty");
        renderStarterTutorial();
        const before = document.getElementById("bountyDetailPanel")?.textContent || "";
        const step = getCurrentTutorialStep().id;
        return {
          step,
          detailText: before
        };
      })()
    `));

    expect(activeStagingState.step).toBe("return-for-combat-launch");
    expect(activeStagingState.detailText).toContain("Active Contract");
    expect(activeStagingState.detailText).not.toContain("Active Staging Bounty");

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await waitForGameGlobals(page);

    const stagingBotState = await page.evaluate(() => window.eval(`
      (() => {
        localStorage.clear();
        const active = {
          id: "staging_erebus_patrol_2",
          title: "Erebus Patrol Sweep",
          description: "Destroy server-owned staging Erebus bots.",
          requiredKills: 2,
          progress: 0,
          xpReward: 0,
          creditsReward: 750,
          lupenShardsReward: 2,
          targetBotType: "any",
          targetBotLabel: "Erebus bots",
          accepted: true,
          completed: false,
          claimAvailable: false,
          claimed: false
        };
        const bot = {
          id: "staging-bot-1",
          name: "Erebus Watcher",
          displayName: "Erebus Watcher",
          botType: "hunter",
          faction: "Erebus",
          level: 1,
          currentNode: "Lower Lane West B",
          x: 42,
          y: 46,
          hull: 720,
          maxHull: 720,
          shield: 180,
          maxShield: 180,
          disabled: false,
          alive: true
        };
        const bots = [
          bot,
          ...Array.from({ length: 9 }, (_, index) => ({
            ...bot,
            id: "staging-bot-extra-" + (index + 1),
            name: index % 2 === 0 ? "Erebus Scout" : "Erebus Drone",
            displayName: index % 2 === 0 ? "Erebus Scout" : "Erebus Drone",
            botType: index % 2 === 0 ? "attacker" : "destroyer",
            faction: "Erebus",
            x: 34 + index * 3,
            y: 38 + (index % 3) * 4
          }))
        ];
        const resource = {
          id: "staging-resource-copper-1",
          resourceId: "staging-resource-copper-1",
          resourceName: "Copper",
          currentNode: "Lower Lane West B",
          x: 66,
          y: 34,
          hp: 84,
          hpMax: 120,
          depleted: false
        };
        window.__selectedStagingBotId = "";
        window.__remoteSelectedStagingBotId = "";
        window.__lastShotEvent = null;
        window.__lastCombatVisualEvent = null;
        window.__stagingVisualBot = bot;
        window.__stagingVisualBots = bots;
        window.__stagingVisualResource = resource;
        window.LupenMultiplayerClient = {
          ...(window.LupenMultiplayerClient || {}),
          getStatus: () => ({
            enabled: true,
            isConnected: true,
            sessionId: "local-session",
            enabledReason: "staging_enabled",
            lastStagingBountyStatus: { active },
            lastStagingBountyList: { active, bounties: [active] },
            selectedTargetBotId: window.__selectedStagingBotId,
            lastShotEvent: window.__lastShotEvent,
            lastCombatVisualEvent: window.__lastCombatVisualEvent,
            activeShipWeaponCount: 2,
            validCombatWeaponCount: 2,
            localEquippedWeaponKeys: ["pulseLaser", "ionBlaster"]
          }),
          getPlayers: options => {
            const local = {
              id: "local-session",
              sessionId: "local-session",
              displayName: "Local Pilot",
              currentNode,
              x: 50,
              y: 66,
              isSelf: true,
              selectedTargetBotId: window.__selectedStagingBotId
            };
            const remote = {
              id: "remote-session",
              sessionId: "remote-session",
              displayName: "WaffleFast",
              currentNode,
              x: 58,
              y: 42,
              isSelf: false,
              selectedTargetBotId: window.__remoteSelectedStagingBotId,
              equippedWeaponKeys: ["pulseLaser", "ionBlaster", "railLance", "scatterCannon"],
              activeShipWeaponCount: 4,
              validCombatWeaponCount: 4
            };
            const remoteTarget = {
              id: "remote-target-session",
              sessionId: "remote-target-session",
              displayName: "Second Pilot",
              currentNode,
              x: 72,
              y: 46,
              isSelf: false,
              presenceStatus: window.__remoteTargetPresenceStatus || "space",
              pvpShield: 60,
              pvpShieldMax: 60,
              pvpArmor: 20,
              pvpArmorMax: 20,
              pvpHull: 180,
              pvpHullMax: 180
            };
            return options?.includeSelf === false ? [remote, remoteTarget] : [local, remote, remoteTarget];
          },
          getBots: () => bots,
          getResources: () => [resource],
          getBotsInCurrentNode: () => currentNode === bot.currentNode ? bots : [],
          getBotById: id => bots.find(candidate => String(id) === candidate.id) || null,
          selectStagingBot: id => {
            window.__selectedStagingBotId = id;
          },
          clearStagingTarget: () => {
            window.__selectedStagingBotId = "";
          }
        };
        currentNode = bot.currentNode;
        showScreen("spaceScreen");
        updateCurrentNodeUI();
        updateAsteroidUI();
        const marker = document.createElement("button");
        marker.type = "button";
        marker.className = "lupen-mp-space-bot";
        marker.dataset.botId = bot.id;
        marker.textContent = "Erebus Watcher";
        marker.style.left = "42%";
        marker.style.top = "46%";
        marker.onclick = event => {
          event.preventDefault();
          event.stopPropagation();
          window.__selectedStagingBotId = bot.id;
          selectStagingBotTarget(bot.id);
          window.LupenMultiplayerOverlay?.render?.();
        };
        document.getElementById("spaceScreen")?.appendChild(marker);
        startStarterTutorial(true);
        setTutorialStepById("jump-to-bounty-zone");
        renderStarterTutorial();
        window.LupenMultiplayerOverlay?.render?.();
        return {
          step: getCurrentTutorialStep().id,
          markerHighlighted: marker.classList.contains("tutorial-highlight-target"),
          selectedType: selectedTarget?.type || "",
          engageDisabled: document.getElementById("objectEngageBtn")?.disabled ?? true,
          overlayBotCount: document.querySelectorAll("#lupenMultiplayerSpaceBotLayer .lupen-mp-space-bot").length,
          bountyTargetCount: document.querySelectorAll("#lupenMultiplayerSpaceBotLayer .lupen-mp-space-bot.is-bounty-target").length
        };
      })()
    `));

    expect(stagingBotState.step).toBe("destroy-bot");
    expect(stagingBotState.markerHighlighted).toBe(true);
    expect(stagingBotState.selectedType).toBe("");
    expect(stagingBotState.engageDisabled).toBe(true);
    expect(stagingBotState.overlayBotCount).toBe(10);
    expect(stagingBotState.bountyTargetCount).toBe(10);

    await page.evaluate(() => window.eval(`
      (() => {
        window.__selectedStagingBotId = "staging-bot-1";
        selectStagingBotTarget("staging-bot-1");
        window.LupenMultiplayerOverlay?.render?.();
      })()
    `));
    await page.waitForFunction(() => window.eval("selectedTarget?.type") === "stagingBot");
    const stagingBotSelectedState = await page.evaluate(() => window.eval(`
      (() => {
        renderStarterTutorial();
        const engage = document.getElementById("objectEngageBtn");
        window.__remoteSelectedStagingBotId = window.__stagingVisualBot.id;
        window.__lastShotEvent = {
          ok: true,
          attackerSessionId: "local-session",
          targetBotId: window.__stagingVisualBot.id,
          currentNode,
          damage: 8,
          receivedAt: Date.now()
        };
        window.__stagingVisualBot.hull = 120;
        window.__stagingVisualBot.shield = 0;
        window.LupenMultiplayerOverlay?.render?.();
        const targetCard = document.querySelector(".lupen-target-card.hostile");
        const botMarker = document.querySelector("#lupenMultiplayerSpaceBotLayer .lupen-mp-space-bot.is-locked");
        const fxLayer = document.getElementById("combatFxLayer");
        const fxShot = fxLayer?.querySelector(".combat-fx-shot[data-owner='local']");
        const localCores = Array.from(fxShot?.querySelectorAll(".combat-fx-beam-core") || []);
        const targetFills = Array.from(targetCard?.querySelectorAll(".lupen-target-bar-fill") || []);
        return {
          step: getCurrentTutorialStep().id,
          selectedType: selectedTarget?.type || "",
          engageDisabled: engage?.disabled ?? true,
          engageHighlighted: engage?.classList.contains("tutorial-highlight-target") || false,
          targetCardText: targetCard?.textContent || "",
          targetBars: targetCard?.querySelectorAll(".lupen-target-bar-track").length || 0,
          markerHasInlineLabel: !!botMarker?.querySelector(".lupen-mp-space-bot-label, .lupen-mp-space-bot-note, .lupen-mp-bot-bars"),
          shotBeamCount: fxLayer?.querySelectorAll(".combat-fx-shot").length || 0,
          localShotBeamCount: fxLayer?.querySelectorAll(".combat-fx-shot[data-owner='local']").length || 0,
          beamCoreCount: fxLayer?.querySelectorAll(".combat-fx-beam-core").length || 0,
          trailShotBeamCount: document.querySelectorAll("#lupenMultiplayerSpaceShotLayer .lupen-mp-shot-beam.is-wing, #lupenMultiplayerSpaceShotLayer .lupen-mp-shot-beam.is-spark").length,
          localSourceX: Number(fxShot?.dataset.sourceX || 0),
          localTargetX: Number(fxShot?.dataset.targetX || 0),
          fxLayerWidth: Number(fxLayer?.dataset.width || 0),
          localSourceCount: Number(fxShot?.dataset.sourceCount || 0),
          localUniqueSourceYCount: new Set(localCores.map(line => Math.round(Number(line.getAttribute("y1") || 0)))).size,
          localUniqueTargetCount: new Set(localCores.map(line => Math.round(Number(line.getAttribute("x2") || 0)) + ":" + Math.round(Number(line.getAttribute("y2") || 0)))).size,
          coopEngagedMarkerCount: document.querySelectorAll("#lupenMultiplayerSpaceBotLayer .lupen-mp-space-bot.is-coop-engaged").length,
          muzzleCount: document.querySelectorAll("#lupenMultiplayerSpaceShotLayer .lupen-mp-shot-muzzle").length,
          hitCount: fxLayer?.querySelectorAll(".combat-fx-impact").length || 0,
          lowBarCount: targetFills.filter(fill => fill.classList.contains("is-low")).length,
          emptyBarCount: targetFills.filter(fill => fill.classList.contains("is-empty")).length,
          floatingDamageCount: document.querySelectorAll(".lupen-mp-space-bot-damage").length,
          engagedMarkerCount: document.querySelectorAll("#lupenMultiplayerSpaceBotLayer .lupen-mp-space-bot.is-engaged").length,
          bountyTargetCount: document.querySelectorAll("#lupenMultiplayerSpaceBotLayer .lupen-mp-space-bot.is-bounty-target").length,
          oldDebugCopyVisible: document.getElementById("spaceScreen")?.textContent?.includes("STAGING BOT / LOCK") || false
        };
      })()
    `));

    expect(stagingBotSelectedState.step).toBe("destroy-bot");
    expect(stagingBotSelectedState.selectedType).toBe("stagingBot");
    expect(stagingBotSelectedState.engageDisabled).toBe(false);
    expect(stagingBotSelectedState.engageHighlighted).toBe(true);
    expect(stagingBotSelectedState.targetCardText).toContain("Erebus Watcher");
    expect(stagingBotSelectedState.targetCardText).not.toContain("HOSTILE BOT");
    expect(stagingBotSelectedState.targetCardText).not.toContain("LEVEL 1");
    expect(stagingBotSelectedState.targetCardText).not.toContain("Hull");
    expect(stagingBotSelectedState.targetCardText).not.toContain("Shield");
    expect(stagingBotSelectedState.targetBars).toBe(2);
    expect(stagingBotSelectedState.markerHasInlineLabel).toBe(false);
    expect(stagingBotSelectedState.shotBeamCount).toBe(1);
    expect(stagingBotSelectedState.localShotBeamCount).toBe(1);
    expect(stagingBotSelectedState.beamCoreCount).toBe(5);
    expect(stagingBotSelectedState.trailShotBeamCount).toBe(0);
    expect(stagingBotSelectedState.localSourceX).toBeGreaterThan(stagingBotSelectedState.localTargetX);
    expect(stagingBotSelectedState.localSourceX).toBe(stagingBotSelectedState.fxLayerWidth);
    expect(stagingBotSelectedState.localSourceCount).toBe(5);
    expect(stagingBotSelectedState.localUniqueSourceYCount).toBeGreaterThanOrEqual(2);
    expect(stagingBotSelectedState.localUniqueTargetCount).toBe(1);
    expect(stagingBotSelectedState.coopEngagedMarkerCount).toBeGreaterThanOrEqual(1);
    expect(stagingBotSelectedState.muzzleCount).toBe(0);
    expect(stagingBotSelectedState.hitCount).toBe(1);
    expect(stagingBotSelectedState.lowBarCount).toBeGreaterThanOrEqual(1);
    expect(stagingBotSelectedState.emptyBarCount).toBeGreaterThanOrEqual(1);
    expect(stagingBotSelectedState.floatingDamageCount).toBe(0);
    expect(stagingBotSelectedState.engagedMarkerCount).toBeGreaterThanOrEqual(1);
    expect(stagingBotSelectedState.bountyTargetCount).toBe(10);
    expect(stagingBotSelectedState.oldDebugCopyVisible).toBe(false);

    const stagingBotRemoteShotState = await page.evaluate(() => window.eval(`
      (() => {
        window.__lastShotEvent = {
          ok: true,
          attackerSessionId: "remote-session",
          targetBotId: window.__stagingVisualBot.id,
          currentNode,
          damage: 8,
          receivedAt: Date.now()
        };
        window.LupenMultiplayerOverlay?.render?.();
        const fxLayer = document.getElementById("combatFxLayer");
        const core = fxLayer?.querySelector(".combat-fx-shot[data-owner='remote'] .combat-fx-beam-core");
        const screenRect = document.getElementById("spaceScreen")?.getBoundingClientRect();
        const markerCenter = selector => {
          const rect = document.querySelector(selector)?.getBoundingClientRect();
          return rect && screenRect
            ? {
              x: Math.round(rect.left + rect.width / 2 - screenRect.left),
              y: Math.round(rect.top + rect.height / 2 - screenRect.top)
            }
            : { x: 0, y: 0 };
        };
        const attackerCenter = markerCenter("#lupenMultiplayerSpaceGhostLayer .lupen-mp-space-ghost[data-session-id='remote-session']");
        const targetCenter = markerCenter("#lupenMultiplayerSpaceBotLayer .lupen-mp-space-bot[data-bot-id='" + window.__stagingVisualBot.id + "']");
        return {
          remoteShotBeamCount: fxLayer?.querySelectorAll(".combat-fx-shot[data-owner='remote']").length || 0,
          remoteBeamCoreCount: fxLayer?.querySelectorAll(".combat-fx-shot[data-owner='remote'] .combat-fx-beam-core").length || 0,
          remoteMuzzleCount: document.querySelectorAll("#lupenMultiplayerSpaceShotLayer .lupen-mp-shot-muzzle.is-remote").length,
          attackerLabelText: document.querySelector("#lupenMultiplayerSpaceShotLayer .lupen-mp-shot-attacker-label")?.textContent || "",
          coopEngagedMarkerCount: document.querySelectorAll("#lupenMultiplayerSpaceBotLayer .lupen-mp-space-bot.is-coop-engaged").length,
          sourceX: Math.round(Number(core?.getAttribute("x1") || 0)),
          sourceY: Math.round(Number(core?.getAttribute("y1") || 0)),
          endpointX: Math.round(Number(core?.getAttribute("x2") || 0)),
          endpointY: Math.round(Number(core?.getAttribute("y2") || 0)),
          attackerCenter,
          targetCenter
        };
      })()
    `));

    expect(stagingBotRemoteShotState.remoteShotBeamCount).toBe(1);
    expect(stagingBotRemoteShotState.remoteBeamCoreCount).toBe(1);
    expect(stagingBotRemoteShotState.remoteMuzzleCount).toBe(0);
    expect(stagingBotRemoteShotState.attackerLabelText).toBe("");
    expect(stagingBotRemoteShotState.coopEngagedMarkerCount).toBeGreaterThanOrEqual(1);
    expect(Math.abs(stagingBotRemoteShotState.sourceX - stagingBotRemoteShotState.attackerCenter.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(stagingBotRemoteShotState.sourceY - stagingBotRemoteShotState.attackerCenter.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(stagingBotRemoteShotState.endpointX - stagingBotRemoteShotState.targetCenter.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(stagingBotRemoteShotState.endpointY - stagingBotRemoteShotState.targetCenter.y)).toBeLessThanOrEqual(1);

    const stagingResourceRemoteShotState = await page.evaluate(() => window.eval(`
      (() => {
        window.__lastCombatVisualEvent = {
          type: "resource",
          ok: true,
          attackerSessionId: "remote-session",
          attackerDisplayName: "WaffleFast",
          targetType: "resource",
          targetId: window.__stagingVisualResource.id,
          resourceId: window.__stagingVisualResource.id,
          currentNode,
          damage: 18,
          receivedAt: Date.now()
        };
        window.LupenMultiplayerOverlay?.render?.();
        const fxLayer = document.getElementById("combatFxLayer");
        const targetId = window.__stagingVisualResource.id;
        const core = fxLayer?.querySelector(".combat-fx-shot[data-owner='remote'][data-target-id='" + targetId + "'] .combat-fx-beam-core");
        const screenRect = document.getElementById("spaceScreen")?.getBoundingClientRect();
        const markerCenter = selector => {
          const rect = document.querySelector(selector)?.getBoundingClientRect();
          return rect && screenRect
            ? {
              x: Math.round(rect.left + rect.width / 2 - screenRect.left),
              y: Math.round(rect.top + rect.height / 2 - screenRect.top)
            }
            : { x: 0, y: 0 };
        };
        const attackerCenter = markerCenter("#lupenMultiplayerSpaceGhostLayer .lupen-mp-space-ghost[data-session-id='remote-session']");
        const targetCenter = markerCenter("#asteroidField .server-resource-asteroid[data-target-id='" + targetId + "']");
        return {
          remoteShotBeamCount: fxLayer?.querySelectorAll(".combat-fx-shot[data-owner='remote'][data-target-id='" + targetId + "']").length || 0,
          remoteMuzzleCount: document.querySelectorAll("#lupenMultiplayerSpaceShotLayer .lupen-mp-shot-muzzle.is-remote").length,
          attackerLabelText: document.querySelector("#lupenMultiplayerSpaceShotLayer .lupen-mp-shot-attacker-label")?.textContent || "",
          hitCount: fxLayer?.querySelectorAll(".combat-fx-impact").length || 0,
          resourceHitCount: fxLayer?.querySelectorAll(".combat-fx-shot[data-target-type='resource'][data-target-id='" + targetId + "'] .combat-fx-impact").length || 0,
          sourceX: Math.round(Number(core?.getAttribute("x1") || 0)),
          sourceY: Math.round(Number(core?.getAttribute("y1") || 0)),
          endpointX: Math.round(Number(core?.getAttribute("x2") || 0)),
          endpointY: Math.round(Number(core?.getAttribute("y2") || 0)),
          attackerCenter,
          targetCenter
        };
      })()
    `));

    expect(stagingResourceRemoteShotState.remoteShotBeamCount).toBe(1);
    expect(stagingResourceRemoteShotState.remoteMuzzleCount).toBe(0);
    expect(stagingResourceRemoteShotState.attackerLabelText).toBe("");
    expect(stagingResourceRemoteShotState.hitCount).toBeGreaterThanOrEqual(1);
    expect(stagingResourceRemoteShotState.resourceHitCount).toBe(1);
    expect(Math.abs(stagingResourceRemoteShotState.sourceX - stagingResourceRemoteShotState.attackerCenter.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(stagingResourceRemoteShotState.sourceY - stagingResourceRemoteShotState.attackerCenter.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(stagingResourceRemoteShotState.endpointX - stagingResourceRemoteShotState.targetCenter.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(stagingResourceRemoteShotState.endpointY - stagingResourceRemoteShotState.targetCenter.y)).toBeLessThanOrEqual(1);

    const missingMarkerRemoteShotState = await page.evaluate(() => window.eval(`
      (() => {
        const targetId = window.__stagingVisualResource.id;
        clearAllCombatVisuals();
        document.querySelector("#asteroidField .server-resource-asteroid[data-target-id='" + targetId + "']")?.remove();
        window.__lastCombatVisualEvent = {
          type: "resource",
          ok: true,
          attackerSessionId: "remote-session",
          targetType: "resource",
          targetId,
          resourceId: targetId,
          currentNode,
          damage: 18,
          receivedAt: Date.now() + 2
        };
        window.LupenMultiplayerOverlay?.render?.();
        const missingTargetShotCount = document.querySelectorAll("#combatFxLayer .combat-fx-shot[data-owner='remote']").length;
        updateAsteroidUI();
        clearAllCombatVisuals();
        window.__lastCombatVisualEvent = {
          type: "resource",
          ok: true,
          attackerSessionId: "missing-remote-session",
          targetType: "resource",
          targetId,
          resourceId: targetId,
          currentNode,
          damage: 18,
          receivedAt: Date.now() + 3
        };
        window.LupenMultiplayerOverlay?.render?.();
        const missingAttackerShotCount = document.querySelectorAll("#combatFxLayer .combat-fx-shot[data-owner='remote']").length;
        window.__lastCombatVisualEvent = null;
        clearAllCombatVisuals();
        updateAsteroidUI();
        window.LupenMultiplayerOverlay?.render?.();
        return {
          missingTargetShotCount,
          missingAttackerShotCount
        };
      })()
    `));

    expect(missingMarkerRemoteShotState.missingTargetShotCount).toBe(0);
    expect(missingMarkerRemoteShotState.missingAttackerShotCount).toBe(0);

    const pvpRemoteShotState = await page.evaluate(() => window.eval(`
      (() => {
        const renderPvpHit = damageParts => {
          clearAllCombatVisuals();
          window.__lastCombatVisualEvent = {
            type: "pvp",
            ok: true,
            attackerSessionId: "remote-session",
            attackerDisplayName: "WaffleFast",
            targetType: "player",
            targetId: "local-session",
            targetPlayerId: "local-session",
            currentNode,
            damage: 36,
            receivedAt: Date.now(),
            ...damageParts
          };
          window.LupenMultiplayerOverlay?.render?.();
          const fxLayer = document.getElementById("combatFxLayer");
          return {
            remoteShotBeamCount: fxLayer?.querySelectorAll(".combat-fx-shot[data-owner='remote']").length || 0,
            remoteMuzzleCount: document.querySelectorAll("#lupenMultiplayerSpaceShotLayer .lupen-mp-shot-muzzle.is-remote").length,
            attackerLabelText: document.querySelector("#lupenMultiplayerSpaceShotLayer .lupen-mp-shot-attacker-label")?.textContent || "",
            hitCount: fxLayer?.querySelectorAll(".combat-fx-impact").length || 0,
            shieldHitCount: fxLayer?.querySelectorAll(".combat-fx-impact").length || 0,
            armorHitCount: fxLayer?.querySelectorAll(".combat-fx-impact").length || 0,
            hullHitCount: fxLayer?.querySelectorAll(".combat-fx-impact").length || 0
          };
        };
        const shield = renderPvpHit({ shieldDamage: 36, armorDamage: 0, hullDamage: 0 });
        const armor = renderPvpHit({ shieldDamage: 0, armorDamage: 24, hullDamage: 0 });
        const hull = renderPvpHit({ shieldDamage: 0, armorDamage: 0, hullDamage: 18 });
        const thirdParty = (() => {
          clearAllCombatVisuals();
          window.__lastCombatVisualEvent = {
            type: "pvp",
            ok: true,
            attackerSessionId: "remote-session",
            attackerDisplayName: "WaffleFast",
            targetType: "player",
            targetId: "remote-target-session",
            targetPlayerId: "remote-target-session",
            currentNode,
            damage: 24,
            shieldDamage: 24,
            receivedAt: Date.now() + 1
          };
          window.LupenMultiplayerOverlay?.render?.();
          const fxLayer = document.getElementById("combatFxLayer");
          const shot = fxLayer?.querySelector(".combat-fx-shot[data-owner='remote'][data-target-id='remote-target-session']");
          const core = shot?.querySelector(".combat-fx-beam-core");
          const screenRect = document.getElementById("spaceScreen")?.getBoundingClientRect();
          const markerCenter = selector => {
            const rect = document.querySelector(selector)?.getBoundingClientRect();
            return rect && screenRect
              ? {
                x: Math.round(rect.left + rect.width / 2 - screenRect.left),
                y: Math.round(rect.top + rect.height / 2 - screenRect.top)
              }
              : { x: 0, y: 0 };
          };
          return {
            remoteShotBeamCount: fxLayer?.querySelectorAll(".combat-fx-shot[data-owner='remote'][data-target-id='remote-target-session']").length || 0,
            sourceX: Math.round(Number(core?.getAttribute("x1") || 0)),
            sourceY: Math.round(Number(core?.getAttribute("y1") || 0)),
            endpointX: Math.round(Number(core?.getAttribute("x2") || 0)),
            endpointY: Math.round(Number(core?.getAttribute("y2") || 0)),
            attackerCenter: markerCenter("#lupenMultiplayerSpaceGhostLayer .lupen-mp-space-ghost[data-session-id='remote-session']"),
            targetCenter: markerCenter("#lupenMultiplayerSpaceGhostLayer .lupen-mp-space-ghost[data-session-id='remote-target-session']")
          };
        })();
        const markerCenter = selector => {
          const screenRect = document.getElementById("spaceScreen")?.getBoundingClientRect();
          const rect = document.querySelector(selector)?.getBoundingClientRect();
          return rect && screenRect
            ? {
              x: Math.round(rect.left + rect.width / 2 - screenRect.left),
              y: Math.round(rect.top + rect.height / 2 - screenRect.top)
            }
            : { x: 0, y: 0 };
        };
        const renderBotReturnHit = (targetId, receivedOffset = 0) => {
          clearAllCombatVisuals();
          window.__lastCombatVisualEvent = {
            type: "botReturnFire",
            ok: true,
            attackerType: "bot",
            attackerId: window.__stagingVisualBot.id,
            attackerBotId: window.__stagingVisualBot.id,
            targetType: "player",
            targetId,
            targetPlayerId: targetId,
            currentNode,
            damage: 12,
            shieldDamage: 12,
            receivedAt: Date.now() + receivedOffset
          };
          window.LupenMultiplayerOverlay?.render?.();
          const fxLayer = document.getElementById("combatFxLayer");
          const shot = fxLayer?.querySelector(".combat-fx-shot[data-owner='bot'][data-target-id='" + targetId + "']");
          const core = shot?.querySelector(".combat-fx-beam-core");
          const cockpitPoint = targetId === "local-session" && typeof getLocalPlayerIncomingFireEndpoint === "function"
            ? getLocalPlayerIncomingFireEndpoint()
            : null;
          return {
            beamCount: fxLayer?.querySelectorAll(".combat-fx-shot[data-owner='bot'][data-target-id='" + targetId + "']").length || 0,
            hitCount: shot?.querySelectorAll(".combat-fx-impact").length || 0,
            sourceX: Math.round(Number(core?.getAttribute("x1") || 0)),
            sourceY: Math.round(Number(core?.getAttribute("y1") || 0)),
            endpointX: Math.round(Number(core?.getAttribute("x2") || 0)),
            endpointY: Math.round(Number(core?.getAttribute("y2") || 0)),
            botCenter: markerCenter("#lupenMultiplayerSpaceBotLayer .lupen-mp-space-bot[data-bot-id='" + window.__stagingVisualBot.id + "']"),
            remoteTargetCenter: targetId === "remote-target-session"
              ? markerCenter("#lupenMultiplayerSpaceGhostLayer .lupen-mp-space-ghost[data-session-id='remote-target-session']")
              : { x: 0, y: 0 },
            cockpitPoint: cockpitPoint
              ? { x: Math.round(cockpitPoint.x), y: Math.round(cockpitPoint.y) }
              : { x: 0, y: 0 }
          };
        };
        const localBotReturn = renderBotReturnHit("local-session", 2);
        const thirdPartyBotReturn = renderBotReturnHit("remote-target-session", 3);
        const missingTargetMarkerBotReturn = (() => {
          window.__remoteTargetPresenceStatus = "docked";
          const result = renderBotReturnHit("remote-target-session", 4);
          window.__remoteTargetPresenceStatus = "space";
          return result;
        })();
        const missingBotMarkerReturn = (() => {
          const previousDisabled = window.__stagingVisualBot.disabled;
          window.__stagingVisualBot.disabled = true;
          const result = renderBotReturnHit("remote-target-session", 5);
          window.__stagingVisualBot.disabled = previousDisabled;
          window.LupenMultiplayerOverlay?.render?.();
          return result;
        })();
        return {
          shield,
          armor,
          hull,
          thirdParty,
          localBotReturn,
          thirdPartyBotReturn,
          missingTargetMarkerBotReturn,
          missingBotMarkerReturn,
          botReturnBeamCount: localBotReturn.beamCount,
          botReturnMuzzleCount: document.querySelectorAll("#lupenMultiplayerSpaceShotLayer .lupen-mp-shot-muzzle.is-bot-return").length,
          botReturnShieldHitCount: localBotReturn.hitCount
        };
      })()
    `));

    expect(pvpRemoteShotState.shield.remoteShotBeamCount).toBe(1);
    expect(pvpRemoteShotState.shield.remoteMuzzleCount).toBe(0);
    expect(pvpRemoteShotState.shield.attackerLabelText).toBe("");
    expect(pvpRemoteShotState.shield.hitCount).toBe(1);
    expect(pvpRemoteShotState.shield.shieldHitCount).toBe(1);
    expect(pvpRemoteShotState.armor.armorHitCount).toBe(1);
    expect(pvpRemoteShotState.hull.hullHitCount).toBe(1);
    expect(pvpRemoteShotState.thirdParty.remoteShotBeamCount).toBe(1);
    expect(Math.abs(pvpRemoteShotState.thirdParty.sourceX - pvpRemoteShotState.thirdParty.attackerCenter.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(pvpRemoteShotState.thirdParty.sourceY - pvpRemoteShotState.thirdParty.attackerCenter.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(pvpRemoteShotState.thirdParty.endpointX - pvpRemoteShotState.thirdParty.targetCenter.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(pvpRemoteShotState.thirdParty.endpointY - pvpRemoteShotState.thirdParty.targetCenter.y)).toBeLessThanOrEqual(1);
    expect(pvpRemoteShotState.botReturnBeamCount).toBe(1);
    expect(pvpRemoteShotState.botReturnMuzzleCount).toBe(0);
    expect(pvpRemoteShotState.botReturnShieldHitCount).toBe(1);
    expect(Math.abs(pvpRemoteShotState.localBotReturn.sourceX - pvpRemoteShotState.localBotReturn.botCenter.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(pvpRemoteShotState.localBotReturn.sourceY - pvpRemoteShotState.localBotReturn.botCenter.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(pvpRemoteShotState.localBotReturn.endpointX - pvpRemoteShotState.localBotReturn.cockpitPoint.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(pvpRemoteShotState.localBotReturn.endpointY - pvpRemoteShotState.localBotReturn.cockpitPoint.y)).toBeLessThanOrEqual(1);
    expect(pvpRemoteShotState.localBotReturn.endpointY).toBeGreaterThan(pvpRemoteShotState.localBotReturn.botCenter.y);
    expect(pvpRemoteShotState.thirdPartyBotReturn.beamCount).toBe(1);
    expect(Math.abs(pvpRemoteShotState.thirdPartyBotReturn.sourceX - pvpRemoteShotState.thirdPartyBotReturn.botCenter.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(pvpRemoteShotState.thirdPartyBotReturn.sourceY - pvpRemoteShotState.thirdPartyBotReturn.botCenter.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(pvpRemoteShotState.thirdPartyBotReturn.endpointX - pvpRemoteShotState.thirdPartyBotReturn.remoteTargetCenter.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(pvpRemoteShotState.thirdPartyBotReturn.endpointY - pvpRemoteShotState.thirdPartyBotReturn.remoteTargetCenter.y)).toBeLessThanOrEqual(1);
    expect(pvpRemoteShotState.missingTargetMarkerBotReturn.beamCount).toBe(0);
    expect(pvpRemoteShotState.missingBotMarkerReturn.beamCount).toBe(0);

    const staleMissingBotState = await page.evaluate(() => window.eval(`
      (() => {
        window.__lastCombatVisualEvent = null;
        clearAllCombatVisuals();
        const bot = window.__stagingVisualBot;
        const activityBefore = document.getElementById("activityLogFeed")?.textContent || "";
        selectStagingBotTarget(bot.id);
        engageTarget();
        const engagedBefore = engagedTarget ? { ...engagedTarget } : null;
        const botList = window.__stagingVisualBots || [];
        const botIndex = botList.findIndex(candidate => candidate.id === bot.id);
        const removed = botIndex >= 0 ? botList.splice(botIndex, 1)[0] : null;
        window.__lastCombatVisualEvent = {
          type: "bot",
          ok: true,
          attackerSessionId: "remote-session",
          targetType: "bot",
          targetId: bot.id,
          targetBotId: bot.id,
          currentNode,
          damage: 8,
          receivedAt: Date.now()
        };
        window.LupenMultiplayerOverlay?.render?.();
        const staleShotBeamCount = document.querySelectorAll("#combatFxLayer .combat-fx-shot").length;
        const cleanup = reconcileStagingBotTargetState("e2e_missing_bot");
        const activityAfter = document.getElementById("activityLogFeed")?.textContent || "";
        if (removed) botList.splice(botIndex, 0, removed);
        window.__selectedStagingBotId = "";
        window.__lastCombatVisualEvent = null;
        window.LupenMultiplayerOverlay?.render?.();
        return {
          engagedBefore,
          cleanup,
          staleShotBeamCount,
          selectedAfter: selectedTarget ? { ...selectedTarget } : null,
          engagedAfter: engagedTarget ? { ...engagedTarget } : null,
          selectedClientBotId: window.__selectedStagingBotId || "",
          disengageLogAdded: ((activityAfter.match(/Disengaged Erebus Watcher/g) || []).length - (activityBefore.match(/Disengaged Erebus Watcher/g) || []).length)
        };
      })()
    `));

    expect(staleMissingBotState.engagedBefore).toMatchObject({ type: "stagingBot", id: "staging-bot-1" });
    expect(staleMissingBotState.cleanup).toMatchObject({ cleared: true, reason: "e2e_missing_bot" });
    expect(staleMissingBotState.staleShotBeamCount).toBe(0);
    expect(staleMissingBotState.selectedAfter).toBe(null);
    expect(staleMissingBotState.engagedAfter).toBe(null);
    expect(staleMissingBotState.selectedClientBotId).toBe("");
    expect(staleMissingBotState.disengageLogAdded).toBe(0);

    const staleNodeBotState = await page.evaluate(() => window.eval(`
      (() => {
        const bot = window.__stagingVisualBot;
        currentNode = bot.currentNode;
        selectStagingBotTarget(bot.id);
        engageTarget();
        const engagedBefore = engagedTarget ? { ...engagedTarget } : null;
        currentNode = "Asteron Prime";
        const cleanup = reconcileStagingBotTargetState("e2e_node_changed");
        const selectedAfter = selectedTarget ? { ...selectedTarget } : null;
        const engagedAfter = engagedTarget ? { ...engagedTarget } : null;
        currentNode = bot.currentNode;
        updateCurrentNodeUI();
        updateAsteroidUI();
        window.LupenMultiplayerOverlay?.render?.();
        return {
          engagedBefore,
          cleanup,
          selectedAfter,
          engagedAfter,
          selectedClientBotId: window.__selectedStagingBotId || ""
        };
      })()
    `));

    expect(staleNodeBotState.engagedBefore).toMatchObject({ type: "stagingBot", id: "staging-bot-1" });
    expect(staleNodeBotState.cleanup).toMatchObject({ cleared: true, reason: "e2e_node_changed" });
    expect(staleNodeBotState.selectedAfter).toBe(null);
    expect(staleNodeBotState.engagedAfter).toBe(null);
    expect(staleNodeBotState.selectedClientBotId).toBe("");

    const stagingBotDisabledState = await page.evaluate(() => window.eval(`
      (() => {
        const bot = window.__stagingVisualBot;
        selectStagingBotTarget(bot.id);
        engageTarget();
        const engagedBefore = engagedTarget ? { ...engagedTarget } : null;
        bot.disabled = true;
        bot.alive = false;
        bot.hull = 0;
        bot.shield = 0;
        const disabledUntil = Date.now() + 30000;
        const first = handleStagingBotLifecycleEvent({
          type: "bot:disabled",
          botId: bot.id,
          botName: bot.name,
          currentNode,
          disabled: true,
          disabledUntil,
          destructionInstanceId: "e2e-staging-bot-disabled-1",
          rewardPreviewId: "e2e-staging-bot-preview-1"
        });
        const explosionCountAfterFirst = document.querySelectorAll("#explosionLayer .space-explosion").length;
        const duplicate = handleStagingBotLifecycleEvent({
          type: "bot:disabled",
          botId: bot.id,
          botName: bot.name,
          currentNode,
          disabled: true,
          disabledUntil,
          destructionInstanceId: "e2e-staging-bot-disabled-1",
          rewardPreviewId: "e2e-staging-bot-preview-1"
        });
        return {
          engagedBefore,
          first,
          duplicate,
          selectedAfter: selectedTarget ? { ...selectedTarget } : null,
          engagedAfter: engagedTarget ? { ...engagedTarget } : null,
          selectedClientBotId: window.__selectedStagingBotId || "",
          overlayBotCount: document.querySelectorAll("#lupenMultiplayerSpaceBotLayer .lupen-mp-space-bot").length,
          disabledBotMarkerCount: document.querySelectorAll('#lupenMultiplayerSpaceBotLayer .lupen-mp-space-bot[data-bot-id="staging-bot-1"]').length,
          targetCardCount: document.querySelectorAll(".lupen-target-card.hostile").length,
          explosionCountAfterFirst,
          explosionCountAfterDuplicate: document.querySelectorAll("#explosionLayer .space-explosion").length,
          disengageLogCount: (document.getElementById("activityLogFeed")?.textContent || "").match(/Disengaged Erebus Watcher/g)?.length || 0
        };
      })()
    `));

    expect(stagingBotDisabledState.engagedBefore).toMatchObject({ type: "stagingBot", id: "staging-bot-1" });
    expect(stagingBotDisabledState.first).toMatchObject({ handled: true, reason: "bot_disabled", botId: "staging-bot-1" });
    expect(stagingBotDisabledState.duplicate).toMatchObject({ handled: true, reason: "bot_disabled", botId: "staging-bot-1" });
    expect(stagingBotDisabledState.selectedAfter).toBe(null);
    expect(stagingBotDisabledState.engagedAfter).toBe(null);
    expect(stagingBotDisabledState.selectedClientBotId).toBe("");
    expect(stagingBotDisabledState.overlayBotCount).toBe(9);
    expect(stagingBotDisabledState.disabledBotMarkerCount).toBe(0);
    expect(stagingBotDisabledState.targetCardCount).toBe(0);
    expect(stagingBotDisabledState.explosionCountAfterFirst).toBeGreaterThan(0);
    expect(stagingBotDisabledState.explosionCountAfterDuplicate).toBe(stagingBotDisabledState.explosionCountAfterFirst);
    expect(stagingBotDisabledState.disengageLogCount).toBe(0);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("staging bot kill fallback awards XP once, refreshes UI, and persists", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await waitForGameGlobals(page);

    const state = await page.evaluate(() => window.eval(`
      (() => {
        localStorage.clear();
        const activityMessages = [];
        const originalAddActivityLog = addActivityLog;
        addActivityLog = (message) => {
          activityMessages.push(String(message || ""));
          originalAddActivityLog(message);
        };
        playerProgress = normalizePlayerProgress({ combatXp: 0, totals: { botsDestroyed: 0, erebusBotsDestroyed: 0 } });
        const active = {
          id: "staging_erebus_patrol_2",
          title: "Erebus Patrol Sweep",
          requiredKills: 2,
          progress: 1,
          xpReward: 0,
          creditsReward: 750,
          lupenShardsReward: 2,
          targetBotType: "any",
          targetBotLabel: "Erebus bots",
          accepted: true,
          completed: false,
          claimAvailable: false,
          claimed: false
        };
        window.LupenMultiplayerClient = {
          ...(window.LupenMultiplayerClient || {}),
          getStatus: () => ({
            enabled: true,
            isConnected: true,
            lastStagingBountyStatus: { active },
            lastStagingBountyList: { active, bounties: [active] }
          })
        };

        showScreen("spaceScreen");
        upgradeMaterials = normalizeUpgradeMaterials({ lupenShards: 7 });
        updateProgressDisplays();
        const first = awardLocalStagingBotKillXpFromServer({
          ok: true,
          applied: false,
          botId: "staging-bot-1",
          botName: "Erebus Watcher",
          destructionInstanceId: "staging-bot-1:kill-1",
          receivedAt: 1000
        });
        const duplicate = awardLocalStagingBotKillXpFromServer({
          ok: true,
          applied: false,
          botId: "staging-bot-1",
          botName: "Erebus Watcher",
          destructionInstanceId: "staging-bot-1:kill-1",
          receivedAt: 1001
        });
        const secondWithBounty = awardLocalStagingBotKillXpFromServer({
          ok: true,
          applied: false,
          botId: "staging-bot-2",
          botName: "Erebus Drone",
          destructionInstanceId: "staging-bot-2:kill-1",
          receivedAt: 1002
        });
        const serverAppliedMark = typeof markStagingBotKillXpAwarded === "function"
          ? markStagingBotKillXpAwarded({
            ok: true,
            applied: true,
            botId: "staging-bot-3",
            botName: "Erebus Scout",
            destructionInstanceId: "staging-bot-3:kill-1",
            botXpSourceEventId: "staging_bot_xp:staging-bot-3:kill-1",
            receivedAt: 1003
          })
          : null;
        const duplicateAfterServerApplied = awardLocalStagingBotKillXpFromServer({
          ok: true,
          applied: false,
          botId: "staging-bot-3",
          botName: "Erebus Scout",
          destructionInstanceId: "staging-bot-3:kill-1",
          botXpSourceEventId: "staging_bot_xp:staging-bot-3:kill-1",
          receivedAt: 1004
        });

        const hudText = document.getElementById("hudProgressStrip")?.textContent || "";
        showScreen("pilotProfileScreen");
        if (typeof renderPilotProfile === "function") renderPilotProfile();
        const pilotText = document.getElementById("pilotProfileScreen")?.textContent || "";
        const saved = JSON.parse(localStorage.getItem(STORAGE_GAME_KEY) || "{}");
        playerProgress = normalizePlayerProgress({ combatXp: 0, totals: { botsDestroyed: 0, erebusBotsDestroyed: 0 } });
        applyLoadedGameState(saved);

        return {
          first,
          duplicate,
          secondWithBounty,
          serverAppliedMark,
          duplicateAfterServerApplied,
          restoredXp: playerProgress.combatXp,
          restoredZoneXp: playerProgress.zoneCombatXp[XP_CONFIG.combatZoneKey],
          savedXp: saved.playerProgress?.combatXp,
          savedZoneXp: saved.playerProgress?.zoneCombatXp?.[XP_CONFIG.combatZoneKey],
          botsDestroyed: saved.playerProgress?.totals?.botsDestroyed,
          erebusBotsDestroyed: saved.playerProgress?.totals?.erebusBotsDestroyed,
          hudText,
          pilotText,
          fallbackKillActivityCount: activityMessages.filter(message => message === "Erebus Watcher destroyed. +100 XP.").length,
          serverMarkedDuplicateActivityCount: activityMessages.filter(message => message.includes("Erebus Scout destroyed")).length,
          activeBountyProgress: window.LupenMultiplayerClient.getStatus().lastStagingBountyStatus.active.progress,
          shardCount: upgradeMaterials.lupenShards
        };
      })()
    `));

    expect(state.first.applied).toBe(true);
    expect(state.first.xpDelta).toBe(100);
    expect(state.duplicate.applied).toBe(false);
    expect(state.duplicate.reason).toBe("duplicate_staging_bot_kill_xp");
    expect(state.secondWithBounty.applied).toBe(true);
    expect(state.serverAppliedMark).toMatchObject({ marked: true, key: "staging-bot-3:kill-1" });
    expect(state.duplicateAfterServerApplied.applied).toBe(false);
    expect(state.duplicateAfterServerApplied.reason).toBe("duplicate_staging_bot_kill_xp");
    expect(state.savedXp).toBe(200);
    expect(state.savedZoneXp).toBe(200);
    expect(state.restoredXp).toBe(200);
    expect(state.restoredZoneXp).toBe(200);
    expect(state.botsDestroyed).toBe(2);
    expect(state.erebusBotsDestroyed).toBe(2);
    expect(state.hudText).toContain("200");
    expect(state.pilotText).toContain("200");
    expect(state.fallbackKillActivityCount).toBe(1);
    expect(state.serverMarkedDuplicateActivityCount).toBe(0);
    expect(state.activeBountyProgress).toBe(1);
    expect(state.shardCount).toBe(7);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("combat laser feedback renders simple outgoing and incoming beams", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await waitForGameGlobals(page);

    const visualState = await page.evaluate(() => window.eval(`
      (() => {
        showScreen("spaceScreen");
        const target = {
          id: "staging-bot-visual",
          name: "Erebus Scout",
          currentNode,
          x: 52,
          y: 32,
          alive: true
        };
        pulseLaserBurstToTarget(target, {
          name: "Pulse Laser Array",
          count: 7,
          weapons: Array.from({ length: 7 }, (_, index) => ({
            name: "Pulse Laser " + (index + 1),
            fireStyle: "pulse",
            projectileColor: "#7fd6ff"
          })),
          fireStyle: "pulse",
          projectileColor: "#7fd6ff"
        });
        incomingLaserBurstFromBot(target, 0, { count: 5 });
        hullMax = 720;
        shieldMax = 180;
        hull = 120;
        shield = 0;
        updateSpaceHUD();
        showIncomingHitFlash({ armorHit: true });
        const fxLayer = document.getElementById("combatFxLayer");
        const localShot = fxLayer?.querySelector(".combat-fx-shot[data-owner='local']");
        const botShot = fxLayer?.querySelector(".combat-fx-shot[data-owner='bot']");
        const localCores = Array.from(localShot?.querySelectorAll(".combat-fx-beam-core") || []);
        const botCore = botShot?.querySelector(".combat-fx-beam-core");
        const cockpitPoint = typeof getLocalPlayerIncomingFireEndpoint === "function"
          ? getLocalPlayerIncomingFireEndpoint()
          : null;
        return {
          combatFxLayerExists: !!fxLayer,
          combatFxShotCount: fxLayer?.querySelectorAll(".combat-fx-shot").length || 0,
          localCombatFxShotCount: fxLayer?.querySelectorAll(".combat-fx-shot[data-owner='local']").length || 0,
          botCombatFxShotCount: fxLayer?.querySelectorAll(".combat-fx-shot[data-owner='bot']").length || 0,
          combatFxBeamCoreCount: fxLayer?.querySelectorAll(".combat-fx-beam-core").length || 0,
          combatFxImpactCount: fxLayer?.querySelectorAll(".combat-fx-impact").length || 0,
          localSourceX: Number(localShot?.dataset.sourceX || 0),
          localTargetX: Number(localShot?.dataset.targetX || 0),
          localSourceCount: Number(localShot?.dataset.sourceCount || 0),
          localUniqueSourceYCount: new Set(localCores.map(line => Math.round(Number(line.getAttribute("y1") || 0)))).size,
          localUniqueTargetCount: new Set(localCores.map(line => Math.round(Number(line.getAttribute("x2") || 0)) + ":" + Math.round(Number(line.getAttribute("y2") || 0)))).size,
          botEndpointX: Math.round(Number(botCore?.getAttribute("x2") || 0)),
          botEndpointY: Math.round(Number(botCore?.getAttribute("y2") || 0)),
          cockpitPoint: cockpitPoint ? { x: Math.round(cockpitPoint.x), y: Math.round(cockpitPoint.y) } : { x: 0, y: 0 },
          playerShotCount: document.querySelectorAll("#laserLayer .laser-burst.player-shot").length,
          simplePlayerShotCount: document.querySelectorAll("#laserLayer .laser-burst.simple-combat-laser.player-shot").length,
          polishedPlayerShotCount: document.querySelectorAll("#laserLayer .laser-burst.player-shot-polished").length,
          volleyPlayerShotCount: document.querySelectorAll("#laserLayer .laser-burst.player-shot-volley").length,
          muzzleCount: document.querySelectorAll("#laserLayer .weapon-muzzle-flash").length,
          incomingCount: document.querySelectorAll("#laserLayer .enemy-incoming-laser").length,
          heavyIncomingCount: document.querySelectorAll("#laserLayer .enemy-incoming-laser-heavy").length,
          armorScreenFlash: document.getElementById("spaceScreen")?.classList.contains("armor-impact") || false,
          armorHudFlash: document.querySelector(".vertical-stats")?.classList.contains("armor-impact") || false,
          statPanelCritical: document.querySelector(".vertical-stats")?.classList.contains("player-hull-critical") || false,
          statPanelShieldDepleted: document.querySelector(".vertical-stats")?.classList.contains("player-shield-depleted") || false,
          screenCritical: document.getElementById("spaceScreen")?.classList.contains("player-hull-critical") || false,
          screenShieldDepleted: document.getElementById("spaceScreen")?.classList.contains("player-shield-depleted") || false
        };
      })()
    `));

    expect(visualState.combatFxLayerExists).toBe(true);
    expect(visualState.combatFxShotCount).toBe(2);
    expect(visualState.localCombatFxShotCount).toBe(1);
    expect(visualState.botCombatFxShotCount).toBe(1);
    expect(visualState.combatFxBeamCoreCount).toBe(6);
    expect(visualState.combatFxImpactCount).toBe(1);
    expect(visualState.localSourceX).toBeLessThan(visualState.localTargetX);
    expect(visualState.localSourceX).toBe(0);
    expect(visualState.localSourceCount).toBe(5);
    expect(visualState.localUniqueSourceYCount).toBeGreaterThanOrEqual(2);
    expect(visualState.localUniqueTargetCount).toBe(1);
    expect(Math.abs(visualState.botEndpointX - visualState.cockpitPoint.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(visualState.botEndpointY - visualState.cockpitPoint.y)).toBeLessThanOrEqual(1);
    expect(visualState.playerShotCount).toBe(0);
    expect(visualState.simplePlayerShotCount).toBe(0);
    expect(visualState.polishedPlayerShotCount).toBe(0);
    expect(visualState.volleyPlayerShotCount).toBe(0);
    expect(visualState.muzzleCount).toBe(0);
    expect(visualState.incomingCount).toBe(0);
    expect(visualState.heavyIncomingCount).toBe(0);
    expect(visualState.armorScreenFlash).toBe(true);
    expect(visualState.armorHudFlash).toBe(true);
    expect(visualState.statPanelCritical).toBe(true);
    expect(visualState.statPanelShieldDepleted).toBe(true);
    expect(visualState.screenCritical).toBe(true);
    expect(visualState.screenShieldDepleted).toBe(true);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("tutorial bounty grants shards and Forge level upgrade persists on Pulse Laser", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await waitForGameGlobals(page);

    const rewardState = await page.evaluate(() => window.eval(`
      (() => {
        localStorage.clear();
        currentShipId = "falcon";
        selectedHangarShipId = "falcon";
        selectedFleetShipId = "falcon";
        selectedShipyardShipId = "falcon";
        ownedShips = ["falcon"];
        playerProgress = normalizePlayerProgress({ combatXp: 2500 });
        ownedGuns.pulseLaser = 0;
        inventoryItems = [];
        shipLoadouts = {
          falcon: normalizeShipLoadout({ attachments: [], guns: [makeLeveledLoadoutEntry("pulseLaser", "standard", 1)] }, "falcon")
        };
        shipConditions = {};
        upgradeMaterials = normalizeUpgradeMaterials({ lupenShards: 0 });
        credits = 500;
        ensureDailyBounties();
        const contract = dailyBountyContracts[0];
        contract.status = "readyToClaim";
        contract.progress = getBountyRequiredKills(contract);
        contract.reward = { credits: 100, xp: 125, lupenCores: 0, lupenShards: 25 };
        selectedBountyContractId = contract.id;
        tutorialState = {
          active: true,
          completed: false,
          stepIndex: STARTER_TUTORIAL_STEPS.findIndex(step => step.id === "claim-bounty"),
          lastStartedAt: new Date().toISOString()
        };
        saveTutorialState();
        showScreen("gameScreen");
        claimBountyReward(contract.id);
        const claimed = getBountyContract(contract.id);
        return {
          combatXp: playerProgress.combatXp,
          credits,
          shardCount: upgradeMaterials.lupenShards,
          contractShards: claimed.reward.lupenShards,
          status: claimed.status,
          overlayText: document.getElementById("bountyRewardOverlay")?.textContent || ""
        };
      })()
    `));

    expect(rewardState).toMatchObject({
      combatXp: 2500,
      credits: 600,
      shardCount: 25,
      contractShards: 25,
      status: "claimed"
    });
    expect(rewardState.overlayText).toContain("CR 100");
    expect(rewardState.overlayText).toContain("25 Lupen Shards");

    await page.evaluate(() => window.eval(`
      setTutorialStepById("forge-upgrade-weapon");
      openUpgradeForge();
      startForgeUpgrade();
    `));

    await page.waitForFunction(() => {
      const entry = shipLoadouts.falcon?.guns?.[0];
      return entry && getEquipmentKey(entry) === "pulseLaser" && getEquipmentLevel(entry) === 2;
    }, null, { timeout: 5000 });
    await page.waitForFunction(() => getCurrentTutorialStep()?.id === "return-after-forge", null, { timeout: 5000 });

    let forgeState = await page.evaluate(() => ({
      level: getEquipmentLevel(shipLoadouts.falcon.guns[0]),
      shardCount: upgradeMaterials.lupenShards,
      selectedForgeItemId,
      tutorialStep: getCurrentTutorialStep()?.id || ""
    }));
    expect(forgeState.level).toBe(2);
    expect(forgeState.shardCount).toBe(0);
    expect(forgeState.selectedForgeItemId).toContain("equipped:falcon:guns:0");
    expect(forgeState.tutorialStep).toBe("return-after-forge");

    await page.reload();
    await waitForGameGlobals(page);
    forgeState = await page.evaluate(() => ({
      level: getEquipmentLevel(shipLoadouts.falcon.guns[0]),
      key: getEquipmentKey(shipLoadouts.falcon.guns[0]),
      shardCount: upgradeMaterials.lupenShards
    }));
    expect(forgeState).toMatchObject({
      key: "pulseLaser",
      level: 2,
      shardCount: 0
    });

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("ship switching restores each hull condition instead of inheriting previous hull", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await waitForGameGlobals(page);

    const state = await page.evaluate(() => {
      window.eval(`
        localStorage.clear();
        currentShipId = "falcon";
        selectedHangarShipId = "falcon";
        selectedFleetShipId = "falcon";
        selectedShipyardShipId = "falcon";
        ownedShips = ["falcon", "bison", "monolith"];
        shipLoadouts = {
          falcon: normalizeShipLoadout({ attachments: [], guns: ["pulseLaser"] }, "falcon"),
          bison: normalizeShipLoadout({ attachments: [], guns: [] }, "bison"),
          monolith: normalizeShipLoadout({ attachments: [], guns: [] }, "monolith")
        };
        shipConditions = {
          falcon: { hull: 620, shield: 111 },
          bison: { hull: 930, shield: 77 },
          monolith: { hull: 99999, shield: 99999 }
        };
        hull = 620;
        shield = 111;
        applyShipStats(false);
        equipShip("monolith");
      `);
      const monolith = { ship: currentShipId, hull, hullMax, shield, shieldMax, armor, cargo: getShipStats().cargo, jumpRecharge: getShipStats().jumpRecharge, evasion };
      window.eval(`equipShip("bison");`);
      const bisonBeforeRepair = { ship: currentShipId, hull, hullMax, shield, shieldMax, armor, cargo: getShipStats().cargo, jumpRecharge: getShipStats().jumpRecharge, evasion };
      const originalClient = window.LupenMultiplayerClient;
      let repairSyncPayload = null;
      let pvpRepairSyncPayload = null;
      window.LupenMultiplayerClient = {
        syncPvpRepairState(payload) {
          if (repairSyncPayload) pvpRepairSyncPayload = { ...payload };
          else repairSyncPayload = { ...payload };
          return { ok: true };
        }
      };
      window.eval(`repairCurrentShip();`);
      const bisonAfterRepair = { ship: currentShipId, hull, hullMax, shield, shieldMax, savedHull: shipConditions.bison.hull };
      applyServerPvpDamageState({
        targetSessionId: "local-session",
        shield: 135,
        shieldMax: 135,
        hull: 400,
        hullMax: 1300,
        reason: "pvp_damage_applied"
      });
      const pvpRepairBefore = {
        localHull: hull,
        localHullMax: hullMax,
        effective: getEffectiveRepairHullState(),
        cost: getRepairCost()
      };
      window.eval(`repairCurrentShip();`);
      const pvpRepairAfter = {
        localHull: hull,
        localHullMax: hullMax,
        effective: getEffectiveRepairHullState(),
        displayHull: serverPvpDamageDisplayState?.hull,
        displayHullMax: serverPvpDamageDisplayState?.hullMax,
        savedHull: shipConditions.bison.hull
      };
      window.LupenMultiplayerClient = originalClient;
      window.eval(`equipShip("falcon");`);
      const falcon = { ship: currentShipId, hull, hullMax, shield, shieldMax, armor, cargo: getShipStats().cargo, jumpRecharge: getShipStats().jumpRecharge, evasion };
      return { monolith, bisonBeforeRepair, bisonAfterRepair, repairSyncPayload, pvpRepairBefore, pvpRepairAfter, pvpRepairSyncPayload, falcon };
    });

    expect(state.monolith).toMatchObject({ ship: "monolith", hull: 1800, hullMax: 1800, shield: 360, shieldMax: 360 });
    expect(state.bisonBeforeRepair).toMatchObject({ ship: "bison", hull: 930, hullMax: 1300, shield: 77, shieldMax: 135 });
    expect(state.bisonAfterRepair).toMatchObject({ ship: "bison", hull: 1300, hullMax: 1300, savedHull: 1300 });
    expect(state.repairSyncPayload).toMatchObject({ currentShipId: "bison", hull: 1300, hullMax: 1300, shield: 77, shieldMax: 135, armor: 18, armorMax: 18, reason: "hangar_repair" });
    expect(state.pvpRepairBefore).toMatchObject({
      localHull: 1300,
      localHullMax: 1300,
      effective: { hull: 400, hullMax: 1300, missingHull: 900, source: "pvp" }
    });
    expect(state.pvpRepairBefore.cost).toBeGreaterThan(0);
    expect(state.pvpRepairAfter).toMatchObject({
      localHull: 1300,
      localHullMax: 1300,
      effective: { hull: 1300, hullMax: 1300, missingHull: 0, source: "local" },
      displayHull: 1300,
      displayHullMax: 1300,
      savedHull: 1300
    });
    expect(state.pvpRepairSyncPayload).toMatchObject({ currentShipId: "bison", hull: 1300, hullMax: 1300, shield: 77, shieldMax: 135, armor: 18, armorMax: 18, reason: "hangar_repair" });
    expect(state.falcon).toMatchObject({ ship: "falcon", hull: 620, hullMax: 720, shield: 111, shieldMax: 180 });
    expect(state.monolith.armor).toBe(28);
    expect(state.bisonBeforeRepair.cargo).toBe(260);
    expect(state.falcon.jumpRecharge).toBe(16);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("hangar loadout explicitly equips and unequips selected weapon and attachment slots", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await waitForGameGlobals(page);
    await page.evaluate(() => {
      window.eval(`
        localStorage.clear();
        currentShipId = STARTER_SHIP_ID;
        selectedHangarShipId = STARTER_SHIP_ID;
        ownedShips = [STARTER_SHIP_ID];
        ownedGuns.pulseLaser = 1;
        ownedGuns.repeater = 1;
        ownedGuns.meltCannon = 1;
        ownedGuns.ionBlaster = 1;
        ownedAttachments.cargoPod = 1;
        ownedAttachments.shieldBooster = 1;
        ownedAttachments.hullBooster = 1;
        ownedAttachments.jumpDrive = 1;
        shipLoadouts[STARTER_SHIP_ID] = { attachments: [], guns: [] };
        showScreen("gameScreen");
        openHangar();
        showHangarSection("overview");
        saveGame();
      `);
    });
    await expect(page.locator("#hangarScreen")).toHaveClass(/active/);
    await expect(page.locator(".loadout-vault-filters button")).toHaveCount(2);

    await page.locator("#loadoutVaultFilterGuns").click();
    await expect(page.locator("#loadoutCategoryWeapons")).toHaveClass(/active/);
    await page.locator("#installedGuns .loadout-grid-slot.empty").first().click();
    await expect(page.locator("#gunInventory .hangar-equipment-card")).toHaveCount(4);
    await expect.poll(async () => page.locator("#gunInventory .hangar-equipment-card").evaluateAll((rows, selector) => {
      const list = document.querySelector(selector);
      if (!list) return 0;
      const listRect = list.getBoundingClientRect();
      return rows.filter(row => {
        const rect = row.getBoundingClientRect();
        return rect.top >= listRect.top && rect.bottom <= listRect.bottom;
      }).length;
    }, "#gunInventory")).toBeGreaterThanOrEqual(3);
    await page.locator("#gunInventory .hangar-equipment-card[data-item-key='pulseLaser']").first().click();
    await expect(page.locator("#installedGuns .loadout-grid-slot.filled")).toHaveCount(0);
    await expect(page.locator("#loadoutItemDetailPanel")).toContainText("Pulse Laser");
    await expect(page.locator("#loadoutItemDetailPanel").getByRole("button", { name: "Equip", exact: true })).toBeEnabled();
    await page.locator("#loadoutItemDetailPanel").getByRole("button", { name: "Equip", exact: true }).click();
    await expect(page.locator("#installedGuns .loadout-grid-slot.filled")).toHaveCount(1);

    await page.reload();
    await openHangar(page);
    await expect(page.locator("#installedGuns .loadout-grid-slot.filled")).toHaveCount(1);

    await page.locator("#installedGuns .loadout-grid-slot.filled").first().click();
    await expect(page.locator("#installedGuns .loadout-grid-slot.filled").first()).toHaveClass(/selected/);
    await expect(page.locator("#loadoutItemDetailPanel")).toContainText("Pulse Laser");
    await expect(page.locator("#loadoutItemDetailPanel").getByRole("button", { name: "Unequip" })).toBeEnabled();
    await page.locator("#loadoutItemDetailPanel").getByRole("button", { name: "Unequip" }).click();
    await expect(page.locator("#installedGuns .loadout-grid-slot.filled")).toHaveCount(0);
    await expect(page.locator("#gunInventory .hangar-equipment-card[data-item-key='pulseLaser']")).toHaveCount(1);

    await page.reload();
    await openHangar(page);
    await expect(page.locator("#installedGuns .loadout-grid-slot.filled")).toHaveCount(0);
    await expect(page.locator("#gunInventory .hangar-equipment-card[data-item-key='pulseLaser']")).toHaveCount(1);

    await page.locator("#loadoutVaultFilterAttachments").click();
    await expect(page.locator("#loadoutCategoryAttachments")).toHaveClass(/active/);
    await page.locator("#installedAttachments .loadout-grid-slot.empty").first().click();
    await expect(page.locator("#gunInventory .hangar-equipment-card")).toHaveCount(4);
    await expect.poll(async () => page.locator("#gunInventory .hangar-equipment-card").evaluateAll((rows, selector) => {
      const list = document.querySelector(selector);
      if (!list) return 0;
      const listRect = list.getBoundingClientRect();
      return rows.filter(row => {
        const rect = row.getBoundingClientRect();
        return rect.top >= listRect.top && rect.bottom <= listRect.bottom;
      }).length;
    }, "#gunInventory")).toBeGreaterThanOrEqual(3);
    await page.locator("#gunInventory .hangar-equipment-card[data-item-key='cargoPod']").first().click();
    await expect(page.locator("#installedAttachments .loadout-grid-slot.filled")).toHaveCount(0);
    await expect(page.locator("#loadoutItemDetailPanel")).toContainText("Cargo Pod");
    await expect(page.locator("#loadoutItemDetailPanel").getByRole("button", { name: "Equip", exact: true })).toBeEnabled();
    await page.locator("#loadoutItemDetailPanel").getByRole("button", { name: "Equip", exact: true }).click();
    await expect(page.locator("#installedAttachments .loadout-grid-slot.filled")).toHaveCount(1);

    await page.reload();
    await openHangar(page);
    await expect(page.locator("#installedAttachments .loadout-grid-slot.filled")).toHaveCount(1);

    await page.locator("#loadoutVaultFilterAttachments").click();
    await page.locator("#installedAttachments .loadout-grid-slot.filled").first().click();
    await expect(page.locator("#installedAttachments .loadout-grid-slot.filled").first()).toHaveClass(/selected/);
    await expect(page.locator("#loadoutItemDetailPanel")).toContainText("Cargo Pod");
    await expect(page.locator("#loadoutItemDetailPanel").getByRole("button", { name: "Unequip" })).toBeEnabled();
    await page.locator("#loadoutItemDetailPanel").getByRole("button", { name: "Unequip" }).click();
    await expect(page.locator("#installedAttachments .loadout-grid-slot.filled")).toHaveCount(0);
    await expect(page.locator("#gunInventory .hangar-equipment-card[data-item-key='cargoPod']")).toHaveCount(1);

    await page.reload();
    await openHangar(page);
    await expect(page.locator("#installedAttachments .loadout-grid-slot.filled")).toHaveCount(0);
    await page.locator("#loadoutVaultFilterAttachments").click();
    await expect(page.locator("#gunInventory .hangar-equipment-card[data-item-key='cargoPod']")).toHaveCount(1);

    await page.evaluate(() => {
      window.eval(`
        currentShipId = "monolith";
        selectedHangarShipId = "monolith";
        ownedShips = [STARTER_SHIP_ID, "monolith"];
        shipLoadouts.monolith = { attachments: [], guns: [] };
        showScreen("gameScreen");
        openHangar();
        showHangarSection("overview");
      `);
    });
    await expect(page.locator("#installedGuns .loadout-grid-slot.empty")).toHaveCount(6);
    await page.locator("#loadoutVaultFilterAttachments").click();
    await expect(page.locator("#installedAttachments .loadout-grid-slot.empty")).toHaveCount(4);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("Azure Striker equips and persists a Godlike Ion Blaster in weapon slot two", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await waitForGameGlobals(page);
    await page.evaluate(() => {
      window.eval(`
        localStorage.clear();
        currentShipId = "falcon";
        selectedHangarShipId = "falcon";
        selectedFleetShipId = "falcon";
        selectedShipyardShipId = "falcon";
        ownedShips = ["falcon"];
        playerProgress = normalizePlayerProgress({ combatXp: 2500 });
        ownedGuns.pulseLaser = 0;
        ownedGuns.ionBlaster = 0;
        inventoryItems = [{
          id: "godlike-ion-slot-two",
          key: "ionBlaster",
          quality: "godlike",
          level: 1
        }];
        shipLoadouts.falcon = {
          attachments: [],
          guns: [makeLeveledLoadoutEntry("pulseLaser", "standard", 1)]
        };
        shipConditions = {};
        showScreen("gameScreen");
        openHangar();
        showHangarSection("overview");
        saveGame();
      `);
    });

    await expect(page.locator("#hangarScreen")).toHaveClass(/active/);
    await expect(page.locator("#installedGuns .loadout-grid-slot.filled")).toHaveCount(1);
    await expect(page.locator("#installedGuns .loadout-grid-slot.empty")).toHaveCount(1);
    await page.locator("#installedGuns .loadout-grid-slot.empty").click();
    await expect(page.locator("#loadoutItemDetailPanel")).toContainText("Weapon 02");

    await page.locator("#loadoutVaultFilterGuns").click();
    const godlikeIon = page.locator("#gunInventory .hangar-equipment-card[data-item-key='ionBlaster']");
    await expect(godlikeIon).toHaveCount(1);
    await godlikeIon.click();
    await expect(page.locator("#loadoutItemDetailPanel")).toContainText("Ion Blaster");
    await expect(page.locator("#loadoutItemDetailPanel")).toContainText(/Godlike/i);
    await expect(page.locator("#loadoutItemDetailPanel").getByRole("button", { name: "Equip", exact: true })).toBeEnabled();
    await page.locator("#loadoutItemDetailPanel").getByRole("button", { name: "Equip", exact: true }).click();

    await expect(page.locator("#installedGuns .loadout-grid-slot.filled")).toHaveCount(2);
    let loadoutState = await page.evaluate(() => ({
      guns: shipLoadouts.falcon.guns.map(entry => ({ key: getEquipmentKey(entry), quality: getEquipmentQuality(entry), level: getEquipmentLevel(entry) })),
      inventoryCount: inventoryItems.filter(item => item.key === "ionBlaster" && item.quality === "godlike").length
    }));
    expect(loadoutState.guns[1]).toMatchObject({ key: "ionBlaster", quality: "godlike", level: 1 });
    expect(loadoutState.inventoryCount).toBe(0);

    await page.reload();
    await openHangar(page);
    await expect(page.locator("#installedGuns .loadout-grid-slot.filled")).toHaveCount(2);
    loadoutState = await page.evaluate(() => ({
      guns: shipLoadouts.falcon.guns.map(entry => ({ key: getEquipmentKey(entry), quality: getEquipmentQuality(entry), level: getEquipmentLevel(entry) })),
      inventoryCount: inventoryItems.filter(item => item.key === "ionBlaster" && item.quality === "godlike").length
    }));
    expect(loadoutState.guns[1]).toMatchObject({ key: "ionBlaster", quality: "godlike", level: 1 });
    expect(loadoutState.inventoryCount).toBe(0);

    await page.evaluate(() => {
      selectEquippedLoadoutVaultItem("guns", 1);
    });
    await expect(page.locator("#loadoutItemDetailPanel")).toContainText("Ion Blaster");
    await expect(page.locator("#loadoutItemDetailPanel").getByRole("button", { name: "Unequip" })).toBeEnabled();
    await page.locator("#loadoutItemDetailPanel").getByRole("button", { name: "Unequip" }).click();
    await expect(page.locator("#installedGuns .loadout-grid-slot.filled")).toHaveCount(1);
    loadoutState = await page.evaluate(() => ({
      guns: shipLoadouts.falcon.guns.map(entry => ({ key: getEquipmentKey(entry), quality: getEquipmentQuality(entry), level: getEquipmentLevel(entry) })),
      inventoryCount: inventoryItems.filter(item => item.key === "ionBlaster" && item.quality === "godlike").length
    }));
    expect(loadoutState.guns.some(entry => entry.key === "ionBlaster")).toBe(false);
    expect(loadoutState.inventoryCount).toBe(1);

    await page.reload();
    await openHangar(page);
    await expect(page.locator("#installedGuns .loadout-grid-slot.filled")).toHaveCount(1);
    loadoutState = await page.evaluate(() => ({
      guns: shipLoadouts.falcon.guns.map(entry => ({ key: getEquipmentKey(entry), quality: getEquipmentQuality(entry), level: getEquipmentLevel(entry) })),
      inventoryCount: inventoryItems.filter(item => item.key === "ionBlaster" && item.quality === "godlike").length
    }));
    expect(loadoutState.guns.some(entry => entry.key === "ionBlaster")).toBe(false);
    expect(loadoutState.inventoryCount).toBe(1);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("Journey screen presents chapters, missions, claim flow, and resetPilot clears progress", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/");
    await waitForGameGlobals(page);
    await page.evaluate(() => window.eval(`
      localStorage.clear();
      tutorialState = { active: false, completed: true, stepIndex: 0 };
      currentNode = "Asteron Prime";
      lastPlanetNode = "Asteron Prime";
      homePlanet = "Asteron Prime";
      currentShipId = STARTER_SHIP_ID;
      ownedShips = [STARTER_SHIP_ID];
      selectedHangarShipId = STARTER_SHIP_ID;
      selectedFleetShipId = STARTER_SHIP_ID;
      shipLoadouts = { [STARTER_SHIP_ID]: normalizeShipLoadout({ attachments: [], guns: ["pulseLaser"] }, STARTER_SHIP_ID) };
      shipConditions = {};
      credits = 10000;
      playerProgress = createDefaultPlayerProgress();
      missionProgress = createDefaultMissionProgress();
      applyShipStats(true);
      showScreen("gameScreen");
      updateHubLocation();
    `));

    await expect(page.locator(".home-bottom-dock .home-dock-item").first()).toContainText("JOURNEY");
    await expect(page.locator(".home-bottom-dock .home-dock-item")).toHaveCount(7);
    await expect(page.locator(".home-bottom-dock .home-dock-item").nth(6)).toContainText("Pilot");
    const stationDock = await page.evaluate(() => {
      const screen = document.querySelector("#gameScreen");
      const dock = document.querySelector(".home-bottom-dock");
      const buttons = Array.from(document.querySelectorAll(".home-bottom-dock .home-dock-item"));
      const journeyButton = document.querySelector("#journeyHubBtn");
      const journeyIcon = journeyButton?.querySelector("img");
      const journeyLabel = journeyButton?.querySelector("span:not(.hub-action-badge)");
      const screenStyles = screen ? getComputedStyle(screen) : null;
      const screenBeforeStyles = screen ? getComputedStyle(screen, "::before") : null;
      const dockRect = dock?.getBoundingClientRect();
      const journeyIconRect = journeyIcon?.getBoundingClientRect();
      const siblingIconRects = buttons
        .filter(button => button.id !== "journeyHubBtn")
        .map(button => button.querySelector("img")?.getBoundingClientRect())
        .filter(Boolean);
      const averageSiblingIconHeight = siblingIconRects.length
        ? siblingIconRects.reduce((total, rect) => total + rect.height, 0) / siblingIconRects.length
        : 0;
      const journeyIconSrc = journeyIcon?.getAttribute("src") || "";
      return {
        journeyIconSrc,
        journeyIconComplete: Boolean(journeyIcon?.complete),
        journeyIconNaturalWidth: journeyIcon?.naturalWidth || 0,
        journeyIconNaturalHeight: journeyIcon?.naturalHeight || 0,
        journeyIconHeight: journeyIconRect?.height || 0,
        averageSiblingIconHeight,
        journeyLabel: journeyLabel?.textContent?.trim() || "",
        journeyUsesMorganImage: journeyIconSrc.includes("morgan"),
        hasJourneySvg: Boolean(document.querySelector("#journeyHubBtn svg")),
        homeScreenBorderWidth: parseFloat(screenStyles?.borderTopWidth || "0"),
        homeScreenFrameContent: screenBeforeStyles?.content || "",
        homeScreenFrameBorderWidth: parseFloat(screenBeforeStyles?.borderTopWidth || "0"),
        homeScreenFrameBackgroundImage: screenBeforeStyles?.backgroundImage || "none",
        count: buttons.length,
        allFit: Boolean(dockRect) && buttons.every(button => {
          const rect = button.getBoundingClientRect();
          return rect.width > 0 &&
            rect.height > 0 &&
            rect.left >= dockRect.left - 1 &&
            rect.right <= dockRect.right + 1 &&
            rect.top >= dockRect.top - 1 &&
            rect.bottom <= dockRect.bottom + 1;
        }),
        pilotVisible: (() => {
          const pilot = buttons[6];
          const rect = pilot?.getBoundingClientRect();
          return Boolean(rect && rect.width > 0 && rect.height > 0);
        })()
      };
    });
    expect(stationDock).toMatchObject({
      count: 7,
      allFit: true,
      pilotVisible: true,
      journeyUsesMorganImage: false,
      journeyIconSrc: "assets/icons/journey-icon.png",
      journeyLabel: "JOURNEY",
      hasJourneySvg: false
    });
    expect(stationDock.journeyIconComplete).toBe(true);
    expect(stationDock.journeyIconNaturalWidth).toBeGreaterThan(0);
    expect(stationDock.journeyIconNaturalHeight).toBeGreaterThan(0);
    expect(stationDock.journeyIconHeight).toBeGreaterThan(0);
    expect(Math.abs(stationDock.journeyIconHeight - stationDock.averageSiblingIconHeight)).toBeLessThanOrEqual(8);
    expect(stationDock.homeScreenBorderWidth).toBeGreaterThan(0);
    expect(stationDock.homeScreenFrameContent).toBe("none");
    expect(stationDock.homeScreenFrameBorderWidth).toBe(0);
    expect(stationDock.homeScreenFrameBackgroundImage).toBe("none");

    fs.mkdirSync("artifacts", { recursive: true });
    await page.locator("#gameScreen").screenshot({ path: "artifacts/planet-home-journey-icon.png" });
    await page.locator("#gameScreen").screenshot({ path: "artifacts/planet-home-frame-cleanup.png" });

    await page.locator(".home-bottom-dock .home-dock-item").nth(6).click();
    await expect(page.locator("#pilotProfileScreen")).toHaveClass(/active/);
    await page.locator("#pilotProfileScreen .screen-back-btn").click();
    await expect(page.locator("#gameScreen")).toHaveClass(/active/);

    await page.locator("#journeyHubBtn").click();
    await expect(page.locator("#journeyScreen")).toHaveClass(/active/);
    const journeyScreenBackground = await page.locator("#journeyScreen").evaluate(screen => {
      const styles = getComputedStyle(screen);
      return {
        backgroundImage: styles.backgroundImage,
        backgroundSize: styles.backgroundSize,
        backgroundPosition: styles.backgroundPosition,
        backgroundRepeat: styles.backgroundRepeat
      };
    });
    expect(journeyScreenBackground.backgroundImage).toContain("journey-screen-bg.png");
    expect(journeyScreenBackground.backgroundSize).toContain("cover");
    expect(journeyScreenBackground.backgroundPosition).toContain("50% 50%");
    expect(journeyScreenBackground.backgroundRepeat).toBe("no-repeat, no-repeat, no-repeat");
    await expect(page.locator("#journeyScreen .journey-briefing")).toBeVisible();
    await expect(page.locator("#journeyScreen .journey-briefing__portrait-img")).toHaveAttribute("src", /morgan-command-liaison\.png/);
    const morganBriefingBg = await page.locator("#journeyScreen .journey-briefing__bg").evaluate(element => {
      const styles = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return {
        backgroundImage: styles.backgroundImage,
        width: rect.width,
        height: rect.height
      };
    });
    expect(morganBriefingBg.backgroundImage).toContain("journey-morgan-bg.png");
    expect(morganBriefingBg.width).toBeGreaterThan(0);
    expect(morganBriefingBg.height).toBeGreaterThan(0);
    const morganBriefingLayout = await page.locator("#journeyScreen .journey-briefing").evaluate(panel => {
      const panelRect = panel.getBoundingClientRect();
      const portraitRect = panel.querySelector(".journey-briefing__portrait")?.getBoundingClientRect();
      const contentRect = panel.querySelector(".journey-briefing__content")?.getBoundingClientRect();
      const bgRect = panel.querySelector(".journey-briefing__bg")?.getBoundingClientRect();
      return {
        panelWidth: panelRect.width,
        panelHeight: panelRect.height,
        portraitLeft: portraitRect?.left || 0,
        portraitWidth: portraitRect?.width || 0,
        contentLeft: contentRect?.left || 0,
        contentWidth: contentRect?.width || 0,
        bgWidth: bgRect?.width || 0
      };
    });
    expect(morganBriefingLayout.panelHeight).toBeGreaterThan(105);
    expect(morganBriefingLayout.panelHeight).toBeLessThan(165);
    expect(morganBriefingLayout.portraitWidth).toBeGreaterThan(95);
    expect(morganBriefingLayout.contentLeft).toBeGreaterThan(morganBriefingLayout.portraitLeft);
    expect(morganBriefingLayout.contentWidth).toBeGreaterThan(360);
    expect(morganBriefingLayout.bgWidth).toBeGreaterThan(morganBriefingLayout.panelWidth * 0.45);
    const journeyFrameLayout = await page.locator("#journeyScreen").evaluate(screen => {
      const headerRect = screen.querySelector(".market-header")?.getBoundingClientRect();
      const panels = [
        ".journey-briefing",
        ".journey-chapters-panel",
        ".journey-current-path",
        ".journey-side-panel",
        ".journey-galaxy-strip"
      ].map(selector => {
        const rect = screen.querySelector(selector)?.getBoundingClientRect();
        return {
          selector,
          left: rect?.left || 0,
          right: rect?.right || 0
        };
      });
      return {
        headerLeft: headerRect?.left || 0,
        headerRight: headerRect?.right || 0,
        panels
      };
    });
    for (const panel of journeyFrameLayout.panels) {
      expect(panel.left).toBeGreaterThanOrEqual(journeyFrameLayout.headerLeft - 1);
      expect(panel.right).toBeLessThanOrEqual(journeyFrameLayout.headerRight + 1);
    }
    const fullWidthPanels = journeyFrameLayout.panels.filter(panel => (
      panel.selector === ".journey-briefing" ||
      panel.selector === ".journey-chapters-panel" ||
      panel.selector === ".journey-galaxy-strip"
    ));
    for (const panel of fullWidthPanels) {
      expect(Math.abs(panel.left - journeyFrameLayout.headerLeft)).toBeLessThanOrEqual(1);
      expect(Math.abs(panel.right - journeyFrameLayout.headerRight)).toBeLessThanOrEqual(1);
    }
    await expect(page.locator("#journeyScreen")).toContainText("MORGAN");
    await expect(page.locator("#journeyScreen")).toContainText("COMMAND LIAISON");
    await expect(page.locator("#journeyScreen")).toContainText("FRONTIER BRIEFING");
    await expect(page.locator("#journeyScreen")).not.toContainText("STATION AI");
    await expect(page.locator("#journeyScreen")).toContainText("Frontier is active, Pilot.");
    await expect(page.locator("#journeyScreen")).toContainText("CHAPTER ROUTE");
    await expect(page.locator("#journeyScreen")).toContainText("Academy");
    await expect(page.locator("#journeyScreen [data-journey-chapter-id='academy']")).toContainText("ACTIVE");
    await expect(page.locator("#journeyScreen")).toContainText("Chapter I");
    await expect(page.locator("#journeyScreen")).toContainText("Frontier");
    await expect(page.locator("#journeyScreen [data-journey-chapter-id='frontier']")).toContainText("PENDING");
    await expect(page.locator("#journeyScreen")).toContainText("Chapter II");
    await expect(page.locator("#journeyScreen")).toContainText("Locked Route");
    await expect(page.locator("#journeyScreen")).toContainText("LOCKED");
    await expect(page.locator("#journeyScreen .journey-chapter-path")).not.toContainText("OUTER RIM");
    await expect(page.locator("#journeyScreen .journey-chapter-path")).not.toContainText("BORDER WORLDS");
    await expect(page.locator("#journeyScreen")).toContainText("CURRENT PATH");
    await expect(page.locator("#journeyScreen")).toContainText("Academy Assignments");
    await expect(page.locator("#journeyScreen")).not.toContainText("Frontier Assignments");
    await expect(page.locator("#journeyScreen")).toContainText("CHAPTER PROGRESS");
    await expect(page.locator("#journeyScreen .journey-frontier-status")).toContainText("Academy Progress");
    await expect(page.locator("#journeyScreen .journey-frontier-status")).toContainText("Requirements Complete");
    await expect(page.locator("#journeyScreen .journey-frontier-status")).toContainText("0 / 7");
    await expect(page.locator("#journeyScreen .journey-frontier-status")).not.toContainText("Chapter Unlock");
    await expect(page.locator("#journeyScreen .journey-frontier-status")).not.toContainText("Next Route");
    await expect(page.locator("#journeyScreen .journey-frontier-status")).not.toContainText("Completion Unlocks");
    await expect(page.locator("#journeyScreen .journey-frontier-status")).not.toContainText("Active Assignment");
    await expect(page.locator("#journeyScreen")).toContainText("OVERALL GALAXY COMPLETION");
    await expect(page.locator("#journeyScreen")).toContainText("Claim Starter Ship");
    await expect(page.locator("#journeyScreen")).toContainText("Launch Ship");
    await expect(page.locator("#journeyScreen")).toContainText("Complete First Trade");
    await expect(page.locator("#journeyScreen")).toContainText("Equip Two Guns");
    await expect(page.locator("#journeyScreen")).toContainText("Equip Attachment");
    await expect(page.locator("#journeyScreen")).toContainText("Destroy 3 Erebus Bots");
    await expect(page.locator("#journeyScreen")).toContainText("Repair Ship");
    await expect(page.locator("#journeyScreen")).toContainText("Claim or activate the starter ship");
    await expect(page.locator("#journeyScreen")).toContainText("0 / 1");
    await expect(page.locator("#journeyScreen .journey-chapter-path")).toHaveAttribute("data-journey-source", "JOURNEY_CHAPTERS");
    await expect(page.locator("#journeyScreen .journey-assignment-grid")).toHaveAttribute("data-journey-source", "JOURNEY_ASSIGNMENTS");
    await expect(page.locator("#journeyScreen .journey-objective-row")).toHaveCount(7);
    await expect(page.locator("#journeyScreen .journey-assignment-card")).toHaveCount(7);
    await expect(page.locator("#journeyScreen .journey-assignment-grid")).not.toContainText("TRACKING");
    await expect(page.locator("#journeyScreen .journey-assignment-grid")).not.toContainText("NOT STARTED");
    await expect(page.locator("#journeyScreen .journey-assignment-grid")).not.toContainText("Accept Mission");
    await expect(page.locator("#journeyScreen .journey-assignment-grid")).not.toContainText("Claim Reward");
    await expect(page.locator("#journeyScreen .journey-assignment-icon img")).toHaveCount(7);
    await expect(page.locator("#journeyScreen .journey-assignment-grid .journey-reward-chips")).toHaveCount(0);
    const initialGalaxyFooter = await page.locator("#journeyScreen .journey-galaxy-strip").evaluate(footer => {
      const rect = footer.getBoundingClientRect();
      const text = footer.querySelector("span")?.getBoundingClientRect();
      const bar = footer.querySelector(".journey-progress-track")?.getBoundingClientRect();
      const percent = footer.querySelector("strong")?.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        height: rect.height,
        textTop: text?.top || 0,
        barTop: bar?.top || 0,
        percentTop: percent?.top || 0,
        visible: rect.top >= 0 && rect.bottom <= window.innerHeight,
        singleLine: Boolean(text && bar && percent && Math.abs(text.top - percent.top) < 8 && Math.abs(bar.top - text.top) < 14),
        percentText: footer.querySelector("strong")?.textContent?.trim() || ""
      };
    });
    expect(initialGalaxyFooter.visible).toBe(true);
    expect(initialGalaxyFooter.singleLine).toBe(true);
    expect(initialGalaxyFooter.height).toBeLessThan(34);
    expect(initialGalaxyFooter.percentText).toBe("2%");
    const academyAssignmentScroll = await page.locator("#journeyScreen .journey-assignment-grid").evaluate(grid => {
      const firstCard = grid.querySelector(".journey-assignment-card")?.getBoundingClientRect();
      return {
        clientHeight: grid.clientHeight,
        scrollHeight: grid.scrollHeight,
        overflowY: getComputedStyle(grid).overflowY,
        firstCardHeight: firstCard?.height || 0
      };
    });
    expect(["auto", "scroll"]).toContain(academyAssignmentScroll.overflowY);
    expect(academyAssignmentScroll.scrollHeight).toBeGreaterThanOrEqual(academyAssignmentScroll.clientHeight);
    expect(academyAssignmentScroll.firstCardHeight).toBeLessThan(105);
    await page.locator("#journeyScreen .journey-assignment-grid").evaluate(grid => { grid.scrollTop = grid.scrollHeight; });
    await expect(page.locator("#journeyScreen [data-journey-assignment-id='academy_repair_ship']")).toBeVisible();
    await page.evaluate(() => {
      missionProgress = normalizeMissionProgress(missionProgress);
      ["academy_starter_ship", "academy_launch_ship"].forEach(id => {
        const mission = MISSIONS_BY_ID[id];
        missionProgress.missions[id] = {
          ...missionProgress.missions[id],
          state: "completed",
          progress: getMissionRequiredAmount(mission)
        };
      });
      renderJourneyScreen();
    });
    await expect(page.locator("#journeyScreen .journey-frontier-status")).toContainText("Academy Progress");
    await expect(page.locator("#journeyScreen .journey-frontier-status")).toContainText("29%");
    await expect(page.locator("#journeyScreen .journey-frontier-status")).toContainText("2 / 7");
    const completedAcademyCard = await page.locator("#journeyScreen [data-journey-assignment-id='academy_launch_ship']").evaluate(card => {
      const styles = getComputedStyle(card);
      const pill = card.querySelector(".journey-status-pill");
      const progress = card.querySelector(".journey-progress-track i");
      const progressStyles = progress ? getComputedStyle(progress) : null;
      return {
        className: card.className,
        borderColor: styles.borderColor,
        boxShadow: styles.boxShadow,
        badgeText: pill?.textContent?.trim() || "",
        badgeCheck: pill ? getComputedStyle(pill, "::before").content : "",
        progressWidth: progress?.style.width || "",
        progressBackground: progressStyles?.backgroundImage || progressStyles?.backgroundColor || ""
      };
    });
    expect(completedAcademyCard.className).toContain("mission-state-claimable");
    expect(completedAcademyCard.badgeText).toContain("COMPLETE");
    expect(completedAcademyCard.badgeCheck).toContain("✓");
    expect(completedAcademyCard.progressWidth).toBe("100%");
    expect(completedAcademyCard.borderColor).toMatch(/70, 230, 164|54, 242, 143|109, 255, 173/);
    expect(completedAcademyCard.boxShadow).toMatch(/70, 230, 164|54, 242, 143|109, 255, 173/);
    expect(completedAcademyCard.progressBackground).toMatch(/54, 242, 143|141, 255, 196|linear-gradient/);
    const partialGalaxyFooter = await page.locator("#journeyScreen .journey-galaxy-strip").evaluate(footer => {
      const rect = footer.getBoundingClientRect();
      const current = Number((footer.querySelector("strong")?.textContent || "0").replace(/[^0-9]/g, ""));
      const assignmentGrid = document.querySelector(".journey-assignment-grid")?.getBoundingClientRect();
      return {
        current,
        visible: rect.top >= 0 && rect.bottom <= window.innerHeight,
        separatedFromAssignments: !assignmentGrid || rect.top >= assignmentGrid.bottom
      };
    });
    expect(partialGalaxyFooter.current).toBeGreaterThan(0);
    expect(partialGalaxyFooter.current).toBeLessThan(29);
    expect(partialGalaxyFooter.visible).toBe(true);
    expect(partialGalaxyFooter.separatedFromAssignments).toBe(true);
    await page.evaluate(() => {
      ["academy_starter_ship", "academy_launch_ship"].forEach(id => {
        missionProgress.missions[id] = { state: "available", progress: 0 };
      });
      renderJourneyScreen();
    });
    await expect(page.locator("#journeyScreen .journey-chapter-route")).toBeVisible();
    await expect(page.locator("#journeyScreen .journey-chapter-route__viewport")).toBeVisible();
    await expect(page.locator("#journeyScreen .journey-chapter-route__track")).toBeVisible();
    await expect(page.locator("#journeyScreen .journey-chapter-node")).toHaveCount(3);
    await expect(page.locator("#journeyScreen [data-journey-chapter-id='academy']")).toHaveAttribute("data-journey-chapter-state", "active");
    await expect(page.locator("#journeyScreen [data-journey-chapter-id='academy']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#journeyScreen [data-journey-chapter-id='frontier']")).toHaveAttribute("data-journey-chapter-state", "pending");
    await expect(page.locator("#journeyScreen [data-journey-chapter-id='frontier']")).toHaveAttribute("aria-pressed", "false");
    await expect(page.locator("#journeyScreen [data-journey-chapter-id='next_route']")).toHaveAttribute("data-journey-chapter-state", "locked");
    await expect(page.locator("#journeyScreen .journey-chapter-node--active")).toContainText("Academy");
    await expect(page.locator("#journeyScreen .journey-chapter-node--pending")).toContainText("Chapter I");
    await expect(page.locator("#journeyScreen .journey-chapter-node--pending")).toContainText("Frontier");
    await expect(page.locator("#journeyScreen .journey-chapter-node--locked")).toContainText("Chapter II");
    await expect(page.locator("#journeyScreen .journey-chapter-node--locked")).toContainText("Locked Route");
    await expect(page.locator("#journeyScreen .journey-chapter-progress")).toHaveCount(0);
    await expect(page.locator("#journeyScreen .journey-chapter-route__icon img").nth(0)).toHaveAttribute("src", /chapter-academy-icon\.png/);
    await expect(page.locator("#journeyScreen .journey-chapter-route__icon img").nth(1)).toHaveAttribute("src", /chapter-frontier-icon\.png/);
    await expect(page.locator("#journeyScreen .journey-chapter-route__icon img").nth(2)).toHaveAttribute("src", /chapter-locked-icon\.png/);
    await expect(page.locator("#journeyScreen .journey-chapter-route__icon img").nth(0)).toHaveAttribute("alt", "Academy");
    await expect(page.locator("#journeyScreen .journey-chapter-route__icon img").nth(1)).toHaveAttribute("alt", "Chapter I: Frontier");
    await expect(page.locator("#journeyScreen .journey-chapter-route__icon img").nth(2)).toHaveAttribute("alt", "Locked route");
    const chapterRouteLayout = await page.locator("#journeyScreen .journey-chapter-route").evaluate(route => {
      const routeRect = route.getBoundingClientRect();
      const track = route.querySelector(".journey-chapter-route__track");
      const trackStyles = track ? getComputedStyle(track) : null;
      return {
        height: routeRect.height,
        trackOverflowX: trackStyles?.overflowX || "",
        trackDisplay: trackStyles?.display || "",
        visibleArrows: Array.from(route.querySelectorAll(".journey-chapter-route__arrow")).filter(arrow => getComputedStyle(arrow).display !== "none").length,
        visibleScrollbar: getComputedStyle(route.querySelector(".journey-chapter-route__scrollbar")).display !== "none",
        itemCount: route.querySelectorAll(".journey-chapter-route__item").length
      };
    });
    expect(chapterRouteLayout.height).toBeGreaterThan(65);
    expect(chapterRouteLayout.height).toBeLessThan(96);
    expect(chapterRouteLayout.trackDisplay).toBe("flex");
    expect(["auto", "scroll"]).toContain(chapterRouteLayout.trackOverflowX);
    expect(chapterRouteLayout.visibleArrows).toBe(0);
    expect(chapterRouteLayout.visibleScrollbar).toBe(false);
    expect(chapterRouteLayout.itemCount).toBe(3);
    const chapterRouteCanOverflow = await page.locator("#journeyScreen .journey-chapter-route__track").evaluate(track => {
      const previousWidth = track.style.width;
      track.style.width = "280px";
      const canOverflow = track.scrollWidth > track.clientWidth;
      track.style.width = previousWidth;
      return canOverflow;
    });
    expect(chapterRouteCanOverflow).toBe(true);
    const chapterIconTransparency = await page.locator("#journeyScreen .journey-chapter-route__icon img").evaluateAll(async icons => {
      await Promise.all(icons.map(icon => icon.decode?.().catch(() => {}) || Promise.resolve()));
      return icons.map(icon => {
        const canvas = document.createElement("canvas");
        canvas.width = icon.naturalWidth;
        canvas.height = icon.naturalHeight;
        const context = canvas.getContext("2d");
        context.drawImage(icon, 0, 0);
        const points = [
          [0, 0],
          [canvas.width - 1, 0],
          [0, canvas.height - 1],
          [canvas.width - 1, canvas.height - 1]
        ];
        return points.map(([x, y]) => context.getImageData(x, y, 1, 1).data[3]);
      });
    });
    for (const cornerAlphas of chapterIconTransparency) {
      expect(Math.max(...cornerAlphas)).toBeLessThan(8);
    }
    await page.locator("#journeyScreen [data-journey-chapter-id='academy']").click();
    await expect(page.locator("#journeyScreen [data-journey-chapter-id='academy']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#journeyScreen")).toContainText("Academy Assignments");
    await expect(page.locator("#journeyScreen .journey-assignment-card").first()).toContainText("Claim Starter Ship");
    await page.locator("#journeyScreen [data-journey-chapter-id='frontier']").click();
    await expect(page.locator("#journeyScreen")).toContainText("Complete Academy to activate Chapter I: Frontier.");
    await expect(page.locator("#journeyScreen [data-journey-chapter-id='frontier']")).toHaveAttribute("aria-pressed", "false");
    await page.locator("#journeyScreen [data-journey-chapter-id='next_route']").click();
    await expect(page.locator("#journeyScreen")).toContainText("Complete Frontier");
    await expect(page.locator("#journeyScreen .journey-assignment-card").first()).toContainText("Claim Starter Ship");
    await page.evaluate(() => {
      playerProgress.academyCompleted = false;
      missionProgress = normalizeMissionProgress(missionProgress);
      JOURNEY_ASSIGNMENTS
        .filter(assignment => assignment.chapterId === "academy")
        .forEach(assignment => {
          const mission = MISSIONS_BY_ID[assignment.id];
          missionProgress.missions[assignment.id] = {
            state: "completed",
            progress: getMissionRequiredAmount(mission)
          };
        });
      renderJourneyScreen();
    });
    await expect(page.locator("#journeyScreen [data-journey-chapter-id='academy']")).toHaveAttribute("data-journey-chapter-state", "complete");
    await expect(page.locator("#journeyScreen [data-journey-chapter-id='academy'] .journey-chapter-route__check")).toBeVisible();
    await expect(page.locator("#journeyScreen [data-journey-chapter-id='frontier']")).toHaveAttribute("data-journey-chapter-state", "active");
    await expect(page.locator("#journeyScreen [data-journey-chapter-id='frontier']")).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#journeyScreen .journey-frontier-status")).toContainText("Frontier Progress");
    await expect(page.locator("#journeyScreen .journey-frontier-status")).toContainText("0 / 4");
    await expect(page.locator("#journeyScreen")).toContainText("Frontier Assignments");
    await expect(page.locator("#journeyScreen [data-journey-assignment-id='sector_orientation']")).toBeVisible();
    await page.evaluate(() => {
      playerProgress.academyCompleted = false;
      JOURNEY_ASSIGNMENTS
        .filter(assignment => assignment.chapterId === "academy")
        .forEach(assignment => {
          missionProgress.missions[assignment.id] = { state: "available", progress: 0 };
        });
      renderJourneyScreen();
    });
    await expect(page.locator("#journeyScreen [data-journey-chapter-id='academy']")).toHaveAttribute("data-journey-chapter-state", "active");
    await expect(page.locator("#journeyScreen .journey-frontier-status")).toContainText("0 / 7");
    await expect(page.locator("#journeyScreen .journey-objective-row")).toHaveCount(7);
    await expect(page.locator("#journeyScreen .journey-assignment-card")).toHaveCount(7);
    await expect(page.locator("#journeyScreen .journey-assignment-card").first()).toContainText("Claim Starter Ship");
    await expect(page.locator("#journeyScreen .journey-assignment-grid")).not.toContainText("TRACKING");
    await expect(page.locator("#journeyScreen .journey-assignment-grid")).not.toContainText("NOT STARTED");
    await expect(page.locator("#journeyScreen .journey-assignment-grid")).not.toContainText("Accept Mission");
    await expect(page.locator("#journeyScreen .journey-assignment-grid")).not.toContainText("Claim Reward");
    await expect(page.locator("#journeyScreen .journey-assignment-icon img")).toHaveCount(7);

    await page.locator("#journeyScreen .screen-back-btn").click();
    await expect(page.locator("#gameScreen")).toHaveClass(/active/);

    await page.locator("#journeyHubBtn").click();
    await expect(page.locator("#journeyScreen")).toHaveClass(/active/);

    await page.evaluate(() => window.launchShip());
    await expect(page.locator("#spaceScreen")).toHaveClass(/active/);
    await expect(page.locator("#activeMissionSummary")).toContainText("Launch Ship");
    await expect(page.locator("#activeMissionSummary")).toContainText("COMPLETE");
    await expect(page.evaluate(() => window.eval(`missionProgress.missions.academy_launch_ship.state`))).resolves.toBe("completed");

    await page.evaluate(() => window.landOnPlanet());
    await page.locator("#journeyHubBtn").click();
    await expect(page.locator("#journeyScreen [data-journey-assignment-id='academy_launch_ship']")).toContainText("1 / 1");
    await expect(page.locator("#journeyScreen [data-journey-assignment-id='academy_launch_ship']")).toContainText("COMPLETE");
    await expect(page.locator("#journeyScreen [data-journey-assignment-id='academy_launch_ship']")).not.toContainText("Claim Reward");

    const academyProgress = await page.evaluate(() => window.eval(`
      recordMissionEvent("profitable_trade", { profit: 250 });
      recordMissionEvent("equip_guns", { equippedCount: 2 });
      recordMissionEvent("equip_attachment", { equippedCount: 1 });
      recordMissionEvent("destroy_bot", { target: "erebus" });
      recordMissionEvent("destroy_bot", { target: "erebus" });
      recordMissionEvent("destroy_bot", { target: "erebus" });
      recordMissionEvent("repair_ship", { shipId: currentShipId || "falcon" });
      recordMissionEvent("starter_ship_claimed", { shipId: currentShipId || "falcon" });
      ({
        starter: missionProgress.missions.academy_starter_ship,
        trade: missionProgress.missions.academy_first_trade,
        guns: missionProgress.missions.academy_two_guns,
        attachment: missionProgress.missions.academy_attachment,
        bots: missionProgress.missions.academy_erebus_bots,
        repair: missionProgress.missions.academy_repair_ship,
        savedTrade: JSON.parse(localStorage.getItem("lupenGameState"))?.missionProgress?.missions?.academy_first_trade,
        frontierHaul: missionProgress.missions.first_haul
      })
    `));
    expect(academyProgress.starter).toMatchObject({ state: "completed", progress: 1 });
    expect(academyProgress.trade).toMatchObject({ state: "completed", progress: 1 });
    expect(academyProgress.guns).toMatchObject({ state: "completed", progress: 2 });
    expect(academyProgress.attachment).toMatchObject({ state: "completed", progress: 1 });
    expect(academyProgress.bots).toMatchObject({ state: "completed", progress: 3 });
    expect(academyProgress.repair).toMatchObject({ state: "completed", progress: 1 });
    expect(academyProgress.savedTrade).toMatchObject({ state: "completed", progress: 1 });
    expect(academyProgress.frontierHaul).toMatchObject({ state: "available", progress: 0 });
    await expect(page.locator("#journeyScreen [data-journey-chapter-id='academy']")).toHaveAttribute("data-journey-chapter-state", "complete");
    await expect(page.locator("#journeyScreen [data-journey-chapter-id='frontier']")).toHaveAttribute("data-journey-chapter-state", "active");
    await expect(page.locator("#journeyScreen")).toContainText("Frontier Assignments");

    const haulProgress = await page.evaluate(() => window.eval(`
      recordMissionEvent("profitable_trade", { profit: 250 });
      ({
        runtime: missionProgress.missions.first_haul,
        saved: JSON.parse(localStorage.getItem("lupenGameState"))?.missionProgress?.missions?.first_haul
      })
    `));
    expect(haulProgress.runtime).toMatchObject({ state: "completed", progress: 1 });
    expect(haulProgress.saved).toMatchObject({ state: "completed", progress: 1 });
    await expect(page.locator("#journeyScreen [data-journey-assignment-id='first_haul']")).toContainText("1 / 1");
    await expect(page.locator("#journeyScreen [data-journey-assignment-id='first_haul']")).toContainText("COMPLETE");
    await expect(page.locator("#journeyScreen [data-journey-assignment-id='first_haul']")).toContainText("Claim Reward");
    await page.locator("#journeyScreen [data-journey-assignment-id='first_haul'] button", { hasText: "Claim Reward" }).click();
    await expect(page.evaluate(() => window.eval(`missionProgress.missions.first_haul.state`))).resolves.toBe("claimed");
    await expect(page.evaluate(() => window.eval(`credits`))).resolves.toBe(10250);

    const resetState = await page.evaluate(async () => {
      await window.lupenResetPilotProgress({ reload: false });
      return {
        runtime: window.eval(`missionProgress.missions.academy_launch_ship`),
        saved: JSON.parse(localStorage.getItem("lupenGameState"))?.missionProgress?.missions?.academy_launch_ship,
        starterRuntime: window.eval(`missionProgress.missions.academy_starter_ship`),
        starterSaved: JSON.parse(localStorage.getItem("lupenGameState"))?.missionProgress?.missions?.academy_starter_ship,
        haulRuntime: window.eval(`missionProgress.missions.first_haul`),
        haulSaved: JSON.parse(localStorage.getItem("lupenGameState"))?.missionProgress?.missions?.first_haul
      };
    });

    expect(resetState.runtime).toMatchObject({ state: "available", progress: 0 });
    expect(resetState.saved).toMatchObject({ state: "available", progress: 0 });
    expect(resetState.starterRuntime).toMatchObject({ state: "available", progress: 0 });
    expect(resetState.starterSaved).toMatchObject({ state: "available", progress: 0 });
    expect(resetState.haulRuntime).toMatchObject({ state: "available", progress: 0 });
    expect(resetState.haulSaved).toMatchObject({ state: "available", progress: 0 });
    await page.evaluate(() => {
      showScreen("gameScreen");
      updateHubLocation();
      openJourney();
    });
    await expect(page.locator("#journeyScreen [data-journey-chapter-id='academy']")).toHaveAttribute("data-journey-chapter-state", "active");
    await expect(page.locator("#journeyScreen .journey-frontier-status")).toContainText("1 / 7");
    await expect(page.locator("#journeyScreen")).toContainText("Academy Assignments");
    await expect(page.locator("#journeyScreen [data-journey-assignment-id='academy_launch_ship']")).toContainText("0 / 1");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("all new ships accept guns, equipment, combat stats, and cargo math", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await waitForGameGlobals(page);

    const matrix = await page.evaluate(() => window.eval(`
      (() => {
        const shipIds = ["falcon", "bison", "monolith", "zeusExplorer", "hephaestusTrader", "poseidonAggressor"];
        const alerts = [];
        const previousAlert = window.alert;
        window.alert = (message) => alerts.push(String(message || ""));
        localStorage.clear();
        ownedShips = shipIds.slice();
        shipConditions = {};
        mineralKeys.forEach(key => { cargo[key] = 0; });
        Object.keys(cargoCostBasis).forEach(key => { delete cargoCostBasis[key]; });
        currentNode = "Asteron Prime";
        lastPlanetNode = "Asteron Prime";
        credits = 1000000;

        const rows = shipIds.map(shipId => {
          const ship = SHIPS[shipId];
          currentShipId = shipId;
          selectedHangarShipId = shipId;
          selectedFleetShipId = shipId;
          selectedShipyardShipId = shipId;
          selectedShipyardStoreShipId = shipId;
          shipLoadouts[shipId] = { attachments: [], guns: [] };
          ownedGuns.pulseLaser = Math.max(ownedGuns.pulseLaser || 0, ship.gunSlots + 2);
          ownedAttachments.cargoPod = Math.max(ownedAttachments.cargoPod || 0, ship.attachmentSlots + 2);

          applyShipStats(true);
          const baseStats = getShipStats(shipId);
          const baseCondition = ensureShipCondition(shipId);

          for (let i = 0; i < ship.gunSlots; i += 1) {
            equipGunFromInventory("pulseLaser");
          }
          const gunCount = countEquippedGuns(shipId);
          const weapon = getEquippedWeapon(shipId);
          equipGunFromInventory("pulseLaser");
          const gunCountAfterOverflow = countEquippedGuns(shipId);

          for (let i = 0; i < ship.attachmentSlots; i += 1) {
            equipAttachmentFromInventory("cargoPod");
          }
          const attachmentCount = countEquippedAttachments(shipId);
          const cargoStats = getShipStats(shipId);
          equipAttachmentFromInventory("cargoPod");
          const attachmentCountAfterOverflow = countEquippedAttachments(shipId);

          mineralKeys.forEach(key => { cargo[key] = 0; });
          cargo.Iron = Math.max(0, cargoStats.cargo - 1);
          const usedCargo = cargoUsed();
          const freeCargo = cargoStats.cargo - usedCargo;

          return {
            id: shipId,
            name: ship.name,
            image: ship.image,
            gunSlots: ship.gunSlots,
            attachmentSlots: ship.attachmentSlots,
            gunCount,
            gunCountAfterOverflow,
            attachmentCount,
            attachmentCountAfterOverflow,
            baseCargo: baseStats.cargo,
            cargoWithPods: cargoStats.cargo,
            cargoDelta: cargoStats.cargo - baseStats.cargo,
            usedCargo,
            freeCargo,
            hull,
            hullMax,
            shield,
            shieldMax,
            conditionHull: baseCondition.hull,
            conditionShield: baseCondition.shield,
            weaponCount: weapon.count,
            weaponDamage: weapon.damage,
            weaponShieldDamage: weapon.damageLayers.shield,
            weaponName: weapon.name
          };
        });

        window.alert = previousAlert;
        return { rows, alerts };
      })()
    `));

    expect(matrix.rows).toHaveLength(6);
    expect(matrix.alerts.filter(message => /No empty gun slots|No empty attachment slots/.test(message))).toHaveLength(12);
    for (const row of matrix.rows) {
      expect(row.image, row.name).toMatch(/assets\/ships\/.+\.webp$/);
      expect(row.gunCount, row.name).toBe(row.gunSlots);
      expect(row.gunCountAfterOverflow, row.name).toBe(row.gunSlots);
      expect(row.attachmentCount, row.name).toBe(row.attachmentSlots);
      expect(row.attachmentCountAfterOverflow, row.name).toBe(row.attachmentSlots);
      expect(row.cargoDelta, row.name).toBe(row.attachmentSlots * 25);
      expect(row.usedCargo, row.name).toBe(row.cargoWithPods - 1);
      expect(row.freeCargo, row.name).toBe(1);
      expect(row.hull, row.name).toBe(row.hullMax);
      expect(row.shield, row.name).toBe(row.shieldMax);
      expect(row.conditionHull, row.name).toBeGreaterThan(0);
      expect(row.conditionShield, row.name).toBeGreaterThan(0);
      expect(row.weaponCount, row.name).toBe(row.gunSlots);
      expect(row.weaponDamage, row.name).toBeGreaterThan(0);
      expect(row.weaponShieldDamage, row.name).toBeGreaterThan(0);
      expect(row.weaponName, row.name).toContain("Pulse Laser");
    }

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("store and loadout mutations stay idempotent across direct helper calls", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await waitForGameGlobals(page);

    const state = await page.evaluate(() => window.eval(`
      (() => {
        localStorage.clear();
        const alerts = [];
        const previousAlert = window.alert;
        window.alert = message => alerts.push(String(message || ""));

        credits = 10000;
        currentShipId = STARTER_SHIP_ID;
        selectedHangarShipId = STARTER_SHIP_ID;
        selectedFleetShipId = STARTER_SHIP_ID;
        selectedShipyardShipId = STARTER_SHIP_ID;
        ownedShips = [STARTER_SHIP_ID];
        ownedGuns = Object.fromEntries(Object.keys(GUNS).map(key => [key, 0]));
        ownedAttachments = Object.fromEntries(Object.keys(attachments).map(key => [key, 0]));
        inventoryItems = [];
        shipLoadouts = { [STARTER_SHIP_ID]: normalizeShipLoadout({ attachments: [], guns: [] }, STARTER_SHIP_ID) };
        shipConditions = {};
        storeDailyPurchases = {};
        playerProgress = normalizePlayerProgress({ combatXp: 0, totals: { botsDestroyed: 0, erebusBotsDestroyed: 0, tradeProfit: 0, totalTradingProfit: 0 } });
        applyShipStats(true);

        const pulseStoreItem = {
          ...getStoreCatalogItem("gun", "pulseLaser"),
          id: "daily:test:pulseLaser",
          dailyStock: true,
          stockLimit: 1
        };
        const creditsBeforeDaily = credits;
        buyGun("pulseLaser", pulseStoreItem);
        buyGun("pulseLaser", pulseStoreItem);
        const dailyPurchaseState = {
          ownedPulseLaser: ownedGuns.pulseLaser || 0,
          creditsAfter: credits,
          creditsExpected: creditsBeforeDaily - getStorePrice(pulseStoreItem),
          stockRemaining: getStoreStockRemaining(pulseStoreItem),
          savedDailyPurchases: JSON.parse(localStorage.getItem("lupenGameState")).storeDailyPurchases[getStoreDayKey()][pulseStoreItem.id]
        };

        credits = 0;
        const cargoPodBefore = ownedAttachments.cargoPod || 0;
        buyAttachment("cargoPod");
        const noCreditPurchaseState = {
          credits,
          cargoPodOwned: ownedAttachments.cargoPod || 0,
          cargoPodBefore
        };

        credits = 10000;
        const shieldBefore = ownedAttachments.shieldBooster || 0;
        buyAttachment("shieldBooster");
        const lockedPurchaseState = {
          shieldBefore,
          shieldAfter: ownedAttachments.shieldBooster || 0,
          creditsAfter: credits
        };

        ownedGuns.pulseLaser = 1;
        selectedLoadoutSlotCategory = "guns";
        selectedLoadoutItemContext = { source: "slot", categoryKey: "guns", index: 0, key: "", quality: "standard" };
        equipGunFromInventory("pulseLaser");
        equipGunFromInventory("pulseLaser");
        const duplicateEquipState = {
          equippedGuns: shipLoadouts[STARTER_SHIP_ID].guns.map(entry => getEquipmentKey(entry)),
          ownedPulseLaser: ownedGuns.pulseLaser || 0
        };

        const shipBeforeBlockedEquip = currentShipId;
        equipShip("bison");
        const blockedShipState = {
          before: shipBeforeBlockedEquip,
          after: currentShipId
        };

        credits = 0;
        hull = Math.max(1, hullMax - 100);
        saveActiveShipCondition(currentShipId);
        const repairHullBefore = hull;
        repairCurrentShip();
        const noCreditRepairState = {
          credits,
          hull,
          repairHullBefore
        };

        cargo.Copper = 8;
        cargoRecovered = {};
        addRecoveredCargoQuantity("Copper", 8);
        saveGame();
        const saved = JSON.parse(localStorage.getItem("lupenGameState"));

        window.alert = previousAlert;
        return {
          alerts,
          dailyPurchaseState,
          noCreditPurchaseState,
          lockedPurchaseState,
          duplicateEquipState,
          blockedShipState,
          noCreditRepairState,
          savedRecoveredCopper: saved.cargoRecovered.Copper,
          savedLoadoutGuns: saved.shipLoadouts[STARTER_SHIP_ID].guns.map(entry => getEquipmentKey(entry))
        };
      })()
    `));

    expect(state.dailyPurchaseState.ownedPulseLaser).toBe(1);
    expect(state.dailyPurchaseState.creditsAfter).toBe(state.dailyPurchaseState.creditsExpected);
    expect(state.dailyPurchaseState.stockRemaining).toBe(0);
    expect(state.dailyPurchaseState.savedDailyPurchases).toBe(1);
    expect(state.noCreditPurchaseState.credits).toBe(0);
    expect(state.noCreditPurchaseState.cargoPodOwned).toBe(state.noCreditPurchaseState.cargoPodBefore);
    expect(state.lockedPurchaseState.shieldAfter).toBe(state.lockedPurchaseState.shieldBefore);
    expect(state.lockedPurchaseState.creditsAfter).toBe(10000);
    expect(state.duplicateEquipState.equippedGuns).toEqual(["pulseLaser"]);
    expect(state.duplicateEquipState.ownedPulseLaser).toBe(0);
    expect(state.blockedShipState.after).toBe(state.blockedShipState.before);
    expect(state.noCreditRepairState.credits).toBe(0);
    expect(state.noCreditRepairState.hull).toBe(state.noCreditRepairState.repairHullBefore);
    expect(state.savedRecoveredCopper).toBe(8);
    expect(state.savedLoadoutGuns).toEqual(["pulseLaser"]);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("Journey Academy assignments reconcile from active ship loadout state", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await waitForGameGlobals(page);

    await page.evaluate(() => window.eval(`
      (() => {
        localStorage.clear();
        tutorialState = { active: false, completed: true, stepIndex: 0 };
        currentNode = "Asteron Prime";
        lastPlanetNode = "Asteron Prime";
        homePlanet = "Asteron Prime";
        currentShipId = STARTER_SHIP_ID;
        selectedHangarShipId = STARTER_SHIP_ID;
        selectedFleetShipId = STARTER_SHIP_ID;
        ownedShips = [STARTER_SHIP_ID];
        ownedGuns = { ...ownedGuns, pulseLaser: 0 };
        ownedAttachments = { ...ownedAttachments, cargoPod: 0 };
        shipLoadouts = {
          [STARTER_SHIP_ID]: normalizeShipLoadout({
            guns: ["pulseLaser", "pulseLaser"],
            attachments: ["cargoPod"]
          }, STARTER_SHIP_ID)
        };
        missionProgress = createDefaultMissionProgress();
        playerProgress = createDefaultPlayerProgress();
        applyShipStats(true);
        saveGame();
        showScreen("gameScreen");
        updateHubLocation();
      })()
    `));

    await openHangar(page);
    await expect(page.locator("#loadoutCategoryWeapons")).toContainText("Weapons 2/2");
    await expect(page.locator("#installedGuns .loadout-grid-slot.filled")).toHaveCount(2);

    await page.locator("#hangarScreen .screen-back-btn").click();
    await page.locator("#journeyHubBtn").click();
    await expect(page.locator("#journeyScreen [data-journey-assignment-id='academy_two_guns']")).toContainText("2 / 2");
    await expect(page.locator("#journeyScreen [data-journey-assignment-id='academy_two_guns']")).toContainText("COMPLETE");
    await expect(page.locator("#journeyScreen [data-journey-assignment-id='academy_attachment']")).toContainText("1 / 1");
    await expect(page.locator("#journeyScreen [data-journey-assignment-id='academy_attachment']")).toContainText("COMPLETE");

    const savedAfterJourneyOpen = await page.evaluate(() => JSON.parse(localStorage.getItem("lupenGameState"))?.missionProgress?.missions);
    expect(savedAfterJourneyOpen.academy_two_guns).toMatchObject({ state: "completed", progress: 2 });
    expect(savedAfterJourneyOpen.academy_attachment).toMatchObject({ state: "completed", progress: 1 });

    await page.reload();
    await waitForGameGlobals(page);
    await page.evaluate(() => {
      showScreen("gameScreen");
      updateHubLocation();
    });
    await page.locator("#journeyHubBtn").click();
    await expect(page.locator("#journeyScreen [data-journey-assignment-id='academy_two_guns']")).toContainText("2 / 2");
    await expect(page.locator("#journeyScreen [data-journey-assignment-id='academy_two_guns']")).toContainText("COMPLETE");
    await expect(page.locator("#journeyScreen [data-journey-assignment-id='academy_attachment']")).toContainText("1 / 1");
    await expect(page.locator("#journeyScreen [data-journey-assignment-id='academy_attachment']")).toContainText("COMPLETE");

    const botDedupeState = await page.evaluate(() => window.eval(`
      (() => {
        missionProgress = createDefaultMissionProgress();
        recordMissionEvent("destroy_bot", { faction: "erebus", eventKey: "server-kill-1" });
        recordMissionEvent("destroy_bot", { faction: "erebus", eventKey: "server-kill-1" });
        return {
          runtime: missionProgress.missions.academy_erebus_bots,
          saved: JSON.parse(localStorage.getItem("lupenGameState"))?.missionProgress?.missions?.academy_erebus_bots,
          eventKeySaved: JSON.parse(localStorage.getItem("lupenGameState"))?.missionProgress?.eventKeys?.["destroy_bot:server-kill-1"] === true
        };
      })()
    `));
    expect(botDedupeState.runtime).toMatchObject({ state: "active", progress: 1 });
    expect(botDedupeState.saved).toMatchObject({ state: "active", progress: 1 });
    expect(botDedupeState.eventKeySaved).toBe(true);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("Map 1 session cleanup clears stale targets, FX, and duplicate activity", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging");
    await waitForGameGlobals(page);

    const state = await page.evaluate(() => window.eval(`
      (() => {
        localStorage.clear();
        currentNode = "Lower Lane West B";
        lastPlanetNode = "Asteron Prime";
        currentShipId = STARTER_SHIP_ID;
        selectedHangarShipId = STARTER_SHIP_ID;
        ownedShips = [STARTER_SHIP_ID];
        shipLoadouts = { [STARTER_SHIP_ID]: normalizeShipLoadout({ attachments: [], guns: [] }, STARTER_SHIP_ID) };
        applyShipStats(true);
        showScreen("spaceScreen");
        updateCurrentNodeUI();
        updateAsteroidUI();
        updateObjectActionPanel(false);

        const feed = document.getElementById("activityLogFeed");
        if (feed) {
          feed.innerHTML = "";
          delete feed.dataset.lastMessage;
          delete feed.dataset.lastMessageAt;
        }
        addActivityLog("Cargo hold full - no resource recovered.");
        addActivityLog("Cargo hold full - no resource recovered.");
        const activityCountAfterDuplicate = feed ? feed.querySelectorAll(".activity-log-item").length : 0;

        asteroids = [{
          id: "cleanup-asteroid",
          resource: "Iron",
          node: currentNode,
          alive: true,
          x: 50,
          y: 36,
          hull: 10,
          hullMax: 10,
          shield: 0,
          shieldMax: 0
        }];
        selectAsteroid("cleanup-asteroid");
        const fxLayer = document.getElementById("combatFxLayer") || document.body.appendChild(Object.assign(document.createElement("div"), { id: "combatFxLayer" }));
        const fx = document.createElement("div");
        fx.dataset.targetId = "cleanup-asteroid";
        fx.dataset.targetType = "asteroid";
        fx.className = "combat-fx-shot";
        fxLayer.appendChild(fx);
        asteroids[0].alive = false;
        const asteroidCleanup = reconcileTargetSessionState("test_asteroid_destroyed");
        const asteroidState = {
          cleanup: asteroidCleanup,
          selectedTarget,
          engagedTarget,
          fxRemaining: document.querySelectorAll("#combatFxLayer [data-target-id='cleanup-asteroid']").length,
          buttonText: document.getElementById("objectEngageBtn")?.textContent || "",
          buttonDisabled: document.getElementById("objectEngageBtn")?.disabled ?? false
        };

        const resource = {
          id: "cleanup-resource",
          resourceName: "Copper",
          currentNode,
          depleted: false,
          hp: 10,
          hpMax: 10
        };
        window.LupenMultiplayerClient = {
          getResourceById(id) { return id === resource.id ? resource : null; },
          getResources() { return [resource]; },
          getPlayers() { return []; },
          clearStagingTarget() { window.__cleanupClearTargetCalls = (window.__cleanupClearTargetCalls || 0) + 1; }
        };
        selectStagingResourceTarget("cleanup-resource");
        resource.depleted = true;
        const resourceCleanup = reconcileTargetSessionState("test_resource_depleted");
        const resourceState = {
          cleanup: resourceCleanup,
          selectedTarget,
          engagedTarget,
          clearTargetCalls: window.__cleanupClearTargetCalls || 0
        };

        const remote = {
          id: "remote-cleanup",
          sessionId: "remote-cleanup",
          displayName: "Remote Tester",
          currentNode,
          presenceStatus: "space"
        };
        window.LupenMultiplayerClient.getPlayers = () => [remote];
        selectedTarget = { type: "remotePlayer", id: "remote-cleanup" };
        engagedTarget = { type: "remotePlayer", id: "remote-cleanup" };
        remote.currentNode = "Asteron Prime";
        const remoteCleanup = reconcileTargetSessionState("test_remote_left_node");
        const remoteState = {
          cleanup: remoteCleanup,
          selectedTarget,
          engagedTarget
        };

        selectedTarget = { type: "asteroid", id: "cleanup-asteroid" };
        engagedTarget = { type: "asteroid", id: "cleanup-asteroid" };
        engageTimer = setInterval(() => {}, 1000);
        currentNode = "Asteron Prime";
        landOnPlanet();
        const landedState = {
          selectedTarget,
          engagedTarget,
          engageTimerActive: Boolean(engageTimer),
          screenActive: document.getElementById("gameScreen")?.classList.contains("active") || false
        };

        return {
          activityCountAfterDuplicate,
          asteroidState,
          resourceState,
          remoteState,
          landedState
        };
      })()
    `));

    expect(state.activityCountAfterDuplicate).toBe(1);
    expect(state.asteroidState.cleanup.cleared).toBe(true);
    expect(state.asteroidState.selectedTarget).toBeNull();
    expect(state.asteroidState.engagedTarget).toBeNull();
    expect(state.asteroidState.fxRemaining).toBe(0);
    expect(state.asteroidState.buttonText).toBe("ENGAGE");
    expect(state.asteroidState.buttonDisabled).toBe(true);
    expect(state.resourceState.cleanup.cleared).toBe(true);
    expect(state.resourceState.selectedTarget).toBeNull();
    expect(state.resourceState.clearTargetCalls).toBeGreaterThan(0);
    expect(state.remoteState.cleanup.cleared).toBe(true);
    expect(state.remoteState.selectedTarget).toBeNull();
    expect(state.remoteState.engagedTarget).toBeNull();
    expect(state.landedState.selectedTarget).toBeNull();
    expect(state.landedState.engagedTarget).toBeNull();
    expect(state.landedState.engageTimerActive).toBe(false);
    expect(state.landedState.screenActive).toBe(true);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("desktop bounty board keeps selected contract actions visible", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto("/");
    await waitForGameGlobals(page);
    await page.evaluate(() => {
      window.eval(`
        localStorage.clear();
        activeObjective = null;
        activeBountyId = null;
        ensureDailyBounties();
        selectedBountyContractId = dailyBountyContracts[0]?.id || null;
        showScreen("gameScreen");
        openBountyBoard();
      `);
    });

    await expect(page.locator("#bountyScreen")).toHaveClass(/active/);
    await expect(page.locator(".selected-contract-panel")).toBeVisible();
    await expect(page.locator(".accept-bounty-button")).toBeVisible();
    await expect(page.locator(".bounty-contract-card")).toHaveCount(4);
    await expect(page.locator("#bountyScreen")).toContainText("Complete daily Erebus contracts to earn credits and Lupen Shards for Forge upgrades.");
    await expect(page.locator("#bountyScreen")).toContainText("DAILY CONTRACTS");
    await expect(page.locator("#bountyScreen")).toContainText("4 / 4 DAILY CONTRACTS");
    await expect(page.locator("#bountyResetCountdown")).toContainText("DAILY RESET");
    await expect(page.locator("#bountyScreen")).toContainText("Erebus Patrol Sweep");
    await expect(page.locator("#bountyScreen")).toContainText("Hunter Clearance");
    await expect(page.locator("#bountyScreen")).toContainText("Timed Suppression");
    await expect(page.locator("#bountyScreen")).toContainText("Behemoth Warning");
    await expect(page.locator("#bountyScreen")).toContainText("CR 900");
    await expect(page.locator("#bountyScreen")).not.toContainText(/Lupen Cores/i);

    const measureSelectedPanelAction = async (selector) => page.evaluate((buttonSelector) => {
      const screen = document.querySelector("#bountyScreen")?.getBoundingClientRect();
      const panel = document.querySelector(".selected-contract-panel")?.getBoundingClientRect();
      const actions = document.querySelector(".selected-contract-actions")?.getBoundingClientRect();
      const button = document.querySelector(buttonSelector)?.getBoundingClientRect();
      if (!screen || !panel || !actions || !button) return null;
      return {
        actionVisible: button.width > 0 && button.height > 0,
        panelFitsScreen: panel.top >= screen.top && panel.left >= screen.left && panel.right <= screen.right + 1 && panel.bottom <= screen.bottom + 1,
        actionsFitPanel: actions.top >= panel.top && actions.left >= panel.left && actions.right <= panel.right + 1 && actions.bottom <= panel.bottom + 1,
        buttonFitsPanel: button.top >= panel.top && button.left >= panel.left && button.right <= panel.right + 1 && button.bottom <= panel.bottom + 1
      };
    }, selector);

    const acceptGeometry = await measureSelectedPanelAction(".accept-bounty-button");
    expect(acceptGeometry).toMatchObject({
      actionVisible: true,
      panelFitsScreen: true,
      actionsFitPanel: true,
      buttonFitsPanel: true
    });

    await page.locator(".bounty-contract-card", { hasText: "Hunter Clearance" }).click();
    await expect(page.locator("#bountyDetailPanel")).toContainText("Hunter Clearance");
    await expect(page.locator("#bountyDetailPanel")).toContainText("Hunter");
    await expect(page.locator("#bountyDetailPanel")).toContainText("CR 1,100 / 3 Lupen Shards");
    await page.locator(".bounty-contract-card", { hasText: "Timed Suppression" }).click();
    await expect(page.locator("#bountyDetailPanel")).toContainText("Timed Suppression");
    await expect(page.locator("#bountyDetailPanel")).toContainText("04:00");
    await expect(page.locator("#bountyDetailPanel")).toContainText("XP REWARD");
    await expect(page.locator("#bountyDetailPanel")).toContainText("None");

    fs.mkdirSync("artifacts", { recursive: true });
    await page.locator("#bountyScreen").screenshot({ path: "artifacts/bounty-board-daily-refresh.png" });

    await page.locator(".accept-bounty-button").click();
    await expect(page.locator(".bounty-cancel-btn")).toBeVisible();
    const cancelGeometry = await measureSelectedPanelAction(".bounty-cancel-btn");
    expect(cancelGeometry).toMatchObject({
      actionVisible: true,
      panelFitsScreen: true,
      actionsFitPanel: true,
      buttonFitsPanel: true
    });

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("multiplayer staging bounty board uses player-facing staging bounty copy", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await waitForGameGlobals(page);
    await page.evaluate(() => window.eval(`
      (() => {
        const bounties = [
          { id: "staging_erebus_patrol_2", title: "Erebus Patrol Sweep", description: "Destroy 4 Erebus bots.", contractType: "Kill Contract", targetBotType: "any", targetBotLabel: "Any Erebus", difficulty: "Easy", requiredKills: 4, progress: 0, xpReward: 0, creditsReward: 900, lupenShardsReward: 2, icon: "assets/bounties/erebus-patrol-sweep.png" },
          { id: "staging_hunter_clearance_4", title: "Hunter Clearance", description: "Destroy 4 Erebus Hunters.", contractType: "Targeted Hunt", targetBotType: "hunter", targetBotLabel: "Hunter", difficulty: "Easy", requiredKills: 4, progress: 0, xpReward: 0, creditsReward: 1100, lupenShardsReward: 3, icon: "assets/bounties/hunter-clearance.png" },
          { id: "staging_timed_suppression_4", title: "Timed Suppression", description: "Destroy 4 Erebus bots within 4 minutes.", contractType: "Timed Elimination", targetBotType: "any", targetBotLabel: "Any Erebus", difficulty: "Medium", requiredKills: 4, progress: 0, xpReward: 0, creditsReward: 1500, lupenShardsReward: 4, timed: true, timeLimitSeconds: 240, icon: "assets/bounties/timed-suppression.png" },
          { id: "staging_behemoth_warning_1", title: "Behemoth Warning", description: "Destroy 1 Erebus Behemoth.", contractType: "Boss Contract", targetBotType: "behemoth", targetBotLabel: "Erebus Behemoth", difficulty: "Extreme", requiredKills: 1, progress: 0, xpReward: 0, creditsReward: 2500, lupenShardsReward: 8, icon: "assets/bounties/behemoth-warning.png" }
        ];
        window.LupenMultiplayerClient = {
          ...(window.LupenMultiplayerClient || {}),
          getStatus: () => ({
            enabled: true,
            isConnected: true,
            lastStagingBountyStatus: null,
            lastStagingBountyList: { bounties }
          }),
          requestStagingBounties: () => true,
          requestStagingBountyStatus: () => true,
          onServerState: () => ({ unsubscribe() {} })
        };
      })()
    `));

    await openBountyBoard(page);

    await expect(page.locator("#bountyScreen")).toContainText("MP STAGING CONTRACTS");
    await expect(page.locator(".bounty-contract-card")).toHaveCount(4);
    await expect(page.locator("#bountyScreen")).toContainText("Erebus Patrol Sweep");
    await expect(page.locator("#bountyScreen")).toContainText("Hunter Clearance");
    await expect(page.locator("#bountyScreen")).toContainText("Timed Suppression");
    await expect(page.locator("#bountyScreen")).toContainText("Behemoth Warning");
    await expect(page.locator("#bountyScreen")).toContainText(/Server-tracked staging bounty|Waiting for Multiplayer Staging/);
    await expect(page.locator("#bountyScreen")).toContainText("CR 900");
    await expect(page.locator("#bountyScreen")).toContainText("XP REWARD");
    await page.locator(".bounty-contract-card", { hasText: "Behemoth Warning" }).click();
    await expect(page.locator("#bountyDetailPanel")).toContainText("Erebus Behemoth");
    await expect(page.locator("#bountyDetailPanel")).toContainText("CR 2,500 / 8 Lupen Shards");

    await expectNoUnexpectedBrowserErrors(failures);
  });
});
