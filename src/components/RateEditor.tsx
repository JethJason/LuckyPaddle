"use client";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Clover from "./Clover";
import { hourLabel, peso } from "@/lib/config";
import type { RateTier, TimeRate } from "@/lib/store";

export default function RateEditor() {
  const [rates, setRates] = useState<RateTier[]>([]);
  const [timeRates, setTimeRates] = useState<TimeRate[]>([]);
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [timeDraft, setTimeDraft] = useState<Record<number, { start: string; end: string; price: string }>>({});
  const [maxHours, setMaxHours] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/rate", { cache: "no-store" });
      if (res.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load rates.");
      setRates(json.rates || []);
      setTimeRates(json.timeRates || []);
      setDraft(Object.fromEntries((json.rates || []).map((t: RateTier) => [t.maxHours, String(t.price)])));
      setTimeDraft(
        Object.fromEntries(
          (json.timeRates || []).map((t: TimeRate, idx: number) => [
            idx,
            { start: String(t.start), end: String(t.end), price: String(t.price) },
          ])
        )
      );
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load rates.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save(maxHours: number, nextPrice: number) {
    setError(""); setNotice("");
    const res = await fetch("/api/admin/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxHours, price: nextPrice }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Could not save rate."); return; }
    setRates(json.rates || []);
    setTimeRates(json.timeRates || []);
    setDraft(Object.fromEntries((json.rates || []).map((t: RateTier) => [t.maxHours, String(t.price)])));
    setTimeDraft(
      Object.fromEntries(
        (json.timeRates || []).map((t: TimeRate, idx: number) => [
          idx,
          { start: String(t.start), end: String(t.end), price: String(t.price) },
        ])
      )
    );
    setNotice(`Saved ${maxHours} hour${maxHours > 1 ? "s" : ""} tier.`);
  }

  async function remove(maxHours: number) {
    setError(""); setNotice("");
    const res = await fetch(`/api/admin/rate?maxHours=${maxHours}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Could not remove rate."); return; }
    setRates(json.rates || []);
    setTimeRates(json.timeRates || []);
    setDraft(Object.fromEntries((json.rates || []).map((t: RateTier) => [t.maxHours, String(t.price)])));
    setTimeDraft(
      Object.fromEntries(
        (json.timeRates || []).map((t: TimeRate, idx: number) => [
          idx,
          { start: String(t.start), end: String(t.end), price: String(t.price) },
        ])
      )
    );
    setNotice(`${maxHours} hour tier removed.`);
  }

  async function saveTimeRates() {
    setError(""); setNotice("");
    const payload = timeRates.map((t, idx) => {
      const d = timeDraft[idx] || { start: String(t.start), end: String(t.end), price: String(t.price) };
      return { start: Number(d.start), end: Number(d.end), price: Number(d.price) };
    });
    const res = await fetch("/api/admin/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeRates: payload }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Could not save time rates."); return; }
    setTimeRates(json.timeRates || []);
    setTimeDraft(
      Object.fromEntries(
        (json.timeRates || []).map((t: TimeRate, idx: number) => [
          idx,
          { start: String(t.start), end: String(t.end), price: String(t.price) },
        ])
      )
    );
    setNotice("Saved time-based rates.");
  }

  async function addTier(e: FormEvent) {
    e.preventDefault();
    const h = Number(maxHours), p = Number(price);
    if (!Number.isFinite(h) || h < 1 || !Number.isFinite(p) || p < 0) {
      setError("Enter a valid number of hours and price.");
      return;
    }
    await save(h, p);
    setMaxHours(""); setPrice("");
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
        <h1 className="font-display text-3xl font-bold">Court rates</h1>
        <p className="mt-1 text-pine/65">
          {timeRates.length > 0
            ? timeRates.map((t) => `${hourLabel(t.start)} - ${hourLabel(t.end)} ${peso(t.price)}`).join(" · ")
            : "Set prices by hour range. These rates are used when players book."}
        </p>
      </section>

      {error && <p role="alert" className="mt-5 rounded-2xl bg-red-500/10 p-4 text-sm text-red-700">{error}</p>}
      {notice && <p className="mt-5 rounded-2xl bg-leaf/15 p-4 text-sm text-court">{notice}</p>}

      <div className="glass mt-6 rounded-3xl p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold">Time-based rates</h2>
        <p className="mt-1 text-sm text-pine/65">Prices by hour range (24h clock). Book 3 or more hours for ₱50 off each eligible hour after 12:00 PM; the 8:00 AM–12:00 PM rate is excluded.</p>
        {loading ? (
          <p className="mt-3 text-sm text-pine/60">Loading rates...</p>
        ) : (
          <div className="mt-4 space-y-3">
            {timeRates.map((t, idx) => (
              <div key={idx} className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/70 bg-white/60 p-3">
                <label className="flex flex-col gap-1 text-xs font-medium text-pine/70">
                  Start hour
                  <input
                    type="number"
                    min={0}
                    max={24}
                    value={timeDraft[idx]?.start ?? String(t.start)}
                    onChange={(e) => setTimeDraft({ ...timeDraft, [idx]: { ...(timeDraft[idx] || { start: String(t.start), end: String(t.end), price: String(t.price) }), start: e.target.value } })}
                    className="w-24 rounded-xl border border-white bg-white px-3 py-2 text-base font-semibold text-pine outline-none focus:ring-2 focus:ring-court"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-pine/70">
                  End hour
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={timeDraft[idx]?.end ?? String(t.end)}
                    onChange={(e) => setTimeDraft({ ...timeDraft, [idx]: { ...(timeDraft[idx] || { start: String(t.start), end: String(t.end), price: String(t.price) }), end: e.target.value } })}
                    className="w-24 rounded-xl border border-white bg-white px-3 py-2 text-base font-semibold text-pine outline-none focus:ring-2 focus:ring-court"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs font-medium text-pine/70">
                  Price per hour (₱)
                  <input
                    type="number"
                    min={0}
                    value={timeDraft[idx]?.price ?? String(t.price)}
                    onChange={(e) => setTimeDraft({ ...timeDraft, [idx]: { ...(timeDraft[idx] || { start: String(t.start), end: String(t.end), price: String(t.price) }), price: e.target.value } })}
                    className="w-28 rounded-xl border border-white bg-white px-3 py-2 text-base font-semibold text-pine outline-none focus:ring-2 focus:ring-court"
                  />
                </label>
              </div>
            ))}
            <button onClick={saveTimeRates} className="rounded-xl bg-court px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pine">
              Save time rates
            </button>
          </div>
        )}
      </div>

      <div className="glass mt-6 rounded-3xl p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold">Current tiers</h2>
        {loading ? (
          <p className="mt-3 text-sm text-pine/60">Loading rates...</p>
        ) : rates.length === 0 ? (
          <p className="mt-3 text-sm text-pine/60">No tiers yet. Add one below.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {rates.map((tier) => (
              <li key={tier.maxHours} className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/70 bg-white/60 p-3">
                <div className="min-w-[8rem]">
                  <div className="text-xs font-semibold uppercase tracking-wider text-pine/45">Up to</div>
                  <div className="font-display text-lg font-semibold">{tier.maxHours} hour{tier.maxHours > 1 ? "s" : ""}</div>
                </div>
                <label className="flex flex-col gap-1 text-xs font-medium text-pine/70">
                  Price (₱)
                  <input
                    type="number"
                    min={0}
                    value={draft[tier.maxHours] ?? ""}
                    onChange={(e) => setDraft({ ...draft, [tier.maxHours]: e.target.value })}
                    className="w-32 rounded-xl border border-white bg-white px-3 py-2 text-base font-semibold text-pine outline-none focus:ring-2 focus:ring-court"
                  />
                </label>
                <button
                  onClick={() => save(tier.maxHours, Number(draft[tier.maxHours]))}
                  className="rounded-xl bg-court px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pine"
                >
                  Save
                </button>
                <button
                  onClick={() => remove(tier.maxHours)}
                  className="rounded-xl bg-red-500/10 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-500/20"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form onSubmit={addTier} className="glass mt-5 rounded-3xl p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold">Add or update a tier</h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs font-medium text-pine/70">
            Max hours
            <input
              type="number"
              min={1}
              value={maxHours}
              onChange={(e) => setMaxHours(e.target.value)}
              placeholder="e.g. 4"
              className="w-32 rounded-xl border border-white bg-white px-3 py-2 text-base font-semibold text-pine outline-none focus:ring-2 focus:ring-court"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-pine/70">
            Price
            <input
              type="number"
              min={0}
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="e.g. 1200"
              className="w-32 rounded-xl border border-white bg-white px-3 py-2 text-base font-semibold text-pine outline-none focus:ring-2 focus:ring-court"
            />
          </label>
          <button className="rounded-xl bg-ball px-4 py-2.5 text-sm font-semibold text-pine transition hover:brightness-105">
            Save tier
          </button>
        </div>
        <p className="mt-3 text-xs text-pine/55">
          Example: tiers 1h → {peso(400)}, 2h → {peso(700)}, 24h → {peso(3000)}.
        </p>
      </form>
    </div>
  );
}
