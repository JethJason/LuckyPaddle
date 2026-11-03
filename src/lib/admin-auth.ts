import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "lp_admin";
const SESSION_SECONDS = 60 * 60 * 8;
const DEV_PASSWORD = "luckypaddle";

export const ADMIN_COOKIE = COOKIE_NAME;
export const ADMIN_SESSION_SECONDS = SESSION_SECONDS;

export function adminPassword() {
  return process.env.ADMIN_PASSWORD || (process.env.NODE_ENV !== "production" ? DEV_PASSWORD : "");
}

export function usesDevPassword() {
  return !process.env.ADMIN_PASSWORD && process.env.NODE_ENV !== "production";
}

function signingSecret() {
  return process.env.ADMIN_SESSION_SECRET || adminPassword() || "lucky-paddle";
}

function sign(expiresAt: number) {
  return createHmac("sha256", signingSecret()).update(`lucky-paddle-admin:${expiresAt}`).digest("hex");
}

export function createSessionValue() {
  const expiresAt = Date.now() + SESSION_SECONDS * 1000;
  return `${expiresAt}.${sign(expiresAt)}`;
}

export function verifySessionValue(value?: string) {
  if (!value) return false;
  const [rawExpiry, signature] = value.split(".");
  const expiresAt = Number(rawExpiry);
  if (!signature || !Number.isFinite(expiresAt) || expiresAt < Date.now()) return false;

  const expected = Buffer.from(sign(expiresAt), "hex");
  const actual = Buffer.from(signature, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function isAdmin() {
  return verifySessionValue(cookies().get(COOKIE_NAME)?.value);
}

export function checkPassword(input: string) {
  const expected = adminPassword();
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
