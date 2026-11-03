"use client";
import { useCallback, useEffect, useState } from "react";
import Clover from "./Clover";

export default function InventoryManager() {
  const [paddles, setPaddles] = useState(4);
  const [balls, setBalls] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/inventory", { cache: "no-store" });
      if (res.status === 401) { window.location.href = "/admin/login"; return; }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load inventory.");
      setPaddles(json.paddles);
      setBalls(json.balls);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load inventory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function save() {
    setError(""); setNotice("");
    const res = await fetch("/api/admin/inventory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paddles: Number(paddles), balls: Number(balls) }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Could not save inventory."); return; }
    setPaddles(json.paddles);
    setBalls(json.balls);
    setNotice("Inventory updated.");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <a href="/admin" className="flex items-center gap-2 font-display text-xl font-bold text-pine">
          <Clover className="h-7 w-7 text-court" />
          Lucky Paddle Admin
        </a>
        <a href="/admin" className="rounded-full px-3 py-2 text-sm text-pine/70 transition hover:bg-white/60 hover:text-pine">Back to dashboard</a>
      </header>

      <section className="mt-8">
        <h1 className="font-display text-3xl font-bold">Inventory</h1>
        <p className="mt-1 text-pine/65">Set how many paddles and balls are available for rental/sale.</p>
      </section>

      {error && <p role="alert" className="mt-5 rounded-2xl bg-red-500/10 p-4 text-sm text-red-700">{error}</p>}
      {notice && <p className="mt-5 rounded-2xl bg-leaf/15 p-4 text-sm text-court">{notice}</p>}

      <div className="glass mt-6 rounded-3xl p-5 sm:p-6">
        {loading ? <p className="text-sm text-pine/60">Loading...</p> : (
          <div className="flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-xs font-medium text-pine/70">
              Paddles ready for rental
              <input type="number" min={0} value={paddles} onChange={(e) => setPaddles(Number(e.target.value))} className="w-32 rounded-xl border border-white bg-white px-3 py-2 text-base font-semibold text-pine" />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-pine/70">
              Balls available
              <input type="number" min={0} value={balls} onChange={(e) => setBalls(Number(e.target.value))} className="w-32 rounded-xl border border-white bg-white px-3 py-2 text-base font-semibold text-pine" />
            </label>
            <button onClick={save} className="rounded-xl bg-court px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pine">Save inventory</button>
          </div>
        )}
      </div>
    </div>
  );
}
