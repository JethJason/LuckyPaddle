"use client";
import { useCallback, useEffect, useState } from "react";
import Clover from "@/components/Clover";
import {
  BALLS_PRICE,
  BOOKABLE_HOURS,
  BOOKING_START_DATE,
  BOOKING_WINDOW_DAYS,
  CLOSE_HOUR,
  COURTS,
  END_HOURS,
  HOLD_MINUTES,
  MAX_PADDLES,
  MULTI_HOUR_DISCOUNT,
  MULTI_HOUR_MIN,
  OPEN_HOUR,
  PADDLE_RENT,
  QR_IMAGE,
  courtName,
  hourLabel,
  peso,
} from "@/lib/config";
import { getPriceBreakdown, getRateForHour } from "@/lib/pricing";

type Cell = "held" | "pending" | "booked";
type Status = Record<number, Record<number, Cell>>;
type TimeRate = { start: number; end: number; price: number };
interface Hold {
  id: string;
  expiresAt: number;
  date: string;
  court: number;
  hour: number;
  duration: number;
  amount: number;
}

const HOURS = BOOKABLE_HOURS;
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const openingDay = startOfDay(new Date(`${BOOKING_START_DATE}T00:00:00`));
const firstBookableDay = startOfDay(new Date()) > openingDay ? startOfDay(new Date()) : openingDay;
const DAYS = Array.from({ length: BOOKING_WINDOW_DAYS }, (_, i) => {
  const d = new Date(firstBookableDay);
  d.setDate(d.getDate() + i);
  return d;
});
const openingLabel = openingDay.toLocaleDateString("en-PH", { month: "long", day: "numeric", year: "numeric" });
const HIGHLIGHTS = ["bg-blue-50/80", "bg-yellow-50/80", "bg-red-50/80", "bg-emerald-50/80", "bg-purple-50/80"];
const DOTS = ["bg-blue-400", "bg-yellow-400", "bg-red-400", "bg-emerald-400", "bg-purple-400"];

