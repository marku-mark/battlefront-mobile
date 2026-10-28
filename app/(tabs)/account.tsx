import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { ActivityIndicator, Modal, Pressable, ScrollView, Switch, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useEffect, useRef, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { MockSignInSheet } from "@/components/account/MockSignInSheet";
import { PasswordForm } from "@/components/account/PasswordForm";
import { useChat } from "@/hooks/useChat";
import { LoadingState } from "@/components/layout/LoadingState";
import { useSession } from "@/hooks/useSession";
import { getLocalUserId, getNegrosDeliveryLocations, getDeliveryLocations, resolveDeliveryLocation } from "@/lib/api";
import { DeliveryAddressFields } from "@/components/addresses/DeliveryAddressFields";
import { EMPTY_DELIVERY_ADDRESS, formatDeliveryAddress, isCompleteDeliveryAddress, type DeliveryAddress, type DeliveryBarangay, type DeliveryLocation } from "@/lib/deliveryAddress";
import { loadSavedAddresses, persistSavedAddresses, type SavedAddress } from "@/lib/savedAddresses";
import { useTheme } from "@/theme/ThemeProvider";
import { useToast } from "@/hooks/useToast";

const accountLinks = [
  { icon: "receipt-outline", label: "My orders", detail: "View your order history", badge: null },
  { icon: "location-outline", label: "Delivery addresses", detail: "Sync your default address for checkout", badge: null },
  { icon: "heart-outline", label: "Wishlist", detail: "Saved to your customer account", badge: null },
] as const;

export default function AccountScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { isDark, toggleMode, colors } = useTheme();
  const { showToast } = useToast();
  const { session, isHydrated, signOut, saveProfile, refreshProfile } = useSession();
  const isMockAccount = session.mode === "customer";
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const { open: openChat } = useChat();
  const [selectedUtility, setSelectedUtility] = useState<string | null>(null);
  const [authMessage, setAuthMessage] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [isAddressesLoading, setIsAddressesLoading] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [newAddressLabel, setNewAddressLabel] = useState("");
  const [newAddressRecipient, setNewAddressRecipient] = useState("");
  const [newAddressPhone, setNewAddressPhone] = useState("");
  const [newAddress, setNewAddress] = useState<DeliveryAddress>(EMPTY_DELIVERY_ADDRESS);
  const [locations, setLocations] = useState<DeliveryLocation[]>([]);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [personalizedRecommendationsEnabled, setPersonalizedRecommendationsEnabled] = useState(true);
  const [searchRecommendationsEnabled, setSearchRecommendationsEnabled] = useState(true);
  const [productViewRecommendationsEnabled, setProductViewRecommendationsEnabled] = useState(true);
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
    setSavedAddresses([]); setIsAddingAddress(false); setNewAddress(EMPTY_DELIVERY_ADDRESS); setLocations([]);
    setAddressError(""); setProfileError("");
    setIsSavingAddress(false); setIsAddressesLoading(false); setIsSavingProfile(false); setIsProfileLoading(false); setIsProfileLoaded(false);
  }, [customerId]);
  useEffect(() => {
    const cityCode = newAddress.delivery_destination;
    if (!/^\d{10}$/.test(cityCode) || !locations.some((item) => item.code === cityCode)) return;
    if (locations.find((item) => item.code === cityCode)?.barangays.length) return;
    let active = true;
    void getDeliveryLocations<DeliveryBarangay>("barangays", cityCode).then((barangays) => {
      if (active) setLocations((current) => current.map((item) => item.code === cityCode ? { ...item, barangays } : item));
    }).catch((reason) => { if (active) setAddressError(reason instanceof Error ? reason.message : "Could not load barangays."); });
    return () => { active = false; };
  }, [newAddress.delivery_destination, locations]);

  async function openProfileSettings() {
    const owner = getLocalUserId();
    setSelectedUtility("Account settings"); setProfileError(""); setIsProfileLoading(!isProfileLoaded);
    try {
      const user = await refreshProfile();
      if (getLocalUserId() !== owner) return;
      setProfileName(user.name); setProfileEmail(user.email); setProfileAddress(user.default_delivery_address ?? "");
      setProfilePhone(user.default_delivery_contact_number ?? "");
      setPersonalizedRecommendationsEnabled(user.personalized_recommendations_enabled);
      setSearchRecommendationsEnabled(user.search_recommendations_enabled);
      setProductViewRecommendationsEnabled(user.product_view_recommendations_enabled);
      setIsProfileLoaded(true);
    } catch (reason) { if (getLocalUserId() === owner) setProfileError(reason instanceof Error ? reason.message : "Could not load your profile."); }
    finally { if (getLocalUserId() === owner) setIsProfileLoading(false); }
  }

  async function submitProfile() {
    if (isSavingProfile || !isProfileLoaded || customerId === null) return;
    if (!profileName.trim() || !profileEmail.trim()) { setProfileError("Enter your name and email address."); return; }
    setIsSavingProfile(true); setProfileError("");
    try {
      await saveProfile({
        name: profileName,
        email: profileEmail,
        default_delivery_contact_number: profilePhone.trim() || null,
        personalized_recommendations_enabled: personalizedRecommendationsEnabled,
        search_recommendations_enabled: searchRecommendationsEnabled,
        product_view_recommendations_enabled: productViewRecommendationsEnabled,
      }, customerId);
      if (getLocalUserId() === customerId) setSelectedUtility(null);
    } catch (reason) { if (getLocalUserId() === customerId) setProfileError(reason instanceof Error ? reason.message : "Could not save your profile."); }
    finally { if (getLocalUserId() === customerId) setIsSavingProfile(false); }
  }

  async function useDefaultAddress(address: SavedAddress | null) {
    if (isSavingAddress) return;
    const owner = getLocalUserId();
    setIsSavingAddress(true); setAddressError("");
    try {
      const user = await refreshProfile();
      if (address && (!address.delivery_destination || !address.delivery_barangay_code || !address.delivery_address_details)) throw new Error("Recreate this address with a city and barangay before setting it as default.");
      const city = address?.delivery_destination ? await resolveDeliveryLocation(address.delivery_destination) : null;
      if (getLocalUserId() !== owner) return;
      await saveProfile(address ? {
        name: user.name, email: user.email, default_delivery_address_action: "save",
        default_delivery_region_code: city?.region_code,
        default_delivery_province_code: city?.province?.code ?? null,
        default_delivery_city_code: address.delivery_destination,
        default_delivery_barangay_code: address.delivery_barangay_code,
        default_delivery_address_details: address.delivery_address_details,
      } : { name: user.name, email: user.email, default_delivery_address_action: "clear" }, user.id);
    } catch (reason) { if (getLocalUserId() === owner) setAddressError(reason instanceof Error ? reason.message : "Could not update your default address."); }
    finally { if (getLocalUserId() === owner) setIsSavingAddress(false); }
  }

  async function openSavedAddresses() {
    setSelectedUtility("Delivery addresses");
    setIsAddressesLoading(savedAddresses.length === 0);
    setAddressError("");
    const owner = getLocalUserId();
    try {
      const [addresses, , directory] = await Promise.all([loadSavedAddresses(), refreshProfile(), getNegrosDeliveryLocations()]);
      if (getLocalUserId() === owner) { setSavedAddresses(addresses); setLocations(directory); }
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
    if (!label || !recipient || !phone || !isCompleteDeliveryAddress(newAddress, locations)) {
      setAddressError("Complete the label, recipient, phone, city, barangay, and street details.");
      return;
    }

    const existingAddress = savedAddresses.find((address) => address.label.toLowerCase() === label.toLowerCase());
    const savedEntry: SavedAddress = {
      id: existingAddress?.id ?? `address-${Date.now()}`,
      label,
      recipient,
      phone,
      address: formatDeliveryAddress(newAddress, locations),
      ...newAddress,
    };
    const nextAddresses = [savedEntry, ...savedAddresses.filter((address) => address.id !== savedEntry.id)];
    setIsSavingAddress(true);
    try {
      await persistSavedAddresses(nextAddresses);
      if (getLocalUserId() !== owner) return;
      setSavedAddresses(nextAddresses);
      setNewAddressLabel("");
      setNewAddressRecipient("");
      setNewAddressPhone("");
      setNewAddress(EMPTY_DELIVERY_ADDRESS);
      setIsAddingAddress(false);
      setAddressError("");
    } catch {
      if (getLocalUserId() === owner) setAddressError("Couldn't save this address. Please try again.");
    } finally {
      if (getLocalUserId() === owner) setIsSavingAddress(false);
    }
  }

  function openSignIn(message = "") {
    setAuthMessage(message);
    setIsAuthOpen(true);
  }

  async function handleSignOut() {
    try {
      await signOut();
      showToast("You have been logged out.", "info");
    } catch {
      showToast("Could not sign out. Please try again.", "error");
    }
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

        <View className="mx-4 mt-5 rounded-lg bg-card border border-border p-4">
          <View className="flex-row items-center">
            <View className="w-14 h-14 rounded-full bg-secondary border border-border items-center justify-center">
              <Ionicons name="person-outline" size={26} color={colors.icon} />
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
                  void handleSignOut();
                  return;
                }
                openSignIn();
              }}
              accessibilityLabel={isMockAccount ? "Sign out" : "Sign in"}
              className="flex-1 bg-primary rounded-lg items-center py-3"
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
                router.navigate("/");
              }}
              accessibilityLabel={isMockAccount ? "Open account settings" : "Continue as guest"}
              className="flex-1 border border-border rounded-lg items-center py-3"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text className="text-foreground text-sm font-semibold">
                {isMockAccount ? "Account settings" : "Continue as guest"}
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="flex-row items-center justify-between px-4 mt-7 mb-3">
          <Text className="text-foreground text-base font-bold">Shopping and support</Text>
        </View>
        <View className="mx-4 rounded-lg bg-card border border-border overflow-hidden">
          <Pressable
            onPress={() => router.push("/notifications")}
            accessibilityRole="button"
            accessibilityLabel="Open order updates"
            className="flex-row items-center border-b border-border p-4"
          >
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-secondary">
              <Ionicons name="mail-unread-outline" size={19} color={colors.foreground} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-foreground text-sm font-medium">Order updates</Text>
              <Text className="mt-0.5 text-muted-foreground text-xs">Read payment and delivery messages</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/store-locator")}
            accessibilityLabel="Find a Battlefront store"
            className="flex-row items-center p-4 border-b border-border"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <View className="w-9 h-9 rounded-lg bg-secondary items-center justify-center">
              <Ionicons name="storefront-outline" size={19} color={colors.foreground} />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-foreground text-sm font-medium">Store locator</Text>
              <Text className="text-muted-foreground text-xs mt-0.5">Find a Battlefront branch near you</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={(event) => openChat(event.nativeEvent.target)} className="flex-row items-center border-b border-border p-4">
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-secondary">
              <Ionicons name="chatbubble-ellipses-outline" size={19} color={colors.foreground} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-foreground text-sm font-medium">Battlefront support</Text>
              <Text className="mt-0.5 text-muted-foreground text-xs">Ask about products, stores, and orders</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/notification-settings")}
            accessibilityRole="button"
            accessibilityLabel="Manage order push notifications"
            className="flex-row items-center border-b border-border p-4"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <View className="h-9 w-9 items-center justify-center rounded-lg bg-secondary">
              <Ionicons name="notifications-outline" size={19} color={colors.foreground} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-foreground text-sm font-medium">Order notifications</Text>
              <Text className="mt-0.5 text-muted-foreground text-xs">Manage push alerts on this device</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
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
                    openSignIn("Sign in to view your order history.");
                    return;
                  }
                  router.push("/orders");
                  return;
                }
                if (link.label === "Delivery addresses") {
                  if (!isMockAccount) {
                    openSignIn("Sign in to view your saved delivery addresses.");
                    return;
                  }
                  void openSavedAddresses();
                  return;
                }
              }}
              className={`flex-row items-center p-4 ${index < accountLinks.length - 1 ? "border-b border-border" : ""}`}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View className="w-9 h-9 rounded-lg bg-secondary items-center justify-center">
                <Ionicons name={link.icon} size={19} color={colors.foreground} />
              </View>
              <View className="flex-1 ml-3">
                <View className="flex-row items-center gap-2">
                  <Text className="text-foreground text-sm font-medium">
                    {link.label}
                  </Text>
                  {(link.label === "Wishlist" ? isMockAccount ? "Synced" : "Local" : link.badge) && <View className="rounded-full px-1.5 py-0.5 bg-secondary">
                    <Text className="text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">
                      {link.label === "Wishlist" ? isMockAccount ? "Synced" : "Local" : link.badge}
                    </Text>
                  </View>}
                </View>
                <Text className="text-muted-foreground text-xs mt-0.5">
                  {link.label === "Wishlist" ? isMockAccount ? "Synced across devices" : "Saved on this device" : link.detail}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.muted} />
            </Pressable>
          ))}
          <Pressable
            onPress={toggleMode}
            className="flex-row items-center p-4 border-t border-border"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <View className="w-9 h-9 rounded-lg bg-secondary items-center justify-center">
              <Ionicons name={isDark ? "sunny-outline" : "moon-outline"} size={19} color={colors.foreground} />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-foreground text-sm font-medium">
                {isDark ? "Light mode" : "Dark mode"}
              </Text>
              <Text className="text-muted-foreground text-xs mt-0.5">
                Change the app appearance
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
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
        }}
      />


      <Modal visible={selectedUtility !== null} animationType="fade" transparent onRequestClose={() => setSelectedUtility(null)}>
        <View className="flex-1 items-center justify-center px-6 bg-black/50">
          <View className="w-full self-center bg-background border border-border rounded-lg p-5" style={{ maxWidth: 560, maxHeight: "90%" }}>
            <Text className="text-foreground text-lg font-bold">{selectedUtility}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} className="mt-3" contentContainerStyle={{ paddingBottom: 4 }}>
            {selectedUtility === "Delivery addresses" ? (
              <View className="mt-3 gap-3">
                <Text className="text-muted-foreground text-xs">Your default address syncs with Battlefront and pre-fills delivery checkout. Additional addresses stay on this device.</Text>
                {session.mode === "customer" && session.user.default_delivery_address && <View className="rounded-lg border border-border bg-card p-3">
                  <Text className="text-foreground text-sm font-semibold">Default delivery address</Text>
                  <Text className="text-muted-foreground text-xs leading-5 mt-1">{session.user.default_delivery_address}</Text>
                  <Pressable disabled={isSavingAddress} onPress={() => void useDefaultAddress(null)} className="mt-3 py-2"><Text className="text-primary text-xs font-semibold">{isSavingAddress ? "Updating..." : "Clear default address"}</Text></Pressable>
                </View>}
                {isAddressesLoading ? (
                  <ActivityIndicator color={colors.foreground} />
                ) : savedAddresses.length > 0 ? (
                  savedAddresses.map((address) => (
                    <View key={address.id} className="flex-row items-center rounded-lg border border-border bg-card p-3">
                      <View className="flex-1">
                        <Text className="text-foreground text-sm font-semibold">{address.label} · {address.recipient}</Text>
                        <Text className="text-muted-foreground text-xs leading-5 mt-1">{address.address}</Text>
                        <Text className="text-muted-foreground text-xs mt-1">{address.phone}</Text>
                        <Pressable disabled={isSavingAddress || isAddressesLoading || !locations.some((item) => item.code === address.delivery_destination) || !address.delivery_barangay_code || !address.delivery_address_details || (session.mode === "customer" && session.user.default_delivery_address === address.address)} onPress={() => void useDefaultAddress(address)} className="mt-2 py-2">
                          <Text className="text-primary text-xs font-semibold">{session.mode === "customer" && session.user.default_delivery_address === address.address ? "Default address" : !locations.some((item) => item.code === address.delivery_destination) ? "Recreate to use as default" : isSavingAddress ? "Updating..." : "Use as default"}</Text>
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
                        <Ionicons name="trash-outline" size={17} color={colors.muted} />
                      </Pressable>
                    </View>
                  ))
                ) : (
                  <Text className="text-muted-foreground text-xs">No additional addresses saved on this device. Add one below.</Text>
                )}
                {!isAddressesLoading && isAddingAddress && (
                  <View className="rounded-lg border border-border bg-secondary p-3">
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
                    <DeliveryAddressFields value={newAddress} locations={locations} onLocation={(city) => setLocations((rows) => [...rows.filter((row) => row.code !== city.code), city])} onChange={setNewAddress} disabled={isSavingAddress} />
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
                    className="h-11 flex-row items-center justify-center gap-2 rounded-lg bg-primary"
                  >
                    <Ionicons name="add" size={18} color="#ffffff" />
                    <Text className="text-primary-foreground text-sm font-bold">Add address</Text>
                  </Pressable>
                )}
              </View>
            ) : selectedUtility === "Account settings" && isMockAccount ? (
              <View className="mt-3 rounded-lg border border-border bg-card p-3">
                {isProfileLoading ? <ActivityIndicator /> : <>
                  <Text className="text-foreground text-sm font-semibold">Name</Text>
                  <TextInput accessibilityLabel="Profile name" value={profileName} onChangeText={setProfileName} editable={!isSavingProfile} maxLength={255} className="mt-2 h-11 rounded-lg border border-border bg-secondary px-3 text-foreground text-sm" />
                  <Text className="text-foreground text-sm font-semibold mt-4">Email address</Text>
                  <Text selectable className="mt-2 text-foreground">{profileEmail}</Text>
                  <Text className="mt-1 text-muted-foreground text-xs">Your account email cannot be changed.</Text>
                  <Text className="mt-4 text-foreground text-sm font-semibold">Default contact number</Text>
                  <TextInput accessibilityLabel="Default contact number" value={profilePhone} onChangeText={setProfilePhone} editable={!isSavingProfile} keyboardType="phone-pad" maxLength={30} className="mt-2 h-12 rounded-lg border border-border px-3 text-foreground" />
                  <Text className="text-foreground text-sm font-semibold mt-4">Default delivery address</Text>
                  <Text className="mt-2 text-foreground text-sm">{profileAddress || "No default address selected."}</Text>
                  <Pressable onPress={() => void openSavedAddresses()} className="mt-2 rounded-lg border border-border bg-secondary px-3 py-3"><Text className="text-primary text-sm font-semibold">Manage delivery addresses</Text></Pressable>
                  <View className="mt-5 rounded-lg border border-border bg-background p-3">
                    <Text className="text-foreground text-sm font-semibold">Recommendation privacy</Text>
                    <Text className="text-muted-foreground text-xs leading-5 mt-1">Choose which activity Battlefront may use to personalize product suggestions. Turning off a source deletes its saved recommendation history.</Text>
                    <View className="mt-3 flex-row items-center justify-between gap-3">
                      <View className="flex-1"><Text className="text-foreground text-sm">Personalized recommendations</Text><Text className="text-muted-foreground text-xs mt-1">Use your available shopping activity for suggestions.</Text></View>
                      <Switch accessibilityRole="switch" accessibilityLabel="Personalized recommendations" value={personalizedRecommendationsEnabled} onValueChange={setPersonalizedRecommendationsEnabled} disabled={isSavingProfile} />
                    </View>
                    <View className="mt-3 flex-row items-center justify-between gap-3">
                      <View className="flex-1"><Text className="text-foreground text-sm">Use catalog searches</Text><Text className="text-muted-foreground text-xs mt-1">Search activity can inform suggestions.</Text></View>
                      <Switch accessibilityRole="switch" accessibilityLabel="Use catalog searches for recommendations" value={searchRecommendationsEnabled} onValueChange={setSearchRecommendationsEnabled} disabled={isSavingProfile} />
                    </View>
                    <View className="mt-3 flex-row items-center justify-between gap-3">
                      <View className="flex-1"><Text className="text-foreground text-sm">Use product views</Text><Text className="text-muted-foreground text-xs mt-1">Viewed products can inform suggestions.</Text></View>
                      <Switch accessibilityRole="switch" accessibilityLabel="Use product views for recommendations" value={productViewRecommendationsEnabled} onValueChange={setProductViewRecommendationsEnabled} disabled={isSavingProfile} />
                    </View>
                  </View>
                  <Pressable disabled={isSavingProfile || !isProfileLoaded} onPress={() => void submitProfile()} className="mt-4 rounded-lg bg-primary items-center py-3"><Text className="text-primary-foreground text-sm font-semibold">{isSavingProfile ? "Saving..." : "Save changes"}</Text></Pressable>
                  <PasswordForm key={customerId} />
                </>}
                {profileError ? <Text accessibilityRole="alert" className="text-danger text-xs mt-3">{profileError}</Text> : null}
                {!isProfileLoading && !isProfileLoaded && <Pressable onPress={() => void openProfileSettings()} className="mt-3 py-2"><Text className="text-primary text-sm">Retry loading profile</Text></Pressable>}
              </View>
            ) : null}
            <Pressable onPress={() => setSelectedUtility(null)} className="bg-primary rounded-lg items-center py-3 mt-5">
              <Text className="text-primary-foreground text-sm font-semibold">Close</Text>
            </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
