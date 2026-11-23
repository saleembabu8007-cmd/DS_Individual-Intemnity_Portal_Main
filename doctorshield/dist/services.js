// Renewal and Claims. Mobile verification, policy selection and claim submission use the live
// backend contract in otp-service.js. Without a backend nothing is sent and nothing is confirmed.
import {IntegrationRequiredError} from './api.js';
import {createOtpService,OtpError,otpLimits,otpError,maskMobile,displayMobile,noRecordsMessage,registeredMobile} from './otp-service.js';
import {claimGroups,validateClaim,validateAttachments} from './service-model.js';
import {createFormComponents} from './components.js';
import {button,notice} from './ui.js';
import {icon} from './icons.js';
import {reviewRow,reviewGroup,reviewSection} from './insurance-components.js';

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const params=new URLSearchParams(location.search);
const mode=params.get('flow')==='claims'?'claims':'renewal';
const preview=params.get('sample')==='1';
const service=createOtpService({preview});
const support='WhatsApp +60 12-536 0700';

let flow=mode==='claims'?'':'renewal'; // renewal | claims | discussion
let view=mode==='claims'?'choices':'phone';
let data={},errors={},status='',files=[],busy='';
let challenge=null; // {phone, channel, expiresAt, sends, attempts}
let result=null,record=null,claimStep=0,submitAttempted=false;
const {field,textarea,select,question,errorFor}=createFormComponents(()=>data,()=>errors);
const main=document.querySelector('#main');

const steps=['Mobile number','Code',mode==='renewal'?'Your policy':'Your claim'];
const stepIndex=()=>view==='phone'?0:view==='otp'?1:2;
function progress(){
 if(['choices','claim','claim-review','sent'].includes(view))return '';
 return `<ol class="service-steps" aria-label="Progress">${steps.map((s,i)=>`<li class="${i<stepIndex()?'complete':i===stepIndex()?'current':''}" ${i===stepIndex()?'aria-current="step"':''}><span class="service-step-num" aria-hidden="true">${i<stepIndex()?icon('check',14):i+1}</span><span>${s}</span></li>`).join('')}</ol>`;
}
const heading=(text,intro='')=>`<h2 class="service-heading" id="service-heading" tabindex="-1">${text}</h2>${intro?`<p class="service-intro">${intro}</p>`:''}`;
const actions=(back,forward)=>`<div class="service-actions"><div>${back||''}</div><div class="service-actions-forward">${forward||''}</div></div>`;
const busyButton=(label,action,busyLabel,opts={})=>button(busy===action?busyLabel:label,{action,disabled:!!busy,loading:busy===action,...opts});
const remaining=()=>challenge?Math.max(0,Math.ceil((challenge.expiresAt-Date.now())/1000)):0;
const clock=n=>`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`;
const channelName=c=>c==='whatsapp'?'WhatsApp':'SMS';

