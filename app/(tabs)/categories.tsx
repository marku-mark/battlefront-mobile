import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CategoriesScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-foreground text-base font-semibold">
          Categories
        </Text>
        <Text className="text-muted-foreground text-sm text-center mt-2">
          Full category browsing screen — coming in a later pass.
        </Text>
      </View>
    </SafeAreaView>
  );
}
