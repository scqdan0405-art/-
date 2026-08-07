import "server-only";
import { getMailer } from "@/lib/mail";
import type { Locale } from "@/contracts/common";

export type BookingConfirmationVars = {
  email: string;
  locale: Locale;
  bookingNo: string;
  bookingUrl: string;
  dropoffOtp: string;
  totalVnd: number;
};

export async function sendBookingConfirmation(input: BookingConfirmationVars) {
  await getMailer().send({
    to: input.email,
    subject: `[KONCOCHII] Booking ${input.bookingNo}`,
    text: [
      `Booking: ${input.bookingNo}`,
      `My booking page: ${input.bookingUrl}`,
      `Drop-off OTP: ${input.dropoffOtp}`,
      `Total: ${input.totalVnd.toLocaleString("vi-VN")} VND`
    ].join("\n")
  });
}

export async function sendEmailChanged(input: { oldEmail: string; newEmail: string; bookingNo: string; bookingUrl: string }) {
  const text = [
    `Booking: ${input.bookingNo}`,
    `The booking email address was changed.`,
    `My booking page: ${input.bookingUrl}`
  ].join("\n");

  await Promise.all([
    getMailer().send({ to: input.oldEmail, subject: `[KONCOCHII] Email changed ${input.bookingNo}`, text }),
    getMailer().send({ to: input.newEmail, subject: `[KONCOCHII] Email changed ${input.bookingNo}`, text })
  ]);
}
