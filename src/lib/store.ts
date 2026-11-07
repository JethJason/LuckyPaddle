import { BOOKING_START_DATE, CLOSE_HOUR, COURTS, HOLD_MINUTES, OPEN_HOUR, PROOF_BUCKET } from "./config";
import { getPriceForRange } from "./pricing";
import { supabase } from "./supabase";

export type Status = "held" | "awaiting_review" | "approved" | "rejected" | "cancelled";
export type RateTier = { maxHours: number; price: number };
export type TimeRate = { start: number; end: number; price: number };
export type Inventory = { paddles: number; balls: number };

export type Block = {
  id: string;
  date: string;
  court: number;
  hour: number;
  duration: number;
  reason?: string;
  createdAt: number;
};

export interface Booking {
  id: string;
  date: string;
  court: number;
  hour: number;
  duration: number;
  amount: number;
  status: Status;
  expiresAt: number | null;
  createdAt: number;
  name?: string;
  email?: string;
  phone?: string;
  reference?: string;
  paddles?: number;
  balls?: number;
  proofPath?: string;
  proofUrl?: string;
  createdBy?: "customer" | "admin";
  reviewedBy?: string;
  reviewedAt?: number;
  reviewedById?: string;
  cancelledBy?: string;
  cancelledById?: string;
  cancelledAt?: number;
  cancellationReason?: string;
}

export const DEFAULT_TIME_RATES: TimeRate[] = [
  { start: 8, end: 12, price: 350 },
  { start: 12, end: 17, price: 500 },
  { start: 17, end: 25, price: 600 },
];

export const DEFAULT_RATES: RateTier[] = [{ maxHours: 24, price: 500 }];

/** Booking states that keep a slot reserved until review or cancellation. */
const SLOT_BLOCKING_STATUSES = ["held", "awaiting_review", "approved"] as const;

type BookingRow = {
  id: string;
  date: string;
  court: number;
  hour: number;
  duration: number | null;
  amount: number;
  status: Status;
  expires_at: string | null;
  created_at: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  reference: string | null;
  paddles: number | null;
  balls: number | null;
  proof_path: string | null;
  created_by: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  cancelled_by: string | null;
  cancelled_by_name: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
};

type BlockRow = {
  id: string;
  date: string;
  court: number;
  hour: number;
  duration: number;
  reason: string | null;
  created_at: string;
};

const rowToBooking = (row: BookingRow): Booking => ({
  id: row.id,
  date: row.date,
  court: row.court,
  hour: row.hour,
  duration: row.duration ?? 1,
  amount: row.amount,
  status: row.status,
  expiresAt: row.expires_at ? Date.parse(row.expires_at) : null,
  createdAt: Date.parse(row.created_at),
  name: row.name ?? undefined,
  email: row.email ?? undefined,
  phone: row.phone ?? undefined,
  reference: row.reference ?? undefined,
  paddles: row.paddles ?? 0,
  balls: row.balls ?? 0,
  proofPath: row.proof_path ?? undefined,
  createdBy: row.created_by === "admin" ? "admin" : "customer",
  reviewedById: row.reviewed_by ?? undefined,
  reviewedBy: row.reviewed_by_name ?? undefined,
  reviewedAt: row.reviewed_at ? Date.parse(row.reviewed_at) : undefined,
  cancelledById: row.cancelled_by ?? undefined,
  cancelledBy: row.cancelled_by_name ?? undefined,
  cancelledAt: row.cancelled_at ? Date.parse(row.cancelled_at) : undefined,
  cancellationReason: row.cancellation_reason ?? undefined,
});

const rowToBlock = (row: BlockRow): Block => ({
  id: row.id,
  date: row.date,
  court: row.court,
  hour: row.hour,
  duration: row.duration ?? 1,
  reason: row.reason ?? undefined,
  createdAt: Date.parse(row.created_at),
});

export const databaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

async function getSetting<T>(key: string, def: T): Promise<T> {
  if (!databaseConfigured()) return def;
  try {
    const { data, error } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
    if (error || data?.value == null) return def;
    return data.value as T;
  } catch {
    return def;
  }
}

