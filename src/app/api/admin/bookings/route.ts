import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { sendCancellation, sendConfirmation, sendRejection } from "@/lib/email";
import { cancelApprovedBooking, databaseConfigured, deleteApprovedBooking, listBookings, review } from "@/lib/store";

export const dynamic = "force-dynamic";

const NOT_CONFIGURED =
  "Database is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local.";

export async function GET() {
  if (!(await getAdminSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!databaseConfigured()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  try {
    return NextResponse.json({ bookings: await listBookings() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load bookings." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!databaseConfigured()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });

  const { id, action, reason } = await req.json().catch(() => ({}));
  if (!id || (action !== "approve" && action !== "reject" && action !== "cancel" && action !== "delete"))
    return NextResponse.json({ error: "Invalid review request." }, { status: 400 });

  try {
    if (action === "cancel") {
      const booking = await cancelApprovedBooking(id, {
        adminId: admin.id,
        adminName: admin.displayName,
        reason: typeof reason === "string" ? reason : undefined,
      });
      if (!booking)
        return NextResponse.json({ error: "Only an approved customer reservation can be cancelled." }, { status: 409 });
      const emailed = await sendCancellation(booking);
      return NextResponse.json({ ok: true, booking, emailed });
    }

    if (action === "delete") {
      const booking = await deleteApprovedBooking(id);
      if (!booking)
        return NextResponse.json({ error: "Only an approved customer reservation can be permanently deleted." }, { status: 409 });
      const emailed = await sendCancellation(booking);
      return NextResponse.json({ ok: true, booking, emailed, deleted: true });
    }

    const booking = await review(id, action === "approve" ? "approved" : "rejected", {
      id: admin.id,
      displayName: admin.displayName,
    });
    if (!booking)
      return NextResponse.json({ error: "Already reviewed or not found." }, { status: 409 });

    const emailed = action === "approve"
      ? await sendConfirmation(booking)
      : await sendRejection(booking);
    return NextResponse.json({ ok: true, booking, emailed });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not review the booking." },
      { status: 500 },
    );
  }
}
