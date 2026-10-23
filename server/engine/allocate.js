'use strict';
const { D, money } = require('./money');

// All inputs use normalized camelCase fields supplied by a schema-specific adapter.
function allocateFIFO(schedule, payments, asOfDate) {
  const instalments = [...schedule]
    .sort((a,b) => a.instalmentNo - b.instalmentNo)
    .map(row => ({
      ...row,
      unpaidAmount: D(row.emiAmount),
      paidAmount: D('0')
    }));
  const paymentApplications = [];

  const eligiblePayments = payments
    .filter(p => p.paymentDate <= asOfDate)
    .sort((a,b) => a.paymentDate.localeCompare(b.paymentDate) || String(a.paymentId).localeCompare(String(b.paymentId)));

  for (const payment of eligiblePayments) {
    let remaining = D(payment.amount);
    if (remaining.lte(0)) throw new Error(`Nonpositive payment: ${payment.paymentId}`);
    for (const row of instalments) {
      if (remaining.isZero()) break;
      if (row.unpaidAmount.isZero()) continue;
      const applied = DecimalMin(remaining, row.unpaidAmount);
      row.unpaidAmount = row.unpaidAmount.minus(applied);
      row.paidAmount = row.paidAmount.plus(applied);
      remaining = remaining.minus(applied);
      paymentApplications.push({paymentId:payment.paymentId, instalmentNo:row.instalmentNo, amount:money(applied)});
    }
    // HCL says any payment above the entire schedule is ignored for position calculations.
  }
  return {
    instalments: instalments.map(x=>({...x,unpaidAmount:money(x.unpaidAmount),paidAmount:money(x.paidAmount)})),
    paymentApplications
  };
}
function DecimalMin(a,b) { return a.lte(b) ? a : b; }
module.exports = { allocateFIFO };
