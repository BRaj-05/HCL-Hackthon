import { request } from './http';
import { normalizeWorkspace } from './normalize';
export const accountsApi = {
  workspace: async () => normalizeWorkspace(await request('/workspace')),
  assign: (loanIds, collectorId) => request('/worklist/assign', { method: 'POST', body: JSON.stringify({ loanIds, collectorId }) }),
  hold: (id, until, reason) => request('/loans/' + encodeURIComponent(id) + '/hold', { method: 'POST', body: JSON.stringify({ until: until || null, reason }) }),
};
