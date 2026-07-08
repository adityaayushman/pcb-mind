import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eefcf3",
          500: "#12b76a",
          600: "#0d9556",
          900: "#0a3d29",
        },
      },
    },
  },
  plugins: [],
};
export default config;
