export const inter = {
  variable: "--font-inter"
} as const;

export const manrope = {
  variable: "--font-manrope"
} as const;

export const brand = {
  colors: {
    brandGreen: "#2166D9",
    brandGreenDark: "#184FB4",
    brandGreenSoft: "#E0ECFF",
    brandOrange: "#18A68C",
    brandOrangeSoft: "#DCF5EF",
    neutral: {
      bg: "#F7F9FC",
      surface: "#FFFFFF",
      surface2: "#F3F7FC",
      surface3: "#ECF2F9",
      border: "#DAE2EC",
      text: "#18233A",
      muted: "#64748B"
    },
    success: "#1A8E50",
    warning: "#C98A14",
    danger: "#C84A4A"
  },
  typography: {
    body: "Inter",
    heading: "DM Sans",
    sizes: {
      display: "clamp(3.35rem, 4.9vw, 5.2rem)",
      h1: "clamp(2.4rem, 3.8vw, 4.15rem)",
      h2: "clamp(1.8rem, 2.7vw, 2.9rem)",
      h3: "clamp(1.2rem, 1.75vw, 1.6rem)",
      bodyLg: "1.08rem",
      body: "1rem",
      button: "0.93rem",
      label: "0.8rem"
    }
  },
  radii: {
    card: "20px",
    panel: "28px",
    control: "14px"
  },
  shadows: {
    soft: "0 1px 2px rgba(15, 23, 42, 0.06)",
    card: "0 12px 30px rgba(15, 23, 42, 0.08)",
    lift: "0 18px 44px rgba(15, 23, 42, 0.12)"
  },
  spacing: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 24,
    xl: 32,
    "2xl": 48,
    "3xl": 72
  },
  layout: {
    containerMax: "1440px"
  }
} as const;
