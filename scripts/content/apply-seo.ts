/**
 * Apply prisma/content/seo.json to the database in DATABASE_URL. Run
 * `npm run content:export` afterwards and commit the snapshot, so the deploy
 * imports the same SEO data into production.
 *
 * Usage: npm run content:seo
 */
import { PrismaClient } from "@prisma/client";
import { loadEnv } from "./snapshot";
import { applySeo } from "./seo";

loadEnv();
const prisma = new PrismaClient();

applySeo(prisma)
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
