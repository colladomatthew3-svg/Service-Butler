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
          surface3: "rgb(var(--surface3) / <alpha-value>)",
          border: "rgb(var(--border) / <alpha-value>)",
          text: "rgb(var(--text) / <alpha-value>)",
          muted: "rgb(var(--muted) / <alpha-value>)",
          brand: "rgb(var(--brand) / <alpha-value>)",
          brandHover: "rgb(var(--brandHover) / <alpha-value>)",
          accent: "rgb(var(--accent) / <alpha-value>)",
          success: "rgb(var(--success) / <alpha-value>)",
          warning: "rgb(var(--warning) / <alpha-value>)",
          danger: "rgb(var(--danger) / <alpha-value>)"
        },
        brand: {
          50: "#f4fae9",
          100: "#e7f3d1",
          200: "#cfe7a6",
          300: "#b4d774",
          400: "#9acb57",
          500: "#88BC42",
          600: "#6f9935",
          700: "#557429",
          800: "#3c511c",
          900: "#243211"
        },
        neutral: {
          50: "#f6f8f7",
          100: "#eef2f0",
          200: "#d8e0db",
          300: "#bcc8c1",
          400: "#93a399",
          500: "#72847a",
          600: "#5b6c64",
          700: "#45524c",
          800: "#2e3833",
          900: "#1e2a24"
        },
        accent: {
          500: "#DD9F74",
          600: "#c3875e"
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
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "Segoe UI", "Roboto", "Helvetica Neue", "Arial", "sans-serif"],
        heading: ["var(--font-manrope)", "Manrope", "Inter", "Segoe UI", "sans-serif"]
      },
      borderRadius: {
        xl: "12px",
        "2xl": "14px",
        "3xl": "20px"
      },
      boxShadow: {
        soft: "0 6px 20px rgba(30, 42, 36, 0.08)",
        card: "0 14px 36px rgba(30, 42, 36, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
