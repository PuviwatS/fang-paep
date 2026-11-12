import nodemailer, { Transporter } from "nodemailer";
import { config } from "../config";
import { AppError } from "../middleware/error";

export interface Mailer {
  send(message: { to: string; subject: string; text: string }): Promise<void>;
}

export function configuredMailer(): Mailer {
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && config.mailFrom) {
    return {
      async send(message) {
        try {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ from: config.mailFrom, ...message }),
            signal: AbortSignal.timeout(15000),
          });
          if (!response.ok) throw new Error("Mail provider rejected delivery");
        } catch {
          throw new AppError("EMAIL_DELIVERY_FAILED", "Email delivery failed; please try again", 503);
        }
      },
    };
  }
  const host = process.env.SMTP_HOST;
  if (!host || !config.mailFrom) {
    return {
      send: async () => {
        throw new AppError("EMAIL_DELIVERY_FAILED", "Email delivery is unavailable", 503);
      },
    };
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure = process.env.SMTP_SECURE === "true";
  const transport: Transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: config.production || port === 587,
    tls: { minVersion: "TLSv1.2" },
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
  });
  return {
    async send(message) {
      try {
        await transport.sendMail({ from: config.mailFrom, ...message });
      } catch {
        throw new AppError("EMAIL_DELIVERY_FAILED", "Email delivery failed; please try again", 503);
      }
    },
  };
}

export function verificationMail(mailer: Mailer, email: string, token: string): Promise<void> {
  return mailer.send({
    to: email,
    subject: "Verify your Fang Paep email",
    text: `Verify your email: ${config.frontendUrl}/auth/callback?token=${encodeURIComponent(token)}`,
  });
}

export function resetMail(mailer: Mailer, email: string, token: string): Promise<void> {
  return mailer.send({
    to: email,
    subject: "Reset your Fang Paep password",
    text: `Reset your password: ${config.frontendUrl}/account/password?token=${encodeURIComponent(token)}`,
  });
}
