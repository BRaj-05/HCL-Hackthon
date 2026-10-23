'use strict';
const { ApiError } = require('../middleware/errors');
const { authorize, assertLoanAccess } = require('./authorization');
const { money, D } = require('../engine/money');
// These fields match the merged schema. No client, model, or connection is created here.
const loanSelect = {
  id: true, loanNumber: true, customerId: true, product: true, assignedCollectorId: true,
  principalAmount: true, asOfDate: true, dpd: true, bucket: true, overdueAmount: true,
  penalBalance: true, totalDue: true, isOnHold: true, status: true,
};
function loanView(row) {
  return { ...row, principalAmount: money(row.principalAmount.toString()), overdueAmount: money(row.overdueAmount.toString()),
    penalBalance: money(row.penalBalance.toString()), totalDue: money(row.totalDue.toString()) };
}
function createDatabaseServices(getRepositories) {
  async function repositories() {
    if (!process.env.DATABASE_URL && !getRepositories) throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Database configuration unavailable');
    try { return getRepositories ? getRepositories() : require('../repositories'); }
    catch { throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Database client unavailable'); }
  }
  async function query(operation) {
    try { return await operation(await repositories()); }
    catch (err) {
      if (err instanceof ApiError) throw err;
      // Missing tables/configuration and connection errors are dependencies; do not leak SQL/URLs.
      if (['P1000', 'P1001', 'P1002', 'P1003', 'P1017', 'P2021', 'P2022'].includes(err.code) || err.name === 'PrismaClientInitializationError') {
        throw new ApiError(503, 'DATABASE_UNAVAILABLE', 'Database service unavailable');
      }
      throw err;
    }
  }
  async function account(user, id) {
    authorize(user, 'ACCOUNT_READ');
    return query(async r => {
      const loan = await r.Loan.findById(id, { select: loanSelect });
      if (!loan) throw new ApiError(404, 'LOAN_NOT_FOUND', 'Loan not found');
      assertLoanAccess(user, loan);
      const [schedules, payments, contacts] = await Promise.all([
        r.Schedule.find({ loanId: id }, { orderBy: { installmentNumber: 'asc' } }),
        r.Payment.find({ loanId: id }, { orderBy: [{ paidAt: 'asc' }, { externalReference: 'asc' }] }),
        r.Contact.find({ loanId: id }, { orderBy: { contactedAt: 'desc' } }),
      ]);
      return {
        loan: loanView(loan),
        schedule: schedules.map(s => ({ id: s.id, installmentNumber: s.installmentNumber, dueDate: s.dueDate,
          principalDue: money(s.principalDue.toString()), interestDue: money(s.interestDue.toString()),
          penalDue: money(s.penalDue.toString()), totalDue: money(s.totalDue.toString()), paidAmount: money(s.paidAmount.toString()), status: s.status })),
        payments: payments.map(p => ({ id: p.id, externalReference: p.externalReference, paidAt: p.paidAt,
          amount: money(p.amount.toString()), mode: p.mode, status: p.status })),
        contacts: contacts.map(c => ({ id: c.id, contactedAt: c.contactedAt, channel: c.channel, outcome: c.outcome,
          promisedAmount: c.promisedAmount == null ? null : money(c.promisedAmount.toString()), promisedDate: c.promisedDate, ptpStatus: c.ptpStatus })),
      };
    });
  }
  async function worklist(user, page, own) {
    authorize(user, own ? 'WORKLIST_OWN' : 'WORKLIST_ALL');
    const where = own ? { assignedCollectorId: user.userId } : {};
    return query(async r => ({ items: (await r.Loan.find(where, {
      select: loanSelect, take: page.limit, skip: page.offset,
      orderBy: [{ dpd: 'desc' }, { overdueAmount: 'desc' }, { loanNumber: 'asc' }],
    })).map(loanView) }));
  }
  async function settlements(user, page) {
    authorize(user, 'SETTLEMENT_READ');
    const where = user.role === 'COLLECTOR' ? { loan: { assignedCollectorId: user.userId } } : {};
    return query(async r => ({ items: (await r.Settlement.find(where, {
      take: page.limit, skip: page.offset, orderBy: { proposedAt: 'desc' },
    })).map(s => ({ id: s.id, loanId: s.loanId, proposedBy: s.proposedBy, proposedAt: s.proposedAt,
      requestedAmount: money(s.requestedAmount.toString()), approvedAmount: s.approvedAmount == null ? null : money(s.approvedAmount.toString()),
      expiryDate: s.expiryDate, status: s.status, checkedBy: s.checkedBy, checkedAt: s.checkedAt })) }));
  }
  async function dashboard(user, filters) {
    authorize(user, 'DASHBOARD_READ');
    const where = filters.product ? { product: filters.product } : {};
    return query(async r => {
      const rows = await r.Loan.find(where, { select: { bucket: true, totalDue: true, overdueAmount: true } });
      const buckets = new Map();
      for (const row of rows) {
        const value = buckets.get(row.bucket) || { bucket: row.bucket, count: 0, totalDues: D('0'), overdueAmount: D('0') };
        value.count++; value.totalDues = value.totalDues.plus(row.totalDue.toString()); value.overdueAmount = value.overdueAmount.plus(row.overdueAmount.toString());
        buckets.set(row.bucket, value);
      }
      return { buckets: [...buckets.values()].map(b => ({ ...b, totalDues: money(b.totalDues), overdueAmount: money(b.overdueAmount) })) };
    });
  }
  async function audit(user, page) {
    authorize(user, 'AUDIT_READ');
    return query(async r => ({ items: await r.AuditLog.find({}, {
      take: page.limit, skip: page.offset, orderBy: { occurredAt: 'desc' },
      select: { id: true, actorId: true, action: true, entityType: true, entityId: true, occurredAt: true },
    }) }));
  }
  async function outbox(user, page) {
    authorize(user, 'OUTBOX_READ');
    return query(async r => ({ items: await r.OutboxEvent.find({}, {
      take: page.limit, skip: page.offset, orderBy: { createdAt: 'desc' },
      select: { id: true, eventType: true, aggregateType: true, aggregateId: true, status: true, attempts: true, availableAt: true, processedAt: true },
    }) }));
  }
  async function checkSettlementDecision(user, id) {
    authorize(user, 'SETTLEMENT_DECIDE');
    return query(async r => {
      const row = await r.Settlement.findById(id);
      if (!row) throw new ApiError(404, 'SETTLEMENT_NOT_FOUND', 'Settlement not found');
      if (row.proposedBy === user.userId) throw new ApiError(403, 'MAKER_CHECKER', 'Maker cannot check their own proposal');
      if (row.status !== 'PENDING') throw new ApiError(409, 'SETTLEMENT_CONFLICT', 'Settlement is no longer pending');
      throw new ApiError(503, 'SCHEMA_GAP', 'Approval requires verified request-date dues, approval route and settlement lifecycle storage');
    });
  }
  return { account, worklist, settlements, dashboard, audit, outbox, checkSettlementDecision };
}
module.exports = { createDatabaseServices, loanSelect };
