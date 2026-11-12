import { Router } from "express";
import createAuthRouter from "./api/auth/routes";
import gameRouter from "./api/game/routes";
import { Mailer } from "./services/email";

export function createRouter(mailer: Mailer): Router {
  const router = Router();
  router.use("/auth", createAuthRouter(mailer));
  router.use(gameRouter);
  return router;
}
