import Ionicons from "@expo/vector-icons/Ionicons";
import { useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { useChat } from "@/hooks/useChat";
import type { ChatMessage } from "@/lib/chatState";
import { useRouter } from "expo-router";

import { useTheme } from "@/theme/ThemeProvider";

export function Chatbot() {
  const { colors, reducedMotion } = useTheme();
  const { messages, pending: isReplying, error, retryAt, visible, close, draft, setDraft, send, reset } = useChat();
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const nearBottom = useRef(true);
  const [availableHeight, setAvailableHeight] = useState(height);
  const [keyboardTop, setKeyboardTop] = useState<number | null>(null);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow", (event) => setKeyboardTop(event.endCoordinates.height > 0 ? event.endCoordinates.screenY : null));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardTop(null));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const keyboardOverlap = keyboardTop === null ? 0 : Math.max(0, availableHeight - keyboardTop);
  const panelSpace = Math.max(0, availableHeight - keyboardOverlap - insets.top - 24);
  const [newMessage, setNewMessage] = useState(false);
  const [clock, setClock] = useState(Date.now());
  const cooldown = Math.max(0, Math.ceil((retryAt - clock) / 1000));
  useEffect(() => { if (messages.length === 1) { nearBottom.current = true; setNewMessage(false); } }, [messages.length]);
  useEffect(() => { if (retryAt <= Date.now()) return; setClock(Date.now()); const timer = setInterval(() => { setClock(Date.now()); if (Date.now() >= retryAt) clearInterval(timer); }, 1000); return () => clearInterval(timer); }, [retryAt]);
  useEffect(() => { if (visible && !isReplying && messages.length > 1) AccessibilityInfo.announceForAccessibility(messages[messages.length - 1].text); }, [messages, visible, isReplying]);
  function scrollToBottom() { nearBottom.current = true; setNewMessage(false); listRef.current?.scrollToEnd({ animated: !reducedMotion }); }
  function handleSend() { if (draft.trim() && !isReplying && !cooldown) { const text = draft; setDraft(""); nearBottom.current = true; void send(text); } }
  function clearConversation() { reset(); nearBottom.current = true; setNewMessage(false); }
  function onClose() { close(); }
  function navigate(path: "/orders" | "/store-locator") { close(false); router.push(path); }
  return (
    <Modal
      visible={visible}
      animationType={reducedMotion ? "none" : "slide"}
      transparent
      onRequestClose={onClose}
      onShow={() => { if (nearBottom.current) listRef.current?.scrollToEnd({ animated: false }); }}
    >
      <View
        className="flex-1 bg-black/45 justify-end items-center"
      >
        <View style={{ flex: 1, width: "100%", alignItems: "center", justifyContent: "flex-end" }} onLayout={({ nativeEvent }) => setAvailableHeight(nativeEvent.layout.height)}>
        <Pressable className="absolute inset-0" onPress={onClose} />
        <SafeAreaView edges={[]} style={{ width: Math.max(0, Math.min(520, width - 32 - insets.left - insets.right)), height: Math.min(height * 0.75, 640, panelSpace), marginBottom: keyboardOverlap + 8, paddingBottom: keyboardTop === null ? Math.max(insets.bottom, 8) : 8, borderRadius: 12 }} accessibilityViewIsModal className="bg-background border border-border overflow-hidden">
          <View className="flex-row items-center justify-between px-3 py-2 border-b border-border">
            <View className="flex-row items-center gap-2 flex-1">
              <View className="w-8 h-8 rounded-lg bg-primary items-center justify-center">
                <Ionicons name="chatbubble-ellipses" size={17} color={colors.primaryForeground} />
              </View>
              <View className="flex-1">
                <Text className="text-foreground text-base font-semibold">Support</Text>
                <Text className="text-muted-foreground text-xs">Automated shopping support</Text>
              </View>
            </View>
            <Pressable
              accessibilityLabel="Clear conversation"
              onPress={() => Alert.alert("New conversation?", "Clear this conversation?", [{ text: "Cancel", style: "cancel" }, { text: "Clear", style: "destructive", onPress: clearConversation }])}
              hitSlop={10}
              className="w-12 h-12 items-center justify-center"
            >
              <Ionicons name="refresh-outline" size={20} color={colors.icon} />
            </Pressable>
            <Pressable
              accessibilityLabel="Close chat"
              onPress={onClose}
              hitSlop={10}
              className="w-12 h-12 items-center justify-center"
            >
              <Ionicons name="close" size={23} color={colors.foreground} />
            </Pressable>
          </View>

          <FlatList
            ref={listRef}
            data={messages}
            onScroll={({ nativeEvent: e }) => { nearBottom.current = e.contentSize.height - e.contentOffset.y - e.layoutMeasurement.height < 80; if (nearBottom.current) setNewMessage(false); }}
            onContentSizeChange={() => { if (nearBottom.current) listRef.current?.scrollToEnd({ animated: !reducedMotion }); else setNewMessage(true); }}
            onLayout={() => { if (nearBottom.current) listRef.current?.scrollToEnd({ animated: false }); }}
            keyExtractor={(item) => item.id}
            className="flex-1"
            contentContainerStyle={{ padding: 16, gap: 10 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <View
                className={`max-w-[82%] rounded-lg px-3 py-2.5 ${
                  item.role === "user"
                    ? "self-end bg-primary"
                    : "self-start bg-card border border-border"
                }`}
              >
                <Text
                  className={`text-sm leading-5 ${
                    item.role === "user" ? "text-primary-foreground" : "text-foreground"
                  }`}
                >
                  {item.text}
                </Text>
                {item.status === "sending" && <Text className="text-primary-foreground text-xs mt-1">Sending…</Text>}
                {item.status === "failed" && <Pressable accessibilityRole="button" accessibilityLabel="Retry failed message" disabled={isReplying || cooldown > 0} onPress={() => void send(item.text, item.id)} className="min-h-12 justify-center"><Text className="text-primary-foreground text-sm underline">{cooldown ? `Retry in ${cooldown}s` : "Not sent · Retry"}</Text></Pressable>}
              </View>
            )}
            ListFooterComponent={
              isReplying ? (
                <Text className="text-muted-foreground text-xs">Typing...</Text>
              ) : null
            }
          />

          {newMessage && <Pressable accessibilityRole="button" onPress={scrollToBottom} className="min-h-12 items-center justify-center"><Text className="text-primary-text">New message ↓</Text></Pressable>}
          {!!error && <Text accessibilityLiveRegion="polite" className="px-4 py-2 text-danger text-sm">{error}</Text>}
          {messages.length === 1 && <View className="flex-row px-4 border-t border-border">
            <Pressable accessibilityRole="button" onPress={() => navigate("/orders")} className="min-h-12 flex-1 justify-center"><Text className="text-primary-text text-sm">View orders</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => navigate("/store-locator")} className="min-h-12 flex-1 justify-center"><Text className="text-primary-text text-sm">Store contact</Text></Pressable>
          </View>}
          <View className="flex-row items-end gap-2 px-4 py-3 border-t border-border">
            <TextInput
              accessibilityLabel="Message to support"
              value={draft}
              onChangeText={setDraft}
              placeholder="Ask about a product or order"
              placeholderTextColor={colors.muted}
              multiline
              maxLength={500}
              className="flex-1 min-h-12 bg-secondary border border-border rounded-lg px-3 py-2.5 text-foreground text-sm"
              style={{ maxHeight: height < 500 ? 56 : 96 }}
              onSubmitEditing={handleSend}
            />
            <Pressable
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: !draft.trim() || isReplying || cooldown > 0 }}
              disabled={!draft.trim() || isReplying || cooldown > 0}
              onPress={handleSend}
              className="w-12 h-12 rounded-lg bg-primary items-center justify-center"
              style={({ pressed }) => ({ opacity: !draft.trim() || isReplying || cooldown > 0 ? 0.45 : pressed ? 0.8 : 1 })}
            >
              <Ionicons name="send" size={17} color={colors.primaryForeground} />
            </Pressable>
          </View>
        </SafeAreaView>
        </View>
      </View>
    </Modal>
  );
}
