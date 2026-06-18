import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pine: "var(--pine)",
        "pine-deep": "var(--pine-deep)",
        coral: "var(--coral)",
        "coral-ink": "var(--coral-ink)",
        gold: "var(--gold)",
        "gold-ink": "var(--gold-ink)",
        cream: "var(--cream)",
        sage: "var(--sage)",
        mist: "var(--mist)",
        success: "var(--success)",
        paper: "var(--paper)",
        line: "var(--line)",
      },
      fontFamily: {
        display: ["var(--font-display)", "ui-sans-serif", "system-ui"],
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui"],
      },
      fontWeight: {
        normal: "400",
        500: "500",
        medium: "500",
        600: "600",
        semibold: "600",
        700: "700",
        bold: "700",
        800: "800",
      },
      borderRadius: {
        xl2: "1.25rem",
        xl3: "1.75rem",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(20,58,54,0.04), 0 12px 30px rgba(20,58,54,0.07)",
        lift: "0 8px 24px rgba(20,58,54,0.10), 0 24px 60px rgba(20,58,54,0.14)",
        glow: "0 0 0 1px rgba(255,194,71,0.45), 0 10px 34px rgba(255,107,74,0.28)",
      },
    },
  },
  plugins: [],
};
export default config;
