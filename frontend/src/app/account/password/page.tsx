"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState, type FormEvent } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import ui from "@/components/ui/Page.module.css";
import { authErrorMessage } from "@/lib/auth-errors";
import { api, ApiRequestError } from "@/lib/api/client";

export default function ChangePasswordPage() {
  return (
    <Suspense fallback={<p className={ui.muted}>กำลังโหลด…</p>}>
      <ChangePasswordForm />
    </Suspense>
  );
}

function ChangePasswordForm() {
  const { ready, user, signOut } = useAuth();
  const token = useSearchParams().get("token");
  const resetting = Boolean(token);
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (password !== confirm) return setError("รหัสผ่านทั้งสองช่องไม่ตรงกัน");
    if (password.length < 8) return setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
    if (new TextEncoder().encode(password).length > 72) return setError("รหัสผ่านยาวเกิน 72 ไบต์");
    setBusy(true);
    setError(null);
    try {
      if (token) await api.post("/api/auth/reset-password", { token, password });
      else {
        await api.patch("/api/auth/change-password", { currentPassword, password });
        await signOut();
      }
      setDone(true);
    } catch (requestError) {
      setError(authErrorMessage(requestError instanceof ApiRequestError ? requestError : { message: "" }));
    } finally {
      setBusy(false);
    }
  }

  if (!done && !resetting && ready && !user) {
    return (
      <div className={ui.page}>
        <h1 className={ui.title}>เปลี่ยนรหัสผ่าน</h1>
        <p className={ui.notice}>กรุณาเข้าสู่ระบบก่อนเปลี่ยนรหัสผ่าน</p>
        <Link href="/login" className={ui.link}>
          ไปหน้าเข้าสู่ระบบ
        </Link>
      </div>
    );
  }

  return (
    <div className={ui.page}>
      <h1 className={ui.title}>{resetting ? "ตั้งรหัสผ่านใหม่" : "เปลี่ยนรหัสผ่าน"}</h1>
      {done ? (
        <div className={ui.card}>
          <p className={ui.success}>เปลี่ยนรหัสผ่านเรียบร้อย</p>
          <Link href="/login" className={ui.link}>
            ไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      ) : (
        <form className={`${ui.card} ${ui.form}`} onSubmit={onSubmit}>
          {!resetting && (
            <label className={ui.field}>
              รหัสผ่านปัจจุบัน
              <input
                className={ui.input}
                type="password"
                required
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>
          )}
          <label className={ui.field}>
            รหัสผ่านใหม่
            <input
              className={ui.input}
              type="password"
              required
              minLength={8}
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
              minLength={8}
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
          <button type="submit" className={ui.button} disabled={busy || (!resetting && !ready)}>
            {busy ? "กำลังบันทึก…" : "บันทึก"}
          </button>
        </form>
      )}
    </div>
  );
}
