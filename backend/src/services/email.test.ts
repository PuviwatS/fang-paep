import { afterEach, describe, expect, it, vi } from "vitest";

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("configured email delivery", () => {
  it("uses the configured Resend sender and reports rejected delivery", async () => {
    process.env.DATABASE_URL = "postgres://localhost/test";
    process.env.FRONTEND_URL = "https://game.example.test";
    process.env.JWT_SECRET = "a".repeat(32);
    process.env.JWT_REFRESH_SECRET = "b".repeat(32);
    process.env.MAIL_FROM = "Fang Paep <mail@example.test>";
    process.env.RESEND_API_KEY = "test-provider-key";
    const fetcher = vi.fn().mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false });
    vi.stubGlobal("fetch", fetcher);
    const { configuredMailer } = await import("./email");
    const mailer = configuredMailer();
    await mailer.send({ to: "player@example.test", subject: "Verify", text: "test link" });
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-provider-key" }),
        body: JSON.stringify({
          from: process.env.MAIL_FROM,
          to: "player@example.test",
          subject: "Verify",
          text: "test link",
        }),
      }),
    );
    await expect(
      mailer.send({ to: "player@example.test", subject: "Verify", text: "test link" }),
    ).rejects.toMatchObject({ code: "EMAIL_DELIVERY_FAILED", status: 503 });
  });
});
