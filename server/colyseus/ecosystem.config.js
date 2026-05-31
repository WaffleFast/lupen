export default {
  apps: [
    {
      name: "lupen-colyseus-staging",
      script: "src/index.js",
      time: true,
      watch: false,
      instances: 1,
      exec_mode: "fork",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
