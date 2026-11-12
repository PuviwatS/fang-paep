"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import ui from "@/components/ui/Page.module.css";

/** Shows `children` only to logged-in players; everyone else is sent to /login and back. */
export function RequireLogin({ children }: { children: ReactNode }) {
  const { ready, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  useEffect(() => {
    if (!ready || user) return;
    const query = params.toString();
    const here = query ? `${pathname}?${query}` : pathname;
    router.replace(`/login?next=${encodeURIComponent(here)}`);
  }, [ready, user, pathname, params, router]);

  if (!ready || !user) return <p className={ui.muted}>กำลังโหลด…</p>;
  return <>{children}</>;
}
