import Booking from "@/components/Booking";
import Clover from "@/components/Clover";
import Photo from "@/components/Photo";
import { BRAND, IMAGES, LOCATION, MAPS_EMBED_URL, MAPS_URL, PRICE_PER_HOUR, TAGLINE, peso } from "@/lib/config";

export default function Home() {
  return (
    <main>
      <header className="sticky top-3 z-20 mx-auto mt-3 flex max-w-6xl items-center justify-between rounded-full px-5 py-3 glass">
        <span className="flex items-center gap-2 font-display text-xl font-bold">
          <Clover className="h-6 w-6 text-court" />
          {BRAND}
        </span>
        <nav className="flex items-center gap-2">
          <a href="#location" className="rounded-full px-4 py-2 text-sm font-medium text-pine/75 transition hover:bg-white/60">Find us</a>
          <a href="#book" className="rounded-full bg-pine px-5 py-2 text-sm font-medium text-white">Book a court</a>
        </nav>
      </header>

      <section className="relative overflow-hidden">
        <div className="absolute inset-x-0 -top-28 h-80 bg-gradient-to-b from-blue-100/40 via-court/15 to-transparent"></div>
        <div className="absolute right-[-10%] top-10 hidden h-72 w-72 rounded-full bg-red-200/25 blur-3xl lg:block"></div>
        <div className="absolute left-[-12%] top-16 hidden h-80 w-80 rounded-full bg-blue-200/25 blur-3xl lg:block"></div>
        <div className="absolute right-[18%] top-36 hidden h-64 w-64 rounded-full bg-yellow-200/30 blur-3xl lg:block"></div>
        <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-10 lg:pt-14 lg:grid-cols-2">
          <div className="relative">
            <Clover className="pointer-events-none absolute -left-8 -top-10 h-40 w-40 text-leaf/10" />
          <p className="relative mb-5 inline-flex items-center gap-2 rounded-full bg-white/60 px-4 py-1.5 text-sm font-medium text-pine/80">
            <Clover className="h-4 w-4 text-leaf" />
            {TAGLINE}
          </p>
          <h1 className="relative font-display text-5xl font-bold leading-[1.05] sm:text-6xl">
            Your lucky private court is waiting. Book it in under a minute.
          </h1>
          <p className="relative mt-5 max-w-md text-lg text-pine/75">
            One private court, open 8 AM to 1 AM (last slot ends at 1 AM). Pick a time, scan our GCash or Maya QR to pay, and we email your confirmation once it is approved. Good luck on court.
          </p>
          <div className="relative mt-7 flex flex-wrap items-center gap-4">
            <a href="#book" className="rounded-full bg-court px-7 py-3.5 font-display text-lg font-semibold text-white shadow-lg transition hover:bg-pine">
              See open times
            </a>
            <span className="text-pine/70">From {peso(PRICE_PER_HOUR)} per hour</span>
          </div>
        </div>
        <div className="relative">
          <Photo src={IMAGES.hero} alt="Player on a pickleball court" className="aspect-[4/5] rounded-[2rem] shadow-2xl" position="center 40%" />
          <div className="glass absolute -bottom-5 left-4 right-4 rounded-2xl p-4 sm:left-auto sm:right-[-1rem] sm:w-64 ring-2 ring-yellow-200/60">
            <div className="flex items-center gap-2 font-display font-semibold">
              <Clover className="h-4 w-4 text-court" />
              Lucky slot held for 10 minutes
            </div>
            <div className="text-sm text-pine/70">Nobody can take your time while you pay.</div>
            </div>
          </div>
        </div>
      </section>

      <section id="book" className="relative mx-auto max-w-6xl scroll-mt-24 px-5 pb-16">
        <div className="absolute -left-16 top-6 hidden h-40 w-40 rounded-full bg-blue-200/20 blur-3xl lg:block"></div>
        <div className="absolute -right-12 top-10 hidden h-44 w-44 rounded-full bg-red-200/20 blur-3xl lg:block"></div>
        <h2 className="relative mb-6 flex items-center gap-3 font-display text-3xl font-bold">
          <Clover className="h-7 w-7 text-leaf" />
          Pick your lucky time
        </h2>
        <Booking />
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-20 sm:grid-cols-3">
        {[
          { k: "players", t: "Play with friends", s: "Doubles-ready private court" },
          { k: "paddles", t: "Rent paddles", s: "Ask at the front desk" },
          { k: "balls", t: "Private & lucky", s: "Your court, your time, four-leaf luck" },
        ].map((x) => (
          <div key={x.k} className="glass overflow-hidden rounded-3xl">
            <Photo src={IMAGES[x.k as keyof typeof IMAGES]} alt={x.t} className="h-48" />
            <div className="p-5"><div className="font-display text-lg font-semibold">{x.t}</div><div className="text-sm text-pine/70">{x.s}</div></div>
          </div>
        ))}
      </section>

      <section id="location" className="mx-auto grid max-w-6xl gap-6 px-5 pb-20 md:grid-cols-[0.8fr_1.2fr]">
        <div className="glass flex flex-col justify-center rounded-3xl p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-court">Find us</p>
          <h2 className="mt-2 font-display text-3xl font-bold">{LOCATION.name}</h2>
          <p className="mt-3 text-sm leading-relaxed text-pine/70">{LOCATION.address}</p>
          <a href={MAPS_URL} target="_blank" rel="noreferrer"
            className="mt-5 inline-flex w-fit rounded-full bg-court px-5 py-3 text-sm font-semibold text-white transition hover:bg-pine">
            Open in Google Maps
          </a>
        </div>
        <div className="glass overflow-hidden rounded-3xl p-2">
          <iframe title={`${LOCATION.name} on Google Maps`} src={MAPS_EMBED_URL} loading="lazy"
            referrerPolicy="no-referrer-when-downgrade" className="h-72 w-full rounded-2xl border-0 sm:h-80" />
        </div>
      </section>

      <footer className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 pb-10 text-center text-sm text-pine/60">
        <span className="flex items-center gap-2">
          <Clover className="h-4 w-4 text-leaf/70" />© {new Date().getFullYear()} {BRAND} · Good luck on court
        </span>
        <a href="/admin" className="underline decoration-leaf/40 underline-offset-4 transition hover:text-pine">Admin</a>
      </footer>
    </main>
  );
}