async function setSetting<T>(key: string, value: T): Promise<void> {
  if (!databaseConfigured()) return;
  await supabase.from("app_settings").upsert(
    { key, value, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
}

export async function getTimeRates(): Promise<TimeRate[]> {
  const saved = await getSetting<TimeRate[]>("timeRates", DEFAULT_TIME_RATES);
  if (Array.isArray(saved) && saved.length > 0) return [...saved].sort((a, b) => a.start - b.start);
  return [...DEFAULT_TIME_RATES];
}

export async function setTimeRates(rates: TimeRate[]): Promise<TimeRate[]> {
  const sorted = [...rates].sort((a, b) => a.start - b.start);
  await setSetting("timeRates", sorted);
  return sorted;
}

export async function getRates(): Promise<RateTier[]> {
  const saved = await getSetting<RateTier[]>("rates", DEFAULT_RATES);
  if (Array.isArray(saved) && saved.length > 0) return [...saved].sort((a, b) => a.maxHours - b.maxHours);
  return [...DEFAULT_RATES];
}

export async function setRates(rates: RateTier[]): Promise<RateTier[]> {
  const sorted = [...rates].sort((a, b) => a.maxHours - b.maxHours);
  await setSetting("rates", sorted);
  return sorted;
}

/** Expired 10-minute holds are deleted, which frees their slot. */
async function sweep() {
  if (!databaseConfigured()) return;
  await supabase.from("bookings").delete().eq("status", "held").lt("expires_at", new Date().toISOString());
}

export async function dayStatus(date: string) {
  await sweep();
  const { data, error } = await supabase
    .from("bookings")
    .select("date,court,hour,duration,status").eq("date", date).in("status", SLOT_BLOCKING_STATUSES)
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;

  const rank = { held: 0, pending: 1, booked: 2 } as const;
  const out: Record<number, Record<number, "held" | "pending" | "booked">> = {};
  for (const row of data ?? []) {
    
    
    const cell = row.status === "approved" ? "booked" : row.status === "awaiting_review" ? "pending" : "held";
    for (let i = 0; i < (row.duration ?? 1); i++) {
      const h = row.hour + i;
      if (h >= CLOSE_HOUR) break;
      const court = (out[row.court] ??= {});
      if (!court[h] || rank[cell] > rank[court[h]]) court[h] = cell;
    }
  }
  return out;
}

export async function isBlocked(
  date: string,
  court: number,
  hour: number,
  duration = 1,
  ignoreBookingId?: string,
) {
  if (!databaseConfigured()) return false;
  const bookingQuery = supabase
    .from("bookings")
    .select("id,hour,duration,status,expires_at")
    .eq("date", date)
    .eq("court", court)
    .in("status", SLOT_BLOCKING_STATUSES);
  const [{ data: blocks, error: blocksError }, { data: bookings, error: bookingsError }] = await Promise.all([
    supabase.from("blocks").select("hour,duration").eq("date", date).eq("court", court),
    ignoreBookingId ? bookingQuery.neq("id", ignoreBookingId) : bookingQuery,
  ]);
  if (blocksError) throw blocksError;
  if (bookingsError) throw bookingsError;

  const overlaps = (row: { hour: number; duration: number | null }) =>
    hour < row.hour + (row.duration ?? 1) && hour + duration > row.hour;
  const now = Date.now();
  const activeBookingOverlaps = (bookings ?? []).some((booking) =>
    (booking.status !== "held" || booking.expires_at === null || Date.parse(booking.expires_at) > now) &&
    overlaps(booking),
  );
  return (blocks ?? []).some(overlaps) || activeBookingOverlaps;
}

export async function createHold(
  date: string,
  court: number,
  hour: number,
  duration = 1,
): Promise<Booking | null> {
  await sweep();
  if (await isBlocked(date, court, hour, duration)) return null;

  const rates = await getTimeRates();
  const amount = getPriceForRange(hour, hour + duration, rates);

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      date,
      court,
      hour,
      duration,
      amount,
      status: "held",
      expires_at: new Date(Date.now() + HOLD_MINUTES * 60_000).toISOString(),
    })
    .select()
    .single();

  if (error) {
    // 23P01 = exclusion violation (overlap), 23505 = unique violation.
    if (error.code === "23P01" || error.code === "23505") return null;
    throw error;
  }
  return rowToBooking(data as BookingRow);
}

