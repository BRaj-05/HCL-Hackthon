'use strict';
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ApiError } = require('../middleware/errors');
const { ROLES } = require('../middleware/auth');
const { z } = require('zod');
const passwordInput = z.string().min(1).refine(p => Buffer.byteLength(p, 'utf8') <= 72);
const loginInput = z.object({ user_id: z.string().trim().min(1).max(128), password: passwordInput }).strict();
let dummyHash;
function validUser(user) {
  return user && user.id != null && String(user.id) !== '' && user.active === true && Object.values(ROLES).includes(user.role);
}
function publicUser(user) {
  return { userId: String(user.id), role: user.role, queue: user.queue ?? null, city: user.city ?? null };
}
async function hashPassword(password) {
  if (!passwordInput.safeParse(password).success || password.length < 12) {
    throw new ApiError(422, 'INVALID_PASSWORD', 'Password must have at least 12 characters and at most 72 UTF-8 bytes');
  }
  return bcrypt.hash(password, 12);
}
// No User model exists yet. This interface must be mapped only after schema review.
function createAuthService({ userStore, secret }) {
  if (!userStore?.findByLogin || !userStore?.findById) throw new Error('Verified user repository required');
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('JWT_SECRET must be at least 32 characters');
  async function login(userId, password) {
    const parsed = loginInput.safeParse({ user_id: userId, password });
    if (!parsed.success) throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid login request');
    const user = await userStore.findByLogin(parsed.data.user_id);
    dummyHash ||= bcrypt.hash('dummy-password-for-unknown-user', 12);
    const hash = user?.passwordHash || await dummyHash;
    let matches = false;
    try { matches = await bcrypt.compare(password, hash); } catch { /* generic invalid credentials below */ }
    if (!validUser(user) || !user.passwordHash || !matches) throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
    const token = jwt.sign({}, secret, {
      subject: String(user.id), algorithm: 'HS256', issuer: 'recoverplus', audience: 'recoverplus-web', expiresIn: '1h',
    });
    return { token, tokenType: 'Bearer', expiresInSeconds: 3600, user: publicUser(user) };
  }
  async function authenticateToken(token) {
    let payload;
    try {
      payload = jwt.verify(token, secret, { algorithms: ['HS256'], issuer: 'recoverplus', audience: 'recoverplus-web' });
      if (typeof payload.sub !== 'string' || !payload.sub || !Number.isInteger(payload.exp)) throw new Error('Invalid claims');
    } catch { throw new ApiError(401, 'INVALID_TOKEN', 'Invalid or expired token'); }
    const user = await userStore.findById(payload.sub);
    if (!validUser(user) || String(user.id) !== payload.sub) throw new ApiError(401, 'INVALID_TOKEN', 'Invalid or expired token');
    return publicUser(user);
  }
  return { login, authenticateToken };
}
module.exports = { createAuthService, hashPassword, loginInput };
