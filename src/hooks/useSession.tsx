import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEMO_ACCOUNT } from "@/lib/mockAccount";

export type Session =
  | { mode: "guest" }
  | { mode: "mock-account"; user: { email: string; displayName: string } };

type SessionContextValue = {
  session: Session;
  isHydrated: boolean;
  signIn: (email: string, password: string) => boolean;
  signOut: () => void;
};

const SESSION_STORAGE_KEY = "battlefront-session-mode";
const SessionContext = createContext<SessionContextValue | null>(null);

function createDemoSession(): Session {
  return {
    mode: "mock-account",
    user: { email: DEMO_ACCOUNT.email, displayName: DEMO_ACCOUNT.displayName },
  };
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session>({ mode: "guest" });
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SESSION_STORAGE_KEY)
      .then((storedMode) => {
        if (storedMode === "mock-account") setSession(createDemoSession());
      })
      .catch(() => undefined)
      .finally(() => setIsHydrated(true));
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    AsyncStorage.setItem(SESSION_STORAGE_KEY, session.mode).catch(() => undefined);
  }, [isHydrated, session.mode]);

  const signIn = useCallback((email: string, password: string) => {
    if (
      email.trim().toLowerCase() !== DEMO_ACCOUNT.email ||
      password !== DEMO_ACCOUNT.password
    ) {
      return false;
    }

    setSession(createDemoSession());
    return true;
  }, []);

  const signOut = useCallback(() => setSession({ mode: "guest" }), []);
  const value = useMemo(
    () => ({ session, isHydrated, signIn, signOut }),
    [isHydrated, session, signIn, signOut]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used inside SessionProvider");
  return context;
}