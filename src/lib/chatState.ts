export type ChatMessage = { id: string; role: "assistant" | "user"; text: string; status?: "sending" | "sent" | "failed" };
export type ChatState = { messages: ChatMessage[]; pending: boolean; error: string; retryAt: number };
export function createChatState(send: (text: string) => Promise<string>, resetContext: () => void, now = Date.now) {
  let sequence = 0;
  let generation = 0;
  const listeners = new Set<() => void>();
  const initial = (): ChatState => ({ messages: [{ id: "welcome", role: "assistant", text: "Hi! Ask about products or delivery, or use View orders to check your purchases." }], pending: false, error: "", retryAt: 0 });
  let state = initial();
  function publish(next: ChatState) { state = next; listeners.forEach((listener) => listener()); }
  return {
    snapshot: () => state,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    reset() { generation++; resetContext(); publish(initial()); },
    async send(text: string, retryId?: string) {
      text = text.trim();
      if (!text || state.pending || now() < state.retryAt) return false;
      const previous = retryId ? state.messages.find((message) => message.id === retryId && message.status === "failed") : undefined;
      if (retryId && !previous) return false;
      if (text.length > 500) { publish({ ...state, error: "Keep messages within 500 characters." }); return false; }
      const owner = generation;
      const id = previous?.id ?? `message-${++sequence}`;
      const message: ChatMessage = { id, role: "user", text: previous?.text ?? text, status: "sending" };
      publish({ ...state, pending: true, error: "", messages: previous ? state.messages.map((row) => row.id === id ? message : row) : [...state.messages, message] });
      try {
        const reply = await send(message.text);
        if (owner !== generation) return false;
        if (typeof reply !== "string" || !reply.trim()) throw new Error("Support returned an unexpected reply. Please try again.");
        publish({ messages: [...state.messages.map((row) => row.id === id ? { ...row, status: "sent" as const } : row), { id: `message-${++sequence}`, role: "assistant", text: reply }], pending: false, error: "", retryAt: 0 });
        return true;
      } catch (error) {
        if (owner !== generation) return false;
        const failure = error as { message?: string; status?: number; retryAfter?: number };
        publish({ ...state, pending: false, error: failure.message || "Support is unavailable. Please try again.", retryAt: failure.status === 429 ? now() + Math.max(1, failure.retryAfter ?? 60) * 1000 : 0, messages: state.messages.map((row) => row.id === id ? { ...row, status: "failed" } : row) });
        return false;
      }
    },
  };
}
