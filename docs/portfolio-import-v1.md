# Portfolio Import v1

## Scope

Lot 4C adds a reviewed import workflow for generic CSV and XLSX broker exports. The original file is parsed server-side and is not stored. A temporary normalized session is stored in Supabase until confirmation, then its rows are deleted after an atomic commit.

## Workflow

`Upload → Parse → Detect columns → Map columns → Normalize → Resolve assets → Validate → Preview → Confirm → Recalculate`

The existing manual transaction form remains available. Both paths ultimately insert the same `transactions` rows consumed by `listTransactions`, `calculatePositions` and the portfolio valuation services.

## Architecture

- `parser.ts`: CSV delimiter/encoding handling and XLSX sheet reading with formulas/macros not executed;
- `column-detector.ts`: deterministic English/French header matching;
- `number.ts` and `date.ts`: locale-aware numeric parsing and conservative date parsing;
- `normalizer.ts`: converts source rows into `NormalizedImportedTransaction`;
- `asset-resolver.ts`: ISIN, existing asset, ticker/context and provider search resolution;
- `validator.ts`: row states, warnings and deterministic duplicate fingerprints;
- `service.ts`: authenticated preview session orchestration;
- `/api/portfolio/import/preview`: parse, normalize, resolve and persist a temporary session;
- `/api/portfolio/import/commit`: authenticated atomic database commit;
- `commit_portfolio_import`: Supabase `SECURITY DEFINER` function that validates ownership, creates missing assets, skips selected duplicates and inserts transactions in one transaction.

## Supported formats

Generic `.csv` supports comma, semicolon and tab delimiters, UTF-8 and a Windows-1252 fallback. `.xlsx` supports multiple sheets; the user chooses the relevant sheet. The maximum upload size is 10 MB.

Supported transaction operations are `BUY` and `SELL`. Dividends, interest, transfers, splits, fees, cash and deposits/withdrawals are explicitly marked unsupported and never silently converted.

## Mapping and normalization

The detector recognizes common French and English variants for date, type, ticker, ISIN, name, exchange, quantity, price, currency, FX rate and fees. Duplicate field mappings are prevented in the UI. Unknown or ambiguous dates, missing currencies, invalid quantities/prices and missing FX rates are shown before import.

Fractional shares are preserved. Historical prices remain in their original transaction currency. For a non-EUR/base-currency transaction, an explicit `FX rate to base` column is required because the existing calculation engine requires a historical conversion rate; the importer never substitutes zero or silently uses an unrelated current rate.

## Asset resolution

Resolution order:

1. exact ISIN in the existing asset table;
2. existing ticker constrained by exchange/currency context;
3. provider search through `MarketDataProvider`;
4. explicit user choice when candidates remain ambiguous.

Ticker-only ambiguity is never silently resolved. Confidence is rule-based (`HIGH`, `MEDIUM`, `LOW`) and is displayed with the preview.

## Duplicates and atomicity

Possible duplicates compare the authenticated portfolio, asset, operation, quantity, price, currency and transaction date. Repeated rows inside the same import are also flagged. The user can skip duplicates or explicitly import them. Rows with errors/unsupported operations are ignored and counted; valid rows are committed atomically.

## Security

Authentication is mandatory. File extensions and content are validated server-side; MIME type is not trusted. File names are sanitized, raw files are not logged or stored, import sessions and rows have strict user-scoped RLS, and the commit function derives the user from `auth.uid()` rather than client input. Service-role access is not used in client components.

## Limitations and future extensions

The first version is broker-neutral. Revolut-style exports are covered by the generic parser when their columns are mapped, but no broker-specific preset is hardcoded yet. PDF statements, broker APIs, dividends, transfers, splits, historical ECB FX lookup and permanent import history remain future extensions.
