"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";
import ui from "@/components/ui/Page.module.css";
import { authErrorMessage } from "@/lib/auth-errors";
import { api, ApiRequestError } from "@/lib/api/client";
import { safeNextPath } from "@/lib/safe-next";

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<p className={ui.muted}>กำลังยืนยันอีเมล…</p>}>
      <VerifyEmail />
    </Suspense>
  );
}

function VerifyEmail() {
  const router = useRouter();
  const params = useSearchParams();
  const { refreshUser } = useAuth();
  const ran = useRef(false);
  const [failed, setFailed] = useState(false);
  const [email, setEmail] = useState("");
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const token = params.get("token");
    const next = safeNextPath(params.get("next"));
    if (!token) return setFailed(true);
    window.history.replaceState(null, "", "/auth/callback");
    void api
      .post("/api/auth/verify-email", { token })
      .then(async () => {
        await refreshUser();
        router.replace(`${next}${next.includes("?") ? "&" : "?"}welcome=1`);
      })
      .catch(() => setFailed(true));
  }, [params, refreshUser, router]);

  async function resendVerification() {
    setResending(true);
    setError(null);
    try {
      await api.post("/api/auth/resend-verification", { email });
      setResent(true);
    } catch (requestError) {
      setError(authErrorMessage(requestError instanceof ApiRequestError ? requestError : { message: "" }));
    } finally {
      setResending(false);
    }
  }

  if (failed)
    return (
      <div className={ui.page}>
        <h1 className={ui.title}>ยืนยันอีเมลไม่สำเร็จ</h1>
        <p className={ui.notice}>ลิงก์หมดอายุหรือใช้ไปแล้ว กรุณาขอลิงก์ยืนยันใหม่</p>
        {resent ? (
          <p className={ui.success}>ส่งลิงก์ยืนยันใหม่แล้ว กรุณาเช็คอีเมล</p>
        ) : (
          <form
            className={`${ui.card} ${ui.form}`}
            onSubmit={(event) => {
              event.preventDefault();
              void resendVerification();
            }}
          >
            <label className={ui.field}>
              อีเมลที่ใช้สมัคร
              <input
                className={ui.input}
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </label>
            {error && <p className={ui.error}>{error}</p>}
            <button type="submit" className={ui.button} disabled={resending}>
              {resending ? "กำลังส่ง…" : "ส่งลิงก์ยืนยันอีกครั้ง"}
            </button>
          </form>
        )}
        <Link href="/login" className={ui.link}>
          ไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    );
  return <p className={ui.muted}>กำลังยืนยันอีเมล…</p>;
}
