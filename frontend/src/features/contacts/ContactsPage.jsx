import { useState } from 'react';
import { CalendarCheck2, MessageSquareText, Plus, Search } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceProvider';
import { useAuth } from '../auth/AuthProvider';
import { can } from '../../lib/permissions';
import { date, money, timestamp } from '../../lib/format';
import { AccountLabel } from '../../components/AccountLabel';
import { Badge, Empty, PageHeader, Panel, StatCard, Table } from '../../components/ui';
import { ContactModal } from './ContactModal';
export function ContactsPage() {
    const { data } = useWorkspace();
    const { session } = useAuth();
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState('all');
    const [query, setQuery] = useState('');
    if (!data)
        return null;
    const contacts = [...data.contacts].filter(c => (tab === 'all' || (tab === 'ptp' ? c.outcome === 'Promise to pay' : c.ptpStatus === tab)) && (c.loanId + ' ' + (data.loans.find(l => l.id === c.loanId)?.borrower ?? '') + ' ' + c.notes).toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.contactedAt.localeCompare(a.contactedAt));
    return <><PageHeader eyebrow="A CONVERSATION THAT COUNTS" title="Contacts & promises" description="Keep customer conversations and payment commitments connected.">{can(session.user, 'contact:create') && <button className="button primary" onClick={() => setOpen(true)}><Plus size={16}/>Log contact</button>}</PageHeader><div className="stats-grid three"><StatCard label="Total contacts" value={String(data.contacts.length)} detail="Across your accessible accounts" icon={MessageSquareText}/><StatCard label="Open promises" value={String(data.contacts.filter(c => c.ptpStatus === 'Pending').length)} detail="Payment commitments to follow up" icon={CalendarCheck2} tone="blue"/><StatCard label="Broken promises" value={String(data.contacts.filter(c => c.ptpStatus === 'Broken').length)} detail="Review after reconciliation" icon={CalendarCheck2} tone="peach"/></div><Panel><div className="table-toolbar"><div className="tabs" role="group" aria-label="Filter contacts">{[['all', 'All contacts'], ['ptp', 'All promises'], ['Pending', 'Pending'], ['Kept', 'Kept'], ['Broken', 'Broken']].map(([v, l]) => <button key={v} className={tab === v ? 'active' : ''} onClick={() => setTab(v)}>{l}</button>)}</div><div className="search-input"><Search size={16}/><input aria-label="Search contacts" placeholder="Search contacts…" value={query} onChange={e => setQuery(e.target.value)}/></div></div>{contacts.length ? <Table headers={['Account', 'Contact', 'Outcome', 'Notes', 'Promise', 'Status']}>{contacts.map(c => <tr key={c.id}><td><AccountLabel loan={data.loans.find(l => l.id === c.loanId)} compact/></td><td>{c.channel}<small className="cell-small">{timestamp(c.contactedAt)} IST</small><small className="cell-small">{data.users.find(u => u.id === c.collectorId)?.name}</small></td><td><Badge>{c.outcome}</Badge></td><td className="notes-cell">{c.notes}</td><td>{c.ptpAmount ? money(c.ptpAmount) : '—'}<small className="cell-small">{date(c.ptpDate)}</small></td><td>{c.ptpStatus ? <Badge>{c.ptpStatus}</Badge> : '—'}</td></tr>)}</Table> : <Empty title="No contacts to show" text="Log a contact or adjust the selected filter."/>}</Panel>{open && <ContactModal close={() => setOpen(false)}/>}</>;
}
