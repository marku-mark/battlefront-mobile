import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MockSignInSheet } from "@/components/account/MockSignInSheet";
import { PhilippineAddressFields } from "@/components/addresses/PhilippineAddressFields";
import { LoadingState } from "@/components/layout/LoadingState";
import { useCart, type CartItem } from "@/hooks/useCart";
import { useSession } from "@/hooks/useSession";
import { DEMO_ACCOUNT } from "@/lib/mockAccount";
import { calculateCheckoutPricing } from "@/lib/checkoutPricing";
import { formatPhilippineAddress, isCompletePhilippineAddress, toPhilippineAddressFields, type PhilippineAddressFields as PhilippineAddressValue } from "@/lib/philippineAddress";
import { savePlacedOrder } from "@/lib/orders";
import { DEFAULT_SAVED_ADDRESSES, loadSavedAddresses, persistSavedAddresses, type SavedAddress } from "@/lib/savedAddresses";
import { useTheme } from "@/theme/ThemeProvider";
import { getResponsiveLayout } from "@/lib/responsive";

function formatPrice(value: number): string {
  return `₱${value.toLocaleString("en-PH")}`;
}

type CheckoutStep = "address" | "delivery" | "payment" | "review";

const steps: { key: CheckoutStep; label: string }[] = [
  { key: "address", label: "Address" },
  { key: "delivery", label: "Delivery" },
  { key: "payment", label: "Payment" },
  { key: "review", label: "Review" },
];

const deliveryOptions = [
  { id: "standard", title: "Standard delivery", detail: "2-4 business days", fee: 150 },
  { id: "pickup", title: "Store pickup", detail: "Ready at your selected branch", fee: 0 },
] as const;

const paymentOptions = [
  { id: "cod", title: "Cash on delivery", detail: "Pay when your order arrives" },
  { id: "gcash", title: "GCash", detail: "Secure mobile payment" },
] as const;

