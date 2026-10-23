'use strict';
const { D } = require('./money');
const { addDays, daysBetween } = require('./dates');

// contactDate must already be the IST calendar date derived from contact_ts.
function derivePTPs(contacts, payments, asOfDate, cfg) {
  const promises = contacts.filter(c => c.outcome === 'PTP' && c.contactDate < asOfDate && c.ptpDate);
  const items = promises.map(c => {
    const deadline = addDays(c.ptpDate, cfg.ptpGraceDays);
    const sum = payments.filter(p => p.paymentDate >= c.contactDate && p.paymentDate <= deadline && p.paymentDate <= asOfDate)
      .reduce((total,p) => total.plus(D(p.amount)),D(0));
    const status = sum.gte(D(c.ptpAmount)) ? 'KEPT' : deadline < asOfDate ? 'BROKEN' : 'OPEN';
    return { contactId:c.contactId, status, ptpDate:c.ptpDate, deadline, paidAmount:sum.toFixed(2) };
  });
  const brokenCount = items.filter(x => x.status === 'BROKEN' && daysBetween(x.ptpDate, asOfDate) > 0 && daysBetween(x.ptpDate, asOfDate) <= cfg.ptpWindowDays).length;
  return { items, brokenCount };
}
module.exports = { derivePTPs };
