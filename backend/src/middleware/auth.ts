import { Request, RequestHandler, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { db } from "../config/db";
import { config } from "../config";
import { AppError } from "./error";

export interface AuthUser {
  id: string;
  email: string;
  sessionId: string;
}
export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

function verifyAccess(token: string): JwtPayload {
  const payload = jwt.verify(token, config.jwtSecret, {
    algorithms: ["HS256"],
    issuer: config.jwtIssuer,
    audience: config.jwtAudience,
  });
  if (
    typeof payload === "string" ||
    payload.purpose !== "access" ||
    !payload.sub ||
    !payload.email ||
    !payload.sid
  ) {
    throw new AppError("INVALID_TOKEN", "Invalid authentication token", 401);
  }
  return payload;
}

async function authenticate(req: Request): Promise<AuthUser | undefined> {
  const token = req.cookies?.fp_access as string | undefined;
  if (!token) {
    if (req.cookies?.fp_refresh) throw new AppError("ACCESS_TOKEN_REQUIRED", "Access token is required", 401);
    return undefined;
  }
  try {
    const payload = verifyAccess(token);
    const session = await db.query(
      "SELECT 1 FROM auth_sessions WHERE id = $1 AND user_id = $2 AND expires_at > NOW()",
      [payload.sid, payload.sub],
    );
    if (!session.rowCount) throw new AppError("SESSION_REVOKED", "Session has expired", 401);
    return { id: payload.sub as string, email: payload.email as string, sessionId: payload.sid as string };
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (error instanceof jwt.JsonWebTokenError) {
      throw new AppError("INVALID_TOKEN", "Invalid or expired authentication token", 401);
    }
    throw error;
  }
}

export const optionalAuth: RequestHandler = async (req, _res, next) => {
  try {
    req.user = await authenticate(req);
    next();
  } catch (error) {
    next(error);
  }
};

export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    req.user = await authenticate(req);
    if (!req.user) throw new AppError("UNAUTHENTICATED", "Authentication required", 401);
    next();
  } catch (error) {
    next(error);
  }
};

export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  const origin = req.get("origin") ?? req.get("referer");
  if (!origin && !req.cookies?.fp_access && !req.cookies?.fp_refresh) return next();
  try {
    if (!origin || new URL(origin).origin !== new URL(config.frontendUrl).origin) {
      throw new AppError("CSRF_ORIGIN_REJECTED", "Untrusted request origin", 403);
    }
    next();
  } catch (error) {
    next(
      error instanceof AppError
        ? error
        : new AppError("CSRF_ORIGIN_REJECTED", "Untrusted request origin", 403),
    );
  }
};

export const clearAuthCookies = (res: Response): void => {
  const options = { httpOnly: true, sameSite: "lax" as const, secure: config.production, path: "/api" };
  res.clearCookie("fp_access", options);
  res.clearCookie("fp_refresh", options);
};
