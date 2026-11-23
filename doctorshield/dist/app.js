import {allocationTotal,distributeAllocations,validAllocations} from './allocation-model.js';
import {sampleQuote} from './sample-quote.js';
import {premiumSummary,premiumBreakdown,summaryBreakdown,money} from './premium-components.js';
import {reviewRow,reviewGroup,reviewSection,coverageContext,coverageOption,quotationAddon,actionBar as baseActionBar} from './insurance-components.js';
import {button, notice, sectionHeading} from './ui.js';
import {createFormComponents} from './components.js';
import {icon} from './icons.js';
import {readDraft,saveDraft,clearDraft} from './draft.js';
import {classifications,specialisations,observedGpLimits,individualQuestions,organisationQuestions,supplementary,importantNoticesHtml,declarationAuthorizationHtml,states} from './content.js';
import {maskId,patientsLabel,formatIncome,parseIncome,isMalaysianNric,normaliseId,normaliseMobile} from './personal-rules.js';
import {insuranceApi,IntegrationRequiredError} from './api.js';
import {startDateBounds,policyEndDate,isFullYearPeriod,displayDate} from './coverage-rules.js';
import {sampleMode,loadQaPanel} from './dev-mode.js';
import {createQuoteService,createLiveClient,apiBaseFrom,pricingKey,samePayable} from './quote-service.js';
import {createPaymentService,paymentMethods,paymentMethodError,normalisePaymentMethod,readAttempt,saveAttempt} from './payment-service.js';
import {configuration} from './catalog.js';
import {clinicRoute,resetClinicDependents} from './clinic-rules.js';
import {validateCoverage as validateCoverageRules,validateQuotation,validatePersonal,validateDeclarations,declarationDetailFields} from './validation.js';

const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Sample journeys need test mode (ds-qa flag, see dev-mode.js); ?sample=1 alone does nothing.
const samplePricing=sampleMode();
const review=samplePricing;
const liveBase=samplePricing?'':apiBaseFrom(),liveClient=liveBase?createLiveClient({apiBase:liveBase}):undefined;
const quoteService=createQuoteService({preview:samplePricing,client:liveClient});
const paymentService=createPaymentService({preview:samplePricing,client:liveClient,quoteService});
let quoteState={status:'idle',quote:null,key:'',message:'',retryable:true},liveLimits={},emailState={status:'idle'},quoteSeq=0,quoteTimer;
const currentQuote=()=>quoteState.status==='ready'&&quoteState.key===pricingKey(data)?quoteState.quote:null;
const validateCoverage=d=>validateCoverageRules(d,new Date(),{limits:liveLimits[d.classification]});
const limitsFor=()=>liveLimits[data.classification]||configuration(data)?.limits||[];
const data={classification:'',liability:'',start:'',email:'',promo:'',consent:false,allocations:{},clinic:'',ownership:'',locum:'',picAny:'',picOther:'',clinicLiability:'',nationality:'',otherNationality:'',clinicName:'',branchAgreement:false,pic:'',clinicCover:false,picCover:false,fullName:'',dob:'',nric:'',tin:'',practice:'',mobile:'',declaration:false,branches:[],answers:{},intent:'Buy now',payment:'',riskDetails:'',orgDetails:'',orgCriminalDetails:'',q0Details:'',q1Details:'',q2Details:'',q3Details:'',patients:'',revenue:''};
let stage=0, errors={}, maxStage=0, activeState=null;
let draftStorage;try{draftStorage=sessionStorage;}catch{}
if(!review&&!samplePricing){const draft=readDraft(draftStorage,data);if(draft){Object.assign(data,draft.data);stage=draft.stage;maxStage=draft.maxStage;}}
data.payment=normalisePaymentMethod(data.payment);
const persist=()=>{if(!review&&!samplePricing){const saved=saveDraft(draftStorage,data,stage,maxStage);const status=document.querySelector('#draft-status');if(status){status.textContent=saved?'Saved in this tab':'Progress could not be saved. Keep this page open.';status.dataset.state=saved?'saved':'error';}}};
const actionBar=(back='',forward='')=>!activeState?`<div class="premium-action-bar ${stage===0?'coverage-action-bar':''}"><div class="premium-action-inner"><div class="premium-action-content">${stage>0?premiumSummary(currentQuote()):''}<div class="premium-navigation">${back}${forward}</div></div></div></div>`:baseActionBar(back,forward);
const stages=['Coverage','Quotation','Personal Particulars','Declaration','Summary'];
const next=(label='Next',action='next')=>button(label,{action,trailing:'arrow'});
const back=()=>button('Back',{action:'back',variant:'quiet',leading:'back'});
const head=sectionHeading;
const {field,textarea,select,question,check,errorFor,attrs}=createFormComponents(()=>data,()=>errors);
const isAnswerName=name=>name.startsWith('q')&&!/Details$/.test(name);
const pidm=()=>`<div class="notice legal-notice">${icon('info',18)}<p>The benefit(s) payable under eligible certificate/ policy/ product is(are) protected by PIDM up to limits. Please refer to <a href="https://www.pidm.gov.my/pidm2022/media/downloads/Takaful-And-Insurance-Benefits-Protection-System-Brochure.pdf" target="_blank" rel="noopener">PIDM’s TIPS Brochure</a> or contact <a href="https://www.chubb.com/my-en/contact-us.html" target="_blank" rel="noopener">Chubb Insurance Malaysia Berhad</a> or PIDM (visit <a href="https://www.pidm.gov.my/en" target="_blank" rel="noopener">www.pidm.gov.my</a>).</p></div>`;
const dateText=s=>s?displayDate(s):'—';
const endDate=()=>policyEndDate(data.start);
function summary(){return `<section class="card side-section"><div class="side-title"><h3>Your coverage</h3>${stage?'<button type="button" class="link-btn" data-action="edit-coverage">Edit</button>':''}</div><dl class="summary-list"><div><dt>Classification</dt><dd id="summary-classification">${esc(data.classification)||'—'}</dd></div><div><dt>Limit Of Liability</dt><dd id="summary-liability">${esc(data.liability)||'—'}</dd></div><div><dt>Coverage period</dt><dd id="summary-period">${data.start?`${dateText(data.start)} – ${dateText(endDate())}`:'—'}</dd></div></dl></section>`;}
function sidebar(){return `<aside class="visual-side" aria-label="Application progress"><div class="rail-navigation"><div class="rail-product-header"><p class="rail-product"><small>Your plan</small>Chubb Elite Medical Malpractice Insurance</p></div><nav id="stepper" class="stepper" aria-label="Application steps"></nav></div><div class="rail-guide"><h3>Not sure where to start?</h3><p>Our step-by-step guide explains each part of the application.</p><a class="rail-guide-link" href="https://my-individualindemnity.doctorshield.com/assets/DoctorShield_User_Guide.pdf" target="_blank" rel="noopener">Purchase guide (PDF) ${icon('external',14)}<span class="sr-only"> (opens in a new tab)</span></a></div></aside>`;}
function classificationHint(){const id=configuration(data)?.id;return [17,18].includes(id)?'Professionals under this classification are restricted to 20 hours of work per week':id===13?'All dental procedures categorized under general dentistry are included. You may classify yourself as a General Dentist if you are permitted to perform these procedures through recognized special training or courses.':id===20?'Non-invasive elective topical enhancement of patient’s external appearance, including injections.”':'';}
function coverage(){
 const bounds=startDateBounds(),end=endDate();
 return `<div class="card"><div class="card-body">
<section class="flow-card" aria-label="Your practice">${head('Your practice','shield')}<div class="fields">${select('classification','Classification',classifications,{full:true,hint:classificationHint()})}</div><div id="allocation-slot">${allocationTrigger()}</div><div class="fields field-gap">${select('liability','Limit Of Liability',limitsFor(),{full:true,hint:data.classification||errors.liability?'':'Select your classification first.'})}</div></section>
<section class="flow-card" aria-label="Coverage period">${head('Coverage period','calendar')}<div class="fields">${field('start','Insurance Start Date',{type:'date',min:bounds.min,max:bounds.max,hint:'Choose a date from today to '+displayDate(bounds.max)+'.'})}<div class="field calculated-field"><span class="field-label" id="end-label">Insurance End Date</span><output id="end" for="start" aria-labelledby="end-label" aria-describedby="end-hint">${end?esc(displayDate(end)):'—'}</output><p class="hint" id="end-hint">Policy end date is always 31st December.</p></div></div></section>
<section class="flow-card" aria-label="Contact details">${head('Contact details','mail')}<div class="fields">${field('email','Email Address',{type:'email',full:true,hint:'We will send your quotation and policy documents to this address.'})}</div><details class="optional-field" ${data.promo||errors.promo?'open':''}><summary>Have a promo code? <span class="optional">Optional</span></summary><div class="fields">${field('promo','Promo Code',{full:true,hint:'Your promo code is checked when you continue.'})}</div></details></section>
<div class="consent-section">${check('consent','I have read, understood and agree to the <a href="https://my.doctorshield.com/terms-of-use" target="_blank" rel="noopener">terms and conditions,</a> <a href="https://my.doctorshield.com/privacy-policy" target="_blank" rel="noopener">privacy policy</a> and I meet all local regulation to practice my profession.')}${pidm()}</div><div id="form-status"></div></div>${actionBar('',next('Continue','calculate'))}</div>`;}
function allocationTrigger(){
 if(!configuration(data)?.specialist)return '';
 const selected=Object.entries(data.allocations).filter(([,v])=>v>0),names=configuration(data)?.specialisations||[];
 return `<section class="allocation-summary"><div class="allocation-trigger"><div><strong>Specialisations</strong><span>${selected.length} selected · ${total(data.allocations)}% allocated</span></div><button type="button" class="btn secondary small" data-action="allocations">${icon('edit',14)}${selected.length?'Edit':'Add'} details</button></div>${selected.length?'<dl class="allocation-facts">'+selected.map(([i,v])=>'<div><dt>'+esc(names[i])+'</dt><dd>'+v+'%</dd></div>').join('')+'</dl>':''}${errorFor('allocations')}</section>`;
}
const addonLabels={clinic:'Clinic Medical Malpractice Insurance',pic:'PIC coverage'};
function addonPrice(type){const fromQuote=currentQuote()?.items?.find(item=>item.label===addonLabels[type])?.amount;if(typeof fromQuote==='number')return fromQuote;return samplePricing?sampleQuote({clinicCover:true,picCover:true}).items.find(item=>item.label===addonLabels[type])?.amount:null;}
function premiumPanel(){
 const q=currentQuote(),full=isFullYearPeriod(data.start);
 const period=data.start?esc(displayDate(data.start))+' – '+esc(displayDate(endDate())):'—';
 if(q)return `<section class="premium-panel" id="premium-panel" aria-labelledby="premium-title" aria-live="polite"><div class="premium-panel-head"><div><h2 id="premium-title">${full?'Your premium':'Your pro-rated premium'}</h2><p class="hint">Inclusive of SST &amp; Stamp Duty</p></div><div class="premium-panel-amount">${q.sample?'<span class="sample-badge">Sample · not insurer pricing</span>':''}<strong>${money(q.final)}</strong></div></div><dl class="premium-facts"><div><dt>${full?'This premium is for the period':'This premium is pro-rated for the period'}</dt><dd>${period}</dd></div>${full?'':`<div class="premium-reference"><dt>Standard premium for a 12 month period</dt><dd>${typeof q.oneYear==='number'?money(q.oneYear):'Not provided'}<small>For your information</small></dd></div>`}${q.discount>0?`<div><dt>Discount${data.promo?' · '+esc(data.promo.trim().toUpperCase()):''}</dt><dd>− ${money(q.discount)}</dd></div>`:''}</dl><button type="button" class="link-btn premium-panel-breakdown" data-action="premium-breakdown" aria-haspopup="dialog">View premium breakdown</button></section>`;
 if(quoteState.status==='loading'||quoteState.status==='idle')return `<section class="premium-panel is-loading" id="premium-panel" aria-live="polite" aria-busy="true"><div class="premium-panel-head"><div><h2>Calculating your premium…</h2><p class="hint">Coverage period ${period}</p></div><span class="premium-skeleton" aria-hidden="true"></span></div></section>`;
 if(quoteState.status==='error')return `<section class="premium-panel" id="premium-panel" aria-live="polite">${notice('<p>'+esc(quoteState.message)+'</p>'+(quoteState.retryable?'<button type="button" class="btn secondary small" data-action="retry-quote">Try again</button>':''),{tone:'error',title:'Premium not available'})}</section>`;
 return `<section class="premium-panel" id="premium-panel" aria-labelledby="premium-title" aria-live="polite"><div class="premium-panel-head"><div><h2 id="premium-title">Your premium</h2><p class="hint">Inclusive of SST &amp; Stamp Duty</p></div><div class="premium-panel-amount"><strong class="is-pending">Not yet calculated</strong></div></div><dl class="premium-facts"><div><dt>Coverage period</dt><dd>${period}</dd></div></dl><p class="premium-panel-note">${icon('info',16)}<span>Your premium and the standard 12-month premium will appear here once our pricing service is connected.</span></p></section>`;
}
function proceedOptions(){
 const q=currentQuote();
 const option=(value,description)=>`<label class="option-card"><input type="radio" name="intent" value="${esc(value)}" ${data.intent===value?'checked':''}><span class="option-card-body"><strong>${esc(value)}</strong><small>${description}</small></span></label>`;
 return `<section class="flow-card proceed-card"><fieldset><legend class="proceed-title">How would you like to proceed?</legend><div class="option-cards">${option('Buy now','Continue to your personal particulars and complete your purchase online.')}${option('Email me the Indicative Quotation and Policy Wording','We will email it to <strong>'+esc(data.email||'your email address')+'</strong>. No payment is needed.')}</div></fieldset><p class="policy-wording-note">Please refer to the Policy Wording for the full details of benefits, exclusions, terms and conditions.${q?.policyWordingUrl?' <a href="'+esc(q.policyWordingUrl)+'" target="_blank" rel="noopener">View Policy Wording<span class="sr-only"> (PDF, opens in a new tab)</span></a>':''}</p></section>`;
}
function quotation(){const route=clinicRoute(data,!!configuration(data)?.clinic);const questions={clinic:'Do you own a clinic?',ownership:'Is it a Sole proprietor or partnership / sdn bhd?',locum:'Do you hire locums who sees new patients on their own?',picAny:'Are you a Person-In-Charge (PIC) for any clinic?',picOther:'Are you a Person-In-Charge (PIC) with another establishment?'};
 const addon=(type,title,text)=>quotationAddon({id:type+'Cover',kind:type,title,selected:!!data[type+'Cover'],description:text,price:addonPrice(type),sample:samplePricing,details:type==='clinic'?select('clinicLiability','Clinic Limit Of Liability',limitsFor(),{full:true}):''});
 const recommendations=route.questions.length?`<section class="quotation-addons" aria-labelledby="quotation-addons-title"><div class="quotation-addons-heading"><h2 id="quotation-addons-title">Recommended Add-On</h2><span class="optional">Optional coverage</span></div><div class="practice-questions">${route.questions.map(key=>question(key,questions[key],key==='ownership'?['Sole Proprietor','Partnership / Sdn Bhd']:['Yes','No'])).join('')}</div>${route.clinic||route.pic?'<div class="quotation-addon-list">'+(route.clinic?addon('clinic',addonLabels.clinic,route.clinicText):'')+(route.pic?addon('pic',addonLabels.pic,route.picText):'')+'</div>':route.questions.every(key=>data[key])?'<p class="addon-result">No additional cover is recommended for these answers.</p>':'<p class="hint addon-guidance">Complete the practice questions to see your recommended add-ons.</p>'}</section>`:'';
 return `<div class="card"><div class="card-body">${coverageContext({classification:data.classification,liability:data.liability,period:data.start?dateText(data.start)+' – '+dateText(endDate()):''})}${premiumPanel()}${recommendations}<p class="reinstatement-note">${icon('check',18)}<span>Your Insurance comes with complimentary Automatic Reinstatement now</span></p>${proceedOptions()}<div id="form-status"></div></div>${actionBar(back(),data.intent==='Buy now'?next('Continue','next'):next('Email my quotation','email-quote'))}</div>`;}
