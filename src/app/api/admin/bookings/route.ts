import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { sendCancellation, sendConfirmation, sendRejection } from "@/lib/email";
import { cancelApprovedBooking, databaseConfigured, deleteApprovedBooking, deleteCancelledBooking, listBookings, review } from "@/lib/store";

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
  if (!id || (action !== "approve" && action !== "reject" && action !== "cancel" && action !== "delete" && action !== "purge"))
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

    if (action === "purge") {
      const booking = await deleteCancelledBooking(id);
      if (!booking)
        return NextResponse.json({ error: "Only a cancelled booking can be deleted here." }, { status: 409 });
      return NextResponse.json({ ok: true, booking, deleted: true });
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
    if (action === "cancel" && typeof error === "object" && error !== null && "code" in error) {
      const databaseError = error as { code?: string; message?: string };
      if (
        databaseError.code === "42703" ||
        databaseError.code === "PGRST204" ||
        (databaseError.code === "23514" && databaseError.message?.includes("status"))
      ) {
        return NextResponse.json(
          { error: "Cancellation isn't enabled in the database yet. Run the latest supabase/schema.sql in Supabase → SQL Editor, then try again." },
          { status: 503 },
        );
      }
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not review the booking." },
      { status: 500 },
    );
  }
}
