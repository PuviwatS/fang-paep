import type { ApiErrorBody } from "./types";

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

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: "same-origin",
    });
  } catch {
    throw new ApiRequestError("network", "เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง", 0);
  }

  const data = (await response.json().catch(() => null)) as T | ApiErrorBody | null;
  if (!response.ok) {
    const error = (data as ApiErrorBody | null)?.error;
    throw new ApiRequestError(
      error?.code ?? "unknown",
      error?.message ?? "เกิดข้อผิดพลาด ลองอีกครั้ง",
      response.status,
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, body ?? {}),
  patch: <T>(path: string, body: unknown) => request<T>("PATCH", path, body),
};
