# Battlefront React Native — UI/UX Performance Playbook

A reference for making the app *feel* fast, based on techniques used by Facebook/Instagram-scale apps, adapted for React Native.

---

## 1. Skeleton Screens

Use `react-native-skeleton-placeholder` or `moti` + `react-native-reanimated` for shimmer placeholders.

```jsx
import SkeletonPlaceholder from 'react-native-skeleton-placeholder';

const FeedItemSkeleton = () => (
  <SkeletonPlaceholder speed={1200}>
    <SkeletonPlaceholder.Item flexDirection="row" alignItems="center">
      <SkeletonPlaceholder.Item width={40} height={40} borderRadius={20} />
      <SkeletonPlaceholder.Item marginLeft={12}>
        <SkeletonPlaceholder.Item width={120} height={12} />
        <SkeletonPlaceholder.Item marginTop={6} width={80} height={10} />
      </SkeletonPlaceholder.Item>
    </SkeletonPlaceholder.Item>
  </SkeletonPlaceholder>
);
```

**Key detail:** match skeleton item height exactly to the real `FlashList` item height to avoid layout shift when real content swaps in.

---

## 2. Optimistic UI

Update local state instantly, fire the request in the background, roll back on failure.

```js
const useFeedStore = create((set) => ({
  posts: [],
  toggleLike: async (postId) => {
    set((state) => ({
      posts: state.posts.map(p =>
        p.id === postId
          ? { ...p, liked: !p.liked, likeCount: p.liked ? p.likeCount - 1 : p.likeCount + 1 }
          : p
      )
    }));
    try {
      await api.toggleLike(postId);
    } catch (e) {
      set((state) => ({
        posts: state.posts.map(p =>
          p.id === postId
            ? { ...p, liked: !p.liked, likeCount: p.liked ? p.likeCount - 1 : p.likeCount + 1 }
            : p
        )
      }));
      Toast.show({ type: 'error', text1: 'Could not update like' });
    }
  }
}));
```

**Key detail:** for created items (comments, posts), assign a temporary client-side UUID so it renders immediately, then reconcile with the server's real ID on response — without duplicating the item.

---

## 3. FlashList Virtualization

Use Shopify's `FlashList` instead of `FlatList` for large scrolling feeds.

```jsx
import { FlashList } from '@shopify/flash-list';

<FlashList
  data={posts}
  renderItem={({ item }) => <FeedItem post={item} />}
  estimatedItemSize={220}
/>
```

Tune `windowSize`, `initialNumToRender`, and `maxToRenderPerBatch` to avoid over-rendering off-screen items.

---

## 4. Image Handling

- Use `react-native-fast-image` for disk/memory caching and progressive loading.
- Serve responsive image sizes from the backend/CDN based on device resolution.
- Add blur-up placeholders (low-res thumbnail → full image swap).

```jsx
import FastImage from 'react-native-fast-image';

<FastImage
  style={{ width: 200, height: 200 }}
  source={{ uri: imageUrl, priority: FastImage.priority.normal }}
  resizeMode={FastImage.resizeMode.cover}
/>
```

---

## 5. Native-Thread Animations

Use `react-native-reanimated` (v3) and `react-native-gesture-handler` so animations run on the UI thread, not the JS thread.

```jsx
const opacity = useSharedValue(0);
const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

useEffect(() => {
  opacity.value = withTiming(1, { duration: 300 });
}, []);
```

Avoid `useState`-driven animations for anything performance-critical.

---

## 6. Reducing Bridge / JS-Thread Overhead

- Batch native calls where possible.
- Migrate to React Native's **New Architecture** (Fabric + TurboModules) to cut bridge serialization overhead.

---

## 7. Navigation Transitions

Use `@react-navigation/native-stack` (native primitives — UINavigationController / Fragment) instead of the JS-based stack navigator for smoother transitions.

---

## 8. Micro-Interactions

```jsx
<Pressable
  android_ripple={{ color: '#ccc' }}
  onPress={handleLike}
  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
>
  <HeartIcon />
</Pressable>
```

Add haptic feedback via `react-native-haptic-feedback` to reinforce that a tap registered.

---

## 9. Code Splitting / Lazy Loading

Lazy-load rarely used screens with `React.lazy` + Suspense, or split by navigator stack, to keep the initial bundle small.

---

## 10. Preloading / Prefetching

