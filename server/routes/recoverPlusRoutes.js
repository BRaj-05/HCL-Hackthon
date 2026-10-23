'use strict';
const { Router } = require('express');
const { z } = require('zod');
const { ApiError } = require('../middleware/errors');
const { authenticate } = require('../middleware/auth');
const { requirePermission } = require('../services/authorization');
const { createDatabaseServices } = require('../services/databaseServices');
const { createAuthRoutes } = require('./auth.routes');
const { daysBetween } = require('../engine/dates');
const identifier = z.string().min(1).max(128);
const pageInput = z.object({ limit: z.coerce.number().int().min(1).max(100).default(50), offset: z.coerce.number().int().min(0).max(100000).default(0) }).strict();
function parse(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid request');
  return result.data;
}
function gap(message) { throw new ApiError(503, 'SCHEMA_GAP', message); }
function createRecoverPlusRoutes({ authService = null, services = createDatabaseServices(), loginLimit = 10 } = {}) {
  const router = Router();
  router.use('/auth', createAuthRoutes(authService, { loginLimit }));
  const route = (method, path, permission, handler) => {
    router[method](path, authenticate(authService), requirePermission(permission), async (req, res, next) => {
      try { res.set('Cache-Control', 'no-store'); res.json(await handler(req)); } catch (err) { next(err); }
    });
  };
  route('get', '/loans/:id', 'ACCOUNT_READ', req => services.account(req.user, parse(identifier, req.params.id)));
  route('get', '/worklists/me', 'WORKLIST_OWN', req => services.worklist(req.user, parse(pageInput, req.query), true));
  route('get', '/worklists', 'WORKLIST_ALL', req => services.worklist(req.user, parse(pageInput, req.query), false));
  route('get', '/settlements', 'SETTLEMENT_READ', req => services.settlements(req.user, parse(pageInput, req.query)));
  route('get', '/dashboard', 'DASHBOARD_READ', req => services.dashboard(req.user, parse(z.object({ product: z.string().min(1).max(128).optional() }).strict(), req.query)));
  route('get', '/audit', 'AUDIT_READ', req => services.audit(req.user, parse(pageInput, req.query)));
  route('get', '/outbox', 'OUTBOX_READ', req => services.outbox(req.user, parse(pageInput, req.query)));
  route('post', '/settlements/:id/decision', 'SETTLEMENT_DECIDE', req => {
    parse(z.object({ decision: z.enum(['APPROVED', 'REJECTED']) }).strict(), req.body);
    return services.checkSettlementDecision(req.user, parse(identifier, req.params.id));
  });
  route('post', '/contacts', 'CONTACT_WRITE', () => gap('Contact writes require official configuration, outcome mapping and atomic daily-limit integration'));
  route('post', '/settlements', 'SETTLEMENT_PROPOSE', () => gap('Settlement proposals require request-date positions and the complete approval lifecycle'));
  route('post', '/admin/day-end', 'DAY_END', req => {
    const date = z.string().refine(value => { try { daysBetween(value, value); return true; } catch { return false; } });
    parse(z.object({ asOfDate: date }).strict(), req.body);
    gap('Day-end requires schedule closing principal, official config and dated collection snapshots');
  });
  route('post', '/admin/import', 'IMPORT', () => gap('Imports require official CSV contracts and verified source identities'));
  route('get', '/admin/rules', 'RULES_READ', () => gap('Official configuration keys and version contract are not available'));
  route('patch', '/admin/rules', 'RULES_WRITE', () => gap('Official configuration keys and version contract are not available'));
  route('post', '/admin/assignments', 'ASSIGN', () => gap('Collector queue/city permissions, capacity and manual assignment fields are not available'));
  route('get', '/admin/exports', 'EXPORT', () => gap('Verified dated collection and settlement outputs are not available'));
  return router;
}
module.exports = { createRecoverPlusRoutes };
