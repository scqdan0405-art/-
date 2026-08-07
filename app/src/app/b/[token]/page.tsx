import QRCode from "qrcode";
import { notFound } from "next/navigation";
import { BookingToken } from "@/contracts/common";
import { loadBookingView } from "@/lib/bookings";

type BookingPageProps = {
  params: { token: string };
};

export default async function BookingPage({ params }: BookingPageProps) {
  const token = BookingToken.safeParse(params.token);
  if (!token.success) {
    notFound();
  }

  const booking = await loadBookingView(token.data, { auditPickupOtpView: true });
  if (!booking) {
    notFound();
  }

  const qrSvg = await QRCode.toString(token.data, { type: "svg", margin: 1, width: 220 });
  const canEditBeforeDropoff = booking.items.every((item) => item.status === "awaiting_dropoff");

  return (
    <main className="min-h-screen bg-[#f6f7f4] px-4 py-6 text-[#202124]">
      <section className="mx-auto grid w-full max-w-5xl gap-5 lg:grid-cols-[320px_1fr]">
        <aside className="border border-neutral-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">KONCOCHII booking</p>
          <h1 className="mt-2 text-3xl font-semibold">{booking.bookingNo}</h1>
          <div className="mt-5 flex justify-center" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <p className="mt-3 text-center text-xs text-neutral-500">QR payload: bookingToken only</p>
        </aside>

        <section className="border border-neutral-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm text-neutral-600">Status</p>
              <h2 className="text-2xl font-semibold">{booking.status}</h2>
            </div>
            <div className="text-right">
              <p className="text-sm text-neutral-600">Total</p>
              <p className="text-xl font-semibold">{booking.totalVnd.toLocaleString("vi-VN")} VND</p>
            </div>
          </div>

          {booking.activePickupOtp ? (
            <div className="mt-5 border border-emerald-200 bg-emerald-50 p-4">
              <p className="text-sm font-semibold text-emerald-800">Pickup OTP</p>
              <p className="mt-1 text-3xl font-semibold tracking-[0.2em]">{booking.activePickupOtp.otp}</p>
              <p className="mt-1 text-sm text-emerald-800">Tell this code to the store staff before it expires.</p>
            </div>
          ) : null}

          <div className="mt-5">
            <h3 className="font-semibold">Items</h3>
            <div className="mt-3 divide-y divide-neutral-200 border border-neutral-200">
              {booking.items.map((item) => (
                <article className="flex flex-wrap items-center justify-between gap-2 px-4 py-3" key={item.id}>
                  <div>
                    <p className="font-semibold">
                      {item.size} · {item.status}
                    </p>
                    <p className="text-sm text-neutral-600">Tag: {item.tagNo ?? "-"}</p>
                  </div>
                  <p className={item.overtimeFeeVnd > 0 ? "font-semibold text-red-700" : "font-semibold text-emerald-700"}>
                    {item.overtimeFeeVnd.toLocaleString("vi-VN")} VND
                  </p>
                </article>
              ))}
            </div>
          </div>

          {canEditBeforeDropoff ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button className="border border-neutral-300 px-4 py-3 font-semibold" type="button">
                Resend confirmation email
              </button>
              <button className="border border-neutral-300 px-4 py-3 font-semibold" type="button">
                Change email before drop-off
              </button>
            </div>
          ) : null}

          <div className="mt-5 border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            No cash, passports/IDs, valuables, jewelry, luxury goods, PCs, phones, electronic devices, data media,
            dangerous goods, or perishables may be stored. You declare the luggage is your own property.
          </div>
        </section>
      </section>
    </main>
  );
}
