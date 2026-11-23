// Payment result page. The gateway returns the customer here; the result is always re-checked
// with the backend. URL parameters are only used to know which payment to check, never as proof.
import {createPaymentService,readAttempt,clearAttempt} from './payment-service.js';
import {IntegrationRequiredError} from './api.js';
import {clearDraft} from './draft.js';
import {resultView} from './payment-result-view.js';

const params=new URLSearchParams(location.search);
const sample=params.get('sample')==='1';
const service=createPaymentService({preview:sample});
let storage;try{storage=sessionStorage;}catch{}
const main=document.querySelector('#main');
let checking=false;

function show(result){
 const view=resultView(result,{sample});
 main.innerHTML=`<div class="result-shell">${view.html}</div>`;
 document.title=`${view.title} | Individual Indemnity | DoctorShield`;
 document.querySelector('#announcement').textContent=view.title;
 document.querySelector('#result-title')?.focus({preventScroll:true});
}

async function check(){
 if(checking)return;checking=true;
 main.querySelector('.result-card')?.setAttribute('aria-busy','true');
 const button=main.querySelector('[data-action="recheck"]');if(button){button.disabled=true;button.textContent='Checking…';}
 const attempt=sample?null:readAttempt(storage);
 // VERIFY: the gateway's return parameter names. The quotation number saved when payment started is preferred.
 const quotationNumber=attempt?.quotationNumber||params.get('quotationNumber')||params.get('quotation')||'';
 const reference=params.get('reference')||params.get('ref')||'';
 try{
  if(!sample&&!quotationNumber){show({status:'missing'});return;}
  const result=await service.verifyPayment(sample?{status:params.get('status')||'paid'}:{quotationNumber,reference});
  if(!sample){
   if(result.status==='paid'){clearDraft(storage);clearAttempt(storage);}
   // A confirmed failure or cancellation ends that attempt, so paying again is not flagged as a duplicate.
   else if(result.status==='failed'||result.status==='cancelled')clearAttempt(storage);
  }
  show({...result,quotationNumber:result.quotationNumber||quotationNumber});
 }catch(error){
  show({status:error instanceof IntegrationRequiredError?'unavailable':'unverified',quotationNumber});
 }finally{checking=false;}
}

document.addEventListener('click',event=>{if(event.target.closest('[data-action="recheck"]'))check();});
check();
