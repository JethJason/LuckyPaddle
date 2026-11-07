import { NextRequest, NextResponse } from "next/server";
import { MAX_PADDLES } from "@/lib/config";
import { databaseConfigured, dayStatus, getInventory, getTimeRates, listBlocks } from "@/lib/store";
import { manilaNow } from "@/lib/time";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0, must-revalidate" };

const NOT_CONFIGURED =
  "Database is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local.";

export async function GET(req: NextRequest) {
  if (!databaseConfigured()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503, headers: NO_STORE_HEADERS });
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
    }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load availability." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
