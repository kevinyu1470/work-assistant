'use strict';
// Per-tab write-ahead journals prevent a clean tab from erasing another tab's pending edits.
const DurableTrip=(()=>{
 let room='',journal='',sequence=0,dbPromise=null,chain=Promise.resolve(),recovered=[];
 let status={ok:true,pending:false};
 const notify=()=>{if(typeof cloudPaint==='function')cloudPaint();};
 const valid=s=>s&&CloudMerge.validTrip(s.base)&&CloudMerge.validTrip(s.local);
 const prefix=()=> 'kansai-durable-'+room;
 function database(){
  if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
   if(typeof indexedDB==='undefined'){reject(Error('storage_unavailable'));return;}
   const req=indexedDB.open('kansai-durable-v1',1);let settled=false;
   const timer=setTimeout(()=>{settled=true;reject(Error('storage_timeout'));},3000);
   req.onupgradeneeded=()=>req.result.createObjectStore('snapshots');
   req.onsuccess=()=>{clearTimeout(timer);if(settled){req.result.close();return;}resolve(req.result);};
   req.onerror=()=>{clearTimeout(timer);reject(req.error);};
  });return dbPromise;
 }
 async function put(key,value){const db=await database();await new Promise((resolve,reject)=>{
  const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(value,key);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
 });}
 async function all(){const db=await database();return new Promise((resolve,reject)=>{
  const tx=db.transaction('snapshots'),store=tx.objectStore('snapshots'),req=store.openCursor(),rows=[];
  req.onsuccess=()=>{const cursor=req.result;if(!cursor)return;rows.push({key:cursor.key,raw:cursor.value});cursor.continue();};tx.oncomplete=()=>resolve(rows);tx.onerror=()=>reject(tx.error);
 });}
 async function removeIfUnchanged(entry){
  try{if(localStorage.getItem(entry.key)===entry.raw)localStorage.removeItem(entry.key);}catch{}
  try{const db=await database();await new Promise((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite'),store=tx.objectStore('snapshots'),read=store.get(entry.key);read.onsuccess=()=>{if(read.result===entry.raw)store.delete(entry.key);};tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});}catch{}
 }
 function configure(key){room=key;journal=prefix()+':journal:'+crypto.randomUUID();}
 async function load(){
  let rows=[];try{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key.startsWith(prefix()+':')||key==='kansai-cloud-cache-'+room.slice(0,16))rows.push({key,raw:localStorage.getItem(key)});}}catch{}
  try{rows.push(...(await all()).filter(r=>r.key.startsWith(prefix()+':')));}catch{}
  const seen=new Set();const entries=[];
  for(const row of rows){if(seen.has(row.key+'\n'+row.raw))continue;seen.add(row.key+'\n'+row.raw);try{const snapshot=JSON.parse(row.raw);if(valid(snapshot))entries.push({...row,snapshot});}catch{}}
  recovered=entries.filter(e=>e.snapshot.dirty);
  const clean=entries.filter(e=>!e.snapshot.dirty).sort((a,b)=>(b.snapshot.revision||0)-(a.snapshot.revision||0)||(b.snapshot.savedAt||0)-(a.snapshot.savedAt||0));
  // Dirty journals are replayed in creation order; every one keeps its own merge baseline.
  const pending=entries.filter(e=>e.snapshot.dirty).sort((a,b)=>(a.snapshot.savedAt||0)-(b.snapshot.savedAt||0));
  return {clean:clean[0]?.snapshot||null,pending:pending.map(e=>e.snapshot)};
 }
 function write(snapshot){
  if(!room)return false;
  const seq=++sequence,packet={...snapshot,savedAt:Date.now()},raw=JSON.stringify(packet),key=packet.dirty?journal:prefix()+':head';
  let localOK=false;
  try{
   // Never downgrade the shared clean cache when a slower tab saves an older response.
   const prior=JSON.parse(localStorage.getItem(key)||'null');
   if(packet.dirty||!prior||packet.revision>=(prior.revision||0)){localStorage.setItem(key,raw);localOK=localStorage.getItem(key)===raw;}
   else localOK=true;
  }catch{}
  status={ok:localOK,pending:true};notify();
  chain=chain.catch(()=>{}).then(async()=>{
   let idbOK=false;try{await put(packet.dirty?journal:prefix()+':snapshot:'+packet.revision,raw);idbOK=true;}catch{}
   if(seq===sequence){status={ok:localOK||idbOK,pending:false};notify();}
   if(!packet.dirty&&(localOK||idbOK)){
    // Only retire the exact recovered bytes; a live tab may have edited its journal since boot.
    for(const entry of recovered)await removeIfUnchanged(entry);recovered=[];
    if(seq===sequence){let own=[];try{own=(await all()).filter(e=>e.key===journal);}catch{}const local=await journalBytes();if(local)own.push({key:journal,raw:local});for(const entry of own)await removeIfUnchanged(entry);}
   }
  });return localOK;
 }
 async function journalBytes(){try{return localStorage.getItem(journal);}catch{return null;}}
 // Keep a bounded number of acknowledged IndexedDB snapshots; pending journals are never pruned.
 async function compact(){try{const rows=await all(),clean=rows.filter(r=>r.key.startsWith(prefix()+':snapshot:')).sort((a,b)=>Number(b.key.split(':').pop())-Number(a.key.split(':').pop()));for(const row of clean.slice(12))await removeIfUnchanged(row);}catch{}}
 function isSafe(){return status.ok&&!status.pending;}
 return {configure,load,write,compact,isSafe,get status(){return status;}};
})();
