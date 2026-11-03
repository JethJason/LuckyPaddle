"use client";
import { useCallback, useEffect, useState } from "react";
import Clover from "./Clover";
import { hourLabel, peso } from "@/lib/config";
import type { Booking, Status } from "@/lib/store";

interface ScheduleCell {
  hour: number;
  booking: Booking | null;
  isStart: boolean;
  past: boolean;
}

interface DashboardData {
  date: string;
  today: string;
  court: string;
  admin: { id: string; displayName: string; role: "owner" | "admin" };
  stats: {
    revenue: number;
    approvedCount: number;
    pendingCount: number;
    upcomingCount: number;
    todayBookings: number;
    occupancy: number;
    activeHolds: number;
  };
  schedule: ScheduleCell[];
  bookings: Booking[];
}

const STATUS_STYLES: Record<Status, string> = {
  held: "bg-sky-400/20 text-sky-800",
  awaiting_review: "bg-amber-400/20 text-amber-800",
  approved: "bg-leaf/15 text-court",
  rejected: "bg-red-500/10 text-red-700",
};

const STATUS_LABELS: Record<Status, string> = {
  held: "On hold",
  awaiting_review: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
};

const prettyDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

export default function AdminDashboard() {
  const [date, setDate] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busyId, setBusyId] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [proofPreview, setProofPreview] = useState<{ url: string; name: string; reference?: string } | null>(null);

  const load = useCallback(async (selected: string) => {
    try {
      const res = await fetch(`/api/admin/dashboard${selected ? `?date=${encodeURIComponent(selected)}` : ""}`, {
        cache: "no-store",
      });
      if (res.status === 401) {
        window.location.href = "/admin/login";
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not load the dashboard.");
      setData(json);
      setDate((current) => current || json.date);
      setLastUpdated(new Date());
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the dashboard.");
    }
  }, []);

  useEffect(() => { void load(date); }, [date, load]);
  useEffect(() => {
    const timer = setInterval(() => { void load(date); }, 15_000);
    return () => clearInterval(timer);
  }, [date, load]);

  useEffect(() => {
    if (!proofPreview) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProofPreview(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [proofPreview]);

  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  async function review(id: string, action: "approve" | "reject") {
    setBusyId(id);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not review the booking.");
      setNotice(
        action === "approve"
          ? json.emailed
            ? "Approved. Confirmation email sent."
            : "Approved, but the confirmation email was not sent. Check RESEND_API_KEY and EMAIL_FROM."
          : json.emailed
            ? "Rejected. The slot is open again, and the customer was emailed."
            : "Rejected and the slot is open again, but the rejection email was not sent. Check the customer's email and email provider settings.",
      );
      await load(date);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not review the booking.");
    } finally {
      setBusyId("");
    }
  }

  const cards = data
    ? [
        { label: "Revenue", value: peso(data.stats.revenue), hint: `${data.stats.approvedCount} approved` },
        { label: "Pending approval", value: String(data.stats.pendingCount), hint: `${data.stats.activeHolds} active holds` },
        { label: "Today", value: String(data.stats.todayBookings), hint: `${data.stats.occupancy}% occupancy` },
        { label: "Upcoming", value: String(data.stats.upcomingCount), hint: "Approved bookings" },
      ]
    : [];

  const pending = data?.bookings.filter((booking) => booking.status === "awaiting_review") ?? [];

  return (
    <main className="mx-auto max-w-6xl px-5 pb-16">
      <header className="sticky top-3 z-20 mt-3 flex items-center justify-between rounded-full px-5 py-3 glass">
        <div className="flex items-center gap-2">
          <Clover className="h-6 w-6 text-court" />
          <div>
            <div className="font-display text-lg font-bold leading-tight">Lucky Paddle</div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-pine/45">Admin</div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <a href="/admin/inventory" className="rounded-full px-3 py-2 text-sm text-pine/70 transition hover:bg-white/60 hover:text-pine">Inventory</a>
          <a href="/admin/reserve" className="rounded-full px-3 py-2 text-sm text-pine/70 transition hover:bg-white/60 hover:text-pine">Reserve</a>
          <a href="/admin/rate" className="rounded-full px-3 py-2 text-sm text-pine/70 transition hover:bg-white/60 hover:text-pine">Court rates</a>
          {data?.admin.role === "owner" && <a href="/admin/users" className="rounded-full px-3 py-2 text-sm text-pine/70 transition hover:bg-white/60 hover:text-pine">Users</a>}
          <a href="/admin/settings" className="rounded-full px-3 py-2 text-sm text-pine/70 transition hover:bg-white/60 hover:text-pine">Settings</a>
          {data?.admin && <span className="hidden text-xs font-medium text-pine/55 xl:inline">Signed in as {data.admin.displayName}</span>}
          <a href="/" className="rounded-full px-3 py-2 text-sm text-pine/70 transition hover:bg-white/60 hover:text-pine">View site</a>
          <button onClick={signOut} className="rounded-full bg-pine px-4 py-2 text-sm font-medium text-white transition hover:bg-court">
            Sign out
          </button>
        </div>
      </header>

      <section className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-4xl font-bold">Dashboard</h1>
          <p className="mt-1 text-pine/65">Bookings and court data for your private court.</p>
        </div>
        <div className="text-left sm:text-right">
          <label htmlFor="dashboard-date" className="text-xs font-semibold uppercase tracking-wider text-pine/45">Schedule date</label>
          <input
            id="dashboard-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="mt-1 block rounded-xl border border-white/80 bg-white/70 px-3 py-2 text-sm text-pine"
          />
        </div>
      </section>

      {error && <p role="alert" className="mt-5 rounded-2xl bg-red-500/10 p-4 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="mt-5 rounded-2xl bg-leaf/15 p-4 text-sm text-court">{notice}</p>}

      {!data ? (
        <div className="glass mt-6 rounded-3xl p-10 text-center text-pine/60">
          {error ? "Dashboard could not be loaded." : "Loading dashboard..."}
        </div>
      ) : (
        <>
          <section className="mt-6 grid grid-cols-2 items-stretch gap-3 lg:grid-cols-4">
            {cards.map((card) => (
              <div key={card.label} className="glass flex min-h-28 flex-col rounded-2xl p-4 sm:p-5">
                <div className="text-xs font-semibold uppercase tracking-wider text-pine/45">{card.label}</div>
                <div className="mt-2 whitespace-nowrap font-display text-2xl font-bold sm:text-3xl">{card.value}</div>
                <div className="mt-auto pt-1 text-xs text-pine/55">{card.hint}</div>
              </div>
            ))}
          </section>

          <section className="glass mt-5 rounded-3xl p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="font-display text-xl font-semibold">Pending approval</h2>
                <p className="text-sm text-pine/55">Verify the QR payment reference, then approve or reject.</p>
              </div>
              <span className="rounded-full bg-amber-400/20 px-3 py-1 text-xs font-semibold text-amber-800">
                {pending.length} waiting
              </span>
            </div>

            {pending.length === 0 ? (
              <div className="mt-4 rounded-2xl bg-white/40 p-6 text-center">
                <Clover className="mx-auto h-7 w-7 text-leaf/60" />
                <p className="mt-2 text-sm text-pine/55">Nothing waiting. New QR payments will show up here.</p>
              </div>
            ) : (
              <div className="mt-4 grid items-stretch gap-3 lg:grid-cols-2">
                {pending.map((booking) => (
                  <div key={booking.id} className="flex h-full flex-col rounded-2xl border border-white/80 bg-white/70 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="font-display font-semibold">
                          {prettyDate(booking.date)} · {hourLabel(booking.hour)} - {hourLabel(booking.hour + booking.duration)}
                        </div>
                        <div className="text-sm text-pine/70">{booking.name ?? "Unnamed player"}</div>
                        <div className="text-xs text-pine/55">{booking.phone ?? "No phone"} · {booking.email ?? "No email"}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-display font-semibold">{peso(booking.amount)}</div>
                        <div className="text-[10px] uppercase tracking-wider text-pine/40">#{booking.id.slice(0, 6).toUpperCase()}</div>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-pine/60">
                      <span className="rounded-full bg-white px-2.5 py-1">Ref <b>{booking.reference ?? "-"}</b></span>
                      {(booking.paddles ?? 0) > 0 && <span className="rounded-full bg-white px-2.5 py-1">{booking.paddles} paddle{(booking.paddles ?? 0) === 1 ? "" : "s"}</span>}
                      {(booking.balls ?? 0) > 0 && <span className="rounded-full bg-white px-2.5 py-1">{booking.balls} ball{(booking.balls ?? 0) === 1 ? "" : "s"}</span>}
                    </div>
                    {booking.proofUrl ? (
                      <button type="button" onClick={() => setProofPreview({ url: booking.proofUrl!, name: booking.name ?? "Customer", reference: booking.reference })}
                        className="mt-3 inline-flex w-fit items-center gap-1 rounded-full bg-leaf/15 px-3 py-1 text-xs font-semibold text-court">
                        View payment receipt
                      </button>
                    ) : (
                      <span className="mt-3 inline-flex rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-700">
                        No receipt uploaded
                      </span>
                    )}
                    <div className="mt-auto flex gap-2 pt-4">
                      <button
                        onClick={() => review(booking.id, "approve")}
                        disabled={busyId === booking.id}
                        className="flex-1 rounded-xl bg-court px-3 py-2 text-sm font-semibold text-white transition hover:bg-pine disabled:opacity-60"
                      >
                        Approve & email
                      </button>
                      <button
                        onClick={() => review(booking.id, "reject")}
                        disabled={busyId === booking.id}
                        className="flex-1 rounded-xl bg-red-500/10 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-500/20 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="mt-5 grid items-stretch gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.35fr)]">
            <div className="glass flex h-full min-w-0 flex-col self-stretch rounded-3xl p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-xl font-semibold">Court schedule</h2>
                  <p className="text-sm text-pine/55">{data.court} · {prettyDate(data.date)}</p>
                </div>
                <button
                  onClick={() => load(date)}
                  className="rounded-full bg-white/70 px-3 py-1.5 text-xs font-medium text-pine/70 transition hover:bg-white"
                >
                  Refresh
                </button>
              </div>

              <div className="mt-4 min-h-0 max-h-[30rem] flex-1 space-y-2 overflow-y-auto pr-1">
                {data.schedule.map((cell) => {
                  const booking = cell.booking;
                  return (
                    <div
                      key={cell.hour}
                      className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${
                        booking ? "border-white/80 bg-white/75" : "border-transparent bg-white/30"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`w-[4.5rem] shrink-0 font-display text-sm font-semibold ${cell.past && !booking ? "text-pine/30" : "text-pine/80"}`}>
                          {hourLabel(cell.hour)}
                        </span>
                        {booking ? (
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="truncate text-sm font-medium">{booking.name ?? "Unnamed player"}</span>
                              <StatusBadge status={booking.status} />
                              {!cell.isStart && <span className="text-[10px] uppercase tracking-wider text-pine/40">continued</span>}
                            </div>
                            <div className="truncate text-xs text-pine/55">
                              {booking.phone ?? "No phone"} · {booking.email ?? "No email"}
                            </div>
                          </div>
                        ) : (
                          <span className={`text-sm ${cell.past ? "text-pine/30" : "text-pine/55"}`}>
                            {cell.past ? "Passed" : "Open"}
                          </span>
                        )}
                      </div>
                      {booking && cell.isStart && (
                        <div className="shrink-0 text-right">
                          <div className="font-display text-sm font-semibold">{peso(booking.amount)}</div>
                          <div className="text-[10px] uppercase tracking-wider text-pine/40">#{booking.id.slice(0, 6).toUpperCase()}</div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="glass flex h-full min-w-0 flex-col self-stretch rounded-3xl p-5 sm:p-6">
              <div>
                <h2 className="font-display text-xl font-semibold">All bookings</h2>
                <p className="text-sm text-pine/55">{data.bookings.length} {data.bookings.length === 1 ? "record" : "records"} · newest first</p>
              </div>

              {data.bookings.length === 0 ? (
                <div className="mt-6 rounded-2xl bg-white/40 p-8 text-center">
                  <Clover className="mx-auto h-8 w-8 text-leaf/60" />
                  <p className="mt-3 font-display font-semibold">No bookings yet</p>
                  <p className="mt-1 text-sm text-pine/55">New QR payments and active holds will show up here.</p>
                </div>
              ) : (
                <div className="mt-4 min-h-0 max-h-[30rem] flex-1 overflow-auto">
                  <table className="w-full min-w-[680px] text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-[#f3fbf5]/95 text-[10px] uppercase tracking-wider text-pine/45 backdrop-blur">
                      <tr>
                        <th className="py-2 pr-3 font-semibold">Date</th>
                        <th className="py-2 pr-3 font-semibold">Time</th>
                        <th className="py-2 pr-3 font-semibold">Player</th>
                        <th className="hidden py-2 pr-3 font-semibold sm:table-cell">Contact</th>
                        <th className="py-2 pr-3 font-semibold">Proof</th>
                        <th className="py-2 pr-3 font-semibold">Status</th>
                        <th className="py-2 text-right font-semibold">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.bookings.map((booking) => (
                        <tr key={booking.id} className="border-t border-pine/10 align-top">
                          <td className="whitespace-nowrap py-3 pr-3 text-pine/70">{prettyDate(booking.date)}</td>
                          <td className="whitespace-nowrap py-3 pr-3">
                            {hourLabel(booking.hour)} - {hourLabel(booking.hour + booking.duration)}
                          </td>
                          <td className="py-3 pr-3">
                            <div className="font-medium">{booking.name ?? "Unnamed"}</div>
                            <div className="text-[10px] uppercase tracking-wider text-pine/40">
                              #{booking.id.slice(0, 6).toUpperCase()}{booking.reference ? ` · ${booking.reference}` : ""}
                            </div>
                          </td>
                          <td className="hidden py-3 pr-3 text-pine/65 sm:table-cell">
                            <div className="truncate">{booking.email ?? "-"}</div>
                            <div className="text-xs text-pine/45">{booking.phone ?? "-"}</div>
                          </td>
                          <td className="py-3 pr-3">
                            {booking.proofUrl ? (
                            <button type="button" onClick={() => setProofPreview({ url: booking.proofUrl!, name: booking.name ?? "Customer", reference: booking.reference })} className="whitespace-nowrap text-xs font-semibold text-court underline">View receipt</button>
                            ) : <span className="text-xs text-pine/40">—</span>}
                          </td>
                          <td className="py-3 pr-3">
                            <StatusBadge status={booking.status} />
                            {booking.reviewedBy && (
                              <div className="mt-1 whitespace-nowrap text-[10px] text-pine/55" title={booking.reviewedAt ? new Date(booking.reviewedAt).toLocaleString("en-PH") : undefined}>
                                by {booking.reviewedBy}
                              </div>
                            )}
                          </td>
                          <td className="whitespace-nowrap py-3 text-right font-display font-semibold">{peso(booking.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          <p className="mt-6 text-center text-xs text-pine/45">
            {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", second: "2-digit" })} · Refreshes every 15 seconds` : "Loading..."}
          </p>
        </>
      )}

      {proofPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-pine/75 p-4 backdrop-blur-sm"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setProofPreview(null); }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="proof-preview-title"
            className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-white/70 bg-[#f3fbf5] shadow-2xl">
            <header className="flex items-center justify-between gap-4 border-b border-pine/10 px-5 py-4">
              <div className="min-w-0">
                <h2 id="proof-preview-title" className="font-display text-lg font-semibold">Payment receipt</h2>
                <p className="truncate text-xs text-pine/55">
                  {proofPreview.name}{proofPreview.reference ? ` · Ref ${proofPreview.reference}` : ""}
                </p>
              </div>
              <button type="button" autoFocus onClick={() => setProofPreview(null)} aria-label="Close receipt preview"
                className="shrink-0 rounded-full bg-pine/10 px-3 py-2 text-sm font-semibold text-pine transition hover:bg-pine/20">
                Close <span aria-hidden="true">×</span>
              </button>
            </header>
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-pine/5 p-3 sm:p-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proofPreview.url} alt={`Payment receipt uploaded by ${proofPreview.name}`} className="max-h-[75vh] max-w-full rounded-xl object-contain shadow-lg" />
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
