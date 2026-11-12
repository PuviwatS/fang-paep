import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import jwt from "jsonwebtoken";
import { Pool } from "pg";
import path from "node:path";
import { migrate } from "../../../scripts/migrate";
import { resetTestDatabase, testDatabaseUrl } from "../../test-db";

type SentMail = { to: string; text: string };
const enabled = Boolean(process.env.TEST_DATABASE_URL);
const frontendOrigin = "http://localhost:3000";
const tokenFrom = (message: SentMail) =>
  new URL(message.text.match(/https?:\/\/\S+/)?.[0] ?? "").searchParams.get("token")!;
const cookie = (response: request.Response, name: string): string => {
  const value = response.headers["set-cookie"];
  const cookies = Array.isArray(value) ? value : [value];
  return cookies.find((item): item is string => item?.startsWith(`${name}=`))!;
};

if (enabled) {
  const databaseUrl = testDatabaseUrl();
  process.env.DATABASE_URL = databaseUrl;
  process.env.FRONTEND_URL = frontendOrigin;
  process.env.JWT_SECRET = "12345678901234567890123456789012";
  process.env.JWT_REFRESH_SECRET = "abcdefghijklmnopqrstuvwxzy123456";

  describe("auth routes", () => {
    let app: Express;
    let createApp: typeof import("../../app").createApp;
    let db: typeof import("../../config/db").db;
    let migrationPool: Pool;
    let sent: SentMail[];

    beforeAll(async () => {
      migrationPool = new Pool({ connectionString: databaseUrl });
      await resetTestDatabase(migrationPool);
      await migrate(migrationPool, path.resolve(process.cwd(), "migrations"));
      const [application, database] = await Promise.all([import("../../app"), import("../../config/db")]);
      createApp = application.createApp;
      db = database.db;
      app = createApp({
        mailer: {
          send: async (message) => {
            sent.push(message);
          },
        },
      });
    });
    beforeEach(async () => {
      sent = [];
      await db.query("TRUNCATE users CASCADE");
    });
    afterAll(async () => {
      await db.end();
      await migrationPool.end();
    });

    async function verifiedAgent(email: string) {
      const agent = request.agent(app);
      await agent.post("/api/auth/signup").send({ email, password: "password1" }).expect(201);
      const verified = await agent
        .post("/api/auth/verify-email")
        .set("Origin", frontendOrigin)
        .send({ token: tokenFrom(sent[0]) })
        .expect(200);
      return { agent, verified };
    }

    it("requires verification, consumes its token once, and rotates refresh credentials", async () => {
      const agent = request.agent(app);
      await agent
        .post("/api/auth/signup")
        .send({ email: "one@example.com", password: "password1", displayName: "One" })
        .expect(201, { emailSent: true });
      await agent
        .post("/api/auth/signin")
        .send({ email: "one@example.com", password: "password1" })
        .expect(403);
      const verified = await agent
        .post("/api/auth/verify-email")
        .set("Origin", frontendOrigin)
        .send({ token: tokenFrom(sent[0]) })
        .expect(200);
      expect(verified.body.user.email).toBe("one@example.com");
      await agent
        .post("/api/auth/verify-email")
        .set("Origin", frontendOrigin)
        .send({ token: tokenFrom(sent[0]) })
        .expect(400);
      const oldRefresh = cookie(verified, "fp_refresh");
      const refreshed = await agent.post("/api/auth/refresh").set("Origin", frontendOrigin).expect(200);
      expect(
        (jwt.decode(oldRefresh.split(";")[0].slice("fp_refresh=".length)) as jwt.JwtPayload).jti,
      ).not.toBe(
        (
          jwt.decode(
            cookie(refreshed, "fp_refresh").split(";")[0].slice("fp_refresh=".length),
          ) as jwt.JwtPayload
        ).jti,
      );
      await request(app)
        .post("/api/auth/signout")
        .set("Origin", frontendOrigin)
        .set("Cookie", oldRefresh)
        .expect(204);
      await request(app)
        .post("/api/auth/refresh")
        .set("Origin", frontendOrigin)
        .set("Cookie", cookie(refreshed, "fp_refresh"))
        .expect(200);
      await request(app)
        .post("/api/auth/refresh")
        .set("Origin", frontendOrigin)
        .set("Cookie", oldRefresh)
        .expect(401);
    });

    it("rejects expired verification and reset links, and does not replay resets", async () => {
      const { agent } = await verifiedAgent("two@example.com");
      await agent
        .post("/api/auth/forgot-password")
        .set("Origin", frontendOrigin)
        .send({ email: "two@example.com" })
        .expect(200);
      const reset = tokenFrom(sent.at(-1)!);
      await db.query(
        "UPDATE auth_tokens SET expires_at = NOW() - INTERVAL '1 second' WHERE purpose = 'reset'",
      );
      await agent
        .post("/api/auth/reset-password")
        .set("Origin", frontendOrigin)
        .send({ token: reset, password: "password2" })
        .expect(400);
      await agent
        .post("/api/auth/forgot-password")
        .set("Origin", frontendOrigin)
        .send({ email: "two@example.com" })
        .expect(200);
      const validReset = tokenFrom(sent.at(-1)!);
      await agent
        .post("/api/auth/reset-password")
        .set("Origin", frontendOrigin)
        .send({ token: validReset, password: "password2" })
        .expect(204);
      await agent
        .post("/api/auth/reset-password")
        .set("Origin", frontendOrigin)
        .send({ token: validReset, password: "password3" })
        .expect(400);

      const unverified = request.agent(app);
      await unverified
        .post("/api/auth/signup")
        .send({ email: "expired@example.com", password: "password1" })
        .expect(201);
      const verify = tokenFrom(sent.at(-1)!);
      await db.query(
        "UPDATE auth_tokens SET expires_at = NOW() - INTERVAL '1 second' WHERE purpose = 'verify'",
      );
      await unverified.post("/api/auth/verify-email").send({ token: verify }).expect(400);
    });

    it("allows one concurrent refresh and rejects replay and logout reuse", async () => {
      const { verified } = await verifiedAgent("refresh@example.com");
      const refresh = cookie(verified, "fp_refresh");
      const [first, second] = await Promise.all([
        request(app).post("/api/auth/refresh").set("Origin", frontendOrigin).set("Cookie", refresh),
        request(app).post("/api/auth/refresh").set("Origin", frontendOrigin).set("Cookie", refresh),
      ]);
      expect([first.status, second.status].sort()).toEqual([200, 401]);
      const liveRefresh = cookie(first.status === 200 ? first : second, "fp_refresh");
      await request(app)
        .post("/api/auth/signout")
        .set("Origin", frontendOrigin)
        .set("Cookie", liveRefresh)
        .expect(204);
      await request(app)
        .post("/api/auth/refresh")
        .set("Origin", frontendOrigin)
        .set("Cookie", liveRefresh)
        .expect(401);
    });

    it("revokes authenticated sessions after password changes", async () => {
      const { agent, verified } = await verifiedAgent("change@example.com");
      const access = cookie(verified, "fp_access");
      await agent
        .patch("/api/auth/change-password")
        .set("Origin", frontendOrigin)
        .send({ currentPassword: "password1", password: "password2" })
        .expect(204);
      await request(app).get("/api/auth/me").set("Cookie", access).expect(401);
      await agent
        .post("/api/auth/signin")
        .send({ email: "change@example.com", password: "password2" })
        .expect(200);
    });

    it("returns CSRF, body, and mail errors without leaking successful state", async () => {
      await request(app)
        .post("/api/auth/signup")
        .set("Origin", "https://evil.example")
        .send({ email: "safe@example.com", password: "password1" })
        .expect(403);
      await request(app)
        .post("/api/auth/signup")
        .send({ email: "bad@example.com", password: "a".repeat(73) })
        .expect(400);
      await request(app)
        .post("/api/auth/signup")
        .set("Content-Type", "application/json")
        .send("{")
        .expect(400);
      await request(app)
        .post("/api/auth/signup")
        .send({ email: "large@example.com", password: "a".repeat(33_000) })
        .expect(413);
      const failing = createApp({
        mailer: {
          send: async () => {
            throw new Error("mail down");
          },
        },
      });
      await request(failing)
        .post("/api/auth/signup")
        .send({ email: "mail@example.com", password: "password1" })
        .expect(500);
      await request(app)
        .post("/api/auth/resend-verification")
        .send({ email: "mail@example.com" })
        .expect(200);
    });

    it("does not downgrade an expired presented access cookie to guest access", async () => {
      const { verified } = await verifiedAgent("access@example.com");
      const access = cookie(verified, "fp_access").split(";")[0].slice("fp_access=".length);
      const payload = jwt.decode(access) as jwt.JwtPayload;
      const expired = jwt.sign(
        { email: "access@example.com", sid: payload.sid, purpose: "access" },
        process.env.JWT_SECRET!,
        {
          subject: verified.body.user.id,
          expiresIn: -1,
          algorithm: "HS256",
          issuer: "fang-paep-api",
          audience: "fang-paep-web",
        },
      );
      await request(app).get("/api/puzzle").set("Cookie", `fp_access=${expired}`).expect(401);
    });

    it("requires refresh when the browser only retains a refresh cookie", async () => {
      const { verified } = await verifiedAgent("restore@example.com");
      await request(app).get("/api/auth/me").set("Cookie", cookie(verified, "fp_refresh")).expect(401);
      await request(app).get("/api/puzzle").set("Cookie", cookie(verified, "fp_refresh")).expect(401);
    });

    it("requires an allowed origin for cookie-authenticated writes", async () => {
      const { verified } = await verifiedAgent("csrf@example.com");
      const refresh = cookie(verified, "fp_refresh");
      await request(app).post("/api/auth/refresh").set("Cookie", refresh).expect(403);
      await request(app).post("/api/auth/refresh").set("Origin", "null").set("Cookie", refresh).expect(403);
      await request(app)
        .post("/api/auth/refresh")
        .set("Referer", `${frontendOrigin}/account`)
        .set("Cookie", refresh)
        .expect(200);
    });
  });
} else {
  describe.skip("auth routes", () => {
    it("requires TEST_DATABASE_URL", () => {});
  });
}
