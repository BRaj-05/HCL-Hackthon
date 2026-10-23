'use strict';
const { D, money } = require('./money');
const { daysBetween } = require('./dates');

// Input payments must be persisted imported records scoped to this settlement's loan.
// approvedDate and paymentDate are business dates, not timestamps.
function reconcileSettlement(settlement, importedPayments, asOfDate) {
  daysBetween(asOfDate, asOfDate);
  if (settlement.status !== 'APPROVED') return { status: settlement.status };
  const { approvedDate, validUntil, offerAmount } = settlement;
  if (daysBetween(approvedDate, validUntil) < 0 || D(offerAmount).lte(0)) {
    throw new Error('Invalid settlement validity or offer');
  }
  if (asOfDate < approvedDate) return { status: 'APPROVED', paidAmount: '0.00' };
  const seen = new Set();
  const paid = importedPayments.reduce((total, payment) => {
    daysBetween(payment.paymentDate, payment.paymentDate);
    if (!payment.paymentId || seen.has(payment.paymentId)) throw new Error('Missing or duplicate payment ID');
    seen.add(payment.paymentId);
    if (payment.loanId !== settlement.loanId) throw new Error('Payment loan mismatch');
    if (D(payment.amount).lte(0)) throw new Error('Nonpositive payment');
    return payment.paymentDate >= approvedDate && payment.paymentDate <= validUntil && payment.paymentDate <= asOfDate
      ? total.plus(D(payment.amount)) : total;
  }, D('0'));
  const status = paid.gte(offerAmount) ? 'PAID' : asOfDate > validUntil ? 'LAPSED' : 'APPROVED';
  return { status, paidAmount: money(paid) };
}
module.exports = { reconcileSettlement };
