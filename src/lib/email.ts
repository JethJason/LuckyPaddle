import { ADMIN_URL, BRAND, PENDING_NOTIFY_EMAILS, courtName, hourLabel, peso } from "./config";
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

const escapeHtml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#39;");

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
  const name = escapeHtml(b.name?.trim() || "Player");
  const court = escapeHtml(courtName(b.court));
  const date = escapeHtml(b.date);
  const time = escapeHtml(`${hourLabel(b.hour)} – ${hourLabel(b.hour + b.duration)}`);
  const bookingRef = escapeHtml(b.id.slice(0, 8).toUpperCase());
  const details = [
    ["Court", court],
    ["Date", date],
    ["Time slot", time],
    ["Amount paid", peso(b.amount)],
    ...(typeof b.paddles === "number" && b.paddles > 0 ? [["Paddles", String(b.paddles)]] : []),
    ...(typeof b.balls === "number" && b.balls > 0 ? [["Balls", String(b.balls)]] : []),
  ] as const;
  const detailRows = details.map(([label, value]) => `
      <tr>
        <td style="padding:11px 0;border-bottom:1px solid #e8f1eb;color:#64776c;font-size:14px">${label}</td>
        <td align="right" style="padding:11px 0;border-bottom:1px solid #e8f1eb;color:#123d2c;font-size:14px;font-weight:700">${value}</td>
      </tr>`).join("");
  const tips = [
    "Please arrive a few minutes before your scheduled time so you can get settled and start playing promptly.",
    "Outside food and drinks are welcome; please enjoy them only in the designated lounge area.",
    "There is no corkage fee for food, snacks, or non-alcoholic drinks. Alcoholic drinks incur a corkage fee of ₱100 per bottle.",
    "If you plan to have a party setup, please inform us in advance. We strongly recommend booking an extra hour before your slot for setup and an extra hour after for cleanup.",
    "Food, snacks, and beverages, including alcoholic drinks, are also available for purchase at the venue.",
    "Please help keep the facility clean for everyone by practicing Clean As You Go before your time ends.",
    "Please take care of your personal belongings. Lucky Paddle is not liable for lost, stolen, or damaged items, or for injuries sustained while on the premises.",
    "All bookings are non-refundable, except in cases of severe weather calamities or unforeseen court maintenance issues.",
  ];
  // Bookings that run past 10:00 PM get a quiet-hours reminder (residential area).
  const QUIET_HOUR = 22;
  const lateNight = b.hour + b.duration > QUIET_HOUR;
  const noiseReminder = "Lucky Paddle is in a residential area. From 10:00 PM onward, please keep noise to a minimum (no loud music, shouting, or cheering) out of respect for our neighbors. Thank you!";
  const tipRows = tips.map((tip) => `
      <tr>
        <td valign="top" style="width:22px;padding:0 9px 12px 0;color:#31a56a;font-size:17px;line-height:20px">•</td>
        <td style="padding:0 0 12px;color:#425b4c;font-size:13px;line-height:20px">${tip}</td>
      </tr>`).join("");

  const html = `<!doctype html>
  <html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#edf5ef;font-family:Arial,Helvetica,sans-serif;color:#123d2c">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">Your pickleball reservation is confirmed. See your booking details and visit information inside.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#edf5ef">
      <tr><td align="center" style="padding:28px 12px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:620px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 12px 34px rgba(18,61,44,.12)">
          <tr><td style="padding:24px 30px;background:#123d2c;border-bottom:5px solid #cde95c">
            <div style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#cde95c">Lucky Paddle</div>
            <div style="margin-top:7px;color:#ffffff;font-size:25px;font-weight:700">Reservation confirmed!</div>
          </td></tr>
          <tr><td style="padding:28px 30px 12px">
            <p style="margin:0;color:#123d2c;font-size:17px;font-weight:700">Dear ${name},</p>
            <p style="margin:12px 0 0;color:#425b4c;font-size:14px;line-height:22px">Thank you for your reservation! Your payment of <strong style="color:#123d2c">${escapeHtml(peso(b.amount))}</strong> has been received and your booking is confirmed. We look forward to hosting your game!</p>
          </td></tr>
          <tr><td style="padding:12px 30px 24px">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="padding:4px 18px;background:#f4faf5;border:1px solid #e2eee5;border-radius:14px">
              ${detailRows}
              <tr><td style="padding:11px 0;color:#64776c;font-size:14px">Booking reference</td><td align="right" style="padding:11px 0;color:#123d2c;font-size:14px;font-weight:700">${bookingRef}</td></tr>
            </table>
          </td></tr>
          <tr><td style="padding:0 30px 8px">
            <div style="padding:15px 17px;border-radius:12px;background:#f0f8d9;color:#31552f;font-size:13px;line-height:20px"><strong>Quick reminder:</strong> Please arrive a few minutes early and enjoy outside food and drinks in the designated lounge area.</div>
          </td></tr>
          ${lateNight ? `<tr><td style="padding:8px 30px 8px">
            <div style="padding:15px 17px;border-radius:12px;background:#fff4e0;border:1px solid #f3d9a4;color:#7a4b00;font-size:13px;line-height:20px"><strong>Quiet hours from 10:00 PM:</strong> ${noiseReminder}</div>
          </td></tr>` : ""}
          <tr><td style="padding:20px 30px 8px">
            <h2 style="margin:0 0 15px;color:#123d2c;font-size:17px">Important information for your visit</h2>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${tipRows}</table>
          </td></tr>
          <tr><td style="padding:18px 30px 26px;background:#f4faf5;border-top:1px solid #e2eee5">
            <p style="margin:0;color:#425b4c;font-size:14px;line-height:21px">Need help before your reservation? Email us at <a href="mailto:luckypaddle@proton.me" style="color:#157448;font-weight:700;text-decoration:underline">luckypaddle@proton.me</a>.</p>
            <p style="margin:16px 0 0;color:#123d2c;font-size:14px;line-height:21px">Best regards,<br><strong>Lucky Paddle</strong></p>
          </td></tr>
        </table>
        <p style="margin:16px 0 0;color:#718278;font-size:11px;line-height:18px">This email confirms your reservation at ${escapeHtml(BRAND)}. Please keep it for your records.</p>
      </td></tr>
    </table>
  </body></html>`;

  const subject = "Pickleball Reservation Confirmed!";
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

