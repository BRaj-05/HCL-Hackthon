'use strict';
const { D } = require('./money');
function rankWorklists(rows){
  const grouped=new Map();
  for (const row of rows){
    if (row.queue === null || row.queue === undefined) continue;
    if (!grouped.has(row.queue))grouped.set(row.queue,[]);
    grouped.get(row.queue).push(row);
  }
  const ranked=[];
  for(const group of grouped.values()){
    group.sort((a,b)=>{
      const escalated=r=>r.codes.includes('BROKEN_PTP_REPEAT')||r.codes.includes('HIGH_VALUE')?1:0;
      const e=escalated(b)-escalated(a);if(e)return e;
      if(b.dpd!==a.dpd)return b.dpd-a.dpd;
      const c=D(b.overdueAmount).cmp(D(a.overdueAmount));if(c)return c;
      return a.loanId < b.loanId ? -1 : a.loanId > b.loanId ? 1 : 0;
    });
    group.forEach((r,i)=>ranked.push({...r,worklistRank:i+1}));
  }
  const rankByLoanId = new Map(ranked.map(row => [row.loanId,row]));
  return rows.map(r=>r.queue ? rankByLoanId.get(r.loanId) : {...r,worklistRank:null});
}
module.exports={rankWorklists};
