CREATE SCHEMA IF NOT EXISTS "public";

-- Enums
CREATE TYPE "LoanStatus" AS ENUM ('ACTIVE', 'CLOSED', 'WRITTEN_OFF', 'HOLD');
CREATE TYPE "ScheduleStatus" AS ENUM ('PENDING', 'PARTIAL', 'PAID', 'OVERDUE');
CREATE TYPE "PaymentMode" AS ENUM ('CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'OTHER');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'RECONCILED', 'REJECTED', 'REVERSED');
CREATE TYPE "ContactChannel" AS ENUM ('CALL', 'SMS', 'WHATSAPP', 'EMAIL', 'VISIT', 'OTHER');
CREATE TYPE "ContactOutcome" AS ENUM ('CONNECTED', 'NO_ANSWER', 'WRONG_NUMBER', 'REFUSED', 'PROMISE_TO_PAY', 'OTHER');
CREATE TYPE "PtpStatus" AS ENUM ('OPEN', 'KEPT', 'BROKEN', 'CANCELLED');
CREATE TYPE "SettlementStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

-- Core loan data
CREATE TABLE "loans" (
  "id" TEXT NOT NULL,
  "loan_number" TEXT NOT NULL,
  "customer_id" TEXT NOT NULL,
  "product" TEXT,
  "principal_amount" DECIMAL(14, 2) NOT NULL,
  "interest_rate" DECIMAL(7, 4),
  "disbursed_at" TIMESTAMP(3),
  "maturity_date" TIMESTAMP(3),
  "status" "LoanStatus" NOT NULL DEFAULT 'ACTIVE',
  "assigned_collector_id" TEXT,
  "as_of_date" TIMESTAMP(3),
  "principal_balance" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "interest_balance" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "penal_balance" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "total_due" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "overdue_amount" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "dpd" INTEGER NOT NULL DEFAULT 0,
  "bucket" TEXT NOT NULL DEFAULT 'CURRENT',
  "is_on_hold" BOOLEAN NOT NULL DEFAULT false,
  "hold_reason" TEXT,
  "hold_until" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "loans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "schedules" (
  "id" TEXT NOT NULL,
  "loan_id" TEXT NOT NULL,
  "installment_number" INTEGER NOT NULL,
  "due_date" TIMESTAMP(3) NOT NULL,
  "principal_due" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "interest_due" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "penal_due" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "total_due" DECIMAL(14, 2) NOT NULL,
  "paid_amount" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "status" "ScheduleStatus" NOT NULL DEFAULT 'PENDING',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "schedules_pkey" PRIMARY KEY ("id")
);

-- Payments and FIFO allocations
CREATE TABLE "payments" (
  "id" TEXT NOT NULL,
  "loan_id" TEXT NOT NULL,
  "external_reference" TEXT NOT NULL,
  "amount" DECIMAL(14, 2) NOT NULL,
  "paid_at" TIMESTAMP(3) NOT NULL,
  "received_at" TIMESTAMP(3),
  "mode" "PaymentMode" NOT NULL DEFAULT 'OTHER',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "import_batch_id" TEXT,
  "raw_record" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_allocations" (
  "id" TEXT NOT NULL,
  "payment_id" TEXT NOT NULL,
  "schedule_id" TEXT NOT NULL,
  "principal" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "interest" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "penal" DECIMAL(14, 2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- Collector operations
CREATE TABLE "contacts" (
  "id" TEXT NOT NULL,
  "loan_id" TEXT NOT NULL,
  "collector_id" TEXT NOT NULL,
  "contacted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "channel" "ContactChannel" NOT NULL,
  "outcome" "ContactOutcome" NOT NULL,
  "notes" TEXT,
  "consent_confirmed" BOOLEAN NOT NULL DEFAULT false,
  "contact_within_allowed_hours" BOOLEAN NOT NULL DEFAULT true,
  "breach_reason" TEXT,
  "promised_amount" DECIMAL(14, 2),
  "promised_date" TIMESTAMP(3),
  "ptp_status" "PtpStatus",
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "settlements" (
  "id" TEXT NOT NULL,
  "loan_id" TEXT NOT NULL,
  "proposed_by" TEXT NOT NULL,
  "proposed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "requested_amount" DECIMAL(14, 2) NOT NULL,
  "approved_amount" DECIMAL(14, 2),
  "expiry_date" TIMESTAMP(3),
  "reason" TEXT NOT NULL,
  "status" "SettlementStatus" NOT NULL DEFAULT 'PENDING',
  "checked_by" TEXT,
  "checked_at" TIMESTAMP(3),
  "checker_note" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- Intelligence, audit, and asynchronous work
CREATE TABLE "scores" (
  "id" TEXT NOT NULL,
  "loan_id" TEXT NOT NULL,
  "as_of_date" TIMESTAMP(3) NOT NULL,
  "model_version" TEXT NOT NULL,
  "miss_probability" DECIMAL(6, 5) NOT NULL,
  "expected_recovery" DECIMAL(14, 2),
  "top_reasons" TEXT[],
  "feature_snapshot" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "scores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "actor_id" TEXT,
  "action" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "entity_id" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "before" JSONB,
  "after" JSONB,
  "metadata" JSONB,

  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "outbox_events" (
  "id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "aggregate_type" TEXT NOT NULL,
  "aggregate_id" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "status" "OutboxStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "app_config" (
  "key" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "description" TEXT,
  "updated_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "app_config_pkey" PRIMARY KEY ("key")
);

-- Lookup and work-queue indexes
CREATE UNIQUE INDEX "loans_loan_number_key" ON "loans"("loan_number");
CREATE INDEX "loans_customer_id_idx" ON "loans"("customer_id");
CREATE INDEX "loans_status_bucket_assigned_collector_id_idx"
  ON "loans"("status", "bucket", "assigned_collector_id");

CREATE INDEX "schedules_due_date_status_idx" ON "schedules"("due_date", "status");
CREATE UNIQUE INDEX "schedules_loan_id_installment_number_key"
  ON "schedules"("loan_id", "installment_number");

CREATE UNIQUE INDEX "payments_external_reference_key" ON "payments"("external_reference");
CREATE INDEX "payments_loan_id_idx" ON "payments"("loan_id");
CREATE INDEX "payments_paid_at_idx" ON "payments"("paid_at");
CREATE INDEX "payments_status_idx" ON "payments"("status");
CREATE INDEX "payments_import_batch_id_idx" ON "payments"("import_batch_id");

CREATE UNIQUE INDEX "payment_allocations_payment_id_schedule_id_key"
  ON "payment_allocations"("payment_id", "schedule_id");

CREATE INDEX "contacts_loan_id_ptp_status_promised_date_idx"
  ON "contacts"("loan_id", "ptp_status", "promised_date");
CREATE INDEX "contacts_collector_id_contacted_at_idx"
  ON "contacts"("collector_id", "contacted_at");

CREATE INDEX "settlements_loan_id_status_created_at_idx"
  ON "settlements"("loan_id", "status", "created_at");

CREATE INDEX "scores_as_of_date_expected_recovery_idx"
  ON "scores"("as_of_date", "expected_recovery");
CREATE UNIQUE INDEX "scores_loan_id_as_of_date_model_version_key"
  ON "scores"("loan_id", "as_of_date", "model_version");

CREATE INDEX "audit_logs_entity_type_entity_id_occurred_at_idx"
  ON "audit_logs"("entity_type", "entity_id", "occurred_at");
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs"("actor_id");

CREATE INDEX "outbox_events_status_available_at_idx"
  ON "outbox_events"("status", "available_at");
CREATE INDEX "outbox_events_event_type_idx" ON "outbox_events"("event_type");
CREATE INDEX "outbox_events_aggregate_id_idx" ON "outbox_events"("aggregate_id");

-- Relationships
ALTER TABLE "schedules"
  ADD CONSTRAINT "schedules_loan_id_fkey"
  FOREIGN KEY ("loan_id") REFERENCES "loans"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_loan_id_fkey"
  FOREIGN KEY ("loan_id") REFERENCES "loans"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_payment_id_fkey"
  FOREIGN KEY ("payment_id") REFERENCES "payments"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "payment_allocations"
  ADD CONSTRAINT "payment_allocations_schedule_id_fkey"
  FOREIGN KEY ("schedule_id") REFERENCES "schedules"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "contacts"
  ADD CONSTRAINT "contacts_loan_id_fkey"
  FOREIGN KEY ("loan_id") REFERENCES "loans"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "settlements"
  ADD CONSTRAINT "settlements_loan_id_fkey"
  FOREIGN KEY ("loan_id") REFERENCES "loans"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "scores"
  ADD CONSTRAINT "scores_loan_id_fkey"
  FOREIGN KEY ("loan_id") REFERENCES "loans"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
