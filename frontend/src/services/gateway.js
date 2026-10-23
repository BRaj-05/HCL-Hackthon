import { authApi } from './api/auth.api';
import { accountsApi } from './api/accounts.api';
import { contactsApi } from './api/contacts.api';
import { settlementsApi } from './api/settlements.api';
import { operationsApi } from './api/operations.api';
import { reportsApi } from './api/reports.api';
import { csvText } from '../lib/csv';
import { requirePermission } from '../lib/permissions';
import { today, uniqueId } from '../lib/format';
import { contactSchema, settlementSchema, validate } from '../lib/validation';
import { demoUsers, seedWorkspace } from './demo/seed';
import { calculatePositions, executeDayEnd, reconcileRecords } from './demo/engine';
export const DEMO_MODE = import.meta.env.VITE_DEMO_MODE !== 'false';
export const AI_ENABLED = import.meta.env.VITE_ENABLE_AI !== 'false';
const key = 'collect.workspace.v1';
let volatile;
const clone = (value) => structuredClone(value);
function read() {
    if (volatile)
        return clone(volatile);
    try {
        const raw = localStorage.getItem(key);
        if (raw)
            return JSON.parse(raw);
    }
    catch { /* browser storage may be unavailable */ }
    const db = seedWorkspace();
    calculatePositions(db, db.asOf);
    reconcileRecords(db, db.asOf);
    return db;
}
function save(db) {
    try {
        localStorage.setItem(key, JSON.stringify(db));
        volatile = clone(db);
    }
    catch {
        throw new Error('Browser storage is full or disabled. The change was not saved.');
    }
}
function audit(db, user, action, entity, detail) {
    db.audit.unshift({ id: uniqueId('AUD'), actor: user.name, role: user.role, action, entity, detail, at: new Date().toISOString() });
}
function scoped(db, user) {
    if (user.role !== 'COLLECTOR')
        return db;
    const ids = new Set(db.loans.filter(l => l.collectorId === user.id).map(l => l.id));
    return { ...db, loans: db.loans.filter(l => ids.has(l.id)), schedules: db.schedules.filter(s => ids.has(s.loanId)), payments: db.payments.filter(p => ids.has(p.loanId)), contacts: db.contacts.filter(c => ids.has(c.loanId)), settlements: db.settlements.filter(s => ids.has(s.loanId)), scores: db.scores.filter(s => ids.has(s.loanId)), outbox: db.outbox.filter(e => ids.has(e.loanId)), audit: db.audit.filter(e => ids.has(e.entity) || e.actor === user.name), runs: [], imports: [] };
}
function owned(db, user, loanId) {
    const loan = db.loans.find(l => l.id === loanId);
    if (!loan)
        throw new Error('Account not found.');
    if (user.role === 'COLLECTOR' && loan.collectorId !== user.id)
        throw new Error('403: This account is not assigned to you.');
    return loan;
}
export const gateway = {
    async login(email, password, role) {
        if (!DEMO_MODE)
            return authApi.login(email, password);
        const user = demoUsers.find(u => u.role === role);
        if (!user)
            throw new Error('Select a demo role.');
        return { user };
    },
    async me() { return authApi.me(); },
    async logout() { if (!DEMO_MODE)
        await authApi.logout(); },
    async load(user) {
        return DEMO_MODE ? scoped(read(), user) : accountsApi.workspace();
    },
    async contact(user, input) {
        requirePermission(user, 'contact:create');
        const data = validate(contactSchema, input);
        if (!DEMO_MODE)
            return contactsApi.create(data);
        const db = read();
        const loan = owned(db, user, data.loanId);
        if (loan.holdUntil && loan.holdUntil >= today())
            throw new Error('This account is on hold. Resolve the hold before making contact.');
        db.contacts.unshift({ ...data, contactedAt: data.contactedAt.includes('+') || data.contactedAt.endsWith('Z') ? data.contactedAt : data.contactedAt + ':00+05:30', id: uniqueId('CT'), collectorId: user.id, ...(data.outcome === 'Promise to pay' ? { ptpStatus: 'Pending' } : { ptpDate: undefined, ptpAmount: undefined }) });
        audit(db, user, 'Contact logged', data.loanId, data.outcome + ': ' + data.notes);
        save(db);
    },
    async propose(user, input) {
        requirePermission(user, 'settlement:create');
        const data = validate(settlementSchema, input);
        if (!DEMO_MODE)
            return settlementsApi.propose(data);
        const db = read();
        const loan = owned(db, user, data.loanId);
        if (data.amount > loan.outstanding)
            throw new Error('Offer cannot exceed the outstanding balance.');
        if (db.settlements.some(s => s.loanId === data.loanId && ['Pending', 'Approved'].includes(s.status)))
            throw new Error('This account already has an active settlement.');
        db.settlements.unshift({ ...data, id: uniqueId('ST'), makerId: user.id, createdAt: new Date().toISOString(), status: 'Pending' });
        audit(db, user, 'Settlement proposed', data.loanId, 'Offer: INR ' + data.amount);
        save(db);
    },
    async decide(user, id, decision, note) {
        requirePermission(user, 'settlement:review');
        if (!note.trim())
            throw new Error('Add a decision note.');
        if (!DEMO_MODE)
            return settlementsApi.decide(id, decision, note);
        const db = read();
        const settlement = db.settlements.find(s => s.id === id);
        if (!settlement || settlement.status !== 'Pending')
            throw new Error('This proposal is no longer pending.');
        if (settlement.makerId === user.id)
            throw new Error('Maker-checker policy: a different reviewer must make the decision.');
        Object.assign(settlement, { status: decision, checkerId: user.id, decisionNote: note.trim(), decidedAt: new Date().toISOString() });
        audit(db, user, 'Settlement ' + decision.toLowerCase(), settlement.loanId, note);
        save(db);
    },
    async assign(user, loanIds, collectorId) {
        requirePermission(user, 'worklist:assign');
        if (!DEMO_MODE)
            return accountsApi.assign(loanIds, collectorId);
        const db = read();
        if (!db.users.some(u => u.id === collectorId && u.role === 'COLLECTOR'))
            throw new Error('Select a valid collector.');
        if (!loanIds.length)
            throw new Error('Select at least one account.');
        loanIds.forEach(id => { const loan = owned(db, user, id); loan.collectorId = collectorId; audit(db, user, 'Collector assigned', id, collectorId); });
        save(db);
    },
    async hold(user, loanId, until, reason) {
        requirePermission(user, 'hold:edit');
        if (until && (!reason.trim() || until < today()))
            throw new Error('Choose a future hold date and enter a reason.');
        if (!DEMO_MODE)
            return accountsApi.hold(loanId, until, reason);
        const db = read();
        const loan = owned(db, user, loanId);
        loan.holdUntil = until || undefined;
        loan.holdReason = until ? reason : undefined;
        calculatePositions(db, db.asOf);
        audit(db, user, until ? 'Hold placed' : 'Hold released', loanId, reason);
        save(db);
    },
    async reconcile(user) {
        requirePermission(user, 'dayend:run');
        if (!DEMO_MODE)
            return operationsApi.reconcile();
        const db = read();
        reconcileRecords(db, db.asOf);
        audit(db, user, 'Payments reconciled', 'Payments', 'As of ' + db.asOf);
        save(db);
    },
    async runDayEnd(user, asOf) {
        requirePermission(user, 'dayend:run');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !Number.isFinite(Date.parse(asOf)) || asOf > today())
            throw new Error('Select a valid as-of date up to today.');
        if (!DEMO_MODE)
            return operationsApi.dayEnd(asOf);
        const db = read();
        const run = executeDayEnd(db, asOf);
        audit(db, user, 'Day-end completed', run.id, 'As of ' + asOf + '; execution ' + run.executions);
        save(db);
    },
    async importRows(user, kind, rows, fileName) {
        requirePermission(user, 'data:import');
        if (!DEMO_MODE)
            return operationsApi.importRows(kind, rows, fileName);
        const db = read();
        for (const row of rows) {
            if (kind !== 'loans')
                owned(db, user, row.loanId);
            if (kind === 'loans') {
                if (!row.borrower.trim() || !row.phone.trim() || !row.product.trim() || !row.city.trim())
                    throw new Error('Loan ' + row.id + ': borrower, phone, product and city are required.');
                if (!db.users.some(u => u.id === row.collectorId && u.role === 'COLLECTOR'))
                    throw new Error('Unknown collector: ' + row.collectorId);
                if (db.loans.some(l => l.id === row.id))
                    throw new Error('Loan already exists: ' + row.id + '. No rows were imported.');
                db.loans.push({ id: row.id, borrower: row.borrower, phone: row.phone, city: row.city, product: row.product, principal: Number(row.principal), collectorId: row.collectorId, outstanding: 0, dues: 0, dpd: 0, penal: 0, bucket: 'Current', priority: 'Low', strategy: 'Awaiting schedules' });
            }
            else if (kind === 'schedules') {
                if (db.schedules.some(s => s.id === row.id))
                    throw new Error('Schedule already exists: ' + row.id + '. No rows were imported.');
                db.schedules.push({ id: row.id, loanId: row.loanId, dueDate: row.dueDate, amount: Number(row.amount), paid: 0 });
            }
            else if (kind === 'payments') {
                if (db.payments.some(p => p.id === row.id || p.reference === row.reference))
                    throw new Error('Duplicate payment ID or reference: ' + row.id + '. No rows were imported.');
                if (!row.reference.trim())
                    throw new Error('Payment reference is required.');
                db.payments.push({ id: row.id, loanId: row.loanId, date: row.date, amount: Number(row.amount), reference: row.reference, reconciled: false });
            }
            else {
                if (db.contacts.some(c => c.id === row.id))
                    throw new Error('Contact already exists: ' + row.id);
                if (!db.users.some(u => u.id === row.collectorId))
                    throw new Error('Unknown contact collector.');
                const data = validate(contactSchema, { ...row, consent: row.consent.toLowerCase() === 'true', ptpAmount: row.ptpAmount ? Number(row.ptpAmount) : undefined, ptpDate: row.ptpDate || undefined });
                db.contacts.push({ ...data, id: row.id, collectorId: row.collectorId, ...(data.outcome === 'Promise to pay' ? { ptpStatus: 'Pending' } : {}) });
            }
        }
        db.imports.unshift({ id: uniqueId('IMP'), kind, fileName, rows: rows.length, createdAt: new Date().toISOString(), actor: user.name });
        audit(db, user, 'CSV imported', kind, fileName + ': ' + rows.length + ' rows. Day-end calculation pending.');
        save(db);
    },
    async rule(user, id, enabled) {
        requirePermission(user, 'rules:edit');
        if (!DEMO_MODE)
            return operationsApi.rule(id, enabled);
        if (!['R7', 'R8', 'R12'].includes(id))
            throw new Error('This rule is a required policy and cannot be disabled.');
        const db = read();
        const rule = db.rules.find(r => r.id === id);
        if (!rule)
            throw new Error('Rule not found.');
        rule.enabled = enabled;
        audit(db, user, 'Rule updated', id, enabled ? 'Enabled' : 'Disabled');
        save(db);
    },
    async retry(user, id) {
        requirePermission(user, 'outbox:retry');
        if (!DEMO_MODE)
            return operationsApi.retry(id);
        const db = read();
        const event = db.outbox.find(e => e.id === id);
        if (!event || event.status !== 'Failed')
            throw new Error('Only failed events may be retried.');
        event.status = 'Queued';
        event.attempts++;
        audit(db, user, 'Reminder requeued', event.loanId, event.id);
        save(db);
    },
    async export(user, kind) {
        requirePermission(user, 'data:export');
        if (!DEMO_MODE) {
            return reportsApi.csv(kind);
        }
        const db = read();
        audit(db, user, 'CSV exported', kind, 'As of ' + db.asOf);
        save(db);
        return kind === 'collections'
            ? csvText(db.loans.map(l => ({ asOf: db.asOf, loanId: l.id, borrower: l.borrower, outstanding: l.outstanding, dues: l.dues, penal: l.penal, dpd: l.dpd, bucket: l.bucket, collectorId: l.collectorId, priority: l.priority, strategy: l.strategy })))
            : csvText(db.settlements.map(s => ({ ...s, asOf: db.asOf })), ['id', 'loanId', 'amount', 'dueDate', 'status', 'makerId', 'checkerId', 'reason', 'decisionNote', 'asOf']);
    },
};
