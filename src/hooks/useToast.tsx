import Ionicons from "@expo/vector-icons/Ionicons";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AccessibilityInfo, Pressable, Text, View } from "react-native";
import Animated, { SlideInDown, SlideOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";

export type ToastTone = "success" | "error" | "info";
type ToastValue = { id: number; message: string; tone: ToastTone } | null;
type ToastContextValue = { showToast: (message: string, tone?: ToastTone) => void };

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const { reducedMotion } = useTheme();
  const [toast, setToast] = useState<ToastValue>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextId = useRef(0);
  const showToast = useCallback((message: string, tone: ToastTone = "success") => {
    if (timeout.current) clearTimeout(timeout.current);
    setToast({ id: ++nextId.current, message, tone });
    AccessibilityInfo.announceForAccessibility(message);
    timeout.current = setTimeout(() => setToast(null), 3000);
  }, []);
  const dismissToast = useCallback(() => {
    if (timeout.current) clearTimeout(timeout.current);
    timeout.current = null;
    setToast(null);
  }, []);

  useEffect(() => () => {
    if (timeout.current) clearTimeout(timeout.current);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View pointerEvents="box-none" className="absolute left-0 right-0 top-0 z-50" style={{ elevation: 30 }}>
        {toast && <Animated.View key={toast.id} entering={reducedMotion ? undefined : SlideInDown.duration(220)} exiting={reducedMotion ? undefined : SlideOutUp.duration(180)} className="mx-4" style={{ marginTop: insets.top + 8 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={toast.message}
            accessibilityHint="Double tap to dismiss this message."
            onPress={dismissToast}
            className={`flex-row items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg ${toast.tone === "error" ? "border-danger" : toast.tone === "info" ? "border-border" : "border-green-500"}`}
          >
            <Ionicons name={toast.tone === "error" ? "alert-circle" : toast.tone === "info" ? "information-circle" : "checkmark-circle"} size={20} color={toast.tone === "error" ? "#ef4444" : toast.tone === "info" ? "#9ca3af" : "#22c55e"} />
            <Text className="flex-1 text-foreground text-sm font-semibold">{toast.message}</Text>
          </Pressable>
        </Animated.View>}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside ToastProvider.");
  return value;
}
