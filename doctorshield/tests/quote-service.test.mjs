import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuoteService,createLiveQuoteService,createUnconnectedQuoteService,createPreviewQuoteService,buildQuoteRequest,parseQuoteResponse,parseAmount,emailAccepted,pricingKey,apiBaseFrom,QuoteServiceError} from '../dist/quote-service.js';
import {IntegrationRequiredError} from '../dist/api.js';

const data={classification:'General Medical Practitioner',liability:'RM 1,000,000',start:'2026-11-26',email:' dr@example.com ',promo:' promo10 ',consent:true,allocations:{},clinic:'No',picAny:'Yes',ownership:'',locum:'',picOther:'',clinicCover:false,picCover:true,clinicLiability:'',intent:'Buy now'};
const encode=obj=>Buffer.from(JSON.stringify(obj)).toString('base64');
const liveResponse=(overrides={})=>({data:encode({premium:{insurance_start_date:'26/11/2026',insurance_end_date:'31/12/2027',oneyearpremium:'RM 1,834.00',quotation:'Q-1001',calculated:{discount_percentage:'10',reviewPage:{individual:{without_discount_premium:'1,739.75',discount:'173.98',total_premium_after_discount:'1,565.77',tax_amount:'125.26',stamp_duty:'10.00',total_premium:'1,701.03',individual_original_premium:'1,739.75'},medical_establishment:{individual_pic_premium:'150.00'}}},...overrides}}),policy_wording_pdf:'https://my-individualindemnity.doctorshield.com/policy.pdf'});

test('amounts parse from ringgit strings and reject junk',()=>{
 assert.equal(parseAmount('RM 1,888.93'),1888.93);assert.equal(parseAmount('1,834'),1834);assert.equal(parseAmount(12.5),12.5);
 for(const bad of ['', 'abc', '-5', null, undefined, NaN, -1, '1.2.3'])assert.equal(parseAmount(bad),null);
});

test('request uses live field names and DD/MM/YYYY dates',()=>{
 const p=buildQuoteRequest(data,{liabilityIds:{'RM 1,000,000':'42'},token:'tok'});
 assert.equal(p.get('_token'),'tok');assert.equal(p.get('classification_id'),'7');assert.equal(p.get('liability_id'),'42');
 assert.equal(p.get('insurance_start_date'),'26/11/2026');assert.equal(p.get('insurance_end_date'),'31/12/2027');
 assert.equal(p.get('customer_email'),'dr@example.com');assert.equal(p.get('promo_code'),'promo10');
 assert.equal(p.get('pic_contend_coverage_status'),'1');assert.equal(p.get('medical_establishment_package_value'),'0');
 assert.equal(p.get('are_you_pic_of_any_clinic_status_value'),'1');assert.equal(p.get('do_you_own_clinic_status_value'),'0');
});

test('response maps premium, 12-month reference, dates and policy wording',()=>{
 const q=parseQuoteResponse(liveResponse());
 assert.equal(q.final,1701.03);assert.equal(q.oneYear,1834);assert.equal(q.discount,173.98);assert.equal(q.total,1739.75);
 assert.equal(q.net,1565.77);assert.equal(q.sst,125.26);assert.equal(q.stampDuty,10);
 assert.equal(q.start,'2026-11-26');assert.equal(q.end,'2027-12-31');assert.equal(q.quotationNumber,'Q-1001');
 assert.equal(q.policyWordingUrl,'https://my-individualindemnity.doctorshield.com/policy.pdf');
 assert.equal(q.sample,false);assert.ok(q.items.some(i=>i.label==='PIC coverage'&&i.amount===150));
});

test('unusable responses never produce a premium',()=>{
 assert.throws(()=>parseQuoteResponse({error:true,message:'Classification closed'}),/Classification closed/);
 assert.throws(()=>parseQuoteResponse({data:'%%%not-base64'}),QuoteServiceError);
 assert.throws(()=>parseQuoteResponse({data:encode({premium:{calculated:{reviewPage:{individual:{total_premium:'n/a'}}}}})}),/not available/);
 assert.equal(parseQuoteResponse({...liveResponse(),policy_wording_pdf:'javascript:alert(1)'}).policyWordingUrl,'');
});

test('email success requires explicit acceptance',()=>{
 assert.equal(emailAccepted({}),false);assert.equal(emailAccepted(null),false);assert.equal(emailAccepted({error:true,success:true}),false);
 assert.equal(emailAccepted({success:true}),true);assert.equal(emailAccepted({status:'sent'}),true);
});

test('pricing key changes with priced inputs only',()=>{
 const k=pricingKey(data);
 assert.equal(pricingKey({...data,fullName:'Someone'}),k);assert.equal(pricingKey({...data,intent:'Email'}),k);
 for(const change of [{liability:'RM 500,000'},{start:'2027-01-01'},{promo:'OTHER'},{picCover:false},{classification:'Lecturer'}])assert.notEqual(pricingKey({...data,...change}),k);
 assert.equal(pricingKey({...data,promo:'PROMO10'}),k,'promo is case and space insensitive');
});

