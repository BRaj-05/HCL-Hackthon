import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { request } from './http';
const session = new Map();
beforeEach(()=>{session.clear();vi.stubGlobal('sessionStorage',{getItem:key=>session.get(key)??null,removeItem:key=>session.delete(key)});vi.stubGlobal('window',{dispatchEvent:vi.fn()});});
afterEach(()=>vi.unstubAllGlobals());
describe('Express REST boundary',()=>{
  it('sends the JWT and accepts the data envelope',async()=>{
    session.set('collect.token','test-jwt');
    const mock=vi.fn().mockResolvedValue(new Response(JSON.stringify({data:{id:'loan-uuid'}}),{status:200,headers:{'Content-Type':'application/json'}}));vi.stubGlobal('fetch',mock);
    expect(await request('/loans/loan-uuid')).toEqual({id:'loan-uuid'});
    expect(mock.mock.calls[0][1].headers.get('Authorization')).toBe('Bearer test-jwt');
  });
  it.each([403,422])('surfaces a %i error without substituting demo data',async status=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{message:'Rejected',fields:{amount:['Offer exceeds balance.']}}}),{status})));
    await expect(request('/settlements')).rejects.toMatchObject({status,message:'Offer exceeds balance.'});
  });
  it('expires a rejected token and signals sign-in',async()=>{
    session.set('collect.token','expired');vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response('{}',{status:401})));
    await expect(request('/workspace')).rejects.toMatchObject({status:401});expect(session.has('collect.token')).toBe(false);expect(window.dispatchEvent).toHaveBeenCalledOnce();
  });
  it('reports unreachable backends without a demo fallback',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockRejectedValue(new TypeError('Network error')));
    await expect(request('/workspace')).rejects.toMatchObject({status:0});
  });
});
