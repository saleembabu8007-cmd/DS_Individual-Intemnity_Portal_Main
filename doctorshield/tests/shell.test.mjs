import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {activeNavKey,withSample} from '../dist/shell.js';

const page=name=>readFileSync(new URL('../dist/'+name,import.meta.url),'utf8');
const footerOf=html=>html.match(/<footer[\s\S]*?<\/footer>/)?.[0]||'';
const headerOf=html=>html.match(/<header[\s\S]*?<\/header>/)?.[0]||'';

test('header marks the current portal area',()=>{
 assert.equal(activeNavKey('/',''),'apply');
 assert.equal(activeNavKey('/index.html',''),'apply');
 assert.equal(activeNavKey('/services.html','?flow=renewal'),'renewal');
 assert.equal(activeNavKey('/services.html','?flow=claims&sample=1'),'claims');
 assert.equal(activeNavKey('/services.html',''),'renewal');
 assert.equal(activeNavKey('/design-system.html',''),'');
});

test('sample mode is added once to internal links only',()=>{
 assert.equal(withSample('./'),'./?sample=1');
 assert.equal(withSample('services.html?flow=claims'),'services.html?flow=claims&sample=1');
 assert.equal(withSample('services.html?flow=claims&sample=1'),'services.html?flow=claims&sample=1');
 assert.equal(withSample('https://my.doctorshield.com/contact-us/'),'https://my.doctorshield.com/contact-us/');
 assert.equal(withSample('mailto:a@b.c'),'mailto:a@b.c');
 assert.equal(withSample('#main'),'#main');
});

for(const name of ['index.html','services.html']){
 test(`${name}: footer navigation contains only Terms and Conditions and Privacy Policy`,()=>{
  const footer=footerOf(page(name));
  const links=[...footer.matchAll(/<a [^>]*>([^<]+)/g)].map(m=>m[1].trim());
  assert.deepEqual(links,['Terms and Conditions','Privacy Policy']);
  assert.doesNotMatch(footer,/Start again|start-again|data-action|<button/);
 });
 test(`${name}: header provides product identity, Renew, Claims and Contact Us`,()=>{
  const header=headerOf(page(name));
  assert.match(header,/assets\/doctorshield-logo\.svg/);
  assert.match(header,/Individual Indemnity/);
  for(const label of ['Get a Quote','Renew','Claims','Contact Us'])assert.match(header,new RegExp('>'+label));
  assert.match(header,/aria-controls="site-nav"/);
  assert.doesNotMatch(header,/Saved in this tab/);
 });
 test(`${name}: loads the shared shell after page styles`,()=>{
  const html=page(name);
  const order=['application.css','product-compositions.css','shell.css'].map(f=>html.indexOf(f));
  assert.ok(order.every(i=>i>0)&&order[0]<order[1]&&order[1]<order[2]);
  assert.match(html,/<script type="module" src="shell\.js"><\/script>/);
 });
}

test('stylesheets resolve brand colours through tokens',()=>{
 const tokens=page('tokens.css');
 assert.match(tokens,/--brand-primary:#08A5B5/);
 assert.match(tokens,/--brand-secondary:#132766/);
 for(const file of ['application.css','product-compositions.css','shell.css'])
  assert.doesNotMatch(page(file).replace(/url\("data:[^)]*\)/g,''),/#08A5B5|#132766/i,`${file} hard-codes a brand colour`);
});