function choicesView(){
 return heading('How can we help?','Choose the option that matches where you are with your claim.')+`<div class="service-choice-list">
 <button type="button" class="service-choice" data-action="choose-discussion"><span class="service-choice-icon">${icon('calendar',22)}</span><span class="service-choice-text"><strong>Initial Claims Discussion</strong><span>Book An Appointment with our claims team to talk through an incident.</span></span>${icon('chevron',18)}</button>
 <button type="button" class="service-choice" data-action="choose-claims"><span class="service-choice-icon">${icon('file',22)}</span><span class="service-choice-text"><strong>Claims details</strong><span>If you have already spoken to us, submit the details of your claim.</span></span>${icon('chevron',18)}</button></div>`;
}
function phoneView(){
 const intro=flow==='renewal'?'To find your policy, we will send a verification code to the mobile number you registered with us.':'To find your policy, we will send a verification code to the mobile number you registered with us.';
 return heading('Verify your mobile number',intro)+`<div class="fields service-single">${field('mobile','Registered mobile number',{type:'tel',full:true,prefix:'+60',inputmode:'tel',autocomplete:'tel-national',maxlength:14,placeholder:'12 345 6789',hint:'Malaysian mobile number. You can include or leave out the leading 0, for example 012 345 6789.'})}</div>
 <fieldset class="service-channel"><legend>How should we send your code?</legend>${actions('',busyButton('Send code by SMS','send-sms','Sending…')+busyButton('Send code by WhatsApp','send-whatsapp','Sending…',{variant:'secondary'}))}</fieldset>`+
 (mode==='claims'?`<p class="service-back">${button('Back',{action:'to-choices',variant:'quiet',leading:'back'})}</p>`:'');
}
function otpView(){
 const n=remaining(),left=otpLimits.attempts-challenge.attempts,locked=left<=0;
 return heading('Enter your verification code',`We sent a code by ${channelName(challenge.channel)} to <strong>${esc(maskMobile(challenge.phone))}</strong>.`)+
 `<div class="fields service-single">${field('code','Verification code',{full:true,inputmode:'numeric',autocomplete:'one-time-code',maxlength:8,disabled:locked||!n,hint:'Enter the digits from your message.'})}</div>
 <p class="otp-timer" id="otp-timer">${n?`Code expires in <strong>${clock(n)}</strong>`:'This code has expired. Request a new code.'}</p>
 ${locked?notice('<p>Too many incorrect attempts. Request a new code to try again.</p>',{tone:'error'}):challenge.attempts?`<p class="hint otp-attempts">${left} attempt${left===1?'':'s'} left for this code.</p>`:''}
 ${actions(button('Change number',{action:'change-number',variant:'quiet',leading:'back'}),busyButton('Verify','verify','Verifying…',{disabled:!!busy||locked||!n}))}
 <p class="otp-resend">${challenge.sends>=otpLimits.sends?`Code limit reached. Please try again later or contact us on ${support}.`:`Didn't get it? <button type="button" class="link-btn" data-action="resend" ${n&&!locked?'disabled aria-describedby="otp-timer"':''}>Resend code by ${channelName(challenge.channel)}</button>${n&&!locked?' <span class="hint">(available when the code expires)</span>':''}`}</p>`;
}
function resultView(){
 if(result.kind==='none')return heading('No policy found')+notice('<p>'+esc(noRecordsMessage)+'</p>',{tone:'info'})+actions('',`<a class="btn primary" href="./${preview?'?sample=1':''}">Get a Quote</a>`);
 if(result.kind==='booking')return heading('Mobile number verified','You can now book a time to talk to our claims team.')+`<div class="service-result">${icon('calendar',22)}<div><strong>Initial Claims Discussion</strong><p>Appointments are booked through Microsoft Bookings, which opens in a new tab.</p></div></div>`+actions('',`<a class="btn primary" href="${esc(result.url)}" target="_blank" rel="noopener">Book An Appointment<span class="sr-only"> (opens in a new tab)</span></a>`)+(result.sample?notice('<p>Sample preview. No booking has been made.</p>',{tone:'warning'}):'');
 if(result.kind==='policies')return heading(result.policies.length>1?'Select your policy':'Your policy','Continue to review and renew your policy.')+`<ul class="service-policy-list">${result.policies.map(p=>`<li><span class="service-policy-icon">${icon('shield',20)}</span><strong>${esc(p.label)}</strong><a class="btn primary small" href="${esc(p.sample?'./?sample=1&renewal=1':p.url)}">Continue to renewal</a></li>`).join('')}</ul>`+(result.sample?notice('<p>Sample preview. The renewal opens the quotation form with sample details.</p>',{tone:'warning'}):'');
 if(result.kind==='claim-records')return heading('Select the policy for this claim')+`<fieldset class="service-records"><legend class="sr-only">Policies</legend>${result.records.map(r=>`<label class="option-card"><input type="radio" name="claimRecord" value="${esc(r.key)}" ${data.claimRecord===r.key?'checked':''}><span class="option-card-body"><strong>${esc(r.primary||r.secondary)}</strong>${r.primary&&r.secondary?`<small>${esc(r.secondary)}</small>`:''}</span></label>`).join('')}</fieldset>${errorFor('claimRecord')}`+actions('',busyButton('Continue','select-record','Loading…'));
 return '';
}
function claimFieldMarkup([id,label,type]){
 if(type==='gender')return question(id,label,['Male','Female']);
 if(type==='notification')return select(id,label,['Email','Letter','Verbal','Others'],{full:true});
 if(type==='textarea')return textarea(id,label,{rows:5});
 if(type==='tel')return field(id,label,{type:'tel',prefix:'+60',inputmode:'tel',maxlength:14,full:true});
 return field(id,label,{type:type||'text',full:['description_of_fact_injuries'].includes(id),readonly:['claim_policy_number','name_of_insured'].includes(id),max:type==='date'?new Date().toLocaleDateString('en-CA'):''});
}
function claimProgress(){const cur=view==='claim-review'?claimGroups.length:claimStep;return `<p class="claim-step-caption">Step ${cur+1} of ${claimGroups.length+1}</p><ol class="claim-progress" aria-label="Claim progress">${[...claimGroups.map(g=>g[0]),'Review'].map((label,i)=>{const cur=view==='claim-review'?claimGroups.length:claimStep;return `<li class="${i===cur?'current':i<cur?'complete':''}" ${i===cur?'aria-current="step"':''}><b aria-hidden="true">${i<cur?icon('check',12):i+1}</b><small>${label}</small></li>`;}).join('')}</ol>`;}
function claimView(){
 const [title,fields]=claimGroups[claimStep];
 return claimProgress()+heading(title)+`<div class="fields service-fields">${fields.map(claimFieldMarkup).join('')}</div>`+actions(button('Back',{action:'claim-back',variant:'quiet',leading:'back'}),button(claimStep===claimGroups.length-1?'Review claim':'Continue',{action:'claim-next',trailing:'arrow'}));
}
function claimReviewView(){
 return claimProgress()+heading('Review your claim','Check the details, add your documents and submit.')+`<div class="review-sections">${claimGroups.map(([title,fields],i)=>reviewSection('claim-'+i,title,'edit-claim-'+i,reviewGroup('',fields.map(([id,label])=>reviewRow(label,id==='claim_phone_number'&&registeredMobile(data[id])?displayMobile(registeredMobile(data[id])):data[id])).join('')))).join('')}</div>
 <section class="service-upload"><label class="field-label" for="attachments">Claims related documents and Policy Documents</label><p class="hint" id="attachments-hint">You can add multiple files, Each file should not be more than 6 MB. PDF, Word, Excel or image files.</p><input type="file" id="attachments" aria-describedby="attachments-hint${errors.attachments?' attachments-error':''}" ${errors.attachments?'aria-invalid="true"':''} multiple accept=".pdf,.doc,.docx,.jpeg,.png,.jpg,.bmp,.xls,.xlsx">${files.length?`<ul class="attachment-list">${files.map((f,i)=>`<li>${icon('file',16)}<span>${esc(f.name)}</span><small>${(f.size/1048576).toFixed(1)} MB</small><button type="button" class="link-btn" data-remove="${i}" aria-label="Remove ${esc(f.name)}">Remove</button></li>`).join('')}</ul>`:''}${errorFor('attachments')}</section>`+
 (submitAttempted?notice(`<p>We could not confirm that your claim was received. To avoid a duplicate claim, please contact us on ${support} before submitting again.</p>`,{tone:'error',title:'Claim not confirmed'})+actions(button('Back',{action:'claim-back',variant:'quiet',leading:'back'}),''):actions(button('Back',{action:'claim-back',variant:'quiet',leading:'back'}),busyButton('Submit claim','submit','Submitting…')));
}
function sentView(){return heading('Sample claim preview')+notice('<p>Sample preview. Nothing was sent and no claim has been registered.</p>',{tone:'warning'})+`<a class="btn primary" href="services.html?flow=claims&sample=1">Start again</a>`;}

