import { Ionicons } from "@expo/vector-icons";
import { Pressable, Text, View } from "react-native";

type BuilderEntryCardProps = {
  onPress: () => void;
};

export function BuilderEntryCard({ onPress }: BuilderEntryCardProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open PC Builder"
      onPress={onPress}
      className="mx-4 mt-5 rounded-xl border border-border bg-card p-4"
      style={({ pressed }) => ({ opacity: pressed ? 0.76 : 1 })}
    >
      <View className="flex-row items-center gap-3">
        <View className="h-11 w-11 items-center justify-center rounded-lg bg-primary/10">
          <Ionicons name="construct-outline" size={22} color="#ef1b1b" />
        </View>
        <View className="flex-1">
          <Text className="text-foreground text-sm font-bold">Build your PC</Text>
          <Text className="mt-1 text-muted-foreground text-xs">
            Choose parts and review your build
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={18} color="#ef1b1b" />
      </View>
    </Pressable>
  );
}