function personal(){
 const config=configuration(data),foreign=!!data.nationality&&data.nationality!=='Malaysia',locked=isMalaysianNric(data.nric);
 const today=new Date().toLocaleDateString('en-CA');
 const idLabel=foreign?'NRIC / Passport Number':'NRIC Number';
 const branches=data.clinicCover?`<details class="branch-disclosure disclosure" ${data.branches.length?'open':''}><summary>Add Clinic / Branch</summary><div class="disclosure-body"><p class="field-label">Include Other Branches Within The Same Holding Company At No Additional Cost</p><span class="badge">Complimentary</span><p class="hint">Note: This offer is only available for branches with with less than a total revenue of RM 5,000,000 per annum. Kindly contact our clients services if in doubt.</p><div>${data.branches.map((b,i)=>`<div class="branch"><div><strong>${esc(b.name)}</strong><p>${esc(b.address)}</p><p>${esc(b.phone)}</p></div><div class="branch-actions"><button type="button" class="btn secondary small" data-action="edit-branch" data-index="${i}">Edit</button><button type="button" class="btn secondary small" data-action="remove-branch" data-index="${i}">Remove</button></div></div>`).join('')}</div><button type="button" class="btn secondary" data-action="branch" ${data.branches.length>=4?'disabled':''}>${icon('plus',16)}Add Clinic / Branch</button><p class="hint">You can add up to 4 branches</p><p class="hint">* The combined revenue of all branches must be less than RM 5,000,000.</p></div></details>`:'';
 return `<div class="card"><div class="card-body">
<section class="flow-card" aria-label="Personal details">${head('Personal details','user')}<div class="fields">
${field('fullName','Full Name as per IC',{full:true,placeholder:'As shown on your NRIC or passport',hint:'Letters only. Spaces and . , / @ are allowed.'})}
${field('dob','Date Of Birth',{type:'date',max:today,hint:'Applicants must be at least 16 years old.'})}
${config?.nric?field('nric',idLabel,{maxlength:14,autocomplete:'off',inputmode:foreign?'':'numeric',hint:foreign?'Malaysian NRIC (12 digits) or your passport number.':'12 digits, without dashes.'}):''}
${select('nationality','Nationality',['Malaysia','Singapore','Hongkong','Thailand','Philippines','Vietnam','Indonesia','Australia','Others'],{hint:locked?'Set to Malaysia from your 12-digit NRIC.':''})}
${data.nationality==='Others'?field('otherNationality','Country name'):''}
${field('tin','Tax Identification Number (TIN)',{optional:true,maxlength:20,autocomplete:'off',hint:'If you have a Malaysian income tax number, enter it here.'})}
</div></section>
<section class="flow-card" aria-label="Contact details">${head('Contact details','phone')}<div class="fields">
${field('mobile','Mobile Number',{type:'tel',prefix:'+60',maxlength:13,placeholder:'12 345 6789',hint:'Malaysian mobile number, without the country code.'})}
${field('email','Email Address',{type:'email',hint:'Your policy documents will be sent to this address.'})}
</div></section>
<section class="flow-card" aria-label="Practice details">${head('Practice details','building')}<div class="fields">
${data.clinicCover?field('clinicName','Clinic name (Sdn Bhd/Partnership)',{full:true}):''}
${field('practice','Enter the primary location of Practice',{full:true,placeholder:'Clinic or hospital name, town and state'})}
${config?.patients?field('patients',patientsLabel(),{inputmode:'numeric',maxlength:10,hint:'Total number of patients, as a whole number.'}):''}
${config?.revenue?field('revenue','Income',{prefix:'RM',inputmode:'decimal',maxlength:18,placeholder:'0.00',hint:'Annual income in Malaysian ringgit.'}):''}
</div>${branches}</section></div>${actionBar(back(),next())}</div>`;}
function declarations(){
 const org=!!data.clinicCover,qs=org?organisationQuestions:individualQuestions,prefix=org?'qOrg':'q',fields=declarationDetailFields(data);
 // Approved helper for the shared clinic explanation (live portal wording).
 const helper={orgDetails:'If you had answered Yes to any of the three questions above, please provide full details and the status of each claim, lawsuits, allegations or matter'};
 const detail=f=>f.required?`<div class="declaration-detail">${textarea(f.key,'Please provide details below',{hint:helper[f.key]||'Include the relevant dates, what happened and the current status.',rows:4})}</div>`:'';
 const items=qs.map((q,i)=>{
  const own=fields.find(f=>f.questions.length===1&&f.questions[0]===i),shared=fields.find(f=>f.questions.length>1&&f.after===i);
  return `<div class="declaration-item${own?.required?' has-detail':''}"><span class="question-number" aria-hidden="true">${String(i+1).padStart(2,'0')}</span><div class="declaration-body">${question(prefix+i,q,!org&&i===0?['Agree','Disagree']:['Yes','No'])}${own?detail(own):''}</div></div>${shared?.required?`<div class="declaration-shared">${detail(shared)}</div>`:''}`;
 }).join('');
 return `<div class="card"><div class="card-body">
<div class="declaration-intro"><p class="section-caption">${org?'Individual and medical establishment':'Individual practitioner'}</p><p class="hint">Answer each question. If an answer needs more detail, we’ll ask you to explain.</p></div>
<div class="declaration-questions">${items}</div>
<section class="flow-card acknowledgement-card" aria-labelledby="acknowledgement-title"><h2 id="acknowledgement-title" class="acknowledgement-title">Declaration and acknowledgement</h2><p class="hint">Read both documents before you confirm.</p><div class="legal-links"><button type="button" class="legal-link" data-action="important-notices" aria-haspopup="dialog">${icon('file',18)}<span>Important Notices to the Applicants</span>${icon('chevron',16)}</button><button type="button" class="legal-link" data-action="declaration-authorization" aria-haspopup="dialog">${icon('file',18)}<span>Declaration and Authorization</span>${icon('chevron',16)}</button></div>${check('declaration','By proceeding, you agree that you have complied with all local regulations pertaining to your profession and you have further agreed that you have read, understood and accepted to the <button type="button" class="link-btn" data-action="declaration-authorization" aria-haspopup="dialog">Declaration and Authorization</button>, '+policyWordingRef()+', <a href="https://thedoctorshield.ja.deals/privacy-policy" target="_blank" rel="noopener">Privacy Policy</a> and <a href="https://my-individualindemnity.doctorshield.com/assets/Product_Disclosure_Sheet_English.pdf" target="_blank" rel="noopener">Product Disclosure Sheet</a> for this product.')}</section>
<div id="form-status"></div></div>${actionBar(back(),next())}</div>`;}
function policyWordingRef(){const url=currentQuote()?.policyWordingUrl;return url?'<a href="'+esc(url)+'" target="_blank" rel="noopener">Policy Wording</a>':'Policy Wording';}
function hasRisk(){return data.answers.q0==='Disagree'||[1,2,3].some(i=>data.answers['q'+i]==='Yes');}
function summaryPremium(){
 const q=currentQuote();
 const head=`<header class="review-panel-head"><h2 id="review-premium">Premium breakdown</h2>${q?.sample?'<span class="sample-badge">Sample · not insurer pricing</span>':''}</header>`;
 if(q)return `<section class="review-panel summary-premium" id="summary-premium" aria-labelledby="review-premium" aria-live="polite">${head}${summaryBreakdown(q,{promo:data.promo})}<p class="hint summary-premium-note">Calculated by the insurer for ${esc(dateText(data.start))} to ${esc(dateText(endDate()))}${q.quotationNumber&&!q.sample?' · Quotation '+esc(q.quotationNumber):''}.</p></section>`;
 if(quoteState.status==='loading'||quoteState.status==='idle')return `<section class="review-panel summary-premium is-loading" id="summary-premium" aria-labelledby="review-premium" aria-live="polite" aria-busy="true">${head}<p class="summary-premium-status">Calculating your premium…</p><span class="premium-skeleton" aria-hidden="true"></span></section>`;
 if(quoteState.status==='error')return `<section class="review-panel summary-premium" id="summary-premium" aria-labelledby="review-premium" aria-live="polite">${head}${notice('<p>'+esc(quoteState.message)+'</p>'+(quoteState.retryable?'<button type="button" class="btn secondary small" data-action="retry-quote">Try again</button>':''),{tone:'error',title:'Premium not available'})}</section>`;
 return `<section class="review-panel summary-premium" id="summary-premium" aria-labelledby="review-premium" aria-live="polite">${head}<p class="summary-premium-status"><strong>Not yet calculated</strong></p><p class="premium-panel-note">${icon('info',16)}<span>Your premium breakdown will appear here once our pricing service is connected. We never show an amount the insurer hasn’t calculated.</span></p></section>`;
}
function paymentReady(){return !!currentQuote()&&(samplePricing||paymentService.mode==='live');}
function paymentAvailability(){
 if(samplePricing)return 'Sample payment · No money will be charged.';
 if(paymentService.mode!=='live')return 'Online payment is not connected yet. No payment can be taken.';
 if(!currentQuote())return 'Payment becomes available once your premium has been calculated.';
 return 'You will be taken to our secure payment provider to pay '+money(currentQuote().final)+'. DoctorShield does not collect or store card or bank details.';
}
function proceedButton(){return button(paymentState.status==='submitting'?'Processing…':'Proceed to Payment',{action:'payment',trailing:'arrow',disabled:!paymentReady()||paymentState.status==='submitting',describedBy:'payment-availability'});}
function reviewScreen(){
 const row=reviewRow,group=reviewGroup,section=reviewSection,config=configuration(data);
 const types=[['Individual Coverage',data.liability]];
 if(data.clinicCover)types.push(['Establishment Coverage',data.clinicLiability]);
 if(data.picCover)types.push(['PIC Coverage','Included']);
 const coverage=group('',row('Insurance plan','Chubb Elite Medical Malpractice Insurance')+row('Classification',data.classification)+row('Coverage period',dateText(data.start)+' to '+dateText(endDate()))+row('Automatic Reinstatement','Complimentary'))+
  `<div class="review-group"><h3>Type of coverage</h3><table class="coverage-types"><caption class="sr-only">Type of coverage and limit</caption><thead><tr><th scope="col">Type of coverage</th><th scope="col">Coverage limit</th></tr></thead><tbody>${types.map(([t,v])=>`<tr><th scope="row">${esc(t)}</th><td>${esc(v||'—')}</td></tr>`).join('')}</tbody></table></div>`+
  (config?.specialist?group('Service details',Object.entries(data.allocations).filter(([,v])=>Number(v)>0).map(([i,v])=>row(config.specialisations[i],v+'%')).join('')):'');
 const foreign=!!data.nationality&&data.nationality!=='Malaysia';
 const applicant=group('Personal details',row('Full Name as per IC',data.fullName)+row('Date Of Birth',dateText(data.dob))+(config?.nric?row(foreign?'NRIC / Passport Number':'NRIC Number',maskId(data.nric)):'')+row('Nationality',data.nationality==='Others'?data.otherNationality:data.nationality))+
  group('Contact details',row('Email Address',data.email)+row('Mobile Number',data.mobile?'+60 '+normaliseMobile(data.mobile):''))+
  group('Practice details',(data.clinicCover?row('Clinic name (Sdn Bhd/Partnership)',data.clinicName):'')+row('Primary location of Practice',data.practice)+(config?.patients&&data.patients?row(patientsLabel(),data.patients):'')+(config?.revenue&&data.revenue?row('Income','RM '+data.revenue):''))+
  (data.clinicCover&&data.branches.length?'<div class="review-group"><h3>Clinic / Branch</h3>'+data.branches.map(b=>'<dl class="review-details review-branch">'+row('Clinic name/ Branch name',b.name)+row('Clinic Address',b.address)+row('Phone number',b.phone)+'</dl>').join('')+'</div>':'');
 const org=!!data.clinicCover;
 const declarations='<details class="review-declarations"><summary>Declaration answers</summary><dl class="review-details">'+(org?organisationQuestions:individualQuestions).map((q,i)=>row(q,data.answers[(org?'qOrg':'q')+i])).join('')+declarationDetailFields(data).filter(f=>f.required).map(f=>row('Details for question'+(f.questions.length>1?'s ':' ')+f.questions.map(i=>i+1).join(', '),data[f.key])).join('')+'</dl></details><p class="hint review-declaration-status">'+icon('check',16)+'<span>Declaration and Authorization accepted.</span></p>';
 // Shown for any unresolved attempt in this tab (not only the current quotation): it must not
 // depend on the premium, which loads after this screen is drawn.
 const attempt=readAttempt(draftStorage);
 const attemptNotice=attempt&&!samplePricing?notice(`<p>You started a payment for quotation ${esc(attempt.quotationNumber)} on ${esc(new Date(attempt.startedAt).toLocaleString('en-MY',{dateStyle:'medium',timeStyle:'short'}))}. If you completed it, please do not pay again.</p><a class="btn secondary small" href="payment-result.html">Check payment status</a>`,{tone:'warning',title:'Payment already started'}):'';
 const payment=`<fieldset class="payment-methods"><legend>Choose a payment option</legend><div class="payment-options">${paymentMethods.map(m=>`<label class="option-card payment-option"><input type="radio" name="payment" value="${m.value}" ${data.payment===m.value?'checked':''} ${errors.payment?'aria-invalid="true" aria-describedby="payment-error"':''}><span class="option-card-body"><strong>${esc(m.label)}</strong><small>${esc(m.description)}</small></span></label>`).join('')}</div>${errorFor('payment')}</fieldset><p class="payment-security">${icon('shield',16)}<span id="payment-availability">${esc(paymentAvailability())}</span></p>${attemptNotice}<div id="form-status"></div>`;
 return '<div class="review-sections">'+section('coverage','Coverage summary','edit-coverage',coverage)+section('applicant','Applicant information','edit-personal',applicant)+section('declarations','Declaration','edit-declaration',declarations)+summaryPremium()+section('payment','Payment','',payment)+'</div>'+actionBar(back(),proceedButton());
}
function quoteSentScreen(){
 const s=states.quoteSent;
 return `<div class="card state-card success-state"><div class="state-icon">${icon('mail',28)}</div><h2>${esc(s.title)}</h2><p>${esc(s.message)}</p><dl class="state-facts"><div><dt>Sent to</dt><dd>${esc(emailState.to)}</dd></div>${emailState.reference?`<div><dt>Quotation number</dt><dd>${esc(emailState.reference)}</dd></div>`:''}<div><dt>Coverage period</dt><dd>${esc(dateText(data.start))} – ${esc(dateText(endDate()))}</dd></div></dl>${emailState.sample?notice('<p>Sample preview. No email was sent.</p>',{tone:'warning'}):''}<div class="state-actions"><button type="button" class="btn primary" data-action="buy-instead">Buy now instead</button><button type="button" class="btn secondary" data-action="back-to-quote">Back to quotation</button></div></div>`;
}
function stateScreen(){if(activeState==='quoteSent'&&emailState.status==='sent')return quoteSentScreen();if(activeState==='supplementary')return `<div class="card"><div class="card-body">${head('Supplementary questions','file')}<p class="review-only-note">Source content retained for review. The existing API must determine whether these sections are required.</p>${supplementary.map((s,j)=>`<details class="disclosure" ${j===0?'open':''}><summary>${s.title}</summary><div class="disclosure-body">${s.questions.map((q,i)=>typeof q==='string'?question('qSupp'+j+'_'+i,q):`<div class="field" style="margin:20px 0"><label for="supp${j}_${i}">${q.text}</label><textarea id="supp${j}_${i}" name="supp${j}_${i}">${esc(data['supp'+j+'_'+i])}</textarea></div>`).join('')}</div></details>`).join('')}<div class="divider"></div>${check('suppDeclaration','The Applicant declares that, after enquiry, to the best knowledge of all persons to be insured the statements set forth herein and if any attachments made hereto are true, and no material facts have been suppressed, omitted, or misstated.')}</div>${actionBar(back(),next('Next','return-declaration'))}</div>`;
if(activeState==='otp')return `<div class="card state-card"><div class="state-icon">${icon('phone',28)}</div><h2>Verification</h2><p>Please enter your registered mobile number</p><div class="fields" style="max-width:360px;margin:auto">${field('verifyMobile','Mobile number',{type:'tel',placeholder:'+60',full:true})}</div><button type="button" class="btn primary" data-action="otp-request">Message OTP</button> <button type="button" class="btn secondary" data-action="otp-request">Whatsapp OTP</button><div class="divider"></div><label class="field-label" for="otp">Please enter OTP which is sent to your mobile number with in 5 minute</label><input class="otp-input" id="otp" name="otp" maxlength="6" inputmode="numeric" autocomplete="one-time-code" aria-label="One time password"><button type="button" class="btn navy" data-action="otp-verify">Verify</button><div id="form-status"></div></div>`;
const s=states[activeState]||states.error;return `<div class="card state-card"><div class="state-icon">${icon(activeState==='error'?'info':'file',28)}</div><h2>${s.title}</h2><p>${s.message}</p><div class="notice">${icon('info',18)}<span>Screen review only. This outcome has not occurred and no information has been submitted.</span></div><div style="margin-top:24px">${activeState==='support'?'<button type="button" class="btn primary" data-action="support">Yes</button> <button type="button" class="btn secondary" data-action="return-personal">No</button>':'<button type="button" class="btn secondary" data-action="edit-coverage">Back to coverage</button>'}</div><div id="form-status"></div></div>`;}
function render(focus=false){
 data.end=data.start?dateText(endDate()):'';
 const stepMarkup=stages.map((s,i)=>`<button type="button" aria-label="Step ${i+1}: ${s}" class="step ${i<stage?'complete':''}" data-stage="${i}" ${i===stage?'aria-current="step"':''} ${!samplePricing&&i>maxStage?'disabled':''}><span class="step-num">${i<stage?icon('check',14):String(i+1).padStart(2,'0')}</span><span class="step-label"><small>Step ${i+1}</small><span>${s}</span></span></button>`).join('');
 const title=activeState?activeState==='supplementary'?'Additional information':activeState==='otp'?'Verification':activeState==='quoteSent'&&emailState.status==='sent'?'Quotation sent':'Application status':['Your coverage','Your quotation','Personal particulars','Declaration','Review your application'][stage];
 
 $('#main').innerHTML=`${samplePricing?'<p class="test-mode-ribbon" role="note">Test mode · Sample data. Nothing is sent, charged or issued.</p>':''}<div class="layout" data-step="${stage}"${focus?' data-enter':''}>${sidebar()}<section class="form-column stage-${stage}" aria-labelledby="page-title"><form id="application-form" novalidate><div class="page-heading">${mobileProgress()}<h1 id="page-title">${title}</h1></div>${activeState?stateScreen():[coverage,quotation,personal,declarations,reviewScreen][stage]()}</form><p class="form-help">${icon('phone',16)}<span>Need help? Contact us</span><a href="https://wa.me/60125360700" target="_blank" rel="noopener">+60 12-536 0700<span class="sr-only"> (WhatsApp, opens in a new tab)</span></a></p></section></div>`;
 $('#stepper').innerHTML=stepMarkup;
 document.title=`${title} | Individual Indemnity | DoctorShield`;
 if(focus){$('#main').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});}
 if(stage>=1&&!activeState&&quoteState.status!=='loading'&&quoteState.key!==pricingKey(data))scheduleQuote();
 $('#announcement').textContent=title;if(samplePricing){const status=$('#draft-status');if(status){status.textContent='Design preview';status.dataset.state='preview';}}persist();
}
async function refreshQuote(){
 clearTimeout(quoteTimer);
 const key=pricingKey(data),seq=++quoteSeq;
 if(Object.keys(validateCoverage(data)).length){quoteState={status:'idle',quote:null,key,message:'',retryable:true};updatePremiumViews();return null;}
 quoteState={status:'loading',quote:null,key,message:'',retryable:true};updatePremiumViews();
 try{const quote=await quoteService.calculate(data);if(seq!==quoteSeq)return null;quoteState={status:'ready',quote,key,message:'',retryable:true};}
 catch(error){if(seq!==quoteSeq)return null;quoteState=error instanceof IntegrationRequiredError?{status:'unavailable',quote:null,key,message:'',retryable:false}:{status:'error',quote:null,key,message:error.message||'We could not calculate your premium.',retryable:error.retryable!==false};}
 updatePremiumViews();
 return currentQuote();
}
function scheduleQuote(delay=300){clearTimeout(quoteTimer);quoteTimer=setTimeout(refreshQuote,delay);}
function updatePremiumViews(){
 const panel=$('#premium-panel');if(panel)panel.outerHTML=premiumPanel();
 const breakdown=$('#summary-premium');if(breakdown)breakdown.outerHTML=summaryPremium();
 const proceed=document.querySelector('.premium-navigation [data-action="payment"]');if(proceed&&paymentState.status!=='submitting'){proceed.disabled=!paymentReady();const note=$('#payment-availability');if(note)note.textContent=paymentAvailability();}
 const summary=document.querySelector('.premium-action-bar .premium-summary');if(summary)summary.outerHTML=premiumSummary(currentQuote());
 document.querySelectorAll('.quotation-addon').forEach(card=>{const type=card.querySelector('input[name$="Cover"]')?.name==='clinicCover'?'clinic':'pic';const strong=card.querySelector('.quotation-addon-price strong');const price=addonPrice(type);if(strong)strong.textContent=money(typeof price==='number'?price:null);});
}
function setBusy(trigger,busy,label){if(!trigger?.isConnected)return;trigger.disabled=busy;if(busy){trigger.setAttribute('aria-busy','true');trigger.dataset.label=trigger.querySelector('span')?.textContent||'';if(label&&trigger.querySelector('span'))trigger.querySelector('span').textContent=label;}else{trigger.removeAttribute('aria-busy');if(trigger.dataset.label&&trigger.querySelector('span'))trigger.querySelector('span').textContent=trigger.dataset.label;}}
async function continueFromCoverage(trigger){
 if(!validCoverage()){showErrors();return;}
 if(pendingOperation)return;
 pendingOperation=true;setBusy(trigger,true,'Checking…');
 try{
  if(data.promo.trim()){
   const result=await quoteService.validatePromo(data);
   if(!result.valid){errors={promo:'This promo code is not valid for your selection. Check the code or remove it to continue.'};showErrors();return;}
  }
 }catch(error){
  if(!(error instanceof IntegrationRequiredError)){$('#form-status').innerHTML=notice('<p>'+esc(error.message)+'</p><button type="button" class="btn secondary small" data-action="calculate">Try again</button>',{tone:'error',title:'We could not check your promo code',live:true});return;}
 }finally{pendingOperation=false;setBusy(trigger,false);}
 go(1);refreshQuote();
}
async function emailQuotation(trigger){
 errors=validateQuotation(data);
 if(Object.keys(errors).length){showErrors();return;}
 const status=$('#form-status');
 if(validateCoverage(data).email){status.innerHTML=notice('<p>Enter a valid email address on the Coverage step to receive your quotation.</p><button type="button" class="btn secondary small" data-action="edit-coverage">Edit email address</button>',{tone:'error',title:'Email address needed',live:true});return;}
 if(emailState.status==='sending')return;
 emailState={status:'sending'};setBusy(trigger,true,'Sending…');
 status.innerHTML=notice('<p>Sending your quotation to <strong>'+esc(data.email)+'</strong>…</p>',{live:true});
 try{
  const quote=currentQuote()||await refreshQuote();
  if(!quote)throw quoteState.status==='unavailable'?new IntegrationRequiredError('Quotation email'):new Error(quoteState.message||'Your premium is not available yet.');
  const result=await quoteService.sendQuotationEmail(data,quote);
  if(!result?.accepted)throw new Error('We could not confirm that your quotation email was sent.');
  emailState={status:'sent',to:result.to,reference:result.reference||quote.quotationNumber||'',sample:!!result.sample};
  activeState='quoteSent';errors={};render(true);
 }catch(error){
  emailState={status:'failed'};
  const box=$('#form-status');if(!box)return;
  box.innerHTML=error instanceof IntegrationRequiredError
   ?notice('<p>The quotation email service is not connected yet, so no email has been sent. You can continue with Buy now, or contact us on WhatsApp +60 12-536 0700.</p>',{tone:'error',title:'Email quotation is not available yet',live:true})
   :notice('<p>'+esc(error.message)+' No email has been sent.</p><button type="button" class="btn secondary small" data-action="email-quote">Try again</button>',{tone:'error',title:'We could not send your quotation',live:true});
  box.scrollIntoView({block:'nearest',behavior:'smooth'});
 }finally{setBusy(trigger,false);}
}
let confirmedTin='',idRevealed=false;
async function confirmPersonal(trigger){
 if(!configuration(data)?.nric){go(3);return;}
 setBusy(trigger,true,'Checking…');
 confirmedTin=String(data.tin||'').trim();
 try{const r=await quoteService.lookupTin(normaliseId(data.nric));if(r?.tin)confirmedTin=r.tin;}catch{/* lookup unavailable: use the TIN the applicant entered */}
 finally{setBusy(trigger,false);}
 idRevealed=false;
 const foreign=!!data.nationality&&data.nationality!=='Malaysia';
 modal('Confirm your personal details',`<p>Kindly review your personal details below and confirm to proceed</p><dl class="confirm-details"><div><dt>${foreign?'NRIC / Passport Number':'NRIC Number'}</dt><dd><span id="confirm-id">${esc(maskId(data.nric))}</span><button type="button" class="link-btn" data-action="reveal-id" aria-pressed="false" aria-controls="confirm-id">Show full number</button></dd></div><div><dt>Date Of Birth</dt><dd>${esc(dateText(data.dob))}</dd></div>${confirmedTin?`<div><dt>Tax Tin Number</dt><dd>${esc(confirmedTin)}</dd></div>`:''}<div><dt>Email Address</dt><dd>${esc(data.email)}</dd></div></dl><p class="hint">Your identity details are only shown to you on this screen.</p>`,'<button type="button" class="btn secondary" data-action="edit-personal-details">Edit</button><button type="button" class="btn primary" data-action="confirm-personal">Confirm</button>');
 $('#modal').classList.add('confirm-dialog');
 $('#modal [data-action="confirm-personal"]')?.focus();
}
function errorLabel(id){const labels={payment:'Payment option',classification:'Classification',liability:'Limit Of Liability',start:'Insurance Start Date',email:'Email Address',promo:'Promo Code',tin:'Tax Identification Number',patients:'No of Patients Served',revenue:'Income',q0Details:'Details for declaration 1',q1Details:'Details for declaration 2',q2Details:'Details for declaration 3',q3Details:'Details for declaration 4',orgCriminalDetails:'Details for declaration 4',consent:'Terms and conditions',allocations:'Service Details',clinic:'Clinic ownership',ownership:'Ownership type',locum:'Locum practice',picAny:'PIC for any clinic',picOther:'PIC with another establishment',clinicLiability:'Clinic Limit Of Liability',nationality:'Nationality',otherNationality:'Country name',clinicName:'Clinic name',branchAgreement:'Branch indemnity agreement',pic:'PIC coverage',fullName:'Full Name as per IC',dob:'Date Of Birth',nric:'NRIC / Passport Number',practice:'Primary location of Practice',mobile:'Mobile Number',declaration:'Declaration and Authorization',riskDetails:'Disclosure details',orgDetails:'Details for declarations 1–3',payment:'Payment option'};return labels[id]||(id.startsWith('qOrg')?'Clinic declaration '+(Number(id.slice(4))+1):id.startsWith('q')?'Declaration '+(Number(id.slice(1))+1):id);}
function mobileProgress(){
 if(activeState)return '';
 const following=stages[stage+1];
 return `<div class="mobile-progress"><div class="mobile-progress-meta"><span class="mobile-progress-step">Step ${stage+1} of ${stages.length}<span class="sr-only">: ${stages[stage]}</span></span><span class="mobile-progress-next">${following?'Next: '+following:'Final step'}</span></div><ol class="mobile-progress-track" aria-hidden="true">${stages.map((s,i)=>`<li class="${i<stage?'complete':i===stage?'current':''}"></li>`).join('')}</ol></div>`;
}
// Step history: browser Back/Forward move between application steps inside the portal
// instead of leaving it. Steps beyond the furthest validated step stay locked.
const historyKey='dsStage';
function pushStage(){try{if(history.state?.[historyKey]!==stage)history.pushState({...(history.state||{}),[historyKey]:stage},'');}catch{}}
function go(i,{push=true}={}){stage=i;activeState=null;errors={};maxStage=Math.max(maxStage,i);if(push)pushStage();render(true);}
window.addEventListener('popstate',e=>{
 const target=e.state?.[historyKey];
 if(!Number.isInteger(target)||target<0||target>4)return;
 if($('#modal').open)$('#modal').close();
 if(target<=maxStage||samplePricing){stage=target;activeState=null;errors={};}
 else{try{history.replaceState({...(history.state||{}),[historyKey]:stage},'');}catch{}}
 render(true);
});
let attemptedStages=new Set();
function showErrors(){attemptedStages.add(stage);render();const ids=Object.keys(errors).filter(id=>errors[id]);const orphans=ids.filter(id=>!document.getElementById(id+'-error'));const box=$('#form-status');if(orphans.length&&box)box.innerHTML=notice('<ul class="plain-list">'+orphans.map(id=>'<li>'+esc(errorLabel(id))+': '+esc(errors[id])+'</li>').join('')+'</ul>',{tone:'error',title:'Some details need attention',live:true});const first=ids[0];const target=document.getElementById(first)||document.querySelector('[name="'+first+'"]');target?.focus({preventScroll:true});target?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});$('#announcement').textContent=ids.length===1?'1 field needs attention.':ids.length+' fields need attention.';}
function validCoverage(){errors=validateCoverage(data);return !Object.keys(errors).length;}
function validPersonal(){errors=validatePersonal(data);return !Object.keys(errors).length;}
function validDeclarations(){errors=validateDeclarations(data);return !Object.keys(errors).length;}
let pendingOperation=false;
async function boundary(operation){
 if(samplePricing){modal('Sample outcome','<p>'+ (operation==='emailQuote'?'Quotation email preview completed. No email was sent.':operation==='requestOtp'?'Sample OTP: 123456. No message was sent.':'Preview completed. No information was submitted.')+'</p>');return;}
 if(pendingOperation)return;
 pendingOperation=true;
 const status=$('#form-status');
 const trigger=document.activeElement;
 const actionable=trigger?.tagName==='BUTTON';
 if(actionable){trigger.disabled=true;trigger.setAttribute('aria-busy','true');}
 if(status)status.innerHTML=notice('<p>Connecting…</p>',{live:true});
 try{await insuranceApi[operation]();}
 catch(error){
  if(status){status.innerHTML=notice('<p>'+esc(error.message)+'</p>',{tone:'error',title:'This service is not available yet',live:true});status.scrollIntoView({block:'nearest',behavior:'smooth'});}
  else modal('Service unavailable','<p>'+esc(error.message)+'</p>');
 }finally{pendingOperation=false;if(actionable){trigger.disabled=false;trigger.removeAttribute('aria-busy');}}
}
let paymentState={status:'idle'};
function paymentFailure(title,message,{retry=true,action=''}={}){
 const box=$('#form-status');if(!box)return;
 box.innerHTML=notice('<p>'+esc(message)+'</p>'+(action||(retry?'<button type="button" class="btn secondary small" data-action="payment">Try again</button>':'')),{tone:'error',title,live:true});
 box.scrollIntoView({block:'nearest',behavior:'smooth'});
}
async function proceedToPayment(trigger,{confirmedRepeat=false}={}){
 if(paymentState.status==='submitting'||pendingOperation)return;
 const allErrors={...validateCoverage(data),...validateQuotation(data),...validatePersonal(data),...validateDeclarations(data)};
 if(Object.keys(allErrors).length){modal('Review your application','<p>Some required information is missing or has changed. Please return to Coverage and complete each step before proceeding.</p>','<button type="button" class="btn secondary" data-action="close-modal">Close</button><button type="button" class="btn primary" data-action="edit-coverage-modal">Go to Coverage</button>');return;}
 const methodError=paymentMethodError(data.payment);
 if(methodError){errors={payment:methodError};showErrors();return;}
 const shown=currentQuote();
 if(!shown){paymentFailure('Premium not available','Your premium has not been calculated, so payment cannot start.',{retry:false});return;}
 const attempt=readAttempt(draftStorage);
 if(!samplePricing&&!confirmedRepeat&&attempt){
  modal('Payment already started',`<p>You started a payment for quotation ${esc(attempt.quotationNumber)}. If it went through, paying again would charge you twice.</p><p>Check its status first. Only continue if you are sure the earlier payment was not completed.</p>`,'<a class="btn secondary" href="payment-result.html">Check payment status</a><button type="button" class="btn primary" data-action="payment-repeat">Pay now</button>');
  return;
 }
 pendingOperation=true;paymentState={status:'submitting'};setBusy(trigger,true,'Confirming premium…');
 const status=$('#form-status');if(status)status.innerHTML=notice('<p>Confirming your premium with the insurer…</p>',{live:true});
 try{
  // Verified recalculation immediately before payment; the amount must not change silently.
  quoteState.key='';
  const fresh=await refreshQuote();
  if(!fresh){paymentState={status:'idle'};paymentFailure('Premium not available',quoteState.message||'We could not confirm your premium. No payment has been taken.',{retry:quoteState.retryable!==false});return;}
  if(!samePayable(shown,fresh)){
   paymentState={status:'idle'};render();
   const box=$('#form-status');
   if(box){box.innerHTML=notice(`<p>Your premium has been recalculated from ${money(shown.final)} to <strong>${money(fresh.final)}</strong>. Please review the premium breakdown, then select Proceed to Payment again.</p>`,{tone:'warning',title:'Your premium has changed',live:true});box.scrollIntoView({block:'nearest',behavior:'smooth'});}
   return;
  }
  setBusy(trigger,true,'Submitting application…');
  if(status)status.innerHTML=notice('<p>Submitting your application…</p>',{live:true});
  await paymentService.submitApplication(data,fresh);
  setBusy(trigger,true,'Redirecting…');
  if(status)status.innerHTML=notice('<p>Taking you to our secure payment provider. Please do not close this page.</p>',{live:true});
  if(!samplePricing)saveAttempt(draftStorage,{quotationNumber:fresh.quotationNumber,amount:fresh.final,method:data.payment,startedAt:Date.now()});
  if(samplePricing){paymentState={status:'idle'};setBusy(trigger,false);modal('Sample payment','<p>No money will be charged. Choose an outcome to preview the result page.</p>','<div class="sample-outcomes">'+['paid','pending','failed','cancelled','unverified'].map(o=>`<a class="btn ${o==='paid'?'primary':'secondary'} small" href="payment-result.html?sample=1&status=${o}">${{paid:'Successful',pending:'Pending',failed:'Failed',cancelled:'Cancelled',unverified:'Not verified'}[o]}</a>`).join('')+'</div>');return;}
  await paymentService.startPayment({quotationNumber:fresh.quotationNumber});
  // The browser is now leaving for the gateway; keep the button disabled.
 }catch(error){
  paymentState={status:'idle'};setBusy(trigger,false);
  if(error instanceof IntegrationRequiredError)paymentFailure('Online payment is not available yet',error.message+' Please contact us on WhatsApp +60 12-536 0700 to complete your purchase.',{retry:false});
  else if(error?.code==='start-date')paymentFailure('Start date no longer valid',error.message+' No payment has been taken.',{retry:false,action:'<button type="button" class="btn secondary small" data-action="edit-coverage">Change start date</button>'});
  else paymentFailure('Payment could not start',(error?.message||'Something went wrong.')+' No payment has been taken.',{retry:error?.retryable!==false});
 }finally{pendingOperation=false;}
}
let previousFocus;
function modal(title,body,footer=''){previousFocus=document.activeElement;$('#modal-content').innerHTML=`<div class="modal-head"><h2 id="modal-title">${title}</h2><button type="button" class="icon-btn" data-action="close-modal" aria-label="Close dialog">${icon('close')}</button></div><div class="modal-body">${body}</div><div class="modal-footer">${footer||'<span></span><button type="button" class="btn secondary" data-action="close-modal">Close</button>'}</div>`;document.body.classList.add('modal-open');$('#modal').showModal();}
$('#modal').addEventListener('close',()=>{document.body.classList.remove('modal-open');$('#modal').classList.remove('premium-dialog','allocation-dialog','confirm-dialog','legal-dialog');document.body.classList.remove('premium-modal-open');if(previousFocus?.isConnected)previousFocus.focus();});
$('#modal').addEventListener('click',event=>{if(event.target!==$('#modal')||!$('#modal').classList.contains('premium-dialog'))return;const r=$('#modal').getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)$('#modal').close();});
const total=alloc=>Math.round(Object.values(alloc).reduce((a,v)=>a+(Number(v)||0),0)*100)/100;
let allocationDraft={};
function openAllocations(){
 allocationDraft={...data.allocations};
 modal('Specialisations',`<p class="allocation-instruction">Select your specialisations and allocate 100% of your practice.</p><div class="allocation-workspace"><div class="allocation-browser"><div class="allocation-search field"><label for="specialisation-search"><span class="task-marker" aria-hidden="true">1</span>Search specialisations</label><div class="input-icon"><input id="specialisation-search" type="search" placeholder="Search by name" autocomplete="off">${icon('search',18)}</div></div><div class="allocation-list" id="allocation-list"></div></div><section class="allocation-selected" aria-labelledby="selected-title"><div class="allocation-selected-head"><h3 id="selected-title"><span class="task-marker" aria-hidden="true">2</span>Your selection <span id="allocation-count" class="selection-count"></span></h3><button type="button" class="link-btn" data-action="distribute-allocations">Split equally</button></div><div id="allocation-selected-list"></div></section></div><p class="error" id="allocation-error" role="alert"></p>`,`<div class="allocation-meter"><div><span>Total allocated</span><strong id="allocation-total">0%</strong></div><progress id="allocation-progress" max="100" value="0" aria-label="Practice allocated"></progress><span id="allocation-remaining" role="status"></span></div><div><button type="button" class="btn secondary" data-action="reset-allocations">Reset</button><button type="button" class="btn primary" data-action="save-allocations">Save specialisations</button></div>`);
 $('#modal').classList.add('allocation-dialog');renderAllocationRows('');renderSelectedAllocations();
}
function renderAllocationRows(query){
 const list=(configuration(data)?.specialisations||[]).map((s,i)=>({s,i})).filter(({s})=>s.toLowerCase().includes(query.toLowerCase()));
 $('#allocation-list').innerHTML=list.length?list.map(({s,i})=>`<label class="specialisation-option"><input type="checkbox" data-specialisation="${i}" ${Object.hasOwn(allocationDraft,i)?'checked':''}><span>${esc(s)}</span>${icon('plus',16)}</label>`).join(''):'<p class="allocation-empty">No specialisations found.</p>';
}
function renderSelectedAllocations(){
 const names=configuration(data)?.specialisations||[];
 $('#allocation-selected-list').innerHTML=Object.keys(allocationDraft).length?Object.entries(allocationDraft).map(([i,v])=>`<div class="selected-allocation"><label for="allocation-${i}">${esc(names[i])}</label><div class="allocation-value"><input type="number" min="0.01" max="100" step="0.01" inputmode="decimal" id="allocation-${i}" data-allocation="${i}" value="${v||''}" placeholder="0" aria-label="${esc(names[i])} Percentage(%)"><span>%</span></div><button type="button" class="icon-btn" data-action="remove-allocation" data-index="${i}" aria-label="Remove ${esc(names[i])}">${icon('close',16)}</button></div>`).join(''):'<p class="allocation-empty">Select a specialisation to add its percentage.</p>';
 updateAllocationTotal();
}
function updateAllocationTotal(){
 const amount=allocationTotal(allocationDraft),remaining=Math.round((100-amount)*100)/100;
 $('#allocation-count').textContent=Object.keys(allocationDraft).length;
 $('#allocation-total').textContent=amount+'%';$('#allocation-progress').value=Math.min(100,amount);
 $('#allocation-remaining').textContent=remaining<0?Math.abs(remaining)+'% over allocated':remaining>0?remaining+'% remaining':'100% allocated';
 $('#allocation-remaining').classList.toggle('error',remaining<0);
 document.querySelector('[data-action="distribute-allocations"]').disabled=!Object.keys(allocationDraft).length;
 $('#allocation-error').textContent='';document.querySelectorAll('[data-allocation]').forEach(input=>{input.removeAttribute('aria-invalid');input.removeAttribute('aria-describedby');});
}

