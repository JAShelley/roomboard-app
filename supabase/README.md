# Supabase Setup Notes

1. Create a Supabase project.
2. Open the SQL editor and run `schema.sql`.
3. Run `billing.sql` after `schema.sql` to add the 14-day trial, Stripe subscription fields, billing access helpers, and live-board RLS gates.
4. For this MVP, disable email confirmation in Auth so the signup flow returns an active session immediately.
5. Copy `.env.local.example` to `.env.local` and add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
   - `STRIPE_PRICE_MONTHLY`
   - `STRIPE_PRICE_ANNUAL`
6. Start the app and test:
   - create a practice
   - log in
   - confirm the billing card shows trial/subscription status
   - start Stripe Checkout from monthly and annual buttons
   - add rooms and doctors
   - confirm the board placeholder only shows the current practice

Create a Stripe webhook endpoint for:

```text
https://your-domain.com/api/billing/webhook
```

Subscribe it to checkout session completion and customer subscription lifecycle events so RoomBoard can mirror subscription status back to Supabase.

The base schema is intentionally small:
- `practices`
- `profiles`
- `rooms`
- `doctors`

All data access in the MVP is designed around `practice_id` scoping so the future live board can stay in the same shared app.
