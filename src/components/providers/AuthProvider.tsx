"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api/client";
import type { Account } from "@/lib/api/types";
import { hasImportedLocalGames, listFinishedLocalGames, markLocalGamesImported } from "@/lib/storage";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

interface AuthState {
  /** False until we know whether someone is logged in. */
  ready: boolean;
  user: User | null;
  account: Account | null;
  isPlus: boolean;
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
  const supabase = getSupabaseBrowserClient();
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<Account | null>(null);

  const refreshAccount = useCallback(async () => {
    try {
      setAccount(await api.get<Account>("/api/account"));
    } catch {
      setAccount(null);
    }
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!active) return;
      setUser(data.user);
      setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setReady(true);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [supabase]);

  // Load the account and import guest progress whenever a different player logs in.
  useEffect(() => {
    if (!user) {
      setAccount(null);
      return;
    }
    void importLocalGamesOnce(user.id).then(refreshAccount);
  }, [user?.id, refreshAccount]); // eslint-disable-line react-hooks/exhaustive-deps

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setAccount(null);
  }, [supabase]);

  const value = useMemo<AuthState>(
    () => ({ ready, user, account, isPlus: account?.isPlus ?? false, refreshAccount, setAccount, signOut }),
    [ready, user, account, refreshAccount, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
