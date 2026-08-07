"use client";

import { useMemo, useState } from "react";
import { PAYMENT_METHOD_OPTIONS, type PaymentMethodOption } from "@/lib/payment/methods";

type CheckoutClientProps = {
  storeCode: string;
  initialParams: Record<string, string | string[] | undefined>;
};

type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success"; bookingNo: string; bookingUrl: string }
  | { status: "error"; message: string };

function firstParam(params: CheckoutClientProps["initialParams"], key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function itemSizes(params: CheckoutClientProps["initialParams"]) {
  const raw = firstParam(params, "items") ?? "S";
  return raw
    .split(",")
    .map((size) => size.trim())
    .filter((size): size is "S" | "M" | "L" => size === "S" || size === "M" || size === "L");
}

export default function CheckoutClient({ storeCode, initialParams }: CheckoutClientProps) {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+84");
  const [prohibited, setProhibited] = useState(false);
  const [ownership, setOwnership] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethodOption>(PAYMENT_METHOD_OPTIONS[0]);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: "idle" });

  const bookingDraft = useMemo(
    () => ({
      storeId: firstParam(initialParams, "storeId") ?? "",
      visitDate: firstParam(initialParams, "visitDate") ?? new Date().toISOString().slice(0, 10),
      arrivalSlotStart: firstParam(initialParams, "arrivalSlotStart") ?? new Date().toISOString(),
      planHours: Number(firstParam(initialParams, "planHours") ?? 3),
      items: itemSizes(initialParams).map((size) => ({ size })),
      channel: firstParam(initialParams, "channel") ?? "direct",
      channelCode: firstParam(initialParams, "ref")
    }),
    [initialParams]
  );

  async function submit() {
    setSubmitState({ status: "submitting" });
    const response = await fetch("/api/v1/bookings", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": crypto.randomUUID()
      },
      body: JSON.stringify({
        ...bookingDraft,
        email,
        phone,
        locale: "ja",
        disclaimerAccepted: true,
        prohibitedItemsAcknowledged: prohibited,
        ownershipDeclared: ownership,
        payment: {
          method: selectedMethod.method,
          token: selectedMethod.token
        }
      })
    });

    const payload = await response.json();
    if (!response.ok) {
      setSubmitState({ status: "error", message: payload.message ?? payload.error ?? "Payment failed." });
      return;
    }

    if (payload.payment?.redirectUrl) {
      window.location.assign(payload.payment.redirectUrl);
      return;
    }

    setSubmitState({ status: "success", bookingNo: payload.bookingNo, bookingUrl: `/b/${payload.bookingToken}` });
  }

  const disabled = submitState.status === "submitting" || !email || !phone || !prohibited || !ownership || !bookingDraft.storeId;

  return (
    <main className="min-h-screen bg-[#f4f6fa] text-[#232a3a]">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-8">
        <header>
          <p className="text-sm font-semibold text-[#1f3864]">KONCOCHII</p>
          <h1 className="mt-2 text-3xl font-semibold">予約と決済</h1>
          <p className="mt-1 text-sm text-[#697089]">{storeCode}</p>
        </header>

        <div className="grid gap-4 rounded border border-[#dde3ee] bg-white p-5">
          <label className="grid gap-2 text-sm font-medium">
            メール
            <input className="h-11 rounded border border-[#cfd7e6] px-3" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-medium">
            電話番号
            <input className="h-11 rounded border border-[#cfd7e6] px-3" value={phone} onChange={(event) => setPhone(event.target.value)} />
          </label>
          <label className="flex gap-3 text-sm">
            <input type="checkbox" checked={prohibited} onChange={(event) => setProhibited(event.target.checked)} />
            禁止物を入れていません
          </label>
          <label className="flex gap-3 text-sm">
            <input type="checkbox" checked={ownership} onChange={(event) => setOwnership(event.target.checked)} />
            預ける荷物は自分の所有物です
          </label>
        </div>

        <div className="grid gap-3 rounded border border-[#dde3ee] bg-white p-5">
          <h2 className="text-base font-semibold">決済方法</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PAYMENT_METHOD_OPTIONS.map((option) => (
              <button
                key={option.id}
                className={`h-12 rounded border text-sm font-semibold ${selectedMethod.id === option.id ? "border-[#1f3864] bg-[#1f3864] text-white" : "border-[#cfd7e6] bg-white"}`}
                type="button"
                onClick={() => setSelectedMethod(option)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <button className="h-12 rounded bg-[#e8850c] font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#aab2c1]" disabled={disabled} onClick={submit}>
          {submitState.status === "submitting" ? "処理中" : "予約する"}
        </button>

        {submitState.status === "error" && <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{submitState.message}</p>}
        {submitState.status === "success" && (
          <a className="rounded border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800" href={submitState.bookingUrl}>
            {submitState.bookingNo}
          </a>
        )}
      </section>
    </main>
  );
}
