'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('dotenv').config({ quiet: true });
const safe = process.env.RECOVERPLUS_RUN_DB_TESTS === 'true' && process.env.NODE_ENV === 'test' &&
  !!process.env.TEST_DATABASE_URL && process.env.DATABASE_URL === process.env.TEST_DATABASE_URL;
test('existing Prisma singleton can read a separately configured test PostgreSQL database', {
  skip: safe ? false : 'Safe test DB not configured: require NODE_ENV=test, RECOVERPLUS_RUN_DB_TESTS=true, and matching DATABASE_URL/TEST_DATABASE_URL',
}, async () => {
  // Reuse the database teammate's singleton; read-only, no migrations/seeds/writes.
  const { prisma } = require('../config/db');
  try {
    const rows = await prisma.$queryRaw`SELECT 1 AS ok`;
    assert.equal(rows[0].ok, 1);
    await prisma.loan.findMany({ take: 1, select: { id: true } });
  } finally { await prisma.$disconnect(); }
});
