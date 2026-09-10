import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function CartScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-1 items-center justify-center px-6">
        <Text className="text-foreground text-base font-semibold">
          Your Cart
        </Text>
        <Text className="text-muted-foreground text-sm text-center mt-2">
          Cart and checkout flow — coming in a later pass.
        </Text>
      </View>
    </SafeAreaView>
  );
}
