"use client";

import dynamic from "next/dynamic";

// The game depends on today's date, audio and localStorage, so it renders in the browser only.
const Game = dynamic(() => import("@/components/game").then((module) => module.Game), { ssr: false });

export default function HomePage() {
  return <Game />;
}
