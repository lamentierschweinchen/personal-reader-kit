import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {build} from '../scripts/build.mjs';
import {startServer} from '../scripts/serve.mjs';
export async function preview(){await build();return startServer();}
export async function appReady(page){await page.evaluate(async()=>{await import('/app.mjs');});}
export async function dismissNotice(page){await appReady(page);if(await page.locator('#first-source-notice').count())await page.locator('[data-action="dismiss-source-notice"]').click();}
export function watch(context){
  const errors=[],external=[];
  context.on('page',page=>{page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(!/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?\//.test(request.url())&&!/^(?:data:|blob:)/.test(request.url()))external.push(request.url());});});
  return {errors,external};
}
export async function policyWatch(context){await context.addInitScript(()=>{window.__cspViolations=[];addEventListener('securitypolicyviolation',e=>window.__cspViolations.push({directive:e.violatedDirective,blocked:e.blockedURI}));});}
export async function assertClean(page,observed){assert.deepEqual(observed.errors,[]);assert.deepEqual(observed.external,[]);assert.deepEqual(await page.evaluate(()=>window.__cspViolations),[]);}
export async function sourceNoticeCheck(page){
  await appReady(page);const book=JSON.parse(await readFile(new URL('../edition/library.json',import.meta.url)))[0];
  const original=book.context.flatMap(n=>n.text.split('\n\n')).find(p=>p.startsWith('This eBook is for the use of anyone'));
  assert.equal(await page.locator('#first-source-notice>p').nth(1).textContent(),original);
  await page.locator('[data-action="source-notices"]').click();
  assert.equal(await page.locator('#source-notices').textContent(),book.context.filter(n=>n.kind==='source').map(n=>n.text).join('\n\n'));
  assert.equal(await page.locator('#source-notices').evaluate(n=>n.closest('details').open),true);
  await page.locator('#dialog [data-action="close"]').click();await page.locator('#dialog').waitFor({state:'hidden'});
  await dismissNotice(page);await page.reload();await appReady(page);assert.equal(await page.locator('#first-source-notice').count(),0);
}
