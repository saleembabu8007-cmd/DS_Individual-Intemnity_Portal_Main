import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,existsSync,readFileSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {qaEnabled,sampleMode,scenario} from '../dist/dev-mode.js';
import {createPreviewQuoteService,QuoteServiceError} from '../dist/quote-service.js';
import {createPreviewPaymentService} from '../dist/payment-service.js';
import {createPreviewOtpService} from '../dist/otp-service.js';
import {personas,variants} from '../dist/qa/fixtures.js';
import {validateCoverage,validateQuotation,validatePersonal,validateDeclarations} from '../dist/validation.js';

const doc=flag=>({querySelector:sel=>flag&&sel==='meta[name="ds-qa"]'?{getAttribute:()=>flag}:null});
const loc=search=>({search});
const storage=values=>({getItem:()=>JSON.stringify(values)});

test('test mode needs the ds-qa flag; a query parameter alone enables nothing',()=>{
 assert.equal(qaEnabled(doc(null)),false);
 assert.equal(qaEnabled(doc('disabled')),false);
 assert.equal(qaEnabled(doc('enabled')),true);
 assert.equal(sampleMode(doc(null),loc('?sample=1')),false);
 assert.equal(sampleMode(doc(null),loc('?review=1')),false);
 assert.equal(sampleMode(doc('enabled'),loc('?sample=1')),true);
 assert.equal(sampleMode(doc('enabled'),loc('')),false);
});

test('simulated outcomes are ignored outside test mode',()=>{
 assert.equal(scenario('quote',{doc:doc(null),storage:storage({quote:'error'})}),'ok');
 assert.equal(scenario('quote',{doc:doc('enabled'),storage:storage({quote:'error'})}),'error');
});

const build=args=>{const out=mkdtempSync(path.join(tmpdir(),'ds-build-'));execFileSync(process.execPath,['build.mjs','--out='+out,...args],{stdio:'pipe'});return out;};
test('production build contains no QA tools and no test-mode flag',()=>{
 const out=build([]);
 try{
  assert.equal(existsSync(path.join(out,'qa')),false);
  for(const f of readdirSync(out).filter(f=>f.endsWith('.html'))){
   const html=readFileSync(path.join(out,f),'utf8');
   assert.doesNotMatch(html,/ds-qa/,f);
  }
  assert.equal(readdirSync(out).some(f=>f.startsWith('_qa')),false);
  assert.ok(existsSync(path.join(out,'index.html'))&&existsSync(path.join(out,'dev-mode.js')));
 }finally{rmSync(out,{recursive:true,force:true});}
});

test('staging build (--qa) includes the panel and flags every page',()=>{
 const out=build(['--qa']);
 try{
  assert.ok(existsSync(path.join(out,'qa','qa-panel.js')));
  for(const f of readdirSync(out).filter(f=>f.endsWith('.html')))assert.match(readFileSync(path.join(out,f),'utf8'),/<meta name="ds-qa" content="enabled">/,f);
 }finally{rmSync(out,{recursive:true,force:true});}
});

const data={...personas.malaysian.data()};
test('simulated quotation outcomes',async()=>{
 const run=outcome=>createPreviewQuoteService({delay:0,pick:()=>outcome});
 assert.equal((await run('ok').calculate(data)).sample,true);
 for(const [o,msg] of [['error',/could not calculate/],['timeout',/too long/],['expired',/expired/]])await assert.rejects(run(o).calculate(data),e=>e instanceof QuoteServiceError&&msg.test(e.message));
 const svc=run('changed'),first=await svc.calculate(data),second=await svc.calculate(data);
 assert.equal(first.final,(await run('ok').calculate(data)).final);
 assert.ok(second.final>first.final);
 await assert.rejects(run('fail').sendQuotationEmail(data),/could not confirm/);
 assert.equal((await run('ok').sendQuotationEmail(data)).sample,true);
});

test('simulated checkout, OTP and claim outcomes',async()=>{
 const pay=o=>createPreviewPaymentService({delay:0,pick:()=>o});
 await assert.rejects(pay('fail').submitApplication(data,{}),/could not be submitted/);
 await assert.rejects(pay('start-date').submitApplication(data,{}),e=>e.code==='start-date');
 const otp=(o)=>createPreviewOtpService({delay:0,pick:name=>o[name]||'ok'});
 await assert.rejects(otp({otpSend:'ratelimited'}).send({flow:'renewal',mobile:'0123456789'}),e=>e.code==='rate-limited');
 assert.equal((await otp({otpVerify:'none'}).verify({flow:'renewal',code:'123456'})).kind,'none');
 assert.equal((await otp({otpVerify:'single'}).verify({flow:'claims',code:'123456'})).kind,'claim');
 await assert.rejects(otp({otpVerify:'wrong'}).verify({flow:'renewal',code:'123456'}),e=>e.code==='wrong-otp');
 await assert.rejects(otp({claimSubmit:'fail'}).submitClaim({}),/could not confirm/);
});

test('every test persona is complete and valid; variants produce the intended errors',()=>{
 const today=new Date();
 for(const [key,p] of Object.entries(personas)){
  const d=p.data();
  const errors={...validateCoverage(d,today),...validateQuotation(d),...validatePersonal(d,today),...validateDeclarations(d)};
  assert.deepEqual(errors,{},key);
 }
 const bad=variants.invalidFormat(personas.malaysian.data());
 assert.ok(validateCoverage(bad,new Date()).email);
 const personal=validatePersonal(bad,new Date());assert.ok(personal.mobile&&personal.nric&&personal.patients&&personal.revenue);
 const adverse=validateDeclarations(variants.adverse(personas.malaysian.data()));assert.ok(adverse.q0Details&&adverse.q2Details&&adverse.declaration);
});
