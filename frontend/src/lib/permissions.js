const staff = ['MANAGER', 'HEAD'];
const permissions = {
    'contact:create': ['COLLECTOR', ...staff], 'settlement:create': ['COLLECTOR', ...staff],
    'settlement:review': staff, 'worklist:assign': staff, 'dayend:run': staff,
    'data:import': staff, 'data:export': ['MANAGER', 'HEAD', 'AUDITOR'],
    'rules:edit': ['HEAD'], 'hold:edit': staff, 'outbox:retry': staff,
};
export const can = (user, permission) => !!user && permissions[permission].includes(user.role);
export const roleName = (role) => ({ COLLECTOR: 'Collector', MANAGER: 'Manager', HEAD: 'Collections head', AUDITOR: 'Auditor' })[role];
export function requirePermission(user, permission) { if (!can(user, permission))
    throw new Error('403: Your role does not permit this action.'); }
