import { afterAll, beforeEach } from "vitest";
import { dropSchema, ensureSchemaReady, resetDb } from "./db";

// No placeholder here, unlike the unit setup: a missing database must fail
// as a misconfigured run, not as a confusing connection error.
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required to run integration tests: point it at a real Postgres.");
}

process.env.AUTH_SECRET ??= "test-secret";
process.env.APP_ORIGIN ??= "http://voltio.test";
// Several files run in parallel, each with its own pool.
process.env.DATABASE_POOL_MAX ??= "12";

ensureSchemaReady();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await dropSchema();
});
