import { describe, expect, it } from 'vitest';
import { classifyDpd } from './classification';
import { can } from '../../lib/permissions';
describe('classification and authorization',()=>{
  it.each([[0,'Current'],[1,'1–30'],[30,'1–30'],[31,'31–60'],[60,'31–60'],[61,'61–90'],[90,'61–90'],[91,'90+']])('classifies %i DPD as %s',(days,bucket)=>expect(classifyDpd(days)).toBe(bucket));
  it('rejects invalid DPD',()=>expect(()=>classifyDpd(-1)).toThrow());
  it('keeps auditors read-only while allowing report exports',()=>{
    const auditor={role:'AUDITOR'};
    expect(can(auditor,'data:export')).toBe(true);
    for(const permission of ['contact:create','settlement:create','settlement:review','dayend:run','data:import','rules:edit','worklist:assign','hold:edit'])expect(can(auditor,permission)).toBe(false);
  });
  it('allows only heads to edit optional rules',()=>{expect(can({role:'MANAGER'},'rules:edit')).toBe(false);expect(can({role:'HEAD'},'rules:edit')).toBe(true);});
});