/** Change the time range of an existing hold without dropping the customer's current slot. */
export async function updateHold(
  id: string,
  date: string,
  court: number,
  hour: number,
  duration: number,
): Promise<Booking | null> {
  await sweep();
  if (await isBlocked(date, court, hour, duration, id)) return null;

  const rates = await getTimeRates();
  const amount = getPriceForRange(hour, hour + duration, rates);
  const update = (clearProof: boolean) => supabase
    .from("bookings")
    .update(clearProof
      ? { date, court, hour, duration, amount, proof_path: null }
      : { date, court, hour, duration, amount })
    .eq("id", id)
    .eq("status", "held")
    .gt("expires_at", new Date().toISOString())
    .select()
    .maybeSingle();

  let result = await update(true);
  const missingProofColumn = result.error &&
    (result.error.code === "PGRST204" || result.error.code === "42703") &&
    result.error.message.includes("proof_path");
  if (missingProofColumn) result = await update(false);

  const { data, error } = result;
  if (error) throw error;
  return data ? rowToBooking(data as BookingRow) : null;
}

export async function getBooking(id: string) {
  if (!databaseConfigured()) return undefined;
  const { data, error } = await supabase.from("bookings").select("*").eq("id", id).maybeSingle();
  if (error) return undefined;
  return data ? rowToBooking(data as BookingRow) : undefined;
}

/** Attach an uploaded payment proof to a still-valid hold. */
export async function setProofPath(id: string, path: string) {
  const { data, error } = await supabase
    .from("bookings")
    .update({ proof_path: path })
    .eq("id", id)
    .eq("status", "held")
    .gt("expires_at", new Date().toISOString())
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? rowToBooking(data as BookingRow) : null;
}

async function withProofUrl(booking: Booking): Promise<Booking> {
  if (!booking.proofPath) return booking;
  const { data, error } = await supabase.storage
    .from(PROOF_BUCKET)
    .createSignedUrl(booking.proofPath, 60 * 60);
  return error ? booking : { ...booking, proofUrl: data.signedUrl };
}

/** All bookings, newest first. Used by the admin dashboard. */
export async function listBookings() {
  await sweep();
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  if (error) throw error;
  return Promise.all((data ?? []).map((row) => withProofUrl(rowToBooking(row as BookingRow))));
}

export async function releaseHold(id: string) {
  if (!databaseConfigured()) return;
  await supabase.from("bookings").delete().eq("id", id).eq("status", "held");
}

/** Customer says they paid: hold must still be valid. Moves to the admin's review queue. */
export async function submitPayment(
  id: string,
  info: {
    name: string;
    email: string;
    phone: string;
    reference: string;
    paddles?: number;
    balls?: number;
    amount?: number;
  },
) {
  const updates: Record<string, unknown> = {
    name: info.name,
    email: info.email,
    phone: info.phone,
    reference: info.reference,
    paddles: info.paddles ?? 0,
    balls: info.balls ?? 0,
    status: "awaiting_review",
    expires_at: null,
  };
  if (typeof info.amount === "number") updates.amount = info.amount;

  const { data, error } = await supabase
    .from("bookings")
    .update(updates)
    .eq("id", id)
    .eq("status", "held")
    .gt("expires_at", new Date().toISOString())
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? rowToBooking(data as BookingRow) : null;
}

