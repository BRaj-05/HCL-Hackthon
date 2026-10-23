import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceProvider';
import { DEMO_MODE } from '../../services/gateway';
import { money } from '../../lib/format';
import { AccountLabel } from '../../components/AccountLabel';
import { Empty, Notice, PageHeader, Panel, Table } from '../../components/ui';
export function InsightsPage() {
  const {data}=useWorkspace();const [sort,setSort]=useState('recovery');if(!data)return null;
  const scores=[...data.scores].filter(s=>data.loans.some(l=>l.id===s.loanId)).sort((a,b)=>sort==='recovery'?b.expectedRecovery-a.expectedRecovery:b.missProbability-a.missProbability);
  return <><PageHeader eyebrow="OPTIONAL AI ENGINEER TRACK" title="AI insights" description="Recovery signals that help you decide where to focus next."><span className="labs-pill"><Sparkles size={15}/>{DEMO_MODE?'Illustrative scores':'Model signals'}</span></PageHeader>
    <Notice>{DEMO_MODE?'These are synthetic demo scores, not model predictions.':'Scores are supplied by the optional backend scoring service.'} Miss probability can support R13 early warning. Expected recovery can rank the worklist; each score includes up to three explanatory signals.</Notice>
    <Panel title="Account recovery signals" subtitle="Use these signals alongside customer context and approved collection policies" action={<select aria-label="Sort AI scores" value={sort} onChange={e=>setSort(e.target.value)}><option value="recovery">Highest expected recovery</option><option value="risk">Highest miss probability</option></select>}>{scores.length?<Table headers={['Account','Miss probability','Expected recovery','Top three signals']}>{scores.map(s=><tr key={s.loanId}><td><AccountLabel loan={data.loans.find(l=>l.id===s.loanId)}/></td><td><div className="risk-indicator"><strong>{Math.round(s.missProbability*100)}%</strong><div className="progress-track"><span style={{width:s.missProbability*100+'%'}}/></div></div></td><td className="strong">{money(s.expectedRecovery)}</td><td><div className="signal-tags">{s.reasons.slice(0,3).map(r=><span key={r}>{r}</span>)}</div></td></tr>)}</Table>:<Empty title="No scores available" text="Connect the optional scoring service to see account signals."/>}</Panel></>;
}
