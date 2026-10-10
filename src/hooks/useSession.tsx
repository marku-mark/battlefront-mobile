import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getLocalUserId, getProfile, login, logout, register, updateProfile, onSessionExpired, setAccessToken, type ApiUser, type AuthResult, type ProfileInput, type RegistrationInput } from "@/lib/api";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";
import { createProfileActions } from "@/lib/accountApi";
import { revokePushDevice } from "@/lib/pushDevice";

export type Session = { mode: "guest" } | { mode: "customer"; user: ApiUser & { displayName: string } };
type SessionContextValue = { session: Session; isHydrated: boolean; signIn: (email: string, password: string) => Promise<boolean>; signUp: (fields: RegistrationInput) => Promise<boolean>; signOut: () => Promise<void>; saveProfile: (fields: ProfileInput, owner?: number) => Promise<ApiUser>; refreshProfile: () => Promise<ApiUser> };
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
  const acceptAuthentication = useCallback(async (result: AuthResult) => {
    if (Platform.OS !== "web") await SecureStore.setItemAsync("battlefront-api-token", result.token);
    setAccessToken(result.token, result.user.id);
    setSession({ mode: "customer", user: { ...result.user, displayName: result.user.name } });
    return true;
  }, []);
  const signIn = useCallback(async (email: string, password: string) => acceptAuthentication(await login(email, password)), [acceptAuthentication]);
  const signUp = useCallback(async (fields: RegistrationInput) => acceptAuthentication(await register(fields)), [acceptAuthentication]);
  const { refreshProfile, saveProfile } = useMemo(() => createProfileActions({ getProfile, updateProfile }, getLocalUserId, (user) => {
    setSession((current) => current.mode === "customer" && current.user.id === user.id ? { mode: "customer", user: { ...user, displayName: user.name } } : current);
  }), []);
  const signOut = useCallback(async () => {
    try {
      await revokePushDevice().catch(() => undefined);
      await logout();
    }
    finally {
      setAccessToken(null); setSession({ mode: "guest" });
      if (Platform.OS !== "web") await SecureStore.deleteItemAsync("battlefront-api-token");
    }
  }, []);
  const value = useMemo(() => ({ session, isHydrated, signIn, signUp, signOut, saveProfile, refreshProfile }), [session, isHydrated, signIn, signUp, signOut, saveProfile, refreshProfile]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
