import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { MockSignInSheet } from "@/components/account/MockSignInSheet";
import { PhilippineAddressFields } from "@/components/addresses/PhilippineAddressFields";
import { LoadingState } from "@/components/layout/LoadingState";
import { useSession } from "@/hooks/useSession";
import { DEMO_ORDERS } from "@/lib/mockAccount";
import { EMPTY_PHILIPPINE_ADDRESS, formatPhilippineAddress, isCompletePhilippineAddress, type PhilippineAddressFields as PhilippineAddressValue } from "@/lib/philippineAddress";
import { loadSavedAddresses, persistSavedAddresses, type SavedAddress } from "@/lib/savedAddresses";
import { useTheme } from "@/theme/ThemeProvider";

const accountLinks = [
  { icon: "receipt-outline", label: "My orders", detail: "View sample order history", badge: "Demo" },
  { icon: "location-outline", label: "Delivery addresses", detail: "Saved locally on this device", badge: "Local" },
  { icon: "heart-outline", label: "Wishlist", detail: "Saved on this device", badge: "Local" },
  { icon: "help-circle-outline", label: "Help center", detail: "Preview support information", badge: "Preview" },
] as const;

export default function AccountScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { isDark, toggleMode, colors } = useTheme();
  const { session, isHydrated, signIn, signOut } = useSession();
  const isMockAccount = session.mode === "mock-account";
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [selectedUtility, setSelectedUtility] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState("");
  const [pendingSignInAction, setPendingSignInAction] = useState<"orders" | "addresses" | null>(null);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [isAddressesLoading, setIsAddressesLoading] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState("");
  const [newAddressRecipient, setNewAddressRecipient] = useState("");
  const [newAddressPhone, setNewAddressPhone] = useState("");
  const [newAddressLocation, setNewAddressLocation] = useState<PhilippineAddressValue>(EMPTY_PHILIPPINE_ADDRESS);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  async function openSavedAddresses() {
    setSelectedUtility("Delivery addresses");
    setIsAddressesLoading(true);
    setAddressError("");
    setSavedAddresses(await loadSavedAddresses());
    setIsAddressesLoading(false);
  }

  async function removeSavedAddress(addressId: string) {
    const nextAddresses = savedAddresses.filter((address) => address.id !== addressId);
    try {
      await persistSavedAddresses(nextAddresses);
      setSavedAddresses(nextAddresses);
      setAddressError("");
    } catch {
      setAddressError("Couldn't remove this address. Please try again.");
    }
  }

  async function addSavedAddress() {
    const label = newAddressLabel.trim();
    const recipient = newAddressRecipient.trim();
    const phone = newAddressPhone.trim();
    if (!label || !recipient || !phone || !isCompletePhilippineAddress(newAddressLocation)) {
      setAddressError("Complete the recipient, phone, and every required Philippine address field.");
      return;
    }

    const existingAddress = savedAddresses.find((address) => address.label.toLowerCase() === label.toLowerCase());
    const newAddress: SavedAddress = {
      id: existingAddress?.id ?? `address-${Date.now()}`,
      label,
      recipient,
      phone,
      address: formatPhilippineAddress(newAddressLocation),
      ...newAddressLocation,
    };
    const nextAddresses = [newAddress, ...savedAddresses.filter((address) => address.id !== newAddress.id)];
    setIsSavingAddress(true);
    try {
      await persistSavedAddresses(nextAddresses);
      setSavedAddresses(nextAddresses);
      setNewAddressLabel("");
      setNewAddressRecipient("");
      setNewAddressPhone("");
      setNewAddressLocation(EMPTY_PHILIPPINE_ADDRESS);
      setIsAddingAddress(false);
      setAddressError("");
    } catch {
      setAddressError("Couldn't save this address. Please try again.");
    } finally {
      setIsSavingAddress(false);
    }
  }

  function openSignIn(message = "", action: "orders" | "addresses" | null = null) {
    setAuthMessage(message);
    setPendingSignInAction(action);
    setIsAuthOpen(true);
  }

  function handleSignInSuccess() {
    const action = pendingSignInAction;
    setPendingSignInAction(null);
    if (action === "orders") router.push("/orders");
    if (action === "addresses") void openSavedAddresses();
  }

  if (!isHydrated) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingState label="Loading account..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24, width: "100%", maxWidth: Math.min(width, 800), alignSelf: "center" }}
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
                if (link.label === "My orders") {
                  if (!isMockAccount) {
                    openSignIn("Sign in to view your order history.", "orders");
                    return;
                  }
                  router.push("/orders");
                  return;
                }
                if (link.label === "Delivery addresses") {
                  if (!isMockAccount) {
                    openSignIn("Sign in to view your saved delivery addresses.", "addresses");
                    return;
                  }
                  void openSavedAddresses();
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

      <MockSignInSheet
        visible={isAuthOpen}
        message={authMessage || undefined}
        onClose={() => {
          setIsAuthOpen(false);
          setPendingSignInAction(null);
        }}
        onSuccess={handleSignInSuccess}
      />

      <Modal visible={selectedUtility !== null} animationType="fade" transparent onRequestClose={() => setSelectedUtility(null)}>
        <View className="flex-1 items-center justify-center px-6 bg-black/50">
          <View className="w-full self-center bg-background border border-border rounded-2xl p-5" style={{ maxWidth: 560, maxHeight: "90%" }}>
            <Text className="text-foreground text-lg font-bold">{selectedUtility}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} className="mt-3" contentContainerStyle={{ paddingBottom: 4 }}>
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
            ) : selectedUtility === "Delivery addresses" ? (
              <View className="mt-3 gap-3">
                <Text className="text-muted-foreground text-xs">Saved in this demo on your device</Text>
                {isAddressesLoading ? (
                  <ActivityIndicator color={isDark ? "#f8fafc" : "#30343b"} />
                ) : savedAddresses.length > 0 ? (
                  savedAddresses.map((address) => (
                    <View key={address.id} className="flex-row items-center rounded-xl border border-border bg-card p-3">
                      <View className="flex-1">
                        <Text className="text-foreground text-sm font-semibold">{address.label} · {address.recipient}</Text>
                        <Text className="text-muted-foreground text-xs leading-5 mt-1">{address.address}</Text>
                        <Text className="text-muted-foreground text-xs mt-1">{address.phone}</Text>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${address.label} address`}
                        onPress={() => void removeSavedAddress(address.id)}
                        hitSlop={8}
                        className="h-10 w-10 items-center justify-center"
                      >
                        <Ionicons name="trash-outline" size={17} color={isDark ? "#9ca3af" : "#68717e"} />
                      </Pressable>
                    </View>
                  ))
                ) : (
                  <Text className="text-muted-foreground text-xs">No saved addresses. You can add one during checkout.</Text>
                )}
                {!isAddressesLoading && isAddingAddress && (
                  <View className="rounded-xl border border-border bg-secondary p-3">
                    <Text className="text-foreground text-sm font-semibold">New address</Text>
                    <TextInput
                      accessibilityLabel="Address label"
                      value={newAddressLabel}
                      onChangeText={setNewAddressLabel}
                      placeholder="Label (Home, Work)"
                      placeholderTextColor={colors.muted}
                      className="mt-3 h-11 rounded-lg border border-border bg-background px-3 text-foreground text-sm"
                    />
                    <TextInput
                      accessibilityLabel="Address recipient"
                      value={newAddressRecipient}
                      onChangeText={setNewAddressRecipient}
                      placeholder="Recipient name"
                      placeholderTextColor={colors.muted}
                      className="mt-2 h-11 rounded-lg border border-border bg-background px-3 text-foreground text-sm"
                    />
                    <TextInput
                      accessibilityLabel="Address phone number"
                      value={newAddressPhone}
                      onChangeText={setNewAddressPhone}
                      placeholder="Phone number"
                      placeholderTextColor={colors.muted}
                      keyboardType="phone-pad"
                      className="mt-2 h-11 rounded-lg border border-border bg-background px-3 text-foreground text-sm"
                    />
                    <PhilippineAddressFields
                      value={newAddressLocation}
                      onChange={(patch) => setNewAddressLocation((current) => ({ ...current, ...patch }))}
                    />
                    <View className="mt-3 flex-row gap-2">
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => {
                          setIsAddingAddress(false);
                          setAddressError("");
                        }}
                        className="h-10 flex-1 items-center justify-center rounded-lg border border-border"
                      >
                        <Text className="text-foreground text-xs font-semibold">Cancel</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        disabled={isSavingAddress}
                        onPress={() => void addSavedAddress()}
                        className="h-10 flex-1 items-center justify-center rounded-lg bg-primary"
                        style={{ opacity: isSavingAddress ? 0.6 : 1 }}
                      >
                        <Text className="text-primary-foreground text-xs font-bold">{isSavingAddress ? "Saving..." : "Save address"}</Text>
                      </Pressable>
                    </View>
                  </View>
                )}
                {addressError ? <Text className="text-danger text-xs">{addressError}</Text> : null}
                {!isAddressesLoading && !isAddingAddress && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setAddressError("");
                      setIsAddingAddress(true);
                    }}
                    className="h-11 flex-row items-center justify-center gap-2 rounded-xl bg-primary"
                  >
                    <Ionicons name="add" size={18} color="#ffffff" />
                    <Text className="text-primary-foreground text-sm font-bold">Add address</Text>
                  </Pressable>
                )}
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
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
