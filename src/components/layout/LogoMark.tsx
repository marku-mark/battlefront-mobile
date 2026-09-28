import { Image } from "react-native";

type LogoMarkProps = {
  size?: number;
};

export function LogoMark({ size = 48 }: LogoMarkProps) {
  return (
    <Image
      source={require("../../../assets/battlefront-logo.png")}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessible
      accessibilityLabel="Battlefront logo"
    />
  );
}