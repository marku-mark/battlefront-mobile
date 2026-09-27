import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ProductDetails } from "@/components/products/ProductDetails";
import { useCart } from "@/hooks/useCart";
import { getProductById } from "@/lib/api";
import type { Product } from "@/lib/data";

export default function ProductRoute() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { addItem } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    let isActive = true;

    if (!id) {
      setProduct(null);
      setIsLoading(false);
      return () => {
        isActive = false;
      };
    }

    getProductById(id)
      .then((loadedProduct) => {
        if (isActive) setProduct(loadedProduct);
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [id]);

  if (isLoading) {
    return <ProductRouteState label="Loading product" showSpinner />;
  }

  if (!product) {
    return (
      <ProductRouteState label="Product not found">
        <Text className="text-muted-foreground text-sm text-center mt-2">
          This product may no longer be available.
        </Text>
        <Pressable
          onPress={() => router.back()}
          className="bg-primary rounded-xl px-5 py-3 mt-5"
        >
          <Text className="text-primary-foreground text-sm font-semibold">Go back</Text>
        </Pressable>
      </ProductRouteState>
    );
  }

  return (
    <ProductDetails
      product={product}
      quantity={quantity}
      onQuantityChange={setQuantity}
      onAddToCart={(selectedProduct, itemQuantity, variant) => {
        addItem(selectedProduct, itemQuantity, variant);
        router.back();
      }}
      onClose={() => router.back()}
    />
  );
}

function ProductRouteState({
  label,
  showSpinner = false,
  children,
}: {
  label: string;
  showSpinner?: boolean;
  children?: React.ReactNode;
}) {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-4 py-3 border-b border-border">
        <Pressable
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          hitSlop={10}
          className="w-9 h-9 items-center justify-center"
        >
          <Ionicons name="arrow-back" size={22} color="#f8fafc" />
        </Pressable>
        <Text className="text-foreground text-lg font-semibold ml-2">Product details</Text>
      </View>
      <View className="flex-1 items-center justify-center px-6">
        {showSpinner && <ActivityIndicator color="#ef1b1b" />}
        <Text className="text-foreground text-base font-semibold mt-3">{label}</Text>
        {children}
      </View>
    </SafeAreaView>
  );
}