'use strict';
const { Router } = require('express');
const { rateLimit } = require('express-rate-limit');
const { ApiError } = require('../middleware/errors');
const { authenticate } = require('../middleware/auth');
const { loginInput } = require('../services/authService');
function createAuthRoutes(service, { loginLimit = 10 } = {}) {
  const router = Router();
  router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.post('/login', rateLimit({
    windowMs: 15 * 60 * 1000, limit: loginLimit, standardHeaders: 'draft-7', legacyHeaders: false,
    handler: (req, res, next) => next(new ApiError(429, 'LOGIN_RATE_LIMITED', 'Too many login attempts')),
  }), async (req, res, next) => {
    try {
      const input = loginInput.safeParse(req.body);
      if (!input.success) throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid login request');
      if (!service) throw new ApiError(503, 'AUTH_STORAGE_UNAVAILABLE', 'The database schema does not provide user authentication storage');
      res.json(await service.login(input.data.user_id, input.data.password));
    } catch (err) { next(err); }
  });
  router.get('/me', authenticate(service), (req, res) => res.json({ user: req.user }));
  // Stateless logout acknowledges the request; client discards the still-unrevoked JWT.
  router.post('/logout', authenticate(service), (req, res) => res.json({ success: true, message: 'Discard your access token' }));
  return router;
}
module.exports = { createAuthRoutes };
