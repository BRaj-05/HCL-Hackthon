'use strict';
const { ROLES } = require('../middleware/auth');
const { ApiError } = require('../middleware/errors');
const { D } = require('../engine/money');
const { COLLECTOR: C, COLLECTIONS_MANAGER: M, HEAD_OF_COLLECTIONS: H, AUDITOR: A } = ROLES;
const permissions = Object.freeze({
  ACCOUNT_READ: [C, M, H, A], WORKLIST_OWN: [C], WORKLIST_ALL: [M, H, A],
  CONTACT_WRITE: [C, M, H], SETTLEMENT_PROPOSE: [C, M, H], SETTLEMENT_READ: [C, M, H, A],
  SETTLEMENT_DECIDE: [M, H], DASHBOARD_READ: [M, H], AUDIT_READ: [M, H, A], OUTBOX_READ: [M, H, A],
  IMPORT: [M, H], DAY_END: [M, H], RULES_READ: [M, H, A], RULES_WRITE: [M, H], ASSIGN: [M, H], EXPORT: [M, H, A],
});
function authorize(user, permission) {
  if (!user?.userId) throw new ApiError(401, 'AUTH_REQUIRED', 'Login required');
  if (!Object.hasOwn(permissions, permission) || !permissions[permission].includes(user.role)) throw new ApiError(403, 'FORBIDDEN', 'Role not permitted');
}
function requirePermission(permission) {
  return (req, res, next) => { try { authorize(req.user, permission); next(); } catch (err) { next(err); } };
}
function assertLoanAccess(user, loan) {
  authorize(user, 'ACCOUNT_READ');
  if (user.role === C && loan.assignedCollectorId !== user.userId) throw new ApiError(403, 'ACCOUNT_FORBIDDEN', 'Loan is not assigned to this collector');
}
// Preflight only; must be repeated inside a real approval transaction once gaps are resolved.
function assertSettlementChecker(user, settlement, discountPct, cfg) {
  authorize(user, 'SETTLEMENT_DECIDE');
  if (settlement.proposedBy == null) throw new Error('Settlement proposer is required');
  if (settlement.proposedBy === user.userId) throw new ApiError(403, 'MAKER_CHECKER', 'Maker cannot check their own proposal');
  if (settlement.status !== 'PENDING') throw new ApiError(409, 'SETTLEMENT_CONFLICT', 'Settlement is no longer pending');
  const discount = D(discountPct);
  if (discount.lt(0) || discount.gt(cfg.headMaxDiscount)) throw new ApiError(422, 'INVALID_DISCOUNT', 'Discount exceeds settlement limits');
  if (discount.gt(cfg.managerMaxDiscount) && user.role !== H) throw new ApiError(403, 'HEAD_REQUIRED', 'Head approval required');
}
module.exports = { permissions, authorize, requirePermission, assertLoanAccess, assertSettlementChecker };
