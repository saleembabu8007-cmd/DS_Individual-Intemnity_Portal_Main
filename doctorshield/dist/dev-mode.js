// Development / protected-staging test mode.
//
// Test mode (sample journeys, simulated service responses and the floating QA panel) is enabled only
// when the page carries <meta name="ds-qa" content="enabled">. That tag is injected by the local dev
// server (server.mjs) and by a staging build made with `node build.mjs --qa`, which must be deployed
// behind access protection. The public production build (`node build.mjs`) never adds the tag and
// leaves the qa/ folder out entirely. A query parameter on its own never enables anything.
//
// Simulated responses only ever come from the preview services; live services ignore all of this.

export function qaEnabled(doc=globalThis.document){
 return doc?.querySelector?.('meta[name="ds-qa"]')?.getAttribute('content')==='enabled';
}

/** Sample mode for this page: test mode must be enabled AND the page opened with ?sample=1 / ?review=1. */
export function sampleMode(doc=globalThis.document,loc=globalThis.location){
 if(!qaEnabled(doc))return false;
 const p=new URLSearchParams(loc?.search||'');
 return p.get('sample')==='1'||p.get('review')==='1';
}

const scenarioKey='ds.qa.scenario.v1';
/** Simulated outcome for one service call, e.g. scenario('quote') -> 'error'. 'ok' when unset. */
export function scenario(name,{doc=globalThis.document,storage=globalThis.sessionStorage}={}){
 if(!qaEnabled(doc))return 'ok';
 try{return JSON.parse(storage.getItem(scenarioKey)||'{}')[name]||'ok';}catch{return 'ok';}
}
export function setScenario(values,storage=globalThis.sessionStorage){
 try{const current=JSON.parse(storage.getItem(scenarioKey)||'{}');storage.setItem(scenarioKey,JSON.stringify({...current,...values}));}catch{}
}
export function clearScenario(storage=globalThis.sessionStorage){try{storage.removeItem(scenarioKey);}catch{}}

/** Loads the QA panel when test mode is on. In the production build the module does not exist. */
export function loadQaPanel(doc=globalThis.document){
 if(!qaEnabled(doc))return;
 import('./qa/qa-panel.js').then(m=>m.mountQaPanel?.()).catch(()=>{});
}
