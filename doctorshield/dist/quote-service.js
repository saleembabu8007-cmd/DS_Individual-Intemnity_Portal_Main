// Quotation service boundary: limits, promo validation, premium calculation, quotation email.
//
// Three implementations share one interface:
//  - unconnected (default): every call throws IntegrationRequiredError. No price is ever invented.
//  - live: the existing DoctorShield backend (my-individualindemnity.doctorshield.com). Enabled only
//    when <meta name="ds-api-base" content="https://..."> is set and that origin accepts this site
//    (same origin or CORS with credentials). Contract taken from the live client
//    (assets/js/home.min.js, reviewed 23 Nov 2026); items marked VERIFY need backend confirmation.
//  - preview (?sample=1 only): illustrative sample values, always flagged sample:true.
import {IntegrationRequiredError} from './api.js';
import {configuration} from './catalog.js';
import {apiDate,policyEndDate,isValidIsoDate} from './coverage-rules.js';
import {sampleQuote} from './sample-quote.js';

export class QuoteServiceError extends Error{constructor(message,{retryable=true}={}){super(message);this.name='QuoteServiceError';this.retryable=retryable;}}

/** API base from <meta name="ds-api-base">. Only https origins or '/' (same origin) are accepted. */
export function apiBaseFrom(doc=globalThis.document){
 const value=doc?.querySelector?.('meta[name="ds-api-base"]')?.getAttribute('content')?.trim()||'';
 if(value==='/')return globalThis.location?.origin||'';
 try{const url=new URL(value);return url.protocol==='https:'?url.origin+url.pathname.replace(/\/$/,''):'';}catch{return '';}
}

/** "RM 1,888.93" | "1,888.93" | 1888.93 -> 1888.93; anything else -> null. */
export function parseAmount(value){
 if(typeof value==='number')return Number.isFinite(value)&&value>=0?value:null;
 if(typeof value!=='string')return null;
 const cleaned=value.replace(/RM|MYR|,|\s/gi,'');
 if(!/^\d+(\.\d+)?$/.test(cleaned))return null;
 return Number(cleaned);
}
const fromApiDate=value=>{const m=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(value||''));return m?`${m[3]}-${m[2]}-${m[1]}`:'';};
const yesNo=v=>v==='Yes'?'1':v==='No'?'0':'';

/** Pricing inputs only. A quote is stale whenever this key changes. */
export function pricingKey(data){
 return JSON.stringify([data.classification,data.liability,data.start,(data.promo||'').trim().toUpperCase(),data.allocations,
  data.clinic,data.ownership,data.locum,data.picAny,data.picOther,!!data.clinicCover,!!data.picCover,data.clinicCover?data.clinicLiability:'']);
}

/** Form body for /api/calculatePremium and /api/sendIndicativeEmail (live field names). */
export function buildQuoteRequest(data,{liabilityIds={},token=''}={}){
 const config=configuration(data);
 const p=new URLSearchParams();
 if(token)p.set('_token',token);
 p.set('classification_id',String(config?.id??''));
 p.set('liability_id',String(liabilityIds[data.liability]??''));
 p.set('insurance_start_date',apiDate(data.start));
 p.set('insurance_end_date',apiDate(policyEndDate(data.start)));
 p.set('customer_email',String(data.email||'').trim());
 p.set('promo_code',String(data.promo||'').trim());
 p.set('terms_and_conditions',data.consent?'1':'0');
 // VERIFY: live posts $('.specialization_field').serializeArray(); field names are generated server-side.
 p.set('specializations',JSON.stringify(Object.entries(data.allocations||{}).filter(([,v])=>Number(v)>0).map(([i,v])=>({name:config?.specialisations?.[i]??i,value:String(v)}))));
 // VERIFY: yes/no encoding and clinic_type values.
 p.set('do_you_own_clinic_status_value',yesNo(data.clinic));
 p.set('clinic_type_value',data.ownership||'');
 p.set('employee_locum_status_value',yesNo(data.locum));
 p.set('are_you_pic_of_any_clinic_status_value',yesNo(data.picAny));
 p.set('pic_of_own_clinic_or_another_clinic_status_value',yesNo(data.picOther));
 p.set('medical_establishment_package_value',data.clinicCover?'1':'0');
 p.set('pic_contend_coverage_status',data.picCover?'1':'0');
 p.set('clinic_liability_id',data.clinicCover?String(liabilityIds[data.clinicLiability]??''):'');
 p.set('reinstatement_package_value','1'); // complimentary Automatic Reinstatement
 p.set('emailMeOrOnline',data.intent==='Buy now'?'online':'email');
 return p;
}

