import { and, eq, gte, lt } from "drizzle-orm";
import { NextResponse } from "next/server";
import { capacityHolds, stores } from "@/db/schema";
import { db } from "@/db/client";
import { StoresQuery, StoresResponse } from "@/contracts/user";
import { availablePoints } from "@/lib/domain/capacity";
import { validationError } from "@/lib/api-response";

function utcDayRange(date: string) {
  const start = new Date(`${date}T00:00:00.000Z`);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = StoresQuery.parse({ date: url.searchParams.get("date") });
    const { start, end } = utcDayRange(query.date);

    const storeRows = await db.select().from(stores).where(eq(stores.isActive, true));
    const holdRows = await db
      .select()
      .from(capacityHolds)
      .where(and(eq(capacityHolds.released, false), lt(capacityHolds.occupyStart, end), gte(capacityHolds.occupyEnd, start)));

    const payload = storeRows.map((store) => ({
      id: store.id,
      code: store.code,
      name: store.name as Record<"en" | "vi" | "ja", string>,
      area: store.area,
      lat: store.lat,
      lng: store.lng,
      openTime: store.openTime,
      closeTime: store.closeTime,
      capacityPoints: store.capacityPoints,
      availablePoints: availablePoints(
        store.capacityPoints,
        holdRows.filter((hold) => hold.storeId === store.id),
        start,
        end
      )
    }));

    return NextResponse.json(StoresResponse.parse(payload));
  } catch (error) {
    return validationError(error);
  }
}
