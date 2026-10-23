import { beforeEach, describe, expect, it, vi } from 'vitest';
import { demoUsers } from './demo/seed';
import { addDays, today } from '../lib/format';
const memory=()=>{const values=new Map();return{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k),clear:()=>values.clear()};};
let gateway;
const manager=demoUsers.find(u=>u.role==='MANAGER');const head=demoUsers.find(u=>u.role==='HEAD');const collector=demoUsers.find(u=>u.role==='COLLECTOR');const auditor=demoUsers.find(u=>u.role==='AUDITOR');
beforeEach(async()=>{vi.resetModules();vi.stubGlobal('localStorage',memory());vi.stubGlobal('sessionStorage',memory());gateway=(await import('./gateway')).gateway;});
describe('workflow permissions and atomic mutations',()=>{
  it('scopes collector records to their assigned loans',async()=>{
    const data=await gateway.load(collector);expect(data.loans.every(l=>l.collectorId===collector.id)).toBe(true);
    const ids=new Set(data.loans.map(l=>l.id));expect(data.payments.every(p=>ids.has(p.loanId))).toBe(true);
  });
  it('enforces maker-checker decisions and records a different checker',async()=>{
    await expect(gateway.decide(manager,'ST-1001','Approved','Reviewed')).rejects.toThrow('different reviewer');
    await gateway.decide(head,'ST-1001','Approved','Independent review completed');
    const data=await gateway.load(head);expect(data.settlements.find(s=>s.id==='ST-1001')).toMatchObject({status:'Approved',checkerId:head.id});
    expect(data.audit[0].action).toBe('Settlement approved');
  });
  it('does not allow auditor mutation',async()=>{await expect(gateway.runDayEnd(auditor,today())).rejects.toThrow('403');});
  it('rejects duplicate payment references atomically',async()=>{
    const before=await gateway.load(manager);const rows=[{id:'NEW1',loanId:'LN-1001',date:today(),amount:'500',reference:'NEW-REF'},{id:'NEW2',loanId:'LN-1001',date:today(),amount:'500',reference:before.payments[0].reference}];
    await expect(gateway.importRows(manager,'payments',rows,'test.csv')).rejects.toThrow('Duplicate');
    expect((await gateway.load(manager)).payments).toHaveLength(before.payments.length);
  });
  it('blocks contacts on held accounts',async()=>{
    await expect(gateway.contact(manager,{loanId:'LN-1004',channel:'Phone',contactedAt:today()+'T10:00',outcome:'Connected',notes:'Identity confirmed, repayment options discussed.',consent:true})).rejects.toThrow('on hold');
  });
  it('rejects settlement offers over the outstanding balance',async()=>{
    await expect(gateway.propose(manager,{loanId:'LN-1001',amount:9999999,dueDate:addDays(today(),7),reason:'Verified hardship and documented customer request.'})).rejects.toThrow('exceed');
  });
});
