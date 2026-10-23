# Remaining database integration gaps

Current detailed status and run guide: root README.md. This updates the older report: Prisma schema, generated client, repositories and an existing singleton **are now present** after the database merge. None were edited by the backend integration work.

## Verified implementation

- Existing singleton: `server/config/db.js`, exported as `.prisma`; connection helper is the default export.
- Repositories: `server/repositories/index.js` and `BaseRepository.js`.
- Schema: Loan, Schedule, Payment, PaymentAllocation, Contact, Settlement, Score, AuditLog, OutboxEvent, AppConfig.
- Payment.externalReference is unique. Schedule has unique `(loanId, installmentNumber)`. PaymentAllocation has unique `(paymentId, scheduleId)`. These existing constraints are preserved.
- Account/stored-worklist/settlement-list/partial-dashboard/audit-summary/outbox-summary services use actual fields. Repository-fixture tests pass; PostgreSQL reads are not yet verified.

## Required teammate decisions/capabilities — no schema changes made

1. **Authentication:** no User model or external identity repository. Supply real login/identity/credential/active/role contract and exact four role values. Collector permissions/capacity cannot be inferred from assignedCollectorId alone. Do not invent `prisma.user` or user fields.
2. **Position:** Loan.principalAmount and Schedule principalDue/interestDue/totalDue are present, but no scheduled closing principal. Confirm the exact source/approved derivation for HCL closing principal rather than treating an unrelated balance as equivalent.
3. **Customers/holds:** Loan.isOnHold/holdReason/holdUntil exist; no Customer relation, dispute/deceased flags, city, branch or mobile destination. Confirm precise HOLD reason semantics, assignment scope and notification destination contract.
4. **Contacts:** schema uses VISIT and PROMISE_TO_PAY rather than normalized FIELD_VISIT/PTP; UNREACHABLE is not an enum value. Agree official outcome mappings, source contact identity/deduplication and atomic daily-limit/audit behavior. No contact write route is enabled yet.
5. **Settlements:** schema has PENDING/APPROVED/REJECTED/EXPIRED/CANCELLED. HCL requires proposal routing, AUTO_REJECTED, PAID and LAPSED distinctions; request-date dues/discount/approval route/approval-validity semantics need a verified storage contract. Existing proposedBy/checkedBy support maker-checker preflight, but full atomic transition + audit + letter remains blocked. Do not claim concurrent checker safety from preflight alone.
6. **Snapshots/assignment:** Loan stores only one current asOfDate and balances. No dated collection snapshot/queue/rank/manual-assignment/capacity history supports repeatable day-end and two-date roll rates. Score snapshots are AI-specific and must not be repurposed without agreement.
7. **Audit/outbox/config:** AuditLog, OutboxEvent and AppConfig exist. OutboxEvent.id is unique and could carry an agreed deterministic identity; agree reminder/letter payload and configuration key/version contracts before writes. No need to invent a new client or assume missing tables here.
8. **CSV/official rules:** supply official HCL document/config keys, actual CSV headers/files and 2,310-loan / 12-settlement expected outputs. No schema mappings are guessed from missing inputs.
9. **Safe test database:** DATABASE_URL and TEST_DATABASE_URL are not configured locally. The optional read-only integration test requires NODE_ENV=test, RECOVERPLUS_RUN_DB_TESTS=true and matching DATABASE_URL/TEST_DATABASE_URL. It was skipped; no database connectivity success is claimed.

Live auth and schema-dependent mutations fail closed with 503; missing bearer authentication returns 401. Existing database code/schema/migrations/sample config remain unchanged. No new Prisma client, database connection, migration, seed or database record was created.
