import AsyncStorage from "@react-native-async-storage/async-storage";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

type ProductReview = { id: string; author: string; title: string; body: string; rating: number };

type ProductReviewPanelProps = {
  productId: string;
  rating: number;
  reviewCount: number;
  isMockAccount: boolean;
  onSignIn: () => void;
};

export function ProductReviewPanel({
  productId,
  rating,
  reviewCount,
  isMockAccount,
  onSignIn,
}: ProductReviewPanelProps) {
  const { colors } = useTheme();
  const [localReviews, setLocalReviews] = useState<ProductReview[]>([]);
  const [isWriting, setIsWriting] = useState(false);
  const [selectedRating, setSelectedRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const storageKey = `battlefront-product-reviews-${productId}`;

  useEffect(() => {
    let isActive = true;
    AsyncStorage.getItem(storageKey)
      .then((storedReviews) => {
        if (!storedReviews) return;
        const parsed: unknown = JSON.parse(storedReviews);
        if (!Array.isArray(parsed)) return;
        const validReviews = parsed.filter(isProductReview);
        if (isActive) setLocalReviews(validReviews);
      })
      .catch(() => undefined);
    return () => {
      isActive = false;
    };
  }, [storageKey]);

  const totalReviewCount = reviewCount + localReviews.length;
  const averageRating = totalReviewCount > 0
    ? (rating * reviewCount + localReviews.reduce((sum, review) => sum + review.rating, 0)) / totalReviewCount
    : rating;
  const displayedReviews = localReviews;

  async function submitReview() {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody) {
      setError("Add a title and a few details about your experience.");
      return;
    }

    const nextReviews = [{
      id: `${productId}-${Date.now()}`,
      author: "You",
      title: trimmedTitle,
      body: trimmedBody,
      rating: selectedRating,
    }, ...localReviews];
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify(nextReviews));
      setLocalReviews(nextReviews);
      setTitle("");
      setBody("");
      setSelectedRating(5);
      setError("");
      setIsWriting(false);
    } catch {
      setError("Review could not be saved on this device. Please try again.");
    }
  }

  return (
    <View className="mt-6 border-t border-border pt-5">
      <View className="mb-4 flex-row items-center justify-between">
        <View>
          <Text className="text-foreground text-base font-semibold">Reviews</Text>
          <Text className="text-muted-foreground text-xs mt-1">{totalReviewCount} reviews</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={isMockAccount ? "Write a review" : "Sign in to write a review"}
          onPress={() => {
            if (!isMockAccount) {
              onSignIn();
              return;
            }
            setIsWriting((current) => !current);
            setError("");
          }}
        >
          <Text className="text-primary text-xs font-semibold">{isMockAccount ? (isWriting ? "Cancel" : "Write a review") : "Sign in to review"}</Text>
        </Pressable>
      </View>

      <View className="flex-row items-center rounded-2xl border border-border bg-card p-4">
        {totalReviewCount > 0 ? (
          <>
            <View className="items-center border-r border-border pr-5">
              <Text className="text-foreground text-3xl font-bold">{averageRating.toFixed(1)}</Text>
              <View className="mt-1 flex-row">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Ionicons key={index} name={index < Math.round(averageRating) ? "star" : "star-outline"} size={13} color="#f59e0b" />
                ))}
              </View>
            </View>
            <Text className="ml-4 flex-1 text-muted-foreground text-xs">Based on {totalReviewCount} review{totalReviewCount === 1 ? "" : "s"}</Text>
          </>
        ) : <Text className="text-muted-foreground text-xs">No reviews yet. Be the first to share your experience.</Text>}
      </View>

      {isWriting && (
        <View className="mt-3 rounded-2xl border border-border bg-card p-4">
          <Text className="text-foreground text-sm font-semibold">Your rating</Text>
          <View className="mt-2 flex-row gap-2">
            {Array.from({ length: 5 }).map((_, index) => {
              const value = index + 1;
              return (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityLabel={`${value} star${value === 1 ? "" : "s"}`}
                  accessibilityState={{ selected: selectedRating === value }}
                  onPress={() => setSelectedRating(value)}
                  hitSlop={6}
                >
                  <Ionicons name={value <= selectedRating ? "star" : "star-outline"} size={25} color="#f59e0b" />
                </Pressable>
              );
            })}
          </View>
          <TextInput
            accessibilityLabel="Review title"
            value={title}
            onChangeText={setTitle}
            placeholder="Review title"
            placeholderTextColor={colors.muted}
            maxLength={80}
            className="mt-3 h-11 rounded-xl border border-border bg-secondary px-3 text-foreground text-sm"
          />
          <TextInput
            accessibilityLabel="Review details"
            value={body}
            onChangeText={setBody}
            placeholder="What should other shoppers know?"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={500}
            textAlignVertical="top"
            className="mt-2 min-h-24 rounded-xl border border-border bg-secondary px-3 py-3 text-foreground text-sm"
          />
          {error ? <Text className="mt-2 text-danger text-xs">{error}</Text> : null}
          <Pressable accessibilityRole="button" onPress={() => void submitReview()} className="mt-3 h-11 items-center justify-center rounded-xl bg-primary">
            <Text className="text-primary-foreground text-sm font-bold">Submit review</Text>
          </Pressable>
        </View>
      )}

      <View className="mt-3 gap-3">
        {displayedReviews.map((review) => (
          <View key={review.id} className="border-b border-border pb-3">
            <View className="flex-row items-center justify-between gap-3">
              <Text className="flex-1 text-foreground text-sm font-semibold">{review.title}</Text>
              <View className="flex-row">
                {Array.from({ length: review.rating }).map((_, index) => (
                  <Ionicons key={index} name="star" size={12} color="#f59e0b" />
                ))}
              </View>
            </View>
            <Text className="mt-1 text-muted-foreground text-xs leading-5">{review.body}</Text>
            <Text className="mt-2 text-muted-foreground text-[10px] uppercase">{review.author}{review.author === "You" ? " · Your review" : " · Sample review · not verified"}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function isProductReview(value: unknown): value is ProductReview {
  if (!value || typeof value !== "object") return false;
  const review = value as Partial<ProductReview>;
  return typeof review.id === "string"
    && typeof review.author === "string"
    && typeof review.title === "string"
    && typeof review.body === "string"
    && typeof review.rating === "number"
    && Number.isInteger(review.rating)
    && review.rating >= 1
    && review.rating <= 5;
}