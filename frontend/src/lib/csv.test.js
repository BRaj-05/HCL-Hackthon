import { describe, expect, it } from 'vitest';
import { csvText, parseCsv, template } from './csv';
describe('CSV boundary',()=>{
  it('parses quoted fields and required headers',()=>{
    const rows=parseCsv('id,loanId,date,amount,reference\nP1,L1,2026-10-01,500,"UPI,001"','payments');expect(rows[0].reference).toBe('UPI,001');
  });
  it('rejects duplicate identifiers, invalid amounts and invalid dates',()=>{
    expect(()=>parseCsv('id,loanId,date,amount,reference\nP1,L1,2026-10-01,500,A\nP1,L1,2026-10-01,100,B','payments')).toThrow('duplicate id');
    expect(()=>parseCsv('id,loanId,date,amount,reference\nP1,L1,2026-10-01,-1,A','payments')).toThrow('positive');
    expect(()=>parseCsv('id,loanId,date,amount,reference\nP1,L1,2026-02-31,1,A','payments')).toThrow('invalid date');
  });
  it('rejects missing columns and empty data',()=>{
    expect(()=>parseCsv('id,amount\nP1,12','payments')).toThrow('Missing columns');
    expect(()=>parseCsv('id,loanId,date,amount,reference','payments')).toThrow('no data');
  });
  it('provides parseable templates for each input type',()=>{for(const kind of ['loans','schedules','payments','contacts'])expect(parseCsv(template(kind),kind)).toHaveLength(1);});
  it('escapes spreadsheet formulas on export',()=>expect(csvText([{borrower:'=2+2'}])).toContain("'=2+2"));
});
