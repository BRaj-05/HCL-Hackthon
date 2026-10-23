import { cloneElement, useEffect, useId, useRef } from 'react';
import { ArrowUpRight, Inbox, X } from 'lucide-react';
export function PageHeader({ eyebrow, title, description, children }) {
    return <div className="page-heading"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1><p>{description}</p></div><div className="heading-actions">{children}</div></div>;
}
export function Badge({ children, tone }) {
    const value = String(children).toLowerCase();
    const derived = ['approved', 'completed', 'kept', 'sent', 'paid', 'current', 'connected', 'low'].includes(value) ? 'green' : ['high', 'broken', 'rejected', 'failed', 'expired', '90+'].includes(value) ? 'red' : ['pending', 'queued', 'medium', 'on hold', 'running'].includes(value) ? 'amber' : 'neutral';
    return <span className={'badge ' + (tone || derived)}><span className="badge-dot"/>{children}</span>;
}
export function StatCard({ label, value, detail, icon: Icon, tone = 'mint' }) {
    return <div className="stat-card"><div className="stat-top"><span>{label}</span><span className={'stat-icon ' + tone}><Icon size={19} strokeWidth={1.7}/></span></div><div className="stat-value">{value}</div><div className="stat-detail">{detail}</div></div>;
}
export function Panel({ title, subtitle, children, action, className = '' }) {
    return <section className={'panel ' + className}>{title && <div className="panel-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{action}</div>}{children}</section>;
}
export function Empty({ title = 'Nothing here yet', text = 'Records will appear here as you work.', children }) {
    return <div className="empty"><Inbox size={30} strokeWidth={1.3}/><h3>{title}</h3><p>{text}</p>{children}</div>;
}
export function Modal({ title, description, children, close }) {
    const ref = useRef(null);
    useEffect(() => { const el = ref.current; el.showModal(); const previous = document.body.style.overflow; document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = previous; }; }, []);
    return <dialog ref={ref} className="modal" aria-labelledby="modal-title" onCancel={close} onClick={e => { if (e.target === ref.current)
        close(); }}>
    <div className="modal-header"><div><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div><button className="icon-button" aria-label="Close dialog" onClick={close}><X size={19}/></button></div>
    {children}
  </dialog>;
}
export function Field({ label, children, hint }) {
    const labelId = useId();
    return <label className="field"><span id={labelId}>{label}</span>{cloneElement(children, { "aria-labelledby": labelId })}{hint && <small>{hint}</small>}</label>;
}
export function Notice({ children, tone = 'info' }) { return <div className={'notice ' + tone}>{children}</div>; }
export function ArrowLink() { return <ArrowUpRight size={16} aria-hidden="true"/>; }
export function Table({ headers, children }) { return <div className="table-scroll"><table><thead><tr>{headers.map(h => <th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>; }
