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

An exact provider ticker is accepted even when the provider does not return an instrument type. Provider search results are treated as data, not as a requirement that the asset already exists locally. For exchanges that encode the listing in the provider symbol (for example `VUAA.MI`), the resolver also considers suffix listings only when there is no bare exact result, then applies currency/exchange context. Multiple compatible listings stay in `NEEDS REVIEW` with visible candidates; they are never guessed. Confidence is rule-based (`HIGH`, `MEDIUM`, `LOW`) and is displayed with the preview.

Provider failures are distinct from an unknown ticker: `PROVIDER_ERROR`, `INVALID_SYMBOL`, `UNSUPPORTED_ASSET`, `AMBIGUOUS` and `NOT_FOUND` are retained in the normalized resolution. FMP search errors and empty search arrays are not written as negative cache entries, so a temporary quota/network failure cannot permanently hide a later recovery. Search cache data is identity metadata; quote and financial freshness remain governed by their own provider cache rules.

Preview status and row action are separate. `READY`, warnings and duplicates have no resolution action. `AMBIGUOUS` with candidates exposes `Choose asset`; `PROVIDER_ERROR` exposes `Retry` and never an empty asset selector. Selecting a candidate re-runs the same import session, persists the normalized row, and removes the action once the row is ready.

For Revolut's brokerage export, the ticker-only rows for `NVDA`, `ONON`, `KO`, `STX` and `AMZN` resolve to their unique USD provider matches when FMP is available. `VUAA` is returned by FMP as multiple compatible EUR listings (`VUAA.MI`, `VUAA.SG`, `VUAA.DE`), so the absence of an exchange/ISIN in the export correctly requires one manual choice. That choice is persisted as the canonical asset at commit and is reused by subsequent imports through the existing-asset-first lookup.

## Duplicates and atomicity

Possible duplicates compare the authenticated portfolio, asset, operation, quantity, price, currency and transaction date. Repeated rows inside the same import are also flagged. The user can skip duplicates or explicitly import them. Rows with errors/unsupported operations are ignored and counted; valid rows are committed atomically.

## Security

Authentication is mandatory. File extensions and content are validated server-side; MIME type is not trusted. File names are sanitized, raw files are not logged or stored, import sessions and rows have strict user-scoped RLS, and the commit function derives the user from `auth.uid()` rather than client input. Service-role access is not used in client components.

## Limitations and future extensions

The importer remains generic, with a lightweight `Revolut Brokerage` preset layered on the same parser/normalizer/resolver pipeline. The preset is detected from the standard combination of `Date`, `Ticker`, `Type`, `Quantity`, `Price per share`, `Total Amount`, `Currency` and `FX Rate` headers. It maps `BUY - MARKET`/`SELL - MARKET`, extracts currency prefixes such as `USD 230.20`, preserves Revolut FX rates and excludes clearly identified `CASH TOP-UP`/`CASH WITHDRAWAL` operations from the transaction preview. The preview reports the number of cash operations ignored.

Need review is reserved for a real unresolved condition: ambiguous or missing asset resolution, ambiguous dates, unsupported currencies, missing required fields or invalid values. A unique ticker result from the existing asset catalogue/provider is marked ready with high deterministic confidence. PDF statements, broker APIs, dividends, transfers, splits, historical ECB FX lookup and permanent import history remain future extensions.
