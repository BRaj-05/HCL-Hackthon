export class ApiError extends Error {
    status;
    fields;
    constructor(status, message, fields) {
        super(message);
        this.status = status;
        this.fields = fields;
        this.name = 'ApiError';
    }
}
const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '');
export async function request(path, options = {}) {
    const token = sessionStorage.getItem('collect.token');
    const headers = new Headers(options.headers);
    if (options.body && !(options.body instanceof FormData))
        headers.set('Content-Type', 'application/json');
    if (token)
        headers.set('Authorization', 'Bearer ' + token);
    let response;
    try {
        response = await fetch(baseUrl + path, { ...options, headers, signal: options.signal ?? AbortSignal.timeout(30000) });
    }
    catch {
        throw new ApiError(0, 'Cannot reach the server. Check the API connection and try again.');
    }
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (response.status === 401) {
            sessionStorage.removeItem('collect.token');
            window.dispatchEvent(new Event('collect:unauthorized'));
        }
        const messages = { 401: 'Your session expired. Sign in again.', 403: 'You do not have permission for this action.', 422: 'Please check the submitted fields.' };
        const fields = body.error?.fields ?? body.errors;
        const fieldText = fields && typeof fields === 'object' ? Object.values(fields).flat().filter(v => typeof v === 'string').join(' ') : '';
        throw new ApiError(response.status, fieldText || body.error?.message || body.message || messages[response.status] || 'The request could not be completed.', fields);
    }
    if (response.status === 204)
        return undefined;
    const body = await response.json();
    return (body.data ?? body);
}
