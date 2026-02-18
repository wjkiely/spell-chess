import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./hooks/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Board color schemes
        board: {
          "wood-light": "#e8d0aa",
          "wood-dark": "#a67d5d",
          "green-light": "#eeeed2",
          "green-dark": "#769656",
          "blue-light": "#dee3e6",
          "blue-dark": "#8ca2ad",
          "purple-light": "#f0d9ff",
          "purple-dark": "#9b72aa",
        },
      },
    },
  },
  plugins: [],
};

export default config;
