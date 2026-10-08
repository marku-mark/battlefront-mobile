import { useCallback, useRef, useState } from "react";
import { useActiveFocusEffect, useScreenActive } from "@/hooks/useActiveScreen";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getBehavioralRecommendations, getSessionRevision, recordRecommendationInteraction, type BehavioralRecommendation } from "@/lib/api";
import { ProductImage } from "@/components/products/ProductImage";
import { getProductImageSource } from "@/lib/data";

export default function RecommendationsScreen() {
  const router = useRouter();
  const isScreenActive = useScreenActive();
  const [recommendations, setRecommendations] = useState<BehavioralRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const recommendationOwnerRevision = useRef(getSessionRevision());

  const loadRecommendations = useCallback(async (active: () => boolean) => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError("");
    try {
      const rows = (await getBehavioralRecommendations()).slice(0, 12);
      if (!active() || currentRequest !== requestId.current) return;
      recommendationOwnerRevision.current = getSessionRevision();
      setRecommendations(rows);
      rows.slice(0, 3).forEach((row, index) => {
        void recordRecommendationInteraction({
          productId: row.product.id,
          eventType: "impression",
          placement: "recommendations",
          position: index + 1,
          reasonCode: row.reasons[0]?.code,
          sessionRevision: recommendationOwnerRevision.current,
        }).catch(() => undefined);
      });
    } catch (reason) {
      if (!active() || currentRequest !== requestId.current) return;
      setError(reason instanceof Error ? reason.message : "Could not load recommendations.");
    } finally {
      if (active() && currentRequest === requestId.current) setLoading(false);
    }
  }, []);

  useActiveFocusEffect(useCallback(() => {
    let active = true;
    void loadRecommendations(() => active);
    return () => {
      active = false;
    };
  }, [loadRecommendations]));

  function openRecommendation(recommendation: BehavioralRecommendation, position: number) {
    void recordRecommendationInteraction({
      productId: recommendation.product.id,
      eventType: "click",
      placement: "recommendations",
      position,
      reasonCode: recommendation.reasons[0]?.code,
      sessionRevision: recommendationOwnerRevision.current,
    }).catch(() => undefined);
    router.push({ pathname: "/product/[id]", params: { id: recommendation.product.id } });
  }

  return <SafeAreaView className="flex-1 bg-background">
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Pressable onPress={() => router.back()}><Text className="text-primary">Back</Text></Pressable>
      <Text className="text-foreground text-xl font-bold mt-4">Product recommendations</Text>
      <Text className="text-muted-foreground text-sm mt-2">Suggestions selected using Battlefront’s available product and shopping data.</Text>
      {loading && recommendations.length === 0 ? <ActivityIndicator className="mt-6" /> : null}
      {error ? <View className="mt-4 rounded-xl border border-border bg-card p-4">
        <Text accessibilityRole="alert" className="text-danger">{error}</Text>
        <Pressable onPress={() => void loadRecommendations(isScreenActive)} className="mt-3 rounded-xl bg-primary p-3"><Text className="text-primary-foreground text-center">Try again</Text></Pressable>
      </View> : null}
      {!loading && !error && recommendations.length === 0 ? <Text className="text-muted-foreground mt-5">No recommendations are available right now.</Text> : null}
      {recommendations.map((recommendation, index) => <Pressable
        key={recommendation.product.id}
        onPress={() => openRecommendation(recommendation, index + 1)}
        className="mt-4 flex-row rounded-xl border border-border bg-card p-3"
      >
        <ProductImage source={getProductImageSource(recommendation.product.image)} className="h-24 w-24 rounded-lg bg-secondary" resizeMode="cover" />
        <View className="ml-3 flex-1 justify-center">
          <Text className="text-foreground font-bold" numberOfLines={2}>{recommendation.product.name}</Text>
          <Text className="text-primary mt-2">₱{Number(recommendation.effective_price).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</Text>
          {recommendation.reasons.map((reason) => <Text key={reason.code} className="text-muted-foreground mt-1 text-xs">{reason.value}</Text>)}
        </View>
      </Pressable>)}
      {loading && recommendations.length > 0 ? <ActivityIndicator className="mt-4" /> : null}
    </ScrollView>
  </SafeAreaView>;
}
