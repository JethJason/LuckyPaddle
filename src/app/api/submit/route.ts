import { NextRequest, NextResponse } from "next/server";
import { BALLS_PRICE, MAX_PADDLES, PADDLE_RENT } from "@/lib/config";
import { databaseConfigured, getBooking, getInventory, submitPayment } from "@/lib/store";

export async function POST(req: NextRequest) {
  if (!databaseConfigured())
    return NextResponse.json({ error: "Database is not configured yet." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const { holdId, name, email, phone, reference } = body;
  const paddles = Number(body.paddles) || 0;
  const balls = Number(body.balls) || 0;

  if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email ?? "") || !phone?.trim() || !reference?.trim())
    return NextResponse.json(
      { error: "Fill in your name, email, phone and payment reference number." },
      { status: 400 },
    );
  if (!Number.isInteger(paddles) || paddles < 0 || !Number.isInteger(balls) || balls < 0)
    return NextResponse.json({ error: "Invalid add-on quantity." }, { status: 400 });
  if (paddles > MAX_PADDLES)
    return NextResponse.json({ error: `You can rent at most ${MAX_PADDLES} paddles per booking.` }, { status: 400 });

  try {
    const hold = await getBooking(holdId);
    if (!hold || hold.status !== "held")
      return NextResponse.json(
        { error: "Your 10-minute hold has expired. Pick the slot again." },
        { status: 410 },
      );
    if (!hold.proofPath)
      return NextResponse.json(
        { error: "Upload a photo of your payment receipt before submitting." },
        { status: 400 },
      );

    const inventory = await getInventory();
    if (paddles > inventory.paddles || balls > inventory.balls)
      return NextResponse.json({ error: "Not enough paddles or balls in stock." }, { status: 409 });

    const extra = paddles * PADDLE_RENT + balls * BALLS_PRICE;
    const booking = await submitPayment(holdId, {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      reference: reference.trim(),
      paddles,
      balls,
      amount: hold.amount + extra,
    });
    if (!booking)
      return NextResponse.json(
        { error: "Your 10-minute hold has expired. Pick the slot again." },
        { status: 410 },
      );

    return NextResponse.json({ ok: true, id: booking.id, amount: booking.amount });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not submit the booking." },
      { status: 500 },
    );
  }
}
