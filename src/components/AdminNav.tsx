"use client";

import { useEffect, useState } from "react";
import Clover from "./Clover";

type NavLink = { href: string; label: string; id: string; ownerOnly?: boolean };

const LINKS: NavLink[] = [
  { href: "/admin/inventory", label: "Inventory", id: "inventory" },
  { href: "/admin/reserve", label: "Reserve", id: "reserve" },
  { href: "/admin/rate", label: "Court rates", id: "rate" },
  { href: "/admin/users", label: "Users", id: "users", ownerOnly: true },
  { href: "/admin/settings", label: "Settings", id: "settings" },
  { href: "/", label: "View site", id: "site" },
];

type AdminRole = "owner" | "admin";

export default function AdminNav({
  current,
  role,
  displayName,
}: {
  current?: "dashboard" | "inventory" | "reserve" | "rate" | "users" | "settings";
  role?: AdminRole;
  displayName?: string;
}) {
  const [open, setOpen] = useState(false);
  const links = LINKS.filter((link) => !link.ownerOnly || role !== "admin");

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function signOut() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  const desktopLinkClass = (id: string) =>
    `inline-flex min-h-9 items-center rounded-full px-3 py-2 text-sm transition hover:bg-white/60 hover:text-pine ${
      current === id ? "bg-white/60 font-medium text-pine" : "text-pine/70"
    }`;

  const mobileLinkClass = (id: string) =>
    `flex min-h-11 items-center rounded-xl px-3 text-base transition hover:bg-white/70 ${
      current === id ? "bg-white/70 font-semibold text-pine" : "text-pine/80"
    }`;

  return (
    <>
      {open && (
        <button
          type="button"
          tabIndex={-1}
          aria-label="Close menu"
          className="fixed inset-0 z-20 bg-pine/10 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}
      <header className="sticky top-3 z-30 mt-3">
        <div className="flex items-center justify-between rounded-full px-4 py-3 glass sm:px-5">
          <a href="/admin" className="flex min-h-11 items-center gap-2">
            <Clover className="h-6 w-6 text-court" />
            <div>
              <div className="font-display text-lg font-bold leading-tight">Lucky Paddle</div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-pine/45">Admin</div>
            </div>
          </a>

          <nav className="hidden items-center gap-2 lg:flex" aria-label="Admin">
            {links.map((link) => (
              <a key={link.id} href={link.href} className={desktopLinkClass(link.id)}>
                {link.label}
              </a>
            ))}
            {displayName && (
              <span className="hidden text-xs font-medium text-pine/55 xl:inline">Signed in as {displayName}</span>
            )}
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex min-h-9 items-center rounded-full bg-pine px-4 py-2 text-sm font-medium text-white transition hover:bg-court"
            >
              Sign out
            </button>
          </nav>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/70 text-pine transition hover:bg-white lg:hidden"
            aria-expanded={open}
            aria-controls="admin-mobile-nav"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((value) => !value)}
          >
            <span className="relative block h-3.5 w-4" aria-hidden="true">
              <span className={`absolute left-0 h-0.5 w-4 rounded-full bg-pine transition ${open ? "top-1.5 rotate-45" : "top-0"}`} />
              <span className={`absolute left-0 top-1.5 h-0.5 w-4 rounded-full bg-pine transition ${open ? "opacity-0" : ""}`} />
              <span className={`absolute left-0 h-0.5 w-4 rounded-full bg-pine transition ${open ? "top-1.5 -rotate-45" : "top-3"}`} />
            </span>
          </button>
        </div>

        {open && (
          <nav id="admin-mobile-nav" className="mt-2 flex flex-col gap-1 rounded-3xl p-3 glass lg:hidden" aria-label="Admin">
            <a href="/admin" className={mobileLinkClass("dashboard")}>Dashboard</a>
            {links.map((link) => (
              <a key={link.id} href={link.href} className={mobileLinkClass(link.id)}>
                {link.label}
              </a>
            ))}
            {displayName && (
              <p className="px-3 py-2 text-xs font-medium text-pine/55">Signed in as {displayName}</p>
            )}
            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-1 flex min-h-11 items-center justify-center rounded-xl bg-pine px-3 text-base font-medium text-white transition hover:bg-court"
            >
              Sign out
            </button>
          </nav>
        )}
      </header>
    </>
  );
}
