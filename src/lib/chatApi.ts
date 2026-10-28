export function createChatApi(request: <T>(path: string, options?: RequestInit) => Promise<T>) {
  let context: string | null = null;
  let generation = 0;
  return {
    reset() { context = null; generation++; },
    async reply(message: string): Promise<string> {
      const owner = generation;
      const response = await request<{ data: { message: string; context_token: string | null } }>("chatbot", { method: "POST", body: JSON.stringify({ message, context_token: context }) });
      const result = response?.data;
      if (!result || typeof result.message !== "string" || !result.message.trim() || (result.context_token !== null && typeof result.context_token !== "string")) throw new Error("Support returned an unexpected reply. Please try again.");
      if (owner === generation) context = result.context_token;
      return result.message;
    },
  };
}
