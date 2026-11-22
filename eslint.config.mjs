import coreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

// process.env is read in exactly one place (lib/env.ts), which validates it.
// A second reader is a variable that can be missing or malformed in
// production without the process refusing to start.
const envRule = {
  "no-restricted-properties": [
    "error",
    {
      object: "process",
      property: "env",
      message: "Read configuration through lib/env.ts, which validates it at first use.",
    },
  ],
};

const config = [
  {
    ignores: ["lib/generated/**", ".next/**", "coverage/**", "node_modules/**", "graphify-out/**", "next-env.d.ts"],
  },
  ...coreWebVitals,
  ...nextTypescript,
  { files: ["app/**/*.{ts,tsx}", "components/**/*.{ts,tsx}", "lib/**/*.{ts,tsx}"], rules: envRule },
  {
    // The places that legitimately run before or outside lib/env.ts.
    files: ["lib/env.ts", "lib/security/csp.ts", "**/*.test.ts", "test/**"],
    rules: { "no-restricted-properties": "off" },
  },
];

export default config;