/** Only bookings still awaiting review can be approved or rejected (rejecting frees the slot). */
export async function review(
  id: string,
  status: "approved" | "rejected",
  reviewer: { id: string; displayName: string },
) {
  const { data, error } = await supabase
    .from("bookings")
    .update({
      status,
      reviewed_by: reviewer.id,
      reviewed_by_name: reviewer.displayName,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "awaiting_review")
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? rowToBooking(data as BookingRow) : null;
}

/** Cancel an approved customer reservation, freeing its slot and preserving who approved it. */
export async function cancelApprovedBooking(
  id: string,
  cancellation: { adminId: string; adminName: string; reason?: string },
) {
  const { data, error } = await supabase
    .from("bookings")
    .update({
      status: "cancelled",
      cancelled_by: cancellation.adminId,
      cancelled_by_name: cancellation.adminName,
      cancelled_at: new Date().toISOString(),
      cancellation_reason: cancellation.reason?.trim().slice(0, 500) || null,
    })
    .eq("id", id)
    .eq("status", "approved")
    .eq("created_by", "customer")
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? rowToBooking(data as BookingRow) : null;
}

/** Permanently delete an approved customer booking from the database, freeing its slot. */
export async function deleteApprovedBooking(id: string) {
  const { data, error } = await supabase
    .from("bookings")
    .delete()
    .eq("id", id)
    .eq("status", "approved")
    .eq("created_by", "customer")
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? rowToBooking(data as BookingRow) : null;
}

/** Admin-created reservation. It is approved immediately and blocks the slot. */
export async function createReservation(info: {
  date: string;
  court: number;
  hour: number;
  duration: number;
  name: string;
  email?: string;
  phone?: string;
  note?: string;
}): Promise<Booking | null> {
  await sweep();
  if (await isBlocked(info.date, info.court, info.hour, info.duration)) return null;

  const rates = await getTimeRates();
  const amount = getPriceForRange(info.hour, info.hour + info.duration, rates);

  const { data, error } = await supabase
    .from("bookings")
    .insert({
      date: info.date,
      court: info.court,
      hour: info.hour,
      duration: info.duration,
      amount,
      status: "approved",
      expires_at: null,
      name: info.name,
      email: info.email || null,
      phone: info.phone || null,
      reference: info.note || null,
      created_by: "admin",
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23P01" || error.code === "23505") return null;
    throw error;
  }
  return rowToBooking(data as BookingRow);
}

/** Cancel an admin reservation, freeing the slot. */
export async function cancelReservation(id: string) {
  const { data, error } = await supabase
    .from("bookings")
    .update({ status: "rejected" })
    .eq("id", id)
    .eq("created_by", "admin")
    .eq("status", "approved")
    .select()
    .maybeSingle();
  if (error) throw error;
  return data ? rowToBooking(data as BookingRow) : null;
}

export async function listBlocks() {
  if (!databaseConfigured()) return [];
  const { data, error } = await supabase
    .from("blocks")
    .select("*")
    .order("date", { ascending: true })
    .order("hour", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => rowToBlock(row as BlockRow));
}

export async function addBlock(
  date: string,
  court: number,
  hour: number,
  duration = 1,
  reason?: string,
): Promise<Block | null> {
  await sweep();
  const { data: active } = await supabase
    .from("bookings")
    .select("hour,duration")
    .eq("date", date)
    .eq("court", court)
    .in("status", SLOT_BLOCKING_STATUSES);
  if ((active ?? []).some((b) => hour < b.hour + (b.duration ?? 1) && hour + duration > b.hour)) return null;

  const { data, error } = await supabase
    .from("blocks")
    .insert({ date, court, hour, duration, reason })
    .select()
    .single();
  if (error) {
    if (error.code === "23P01" || error.code === "23505") return null;
    throw error;
  }
  return rowToBlock(data as BlockRow);
}

export async function removeBlock(id: string) {
  const { error } = await supabase.from("blocks").delete().eq("id", id);
  return !error;
}

export async function getInventory(): Promise<Inventory> {
  if (!databaseConfigured()) return { paddles: 4, balls: 10 };
  const { data } = await supabase.from("inventory").select("paddles,balls").eq("id", 1).maybeSingle();
  return data ?? { paddles: 4, balls: 10 };
}

export async function setInventory(next: Partial<Inventory>): Promise<Inventory> {
  const current = await getInventory();
  const merged: Inventory = {
    paddles:
      typeof next.paddles === "number" && next.paddles >= 0 ? Math.floor(next.paddles) : current.paddles,
    balls: typeof next.balls === "number" && next.balls >= 0 ? Math.floor(next.balls) : current.balls,
  };
  const { data } = await supabase
    .from("inventory")
    .update({ ...merged, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .select("paddles,balls")
    .maybeSingle();
  return data ?? merged;
}

export const isValidSlot = (date: string, court: number, hour: number) =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) &&
  date >= BOOKING_START_DATE &&
  COURTS.some((c) => c.id === court) &&
  hour >= OPEN_HOUR &&
  hour < CLOSE_HOUR;
