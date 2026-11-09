// Public smoke checks only. No trip capability, service role or private itinerary is stored in CI.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const base='https://kevinyu1470.github.io/work-assistant/kansai/';
async function get(url){let last;for(let i=0;i<3;i++){try{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(15000)});assert(r.ok,'HTTP '+r.status+' '+url);return r;}catch(e){last=e;if(i<2)await new Promise(r=>setTimeout(r,2000));}}throw last;}
const release=await(await get(base+'release.json?health='+Date.now())).json();assert(release.version&&release.assets,'Missing release integrity manifest');
for(const [path,hash]of Object.entries(release.assets)){const r=await get(new URL(path,base));const bytes=Buffer.from(await r.arrayBuffer());assert.equal(createHash('sha256').update(bytes).digest('hex'),hash,'Published asset mismatch: '+path);}
const config=await(await get(base+'config.js')).text();const endpoint=config.match(/url:\s*['"]([^'"]+)/)?.[1];assert(endpoint,'Missing sync endpoint');
const auth=await fetch(endpoint,{signal:AbortSignal.timeout(15000)});assert.equal(auth.status,401,'Sync gateway did not reject unauthenticated request');
console.log('LIVE PASS:',release.version,Object.keys(release.assets).length,'verified public assets; sync gateway reachable and authentication enforced');
