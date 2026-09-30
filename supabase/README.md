# Supabase setup

The migrations in `migrations/20260930120000_data_foundation.sql`, `migrations/20260930150000_portfolio_intelligence.sql`, `migrations/20260930160000_fix_portfolio_snapshot_rls.sql` and `migrations/20260930170000_supabase_hardening.sql` create and secure the Lot 2 and Lot 3 data foundation.

## Apply manually

1. Create a Supabase project.
2. Configure Auth for the personal login method you want to use.
3. Apply all migrations in filename order with the Supabase CLI or the SQL editor.
4. Copy the project URL and publishable/anon key into `.env.local`.
5. Copy the server-only service-role key into `SUPABASE_SERVICE_ROLE_KEY` for reference-asset upserts.
6. Never put a service-role key in the browser or in a committed file.

The migration enables RLS on all tables. Personal tables are scoped through `auth.uid()` and portfolio ownership. Market data is treated as reference data and is read-only from the application client.

Positions are not stored in a table: they are rebuilt from `transactions` with the weighted-average method documented in `docs/data-model-v1.md`. The service-role key is used only by server route handlers to upsert shared `assets`; personal tables continue to use the authenticated user's RLS session.

Lot 3 adds snapshot currency metadata, investment-note review fields and the `asset_themes` classification table. The follow-up migrations grant authenticated users access to manage snapshots belonging to their own portfolios and harden function/index configuration. Apply all migrations in order.
