import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Activity, ArrowDownToLine, ArrowUpFromLine, CalendarDays, ChevronDown, ChevronRight, CircleHelp, ClipboardList, Clock3, FileCheck2, Landmark, LayoutDashboard, LogOut, Menu, MessageSquareText, RefreshCw, Search, Settings2, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useAuth } from '../features/auth/AuthProvider';
import { useWorkspace } from '../app/WorkspaceProvider';
import { AI_ENABLED, DEMO_MODE } from '../services/gateway';
import { date, initials } from '../lib/format';
import { roleName } from '../lib/permissions';
import { Modal } from './ui';
const groups = [
    { title: 'WORKSPACE', links: [{ to: '/', label: 'Overview', icon: LayoutDashboard }, { to: '/worklist', label: 'Plan for the day', icon: ClipboardList }, { to: '/loans', label: 'Loan accounts', icon: Landmark }] },
    { title: 'COLLECTIONS', links: [{ to: '/contacts', label: 'Contacts & promises', icon: MessageSquareText }, { to: '/settlements', label: 'Settlements', icon: FileCheck2 }, { to: '/reconciliation', label: 'Reconciliation', icon: RefreshCw }] },
    { title: 'OPERATIONS', links: [{ to: '/day-end', label: 'Day-end pipeline', icon: Clock3 }, { to: '/imports', label: 'Import data', icon: ArrowUpFromLine }, { to: '/exports', label: 'Export reports', icon: ArrowDownToLine }, { to: '/rules', label: 'Collection rules', icon: Settings2 }, { to: '/audit', label: 'Audit trail', icon: ShieldCheck }] },
];
export function AppShell() {
    const { session, login, logout } = useAuth();
    const { data, refresh, loading } = useWorkspace();
    const [mobile, setMobile] = useState(false);
    const [help, setHelp] = useState(false);
    const [query, setQuery] = useState('');
    const location = useLocation();
    const navigate = useNavigate();
    const user = session.user;
    const current = groups.flatMap(g => g.links).find(l => l.to === location.pathname)?.label ?? (location.pathname.startsWith('/loans/') ? 'Account details' : 'AI insights');
    return <div className="app-layout">
    {mobile && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobile(false)}/>}
    <aside className={'sidebar ' + (mobile ? 'mobile-open' : '')}>
      <NavLink to="/" className="brand"><span className="brand-symbol">c<span /></span>collect<span className="brand-period">.</span></NavLink>
      <div className="workspace-selector"><span className="workspace-avatar">C</span><span><strong>Collections workspace</strong><small>HCL · Operations</small></span><ChevronDown size={14}/></div>
      <nav aria-label="Main navigation">{groups.map(group => <div className="nav-group" key={group.title}><div className="nav-heading">{group.title}</div>{group.links.map(({ to, label, icon: Icon }) => <NavLink key={to} to={to} end={to === '/'} onClick={() => setMobile(false)} className={({ isActive }) => 'nav-link ' + (isActive ? 'active' : '')}><Icon size={18} strokeWidth={1.7}/><span>{label}</span>{to === '/settlements' && !!data?.settlements.filter(s => s.status === 'Pending').length && <span className="nav-count">{data.settlements.filter(s => s.status === 'Pending').length}</span>}</NavLink>)}</div>)}
      {AI_ENABLED && <div className="nav-group"><NavLink to="/insights" onClick={() => setMobile(false)} className={({ isActive }) => 'nav-link ' + (isActive ? 'active' : '')}><Sparkles size={18}/><span>AI insights</span><span className="tiny-tag">LABS</span></NavLink></div>}</nav>
      <div className="sidebar-bottom"><div className="system-status"><span className="status-dot"/><span>{DEMO_MODE ? 'Demo workspace' : 'Live workspace'}</span><Activity size={14}/></div><button className="nav-link" onClick={() => setHelp(true)}><CircleHelp size={18}/>Help & workspace guide<ChevronRight size={14}/></button></div>
    </aside>
    <div className="main-shell"><header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobile(true)}><Menu size={20}/></button><span>Workspace</span><ChevronRight size={13}/><strong>{current}</strong></div><div className="topbar-actions"><form className="global-search" role="search" onSubmit={e => { e.preventDefault(); navigate('/loans?q=' + encodeURIComponent(query)); }}><Search size={16}/><input aria-label="Search accounts" placeholder="Search accounts..." value={query} onChange={e => setQuery(e.target.value)}/><kbd>↵</kbd></form><button className="icon-button refresh-button" title="Refresh workspace" aria-label="Refresh workspace" disabled={loading} onClick={() => void refresh()}><RefreshCw size={17} className={loading ? 'spin' : ''}/></button><div className="topbar-divider"/><span className="user-avatar">{initials(user.name)}</span><div className="user-info"><strong>{user.name}</strong>{DEMO_MODE ? <select aria-label="Demo role" value={user.role} onChange={e => { void login('', '', e.target.value); navigate('/'); }}><option value="COLLECTOR">Collector</option><option value="MANAGER">Manager</option><option value="HEAD">Collections head</option><option value="AUDITOR">Auditor</option></select> : <small>{roleName(user.role)}</small>}</div><button className="icon-button" title="Sign out" aria-label="Sign out" onClick={() => void logout()}><LogOut size={16}/></button></div></header>
    <main id="main-content" className="page-content"><div className="workspace-context"><span><span className="status-dot"/>{DEMO_MODE ? 'DEMO DATA' : 'LIVE WORKSPACE'}</span><span><CalendarDays size={13}/>As of {data ? date(data.asOf) : '—'} <span className="timezone">IST</span></span></div><Outlet /></main>
    <footer className="app-footer"><span>Collect · A little clarity. Better collections.</span><span><ShieldCheck size={13}/>{roleName(user.role)} access<span className="footer-dot">·</span>{DEMO_MODE ? 'Local demo · no messages are sent' : 'Asia/Kolkata (IST)'}</span></footer></div>
    {help && <Modal title="Your collections workspace" description="A guide to the daily workflow" close={() => setHelp(false)}><div className="modal-body guide"><p>1. Import loans, schedules, payments and contacts from the Import data page.</p><p>2. Run the Day-end pipeline for an as-of date to refresh account positions, priorities and promises.</p><p>3. Use Plan for the day to assign accounts, open loan details and record contacts or promises.</p><p>4. Submit settlement proposals. A different manager or head must review each proposal.</p><p>5. Reconcile payments, review reminders and export the collection and settlement CSVs.</p><p><strong>{DEMO_MODE ? 'Demo mode:' : 'Live mode:'}</strong> {DEMO_MODE ? 'Data is stored in this browser. Financial formulas, R1–R12 labels and AI scores are illustrative until the case-study rules and backend are supplied. Queued messages are never actually delivered.' : 'All records and authorized actions are provided by your REST API.'}</p><p>Collectors see assigned accounts. Auditors have read-only access and can export. Only the head can change optional rules.</p></div><div className="modal-footer"><button className="button primary" onClick={() => setHelp(false)}>Got it<X size={15}/></button></div></Modal>}
  </div>;
}
