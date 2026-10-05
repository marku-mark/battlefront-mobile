import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useCartActions } from "@/hooks/useCart";
import { useSession } from "@/hooks/useSession";
import { usePromoteGuestWishlistToMock } from "@/hooks/useWishlist";
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
  message = "Sign in with your Battlefront customer account.",
}: MockSignInSheetProps) {
  const { isDark } = useTheme();
  const { signIn, signUp } = useSession();
  const { promoteGuestCartToMock } = useCartActions();
  const promoteGuestWishlistToMock = usePromoteGuestWishlistToMock();
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  function closeSheet() {
    if (isSubmitting) return;
    setError("");
    setPassword("");
    setPasswordConfirmation("");
    onClose();
  }

  async function handleSignIn() {
    if (isSubmitting) return;
    if (!email.trim() || !password) {
      setError("Enter your email and password to continue.");
      return;
    }
    if (isRegistering && (!name.trim() || password !== passwordConfirmation)) {
      setError(!name.trim() ? "Enter your name to create an account." : "Passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (isRegistering) await signUp({ name, email, password, password_confirmation: passwordConfirmation });
      else await signIn(email, password);
      promoteGuestCartToMock();
      promoteGuestWishlistToMock();
      setError("");
      setPassword("");
      setPasswordConfirmation("");
      onClose();
      onSuccess?.();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not sign in.");
    } finally { setIsSubmitting(false); }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={closeSheet}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 justify-end bg-black/50">
        <ScrollView keyboardShouldPersistTaps="handled" className="bg-background rounded-t-3xl border-t border-border" style={{ maxHeight: "90%", flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}>
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-foreground text-xl font-bold">{isRegistering ? "Create account" : "Sign in"}</Text>
              <Text className="text-muted-foreground text-xs mt-1">{isRegistering ? "Create your Battlefront customer account." : message}</Text>
            </View>
            <Pressable accessibilityLabel="Close account form" disabled={isSubmitting} onPress={closeSheet} hitSlop={8} className="w-9 h-9 items-center justify-center">
              <Ionicons name="close" size={22} color={isDark ? "#f8fafc" : "#30343b"} />
            </Pressable>
          </View>
          {isRegistering && <TextInput accessibilityLabel="Customer name" value={name} onChangeText={setName} placeholder="Full name" editable={!isSubmitting} autoComplete="name" className="bg-secondary border border-border rounded-xl px-3 h-12 text-foreground text-sm mt-6" />}
          <TextInput
            accessibilityLabel="Customer email"
            value={email}
            editable={!isSubmitting}
            onChangeText={setEmail}
            placeholder="Email address"
            placeholderTextColor="#94a3b8"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            className="bg-secondary border border-border rounded-xl px-3 h-12 text-foreground text-sm mt-6"
          />
          <TextInput
            accessibilityLabel="Customer password"
            value={password}
            editable={!isSubmitting}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor="#94a3b8"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            className="bg-secondary border border-border rounded-xl px-3 h-12 text-foreground text-sm mt-3"
          />
          {isRegistering && <TextInput accessibilityLabel="Confirm password" value={passwordConfirmation} onChangeText={setPasswordConfirmation} placeholder="Confirm password" secureTextEntry autoCapitalize="none" editable={!isSubmitting} className="bg-secondary border border-border rounded-xl px-3 h-12 text-foreground text-sm mt-3" />}
          {error.length > 0 && <Text accessibilityRole="alert" className="text-danger text-xs mt-3">{error}</Text>}
          <Pressable accessibilityLabel={isRegistering ? "Create account" : "Sign in"} disabled={isSubmitting} onPress={() => void handleSignIn()} className="bg-primary rounded-xl items-center py-3.5 mt-5">
            <Text className="text-primary-foreground text-sm font-bold">{isSubmitting ? (isRegistering ? "Creating account..." : "Signing in...") : (isRegistering ? "Create account" : "Sign in")}</Text>
          </Pressable>
          <Pressable disabled={isSubmitting} onPress={() => { setIsRegistering((current) => !current); setError(""); setPassword(""); setPasswordConfirmation(""); }} className="items-center py-3">
            <Text className="text-primary text-sm font-semibold">{isRegistering ? "Already have an account? Sign in" : "Create a customer account"}</Text>
          </Pressable>
          <Pressable onPress={closeSheet} className="items-center py-3">
            <Text className="text-muted-foreground text-xs font-semibold">Continue as guest</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