const safeHttps=value=>{try{const u=new URL(value);return u.protocol==='https:'?u.href:'';}catch{return '';}};
const decodeBase64Json=value=>{const binary=atob(value);const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));return JSON.parse(new TextDecoder().decode(bytes));};

/** Normalised quote from a /api/calculatePremium response. Throws when no usable premium. */
export function parseQuoteResponse(json,{clinicCover=false}={}){
 if(!json||json.error)throw new QuoteServiceError(typeof json?.message==='string'&&json.message?json.message:'We could not calculate your premium. Please try again.');
 let payload=json.data;
 if(typeof payload==='string'){try{payload=decodeBase64Json(payload);}catch{throw new QuoteServiceError('The quotation service returned an unreadable response.');}}
 const premium=payload?.premium;
 const review=premium?.calculated?.reviewPage||{};
 // VERIFY: the live client switches to the medical_establishment block when the clinic package is selected.
 const block=(clinicCover&&review.medical_establishment)||review.individual||{};
 const quote={
  sample:false,
  total:parseAmount(block.without_discount_premium),
  discount:parseAmount(block.discount)??0,
  net:parseAmount(block.total_premium_after_discount),
  sst:parseAmount(block.tax_amount),
  stampDuty:parseAmount(block.stamp_duty),
  final:parseAmount(block.total_premium),
  oneYear:parseAmount(premium?.oneyearpremium),
  discountPercentage:parseAmount(premium?.calculated?.discount_percentage)??0,
  start:fromApiDate(premium?.insurance_start_date),
  end:fromApiDate(premium?.insurance_end_date),
  quotationNumber:typeof premium?.quotation==='string'||typeof premium?.quotation==='number'?String(premium.quotation):'',
  policyWordingUrl:safeHttps(json.policy_wording_pdf),
  items:[
   {label:'Individual indemnity',amount:parseAmount(block.individual_original_premium??block.individual_premium)},
   {label:'Clinic Medical Malpractice Insurance',amount:clinicCover?parseAmount(review.medical_establishment?.clinic_package_premium):null},
   {label:'PIC coverage',amount:parseAmount(review.medical_establishment?.individual_pic_premium)}
  ].filter(item=>item.amount!==null&&item.amount>0),
  raw:premium
 };
 if(quote.final===null)throw new QuoteServiceError('Your premium is not available for these details. Please contact us.',{retryable:false});
 return quote;
}

/** Email acceptance must be explicit; a silent 200 is not proof that an email was sent. */
export function emailAccepted(json){
 if(!json||json.error)return false;
 return json.success===true||json.status===true||['success','sent','queued','accepted'].includes(String(json.status).toLowerCase());
}

export function createUnconnectedQuoteService(){
 const fail=label=>async()=>{throw new IntegrationRequiredError(label);};
 return Object.freeze({mode:'unconnected',lookupTin:fail('Tax identification lookup'),getLiabilities:fail('Limit of liability service'),validatePromo:fail('Promo code validation'),calculate:fail('Quote calculation'),sendQuotationEmail:fail('Quotation email')});
}

