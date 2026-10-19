"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "@/components/providers/AuthProvider";
import ui from "@/components/ui/Page.module.css";
import { api, ApiRequestError } from "@/lib/api/client";
import type { Account } from "@/lib/api/types";
import { CATEGORIES } from "@/lib/constants";
import { formatBaht, formatPercent, formatThaiDate } from "@/lib/format";
import type { Category, PlayerStats } from "@/lib/types";

function errorText(error: unknown): string {
  return error instanceof ApiRequestError ? error.message : "ทำรายการไม่สำเร็จ ลองอีกครั้ง";
}

export function AccountView() {
  const router = useRouter();
  const welcome = useSearchParams().get("welcome");
  const { user, account, setAccount, signOut } = useAuth();

  return (
    <div className={ui.page}>
      <h1 className={ui.title}>บัญชีของฉัน</h1>
      {welcome === "plus" && (
        <p className={ui.success}>ยินดีต้อนรับสู่พลัส! โฆษณาถูกปิดแล้ว และเล่นเกมย้อนหลังได้เลย</p>
      )}
      {welcome === "1" && <p className={ui.success}>ยืนยันอีเมลเรียบร้อย ยินดีต้อนรับ!</p>}
      {!account ? (
        <p className={ui.muted}>กำลังโหลดข้อมูลบัญชี…</p>
      ) : (
        <>
          <ProfileCard account={account} email={user?.email ?? ""} onSaved={setAccount} />
          <SubscriptionCard account={account} onChanged={setAccount} />
          <StatsCard />
        </>
      )}
      <div className={ui.row}>
        <Link href="/account/password" className={ui.ghostButton}>
          เปลี่ยนรหัสผ่าน
        </Link>
        <button
          type="button"
          className={ui.ghostButton}
          onClick={async () => {
            await signOut();
            router.replace("/");
          }}
        >
          ออกจากระบบ
        </button>
      </div>
    </div>
  );
}

function ProfileCard({
  account,
  email,
  onSaved,
}: {
  account: Account;
  email: string;
  onSaved: (account: Account) => void;
}) {
  const [name, setName] = useState(account.profile?.displayName ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      onSaved(await api.patch<Account>("/api/account", { displayName: name }));
      setMessage({ ok: true, text: "บันทึกชื่อแล้ว" });
    } catch (error) {
      setMessage({ ok: false, text: errorText(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className={`${ui.card} ${ui.form}`} onSubmit={onSubmit}>
      <h2 className={ui.cardTitle}>โปรไฟล์</h2>
      <p className={ui.muted}>อีเมล: {email}</p>
      <label className={ui.field}>
        ชื่อที่แสดงในอันดับ
        <input
          className={ui.input}
          name="displayName"
          value={name}
          maxLength={40}
          required
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      {message && <p className={message.ok ? ui.success : ui.error}>{message.text}</p>}
      <div className={ui.row}>
        <button
          type="submit"
          className={ui.button}
          disabled={busy || name.trim() === account.profile?.displayName}
        >
          {busy ? "กำลังบันทึก…" : "บันทึกชื่อ"}
        </button>
      </div>
    </form>
  );
}

function SubscriptionCard({
  account,
  onChanged,
}: {
  account: Account;
  onChanged: (account: Account) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const subscription = account.subscription;

  async function run(path: string) {
    setBusy(true);
    setError(null);
    try {
      onChanged(await api.post<Account>(path));
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={ui.card} data-testid="subscription-card">
      <h2 className={ui.cardTitle}>
        สมาชิกพลัส {account.isPlus && <span className={ui.badge}>ใช้งานอยู่</span>}
      </h2>

      {!subscription || !account.isPlus ? (
        <>
          <p className={ui.muted}>ยังไม่ได้เป็นสมาชิก สมัครเพื่อปิดโฆษณาและเล่นเกมย้อนหลังได้ทุกวัน</p>
          <div className={ui.row}>
            <Link href="/pricing" className={ui.button}>
              ดูแพ็กเกจ
            </Link>
          </div>
        </>
      ) : (
        <>
          <p className={ui.muted}>
            {subscription.planName} · {formatBaht(subscription.priceThb)}/
            {subscription.billingInterval === "year" ? "ปี" : "เดือน"}
          </p>
          <p className={ui.muted}>
            {subscription.cancelAtPeriodEnd
              ? `ยกเลิกแล้ว ใช้ได้ถึง ${formatThaiDate(subscription.currentPeriodEnd)}`
              : `ต่ออายุอัตโนมัติ ${formatThaiDate(subscription.currentPeriodEnd)}`}
          </p>
          {subscription.provider === "mock" && <p className={ui.notice}>โหมดทดสอบ: ยังไม่มีการตัดเงินจริง</p>}
          <div className={ui.row}>
            {subscription.cancelAtPeriodEnd ? (
              <button
                type="button"
                className={ui.button}
                disabled={busy}
                onClick={() => run("/api/subscription/resume")}
              >
                กลับมาต่ออายุ
              </button>
            ) : (
              <button
                type="button"
                className={ui.ghostButton}
                disabled={busy}
                onClick={() => run("/api/subscription/cancel")}
              >
                ยกเลิกการต่ออายุ
              </button>
            )}
          </div>
        </>
      )}
      {error && <p className={ui.error}>{error}</p>}
    </section>
  );
}

function StatsCard() {
  const [category, setCategory] = useState<Category>("all");
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setStats(null);
    setError(null);
    api
      .get<PlayerStats>(`/api/stats?category=${category}`)
      .then((data) => active && setStats(data))
      .catch((requestError) => active && setError(errorText(requestError)));
    return () => {
      active = false;
    };
  }, [category]);

  const items = stats
    ? [
        { label: "เล่น", value: String(stats.played) },
        { label: "ชนะ", value: formatPercent(stats.wins, stats.played) },
        { label: "ติดกัน", value: String(stats.streak) },
        { label: "สูงสุด", value: String(stats.bestStreak) },
      ]
    : [];

  return (
    <section className={ui.card}>
      <h2 className={ui.cardTitle}>สถิติของฉัน</h2>
      <div className={ui.tabs}>
        {CATEGORIES.map((item) => (
          <button
            key={item.key}
            type="button"
            className={item.key === category ? `${ui.tab} ${ui.tabActive}` : ui.tab}
            onClick={() => setCategory(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
      {error ? (
        <p className={ui.error}>{error}</p>
      ) : !stats ? (
        <p className={ui.muted}>กำลังโหลด…</p>
      ) : (
        <div className={ui.statGrid}>
          {items.map((item) => (
            <div key={item.label}>
              <span className={ui.statValue}>{item.value}</span>
              <span className={ui.statLabel}>{item.label}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