export default function Booking() {
  const [date, setDate] = useState(iso(DAYS[0]));
  const [court, setCourt] = useState(1);
  const [status, setStatus] = useState<Status>({});
  const [now, setNow] = useState({ date: "", hour: 0 });
  const [timeRates, setTimeRates] = useState<TimeRate[]>([]);
  const [hold, setHold] = useState<Hold | null>(null);
  const [left, setLeft] = useState(0);
  const [form, setForm] = useState({ name: "", email: "", phone: "", reference: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fromHour, setFromHour] = useState(OPEN_HOUR);
  const [toHour, setToHour] = useState(OPEN_HOUR + 1);
  const [addPaddles, setAddPaddles] = useState(0);
  const [addBalls, setAddBalls] = useState(0);
  const [maxPaddles, setMaxPaddles] = useState(MAX_PADDLES);
  const [maxBalls, setMaxBalls] = useState(10);
  const [proof, setProof] = useState<File | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/availability?date=${date}`, { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(j.error ?? "Could not load availability.");
      return;
    }
    setStatus(j.status ?? {});
    setNow(j.now ?? { date: "", hour: 0 });
    if (Array.isArray(j.timeRates)) setTimeRates(j.timeRates);
    if (typeof j.maxPaddles === "number") setMaxPaddles(Math.min(MAX_PADDLES, j.maxPaddles));
    if (typeof j.maxBalls === "number") setMaxBalls(j.maxBalls);
    setError("");
  }, [date]);

  useEffect(() => { load(); const t = setInterval(load, 10_000); return () => clearInterval(t); }, [load]);

  useEffect(() => {
    if (!hold) return;
    const tick = () => {
      const s = Math.max(0, Math.round((hold.expiresAt - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) { setHold(null); setError("Your 10-minute hold ended. Pick a time again."); load(); }
    };
    tick(); const t = setInterval(tick, 1000); return () => clearInterval(t);
  }, [hold, load]);

  useEffect(() => {
    const free = () => hold && navigator.sendBeacon(`/api/hold?id=${hold.id}&_method=DELETE`);
    window.addEventListener("pagehide", free); return () => window.removeEventListener("pagehide", free);
  }, [hold]);

  useEffect(() => { setProof(null); }, [hold]);
  useEffect(() => { setAddPaddles((n) => Math.min(n, maxPaddles)); }, [maxPaddles]);
  useEffect(() => { setAddBalls((n) => Math.min(n, maxBalls)); }, [maxBalls]);

  const past = (h: number) => date < BOOKING_START_DATE || date < now.date || (date === now.date && h <= now.hour);

  const rateIndexForHour = (h: number) => timeRates.findIndex((r) => h >= r.start && h < r.end);

  function changeFrom(h: number) {
    setFromHour(h);
    if (toHour <= h) setToHour(Math.min(h + 1, CLOSE_HOUR));
  }
  function changeTo(h: number) {
    setToHour(h);
    if (fromHour >= h) setFromHour(Math.max(OPEN_HOUR, h - 1));
  }

  async function bookRange() {
    setError("");
    if (toHour <= fromHour) { setError("End time must be after the start time."); return; }
    if (past(fromHour)) { setError("That start time has already passed. Pick a later time."); return; }
    const r = await fetch("/api/hold", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, court, hour: fromHour, holdId: hold?.id, duration: toHour - fromHour }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 410) setHold(null);
      setError(j.error ?? "Could not update your held time.");
      load();
      return;
    }
    setHold({ id: j.id, expiresAt: j.expiresAt, date, court, hour: fromHour, duration: toHour - fromHour, amount: j.amount });
    setError("");
    load();
  }

  async function release() {
    if (hold) await fetch(`/api/hold?id=${hold.id}`, { method: "DELETE" });
    setHold(null); load();
  }

  async function submit() {
    if (!hold) return;
    if (!proof) { setError("Upload a photo of your payment receipt before submitting."); return; }
    setBusy(true); setError("");
    try {
      const upload = new FormData();
      upload.append("holdId", hold.id);
      upload.append("file", proof);
      const up = await fetch("/api/proof", { method: "POST", body: upload });
      const upJson = await up.json().catch(() => ({}));
      if (!up.ok) {
        setBusy(false);
        setError(upJson.error ?? "Could not upload the receipt.");
        if (up.status === 410) setHold(null);
        return;
      }

      const r = await fetch("/api/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdId: hold.id, ...form, paddles: addPaddles, balls: addBalls }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setBusy(false);
        setError(j.error ?? "Could not submit the booking.");
        if (r.status === 410) setHold(null);
        return;
      }
      window.location.href = `/success?id=${hold.id}`;
    } catch {
      setBusy(false);
      setError("Could not upload the receipt. Check your connection and try again.");
    }
  }

  const inHold = (h: number) => !!hold && hold.date === date && hold.court === court && h >= hold.hour && h < hold.hour + hold.duration;
  const mm = String(Math.floor(left / 60)).padStart(2, "0"), ss = String(left % 60).padStart(2, "0");
  const duration = toHour - fromHour;
  const selectionMatchesHold = !!hold && hold.date === date && hold.court === court && hold.hour === fromHour && hold.duration === duration;
  const breakdown = getPriceBreakdown(fromHour, toHour, timeRates);
  const holdBreakdown = hold ? getPriceBreakdown(hold.hour, hold.hour + hold.duration, timeRates) : null;
  const extras = addPaddles * PADDLE_RENT + addBalls * BALLS_PRICE;
  const total = (hold?.amount ?? 0) + extras;
  const getHighlight = (h: number) => {
    const i = rateIndexForHour(h);
    return i >= 0 ? HIGHLIGHTS[i % HIGHLIGHTS.length] : "";
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="glass rounded-3xl p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" value={date} min={iso(DAYS[0])} max={iso(DAYS[DAYS.length - 1])} onChange={(e) => setDate(e.target.value)}
            className="rounded-2xl border border-white/80 bg-white/70 px-4 py-2 text-sm font-medium text-pine shadow-sm" />
          {now.date && now.date < BOOKING_START_DATE && (
            <span className="rounded-full bg-ball/50 px-3 py-1 text-xs font-semibold text-pine">
              Bookings open {openingLabel}
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {COURTS.length > 1 ? (
            COURTS.map((c) => (
              <button key={c.id} onClick={() => setCourt(c.id)} aria-pressed={court === c.id}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${court === c.id ? "bg-court text-white" : "bg-white/60 hover:bg-white"}`}>
                {c.name}
              </button>
            ))
          ) : (
            <>
              <span className="flex items-center gap-2 rounded-full bg-court px-4 py-2 text-sm font-medium text-white shadow-[0_0_0_4px_rgba(59,130,246,0.15)]">
                <Clover className="h-4 w-4" />
                {COURTS[0].name}
              </span>
              <span className="text-sm text-pine/60">Available 8:00 AM - 1:00 AM</span>
            </>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3 rounded-2xl border border-white/70 bg-gradient-to-r from-blue-50/80 via-white/70 to-red-50/80 p-3 shadow-[0_10px_60px_-30px_rgba(37,99,235,0.9)]">
          <label className="flex flex-col gap-1 text-xs font-medium text-pine/70">
            From
            <select value={fromHour} onChange={(e) => changeFrom(Number(e.target.value))}
              className="rounded-xl border border-white bg-white px-3 py-2 text-base font-semibold text-pine outline-none focus:ring-2 focus:ring-court">
              {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-pine/70">
            To
            <select value={toHour} onChange={(e) => changeTo(Number(e.target.value))}
              className="rounded-xl border border-white bg-white px-3 py-2 text-base font-semibold text-pine outline-none focus:ring-2 focus:ring-court">
              {END_HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </label>
          <button onClick={bookRange} disabled={toHour <= fromHour || selectionMatchesHold}
            className="rounded-xl bg-court px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pine disabled:cursor-not-allowed disabled:opacity-50">
            {selectionMatchesHold ? "Time already held" : hold ? "Update held time" : `Hold ${hourLabel(fromHour)} - ${hourLabel(toHour)}`}
          </button>
          <span className="pb-1 text-xs text-pine/60">
            {duration} hour{duration > 1 ? "s" : ""} ·{" "}
            {breakdown.discount > 0 ? (
              <>
                <span className="text-pine/40 line-through">{peso(breakdown.base)}</span>{" "}
                <b className="text-court">{peso(breakdown.total)}</b>
              </>
            ) : (
              peso(breakdown.total)
            )}
          </span>
        </div>
        {hold && (
          <p className="mt-2 rounded-xl bg-court/5 px-3 py-2 text-xs leading-relaxed text-pine/70">
            Want to change your time? Adjust the date or start/end above, then choose <b>Update held time</b>.
            Your current slot stays reserved unless the new time is successfully held.
          </p>
        )}
        {breakdown.discount > 0 && (
          <div className="mt-2 rounded-2xl bg-leaf/15 px-4 py-2 text-xs font-medium text-court">
            Multi-hour discount applied: {peso(MULTI_HOUR_DISCOUNT)} off each hour, {peso(breakdown.discount)} total.
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {HOURS.map((h) => {
            const s = status[court]?.[h];
            const disabled = past(h) || (!!s && !inHold(h));
            const sel = inHold(h);
            const hl = getHighlight(h);
            return (
              <button key={h} disabled={disabled} onClick={() => changeFrom(h)}
                className={`rounded-2xl border px-3 py-3 text-left transition
                  ${sel ? "border-ball bg-ball text-pine shadow-lg ring-2 ring-pine"
                    : disabled ? "cursor-not-allowed border-transparent bg-white/25 text-pine/40"
                    : `border-white/70 ${hl || "bg-white/70"} hover:-translate-y-0.5 hover:bg-white`}`}>
                <div className="font-display font-semibold">{hourLabel(h)}</div>
                <div className="text-[11px] text-pine/45">to {hourLabel(h + 1)}</div>
                <div className="text-xs">
                  {sel ? "Selected" : past(h) ? "Passed" : s === "booked" ? "Booked" : s === "pending" ? "Pending approval" : s === "held" ? "On hold" : peso(getRateForHour(h, timeRates))}
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-pine/70">
          {timeRates.map((rate, i) => (
            <span key={`${rate.start}-${rate.end}`} className="flex items-center gap-1">
              <span className={`h-2 w-2 rounded-full ${DOTS[i % DOTS.length]}`}></span>
              {hourLabel(rate.start)}-{hourLabel(rate.end)} {peso(rate.price)}
            </span>
          ))}
        </div>
        <div className="mt-4 rounded-2xl border border-white/70 bg-white/55 p-4 text-xs leading-relaxed text-pine/70">
          <b className="text-pine">Party setup?</b> If you plan to have a party setup, we strongly recommend booking an extra
          hour before your slot for setup and an extra hour after for cleanup. Please note that bringing in alcoholic
          drinks incurs a corkage fee of ₱100 per bottle, while large food setups, food trays, mobile carts, or large
          items such as lechon are subject to a flat corkage fee of ₱1,500.
        </div>
      </div>

      <aside className="glass-dark h-fit rounded-3xl p-6 text-white lg:sticky lg:top-24">
        <h3 className="flex items-center gap-2 font-display text-2xl font-semibold">
          <Clover className="h-6 w-6 text-ball" />
          Your lucky booking
        </h3>
        {!hold ? (
          <p className="mt-3 text-white/75">Available 8:00 AM - 1:00 AM. Choose a start and end time, then hold it for {HOLD_MINUTES} minutes while you pay by QR.</p>
        ) : (
          <div className="mt-4 space-y-4">
            <div className="rounded-2xl bg-white/10 p-4">
              <div className="text-sm text-white/70">{courtName(hold.court)} · {hold.date}</div>
              <div className="font-display text-xl">{hourLabel(hold.hour)} - {hourLabel(hold.hour + hold.duration)}</div>
              <div className="text-xs text-white/60">{hold.duration} hour{hold.duration > 1 ? "s" : ""} · {peso(hold.amount)}</div>
              {holdBreakdown && holdBreakdown.discount > 0 && (
                <div className="text-xs text-ball">
                  {peso(holdBreakdown.discount)} multi-hour discount included
                </div>
              )}
              <div className="mt-2 flex items-center justify-between text-sm">
                <span>Held for you</span>
                <span className="rounded-full bg-ball px-3 py-1 font-semibold tabular-nums text-pine" role="timer">{mm}:{ss}</span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/15 bg-white/5 p-4">
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>Add-ons</span>
                <span className="text-xs text-white/60">Optional</span>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <div className="text-sm">Rent a paddle</div>
                  <div className="text-xs text-white/60">{peso(PADDLE_RENT)} · max {maxPaddles}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setAddPaddles(Math.max(0, addPaddles - 1))} className="rounded-full bg-white/10 px-2 py-1 text-xs">-</button>
                  <span className="w-6 text-center text-sm">{addPaddles}</span>
                  <button onClick={() => setAddPaddles(Math.min(maxPaddles, addPaddles + 1))} disabled={addPaddles >= maxPaddles}
                    className="rounded-full bg-white/10 px-2 py-1 text-xs disabled:opacity-40">+</button>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div>
                  <div className="text-sm">Buy balls</div>
                  <div className="text-xs text-white/60">{peso(BALLS_PRICE)} · max {maxBalls}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setAddBalls(Math.max(0, addBalls - 1))} className="rounded-full bg-white/10 px-2 py-1 text-xs">-</button>
                  <span className="w-6 text-center text-sm">{addBalls}</span>
                  <button onClick={() => setAddBalls(Math.min(maxBalls, addBalls + 1))} disabled={addBalls >= maxBalls}
                    className="rounded-full bg-white/10 px-2 py-1 text-xs disabled:opacity-40">+</button>
                </div>
              </div>
              {extras > 0 && <div className="mt-3 text-xs text-white/70">Extras: {peso(extras)}</div>}
            </div>

            <div className="rounded-2xl bg-white p-4 text-center text-pine">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={QR_IMAGE} alt="Payment QR code" className="mx-auto h-44 w-44 object-contain" />
              <div className="mt-2 text-sm">
                Scan with GCash or Maya and pay exactly <b>{peso(total)}</b>
              </div>
            </div>

            {(["name", "email", "phone", "reference"] as const).map((k) => (
              <input key={k} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                type={k === "email" ? "email" : k === "phone" ? "tel" : "text"}
                placeholder={k === "name" ? "Full name" : k === "email" ? "Email for your confirmation" : k === "phone" ? "Mobile number" : "Payment reference no."}
                aria-label={k}
                className="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-white placeholder:text-white/50" />
            ))}
            <div className="rounded-2xl border border-dashed border-white/30 bg-white/5 p-4">
              <label className="block text-sm font-semibold text-white/85">
                Upload payment receipt
                <span className="mt-1 block text-xs font-normal text-white/50">JPG, PNG or WebP · max 4 MB</span>
              </label>
              <input type="file" accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setProof(e.target.files?.[0] ?? null)}
                className="mt-3 w-full text-xs text-white/70 file:mr-3 file:rounded-full file:border-0 file:bg-ball file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-pine" />
              {proof && <p className="mt-2 truncate text-xs text-ball">{proof.name}</p>}
            </div>
            <button onClick={submit} disabled={busy}
              className="w-full rounded-xl bg-ball py-3.5 font-display text-lg font-semibold text-pine transition hover:brightness-105 disabled:opacity-60">
              {busy ? "Submitting." : `I've paid ${peso(total)}. Submit for approval`}
            </button>
            <p className="text-xs text-white/60">Upload a photo of your receipt and enter the reference number. We email your confirmation once an admin approves it.</p>
            <button onClick={release} className="w-full text-sm text-white/70 underline">Release this slot</button>
          </div>
        )}
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-500/20 p-3 text-sm text-red-100">{error}</p>}
      </aside>
    </div>
  );
}
