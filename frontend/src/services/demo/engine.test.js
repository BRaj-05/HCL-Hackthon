import { describe, expect, it } from 'vitest';
import { seedWorkspace } from './seed';
import { calculatePositions, executeDayEnd, reconcileRecords } from './engine';
describe('demo financial pipeline',()=>{
  function fixture(){
    const db=seedWorkspace();db.loans=db.loans.slice(0,1);const loan=db.loans[0];
    db.schedules=[{id:'S1',loanId:loan.id,dueDate:'2026-09-01',amount:1000,paid:0},{id:'S2',loanId:loan.id,dueDate:'2026-10-01',amount:1000,paid:0}];
    db.payments=[{id:'P1',loanId:loan.id,date:'2026-10-02',amount:1500,reference:'REF',reconciled:false},{id:'FUTURE',loanId:loan.id,date:'2026-12-01',amount:1000,reference:'FUTURE',reconciled:false}];
    db.contacts=[];db.settlements=[];db.outbox=[];db.runs=[];return db;
  }
  it('allocates oldest installments first and excludes future payments',()=>{
    const db=fixture();calculatePositions(db,'2026-10-03');
    expect(db.schedules.map(s=>s.paid)).toEqual([1000,500]);expect(db.loans[0]).toMatchObject({outstanding:500,dues:500,dpd:2,penal:2.5});
  });
  it('re-runs without accumulating charges or duplicate reminders',()=>{
    const db=fixture();executeDayEnd(db,'2026-10-03');const first=structuredClone(db.loans);
    executeDayEnd(db,'2026-10-03');
    expect(db.loans).toEqual(first);expect(db.outbox).toHaveLength(1);expect(db.runs).toHaveLength(1);expect(db.runs[0].executions).toBe(2);
  });
  it('does not queue reminders for held accounts',()=>{
    const db=fixture();db.loans[0].holdUntil='2026-10-10';executeDayEnd(db,'2026-10-03');
    expect(db.loans[0].strategy).toBe('On hold');expect(db.outbox).toHaveLength(0);
  });
  it('derives promises from eligible payments without including late funds',()=>{
    const db=fixture();const common={loanId:db.loans[0].id,contactedAt:'2026-10-01T10:00:00+05:30',outcome:'Promise to pay'};
    db.contacts=[{...common,id:'C1',ptpDate:'2026-10-02',ptpAmount:1000},{...common,id:'C2',ptpDate:'2026-10-01',ptpAmount:1000},{...common,id:'C3',ptpDate:'2026-10-05',ptpAmount:2000}];
    reconcileRecords(db,'2026-10-03');expect(db.contacts.map(c=>c.ptpStatus)).toEqual(['Kept','Broken','Pending']);expect(db.payments[1].reconciled).toBe(false);
  });
  it('recomputes a historical date from immutable payment records',()=>{
    const db=fixture();calculatePositions(db,'2026-10-03');calculatePositions(db,'2026-09-02');
    expect(db.loans[0].outstanding).toBe(2000);expect(db.schedules.every(s=>s.paid===0)).toBe(true);
  });
});
