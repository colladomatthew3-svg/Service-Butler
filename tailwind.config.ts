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
          bg: "rgb(var(--sb-bg) / <alpha-value>)",
          surface: "rgb(var(--sb-card) / <alpha-value>)",
          surface2: "rgb(var(--sb-surface-alt) / <alpha-value>)",
          surface3: "rgb(var(--surface3) / <alpha-value>)",
          border: "rgb(var(--sb-border) / <alpha-value>)",
          text: "rgb(var(--sb-text) / <alpha-value>)",
          muted: "rgb(var(--sb-muted) / <alpha-value>)",
          brand: "rgb(var(--sb-primary) / <alpha-value>)",
          brandHover: "rgb(var(--sb-primary-hover) / <alpha-value>)",
          accent: "rgb(var(--sb-copper) / <alpha-value>)",
          success: "rgb(var(--success) / <alpha-value>)",
          warning: "rgb(var(--warning) / <alpha-value>)",
          danger: "rgb(var(--danger) / <alpha-value>)"
        },
        card: "rgb(var(--sb-card) / <alpha-value>)",
        brand: {
          50: "rgb(var(--sb-primary-soft) / <alpha-value>)",
          100: "rgb(var(--sb-primary-soft) / <alpha-value>)",
          200: "rgb(var(--sb-primary-soft) / 0.75)",
          300: "rgb(var(--sb-primary) / 0.72)",
          400: "rgb(var(--sb-primary) / 0.86)",
          500: "rgb(var(--sb-primary) / <alpha-value>)",
          600: "rgb(var(--sb-primary-hover) / <alpha-value>)",
          700: "rgb(var(--sb-primary-hover) / <alpha-value>)",
          800: "rgb(var(--sb-text) / <alpha-value>)",
          900: "rgb(var(--sb-text) / <alpha-value>)"
        },
        neutral: {
          50: "rgb(var(--sb-bg) / <alpha-value>)",
          100: "rgb(var(--sb-surface-alt) / <alpha-value>)",
          200: "rgb(var(--sb-border) / <alpha-value>)",
          300: "rgb(var(--sb-border) / 0.85)",
          400: "rgb(var(--sb-muted) / 0.65)",
          500: "rgb(var(--sb-muted) / 0.8)",
          600: "rgb(var(--sb-muted) / <alpha-value>)",
          700: "rgb(var(--sb-text) / 0.82)",
          800: "rgb(var(--sb-text) / 0.92)",
          900: "rgb(var(--sb-text) / <alpha-value>)"
        },
        accent: {
          500: "rgb(var(--sb-copper) / <alpha-value>)",
          600: "rgb(var(--sb-copper) / 0.88)"
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
        soft: "0 1px 2px rgba(30, 42, 36, 0.08)",
        card: "0 14px 36px rgba(30, 42, 36, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
