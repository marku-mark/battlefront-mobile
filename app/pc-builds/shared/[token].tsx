import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ScreenHeader } from "@/components/layout/ScreenHeader";
import { useActiveFocusEffect } from "@/hooks/useActiveScreen";
import { pcBuilder } from "@/lib/pcBuilder";
import type { SavedBuild } from "@/lib/pcBuilderApi";

export default function SharedBuildScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const [build, setBuild] = useState<SavedBuild | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useActiveFocusEffect(useCallback(() => {
    let active = true; setBuild(null); setError("");
    void pcBuilder.shared(token).then((value) => { if (active) setBuild(value); }).catch((reason) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [token, retry]));
  return <SafeAreaView className="flex-1 bg-background"><ScreenHeader title="Shared PC build" /><ScrollView contentContainerStyle={{ padding: 16 }}>
    {error ? <><Text accessibilityRole="alert" className="text-danger">{error}</Text><Pressable onPress={() => setRetry((value) => value + 1)} className="min-h-12 justify-center"><Text className="text-primary">Retry</Text></Pressable></> : !build ? <ActivityIndicator /> : <>
      <Text className="text-foreground text-2xl font-bold">{build.name}</Text><Text className="mt-2 text-muted-foreground">Shared configuration. Current prices, stock, and compatibility must be checked in the builder.</Text>
      {build.items.map((item) => <Text key={item.key} className="mt-4 text-foreground">{item.quantity} × {item.name ?? "Unavailable component"}</Text>)}
      <Pressable onPress={() => router.push({ pathname: "/(tabs)/builder", params: { shared: token } })} className="mt-6 min-h-12 justify-center rounded-lg bg-primary px-4"><Text className="text-primary-foreground font-semibold">Open a copy in PC Builder</Text></Pressable>
    </>}
  </ScrollView></SafeAreaView>;
}
