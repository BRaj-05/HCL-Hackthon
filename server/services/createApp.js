'use strict';
const express = require('express');
const cors = require('cors');
const { createRecoverPlusRoutes } = require('../routes/recoverPlusRoutes');
const { ApiError, errorHandler } = require('../middleware/errors');
// Shared application composition: production startup and HTTP tests use this factory.
function createApp(options = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
  app.use(express.json({ limit: '100kb' }));
  app.get('/api/health', (req, res) => res.json({ success: true, message: 'HCL Hackathon backend is running!' }));
  app.use('/api', createRecoverPlusRoutes(options));
  app.use((req, res, next) => next(new ApiError(404, 'NOT_FOUND', 'Route not found')));
  app.use(errorHandler);
  return app;
}
module.exports = { createApp };
