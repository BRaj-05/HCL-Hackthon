import { request } from './http';
export const reportsApi = {
  csv: async kind => (await request('/exports/' + encodeURIComponent(kind))).csv,
};
