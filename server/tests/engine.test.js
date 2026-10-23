'use strict';
// Run after installing decimal.js: node --test server/tests/engine.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const { computePosition } = require('../engine/position');
const { applyRules } = require('../engine/rules');
const { derivePTPs } = require('../engine/ptp');
const { evaluateSettlement } = require('../engine/settlementRules');
const { rankWorklists } = require('../engine/worklist');
const cfg = {
  tolerance:'100',penalAnnualRate:'0.24',sma0Max:30,sma1Max:60,sma2Max:90,
  digitalMaxDPD:7,ptpEscalationCount:2,highValueThreshold:'500000',
  preLegalDPD:75, aiEarlyWarningThreshold:'0.60',
  managerMaxDiscount:'20',headMaxDiscount:'40',settlementMinSma2DPD:75,
  ptpGraceDays:2,ptpWindowDays:60
};
function rule(position,info={},customer={}) {
  return applyRules(position,{disputeFlag:false,deceasedFlag:false,...customer},info,cfg);
}
test('HCL L900002: 16-day overdue calculation and TELECALL',()=>{
  const pos=computePosition({principal:'300000'},[
    {instalmentNo:1,dueDate:'2026-03-15',emiAmount:'10253',closingPrincipal:'213556.57'}
  ],[],'2026-03-31',cfg);
  assert.equal(pos.dpd,16);
  assert.equal(pos.bucket,'SMA_0');
  assert.equal(pos.overdueAmount,'10253.00');
  assert.equal(pos.penalCharges,'107.87');
  assert.equal(pos.totalDues,'223917.44');
  assert.equal(rule(pos).contactStrategy,'TELECALL');
  assert.equal(rule(pos).queue,'TELECALLER');
});
test('HCL ₹100 shortage tolerance and FIFO including future instalment',()=>{
  const schedule=[
    {instalmentNo:1,dueDate:'2026-03-15',emiAmount:'5000',closingPrincipal:'10000'},
    {instalmentNo:2,dueDate:'2026-04-15',emiAmount:'5000',closingPrincipal:'5000'}
  ];
  const pos=computePosition({principal:'15000'},schedule,[
    {paymentId:'P1',paymentDate:'2026-03-10',amount:'9900'}
  ],'2026-03-31',cfg);
  assert.equal(pos.scheduleWithAllocation[0].unpaidAmount,'0.00');
  assert.equal(pos.scheduleWithAllocation[1].unpaidAmount,'100.00');
  assert.equal(pos.dpd,0);
});
test('HCL L900005 and L900010 escalation logic',()=>{
  const pos={dpd:44,bucket:'SMA_1',totalDues:'250000',overdueAmount:'20506'};
  assert.equal(rule(pos,{brokenCount:1}).contactStrategy,'FIELD_VISIT');
  assert.deepEqual(rule(pos,{brokenCount:2}).codes,['BROKEN_PTP_REPEAT']);
});
test('Hold takes precedence but keeps other reason codes',()=>{
  const result=rule({dpd:146,bucket:'NPA',totalDues:'849461.47',overdueAmount:'122970'},
    {brokenCount:0},{disputeFlag:true});
  assert.equal(result.contactStrategy,'HOLD');
  assert.equal(result.queue,'DISPUTE_DESK');
  assert.deepEqual(result.codes,['HOLD_DISPUTE','HIGH_VALUE','NPA_CLASSIFIED']);
});
test('PTP must not look ahead to future imported payments',()=>{
  const contacts=[{contactId:'C1',contactDate:'2026-03-10',outcome:'PTP',ptpDate:'2026-03-14',ptpAmount:'8000'}];
  const payments=[{paymentDate:'2026-04-01',amount:'8000'}];
  const outcome=derivePTPs(contacts,payments,'2026-03-31',cfg);
  assert.equal(outcome.items[0].status,'BROKEN');
  assert.equal(outcome.brokenCount,1);
});
test('HCL settlement routes and discount limits',()=>{
  const pos={dpd:146,bucket:'NPA',totalDues:'849461.47',contactStrategy:'RECOVERY'};
  assert.equal(evaluateSettlement(pos,'722042',cfg).route,'COLLECTIONS_MANAGER');
  assert.equal(evaluateSettlement(pos,'594623',cfg).route,'HEAD_OF_COLLECTIONS');
  assert.equal(evaluateSettlement(pos,'467204',cfg).reasonCode,'DISCOUNT_ABOVE_LIMIT');
});
test('Queue ranks escalated accounts before DPD, then overdue',()=>{
  const rows=[
    {loanId:'L2',queue:'FIELD',codes:[],dpd:80,overdueAmount:'1000'},
    {loanId:'L1',queue:'FIELD',codes:['HIGH_VALUE'],dpd:10,overdueAmount:'100'},
    {loanId:'L3',queue:'FIELD',codes:[],dpd:75,overdueAmount:'2000'}
  ];
  const ranks=rankWorklists(rows);
  assert.equal(ranks.find(x=>x.loanId==='L1').worklistRank,1);
  assert.equal(ranks.find(x=>x.loanId==='L2').worklistRank,2);
});
