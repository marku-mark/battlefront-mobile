import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getLocalUserId, getProfile, login, logout, register, updateProfile, onSessionExpired, setAccessToken, type ApiUser, type AuthResult, type ProfileInput, type RegistrationInput } from "@/lib/api";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";
import { createProfileActions } from "@/lib/accountApi";
import { revokePushDevice } from "@/lib/pushDevice";
import { isVerificationContext, type VerificationContext } from "@/lib/accountApi";
import { verifyEmail, resendVerification } from "@/lib/api";

export type Session = { mode: "guest" } | { mode: "customer"; user: ApiUser & { displayName: string } };
type SessionContextValue = { session: Session; isHydrated: boolean; verification: VerificationContext | null; clearVerification: () => void; confirmEmail: (code: string) => Promise<void>; resendEmail: () => Promise<void>; signIn: (email: string, password: string) => Promise<boolean>; signUp: (fields: RegistrationInput) => Promise<boolean>; signOut: () => Promise<void>; saveProfile: (fields: ProfileInput, owner?: number) => Promise<ApiUser>; refreshProfile: () => Promise<ApiUser> };
const SessionContext = createContext<SessionContextValue | null>(null);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ mode: "guest" });
  const [isHydrated, setIsHydrated] = useState(false);
  const [verification, setVerification] = useState<VerificationContext | null>(null);
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
  const signIn = useCallback(async (email: string, password: string) => {
    const result = await login(email, password);
    if (isVerificationContext(result)) { setVerification(result); return false; }
    setVerification(null);
    return acceptAuthentication(result);
  }, [acceptAuthentication]);
  const signUp = useCallback(async (fields: RegistrationInput) => {
    const result = await register(fields);
    if (!isVerificationContext(result)) throw new Error("The server did not return an email verification request.");
    setVerification(result);
    return false;
  }, []);
  const clearVerification = useCallback(() => setVerification(null), []);
  const confirmEmail = useCallback(async (code: string) => {
    if (!verification) throw new Error("Return to sign in to request a verification code.");
    await verifyEmail(verification.verification_token, code);
    setVerification(null);
  }, [verification]);
  const resendEmail = useCallback(async () => {
    if (!verification) throw new Error("Return to sign in to request a verification code.");
    const current = verification;
    const details = await resendVerification(current.verification_token);
    setVerification((value) => value?.verification_token === current.verification_token ? { ...current, ...details } : value);
  }, [verification]);
  const { refreshProfile, saveProfile } = useMemo(() => createProfileActions({ getProfile: () => getProfile(true), updateProfile }, getLocalUserId, (user) => {
    setSession((current) => current.mode === "customer" && current.user.id === user.id ? { mode: "customer", user: { ...user, displayName: user.name } } : current);
  }), []);
  const customerId = session.mode === "customer" ? session.user.id : null;
  useEffect(() => {
    if (customerId === null) return;
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active") void refreshProfile().catch(() => undefined); });
    return () => subscription.remove();
  }, [customerId, refreshProfile]);
  const signOut = useCallback(async () => {
    try {
      await revokePushDevice().catch(() => undefined);
      await logout();
    }
    finally {
      setAccessToken(null); setSession({ mode: "guest" }); setVerification(null);
      if (Platform.OS !== "web") await SecureStore.deleteItemAsync("battlefront-api-token");
    }
  }, []);
  const value = useMemo(() => ({ session, isHydrated, verification, clearVerification, confirmEmail, resendEmail, signIn, signUp, signOut, saveProfile, refreshProfile }), [session, isHydrated, verification, clearVerification, confirmEmail, resendEmail, signIn, signUp, signOut, saveProfile, refreshProfile]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}
