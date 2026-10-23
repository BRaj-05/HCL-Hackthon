'use strict';
// For HCL calendar dates, use YYYY-MM-DD and UTC midnights ONLY to count days.
// This does not reinterpret contact timestamps; convert those to IST dates at the API boundary.
const DAY_MS = 24 * 60 * 60 * 1000;
function millis(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`Invalid date: ${date}`);
  const t = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== date) {
    throw new Error(`Invalid calendar date: ${date}`);
  }
  return t;
}
function daysBetween(earlier, later) { return Math.round((millis(later) - millis(earlier)) / DAY_MS); }
function addDays(date, n) { return new Date(millis(date) + n * DAY_MS).toISOString().slice(0,10); }
module.exports = { daysBetween, addDays };
