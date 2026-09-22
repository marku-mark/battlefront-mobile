import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useCart } from "@/hooks/useCart";

function formatPrice(value: number): string {
  return `₱${value.toLocaleString("en-PH")}`;
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { items, subtotal, clearCart } = useCart();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const shippingFee = subtotal > 5000 ? 0 : 150;
  const total = subtotal + shippingFee;

  function handlePlaceOrder() {
    if (!fullName.trim() || !phone.trim() || !address.trim()) {
      Alert.alert("Missing details", "Please complete your name, phone number, and delivery address.");
      return;
    }

    Alert.alert(
      "Order placed",
      "Your order has been recorded for this demo. Payment and order tracking will be connected later.",
      [{ text: "Back to home", onPress: () => { clearCart(); router.replace("/"); } }]
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="flex-row items-center px-4 py-3 border-b border-border">
          <Pressable onPress={() => router.back()} hitSlop={10} className="w-9 h-9 items-center justify-center">
            <Ionicons name="arrow-back" size={22} color="#0f172a" />
          </Pressable>
          <Text className="text-foreground text-lg font-semibold ml-2">Checkout</Text>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-foreground text-base font-semibold">Your cart is empty</Text>
          <Pressable onPress={() => router.replace("/")} className="bg-primary rounded-xl px-5 py-3 mt-5">
            <Text className="text-primary-foreground text-sm font-semibold">Browse products</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <KeyboardAvoidingView className="flex-1" behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View className="flex-row items-center px-4 py-3 border-b border-border">
          <Pressable onPress={() => router.back()} hitSlop={10} className="w-9 h-9 items-center justify-center">
            <Ionicons name="arrow-back" size={22} color="#0f172a" />
          </Pressable>
          <Text className="text-foreground text-lg font-semibold ml-2">Checkout</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          <View className="rounded-2xl border border-border bg-card p-3 mb-5 shadow-soft">
            <View className="flex-row items-center gap-2">
              <Ionicons name="lock-closed-outline" size={15} color="#ef4444" />
              <Text className="text-foreground text-sm font-semibold">Secure checkout</Text>
            </View>
            <Text className="text-muted-foreground text-xs mt-1">Protected payment flow • Verified local delivery • Warranty support</Text>
          </View>

          <Text className="text-foreground text-base font-bold">Delivery details</Text>
          <Field label="Full name" value={fullName} onChangeText={setFullName} placeholder="Juan Dela Cruz" />
          <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="09XX XXX XXXX" keyboardType="phone-pad" />
          <Field label="Delivery address" value={address} onChangeText={setAddress} placeholder="House number, street, city" multiline />

          <Text className="text-foreground text-base font-bold mt-7 mb-3">Order summary</Text>
          <View className="bg-card border border-border rounded-2xl p-4 shadow-soft">
            {items.map(({ product, quantity }) => (
              <View key={product.id} className="flex-row justify-between mb-3 gap-3">
                <Text className="flex-1 text-muted-foreground text-sm" numberOfLines={1}>
                  {quantity} x {product.name}
                </Text>
                <Text className="text-foreground text-sm font-medium ml-3">
                  {formatPrice(product.price * quantity)}
                </Text>
              </View>
            ))}
            <View className="border-t border-border pt-3 mt-1">
              <SummaryRow label="Subtotal" value={formatPrice(subtotal)} />
              <SummaryRow label="Shipping" value={shippingFee === 0 ? "FREE" : formatPrice(shippingFee)} />
              <View className="flex-row justify-between mt-3">
                <Text className="text-foreground text-base font-bold">Total</Text>
                <Text className="text-primary text-base font-bold">{formatPrice(total)}</Text>
              </View>
            </View>
          </View>

          <Pressable
            onPress={handlePlaceOrder}
            className="bg-primary rounded-xl items-center py-3.5 mt-5"
            style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
          >
            <Text className="text-primary-foreground text-sm font-bold">Place order</Text>
          </Pressable>
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
  return (
    <View className="mt-4">
      <Text className="text-muted-foreground text-xs mb-2">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#94a3b8"
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
