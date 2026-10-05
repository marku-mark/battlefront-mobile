import { Image } from "expo-image";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useState } from "react";
import { StyleSheet, Text, View, type ImageProps } from "react-native";
import { useTheme } from "@/theme/ThemeProvider";

type Props = Pick<ImageProps, "source" | "style" | "resizeMode" | "accessible" | "accessibilityLabel"> & { className?: string };

export function ProductImage({ source, style, className, resizeMode = "cover", accessible, accessibilityLabel }: Props) {
  const { colors } = useTheme();
  const sourceKey = typeof source === "object" && !Array.isArray(source) ? source?.uri : String(source);
  const [failedSource, setFailedSource] = useState<string>();
  const failed = !source || failedSource === sourceKey;
  return <View className={className} style={[style, { overflow: "hidden" }]} accessible={accessible} accessibilityLabel={accessibilityLabel}>
    <View className="absolute inset-0 bg-secondary items-center justify-center" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Ionicons name="image-outline" size={22} color={colors.muted} />
      {failed && <Text className="text-muted-foreground text-xs text-center mt-1 px-2">Image unavailable</Text>}
    </View>
    {!failed && <Image source={source} style={StyleSheet.absoluteFill} contentFit={resizeMode === "contain" ? "contain" : "cover"}
      cachePolicy="memory-disk" accessible={false} recyclingKey={sourceKey} onError={() => setFailedSource(sourceKey)} />}
  </View>;
}
