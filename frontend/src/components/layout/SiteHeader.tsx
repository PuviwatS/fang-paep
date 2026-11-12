"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import styles from "./SiteHeader.module.css";

const NAV = [
  { href: "/leaderboard", label: "อันดับ" },
  { href: "/archive", label: "ย้อนหลัง" },
  { href: "/pricing", label: "พลัส" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const { ready, user, account, isPlus } = useAuth();
  const name = account?.profile?.displayName ?? user?.email?.split("@")[0] ?? "บัญชี";

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="ฟังแป๊บ หน้าแรก">
        ฟังแป๊บ
      </Link>

      <nav className={styles.nav} aria-label="เมนูหลัก">
        {/* Plus members don't need the sales page in the menu. */}
        {NAV.filter((item) => !(isPlus && item.href === "/pricing")).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={pathname.startsWith(item.href) ? `${styles.link} ${styles.active}` : styles.link}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className={styles.account}>
        {!ready ? (
          <span className={styles.placeholder} aria-hidden="true" />
        ) : user ? (
          <Link href="/account" className={styles.accountButton} data-testid="account-link">
            <span className={styles.accountName}>{name}</span>
            {isPlus && <span className={styles.plusBadge}>พลัส</span>}
          </Link>
        ) : (
          <Link href="/login" className={styles.loginButton} data-testid="login-link">
            เข้าสู่ระบบ
          </Link>
        )}
      </div>
    </header>
  );
}
