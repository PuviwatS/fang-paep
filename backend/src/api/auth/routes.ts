import bcrypt from "bcryptjs";
import crypto from "crypto";
import { Router } from "express";
import { Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { config } from "../../config";
import { db, Queryable, transaction } from "../../config/db";
import { clearAuthCookies, optionalAuth, requireAuth } from "../../middleware/auth";
import { AppError, asyncHandler } from "../../middleware/error";
import { Mailer, resetMail, verificationMail } from "../../services/email";

const passwordSchema = z.string().refine((password) => {
  const bytes = Buffer.byteLength(password, "utf8");
  return bytes >= 8 && bytes <= 72;
}, "Password must be 8-72 UTF-8 bytes");
const emailSchema = z
  .string()
  .trim()
  .email()
  .max(320)
  .transform((email) => email.toLowerCase());
const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(40).optional(),
});
const signinSchema = z.object({
  email: emailSchema,
  password: z
    .string()
    .refine((password) => Buffer.byteLength(password, "utf8") <= 72, "Password is too long"),
});
const tokenSchema = z.object({ token: z.string().min(1).max(512) });
const resetSchema = tokenSchema.extend({ password: passwordSchema });

type User = { id: string; email: string; password_hash: string; email_verified: boolean };
const hash = (value: string) => crypto.createHash("sha256").update(value).digest("hex");
const randomToken = () => crypto.randomBytes(32).toString("base64url");
const userResponse = (user: Pick<User, "id" | "email">) => ({ id: user.id, email: user.email });
const cookieOptions = { httpOnly: true, sameSite: "lax" as const, secure: config.production, path: "/api" };

function accessToken(user: Pick<User, "id" | "email">, sessionId: string): string {
  return jwt.sign({ email: user.email, sid: sessionId, purpose: "access" }, config.jwtSecret, {
    subject: user.id,
    jwtid: crypto.randomUUID(),
    expiresIn: "15m",
    algorithm: "HS256",
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  });
}

function refreshToken(userId: string, sessionId: string): string {
  return jwt.sign({ sid: sessionId, purpose: "refresh" }, config.jwtRefreshSecret, {
    subject: userId,
    jwtid: crypto.randomUUID(),
    expiresIn: "7d",
    algorithm: "HS256",
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  });
}

function verifyRefresh(token: string): JwtPayload {
  const payload = jwt.verify(token, config.jwtRefreshSecret, {
    algorithms: ["HS256"],
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  });
  if (typeof payload === "string" || payload.purpose !== "refresh" || !payload.sub || !payload.sid) {
    throw new AppError("INVALID_REFRESH_TOKEN", "Invalid refresh token", 401);
  }
  return payload;
}

async function createOneTimeToken(userId: string, purpose: "verify" | "reset"): Promise<string> {
  const token = randomToken();
  await transaction(async (client) => {
    await client.query("DELETE FROM auth_tokens WHERE user_id = $1 AND purpose = $2", [userId, purpose]);
    await client.query(
      "INSERT INTO auth_tokens (id, user_id, token_hash, purpose, expires_at, created_at) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '24 hours', NOW())",
      [crypto.randomUUID(), userId, hash(token), purpose],
    );
  });
  return token;
}

async function consumeOneTimeToken(
  client: Queryable,
  token: string,
  purpose: "verify" | "reset",
): Promise<string> {
  const result = await client.query<{ user_id: string }>(
    "DELETE FROM auth_tokens WHERE token_hash = $1 AND purpose = $2 AND expires_at > NOW() RETURNING user_id",
    [hash(token), purpose],
  );
  if (!result.rowCount) throw new AppError("INVALID_OR_EXPIRED_TOKEN", "Invalid or expired token", 400);
  return result.rows[0].user_id;
}

async function startSessionIn(
  client: Queryable,
  user: Pick<User, "id" | "email">,
): Promise<{ access: string; refresh: string }> {
  const sessionId = crypto.randomUUID();
  const refresh = refreshToken(user.id, sessionId);
  await client.query(
    "INSERT INTO auth_sessions (id, user_id, refresh_hash, expires_at, created_at) VALUES ($1, $2, $3, NOW() + INTERVAL '7 days', NOW())",
    [sessionId, user.id, hash(refresh)],
  );
  return { access: accessToken(user, sessionId), refresh };
}

