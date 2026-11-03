import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin-auth";
import { databaseConfigured, getInventory, setInventory } from "@/lib/store";

export const dynamic = "force-dynamic";

const NOT_CONFIGURED =
  "Database is not configured. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local.";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!databaseConfigured()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  try {
    return NextResponse.json(await getInventory());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not load inventory." },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!databaseConfigured()) return NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 });
  const { paddles, balls } = await req.json().catch(() => ({}));
  try {
    return NextResponse.json(await setInventory({ paddles, balls }));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not save inventory." },
      { status: 500 },
    );
  }
}
