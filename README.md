# Lucky Paddle - court booking (Next.js 14, TypeScript, Tailwind, Supabase)

One private court. Four-leaf luck. Players pick a slot, pay by QR, and get a confirmation email
once an admin approves the payment. Named admin accounts let the owner manage staff access and
see who approved or rejected each booking.

## Features

- 10-minute slot holds with a live countdown (double-booking is blocked by the database)
- Multi-hour bookings with time-based rates (default: 8 AM-noon ₱350, noon-5 PM ₱500, 5 PM-1 AM ₱600); bookings of 3+ hours receive ₱50 off each eligible hour after noon (the morning rate is excluded)
- Paddle and ball add-ons, limited by the inventory you set in admin
- GCash QR payment with a payment reference number
- Admin approval queue; the confirmation email is sent **only when an admin approves**
- Admins can either mark an approved customer booking as cancelled (retaining its audit record) or permanently delete it; both release the slot and email the customer. Refunds are not automatic and follow the stated non-refundable policy.
- Separate owner/admin accounts, scrypt password hashes, immediate account deactivation, and reviewer audit history
- Self-service username and password changes in admin settings; password changes revoke existing sessions
- Admin dashboard: revenue, pending approvals, today's occupancy, schedule, all bookings
- Admin-created reservations that immediately block customer bookings
- Block time for maintenance/private events
- Payment receipt upload with private Supabase Storage
- Editable time-based rates and rate tiers
- Inventory management
- All data persisted in Supabase (Postgres)

## Run it

```bash
npm install
cp .env.example .env.local
npm run dev          # http://localhost:3000
```

With no `BREVO_API_KEY` or `RESEND_API_KEY`, confirmation emails are logged to the terminal instead of sent.

## Set up the database (Supabase, free)

1. Create a project at [supabase.com](https://supabase.com) (free plan).
2. Open **SQL Editor**, paste the contents of `supabase/schema.sql`, and click **Run**.
   This creates `admin_users`, `bookings`, `blocks`, `inventory` and `app_settings`, plus the overlap
   constraints that prevent double booking. Re-run it on existing installations to add missing
   booking audit and cancellation fields and admin-user support.
   Admin login remains compatible with installations that have not yet added
   `admin_users.session_version`; run the latest schema before using password changes and
   cross-device session revocation.
3. Open **Project Settings > API** and copy:
   - **Project URL** into `NEXT_PUBLIC_SUPABASE_URL`
   - **service_role** key into `SUPABASE_SERVICE_ROLE_KEY` (keep it secret, server-side only)
4. Set `ADMIN_BOOTSTRAP_USERNAME`, a unique `ADMIN_BOOTSTRAP_PASSWORD` (at least 12 characters),
   and a long random `ADMIN_SESSION_SECRET`. The first successful login creates the owner account
   if `admin_users` is empty. The bootstrap password is not used after that account exists.
5. Set `NEXT_PUBLIC_APP_URL` to your URL (use `http://localhost:3000` locally).

The tables have Row Level Security enabled and no public policies, so only the server with the
service role key can read or write them.

## QR payment

The GCash QR image is `public/gcash-qr.png`; its path is set by `QR_IMAGE` in `src/lib/config.ts`.

Flow:

1. Player picks a date and time range. The slot is held for 10 minutes.
2. Player scans the GCash QR, pays, and enters name, email, phone and the payment reference number.
3. The booking moves to `awaiting_review` and stays reserved.
4. Admin opens `/admin`, checks the reference, and clicks **Approve & email** or **Reject**.
   Approving sends the confirmation email; rejecting frees the slot.

## Admin

Open `http://localhost:3000/admin` and sign in with your username and password. In local development,
the initial account defaults to `owner` / `luckypaddle` unless bootstrap variables are configured.
Before deploying, configure a strong unique bootstrap password and run the latest schema. Once signed
in as the owner, add individual staff accounts at `/admin/users`; admins cannot manage other users.
Deactivating an account revokes its access immediately. The dashboard records the reviewer name and
timestamp on each approved or rejected booking. Sign-in attempts are throttled per username and IP.

- `/admin` - approvals, stats, schedule, all bookings
- `/admin/settings` - change your own admin username and password
- `/admin/users` - add or deactivate individual admin accounts (owner only)
- `/admin/reserve` - create/cancel admin reservations or block time from the two tabs
- `/admin/rate` - time-based rates and tiers
- `/admin/inventory` - paddles and balls available

The public map and directions use the exact Google Maps pin for Lucky Paddle Pickleball Court at
Cogon Drive, Pardo, Cebu City. Payment is handled by the venue's QR workflow; this project does not
integrate PayMongo.

## Email (Brevo, free)

Confirmation emails go through [Brevo](https://www.brevo.com). You can use your existing address
(for example a Proton address) without buying a domain. The free plan allows 300 emails per day.

1. Create a free Brevo account.
2. Go to **Senders & IPs > Senders**, add your email address, and enter the 6-digit code Brevo
   sends you.
3. Go to **SMTP & API > API Keys**, create a key, and copy it.
4. Set these in `.env.local` (and in Vercel):
   - `BREVO_API_KEY` - the key you copied
   - `EMAIL_FROM` - `Lucky Paddle <you@proton.me>`
   - `EMAIL_REPLY_TO` - `you@proton.me`

Because `proton.me` (and other free-mail domains) cannot be authenticated with SPF/DKIM, Brevo may
rewrite the From domain to `@brevosend.com` to keep the message deliverable. The sender name stays
`Lucky Paddle`, and `EMAIL_REPLY_TO` sends replies to your real inbox. For a clean From address,
verify a domain you own.

If you later buy a domain, verify it at [resend.com/domains](https://resend.com/domains), set
`RESEND_API_KEY` and `EMAIL_FROM` to an address on that domain, and leave `BREVO_API_KEY` empty.
Without either key, emails are only logged in the terminal.

## Deploy to Vercel (free)

1. Push the project to GitHub and import it in Vercel.
2. Add every variable from `.env.example` in **Project Settings > Environment Variables**.
3. Set `NEXT_PUBLIC_APP_URL` to your live URL and redeploy.

## Where things are

- `supabase/schema.sql` - database tables and constraints
- `src/lib/config.ts` - brand, court, hours, rates, hold minutes, QR image
- `src/lib/store.ts` - all Supabase reads/writes
- `src/lib/admin-auth.ts` - signed admin session cookie
- `src/app/api/hold` - 10-minute slot hold
- `src/app/api/submit` - QR payment submission for approval
- `src/app/api/admin/bookings` - approve/reject and send email
- `src/app/api/admin/dashboard` - dashboard stats and schedule
- `src/app/api/admin/block`, `rate`, `inventory` - admin tools
- `src/components/Booking.tsx` - booking UI with QR and countdown
