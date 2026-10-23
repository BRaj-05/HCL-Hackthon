'use strict';
const { D } = require('./money');
const CODE_ORDER=['HOLD_DISPUTE','HOLD_DECEASED','BROKEN_PTP_REPEAT','HIGH_VALUE','PRE_LEGAL_NOTICE','NPA_CLASSIFIED','SKIP_TRACE','EARLY_WARNING_AI'];
const QUEUES={NONE:null,DIGITAL_REMINDER:'AUTO_DIGITAL',PRE_DUE_REMINDER:'AUTO_DIGITAL',TELECALL:'TELECALLER',FIELD_VISIT:'FIELD',RECOVERY:'RECOVERY_TEAM'};
const NEXT={DIGITAL_REMINDER:'TELECALL',TELECALL:'FIELD_VISIT',FIELD_VISIT:'RECOVERY',RECOVERY:'RECOVERY',NONE:'NONE'};

function applyRules(position, customer, info, cfg, options={}) {
  for (const key of ['digitalMaxDPD','ptpEscalationCount','highValueThreshold','preLegalDPD']) {
    if (cfg[key] === undefined) throw new Error(`Missing normalized config: ${key}`);
  }
  const codes = new Set();
  const { bucket, dpd, totalDues } = position;
  const broken = info.brokenCount || 0;
  let strategy = 'NONE';
  if (bucket === 'SMA_0') strategy = dpd <= cfg.digitalMaxDPD ? 'DIGITAL_REMINDER':'TELECALL';
  if (bucket === 'SMA_1') strategy = broken >= 1 ? 'FIELD_VISIT':'TELECALL';
  if (bucket === 'SMA_2') strategy = 'FIELD_VISIT';
  if (bucket === 'NPA') {strategy='RECOVERY';codes.add('NPA_CLASSIFIED');}
  if (broken >= cfg.ptpEscalationCount) {strategy=NEXT[strategy]; codes.add('BROKEN_PTP_REPEAT');}
  let queue=QUEUES[strategy];
  if ((bucket === 'SMA_2' || bucket === 'NPA') && D(totalDues).gte(cfg.highValueThreshold)) {
    queue='SENIOR_COLLECTOR'; codes.add('HIGH_VALUE');
  }
  if (bucket === 'SMA_2' && dpd >= cfg.preLegalDPD) codes.add('PRE_LEGAL_NOTICE');
  if (bucket !== 'CURRENT' && Array.isArray(info.lastThreeOutcomes) && info.lastThreeOutcomes.length === 3 &&
    info.lastThreeOutcomes.every(x => x === 'WRONG_NUMBER' || x === 'UNREACHABLE')) codes.add('SKIP_TRACE');
  const isHeld = customer.disputeFlag === true || customer.deceasedFlag === true;
  if (options.mode === 'ai' && cfg.aiEarlyWarningThreshold === undefined) {
    throw new Error('Missing normalized config: aiEarlyWarningThreshold');
  }
  if (options.mode === 'ai' && bucket === 'CURRENT' && !isHeld && options.pMissNext != null &&
    D(options.pMissNext).gte(cfg.aiEarlyWarningThreshold)) {
    strategy='PRE_DUE_REMINDER';queue='AUTO_DIGITAL';codes.add('EARLY_WARNING_AI');
  }
  if (customer.deceasedFlag === true) { strategy='HOLD';queue='CLAIMS_DESK';codes.add('HOLD_DECEASED'); }
  if (customer.disputeFlag === true) { strategy='HOLD';queue='DISPUTE_DESK';codes.add('HOLD_DISPUTE'); }
  return { contactStrategy:strategy,queue,codes:CODE_ORDER.filter(c=>codes.has(c)) };
}
module.exports = { applyRules, CODE_ORDER };
