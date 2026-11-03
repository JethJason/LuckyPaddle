import { createHmac, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

const COOKIE_NAME = "lp_admin";
const SESSION_SECONDS = 60 * 60 * 8;
const scrypt = promisify(nodeScrypt);

export type AdminRole = "owner" | "admin";
export type AdminIdentity = { id: string; username: string; displayName: string; role: AdminRole };
type AdminUserRow = { id: string; username: string; display_name: string; role: AdminRole; active: boolean; session_version: number };
type SessionClaims = AdminIdentity & { expiresAt: number; sessionVersion: number };

export const ADMIN_COOKIE = COOKIE_NAME;
export const ADMIN_SESSION_SECONDS = SESSION_SECONDS;

function signingSecret() {
  const secret = process.env.ADMIN_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") return "local-only-lucky-paddle-session-secret";
  throw new Error("Set ADMIN_SESSION_SECRET to a long random value.");
}

function signature(payload: string) {
  return createHmac("sha256", signingSecret()).update(`lucky-paddle-admin:${payload}`).digest();
}

export async function hashAdminPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyAdminPassword(password: string, stored: string) {
  const [algorithm, salt, hash] = stored.split("$");
  if (algorithm !== "scrypt" || !salt || !hash || !/^[a-f0-9]{128}$/i.test(hash)) return false;
  const derived = await scrypt(password, salt, 64) as Buffer;
  const expected = Buffer.from(hash, "hex");
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}

export function createSessionValue(admin: AdminIdentity, sessionVersion = 0) {
  const claims: SessionClaims = { ...admin, sessionVersion, expiresAt: Date.now() + SESSION_SECONDS * 1000 };
  const payload = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${payload}.${signature(payload).toString("base64url")}`;
}

function readSessionValue(value?: string): SessionClaims | null {
  if (!value) return null;
  const [payload, rawSignature] = value.split(".");
  if (!payload || !rawSignature) return null;
  try {
    const expected = signature(payload);
    const actual = Buffer.from(rawSignature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionClaims;
    if (!claims.id || !claims.username || !claims.displayName || !["owner", "admin"].includes(claims.role)) return null;
    if (!Number.isInteger(claims.sessionVersion) || claims.sessionVersion < 0) return null;
    if (!Number.isFinite(claims.expiresAt) || claims.expiresAt <= Date.now()) return null;
    return claims;
  } catch {
    return null;
  }
}

/** Resolve and re-check the account on every protected request so deactivation takes effect immediately. */
export async function getAdminSession(): Promise<AdminIdentity | null> {
  const claims = readSessionValue(cookies().get(COOKIE_NAME)?.value);
  if (!claims) return null;
  const { data, error } = await supabase
    .from("admin_users")
    .select("id,username,display_name,role,active,session_version")
    .eq("id", claims.id)
    .maybeSingle();
  if (error || !data || !(data as AdminUserRow).active) return null;
  const user = data as AdminUserRow;
  if (claims.sessionVersion !== user.session_version) return null;
  return { id: user.id, username: user.username, displayName: user.display_name, role: user.role };
}

export async function isAdmin() {
  return Boolean(await getAdminSession());
}

export function bootstrapCredentials() {
  const username = (process.env.ADMIN_BOOTSTRAP_USERNAME || "owner").trim().toLowerCase();
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD || process.env.ADMIN_PASSWORD ||
    (process.env.NODE_ENV !== "production" ? "luckypaddle" : "");
  return { username, password };
}

export function usesDevPassword() {
  return process.env.NODE_ENV !== "production" &&
    !process.env.ADMIN_BOOTSTRAP_PASSWORD && !process.env.ADMIN_PASSWORD;
}
