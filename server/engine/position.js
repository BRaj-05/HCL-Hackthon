'use strict';
const { D, money } = require('./money');
const { daysBetween } = require('./dates');
const { allocateFIFO } = require('./allocate');

function bucketForDPD(dpd, cfg) {
  if (dpd === 0) return 'CURRENT';
  if (dpd <= cfg.sma0Max) return 'SMA_0';
  if (dpd <= cfg.sma1Max) return 'SMA_1';
  if (dpd <= cfg.sma2Max) return 'SMA_2';
  return 'NPA';
}
function computePosition(loan, schedule, payments, asOf, cfg) {
  for (const k of ['tolerance','penalAnnualRate','sma0Max','sma1Max','sma2Max']) {
    if (cfg[k] === undefined) throw new Error(`Missing normalized config: ${k}`);
  }
  const { instalments, paymentApplications } = allocateFIFO(schedule, payments, asOf);
  const overdueRows = instalments.filter(x => x.dueDate < asOf && D(x.unpaidAmount).gt(cfg.tolerance));
  let dpd = 0;
  let overdue = D('0');
  let penal = D('0');
  for (const row of overdueRows) {
    const days = daysBetween(row.dueDate, asOf);
    if (dpd === 0 || days > dpd) dpd = days;
    overdue = overdue.plus(row.unpaidAmount);
    penal = penal.plus(D(row.unpaidAmount).times(cfg.penalAnnualRate).times(days).div(365));
  }
  penal = penal.toDecimalPlaces(2);
  const prior = instalments.filter(x => x.dueDate < asOf);
  const lastDue = prior.sort((a,b) => a.dueDate.localeCompare(b.dueDate) || a.instalmentNo - b.instalmentNo).at(-1);
  const closingPrincipal = lastDue ? D(lastDue.closingPrincipal) : D(loan.principal);
  return {
    dpd,
    bucket: bucketForDPD(dpd,cfg),
    overdueAmount: money(overdue),
    penalCharges: money(penal),
    totalDues: money(overdue.plus(penal).plus(closingPrincipal)),
    overdueInstalments: overdueRows.map(r => ({instalmentNo:r.instalmentNo, dueDate:r.dueDate, unpaidAmount:r.unpaidAmount})),
    allocation: paymentApplications,
    scheduleWithAllocation: instalments
  };
}
module.exports = { computePosition, bucketForDPD };