function render(focus=true){
 const titles={renewal:'Renew your policy',claims:'Claims'};
 const body=view==='choices'?choicesView():view==='phone'?phoneView():view==='otp'?otpView():view==='result'?resultView():view==='claim'?claimView():view==='claim-review'?claimReviewView():view==='sent'?sentView():'';
 const subtitle={renewal:'Verify your registered mobile number to find the policy you want to renew.',claims:'Book a claims discussion or submit the details of a claim.'}[mode];
 main.innerHTML=`<div class="service-shell">${preview?`<details class="review-tools"><summary>Interface review <span>Sample mode</span>${icon('plus',14)}</summary><div class="review-toolbar"><button type="button" data-action="sample-fill">Fill sample details</button><p>Sample journey. Verification code: 123456. Nothing is sent.</p></div></details>`:''}
 <header class="service-header"><h1>${titles[mode]}</h1><p>${subtitle}</p></header>
 <section class="card service-card" aria-labelledby="service-heading"><div class="card-body">${progress()}<div id="service-status">${status}</div>${body}</div></section>
 <p class="form-help">${icon('phone',16)}<span>Need help? Contact us</span><a href="https://wa.me/60125360700" target="_blank" rel="noopener">+60 12-536 0700<span class="sr-only"> (WhatsApp, opens in a new tab)</span></a></p></div>`;
 document.title=`${titles[mode]} | Individual Indemnity | DoctorShield`;
 if(focus)(document.querySelector('.has-error input,.has-error select,.has-error textarea,[aria-invalid="true"]')||document.querySelector('#service-heading'))?.focus({preventScroll:false});
}
function fail(error){
 if(error instanceof IntegrationRequiredError){status=notice(`<p>${esc(error.message)} For help, contact us on ${support}.</p>`,{tone:'error',title:'This service is not available yet',live:true});return;}
 if(error instanceof OtpError&&error.code==='mobile'){errors.mobile=error.message;return;}
 status=notice('<p>'+esc(error?.message||'Something went wrong. Please try again.')+'</p>',{tone:'error',live:true});
}
async function run(action,task){
 if(busy)return;busy=action;render(false);
 try{await task();}catch(e){fail(e);}finally{busy='';render(true);}
}
// Countdown: update text only; announce expiry once.
setInterval(()=>{if(view!=='otp'||!challenge)return;const el=document.querySelector('#otp-timer');if(!el)return;const n=remaining();if(n){el.innerHTML=`Code expires in <strong>${clock(n)}</strong>`;}else if(!el.dataset.expired){render(false);const t=document.querySelector('#otp-timer');if(t)t.dataset.expired='1';document.querySelector('#announcement').textContent='Your verification code has expired. Request a new code.';}},1000);

