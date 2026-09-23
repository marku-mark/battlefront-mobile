import { Ionicons } from "@expo/vector-icons";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/theme/ThemeProvider";

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
};

export function ScreenHeader({ title, subtitle, onBack, right }: ScreenHeaderProps) {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const iconColor = isDark ? "#f8fafc" : "#30343b";

  return (
    <View
      className="border-b border-border bg-background px-4 pb-4"
      style={{ paddingTop: Math.max(insets.top, 12) }}
    >
      <View className="min-h-[44px] flex-row items-center gap-3">
        {onBack && (
          <Pressable
            accessibilityLabel="Go back"
            accessibilityRole="button"
            onPress={onBack}
            hitSlop={8}
            className="h-11 w-11 items-center justify-center rounded-xl border border-border bg-secondary"
            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
          >
            <Ionicons name="arrow-back" size={20} color={iconColor} />
          </Pressable>
        )}

        <View className="flex-1">
          <Text className="text-foreground text-2xl font-bold" numberOfLines={1}>
            {title}
          </Text>
          {subtitle && (
            <Text className="text-muted-foreground text-sm mt-1" numberOfLines={2}>
              {subtitle}
            </Text>
          )}
        </View>

        {right}
      </View>
    </View>
  );
}