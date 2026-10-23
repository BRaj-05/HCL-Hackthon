'use strict';
class ApiError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    Object.assign(this, { status, code, details });
  }
}
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = err instanceof ApiError ? err.status : err.type === 'entity.parse.failed' ? 422 : err.type === 'entity.too.large' ? 413 : 500;
  res.status(status).json({
    error: status === 500 ? 'Internal server error' : status === 422 ? 'Invalid request' : err.message,
    code: err.code || (status === 422 ? 'INVALID_REQUEST' : 'INTERNAL_ERROR'),
    details: err instanceof ApiError ? err.details : null,
  });
}
module.exports = { ApiError, errorHandler };
