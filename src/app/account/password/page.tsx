"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import ui from "@/components/ui/Page.module.css";
import { authErrorMessage } from "@/lib/auth-errors";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ChangePasswordPage() {
  const { ready, user } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) return setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
    setBusy(true);
    setError(null);
    const { error: updateError } = await getSupabaseBrowserClient().auth.updateUser({ password });
    setBusy(false);
    if (updateError) return setError(authErrorMessage(updateError));
    setDone(true);
  }

  if (ready && !user) {
    return (
      <div className={ui.page}>
        <h1 className={ui.title}>ตั้งรหัสผ่านใหม่</h1>
        <p className={ui.notice}>ลิงก์หมดอายุหรือยังไม่ได้เข้าสู่ระบบ</p>
        <Link href="/forgot" className={ui.link}>
          ขอลิงก์ใหม่
        </Link>
      </div>
    );
  }

  return (
    <div className={ui.page}>
      <h1 className={ui.title}>ตั้งรหัสผ่านใหม่</h1>
      {done ? (
        <div className={ui.card}>
          <p className={ui.success}>เปลี่ยนรหัสผ่านเรียบร้อย</p>
          <Link href="/account" className={ui.link}>
            ไปหน้าบัญชี
          </Link>
        </div>
      ) : (
        <form className={`${ui.card} ${ui.form}`} onSubmit={onSubmit}>
          <label className={ui.field}>
            รหัสผ่านใหม่
            <input
              className={ui.input}
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className={ui.field}>
            ยืนยันรหัสผ่านใหม่
            <input
              className={ui.input}
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              autoComplete="new-password"
            />
          </label>
          {error && (
            <p className={ui.error} role="alert">
              {error}
            </p>
          )}
          <button type="submit" className={ui.button} disabled={busy || !ready}>
            {busy ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </form>
      )}
    </div>
  );
}
