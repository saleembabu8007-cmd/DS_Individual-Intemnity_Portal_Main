import test from 'node:test';
import assert from 'node:assert/strict';
import {parseQuoteResponse,breakdownConsistent,samePayable,createLiveClient,createLiveQuoteService,QuoteServiceError} from '../dist/quote-service.js';
import {paymentMethods,normalisePaymentMethod,paymentMethodError,paymentMethodLabel,buildApplicationRequest,parsePaymentStatus,createLivePaymentService,createUnconnectedPaymentService,createPaymentService,readAttempt,saveAttempt,clearAttempt} from '../dist/payment-service.js';
import {IntegrationRequiredError} from '../dist/api.js';
import {summaryBreakdown,premiumBreakdown} from '../dist/premium-components.js';
import {resultView} from '../dist/payment-result-view.js';

const encode=obj=>Buffer.from(JSON.stringify(obj)).toString('base64');
// Shape of the live reviewPage.individual block as read by the live summary (home.min.js).
const individual={without_discount_premium:'1,739.75',total_individual_renistatment_premium:'1,739.75',individual_original_premium:'1,739.75',individual_reinstatement_premium:'0.00',discount:null,total_premium_after_discount:'1,565.77',tax_amount:'125.26',stamp_duty:'10.00',total_premium:'1,701.03'};
const live=(block=individual,extra={})=>({data:encode({premium:{quotation:'Q-1001',insurance_start_date:'26/11/2026',insurance_end_date:'31/12/2027',model:{country:{amount_sign:'RM'}},calculated:{discount:'173.98',reviewPage:{individual:block}},...extra}})});
const quote={sample:false,total:1739.75,discount:173.98,net:1565.77,sst:125.26,stampDuty:10,final:1701.03,quotationNumber:'Q-1001',items:[{label:'Individual indemnity',amount:1739.75}],reinstatement:0,raw:{quotation:'Q-1001'}};
const applicant={classification:'General Medical Practitioner',liability:'RM 1,000,000',start:'2026-11-26',email:'dr@example.com',promo:'',consent:true,allocations:{},clinic:'No',picAny:'No',ownership:'',locum:'',picOther:'',clinicCover:false,picCover:false,clinicLiability:'',fullName:'Alex Tan',dob:'1985-06-15',nric:'850615-10-1234',nationality:'Malaysia',otherNationality:'',tin:'IG123',practice:'Klinik A, KL',mobile:'012-345 6789',patients:'1,200',revenue:'250,000.00',answers:{q0:'Disagree',q1:'No',q2:'Yes',q3:'No'},q0Details:'Claim 2019',q2Details:'Board review',declaration:true,payment:'business_payment',branches:[]};

test('summary uses the live Total Premium field and falls back to the calculated discount (#5, #10)',()=>{
 const q=parseQuoteResponse(live());
 assert.equal(q.total,1739.75);assert.equal(q.discount,173.98);assert.equal(q.net,1565.77);assert.equal(q.final,1701.03);assert.equal(q.reinstatement,0);assert.equal(q.currency,'RM');
});

test('a breakdown that does not add up is never shown as payable',()=>{
 assert.equal(breakdownConsistent(quote),true);
 assert.equal(breakdownConsistent({...quote,final:1800}),false);
 assert.equal(breakdownConsistent({...quote,net:1600}),false);
 assert.equal(breakdownConsistent({...quote,final:0,net:0,total:0,discount:0,sst:0,stampDuty:0}),false);
 assert.throws(()=>parseQuoteResponse(live({...individual,total_premium:'1,900.00'})),/could not be confirmed/);
 assert.throws(()=>parseQuoteResponse(live(individual,{model:{country:{amount_sign:'$'}}})),/unexpected currency/);
});

test('a changed amount or quotation is detected before payment',()=>{
 assert.equal(samePayable(quote,{...quote}),true);
 assert.equal(samePayable(quote,{...quote,final:1701.04}),false);
 assert.equal(samePayable(quote,{...quote,quotationNumber:'Q-1002'}),false);
 assert.equal(samePayable(quote,null),false);
});

test('summary breakdown shows every line, emphasises the final amount and assumes no rates',()=>{
 const html=summaryBreakdown({...quote,discount:173.98},{promo:'promo10'});
 for(const label of ['Individual indemnity','Automatic Reinstatement','Complimentary','Total Premium','Discount','Nett Premium','SST','Stamp Duty','Final Premium Payable','PROMO10'])assert.match(html,new RegExp(label));
 assert.match(html,/<tfoot><tr class="summary-breakdown-final"><th scope="row">Final Premium Payable<\/th><td>RM 1,701.03<\/td>/);
 assert.match(html,/− RM 173.98/);
 assert.doesNotMatch(html+premiumBreakdown(quote),/8%|25%|commission/);
 assert.equal(summaryBreakdown(null),'');assert.equal(summaryBreakdown({...quote,final:null}),'');
});

