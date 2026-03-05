export const inter = { variable: "" } as const;
export const manrope = { variable: "" } as const;

export const brand = {
  colors: {
    brandGreen: "#88BC42",
    brandGreenDark: "#6F9935",
    brandGreenSoft: "#E7F3D1",
    brandOrange: "#DD9F74",
    brandOrangeSoft: "#F5E0D1",
    neutral: {
      bg: "#F6F8F7",
      surface: "#FFFFFF",
      surface2: "#F2F5F3",
      border: "#D8E0DB",
      text: "#1E2A24",
      muted: "#5B6C64"
    },
    success: "#1F9D55",
    warning: "#D99100",
    danger: "#D64545"
  },
  typography: {
    body: "Inter",
    heading: "Manrope",
    sizes: {
      display: "clamp(3.5rem, 5vw, 5.5rem)",
      h1: "clamp(2.75rem, 4vw, 4.5rem)",
      h2: "clamp(2rem, 3vw, 3.25rem)",
      h3: "clamp(1.4rem, 2vw, 1.85rem)",
      bodyLg: "1.125rem",
      body: "1rem",
      button: "0.95rem",
      label: "0.82rem"
    }
  },
  radii: {
    card: "16px",
    panel: "20px",
    control: "12px"
  },
  shadows: {
    soft: "0 6px 20px rgba(30, 42, 36, 0.08)",
    card: "0 14px 36px rgba(30, 42, 36, 0.12)",
    lift: "0 24px 64px rgba(30, 42, 36, 0.16)"
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
    containerMax: "1240px"
  }
} as const;
