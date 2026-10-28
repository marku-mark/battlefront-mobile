import { ChatProvider, useChat } from "@/hooks/useChat";
import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Pressable } from "react-native";
import { Chatbot } from "@/components/support/Chatbot";
import "../global.css";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { CartProvider } from "@/hooks/useCart";
import { WishlistProvider } from "@/hooks/useWishlist";
import { SessionProvider } from "@/hooks/useSession";
import { NotificationProvider } from "@/hooks/useNotifications";
import { ThemeProvider } from "@/theme/ThemeProvider";
import { useTheme } from "@/theme/ThemeProvider";
import { ToastProvider } from "@/hooks/useToast";

import { View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useFonts } from "expo-font";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

function AppStack() {
  const { isDark, isHydrated, reducedMotion } = useTheme();
  const [fontsLoaded, fontError] = useFonts(Ionicons.font);
  const { open } = useChat();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const ready = isHydrated && (fontsLoaded || Boolean(fontError));
  if (!ready) return null;

  return (
    <View className="flex-1 bg-background" onLayout={() => { void SplashScreen.hideAsync().catch(() => undefined); }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, animation: reducedMotion ? "none" : "default" }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
      {path === "/" && <Pressable accessibilityRole="button" accessibilityLabel="Open automated support" onPress={(event) => open(event.nativeEvent.target)} className="absolute right-4 w-12 h-12 rounded-full bg-primary items-center justify-center" style={{ bottom: 76 + insets.bottom }}><Ionicons name="chatbubble-ellipses" size={24} color="#ffffff" /></Pressable>}
      <Chatbot />
    </View>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SessionProvider>
          <ThemeProvider>
            <ToastProvider>
              <NotificationProvider>
                <CartProvider>
                  <WishlistProvider>
                    <ChatProvider><AppStack /></ChatProvider>
                  </WishlistProvider>
                </CartProvider>
              </NotificationProvider>
            </ToastProvider>
          </ThemeProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
