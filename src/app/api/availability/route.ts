import { NextRequest, NextResponse } from "next/server";
import { MAX_PADDLES } from "@/lib/config";
import { databaseConfigured, dayStatus, getInventory, getTimeRates, listBlocks } from "@/lib/store";
import { manilaNow } from "@/lib/time";

export const dynamic = "force-dynamic";

const NOT_CONFIGURED =
  "Database is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local.";

export async function GET(req: NextRequest) {
  if (!databaseConfigured()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  const date = req.nextUrl.searchParams.get("date") ?? manilaNow().date;
  try {
    const status = await dayStatus(date);
    const blocks = (await listBlocks()).filter((b) => b.date === date);
    for (const block of blocks) {
      const court = (status[block.court] ??= {});
      for (let i = 0; i < block.duration; i++) {
        court[block.hour + i] = "booked" as const;
      }
    }
    const inventory = await getInventory();
    return NextResponse.json({
      date,
      status,
      now: manilaNow(),
      blocks,
      timeRates: await getTimeRates(),
      maxPaddles: Math.min(MAX_PADDLES, inventory.paddles),
      maxBalls: inventory.balls,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load availability." },
      { status: 500 },
    );
  }
}
