import { request } from './http';
export const contactsApi = {
  create: data => request('/contacts', { method: 'POST', body: JSON.stringify(data) }),
};
