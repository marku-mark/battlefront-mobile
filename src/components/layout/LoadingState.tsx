import { ActivityIndicator, Text, View } from "react-native";

type LoadingStateProps = {
  label: string;
};

export function LoadingState({ label }: LoadingStateProps) {
  return (
    <View accessibilityLiveRegion="polite" className="flex-1 items-center justify-center px-6">
      <ActivityIndicator accessibilityLabel={label} color="#ef1b1b" />
      <Text className="mt-3 text-muted-foreground text-sm">{label}</Text>
    </View>
  );
}