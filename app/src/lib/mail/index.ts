import { ConsoleMailer } from "@/lib/mail/console-mailer";
import type { Mailer } from "@/lib/mail/types";

export function getMailer(): Mailer {
  return new ConsoleMailer();
}

export type { Mailer, MailMessage } from "@/lib/mail/types";