function setAuthCookies(res: Response, tokens: { access: string; refresh: string }): void {
  res.cookie("fp_access", tokens.access, { ...cookieOptions, maxAge: 15 * 60 * 1000 });
  res.cookie("fp_refresh", tokens.refresh, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

export function createAuthRouter(mailer: Mailer): Router {
  const router = Router();
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });
  router.use((req, res, next) => (req.method === "GET" ? next() : authLimiter(req, res, next)));

  router.post(
    "/signup",
    asyncHandler(async (req, res) => {
      const { email, password, displayName } = signupSchema.parse(req.body);
      const passwordHash = await bcrypt.hash(password, 12);
      let user: Pick<User, "id" | "email">;
      try {
        user = await transaction(async (client) => {
          const id = crypto.randomUUID();
          const result = await client.query<Pick<User, "id" | "email">>(
            "INSERT INTO users (id, email, password_hash, email_verified, created_at) VALUES ($1, $2, $3, false, NOW()) RETURNING id, email",
            [id, email, passwordHash],
          );
          await client.query("INSERT INTO profiles (id, display_name, created_at) VALUES ($1, $2, NOW())", [
            id,
            displayName ?? email.split("@")[0],
          ]);
          return result.rows[0];
        });
      } catch (error) {
        if (
          typeof error === "object" &&
          error &&
          "code" in error &&
          (error as { code: string }).code === "23505"
        ) {
          throw new AppError("EMAIL_IN_USE", "An account with that email already exists", 409);
        }
        throw error;
      }
      const token = await createOneTimeToken(user.id, "verify");
      await verificationMail(mailer, user.email, token);
      res.status(201).json({ emailSent: true });
    }),
  );

  router.post(
    "/signin",
    asyncHandler(async (req, res) => {
      const { email, password } = signinSchema.parse(req.body);
      const { user, tokens } = await transaction(async (client) => {
        // Locking the user makes password/session revocation atomic with new sessions.
        const result = await client.query<User>(
          "SELECT id, email, password_hash, email_verified FROM users WHERE email = $1 FOR UPDATE",
          [email],
        );
        const user = result.rows[0];
        if (!user || !(await bcrypt.compare(password, user.password_hash))) {
          throw new AppError("INVALID_CREDENTIALS", "Invalid email or password", 401);
        }
        if (!user.email_verified)
          throw new AppError("EMAIL_NOT_VERIFIED", "Verify your email before signing in", 403);
        return { user, tokens: await startSessionIn(client, user) };
      });
      setAuthCookies(res, tokens);
      res.json({ user: userResponse(user) });
    }),
  );

  router.post(
    "/signout",
    asyncHandler(async (req, res) => {
      const refresh = req.cookies?.fp_refresh as string | undefined;
      if (refresh) {
        try {
          const payload = verifyRefresh(refresh);
          await db.query("DELETE FROM auth_sessions WHERE id = $1 AND user_id = $2 AND refresh_hash = $3", [
            payload.sid,
            payload.sub,
            hash(refresh),
          ]);
        } catch (error) {
          if (!(error instanceof AppError) && !(error instanceof jwt.JsonWebTokenError)) throw error;
        }
      }
      clearAuthCookies(res);
      res.status(204).end();
    }),
  );

  router.get("/me", optionalAuth, (req, res) => {
    res.json({ user: req.user ? { id: req.user.id, email: req.user.email } : null });
  });

  router.post(
    "/refresh",
    asyncHandler(async (req, res) => {
      const oldRefresh = req.cookies?.fp_refresh as string | undefined;
      if (!oldRefresh) throw new AppError("INVALID_REFRESH_TOKEN", "Refresh token is required", 401);
      const payload = verifyRefresh(oldRefresh);
      const userResult = await db.query<Pick<User, "id" | "email">>(
        "SELECT id, email FROM users WHERE id = $1",
        [payload.sub],
      );
      const user = userResult.rows[0];
      if (!user) throw new AppError("INVALID_REFRESH_TOKEN", "Invalid refresh token", 401);
      const nextRefresh = refreshToken(user.id, payload.sid as string);
      const rotated = await db.query(
        "UPDATE auth_sessions SET refresh_hash = $1, expires_at = NOW() + INTERVAL '7 days' WHERE id = $2 AND user_id = $3 AND refresh_hash = $4 AND expires_at > NOW() RETURNING id",
        [hash(nextRefresh), payload.sid, user.id, hash(oldRefresh)],
      );
      if (!rotated.rowCount)
        throw new AppError("INVALID_REFRESH_TOKEN", "Refresh token has expired or been revoked", 401);
      setAuthCookies(res, { access: accessToken(user, payload.sid as string), refresh: nextRefresh });
      res.json({ user: userResponse(user) });
    }),
  );

  router.post(
    "/verify-email",
    asyncHandler(async (req, res) => {
      const { token } = tokenSchema.parse(req.body);
      const { user, tokens } = await transaction(async (client) => {
        const userId = await consumeOneTimeToken(client, token, "verify");
        const result = await client.query<Pick<User, "id" | "email">>(
          "UPDATE users SET email_verified = true WHERE id = $1 RETURNING id, email",
          [userId],
        );
        const user = result.rows[0];
        if (!user) throw new AppError("INVALID_OR_EXPIRED_TOKEN", "Invalid or expired token", 400);
        return { user, tokens: await startSessionIn(client, user) };
      });
      setAuthCookies(res, tokens);
      res.json({ user: userResponse(user) });
    }),
  );

  router.post(
    "/resend-verification",
    asyncHandler(async (req, res) => {
      const { email } = z.object({ email: emailSchema }).parse(req.body);
      const result = await db.query<Pick<User, "id" | "email"> & { email_verified: boolean }>(
        "SELECT id, email, email_verified FROM users WHERE email = $1",
        [email],
      );
      const user = result.rows[0];
      if (!user || user.email_verified) return void res.json({ emailSent: true });
      const token = await createOneTimeToken(user.id, "verify");
      await verificationMail(mailer, user.email, token);
      res.json({ emailSent: true });
    }),
  );

  router.post(
    "/forgot-password",
    asyncHandler(async (req, res) => {
      const { email } = z.object({ email: emailSchema }).parse(req.body);
      const result = await db.query<Pick<User, "id" | "email">>(
        "SELECT id, email FROM users WHERE email = $1",
        [email],
      );
      const user = result.rows[0];
      if (user) {
        const token = await createOneTimeToken(user.id, "reset");
        await resetMail(mailer, user.email, token);
      }
      res.json({ emailSent: true });
    }),
  );

  router.post(
    "/reset-password",
    asyncHandler(async (req, res) => {
      const { token, password } = resetSchema.parse(req.body);
      await transaction(async (client) => {
        const userId = await consumeOneTimeToken(client, token, "reset");
        await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
          await bcrypt.hash(password, 12),
          userId,
        ]);
        await client.query("DELETE FROM auth_sessions WHERE user_id = $1", [userId]);
      });
      clearAuthCookies(res);
      res.status(204).end();
    }),
  );

  router.patch(
    "/change-password",
    requireAuth,
    asyncHandler(async (req, res) => {
      const { currentPassword, password } = z
        .object({ currentPassword: z.string(), password: passwordSchema })
        .parse(req.body);
      await transaction(async (client) => {
        const result = await client.query<User>(
          "SELECT id, email, password_hash, email_verified FROM users WHERE id = $1 FOR UPDATE",
          [req.user!.id],
        );
        const user = result.rows[0];
        if (!user || !(await bcrypt.compare(currentPassword, user.password_hash))) {
          throw new AppError("INVALID_CREDENTIALS", "Current password is incorrect", 401);
        }
        await client.query("UPDATE users SET password_hash = $1 WHERE id = $2", [
          await bcrypt.hash(password, 12),
          user.id,
        ]);
        await client.query("DELETE FROM auth_sessions WHERE user_id = $1", [user.id]);
      });
      clearAuthCookies(res);
      res.status(204).end();
    }),
  );

  return router;
}

export default createAuthRouter;
