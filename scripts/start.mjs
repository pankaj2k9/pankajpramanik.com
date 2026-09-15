import { cp, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const standalone = path.join(root, ".next", "standalone");
try {
  await access(path.join(standalone, "server.js"));
} catch {
  console.error("Production build missing. Run npm run build first.");
  process.exit(1);
}
try {
  process.loadEnvFile(path.join(root, ".env"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
await cp(path.join(root, "public"), path.join(standalone, "public"), {
  recursive: true,
});
await cp(
  path.join(root, ".next", "static"),
  path.join(standalone, ".next", "static"),
  { recursive: true },
);
// The standalone server chdirs into .next/standalone; point it at the real
// media storage in the project root.
process.env.STORAGE_DIR ||= path.join(root, "storage");
process.env.HOSTNAME ||= "127.0.0.1";
await import(new URL("../.next/standalone/server.js", import.meta.url));