let branchIndex=-1;
function branchModal(i=-1){branchIndex=i;const b=data.branches[i]||{};modal('Add Clinic / Branch',`<div class="fields"><div class="field full"><label for="branch-name">Clinic name/ Branch name</label><input id="branch-name" placeholder="e.g Klinik Damansara" value="${esc(b.name)}"></div><div class="field full"><label for="branch-address">Clinic Address</label><textarea id="branch-address" placeholder="ex. 2, angaksaraya jin amang, Kuala Lumpur">${esc(b.address)}</textarea></div><div class="field full"><label for="branch-phone">Phone number</label><input id="branch-phone" type="tel" placeholder="+60" value="${esc(b.phone)}"></div></div><p class="hint">*All fields are required.</p><p class="error" id="branch-error" role="alert"></p>`,`<button type="button" class="btn secondary" data-action="close-modal">Cancel</button><button type="button" class="btn primary" data-action="save-branch">${i<0?'Add Clinic / Branch':'Save changes'}</button>`);}
document.addEventListener('input',e=>{const t=e.target;if(t.id==='specialisation-search'){renderAllocationRows(t.value);return;}if(t.dataset.allocation!==undefined){allocationDraft[t.dataset.allocation]=Number(t.value);updateAllocationTotal();return;}if(t.name){maxStage=Math.min(maxStage,stage);if(stage<3)data.declaration=false;if(isAnswerName(t.name))data.answers[t.name]=t.value;else data[t.name]=t.type==='checkbox'?t.checked:t.value;}if(t.name==='start'){$('#end').value=data.start?dateText(endDate()):'';if($('#summary-period'))$('#summary-period').textContent=data.start?`${dateText(data.start)} – ${dateText(endDate())}`:'—';}if(t.name==='liability'&&$('#summary-liability'))$('#summary-liability').textContent=t.value||'—';persist();});
document.addEventListener('change',e=>{
 if(e.target.dataset.specialisation!==undefined){const key=e.target.dataset.specialisation;if(e.target.checked)allocationDraft[key]=0;else delete allocationDraft[key];renderSelectedAllocations();return;}

 const t=e.target,name=t.name,value=t.value;if(!name)return;
 if(isAnswerName(name))data.answers[name]=value;else data[name]=t.type==='checkbox'?t.checked:value;
 const branching=['classification','clinic','ownership','locum','picAny','picOther','clinicCover'];
 if(branching.includes(name)){resetClinicDependents(data,name);maxStage=Math.min(maxStage,name==='classification'?0:1);errors={};}
 if(name==='classification'){data.liability='';data.allocations={};data.nric='';data.patients='';data.revenue='';}
 if(name==='nric'&&/^\d{12}$/.test(value)){data.nationality='Malaysia';data.otherNationality='';}
 if(name==='nationality'&&value!=='Others')data.otherNationality='';
 if(isAnswerName(name)){data.declaration=false;maxStage=Math.min(maxStage,3);}
 if(name==='classification'&&quoteService.mode==='live'&&data.classification&&!liveLimits[data.classification]){const requested=data.classification;quoteService.getLiabilities(data).then(labels=>{liveLimits[requested]=labels;if(data.classification===requested&&stage===0)render();}).catch(()=>{});}
 if(name==='clinicLiability'&&stage===1)scheduleQuote();
 if(name==='intent'){const s=$('#form-status');if(s)s.innerHTML='';}
 if(name==='payment'&&errors.payment){delete errors.payment;render();document.querySelector('input[name="payment"]:checked')?.focus();}
 if(branching.includes(name)||['nationality','nric','intent','picCover'].includes(name)||isAnswerName(name)&&!name.startsWith('qSupp')){
  render();[...document.getElementsByName(name)].find(el=>el.value===value)?.focus();
  if(name==='classification'&&configuration(data)?.specialist)openAllocations();
 }
});
document.addEventListener('submit',e=>{e.preventDefault();if(e.target.id==='application-form')e.target.querySelector('.card-actions .primary, .premium-navigation .primary')?.click();});
document.addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.errorTarget){const target=document.getElementById(b.dataset.errorTarget)||document.getElementsByName(b.dataset.errorTarget)[0];target?.focus();target?.scrollIntoView({block:'center'});return;}if(b.dataset.stage!==undefined){const n=Number(b.dataset.stage);if(n>stage&&!samplePricing){errors=[validateCoverage,validateQuotation,validatePersonal,validateDeclarations][stage]?.(data)||{};if(Object.keys(errors).length){showErrors();return;}}if(samplePricing||n<=maxStage)go(n);return;}if(b.dataset.state){activeState=b.dataset.state;errors={};render(true);return;}switch(b.dataset.action){
case 'sample-fill':if(samplePricing){data.classification||='General Medical Practitioner';const config=configuration(data);data.liability||=config.limits[0];data.start||=new Date().toLocaleDateString('en-CA');data.email||='alex@example.com';data.consent=true;if(config.specialist&&!Object.keys(data.allocations).length)data.allocations={0:100};Object.assign(data,{fullName:data.fullName||'Alex Tan',dob:data.dob||'1985-06-15',nationality:data.nationality||'Malaysia',nric:data.nric||'850615101234',practice:data.practice||'Sample Clinic, Kuala Lumpur',mobile:data.mobile||'0123456789',clinicName:data.clinicName||'Sample Clinic',patients:data.patients||'1200',revenue:data.revenue||'250,000.00',declaration:true});data.clinic||='No';data.picAny||='No';data.ownership||='Partnership / Sdn Bhd';data.locum||='No';data.picOther||='No';data.clinicLiability||=config.limits[0];for(let i=0;i<4;i++){data.answers['q'+i]||=i===0?'Agree':'No';data.answers['qOrg'+i]||='No';}data.riskDetails||='Sample disclosure for preview.';data.orgDetails||='Sample disclosure for preview.';errors={};maxStage=4;render();}break;
case 'start-again':modal('Start a new application?','<p>This clears the details saved in this browser tab. You cannot undo this action.</p>','<button type="button" class="btn secondary" data-action="close-modal">Keep my application</button><button type="button" class="btn primary" data-action="clear-application">Clear application</button>');break;
case 'clear-application':clearDraft(draftStorage);location.href=location.pathname;break;
case 'calculate':await continueFromCoverage(b);break;
case 'email-quote':await emailQuotation(b);break;
case 'retry-quote':refreshQuote();break;
case 'buy-instead':data.intent='Buy now';activeState=null;emailState={status:'idle'};render(true);break;
case 'back-to-quote':activeState=null;render(true);break;
case 'next':if(stage===1){errors=validateQuotation(data);if(Object.keys(errors).length){showErrors();break;}if(data.intent!=='Buy now'){await emailQuotation(b);break;}go(2);}else if(stage===2){if(!validPersonal()){showErrors();break;}await confirmPersonal(b);}else if(stage===3){if(!validDeclarations()){showErrors();break;}go(4);}break;
case 'back':if(activeState){activeState=null;render(true);}else go(Math.max(0,stage-1));break;
case 'return-declaration':case 'edit-declaration':go(3);break;case 'edit-coverage':go(0);break;case 'edit-personal':case 'return-personal':go(2);break;
case 'payment':await proceedToPayment(document.querySelector('.premium-navigation [data-action="payment"]')||b);break;
case 'payment-repeat':$('#modal').close();await proceedToPayment(document.querySelector('.premium-navigation [data-action="payment"]'),{confirmedRepeat:true});break;
case 'edit-coverage-modal':$('#modal').close();go(0);break;
case 'allocations':openAllocations();break;
case 'reset-allocations':allocationDraft={};renderAllocationRows($('#specialisation-search').value);renderSelectedAllocations();break;
case 'distribute-allocations':allocationDraft=distributeAllocations(allocationDraft);renderSelectedAllocations();break;
case 'remove-allocation':delete allocationDraft[b.dataset.index];renderAllocationRows($('#specialisation-search').value);renderSelectedAllocations();$('#specialisation-search').focus();break;
case 'save-allocations':if(!validAllocations(allocationDraft)){$('#allocation-error').textContent='Enter a percentage for each selected specialisation. The total must be 100%.';const inputs=[...document.querySelectorAll('[data-allocation]')];const invalid=inputs.filter(input=>!Number.isFinite(Number(input.value))||Number(input.value)<=0||Number(input.value)>100);(invalid.length?invalid:inputs).forEach(input=>{input.setAttribute('aria-describedby','allocation-error');input.setAttribute('aria-invalid','true');});(invalid[0]||inputs[0]||$('#specialisation-search')).focus();$('#allocation-error').scrollIntoView({block:'nearest'});break;}data.allocations={...allocationDraft};maxStage=0;data.declaration=false;$('#modal').close();render();document.querySelector('[data-action="allocations"]')?.focus();break;
case 'premium-breakdown':modal('Premium breakdown',premiumBreakdown(currentQuote()));$('#modal').classList.add('premium-dialog');document.body.classList.add('premium-modal-open');break;
case 'close-modal':$('#modal').close();break;
case 'branch':branchModal();break;case 'edit-branch':branchModal(Number(b.dataset.index));break;
case 'save-branch':{const branch={name:$('#branch-name').value.trim(),address:$('#branch-address').value.trim(),phone:$('#branch-phone').value.trim()};if(Object.values(branch).some(v=>!v)||!/^\+?[\d\s()-]{8,18}$/.test(branch.phone)){$('#branch-error').textContent='Complete all fields and enter a valid phone number.';break;}if(branchIndex<0&&data.branches.length<4)data.branches.push(branch);else if(branchIndex>=0)data.branches[branchIndex]=branch;$('#modal').close();render();document.querySelector('[data-action="branch"]')?.focus();break;}
case 'remove-branch':data.branches.splice(Number(b.dataset.index),1);render();document.querySelector(data.branches.length?'[data-action="branch"]':'.branch-disclosure > summary')?.focus();break;
case 'important-notices':modal('Important Notices to the Applicants',`<div class="legal-copy">${importantNoticesHtml}</div>`);$('#modal').classList.add('legal-dialog');break;
case 'declaration-authorization':modal('Declaration and Authorization',`<div class="legal-copy">${declarationAuthorizationHtml}</div>`);$('#modal').classList.add('legal-dialog');break;
case 'reveal-id':{idRevealed=!idRevealed;$('#confirm-id').textContent=idRevealed?normaliseId(data.nric):maskId(data.nric);b.setAttribute('aria-pressed',String(idRevealed));b.textContent=idRevealed?'Hide number':'Show full number';break;}
case 'edit-personal-details':previousFocus=document.getElementById('nric')||document.getElementById('fullName');$('#modal').close();break;
case 'confirm-personal':$('#modal').close();go(3);break;
case 'addon-info':modal('Why is this recommended?','<p>Please refer to the Policy Wording for the full details of benefits, exclusions, terms and conditions.</p><p class="hint">The existing service must supply the exact recommendation explanation and eligibility rules before release.</p>');break;
case 'otp-request':await boundary('requestOtp');break;case 'otp-verify':await boundary('verifyOtp');break;case 'support':await boundary('requestSupport');break;
}});
try{history.replaceState({...(history.state||{}),[historyKey]:stage},'');}catch{}
render();
// Returning from the gateway with the browser Back button can restore this page from cache with
// the payment button still busy. Reset it; the "payment already started" check prevents a silent repeat.
window.addEventListener('pageshow',event=>{if(event.persisted){paymentState={status:'idle'};pendingOperation=false;render();}});

