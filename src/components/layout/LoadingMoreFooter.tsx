import { ActivityIndicator, Text, View } from "react-native";

export function LoadingMoreFooter() {
  return (
    <View
      accessibilityLiveRegion="polite"
      className="flex-row items-center justify-center gap-2 px-4 py-5"
    >
      <ActivityIndicator accessibilityLabel="Loading more items" color="#ef1b1b" size="small" />
      <Text className="text-muted-foreground text-xs">Still loading more items...</Text>
    </View>
  );
}