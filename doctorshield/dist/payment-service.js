// Checkout boundary: application submission, hand-off to the payment gateway, payment verification.
//
// Card, wallet and bank details are never collected here. The existing DoctorShield backend
// redirects the browser to its payment provider (live client: POST {APP_URL}/doPayment with
// quotationNumber + _token, after /api/updateProposerInformation). Contract taken from
// assets/js/home.min.js (reviewed 23 Nov 2026); items marked VERIFY need backend confirmation.
//
// A purchase is only shown as successful when the backend verifies the transaction.
// Same three modes as quote-service.js: unconnected (default), live, preview (?sample=1 only).
import {IntegrationRequiredError} from './api.js';
import {configuration} from './catalog.js';
import {QuoteServiceError,buildQuoteRequest,createLiveClient,apiBaseFrom} from './quote-service.js';
import {normaliseId,normaliseMobile,parseIncome} from './personal-rules.js';
import {apiDate} from './coverage-rules.js';
import {scenario} from './dev-mode.js';

/** Payment options offered by the live portal (payment_option_type). Retained as found; see docs 10.2. */
export const paymentMethods=Object.freeze([
 Object.freeze({value:'credit_card_payment',label:'Credit/Debit Card/Wallet/Personal Internet Banking',description:'Pay with a debit or credit card, an e-wallet or your personal online banking.'}),
 Object.freeze({value:'business_payment',label:'Business Internet Banking',description:'Pay from a company or business bank account.'})
]);
const legacyLabels=Object.fromEntries(paymentMethods.map(m=>[m.label,m.value]));
/** Accepts a stored value or a label saved by earlier versions; anything else -> ''. */
export function normalisePaymentMethod(value){return paymentMethods.some(m=>m.value===value)?value:legacyLabels[value]||'';}
export function paymentMethodError(value){return normalisePaymentMethod(value)?'':'Select a payment option.';}
export const paymentMethodLabel=value=>paymentMethods.find(m=>m.value===normalisePaymentMethod(value))?.label||'';

const tick=(answer,adverse)=>answer===adverse?'1':'';
/**
 * Form body for /api/updateProposerInformation (live field names from the live form).
 * Declaration checkboxes: checked ("1") = "Agree" for individual Q1, "Yes" for the others
 * (verified from the live change handlers). Unchecked boxes are omitted, as a browser form would.
 */
export function buildApplicationRequest(data,quote,{liabilityIds={},token=''}={}){
 const p=buildQuoteRequest({...data,intent:'Buy now'},{liabilityIds,token});
 const set=(k,v)=>{if(v!==''&&v!==undefined&&v!==null)p.set(k,String(v));};
 set('quotationNumber',quote.quotationNumber);
 if(quote.raw)p.set('premium',JSON.stringify(quote.raw));
 p.set('is_completed','1');
 set('customer_name',String(data.fullName||'').trim());
 set('customer_dob',apiDate(data.dob));
 if(configuration(data)?.nric)set('nric_number',normaliseId(data.nric));
 set('nationality',data.nationality);
 if(data.nationality==='Others')set('other_nationality',String(data.otherNationality||'').trim());
 set('customer_address',String(data.practice||'').trim());
 set('customer_phone',normaliseMobile(data.mobile));
 if(data.clinicCover)set('clinic_name',String(data.clinicName||'').trim());
 if(configuration(data)?.patients)set('no_of_patients',String(data.patients||'').replace(/,/g,''));
 if(configuration(data)?.revenue){const income=parseIncome(data.revenue);if(income!==null)set('revenue',income.toFixed(2));}
 // VERIFY: is_tin_number is a hidden field the live client fills from /api/getTaxTinCheck.
 set('is_tin_number',String(data.tin||'').trim());
 if(data.clinicCover){
  // VERIFY: branch_details format (live stores a serialised list in a hidden field).
  if(data.branches?.length)p.set('branch_details',JSON.stringify(data.branches));
  p.set('branch_indemnity_agreed',data.branches?.length?'1':'0');
  const a=data.answers||{};
  set('medical_establishment_have_claim_ever_been_made',tick(a.qOrg0,'Yes'));
  set('medical_establishment_aware_of_errors',tick(a.qOrg1,'Yes'));
  set('medical_establishment_have_been_disciplinary_action',tick(a.qOrg2,'Yes'));
  set('medical_establishment_had_criminal_charges',tick(a.qOrg3,'Yes'));
  set('medical_establishment_answers',String(data.orgDetails||'').trim());
  set('medical_establishment_criminal_charges_desc',String(data.orgCriminalDetails||'').trim());
 }else{
  const a=data.answers||{};
  set('have_claim_ever_been_made',tick(a.q0,'Agree'));
  set('aware_of_errors',tick(a.q1,'Yes'));
  set('have_been_disciplinary_action',tick(a.q2,'Yes'));
  set('had_criminal_charges',tick(a.q3,'Yes'));
  set('no_claim_desc',String(data.q0Details||'').trim());
  set('aware_of_errors_desc',String(data.q1Details||'').trim());
  set('desciplinary_action_desc',String(data.q2Details||'').trim());
  set('criminal_charges_desc',String(data.q3Details||'').trim());
 }
 p.set('important_notice_the_applicant',data.declaration?'1':'0');
 p.set('payment_option_type',normalisePaymentMethod(data.payment));
 return p;
}

