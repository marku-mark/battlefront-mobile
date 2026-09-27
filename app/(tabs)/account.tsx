import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSession } from "@/hooks/useSession";
import { DEMO_ACCOUNT, DEMO_ADDRESSES, DEMO_ORDERS } from "@/lib/mockAccount";
import { useTheme } from "@/theme/ThemeProvider";

const accountLinks = [
  { icon: "receipt-outline", label: "My orders", detail: "View sample order history", badge: "Demo" },
  { icon: "heart-outline", label: "Wishlist", detail: "Saved on this device", badge: "Local" },
  { icon: "location-outline", label: "Delivery addresses", detail: "Use the sample saved address", badge: "Demo" },
  { icon: "help-circle-outline", label: "Help center", detail: "Preview support information", badge: "Preview" },
] as const;

export default function AccountScreen() {
  const router = useRouter();
  const { isDark, toggleMode } = useTheme();
  const { session, signIn, signOut } = useSession();
  const isMockAccount = session.mode === "mock-account";
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [selectedUtility, setSelectedUtility] = useState<string | null>(null);
  const [email, setEmail] = useState<string>(DEMO_ACCOUNT.email);
  const [password, setPassword] = useState<string>(DEMO_ACCOUNT.password);
  const [authError, setAuthError] = useState("");

  function openSignIn(message = "") {
    setAuthError(message);
    setIsAuthOpen(true);
  }

  function handleSignIn() {
    if (!signIn(email, password)) {
      setAuthError("Those details don't match the local demo account.");
      return;
    }

    setAuthError("");
    setIsAuthOpen(false);
  }

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
                {isMockAccount ? `Welcome, ${session.user.displayName}` : "Shop as a guest"}
              </Text>
              <Text className="text-muted-foreground text-xs mt-1">
                {isMockAccount ? "Mock account · sample data saved on this device." : "Browse, shop, and save items locally without signing in."}
              </Text>
            </View>
          </View>

          <View className="flex-row gap-3 mt-5">
            <Pressable
              onPress={() => {
                if (isMockAccount) {
                  signOut();
                  return;
                }
                openSignIn();
              }}
              accessibilityLabel={isMockAccount ? "Sign out of demo account" : "Sign in to demo account"}
              className="flex-1 bg-primary rounded-xl items-center py-3"
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <Text className="text-primary-foreground text-sm font-semibold">
                {isMockAccount ? "Sign out" : "Sign in to demo"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (isMockAccount) {
                  setSelectedUtility("Account settings");
                  return;
                }
                signOut();
              }}
              accessibilityLabel={isMockAccount ? "Open demo account settings" : "Continue as guest"}
              className="flex-1 border border-border rounded-xl items-center py-3"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text className="text-foreground text-sm font-semibold">
                {isMockAccount ? "Account settings" : "Continue as guest"}
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="flex-row items-center justify-between px-4 mt-7 mb-3">
          <Text className="text-foreground text-base font-bold">Account shortcuts</Text>
          <Text className="text-muted-foreground text-[11px] uppercase tracking-[0.14em]">
            {isMockAccount ? "Mock account" : "Guest mode"}
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
                if ((link.label === "My orders" || link.label === "Delivery addresses") && !isMockAccount) {
                  openSignIn(`Sign in to the demo account to view ${link.label.toLowerCase()}.`);
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
                  <View className={`rounded-full px-1.5 py-0.5 ${link.badge === "Demo" ? "bg-primary/15" : "bg-secondary"}`}>
                    <Text className={`text-[9px] font-bold uppercase tracking-[0.08em] ${link.badge === "Demo" ? "text-primary" : "text-muted-foreground"}`}>
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
            Guest and mock account data stay on this device.
          </Text>
        </View>
      </ScrollView>

      <Modal visible={isAuthOpen} animationType="slide" transparent onRequestClose={() => setIsAuthOpen(false)}>
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-background rounded-t-3xl border-t border-border px-4 pt-4 pb-8">
            <View className="flex-row items-center justify-between">
              <View>
                <Text className="text-foreground text-xl font-bold">Sign in to demo account</Text>
                <Text className="text-muted-foreground text-xs mt-1">Local preview only. These details are not sent anywhere.</Text>
              </View>
              <Pressable accessibilityLabel="Close demo sign in" onPress={() => setIsAuthOpen(false)} hitSlop={8} className="w-9 h-9 items-center justify-center">
                <Ionicons name="close" size={22} color={isDark ? "#f8fafc" : "#30343b"} />
              </Pressable>
            </View>
            <TextInput
              value={email}
              onChangeText={setEmail}
              accessibilityLabel="Demo account email"
              placeholder="Email address"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
              autoCapitalize="none"
              className="bg-secondary border border-border rounded-xl px-3 h-12 text-foreground text-sm mt-6"
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              accessibilityLabel="Demo account password"
              placeholder="Password"
              placeholderTextColor="#94a3b8"
              secureTextEntry
              className="bg-secondary border border-border rounded-xl px-3 h-12 text-foreground text-sm mt-3"
            />
            {authError.length > 0 && <Text accessibilityRole="alert" className="text-danger text-xs mt-3">{authError}</Text>}
            <Pressable
              accessibilityLabel="Sign in to the local demo account"
              onPress={handleSignIn}
              className="bg-primary rounded-xl items-center py-3.5 mt-5"
            >
              <Text className="text-primary-foreground text-sm font-bold">Sign in</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                signOut();
                setAuthError("");
                setIsAuthOpen(false);
              }}
              className="items-center py-3"
            >
              <Text className="text-muted-foreground text-xs font-semibold">Continue as guest</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={selectedUtility !== null} animationType="fade" transparent onRequestClose={() => setSelectedUtility(null)}>
        <View className="flex-1 items-center justify-center px-6 bg-black/50">
          <View className="w-full bg-background border border-border rounded-2xl p-5">
            <Text className="text-foreground text-lg font-bold">{selectedUtility}</Text>
            {selectedUtility === "My orders" && isMockAccount ? (
              <View className="mt-3 gap-3">
                <Text className="text-muted-foreground text-xs">Sample order history · not connected to a store</Text>
                {DEMO_ORDERS.map((order) => (
                  <View key={order.id} className="rounded-xl border border-border bg-card p-3">
                    <View className="flex-row items-center justify-between gap-3">
                      <Text className="text-foreground text-sm font-semibold">{order.id}</Text>
                      <Text className="text-primary text-xs font-semibold">{order.status}</Text>
                    </View>
                    <Text className="text-muted-foreground text-xs mt-1">{order.date} · {order.items}</Text>
                    <Text className="text-foreground text-sm font-bold mt-2">{order.total}</Text>
                  </View>
                ))}
              </View>
            ) : selectedUtility === "Delivery addresses" && isMockAccount ? (
              <View className="mt-3 gap-3">
                <Text className="text-muted-foreground text-xs">Sample address · stored in this demo only</Text>
                {DEMO_ADDRESSES.map((address) => (
                  <View key={address.label} className="rounded-xl border border-border bg-card p-3">
                    <Text className="text-foreground text-sm font-semibold">{address.label} · {address.recipient}</Text>
                    <Text className="text-muted-foreground text-xs leading-5 mt-1">{address.address}</Text>
                    <Text className="text-muted-foreground text-xs mt-1">{address.phone}</Text>
                  </View>
                ))}
              </View>
            ) : selectedUtility === "Account settings" && isMockAccount ? (
              <View className="mt-3 rounded-xl border border-border bg-card p-3">
                <Text className="text-muted-foreground text-xs">Mock profile · saved on this device</Text>
                <Text className="text-foreground text-sm mt-2">{session.user.displayName}</Text>
                <Text className="text-muted-foreground text-xs mt-1">{session.user.email}</Text>
              </View>
            ) : (
              <Text className="text-muted-foreground text-sm leading-5 mt-2">
                Support information is a preview and is not connected to a live service.
              </Text>
            )}
            <Pressable onPress={() => setSelectedUtility(null)} className="bg-primary rounded-xl items-center py-3 mt-5">
              <Text className="text-primary-foreground text-sm font-semibold">Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
