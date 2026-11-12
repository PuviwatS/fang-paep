import "dotenv/config";
import { isIP } from "node:net";

const requiredSecret = (name: string): string => {
  const value = process.env[name];
  if (!value || value.length < 32) {
    throw new Error(`${name} must be set to at least 32 characters`);
  }
  return value;
};

const requiredUrl = (name: string): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  try {
    new URL(value);
  } catch {
    throw new Error(`${name} must be a valid URL`);
  }
  return value;
};

const requiredFrontendUrl = (): string => {
  const value = requiredUrl("FRONTEND_URL");
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    (url.port && (Number(url.port) < 1 || Number(url.port) > 65535))
  ) {
    throw new Error("FRONTEND_URL must be an HTTP(S) origin with a valid port");
  }
  return url.origin;
};

const port = Number(process.env.PORT ?? 4000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be a valid TCP port");
const jwtSecret = requiredSecret("JWT_SECRET");
const jwtRefreshSecret = requiredSecret("JWT_REFRESH_SECRET");
if (jwtSecret === jwtRefreshSecret) throw new Error("JWT_SECRET and JWT_REFRESH_SECRET must differ");
const production = process.env.NODE_ENV === "production";
const trustProxy = (process.env.TRUST_PROXY_CIDRS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
if (production && trustProxy.length === 0) {
  throw new Error(
    "TRUST_PROXY_CIDRS is required in production behind an edge that overwrites X-Forwarded-For",
  );
}
for (const entry of trustProxy) {
  const [address, prefix, extra] = entry.split("/");
  const version = isIP(address);
  if (
    !version ||
    extra !== undefined ||
    (prefix !== undefined &&
      (!/^\d+$/.test(prefix) || Number(prefix) < 1 || Number(prefix) > (version === 4 ? 32 : 128)))
  ) {
    throw new Error(
      "TRUST_PROXY_CIDRS must contain explicit proxy IPs or CIDRs; trust-all ranges are forbidden",
    );
  }
}

export const config = {
  port,
  databaseUrl: requiredUrl("DATABASE_URL"),
  frontendUrl: requiredFrontendUrl(),
  jwtSecret,
  jwtRefreshSecret,
  production,
  trustProxy,
  jwtIssuer: process.env.JWT_ISSUER ?? "fang-paep-api",
  jwtAudience: process.env.JWT_AUDIENCE ?? "fang-paep-web",
  mailFrom: process.env.MAIL_FROM ?? "",
};
