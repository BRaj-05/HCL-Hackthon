# Database integration gaps

The PostgreSQL/Prisma schema, generated client configuration, repositories, and initial migration now exist in this project. The HTTP routes are intentionally still blocked until the remaining domain requirements below are agreed and mapped; do not guess these rules from incomplete source data.

1. Users: stable ID, exact role values, password hash/credential verification method, active state; collector queue/city permissions and capacity.
2. Loans/customers: stable loan/customer IDs, principal Decimal, city/branch/product, mobile, dispute/deceased flags; schedule instalment number, due date, EMI and closing principal.
3. Payments: unique source payment ID, loan relation, business payment date, Decimal amount, import provenance. Contacts: unique source contact ID, actor/loan, timestamp, type/outcome and PTP date/amount.
4. Settlement: unique source request ID, loan/proposer, request date, offer/dues/discount, route/status, checker, approved timestamp/business date, validity end. Status-conditional update and audit/letter insertion must share one Prisma transaction. Exact timestamp/date cutoff requires official HCL rules.
5. Snapshots: unique `(loanId, asOfDate)` with calculated position/rules/rank. Assignment identity, collector, manual flag; atomic capacity/contact-limit enforcement mechanism.
6. Append-only audit events, including blocked contacts; deterministic unique outbox/letter identity; versioned official rules configuration; import metadata and validated persisted source rows.
7. Safe separate test PostgreSQL database and credentials provided through existing configuration, with permission to test concurrency, duplicate imports and idempotent reruns.

Also missing: official config JSON/keys, HCL CSV headers/files and expected samples. Once supplied, map the schema to the finalized fields and verify constraints before claiming idempotency or race safety.
