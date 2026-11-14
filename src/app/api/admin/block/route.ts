import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { OPEN_HOUR, closeHourFor } from "@/lib/config";
import { addBlock, databaseConfigured, listBlocks, removeBlock } from "@/lib/store";

export const dynamic = "force-dynamic";

const NOT_CONFIGURED =
  "Database is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local.";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!databaseConfigured()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  try {
    return NextResponse.json({ blocks: await listBlocks() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load blocks." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!databaseConfigured()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  const { date, court = 1, hour, duration = 1, reason = "" } = await req.json().catch(() => ({}));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  if (!Number.isInteger(hour) || hour < OPEN_HOUR || !Number.isInteger(duration) || hour + duration > closeHourFor(date) || duration < 1) {
    return NextResponse.json({ error: "Invalid time range" }, { status: 400 });
  }

  try {
    const block = await addBlock(date, court, hour, duration, reason);
    if (!block)
      return NextResponse.json(
        { error: "That time overlaps an existing booking or block." },
        { status: 409 },
      );
    return NextResponse.json({ block, blocks: await listBlocks() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not block time." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!databaseConfigured()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  try {
    await removeBlock(id);
    return NextResponse.json({ blocks: await listBlocks() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not remove block." },
      { status: 500 },
    );
  }
}