export function createLiveQuoteService({apiBase,fetchImpl=globalThis.fetch?.bind(globalThis),timeout=20000}){
 let token='';const liabilityIds={};
 async function post(path,body){
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
  try{
   const response=await fetchImpl(apiBase+path,{method:'POST',credentials:'include',signal:controller.signal,headers:{'Accept':'application/json','Content-Type':'application/x-www-form-urlencoded;charset=UTF-8',...(token?{'X-CSRF-TOKEN':token}:{})},body});
   if(!response.ok)throw new QuoteServiceError(response.status>=500?'The quotation service is temporarily unavailable. Please try again.':'The quotation request was not accepted. Please check your details.',{retryable:response.status>=500||response.status===419});
   try{return await response.json();}catch{throw new QuoteServiceError('The quotation service returned an unreadable response.');}
  }catch(error){
   if(error instanceof QuoteServiceError)throw error;
   throw new QuoteServiceError(error?.name==='AbortError'?'The quotation service took too long to respond. Please try again.':'We could not reach the quotation service. Check your connection and try again.');
  }finally{clearTimeout(timer);}
 }
 async function ensureToken(){if(!token){const json=await post('/api/getCSRFToken',new URLSearchParams());if(typeof json?.token!=='string'||!json.token)throw new QuoteServiceError('Secure session could not be started. Please try again.');token=json.token;}return token;}
 async function getLiabilities(data){
   await ensureToken();
   const body=new URLSearchParams({_token:token,classification_id:String(configuration(data)?.id??'')});
   const json=await post('/api/getLiabilities',body);
   const entries=Object.entries(json?.liabilities||{}).filter(([id,label])=>/^\d+$/.test(id)&&typeof label==='string'&&label.trim());
   if(!entries.length)throw new QuoteServiceError('Limits of liability are not available for this classification.');
   for(const [id,label] of entries)liabilityIds[label.trim()]=id;
   return entries.map(([,label])=>label.trim());
 }
 return Object.freeze({
  mode:'live',
  getLiabilities,
  /** Live: TIN is looked up by the server from the NRIC (/api/getTaxTinCheck {nric_value} -> {result}). */
  async lookupTin(nric){
   await ensureToken();
   const json=await post('/api/getTaxTinCheck',new URLSearchParams({_token:token,nric_value:String(nric||'')}));
   const tin=typeof json?.result==='string'?json.result.trim():'';
   return {tin:/^[A-Za-z0-9 -]{2,30}$/.test(tin)?tin:''};
  },
  async validatePromo(data){
   const code=String(data.promo||'').trim();if(!code)return {valid:true,code:''};
   await ensureToken();
   const body=new URLSearchParams({_token:token,promo_code:code,classification_id:String(configuration(data)?.id??'')});
   const json=await post('/api/validatePromoCode',body);
   if(json?.promo_code)return {valid:true,code};
   if(json?.error)return {valid:false,code};
   throw new QuoteServiceError('Promo code could not be checked. Please try again.');
  },
  async calculate(data){
   await ensureToken();
   if(!liabilityIds[data.liability])await getLiabilities(data);
   const json=await post('/api/calculatePremium',buildQuoteRequest(data,{liabilityIds,token}));
   const quote=parseQuoteResponse(json,{clinicCover:!!data.clinicCover});
   if(quote.start&&quote.start!==data.start)throw new QuoteServiceError('The quoted start date does not match your selection. Please try again.');
   return quote;
  },
  async sendQuotationEmail(data,quote){
   if(!quote||quote.sample)throw new QuoteServiceError('Calculate your premium before requesting the quotation email.',{retryable:false});
   await ensureToken();
   const body=buildQuoteRequest({...data,intent:'Email me the Indicative Quotation and Policy Wording'},{liabilityIds,token});
   body.set('premium',JSON.stringify(quote.raw));
   if(quote.quotationNumber)body.set('quotationNumber',quote.quotationNumber);
   const json=await post('/api/sendIndicativeEmail',body);
   if(!emailAccepted(json))throw new QuoteServiceError('We could not confirm that your quotation email was sent. Please try again.');
   return {accepted:true,sample:false,to:String(data.email).trim(),reference:quote.quotationNumber};
  }
 });
}

/** ?sample=1 only. Values are illustrative and never reach checkout. */
export function createPreviewQuoteService({delay=450}={}){
 const wait=()=>new Promise(r=>setTimeout(r,delay));
 return Object.freeze({
  mode:'preview',
  async lookupTin(){await wait();return {tin:'',sample:true};},
  async getLiabilities(data){return configuration(data)?.limits||[];},
  async validatePromo(data){await wait();return {valid:true,code:String(data.promo||'').trim(),unchecked:!!String(data.promo||'').trim()};},
  async calculate(data){
   await wait();
   if(!isValidIsoDate(data.start))throw new QuoteServiceError('Enter the insurance start date.',{retryable:false});
   const q=sampleQuote(data);
   return {...q,start:data.start,end:policyEndDate(data.start),quotationNumber:'SAMPLE-QUOTE',policyWordingUrl:'',discountPercentage:0,raw:null};
  },
  async sendQuotationEmail(data){await wait();return {accepted:true,sample:true,to:String(data.email).trim(),reference:'SAMPLE-QUOTE'};}
 });
}

export function createQuoteService({preview=false,apiBase=apiBaseFrom(),fetchImpl}={}){
 if(preview)return createPreviewQuoteService();
 return apiBase?createLiveQuoteService({apiBase,fetchImpl}):createUnconnectedQuoteService();
}
