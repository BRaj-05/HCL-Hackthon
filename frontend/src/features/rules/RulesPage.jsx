import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceProvider';
import { useAuth } from '../auth/AuthProvider';
import { DEMO_MODE, gateway } from '../../services/gateway';
import { can } from '../../lib/permissions';
import { Notice, PageHeader, Panel } from '../../components/ui';
export function RulesPage() {
  const {data,act,busy}=useWorkspace();const {session}=useAuth();if(!data)return null;
  return <><PageHeader eyebrow="CONSISTENT, CONSIDERED COLLECTIONS" title="Collection rules" description="Understand the policies behind account classification, holds, and escalation."/>
    {DEMO_MODE&&<Notice tone="warning">R1–R12 descriptions are illustrative placeholders from your architecture. The case-study PDF was not supplied; replace these with the approved backend rule definitions. Demo penal charges use 0.5% of overdue installments, recalculated without accumulation.</Notice>}
    <Notice><ShieldCheck size={17}/>Core financial and fair-practice safeguards remain required. Only the collections head can change the optional queue rules R7, R8 and R12. Changes take effect on the next calculation or queue refresh.</Notice>
    <Panel title="Policy registry" subtitle={data.rules.length+' collection policies'}><div className="rules-list">{data.rules.map(rule=>{const editable=['R7','R8','R12'].includes(rule.id)&&can(session.user,'rules:edit');return <article key={rule.id}><span className="rule-id">{rule.id}</span><div><h3>{rule.name}</h3><p>{rule.description}</p></div>{editable?<button className={'switch '+(rule.enabled?'on':'')} role="switch" aria-checked={rule.enabled} aria-label={'Enable '+rule.name} disabled={busy} onClick={()=>void act(()=>gateway.rule(session.user,rule.id,!rule.enabled),'Rule updated.')}><span/></button>:<span className="rule-locked"><LockKeyhole size={13}/>{rule.enabled?'Enabled':'Disabled'}</span>}</article>;})}</div></Panel></>;
}