test('payment options are the two the live portal offers, with validation',()=>{
 assert.deepEqual(paymentMethods.map(m=>m.value),['credit_card_payment','business_payment']);
 assert.equal(normalisePaymentMethod('Business Internet Banking'),'business_payment');// saved by earlier versions
 assert.equal(normalisePaymentMethod('cash'),'');
 assert.equal(paymentMethodError(''),'Select a payment option.');assert.equal(paymentMethodError('credit_card_payment'),'');
 assert.equal(paymentMethodLabel('business_payment'),'Business Internet Banking');
});

test('application request uses live field names and the verified declaration encoding',()=>{
 const p=buildApplicationRequest(applicant,quote,{liabilityIds:{'RM 1,000,000':'42'},token:'tok'});
 assert.equal(p.get('quotationNumber'),'Q-1001');assert.equal(p.get('_token'),'tok');
 assert.equal(p.get('customer_name'),'Alex Tan');assert.equal(p.get('customer_dob'),'15/06/1985');assert.equal(p.get('nric_number'),'850615101234');
 assert.equal(p.get('customer_phone'),'123456789');assert.equal(p.get('no_of_patients'),'1200');assert.equal(p.get('revenue'),'250000.00');
 assert.equal(p.get('payment_option_type'),'business_payment');assert.equal(p.get('important_notice_the_applicant'),'1');
 // Q1 "Disagree" -> unchecked; Q3 "Yes" -> checked.
 assert.equal(p.has('have_claim_ever_been_made'),false);assert.equal(p.get('have_been_disciplinary_action'),'1');assert.equal(p.has('aware_of_errors'),false);
 assert.equal(p.get('no_claim_desc'),'Claim 2019');assert.equal(p.get('desciplinary_action_desc'),'Board review');
 const agree=buildApplicationRequest({...applicant,answers:{q0:'Agree',q1:'No',q2:'No',q3:'No'}},quote);
 assert.equal(agree.get('have_claim_ever_been_made'),'1');
 const clinic=buildApplicationRequest({...applicant,clinicCover:true,clinicName:'Klinik A Sdn Bhd',answers:{qOrg0:'No',qOrg1:'Yes',qOrg2:'No',qOrg3:'No'},orgDetails:'Details'},quote);
 assert.equal(clinic.get('medical_establishment_aware_of_errors'),'1');assert.equal(clinic.get('medical_establishment_answers'),'Details');assert.equal(clinic.get('clinic_name'),'Klinik A Sdn Bhd');
 assert.equal(clinic.has('have_claim_ever_been_made'),false);
});

test('only a complete, matching backend confirmation counts as paid',()=>{
 const paid={status:'paid',quotationNumber:'Q-1001',transactionReference:'TXN-9',amount:'RM 1,701.03',plan:'Chubb Elite',insuranceStartDate:'26/11/2026',insuranceEndDate:'31/12/2027',email:'dr@example.com'};
 const r=parsePaymentStatus(paid,{expectedQuotation:'Q-1001'});
 assert.equal(r.status,'paid');assert.equal(r.amount,1701.03);assert.equal(r.transactionReference,'TXN-9');
 assert.equal(parsePaymentStatus({...paid,transactionReference:''}).status,'unverified');
 assert.equal(parsePaymentStatus({...paid,amount:0}).status,'unverified');
 assert.equal(parsePaymentStatus({...paid,quotationNumber:'Q-OTHER'},{expectedQuotation:'Q-1001'}).status,'unverified');
 assert.equal(parsePaymentStatus({status:'SUCCESS'}).status,'unverified');
 assert.equal(parsePaymentStatus(null).status,'unverified');
 assert.equal(parsePaymentStatus({status:'pending',quotationNumber:'Q-1001'}).status,'pending');
});

const fakeFetch=routes=>{const calls=[];const fn=async(url,init)=>{calls.push({url,body:String(init.body)});const path=new URL(url).pathname;const r=routes[path];if(!r)return {ok:false,status:404,json:async()=>({})};return {ok:true,status:200,json:async()=>typeof r==='function'?r(init):r};};fn.calls=calls;return fn;};

