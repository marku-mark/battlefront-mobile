import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCart } from "@/hooks/useCart";
import { getProductById } from "@/lib/api";
import { getOrderReturnRequests, saveOrderReturnRequest, type OrderReturnRequest } from "@/lib/orderSupport";
import { cancelPlacedOrder, getOrderById, resubmitPaymentProof, type OrderRecord } from "@/lib/orders";
import * as ImagePicker from "expo-image-picker";
import { useTheme } from "@/theme/ThemeProvider";

const returnReasons = ["Item damaged", "Wrong item", "Changed my mind"];

const statusSteps = [
  { key: "pending", label: "Pending", detail: "Your order is awaiting staff processing." },
  { key: "processing", label: "Processing", detail: "The store is preparing your order." },
  { key: "completed", label: "Completed", detail: "Your order has been fulfilled." },
] as const;

export default function OrderDetailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { addItem } = useCart();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [order, setOrder] = useState<OrderRecord | null>(null);
  const [isLoadingOrder, setIsLoadingOrder] = useState(true);
  const [returnRequest, setReturnRequest] = useState<OrderReturnRequest | null>(null);
  const [isReturnFormOpen, setIsReturnFormOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState("");
  const [returnNote, setReturnNote] = useState("");
  const [isSavingReturn, setIsSavingReturn] = useState(false);
  const [returnError, setReturnError] = useState("");
  const [isCancellingOrder, setIsCancellingOrder] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [isUploadingProof, setIsUploadingProof] = useState(false);
  async function replaceProof() {
    if (!order || isUploadingProof) return;
    setIsUploadingProof(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
      if (!result.canceled) {
        const proof = result.assets[0];
        setOrder(await resubmitPaymentProof(order.id, { uri: proof.uri, name: proof.fileName ?? "payment-proof.jpg", type: proof.mimeType ?? "image/jpeg" }));
      }
    } catch (reason) { Alert.alert("Could not replace proof", reason instanceof Error ? reason.message : "Please try again."); }
    finally { setIsUploadingProof(false); }
  }

  useEffect(() => {
    let isActive = true;
    if (!id) {
      setOrder(null);
      setIsLoadingOrder(false);
      return () => { isActive = false; };
    }
    setIsLoadingOrder(true);
    Promise.all([getOrderById(id), getOrderReturnRequests()]).then(([loadedOrder, requests]) => {
      if (!isActive) return;
      setOrder(loadedOrder);
      setReturnRequest(requests.find((request) => request.orderId === id) ?? null);
      setIsLoadingOrder(false);
    }).catch(() => {
      if (!isActive) return;
      setOrder(null);
      setIsLoadingOrder(false);
    });
    return () => {
      isActive = false;
    };
  }, [id]);

  const currentStepIndex = order ? statusSteps.findIndex((step) => step.key === order.statusValue) : -1;

  async function submitReturnRequest() {
    if (!order || !selectedReason || isSavingReturn) return;
    setIsSavingReturn(true);
    setReturnError("");
    try {
      const requests = await saveOrderReturnRequest(order.id, selectedReason, returnNote);
      setReturnRequest(requests.find((request) => request.orderId === order.id) ?? null);
      setIsReturnFormOpen(false);
    } catch {
      setReturnError("Couldn't save your request. Please try again.");
    } finally {
      setIsSavingReturn(false);
    }
  }

  async function cancelOrder() {
    if (!order || order.status !== "Ordered" || isCancellingOrder) return;
    setIsCancellingOrder(true);
    try {
      const cancelledOrder = await cancelPlacedOrder(order.id);
      if (!cancelledOrder) {
        Alert.alert("Order can't be cancelled", "Only orders that haven't been packed can be cancelled.");
        return;
      }
      setOrder(cancelledOrder);
    } catch {
      Alert.alert("Couldn't cancel order", "Please try again.");
    } finally {
      setIsCancellingOrder(false);
    }
  }

  function confirmCancelOrder() {
    Alert.alert(
      "Cancel this order?",
      "This order has not been packed yet. You can place a new order later.",
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

  if (!order) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-background px-6">
        <Text className="text-foreground text-base font-semibold">Order not found</Text>
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
        <View className="rounded-2xl border border-border bg-card p-4">
          <Text className="text-foreground text-xl font-bold">{order.id}</Text>
          <Text className="text-muted-foreground text-xs mt-1">Placed {order.date}</Text>

          <View className="mt-4 flex-row items-center justify-between border-b border-border pb-3">
            <Text className="text-muted-foreground text-xs uppercase tracking-[0.12em]">Status</Text>
            <View className="rounded-full bg-primary/10 px-2 py-1">
              <Text className="text-primary text-[10px] font-bold uppercase tracking-[0.08em]">{order.status}</Text>
            </View>
          </View>

          {order.status === "Cancelled" ? (
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
        </View>

        {order.paymentNotice ? <Text className="text-muted-foreground mt-4">{order.paymentNotice}</Text> : null}
        {order.canResubmitProof ? <Pressable disabled={isUploadingProof} onPress={() => void replaceProof()} className="mt-4 rounded-xl bg-primary p-3"><Text className="text-primary-foreground">{isUploadingProof ? "Uploading proof..." : "Replace rejected payment proof"}</Text></Pressable> : null}
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

        {order.canReturn && returnRequest && (
          <View className="mt-4 rounded-xl border border-primary/30 bg-primary/10 p-4">
            <View className="flex-row items-center gap-2">
              <Ionicons name="checkmark-circle-outline" size={19} color={colors.primary} />
              <Text className="text-foreground text-sm font-semibold">Return requested</Text>
            </View>
            <Text className="text-muted-foreground text-xs mt-2">Reason: {returnRequest.reason}</Text>
            {returnRequest.note ? <Text className="text-muted-foreground text-xs mt-1">{returnRequest.note}</Text> : null}
            <Text className="text-muted-foreground text-[10px] mt-2">Saved on this device · {new Date(returnRequest.requestedAt).toLocaleDateString()}</Text>
          </View>
        )}

        {order.canReturn && !returnRequest && (
          <View className="mt-4 rounded-xl border border-border bg-card p-4">
            <Text className="text-foreground text-sm font-semibold">Need to return this order?</Text>
            <Text className="text-muted-foreground text-xs mt-1">Choose a reason to save a return request in this demo.</Text>
            {!isReturnFormOpen ? (
              <Pressable accessibilityRole="button" onPress={() => setIsReturnFormOpen(true)} className="mt-3 h-11 flex-row items-center justify-center gap-2 rounded-xl bg-primary">
                <Ionicons name="return-down-back-outline" size={17} color="#ffffff" />
                <Text className="text-primary-foreground text-sm font-bold">Request a return</Text>
              </Pressable>
            ) : (
              <View className="mt-3">
                <Text className="text-foreground text-xs font-semibold">Reason</Text>
                <View className="mt-2 flex-row flex-wrap gap-2">
                  {returnReasons.map((reason) => (
                    <Pressable
                      key={reason}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: selectedReason === reason }}
                      onPress={() => setSelectedReason(reason)}
                      className={`rounded-lg border px-3 py-2 ${selectedReason === reason ? "border-primary bg-primary/10" : "border-border bg-secondary"}`}
                    >
                      <Text className={`text-xs font-semibold ${selectedReason === reason ? "text-primary" : "text-foreground"}`}>{reason}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  accessibilityLabel="Optional return details"
                  value={returnNote}
                  onChangeText={setReturnNote}
                  placeholder="Add details (optional)"
                  maxLength={300}
                  multiline
                  textAlignVertical="top"
                  className="mt-3 min-h-20 rounded-xl border border-border bg-secondary px-3 py-3 text-foreground text-sm"
                />
                {returnError ? <Text className="text-danger text-xs mt-2">{returnError}</Text> : null}
                <View className="mt-3 flex-row gap-2">
                  <Pressable accessibilityRole="button" onPress={() => setIsReturnFormOpen(false)} className="h-11 flex-1 items-center justify-center rounded-xl border border-border bg-secondary">
                    <Text className="text-foreground text-sm font-semibold">Cancel</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !selectedReason || isSavingReturn }}
                    disabled={!selectedReason || isSavingReturn}
                    onPress={() => void submitReturnRequest()}
                    className="h-11 flex-1 items-center justify-center rounded-xl bg-primary"
                    style={{ opacity: !selectedReason || isSavingReturn ? 0.5 : 1 }}
                  >
                    {isSavingReturn ? <ActivityIndicator color="#ffffff" /> : <Text className="text-primary-foreground text-sm font-bold">Submit request</Text>}
                  </Pressable>
                </View>
              </View>
            )}
          </View>
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
