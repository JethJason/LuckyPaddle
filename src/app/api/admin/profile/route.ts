import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { changeAdminUsername } from "@/lib/admin-users";
import { databaseConfigured } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!databaseConfigured()) return NextResponse.json({ error: "Supabase must be configured to update your username." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  if (!currentPassword || !/^[a-z0-9._-]{3,32}$/.test(username)) {
    return NextResponse.json({ error: "Enter your current password and a username with 3–32 letters, numbers, dots, underscores or dashes." }, { status: 400 });
  }

  try {
    const result = await changeAdminUsername(admin.id, currentPassword, username);
    if (result === "invalid_current") return NextResponse.json({ error: "Your current password is incorrect." }, { status: 400 });
    if (result === "taken") return NextResponse.json({ error: "That username is already in use." }, { status: 409 });
    if (result === "unchanged") return NextResponse.json({ error: "That is already your current username." }, { status: 400 });
    if (result === "not_found") return NextResponse.json({ error: "Admin account is no longer active." }, { status: 401 });
    return NextResponse.json({ ok: true, username });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update your username." }, { status: 500 });
  }
}
