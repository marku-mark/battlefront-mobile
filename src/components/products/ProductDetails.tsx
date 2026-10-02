import { Ionicons } from "@expo/vector-icons";
import { Alert, Image, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useState, type ReactNode } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getProductImageSource, getProductVariants, type Product } from "@/lib/data";
import { useTheme } from "@/theme/ThemeProvider";
import { useWishlist } from "@/hooks/useWishlist";
import { useSession } from "@/hooks/useSession";
import { MockSignInSheet } from "@/components/account/MockSignInSheet";
import { ProductReviewPanel } from "@/components/products/ProductReviewPanel";
import { getResponsiveLayout, MAX_CONTENT_WIDTH } from "@/lib/responsive";

type ProductDetailsProps = {
  product: Product;
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  onAddToCart: (product: Product, quantity: number, variant?: string | null) => void;
  onCompare?: (productId: string) => void;
  onClose?: () => void;
};

type ProductReview = { id: string; author: string; title: string; body: string; rating: number };

function formatPrice(value: number): string {
  return `₱${value.toLocaleString("en-PH")}`;
}

export function ProductDetails({ product, quantity, onQuantityChange, onAddToCart, onCompare, onClose }: ProductDetailsProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const layout = getResponsiveLayout(width);
  const useTwoColumnLayout = width >= 760;
  const imageWidth = useTwoColumnLayout
    ? Math.min(560, (layout.contentWidth - 72) * 0.44)
    : Math.min(layout.contentWidth, layout.isTablet ? 560 : width);
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { session } = useSession();
  const variants = getProductVariants(product);
  const [selectedVariant, setSelectedVariant] = useState(variants[0] ?? null);
  const [specificationsOpen, setSpecificationsOpen] = useState(false);
  const [compatibilityOpen, setCompatibilityOpen] = useState(false);
  const [isSignInOpen, setIsSignInOpen] = useState(false);
  const wishlisted = isWishlisted(product.id);
  const hasDiscount = product.originalPrice !== undefined && product.originalPrice > product.price;
  const discount = hasDiscount ? Math.round(((product.originalPrice! - product.price) / product.originalPrice!) * 100) : 0;
  const rating = product.rating ?? 0;
  const reviewCount = product.reviewCount ?? 0;
  const hasRating = rating > 0 && reviewCount > 0;
  const stockQuantity = ["out_of_stock", "unavailable"].includes(product.availability ?? "") ? 0 : (product.stockQuantity ?? Number.MAX_SAFE_INTEGER);
  const facts = getProductFacts(product);
  const subtotal = product.price * quantity;

  return (
    <View className="flex-1 bg-background">
      <View className="flex-row items-center justify-between px-4 pb-3 border-b border-border" style={{ paddingTop: Math.max(insets.top, 12) }}>
        <Pressable accessibilityLabel="Close product details" accessibilityRole="button" onPress={onClose} hitSlop={10} className="w-9 h-9 items-center justify-center">
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <Text className="text-foreground text-base font-semibold">Product details</Text>
        <Pressable accessibilityLabel={`${wishlisted ? "Remove" : "Add"} ${product.name} ${wishlisted ? "from" : "to"} wishlist`} accessibilityRole="button" accessibilityState={{ selected: wishlisted }} onPress={() => toggleWishlist(product.id)} hitSlop={8} className="w-11 h-11 items-center justify-center rounded-xl border border-border bg-secondary">
          <Ionicons name={wishlisted ? "heart" : "heart-outline"} size={21} color={wishlisted ? colors.primary : colors.foreground} />
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 28, width: "100%", maxWidth: MAX_CONTENT_WIDTH, alignSelf: "center" }}>
        <View
          className={useTwoColumnLayout ? "self-center w-full flex-row items-start gap-6 px-6" : "w-full"}
          style={{ maxWidth: MAX_CONTENT_WIDTH }}
        >
          <View style={{ width: useTwoColumnLayout ? imageWidth : "100%", maxWidth: useTwoColumnLayout ? 560 : undefined, alignSelf: useTwoColumnLayout ? undefined : "center" }}>
            <Image source={getProductImageSource(product.image)} accessibilityLabel={`${product.name} product image`} accessible style={{ width: imageWidth, height: imageWidth }} className="self-center bg-card" resizeMode="cover" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ width: imageWidth, alignSelf: "center" }} contentContainerStyle={{ gap: 8, padding: 12 }}>
              <View className="h-16 w-16 overflow-hidden rounded-lg border-2 border-primary"><Image source={getProductImageSource(product.image)} accessibilityLabel={`${product.name} thumbnail`} className="h-full w-full" /></View>
            </ScrollView>
          </View>

        <View className={useTwoColumnLayout ? "flex-1 pt-5" : "self-center w-full px-4 pt-5"} style={{ maxWidth: 760 }}>
          <View className="flex-row items-start justify-between gap-3">
            <Text className="flex-1 text-foreground text-xl font-bold leading-7">{product.name}</Text>
            {hasDiscount && <View className="bg-ring rounded-full px-2 py-1"><Text className="text-primary-foreground text-xs font-bold">-{discount}%</Text></View>}
          </View>
          <View className="flex-row items-baseline gap-2 mt-3"><Text className="text-primary text-2xl font-bold">{formatPrice(product.price)}</Text>{hasDiscount && <Text className="text-muted-foreground text-sm line-through">{formatPrice(product.originalPrice!)}</Text>}</View>

          <View className="flex-row items-center gap-2 mt-3">
            {hasRating ? (
              <>
                <Ionicons name="star" size={16} color="#f59e0b" />
                <Text className="text-foreground text-sm font-semibold">{rating.toFixed(1)}</Text>
                <Text className="text-muted-foreground text-xs">({reviewCount} reviews)</Text>
              </>
            ) : <Text className="text-muted-foreground text-xs">No reviews yet</Text>}
            <View className={`ml-2 h-1.5 w-1.5 rounded-full ${stockQuantity > 0 ? "bg-success" : "bg-danger"}`} />
            <Text className={`text-xs ${stockQuantity > 0 ? "text-muted-foreground" : "text-danger"}`}>{stockQuantity > 0 ? (product.availability === "low_stock" ? "Low stock" : "In stock") : "Out of stock"}</Text>
          </View>

          {variants.length > 0 && <View className="mt-5"><View className="flex-row items-center justify-between mb-2"><Text className="text-foreground text-sm font-semibold">Choose an option</Text><Text className="text-muted-foreground text-xs">{selectedVariant ?? "Select"}</Text></View><View className="flex-row flex-wrap gap-2">{variants.map((variant) => <Pressable key={variant} accessibilityRole="radio" accessibilityLabel={`${variant} option`} accessibilityState={{ selected: selectedVariant === variant }} onPress={() => setSelectedVariant(variant)} className={`rounded-lg border px-3 py-2 ${selectedVariant === variant ? "border-primary bg-primary/10" : "border-border bg-secondary"}`}><Text className={`text-xs font-semibold ${selectedVariant === variant ? "text-primary" : "text-foreground"}`}>{variant}</Text></Pressable>)}</View></View>}

          <View className="flex-row flex-wrap gap-2 mt-4"><InfoChip icon="shield-checkmark-outline" label="Warranty included" color={colors.icon} /><InfoChip icon="cube-outline" label="Ready to ship" color={colors.icon} />{product.sold !== undefined && <InfoChip icon="trending-up-outline" label={`${product.sold} sold`} color={colors.icon} />}</View>
          {onCompare && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Compare ${product.name} with other products`}
              onPress={() => onCompare(product.id)}
              className="mt-4 h-10 flex-row items-center justify-center gap-2 rounded-xl border border-border bg-secondary"
            >
              <Ionicons name="git-compare-outline" size={16} color={colors.foreground} />
              <Text className="text-foreground text-xs font-semibold">Compare products</Text>
            </Pressable>
          )}
          <View className="mt-5 rounded-2xl bg-secondary border border-border p-3 shadow-soft"><View className="flex-row items-center justify-between"><Text className="text-foreground text-sm font-semibold">Delivery</Text><Text className="text-primary text-xs font-bold uppercase tracking-[0.12em]">Free over ₱5,000</Text></View><Text className="text-muted-foreground text-xs mt-1.5">Ships in 24 hours • Cash on delivery supported</Text></View>

          <View className="mt-6 pt-5 border-t border-border"><Text className="text-foreground text-base font-semibold">About this product</Text><Text className="text-muted-foreground text-sm leading-5 mt-2">{facts.description}</Text><View className="mt-3 gap-2">{facts.highlights.map((highlight) => <BulletPoint key={highlight} text={highlight} />)}</View></View>
          <ProductReviewPanel
            productId={product.id}
            rating={rating}
            reviewCount={reviewCount}
            isMockAccount={session.mode === "customer"}
            onSignIn={() => setIsSignInOpen(true)}
          />
          <DetailDisclosure title="Specifications" open={specificationsOpen} color={colors.muted} onPress={() => setSpecificationsOpen((current) => !current)}>{facts.specifications.map(([label, value]) => <View key={label} className="flex-row justify-between gap-4 py-2 border-b border-border"><Text className="text-muted-foreground text-sm">{label}</Text><Text className="text-foreground text-sm font-medium flex-1 text-right">{value}</Text></View>)}</DetailDisclosure>
          <DetailDisclosure title="Compatibility and support" open={compatibilityOpen} color={colors.muted} onPress={() => setCompatibilityOpen((current) => !current)}><Text className="text-muted-foreground text-sm leading-5">{facts.compatibility}</Text></DetailDisclosure>

          <View className="flex-row items-center justify-between mt-6"><Text className="text-foreground text-sm font-semibold">Quantity</Text><View className="flex-row items-center border border-border rounded-xl overflow-hidden bg-secondary"><QuantityButton icon="remove" accessibilityLabel="Decrease quantity" color={colors.foreground} disabled={quantity <= 1} onPress={() => onQuantityChange(Math.max(1, quantity - 1))} /><Text className="text-foreground text-sm font-semibold min-w-[36px] text-center">{quantity}</Text><QuantityButton icon="add" accessibilityLabel="Increase quantity" color={colors.foreground} disabled={quantity >= stockQuantity} onPress={() => onQuantityChange(Math.min(stockQuantity, quantity + 1))} /></View></View>
        </View>
        </View>
      </ScrollView>

      <View className="self-center w-full px-4 pt-3 border-t border-border bg-background" style={{ maxWidth: 760, paddingBottom: Math.max(insets.bottom, 12) }}><View className="flex-row items-center justify-between mb-3"><Text className="text-muted-foreground text-xs uppercase tracking-[0.12em]">Total</Text><Text className="text-foreground text-lg font-bold">{formatPrice(subtotal)}</Text></View><Pressable accessibilityLabel={`Add ${product.name} to cart`} accessibilityRole="button" disabled={stockQuantity === 0 || (variants.length > 0 && !selectedVariant)} onPress={() => onAddToCart(product, quantity, selectedVariant)} className="h-12 rounded-xl bg-primary items-center justify-center" style={({ pressed }) => ({ opacity: stockQuantity === 0 || (variants.length > 0 && !selectedVariant) ? 0.45 : pressed ? 0.8 : 1 })}><Text className="text-primary-foreground text-sm font-bold">{stockQuantity === 0 ? "Out of stock" : variants.length > 0 && !selectedVariant ? "Choose an option" : "Add to cart"}</Text></Pressable></View>
      <MockSignInSheet visible={isSignInOpen} onClose={() => setIsSignInOpen(false)} />
    </View>
  );
}

type ProductFacts = { description: string; highlights: string[]; specifications: [string, string][]; compatibility: string };

function getProductFacts(product: Product): ProductFacts {
  if (product.categoryId === "cat-1") return { description: `${product.name} is a portable everyday workstation for focused work, study, and travel-ready productivity.`, highlights: ["Balanced performance for work and study", "Compact setup with fewer accessories", "Covered by Battlefront support and warranty"], specifications: [["Category", "Laptop"], ["Use case", "Work, study, and portable gaming"], ["Availability", "Ready to ship"]], compatibility: "Works with standard USB accessories, external displays, and common laptop docks." };
  if (product.categoryId === "cat-3") return { description: `${product.name} is a core desktop component selected for reliable performance in a custom PC build or upgrade.`, highlights: ["Designed for upgrade-focused builds", "Check system fit before checkout", "Covered by Battlefront support and warranty"], specifications: [["Category", "Component"], ["Build role", "Desktop upgrade"], ["Availability", "Ready to ship"]], compatibility: "Confirm your motherboard, case clearance, power requirements, and connector standards before ordering." };
  return { description: `${product.name} is selected for dependable performance in a practical Battlefront setup.`, highlights: ["Built for reliable everyday use", "Suitable for common upgrade paths", "Covered by Battlefront support and warranty"], specifications: [["Category", "Computer hardware"], ["Availability", "Ready to ship"]], compatibility: "Review your current setup dimensions, connectors, and requirements before ordering." };
}

function getProductReviews(product: Product): ProductReview[] {
  return [
    { id: `${product.id}-review-1`, author: "Marco R.", title: "Good value for the build", body: "Arrived in good condition and matched the product details. Setup was straightforward.", rating: 5 },
    { id: `${product.id}-review-2`, author: "Jessa L.", title: "Solid everyday performance", body: "Good fit for my current setup. Delivery and support details were easy to understand.", rating: 4 },
  ];
}

function ReviewSection({ rating, reviewCount, reviews, isMockAccount, onSignIn }: { rating: number; reviewCount: number; reviews: ProductReview[]; isMockAccount: boolean; onSignIn: () => void }) {
  return <View className="mt-6 pt-5 border-t border-border"><View className="flex-row items-center justify-between mb-4"><View><Text className="text-foreground text-base font-semibold">Reviews</Text><Text className="text-muted-foreground text-xs mt-1">{reviewCount} sample reviews</Text></View><Pressable accessibilityLabel={isMockAccount ? "Preview writing a review" : "Sign in to preview writing a review"} accessibilityRole="button" onPress={() => isMockAccount ? Alert.alert("Review preview", "Review submission is not connected in this demo.") : onSignIn()}><Text className="text-primary text-xs font-semibold">{isMockAccount ? "Write a review" : "Sign in to review"}</Text></Pressable></View><View className="flex-row items-center bg-card border border-border rounded-2xl p-4"><View className="items-center pr-5 border-r border-border"><Text className="text-foreground text-3xl font-bold">{rating.toFixed(1)}</Text><View className="flex-row mt-1">{Array.from({ length: 5 }).map((_, index) => <Ionicons key={index} name={index < Math.round(rating) ? "star" : "star-outline"} size={13} color="#f59e0b" />)}</View></View><View className="flex-1 ml-4 gap-1.5">{[5, 4, 3, 2, 1].map((score) => <View key={score} className="flex-row items-center gap-2"><Text className="text-muted-foreground text-[10px] w-3">{score}</Text><View className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden"><View className={`h-full rounded-full ${score >= 4 ? "bg-primary" : "bg-muted-foreground"}`} style={{ width: `${score >= 4 ? 76 : 18}%` }} /></View></View>)}</View></View><View className="mt-3 gap-3">{reviews.map((review) => <View key={review.id} className="border-b border-border pb-3"><View className="flex-row items-center justify-between"><Text className="text-foreground text-sm font-semibold">{review.title}</Text><View className="flex-row">{Array.from({ length: review.rating }).map((_, index) => <Ionicons key={index} name="star" size={12} color="#f59e0b" />)}</View></View><Text className="text-muted-foreground text-xs mt-1 leading-5">{review.body}</Text><Text className="text-muted-foreground text-[10px] uppercase tracking-[0.1em] mt-2">{review.author} · Sample review · not verified</Text></View>)}</View></View>;
}

function DetailDisclosure({ title, open, color, onPress, children }: { title: string; open: boolean; color: string; onPress: () => void; children: ReactNode }) {
  return <View className="mt-3 border-t border-border"><Pressable accessibilityLabel={`${open ? "Collapse" : "Expand"} ${title}`} accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={onPress} className="flex-row items-center justify-between py-4"><Text className="text-foreground text-sm font-semibold">{title}</Text><Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={color} /></Pressable>{open && <View className="pb-3">{children}</View>}</View>;
}

function InfoChip({ icon, label, color }: { icon: "shield-checkmark-outline" | "cube-outline" | "trending-up-outline"; label: string; color: string }) {
  return <View className="flex-row items-center gap-1.5 bg-secondary border border-border rounded-xl px-2.5 py-2"><Ionicons name={icon} size={14} color={color} /><Text className="text-muted-foreground text-xs">{label}</Text></View>;
}

function BulletPoint({ text }: { text: string }) {
  return <View className="flex-row items-start gap-2"><View className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" /><Text className="flex-1 text-muted-foreground text-sm leading-5">{text}</Text></View>;
}

function QuantityButton({ icon, accessibilityLabel, color, disabled = false, onPress }: { icon: "remove" | "add"; accessibilityLabel: string; color: string; disabled?: boolean; onPress: () => void }) {
  return <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} className="w-10 h-10 items-center justify-center" style={({ pressed }) => ({ opacity: disabled ? 0.35 : pressed ? 0.7 : 1 })}><Ionicons name={icon} size={16} color={color} /></Pressable>;
}
