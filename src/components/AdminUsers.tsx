"use client";
import { useCallback, useEffect, useState } from "react";
import Clover from "./Clover";

type AdminUser = {
  id: string;
  username: string;
  display_name: string;
  role: "owner" | "admin";
  active: boolean;
  created_at: string;
};

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "owner">("admin");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/users", { cache: "no-store" });
      if (response.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not load admin users.");
      setUsers(json.users ?? []);
      setCurrentUserId(json.currentUserId ?? "");
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load admin users.");
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function createUser(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, displayName, password, role }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not create the user.");
      setDisplayName("");
      setUsername("");
      setPassword("");
      setRole("admin");
      setNotice(`Admin account ${json.user.display_name} created.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the user.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleUser(user: AdminUser) {
    setError("");
    setNotice("");
    const active = !user.active;
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: user.id, active }),
      });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error ?? "Could not update the account.");
      setNotice(`${user.display_name}'s account ${active ? "activated" : "deactivated"}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the account.");
    }
  }

  return (
    <main className="mx-auto max-w-4xl px-5 pb-16">
      <header className="mt-6 flex items-center justify-between gap-3">
        <a href="/admin" className="flex items-center gap-2 font-display text-xl font-bold text-pine">
          <Clover className="h-7 w-7 text-court" /> Lucky Paddle Admin
        </a>
        <a href="/admin" className="rounded-full px-3 py-2 text-sm text-pine/70 transition hover:bg-white/60">Back to dashboard</a>
      </header>

      <section className="mt-8">
        <h1 className="font-display text-4xl font-bold">Admin users</h1>
        <p className="mt-1 text-pine/65">Give each staff member a separate account. Deactivated users lose access immediately.</p>
      </section>

      {error && <p role="alert" className="mt-5 rounded-2xl bg-red-500/10 p-4 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-2xl bg-leaf/15 p-4 text-sm text-court">{notice}</p>}

      <form onSubmit={createUser} className="glass mt-6 rounded-3xl p-5 sm:p-6">
        <h2 className="font-display text-xl font-semibold">Add an admin</h2>
        <p className="mt-1 text-sm text-pine/55">New accounts can manage bookings, rates and inventory. Only owners can manage users.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-pine/70">
            Display name
            <input required minLength={2} maxLength={80} value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="rounded-xl border border-white bg-white px-3 py-2 text-base text-pine" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-pine/70">
            Username
            <input required minLength={3} maxLength={32} pattern="[A-Za-z0-9._-]+" autoComplete="off" value={username} onChange={(e) => setUsername(e.target.value)} className="rounded-xl border border-white bg-white px-3 py-2 text-base text-pine" />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-pine/70">
            Role
            <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "owner")} className="rounded-xl border border-white bg-white px-3 py-2 text-base text-pine">
              <option value="admin">Admin — manage bookings and settings</option>
              <option value="owner">Owner — includes user management</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-pine/70 sm:col-span-2">
            Temporary password
            <input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-xl border border-white bg-white px-3 py-2 text-base text-pine" />
            <span className="text-[11px] text-pine/50">At least 12 characters. Use a unique password and share it through a secure channel.</span>
          </label>
        </div>
        <button disabled={busy} className="mt-4 rounded-xl bg-court px-5 py-3 text-sm font-semibold text-white transition hover:bg-pine disabled:opacity-60">
          {busy ? "Creating…" : "Create admin account"}
        </button>
      </form>

      <section className="glass mt-5 rounded-3xl p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl font-semibold">Accounts</h2>
            <p className="text-sm text-pine/55">Owners can administer accounts. At least one active owner is required.</p>
          </div>
          <button type="button" onClick={() => void load()} className="rounded-full bg-white/70 px-3 py-2 text-xs font-semibold text-pine/70 hover:bg-white">Refresh</button>
        </div>
        <ul className="mt-4 space-y-3">
          {users.map((user) => (
            <li key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/70 bg-white/60 p-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 font-semibold text-pine">
                  {user.display_name}
                  <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${user.role === "owner" ? "bg-ball/50 text-pine" : "bg-court/10 text-court"}`}>{user.role}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${user.active ? "bg-leaf/15 text-court" : "bg-red-500/10 text-red-700"}`}>{user.active ? "Active" : "Inactive"}</span>
                  {user.id === currentUserId && <span className="text-[10px] text-pine/45">You</span>}
                </div>
                <div className="text-sm text-pine/55">@{user.username} · Added {new Date(user.created_at).toLocaleDateString("en-PH")}</div>
              </div>
              {user.id !== currentUserId && (
                <button type="button" onClick={() => void toggleUser(user)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${user.active ? "bg-red-500/10 text-red-700 hover:bg-red-500/20" : "bg-leaf/15 text-court hover:bg-leaf/25"}`}>
                  {user.active ? "Deactivate" : "Activate"}
                </button>
              )}
            </li>
          ))}
          {users.length === 0 && <li className="rounded-2xl bg-white/40 p-6 text-center text-sm text-pine/55">No admin users found.</li>}
        </ul>
      </section>
    </main>
  );
}
