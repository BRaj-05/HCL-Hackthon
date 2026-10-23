import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Download, Search, SlidersHorizontal, UserPlus } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceProvider';
import { useAuth } from '../auth/AuthProvider';
import { AI_ENABLED, gateway } from '../../services/gateway';
import { can } from '../../lib/permissions';
import { money } from '../../lib/format';
import { AccountLabel } from '../../components/AccountLabel';
import { Badge, Empty, Field, Modal, Notice, PageHeader, Panel, Table } from '../../components/ui';
export function LoansPage({ worklist = false }) {
    const { data, act, busy } = useWorkspace();
    const { session } = useAuth();
    const user = session.user;
    const [params] = useSearchParams();
    const [query, setQuery] = useState(params.get('q') ?? '');
    const [bucket, setBucket] = useState('All buckets');
    const [collector, setCollector] = useState('');
    const [sort, setSort] = useState('priority');
    const [includeHeld, setIncludeHeld] = useState(!worklist);
    const [selected, setSelected] = useState([]);
    const [assign, setAssign] = useState(false);
    const [assignee, setAssignee] = useState('collector-1');
    const [page, setPage] = useState(1);
    const search = params.get('q') ?? '';
    const [previousSearch, setPreviousSearch] = useState(search);
    if (search !== previousSearch) {
        setPreviousSearch(search);
        setQuery(search);
        setPage(1);
    }
    const loans = useMemo(() => {
        if (!data)
            return [];
        const items = data.loans.filter(l => (!worklist || l.dues > 0) && (includeHeld || !(l.holdUntil && l.holdUntil >= data.asOf)) && (!collector || l.collectorId === collector) && (bucket === 'All buckets' || l.bucket === bucket) && (l.borrower + ' ' + l.id + ' ' + l.phone + ' ' + l.city).toLowerCase().includes(query.toLowerCase()));
        const rank = { High: 3, Medium: 2, Low: 1 };
        const rule = (id) => data.rules.find(r => r.id === id)?.enabled ?? true;
        const duePromise = (id) => rule('R7') && data.contacts.some(c => c.loanId === id && c.ptpDate === data.asOf && c.ptpStatus === 'Pending') ? 1 : 0;
        return items.sort((a, b) => sort === 'recovery' ? (data.scores.find(s => s.loanId === b.id)?.expectedRecovery ?? 0) - (data.scores.find(s => s.loanId === a.id)?.expectedRecovery ?? 0) : sort === 'dues' ? b.dues - a.dues : sort === 'dpd' ? b.dpd - a.dpd : sort === 'name' ? a.borrower.localeCompare(b.borrower) : rule('R12') ? duePromise(b.id) - duePromise(a.id) || rank[b.priority] - rank[a.priority] || b.dpd - a.dpd : a.id.localeCompare(b.id));
    }, [data, worklist, includeHeld, collector, bucket, query, sort]);
    if (!data)
        return null;
    const pages = Math.max(1, Math.ceil(loans.length / 8));
    const current = Math.min(page, pages);
    const visible = loans.slice((current - 1) * 8, current * 8);
    const allChecked = visible.length > 0 && visible.every(l => selected.includes(l.id));
    const toggle = (id) => setSelected(v => v.includes(id) ? v.filter(x => x !== id) : [...v, id]);
    return <><PageHeader eyebrow={worklist ? 'YOUR DAILY PRIORITIES' : 'A COMPLETE PORTFOLIO VIEW'} title={worklist ? 'Plan for the day' : 'Loan accounts'} description={worklist ? 'A clear queue. The right account. The next best action.' : 'Every account, with the context you need to move it forward.'}><Link to="/exports" className="button secondary"><Download size={16}/>Export accounts</Link>{can(user, 'worklist:assign') && <button className="button primary" disabled={!selected.length || busy} onClick={() => setAssign(true)}><UserPlus size={16}/>Assign {selected.length ? '(' + selected.length + ')' : 'accounts'}</button>}</PageHeader>
    <div className="summary-strip"><div><span>{worklist ? 'Accounts in queue' : 'Portfolio accounts'}</span><strong>{loans.length}</strong></div><div><span>Total amount due</span><strong>{money(loans.reduce((s, l) => s + l.dues, 0))}</strong></div><div><span>High priority</span><strong>{loans.filter(l => l.priority === 'High').length}</strong></div><div><span>As-of active holds</span><strong>{data.loans.filter(l => l.holdUntil && l.holdUntil >= data.asOf).length}</strong></div></div>
    {worklist && <Notice>Queue reflects the last calculated position. Run day-end after importing data to refresh priorities and balances.</Notice>}
    <Panel><div className="table-toolbar"><div className="search-input"><Search size={16}/><input aria-label="Filter accounts" placeholder="Search name, account, phone or city…" value={query} onChange={e => { setQuery(e.target.value); setPage(1); }}/></div><div className="filter-group"><SlidersHorizontal size={16}/><select aria-label="Filter overdue bucket" value={bucket} onChange={e => { setBucket(e.target.value); setPage(1); }}>{['All buckets', 'Current', '1–30', '31–60', '61–90', '90+'].map(b => <option key={b}>{b}</option>)}</select><select aria-label="Filter collector" value={collector} onChange={e => { setCollector(e.target.value); setPage(1); }}><option value="">All collectors</option>{data.users.filter(u => u.role === 'COLLECTOR').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select><select aria-label="Sort accounts" value={sort} onChange={e => setSort(e.target.value)}><option value="priority">Priority first</option><option value="dpd">Highest DPD</option><option value="dues">Highest dues</option><option value="name">Borrower A–Z</option>{AI_ENABLED && <option value="recovery">Expected recovery</option>}</select></div></div>
    <div className="table-subbar"><span>{loans.length} accounts{selected.length ? ' · ' + selected.length + ' selected' : ''}</span><label className="checkbox-inline"><input type="checkbox" checked={includeHeld} onChange={e => setIncludeHeld(e.target.checked)}/>Include accounts on hold</label></div>
    {visible.length ? <Table headers={[...(can(user, 'worklist:assign') ? ['Select'] : []), 'Account', 'Amount due', 'Outstanding', 'DPD / bucket', 'Collector', 'Next action', '']}>{visible.map(l => <tr key={l.id}>{can(user, 'worklist:assign') && <td><input type="checkbox" aria-label={'Select ' + l.id} checked={selected.includes(l.id)} onChange={() => toggle(l.id)}/></td>}<td><AccountLabel loan={l}/></td><td className="strong numeric">{money(l.dues)}<small className="cell-small">+ {money(l.penal)} penal</small></td><td className="numeric">{money(l.outstanding)}</td><td><strong>{l.dpd} days</strong><small className="cell-small">{l.bucket}</small></td><td>{data.users.find(u => u.id === l.collectorId)?.name ?? 'Unassigned'}</td><td><Badge>{l.strategy === 'On hold' ? 'On hold' : l.priority}</Badge><small className="cell-small">{l.strategy}</small></td><td><Link className="table-arrow" aria-label={'Open ' + l.borrower} to={'/loans/' + l.id}><ArrowRight size={17}/></Link></td></tr>)}</Table> : <Empty title="No matching accounts" text="Try a different search or adjust your filters."/>}
    <div className="pagination"><div>{can(user, 'worklist:assign') && !!visible.length && <label className="checkbox-inline"><input type="checkbox" aria-label="Select visible accounts" checked={allChecked} onChange={() => setSelected(allChecked ? selected.filter(id => !visible.some(l => l.id === id)) : [...new Set([...selected, ...visible.map(l => l.id)])])}/>Select page</label>}<span>{loans.length ? (current - 1) * 8 + 1 : 0}–{Math.min(current * 8, loans.length)} of {loans.length}</span></div><div><button className="button small secondary" disabled={current === 1} onClick={() => setPage(current - 1)}>Previous</button><span>{current} / {pages}</span><button className="button small secondary" disabled={current === pages} onClick={() => setPage(current + 1)}>Next</button></div></div></Panel>
    {assign && <Modal title="Assign selected accounts" description={selected.length + ' accounts will move to the selected collector’s worklist.'} close={() => setAssign(false)}><form onSubmit={async (e) => { e.preventDefault(); if (await act(() => gateway.assign(user, selected, assignee), 'Collector assignments updated.')) {
        setAssign(false);
        setSelected([]);
    } }}><div className="modal-body"><Field label="Collector"><select value={assignee} onChange={e => setAssignee(e.target.value)}>{data.users.filter(u => u.role === 'COLLECTOR').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select></Field></div><div className="modal-footer"><button type="button" className="button secondary" onClick={() => setAssign(false)}>Cancel</button><button className="button primary" disabled={busy}>Assign accounts</button></div></form></Modal>}
  </>;
}
