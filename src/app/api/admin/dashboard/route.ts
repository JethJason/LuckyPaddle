import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { CLOSE_HOUR, COURTS, OPEN_HOUR } from "@/lib/config";
import { databaseConfigured, listBookings, type Booking } from "@/lib/store";
import { manilaNow } from "@/lib/time";

export const dynamic = "force-dynamic";

const NOT_CONFIGURED =
  "Database is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local.";
const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const ACTIVE = new Set<Booking["status"]>(["held", "awaiting_review", "approved"]);

export async function GET(req: NextRequest) {
  if (!isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!databaseConfigured()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });

  const now = manilaNow();
  const requested = req.nextUrl.searchParams.get("date") ?? now.date;
  const date = isDate(requested) ? requested : now.date;

  try {
    const bookings = await listBookings();
    const approved = bookings.filter((b) => b.status === "approved");
    const pending = bookings.filter((b) => b.status === "awaiting_review");
    const held = bookings.filter((b) => b.status === "held");
    const slotsPerDay = CLOSE_HOUR - OPEN_HOUR;

    const approvedToday = approved.filter((b) => b.date === now.date);
    const occupiedHours = approvedToday.reduce((sum, b) => {
      const start = Math.max(b.hour, OPEN_HOUR);
      const end = Math.min(b.hour + b.duration, CLOSE_HOUR);
      return sum + Math.max(0, end - start);
    }, 0);

    const stats = {
      revenue: approved.reduce((sum, b) => sum + b.amount, 0),
      approvedCount: approved.length,
      pendingCount: pending.length,
      upcomingCount: approved.filter(
        (b) => b.date > now.date || (b.date === now.date && b.hour > now.hour),
      ).length,
      todayBookings: approvedToday.length,
      occupancy: Math.min(100, Math.round((occupiedHours / slotsPerDay) * 100)),
      activeHolds: held.length,
    };

    const activeForSchedule = bookings.filter((b) => ACTIVE.has(b.status));
    const schedule = Array.from({ length: slotsPerDay }, (_, index) => {
      const hour = OPEN_HOUR + index;
      const booking =
        activeForSchedule.find(
          (b) =>
            b.date === date &&
            b.court === (COURTS[0]?.id ?? 1) &&
            hour >= b.hour &&
            hour < b.hour + b.duration,
        ) ?? null;
      return {
        hour,
        booking,
        isStart: booking ? booking.hour === hour : false,
        past: date < now.date || (date === now.date && hour <= now.hour),
      };
    });

    return NextResponse.json({
      date,
      today: now.date,
      court: COURTS[0]?.name ?? "Court",
      stats,
      schedule,
      bookings,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load the dashboard." },
      { status: 500 },
    );
  }
}