/**
 * Verified payment result. Proposed contract (the live portal renders its result pages on the
 * server, so there is no JSON status endpoint to copy):
 * { status: "paid"|"pending"|"failed"|"cancelled", quotationNumber, transactionReference,
 *   amount, plan, insuranceStartDate (dd/mm/yyyy), insuranceEndDate, email, paidAt }
 * "paid" is only accepted with a transaction reference, a positive amount and, when known,
 * the quotation number this browser paid for. Everything else is not a success.
 */
export function parsePaymentStatus(json,{expectedQuotation=''}={}){
 const text=v=>typeof v==='string'||typeof v==='number'?String(v).trim():'';
 const status=text(json?.status).toLowerCase();
 const amount=typeof json?.amount==='number'?json.amount:Number(String(json?.amount??'').replace(/RM|MYR|,|\s/gi,''));
 const result={
  status:['paid','pending','failed','cancelled'].includes(status)?status:'unverified',
  quotationNumber:text(json?.quotationNumber),
  transactionReference:text(json?.transactionReference),
  amount:Number.isFinite(amount)&&amount>0?Math.round(amount*100)/100:null,
  plan:text(json?.plan),
  start:text(json?.insuranceStartDate),
  end:text(json?.insuranceEndDate),
  email:text(json?.email),
  paidAt:text(json?.paidAt)
 };
 if(expectedQuotation&&result.quotationNumber&&result.quotationNumber!==String(expectedQuotation))return {...result,status:'unverified',reason:'mismatch'};
 if(result.status==='paid'&&(!result.transactionReference||result.amount===null||!result.quotationNumber))return {...result,status:'unverified',reason:'incomplete'};
 return result;
}

// One payment attempt per quotation, remembered in this tab, so a second payment is never started silently.
const attemptKey='doctorshield.payment-attempt.v1';
export function readAttempt(storage){try{const a=JSON.parse(storage?.getItem(attemptKey)||'null');return a&&typeof a.quotationNumber==='string'&&a.quotationNumber?a:null;}catch{return null;}}
export function saveAttempt(storage,attempt){try{storage?.setItem(attemptKey,JSON.stringify(attempt));return true;}catch{return false;}}
export function clearAttempt(storage){try{storage?.removeItem(attemptKey);}catch{}}

/** Builds and submits the hidden POST form the live client uses to reach the gateway. */
export function submitGatewayForm(action,fields,doc=globalThis.document){
 const form=doc.createElement('form');form.method='POST';form.action=action;form.hidden=true;
 for(const [name,value] of Object.entries(fields)){const input=doc.createElement('input');input.type='hidden';input.name=name;input.value=value;form.appendChild(input);}
 doc.body.appendChild(form);form.submit();
}

export function createUnconnectedPaymentService(){
 const fail=label=>async()=>{throw new IntegrationRequiredError(label);};
 return Object.freeze({mode:'unconnected',submitApplication:fail('Application submission'),startPayment:fail('Payment processing'),verifyPayment:fail('Payment verification')});
}

