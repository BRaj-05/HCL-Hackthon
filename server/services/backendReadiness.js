'use strict';
const { ApiError } = require('../middleware/errors');
// No guessed client import or fallback data store. Replace only after schema inspection.
function requireDatabase(req, res, next) {
  next(new ApiError(503, 'DATABASE_INTEGRATION_BLOCKED',
    'Database integration for this operation is not ready. See the root README.md.'));
}
module.exports = { requireDatabase };
