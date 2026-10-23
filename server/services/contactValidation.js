'use strict';
const { z } = require('zod');
const { D } = require('../engine/money');
const { daysBetween } = require('../engine/dates');
const { ApiError } = require('../middleware/errors');
const contactSchema = z.object({
  loanId: z.string().min(1), type: z.enum(['CALL', 'FIELD_VISIT']),
  outcome: z.string().min(1), ptpDate: z.string().optional(), ptpAmount: z.string().optional(),
}).strict();
function istParts(now) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(now).map(p => [p.type, p.value]));
}
// Caller must persist blocked-attempt audits and enforce daily limits atomically.
function validateContact(input, position, todayCounts, cfg, now = new Date()) {
  if (!/^\d{2}:\d{2}:\d{2}$/.test(cfg.contactStartTime || '') ||
      !/^\d{2}:\d{2}:\d{2}$/.test(cfg.contactEndTime || '') || !Number.isInteger(cfg.maxPtpDays)) {
    throw new Error('Missing normalized contact configuration');
  }
  const parsed = contactSchema.safeParse(input);
  const fail = message => { throw new ApiError(422, 'CONTACT_BLOCKED', message); };
  if (!parsed.success) fail('Invalid contact fields');
  const contact = parsed.data;
  const parts = istParts(now);
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const time = `${parts.hour}:${parts.minute}:${parts.second}`;
  if (position.contactStrategy === 'HOLD') fail('Account is on HOLD');
  if (time < cfg.contactStartTime || time > cfg.contactEndTime) fail('Outside permitted IST contact hours');
  const limit = contact.type === 'CALL' ? cfg.maxCallsPerDay : cfg.maxFieldVisitsPerDay;
  if (!Number.isInteger(limit) || !Number.isInteger(todayCounts[contact.type])) throw new Error('Missing contact limit or daily count');
  if (todayCounts[contact.type] >= limit) fail('Daily contact limit reached');
  if (contact.outcome === 'PTP') {
    try {
      const days = daysBetween(date, contact.ptpDate);
      if (!Number.isInteger(cfg.maxPtpDays)) throw new Error('Missing PTP limit');
      if (days < 0 || days > cfg.maxPtpDays || D(contact.ptpAmount).lte(0) || D(contact.ptpAmount).gt(position.totalDues)) fail('Invalid PTP date or amount');
    } catch (err) { fail('Invalid PTP date or amount'); }
  } else if (contact.ptpDate !== undefined || contact.ptpAmount !== undefined) fail('PTP fields require PTP outcome');
  return { ...contact, contactDate: date };
}
module.exports = { validateContact };
