import "server-only";
import nodemailer from "nodemailer";
import { env } from "@/lib/env";
import type { RenderedEmail } from "./templates";

export type OutgoingEmail = RenderedEmail & { to: string; fromName: string };

/** The one seam between the queue and the outside world. Tests pass a fake. */
export interface Mailer {
  send(email: OutgoingEmail): Promise<void>;
}

/** Development default: the email is printed, nothing leaves the machine. */
export const consoleMailer: Mailer = {
  async send(email) {
    console.log(`[mail] to=${email.to} subject="${email.subject}"\n${email.text}\n`);
  },
};

function smtpMailer(): Mailer {
  const transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
  return {
    async send(email) {
      await transport.sendMail({
        from: { name: email.fromName, address: env.MAIL_FROM_EMAIL },
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html,
      });
    },
  };
}

export function createMailer(): Mailer {
  return env.MAIL_DRIVER === "smtp" ? smtpMailer() : consoleMailer;
}
