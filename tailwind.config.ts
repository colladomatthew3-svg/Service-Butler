import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1.25rem",
        sm: "1.5rem",
        lg: "2rem",
        xl: "2.5rem"
      },
      screens: {
        "2xl": "1240px"
      }
    },
    extend: {
      colors: {
        semantic: {
          bg: "rgb(var(--bg) / <alpha-value>)",
          surface: "rgb(var(--surface) / <alpha-value>)",
          surface2: "rgb(var(--surface2) / <alpha-value>)",
          border: "rgb(var(--border) / <alpha-value>)",
          text: "rgb(var(--text) / <alpha-value>)",
          muted: "rgb(var(--muted) / <alpha-value>)",
          brand: "rgb(var(--brand) / <alpha-value>)",
          brandHover: "rgb(var(--brandHover) / <alpha-value>)",
          success: "rgb(var(--success) / <alpha-value>)",
          warning: "rgb(var(--warning) / <alpha-value>)",
          danger: "rgb(var(--danger) / <alpha-value>)"
        },
        brand: {
          50: "#f4fae8",
          100: "#e4f3c7",
          200: "#c9e890",
          300: "#aad95b",
          400: "#90cc35",
          500: "#78BE20",
          600: "#5f9918",
          700: "#486f13",
          800: "#2f490c",
          900: "#1a2b07"
        },
        neutral: {
          50: "#f7f9fb",
          100: "#f1f4f7",
          200: "#dbe3ea",
          300: "#bac8d3",
          400: "#92a2b2",
          500: "#708395",
          600: "#52606d",
          700: "#3d4b59",
          800: "#273340",
          900: "#1f2933"
        },
        accent: {
          500: "#D98C5F",
          600: "#be7550"
        },
        success: {
          100: "#e8f7eb",
          500: "#1f9d55",
          700: "#16683a"
        },
        warning: {
          100: "#fff4de",
          500: "#d99100",
          700: "#8a5d00"
        },
        danger: {
          100: "#fdeaea",
          500: "#d64545",
          700: "#8e1f1f"
        },
        card: "#ffffff"
      },
      fontFamily: {
        sans: ["Inter", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"]
      },
      borderRadius: {
        xl: "0.9rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem"
      },
      boxShadow: {
        soft: "0 4px 18px rgba(31, 41, 51, 0.08)",
        card: "0 10px 30px rgba(31, 41, 51, 0.09)"
      }
    }
  },
  plugins: []
};

export default config;
