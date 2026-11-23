// Renewal and Claims mobile verification (team review #7) and claim submission.
//
// Contract taken from the live client (assets/js/home.min.js, reviewed 23 Nov 2026):
//  renewal     send  /api/renewFormOtpSend        {phoneNumber, selectedType: sms|whatsapp}
//              check /api/formRenewOtpVerify      {user_id, phoneNumber, otpValue}
//  claims      send  /api/claimFormOtpSend        {claim_otp_phoneNumber, selectedType}
//              check /api/claimFormOtpVerify      {phoneNumber, otpValue, user_claim_quote_number, claim_record_check}
//              pick  /api/getSingleRecordInMultiple {user_claim_quote_number}
//  discussion  send  /api/claimFormOtpSend, check /api/initialClaimFormOtpVerify {phoneNumber, otpValue}
//  claim       submit /api/sendClaimsEmail (multipart, claim_to_upload[]) -> {url} of the server confirmation page
// Phone format: the live portal stores mobiles as digits without +60 and without the leading 0
// (application form: customer_phone = 1*value), so lookups send that form. VERIFY with the backend.
// Nothing here reports success unless the backend says so.
import {IntegrationRequiredError} from './api.js';
import {QuoteServiceError,createLiveClient,apiBaseFrom} from './quote-service.js';
import {normaliseMobile,mobileError} from './personal-rules.js';
import {safeServiceLink} from './service-model.js';

/** Code lifetime shown to the customer, from the live countdowns (seconds). VERIFY server expiry. */
export const otpLifetime=Object.freeze({renewal:180,claims:180,discussion:240});
/** Client-side limits. Real rate limiting must be enforced by the server. */
export const otpLimits=Object.freeze({sends:3,attempts:5});
export const bookingUrl='https://outlook.office365.com/book/DoctorShieldClaimsDiscussions@ja-assure.com/?ismsaljsauthenabled=true';
/** Approved live wording when no policy is found for a verified number. */
export const noRecordsMessage='Kindly note we are unable to retrieve records of your previous policy with us. Kindly proceed to fill up your details to complete your purchase. If you need further assistance, please contact query@thedoctorshield.com or Whatsapp us @ +60122930700.';
export const wrongOtpMessage='The OTP you have entered is wrong, Please check.';

export class OtpError extends Error{constructor(message,{code='error',retryable=true}={}){super(message);this.name='OtpError';this.code=code;this.retryable=retryable;}}

/** Same rule as Personal Particulars (the number customers registered with). Returns digits without +60/0. */
export function registeredMobile(value){return mobileError(value)?null:normaliseMobile(value);}
export function displayMobile(digits){const d=String(digits||'');return d?'+60 '+(d.length>=9?d.slice(0,2)+' '+d.slice(2,d.length-4)+' '+d.slice(-4):d):'';}
/** Shows only the last 4 digits. */
export function maskMobile(digits){const d=String(digits||'');return d.length>4?'+60 ••• '+d.slice(-4):displayMobile(d);}
export const otpError=code=>!String(code||'').trim()?'Enter the verification code.':/^\d{4,8}$/.test(String(code).trim())?'':'The code is the 4 to 8 digits in your message.';

// Server messages on send can reveal whether a number is registered; they are replaced by one neutral message.
const notSent='We could not send a code to this number. Check that it is the mobile number you registered with us, or contact us for help.';

function splitClaimRecord(value){const [a='',b='']=String(value||'').split('--');return {primary:a.trim(),secondary:b.trim()};}
function claimInsured(json){
 const d=json?.claim_user_data;
 if(!d||typeof d!=='object')throw new OtpError('Your policy details could not be loaded. Please try again.');
 const text=v=>typeof v==='string'||typeof v==='number'?String(v).trim():'';
 return {quoteNumber:text(json.user_claim_quote_number),policyNumber:text(json.user_claim_quote_policy_number),insured:{name_of_insured:text(d.customer_name),claim_contact_email:text(d.customer_email),claim_phone_number:text(d.customer_phone)}};
}

/** Interprets a renewal verify response. */
export function parseRenewalVerify(json){
 if(json?.count_user_id==1){const url=safeServiceLink(json.user_ids);if(!url)throw new OtpError('Your renewal link could not be opened. Please contact us.',{retryable:false});return {kind:'policies',policies:[{label:'Your policy',url}]};}
 const ids=json?.user_ids;
 if(ids===''||ids===undefined||ids===null){if(json?.error)throw new OtpError(wrongOtpMessage,{code:'wrong-otp'});return {kind:'none'};}
 if(typeof ids==='object'){const policies=Object.entries(ids).map(([label,url])=>({label:String(label),url:safeServiceLink(url)})).filter(p=>p.url);if(!policies.length)throw new OtpError('Your renewal link could not be opened. Please contact us.',{retryable:false});return {kind:'policies',policies};}
 throw new OtpError('We could not verify your mobile number. Please try again.');
}

export function createUnconnectedOtpService(){
 const fail=label=>async()=>{throw new IntegrationRequiredError(label);};
 return Object.freeze({mode:'unconnected',send:fail('Mobile verification'),verify:fail('Mobile verification'),selectClaimRecord:fail('Policy lookup'),submitClaim:fail('Claim submission')});
}

