"use client";
import { useState } from "react";
import Clover from "./Clover";

export default function AdminSettings({ displayName, username }: { displayName: string; username: string }) {
  const [usernameValue, setUsernameValue] = useState(username);
  const [usernamePassword, setUsernamePassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function updateUsername(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    try {
      const response = await fetch("/api/admin/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: usernameValue, currentPassword: usernamePassword }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not update your username.");
      setUsernameValue(json.username);
      setUsernamePassword("");
      setNotice("Username updated successfully.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your username.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (newPassword !== confirmPassword) {
      setError("The new password and confirmation do not match.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/admin/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error ?? "Could not change your password.");
      // Password changes revoke every active session for this account; require a fresh sign-in.
      window.location.replace("/admin/login?passwordChanged=1");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not change your password.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-5 pb-16">
      <header className="mt-6 flex items-center justify-between gap-3">
        <a href="/admin" className="flex items-center gap-2 font-display text-xl font-bold text-pine">
          <Clover className="h-7 w-7 text-court" /> Lucky Paddle Admin
        </a>
        <a href="/admin" className="rounded-full px-3 py-2 text-sm text-pine/70 transition hover:bg-white/60">Back to dashboard</a>
      </header>

      <section className="mt-8">
        <h1 className="font-display text-4xl font-bold">Settings</h1>
        <p className="mt-1 text-pine/65">Manage your own sign-in security.</p>
      </section>

      {error && <p role="alert" className="mt-5 rounded-xl bg-red-500/10 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-xl bg-leaf/15 p-3 text-sm text-court">{notice}</p>}

      <section className="glass mt-6 rounded-3xl p-5 sm:p-7">
        <h2 className="font-display text-xl font-semibold">Account</h2>
        <div className="mt-3 rounded-2xl bg-white/50 p-4 text-sm text-pine/75">
          <div><span className="text-pine/50">Name:</span> <b>{displayName}</b></div>
          <div className="mt-1"><span className="text-pine/50">Username:</span> <b>@{usernameValue}</b></div>
        </div>

        <form onSubmit={updateUsername} className="mt-6 space-y-4 border-b border-pine/10 pb-6">
          <h3 className="font-display text-lg font-semibold">Change username</h3>
          <label className="flex flex-col gap-1 text-sm font-medium text-pine/75">
            New username
            <input required minLength={3} maxLength={32} pattern="[A-Za-z0-9._-]+" autoComplete="username" value={usernameValue} onChange={(e) => setUsernameValue(e.target.value)} className="rounded-xl border border-white bg-white/80 px-4 py-3 text-pine" />
            <span className="text-xs font-normal text-pine/50">3–32 letters, numbers, dots, underscores or dashes. Usernames are case-insensitive.</span>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-pine/75">
            Confirm with current password
            <input required type="password" autoComplete="current-password" value={usernamePassword} onChange={(e) => setUsernamePassword(e.target.value)} className="rounded-xl border border-white bg-white/80 px-4 py-3 text-pine" />
          </label>
          <button disabled={busy} className="rounded-xl bg-court px-5 py-3 font-semibold text-white transition hover:bg-pine disabled:opacity-60">
            {busy ? "Updating…" : "Update username"}
          </button>
        </form>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <h3 className="font-display text-lg font-semibold">Change password</h3>
          <label className="flex flex-col gap-1 text-sm font-medium text-pine/75">
            Current password
            <input required type="password" autoComplete="current-password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className="rounded-xl border border-white bg-white/80 px-4 py-3 text-pine" />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-pine/75">
            New password
            <input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="rounded-xl border border-white bg-white/80 px-4 py-3 text-pine" />
            <span className="text-xs font-normal text-pine/50">Use at least 12 characters. Changing it signs you out on all devices.</span>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-pine/75">
            Confirm new password
            <input required minLength={12} maxLength={128} type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="rounded-xl border border-white bg-white/80 px-4 py-3 text-pine" />
          </label>
          <button disabled={busy} className="rounded-xl bg-court px-5 py-3 font-semibold text-white transition hover:bg-pine disabled:opacity-60">
            {busy ? "Updating…" : "Update password"}
          </button>
        </form>
      </section>
    </main>
  );
}
