import { createContext, useContext, useEffect, useState } from 'react';
import { DEMO_MODE, gateway } from '../../services/gateway';
import { demoUsers } from '../../services/demo/seed';
const Context = createContext(null);
export function AuthProvider({ children }) {
    const [session, setSession] = useState(() => {
        if (!DEMO_MODE)
            return null;
        try {
            const raw = sessionStorage.getItem('collect.session');
            if (raw)
                return JSON.parse(raw);
        }
        catch { /* use default demo role */ }
        return { user: demoUsers.find(u => u.role === 'MANAGER') };
    });
    const [ready, setReady] = useState(DEMO_MODE);
    useEffect(() => {
        const unauthorized = () => { setSession(null); sessionStorage.removeItem('collect.session'); };
        window.addEventListener('collect:unauthorized', unauthorized);
        let active = true;
        if (!DEMO_MODE && sessionStorage.getItem('collect.token'))
            gateway.me().then(user => { if (active)
                setSession({ user }); }).catch(unauthorized).finally(() => { if (active)
                setReady(true); });
        else
            setReady(true);
        return () => { active = false; window.removeEventListener('collect:unauthorized', unauthorized); };
    }, []);
    const login = async (email, password, role) => {
        const next = await gateway.login(email, password, role);
        if (!DEMO_MODE && !next.token)
            throw new Error('The login response did not include an access token.');
        if (next.token)
            sessionStorage.setItem('collect.token', next.token);
        if (DEMO_MODE)
            sessionStorage.setItem('collect.session', JSON.stringify(next));
        setSession(next);
    };
    const logout = async () => { try {
        await gateway.logout();
    }
    finally {
        sessionStorage.removeItem('collect.token');
        sessionStorage.removeItem('collect.session');
        setSession(null);
    } };
    return <Context.Provider value={{ session, ready, login, logout }}>{children}</Context.Provider>;
}
export function useAuth() { const ctx = useContext(Context); if (!ctx)
    throw new Error('AuthProvider missing'); return ctx; }
