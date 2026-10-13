import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Animated, { SlideInDown, SlideOutUp } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCartActions } from "@/hooks/useCart";
import { useSession } from "@/hooks/useSession";
import { usePromoteGuestWishlistToMock } from "@/hooks/useWishlist";
import { useTheme } from "@/theme/ThemeProvider";
import { useToast } from "@/hooks/useToast";

type MockSignInSheetProps = {
  visible: boolean;
  onClose: () => void;
  message?: string;
};

export function MockSignInSheet({
  visible,
  onClose,
  message = "Sign in with your Battlefront customer account.",
}: MockSignInSheetProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark, reducedMotion } = useTheme();
  const { showToast } = useToast();
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
  const [loginFailureToast, setLoginFailureToast] = useState(false);
  const failureToastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (failureToastTimeout.current) clearTimeout(failureToastTimeout.current);
  }, []);

  function dismissLoginFailureToast() {
    if (failureToastTimeout.current) clearTimeout(failureToastTimeout.current);
    failureToastTimeout.current = null;
    setLoginFailureToast(false);
  }

  function closeSheet() {
    if (isSubmitting) return;
    dismissLoginFailureToast();
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
    const createdAccount = isRegistering;
    setIsSubmitting(true);
    try {
      if (isRegistering) await signUp({ name, email, password, password_confirmation: passwordConfirmation });
      else await signIn(email, password);
      promoteGuestCartToMock();
      promoteGuestWishlistToMock();
      setError("");
      dismissLoginFailureToast();
      setPassword("");
      setPasswordConfirmation("");
      onClose();
      router.replace("/");
      showToast(createdAccount ? "Account created successfully." : "Logged in successfully.");
    } catch (error) {
      if (createdAccount) {
        setError(error instanceof Error ? error.message : "Could not create your account.");
      } else {
        setError("");
        setLoginFailureToast(true);
        AccessibilityInfo.announceForAccessibility("Login failed. Check your credentials.");
        if (failureToastTimeout.current) clearTimeout(failureToastTimeout.current);
        failureToastTimeout.current = setTimeout(() => setLoginFailureToast(false), 3000);
      }
    } finally { setIsSubmitting(false); }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={closeSheet}>
      <KeyboardAvoidingView
        behavior="padding"
        style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.5)" }}
        keyboardVerticalOffset={0}
      >
        {loginFailureToast && <Animated.View entering={reducedMotion ? undefined : SlideInDown.duration(220)} exiting={reducedMotion ? undefined : SlideOutUp.duration(180)} className="absolute left-4 right-4 z-50" style={{ top: insets.top + 8, elevation: 30 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Login failed. Check your credentials."
            accessibilityHint="Double tap to dismiss this message."
            onPress={dismissLoginFailureToast}
            className="flex-row items-center gap-3 rounded-xl border border-danger bg-card px-4 py-3 shadow-lg"
          >
            <Ionicons name="alert-circle" size={20} color="#ef4444" />
            <Text className="flex-1 text-foreground text-sm font-semibold">Login failed. Check your credentials.</Text>
          </Pressable>
        </Animated.View>}
        <ScrollView
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets={Platform.OS === "ios"}
          className="bg-background rounded-t-3xl border-t border-border"
          style={{ maxHeight: "90%", flexShrink: 1 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}
        >
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
            returnKeyType="next"
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
            returnKeyType="go"
            onSubmitEditing={() => void handleSignIn()}
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
