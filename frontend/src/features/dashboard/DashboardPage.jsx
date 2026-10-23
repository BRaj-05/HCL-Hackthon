import { Link } from 'react-router-dom';
import { ArrowRight, CalendarCheck2, ChartNoAxesCombined, CheckCheck, Clock3, IndianRupee, Landmark, ListChecks, Sparkles, Target } from 'lucide-react';
import { useWorkspace } from '../../app/WorkspaceProvider';
import { useAuth } from '../auth/AuthProvider';
import { AI_ENABLED } from '../../services/gateway';
import { addDays, date, money, number } from '../../lib/format';
import { AccountLabel } from '../../components/AccountLabel';
import { Badge, Empty, PageHeader, Panel, StatCard, Table } from '../../components/ui';
export function DashboardPage() {
    const { data } = useWorkspace();
    const { session } = useAuth();
    if (!data)
        return null;
    const recent = data.payments.filter(p => p.date >= addDays(data.asOf, -6) && p.date <= data.asOf);
    const collected = recent.reduce((s, p) => s + p.amount, 0);
    const overdue = data.loans.filter(l => l.dpd > 0);
    const dues = data.loans.reduce((s, l) => s + l.dues, 0);
    const ptps = data.contacts.filter(c => c.outcome === 'Promise to pay');
    const kept = ptps.filter(c => c.ptpStatus === 'Kept').length;
    const rate = ptps.length ? Math.round(kept / ptps.length * 100) : 0;
    const focus = [...data.loans].filter(l => l.dues > 0 && !(l.holdUntil && l.holdUntil >= data.asOf)).sort((a, b) => b.dpd - a.dpd).slice(0, 5);
    const days = Array.from({ length: 7 }, (_, i) => addDays(data.asOf, i - 6));
    const values = days.map(d => recent.filter(p => p.date === d).reduce((s, p) => s + p.amount, 0));
    const max = Math.max(...values, 1);
    const points = values.map((v, i) => (44 + i * 86) + ',' + (174 - v / max * 128)).join(' ');
    const pending = data.settlements.filter(s => s.status === 'Pending').length;
    const promisesDue = ptps.filter(p => p.ptpStatus === 'Pending' && p.ptpDate === data.asOf).length;
    const outstanding = data.loans.reduce((s, l) => s + l.outstanding, 0);
    return <>
    <PageHeader eyebrow="A CLEAR VIEW OF YOUR DAY" title={'Welcome back, ' + session.user.name.split(' ')[0] + '.'} description="Here’s where your collections stand. Let’s make progress.">
      <Link className="button secondary" to="/exports"><ChartNoAxesCombined size={16}/>View reports</Link><Link className="button primary" to="/worklist">Open today’s plan<ArrowRight size={16}/></Link>
    </PageHeader>
    <div className="focus-banner"><span className="focus-banner-icon"><Target size={26} strokeWidth={1.5}/></span><div><h2>A focused day starts here.</h2><p><strong>{overdue.length} accounts</strong> need your attention. {promisesDue} promises are due as of {date(data.asOf)}.</p></div><Link to="/worklist" className="text-link">See your priorities<ArrowRight size={17}/></Link><div className="banner-rings" aria-hidden="true"/></div>
    <div className="stats-grid"><StatCard label="Total outstanding" value={money(outstanding, true)} detail={number(data.loans.length) + ' active loan accounts'} icon={Landmark}/><StatCard label="Collected · last 7 days" value={money(collected, true)} detail={recent.length + ' payments received'} icon={IndianRupee} tone="blue"/><StatCard label="Overdue accounts" value={number(overdue.length)} detail={money(dues, true) + ' total dues'} icon={Clock3} tone="peach"/><StatCard label="Promises kept" value={rate + '%'} detail={kept + ' of ' + ptps.length + ' recorded promises'} icon={CheckCheck} tone="lavender"/></div>
    <div className="dashboard-middle"><Panel title="Collection activity" subtitle="Payments received over the last 7 days" action={<span className="chart-legend"><span />Amount collected</span>}>
      <div className="chart-total">{money(collected)}<span> across {recent.length} payments</span></div>
      <div className="activity-chart"><svg viewBox="0 0 600 220" role="img" aria-label={'Collections over the last seven days: ' + days.map((d, i) => date(d) + ': ' + money(values[i])).join('; ')}><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#77b8a0" stopOpacity=".25"/><stop offset="100%" stopColor="#77b8a0" stopOpacity="0"/></linearGradient></defs>{[46, 88, 131, 174].map((y, i) => <g key={y}><line x1="44" x2="566" y1={y} y2={y} stroke="#edf0ef" strokeDasharray="4 5"/><text x="0" y={y + 4} fill="#8b9791" fontSize="10">{money(max * (1 - i / 3), true)}</text></g>)}<polygon points={'44,174 ' + points + ' 560,174'} fill="url(#chart-fill)"/><polyline points={points} fill="none" stroke="#36836b" strokeWidth="2.5" strokeLinejoin="round"/>{values.map((v, i) => <g key={days[i]}><circle cx={44 + i * 86} cy={174 - v / max * 128} r="4" fill="#fff" stroke="#36836b" strokeWidth="2"><title>{date(days[i])}: {money(v)}</title></circle><text x={44 + i * 86} y="204" textAnchor="middle" fill="#839089" fontSize="11">{new Date(days[i] + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'short', timeZone: 'UTC' })}</text></g>)}</svg></div>
    </Panel><Panel title="Portfolio health" subtitle="Accounts by overdue bucket"><div className="portfolio-total">{data.loans.length}<span>total accounts</span></div><div className="bucket-stack">{['Current', '1–30', '31–60', '61–90', '90+'].map((b, i) => { const count = data.loans.filter(l => l.bucket === b).length; return count ? <span key={b} className={'bucket-color b' + i} style={{ width: count / Math.max(data.loans.length, 1) * 100 + '%' }} title={b + ': ' + count}/> : null; })}</div><div className="bucket-list">{['Current', '1–30', '31–60', '61–90', '90+'].map((b, i) => <div key={b}><span><i className={'bucket-color b' + i}/>{b === 'Current' ? b : b + ' days'}</span><strong>{data.loans.filter(l => l.bucket === b).length}<small>{Math.round(data.loans.filter(l => l.bucket === b).length / Math.max(data.loans.length, 1) * 100)}%</small></strong></div>)}</div></Panel></div>
    <div className="dashboard-bottom"><Panel title="Accounts to focus on" subtitle="Your highest overdue accounts, with active holds excluded" action={<Link to="/worklist" className="text-link">View worklist<ArrowRight size={15}/></Link>}>{focus.length ? <Table headers={['Account', 'Amount due', 'DPD', 'Priority', '']}>{focus.map(l => <tr key={l.id}><td><AccountLabel loan={l}/></td><td className="numeric strong">{money(l.dues)}</td><td>{l.dpd}<span className="muted"> days</span></td><td><Badge>{l.priority}</Badge></td><td><Link className="table-arrow" aria-label={'Open ' + l.borrower} to={'/loans/' + l.id}><ArrowRight size={17}/></Link></td></tr>)}</Table> : <Empty title="All caught up" text="No overdue accounts need attention."/>}</Panel>
    <Panel title="On your radar" subtitle="A few things to keep moving"><div className="radar-list"><Link to="/contacts"><span className="radar-icon mint"><CalendarCheck2 size={20}/></span><span><strong>{promisesDue} promises due</strong><small>Follow up on payment commitments</small></span><ArrowRight size={15}/></Link><Link to="/settlements"><span className="radar-icon peach"><ListChecks size={20}/></span><span><strong>{pending} settlements to review</strong><small>Keep the approval process moving</small></span><ArrowRight size={15}/></Link><Link to="/reconciliation"><span className="radar-icon blue"><CheckCheck size={20}/></span><span><strong>{data.payments.filter(p => !p.reconciled).length} payments to reconcile</strong><small>Match payments with promises</small></span><ArrowRight size={15}/></Link></div>{AI_ENABLED && <Link to="/insights" className="insights-card"><Sparkles size={19}/><div><strong>A little intelligence. More clarity.</strong><p>Explore recovery scores and key signals.</p></div><ArrowRight size={16}/></Link>}</Panel></div>
  </>;
}
