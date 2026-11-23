// Renewal and Claims. Mobile verification, policy selection and claim submission use the live
// backend contract in otp-service.js. Without a backend nothing is sent and nothing is confirmed.
// Each step is one focused panel: the step title is the page heading, with one primary action.
import {IntegrationRequiredError} from './api.js';
import {sampleMode,loadQaPanel} from './dev-mode.js';
import {createOtpService,OtpError,otpLimits,otpError,maskMobile,displayMobile,noRecordsMessage,registeredMobile,bookingUrl as bookingUrlForQa} from './otp-service.js';
import {claimGroups,validateClaim,validateAttachments} from './service-model.js';
import {createFormComponents} from './components.js';
import {button,notice} from './ui.js';
import {icon} from './icons.js';
import {reviewRow,reviewGroup,reviewSection} from './insurance-components.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search);
const mode=params.get('flow')==='claims'?'claims':'renewal';
const preview=sampleMode(); // test mode only (dev-mode.js); ?sample=1 alone does nothing
const service=createOtpService({preview});
const support='WhatsApp +60 12-536 0700';

let flow=mode==='claims'?'':'renewal'; // renewal | claims | discussion
let view=mode==='claims'?'choices':'phone';
let data={channel:'sms'},errors={},status='',files=[],busy='';
let challenge=null; // {phone, channel, expiresAt, sends, attempts}
let result=null,record=null,claimStep=0,submitAttempted=false;
const {field,textarea,select,question,errorFor}=createFormComponents(()=>data,()=>errors);
const main=document.querySelector('#main');

