'use strict';
const VERSION='trip-tools-20261124';
const ASSETS={"index.html":"07fd38188522485b2dad869c7013898781ca950f1e868eb41d832725879b2155","style.css?v=60a799d3cecf5641":"60a799d3cecf56417d080181c0d6d258e93942213e4cbede80a9e21afe7a9bfb","metro.css?v=c1a3f3861503d91e":"c1a3f3861503d91eee25096bd776bc8a5d6cc2fcc75858cc293c8ec6857aadd3","trip-tools.css?v=7923937094f30e83":"7923937094f30e83cc48fc40674c63565af12ad0a4201227159ab5b890d0a4f0","release-update.js?v=0ee1a9314e6a715e":"0ee1a9314e6a715e18b4052b85084998c7f6e633bf8c43c4d86161390732d91e","data.js?v=98fdbe8c614f7dcf":"98fdbe8c614f7dcf8fa6eef22d4c1d5d16779e505fdb97fe8d537435771dfcd9","config.js?v=11e1ec3cbc96cc14":"11e1ec3cbc96cc145a05908680e01a10a1ea527b2ab1078fd8921d8139e5f776","day-covers.js?v=10b7c758725f61af":"10b7c758725f61af3eb0fc02e87fd5b0d08ad9fbad521438493e6400cbd40271","weather.js?v=e65494068af9c678":"e65494068af9c6787db1488a81e6c60604ffeaef3d73b3a72cfa9a44fdafc6af","food-guide.js?v=534367522d455bc5":"534367522d455bc5456fdd5acd2591697e105d0613d0a3fb6e770a07346d4e82","app.js?v=29f79d3c8ec00b64":"29f79d3c8ec00b6463a3250f67456dfb2dac883639f418819dfcdd101bf02ca1","checklist.js?v=c7be4794e3b92204":"c7be4794e3b92204a919b3af3fc25bf6767079219ec4cc6dc491872fa733cb1d","booking-core.js?v=55a09e0fdc986efa":"55a09e0fdc986efa2091c4d47fadee3e72914f1d23258b5f3e7170b0a48ed2a5","airline-brand.js?v=d7a2cf875ce13052":"d7a2cf875ce13052af319fb608e8deeba8e3fcbe002b2d2095ec220d76c0767d","bookings.js?v=658e7a643c4f7224":"658e7a643c4f7224c8bc5a6bdfe1d2f3d473e29b01f530d2fc52edc0c26caecb","voucher-core.js?v=9b5e164eae9b5635":"9b5e164eae9b563517399379a3dd670849c3c32e9b94f8949b46c56d9d9c67af","vouchers.js?v=fc8039d732f9fa98":"fc8039d732f9fa98bf5a1035bf2b3f33cd14b889df2380c4ef38dff8ddcabeaf","metro.js?v=dbb3845a1344cf63":"dbb3845a1344cf63e6f1b002fabc0f3e24a7423a394a3a2c2fdd47cc4dcf9243","dashboard.js?v=1e2853c86c04e26c":"1e2853c86c04e26c1c962bba43fc94ebda49f9bf7abf39dbd582076d58e1432c","sync-core.js?v=e8086dcc484c4e1d":"e8086dcc484c4e1dba35659fae740b8a3ab1fb909db519a1296420dbb30c06b1","updates.js?v=975170529dcad977":"975170529dcad97766224bde7fd4ee7764d554297aa8baa514793fdc36eae12f","durable-trip.js?v=e049199e725a4653":"e049199e725a4653432c4f91c04b43ced45070d353211c33674ba7df1d4686a7","expenses.js?v=a8b059e1f789e320":"a8b059e1f789e320b71bcc9bbe024f16b43fc9d5c92d76229868d56b19baa50e","event-order.js?v=b3ed48a35c7900da":"b3ed48a35c7900da54c3d44bc9ad5a9aca7918611a63c4723bca3e3ff6e78812","cloud.js?v=2e764435f4c3c64c":"2e764435f4c3c64c2e2b96a211979ea89a086869c39f26dbbca0ea0cdb2d25ac","data.js":"98fdbe8c614f7dcf8fa6eef22d4c1d5d16779e505fdb97fe8d537435771dfcd9","config.js":"11e1ec3cbc96cc145a05908680e01a10a1ea527b2ab1078fd8921d8139e5f776","autumn.svg":"c5705003e51151db5a0348999e8f77fd5e3c97741f4528691af9d7ea84cf0c76","icon.svg":"a00b87e63aa7442b29407fa8d72bc8fbb3e7298cf76a9e6f5d496bd38b0b88ab","icon-192.png":"1f5ca90bd254256b83876186bc27ab797f310d7e3f77a47188820c6aa6395b75","icon-512.png":"3fd4c90fbdf14b489216c422e78349b4eb5a5c4ba9de44eebf88dd8921f67971","manifest.webmanifest":"7eace135fa1e3d9f5abc716b42a0e6131230988bda9eb2d77b3f2741dbb3cb85"};
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
