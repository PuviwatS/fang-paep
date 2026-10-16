"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CATEGORIES,
  Category,
  Guess,
  MAX_TRIES,
  Preview,
  SNIPPETS,
  SONGS,
  Song,
  baseTitle,
  dailySong,
  dayNumber,
  evaluate,
  lookupPreview,
  randomSong,
  searchSongs,
  shareText,
} from "@/lib/game";

type Mode = "daily" | "practice";

interface Saved {
  guesses: { result: Guess["result"]; id?: number }[];
}

interface Stats {
  played: number;
  wins: number;
  streak: number;
  best: number;
  lastDay: number;
}

const FULL = SNIPPETS[SNIPPETS.length - 1];
const byId = new Map(SONGS.map((s) => [s.id, s]));

function load<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable: the game still works, it just won't remember */
  }
}

function recordResult(cat: Category, day: number, won: boolean): Stats {
  const key = `fp:stats:${cat}`;
  const s = load<Stats>(key) ?? { played: 0, wins: 0, streak: 0, best: 0, lastDay: 0 };
  if (s.lastDay === day) return s;
  s.played += 1;
  if (won) {
    s.wins += 1;
    s.streak = s.lastDay === day - 1 ? s.streak + 1 : 1;
    s.best = Math.max(s.best, s.streak);
  } else {
    s.streak = 0;
  }
  s.lastDay = day;
  save(key, s);
  return s;
}

function untilMidnightBangkok(): string {
  const now = Date.now() + 7 * 3600 * 1000;
  const left = 86_400_000 - (now % 86_400_000);
  const h = Math.floor(left / 3_600_000);
  const m = Math.floor((left % 3_600_000) / 60_000);
  return `${h} ชม. ${m} นาที`;
}

