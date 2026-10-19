"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import ui from "@/components/ui/Page.module.css";
import { authErrorMessage } from "@/lib/auth-errors";
import { safeNextPath } from "@/lib/safe-next";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Mode = "login" | "register";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNextPath(params.get("next"));
  const { ready, user } = useAuth();

  const [mode, setMode] = useState<Mode>(params.get("mode") === "register" ? "register" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    params.get("error") === "link" ? "ลิงก์ยืนยันหมดอายุหรือใช้ไปแล้ว ลองเข้าสู่ระบบอีกครั้ง" : null,
  );
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Already logged in: go where the player was heading.
  useEffect(() => {
    if (ready && user) router.replace(next);
  }, [ready, user, next, router]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = getSupabaseBrowserClient();

    if (mode === "login") {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (signInError) return setError(authErrorMessage(signInError));
      router.replace(next);
      router.refresh();
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName.trim() || undefined },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(false);
    if (signUpError) return setError(authErrorMessage(signUpError));
    // With email confirmation on, there is no session yet: ask the player to check their inbox.
    if (!data.session) return setSentTo(email);
    router.replace(next);
  }

  if (sentTo) {
    return (
      <div className={ui.page}>
        <h1 className={ui.title}>เช็คอีเมลของคุณ</h1>
        <div className={ui.card}>
          <p className={ui.muted}>
            ส่งลิงก์ยืนยันไปที่ <strong>{sentTo}</strong> แล้ว กดลิงก์ในอีเมลเพื่อเปิดใช้บัญชี
            (ถ้าไม่เห็นให้ดูในโฟลเดอร์สแปม)
          </p>
          <button type="button" className={ui.ghostButton} onClick={() => setSentTo(null)}>
            กลับ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={ui.page}>
      <h1 className={ui.title}>{mode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}</h1>
      <p className={ui.lead}>เก็บสถิติข้ามเครื่อง ติดอันดับรายวัน และสมัครพลัสได้</p>

      <div className={ui.tabs} role="tablist">
        {(["login", "register"] as const).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            className={mode === key ? `${ui.tab} ${ui.tabActive}` : ui.tab}
            onClick={() => {
              setMode(key);
              setError(null);
            }}
          >
            {key === "login" ? "เข้าสู่ระบบ" : "สมัครใหม่"}
          </button>
        ))}
      </div>

      <form className={`${ui.card} ${ui.form}`} onSubmit={onSubmit}>
        {mode === "register" && (
          <label className={ui.field}>
            ชื่อที่แสดงในอันดับ
            <input
              className={ui.input}
              name="displayName"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              maxLength={40}
              placeholder="เช่น หูทอง"
              autoComplete="nickname"
            />
          </label>
        )}
        <label className={ui.field}>
          อีเมล
          <input
            className={ui.input}
            type="email"
            name="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
          />
        </label>
        <label className={ui.field}>
          รหัสผ่าน
          <input
            className={ui.input}
            type="password"
            name="password"
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </label>

        {error && (
          <p className={ui.error} role="alert">
            {error}
          </p>
        )}

        <button type="submit" className={ui.button} disabled={busy}>
          {busy ? "กำลังดำเนินการ…" : mode === "login" ? "เข้าสู่ระบบ" : "สมัครสมาชิก"}
        </button>

        {mode === "login" && (
          <Link href="/forgot" className={ui.link}>
            ลืมรหัสผ่าน?
          </Link>
        )}
      </form>

      <p className={ui.muted}>ความคืบหน้าที่เล่นไว้ในเครื่องนี้จะถูกย้ายเข้าบัญชีให้อัตโนมัติ</p>
    </div>
  );
}
