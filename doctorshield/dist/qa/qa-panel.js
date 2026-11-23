// Development-only QA panel. Loaded by dev-mode.js only when the page carries the ds-qa flag;
// the production build does not contain this folder. Every action drives the page's own state
// through window.__dsQA (defined only in test/sample mode) and the simulated preview services.
// Nothing here can reach a live service: sample mode swaps every service for its preview version.
import {personas,variants} from './fixtures.js';
import {setScenario,clearScenario} from '../dev-mode.js';

const pendingKey='ds.qa.pending.v1',personaKey='ds.qa.persona.v1',tabKey='ds.qa.tab.v1';
const store={get:(k,d=null)=>{try{return JSON.parse(sessionStorage.getItem(k))??d;}catch{return d;}},set:(k,v)=>{try{sessionStorage.setItem(k,JSON.stringify(v));}catch{}},del:k=>{try{sessionStorage.removeItem(k);}catch{}}};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const qa=()=>window.__dsQA;
const persona=()=>personas[store.get(personaKey,'malaysian')]||personas.malaysian;
const EMAIL_INTENT='Email me the Indicative Quotation and Policy Wording';

// ---------- Targets: where each command runs ----------
const pages={
 app:{url:'./?sample=1',match:q=>q?.page==='application'},
 renewal:{url:'services.html?flow=renewal&sample=1',match:q=>q?.page==='renewal'},
 claims:{url:'services.html?flow=claims&sample=1',match:q=>q?.page==='claims'},
 result:s=>({url:'payment-result.html?sample=1&status='+s,match:q=>q?.page==='payment-result'&&q.state().status===s})
};
async function runOps(ops){
 for(const op of ops){
  const api=qa();if(!api)return;
  if(op.scenario){clearScenario();setScenario(op.scenario);}
  if(op.fill)api.fill(op.variant?variants[op.variant](persona().data()):persona().data());
  if(op.reset)api.reset();
  if(op.intent)api.setIntent(op.intent);
  if(op.go!==undefined){api.go(op.go);await sleep(120);}
  if(op.quote)api.setQuote(op.quote);
  if(op.recalculate)await api.recalculate();
  if(op.set){for(const [k,v] of Object.entries(op.set)){const el=document.querySelector(`[name="${k}"][value="${v}"]`)||document.getElementById(k);if(el){if(el.type==='radio'||el.type==='checkbox'){if(!el.checked)el.click();}else{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));}}}await sleep(60);}
  if(op.validate){api.validate();}
  if(op.show)api.show(op.show);
  if(op.clearPayment){api.fill({...persona().data(),payment:''});api.go(4);await sleep(150);}
  if(op.action){
   // Wait for an in-flight premium calculation so the action sees the same state a customer would.
   if(api.page==='application')for(let i=0;i<60&&api.state().stage>=1&&['idle','loading'].includes(api.state().quote);i++)await sleep(100);
   await sleep(120);api.action(op.action);
  }
  if(op.wait)await sleep(op.wait);
 }
}
async function go(target,ops=[]){
 const t=typeof target==='function'?target():target;
 if(t.match(qa())){close();await runOps(ops);refresh();return;}
 store.set(pendingKey,{ops,at:Date.now()});
 location.href=t.url;
}

