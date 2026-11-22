import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "."),
      // "server-only" throws under plain Node resolution; it only no-ops
      // under the react-server condition, which Vitest does not set.
      "server-only": path.resolve(import.meta.dirname, "test/stubs/server-only.ts"),
    },
  },
  test: {
    coverage: {
      provider: "v8",
      include: ["lib/**"],
      // Server Actions are thin wrappers (guard, parse, call, revalidate)
      // around the functions that are covered; guard-coverage.test.ts checks
      // the one thing about them that must never be skipped.
      exclude: ["lib/generated/**", "lib/**/*actions.ts", "lib/**/*.test.ts", "lib/**/queries.ts"],
      thresholds: {
        // The paths where a bug costs the shop money or a customer's trust.
        "lib/orders/**": { statements: 90, branches: 85, functions: 90, lines: 90 },
        "lib/quotes/**": { statements: 90, branches: 85, functions: 90, lines: 90 },
        "lib/payments/**": { statements: 90, branches: 85, functions: 90, lines: 90 },
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          setupFiles: ["./test/setup.ts"],
          exclude: ["**/node_modules/**", "**/.next/**", "**/*.integration.test.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["**/*.integration.test.ts"],
          exclude: ["**/node_modules/**", "**/.next/**"],
          setupFiles: ["./test/setup.integration.ts"],
          // Each file migrates its own schema, and `prisma migrate deploy`
          // takes one advisory lock per database: more workers only queue.
          maxWorkers: 4,
          sequence: { groupOrder: 1 },
          testTimeout: 20_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
