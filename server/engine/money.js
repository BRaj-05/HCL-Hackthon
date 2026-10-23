'use strict';
const Decimal = require('decimal.js');
Decimal.set({ precision: 32, rounding: Decimal.ROUND_HALF_UP });

function D(value) {
  if (value === null || value === undefined || value === '') {
    throw new Error('Missing decimal value');
  }
  const d = new Decimal(typeof value === 'object' && value.toString ? value.toString() : value);
  if (!d.isFinite()) throw new Error('Invalid decimal value');
  return d;
}
function money(value) { return D(value).toDecimalPlaces(2).toFixed(2); }
module.exports = { D, money };
