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

export default function CheckoutScreen() {
  const router = useRouter();
  const { session } = useSession();
  const { items, refreshCart } = useCart();
  const [preview, setPreview] = useState<Checkout | null>(null);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
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
    if (customerId === null || createdOrderId) return;
    getCheckout().then((result) => {
      if (!active) return;
      setPreview(result); setFullName(result.customer.name); setAddress(result.customer.default_delivery_address ?? "");
    }).catch((reason) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [customerId, items, createdOrderId]);
  const paymentOptions = preview?.payment_methods.filter((method) => method.available_for.includes(fulfillment)) ?? [];
  const selectedPayment = paymentOptions.find((method) => method.value === payment);
  async function chooseProof() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
      if (!result.canceled) setProof(result.assets[0]);
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
          {error ? <Pressable onPress={() => getCheckout().then(setPreview).catch((reason) => setError(reason.message))}><Text className="text-primary mt-4">Retry</Text></Pressable> : null}
        </View> : <View>
          <Text className="text-foreground text-base font-bold">Recipient</Text>
          <TextInput accessibilityLabel="Recipient name" value={fullName} onChangeText={setFullName} placeholder="Full name" className="mt-3 rounded-xl border border-border bg-secondary px-3 py-3 text-foreground" />
          <TextInput accessibilityLabel="Contact number" value={phone} onChangeText={setPhone} placeholder="Contact number" keyboardType="phone-pad" className="mt-3 rounded-xl border border-border bg-secondary px-3 py-3 text-foreground" />
          <Text className="text-foreground text-base font-bold mt-6">Fulfillment</Text>
          {preview.fulfillment_methods.map((method) => <Pressable key={method.value} onPress={() => { setFulfillment(method.value); setProof(null); setPayment(preview.payment_methods.find((option) => option.available_for.includes(method.value))?.value ?? ""); }} className="mt-3 rounded-xl border border-border bg-card p-4"><Text className="text-foreground">{fulfillment === method.value ? "● " : "○ "}{method.label}</Text></Pressable>)}
          {fulfillment === "delivery" ? <TextInput accessibilityLabel="Delivery address" value={address} onChangeText={setAddress} placeholder="Full delivery address" multiline className="mt-3 rounded-xl border border-border bg-secondary px-3 py-3 text-foreground" /> : <Text className="text-muted-foreground text-sm mt-3">{preview.pickup_location.name}{"\n"}{preview.pickup_location.address}{"\n"}{preview.pickup_location.operating_hours}</Text>}
          <Text className="text-foreground text-base font-bold mt-6">Payment</Text>
          {paymentOptions.map((method) => <Pressable key={method.value} onPress={() => { setPayment(method.value); setProof(null); }} className="mt-3 rounded-xl border border-border bg-card p-4"><Text className="text-foreground">{payment === method.value ? "● " : "○ "}{method.label}</Text></Pressable>)}
          {selectedPayment?.requires_proof && <View>
            <Text className="text-muted-foreground text-sm mt-3">{selectedPayment.payment_account?.is_demo ? "Demo account — do not send real money.\n" : ""}{selectedPayment.payment_account?.account_name}{"\n"}{selectedPayment.payment_account?.account_number}</Text>
            <Pressable onPress={() => void chooseProof()} className="mt-3 rounded-xl border border-border bg-secondary p-4"><Text className="text-foreground">{proof ? `Selected: ${proof.fileName ?? "payment proof"}` : "Choose payment proof image"}</Text></Pressable>
          </View>}
          <Text className="text-foreground text-lg font-bold mt-6">Total: ₱{Number(preview.cart.total).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</Text>
          {error ? <Text className="text-danger mt-3">{error}</Text> : null}
          <Pressable disabled={isSubmitting} onPress={() => void submit()} className="mt-5 rounded-xl bg-primary px-5 py-3"><Text className="text-primary-foreground text-center">{isSubmitting ? "Placing order..." : "Place order"}</Text></Pressable>
        </View>}
      </ScrollView>
      <MockSignInSheet visible={isSignInOpen} onClose={() => setIsSignInOpen(false)} />
    </SafeAreaView>
  );
}
