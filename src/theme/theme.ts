// Supplementary theme constants that NativeWind can't express directly
// (platform-specific shadow/elevation). Colors live in tailwind.config.js —
// always prefer className tokens (bg-background, text-foreground, etc.)
// over anything here; this file only covers what Tailwind classes can't do.
import { Platform } from "react-native";

export const shadow = {
  sm: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.3,
      shadowRadius: 2,
    },
    android: { elevation: 2 },
    default: {},
  }),
  md: Platform.select({
    ios: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.35,
      shadowRadius: 6,
    },
    android: { elevation: 6 },
    default: {},
  }),
};

export const radius = {
  sm: 4,
  md: 6,
  lg: 8,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
};
