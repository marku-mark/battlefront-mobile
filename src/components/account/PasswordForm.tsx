import { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { changePassword, getLocalUserId } from "@/lib/api";

export function PasswordForm() {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [message, setMessage] = useState("");
  async function submit() {
    if (pending.current) return;
    if (!current || !password || password !== confirmation) { setMessage("Enter your current password and matching new passwords."); return; }
    const owner = getLocalUserId();
    pending.current = true; setBusy(true); setMessage("");
    try {
      await changePassword({ current_password: current, password, password_confirmation: confirmation });
      if (getLocalUserId() !== owner) return;
      setCurrent(""); setPassword(""); setConfirmation(""); setMessage("Password updated.");
    } catch (error) { if (getLocalUserId() === owner) setMessage(error instanceof Error ? error.message : "Could not update password."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <View className="mt-6 border-t border-border pt-5">
    <Text className="text-foreground font-semibold">Change password</Text>
    {([{ label: "Current password", value: current, set: setCurrent }, { label: "New password", value: password, set: setPassword }, { label: "Confirm new password", value: confirmation, set: setConfirmation }]).map((field) => <View key={field.label} className="mt-3">
      <Text className="text-muted-foreground text-sm">{field.label}</Text>
      <TextInput accessibilityLabel={field.label} secureTextEntry autoCapitalize="none" autoCorrect={false} editable={!busy} value={field.value} onChangeText={field.set} className="mt-1 h-12 rounded-lg border border-border px-3 text-foreground" />
    </View>)}
    {message ? <Text accessibilityRole="alert" className="mt-3 text-foreground">{message}</Text> : null}
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void submit()} className="mt-3 min-h-12 justify-center rounded-lg bg-primary px-4"><Text className="text-primary-foreground font-semibold">{busy ? "Updating…" : "Update password"}</Text></Pressable>
  </View>;
}
