// Prisma Decimal fields may be serialized as strings. Convert at the REST boundary.
// Monetary arithmetic and rounding remain authoritative on the Express backend.
const amountFields = {
  loans: ['principal','outstanding','dues','penal','dpd'],
  schedules: ['amount','paid'], payments: ['amount'],
  contacts: ['ptpAmount'], settlements: ['amount'],
  scores: ['missProbability','expectedRecovery'],
};
const enumLabels = {
  CURRENT:'Current', DPD_1_30:'1–30', DPD_31_60:'31–60', DPD_61_90:'61–90', DPD_90_PLUS:'90+',
  HIGH:'High', MEDIUM:'Medium', LOW:'Low', PENDING:'Pending', APPROVED:'Approved', REJECTED:'Rejected',
  PAID:'Paid', EXPIRED:'Expired', KEPT:'Kept', BROKEN:'Broken', QUEUED:'Queued', SENT:'Sent', FAILED:'Failed',
  RUNNING:'Running', COMPLETED:'Completed', PHONE:'Phone', SMS:'SMS', EMAIL:'Email', VISIT:'Visit',
  CONNECTED:'Connected', NO_ANSWER:'No answer', PROMISE_TO_PAY:'Promise to pay', DISPUTE:'Dispute', WRONG_NUMBER:'Wrong number',
};
const collections = ['users','loans','schedules','payments','contacts','settlements','rules','scores','audit','outbox','runs','imports'];
export function normalizeWorkspace(input) {
  if (!input || typeof input !== 'object' || !input.asOf) throw new Error('Invalid workspace response: asOf is required.');
  const result = { ...input, asOf: input.asOf.slice(0,10) };
  for (const name of collections) {
    const records = input[name] ?? (name === 'scores' ? [] : undefined);
    if (!Array.isArray(records)) throw new Error('Invalid workspace response: '+name+' must be an array.');
    result[name] = records.map(record => {
      const row = { ...record };
      for (const field of amountFields[name] ?? []) {
        if (row[field] === undefined || row[field] === null) continue;
        const value = Number(row[field]);
        if (!Number.isFinite(value)) throw new Error('Invalid numeric '+name+'.'+field);
        row[field] = value;
      }
      for (const field of ['status','priority','bucket','channel','outcome','ptpStatus']) if (row[field]) row[field] = enumLabels[row[field]] ?? row[field];
      for (const field of ['date','dueDate','ptpDate','holdUntil','asOf']) if (row[field]) row[field] = row[field].slice(0,10);
      if (name === 'scores') row.reasons = Array.isArray(row.reasons) ? row.reasons.slice(0,3) : [];
      if (name === 'runs') row.steps = (row.steps ?? []).map(step => ({...step,status:enumLabels[step.status]??step.status}));
      return row;
    });
  }
  return result;
}
