# Portfolio Removal v1

## SELL versus REMOVE

`SELL` is an economic event. It records that an investment was sold and keeps the transaction in the ledger so realized P/L and the transaction history remain auditable.

`REMOVE` is a data correction. It removes every transaction for one asset in one authenticated portfolio, regardless of whether the rows came from manual entry or the Portfolio Import workflow. It does not create a SELL transaction.

The confirmation modal explains this distinction and offers `Record a sale instead` so a genuine sale is not accidentally treated as a correction.

## Atomic, scoped operation

`POST /api/portfolio/positions/remove` accepts only a portfolio id and an asset id. The server obtains the authenticated session, and the `remove_portfolio_position` Supabase function verifies ownership with `auth.uid()` before deleting the scoped transaction rows in one database transaction.

The global `assets` catalogue is never deleted. A watchlist entry is not changed, and investment notes/theses remain available for the asset. A repeated removal returns a not-found result rather than succeeding silently.

The RPC is executable by `authenticated` only. The client cannot provide a user id as authority, and the existing RLS policies on transactions, watchlists, notes and snapshots remain unchanged.

## Recalculation and snapshots

Positions, portfolio valuation, P/L, allocation, health, attribution, scenarios and InvestmentContextService all rebuild from the remaining transaction ledger. Imported transactions require no special deletion path because they become normal `transactions` rows at commit time.

Existing `portfolio_snapshots` are immutable historical observations and are not backdated or deleted by a correction. This avoids rewriting a recorded observation after the fact. New/current calculations reflect the corrected ledger; the historical series may therefore retain observations that predate the correction. This limitation is intentional and remains visible through the snapshot timestamps and data quality fields.

Individual transaction editing/deletion is not part of this lot. The supported correction is removal of the complete position, with explicit confirmation.
