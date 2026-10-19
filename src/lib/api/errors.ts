import type { ApiErrorBody } from "./types";

/**
 * Database functions raise short codes such as 'plus_required'. This turns them into an HTTP
 * status and a Thai message players can read.
 */
const KNOWN_ERRORS: Record<string, { status: number; message: string }> = {
  invalid_category: { status: 400, message: "ไม่มีหมวดเพลงนี้" },
  invalid_day: { status: 400, message: "ยังไม่มีเพลงของวันนี้" },
  invalid_attempt: { status: 400, message: "จำนวนครั้งที่ทายไม่ถูกต้อง ลองรีเฟรชหน้า" },
  invalid_games: { status: 400, message: "ข้อมูลที่ส่งมาไม่ถูกต้อง" },
  invalid_display_name: { status: 400, message: "ชื่อที่แสดงต้องยาว 1–40 ตัวอักษร" },
  unknown_song: { status: 400, message: "ไม่พบเพลงนี้ในรายการ" },
  unknown_plan: { status: 400, message: "ไม่พบแพ็กเกจนี้" },
  already_guessed: { status: 409, message: "ทายเพลงนี้ไปแล้ว ลองเพลงอื่น" },
  already_finished: { status: 409, message: "รอบนี้จบแล้ว" },
  no_active_subscription: { status: 409, message: "ไม่มีการสมัครพลัสที่ใช้งานอยู่" },
  login_required: { status: 401, message: "กรุณาเข้าสู่ระบบก่อน" },
  plus_required: { status: 403, message: "เล่นย้อนหลังได้เฉพาะสมาชิกพลัส" },
  payments_unavailable: { status: 503, message: "ระบบชำระเงินยังไม่เปิดให้บริการ" },
  puzzle_not_found: { status: 404, message: "ไม่พบโจทย์ของวันนี้" },
};

export class ApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }

  toBody(): ApiErrorBody {
    return { error: { code: this.code, message: this.message } };
  }
}

/** Map a Supabase/Postgres error to an ApiError. Unknown errors become a generic 500. */
export function fromDatabaseError(error: { message?: string; code?: string } | null): ApiError {
  const code = error?.message?.trim() ?? "";
  const known = KNOWN_ERRORS[code];
  if (known) return new ApiError(code, known.message, known.status);
  if (error?.code === "42501") return new ApiError("forbidden", "ไม่มีสิทธิ์ทำรายการนี้", 403);
  return new ApiError("server_error", "เซิร์ฟเวอร์มีปัญหา ลองใหม่อีกครั้ง", 500);
}

export function badRequest(message = "ข้อมูลที่ส่งมาไม่ถูกต้อง"): ApiError {
  return new ApiError("bad_request", message, 400);
}
