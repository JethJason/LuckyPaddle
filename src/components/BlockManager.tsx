"use client";
import { useCallback, useEffect, useState } from "react";
import Clover from "./Clover";
import { CLOSE_HOUR, OPEN_HOUR, hourLabel } from "@/lib/config";
import type { Block } from "@/lib/store";

export default function BlockManager() {
  const [date, setDate] = useState("");
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [fromHour, setFromHour] = useState(OPEN_HOUR);
  const [toHour, setToHour] = useState(OPEN_HOUR + 2);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const HOURS = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i);
  const END_HOURS = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + 1 + i);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/block", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load blocks.");
      setBlocks(json.blocks || []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load blocks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const d = new Date();
    setDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }, [load]);

  async function addBlock(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setNotice("");
    if (!date) { setError("Pick a date."); return; }
    if (toHour <= fromHour) { setError("End time must be after start."); return; }
    const res = await fetch("/api/admin/block", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, court: 1, hour: fromHour, duration: toHour - fromHour, reason }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Could not block time."); return; }
    setBlocks(json.blocks || []);
    setReason("");
    setNotice("Blocked time added.");
  }

  async function remove(id: string) {
    setError(""); setNotice("");
    const res = await fetch(`/api/admin/block?id=${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Could not remove block."); return; }
    setBlocks(json.blocks || []);
    setNotice("Block removed.");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <a href="/admin" className="flex items-center gap-2 font-display text-xl font-bold text-pine">
          <Clover className="h-7 w-7 text-court" />
          Lucky Paddle Admin
        </a>
        <a href="/admin" className="rounded-full px-3 py-2 text-sm text-pine/70 transition hover:bg-white/60 hover:text-pine">
          Back to dashboard
        </a>
      </header>

      <section className="mt-8">
        <h1 className="font-display text-3xl font-bold">Block time</h1>
        <p className="mt-1 text-pine/65">Prevent bookings for maintenance or private events.</p>
      </section>

      {error && <p role="alert" className="mt-5 rounded-2xl bg-red-500/10 p-4 text-sm text-red-700">{error}</p>}
      {notice && <p className="mt-5 rounded-2xl bg-leaf/15 p-4 text-sm text-court">{notice}</p>}

      <form onSubmit={addBlock} className="glass mt-6 rounded-3xl p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold">Add a block</h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-pine/70">
            Date
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="rounded-xl border border-white bg-white px-3 py-2 text-base font-semibold text-pine" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-pine/70">
            From
            <select value={fromHour} onChange={(e) => { const h = Number(e.target.value); setFromHour(h); if (toHour <= h) setToHour(Math.min(h + 1, CLOSE_HOUR)); }} className="rounded-xl border border-white bg-white px-3 py-2 text-base font-semibold text-pine">
              {HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-pine/70">
            To
            <select value={toHour} onChange={(e) => setToHour(Number(e.target.value))} className="rounded-xl border border-white bg-white px-3 py-2 text-base font-semibold text-pine">
              {END_HOURS.map((h) => <option key={h} value={h}>{hourLabel(h)}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-pine/70">
            Reason
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Maintenance" className="w-48 rounded-xl border border-white bg-white px-3 py-2 text-base text-pine" />
          </label>
          <button className="rounded-xl bg-court px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pine">Block time</button>
        </div>
      </form>

      <div className="glass mt-5 rounded-3xl p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold">Current blocks</h2>
        {loading ? (
          <p className="mt-3 text-sm text-pine/60">Loading...</p>
        ) : blocks.length === 0 ? (
          <p className="mt-3 text-sm text-pine/60">No blocks yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {blocks.map((b) => (
              <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/60 p-3">
                <div>
                  <div className="font-display font-semibold">{b.date} · {hourLabel(b.hour)} – {hourLabel(b.hour + b.duration)}</div>
                  <div className="text-sm text-pine/60">{b.duration} hour{b.duration > 1 ? "s" : ""} {b.reason ? `· ${b.reason}` : ""}</div>
                </div>
                <button onClick={() => remove(b.id)} className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-500/20">Remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
