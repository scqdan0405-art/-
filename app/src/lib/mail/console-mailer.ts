import type { Mailer, MailMessage } from "@/lib/mail/types";

export class ConsoleMailer implements Mailer {
  async send(message: MailMessage) {
    console.info("Development mail", {
      to: message.to,
      subject: message.subject,
      text: message.text,
      hasHtml: Boolean(message.html)
    });
  }
}
