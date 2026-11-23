// Payment result screens. Pure rendering: every value shown as "confirmed" comes from the
// verified payment status (payment-service.js parsePaymentStatus), never from the browser draft.
import {icon} from './icons.js';
import {money} from './premium-components.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const support=`<section class="result-support" aria-labelledby="support-title"><h2 id="support-title">Need help?</h2><p>Our client services team can help with payments and policy documents.</p><ul class="result-support-list"><li>${icon('phone',18)}<a href="https://wa.me/60125360700" target="_blank" rel="noopener">WhatsApp +60 12-536 0700<span class="sr-only"> (opens in a new tab)</span></a></li><li>${icon('external',18)}<a href="https://my.doctorshield.com/contact-us/" target="_blank" rel="noopener">Contact us<span class="sr-only"> (opens in a new tab)</span></a></li></ul></section>`;
const facts=rows=>'<dl class="state-facts result-facts">'+rows.filter(([,v])=>v).map(([k,v])=>`<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')+'</dl>';
const action=(label,{href='',action:a='',primary=false})=>href?`<a class="btn ${primary?'primary':'secondary'}" href="${esc(href)}">${esc(label)}</a>`:`<button type="button" class="btn ${primary?'primary':'secondary'}" data-action="${esc(a)}">${esc(label)}</button>`;
const card=({tone,symbol,title,lead,body='',actions=''})=>`<section class="card result-card result-${tone}" aria-labelledby="result-title"><div class="result-symbol" aria-hidden="true">${symbol}</div><h1 id="result-title" tabindex="-1">${esc(title)}</h1><p class="result-lead">${lead}</p>${body}${actions?`<div class="state-actions result-actions">${actions}</div>`:''}</section>`;
const successArt=`<svg class="result-art" viewBox="0 0 120 120" width="96" height="96" role="presentation"><circle cx="60" cy="60" r="56" class="result-art-ring"/><circle cx="60" cy="60" r="44" class="result-art-disc"/><path d="M60 30 38 38v18c0 15 22 28 22 28s22-13 22-28V38L60 30Z" class="result-art-shield"/><path d="m50 58 7 7 14-15" class="result-art-check"/></svg>`;
const period=r=>r.start&&r.end?esc(r.start)+' to '+esc(r.end):'';

/** Returns {title, html} for one result. `result.status`: paid | pending | failed | cancelled | unverified | unavailable | missing. */
export function resultView(result,{sample=false}={}){
 const sampleNote=sample?'<p class="result-sample"><span class="sample-badge">Sample preview</span> No payment was taken and no policy was issued.</p>':'';
 const ref=result?.quotationNumber?esc(result.quotationNumber):'';
 switch(result?.status){
  case 'paid':return {title:'Payment successful',html:card({tone:'success',symbol:successArt,title:'Payment successful',
   lead:'Thank you. Your payment has been received and confirmed.',
   body:sampleNote+facts([['Payment status','<span class="status-pill is-paid">Paid</span>'],['Transaction reference',esc(result.transactionReference)],['Quotation number',ref],['Insurance plan',esc(result.plan||'Chubb Elite Medical Malpractice Insurance')],['Premium paid',money(result.amount)],['Coverage period',period(result)]])+
    `<section class="result-next" aria-labelledby="next-title"><h2 id="next-title">What happens next</h2><ol class="result-steps"><li><strong>Policy documents</strong><span>Your policy documents will be sent to ${result.email?'<strong>'+esc(result.email)+'</strong>':'the email address in your application'}. Please check your spam folder if they have not arrived.</span></li><li><strong>Keep your reference</strong><span>Quote your transaction reference if you contact us about this payment.</span></li><li><strong>Check your details</strong><span>When your documents arrive, check that your personal and coverage details are correct and tell us straight away if anything needs to change.</span></li></ol></section>`+support,
   actions:action('Return to home',{href:'./',primary:true})})};
  case 'pending':return {title:'Payment pending',html:card({tone:'pending',symbol:icon('clock',36),title:'Your payment is being confirmed',
   lead:'Your bank or payment provider has not confirmed this payment yet. This can take a few minutes.',
   body:sampleNote+facts([['Payment status','<span class="status-pill is-pending">Pending</span>'],['Quotation number',ref],['Amount',result.amount?money(result.amount):'']])+`<p class="result-caution">${icon('alert',18)}<span><strong>Please do not pay again</strong> while this payment is pending, or you may be charged twice.</span></p>`+support,
   actions:action('Check again',{action:'recheck',primary:true})})};
  case 'failed':return {title:'Payment unsuccessful',html:card({tone:'error',symbol:icon('close',36),title:'Payment unsuccessful',
   lead:'Your payment did not go through, so your policy has not been issued.',
   body:sampleNote+facts([['Payment status','<span class="status-pill is-failed">Unsuccessful</span>'],['Quotation number',ref]])+'<p class="result-copy">You can try again with the same or a different payment option. If money was deducted from your account, please contact us before trying again.</p>'+support,
   actions:action('Try payment again',{href:'./',primary:true})})};
  case 'cancelled':return {title:'Payment cancelled',html:card({tone:'neutral',symbol:icon('back',36),title:'Payment cancelled',
   lead:'You cancelled the payment. No payment was taken and your policy has not been issued.',
   body:sampleNote+facts([['Payment status','<span class="status-pill is-cancelled">Cancelled</span>'],['Quotation number',ref]])+'<p class="result-copy">Your application is saved in this browser tab. Return to your summary to choose a payment option and try again.</p>'+support,
   actions:action('Return to summary',{href:'./',primary:true})})};
  case 'missing':return {title:'No payment to check',html:card({tone:'neutral',symbol:icon('info',36),title:'We could not find a payment to check',
   lead:'There is no payment in progress in this browser tab.',
   body:'<p class="result-copy">If you paid in another tab or browser, your policy documents will be sent by email once the payment is confirmed. Contact us if you are unsure.</p>'+support,
   actions:action('Return to home',{href:'./',primary:true})})};
  default:return {title:'Payment not confirmed',html:card({tone:'warning',symbol:icon('alert',36),title:'We could not confirm your payment',
   lead:result?.status==='unavailable'?'Payment confirmation is not connected to this page yet, so we cannot show whether your payment was successful.':'We could not verify the status of your payment just now.',
   body:sampleNote+facts([['Payment status','<span class="status-pill is-unknown">Not confirmed</span>'],['Quotation number',ref]])+`<p class="result-caution">${icon('alert',18)}<span><strong>Please do not pay again.</strong> If your payment went through, your policy documents will be emailed to you. Check again in a few minutes or contact us with your quotation number.</span></p>`+support,
   actions:(result?.status==='unavailable'?'':action('Check again',{action:'recheck',primary:true}))+action('Return to home',{href:'./'})})};
 }
}
