import { useState } from 'react';
import { ArrowRight, Check, ShieldCheck } from 'lucide-react';
import { useAuth } from './AuthProvider';
import { DEMO_MODE } from '../../services/gateway';
import { errorMessage } from '../../lib/format';
import { Field } from '../../components/ui';
export function LoginPage() {
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('MANAGER');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const submit = async (e) => { e.preventDefault(); setError(''); setBusy(true); try {
        await login(email, password, role);
    }
    catch (err) {
        setError(errorMessage(err));
    }
    finally {
        setBusy(false);
    } };
    return <div className="login-page"><section className="login-story"><div className="brand light">collect.</div><div><span className="eyebrow">EVERY ACCOUNT. A WAY FORWARD.</span><h1>Thoughtful collections.<br />Clearer outcomes.</h1><p>One workspace to plan your day, support your customers, and keep your team moving together.</p><div className="login-features">{['Your priorities, in one place', 'A complete account of every action', 'Built for your whole collections team'].map(s => <span key={s}><Check size={17}/>{s}</span>)}</div></div><small>HCL Hackathon · Collections management</small></section><section className="login-form-wrap"><form className="login-form" onSubmit={e => void submit(e)}><span className="login-icon"><ShieldCheck size={26}/></span><h2>Welcome to your workspace</h2><p>{DEMO_MODE ? 'Choose a role to explore the demo.' : 'Sign in to continue to Collect.'}</p>{DEMO_MODE ? <Field label="Workspace role"><select value={role} onChange={e => setRole(e.target.value)}><option value="COLLECTOR">Collector</option><option value="MANAGER">Manager</option><option value="HEAD">Collections head</option><option value="AUDITOR">Auditor</option></select></Field> : <><Field label="Email address"><input required type="email" autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com"/></Field><Field label="Password"><input required type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)}/></Field></>}{error && <p role="alert" className="form-error">{error}</p>}<button className="button primary full" disabled={busy}>{busy ? 'Signing in…' : 'Enter workspace'}<ArrowRight size={17}/></button><p className="login-note">{DEMO_MODE ? 'Illustrative data. Changes stay in your browser.' : 'Access is managed by your organization.'}</p></form></section></div>;
}
