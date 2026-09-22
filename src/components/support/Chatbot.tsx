import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getChatbotReply } from "@/lib/api";
import { useTheme } from "@/theme/ThemeProvider";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type ChatbotProps = {
  visible: boolean;
  onClose: () => void;
};

const welcomeMessage: ChatMessage = {
  id: "welcome",
  role: "assistant",
  text: "Hi! I can help you find parts, compare products, or check an order.",
};

const quickQuestions = [
  "Where is my order?",
  "Recommend a GPU",
  "Laptop options",
  "How does delivery work?",
];

export function Chatbot({ visible, onClose }: ChatbotProps) {
  const { isDark } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([welcomeMessage]);
  const [draft, setDraft] = useState("");
  const [isReplying, setIsReplying] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    if (visible) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 0);
    }
  }, [messages, visible]);

  async function handleSend() {
    const text = draft.trim();
    if (!text || isReplying) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text,
    };
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setIsReplying(true);

    const reply = await getChatbotReply(text);
    setMessages((current) => [
      ...current,
      { id: `assistant-${Date.now()}`, role: "assistant", text: reply },
    ]);
    setIsReplying(false);
  }

  function handleQuickQuestion(question: string) {
    setDraft(question);
    void sendMessage(question);
  }

  async function sendMessage(text: string) {
    if (!text || isReplying) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text,
    };
    setMessages((current) => [...current, userMessage]);
    setDraft("");
    setIsReplying(true);

    const reply = await getChatbotReply(text);
    setMessages((current) => [
      ...current,
      { id: `assistant-${Date.now()}`, role: "assistant", text: reply },
    ]);
    setIsReplying(false);
  }

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        className="flex-1 bg-black/45 justify-end items-end"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable className="absolute inset-0" onPress={onClose} />
        <SafeAreaView className="w-[94%] max-w-[420px] mr-3 mb-3 bg-background rounded-2xl border border-border overflow-hidden">
          <View className="flex-row items-center justify-between px-4 py-3 border-b border-border">
            <View className="flex-row items-center gap-2">
              <View className="w-8 h-8 rounded-xl bg-primary items-center justify-center">
                <Ionicons name="chatbubble-ellipses" size={17} color="#f8fafc" />
              </View>
              <View>
                <Text className="text-foreground text-base font-semibold">Battlefront Support</Text>
                <Text className="text-muted-foreground text-[11px]">Quick answers, anytime</Text>
              </View>
            </View>
            <Pressable
              accessibilityLabel="Close chat"
              onPress={onClose}
              hitSlop={10}
              className="w-9 h-9 items-center justify-center"
            >
              <Ionicons name="close" size={23} color={isDark ? "#f8fafc" : "#30343b"} />
            </Pressable>
          </View>

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(item) => item.id}
            className="max-h-[300px]"
            contentContainerStyle={{ padding: 16, gap: 10 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <View
                className={`max-w-[82%] rounded-2xl px-3 py-2.5 ${
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
              </View>
            )}
            ListFooterComponent={
              isReplying ? (
                <Text className="text-muted-foreground text-xs">Typing...</Text>
              ) : null
            }
          />

          <View className="px-4 pb-2">
            <Text className="text-muted-foreground text-[11px] mb-2">Quick questions</Text>
            <View className="flex-row flex-wrap gap-2">
              {quickQuestions.map((question) => (
                <Pressable
                  key={question}
                  disabled={isReplying}
                  onPress={() => handleQuickQuestion(question)}
                  className="border border-border bg-secondary rounded-xl px-2.5 py-2"
                  style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                >
                  <Text className="text-foreground text-[11px]">{question}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="flex-row items-end gap-2 px-4 py-3 border-t border-border">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Ask about a product or order"
              placeholderTextColor="#94a3b8"
              multiline
              maxLength={500}
              className="flex-1 max-h-24 min-h-11 bg-secondary border border-border rounded-xl px-3 py-2.5 text-foreground text-sm"
              onSubmitEditing={handleSend}
            />
            <Pressable
              accessibilityLabel="Send message"
              accessibilityState={{ disabled: !draft.trim() || isReplying }}
              disabled={!draft.trim() || isReplying}
              onPress={handleSend}
              className="w-11 h-11 rounded-xl bg-primary items-center justify-center"
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
            >
              <Ionicons name="send" size={17} color="#f8fafc" />
            </Pressable>
          </View>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}
