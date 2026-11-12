import { afterEach, describe, expect, it, vi } from "vitest";

function response(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("api client authentication recovery", () => {
  it("refreshes once and retries the failed request once", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(401, { error: { code: "expired", message: "expired" } }))
      .mockResolvedValueOnce(response(200, { user: { id: "player", email: "p@example.com" } }))
      .mockResolvedValueOnce(response(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await import("./client");

    await expect(api.get<{ ok: boolean }>("/api/account")).resolves.toEqual({ ok: true });
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      "/api/account",
      "/api/auth/refresh",
      "/api/account",
    ]);
  });

  it("does not recurse when refresh itself is unauthorized", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(401, { error: { code: "expired", message: "expired" } }))
      .mockResolvedValueOnce(response(401, { error: { code: "expired", message: "expired" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await import("./client");

    await expect(api.get("/api/account")).rejects.toMatchObject({ code: "expired", status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refreshes and retries an optional-auth guess with an expired access cookie", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(401, { error: { code: "expired", message: "expired" } }))
      .mockResolvedValueOnce(response(200, { user: { id: "player", email: "p@example.com" } }))
      .mockResolvedValueOnce(response(200, { result: "wrong" }));
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await import("./client");

    await expect(api.post("/api/guess", { category: "all" })).resolves.toEqual({ result: "wrong" });
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      "/api/guess",
      "/api/auth/refresh",
      "/api/guess",
    ]);
  });

  it("shares one refresh request across concurrent protected requests", async () => {
    let releaseRefresh: (() => void) | undefined;
    const refresh = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    const fetchMock = vi.fn(async (path: string) => {
      if (path === "/api/auth/refresh") {
        await refresh;
        return response(200, { user: { id: "player", email: "p@example.com" } });
      }
      return fetchMock.mock.calls.filter(([calledPath]) => calledPath === path).length === 1
        ? response(401, { error: { code: "expired", message: "expired" } })
        : response(200, { ok: true });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await import("./client");

    const requests = [api.get<{ ok: boolean }>("/api/account"), api.get<{ ok: boolean }>("/api/stats")];
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/auth/refresh", expect.anything()));
    releaseRefresh?.();

    await expect(Promise.all(requests)).resolves.toEqual([{ ok: true }, { ok: true }]);
    expect(fetchMock.mock.calls.filter(([path]) => path === "/api/auth/refresh")).toHaveLength(1);
  });

  it("does not refresh authentication-form requests", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(response(401, { error: { code: "expired", message: "expired" } }));
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await import("./client");

    await expect(
      api.post("/api/auth/signin", { email: "p@example.com", password: "password1" }),
    ).rejects.toMatchObject({
      status: 401,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("keeps auth state on a network refresh failure", async () => {
    const authChanged = vi.fn();
    const windowTarget = new EventTarget();
    windowTarget.addEventListener("fangpap:auth-changed", authChanged);
    vi.stubGlobal("window", windowTarget);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(401, { error: { code: "expired", message: "expired" } }))
      .mockRejectedValueOnce(new TypeError("offline"));
    vi.stubGlobal("fetch", fetchMock);
    const { api } = await import("./client");

    await expect(api.get("/api/account")).rejects.toMatchObject({ code: "network", status: 0 });
    expect(authChanged).not.toHaveBeenCalled();
  });

  it("returns a player-safe network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    const { api } = await import("./client");

    await expect(api.get("/api/songs")).rejects.toMatchObject({
      code: "network",
      status: 0,
    });
  });
});
