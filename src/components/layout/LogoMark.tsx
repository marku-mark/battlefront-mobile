import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

type LogoMarkProps = {
  isDark: boolean;
  size?: number;
};

export function LogoMark({ isDark, size = 48 }: LogoMarkProps) {
  const red = isDark ? "#ef1b1b" : "#c92d28";
  const redDeep = isDark ? "#9e1016" : "#8f1d1b";
  const outline = isDark ? "#f8fafc" : "#30343b";
  const backplate = isDark ? "#090b10" : "#171318";

  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" accessibilityLabel="Battlefront logo">
      <Defs>
        <LinearGradient id="logoRed" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={red} />
          <Stop offset="1" stopColor={redDeep} />
        </LinearGradient>
        <LinearGradient id="logoMetal" x1="0" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="1" stopColor="#aeb4bc" />
        </LinearGradient>
      </Defs>
      <Path
        d="M50 3 94 24v43L50 97 6 67V24L50 3Z"
        fill={backplate}
        stroke={red}
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <Path
        d="M50 9 87 27v37L50 90 13 64V27L50 9Z"
        fill="none"
        stroke={outline}
        strokeOpacity="0.55"
        strokeWidth="1.25"
        strokeLinejoin="round"
      />
      <Path
        d="M16 29 38 16v28l-11 7V34l-11 6V29Zm0 25 22-13v16L16 70V54Z"
        fill="url(#logoRed)"
        stroke={redDeep}
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      <Path
        d="M44 16 64 27v25l-11-6V34l-9-5V16Zm0 30 27 14-12 6-15-8V46Z"
        fill="url(#logoRed)"
        stroke={redDeep}
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      <Path
        d="m30 68 20-11 21 11-9 5-12-6-11 6 11 6 21-11 9 5-30 16-30-16 10-5Z"
        fill="url(#logoMetal)"
        stroke={outline}
        strokeOpacity="0.7"
        strokeWidth="0.7"
        strokeLinejoin="round"
      />
      <Path
        d="m50 79 21-11 9 5-30 18-30-18 10-5 20 11Z"
        fill={backplate}
        opacity="0.9"
      />
    </Svg>
  );
}