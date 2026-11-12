import { FIRST_GAME_DATE_UTC, MS_PER_DAY } from "./constants";

/** "6 ชม. 39 นาที" */
export function formatDuration(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours} ชม. ${minutes} นาที`;
}

export function formatPercent(part: number, whole: number): string {
  if (whole === 0) return "0%";
  return `${Math.round((part / whole) * 100)}%`;
}

/** "19 ต.ค. 2569" — a timestamp shown in Thai, Buddhist year, Bangkok time. */
export function formatThaiDate(value: string | number | Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Bangkok",
  }).format(new Date(value));
}

/** "19 ต.ค." — the calendar date of daily game number `day`. */
export function formatGameDay(day: number): string {
  const date = new Date(FIRST_GAME_DATE_UTC + (day - 1) * MS_PER_DAY);
  return new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short", timeZone: "UTC" }).format(date);
}

/** "49 บาท" */
export function formatBaht(amount: number): string {
  return `${amount.toLocaleString("th-TH")} บาท`;
}
