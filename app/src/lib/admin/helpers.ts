export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) {
    return "***";
  }
  return `${name.slice(0, 2)}***@${domain}`;
}

export function maskPhone(phone: string) {
  if (phone.length <= 5) {
    return "***";
  }
  return `${phone.slice(0, 4)}***${phone.slice(-2)}`;
}

export function revenueBreakdown(grossVnd: number) {
  const storeCommission40Vnd = Math.round(grossVnd * 0.4);
  const paymentFee3Vnd = Math.round(grossVnd * 0.03);
  const insurance6Vnd = Math.round(grossVnd * 0.06);
  const system5Vnd = Math.round(grossVnd * 0.05);
  return {
    grossVnd,
    storeCommission40Vnd,
    paymentFee3Vnd,
    insurance6Vnd,
    system5Vnd,
    estimatedNetVnd: grossVnd - storeCommission40Vnd - paymentFee3Vnd - insurance6Vnd - system5Vnd
  };
}

export function csvResponse(filename: string, rows: Array<Record<string, string | number | null>>) {
  const headers = Object.keys(rows[0] ?? { empty: "" });
  const escape = (value: string | number | null) => {
    const text = value === null ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  const csv = [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\r\n");
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`
    }
  });
}

export function toDateRange(searchParams: URLSearchParams) {
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  return {
    fromDate: from ? new Date(`${from}T00:00:00.000Z`) : new Date("1970-01-01T00:00:00.000Z"),
    toDate: to ? new Date(`${to}T23:59:59.999Z`) : new Date("2999-12-31T23:59:59.999Z")
  };
}
