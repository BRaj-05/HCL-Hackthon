'use strict';
const { ApiError } = require('./errors');
const ROLES = Object.freeze({
  COLLECTOR: 'COLLECTOR', COLLECTIONS_MANAGER: 'COLLECTIONS_MANAGER',
  HEAD_OF_COLLECTIONS: 'HEAD_OF_COLLECTIONS', AUDITOR: 'AUDITOR',
});
function authenticate(service) {
  return async (req, res, next) => {
    try {
      const match = /^Bearer ([^\s]+)$/i.exec(req.get('authorization') || '');
      if (!match) throw new ApiError(401, 'AUTH_REQUIRED', 'Bearer token required');
      if (!service) throw new ApiError(503, 'AUTH_STORAGE_UNAVAILABLE', 'User authentication storage is not available');
      req.user = await service.authenticateToken(match[1]);
      next();
    } catch (err) { next(err); }
  };
}
module.exports = { ROLES, authenticate };
