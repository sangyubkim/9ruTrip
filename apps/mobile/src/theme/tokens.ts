export type ThemeMode = "system" | "light" | "dark";

/** 화면 공통 여백 — 폴리시 일관성 */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  pill: 999,
} as const;

/** 화면 공통 타이포 — 폴리시 일관성 */
export const type = {
  brand: { fontSize: 30, fontWeight: "800" as const, letterSpacing: -0.4 },
  title: { fontSize: 22, fontWeight: "800" as const, letterSpacing: -0.2 },
  section: { fontSize: 16, fontWeight: "800" as const },
  body: { fontSize: 15, lineHeight: 22 },
  caption: { fontSize: 13, lineHeight: 19 },
  label: { fontSize: 13, fontWeight: "700" as const },
} as const;

export type ColorTokens = {
  bg: string;
  bgElevated: string;
  bgMuted: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  primary: string;
  primaryFg: string;
  accent: string;
  accentMuted: string;
  chipBg: string;
  chipFg: string;
  chipOnBg: string;
  chipOnFg: string;
  danger: string;
  success: string;
  mapBorder: string;
  undoBg: string;
  undoFg: string;
};

export const lightTokens: ColorTokens = {
  bg: "#f8fafc",
  bgElevated: "#ffffff",
  bgMuted: "#f1f5f9",
  text: "#0c4a6e",
  textSecondary: "#334155",
  textMuted: "#64748b",
  border: "#e2e8f0",
  primary: "#0c4a6e",
  primaryFg: "#ffffff",
  accent: "#0369a1",
  accentMuted: "#e0f2fe",
  chipBg: "#e2e8f0",
  chipFg: "#334155",
  chipOnBg: "#0c4a6e",
  chipOnFg: "#ffffff",
  danger: "#b91c1c",
  success: "#047857",
  mapBorder: "#bae6fd",
  undoBg: "#0f172a",
  undoFg: "#e0f2fe",
};

export const darkTokens: ColorTokens = {
  bg: "#0f172a",
  bgElevated: "#1e293b",
  bgMuted: "#334155",
  text: "#e0f2fe",
  textSecondary: "#cbd5e1",
  textMuted: "#94a3b8",
  border: "#334155",
  primary: "#38bdf8",
  primaryFg: "#0f172a",
  accent: "#7dd3fc",
  accentMuted: "#0c4a6e",
  chipBg: "#334155",
  chipFg: "#e2e8f0",
  chipOnBg: "#0284c7",
  chipOnFg: "#f8fafc",
  danger: "#f87171",
  success: "#34d399",
  mapBorder: "#0369a1",
  undoBg: "#e0f2fe",
  undoFg: "#0f172a",
};
