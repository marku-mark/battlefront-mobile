import { useEffect, useState } from "react";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getRecommendationOptions, getRecommendations, type Recommendation, type RecommendationOptions } from "@/lib/api";

export default function RecommendationsScreen() {
  const router = useRouter();
  const [options, setOptions] = useState<RecommendationOptions | null>(null);
  const [budget, setBudget] = useState("");
  const [use, setUse] = useState("");
  const [results, setResults] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { getRecommendationOptions().then((value) => { setOptions(value); setUse(value.intended_uses[0]?.value ?? ""); }).catch((reason) => setError(reason.message)); }, []);
  async function search() {
    setLoading(true); setError("");
    try { setResults(await getRecommendations({ budget, intended_use: use })); setSearched(true); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Could not load recommendations."); }
    finally { setLoading(false); }
  }
  return <SafeAreaView className="flex-1 bg-background">
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Pressable onPress={() => router.back()}><Text className="text-primary">Back</Text></Pressable>
      <Text className="text-foreground text-xl font-bold mt-4">Product recommendations</Text>
      <TextInput accessibilityLabel="Budget in pesos" value={budget} onChangeText={setBudget} placeholder="Budget (PHP)" keyboardType="decimal-pad" className="mt-4 rounded-xl border border-border bg-secondary px-3 py-3 text-foreground" />
      {options?.intended_uses.map((option) => <Pressable key={option.value} onPress={() => setUse(option.value)} className="mt-3 rounded-xl border border-border bg-card p-3"><Text className="text-foreground">{use === option.value ? "● " : "○ "}{option.label}</Text></Pressable>)}
      {error ? <Text className="text-danger mt-3">{error}</Text> : null}
      <Pressable disabled={loading || !options} onPress={() => void search()} className="mt-4 rounded-xl bg-primary p-3"><Text className="text-primary-foreground text-center">Find products</Text></Pressable>
      {loading ? <ActivityIndicator /> : results.map((result) => <Pressable key={result.product.id} onPress={() => router.push({ pathname: "/product/[id]", params: { id: String(result.product.id) } })} className="mt-4 rounded-xl border border-border bg-card p-4"><Text className="text-foreground font-bold">{result.product.name}</Text><Text className="text-primary mt-2">₱{result.effective_price}</Text><Text className="text-muted-foreground mt-2">{result.reasons.join("\n")}</Text></Pressable>)}
      {searched && !loading && results.length === 0 ? <View><Text className="text-muted-foreground mt-4">No eligible products match this budget and use.</Text></View> : null}
    </ScrollView>
  </SafeAreaView>;
}
