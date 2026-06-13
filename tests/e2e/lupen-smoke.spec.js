const { test, expect } = require("@playwright/test");

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
      cloudUpserts: window.__pilotResetCloudUpserts
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
    expect(reset.tutorial.active).toBe(true);
    expect(reset.tutorial.completed).toBe(false);
    expect(reset.tutorial.stepIndex).toBe(0);
    expect(reset.cloudUpserts).toHaveLength(1);
    expect(reset.cloudUpserts[0].table).toBe("player_saves");
    expect(reset.cloudUpserts[0].payload.user_id).toBe("77777777-7777-4777-8777-777777777777");
    expect(reset.cloudUpserts[0].payload.save_data.credits).toBe(10000);
    expect(reset.cloudUpserts[0].payload.save_data.currentShipId).toBe("");
    expect(reset.cloudUpserts[0].payload.save_data.ownedShips).toEqual([]);

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
    expect(state.tutorial.active).toBe(true);
    expect(state.tutorial.completed).toBe(false);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("normal trade terminal opens without performing buy or sell actions", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await openTradeTerminal(page);

    await expect(page.locator("#creditsText")).toBeVisible();
    await expect(page.locator("#cargoText")).toBeVisible();
    await expect(page.locator("#marketScreen")).toContainText(/Buy Cargo|Sell Cargo|Sell Here/);
    await expect(page.locator("#marketScreen")).not.toContainText("Server Buy");

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
        saveGame();
        return {
          starterShip: getShipUnlockStatus("falcon"),
          nightshade: getShipUnlockStatus("zeusExplorer"),
          hauler: getShipUnlockStatus("bison"),
          pulse: getEquipmentUnlockStatus("guns", "pulseLaser"),
          repeater: getEquipmentUnlockStatus("guns", "repeater"),
          cargoPod: getEquipmentUnlockStatus("attachments", "cargoPod"),
          jumpDrive: getEquipmentUnlockStatus("attachments", "jumpDrive"),
          shieldBooster: getEquipmentUnlockStatus("attachments", "shieldBooster"),
          repeaterOwnedAfterBlockedBuy,
          pulseOwned: ownedGuns.pulseLaser || 0,
          cargoOwned: ownedAttachments.cargoPod || 0,
          jumpOwned: ownedAttachments.jumpDrive || 0,
          shieldOwned: ownedAttachments.shieldBooster || 0,
          ionOwned: ownedGuns.ionBlaster || 0,
          equippedGuns: shipLoadouts.falcon.guns.length,
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
    expect(progression.savedProgress).toMatchObject({
      erebusBotsDestroyed: 12,
      botsDestroyed: 12,
      totalTradingProfit: 3456,
      tradeProfit: 3456
    });

    await page.evaluate(() => {
      window.showScreen("gameScreen");
      window.openHangar();
      window.showHangarSection("shipyard");
      window.selectShipyardShip("zeusExplorer");
    });

    await expect(page.locator(".vessel-exchange-card[data-ship-id='zeusExplorer']")).toHaveClass(/progression-locked/);
    await expect(page.locator("#shipyardDetailPanel")).toContainText("Destroy Erebus bots: 12 / 25");
    await expect(page.locator("#shipyardDetailPanel")).toContainText("Requires Combat Level 2");

    await page.reload();
    await waitForGameGlobals(page);
    const restored = await page.evaluate(() => ({
      nightshadeLines: getShipUnlockStatus("zeusExplorer").requirementLines,
      haulerLines: getShipUnlockStatus("bison").requirementLines
    }));
    expect(restored.nightshadeLines.join(" ")).toContain("Destroy Erebus bots: 12 / 25");
    expect(restored.haulerLines.join(" ")).toContain("Trading profit: CR 3,456 / CR 7,500");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("multiplayer staging mode exposes staging UI without using real trade buttons", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await expect(page.locator("#lupenMultiplayerStatusChip")).toContainText(/Staging/, { timeout: 15000 });
    await expect(page.locator("#lupenMultiplayerStagingFlowHint")).toContainText("Multiplayer Staging Loop", { timeout: 15000 });
    await expect(page.locator("#lupenMultiplayerStagingFlowHint")).toContainText(/Trade for CR[\s\S]*Store upgrades[\s\S]*Launch[\s\S]*Engage bots[\s\S]*Claim bounty XP/i);
    await expect(page.locator("#lupenMultiplayerStagingFlowHint")).toContainText(/No PvP[\s\S]*bots return fire locally/i);
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

    await expect(page.locator("#marketScreen")).toContainText(/Buy Cargo|Preview Unavailable/);
    await expect(page.locator("#marketScreen")).not.toContainText("Server Buy");
    await expect(page.locator("#marketScreen")).toContainText(/MP staging|server/i);

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("debug staging diagnostics can be opened without a live server", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&debug=mp&mpServer=http://127.0.0.1:1");
    await expect(page.locator("#lupenMultiplayerStatusChip")).toContainText(/Staging/, { timeout: 15000 });
    await expect(page.locator("#lupenMultiplayerDiagnostics")).toContainText("MP Staging", { timeout: 15000 });
    await expect(page.locator("#lupenMultiplayerDiagnostics")).toContainText(/offline|connecting|connected/i);
    await expect(page.locator("#lupenMultiplayerStagingFlowHint")).toHaveCount(0);

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
    await expect(page.locator("#marketScreen")).toContainText("Buy Cargo");
    await expect(page.locator("#marketScreen")).not.toContainText("Preview Unavailable");
    await expect(page.locator("#marketScreen")).toContainText(/Crystal Shards[\s\S]*Asteron Prime > Nyxara|Iron[\s\S]*Asteron Prime > Virella/i);

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

    await expect(page.locator("#marketScreen")).toContainText(/Iron[\s\S]*Asteron Prime > Virella/);
    await expect(page.locator("#marketScreen")).toContainText("63 units");
    await expect(page.locator("#marketScreen")).toContainText("CR 1,134");
    await expect(page.locator("#marketScreen")).toContainText("CR 1,890");
    await expect(page.locator("#marketScreen")).toContainText("+CR 756");

    await page.evaluate(() => {
      window.eval(`
        selectedMarketTargetPlanet = "Virella";
      `);
      if (typeof window.setMarketResource === "function") window.setMarketResource("Copper");
    });
    await expect(page.locator("#marketScreen .market-builder-selected")).toContainText(/Copper[\s\S]*Asteron Prime > Virella/);

    await page.evaluate(() => {
      window.eval(`
        selectedMarketTargetPlanet = "Asteron Prime";
      `);
      if (typeof window.setMarketResource === "function") window.setMarketResource("Iron");
    });
    await expect(page.locator("#marketScreen .market-builder-selected")).toContainText(/Iron[\s\S]*Asteron Prime > Virella/);

    await page.evaluate(() => {
      if (typeof window.applyMultiplayerStagingTradeObjective === "function") {
        window.applyMultiplayerStagingTradeObjective({
          applied: true,
          operation: "buy",
          offerId: "staging-iron-asteron-virella",
          resourceName: "Iron",
          buyNode: "Asteron Prime",
          sellNode: "Virella",
          quantity: 6,
          buyPrice: 18,
          sellPrice: 30,
          cost: 108,
          projectedRevenue: 180,
          cargoDelta: 6
        });
      }
    });
    await expect(page.locator("#activeObjectiveSummary")).toContainText("Deliver 6 Iron");
    await expect(page.locator("#activeObjectiveSummary")).toContainText("Asteron Prime -> Virella");
    await expect(page.locator("#activeObjectiveSummary")).toContainText("+CR 72");
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

    await expect(page.locator("#marketScreen")).toContainText(/Cobalt[\s\S]*Nyxara > Asteron Prime/);
    await expect(page.locator("#marketScreen")).toContainText("14 units");
    await expect(page.locator("#marketScreen")).toContainText("CR 868");
    await expect(page.locator("#marketScreen")).toContainText("CR 1,260");
    await expect(page.locator("#marketScreen")).toContainText("+CR 392");

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
        await expect(page.locator("#marketScreen")).toContainText("Buy Cargo");
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
        cargo.Iron = 6;
        cargoCostBasis.Iron = 18;
        selectedMarketResource = "Iron";
        selectedMarketTargetPlanet = "Virella";
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
        cargo.Copper = 24;
        delete cargoCostBasis.Copper;
        selectedMarketResource = "Copper";
        selectedMarketTargetPlanet = "Nyxara";
        selectedMarketQuantity = 24;
      `);
      if (typeof window.renderMarketplace === "function") window.renderMarketplace();
    });

    const builder = page.locator("#marketScreen .market-builder-panel");
    await expect(builder).toContainText("Sell Cargo");
    await expect(builder).toContainText("Recovered resource");
    await expect(builder).toContainText("Mined cargo");
    await expect(builder).toContainText(/Sell 24 of 24 carried/);
    await expect(builder).toContainText("Sell Revenue");
    await expect(builder).toContainText("CR 1,200");
    await expect(builder).toContainText("Recovered Value");
    await expect(builder).not.toContainText(/Virella > Nyxara/);

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

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("multiplayer staging store shows server-backed dry-run wording", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/?mp=staging&mpServer=http://127.0.0.1:1");
    await expect(page.locator("#lupenMultiplayerStatusChip")).toContainText(/Staging/, { timeout: 15000 });

    await openStore(page);

    await expect(page.locator("#storeScreen")).toContainText(/Staging Purchase|Server Preview|Server preview unavailable/);
    await expect(page.locator("#storeScreen")).not.toContainText(/LF-2 Hauler/i);
    await expect(page.locator("#storeScreen")).toContainText(/Pulse Laser/i);
    await expect(page.locator("#storeScreen")).toContainText(/Shield Booster/i);
    await expect(page.locator("#storeScreen")).toContainText(/Lupen Shard/i);
    await expect(page.locator("#storeScreen")).toContainText(/Lupen Core/i);
    await expect(page.locator("#storeScreen")).toContainText(/Materials/i);
    await expect(page.locator("#storeScreen")).toContainText(/Apply Cargo Pod|Cargo Pod equip preview|server-backed validation/i);
    await expect(page.locator("#storeScreen")).toContainText(/server-backed validation|server preview only|Real Store purchase is blocked|No CR or inventory changed/i);
    await expect(page.locator("#storeScreen")).not.toContainText("Buy / CR");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("station store detail art stays centered and prominent", async ({ page }) => {
    const failures = collectUnexpectedBrowserErrors(page);

    await page.goto("/");
    await openStore(page);

    const measurements = await page.evaluate(async () => {
      const items = [
        ["cargoPod", "attachment:cargoPod"],
        ["ionBlaster", "gun:ionBlaster"],
        ["heavyLance", "gun:heavyLance"],
        ["lupenCore", "core:lupenCore"],
        ["lupenShards", "material:lupenShard"]
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
      expect(row.itemHeight, row.key).toBeGreaterThanOrEqual(row.key === "lupenShards" ? 95 : 110);
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

  test("staging tutorial reset URL and helper restart the programme without clearing saves", async ({ page }) => {
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
      save: JSON.parse(localStorage.getItem("lupenGameState")),
      tutorial: JSON.parse(localStorage.getItem("lupenStarterPilotTutorial")),
      auth: localStorage.getItem("sb-ylzglwiehkypetcdkqxd-auth-token"),
      title: document.getElementById("tutorialTitle")?.textContent || ""
    }));

    expect(urlReset.href).not.toContain("resetTutorial=1");
    expect(urlReset.href).toContain("mp=staging");
    expect(urlReset.helperType).toBe("function");
    expect(urlReset.save.credits).toBe(32100);
    expect(urlReset.auth).toBe("keep-auth");
    expect(urlReset.tutorial.active).toBe(true);
    expect(urlReset.tutorial.completed).toBe(false);
    expect(urlReset.tutorial.stepIndex).toBe(0);
    expect(urlReset.title).toBe("Welcome, Pilot");

    const helperReset = await page.evaluate(() => {
      window.eval(`
        tutorialState = { active: false, completed: true, stepIndex: 8, lastStartedAt: "old" };
        saveTutorialState();
      `);
      return window.lupenResetTutorial();
    });
    expect(helperReset).toMatchObject({ tutorialKeyCleared: "lupenStarterPilotTutorial", resetProgress: false });
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
        const targetTargetExists = Boolean(document.querySelector("[data-tutorial-target='marketTargetConfirm']"));
        confirmMarketTargetPlanet();
        setTutorialStepById("select-buy-amount");
        setMarketQuantityMax();
        const maxQuantity = selectedMarketQuantity;
        setTutorialStepById("buy-cargo");
        buyMarketCargo();
        const route = { ...activeTradeRoute };
        return {
          resourceTargetExists,
          targetTargetExists,
          maxQuantity,
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
    await page.waitForFunction(() => window.eval("getCurrentTutorialStep().id") === "open-trade-to-sell");

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

    const tradeSell = await page.evaluate(() => window.eval(`
      (() => {
        const route = { ...activeTradeRoute };
        openMarketplace();
        const sellButton = document.querySelector("[data-tutorial-target='sellCargo']");
        const buyButton = document.querySelector("[data-tutorial-target='buyCargo']");
        const builderText = document.querySelector(".market-builder-panel")?.textContent || "";
        const creditsBeforeSell = credits;
        const cargoBeforeSell = cargo[route.good] || 0;
        selectedMarketResource = route.good;
        selectedMarketTargetPlanet = route.destination;
        renderMarketplace();
        setTutorialStepById("sell-cargo");
        sellMarketCargo();
        const creditsAfterFirstSell = credits;
        sellMarketCargo();
        return {
          route,
          sellButtonPresent: Boolean(sellButton),
          sellButtonDisabled: Boolean(sellButton?.disabled),
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
    await page.waitForFunction(() => window.eval("getCurrentTutorialStep().id") === "return-after-trade");
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
    expect(terminalHighlightState.step).toBe("open-trade-to-sell");
    expect(terminalHighlightState.exists).toBe(true);
    expect(terminalHighlightState.highlighted).toBe(true);
    expect(terminalHighlightState.text).toContain("Trade");
    expect(tradeSell.sellButtonPresent).toBe(true);
    expect(tradeSell.sellButtonDisabled).toBe(false);
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
    expect(finalStep).toBe("return-after-trade");

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
    expect(availableState.buttonText).toContain("Accept Bounty");
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
    expect(offlineFallbackState.beforeText).toContain("Accept Bounty");
    expect(offlineFallbackState.beforeText).not.toContain("Waiting For Server");
    expect(offlineFallbackState.buttonText).toContain("Accept Bounty");
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
          xpReward: 40,
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
    expect(activeStagingState.detailText).toContain("Active Bounty");
    expect(activeStagingState.detailText).not.toContain("Active Staging Bounty");

    await expectNoUnexpectedBrowserErrors(failures);
  });

  test("tutorial bounty grants a Core and Forge upgrade persists on Pulse Laser", async ({ page }) => {
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
        ensureDailyBounties();
        const contract = dailyBountyContracts[0];
        contract.status = "readyToClaim";
        contract.progress = getBountyRequiredKills(contract);
        contract.reward = { credits: 0, xp: 125, lupenCores: 0, lupenShards: 0 };
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
          coreCount: getLupenCoreCount(),
          contractCores: claimed.reward.lupenCores,
          status: claimed.status,
          overlayText: document.getElementById("bountyRewardOverlay")?.textContent || ""
        };
      })()
    `));

    expect(rewardState).toMatchObject({
      coreCount: 1,
      contractCores: 1,
      status: "claimed"
    });
    expect(rewardState.overlayText).toContain("1x Lupen Core");

    await page.evaluate(() => window.eval(`
      setTutorialStepById("forge-upgrade-weapon");
      openUpgradeForge();
      startForgeUpgrade();
    `));

    await page.waitForFunction(() => {
      const entry = shipLoadouts.falcon?.guns?.[0];
      return entry && getEquipmentKey(entry) === "pulseLaser" && getEquipmentQuality(entry) !== "standard";
    }, null, { timeout: 5000 });
    await page.waitForFunction(() => getCurrentTutorialStep()?.id === "return-after-forge", null, { timeout: 5000 });

    let forgeState = await page.evaluate(() => ({
      quality: getEquipmentQuality(shipLoadouts.falcon.guns[0]),
      coreCount: getLupenCoreCount(),
      selectedForgeItemId,
      tutorialStep: getCurrentTutorialStep()?.id || ""
    }));
    expect(forgeState.quality).toBe("refined");
    expect(forgeState.coreCount).toBe(0);
    expect(forgeState.selectedForgeItemId).toContain("equipped:falcon:guns:0");
    expect(forgeState.tutorialStep).toBe("return-after-forge");

    await page.reload();
    await waitForGameGlobals(page);
    forgeState = await page.evaluate(() => ({
      quality: getEquipmentQuality(shipLoadouts.falcon.guns[0]),
      key: getEquipmentKey(shipLoadouts.falcon.guns[0]),
      coreCount: getLupenCoreCount()
    }));
    expect(forgeState).toMatchObject({
      key: "pulseLaser",
      quality: "refined",
      coreCount: 0
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
      window.eval(`repairCurrentShip();`);
      const bisonAfterRepair = { ship: currentShipId, hull, hullMax, shield, shieldMax, savedHull: shipConditions.bison.hull };
      window.eval(`equipShip("falcon");`);
      const falcon = { ship: currentShipId, hull, hullMax, shield, shieldMax, armor, cargo: getShipStats().cargo, jumpRecharge: getShipStats().jumpRecharge, evasion };
      return { monolith, bisonBeforeRepair, bisonAfterRepair, falcon };
    });

    expect(state.monolith).toMatchObject({ ship: "monolith", hull: 1800, hullMax: 1800, shield: 360, shieldMax: 360 });
    expect(state.bisonBeforeRepair).toMatchObject({ ship: "bison", hull: 930, hullMax: 1300, shield: 77, shieldMax: 135 });
    expect(state.bisonAfterRepair).toMatchObject({ ship: "bison", hull: 1300, hullMax: 1300, savedHull: 1300 });
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
    await expect(page.locator("#lupenMultiplayerStatusChip")).toContainText(/Staging/, { timeout: 15000 });

    await openBountyBoard(page);

    await expect(page.locator("#bountyScreen")).toContainText("MP STAGING BOUNTIES");
    await expect(page.locator("#bountyScreen")).toContainText("Erebus Patrol Sweep");
    await expect(page.locator("#bountyScreen")).toContainText(/Server-tracked staging bounty|Waiting for Multiplayer Staging/);
    await expect(page.locator("#bountyScreen")).toContainText(/40 XP|No CR or loot items/i);

    await expectNoUnexpectedBrowserErrors(failures);
  });
});
