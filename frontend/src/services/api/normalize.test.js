import { describe, expect, it } from 'vitest';
import { seedWorkspace } from '../demo/seed';
import { normalizeWorkspace } from './normalize';
describe('PostgreSQL/Prisma REST response mapping',()=>{
  it('converts decimal strings and Prisma enums for the views',()=>{
    const db=seedWorkspace();db.loans[0].dues='1234.56';db.loans[0].priority='HIGH';db.loans[0].bucket='DPD_31_60';db.schedules[0].dueDate='2026-10-01T00:00:00.000Z';
    const mapped=normalizeWorkspace(db);expect(mapped.loans[0].dues).toBe(1234.56);expect(mapped.loans[0].priority).toBe('High');expect(mapped.loans[0].bucket).toBe('31–60');expect(mapped.schedules[0].dueDate).toBe('2026-10-01');
  });
  it('rejects malformed numeric values',()=>{const db=seedWorkspace();db.loans[0].dues='invalid';expect(()=>normalizeWorkspace(db)).toThrow('Invalid numeric');});
});
