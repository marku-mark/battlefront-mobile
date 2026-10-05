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

import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFonts } from "expo-font";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AppStack() {
  const { isDark, isHydrated, reducedMotion } = useTheme();
  const [fontsLoaded, fontError] = useFonts(Ionicons.font);
  const ready = isHydrated && (fontsLoaded || Boolean(fontError));
  if (!ready) return null;

  return (
    <View className="flex-1 bg-background" onLayout={() => { void SplashScreen.hideAsync().catch(() => undefined); }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, animation: reducedMotion ? "none" : "default" }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
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
