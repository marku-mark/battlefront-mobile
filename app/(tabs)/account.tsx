import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";

const accountLinks = [
  { icon: "receipt-outline", label: "My orders", detail: "Track purchases and deliveries", badge: "Soon" },
  { icon: "heart-outline", label: "Wishlist", detail: "Save products for later", badge: "Saved" },
  { icon: "location-outline", label: "Delivery addresses", detail: "Manage your saved locations", badge: "Soon" },
  { icon: "help-circle-outline", label: "Help center", detail: "Get support from Battlefront", badge: "Live" },
] as const;

export default function AccountScreen() {
  const router = useRouter();
  const { isDark, toggleMode } = useTheme();
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "register">("signin");
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [selectedUtility, setSelectedUtility] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View className="px-4 pt-3 pb-5 border-b border-border">
          <Text className="text-foreground text-2xl font-bold">Account</Text>
          <Text className="text-muted-foreground text-sm mt-1">
            Manage your Battlefront shopping experience.
          </Text>
        </View>

        <View className="mx-4 mt-5 rounded-2xl bg-card border border-border p-4">
          <View className="flex-row items-center">
            <View className="w-14 h-14 rounded-full bg-secondary border border-border items-center justify-center">
              <Ionicons name="person-outline" size={26} color={isDark ? "#cbd5e1" : "#68717e"} />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-foreground text-base font-semibold">
                {isSignedIn ? "Welcome back" : "Shop as a guest"}
              </Text>
              <Text className="text-muted-foreground text-xs mt-1">
                {isSignedIn ? "Your orders and saved details are ready." : "Sign in to track orders and save your details."}
              </Text>
            </View>
          </View>

          <View className="flex-row gap-3 mt-5">
            <Pressable
              onPress={() => {
                setAuthMode("signin");
                setIsAuthOpen(true);
              }}
              accessibilityLabel="Sign in"
              className="flex-1 bg-primary rounded-xl items-center py-3"
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <Text className="text-primary-foreground text-sm font-semibold">
                {isSignedIn ? "Sign out" : "Sign in"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (isSignedIn) {
                  setIsSignedIn(false);
                  return;
                }
                setAuthMode("register");
                setIsAuthOpen(true);
              }}
              accessibilityLabel="Create account"
              className="flex-1 border border-border rounded-xl items-center py-3"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text className="text-foreground text-sm font-semibold">
                {isSignedIn ? "Account settings" : "Create account"}
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="flex-row items-center justify-between px-4 mt-7 mb-3">
          <Text className="text-foreground text-base font-bold">Account shortcuts</Text>
          <Text className="text-muted-foreground text-[11px] uppercase tracking-[0.14em]">
            Guest mode
          </Text>
        </View>
        <View className="mx-4 rounded-2xl bg-card border border-border overflow-hidden">
          <Pressable
            onPress={() => router.push("/store-locator")}
            accessibilityLabel="Find a Battlefront store"
            className="flex-row items-center p-4 border-b border-border"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <View className="w-9 h-9 rounded-xl bg-secondary items-center justify-center">
              <Ionicons name="storefront-outline" size={19} color={isDark ? "#f8fafc" : "#30343b"} />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-foreground text-sm font-medium">Store locator</Text>
              <Text className="text-muted-foreground text-xs mt-0.5">Find a Battlefront branch near you</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={isDark ? "#9ca3af" : "#68717e"} />
          </Pressable>
          {accountLinks.map((link, index) => (
            <Pressable
              key={link.label}
              onPress={() => {
                if (link.label === "Wishlist") {
                  router.push("/wishlist");
                  return;
                }
                setSelectedUtility(link.label);
              }}
              className={`flex-row items-center p-4 ${index < accountLinks.length - 1 ? "border-b border-border" : ""}`}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View className="w-9 h-9 rounded-xl bg-secondary items-center justify-center">
                <Ionicons name={link.icon} size={19} color={isDark ? "#f8fafc" : "#30343b"} />
              </View>
              <View className="flex-1 ml-3">
                <View className="flex-row items-center gap-2">
                  <Text className="text-foreground text-sm font-medium">
                    {link.label}
                  </Text>
                  <View className={`rounded-full px-1.5 py-0.5 ${link.badge === "Live" ? "bg-primary/15" : "bg-secondary"}`}>
                    <Text className={`text-[9px] font-bold uppercase tracking-[0.08em] ${link.badge === "Live" ? "text-primary" : "text-muted-foreground"}`}>
                      {link.badge}
                    </Text>
                  </View>
                </View>
                <Text className="text-muted-foreground text-xs mt-0.5">
                  {link.detail}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={isDark ? "#9ca3af" : "#68717e"} />
            </Pressable>
          ))}
          <Pressable
            onPress={toggleMode}
            className="flex-row items-center p-4 border-t border-border"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <View className="w-9 h-9 rounded-xl bg-secondary items-center justify-center">
              <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={19} color={isDark ? "#f8fafc" : "#30343b"} />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-foreground text-sm font-medium">
                {isDark ? "Light mode" : "Dark mode"}
              </Text>
              <Text className="text-muted-foreground text-xs mt-0.5">
                Change the app appearance
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={isDark ? "#9ca3af" : "#68717e"} />
          </Pressable>
        </View>

        <View className="flex-row items-center justify-center gap-1.5 mt-7">
          <Ionicons name="shield-checkmark-outline" size={15} color="#9ca3af" />
          <Text className="text-muted-foreground text-xs">
            Your information stays secure with Battlefront.
          </Text>
        </View>
      </ScrollView>

      <Modal visible={isAuthOpen} animationType="slide" transparent onRequestClose={() => setIsAuthOpen(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-background rounded-t-3xl border-t border-border px-4 pt-4 pb-8">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-foreground text-xl font-bold">{authMode === "signin" ? "Sign in" : "Create account"}</Text>
                <Text className="text-muted-foreground text-xs mt-1">Use a demo account to preview the account experience.</Text>
              </View>
              <Pressable accessibilityLabel="Close account access" onPress={() => setIsAuthOpen(false)} hitSlop={8} className="w-9 h-9 items-center justify-center">
                <Ionicons name="close" size={22} color={isDark ? "#f8fafc" : "#30343b"} />
              </Pressable>
            </View>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              className="bg-secondary border border-border rounded-xl px-3 h-12 text-foreground text-sm mt-6"
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              className="bg-secondary border border-border rounded-xl px-3 h-12 text-foreground text-sm mt-3"
            />
            <Pressable
              accessibilityLabel={authMode === "signin" ? "Continue with sign in" : "Create demo account"}
              onPress={() => {
                setIsSignedIn(true);
                setIsAuthOpen(false);
              }}
              className="bg-primary rounded-xl items-center py-3.5 mt-5"
            >
              <Text className="text-primary-foreground text-sm font-bold">Continue</Text>
            </Pressable>
            <Pressable onPress={() => setAuthMode((current) => current === "signin" ? "register" : "signin")} className="items-center py-3">
              <Text className="text-primary text-xs font-semibold">{authMode === "signin" ? "Create a new account" : "Already have an account? Sign in"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={selectedUtility !== null} animationType="fade" transparent onRequestClose={() => setSelectedUtility(null)}>
        <View className="flex-1 items-center justify-center px-6 bg-black/50">
          <View className="w-full bg-background border border-border rounded-2xl p-5">
            <Text className="text-foreground text-lg font-bold">{selectedUtility}</Text>
            <Text className="text-muted-foreground text-sm leading-5 mt-2">
              This mock surface is ready for the next account and support UI pass.
            </Text>
            <Pressable onPress={() => setSelectedUtility(null)} className="bg-primary rounded-xl items-center py-3 mt-5">
              <Text className="text-primary-foreground text-sm font-semibold">Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
