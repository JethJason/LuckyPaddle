import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createAdminUser, listAdminUsers, setAdminUserActive } from "@/lib/admin-users";
import { databaseConfigured } from "@/lib/store";

export const dynamic = "force-dynamic";
const NOT_CONFIGURED = "Configure Supabase and run supabase/schema.sql before managing admin users.";

async function ownerOnly() {
  const admin = await getAdminSession();
  if (!admin) return { response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (admin.role !== "owner") return { response: NextResponse.json({ error: "Only an owner can manage admin users." }, { status: 403 }) };
  if (!databaseConfigured()) return { response: NextResponse.json({ error: NOT_CONFIGURED }, { status: 503 }) };
  return { admin };
}

export async function GET() {
  const access = await ownerOnly();
  if ("response" in access) return access.response;
  try {
    return NextResponse.json({ users: await listAdminUsers(), currentUserId: access.admin.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not load users." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const access = await ownerOnly();
  if ("response" in access) return access.response;
  const body = await req.json().catch(() => ({}));
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const role = body.role === "owner" ? "owner" : body.role === "admin" ? "admin" : null;

  if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
    return NextResponse.json({ error: "Username must be 3–32 characters: letters, numbers, dot, underscore or dash." }, { status: 400 });
  }
  if (displayName.length < 2 || displayName.length > 80) {
    return NextResponse.json({ error: "Display name must be 2–80 characters." }, { status: 400 });
  }
  if (password.length < 12 || password.length > 128) {
    return NextResponse.json({ error: "Password must be at least 12 characters." }, { status: 400 });
  }
  if (!role) return NextResponse.json({ error: "Choose an admin role." }, { status: 400 });

  try {
    const user = await createAdminUser({ username, displayName, password, createdBy: access.admin.id, role });
    if (!user) return NextResponse.json({ error: "That username is already in use." }, { status: 409 });
    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not create user." }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const access = await ownerOnly();
  if ("response" in access) return access.response;
  const body = await req.json().catch(() => ({}));
  const { id, active } = body;
  if (typeof id !== "string" || typeof active !== "boolean") {
    return NextResponse.json({ error: "A user id and active state are required." }, { status: 400 });
  }
  if (id === access.admin.id && !active) {
    return NextResponse.json({ error: "You cannot deactivate your own account." }, { status: 400 });
  }

  try {
    const result = await setAdminUserActive(id, active);
    if (result === "not_found") return NextResponse.json({ error: "User not found." }, { status: 404 });
    if (result === "last_owner") return NextResponse.json({ error: "At least one active owner account must remain." }, { status: 409 });
    return NextResponse.json({ ok: true, active });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not update user." }, { status: 500 });
  }
}
