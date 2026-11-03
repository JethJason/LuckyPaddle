import { NextResponse } from "next/server";
import { ADMIN_COOKIE, ADMIN_SESSION_SECONDS, createSessionValue, verifyAdminPassword } from "@/lib/admin-auth";
import { findAdminByUsername, ensureBootstrapAdmin } from "@/lib/admin-users";
import { databaseConfigured } from "@/lib/store";

const WINDOW_MS = 15 * 60_000;
const MAX_ATTEMPTS = 6;
const attempts = new Map<string, { count: number; resetAt: number; blockedUntil: number }>();
const DUMMY_HASH = `scrypt$deadbeef$${"0".repeat(128)}`;

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const username = typeof body?.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!databaseConfigured()) {
    return NextResponse.json({ error: "Admin accounts require the Supabase database to be configured." }, { status: 503 });
  }
  if (!/^[a-z0-9._-]{3,32}$/.test(username) || !password) {
    return NextResponse.json({ error: "Enter your username and password." }, { status: 400 });
  }

  const forwardedIp = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = req.headers.get("x-real-ip") ?? forwardedIp ?? "unknown";
  const key = `${ip}:${username}`;
  const now = Date.now();
  const attempt = attempts.get(key);
  if (attempt?.blockedUntil && attempt.blockedUntil > now) {
    return NextResponse.json({ error: "Too many sign-in attempts. Try again in 15 minutes." }, { status: 429 });
  }
  if (!attempt || attempt.resetAt <= now) attempts.set(key, { count: 0, resetAt: now + WINDOW_MS, blockedUntil: 0 });

  try {
    await ensureBootstrapAdmin();
    const user = await findAdminByUsername(username);
    const passwordMatches = await verifyAdminPassword(password, user?.password_hash ?? DUMMY_HASH);
    if (!user || !user.active || !passwordMatches) {
      const state = attempts.get(key) ?? { count: 0, resetAt: now + WINDOW_MS, blockedUntil: 0 };
      state.count += 1;
      if (state.count >= MAX_ATTEMPTS) state.blockedUntil = now + WINDOW_MS;
      attempts.set(key, state);
      return NextResponse.json({ error: "Invalid username or password." }, { status: 401 });
    }

    attempts.delete(key);
    const identity = {
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role as "owner" | "admin",
    };
    const res = NextResponse.json({ ok: true, admin: { displayName: identity.displayName, role: identity.role } });
    res.cookies.set(ADMIN_COOKIE, createSessionValue(identity, user.session_version ?? 0), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: ADMIN_SESSION_SECONDS,
    });
    return res;
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not sign in." },
      { status: 500 },
    );
  }
}
