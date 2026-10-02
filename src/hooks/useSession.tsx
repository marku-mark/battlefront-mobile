import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getProfile, login, logout, onSessionExpired, setAccessToken, type ApiUser } from "@/lib/api";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

export type Session = { mode: "guest" } | { mode: "customer"; user: ApiUser & { displayName: string } };
type SessionContextValue = { session: Session; isHydrated: boolean; signIn: (email: string, password: string) => Promise<boolean>; signOut: () => Promise<void> };
const SessionContext = createContext<SessionContextValue | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ mode: "guest" });
  const [isHydrated, setIsHydrated] = useState(false);
  useEffect(() => {
    let active = true;
    async function restoreSession() {
      try {
        const token = Platform.OS === "web" ? null : await SecureStore.getItemAsync("battlefront-api-token");
        if (!token || !active) return;
        setAccessToken(token);
        const user = await getProfile();
        if (!active) return;
        setAccessToken(token, user.id);
        setSession({ mode: "customer", user: { ...user, displayName: user.name } });
      } catch {
        setAccessToken(null);
      } finally { if (active) setIsHydrated(true); }
    }
    void restoreSession();
    const unsubscribe = onSessionExpired(() => {
      setSession({ mode: "guest" });
      if (Platform.OS !== "web") void SecureStore.deleteItemAsync("battlefront-api-token").catch(() => undefined);
    });
    return () => { active = false; unsubscribe(); };
  }, []);
  const signIn = useCallback(async (email: string, password: string) => {
    const result = await login(email, password);
    if (Platform.OS !== "web") await SecureStore.setItemAsync("battlefront-api-token", result.token);
    setAccessToken(result.token, result.user.id);
    setSession({ mode: "customer", user: { ...result.user, displayName: result.user.name } });
    return true;
  }, []);
  const signOut = useCallback(async () => {
    try { await logout(); }
    finally {
      setAccessToken(null); setSession({ mode: "guest" });
      if (Platform.OS !== "web") await SecureStore.deleteItemAsync("battlefront-api-token");
    }
  }, []);
  const value = useMemo(() => ({ session, isHydrated, signIn, signOut }), [session, isHydrated, signIn, signOut]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
