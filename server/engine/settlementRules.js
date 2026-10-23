'use strict';
const { D } = require('./money');
function evaluateSettlement(position, offer, cfg) {
  for (const key of ['headMaxDiscount','managerMaxDiscount','settlementMinSma2DPD']) {
    if (cfg[key] === undefined) throw new Error(`Missing normalized config: ${key}`);
  }
  if (D(offer).lte(0)) throw new Error('Offer amount must be positive');
  const dues=D(position.totalDues);
  if (dues.lte(0)) throw new Error('Cannot settle nonpositive total dues');
  const rawPct=DecimalMaxZero(dues.minus(offer).div(dues).times(100));
  const pct=rawPct.toDecimalPlaces(2,D.ROUND_HALF_UP);
  const result={eligible:'N',discountPct:pct.toFixed(2),route:'REJECT',reasonCode:''};
  if (position.contactStrategy === 'HOLD') return {...result,reasonCode:'ACCOUNT_ON_HOLD'};
  if (!(position.bucket === 'NPA' || (position.bucket === 'SMA_2' && position.dpd >= cfg.settlementMinSma2DPD))) {
    return {...result,reasonCode:'NOT_ELIGIBLE_BUCKET'};
  }
  if (rawPct.gt(cfg.headMaxDiscount)) return {...result,reasonCode:'DISCOUNT_ABOVE_LIMIT'};
  return {...result,eligible:'Y',route:rawPct.lte(cfg.managerMaxDiscount)?'COLLECTIONS_MANAGER':'HEAD_OF_COLLECTIONS'};
}
function DecimalMaxZero(x){return x.lt(0)?D(0):x;}
module.exports={evaluateSettlement};
