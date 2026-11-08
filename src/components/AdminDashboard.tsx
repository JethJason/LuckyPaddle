"use client";
import { useCallback, useEffect, useState } from "react";
import AdminNav from "./AdminNav";
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
  cancelled: "bg-slate-500/10 text-slate-700",
};

const STATUS_LABELS: Record<Status, string> = {
  held: "On hold",
  awaiting_review: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const prettyDate = (value: string) =>
  new Date(`${value}T00:00:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

function shiftIsoDate(value: string, days: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const next = new Date(`${value}T00:00:00`);
  next.setDate(next.getDate() + days);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-${String(next.getDate()).padStart(2, "0")}`;
}

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
  const [cancellationChoice, setCancellationChoice] = useState<Booking | null>(null);
  const [cancellationReason, setCancellationReason] = useState("Customer requested cancellation");
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingDate, setBookingDate] = useState("");
  const [bookingHour, setBookingHour] = useState("");
  const [bookingStatus, setBookingStatus] = useState<"all" | Status>("all");

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

  async function resolveCancellation(action: "cancel" | "delete") {
    if (!cancellationChoice) return;
    const booking = cancellationChoice;
    setBusyId(booking.id);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: booking.id, action, reason: cancellationReason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not cancel the reservation.");
      const outcome = action === "delete"
        ? "Reservation permanently deleted from the database and its slot released."
        : "Reservation marked as cancelled and its slot released.";
      setNotice(json.emailed
        ? `${outcome} The customer was emailed. No refund was issued automatically.`
        : `${outcome} The customer email was not sent. No refund was issued automatically.`);
      setCancellationChoice(null);
      setCancellationReason("Customer requested cancellation");
      await load(date);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel the reservation.");
    } finally {
      setBusyId("");
    }
  }

  async function deleteCancelled(booking: Booking) {
    if (!window.confirm(`Permanently delete the cancelled booking for ${booking.name ?? "this customer"}? This removes it and its receipt from the database and can't be undone.`)) return;
    setBusyId(booking.id);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: booking.id, action: "purge" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Could not delete the booking.");
      setNotice("Cancelled booking permanently deleted.");
      await load(date);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the booking.");
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
  const normalizedSearch = bookingSearch.trim().toLocaleLowerCase();
  const filteredBookings = (data?.bookings ?? []).filter((booking) => {
    const matchesSearch = !normalizedSearch || [booking.name, booking.email, booking.phone, booking.reference]
      .some((value) => value?.toLocaleLowerCase().includes(normalizedSearch));
    const matchesDate = !bookingDate || booking.date === bookingDate;
    const matchesHour = !bookingHour || booking.hour === Number(bookingHour);
    const matchesStatus = bookingStatus === "all" || booking.status === bookingStatus;
    return matchesSearch && matchesDate && matchesHour && matchesStatus;
  });

  return (
    <main className="mx-auto max-w-6xl overflow-x-hidden px-5 pb-16">
      <AdminNav current="dashboard" role={data?.admin.role} displayName={data?.admin.displayName} />

      <section className="mt-8">
        <h1 className="font-display text-4xl font-bold">Dashboard</h1>
        <p className="mt-1 text-pine/65">Bookings and court data for your private court.</p>
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
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="font-display text-xl font-semibold">Court schedule</h2>
                  <p className="text-sm text-pine/55">{data.court} · {prettyDate(data.date)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label="Previous day"
                      onClick={() => setDate(shiftIsoDate(date || data.date, -1))}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-pine transition hover:bg-white"
                    >
                      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
                        <path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <label className="sr-only" htmlFor="schedule-date">Schedule date</label>
                    <input
                      id="schedule-date"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="h-11 min-w-0 rounded-xl border border-white/80 bg-white/80 px-3 text-sm text-pine"
                    />
                    <button
                      type="button"
                      aria-label="Next day"
                      onClick={() => setDate(shiftIsoDate(date || data.date, 1))}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-pine transition hover:bg-white"
                    >
                      <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
                        <path d="M7.5 4.5 13 10l-5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => load(date)}
                    className="inline-flex h-11 items-center rounded-full bg-white/70 px-4 text-xs font-medium text-pine/70 transition hover:bg-white"
                  >
                    Refresh
                  </button>
                </div>
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
                <p className="text-sm text-pine/55">Showing {filteredBookings.length} of {data.bookings.length} {data.bookings.length === 1 ? "record" : "records"} · newest first</p>
              </div>

              <div className="mt-4 grid gap-3 rounded-2xl border border-white/70 bg-white/45 p-3 sm:grid-cols-2 xl:grid-cols-4">
                <label className="flex min-w-0 flex-col gap-1 text-[11px] font-semibold text-pine/55 sm:col-span-2 xl:col-span-1">
                  Search player or contact
                  <input type="search" value={bookingSearch} onChange={(event) => setBookingSearch(event.target.value)} placeholder="Name, email, phone, reference" aria-label="Search player or contact"
                    className="w-full rounded-xl border border-white bg-white/80 px-3 py-2 text-sm font-normal text-pine placeholder:text-pine/35" />
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-[11px] font-semibold text-pine/55">
                  Booking date
                  <input type="date" value={bookingDate} onChange={(event) => setBookingDate(event.target.value)} aria-label="Filter by booking date"
                    className="w-full rounded-xl border border-white bg-white/80 px-3 py-2 text-sm font-normal text-pine" />
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-[11px] font-semibold text-pine/55">
                  Start time
                  <select value={bookingHour} onChange={(event) => setBookingHour(event.target.value)} aria-label="Filter by booking start time"
                    className="w-full rounded-xl border border-white bg-white/80 px-3 py-2 text-sm font-normal text-pine">
                    <option value="">Any time</option>
                    {Array.from({ length: 17 }, (_, index) => index + 8).map((hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}
                  </select>
                </label>
                <label className="flex min-w-0 flex-col gap-1 text-[11px] font-semibold text-pine/55">
                  Status
                  <select value={bookingStatus} onChange={(event) => setBookingStatus(event.target.value as "all" | Status)} aria-label="Filter by booking status"
                    className="w-full rounded-xl border border-white bg-white/80 px-3 py-2 text-sm font-normal text-pine">
                    <option value="all">All statuses</option>
                    {(Object.keys(STATUS_LABELS) as Status[]).map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                  </select>
                </label>
                <button type="button" onClick={() => { setBookingSearch(""); setBookingDate(""); setBookingHour(""); setBookingStatus("all"); }}
                  disabled={!bookingSearch && !bookingDate && !bookingHour && bookingStatus === "all"}
                  className="justify-self-start rounded-full bg-pine/10 px-3 py-1.5 text-xs font-semibold text-pine/70 transition hover:bg-pine/15 disabled:cursor-not-allowed disabled:opacity-40 sm:col-span-2 xl:col-span-4">
                  Clear filters
                </button>
              </div>

              {data.bookings.length === 0 ? (
                <div className="mt-6 rounded-2xl bg-white/40 p-8 text-center">
                  <Clover className="mx-auto h-8 w-8 text-leaf/60" />
                  <p className="mt-3 font-display font-semibold">No bookings yet</p>
                  <p className="mt-1 text-sm text-pine/55">New QR payments and active holds will show up here.</p>
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="mt-4 rounded-2xl bg-white/40 p-8 text-center text-sm text-pine/55">
                  No bookings match these filters. Try changing or clearing the search criteria.
                </div>
              ) : (
                <div className="table-scroll mt-4 min-h-0 max-h-[30rem] flex-1 overflow-auto">
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
                      {filteredBookings.map((booking) => (
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
                            {booking.status === "cancelled" && booking.cancelledBy && (
                              <div className="mt-1 whitespace-nowrap text-[10px] text-pine/55" title={booking.cancelledAt ? new Date(booking.cancelledAt).toLocaleString("en-PH") : undefined}>
                                cancelled by {booking.cancelledBy}
                                {booking.cancellationReason ? ` · ${booking.cancellationReason}` : ""}
                              </div>
                            )}
                            {booking.status === "cancelled" && (
                              <button type="button" onClick={() => void deleteCancelled(booking)} disabled={busyId === booking.id}
                                className="mt-1 block whitespace-nowrap text-[10px] font-semibold text-red-700 underline decoration-red-300 underline-offset-2 disabled:opacity-50">
                                {busyId === booking.id ? "Deleting…" : "Delete permanently"}
                              </button>
                            )}
                            {booking.status === "approved" && booking.createdBy !== "admin" && (
                              <button type="button" onClick={() => { setCancellationChoice(booking); setCancellationReason("Customer requested cancellation"); }} disabled={busyId === booking.id}
                                className="mt-1 block whitespace-nowrap text-[10px] font-semibold text-red-700 underline decoration-red-300 underline-offset-2 disabled:opacity-50">
                                Manage cancellation
                              </button>
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

      {cancellationChoice && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-pine/75 p-4 backdrop-blur-sm"
          onMouseDown={(event) => { if (event.target === event.currentTarget && !busyId) setCancellationChoice(null); }}
        >
          <section role="dialog" aria-modal="true" aria-labelledby="cancel-booking-title"
            className="w-full max-w-lg rounded-3xl border border-white/70 bg-[#f3fbf5] p-5 shadow-2xl sm:p-7">
            <h2 id="cancel-booking-title" className="font-display text-2xl font-bold">Cancel approved reservation?</h2>
            <p className="mt-2 text-sm leading-relaxed text-pine/70">
              {cancellationChoice.name ?? "Customer"} · {prettyDate(cancellationChoice.date)} · {hourLabel(cancellationChoice.hour)}–{hourLabel(cancellationChoice.hour + cancellationChoice.duration)}
            </p>
            <p className="mt-3 rounded-xl bg-amber-400/15 p-3 text-xs leading-relaxed text-amber-950">
              Either option releases the slot and sends the customer a cancellation email. No refund is issued automatically; the existing non-refundable policy still applies.
            </p>
            <label className="mt-4 block text-sm font-medium text-pine/75">
              Optional reason for the customer email
              <textarea value={cancellationReason} maxLength={500} onChange={(event) => setCancellationReason(event.target.value)}
                className="mt-1.5 min-h-20 w-full rounded-xl border border-white bg-white/80 px-3 py-2 text-sm text-pine" />
            </label>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <button type="button" disabled={busyId === cancellationChoice.id} onClick={() => void resolveCancellation("cancel")}
                className="rounded-xl bg-court px-4 py-3 text-sm font-semibold text-white transition hover:bg-pine disabled:opacity-60">
                {busyId === cancellationChoice.id ? "Processing…" : "Mark as cancelled"}
              </button>
              <button type="button" disabled={busyId === cancellationChoice.id} onClick={() => void resolveCancellation("delete")}
                className="rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-800 disabled:opacity-60">
                {busyId === cancellationChoice.id ? "Processing…" : "Delete permanently"}
              </button>
            </div>
            <button type="button" disabled={!!busyId} onClick={() => setCancellationChoice(null)} className="mt-3 w-full rounded-xl bg-pine/10 px-4 py-2.5 text-sm font-semibold text-pine/75 hover:bg-pine/15 disabled:opacity-50">
              Keep reservation
            </button>
            <p className="mt-3 text-[11px] leading-relaxed text-pine/50">
              “Mark as cancelled” retains the booking and records the cancellation. “Delete permanently” removes the booking and its history from the database.
            </p>
          </section>
        </div>
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
