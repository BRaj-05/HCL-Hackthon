import { useState } from 'react';
import { useWorkspace } from '../../app/WorkspaceProvider';
import { useAuth } from '../auth/AuthProvider';
import { gateway } from '../../services/gateway';
import { addDays, today } from '../../lib/format';
import { Field, Modal, Notice } from '../../components/ui';
export function SettlementModal({ close, loanId = '' }) {
    const { data, act, busy } = useWorkspace();
    const { session } = useAuth();
    const [form, setForm] = useState({ loanId, amount: 0, dueDate: addDays(today(), 7), reason: '' });
    const loan = data.loans.find(l => l.id === form.loanId);
    return <Modal title="Propose a settlement" description="Document the offer for an independent reviewer." close={close}><form onSubmit={async (e) => { e.preventDefault(); if (await act(() => gateway.propose(session.user, form), 'Settlement submitted for review.'))
        close(); }}><div className="modal-body form-stack"><Field label="Loan account"><select required value={form.loanId} onChange={e => setForm({ ...form, loanId: e.target.value })}><option value="">Choose an account</option>{data.loans.map(l => <option key={l.id} value={l.id}>{l.id} · {l.borrower}</option>)}</select></Field><div className="form-grid"><Field label="Settlement offer (INR)"><input required type="number" min=".01" step=".01" max={loan?.outstanding} value={form.amount || ''} onChange={e => setForm({ ...form, amount: Number(e.target.value) })}/></Field><Field label="Payment due date"><input required type="date" min={today()} value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })}/></Field></div><Field label="Reason and supporting context"><textarea required minLength={10} maxLength={1000} rows={4} value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="Explain the customer’s situation and the proposed resolution."/></Field><Notice>A different manager or collections head must approve this offer. The proposal does not change the balance until the backend processes it.</Notice></div><div className="modal-footer"><button type="button" className="button secondary" onClick={close}>Cancel</button><button disabled={busy} className="button primary">{busy ? 'Submitting…' : 'Submit for review'}</button></div></form></Modal>;
}
