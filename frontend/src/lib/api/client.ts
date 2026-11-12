import type { ApiErrorBody } from "./types";

const authChangedEvent = "fangpap:auth-changed";
let refreshRequest: Promise<boolean> | null = null;
const protectedPaths = new Set([
  "/api/auth/me",
  "/api/auth/change-password",
  "/api/puzzle",
  "/api/guess",
  "/api/leaderboard",
  "/api/account",
  "/api/import-local",
  "/api/stats",
  "/api/subscription/checkout",
  "/api/subscription/cancel",
  "/api/subscription/resume",
]);

/** Error thrown in the browser when an /api call fails. `message` is ready to show to players. */
export class ApiRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function notifyAuthChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(authChangedEvent));
}

async function fetchApi(method: string, path: string, body?: unknown): Promise<Response> {
  try {
    return await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    throw new ApiRequestError("network", "เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง", 0);
  }
}

async function refreshSession(): Promise<boolean> {
  if (!refreshRequest) {
    refreshRequest = fetchApi("POST", "/api/auth/refresh", {})
      .then(async (response) => {
        if (response.ok) return true;
        if (response.status === 401 || response.status === 403) {
          notifyAuthChanged();
          return false;
        }
        throw await responseError(response);
      })
      .finally(() => {
        refreshRequest = null;
      });
  }
  const refreshed = await refreshRequest;
  return refreshed;
}

function requiresAuthentication(path: string): boolean {
  return protectedPaths.has(path.split("?", 1)[0]);
}

async function responseError(response: Response): Promise<ApiRequestError> {
  const data = (await response.json().catch(() => null)) as ApiErrorBody | null;
  return new ApiRequestError(
    data?.error?.code ?? "unknown",
    data?.error?.message ?? "เกิดข้อผิดพลาด ลองอีกครั้ง",
    response.status,
  );
}

async function request<T>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
  const response = await fetchApi(method, path, body);

  if (response.status === 401 && !retried && requiresAuthentication(path)) {
    if (await refreshSession()) return request<T>(method, path, body, true);
  }

  if (!response.ok) throw await responseError(response);
  const data = (await response.json().catch(() => null)) as T | null;
  return data as T;
}

export { authChangedEvent };

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
};
