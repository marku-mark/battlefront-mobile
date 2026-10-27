import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, KeyboardAvoidingView, Linking, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Animated, { SlideInDown, SlideOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCartActions } from "@/hooks/useCart";
import { useSession } from "@/hooks/useSession";
import { useTheme } from "@/theme/ThemeProvider";
import { useToast } from "@/hooks/useToast";
import { passwordResetUrl } from "@/lib/api";

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
  const insets = useSafeAreaInsets();
  const { isDark, reducedMotion } = useTheme();
  const { showToast } = useToast();
  const { signIn, signUp, verification, clearVerification, confirmEmail, resendEmail } = useSession();
  const [code, setCode] = useState("");
  const [clock, setClock] = useState(Date.now());
  const [resendUntil, setResendUntil] = useState(0);
  useEffect(() => {
    if (!verification) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    setResendUntil(Math.max(Date.now() + verification.retry_after * 1000, Date.parse(verification.resend_available_at ?? "") || 0));
    return () => clearInterval(timer);
  }, [verification]);
  const { promoteGuestCartToMock } = useCartActions();
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
    clearVerification(); setCode("");
    onClose();
  }

  async function handleSignIn() {
    if (isSubmitting) return;
    if (verification) {
      if (!/^\d{6}$/.test(code)) { setError("Enter the six-digit verification code."); return; }
      setIsSubmitting(true); setError("");
      try {
        await confirmEmail(code); setCode(""); setPassword(""); setPasswordConfirmation(""); setIsRegistering(false);
        showToast("Email verified. Sign in to continue.");
      } catch (reason) { setError(reason instanceof Error ? reason.message : "Could not verify this code."); }
      finally { setIsSubmitting(false); }
      return;
    }
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
      const authenticated = isRegistering ? await signUp({ name, email, password, password_confirmation: passwordConfirmation }) : await signIn(email, password);
      if (!authenticated) { setError(""); setPassword(""); setPasswordConfirmation(""); return; }
      promoteGuestCartToMock();
      setError("");
      dismissLoginFailureToast();
      setPassword("");
      setPasswordConfirmation("");
      onClose();
      showToast(createdAccount ? "Account created successfully." : "Logged in successfully.");
    } catch (error) {
      if (createdAccount || !(error instanceof Error) || !("status" in error) || error.status !== 401) {
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
              <Text className="text-foreground text-xl font-bold">{verification ? "Verify email" : isRegistering ? "Create account" : "Sign in"}</Text>
              <Text className="text-muted-foreground text-xs mt-1">{verification ? `Enter the code sent to ${verification.masked_email}.` : isRegistering ? "Create your Battlefront customer account." : message}</Text>
            </View>
            <Pressable accessibilityLabel="Close account form" disabled={isSubmitting} onPress={closeSheet} hitSlop={8} className="w-9 h-9 items-center justify-center">
              <Ionicons name="close" size={22} color={isDark ? "#f8fafc" : "#30343b"} />
            </Pressable>
          </View>
          {isRegistering && <TextInput accessibilityLabel="Customer name" value={name} onChangeText={setName} placeholder="Full name" editable={!isSubmitting} autoComplete="name" className="bg-secondary border border-border rounded-xl px-3 h-12 text-foreground text-sm mt-6" />}
          <View style={verification ? { display: "none" } : undefined}>
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
          {!isRegistering ? <Pressable accessibilityRole="button" disabled={isSubmitting} onPress={() => {
            if (!email.trim()) { setError("Enter your email address first."); return; }
            void (async () => { try { await Linking.openURL(passwordResetUrl(email)); } catch { setError("Could not open password recovery. Please try again."); } })();
          }} className="self-end py-2"><Text className="text-primary text-xs font-semibold">Forgot password?</Text></Pressable> : null}
          {isRegistering && <TextInput accessibilityLabel="Confirm password" value={passwordConfirmation} onChangeText={setPasswordConfirmation} placeholder="Confirm password" secureTextEntry autoCapitalize="none" editable={!isSubmitting} className="bg-secondary border border-border rounded-xl px-3 h-12 text-foreground text-sm mt-3" />}
          </View>
          {verification && <View className="mt-5">
            <TextInput accessibilityLabel="Email verification code" value={code} onChangeText={(value) => setCode(value.replace(/\D/g, "").slice(0, 6))} keyboardType="number-pad" autoComplete="one-time-code" maxLength={6} editable={!isSubmitting} placeholder="Six-digit code" className="bg-secondary border border-border rounded-xl px-3 h-12 text-foreground" />
            <Text className="mt-2 text-muted-foreground text-xs">{verification.delivery_status === "failed" ? "Email delivery failed. Request another code when available." : "Codes expire after five minutes. Verification does not sign you in."}</Text>
            <Pressable disabled={isSubmitting || clock < resendUntil} onPress={() => {
              setIsSubmitting(true); setError("");
              void resendEmail().then(() => { setCode(""); showToast("Verification email requested."); }).catch((reason) => {
                setError(reason instanceof Error ? reason.message : "Could not resend email.");
                if (reason?.retryAfter) setResendUntil(Date.now() + reason.retryAfter * 1000);
              }).finally(() => setIsSubmitting(false));
            }} className="py-3"><Text className="text-primary">{clock < resendUntil ? `Resend in ${Math.ceil((resendUntil - clock) / 1000)}s` : "Resend code"}</Text></Pressable>
            <Pressable disabled={isSubmitting} onPress={() => { clearVerification(); setIsRegistering(false); setCode(""); setError(""); }} className="py-2"><Text className="text-primary">Return to sign in</Text></Pressable>
          </View>}
          {error.length > 0 && <Text accessibilityRole="alert" className="text-danger text-xs mt-3">{error}</Text>}
          <Pressable accessibilityLabel={verification ? "Verify email" : isRegistering ? "Create account" : "Sign in"} disabled={isSubmitting} onPress={() => void handleSignIn()} className="bg-primary rounded-xl items-center py-3.5 mt-5">
            <Text className="text-primary-foreground text-sm font-bold">{isSubmitting ? "Please wait..." : verification ? "Verify email" : isRegistering ? "Create account" : "Sign in"}</Text>
          </Pressable>
          <Pressable disabled={isSubmitting} style={verification ? { display: "none" } : undefined} onPress={() => { setIsRegistering((current) => !current); setError(""); setPassword(""); setPasswordConfirmation(""); }} className="items-center py-3">
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
