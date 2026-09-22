import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import type { Product } from "@/lib/data";
import { useTheme } from "@/theme/ThemeProvider";

type ProductDetailsProps = {
  product: Product;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  onAddToCart: (product: Product, quantity: number) => void;
  onClose?: () => void;
};

function formatPrice(value: number): string {
  return `₱${value.toLocaleString("en-PH")}`;
}

export function ProductDetails({
  product,
  quantity,
  onQuantityChange,
  onAddToCart,
  onClose,
}: ProductDetailsProps) {
  const { isDark } = useTheme();
  const hasDiscount =
    product.originalPrice !== undefined && product.originalPrice > product.price;
  const discountPct = hasDiscount
    ? Math.round(
        ((product.originalPrice! - product.price) / product.originalPrice!) * 100
      )
    : 0;
  const subtotal = product.price * quantity;

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
        <Pressable
          accessibilityLabel="Close product details"
          onPress={onClose}
          hitSlop={10}
          className="w-9 h-9 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={22} color={isDark ? "#f8fafc" : "#30343b"} />
        </Pressable>
        <Text className="text-foreground text-base font-semibold">Product details</Text>
        <View className="w-9 h-9" />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
      >
        <Image
          source={{ uri: product.image }}
          accessibilityLabel={product.name}
          className="w-full aspect-square bg-card"
          resizeMode="cover"
        />

        <View className="px-4 pt-5">
          <View className="flex-row items-start justify-between gap-3">
            <Text className="flex-1 text-foreground text-xl font-bold leading-7">
              {product.name}
            </Text>
            {hasDiscount && (
              <View className="bg-ring rounded-full px-2 py-1">
                <Text className="text-primary-foreground text-xs font-bold">-{discountPct}%</Text>
              </View>
            )}
          </View>

          <View className="flex-row items-baseline gap-2 mt-3">
            <Text className="text-primary text-2xl font-bold">
              {formatPrice(product.price)}
            </Text>
            {hasDiscount && (
              <Text className="text-muted-foreground text-sm line-through">
                {formatPrice(product.originalPrice!)}
              </Text>
            )}
          </View>

          <View className="flex-row flex-wrap gap-2 mt-4">
            <InfoChip icon="shield-checkmark-outline" label="Warranty included" isDark={isDark} />
            <InfoChip icon="cube-outline" label="Ready to ship" isDark={isDark} />
            {product.sold !== undefined && (
              <InfoChip icon="trending-up-outline" label={`${product.sold} sold`} isDark={isDark} />
            )}
          </View>

          <View className="mt-5 rounded-2xl bg-secondary border border-border p-3 shadow-soft">
            <View className="flex-row items-center justify-between">
              <Text className="text-foreground text-sm font-semibold">Delivery</Text>
              <Text className="text-primary text-xs font-bold uppercase tracking-[0.12em]">Free over ₱5,000</Text>
            </View>
            <Text className="text-muted-foreground text-xs mt-1.5">Ships in 24 hours • Cash on delivery supported</Text>
          </View>

          <View className="mt-6 pt-5 border-t border-border">
            <Text className="text-foreground text-base font-semibold">About this product</Text>
            <Text className="text-muted-foreground text-sm leading-5 mt-2">
              Built for reliable performance in your next setup. This product is selected for high-performance use and backed by Battlefront support for a smoother shopping experience.
            </Text>
            <View className="mt-3 gap-2">
              <BulletPoint text="Reliable daily performance for demanding setups" />
              <BulletPoint text="Built for compatibility and easy upgrades" />
              <BulletPoint text="Backing support from Battlefront and warranty coverage" />
            </View>
          </View>

          <View className="flex-row items-center justify-between mt-6">
            <Text className="text-foreground text-sm font-semibold">Quantity</Text>
            <View className="flex-row items-center border border-border rounded-xl overflow-hidden bg-secondary">
              <QuantityButton
                icon="remove"
                accessibilityLabel="Decrease quantity"
                disabled={quantity <= 1}
                isDark={isDark}
                onPress={() => onQuantityChange(Math.max(1, quantity - 1))}
              />
              <Text className="text-foreground text-sm font-semibold min-w-[36px] text-center">
                {quantity}
              </Text>
              <QuantityButton
                icon="add"
                accessibilityLabel="Increase quantity"
                isDark={isDark}
                onPress={() => onQuantityChange(quantity + 1)}
              />
            </View>
          </View>
        </View>
      </ScrollView>

      <View className="px-4 py-3 border-t border-border bg-background">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-muted-foreground text-xs uppercase tracking-[0.12em]">Total</Text>
          <Text className="text-foreground text-lg font-bold">{formatPrice(subtotal)}</Text>
        </View>
        <Pressable
          accessibilityLabel={`Add ${product.name} to cart`}
          onPress={() => onAddToCart(product, quantity)}
          className="h-12 rounded-xl bg-primary items-center justify-center"
          style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
        >
          <Text className="text-primary-foreground text-sm font-bold">Add to cart</Text>
        </Pressable>
      </View>
    </View>
  );
}

type InfoChipProps = {
  icon: "shield-checkmark-outline" | "cube-outline" | "trending-up-outline";
  label: string;
  isDark: boolean;
};

function InfoChip({ icon, label, isDark }: InfoChipProps) {
  return (
    <View className="flex-row items-center gap-1.5 bg-secondary border border-border rounded-xl px-2.5 py-2">
      <Ionicons name={icon} size={14} color={isDark ? "#cbd5e1" : "#68717e"} />
      <Text className="text-muted-foreground text-xs">{label}</Text>
    </View>
  );
}

type BulletPointProps = {
  text: string;
};

function BulletPoint({ text }: BulletPointProps) {
  return (
    <View className="flex-row items-start gap-2">
      <View className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
      <Text className="flex-1 text-muted-foreground text-sm leading-5">{text}</Text>
    </View>
  );
}

type QuantityButtonProps = {
  icon: "remove" | "add";
  accessibilityLabel: string;
  isDark: boolean;
  disabled?: boolean;
  onPress: () => void;
};

function QuantityButton({
  icon,
  accessibilityLabel,
  isDark,
  disabled = false,
  onPress,
}: QuantityButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      className="w-10 h-10 items-center justify-center"
      style={({ pressed }) => ({ opacity: disabled ? 0.35 : pressed ? 0.7 : 1 })}
    >
      <Ionicons name={icon} size={16} color={isDark ? "#f8fafc" : "#30343b"} />
    </Pressable>
  );
}
