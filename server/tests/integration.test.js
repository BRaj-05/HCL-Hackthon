'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Prisma } = require('@prisma/client');
const { createApp } = require('../services/createApp');
const { createAuthService, hashPassword } = require('../services/authService');
const { createDatabaseServices, loanSelect } = require('../services/databaseServices');
const { authorize, assertSettlementChecker } = require('../services/authorization');
const { allocateFIFO } = require('../engine/allocate');
const { computePosition } = require('../engine/position');
const secret = 'test-only-secret-never-for-production-0123456789';
const password = 'long-test-password';
let hash;
test.before(async () => { hash = await hashPassword(password); });
function fixture({ role = 'COLLECTOR', loginLimit = 100 } = {}) {
  const user = { id: 'U1', role, active: true, passwordHash: hash };
  const users = { findByLogin: async id => id === 'U1' ? user : null, findById: async id => id === 'U1' ? user : null };
  const authService = createAuthService({ userStore: users, secret });
  const calls = [];
  const loan = { id: 'L1', loanNumber: 'LN1', customerId: 'C1', product: 'PERSONAL', assignedCollectorId: 'U1',
    principalAmount: new Prisma.Decimal('10000'), overdueAmount: new Prisma.Decimal('100'), penalBalance: new Prisma.Decimal('1.25'),
    totalDue: new Prisma.Decimal('9101.25'), bucket: 'SMA_0', dpd: 16, status: 'ACTIVE', isOnHold: false, asOfDate: new Date('2026-03-31') };
  const settlement = { id: 'S1', loanId: 'L1', proposedBy: 'U2', status: 'PENDING', requestedAmount: new Prisma.Decimal('8000') };
  const repository = (name, rows = []) => ({
    find: async (where, options) => { calls.push({ name, where, options }); return rows; },
    findById: async id => { calls.push({ name, id }); return id === rows[0]?.id ? rows[0] : null; },
  });
  const repos = {
    Loan: repository('Loan', [loan]), Schedule: repository('Schedule'), Payment: repository('Payment'),
    Contact: repository('Contact'), Settlement: repository('Settlement', [settlement]),
    AuditLog: repository('AuditLog'), OutboxEvent: repository('OutboxEvent'),
  };
  const services = createDatabaseServices(() => repos);
  const app = createApp({ authService, services, loginLimit });
  const token = jwt.sign({}, secret, { subject: 'U1', algorithm: 'HS256', issuer: 'recoverplus', audience: 'recoverplus-web', expiresIn: '1h' });
  return { app, authService, user, loan, settlement, repos, services, calls, token };
}
function get(f, path) { return request(f.app).get(path).auth(f.token, { type: 'bearer' }); }
function post(f, path, body) { return request(f.app).post(path).auth(f.token, { type: 'bearer' }).send(body); }

