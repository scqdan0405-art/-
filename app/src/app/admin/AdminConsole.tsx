"use client";

import { useEffect, useState } from "react";

type Tab = "dashboard" | "bookings" | "settlement" | "daily" | "channels" | "masters" | "staff" | "accounts";

const tabs: Array<{ id: Tab; label: string }> = [
  { id: "dashboard", label: "Dashboard" },
  { id: "bookings", label: "Bookings" },
  { id: "settlement", label: "Settlement" },
  { id: "daily", label: "Daily" },
  { id: "channels", label: "Channels" },
  { id: "masters", label: "Masters" },
  { id: "staff", label: "Staff" },
  { id: "accounts", label: "Accounts" }
];

function money(value: number) {
  return `${value.toLocaleString("vi-VN")} VND`;
}

export default function AdminConsole() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [data, setData] = useState<Record<string, unknown>>({});
  const [channelCode, setChannelCode] = useState("");
  const [channelName, setChannelName] = useState("");
  const [channelType, setChannelType] = useState("ota");

  useEffect(() => {
      const endpoint =
      tab === "channels"
        ? "/api/v1/admin/sales-channels"
        : tab === "staff"
          ? "/api/v1/admin/staff"
        : tab === "masters"
          ? "/api/v1/admin/masters"
          : tab === "accounts"
            ? "/api/v1/admin/accounts"
          : `/api/v1/admin/${tab}`;
    fetch(endpoint)
      .then((response) => response.json())
      .then((payload) => setData((current) => ({ ...current, [tab]: payload })))
      .catch(() => setData((current) => ({ ...current, [tab]: null })));
  }, [tab]);

  async function addChannel() {
    if (!channelCode || !channelName) return;
    await fetch("/api/v1/admin/sales-channels", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: channelCode,
        name: channelName,
        channelType,
        commissionRate: channelType === "ota" ? 0.25 : 0,
        supportsVoucher: channelType === "ota",
        isActive: true
      })
    });
    setChannelCode("");
    setChannelName("");
    const refreshed = await fetch("/api/v1/admin/sales-channels").then((response) => response.json());
    setData((current) => ({ ...current, channels: refreshed }));
  }

  const current = data[tab] as any;

  return (
    <main className="min-h-screen bg-[#f4f6fa] text-[#232a3a]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-5 py-6">
        <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#d9e1ec] pb-4">
          <div>
            <p className="text-xs font-semibold uppercase text-[#697089]">KONCOCHII</p>
            <h1 className="text-2xl font-semibold">Admin Console</h1>
          </div>
          <nav className="flex flex-wrap gap-2">
            {tabs.map((item) => (
              <button
                key={item.id}
                className={`h-9 rounded border px-3 text-sm font-medium ${tab === item.id ? "border-[#1f3864] bg-[#1f3864] text-white" : "border-[#cfd7e6] bg-white"}`}
                onClick={() => setTab(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </nav>
        </header>

        {tab === "dashboard" && current && (
          <section className="grid gap-4">
            {current.dailyStorageUnset && <p className="border-l-4 border-[#e8850c] bg-white p-3 text-sm">daily_storage_fee_vnd is unset.</p>}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              {[
                ["Bookings", current.totalBookings],
                ["Active items", current.activeItems],
                ["Revenue", money(current.revenueVnd ?? 0)],
                ["Completed", current.completed],
                ["No-show", current.noShows]
              ].map(([label, value]) => (
                <div key={label} className="border border-[#d9e1ec] bg-white p-4">
                  <p className="text-xs text-[#697089]">{label}</p>
                  <p className="mt-1 text-xl font-semibold">{value}</p>
                </div>
              ))}
            </div>
            <DataTable rows={current.byStore ?? []} />
          </section>
        )}

        {tab === "bookings" && current && <DataTable rows={current.rows ?? []} />}
        {tab === "settlement" && current && (
          <section className="grid gap-3">
            <a className="w-fit rounded border border-[#cfd7e6] bg-white px-3 py-2 text-sm" href="/api/v1/admin/settlement?format=csv">
              CSV
            </a>
            <DataTable rows={current} />
          </section>
        )}
        {tab === "daily" && current && (
          <section className="grid gap-3">
            <a className="w-fit rounded border border-[#cfd7e6] bg-white px-3 py-2 text-sm" href="/api/v1/admin/daily?format=csv">
              CSV
            </a>
            <DataTable rows={current} />
          </section>
        )}
        {tab === "channels" && current && (
          <section className="grid gap-4">
            <div className="grid gap-3 border border-[#d9e1ec] bg-white p-4 md:grid-cols-[1fr_1fr_160px_auto]">
              <input className="h-10 border border-[#cfd7e6] px-3" placeholder="code" value={channelCode} onChange={(event) => setChannelCode(event.target.value)} />
              <input className="h-10 border border-[#cfd7e6] px-3" placeholder="name" value={channelName} onChange={(event) => setChannelName(event.target.value)} />
              <select className="h-10 border border-[#cfd7e6] px-3" value={channelType} onChange={(event) => setChannelType(event.target.value)}>
                {["direct", "organic", "ota", "referral", "store", "sns"].map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
              <button className="h-10 rounded bg-[#1f3864] px-4 text-sm font-semibold text-white" onClick={addChannel} type="button">
                Add
              </button>
            </div>
            <DataTable rows={current} />
          </section>
        )}
        {tab === "masters" && current && (
          <section className="grid gap-5">
            {current.dailyStorageUnset && <p className="border-l-4 border-[#e8850c] bg-white p-3 text-sm">daily_storage_fee_vnd is null.</p>}
            <h2 className="text-lg font-semibold">Price plans</h2>
            <DataTable rows={current.pricePlans ?? []} />
            <h2 className="text-lg font-semibold">Fee settings</h2>
            <DataTable rows={current.feeSettings ?? []} />
          </section>
        )}
        {tab === "staff" && current && <DataTable rows={current} />}
        {tab === "accounts" && (
          <section className="border border-[#d9e1ec] bg-white p-4 text-sm text-[#697089]">
            Store account creation, ban, unban, and forced password reset are available through /api/v1/admin/accounts.
          </section>
        )}
      </div>
    </main>
  );
}

function DataTable({ rows }: { rows: Array<Record<string, unknown>> }) {
  const headers = Object.keys(rows[0] ?? {});
  if (!rows.length) {
    return <p className="border border-[#d9e1ec] bg-white p-4 text-sm text-[#697089]">No rows</p>;
  }

  return (
    <div className="overflow-auto border border-[#d9e1ec] bg-white">
      <table className="min-w-full border-collapse text-left text-sm">
        <thead className="bg-[#eef2f7]">
          <tr>
            {headers.map((header) => (
              <th key={header} className="whitespace-nowrap border-b border-[#d9e1ec] px-3 py-2 font-semibold">
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index} className="border-b border-[#edf1f6]">
              {headers.map((header) => (
                <td key={header} className="max-w-80 truncate px-3 py-2">
                  {formatCell(row[header])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function formatCell(value: unknown) {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
