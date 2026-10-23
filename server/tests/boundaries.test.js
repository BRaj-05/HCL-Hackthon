'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { reconcileSettlement } = require('../engine/reconciliation');
const { validateContact } = require('../services/contactValidation');
const { daysBetween } = require('../engine/dates');
const { evaluateSettlement } = require('../engine/settlementRules');
const { derivePTPs } = require('../engine/ptp');
const { requireDatabase } = require('../services/backendReadiness');
test('invalid calendar date rejected', () => assert.throws(() => daysBetween('2026-02-30', '2026-03-01')));
const settlement = { loanId: 'L1', status: 'APPROVED', approvedDate: '2026-03-01', validUntil: '2026-03-10', offerAmount: '100' };
const payment = { loanId: 'L1', paymentId: 'P1', paymentDate: '2026-03-10', amount: '100' };
test('reconciliation cuts off future payments and includes validity end', () => {
  assert.equal(reconcileSettlement(settlement, [payment], '2026-03-09').status, 'APPROVED');
  assert.equal(reconcileSettlement(settlement, [payment], '2026-03-10').status, 'PAID');
  assert.equal(reconcileSettlement(settlement, [], '2026-03-11').status, 'LAPSED');
  assert.throws(() => reconcileSettlement(settlement, [payment, payment], '2026-03-11'));
  assert.throws(() => reconcileSettlement(settlement, [{ ...payment, loanId: 'L2' }], '2026-03-11'));
});
test('settlement routing uses raw discount rather than rounded display', () => {
  const pos = { bucket: 'NPA', dpd: 100, totalDues: '100000', contactStrategy: 'RECOVERY' };
  const cfg = { headMaxDiscount: '40', managerMaxDiscount: '20', settlementMinSma2DPD: 75 };
  assert.equal(evaluateSettlement(pos, '79999.99', cfg).route, 'HEAD_OF_COLLECTIONS');
  assert.equal(evaluateSettlement(pos, '59999.99', cfg).reasonCode, 'DISCOUNT_ABOVE_LIMIT');
});
test('PTP is open on deadline and broken the following day', () => {
  const contacts = [{ contactId: 'C1', contactDate: '2026-03-01', ptpDate: '2026-03-03', ptpAmount: '100', outcome: 'PTP' }];
  const cfg = { ptpGraceDays: 2, ptpWindowDays: 60 };
  assert.equal(derivePTPs(contacts, [], '2026-03-05', cfg).items[0].status, 'OPEN');
  assert.equal(derivePTPs(contacts, [], '2026-03-06', cfg).items[0].status, 'BROKEN');
});
test('contact IST hours, daily cap, HOLD and PTP limits', () => {
  const input = { loanId: 'L1', type: 'CALL', outcome: 'PTP', ptpDate: '2026-03-16', ptpAmount: '100' };
  const pos = { contactStrategy: 'TELECALL', totalDues: '100' };
  const cfg = { contactStartTime: '08:00:00', contactEndTime: '19:00:00', maxCallsPerDay: 3, maxFieldVisitsPerDay: 1, maxPtpDays: 15 };
  const counts = { CALL: 0, FIELD_VISIT: 0 };
  const now = new Date('2026-03-01T02:30:00Z');
  assert.equal(validateContact(input, pos, counts, cfg, now).contactDate, '2026-03-01');
  for (const run of [
    () => validateContact(input, pos, counts, cfg, new Date('2026-03-01T02:29:59Z')),
    () => validateContact(input, pos, { ...counts, CALL: 3 }, cfg, now),
    () => validateContact(input, { ...pos, contactStrategy: 'HOLD' }, counts, cfg, now),
    () => validateContact({ ...input, ptpAmount: '100.01' }, pos, counts, cfg, now),
  ]) assert.throws(run, err => err.status === 422);
});
test('database-dependent routes fail explicitly without opening a connection', () => {
  requireDatabase({}, {}, err => {
    assert.equal(err.status, 503);
    assert.equal(err.code, 'DATABASE_INTEGRATION_BLOCKED');
  });
});
