import { expect, test } from '@playwright/test';
test.beforeEach(async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();});
  await page.reload();
  await expect(page.getByRole('heading',{name:'Welcome back, Ananya.'})).toBeVisible();
});
test('all modules render without runtime errors on desktop and mobile',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const routes=[['/worklist','Plan for the day'],['/loans','Loan accounts'],['/loans/LN-1001','Rahul Verma'],['/contacts','Contacts & promises'],['/settlements','Settlements'],['/reconciliation','Payment reconciliation'],['/day-end','Day-end pipeline'],['/imports','Import data'],['/exports','Export reports'],['/rules','Collection rules'],['/audit','Audit trail'],['/insights','AI insights']];
  for(const [path,title] of routes){await page.goto(path);await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();}
  await page.goto('/');await page.setViewportSize({width:390,height:844});
  await expect(page.getByRole('heading',{name:'Welcome back, Ananya.'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Open navigation'}).click();await expect(page.getByRole('navigation',{name:'Main navigation'})).toBeVisible();
  await page.getByRole('button',{name:'Close navigation',exact:true}).click({position:{x:375,y:30}});
  await page.screenshot({path:'test-results/mobile-overview.png',fullPage:true});
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:'test-results/desktop-overview.png',fullPage:true});
  expect(errors).toEqual([]);
});
test('collector scoping and auditor access follow the selected demo role',async({page})=>{
  await page.getByRole('combobox',{name:'Demo role'}).selectOption('COLLECTOR');
  await expect(page.getByRole('heading',{name:'Welcome back, Aarav.'})).toBeVisible();
  await page.goto('/loans');await expect(page.getByRole('button',{name:/Assign accounts/})).toHaveCount(0);
  await expect(page.getByRole('link',{name:/Sneha Patel/})).toHaveCount(0);
  await page.getByRole('combobox',{name:'Demo role'}).selectOption('AUDITOR');
  await page.goto('/contacts');await expect(page.getByRole('button',{name:'Log contact',exact:true})).toHaveCount(0);
  await page.goto('/day-end');await expect(page.getByRole('button',{name:'Run day-end',exact:true})).toBeDisabled();
});
test('logs a promise, re-runs day-end and exports a CSV',async({page})=>{
  await page.goto('/contacts');await page.getByRole('button',{name:'Log contact',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.getByLabel('Loan account').selectOption('LN-1001');
  await dialog.getByLabel('Outcome',{exact:true}).selectOption('Promise to pay');await dialog.getByLabel('Promised amount (INR)').fill('1200');
  const today=await page.evaluate(()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
  await dialog.getByLabel('Promise date',{exact:true}).fill(today);await dialog.getByLabel('Conversation notes').fill('Customer confirmed identity and agreed to the payment.');
  await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Save contact'}).click();await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Contact saved');
  await page.goto('/day-end');await page.getByRole('button',{name:'Run day-end',exact:true}).click();
  await expect(page.getByText('1 execution',{exact:false})).toBeVisible();
  const first=await page.evaluate(()=>JSON.parse(localStorage.getItem('collect.workspace.v1')).outbox.length);
  await page.getByRole('button',{name:'Run day-end',exact:true}).click();await expect(page.getByText('2 executions',{exact:false})).toBeVisible();
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('collect.workspace.v1')).outbox.length)).toBe(first);
  await page.goto('/exports');const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download CSV'}).first().click()]);
  expect(download.suggestedFilename()).toMatch(/^collections-.*\.csv$/);
});
test('a different head can approve a manager proposal',async({page})=>{
  await page.goto('/settlements');await expect(page.getByText('Needs a different reviewer')).toBeVisible();
  await page.getByRole('combobox',{name:'Demo role'}).selectOption('HEAD');await page.goto('/settlements');
  await page.getByRole('button',{name:'Approve ST-1001',exact:true}).click();await page.getByLabel('Decision note').fill('Independent hardship review completed.');
  await page.getByRole('button',{name:'Confirm decision'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);
  const result=await page.evaluate(()=>JSON.parse(localStorage.getItem('collect.workspace.v1')).settlements.find(s=>s.id==='ST-1001'));
  expect(result.status).toBe('Approved');expect(result.checkerId).toBe('head-1');
});
test('imports a CSV with preview then rejects a duplicate payment',async({page})=>{
  await page.goto('/imports');await page.getByRole('button',{name:/Payments/}).click();
  const file={name:'payments.csv',mimeType:'text/csv',buffer:Buffer.from('id,loanId,date,amount,reference\nPAY-E2E,LN-1001,2026-10-01,1200,UPI-E2E')};
  await page.getByLabel('Upload CSV file').setInputFiles(file);await expect(page.getByText('1 rows pass CSV validation')).toBeVisible();
  await page.getByRole('button',{name:'Import 1 records',exact:true}).click();await expect(page.getByRole('status')).toContainText('CSV imported');
  await page.getByLabel('Upload CSV file').setInputFiles(file);await page.getByRole('button',{name:'Import 1 records',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Duplicate payment');
});
