import { z } from 'zod';
import { today } from './format';
export const contactSchema = z.object({
    loanId: z.string().min(1, 'Select an account.'),
    channel: z.enum(['Phone', 'SMS', 'Email', 'Visit']),
    contactedAt: z.string().refine(v => !Number.isNaN(Date.parse(v)), 'Enter a valid contact date and time.'),
    outcome: z.enum(['Connected', 'No answer', 'Promise to pay', 'Dispute', 'Wrong number']),
    notes: z.string().trim().min(5, 'Add a note of at least 5 characters.').max(1000),
    consent: z.literal(true, { errorMap: () => ({ message: 'Confirm the fair-practice checks.' }) }),
    ptpAmount: z.number().positive('Enter a positive promise amount.').optional(),
    ptpDate: z.string().optional(),
}).superRefine((v, ctx) => {
    const hour = Number(v.contactedAt.slice(11, 13));
    if (hour < 8 || hour >= 19)
        ctx.addIssue({ code: 'custom', path: ['contactedAt'], message: 'Demo contact policy allows contact from 08:00 to 19:00 IST.' });
    if (v.contactedAt.slice(0, 10) > today())
        ctx.addIssue({ code: 'custom', path: ['contactedAt'], message: 'Contact logs cannot be dated in the future.' });
    if (v.outcome === 'Promise to pay') {
        if (!v.ptpAmount)
            ctx.addIssue({ code: 'custom', path: ['ptpAmount'], message: 'Enter a promise amount.' });
        if (!v.ptpDate || v.ptpDate < v.contactedAt.slice(0, 10))
            ctx.addIssue({ code: 'custom', path: ['ptpDate'], message: 'Promise date must be on or after the contact date.' });
    }
});
export const settlementSchema = z.object({
    loanId: z.string().min(1, 'Select an account.'),
    amount: z.number().positive('Offer must be positive.'),
    dueDate: z.string().refine(v => /^\d{4}-\d{2}-\d{2}$/.test(v) && v >= today(), 'Choose today or a future due date.'),
    reason: z.string().trim().min(10, 'Explain the proposal in at least 10 characters.').max(1000),
});
export function validate(schema, input) {
    const result = schema.safeParse(input);
    if (!result.success)
        throw new Error(result.error.issues.map(issue => issue.message).join(' '));
    return result.data;
}
