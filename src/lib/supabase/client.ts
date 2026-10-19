"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { getSupabaseEnv } from "./env";

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

/** Supabase client for the browser. Used for sign-in and sign-up; game data goes through /api. */
export function getSupabaseBrowserClient() {
  if (!browserClient) {
    const { url, publishableKey } = getSupabaseEnv();
    browserClient = createBrowserClient<Database>(url, publishableKey);
  }
  return browserClient;
}
