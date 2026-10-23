import { request } from './http';
const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) });
export const operationsApi = {
  reconcile: () => post('/payments/reconcile', {}),
  dayEnd: asOf => post('/day-end/runs', { asOf, idempotencyKey: 'day-end:' + asOf }),
  importRows: (kind, rows, fileName) => post('/imports', { kind, rows, fileName }),
  rule: (id, enabled) => request('/rules/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify({ enabled }) }),
  retry: id => post('/outbox/' + encodeURIComponent(id) + '/retry', {}),
};
