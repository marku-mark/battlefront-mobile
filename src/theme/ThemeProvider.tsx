import AsyncStorage from "@react-native-async-storage/async-storage";
import { vars } from "nativewind";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { View } from "react-native";

type ThemeMode = "dark" | "light";

type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  toggleMode: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);
const THEME_STORAGE_KEY = "battlefront-theme";

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
    "--border": "42 46 54",
    "--ring": "239 27 27",
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
    "--border": "213 206 197",
    "--ring": "183 52 44",
  },
} as const;

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>("dark");

  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((storedMode) => {
      if (storedMode === "light" || storedMode === "dark") setMode(storedMode);
    });
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      isDark: mode === "dark",
      toggleMode: () => {
        setMode((current) => {
          const nextMode = current === "dark" ? "light" : "dark";
          AsyncStorage.setItem(THEME_STORAGE_KEY, nextMode).catch(() => undefined);
          return nextMode;
        });
      },
    }),
    [mode]
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
