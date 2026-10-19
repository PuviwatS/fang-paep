import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

/**
 * Supabase client for route handlers, acting as the visitor: their session cookie is passed on,
 * so database functions see `auth.uid()` for a logged-in player and nothing for a guest.
 */
export function getSupabaseServerClient() {
  const { url, publishableKey } = getSupabaseEnv();
  const cookieStore = cookies();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a place that cannot set cookies; the middleware refreshes the session instead.
        }
      },
    },
  });
}

/** Cookie-less client for public, cacheable data such as the song list and plans. */
export function getSupabasePublicClient() {
  const { url, publishableKey } = getSupabaseEnv();
  return createClient<Database>(url, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
