"use client";
import { useCallback, useEffect, useState } from "react";
import Clover from "./Clover";
import BlockManager from "./BlockManager";
import {
  BOOKING_START_DATE,
  CLOSE_HOUR,
  COURTS,
  END_HOURS,
  OPEN_HOUR,
  BOOKABLE_HOURS,
  courtName,
  hourLabel,
  peso,
} from "@/lib/config";
import type { Booking } from "@/lib/store";

const localToday = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const prettyDate = (date: string) => new Date(`${date}T00:00:00`).toLocaleDateString("en-PH", {
  month: "short", day: "numeric", year: "numeric",
});

export default function ReserveManager() {
  const [tab, setTab] = useState<"reserve" | "block">("reserve");
  const [date, setDate] = useState(BOOKING_START_DATE);
  const [court, setCourt] = useState(COURTS[0]?.id ?? 1);
  const [fromHour, setFromHour] = useState(OPEN_HOUR);
  const [toHour, setToHour] = useState(OPEN_HOUR + 1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [reservations, setReservations] = useState<Booking[]>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/reservations", { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not load reservations.");
      setReservations(json.reservations ?? []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load reservations.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, court, hour: fromHour, duration: toHour - fromHour, name, email, phone }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not reserve this time.");
      setName("");
      setEmail("");
      setPhone("");
      setNotice("Reservation created. This time is now unavailable to customers.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the reservation.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel(id: string) {
    if (!window.confirm("Cancel this reservation and reopen the time slot?")) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/reservations?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not cancel the reservation.");
      setNotice("Reservation canceled; the slot is available again.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel the reservation.");
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-5 pb-16">
      <header className="mt-6 flex items-center justify-between gap-3">
        <a href="/admin" className="flex items-center gap-2 font-display text-xl font-bold text-pine">
          <Clover className="h-7 w-7 text-court" /> Lucky Paddle Admin
        </a>
        <a href="/admin" className="rounded-full px-3 py-2 text-sm text-pine/70 hover:bg-white/60">Back to dashboard</a>
      </header>

      <section className="mt-8">
        <h1 className="font-display text-4xl font-bold">Reserve</h1>
        <p className="mt-1 text-pine/65">Reserve a court time or block a period for maintenance and other unavailable times.</p>
      </section>

      <div className="glass mt-6 inline-flex rounded-2xl p-1.5" role="tablist" aria-label="Reserve options">
        <button type="button" role="tab" aria-selected={tab === "reserve"} onClick={() => setTab("reserve")}
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${tab === "reserve" ? "bg-court text-white shadow" : "text-pine/65 hover:bg-white/70"}`}>
          Reserve a time
        </button>
        <button type="button" role="tab" aria-selected={tab === "block"} onClick={() => setTab("block")}
          className={`rounded-xl px-5 py-2.5 text-sm font-semibold transition ${tab === "block" ? "bg-court text-white shadow" : "text-pine/65 hover:bg-white/70"}`}>
          Block time
        </button>
      </div>

      {tab === "block" ? <div className="mt-5"><BlockManager embedded /></div> : <>
      {error && <p role="alert" className="mt-5 rounded-2xl bg-red-500/10 p-4 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-2xl bg-leaf/15 p-4 text-sm text-court">{notice}</p>}

      <form onSubmit={create} className="glass mt-6 rounded-3xl p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold">New reservation</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-pine/70">
            Date
            <input required type="date" min={BOOKING_START_DATE} value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-white bg-white px-3 py-2 text-base font-semibold text-pine" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-pine/70">
            Court
            <select value={court} onChange={(e) => setCourt(Number(e.target.value))} className="rounded-xl border border-white bg-white px-3 py-2 text-base font-semibold text-pine">
              {COURTS.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-pine/70">
            From
            <select value={fromHour} onChange={(e) => {
              const next = Number(e.target.value);
              setFromHour(next);
              if (toHour <= next) setToHour(Math.min(next + 1, CLOSE_HOUR));
            }} className="rounded-xl border border-white bg-white px-3 py-2 text-base font-semibold text-pine">
              {BOOKABLE_HOURS.map((hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-pine/70">
            To
            <select value={toHour} onChange={(e) => setToHour(Number(e.target.value))} className="rounded-xl border border-white bg-white px-3 py-2 text-base font-semibold text-pine">
              {END_HOURS.filter((hour) => hour > fromHour).map((hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-pine/70">
            Reservation name
            <input required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name or event" className="rounded-xl border border-white bg-white px-3 py-2 text-base text-pine" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-pine/70">
            Email (optional)
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl border border-white bg-white px-3 py-2 text-base text-pine" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-pine/70">
            Phone (optional)
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-xl border border-white bg-white px-3 py-2 text-base text-pine" />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-pine/60">{toHour - fromHour} hour{toHour - fromHour === 1 ? "" : "s"} · {courtName(court)}</span>
          <button disabled={busy || toHour <= fromHour} className="rounded-xl bg-court px-5 py-3 text-sm font-semibold text-white hover:bg-pine disabled:opacity-60">
            {busy ? "Saving…" : "Reserve this time"}
          </button>
        </div>
      </form>

      <section className="glass mt-6 rounded-3xl p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Active admin reservations</h2>
            <p className="text-sm text-pine/55">Cancel a reservation to release its time back to customers.</p>
          </div>
          <button onClick={() => void load()} className="rounded-full bg-white/70 px-3 py-2 text-xs font-semibold text-pine/70 hover:bg-white">Refresh</button>
        </div>
        {reservations.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-white/40 p-6 text-center text-sm text-pine/55">No active admin reservations.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {reservations.map((reservation) => (
              <li key={reservation.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/60 p-4">
                <div>
                  <div className="font-display font-semibold">{prettyDate(reservation.date)} · {hourLabel(reservation.hour)} – {hourLabel(reservation.hour + reservation.duration)}</div>
                  <div className="text-sm text-pine/70">{reservation.name} · {courtName(reservation.court)}</div>
                  <div className="text-xs text-pine/50">{reservation.email || reservation.phone || "Admin reservation"} · {peso(reservation.amount)}</div>
                </div>
                <button onClick={() => void cancel(reservation.id)} className="rounded-xl bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-500/20">Cancel reservation</button>
              </li>
            ))}
          </ul>
        )}
      </section>
      </>}
    </main>
  );
}