export function createLiveOtpService({apiBase,client=createLiveClient({apiBase})}){
 let context={};
 const call=async(path,fields)=>{const token=await client.ensureToken();const body=new URLSearchParams({_token:token});for(const [k,v] of Object.entries(fields))body.set(k,v==null?'':String(v));return client.post(path,body);};
 return Object.freeze({
  mode:'live',
  async send({flow,mobile,channel}){
   const phone=registeredMobile(mobile);if(!phone)throw new OtpError(mobileError(mobile)||'Enter a valid mobile number.',{code:'mobile'});
   const selectedType=channel==='whatsapp'?'whatsapp':'sms';
   const json=flow==='renewal'?await call('/api/renewFormOtpSend',{phoneNumber:phone,selectedType}):await call('/api/claimFormOtpSend',{claim_otp_phoneNumber:phone,selectedType});
   if(json?.error||json?.user_ids===undefined)throw new OtpError(notSent,{code:'not-sent'});
   context={flow,phone,userId:json.cus_user_id??'',quoteNumber:json.user_claim_quote_number??'',records:json.user_ids,count:Number(json.count_claims_user_ids)};
   return {phone,channel:selectedType,lifetime:otpLifetime[flow]};
  },
  async verify({flow,code}){
   if(!context.phone||context.flow!==flow)throw new OtpError('Request a new code to continue.',{code:'expired'});
   const otpValue=String(code).trim();
   if(flow==='renewal')return parseRenewalVerify(await call('/api/formRenewOtpVerify',{user_id:context.userId,phoneNumber:context.phone,otpValue}));
   if(flow==='discussion'){
    const json=await call('/api/initialClaimFormOtpVerify',{phoneNumber:context.phone,otpValue});
    if(json?.count_user_id==1||(json?.user_ids&&json.user_ids!==''))return {kind:'booking',url:bookingUrl};
    if(json?.error)throw new OtpError(wrongOtpMessage,{code:'wrong-otp'});
    return {kind:'none'};
   }
   const single=context.count===1;
   const json=await call('/api/claimFormOtpVerify',{phoneNumber:context.phone,otpValue,user_claim_quote_number:single?context.quoteNumber:'',claim_record_check:single?'single_record':'multiple_record'});
   if(json?.error==='invalid_otp')throw new OtpError(wrongOtpMessage,{code:'wrong-otp'});
   if(json?.error)throw new OtpError('We could not verify your mobile number. Please try again.');
   if(single)return {kind:'claim',record:claimInsured(json)};
   const records=Object.entries(context.records||{}).map(([key,value])=>({key,...splitClaimRecord(value)})).filter(r=>r.primary||r.secondary);
   return records.length?{kind:'claim-records',records}:{kind:'none'};
  },
  async selectClaimRecord(key){return claimInsured(await call('/api/getSingleRecordInMultiple',{user_claim_quote_number:key}));},
  async submitClaim({record,details,files}){
   const token=await client.ensureToken();
   const form=new FormData();form.append('_token',token);
   for(const [k,v] of Object.entries(details))form.append(k,String(v??''));
   // VERIFY: hidden field name for the selected policy record (live: #jsCustomerClaimQuoteNumber).
   form.append('user_claim_quote_number',record?.quoteNumber||'');
   for(const file of files)form.append('claim_to_upload[]',file,file.name);
   const json=await client.post('/api/sendClaimsEmail',form);
   const url=safeServiceLink(json?.url);
   if(json?.error||!url)throw new OtpError('We could not confirm that your claim was received. Please contact us before submitting again.',{retryable:false});
   return {accepted:true,confirmationUrl:url};
  }
 });
}

/** ?sample=1 only: code 123456, illustrative records, nothing is sent. */
export function createPreviewOtpService({delay=350}={}){
 const wait=()=>new Promise(r=>setTimeout(r,delay));
 const record={quoteNumber:'SAMPLE-Q-1',policyNumber:'SAMPLE-DS-2026-001',insured:{name_of_insured:'Alex Tan',claim_contact_email:'alex@example.com',claim_phone_number:'123456789'}};
 return Object.freeze({
  mode:'preview',
  async send({flow,mobile,channel}){await wait();const phone=registeredMobile(mobile);if(!phone)throw new OtpError(mobileError(mobile),{code:'mobile'});return {phone,channel:channel==='whatsapp'?'whatsapp':'sms',lifetime:otpLifetime[flow],sample:true};},
  async verify({flow,code}){await wait();if(String(code).trim()!=='123456')throw new OtpError(wrongOtpMessage,{code:'wrong-otp'});
   if(flow==='renewal')return {kind:'policies',policies:[{label:'SAMPLE-DS-2026-001 · Alex Tan',url:'',sample:true}],sample:true};
   if(flow==='discussion')return {kind:'booking',url:bookingUrl,sample:true};
   return {kind:'claim-records',records:[{key:'SAMPLE-Q-1',primary:'SAMPLE-DS-2026-001',secondary:'Alex Tan'},{key:'SAMPLE-Q-2',primary:'SAMPLE-DS-2025-014',secondary:'Alex Tan'}],sample:true};},
  async selectClaimRecord(key){await wait();return {...record,quoteNumber:key};},
  async submitClaim(){await wait();return {accepted:true,sample:true,confirmationUrl:''};}
 });
}

export function createOtpService({preview=false,apiBase=apiBaseFrom(),client}={}){
 if(preview)return createPreviewOtpService();
 return apiBase?createLiveOtpService({apiBase,client:client||createLiveClient({apiBase})}):createUnconnectedOtpService();
}
