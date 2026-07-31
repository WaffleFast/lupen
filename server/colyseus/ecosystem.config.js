export default {
  apps: [
    {
      name: "lupen-colyseus-staging",
      script: "src/index.js",
      time: true,
      watch: false,
      instances: 1,
      // @colyseus/tools listen() cooperates with the Colyseus Cloud PM2
      // lifecycle and NODE_APP_INSTANCE. Keep PM2 in fork mode and expose the
      // base port here; the tools layer handles Cloud socket/port assignment.
      exec_mode: "fork",
      port: 2567,
      env: {
        NODE_ENV: "production",
        // Public player testing: every authenticated Supabase player may use
        // server-validated loadout writes. Identity, owned-item, slot, ship and
        // save-shape checks still run before any patch is applied.
        STAGING_LOADOUT_WRITE_ENABLED: "true",
        STAGING_LOADOUT_WRITE_DRY_RUN: "false",
        STAGING_LOADOUT_WRITE_SCOPE: "verified"
      }
    }
  ]
};