test('live checkout: submit, then hand off to the gateway with the quotation number',async()=>{
 const fetchImpl=fakeFetch({'/api/getCSRFToken':{token:'tok'},'/api/updateProposerInformation':{success:true},'/api/sendFinalPageEmail':{}});
 const client=createLiveClient({apiBase:'https://api.example.com',fetchImpl});
 const forms=[];
 const service=createLivePaymentService({apiBase:'https://api.example.com',client,submitForm:(action,fields)=>forms.push({action,fields})});
 assert.deepEqual(await service.submitApplication(applicant,quote),{accepted:true,quotationNumber:'Q-1001'});
 assert.ok(fetchImpl.calls.some(c=>c.url.endsWith('/api/updateProposerInformation')&&c.body.includes('payment_option_type=business_payment')));
 await service.startPayment({quotationNumber:'Q-1001'});
 assert.deepEqual(forms,[{action:'https://api.example.com/doPayment',fields:{quotationNumber:'Q-1001',_token:'tok'}}]);
 await assert.rejects(service.submitApplication(applicant,{...quote,sample:true}),/not ready for payment/);
});

test('live checkout: a rejected start date stops payment with a clear reason',async()=>{
 const fetchImpl=fakeFetch({'/api/getCSRFToken':{token:'tok'},'/api/updateProposerInformation':{error:'error'}});
 const service=createLivePaymentService({apiBase:'https://api.example.com',client:createLiveClient({apiBase:'https://api.example.com',fetchImpl}),submitForm:()=>{throw new Error('must not redirect');}});
 await assert.rejects(service.submitApplication(applicant,quote),e=>e.code==='start-date'&&e instanceof QuoteServiceError);
});

test('payment cannot be verified without a configured status endpoint',async()=>{
 const fetchImpl=fakeFetch({'/api/getCSRFToken':{token:'tok'},'/api/paymentStatus':{status:'paid',quotationNumber:'Q-1001',transactionReference:'T1',amount:1701.03}});
 const client=createLiveClient({apiBase:'https://api.example.com',fetchImpl});
 await assert.rejects(createLivePaymentService({apiBase:'https://api.example.com',client}).verifyPayment({quotationNumber:'Q-1001'}),IntegrationRequiredError);
 const r=await createLivePaymentService({apiBase:'https://api.example.com',client,statusPath:'/api/paymentStatus'}).verifyPayment({quotationNumber:'Q-1001'});
 assert.equal(r.status,'paid');
});

test('without a backend nothing is submitted, charged or confirmed',async()=>{
 const s=createUnconnectedPaymentService();
 for(const op of ['submitApplication','startPayment','verifyPayment'])await assert.rejects(s[op]({}),IntegrationRequiredError);
 assert.equal(createPaymentService({apiBase:''}).mode,'unconnected');
});

test('payment attempts are remembered per tab to prevent a silent second payment',()=>{
 const store=new Map();const storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)};
 assert.equal(readAttempt(storage),null);
 saveAttempt(storage,{quotationNumber:'Q-1001',amount:1701.03,startedAt:1});
 assert.equal(readAttempt(storage).quotationNumber,'Q-1001');
 clearAttempt(storage);assert.equal(readAttempt(storage),null);
 assert.equal(readAttempt({getItem:()=>{throw new Error('blocked');}}),null);
});

test('result screens: success only for verified payments, with recovery actions otherwise (#6)',()=>{
 const paid=resultView({status:'paid',quotationNumber:'Q-1001',transactionReference:'TXN-9',amount:1701.03,start:'26/11/2026',end:'31/12/2027',email:'dr@example.com'});
 assert.equal(paid.title,'Payment successful');
 for(const text of ['TXN-9','Q-1001','RM 1,701.03','26/11/2026 to 31/12/2027','dr@example.com','What happens next','WhatsApp'])assert.ok(paid.html.includes(text),text);
 for(const status of ['pending','failed','cancelled','unverified','unavailable','missing',undefined]){
  const v=resultView({status,quotationNumber:'Q-1001'});
  assert.doesNotMatch(v.title+v.html,/Payment successful|has been received/,String(status));
  assert.match(v.html,/WhatsApp/);
 }
 assert.match(resultView({status:'pending'}).html,/do not pay again/);
 assert.match(resultView({status:'unverified'}).html,/data-action="recheck"/);
 assert.match(resultView({status:'failed'}).html,/Try payment again/);
 assert.match(resultView({status:'paid',transactionReference:'<img src=x>',quotationNumber:'Q',amount:1}).html,/&lt;img src=x&gt;/);
 assert.match(resultView({status:'paid',transactionReference:'T',quotationNumber:'Q',amount:1},{sample:true}).html,/Test mode/);
});
