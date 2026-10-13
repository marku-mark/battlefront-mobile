import { useActiveFocusEffect } from "@/hooks/useActiveScreen";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCart } from "@/hooks/useCart";
import { useSession } from "@/hooks/useSession";
import { getSessionRevision } from "@/lib/api";
import { getProductById } from "@/lib/api";
import { cancelPlacedOrder, getOrderById, getOrderSnapshot, resubmitPaymentProof, type OrderRecord } from "@/lib/orders";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "@/theme/ThemeProvider";
import * as Clipboard from "expo-clipboard";
import { useToast } from "@/hooks/useToast";

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
    getOrderById(id).then((loadedOrder) => {
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

        {order.paymentRejection ? <View className="mt-4 rounded-xl border border-danger/40 bg-danger/10 p-4"><Text className="text-foreground text-sm font-semibold">Payment proof rejected</Text><Text className="text-muted-foreground text-xs mt-2">{order.paymentRejection.reason}</Text>{order.paymentRejection.note ? <Text className="text-muted-foreground text-xs mt-1">{order.paymentRejection.note}</Text> : null}</View> : null}
        {order.paymentNotice ? <Text className="text-muted-foreground mt-4">{order.paymentNotice}</Text> : null}
        {order.canResubmitProof ? <Pressable disabled={isUploadingProof} onPress={() => void replaceProof()} className="mt-4 rounded-xl bg-primary p-3"><Text className="text-primary-foreground">{isUploadingProof ? "Uploading proof..." : "Replace rejected payment proof"}</Text></Pressable> : null}
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
