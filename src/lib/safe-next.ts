/** Returns `next` if it is a path on this site, otherwise "/". Stops open redirects. */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return "/";
  return next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}
