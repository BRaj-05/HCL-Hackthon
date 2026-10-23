# Express / PostgreSQL / Prisma API contract

The frontend contains no database connection. It expects the following REST contract from a separately implemented Express backend. The current repository server does not yet implement it.

Base URL: `VITE_API_BASE_URL`, default `http://localhost:5000/api/v1`. Enable the integration with `VITE_DEMO_MODE=false`.

## Transport and persistence conventions

- Authenticate protected requests with `Authorization: Bearer <JWT>`.
- Use stable string IDs (Prisma UUIDs are suitable). Every foreign key must reference an existing, authorized resource.
- Return success as `{ "data": value }` or the unwrapped value. Mutations may return HTTP 204.
- Use JSON for request/response bodies. CORS must allow the actual frontend origin, including `http://127.0.0.1:5173` if that is the Vite URL.
- Monetary values represent INR rupees; PostgreSQL `numeric` / Prisma `Decimal` values may be decimal strings. The frontend converts these at the DTO boundary for display. Calculate, round and store financial values on the backend using Decimal arithmetic.
- Return date-only business fields as YYYY-MM-DD. ISO timestamps are also accepted for date-only response fields and normalized to the first 10 characters. Return event instants as ISO 8601 with a timezone offset or Z. Business calendar: Asia/Kolkata.
- Keep record collections flat in the workspace response; Prisma relations should be projected to their IDs. All related loan IDs in the returned workspace must exist in its loans collection.
- Return authorized data only. A collector must never receive another collector's accounts or sensitive events. Auditors cannot mutate.
- The backend must own transactional imports, payment-reference uniqueness, maker-checker guards, hold/contact checks, idempotent batch operations, outbox delivery and append-only audit persistence.

Recommended Prisma model responsibilities: User, Loan, Schedule, Payment, Contact, Settlement, RuleConfig, Score, AuditEvent, OutboxEvent, BatchRun and ImportRecord. This is an API mapping guide, not an implemented database schema.

## Authentication

| Method | Route | Request | Response |
| --- | --- | --- | --- |
| POST | /auth/login | email, password | { user, token } |
| GET | /auth/me | — | User |
| POST | /auth/logout | {} | 204 or acknowledgment |

User: `{ id, name, email, role }`; role is COLLECTOR, MANAGER, HEAD or AUDITOR. The user supplied to the UI must come from the verified token/session, never from a role submitted by a live client.

## Workspace read model

GET `/workspace` returns the current authorized snapshot:

```json
{
  "data": {
    "asOf": "2026-10-23",
    "users": [],
    "loans": [],
    "schedules": [],
    "payments": [],
    "contacts": [],
    "settlements": [],
    "rules": [],
    "scores": [],
    "audit": [],
    "outbox": [],
    "runs": [],
    "imports": []
  }
}
```

The API should always supply these arrays (scores alone may be omitted). For a role without access to an operational collection, return an empty array. The frontend reloads this snapshot after successful mutations, and polls it every three seconds while a batch is Running.

| Collection | Record fields |
| --- | --- |
| users | id, name, email, role |
| loans | id, borrower, phone, city, product, principal, outstanding, dues, penal, dpd, bucket, collectorId, priority, strategy; optional holdUntil, holdReason |
| schedules | id, loanId, dueDate, amount, paid |
| payments | id, loanId, date, amount, reference, reconciled (boolean) |
| contacts | id, loanId, collectorId, channel, contactedAt, outcome, notes, consent (boolean); optional ptpAmount, ptpDate, ptpStatus |
| settlements | id, loanId, amount, dueDate, reason, makerId, createdAt, status; optional checkerId, decisionNote, decidedAt |
| rules | id, name, description, enabled (boolean) |
| scores | loanId, missProbability (0–1), expectedRecovery, reasons (string array, up to three) |
| audit | id, actor (display name), role, action, entity, at, detail |
| outbox | id, loanId, type, status, createdAt, attempts |
| runs | id, asOf, status, startedAt, completedAt, accounts, executions, steps: [{ name, status }] |
| imports | id, kind, fileName, rows, createdAt, actor |

Buckets may be Current, 1–30, 31–60, 61–90, 90+, or enum names CURRENT, DPD_1_30, DPD_31_60, DPD_61_90, DPD_90_PLUS.

Other display enums may be title case or their mapped uppercase values:

- priority: High, Medium, Low
- channel: Phone, SMS, Email, Visit
- contact outcome: Connected, No answer, Promise to pay, Dispute, Wrong number
- PTP: Pending, Kept, Broken
- settlement: Pending, Approved, Rejected, Paid, Expired
- batch/step: Running, Completed, Failed
- outbox: Queued, Sent, Failed

For uppercase contact outcomes use NO_ANSWER, PROMISE_TO_PAY and WRONG_NUMBER. Role enums always remain uppercase.

## Authorized mutations and exports

| Method | Route | Body / result |
| --- | --- | --- |
| POST | /contacts | loanId, channel, contactedAt, outcome, notes, consent; optional ptpAmount, ptpDate |
| POST | /settlements | loanId, amount, dueDate, reason |
| POST | /settlements/:id/decision | decision (Approved or Rejected), note |
| POST | /worklist/assign | loanIds: string[], collectorId |
| POST | /loans/:id/hold | until: YYYY-MM-DD or null, reason |
| POST | /payments/reconcile | {} |
| POST | /day-end/runs | asOf, idempotencyKey |
| POST | /imports | kind, fileName, rows: array of CSV row objects |
| PATCH | /rules/:id | enabled: boolean |
| POST | /outbox/:id/retry | {} |
| GET | /exports/collections | result: { csv: string } |
| GET | /exports/settlements | result: { csv: string } |

CSV kinds: loans, schedules, payments, contacts. Header definitions live in `src/lib/csv.js`. Uploads use parsed JSON rows, not multipart files. Import all rows in one database transaction, reject unknown relations or duplicate IDs/references, and return errors without partial insertion.

The browser validates basic formats; repeat all validation with Zod on Express. The backend sets collectorId, makerId, checkerId, audit actor, status and event timestamps from the authenticated user and authoritative server state.

Day-end must recalculate using eligible payments through asOf. Retrying a request must not duplicate allocation, penal charges, reminder delivery or export data. Use a stable account/date/type outbox key, record executions, and return a Running batch if processing is asynchronous. For an explicit recalculation of a previously completed date, the API may increment the existing run's execution counter. Do not log a delivery as Sent merely because an event was queued.

AI is optional: return scores only when available. The UI displays them and supports expected-recovery sorting. The Python model and R13 early-warning evaluation belong behind the API.

Export routes return JSON containing CSV text so the shared authenticated client can handle errors consistently. The backend should protect formula-like cells, use approved evaluation columns, and audit the export.

## Errors

```json
{
  "error": {
    "message": "Validation failed.",
    "fields": {
      "amount": ["Offer exceeds the outstanding balance."]
    }
  }
}
```

Use 401 for expired/invalid tokens, 403 for RBAC/ownership failures, 409 for conflicting state (duplicate payment, stale proposal, maker-checker collision), and 422 for Zod validation failures. The frontend shows these errors and preserves the current screen for correction; it never replaces a failing live response with demo data.
