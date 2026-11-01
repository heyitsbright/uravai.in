# URAVAI points and bills

The GitHub Pages site contains the customer and admin interfaces. Private customer data and bill PDFs must live in a Supabase project; the public repository must never contain the admin password, secret keys, phone numbers, or invoices.

## Current state

- `account.html` uses a WhatsApp request while the private service URL is empty. It does not display invented balances or bills.
- `uravaiadmin.html` is unlinked and marked `noindex`; login remains unavailable until the private service is configured.
- The SQL migration and Edge Function under `supabase/` are ready to deploy to a connected project.

## Connect the service

1. Create or connect the URAVAI Supabase project.
2. Apply `supabase/migrations/20261101000000_loyalty.sql`. It creates private customers, orders, and rate-limit tables, plus the private `uravai-bills` Storage bucket.
3. Deploy `supabase/functions/loyalty/index.ts` with `supabase/config.toml`. The function handles admin login, order entry, access-code resets, customer lookup, and short-lived signed PDF downloads.
4. Set the following **server-side** project secrets. Do not add their values to GitHub:

   - `ADMIN_USER` — admin username.
   - `ADMIN_PASSWORD` — admin password.
   - `ADMIN_SESSION_SECRET` — at least 32 random characters.
   - `ACCESS_PEPPER` — at least 32 other random characters.
   - `RUPEES_PER_POINT` — the number of whole rupees needed to earn one point; the current draft default is `100` until URAVAI confirms the rewards rule.

5. Set both public URL values in `assets/loyalty-config.js` to `https://<project-ref>.supabase.co/functions/v1/loyalty`. This URL is safe to publish; it is not a secret.
6. Add a real order with a final bill PDF in the admin page. A new customer's private access code is shown once. Share it with the customer through the order conversation; they then use their phone and code to see points and download bills.

The admin page's unlisted address is a convenience, not a security control. The password is verified by the Edge Function; customer codes are checked server-side. Database tables and the bill bucket have no direct public access.

## Order and points behavior

- Each order number is unique. Points are calculated server-side as `floor(order amount / RUPEES_PER_POINT)`.
- Points balance is the sum of the customer's recorded order points. Redemption and refunds need a separate rule before they are added.
- Bills are uploaded as PDFs smaller than 6 MB. The customer receives download links that expire after five minutes. Missing PDFs are shown as unavailable and can be supplied by the team.
- A lost customer access code can be replaced in the admin page; the previous code stops working.

## Before launch

Confirm the earning rule and customer verification method, connect the project, deploy the migration and function, then test one admin order and one customer lookup on the live site. Keep test customer records separate from real orders and delete them through the project console after verification.
