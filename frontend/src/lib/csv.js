import Papa from 'papaparse';
export const csvColumns = {
    loans: ['id', 'borrower', 'phone', 'city', 'product', 'principal', 'collectorId'],
    schedules: ['id', 'loanId', 'dueDate', 'amount'],
    payments: ['id', 'loanId', 'date', 'amount', 'reference'],
    contacts: ['id', 'loanId', 'collectorId', 'channel', 'contactedAt', 'outcome', 'notes', 'consent', 'ptpAmount', 'ptpDate'],
};
export function parseCsv(text, kind) {
    const parsed = Papa.parse(text.replace(/^\uFEFF/, ''), { header: true, skipEmptyLines: 'greedy', transformHeader: value => value.trim() });
    if (parsed.errors.length)
        throw new Error('CSV error: ' + parsed.errors[0].message);
    const missing = csvColumns[kind].filter(key => !parsed.meta.fields?.includes(key));
    if (missing.length)
        throw new Error('Missing columns: ' + missing.join(', '));
    if (!parsed.data.length)
        throw new Error('This CSV has no data rows.');
    if (parsed.data.length > 10000)
        throw new Error('Import a maximum of 10,000 rows per file.');
    const ids = new Set();
    parsed.data.forEach((row, i) => {
        if (!row.id?.trim())
            throw new Error('Row ' + (i + 2) + ': id is required.');
        if (ids.has(row.id))
            throw new Error('Row ' + (i + 2) + ': duplicate id ' + row.id);
        ids.add(row.id);
        const numeric = kind === 'loans' ? 'principal' : kind === 'contacts' ? undefined : 'amount';
        if (numeric && (!row[numeric]?.trim() || !Number.isFinite(Number(row[numeric])) || Number(row[numeric]) <= 0))
            throw new Error('Row ' + (i + 2) + ': ' + numeric + ' must be positive.');
        const dateKey = kind === 'schedules' ? 'dueDate' : kind === 'payments' ? 'date' : undefined;
        if (dateKey && (!/^\d{4}-\d{2}-\d{2}$/.test(row[dateKey]) || Number.isNaN(Date.parse(row[dateKey])) || new Date(row[dateKey]).toISOString().slice(0, 10) !== row[dateKey]))
            throw new Error('Row ' + (i + 2) + ': invalid ' + dateKey + '. Use YYYY-MM-DD.');
    });
    return parsed.data;
}
export function csvText(rows, columns) {
    return Papa.unparse(rows, { escapeFormulae: true, columns });
}
export function download(content, fileName, type = 'text/csv;charset=utf-8') {
    const url = URL.createObjectURL(new Blob(['\uFEFF', content], { type }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function template(kind) {
    const samples = {
        loans: ['LN-2001', 'Example Borrower', '9876500000', 'Pune', 'Personal loan', '100000', 'collector-1'],
        schedules: ['SCH-2001', 'LN-2001', '2026-10-01', '10000'],
        payments: ['PAY-2001', 'LN-2001', '2026-10-02', '5000', 'UPI-2001'],
        contacts: ['CT-2001', 'LN-2001', 'collector-1', 'Phone', '2026-10-02T10:00:00+05:30', 'Connected', 'Discussed repayment options', 'true', '', ''],
    };
    return Papa.unparse([csvColumns[kind], samples[kind]]);
}
