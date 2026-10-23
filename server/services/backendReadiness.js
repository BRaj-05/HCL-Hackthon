'use strict';
const { ApiError } = require('../middleware/errors');
// No guessed client import or fallback data store. Replace only after schema inspection.
function requireDatabase(req, res, next) {
  next(new ApiError(503, 'DATABASE_INTEGRATION_BLOCKED',
    'Existing Prisma client and schema are not available. See DB_GAPS.md.'));
}
module.exports = { requireDatabase };
