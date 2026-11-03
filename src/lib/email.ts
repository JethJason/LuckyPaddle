import { BRAND, courtName, hourLabel, peso } from "./config";
import type { Booking } from "./store";

type Sender = { name: string; email: string };

function parseSender(value: string | undefined): Sender | null {
  if (!value) return null;
  const trimmed = value.trim();
  const match = trimmed.match(/^(.*?)\s*<([^>]+)>$/);
  if (match) {
    const name = match[1].trim() || BRAND;
    const email = match[2].trim();
    return email ? { name, email } : null;
  }
  return trimmed.includes("@") ? { name: BRAND, email: trimmed } : null;
}

async function deliverEmail(to: string, subject: string, html: string, purpose: string): Promise<boolean> {
  if (process.env.BREVO_API_KEY) {
    const sender = parseSender(process.env.EMAIL_FROM);
    if (!sender) {
      console.error(`[email] BREVO_API_KEY is set but EMAIL_FROM is missing or invalid; ${purpose} was not sent.`);
      return false;
    }
    try {
      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "api-key": process.env.BREVO_API_KEY,
        },
        body: JSON.stringify({
          sender,
          to: [{ email: to }],
          replyTo: { email: process.env.EMAIL_REPLY_TO || sender.email },
          subject,
          htmlContent: html,
        }),
      });
      if (!res.ok) {
        console.error(`[email] Brevo rejected the ${purpose} message (${res.status}): ${await res.text()}`);
        return false;
      }
      return true;
    } catch (error) {
      console.error(`[email] Could not send the ${purpose} through Brevo:`, error);
      return false;
    }
  }

  if (!process.env.RESEND_API_KEY) {
    console.log(`[email placeholder] would send ${purpose} to ${to}`);
    return false;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.RESEND_API_KEY}` },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? `${BRAND} <onboarding@resend.dev>`,
        to: [to], subject, html,
      }),
    });
    if (!res.ok) {
      console.error(`[email] Resend rejected the ${purpose} message (${res.status}): ${await res.text()}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[email] Could not send the ${purpose} through Resend:`, error);
    return false;
  }
}

/** Sends the confirmation through Brevo, or Resend when only a Resend key is set. */
export async function sendConfirmation(b: Booking): Promise<boolean> {
  if (!b.email) return false;
  const html = `<div style="font-family:system-ui;max-width:480px;margin:auto;padding:24px;background:#f1fbf4;border-radius:16px">
    <h2 style="color:#0b3d2a;margin:0 0 8px">You're booked, ${b.name ?? "player"}!</h2>
    <p style="color:#14532d">Your payment was verified and your booking is approved. See you on court!</p>
    <table style="width:100%;color:#0b3d2a;font-size:15px">
      <tr><td>Court</td><td align="right"><b>${courtName(b.court)}</b></td></tr>
      <tr><td>Date</td><td align="right"><b>${b.date}</b></td></tr>
      <tr><td>Time</td><td align="right"><b>${hourLabel(b.hour)} – ${hourLabel(b.hour + b.duration)}</b></td></tr>
      <tr><td>Paid</td><td align="right"><b>${peso(b.amount)}</b></td></tr>
      ${(b.paddles ?? 0) > 0 ? `<tr><td>Paddles</td><td align="right">${b.paddles}</td></tr>` : ""}
      ${(b.balls ?? 0) > 0 ? `<tr><td>Balls</td><td align="right">${b.balls}</td></tr>` : ""}
      <tr><td>Payment ref</td><td align="right">${b.reference ?? "-"}</td></tr>
      <tr><td>Booking ref</td><td align="right">${b.id.slice(0, 8).toUpperCase()}</td></tr>
    </table>
    <p style="color:#166534;font-size:13px">Please arrive 10 minutes early. Good luck on court! — ${BRAND}</p></div>`;

  const subject = `Booking confirmed · ${courtName(b.court)}, ${b.date} ${hourLabel(b.hour)}`;
  return deliverEmail(b.email, subject, html, "confirmation");
}

/** Notifies a customer when their booking request is rejected and its time is released. */
export async function sendRejection(b: Booking): Promise<boolean> {
  if (!b.email) return false;
  const html = `<div style="font-family:system-ui;max-width:480px;margin:auto;padding:24px;background:#f1fbf4;border-radius:16px">
    <h2 style="color:#0b3d2a;margin:0 0 8px">Booking request update</h2>
    <p style="color:#14532d">Hi ${b.name ?? "there"}, unfortunately we couldn't approve your booking request. The time below has been released and is available for others to book.</p>
    <table style="width:100%;color:#0b3d2a;font-size:15px">
      <tr><td>Court</td><td align="right"><b>${courtName(b.court)}</b></td></tr>
      <tr><td>Date</td><td align="right"><b>${b.date}</b></td></tr>
      <tr><td>Time</td><td align="right"><b>${hourLabel(b.hour)} – ${hourLabel(b.hour + b.duration)}</b></td></tr>
      <tr><td>Booking ref</td><td align="right">${b.id.slice(0, 8).toUpperCase()}</td></tr>
    </table>
    <p style="color:#166534;font-size:13px">If you have questions or believe this was a mistake, please contact us. — ${BRAND}</p></div>`;

  const subject = `Booking request update · ${courtName(b.court)}, ${b.date} ${hourLabel(b.hour)}`;
  return deliverEmail(b.email, subject, html, "rejection notice");
}
