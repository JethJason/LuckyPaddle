import { NextRequest, NextResponse } from "next/server";
import { createHold, databaseConfigured, getBooking, isBlocked, isValidSlot, releaseHold, updateHold } from "@/lib/store";
import { manilaNow } from "@/lib/time";
import { BOOKING_START_DATE, CLOSE_HOUR } from "@/lib/config";

const NOT_CONFIGURED =
  "Database is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local.";

export async function POST(req: NextRequest) {
  if (!databaseConfigured()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  if (req.nextUrl.searchParams.get("_method") === "DELETE") return DELETE(req); // from sendBeacon
  const { date, court, hour, holdId, duration: rawDuration } = await req.json();
  const duration = rawDuration ?? 1;
  if (typeof date === "string" && date < BOOKING_START_DATE)
    return NextResponse.json({ error: "Bookings open on November 8, 2026." }, { status: 400 });
  if (!isValidSlot(date, court, hour)) return NextResponse.json({ error: "Invalid slot." }, { status: 400 });
  if (!Number.isInteger(duration) || duration < 1 || hour + duration > CLOSE_HOUR)
    return NextResponse.json({ error: "Invalid time range. Pick a start and end within opening hours." }, { status: 400 });

  const now = manilaNow();
  if (date < now.date || (date === now.date && hour <= now.hour))
    return NextResponse.json({ error: "That time has already passed." }, { status: 400 });

  try {
    if (holdId && typeof holdId !== "string")
      return NextResponse.json({ error: "Invalid hold id." }, { status: 400 });

    if (await isBlocked(date, court, hour, duration, typeof holdId === "string" ? holdId : undefined))
      return NextResponse.json({ error: "That time is unavailable." }, { status: 409 });

    const hold = holdId
      ? await updateHold(holdId, date, court, hour, duration)
      : await createHold(date, court, hour, duration);
    if (!hold)
      return NextResponse.json(
        { error: holdId ? "Your hold expired. Pick a time again." : "Someone just took that slot. Pick another." },
        { status: holdId ? 410 : 409 },
      );
    return NextResponse.json({
      id: hold.id,
      expiresAt: hold.expiresAt ?? Date.now() + 10 * 60_000,
      amount: hold.amount,
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23P01") {
      return NextResponse.json(
        { error: "That time was just taken. Your previous held time is still reserved." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not hold that slot." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  try {
    if (id && (await getBooking(id))) await releaseHold(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not release the hold." },
      { status: 500 },
    );
  }
}
