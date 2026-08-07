import "server-only";
import { eq } from "drizzle-orm";
import { salesChannels } from "@/db/schema";
import { db } from "@/db/client";
import type { Channel, ChannelCode } from "@/contracts/common";

export type ResolvedChannel = {
  channel: Channel;
  channelCode: string | null;
};

export async function resolveSalesChannel(input: { channel?: Channel; channelCode?: ChannelCode }): Promise<ResolvedChannel> {
  const code = input.channelCode?.trim();
  if (!code) {
    return { channel: input.channel ?? "direct", channelCode: null };
  }

  const [registered] = await db
    .select({ channelType: salesChannels.channelType })
    .from(salesChannels)
    .where(eq(salesChannels.code, code))
    .limit(1);

  if (registered && isChannel(registered.channelType)) {
    return { channel: registered.channelType, channelCode: code };
  }

  return { channel: input.channel ?? fallbackChannel(code), channelCode: code };
}

function fallbackChannel(code: string): Channel {
  if (code === "google" || code === "maps") return "organic";
  if (code === "hotel" || code === "bus_tour") return "referral";
  if (code === "store_poster") return "store";
  if (code === "sns") return "sns";
  return "direct";
}

function isChannel(value: string): value is Channel {
  return ["direct", "organic", "ota", "referral", "store", "sns"].includes(value);
}