export default function CheckoutScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const layout = getResponsiveLayout(width);
  const { colors } = useTheme();
  const { couponCode } = useLocalSearchParams<{ couponCode?: string }>();
  const { items, subtotal, clearCart, removeItem, updateQuantity, isLoading: isCartLoading } = useCart();
  const { session, isHydrated } = useSession();
  const [step, setStep] = useState<CheckoutStep>("address");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [addressFields, setAddressFields] = useState<PhilippineAddressValue>(toPhilippineAddressFields({}));
  const [addressLabel, setAddressLabel] = useState("Home");
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>(DEFAULT_SAVED_ADDRESSES);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [deliveryId, setDeliveryId] = useState<(typeof deliveryOptions)[number]["id"]>("standard");
  const [paymentId, setPaymentId] = useState<(typeof paymentOptions)[number]["id"]>("cod");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [removedItem, setRemovedItem] = useState<CartItem | null>(null);
  const pricing = calculateCheckoutPricing(subtotal, couponCode ?? "", deliveryId);
  const discountAmount = pricing.discountAmount;
  const shippingFee = pricing.shippingFee;
  const total = pricing.total;

  useEffect(() => {
    if (!isHydrated || session.mode !== "mock-account") return;
    setFullName((current) => current || DEMO_ACCOUNT.displayName);
    setPhone((current) => current || DEMO_ACCOUNT.phone);
  }, [isHydrated, session]);

  useEffect(() => {
    let isActive = true;
    loadSavedAddresses()
      .then((addresses) => {
        if (!isActive) return;
        setSavedAddresses(addresses);
        const preferredAddress = addresses[0];
        if (preferredAddress) {
          setFullName(preferredAddress.recipient);
          setPhone(preferredAddress.phone);
          setAddressFields(toPhilippineAddressFields(preferredAddress));
          setSelectedAddressId(preferredAddress.id);
          setAddressLabel(preferredAddress.label);
        }
      })
      .catch(() => undefined);
    return () => {
      isActive = false;
    };
  }, []);

  function selectSavedAddress(savedAddress: SavedAddress) {
    setFullName(savedAddress.recipient);
    setPhone(savedAddress.phone);
    setAddressFields(toPhilippineAddressFields(savedAddress));
    setAddressLabel(savedAddress.label);
    setSelectedAddressId(savedAddress.id);
  }

  async function saveCurrentAddress() {
    const label = addressLabel.trim();
    if (!hasValidAddress() || !label) {
      Alert.alert("Address details needed", "Complete the recipient, label, and all required Philippine address fields before saving.");
      return;
    }

    const existing = savedAddresses.find((savedAddress) => savedAddress.label.toLowerCase() === label.toLowerCase());
    const nextAddress: SavedAddress = {
      id: existing?.id ?? `address-${Date.now()}`,
      label,
      recipient: fullName.trim(),
      phone: phone.trim(),
      address: formatPhilippineAddress(addressFields),
      ...addressFields,
    };
    const nextAddresses = [nextAddress, ...savedAddresses.filter((savedAddress) => savedAddress.id !== nextAddress.id)];

    try {
      await persistSavedAddresses(nextAddresses);
      setSavedAddresses(nextAddresses);
      setSelectedAddressId(nextAddress.id);
      setAddressLabel(label);
    } catch {
      Alert.alert("Couldn't save address", "Please try again when device storage is available.");
    }
  }

  async function removeSavedAddress(addressId: string) {
    const nextAddresses = savedAddresses.filter((savedAddress) => savedAddress.id !== addressId);
    try {
      await persistSavedAddresses(nextAddresses);
      setSavedAddresses(nextAddresses);
      if (selectedAddressId === addressId) setSelectedAddressId(null);
    } catch {
      Alert.alert("Couldn't remove address", "Please try again when device storage is available.");
    }
  }

  function hasValidAddress() {
    return Boolean(fullName.trim() && phone.trim() && isCompletePhilippineAddress(addressFields));
  }

  function handleNext() {
    if (step === "address" && !hasValidAddress()) return;
    const currentIndex = steps.findIndex((item) => item.key === step);
    const nextStep = steps[currentIndex + 1];
    if (nextStep) setStep(nextStep.key);
  }

  async function handlePlaceOrder() {
    if (!fullName.trim() || !phone.trim() || !isCompletePhilippineAddress(addressFields)) {
      Alert.alert("Missing details", "Please complete your name, phone number, and full Philippine delivery address.");
      return;
    }

    setIsSubmitting(true);
    try {
      await new Promise<void>((resolve) => setTimeout(resolve, 600));
      const orderId = `BF-${Date.now()}`;
      await savePlacedOrder({
        id: orderId,
        date: new Date().toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" }),
        status: "Ordered",
        items: items.map((item) => `${item.quantity} × ${item.product.name}${item.variant ? ` (${item.variant})` : ""}`).join(", "),
        total: formatPrice(total),
        address: formatPhilippineAddress(addressFields),
        phone: phone.trim(),
        deliveryMethod: deliveryOptions.find((option) => option.id === deliveryId)?.title ?? "Standard delivery",
        paymentMethod: paymentOptions.find((option) => option.id === paymentId)?.title ?? "Cash on delivery",
        productLines: items.map((item) => ({
          productId: item.product.id,
          quantity: item.quantity,
          variant: item.variant ?? null,
        })),
      });
      setCreatedOrderId(orderId);
      setIsComplete(true);
      clearCart();
    } catch {
      Alert.alert("Couldn't place demo order", "Your cart is still saved. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isHydrated || isCartLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <LoadingState label="Preparing your checkout..." />
      </SafeAreaView>
    );
  }

  if (session.mode === "guest") {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center border-b border-border px-4 py-3">
          <Pressable accessibilityLabel="Go back from checkout" accessibilityRole="button" onPress={() => router.back()} hitSlop={10} className="h-9 w-9 items-center justify-center">
            <Ionicons name="arrow-back" size={22} color={colors.foreground} />
          </Pressable>
          <Text className="ml-2 text-foreground text-lg font-semibold">Checkout</Text>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <View className="h-16 w-16 items-center justify-center rounded-full border border-border bg-secondary">
            <Ionicons name="person-outline" size={28} color={colors.muted} />
          </View>
          <Text className="mt-5 text-center text-foreground text-lg font-semibold">Sign in to continue</Text>
          <Text className="mt-2 text-center text-muted-foreground text-sm leading-5">
            Your cart is saved on this device. Sign in to the demo account to continue to checkout.
          </Text>
          <Pressable onPress={() => setIsSignInOpen(true)} className="mt-6 rounded-xl bg-primary px-5 py-3">
            <Text className="text-primary-foreground text-sm font-semibold">Sign in to demo account</Text>
          </Pressable>
        </View>
        <MockSignInSheet
          visible={isSignInOpen}
          message="Sign in to continue. Your guest cart will move into the local demo account."
          onClose={() => setIsSignInOpen(false)}
        />
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center px-4 py-3 border-b border-border">
          <Pressable accessibilityLabel="Go back from checkout" accessibilityRole="button" onPress={() => router.back()} hitSlop={10} className="w-9 h-9 items-center justify-center">
            <Ionicons name="arrow-back" size={22} color={colors.foreground} />
          </Pressable>
          <Text className="text-foreground text-lg font-semibold ml-2">Checkout</Text>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-foreground text-base font-semibold">Your cart is empty</Text>
          {removedItem && (
            <View className="flex-row items-center rounded-xl border border-primary/30 bg-primary/10 px-3 py-3 mt-4">
              <Text className="text-foreground text-xs">{removedItem.product.name} removed</Text>
              <Pressable
                accessibilityLabel="Undo remove checkout item"
                onPress={() => {
                  updateQuantity(removedItem.product.id, removedItem.quantity, removedItem.variant);
                  setRemovedItem(null);
                }}
                className="ml-3 px-2 py-1"
              >
                <Text className="text-primary text-xs font-bold">Undo</Text>
              </Pressable>
            </View>
          )}
          <Pressable onPress={() => router.replace("/")} className="bg-primary rounded-xl px-5 py-3 mt-5">
            <Text className="text-primary-foreground text-sm font-semibold">Browse products</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (isComplete) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-1 items-center justify-center px-6">
          <View className="w-20 h-20 rounded-full bg-primary/15 items-center justify-center border border-primary/30">
            <Ionicons name="checkmark" size={42} color={colors.primary} />
          </View>
          <Text className="text-foreground text-2xl font-bold text-center mt-6">Demo checkout complete</Text>
          <Text className="text-muted-foreground text-sm text-center mt-2 leading-5">
            This preview did not submit a real order or payment. Your cart has been cleared from this device.
          </Text>
          <View className="w-full bg-card border border-border rounded-2xl p-4 mt-7">
            <SummaryRow label="Subtotal" value={formatPrice(subtotal)} />
            {discountAmount > 0 && <SummaryRow label="Promo" value={`-${formatPrice(discountAmount)}`} />}
            <SummaryRow label="Total" value={formatPrice(total)} />
            <SummaryRow label="Delivery" value={deliveryOptions.find((option) => option.id === deliveryId)?.title ?? "Standard delivery"} />
            <SummaryRow label="Payment" value={paymentOptions.find((option) => option.id === paymentId)?.title ?? "Cash on delivery"} />
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => createdOrderId && router.replace({ pathname: "/orders/[id]", params: { id: createdOrderId } })}
            className="w-full bg-primary rounded-xl items-center py-3.5 mt-6"
          >
            <Text className="text-primary-foreground text-sm font-bold">Track this order</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.replace("/")} className="w-full items-center py-3.5 mt-1">
            <Text className="text-muted-foreground text-sm font-semibold">Continue shopping</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View className="flex-row items-center px-4 py-3 border-b border-border">
          <Pressable accessibilityLabel="Go back from checkout" accessibilityRole="button" onPress={() => router.back()} hitSlop={10} className="w-9 h-9 items-center justify-center">
            <Ionicons name="arrow-back" size={22} color={colors.foreground} />
          </Pressable>
          <Text className="text-foreground text-lg font-semibold ml-2">Checkout</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: layout.horizontalPadding, paddingBottom: 32, width: "100%", maxWidth: 720, alignSelf: "center" }}>
          <View className="rounded-2xl border border-border bg-card p-3 mb-5 shadow-soft">
            <View className="flex-row items-center gap-2">
              <Ionicons name="information-circle-outline" size={16} color={colors.primary} />
              <Text className="text-foreground text-sm font-semibold">Checkout preview</Text>
            </View>
            <Text className="text-muted-foreground text-xs mt-1">No payment is charged and no order is sent to a store.</Text>
          </View>

          <View className="flex-row items-start justify-between mb-7">
            {steps.map((item, index) => {
              const currentIndex = steps.findIndex((current) => current.key === step);
              const active = item.key === step;
              const complete = currentIndex > index;
              return (
                <View key={item.key} className="items-center flex-1">
                  <View className={`w-8 h-8 rounded-full items-center justify-center border ${active || complete ? "bg-primary border-primary" : "bg-secondary border-border"}`}>
                    {complete ? (
                      <Ionicons name="checkmark" size={16} color={colors.foreground} />
                    ) : (
                      <Text className={`text-xs font-bold ${active ? "text-primary-foreground" : "text-muted-foreground"}`}>{index + 1}</Text>
                    )}
                  </View>
                  <Text className={`text-[10px] mt-2 ${active ? "text-primary font-bold" : "text-muted-foreground"}`}>{item.label}</Text>
                </View>
              );
            })}
          </View>

          {step === "address" && (
            <View>
              <Text className="text-foreground text-base font-bold">Delivery details</Text>
              <Text className="text-muted-foreground text-xs mt-1">Where should we send your order?</Text>
              {savedAddresses.length > 0 && (
                <View className="mt-4 gap-2">
                  <Text className="text-foreground text-sm font-semibold">Saved addresses</Text>
                  {savedAddresses.map((savedAddress) => (
                    <View key={savedAddress.id} className={`flex-row items-center rounded-xl border ${selectedAddressId === savedAddress.id ? "border-primary bg-primary/10" : "border-border bg-card"}`}>
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ selected: selectedAddressId === savedAddress.id }}
                        accessibilityLabel={`${savedAddress.label}, ${savedAddress.address}`}
                        onPress={() => selectSavedAddress(savedAddress)}
                        className="flex-1 p-3"
                      >
                        <Text className="text-foreground text-sm font-semibold">{savedAddress.label}</Text>
                        <Text className="text-muted-foreground text-xs mt-1">{savedAddress.recipient} · {savedAddress.phone}</Text>
                        <Text className="text-muted-foreground text-xs mt-1 leading-4">{savedAddress.address}</Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Remove ${savedAddress.label} address`}
                        onPress={() => void removeSavedAddress(savedAddress.id)}
                        hitSlop={8}
                        className="h-11 w-11 items-center justify-center"
                      >
                        <Ionicons name="trash-outline" size={17} color={colors.muted} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
              <Field label="Full name" value={fullName} onChangeText={(value) => { setFullName(value); setSelectedAddressId(null); }} placeholder="Juan Dela Cruz" />
              <Field label="Phone number" value={phone} onChangeText={(value) => { setPhone(value); setSelectedAddressId(null); }} placeholder="09XX XXX XXXX" keyboardType="phone-pad" />
              <PhilippineAddressFields
                value={addressFields}
                onChange={(patch) => {
                  setAddressFields((current) => ({ ...current, ...patch }));
                  setSelectedAddressId(null);
                }}
              />
              <Field label="Save address as" value={addressLabel} onChangeText={setAddressLabel} placeholder="Home, Work, or Other" />
              <Pressable accessibilityRole="button" onPress={() => void saveCurrentAddress()} className="mt-3 h-11 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-secondary">
                <Ionicons name="bookmark-outline" size={16} color={colors.foreground} />
                <Text className="text-foreground text-sm font-semibold">Save address</Text>
              </Pressable>
              {!hasValidAddress() && (fullName.length > 0 || phone.length > 0 || Object.values(addressFields).some(Boolean)) && (
                <Text className="text-primary text-xs mt-3">Complete all fields to continue.</Text>
              )}
            </View>
          )}

          {step === "delivery" && (
            <OptionSection title="Delivery method" subtitle="Choose how you want to receive your order.">
              {deliveryOptions.map((option) => (
                <OptionRow
                  key={option.id}
                  title={option.title}
                  detail={`${option.detail} • ${option.fee === 0 ? "FREE" : formatPrice(option.fee)}`}
                  selected={deliveryId === option.id}
                  onPress={() => setDeliveryId(option.id)}
                />
              ))}
            </OptionSection>
          )}

          {step === "payment" && (
            <OptionSection title="Payment method" subtitle="Select a payment option for this demo order.">
              {paymentOptions.map((option) => (
                <OptionRow
                  key={option.id}
                  title={option.title}
                  detail={option.detail}
                  selected={paymentId === option.id}
                  onPress={() => setPaymentId(option.id)}
                />
              ))}
            </OptionSection>
          )}

          {step === "review" && (
            <View>
              <Text className="text-foreground text-base font-bold">Review your order</Text>
              <ReviewRow label="Deliver to" value={`${fullName}\n${formatPhilippineAddress(addressFields)}\n${phone}`} onPress={() => setStep("address")} />
              <ReviewRow label="Delivery" value={deliveryOptions.find((option) => option.id === deliveryId)?.title ?? "Standard delivery"} onPress={() => setStep("delivery")} />
              <ReviewRow label="Payment" value={paymentOptions.find((option) => option.id === paymentId)?.title ?? "Cash on delivery"} onPress={() => setStep("payment")} />
            </View>
          )}

          <Text className="text-foreground text-base font-bold mt-7 mb-3">Order summary</Text>
          <View className="bg-card border border-border rounded-2xl p-4 shadow-soft">
            {items.map(({ product, quantity, variant }) => (
              <View key={product.id} className="flex-row justify-between mb-3 gap-3">
                <Text className="flex-1 text-muted-foreground text-sm" numberOfLines={2}>{quantity} x {product.name}{variant ? ` • ${variant}` : ""}</Text>
                <Text className="text-foreground text-sm font-medium ml-3">
                  {formatPrice(product.price * quantity)}
                </Text>
                <Pressable
                  accessibilityLabel={`Remove ${product.name} from checkout`}
                  onPress={() => {
                    setRemovedItem({ product, quantity });
                    removeItem(product.id, variant);
                  }}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={17} color={colors.muted} />
                </Pressable>
              </View>
            ))}
            {removedItem && items.length > 0 && (
              <View className="flex-row items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 mb-2">
                <Text className="flex-1 text-foreground text-xs">{removedItem.product.name} removed</Text>
                <Pressable
                  accessibilityLabel="Undo remove checkout item"
                  onPress={() => {
                    updateQuantity(removedItem.product.id, removedItem.quantity, removedItem.variant);
                    setRemovedItem(null);
                  }}
                  className="px-2 py-1"
                >
                  <Text className="text-primary text-xs font-bold">Undo</Text>
                </Pressable>
              </View>
            )}
            <View className="border-t border-border pt-3 mt-1">
              <SummaryRow label="Subtotal" value={formatPrice(subtotal)} />
              {discountAmount > 0 && <SummaryRow label="Promo" value={`-${formatPrice(discountAmount)}`} />}
              <SummaryRow label="Shipping" value={shippingFee === 0 ? "FREE" : formatPrice(shippingFee)} />
              <View className="flex-row justify-between mt-3">
                <Text className="text-foreground text-base font-bold">Total</Text>
                <Text className="text-primary text-base font-bold">{formatPrice(total)}</Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={step === "review" ? () => void handlePlaceOrder() : handleNext}
            disabled={isSubmitting}
            className="bg-primary rounded-xl items-center py-3.5 mt-5"
            style={({ pressed }) => ({ opacity: isSubmitting ? 0.55 : pressed ? 0.8 : 1 })}
          >
            {isSubmitting ? <ActivityIndicator color={colors.foreground} /> : <Text className="text-primary-foreground text-sm font-bold">{step === "review" ? "Place order" : "Continue"}</Text>}
          </Pressable>
          {step !== "address" && (
            <Pressable
              accessibilityLabel="Go to previous checkout step"
              accessibilityRole="button"
              onPress={() => {
                const currentIndex = steps.findIndex((item) => item.key === step);
                setStep(steps[currentIndex - 1].key);
              }}
              className="items-center py-3"
            >
              <Text className="text-muted-foreground text-sm font-semibold">Back</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: "default" | "phone-pad";
};

function Field({ label, value, onChangeText, placeholder, multiline, keyboardType = "default" }: FieldProps) {
  const { colors } = useTheme();

  return (
    <View className="mt-4">
      <Text className="text-muted-foreground text-xs mb-2">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        keyboardType={keyboardType}
        multiline={multiline}
        className={`bg-secondary border border-border rounded-xl px-3 py-3 text-foreground text-sm ${multiline ? "min-h-20" : "h-11"}`}
      />
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between mb-2">
      <Text className="text-muted-foreground text-sm">{label}</Text>
      <Text className="text-foreground text-sm">{value}</Text>
    </View>
  );
}

function OptionSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <View>
      <Text className="text-foreground text-base font-bold">{title}</Text>
      <Text className="text-muted-foreground text-xs mt-1 mb-4">{subtitle}</Text>
      <View className="gap-3">{children}</View>
    </View>
  );
}

function OptionRow({
  title,
  detail,
  selected,
  onPress,
}: {
  title: string;
  detail: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={`${title}: ${detail}`}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      className={`flex-row items-center rounded-xl border p-4 ${selected ? "border-primary bg-primary/10" : "border-border bg-card"}`}
    >
      <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${selected ? "border-primary" : "border-border"}`}>
        {selected && <View className="w-2.5 h-2.5 rounded-full bg-primary" />}
      </View>
      <View className="flex-1 ml-3">
        <Text className="text-foreground text-sm font-semibold">{title}</Text>
        <Text className="text-muted-foreground text-xs mt-1">{detail}</Text>
      </View>
    </Pressable>
  );
}

function ReviewRow({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <View className="border-b border-border py-4 flex-row items-start">
      <View className="flex-1">
        <Text className="text-muted-foreground text-xs uppercase tracking-[0.1em]">{label}</Text>
        <Text className="text-foreground text-sm mt-1 leading-5">{value}</Text>
      </View>
      <Pressable accessibilityLabel={`Edit ${label}`} accessibilityRole="button" onPress={onPress} hitSlop={8}>
        <Text className="text-primary text-xs font-semibold">Edit</Text>
      </Pressable>
    </View>
  );
}
