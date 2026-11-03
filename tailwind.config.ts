import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { pine: "#0b3d2a", court: "#15803d", leaf: "#22c55e", mint: "#e8f8ee", ball: "#d4f53c" },
      fontFamily: { display: ["var(--font-display)"], sans: ["var(--font-body)"] },
    },
  },
  plugins: [],
};
export default config;