export default function Game() {
  const day = useMemo(() => dayNumber(), []);
  const [cat, setCat] = useState<Category>("all");
  const [mode, setMode] = useState<Mode>("daily");
  const [answer, setAnswer] = useState<Song>(() => dailySong("all", day));
  const [guesses, setGuesses] = useState<Guess[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [audioError, setAudioError] = useState("");
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [stats, setStats] = useState<Stats | null>(null);
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  // Which saved game the current `guesses` belong to, so switching tabs never overwrites another tab's save.
  const [loadedKey, setLoadedKey] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number>(0);

  const won = guesses.some((g) => g.result === "correct");
  const finished = won || guesses.length >= MAX_TRIES;
  const unlocked = finished ? FULL : SNIPPETS[guesses.length];
  const storageKey = `fp:day:${day}:${cat}`;

  // First visit: open the rules once.
  useEffect(() => {
    if (!load<boolean>("fp:seen-help")) {
      setShowHelp(true);
      save("fp:seen-help", true);
    }
  }, []);

  // Pick the song whenever the category or mode changes.
  useEffect(() => {
    if (mode === "daily") {
      const song = dailySong(cat, day);
      setAnswer(song);
      const saved = load<Saved>(`fp:day:${day}:${cat}`);
      setGuesses(
        saved?.guesses.map((g) => ({ result: g.result, song: g.id ? byId.get(g.id) : undefined })) ?? [],
      );
      setLoadedKey(`fp:day:${day}:${cat}`);
    } else {
      setAnswer((prev) => randomSong(cat, prev.id));
      setGuesses([]);
      setLoadedKey("");
    }
    setStats(null);
    setQuery("");
    setCopied(false);
  }, [cat, mode, day]);

  // Fetch the 30-second preview URL for the current answer from iTunes.
  useEffect(() => {
    let cancelled = false;
    stop();
    setPreview(null);
    setAudioError("");
    lookupPreview(answer.id)
      .then((p) => {
        if (cancelled) return;
        setPreview(p);
        const a = audioRef.current ?? new Audio();
        audioRef.current = a;
        a.preload = "auto";
        a.src = p.previewUrl;
        a.load();
      })
      .catch(() => !cancelled && setAudioError("โหลดเสียงจาก iTunes ไม่สำเร็จ ลองเปลี่ยนเพลงหรือรีเฟรชหน้า"));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answer.id]);

  // Persist daily progress and record stats once the game ends.
  useEffect(() => {
    if (mode !== "daily" || loadedKey !== storageKey) return;
    save(storageKey, { guesses: guesses.map((g) => ({ result: g.result, id: g.song?.id })) } satisfies Saved);
    if (finished) setStats(recordResult(cat, day, won));
  }, [guesses, mode, storageKey, loadedKey, finished, cat, day, won]);

  function stop() {
    cancelAnimationFrame(rafRef.current);
    audioRef.current?.pause();
    setPlaying(false);
  }

  const play = useCallback(async () => {
    const a = audioRef.current;
    if (!a || !preview) return;
    if (playing) return stop();
    const limit = unlocked;
    try {
      a.currentTime = 0;
      await a.play();
    } catch {
      setAudioError("เบราว์เซอร์ไม่ยอมเล่นเสียง ลองกดอีกครั้ง");
      return;
    }
    setAudioError("");
    setPlaying(true);
    const tick = () => {
      const t = a.currentTime;
      setPosition(t);
      if (t >= limit || a.ended) {
        a.pause();
        setPlaying(false);
        setPosition(Math.min(t, limit));
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [preview, playing, unlocked]);

  useEffect(() => () => stop(), []);

  const guessedIds = useMemo(
    () => new Set(guesses.flatMap((g) => (g.song ? [g.song.id] : []))),
    [guesses],
  );
  const results = useMemo(() => searchSongs(query, guessedIds), [query, guessedIds]);

  function submit(song: Song) {
    if (finished) return;
    stop();
    setGuesses((g) => [...g, { result: evaluate(song, answer), song }]);
    setQuery("");
    setActive(0);
  }

  function skip() {
    if (finished) return;
    stop();
    setGuesses((g) => [...g, { result: "skip" }]);
  }

  function nextPractice() {
    setAnswer((prev) => randomSong(cat, prev.id));
    setGuesses([]);
    setCopied(false);
  }

  async function share() {
    const text = shareText(day, cat, guesses, won);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      setCopied(false);
      window.prompt("คัดลอกผลลัพธ์", text);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      submit(results[Math.min(active, results.length - 1)]);
    }
  }

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <span className="brand-name">ฟังแป๊บ</span>
          <span className="brand-sub">ทายเพลงไทยจากเสียงไม่กี่วินาที</span>
        </div>
        <div className="top-actions">
          <span className="day-chip" aria-label="เกมที่">#{day}</span>
          <button className="icon-btn" onClick={() => setShowHelp(true)} aria-label="วิธีเล่น">
            ?
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="หมวดเพลง">
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            className={c.key === cat ? "tab on" : "tab"}
            onClick={() => setCat(c.key)}
            aria-pressed={c.key === cat}
          >
            {c.label}
          </button>
        ))}
      </nav>

      <div className="mode">
        <button className={mode === "daily" ? "on" : ""} onClick={() => setMode("daily")}>
          เพลงประจำวัน
        </button>
        <button className={mode === "practice" ? "on" : ""} onClick={() => setMode("practice")}>
          สุ่มเล่นไม่จำกัด
        </button>
      </div>

      <ol className="rows" aria-label="คำตอบที่ทายไปแล้ว">
        {Array.from({ length: MAX_TRIES }).map((_, i) => {
          const g = guesses[i];
          const isNext = i === guesses.length && !finished;
          return (
            <li key={i} className={`row ${g ? g.result : ""} ${isNext ? "next" : ""}`}>
              <span className="row-len">{SNIPPETS[i]} วิ</span>
              <span className="row-text">
                {g?.result === "skip" && "ข้าม"}
                {g?.song && (
                  <>
                    <b>{baseTitle(g.song.title)}</b>
                    <span className="row-artist">{g.song.artist}</span>
                  </>
                )}
              </span>
              {g && g.result !== "skip" && (
                <span className="row-tag">
                  {g.result === "correct" ? "ถูก" : g.result === "artist" ? "ศิลปินถูก" : "ผิด"}
                </span>
              )}
            </li>
          );
        })}
      </ol>

      <section className="deck" aria-label="เครื่องเล่น">
        <div className="tape" role="presentation">
          <div className="tape-unlocked" style={{ width: `${(unlocked / FULL) * 100}%` }} />
          <div className="tape-played" style={{ width: `${(Math.min(position, unlocked) / FULL) * 100}%` }} />
          {SNIPPETS.slice(0, -1).map((s) => (
            <span key={s} className="tape-mark" style={{ left: `${(s / FULL) * 100}%` }} />
          ))}
        </div>
        <div className="deck-row">
          <span className="counter">{position.toFixed(1)}</span>
          <button
            className={`play ${playing ? "is-playing" : ""}`}
            onClick={play}
            disabled={!preview}
            aria-label={playing ? "หยุด" : "เล่นท่อนเพลง"}
          >
            {playing ? <span className="ico-stop" /> : <span className="ico-play" />}
          </button>
          <span className="counter dim">{unlocked} วิ</span>
        </div>
        {!preview && !audioError && <p className="note">กำลังโหลดเสียง…</p>}
        {audioError && <p className="note err">{audioError}</p>}
      </section>

      {!finished ? (
        <div className="guess">
          <div className="search">
            <input
              id="song-search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKey}
              placeholder="พิมพ์ชื่อเพลงหรือศิลปิน เช่น คราม, บอดี้สแลม"
              autoComplete="off"
              aria-label="ค้นหาเพลง"
            />
            {results.length > 0 && (
              <ul className="results" role="listbox">
                {results.map((s, i) => (
                  <li key={s.id} role="option" aria-selected={i === active}>
                    <button className={i === active ? "hit on" : "hit"} onClick={() => submit(s)}>
                      <b>{s.title}</b>
                      <span>{s.artist}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button className="skip" onClick={skip}>
            {guesses.length === MAX_TRIES - 1 ? "ยอมแพ้" : `ข้าม (+${SNIPPETS[guesses.length + 1] - SNIPPETS[guesses.length]} วิ)`}
          </button>
        </div>
      ) : (
        <section className={`reveal ${won ? "win" : "lose"}`} aria-live="polite">
          {preview?.artwork && <img src={preview.artwork} alt="" width={96} height={96} />}
          <div className="reveal-body">
            <p className="reveal-head">{won ? `ทายถูกใน ${SNIPPETS[guesses.length - 1]} วินาที` : "เพลงนี้คือ"}</p>
            <h2>{answer.title}</h2>
            <p className="reveal-meta">
              {answer.artist} · {answer.year}
            </p>
            <div className="reveal-actions">
              <button onClick={share}>{copied ? "คัดลอกผลแล้ว" : "แชร์ผล"}</button>
              {mode === "practice" && <button onClick={nextPractice}>เพลงถัดไป</button>}
              {preview?.trackUrl && (
                <a href={preview.trackUrl} target="_blank" rel="noreferrer">
                  ฟังเต็มเพลงบน Apple Music
                </a>
              )}
            </div>
            {mode === "daily" && (
              <p className="reveal-foot">
                {stats && `เล่น ${stats.played} · ชนะ ${Math.round((stats.wins / stats.played) * 100)}% · สตรีค ${stats.streak} วัน · `}
                เพลงใหม่ในอีก {untilMidnightBangkok()}
              </p>
            )}
          </div>
        </section>
      )}

      <aside className="biz" aria-label="ตัวอย่างพื้นที่สร้างรายได้">
        <div className="ad-slot">
          <span>พื้นที่โฆษณา 320×100</span>
          <small>ตัวอย่างตำแหน่ง AdSense / Ad Manager</small>
        </div>
        <div className="plus">
          <div>
            <b>ฟังแป๊บ พลัส</b>
            <p>ไม่มีโฆษณา · เล่นย้อนหลังทุกวัน · โหมดศิลปินเดียว</p>
          </div>
          <span className="plus-tag">ตัวอย่าง</span>
        </div>
      </aside>

      <footer className="foot">
        ตัวอย่างเสียงสตรีมจาก iTunes Search API โดยตรง เว็บนี้ไม่ได้เก็บไฟล์เพลง · เดโมสำหรับทดสอบเท่านั้น
      </footer>

      {showHelp && (
        <div className="overlay" onClick={() => setShowHelp(false)}>
          <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={(e) => e.stopPropagation()}>
            <h2 id="help-title">วิธีเล่น</h2>
            <p>ฟังท่อนสั้นๆ แล้วทายว่าเป็นเพลงอะไร ทายผิดหรือกดข้ามจะได้ฟังยาวขึ้น มีทั้งหมด {MAX_TRIES} ครั้ง</p>
            <ul className="legend">
              <li><span className="sq correct" /> ถูกทั้งเพลงและศิลปิน</li>
              <li><span className="sq artist" /> ศิลปินถูก แต่ผิดเพลง</li>
              <li><span className="sq wrong" /> ผิดทั้งคู่</li>
            </ul>
            <p className="dim">ความยาวที่ปลดล็อก: {SNIPPETS.join(" → ")} วินาที เพลงประจำวันเปลี่ยนตอนเที่ยงคืนเวลาไทย</p>
            <button onClick={() => setShowHelp(false)}>เริ่มเล่น</button>
          </div>
        </div>
      )}
    </div>
  );
}
