"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "./AuthProvider";
import { SongCatalogProvider } from "./SongCatalogProvider";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <SongCatalogProvider>{children}</SongCatalogProvider>
    </AuthProvider>
  );
}
