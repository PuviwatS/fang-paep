import type { Metadata } from "next";
import { Suspense } from "react";
import { RequireLogin } from "@/components/auth/RequireLogin";
import { AccountView } from "./AccountView";

export const metadata: Metadata = { title: "บัญชีของฉัน — ฟังแป๊บ" };

export default function AccountPage() {
  return (
    <Suspense>
      <RequireLogin>
        <AccountView />
      </RequireLogin>
    </Suspense>
  );
}
