import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useActiveFocusEffect } from "@/hooks/useActiveScreen";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { MockSignInSheet } from "@/components/account/MockSignInSheet";
import { useCart } from "@/hooks/useCart";
import { useSession } from "@/hooks/useSession";
import { getCheckout, type Checkout } from "@/lib/api";
import { placeOrder } from "@/lib/orders";
import { loadSavedAddresses, persistSavedAddresses, type SavedAddress } from "@/lib/savedAddresses";
import { checkoutRecipient, paymentForFulfillment, paymentProofError, formatCheckoutAmount, checkoutDetailsError } from "@/lib/checkoutForm";
import { PhilippineAddressFields } from "@/components/addresses/PhilippineAddressFields";
import { EMPTY_PHILIPPINE_ADDRESS, isCompletePhilippineAddress, formatPhilippineAddress } from "@/lib/philippineAddress";
import { getLocalUserId } from "@/lib/api";

export default function CheckoutScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { refreshCart } = useCart();
  const [preview, setPreview] = useState<Checkout | null>(null);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [isAddingAddress, setIsAddingAddress] = useState(false);
  const [addressLabel, setAddressLabel] = useState("");
  const [location, setLocation] = useState(EMPTY_PHILIPPINE_ADDRESS);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [checkoutRetry, setCheckoutRetry] = useState(0);
  const [fulfillment, setFulfillment] = useState("pickup");
  const [payment, setPayment] = useState("cash");
  const [proof, setProof] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const customerId = session.mode === "customer" ? session.user.id : null;
  useEffect(() => { setCreatedOrderId(null); }, [customerId]);
  const initializedCustomer = useRef<number | null>(null);
  const lastPreviewAt = useRef(0);
  useEffect(() => {
    initializedCustomer.current = null; lastPreviewAt.current = 0;
    setPreview(null); setError("");
    setSavedAddresses([]);
    setIsAddingAddress(false); setAddressLabel(""); setLocation(EMPTY_PHILIPPINE_ADDRESS); setAddressError(""); setIsSavingAddress(false);
    setFullName(""); setPhone(""); setAddress(""); setProof(null); setFulfillment("pickup"); setPayment("cash");
  }, [customerId, createdOrderId, checkoutRetry]);
  useActiveFocusEffect(useCallback(() => {
    let active = true;
    if (customerId === null || createdOrderId) return;
    if (initializedCustomer.current === customerId && Date.now() - lastPreviewAt.current < 30_000) return;
    Promise.all([getCheckout(), loadSavedAddresses()]).then(([result, addresses]) => {
      if (!active) return;
      const recipient = checkoutRecipient(result.customer, addresses);
      setPreview(result); setSavedAddresses(addresses);
      if (initializedCustomer.current !== customerId) {
        setFullName(recipient.name); setPhone(recipient.phone); setAddress(recipient.address);
        setIsAddingAddress(!recipient.phone.trim() || !recipient.address.trim());
        initializedCustomer.current = customerId;
      }
      lastPreviewAt.current = Date.now();
    }).catch((reason) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [customerId, createdOrderId, checkoutRetry]));
  const visiblePreview = initializedCustomer.current === customerId ? preview : null;
  const paymentOptions = visiblePreview?.payment_methods.filter((method) => method.available_for.includes(fulfillment)) ?? [];
  const selectedPayment = paymentOptions.find((method) => method.value === payment);
  async function saveAddress() {
    if (isSavingAddress || customerId === null) return;
    if (!addressLabel.trim() || !fullName.trim() || !phone.trim() || !isCompletePhilippineAddress(location)) {
      setAddressError("Complete the label, recipient, phone, and every required Philippine address field."); return;
    }
    const formatted = formatPhilippineAddress(location);
    if (formatted.length > 255) { setAddressError("Keep the complete address within 255 characters."); return; }
    const existing = savedAddresses.find((entry) => entry.label.toLowerCase() === addressLabel.trim().toLowerCase());
    const entry: SavedAddress = { ...location, id: existing?.id ?? `address-${Date.now()}`, label: addressLabel.trim(), recipient: fullName.trim(), phone: phone.trim(), address: formatted };
    const next = [entry, ...savedAddresses.filter((saved) => saved.id !== entry.id)];
    setIsSavingAddress(true); setAddressError("");
    try {
      await persistSavedAddresses(next);
      if (getLocalUserId() !== customerId) return;
      setSavedAddresses(next); setAddress(formatted); setIsAddingAddress(false);
    } catch {
      if (getLocalUserId() === customerId) setAddressError("Couldn't save this address. Please try again.");
    } finally { if (getLocalUserId() === customerId) setIsSavingAddress(false); }
  }
  async function chooseProof() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
      if (!result.canceled) {
        const validation = paymentProofError(result.assets[0]);
        if (validation) { Alert.alert("Cannot use this proof", validation); return; }
        setProof(result.assets[0]);
      }
    } catch (reason) { Alert.alert("Cannot select proof", reason instanceof Error ? reason.message : "Please try again."); }
  }
  async function submit() {
    if (submitting.current || createdOrderId || isSavingAddress || (fulfillment === "delivery" && isAddingAddress) || !visiblePreview || !selectedPayment) return;
    const validation = checkoutDetailsError({ name: fullName, phone, fulfillment, address, editingAddress: isAddingAddress, requiresProof: selectedPayment.requires_proof, hasProof: Boolean(proof) });
    if (validation) { setError(validation); return; }
    submitting.current = true;
    setIsSubmitting(true); setError("");
    try {
      const order = await placeOrder({ recipient_name: fullName.trim(), contact_number: phone.trim(), fulfillment_method: fulfillment,
        payment_method: payment, delivery_address: fulfillment === "delivery" ? address.trim() : undefined,
        payment_proof: selectedPayment.requires_proof && proof ? { uri: proof.uri, name: proof.fileName ?? "payment-proof.jpg", type: proof.mimeType ?? "image/jpeg" } : undefined });
      if (getLocalUserId() !== customerId) return;
      setCreatedOrderId(order.id);
      void refreshCart().catch(() => undefined);
    } catch (reason) {
      if (getLocalUserId() !== customerId) return;
      setError(reason instanceof Error ? reason.message : "Could not place order.");
      // Never retry a placement automatically: the API has no idempotency contract.
      if (!(reason instanceof Error) || !('status' in reason)) Alert.alert("Check order history", "If the connection failed after submission, check My orders before trying again.");
    } finally { submitting.current = false; setIsSubmitting(false); }
  }
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center border-b border-border px-4 py-3">
        <Pressable accessibilityRole="button" accessibilityLabel="Back from checkout" disabled={isSubmitting} onPress={() => router.back()} className="min-h-12 justify-center px-2"><Text className="text-primary text-sm font-semibold">Back</Text></Pressable>
        <Text className="ml-4 text-foreground text-lg font-semibold">Checkout</Text>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {createdOrderId ? <View>
          <Text className="text-foreground text-lg font-bold">Order placed</Text>
          <Pressable onPress={() => router.replace({ pathname: "/orders/[id]", params: { id: createdOrderId } })} className="mt-5 rounded-xl bg-primary px-5 py-3"><Text className="text-primary-foreground">View order</Text></Pressable>
        </View> : session.mode === "guest" ? <Pressable onPress={() => setIsSignInOpen(true)} className="rounded-xl bg-primary px-5 py-3"><Text className="text-primary-foreground">Sign in to continue</Text></Pressable> : !visiblePreview ? <View>
          {error ? <Text className="text-danger">{error}</Text> : <ActivityIndicator />}
          {error ? <Pressable onPress={() => setCheckoutRetry((current) => current + 1)}><Text className="text-primary mt-4">Retry</Text></Pressable> : null}
        </View> : <View>
          <View className="rounded-2xl border border-border bg-card p-5 mb-6"><Text className="text-primary text-xs font-bold uppercase">Customer checkout</Text><Text className="text-foreground text-xl font-bold mt-2">Confirm fulfillment and payment</Text><Text className="text-muted-foreground text-sm mt-2">Review your hardware selection and the details Battlefront needs for your order.</Text></View>
          <Text className="text-primary text-xs font-semibold">STEP 1</Text>
          <Text className="text-foreground text-base font-bold mt-1">Recipient details</Text>
          <Text className="text-foreground text-sm mt-3">Recipient name</Text>
          <TextInput accessibilityLabel="Recipient name" value={fullName} onChangeText={setFullName} editable={!isSubmitting && !isSavingAddress} maxLength={255} autoComplete="name" placeholder="Full name" className="mt-2 rounded-xl border border-border bg-secondary px-3 py-3 text-foreground" />
          <Text className="text-foreground text-sm mt-3">Contact number</Text>
          <TextInput accessibilityLabel="Contact number" value={phone} onChangeText={setPhone} editable={!isSubmitting && !isSavingAddress} maxLength={20} autoComplete="tel" placeholder="e.g. 0917 123 4567" keyboardType="phone-pad" className="mt-2 rounded-xl border border-border bg-secondary px-3 py-3 text-foreground" />
          {fulfillment === "delivery" && (isAddingAddress ? <View className="mt-3 rounded-xl border border-border bg-secondary p-3">
            <Text className="text-foreground text-sm font-semibold">Add delivery address</Text>
            <Text className="text-muted-foreground text-xs mt-2">Save your recipient details and address for checkout and Account on this device.</Text>
            <TextInput accessibilityLabel="Address label" value={addressLabel} onChangeText={setAddressLabel} editable={!isSavingAddress} placeholder="Label (Home, Work)" className="mt-3 h-11 rounded-lg border border-border bg-background px-3 text-foreground text-sm" />
            <View pointerEvents={isSavingAddress ? "none" : "auto"}>
              <PhilippineAddressFields value={location} onChange={(patch) => setLocation((current) => ({ ...current, ...patch }))} />
            </View>
            {addressError ? <Text className="text-danger mt-2">{addressError}</Text> : null}
            <Pressable disabled={isSavingAddress} onPress={() => void saveAddress()} className="mt-3 rounded-xl bg-primary px-5 py-3"><Text className="text-primary-foreground text-center">{isSavingAddress ? "Saving..." : "Save address and use for checkout"}</Text></Pressable>
            {!!address.trim() && !!phone.trim() && <Pressable disabled={isSavingAddress} onPress={() => setIsAddingAddress(false)} className="mt-2 p-3"><Text className="text-foreground text-center">Cancel</Text></Pressable>}
          </View> : <Pressable disabled={isSubmitting} onPress={() => { setAddressLabel(""); setLocation(EMPTY_PHILIPPINE_ADDRESS); setAddressError(""); setIsAddingAddress(true); }} className="mt-3 py-2"><Text className="text-primary font-semibold">Add another address</Text></Pressable>)}
          <Text className="text-primary text-xs font-semibold mt-6">STEP 2</Text>
          <Text className="text-foreground text-base font-bold mt-1">Fulfillment method</Text>
          {visiblePreview.fulfillment_methods.map((method) => <Pressable key={method.value} disabled={isSubmitting} accessibilityRole="radio" accessibilityState={{ checked: fulfillment === method.value, disabled: isSubmitting }} onPress={() => { const next = paymentForFulfillment(visiblePreview.payment_methods, method.value, payment); setFulfillment(method.value); if (next !== payment) { setProof(null); setPayment(next); } }} className={`mt-3 rounded-xl border p-4 ${fulfillment === method.value ? "border-primary bg-primary/10" : "border-border bg-card"}`}><Text className="text-foreground font-semibold">{fulfillment === method.value ? "● " : "○ "}{method.label}</Text><Text className="text-muted-foreground text-xs mt-1">{method.value === "pickup" ? "Collect your order from Battlefront." : "Send the order to your supplied address."}</Text></Pressable>)}
          {fulfillment === "delivery" ? <View>
            {savedAddresses.length > 0 && <View className="mt-3">
              <Text className="text-foreground text-sm font-semibold">Use a saved address</Text>
              {savedAddresses.map((saved) => <Pressable key={saved.id} disabled={isSubmitting || isSavingAddress} onPress={() => { setAddress(saved.address); setFullName(saved.recipient); setPhone(saved.phone); setIsAddingAddress(!saved.phone.trim() || !saved.address.trim()); }} className="mt-2 rounded-xl border border-border bg-card p-3"><Text className="text-foreground text-sm">{saved.label} · {saved.recipient}</Text><Text className="text-muted-foreground text-xs mt-1">{saved.address}</Text></Pressable>)}
            </View>}
            <Text className="text-foreground text-sm mt-3">Delivery address</Text>
            <Text className="text-foreground mt-2">{address || "Add your delivery address above."}</Text>
            <Text className="text-muted-foreground text-xs mt-2">Selected from your saved details. Choose another address above if needed.</Text>
          </View> : <View className="mt-3 rounded-2xl border border-border bg-card p-4"><Text className="text-primary text-xs font-semibold">PICKUP LOCATION</Text><Text className="text-foreground font-semibold mt-2">{visiblePreview.pickup_location.name}</Text><Text className="text-muted-foreground text-sm mt-2">{visiblePreview.pickup_location.address}</Text>{visiblePreview.pickup_location.contact_number && <Text className="text-muted-foreground text-sm mt-2">{visiblePreview.pickup_location.contact_number}</Text>}{visiblePreview.pickup_location.operating_hours && <Text className="text-muted-foreground text-sm mt-2">{visiblePreview.pickup_location.operating_hours}</Text>}</View>}
          <Text className="text-primary text-xs font-semibold mt-6">STEP 3</Text>
          <Text className="text-foreground text-base font-bold mt-1">Payment method</Text>
          {visiblePreview.payment_methods.map((method) => {
            const available = method.available_for.includes(fulfillment);
            return <Pressable key={method.value} disabled={!available || isSubmitting} accessibilityRole="radio" accessibilityState={{ checked: payment === method.value, disabled: !available || isSubmitting }} onPress={() => { setPayment(method.value); setProof(null); }} className={`mt-3 rounded-xl border p-4 ${payment === method.value ? "border-primary bg-primary/10" : "border-border bg-card"}`} style={{ opacity: available ? 1 : 0.5 }}><Text className="text-foreground font-semibold">{payment === method.value ? "● " : "○ "}{method.label}</Text><Text className="text-muted-foreground text-xs mt-1">{!available ? "Available for pickup only." : method.requires_proof ? "Manual e-wallet payment with proof." : "Pay when you collect your order."}</Text></Pressable>;
          })}
          {selectedPayment?.requires_proof && <View>
            <View className="mt-3 rounded-2xl border border-border bg-card p-4">
              <Text className="text-foreground font-semibold">{selectedPayment.label} receiving account</Text>
              {selectedPayment.payment_account?.is_demo && <Text className="text-primary text-xs font-semibold mt-2">Demo details — do not send real money.</Text>}
              <Text className="text-muted-foreground text-xs mt-3">Account name</Text><Text className="text-foreground font-semibold mt-1">{selectedPayment.payment_account?.account_name}</Text>
              <Text className="text-muted-foreground text-xs mt-3">Account/mobile number</Text><Text className="text-foreground font-semibold mt-1">{selectedPayment.payment_account?.account_number}</Text>
              <Text className="text-foreground font-semibold mt-4">Pay first, then capture proof</Text>
              <Text className="text-muted-foreground text-sm mt-2">Send payment only to the account shown for this wallet. After a successful transaction, upload a screenshot or snapshot. Proof remains pending manual admin verification.</Text>
              <Pressable disabled={isSubmitting} onPress={() => void chooseProof()} className="mt-3 rounded-xl border border-border bg-secondary p-4"><Text className="text-foreground">{proof ? `Selected: ${proof.fileName ?? "payment proof"}` : "Choose payment proof image"}</Text></Pressable>
              <Text className="text-muted-foreground text-xs mt-2">JPEG, PNG, or WebP up to 5 MB. Proof is handled as private evidence.</Text>
            </View>
          </View>}
          <View className="mt-6 rounded-2xl border border-border bg-card p-5">
            <Text className="text-primary text-xs font-semibold">CURRENT CART</Text>
            <Text className="text-foreground text-lg font-bold mt-2">Hardware summary</Text>
            {visiblePreview.cart.items.map((item) => <View key={item.id} className="flex-row justify-between gap-3 border-b border-border py-4"><View className="flex-1"><Text className="text-foreground font-semibold">{item.product.name}</Text><Text className="text-muted-foreground text-xs mt-1">{item.product.brand ? `${item.product.brand} · ` : ""}Qty {item.quantity}</Text></View><Text className="text-foreground font-semibold">{formatCheckoutAmount(item.line_total)}</Text></View>)}
            <View className="flex-row justify-between mt-4"><Text className="text-muted-foreground text-sm">Products</Text><Text className="text-foreground font-semibold">{visiblePreview.cart.item_count}</Text></View>
            <View className="flex-row justify-between mt-3"><Text className="text-muted-foreground text-sm">Units</Text><Text className="text-foreground font-semibold">{visiblePreview.cart.total_quantity}</Text></View>
            <View className="flex-row justify-between mt-4 border-t border-border pt-4"><Text className="text-foreground font-semibold">Cart total</Text><Text className="text-foreground text-xl font-bold">{formatCheckoutAmount(visiblePreview.cart.total)}</Text></View>
          </View>

          <Text className="text-muted-foreground text-xs text-center mt-3">Review your details before placing your order.</Text>
          <Pressable disabled={isSubmitting} onPress={() => router.navigate("/cart")} className="mt-4 rounded-xl border border-border p-3"><Text className="text-foreground text-center font-semibold">Back to cart</Text></Pressable>
        </View>}
      </ScrollView>
      {visiblePreview && !createdOrderId && session.mode === "customer" && <View className="rounded-t-2xl border-t border-border bg-card px-4 py-3">
        <View className="flex-row flex-wrap items-center justify-between gap-2 mb-3"><Text className="text-muted-foreground text-sm">Cart total</Text><Text className="text-foreground text-xl font-bold">{formatCheckoutAmount(visiblePreview.cart.total)}</Text></View>
        {error && <Text accessibilityRole="alert" className="text-danger text-sm mb-2">{error}</Text>}
        {fulfillment === "delivery" && isAddingAddress && <Text className="text-muted-foreground text-sm mb-2">Save your delivery address above to continue.</Text>}
        <Pressable accessibilityRole="button" accessibilityState={{ busy: isSubmitting, disabled: isSubmitting || isSavingAddress || (fulfillment === "delivery" && isAddingAddress) }} disabled={isSubmitting || isSavingAddress || (fulfillment === "delivery" && isAddingAddress)} onPress={() => void submit()} className="min-h-12 rounded-xl bg-primary px-5 py-3" style={({ pressed }) => ({ opacity: isSubmitting || isSavingAddress || (fulfillment === "delivery" && isAddingAddress) ? 0.5 : pressed ? 0.8 : 1 })}><Text className="text-primary-foreground text-center font-semibold">{isSubmitting ? "Placing order…" : "Place order"}</Text></Pressable>
      </View>}
      </KeyboardAvoidingView>
      <MockSignInSheet visible={isSignInOpen} onClose={() => setIsSignInOpen(false)} />
    </SafeAreaView>
  );
}
