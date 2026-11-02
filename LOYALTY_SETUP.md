# URAVAI points and bills

The GitHub Pages site contains the customer and admin interfaces. Private customer data and bill PDFs must live in a Supabase project; the public repository must never contain the admin password, secret keys, phone numbers, or invoices.

## Live service

- The `URAVAI` project in the ELLOLING Supabase organization has project ref `igofbgeyanaaoazldufk`.
- The SQL migration has been applied, the `loyalty` Edge Function has been deployed, and `ADMIN_PASSWORD` is stored as a Supabase Edge Function secret.
- `assets/loyalty-config.js` contains only the public function URL and publishable API key. Supabase's gateway accepts that key before the function performs its own customer or admin verification.
- `account.html` shows real balances and bills only after phone and access-code verification. It does not create sample customer data.
- `uravaiadmin.html` is unlinked and marked `noindex`; its password is checked in the Edge Function.

## Deploy or redeploy the service

1. Create or connect the URAVAI Supabase project.
2. Apply `supabase/migrations/20261101000000_loyalty.sql`. It creates private customers, orders, and rate-limit tables, plus the private `uravai-bills` Storage bucket.
3. Deploy `supabase/functions/loyalty/index.ts` with `supabase/config.toml`. The function handles admin login, order entry, access-code resets, customer lookup, and short-lived signed PDF downloads.
4. Set the following **server-side** project secret. Do not add its value to GitHub:

   - `ADMIN_PASSWORD` — admin password.

   The admin username defaults to `uravaiadmin`. `RUPEES_PER_POINT` defaults to `10`, so one point is earned for every full ₹10 spent. The function derives separate signing keys from Supabase's default server-only secret key. Optional `ADMIN_USER`, `RUPEES_PER_POINT`, `ADMIN_SESSION_SECRET`, and `ACCESS_PEPPER` overrides can be set if needed. If the default server key is rotated without overrides, existing customer access codes must be reissued.

5. Set both public URL values in `assets/loyalty-config.js` to `https://<project-ref>.supabase.co/functions/v1/loyalty` and add the project's publishable API key. The URL and publishable key are safe to put in the frontend; the secret key and admin password are not.
6. Add a real order with a final bill PDF in the admin page. A new customer's private access code is shown once. Share it with the customer through the order conversation; they then use their phone and code to see points and download bills.

The admin page's unlisted address is a convenience, not a security control. The password is verified by the Edge Function; customer codes are checked server-side. Database tables and the bill bucket have no direct public access.

## Order and points behavior

- Each order number is unique. Points are calculated server-side as `floor(order amount / RUPEES_PER_POINT)`.
- Points balance is the sum of the customer's recorded order points. Redemption and refunds need a separate rule before they are added.
- Bills are uploaded as PDFs smaller than 6 MB. The customer receives download links that expire after five minutes. Missing PDFs are shown as unavailable and can be supplied by the team.
- A lost customer access code can be replaced in the admin page; the previous code stops working.

## Verification

The live function's CORS preflight and invalid customer/admin credentials have been checked. Add one clearly labeled test order and bill, verify phone/code access and PDF download from the live site, then delete the test records and PDF from the project. Do not show sample points as real customer data.
