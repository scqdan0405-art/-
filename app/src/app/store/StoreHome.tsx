"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type StoredItem = {
  itemId: string;
  bookingNo: string;
  tagNo: string | null;
  size: "S" | "M" | "L";
  status: "stored" | "overdue";
  returnDueAt: string | null;
  overtimeFeeVnd: number;
  overdue: boolean;
};

type StoreItemsResponse = {
  items: StoredItem[];
  counters: {
    checkins: number;
    returns: number;
  };
};

const money = new Intl.NumberFormat("vi-VN", {
  style: "currency",
  currency: "VND",
  maximumFractionDigits: 0
});

export function StoreHome() {
  const [staffCode, setStaffCode] = useState("");
  const [staffName, setStaffName] = useState<string | null>(null);
  const [items, setItems] = useState<StoredItem[]>([]);
  const [counters, setCounters] = useState({ checkins: 0, returns: 0 });
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadItems = useCallback(async () => {
    const response = await fetch("/api/v1/store/items", { cache: "no-store" });
    if (response.status === 403) {
      setStaffName(null);
      setMessage("Vui lòng nhập lại mã nhân viên.");
      return;
    }

    if (!response.ok) {
      setMessage("Không thể tải danh sách hiện tại.");
      return;
    }

    const data = (await response.json()) as StoreItemsResponse;
    setItems(data.items);
    setCounters(data.counters);
    setMessage(null);
  }, []);

  useEffect(() => {
    if (!staffName) {
      return;
    }

    void loadItems();
    const timer = window.setInterval(() => void loadItems(), 15_000);
    return () => window.clearInterval(timer);
  }, [loadItems, staffName]);

  async function submitStaffCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage(null);

    const response = await fetch("/api/v1/store/staff-gate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ staffCode })
    });

    setLoading(false);

    if (!response.ok) {
      setMessage("Mã nhân viên không hợp lệ hoặc đã bị vô hiệu hóa.");
      return;
    }

    const data = (await response.json()) as { staff: { displayName: string } };
    setStaffName(data.staff.displayName);
    setStaffCode("");
  }

  return (
    <main className="min-h-screen bg-[#f6f7f4] text-[#202124]">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">KONCOCHII Store</p>
            <h1 className="text-2xl font-semibold sm:text-3xl">Vận hành cửa hàng</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-neutral-600">
            <span>vi</span>
            <span className="text-neutral-300">/</span>
            <button className="rounded border border-neutral-300 px-3 py-1 text-neutral-700" type="button">
              en
            </button>
          </div>
        </header>

        {!staffName ? (
          <form className="max-w-sm border border-neutral-200 bg-white p-5 shadow-sm" onSubmit={submitStaffCode}>
            <label className="block text-sm font-semibold" htmlFor="staffCode">
              Mã nhân viên
            </label>
            <input
              className="mt-3 h-12 w-full border border-neutral-300 px-4 text-lg tracking-[0.3em]"
              id="staffCode"
              inputMode="numeric"
              maxLength={4}
              minLength={4}
              pattern="\d{4}"
              value={staffCode}
              onChange={(event) => setStaffCode(event.target.value.replace(/\D/g, "").slice(0, 4))}
            />
            <button
              className="mt-4 h-12 w-full bg-[#1f3864] px-4 font-semibold text-white disabled:opacity-50"
              disabled={loading || staffCode.length !== 4}
              type="submit"
            >
              {loading ? "Đang kiểm tra" : "Mở thao tác"}
            </button>
          </form>
        ) : (
          <div className="flex flex-col gap-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <a className="flex min-h-32 items-center justify-center bg-[#1f3864] p-6 text-2xl font-semibold text-white" href="/store/checkin">
                1. Nhận gửi
              </a>
              <a className="flex min-h-32 items-center justify-center bg-[#1a9e5c] p-6 text-2xl font-semibold text-white" href="/store/checkout">
                3. Trả đồ
              </a>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="border border-neutral-200 bg-white p-4">
                <p className="text-sm text-neutral-600">Nhân viên</p>
                <p className="mt-1 text-xl font-semibold">{staffName}</p>
              </div>
              <div className="border border-neutral-200 bg-white p-4">
                <p className="text-sm text-neutral-600">Nhận hôm nay</p>
                <p className="mt-1 text-xl font-semibold">{counters.checkins}</p>
              </div>
              <div className="border border-neutral-200 bg-white p-4">
                <p className="text-sm text-neutral-600">Trả hôm nay</p>
                <p className="mt-1 text-xl font-semibold">{counters.returns}</p>
              </div>
            </div>

            <section className="border border-neutral-200 bg-white">
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                <h2 className="font-semibold">Đang lưu giữ</h2>
                <button className="text-sm font-semibold text-[#1f3864]" type="button" onClick={() => void loadItems()}>
                  Cập nhật
                </button>
              </div>
              <div className="divide-y divide-neutral-200">
                {items.length === 0 ? (
                  <p className="px-4 py-8 text-sm text-neutral-600">Không có hành lý đang lưu giữ.</p>
                ) : (
                  items.map((item) => (
                    <article className={item.overdue ? "bg-red-50 px-4 py-3" : "px-4 py-3"} key={item.itemId}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold">
                            {item.tagNo ?? "No tag"} · {item.size} · {item.bookingNo}
                          </p>
                          <p className="text-sm text-neutral-600">
                            Hạn trả: {item.returnDueAt ? new Date(item.returnDueAt).toLocaleString("vi-VN") : "-"}
                          </p>
                        </div>
                        {item.overdue ? (
                          <p className="font-semibold text-red-700">{money.format(item.overtimeFeeVnd)}</p>
                        ) : (
                          <p className="text-sm font-semibold text-emerald-700">OK</p>
                        )}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {message ? <p className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{message}</p> : null}
      </section>
    </main>
  );
}
