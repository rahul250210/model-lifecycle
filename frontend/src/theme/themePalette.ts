// --- LIGHT PALETTE ---
export const lightPalette = {
  mode: 'light',
  // Brand Colors
  primary: "#0EA5E9", // Sky 500
  primaryDark: "#0284C7", // Sky 600
  primaryLight: "#E0F2FE", // Sky 50

  secondary: "#8B5CF6", // Violet 500

  // Semantic Colors
  success: "#10B981", // Emerald 500
  successLight: "#D1FAE5", // Emerald 50

  warning: "#F59E0B", // Amber 500
  warningLight: "#FEF3C7", // Amber 50

  error: "#EF4444", // Rose 500
  errorLight: "#FFE4E6", // Rose 50
  danger: "#EF4444",

  info: "#3B82F6", // Blue 500

  // Text Colors
  textMain: "#0F172A", // Slate 900
  textSecondary: "#334155", // Slate 700
  textMuted: "#64748B", // Slate 500

  // Background & Surface
  background: "#F0F9FF", // Alice Blue
  surface: "rgba(255, 255, 255, 0.8)", // Glass white
  paper: "#FFFFFF",

  // Borders
  border: "#E0E7FF", // Indigo 100/200 blend
  divider: "#CBD5E1", // Slate 300

  // Layout Specific
  sidebarBg: "#0F172A",
  sidebarActive: "#38BDF8", // Sky 400

  // Utilities
  white: "#FFFFFF",
};

// --- DARK PALETTE ---
export const darkPalette = {
  mode: 'dark',
  // Brand Colors
  primary: "#38BDF8", // Sky 400 (Lighter for dark mode)
  primaryDark: "#0284C7", // Sky 600
  primaryLight: "rgba(14, 165, 233, 0.15)", // Sky 500 with low opacity

  secondary: "#A78BFA", // Violet 400

  // Semantic Colors
  success: "#34D399", // Emerald 400
  successLight: "rgba(16, 185, 129, 0.15)",

  warning: "#FBBF24", // Amber 400
  warningLight: "rgba(245, 158, 11, 0.15)",

  error: "#F87171", // Rose 400
  errorLight: "rgba(239, 68, 68, 0.15)",
  danger: "#F87171",

  info: "#60A5FA", // Blue 400

  // Text Colors
  textMain: "#F8FAFC", // Slate 50
  textSecondary: "#CBD5E1", // Slate 300
  textMuted: "#94A3B8", // Slate 400

  // Background & Surface
  background: "#020617", // Slate 950
  surface: "rgba(15, 23, 42, 0.6)", // Slate 900 glass
  paper: "#0F172A", // Slate 900

  // Borders
  border: "#1E293B", // Slate 800
  divider: "#334155", // Slate 700

  // Layout Specific
  sidebarBg: "#020617", // Slate 950
  sidebarActive: "#38BDF8", // Sky 400

  // Utilities
  white: "#FFFFFF",
};

// Default export for backward compatibility
export const themePalette = lightPalette;
