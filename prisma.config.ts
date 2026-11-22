// Prisma 7 keeps connection settings out of schema.prisma: the migrations'
// URL and the seed command live here, and the running app passes its own
// driver adapter to `new PrismaClient()` (lib/prisma.ts).
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --conditions=react-server prisma/seed.ts",
  },
  datasource: {
    // Runs outside Next, so it cannot go through lib/env.ts.
    url: process.env.DATABASE_URL,
  },
});
