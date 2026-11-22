// Integration test isolation: each test file gets its own Postgres schema,
// migrated once and truncated between tests. The suite leans on row locks,
// partial unique indexes and a trigger; those only behave like production
// in a real schema with real concurrent connections, which a wrapper
// transaction that rolls back cannot give.
import { execFileSync } from "node:child_process";
import { createId } from "@paralleldrive/cuid2";
import { prisma } from "@/lib/prisma";

export const testSchema = `test_${createId()}`;

// Three things must agree on the schema: the Prisma CLI (`schema=`), raw
// SQL in the code under test, which resolves bare table names through
// search_path (`options=`), and the generated client, which is told through
// DATABASE_SCHEMA (lib/prisma.ts).
function withSchema(baseUrl: string, schema: string): string {
  const url = new URL(baseUrl);
  url.searchParams.set("schema", schema);
  url.searchParams.set("options", `-c search_path=${schema}`);
  return url.toString();
}

export function ensureSchemaReady(): void {
  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) throw new Error("DATABASE_URL must be set before ensureSchemaReady() runs.");
  const scopedUrl = withSchema(baseUrl, testSchema);

  // `migrate deploy` takes one advisory lock for the whole database, so
  // parallel files queue behind each other and the CLI gives up after 10 s.
  // Nothing is wrong when that happens: try again.
  for (let attempt = 1; ; attempt++) {
    try {
      execFileSync("npx", ["prisma", "migrate", "deploy"], {
        env: { ...process.env, DATABASE_URL: scopedUrl },
        stdio: "pipe",
        shell: true,
      });
      break;
    } catch (error) {
      if (attempt >= 5) throw error;
    }
  }

  process.env.DATABASE_URL = scopedUrl;
  process.env.DATABASE_SCHEMA = testSchema;
}

export async function dropSchema(): Promise<void> {
  await prisma.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`);
  await prisma.$disconnect();
}

/** Empties every table, then puts back the one row the migrations guarantee. */
export async function resetDb(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = ${testSchema}
  `;
  const names = tables
    .map((t) => t.tablename)
    .filter((name) => name !== "_prisma_migrations")
    .map((name) => `"${testSchema}"."${name}"`);
  if (names.length > 0) {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names.join(", ")} RESTART IDENTITY CASCADE`);
  }
  await prisma.business.create({
    data: {
      id: "main",
      name: "Taller de pruebas",
      address: "Calle Falsa 123",
      phone: "6671234567",
      timezone: "America/Mexico_City",
      taxRateBps: 1600,
      defaultWarrantyDays: 90,
      folioPrefix: "VT",
    },
  });
}