Prefetch a screen's data when a list item nears the viewport, or start prefetching on `onPressIn` rather than waiting for `onPress`.

---

## 11. Hermes Engine + Bytecode Precompilation

Enable Hermes (`hermesEnabled: true` in `android/app/build.gradle`; `:hermes_enabled => true` in `ios/Podfile`) — on by default in newer RN, but confirm it hasn't been disabled. Precompiled bytecode removes the JS parse step at launch, improving cold-start time.

---

## 12. Memoization to Prevent Re-render Cascades

```jsx
const FeedItem = React.memo(({ post, onLike }) => {
  // component body
}, (prev, next) =>
  prev.post.id === next.post.id &&
  prev.post.liked === next.post.liked &&
  prev.post.likeCount === next.post.likeCount
);
```

Pair with `useCallback` for any function passed as a prop, or a new reference each render defeats `React.memo`.

---

## 13. InteractionManager for Deferred Non-Critical Work

```js
InteractionManager.runAfterInteractions(() => {
  logAnalyticsEvent('feed_viewed');
  prefetchNextPage();
});
```

Defers analytics/prefetch work until after the current interaction/animation completes.

---

## 14. Debounce / Throttle on Scroll & Search

```js
const debouncedSearch = useMemo(
  () => debounce((query) => api.search(query), 300),
  []
);
```

For pagination, throttle `onEndReached` and set `onEndReachedThreshold={0.5}` so the next page loads before the user hits the literal bottom.

---

## 15. Font & Asset Preloading at App Boot

```js
import * as Font from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

async function prepare() {
  await SplashScreen.preventAutoHideAsync();
  await Font.loadAsync({ 'Inter-Bold': require('./assets/fonts/Inter-Bold.ttf') });
  await SplashScreen.hideAsync();
}
```

Keeps the splash screen visible until fonts/critical assets are ready, avoiding a flash of unstyled text (FOUT) or broken icon boxes.

---

## 16. Batched State Updates (React 18 Automatic Batching)

React 18+/RN 0.71+ auto-batches multiple `setState` calls inside async callbacks. On older versions, wrap manually:

```js
unstable_batchedUpdates(() => {
  setA(a);
  setB(b);
});
```

---

## 17. Persisted Cache with React Query

```js
const { data: posts } = useQuery({
  queryKey: ['feed'],
  queryFn: fetchFeed,
  staleTime: 30_000,
});
```

Shows cached data instantly, refetches in the background, and updates the UI only if data actually changed — removes a lot of hand-rolled cache/optimistic-UI logic.

---

## 18. Low-End Device Testing & Frame Budget Discipline

- Test on an actual budget Android device, or throttle CPU via the debugger.
- Treat any interaction dropping below 60fps (16.6ms/frame budget) as a bug.
- Use `react-native-performance` or Flipper's performance monitor to catch frame drops, not just visual inspection.

---

## Quick Reference Table

| # | Technique | Primary Tool/API | Solves |
|---|-----------|-------------------|--------|
| 1 | Skeleton screens | react-native-skeleton-placeholder / moti | Perceived load time |
| 2 | Optimistic UI | Zustand/Redux + rollback | Action latency |
| 3 | List virtualization | @shopify/flash-list | Feed scroll performance |
| 4 | Image caching | react-native-fast-image | Image load jank |
| 5 | Native-thread animation | react-native-reanimated | Animation jank |
| 6 | Reduced bridge overhead | New Architecture (Fabric/TurboModules) | JS-native communication cost |
| 7 | Native navigation | @react-navigation/native-stack | Transition smoothness |
| 8 | Micro-interactions | Pressable + haptics | Instant feedback |
| 9 | Code splitting | React.lazy + Suspense | Bundle size / startup |
| 10 | Prefetching | onPressIn / viewport-based | Navigation latency |
| 11 | Hermes bytecode | hermesEnabled flag | Cold-start time |
| 12 | Memoization | React.memo + useCallback | Re-render cascades |
| 13 | Deferred work | InteractionManager | JS thread contention |
| 14 | Debounce/throttle | lodash debounce/throttle | Excess renders/calls |
| 15 | Asset preloading | expo-font + expo-splash-screen | FOUT / icon flash |
| 16 | Batched updates | React 18 auto-batching | Redundant re-renders |
| 17 | Query caching | @tanstack/react-query | Stale/duplicate fetches |
| 18 | Frame budget discipline | react-native-performance / Flipper | Jank on low-end devices |
