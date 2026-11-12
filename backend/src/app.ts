import cookieParser from "cookie-parser";
import express, { Express } from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { createRouter } from "./router";
import { csrfProtection } from "./middleware/auth";
import { errorHandler } from "./middleware/error";
import { Mailer, configuredMailer } from "./services/email";
import { config } from "./config";

export function createApp(options: { mailer?: Mailer } = {}): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy.length ? config.trustProxy : false);
  app.use(helmet());
  app.use(express.json({ limit: "32kb" }));
  app.use(cookieParser());
  app.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 1_000, standardHeaders: true, legacyHeaders: false }));
  app.use(csrfProtection);
  app.use("/api", createRouter(options.mailer ?? configuredMailer()));
  app.use("/api", (_req, res) =>
    res.status(404).json({ error: { code: "NOT_FOUND", message: "API endpoint not found" } }),
  );
  app.use(errorHandler);
  return app;
}
