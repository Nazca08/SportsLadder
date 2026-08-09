import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        court: { DEFAULT: "#14302A", deep: "#0D211C" },
        panel: "#1B3E36",
        chalk: { DEFAULT: "#F4F2E9", dim: "rgba(244,242,233,0.62)" },
        ink: "#0B1F1A",
        ball: "#D7E639",
        paddle: "#EA5A3D",
      },
      fontFamily: {
        display: ["Oswald", "sans-serif"],
        body: ["Inter", "sans-serif"],
        score: ["'Space Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
