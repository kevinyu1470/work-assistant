'use strict';
const VERSION='__VERSION__';
const ASSETS=__ASSETS__;
const CACHE='kansai-shell-'+VERSION+'-'+ASSETS['index.html'].slice(0,12);
const root=new URL('./',self.location.href),assetURLs=new Map(Object.entries(ASSETS).map(([p,hash])=>[new URL(p,root).href,hash]));
const digest=async response=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');
async function verifiedFetch(url,hash){const response=await fetch(url,{cache:'no-store',signal:AbortSignal.timeout(12000)});if(!response.ok||await digest(response)!==hash)throw Error('Incomplete release');return response;}
self.addEventListener('install',event=>event.waitUntil((async()=>{
 // Validate the ENTIRE release before making any new shell available.
 const loaded=await Promise.all([...assetURLs].map(async([url,hash])=>[url,await verifiedFetch(url,hash)]));
 const cache=await caches.open(CACHE);await Promise.all(loaded.map(([url,response])=>cache.put(url,response)));
 await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
 await self.clients.claim();
 for(const client of await self.clients.matchAll({type:'window',includeUncontrolled:true}))if(client.url.startsWith(root.href))client.postMessage({type:'RELEASE_ACTIVE',version:VERSION});
 // Never force navigation of a page that may hold unsaved edits.
 // Keep the previous shells available to old tabs and offline clients.
 const keys=await caches.keys(),previous=keys.filter(k=>k.startsWith('kansai-shell-')&&k!==CACHE);
 await Promise.all(previous.slice(0,-2).map(k=>caches.delete(k)));
})()));
self.addEventListener('message',event=>{if(event.data?.type==='GET_RELEASE'&&event.ports[0])event.ports[0].postMessage({version:VERSION});});
self.addEventListener('fetch',event=>{
 const req=event.request,url=new URL(req.url);
 if(req.method!=='GET'||url.origin!==root.origin||!url.href.startsWith(root.href))return;
 const navigate=req.mode==='navigate',target=navigate?new URL('index.html',root).href:req.url,hash=assetURLs.get(target);
 if(!hash){
  // An already-open older page can still request its own fingerprinted assets.
  if(url.searchParams.has('v')&&/\.(js|css)$/.test(url.pathname))event.respondWith(caches.match(req).then(r=>r||new Response('This older page needs to be reopened to load a complete release.',{status:503})));
  return; // API/private data and release checks never enter the app-shell cache.
 }
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE),cached=await cache.match(target);if(cached)return cached;
  try{const response=await verifiedFetch(target,hash);await cache.put(target,response.clone());return response;}
  catch{return new Response(navigate?'目前無法完整載入旅日手帖。已儲存的行程不會被清除，請恢復連線後重新開啟。':'Offline asset unavailable',{status:503,headers:{'Content-Type':navigate?'text/plain; charset=utf-8':'text/plain','Cache-Control':'no-store'}});}
 })());
});
