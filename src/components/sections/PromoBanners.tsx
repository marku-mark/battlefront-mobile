import { useRef, useState } from "react";
import { Image as ExpoImage } from "expo-image";
import {
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import type { Banner } from "@/lib/data";
import { getResponsiveLayout } from "@/lib/responsive";

type PromoBannersProps = {
  banners: Banner[];
  onSelect?: (banner: Banner) => void;
};

export function PromoBanners({ banners, onSelect }: PromoBannersProps) {
  const { width } = useWindowDimensions();
  const layout = getResponsiveLayout(width);
  const bannerWidth = Math.min(layout.contentWidth - layout.horizontalPadding * 2, 920);
  const bannerHeight = Math.max(160, Math.min(280, bannerWidth * 0.42));
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const listRef = useRef<FlatList>(null);

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.x / bannerWidth);
    if (index === activeIndexRef.current) return;

    activeIndexRef.current = index;
    setActiveIndex(index);
  }

  if (banners.length === 0) return null;

  return (
    <View className="mt-4">
      <FlatList
        ref={listRef}
        data={banners}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: Math.max(layout.horizontalPadding, (width - bannerWidth) / 2) }}
        snapToInterval={bannerWidth}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <Pressable
            accessibilityLabel={`Open promotion: ${item.title}`}
            accessibilityRole="button"
            onPress={() => onSelect?.(item)}
            style={{ width: bannerWidth }}
            className="rounded-xl overflow-hidden bg-card border border-border"
          >
            <ExpoImage
              source={{ uri: item.image }}
              style={{ width: bannerWidth, height: bannerHeight }}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            <View className="absolute bottom-0 left-0 right-0 px-4 py-3.5 bg-background/75">
              <Text className="text-foreground font-bold text-base">
                {item.title}
              </Text>
              <Text className="text-foreground/75 text-xs mt-1">
                {item.subtitle}
              </Text>
            </View>
          </Pressable>
        )}
      />

      {banners.length > 1 && (
        <View className="flex-row justify-center gap-2 mt-2.5">
          {banners.map((banner, i) => (
            <View
              key={banner.id}
              className={`h-1.5 rounded-full ${
                i === activeIndex ? "bg-ring w-4" : "bg-border w-1.5"
              }`}
            />
          ))}
        </View>
      )}
    </View>
  );
}