test('unconnected service refuses every operation without inventing data',async()=>{
 const s=createUnconnectedQuoteService();
 for(const op of ['getLiabilities','validatePromo','calculate','sendQuotationEmail'])await assert.rejects(()=>s[op](data),IntegrationRequiredError);
 assert.equal(createQuoteService({apiBase:''}).mode,'unconnected');
});

test('api base accepts https or same-origin only',()=>{
 const doc=content=>({querySelector:()=>({getAttribute:()=>content})});
 assert.equal(apiBaseFrom(doc('https://my-individualindemnity.doctorshield.com/')),'https://my-individualindemnity.doctorshield.com');
 assert.equal(apiBaseFrom(doc('http://insecure.example')),'');assert.equal(apiBaseFrom(doc('javascript:alert(1)')),'');assert.equal(apiBaseFrom(doc('')),'');
});

function fakeFetch(routes){const calls=[];const fn=async(url,init)=>{calls.push({url,init});const path=new URL(url).pathname;const handler=routes[path];if(!handler)return {ok:false,status:404,json:async()=>({})};const result=await handler(init);return {ok:result.status?result.status<400:true,status:result.status||200,json:async()=>result.body??result};};fn.calls=calls;return fn;}

test('live service: CSRF, limits lookup, calculation and email confirmation',async()=>{
 const fetchImpl=fakeFetch({
  '/api/getCSRFToken':()=>({token:'csrf-1'}),
  '/api/getLiabilities':()=>({liabilities:{'41':'RM 500,000','42':'RM 1,000,000'}}),
  '/api/calculatePremium':init=>{assert.equal(new URLSearchParams(init.body).get('liability_id'),'42');return liveResponse();},
  '/api/validatePromoCode':init=>new URLSearchParams(init.body).get('promo_code')==='promo10'?{promo_code:{code:'promo10'}}:{error:true},
  '/api/sendIndicativeEmail':init=>{assert.ok(new URLSearchParams(init.body).get('premium'));return {success:true};}
 });
 const s=createLiveQuoteService({apiBase:'https://api.example',fetchImpl});
 assert.deepEqual(await s.getLiabilities(data),['RM 500,000','RM 1,000,000']);
 assert.equal((await s.validatePromo(data)).valid,true);
 assert.equal((await s.validatePromo({...data,promo:'nope'})).valid,false);
 const quote=await s.calculate(data);assert.equal(quote.final,1701.03);
 const sent=await s.sendQuotationEmail(data,quote);assert.deepEqual(sent,{accepted:true,sample:false,to:'dr@example.com',reference:'Q-1001'});
 assert.ok(fetchImpl.calls.every(c=>c.init.credentials==='include'));
 assert.ok(fetchImpl.calls.filter(c=>!c.url.endsWith('getCSRFToken')).every(c=>c.init.headers['X-CSRF-TOKEN']==='csrf-1'));
});

test('live service: silent or failed email is reported as not sent',async()=>{
 const base={'/api/getCSRFToken':()=>({token:'t'}),'/api/getLiabilities':()=>({liabilities:{'42':'RM 1,000,000'}}),'/api/calculatePremium':()=>liveResponse()};
 const silent=createLiveQuoteService({apiBase:'https://api.example',fetchImpl:fakeFetch({...base,'/api/sendIndicativeEmail':()=>({})})});
 await assert.rejects(async()=>silent.sendQuotationEmail(data,await silent.calculate(data)),/could not confirm/);
 const down=createLiveQuoteService({apiBase:'https://api.example',fetchImpl:fakeFetch({...base,'/api/sendIndicativeEmail':()=>({status:503,body:{}})})});
 await assert.rejects(async()=>down.sendQuotationEmail(data,await down.calculate(data)),/temporarily unavailable/);
 await assert.rejects(()=>down.sendQuotationEmail(data,{sample:true}),/Calculate your premium/);
});

test('live service: network failure and mismatched dates are errors, not prices',async()=>{
 const offline=createLiveQuoteService({apiBase:'https://api.example',fetchImpl:async()=>{throw new TypeError('Failed to fetch');}});
 await assert.rejects(()=>offline.calculate(data),/could not reach/);
 const mismatch=createLiveQuoteService({apiBase:'https://api.example',fetchImpl:fakeFetch({'/api/getCSRFToken':()=>({token:'t'}),'/api/getLiabilities':()=>({liabilities:{'42':'RM 1,000,000'}}),'/api/calculatePremium':()=>liveResponse({insurance_start_date:'01/12/2026'})})});
 await assert.rejects(()=>mismatch.calculate(data),/does not match/);
});

test('preview service is always flagged as a sample',async()=>{
 const s=createPreviewQuoteService({delay:0});
 const q=await s.calculate(data);assert.equal(q.sample,true);assert.equal(q.end,'2027-12-31');assert.ok(q.oneYear>0);
 assert.equal((await s.sendQuotationEmail(data,q)).sample,true);
});
