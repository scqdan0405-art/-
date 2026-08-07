import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { salesChannels } from "@/db/schema";
import { SalesChannelRequest, SalesChannelResponse } from "@/contracts/admin";
import { requireAdminAuth } from "@/lib/auth/admin-auth";

const SalesChannelPatchRequest = SalesChannelRequest.partial().extend({ id: z.string().uuid() });

export async function GET() {
  await requireAdminAuth();
  const rows = await db.select().from(salesChannels);
  return NextResponse.json(
    SalesChannelResponse.parse(
      rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        channelType: row.channelType,
        commissionRate: row.commissionRate,
        supportsVoucher: row.supportsVoucher,
        isActive: row.isActive
      }))
    )
  );
}

export async function POST(request: NextRequest) {
  await requireAdminAuth();
  const body = SalesChannelRequest.parse(await request.json());
  const [row] = await db
    .insert(salesChannels)
    .values({
      code: body.code,
      name: body.name,
      channelType: body.channelType,
      commissionRate: body.commissionRate,
      supportsVoucher: body.supportsVoucher,
      isActive: body.isActive
    })
    .returning();
  return NextResponse.json({ id: row.id, ...body }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  await requireAdminAuth();
  const body = SalesChannelPatchRequest.parse(await request.json());
  const [row] = await db
    .update(salesChannels)
    .set({
      code: body.code,
      name: body.name,
      channelType: body.channelType,
      commissionRate: body.commissionRate,
      supportsVoucher: body.supportsVoucher,
      isActive: body.isActive
    })
    .where(eq(salesChannels.id, body.id))
    .returning();
  if (!row) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({
    id: row.id,
    code: row.code,
    name: row.name,
    channelType: row.channelType,
    commissionRate: row.commissionRate,
    supportsVoucher: row.supportsVoucher,
    isActive: row.isActive
  });
}
