import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useEffect, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { MockSignInSheet } from "@/components/account/MockSignInSheet";
import { PhilippineAddressFields } from "@/components/addresses/PhilippineAddressFields";
import { LoadingState } from "@/components/layout/LoadingState";
import { useSession } from "@/hooks/useSession";
import { getLocalUserId } from "@/lib/api";
import { getOrdersSnapshot } from "@/lib/orders";
import { EMPTY_PHILIPPINE_ADDRESS, formatPhilippineAddress, isCompletePhilippineAddress, type PhilippineAddressFields as PhilippineAddressValue } from "@/lib/philippineAddress";
import { loadSavedAddresses, persistSavedAddresses, type SavedAddress } from "@/lib/savedAddresses";
import { useTheme } from "@/theme/ThemeProvider";

const accountLinks = [
  { icon: "receipt-outline", label: "My orders", detail: "View your order history", badge: null },
  { icon: "location-outline", label: "Delivery addresses", detail: "Sync your default address for checkout", badge: null },
  { icon: "heart-outline", label: "Wishlist", detail: "Saved on this device", badge: "Local" },
] as const;

export default function AccountScreen() {
  const router = useRouter();
  const orders = getOrdersSnapshot() ?? [];
  const { width } = useWindowDimensions();
  const { isDark, toggleMode, colors } = useTheme();
  const { session, isHydrated, signOut, saveProfile, refreshProfile } = useSession();
  const isMockAccount = session.mode === "customer";
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
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [profileError, setProfileError] = useState("");
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isProfileLoaded, setIsProfileLoaded] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const customerId = session.mode === "customer" ? session.user.id : null;
  const previousCustomerId = useRef(customerId);
  useEffect(() => {
    const previousId = previousCustomerId.current;
    previousCustomerId.current = customerId;
    if (previousId === null || previousId === customerId) return;
    setSelectedUtility(null);
    setSavedAddresses([]); setIsAddingAddress(false);
    setAddressError(""); setProfileError("");
    setIsSavingAddress(false); setIsAddressesLoading(false); setIsSavingProfile(false); setIsProfileLoading(false); setIsProfileLoaded(false);
  }, [customerId]);

  async function openProfileSettings() {
    const owner = getLocalUserId();
    setSelectedUtility("Account settings"); setProfileError(""); setIsProfileLoading(!isProfileLoaded);
    try {
      const user = await refreshProfile();
      if (getLocalUserId() !== owner) return;
      setProfileName(user.name); setProfileEmail(user.email); setProfileAddress(user.default_delivery_address ?? "");
      setIsProfileLoaded(true);
    } catch (reason) { if (getLocalUserId() === owner) setProfileError(reason instanceof Error ? reason.message : "Could not load your profile."); }
    finally { if (getLocalUserId() === owner) setIsProfileLoading(false); }
  }

  async function submitProfile() {
    if (isSavingProfile || !isProfileLoaded || customerId === null) return;
    if (!profileName.trim() || !profileEmail.trim()) { setProfileError("Enter your name and email address."); return; }
    setIsSavingProfile(true); setProfileError("");
    try {
      await saveProfile({ name: profileName, email: profileEmail, default_delivery_address: profileAddress.trim() || null }, customerId);
      if (getLocalUserId() === customerId) setSelectedUtility(null);
    } catch (reason) { if (getLocalUserId() === customerId) setProfileError(reason instanceof Error ? reason.message : "Could not save your profile."); }
    finally { if (getLocalUserId() === customerId) setIsSavingProfile(false); }
  }

  async function useDefaultAddress(address: string | null) {
    if (isSavingAddress) return;
    const owner = getLocalUserId();
    setIsSavingAddress(true); setAddressError("");
    try {
      const user = await refreshProfile();
      await saveProfile({ name: user.name, email: user.email, default_delivery_address: address }, user.id);
    } catch (reason) { if (getLocalUserId() === owner) setAddressError(reason instanceof Error ? reason.message : "Could not update your default address."); }
    finally { if (getLocalUserId() === owner) setIsSavingAddress(false); }
  }

  async function openSavedAddresses() {
    setSelectedUtility("Delivery addresses");
    setIsAddressesLoading(savedAddresses.length === 0);
    setAddressError("");
    const owner = getLocalUserId();
    try {
      const [addresses] = await Promise.all([loadSavedAddresses(), refreshProfile()]);
      if (getLocalUserId() === owner) setSavedAddresses(addresses);
    } catch (reason) { if (getLocalUserId() === owner) setAddressError(reason instanceof Error ? reason.message : "Could not load your addresses."); }
    finally { if (getLocalUserId() === owner) setIsAddressesLoading(false); }
  }

  async function removeSavedAddress(addressId: string) {
    if (isSavingAddress) return;
    const owner = getLocalUserId();
    const nextAddresses = savedAddresses.filter((address) => address.id !== addressId);
    setIsSavingAddress(true);
    try {
      await persistSavedAddresses(nextAddresses);
      if (getLocalUserId() !== owner) return;
      setSavedAddresses(nextAddresses);
      setAddressError("");
    } catch {
      if (getLocalUserId() === owner) setAddressError("Couldn't remove this address. Please try again.");
    } finally {
      if (getLocalUserId() === owner) setIsSavingAddress(false);
    }
  }

  async function addSavedAddress() {
    if (isSavingAddress) return;
    const owner = getLocalUserId();
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
      if (getLocalUserId() !== owner) return;
      setSavedAddresses(nextAddresses);
      setNewAddressLabel("");
      setNewAddressRecipient("");
      setNewAddressPhone("");
      setNewAddressLocation(EMPTY_PHILIPPINE_ADDRESS);
      setIsAddingAddress(false);
      setAddressError("");
    } catch {
      if (getLocalUserId() === owner) setAddressError("Couldn't save this address. Please try again.");
    } finally {
      if (getLocalUserId() === owner) setIsSavingAddress(false);
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
              {!isMockAccount && <Text className="text-muted-foreground text-xs mt-1">Browse, shop, and save items locally without signing in.</Text>}
            </View>
          </View>

          <View className="flex-row gap-3 mt-5">
            <Pressable
              onPress={() => {
                if (isMockAccount) {
                  void signOut().catch(() => undefined);
                  return;
                }
                openSignIn();
              }}
              accessibilityLabel={isMockAccount ? "Sign out" : "Sign in"}
              className="flex-1 bg-primary rounded-xl items-center py-3"
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <Text className="text-primary-foreground text-sm font-semibold">
                {isMockAccount ? "Sign out" : "Sign in"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (isMockAccount) {
                  void openProfileSettings();
                  return;
                }
                return;
              }}
              accessibilityLabel={isMockAccount ? "Open account settings" : "Continue as guest"}
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
                  {link.badge && <View className="rounded-full px-1.5 py-0.5 bg-secondary">
                    <Text className="text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                      {link.badge}
                    </Text>
                  </View>}
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
            Orders and cart sync with your Battlefront account.
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
                {orders.map((order) => (
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
                <Text className="text-muted-foreground text-xs">Your default address syncs with Battlefront and pre-fills delivery checkout. Additional addresses stay on this device.</Text>
                {session.mode === "customer" && session.user.default_delivery_address && <View className="rounded-xl border border-border bg-card p-3">
                  <Text className="text-foreground text-sm font-semibold">Default delivery address</Text>
                  <Text className="text-muted-foreground text-xs leading-5 mt-1">{session.user.default_delivery_address}</Text>
                  <Pressable disabled={isSavingAddress} onPress={() => void useDefaultAddress(null)} className="mt-3 py-2"><Text className="text-primary text-xs font-semibold">{isSavingAddress ? "Updating..." : "Clear default address"}</Text></Pressable>
                </View>}
                {isAddressesLoading ? (
                  <ActivityIndicator color={isDark ? "#f8fafc" : "#30343b"} />
                ) : savedAddresses.length > 0 ? (
                  savedAddresses.map((address) => (
                    <View key={address.id} className="flex-row items-center rounded-xl border border-border bg-card p-3">
                      <View className="flex-1">
                        <Text className="text-foreground text-sm font-semibold">{address.label} · {address.recipient}</Text>
                        <Text className="text-muted-foreground text-xs leading-5 mt-1">{address.address}</Text>
                        <Text className="text-muted-foreground text-xs mt-1">{address.phone}</Text>
                        <Pressable disabled={isSavingAddress || isAddressesLoading || (session.mode === "customer" && session.user.default_delivery_address === address.address)} onPress={() => void useDefaultAddress(address.address)} className="mt-2 py-2">
                          <Text className="text-primary text-xs font-semibold">{session.mode === "customer" && session.user.default_delivery_address === address.address ? "Default address" : isSavingAddress ? "Updating..." : "Use as default"}</Text>
                        </Pressable>
                      </View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${address.label} address from this device`}
                        disabled={isSavingAddress}
                        onPress={() => void removeSavedAddress(address.id)}
                        hitSlop={8}
                        className="h-10 w-10 items-center justify-center"
                      >
                        <Ionicons name="trash-outline" size={17} color={isDark ? "#9ca3af" : "#68717e"} />
                      </Pressable>
                    </View>
                  ))
                ) : (
                  <Text className="text-muted-foreground text-xs">No additional addresses saved on this device. Add one below.</Text>
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
                {isProfileLoading ? <ActivityIndicator /> : <>
                  <Text className="text-foreground text-sm font-semibold">Name</Text>
                  <TextInput accessibilityLabel="Profile name" value={profileName} onChangeText={setProfileName} editable={!isSavingProfile} maxLength={255} className="mt-2 h-11 rounded-lg border border-border bg-secondary px-3 text-foreground text-sm" />
                  <Text className="text-foreground text-sm font-semibold mt-4">Email address</Text>
                  <TextInput accessibilityLabel="Profile email" value={profileEmail} onChangeText={setProfileEmail} editable={!isSavingProfile} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" maxLength={255} className="mt-2 h-11 rounded-lg border border-border bg-secondary px-3 text-foreground text-sm" />
                  <Text className="text-foreground text-sm font-semibold mt-4">Default delivery address</Text>
                  <TextInput accessibilityLabel="Default delivery address" value={profileAddress} onChangeText={setProfileAddress} editable={!isSavingProfile} multiline maxLength={255} className="mt-2 rounded-lg border border-border bg-secondary px-3 py-3 text-foreground text-sm" />
                  <Text className="text-muted-foreground text-xs mt-2">Used to pre-fill delivery checkout. Leave empty to clear it.</Text>
                  <Pressable disabled={isSavingProfile || !isProfileLoaded} onPress={() => void submitProfile()} className="mt-4 rounded-xl bg-primary items-center py-3"><Text className="text-primary-foreground text-sm font-semibold">{isSavingProfile ? "Saving..." : "Save changes"}</Text></Pressable>
                </>}
                {profileError ? <Text accessibilityRole="alert" className="text-danger text-xs mt-3">{profileError}</Text> : null}
                {!isProfileLoading && !isProfileLoaded && <Pressable onPress={() => void openProfileSettings()} className="mt-3 py-2"><Text className="text-primary text-sm">Retry loading profile</Text></Pressable>}
              </View>
            ) : null}
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