// What each claim step needs, in one line.
const claimIntros=[
 'Check the policyholder details. Your name and policy number come from your policy.',
 'Tell us where and when the incident happened.',
 'Details of the patient and of the person making the claim.',
 'How and when you were first told about the claim, and what happened.'
];
const eyebrow=()=>mode==='renewal'?'Renew your policy':flow==='discussion'?'Claims discussion':'Claims';
function caption(){
 const total=mode==='renewal'?3:2;
 if(view==='phone')return `Step 1 of ${total}`;
 if(view==='otp')return `Step 2 of ${total}`;
 if(view==='result'&&mode==='renewal')return 'Step 3 of 3';
 if(view==='claim')return `Step ${claimStep+1} of ${claimGroups.length+1}`;
 if(view==='claim-review')return `Step ${claimGroups.length+1} of ${claimGroups.length+1}`;
 return '';
}
const head=(title,intro='')=>`<p class="service-eyebrow">${esc(eyebrow())}${caption()?`<span aria-hidden="true"> · </span><span>${caption()}</span>`:''}</p><h1 id="service-title" tabindex="-1">${title}</h1>${intro?`<p class="service-intro">${intro}</p>`:''}`;
const actions=(primary,secondary='')=>`<div class="service-actions">${primary}${secondary}</div>`;
const primaryButton=(label,action,busyLabel,opts={})=>button(busy===action?busyLabel:label,{action,disabled:!!busy,loading:busy===action,...opts});
const remaining=()=>challenge?Math.max(0,Math.ceil((challenge.expiresAt-Date.now())/1000)):0;
const clock=n=>`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;
const channelName=c=>c==='whatsapp'?'WhatsApp':'SMS';
const backLink=(action,label='Back')=>`<button type="button" class="link-btn service-back" data-action="${action}">${icon('back',16)}${label}</button>`;

function choicesView(){
 return head('How can we help with your claim?')+`<div class="service-choice-list">
 <button type="button" class="service-choice" data-action="choose-discussion"><span class="service-choice-text"><strong>Talk to our claims team</strong><span>Book An Appointment for an Initial Claims Discussion about an incident.</span></span>${icon('chevron',18)}</button>
 <button type="button" class="service-choice" data-action="choose-claims"><span class="service-choice-text"><strong>Submit claim details</strong><span>For claims you have already discussed with us.</span></span>${icon('chevron',18)}</button></div>`;
}
function phoneView(){
 return head('Enter your mobile number','We’ll send a verification code to the mobile number registered to your policy.')+
 `<div class="service-form">${field('mobile','Mobile number',{type:'tel',full:true,prefix:'+60',inputmode:'tel',autocomplete:'tel-national',maxlength:14,placeholder:'12 345 6789',hint:'You can include the leading 0, for example 012 345 6789.'})}
 <fieldset class="service-channel"><legend>Send the code by</legend><div class="segmented">${['sms','whatsapp'].map(c=>`<label><input type="radio" name="channel" value="${c}" ${data.channel===c?'checked':''}><span>${channelName(c)}</span></label>`).join('')}</div></fieldset></div>`+
 actions(primaryButton('Send code','send','Sending code…'),mode==='claims'?backLink('to-choices'):'');
}
function otpView(){
 const n=remaining(),left=otpLimits.attempts-challenge.attempts,locked=left<=0,limit=challenge.sends>=otpLimits.sends;
 if(locked&&!errors.code)errors.code='Too many incorrect codes. Request a new code to try again.';
 const resend=limit?`<p class="otp-resend">You’ve reached the code limit. Contact us on ${support}.</p>`
  :n&&!locked?`<p class="otp-resend" id="otp-timer">You can request a new code in <span class="otp-clock">${clock(n)}</span></p>`
  :`<p class="otp-resend" id="otp-timer">${n?'':'This code has expired. '}<button type="button" class="link-btn" data-action="resend">Send a new code</button></p>`;
 return head('Enter the verification code',`Sent by ${channelName(challenge.channel)} to <strong>${esc(maskMobile(challenge.phone))}</strong>. <button type="button" class="link-btn" data-action="change-number">Change number</button>`)+
 `<div class="service-form">${field('code','Verification code',{inputmode:'numeric',autocomplete:'one-time-code',maxlength:8,disabled:locked||!n,hint:''})}</div>${resend}`+
 actions(primaryButton('Verify','verify','Verifying…',{disabled:!!busy||locked||!n}));
}
function resultView(){
 if(result.kind==='none')return head('We couldn’t find your policy')+`<p class="service-copy">${esc(noRecordsMessage)}</p>`+actions(`<a class="btn primary" href="./${preview?'?sample=1':''}">Get a quote</a>`);
 if(result.kind==='booking')return head('Book your claims discussion','Your number is verified. Choose a time to speak with our claims team. Booking opens in Microsoft Bookings in a new tab.')+(result.sample?`<p class="service-sample">Sample preview. No booking will be made.</p>`:'')+actions(`<a class="btn primary" href="${esc(result.url)}" target="_blank" rel="noopener">Book An Appointment${icon('external',16)}<span class="sr-only"> (opens in a new tab)</span></a>`);
 if(result.kind==='policies'){const many=result.policies.length>1;
  return head(many?'Choose the policy to renew':'Your policy',many?'We found more than one policy for this number.':'Continue to check your details and renewal premium.')+`<ul class="service-policies">${result.policies.map(p=>`<li><div><span class="service-policy-label">Policy</span><strong>${esc(p.label)}</strong></div><a class="btn ${many?'secondary small':'primary'}" href="${esc(p.sample?'./?sample=1&renewal=1':p.url)}">Renew${many?'<span class="sr-only"> '+esc(p.label)+'</span>':''}</a></li>`).join('')}</ul>`+(result.sample?`<p class="service-sample">Sample preview. Renew opens the application with sample details.</p>`:'');}
 return '';
}
function recordsView(){
 return head('Which policy is this claim for?')+`<fieldset class="service-records ${errors.claimRecord?'has-error':''}" ${errors.claimRecord?'aria-invalid="true" aria-describedby="claimRecord-error"':''}><legend class="sr-only">Policies</legend>${result.records.map(r=>`<label class="option-card"><input type="radio" name="claimRecord" value="${esc(r.key)}" ${data.claimRecord===r.key?'checked':''}><span class="option-card-body"><strong>${esc(r.primary||r.secondary)}</strong>${r.primary&&r.secondary?`<small>${esc(r.secondary)}</small>`:''}</span></label>`).join('')}${errorFor('claimRecord')}</fieldset>`+actions(primaryButton('Continue','select-record','Loading policy…'));
}
function claimFieldMarkup([id,label,type]){
 if(type==='gender')return question(id,label,['Male','Female']);
 if(type==='notification')return select(id,label,['Email','Letter','Verbal','Others'],{full:true});
 if(type==='textarea')return textarea(id,label,{rows:5});
 if(type==='tel')return field(id,label,{type:'tel',prefix:'+60',inputmode:'tel',maxlength:14,full:true});
 return field(id,label,{type:type||'text',full:true,readonly:['claim_policy_number','name_of_insured'].includes(id),max:type==='date'?new Date().toLocaleDateString('en-CA'):''});
}
function claimView(){
 const [title,fields]=claimGroups[claimStep];
 return head(esc(title),claimIntros[claimStep])+`<div class="fields service-fields">${fields.map(claimFieldMarkup).join('')}</div>`+actions(button(claimStep===claimGroups.length-1?'Review claim':'Continue',{action:'claim-next'}),backLink('claim-back'));
}
function claimReviewView(){
 const phone=v=>registeredMobile(v)?displayMobile(registeredMobile(v)):v;
 return head('Review and submit your claim','Check your details and add any documents. Your claim is registered only when you see our confirmation page.')+
 `<div class="review-sections service-review">${claimGroups.map(([title,fields],i)=>reviewSection('claim-'+i,title,'edit-claim-'+i,reviewGroup('',fields.map(([id,label])=>reviewRow(label,id==='claim_phone_number'?phone(data[id]):data[id])).join('')))).join('')}</div>
 <section class="service-upload ${errors.attachments?'has-error':''}" aria-labelledby="upload-title"><h2 id="upload-title">Supporting documents <span class="optional">Optional</span></h2><p class="hint" id="attachments-hint">Claims related documents and Policy Documents. PDF, Word, Excel or image files, up to 6 MB each.</p><label class="upload-drop" for="attachments">${icon('plus',18)}<span>Add files</span></label><input class="sr-only" type="file" id="attachments" aria-describedby="attachments-hint${errors.attachments?' attachments-error':''}" ${errors.attachments?'aria-invalid="true"':''} multiple accept=".pdf,.doc,.docx,.jpeg,.png,.jpg,.bmp,.xls,.xlsx">${files.length?`<ul class="attachment-list">${files.map((f,i)=>`<li>${icon('file',16)}<span>${esc(f.name)}</span><small>${(f.size/1048576).toFixed(1)} MB</small><button type="button" class="link-btn" data-remove="${i}" aria-label="Remove ${esc(f.name)}">Remove</button></li>`).join('')}</ul>`:''}${errorFor('attachments')}</section>`+
 (submitAttempted?notice(`<p>We couldn’t confirm that your claim was received. To avoid a duplicate claim, please contact us on ${support} before you submit again.</p>`,{tone:'error',title:'Claim not confirmed'})+actions('',backLink('claim-back'))
  :actions(primaryButton('Submit claim','submit','Submitting…'),backLink('claim-back')));
}
function sentView(){return head('Sample claim','This is a sample preview. Nothing was sent and no claim was registered.')+actions(`<a class="btn primary" href="services.html?flow=claims&sample=1">Start again</a>`);}

let lastView='';
function render(focus=true){
 const body=view==='choices'?choicesView():view==='phone'?phoneView():view==='otp'?otpView():view==='result'?resultView():view==='records'?recordsView():view==='claim'?claimView():view==='claim-review'?claimReviewView():view==='sent'?sentView():'';
 main.innerHTML=`<div class="service-shell">${preview?'<p class="test-mode-ribbon" role="note">Test mode · Sample data. Verification code 123456. Nothing is sent.</p>':''}
 <section class="service-panel${view==='claim'||view==='claim-review'?' is-wide':''}${view+claimStep!==lastView?' is-entering':''}" aria-labelledby="service-title"><div id="service-status">${status}</div>${body}</section>
 <p class="service-help">Need help? <a href="https://wa.me/60125360700" target="_blank" rel="noopener">WhatsApp +60 12-536 0700<span class="sr-only"> (opens in a new tab)</span></a></p></div>`;
 lastView=view+claimStep;document.title=`${main.querySelector('#service-title')?.textContent||eyebrow()} | ${eyebrow()} | DoctorShield`;
 if(focus)(document.querySelector('[aria-invalid="true"]:not(fieldset)')||document.querySelector('fieldset[aria-invalid="true"] input')||document.querySelector('#service-title'))?.focus({preventScroll:false});
}
function fail(error){
 if(error instanceof IntegrationRequiredError){status=notice(`<p>${esc(error.message)} For help, contact us on ${support}.</p>`,{tone:'error',title:'This service isn’t available yet',live:true});return;}
 if(error instanceof OtpError&&error.code==='mobile'){errors.mobile=error.message;return;}
 status=notice('<p>'+esc(error?.message||'Something went wrong. Please try again.')+'</p>',{tone:'error',live:true});
}
const announce=t=>{const a=document.querySelector('#announcement');if(a)a.textContent=t;};
async function run(action,task){
 if(busy)return;busy=action;render(false);
 try{await task();}catch(e){fail(e);}finally{busy='';render(true);}
}
// Countdown: update the clock only; switch to "Send a new code" when it runs out.
setInterval(()=>{if(view!=='otp'||!challenge||busy)return;const n=remaining();const clockEl=document.querySelector('.otp-clock');if(n&&clockEl)clockEl.textContent=clock(n);else if(!n&&clockEl){render(false);announce('Your code has expired. You can request a new one.');}},1000);

async function sendCode(resend=false){
 const mobileProblem=registeredMobile(data.mobile)?'':(data.mobile?'Enter a valid Malaysian mobile number, for example 012 345 6789.':'Enter your mobile number.');
 if(mobileProblem){errors={mobile:mobileProblem};render(true);return;}
 const sends=resend?challenge.sends:0,channel=resend?challenge.channel:data.channel;
 if(sends>=otpLimits.sends)return;
 await run(resend?'resend':'send',async()=>{
  const r=await service.send({flow,mobile:data.mobile,channel});
  challenge={phone:r.phone,channel:r.channel,expiresAt:Date.now()+r.lifetime*1000,sends:sends+1,attempts:0};
  data.code='';errors={};view='otp';
  announce(`${resend?'A new code has been sent':'Code sent'} by ${channelName(r.channel)}.`);
  if(r.sample)status=`<p class="service-sample">Sample code: 123456</p>`;
 });
}
async function verify(){
 const problem=otpError(data.code);if(problem){errors={code:problem};render(true);return;}
 if(!remaining()){render(true);return;}
 await run('verify',async()=>{
  try{result=await service.verify({flow,code:data.code});}
  catch(e){if(e instanceof OtpError&&e.code==='wrong-otp'){challenge.attempts++;data.code='';const left=otpLimits.attempts-challenge.attempts;errors={code:left>0?`That code is incorrect. You have ${left} attempt${left===1?'':'s'} left.`:'Too many incorrect codes. Request a new code to try again.'};return;}throw e;}
  data.code='';challenge=null;status='';errors={};
  if(result.kind==='claim'){openClaim(result.record);return;}
  view=result.kind==='claim-records'?'records':'result';
 });
}
function openClaim(r){record=r;data={...data,...r.insured,claim_policy_number:r.policyNumber||r.quoteNumber};claimStep=0;files=[];submitAttempted=false;view='claim';}

// Inline validation: clear an error as soon as it is corrected; re-check claim fields on blur.
function recheck(target){
 if(!target.name||!errors[target.name])return;
 const now=view==='claim'?validateClaim(data)[target.name]:view==='phone'&&target.name==='mobile'&&registeredMobile(data.mobile)?'':view==='otp'&&target.name==='code'&&!otpError(data.code)?'':errors[target.name];
 if(now)return;
 delete errors[target.name];
 const group=target.closest('.field,.question,.service-records');group?.classList.remove('has-error');
 group?.querySelectorAll('[aria-invalid]').forEach(el=>el.removeAttribute('aria-invalid'));
 if(group?.matches('.service-records'))group.removeAttribute('aria-invalid');
 document.getElementById(target.name+'-error')?.remove();
}
main.addEventListener('input',e=>{if(e.target.name){data[e.target.name]=e.target.value;if(e.target.name!=='code')recheck(e.target);}});
main.addEventListener('focusout',e=>{if(view==='claim'&&e.target.name){const msg=validateClaim(data)[e.target.name];if(msg&&String(e.target.value||'').trim()){errors[e.target.name]=msg;render(false);}else recheck(e.target);}});
main.addEventListener('change',e=>{
 if(e.target.name&&e.target.type==='radio'){data[e.target.name]=e.target.value;recheck(e.target);}
 if(e.target.id==='attachments'){const next=[...files,...e.target.files];const error=validateAttachments(next);if(error)errors.attachments=error;else{files=next;delete errors.attachments;}render(false);document.querySelector('.upload-drop')?.focus();}
});
main.addEventListener('keydown',e=>{
 if(e.key==='Enter'&&e.target.tagName==='INPUT'&&['phone','otp'].includes(view)&&e.target.type!=='radio'){e.preventDefault();main.querySelector(`[data-action="${view==='phone'?'send':'verify'}"]`)?.click();}
 if((e.key==='Enter'||e.key===' ')&&e.target.matches('.upload-drop')){e.preventDefault();document.querySelector('#attachments')?.click();}
});
window.addEventListener('beforeunload',e=>{if((view==='claim'||view==='claim-review')&&!submitAttempted){e.preventDefault();e.returnValue='';}});
main.addEventListener('click',async e=>{
 const target=e.target.closest('button');if(!target||busy)return;
 if(target.dataset.remove!==undefined){files.splice(Number(target.dataset.remove),1);render(false);document.querySelector('.upload-drop')?.focus();return;}
 const action=target.dataset.action;if(!action)return;
 status='';errors={};
 switch(action){
  case 'choose-discussion':flow='discussion';view='phone';break;
  case 'choose-claims':flow='claims';view='phone';break;
  case 'to-choices':flow='';view='choices';challenge=null;break;
  case 'send':await sendCode();return;
  case 'resend':await sendCode(true);return;
  case 'verify':await verify();return;
  case 'change-number':view='phone';challenge=null;data.code='';break;
  case 'select-record':
   if(!data.claimRecord){errors={claimRecord:'Choose a policy to continue.'};break;}
   await run('select-record',async()=>{openClaim(await service.selectClaimRecord(data.claimRecord));});return;
  case 'claim-back':if(view==='claim-review'){view='claim';claimStep=claimGroups.length-1;}else if(claimStep)claimStep--;else{view=result?.kind==='claim-records'?'records':'phone';}break;
  case 'claim-next':{const all=validateClaim(data);for(const [id] of claimGroups[claimStep][1])if(all[id])errors[id]=all[id];if(!Object.keys(errors).length){if(claimStep===claimGroups.length-1)view='claim-review';else claimStep++;}break;}
  case 'submit':{
   errors=validateClaim(data);const fileError=validateAttachments(files);if(fileError)errors.attachments=fileError;
   if(Object.keys(errors).length){const first=claimGroups.findIndex(([,f])=>f.some(([id])=>errors[id]));if(first>=0){claimStep=first;view='claim';}break;}
   await run('submit',async()=>{
    try{const r=await service.submitClaim({record,details:Object.fromEntries(claimGroups.flatMap(([,f])=>f.map(([id])=>[id,id==='claim_phone_number'?registeredMobile(data[id]):data[id]]))),files});
     if(r.sample){view='sent';return;}
     submitAttempted=true;location.assign(r.confirmationUrl);
    }catch(err){if(!(err instanceof IntegrationRequiredError))submitAttempted=true;throw err;}
   });return;}
  case 'sample-fill':if(preview){data.mobile='012 345 6789';for(const [,fields] of claimGroups)for(const [id,,type] of fields)if(!data[id])data[id]=type==='date'?new Date().toLocaleDateString('en-CA'):type==='email'?'alex@example.com':type==='tel'?'0123456789':type==='gender'?'Male':type==='notification'?'Email':'Sample details';}break;
  default:if(action.startsWith('edit-claim-')){claimStep=Number(action.slice(-1));view='claim';}
 }
 render(true);
});
render(false);

// QA control surface (test mode only). Puts the page into any state the flow can reach.
if(preview){
 const fresh=(extra={})=>({phone:'123456789',channel:'sms',expiresAt:Date.now()+otpLifetimeFor()*1000,sends:1,attempts:0,...extra});
 const otpLifetimeFor=()=>flow==='discussion'?240:180;
 const sampleRecord={quoteNumber:'SAMPLE-Q-1',policyNumber:'SAMPLE-DS-2026-001',insured:{name_of_insured:'Dr Aina Rahman (test)',claim_contact_email:'aina.test@example.com',claim_phone_number:'123456789'}};
 const states={
  choices:()=>{flow='';view='choices';},
  phone:()=>{view='phone';},
  'phone-error':()=>{view='phone';data.mobile='12';errors={mobile:'Enter a valid Malaysian mobile number, for example 012 345 6789.'};},
  sending:()=>{view='phone';data.mobile='012 345 6789';busy='send';},
  otp:()=>{view='otp';challenge=fresh();},
  'otp-invalid':()=>{view='otp';challenge=fresh({attempts:1});errors={code:'That code is incorrect. You have 4 attempts left.'};},
  'otp-expired':()=>{view='otp';challenge=fresh({expiresAt:Date.now()-1000});},
  'otp-locked':()=>{view='otp';challenge=fresh({attempts:otpLimits.attempts});},
  'otp-limit':()=>{view='otp';challenge=fresh({sends:otpLimits.sends,expiresAt:Date.now()-1000});},
  'rate-limited':()=>{view='phone';data.mobile='012 345 6789';status=notice('<p>Too many codes have been requested for this number. Please try again later.</p>',{tone:'error',live:true});},
  unavailable:()=>{view='phone';status=notice(`<p>Verification is temporarily unavailable. Please try again shortly. For help, contact us on ${support}.</p>`,{tone:'error',title:'Service unavailable',live:true});},
  'policy-one':()=>{view='result';result={kind:'policies',sample:true,policies:[{label:'SAMPLE-DS-2026-001 · Dr Aina Rahman',url:'',sample:true}]};},
  'policy-many':()=>{view='result';result={kind:'policies',sample:true,policies:[{label:'SAMPLE-DS-2026-001 · Dr Aina Rahman',url:'',sample:true},{label:'SAMPLE-DS-2025-014 · Dr Aina Rahman',url:'',sample:true}]};},
  'no-policy':()=>{view='result';result={kind:'none',sample:true};},
  booking:()=>{flow='discussion';view='result';result={kind:'booking',url:bookingUrlForQa,sample:true};},
  records:()=>{flow='claims';view='records';result={kind:'claim-records',sample:true,records:[{key:'SAMPLE-Q-1',primary:'SAMPLE-DS-2026-001',secondary:'Dr Aina Rahman'},{key:'SAMPLE-Q-2',primary:'SAMPLE-DS-2025-014',secondary:'Dr Aina Rahman'}]};},
  claim:()=>{flow='claims';openClaim(sampleRecord);},
  'claim-error':()=>{flow='claims';openClaim(sampleRecord);claimStep=1;const all=validateClaim(data);for(const [id] of claimGroups[1][1])if(all[id])errors[id]=all[id];},
  'claim-review':()=>{flow='claims';openClaim(sampleRecord);Object.assign(data,claimFixture());view='claim-review';},
  'claim-not-confirmed':()=>{flow='claims';openClaim(sampleRecord);Object.assign(data,claimFixture());view='claim-review';submitAttempted=true;},
  'claim-sent':()=>{flow='claims';view='sent';}
 };
 const claimFixture=()=>{const t=new Date().toLocaleDateString('en-CA');return {hospital_clinic_location_of_incident:'Test Clinic, Petaling Jaya',cause_of_incident:'Allergic reaction after prescribed medication',injury_details:'Skin rash, resolved',date_of_incident_loss:t,claim_speciality:'General practice',patient_name:'Test Patient A',nationality_of_patient:'Malaysia',gender_of_patient:'Female',claimant_solicitors_lawyers:'Test & Co (synthetic)',claimant_name:'Test Patient A',claimant_relationship_to_patient:'Self',first_notification_received_by:'Email',first_notification_received_on:t,description_of_fact_injuries:'Synthetic test description for QA only.'};};
 window.__dsQA=Object.freeze({
  page:mode,
  states:()=>Object.keys(states).filter(k=>mode==='renewal'?!['choices','booking','records','claim','claim-error','claim-review','claim-not-confirmed','claim-sent'].includes(k):!['policy-one','policy-many'].includes(k)),
  state:()=>({page:mode,flow:flow||'(choose)',view,claimStep:view==='claim'?claimStep+1:'',busy,errors:Object.keys(errors)}),
  show(name){const s=states[name];if(!s)return false;busy='';status='';errors={};if(mode==='claims'&&!flow&&name!=='choices')flow='claims';s();render(true);return true;},
  fill(){data.mobile='012 345 6789';if(view==='otp')data.code='123456';if(view==='claim'||view==='claim-review')Object.assign(data,claimFixture());render(false);},
  reset(){busy='';status='';errors={};challenge=null;result=null;record=null;files=[];submitAttempted=false;data={channel:'sms'};flow=mode==='claims'?'':'renewal';view=mode==='claims'?'choices':'phone';render(true);}
 });
 window.dispatchEvent(new Event('ds:qa-ready'));
}
loadQaPanel();
