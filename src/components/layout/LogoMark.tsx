import { Image } from "expo-image";
import { useTheme } from "@/theme/ThemeProvider";

type LogoMarkProps = {
  size?: number;
  width?: number;
  variant?: "wordmark" | "symbol";
};

export function LogoMark({ size = 40, width = 180, variant = "wordmark" }: LogoMarkProps) {
  const { isDark } = useTheme();
  const source = variant === "symbol"
    ? require("../../../assets/battlefront-symbol.webp")
    : isDark
      ? require("../../../assets/battlefront-wordmark-dark.webp")
      : require("../../../assets/battlefront-wordmark.webp");
  return (
    <Image
      source={source}
      style={variant === "symbol" ? { width: size, height: size } : { width, height: width * 303 / 1200, maxWidth: "100%" }}
      contentFit="contain"
      transition={0}
      accessible
      accessibilityLabel="Battlefront Computer Trading"
    />
  );
}
