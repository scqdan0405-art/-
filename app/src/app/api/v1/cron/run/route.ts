import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { env } from "@/lib/env";
import { runCronJobs } from "@/lib/cron/jobs";
import { jsonError, routeError } from "@/lib/store-api";

const CronRunRequest = z.object({
  now: z.string().datetime().optional()
});

function assertCronAuthorized(request: NextRequest) {
  if (!env.CRON_SECRET) {
    return env.NODE_ENV !== "production";
  }

  return request.headers.get("authorization") === `Bearer ${env.CRON_SECRET}`;
}

export async function POST(request: NextRequest) {
  try {
    if (!assertCronAuthorized(request)) {
      return jsonError("UNAUTHORIZED", 401);
    }

    const body = CronRunRequest.parse(await request.json().catch(() => ({})));
    const injectedNow = env.NODE_ENV === "production" ? undefined : body.now;
    const result = await runCronJobs(injectedNow ? new Date(injectedNow) : new Date());
    return NextResponse.json(result);
  } catch (error) {
    return routeError(error);
  }
}