// ---------- Content ----------
const navGroups=[
 ['Application',[
  ['Coverage',()=>go(pages.app,[{fill:1},{go:0}])],
  ['Quotation',()=>go(pages.app,[{scenario:{}},{fill:1},{go:1}])],
  ['Email quotation (sent)',()=>go(pages.app,[{scenario:{email:'ok'}},{fill:1},{intent:EMAIL_INTENT},{go:1},{action:'email-quote'}])],
  ['Personal Particulars',()=>go(pages.app,[{fill:1},{go:2}])],
  ['Declaration',()=>go(pages.app,[{fill:1},{go:3}])],
  ['Summary',()=>go(pages.app,[{fill:1},{go:4}])],
  ['Payment (start)',()=>go(pages.app,[{scenario:{}},{fill:1},{go:4},{action:'payment'}])]
 ]],
 ['Payment result',[
  ['Success',()=>go(pages.result('paid'))],['Pending',()=>go(pages.result('pending'))],['Failure',()=>go(pages.result('failed'))],['Cancelled',()=>go(pages.result('cancelled'))],['Not confirmed',()=>go(pages.result('unverified'))]
 ]],
 ['Renewal',[
  ['Verification',()=>go(pages.renewal,[{show:'phone'}])],['Code (OTP)',()=>go(pages.renewal,[{show:'otp'}])],['Policy details',()=>go(pages.renewal,[{show:'policy-one'}])],
  ['Review',null,'Continues on the DoctorShield renewal page (server). Not part of this portal.'],['Result',null,'Shown by the DoctorShield renewal page after payment.']
 ]],
 ['Claims',[
  ['Verification',()=>go(pages.claims,[{show:'phone'}])],['Code (OTP)',()=>go(pages.claims,[{show:'otp'}])],['Claim details',()=>go(pages.claims,[{show:'claim'}])],['Claim review',()=>go(pages.claims,[{show:'claim-review'}])],['Result (test mode)',()=>go(pages.claims,[{show:'claim-sent'}])]
 ]]
];
function pageStates(){
 const api=qa();if(!api)return [];
 if(api.page==='payment-result')return [['Success',()=>go(pages.result('paid'))],['Pending',()=>go(pages.result('pending'))],['Failed',()=>go(pages.result('failed'))],['Cancelled',()=>go(pages.result('cancelled'))],['Verification failure',()=>go(pages.result('unverified'))]];
 if(api.page==='renewal'||api.page==='claims'){const labels={choices:'Route choice',phone:'Mobile: empty','phone-error':'Mobile: invalid format',sending:'Sending code',otp:'Code: waiting','otp-invalid':'Code: invalid','otp-expired':'Code: expired, resend available','otp-locked':'Code: too many attempts','otp-limit':'Code: send limit reached','rate-limited':'Rate limited',unavailable:'Service unavailable','policy-one':'Policy found','policy-many':'Several policies','no-policy':'No matching policy',booking:'Discussion: booking',records:'Choose policy',claim:'Claim form','claim-error':'Claim: required errors','claim-review':'Claim review','claim-not-confirmed':'Claim: not confirmed','claim-sent':'Claim: submitted (test mode)'};
  return api.states().map(s=>[labels[s]||s,()=>{api.show(s);refresh();}]);}
 const s=api.state().stage,here=ops=>()=>go(pages.app,[{go:s},...ops]);
 const sets=[
  [['Empty',here([{reset:1}])],['Partially filled',here([{fill:1,variant:'coverageOnly'},{set:{liability:''}}])],['Valid',here([{fill:1}])],['Required field errors',()=>go(pages.app,[{reset:1},{action:'calculate'}])],['Invalid format',here([{fill:1,variant:'invalidFormat'},{validate:1}])],['Loading (checking promo)',()=>go(pages.app,[{fill:1},{go:0},{set:{promo:'TEST10'}},{action:'calculate'}])]],
  [['No calculation yet',here([{quote:'none'}])],['Calculating',here([{quote:'calculating'}])],['Calculated',here([{scenario:{quote:'ok'}},{recalculate:1}])],['Calculation failed',here([{scenario:{quote:'error'}},{recalculate:1}])],['Timeout',here([{scenario:{quote:'timeout'}},{recalculate:1}])],['Quote expired',here([{scenario:{quote:'expired'}},{recalculate:1}])],['Email: ready',here([{scenario:{}},{intent:EMAIL_INTENT}])],['Email: sending',here([{scenario:{email:'slow'}},{intent:EMAIL_INTENT},{action:'email-quote'}])],['Email: sent (test mode)',here([{scenario:{email:'ok'}},{intent:EMAIL_INTENT},{action:'email-quote'}])],['Email: failed',here([{scenario:{email:'fail'}},{intent:EMAIL_INTENT},{action:'email-quote'}])]],
  [['Empty',here([{fill:1,variant:'coverageOnly'}])],['Valid',here([{fill:1}])],['Required field errors',here([{fill:1,variant:'coverageOnly'},{validate:1}])],['Invalid format',here([{fill:1,variant:'invalidFormat'},{validate:1}])],['Confirmation dialog',here([{fill:1},{action:'next'}])]],
  [['Valid',here([{fill:1}])],['Adverse answers',here([{fill:1,variant:'adverse'}])],['Adverse, missing details',here([{fill:1,variant:'adverse'},{validate:1}])],['Important Notices dialog',here([{fill:1},{action:'important-notices'}])],['Declaration dialog',here([{fill:1},{action:'declaration-authorization'}])]],
  [['Ready',here([{scenario:{}},{fill:1}])],['Premium loading',here([{quote:'calculating'}])],['Premium unavailable',here([{quote:'none'}])],['Payment method missing',()=>go(pages.app,[{scenario:{}},{fill:1},{go:4},{clearPayment:1},{action:'payment'}])],['Processing',here([{scenario:{quote:'slow'}},{fill:1},{action:'payment'}])],['Checkout failed',here([{scenario:{checkout:'fail'}},{fill:1},{action:'payment'}])],['Premium changed',here([{scenario:{quote:'changed'}},{fill:1},{action:'payment'}])],['Breakdown dialog',here([{fill:1},{action:'premium-breakdown'}])]]
 ];
 const list=sets[s]||[];
 return list;
}
const scenarios=[
 ['Complete valid purchase',()=>go(pages.app,[{scenario:{}},{fill:1},{go:4},{action:'payment'}])],
 ['Invalid email',()=>go(pages.app,[{fill:1},{go:0},{set:{email:'aina.test@'}},{action:'calculate'}])],
 ['Missing required fields',()=>go(pages.app,[{reset:1},{action:'calculate'}])],
 ['Adverse declaration',()=>go(pages.app,[{fill:1,variant:'adverse'},{go:3},{validate:1}])],
 ['Quotation with add-ons',()=>{store.set(personaKey,'clinicOwner');go(pages.app,[{scenario:{}},{fill:1},{go:1}]);}],
 ['Expired quotation',()=>go(pages.app,[{scenario:{quote:'expired'}},{fill:1},{go:1}])],
 ['Premium changed before payment',()=>go(pages.app,[{scenario:{quote:'changed'}},{fill:1},{go:4},{action:'payment'}])],
 ['OTP failure',()=>go(pages.renewal,[{show:'otp-invalid'}])],
 ['Renewal eligible',()=>go(pages.renewal,[{show:'policy-one'}])],
 ['Policy not found',()=>go(pages.renewal,[{show:'no-policy'}])],
 ['Payment failure',()=>go(pages.result('failed'))],
 ['Payment pending',()=>go(pages.result('pending'))],
 ['Successful payment (test mode)',()=>go(pages.result('paid'))],
 ['Email delivery failure',()=>go(pages.app,[{scenario:{email:'fail'}},{fill:1},{intent:EMAIL_INTENT},{go:1},{action:'email-quote'}])]
];

