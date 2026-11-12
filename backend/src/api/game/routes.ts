import { Router } from "express";
import { z } from "zod";
import { db } from "../../config/db";
import { optionalAuth, requireAuth } from "../../middleware/auth";
import { AppError, asyncHandler } from "../../middleware/error";
import { gameCall } from "../../services/game";

const router = Router();
const category = z.enum(["all", "pop", "rock", "luk", "hiphop"]);
const day = z.coerce.number().int().min(1).max(100_000);
const databaseErrors: Record<string, [number, string]> = {
  invalid_category: [400, "ไม่มีหมวดเพลงนี้"],
  invalid_day: [400, "ยังไม่มีเพลงของวันนี้"],
  invalid_attempt: [400, "จำนวนครั้งที่ทายไม่ถูกต้อง ลองรีเฟรชหน้า"],
  invalid_games: [400, "ข้อมูลที่ส่งมาไม่ถูกต้อง"],
  invalid_display_name: [400, "ชื่อที่แสดงต้องยาว 1–40 ตัวอักษร"],
  unknown_song: [400, "ไม่พบเพลงนี้ในรายการ"],
  unknown_plan: [400, "ไม่พบแพ็กเกจนี้"],
  already_guessed: [409, "ทายเพลงนี้ไปแล้ว ลองเพลงอื่น"],
  already_finished: [409, "รอบนี้จบแล้ว"],
  no_active_subscription: [409, "ไม่มีการสมัครพลัสที่ใช้งานอยู่"],
  login_required: [401, "กรุณาเข้าสู่ระบบก่อน"],
  plus_required: [403, "เล่นย้อนหลังได้เฉพาะสมาชิกพลัส"],
  payments_unavailable: [503, "ระบบชำระเงินยังไม่เปิดให้บริการ"],
  puzzle_not_found: [404, "ไม่พบโจทย์ของวันนี้"],
};

function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new AppError("bad_request", "ข้อมูลที่ส่งมาไม่ถูกต้อง", 400);
  return result.data;
}
function databaseError(error: unknown): never {
  const message = error instanceof Error ? error.message.trim() : "";
  const known = databaseErrors[message];
  if (known) throw new AppError(message, known[1], known[0]);
  throw error;
}
const call = <T>(actor: { id?: string }, name: string, args?: unknown[]) =>
  gameCall<T>(actor, name, args).catch(databaseError);

router.get(
  "/songs",
  asyncHandler(async (_req, res) => {
    const result = await db.query(
      "SELECT s.id,s.title,a.name artist,a.aliases,s.category,s.year FROM songs s JOIN artists a ON a.id=s.artist_id WHERE s.active ORDER BY s.id",
    );
    const songs = result.rows.map((row) => {
      const id = Number(row.id);
      if (!Number.isSafeInteger(id)) throw new AppError("server_error", "โหลดรายชื่อเพลงไม่สำเร็จ", 500);
      return { ...row, id, year: row.year ? String(row.year) : "" };
    });
    res.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400").json(songs);
  }),
);
router.get(
  "/plans",
  asyncHandler(async (_req, res) => {
    const result = await db.query(
      'SELECT id,name,price_thb AS "priceThb",billing_interval AS "billingInterval",features FROM plans WHERE active ORDER BY sort_order',
    );
    res.set("Cache-Control", "public, s-maxage=3600, stale-while-revalidate=86400").json(result.rows);
  }),
);
router.get(
  "/puzzle",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const query = parse(z.object({ category: category.default("all"), day: day.optional() }), req.query);
    res.json(await call(req.user ?? {}, "public.get_puzzle", [query.category, query.day ?? null]));
  }),
);
router.post(
  "/guess",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        category,
        day,
        songId: z.number().int().positive().nullable(),
        attempt: z.number().int().min(0).max(5),
      }),
      req.body,
    );
    res.json(
      await call(req.user ?? {}, "public.submit_guess", [body.category, body.day, body.songId, body.attempt]),
    );
  }),
);
router.get(
  "/leaderboard",
  optionalAuth,
  asyncHandler(async (req, res) => {
    const query = parse(z.object({ category: category.default("all"), day: day.optional() }), req.query);
    res.json(await call(req.user ?? {}, "public.get_leaderboard", [query.category, query.day ?? null]));
  }),
);
router.get(
  "/stats",
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = parse(z.object({ category: category.default("all") }), req.query);
    res.json(await call(req.user!, "public.get_my_stats", [query.category]));
  }),
);
router.post(
  "/import-local",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        games: z
          .array(
            z.object({
              day,
              category,
              guesses: z
                .array(z.object({ songId: z.number().int().positive().nullable().optional() }))
                .max(6),
            }),
          )
          .max(400),
      }),
      req.body,
    );
    res.json(await call(req.user!, "public.import_local_games", [JSON.stringify(body.games)]));
  }),
);
router.get(
  "/account",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await call(req.user!, "public.get_my_account"));
  }),
);
router.patch(
  "/account",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ displayName: z.string().trim().min(1).max(40) }), req.body);
    res.json(await call(req.user!, "public.update_display_name", [body.displayName]));
  }),
);
router.post(
  "/subscription/checkout",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ planId: z.string().min(1).max(64) }), req.body);
    res.json(await call(req.user!, "public.mock_checkout", [body.planId]));
  }),
);
router.post(
  "/subscription/cancel",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await call(req.user!, "public.cancel_subscription"));
  }),
);
router.post(
  "/subscription/resume",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json(await call(req.user!, "public.resume_subscription"));
  }),
);

export default router;
