import "server-only";
import { z } from "zod";

// Compose's ${VAR:-} and more than one hosting dashboard produce an empty
// string for an unset variable. Neither .optional() nor .default() treats
// that as missing, so every optional field normalizes "" first.
const emptyToUndefined = (v: unknown) => (v === "" ? undefined : v);
const optional = <T extends z.ZodType>(inner: T) => z.preprocess(emptyToUndefined, inner.optional());
const withDefault = <T extends z.ZodType>(defaulted: T) => z.preprocess(emptyToUndefined, defaulted);
const flag = withDefault(z.enum(["0", "1"]).default("0")).transform((v) => v === "1");

const schema = z
  .object({
    DATABASE_URL: z.string().min(1, "postgresql://user:pass@host:5432/db"),
    DATABASE_POOL_MAX: withDefault(z.coerce.number().int().min(1).default(10)),
    // Unset in every real deployment. The integration tests point the client
    // at a throwaway schema: @prisma/adapter-pg qualifies generated queries
    // with this, it does not infer it from the connection's search_path.
    DATABASE_SCHEMA: optional(z.string().min(1)),
    // Only the web process needs it (Auth.js reads it from process.env
    // itself). The worker and the seed never authenticate anyone, and should
    // not hold the key that signs every session.
    AUTH_SECRET: optional(z.string().min(1)),
    // Where customers reach the site. Tracking links in emails and on the
    // printed receipt's QR code are built from it.
    APP_ORIGIN: withDefault(z.url().default("http://localhost:3000")),
    // Proxies in front of the app that overwrite x-forwarded-for. The client
    // address is read that many entries from the right (lib/security/client-ip.ts).
    TRUSTED_PROXY_COUNT: withDefault(z.coerce.number().int().min(0).default(1)),
    MAIL_DRIVER: withDefault(z.enum(["console", "smtp"]).default("console")),
    MAIL_FROM_EMAIL: withDefault(z.email().default("avisos@voltio.local")),
    MAIL_FROM_NAME: optional(z.string().min(1)),
    SMTP_HOST: optional(z.string().min(1)),
    SMTP_PORT: withDefault(z.coerce.number().int().min(1).max(65535).default(587)),
    SMTP_USER: optional(z.string().min(1)),
    SMTP_PASSWORD: optional(z.string().min(1)),
    SMTP_SECURE: flag,
    STORAGE_LOCAL_DIR: withDefault(z.string().min(1).default("./data/media")),
    // The public portfolio demo: one-click sign-in as each role on the login
    // page. Off unless set; never on for a real shop.
    DEMO_MODE: flag,
  })
  .superRefine((value, ctx) => {
    if (value.MAIL_DRIVER === "smtp" && !value.SMTP_HOST) {
      ctx.addIssue({ code: "custom", path: ["SMTP_HOST"], message: "required when MAIL_DRIVER=smtp" });
    }
  });

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

function load(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => `  ${issue.path.join(".")}: ${issue.message}`);
    throw new Error(`Invalid environment configuration:\n${lines.join("\n")}`);
  }
  cached = parsed.data;
  return cached;
}

/**
 * Validated on first real access, not at import: `next build` evaluates
 * route modules with no runtime environment, and a throw at import would
 * make a portable image impossible to build.
 */
export const env: Env = new Proxy({} as Env, {
  get(_target, prop) {
    return load()[prop as keyof Env];
  },
});

export const isProduction = process.env.NODE_ENV === "production";

/** Test-only: forget the parsed value so a test can change process.env. */
export function resetEnvCache(): void {
  cached = undefined;
}
