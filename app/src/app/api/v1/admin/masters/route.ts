import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { feeSettings, pricePlans, stores } from "@/db/schema";
import { FeeSettingRequest, MastersResponse, PricePlanRequest } from "@/contracts/admin";
import { requireAdminAuth } from "@/lib/auth/admin-auth";
import { z } from "zod";

const MasterPostRequest = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("price_plan"), data: PricePlanRequest }),
  z.object({ kind: z.literal("fee_setting"), data: FeeSettingRequest })
]);

export async function GET() {
  await requireAdminAuth();
  const [storeRows, priceRows, feeRows] = await Promise.all([
    db.select().from(stores),
    db.select().from(pricePlans),
    db.select().from(feeSettings)
  ]);

  return NextResponse.json(
    MastersResponse.parse({
      stores: storeRows,
      pricePlans: priceRows,
      feeSettings: feeRows,
      dailyStorageUnset: feeRows.some((row) => row.key === "daily_storage_fee_vnd" && row.valueVnd === null)
    })
  );
}

export async function POST(request: NextRequest) {
  await requireAdminAuth();
  const body = MasterPostRequest.parse(await request.json());

  if (body.kind === "price_plan") {
    const [row] = await db.insert(pricePlans).values(body.data).returning();
    return NextResponse.json(row, { status: 201 });
  }

  const [row] = await db.insert(feeSettings).values(body.data).returning();
  return NextResponse.json(row, { status: 201 });
}
