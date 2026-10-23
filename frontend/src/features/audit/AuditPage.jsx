import { useState } from 'react';
import { Search, ShieldCheck } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceProvider';
import { timestamp } from '../../lib/format';
import { roleName } from '../../lib/permissions';
import { Badge, Empty, Notice, PageHeader, Panel, Table } from '../../components/ui';
export function AuditPage() {
  const {data}=useWorkspace();const [query,setQuery]=useState('');const [role,setRole]=useState('');if(!data)return null;
  const rows=[...data.audit].filter(e=>(!role||e.role===role)&&(e.actor+' '+e.action+' '+e.entity+' '+e.detail).toLowerCase().includes(query.toLowerCase())).sort((a,b)=>b.at.localeCompare(a.at));
  return <><PageHeader eyebrow="EVERY ACTION, ACCOUNTED FOR" title="Audit trail" description="A traceable record of changes, decisions, and operational events."/><Notice><ShieldCheck size={17}/>Audit entries are read-only in this workspace. Live audit records must be written and protected by your backend.</Notice><Panel><div className="table-toolbar"><div className="search-input"><Search size={16}/><input aria-label="Search audit trail" placeholder="Search actor, action, account or detail…" value={query} onChange={e=>setQuery(e.target.value)}/></div><div className="filter-group"><span className="muted">{rows.length} events</span><select aria-label="Filter actor role" value={role} onChange={e=>setRole(e.target.value)}><option value="">All roles</option>{['COLLECTOR','MANAGER','HEAD','AUDITOR'].map(r=><option key={r} value={r}>{roleName(r)}</option>)}</select></div></div>{rows.length?<Table headers={['When (IST)','Actor','Action','Entity','Details']}>{rows.map(e=><tr key={e.id}><td className="nowrap">{timestamp(e.at)}</td><td className="strong">{e.actor}<small className="cell-small">{roleName(e.role)}</small></td><td><Badge>{e.action}</Badge></td><td className="monospace">{e.entity}</td><td className="notes-cell">{e.detail}</td></tr>)}</Table>:<Empty title="No matching audit events" text="Try a different filter, or complete an account action."/>}</Panel></>;
}
