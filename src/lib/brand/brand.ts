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
      h1: "text-4xl md:text-5xl",
      h2: "text-2xl md:text-3xl",
      body: "text-base",
      button: "text-sm md:text-base"
    }
  },
  radii: {
    card: "14px",
    control: "12px"
  },
  shadows: {
    soft: "0 6px 20px rgba(30, 42, 36, 0.08)",
    card: "0 14px 36px rgba(30, 42, 36, 0.12)"
  },
  spacing: [8, 12, 16, 24, 32],
  layout: {
    containerMax: "1240px"
  }
} as const;
