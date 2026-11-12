import { afterEach, describe, expect, it, vi } from "vitest";

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
  vi.resetModules();
});

describe("config", () => {
  it("rejects missing, weak, and duplicate signing secrets", async () => {
    process.env.DATABASE_URL = "postgres://localhost/test";
    process.env.FRONTEND_URL = "http://localhost:3000";
    delete process.env.JWT_SECRET;
    process.env.JWT_REFRESH_SECRET = "b".repeat(32);
    await expect(import(".")).rejects.toThrow("JWT_SECRET");

    vi.resetModules();
    process.env.JWT_SECRET = "a".repeat(31);
    process.env.JWT_REFRESH_SECRET = "b".repeat(32);
    await expect(import(".")).rejects.toThrow("JWT_SECRET");

    vi.resetModules();
    process.env.JWT_SECRET = "a".repeat(32);
    process.env.JWT_REFRESH_SECRET = "a".repeat(32);
    await expect(import(".")).rejects.toThrow("must differ");
  });

  it("requires a browser-safe frontend origin", async () => {
    process.env.DATABASE_URL = "postgres://localhost/test";
    process.env.FRONTEND_URL = "ftp://localhost:3000";
    process.env.JWT_SECRET = "a".repeat(32);
    process.env.JWT_REFRESH_SECRET = "b".repeat(32);
    await expect(import(".")).rejects.toThrow("HTTP(S) origin");
  });

  it("requires an explicit narrow proxy boundary in production", async () => {
    process.env.DATABASE_URL = "postgres://localhost/test";
    process.env.FRONTEND_URL = "https://game.example.test";
    process.env.JWT_SECRET = "a".repeat(32);
    process.env.JWT_REFRESH_SECRET = "b".repeat(32);
    process.env.NODE_ENV = "production";
    delete process.env.TRUST_PROXY_CIDRS;
    await expect(import(".")).rejects.toThrow("TRUST_PROXY_CIDRS");

    vi.resetModules();
    process.env.TRUST_PROXY_CIDRS = "0.0.0.0/0";
    await expect(import(".")).rejects.toThrow("TRUST_PROXY_CIDRS");

    vi.resetModules();
    process.env.TRUST_PROXY_CIDRS = "127.0.0.1/32,::1/128";
    const { config } = await import(".");
    expect(config.trustProxy).toEqual(["127.0.0.1/32", "::1/128"]);
  });
});
