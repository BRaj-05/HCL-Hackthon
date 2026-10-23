import { classifyDpd, classifyPriority, collectionStrategy } from '../../features/finance/classification';
import { dayDiff } from '../../lib/format';
export function calculatePositions(db, asOf) {
    for (const schedule of db.schedules)
        schedule.paid = 0;
    for (const loan of db.loans) {
        const installments = db.schedules.filter(s => s.loanId === loan.id).sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
        let funds = db.payments.filter(p => p.loanId === loan.id && p.date <= asOf).reduce((sum, p) => sum + p.amount, 0);
        for (const installment of installments) {
            installment.paid = Math.min(installment.amount, funds);
            funds = Math.max(0, funds - installment.paid);
        }
        const overdue = installments.filter(s => s.dueDate < asOf && s.amount - s.paid > .01);
        loan.outstanding = Math.round(installments.reduce((sum, s) => sum + s.amount - s.paid, 0) * 100) / 100;
        loan.dues = Math.round(installments.filter(s => s.dueDate <= asOf).reduce((sum, s) => sum + s.amount - s.paid, 0) * 100) / 100;
        loan.dpd = overdue.length ? dayDiff(overdue[0].dueDate, asOf) : 0;
        loan.bucket = classifyDpd(loan.dpd);
        loan.penal = Math.round(overdue.reduce((sum, s) => sum + s.amount - s.paid, 0) * .005 * 100) / 100;
        loan.priority = classifyPriority(loan.dpd);
        loan.strategy = collectionStrategy(loan.dpd);
        if (loan.holdUntil && loan.holdUntil >= asOf)
            loan.strategy = 'On hold';
        if (loan.outstanding === 0)
            loan.strategy = 'Paid off';
    }
    db.asOf = asOf;
}
export function reconcileRecords(db, asOf) {
    for (const contact of db.contacts) {
        if (contact.outcome !== 'Promise to pay' || !contact.ptpDate || !contact.ptpAmount)
            continue;
        const received = db.payments.filter(p => p.loanId === contact.loanId && p.date >= contact.contactedAt.slice(0, 10) && p.date <= contact.ptpDate && p.date <= asOf).reduce((sum, p) => sum + p.amount, 0);
        contact.ptpStatus = received >= contact.ptpAmount ? 'Kept' : contact.ptpDate < asOf ? 'Broken' : 'Pending';
    }
    for (const settlement of db.settlements) {
        if (!['Approved', 'Paid', 'Expired'].includes(settlement.status) || !settlement.decidedAt)
            continue;
        const received = db.payments.filter(p => p.loanId === settlement.loanId && p.date >= settlement.decidedAt.slice(0, 10) && p.date <= settlement.dueDate && p.date <= asOf).reduce((sum, p) => sum + p.amount, 0);
        settlement.status = received >= settlement.amount ? 'Paid' : settlement.dueDate < asOf ? 'Expired' : 'Approved';
    }
    for (const payment of db.payments)
        if (payment.date <= asOf)
            payment.reconciled = true;
}
export function executeDayEnd(db, asOf, at = new Date().toISOString()) {
    calculatePositions(db, asOf);
    reconcileRecords(db, asOf);
    const enabled = (id) => db.rules.find(r => r.id === id)?.enabled ?? true;
    for (const loan of db.loans) {
        if (enabled('R8') && db.contacts.some(c => c.loanId === loan.id && c.ptpStatus === 'Broken')) {
            loan.priority = 'High';
            loan.strategy = 'Broken PTP follow-up';
        }
        if (enabled('R6') && loan.holdUntil && loan.holdUntil >= asOf)
            loan.strategy = 'On hold';
        const eventId = 'REM-' + loan.id + '-' + asOf;
        if (loan.dues > 0 && loan.strategy !== 'On hold' && !db.outbox.some(e => e.id === eventId)) {
            db.outbox.push({ id: eventId, loanId: loan.id, type: 'Payment reminder', status: 'Queued', createdAt: at, attempts: 0 });
        }
    }
    const existing = db.runs.find(r => r.asOf === asOf);
    const run = {
        id: existing?.id ?? 'RUN-' + asOf, asOf, status: 'Completed', startedAt: at, completedAt: at,
        accounts: db.loans.length, executions: (existing?.executions ?? 0) + 1,
        steps: ['Calculate FIFO, DPD, buckets, penal and dues', 'Evaluate collection rules, holds and escalation', 'Rank worklist and retain collector assignments', 'Reconcile promises and approved settlements', 'Queue reminder events in outbox', 'Prepare collections and settlement exports'].map(name => ({ name, status: 'Completed' })),
    };
    db.runs = [run, ...db.runs.filter(r => r.id !== run.id)];
    return run;
}
