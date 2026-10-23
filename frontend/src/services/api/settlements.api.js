import { request } from './http';
export const settlementsApi = {
  propose: data => request('/settlements', { method: 'POST', body: JSON.stringify(data) }),
  decide: (id, decision, note) => request('/settlements/' + encodeURIComponent(id) + '/decision', { method: 'POST', body: JSON.stringify({ decision, note }) }),
};
