import Link from "next/link";
import Clover from "@/components/Clover";
import { courtName, hourLabel, peso } from "@/lib/config";
import { getBooking, type Status } from "@/lib/store";

export const dynamic = "force-dynamic";

const COPY: Record<Status, { title: string; text: string }> = {
  awaiting_review: {
    title: "Payment submitted",
    text: "We're checking your payment. You'll get a confirmation email once an admin approves your booking. Your slot stays reserved while we review.",
  },
  approved: {
    title: "You're booked - lucky you!",
    text: "Your payment was approved and your confirmation email is on its way. See you on court!",
  },
  rejected: {
    title: "Booking not approved",
    text: "We couldn't verify that payment. Please book again or contact us with your payment reference number.",
  },
  cancelled: {
    title: "Reservation cancelled",
    text: "This approved reservation was cancelled and its time slot has been released. Contact Lucky Paddle if you have questions about the cancellation or refund policy.",
  },
  held: {
    title: "Booking submitted",
    text: "Your booking is being submitted. Please wait a moment and check your email for the confirmation.",
  },
};

export default async function Success({ searchParams }: { searchParams: { id?: string } }) {
  const booking = searchParams.id ? await getBooking(searchParams.id) : undefined;
  const copy = booking ? COPY[booking.status] : COPY.awaiting_review;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg items-center px-5">
      <div className="glass w-full rounded-3xl p-8 text-center">
        <Clover className="mx-auto h-10 w-10 text-leaf" />
        <h1 className="mt-3 font-display text-4xl font-bold">{copy.title}</h1>
        <p className="mt-3 text-pine/75">{copy.text}</p>
        {booking && (
          <div className="mt-6 rounded-2xl bg-white/70 p-5 text-left">
            <div>{courtName(booking.court)} · {booking.date}</div>
            <div className="font-display text-xl">
              {hourLabel(booking.hour)} - {hourLabel(booking.hour + booking.duration)}
            </div>
            <div className="mt-1 text-sm text-pine/70">
              {booking.duration} hour{booking.duration > 1 ? "s" : ""} · {peso(booking.amount)}
            </div>
            {((booking.paddles ?? 0) > 0 || (booking.balls ?? 0) > 0) && (
              <div className="mt-1 text-sm text-pine/70">
                Add-ons: {booking.paddles ?? 0} paddle{(booking.paddles ?? 0) === 1 ? "" : "s"}, {booking.balls ?? 0} ball{(booking.balls ?? 0) === 1 ? "" : "s"}
              </div>
            )}
            <div className="mt-1 text-sm text-pine/70">
              Ref {booking.reference ?? booking.id.slice(0, 8).toUpperCase()}
            </div>
          </div>
        )}
        <Link href="/" className="mt-6 inline-block rounded-full bg-pine px-6 py-3 font-medium text-white">
          Back to Lucky Paddle
        </Link>
      </div>
    </main>
  );
}
