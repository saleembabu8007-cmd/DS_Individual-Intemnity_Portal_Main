// Builds the deployable site from dist/.
//
//   node build.mjs            Public production build -> public/
//                             The qa/ folder (QA panel and fixtures) and temporary _qa* pages are
//                             left out, and no page carries the ds-qa flag, so test mode, sample
//                             journeys and simulated responses cannot be switched on.
//   node build.mjs --qa       Staging build with the QA panel -> public/
//                             Adds <meta name="ds-qa" content="enabled"> to every page. Deploy it
//                             only behind access protection (for example Vercel Deployment
//                             Protection); never to the public production domain.
import {cpSync,rmSync,readdirSync,readFileSync,writeFileSync,statSync} from 'node:fs';
import path from 'node:path';

const qa=process.argv.includes('--qa');
const out=path.resolve(process.argv.find(a=>a.startsWith('--out='))?.slice(6)||'public');
const src=path.resolve('dist');
const excluded=rel=>!qa&&(rel==='qa'||rel.startsWith('qa'+path.sep))||path.basename(rel).startsWith('_qa');

rmSync(out,{recursive:true,force:true});
cpSync(src,out,{recursive:true,filter:file=>!excluded(path.relative(src,file))});

const flag='<meta name="ds-qa" content="enabled">';
let pages=0;
for(const name of readdirSync(out)){
 if(!name.endsWith('.html'))continue;
 const file=path.join(out,name);let html=readFileSync(file,'utf8');
 html=html.replace(flag,'');
 if(qa)html=html.replace('<meta charset="utf-8">','<meta charset="utf-8">'+flag);
 writeFileSync(file,html);pages++;
}
const hasQa=(()=>{try{return statSync(path.join(out,'qa')).isDirectory();}catch{return false;}})();
console.log(`${qa?'Staging (QA enabled)':'Production'} build: ${pages} pages -> ${path.relative(process.cwd(),out)}${hasQa?' (includes qa/)':' (no QA tools)'}`);
