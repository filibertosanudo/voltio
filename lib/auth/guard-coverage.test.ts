// Walks every Server Action in the repository, not a hand-written list,
// and fails if one does anything before checking who is calling. A new
// action file is covered the day it is created; forgetting the guard is a
// red build, not something a reviewer has to notice.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(import.meta.dirname, "../..");
const SCAN = ["app", "lib", "components"];

// Actions anyone on the internet may call. They cannot require a role, so
// they must start by spending rate limit instead.
const PUBLIC_ACTION_FILES = ["lib/track/actions.ts", "lib/auth/sign-in-actions.ts"];

function sourceFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "generated" || entry.name === "node_modules" ? [] : sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !entry.name.includes(".test.") ? [full] : [];
  });
}

function serverActions(file: string): { name: string; firstStatement: string }[] {
  const source = ts.createSourceFile(file, readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true);
  const first = source.statements[0];
  const isActionFile =
    first && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text === "use server";
  if (!isActionFile) return [];

  return source.statements.flatMap((statement) => {
    if (!ts.isFunctionDeclaration(statement) || !statement.name || !statement.body) return [];
    const exported = statement.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (!exported) return [];
    return [{ name: statement.name.text, firstStatement: statement.body.statements[0]?.getText(source) ?? "" }];
  });
}

const files = SCAN.flatMap((dir) => sourceFiles(path.join(ROOT, dir)));
const actions = files.flatMap((file) => {
  const relative = path.relative(ROOT, file).replaceAll("\\", "/");
  return serverActions(file).map((action) => ({ ...action, file: relative }));
});

describe("server action guards", () => {
  it("finds the actions (a scan that finds none proves nothing)", () => {
    expect(actions.length).toBeGreaterThan(10);
  });

  it.each(actions)("$file: $name checks the caller first", ({ file, firstStatement }) => {
    if (PUBLIC_ACTION_FILES.includes(file)) {
      expect(firstStatement).toMatch(/await publicRateLimit\(/);
    } else {
      expect(firstStatement).toMatch(/await requireRole\(/);
    }
  });

  it("keeps the public list honest", () => {
    const actionFiles = new Set(actions.map((action) => action.file));
    for (const file of PUBLIC_ACTION_FILES) expect(actionFiles.has(file), file).toBe(true);
  });
});
