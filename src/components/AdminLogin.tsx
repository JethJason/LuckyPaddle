"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Clover from "./Clover";

export default function AdminLogin({ showDevHint }: { showDevHint: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(json.error ?? "Could not sign in.");
      setBusy(false);
      return;
    }
    router.replace("/admin");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-5">
      <div className="glass w-full rounded-3xl p-8">
        <div className="flex items-center gap-2 font-display text-lg font-bold">
          <Clover className="h-6 w-6 text-court" />
          Lucky Paddle
        </div>
        <h1 className="mt-7 font-display text-3xl font-bold">Admin access</h1>
        <p className="mt-2 text-sm text-pine/65">Sign in to see bookings and court data.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="password" className="text-sm font-medium text-pine/80">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              className="mt-1.5 w-full rounded-xl border border-white/80 bg-white/70 px-4 py-3 text-pine placeholder:text-pine/40"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-court py-3.5 font-display text-lg font-semibold text-white transition hover:bg-pine disabled:opacity-60"
          >
            {busy ? "Checking..." : "Enter dashboard"}
          </button>
        </form>

        {error && <p role="alert" className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-700">{error}</p>}

        {showDevHint && (
          <p className="mt-5 rounded-xl bg-ball/30 p-3 text-xs text-pine/70">
            Dev password: <code className="font-semibold">luckypaddle</code>. Set <code>ADMIN_PASSWORD</code> in <code>.env.local</code> to change it.
          </p>
        )}

        <a href="/" className="mt-6 inline-block text-sm text-pine/60 underline underline-offset-4 hover:text-pine">Back to booking</a>
      </div>
    </main>
  );
}
