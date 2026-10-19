/** Turns a Supabase Auth error into a Thai message for players. */
export function authErrorMessage(error: { code?: string; message: string; status?: number }): string {
  switch (error.code) {
    case "invalid_credentials":
      return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
    case "email_not_confirmed":
      return "ยังไม่ได้ยืนยันอีเมล กดลิงก์ในอีเมลที่เราส่งไปก่อน";
    case "user_already_exists":
    case "email_exists":
      return "อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน";
    case "weak_password":
      return "รหัสผ่านสั้นหรือเดาง่ายเกินไป ใช้อย่างน้อย 6 ตัวอักษร";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "ส่งคำขอถี่เกินไป รอสักครู่แล้วลองใหม่";
    case "same_password":
      return "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม";
    case "validation_failed":
    case "email_address_invalid":
      return "รูปแบบอีเมลไม่ถูกต้อง";
  }
  if (error.status === 429) return "ส่งคำขอถี่เกินไป รอสักครู่แล้วลองใหม่";
  return "ทำรายการไม่สำเร็จ ลองอีกครั้ง";
}
