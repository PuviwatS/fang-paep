"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import ui from "@/components/ui/Page.module.css";
import { authErrorMessage } from "@/lib/auth-errors";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: resetError } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/account/password`,
    });
    setBusy(false);
    if (resetError) return setError(authErrorMessage(resetError));
    setSent(true);
  }

  return (
    <div className={ui.page}>
      <h1 className={ui.title}>ลืมรหัสผ่าน</h1>
      {sent ? (
        <div className={ui.card}>
          <p className={ui.success}>ถ้ามีบัญชีที่ใช้อีเมลนี้ เราส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้แล้ว</p>
          <Link href="/login" className={ui.link}>
            กลับไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      ) : (
        <form className={`${ui.card} ${ui.form}`} onSubmit={onSubmit}>
          <p className={ui.muted}>กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้</p>
          <label className={ui.field}>
            อีเมล
            <input
              className={ui.input}
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
            />
          </label>
          {error && (
            <p className={ui.error} role="alert">
              {error}
            </p>
          )}
          <button type="submit" className={ui.button} disabled={busy}>
            {busy ? "กำลังส่ง…" : "ส่งลิงก์"}
          </button>
        </form>
      )}
    </div>
  );
}
