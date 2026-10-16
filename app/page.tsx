"use client";

import dynamic from "next/dynamic";

// The game depends on today's date, audio and localStorage, so it renders only in the browser.
const Game = dynamic(() => import("@/components/Game"), { ssr: false });

export default function Page() {
  return <Game />;
}
