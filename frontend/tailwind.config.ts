import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./store/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#08121C",
        mist: "#EEF6FB",
        ocean: "#0F6CBD",
        mint: "#14B8A6",
        ember: "#F59E0B",
        rose: "#F43F5E",
        panel: "#0D1B2A",
      },
      boxShadow: {
        float: "0 24px 80px rgba(8, 18, 28, 0.18)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
      backgroundImage: {
        grid: "linear-gradient(rgba(8,18,28,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(8,18,28,0.06) 1px, transparent 1px)",
      },
      fontFamily: {
        sans: ["var(--font-space-grotesk)", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
