import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { sendConfirmation, sendRejection } from "@/lib/email";
import { databaseConfigured, listBookings, review } from "@/lib/store";

export const dynamic = "force-dynamic";

const NOT_CONFIGURED =
  "Database is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local.";

export async function GET() {
  if (!isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  if (!isAdmin()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!databaseConfigured()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });

  const { id, action } = await req.json().catch(() => ({}));
  if (!id || (action !== "approve" && action !== "reject"))
    return NextResponse.json({ error: "Invalid review request." }, { status: 400 });

  try {
    const booking = await review(id, action === "approve" ? "approved" : "rejected");
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
