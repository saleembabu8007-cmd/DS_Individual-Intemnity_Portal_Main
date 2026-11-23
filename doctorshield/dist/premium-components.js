// Live values are server supplied. Explicitly marked design samples are isolated from checkout.
// Labels follow the live summary table. Rates (commission, SST) are not printed because they
// are not returned by the quotation service; amounts are shown exactly as calculated by it.
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const rows=[['total','Total Premium'],['discount','Discount'],['net','Nett Premium'],['sst','SST'],['stampDuty','Stamp Duty'],['final','Final Premium']];
export function money(value){return typeof value==='number'&&Number.isFinite(value)&&value>=0?'RM '+value.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2}):'RM —';}
const available=q=>q&&rows.every(([key])=>typeof q[key]==='number'&&Number.isFinite(q[key])&&q[key]>=0);
export function premiumSummary(quote=null){quote=available(quote)?quote:null;return `<div class="premium-summary"><div class="premium-price"><strong>${money(quote?.final)}</strong><span>${quote?'Inclusive of SST &amp; Stamp Duty':'Not yet calculated'}</span></div><button type="button" class="link-btn premium-breakdown-trigger" data-action="premium-breakdown" aria-haspopup="dialog" aria-controls="modal">Premium breakdown <span aria-hidden="true">⌃</span></button></div>`;}
export function premiumBreakdown(quote=null){quote=available(quote)?quote:null;return `${Array.isArray(quote?.items)?'<dl class="premium-items">'+quote.items.map(item=>'<div><dt>'+esc(item.label)+'</dt><dd>'+money(item.amount)+'</dd></div>').join('')+'</dl>':''}<table class="breakdown premium-breakdown-table"><caption class="sr-only">Premium breakdown in Malaysian ringgit</caption><tbody>${rows.map(([key,label])=>`<tr${key==='final'?' class="premium-final"':''}><th scope="row">${label}</th><td>${key==='discount'&&quote?.discount>0?'− ':''}${money(quote?.[key])}</td></tr>`).join('')}</tbody></table>${quote?'':'<p class="hint premium-unavailable">Your premium will appear here when quotation services are available. Payment is not available yet.</p>'}`;}

/**
 * Summary-page breakdown: coverage components, then the payable calculation.
 * Only renders a complete, server-verified (or clearly labelled sample) quote.
 */
export function summaryBreakdown(quote,{promo=''}={}){
 if(!available(quote))return '';
 const line=(label,value,{cls='',note=''}={})=>`<tr${cls?` class="${cls}"`:''}><th scope="row">${label}${note?`<small>${note}</small>`:''}</th><td>${value}</td></tr>`;
 const components=(quote.items||[]).map(item=>line(esc(item.label),money(item.amount),{cls:'is-component'})).join('')
  +line('Automatic Reinstatement',typeof quote.reinstatement==='number'&&quote.reinstatement>0?money(quote.reinstatement):'Complimentary',{cls:'is-component'});
 return `<table class="summary-breakdown"><caption class="sr-only">Premium breakdown in Malaysian ringgit</caption>
 <thead><tr><th scope="col">Item</th><th scope="col">Amount (RM)</th></tr></thead>
 <tbody class="summary-breakdown-components">${components}</tbody>
 <tbody>${line('Total Premium',money(quote.total),{cls:'is-subtotal'})}
 ${line('Discount',quote.discount>0?'− '+money(quote.discount):money(0),{note:quote.discount>0&&promo?'Promo code '+esc(promo.trim().toUpperCase()):''})}
 ${line('Nett Premium',money(quote.net),{cls:'is-subtotal'})}
 ${line('SST',money(quote.sst))}
 ${line('Stamp Duty',money(quote.stampDuty))}</tbody>
 <tfoot><tr class="summary-breakdown-final"><th scope="row">Final Premium Payable</th><td>${money(quote.final)}</td></tr></tfoot></table>`;
}
