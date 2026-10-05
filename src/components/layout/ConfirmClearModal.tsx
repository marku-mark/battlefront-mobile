import Ionicons from "@expo/vector-icons/Ionicons";
import { Modal, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ConfirmClearModalProps = {
  visible: boolean;
  title: string;
  description: string;
  detail?: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmClearModal({
  visible,
  title,
  description,
  detail,
  confirmLabel,
  onCancel,
  onConfirm,
}: ConfirmClearModalProps) {
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View className="flex-1 justify-end bg-black/55">
        <Pressable
          accessibilityLabel="Dismiss clear confirmation"
          onPress={onCancel}
          className="absolute inset-0"
        />
        <View
          accessibilityViewIsModal
          className="w-full max-w-[560px] self-center rounded-t-2xl border-t border-border bg-background px-5 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 16) }}
        >
          <View className="mb-5 h-1 w-10 self-center rounded-full bg-muted-foreground/40" />
          <View className="mb-4 h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Ionicons name="trash-outline" size={22} color="#ef1b1b" />
          </View>
          <Text className="text-foreground text-lg font-bold">{title}</Text>
          <Text className="mt-2 text-muted-foreground text-sm leading-5">{description}</Text>
          {detail && (
            <View className="mt-4 rounded-lg border border-border bg-card px-3 py-2.5">
              <Text className="text-muted-foreground text-xs leading-5">{detail}</Text>
            </View>
          )}
          <View className="mt-6 flex-row gap-3">
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              className="h-12 flex-1 items-center justify-center rounded-lg border border-border bg-secondary"
              style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
            >
              <Text className="text-foreground text-sm font-semibold">Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onConfirm}
              className="h-12 flex-1 items-center justify-center rounded-lg bg-primary"
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <Text className="text-primary-foreground text-sm font-bold">{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}