import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceProvider';
import { useAuth } from '../auth/AuthProvider';
import { gateway } from '../../services/gateway';
import { can } from '../../lib/permissions';
import { date, money } from '../../lib/format';
import { AccountLabel } from '../../components/AccountLabel';
import { Badge, Empty, Field, Modal, Notice, PageHeader, Panel, Table } from '../../components/ui';
import { SettlementModal } from './SettlementModal';
export function SettlementsPage() {
    const { data, act, busy } = useWorkspace();
    const { session } = useAuth();
    const user = session.user;
    const [open, setOpen] = useState(false);
    const [status, setStatus] = useState('All');
    const [review, setReview] = useState(null);
    const [note, setNote] = useState('');
    if (!data)
        return null;
    const rows = data.settlements.filter(s => status === 'All' || s.status === status);
    return <><PageHeader eyebrow="A FAIR WAY FORWARD" title="Settlements" description="Propose, review, and track resolutions with a clear maker-checker trail.">{can(user, 'settlement:create') && <button className="button primary" onClick={() => setOpen(true)}><Plus size={16}/>Propose settlement</button>}</PageHeader><Notice>Maker-checker policy: you cannot approve or reject your own proposal. Approved offers remain subject to payment reconciliation.</Notice><Panel><div className="table-toolbar"><div className="tabs" role="group" aria-label="Settlement status">{['All', 'Pending', 'Approved', 'Rejected', 'Paid', 'Expired'].map(s => <button key={s} className={status === s ? 'active' : ''} onClick={() => setStatus(s)}>{s}</button>)}</div><span className="muted">{rows.length} proposals</span></div>{rows.length ? <Table headers={['Account', 'Offer / due date', 'Proposal', 'Maker / checker', 'Status', 'Review']}>{rows.map(s => <tr key={s.id}><td><AccountLabel loan={data.loans.find(l => l.id === s.loanId)} compact/></td><td className="strong">{money(s.amount)}<small className="cell-small">{date(s.dueDate)}</small></td><td className="notes-cell">{s.reason}{s.decisionNote && <small className="cell-small">Decision: {s.decisionNote}</small>}</td><td>{data.users.find(u => u.id === s.makerId)?.name ?? s.makerId}<small className="cell-small">{s.checkerId ? 'Reviewed by ' + (data.users.find(u => u.id === s.checkerId)?.name ?? s.checkerId) : 'Awaiting independent review'}</small></td><td><Badge>{s.status}</Badge></td><td>{s.status === 'Pending' && can(user, 'settlement:review') ? (s.makerId === user.id ? <small className="muted">Needs a different reviewer</small> : <div className="inline-actions"><button className="button small secondary" aria-label={'Approve ' + s.id} onClick={() => { setNote(''); setReview({ id: s.id, decision: 'Approved' }); }}><Check size={15}/>Approve</button><button className="icon-button danger" aria-label={'Reject ' + s.id} onClick={() => { setNote(''); setReview({ id: s.id, decision: 'Rejected' }); }}><X size={17}/></button></div>) : '—'}</td></tr>)}</Table> : <Empty title="No settlements in this view" text="Proposals will appear here once submitted."/>}</Panel>{open && <SettlementModal close={() => setOpen(false)}/>} {review && <Modal title={review.decision === 'Approved' ? 'Approve settlement' : 'Reject settlement'} description="Your decision and note will be recorded in the audit trail." close={() => setReview(null)}><form onSubmit={async (e) => { e.preventDefault(); if (await act(() => gateway.decide(user, review.id, review.decision, note), 'Settlement decision recorded.'))
        setReview(null); }}><div className="modal-body"><Field label="Decision note"><textarea autoFocus required rows={3} maxLength={1000} value={note} onChange={e => setNote(e.target.value)}/></Field></div><div className="modal-footer"><button type="button" className="button secondary" onClick={() => setReview(null)}>Cancel</button><button disabled={busy} className="button primary">Confirm decision</button></div></form></Modal>}</>;
}
