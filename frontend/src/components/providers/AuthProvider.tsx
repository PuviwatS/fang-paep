"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiRequestError, authChangedEvent } from "@/lib/api/client";
import type { Account } from "@/lib/api/types";
import { hasImportedLocalGames, listFinishedLocalGames, markLocalGamesImported } from "@/lib/storage";

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthState {
  /** False until we know whether someone is logged in. */
  ready: boolean;
  user: AuthUser | null;
  account: Account | null;
  isPlus: boolean;
  refreshUser: () => Promise<void>;
  refreshAccount: () => Promise<void>;
  setAccount: (account: Account) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Copies finished guest games from this browser into the account, once per account. */
async function importLocalGamesOnce(userId: string) {
  if (hasImportedLocalGames(userId)) return;
  const games = listFinishedLocalGames();
  try {
    if (games.length > 0) await api.post("/api/import-local", { games });
    markLocalGamesImported(userId);
  } catch {
    // Try again on the next visit.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [account, setAccount] = useState<Account | null>(null);

  const refreshAccount = useCallback(async () => {
    try {
      setAccount(await api.get<Account>("/api/account"));
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) setAccount(null);
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const response = await api.get<{ user: AuthUser | null }>("/api/auth/me");
      setUser(response.user);
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) setUser(null);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void refreshUser();
    const clearExpiredSession = () => {
      setUser(null);
      setAccount(null);
      setReady(true);
    };
    window.addEventListener(authChangedEvent, clearExpiredSession);
    return () => window.removeEventListener(authChangedEvent, clearExpiredSession);
  }, [refreshUser]);

  // Load the account and import guest progress whenever a different player logs in.
  useEffect(() => {
    if (!user) {
      setAccount(null);
      return;
    }
    void importLocalGamesOnce(user.id).then(refreshAccount);
  }, [user?.id, refreshAccount]); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = useCallback(async () => {
    await api.post("/api/auth/signout");
    setUser(null);
    setAccount(null);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      ready,
      user,
      account,
      isPlus: account?.isPlus ?? false,
      refreshUser,
      refreshAccount,
      setAccount,
      signOut,
    }),
    [ready, user, account, refreshUser, refreshAccount, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
