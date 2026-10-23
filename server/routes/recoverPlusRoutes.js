'use strict';
const router = require('express').Router();
const { requireDatabase } = require('../services/backendReadiness');
// Explicit dependency responses; these are not working persistence or auth endpoints.
const endpoints = [
  ['post', '/auth/login'], ['get', '/auth/me'], ['get', '/loans/:id'],
  ['get', '/worklists/me'], ['get', '/worklists'], ['post', '/contacts'],
  ['post', '/settlements'], ['get', '/settlements'], ['post', '/settlements/:id/decision'],
  ['get', '/dashboard'], ['get', '/audit'], ['get', '/outbox'],
  ['post', '/admin/import'], ['post', '/admin/day-end'], ['get', '/admin/rules'],
  ['patch', '/admin/rules'], ['post', '/admin/assignments'], ['get', '/admin/exports'],
];
for (const [method, path] of endpoints) router[method](path, requireDatabase);
module.exports = router;
