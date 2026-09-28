import "../global.css";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { CartProvider } from "@/hooks/useCart";
import { WishlistProvider } from "@/hooks/useWishlist";
import { SessionProvider } from "@/hooks/useSession";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { initializeCatalogDatabase } from "@/lib/database";
import { useEffect, useState } from "react";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AppStack() {
  const { isDark } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [isAppReady, setIsAppReady] = useState(false);

  useEffect(() => {
    initializeCatalogDatabase()
      .catch(() => undefined)
      .finally(() => setIsAppReady(true));
  }, []);

  useEffect(() => {
    if (isAppReady) void SplashScreen.hideAsync().catch(() => undefined);
  }, [isAppReady]);

  if (!isAppReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <SessionProvider>
            <CartProvider>
              <WishlistProvider>
                <AppStack />
              </WishlistProvider>
            </CartProvider>
          </SessionProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
