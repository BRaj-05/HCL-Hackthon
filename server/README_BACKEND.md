# RecoverPlus backend

Express backend for the RecoverPlus collections workflow. The project includes a PostgreSQL database layer built with Prisma, plus pure collection-engine utilities and route placeholders for future API integration.

## Run locally

Create a local `.env` from `.env.sample` and set your PostgreSQL or Supabase connection string:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE?schema=public"
```

Then use:

```powershell
npm install
npm run prisma:generate
npm run db:deploy
npm start
```

The health endpoint is available at `GET /api/health`. Run unit tests with `npm test`.

## Database

The database uses **PostgreSQL + Prisma**. The source of truth is [prisma/schema.prisma](prisma/schema.prisma); the initial, version-controlled PostgreSQL migration is in [prisma/migrations](prisma/migrations).

### What is included

| Area | Prisma model(s) | Purpose |
| --- | --- | --- |
| Loan account | `Loan`, `Schedule` | Loan balances, DPD/bucket, holds, and installment schedules. |
| Payment processing | `Payment`, `PaymentAllocation` | Imported payments and their FIFO-style allocation across schedules. |
| Collection operations | `Contact`, `Settlement` | Contact/PTP records, fair-practice fields, and maker-checker settlement decisions. |
| Decisioning | `Score` | AI-risk score, expected recovery, model version, and reason codes. |
| Platform support | `AuditLog`, `OutboxEvent`, `AppConfig` | Audit trail, reliable background-event queue, and business configuration. |

The schema uses foreign keys, unique constraints, enums, decimal money fields, and indexes for common collection work-queue, PTP, payment-import, and audit queries.

### Database commands

```powershell
# Validate the Prisma schema
npx prisma validate

# Generate the Prisma client after schema changes
npm run prisma:generate

# Create and apply a new development migration
npm run db:migrate

# Apply committed migrations, for example in Supabase or production
npm run db:deploy

# Inspect data locally in Prisma Studio
npm run db:studio
```

### Using repositories

[config/db.js](config/db.js) creates the Prisma PostgreSQL client using `DATABASE_URL`. [repositories](repositories) exposes a small common interface over each generated Prisma model, keeping future services and controllers independent from direct database queries.

For financial operations such as payment allocation, payment/schedule/loan updates should be executed inside one Prisma transaction so that partial updates cannot be saved.

## Current API boundary

The PostgreSQL schema, migration, Prisma client configuration, and repositories are ready. Existing database-dependent API routes deliberately return `503 DATABASE_INTEGRATION_BLOCKED` until controllers are connected to the agreed persistence workflows.

There is currently no login/JWT integration, database-backed authorization, CSV import persistence, day-end persistence, export workflow, or outbox delivery worker. No fallback data store is used. See [DB_GAPS.md](DB_GAPS.md) and [BACKEND_STATUS.md](BACKEND_STATUS.md) before implementing those areas.

## Collection engine notes

The pure engine accepts normalized camelCase values with string/Decimal money and `YYYY-MM-DD` business dates. Production rules must be mapped from the official configuration when it is supplied. `contactValidation` is a preflight check, not an atomic contact writer. `reconciliation` requires imported payments scoped to the settlement loan and performs no status persistence.