test('merge preserves required backend and PostgreSQL dependencies and scripts', () => {
  const pkg = require('../package.json');
  for (const name of ['@prisma/client', '@prisma/adapter-pg', 'pg', 'bcryptjs', 'jsonwebtoken', 'zod', 'decimal.js', 'express']) assert.ok(pkg.dependencies[name]);
  assert.ok(pkg.devDependencies.supertest);
  assert.ok(pkg.scripts['prisma:generate']);
  assert.ok(pkg.scripts['db:deploy']);
  assert.equal(pkg.dependencies.mongoose, undefined);
});
test('service selections match the actual generated Loan schema, with no User assumed', () => {
  const models = Prisma.dmmf.datamodel.models;
  const fields = new Set(models.find(m => m.name === 'Loan').fields.map(f => f.name));
  for (const name of Object.keys(loanSelect)) assert.ok(fields.has(name), name);
  assert.equal(models.some(m => m.name === 'User'), false);
});
test('real bcrypt provisioning hashes and UTF-8 length constraints', async () => {
  assert.equal(bcrypt.getRounds(hash), 12);
  assert.equal(await bcrypt.compare(password, hash), true);
  assert.notEqual(await hashPassword(password), hash);
  await assert.rejects(hashPassword('short'), { status: 422 });
  await assert.rejects(hashPassword('😀'.repeat(19)), { status: 422 });
});
test('shared Express app login/me/logout uses real JWT and safe public user', async () => {
  const f = fixture();
  const result = await request(f.app).post('/api/auth/login').send({ user_id: 'U1', password }).expect(200);
  const claims = jwt.verify(result.body.token, secret);
  assert.equal(claims.exp - claims.iat, 3600);
  assert.equal(result.body.user.passwordHash, undefined);
  assert.equal(result.headers['cache-control'], 'no-store');
  await get(f, '/api/auth/me').expect(200);
  await post(f, '/api/auth/logout', {}).expect(200);
  await get(f, '/api/auth/me').expect(200); // Stateless acknowledgement does not revoke JWT.
});
test('credentials and disabled users return generic 401; current stored role overrides token', async () => {
  const f = fixture();
  const bad = await request(f.app).post('/api/auth/login').send({ user_id: 'U1', password: 'bad' }).expect(401);
  const unknown = await request(f.app).post('/api/auth/login').send({ user_id: 'unknown', password }).expect(401);
  assert.deepEqual(bad.body, unknown.body);
  f.user.role = 'COLLECTIONS_MANAGER';
  await get(f, '/api/dashboard').expect(200);
  f.user.active = false;
  await get(f, '/api/auth/me').expect(401);
  await request(f.app).post('/api/auth/login').send({ user_id: 'U1', password }).expect(401);
});
test('missing/malformed/expired/wrong-signature/wrong-algorithm tokens rejected', async () => {
  const f = fixture();
  await request(f.app).get('/api/auth/me').expect(401);
  for (const value of ['Basic abc', 'Bearer abc def', 'Bearer malformed']) await request(f.app).get('/api/auth/me').set('Authorization', value).expect(401);
  const opts = { subject: 'U1', issuer: 'recoverplus', audience: 'recoverplus-web' };
  const tokens = [jwt.sign({}, secret, { ...opts, expiresIn: -1 }), jwt.sign({}, 'wrong', opts),
    jwt.sign({}, secret, { ...opts, algorithm: 'HS384' }), jwt.sign({}, secret, { ...opts, audience: 'wrong' }), jwt.sign({}, secret, opts)];
  for (const token of tokens) await request(f.app).get('/api/auth/me').auth(token, { type: 'bearer' }).expect(401);
});
test('shared app validates input and JSON at actual 100kb limit; rate limit returns 429', async () => {
  const f = fixture({ loginLimit: 3 });
  await request(f.app).post('/api/auth/login').send({ user_id: 'U1', password, role: 'HEAD_OF_COLLECTIONS' }).expect(422);
  await request(f.app).post('/api/auth/login').set('Content-Type', 'application/json').send('{').expect(422);
  await request(f.app).post('/api/auth/login').send({ password: 'a'.repeat(110000) }).expect(413);
  await request(f.app).post('/api/auth/login').send({ password: 'a'.repeat(5000) }).expect(422);
  await request(f.app).post('/api/auth/login').send({}).expect(422);
  await request(f.app).post('/api/auth/login').send({}).expect(429);
});
test('live-default composition fails closed without a User model or configured database', async () => {
  const app = createApp();
  await request(app).get('/api/health').expect(200);
  await request(app).get('/api/loans/L1').expect(401);
  await request(app).post('/api/auth/login').send({ user_id: 'U1', password }).expect(503);
  await request(app).get('/api/auth/me').set('Authorization', 'Bearer token').expect(503);
  await request(app).get('/unknown').expect(404);
});
test('account service reads verified fields and rejects unassigned collectors before child reads', async () => {
  const f = fixture();
  const result = await get(f, '/api/loans/L1').expect(200);
  assert.equal(result.body.loan.principalAmount, '10000.00');
  assert.equal(result.body.loan.penalBalance, '1.25');
  f.calls.length = 0;
  f.loan.assignedCollectorId = 'U2';
  await get(f, '/api/loans/L1').expect(403);
  assert.equal(f.calls.length, 1);
  await get(f, '/api/loans/missing').expect(404);
});
test('stored collector worklist and settlement lists scope queries server-side', async () => {
  const f = fixture();
  await get(f, '/api/worklists/me?limit=10').expect(200);
  assert.deepEqual(f.calls[0].where, { assignedCollectorId: 'U1' });
  assert.equal(f.calls[0].options.take, 10);
  await get(f, '/api/settlements').expect(200);
  assert.deepEqual(f.calls[1].where, { loan: { assignedCollectorId: 'U1' } });
  await get(f, '/api/worklists').expect(403);
  await get(f, '/api/worklists/me?collectorId=U2').expect(422);
  await get(f, '/api/worklists/me?limit=101').expect(422);
});
test('dashboard totals use Decimal and actual product filters; audit/outbox select safe summaries', async () => {
  const f = fixture({ role: 'COLLECTIONS_MANAGER' });
  const result = await get(f, '/api/dashboard?product=PERSONAL').expect(200);
  assert.equal(result.body.buckets[0].totalDues, '9101.25');
  assert.deepEqual(f.calls[0].where, { product: 'PERSONAL' });
  await get(f, '/api/dashboard?branch=X').expect(422);
  await get(f, '/api/audit').expect(200);
  await get(f, '/api/outbox').expect(200);
  assert.equal(f.calls.find(c => c.name === 'AuditLog').options.select.metadata, undefined);
  assert.equal(f.calls.find(c => c.name === 'OutboxEvent').options.select.payload, undefined);
});
test('all four canonical roles have enforced permissions and unknown roles fail closed', async () => {
  for (const role of ['COLLECTOR', 'COLLECTIONS_MANAGER', 'HEAD_OF_COLLECTIONS', 'AUDITOR']) {
    const f = fixture({ role });
    await get(f, '/api/loans/L1').expect(200);
    await get(f, '/api/dashboard').expect(['COLLECTIONS_MANAGER', 'HEAD_OF_COLLECTIONS'].includes(role) ? 200 : 403);
    await get(f, '/api/audit').expect(role === 'COLLECTOR' ? 403 : 200);
    await post(f, '/api/admin/day-end', { asOfDate: '2026-03-31' }).expect(['COLLECTIONS_MANAGER', 'HEAD_OF_COLLECTIONS'].includes(role) ? 503 : 403);
  }
  await get(fixture({ role: 'ADMIN' }), '/api/loans/L1').expect(401);
  assert.throws(() => authorize({ userId: 'U1', role: 'COLLECTOR' }, 'toString'), { status: 403 });
});
test('settlement HTTP preflight enforces maker-checker, 409, input errors and schema gap without writes', async () => {
  const f = fixture({ role: 'COLLECTIONS_MANAGER' });
  await post(f, '/api/settlements/S1/decision', { decision: 'PAID' }).expect(422);
  f.settlement.proposedBy = 'U1';
  await post(f, '/api/settlements/S1/decision', { decision: 'APPROVED' }).expect(403);
  f.settlement.proposedBy = 'U2'; f.settlement.status = 'APPROVED';
  await post(f, '/api/settlements/S1/decision', { decision: 'APPROVED' }).expect(409);
  f.settlement.status = 'PENDING';
  await post(f, '/api/settlements/S1/decision', { decision: 'APPROVED' }).expect(503);
  await post(f, '/api/settlements/missing/decision', { decision: 'APPROVED' }).expect(404);
});
test('checker discount limits distinguish manager/head and prohibit own proposal', () => {
  const row = { proposedBy: 'maker', status: 'PENDING' };
  const cfg = { managerMaxDiscount: '20', headMaxDiscount: '40' };
  const manager = { userId: 'manager', role: 'COLLECTIONS_MANAGER' };
  assert.doesNotThrow(() => assertSettlementChecker(manager, row, '20', cfg));
  assert.throws(() => assertSettlementChecker(manager, row, '20.01', cfg), { status: 403 });
  assert.doesNotThrow(() => assertSettlementChecker({ userId: 'head', role: 'HEAD_OF_COLLECTIONS' }, row, '40', cfg));
  assert.throws(() => assertSettlementChecker(manager, row, '40.01', cfg), { status: 422 });
  assert.throws(() => assertSettlementChecker({ ...manager, userId: 'maker' }, row, '10', cfg), { status: 403 });
});
test('Prisma connection failures map to sanitized 503 and day-end validates real calendar dates', async () => {
  const f = fixture({ role: 'COLLECTIONS_MANAGER' });
  f.repos.Loan.findById = async () => { throw Object.assign(new Error('sensitive URL'), { code: 'P1001' }); };
  const result = await get(f, '/api/loans/L1').expect(503);
  assert.ok(!JSON.stringify(result.body).includes('sensitive'));
  await post(f, '/api/admin/day-end', { asOfDate: '2026-02-30' }).expect(422);
  await post(f, '/api/admin/day-end', { asOfDate: '2026-03-31' }).expect(503);
});
test('financial input regressions reject invalid dates, negative EMI and duplicate payments', () => {
  const cfg = { tolerance: '100', penalAnnualRate: '0.24', sma0Max: 30, sma1Max: 60, sma2Max: 90 };
  assert.throws(() => computePosition({ principal: '10000' }, [], [], 'not-a-date', cfg));
  assert.throws(() => allocateFIFO([{ instalmentNo: 1, dueDate: '2026-01-01', emiAmount: '-100' }], [], '2026-03-31'));
  const p = { paymentId: 'P1', amount: '100', paymentDate: '2026-03-01' };
  assert.throws(() => allocateFIFO([], [p, p], '2026-03-31'));
});
