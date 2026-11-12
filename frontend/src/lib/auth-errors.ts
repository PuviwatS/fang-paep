/** Turns API authentication errors into a Thai message for players. */
export function authErrorMessage(error: { code?: string; message: string; status?: number }): string {
  switch (error.code) {
    case "invalid_credentials":
    case "INVALID_CREDENTIALS":
      return "อีเมลหรือรหัสผ่านไม่ถูกต้อง";
    case "email_not_confirmed":
    case "EMAIL_NOT_VERIFIED":
      return "ยังไม่ได้ยืนยันอีเมล กดลิงก์ในอีเมลที่เราส่งไปก่อน";
    case "user_already_exists":
    case "email_exists":
    case "EMAIL_IN_USE":
      return "อีเมลนี้สมัครไว้แล้ว ลองเข้าสู่ระบบแทน";
    case "weak_password":
    case "invalid_password":
    case "VALIDATION_ERROR":
      return "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "ส่งคำขอถี่เกินไป รอสักครู่แล้วลองใหม่";
    case "same_password":
      return "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสเดิม";
    case "validation_failed":
    case "email_address_invalid":
      return "รูปแบบอีเมลไม่ถูกต้อง";
    case "invalid_token":
    case "token_expired":
    case "INVALID_OR_EXPIRED_TOKEN":
      return "ลิงก์หมดอายุหรือใช้ไปแล้ว กรุณาขอลิงก์ใหม่";
    case "EMAIL_DELIVERY_FAILED":
      return "ส่งอีเมลไม่สำเร็จ ลองส่งลิงก์ยืนยันอีกครั้ง";
  }
  if (error.status === 429) return "ส่งคำขอถี่เกินไป รอสักครู่แล้วลองใหม่";
  return "ทำรายการไม่สำเร็จ ลองอีกครั้ง";
}
