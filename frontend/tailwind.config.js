/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: { sans: ["DM Sans", "system-ui", "sans-serif"] },
      colors: {
        brand: { DEFAULT: "#0d9488", dark: "#0f766e" },
      },
    },
  },
  plugins: [],
};
