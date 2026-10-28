import { useReducedMotion } from "@/hooks/useReducedMotion";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { vars } from "nativewind";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Alert, View } from "react-native";
import { useSession } from "@/hooks/useSession";

type ThemeMode = "dark" | "light";

type ThemeContextValue = {
  mode: ThemeMode;
  isHydrated: boolean;
  reducedMotion: boolean;
  isDark: boolean;
  colors: {
    background: string;
    border: string;
    foreground: string;
    icon: string;
    muted: string;
    primary: string;
    primaryForeground: string;
    rating: string;
  };
  toggleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_STORAGE_KEY = "battlefront-guest-theme";

const themes = {
  dark: {
    "--background": "9 11 16",
    "--foreground": "248 250 252",
    "--card": "17 19 24",
    "--card-foreground": "248 250 252",
    "--primary": "185 28 28",
    "--primary-foreground": "248 250 252",
    "--secondary": "27 30 36",
    "--secondary-foreground": "248 250 252",
    "--muted": "27 30 36",
    "--muted-foreground": "156 163 175",
    "--icon": "203 213 225",
    "--placeholder": "148 163 184",
    "--success": "34 197 94",
    "--danger": "239 68 68",
    "--disabled": "156 163 175",
    "--primary-text": "248 113 113",
    "--border": "42 46 54",
    "--ring": "239 27 27",
    colors: { background: "#090b10", border: "#2a2e36", foreground: "#f8fafc", icon: "#cbd5e1", muted: "#9ca3af", primary: "#b91c1c", primaryForeground: "#f8fafc", rating: "#f59e0b" },
  },
  light: {
    "--background": "244 240 235",
    "--foreground": "38 42 48",
    "--card": "255 251 247",
    "--card-foreground": "38 42 48",
    "--primary": "171 41 35",
    "--primary-foreground": "255 255 255",
    "--secondary": "232 226 219",
    "--secondary-foreground": "48 52 59",
    "--muted": "237 232 225",
    "--muted-foreground": "89 96 106",
    "--icon": "72 79 89",
    "--placeholder": "89 96 106",
    "--success": "22 132 65",
    "--danger": "185 28 28",
    "--disabled": "89 96 106",
    "--primary-text": "171 41 35",
    "--border": "213 206 197",
    "--ring": "183 52 44",
    colors: { background: "#f4f0eb", border: "#d5cec5", foreground: "#30343b", icon: "#4b5563", muted: "#68717e", primary: "#ab2923", primaryForeground: "#f8fafc", rating: "#a16207" },
  },
} as const;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { session, saveProfile } = useSession();
  const saving = useRef(false);
  const reducedMotion = useReducedMotion();
  const [isHydrated, setIsHydrated] = useState(false);
  const [guestMode, setGuestMode] = useState<ThemeMode>("light");
  const mode = session.mode === "customer" ? session.user.appearance ?? "light" : guestMode;

  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((storedMode) => {
      if (active && (storedMode === "light" || storedMode === "dark")) setGuestMode(storedMode);
    }).catch(() => undefined).finally(() => { if (active) setIsHydrated(true); });
    return () => { active = false; };
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      isHydrated,
      reducedMotion,
      isDark: mode === "dark",
      colors: themes[mode].colors,
      toggleMode: () => {
        const nextMode = mode === "dark" ? "light" : "dark";
        if (session.mode === "customer") {
          if (saving.current) return;
          saving.current = true;
          void saveProfile({ name: session.user.name, email: session.user.email, appearance: nextMode }, session.user.id)
            .catch((error) => Alert.alert("Could not save appearance", error instanceof Error ? error.message : "Try again."))
            .finally(() => { saving.current = false; });
        } else {
          setGuestMode(nextMode);
          void AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode).catch(() => undefined);
        }
      },
    }),
    [mode, isHydrated, reducedMotion, session, saveProfile]
  );

  return (
    <ThemeContext.Provider value={value}>
      <View style={vars(themes[mode])} className="flex-1">
        {children}
      </View>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
