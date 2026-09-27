import { useRef, useState } from "react";
import { Image as ExpoImage } from "expo-image";
import {
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  Text,
  View,
} from "react-native";
import type { Banner } from "@/lib/data";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const BANNER_WIDTH = SCREEN_WIDTH - 32; // 16px horizontal margin each side

type PromoBannersProps = {
  banners: Banner[];
  onSelect?: (banner: Banner) => void;
};

export function PromoBanners({ banners, onSelect }: PromoBannersProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const listRef = useRef<FlatList>(null);

  function handleScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const index = Math.round(e.nativeEvent.contentOffset.x / BANNER_WIDTH);
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
        contentContainerStyle={{ paddingHorizontal: 16, paddingRight: 20 }}
        snapToInterval={BANNER_WIDTH}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <Pressable
            accessibilityLabel={`Open promotion: ${item.title}`}
            accessibilityRole="button"
            onPress={() => onSelect?.(item)}
            style={{ width: BANNER_WIDTH }}
            className="rounded-xl overflow-hidden bg-card border border-border"
          >
            <ExpoImage
              source={{ uri: item.image }}
              style={{ width: BANNER_WIDTH, height: 172 }}
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
