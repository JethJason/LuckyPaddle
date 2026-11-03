export const BRAND = "Lucky Paddle";
export const TAGLINE = "One private court. Four-leaf luck.";
export const COURTS = [{ id: 1, name: "Private Court" }];
export const courtName = (id: number) => COURTS.find((c) => c.id === id)?.name ?? `Court ${id}`;
export const OPEN_HOUR = 8; // 8:00 AM
export const CLOSE_HOUR = 25; // 1:00 AM next day (last booking can go to 1:00 AM)
export const PRICE_PER_HOUR = 500; // PHP
export const HOLD_MINUTES = 10;
export const PADDLE_RENT = 100; // PHP per paddle
export const BALLS_PRICE = 100; // PHP per ball

/** Multi-hour discount: book at least this many hours and save per hour. */
export const MULTI_HOUR_MIN = 3;
export const MULTI_HOUR_DISCOUNT = 50; // PHP off each hour

/** Maximum paddles one booking can rent. */
export const MAX_PADDLES = 4;

/** Bookings open on this date (Philippines time). */
export const BOOKING_START_DATE = "2026-11-08";
export const BOOKING_WINDOW_DAYS = 60;

/** Maximum block hours a player can book at once */
export const MAX_DURATION = 18;

/** Payment proof uploads (Supabase Storage). */
export const PROOF_BUCKET = "payment-proofs";
export const MAX_PROOF_BYTES = 4 * 1024 * 1024;

/** Your payment QR (GCash/Maya/bank). Replace public/qr.svg, or point this at another file in /public. */
export const QR_IMAGE = "/qr.svg";

/**
 * Photos. The hero is a verified free Unsplash photo (Aleksander Saks, Unsplash License).
 * The local SVGs are lightweight placeholders you can replace with real court photos.
 */
export const IMAGES = {
  hero: "/court.svg",
  players: "/players.svg",
  paddles: "/paddles.svg",
  balls: "/balls.svg",
  court: "/court.svg",
};

/** Update these with your exact court address and Google Maps search text. */
export const LOCATION = {
  name: "Lucky Paddle Court",
  address: process.env.NEXT_PUBLIC_LOCATION_ADDRESS || "Location details coming soon.",
  query: process.env.NEXT_PUBLIC_LOCATION_QUERY || "Lucky Paddle pickleball court",
};
export const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(LOCATION.query)}`;
export const MAPS_EMBED_URL = `https://www.google.com/maps?q=${encodeURIComponent(LOCATION.query)}&output=embed`;

export const BOOKABLE_HOURS = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + i);
export const END_HOURS = Array.from({ length: CLOSE_HOUR - OPEN_HOUR }, (_, i) => OPEN_HOUR + 1 + i);

export const hourLabel = (h: number) => {
  const normalized = ((h % 24) + 24) % 24;
  const display = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${display}:00 ${normalized < 12 ? "AM" : "PM"}`;
};
export const peso = (n: number) => `₱${n.toLocaleString("en-PH")}`;
