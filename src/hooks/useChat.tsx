import { createContext, useContext, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AccessibilityInfo } from "react-native";
import { getChatbotReply, onSessionChange, resetChatContext } from "@/lib/api";
import { createChatState } from "@/lib/chatState";

function useChatValue() {
  const [store] = useState(() => createChatState(getChatbotReply, resetChatContext));
  const state = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState("");
  const opener = useRef<number | undefined>(undefined);
  const focusTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(focusTimer.current), []);
  useEffect(() => onSessionChange(() => { store.reset(); setDraft(""); }), [store]);
  return {
    ...state, visible, draft, setDraft,
    open: (target?: number | string) => { clearTimeout(focusTimer.current); const tag = Number(target); opener.current = Number.isFinite(tag) && tag > 0 ? tag : undefined; setVisible(true); },
    close: (restoreFocus = true) => {
      setVisible(false);
      if (restoreFocus && opener.current) focusTimer.current = setTimeout(() => { if (opener.current) AccessibilityInfo.setAccessibilityFocus(opener.current); }, 400);
    },
    send: store.send,
    reset: () => { store.reset(); setDraft(""); },
  };
}
const ChatContext = createContext<ReturnType<typeof useChatValue> | null>(null);
export function ChatProvider({ children }: { children: ReactNode }) {
  return <ChatContext.Provider value={useChatValue()}>{children}</ChatContext.Provider>;
}
export function useChat() {
  const value = useContext(ChatContext);
  if (!value) throw new Error("useChat requires ChatProvider");
  return value;
}
