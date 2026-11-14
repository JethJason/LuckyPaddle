import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { BOOKING_START_DATE, COURTS, OPEN_HOUR, closeHourFor, hourLabel } from "@/lib/config";
import {
  cancelReservation,
  createReservation,
  databaseConfigured,
  listBookings,
} from "@/lib/store";
import { manilaNow } from "@/lib/time";

export const dynamic = "force-dynamic";

const NOT_CONFIGURED =
  "Database is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local.";
const isRealDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
};

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!databaseConfigured()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  try {
    const bookings = await listBookings();
    return NextResponse.json({
      reservations: bookings.filter((booking) => booking.createdBy === "admin" && booking.status === "approved"),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load reservations." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!databaseConfigured()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const { date, name, email = "", phone = "" } = body;
  const court = Number(body.court);
  const hour = Number(body.hour);
  const duration = Number(body.duration);
  if (typeof date !== "string" || !isRealDate(date) || date < BOOKING_START_DATE) {
    return NextResponse.json({ error: "Choose a valid date from November 8, 2026 onward." }, { status: 400 });
  }
  if (!Number.isInteger(court) || !COURTS.some((item) => item.id === court)) {
    return NextResponse.json({ error: "Choose a valid court." }, { status: 400 });
  }
  if (!Number.isInteger(hour) || hour < OPEN_HOUR || !Number.isInteger(duration) || duration < 1 || hour + duration > closeHourFor(date)) {
    return NextResponse.json(
      { error: `Choose a time range within the court's opening hours (${hourLabel(OPEN_HOUR)} – ${hourLabel(closeHourFor(date))} on this date).` },
      { status: 400 },
    );
  }
  if (typeof name !== "string" || !name.trim() || name.trim().length > 120) {
    return NextResponse.json({ error: "Enter a reservation name (up to 120 characters)." }, { status: 400 });
  }
  if (typeof email !== "string" || (email && !/^\S+@\S+\.\S+$/.test(email))) {
    return NextResponse.json({ error: "Enter a valid email address or leave it blank." }, { status: 400 });
  }
  if (typeof phone !== "string") return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });

  const now = manilaNow();
  if (date < now.date || (date === now.date && hour <= now.hour)) {
    return NextResponse.json({ error: "Reservations must start in the future." }, { status: 400 });
  }

  try {
    const reservation = await createReservation({
      date,
      court,
      hour,
      duration,
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
    });
    if (!reservation) {
      return NextResponse.json({ error: "That time overlaps a booking or blocked slot." }, { status: 409 });
    }
    return NextResponse.json({ reservation }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not create the reservation." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!databaseConfigured()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing reservation id." }, { status: 400 });
  try {
    const reservation = await cancelReservation(id);
    if (!reservation) return NextResponse.json({ error: "Reservation not found or already canceled." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not cancel the reservation." },
      { status: 500 },
    );
  }
}
