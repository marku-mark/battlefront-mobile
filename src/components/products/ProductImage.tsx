import { Image } from "expo-image";
import { StyleSheet, View, type ImageProps } from "react-native";

type Props = Pick<ImageProps, "source" | "style" | "resizeMode" | "accessible" | "accessibilityLabel"> & { className?: string };

export function ProductImage({ source, style, className, resizeMode = "cover", accessible, accessibilityLabel }: Props) {
  return <View className={className} style={[style, { overflow: "hidden" }]}>
    <Image source={source} style={StyleSheet.absoluteFill} contentFit={resizeMode === "contain" ? "contain" : "cover"}
      cachePolicy="memory-disk" accessible={accessible} accessibilityLabel={accessibilityLabel}
      recyclingKey={typeof source === "object" && !Array.isArray(source) ? source.uri : undefined} />
  </View>;
}
