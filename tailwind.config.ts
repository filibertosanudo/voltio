import type { Config } from "tailwindcss";

const config: Config = {
  // lib/ is scanned too: lib/orders/status.ts owns the badge classes of every
  // order status, so the state machine and its colours live in one place.
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#0d1117",
          800: "#161b22",
          700: "#21262d",
          600: "#30363d",
          500: "#484f58",
        },
        paper: {
          DEFAULT: "#f7f5f0",
          deep: "#edeae2",
        },
        volt: {
          DEFAULT: "#ffd400",
          deep: "#e0b800",
          soft: "#fff6c2",
        },
        line: "#e2ded3",
        muted: "#646b75",
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(13 17 23 / 0.06), 0 8px 24px -12px rgb(13 17 23 / 0.12)",
        lift: "0 24px 60px -24px rgb(13 17 23 / 0.45)",
      },
      borderRadius: {
        xl: "0.875rem",
        "2xl": "1.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
