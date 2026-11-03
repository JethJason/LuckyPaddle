import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, getAdminSession } from "@/lib/admin-auth";
import { changeAdminPassword } from "@/lib/admin-users";
import { databaseConfigured } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const admin = await getAdminSession();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!databaseConfigured()) return NextResponse.json({ error: "Supabase must be configured to change passwords." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (!currentPassword || newPassword.length < 12 || newPassword.length > 128) {
    return NextResponse.json({ error: "Enter your current password and a new password of at least 12 characters." }, { status: 400 });
  }

  try {
    const result = await changeAdminPassword(admin.id, currentPassword, newPassword);
    if (result === "invalid_current") return NextResponse.json({ error: "Your current password is incorrect." }, { status: 400 });
    if (result === "same_password") return NextResponse.json({ error: "Choose a new password different from your current one." }, { status: 400 });
    if (result === "not_found") return NextResponse.json({ error: "Admin account is no longer active." }, { status: 401 });
    if (result === "conflict") return NextResponse.json({ error: "The password was changed in another request. Sign in again and retry." }, { status: 409 });

    const response = NextResponse.json({ ok: true });
    response.cookies.set(ADMIN_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not change your password." }, { status: 500 });
  }
}
