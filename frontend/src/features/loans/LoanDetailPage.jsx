import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, FileCheck2, IndianRupee, Landmark, MessageSquarePlus, PauseCircle, Phone, Sparkles } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceProvider';
import { useAuth } from '../auth/AuthProvider';
import { AI_ENABLED, gateway } from '../../services/gateway';
import { can } from '../../lib/permissions';
import { date, money, timestamp, today } from '../../lib/format';
import { Badge, Empty, Field, Modal, Notice, PageHeader, Panel, StatCard, Table } from '../../components/ui';
import { ContactModal } from '../contacts/ContactModal';
import { SettlementModal } from '../settlements/SettlementModal';
export function LoanDetailPage() {
  const { id } = useParams(); const { data, act, busy } = useWorkspace(); const { session } = useAuth();
  const [tab, setTab] = useState('Schedule'); const [contact, setContact] = useState(false); const [settlement, setSettlement] = useState(false);
  const [hold, setHold] = useState(false); const [until, setUntil] = useState(''); const [reason, setReason] = useState('');
  if (!data) return null;
  const loan = data.loans.find(l => l.id === id);
  if (!loan) return <Empty title="Account unavailable" text="This account does not exist or is outside your assigned portfolio."><Link className="button secondary" to="/loans">Back to accounts</Link></Empty>;
  const user = session.user; const held = loan.holdUntil && loan.holdUntil >= today();
  const schedules = data.schedules.filter(s => s.loanId === id).sort((a,b) => a.dueDate.localeCompare(b.dueDate));
  const payments = data.payments.filter(p => p.loanId === id);
  const contacts = data.contacts.filter(c => c.loanId === id);
  const settlements = data.settlements.filter(s => s.loanId === id);
  const score = data.scores.find(s => s.loanId === id);
  return <><Link className="back-link" to="/loans"><ArrowLeft size={15} />All loan accounts</Link><PageHeader eyebrow={loan.id + ' · ' + loan.product.toUpperCase()} title={loan.borrower} description={loan.city + ' · ' + loan.phone}>
    {can(user,'hold:edit') && <button className="button secondary" onClick={() => {setUntil(loan.holdUntil ?? '');setReason(loan.holdReason ?? '');setHold(true);}}><PauseCircle size={16} />{held ? 'Manage hold' : 'Place hold'}</button>}
    {can(user,'settlement:create') && <button className="button secondary" disabled={loan.outstanding <= 0} onClick={() => setSettlement(true)}><FileCheck2 size={16} />Propose settlement</button>}
    {can(user,'contact:create') && <button className="button primary" disabled={!!held} onClick={() => setContact(true)}><MessageSquarePlus size={16} />Log contact</button>}
  </PageHeader>
  {held && <Notice tone="warning">Account on hold until {date(loan.holdUntil)}. {loan.holdReason}. Contact actions are paused.</Notice>}
  <div className="stats-grid"><StatCard label="Outstanding balance" value={money(loan.outstanding)} detail={'Original principal: ' + money(loan.principal)} icon={Landmark}/><StatCard label="Amount due" value={money(loan.dues)} detail={'Penal charges: ' + money(loan.penal)} icon={IndianRupee} tone="blue"/><StatCard label="Days past due" value={String(loan.dpd)} detail={'Bucket: ' + loan.bucket + (loan.bucket === 'Current' ? '' : ' days')} icon={CalendarDays} tone="peach"/><StatCard label="Customer contacts" value={String(contacts.length)} detail={contacts.filter(c=>c.outcome==='Promise to pay').length + ' recorded promises'} icon={Phone} tone="lavender"/></div>
  <div className="account-context"><span>Assigned to <strong>{data.users.find(u=>u.id===loan.collectorId)?.name ?? 'Unassigned'}</strong></span><span>Priority <Badge>{loan.priority}</Badge></span><span>Next action <strong>{loan.strategy}</strong></span></div>
  <div className="detail-layout"><Panel><div className="tabs detail-tabs" role="group" aria-label="Account records">{['Schedule','Payments','Contacts','Settlements','Activity'].map(t=><button key={t} className={tab===t?'active':''} onClick={()=>setTab(t)}>{t}</button>)}</div>
    {tab==='Schedule' && (schedules.length ? <Table headers={['Due date','Scheduled','Allocated (FIFO)','Remaining','Status']}>{schedules.map(s=><tr key={s.id}><td>{date(s.dueDate)}</td><td>{money(s.amount)}</td><td>{money(s.paid)}</td><td className="strong">{money(Math.max(0,s.amount-s.paid))}</td><td><Badge>{s.paid>=s.amount ? 'Paid' : s.dueDate<data.asOf ? 'Overdue' : 'Upcoming'}</Badge></td></tr>)}</Table> : <Empty title="No schedules imported" text="Import the installment schedule, then run day-end." />)}
    {tab==='Payments' && (payments.length ? <Table headers={['Payment date','Reference','Amount','Status']}>{payments.map(p=><tr key={p.id}><td>{date(p.date)}</td><td>{p.reference}</td><td className="strong">{money(p.amount)}</td><td><Badge>{p.reconciled?'Reconciled':'Pending'}</Badge></td></tr>)}</Table> : <Empty title="No payments recorded" />)}
    {tab==='Contacts' && (contacts.length ? <div className="timeline">{[...contacts].sort((a,b)=>b.contactedAt.localeCompare(a.contactedAt)).map(c=><article key={c.id}><span className="timeline-dot"/><div className="timeline-heading"><strong>{c.channel} · {c.outcome}</strong><small>{timestamp(c.contactedAt)} IST</small></div><p>{c.notes}</p>{c.ptpDate&&<span className="promise-line">{money(c.ptpAmount)} by {date(c.ptpDate)} <Badge>{c.ptpStatus}</Badge></span>}</article>)}</div> : <Empty title="No conversations yet" />)}
    {tab==='Settlements' && (settlements.length ? <Table headers={['Offer','Due date','Status','Reason']}>{settlements.map(s=><tr key={s.id}><td className="strong">{money(s.amount)}</td><td>{date(s.dueDate)}</td><td><Badge>{s.status}</Badge></td><td className="notes-cell">{s.reason}</td></tr>)}</Table> : <Empty title="No settlement proposals" />)}
    {tab==='Activity' && (data.audit.some(e=>e.entity===id) ? <div className="timeline">{data.audit.filter(e=>e.entity===id).map(e=><article key={e.id}><span className="timeline-dot"/><div className="timeline-heading"><strong>{e.action}</strong><small>{timestamp(e.at)} IST</small></div><p>{e.detail}</p><small>{e.actor}</small></article>)}</div> : <Empty title="No account activity yet" />)}
  </Panel><div className="detail-side"><Panel title="Account snapshot"><dl className="definition-list"><div><dt>Product</dt><dd>{loan.product}</dd></div><div><dt>Branch / city</dt><dd>{loan.city}</dd></div><div><dt>Contact number</dt><dd>{loan.phone}</dd></div><div><dt>As-of date</dt><dd>{date(data.asOf)}</dd></div><div><dt>Principal</dt><dd>{money(loan.principal)}</dd></div></dl></Panel>{AI_ENABLED && score && <Panel title="Recovery signals" action={<Sparkles size={18} className="green-text"/>}><div className="score-preview"><span>Miss probability</span><strong>{Math.round(score.missProbability*100)}%</strong><div className="progress-track"><span style={{width:score.missProbability*100+'%'}}/></div><span>Expected recovery</span><strong>{money(score.expectedRecovery)}</strong><ul>{score.reasons.map(r=><li key={r}>{r}</li>)}</ul><Link to="/insights" className="text-link">Explore AI insights →</Link></div></Panel>}</div></div>
  {contact && <ContactModal loanId={loan.id} close={()=>setContact(false)}/>}
  {settlement && <SettlementModal loanId={loan.id} close={()=>setSettlement(false)}/>}
  {hold && <Modal title="Account hold" description="Pause contact while a dispute or review is in progress." close={()=>setHold(false)}><form onSubmit={async e=>{e.preventDefault();if(await act(()=>gateway.hold(user,loan.id,until,reason),until?'Account hold updated.':'Account hold released.'))setHold(false);}}><div className="modal-body form-stack"><Field label="Hold until" hint="Leave empty to release the current hold."><input type="date" min={today()} value={until} onChange={e=>setUntil(e.target.value)}/></Field><Field label="Reason"><textarea rows={3} required={!!until} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></Field></div><div className="modal-footer"><button type="button" className="button secondary" onClick={()=>setHold(false)}>Cancel</button><button className="button primary" disabled={busy}>{until?'Save hold':'Release hold'}</button></div></form></Modal>}</>;
}