document.addEventListener('focusout',event=>{const t=event.target;if(t.name==='revenue'&&parseIncome(t.value)!==null){t.value=formatIncome(t.value);data.revenue=t.value;persist();}if(t.name==='mobile'&&/^\d{7,10}$/.test(normaliseMobile(t.value))){t.value=normaliseMobile(t.value);data.mobile=t.value;persist();}});
// Inline validation. Field errors live under their field (aria-invalid + aria-describedby);
// page-level alerts are kept for system errors only. A field is checked on blur once it has a
// value or once the customer has tried to continue from this step; corrections clear at once.
const stageValidators=[validateCoverage,validateQuotation,validatePersonal,validateDeclarations];
function setInlineError(id,message){
 const control=document.getElementById(id)||document.getElementsByName(id)[0];
 const group=control?.closest('.field,.question,.check-row');if(!group)return false;
 const targets=group.classList.contains('question')?[group.querySelector('fieldset')]:[...group.querySelectorAll('input,select,textarea')];
 const errorId=id+'-error';let node=document.getElementById(errorId);
 if(message){
  if(!node){node=document.createElement('p');node.className='error field-error';node.id=errorId;node.innerHTML=icon('info',14)+'<span></span>';
   if(group.classList.contains('check-row'))group.after(node);else (group.querySelector('fieldset')||group).append(node);}
  node.querySelector('span').textContent=message;
  group.classList.add('has-error');
  for(const el of targets){if(!el)continue;el.setAttribute('aria-invalid','true');const ids=(el.getAttribute('aria-describedby')||'').split(' ').filter(Boolean);if(!ids.includes(errorId))el.setAttribute('aria-describedby',[...ids,errorId].join(' '));}
 }else{
  node?.remove();group.classList.remove('has-error');
  for(const el of targets){if(!el)continue;el.removeAttribute('aria-invalid');const ids=(el.getAttribute('aria-describedby')||'').split(' ').filter(v=>v&&v!==errorId);if(ids.length)el.setAttribute('aria-describedby',ids.join(' '));else el.removeAttribute('aria-describedby');}
 }
 return true;
}
function checkField(control){
 const id=control.name;if(!id||!control.closest('#application-form')||activeState)return;
 const validate=stageValidators[stage];if(!validate)return;
 const message=validate(data)[id]||'';
 const hasValue=control.type==='checkbox'||control.type==='radio'?false:String(control.value||'').trim()!=='';
 if(message&&!errors[id]&&!attemptedStages.has(stage)&&!hasValue)return; // untouched: wait for submit
 if(message)errors[id]=message;else delete errors[id];
 setInlineError(id,message);
}
document.addEventListener('focusout',event=>{
 const control=event.target;
 // Moving between options of one radio group is not leaving the field.
 if(control.type==='radio'&&event.relatedTarget?.name===control.name)return;
 checkField(control);
});
document.addEventListener('change',event=>{if(['radio','checkbox','select-one','date'].includes(event.target.type))checkField(event.target);});

