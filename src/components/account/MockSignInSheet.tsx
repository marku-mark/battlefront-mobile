import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Modal, Pressable, Text, TextInput, View } from "react-native";
import { useCartActions } from "@/hooks/useCart";
import { useSession } from "@/hooks/useSession";
import { usePromoteGuestWishlistToMock } from "@/hooks/useWishlist";
import { DEMO_ACCOUNT } from "@/lib/mockAccount";
import { useTheme } from "@/theme/ThemeProvider";

type MockSignInSheetProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  message?: string;
};

export function MockSignInSheet({
  visible,
  onClose,
  onSuccess,
  message = "Local preview only. These details are not sent anywhere.",
}: MockSignInSheetProps) {
  const { isDark } = useTheme();
  const { signIn } = useSession();
  const { promoteGuestCartToMock } = useCartActions();
  const promoteGuestWishlistToMock = usePromoteGuestWishlistToMock();
  const [email, setEmail] = useState<string>(DEMO_ACCOUNT.email);
  const [password, setPassword] = useState<string>(DEMO_ACCOUNT.password);
  const [error, setError] = useState("");

  function closeSheet() {
    setError("");
    onClose();
  }

  function handleSignIn() {
    if (!email.trim() || !password) {
      setError("Enter the demo email and password to continue.");
      return;
    }
    if (!signIn(email, password)) {
      setError("Those details don't match the local demo account.");
      return;
    }

    promoteGuestCartToMock();
    promoteGuestWishlistToMock();
    setError("");
    onClose();
    onSuccess?.();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={closeSheet}>
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-background rounded-t-3xl border-t border-border px-4 pt-4 pb-8">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-foreground text-xl font-bold">Sign in to demo account</Text>
              <Text className="text-muted-foreground text-xs mt-1">{message}</Text>
            </View>
            <Pressable accessibilityLabel="Close demo sign in" onPress={closeSheet} hitSlop={8} className="w-9 h-9 items-center justify-center">
              <Ionicons name="close" size={22} color={isDark ? "#f8fafc" : "#30343b"} />
            </Pressable>
          </View>
          <TextInput
            accessibilityLabel="Demo account email"
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor="#94a3b8"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            className="bg-secondary border border-border rounded-xl px-3 h-12 text-foreground text-sm mt-6"
          />
          <TextInput
            accessibilityLabel="Demo account password"
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#94a3b8"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            className="bg-secondary border border-border rounded-xl px-3 h-12 text-foreground text-sm mt-3"
          />
          {error.length > 0 && <Text accessibilityRole="alert" className="text-danger text-xs mt-3">{error}</Text>}
          <Pressable accessibilityLabel="Sign in to the local demo account" onPress={handleSignIn} className="bg-primary rounded-xl items-center py-3.5 mt-5">
            <Text className="text-primary-foreground text-sm font-bold">Sign in</Text>
          </Pressable>
          <Pressable onPress={closeSheet} className="items-center py-3">
            <Text className="text-muted-foreground text-xs font-semibold">Continue as guest</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}