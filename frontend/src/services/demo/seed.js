import { addDays, today } from '../../lib/format';
export const demoUsers = [
    { id: 'collector-1', name: 'Aarav Sharma', email: 'aarav@collect.demo', role: 'COLLECTOR' },
    { id: 'collector-2', name: 'Priya Mehta', email: 'priya@collect.demo', role: 'COLLECTOR' },
    { id: 'manager-1', name: 'Ananya Rao', email: 'ananya@collect.demo', role: 'MANAGER' },
    { id: 'head-1', name: 'Vikram Shah', email: 'vikram@collect.demo', role: 'HEAD' },
    { id: 'auditor-1', name: 'Isha Kapoor', email: 'isha@collect.demo', role: 'AUDITOR' },
];
export function seedWorkspace() {
    const day = today();
    const names = ['Rahul Verma', 'Sneha Patel', 'Arjun Nair', 'Neha Gupta', 'Vivek Singh', 'Pooja Desai', 'Rohan Joshi', 'Kavya Reddy', 'Amit Kumar', 'Diya Shah', 'Suresh Iyer', 'Meera Rao', 'Aditya Bose', 'Anjali Das', 'Karan Malhotra', 'Nisha Menon'];
    const ages = [22, 45, 78, 96, 12, 32, 62, 18, 5, 82, 0, 36, 52, 16, 105, 8];
    const loans = names.map((borrower, i) => ({
        id: 'LN-' + (1001 + i), borrower, phone: '98' + String(76540000 + i),
        city: ['Mumbai', 'Pune', 'Bengaluru', 'Delhi'][i % 4],
        product: ['Personal loan', 'Vehicle loan', 'Business loan'][i % 3],
        principal: [120000, 180000, 240000, 90000, 150000][i % 5],
        outstanding: 0, dues: 0, penal: 0, dpd: 0, bucket: 'Current',
        collectorId: i % 2 ? 'collector-2' : 'collector-1', priority: 'Medium', strategy: 'Follow up',
        ...(i === 3 ? { holdUntil: addDays(day, 4), holdReason: 'Dispute under review' } : {}),
    }));
    const schedules = loans.flatMap((loan, i) => Array.from({ length: 6 }, (_, j) => ({
        id: 'SCH-' + loan.id + '-' + (j + 1), loanId: loan.id,
        dueDate: addDays(day, -ages[i] + j * 30), amount: loan.principal / 6, paid: 0,
    })));
    const payments = loans.map((loan, i) => ({
        id: 'PAY-' + (1001 + i), loanId: loan.id, date: addDays(day, -(i % 7)),
        amount: Math.round(loan.principal / 6 * (i % 4 === 0 ? 1.3 : .35)),
        reference: 'UPI-78294' + i, reconciled: i % 3 !== 0,
    }));
    const contacts = loans.slice(0, 7).map((loan, i) => ({
        id: 'CT-' + (1001 + i), loanId: loan.id, collectorId: loan.collectorId, channel: 'Phone',
        contactedAt: addDays(day, -3) + 'T10:30:00+05:30', outcome: 'Promise to pay', consent: true,
        notes: ['Customer confirmed salary credit and agreed to a payment.', 'Discussed available repayment options.'][i % 2],
        ptpAmount: i % 2 ? 15000 : 5000, ptpDate: addDays(day, i % 3 - 1), ptpStatus: 'Pending',
    }));
    const ruleDescriptions = [
        ['Current accounts', 'Keep current accounts in the standard monitoring queue.'],
        ['Early delinquency', 'Prioritize a respectful reminder for accounts 1–30 days past due.'],
        ['Mid delinquency', 'Queue accounts 31–60 days past due for collector follow-up.'],
        ['Late delinquency', 'Escalate accounts 61–90 days past due for manager review.'],
        ['Severe delinquency', 'Escalate accounts over 90 days past due for head review.'],
        ['Active holds', 'Exclude accounts with an active hold from contact queues.'],
        ['Promises due', 'Surface open promises to pay due today.'],
        ['Broken promises', 'Prioritize accounts with a broken promise to pay.'],
        ['Settlement review', 'Require a different authorized reviewer for settlement decisions.'],
        ['Fair contact window', 'Demo contact hours are 08:00–19:00 IST.'],
        ['FIFO allocation', 'Allocate eligible payments to the oldest scheduled installment first.'],
        ['Queue ranking', 'Rank eligible accounts by priority and days past due.'],
    ];
    return {
        asOf: day, users: demoUsers, loans, schedules, payments, contacts,
        settlements: [
            { id: 'ST-1001', loanId: 'LN-1003', amount: 160000, dueDate: addDays(day, 10), reason: 'Customer requested a one-time resolution following a temporary business disruption.', makerId: 'manager-1', createdAt: addDays(day, -1) + 'T09:20:00+05:30', status: 'Pending' },
            { id: 'ST-1002', loanId: 'LN-1006', amount: 85000, dueDate: addDays(day, 7), reason: 'Verified hardship; customer can arrange a single payment from family support.', makerId: 'collector-2', createdAt: addDays(day, -2) + 'T11:00:00+05:30', status: 'Approved', checkerId: 'manager-1', decidedAt: addDays(day, -1) + 'T12:00:00+05:30', decisionNote: 'Reviewed and approved.' },
        ],
        rules: ruleDescriptions.map(([name, description], i) => ({ id: 'R' + (i + 1), name, description, enabled: true })),
        scores: loans.map((loan, i) => ({ loanId: loan.id, missProbability: Math.min(.95, .25 + ages[i] / 150), expectedRecovery: Math.round(loan.principal / 6 * (.95 - ages[i] / 250)), reasons: ['Recent payment behavior', ages[i] > 60 ? 'Extended delinquency' : 'Days past due', i % 2 ? 'Contact response history' : 'Promise-to-pay history'] })),
        audit: [{ id: 'AUD-SEED', actor: 'System', role: 'HEAD', action: 'Demo initialized', entity: 'Workspace', at: day + 'T08:00:00+05:30', detail: 'Illustrative local dataset. No real customer records.' }],
        outbox: [
            { id: 'EV-SEED-1', loanId: 'LN-1001', type: 'Payment reminder', status: 'Sent', createdAt: day + 'T08:15:00+05:30', attempts: 1 },
            { id: 'EV-SEED-2', loanId: 'LN-1002', type: 'PTP reminder', status: 'Failed', createdAt: day + 'T08:20:00+05:30', attempts: 1 },
        ], runs: [], imports: [],
    };
}
