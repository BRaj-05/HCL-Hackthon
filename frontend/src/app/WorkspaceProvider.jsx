import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from '../features/auth/AuthProvider';
import { gateway } from '../services/gateway';
import { errorMessage } from '../lib/format';
const Context = createContext(null);
export function WorkspaceProvider({ children }) {
    const { session } = useAuth();
    const [state, setState] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [toast, setToast] = useState(null);
    const generation = useRef(0);
    const timer = useRef(undefined);
    const acting = useRef(false);
    const notify = useCallback((message, tone = 'success') => {
        clearTimeout(timer.current);
        setToast({ message, tone });
        timer.current = setTimeout(() => setToast(null), 5500);
    }, []);
    useEffect(() => () => clearTimeout(timer.current), []);
    const refresh = useCallback(async () => {
        if (!session)
            return;
        const requestId = ++generation.current;
        setLoading(true);
        setError('');
        try {
            const data = await gateway.load(session.user);
            if (requestId === generation.current)
                setState({ owner: session.user.id, data });
        }
        catch (err) {
            if (requestId === generation.current)
                setError(errorMessage(err));
        }
        finally {
            if (requestId === generation.current)
                setLoading(false);
        }
    }, [session]);
    useEffect(() => { setState(null); void refresh(); return () => { generation.current++; }; }, [refresh]);
    const act = async (action, success) => {
        if (acting.current)
            return false;
        acting.current = true;
        setBusy(true);
        try {
            await action();
            await refresh();
            notify(success);
            return true;
        }
        catch (err) {
            notify(errorMessage(err), 'error');
            return false;
        }
        finally {
            acting.current = false;
            setBusy(false);
        }
    };
    return <Context.Provider value={{ data: state?.owner === session?.user.id ? state.data : null, loading, error, busy, refresh, act, notify }}>
    {children}
    {toast && <div className={'toast ' + toast.tone} role={toast.tone === 'error' ? 'alert' : 'status'}>{toast.message}<button aria-label="Dismiss notification" onClick={() => setToast(null)}>×</button></div>}
  </Context.Provider>;
}
export function useWorkspace() { const ctx = useContext(Context); if (!ctx)
    throw new Error('WorkspaceProvider missing'); return ctx; }
