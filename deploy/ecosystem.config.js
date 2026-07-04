/**
 * PM2 process definition for the production droplet.
 * The app uses Next.js standalone output: `npm run build` produces
 * .next/standalone/server.js, and the deploy step copies public/ and
 * .next/static into the standalone folder.
 */
module.exports = {
  apps: [
    {
      name: "pankajpramanik",
      cwd: "/var/www/pankajpramanik",
      script: ".next/standalone/server.js",
      instances: 1, // 1 vCPU droplet — keep a single instance
      exec_mode: "fork",
      max_memory_restart: "700M",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
        HOSTNAME: "127.0.0.1",
      },
      out_file: "/var/log/pm2/pankajpramanik.out.log",
      error_file: "/var/log/pm2/pankajpramanik.err.log",
      merge_logs: true,
      time: true,
    },
  ],
};