/** Confirms cancellation of a previously approved booking and release of its time slot. */
export async function sendCancellation(b: Booking): Promise<boolean> {
  if (!b.email) return false;
  const name = escapeHtml(b.name?.trim() || "there");
  const reason = b.cancellationReason?.trim();
  const reasonLine = reason
    ? `<tr><td style="padding:11px 0;color:#64776c;font-size:14px">Reason</td><td align="right" style="padding:11px 0;color:#123d2c;font-size:14px;font-weight:700">${escapeHtml(reason)}</td></tr>`
    : "";
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:24px auto;padding:28px;background:#f4faf5;border:1px solid #e2eee5;border-radius:18px;color:#123d2c">
    <div style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#157448">${escapeHtml(BRAND)}</div>
    <h2 style="margin:8px 0 12px;color:#123d2c">Reservation cancelled</h2>
    <p style="color:#425b4c;line-height:1.6">Hi ${name}, your approved reservation has been cancelled as requested. The time slot has been released and is available for others to book.</p>
    <table style="width:100%;margin:18px 0;padding:8px 16px;background:#fff;border:1px solid #e2eee5;border-radius:12px;color:#123d2c;font-size:14px">
      <tr><td style="padding:11px 0;color:#64776c">Court</td><td align="right"><b>${escapeHtml(courtName(b.court))}</b></td></tr>
      <tr><td style="padding:11px 0;color:#64776c">Date</td><td align="right"><b>${escapeHtml(b.date)}</b></td></tr>
      <tr><td style="padding:11px 0;color:#64776c">Time</td><td align="right"><b>${escapeHtml(`${hourLabel(b.hour)} – ${hourLabel(b.hour + b.duration)}`)}</b></td></tr>
      ${reasonLine}
      <tr><td style="padding:11px 0;color:#64776c">Booking reference</td><td align="right"><b>${escapeHtml(b.id.slice(0, 8).toUpperCase())}</b></td></tr>
    </table>
    <p style="padding:14px 16px;background:#fff7e6;border-radius:10px;color:#6b542d;font-size:13px;line-height:1.6"><b>Refund policy:</b> Bookings are non-refundable except in cases of severe weather calamities or unforeseen court maintenance issues. This cancellation does not automatically issue a refund. Please contact us if you believe an exception applies.</p>
    <p style="margin-top:20px;color:#425b4c;font-size:14px;line-height:1.6">Questions? Email <a href="mailto:luckypaddle@proton.me" style="color:#157448">luckypaddle@proton.me</a>.<br><br>Best regards,<br><b>${escapeHtml(BRAND)}</b></p>
  </div>`;
  const subject = `Reservation cancelled · ${courtName(b.court)}, ${b.date} ${hourLabel(b.hour)}`;
  return deliverEmail(b.email, subject, html, "cancellation notice");
}

/** Tells staff (PENDING_NOTIFY_EMAILS) that a customer booking is waiting for approval. Never throws. */
export async function sendPendingApprovalNotice(b: Booking): Promise<boolean> {
  const recipients = PENDING_NOTIFY_EMAILS.filter((email) => email.includes("@"));
  if (!recipients.length) return false;
  try {
    const time = `${hourLabel(b.hour)} – ${hourLabel(b.hour + b.duration)}`;
    const row = (label: string, value: string | undefined) =>
      value
        ? `<tr><td style="padding:9px 0;color:#64776c">${label}</td><td align="right"><b>${escapeHtml(value)}</b></td></tr>`
        : "";
    const addOns = [b.paddles ? `${b.paddles} paddle${b.paddles === 1 ? "" : "s"}` : "", b.balls ? `${b.balls} ball${b.balls === 1 ? "" : "s"}` : ""]
      .filter(Boolean)
      .join(", ");
    const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:24px auto;padding:28px;background:#f4faf5;border:1px solid #e2eee5;border-radius:18px;color:#123d2c">
    <div style="font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#157448">${escapeHtml(BRAND)}</div>
    <h2 style="margin:8px 0 12px;color:#123d2c">New booking pending approval</h2>
    <p style="color:#425b4c;line-height:1.6">A customer submitted payment details. Please check the receipt and approve or reject the booking.</p>
    <table style="width:100%;margin:18px 0;padding:8px 16px;background:#fff;border:1px solid #e2eee5;border-radius:12px;color:#123d2c;font-size:14px">
      ${row("Name", b.name)}
      ${row("Email", b.email)}
      ${row("Phone", b.phone)}
      ${row("Court", courtName(b.court))}
      ${row("Date", b.date)}
      ${row("Time", time)}
      ${row("Add-ons", addOns || undefined)}
      ${row("Amount", peso(b.amount))}
      ${row("Payment reference", b.reference)}
      ${row("Booking ref", b.id.slice(0, 8).toUpperCase())}
    </table>
    <p style="margin:20px 0"><a href="${escapeHtml(ADMIN_URL)}" style="display:inline-block;padding:12px 20px;background:#157448;color:#fff;text-decoration:none;border-radius:10px;font-weight:700">Open admin</a></p>
  </div>`;
    const subject = `New booking pending approval – ${b.date} ${time}`;
    const results = await Promise.all(
      recipients.map((to) => deliverEmail(to, subject, html, "pending approval notice")),
    );
    return results.some(Boolean);
  } catch (error) {
    console.error("[email] Could not send the pending approval notice:", error);
    return false;
  }
}
