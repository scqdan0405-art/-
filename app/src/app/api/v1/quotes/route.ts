import { NextResponse } from "next/server";
import { QuoteRequest, QuoteResponse } from "@/contracts/user";
import { bookingTotal, quoteLines } from "@/lib/domain/pricing";
import { loadCurrentPriceTable } from "@/lib/domain/masters";
import { validationError } from "@/lib/api-response";

export async function POST(request: Request) {
  try {
    const body = QuoteRequest.parse(await request.json());
    const prices = await loadCurrentPriceTable(body.visitDate);
    const itemsTotalVnd = bookingTotal(body.items, body.planHours, "direct", prices);
    const insuranceAddonVnd = 0;
    const payload = QuoteResponse.parse({
      itemsTotalVnd,
      insuranceAddonVnd,
      totalVnd: itemsTotalVnd + insuranceAddonVnd,
      lines: quoteLines(body.items, body.planHours, "direct", prices),
      expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
    });

    return NextResponse.json(payload);
  } catch (error) {
    return validationError(error);
  }
}