async function sendCode(channel,resend=false){
 const mobileProblem=registeredMobile(data.mobile)?'':(data.mobile?'Enter a valid Malaysian mobile number, for example 012 345 6789.':'Enter your registered mobile number.');
 if(mobileProblem){errors={mobile:mobileProblem};render(true);return;}
 const sends=resend?challenge.sends:0;
 if(sends>=otpLimits.sends){status=notice(`<p>Code limit reached. Please try again later or contact us on ${support}.</p>`,{tone:'error',live:true});render(true);return;}
 await run(resend?'resend':'send-'+channel,async()=>{
  const r=await service.send({flow,mobile:data.mobile,channel});
  challenge={phone:r.phone,channel:r.channel,expiresAt:Date.now()+r.lifetime*1000,sends:sends+1,attempts:0};
  data.code='';view='otp';
  status=notice(`<p>${resend?'A new code has been sent':'Code sent'} by ${channelName(r.channel)}.${r.sample?' Sample code: 123456.':''}</p>`,{tone:'success',live:true});
 });
}
async function verify(){
 const problem=otpError(data.code);if(problem){errors={code:problem};render(true);return;}
 if(!remaining()){status=notice('<p>This code has expired. Request a new code.</p>',{tone:'error',live:true});render(true);return;}
 await run('verify',async()=>{
  try{result=await service.verify({flow,code:data.code});}
  catch(e){if(e instanceof OtpError&&e.code==='wrong-otp'){challenge.attempts++;data.code='';errors={code:e.message};return;}throw e;}
  data.code='';challenge=null;status='';
  if(result.kind==='claim'){openClaim(result.record);return;}
  view='result';
 });
}
function openClaim(r){record=r;data={...data,...r.insured,claim_policy_number:r.policyNumber||r.quoteNumber};claimStep=0;files=[];submitAttempted=false;view='claim';}

main.addEventListener('input',e=>{if(e.target.name){data[e.target.name]=e.target.value;if(errors[e.target.name]&&e.target.name!=='code'){delete errors[e.target.name];}}});
main.addEventListener('change',e=>{
 if(e.target.name&&e.target.type==='radio'){data[e.target.name]=e.target.value;if(errors[e.target.name]){delete errors[e.target.name];render(false);}}
 if(e.target.id==='attachments'){const next=[...files,...e.target.files];const error=validateAttachments(next);if(error)errors.attachments=error;else{files=next;delete errors.attachments;}render(false);document.querySelector('#attachments')?.focus();}
});
main.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.tagName==='INPUT'&&['phone','otp'].includes(view)){e.preventDefault();main.querySelector(`[data-action="${view==='phone'?'send-sms':'verify'}"]`)?.click();}});
window.addEventListener('beforeunload',e=>{if((view==='claim'||view==='claim-review')&&!submitAttempted){e.preventDefault();e.returnValue='';}});
main.addEventListener('click',async e=>{
 const target=e.target.closest('button');if(!target||busy)return;
 if(target.dataset.remove!==undefined){files.splice(Number(target.dataset.remove),1);render(false);document.querySelector('#attachments')?.focus();return;}
 const action=target.dataset.action;if(!action)return;
 if(!['resend'].includes(action))status='';
 errors={};
 switch(action){
  case 'choose-discussion':flow='discussion';view='phone';break;
  case 'choose-claims':flow='claims';view='phone';break;
  case 'to-choices':flow='';view='choices';challenge=null;break;
  case 'send-sms':await sendCode('sms');return;
  case 'send-whatsapp':await sendCode('whatsapp');return;
  case 'resend':await sendCode(challenge.channel,true);return;
  case 'verify':await verify();return;
  case 'change-number':view='phone';challenge=null;data.code='';break;
  case 'select-record':
   if(!data.claimRecord){errors={claimRecord:'Select a policy.'};break;}
   await run('select-record',async()=>{openClaim(await service.selectClaimRecord(data.claimRecord));});return;
  case 'claim-back':if(view==='claim-review'){view='claim';claimStep=claimGroups.length-1;}else if(claimStep)claimStep--;else{view='phone';result=null;}break;
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
