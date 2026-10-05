import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { MockSignInSheet } from "@/components/account/MockSignInSheet";
import { useCart } from "@/hooks/useCart";
import { useSession } from "@/hooks/useSession";
import { getCheckout, type Checkout } from "@/lib/api";
import { placeOrder } from "@/lib/orders";
import { loadSavedAddresses, type SavedAddress } from "@/lib/savedAddresses";
import { paymentForFulfillment, paymentProofError, formatCheckoutAmount } from "@/lib/checkoutForm";

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
  const [checkoutRetry, setCheckoutRetry] = useState(0);
  const [fulfillment, setFulfillment] = useState("pickup");
  const [payment, setPayment] = useState("cash");
  const [proof, setProof] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const customerId = session.mode === "customer" ? session.user.id : null;
  useEffect(() => {
    let active = true;
    setPreview(null); setError("");
    setSavedAddresses([]);
    setFullName(""); setPhone(""); setAddress(""); setProof(null); setFulfillment("pickup"); setPayment("cash");
    if (customerId === null || createdOrderId) return;
    getCheckout().then((result) => {
      if (!active) return;
      setPreview(result); setFullName(result.customer.name); setAddress(result.customer.default_delivery_address ?? "");
    }).catch((reason) => { if (active) setError(reason.message); });
    loadSavedAddresses().then((addresses) => { if (active) setSavedAddresses(addresses); }).catch(() => undefined);
    return () => { active = false; };
  }, [customerId, createdOrderId, checkoutRetry]);
  const paymentOptions = preview?.payment_methods.filter((method) => method.available_for.includes(fulfillment)) ?? [];
  const selectedPayment = paymentOptions.find((method) => method.value === payment);
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
    if (isSubmitting || !preview || !selectedPayment) return;
    if (!fullName.trim() || !phone.trim() || (fulfillment === "delivery" && !address.trim()) || (selectedPayment.requires_proof && !proof)) {
      setError("Complete the recipient details, delivery address when needed, and required payment proof."); return;
    }
    setIsSubmitting(true); setError("");
    try {
      const order = await placeOrder({ recipient_name: fullName.trim(), contact_number: phone.trim(), fulfillment_method: fulfillment,
        payment_method: payment, delivery_address: fulfillment === "delivery" ? address.trim() : undefined,
        payment_proof: selectedPayment.requires_proof && proof ? { uri: proof.uri, name: proof.fileName ?? "payment-proof.jpg", type: proof.mimeType ?? "image/jpeg" } : undefined });
      setCreatedOrderId(order.id);
      void refreshCart().catch(() => undefined);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not place order.");
      // Never retry a placement automatically: the API has no idempotency contract.
      if (!(reason instanceof Error) || !('status' in reason)) Alert.alert("Check order history", "If the connection failed after submission, check My orders before trying again.");
    } finally { setIsSubmitting(false); }
  }
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center border-b border-border px-4 py-3">
        <Pressable onPress={() => router.back()}><Text className="text-primary text-sm font-semibold">Back</Text></Pressable>
        <Text className="ml-4 text-foreground text-lg font-semibold">Checkout</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        {createdOrderId ? <View>
          <Text className="text-foreground text-lg font-bold">Order placed</Text>
          <Pressable onPress={() => router.replace({ pathname: "/orders/[id]", params: { id: createdOrderId } })} className="mt-5 rounded-xl bg-primary px-5 py-3"><Text className="text-primary-foreground">View order</Text></Pressable>
        </View> : session.mode === "guest" ? <Pressable onPress={() => setIsSignInOpen(true)} className="rounded-xl bg-primary px-5 py-3"><Text className="text-primary-foreground">Sign in to continue</Text></Pressable> : !preview ? <View>
          {error ? <Text className="text-danger">{error}</Text> : <ActivityIndicator />}
          {error ? <Pressable onPress={() => setCheckoutRetry((current) => current + 1)}><Text className="text-primary mt-4">Retry</Text></Pressable> : null}
        </View> : <View>
          <View className="border border-border bg-card p-5 mb-6"><Text className="text-primary text-xs font-bold uppercase">Customer checkout</Text><Text className="text-foreground text-xl font-bold mt-2">Confirm fulfillment and payment</Text><Text className="text-muted-foreground text-sm mt-2">Review your hardware selection and the details Battlefront needs for your order.</Text></View>
          <Text className="text-primary text-xs font-semibold">STEP 1</Text>
          <Text className="text-foreground text-base font-bold mt-1">Recipient details</Text>
          <Text className="text-foreground text-sm mt-3">Recipient name</Text>
          <TextInput accessibilityLabel="Recipient name" value={fullName} onChangeText={setFullName} editable={!isSubmitting} maxLength={255} autoComplete="name" placeholder="Full name" className="mt-2 rounded-xl border border-border bg-secondary px-3 py-3 text-foreground" />
          <Text className="text-foreground text-sm mt-3">Contact number</Text>
          <TextInput accessibilityLabel="Contact number" value={phone} onChangeText={setPhone} editable={!isSubmitting} maxLength={20} autoComplete="tel" placeholder="e.g. 0917 123 4567" keyboardType="phone-pad" className="mt-2 rounded-xl border border-border bg-secondary px-3 py-3 text-foreground" />
          <Text className="text-primary text-xs font-semibold mt-6">STEP 2</Text>
          <Text className="text-foreground text-base font-bold mt-1">Fulfillment method</Text>
          {preview.fulfillment_methods.map((method) => <Pressable key={method.value} disabled={isSubmitting} accessibilityRole="radio" accessibilityState={{ checked: fulfillment === method.value, disabled: isSubmitting }} onPress={() => { const next = paymentForFulfillment(preview.payment_methods, method.value, payment); setFulfillment(method.value); if (next !== payment) { setProof(null); setPayment(next); } }} className={`mt-3 rounded-xl border p-4 ${fulfillment === method.value ? "border-primary bg-primary/10" : "border-border bg-card"}`}><Text className="text-foreground font-semibold">{fulfillment === method.value ? "● " : "○ "}{method.label}</Text><Text className="text-muted-foreground text-xs mt-1">{method.value === "pickup" ? "Collect your order from Battlefront." : "Send the order to your supplied address."}</Text></Pressable>)}
          {fulfillment === "delivery" ? <View>
            {savedAddresses.length > 0 && <View className="mt-3">
              <Text className="text-foreground text-sm font-semibold">Use a saved address</Text>
              {savedAddresses.map((saved) => <Pressable key={saved.id} onPress={() => { setAddress(saved.address); setFullName(saved.recipient); setPhone(saved.phone); }} className="mt-2 rounded-xl border border-border bg-card p-3"><Text className="text-foreground text-sm">{saved.label} · {saved.recipient}</Text><Text className="text-muted-foreground text-xs mt-1">{saved.address}</Text></Pressable>)}
            </View>}
            <Text className="text-foreground text-sm mt-3">Delivery address</Text>
            <TextInput accessibilityLabel="Delivery address" value={address} onChangeText={setAddress} editable={!isSubmitting} placeholder="House or building, street, barangay, city, and province" multiline maxLength={255} className="mt-2 rounded-xl border border-border bg-secondary px-3 py-3 text-foreground" />
            {preview.customer.default_delivery_address && <Text className="text-muted-foreground text-xs mt-2">Pre-filled from your profile. Changes here apply only to this order.</Text>}
          </View> : <View className="mt-3 border border-border bg-card p-4"><Text className="text-primary text-xs font-semibold">PICKUP LOCATION</Text><Text className="text-foreground font-semibold mt-2">{preview.pickup_location.name}</Text><Text className="text-muted-foreground text-sm mt-2">{preview.pickup_location.address}</Text>{preview.pickup_location.contact_number && <Text className="text-muted-foreground text-sm mt-2">{preview.pickup_location.contact_number}</Text>}{preview.pickup_location.operating_hours && <Text className="text-muted-foreground text-sm mt-2">{preview.pickup_location.operating_hours}</Text>}</View>}
          <Text className="text-primary text-xs font-semibold mt-6">STEP 3</Text>
          <Text className="text-foreground text-base font-bold mt-1">Payment method</Text>
          {preview.payment_methods.map((method) => {
            const available = method.available_for.includes(fulfillment);
            return <Pressable key={method.value} disabled={!available || isSubmitting} accessibilityRole="radio" accessibilityState={{ checked: payment === method.value, disabled: !available || isSubmitting }} onPress={() => { setPayment(method.value); setProof(null); }} className={`mt-3 rounded-xl border p-4 ${payment === method.value ? "border-primary bg-primary/10" : "border-border bg-card"}`} style={{ opacity: available ? 1 : 0.5 }}><Text className="text-foreground font-semibold">{payment === method.value ? "● " : "○ "}{method.label}</Text><Text className="text-muted-foreground text-xs mt-1">{!available ? "Available for pickup only." : method.requires_proof ? "Manual e-wallet payment with proof." : "Pay when you collect your order."}</Text></Pressable>;
          })}
          {selectedPayment?.requires_proof && <View>
            <View className="mt-3 border border-border bg-card p-4">
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
          <View className="mt-6 border border-border bg-card p-5">
            <Text className="text-primary text-xs font-semibold">CURRENT CART</Text>
            <Text className="text-foreground text-lg font-bold mt-2">Hardware summary</Text>
            {preview.cart.items.map((item) => <View key={item.id} className="flex-row justify-between gap-3 border-b border-border py-4"><View className="flex-1"><Text className="text-foreground font-semibold">{item.product.name}</Text><Text className="text-muted-foreground text-xs mt-1">{item.product.brand ? `${item.product.brand} · ` : ""}Qty {item.quantity}</Text></View><Text className="text-foreground font-semibold">{formatCheckoutAmount(item.line_total)}</Text></View>)}
            <View className="flex-row justify-between mt-4"><Text className="text-muted-foreground text-sm">Products</Text><Text className="text-foreground font-semibold">{preview.cart.item_count}</Text></View>
            <View className="flex-row justify-between mt-3"><Text className="text-muted-foreground text-sm">Units</Text><Text className="text-foreground font-semibold">{preview.cart.total_quantity}</Text></View>
            <View className="flex-row justify-between mt-4 border-t border-border pt-4"><Text className="text-foreground font-semibold">Cart total</Text><Text className="text-foreground text-xl font-bold">{formatCheckoutAmount(preview.cart.total)}</Text></View>
          </View>
          {error ? <Text className="text-danger mt-3">{error}</Text> : null}
          <Pressable disabled={isSubmitting} onPress={() => void submit()} className="mt-5 rounded-xl bg-primary px-5 py-3"><Text className="text-primary-foreground text-center">{isSubmitting ? "Placing order..." : "Place order"}</Text></Pressable>
          <Text className="text-muted-foreground text-xs text-center mt-3">Stock is deducted and your cart is cleared only after the complete order succeeds.</Text>
          <Pressable disabled={isSubmitting} onPress={() => router.navigate("/cart")} className="mt-4 rounded-xl border border-border p-3"><Text className="text-foreground text-center font-semibold">Back to cart</Text></Pressable>
        </View>}
      </ScrollView>
      <MockSignInSheet visible={isSignInOpen} onClose={() => setIsSignInOpen(false)} />
    </SafeAreaView>
  );
}
