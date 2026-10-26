import { useActiveFocusEffect } from "@/hooks/useActiveScreen";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, Text, TextInput, View, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCart } from "@/hooks/useCart";
import { useSession } from "@/hooks/useSession";
import { getSessionRevision } from "@/lib/api";
import { getProductById } from "@/lib/api";
import { cancelPlacedOrder, getOrderById, getOrderSnapshot, resubmitPaymentProof, requestOrderCancellation, retryHostedPayment, submitReturnRequest, withdrawReturnRequest, type OrderRecord } from "@/lib/orders";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "@/theme/ThemeProvider";
import * as Clipboard from "expo-clipboard";
import { useToast } from "@/hooks/useToast";
import { authenticatedMediaSource } from "@/lib/api";

const statusSteps = [
  { key: "pending", label: "Pending", detail: "Your order is awaiting staff processing." },
  { key: "processing", label: "Processing", detail: "The store is preparing your order." },
  { key: "completed", label: "Completed", detail: "Your order has been fulfilled." },
] as const;

export default function OrderDetailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { showToast } = useToast();
  const { addItem } = useCart();
  const { session } = useSession();
  const owner = session.mode === "customer" ? session.user.id : null;
  const [loadedOwner, setLoadedOwner] = useState(owner);
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [order, setOrder] = useState<OrderRecord | null>(() => id ? getOrderSnapshot(id) ?? null : null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(() => !id || !getOrderSnapshot(id));
  const [loadError, setLoadError] = useState(false);
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  const [isCopyingTrackingReference, setIsCopyingTrackingReference] = useState(false);
  const [returnDraft, setReturnDraft] = useState<{ itemId: number; itemName: string; maxQuantity: number } | null>(null);
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [returnReason, setReturnReason] = useState("");
  const [returnExplanation, setReturnExplanation] = useState("");
  const [isSubmittingReturn, setIsSubmittingReturn] = useState(false);
  const [refundProofUrl, setRefundProofUrl] = useState<string | null>(null);
  const uploadingProof = useRef(false);

  async function copyTrackingReference(reference: string) {
    if (isCopyingTrackingReference || !reference.trim()) return;
    setIsCopyingTrackingReference(true);
    try {
      await Clipboard.setStringAsync(reference);
      showToast("Tracking number copied");
    } catch {
      showToast("Could not copy tracking number", "error");
    } finally {
      setIsCopyingTrackingReference(false);
    }
  }
  async function replaceProof() {
    if (!order || uploadingProof.current) return;
    uploadingProof.current = true;
    const revision = getSessionRevision();
    setIsUploadingProof(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
      if (!result.canceled) {
        const proof = result.assets[0];
        if (revision !== getSessionRevision()) return;
        const updated = await resubmitPaymentProof(order.id, { uri: proof.uri, name: proof.fileName ?? "payment-proof.jpg", type: proof.mimeType ?? "image/jpeg" });
        if (revision === getSessionRevision()) setOrder(updated);
      }
    } catch (reason) { Alert.alert("Could not replace proof", reason instanceof Error ? reason.message : "Please try again."); }
    finally { uploadingProof.current = false; setIsUploadingProof(false); }
  }

  useActiveFocusEffect(useCallback(() => {
    let isActive = true;
    setLoadedOwner(owner);
    if (!id || owner === null) {
      setOrder(null);
      setIsLoadingOrder(false);
      return () => { isActive = false; };
    }
    setLoadError(false);
    const cached = getOrderSnapshot(id);
    setOrder(cached ?? null);
    setIsLoadingOrder(!cached);
    getOrderById(id, Boolean(cached?.payment.checkout_url)).then((loadedOrder) => {
      if (!isActive) return;
      setOrder(loadedOrder);
      setIsLoadingOrder(false);
    }).catch(() => {
      if (!isActive) return;
      setLoadError(true);
      setIsLoadingOrder(false);
    });
    return () => {
      isActive = false;
    };
  }, [id, owner]));

  const currentStepIndex = order ? statusSteps.findIndex((step) => step.key === order.statusValue) : -1;

  async function cancelOrder() {
    if (!order || !order.canCancel || isCancellingOrder) return;
    const revision = getSessionRevision();
    setIsCancellingOrder(true);
    try {
      const cancelledOrder = await cancelPlacedOrder(order.id);
      if (revision !== getSessionRevision()) return;
      setOrder(cancelledOrder);
      Alert.alert("Order cancelled", "Reserved stock has been released. The order remains in your history.");
    } catch (reason) {
      if (revision !== getSessionRevision()) return;
      const message = reason instanceof Error ? reason.message : "Please try again.";
      try {
        const latest = await getOrderById(order.id);
        if (revision === getSessionRevision() && latest) setOrder(latest);
      } catch { /* Keep the current order visible when refresh also fails. */ }
      Alert.alert("Couldn't cancel order", message);
    } finally {
      setIsCancellingOrder(false);
    }
  }

  function confirmCancelOrder() {
    Alert.alert(
      "Cancel this order?",
      "Reserved stock will be released. This order will remain in your order history.",
      [
        { text: "Keep order", style: "cancel" },
        { text: "Cancel order", style: "destructive", onPress: () => void cancelOrder() },
      ],
    );
  }

  function requestCancellation() {
    Alert.alert("Request cancellation", "Battlefront will review this request before changing order or payment status.", [
      { text: "Keep order", style: "cancel" },
      { text: "Submit request", onPress: () => { void requestOrderCancellation(order!.id).then(setOrder).catch((error) => Alert.alert("Could not request cancellation", error.message)); } },
    ]);
  }
  async function continuePayment() {
    if (!order) return;
    try {
      let result: { redirect_url?: string; status?: string } | undefined = order.payment.checkout_url ? { redirect_url: order.payment.checkout_url } : undefined;
      if (!result) {
        const retried = await retryHostedPayment(order.id);
        if (retried.payment?.status === "qrph_ready") {
          setOrder(await getOrderById(order.id, true));
          return;
        }
        result = retried.payment;
      }
      if (result?.redirect_url) await Linking.openURL(result.redirect_url);
      else Alert.alert("Payment update pending", "Check your order again shortly. Battlefront is reconciling the payment status.");
    } catch (error) { Alert.alert("Could not open payment", error instanceof Error ? error.message : "Please try again."); }
  }
  function requestReturn(itemId: number, itemName: string, quantity: number) {
    if (!order) return;
    setReturnDraft({ itemId, itemName, maxQuantity: Math.max(1, quantity) });
    setReturnQuantity(1);
    setReturnReason(order.returnReasonOptions?.[0]?.value ?? "");
    setReturnExplanation("");
  }

  async function submitReturn() {
    if (!order || !returnDraft || !returnReason || isSubmittingReturn) return;
    if (returnReason === "other" && returnExplanation.trim().length < 5) {
      Alert.alert("Add a short explanation", "For Other, enter at least five characters.");
      return;
    }
    setIsSubmittingReturn(true);
    try {
      await submitReturnRequest(order.id, { order_item_id: returnDraft.itemId, quantity: returnQuantity, reason_code: returnReason, reason: returnReason === "other" ? returnExplanation.trim() : undefined });
      setOrder(await getOrderById(order.id, true));
      setReturnDraft(null);
      showToast("Return request submitted");
    } catch (error) {
      Alert.alert("Could not request return", error instanceof Error ? error.message : "Please try again.");
    } finally { setIsSubmittingReturn(false); }
  }

  async function buyAgain() {
    if (!order?.productLines?.length || isReordering) return;
    setIsReordering(true);
    try {
      const loadedItems = await Promise.all(order.productLines.map(async (line) => {
        try {
          const product = await getProductById(line.productId);
          return product && (product.stockQuantity === undefined || product.stockQuantity > 0)
            ? { product, line }
            : null;
        } catch {
          return null;
        }
      }));
      const availableItems = loadedItems.filter((item): item is NonNullable<typeof item> => item !== null);
      let addedCount = 0;
      for (const { product, line } of availableItems) {
        if (await addItem(product, line.quantity, line.variant)) addedCount++;
      }
      const unavailableCount = order.productLines.length - addedCount;
      const message = unavailableCount > 0
        ? `${addedCount} item(s) added. ${unavailableCount} item(s) could not be added.`
        : `${addedCount} item(s) added to your cart.`;
      Alert.alert("Reorder ready", message, [
        { text: "Done", style: "cancel" },
        ...(availableItems.length > 0 ? [{ text: "View cart", onPress: () => router.push("/cart") }] : []),
      ]);
    } catch {
      Alert.alert("Couldn't reorder items", "Please try again.");
    } finally {
      setIsReordering(false);
    }
  }

  if (isLoadingOrder) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background">
        <Text className="text-muted-foreground text-sm">Loading order...</Text>
      </SafeAreaView>
    );
  }

  if (!order || owner === null || loadedOwner !== owner) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-foreground text-base font-semibold">{loadError ? "Could not load this order" : "Order not found"}</Text>
        <Pressable accessibilityRole="button" onPress={() => router.back()} className="mt-4 rounded-xl bg-primary px-5 py-3">
          <Text className="text-primary-foreground text-sm font-semibold">Back to orders</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <Modal visible={refundProofUrl !== null} animationType="fade" transparent onRequestClose={() => setRefundProofUrl(null)}>
        <View className="flex-1 items-center justify-center bg-black/80 p-5">
          <View className="w-full rounded-2xl border border-border bg-background p-4" style={{ maxWidth: 600, maxHeight: "90%" }}>
            <View className="mb-3 flex-row items-center justify-between"><Text className="text-foreground text-base font-semibold">Refund payment proof</Text><Pressable accessibilityLabel="Close payment proof" onPress={() => setRefundProofUrl(null)} className="h-10 w-10 items-center justify-center"><Ionicons name="close" size={22} color={colors.foreground} /></Pressable></View>
            {refundProofUrl ? <Image source={authenticatedMediaSource(refundProofUrl)} resizeMode="contain" accessibilityLabel="Refund payment proof image" style={{ width: "100%", height: 520 }} /> : null}
          </View>
        </View>
      </Modal>
      <Modal visible={Boolean(returnDraft)} animationType="slide" transparent onRequestClose={() => setReturnDraft(null)}>
        <View className="flex-1 justify-end bg-black/60">
          <View className="max-h-[85%] rounded-t-3xl border-t border-border bg-background px-5 pb-8 pt-5">
            <View className="mb-4 flex-row items-center justify-between">
              <View className="flex-1 pr-3"><Text className="text-foreground text-lg font-bold">Request a return</Text><Text className="mt-1 text-muted-foreground text-xs" numberOfLines={2}>{returnDraft?.itemName}</Text></View>
              <Pressable accessibilityLabel="Close return request" onPress={() => setReturnDraft(null)} className="h-10 w-10 items-center justify-center"><Ionicons name="close" size={22} color={colors.foreground} /></Pressable>
            </View>
            <Text className="text-foreground text-sm font-semibold">Quantity</Text>
            <View className="mt-2 flex-row items-center gap-3">
              <Pressable accessibilityLabel="Decrease return quantity" disabled={returnQuantity <= 1} onPress={() => setReturnQuantity((value) => Math.max(1, value - 1))} className="h-11 w-11 items-center justify-center rounded-lg border border-border"><Ionicons name="remove" size={18} color={colors.foreground} /></Pressable>
              <Text className="min-w-8 text-center text-foreground font-bold">{returnQuantity}</Text>
              <Pressable accessibilityLabel="Increase return quantity" disabled={returnQuantity >= (returnDraft?.maxQuantity ?? 1)} onPress={() => setReturnQuantity((value) => Math.min(returnDraft?.maxQuantity ?? 1, value + 1))} className="h-11 w-11 items-center justify-center rounded-lg border border-border"><Ionicons name="add" size={18} color={colors.foreground} /></Pressable>
              <Text className="text-muted-foreground text-xs">of {returnDraft?.maxQuantity} ordered</Text>
            </View>
            <Text className="mt-5 text-foreground text-sm font-semibold">Reason</Text>
            <ScrollView className="mt-2 max-h-44" keyboardShouldPersistTaps="handled">
              {(order.returnReasonOptions ?? []).map((option) => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: returnReason === option.value }} onPress={() => setReturnReason(option.value)} className={`mb-2 min-h-11 flex-row items-center gap-3 rounded-lg border px-3 ${returnReason === option.value ? "border-primary bg-primary/10" : "border-border"}`}><Ionicons name={returnReason === option.value ? "radio-button-on" : "radio-button-off"} size={18} color={returnReason === option.value ? colors.primary : colors.muted} /><Text className="text-foreground text-sm">{option.label}</Text></Pressable>)}
            </ScrollView>
            {returnReason === "other" ? <TextInput accessibilityLabel="Return reason explanation" value={returnExplanation} onChangeText={setReturnExplanation} placeholder="Explain the issue (at least five characters)" placeholderTextColor={colors.muted} multiline maxLength={2000} className="mt-2 min-h-20 rounded-xl border border-border bg-card p-3 text-foreground" /> : null}
            <Pressable accessibilityRole="button" accessibilityState={{ disabled: isSubmittingReturn }} disabled={isSubmittingReturn || !returnReason} onPress={() => void submitReturn()} className="mt-4 min-h-12 items-center justify-center rounded-xl bg-primary" style={{ opacity: isSubmittingReturn || !returnReason ? 0.6 : 1 }}><Text className="text-primary-foreground font-bold">{isSubmittingReturn ? "Submitting..." : "Submit return request"}</Text></Pressable>
          </View>
        </View>
      </Modal>
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <Pressable
          accessibilityLabel="Go back to orders"
          onPress={() => router.back()}
          hitSlop={10}
          className="w-9 h-9 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={22} color="#f8fafc" />
        </Pressable>
        <Text className="text-foreground text-lg font-semibold ml-2">Order details</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {loadError && <Text className="text-danger text-sm mb-3">Could not refresh this order. Showing saved details.</Text>}
        <View className="rounded-2xl border border-border bg-card p-4">
          <Text className="text-foreground text-xl font-bold">{order.reference}</Text>
          <Text className="text-muted-foreground text-xs mt-1">Placed {order.date}</Text>

          <View className="mt-4 flex-row items-center justify-between border-b border-border pb-3">
            <Text className="text-muted-foreground text-xs uppercase tracking-[0.12em]">Status</Text>
            <View className="rounded-full bg-primary/10 px-2 py-1">
              <Text className="text-primary text-[10px] font-bold uppercase tracking-[0.08em]">{order.status}</Text>
            </View>
          </View>

          {order.statusValue === "cancelled" ? (
            <View className="mt-4 flex-row items-center gap-2 rounded-xl border border-border bg-secondary p-3">
              <Ionicons name="close-circle-outline" size={19} color={colors.muted} />
              <Text className="flex-1 text-muted-foreground text-xs">This order was cancelled before packing.</Text>
            </View>
          ) : (
            <View className="mt-4 gap-3">
              {statusSteps.map((step, index) => {
                const isActive = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;

                return (
                  <View key={step.key} className="flex-row items-start gap-3">
                    <View className={`mt-1 h-4 w-4 rounded-full border ${isActive ? "bg-primary border-primary" : "bg-background border-border"}`} />
                    <View className="flex-1 pb-3 border-l border-border pl-4" style={{ marginLeft: -10 }}>
                      <Text className={`text-sm font-semibold ${isCurrent ? "text-foreground" : "text-muted-foreground"}`}>
                        {step.label}
                      </Text>
                      <Text className="text-muted-foreground text-xs mt-1">{step.detail}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {order.paymentRejection ? <View className="mt-4 rounded-xl border border-danger/40 bg-danger/10 p-4"><Text className="text-foreground text-sm font-semibold">Payment proof rejected</Text><Text className="text-muted-foreground text-xs mt-2">{order.paymentRejection.reason}</Text>{order.paymentRejection.note ? <Text className="text-muted-foreground text-xs mt-1">{order.paymentRejection.note}</Text> : null}</View> : null}
        {order.canResubmitProof ? <Pressable accessibilityRole="button" accessibilityState={{ disabled: isUploadingProof }} disabled={isUploadingProof} onPress={() => void replaceProof()} className="mt-3 min-h-12 justify-center rounded-xl bg-primary px-4"><Text className="text-center text-primary-foreground font-semibold">{isUploadingProof ? "Uploading proof..." : "Replace rejected payment proof"}</Text></Pressable> : null}
        {order.paymentNotice ? <Text className="text-muted-foreground mt-4">{order.paymentNotice}</Text> : null}
        {order.payment.checkout_url || order.payment.can_retry_hosted || order.payment.qr_can_retry || order.payment.can_retry ? <Pressable accessibilityRole="button" onPress={() => void continuePayment()} className="mt-3 min-h-12 justify-center rounded-xl bg-primary px-4"><Text className="text-center text-primary-foreground font-semibold">{order.payment.qr_can_retry ? "Generate QR code" : order.payment.can_retry ? "Retry bank payment" : order.payment.can_retry_hosted ? "Retry online payment" : "Continue payment"}</Text></Pressable> : null}
        {order.payment.qr_code_image_url ? <View className="mt-4 items-center rounded-xl border border-border bg-card p-4"><Text className="self-start text-foreground font-semibold">Scan to pay with QR Ph</Text><Image source={{ uri: order.payment.qr_code_image_url }} accessibilityLabel="PayMongo QR Ph payment code" resizeMode="contain" style={{ width: 240, height: 240, marginTop: 12 }} />{order.payment.qr_expires_at ? <Text className="mt-2 text-muted-foreground text-xs">Expires {new Date(order.payment.qr_expires_at).toLocaleString("en-PH")}</Text> : null}</View> : null}

        {order.canCancel && (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isCancellingOrder }}
            disabled={isCancellingOrder}
            onPress={confirmCancelOrder}
            className="mt-4 h-11 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-card"
            style={{ opacity: isCancellingOrder ? 0.55 : 1 }}
          >
            {isCancellingOrder ? <ActivityIndicator color={colors.muted} /> : <Ionicons name="close-circle-outline" size={17} color={colors.muted} />}
            <Text className="text-foreground text-sm font-semibold">Cancel order</Text>
          </Pressable>
        )}
        {order.canRequestCancellation ? <Pressable accessibilityRole="button" onPress={requestCancellation} className="mt-3 min-h-12 justify-center rounded-xl border border-border px-4"><Text className="text-center text-foreground font-semibold">Request cancellation review</Text></Pressable> : null}
        {order.canRequestReturn && order.productLines?.filter((line) => line.orderItemId && line.canRequestReturn).map((line) => <Pressable key={line.orderItemId} accessibilityRole="button" onPress={() => requestReturn(line.orderItemId!, line.productName ?? line.productId, line.remainingReturnable ?? line.quantity)} className="mt-2 min-h-12 justify-center rounded-xl border border-border px-4"><Text className="text-center text-foreground">Request return for {line.productName ?? line.productId} · {line.remainingReturnable ?? line.quantity} available</Text></Pressable>)}
        {order.canRequestReturn || order.returnRequests.length > 0 ? <View className="mt-4 rounded-xl border border-border bg-card p-4"><Text className="text-foreground font-semibold">Returns and refunds</Text><Text className="mt-1 text-muted-foreground text-xs">Requests are reviewed after the item is received. Approval and refunds are not guaranteed.</Text>{order.returnEligibility?.received_at ? <Text className="mt-2 text-muted-foreground text-xs">Received {new Date(order.returnEligibility.received_at).toLocaleDateString("en-PH")}.</Text> : <Text className="mt-2 text-muted-foreground text-xs">Receipt date unconfirmed; Battlefront will review eligibility.</Text>}{order.returnEligibility?.deadline_at ? <Text className="mt-1 text-muted-foreground text-xs">{order.returnEligibility.window_approved ? "Change-of-mind deadline" : `Proposed ${order.returnEligibility.window_days}-day deadline`}: {new Date(order.returnEligibility.deadline_at).toLocaleDateString("en-PH")}.</Text> : null}{order.returnRequests.some((request) => request.status?.value === "submitted") && order.returnInstructions ? <View className="mt-3 border-t border-border pt-3"><Text className="text-foreground text-sm font-medium">{order.returnInstructions.label}</Text><Text className="mt-1 text-muted-foreground text-xs leading-5">{order.returnInstructions.message}</Text>{order.returnInstructions.branch ? <Text className="mt-1 text-muted-foreground text-xs">{order.returnInstructions.branch.name} · {order.returnInstructions.branch.city} · {order.returnInstructions.branch.address}{order.returnInstructions.branch.contact_number ? ` · ${order.returnInstructions.branch.contact_number}` : ""}</Text> : null}</View> : null}</View> : null}
        {order.cancellation ? <View className="mt-4 border-t border-border pt-3"><Text className="text-foreground font-semibold">Cancellation request</Text><Text className="mt-1 text-muted-foreground">{order.cancellation.status?.label ?? order.cancellation.notice ?? "Under review"}</Text></View> : null}
        {order.returnRequests.map((request) => <View key={request.id} className="mt-4 border-t border-border pt-3"><Text className="text-foreground font-semibold">Return request</Text><Text className="mt-1 text-muted-foreground">{request.status?.label ?? "Submitted"} · {request.product?.name ?? "Item"} · Qty {request.quantity} · {request.reason_label ?? request.reason}</Text>{request.feedback ? <Text className="mt-1 text-muted-foreground">{request.feedback}</Text> : null}{request.can_withdraw ? <Pressable onPress={() => void withdrawReturnRequest(order.id, request.id).then(() => getOrderById(order.id, true)).then(setOrder).catch((error) => Alert.alert("Could not withdraw request", error.message))} className="mt-2 py-2"><Text className="text-primary">Withdraw return request</Text></Pressable> : null}</View>)}
        {order.refundPayments.map((refund) => <View key={refund.id} className="mt-4 border-t border-border pt-3"><Text className="text-foreground font-semibold">Refund payment · {refund.amount ? `₱${refund.amount}` : ""}</Text><Text className="mt-1 text-muted-foreground">{refund.payment_method ?? "Recorded"}{refund.paid_at ? ` · ${new Date(refund.paid_at).toLocaleDateString("en-PH")}` : ""}</Text>{refund.proof ? <Pressable accessibilityRole="button" onPress={() => setRefundProofUrl(refund.proof!.url)} className="mt-2 min-h-10 justify-center"><Text className="text-primary text-sm font-semibold">View payment proof</Text></Pressable> : <Text className="mt-2 text-muted-foreground text-xs">Payment proof unavailable. Contact Battlefront for help.</Text>}</View>)}

        <View className="mt-5 rounded-2xl border border-border bg-card p-4">
          <Text className="text-foreground text-base font-bold">Order summary</Text>
          <View className="mt-3 flex-row justify-between">
            <Text className="text-muted-foreground text-sm">Item</Text>
            <Text className="text-foreground text-sm">{order.items}</Text>
          </View>
          <View className="mt-2 flex-row justify-between">
            <Text className="text-muted-foreground text-sm">Amount</Text>
            <Text className="text-primary text-sm font-bold">{order.total}</Text>
          </View>
          {order.address ? <DetailRow label="Deliver to" value={`${order.address}${order.phone ? `\n${order.phone}` : ""}`} /> : null}
          {order.deliveryMethod ? <DetailRow label="Delivery" value={order.deliveryMethod} /> : null}
          {order.paymentMethod ? <DetailRow label="Payment" value={order.paymentMethod} /> : null}
          {order.paymentStatus ? <DetailRow label="Payment status" value={order.paymentStatus} /> : null}
          {order.productSubtotal ? <DetailRow label="Items subtotal" value={`₱${Number(order.productSubtotal).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`} /> : null}
          {order.deliveryFee ? <DetailRow label="Delivery fee" value={`₱${Number(order.deliveryFee).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`} /> : null}
        </View>

        {order.deliveryQuote ? <View className="mt-4 rounded-2xl border border-border bg-card p-4"><Text className="text-foreground text-base font-bold">Delivery estimate</Text><DetailRow label="Carrier" value={order.deliveryQuote.carrier.toUpperCase()} /><DetailRow label="Destination" value={order.deliveryQuote.destination} /><DetailRow label="Packing" value={order.deliveryQuote.packing_expectation} /><DetailRow label="Estimate" value={`${order.deliveryQuote.eta_min_days}–${order.deliveryQuote.eta_max_days} days`} />{order.deliveryQuote.is_demo && order.deliveryQuote.assumption_label ? <Text className="text-muted-foreground text-xs mt-2">{order.deliveryQuote.assumption_label}</Text> : null}<Text className="text-muted-foreground text-xs mt-2">{order.deliveryQuote.notice}</Text></View> : null}
        {order.shipment ? <View className="mt-4 rounded-2xl border border-border bg-card p-4">
          <Text className="text-foreground text-base font-bold">Shipment tracking</Text>
          <DetailRow label="Status" value={order.shipment.status.label} />
          {order.shipment.tracking_reference ? <View className="mt-3">
            <Text className="text-muted-foreground text-xs">Tracking reference</Text>
            <View className="mt-1 flex-row items-center gap-2">
              <Text selectable className="flex-1 text-foreground text-sm font-semibold">{order.shipment.tracking_reference}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel="Copy tracking number" accessibilityState={{ disabled: isCopyingTrackingReference }} disabled={isCopyingTrackingReference} onPress={() => void copyTrackingReference(order.shipment!.tracking_reference!)} className="min-h-10 flex-row items-center gap-2 rounded-lg border border-border bg-secondary px-3" style={({ pressed }) => ({ opacity: isCopyingTrackingReference ? 0.6 : pressed ? 0.7 : 1 })}>
                {isCopyingTrackingReference ? <ActivityIndicator size="small" color={colors.foreground} /> : <Ionicons name="copy-outline" size={16} color={colors.foreground} />}
                <Text className="text-foreground text-xs font-semibold">{isCopyingTrackingReference ? "Copying" : "Copy"}</Text>
              </Pressable>
            </View>
          </View> : null}
          {order.shipment.eta.estimated_delivery_start ? <DetailRow label="Estimated delivery" value={`${order.shipment.eta.estimated_delivery_start}${order.shipment.eta.estimated_delivery_end && order.shipment.eta.estimated_delivery_end !== order.shipment.eta.estimated_delivery_start ? ` – ${order.shipment.eta.estimated_delivery_end}` : ""}`} /> : null}
          {order.shipment.timeline.map((event) => <DetailRow key={`${event.status}-${event.occurred_at}`} label={event.label} value={new Date(event.occurred_at).toLocaleString("en-PH")} />)}
          <Text className="text-muted-foreground text-xs mt-2">{order.shipment.notice}</Text>
          {order.shipment.history_notice ? <Text className="text-muted-foreground text-xs mt-2">{order.shipment.history_notice}</Text> : null}
        </View> : null}
        {order.productLines && order.productLines.length > 0 && (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: isReordering }}
            disabled={isReordering}
            onPress={() => void buyAgain()}
            className="mt-4 h-11 flex-row items-center justify-center gap-2 rounded-xl bg-primary"
            style={{ opacity: isReordering ? 0.55 : 1 }}
          >
            {isReordering ? <ActivityIndicator color="#ffffff" /> : <Ionicons name="refresh-outline" size={17} color="#ffffff" />}
            <Text className="text-primary-foreground text-sm font-bold">Buy again</Text>
          </Pressable>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="mt-2 flex-row justify-between gap-4">
      <Text className="text-muted-foreground text-sm">{label}</Text>
      <Text className="flex-1 text-right text-foreground text-sm">{value}</Text>
    </View>
  );
}
