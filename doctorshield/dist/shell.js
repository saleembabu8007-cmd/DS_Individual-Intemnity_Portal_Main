import {sampleMode} from './dev-mode.js';
// Shared application shell: header navigation state and the mobile menu.
// No business logic. Works on index.html and services.html.

/** Which header item represents the current page. Pure for testing. */
export function activeNavKey(pathname='/',search=''){
 const page=String(pathname).split('/').pop()||'index.html';
 if(page==='services.html')return new URLSearchParams(search).get('flow')==='claims'?'claims':'renewal';
 return page==='index.html'||page===''?'apply':'';
}

/** Adds sample=1 to internal links once, so preview journeys stay in preview. */
export function withSample(href){
 if(!href||/^[a-z]+:/i.test(href)||href.startsWith('#')||/[?&]sample=1\b/.test(href))return href;
 const [path,hash='']=href.split('#');
 return path+(path.includes('?')?'&':'?')+'sample=1'+(hash?'#'+hash:'');
}

export function initShell(doc=globalThis.document,loc=globalThis.location){
 const header=doc?.querySelector('.site-header');
 if(!header)return;
 const toggle=header.querySelector('.nav-toggle');
 const nav=header.querySelector('#site-nav');
 const key=activeNavKey(loc.pathname,loc.search);
 header.querySelectorAll('[data-nav]').forEach(link=>{
  if(link.dataset.nav===key)link.setAttribute('aria-current','page');else link.removeAttribute('aria-current');
 });
 // Keep header links inside sample mode only when test mode is on (dev-mode.js).
 if(sampleMode(doc,loc)){
  doc.querySelectorAll('.site-header a[href], .brand[href]').forEach(a=>{
   const href=a.getAttribute('href');
   if(href&&!/^https?:/i.test(href))a.setAttribute('href',withSample(href));
  });
 }
 if(!toggle||!nav)return;
 const setOpen=open=>{
  if(open)header.setAttribute('data-open','');else header.removeAttribute('data-open');
  toggle.setAttribute('aria-expanded',String(open));
  toggle.setAttribute('aria-label',open?'Close menu':'Open menu');
 };
 toggle.addEventListener('click',()=>{const open=!header.hasAttribute('data-open');setOpen(open);if(open)nav.querySelector('a')?.focus();});
 doc.addEventListener('keydown',e=>{if(e.key==='Escape'&&header.hasAttribute('data-open')){setOpen(false);toggle.focus();}});
 doc.addEventListener('click',e=>{if(header.hasAttribute('data-open')&&!header.contains(e.target))setOpen(false);});
 nav.addEventListener('click',e=>{if(e.target.closest('a'))setOpen(false);});
 globalThis.matchMedia?.('(min-width: 861px)').addEventListener?.('change',e=>{if(e.matches)setOpen(false);});
}

if(typeof document!=='undefined')initShell();