// ---------- UI ----------
let root,panel,fab,tab=store.get(tabKey,'goto'),handlers=[];
const btn=(label,i,extra='')=>`<button type="button" class="qa-item" data-qa="${i}" ${extra}>${esc(label)}</button>`;
function body(){
 handlers=[];const add=fn=>{handlers.push(fn);return handlers.length-1;};
 const api=qa();
 if(!api)return `<p class="qa-note">This page is not in test mode.</p><button type="button" class="qa-primary" data-qa="${add(()=>{const u=new URL(location.href);u.searchParams.set('sample','1');location.href=u.href;})}">Open this page in test mode</button>`;
 if(tab==='goto')return navGroups.map(([title,items])=>`<h3>${title}</h3><div class="qa-grid">${items.map(([label,fn,note])=>fn?btn(label,add(fn)):`<button type="button" class="qa-item" disabled title="${esc(note)}">${esc(label)}<small>${esc(note)}</small></button>`).join('')}</div>`).join('');
 if(tab==='states'){const items=pageStates();const s=api.state();return `<h3>${esc(s.step||s.page)}</h3>${items.length?`<div class="qa-grid">${items.map(([l,fn])=>btn(l,add(fn))).join('')}</div>`:'<p class="qa-note">No extra states on this page.</p>'}`;}
 if(tab==='scenarios')return `<div class="qa-grid">${scenarios.map(([l,fn])=>btn(l,add(fn))).join('')}</div>`;
 const s=api.state();
 return `<h3>Test persona</h3><div class="qa-personas">${Object.entries(personas).map(([k,p])=>`<label><input type="radio" name="qa-persona" value="${k}" ${store.get(personaKey,'malaysian')===k?'checked':''}> ${esc(p.label)}</label>`).join('')}</div>
 <h3>Actions</h3><div class="qa-grid">
 ${btn('Fill current page',add(()=>{if(api.page==='application')go(pages.app,[{fill:1},{go:s.stage}]);else{api.fill();refresh();}}))}
 ${api.page==='application'?btn('Fill complete purchase journey',add(()=>go(pages.app,[{scenario:{}},{fill:1},{go:4}]))):''}
 ${btn('Reset current form',add(()=>{api.reset?.();refresh();}))}
 ${btn('Reset test session',add(resetSession))}
 </div>
 <h3>Current state</h3><dl class="qa-state">${Object.entries(s).map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${esc(Array.isArray(v)?v.join(', ')||'none':v===''?'—':v)}</dd></div>`).join('')}<div><dt>route</dt><dd>${esc(location.pathname.split('/').pop()||'index.html')}${esc(location.search)}</dd></div><div><dt>simulated</dt><dd>${esc(Object.entries(store.get('ds.qa.scenario.v1',{})).map(([k,v])=>k+': '+v).join(', ')||'all succeed')}</dd></div></dl>`;
}
function resetSession(){
 for(const k of ['doctorshield.application.v1','doctorshield.payment-attempt.v1','ds.qa.scenario.v1',pendingKey,personaKey])store.del(k);
 location.href='./?sample=1';
}
function refresh(){if(!panel||panel.hidden)return;panel.querySelector('.qa-body').innerHTML=body();panel.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===tab)));}
function open(){panel.hidden=false;fab.setAttribute('aria-expanded','true');refresh();panel.querySelector('[aria-pressed="true"]')?.focus();}
function close(){if(!panel||panel.hidden)return;panel.hidden=true;fab.setAttribute('aria-expanded','false');}

export function mountQaPanel(){
 if(document.querySelector('.qa-root'))return;
 const css=document.createElement('link');css.rel='stylesheet';css.href=new URL('./qa-panel.css',import.meta.url).href;document.head.append(css);
 root=document.createElement('div');root.className='qa-root';
 root.innerHTML=`<button type="button" class="qa-fab" aria-expanded="false" aria-controls="qa-panel" title="QA tools (development only)"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7.5 14h9"/></svg><span>QA</span></button>
 <section class="qa-panel" id="qa-panel" role="dialog" aria-modal="false" aria-labelledby="qa-title" hidden><header><h2 id="qa-title">QA tools</h2><span class="qa-tag">Development only · simulated</span><button type="button" class="qa-close" aria-label="Close QA tools">×</button></header>
 <nav class="qa-tabs" aria-label="QA sections">${[['goto','Go to'],['states','States'],['scenarios','Scenarios'],['tools','Tools']].map(([k,l])=>`<button type="button" data-tab="${k}" aria-pressed="${k===tab}">${l}</button>`).join('')}</nav><div class="qa-body"></div></section>`;
 document.body.append(root);
 panel=root.querySelector('.qa-panel');fab=root.querySelector('.qa-fab');
 fab.addEventListener('click',()=>panel.hidden?open():close());
 root.querySelector('.qa-close').addEventListener('click',()=>{close();fab.focus();});
 root.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){close();fab.focus();}});
 root.addEventListener('click',e=>{const t=e.target.closest('[data-tab]');if(t){tab=t.dataset.tab;store.set(tabKey,tab);refresh();t.focus();return;}const b=e.target.closest('[data-qa]');if(b)handlers[Number(b.dataset.qa)]?.();});
 root.addEventListener('change',e=>{if(e.target.name==='qa-persona')store.set(personaKey,e.target.value);});
 // Commands queued on another page run once this page's QA surface is ready.
 const runPending=async()=>{const p=store.get(pendingKey);if(!p||!qa())return;store.del(pendingKey);if(Date.now()-p.at>60000)return;await sleep(150);
  await runOps(p.ops);
  refresh();};
 if(qa())runPending();else window.addEventListener('ds:qa-ready',runPending,{once:true});
 window.__dsQAPanel=Object.freeze({open,close,run:runOps});
}
