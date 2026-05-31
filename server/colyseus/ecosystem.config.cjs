module.exports = {
  apps: [
    {
      name: "lupen-colyseus-staging",
      script: "src/index.js",
      time: true,
      watch: false,
      instances: 1,
      // Colyseus Cloud deploys through PM2. Cluster mode with one instance lets
      // PM2 coordinate replacement workers instead of starting two forked
      // processes that can race for the same PORT during rolling deploys.
      exec_mode: "cluster",
      env: {
        NODE_ENV: "production",
        PORT: 2567
      }
    }
  ]
};
