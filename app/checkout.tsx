import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useActiveFocusEffect } from "@/hooks/useActiveScreen";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { MockSignInSheet } from "@/components/account/MockSignInSheet";
import { useCart } from "@/hooks/useCart";
import { useSession } from "@/hooks/useSession";
import { getCart, getCheckout, getDeliveryLocations, getDeliveryQuote, getNegrosDeliveryLocations, type Checkout, type SelectedDeliveryQuote } from "@/lib/api";
import { placeOrder } from "@/lib/orders";
import { loadSavedAddresses, persistSavedAddresses, type SavedAddress } from "@/lib/savedAddresses";
import { checkoutRecipient, defaultHostedPayment, isPaymentAllowedByQuote, paymentForAvailableMethods, paymentForFulfillment, paymentProofError, formatCheckoutAmount, checkoutDetailsError } from "@/lib/checkoutForm";
import { DeliveryAddressFields } from "@/components/addresses/DeliveryAddressFields";
import { EMPTY_DELIVERY_ADDRESS, isCompleteDeliveryAddress, formatDeliveryAddress, type DeliveryBarangay, type DeliveryLocation } from "@/lib/deliveryAddress";
import { getLocalUserId } from "@/lib/api";
import * as Crypto from "expo-crypto";

export default function CheckoutScreen() {
  const router = useRouter();
  const { cart_item_ids: selectedIdsParam } = useLocalSearchParams<{ cart_item_ids?: string }>();
  const { session } = useSession();
  const { refreshCart } = useCart();
  const [preview, setPreview] = useState<Checkout | null>(null);
  const [selectedCartItemIds, setSelectedCartItemIds] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [addressLabel, setAddressLabel] = useState("");
  const [location, setLocation] = useState(EMPTY_DELIVERY_ADDRESS);
  const [locations, setLocations] = useState<DeliveryLocation[]>([]);
  const [liveQuote, setLiveQuote] = useState<SelectedDeliveryQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [checkoutRetry, setCheckoutRetry] = useState(0);
  const [fulfillment, setFulfillment] = useState("pickup");
  const [deliveryDestination, setDeliveryDestination] = useState("");
  const [payment, setPayment] = useState("cod");
  const [hostedMethod, setHostedMethod] = useState("qrph");
  const [proof, setProof] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitting = useRef(false);
  const checkoutSubmissionKey = useRef(Crypto.randomUUID());
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const customerId = session.mode === "customer" ? session.user.id : null;
  useEffect(() => { setCreatedOrderId(null); }, [customerId]);
  const initializedCustomer = useRef<number | null>(null);
  const lastPreviewAt = useRef(0);
  const lastSelectedIdsParam = useRef<string | undefined>(undefined);
  useEffect(() => {
    initializedCustomer.current = null; lastPreviewAt.current = 0; lastSelectedIdsParam.current = undefined;
    setPreview(null); setError("");
    setSelectedCartItemIds([]);
    setSavedAddresses([]);
    setAddressLabel(""); setLocation(EMPTY_DELIVERY_ADDRESS); setLocations([]); setLiveQuote(null); setQuoteError(""); setAddressError(""); setIsSavingAddress(false);
    setFullName(""); setPhone(""); setAddress(""); setProof(null); setFulfillment("pickup"); setDeliveryDestination(""); setPayment("cod"); setHostedMethod("qrph"); checkoutSubmissionKey.current = Crypto.randomUUID();
  }, [customerId, createdOrderId, checkoutRetry]);
  useActiveFocusEffect(useCallback(() => {
    let active = true;
    if (customerId === null || createdOrderId) return;
    if (initializedCustomer.current === customerId && lastSelectedIdsParam.current === selectedIdsParam && Date.now() - lastPreviewAt.current < 30_000) return;
    Promise.all([getCart(true), loadSavedAddresses(), getNegrosDeliveryLocations()]).then(async ([cart, addresses, negrosLocations]) => {
      if (!active) return;
      const requestedIds = typeof selectedIdsParam === "string" ? selectedIdsParam.split(",").map(Number).filter((id) => Number.isInteger(id) && id > 0) : [];
      const ids = requestedIds.length > 0 ? cart.items.filter((item) => requestedIds.includes(item.id)).map((item) => item.id) : cart.items.map((item) => item.id);
      if (requestedIds.length > 0 && ids.length !== new Set(requestedIds).size) throw new Error("Your selected cart items changed. Return to cart and review your selection.");
      setSelectedCartItemIds(ids);
      if (ids.length === 0) { setError("Your cart is empty."); return; }
      const result = await getCheckout(ids);
      if (!active) return;
      const nextLocations: DeliveryLocation[] = negrosLocations.map((city) => ({
        ...city, barangays: result.delivery_locations.find((legacy) => legacy.code === city.code)?.barangays ?? [],
      }));
      setLocations(nextLocations);
      const recipient = checkoutRecipient(result.customer, addresses);
      setPreview(result); setSavedAddresses(addresses);
      if (initializedCustomer.current !== customerId) {
        const selectedSavedAddress = addresses.find((entry) => entry.address === recipient.address);
        const prefill = selectedSavedAddress?.delivery_destination && selectedSavedAddress.delivery_barangay_code && selectedSavedAddress.delivery_address_details
          ? { delivery_destination: selectedSavedAddress.delivery_destination, delivery_barangay_code: selectedSavedAddress.delivery_barangay_code, delivery_address_details: selectedSavedAddress.delivery_address_details }
          : result.delivery_address_prefill;
        const legacyLocation = result.delivery_locations.find((item) => item.destination === prefill.delivery_destination);
        const selectedLocation = { ...prefill, delivery_destination: legacyLocation?.code ?? prefill.delivery_destination };
        const formattedAddress = formatDeliveryAddress(selectedLocation, nextLocations);
        setFullName(recipient.name); setPhone(recipient.phone); setAddress(formattedAddress); setLocation(selectedLocation);
        setDeliveryDestination(selectedLocation.delivery_destination);
        initializedCustomer.current = customerId;
      }
      lastPreviewAt.current = Date.now();
      lastSelectedIdsParam.current = selectedIdsParam;
    }).catch((reason) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [customerId, createdOrderId, checkoutRetry, selectedIdsParam]));
  useEffect(() => {
    const cityCode = location.delivery_destination;
    if (!/^\d{10}$/.test(cityCode) || !locations.some((item) => item.code === cityCode)) return;
    if (locations.find((item) => item.code === cityCode)?.barangays.length) return;
    let active = true;
    void getDeliveryLocations<DeliveryBarangay>("barangays", cityCode).then((barangays) => {
      if (active) setLocations((current) => current.map((item) => item.code === cityCode ? { ...item, barangays } : item));
    }).catch((reason) => { if (active) setAddressError(reason instanceof Error ? reason.message : "Could not load barangays."); });
    return () => { active = false; };
  }, [location.delivery_destination, locations]);
  useEffect(() => {
    setAddress(formatDeliveryAddress(location, locations));
  }, [location, locations]);
  useEffect(() => {
    const cityCode = location.delivery_destination;
    if (fulfillment !== "delivery" || !/^\d{10}$/.test(cityCode) || selectedCartItemIds.length === 0) { setLiveQuote(null); setQuoteLoading(false); return; }
    let active = true;
    setQuoteLoading(true); setQuoteError(""); setLiveQuote(null);
    void getDeliveryQuote(cityCode, selectedCartItemIds).then((result) => {
      if (!active) return;
      if (result.available && result.quote?.order_placement_allowed) setLiveQuote(result.quote);
      else setQuoteError(result.notice ?? "Delivery is unavailable for this destination.");
    }).catch((reason) => { if (active) setQuoteError(reason instanceof Error ? reason.message : "Could not load the delivery quote."); })
      .finally(() => { if (active) setQuoteLoading(false); });
    return () => { active = false; };
  }, [fulfillment, location.delivery_destination, selectedCartItemIds.join(",")]);
  const visiblePreview = initializedCustomer.current === customerId && lastSelectedIdsParam.current === selectedIdsParam ? preview : null;
  const paymentOptions = visiblePreview?.payment_methods.filter((method) => method.available_for.includes(fulfillment) && isPaymentAllowedByQuote(method.value, fulfillment === "delivery" ? liveQuote?.payment_methods ?? null : null)) ?? [];
  const selectedPayment = paymentOptions.find((method) => method.value === payment);
  const selectedQuote = fulfillment === "delivery" ? liveQuote : visiblePreview?.pickup_quote;
  const deliveryQuote = fulfillment === "delivery" ? liveQuote : null;
  const selectedLocation = locations.find((item) => item.code === location.delivery_destination);
  const addressIsComplete = isCompleteDeliveryAddress(location, locations);
  useEffect(() => {
    if (!visiblePreview) return;
    setHostedMethod((current) => defaultHostedPayment(visiblePreview.paymongo_hosted_methods ?? [], current));
    const allowedValues = fulfillment === "delivery" && liveQuote ? liveQuote.payment_methods : null;
    const nextPayment = paymentForAvailableMethods(visiblePreview.payment_methods, fulfillment, allowedValues, payment);
    if (nextPayment !== payment) {
      setPayment(nextPayment);
      setProof(null);
    }
  }, [visiblePreview, fulfillment, liveQuote?.payment_methods.join(","), payment]);
  const cannotSubmit = isSubmitting || isSavingAddress || quoteLoading || selectedCartItemIds.length === 0 || !visiblePreview || !selectedQuote || !selectedPayment || (fulfillment === "delivery" && !addressIsComplete);
  async function saveAddress() {
    if (isSavingAddress || customerId === null) return;
    if (!addressLabel.trim() || !fullName.trim() || !phone.trim() || !visiblePreview || !addressIsComplete) {
      setAddressError("Complete the label, recipient, phone, destination, barangay, and street details."); return;
    }
    const formatted = formatDeliveryAddress(location, locations);
    if (formatted.length > 255) { setAddressError("Keep the complete address within 255 characters."); return; }
    const existing = savedAddresses.find((entry) => entry.label.toLowerCase() === addressLabel.trim().toLowerCase());
    const entry: SavedAddress = { ...location, id: existing?.id ?? `address-${Date.now()}`, label: addressLabel.trim(), recipient: fullName.trim(), phone: phone.trim(), address: formatted };
    const next = [entry, ...savedAddresses.filter((saved) => saved.id !== entry.id)];
    setIsSavingAddress(true); setAddressError("");
    try {
      await persistSavedAddresses(next);
      if (getLocalUserId() !== customerId) return;
      setSavedAddresses(next); setAddress(formatted);
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
    if (submitting.current || createdOrderId || isSavingAddress || selectedCartItemIds.length === 0 || !visiblePreview || !selectedPayment) return;
      const addressComplete = addressIsComplete;
      const validation = checkoutDetailsError({ name: fullName, phone, fulfillment, destination: deliveryDestination, address: addressComplete ? address : "", editingAddress: false, requiresProof: selectedPayment.requires_proof, hasProof: Boolean(proof) });
    if (validation) { setError(validation); return; }
    if (!selectedQuote) { setError("Select an available delivery destination."); return; }
    submitting.current = true;
    setIsSubmitting(true); setError("");
    try {
      const result = await placeOrder({ cart_item_ids: selectedCartItemIds, recipient_name: fullName.trim(), contact_number: phone.trim(), fulfillment_method: fulfillment,
        payment_method: payment,
        hosted_payment_method: selectedPayment.value === "online" ? hostedMethod : undefined,
        payment_channel: selectedPayment.value === "online" ? "hosted_checkout" : undefined,
        checkout_submission_key: selectedPayment.value === "online" ? checkoutSubmissionKey.current : undefined,
        delivery_destination: fulfillment === "delivery" ? location.delivery_destination : undefined,
        delivery_region_code: fulfillment === "delivery" ? selectedLocation?.region_code : undefined,
        delivery_province_code: fulfillment === "delivery" ? selectedLocation?.province?.code ?? null : undefined,
        delivery_city_code: fulfillment === "delivery" ? selectedLocation?.code : undefined,
        delivery_barangay_code: fulfillment === "delivery" ? location.delivery_barangay_code : undefined,
        delivery_address_details: fulfillment === "delivery" ? location.delivery_address_details.trim() : undefined,
        payment_proof: selectedPayment.requires_proof && proof ? { uri: proof.uri, name: proof.fileName ?? "payment-proof.jpg", type: proof.mimeType ?? "image/jpeg" } : undefined });
      if (getLocalUserId() !== customerId) return;
      setCreatedOrderId(result.order.id);
      void refreshCart().catch(() => undefined);
      if (result.redirectUrl) {
        try { await Linking.openURL(result.redirectUrl); }
        catch { setError("Order placed. Open My orders and use Continue payment to finish checkout."); }
      } else if (result.reconciliationPending) setError("Order placed. Payment setup is still being confirmed; check My orders shortly.");
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
          <Text className="mt-2 text-muted-foreground">Your order is saved. Continue payment from the order page if payment is still due.</Text>
          {error ? <Text accessibilityRole="alert" className="mt-2 text-danger">{error}</Text> : null}
          <Pressable onPress={() => router.replace({ pathname: "/orders/[id]", params: { id: createdOrderId } })} className="mt-5 rounded-xl bg-primary px-5 py-3"><Text className="text-primary-foreground">View order</Text></Pressable>
        </View> : session.mode === "guest" ? <Pressable onPress={() => setIsSignInOpen(true)} className="rounded-xl bg-primary px-5 py-3"><Text className="text-primary-foreground">Sign in to continue</Text></Pressable> : !visiblePreview ? <View>
          {error ? <Text accessibilityRole="alert" className="text-danger">{error}</Text> : <ActivityIndicator />}
          {error ? <Pressable onPress={() => setCheckoutRetry((current) => current + 1)}><Text className="text-primary mt-4">Retry</Text></Pressable> : null}
        </View> : <View>
          <View className="mb-6 border-b border-border pb-5"><Text className="text-foreground text-xl font-bold">Review your order</Text><Text className="text-muted-foreground text-sm mt-2">Complete each step below. Only the items selected in your cart will be purchased.</Text></View>
          <Text className="text-primary text-xs font-semibold">STEP 1</Text>
          <Text className="text-foreground text-base font-bold mt-1">Recipient details</Text>
          <Text className="text-foreground text-sm mt-3">Recipient name</Text>
          <TextInput accessibilityLabel="Recipient name" value={fullName} onChangeText={setFullName} editable={!isSubmitting && !isSavingAddress} maxLength={255} autoComplete="name" placeholder="Full name" className="mt-2 rounded-xl border border-border bg-secondary px-3 py-3 text-foreground" />
          <Text className="text-foreground text-sm mt-3">Contact number</Text>
          <TextInput accessibilityLabel="Contact number" value={phone} onChangeText={setPhone} editable={!isSubmitting && !isSavingAddress} maxLength={20} autoComplete="tel" placeholder="e.g. 0917 123 4567" keyboardType="phone-pad" className="mt-2 rounded-xl border border-border bg-secondary px-3 py-3 text-foreground" />
          <Text className="text-primary text-xs font-semibold mt-6">STEP 2</Text>
          <Text className="text-foreground text-base font-bold mt-1">Fulfillment method</Text>
          {visiblePreview.fulfillment_methods.map((method) => <Pressable key={method.value} disabled={isSubmitting} accessibilityRole="radio" accessibilityState={{ checked: fulfillment === method.value, disabled: isSubmitting }} onPress={() => { const next = paymentForFulfillment(visiblePreview.payment_methods, method.value, payment); setFulfillment(method.value); if (method.value === "pickup") { setDeliveryDestination(""); setLocation((current) => ({ ...current, delivery_destination: "", delivery_barangay_code: "" })); } if (next !== payment) { setProof(null); setPayment(next); } }} className={`mt-3 rounded-xl border p-4 ${fulfillment === method.value ? "border-primary bg-primary/10" : "border-border bg-card"}`}><Text className="text-foreground font-semibold">{fulfillment === method.value ? "● " : "○ "}{method.label}</Text><Text className="text-muted-foreground text-xs mt-1">{method.value === "pickup" ? "Collect your order from Battlefront." : "Send the order to your supplied address."}</Text></Pressable>)}
          {fulfillment === "delivery" ? <View>
            <DeliveryAddressFields value={location} locations={locations} onChange={(next) => { setLocation(next); setDeliveryDestination(next.delivery_destination); setAddress(formatDeliveryAddress(next, locations)); setAddressError(""); }} disabled={isSubmitting || isSavingAddress} />
            {visiblePreview.customer.default_delivery_address && <Text className="mt-2 text-muted-foreground text-xs">Saved profile address: {visiblePreview.customer.default_delivery_address}. Confirm the destination and enter the street details above.</Text>}
            {quoteLoading && <Text className="mt-3 text-muted-foreground text-sm">Loading delivery quote…</Text>}
            {quoteError && <Text accessibilityRole="alert" className="mt-3 text-danger text-sm">{quoteError}</Text>}
            {addressError && <Text accessibilityRole="alert" className="mt-3 text-danger text-sm">{addressError}</Text>}
            {deliveryQuote && <View className="mt-3 rounded-xl border border-border bg-secondary p-4">
              <Text className="text-foreground font-semibold">{deliveryQuote.pricing_configured ? `${deliveryQuote.carrier?.toUpperCase()} delivery estimate` : "Delivery arrangement pending"}</Text>
              {deliveryQuote.pricing_configured && <Text className="text-muted-foreground text-sm mt-2">{deliveryQuote.packing_expectation} · {deliveryQuote.preparation_days} day{deliveryQuote.preparation_days === 1 ? "" : "s"} preparation</Text>}
              {deliveryQuote.pricing_configured && deliveryQuote.base_fee && deliveryQuote.handling_surcharge && <Text className="text-muted-foreground text-sm mt-1">Base fee {formatCheckoutAmount(deliveryQuote.base_fee)} + handling {formatCheckoutAmount(deliveryQuote.handling_surcharge)}</Text>}
              {deliveryQuote.estimated_delivery_start && <Text className="text-foreground text-sm mt-2">Estimated delivery: {deliveryQuote.estimated_delivery_start}{deliveryQuote.estimated_delivery_end !== deliveryQuote.estimated_delivery_start ? ` – ${deliveryQuote.estimated_delivery_end}` : ""}</Text>}
              <Text className="text-muted-foreground text-xs mt-2">{deliveryQuote.notice}</Text>
              {deliveryQuote.is_demo && <Text className="text-muted-foreground text-xs mt-2">{deliveryQuote.assumption_label}</Text>}
            </View>}
            {savedAddresses.length > 0 && <View className="mt-3">
              <Text className="text-foreground text-sm font-semibold">Use a saved address</Text>
              {savedAddresses.map((saved) => <Pressable key={saved.id} disabled={isSubmitting || isSavingAddress} onPress={() => { const legacy = visiblePreview.delivery_locations.find((item) => item.destination === saved.delivery_destination); const next = { delivery_destination: legacy?.code ?? saved.delivery_destination ?? "", delivery_barangay_code: saved.delivery_barangay_code ?? "", delivery_address_details: saved.delivery_address_details ?? "" }; setAddress(saved.address); setFullName(saved.recipient); setPhone(saved.phone); setLocation(next); setDeliveryDestination(next.delivery_destination); }} className="mt-2 rounded-xl border border-border bg-card p-3"><Text className="text-foreground text-sm">{saved.label} · {saved.recipient}</Text><Text className="text-muted-foreground text-xs mt-1">{saved.address}</Text></Pressable>)}
            </View>}
            <TextInput accessibilityLabel="Saved address label" value={addressLabel} onChangeText={setAddressLabel} editable={!isSavingAddress} placeholder="Address label (required to save)" className="mt-4 h-11 rounded-lg border border-border bg-secondary px-3 text-foreground text-sm" />
            <Pressable disabled={isSavingAddress || !addressIsComplete} onPress={() => void saveAddress()} className="mt-2 rounded-xl border border-border bg-card p-3" style={{ opacity: isSavingAddress || !addressIsComplete ? 0.5 : 1 }}><Text className="text-foreground text-center text-sm font-semibold">{isSavingAddress ? "Saving address..." : "Save address on this device"}</Text></Pressable>
            <Text className="text-foreground text-sm mt-3">Delivery address</Text>
            <Text className="text-foreground mt-2">{address || "Add your delivery address above."}</Text>
            <Text className="text-muted-foreground text-xs mt-2">Selected from your saved details. Choose another address above if needed.</Text>
          </View> : <View className="mt-3 rounded-2xl border border-border bg-card p-4"><Text className="text-primary text-xs font-semibold">PICKUP LOCATION</Text><Text className="text-foreground font-semibold mt-2">{visiblePreview.pickup_location.name}</Text><Text className="text-muted-foreground text-sm mt-2">{visiblePreview.pickup_location.address}</Text>{visiblePreview.pickup_location.contact_number && <Text className="text-muted-foreground text-sm mt-2">{visiblePreview.pickup_location.contact_number}</Text>}{visiblePreview.pickup_location.operating_hours && <Text className="text-muted-foreground text-sm mt-2">{visiblePreview.pickup_location.operating_hours}</Text>}</View>}
          <Text className="text-primary text-xs font-semibold mt-6">STEP 3</Text>
          <Text className="text-foreground text-base font-bold mt-1">Payment method</Text>
          {visiblePreview.payment_methods.map((method) => {
            const available = method.available_for.includes(fulfillment) && isPaymentAllowedByQuote(method.value, fulfillment === "delivery" ? liveQuote?.payment_methods ?? null : null);
            if (method.value === "online" && !visiblePreview.paymongo_hosted_methods?.length && !method.requires_proof) return null;
            if (method.requires_proof && visiblePreview.paymongo_hosted_methods?.length) return null;
            return <Pressable key={method.value} disabled={!available || isSubmitting} accessibilityRole="radio" accessibilityState={{ checked: payment === method.value && available, disabled: !available || isSubmitting }} onPress={() => { setPayment(method.value); setProof(null); }} className={`mt-3 rounded-xl border p-4 ${payment === method.value && available ? "border-primary bg-primary/10" : "border-border bg-card"}`} style={{ opacity: available ? 1 : 0.5 }}><Text className="text-foreground font-semibold">{payment === method.value && available ? "● " : "○ "}{method.label}</Text><Text className="text-muted-foreground text-xs mt-1">{!available ? "Unavailable for this fulfillment or destination." : method.requires_proof ? "Manual e-wallet payment with proof." : method.value === "cod" ? "Pay upon delivery." : "Pay when you collect your order."}</Text></Pressable>;
          })}
          {selectedPayment?.value === "online" && (visiblePreview.paymongo_hosted_methods ?? []).length > 0 ? <View className="mt-3"><Text className="text-muted-foreground text-sm">Online payment method</Text><View className="mt-2 flex-row flex-wrap gap-2">{visiblePreview.paymongo_hosted_methods?.map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: hostedMethod === value }} onPress={() => setHostedMethod(defaultHostedPayment(visiblePreview.paymongo_hosted_methods ?? [], value))} className={`rounded-lg border px-3 py-2 ${hostedMethod === value ? "border-primary bg-primary/10" : "border-border"}`}><Text className="text-foreground">{({ qrph: "QR Ph", card: "Card", gcash: "GCash", paymaya: "Maya" } as Record<string, string>)[value] ?? value}</Text></Pressable>)}</View><Text className="mt-2 text-muted-foreground text-xs">Payment is confirmed by Battlefront through PayMongo.</Text></View> : null}
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
            <Text className="text-primary text-xs font-semibold">STEP 4</Text>
            <Text className="text-foreground text-lg font-bold mt-2">Review selected items and total</Text>
            <Text className="text-muted-foreground text-xs mt-1">Only the items selected in your cart are included.</Text>
            {visiblePreview.cart.items.map((item) => <View key={item.id} className="flex-row justify-between gap-3 border-b border-border py-4"><View className="flex-1"><Text className="text-foreground font-semibold">{item.product.name}</Text><Text className="text-muted-foreground text-xs mt-1">{item.product.brand ? `${item.product.brand} · ` : ""}Qty {item.quantity}</Text></View><Text className="text-foreground font-semibold">{formatCheckoutAmount(item.line_total)}</Text></View>)}
            <View className="flex-row justify-between mt-4"><Text className="text-muted-foreground text-sm">Products</Text><Text className="text-foreground font-semibold">{visiblePreview.cart.item_count}</Text></View>
            <View className="flex-row justify-between mt-3"><Text className="text-muted-foreground text-sm">Units</Text><Text className="text-foreground font-semibold">{visiblePreview.cart.total_quantity}</Text></View>
            <View className="flex-row justify-between mt-4 border-t border-border pt-4"><Text className="text-muted-foreground text-sm">Product subtotal</Text><Text className="text-foreground font-semibold">{formatCheckoutAmount(visiblePreview.pickup_quote.product_subtotal)}</Text></View>
            <View className="flex-row justify-between mt-3"><Text className="text-muted-foreground text-sm">Delivery fee</Text><Text className="text-foreground font-semibold">{fulfillment === "delivery" && deliveryQuote && !deliveryQuote.pricing_configured ? "To be confirmed" : selectedQuote ? formatCheckoutAmount(selectedQuote.delivery_fee) : "Select destination"}</Text></View>
            <View className="flex-row justify-between mt-4 border-t border-border pt-4"><Text className="text-foreground font-semibold">Final total</Text><Text className="text-foreground text-xl font-bold">{selectedQuote ? formatCheckoutAmount(selectedQuote.total) : "—"}</Text></View>
            <Text className="mt-4 text-muted-foreground text-xs">{fulfillment === "pickup" ? `Pickup at ${visiblePreview.pickup_location.name}` : addressIsComplete ? `Deliver to ${address}` : "Complete your delivery address above"} · {selectedPayment?.label ?? "Choose payment above"}</Text>
          </View>

          <Text className="text-muted-foreground text-xs text-center mt-3">Review your details before placing your order.</Text>
          <Pressable disabled={isSubmitting} onPress={() => router.navigate("/cart")} className="mt-4 rounded-xl border border-border p-3"><Text className="text-foreground text-center font-semibold">Back to cart</Text></Pressable>
        </View>}
      </ScrollView>
      {session.mode === "customer" && !createdOrderId && <View className="rounded-t-2xl border-t border-border bg-card px-4 py-3">
        {visiblePreview && <View className="flex-row flex-wrap items-center justify-between gap-2 mb-1"><Text className="text-muted-foreground text-sm">{visiblePreview.cart.item_count} selected · Final total</Text><Text className="text-foreground text-xl font-bold">{selectedQuote ? formatCheckoutAmount(selectedQuote.total) : "Select destination"}</Text></View>}
        {visiblePreview && <Text className="mb-3 text-muted-foreground text-xs">{selectedPayment?.requires_proof ? "Payment proof is reviewed manually after placement." : "Follow your order status in My orders after placement."}</Text>}
        {visiblePreview && error && <Text accessibilityRole="alert" className="text-danger text-sm mb-2">{error}</Text>}
        <Pressable accessibilityRole="button" accessibilityState={{ busy: isSubmitting, disabled: cannotSubmit }} disabled={cannotSubmit} onPress={() => void submit()} className="min-h-12 rounded-xl bg-primary px-5 py-3" style={({ pressed }) => ({ opacity: cannotSubmit ? 0.5 : pressed ? 0.8 : 1 })}><Text className="text-primary-foreground text-center font-semibold">{isSubmitting ? "Placing order…" : "Place order"}</Text></Pressable>
      </View>}
      </KeyboardAvoidingView>
      <MockSignInSheet visible={isSignInOpen} onClose={() => setIsSignInOpen(false)} />
    </SafeAreaView>
  );
}
