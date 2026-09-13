/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        ink: {
          50: "#f7f8fb",
          100: "#eef1f6",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
        },
        forge: {
          500: "#2563eb",
          600: "#1d4ed8",
          700: "#1e40af",
        },
        mint: {
          500: "#14b8a6",
          600: "#0d9488",
        },
      },
      boxShadow: {
        panel: "0 20px 50px -30px rgba(15, 23, 42, 0.35)",
      },
    },
  },
  plugins: [],
};