if(samplePricing&&new URLSearchParams(location.search).get('renewal')==='1'){Object.assign(data,{classification:'General Medical Practitioner',liability:'RM 500,000',fullName:'Alex Tan',dob:'1985-06-15',email:'alex@example.com',mobile:'0123456789',nationality:'Malaysia',practice:'Sample Clinic, Kuala Lumpur',start:new Date().toLocaleDateString('en-CA')});render();}

// QA control surface for the development QA panel. Exists only in test (sample) mode, which itself
// requires the ds-qa flag; it drives the same state the customer UI uses and never a live service.
if(samplePricing){
 const blank=()=>{for(const k of Object.keys(data))data[k]=typeof data[k]==='boolean'?false:Array.isArray(data[k])?[]:data[k]&&typeof data[k]==='object'?{}:'';data.intent='Buy now';};
 window.__dsQA=Object.freeze({
  page:'application',
  state:()=>({page:'application',step:stages[stage],stage,maxStage,view:activeState||'',quote:quoteState.status,email:emailState.status,payment:paymentState.status,errors:Object.keys(errors).filter(k=>errors[k])}),
  go(n){if($('#modal').open)$('#modal').close();maxStage=4;go(n);},
  fill(values){blank();Object.assign(data,structuredClone(values));maxStage=4;errors={};activeState=null;clearTimeout(quoteTimer);quoteSeq++;quoteState={status:'idle',quote:null,key:'',message:'',retryable:true};render();},
  reset(){if($('#modal').open)$('#modal').close();blank();errors={};maxStage=0;activeState=null;emailState={status:'idle'};paymentState={status:'idle'};quoteState={status:'idle',quote:null,key:'',message:'',retryable:true};go(0);},
  validate(){const v=[validateCoverage,validateQuotation,validatePersonal,validateDeclarations][stage];if(!v)return 0;errors=v(data);showErrors();return Object.keys(errors).length;},
  setQuote(status){clearTimeout(quoteTimer);quoteSeq++;const key=pricingKey(data);quoteState=status==='calculating'?{status:'loading',quote:null,key,message:'',retryable:true}:{status:'unavailable',quote:null,key,message:'',retryable:false};updatePremiumViews();},
  recalculate(){quoteState={...quoteState,key:''};return refreshQuote();},
  action(name){const b=document.querySelector(`.premium-navigation [data-action="${name}"]`)||document.querySelector(`[data-action="${name}"]`);b?.click();return !!b;},
  setIntent(value){data.intent=value;emailState={status:'idle'};activeState=null;render();}
 });
 window.dispatchEvent(new Event('ds:qa-ready'));
}
loadQaPanel();
