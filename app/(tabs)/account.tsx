import { Ionicons } from "@expo/vector-icons";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const accountLinks = [
  { icon: "receipt-outline", label: "My orders", detail: "Track purchases and deliveries" },
  { icon: "heart-outline", label: "Wishlist", detail: "Save products for later" },
  { icon: "location-outline", label: "Delivery addresses", detail: "Manage your saved locations" },
  { icon: "help-circle-outline", label: "Help center", detail: "Get support from Battlefront" },
] as const;

function showUnavailableMessage() {
  Alert.alert("Account access", "Account services will be available when authentication is connected.");
}

export default function AccountScreen() {
  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View className="px-4 pt-3 pb-5 border-b border-border">
          <Text className="text-foreground text-2xl font-bold">Account</Text>
          <Text className="text-muted-foreground text-sm mt-1">
            Manage your Battlefront shopping experience.
          </Text>
        </View>

        <View className="mx-4 mt-5 rounded-lg bg-card border border-border p-4">
          <View className="flex-row items-center">
            <View className="w-14 h-14 rounded-full bg-secondary items-center justify-center">
              <Ionicons name="person-outline" size={26} color="#9ca3af" />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-foreground text-base font-semibold">
                Shop as a guest
              </Text>
              <Text className="text-muted-foreground text-xs mt-1">
                Sign in to track orders and save your details.
              </Text>
            </View>
          </View>

          <View className="flex-row gap-3 mt-5">
            <Pressable
              onPress={showUnavailableMessage}
              className="flex-1 bg-primary rounded-md items-center py-3"
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <Text className="text-primary-foreground text-sm font-semibold">
                Sign in
              </Text>
            </Pressable>
            <Pressable
              onPress={showUnavailableMessage}
              className="flex-1 border border-border rounded-md items-center py-3"
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text className="text-foreground text-sm font-semibold">
                Create account
              </Text>
            </Pressable>
          </View>
        </View>

        <Text className="text-foreground text-base font-semibold px-4 mt-7 mb-3">
          Account shortcuts
        </Text>
        <View className="mx-4 rounded-lg bg-card border border-border overflow-hidden">
          {accountLinks.map((link, index) => (
            <Pressable
              key={link.label}
              onPress={showUnavailableMessage}
              className={`flex-row items-center p-4 ${index < accountLinks.length - 1 ? "border-b border-border" : ""}`}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <View className="w-9 h-9 rounded-md bg-secondary items-center justify-center">
                <Ionicons name={link.icon} size={19} color="#f8fafc" />
              </View>
              <View className="flex-1 ml-3">
                <Text className="text-foreground text-sm font-medium">
                  {link.label}
                </Text>
                <Text className="text-muted-foreground text-xs mt-0.5">
                  {link.detail}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
            </Pressable>
          ))}
        </View>

        <View className="flex-row items-center justify-center gap-1.5 mt-7">
          <Ionicons name="shield-checkmark-outline" size={15} color="#9ca3af" />
          <Text className="text-muted-foreground text-xs">
            Your information stays secure with Battlefront.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
