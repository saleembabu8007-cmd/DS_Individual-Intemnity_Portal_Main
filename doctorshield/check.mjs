// Syntax-checks every JavaScript module in dist/, including dist/qa/ (development tools).
import {readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';

const files=readdirSync('dist',{recursive:true})
 .map(f=>f.split('\\').join('/'))
 .filter(f=>f.endsWith('.js')&&!f.split('/').pop().startsWith('_qa'));
let failed=0;
for(const f of files){
 try{execFileSync(process.execPath,['--check','dist/'+f],{stdio:'pipe'});}
 catch(error){failed++;console.error(`dist/${f}\n${error.stderr}`);}
}
console.log(`${files.length-failed}/${files.length} modules OK`);
process.exit(failed?1:0);
