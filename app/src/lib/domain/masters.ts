import { and, eq, inArray, lte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { pricePlans } from "@/db/schema";
import type { ChannelTier, PlanHours, Size } from "@/contracts/common";
import { DEFAULT_PRICE_TABLE, type PriceTable } from "@/lib/domain/pricing";

export async function loadCurrentPriceTable(validOn: string, channelTier: ChannelTier = "direct"): Promise<PriceTable> {
  const rows = await db
    .select({
      size: pricePlans.size,
      planHours: pricePlans.planHours,
      priceVnd: pricePlans.priceVnd
    })
    .from(pricePlans)
    .where(and(lte(pricePlans.validFrom, validOn), eq(pricePlans.channelTier, channelTier), inArray(pricePlans.size, ["S", "M", "L"])))
    .orderBy(sql`${pricePlans.validFrom} desc`);

  const table: PriceTable = {
    direct: {
      S: { ...DEFAULT_PRICE_TABLE.direct.S },
      M: { ...DEFAULT_PRICE_TABLE.direct.M },
      L: { ...DEFAULT_PRICE_TABLE.direct.L }
    },
    ota: {
      S: { ...DEFAULT_PRICE_TABLE.ota.S },
      M: { ...DEFAULT_PRICE_TABLE.ota.M },
      L: { ...DEFAULT_PRICE_TABLE.ota.L }
    }
  };
  const seen = new Set<string>();

  for (const row of rows) {
    const size = row.size as Size;
    const planHours = row.planHours as PlanHours;
    const key = `${size}:${planHours}`;
    if (seen.has(key)) {
      continue;
    }
    table[channelTier][size][planHours] = Number(row.priceVnd);
    seen.add(key);
  }

  return table;
}