export function createLivePaymentService({apiBase,client=createLiveClient({apiBase}),quoteService,statusPath='',submitForm=submitGatewayForm}){
 return Object.freeze({
  mode:'live',
  async submitApplication(data,quote){
   if(!quote||quote.sample||!quote.quotationNumber)throw new QuoteServiceError('Your quotation is not ready for payment. Please refresh your premium.',{retryable:false});
   const token=await client.ensureToken();
   const json=await client.post('/api/updateProposerInformation',buildApplicationRequest(data,quote,{liabilityIds:quoteService?.liabilityIds||{},token}));
   // Live: {error:"error"} means the start date is no longer accepted.
   if(json?.error==='error'){const e=new QuoteServiceError('Your insurance start date is no longer valid. Please choose a new start date.',{retryable:false});e.code='start-date';throw e;}
   if(!json||json.error)throw new QuoteServiceError('Your application could not be submitted. Please try again.');
   // Live sends the application copy email here without waiting for it; failures are not shown.
   client.post('/api/sendFinalPageEmail',buildApplicationRequest(data,quote,{liabilityIds:quoteService?.liabilityIds||{},token})).catch(()=>{});
   return {accepted:true,quotationNumber:quote.quotationNumber};
  },
  async startPayment({quotationNumber}){
   if(!quotationNumber)throw new QuoteServiceError('Missing quotation number.',{retryable:false});
   const token=await client.ensureToken();
   submitForm(apiBase+'/doPayment',{quotationNumber,_token:token});
   return {redirected:true};
  },
  async verifyPayment({quotationNumber='',reference=''}={}){
   // VERIFY: no JSON payment status endpoint exists in the live client. Configure its path with
   // <meta name="ds-payment-status-path" content="/api/..."> once the backend provides it.
   if(!statusPath)throw new IntegrationRequiredError('Payment verification');
   const token=await client.ensureToken();
   const json=await client.post(statusPath,new URLSearchParams({_token:token,quotationNumber,reference}));
   return parsePaymentStatus(json,{expectedQuotation:quotationNumber});
  }
 });
}

/** ?sample=1 only. Nothing is submitted or charged; results are labelled as samples. */
// Simulated checkout (test mode only): scenario('checkout') = ok|fail|start-date.
export function createPreviewPaymentService({delay=450,navigate=url=>{location.href=url;},pick=scenario}={}){
 const wait=()=>new Promise(r=>setTimeout(r,delay));
 return Object.freeze({
  mode:'preview',
  async submitApplication(data,quote){await wait();const outcome=pick('checkout');if(outcome==='fail')throw new QuoteServiceError('Your application could not be submitted. Please try again.');if(outcome==='start-date'){const e=new QuoteServiceError('Your insurance start date is no longer valid. Please choose a new start date.',{retryable:false});e.code='start-date';throw e;}return {accepted:true,sample:true,quotationNumber:quote?.quotationNumber||'SAMPLE-QUOTE'};},
  async startPayment({outcome='paid'}={}){navigate('payment-result.html?sample=1&status='+encodeURIComponent(outcome));return {redirected:true,sample:true};},
  async verifyPayment({status='paid'}={}){
   await wait();
   const s=['paid','pending','failed','cancelled'].includes(status)?status:'unverified';
   return {status:s,sample:true,quotationNumber:'SAMPLE-QUOTE',transactionReference:s==='paid'?'SAMPLE-TXN-0001':'',amount:s==='unverified'?null:1663.20,plan:'Chubb Elite Medical Malpractice Insurance',start:'',end:'',email:'alex@example.com',paidAt:''};
  }
 });
}

export function paymentStatusPathFrom(doc=globalThis.document){
 const value=doc?.querySelector?.('meta[name="ds-payment-status-path"]')?.getAttribute('content')?.trim()||'';
 return /^\/[A-Za-z0-9/_-]+$/.test(value)?value:'';
}

export function createPaymentService({preview=false,apiBase=apiBaseFrom(),client,quoteService,statusPath=paymentStatusPathFrom()}={}){
 if(preview)return createPreviewPaymentService();
 return apiBase?createLivePaymentService({apiBase,client:client||createLiveClient({apiBase}),quoteService,statusPath}):createUnconnectedPaymentService();
}
