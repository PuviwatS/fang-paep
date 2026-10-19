import type { Metadata, Viewport } from "next";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Providers } from "@/components/providers/Providers";
import { SiteFooter } from "@/components/ui/SiteFooter";
import "./globals.css";
import styles from "./layout.module.css";

export const metadata: Metadata = {
  title: "ฟังแป๊บ — ทายเพลงไทย",
  description: "ฟังแค่ครึ่งวินาที ทายได้ไหมว่าเพลงไทยเพลงอะไร",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#17131c",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* The root layout wraps every page, so the "single page" warning from this rule doesn't apply. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Anuphan:wght@400;500;600&family=Chakra+Petch:wght@500;600;700&display=swap"
        />
      </head>
      <body>
        <Providers>
          <div className={styles.shell}>
            <SiteHeader />
            <main className={styles.main}>{children}</main>
            <SiteFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
