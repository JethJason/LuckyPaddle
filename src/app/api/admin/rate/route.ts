import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { databaseConfigured, getRates, getTimeRates, setRates, setTimeRates } from "@/lib/store";

export const dynamic = "force-dynamic";

const NOT_CONFIGURED =
  "Database is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local.";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!databaseConfigured()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  try {
    const [rates, timeRates] = await Promise.all([getRates(), getTimeRates()]);
    return NextResponse.json({ rates, timeRates });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load rates." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!databaseConfigured()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  const body = await req.json().catch(() => ({}));

  try {
    if (Array.isArray(body.timeRates)) {
      const cleaned = body.timeRates
        .map((rate: { start: unknown; end: unknown; price: unknown }) => ({
          start: Number(rate.start),
          end: Number(rate.end),
          price: Number(rate.price),
        }))
        .filter(
          (rate: { start: number; end: number; price: number }) =>
            Number.isFinite(rate.start) &&
            Number.isFinite(rate.end) &&
            Number.isFinite(rate.price) &&
            rate.start >= 0 &&
            rate.end > rate.start &&
            rate.price >= 0,
        );
      const timeRates = await setTimeRates(cleaned);
      return NextResponse.json({ rates: await getRates(), timeRates });
    }

    const { maxHours, price } = body;
    if (typeof maxHours !== "number" || typeof price !== "number" || maxHours < 1 || price < 0) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const current = await getRates();
    const next = [...current];
    const index = next.findIndex((tier) => tier.maxHours === maxHours);
    if (index >= 0) next[index] = { maxHours, price };
    else next.push({ maxHours, price });
    return NextResponse.json({ rates: await setRates(next), timeRates: await getTimeRates() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save rates." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!databaseConfigured()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  const maxHours = Number(req.nextUrl.searchParams.get("maxHours"));
  try {
    const current = await getRates();
    const next = current.filter((tier) => tier.maxHours !== maxHours);
    return NextResponse.json({ rates: await setRates(next), timeRates: await getTimeRates() });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not remove the rate." },
      { status: 500 },
    );
  }
}
